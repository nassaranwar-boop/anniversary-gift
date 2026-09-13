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

/* WHAT THIS CAN HONESTLY ASSERT, AND WHAT IT CANNOT.

   A "long task" counts paint as well as script, and this container
   rasterises in software: every frame of a WebGL scene is a 350ms long
   task in here and about four on a phone. Raising the budgets until
   that goes green is lying; so is failing the site for the harness.

   So the judgement moved. Each step is measured with the sampling
   profiler as well, and what is ASSERTED is the JavaScript: the longest
   unbroken run of it, which is the only thing in these numbers the site
   is actually responsible for. The long-task figure is still printed
   beside it, because when the two disagree the gap is the paint, and
   that is worth seeing. Proven on the passcode, which books a 355ms
   long task and profiles at 15ms of script: the stall is SwiftShader
   drawing the card, and there is nothing in the site to fix.

   Builds are still allowed more than gestures, because they happen
   behind a card rather than under a thumb. */
const BUDGET = 120, BUILD_BUDGET = 450, PAINT_BUDGET = 450;

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

  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Profiler.enable');
  await cdp.send('Profiler.setSamplingInterval', { interval: 250 });

  /* The longest unbroken run of JavaScript in a profile, in
     milliseconds. Idle and the browser's own program frames break the
     run: what is left is the site's own code holding the thread. */
  function longestScript(profile) {
    const nodes = new Map(profile.nodes.map(n => [n.id, n]));
    const isJs = id => {
      const n = nodes.get(id);
      if (!n) return false;
      const f = n.callFrame.functionName;
      return f !== '(idle)' && f !== '(program)' && f !== '(root)' && f !== '(garbage collector)';
    };
    let run = 0, best = 0;
    const d = profile.timeDeltas || [];
    (profile.samples || []).forEach((id, i) => {
      const ms = (d[i] || 0) / 1000;
      if (isJs(id)) { run += ms; if (run > best) best = run; }
      else run = 0;
    });
    return Math.round(best);
  }

  const step = async (name, fn, budget = BUDGET, settle = 1800) => {
    await take();
    await cdp.send('Profiler.start');
    await fn();
    await page.waitForTimeout(settle);
    const { profile } = await cdp.send('Profiler.stop');
    const a = await take();
    const js = longestScript(profile);
    ok(name, js <= budget,
       js + 'ms of script (budget ' + budget + ')' +
       '   [paint included: ' + worst(a) + 'ms' + (a.length > 1 ? ' of ' + a.length : '') + ']');
  };

  /* Go in the way she does. The 3D intro waits for a tap and renders while
     it waits, so jumping past it with showScreen leaves a whole Three.js
     scene running behind every later measurement — which is what made the
     first version of this file report a page turn as a 500ms block. */
  /* The load is the one step that cannot be profiled after the fact --
     it is over before a session can be attached -- so it stays a report
     rather than a judgement. Under SwiftShader it is dominated by the
     first paint of the three-dimensional book, which is four hundred
     software-rasterised frames' worth of work a phone does on its GPU. */
  { const a = await take();
    console.log('note  loading the page took ' + worst(a) + 'ms of blocked thread here, ' +
                'most of it SwiftShader drawing the book'); }
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
