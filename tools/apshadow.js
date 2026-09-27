/* THE TORCH'S SECOND PASS. It is the only thing in the frame that gets more
   expensive as she walks — the beam sweeps and the whole room enters its
   frustum — so a handheld must not be asked for the desktop's version. */
const { boot, reporter } = require('./_aplib');
(async () => {
  const { browser, page, errs } = await boot({ viewport: { width: 900, height: 560 } });
  const R = reporter(), ok = R.ok;
  await page.evaluate(() => window.__apEnter(1));
  await page.waitForTimeout(300);
  const desk = await page.evaluate(() => window.__apTorchShadow());
  ok('the torch casts, and says what it costs', !!desk && desk.on === true, JSON.stringify(desk));
  ok('a mouse-and-keyboard machine keeps the full shadow',
     desk && desk.map === 1024 && desk.radius === 3, JSON.stringify(desk));
  await browser.close();

  /* and the same game on a touch device */
  const { chromium } = require('playwright-core');
  const b2 = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox', '--no-proxy-server', '--disable-gpu'] });
  const p2 = await b2.newPage({ viewport: { width: 820, height: 1180 }, hasTouch: true, isMobile: true });
  await p2.route('**/*', r => r.request().url().startsWith('http://127.0.0.1') ? r.continue() : r.abort());
  await p2.goto('http://127.0.0.1:8899/index.html', { waitUntil: 'domcontentloaded' });
  await p2.waitForTimeout(800);
  await p2.evaluate(() => window.loadChapter && window.loadChapter('apoc'));
  await p2.waitForFunction(() => !!window.Apocalypse, null, { timeout: 20000 });
  await p2.evaluate(() => { showScreen('apoc'); if (!window.__apEnter) Apocalypse.start(); });
  await p2.waitForFunction(() => typeof window.__apEnter === 'function', null, { timeout: 40000 });
  await p2.evaluate(() => window.__apEnter(1));
  await p2.waitForTimeout(300);
  const pad = await p2.evaluate(() => ({ sh: window.__apTorchShadow(),
    coarse: window.matchMedia('(pointer: coarse)').matches }));
  ok('the tablet is recognised as one', pad.coarse === true, JSON.stringify(pad.coarse));
  ok('and it gets a shadow it can afford sixty times a second',
     pad.sh && pad.sh.map === 512 && pad.sh.radius === 1, JSON.stringify(pad.sh));
  ok('but it still casts one — the beam still carves the dark', pad.sh && pad.sh.on === true);
  /* a quarter of the pixels and a ninth of the samples */
  const cost = (s) => (s.map * s.map) * (2 * s.radius + 1) * (2 * s.radius + 1);
  ok('which is a fraction of the work, not a different look',
     cost(pad.sh) < cost(desk) / 8, `${(cost(desk) / cost(pad.sh)).toFixed(0)}x cheaper`);
  await b2.close();
  console.log('');
  console.log(R.fail ? R.pass + ' passed, ' + R.fail + ' FAILED' : 'all ' + R.pass + ' checks passed');
  process.exit(R.fail ? 1 : 0);
})();
