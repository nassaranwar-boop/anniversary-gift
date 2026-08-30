const { chromium } = require('playwright-core'); const fs = require('fs');
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox','--no-proxy-server','--disable-gpu'] });
  const page = await browser.newPage({ viewport: { width: 900, height: 560 } });
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.route('**/*', r => r.request().url().startsWith('http://127.0.0.1') ? r.continue() : r.abort());
  await page.goto('http://127.0.0.1:8899/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(400);
  await page.evaluate(() => { window.__soTestDrive = true; try{localStorage.clear();}catch(e){} showScreen('ouissy'); startSuperOuissy(); });
  await page.waitForTimeout(300);
  await page.click(`[data-so-diff="${process.env.DIFF||'easy'}"]`); await page.click('#so-play'); await page.waitForTimeout(250);
  const how = await page.$('#so-how-ok'); if (how) await how.click();
  for (let i = 0; i < 30; i++) { await page.waitForTimeout(200);
    if (await page.evaluate(() => window.__soInfo().state === 'play')) break; }
  const shots = JSON.parse(process.env.SHOTS || '[]');
  for (const sh of shots) {
    if (sh.world !== undefined) {
      await page.evaluate(w => window.__soGoLevel(w), sh.world);
      for (let i = 0; i < 30; i++) { await page.waitForTimeout(200);
        if (await page.evaluate(() => window.__soInfo().state === 'play')) break; }
    }
    await page.evaluate(a => { window.__soTele(a); window.__soPump(0.4, {}); }, sh.at || 10);
    const d = await page.evaluate(() => {
      const src = document.getElementById('so-canvas');
      const o = document.createElement('canvas'); o.width = src.width*3; o.height = src.height*3;
      const c = o.getContext('2d'); c.imageSmoothingEnabled=false; c.drawImage(src,0,0,o.width,o.height);
      return o.toDataURL('image/png');
    });
    fs.writeFileSync(sh.name+'.png', Buffer.from(d.split(',')[1],'base64'));
  }
  console.log(JSON.stringify({ errors: errs, state: await page.evaluate(()=>window.__soState()) }));
  await browser.close();
})();
