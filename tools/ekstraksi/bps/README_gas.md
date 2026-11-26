# Transmission (gas) — data extract for the dashboard draft

Source: BPS, *Statistik Gas 2020–2024* (Survei Tahunan Perusahaan Gas 2024). National figures for companies that sell gas to customers through a pipeline network.
Years: 2020–2024 (tables g01–g02 also include 2019). 2024 figures are preliminary.

## Files

| File | Content | Suggested page element |
|---|---|---|
| `csv/g03_customers_by_type.csv` | Number of customers: household, commercial, industrial, power plant, CNG station (SPBG) | KPI tile (total customers) + stacked bar by type |
| `csv/g04_sales_volume_by_customer.csv` | Volume of gas sold by customer type (MMSCF) | Stacked area / bar by customer type |
| `csv/g05_sales_value_by_customer.csv` | Value of gas sold by customer type (million IDR) | Trend line or bar |
| `csv/g06_avg_price_by_customer.csv` | Average sales price per MSCF by customer type (IDR) | Multi-line price chart |
| `csv/g10_output_and_intermediate_cost.csv` | Output value, intermediate cost, and derived gross value added (million IDR) | KPI tile + trend |
| `csv/g09_materials_services_cost.csv` | Cost structure: raw materials (gas purchased) and operating expenses by type | Cost breakdown (treemap / bar) |
| `csv/g01_workers_by_education.csv` | Workers by education level (persons) | Small bar / donut |
| `csv/g02_worker_compensation.csv` | Worker compensation by type (million IDR) | Supporting table |
| `csv/g07_fuel_lubricant_quantity.csv`, `csv/g08_fuel_lubricant_value.csv` | Fuel and lubricant used by gas companies | Supporting table |
| `gas_statistics_long.csv` | All tables in one tidy file (one row per year × table × category) | Easiest to load into a database |
| `tables.csv` | Table list with titles (EN/ID), units, years and source page | — |
| `data_quality_notes.csv` | Source inconsistencies and how they were handled | Read before charting |
| `transmission_gas_2020_2024.xlsx` | Same data as a workbook (wide sheets: categories × years) | For review |

## Conventions (same as the electricity package)

- UTF-8, comma-delimited, `.` decimal point, no thousand separators. `…` (not available) in the source is stored as empty.
- Each table CSV is tidy: `year, category, category_label_en, category_label_id, value, unit, flag, derived`.
- Totals (and the average in g06) are rows with `category = total` / `average`. Leave them out when you sum categories.
- `flag`: `preliminary` (2024) or `revised` (g02, 2020–2023), as marked in the source.
- `derived = True` marks values computed rather than published (only gross value added in g10).

## Validation

All category sums were checked against the published totals. Fuel value (g08) was checked against the fuel line in g09, and total costs (g09) against intermediate input (g10). Everything matches except g02 2020–2023, which is inconsistent in the source (see notes).
