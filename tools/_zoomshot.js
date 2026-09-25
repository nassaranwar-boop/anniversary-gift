/* the same instant at all three zoom levels */
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
    for (let i = 0; i < 500; i++) H.step(1, 0, 0, false);
    while (H.state().state !== 'play') H.step(1, 0, 0, false);
    H.camSnap();
  });

  for (const z of [1, 2, 3]) {
    await p.evaluate((zz) => {
      const H = OuissyCup.__cup;
      /* hold the camera still and change only the zoom, so the two
         pictures differ in exactly one thing */
      H.r2().zoomTo(zz);
      H.render();
    }, z);
    await p.waitForTimeout(500);
    const held = await p.evaluate((zz) => {
      OuissyCup.__cup.r2().zoomTo(zz); OuissyCup.__cup.render();
      return OuissyCup.__cup.r2().zoom;
    }, z);
    console.log('     asked for zoom ' + z + ', renderer held ' + held);
    await p.waitForTimeout(150);
    await p.screenshot({ path: '/tmp/zoom-' + z + '.png' });
    console.log('  -> /tmp/zoom-' + z + '.png');
  }
  console.log('DONE');
  await b.close();
})();
