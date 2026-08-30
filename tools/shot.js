/* One screenshotter for the whole site. node shot.js <out> <screen> [w] [h]
   screen: gate | hub | ouissy | scrapbook | book ... anything showScreen takes */
const { chromium } = require('playwright-core'); const fs = require('fs');
const [out, screen, W = 1180, H = 900] = process.argv.slice(2);
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox','--no-proxy-server','--disable-gpu','--font-render-hinting=none'] });
  const page = await browser.newPage({ viewport: { width: +W, height: +H }, deviceScaleFactor: 1 });
  page.on('pageerror', e => console.log('PAGEERROR', e.message));
  await page.route('**/*', r => {
    const u = r.request().url();
    if (u.startsWith('http://127.0.0.1')) return r.continue();
    if (u.includes('fonts.googleapis') || u.includes('fonts.gstatic')) return r.continue();
    return r.abort();
  });
  await page.goto('http://127.0.0.1:8899/index.html', { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(900);
  if (screen && screen !== 'boot') {
    await page.evaluate((s) => { try{localStorage.clear();}catch(e){} showScreen(s);
      if (s === 'hub' && window.startHub) startHub(); }, screen);
    await page.waitForTimeout(1200);
  }
  await page.evaluate(() => { const st=document.createElement('style');
    st.textContent='*{backdrop-filter:none !important; animation-play-state:paused !important}';
    document.head.appendChild(st); });
  await page.waitForTimeout(250);
  const cdp = await page.context().newCDPSession(page);
  const { data } = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  fs.writeFileSync(out, Buffer.from(data, 'base64'));
  console.log('wrote', out, 'screen=' + screen);
  await browser.close();
})();
