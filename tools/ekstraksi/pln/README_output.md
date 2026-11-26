# PLN Statistics 2014–2025 — data extract (backend-ready)

Sources: the annual *Statistik PLN* reports for 2014–2025 (2014–2022 English editions; 2023 Indonesian; 2024 bilingual; 2025 curated extract). 2014 is the first edition.
Ten tables are extracted per year at unit/province level. Every table file stacks all years with a `year` column. Rows are sorted newest year first, then in the PDF's order.

## Files

| File | What it is |
|---|---|
| `csv/t01_power_balance.csv` | Table 1 — Installed capacity, derated capacity, peak load (MW) |
| `csv/t02_energy_balance.csv` | Table 2 — Energy balance (GWh / %) |
| `csv/t08_avg_energy_sold_per_customer.csv` | Table 8 — Average energy sold per customer by type (kWh) |
| `csv/t16_saidi_saifi.csv` | Table 16 — SAIDI (hours/customer), SAIFI (times/customer) |
| `csv/t19_electrification_ratio.csv` | Table 19 — Population, households, household customers, electrification ratio, kWh/capita |
| `csv/t21_installed_capacity_by_plant_type.csv` | Table 21 — Installed capacity by plant type, leased, IPP (MW) |
| `csv/t23_energy_production_by_plant_type.csv` | Table 23 — Energy production by plant type: own, leased, purchased (GWh) |
| `csv/t28_transmission_line_length.csv` | Table 28 — Transmission line length by voltage (kms) |
| `csv/t29_distribution_line_length.csv` | Table 29 — Distribution line length MV/LV (kms) |
| `csv/t30_substation_transformers.csv` | Table 30 — Substation transformers: units & MVA by voltage |
| `pln_statistics_long.csv` | **All tables and years in one tidy/long file** (one row per year × unit × indicator). Easiest to load into a DB. |
| `units.csv` | Master list of units: ID, current name, type, parent, region, years present, every name used in the reports, succession notes |
| `data_dictionary.csv` | Every column: English + Indonesian label, unit of measure, `years_available` |
| `data_quality_notes.csv` | **Read before charting trends.** Source-PDF errors, scope/definition changes between years, derived values, renamed units |
| `pln_statistics_2014_2025.xlsx` | Same content as one workbook, for viewing |

## Conventions

- UTF-8, comma-delimited, `snake_case` headers, `.` as decimal point, no thousand separators. The reports mix English (2,328.60) and Indonesian (2.328,60) number formats; all values are normalised.
- Cells shown as `-` in the PDF are **empty (null)**. Negative values (brackets or minus) are negative numbers.
- The schema is the same for every year. Columns a report doesn't publish are empty for that year (see `years_available`).
- `unit_id` is stable across years. Units were renamed many times (e.g. "Region of Aceh" in 2014–18, "UIW Aceh" in 2019–22, "UID Aceh" from 2023). Each distribution area is mapped to one ID using its 2025 name, and `unit_name_reported` keeps the name exactly as printed. Units with no clear 1:1 successor keep their own ID, explained in `units.csv` → `note`.
- `row_type` — **use it to avoid double counting**:
  - Units: `distribution_unit`, `regional_unit`, `transmission_dispatch_unit`, `transmission_unit`, `generation_unit`, `generation_transmission_unit` (UIKL, to 2022), `generation_subsidiary`, `subsidiary`, `construction_unit`, `generation_projects`
  - `province` — breakdown of its parent unit (already included in the parent). IDs start with `prov_`.
  - `project_component` — breakdown of the Generation Project row (IDs start with `proj_`, parent `proyek_pembangkitan`). These are **not** the regional units of the same name.
  - `regional_total` (Luar Jawa / Jawa), `national_total` (Indonesia)
- `derived` = True marks values computed rather than published. Currently that's only the 2022 Indonesia row of Table 2, which is missing from that report.
- `households_thousand` and `population_thousand` are in thousands.

## Before you chart national trends

Some national series have breaks caused by changes in how PLN reports, not by real change. All are explained in `data_quality_notes.csv`. The main ones:
- **Installed capacity (Table 1)** covers PLN-owned plants only in 2014–2015, and all ownership types from 2016. Use `t21 total_mw` for a consistent 12-year capacity series.
- **SAIDI/SAIFI** jump in 2016 because of a change in how PLN counts interruptions. Start reliability trends in 2016.
- **Peak load** spikes in 2016 (anomalous Java-Bali figure) and jumps in 2023 (Java peak becomes a sum of units' peaks). Use Luar Jawa for trends.
- **Distribution line lengths** fluctuate in 2014–2018 (likely recounts).
- **Units that were split:** P3B Jawa Bali (to 2015) became UIP2B plus the UITs, and West Java & Banten distribution (to 2015) became two units. See `units.csv` → `note`.
- **Transmission length** 2024 includes duplicated Kalimantan/Sulawesi lines (comparable value is about 73,116 kms).
- **Substation MVA** includes UIP3B Kalimantan/Sulawesi only in 2023–2024.
- **Electrification ratio** 2018 uses an older household base, so it isn't comparable with later years.
- **Plant-type detail** grows over time: mini/micro hydro are separate from 2021, gas engine from 2019 (2018 in Table 23), and biomass from 2019.

## Validation performed

For every year, row totals (plant types → subtotal → total; voltages → total) and column totals (units → Luar Jawa / Jawa) were checked against the published figures. Table 1 installed capacity was matched against the Table 21 total for every unit. National totals were then compared across all twelve years to catch scope and definition changes. Every remaining discrepancy is an error or inconsistency in the source PDF, and each one is listed in `data_quality_notes.csv`.

## Adding another year

Tables are located by title. Each year needs its page numbers, any column-layout differences from the standard schema, and mappings for any new unit names. The reports use at least four number formats and two shifted-font encodings, and all of them are handled.
