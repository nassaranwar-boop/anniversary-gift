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
  // straight into the death scene, without having to lose a real fight
  await page.evaluate(() => { window.__soGoLevel(2); });
  for (let i = 0; i < 30; i++) { await page.waitForTimeout(200);
    if (await page.evaluate(() => window.__soInfo().state === 'play')) break; }
  await page.evaluate(() => { window.__soTele(Math.round(G_bossTile()) - 5); window.__soPump(0.3, {}); });

  const shot = async (n) => {
    const d = await page.evaluate(() => {
      const src = document.getElementById('so-canvas');
      const o = document.createElement('canvas'); o.width = src.width*3; o.height = src.height*3;
      const c = o.getContext('2d'); c.imageSmoothingEnabled=false; c.drawImage(src,0,0,o.width,o.height);
      return o.toDataURL('image/png'); });
    fs.writeFileSync(n+'.png', Buffer.from(d.split(',')[1],'base64'));
  };
  const st = () => page.evaluate(() => { var s = Rescue._state();
    return s && { phase: s.phase, pt: +s.pt.toFixed(2), chill: +s.chill.toFixed(2), sel: s.sel, done: s.done, out: s.outcome }; });

  await page.evaluate(() => window.__soDieToBoss());
  await page.evaluate(() => window.__soPump(2.2, {}));
  console.log('entered:', await page.evaluate(() => window.__soInfo().state), JSON.stringify(await st()));

  // walk it the way a player would: press to advance, wait where it waits
  const advance = async (n) => {
    for (let i = 0; i < n; i++) {
      await page.evaluate(() => { Rescue.press('confirm'); window.__soPump(0.35, {}); });
    }
  };
  await page.evaluate(() => window.__soPump(1.3, {}));
  await shot('d1_arrive'); console.log('arrive ', JSON.stringify(await st()));
  await advance(3);                                  // through his two lines
  await page.evaluate(() => window.__soPump(1.1, {}));
  await shot('d2_chill');  console.log('chill  ', JSON.stringify(await st()));
  await page.evaluate(() => window.__soPump(2.6, {}));
  await shot('d3_enter');  console.log('enter  ', JSON.stringify(await st()));
  // press only while it is still talking; stop the moment the choice is up
  const untilPhase = async (want, cap) => {
    for (let i = 0; i < (cap || 60); i++) {
      const s = await st();
      if (!s || s.phase >= want) return;
      await page.evaluate(() => { Rescue.press('confirm'); window.__soPump(0.3, {}); });
    }
  };
  await untilPhase(4);
  await page.evaluate(() => window.__soPump(0.5, {}));
  await shot('d4_swing');  console.log('swing  ', JSON.stringify(await st()));
  await page.evaluate(() => window.__soPump(0.75, {}));
  await shot('d5_caught'); console.log('caught ', JSON.stringify(await st()));
  await untilPhase(6);
  await shot('d6_choice'); console.log('choice ', JSON.stringify(await st()));
  await page.evaluate(() => { Rescue.press('right'); Rescue.step(1/60);
    Rescue.paint(document.getElementById('so-canvas').getContext('2d'), 1); });
  await shot('d7_choice2'); console.log('choice2', JSON.stringify(await st()));
  console.log('errors:', errs);
  await browser.close();
})();
