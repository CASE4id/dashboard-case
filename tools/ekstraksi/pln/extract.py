"""Extract PLN Statistics 2025 tables from PDF into clean, backend-ready CSV/XLSX."""
import re, subprocess, sys, os, json
import pandas as pd

PDF = sys.argv[1]
OUT = sys.argv[2]
YEAR = int(sys.argv[3])
CFG = json.load(open(sys.argv[4]))[str(YEAR)]

def fitz_english_text(p):
    """2014 network tables print Indonesian and English unit names on top of each other.
    Rebuild the page text keeping only the English layer (offset from the header's x position)."""
    import pymupdf
    pg = pymupdf.open(PDF)[p - 1]
    spans = [(s["bbox"][0], s["bbox"][1], s["bbox"][2], s["text"].strip()) for b in pg.get_text("dict")["blocks"]
             for l in b.get("lines", []) for s in l["spans"] if s["text"].strip()]
    hx = next(x0 for x0, y, x1, t in spans if t.startswith("PLN Operational Unit"))
    isname = lambda t: re.search(r"[A-Za-z]", t) is not None
    names = [sp for sp in spans if isname(sp[3]) and sp[0] < hx + 40]
    drop = set()
    for sp in names:                                   # Indonesian layer = exactly at header x, with an English twin nearby
        if abs(sp[0] - hx) < 0.6 and any(o is not sp and abs(o[1] - sp[1]) < 3 and abs(o[0] - hx) >= 0.6 for o in names):
            drop.add(id(sp))
    keep = [sp for sp in spans if id(sp) not in drop]
    rows = []
    for sp in sorted(keep, key=lambda s: s[1]):
        if rows and abs(rows[-1][0] - sp[1]) < 3: rows[-1][1].append(sp)
        else: rows.append([sp[1], [sp]])
    return "\n".join("     ".join(re.sub(r"\s+", " ", t[3]) for t in sorted(r[1])) for r in rows)

def decode_seg(t):
    """Glyph-shifted text (2015/2018 fonts): characters sit 29 code points low, so digits/space/punctuation become
    control characters. Any segment containing control characters is shifted back as a whole."""
    if not any(ord(c) < 32 and c not in "\n\r" for c in t):
        return t
    return "".join(chr(ord(c) + 29) if 1 <= ord(c) <= 93 and c not in "\n\r" else c for c in t)

def decode_text(txt):
    return "\n".join(" ".join(decode_seg(seg) for seg in line.split(" ")) for line in txt.split("\n"))

def page_text(p):
    if p in CFG.get("_english_layer_pages", []):
        return fitz_english_text(p)
    return decode_text(subprocess.run(["pdftotext", "-layout", "-f", str(p), "-l", str(p), PDF, "-"],
                          capture_output=True, text=True, check=True).stdout)

NUM_RE = re.compile(r"^\(?-?[\d.,]+\)?$")

def is_num(tok):
    return tok == "-" or bool(NUM_RE.match(tok)) and any(c.isdigit() for c in tok)

def parse_num(tok):
    if tok == "-":
        return None
    neg = (tok.startswith("(") and tok.endswith(")")) or tok.startswith("-")
    t = tok.strip("()").lstrip("-")
    if "," in t and "." in t:                      # both: the last separator is the decimal mark
        if t.rfind(",") > t.rfind("."): t = t.replace(".", "").replace(",", ".")
        else: t = t.replace(",", "")
    elif "," in t:
        parts = t.split(",")
        if len(parts) > 2 and len(parts[-1]) == 2: t = "".join(parts[:-1]) + "." + parts[-1]   # 183,808,97 (2016)
        elif len(parts) > 2 or len(parts[-1]) == 3: t = t.replace(",", "")    # 1,250,058 / 2,500
        else: t = t.replace(",", ".")                                          # 141,01
    elif "." in t:
        parts = t.split(".")
        if len(parts) > 2 and all(len(p) == 3 for p in parts[1:-1]):
            t = "".join(parts[:-1]) + ("." if len(parts[-1]) == 2 else "") + parts[-1]   # 2.500.00 / 17.334.21
        elif len(parts) > 2: t = parts[0] + "." + parts[1]                             # malformed 3.00.00 -> 3.00
        elif len(parts[-1]) == 3: t = t.replace(".", "")                     # 7.580 -> 7580
    v = float(t)
    return -v if neg else v

