/* =====================================================================
 * KONFIGURASI DASHBOARD / DASHBOARD CONFIGURATION
 * ---------------------------------------------------------------------
 * Untuk memperbarui data TAHUNAN, Anda TIDAK perlu mengubah file ini.
 * Cukup unggah file Excel baru ke folder /data (lihat PANDUAN-UPDATE-DATA.md).
 *
 * Ubah file ini hanya jika ingin mengganti teks sumber, kontak,
 * atau rentang tahun yang dicari.
 * ===================================================================== */

window.DASHBOARD_CONFIG = {
  /* Nama file data per tahun. {year} diganti otomatis, mis. statistik-pln-2025.xlsx */
  dataFilePattern: "data/statistik-pln-{year}.xlsx",

  /* Rentang tahun yang dicari di folder /data. File yang tidak ada akan dilewati. */
  firstYear: 2020,
  lastYear: new Date().getFullYear() + 1,

  /* Sheet yang dibaca dari file Excel (sheet lain, mis. README, diabaikan). */
  sheets: ["t01", "t02", "t08", "t16", "t19", "t21", "t23", "t28", "t29", "t30", "units", "data_dictionary"],
  optionalSheets: ["catatan"],

  source: {
    id: "Statistik PLN (PT PLN (Persero)), diolah oleh Direktorat Transmisi, Ketenagalistrikan, Kedirgantaraan, dan Antariksa, Kementerian PPN/Bappenas.",
    en: "PLN Statistics (PT PLN (Persero)), processed by the Directorate of Transmission, Electricity and Aerospace, Ministry of National Development Planning/Bappenas.",
  },
  contact: {
    email: "dit.tkka@bappenas.go.id",
    instagram: "dit.tkka_bappenas",
  },

  /* Tautan kecil di footer untuk staf yang memperbarui data. */
  staffLinks: {
    guide: "https://github.com/CASE4id/dashboard-case/blob/main/PANDUAN-UPDATE-DATA.md",
    checker: "cek-data.html",
  },

  /* Fitur peta: belum aktif karena data spasial belum tersedia.
     Lihat README.md bagian "Menambahkan peta" untuk mengaktifkannya. */
  mapEnabled: false,
};

/* ---------------------------------------------------------------------
 * Definisi jenis pembangkit (kolom tabel t21 & t23).
 * ebt: true = Energi Baru Terbarukan, false = fosil.
 * ------------------------------------------------------------------- */
window.PLANT_TYPES = [
  { key: "hydro",            id: "PLTA",        en: "Hydro",          ebt: true  },
  { key: "mini_hydro",       id: "PLTM",        en: "Mini hydro",     ebt: true  },
  { key: "micro_hydro",      id: "PLTMH",       en: "Micro hydro",    ebt: true  },
  { key: "geothermal",       id: "PLTP",        en: "Geothermal",     ebt: true  },
  { key: "solar",            id: "PLTS",        en: "Solar",          ebt: true  },
  { key: "wind",             id: "PLTB",        en: "Wind",           ebt: true  },
  { key: "biomass",          id: "PLTBm",       en: "Biomass",        ebt: true  },
  { key: "steam",            id: "PLTU",        en: "Steam (coal)",   ebt: false },
  { key: "combined_cycle",   id: "PLTGU",       en: "Combined cycle", ebt: false },
  { key: "gas",              id: "PLTG",        en: "Gas turbine",    ebt: false },
  { key: "gas_engine",       id: "PLTMG",       en: "Gas engine",     ebt: false },
  { key: "diesel",           id: "PLTD",        en: "Diesel",         ebt: false },
];

/* ---------------------------------------------------------------------
 * Indikator utama (kartu KPI & tab Perbandingan).
 * better: "high" = makin tinggi makin baik, "low" = makin rendah makin baik,
 *         null = netral (tidak diberi warna baik/buruk).
 * value(db, unitId, year) mengembalikan angka atau null.
 * ------------------------------------------------------------------- */
