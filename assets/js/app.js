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

  const state = { lang: "id", year: null, unit: NATIONAL, tab: "summary", indicator: "electrification_ratio", scope: "units", table: "t01" };
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
    for (const k of ["lang", "unit", "tab", "indicator", "scope", "table"]) if (p.get(k)) state[k] = p.get(k);
    if (p.get("year")) state.year = Number(p.get("year"));
  }
  function writeHash() {
    const p = new URLSearchParams({ tab: state.tab, unit: state.unit, year: state.year, lang: state.lang });
    if (state.tab === "compare") { p.set("indicator", state.indicator); p.set("scope", state.scope); }
    if (state.tab === "data") p.set("table", state.table);
    history.replaceState(null, "", "#" + p.toString());
  }

  /* ---------- Static UI text ---------- */
  function applyStaticText() {
    document.documentElement.lang = state.lang;
    document.querySelectorAll("[data-i18n]").forEach((el) => (el.textContent = T(el.dataset.i18n)));
    document.querySelectorAll(".lang-toggle button").forEach((b) => b.setAttribute("aria-pressed", b.dataset.lang === state.lang));
    $("#sourceText").textContent = L(CFG.source);
    $("#contactEmail").textContent = CFG.contact.email;
    $("#contactEmail").href = "mailto:" + CFG.contact.email;
    $("#contactIg").textContent = "@" + CFG.contact.instagram;
    $("#contactIg").href = "https://www.instagram.com/" + CFG.contact.instagram;
    if (CFG.staffLinks) {
      $("#guideLink").href = CFG.staffLinks.guide;
      $("#checkerLink").href = CFG.staffLinks.checker;
    }
    if (db) $("#yearsText").textContent = T("years_available") + ": " + db.years.join(", ");
  }

  /* ---------- Filters ---------- */
  const GROUPS = [
    ["grp_national", ["national_total", "regional_total"]],
    ["grp_distribution", ["distribution_unit", "regional_unit", "subsidiary"]],
    ["grp_province", ["province"]],
    ["grp_generation", ["generation_unit", "generation_subsidiary", "generation_projects"]],
    ["grp_transmission", ["transmission_dispatch_unit", "transmission_unit"]],
  ];
  function fillFilters() {
    const ys = $("#yearSelect");
    ys.innerHTML = db.years.slice().reverse().map((y) => `<option value="${y}">${y}</option>`).join("");
    ys.value = state.year;
    const us = $("#unitSelect");
    const units = [...db.units.values()];
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
          const txt = opts.decimals != null ? fmt(v, opts.decimals) : fmtAuto(v);
          const w = ctx.measureText(txt).width;
          let inside = bar.x + w + 8 > chart.chartArea.right;
          /* Jika label di luar batang akan menabrak garis nasional, pindahkan ke dalam batang. */
          if (!inside && lineX != null && lineX > bar.x && lineX < bar.x + w + 12 && bar.x - bar.base > w + 12) inside = true;
          const x = inside ? bar.x - 6 : bar.x + 6;
          ctx.textAlign = inside ? "right" : "left";
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

  /* ---------- Context line ---------- */
  function contextLine() {
    const u = db.units.get(state.unit) || {};
    const bits = [];
    if (u.region) bits.push(`${T("region")}: ${u.region}`);
    if (u.parent_unit_id) bits.push(`${T("part_of")}: ${unitName(u.parent_unit_id)}`);
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
        <li><span>${esc(T("households"))}</span><b>${fmt(t19.households * 1000, 0)}</b></li>
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
      ctx.fillText(`${opts.label}: ${fmt(opts.value, opts.decimals)}`, x + (ctx.textAlign === "left" ? 6 : -6), chartArea.top - 8);
      ctx.restore();
    },
  };

  function renderCompare() {
    const ind = IND[state.indicator] || IND.electrification_ratio;
    const types = state.scope === "provinces" ? ["province"] : ["distribution_unit", "regional_unit", "subsidiary"];
    const rows = [...db.units.values()].filter((u) => types.includes(u.row_type))
      .map((u) => ({ u, v: indValue(ind, u.unit_id, state.year) })).filter((d) => d.v != null);
    rows.sort((a, b) => (ind.better === "low" ? a.v - b.v : b.v - a.v));
    const nat = indValue(ind, NATIONAL, state.year);

    let html = `<div class="context-line"><h2>${esc(T("compare_title"))}</h2><span class="chip">${state.year}</span></div>`;
    html += `<section class="card"><p class="sub">${esc(T("compare_sub"))}</p>
      <div class="toolbar">
        <label>${esc(T("indicator"))}<select id="indSelect">${window.INDICATORS.map((i) => `<option value="${i.key}">${esc(L(i))}</option>`).join("")}</select></label>
        <label>${esc(T("scope"))}<select id="scopeSelect"><option value="units">${esc(T("scope_units"))}</option><option value="provinces">${esc(T("scope_provinces"))}</option></select></label>
      </div>
      ${rows.length ? `<div class="chart-box" style="height:${Math.max(320, rows.length * 26 + 60)}px"><canvas id="cRank"></canvas></div>` : empty()}
      ${ind.note ? `<p class="foot">${esc(L(ind.note))}</p>` : ""}
    </section>`;
    html += `<section class="map-placeholder mt"><h3>🗺 ${esc(T("map_title"))}</h3><p>${esc(T("map_body"))}</p></section>`;
    $("#view").innerHTML = html;
    $("#indSelect").value = ind.key;
    $("#scopeSelect").value = state.scope;
    $("#indSelect").onchange = (e) => { state.indicator = e.target.value; render(); };
    $("#scopeSelect").onchange = (e) => { state.scope = e.target.value; render(); };

    if (!rows.length) return;
    const color = (d) => {
      if (d.u.unit_id === state.unit) return COLORS.yellow;
      if (!ind.better || nat == null) return COLORS.blue;
      const better = ind.better === "high" ? d.v >= nat : d.v <= nat;
      return better ? COLORS.good : COLORS.bad;
    };
    makeChart("cRank", {
      type: "bar",
      plugins: [nationalLinePlugin],
      data: {
        labels: rows.map((d) => d.u.unit_name),
        datasets: [{ label: `${L(ind)} (${L(ind.unit)})`, data: rows.map((d) => d.v), backgroundColor: rows.map(color), borderRadius: 4 }],
      },
      options: {
        indexAxis: "y",
        layout: { padding: { top: 18 } },
        plugins: { legend: { display: false }, nationalLine: { value: nat, label: T("national_line"), decimals: ind.decimals }, barValues: { enabled: true, decimals: ind.decimals } },
        scales: { x: { ticks: numTicks }, y: { grid: { display: false }, ticks: { autoSkip: false } } },
        onClick: (_e, els) => {
          if (!els.length) return;
          state.unit = rows[els[0].index].u.unit_id;
          state.tab = "summary";
          $("#unitSelect").value = state.unit;
          render();
          window.scrollTo({ top: 0, behavior: "smooth" });
        },
        onHover: (e, els) => (e.native.target.style.cursor = els.length ? "pointer" : "default"),
      },
    });
  }

  /* ======================= TAB: DATA ======================= */
  function tableColumns(t) {
    const rows = db.tables[t] || [];
    const header = rows.header || Object.keys(rows[0] || {});
    return header.filter((h) => !["year", "row_order", "unit_id", "unit_name", "row_type", "parent_unit_id", "region"].includes(h));
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
      return `<tr class="${cls}"><td>${esc(r.unit_name)}</td>${cols.map((c) => `<td class="num">${r[c] == null ? "" : fmt(r[c], Number.isInteger(r[c]) ? 0 : 2)}</td>`).join("")}</tr>`;
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
    </section>`;
    html += card(T("notes_title"), "", `<ul>${T("notes").map((n) => `<li>${esc(n)}</li>`).join("")}</ul>`, "mt");
    $("#view").innerHTML = html;
    $("#tableSelect").value = t;
    $("#tableSelect").onchange = (e) => { state.table = e.target.value; render(); };
    $("#csvBtn").onclick = () => {
      const all = ["year", "unit_id", "unit_name", "row_type", "parent_unit_id", "region", ...cols];
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
  const RENDER = { summary: renderSummary, generation: renderGeneration, network: renderNetwork, compare: renderCompare, data: renderData };
  function render() {
    if (!RENDER[state.tab]) state.tab = "summary";
    destroyCharts();
    document.querySelectorAll(".tabs button").forEach((b) => b.setAttribute("aria-selected", b.dataset.tab === state.tab));
    RENDER[state.tab]();
    writeHash();
  }

  function showBanner(kind, msg, details) {
    const d = details && details.length
      ? `<details><summary>${esc(msg)}</summary><ul>${details.slice(0, 50).map((x) => `<li>${esc(x)}</li>`).join("")}</ul></details>`
      : esc(msg);
    $("#banners").insertAdjacentHTML("beforeend", `<div class="banner ${kind}">${d}</div>`);
  }

  /* ---------- Init ---------- */
  async function init() {
    readHash();
    try { const saved = localStorage.getItem("praktik_lang"); if (saved && !location.hash.includes("lang=")) state.lang = saved; } catch {}
    if (!window.I18N[state.lang]) state.lang = "id";
    applyStaticText();

    document.querySelectorAll(".lang-toggle button").forEach((b) => (b.onclick = () => {
      state.lang = b.dataset.lang;
      try { localStorage.setItem("praktik_lang", state.lang); } catch {}
      applyStaticText();
      if (db) { fillFilters(); render(); }
    }));
    document.querySelectorAll(".tabs button").forEach((b) => (b.onclick = () => { state.tab = b.dataset.tab; if (db) render(); }));
    $("#unitSelect").onchange = (e) => { state.unit = e.target.value; render(); };
    $("#yearSelect").onchange = (e) => { state.year = Number(e.target.value); render(); };

    try {
      db = await window.PraktikData.loadFromServer();
    } catch (e) {
      $("#loader").hidden = true;
      if (location.protocol === "file:") showBanner("error", T("err_file"));
      else showBanner("error", e.message === "NO_DATA" ? T("err_nodata") : T("err_generic") + " " + e.message);
      return;
    }
    if (db.problems.length) showBanner("warn", T("warn_problems"), db.problems);
    if (!db.years.includes(state.year)) state.year = db.years[db.years.length - 1];
    if (!db.units.has(state.unit)) state.unit = NATIONAL;
    applyStaticText();
    fillFilters();
    $("#loader").hidden = true;
    $("#view").hidden = false;
    render();
  }

  init();
})();
