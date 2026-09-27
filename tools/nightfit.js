/* DOES THE CHAPTER FIT IN THE CHAPTER?

   Every night is a fixed number of seconds. Everything anybody says in
   it goes through one queue, one line at a time, each costing its
   reading time plus a tail plus a gap. This adds up everything a night
   is written to carry and sets it against the clock that has to hold
   it. No playing, no luck, no variance -- just whether the arithmetic
   closes. */
const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox','--no-proxy-server','--use-gl=swiftshader','--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 1000, height: 700 } });
  await p.route('**/*', r => { const u = r.request().url();
    if (u.indexOf('book-scene.js') >= 0) return r.abort();
    return u.startsWith('http://127.0.0.1') ? r.continue() : r.abort(); });
  await p.goto('http://127.0.0.1:8899/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForTimeout(600);
  await p.evaluate(() => { try{localStorage.clear();}catch(e){} showScreen('nightshift');
    return loadChapter('nightshift').then(() => OuissysNightShift.start()); });
  await p.waitForFunction(() => Object.keys(OuissysNightShift.__night.cast()).length >= 4, { timeout: 20000, polling: 200 });
  const r = await p.evaluate(() => {
    const w = OuissysNightShift.__night, NS = w.words();
    const D = (t) => w.lineDur(t) + 1.05 + 2.5;      // words, tail, gap
    const out = [];
    /* which choices a night is written to answer: made on night one are
       answered on two, made on two on three, and the first of night
       three's comes back the same night after the two-hour gap */
    const owes = { 1: [], 2: [1, 2], 3: [3, 4, 5] };
    for (let n = 1; n <= 3; n++) {
      const tape = (NS.tapes[n] || []).reduce((a, x) => a + D(x.t), 0);
      const sc = NS.overheard[n]; const list = !sc ? [] : (sc.length ? sc : [sc]);
      const over = list.reduce((a, s) => a + s.lines.reduce((b, l) => b + D(l.t), 0), 0);
      const ans = owes[n].reduce((a, k) => a + Math.max(
        D(NS.afterChoice[k].kept.t), D(NS.afterChoice[k].burned.t)), 0);
      /* the two knocks a night is allowed, their answers, and the
         handful of system lines every night fires */
      const knocks = 2 * (D("It is Cogsworth. I am at the west door and I am not touching it. Open it, please. I would like to say something and I would rather not say it through a door.") + D("Thank you."));
      /* the annunciator is NOT in here: say() draws its own element on
         its own tick and never touches the tape queue, so the six
         system lines a night fires cost the queue nothing. */
      const sys = 0;
      const clock = (n >= 3 ? 5 : 6) * 56;
      /* the shop's own cold open, and orientation on the first night */
      const held = (n === 1 ? 8 + 43 : n === 2 ? 18 : 17);
      out.push({ n: n, clock: clock, usable: clock - held,
                 tape: tape, over: over, ans: ans, knocks: knocks, sys: sys,
                 total: tape + over + ans + knocks + sys });
    }
    return out;
  });
  let C = 0, T = 0;
  console.log('\n  night   clock  usable |   tape   talk  answers  knocks    sys |  TOTAL   full');
  console.log('  ' + '-'.repeat(84));
  r.forEach(x => { C += x.usable; T += x.total;
    console.log('    ' + x.n + '     ' + String(x.clock).padStart(4) + 's  ' + String(Math.round(x.usable)).padStart(4) + 's |' +
      [x.tape, x.over, x.ans, x.knocks, x.sys].map(v => String(Math.round(v)).padStart(6) + 's').join(' ') +
      ' | ' + String(Math.round(x.total)).padStart(4) + 's   ' +
      String(Math.round(x.total / x.usable * 100)).padStart(3) + '%'); });
  console.log('  ' + '-'.repeat(84));
  console.log('  the chapter: ' + Math.round(T) + 's of talking for ' + Math.round(C) +
              's of night — ' + Math.round(T / C * 100) + '% full.');
  console.log('  for a third of each night to be silent it would have to be ' +
              Math.round(C * 0.67) + 's, so ' + Math.round(T - C * 0.67) + 's too much.');
  /* A NIGHT MAY NOT BE WRITTEN FULLER THAN IT IS LONG.

     Every night was, once: 106, 113 and 114 per cent. Nothing was
     silent, and about a hundred seconds of writing a night could
     never be reached however well she played -- including the
     warning that sets up the last hour, which no run ever heard. */
  let bad = 0;
  r.forEach(x => { const full = x.total / x.usable;
    if (full > 0.92) { bad++;
      console.log('  FAIL night ' + x.n + ' is written ' + Math.round(full * 100) +
                  '% full; there is no room in it to be frightened, and the end of it will not be heard.'); } });
  console.log(bad ? '\n  ' + bad + ' night(s) over budget.' : '\n  every night fits inside itself.');
  process.exitCode = bad ? 1 : 0;
  await b.close();
})();
