const { chromium } = require('playwright-core'); const fs = require('fs');
(async () => {
  const [name, w, h] = [process.argv[2], +(process.argv[3]||1180), +(process.argv[4]||780)];
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox','--no-proxy-server','--disable-gpu'] });
  const page = await browser.newPage({ viewport: { width: w, height: h },
    isMobile: w < 900, hasTouch: w < 900, deviceScaleFactor: 1 });
  page.on('pageerror', e => console.log('PAGEERROR', e.message));
  await page.route('**/*', r => r.request().url().startsWith('http://127.0.0.1') ? r.continue() : r.abort());
  await page.goto('http://127.0.0.1:8899/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(400);
  await page.evaluate(() => { try{localStorage.clear();}catch(e){} showScreen('ouissy'); startSuperOuissy(); });
  await page.waitForTimeout(1600);            // let the scene drift a little
  if (process.env.HOWTO) { await page.click('#so-howto'); await page.waitForTimeout(700); }
  await page.evaluate(() => { window.__soHalt();
    const st = document.createElement('style');
    st.textContent = '*{backdrop-filter:none !important;-webkit-backdrop-filter:none !important;}';
    document.head.appendChild(st); });
  await page.waitForTimeout(150);
  const cdp = await page.context().newCDPSession(page);
  const { data } = await cdp.send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(name, Buffer.from(data, 'base64'));
  console.log('wrote', name);
  await browser.close();
})();
