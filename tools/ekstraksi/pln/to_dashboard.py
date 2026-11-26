"""Turn the combined extraction workbook into the dashboard's yearly file.

    python3 pln/to_dashboard.py output/pln_statistics_2026_2026/pln_statistics_2026_2026.xlsx 2026 \
        ../../data/listrik/statistik-pln-2026.xlsx ../../data/listrik/statistik-pln-2025.xlsx

The previous year's dashboard file provides the column order of every sheet, the unit list (units that
appear for the first time are added), the data dictionary and the layout of the "catatan" sheet.
Data-quality notes for the year come from pln/data_quality_notes.csv.
"""
import os, sys
import openpyxl, pandas as pd
from openpyxl.styles import Font

HERE = os.path.dirname(os.path.abspath(__file__))
TABLES = ["t01", "t02", "t08", "t16", "t19", "t21", "t23", "t28", "t29", "t30"]


def sheet(wb, name):
    it = wb[name].iter_rows(values_only=True)
    h = list(next(it))
    return h, [list(r) for r in it if any(v is not None for v in r)]


def clean(v):
    if v is None or (isinstance(v, float) and pd.isna(v)):
        return None
    if isinstance(v, str) and v == "":
        return None
    return v.item() if hasattr(v, "item") else v


def main(src, year, out, prev):
    year = int(year)
    comb = openpyxl.load_workbook(src, read_only=True)
    old = openpyxl.load_workbook(prev, read_only=True)
    wb = openpyxl.Workbook()
    bold = Font(bold=True)

    def add(name, h, rows):
        ws = wb.create_sheet(name); ws.append(h)
        for c in ws[1]: c.font = bold
        for r in rows: ws.append([clean(v) for v in r])
        ws.freeze_panes = "A2"

    ws = wb.active; ws.title = "README"
    for line in [f"Statistik PLN {year}: data per unit untuk Dashboard PraKTIk (sektor Ketenagalistrikan).",
                 "Dibuat otomatis dari PDF Statistik PLN dengan tools/ekstraksi (GitHub Actions: Tambah data PLN dari PDF).",
                 "Tahun data SELALU diambil dari nama file (statistik-pln-TAHUN.xlsx), bukan dari kolom year.",
                 "Sel kosong = data tidak tersedia ('-' di publikasi). Kolom derived = True: nilai dihitung, bukan dipublikasikan.",
                 "kualitas_data: catatan teknis (bahasa Inggris) tentang perubahan definisi/kesalahan sumber yang menyangkut tahun ini.",
                 "Panduan lengkap: PANDUAN-UPDATE-DATA.md di repositori."]:
        ws.append([line])

    for t in TABLES:
        h_old, _ = sheet(old, t)
        h_new, rows = sheet(comb, t)
        idx = {c: i for i, c in enumerate(h_new)}
        missing = [c for c in h_old if c not in idx]
        if missing:
            print(f"warning: {t} has no column(s) {missing}; left empty")
        yi = idx["year"]
        sel = [r for r in rows if r[yi] == year or str(r[yi]) == str(year)]
        add(t, h_old, [[r[idx[c]] if c in idx else None for c in h_old] for r in sel])

    # units: last year's list + units that appear for the first time
    uh, urows = sheet(old, "units")
    known = {r[0] for r in urows}
    nh, nrows = sheet(comb, "units")
    ni = {c: i for i, c in enumerate(nh)}
    added = []
    for r in nrows:
        if r[ni["unit_id"]] not in known:
            urows.append([r[ni[c]] if c in ni else None for c in uh]); added.append(r[ni["unit_id"]])
    add("units", uh, urows)
    add("data_dictionary", *sheet(old, "data_dictionary"))
    ch, _ = sheet(old, "catatan")
    add("catatan", ch, [])
    notes = pd.read_csv(os.path.join(HERE, "data_quality_notes.csv"), dtype=str).fillna("")
    keep = notes[notes.year.apply(lambda s: str(year) in s.split(";") or s.strip().lower() in ("all", ""))]
    add("kualitas_data", ["years" if c == "year" else c for c in notes.columns], keep.values.tolist())
    wb.save(out)
    print(f"wrote {out}; new units: {added}")
    return added


if __name__ == "__main__":
    main(*sys.argv[1:5])
