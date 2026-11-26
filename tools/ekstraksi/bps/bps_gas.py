import os as _os
HERE = _os.path.dirname(_os.path.abspath(__file__))
WORK = _os.environ.get("BPS_WORK", "work/bps")
_os.makedirs(WORK, exist_ok=True)
"""BPS Statistik Gas 2020-2024 (Survei Tahunan Perusahaan Gas) - transcribed from the publication's text layer
(watermark-free values), then checked against each table's published total."""
import pandas as pd, json

Y5 = [2020, 2021, 2022, 2023, 2024]; Y6 = [2019] + Y5
T = {}
def tab(tid, name_en, name_id, unit, years, rows, total=None, total_label=("Total", "Jumlah"), page=None, note=""):
    T[tid] = dict(name_en=name_en, name_id=name_id, unit=unit, years=years, rows=rows, total=total, total_label=total_label, page=page, note=note)

tab("g01", "Gas company workers by education level", "Banyaknya pekerja perusahaan gas menurut tingkat pendidikan", "persons", Y6, [
    ("postgraduate", "Postgraduate (S2/S3)", "Pascasarjana (S2/S3)", [252, 267, 156, 148, 157, 122]),
    ("graduate_diploma", "Graduate and diploma (S1/DI–DIV)", "Sarjana dan diploma (S1/DI/II/III/IV)", [1127, 1175, 1021, 1388, 1382, 1557]),
    ("senior_high_or_lower", "Senior high school or lower", "SLTA ke bawah", [859, 908, 539, 626, 640, 492])],
    total=[2238, 2350, 1716, 2162, 2179, 2171], page=15)
tab("g02", "Worker compensation by type", "Nilai balas jasa pekerja menurut jenis balas jasa", "million IDR", Y6, [
    ("wages_salaries", "Wages/salaries", "Upah/gaji", [142568, 199154, 165681, 232777, 257469, 155326]),
    ("overtime_bonus", "Overtime, gifts, bonuses, etc.", "Lembur, hadiah, bonus, dsb", [21166, 26087, 33007, 28715, 34172, 35591]),
    ("pension_social_security", "Pension, social security, insurance, etc.", "Iuran dana pensiun, tunjangan sosial, asuransi, dsb", [14156, 18488, 18868, 27115, 23566, 15497]),
    ("others", "Others", "Lainnya", [63098, 41016, 26271, 25097, 21443, 57830])],
    total=[240989, 259645, 194413, 251011, 259101, 264243], page=16)
CUST = [("household", "Household", "Rumah tangga"), ("commercial", "Commercial", "Komersial"), ("industrial", "Industrial", "Industri"),
        ("power_plant", "Power plant", "Pembangkit listrik"), ("cng_station", "Fuel gas filling station (SPBG)", "SPBG")]
def cust(vals): return [(k, e, i, v) for (k, e, i), v in zip(CUST, vals)]
tab("g03", "Number of gas customers by type", "Banyaknya pelanggan menurut jenis pelanggan", "customers", Y5, cust([
    [152189, 384413, 502394, 503604, 436802], [1360, 4058, 5891, 4746, 4478], [2337, 3915, 4063, 5041, 2957],
    [26, 22, 22, 28, 26], [7, 17, 18, 24, 11]]), total=[155919, 392425, 512388, 513443, 444274], page=17)
tab("g04", "Volume of gas sold by customer type", "Volume penjualan gas menurut jenis pelanggan", "MMSCF", Y5, cust([
    [1122.94, 1567.42, 9655.62, 8415.12, 9685.70], [5262.19, 17098.29, 13071.18, 11787.58, 25685.68],
    [253192.19, 230176.54, 239159.52, 212952.55, 189075.93], [73117.86, 93312.44, 101418.33, 140697.42, 141239.12],
    [619.77, 8618.55, 5601.72, 5327.56, 3244.44]]), total=[333314.96, 350773.24, 368906.39, 379180.22, 368930.87], page=18)
tab("g05", "Value of gas sold by customer type", "Nilai penjualan gas menurut jenis pelanggan", "million IDR", Y5, cust([
    [169340, 208861, 1366269, 1042344, 1274423], [698961, 2431005, 1712357, 1499722, 4063946],
    [33793976, 29695535, 30388127, 26281696, 25816919], [8876358, 10203615, 11047947, 14534916, 19310739],
    [72976, 958794, 726670, 660737, 447019]]), total=[43611611, 43497809, 45241369, 44019415, 50913047], page=19)
tab("g06", "Average gas sales price per MSCF by customer type", "Rata-rata harga penjualan gas per MSCF menurut jenis pelanggan", "IDR per MSCF", Y5, cust([
    [128542, 133251, 141500, 123866, 131578], [132827, 142178, 131002, 127229, 158218], [133472, 129012, 127062, 123416, 136543],
    [121398, 109349, 108934, 103306, 136724], [117746, 111248, 129723, 124022, 137780]]),
    total=[130842, 125007, 127644, 120368, 140169], total_label=("Average", "Rata-rata"), page=20,
    note="BPS publishes these averages directly; they are not value ÷ volume of tables g04/g05 (company-weighted survey averages).")
