/* Data per provinsi (sektor Ketenagalistrikan), ditampilkan di tab Perbandingan dan Analisis dengan Cakupan = Provinsi.
 * Sumber:
 *  - data/provinsi/daftar-indikator.xlsx (sheet "daftar": file | tampilkan | urutan) dan file yang tercantum di sana.
 *    Setiap file berbentuk "versi rapi" dari halaman Cek Data: sheet info, indikator, data (Tahun, Kode BPS, Provinsi, Indikator, Nilai).
 *  - data/referensi/provinsi.xlsx: 38 provinsi, kode BPS, penulisan lain.
 *  - data/referensi/pln-provinsi.xlsx: unit PLN -> kode provinsi BPS (dipakai app.js untuk menyusun wilayah provinsi dari data PLN).
 * Indikator dari file provinsi menjadi pilihan "metrik" dengan kunci:
 *   p:FILE|INDIKATOR   nilai apa adanya (jumlah, fraksi, persen)
 *   ps:FILE|INDIKATOR  persentase terhadap penyebut (info: penyebut) atau terhadap jumlah semua indikator (info: komposisi = ya)
 *   pk:FILE            tampilan komposisi 100% (khusus tab Perbandingan) */
(function () {
  const PK = window.PK, S = window.PKS;
  const { T, esc, fmt, COLORS } = PK;
  const state = PK.state;
  const DIR = "data/provinsi/";
  const norm = (s) => String(s ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const normProv = (s) => norm(String(s ?? "").replace(/^\s*(provinsi|prov\.?)\s+/i, ""));
  const kv = (rows) => { const o = {}; for (const r of (rows || []).slice(1)) if (r[0] != null) o[norm(r[0])] = r[1] == null ? "" : String(r[1]).trim(); return o; };
  const isYes = (v) => ["ya", "yes"].includes(norm(v));

  const P = {
    loaded: false,
    datasets: [],
    provinces: new Map(),   // kode BPS -> nama
    unitCodes: new Map(),   // unit_id PLN -> { codes: [kode], note }
    metricList: [],
  };
  const byName = new Map(); // nama/penulisan lain (dinormalkan) -> kode

  async function readXlsx(url) {
    const res = await fetch(url, { cache: "no-cache" });
    if (!res.ok) return null;
    const blob = await res.blob();
    const head = new Uint8Array(await blob.slice(0, 2).arrayBuffer());
    return head[0] === 0x50 && head[1] === 0x4b ? blob : null;
  }
  const headerIdx = (row) => { const h = (row || []).map(norm); return (n) => h.indexOf(n); };

  async function loadReference(problems) {
    const ref = await readXlsx("data/referensi/provinsi.xlsx");
    if (ref) {
      const rows = await window.readXlsxFile(ref, { sheet: "provinsi" });
      const c = headerIdx(rows[0]);
      for (const r of rows.slice(1)) {
        const k = Number(r[c("kodebps")]);
        if (!k || !r[c("nama")]) continue;
        P.provinces.set(k, String(r[c("nama")]).trim());
        for (const n of [r[c("nama")], ...String(r[c("alternatif")] || "").split(";")]) if (String(n || "").trim()) byName.set(normProv(n), k);
      }
    } else problems.push("data/referensi/provinsi.xlsx: file tidak ditemukan");
    const map = await readXlsx("data/referensi/pln-provinsi.xlsx");
    if (map) {
      const rows = await window.readXlsxFile(map, { sheet: "pemetaan" });
      const c = headerIdx(rows[0]);
      for (const r of rows.slice(1)) {
        const u = String(r[c("unitid")] || "").trim();
        if (!u) continue;
        const codes = String(r[c("kodebps")] ?? "").split(/[;,\s]+/).map(Number).filter((k) => P.provinces.has(k));
        P.unitCodes.set(u, { codes, note: String(r[c("catatan")] || "").trim() });
      }
    } else problems.push("data/referensi/pln-provinsi.xlsx: file tidak ditemukan (Cakupan Provinsi untuk data PLN tidak dapat disusun)");
  }

  async function loadDatasets(problems) {
    const reg = await readXlsx(DIR + "daftar-indikator.xlsx");
    if (!reg) return;
    let rows;
    try { rows = await window.readXlsxFile(reg, { sheet: "daftar" }); } catch (e) { problems.push("daftar-indikator.xlsx: sheet \"daftar\" tidak terbaca"); return; }
    const c0 = headerIdx(rows[0]), fi = c0("file"), ti = c0("tampilkan"), oi = c0("urutan");
    const list = rows.slice(1).filter((r) => r[fi] && isYes(r[ti]))
      .map((r, i) => ({ file: String(r[fi]).trim(), order: Number(r[oi]) || 100 + i })).sort((a, b) => a.order - b.order);
    for (const { file } of list) {
      const blob = await readXlsx(DIR + file);
      if (!blob) { problems.push(`data/provinsi/${file}: file tidak ditemukan (tercantum di daftar-indikator.xlsx)`); continue; }
      try {
        const names = (await window.readXlsxFile(blob, { getSheets: true })).map((s) => s.name);
        const info = kv(await window.readXlsxFile(blob, { sheet: "info" }));
        const indRows = names.includes("indikator") ? await window.readXlsxFile(blob, { sheet: "indikator" }) : [[]];
        const data = await window.readXlsxFile(blob, { sheet: "data" });
        const c = headerIdx(data[0]), ic = headerIdx(indRows[0]);
        const indMeta = {};
        for (const r of indRows.slice(1)) if (r[0]) indMeta[String(r[0]).trim()] = {
          en: ic("namaen") >= 0 ? r[ic("namaen")] : null, unit: ic("satuan") >= 0 ? r[ic("satuan")] : null,
          better: ic("makintinggimakinbaik") >= 0 ? norm(r[ic("makintinggimakinbaik")]) : "" };
        const recs = [];
        for (const r of data.slice(1)) {
          if (!r[c("tahun")] || !r[c("provinsi")] || typeof r[c("nilai")] !== "number") continue;
          const prov = String(r[c("provinsi")]).trim();
          const kode = normProv(prov) === "indonesia" ? 0 : Number(r[c("kodebps")]) || byName.get(normProv(prov)) || null;
          if (kode == null) continue;
          recs.push({ year: Number(r[c("tahun")]), kode, prov, ind: String(r[c("indikator")] ?? info.judulid ?? "Nilai").trim(), v: r[c("nilai")] });
        }
        const inds = [...new Set(recs.map((r) => r.ind))];
        const ds = {
          file, title: { id: info.judulid || file, en: info.judulen || info.judulid || file },
          source: info.sumber || "", note: info.catatan || "",
          komposisi: isYes(info.komposisi) && inds.length > 1,
          penyebut: inds.includes(info.penyebut) ? info.penyebut : "",
          indicators: inds.map((name) => ({ name, en: (indMeta[name] || {}).en || name, unit: String((indMeta[name] || {}).unit || info.satuan || "").trim(), better: (indMeta[name] || {}).better || "" })),
          recs, years: [...new Set(recs.map((r) => r.year))].sort((a, b) => a - b),
          idx: new Map(recs.map((r) => [`${r.year}|${r.kode}|${r.ind}`, r.v])),
        };
        ds.get = (y, kode, ind) => { const v = ds.idx.get(`${y}|${kode}|${ind}`); return v == null ? null : v; };
        ds.yearFor = (y) => (ds.years.includes(y) ? y : ds.years.filter((x) => x <= y).pop() ?? null);
        ds.codes = (y) => [...new Set(ds.recs.filter((r) => r.year === y && r.kode).map((r) => r.kode))].sort((a, b) => a - b);
        P.datasets.push(ds);
      } catch (e) { problems.push(`data/provinsi/${file}: ${e.message}`); }
    }
  }

  /* ---------- metrik ---------- */
  const unitKind = (u) => { const n = norm(u); return n === "fraksi" ? "frac" : ["persen", "percent"].includes(n) || u === "%" ? "pct" : "abs"; };
  const betterOf = (b) => (["ya", "yes"].includes(b) ? "high" : ["tidak", "no"].includes(b) ? "low" : null);

  function makeMetrics(ds) {
    const out = [];
    const src = { id: `Sumber: ${ds.source || "-"}${ds.note ? ". " + ds.note : ""}`, en: `Source: ${ds.source || "-"}${ds.note ? ". " + ds.note : ""}` };
    const sumOf = (codes, y, ind) => { let s = 0; for (const k of codes) { const v = ds.get(y, k, ind); if (v == null) return null; s += v; } return s; };
    const base = (extra) => Object.assign({ prov: true, ds, years: ds.years, yearFor: ds.yearFor, group: ds.title, note: src }, extra);
    for (const ind of ds.indicators) {
      const kind = unitKind(ind.unit);
      const ints = ds.recs.filter((r) => r.ind === ind.name).every((r) => Number.isInteger(r.v));
      out.push(base({
        key: `p:${ds.file}|${ind.name}`, id: ind.name, en: ind.en, kind,
        unit: kind === "abs" ? ind.unit || "" : "%", decimals: kind === "abs" ? (ints ? 0 : 2) : 2,
        better: betterOf(ind.better), compareNational: kind !== "abs",
        value: (codes, y) => {
          if (kind === "abs") return sumOf(codes, y, ind.name);
          if (codes.length !== 1) return null;   // fraksi/persen tidak dapat dijumlahkan untuk gabungan provinsi
          const v = ds.get(y, codes[0], ind.name);
          return v == null ? null : kind === "frac" ? v * 100 : v;
        },
        national: (y) => { const v = ds.get(y, 0, ind.name); return v == null ? null : kind === "frac" ? v * 100 : v; },
      }));
    }
    const parts = ds.indicators.filter((i) => unitKind(i.unit) === "abs" && i.name !== ds.penyebut);
    if (ds.penyebut || ds.komposisi) {
      const den = (codes, y) => (ds.penyebut ? sumOf(codes, y, ds.penyebut)
        : parts.reduce((a, i) => { const v = sumOf(codes, y, i.name); return a == null || v == null ? null : a + v; }, 0));
      for (const ind of parts) {
        const share = (codes, y) => { const n = sumOf(codes, y, ind.name), d = den(codes, y); return n == null || !d ? null : (n / d) * 100; };
        out.push(base({
          key: `ps:${ds.file}|${ind.name}`, share: true, kind: "pct",
          id: ds.penyebut ? `${ind.name} (% dari ${ds.penyebut})` : `${ind.name} (% dari jumlah)`,
          en: ds.penyebut ? `${ind.en} (% of ${(ds.indicators.find((i) => i.name === ds.penyebut) || {}).en || ds.penyebut})` : `${ind.en} (% of total)`,
          unit: "%", decimals: 1, better: betterOf(ind.better), compareNational: true,
          value: share,
          national: (y) => { const nat = ds.get(y, 0, ind.name) != null ? [0] : ds.codes(y); return nat.length ? share(nat, y) : null; },
        }));
      }
    }
    return out;
  }

  async function load() {
    const problems = [];
    await loadReference(problems);
    await loadDatasets(problems);
    P.metricList = P.datasets.flatMap(makeMetrics);
    P.loaded = true;
    return problems;
  }

  const metric = (key) => P.metricList.find((m) => m.key === key) || null;
  const dataset = (file) => P.datasets.find((d) => d.file === file) || null;
  const tr = (o) => (state.lang === "en" ? o.en : o.id);
  const indLabel = (i) => (state.lang === "en" ? i.en : i.name);

  /* Pilihan <option> per kelompok data (untuk <select> indikator). */
  function optionsHtml(withKomposisi) {
    return P.datasets.map((ds) => {
      const ms = P.metricList.filter((m) => m.ds === ds);
      const opts = ms.map((m) => `<option value="${esc(m.key)}">${esc(PK.L(m))}</option>`).join("")
        + (withKomposisi && ds.komposisi ? `<option value="pk:${esc(ds.file)}">${esc(T("prov_composition"))}</option>` : "");
      return `<optgroup label="${esc(T("grp_provdata"))}: ${esc(tr(ds.title))}">${opts}</optgroup>`;
    }).join("");
  }

  /* Komposisi 100% per provinsi (tab Perbandingan). */
  function komposisi(ds, year, isSel, canvasId) {
    const codes = ds.codes(year);
    const val = (k, i) => ds.get(year, k, i);
    const name = (k) => P.provinces.get(k) || ds.recs.find((r) => r.kode === k).prov;
    const totals = Object.fromEntries(codes.map((k) => [k, ds.indicators.reduce((a, i) => a + (val(k, i.name) || 0), 0)]));
    const sortBy = ds.indicators.find((i) => i.name === state.params.psort) || ds.indicators[0];
    state.params.psort = sortBy.name;
    const order = codes.filter((k) => totals[k] > 0).sort((a, b) => (val(b, sortBy.name) || 0) / totals[b] - (val(a, sortBy.name) || 0) / totals[a]);
    const natTot = codes.reduce((a, k) => a + totals[k], 0);
    const natList = ds.indicators.map((i) => { const s = codes.reduce((a, k) => a + (val(k, i.name) || 0), 0); return `<li><span>${esc(indLabel(i))}</span><b>${fmt(s, 0)} <small>${fmt((s / natTot) * 100, 1)}%</small></b></li>`; }).join("");
    const html = `<div class="toolbar"><label>${esc(T("prov_sort"))}<select id="pSort">${ds.indicators.map((i) => `<option value="${esc(i.name)}"${i === sortBy ? " selected" : ""}>${esc(indLabel(i))}</option>`).join("")}</select></label></div>
      <h3>${esc(T("prov_comp_title").replace("{year}", year))}</h3><p class="sub">${esc(T("prov_comp_sub"))}</p>
      <div class="chart-box" style="height:${Math.max(320, order.length * 22 + 80)}px"><canvas id="${canvasId}"></canvas></div>
      <h3 class="mt">${esc(T("prov_sum"))}</h3><ul class="stat-list">${natList}<li><span><b>${esc(T("total"))}</b></span><b>${fmt(natTot, 0)}</b></li></ul>`;
    const draw = () => {
      PK.$("#pSort").onchange = (e) => { state.params.psort = e.target.value; PK.render(); };
      PK.makeChart(canvasId, {
        type: "bar",
        data: { labels: order.map(name), datasets: ds.indicators.map((i, k) => ({ label: indLabel(i), data: order.map((p) => ((val(p, i.name) || 0) / totals[p]) * 100),
          counts: order.map((p) => val(p, i.name)), backgroundColor: [COLORS.navy, COLORS.sky, COLORS.yellow, COLORS.green, COLORS.gold][k % 5],
          borderColor: order.map((p) => (isSel([p]) ? COLORS.bad : "transparent")), borderWidth: order.map((p) => (isSel([p]) ? 2 : 0)), stack: "s", borderRadius: 2 })) },
        options: { indexAxis: "y", plugins: { legend: { position: "bottom" },
            tooltip: { callbacks: { label: (c) => ` ${c.dataset.label}: ${fmt(c.parsed.x, 1)}% (${fmt(c.dataset.counts[c.dataIndex], 0)}${ds.indicators[c.datasetIndex].unit ? " " + ds.indicators[c.datasetIndex].unit : ""})` } } },
          scales: { x: { stacked: true, max: 100, ticks: { callback: (v) => v + "%" } }, y: { stacked: true, grid: { display: false }, ticks: { autoSkip: false } } } },
      });
    };
    return { html, draw };
  }

  /* Tabel semua indikator satu file untuk satu tahun, dengan unduhan. */
  function table(ds, year, isSel) {
    const kinds = ds.indicators.map((i) => unitKind(i.unit));
    const shown = (k, v) => (v == null ? "" : kinds[k] === "frac" ? fmt(v * 100, 2) : fmt(v, kinds[k] === "abs" && Number.isInteger(v) ? 0 : 2));
    const codes = ds.codes(year).concat(ds.recs.some((r) => r.year === year && r.kode === 0) ? [0] : []);
    const head = `<tr><th>${esc(T("prov_province"))}</th>${ds.indicators.map((i, k) => `<th>${esc(indLabel(i))}<small>${esc(kinds[k] === "abs" ? i.unit : "%")}</small></th>`).join("")}</tr>`;
    const body = codes.map((p) => `<tr class="${p === 0 ? "total" : isSel([p]) ? "selected" : ""}"><td>${esc(p === 0 ? "Indonesia" : P.provinces.get(p) || p)}</td>${ds.indicators.map((i, k) => `<td class="num">${shown(k, ds.get(year, p, i.name))}</td>`).join("")}</tr>`).join("");
    const html = `<section class="card mt"><h3>${esc(T("prov_table").replace("{year}", year))}: ${esc(tr(ds.title))}</h3>
      <div class="toolbar"><button class="btn primary" id="pCsv" type="button">⬇ ${esc(T("download_csv"))}</button>
      <a class="btn" href="${esc(DIR + ds.file)}" download>⬇ ${esc(T("download_xlsx"))}</a></div>
      <div class="table-wrap"><table class="data"><thead>${head}</thead><tbody>${body}</tbody></table></div>
      <p class="foot">${esc(T("source_label"))}: ${esc(ds.source)}${ds.note ? " · " + esc(ds.note) : ""}</p></section>`;
    const bind = () => { PK.$("#pCsv").onclick = () => S.downloadCsv(["Tahun", "Kode BPS", "Provinsi", "Indikator", "Nilai"],
      ds.recs.map((r) => [r.year, r.kode || "", r.prov, r.ind, r.v]), ds.file.replace(/\.xlsx$/, ".csv")); };
    return { html, bind };
  }

  Object.assign(P, { load, metric, dataset, optionsHtml, komposisi, table, metrics: () => P.metricList });
  window.PKP = P;
})();
