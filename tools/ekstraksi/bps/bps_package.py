import os as _os
HERE = _os.path.dirname(_os.path.abspath(__file__))
WORK = _os.environ.get("BPS_WORK", "work/bps")
_os.makedirs(WORK, exist_ok=True)
import os, shutil, json, pandas as pd
from openpyxl.styles import Font, PatternFill, Alignment
from openpyxl.utils import get_column_letter
B = WORK
# ---------------- AEROSPACE ----------------
OUT = f"{B}/aerospace_air_transport"; shutil.rmtree(OUT, ignore_errors=True); os.makedirs(f"{OUT}/csv")
N = pd.read_pickle(f"{B}/air_national.pkl"); A = pd.read_pickle(f"{B}/air_airports.pkl")
apt = A["apt"].drop(columns=["airport_label_full"]); prv = A["prv"]
for df in (apt, prv):
    for col in [c for c in df.columns if c.startswith(("dom_", "intl_"))]:
        df[col] = df[col].astype("Int64")
AIR = {"a01_national_traffic": N["a01"], "a02_major_airports_departures": N["a02"], "a03_airline_production": N["a03"],
       "a04_fleet_by_certificate": N["a04"], "a05_airport_traffic_2024": apt, "a06_province_traffic_2024": prv}
for k, df in AIR.items(): df.to_csv(f"{OUT}/csv/{k}.csv", index=False)
air_tables = pd.DataFrame([
 dict(file="csv/a01_national_traffic.csv", title_en="National air traffic: aircraft, passengers, cargo, baggage, mail — domestic/international, arrivals/departures",
      grain="year × flight_type × direction", years="2020–2024", source_tables="3.1–3.4", page_idea="KPI tiles + 5-year trend lines (passengers, aircraft movements, cargo)"),
 dict(file="csv/a02_major_airports_departures.csv", title_en="Departures (aircraft, passengers) at the five busiest airports vs others",
      grain="year × flight_type × airport", years="2023–2024", source_tables="3.5–3.6", page_idea="Bar chart of top airports; year-on-year change"),
 dict(file="csv/a03_airline_production.csv", title_en="Scheduled airline production: aircraft-km, hours flown, passenger-km, seat-km, load factors, ton-km",
      grain="year × flight_type × indicator", years="2020–2024", source_tables="3.7–3.8", page_idea="Load-factor trend; capacity vs demand (seat-km vs passenger-km)"),
 dict(file="csv/a04_fleet_by_certificate.csv", title_en="Registered civil aircraft by operator certificate (AOC 121, AOC 135, OC 91/AOC 137/PSC 141/FASI)",
      grain="year", years="2020–2024", source_tables="3.9", page_idea="Stacked bar of fleet by operator type"),
 dict(file="csv/a05_airport_traffic_2024.csv", title_en="Traffic at all 238 airports: domestic and international aircraft, passengers (arrival/departure/transit), cargo (kg)",
      grain="airport", years="2024", source_tables="Appendices 6, 7, 9, 11, 12, 14", page_idea="Airport table with search; map once coordinates are added"),
 dict(file="csv/a06_province_traffic_2024.csv", title_en="Traffic by province (38 provinces + national total), same measures as a05",
      grain="province", years="2024", source_tables="Appendices 6, 7, 9, 11, 12, 14 (province subtotals)", page_idea="Choropleth map / province ranking"),
])
air_tables.to_csv(f"{OUT}/tables.csv", index=False)
cols = []
def c(f, col, desc, unit): cols.append(dict(file=f, column=col, description=desc, unit=unit))
for col, d, u in [("year", "Year", ""), ("flight_type", "domestic / international", ""), ("direction", "arrival / departure", ""), ("aircraft", "Aircraft movements", "units"),
                  ("passengers", "Passengers", "persons"), ("cargo_ton", "Cargo", "tonnes"), ("baggage_ton", "Baggage", "tonnes"), ("mail_ton", "Mail/package", "tonnes"), ("source_table", "BPS table number", "")]:
    c("a01", col, d, u)
for col, d, u in [("airport", "Airport (5 busiest), 'Others' or 'Total'", ""), ("airport_role", "major_airport / others / total", ""),
                  ("aircraft_departures", "Departing aircraft", "units"), ("passenger_departures", "Departing passengers", "persons")]:
    c("a02", col, d, u)
for col, d, u in [("indicator", "Production indicator (see indicator_label_en)", ""), ("value", "Value", "see unit"), ("unit", "Unit of the value", ""),
                  ("corrected", "True where a source typo was corrected (see notes)", "")]:
    c("a03", col, d, u)
for col, d in [("aoc_121", "Scheduled/commercial airlines (AOC 121)"), ("aoc_135", "Commuter & charter (AOC 135)"),
               ("oc91_aoc137_psc141_fasi", "General aviation, agricultural, pilot schools, aero sport (OC 91, AOC 137, PSC 141, FASI)"), ("total", "Total registered civil aircraft")]:
    c("a04", col, d, "aircraft")
for col, d, u in [("airport_no", "Airport number in the BPS appendices (stable key within this edition)", ""), ("airport_id", "Key for joins", ""),
                  ("airport_name", "Airport name", ""), ("regency_city", "Regency/city", ""), ("province", "Province (38-province system)", ""),
                  ("dom_aircraft_arrivals / _departures", "Domestic aircraft movements", "units"), ("dom_passengers_arrivals / _departures / _transit", "Domestic passengers", "persons"),
                  ("dom_cargo_kg_unloaded / _loaded", "Domestic cargo", "kg"), ("intl_* (same pattern)", "International traffic (30 airports)", "as above"),
                  ("has_international_traffic", "Airport handled international flights in 2024", "")]:
    c("a05", col, d, u)
