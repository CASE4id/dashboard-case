import os as _os
HERE = _os.path.dirname(_os.path.abspath(__file__))
import pandas as pd, os, sys, shutil
from openpyxl.styles import Font, PatternFill
from openpyxl.utils import get_column_letter
YEARS = sys.argv[2].split(","); SRC = sys.argv[3].split(","); OUT = sys.argv[1]
shutil.rmtree(OUT, ignore_errors=True); os.makedirs(f"{OUT}/csv")
wides = [pd.read_pickle(f"{s}/.wide.pkl") for s in SRC]
longs = [pd.read_csv(f"{s}/pln_statistics_{y}_long.csv") for s, y in zip(SRC, YEARS)]
sys.path.insert(0, HERE); from derive_t02 import derive
for w, L, y in zip(wides, longs, YEARS):
    for df in w.values(): df["derived"] = False
    L["derived"] = False
    t = w["t02"]
    if not (t.unit_id == "indonesia").any():                       # 2022: national row missing in source
        d = derive(t); base = t[t.unit_id == "jawa"].iloc[0].to_dict()
        row = {**{k: None for k in t.columns}, **d, "year": int(y), "row_order": int(t.row_order.max()) + 1, "unit_id": "indonesia",
               "unit_name": "Indonesia", "unit_name_reported": "(derived: Luar Jawa + Jawa)", "row_type": "national_total",
               "parent_unit_id": None, "region": None, "derived": True}
        w["t02"] = pd.concat([t, pd.DataFrame([row])], ignore_index=True)
        dic = pd.read_csv(f"{SRC[0]}/data_dictionary.csv").query("table_id == 't02'").set_index("column")
        add = [dict(year=int(y), table_id="t02", table_name="energy_balance", unit_id="indonesia", unit_name="Indonesia",
                    unit_name_reported="(derived: Luar Jawa + Jawa)", row_type="national_total", parent_unit_id=None, region=None,
                    indicator=k, indicator_label_en=dic.loc[k, "label_en"], indicator_label_id=dic.loc[k, "label_id"], uom=dic.loc[k, "uom"],
                    value=v, derived=True) for k, v in d.items() if v is not None and k in L[L.table_id == "t02"].indicator.unique()]
        longs[YEARS.index(y)] = pd.concat([L, pd.DataFrame(add)], ignore_index=True)
names = {f[:3]: f[:-4] for f in os.listdir(f"{SRC[0]}/csv")}
combined = {}
for tid in wides[0]:
    df = pd.concat([w[tid] for w in wides], ignore_index=True).sort_values(["year", "row_order"], ascending=[False, True])
    combined[tid] = df; df.to_csv(f"{OUT}/csv/{names[tid]}.csv", index=False)