SKIP = ("Statistics", "Data Tahunan", "Tabel", "Catatan", "*)", "**)")

TOKEN_FIX = {}

def split_line(line):
    toks = [TOKEN_FIX.get(t, t) for t in line.split()]
    toks = [re.sub(r"\*+\)$", "", t) if re.match(r"^[\d.,()-]+\*+\)$", t) else t for t in toks]
    nums = []
    while toks and is_num(toks[-1]):
        nums.insert(0, toks.pop())
    return " ".join(toks), nums

UNIT_RE = re.compile(r"^(UI[DWKTP]|Ui[dwktp]|PLN |Pln |PT |Pt |- [A-Z]|Kit |Luar Jawa|Jawa|Indonesia|Proyek|Unit Induk|Outside Java|Java|Region|Distribution|Dist\.|Distributin|Generation|Transmission|Load Dispatch|P3B|P2B|UIP|Batam|Tarakan|Main |Construction|Sumatera Trans|Power Plant|Wilayah|[*\-'5(][A-Z])")

def parse_left(p, n):
    rows = []; pending = None
    for line in page_text(p).splitlines():
        s = line.strip()
        if not s or any(k in s for k in ("Statistics PLN", "Statistik PLN", "PLN Statistics", "Annual Data")) or s.startswith(SKIP):
            continue
        name, nums = split_line(s)
        if pending and not name and nums:                  # continuation of a wrapped data row
            pn, pv = pending; pending = None
            if pv and pv[-1] == nums[0] and len(pv) + len(nums) == n + 1:
                nums = nums[1:]                            # value printed twice at the wrap
            if len(pv) + len(nums) == n:
                rows.append([pn, [parse_num(x) for x in pv + nums]])
            continue
        pending = None
        if name and len(nums) == n + 1 and nums[0] == "-" and name.endswith(("Power", "Power -")):
            name += " -"; nums = nums[1:]                  # "PLN Indonesia Power -" + wrapped "Kalimantan"
        if name and 0 < len(nums) < n and name.split()[0] in ("Jawa", "Indonesia", "Luar"):
            pending = (name, nums)
            continue
        if name and n >= 4 and 1 <= len(nums) < n and (len(nums) >= n - 2 or n >= 10) and UNIT_RE.match(unshift(name).strip()):
            vals = [None] * n if all(x == "-" for x in nums) else align_short(p, n, name, nums)
            if vals:
                rows.append([name, [parse_num(v) if v else None for v in vals]])
                continue
        if name and not nums and not (rows and (re.search(r"(dan|and|&|,|-|\bof|\(UIP\))$", rows[-1][0]) or name.startswith(("dan ", "and ", "of ")))) \
                and UNIT_RE.match(unshift(name).strip()):
            pending = (name, [])                           # name on its own line, numbers on the next
            continue
        if name and len(nums) == n:
            rows.append([name, [parse_num(x) for x in nums]])
        elif name and not nums and rows and (re.search(r"(dan|and|&|,|-|\bof|\(UIP\))$", rows[-1][0]) or name.startswith(("dan ", "and ", "of "))
                                                  or (rows[-1][0].startswith("Power Plant Development Unit") and not UNIT_RE.match(name))) and len(name.split()) <= 4:
            rows[-1][0] += " " + name           # wrapped unit name
    return rows

def bbox_lines(p):
    import html
    xml = subprocess.run(["pdftotext", "-bbox", "-f", str(p), "-l", str(p), PDF, "-"],
                         capture_output=True, text=True, check=True).stdout
    words = [(float(a), float(b), re.sub(r"(?<=\d)\*+\)$", "", decode_seg(html.unescape(w)))) for a, b, w in
             re.findall(r'yMin="([\d.]+)" xMax="([\d.]+)" yMax="[\d.]+">([^<]*)</word>', xml)]
    lines = {}
    for y, x, w in words:
        key = next((k for k in lines if abs(k - y) < 2.5), y)
        lines.setdefault(key, []).append((x, w))
    return [sorted(v) for k, v in sorted(lines.items())]

def bbox_lines_y(p):
    import html
    xml = subprocess.run(["pdftotext", "-bbox", "-f", str(p), "-l", str(p), PDF, "-"],
                         capture_output=True, text=True, check=True).stdout
    words = [(float(a), float(b), re.sub(r"(?<=\d)\*+\)$", "", decode_seg(html.unescape(w)))) for a, b, w in
             re.findall(r'yMin="([\d.]+)" xMax="([\d.]+)" yMax="[\d.]+">([^<]*)</word>', xml)]
    lines = {}
    for y, x, w in words:
        key = next((k for k in lines if abs(k - y) < 2.5), y)
        lines.setdefault(key, []).append((x, w))
    return [(k, sorted(v)) for k, v in sorted(lines.items())]

