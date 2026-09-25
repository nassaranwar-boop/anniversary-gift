/* WHO GETS TOLD TO TURN THEIR PHONE.
 *
 * Three conditions have to agree — portrait, a finger, and phone-sized
 * — and getting any one of them wrong is worse than not having the
 * prompt at all. A tall desktop window told to rotate is absurd; an
 * iPad in portrait told to rotate is wrong, because every screen here
 * fits an iPad; and a phone already in landscape being told to rotate
 * would be unusable.
 *
 * So this walks the devices and asserts who sees it, on more than one
 * screen — the prompt is site-wide, and "site-wide" is the part that is
 * easy to get half right.
 *
 *   node tools/rotate.js
 */
const { chromium } = require('playwright-core');

let pass = 0, fail = 0;
const ok = (msg, cond, extra) => {
  if (cond) { pass++; console.log('  ok   ' + msg); }
  else { fail++; console.log('  FAIL ' + msg + (extra !== undefined ? '  ' + extra : '')); }
};

const CASES = [
  /* name,                 w,    h,    touch, shouldPrompt */
  ['phone portrait',       390,  844,  true,  true],
  ['small phone portrait', 360,  640,  true,  true],
  ['phone landscape',      844,  390,  true,  false],
  ['tablet portrait',      820,  1180, true,  false],
  ['tablet landscape',     1180, 820,  true,  false],
  ['desktop',              1280, 720,  false, false],
  ['narrow desktop window', 420, 900,  false, false],
];

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox', '--no-proxy-server', '--autoplay-policy=no-user-gesture-required'] });

  for (const [name, w, h, touch, want] of CASES) {
    const ctx = await b.newContext({
      viewport: { width: w, height: h }, hasTouch: touch, isMobile: touch,
      deviceScaleFactor: touch ? 2 : 1,
    });
    const p = await ctx.newPage();
    await p.route('**/*', r => r.request().url().startsWith('http://127.0.0.1') ? r.continue() : r.abort());
    await p.goto('http://127.0.0.1:8899/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await p.waitForTimeout(600);
    const shown = () => p.evaluate(() => {
      const el = document.getElementById('rotate-me');
      if (!el) return null;
      const cs = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return { display: cs.display, covers: r.width >= innerWidth - 1 && r.height >= innerHeight - 1 };
    });
    const s = await shown();
    ok(name + (want ? ' is asked to rotate' : ' is left alone'),
       s && (s.display !== 'none') === want, JSON.stringify(s));
    if (want && s) ok('  and it covers the whole screen', s.covers);
    await ctx.close();
  }

  /* SITE-WIDE means on the chapters too, not only the front door. */
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 },
                                   hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.route('**/*', r => r.request().url().startsWith('http://127.0.0.1') ? r.continue() : r.abort());
  await p.goto('http://127.0.0.1:8899/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForTimeout(800);
  await p.evaluate(() => { try { localStorage.clear(); } catch (e) {} showScreen('hub'); startHub(); });
  await p.waitForTimeout(400);
  ok('still shown on the hub', await p.evaluate(() =>
     getComputedStyle(document.getElementById('rotate-me')).display !== 'none'));
  await p.evaluate(() => { showScreen('scrapbook'); });
  await p.waitForTimeout(300);
  ok('still shown on the scrapbook', await p.evaluate(() =>
     getComputedStyle(document.getElementById('rotate-me')).display !== 'none'));

  /* THE WAY PAST IT, for a phone with rotation lock on. */
  await p.evaluate(() => { showScreen('hub'); });
  await p.waitForTimeout(200);
  await p.evaluate(() => document.getElementById('rotate-anyway').click());
  await p.waitForTimeout(200);
  ok('"stay upright" dismisses it', await p.evaluate(() =>
     getComputedStyle(document.getElementById('rotate-me')).display === 'none'));
  await p.evaluate(() => { showScreen('cup'); });
  await p.waitForTimeout(300);
  ok('and it stays dismissed across a chapter change', await p.evaluate(() =>
     getComputedStyle(document.getElementById('rotate-me')).display === 'none'));
  await p.screenshot({ path: '/tmp/rotate-dismissed.png' });

  /* and it comes back on a fresh load, because rotation lock may go off */
  await p.reload({ waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(700);
  ok('but a fresh load offers it again', await p.evaluate(() =>
     getComputedStyle(document.getElementById('rotate-me')).display !== 'none'));
  await p.screenshot({ path: '/tmp/rotate-prompt.png' });

  ok('no page errors', errs.length === 0, JSON.stringify(errs.slice(0, 3)));
  await ctx.close();

  console.log('');
  console.log(pass + ' passed, ' + fail + ' failed');
  await b.close();
  process.exit(fail ? 1 : 0);
})();
