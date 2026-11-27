/* Dashboard PraKTIk — logika tampilan / rendering logic */
(function () {
  const CFG = window.DASHBOARD_CONFIG;
  const PT = window.PLANT_TYPES;
  const IND = Object.fromEntries(window.INDICATORS.map((i) => [i.key, i]));
  const NATIONAL = "indonesia";

  const COLORS = {
    navy: "#0a2f6b", blue: "#1557b0", sky: "#2fa8e0", yellow: "#f7c948", green: "#2e9e4f", gold: "#c9992f",
    grey: "#9aa5b1", good: "#1e8e4e", bad: "#c8382a",
    plant: {
      hydro: "#0b6e99", mini_hydro: "#2e9fd0", micro_hydro: "#8fd0ec", geothermal: "#c9992f",
      solar: "#f7c948", wind: "#7fc8a9", biomass: "#2e9e4f",
      steam: "#4a3b35", combined_cycle: "#8a6f62", gas: "#b0413e", gas_engine: "#e07a5f", diesel: "#9aa5b1",
    },
  };

  const state = { sector: "listrik", lang: "id", year: null, unit: NATIONAL, tab: "summary", indicator: "electrification_ratio", scope: "units", table: "t01",
    amode: "xy", ax: "electrification_ratio", ay: "avg_sold_household", alog: "", atrend: "1", abase: "", y1: null, y2: null, params: {} };
  const SECTORS = window.SECTORS;
  const MODULES = {}; // sektor lain (gas, udara) mendaftar lewat PK.registerSector
  const sectorCfg = () => SECTORS.find((x) => x.key === state.sector) || SECTORS[0];
  const ELEC_TABS = [["summary", "tab_summary"], ["generation", "tab_generation"], ["network", "tab_network"], ["compare", "tab_compare"], ["analysis", "tab_analysis"], ["data", "tab_data"]];
  let db = null;
  const charts = [];

  /* ---------- helpers ---------- */
  const $ = (s, el = document) => el.querySelector(s);
  const T = (k) => (window.I18N[state.lang][k] ?? window.I18N.id[k] ?? k);
  const L = (o) => (o == null ? "" : typeof o === "string" ? o : o[state.lang] ?? o.id);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const locale = () => (state.lang === "en" ? "en-US" : "id-ID");
  function fmt(n, d = 0) {
    if (n == null || !isFinite(n)) return "–";
    return new Intl.NumberFormat(locale(), { minimumFractionDigits: d, maximumFractionDigits: d }).format(n);
  }
  function fmtAuto(n) {
    if (n == null) return "–";
    const a = Math.abs(n);
    if (Number.isInteger(n) || a >= 100) return fmt(n, 0);
    return fmt(n, a >= 10 ? 1 : 2);
  }
  /* Label sumbu ringkas dan seragam mulai 1.000: 5.000 -> "5 rb" / "5K", 2.500.000 -> "2,5 jt" / "2.5M" */
  function fmtTick(v) {
    if (Math.abs(v) >= 1000) return new Intl.NumberFormat(locale(), { notation: "compact", maximumFractionDigits: 1 }).format(v);
    return fmtAuto(v);
  }
  const unitName = (id) => (db.units.get(id) || {}).unit_name || id;
  const sum = (arr) => arr.reduce((a, b) => a + (b || 0), 0);

  function indValue(ind, unit, year) {
    if (ind.value) return ind.value(db, unit, year);
    return db.value(ind.table, ind.column, unit, year);
  }
  function prevYear(y) { const i = db.years.indexOf(y); return i > 0 ? db.years[i - 1] : null; }

  /* ---------- URL state ---------- */
  function readHash() {
    const p = new URLSearchParams(location.hash.slice(1));
    for (const k of ["sector", "lang", "unit", "tab", "indicator", "scope", "table", "amode", "ax", "ay", "alog", "atrend", "abase", "y1", "y2"]) if (p.get(k)) state[k] = p.get(k);
    if (p.get("year")) state.year = Number(p.get("year"));
    if (!SECTORS.some((x) => x.key === state.sector)) state.sector = "listrik";
    state.params = Object.fromEntries(p.entries());
    if (state.tab === "provinces") {   // tautan lama ke tab Provinsi (sekarang bagian dari Perbandingan)
      const P = state.params;
      state.tab = "compare"; state.scope = "provinces";
      if (P.pds) state.indicator = !P.pind || P.pind === "__komposisi" ? "pk:" + P.pds : `p:${P.pds}|${P.pind}`;
    }
  }
  function writeHash() {
    if (state.sector !== "listrik") {
      const p = new URLSearchParams({ sector: state.sector, tab: state.tab, year: state.year, lang: state.lang });
      const m = MODULES[state.sector];
      if (m && m.hash) for (const [k, v] of Object.entries(m.hash(state.tab) || {})) if (v != null && v !== "") p.set(k, v);
      history.replaceState(null, "", "#" + p.toString());
      return;
    }
    const p = new URLSearchParams({ tab: state.tab, unit: state.unit, year: state.year, lang: state.lang });
    const extra = ELEC_EXTRA.find((x) => x.key === state.tab);
    if (extra && extra.hash) for (const [k, v] of Object.entries(extra.hash() || {})) if (v != null && v !== "") p.set(k, v);
    if (state.tab === "compare") { p.set("indicator", state.indicator); p.set("scope", state.scope); }
    if (state.tab === "data") p.set("table", state.table);
    if (state.tab === "analysis") {
      p.set("amode", state.amode);
      if (state.amode === "xy") { p.set("ax", state.ax); p.set("ay", state.ay); p.set("scope", state.scope); if (state.alog) p.set("alog", state.alog); if (state.atrend === "0") p.set("atrend", "0"); if (state.abase) p.set("abase", state.abase); }
      else { p.set("indicator", state.indicator); p.set("scope", state.scope); p.set("y1", state.y1); p.set("y2", state.y2); }
    }
    history.replaceState(null, "", "#" + p.toString());
  }

  /* ---------- Static UI text ---------- */
  function applyStaticText() {
    document.documentElement.lang = state.lang;
    document.querySelectorAll("[data-i18n]").forEach((el) => (el.textContent = T(el.dataset.i18n)));
    document.querySelectorAll(".lang-toggle button").forEach((b) => b.setAttribute("aria-pressed", b.dataset.lang === state.lang));
    const sc = sectorCfg();
    $("#sourceText").textContent = L(sc.source || CFG.source);
    $("#subtitle").textContent = L(sc.subtitle);
    document.querySelectorAll("#sectorNav button").forEach((b) => { b.textContent = L(SECTORS.find((x) => x.key === b.dataset.sector)); b.setAttribute("aria-pressed", b.dataset.sector === state.sector); });
    $("#contactEmail").textContent = CFG.contact.email;
    $("#contactEmail").href = "mailto:" + CFG.contact.email;
    $("#contactIg").textContent = "@" + CFG.contact.instagram;
    $("#contactIg").href = "https://www.instagram.com/" + CFG.contact.instagram;
    if (CFG.staffLinks) {
      $("#guideLink").href = CFG.staffLinks.guide;
      $("#checkerLink").href = CFG.staffLinks.checker;
    }
    const ys = sectorYears();
    $("#yearsText").textContent = ys.length ? T("years_available") + ": " + yearRange(ys) : "";
  }

  /* ---------- Filters ---------- */
  const GROUPS = [
    ["grp_national", ["national_total", "regional_total"]],
    ["grp_distribution", ["distribution_unit", "regional_unit", "subsidiary"]],
    ["grp_province", ["province"]],
    ["grp_generation", ["generation_unit", "generation_subsidiary", "generation_projects", "generation_transmission_unit"]],
    ["grp_transmission", ["transmission_dispatch_unit", "transmission_unit"]],
    ["grp_other", ["construction_unit", "project_component", "other"]],
  ];
  /* Unit yang punya data pada tahun tertentu (nama & susunan unit PLN berubah antartahun). */
  const presentCache = new Map();
  function unitsPresent(y) {
    if (!presentCache.has(y)) {
      const set = new Set();
      for (const rows of Object.values(db.tables)) rows.forEach((r) => { if (r.year === y) set.add(r.unit_id); });
      presentCache.set(y, set);
    }
    return presentCache.get(y);
  }
  const sectorYears = () => (state.sector === "listrik" ? (db ? db.years : []) : MODULES[state.sector] && MODULES[state.sector].data ? MODULES[state.sector].years() : []);
  function yearRange(ys) {
    const consecutive = ys.every((y, i) => i === 0 || y === ys[i - 1] + 1);
    return consecutive && ys.length > 2 ? `${ys[0]}–${ys[ys.length - 1]}` : ys.join(", ");
  }
  function fillFilters() {
    const ys = $("#yearSelect");
    ys.innerHTML = sectorYears().slice().reverse().map((y) => `<option value="${y}">${y}</option>`).join("");
    ys.value = state.year;
    ys.disabled = false;
    const us = $("#unitSelect");
    us.closest("label").style.display = state.sector === "listrik" ? "" : "none";
    if (state.sector !== "listrik") return;
    const present = unitsPresent(state.year);
    const units = [...db.units.values()].filter((u) => present.has(u.unit_id) || u.unit_id === state.unit);
    // Indonesia first, then units sheet order
    units.sort((a, b) => (a.unit_id === NATIONAL ? -1 : b.unit_id === NATIONAL ? 1 : 0));
    us.innerHTML = GROUPS.map(([label, types]) => {
      const opts = units.filter((u) => types.includes(u.row_type))
        .map((u) => `<option value="${esc(u.unit_id)}">${esc(u.unit_name)}</option>`).join("");
      return opts ? `<optgroup label="${esc(T(label))}">${opts}</optgroup>` : "";
    }).join("");
    us.value = state.unit;
    ys.disabled = us.disabled = false;
  }

  /* ---------- Charts ---------- */
  Chart.defaults.font.family = getComputedStyle(document.body).fontFamily;
  Chart.defaults.color = "#5b6b82";
  Chart.defaults.plugins.legend.labels.usePointStyle = true;
  Chart.defaults.plugins.legend.labels.boxWidth = 8;
  Chart.defaults.maintainAspectRatio = false;
  const narrow = () => window.innerWidth < 760;
  Chart.defaults.plugins.tooltip.callbacks.label = function (ctx) {
    const v = ctx.parsed && typeof ctx.parsed === "object" ? (ctx.chart.options.indexAxis === "y" ? ctx.parsed.x : ctx.parsed.y) : ctx.parsed;
    const label = ctx.dataset.label || ctx.label || "";
    return ` ${label}: ${fmtAuto(v)}`;
  };

  function destroyCharts() { while (charts.length) charts.pop().destroy(); }
  function makeChart(canvasId, cfg) {
    const el = document.getElementById(canvasId);
    if (!el) return null;
    const c = new Chart(el, cfg);
    charts.push(c);
    return c;
  }
  const numTicks = { callback: (v) => fmtTick(v), maxRotation: 0 };
  const logTicks = { callback: (v) => (Math.log10(v) % 1 === 0 ? fmtTick(v) : null), maxRotation: 0 };

  /* Tampilkan angka di ujung batang (grafik batang horizontal) */
  /* Digambar paling akhir (afterDraw) dengan latar putih tipis, agar tidak tertimpa garis nasional. */
  const barValuePlugin = {
    id: "barValues",
    afterDraw(chart, _a, opts) {
      if (!opts || !opts.enabled) return;
      const { ctx } = chart;
      const nl = chart.options.plugins.nationalLine;
      const lineX = nl && nl.value != null && chart.scales.x ? chart.scales.x.getPixelForValue(nl.value) : null;
      ctx.save();
      ctx.font = "600 11px " + Chart.defaults.font.family;
      ctx.fillStyle = "#12213a"; ctx.textBaseline = "middle";
      chart.data.datasets.forEach((ds, i) => {
        chart.getDatasetMeta(i).data.forEach((bar, j) => {
          const v = ds.data[j];
          if (v == null) return;
          const txt = (opts.signed && v > 0 ? "+" : "") + (opts.decimals != null ? fmt(v, opts.decimals) : fmtAuto(v)) + (opts.suffix || "");
          const w = ctx.measureText(txt).width;
          let inside, x;
          if (v >= 0) {
            inside = bar.x + w + 8 > chart.chartArea.right;
            /* Jika label di luar batang akan menabrak garis nasional, pindahkan ke dalam batang. */
            if (!inside && lineX != null && lineX > bar.x && lineX < bar.x + w + 12 && bar.x - bar.base > w + 12) inside = true;
            x = inside ? bar.x - 6 : bar.x + 6;
            ctx.textAlign = inside ? "right" : "left";
          } else {
            inside = bar.x - w - 8 < chart.chartArea.left;
            if (!inside && lineX != null && lineX < bar.x && lineX > bar.x - w - 12 && bar.base - bar.x > w + 12) inside = true;
            if (inside && bar.base - bar.x < w + 12) {
              /* batang negatif terlalu pendek untuk label di dalam: tulis di kanan garis nol */
              inside = false; x = bar.base + 6; ctx.textAlign = "left";
            } else {
              x = inside ? bar.x + 6 : bar.x - 6;
              ctx.textAlign = inside ? "left" : "right";
            }
          }
          ctx.lineJoin = "round"; ctx.lineWidth = 4;
          ctx.strokeStyle = inside ? "rgba(18,33,58,0.35)" : "rgba(255,255,255,0.95)";
          ctx.strokeText(txt, x, bar.y);
          ctx.fillStyle = inside ? "#fff" : "#12213a";
          ctx.fillText(txt, x, bar.y);
        });
      });
      ctx.restore();
    },
  };
  Chart.register(barValuePlugin);
  const gridless = { grid: { display: false } };

  function card(title, sub, body, cls = "", foot = "") {
    return `<section class="card ${cls}"><h3>${esc(title)}</h3>${sub ? `<p class="sub">${esc(sub)}</p>` : ""}${body}${foot ? `<p class="foot">${esc(foot)}</p>` : ""}</section>`;
  }
  const chartBox = (id, cls = "") => `<div class="chart-box ${cls}"><canvas id="${id}"></canvas></div>`;
  const empty = (msg) => `<div class="empty">${esc(msg || T("na_unit"))}</div>`;

  /* ---------- KPI card ---------- */
  function kpiCard(key) {
    const ind = IND[key];
    const v = indValue(ind, state.unit, state.year);
    const unit = L(ind.unit);
    const isNat = state.unit === NATIONAL;
    let cls = "", compare = "";
    if (v != null && !isNat && ind.compareNational !== false) {
      const nat = indValue(ind, NATIONAL, state.year);
      if (nat != null) {
        let badge = "";
        if (ind.better) {
          const better = ind.better === "high" ? v >= nat : v <= nat;
          cls = better ? "good" : "bad";
          badge = `<span class="badge">${esc(better ? T("better") : T("worse"))}</span>`;
        }
        compare = `<div class="compare">${esc(T("national"))}: ${fmt(nat, ind.decimals)} ${badge}</div>`;
      }
    }
    const py = prevYear(state.year);
    if (v != null && py) {
      const pv = indValue(ind, state.unit, py);
      if (pv != null) {
        const d = v - pv;
        const arrow = Math.abs(d) < Math.pow(10, -ind.decimals) / 2 ? "＝" : d > 0 ? "▲" : "▼";
        compare += `<div class="compare">${arrow} ${fmt(Math.abs(d), ind.decimals)} ${esc(T("vs_prev"))} ${py}</div>`;
      }
    }
    const notes = db.notes
      .filter((n) => n.unit_id === state.unit && n.indicator === (ind.column || ind.key) && (n.year == null || n.year === state.year))
      .map((n) => `<div class="alert">⚠ ${esc(state.lang === "en" ? n.note_en || n.note_id : n.note_id || n.note_en)}</div>`).join("");
    const valueHtml = v == null
      ? `<div class="na">${esc(T("na"))}</div>`
      : `<div class="value">${fmt(v, ind.decimals)}<span class="unit">${esc(unit)}</span></div>`;
    return `<section class="card kpi ${cls}"><div class="label">${esc(L(ind))}</div>${valueHtml}${compare}${notes}${ind.note ? `<div class="note">${esc(L(ind.note))}</div>` : ""}</section>`;
  }

  /* Nama unit seperti tertulis di laporan tahun itu, jika berbeda dari nama sekarang. */
  function reportedName(u, y) {
    for (const t of Object.keys(db.tables)) {
      const r = db.row(t, u, y);
      if (r && r.unit_name_reported) return r.unit_name_reported.trim() !== (r.unit_name || "").trim() ? r.unit_name_reported : "";
    }
    return "";
  }

  /* Catatan kualitas data (dari sheet kualitas_data): perubahan definisi, kesalahan sumber, dsb. */
  function qualityNotes({ tables, columns = null, yFrom, yTo, units = null }) {
    const split = (v) => String(v || "").split(";").map((x) => x.trim()).filter(Boolean);
    const colMatch = (cols) => !columns || !cols.length || cols.some((c) => columns.some((p) => new RegExp("^" + p.replace(/\*/g, ".*") + "$").test(c)));
    const list = (db.quality || []).filter((n) => {
      if (!split(n.table_id).some((t) => t === "all" || tables.includes(t))) return false;
      if (!colMatch(split(n.indicator))) return false;
      const ys = split(n.years).map(Number).filter((y) => !isNaN(y)); // "all" = semua tahun
      if (ys.length && !ys.some((y) => y >= yFrom && y <= yTo)) return false;
      const us = split(n.unit_id);
      if (units && us.length && !us.some((u) => u.startsWith("all")) && !us.some((u) => units.includes(u))) return false;
      return true;
    });
    if (!list.length) return "";
    return `<details class="quality mt"><summary>ℹ ${esc(T("quality_title"))} (${list.length})</summary><p class="sub">${esc(T("quality_sub"))}</p><ul>${list.map((n) =>
      `<li><b>${esc(String(n.years || "").replace(/;/g, ", "))}${n.table_id ? " · " + esc(String(n.table_id).replace(/;/g, ", ").toUpperCase()) : ""}</b>: ${esc(n.issue)}${n.action_taken ? ` <i>${esc(n.action_taken)}</i>` : ""}</li>`).join("")}</ul></details>`;
  }

  /* ---------- Context line ---------- */
  function contextLine() {
    const u = db.units.get(state.unit) || {};
    const bits = [];
    if (u.region) bits.push(`${T("region")}: ${u.region}`);
    if (u.parent_unit_id) bits.push(`${T("part_of")}: ${unitName(u.parent_unit_id)}`);
    const rep = reportedName(state.unit, state.year);
    if (rep) bits.push(`${T("name_reported").replace("{year}", state.year)}: ${rep}`);
    const localNote = ["distribution_unit", "regional_unit", "province", "subsidiary"].includes(u.row_type) && ["summary", "generation"].includes(state.tab)
      ? `<div class="banner warn">${esc(T("local_capacity_note"))}</div>` : "";
    return localNote + `<div class="context-line"><h2>${esc(unitName(state.unit))}</h2><span class="chip">${state.year}</span>${bits.length ? `<span class="meta">${esc(bits.join(" · "))}</span>` : ""}</div>`;
  }

  /* ======================= TAB: SUMMARY ======================= */
  function ownershipData(u, y) {
    const r = db.row("t21", u, y);
    if (!r) return null;
    let fossil = 0, ebt = 0;
    PT.forEach((p) => { const v = r[p.key + "_mw"] || 0; if (p.ebt) ebt += v; else fossil += v; });
    const vals = [fossil, ebt, r.leased_mw || 0, r.ipp_mw || 0];
    return sum(vals) > 0 ? vals : null;
  }

  function renderSummary() {
    const u = state.unit, y = state.year;
    const t01 = db.row("t01", u, y);
    const own = ownershipData(u, y);
    const t08 = db.row("t08", u, y);
    const t19 = db.row("t19", u, y);
    const sold = [
      ["households_kwh"], ["business_kwh"], ["industry_kwh"], ["social_kwh"], ["gov_office_kwh"], ["street_lighting_kwh"], ["others_tcl_kwh"],
    ].map(([c]) => ({ c, v: t08 ? t08[c] : null })).filter((d) => d.v);

    let html = contextLine();
    html += `<div class="grid kpis">${window.SUMMARY_CARDS.map(kpiCard).join("")}</div>`;
    html += `<div class="grid cols-2 mt">`;
    html += card(T("c_power_balance"), T("c_power_balance_sub"), t01 ? chartBox("cPower") : empty(), "", T("c_power_balance_foot"));
    html += card(T("c_ownership"), T("c_ownership_sub"), own ? chartBox("cOwn") : empty());
    html += card(T("c_avg_sold"), T("c_avg_sold_sub"), sold.length ? chartBox("cSold") : empty());
    let cust = empty();
    if (t19) {
      cust = `<ul class="stat-list">
        <li><span>${esc(T("households"))}</span><b>${fmt((t19.households_thousand ?? t19.households) * 1000, 0)}</b></li>
        <li><span>${esc(T("hh_customers"))}</span><b>${fmt(t19.household_customers, 0)}</b></li>
        <li><span>${esc(T("ratio"))}</span><b>${fmt(t19.electrification_ratio_pct, 2)}%</b></li></ul>`;
    }
    html += card(T("c_customers"), "", cust);
    html += `</div>`;
    $("#view").innerHTML = html;

    if (t01) makeChart("cPower", {
      type: "bar",
      data: {
        labels: [T("installed"), T("derated"), T("peak")],
        datasets: [{ data: [t01.installed_capacity_mw, t01.power_capacity_mw, t01.peak_load_mw], backgroundColor: [COLORS.navy, COLORS.sky, COLORS.yellow], borderRadius: 6, maxBarThickness: 90 }],
      },
      options: { plugins: { legend: { display: false } }, scales: { y: { ticks: numTicks }, x: gridless } },
    });
    if (own) makeChart("cOwn", {
      type: "doughnut",
      data: { labels: [T("own_fossil"), T("own_ebt"), T("leased"), T("ipp")], datasets: [{ data: own, backgroundColor: ["#6b4f45", COLORS.green, COLORS.yellow, COLORS.blue], borderWidth: 2 }] },
      options: {
        cutout: "62%",
        plugins: {
          legend: { position: narrow() ? "bottom" : "right" },
          tooltip: { callbacks: { label: (c) => ` ${c.label}: ${fmtAuto(c.parsed)} MW (${fmt((c.parsed / sum(own)) * 100, 1)}%)` } },
        },
      },
    });
    if (sold.length) makeChart("cSold", {
      type: "bar",
      data: { labels: sold.map((d) => db.label("t08", d.c, state.lang)), datasets: [{ data: sold.map((d) => d.v), backgroundColor: sold.map((d) => (d.c === "households_kwh" ? COLORS.yellow : COLORS.blue)), borderRadius: 4 }] },
      options: { indexAxis: "y", plugins: { legend: { display: false } }, scales: { x: { type: "logarithmic", ticks: logTicks }, y: gridless } },
    });
  }

  /* ======================= TAB: GENERATION ======================= */
  function renderGeneration() {
    const u = state.unit, y = state.year;
    const t21 = db.row("t21", u, y);
    const t23 = db.row("t23", u, y);
    const cap = t21 ? PT.map((p) => ({ p, v: t21[p.key + "_mw"] || 0 })).filter((d) => d.v > 0) : [];
    const prod = t23 ? PT.map((p) => ({ p, own: t23["own_" + p.key + "_gwh"] || 0, leased: t23["leased_" + p.key + "_gwh"] || 0 })).filter((d) => d.own + d.leased > 0) : [];
    const ownSum = t23 ? sum(PT.map((p) => t23["own_" + p.key + "_gwh"])) : 0;
    const leaseSum = t23 ? sum(PT.map((p) => t23["leased_" + p.key + "_gwh"])) : 0;
    const src = t23 ? [ownSum, leaseSum, t23.purchased_gwh || 0, t23.project_gwh || 0] : null;
    const fe = cap.length ? [sum(cap.filter((d) => !d.p.ebt).map((d) => d.v)), sum(cap.filter((d) => d.p.ebt).map((d) => d.v))] : null;

    let html = contextLine();
    html += `<div class="grid kpis">${["installed_capacity", "peak_load", "reserve_margin", "ebt_share"].map(kpiCard).join("")}</div>`;
    html += `<div class="grid cols-3 mt">`;
    html += card(T("c_capacity_type"), T("c_capacity_type_sub"), cap.length ? chartBox("cCap") : empty(T("na_generation_hint")), "span-2");
    html += card(T("c_fossil_ebt"), T("c_fossil_ebt_sub"), fe ? chartBox("cFE") : empty(T("na_generation_hint")), "", L(IND.ebt_share.note));
    html += card(T("c_production_type"), T("c_production_type_sub"), prod.length ? chartBox("cProd") : empty(T("na_generation_hint")), "span-2");
    html += card(T("c_production_source"), T("c_production_source_sub"), src && sum(src) > 0 ? chartBox("cSrc") : empty(T("na_generation_hint")));
    html += `</div>`;
    $("#view").innerHTML = html;

    const typeLabel = (p) => `${p.id}${state.lang === "en" ? " – " + p.en : ""}`;
    if (cap.length) {
      cap.sort((a, b) => b.v - a.v);
      makeChart("cCap", {
        type: "bar",
        data: { labels: cap.map((d) => typeLabel(d.p)), datasets: [{ label: "MW", data: cap.map((d) => d.v), backgroundColor: cap.map((d) => COLORS.plant[d.p.key]), borderRadius: 4 }] },
        options: { indexAxis: "y", plugins: { legend: { display: false } }, scales: { x: { ticks: numTicks }, y: gridless } },
      });
    }
    if (fe) makeChart("cFE", {
      type: "doughnut",
      data: { labels: [T("fossil"), T("ebt")], datasets: [{ data: fe, backgroundColor: ["#6b4f45", COLORS.green], borderWidth: 2 }] },
      options: { cutout: "62%", plugins: { legend: { position: "bottom" }, tooltip: { callbacks: { label: (c) => ` ${c.label}: ${fmt((c.parsed / sum(fe)) * 100, 1)}% (${fmtAuto(c.parsed)} MW)` } } } },
    });
    if (prod.length) {
      prod.sort((a, b) => b.own + b.leased - (a.own + a.leased));
      makeChart("cProd", {
        type: "bar",
        data: {
          labels: prod.map((d) => typeLabel(d.p)),
          datasets: [
            { label: T("own_production"), data: prod.map((d) => d.own), backgroundColor: prod.map((d) => COLORS.plant[d.p.key]), borderRadius: 4, stack: "s" },
            { label: T("leased_production"), data: prod.map((d) => d.leased), backgroundColor: COLORS.yellow, borderRadius: 4, stack: "s" },
          ],
        },
        options: { indexAxis: "y", plugins: { legend: { display: prod.some((d) => d.leased > 0) } }, scales: { x: { stacked: true, ticks: numTicks }, y: { stacked: true, grid: { display: false } } } },
      });
    }
    if (src && sum(src) > 0) makeChart("cSrc", {
      type: "doughnut",
      data: { labels: [T("own_production"), T("leased_production"), T("purchased"), T("project")], datasets: [{ data: src, backgroundColor: [COLORS.navy, COLORS.yellow, COLORS.sky, COLORS.gold], borderWidth: 2 }] },
      options: { cutout: "62%", plugins: { legend: { position: "bottom" }, tooltip: { callbacks: { label: (c) => ` ${c.label}: ${fmtAuto(c.parsed)} GWh (${fmt((c.parsed / sum(src)) * 100, 1)}%)` } } } },
    });
  }

  /* ======================= TAB: NETWORK ======================= */
  function renderNetwork() {
    const u = state.unit, y = state.year;
    const t02 = db.row("t02", u, y), t28 = db.row("t28", u, y), t29 = db.row("t29", u, y), t30 = db.row("t30", u, y);
    const tx = t28 ? ["kv_25_30_kms", "kv_70_kms", "kv_150_kms", "kv_275_kms", "kv_500_kms"].map((c) => ({ c, v: t28[c] })).filter((d) => d.v) : [];
    const dx = t29 ? ["mv_6_7kv_kms", "mv_10_12kv_kms", "mv_15_20kv_kms", "lv_kms"].map((c) => ({ c, v: t29[c] })).filter((d) => d.v) : [];
    const volt = ["500", "275", "150", "70", "lt30"];
    const sx = t30 ? volt.map((k) => ({ k, units: t30[`kv_${k}_units`], mva: t30[`kv_${k}_mva`] })).filter((d) => d.units || d.mva) : [];
    const losses = t02 ? [
      [T("transformer_losses"), t02.transformer_losses_pct],
      [T("transmission_losses"), t02.transmission_losses_pct],
      [T("distribution_losses"), t02.distribution_losses_pct],
    ] : [];
    const hasLoss = losses.some((l) => l[1]);

    let html = contextLine();
    html += `<div class="grid kpis">${["distribution_losses", "energy_losses", "saidi", "saifi"].map(kpiCard).join("")}</div>`;
    html += `<div class="grid cols-2 mt">`;
    html += card(T("c_losses"), T("c_losses_sub"), hasLoss ? chartBox("cLoss", "short") : empty());
    let flow = empty();
    if (t02) {
      const rows = [
        ["own_production_gwh"], ["leased_gwh"], ["purchased_gwh"], ["project_gwh"], ["received_other_unit_gwh"],
        ["net_production_gwh"], ["transfer_distribution_gwh"], ["energy_losses_gwh"], ["energy_consumption_gwh"],
      ].filter(([c]) => t02[c] != null);
      flow = `<ul class="stat-list">${rows.map(([c]) => `<li><span>${esc(db.label("t02", c, state.lang))}</span><b>${fmt(t02[c], 2)}</b></li>`).join("")}</ul>`;
    }
    html += card(T("c_energy_flow"), T("c_energy_flow_sub"), flow);
    html += card(T("c_transmission"), T("c_transmission_sub"), tx.length ? chartBox("cTx", "short") : empty(T("na_network_hint")), "", t28 && t28.total_kms ? `${T("total")}: ${fmt(t28.total_kms, 2)} kms` : "");
    html += card(T("c_distribution"), T("c_distribution_sub"), dx.length ? chartBox("cDx", "short") : empty(), "", dx.length ? `${T("total")}: ${fmt(sum(dx.map((d) => d.v)), 2)} kms` : "");
    html += card(T("c_substation"), T("c_substation_sub"), sx.length ? chartBox("cSx") : empty(T("na_network_hint")), "span-2",
      t30 && t30.kv_total_units ? `${T("total")}: ${fmt(t30.kv_total_units, 0)} ${T("units_label").toLowerCase()} · ${fmt(t30.kv_total_mva, 0)} MVA` : "");
    html += `</div>`;
    $("#view").innerHTML = html;

    if (hasLoss) makeChart("cLoss", {
      type: "bar",
      data: { labels: losses.map((l) => l[0]), datasets: [{ label: "%", data: losses.map((l) => l[1] || 0), backgroundColor: [COLORS.gold, COLORS.sky, COLORS.bad], borderRadius: 6, maxBarThickness: 70 }] },
      options: { plugins: { legend: { display: false } }, scales: { y: { ticks: numTicks }, x: gridless } },
    });
    if (tx.length) makeChart("cTx", {
      type: "bar",
      data: { labels: tx.map((d) => db.label("t28", d.c, state.lang)), datasets: [{ label: "kms", data: tx.map((d) => d.v), backgroundColor: COLORS.navy, borderRadius: 4 }] },
      options: { indexAxis: "y", plugins: { legend: { display: false } }, scales: { x: { ticks: numTicks }, y: gridless } },
    });
    if (dx.length) makeChart("cDx", {
      type: "bar",
      data: { labels: dx.map((d) => db.label("t29", d.c, state.lang)), datasets: [{ label: "kms", data: dx.map((d) => d.v), backgroundColor: dx.map((d) => (d.c === "lv_kms" ? COLORS.yellow : COLORS.green)), borderRadius: 4 }] },
      options: { indexAxis: "y", plugins: { legend: { display: false } }, scales: { x: { ticks: numTicks }, y: gridless } },
    });
    if (sx.length) makeChart("cSx", {
      type: "bar",
      data: {
        labels: sx.map((d) => (d.k === "lt30" ? "<30 kV" : d.k + " kV")),
        datasets: [
          { label: T("capacity_mva"), data: sx.map((d) => d.mva || 0), backgroundColor: COLORS.blue, borderRadius: 4, yAxisID: "y" },
          { label: T("units_label"), data: sx.map((d) => d.units || 0), backgroundColor: COLORS.yellow, borderRadius: 4, yAxisID: "y1" },
        ],
      },
      options: {
        plugins: { legend: { position: "top" } },
        scales: {
          y: { position: "left", ticks: numTicks, title: { display: true, text: "MVA" } },
          y1: { position: "right", ticks: numTicks, grid: { display: false }, title: { display: true, text: T("units_label") } },
          x: gridless,
        },
      },
    });
  }

  /* Pindah ke unit lain. Ditunda sebentar agar Chart.js selesai memproses klik sebelum grafik dihapus. */
  const goUnit = (id, tab) => setTimeout(() => {
    state.unit = id; if (tab) state.tab = tab;
    $("#unitSelect").value = id; render();
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  /* ======================= WILAYAH PROVINSI ======================= */
  /* Metrik = indikator PLN (window.INDICATORS) atau indikator data per provinsi (assets/js/data-provinsi.js). */
  const PKP = () => window.PKP || { loaded: false, unitCodes: new Map(), provinces: new Map(), metric: () => null, dataset: () => null, optionsHtml: () => "", metrics: () => [] };
  const metric = (key) => IND[key] || PKP().metric(key) || null;
  const metricTable = (m) => m.table || (m.uses ? m.uses[0].split(".")[0] : null);
  const provScope = () => state.scope === "provinces";
  const metricOptions = (withKomposisi) => `<optgroup label="${esc(T("grp_pln"))}">${window.INDICATORS.map((i) => `<option value="${i.key}">${esc(L(i))}</option>`).join("")}</optgroup>${PKP().optionsHtml(withKomposisi)}`;

  const presentCacheT = new Map();
  function presentIn(t, y) {
    const k = t + "|" + y;
    if (!presentCacheT.has(k)) presentCacheT.set(k, new Set((db.tables[t] || []).filter((r) => r.year === y).map((r) => r.unit_id)));
    return presentCacheT.get(k);
  }
  /* Cakupan provinsi setiap unit PLN pada satu tabel & tahun.
     Unit yang dirinci PLN (punya baris provinsi di bawahnya) diganti rinciannya; baris yang cakupannya memuat
     baris lain yang lebih sempit (mis. Papua sebelum/sesudah pemekaran) dikurangi cakupan baris itu. */
  function coverage(t, y) {
    const map = PKP().unitCodes;
    const all = [...presentIn(t, y)].filter((u) => map.has(u) && map.get(u).codes.length);
    const hasChild = new Set(all.map((u) => (db.units.get(u) || {}).parent_unit_id).filter(Boolean));
    const leaves = all.filter((u) => !hasChild.has(u));
    const full = (u) => new Set(map.get(u).codes);
    const cov = new Map(all.map((u) => [u, full(u)])), leafSet = new Set();
    for (const u of leaves) {
      const s = full(u);
      for (const v of leaves) if (v !== u) { const o = full(v); if (o.size < s.size && [...o].every((c) => s.has(c))) o.forEach((c) => s.delete(c)); }
      if (s.size) { cov.set(u, s); leafSet.add(u); } else cov.delete(u);
    }
    return { t, y, cov, leaves: leafSet };
  }
  /* Wilayah bersama untuk beberapa pasangan [tabel, tahun]: provinsi tunggal bila semua tabel merinci,
     selain itu gabungan provinsi (mis. Kalimantan Timur + Kalimantan Utara). */
  function areasFor(pairs) {
    const mk = (codes, units) => {
      const unit = Object.values(units)[0] || null;
      const name = codes.length > 3 && unit ? `${unitName(unit)} (${codes.length} ${T("provinces_n")})` : codes.map((c) => PKP().provinces.get(c) || c).join(" + ");
      return { id: codes.join("-"), codes, units, name, unit };
    };
    if (!pairs.length) return [...PKP().provinces.keys()].sort((a, b) => a - b).map((k) => mk([k], {}));
    const covs = pairs.map(([t, y]) => coverage(t, y));
    const parent = new Map();
    const add = (c) => { if (!parent.has(c)) parent.set(c, c); };
    const find = (c) => { while (parent.get(c) !== c) c = parent.get(c); return c; };
    const union = (a, b) => { add(a); add(b); const ra = find(a), rb = find(b); if (ra !== rb) parent.set(ra, rb); };
    for (const cv of covs) for (const u of cv.leaves) { const s = [...cv.cov.get(u)]; s.forEach((c) => union(s[0], c)); }
    const comps = () => { const m = new Map(); for (const c of parent.keys()) { const r = find(c); if (!m.has(r)) m.set(r, []); m.get(r).push(c); } return [...m.values()]; };
    const eq = (set, arr) => set.size === arr.length && arr.every((c) => set.has(c));
    for (let guard = 0; guard < 20; guard++) {
      let changed = false;
      for (const comp of comps()) for (const cv of covs) {
        if ([...cv.cov.values()].some((s) => eq(s, comp))) continue;
        let best = null;
        for (const s of cv.cov.values()) if (comp.every((c) => s.has(c)) && (!best || s.size < best.size)) best = s;
        if (best) { best.forEach((c) => union(comp[0], c)); changed = true; }
      }
      if (!changed) break;
    }
    return comps().map((codes) => {
      codes.sort((a, b) => a - b);
      const units = {};
      for (const cv of covs) for (const [u, s] of cv.cov) if (eq(s, codes)) { units[cv.t + "|" + cv.y] = u; break; }
      return mk(codes, units);
    }).sort((a, b) => a.codes[0] - b.codes[0]);
  }
  /* Titik/batang yang dibandingkan: unit PLN, atau wilayah provinsi bila Cakupan = Provinsi. */
  function targets(ms, years) {
    if (!provScope()) return scopeUnits().map((u) => ({ id: u.unit_id, name: u.unit_name, unit: u.unit_id, codes: [] }));
    const pairs = [];
    for (const m of ms) if (!m.prov) for (const y of years) if (y != null) pairs.push([metricTable(m), y]);
    return areasFor(pairs);
  }
  function mval(m, tg, y) {
    if (y == null) return null;
    if (m.prov) return provScope() ? m.value(tg.codes, y) : null;
    if (!provScope()) return indValue(m, tg.unit, y);
    const u = tg.units[metricTable(m) + "|" + y];
    return u ? indValue(m, u, y) : null;
  }
  const mnat = (m, y) => (y == null ? null : m.prov ? m.national(y) : indValue(m, NATIONAL, y));
  /* Tahun data provinsi yang dipakai untuk tahun terpilih (tahun yang sama, atau tahun terakhir sebelumnya). */
  const myear = (m, y) => (m.prov ? m.yearFor(y) : y);
  function isSelected(tg) {
    if (!provScope()) return tg.unit === state.unit;
    if (tg.unit && tg.unit === state.unit) return true;
    const sel = (PKP().unitCodes.get(state.unit) || {}).codes || [];
    return sel.length > 0 && tg.codes.every((c) => sel.includes(c));
  }
  /* Catatan di bawah grafik cakupan provinsi: tahun data provinsi, catatan wilayah, unit PLN yang belum dipetakan. */
  function provFoot(ms, tgs, years) {
    if (!provScope()) return "";
    const out = [];
    for (const m of ms) if (m.prov) for (const y of years) {
      const my = m.yearFor(y);
      if (my !== y) out.push(my == null ? T("prov_no_year").replace("{title}", L(m.group)).replace("{year}", y) : T("prov_year_note").replace("{title}", L(m.group)).replace("{y}", y).replace("{y2}", my));
    }
    if (ms.some((m) => !m.prov)) {
      out.push(T("prov_scope_note"));
      const map = PKP().unitCodes, notes = new Map(), unmapped = new Set();
      for (const tg of tgs) for (const u of Object.values(tg.units)) { const n = (map.get(u) || {}).note; if (n) notes.set(n, [...(notes.get(n) || []), tg.name]); }
      for (const m of ms) if (!m.prov) for (const y of years) for (const u of presentIn(metricTable(m), y)) {
        const ut = (db.units.get(u) || {}).row_type;
        if (["distribution_unit", "regional_unit", "province", "subsidiary"].includes(ut) && !map.has(u)) unmapped.add(unitName(u));
      }
      for (const [n, names] of notes) out.push([...new Set(names)].join(", ") + ": " + n);
      if (unmapped.size) out.push(T("prov_unmapped").replace("{list}", [...unmapped].join(", ")));
    }
    return out.length ? `<ul class="foot-list">${[...new Set(out)].map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : "";
  }

  /* ======================= TAB: COMPARE ======================= */
  const nationalLinePlugin = {
    id: "nationalLine",
    afterDatasetsDraw(chart, _a, opts) {
      if (opts.value == null) return;
      const { ctx, chartArea, scales } = chart;
      const x = scales.x.getPixelForValue(opts.value);
      if (x < chartArea.left || x > chartArea.right) return;
      ctx.save();
      ctx.strokeStyle = COLORS.navy; ctx.setLineDash([5, 4]); ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(x, chartArea.top); ctx.lineTo(x, chartArea.bottom); ctx.stroke();
      ctx.setLineDash([]); ctx.fillStyle = COLORS.navy; ctx.font = "600 12px " + Chart.defaults.font.family;
      ctx.textAlign = x > chartArea.right - 120 ? "right" : "left";
      ctx.fillText(`${opts.label}: ${opts.signed && opts.value > 0 ? "+" : ""}${fmt(opts.value, opts.decimals)}${opts.suffix || ""}`, x + (ctx.textAlign === "left" ? 6 : -6), chartArea.top - 8);
      ctx.restore();
    },
  };

  function renderCompare() {
    const P = PKP();
    const kds = state.indicator.startsWith("pk:") ? P.dataset(state.indicator.slice(3)) : null;
    const ind = kds ? null : metric(state.indicator) || IND.electrification_ratio;
    if (ind) state.indicator = ind.key;
    const ds = kds || (ind.prov ? ind.ds : null);
    const yr = ds ? ds.yearFor(state.year) : state.year;
    const scopeOK = !ds || provScope();
    const tgs = scopeOK && ind && yr != null ? targets([ind], [yr]) : [];
    const rows = tgs.map((tg) => ({ tg, v: mval(ind, tg, yr) })).filter((d) => d.v != null);
    if (ind) rows.sort((a, b) => (ind.better === "low" ? a.v - b.v : b.v - a.v));
    const nat = ind && ind.compareNational !== false ? mnat(ind, yr) : null;
    const clickable = rows.some((d) => d.tg.unit);

    let html = `<div class="context-line"><h2>${esc(T("compare_title"))}</h2><span class="chip">${yr ?? state.year}</span></div>`;
    html += `<section class="card"><p class="sub">${esc(T(provScope() ? "compare_sub_prov" : "compare_sub"))}</p>
      <div class="toolbar">
        <label>${esc(T("indicator"))}<select id="indSelect">${metricOptions(true)}</select></label>
        ${scopeSelectHtml()}
      </div>`;
    let draw = null;
    if (!scopeOK) html += empty(T("prov_only"));
    else if (yr == null) html += empty(T("prov_no_year").replace("{title}", L(ds.title)).replace("{year}", state.year));
    else if (kds) { const k = P.komposisi(kds, yr, (codes) => isSelected({ codes, unit: null }), "cRank"); html += k.html; draw = k.draw; }
    else html += rows.length ? `<div class="chart-box" style="height:${Math.max(320, rows.length * 26 + 60)}px"><canvas id="cRank"></canvas></div>` : empty();
    if (ind && ind.note && scopeOK) html += `<p class="foot">${esc(L(ind.note))}</p>`;
    if (scopeOK) html += provFoot(ind ? [ind] : [{ prov: true, group: kds.title, yearFor: kds.yearFor }], tgs, [state.year]);
    html += `</section>`;
    const tbl = ds && provScope() && yr != null ? P.table(ds, yr, (codes) => isSelected({ codes, unit: null })) : null;
    if (tbl) html += tbl.html;
    html += `<section class="map-placeholder mt"><h3>🗺 ${esc(T("map_title"))}</h3><p>${esc(T("map_body"))}</p></section>`;
    $("#view").innerHTML = html;
    $("#indSelect").value = state.indicator;
    $("#scopeSelect").value = state.scope;
    $("#indSelect").onchange = (e) => { state.indicator = e.target.value; render(); };
    $("#scopeSelect").onchange = (e) => { state.scope = e.target.value; render(); };
    if (tbl) tbl.bind();
    if (draw) return draw();
    if (!rows.length) return;
    const color = (d) => {
      if (isSelected(d.tg)) return COLORS.yellow;
      if (!ind.better || nat == null) return COLORS.blue;
      const better = ind.better === "high" ? d.v >= nat : d.v <= nat;
      return better ? COLORS.good : COLORS.bad;
    };
    makeChart("cRank", {
      type: "bar",
      plugins: [nationalLinePlugin],
      data: {
        labels: rows.map((d) => d.tg.name),
        datasets: [{ label: `${L(ind)}${L(ind.unit) ? ` (${L(ind.unit)})` : ""}`, data: rows.map((d) => d.v), backgroundColor: rows.map(color), borderRadius: 4 }],
      },
      options: {
        indexAxis: "y",
        layout: { padding: { top: 18 } },
        plugins: { legend: { display: false }, nationalLine: { value: nat, label: T("national_line"), decimals: ind.decimals }, barValues: { enabled: true, decimals: ind.decimals } },
        scales: { x: { ticks: numTicks }, y: { grid: { display: false }, ticks: { autoSkip: false } } },
        onClick: (_e, els) => { if (els.length && rows[els[0].index].tg.unit) goUnit(rows[els[0].index].tg.unit, "summary"); },
        onHover: (e, els) => (e.native.target.style.cursor = clickable && els.length && rows[els[0].index].tg.unit ? "pointer" : "default"),
      },
    });
  }

  /* ======================= TAB: ANALISIS ======================= */
  const scopeUnits = () => {
    const types = state.scope === "provinces" ? ["province"] : ["distribution_unit", "regional_unit", "subsidiary"];
    return [...db.units.values()].filter((u) => types.includes(u.row_type));
  };
  const indLabel = (ind) => `${L(ind)}${L(ind.unit) ? ` (${L(ind.unit)})` : ""}`;
  const indOptions = () => metricOptions(false);
  const scopeSelectHtml = () => `<label>${esc(T("scope"))}<select id="scopeSelect"><option value="units">${esc(T("scope_units"))}</option><option value="provinces">${esc(T("scope_provinces"))}</option></select></label>`;
  /* Regresi linear sederhana + korelasi Pearson */
  function linfit(pts) {
    const n = pts.length;
    const mx = sum(pts.map((p) => p[0])) / n, my = sum(pts.map((p) => p[1])) / n;
    let sxy = 0, sxx = 0, syy = 0;
    for (const [x, y] of pts) { sxy += (x - mx) * (y - my); sxx += (x - mx) ** 2; syy += (y - my) ** 2; }
    if (!sxx || !syy) return null;
    const b = sxy / sxx;
    return { a: my - b * mx, b, r: sxy / Math.sqrt(sxx * syy) };
  }

  /* Garis rujukan nasional (tegak & mendatar) pada scatter */
  const crossLinesPlugin = {
    id: "crossLines",
    beforeDatasetsDraw(chart, _a, opts) {
      const { ctx, chartArea: A, scales } = chart;
      ctx.save();
      ctx.strokeStyle = COLORS.navy; ctx.globalAlpha = 0.55; ctx.setLineDash([5, 4]); ctx.lineWidth = 1.2;
      ctx.fillStyle = COLORS.navy; ctx.font = "600 11px " + Chart.defaults.font.family;
      if (opts.x != null) {
        const x = scales.x.getPixelForValue(opts.x);
        if (x >= A.left && x <= A.right) {
          ctx.beginPath(); ctx.moveTo(x, A.top); ctx.lineTo(x, A.bottom); ctx.stroke();
          ctx.textAlign = x > A.right - 80 ? "right" : "left";
          ctx.fillText(opts.label, x + (ctx.textAlign === "left" ? 4 : -4), A.top + 10);
        }
      }
      if (opts.y != null) {
        const y = scales.y.getPixelForValue(opts.y);
        if (y >= A.top && y <= A.bottom) {
          ctx.beginPath(); ctx.moveTo(A.left, y); ctx.lineTo(A.right, y); ctx.stroke();
          ctx.textAlign = "right"; ctx.fillText(opts.label, A.right - 4, y - 5);
        }
      }
      ctx.restore();
    },
  };

  /* Panah pergerakan dari tahun pembanding ke tahun terpilih, dan nama unit terpilih */
  const trailsPlugin = {
    id: "trails",
    afterDatasetsDraw(chart, _a, opts) {
      const { ctx, scales } = chart;
      ctx.save();
      for (const t of opts.pairs || []) {
        const x0 = scales.x.getPixelForValue(t.x0), y0 = scales.y.getPixelForValue(t.y0);
        const x1 = scales.x.getPixelForValue(t.x1), y1 = scales.y.getPixelForValue(t.y1);
        const len = Math.hypot(x1 - x0, y1 - y0);
        if (len < 4) continue;
        ctx.strokeStyle = ctx.fillStyle = t.hi ? "#b88a00" : "rgba(21,87,176,0.45)";
        ctx.lineWidth = t.hi ? 2 : 1.2;
        const ang = Math.atan2(y1 - y0, x1 - x0), ex = x1 - Math.cos(ang) * 6, ey = y1 - Math.sin(ang) * 6;
        ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(ex, ey); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(ex, ey);
        ctx.lineTo(ex - Math.cos(ang - 0.45) * 7, ey - Math.sin(ang - 0.45) * 7);
        ctx.lineTo(ex - Math.cos(ang + 0.45) * 7, ey - Math.sin(ang + 0.45) * 7);
        ctx.closePath(); ctx.fill();
      }
      if (opts.label) {
        const x = scales.x.getPixelForValue(opts.label.x), y = scales.y.getPixelForValue(opts.label.y);
        ctx.font = "700 12px " + Chart.defaults.font.family; ctx.textBaseline = "bottom";
        ctx.textAlign = x > chart.chartArea.right - 140 ? "right" : "left";
        const tx = x + (ctx.textAlign === "left" ? 9 : -9);
        ctx.lineJoin = "round"; ctx.lineWidth = 4; ctx.strokeStyle = "rgba(255,255,255,0.95)";
        ctx.strokeText(opts.label.text, tx, y - 6);
        ctx.fillStyle = COLORS.navy; ctx.fillText(opts.label.text, tx, y - 6);
      }
      ctx.restore();
    },
  };

  function renderAnalysis() {
    const multi = db.years.length > 1;
    if (state.amode !== "years") state.amode = "xy";
    let html = `<div class="context-line"><h2>${esc(T("analysis_title"))}</h2><span class="chip">${state.amode === "xy" ? state.year : esc(T("mode_years"))}</span></div>`;
    html += `<div class="seg" role="group" aria-label="${esc(T("analysis_title"))}">
      <button type="button" data-mode="xy" aria-pressed="${state.amode === "xy"}">${esc(T("mode_xy"))}</button>
      <button type="button" data-mode="years" aria-pressed="${state.amode === "years"}">${esc(T("mode_years"))}</button>
    </div>`;
    html += `<div id="analysisBody"></div>`;
    $("#view").innerHTML = html;
    document.querySelectorAll(".seg button").forEach((b) => (b.onclick = () => { state.amode = b.dataset.mode; render(); }));
    if (state.amode === "xy") renderScatter(multi);
    else renderYears();
  }

  function renderScatter(multi) {
    const ix = metric(state.ax) || IND.electrification_ratio, iy = metric(state.ay) || IND.avg_sold_household;
    state.ax = ix.key; state.ay = iy.key;
    const baseYears = db.years.filter((y) => y < state.year);
    const base = baseYears.includes(Number(state.abase)) ? Number(state.abase) : null;
    const scopeOK = provScope() || (!ix.prov && !iy.prov);
    const yx = myear(ix, state.year), yy = myear(iy, state.year);
    const by = (m) => (base ? myear(m, base) : null);
    const tgs = scopeOK ? targets([ix, iy], [state.year].concat(base ? [base] : [])) : [];
    const pts = tgs.map((tg) => ({ u: { unit_id: tg.unit, unit_name: tg.name }, tg, x: mval(ix, tg, yx), y: mval(iy, tg, yy) }))
      .filter((p) => p.x != null && p.y != null);
    const canLogX = pts.length && pts.every((p) => p.x > 0), canLogY = pts.length && pts.every((p) => p.y > 0);
    const logX = canLogX && state.alog.includes("x"), logY = canLogY && state.alog.includes("y");
    const showTrend = state.atrend !== "0";

    const check = (id, on, label, enabled = true) =>
      `<label class="check${enabled ? "" : " off"}"><input type="checkbox" id="${id}"${on ? " checked" : ""}${enabled ? "" : " disabled"}> ${esc(label)}</label>`;
    let body = `<section class="card"><p class="sub">${esc(T(provScope() ? "xy_sub_prov" : "xy_sub"))}</p>
      <div class="toolbar">
        <label>${esc(T("axis_x"))}<select id="axSelect">${indOptions()}</select></label>
        <label>${esc(T("axis_y"))}<select id="aySelect">${indOptions()}</select></label>
        ${scopeSelectHtml()}
        ${multi ? `<label>${esc(T("movement_from"))}<select id="baseSelect"><option value="">${esc(T("none"))}</option>${baseYears.slice().reverse().map((y) => `<option value="${y}">${y}</option>`).join("")}</select></label>` : ""}
      </div>
      <div class="toolbar checks">
        ${check("trendChk", showTrend, T("trend_line"))}
        ${check("logxChk", logX, T("log_x"), canLogX)}
        ${check("logyChk", logY, T("log_y"), canLogY)}
      </div>`;

    let fit = null;
    if (pts.length >= 3) {
      const tx = (v) => (logX ? Math.log10(v) : v), ty = (v) => (logY ? Math.log10(v) : v);
      fit = linfit(pts.map((p) => [tx(p.x), ty(p.y)]));
      body += `<div class="chart-box xy"><canvas id="cXY"></canvas></div>`;
      if (fit) {
        const r = fit.r, a = Math.abs(r);
        const strength = T(a < 0.3 ? "corr_weak" : a < 0.6 ? "corr_moderate" : "corr_strong");
        const dir = T(r >= 0 ? "corr_pos" : "corr_neg");
        body += `<p class="stat"><b>${esc(T("corr_label"))} (r) = ${fmt(r, 2)}</b> · ${esc(strength)}, ${esc(dir)} · ${pts.length} ${esc(T("points"))}${logX || logY ? ` · ${esc(T("corr_log"))}` : ""}</p>`;
      }
      body += `<p class="foot">${esc(T("corr_caution"))}${base ? " " + esc(T("movement_note").replace("{y0}", base).replace("{y1}", state.year)) : ""}</p>`;
    } else body += empty(T(scopeOK ? "too_few" : "prov_only"));
    if (scopeOK) body += provFoot([ix, iy], tgs, [state.year]);
    body += `</section>`;
    $("#analysisBody").innerHTML = body;

    $("#axSelect").value = ix.key; $("#aySelect").value = iy.key; $("#scopeSelect").value = state.scope;
    $("#axSelect").onchange = (e) => { state.ax = e.target.value; render(); };
    $("#aySelect").onchange = (e) => { state.ay = e.target.value; render(); };
    $("#scopeSelect").onchange = (e) => { state.scope = e.target.value; render(); };
    if ($("#baseSelect")) { $("#baseSelect").value = base || ""; $("#baseSelect").onchange = (e) => { state.abase = e.target.value; render(); }; }
    $("#trendChk").onchange = (e) => { state.atrend = e.target.checked ? "1" : "0"; render(); };
    const setLog = () => { state.alog = ($("#logxChk").checked ? "x" : "") + ($("#logyChk").checked ? "y" : ""); render(); };
    $("#logxChk").onchange = setLog; $("#logyChk").onchange = setLog;
    if (pts.length < 3) return;

    const sel = pts.find((p) => isSelected(p.tg));
    const others = pts.filter((p) => p !== sel);
    const datasets = [];
    let pairs = [];
    if (base) {
      const old = pts.map((p) => ({ p, x: mval(ix, p.tg, by(ix)), y: mval(iy, p.tg, by(iy)) }))
        .filter((o) => o.x != null && o.y != null && (!logX || o.x > 0) && (!logY || o.y > 0));
      datasets.push({ label: String(base), kind: "base", data: old.map((o) => ({ x: o.x, y: o.y, name: o.p.u.unit_name })),
        backgroundColor: "rgba(154,165,177,0.55)", pointRadius: 3.5, pointHoverRadius: 5 });
      pairs = old.map((o) => ({ x0: o.x, y0: o.y, x1: o.p.x, y1: o.p.y, hi: o.p === sel }));
    }
    datasets.push({ label: String(state.year), kind: "unit", data: others.map((p) => ({ x: p.x, y: p.y, name: p.u.unit_name, id: p.u.unit_id })),
      backgroundColor: "rgba(21,87,176,0.8)", borderColor: "#fff", borderWidth: 1, pointRadius: 6, pointHoverRadius: 8 });
    if (sel) datasets.push({ label: sel.u.unit_name, kind: "unit", data: [{ x: sel.x, y: sel.y, name: sel.u.unit_name, id: sel.u.unit_id }],
      backgroundColor: COLORS.yellow, borderColor: COLORS.navy, borderWidth: 2, pointRadius: 9, pointHoverRadius: 10 });
    if (showTrend && fit) {
      const xs = pts.map((p) => p.x), lo = Math.min(...xs), hi = Math.max(...xs), line = [];
      for (let i = 0; i <= 40; i++) {
        const x = logX ? 10 ** (Math.log10(lo) + ((Math.log10(hi) - Math.log10(lo)) * i) / 40) : lo + ((hi - lo) * i) / 40;
        const ty = fit.a + fit.b * (logX ? Math.log10(x) : x);
        line.push({ x, y: logY ? 10 ** ty : ty });
      }
      datasets.push({ type: "line", label: T("trend_line"), kind: "trend", data: line, borderColor: COLORS.gold, borderWidth: 2, borderDash: [6, 4], pointRadius: 0, pointHitRadius: 0 });
    }
    const showNat = (i) => i.compareNational !== false;
    const natX = showNat(ix) ? mnat(ix, yx) : null, natY = showNat(iy) ? mnat(iy, yy) : null;
    const axis = (ind, log) => ({
      type: log ? "logarithmic" : "linear", ticks: log ? logTicks : numTicks,
      title: { display: true, text: indLabel(ind), color: COLORS.navy, font: { weight: "600" } },
    });
    makeChart("cXY", {
      type: "scatter",
      plugins: [crossLinesPlugin, trailsPlugin],
      data: { datasets },
      options: {
        layout: { padding: { top: 8, right: 12 } },
        scales: { x: axis(ix, logX), y: axis(iy, logY) },
        plugins: {
          legend: { display: !!(base || sel || showTrend), position: "bottom" },
          crossLines: { x: natX, y: natY, label: T("national_line") },
          trails: { pairs, label: sel ? { x: sel.x, y: sel.y, text: sel.u.unit_name } : null },
          tooltip: {
            filter: (it) => it.dataset.kind !== "trend",
            callbacks: {
              title: (items) => items[0].raw.name + (items[0].dataset.kind === "base" ? ` (${base})` : ""),
              label: (c) => [` ${L(ix)}: ${fmt(c.raw.x, ix.decimals)} ${L(ix.unit)}`, ` ${L(iy)}: ${fmt(c.raw.y, iy.decimals)} ${L(iy.unit)}`],
            },
          },
        },
        onClick: (_e, els) => {
          const el = els.find((x) => datasets[x.datasetIndex].kind === "unit");
          const id = el && datasets[el.datasetIndex].data[el.index].id;
          if (id) goUnit(id, "summary");
        },
        onHover: (e, els) => (e.native.target.style.cursor = els.some((x) => datasets[x.datasetIndex].kind === "unit" && datasets[x.datasetIndex].data[x.index].id) ? "pointer" : "default"),
      },
    });
  }

  function renderYears() {
    const ind = metric(state.indicator) || IND.electrification_ratio;
    state.indicator = ind.key;
    const ys = ind.prov ? ind.years : db.years;
    const toolbarOnly = (msg) => {
      $("#analysisBody").innerHTML = `<section class="card"><p class="sub">${esc(T("years_sub"))}</p><div class="toolbar">
        <label>${esc(T("indicator"))}<select id="indSelect">${indOptions()}</select></label>${scopeSelectHtml()}</div>${empty(msg)}</section>`;
      $("#indSelect").value = ind.key; $("#scopeSelect").value = state.scope;
      $("#indSelect").onchange = (e) => { state.indicator = e.target.value; state.y1 = null; state.y2 = null; render(); };
      $("#scopeSelect").onchange = (e) => { state.scope = e.target.value; render(); };
    };
    if (ind.prov && !provScope()) return toolbarOnly(T("prov_only"));
    if (ys.length < 2) return toolbarOnly(ind.prov ? T("prov_years_need").replace("{title}", L(ind.group)).replace("{years}", ys.join(", ")) : T("years_need").replace("{years}", ys.join(", ")));
    let y2 = ys.includes(Number(state.y2)) ? Number(state.y2) : ys.includes(state.year) ? state.year : ys[ys.length - 1];
    const from = ind.trendFrom && ys.includes(ind.trendFrom) && ind.trendFrom < y2 ? ind.trendFrom : ys[0];
    let y1 = ys.includes(Number(state.y1)) ? Number(state.y1) : from;
    if (y1 >= y2) y1 = ys[Math.max(0, ys.indexOf(y2) - 1)];
    if (y1 >= y2) { y2 = ys[ys.length - 1]; y1 = ys[0]; }
    state.y1 = y1; state.y2 = y2;
    const pp = L(ind.unit) === "%";
    const change = (a, b) => (a == null || b == null ? null : pp ? b - a : a !== 0 ? ((b - a) / Math.abs(a)) * 100 : null);
    const tgs = targets([ind], [y1, y2]);
    const rows = tgs.map((tg) => ({ tg, u: { unit_id: tg.unit, unit_name: tg.name }, v: change(mval(ind, tg, y1), mval(ind, tg, y2)) })).filter((d) => d.v != null);
    const sign = ind.better === "low" ? -1 : 1;
    rows.sort((a, b) => sign * (b.v - a.v));
    const natChange = ind.compareNational === false && ind.prov ? null : change(mnat(ind, y1), mnat(ind, y2));
    const yOpts = (list) => list.map((y) => `<option value="${y}">${y}</option>`).join("");
    /* Garis tren: unit terpilih (data PLN), atau wilayah provinsi yang memuat unit terpilih (data per provinsi). */
    let unitShown = state.unit, trendVals, trendName;
    if (ind.prov) {
      const tg = targets([ind], ys).find(isSelected);
      unitShown = tg ? tg.id : NATIONAL;
      trendName = tg ? tg.name : T("national_line");
      trendVals = ys.map((y) => (tg ? mval(ind, tg, y) : mnat(ind, y)));
    } else { trendName = unitName(unitShown); trendVals = ys.map((y) => indValue(ind, unitShown, y)); }
    const showNatSeries = unitShown !== NATIONAL && ind.compareNational !== false;

    $("#analysisBody").innerHTML = `<section class="card"><p class="sub">${esc(T("years_sub"))}</p>
        <div class="toolbar">
          <label>${esc(T("indicator"))}<select id="indSelect">${indOptions()}</select></label>
          ${scopeSelectHtml()}
          <label>${esc(T("year_from"))}<select id="y1Select">${yOpts(ys.slice(0, -1))}</select></label>
          <label>${esc(T("year_to"))}<select id="y2Select">${yOpts(ys.slice(1))}</select></label>
        </div>
        <h3 class="mt">${esc(T("trend_title").replace("{ind}", L(ind)))}</h3>
        <p class="sub">${esc(trendName)}${showNatSeries ? " · " + esc(T("vs_national")) : ""} · ${ys[0]}–${ys[ys.length - 1]} (${esc(L(ind.unit))})</p>
        <div class="chart-box"><canvas id="cTrend"></canvas></div>
        <h3 class="mt">${esc(T("change_title").replace("{y1}", y1).replace("{y2}", y2))}</h3>
        ${ind.trendFrom && ys[0] < ind.trendFrom ? `<p class="sub">ℹ ${esc(T("trend_from_note").replace("{year}", ind.trendFrom))}</p>` : ""}
        <p class="sub">${esc(T(pp ? "change_sub_pp" : "change_sub_pct"))}</p>
        ${rows.length ? `<div class="chart-box" style="height:${Math.max(320, rows.length * 26 + 60)}px"><canvas id="cChange"></canvas></div>` : empty()}
        ${ind.note ? `<p class="foot">${esc(L(ind.note))}</p>` : ""}
        ${provFoot([ind], tgs, ind.prov ? [] : [y1, y2])}
        ${ind.prov ? "" : qualityNotes({ tables: ind.table ? [ind.table] : (ind.uses || []).map((u) => u.split(".")[0]), columns: ind.column ? [ind.column] : (ind.uses || []).map((u) => u.split(".")[1]), yFrom: y1, yTo: y2, units: [NATIONAL, "jawa", "luar_jawa", unitShown, ...rows.flatMap((d) => d.tg.unit ? [d.tg.unit, ...Object.values(d.tg.units || {})] : [])] })}
      </section>`;
    $("#indSelect").value = ind.key; $("#scopeSelect").value = state.scope;
    $("#y1Select").value = y1; $("#y2Select").value = y2;
    $("#indSelect").onchange = (e) => { state.indicator = e.target.value; state.y1 = null; render(); };
    $("#scopeSelect").onchange = (e) => { state.scope = e.target.value; render(); };
    $("#y1Select").onchange = (e) => { state.y1 = Number(e.target.value); render(); };
    $("#y2Select").onchange = (e) => { state.y2 = Number(e.target.value); render(); };

    const series = [{ label: trendName, data: trendVals, borderColor: COLORS.blue, backgroundColor: COLORS.blue, borderWidth: 3, pointRadius: 4, tension: 0.2, spanGaps: true }];
    if (showNatSeries) series.push({ label: T("national_line"), data: ys.map((y) => mnat(ind, y)), borderColor: COLORS.navy, backgroundColor: COLORS.navy, borderDash: [6, 4], borderWidth: 2, pointRadius: 3, tension: 0.2, spanGaps: true });
    makeChart("cTrend", {
      type: "line",
      data: { labels: ys.map(String), datasets: series },
      options: {
        plugins: { legend: { position: "bottom" }, tooltip: { callbacks: { label: (c) => ` ${c.dataset.label}: ${fmt(c.parsed.y, ind.decimals)} ${L(ind.unit)}` } } },
        scales: { y: { ticks: numTicks }, x: gridless },
      },
    });

    if (!rows.length) return;
    const color = (d) => {
      if (isSelected(d.tg)) return COLORS.yellow;
      if (!ind.better) return COLORS.blue;
      return d.v * sign >= 0 ? COLORS.good : COLORS.bad;
    };
    makeChart("cChange", {
      type: "bar",
      plugins: [nationalLinePlugin],
      data: { labels: rows.map((d) => d.u.unit_name), datasets: [{ data: rows.map((d) => d.v), backgroundColor: rows.map(color), borderRadius: 4 }] },
      options: {
        indexAxis: "y",
        layout: { padding: { top: 18, right: 8 } },
        plugins: {
          legend: { display: false },
          nationalLine: { value: natChange, label: T("national_line"), decimals: pp ? 2 : 1, suffix: pp ? " " + T("pp") : "%", signed: true },
          barValues: { enabled: true, decimals: pp ? 2 : 1, signed: true, suffix: pp ? "" : "%" },
          tooltip: { callbacks: { label: (c) => ` ${c.parsed.x > 0 ? "+" : ""}${fmt(c.parsed.x, pp ? 2 : 1)}${pp ? " " + T("pp") : "%"}` } },
        },
        scales: { x: { ticks: { callback: (v) => (v > 0 ? "+" : "") + fmtTick(v) + (pp ? "" : "%"), maxRotation: 0 } }, y: { grid: { display: false }, ticks: { autoSkip: false } } },
        onClick: (_e, els) => { if (els.length && rows[els[0].index].tg.unit) goUnit(rows[els[0].index].tg.unit); },
        onHover: (e, els) => (e.native.target.style.cursor = els.length && rows[els[0].index].tg.unit ? "pointer" : "default"),
      },
    });
  }

  /* ======================= TAB: DATA ======================= */
  function tableColumns(t) {
    const rows = db.tables[t] || [];
    const header = rows.header || Object.keys(rows[0] || {});
    return header.filter((h) => !["year", "row_order", "unit_id", "unit_name", "unit_name_reported", "row_type", "parent_unit_id", "region", "derived"].includes(h));
  }

  function renderData() {
    const tables = Object.keys(db.tables).sort();
    if (!tables.includes(state.table)) state.table = tables[0];
    const t = state.table;
    const cols = tableColumns(t);
    const rows = (db.tables[t] || []).filter((r) => r.year === state.year).sort((a, b) => (a.row_order || 0) - (b.row_order || 0));
    const head = `<tr><th>${esc(T("unit_name"))}</th>${cols.map((c) => `<th>${esc(db.label(t, c, state.lang))}<small>${esc(db.uom(t, c))}</small></th>`).join("")}</tr>`;
    const body = rows.map((r) => {
      const cls = [r.row_type === "province" ? "province" : "", /total/.test(r.row_type || "") ? "total" : "", r.unit_id === state.unit ? "selected" : ""].join(" ");
      const rn = r.unit_name_reported && r.unit_name_reported.trim() !== (r.unit_name || "").trim() ? `<small class="reported">${esc(r.unit_name_reported)}</small>` : "";
      const dv = r.derived === "true" ? ` <span class="derived" title="${esc(T("derived_hint"))}">*</span>` : "";
      return `<tr class="${cls}"><td>${esc(r.unit_name)}${dv}${rn}</td>${cols.map((c) => `<td class="num">${r[c] == null ? "" : fmt(r[c], Number.isInteger(r[c]) ? 0 : 2)}</td>`).join("")}</tr>`;
    }).join("");
    const xlsxUrl = CFG.dataFilePattern.replace("{year}", state.year);

    let html = `<div class="context-line"><h2>${esc(T("data_title"))}</h2><span class="chip">${state.year}</span></div>`;
    html += `<section class="card"><p class="sub">${esc(T("data_sub"))}</p>
      <div class="toolbar">
        <label>${esc(T("table"))}<select id="tableSelect">${tables.map((x) => `<option value="${x}">${x.toUpperCase()} – ${esc(db.tableTitle(x, state.lang))}</option>`).join("")}</select></label>
        <button class="btn primary" id="csvBtn" type="button">⬇ ${esc(T("download_csv"))}</button>
        <a class="btn" href="${esc(xlsxUrl)}" download>⬇ ${esc(T("download_xlsx"))}</a>
      </div>
      <div class="table-wrap"><table class="data"><thead>${head}</thead><tbody>${body}</tbody></table></div>
      ${rows.some((r) => r.unit_name_reported && r.unit_name_reported.trim() !== (r.unit_name || "").trim()) ? `<p class="foot">${esc(T("reported_hint"))}</p>` : ""}
      ${qualityNotes({ tables: [t], yFrom: state.year, yTo: state.year })}
    </section>`;
    html += card(T("notes_title"), "", `<ul>${T("notes").map((n) => `<li>${esc(n)}</li>`).join("")}</ul>`, "mt");
    $("#view").innerHTML = html;
    $("#tableSelect").value = t;
    $("#tableSelect").onchange = (e) => { state.table = e.target.value; render(); };
    $("#csvBtn").onclick = () => {
      const all = ["year", "unit_id", "unit_name", "unit_name_reported", "row_type", "parent_unit_id", "region", ...cols, "derived"];
      const q = (v) => (v == null ? "" : /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
      const csv = [all.join(","), ...rows.map((r) => all.map((c) => q(r[c])).join(","))].join("\n");
      const a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
      a.download = `praktik_${t}_${state.year}.csv`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    };
  }

  /* ---------- Main render ---------- */
  const RENDER = { summary: renderSummary, generation: renderGeneration, network: renderNetwork, compare: renderCompare, analysis: renderAnalysis, data: renderData };
  /* Tab tambahan sektor Ketenagalistrikan (PK.registerElecTab): tampil hanya jika available(). Saat ini tidak dipakai. */
  const ELEC_EXTRA = [];
  const elecTabs = () => {
    const tabs = ELEC_TABS.slice();
    for (const x of ELEC_EXTRA) if (x.available()) tabs.splice(tabs.findIndex((t) => t[0] === "data"), 0, [x.key, x.label]);
    return tabs;
  };
  const tabsOf = (sector) => (sector === "listrik" ? elecTabs() : MODULES[sector] ? MODULES[sector].tabs : []);
  function buildTabs() {
    $("#tabs").innerHTML = tabsOf(state.sector).map(([k, label]) =>
      `<button role="tab" data-tab="${k}" aria-selected="${k === state.tab}" data-i18n="${label}">${esc(T(label))}</button>`).join("");
    document.querySelectorAll("#tabs button").forEach((b) => (b.onclick = () => { state.tab = b.dataset.tab; render(); }));
  }
  function render() {
    const tabs = tabsOf(state.sector).map((t) => t[0]);
    if (!tabs.includes(state.tab)) state.tab = tabs[0];
    destroyCharts();
    document.querySelectorAll("#tabs button").forEach((b) => b.setAttribute("aria-selected", b.dataset.tab === state.tab));
    const extra = state.sector === "listrik" && ELEC_EXTRA.find((x) => x.key === state.tab);
    $(".filters").style.display = extra ? "none" : "";   // tab tambahan memakai pilihan sendiri
    if (extra) extra.render();
    else if (state.sector === "listrik") RENDER[state.tab]();
    else MODULES[state.sector].render(state.tab);
    writeHash();
  }

  function showBanner(kind, msg, details) {
    const d = details && details.length
      ? `<details><summary>${esc(msg)}</summary><ul>${details.slice(0, 50).map((x) => `<li>${esc(x)}</li>`).join("")}</ul></details>`
      : esc(msg);
    $("#banners").insertAdjacentHTML("beforeend", `<div class="banner ${kind}">${d}</div>`);
  }

  /* ---------- Sektor ---------- */
  const problemsShown = new Set();
  async function ensureLoaded(sector) {
    if (sector === "listrik") {
      if (!db) db = await window.PraktikData.loadFromServer();
      const extraProblems = [];
      if (window.PKP && !window.PKP.loaded) { try { extraProblems.push(...(await window.PKP.load())); } catch (e) { window.PKP.loaded = true; extraProblems.push(e.message); } }
      for (const x of ELEC_EXTRA) if (!x.loaded) { x.loaded = true; try { extraProblems.push(...((await x.load()) || [])); } catch (e) { extraProblems.push(e.message); } }
      return db.problems.concat(extraProblems);
    }
    const m = MODULES[sector];
    if (!m) throw new Error("sector " + sector);
    if (!m.data) {
      const raw = await window.PraktikData.loadEdition(SECTORS.find((x) => x.key === sector));
      m.data = m.prepare(raw);
      m.data.problems = raw.problems;
      m.data.url = raw.url;
      m.data.edition = raw.edition;
    }
    return m.data.problems;
  }
  async function openSector(sector, keepState) {
    state.sector = sector;
    if (!keepState) { state.tab = tabsOf(sector)[0][0]; state.year = null; state.params = {}; }
    $("#banners").innerHTML = "";
    destroyCharts();
    $("#view").hidden = true;
    $("#loader").hidden = false;
    buildTabs();
    applyStaticText();
    $("#yearSelect").disabled = true;
    let problems;
    try {
      problems = await ensureLoaded(sector);
    } catch (e) {
      $("#loader").hidden = true;
      if (location.protocol === "file:") showBanner("error", T("err_file"));
      else showBanner("error", e.message === "NO_DATA" ? T("err_nodata") : T("err_generic") + " " + e.message);
      return;
    }
    if (state.sector !== sector) return; // pengguna sudah pindah sektor lagi
    if (problems.length) showBanner("warn", T("warn_problems"), problems);
    const ys = sectorYears();
    if (!ys.includes(state.year)) state.year = ys[ys.length - 1];
    if (sector === "listrik" && !db.units.has(state.unit)) state.unit = NATIONAL;
    applyStaticText();
    fillFilters();
    buildTabs();   // tab tambahan (mis. Provinsi) baru diketahui setelah data dimuat
    $("#loader").hidden = true;
    $("#view").hidden = false;
    render();
  }

  /* ---------- Init ---------- */
  async function init() {
    readHash();
    try { const saved = localStorage.getItem("praktik_lang"); if (saved && !location.hash.includes("lang=")) state.lang = saved; } catch {}
    if (!window.I18N[state.lang]) state.lang = "id";
    $("#sectorNav").innerHTML = SECTORS.map((x) => `<button type="button" data-sector="${x.key}" aria-pressed="false">${esc(L(x))}</button>`).join("");
    document.querySelectorAll("#sectorNav button").forEach((b) => (b.onclick = () => { if (b.dataset.sector !== state.sector) openSector(b.dataset.sector); }));
    document.querySelectorAll(".lang-toggle button").forEach((b) => (b.onclick = () => {
      state.lang = b.dataset.lang;
      try { localStorage.setItem("praktik_lang", state.lang); } catch {}
      applyStaticText();
      buildTabs();
      if (!$("#view").hidden) { fillFilters(); render(); }
    }));
    $("#unitSelect").onchange = (e) => { state.unit = e.target.value; render(); };
    $("#yearSelect").onchange = (e) => { state.year = Number(e.target.value); fillFilters(); render(); };
    await openSector(state.sector, true);
  }

  /* Dipakai modul sektor (assets/js/sektor-*.js). */
  window.PK = {
    state, T, L, esc, fmt, fmtAuto, fmtTick, $, card, chartBox, empty, makeChart, COLORS, numTicks, logTicks, gridless,
    render, showBanner, nationalLinePlugin, yearRange,
    registerSector(key, mod) { MODULES[key] = mod; },
    registerElecTab(tab) { ELEC_EXTRA.push(tab); },
  };
  document.addEventListener("DOMContentLoaded", init);
})();
