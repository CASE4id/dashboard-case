/* Sektor Kedirgantaraan (transportasi udara): BPS, Statistik Transportasi Udara.
 * Data: data/udara/statistik-udara-TAHUN.xlsx, sheet a01–a06 (baris per tahun), tabel, kamus, catatan. */
(function () {
  const PK = window.PK, S = window.PKS;
  const { T, esc, fmt, $, card, chartBox, empty, COLORS } = PK;
  const state = PK.state;
  const TABLES = ["a01", "a02", "a03", "a04", "a05", "a06"];
  const FT = ["domestic", "international"];
  let D = null;

  function prepare(raw) {
    const s = raw.sheets;
    const d = { t: {}, titles: {}, dict: {}, notes: s.catatan || [] };
    TABLES.forEach((t) => (d.t[t] = s[t] || []));
    (s.tabel || []).forEach((r) => (d.titles[r.table_id] = { id: r.title_id, en: r.title_en, source: r.source }));
    (s.kamus || []).forEach((r) => (d.dict[r.table_id + "." + r.column] = r));
    d.years = [...new Set(d.t.a01.map((r) => r.year).filter(Boolean))].sort((a, b) => a - b);
    D = d;
    return d;
  }
  const prevYear = (y) => { const i = D.years.indexOf(y); return i > 0 ? D.years[i - 1] : null; };
  const title = (t) => S.tr(D.titles[t]) || t.toUpperCase();
  const label = (t, c) => { const k = D.dict[t + "." + c]; return k ? (state.lang === "en" ? k.label_en : k.label_id) || c : c; };
  const unitOf = (t, c) => (D.dict[t + "." + c] || {}).unit || "";
  const ftLabel = (f) => T(f === "domestic" ? "domestic" : f === "international" ? "international" : "all_flights");

  /* a01: jumlah ukuran (measure) untuk tahun y, disaring jenis penerbangan / arah (null = semua) */
  function a01(y, measure, ft = null, dir = null) {
    const rows = D.t.a01.filter((r) => r.year === y && (!ft || r.flight_type === ft) && (!dir || r.direction === dir));
    if (!rows.length || rows.every((r) => r[measure] == null)) return null;
    return rows.reduce((a, r) => a + (r[measure] || 0), 0);
  }
  const a03 = (y, ft, ind) => { const r = D.t.a03.find((x) => x.year === y && x.flight_type === ft && x.indicator === ind); return r ? r.value : null; };
  const a04 = (y, c) => { const r = D.t.a04.find((x) => x.year === y); return r ? r[c] ?? null : null; };
  const byYear = (fn) => Object.fromEntries(D.years.map((y) => [y, fn(y)]));

  /* ---------------- Ringkasan ---------------- */
  function renderSummary() {
    const y = state.year, py = prevYear(y);
    const k = (label, fn, unit, opts = {}) => S.kpi({ label, value: fn(y), prev: py ? fn(py) : null, prevYear: py, unit, decimals: opts.decimals ?? 0, note: opts.note, sub: opts.sub });
    const mil = (v) => (v == null ? null : v / 1e6);
    let html = S.contextLine("Indonesia", y, T("air_scope"));
    html += S.notes(D.notes, ["all"], y, { banner: true, onlyYearSpecific: true });
    html += `<div class="grid kpis six">
      ${k(T("air_pax_dom"), (yy) => mil(a01(yy, "passengers", "domestic", "departure")), { id: "juta orang", en: "million" }, { decimals: 2, note: T("air_pax_note") })}
      ${k(T("air_pax_intl"), (yy) => mil(a01(yy, "passengers", "international", "departure")), { id: "juta orang", en: "million" }, { decimals: 2, note: T("air_pax_note") })}
      ${k(T("air_movements"), (yy) => a01(yy, "aircraft"), { id: "pergerakan", en: "movements" }, { note: T("air_movements_note") })}
      ${k(T("air_cargo"), (yy) => a01(yy, "cargo_ton"), { id: "ton", en: "tonnes" }, { note: T("air_cargo_note") })}
      ${k(T("air_lf_dom"), (yy) => a03(yy, "domestic", "passenger_load_factor"), "%", { decimals: 2, note: T("air_lf_note") })}
      ${k(T("air_fleet"), (yy) => a04(yy, "total"), { id: "pesawat", en: "aircraft" }, { note: T("air_fleet_note") })}
    </div>`;
    html += `<div class="grid cols-2 mt">
      ${card(T("air_c_pax"), T("air_c_pax_sub"), chartBox("uPax"))}
      ${card(T("air_c_mov"), T("air_c_mov_sub"), chartBox("uMov"))}
      ${card(T("air_c_lf"), T("air_c_lf_sub"), chartBox("uLf"))}
      ${card(T("air_c_cap"), T("air_c_cap_sub"), chartBox("uCap"))}
      ${card(T("air_c_cargo"), T("air_c_cargo_sub"), chartBox("uCargo"))}
      ${card(T("air_c_fleet"), T("air_c_fleet_sub"), chartBox("uFleet"))}
    </div>`;
    html += S.notes(D.notes, ["all", "a01", "a03", "a04"], null);
    $("#view").innerHTML = html;
    const ys = D.years;
    const ftSeries = (measure, dir, div = 1) => FT.map((f, i) => ({ label: ftLabel(f), values: byYear((yy) => { const v = a01(yy, measure, f, dir); return v == null ? null : v / div; }), color: [COLORS.navy, COLORS.sky][i] }));
    S.stackedYears("uPax", ys, ftSeries("passengers", "departure", 1e6), { unit: { id: "juta orang", en: "million" }, decimals: 2 });
    S.stackedYears("uMov", ys, ftSeries("aircraft", null, 1e3), { unit: { id: "ribu pergerakan", en: "thousand movements" }, decimals: 1 });
    S.lineYears("uLf", ys, FT.map((f, i) => ({ label: ftLabel(f), values: byYear((yy) => a03(yy, f, "passenger_load_factor")), color: [COLORS.navy, COLORS.sky][i] })), { unit: "%", decimals: 2, beginAtZero: false });
    S.stackedYears("uCap", ys, [
      { label: T("air_seat_km"), values: byYear((yy) => a03(yy, "domestic", "seat_km")), color: COLORS.sky },
      { label: T("air_pax_km"), values: byYear((yy) => a03(yy, "domestic", "passenger_km")), color: COLORS.navy },
    ], { stacked: false, unit: { id: "juta km", en: "million km" } });
    S.stackedYears("uCargo", ys, ftSeries("cargo_ton", null, 1e3), { unit: { id: "ribu ton", en: "thousand tonnes" }, decimals: 1 });
    S.stackedYears("uFleet", ys, ["aoc_121", "aoc_135", "oc91_aoc137_psc141_fasi"].map((c, i) => ({ label: label("a04", c), values: byYear((yy) => a04(yy, c)), color: [COLORS.navy, COLORS.sky, COLORS.yellow][i] })), { unit: { id: "pesawat", en: "aircraft" } });
  }

  /* ---------------- Bandara & Provinsi ---------------- */
  const MEASURES = {
    pax: { id: "Penumpang (datang + berangkat)", en: "Passengers (arrivals + departures)", unit: { id: "orang", en: "persons" }, cols: ["passengers_arrivals", "passengers_departures"], div: 1 },
    aircraft: { id: "Pergerakan pesawat (datang + berangkat)", en: "Aircraft movements (arrivals + departures)", unit: { id: "pergerakan", en: "movements" }, cols: ["aircraft_arrivals", "aircraft_departures"], div: 1 },
    cargo: { id: "Kargo (bongkar + muat)", en: "Cargo (unloaded + loaded)", unit: { id: "ton", en: "tonnes" }, cols: ["cargo_kg_unloaded", "cargo_kg_loaded"], div: 1000 },
  };
  const mval = (r, m, scope = "all") => {
    const pre = scope === "all" ? ["dom", "intl"] : [scope];
    let t = 0, any = false;
    for (const p of pre) for (const c of MEASURES[m].cols) { const v = r[p + "_" + c]; if (v != null) { t += v; any = true; } }
    return any ? t / MEASURES[m].div : null;
  };

  function renderAirports() {
    const avail = [...new Set(D.t.a06.map((r) => r.year))].sort((a, b) => a - b);
    const y = avail.includes(state.year) ? state.year : avail[avail.length - 1];
    const m = MEASURES[state.params.measure] ? state.params.measure : "pax";
    state.params.measure = m;
    const provs = D.t.a06.filter((r) => r.year === y && r.row_type === "province").map((r) => ({ label: r.province, value: mval(r, m) })).filter((d) => d.value != null).sort((a, b) => b.value - a.value);
    const nat = D.t.a06.find((r) => r.year === y && r.row_type !== "province");
    const top = D.t.a02.filter((r) => r.year === (D.t.a02.some((x) => x.year === state.year) ? state.year : Math.max(...D.t.a02.map((x) => x.year))));
    const topYear = top.length ? top[0].year : null;
    const majors = [...new Set(top.filter((r) => r.airport_role === "major_airport").map((r) => r.airport))];

    let html = S.contextLine(T("air_airports_title"), y, T("air_airports_meta"));
    if (y !== state.year) html += `<div class="banner warn">${esc(T("air_year_fallback").replace("{year}", y).replace("{sel}", state.year))}</div>`;
    html += `<section class="card"><p class="sub">${esc(T("air_prov_sub"))}</p>
      <div class="toolbar"><label>${esc(T("measure"))}<select id="measureSelect">${Object.entries(MEASURES).map(([k, v]) => `<option value="${k}">${esc(S.tr(v))}</option>`).join("")}</select></label></div>
      <h3>${esc(T("air_c_prov").replace("{measure}", S.tr(MEASURES[m])).replace("{year}", y))}</h3>
      ${nat ? `<p class="sub">${esc(T("national"))}: <b>${fmt(mval(nat, m), 0)}</b> ${esc(S.tr(MEASURES[m].unit))}</p>` : ""}
      ${provs.length ? `<div class="chart-box" style="height:${Math.max(320, provs.length * 22 + 60)}px"><canvas id="uProv"></canvas></div>` : empty(T("na"))}
    </section>`;
    html += `<div class="grid cols-2 mt">
      ${card(T("air_c_top").replace("{year}", topYear || ""), T("air_c_top_sub"), majors.length ? chartBox("uTop") : empty(T("na")), "span-2")}
    </div>`;
    html += `<section class="card mt"><h3>${esc(T("air_c_airports").replace("{year}", y))}</h3><p class="sub">${esc(T("air_c_airports_sub"))}</p>
      <div class="toolbar"><input class="search" id="aptSearch" type="search" placeholder="${esc(T("air_search"))}" value="${esc(state.params.q || "")}"><span class="meta" id="aptCount"></span></div>
      <div class="table-wrap"><table class="data"><thead><tr><th>${esc(T("air_airport"))}</th><th>${esc(label("a05", "regency_city"))}</th><th>${esc(label("a05", "province"))}</th>
        <th>${esc(T("air_pax_total"))}<small>${esc(T("persons"))}</small></th><th>${esc(T("air_intl_pax"))}<small>${esc(T("persons"))}</small></th>
        <th>${esc(T("air_movements_short"))}</th><th>${esc(T("air_cargo_short"))}<small>ton</small></th></tr></thead><tbody id="aptBody"></tbody></table></div>
      <p class="foot">${esc(T("air_map_note"))}</p>
    </section>`;
    html += S.notes(D.notes, ["all", "a02", "a05", "a06"], null);
    $("#view").innerHTML = html;
    $("#measureSelect").value = m;
    $("#measureSelect").onchange = (e) => { state.params.measure = e.target.value; PK.render(); };

    if (provs.length) S.hbar("uProv", provs, { unit: MEASURES[m].unit, color: COLORS.blue });
    if (majors.length) PK.makeChart("uTop", {
      type: "bar",
      data: { labels: majors, datasets: FT.map((f, i) => ({ label: ftLabel(f), data: majors.map((a) => { const r = top.find((x) => x.airport === a && x.flight_type === f); return r ? r.passenger_departures : null; }), backgroundColor: [COLORS.navy, COLORS.sky][i], borderRadius: 3, stack: "s" })) },
      options: { indexAxis: "y", plugins: { legend: { position: "bottom" } }, scales: { x: { stacked: true, ticks: PK.numTicks }, y: { stacked: true, grid: { display: false } } } },
    });

    const apts = D.t.a05.filter((r) => r.year === y).map((r) => ({ r, pax: mval(r, "pax"), ipax: mval(r, "pax", "intl"), mov: mval(r, "aircraft"), cargo: mval(r, "cargo") }))
      .sort((a, b) => (b.pax || 0) - (a.pax || 0));
    const draw = () => {
      const q = (state.params.q || "").toLowerCase().trim();
      const list = q ? apts.filter((a) => [a.r.airport_name, a.r.regency_city, a.r.province].some((x) => String(x || "").toLowerCase().includes(q))) : apts;
      const shown = q ? list : list.slice(0, 30);
      $("#aptBody").innerHTML = shown.map((a) => `<tr><td>${esc(a.r.airport_name)}${a.r.has_international_traffic === "true" ? ` <span class="chip">${esc(T("intl_short"))}</span>` : ""}</td><td>${esc(a.r.regency_city)}</td><td>${esc(a.r.province)}</td>
        <td class="num">${fmt(a.pax, 0)}</td><td class="num">${a.ipax == null ? "" : fmt(a.ipax, 0)}</td><td class="num">${fmt(a.mov, 0)}</td><td class="num">${fmt(a.cargo, 1)}</td></tr>`).join("");
      $("#aptCount").textContent = T(q ? "air_found" : "air_top_shown").replace("{n}", shown.length).replace("{total}", apts.length);
    };
    draw();
    $("#aptSearch").oninput = (e) => { state.params.q = e.target.value; draw(); };
  }

  /* ---------------- Tren & Analisis ---------------- */
  function renderTrend() {
    const MEAS = [["passengers", { id: "orang", en: "persons" }], ["aircraft", { id: "pergerakan", en: "movements" }], ["cargo_ton", "ton"], ["baggage_ton", "ton"], ["mail_ton", "ton"]];
    const groups = [];
    for (const [mc, unit] of MEAS) {
      groups.push({ label: `${label("a01", mc)} (${T("arr_dep")})`, series: [null, ...FT].map((f) => ({
        key: `a01.${mc}.${f || "all"}`, label: `${label("a01", mc)} · ${ftLabel(f)}`, unit, decimals: 0, values: byYear((yy) => a01(yy, mc, f)) })) });
    }
    const inds = [...new Map(D.t.a03.map((r) => [r.indicator, r])).values()];
    groups.push({ label: title("a03"), series: inds.flatMap((r) => FT.map((f) => ({
      key: `a03.${r.indicator}.${f}`, label: `${state.lang === "en" ? r.indicator_label_en : r.indicator_label_id} · ${ftLabel(f)}`, unit: r.unit, decimals: r.unit === "%" ? 2 : 0, values: byYear((yy) => a03(yy, f, r.indicator)) }))) });
    groups.push({ label: title("a04"), series: ["aoc_121", "aoc_135", "oc91_aoc137_psc141_fasi", "total"].map((c) => ({
      key: `a04.${c}`, label: label("a04", c), unit: { id: "pesawat", en: "aircraft" }, decimals: 0, values: byYear((yy) => a04(yy, c)) })) });
    const key = state.params.series || "a01.passengers.all";
    const s = S.trendView(groups, key, (k) => { state.params.series = k; PK.render(); }, S.notes(D.notes, ["all", (state.params.series || key).split(".")[0]], null));
    state.params.series = s.key;
  }

  /* ---------------- Data & Unduh ---------------- */
  function renderData() {
    const t = TABLES.includes(state.params.table) ? state.params.table : "a01";
    state.params.table = t;
    const rows = D.t[t];
    const cols = (rows.header || Object.keys(rows[0] || {})).filter((c) => c);
    const isNum = (c) => rows.some((r) => typeof r[c] === "number") && c !== "year" && c !== "airport_no";
    const head = `<tr>${cols.map((c) => `<th>${esc(label(t, c))}${unitOf(t, c) ? `<small>${esc(unitOf(t, c))}</small>` : ""}</th>`).join("")}</tr>`;
    const body = rows.map((r) => `<tr class="${r.row_type === "national_total" || r.airport_role === "total" ? "total" : ""}">${cols.map((c) =>
      isNum(c) ? `<td class="num">${r[c] == null ? "" : fmt(r[c], Number.isInteger(r[c]) ? 0 : 2)}</td>` : `<td>${esc(r[c] ?? "")}</td>`).join("")}</tr>`).join("");
    let html = S.contextLine(T("data_title"), "Indonesia");
    html += `<section class="card"><p class="sub">${esc(T("air_data_sub"))}</p>
      <div class="toolbar">
        <label>${esc(T("table"))}<select id="tableSelect">${TABLES.map((x) => `<option value="${x}">${x.toUpperCase()} – ${esc(title(x))}</option>`).join("")}</select></label>
        <button class="btn primary" id="csvBtn" type="button">⬇ ${esc(T("download_csv"))}</button>
        <a class="btn" href="${esc(D.url)}" download>⬇ ${esc(T("download_xlsx"))}</a>
      </div>
      <div class="table-wrap"><table class="data"><thead>${head}</thead><tbody>${body}</tbody></table></div>
      <p class="foot">${esc(T("source_label"))}: ${esc((D.titles[t] || {}).source || "")}</p>
      ${S.notes(D.notes, ["all", t], null, { open: true })}
    </section>`;
    $("#view").innerHTML = html;
    $("#tableSelect").value = t;
    $("#tableSelect").onchange = (e) => { state.params.table = e.target.value; PK.render(); };
    $("#csvBtn").onclick = () => S.downloadCsv(cols, rows.map((r) => cols.map((c) => r[c])), `praktik_udara_${t}.csv`);
  }

  PK.registerSector("udara", {
    tabs: [["summary", "tab_summary"], ["airports", "tab_airports"], ["trend", "tab_trend"], ["data", "tab_data"]],
    prepare,
    years: () => D.years,
    render(tab) { ({ summary: renderSummary, airports: renderAirports, trend: renderTrend, data: renderData }[tab])(); },
    hash: (tab) => (tab === "trend" ? { series: state.params.series } : tab === "data" ? { table: state.params.table } : tab === "airports" ? { measure: state.params.measure } : {}),
  });
})();
