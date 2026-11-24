/* Pemuat data: membaca file Excel di /data dan menyiapkan basis data di memori.
 * Data loader: reads the Excel workbooks in /data into an in-memory database. */

(function () {
  const CFG = window.DASHBOARD_CONFIG;

  function toNumber(v) {
    if (v === null || v === undefined) return null;
    if (typeof v === "number") return isFinite(v) ? v : null;
    const s = String(v).trim();
    if (s === "" || s === "-" || s === "–") return null;
    // Terima "1.234,56" (format Indonesia) maupun "1234.56".
    let t = s.replace(/\s/g, "");
    if (/^-?[\d.]+,\d+$/.test(t)) t = t.replace(/\./g, "").replace(",", ".");
    else t = t.replace(/,/g, "");
    if (/^\(.*\)$/.test(t)) t = "-" + t.slice(1, -1);
    const n = Number(t);
    return isFinite(n) ? n : NaN; // NaN = sel tidak valid
  }

  const TEXT_COLUMNS = new Set([
    "unit_id", "unit_name", "row_type", "parent_unit_id", "region",
    "table_id", "table_name", "table_title_en", "table_title_id", "column", "label_en", "label_id", "uom",
    "indicator", "note_id", "note_en",
  ]);

  function rowsToObjects(rows, sheet, problems, fileLabel) {
    if (!rows.length) return [];
    const header = rows[0].map((h) => (h === null ? "" : String(h).trim()));
    const out = [];
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      if (r.every((c) => c === null || c === "")) continue;
      const o = {};
      header.forEach((h, j) => {
        if (!h) return;
        const v = r[j];
        if (TEXT_COLUMNS.has(h)) o[h] = v === null || v === undefined ? null : String(v).trim() || null;
        else {
          const n = toNumber(v);
          if (Number.isNaN(n)) {
            problems.push(`${fileLabel} › ${sheet} baris ${i + 1}, kolom "${h}": nilai "${v}" bukan angka`);
            o[h] = null;
          } else o[h] = n;
        }
      });
      out.push(o);
    }
    out.header = header;
    return out;
  }

  async function readWorkbook(source, fileLabel, fallbackYear) {
    const problems = [];
    const result = { sheets: {}, problems };
    const all = CFG.sheets.concat(CFG.optionalSheets);
    for (const sheet of all) {
      try {
        const rows = await window.readXlsxFile(source, { sheet });
        result.sheets[sheet] = rowsToObjects(rows, sheet, problems, fileLabel);
      } catch (e) {
        if (CFG.sheets.includes(sheet)) problems.push(`${fileLabel}: sheet "${sheet}" tidak ditemukan atau tidak terbaca`);
      }
    }
    // Tahun SELALU mengikuti nama file (statistik-pln-TAHUN.xlsx), sehingga kolom "year"
    // yang lupa diganti tidak membuat data tercampur.
    for (const [name, rows] of Object.entries(result.sheets)) {
      if (/^t\d+$/.test(name) || name === "catatan")
        rows.forEach((r) => { if (fallbackYear) r.year = fallbackYear; });
    }
    return result;
  }

  function buildDb(workbooks) {
    const db = { tables: {}, units: new Map(), dict: new Map(), notes: [], years: new Set(), problems: [] };
    // Proses dari tahun lama ke baru agar daftar unit & kamus mengikuti file terbaru.
    workbooks.sort((a, b) => a.year - b.year);
    for (const wb of workbooks) {
      db.problems.push(...wb.problems);
      for (const [name, rows] of Object.entries(wb.sheets)) {
        if (/^t\d+$/.test(name)) {
          db.tables[name] = (db.tables[name] || []).concat(rows);
          rows.forEach((r) => {
            if (r.year) db.years.add(r.year);
            if (r.unit_id && !db.units.has(r.unit_id))
              db.units.set(r.unit_id, { unit_id: r.unit_id, unit_name: r.unit_name, row_type: r.row_type, parent_unit_id: r.parent_unit_id, region: r.region });
          });
        } else if (name === "units") {
          rows.forEach((u) => u.unit_id && db.units.set(u.unit_id, u));
        } else if (name === "data_dictionary") {
          rows.forEach((d) => d.table_id && db.dict.set(d.table_id + "." + d.column, d));
        } else if (name === "catatan") {
          db.notes.push(...rows);
        }
      }
    }
    db.years = [...db.years].sort((a, b) => a - b);

    // Indeks cepat: tabel → tahun → unit → baris
    const idx = {};
    for (const [t, rows] of Object.entries(db.tables)) {
      idx[t] = {};
      rows.forEach((r) => { ((idx[t][r.year] ||= {})[r.unit_id] = r); });
    }
    db.row = (t, u, y) => (idx[t] && idx[t][y] && idx[t][y][u]) || null;
    db.value = (t, col, u, y) => { const r = db.row(t, u, y); return r ? r[col] ?? null : null; };
    db.tableYears = (t) => Object.keys(idx[t] || {}).map(Number);
    db.label = (t, col, lang) => {
      const d = db.dict.get(t + "." + col);
      return d ? (lang === "en" ? d.label_en : d.label_id) || col : col;
    };
    db.tableTitle = (t, lang) => {
      for (const d of db.dict.values()) if (d.table_id === t) return lang === "en" ? d.table_title_en : d.table_title_id;
      return t;
    };
    db.uom = (t, col) => { const d = db.dict.get(t + "." + col); return d ? d.uom : ""; };
    return db;
  }

  async function loadFromServer(onProgress) {
    const years = [];
    for (let y = CFG.lastYear; y >= CFG.firstYear; y--) years.push(y);
    const found = await Promise.all(years.map(async (y) => {
      const url = CFG.dataFilePattern.replace("{year}", y);
      try {
        const res = await fetch(url, { cache: "no-cache" });
        if (!res.ok) return null;
        return { year: y, url, blob: await res.blob() };
      } catch { return null; }
    }));
    const files = found.filter(Boolean);
    if (!files.length) throw new Error("NO_DATA");
    const workbooks = [];
    for (const f of files) {
      onProgress && onProgress(f.url);
      const wb = await readWorkbook(f.blob, f.url.split("/").pop(), f.year);
      wb.year = f.year;
      workbooks.push(wb);
    }
    return buildDb(workbooks);
  }

  window.PraktikData = { loadFromServer, readWorkbook, buildDb, toNumber };
})();
