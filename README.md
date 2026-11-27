# Dashboard PraKTIk

A profile and analysis dashboard for the Directorate of Transmission, Electricity and Aerospace (Direktorat TKKA; TEA in English), Kementerian PPN/Bappenas.
It covers three sectors: **electricity** (PLN, per unit, 2014–2025), **gas transmission** (BPS, national, 2020–2024) and **aerospace / air transport** (BPS, national plus airports and provinces, 2020–2024).
It replaces the earlier ArcGIS dashboard with a static site that needs **no license, no server and no build step**.

- **Staff who update the data:** read **[PANDUAN-UPDATE-DATA.md](PANDUAN-UPDATE-DATA.md)** (in Bahasa Indonesia).
- **Data check page:** `cek-data.html` (recognises the sector from the file name).

## How it works

```
index.html                 Dashboard shell: sector switch, year/unit filters, tabs
cek-data.html              Checks an Excel file in the browser before it is uploaded
data/listrik/              statistik-pln-YYYY.xlsx, one workbook per year (electricity)
data/gas/                  statistik-gas-YYYY.xlsx, one workbook with all years; YYYY = latest year (gas)
data/udara/                statistik-udara-YYYY.xlsx, one workbook with all years; YYYY = latest year (air transport)
assets/js/config.js        Electricity config + indicators, DATA_SCHEMA, SECTORS (gas, udara) and SECTOR_SCHEMA
assets/js/i18n.js          UI text in Bahasa Indonesia and English
assets/js/data.js          Reads the Excel files (read-excel-file): per-year files and single-edition files
assets/js/app.js           Core + electricity views; exposes window.PK for the sector modules
assets/js/sektor-umum.js   Shared helpers for national-level sectors (KPI cards, trend view, notes, CSV)
assets/js/sektor-gas.js    Gas transmission tabs
assets/js/sektor-udara.js  Air transport tabs
assets/vendor/             Bundled libraries, with no CDN dependency
tools/ekstraksi/           PDF extraction toolkit (Statistik PLN, BPS gas/air) + automation; see its README
.github/workflows/         tambah-data-pln.yml: "Tambah data PLN dari PDF" (PDF → data file → pull request)
docs/                      Buku Panduan (PDF guidebook) and its source
data/referensi/            provinsi.xlsx (38 provinces, BPS codes, accepted alternative spellings) and the province-data template
data/provinsi/             province-level datasets + daftar-indikator.xlsx (what the Provinsi tab shows)
```

- A sector's data are loaded only when it is opened. The URL hash keeps the view (`#sector=gas&tab=trend&series=g04.total`, or for electricity `#tab=compare&unit=uid_aceh&year=2025&lang=en`), so a view can be shared as a link.
- **Electricity:** the site looks for `data/listrik/statistik-pln-{year}.xlsx` for years `firstYear` to `lastYear`; missing years produce harmless 404s. The year always comes from the **file name**. Sheets read: `t01 t02 t08 t16 t19 t21 t23 t28 t29 t30 units data_dictionary`, plus optional `catatan` (notes on KPI cards) and `kualitas_data` (data-quality notes, shown in Analisis → Antar tahun and the Data tab). The unit list shows the units that have data in the selected year; `unit_name_reported` keeps the name printed in that year's report.
- **Gas / air transport:** only the file with the highest year in its name is read (older editions can stay as an archive). Gas sheets `g01`–`g10` are wide (one row per category, one column per year); air sheets `a01`–`a06` are long (one row per year/category). Both have `tabel` (titles), `catatan` (notes) and, for air, `kamus` (column labels).
- Indicators with a known break in the series have `trendFrom` in `config.js`; the between-years analysis starts there by default.
- The language choice is remembered in `localStorage`.

## Electricity data from the PDF (automated)

`tools/ekstraksi/` holds the extraction toolkit that produced the 2014–2025 data; it reproduces the dashboard files cell for cell.
The **Tambah data PLN dari PDF** workflow turns a new Statistik PLN PDF into `data/listrik/statistik-pln-<YEAR>.xlsx` and opens a
pull request with a review report (draft when a table needs a person). One-time repository setting: *Settings → Actions → General →
Workflow permissions →* **Read and write permissions** and **Allow GitHub Actions to create and approve pull requests**.
Details: `tools/ekstraksi/README.md`, section 0.

## Province-level data (Provinsi tab)