long = pd.concat(longs).sort_values(["year","table_id"], ascending=[False,True], kind="stable")
long.to_csv(f"{OUT}/pln_statistics_long.csv", index=False)
# units with years present
u = pd.concat([pd.read_csv(f"{s}/units.csv").assign(year=int(y)) for s, y in zip(SRC, YEARS)])
units = u.sort_values("year", ascending=False).groupby("unit_id", sort=False).first().reset_index()
units["years_present"] = units.unit_id.map(u.groupby("unit_id").year.apply(lambda s: ";".join(map(str, sorted(s)))))
SUCC = {"pt_indonesia_power": "PT Indonesia Power (to 2022); continued as PLN Indonesia Power, reported by region (Jawabali, Sumatera, Kalimantan, Sulawesi) from 2023",
        "pt_pjb": "PT PJB (to 2022); continued as PLN Nusantara Power, reported by region from 2023",
        "pt_pjb_sulawesi": "PJB Sulawesi (to 2022); see PLN Nusantara Power - Sulawesi from 2023",
        "uikl_kalimantan": "Generation + transmission unit (to 2022); from 2023 reported as UIK Kalimantan (generation) and UIP3B Kalimantan (transmission/dispatch)",
        "uikl_sulawesi": "Generation + transmission unit (to 2022); from 2023 reported as UIK Sulawesi and UIP3B Sulawesi",
        "kit_sumbagut": "UIK Northern Part of Sumatera (to 2022); appears with no values in 2023+, when UIK Sumatera is reported",
        "kit_sumbagsel": "UIK Southern Part of Sumatera (to 2022); appears with no values in 2023+, when UIK Sumatera is reported",
        "uik_jawa_bagian_barat": "To 2022; Java generation units appear as UIK JAMALI from 2024",
        "uik_jawa_bagian_tengah": "To 2022; Java generation units appear as UIK JAMALI from 2024",
        "uik_jawa_bagian_timur_bali_dan_nusa_tenggara": "To 2022; Java generation units appear as UIK JAMALI from 2024",
        "pt_pln_tarakan": "Subsidiary reported in some years only",
        "p3b_jawa_bali": "P3B Jawa Bali (transmission + load dispatch) to 2015; from 2016 split into UIP2B (dispatch) and UIT Jawa Bagian Barat/Tengah/Timur dan Bali (transmission)",
        "uid_jawa_barat_dan_banten": "West Java & Banten distribution to 2015; split into UID Jawa Barat and UID Banten from 2016",
        "uid_jakarta_raya": "Service area included Tangerang until 2017 ('Jakarta Raya & Tangerang')",
        "kit_jawa_bali": "Generation Unit of Java Bali (2014–2017)",
        "p2b_jawa_bagian_barat": "Regional load-dispatch rows shown in 2016–2017 energy tables",
        "p2b_jawa_bagian_tengah": "Regional load-dispatch rows shown in 2016–2017 energy tables",
        "p2b_jawa_bagian_timur_dan_bali": "Regional load-dispatch rows shown in 2016–2017 energy tables"}
units["note"] = units.unit_id.map(SUCC)
units["names_reported"] = units.unit_id.map(long.groupby("unit_id").unit_name_reported.apply(lambda s: " | ".join(sorted(set(map(str, s))))))
units.drop(columns="year").to_csv(f"{OUT}/units.csv", index=False)
# dictionary with availability
d = pd.read_csv(f"{SRC[0]}/data_dictionary.csv")
avail = long.groupby(["table_id","indicator"]).year.apply(lambda s: ";".join(map(str, sorted(s.unique()))))
d["years_available"] = [avail.get((t, c), "") for t, c in zip(d.table_id, d.column)]
d.to_csv(f"{OUT}/data_dictionary.csv", index=False)
notes = pd.read_csv(_os.path.join(HERE, "data_quality_notes.csv")); notes.to_csv(f"{OUT}/data_quality_notes.csv", index=False)
shutil.copy(_os.path.join(HERE, "README_output.md"), f"{OUT}/README.md")
with pd.ExcelWriter(f"{OUT}/pln_statistics_{min(YEARS)}_{max(YEARS)}.xlsx", engine="openpyxl") as xw:
    pd.DataFrame({"README": open(f"{OUT}/README.md", encoding="utf-8").read().splitlines()}).to_excel(xw, sheet_name="README", index=False)
    for tid, df in combined.items(): df.to_excel(xw, sheet_name=tid, index=False)
    long.to_excel(xw, sheet_name="long", index=False)
    for n, df in [("units", pd.read_csv(f"{OUT}/units.csv")), ("data_dictionary", d), ("data_quality_notes", notes)]:
        df.to_excel(xw, sheet_name=n, index=False)
    for ws in xw.book.worksheets:
        for c in ws[1]: c.font = Font(bold=True, color="FFFFFF"); c.fill = PatternFill("solid", fgColor="1F4E78")
        if ws.title != "README": ws.freeze_panes = "B2"
        for i, col in enumerate(ws.columns, 1):
            m = max(len(str(c.value)) if c.value is not None else 0 for c in col)
            ws.column_dimensions[get_column_letter(i)].width = min(max(10, m + 2), 140 if ws.title == "README" else 45)
        if ws.title.startswith("t"):
            for row in ws.iter_rows(min_row=2):
                for c in row[8:]:
                    if isinstance(c.value, float): c.number_format = "#,##0.00"
print({k: len(v) for k, v in combined.items()}, len(long), len(units))
