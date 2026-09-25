/* where the side-on lens actually puts the pitch */
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

  const out = await p.evaluate(() => {
    const H = OuissyCup.__cup;
    H.quick(0); H.auto(true);
    for (let i = 0; i < 400 && H.state().state !== 'play'; i++) H.step(1, 0, 0, false);
    for (let i = 0; i < 900; i++) H.step(1, 0, 0, false);
    while (H.state().state !== 'play') H.step(1, 0, 0, false);
    H.side(true);
    for (let i = 0; i < 4; i++) H.step(1, 0, 0, false);
    H.camSnap();
    const R = H.r2 ? H.r2() : null;
    const g = H.geometry().pitch;
    if (!R) return { err: 'no renderer hook', geom: g };
    const rows = {};
    const probe = (label, px) => {
      const pr = R.project(px - g.cx, 0);
      rows[label] = { y: +pr.y.toFixed(1), d: +pr.d.toFixed(1), k: +pr.k.toFixed(3) };
    };
    probe('nearTouch', g.x0);
    probe('mid', g.cx);
    probe('farTouch', g.x1);
    return {
      vw: R.vw, vh: R.vh, zoom: R.zoom, k: +R.k.toFixed(4),
      cam: { x: +R.cam.x.toFixed(1), y: +R.cam.y.toFixed(1) },
      A: +R.A.toFixed(2), B: +R.B.toFixed(2),
      rows: rows,
      focusD: R.focusD ? +R.focusD.toFixed(1) : null,
      /* how much of the pitch's LENGTH is in shot at mid depth */
      alongHalf: +((R.vw / 2) / R.project(0, 0).k).toFixed(1),
      pitch: { w: g.w, h: g.h, x0: g.x0, x1: g.x1, cx: g.cx },
      mode: H.geometry().cam,
    };
  });
  console.log(JSON.stringify(out, null, 1));
  await b.close();
})();
