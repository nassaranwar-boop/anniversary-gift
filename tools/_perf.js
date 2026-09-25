/* what a frame costs, each way round */
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
    for (let i = 0; i < 600; i++) H.step(1, 0, 0, false);
  });

  for (const side of [false, true, false, true]) {
    const ms = await p.evaluate((on) => {
      const H = OuissyCup.__cup;
      H.side(on); H.camSnap();
      /* warm */
      for (let i = 0; i < 12; i++) H.render();
      const t0 = performance.now();
      for (let i = 0; i < 60; i++) H.render();
      return +((performance.now() - t0) / 60).toFixed(2);
    }, side);
    console.log((side ? 'side-on ' : 'upright ') + ms + ' ms/frame');
  }
  console.log('DONE');
  await b.close();
})();
