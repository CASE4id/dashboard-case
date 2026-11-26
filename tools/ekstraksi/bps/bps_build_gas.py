import os as _os
HERE = _os.path.dirname(_os.path.abspath(__file__))
WORK = _os.environ.get("BPS_WORK", "work/bps")
_os.makedirs(WORK, exist_ok=True)
import json, os, shutil, pandas as pd
T = json.load(open(f"{WORK}/gas_tables.json"))
OUT = f"{WORK}/transmission_gas"; shutil.rmtree(OUT, ignore_errors=True); os.makedirs(f"{OUT}/csv")
SRC = "BPS, Statistik Gas 2020–2024 (Survei Tahunan Perusahaan Gas 2024)"
FILES = {"g01": "workers_by_education", "g02": "worker_compensation", "g03": "customers_by_type", "g04": "sales_volume_by_customer",
         "g05": "sales_value_by_customer", "g06": "avg_price_by_customer", "g07": "fuel_lubricant_quantity", "g08": "fuel_lubricant_value",
         "g09": "materials_services_cost", "g10": "output_and_intermediate_cost"}
def flag(tid, y):
    if y == 2024: return "preliminary"
    if tid == "g02" and 2020 <= y <= 2023: return "revised"
    return ""
long, dic, wide_sheets = [], [], {}
for tid, t in T.items():
    recs = []
    for r in t["rows"]:
        key, en, idn, vals = r[:4]; unit = r[4] if len(r) > 4 else t["unit"]
        for y, v in zip(t["years"], vals):
            recs.append(dict(year=y, table_id=tid, category=key, category_label_en=en, category_label_id=idn, value=v, unit=unit, flag=flag(tid, y), derived=False))
    if t["total"]:
        key = "average" if tid == "g06" else "total"
        for y, v in zip(t["years"], t["total"]):
            recs.append(dict(year=y, table_id=tid, category=key, category_label_en=t["total_label"][0], category_label_id=t["total_label"][1],
                             value=v, unit=t["unit"], flag=flag(tid, y), derived=False))
    if tid == "g10":   # gross value added = output - intermediate (derived)
        out = dict(zip(t["years"], t["rows"][0][3])); ic = dict(zip(t["years"], t["rows"][1][3]))
        for y in t["years"]:
            recs.append(dict(year=y, table_id=tid, category="gross_value_added", category_label_en="Gross value added (output − intermediate input)",
                             category_label_id="Nilai tambah bruto (output − biaya antara)", value=round(out[y] - ic[y], 2), unit=t["unit"], flag=flag(tid, y), derived=True))
    df = pd.DataFrame(recs)
    df.drop(columns="table_id").to_csv(f"{OUT}/csv/{tid}_{FILES[tid]}.csv", index=False)
    w = df.pivot_table(index=["category", "category_label_en", "category_label_id", "unit"], columns="year", values="value", aggfunc="first", sort=False).reset_index()
    order = list(dict.fromkeys(df.category)); w["o"] = w.category.map(order.index); w = w.sort_values("o").drop(columns="o")
    wide_sheets[tid] = w
    long += [dict(r, table_name=FILES[tid], table_title_en=t["name_en"]) for r in recs]
    dic.append(dict(table_id=tid, file=f"csv/{tid}_{FILES[tid]}.csv", title_en=t["name_en"], title_id=t["name_id"], unit=t["unit"],
                    years=f"{t['years'][0]}–{t['years'][-1]}", categories="; ".join(dict.fromkeys(df.category)), source=f"{SRC}, Table {int(tid[1:])} (p. {t['page']})", note=t["note"]))
L = pd.DataFrame(long)[["year", "table_id", "table_name", "table_title_en", "category", "category_label_en", "category_label_id", "value", "unit", "flag", "derived"]]
L.to_csv(f"{OUT}/gas_statistics_long.csv", index=False)
D = pd.DataFrame(dic); D.to_csv(f"{OUT}/tables.csv", index=False)
notes = pd.DataFrame([
    dict(table_id="all", issue="Scope: companies that sell gas to customers through a pipeline network (state-owned and private). National totals only; no regional breakdown.", action="—"),
    dict(table_id="all", issue="2024 figures are preliminary (marked x in the source).", action="flag = preliminary"),
    dict(table_id="g02", issue="Source inconsistency: for 2020–2023 (marked r = revised) the four compensation components do not add up to the published totals (e.g. 2020 components sum to 284,745 vs total 259,645). 2019 and 2024 add up.", action="Kept as published; flag = revised. Use the components or the total consistently, not both."),
    dict(table_id="g01;g02", issue="These two tables also include 2019.", action="—"),
    dict(table_id="g06", issue="Average prices are published by BPS directly and are not equal to sales value ÷ volume from g04/g05.", action="Kept as published."),
    dict(table_id="g06;g09;g10", issue="The source marks some rows as revised (r): g06 average, g09 electricity & water, g10 intermediate input. The years concerned are not specified.", action="Noted only."),
    dict(table_id="g07;g08", issue="'…' (not available) is stored as empty. 2020 gas-fuel (BBG) use is far higher than other years (3,499 MMSCF; IDR 454 bn) and drives the 2020 fuel total.", action="Kept as published."),
    dict(table_id="g10", issue="Gross value added is not in the publication.", action="Derived as output − intermediate input; derived = True."),
])
notes.to_csv(f"{OUT}/data_quality_notes.csv", index=False)
json.dump({k: v.to_dict("records") for k, v in wide_sheets.items()}, open(f"{WORK}/gas_wide.json", "w"), default=str)
pd.to_pickle(wide_sheets, f"{WORK}/gas_wide.pkl")
print(L.groupby("table_id").size().to_dict(), len(L))
