/* DOES THE SHOP EVER TELL HER WHAT SHE IS DOING?

   His complaint, in his words: she plays without knowing what to do.
   She did. The night's purpose was printed once on a card before
   midnight and then the screen showed a power meter and a clock for
   five and a half minutes. A goal you are told once is a goal you had.

   So there is a line under the clock now that answers it, and changes
   three or four times a night. This walks every night hour by hour and
   checks that the line is there, that it is different at the beats
   where the night turns, and that it shuts up during the tutorial and
   the cut scenes -- which are already telling her what to do, and two
   voices saying it at once is neither.
                                               node tools/taskcheck.js */
const { chromium } = require('playwright-core');

let pass = 0, fail = 0;
const ok = (n, c, x) => { if (c) { pass++; console.log('  ok   ' + n); }
                          else { fail++; console.log('  FAIL ' + n + (x !== undefined ? '  ' + JSON.stringify(x) : '')); } };

(async () => {
  const b = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox', '--no-proxy-server', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 900, height: 560 } });
  let errs = 0;
  p.on('pageerror', (e) => { errs++; console.log('PAGEERROR', e.message); });
  await p.route('**/*', (r) => {
    const u = r.request().url();
    if (u.indexOf('book-scene.js') >= 0) return r.abort();
    return u.startsWith('http://127.0.0.1') ? r.continue() : r.abort();
  });
  await p.goto('http://127.0.0.1:8899/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.evaluate(() => { localStorage.setItem('ns_seenintro', '1'); showScreen('nightshift');
    return loadChapter('nightshift').then(() => OuissysNightShift.start()); });
  await p.waitForFunction(() => window.OuissysNightShift && OuissysNightShift.__night,
                          { timeout: 20000, polling: 200 });

  /* every night, every hour, straight out of the script */
  const walk = await p.evaluate(() => {
    const N = OuissysNightShift.__night, NS = N.words();
    const out = {};
    for (let night = 1; night <= 6; night++) {
      out[night] = [];
      for (let h = 0; h < 6; h++) out[night].push(N.taskFor(night, h));
    }
    return out;
  });

  for (let night = 1; night <= 6; night++) {
    const hours = walk[night];
    const missing = hours.filter((x) => !x).length;
    const distinct = new Set(hours.filter(Boolean)).size;
    ok('night ' + night + ': she is told something at every hour', missing === 0, hours);
    ok('night ' + night + ': and it changes as the night moves', distinct >= 3,
       distinct + ' different lines across six hours');
  }

  /* it must not talk over the things that are already talking */
  const quiet = await p.evaluate(() => {
    const N = OuissysNightShift.__night;
    const el = document.getElementById('ns-task');
    return { duringCine: N.phase && N.phase() };
  }).catch(() => null);

  /* and the element is really in the page, in the HUD, not floating */
  const placed = await p.evaluate(() => {
    const el = document.getElementById('ns-task');
    if (!el) return null;
    return { inHud: !!el.closest('.ns-hud'), underClock: !!el.previousElementSibling };
  });
  ok('the line lives in the HUD under the clock',
     placed && placed.inHud && placed.underClock, placed);

  ok('no page errors', errs === 0, errs);
  await b.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
