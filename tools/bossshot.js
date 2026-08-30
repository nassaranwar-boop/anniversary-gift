const { chromium } = require('playwright-core'); const fs = require('fs');
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox','--no-proxy-server','--disable-gpu'] });
  const page = await browser.newPage({ viewport: { width: 900, height: 560 } });
  page.on('pageerror', e => console.log('PAGEERROR', e.message));
  await page.route('**/*', r => r.request().url().startsWith('http://127.0.0.1') ? r.continue() : r.abort());
  await page.goto('http://127.0.0.1:8899/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(400);
  await page.evaluate(() => { window.__soTestDrive = true; try{localStorage.clear();}catch(e){} showScreen('ouissy'); startSuperOuissy(); });
  await page.waitForTimeout(300);
  await page.click('[data-so-diff="medium"]'); await page.click('#so-play'); await page.waitForTimeout(250);
  const how = await page.$('#so-how-ok'); if (how) await how.click();
  await page.waitForTimeout(2300);
  await page.evaluate(() => { window.__soTestDrive = true; window.__soGoLevel(2); });
  for (let i = 0; i < 30; i++) { await page.waitForTimeout(200);
    if (await page.evaluate(() => window.__soInfo().state === 'play')) break; }

  const grab = async (name) => {
    const d = await page.evaluate(() => {
      const src = document.getElementById('so-canvas');
      const o = document.createElement('canvas'); o.width = src.width*3; o.height = src.height*3;
      const c = o.getContext('2d'); c.imageSmoothingEnabled=false; c.drawImage(src,0,0,o.width,o.height);
      return o.toDataURL('image/png');
    });
    fs.writeFileSync(name+'.png', Buffer.from(d.split(',')[1],'base64'));
  };

  // park her a few tiles away and step until he is mid-tell / mid-open
  for (const [want, hp, name] of [['tell', 6, 'boss_tell'], ['open', 6, 'boss_open'], ['attack', 4, 'boss_rain']]) {
    await page.evaluate(([w, h]) => {
      window.__soTele(180);
      window.__soPlayer({ invuln: 99999, star: 0 });
      window.__soBossSet({ hp: h, hurt: 0, dead: 0, awake: true, mode: 'wait', modeT: 0.2, shots: [], vx: 0 });
      for (var i = 0; i < 60 * 12; i++) {
        window.__soPump(1/60, {});
        var b = window.__soBoss();
        if (b.mode === w && b.modeT < (w === 'tell' ? 0.35 : 0.9) && (w !== 'attack' || b.shots > 1)) break;
      }
    }, [want, hp]);
    await grab(name);
    console.log(name, JSON.stringify(await page.evaluate(() => window.__soBoss())));
  }
  await browser.close();
})();
