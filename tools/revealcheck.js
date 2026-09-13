/* DOES THREE O'CLOCK LAND, OR DOES IT JUST APPEAR?

   The writing in these revelations was never the problem. The staging
   was: every line painted at once, his voice started seven-tenths of a
   second in over the top of her reading, and both choice buttons were
   live immediately -- so the whole thing could be dismissed before a
   word of it had been taken in. A wall of text with an exit is
   information, not a moment.

   This watches one arrive and checks that it behaves like a scene: the
   lines come one at a time and in order, the knife at the end gets a
   longer beat to itself than the lines that set it up, and she cannot
   choose what to do with the thing until she has seen all of it.
                                             node tools/revealcheck.js */
const { chromium } = require('playwright-core');

let pass = 0, fail = 0;
const ok = (n, c, x) => { if (c) { pass++; console.log('  ok   ' + n); }
                          else { fail++; console.log('  FAIL ' + n + (x !== undefined ? '  ' + JSON.stringify(x) : '')); } };

(async () => {
  const b = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox', '--no-proxy-server', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 1100, height: 700 } });
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

  /* night four is the one with the notebook in it -- the hardest thing
     in the chapter to land, and the reason the staging exists */
  await p.evaluate(() => OuissysNightShift.__night.begin(4, 1));
  await p.waitForTimeout(600);
  await p.evaluate(() => OuissysNightShift.__night.reveal(4));

  /* watch it arrive, on the page's own clock */
  const trace = await p.evaluate(() => new Promise((done) => {
    const out = [], t0 = performance.now();
    const tick = () => {
      const card = document.querySelector('.ns-card-find');
      if (!card) { if (performance.now() - t0 < 12000) return setTimeout(tick, 40); return done(out); }
      const lines = [].slice.call(card.querySelectorAll('.ns-rv'));
      const choice = card.querySelector('.ns-rv-choice');
      out.push([Math.round(performance.now() - t0),
                lines.filter((l) => l.classList.contains('in')).length,
                lines.length,
                choice ? (choice.classList.contains('in') ? 1 : 0) : -1]);
      if (performance.now() - t0 < 12000) setTimeout(tick, 40); else done(out);
    };
    tick();
  }));

  if (!trace.length) { ok('the revelation opened at all', false); }
  else {
    const total = trace[trace.length - 1][2];
    ok('the revelation opened', total > 0, total + ' lines');

    /* when did each line land */
    const landed = [];
    let seen = 0;
    for (const [t, n] of trace) { while (n > seen) { landed.push(t); seen++; } }
    ok('every line arrived', landed.length === total, landed.length + '/' + total);
    ok('and they arrived one at a time, not all at once',
       landed.length > 1 && (landed[landed.length - 1] - landed[0]) > 1500,
       'first to last ' + (landed[landed.length - 1] - landed[0]) + 'ms');

    /* the knife gets a longer beat than the lines that set it up */
    if (landed.length >= 3) {
      const gaps = landed.slice(1).map((t, i) => t - landed[i]);
      const beforeLast = gaps[gaps.length - 1];
      const typical = gaps.slice(0, -1).sort((a, c) => a - c)[Math.floor((gaps.length - 1) / 2)];
      ok('the last line waits longer than the rest', beforeLast > typical * 1.25,
         'held ' + beforeLast + 'ms against a typical ' + typical + 'ms');
    }

    /* and she cannot decide before she has read it */
    const choiceAt = (trace.find((r) => r[3] === 1) || [])[0];
    const allAt = landed[landed.length - 1];
    ok('the choice is not offered until every line is up',
       choiceAt !== undefined && choiceAt >= allAt,
       'choice at ' + choiceAt + 'ms, last line at ' + allAt + 'ms');
  }

  ok('no page errors', errs === 0, errs);
  await b.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
