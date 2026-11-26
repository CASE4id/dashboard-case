// Screenshots for the guidebook, with numbered callouts.
// Usage: node shots.js OUTDIR BROKENFILE
const { chromium, devices } = require('playwright');
const OUT = process.argv[2], BROKEN = process.argv[3], OKFILE = process.argv[4];
const BASE = 'http://127.0.0.1:8101/';

async function mark(p, items) {
  // items: [[selector, number, {pad}]]
  await p.evaluate((items) => {
    document.querySelectorAll('.gb-mark').forEach((e) => e.remove());
    for (const [sel, n, o] of items) {
      const el = document.querySelector(sel);
      if (!el) { console.log('missing', sel); continue; }
      const r = el.getBoundingClientRect(), pad = (o && o.pad) ?? 4;
      const box = document.createElement('div');
      box.className = 'gb-mark';
      Object.assign(box.style, { position: 'absolute', left: r.left + scrollX - pad + 'px', top: r.top + scrollY - pad + 'px', width: r.width + pad * 2 + 'px', height: r.height + pad * 2 + 'px',
        border: '3px solid #e0245e', borderRadius: '10px', zIndex: 99999, pointerEvents: 'none', boxSizing: 'border-box' });
      const b = document.createElement('div');
      b.className = 'gb-mark'; b.textContent = n;
      const left = (o && o.side === 'right') ? r.right + scrollX + pad - 4 : r.left + scrollX - pad - 14;
      Object.assign(b.style, { position: 'absolute', left: left + 'px', top: r.top + scrollY - pad - 14 + 'px', width: '28px', height: '28px', borderRadius: '50%', background: '#e0245e', color: '#fff',
        font: '800 15px/28px system-ui, sans-serif', textAlign: 'center', zIndex: 100000, boxShadow: '0 2px 6px rgba(0,0,0,.3)', pointerEvents: 'none' });
      document.body.appendChild(box); document.body.appendChild(b);
    }
  }, items);
}

