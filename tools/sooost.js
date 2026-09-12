/* THE SCORE FOLLOWS HER. One tune per world, one for the Queen, the same
   one hurried when the clock is short, and the ending's own. */
const { chromium } = require('playwright-core');
const R = []; const ok = (n, c, x) => R.push((c ? 'ok   ' : 'FAIL ') + n + (x ? '   ' + x : ''));
(async () => {
  const browser = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args:['--no-sandbox','--no-proxy-server','--disable-gpu','--use-gl=swiftshader','--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport:{width:1180,height:900} });
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.route('**/*', r => r.request().url().startsWith('http://127.0.0.1') ? r.continue() : r.abort());
  await page.goto('http://127.0.0.1:8899/index.html', { waitUntil:'domcontentloaded', timeout:60000 });
  await page.waitForFunction(() => !!window.SuperOuissy, { timeout:30000 });
  const boot = async (d) => {
    await page.evaluate(() => { window.__soTestDrive = true; try{localStorage.clear();}catch(e){}
      SuperOuissy.stop(); showScreen('ouissy'); startSuperOuissy(); });
    await page.waitForSelector('.so-diff-card', { timeout:6000 });
    await page.click(`[data-so-diff="${d}"]`); await page.click('#so-play');
    await page.waitForTimeout(250);
    const how = await page.$('#so-how-ok'); if (how) await how.click();
    await page.waitForFunction(() => window.__soInfo().state === 'play', { timeout:8000 });
  };

  /* the tunes themselves have to be real music, not a row of rests */
  const shape = await page.evaluate(() => {
    const out = {};
    for (const n of ['w1','w2','w3','boss','win']) {
      window.__soBgmPlay(n);
      const b = window.__soBgmBar();
      out[n] = b;
    }
    return out;
  });
  for (const n of ['w1','w2','w3','boss','win']) {
    const b = shape[n];
    ok(`${n}: four bars of sixteenths`, b.steps === 64, `steps=${b.steps}`);
    ok(`${n}: there is a tune in it`, b.leadNotes >= 8, `lead notes=${b.leadNotes}`);
    ok(`${n}: and something under it`, b.bassNotes >= 8, `bass notes=${b.bassNotes}`);
  }

  await boot('hard');
  const w1 = await page.evaluate(() => window.__soBgmName());
  ok('world one plays world one', w1 === 'w1', w1);

  await page.evaluate(() => window.__soGoLevel(1));
  await page.waitForFunction(() => window.__soInfo().state === 'play', { timeout:8000 });
  ok('world two is a different arrangement', await page.evaluate(() => window.__soBgmName()) === 'w2', '');

  await page.evaluate(() => window.__soGoLevel(2));
  await page.waitForFunction(() => window.__soInfo().state === 'play', { timeout:8000 });
  ok('world three is its own', await page.evaluate(() => window.__soBgmName()) === 'w3', '');

  /* the clock */
  const rush = await page.evaluate(() => {
    window.__soSetTime(28); window.__soPump(1/60);
    return window.__soBgmName();
  });
  ok('a short clock hurries the same tune rather than replacing it', rush === 'w3+rush', rush);

  /* the Queen */
  const bossName = await page.evaluate(() => {
    window.__soSetTime(150);
    window.__soBossSet({ awake: false });
    window.__soTele(Math.round(window.G_bossTile()) - 6);
    for (let i = 0; i < 60; i++) window.__soPump(1/60);
    return window.__soBgmName();
  });
  ok('the Queen brings her own', bossName === 'boss', bossName);

  const afterBoss = await page.evaluate(() => {
    window.__soKillBoss();
    for (let i = 0; i < 30; i++) window.__soPump(1/60);
    return window.__soBgmName();
  });
  ok('and the world gets its tune back when she goes down', afterBoss === 'w3', afterBoss);

  /* the ending */
  const end = await page.evaluate(() => { window.__soShowEnding(); return window.__soBgmName(); });
  ok('the ending is not silence any more', end === 'win', end);

  /* ---- and she has a voice now ---- */
  const said = {};
  for (const d of ['easy','medium','hard']) {
    await boot(d);
    await page.evaluate(() => window.__soGoLevel(2));
    /* the world card holds the game for a couple of real seconds, and
       pumping does not advance a timer — so this waits for it to go
       rather than driving a paused game */
    await page.waitForFunction(() => window.__soInfo().state === 'play', { timeout: 8000 });
    said[d] = await page.evaluate(() => {
      const grab = () => { const e = document.getElementById('so-boss-say');
                           return e && /\bon\b/.test(e.className) ? e.textContent : null; };
      window.__soBossSet({ awake: false });
      window.__soTele(Math.round(window.G_bossTile()) - 6);
      for (let i = 0; i < 90; i++) window.__soPump(1/60);
      const wake = grab();
      window.__soBossSet({ hp: Math.ceil(window.__soBoss().hpMax / 2) });
      window.__soBossStomp();
      for (let i = 0; i < 30; i++) window.__soPump(1/60);
      const mid = grab();
      window.__soKillBoss();
      for (let i = 0; i < 20; i++) window.__soPump(1/60);
      return { wake: wake, mid: mid, skin: window.__soDiffFlag('bossSkin') };
    });
  }
  for (const d of ['easy','medium','hard']) {
    ok(`${d}: she says something when she notices her`, !!said[d].wake, JSON.stringify(said[d]));
  }
  ok('and the three of them are three different characters',
     said.easy.wake !== said.medium.wake && said.medium.wake !== said.hard.wake,
     [said.easy.wake, said.medium.wake, said.hard.wake].join(' / '));

  ok('no page errors', errs.length === 0, errs.slice(0,2).join(' | '));
  await browser.close();
  console.log(R.join('\n'));
  const bad = R.filter(x => x.startsWith('FAIL')).length;
  console.log(`\n${R.length - bad} passed, ${bad} failed`);
  process.exit(bad ? 1 : 0);
})();
