/* node gateshot.js <out> [w] [h] [idle|typed|wrong|ok] */
const { chromium } = require('playwright-core'); const fs = require('fs');
const [out, W=390, H=844, mode='idle'] = process.argv.slice(2);
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox','--no-proxy-server','--disable-gpu','--font-render-hinting=none'] });
  const page = await browser.newPage({ viewport: { width: +W, height: +H }, isMobile: +W < 500, hasTouch: +W < 500 });
  page.on('pageerror', e => console.log('PAGEERROR', e.message));
  await page.route('**/*', r => { const u = r.request().url();
    if (u.startsWith('http://127.0.0.1') || u.includes('fonts.g')) return r.continue(); return r.abort(); });
  await page.goto('http://127.0.0.1:8899/index.html', { waitUntil:'networkidle', timeout:60000 });
  await page.waitForTimeout(700);
  await page.evaluate(() => { try{localStorage.clear();}catch(e){} showScreen('gate'); });
  await page.evaluate(() => document.fonts && document.fonts.ready);
  await page.waitForTimeout(1100);
  const tap = async k => { await page.click(`[data-gate-key="${k}"]`); await page.waitForTimeout(170); };
  if (mode === 'typed') { for (const k of ['2','2']) await tap(k); await page.waitForTimeout(300); }
  if (mode === 'wrong') { for (const k of ['1','1','1','1']) await tap(k); await page.waitForTimeout(360); }
  if (mode === 'ok')    { for (const k of ['2','2','0','7']) await tap(k); await page.waitForTimeout(560); }
  const cdp = await page.context().newCDPSession(page);
  const { data } = await cdp.send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(out, Buffer.from(data, 'base64'));
  console.log('wrote', out, mode);
  await browser.close();
})();
