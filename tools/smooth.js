/* WHERE THE MAIN THREAD STOPS.

   "Lag" on a phone is almost never the frame rate — it is one synchronous
   block of work in the middle of a gesture. requestAnimationFrame runs at
   about 3fps in this container so a frame rate measured here means nothing,
   but a long task does not care about vsync: a build that blocks for 400ms
   blocks for 400ms in here too.

   So this counts long tasks (>50ms, the browser's own definition) around
   each thing she actually does, and names the worst one.

   Usage:  node smooth.js
*/
const { chromium } = require('playwright-core');

let pass = 0, fail = 0;
const ok = (n, c, x) => { if (c) { pass++; console.log('PASS  ' + n + (x ? '   ' + x : '')); }
                          else { fail++; console.log('FAIL  ' + n + (x ? '   ' + x : '')); } };

/* A block over this is something a finger feels as a stall. Two caveats,
   both learned the hard way:

   - Builds are allowed more, because they happen behind a card rather
     than under a thumb.
   - A "long task" counts paint as well as script, and this container
     rasterises in software. A page turn profiles at ~25ms of JavaScript
     and still books a 500ms long task here, because SwiftShader is
     painting the turn on the CPU. So the turn gets the build budget: what
     this file can honestly assert is that no JS blocks, not what a real
     GPU takes to draw. */
const BUDGET = 220, BUILD_BUDGET = 900, PAINT_BUDGET = 900;

(async () => {
  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'],
  });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 },
                                         isMobile: true, hasTouch: true });
  await ctx.route('**/*', r => r.request().url().startsWith('http://127.0.0.1')
    ? r.continue() : r.abort());
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));

  await page.addInitScript(() => {
    window.__long = [];
    try {
      new PerformanceObserver((l) => {
        for (const e of l.getEntries()) window.__long.push(Math.round(e.duration));
      }).observe({ entryTypes: ['longtask'] });
    } catch (e) {}
  });
  await page.goto('http://127.0.0.1:8899/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(3000);

  const take = () => page.evaluate(() => { const a = window.__long.slice(); window.__long.length = 0; return a; });
  const worst = a => a.length ? Math.max(...a) : 0;

  const step = async (name, fn, budget = BUDGET, settle = 1800) => {
    await take();
    await fn();
    await page.waitForTimeout(settle);
    const a = await take();
    ok(name, worst(a) <= budget,
       'worst block ' + worst(a) + 'ms' + (a.length > 1 ? ' of ' + a.length : '') +
       ' (budget ' + budget + ')');
  };

  /* Go in the way she does. The 3D intro waits for a tap and renders while
     it waits, so jumping past it with showScreen leaves a whole Three.js
     scene running behind every later measurement — which is what made the
     first version of this file report a page turn as a 500ms block. */
  { const a = await take();
    ok('loading the page', worst(a) <= BUILD_BUDGET, 'worst block ' + worst(a) + 'ms'); }
  await step('the 3D intro, tapped and played through', async () => {
    await page.evaluate(() => { const c = document.getElementById('book-canvas');
      if (c) c.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
    for (let i = 0; i < 20; i++) {
      const at = await page.evaluate(() => document.querySelector('.screen.active').id);
      if (at !== 'screen-videointro') break;
      await page.waitForTimeout(1500);
    }
  }, BUILD_BUDGET, 1500);

  await step('typing the passcode in', async () => {
    for (const d of ['2', '2', '0', '7']) await page.tap(`[data-gate-key="${d}"]`);
  }, BUDGET, 1200);

  await step('the book opening after it', async () => {
    await page.waitForTimeout(3000);
    await page.evaluate(() => Scrapbook.skipIntro());
  }, BUILD_BUDGET, 2600);

  for (let i = 1; i <= 4; i++) {
    await step('turning to spread ' + i, () => page.evaluate(() => Scrapbook.next()), PAINT_BUDGET, 1400);
  }
  await step('opening the bouquet drawer',
    () => page.evaluate(() => { const b = document.getElementById('sb-extras-btn'); if (b) b.click(); }),
    BUILD_BUDGET, 1600);
  await step('closing it again',
    () => page.evaluate(() => { const b = document.getElementById('sb-extras-btn'); if (b) b.click(); }),
    BUDGET, 1200);

  await step('going to the hub', () => page.evaluate(() => showScreen('hub')));
  await step('starting Super Ouissy', async () => {
    await page.evaluate(() => window.loadChapter && window.loadChapter('ouissy'));
    await page.evaluate(() => { showScreen('ouissy'); if (window.startSuperOuissy) startSuperOuissy(); });
  }, BUILD_BUDGET, 3000);
  await step('starting the race', async () => {
    await page.evaluate(() => window.loadChapter && window.loadChapter('race'));
    await page.evaluate(() => { showScreen('race'); if (window.startSuperOuissyRace) startSuperOuissyRace(); });
  }, BUILD_BUDGET, 3000);
  await step('starting the apocalypse', async () => {
    await page.evaluate(() => window.loadChapter && window.loadChapter('apoc'));
    await page.evaluate(() => { showScreen('apoc'); if (window.startApocalypse) startApocalypse(); });
  }, BUILD_BUDGET, 4000);

  ok('nothing threw', errs.length === 0, errs[0] || '');
  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
