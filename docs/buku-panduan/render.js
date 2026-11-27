const { chromium } = require('playwright');
(async () => {
  const [src, out] = process.argv.slice(2);
  const b = await chromium.launch({ proxy: { server: process.env.HTTPS_PROXY } });
  const p = await b.newPage();
  await p.goto('file://' + src, { waitUntil: 'networkidle' });
  await p.evaluate(() => document.fonts.ready);
  console.log('font ok:', await p.evaluate(() => document.fonts.check('12px "Plus Jakarta Sans"')));
  await p.pdf({ path: out, format: 'A4', printBackground: true, displayHeaderFooter: true,
    headerTemplate: '<div></div>',
    footerTemplate: '<div style="width:100%;font-size:8px;color:#8a98ad;padding:0 16mm;display:flex;justify-content:space-between;font-family:sans-serif"><span>Buku Panduan Dashboard PraKTIk · Direktorat TKKA, Kementerian PPN/Bappenas</span><span><span class="pageNumber"></span> / <span class="totalPages"></span></span></div>',
    margin: { top: '16mm', bottom: '18mm', left: '16mm', right: '16mm' } });
  await b.close();
})();
