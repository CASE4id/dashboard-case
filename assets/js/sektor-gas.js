/* Sektor Transmisi Gas: angka nasional dari BPS, Statistik Gas.
 * Data: data/gas/statistik-gas-TAHUN.xlsx, sheet g01–g10 (kategori × tahun), tabel, catatan. */
(function () {
  const PK = window.PK, S = window.PKS;
  const { T, esc, fmt, $, card, chartBox, empty, COLORS } = PK;
  const state = PK.state;
  const TABLES = ["g01", "g02", "g03", "g04", "g05", "g06", "g07", "g08", "g09", "g10"];
  const TOTALS = ["total", "average"];
  let D = null; // data siap pakai

  function prepare(raw) {
    const d = { tables: {}, titles: {}, notes: raw.sheets.catatan || [], years: [] };
    for (const t of TABLES) {
      const rows = raw.sheets[t] || [];
      const yearCols = (rows.header || []).filter((h) => /^\d{4}$/.test(h)).map(Number);
      d.tables[t] = { years: yearCols, rows: rows.map((r) => ({ category: r.category, label: { id: r.category_label_id || r.category, en: r.category_label_en || r.category }, unit: r.unit,
        values: Object.fromEntries(yearCols.map((y) => [y, r[String(y)] ?? null])) })) };
    }
    (raw.sheets.tabel || []).forEach((r) => (d.titles[r.table_id] = { id: r.title_id, en: r.title_en, unit: r.unit, source: r.source, note: { id: r.note_id, en: r.note_en } }));
    d.years = (d.tables.g04.years.length ? d.tables.g04 : d.tables.g03).years.slice().sort((a, b) => a - b);
    D = d;
    return d;
  }
  const row = (t, cat) => (D.tables[t] ? D.tables[t].rows.find((r) => r.category === cat) : null);
  const val = (t, cat, y) => { const r = row(t, cat); return r ? r.values[y] ?? null : null; };
  const parts = (t, exclude = []) => (D.tables[t] ? D.tables[t].rows.filter((r) => !TOTALS.includes(r.category) && !exclude.includes(r.category)) : []);
  const title = (t) => S.tr(D.titles[t]) || t.toUpperCase();
  const prevYear = (y) => { const i = D.years.indexOf(y); return i > 0 ? D.years[i - 1] : null; };
  const unitTxt = (u) => ({ customers: { id: "pelanggan", en: "customers" }, persons: { id: "orang", en: "persons" }, "IDR per MSCF": { id: "Rp/MSCF", en: "IDR/MSCF" },
    kilolitre: { id: "kiloliter", en: "kilolitres" }, "million IDR": { id: "juta Rp", en: "IDR million" } }[u] || u);
  const prelimFlag = (y) => (S.notes(D.notes, ["all"], y, { onlyYearSpecific: true }) ? T("preliminary") : "");

  /* ---------------- Ringkasan ---------------- */
  function renderSummary() {
    const y = state.year, py = prevYear(y);
    const k = (t, cat, label, unit, opts = {}) => {
      const div = opts.div || 1;
      const v = val(t, cat, y), pv = py ? val(t, cat, py) : null;
      return S.kpi({ label, value: v == null ? null : v / div, prev: pv == null ? null : pv / div, prevYear: py, unit, decimals: opts.decimals ?? 0, note: opts.note, flag: opts.flag });
    };
    const flag = prelimFlag(y);
    const idr = S.idrUnit(val("g05", "total", y));
    const idrGva = S.idrUnit(val("g10", "gross_value_added", y));
    let html = S.contextLine("Indonesia", y, T("gas_scope"));
    html += S.notes(D.notes, ["all"], y, { banner: true, onlyYearSpecific: true });
    html += `<div class="grid kpis six">
      ${k("g03", "total", T("gas_customers"), unitTxt("customers"), { flag })}
      ${k("g04", "total", T("gas_volume"), "MMSCF", { flag })}
      ${k("g05", "total", T("gas_sales_value"), idr.unit, { div: idr.div, decimals: idr.decimals, flag })}
      ${k("g06", "average", T("gas_avg_price"), unitTxt("IDR per MSCF"), { flag, note: T("gas_avg_price_note") })}
      ${k("g10", "gross_value_added", T("gas_gva"), idrGva.unit, { div: idrGva.div, decimals: idrGva.decimals, flag, note: T("gas_gva_note") })}
      ${k("g01", "total", T("gas_workers"), unitTxt("persons"), { flag })}
    </div>`;
    const cust = parts("g03"), custTotal = val("g03", "total", y);
    const custList = `<ul class="stat-list">${cust.map((r) => `<li><span>${esc(S.tr(r.label))}</span><b>${fmt(r.values[y], 0)}${custTotal && r.values[y] != null ? `<small>${r.values[y] / custTotal < 0.001 ? "&lt;0,1%".replace(",", state.lang === "en" ? "." : ",") : fmt((r.values[y] / custTotal) * 100, 1) + "%"}</small>` : ""}</b></li>`).join("")}
      <li><span><b>${esc(T("total"))}</b></span><b>${fmt(custTotal, 0)}</b></li></ul>`;
    html += `<div class="grid cols-2 mt">
      ${card(T("gas_c_volume"), T("gas_c_volume_sub"), chartBox("gVol"), "span-2")}
      ${card(T("gas_c_customers").replace("{year}", y), T("gas_c_customers_sub"), custTotal != null ? custList : empty(T("na")))}
      ${card(T("gas_c_price"), T("gas_c_price_sub"), chartBox("gPrice"), "", T("gas_avg_price_note"))}
      ${card(T("gas_c_output"), T("gas_c_output_sub"), chartBox("gOut"), "span-2", T("gas_gva_note"))}
    </div>`;
    html += S.notes(D.notes, ["all", "g03", "g04", "g05", "g06", "g10"], null);
    $("#view").innerHTML = html;

    const ys = D.years;
    S.stackedYears("gVol", ys, parts("g04").map((r) => ({ label: S.tr(r.label), values: r.values })), { unit: "MMSCF" });
    const price = parts("g06").map((r) => ({ label: S.tr(r.label), values: r.values }));
    const avg = row("g06", "average");
    if (avg) price.push({ label: S.tr(avg.label), values: avg.values, color: "#5b6b82", dashed: true });
    S.lineYears("gPrice", ys, price, { unit: unitTxt("IDR per MSCF") });
    const tri = (r) => Object.fromEntries(Object.entries(r.values).map(([yy, v]) => [yy, v == null ? null : v / 1e6]));
    S.stackedYears("gOut", ys, ["output_value", "intermediate_cost", "gross_value_added"].map((c, i) => row("g10", c)).filter(Boolean)
      .map((r, i) => ({ label: S.tr(r.label), values: tri(r), color: [COLORS.navy, COLORS.sky, COLORS.yellow][i] })), { stacked: false, unit: { id: "triliun Rp", en: "IDR trillion" }, decimals: 2 });
  }

  /* ---------------- Biaya & Tenaga Kerja ---------------- */
  function renderCost() {
    const y = state.year;
    const cost = parts("g09", ["operating_expenses"]).filter((r) => r.values[y] != null);
    const fuelQ = D.tables.g07.rows, fuelV = D.tables.g08.rows;
    const fuelList = fuelQ.length ? `<ul class="stat-list">${fuelQ.map((r) => {
      const v = (fuelV.find((x) => x.category === r.category) || {}).values;
      return `<li><span>${esc(S.tr(r.label))}</span><b>${fmt(r.values[y], 0)} <small>${esc(S.tr(unitTxt(r.unit)))}</small>${v && v[y] != null ? `<small>· ${fmt(v[y] / 1e3, 1)} ${esc(T("idr_billion"))}</small>` : ""}</b></li>`;
    }).join("")}</ul>` : empty(T("na"));
    let html = S.contextLine("Indonesia", y, T("gas_scope"));
    html += `<div class="grid cols-2">
      ${card(T("gas_c_cost").replace("{year}", y), T("gas_c_cost_sub"), cost.length ? chartBox("gCost", "tall") : empty(T("na")), "span-2")}
      ${card(T("gas_c_workers"), T("gas_c_workers_sub"), chartBox("gWork"))}
      ${card(T("gas_c_comp"), T("gas_c_comp_sub"), chartBox("gComp"))}
      ${card(T("gas_c_fuel").replace("{year}", y), T("gas_c_fuel_sub"), fuelList, "span-2")}
    </div>`;
    html += S.notes(D.notes, ["all", "g01", "g02", "g07", "g08", "g09"], null);
    $("#view").innerHTML = html;
    if (cost.length) S.hbar("gCost", cost.map((r) => ({ label: S.tr(r.label), value: r.values[y] / 1e3 })), { unit: T("idr_billion"), decimals: 1, multi: true });
    const yrs = (t) => D.tables[t].years.slice().sort((a, b) => a - b);
    S.stackedYears("gWork", yrs("g01"), parts("g01").map((r) => ({ label: S.tr(r.label), values: r.values })), { unit: unitTxt("persons") });
    S.stackedYears("gComp", yrs("g02"), parts("g02").map((r) => ({ label: S.tr(r.label), values: Object.fromEntries(Object.entries(r.values).map(([k, v]) => [k, v == null ? null : v / 1e3])) })), { unit: { id: "miliar Rp", en: "IDR billion" }, decimals: 1 });
  }

  /* ---------------- Tren & Analisis ---------------- */
  function renderTrend() {
    const groups = TABLES.map((t) => ({
      label: `${t.toUpperCase()} · ${title(t)}`,
      series: D.tables[t].rows.map((r) => ({ key: `${t}.${r.category}`, label: `${S.tr(r.label)} (${title(t)})`, unit: unitTxt(r.unit), decimals: r.unit === "MMSCF" ? 2 : 0, values: r.values })),
    }));
    const key = state.params.series || "g04.total";
    const s = S.trendView(groups, key, (k) => { state.params.series = k; PK.render(); },
      S.notes(D.notes, ["all", (state.params.series || key).split(".")[0]], null));
    state.params.series = s.key;
  }

  /* ---------------- Data & Unduh ---------------- */
  function renderData() {
    const t = TABLES.includes(state.params.table) ? state.params.table : "g03";
    state.params.table = t;
    const tb = D.tables[t], ys = tb.years.slice().sort((a, b) => a - b);
    const head = `<tr><th>${esc(T("category"))}</th><th>${esc(T("unit_col"))}</th>${ys.map((y) => `<th>${y}</th>`).join("")}</tr>`;
    const body = tb.rows.map((r) => `<tr class="${TOTALS.includes(r.category) ? "total" : ""}"><td>${esc(S.tr(r.label))}</td><td>${esc(S.tr(unitTxt(r.unit)))}</td>${ys.map((y) =>
      `<td class="num">${r.values[y] == null ? "" : fmt(r.values[y], Number.isInteger(r.values[y]) ? 0 : 2)}</td>`).join("")}</tr>`).join("");
    const meta = D.titles[t] || {};
    let html = S.contextLine(T("data_title"), "Indonesia");
    html += `<section class="card"><p class="sub">${esc(T("gas_data_sub"))}</p>
      <div class="toolbar">
        <label>${esc(T("table"))}<select id="tableSelect">${TABLES.map((x) => `<option value="${x}">${x.toUpperCase()} – ${esc(title(x))}</option>`).join("")}</select></label>
        <button class="btn primary" id="csvBtn" type="button">⬇ ${esc(T("download_csv"))}</button>
        <a class="btn" href="${esc(D.url)}" download>⬇ ${esc(T("download_xlsx"))}</a>
      </div>
      <div class="table-wrap"><table class="data"><thead>${head}</thead><tbody>${body}</tbody></table></div>
      <p class="foot">${esc(T("source_label"))}: ${esc(meta.source || "")}${S.tr(meta.note) ? " · " + esc(S.tr(meta.note)) : ""}</p>
      ${S.notes(D.notes, ["all", t], null, { open: true })}
    </section>`;
    $("#view").innerHTML = html;
    $("#tableSelect").value = t;
    $("#tableSelect").onchange = (e) => { state.params.table = e.target.value; PK.render(); };
    $("#csvBtn").onclick = () => S.downloadCsv(["category", "category_label_id", "category_label_en", "unit", ...ys.map(String)],
      tb.rows.map((r) => [r.category, r.label.id, r.label.en, r.unit, ...ys.map((y) => r.values[y])]), `praktik_gas_${t}.csv`);
  }

  PK.registerSector("gas", {
    tabs: [["summary", "tab_summary"], ["cost", "tab_gas_cost"], ["trend", "tab_trend"], ["data", "tab_data"]],
    prepare,
    years: () => D.years,
    render(tab) { ({ summary: renderSummary, cost: renderCost, trend: renderTrend, data: renderData }[tab])(); },
    hash: (tab) => (tab === "trend" ? { series: state.params.series } : tab === "data" ? { table: state.params.table } : {}),
  });
})();
