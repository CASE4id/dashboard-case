"""Parse BPS 'Statistik Transportasi Udara 2024' airport appendices (traffic by airport, grouped by province).
Works on pdftotext -layout output; value columns are right-aligned, so each number is assigned to the
column whose right edge (character position) is nearest."""
import re, sys, json, subprocess

NUM = re.compile(r"^(\d[\d.]*|[–\-])$")
WATERMARK = re.compile(r"^(id|o\.|\.g|go|ps|\.b|w|//w|s:|tp|ht|\.id|\.go|https?:?|.*bps\.go\.id.*|\.)$")
PROVINCES = ["Aceh", "Sumatera Utara", "Sumatera Barat", "Riau", "Jambi", "Sumatera Selatan", "Bengkulu", "Lampung",
             "Kepulauan Bangka Belitung", "Kepulauan Riau", "DKI Jakarta", "Jawa Barat", "Jawa Tengah", "DI Yogyakarta",
             "Jawa Timur", "Banten", "Bali", "Nusa Tenggara Barat", "Nusa Tenggara Timur", "Kalimantan Barat",
             "Kalimantan Tengah", "Kalimantan Selatan", "Kalimantan Timur", "Kalimantan Utara", "Sulawesi Utara",
             "Sulawesi Tengah", "Sulawesi Selatan", "Sulawesi Tenggara", "Gorontalo", "Sulawesi Barat", "Maluku",
             "Maluku Utara", "Papua Barat", "Papua Barat Daya", "Papua", "Papua Selatan", "Papua Tengah", "Papua Pegunungan"]
PKEY = {re.sub(r"[^a-z]", "", p.lower()): p for p in PROVINCES}
PKEY.update({"jakarta": "DKI Jakarta", "dkijakartaraya": "DKI Jakarta", "diyogyakarta": "DI Yogyakarta", "yogyakarta": "DI Yogyakarta",
             "daerahistimewayogyakarta": "DI Yogyakarta", "bangkabelitung": "Kepulauan Bangka Belitung",
             "kepbangkabelitung": "Kepulauan Bangka Belitung", "kepriau": "Kepulauan Riau"})
SKIP = re.compile(r"^(Lampiran|Appendix|Lanjutan|Bandar Udara|Airport|Penumpang|Pesawat|Barang|Pos|Datang|Arrival|Bongkar|"
                  r"Unloaded|Passenger|Aircraft|Cargo|Mail|\(1\)|Sumber|Statistik|Air Transport|-\s*PT|PT\.|Angkasa|Kementerian|"
                  r"Udara|Bandar|Trafik|20\d\d/|2024/|General|Aviation|Traffic|, 20)")


def as_province(name):
    k = re.sub(r"[^a-z]", "", name.lower())
    if k in ("indonesia", "total", "jumlah", "jumlahtotal"):
        return "Indonesia"
    return PKEY.get(k)


def val(t):
    return None if t in ("–", "-") else int(t.replace(".", ""))


