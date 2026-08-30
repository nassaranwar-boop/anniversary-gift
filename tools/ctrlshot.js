const { chromium } = require('playwright-core'); const fs = require('fs');
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox','--no-proxy-server','--disable-gpu'] });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  page.on('pageerror', e => console.log('PAGEERROR', e.message));
  await page.route('**/*', r => r.request().url().startsWith('http://127.0.0.1') ? r.continue() : r.abort());
  await page.goto('http://127.0.0.1:8899/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(600);
  await page.evaluate(() => { try{localStorage.clear();}catch(e){} showScreen('ouissy'); startSuperOuissy(); });
  await page.waitForSelector('.so-diff-card', { timeout: 6000 });
  await page.click('[data-so-diff="medium"]'); await page.click('#so-play');
  await page.waitForTimeout(400);
  const how = await page.$('#so-how-ok'); if (how) await how.click();
  await page.waitForTimeout(4200);
  // hold right so one key shows its pressed state
  const b = await (await page.$('[data-so-key="right"]')).boundingBox();
  await page.mouse.move(b.x + b.width/2, b.y + b.height/2);
  await page.mouse.down();
  await page.waitForTimeout(400);
  console.log('css of the pad:', JSON.stringify(await page.evaluate(() => {
    const k = document.querySelector('.so-key-jump'), c = getComputedStyle(k);
    const r = document.querySelector('[data-so-key="right"]');
    return { jumpRadius: c.borderRadius, jumpBg: c.backgroundImage.slice(0, 40),
             jumpSize: Math.round(k.getBoundingClientRect().width),
             heldClass: r.className };
  })));
  await page.evaluate(() => { const st=document.createElement('style');
    st.textContent='*{backdrop-filter:none !important}'; document.head.appendChild(st); });
  const cdp = await page.context().newCDPSession(page);
  const { data } = await cdp.send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync('controls_phone.png', Buffer.from(data, 'base64'));
  await page.mouse.up();
  console.log('wrote controls_phone.png');
  await browser.close();
})();