Simple province data (e.g. villages by electricity status) live in `data/provinsi/`, one tidy workbook per dataset
(sheets `info`, `indikator`, `data` = Tahun | Kode BPS | Provinsi | Indikator | Nilai). `data/provinsi/daftar-indikator.xlsx`
(sheet `daftar`: file | tampilkan | urutan) lists what is shown; `assets/js/tab-provinsi.js` adds a **Provinsi** tab to the
electricity sector only when that list has an entry with `tampilkan = ya` (it is committed empty). The tab shows a ranking per
indicator (order from `makin_tinggi_makin_baik`), an optional 100 % composition (`komposisi = ya`, only for non-overlapping
categories), province details, a trend once two or more years exist, and a table with CSV/Excel download.

`cek-data.html` (`assets/js/cek-provinsi.js`) recognises these files by content, accepts long or wide layouts, checks province names
against `data/referensi/provinsi.xlsx` (alternative spellings, closest-match suggestion), duplicates, missing provinces, text values
and fraction/percent, writes the tidy workbook in the browser (bundled `write-excel-file`), and checks the registry (listed files present).
Staff guide with screenshots: `docs/Panduan-Menambah-Data-Provinsi.pdf` (source in `docs/panduan-provinsi/`).

## Adding a sector

1. Add an entry to `window.SECTORS` (folder, file pattern, sheets, source text) and, for Cek Data, to `window.SECTOR_SCHEMA` in `config.js`.
2. Write `assets/js/sektor-<key>.js` that calls `PK.registerSector(key, { tabs, prepare(raw), years(), render(tab), hash(tab) })`, using the helpers in `sektor-umum.js`, and add its `<script>` tag to `index.html`.
3. Add its texts to `i18n.js` and a section to the guide.

## Analisis tab (electricity)

- **Dua indikator (two indicators):** a scatter chart of any two indicators for all units (or provinces) in the selected year, with national reference lines, an optional trend line with the correlation coefficient (r), optional log scales, and arrows showing how each unit moved since an earlier year.
- **Antar tahun (between years):** a trend line for the selected unit against national, and a ranked chart of the change between two chosen years (percentage points for % indicators, percent change otherwise), followed by the relevant data-quality notes.

## Run locally

```bash
python3 -m http.server 8000
```

Then open http://localhost:8000. Opening `index.html` directly as a file does not work, because browsers block reading files that way.

## Deploy

- **GitHub Pages:** go to Settings → Pages → Source: *Deploy from a branch*, then choose `main` and `/ (root)`.
- **Bappenas server:** copy the whole folder to any web server, such as Apache, Nginx or IIS. Nothing else is required.

## Adding indicators

Add an entry to `INDICATORS` in `config.js`. There are two kinds:
- **A column from a table:** set `table` and `column`.
- **A computed value:** set a `value(db, unitId, year)` function.

An indicator added this way appears automatically in the **Perbandingan** (Compare) ranking and both **Analisis** modes. To also show it as a summary card, add its key to `SUMMARY_CARDS`.
For a computed indicator, also list the columns it reads in `uses` (e.g. `["t01.peak_load_mw"]`, wildcards like `"t21.*_mw"` allowed) so Cek Data can name the affected indicator when a column disappears.

`DATA_SCHEMA` in `config.js` lists the columns that Cek Data requires per sheet (the columns read by the charts and indicators). It is the single place to update when a column is intentionally dropped. New columns need not be listed: Cek Data reports them as notes and they appear in the Data tab.
The staff-facing version of this, with copy-paste templates, is in PANDUAN-UPDATE-DATA.md ("Menambah atau menghapus kolom & indikator").

## Adding the map (future work)

The map was removed because no spatial data is available yet. To add it:
1. Add a province boundary GeoJSON to `data/geo/`, preferably the official boundaries from BIG.
2. Map each feature to a `prov_*` `unit_id`, either through a property on the feature or a small lookup table.
3. Add Leaflet to `assets/vendor/` and render a choropleth on the *Perbandingan* tab, using the indicator already selected there. A placeholder card for this is already in that tab.
4. Set `mapEnabled: true` in `config.js`.

Note that most indicators are reported per PLN unit (UID/UIW), which can span several provinces. Province-level values exist mainly in tables t01, t08, t19 and t21.

## Licenses

- Chart.js: MIT
- read-excel-file: MIT
- write-excel-file: MIT

The license files are in `assets/vendor/`.