tab("g07", "Fuel and lubricant consumed by gas companies (quantity)", "Banyaknya pemakaian bahan bakar dan pelumas oleh perusahaan gas", "see unit column", Y5, [
    ("gasoline", "Gasoline", "Bensin", [1273.16, 2057.81, 2755.73, 1868.53, 2517.03], "kilolitre"),
    ("hsd_diesel", "High-speed diesel (HSD/solar)", "Solar", [266.73, 962.58, 990.10, 907.76, 578.54], "kilolitre"),
    ("ido", "Industrial diesel oil (IDO)", "Minyak diesel", [None] * 5, "kilolitre"),
    ("kerosene", "Kerosene", "Minyak tanah", [None] * 5, "kilolitre"),
    ("lubricant", "Lubricant", "Pelumas", [53.81, 75.62, 59.87, 57.87, 51.14], "kilolitre"),
    ("gas_fuel", "Gas fuel (BBG)", "BBG", [3498.97, 0.55, 0.04, 0.18, 0.07], "MMSCF")], page=21,
    note="'…' in the source (data not available) is stored as empty.")
tab("g08", "Value of fuel and lubricant consumed by gas companies", "Nilai pemakaian bahan bakar dan pelumas oleh perusahaan gas", "million IDR", Y5, [
    ("gasoline", "Gasoline", "Bensin", [11122, 18346, 26004, 24259, 31608]),
    ("hsd_diesel", "High-speed diesel (HSD/solar)", "Solar", [2906, 10240, 10957, 10069, 6810]),
    ("ido", "Industrial diesel oil (IDO)", "Minyak diesel", [None] * 5),
    ("kerosene", "Kerosene", "Minyak tanah", [None] * 5),
    ("lubricant", "Lubricant", "Pelumas", [1317, 2581, 2806, 2910, 2574]),
    ("gas_fuel", "Gas fuel (BBG)", "BBG", [454198, 42, 3, 6, 3]),
    ("others", "Others", "Lainnya", [None] * 5)], total=[469544, 31209, 39770, 37244, 40995], page=22)
tab("g09", "Cost of materials and services of gas companies", "Nilai pemakaian bahan dan jasa perusahaan gas", "million IDR", Y5, [
    ("raw_materials", "A. Raw materials (gas purchased)", "A. Bahan baku", [31159440, 30890813, 32998657, 33685386, 37789283]),
    ("operating_expenses", "B. Operating expenses (sum of B1–B6)", "B. Beban usaha", [4270179, 2106117, 1917282, 1767024, 2298703]),
    ("fuel_lubricant", "B1. Fuel and lubricant", "B1. Bahan bakar dan pelumas", [469544, 31209, 39770, 37244, 40995]),
    ("electricity_water", "B2. Electricity and water", "B2. Listrik dan air", [116142, 480149, 319665, 284680, 324096]),
    ("office_supplies", "B3. Office supplies", "B3. ATK", [3087, 62688, 50772, 54910, 45314]),
    ("tools_maintenance", "B4. Tools, spare parts, repair and maintenance", "B4. Peralatan, suku cadang, perbaikan dan pemeliharaan", [632844, 23373, 77782, 72624, 255224]),
    ("rent", "B5. Rent of buildings, machines and equipment", "B5. Sewa bangunan dan mesin", [325300, 298845, 248069, 253625, 339273]),
    ("others", "B6. Others", "B6. Lain-lain", [2723262, 1209854, 1181224, 1063942, 1293800])],
    total=[35429619, 32996930, 34915939, 35452410, 40087986], page=23)
tab("g10", "Output value and intermediate cost of gas companies", "Nilai output dan biaya antara perusahaan gas", "million IDR", Y5, [
    ("output_value", "Value of output", "Nilai output", [45861876, 44099189, 45722446, 44625197, 51767158]),
    ("intermediate_cost", "Intermediate input", "Biaya antara", [35429619, 32996930, 34915939, 35452410, 40087986])], page=24)

# ---------------- validation ----------------
problems = []
for tid, t in T.items():
    if t["total"] is None or tid == "g06":
        continue
    rows = [r for r in t["rows"] if not (tid == "g09" and r[0] not in ("raw_materials", "operating_expenses"))]
    for i, y in enumerate(t["years"]):
        s = round(sum((r[3][i] or 0) for r in rows), 2)
        if abs(s - t["total"][i]) > 1.01:
            problems.append((tid, y, s, t["total"][i]))
# g09: B = B1..B6
b = [r for r in T["g09"]["rows"] if r[2].startswith("B") and r[0] != "operating_expenses"]
opx = [r for r in T["g09"]["rows"] if r[0] == "operating_expenses"][0][3]
for i, y in enumerate(Y5):
    s = sum(r[3][i] for r in b)
    if abs(s - opx[i]) > 1.01: problems.append(("g09-B", y, s, opx[i]))
# cross-table: g08 total = g09 B1 ; g09 total = g10 intermediate
for i, y in enumerate(Y5):
    if T["g08"]["total"][i] != T["g09"]["rows"][2][3][i]: problems.append(("g08 vs g09", y))
    if T["g09"]["total"][i] != T["g10"]["rows"][1][3][i]: problems.append(("g09 vs g10", y))
print("validation problems:", problems)
json.dump(T, open(f"{WORK}/gas_tables.json", "w"), indent=1)
