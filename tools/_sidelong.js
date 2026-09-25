/* a whole half played side-on, at real frame rate, watching for errors */
const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox', '--no-proxy-server', '--autoplay-policy=no-user-gesture-required'] });
  const p = await b.newPage({ viewport: { width: 960, height: 540 } });
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  p.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
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
    H.quick(0); H.auto(true); H.side(true);
    window.__seen = {};
    window.__cam = [];
    const tick = () => {
      const s = H.state();
      if (!s) return;
      window.__seen[s.state] = (window.__seen[s.state] || 0) + 1;
      const R = H.r2();
      if (R) window.__cam.push([Math.round(R.cam.x), Math.round(R.cam.y), R.zoom]);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });

  /* let it play for the best part of a half, in real time */
  for (let i = 0; i < 12; i++) await p.waitForTimeout(5000);

  const out = await p.evaluate(() => {
    const H = OuissyCup.__cup;
    const s = H.state();
    const cam = window.__cam;
    const ys = cam.map(c => c[1]);
    return {
      states: window.__seen,
      frames: cam.length,
      score: s.score, clock: Math.round(s.clock), half: s.half, state: s.state,
      camXs: Array.from(new Set(cam.map(c => c[0]))).slice(0, 6),
      camYrange: [Math.min.apply(null, ys), Math.max.apply(null, ys)],
      zooms: Array.from(new Set(cam.map(c => c[2]))),
    };
  });
  console.log(JSON.stringify(out, null, 1));
  await p.screenshot({ path: '/tmp/sidelong.png' });
  console.log(errs.length ? 'ERRORS: ' + JSON.stringify(errs.slice(0, 6)) : 'no page errors');
  console.log('DONE');
  await b.close();
})();
