/* A contact sheet run: every overlay and beat in the chapter, one png each. */
const { chromium } = require('playwright-core'); const fs = require('fs');
const outdir = process.argv[2];
const shots = process.argv.slice(3);
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox','--no-proxy-server','--disable-gpu','--font-render-hinting=none'] });
  const page = await browser.newPage({ viewport: { width: 1180, height: 820 }, deviceScaleFactor: 1 });
  page.on('pageerror', e => console.log('PAGEERROR', e.message));
  await page.route('**/*', r => {
    const u = r.request().url();
    if (u.startsWith('http://127.0.0.1')) return r.continue();
    if (u.includes('fonts.g')) return r.continue();
    return r.abort();
  });
  await page.goto('http://127.0.0.1:8899/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);
  const cdp = await page.context().newCDPSession(page);
  for (const s of shots) {
    await page.evaluate(() => { try{localStorage.clear();}catch(e){} });
    await page.evaluate(() => { if (window.Apocalypse) Apocalypse.stop(); showScreen('apoc'); Apocalypse.start(); });
    await page.waitForTimeout(200);
    if (s !== 'howto') { await page.evaluate(() => window.__apEnter(0)); }
    if (s !== 'play' && s !== 'howto') await page.evaluate(a => window.__apOpen(a), s);
    if (s === 'howto') await page.evaluate(() => { window.__apOpen('howto'); });
    await page.waitForTimeout(500);
    await page.evaluate(() => window.__apPaint && window.__apPaint());
    await page.waitForTimeout(200);
    const { data } = await cdp.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(`${outdir}/ap-${s}.png`, Buffer.from(data, 'base64'));
    console.log('wrote', s);
  }
  await browser.close();
})();
