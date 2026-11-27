/* Cek Data: data per provinsi (mis. jumlah desa berlistrik, rasio desa berlistrik).
 * Mengenali file dari isinya (ada kolom "Provinsi"), memeriksa, dan membuat "versi rapi" siap diunggah ke data/provinsi/.
 * Juga memeriksa daftar data per provinsi (data/provinsi/daftar-indikator.xlsx).
 *
 * Bentuk yang diterima (sheet mana pun selain info/indikator/README):
 *   Tahun | Provinsi | Indikator | Nilai            (disarankan: satu baris per tahun, provinsi, indikator)
 *   Tahun | Provinsi | <nilai>                      (satu indikator; nama kolom nilai = nama indikator)
 *   Tahun | Provinsi | <indikator A> | <indikator B> (satu kolom per indikator)
 *   Provinsi | [Indikator] | 2023 | 2024 ...        (satu kolom per tahun)
 * Bentuk rapi: sheet "info", sheet "indikator", sheet "data" (Tahun, Kode BPS, Provinsi, Indikator, Nilai). */
(function () {
  const INFO_KEYS = [
    ["judul_id", "Judul data (Bahasa Indonesia), mis. Desa menurut status penerangan listrik", true],
    ["judul_en", "Judul data (English), mis. Villages by electricity status", false],
    ["sumber", "Sumber data, mis. BPS, Statistik Potensi Desa 2024", true],
    ["satuan", "Satuan bawaan semua indikator, mis. desa; atau fraksi (0–1, tampil sebagai %), persen", false],
    ["komposisi", "ya = indikator-indikatornya adalah bagian dari satu keseluruhan (dapat ditampilkan sebagai persentase); tidak = indikator terpisah", false],
    ["penyebut", "Opsional: nama indikator yang menjadi keseluruhan, mis. Jumlah desa. Indikator lain lalu dapat ditampilkan juga sebagai persentase terhadapnya (mis. % desa tidak berlistrik)", false],
    ["catatan", "Catatan tambahan (opsional)", false],
  ];
  const NATIONAL = new Set(["indonesia", "nasional", "national", "total", "jumlah"]);
  const NOTE_RE = /^(sumber|source|catatan|keterangan|note|ket\.?|\*)/i;

  const norm = (s) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
    .replace(/sumatra/g, "sumatera").replace(/^\s*(provinsi|province|prov\.?)\s+/, "").replace(/^kep\.?\s+/, "kepulauan ")
    .replace(/[^a-z0-9]/g, "");
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const slugify = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const fnum = (x, d = 4) => x.toLocaleString("id-ID", { maximumFractionDigits: d });

  function lev(a, b) {
    const d = Array.from({ length: a.length + 1 }, (_, i) => [i]);
    for (let j = 1; j <= b.length; j++) d[0][j] = j;
    for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++)
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    return d[a.length][b.length];
  }

  let PROV = null;
  async function provinces() {
    if (PROV) return PROV;
    const res = await fetch("data/referensi/provinsi.xlsx", { cache: "no-cache" });
    if (!res.ok) throw new Error("daftar provinsi (data/referensi/provinsi.xlsx) tidak dapat dibuka");
    const rows = await window.readXlsxFile(await res.blob(), { sheet: "provinsi" });
    const h = rows[0].map((x) => norm(x));
    const ik = h.indexOf("kodebps"), inm = h.indexOf("nama"), ia = h.indexOf("alternatif");
    const byNorm = new Map(), list = [];
    for (const r of rows.slice(1)) {
      if (!r[inm]) continue;
      const p = { kode: r[ik], nama: String(r[inm]).trim() };
      list.push(p);
      byNorm.set(norm(p.nama), p);
      String(r[ia] || "").split(";").map((x) => x.trim()).filter(Boolean).forEach((a) => byNorm.set(norm(a), p));
    }
    PROV = { byNorm, list };
    return PROV;
  }

  const isYear = (v) => { const n = Number(String(v ?? "").trim()); return Number.isInteger(n) && n >= 1990 && n <= 2100 ? n : null; };
  const isProvHeader = (v) => /provinsi|province|^prov$/.test(norm(v));
  const isYearHeader = (v) => ["tahun", "year", "thn"].includes(norm(v));
  const isIndHeader = (v) => /^(indikator|indicator|variabel|variable|jenis|kategori|category|uraian|rincian)$/.test(norm(v));
  const isValueHeader = (v) => /^(nilai|value|jumlah|angka)$/.test(norm(v));
  const isIgnoredHeader = (v) => /^(no|nomor|kode|kodebps|kodeprovinsi|kodeprov|id)$/.test(norm(v));
  const filled = (v) => v != null && String(v).trim() !== "";

  function findTable(rows) {
    for (let i = 0; i < Math.min(rows.length, 25); i++) {
      const r = rows[i] || [];
      const pc = r.findIndex(isProvHeader);
      if (pc < 0) continue;
      const yc = r.findIndex(isYearHeader);
      const ic = r.findIndex(isIndHeader);
      const yearCols = r.map((v, j) => (j !== pc && isYear(v) ? j : -1)).filter((j) => j >= 0);
      if (yc >= 0) {
        const vcols = r.map((v, j) => (![pc, yc, ic].includes(j) && filled(v) && !isIgnoredHeader(v) ? j : -1)).filter((j) => j >= 0);
        return { header: i, layout: "long", pc, yc, ic, vcols };
      }
      if (yearCols.length) return { header: i, layout: "wide", pc, ic, yearCols };
      // Judul kolom bertingkat (khas unduhan BPS): baris indikator, lalu baris tahun di bawahnya
      for (let k = i + 1; k <= Math.min(i + 5, rows.length - 1); k++) {
        const yr = rows[k] || [];
        const cols = yr.map((v, j) => (j !== pc && isYear(v) ? j : -1)).filter((j) => j >= 0);
        if (!cols.length) continue;
        const width = Math.max(...rows.slice(i, k + 1).map((x) => (x || []).length));
        const filledRow = (x) => { const o = []; let last = null; for (let j = 0; j < width; j++) { if (j !== pc && filled((x || [])[j])) last = String(x[j]).trim(); o.push(j === pc ? null : last); } return o; };
        const labelRows = []; for (let m = k - 1; m >= i; m--) labelRows.push({ m, raw: rows[m] || [], ff: filledRow(rows[m]) });
        const lab = labelRows.find((L) => cols.filter((j) => filled(L.raw[j])).length >= Math.min(2, cols.length)) || labelRows[0];
        const titleCells = rows.slice(0, k).flat().filter((v) => typeof v === "string" && v.trim().length > 15 && !isProvHeader(v));
        const title = titleCells.sort((a, b) => b.length - a.length)[0] || "";
        return { header: k, layout: "wide2", pc, ic: -1, labelRow: lab.m, title,
          cols: cols.map((j) => ({ j, year: yr[j], ind: (filled(lab.raw[j]) ? String(lab.raw[j]).trim() : lab.ff[j]) || "Nilai" })) };
      }
    }
    return null;
  }

  async function sheetsOf(file) {
    const names = (await window.readXlsxFile(file, { getSheets: true })).map((s) => s.name);
    const out = {};
    for (const n of names) out[n] = await window.readXlsxFile(file, { sheet: n });
    return out;
  }
  const keyVal = (rows) => {   // sheet info: kunci | isian
    const o = {};
    for (const r of (rows || []).slice(1)) if (filled(r[0])) o[norm(r[0])] = filled(r[1]) ? String(r[1]).trim() : "";
    return o;
  };

  /* ---------------- Daftar data per provinsi (daftar-indikator.xlsx) ---------------- */
  async function checkRegistry(file, sheets, ui) {
    const rows = sheets.daftar || Object.values(sheets)[0];
    const errors = [], warnings = [], info = [];
    const h = (rows[0] || []).map(norm);
    const fi = h.indexOf("file"), ti = h.indexOf("tampilkan"), ui_ = h.indexOf("urutan");
    if (fi < 0 || ti < 0) { errors.push(`Sheet <b>daftar</b> harus memiliki kolom <b>file</b> dan <b>tampilkan</b> (dan boleh <b>urutan</b>).`); ui.show(errors, warnings, info); return true; }
    const seen = new Set(); let shown = 0;
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i] || [], line = i + 1;
      if (!filled(r[fi])) continue;
      const name = String(r[fi]).trim();
      const t = norm(r[ti]);
      if (!["ya", "tidak", "yes", "no"].includes(t)) errors.push(`Baris ${line}: kolom <b>tampilkan</b> harus "ya" atau "tidak" (tertulis "${esc(r[ti])}").`);
      if (!/^[a-z0-9-]+\.xlsx$/.test(name)) errors.push(`Baris ${line}: nama file "${esc(name)}" harus huruf kecil/angka/tanda hubung dan diakhiri .xlsx (contoh: desa-berlistrik.xlsx).`);
      if (seen.has(name)) errors.push(`Baris ${line}: file "${esc(name)}" tercantum dua kali.`);
      seen.add(name);
      if (["ya", "yes"].includes(t)) shown++;
      try {
        const res = await fetch("data/provinsi/" + encodeURIComponent(name), { cache: "no-cache" });
        const blob = res.ok ? await res.blob() : null;
        const head = blob ? new Uint8Array(await blob.slice(0, 2).arrayBuffer()) : null;
        if (!blob || head[0] !== 0x50 || head[1] !== 0x4b) { (["ya", "yes"].includes(t) ? errors : warnings).push(`Baris ${line}: file <b>data/provinsi/${esc(name)}</b> belum ada di situs. Unggah file itu dulu (atau tunggu beberapa menit setelah mengunggah).`); continue; }
        const names = (await window.readXlsxFile(blob, { getSheets: true })).map((s) => s.name);
        const miss = ["info", "data"].filter((s) => !names.includes(s));
        if (miss.length) errors.push(`Baris ${line}: <b>${esc(name)}</b> belum berbentuk versi rapi (sheet ${miss.join(", ")} tidak ada). Periksa file itu di Cek Data dan unggah versi rapinya.`);
        else info.push(`${esc(name)}: ditemukan di data/provinsi/ ✓`);
      } catch (e) { warnings.push(`Baris ${line}: ${esc(name)} tidak dapat diperiksa (${esc(e.message)}).`); }
    }
    info.unshift(`Dikenali sebagai <b>daftar data per provinsi</b>: ${seen.size} file, ${shown} ditampilkan.`);
    ui.show(errors, warnings, info, "", errors.length ? null : "✔ DAFTAR SIAP DIUNGGAH");
    ui.out.insertAdjacentHTML("beforeend", `<p class="hint">ℹ Unggah daftar ini ke folder <code>data/provinsi/</code> dengan nama <b>daftar-indikator.xlsx</b>. Data dengan <i>tampilkan = ya</i> muncul di tab <b>Provinsi</b> (sektor Ketenagalistrikan).</p>`);
    return true;
  }

  /* ---------------- File data per provinsi ---------------- */
  async function check(file, ui) {
    let sheets;
    try { sheets = await sheetsOf(file); } catch (e) { return false; }
    const lower = Object.fromEntries(Object.entries(sheets).map(([n, r]) => [n.toLowerCase(), r]));
    if (/^daftar-indikator\.xlsx$/i.test(file.name) || (lower.daftar && (lower.daftar[0] || []).map(norm).includes("tampilkan")))
      return checkRegistry(file, lower, ui);

    let dataName = null, t = null;
    for (const [n, rows] of Object.entries(sheets)) {
      if (/^(info|indikator|readme|contoh|petunjuk)$/i.test(n)) continue;
      const f = findTable(rows);
      if (f) { dataName = n; t = f; break; }
    }
    if (!t) return false;

    const errors = [], warnings = [], info = [];
    let P;
    try { P = await provinces(); } catch (e) { errors.push(esc(e.message)); ui.show(errors, warnings, info); return true; }
    const rows = sheets[dataName], hdr = rows[t.header];
    const S = `Sheet <b>${esc(dataName)}</b>`;
    const meta = keyVal(lower.info);
    const getInfo = (k) => meta[norm(k)] || meta[norm(k.replace("judul", "nama"))] || "";   // "nama_id" (format lama) juga diterima

    // saran judul & satuan dari judul tabel BPS, mis. "Banyaknya Desa/Kelurahan ... (Desa)"
    const sugg = {};
    if (t.title) {
      const m = t.title.match(/^(.*?)\s*\(([^()]{1,25})\)\s*$/);
      sugg.judulid = (m ? m[1] : t.title).trim();
      if (m) sugg.satuan = m[2].trim().toLowerCase();
    }
    // bagaimana indikator ditentukan
    let indMode;
    if (t.layout === "wide2") {
      indMode = "columns";
      const inds = [...new Set(t.cols.map((c) => c.ind))], yrs = [...new Set(t.cols.map((c) => String(c.year).trim()))];
      info.push(`Judul kolom dua tingkat dikenali (khas unduhan BPS): indikator di baris ${t.labelRow + 1} (${inds.map(esc).join(", ")}), tahun di baris ${t.header + 1} (${yrs.map(esc).join(", ")}).`);
      if (sugg.judulid) info.push(`Judul tabel: "${esc(t.title)}". Dipakai sebagai saran judul${sugg.satuan ? ` dan satuan (<b>${esc(sugg.satuan)}</b>)` : ""} di versi rapi.`);
    } else if (t.ic >= 0) {
      indMode = "column";
      if (t.layout === "long" && t.vcols.length !== 1) errors.push(`${S}: dengan kolom <b>${esc(hdr[t.ic])}</b>, harus ada tepat satu kolom nilai (sekarang ${t.vcols.length}: ${t.vcols.map((j) => esc(hdr[j])).join(", ") || "tidak ada"}).`);
    } else if (t.layout === "long" && t.vcols.length > 1) {
      indMode = "columns";
      warnings.push(`${S}: ${t.vcols.length} kolom nilai dibaca sebagai ${t.vcols.length} indikator (${t.vcols.map((j) => esc(hdr[j])).join(", ")}). Versi rapi menyusunnya menjadi kolom <b>Indikator</b> dan <b>Nilai</b>.`);
    } else {
      indMode = "single";
      if (t.layout === "long" && t.vcols.length === 0) errors.push(`${S}: tidak ada kolom nilai di sebelah kolom Tahun dan Provinsi.`);
    }
    const singleName = t.layout === "long" && t.vcols.length === 1 && !isValueHeader(hdr[t.vcols[0]]) ? String(hdr[t.vcols[0]]).trim() : (getInfo("judul_id") || "Nilai");
    const layoutTxt = t.layout === "long" ? "memanjang (satu baris per tahun dan provinsi)" : t.layout === "wide2" ? "tabel BPS (indikator dan tahun sebagai judul kolom)" : "melebar (satu kolom per tahun)";
    info.push(`Dikenali sebagai <b>data per provinsi</b>: sheet <b>${esc(dataName)}</b>, susunan ${layoutTxt}, ${indMode === "column" ? `indikator di kolom <b>${esc(hdr[t.ic])}</b>` : indMode === "columns" ? "satu kolom per indikator" : `satu indikator ("${esc(singleName)}")`}.`);
    const standard = t.layout === "long" && t.ic >= 0 && t.header === 0;
    if (!standard) warnings.push(`File ini <b>bukan</b> susunan standar empat kolom (Tahun | Provinsi | Indikator | Nilai), tetapi masih dapat dibaca. ` +
      `Periksa hasil di Ringkasan dengan teliti (nama indikator dan tahun). Untuk data berikutnya, sebaiknya susun dulu ke empat kolom ` +
      `(lihat Panduan Menambah Data per Provinsi, Langkah 2), karena tabel dari sumber lain bisa saja tidak terbaca dengan benar.`);
    if (t.layout === "wide") warnings.push(`Susunan melebar (tahun sebagai kolom: ${t.yearCols.map((j) => esc(hdr[j])).join(", ")}). Dapat dibaca; versi rapi mengubahnya menjadi satu baris per tahun.`);
    if (t.header > 0 && t.layout !== "wide2") warnings.push(`Baris 1–${t.header} berisi judul/teks di atas tabel dan diabaikan. Versi rapi tidak menyertakannya.`);

    const recs = [], aliasUsed = new Map(), unknown = [], notes = [], indSpell = new Map();
    let pctStrings = 0;
    const parseVal = (v, line) => {
      if (!filled(v) || String(v).trim() === "-") return { empty: true };
      if (typeof v === "number") return { v };
      let s = String(v).trim(), pct = false;
      if (s.endsWith("%")) { pct = true; s = s.slice(0, -1).trim(); }
      const n = window.PraktikData.toNumber(s);
      if (n == null || Number.isNaN(n)) { errors.push(`${S} baris ${line}: nilai "${esc(v)}" bukan angka.`); return { bad: true }; }
      if (pct) pctStrings++;
      return { v: n };
    };
    const indName = (raw) => {   // satukan penulisan indikator yang hanya beda huruf besar/spasi
      const s = String(raw).trim().replace(/\s+/g, " "), k = s.toLowerCase();
      if (!indSpell.has(k)) indSpell.set(k, new Set());
      indSpell.get(k).add(s);
      return [...indSpell.get(k)][0];
    };
    for (let i = t.header + 1; i < rows.length; i++) {
      const r = rows[i] || [], line = i + 1;
      const pv = r[t.pc];
      const valCells = t.layout === "long" ? t.vcols.map((j) => r[j]) : t.layout === "wide2" ? t.cols.map((c) => r[c.j]) : t.yearCols.map((j) => r[j]);
      const hasVals = valCells.some(filled);
      if (!filled(pv) && !hasVals) continue;
      const texts = r.filter(filled).map((v) => String(v).trim());
      if (texts.length && texts.every((v) => !/^[-\d.,%\s]+$/.test(v)) && texts.some((v) => NOTE_RE.test(v))) { notes.push(line); continue; }
      if (!filled(pv)) { errors.push(`${S} baris ${line}: ada nilai tetapi nama provinsi kosong.`); continue; }
      if (!hasVals && NOTE_RE.test(String(pv).trim())) { notes.push(line); continue; }
      const key = norm(pv);
      let prov = P.byNorm.get(key);
      if (!prov && NATIONAL.has(key)) prov = { kode: null, nama: "Indonesia" };
      if (!prov) {
        let best = null, bd = 99;
        for (const [k, p] of P.byNorm) { const d = lev(key, k); if (d < bd) { bd = d; best = p; } }
        unknown.push({ line, text: pv, sug: bd <= Math.max(2, Math.round(key.length / 4)) ? best.nama : null });
        continue;
      }
      const raw = String(pv).trim().replace(/\s+/g, " ");
      if (raw.toLowerCase() !== prov.nama.toLowerCase()) aliasUsed.set(raw, prov.nama);   // beda huruf besar/kecil saja: tidak dicatat
      let ind = singleName;
      if (indMode === "column") {
        if (!filled(r[t.ic])) { errors.push(`${S} baris ${line}: nama indikator kosong.`); continue; }
        ind = indName(r[t.ic]);
      }
      const push = (yearRaw, cell, indicator) => {
        const year = isYear(yearRaw);
        if (year == null) { errors.push(`${S} baris ${line}: tahun "${esc(yearRaw)}" tidak valid.`); return; }
        const p = parseVal(cell, line);
        if (p.empty || p.bad) return;
        recs.push({ year, kode: prov.kode, nama: prov.nama, ind: indicator, v: p.v, line });
      };
      if (t.layout === "long" && indMode === "columns") t.vcols.forEach((j) => push(r[t.yc], r[j], String(hdr[j]).trim()));
      else if (t.layout === "long") push(r[t.yc], r[t.vcols[0]], ind);
      else if (t.layout === "wide2") t.cols.forEach((c) => push(c.year, r[c.j], c.ind));
      else t.yearCols.forEach((j) => push(hdr[j], r[j], ind));
    }
    for (const u of unknown) errors.push(`${S} baris ${u.line}: provinsi "${esc(u.text)}" tidak dikenali.` +
      (u.sug ? ` Maksudnya <b>${esc(u.sug)}</b>?` : "") + ` Perbaiki penulisannya, atau tambahkan penulisan ini ke kolom <i>alternatif</i> di data/referensi/provinsi.xlsx.`);
    if (aliasUsed.size) warnings.push(`Penulisan provinsi berbeda dari nama resmi, tetapi dikenali (${aliasUsed.size}): ${[...aliasUsed].slice(0, 8).map(([a, b]) => `"${esc(a)}" → <b>${esc(b)}</b>`).join(", ")}${aliasUsed.size > 8 ? ", …" : ""}. Versi rapi memakai nama resmi.`);
    if (notes.length) warnings.push(`Baris ${notes.join(", ")} berisi catatan/sumber di bawah tabel dan diabaikan. Pindahkan isinya ke sheet <b>info</b> (sumber/catatan).`);
    for (const [, spells] of indSpell) if (spells.size > 1) warnings.push(`Indikator ditulis dengan beberapa cara: ${[...spells].map((s) => `"${esc(s)}"`).join(", ")}. Versi rapi menyeragamkannya menjadi "${esc([...spells][0])}".`);

    const seen = new Map();
    for (const r of recs) {
      const k = `${r.year}|${r.nama}|${r.ind}`;
      if (seen.has(k)) errors.push(`${esc(r.nama)}, ${esc(r.ind)}, tahun ${r.year} muncul dua kali (baris ${seen.get(k)} dan ${r.line}).`);
      else seen.set(k, r.line);
    }

    // per indikator: satuan & kelengkapan
    const inds = [...new Set(recs.map((r) => r.ind))];
    const indMeta = {};
    if (lower.indikator) {
      const ih = (lower.indikator[0] || []).map(norm);
      const c = (n) => ih.indexOf(n);
      for (const r of lower.indikator.slice(1)) if (filled(r[0])) indMeta[String(r[0]).trim().toLowerCase().replace(/\s+/g, " ")] = {
        en: c("namaen") >= 0 ? r[c("namaen")] : null, satuan: c("satuan") >= 0 ? r[c("satuan")] : null, better: c("makintinggimakinbaik") >= 0 ? r[c("makintinggimakinbaik")] : null };
      const listed = Object.keys(indMeta), present = inds.map((s) => s.toLowerCase());
      const notListed = inds.filter((s) => !listed.includes(s.toLowerCase())), unused = listed.filter((s) => !present.includes(s));
      if (notListed.length) warnings.push(`Sheet <b>indikator</b> belum memuat: ${notListed.map((s) => `"${esc(s)}"`).join(", ")}.`);
      if (unused.length) warnings.push(`Sheet <b>indikator</b> memuat indikator yang tidak ada di data: ${unused.map((s) => `"${esc(s)}"`).join(", ")}.`);
    }
    const unitOf = {};
    for (const ind of inds) {
      const rs = recs.filter((r) => r.ind === ind && r.nama !== "Indonesia"), vals = rs.map((r) => r.v);   // kisaran tanpa baris nasional
      let unit = norm((indMeta[ind.toLowerCase()] || {}).satuan || getInfo("satuan"));
      if (unit === "%") unit = "persen";
      const nLow = vals.filter((v) => v >= 0 && v <= 1).length, nHigh = vals.filter((v) => v > 1 && v <= 100).length, nBig = vals.filter((v) => v > 100 || v < 0).length;
      if (!unit && nBig === 0) unit = pctStrings ? "persen" : nLow >= nHigh ? "fraksi" : "persen";
      unitOf[ind] = unit;
      const lo = Math.min(...vals), hi = Math.max(...vals), lbl = inds.length > 1 ? `<b>${esc(ind)}</b>: ` : "";
      if (unit === "fraksi") {
        const ok = vals.filter((v) => v >= 0 && v <= 1);
        info.push(`${lbl}fraksi (${fnum(Math.min(...ok))}–${fnum(Math.max(...ok))}), ditampilkan sebagai persen (${fnum(Math.min(...ok) * 100, 2)}%–${fnum(Math.max(...ok) * 100, 2)}%).`);
        const over = rs.filter((r) => r.v > 1 || r.v < 0);
        if (over.length) errors.push(`${lbl}nilai berupa fraksi (0–1), tetapi ${over.length} nilai di luar 0–1: ${over.slice(0, 6).map((r) => `baris ${r.line} (${esc(r.nama)} ${r.year}: ${fnum(r.v)})`).join(", ")}. Kemungkinan tertulis dalam persen; samakan dengan nilai lain.`);
      } else if (unit === "persen") {
        info.push(`${lbl}persen (${fnum(lo, 2)}%–${fnum(hi, 2)}%).`);
        if (nLow && nHigh && nLow < nHigh) warnings.push(`${lbl}${nLow} nilai antara 0 dan 1, padahal nilai lain dalam persen (mis. baris ${rs.filter((r) => r.v <= 1).slice(0, 5).map((r) => r.line).join(", ")}). Kemungkinan tertulis sebagai fraksi: periksa.`);
      } else {
        info.push(`${lbl}${fnum(lo)}–${fnum(hi)}${unit ? " " + esc((indMeta[ind.toLowerCase()] || {}).satuan || getInfo("satuan")) : ""}.`);
      }
    }
    const years = [...new Set(recs.map((r) => r.year))].sort();
    for (const y of years) for (const ind of inds) {
      const have = new Set(recs.filter((r) => r.year === y && r.ind === ind).map((r) => r.nama));
      const miss = P.list.filter((p) => !have.has(p.nama)).map((p) => p.nama);
      if (miss.length) warnings.push(`Tahun ${y}${inds.length > 1 ? `, ${esc(ind)}` : ""}: ${miss.length} provinsi tanpa data (${miss.slice(0, 8).map(esc).join(", ")}${miss.length > 8 ? ", …" : ""}).`);
    }
    info.push(`Tahun: ${years.join(", ") || "-"} · ${new Set(recs.map((r) => r.nama)).size} provinsi · ${inds.length} indikator · ${recs.length} nilai.`);
    if (!lower.info) warnings.push(`Belum ada sheet <b>info</b> (judul, sumber, satuan). Versi rapi menambahkannya: lengkapi isiannya, lalu periksa ulang.`);
    else {
      const miss = INFO_KEYS.filter(([k, , req]) => req && !getInfo(k)).map(([k]) => k);
      if (miss.length) warnings.push(`Sheet <b>info</b> belum lengkap: ${miss.map(esc).join(", ")}.`);
    }
    const pen = String(getInfo("penyebut") || "").trim();
    if (pen) {
      if (!inds.includes(pen)) errors.push(`Sheet info: <b>penyebut</b> "${esc(pen)}" tidak ada di daftar indikator (${inds.map(esc).join(", ")}). Tulis persis sama dengan nama indikatornya.`);
      else if (["fraksi", "persen"].includes(unitOf[pen])) errors.push(`Sheet info: <b>penyebut</b> "${esc(pen)}" harus berupa jumlah (bukan fraksi/persen).`);
      else info.push(`Penyebut: indikator lain juga tampil sebagai persentase terhadap "${esc(pen)}".`);
    }
    const komp = ["ya", "yes"].includes(norm(getInfo("komposisi")));
    if (komp) {
      const us = new Set(inds.map((i) => unitOf[i]));
      if (us.size > 1 || us.has("fraksi") || us.has("persen")) warnings.push(`<b>komposisi = ya</b>, tetapi satuan indikatornya berbeda atau berupa persen/fraksi. Komposisi hanya bermakna untuk jumlah dengan satuan sama (mis. desa).`);
      else info.push(`Komposisi: ${inds.length} indikator dijumlahkan menjadi 100% per provinsi.`);
    } else if (inds.length > 1 && !getInfo("komposisi") && !pen) {
      const us = new Set(inds.map((i) => unitOf[i]));
      const tot = !us.has("fraksi") && !us.has("persen") ? recs.filter((r) => r.year === years[years.length - 1] && r.nama !== "Indonesia").reduce((a, r) => a + r.v, 0) : null;
      warnings.push(`Ada ${inds.length} indikator${tot != null ? ` (jumlah semuanya ${fnum(tot, 0)} untuk tahun ${years[years.length - 1]})` : ""}. Isi <b>komposisi</b> di sheet info: ` +
        `<b>ya</b> hanya jika indikator-indikator ini tidak tumpang tindih dan jumlahnya sama dengan keseluruhannya (bandingkan dengan total yang diketahui, mis. jumlah semua desa); ` +
        `<b>tidak</b> jika satu unsur dapat masuk lebih dari satu indikator.`);
    }

    if (!recs.length && !errors.length) errors.push(`${S}: belum ada angka. Isi data di bawah judul kolom (Tahun | Provinsi | Indikator | Nilai), lalu periksa lagi.`);
    const ok = errors.length === 0;
    ui.show(errors, warnings, info, "", ok ? "✔ FORMAT DAPAT DIBACA (data per provinsi)" : null);
    const base = slugify(getInfo("judul_id")) || slugify(file.name.replace(/\.xlsx$/i, "").replace(/^\d{4}[_ -]*/, "").replace(/^provinsi[_ -]*/i, "")) || "data-provinsi";
    const outName = base + ".xlsx";
    let extra = "";
    if (ok && recs.length) extra += `<p style="margin-top:12px"><button type="button" class="btn primary" id="tidyBtn">⬇ Unduh versi rapi (${esc(outName)})</button>
      <br><small>Isi sama, susunan seragam: sheet <b>info</b>, sheet <b>indikator</b>, dan sheet <b>data</b> (Tahun, Kode BPS, Provinsi, Indikator, Nilai) dengan nama provinsi resmi.
      Lengkapi sheet info dan indikator, periksa ulang di sini, lalu unggah ke folder <code>data/provinsi/</code> dan daftarkan di <b>daftar-indikator.xlsx</b>.</small></p>`;
    ui.out.insertAdjacentHTML("beforeend", extra);
    const btn = document.getElementById("tidyBtn");
    if (btn) btn.onclick = async () => {
      const H = (v) => ({ value: v, fontWeight: "bold" });
      const infoSheet = [[H("kunci"), H("isian"), H("keterangan")], ...INFO_KEYS.map(([k, d]) => [k, getInfo(k) || sugg[norm(k)] || (k === "komposisi" && inds.length === 1 ? "tidak" : null), d])];
      const indSheet = [[H("indikator"), H("nama_en"), H("satuan"), H("makin_tinggi_makin_baik")], ...inds.map((ind) => {
        const m = indMeta[ind.toLowerCase()] || {};
        return [ind, m.en || null, m.satuan || (["fraksi", "persen"].includes(unitOf[ind]) ? unitOf[ind] : null), m.better || null];
      })];
      const sorted = recs.slice().sort((a, b) => a.year - b.year || inds.indexOf(a.ind) - inds.indexOf(b.ind) || (a.kode ?? 999) - (b.kode ?? 999));
      const dataSheet = [[H("Tahun"), H("Kode BPS"), H("Provinsi"), H("Indikator"), H("Nilai")], ...sorted.map((r) => [r.year, r.kode ?? null, r.nama, r.ind, r.v])];
      await window.writeXlsxFile([
        { data: infoSheet, sheet: "info", columns: [{ width: 16 }, { width: 50 }, { width: 90 }], stickyRowsCount: 1 },
        { data: indSheet, sheet: "indikator", columns: [{ width: 34 }, { width: 34 }, { width: 12 }, { width: 24 }], stickyRowsCount: 1 },
        { data: dataSheet, sheet: "data", columns: [{ width: 8 }, { width: 10 }, { width: 30 }, { width: 34 }, { width: 14 }], stickyRowsCount: 1 },
      ]).toFile(outName);
    };
    return true;
  }

  window.CekProvinsi = { check, norm, provinces };
})();