window.INDICATORS = [
  {
    key: "electrification_ratio", table: "t19", column: "electrification_ratio_pct",
    id: "Rasio Elektrifikasi", en: "Electrification Ratio", unit: "%", decimals: 2, better: "high",
    note: { id: "Tidak termasuk pelanggan non-PLN.", en: "Excludes non-PLN customers." },
  },
  {
    key: "saidi", table: "t16", column: "saidi_hours_per_customer",
    id: "SAIDI", en: "SAIDI", unit: { id: "jam/pelanggan", en: "hours/customer" }, decimals: 2, better: "low",
    note: { id: "Rata-rata lama padam per pelanggan dalam setahun.", en: "Average outage duration per customer per year." },
  },
  {
    key: "saifi", table: "t16", column: "saifi_times_per_customer",
    id: "SAIFI", en: "SAIFI", unit: { id: "kali/pelanggan", en: "times/customer" }, decimals: 2, better: "low",
    note: { id: "Rata-rata frekuensi padam per pelanggan dalam setahun.", en: "Average outage frequency per customer per year." },
  },
  {
    key: "distribution_losses", table: "t02", column: "distribution_losses_pct",
    id: "Susut Distribusi", en: "Distribution Losses", unit: "%", decimals: 2, better: "low",
    note: { id: "Persentase energi yang hilang di jaringan distribusi.", en: "Share of energy lost in the distribution network." },
  },
  {
    key: "energy_losses", table: "t02", column: "energy_losses_pct",
    id: "Susut Energi Total", en: "Total Energy Losses", unit: "%", decimals: 2, better: "low",
    note: { id: "Susut trafo, transmisi, dan distribusi.", en: "Transformer, transmission and distribution losses." },
  },
  {
    key: "avg_sold_household", table: "t08", column: "households_kwh",
    id: "Konsumsi per Pelanggan Rumah Tangga", en: "Consumption per Household Customer",
    unit: { id: "kWh/pelanggan", en: "kWh/customer" }, decimals: 0, better: null,
    note: { id: "Rata-rata energi terjual per pelanggan rumah tangga.", en: "Average energy sold per household customer." },
  },
  {
    key: "avg_sold_total", table: "t08", column: "total_kwh",
    id: "Konsumsi per Pelanggan (Semua Golongan)", en: "Consumption per Customer (All Types)",
    unit: { id: "kWh/pelanggan", en: "kWh/customer" }, decimals: 0, better: null,
  },
  {
    key: "installed_capacity", table: "t01", column: "installed_capacity_mw",
    id: "Kapasitas Terpasang", en: "Installed Capacity", unit: "MW", decimals: 0, better: null, compareNational: false,
    note: { id: "Termasuk pembangkit milik PLN, sewa, dan IPP.", en: "Includes PLN-owned, leased and IPP plants." },
  },
  {
    key: "peak_load", table: "t01", column: "peak_load_mw",
    id: "Beban Puncak", en: "Peak Load", unit: "MW", decimals: 0, better: null, compareNational: false,
  },
  {
    key: "reserve_margin", id: "Cadangan Daya (Reserve Margin)", en: "Reserve Margin", unit: "%", decimals: 1, better: null,
    value: (db, u, y) => {
      const r = db.row("t01", u, y);
      if (!r || !r.power_capacity_mw || !r.peak_load_mw) return null;
      return ((r.power_capacity_mw - r.peak_load_mw) / r.peak_load_mw) * 100;
    },
    note: { id: "(Daya mampu − beban puncak) ÷ beban puncak.", en: "(Derated capacity − peak load) ÷ peak load." },
  },
  {
    key: "ebt_share", id: "Porsi EBT pada Pembangkit Milik PLN", en: "Renewable Share of PLN-owned Capacity",
    unit: "%", decimals: 1, better: "high",
    value: (db, u, y) => {
      const r = db.row("t21", u, y);
      if (!r) return null;
      let ebt = 0, all = 0;
      for (const p of window.PLANT_TYPES) {
        const v = r[p.key + "_mw"] || 0;
        all += v; if (p.ebt) ebt += v;
      }
      return all > 0 ? (ebt / all) * 100 : null;
    },
    note: { id: "Hanya pembangkit milik PLN; sewa & IPP tidak dirinci per jenis.", en: "PLN-owned plants only; leased & IPP are not broken down by type." },
  },
];

/* Kartu yang tampil di tab Ringkasan (urut). */
window.SUMMARY_CARDS = [
  "electrification_ratio", "saidi", "saifi", "distribution_losses",
  "avg_sold_household", "installed_capacity", "reserve_margin", "ebt_share",
];