def parse(pdf, pages, ncols):
    records, cur, done, prefix, pending_vals = [], None, False, "", []
    for p in pages:
        if done:
            break
        txt = subprocess.run(["pdftotext", "-layout", "-f", str(p), "-l", str(p), pdf, "-"], capture_output=True, text=True).stdout
        lines = []
        for line in txt.splitlines():
            line = re.sub(r"(?<=\d) (?=\d{3}(?!\d))", ".", line)     # '34 937' -> '34.937' (broken thousands separator)
            toks = [(m.start(), m.end(), m.group()) for m in re.finditer(r"\S+", line) if not WATERMARK.match(m.group())]
            if toks:
                lines.append(toks)
        full = []
        for toks in lines:
            nums = [t for t in toks if NUM.match(t[2]) and t[0] > 30]
            if len(nums) == ncols and re.match(r"^[\d.]+$", nums[0][2]):
                full.append([t[1] for t in nums])
        if not full:
            continue
        anchors = [sorted(f[i] for f in full)[len(full) // 2] for i in range(ncols)]
        for toks in lines:
            vals, rest = [], []
            for t in toks:
                if NUM.match(t[2]) and t[1] > anchors[0] - 12:
                    j = min(range(ncols), key=lambda i: abs(anchors[i] - t[1]))
                    if abs(anchors[j] - t[1]) <= 8:
                        vals.append((j, t[2])); continue
                rest.append(t)
            name = " ".join(t[2] for t in rest).strip()
            if SKIP.match(name) or re.match(r"^\d{2,3}\s+Statisti", name):
                continue
            m = re.match(r"^(\d{1,3})(?:\s+(.*))?$", name)
            real = [(j, t) for j, t in vals if t not in ("–", "-")]
            if m and cur is not None and cur["kind"] == "airport" and cur["idx"] is None and not m.group(2):
                cur["idx"] = int(m.group(1))                    # index printed below a name+values line
                continue
            if m and not (cur is None and not records):
                cur = dict(kind="airport", idx=int(m.group(1)), name=(prefix + " " + (m.group(2) or "")).strip(), vals=[None] * ncols)
                records.append(cur); prefix = ""
                for j, t in pending_vals: cur["vals"][j] = val(t)
                pending_vals = []
                if not vals: continue
            elif not name and real and cur is not None and cur["kind"] == "airport" and cur["vals"][0] is not None:
                pending_vals = vals                              # values printed above their index line
                continue
            elif name and real and not as_province(name) and cur is not None and cur["vals"][0] is not None:
                cur = dict(kind="airport", idx=None, name=(prefix + " " + name).strip(), vals=[None] * ncols)   # name+values before index
                records.append(cur); prefix = ""
            elif name and as_province(name):
                cur = dict(kind="province", idx=None, name=as_province(name), vals=[None] * ncols)
                records.append(cur)
            elif name and cur is not None and cur["kind"] == "airport":
                if cur["vals"][0] is not None and cur["name"] and all(t in ("–", "-") for _, t in vals):
                    prefix = (prefix + " " + name).strip()     # name printed above its own index number
                    continue
                cur["name"] += " " + name                      # wrapped airport name
            elif name and not vals:
                continue
            if cur is not None:
                for j, t in vals:
                    cur["vals"][j] = val(t)
            if cur is not None and cur["name"] == "Indonesia" and vals:
                done = True
                break
    out, prov = [], None
    for r in records:
        if r["kind"] == "airport":
            n = re.sub(r"\s*[–-]\s*", " – ", r["name"])
            r["name"] = re.sub(r"\s+", " ", n).strip(" –")
        else:
            prov = r["name"]
        out.append(dict(kind=r["kind"], idx=r["idx"], name=r["name"], province=prov, vals=r["vals"]))
    return out


def validate(recs, n, label=""):
    provs = [r for r in recs if r["kind"] == "province"]
    tot = {}
    for r in recs:
        if r["kind"] == "airport":
            t = tot.setdefault(r["province"], [0] * n)
            for i, v in enumerate(r["vals"]):
                t[i] += v or 0
    bad = []
    for r in provs:
        if r["name"] == "Indonesia":
            s = [sum((p["vals"][i] or 0) for p in provs if p["name"] != "Indonesia") for i in range(n)]
            if s != [v or 0 for v in r["vals"]]:
                bad.append(("NATIONAL", r["vals"], s))
            continue
        got = tot.get(r["name"], [0] * n)
        if got != [v or 0 for v in r["vals"]]:
            bad.append((r["name"], r["vals"], got))
    na = sum(r["kind"] == "airport" for r in recs)
    print(f"{label}: {na} airports, {len(provs) - 1} provinces, mismatches: {len(bad)}")
    for b in bad:
        print("   ", b)
    return bad


if __name__ == "__main__":
    pdf, a, b, n = sys.argv[1], int(sys.argv[2]), int(sys.argv[3]), int(sys.argv[4])
    recs = parse(pdf, range(a, b + 1), n)
    json.dump(recs, open(sys.argv[5], "w"), ensure_ascii=False, indent=0)
    validate(recs, n, sys.argv[5])
