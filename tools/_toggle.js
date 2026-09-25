/* does turning the pitch back upright leave the camera somewhere daft? */
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

  const snap = (label, on) => p.evaluate(([l, o]) => {
    const H = OuissyCup.__cup;
    H.side(o); H.camSnap();
    const R = H.r2(), s = H.state(), g = H.geometry();
    return { label: l, side: o, swap: R.swap, k: +R.k.toFixed(4),
             cam: { x: +R.cam.x.toFixed(1), y: +R.cam.y.toFixed(1) },
             camNow: g.cam, mode: g.cam.mode, zoom: R.zoom,
             ball: [Math.round(s.ballX), Math.round(s.ballY)],
             groundRowAtBall: +R.project(s.ballX - g.pitch.cx, g.pitch.y1 - s.ballY).y.toFixed(0),
             vh: R.vh };
  }, [label, on]);

  await p.evaluate(() => {
    const H = OuissyCup.__cup;
    H.quick(0); H.auto(true);
    for (let i = 0; i < 400 && H.state().state !== 'play'; i++) H.step(1, 0, 0, false);
    for (let i = 0; i < 600; i++) H.step(1, 0, 0, false);
    H.put(20, 70, 0);
    for (let i = 0; i < 120; i++) H.step(1, 0, 0, false);
  });

  console.log(JSON.stringify(await snap('start-upright', false)));
  console.log(JSON.stringify(await snap('to-side', true)));
  console.log(JSON.stringify(await snap('back-upright', false)));
  await p.waitForTimeout(700);
  await p.screenshot({ path: '/tmp/toggle-back-up.png' });
  console.log('DONE');
  await b.close();
})();
