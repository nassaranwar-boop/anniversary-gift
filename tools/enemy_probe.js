// Do enemies stay out of pits, and do they stop bobbing?
const { chromium } = require('playwright-core');
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
  await page.evaluate(() => { window.__soTestDrive = true; });

  // put her next to the walker that sits four tiles from the first pit,
  // then let the world run for a long time with the camera parked there
  const r = await page.evaluate(() => {
    window.__soTele(52);
    var e = window.__soEnemies()[0];
    var ys = [], xs = [], survived = 0, total = 0;
    for (var i = 0; i < 60 * 40; i++) {         // forty seconds of game time
      window.__soPump(1 / 60, {});
      if (i % 30 === 0) {
        var list = window.__soEnemies();
        total = list.length;
        survived = list.filter(function (x) { return x.alive && x.y < 400; }).length;
        var near = list.filter(function (x) { return x.type !== 'flyer' && x.alive; })
                       .sort(function (a,b){ return Math.abs(a.x-864) - Math.abs(b.x-864); })[0];
        if (near) { ys.push(Math.round(near.y)); xs.push(Math.round(near.x)); }
      }
    }
    // how much did a grounded walker's y wobble once settled?
    var tail = ys.slice(4);
    return { total: total, survived: survived,
             yMin: Math.min.apply(null, tail), yMax: Math.max.apply(null, tail),
             xMin: Math.min.apply(null, xs), xMax: Math.max.apply(null, xs),
             pitStartsAtX: 48 * 16 };
  });
  console.log('after 40s of game time:', JSON.stringify(r));
  await browser.close();
})();
