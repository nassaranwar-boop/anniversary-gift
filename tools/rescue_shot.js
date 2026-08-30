const { chromium } = require('playwright-core'); const fs = require('fs');
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox','--no-proxy-server','--disable-gpu'] });
  const page = await browser.newPage({ viewport: { width: 900, height: 560 } });
  const errs=[]; page.on('pageerror', e => errs.push(e.message));
  await page.route('**/*', r => r.request().url().startsWith('http://127.0.0.1') ? r.continue() : r.abort());
  await page.goto('http://127.0.0.1:8899/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(500);
  await page.evaluate(() => { window.__soTestDrive = true; try{localStorage.clear();}catch(e){} showScreen('ouissy'); startSuperOuissy(); });
  await page.waitForTimeout(300);
  await page.click('[data-so-diff="hard"]'); await page.click('#so-play'); await page.waitForTimeout(250);
  const how = await page.$('#so-how-ok'); if (how) await how.click();
  for (let i = 0; i < 30; i++) { await page.waitForTimeout(200);
    if (await page.evaluate(() => window.__soInfo().state === 'play')) break; }
  await page.evaluate(() => { window.__soTestDrive = true; window.__soTele(20); window.__soPump(0.3, {}); });

  const shot = async (name) => {
    const d = await page.evaluate(() => {
      const src = document.getElementById('so-canvas');
      const o = document.createElement('canvas'); o.width = src.width*3; o.height = src.height*3;
      const c = o.getContext('2d'); c.imageSmoothingEnabled=false; c.drawImage(src,0,0,o.width,o.height);
      return o.toDataURL('image/png');
    });
    fs.writeFileSync(name+'.png', Buffer.from(d.split(',')[1],'base64'));
  };

  // kill her and watch the rescue
  console.log('before:', await page.evaluate(() => window.__soInfo().state));
  await page.evaluate(() => { window.__soPlayer({ y: 99999 }); });
  await page.evaluate(() => window.__soPump(2.2, {}));      // through the death arc
  console.log('after death pump:', await page.evaluate(() => window.__soInfo().state));
  for (const [wait, name] of [[0.5,'r_walk'],[0.55,'r_line'],[0.9,'r_line2']]) {
    await page.evaluate(w => { for (var i=0;i<w*60;i++){ Rescue.step(1/60); } 
      var c = document.getElementById('so-canvas').getContext('2d');
      Rescue.paint(c, performance.now()/1000); }, wait);
    await shot(name);
    console.log(name, JSON.stringify(await page.evaluate(() => {
      var s = Rescue._state(); return s && { phase: s.phase, pt: +s.pt.toFixed(2), done: s.done, ax: Math.round(s.anwar.x) }; })));
  }
  console.log('errors:', errs);
  await browser.close();
})();
