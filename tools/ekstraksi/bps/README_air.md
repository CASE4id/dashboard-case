# Aerospace (air transport) — data extract for the dashboard draft

Source: BPS, *Statistik Transportasi Udara 2024*. Underlying data come from PT Angkasa Pura Indonesia (airport traffic) and the Ministry of Transportation, DGCA (airline production, fleet).

## Files

| File | Content | Years | Suggested page element |
|---|---|---|---|
| `csv/a01_national_traffic.csv` | Aircraft, passengers, cargo, baggage, mail — domestic/international × arrival/departure | 2020–2024 | KPI tiles + trend lines (COVID dip and recovery) |
| `csv/a03_airline_production.csv` | Scheduled airlines: aircraft-km, hours flown, passenger-km, seat-km, load factors, ton-km | 2020–2024 | Load-factor trend; capacity vs demand |
| `csv/a04_fleet_by_certificate.csv` | Registered civil aircraft by operator certificate | 2020–2024 | Stacked bar |
| `csv/a02_major_airports_departures.csv` | Departures at the 5 busiest airports vs others | 2023–2024 | Top-airports bar chart |
| `csv/a06_province_traffic_2024.csv` | Traffic by province (38 provinces + national) | 2024 | Choropleth map / ranking |
| `csv/a05_airport_traffic_2024.csv` | Traffic at all 238 airports (30 with international traffic) | 2024 | Searchable airport table; map once coordinates are added |
| `tables.csv`, `data_dictionary.csv` | Table list and column definitions | — | — |
| `data_quality_notes.csv` | Source inconsistencies and how they were handled | — | Read before charting |
| `aerospace_air_transport_2024.xlsx` | Same data as a workbook | — | For review |

## Conventions (same as the electricity package)

- UTF-8, comma-delimited, `.` decimal point, no thousand separators. Empty cells mean `–` (none) in the source.
- Cargo is in **tonnes** in a01 but in **kg** in a05/a06, as in the source. Divide by 1,000 to compare.
- a05/a06 use the 38-province system (including the new Papua provinces).
- `airport_id` / `airport_no` follow the numbering of the BPS appendices (2024 edition).

## Validation

Every airport table was checked: airports sum to their province subtotals, provinces sum to the national total, and the national totals match Tables 3.1–3.4. Table 3.5–3.6 airport rows sum to their totals, and both load factors were recomputed from passenger-km/seat-km and ton-km. The only discrepancies are in the source and are listed in `data_quality_notes.csv`. One typo was corrected (2020 domestic seat-km).