def left_ys(p, rows):
    """y position of each parsed left row: find, in order, the page line whose label matches the row name."""
    norm = lambda t: re.sub(r"[^a-z0-9]", "", "".join(ch for ch in unshift(t) if ch.isprintable()).lower())
    lines = []
    for y, l in bbox_lines_y(p):
        k = len(l)
        while k > 0 and is_num(TOKEN_FIX.get(l[k - 1][1], l[k - 1][1])): k -= 1
        if k < len(l):                                      # line carries numbers
            lines.append((y, norm(" ".join(w for _, w in l[:k]))))
    ys, i = [], 0
    for name, vals in rows:
        key = norm(name); hit = None
        for j in range(i, min(i + 6, len(lines))):
            lk = lines[j][1]
            if lk and (lk == key or key.startswith(lk) or lk.startswith(key)):
                hit = j; break
        if hit is None: ys.append(None)
        else: ys.append(lines[hit][0]); i = hit + 1
    return ys

def align_short(p, n, name, nums):
    """Place a row with blank cells into the right columns using word positions."""
    lines = bbox_lines(p)
    def tail(l):
        t = []
        for x, w in reversed(l):
            if is_num(w): t.insert(0, (x, w))
            else: break
        return t
    full = [tail(l) for l in lines if len(tail(l)) == n]
    if not full: return None
    anchors = [sorted(t[i][0] for t in full)[len(full) // 2] for i in range(n)]
    an = lambda t: re.sub(r"[^A-Za-z0-9]", "", unshift(t))
    key = an(name)
    for l in lines:
        t = tail(l); nm = an(" ".join(w for _, w in l[:len(l) - len(t)]))
        if nm == key and [w for _, w in t] == nums:
            vals = [None] * n
            for x, w in t:
                j = min(range(n), key=lambda i: abs(anchors[i] - x))
                if vals[j] is not None: return None
                vals[j] = w
            return vals
    return None

RIGHT_Y = []

def parse_right(p, n):
    """Position-aware: numbers are right-aligned, so map each word to the nearest column by its right edge."""
    yl = bbox_lines_y(p); lines = [l for _, l in yl]; RIGHT_Y.clear()
    full = [l for l in lines if len(l) == n and all(is_num(w) for _, w in l)]
    if not full:
        return parse_right_text(p, n)
    anchors = [sorted(l[i][0] for l in full)[len(full) // 2] for i in range(n)]
    rows = []
    for l in lines:
        if not all(is_num(w) for _, w in l) or not (n - 2 <= len(l) <= n):
            continue
        vals = [None] * n; ok = True
        for x, w in l:
            j = min(range(n), key=lambda i: abs(anchors[i] - x))
            if vals[j] is not None or abs(anchors[j] - x) > 12:
                ok = False; break
            vals[j] = w
        if ok:
            rows.append([parse_num(v) if v else None for v in vals])
            RIGHT_Y.append(next(y for y, ll in yl if ll is l))
    return rows

def parse_right_text(p, n):
    rows = []
    for line in page_text(p).splitlines():
        name, nums = split_line(line.strip())
        if not name and len(nums) == n:
            rows.append([parse_num(x) for x in nums])
    return rows

ALIASES = {"outsidejava": "Luar Jawa", "java": "Jawa", "unitinduk pusatpengaturbeban": "UIP2B", "unitinduk pusatpengaturanbeban": "UIP2B", "-d.i.yogyakarta": "- Daerah Istimewa Yogyakarta",
           "jawa": "Jawa", "indonesia": "Indonesia", "luarjawa": "Luar Jawa"}

GARBLE_WORDS = ("generation", "transmission", "region", "part", "java", "jawa", "sumatera", "kalimantan", "sulawesi", "project",
                "bali", "central", "eastern", "western", "northern", "norhtern", "southern", "control", "center", "genco", "maluku",
                "papua", "gorontalo", "jambi", "bengkulu", "yogyakarta", "north", "south", "east", "west", "dist", "nusra", "nursa",
                "tanjung", "trans")

def unshift(n):
    """Some 2018 rows use a font whose glyphs are shifted by 29 code points ("*HQHUDWLRQ" -> "Generation";
    space and hyphen become control characters 0x03 and 0x10). Decode the whole name when any word decodes to a known word."""
    shift = lambda t: "".join(chr(ord(c) + 29) if 1 <= ord(c) <= 93 else c for c in t)
    toks = re.split(r"[ \x03]", n)
    if not any(not re.search(r"[a-z]", t) and any(w in shift(t).lower() for w in GARBLE_WORDS) for t in toks if t):
        return n
    return " ".join(shift(t) if not re.search(r"[a-z]", t) and t not in ("-",) else t for t in toks if t != "")

def clean_name(n):
    n = unshift(n)
    n = "".join(ch for ch in n if ch.isprintable())
    key = re.sub(r"\s+", "", n.replace("*)", "")).lower()
    for k, v in ALIASES.items():
        if key == k.replace(" ", ""):
            return v
    n = n.replace("\u00ad", "").replace("*)", "").replace("&", "dan")
    n = re.sub(r"^Pt Pln\b", "PT PLN", n); n = re.sub(r"^Pln\b", "PLN", n)
    n = re.sub(r"^(- )?(Uid|Uiw|Uip3b|Uip2b|Uik|Uit)\b", lambda m: (m.group(1) or "") + m.group(2).upper(), n)
    n = re.sub(r"(\w)\. (?=[A-Z])", r"\1, ", n)       # "Selatan. Jambi" -> "Selatan, Jambi"
    n = re.sub(r",(?=\S)", ", ", n)                 # "Utara,Tengah" -> "Utara, Tengah"
    n = n.replace(", dan ", " dan ")                  # "Jambi, dan" -> "Jambi dan"
    n = re.sub(r"\s+", " ", n).strip()
    return n

import csv
NAME_MAP = {}
_nm = os.path.join(os.path.dirname(os.path.abspath(__file__)), "unit_name_map.csv")
if os.path.exists(_nm):
    for r in csv.DictReader(open(_nm, encoding="utf-8")):
        NAME_MAP[r["key"]] = r["canonical_name"]

def slug(s):
    return re.sub(r"[^a-z0-9]+", "_", s.lower()).strip("_")

def category(name):
    n = name
    if n == "Indonesia": return "national_total"
    if n in ("Luar Jawa", "Jawa"): return "regional_total"
    if n.startswith("- "): return "province"
    for pre, cat in [("UIKL", "generation_transmission_unit"), ("UID", "distribution_unit"), ("UIW", "regional_unit"),
                     ("UIP3B", "transmission_dispatch_unit"), ("UIP2B", "transmission_dispatch_unit"),
                     ("UIT", "transmission_unit"), ("UIK", "generation_unit"),
                     ("PLN Indonesia Power", "generation_subsidiary"), ("PLN Nusantara Power", "generation_subsidiary"),
                     ("PT Indonesia Power", "generation_subsidiary"), ("PT PJB", "generation_subsidiary"),
                     ("UIKL", "generation_transmission_unit"), ("UIP ", "construction_unit"),
                     ("PT PLN", "subsidiary"), ("Kit", "generation_unit"), ("Proyek", "generation_projects"),
                     ("P3B", "transmission_dispatch_unit"), ("P2B", "transmission_dispatch_unit")]:
        if n.startswith(pre): return cat
    return "other"

# ---------------- table specs ----------------
# each col: (key, label_en, label_id, uom)
T = {}
T["t01"] = dict(title_en="Power Balance", title_id="Neraca Daya", pages=[1], cols=[
    ("installed_capacity_mw", "Installed capacity (PLN, leased & IPP)", "Kapasitas terpasang", "MW"),
    ("power_capacity_mw", "Power (derated) capacity", "Daya mampu", "MW"),
    ("peak_load_mw", "Peak load", "Beban puncak", "MW")])
T["t02"] = dict(title_en="Energy Balance", title_id="Neraca Energi", pages=[2, 3], cols=[
    ("purchased_gwh", "Purchased from outside PLN", "Dibeli dari luar PLN", "GWh"),
    ("project_gwh", "Project", "Proyek", "GWh"),
    ("received_other_unit_gwh", "Received from other unit", "Terima dari unit lain", "GWh"),
    ("own_production_gwh", "Own production", "Produksi sendiri", "GWh"),
    ("leased_gwh", "Leased", "Sewa", "GWh"),
    ("own_use_power_plant_gwh", "Own use - power plant", "Pemakaian sendiri pembangkit", "GWh"),
    ("own_use_power_plant_pct", "Own use - power plant", "Pemakaian sendiri pembangkit", "%"),
    ("transformer_losses_gwh", "Transformer losses", "Susut trafo", "GWh"),
    ("transformer_losses_pct", "Transformer losses", "Susut trafo", "%"),
    ("net_production_gwh", "Net production", "Produksi netto", "GWh"),
    ("own_use_substation_gwh", "Own use - substation transformer", "Pemakaian sendiri gardu induk", "GWh"),
    ("own_use_substation_pct", "Own use - substation transformer", "Pemakaian sendiri gardu induk", "%"),
    ("transmission_losses_gwh", "Transmission losses", "Susut transmisi", "GWh"),
    ("transmission_losses_pct", "Transmission losses", "Susut transmisi", "%"),
    ("transfer_other_unit_gwh", "Transfer to other unit", "Dikirim ke antar unit", "GWh"),
    ("transfer_non_pln_gwh", "Transfer to non-PLN entities (IPP & projects)", "Kirim ke luar PLN", "GWh"),
    ("transfer_distribution_gwh", "Transfer to distribution", "Kirim ke distribusi", "GWh"),
    ("own_use_distr_substation_gwh", "Own use - distribution substation", "Pemakaian sendiri gardu distribusi", "GWh"),
    ("own_use_distr_substation_pct", "Own use - distribution substation", "Pemakaian sendiri gardu distribusi", "%"),
    ("distribution_losses_gwh", "Distribution losses", "Susut distribusi", "GWh"),
    ("distribution_losses_pct", "Distribution losses", "Susut distribusi", "%"),
    ("energy_losses_gwh", "Energy losses", "Susut energi", "GWh"),
    ("energy_losses_pct", "Energy losses", "Susut energi", "%"),
    ("energy_losses_own_use_gwh", "Energy losses & own use", "Susut energi & PS", "GWh"),
    ("energy_losses_own_use_pct", "Energy losses & own use", "Susut energi & PS", "%"),
    ("energy_consumption_gwh", "Energy consumption", "Pemakaian", "GWh"),
    ("energy_consumption_pct", "Energy consumption", "Pemakaian", "%")], split=14)
T["t08"] = dict(title_en="Average Energy Sold per Customer by Customer Type", title_id="Energi Terjual Rata-rata per Jenis Pelanggan", pages=[4], cols=[
    ("households_kwh", "Households", "Rumah tangga", "kWh/customer"),
    ("industry_kwh", "Industry", "Industri", "kWh/customer"),
    ("business_kwh", "Business", "Bisnis", "kWh/customer"),
    ("social_kwh", "Social", "Sosial", "kWh/customer"),
    ("gov_office_kwh", "Government office buildings", "Gedung kantor pemerintah", "kWh/customer"),
    ("street_lighting_kwh", "Public street lighting", "Penerangan jalan umum", "kWh/customer"),
    ("others_tcl_kwh", "Others (T,C,L)", "Lainnya (T,C,L)", "kWh/customer"),
    ("total_kwh", "Total", "Jumlah", "kWh/customer")])
T["t16"] = dict(title_en="SAIDI and SAIFI", title_id="SAIDI dan SAIFI", pages=[5], cols=[
    ("saidi_hours_per_customer", "SAIDI", "SAIDI", "hours/customer"),
    ("saifi_times_per_customer", "SAIFI", "SAIFI", "times/customer")])
T["t19"] = dict(title_en="Electrification Ratio", title_id="Rasio Elektrifikasi", pages=[6], cols=[
    ("population_thousand", "Population", "Jumlah penduduk", "thousand people"),
    ("households_thousand", "Households", "Rumah tangga", "thousand households"),
    ("household_customers", "Household customers (incl. APDAL)", "Pelanggan rumah tangga", "customers"),
    ("electrification_ratio_pct", "Electrification ratio (excl. non-PLN)", "Rasio elektrifikasi", "%"),
    ("kwh_sold_per_capita", "Electricity sold per capita", "kWh terjual per kapita", "kWh/capita")])
T["t21"] = dict(title_en="Installed Capacity by Plant Type", title_id="Kapasitas Terpasang", pages=[7, 8], cols=[
    ("hydro_mw", "Hydro (PLTA)", "PLTA", "MW"),
    ("mini_hydro_mw", "Mini hydro (PLTM)", "PLTM", "MW"),
    ("micro_hydro_mw", "Micro hydro (PLTMH)", "PLTMH", "MW"),
    ("steam_mw", "Steam/coal (PLTU)", "PLTU", "MW"),
    ("gas_mw", "Gas turbine (PLTG)", "PLTG", "MW"),
    ("combined_cycle_mw", "Combined cycle (PLTGU)", "PLTGU", "MW"),
    ("geothermal_mw", "Geothermal (PLTP)", "PLTP", "MW"),
    ("diesel_mw", "Diesel (PLTD)", "PLTD", "MW"),
    ("gas_engine_mw", "Gas engine (PLTMG)", "PLTMG", "MW"),
    ("solar_mw", "Solar (PLTS)", "PLT Surya", "MW"),
    ("wind_mw", "Wind (PLTB)", "PLT Bayu", "MW"),
    ("biomass_mw", "Biomass", "PLT Biomassa", "MW"),
    ("pln_owned_subtotal_mw", "PLN-owned subtotal", "Sub jumlah", "MW"),
    ("pln_owned_subtotal_share_pct", "Share of national PLN-owned subtotal", "Sub jumlah (%)", "%"),
    ("leased_mw", "Leased", "Sewa", "MW"),
    ("ipp_mw", "IPP", "IPP", "MW"),
    ("total_mw", "Total", "Jumlah", "MW"),
    ("total_share_pct", "Share of national total", "Jumlah (%)", "%")], split=8)
gen = lambda pre, lab: [(f"{pre}_{k}_gwh", f"{lab} - {e}", f"{lab} - {i}", "GWh") for k, e, i in [
    ("hydro", "Hydro (PLTA)", "PLTA"), ("mini_hydro", "Mini hydro (PLTM)", "PLTM"), ("micro_hydro", "Micro hydro (PLTMH)", "PLTMH"),
    ("steam", "Steam/coal (PLTU)", "PLTU"), ("gas", "Gas turbine (PLTG)", "PLTG"), ("combined_cycle", "Combined cycle (PLTGU)", "PLTGU"),
    ("geothermal", "Geothermal (PLTP)", "PLTP"), ("diesel", "Diesel (PLTD)", "PLTD"), ("gas_engine", "Gas engine (PLTMG)", "PLTMG"),
    ("solar", "Solar (PLTS)", "PLT Surya"), ("wind", "Wind (PLTB)", "PLT Bayu"), ("biomass", "Biomass", "PLT Biomassa")]]
T["t23"] = dict(title_en="Energy Production by Plant Type", title_id="Energi yang Diproduksi per Jenis Pembangkit", pages=[9, 10],
    cols=gen("own", "Own generated") + [
    ("leased_diesel_gwh", "Leased - Diesel (PLTD)", "Sewa - PLTD", "GWh"),
    ("leased_gas_engine_gwh", "Leased - Gas engine (PLTMG)", "Sewa - PLTMG", "GWh"),
    ("leased_gas_gwh", "Leased - Gas turbine (PLTG)", "Sewa - PLTG", "GWh"),
    ("leased_combined_cycle_gwh", "Leased - Combined cycle (PLTGU)", "Sewa - PLTGU", "GWh"),
    ("leased_steam_gwh", "Leased - Steam/coal (PLTU)", "Sewa - PLTU", "GWh"),
    ("leased_hydro_gwh", "Leased - Hydro (PLTA)", "Sewa - PLTA", "GWh"),
    ("leased_solar_gwh", "Leased - Solar (PLTS)", "Sewa - PLT Surya", "GWh"),
    ("own_and_leased_subtotal_gwh", "Own + leased subtotal", "Sub jumlah", "GWh"),
    ("purchased_gwh", "Purchased", "Beli", "GWh"),
    ("project_gwh", "Project", "Proyek", "GWh"),
    ("purchased_and_project_gwh", "Purchased and project", "Pembelian dan proyek", "GWh"),
    ("total_gwh", "Total", "Jumlah", "GWh"),
    ("total_share_pct", "Share of national total", "Jumlah (%)", "%")], split=12)
T["t28"] = dict(title_en="Length of Transmission Lines", title_id="Panjang Jaringan Transmisi", pages=[11], cols=[
    ("kv_25_30_kms", "25-30 kV", "25-30 kV", "kms"), ("kv_70_kms", "70 kV", "70 kV", "kms"),
    ("kv_150_kms", "150 kV", "150 kV", "kms"), ("kv_275_kms", "275 kV", "275 kV", "kms"),
    ("kv_500_kms", "500 kV", "500 kV", "kms"), ("total_kms", "Total", "Jumlah", "kms")])
T["t29"] = dict(title_en="Length of Distribution Lines", title_id="Panjang Jaringan Distribusi", pages=[12], cols=[
    ("mv_6_7kv_kms", "Medium voltage 6-7 kV", "Tegangan menengah 6-7 kV", "kms"),
    ("mv_10_12kv_kms", "Medium voltage 10-12 kV", "Tegangan menengah 10-12 kV", "kms"),
    ("mv_15_20kv_kms", "Medium voltage 15-20 kV", "Tegangan menengah 15-20 kV", "kms"),
    ("lv_kms", "Low voltage", "Tegangan rendah", "kms")])
T["t30"] = dict(title_en="Number and Capacity of Substation Transformers", title_id="Jumlah dan Daya Terpasang Trafo Gardu Induk", pages=[13],
    cols=sum([[(f"kv_{k}_units", f"{lab} - units", f"{lab} - unit", "units"), (f"kv_{k}_mva", f"{lab} - capacity", f"{lab} - daya", "MVA")]
              for k, lab in [("500", "500 kV"), ("275", "275 kV"), ("150", "150 kV"), ("70", "70 kV"), ("lt30", "<30 kV"), ("total", "Total")]], []))

NAMES = {"t01": "power_balance", "t02": "energy_balance", "t08": "avg_energy_sold_per_customer",
         "t16": "saidi_saifi", "t19": "electrification_ratio", "t21": "installed_capacity_by_plant_type",
         "t23": "energy_production_by_plant_type", "t28": "transmission_line_length",
         "t29": "distribution_line_length", "t30": "substation_transformers"}

JOIN_LOG = []
csv_dir = os.path.join(OUT, "csv"); os.makedirs(csv_dir, exist_ok=True)
wide, longrows, dictrows, report = {}, [], [], []
units = {}

ONLY = [t for t in os.environ.get("PLN_ONLY_TABLES", "").split(",") if t]   # used by auto_config.py to test one table at a time
for tid, spec in T.items():
    if ONLY and tid not in ONLY:
        continue
    c = CFG[tid]
    TOKEN_FIX.clear(); TOKEN_FIX.update(c.get("token_fix", {}))
    master = spec["cols"]; mk = {m[0]: m for m in master}
    keys = c.get("keys") or [m[0] for m in master]
    cols = [mk[k] for k in keys]; n = len(cols)
    if c.get("split"):
        n1 = c["split"]; n2 = n - n1
        left = parse_left(c["pages"][0], n1)
        right = parse_right(c["pages"][1], n2)
        left = [r for r in left if r[0] not in ("%", "(%)")]
        ry = list(RIGHT_Y)
        ly = left_ys(c["pages"][0], left) if len(ry) == len(right) else [None] * len(left)
        if sum(y is None for y in ly) <= 2 and len(right) > 0:              # pair rows by vertical position (same grid on both pages)
            rows, used, prev = [], set(), -1
            for (nm, lv), y in zip(left, ly):
                j = min(range(len(right)), key=lambda k: abs(ry[k] - y)) if y is not None else None
                if j is not None and abs(ry[j] - y) < 3 and j not in used:
                    used.add(j); rows.append([nm, lv + right[j]]); prev = j
                elif prev + 1 < len(right) and prev + 1 not in used and (y is None or abs(ry[prev + 1] - y) < 12):
                    j = prev + 1; used.add(j); rows.append([nm, lv + right[j]]); prev = j   # nearest next row in sequence
                else:
                    rows.append([nm, lv + [None] * n2])
            JOIN_LOG.append((tid, "y", len(left), len(right), len(right) - len(used)))
        else:
            extra = len(right) - len(left)
            assert 0 <= extra <= 1, (tid, len(left), len(right))
            rows = [[l[0], l[1] + r] for l, r in zip(left, right)]
            JOIN_LOG.append((tid, "order", len(left), len(right), extra))
    else:
        rows = [r for r in parse_left(c["pages"][0], n) if r[0] != "%"]

    recs, region, parent, after_java = [], "Luar Jawa", None, False
    relabel = c.get("relabel_rows", {})                    # documented fixes for mislabelled source rows (by row order)
    for order, (raw, vals) in enumerate(rows, 1):
        raw = relabel.get(str(order), raw)
        reported = re.sub(r"\s+", " ", "".join(ch for ch in unshift(raw) if ch.isprintable()).replace("\u00ad", "").replace("*)", "")).strip()
        name = clean_name(raw)
        key = re.sub(r"[^a-z0-9]", "", re.sub(r"&|\b(and|dan)\b", " ", name.lower()))
        mapped = NAME_MAP.get(key) or NAME_MAP.get(key if not name.startswith("- ") else key)
        if mapped:
            name = mapped if (mapped.startswith("- ") == name.startswith("- ")) else name
        cat = category(name)
        disp = name[2:] if cat == "province" else name
        if after_java and name not in ("Indonesia", "Proyek Pembangkitan") and cat != "province":
            cat = "project_component"; uid = "proj_" + slug(disp); par = "proyek_pembangkitan"
        elif cat == "province":
            uid = "prov_" + slug(disp); par = parent
        else:
            uid = slug(name); par = None
            if cat not in ("regional_total", "national_total"):
                parent = uid
        if name == "Luar Jawa": reg = "Luar Jawa"; region = "Jawa"
        elif name == "Jawa": reg = "Jawa"; region = None; after_java_next = True
        elif name == "Indonesia": reg = None
        else: reg = region
        if name == "Jawa": after_java = True
        rec = dict(year=YEAR, row_order=order, unit_id=uid, unit_name=disp, unit_name_reported=reported, row_type=cat,
                   parent_unit_id=par, region=reg)
        for m in master:
            rec[m[0]] = None
        for (k, *_), v in zip(cols, vals):
            rec[k] = v
        recs.append(rec)
        units.setdefault(uid, dict(unit_id=uid, unit_name=disp, row_type=cat, parent_unit_id=par, region=reg))
        for (k, le, li, uom), v in zip(cols, vals):
            longrows.append(dict(year=YEAR, table_id=tid, table_name=NAMES[tid], unit_id=uid, unit_name=disp, unit_name_reported=reported,
                                 row_type=cat, parent_unit_id=par, region=reg, indicator=k,
                                 indicator_label_en=le, indicator_label_id=li, uom=uom, value=v))
    for col in c.get("null_cols", []):                     # documented unusable source columns
        for r in recs:
            if r["unit_id"] != "indonesia": r[col] = None
        longrows[:] = [lr for lr in longrows if not (lr["table_id"] == tid and lr["indicator"] == col and lr["unit_id"] != "indonesia")]
    for uid_, src, dst in c.get("cell_moves", []):          # documented fixes for footnoted cells
        for r in recs:
            if r["unit_id"] == uid_ and r.get(src) is not None:
                r[dst], r[src] = r[src], None
                for lr in longrows:
                    if lr["table_id"] == tid and lr["unit_id"] == uid_ and lr["indicator"] == src:
                        m = {k[0]: k for k in master}[dst]
                        lr.update(indicator=dst, indicator_label_en=m[1], indicator_label_id=m[2], uom=m[3])
    df = pd.DataFrame(recs)
    wide[tid] = df
    df.to_csv(os.path.join(csv_dir, f"{tid}_{NAMES[tid]}.csv"), index=False, encoding="utf-8")
    for k, le, li, uom in master:
        dictrows.append(dict(table_id=tid, table_name=NAMES[tid], table_title_en=spec["title_en"],
                             table_title_id=spec["title_id"], column=k, label_en=le, label_id=li, uom=uom))
    report.append((tid, len(df)))

long_df = pd.DataFrame(longrows)
long_df.to_csv(os.path.join(OUT, f"pln_statistics_{YEAR}_long.csv"), index=False, encoding="utf-8")
dict_df = pd.DataFrame(dictrows)
dict_df.to_csv(os.path.join(OUT, "data_dictionary.csv"), index=False, encoding="utf-8")
units_df = pd.DataFrame(units.values())
units_df.to_csv(os.path.join(OUT, "units.csv"), index=False, encoding="utf-8")
pd.to_pickle(wide, os.path.join(OUT, ".wide.pkl"))
for r in report: print(r)
print("JOIN", JOIN_LOG)
print("long rows", len(long_df), "units", len(units_df))
