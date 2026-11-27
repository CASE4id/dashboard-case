/* Cek Data: indikator per provinsi (mis. rasio desa berlistrik).
 * Mengenali file berdasarkan isinya (ada kolom "Provinsi"), memeriksa, dan membuat "versi rapi" siap pakai.
 * Daftar provinsi & penulisan alternatif: data/referensi/provinsi.xlsx (dapat ditambah staf).
 * Bentuk rapi: sheet "info" (kunci, isian, keterangan) + sheet "data" (Tahun, Kode BPS, Provinsi, Nilai). */
(function () {
  const INFO_KEYS = [
    ["nama_id", "Nama indikator (Bahasa Indonesia), mis. Rasio desa berlistrik"],
    ["nama_en", "Nama indikator (English), mis. Electrified village ratio"],
    ["satuan", "fraksi (nilai 0–1, ditampilkan sebagai %), persen (0–100), atau satuan lain mis. MW"],
    ["sumber", "Sumber data, mis. Kementerian ESDM, 2025"],
    ["makin_tinggi_makin_baik", "ya / tidak / netral"],
  ];
  const NATIONAL = new Set(["indonesia", "nasional", "national", "total", "jumlah"]);
  const NOTE_RE = /^(sumber|source|catatan|keterangan|note|ket\.?|\*)/i;

  const norm = (s) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
    .replace(/sumatra/g, "sumatera").replace(/^\s*(provinsi|province|prov\.?)\s+/, "").replace(/^kep\.?\s+/, "kepulauan ")
    .replace(/[^a-z0-9]/g, "");
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  function lev(a, b) {
    const d = Array.from({ length: a.length + 1 }, (_, i) => [i]);
    for (let j = 1; j <= b.length; j++) d[0][j] = j;
    for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++)
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    return d[a.length][b.length];
  }

  let PROV = null; // {byNorm: Map(norm -> {kode, nama}), list: [...]}
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
  const isIgnoredHeader = (v) => /^(no|nomor|kode|kodebps|kodeprovinsi|kodeprov|id)$/.test(norm(v));

  function findTable(rows) {
    for (let i = 0; i < Math.min(rows.length, 25); i++) {
      const r = rows[i] || [];
      const pc = r.findIndex(isProvHeader);
      if (pc < 0) continue;
      const yc = r.findIndex(isYearHeader);
      const yearCols = r.map((v, j) => (j !== pc && isYear(v) ? j : -1)).filter((j) => j >= 0);
      if (yc >= 0) {
        const vcols = r.map((v, j) => (j !== pc && j !== yc && v != null && String(v).trim() !== "" && !isIgnoredHeader(v) ? j : -1)).filter((j) => j >= 0);
        return { header: i, layout: "long", pc, yc, vcols };
      }
      if (yearCols.length) return { header: i, layout: "wide", pc, yearCols };
    }
    return null;
  }

  async function sheetsOf(file) {
    const names = (await window.readXlsxFile(file, { getSheets: true })).map((s) => s.name);
    const out = {};
    for (const n of names) out[n] = await window.readXlsxFile(file, { sheet: n });
    return out;
  }

  /* Dipanggil dari cek-data.html. Mengembalikan false jika file bukan indikator per provinsi. */
  async function check(file, ui) {
    let sheets;
    try { sheets = await sheetsOf(file); } catch (e) { return false; }
    let dataName = null, t = null;
    for (const [n, rows] of Object.entries(sheets)) {
      if (/^(info|readme)$/i.test(n)) continue;
      const f = findTable(rows);
      if (f) { dataName = n; t = f; break; }
    }
    if (!t) return false;

    const errors = [], warnings = [], info = [];
    let P;
    try { P = await provinces(); } catch (e) { errors.push(esc(e.message)); ui.show(errors, warnings, info); return true; }
    const rows = sheets[dataName];
    info.push(`Dikenali sebagai <b>indikator per provinsi</b> (sheet <b>${esc(dataName)}</b>, susunan ${t.layout === "long" ? "memanjang: satu baris per tahun dan provinsi" : "melebar: satu kolom per tahun"}).`);
    if (t.layout === "wide") warnings.push(`Susunan melebar (tahun sebagai kolom: ${t.yearCols.map((j) => esc(rows[t.header][j])).join(", ")}). Dapat dibaca; versi rapi mengubahnya menjadi satu baris per tahun dan provinsi.`);
    if (t.header > 0) warnings.push(`Baris 1–${t.header} berisi judul/teks di atas tabel dan diabaikan. Versi rapi tidak menyertakannya.`);
    if (t.layout === "long" && t.vcols.length === 0) errors.push(`Sheet <b>${esc(dataName)}</b>: tidak ada kolom nilai di sebelah kolom Tahun dan Provinsi.`);
    if (t.layout === "long" && t.vcols.length > 1) errors.push(`Sheet <b>${esc(dataName)}</b>: ada ${t.vcols.length} kolom nilai (${t.vcols.map((j) => esc(rows[t.header][j])).join(", ")}). Satu file = satu indikator: pisahkan ke file berbeda atau hapus kolom yang tidak dipakai.`);

    const recs = [], aliasUsed = new Map(), unknown = [], notes = [];
    let pctStrings = 0;
    const parseVal = (v, line) => {
      if (v == null || String(v).trim() === "" || String(v).trim() === "-") return { empty: true };
      if (typeof v === "number") return { v };
      let s = String(v).trim(), pct = false;
      if (s.endsWith("%")) { pct = true; s = s.slice(0, -1).trim(); }
      const n = window.PraktikData.toNumber(s);
      if (n == null || Number.isNaN(n)) { errors.push(`Sheet <b>${esc(dataName)}</b> baris ${line}: nilai "${esc(v)}" bukan angka.`); return { bad: true }; }
      if (pct) pctStrings++;
      return { v: n, pct };
    };
    for (let i = t.header + 1; i < rows.length; i++) {
      const r = rows[i] || [], line = i + 1;
      const pv = r[t.pc];
      const valCells = t.layout === "long" ? [r[t.yc], ...t.vcols.map((j) => r[j])] : t.yearCols.map((j) => r[j]);
      const hasVals = valCells.some((v) => v != null && String(v).trim() !== "");
      if ((pv == null || String(pv).trim() === "") && !hasVals) continue;
      const texts = r.filter((v) => v != null && String(v).trim() !== "").map((v) => String(v).trim());
      if (texts.length && texts.every((v) => !/^[-\d.,%\s]+$/.test(v)) && texts.some((v) => NOTE_RE.test(v))) { notes.push(line); continue; }
      if (pv == null || String(pv).trim() === "") { errors.push(`Sheet <b>${esc(dataName)}</b> baris ${line}: ada nilai tetapi nama provinsi kosong.`); continue; }
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
      if (prov.nama !== String(pv).trim()) aliasUsed.set(String(pv).trim(), prov.nama);
      const push = (yearRaw, cell) => {
        const year = isYear(yearRaw);
        if (year == null) { errors.push(`Sheet <b>${esc(dataName)}</b> baris ${line}: tahun "${esc(yearRaw)}" tidak valid.`); return; }
        const p = parseVal(cell, line);
        if (p.empty || p.bad) return;
        recs.push({ year, kode: prov.kode, nama: prov.nama, v: p.v, pct: p.pct, line });
      };
      if (t.layout === "long") push(r[t.yc], r[t.vcols[0]]);
      else t.yearCols.forEach((j) => push(rows[t.header][j], r[j]));
    }
    for (const u of unknown) errors.push(`Sheet <b>${esc(dataName)}</b> baris ${u.line}: provinsi "${esc(u.text)}" tidak dikenali.` +
      (u.sug ? ` Maksudnya <b>${esc(u.sug)}</b>?` : "") + ` Perbaiki penulisannya, atau tambahkan penulisan ini ke kolom <i>alternatif</i> di data/referensi/provinsi.xlsx.`);
    if (aliasUsed.size) warnings.push(`Penulisan provinsi berbeda dari nama resmi, tetapi dikenali: ${[...aliasUsed].slice(0, 12).map(([a, b]) => `"${esc(a)}" → <b>${esc(b)}</b>`).join(", ")}${aliasUsed.size > 12 ? ", …" : ""}. Versi rapi memakai nama resmi.`);
    if (notes.length) warnings.push(`Baris ${notes.join(", ")} berisi catatan/sumber di bawah tabel dan diabaikan. Pindahkan isinya ke sheet <b>info</b> (kolom sumber).`);

    const seen = new Map();
    for (const r of recs) {
      const k = r.year + "|" + r.nama;
      if (seen.has(k)) errors.push(`${esc(r.nama)} tahun ${r.year} muncul dua kali (baris ${seen.get(k)} dan ${r.line}).`);
      else seen.set(k, r.line);
    }

    // satuan: dari sheet info, atau dikenali dari nilainya
    const infoRows = Object.entries(sheets).find(([n]) => /^info$/i.test(n));
    const infoVals = {};
    if (infoRows) for (const r of infoRows[1].slice(1)) if (r[0]) infoVals[norm(r[0]).replace(/[^a-z]/g, "")] = r[1] == null ? "" : String(r[1]).trim();
    const getInfo = (k) => infoVals[k.replace(/_/g, "")] || "";
    const vals = recs.map((r) => r.v);
    let unit = norm(getInfo("satuan"));
    const nLow = vals.filter((v) => v >= 0 && v <= 1).length, nHigh = vals.filter((v) => v > 1 && v <= 100).length, nBig = vals.filter((v) => v > 100 || v < 0).length;
    if (unit === "%") unit = "persen";
    if (!unit) unit = pctStrings ? "persen" : nBig === 0 && nLow >= nHigh ? "fraksi" : nBig === 0 && nHigh ? "persen" : "";
    if (vals.length) {
      const lo = Math.min(...vals), hi = Math.max(...vals);
      const f = (x) => x.toLocaleString("id-ID", { maximumFractionDigits: 4 });
      if (unit === "fraksi") {
        const fp = (x) => x.toLocaleString("id-ID", { maximumFractionDigits: 2 });
        const ok = vals.filter((v) => v >= 0 && v <= 1), a = Math.min(...ok), z = Math.max(...ok);   // kisaran dari nilai yang sah saja
        info.push(`Nilai berupa <b>fraksi</b> (${f(a)}–${f(z)}), akan ditampilkan sebagai persen (${fp(a * 100)}%–${fp(z * 100)}%).`);
        const over = recs.filter((r) => r.v > 1 || r.v < 0);
        if (over.length) errors.push(`Nilai berupa fraksi (0–1), tetapi ${over.length} nilai di luar 0–1: ${over.slice(0, 6).map((r) => `baris ${r.line} (${esc(r.nama)} ${r.year}: ${f(r.v)})`).join(", ")}. Kemungkinan tertulis dalam persen; samakan dengan nilai lain.`);
      } else if (unit === "persen") {
        info.push(`Nilai berupa <b>persen</b> (${f(lo)}%–${f(hi)}%).`);
        if (nLow && nHigh && nLow < nHigh) warnings.push(`${nLow} nilai antara 0 dan 1, padahal nilai lain dalam persen (mis. baris ${recs.filter((r) => r.v <= 1).slice(0, 5).map((r) => r.line).join(", ")}). Kemungkinan tertulis sebagai fraksi: periksa.`);
      } else if (nLow && nHigh) {
        warnings.push(`Satuan tidak jelas: ${nLow} nilai 0–1 dan ${nHigh} nilai di atas 1. Isi <b>satuan</b> di sheet info dan seragamkan nilainya.`);
      } else {
        info.push(`Nilai ${f(lo)}–${f(hi)}${unit ? " " + esc(getInfo("satuan")) : ""}.`);
      }
    }

    // kelengkapan & info
    const years = [...new Set(recs.map((r) => r.year))].sort();
    for (const y of years) {
      const have = new Set(recs.filter((r) => r.year === y).map((r) => r.nama));
      const miss = P.list.filter((p) => !have.has(p.nama)).map((p) => p.nama);
      if (miss.length) warnings.push(`Tahun ${y}: ${miss.length} provinsi tanpa data (${miss.slice(0, 8).map(esc).join(", ")}${miss.length > 8 ? ", …" : ""}).`);
    }
    info.push(`Tahun: ${years.join(", ") || "-"} · ${new Set(recs.map((r) => r.nama)).size} provinsi · ${recs.length} nilai.`);
    if (!infoRows) warnings.push(`Tidak ada sheet <b>info</b> (nama indikator, satuan, sumber). Versi rapi menambahkannya: lengkapi isiannya sebelum diunggah.`);
    else {
      const miss = INFO_KEYS.filter(([k]) => !getInfo(k)).map(([k]) => k);
      if (miss.length) warnings.push(`Sheet <b>info</b> belum lengkap: ${miss.map(esc).join(", ")}.`);
    }

    const ok = errors.length === 0;
    ui.show(errors, warnings, info, "", ok ? "✔ FORMAT DAPAT DIBACA (indikator per provinsi)" : null);
    const slug = (s) => norm(s).replace(/^$/, "indikator");
    const base = getInfo("nama_id") ? String(getInfo("nama_id")).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") : file.name.replace(/\.xlsx$/i, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const outName = "provinsi-" + (base.replace(/^provinsi-/, "") || slug("")) + ".xlsx";
    let extra = `<p class="hint">ℹ Indikator per provinsi <b>belum ditampilkan</b> di dashboard. Menampilkannya memerlukan pengaturan teknis satu kali; setelah itu cukup unggah file ke folder <code>data/provinsi/</code>.</p>`;
    if (ok && recs.length) extra += `<p style="margin-top:12px"><button type="button" class="btn primary" id="tidyBtn">⬇ Unduh versi rapi (${esc(outName)})</button>
      <br><small>Isi sama, susunan seragam: sheet <b>info</b> + sheet <b>data</b> (Tahun, Kode BPS, Provinsi, Nilai), nama provinsi resmi, tanpa baris judul/catatan.</small></p>`;
    ui.out.insertAdjacentHTML("beforeend", extra);
    const btn = document.getElementById("tidyBtn");
    if (btn) btn.onclick = async () => {
      const H = (v) => ({ value: v, fontWeight: "bold" });
      const infoSheet = [[H("kunci"), H("isian"), H("keterangan")], ...INFO_KEYS.map(([k, d]) => [k, (k === "satuan" ? getInfo(k) || unit : getInfo(k)) || null, d])];
      const sorted = recs.slice().sort((a, b) => a.year - b.year || (a.kode ?? 999) - (b.kode ?? 999));
      const dataSheet = [[H("Tahun"), H("Kode BPS"), H("Provinsi"), H("Nilai")], ...sorted.map((r) => [r.year, r.kode ?? null, r.nama, r.v])];
      await window.writeXlsxFile([
        { data: infoSheet, sheet: "info", columns: [{ width: 26 }, { width: 40 }, { width: 80 }], stickyRowsCount: 1 },
        { data: dataSheet, sheet: "data", columns: [{ width: 8 }, { width: 10 }, { width: 30 }, { width: 14 }], stickyRowsCount: 1 },
      ]).toFile(outName);
    };
    return true;
  }

  window.CekProvinsi = { check, norm };
})();
