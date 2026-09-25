/* the goal, side-on, with the camera parked square on it */
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

  const shots = [
    ['goalmouth', (H, g) => { H.put(g.cx + 10, g.y0 + 46, 0); }],
    ['midfield', (H, g) => { H.put(g.cx, g.cy, 0); }],
  ];
  for (const [name, place] of shots) {
    for (const side of [true, false]) {
      await p.evaluate(([n, on]) => {
        const H = OuissyCup.__cup;
        const g = H.geometry().pitch;
        H.quick(0); H.auto(true);
        for (let i = 0; i < 400 && H.state().state !== 'play'; i++) H.step(1, 0, 0, false);
        for (let i = 0; i < 300; i++) H.step(1, 0, 0, false);
        if (n === 'goalmouth') {
          H.restart('corner', 1);
          for (let i = 0; i < 50; i++) H.step(1, 0, 0, false);
        } else {
          H.put(g.cx, g.cy, 0);
          for (let i = 0; i < 40; i++) H.step(1, 0, 0, false);
        }
        H.side(on);
        H.camSnap();
      }, [name, side]);
      await p.waitForTimeout(900);
      const f = `/tmp/gs-${name}-${side ? 'side' : 'up'}.png`;
      await p.screenshot({ path: f });
      console.log('  -> ' + f);
    }
  }
  console.log('DONE');
  await b.close();
})();
