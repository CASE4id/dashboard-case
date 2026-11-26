"""Review report (Markdown, Bahasa Indonesia) for a newly extracted Statistik PLN year.
Used as the pull-request description by the "Tambah data PLN dari PDF" workflow.

    python3 pln/laporan.py YEAR NEW.xlsx PREV.xlsx VALIDATE.txt LABELS.txt AUTO.md|- AUTO_STATUS PDFNAME OUT.md
AUTO_STATUS: "ok", "review", "existing" (config entry already existed) or "fail".
Writes OUT.md and prints "ok" or "review" (overall status).
"""
import json, os, re, sys
import openpyxl

HERE = os.path.dirname(os.path.abspath(__file__))
KEY = [  # (table, column, label, unit, is_percent)
    ("t01", "installed_capacity_mw", "Kapasitas terpasang (Tabel 1)", "MW", False),
    ("t01", "peak_load_mw", "Beban puncak", "MW", False),
    ("t21", "total_mw", "Kapasitas terpasang (Tabel 21)", "MW", False),
    ("t23", "total_gwh", "Produksi energi", "GWh", False),
    ("t02", "energy_consumption_gwh", "Energi terjual / dikonsumsi", "GWh", False),
    ("t02", "distribution_losses_pct", "Susut distribusi", "%", True),
    ("t16", "saidi_hours_per_customer", "SAIDI", "jam/pelanggan", False),
    ("t16", "saifi_times_per_customer", "SAIFI", "kali/pelanggan", False),
    ("t19", "electrification_ratio_pct", "Rasio elektrifikasi", "%", True),
    ("t19", "household_customers", "Pelanggan rumah tangga", "pelanggan", False),
    ("t08", "households_kwh", "Konsumsi per pelanggan rumah tangga", "kWh", False),
    ("t28", "total_kms", "Panjang jaringan transmisi", "kms", False),
    ("t29", "lv_kms", "Panjang jaringan tegangan rendah", "kms", False),
    ("t30", "kv_total_mva", "Daya trafo gardu induk", "MVA", False),
]
UNIT_TYPES = {"distribution_unit", "regional_unit", "subsidiary"}


def load(path):
    wb = openpyxl.load_workbook(path, read_only=True)
    out = {}
    for t in ("t01", "t02", "t08", "t16", "t19", "t21", "t23", "t28", "t29", "t30"):
        it = wb[t].iter_rows(values_only=True); h = list(next(it))
        out[t] = [dict(zip(h, r)) for r in it if any(v is not None for v in r)]
    return out


def val(d, t, u, c):
    for r in d.get(t, []):
        if r.get("unit_id") == u:
            v = r.get(c)
            return v if isinstance(v, (int, float)) else None
    return None


def fmt(v, pct=False):
    if v is None:
        return "–"
    s = f"{v:,.2f}" if pct or abs(v) < 100 else f"{v:,.0f}"
    return s.replace(",", "X").replace(".", ",").replace("X", ".")