async function open(p, hash, h = 900) {
  await p.setViewportSize({ width: 1300, height: h });
  await p.goto('about:blank');
  await p.goto(BASE + hash);
  await p.waitForSelector('#view:not([hidden])', { timeout: 60000 });
  await p.waitForTimeout(1500);
}
async function shotEl(p, sel, file, extra = 0) {
  const r = await p.evaluate((s) => { const e = document.querySelector(s); const b = e.getBoundingClientRect(); return { x: b.left + scrollX, y: b.top + scrollY, w: b.width, h: b.height }; }, sel);
  await p.screenshot({ path: `${OUT}/${file}`, fullPage: true, clip: { x: Math.max(0, r.x - 10), y: Math.max(0, r.y - 10 - extra), width: Math.min(1300, r.w + 20), height: r.h + 20 + extra } });
}

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1300, height: 900 }, deviceScaleFactor: 2 });
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));

  // 1. Overview with header controls
  await open(p, '#tab=summary&lang=id');
  await mark(p, [['#sectorNav', 1], ['.lang-toggle', 2, { side: 'right' }], ['#unitSelect', 3], ['#yearSelect', 4], ['#tabs', 5]]);
  await p.screenshot({ path: `${OUT}/d_header.png`, clip: { x: 0, y: 0, width: 1300, height: 300 } });
  await mark(p, []);
  await p.screenshot({ path: `${OUT}/d_summary.png`, clip: { x: 0, y: 0, width: 1300, height: 900 } });

  // 2. KPI card anatomy
  await open(p, '#tab=summary&unit=uid_aceh&year=2025&lang=id', 1100);
  await mark(p, [['.kpi .value', 1, { side: 'right' }], ['.kpi .compare', 2, { side: 'right' }], ['.kpi .note', 3, { side: 'right' }]]);
  await shotEl(p, '.grid.kpis', 'd_kpi.png', 60);
  await mark(p, []);
  await shotEl(p, '.banner.warn', 'd_localnote.png');

  // 3. Perbandingan
  await open(p, '#tab=compare&indicator=electrification_ratio&lang=id', 1400);
  await mark(p, [['#indSelect', 1], ['#scopeSelect', 2], ['#cRank', 3, { pad: -2 }]]);
  await p.screenshot({ path: `${OUT}/d_compare.png`, clip: { x: 0, y: 260, width: 1300, height: 760 } });

  // 4. Analisis: dua indikator
  await open(p, '#tab=analysis&amode=xy&unit=uid_aceh&abase=2016&lang=id', 1500);
  await mark(p, [['.seg', 1], ['#axSelect', 2], ['#aySelect', 3], ['#baseSelect', 4], ['.toolbar.checks', 5], ['.stat', 6]]);
  await p.screenshot({ path: `${OUT}/d_scatter.png`, clip: { x: 0, y: 260, width: 1300, height: 1060 } });

  // 5. Analisis: antar tahun
  await open(p, '#tab=analysis&amode=years&indicator=electrification_ratio&unit=uiw_nusa_tenggara_timur&lang=id', 1900);
  await mark(p, [['#indSelect', 1], ['#y1Select', 2], ['#y2Select', 3], ['#cTrend', 4, { pad: -2 }], ['#cChange', 5, { pad: -2 }]]);
  await p.screenshot({ path: `${OUT}/d_years.png`, clip: { x: 0, y: 260, width: 1300, height: 1250 } });
  await mark(p, []);
  await p.evaluate(() => { const d = document.querySelector('details.quality'); if (d) d.open = true; });
  if (await p.$('details.quality')) await shotEl(p, 'details.quality', 'd_quality.png');

  // 6. Data & Unduh
  await open(p, '#tab=data&table=t19&year=2025&lang=id', 1100);
  await mark(p, [['#tableSelect', 1], ['#csvBtn', 2], ['#csvBtn + a', 3]]);
  await p.screenshot({ path: `${OUT}/d_data.png`, clip: { x: 0, y: 260, width: 1300, height: 640 } });

  // 7. Footer
  await open(p, '#tab=summary&lang=id', 900);
  await mark(p, [['#sourceText', 1], ['#yearsText', 2], ['.staff-links', 3, { side: 'right' }]]);
  await shotEl(p, 'footer', 'd_footer.png', 10);

  // 8. Gas & udara
  await open(p, '#sector=gas&tab=summary&lang=id', 900);
  await p.screenshot({ path: `${OUT}/g_summary.png`, clip: { x: 0, y: 0, width: 1300, height: 900 } });
  await open(p, '#sector=udara&tab=summary&lang=id', 900);
  await p.screenshot({ path: `${OUT}/u_summary.png`, clip: { x: 0, y: 0, width: 1300, height: 900 } });
  await open(p, '#sector=udara&tab=airports&lang=id', 2400);
  await p.fill('#aptSearch', 'Bali');
  await p.waitForTimeout(400);
  await mark(p, [['#measureSelect', 1], ['#aptSearch', 2]]);
  await shotEl(p, '#aptSearch', 'u_search.png', 50);
  await p.evaluate(() => scrollTo(0, 0));
  await open(p, '#sector=gas&tab=trend&series=g04.total&lang=id', 1300);
  await mark(p, [['#seriesSelect', 1], ['.stat', 2]]);
  await p.screenshot({ path: `${OUT}/g_trend.png`, clip: { x: 0, y: 260, width: 1300, height: 900 } });

  // 9. English
  await open(p, '#tab=summary&lang=en', 900);
  await p.screenshot({ path: `${OUT}/d_english.png`, clip: { x: 0, y: 0, width: 1300, height: 560 } });

  // 10. Cek Data
  await p.setViewportSize({ width: 1300, height: 900 });
  await p.goto(BASE + 'cek-data.html'); await p.waitForTimeout(600);
  await mark(p, [['#drop', 1]]);
  await p.screenshot({ path: `${OUT}/c_empty.png`, clip: { x: 0, y: 0, width: 1300, height: 640 } });
  await mark(p, []);
  await p.setInputFiles('#file', OKFILE); await p.waitForSelector('.verdict');
  await p.waitForTimeout(300);
  await shotEl(p, '#result', 'c_ok.png');
  await p.goto(BASE + 'cek-data.html'); await p.waitForTimeout(400);
  await p.setInputFiles('#file', BROKEN); await p.waitForSelector('.verdict');
  await p.waitForTimeout(300);
  const h = await p.evaluate(() => document.querySelector('#result').getBoundingClientRect().height);
  await p.setViewportSize({ width: 1300, height: Math.ceil(h) + 900 });
  await shotEl(p, '#result', 'c_err.png');

  // 11. Phone
  const ctx = await b.newContext({ ...devices['iPhone 13'] });
  const m = await ctx.newPage();
  await m.goto(BASE + '#tab=summary&lang=id'); await m.waitForSelector('#view:not([hidden])'); await m.waitForTimeout(1500);
  await m.screenshot({ path: `${OUT}/d_phone.png` });

  console.log('errors', errs);
  await b.close();
})();
