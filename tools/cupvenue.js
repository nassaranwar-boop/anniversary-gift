/* Every campus, photographed at its own hour. */
const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--use-gl=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist',
           '--no-sandbox','--no-proxy-server','--autoplay-policy=no-user-gesture-required'] });
  const p = await b.newPage({ viewport: { width: 880, height: 500 }, deviceScaleFactor: 1 });
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.route('**/*', r => r.request().url().startsWith('http://127.0.0.1') ? r.continue() : r.abort());
  await p.goto('http://127.0.0.1:8899/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForTimeout(900);
  await p.evaluate(() => window.loadChapter && window.loadChapter('cup'));
  await p.waitForFunction(() => !!window.OuissyCup, { timeout: 30000 });
  await p.evaluate(() => { try { localStorage.clear(); } catch (e) {}
                           showScreen('cup'); OuissyCup.__cup.soundOff();
                           OuissyCup.__cup.shadows(true); OuissyCup.start(); });
  await p.waitForFunction(() => OuissyCup.__cup.state() !== null, { timeout: 40000 });
  await p.evaluate(() => { OuissyCup.stop(); document.getElementById('cup-overlay').hidden = true; });

  const venues = await p.evaluate(() => OuissyCup.__cup.venues().map(v => v.id));
  for (const v of venues) {
    await p.evaluate((v) => {
      OuissyCup.__cup.venue(v);
      OuissyCup.__cup.reset(0);
      for (let i = 0; i < 260; i++) OuissyCup.__cup.step(1, 1, 0.15, false);
      OuissyCup.__cup.render();
    }, v);
    await p.waitForTimeout(500);
    await p.screenshot({ path: '/tmp/cup-venue-' + v + '.png' });
    console.log('shot', v);
  }
  console.log(errs.length ? 'ERRORS: ' + errs.slice(0, 3).join(' | ') : 'no page errors');
  await b.close();
})();