def main(year, new, prev, vfile, lfile, auto_md, auto_status, pdfname, out):
    year = int(year)
    P = load(prev)
    if new == "-":          # extraction did not finish: report only, no data file
        return report_only(year, prev, auto_md, pdfname, out)
    N = load(new)
    pyear = int(re.search(r"(\d{4})", os.path.basename(prev)).group(1))
    vlines = [l.strip() for l in open(vfile, encoding="utf-8") if re.search(r"MISMATCH|COL |NO REGION", l) and "net_production" not in l]
    llines = [l.strip() for l in open(lfile, encoding="utf-8") if "MISMATCH" in l]
    review = auto_status in ("review", "fail") or bool(llines)

    md = []
    if review:
        md += [f"## ⚠️ Data Statistik PLN {year}: perlu bantuan teknis sebelum digabungkan", "",
               "Sebagian tabel tidak lolos pengaturan otomatis (biasanya karena PLN mengubah susunan kolom). "
               "Pull request ini dibuat sebagai **draft** agar tidak tergabung secara tidak sengaja. Lihat bagian *Pengaturan otomatis* dan *Langkah berikutnya*.", ""]
    else:
        md += [f"## ✅ Data Statistik PLN {year} siap ditinjau", "",
               "Semua tabel lolos pemeriksaan otomatis. Mohon periksa angka di bawah terhadap PDF, lalu klik **Merge pull request**.", ""]
    md += [f"- File baru: `data/listrik/statistik-pln-{year}.xlsx`", f"- Sumber: `{pdfname}`", f"- Dibandingkan dengan: {pyear}", ""]

    # 1. national figures
    md += ["### 1. Angka nasional (Indonesia) dibanding tahun lalu", "",
           "Bandingkan kolom **" + str(year) + "** dengan PDF. Tanda ⚠️ = berubah lebih dari 25% (atau lebih dari 3 poin untuk persen).", "",
           f"| Indikator | Satuan | {pyear} | {year} | Perubahan |", "|---|---|---:|---:|---|"]
    for t, c, label, unit, pct in KEY:
        a, b = val(P, t, "indonesia", c), val(N, t, "indonesia", c)
        if a is None and b is None:
            continue
        if a is None or b is None:
            ch, flag = "–", " ⚠️" if b is None else ""
        elif pct:
            d = b - a; ch = f"{d:+.2f} poin".replace(".", ","); flag = " ⚠️" if abs(d) > 3 else ""
        else:
            d = (b - a) / abs(a) * 100 if a else 0; ch = f"{d:+.1f}%".replace(".", ","); flag = " ⚠️" if abs(d) > 25 else ""
        md.append(f"| {label} | {unit} | {fmt(a, pct)} | {fmt(b, pct)} | {ch}{flag} |")
    md.append("")

    # 2. automatic checks
    md += ["### 2. Pemeriksaan otomatis", ""]
    if vlines:
        md += ["Jumlah baris/kolom yang tidak cocok (bisa salah baca, bisa juga kesalahan di PDF itu sendiri; cocokkan dengan PDF):", ""]
        md += [f"- `{l}`" for l in vlines[:40]] + ([f"- … dan {len(vlines) - 40} lainnya"] if len(vlines) > 40 else []) + [""]
    else:
        md += ["- ✅ Jumlah per baris dan per wilayah (Jawa / Luar Jawa) cocok.", ""]
    md += (["- ⚠️ Kemungkinan label baris tertukar (Tabel 2 vs Tabel 23):", ""] + [f"  - `{l}`" for l in llines] + [""]) if llines \
        else ["- ✅ Tidak ada indikasi label baris tertukar (Tabel 2 vs Tabel 23).", ""]

    # 3. unit list changes
    def units(d):
        return {r["unit_id"]: r.get("unit_name") for t in d for r in d[t] if not str(r.get("unit_id", "")).startswith(("prov_", "proj_"))}
    nu, pu = units(N), units(P)
    gone = sorted(set(pu) - set(nu)); new_u = sorted(set(nu) - set(pu))
    md += ["### 3. Perubahan daftar unit", ""]
    if new_u:
        md += ["Unit **baru** (periksa: unit yang benar-benar baru, atau nama lama yang tidak dikenali dan perlu ditambahkan ke `build_name_map.py`):", ""]
        md += [f"- `{u}` ({nu[u]})" for u in new_u] + [""]
    if gone:
        md += [f"Unit yang ada di {pyear} tetapi **tidak ada** di {year}:", ""] + [f"- `{u}` ({pu[u]})" for u in gone] + [""]
    if not new_u and not gone:
        md += ["- ✅ Daftar unit sama dengan tahun lalu.", ""]

    # 4. unit-level jumps
    jumps = []
    for t, c, label, unit, pct in KEY:
        if pct:
            continue
        for r in N.get(t, []):
            if r.get("row_type") not in UNIT_TYPES:
                continue
            u = r["unit_id"]; b = r.get(c); a = val(P, t, u, c)
            if isinstance(b, (int, float)) and isinstance(a, (int, float)) and a > 0 and max(a, b) >= 50:
                ch = (b - a) / a * 100
                if abs(ch) > 50:
                    jumps.append((abs(ch), t, label, r.get("unit_name"), a, b, ch))
    jumps.sort(reverse=True)
    md += ["### 4. Perubahan besar per unit (lebih dari 50%)", ""]
    if jumps:
        md += ["Centang setelah dicocokkan dengan PDF. Lonjakan bisa nyata, bisa juga salah baca atau baris tertukar.", ""]
        md += [f"- [ ] {t.upper()} {label}, **{u}**: {fmt(a)} → {fmt(b)} ({ch:+.0f}%)" for _, t, label, u, a, b, ch in jumps[:25]]
        if len(jumps) > 25:
            md.append(f"- … dan {len(jumps) - 25} lainnya")
        md.append("")
    else:
        md += ["- ✅ Tidak ada perubahan lebih dari 50%.", ""]

    # 5. automatic config
    if auto_md != "-" and os.path.exists(auto_md):
        md += ["### 5. " + open(auto_md, encoding="utf-8").read().lstrip("# ").strip(), ""]
    elif auto_status == "existing":
        md += ["### 5. Pengaturan", "", f"Memakai pengaturan {year} yang sudah ada di `tools/ekstraksi/pln/config.json`.", ""]

    # 6. next steps
    cfgp = json.load(open(os.path.join(HERE, "config.json"))).get(str(year), {})
    pages = ", ".join(f"{t.upper()} hal. {'-'.join(map(str, c['pages']))}" for t, c in cfgp.items()) if cfgp else "-"
    md += ["### Langkah berikutnya", ""]
    if review:
        md += ["1. Minta bantuan teknis memperbaiki pengaturan tabel yang bertanda ⚠️ di `tools/ekstraksi/pln/config.json` **di branch pull request ini** "
               "(lihat detail judul kolom di atas dan bagian 5 *Adding a new PLN year* di `tools/ekstraksi/README.md`).",
               "2. Jalankan ulang: tab **Actions** → **Tambah data PLN dari PDF** → **Run workflow**, pilih *Use workflow from* = branch pull request ini, isi tahun dan tautan PDF yang sama.",
               "3. Setelah laporan menjadi ✅, tandai **Ready for review**, periksa angka, lalu **Merge**.", ""]
    else:
        md += ["1. Buka PDF dan cocokkan angka nasional di bagian 1, serta setiap butir di bagian 4.",
               "2. Cocokkan 10 sel acak lain di beberapa tabel.",
               "3. Jika semua sesuai: klik **Merge pull request** → **Confirm merge**. Dashboard diperbarui dalam beberapa menit.",
               "4. Jika ada yang salah: tulis komentar di pull request ini dan minta bantuan teknis. Jangan di-merge.", ""]
    md += [f"<sub>Halaman tabel di PDF: {pages}</sub>", ""]
    open(out, "w", encoding="utf-8").write("\n".join(md))
    print("review" if review else "ok")


