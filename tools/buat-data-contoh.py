"""Membuat DATA CONTOH (dummy) untuk mencoba analisis antar tahun.

Mengambil data/statistik-pln-2025.xlsx lalu membuat versi tahun-tahun sebelumnya
dengan tren acak yang masuk akal. Hasilnya di folder data-contoh/ dan HANYA
dipakai jika situs dibuka dengan ?demo=1. Angka ini BUKAN data resmi.

Pemakaian:  python3 tools/buat-data-contoh.py
"""
import hashlib, random, shutil
from pathlib import Path
import openpyxl

ROOT = Path(__file__).resolve().parent.parent
SRC_YEAR = 2025
YEARS = [2021, 2022, 2023, 2024]
SRC = ROOT / "data" / f"statistik-pln-{SRC_YEAR}.xlsx"
OUT = ROOT / "data-contoh"
ID_COLS = {"year", "row_order", "unit_id", "unit_name", "row_type", "parent_unit_id", "region"}


def rng(*keys):
    return random.Random(int(hashlib.md5("|".join(map(str, keys)).encode()).hexdigest()[:12], 16))


def unit_growth(unit):
    return rng("growth", unit).uniform(0.02, 0.08)


def scale(col, v, unit, year):
    n = SRC_YEAR - year
    r = rng(col, unit, year)
    noise = lambda pct: 1 + r.uniform(-pct, pct)
    if col == "electrification_ratio_pct":
        return None  # dihitung terpisah agar konsisten dengan t19
    if "losses" in col and col.endswith("_pct") or col.startswith("energy_losses") and col.endswith("_pct"):
        return v * (1 + 0.04 * n) * noise(0.04)
    if col.endswith("_pct"):
        return min(100, v * noise(0.03))
    if col.startswith(("saidi", "saifi")):
        return v * (1 + 0.07 * n) * noise(0.18)
    g = unit_growth(unit)
    if "solar" in col or "wind" in col:
        g += 0.18
    if col == "households":
        g = 0.015
    if col.endswith("_kwh") and not col.endswith("gwh"):  # kWh per pelanggan (t08)
        g = g / 2
    return v / (1 + g) ** n * noise(0.02)


def electrification(er, unit, year):
    n = SRC_YEAR - year
    step = rng("er", unit).uniform(1.2, 3.0) if er < 95 else rng("er", unit).uniform(0.05, 0.6)
    return max(er * 0.6, min(100.0, er - step * n + rng("ern", unit, year).uniform(-0.15, 0.15)))


def make(year):
    wb = openpyxl.load_workbook(SRC)
    for ws in wb.worksheets:
        name = ws.title
        if name == "README":
            ws.insert_rows(1)
            ws["A1"] = f"DATA CONTOH (DUMMY) TAHUN {year}: BUKAN DATA RESMI. Dibuat oleh tools/buat-data-contoh.py"
            continue
        if name == "catatan":
            ws.delete_rows(2, ws.max_row)
            continue
        if not name.startswith("t"):
            continue
        hdr = [c.value for c in ws[1]]
        for row in ws.iter_rows(min_row=2):
            vals = dict(zip(hdr, (c.value for c in row)))
            unit = vals.get("unit_id")
            if not unit:
                continue
            for col, cell in zip(hdr, row):
                v = cell.value
                if col == "year":
                    cell.value = year
                elif col in ID_COLS or not isinstance(v, (int, float)) or v == 0:
                    continue
                elif name == "t19" and col == "electrification_ratio_pct":
                    cell.value = round(electrification(v, unit, year), 2)
                else:
                    nv = scale(col, v, unit, year)
                    if nv is not None:
                        cell.value = round(nv) if isinstance(v, int) else round(nv, 2)
        if name == "t19":  # pelanggan RT = rumah tangga (ribu) × 1000 × rasio elektrifikasi
            ix = {h: i for i, h in enumerate(hdr)}
            for row in ws.iter_rows(min_row=2):
                hh, er = row[ix["households"]].value, row[ix["electrification_ratio_pct"]].value
                if isinstance(hh, (int, float)) and isinstance(er, (int, float)):
                    row[ix["household_customers"]].value = round(hh * 1000 * er / 100)
    wb.save(OUT / f"statistik-pln-{year}.xlsx")


if __name__ == "__main__":
    OUT.mkdir(exist_ok=True)
    shutil.copy(SRC, OUT / SRC.name)
    for y in YEARS:
        make(y)
    print("Selesai:", sorted(p.name for p in OUT.glob("*.xlsx")))