c("a06", "row_type", "province / national_total", ""); c("a06", "airports_listed", "Number of airports listed in the province", "airports")
pd.DataFrame(cols).to_csv(f"{OUT}/data_dictionary.csv", index=False)
air_notes = pd.DataFrame([
 dict(file="all", issue="Source: BPS Statistik Transportasi Udara 2024; underlying data from PT Angkasa Pura Indonesia (airport traffic) and Ministry of Transportation / DGCA (airline production, fleet).", action="—"),
 dict(file="a01", issue="Small source inconsistency: 2024 domestic departures are 672,239 aircraft / 63,211,433 passengers in Table 3.2 but 672,234 / 63,211,285 in Table 3.5–3.6 and the airport appendices.", action="Kept as published in each table."),
 dict(file="a03", issue="Source typo: Table 3.7 prints 2020 domestic available seat-km as '4.107' million. The table's own load factor (58.53%) implies 54,104; the printed value lost its leading digit.", action="Stored as 54,107 with corrected = True."),
 dict(file="a03", issue="Units: aircraft-km in thousands; passenger-km, seat-km and ton-km in millions; hours flown in hours. Scheduled airlines only.", action="See unit column."),
 dict(file="a05;a06", issue="Source inconsistency: Papua Barat Daya's published domestic passenger subtotal (585,533 arrivals) is 377,253 higher than the sum of its listed airports (208,280). National totals equal the sum of province subtotals, so the gap is unitemised traffic in the province (likely the main Sorong airport).", action="Kept as published. Province table (a06) carries the published subtotal; airport table (a05) carries the listed airports."),
 dict(file="a05", issue="Airport names are taken from the domestic appendices (consensus across aircraft/passenger/cargo tables). The international appendices list two airports by city ('Palembang', 'Kulonprogo'); they were matched to Sultan Mahmud Badaruddin II and Yogyakarta International Airport.", action="—"),
 dict(file="a05", issue="Empty cells mean '–' (no traffic) in the source. Transit is reported only for passengers.", action="—"),
 dict(file="a05", issue="No coordinates are published. For a map, join airport_name + regency_city to an airport list with coordinates (e.g. IATA/ICAO codes).", action="—"),
 dict(file="all", issue="All appendix tables were checked: airports sum to their province subtotals, and provinces sum to the national totals, which match Tables 3.1–3.4.", action="Only the Papua Barat Daya passenger gap remains (source)."),
])
air_notes.to_csv(f"{OUT}/data_quality_notes.csv", index=False)
# ---------------- workbook helper ----------------
def workbook(path, readme_lines, sheets):
    with pd.ExcelWriter(path, engine="openpyxl") as xw:
        pd.DataFrame({"README": readme_lines}).to_excel(xw, sheet_name="README", index=False)
        for name, df in sheets.items(): df.to_excel(xw, sheet_name=name[:31], index=False)
        for ws in xw.book.worksheets:
            for cell in ws[1]: cell.font = Font(bold=True, color="FFFFFF"); cell.fill = PatternFill("solid", fgColor="1F4E78")
            if ws.title != "README": ws.freeze_panes = "A2"
            for i, col in enumerate(ws.columns, 1):
                m = max(len(str(x.value)) if x.value is not None else 0 for x in col)
                ws.column_dimensions[get_column_letter(i)].width = min(max(9, m + 2), 120 if ws.title == "README" else 42)
            for row in ws.iter_rows(min_row=2):
                for x in row:
                    if isinstance(x.value, float): x.number_format = "#,##0.00"
                    elif isinstance(x.value, int) and not isinstance(x.value, bool) and (x.value > 2100 or x.value < 1900): x.number_format = "#,##0"
README_AIR = open(_os.path.join(HERE, "README_air.md"), encoding="utf-8").read()
open(f"{OUT}/README.md", "w", encoding="utf-8").write(README_AIR)
workbook(f"{OUT}/aerospace_air_transport_2024.xlsx", README_AIR.splitlines(),
         {**{k: v for k, v in AIR.items()}, "tables": air_tables, "data_dictionary": pd.read_csv(f"{OUT}/data_dictionary.csv"), "data_quality_notes": air_notes})
# ---------------- GAS workbook ----------------
G = f"{B}/transmission_gas"; W = pd.read_pickle(f"{B}/gas_wide.pkl")
README_GAS = open(_os.path.join(HERE, "README_gas.md"), encoding="utf-8").read()
open(f"{G}/README.md", "w", encoding="utf-8").write(README_GAS)
names = {f.split("_", 1)[0]: f[:-4] for f in os.listdir(f"{G}/csv")}
sheets = {names[k]: v for k, v in W.items()}
sheets.update({"long": pd.read_csv(f"{G}/gas_statistics_long.csv"), "tables": pd.read_csv(f"{G}/tables.csv"), "data_quality_notes": pd.read_csv(f"{G}/data_quality_notes.csv")})
for k in list(sheets):
    sheets[k].columns = [str(c) for c in sheets[k].columns]
workbook(f"{G}/transmission_gas_2020_2024.xlsx", README_GAS.splitlines(), sheets)
print("ok")