def report_only(year, prev, auto_md, pdfname, out):
    err = os.path.join(os.path.dirname(out), "error.txt")
    tail = [l.rstrip() for l in open(err, encoding="utf-8")][-8:] if os.path.exists(err) else []
    md = [f"## ⚠️ Data Statistik PLN {year}: belum bisa dibuat, perlu bantuan teknis", "",
          "Sebagian tabel tidak terbaca dengan pengaturan otomatis (biasanya karena PLN mengubah susunan kolom), "
          "sehingga **file data belum dibuat**. Pull request ini berisi usulan pengaturan di `tools/ekstraksi/pln/config.json` "
          "dan dibuat sebagai **draft**.", "", f"- Sumber: `{pdfname}`", ""]
    if auto_md != "-" and os.path.exists(auto_md):
        md += ["### " + open(auto_md, encoding="utf-8").read().lstrip("# ").strip(), ""]
    if tail:
        md += ["<details><summary>Pesan galat ekstraksi</summary>", "", "```", *tail, "```", "</details>", ""]
    md += ["### Langkah berikutnya", "",
           "1. Minta bantuan teknis memperbaiki pengaturan tabel yang bertanda ⚠️ di `tools/ekstraksi/pln/config.json` **di branch pull request ini** "
           "(lihat judul kolom di atas dan bagian 5 *Adding a new PLN year* di `tools/ekstraksi/README.md`).",
           "2. Jalankan ulang: tab **Actions** → **Tambah data PLN dari PDF** → **Run workflow**, pilih *Use workflow from* = branch pull request ini, isi tahun dan tautan PDF yang sama.",
           "3. Laporan dan file data akan diperbarui di pull request ini.", ""]
    open(out, "w", encoding="utf-8").write("\n".join(md))
    print("review")


if __name__ == "__main__":
    main(*sys.argv[1:10])
