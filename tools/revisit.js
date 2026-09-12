/* GOING BACK IN.

   She will open the book, leave, come back, start a game, quit, start it
   again. Every one of those is a chance to bind a listener twice, keep a
   timer running, or hold a texture that was never given back — and the
   symptom of all three is the same: it was fine the first time and it
   drags the third.

   So this does each round trip three times and reads the browser's own
   counters. What matters is not the absolute number but whether it CLIMBS,
   so the report is the delta from the first lap to the last.

   Usage:  node revisit.js
*/
const { chromium } = require('playwright-core');

let pass = 0, fail = 0;
const ok = (n, c, x) => { if (c) { pass++; console.log('PASS  ' + n + (x ? '   ' + x : '')); }
                          else { fail++; console.log('FAIL  ' + n + (x ? '   ' + x : '')); } };

const KEYS = ['JSEventListeners', 'Nodes', 'Documents', 'LayoutObjects'];

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
  await page.goto('http://127.0.0.1:8899/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(2500);
  await page.evaluate(() => Promise.all(['ouissy', 'apoc', 'race'].map(k => window.loadChapter(k))));
  await page.waitForTimeout(1500);

  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Performance.enable');
  await cdp.send('HeapProfiler.enable');
  const read = async () => {
    await page.evaluate(() => new Promise(r => setTimeout(r, 0)));
    /* Without this the counters are reading uncollected garbage, not a
       leak: a chapter that rebuilds its buttons every visit leaves the old
       ones detached, and detached-but-collectable is not a fault. Collect
       first, then ask. */
    await cdp.send('HeapProfiler.collectGarbage');
    await page.evaluate(() => new Promise(r => setTimeout(r, 60)));
    const m = await cdp.send('Performance.getMetrics');
    const o = {};
    m.metrics.forEach(x => { if (KEYS.includes(x.name)) o[x.name] = x.value; });
    return o;
  };

  const TRIPS = [
    ['the book', async () => {
      await page.evaluate(() => showScreen('scrapbook'));
      await page.waitForTimeout(1400);
      await page.evaluate(() => Scrapbook.skipIntro());
      await page.waitForTimeout(1400);
      await page.evaluate(() => { Scrapbook.next(); });
      await page.waitForTimeout(900);
      await page.evaluate(() => showScreen('hub'));
      await page.waitForTimeout(900);
    }],
    ['Super Ouissy', async () => {
      await page.evaluate(() => { showScreen('ouissy'); if (window.startSuperOuissy) startSuperOuissy(); });
      await page.waitForTimeout(2200);
      await page.evaluate(() => { if (window.SuperOuissy && SuperOuissy.stop) SuperOuissy.stop(); showScreen('hub'); });
      await page.waitForTimeout(900);
    }],
    ['the race', async () => {
      await page.evaluate(() => { showScreen('race'); if (window.startSuperOuissyRace) startSuperOuissyRace(); });
      await page.waitForTimeout(2200);
      await page.evaluate(() => { if (window.SuperOuissyRace && SuperOuissyRace.stop) SuperOuissyRace.stop(); showScreen('hub'); });
      await page.waitForTimeout(900);
    }],
    ['the apocalypse', async () => {
      await page.evaluate(() => { showScreen('apoc'); if (window.startApocalypse) startApocalypse(); });
      await page.waitForTimeout(3000);
      await page.evaluate(() => { if (window.Apocalypse && Apocalypse.stop) Apocalypse.stop(); showScreen('hub'); });
      await page.waitForTimeout(900);
    }],
    ['the adventure', async () => {
      await page.evaluate(() => { showScreen('quest'); if (window.startQuest) startQuest(); });
      await page.waitForTimeout(1800);
      await page.evaluate(() => showScreen('hub'));
      await page.waitForTimeout(900);
    }],
  ];

  for (const [name, trip] of TRIPS) {
    await trip();                        // first lap: the one that builds
    const a = await read();
    await trip(); await trip();          // two more
    const b = await read();
    const grew = KEYS.filter(k => b[k] - a[k] > 0)
                     .map(k => k + ' +' + Math.round(b[k] - a[k]));
    /* Nodes and layout objects move around with whatever is on screen; the
       one that must not climb per visit is listeners, because that is a
       handler running twice for one tap. */
    const listeners = Math.round((b.JSEventListeners || 0) - (a.JSEventListeners || 0));
    ok('two more trips through ' + name + ' bind no more listeners', listeners <= 0,
       'listeners ' + (listeners >= 0 ? '+' : '') + listeners +
       (grew.length ? '   [' + grew.join(', ') + ']' : ''));
  }

  ok('nothing threw across all of it', errs.length === 0, errs[0] || '');
  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
