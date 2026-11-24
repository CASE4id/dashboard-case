/* Bagian bersama untuk sektor dengan angka nasional per tahun (Transmisi Gas, Kedirgantaraan).
 * Shared helpers for national-level sectors. Dipakai oleh sektor-gas.js dan sektor-udara.js. */
(function () {
  const { T, L, esc, fmt, fmtTick, $, makeChart, COLORS, numTicks, gridless } = window.PK;
  const state = window.PK.state;

  /* Palet kategori (urutan tetap agar warna konsisten antargrafik) */
  const PALETTE = ["#0a2f6b", "#2fa8e0", "#f7c948", "#2e9e4f", "#c9992f", "#b0413e", "#7fc8a9", "#8a6f62", "#9aa5b1"];

  const tr = (o) => (o == null ? "" : typeof o === "string" ? o : o[state.lang] ?? o.id);

  /* Perubahan dari tahun sebelumnya, dalam persen (atau poin jika satuannya %). */
  function changeText(v, pv, py, pct) {
    if (v == null || pv == null) return "";
    if (pct) {
      const d = v - pv;
      const arrow = Math.abs(d) < 0.005 ? "＝" : d > 0 ? "▲" : "▼";
      return `<div class="compare">${arrow} ${fmt(Math.abs(d), 2)} ${esc(T("pp"))} ${esc(T("vs_prev"))} ${py}</div>`;
    }
    if (pv === 0) return "";
    const d = ((v - pv) / Math.abs(pv)) * 100;
    const arrow = Math.abs(d) < 0.05 ? "＝" : d > 0 ? "▲" : "▼";
    return `<div class="compare">${arrow} ${fmt(Math.abs(d), 1)}% ${esc(T("vs_prev"))} ${py}</div>`;
  }

  /* Kartu KPI. o: { label, value, prev, prevYear, unit, decimals, note, flag, sub } */
  function kpi(o) {
    const valueHtml = o.value == null
      ? `<div class="na">${esc(T("na"))}</div>`
      : `<div class="value">${fmt(o.value, o.decimals ?? 0)}<span class="unit">${esc(tr(o.unit))}</span></div>`;
    return `<section class="card kpi"><div class="label">${esc(tr(o.label))}${o.flag ? `<span class="flag">${esc(o.flag)}</span>` : ""}</div>${valueHtml}` +
      `${o.sub ? `<div class="compare">${o.sub}</div>` : ""}${changeText(o.value, o.prev, o.prevYear, tr(o.unit) === "%")}` +
      `${o.note ? `<div class="note">${esc(tr(o.note))}</div>` : ""}</section>`;
  }

  /* Catatan dari sheet "catatan" (table_id, years, note_id, note_en). tables: daftar id tabel; year: null = semua. */
  function notes(rows, tables, year, opts = {}) {
    const split = (v) => String(v || "").split(";").map((x) => x.trim()).filter(Boolean);
    const list = (rows || []).filter((n) => {
      const ts = split(n.table_id);
      if (!ts.some((t) => tables.includes(t))) return false;
      const ys = split(n.years).map(Number);
      if (opts.onlyYearSpecific && !ys.length) return false;
      return year == null || !ys.length || ys.includes(year);
    });
    if (!list.length) return "";
    const items = list.map((n) => `<li>${esc(state.lang === "en" ? n.note_en || n.note_id : n.note_id || n.note_en)}</li>`).join("");
    if (opts.banner) return `<div class="banner warn">${list.map((n) => esc(state.lang === "en" ? n.note_en || n.note_id : n.note_id || n.note_en)).join(" ")}</div>`;
    return `<details class="quality mt"${opts.open ? " open" : ""}><summary>ℹ ${esc(T("notes_data"))} (${list.length})</summary><ul>${items}</ul></details>`;
  }

  /* Rupiah dari "juta Rp": pilih satuan triliun/miliar agar mudah dibaca. */
  function idrUnit(millions) {
    const a = Math.abs(millions || 0);
    if (a >= 1e6) return { div: 1e6, unit: { id: "triliun Rp", en: "IDR trillion" }, decimals: 2 };
    if (a >= 1e3) return { div: 1e3, unit: { id: "miliar Rp", en: "IDR billion" }, decimals: 1 };
    return { div: 1, unit: { id: "juta Rp", en: "IDR million" }, decimals: 0 };
  }

  /* Grafik batang bertumpuk per tahun. series: [{label, values:{year:v}}] */
  function stackedYears(canvasId, years, series, opts = {}) {
    return makeChart(canvasId, {
      type: "bar",
      data: {
        labels: years.map(String),
        datasets: series.map((s, i) => ({ label: s.label, data: years.map((y) => s.values[y] ?? null), backgroundColor: s.color || PALETTE[i % PALETTE.length], borderRadius: 3, stack: opts.stacked === false ? undefined : "s" })),
      },
      options: {
        plugins: { legend: { position: "bottom" }, tooltip: { callbacks: { label: (c) => ` ${c.dataset.label}: ${fmt(c.parsed.y, opts.decimals ?? 0)}${opts.unit ? " " + tr(opts.unit) : ""}` } } },
        scales: { x: { ...gridless, stacked: opts.stacked !== false }, y: { stacked: opts.stacked !== false, ticks: numTicks, title: opts.unit ? { display: true, text: tr(opts.unit) } : undefined } },
      },
    });
  }

  /* Grafik garis per tahun. */
  function lineYears(canvasId, years, series, opts = {}) {
    return makeChart(canvasId, {
      type: "line",
      data: {
        labels: years.map(String),
        datasets: series.map((s, i) => ({ label: s.label, data: years.map((y) => s.values[y] ?? null), borderColor: s.color || PALETTE[i % PALETTE.length], backgroundColor: s.color || PALETTE[i % PALETTE.length],
          borderWidth: s.dashed ? 2 : 3, borderDash: s.dashed ? [6, 4] : undefined, pointRadius: 3, tension: 0.2, spanGaps: true })),
      },
      options: {
        plugins: { legend: { position: "bottom" }, tooltip: { callbacks: { label: (c) => ` ${c.dataset.label}: ${fmt(c.parsed.y, opts.decimals ?? 0)}${opts.unit ? " " + tr(opts.unit) : ""}` } } },
        scales: { x: gridless, y: { ticks: numTicks, beginAtZero: opts.beginAtZero !== false, title: opts.unit ? { display: true, text: tr(opts.unit) } : undefined } },
      },
    });
  }

  /* Batang mendatar dengan angka di ujung. items: [{label, value}] */
  function hbar(canvasId, items, opts = {}) {
    return makeChart(canvasId, {
      type: "bar",
      data: { labels: items.map((d) => d.label), datasets: [{ data: items.map((d) => d.value), backgroundColor: items.map((d, i) => d.color || opts.color || PALETTE[opts.multi ? i % PALETTE.length : 0]), borderRadius: 4 }] },
      options: {
        indexAxis: "y",
        layout: { padding: { right: 8 } },
        plugins: { legend: { display: false }, barValues: { enabled: true, decimals: opts.decimals ?? 0 },
          tooltip: { callbacks: { label: (c) => ` ${fmt(c.parsed.x, opts.decimals ?? 0)}${opts.unit ? " " + tr(opts.unit) : ""}` } } },
        scales: { x: { ticks: numTicks }, y: { grid: { display: false }, ticks: { autoSkip: false } } },
        onClick: opts.onClick, onHover: opts.onClick ? (e, els) => (e.native.target.style.cursor = els.length ? "pointer" : "default") : undefined,
      },
    });
  }

  /* Tab "Tren & Analisis": pilih satu deret → grafik garis + perubahan tahunan.
   * groups: [{label, series:[{key, label, unit, decimals, values:{year:v}}]}] */
  function trendView(groups, selectedKey, onSelect, extraHtml = "") {
    const all = groups.flatMap((g) => g.series);
    const s = all.find((x) => x.key === selectedKey) || all[0];
    const ys = Object.keys(s.values).map(Number).filter((y) => s.values[y] != null).sort((a, b) => a - b);
    const pct = tr(s.unit) === "%";
    const yoy = ys.slice(1).map((y, i) => {
      const a = s.values[ys[i]], b = s.values[y];
      return { y, v: a == null || b == null ? null : pct ? b - a : a !== 0 ? ((b - a) / Math.abs(a)) * 100 : null };
    });
    const first = s.values[ys[0]], last = s.values[ys[ys.length - 1]];
    const n = ys[ys.length - 1] - ys[0];
    let stat = "";
    if (ys.length > 1 && first != null && last != null) {
      if (pct) stat = `${T("change_total")} ${ys[0]}–${ys[ys.length - 1]}: <b>${last - first >= 0 ? "+" : ""}${fmt(last - first, 2)} ${esc(T("pp"))}</b>`;
      else if (first > 0 && last > 0) {
        const tot = ((last - first) / first) * 100, cagr = (Math.pow(last / first, 1 / n) - 1) * 100;
        stat = `${T("change_total")} ${ys[0]}–${ys[ys.length - 1]}: <b>${tot >= 0 ? "+" : ""}${fmt(tot, 1)}%</b> · ${esc(T("cagr"))}: <b>${cagr >= 0 ? "+" : ""}${fmt(cagr, 1)}%</b> ${esc(T("per_year"))}`;
      }
    }
    $("#view").innerHTML = `<div class="context-line"><h2>${esc(T("trend_tab_title"))}</h2><span class="chip">Indonesia</span></div>
      <section class="card"><p class="sub">${esc(T("trend_tab_sub"))}</p>
        <div class="toolbar"><label>${esc(T("series"))}<select id="seriesSelect">${groups.map((g) =>
          `<optgroup label="${esc(g.label)}">${g.series.map((x) => `<option value="${esc(x.key)}">${esc(x.label)}</option>`).join("")}</optgroup>`).join("")}</select></label></div>
        <h3 class="mt">${esc(s.label)}</h3><p class="sub">${esc(tr(s.unit))}${ys.length ? ` · ${ys[0]}–${ys[ys.length - 1]}` : ""}</p>
        ${ys.length ? `<div class="chart-box"><canvas id="cSeries"></canvas></div>` : window.PK.empty()}
        ${stat ? `<p class="stat">${stat}</p>` : ""}
        ${yoy.length ? `<h3 class="mt">${esc(T(pct ? "yoy_title_pp" : "yoy_title"))}</h3><div class="chart-box short"><canvas id="cYoy"></canvas></div>` : ""}
        ${extraHtml}
      </section>`;
    $("#seriesSelect").value = s.key;
    $("#seriesSelect").onchange = (e) => onSelect(e.target.value);
    if (!ys.length) return s;
    lineYears("cSeries", ys, [{ label: s.label, values: s.values, color: COLORS.blue }], { unit: s.unit, decimals: s.decimals, beginAtZero: false });
    if (yoy.length) makeChart("cYoy", {
      type: "bar",
      data: { labels: yoy.map((d) => String(d.y)), datasets: [{ data: yoy.map((d) => d.v), backgroundColor: yoy.map((d) => (d.v >= 0 ? COLORS.sky : COLORS.bad)), borderRadius: 4 }] },
      options: {
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => ` ${c.parsed.y > 0 ? "+" : ""}${fmt(c.parsed.y, pct ? 2 : 1)}${pct ? " " + T("pp") : "%"}` } } },
        scales: { x: gridless, y: { ticks: { callback: (v) => (v > 0 ? "+" : "") + fmtTick(v) + (pct ? "" : "%") } } },
      },
    });
    return s;
  }

  function downloadCsv(header, rows, filename) {
    const q = (v) => (v == null ? "" : /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
    const csv = [header.join(","), ...rows.map((r) => r.map(q).join(","))].join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  const contextLine = (title, chip, meta) =>
    `<div class="context-line"><h2>${esc(title)}</h2>${chip != null ? `<span class="chip">${esc(String(chip))}</span>` : ""}${meta ? `<span class="meta">${esc(meta)}</span>` : ""}</div>`;

  window.PKS = { PALETTE, tr, kpi, notes, idrUnit, stackedYears, lineYears, hbar, trendView, downloadCsv, contextLine, changeText };
})();
