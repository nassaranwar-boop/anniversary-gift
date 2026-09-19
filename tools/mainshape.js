/* THE SITE WITHOUT THE NIGHT SHIFT, WALKED.

   main carries the whole site except Ouissy's Night Shift, which lives
   on the branch site-with-night-shift until it comes back. This is the
   check that taking it out left the rest whole: the hub counts four
   ways in, all four open and run, nothing asks the server for a file
   that is no longer there, and nothing throws.

                       node tools/mainshape.js [port]   (default 8901)
*/
const { chromium } = require('playwright-core');
const PORT = process.argv[2] || '8901';
const BASE = 'http://127.0.0.1:' + PORT + '/index.html';
const SIZES = [[1280, 800, 'desktop'], [844, 390, 'phone-landscape']];

let pass = 0, fail = 0;
const ok = (n, c, x) => { if (c) { pass++; } else { fail++;
  console.log('  FAIL ' + n + (x !== undefined ? '  ' + JSON.stringify(x).slice(0, 160) : '')); } };

(async () => {
  const b = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox', '--no-proxy-server', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  for (const [w, h, label] of SIZES) {
    const p = await b.newPage({ viewport: { width: w, height: h }, isMobile: h < 500, hasTouch: h < 500 });
    const errs = [], missing = [];
    p.on('pageerror', (e) => errs.push(e.message.slice(0, 100)));
    p.on('response', (r) => { if (r.status() === 404 && r.url().indexOf('127.0.0.1') > 0) missing.push(r.url().split('/').pop()); });
    await p.route('**/*', (r) => r.request().url().startsWith('http://127.0.0.1') ? r.continue() : r.abort());
    await p.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await p.waitForTimeout(1500);
    console.log('\n=== ' + label);

    /* the front door */
    await p.evaluate(() => { const c = document.getElementById('book-canvas') || document.body;
      c.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); c.click(); });
    await p.waitForTimeout(1000);
    await p.evaluate(() => { if (!document.querySelector('#screen-gate.active')) showScreen('gate'); });
    await p.waitForTimeout(500);
    for (const d of '2207') { try { await p.click('[data-gate-key="' + d + '"]', { timeout: 6000 }); }
      catch (e) { break; } await p.waitForTimeout(160); }
    let gate = true;
    try { await p.waitForSelector('#screen-scrapbook.active', { timeout: 15000 }); } catch (e) { gate = false; }
    ok(label + ': the passcode opens the book', gate);

    /* the hub */
    await p.evaluate(() => { showScreen('hub'); if (window.startHub) startHub(); });
    await p.waitForTimeout(800);
    const hub = await p.evaluate(() => ({
      cards: [].map.call(document.querySelectorAll('.hub-card'), (c) => c.id.replace('hub-card-', '')),
      sub: (document.getElementById('hub-sub') || {}).textContent,
      ns: !!document.getElementById('hub-card-nightshift') || !!document.getElementById('screen-nightshift'),
      fn: typeof window.startNightShift,
    }));
    ok(label + ': four ways in', hub.cards.length === 4 && hub.cards.join(',') === 'quest,ouissy,apoc,race', hub.cards);
    ok(label + ': the line counts four', /4 ways in/.test(hub.sub || ''), hub.sub);
    ok(label + ': nothing of the night shift is left on the page', !hub.ns && hub.fn === 'undefined', hub);

    /* and every one of them still opens and runs */
    const READY = {
      quest: '#screen-quest.active .hv-stage',
      ouissy: '#screen-ouissy.active #so-canvas',
      apoc: '#screen-apoc.active #ap-canvas',
      race: '#screen-race.active #race-canvas',
    };
    for (const name of Object.keys(READY)) {
      await p.evaluate(() => showScreen('hub'));
      await p.waitForTimeout(400);
      await p.evaluate((n) => { const c = document.getElementById('hub-card-' + n); if (c) c.click(); }, name);
      let came = true;
      try { await p.waitForSelector(READY[name], { timeout: 30000 }); } catch (e) { came = false; }
      ok(label + ': ' + name + ' opens', came);
      await p.waitForTimeout(1500);
      const live = await p.evaluate((n) => {
        if (n === 'race') return !!window.__RACE_DEBUG;
        if (n === 'ouissy') return !!window.__soState;
        if (n === 'apoc') return !!window.__apState;
        return !!document.querySelector('#screen-quest .hv-btn, #screen-quest button');
      }, name);
      ok(label + ': ' + name + ' is running', live);
    }
    /* the keepsake and the ending, which are the site's own screens */
    for (const s of ['keepsake', 'scrapbook', 'end']) {
      await p.evaluate((n) => showScreen(n), s);
      await p.waitForTimeout(700);
      ok(label + ': the ' + s + ' screen comes up',
         await p.evaluate((n) => !!document.querySelector('#screen-' + n + '.active'), s));
    }
    const real = errs.filter((e) => !/ERR_FAILED|net::/.test(e));
    ok(label + ': nothing threw', !real.length, real.slice(0, 3));
    ok(label + ': nothing asked for a file that is gone', !missing.length, missing.slice(0, 5));
    await p.close();
  }
  console.log('\n' + pass + ' passed, ' + fail + ' failed\n');
  await b.close();
  process.exit(fail ? 1 : 0);
})();
