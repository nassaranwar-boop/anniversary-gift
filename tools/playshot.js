const { chromium } = require('playwright-core'); const fs = require('fs');
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox','--no-proxy-server','--disable-gpu'] });
  const page = await browser.newPage({ viewport: { width: 1180, height: 780 }, deviceScaleFactor: 1 });
  page.on('pageerror', e => console.log('PAGEERROR', e.message));
  await page.route('**/*', r => r.request().url().startsWith('http://127.0.0.1') ? r.continue() : r.abort());
  await page.goto('http://127.0.0.1:8899/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(600);
  await page.evaluate(() => { try{localStorage.clear();}catch(e){} showScreen('ouissy'); startSuperOuissy(); });
  await page.waitForSelector('.so-diff-card', { timeout: 6000 });
  await page.waitForTimeout(1400);
  const cdp = await page.context().newCDPSession(page);
  const grab = async (name) => {
    await page.evaluate(() => { const st=document.createElement('style');
      st.textContent='*{backdrop-filter:none !important}'; document.head.appendChild(st); });
    await page.waitForTimeout(150);
    const { data } = await cdp.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(name, Buffer.from(data, 'base64'));
    console.log('wrote', name);
  };
  await grab('shot_menu.png');

  await page.click('[data-so-diff="easy"]'); await page.click('#so-play');
  await page.waitForTimeout(400);
  const how = await page.$('#so-how-ok'); if (how) await how.click();
  await page.waitForTimeout(4200);
  // give her some hearts so the meter is not empty in the shot
  await page.evaluate(() => window.__soSetMeter(13));
  await page.keyboard.down('ArrowRight'); await page.waitForTimeout(1500); await page.keyboard.up('ArrowRight');
  await page.waitForTimeout(300);
  await grab('shot_playing.png');
  await browser.close();
})();
