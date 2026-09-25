const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox', '--no-proxy-server'] });
  const p = await b.newPage({ viewport: { width: 960, height: 540 } });
  await p.route('**/*', r => r.request().url().startsWith('http://127.0.0.1') ? r.continue() : r.abort());
  await p.goto('http://127.0.0.1:8899/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForTimeout(900);
  await p.evaluate(() => { try { localStorage.clear(); } catch (e) {} showScreen('hub'); startHub(); });
  await p.waitForTimeout(250);
  await p.click('#hub-card-cup');
  await p.waitForFunction(() => window.OuissyCup && OuissyCup.__cup.state() !== null, { timeout: 60000 });
  await p.waitForTimeout(600);
  console.log(JSON.stringify(await p.evaluate(() => {
    const H = OuissyCup.__cup;
    H.quick(0);
    for (let i = 0; i < 400 && H.state().state !== 'play'; i++) H.step(1, 0, 0, false);
    const R = H.r2(), g = H.geometry();
    /* rebuild the stand's own arithmetic to see where the roof lands */
    const w = R.raw;
    const goal = R.swap ? R.project(w.halfW, 0) : R.project(0, w.len);
    const base = Math.min(R.vh - 1, Math.max(0, Math.round(
      (R.swap ? R.project(w.halfW + 7 / R.k, 0) : R.project(0, w.len + 7 / R.k)).y)));
    const bh = Math.max(3, Math.round(goal.k * 1.6 / R.k));
    const lip = Math.max(0, base - bh);
    return { vh: R.vh, base, bh, lip, venue: g.cam && g.cam.mode,
             sky: window.CupPitch2D.COLOURS.sky,
             standTiersTotal: 26 + 20 + 13 };
  }), null, 1));
  await b.close();
})();
