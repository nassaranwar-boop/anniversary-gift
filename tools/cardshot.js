/* node cardshot.js <out> <screen> [w] [h] */
const { chromium } = require('playwright-core'); const fs = require('fs');
const [out, screen, W=430, H=900] = process.argv.slice(2);
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox','--no-proxy-server','--disable-gpu','--font-render-hinting=none'] });
  const page = await browser.newPage({ viewport:{width:+W,height:+H}, deviceScaleFactor:2 });
  page.on('pageerror', e => console.log('PAGEERROR', e.message));
  await page.route('**/*', r => { const u=r.request().url();
    if (u.startsWith('http://127.0.0.1')||u.includes('fonts.g')) return r.continue(); return r.abort(); });
  await page.goto('http://127.0.0.1:8899/index.html', { waitUntil:'networkidle', timeout:60000 });
  await page.waitForTimeout(800);
  await page.evaluate((sc) => { try{localStorage.clear();}catch(e){} showScreen(sc); }, screen);
  await page.waitForTimeout(1300);
  /* scope to the screen we opened: page.$ would otherwise pick the first
     .details-card in the document, which is hidden and has no box */
  const el = await page.$('#screen-' + screen + ' .details-card');
  const b = await el.boundingBox();
  const cdp = await page.context().newCDPSession(page);
  const { data } = await cdp.send('Page.captureScreenshot', { format:'png',
    clip:{ x:b.x-22, y:b.y-22, width:b.width+44, height:b.height+44, scale:2 } });
  fs.writeFileSync(out, Buffer.from(data,'base64'));
  console.log('wrote', out);
  await browser.close();
})();
