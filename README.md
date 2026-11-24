# Dashboard PraKTIk

A profile and analysis dashboard for Indonesian electricity, built for the Directorate of Transmission, Electricity and Aerospace (Direktorat TKKA; TEA in English), Kementerian PPN/Bappenas.
It replaces the earlier ArcGIS dashboard with a static site that needs **no license, no server and no build step**.

- **Staff who update the data:** read **[PANDUAN-UPDATE-DATA.md](PANDUAN-UPDATE-DATA.md)** (in Bahasa Indonesia).
- **Data check page:** `cek-data.html`

## How it works

```
index.html            Dashboard (5 tabs: Ringkasan, Pembangkitan, Jaringan & Susut, Perbandingan, Data & Unduh)
cek-data.html         Checks an Excel file in the browser before it is uploaded
data/                 statistik-pln-YYYY.xlsx, one workbook per year (the ONLY thing changed each year)
assets/js/config.js   Indicators, plant types (renewable vs fossil), source text, contact
assets/js/i18n.js     UI text in Bahasa Indonesia and English
assets/js/data.js     Reads the Excel files into memory (read-excel-file)
assets/js/app.js      Renders the views (Chart.js)
assets/vendor/        Bundled libraries, with no CDN dependency
```

- On load, the site looks for `data/statistik-pln-{year}.xlsx` for years `firstYear` to `lastYear` in `config.js`. Missing years produce harmless 404s.
- The year always comes from the **file name**.
- The sheets it reads are `t01 t02 t08 t16 t19 t21 t23 t28 t29 t30 units data_dictionary`, plus an optional `catatan` sheet. Other sheets are ignored.
- Column labels in the Data tab come from the `data_dictionary` sheet, so new columns describe themselves.
- The URL hash keeps the current view (`#tab=compare&unit=uid_aceh&year=2025&lang=en`), so a view can be shared as a link.
- The language choice is remembered in `localStorage`.

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

An indicator added this way appears automatically in the **Perbandingan** (Compare) ranking. To also show it as a summary card, add its key to `SUMMARY_CARDS`.

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

The license files are in `assets/vendor/`.
