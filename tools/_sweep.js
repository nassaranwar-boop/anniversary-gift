/* how far off the touchline the cable cam should stand */
const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox', '--no-proxy-server', '--autoplay-policy=no-user-gesture-required'] });
  const p = await b.newPage({ viewport: { width: 960, height: 540 } });
  await p.route('**/*', r => r.request().url().startsWith('http://127.0.0.1') ? r.continue() : r.abort());
  await p.goto('http://127.0.0.1:8899/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForTimeout(900);
  await p.evaluate(() => { try { localStorage.clear(); } catch (e) {} showScreen('hub'); startHub(); });
  await p.waitForTimeout(250);
  await p.click('#hub-card-cup');
  await p.waitForFunction(() => window.OuissyCup && OuissyCup.__cup.state() !== null, { timeout: 60000 });
  await p.waitForTimeout(600);

  await p.evaluate(() => {
    const H = OuissyCup.__cup;
    H.quick(0); H.auto(true);
    for (let i = 0; i < 400 && H.state().state !== 'play'; i++) H.step(1, 0, 0, false);
    for (let i = 0; i < 900; i++) H.step(1, 0, 0, false);
    while (H.state().state !== 'play') H.step(1, 0, 0, false);
  });

  for (const back of [15, 28, 45, 70]) {
    const m = await p.evaluate((bk) => {
      const H = OuissyCup.__cup;
      H.side(true, bk);
      for (let i = 0; i < 2; i++) H.step(1, 0, 0, false);
      H.camSnap();
      const R = H.r2(), g = H.geometry().pitch;
      const row = (px) => +R.project(px - g.cx, 0).y.toFixed(0);
      return { back: bk, vh: R.vh,
               near: row(g.x0), mid: row(g.cx), far: row(g.x1),
               alongInShot: +((R.vw) / R.project(0, 0).k).toFixed(0) };
    }, back);
    console.log(JSON.stringify(m));
    await p.waitForTimeout(800);
    await p.screenshot({ path: '/tmp/sweep-' + back + '.png' });
  }
  console.log('DONE');
  await b.close();
})();
