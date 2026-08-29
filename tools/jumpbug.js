// The phantom jump: a press made while she cannot act must not be saved up
// and spent the moment she can.
const { chromium } = require('playwright-core');
const R = []; const ok = (n,c,x) => R.push((c?'PASS  ':'FAIL  ')+n+(x?'   '+x:''));
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox','--no-proxy-server','--disable-gpu'] });
  const page = await browser.newPage({ viewport: { width: 1000, height: 700 } });
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.route('**/*', r => r.request().url().startsWith('http://127.0.0.1') ? r.continue() : r.abort());
  await page.goto('http://127.0.0.1:8899/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(500);

  for (const diff of ['medium', 'hard']) {
    await page.evaluate(() => { window.__soTestDrive = true; try{localStorage.clear();}catch(e){}
      if (window.SuperOuissy) SuperOuissy.stop(); showScreen('ouissy'); startSuperOuissy(); });
    await page.waitForSelector('.so-diff-card', { timeout: 6000 });
    await page.click(`[data-so-diff="${diff}"]`); await page.click('#so-play');
    await page.waitForTimeout(300);
    const how = await page.$('#so-how-ok'); if (how) await how.click();
    for (let i = 0; i < 30; i++) { await page.waitForTimeout(200);
      if (await page.evaluate(() => window.__soInfo().state === 'play')) break; }
    await page.evaluate(() => { window.__soTestDrive = true; window.__soTele(12); window.__soPump(0.4, {}); });

    // hammer jump while she is dying
    await page.evaluate(() => { window.__soReset(); window.__soPlayer({ y: 99999 }); window.__soPump(0.4, {}); });
    for (let i = 0; i < 6; i++) {
      await page.keyboard.down('Space'); await page.waitForTimeout(20);
      await page.keyboard.up('Space');   await page.waitForTimeout(20);
    }
    // let the death and any rescue play out, then land
    await page.evaluate(() => window.__soPump(6.0, {}));
    const st = await page.evaluate(() => ({ p: window.__soPlayer(), s: window.__soInfo().state }));
    ok(diff + ': no phantom jump after respawn',
       st.s !== 'play' || (st.p.onGround === true && st.p.vy >= 0),
       'state=' + st.s + ' onGround=' + st.p.onGround + ' vy=' + Math.round(st.p.vy));

    // and a press during the world card must not be saved either
    await page.evaluate(() => window.__soGoLevel(0));
    await page.waitForTimeout(250);
    await page.keyboard.down('Space'); await page.waitForTimeout(40); await page.keyboard.up('Space');
    for (let i = 0; i < 30; i++) { await page.waitForTimeout(200);
      if (await page.evaluate(() => window.__soInfo().state === 'play')) break; }
    await page.evaluate(() => window.__soPump(0.5, {}));
    const st2 = await page.evaluate(() => window.__soPlayer());
    ok(diff + ': no phantom jump after the world card',
       st2.onGround === true && st2.vy >= 0,
       'onGround=' + st2.onGround + ' vy=' + Math.round(st2.vy));
  }
  console.log(R.join('\n'));
  console.log(errs.length ? 'ERRORS: ' + errs.join(' | ') : 'no page errors');
  await browser.close();
})();
