/* Captures the 3D intro book at a given timeline time via __bookCapture.
   node introshot.js <out> [t] [camArgs...] */
const { chromium } = require('playwright-core'); const fs = require('fs');
const out = process.argv[2], t = parseFloat(process.argv[3] || '0');
const cam = process.argv.slice(4).map(Number);
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox','--no-proxy-server','--use-gl=swiftshader','--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 1100, height: 800 }, deviceScaleFactor: 1 });
  page.on('pageerror', e => console.log('PAGEERROR', e.message));
  page.on('console', m => { const x = m.text(); if (/error|fail|bail/i.test(x)) console.log('CONSOLE:', x); });
  await page.route('**/*', r => {
    const u = r.request().url();
    if (u.startsWith('http://127.0.0.1')) return r.continue();
    if (u.includes('fonts.googleapis') || u.includes('fonts.gstatic')) return r.continue();
    return r.abort();
  });
  await page.goto('http://127.0.0.1:8899/index.html', { waitUntil: 'networkidle', timeout: 90000 });
  try {
    await page.waitForFunction(() => window.__bookCapture && window.__bookCapture.ready, { timeout: 60000 });
  } catch (e) { console.log('!! __bookCapture never became ready'); await browser.close(); return; }
  if (cam.length === 6) await page.evaluate((c) => window.__bookCapture.cam(...c), cam);
  await page.evaluate((tt) => window.__bookCapture.frame(tt), t);
  await page.waitForTimeout(500);
  const cdp = await page.context().newCDPSession(page);
  const { data } = await cdp.send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(out, Buffer.from(data, 'base64'));
  console.log('wrote', out, 't=' + t);
  await browser.close();
})();
