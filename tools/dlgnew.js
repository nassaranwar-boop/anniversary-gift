/* the rescue dialogue, in the new pixel face */
const { chromium } = require('playwright-core'); const fs = require('fs');
(async () => {
  const browser = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args:['--no-sandbox','--no-proxy-server','--disable-gpu','--font-render-hinting=none'] });
  const page = await browser.newPage({ viewport:{width:1180,height:900} });
  page.on('pageerror', e=>console.log('ERR', e.message));
  await page.route('**/*', r => { const u=r.request().url();
    if (u.startsWith('http://127.0.0.1')||u.includes('fonts.g')) return r.continue(); return r.abort(); });
  await page.goto('http://127.0.0.1:8899/index.html', { waitUntil:'networkidle', timeout:60000 });
  await page.evaluate(() => document.fonts && document.fonts.ready);
  await page.waitForTimeout(900);
  await page.evaluate(() => { window.__soTestDrive = true; try{localStorage.clear();}catch(e){}
    showScreen('ouissy'); startSuperOuissy(); });
  await page.waitForSelector('.so-diff-card', { timeout:6000 });
  await page.click('[data-so-diff="hard"]'); await page.click('#so-play');
  await page.waitForTimeout(300);
  const how = await page.$('#so-how-ok'); if (how) await how.click();
  for (let i=0;i<30;i++){ await page.waitForTimeout(150);
    if (await page.evaluate(()=>window.__soInfo().state==='play')) break; }
  // a normal death on Hard: he comes and picks her up
  await page.evaluate(() => {
    window.__soPlayer({ y: 99999 });
    for (let i=0;i<400;i++){ window.__soPump(0.05);
      const s = window.Rescue && Rescue._state();
      if (s && s.kind === 'rescue' && s.phase === 2 && s.shown > 12) break; }
  });
  await page.waitForTimeout(250);
  const cdp = await page.context().newCDPSession(page);
  const { data } = await cdp.send('Page.captureScreenshot', { format:'png' });
  fs.writeFileSync('dlg_font.png', Buffer.from(data,'base64'));
  console.log('wrote dlg_font.png');
  await browser.close();
})();
