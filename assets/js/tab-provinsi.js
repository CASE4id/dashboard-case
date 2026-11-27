/* Tab "Provinsi" (sektor Ketenagalistrikan): data per provinsi dari folder data/provinsi/.
 * Daftar data yang ditampilkan: data/provinsi/daftar-indikator.xlsx (sheet "daftar": file | tampilkan | urutan).
 * Setiap file berbentuk "versi rapi" dari halaman Cek Data: sheet info, indikator, data (Tahun, Kode BPS, Provinsi, Indikator, Nilai).
 * Tab tidak muncul selama daftar kosong. */
(function () {
  const PK = window.PK, S = window.PKS;
  const { T, esc, fmt, $, card, chartBox, empty, COLORS } = PK;
  const state = PK.state;
  const DIR = "data/provinsi/";
  let DS = [];   // dataset yang ditampilkan

  const norm = (s) => String(s ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const kv = (rows) => { const o = {}; for (const r of (rows || []).slice(1)) if (r[0] != null) o[norm(r[0])] = r[1] == null ? "" : String(r[1]).trim(); return o; };

  async function readXlsx(url) {
    const res = await fetch(url, { cache: "no-cache" });
    if (!res.ok) return null;
    const blob = await res.blob();
    const head = new Uint8Array(await blob.slice(0, 2).arrayBuffer());
    return head[0] === 0x50 && head[1] === 0x4b ? blob : null;
  }

  async function load() {
    const problems = [];
    const reg = await readXlsx(DIR + "daftar-indikator.xlsx");
    if (!reg) return problems;
    let rows;
    try { rows = await window.readXlsxFile(reg, { sheet: "daftar" }); } catch (e) { return ["daftar-indikator.xlsx: sheet \"daftar\" tidak terbaca"]; }
    const h = (rows[0] || []).map(norm), fi = h.indexOf("file"), ti = h.indexOf("tampilkan"), oi = h.indexOf("urutan");
    const list = rows.slice(1).filter((r) => r[fi] && ["ya", "yes"].includes(norm(r[ti])))
      .map((r, i) => ({ file: String(r[fi]).trim(), order: Number(r[oi]) || 100 + i })).sort((a, b) => a.order - b.order);
    for (const { file } of list) {
      const blob = await readXlsx(DIR + file);
      if (!blob) { problems.push(`data/provinsi/${file}: file tidak ditemukan (tercantum di daftar-indikator.xlsx)`); continue; }
      try {
        const names = (await window.readXlsxFile(blob, { getSheets: true })).map((s) => s.name);
        const info = kv(await window.readXlsxFile(blob, { sheet: "info" }));
        const indRows = names.includes("indikator") ? await window.readXlsxFile(blob, { sheet: "indikator" }) : [[]];
        const data = await window.readXlsxFile(blob, { sheet: "data" });
        const dh = data[0].map(norm), c = (n) => dh.indexOf(n);
        const ih = (indRows[0] || []).map(norm), ic = (n) => ih.indexOf(n);
        const indMeta = {};
        for (const r of indRows.slice(1)) if (r[0]) indMeta[String(r[0]).trim()] = { en: ic("namaen") >= 0 ? r[ic("namaen")] : null, unit: ic("satuan") >= 0 ? r[ic("satuan")] : null, better: ic("makintinggimakinbaik") >= 0 ? norm(r[ic("makintinggimakinbaik")]) : "" };
        const recs = data.slice(1).filter((r) => r[c("tahun")] && r[c("provinsi")] && typeof r[c("nilai")] === "number")
          .map((r) => ({ year: Number(r[c("tahun")]), kode: r[c("kodebps")], prov: String(r[c("provinsi")]).trim(), ind: String(r[c("indikator")] ?? info.judulid ?? "Nilai").trim(), v: r[c("nilai")] }));
        const inds = [...new Set(recs.map((r) => r.ind))];
        DS.push({
          file, title: { id: info.judulid || info.namaid || file, en: info.judulen || info.namaen || info.judulid || file },
          source: info.sumber || "", note: info.catatan || "", komposisi: ["ya", "yes"].includes(norm(info.komposisi)) && inds.length > 1,
          indicators: inds.map((name) => ({ name, en: (indMeta[name] || {}).en || name, unit: String((indMeta[name] || {}).unit || info.satuan || "").trim(), better: (indMeta[name] || {}).better || "" })),
          recs, years: [...new Set(recs.map((r) => r.year))].sort((a, b) => a - b),
        });
      } catch (e) { problems.push(`data/provinsi/${file}: ${e.message}`); }
    }
    return problems;
  }

  /* ---------- tampilan nilai ---------- */
  const unitKind = (u) => { const n = norm(u); return n === "fraksi" ? "frac" : ["persen", "percent"].includes(n) || u === "%" ? "pct" : "abs"; };
  const shown = (ind, v) => (v == null ? null : unitKind(ind.unit) === "frac" ? v * 100 : v);
  const unitLabel = (ind) => (unitKind(ind.unit) === "abs" ? ind.unit : "%");
  const dec = (ind, vals) => (unitKind(ind.unit) !== "abs" ? 2 : vals.every((v) => Number.isInteger(v)) ? 0 : 2);
  const indLabel = (ind) => (state.lang === "en" ? ind.en : ind.name);
  function render() {
    const P = state.params;
    const ds = DS.find((d) => d.file === P.pds) || DS[0];
    P.pds = ds.file;
    const views = ds.indicators.map((i) => i.name).concat(ds.komposisi ? ["__komposisi"] : []);
    if (!views.includes(P.pind)) P.pind = ds.komposisi ? "__komposisi" : views[0];
    const year = ds.years.includes(Number(P.pyear)) ? Number(P.pyear) : ds.years[ds.years.length - 1];
    P.pyear = year;
    const recsY = ds.recs.filter((r) => r.year === year);
    const provs = [...new Map(recsY.filter((r) => r.prov !== "Indonesia").map((r) => [r.prov, r.kode])).entries()].sort((a, b) => (a[1] ?? 999) - (b[1] ?? 999)).map((x) => x[0]);
    const val = (prov, ind, y = year) => { const r = ds.recs.find((x) => x.year === y && x.prov === prov && x.ind === ind); return r ? r.v : null; };
    const opt = (v, l, sel) => `<option value="${esc(v)}"${v == sel ? " selected" : ""}>${esc(l)}</option>`;

    let html = S.contextLine(T("prov_title"), year, S.tr(ds.title));
    html += `<section class="card"><div class="toolbar">
      ${DS.length > 1 ? `<label>${esc(T("prov_dataset"))}<select id="pDs">${DS.map((d) => opt(d.file, S.tr(d.title), ds.file)).join("")}</select></label>` : ""}
      <label>${esc(T("prov_view"))}<select id="pInd">${ds.indicators.map((i) => opt(i.name, indLabel(i), P.pind)).join("")}${ds.komposisi ? opt("__komposisi", T("prov_composition"), P.pind) : ""}</select></label>
      <label>${esc(T("year"))}<select id="pYear">${ds.years.slice().reverse().map((y) => opt(y, y, year)).join("")}</select></label>
      ${P.pind === "__komposisi" ? `<label>${esc(T("prov_sort"))}<select id="pSort">${ds.indicators.map((i) => opt(i.name, indLabel(i), P.psort || ds.indicators[0].name)).join("")}</select></label>` : ""}
    </div>`;

    let chart = null, sub = "";
    if (P.pind === "__komposisi") {
      const totals = Object.fromEntries(provs.map((p) => [p, ds.indicators.reduce((a, i) => a + (val(p, i.name) || 0), 0)]));
      const sortBy = ds.indicators.find((i) => i.name === P.psort) || ds.indicators[0];
      P.psort = sortBy.name;
      const order = provs.filter((p) => totals[p] > 0).sort((a, b) => (val(b, sortBy.name) || 0) / totals[b] - (val(a, sortBy.name) || 0) / totals[a]);
      const natTot = provs.reduce((a, p) => a + totals[p], 0);
      const natList = ds.indicators.map((i) => { const s = provs.reduce((a, p) => a + (val(p, i.name) || 0), 0); return `<li><span>${esc(indLabel(i))}</span><b>${fmt(s, 0)} <small>${fmt((s / natTot) * 100, 1)}%</small></b></li>`; }).join("");
      html += `<h3>${esc(T("prov_comp_title").replace("{year}", year))}</h3><p class="sub">${esc(T("prov_comp_sub"))} ${esc(T("prov_click"))}</p>
        <div class="chart-box" style="height:${Math.max(320, order.length * 22 + 80)}px"><canvas id="pChart"></canvas></div>
        <h3 class="mt">${esc(T("prov_sum"))}</h3><ul class="stat-list">${natList}<li><span><b>${esc(T("total"))}</b></span><b>${fmt(natTot, 0)}</b></li></ul>`;
      chart = () => PK.makeChart("pChart", {
        type: "bar",
        data: { labels: order, datasets: ds.indicators.map((i, k) => ({ label: indLabel(i), data: order.map((p) => ((val(p, i.name) || 0) / totals[p]) * 100),
          counts: order.map((p) => val(p, i.name)), backgroundColor: [COLORS.navy, COLORS.sky, COLORS.yellow, COLORS.green, COLORS.gold][k % 5], stack: "s", borderRadius: 2 })) },
        options: { indexAxis: "y", plugins: { legend: { position: "bottom" },
            tooltip: { callbacks: { label: (c) => ` ${c.dataset.label}: ${fmt(c.parsed.x, 1)}% (${fmt(c.dataset.counts[c.dataIndex], 0)}${ds.indicators[c.datasetIndex].unit ? " " + ds.indicators[c.datasetIndex].unit : ""})` } } },
          scales: { x: { stacked: true, max: 100, ticks: { callback: (v) => v + "%" } }, y: { stacked: true, grid: { display: false }, ticks: { autoSkip: false } } },
          onClick: (_e, els) => { if (els.length) { P.pprov = order[els[0].index]; PK.render(); } } },
      });
    } else {
      const ind = ds.indicators.find((i) => i.name === P.pind);
      const items = provs.map((p) => ({ label: p, value: shown(ind, val(p, ind.name)) })).filter((d) => d.value != null);
      const asc = ind.better === "tidak" || ind.better === "no";
      items.sort((a, b) => (asc ? a.value - b.value : b.value - a.value));
      const nat = val("Indonesia", ind.name);
      if (nat != null) sub = `${T("national")}: ${fmt(shown(ind, nat), dec(ind, [nat]))} ${unitLabel(ind)}`;
      else if (unitKind(ind.unit) === "abs") sub = `${T("prov_sum")}: ${fmt(items.reduce((a, d) => a + d.value, 0), 0)} ${ind.unit}`;
      html += `<h3>${esc(T("prov_rank").replace("{ind}", indLabel(ind)).replace("{year}", year))}</h3><p class="sub">${esc(sub)}${sub ? " · " : ""}${esc(T("prov_click"))}</p>
        ${items.length ? `<div class="chart-box" style="height:${Math.max(320, items.length * 22 + 60)}px"><canvas id="pChart"></canvas></div>` : empty(T("na"))}`;
      chart = () => items.length && S.hbar("pChart", items, { unit: unitLabel(ind), decimals: dec(ind, items.map((d) => d.value)), color: COLORS.blue,
        onClick: (_e, els) => { if (els.length) { P.pprov = items[els[0].index].label; PK.render(); } } });
    }
    html += `<p class="foot">${esc(T("source_label"))}: ${esc(ds.source)}${ds.note ? " · " + esc(ds.note) : ""}</p></section>`;

    // tren provinsi terpilih
    const prov = provs.includes(P.pprov) ? P.pprov : provs[0];
    P.pprov = prov;
    html += `<div class="grid cols-2 mt">`;
    if (ds.years.length > 1) {
      html += card(T("prov_trend").replace("{prov}", prov), `${ds.years[0]}–${ds.years[ds.years.length - 1]}`, chartBox("pTrend"));
    } else {
      html += card(T("prov_trend").replace("{prov}", prov), "", `<div class="empty">${esc(T("prov_trend_one").replace("{year}", ds.years[0]))}</div>`);
    }
    // nilai provinsi terpilih
    const rowsProv = ds.indicators.map((i) => { const v = val(prov, i.name); return `<li><span>${esc(indLabel(i))}</span><b>${v == null ? "–" : fmt(shown(i, v), dec(i, [v]))} <small>${esc(unitLabel(i))}</small></b></li>`; }).join("");
    html += card(`${prov}, ${year}`, S.tr(ds.title), `<ul class="stat-list">${rowsProv}</ul>`);
    html += `</div>`;

    // tabel
    const head = `<tr><th>${esc(T("prov_province"))}</th>${ds.indicators.map((i) => `<th>${esc(indLabel(i))}<small>${esc(unitLabel(i))}</small></th>`).join("")}${ds.komposisi ? `<th>${esc(T("total"))}</th>` : ""}</tr>`;
    const body = provs.concat(recsY.some((r) => r.prov === "Indonesia") ? ["Indonesia"] : []).map((p) => {
      const vs = ds.indicators.map((i) => val(p, i.name));
      return `<tr class="${p === "Indonesia" ? "total" : p === prov ? "selected" : ""}"><td>${esc(p)}</td>${vs.map((v, k) => `<td class="num">${v == null ? "" : fmt(shown(ds.indicators[k], v), dec(ds.indicators[k], [v]))}</td>`).join("")}${ds.komposisi ? `<td class="num">${fmt(vs.reduce((a, v) => a + (v || 0), 0), 0)}</td>` : ""}</tr>`;
    }).join("");
    html += `<section class="card mt"><h3>${esc(T("prov_table").replace("{year}", year))}</h3>
      <div class="toolbar"><button class="btn primary" id="pCsv" type="button">⬇ ${esc(T("download_csv"))}</button>
      <a class="btn" href="${esc(DIR + ds.file)}" download>⬇ ${esc(T("download_xlsx"))}</a></div>
      <div class="table-wrap"><table class="data"><thead>${head}</thead><tbody>${body}</tbody></table></div>
      <p class="foot">${esc(T("prov_map"))}</p></section>`;
    $("#view").innerHTML = html;

    if ($("#pDs")) $("#pDs").onchange = (e) => { P.pds = e.target.value; P.pind = null; PK.render(); };
    $("#pInd").onchange = (e) => { P.pind = e.target.value; PK.render(); };
    $("#pYear").onchange = (e) => { P.pyear = Number(e.target.value); PK.render(); };
    if ($("#pSort")) $("#pSort").onchange = (e) => { P.psort = e.target.value; PK.render(); };
    $("#pCsv").onclick = () => S.downloadCsv(["Tahun", "Kode BPS", "Provinsi", "Indikator", "Nilai"],
      ds.recs.map((r) => [r.year, r.kode, r.prov, r.ind, r.v]), ds.file.replace(/\.xlsx$/, ".csv"));
    chart && chart();
    if (ds.years.length > 1) {
      const series = ds.komposisi && P.pind === "__komposisi"
        ? ds.indicators.map((i, k) => ({ label: indLabel(i), values: Object.fromEntries(ds.years.map((y) => [y, val(prov, i.name, y)])), color: [COLORS.navy, COLORS.sky, COLORS.yellow, COLORS.green][k % 4] }))
        : [ds.indicators.find((i) => i.name === P.pind)].map((i) => ({ label: indLabel(i), values: Object.fromEntries(ds.years.map((y) => [y, shown(i, val(prov, i.name, y))])), color: COLORS.blue }));
      S.lineYears("pTrend", ds.years, series, { decimals: 2 });
    }
  }

  PK.registerElecTab({
    key: "provinces", label: "tab_provinces",
    available: () => DS.length > 0,
    load,
    render,
    hash: () => { const P = state.params; return { pds: P.pds, pind: P.pind, pyear: P.pyear, pprov: P.pprov, psort: P.psort }; },
  });
})();
