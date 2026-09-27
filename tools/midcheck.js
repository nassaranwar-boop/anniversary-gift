/* THE FIRST MINUTE OF A NIGHT, WATCHED.

   Six nights, and each one changes a rule rather than going faster. All
   six of those changes used to be WRITTEN DOWN and nowhere else -- a
   line on the night card, a line in the hourly note -- and she found out
   what they meant at half past two, when it cost her something. Now
   every night opens with the building doing tonight's damage to itself
   in front of her, before the clock starts.

   A scene that holds a night still is a scene that can lose a night, so
   this asks the four things that would do it, plus the two that would
   quietly turn it back into a caption:

     it holds       no clock, no drain, nobody walking, for as long as
                    it runs -- and night four's two per cent is the one
                    scripted exception, because she is meant to hear
                    what that costs
     it ends        every beat fires, and the shift starts. A scene
                    paced by the annunciator that never frees up is a
                    night that never begins
     it hands back  the monitor down, the picture clean, and no door
                    left shut by a self-test she only watched
     it is in step  the machinery and the sentence about it land in the
                    same frame. They used to drift: the monitor came up
                    on the workshop a second and a half before "SHIFT
                    TWO OF SIX" was read out, because the beats ran on a
                    stopwatch and the lines ran on the voice
     it is news     the fault it announces has not already happened. The
                    hall was dark at t=0.1 on night three, five and a
                    half seconds before the scene said the lights went
     it is once     a custom night is a sandbox, and the same building
                    breaking in the same order is a wait, not a scene

   It drives the page through `pumpFrame`, which is the player's own
   `playStep` one slice at a time -- so what is measured is the code the
   frame loop runs, not a description of it. */
const { chromium } = require('playwright-core');

let pass = 0, fail = 0;
const ok = (n, c, note) => { c ? pass++ : fail++;
  console.log(`${c ? 'PASS' : 'FAIL'}  ${n}${note ? '   ' + note : ''}`); };

/* what the beats are, read off the page rather than copied here, so a
   beat added to night four cannot pass a check that never saw it */
(async () => {
  const b = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox', '--no-proxy-server', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 900, height: 600 } });
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  await p.route('**/*', (r) => {
    const u = r.request().url();
    if (u.indexOf('book-scene.js') >= 0) return r.abort();
    return u.startsWith('http://127.0.0.1') ? r.continue() : r.abort(); });
  await p.goto('http://127.0.0.1:8899/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.evaluate(() => {
    localStorage.setItem('ns_seenintro', '1');
    localStorage.setItem('ns_notutor', '1');
    showScreen('nightshift');
    return loadChapter('nightshift').then(() => OuissysNightShift.start()); });
  await p.waitForFunction(() => window.OuissysNightShift && OuissysNightShift.__night,
                          { timeout: 20000, polling: 200 });

  /* one night, pumped from the first frame to the first frame of the
     shift proper, with a reading taken every slice */
  const run = (night) => p.evaluate((n) => {
    const N = OuissysNightShift.__night, G = N.state(), cast = N.cast();
    N.begin(n);
    const at0 = {};
    Object.keys(cast).forEach((k) => { at0[k] = cast[k].room + '#' + cast[k].step; });
    const film = [];
    const DT = 1 / 30;
    let slices = 0;
    const read = () => {
      const m = N.midState();
      const moved = Object.keys(cast).filter((k) => cast[k].room + '#' + cast[k].step !== at0[k]);
      return { t: m.t, i: m.i, of: m.of, on: m.on,
               hour: G.hour, hourT: +(G.hourT || 0).toFixed(3),
               power: +G.power.toFixed(3),
               mon: !!G.monitor, cam: G.cam, monOut: +(G.monOut || 0).toFixed(2),
               dark: !!G.hallDark, wsDead: N.roomDead ? !!N.roomDead('workshop') : null,
               doors: [G.doors.left, G.doors.right, G.doors.hatch],
               cap: G.caption, moved: moved.length };
    };
    film.push(read());
    /* well past any beat: if this runs out, the scene never ended */
    while (slices < 60 * 30) {
      N.pumpFrame(DT);
      slices++;
      const r = read();
      film.push(r);
      if (!r.on) break;
    }
    /* and a few slices of the shift proper, so "it starts" is a fact */
    const after = [];
    for (let k = 0; k < 30; k++) { N.pumpFrame(DT); after.push(+G.power.toFixed(3)); }
    return { film, after, slices, hour: G.hour };
  }, night);

  /* the written scene, so the check knows what should have been said */
  const written = await p.evaluate(() => OuissysNightShift.__night.midScript());
  ok('the six nights each have a scene written for them',
     written && [1, 2, 3, 4, 5, 6].every((n) => written[n] && written[n].beats.length >= 4),
     written ? [1, 2, 3, 4, 5, 6].map((n) => written[n] ? written[n].beats.length : 0).join('/') + ' beats' : 'no script');

  for (const n of [1, 2, 3, 4, 5, 6]) {
    const r = await run(n);
    const f = r.film, last = f[f.length - 1], w = written[n];
    const tag = `night ${n}`;

    ok(`${tag}: every beat fires`, last.i === w.beats.length,
       `${last.i} of ${w.beats.length}`);

    ok(`${tag}: the shift starts`, !last.on && r.slices < 60 * 30,
       `${last.t.toFixed(1)}s, ${r.slices} slices`);

    /* the clock */
    const clock = f.filter((x) => x.on).every((x) => x.hour === 0);
    ok(`${tag}: the clock does not move while it runs`, clock,
       'hour ' + Math.max(...f.filter((x) => x.on).map((x) => x.hour)));

    /* the meter. Night four spends two per cent on purpose and nothing
       else spends anything at all */
    const held = f.filter((x) => x.on);
    const spent = +(held[0].power - held[held.length - 1].power).toFixed(2);
    const budget = w.beats.some((x) => x.act === 'surge') ? 2.01 : 0.001;
    ok(`${tag}: the meter only loses what the scene spends`, spent <= budget,
       `${spent} of ${budget}`);

    /* and it really is held rather than simply slow: once the shift
       starts, the same pump does drain it */
    ok(`${tag}: and the meter runs once the shift has started`,
       r.after[r.after.length - 1] < r.after[0],
       `${r.after[0]} -> ${r.after[r.after.length - 1]}`);

    ok(`${tag}: nobody walks`, held.every((x) => x.moved === 0),
       'moved ' + Math.max(...held.map((x) => x.moved)));

    /* handed back clean */
    ok(`${tag}: it hands the desk back with the monitor down`,
       !last.mon && last.monOut === 0, `mon ${last.mon}, snow ${last.monOut}`);
    ok(`${tag}: and with no door left shut`,
       last.doors.every((d) => !d), JSON.stringify(last.doors));

    /* every line written reaches the screen */
    const said = new Set(f.map((x) => x.cap));
    const missing = w.beats.filter((x) => x.sys).map((x) => x.sys).filter((l) => !said.has(l));
    ok(`${tag}: every line it is given reaches the screen`, missing.length === 0,
       missing.length ? missing[0] : w.beats.filter((x) => x.sys).length + ' lines');

    /* IN STEP. The beat counter and the caption move together: a frame
       where the nth beat has fired must be showing the nth line, not
       the one before it. Anything else is the drift this was built to
       remove, and it is invisible in a screenshot. */
    let drift = 0, worst = '';
    for (const x of f) {
      if (!x.on || x.i === 0) continue;
      const line = w.beats[x.i - 1].sys;
      if (!line) continue;                       // a silent beat says nothing
      if (x.cap !== line && said.has(line) === false) continue;
      if (x.cap !== line && f.indexOf(x) > 1) {
        /* allow the frame the line is pushed on; after that it is drift */
        const nextLine = w.beats[x.i - 1].sys;
        if (x.cap !== nextLine) { drift++; if (!worst) worst = `beat ${x.i} showing "${x.cap}"`; }
      }
    }
    ok(`${tag}: the machinery and the sentence about it are in step`,
       drift <= 1, drift ? `${drift} slices adrift — ${worst}` : 'exact');
  }

  /* the two nights that BREAK something: the fault has to arrive on the
     line that announces it, not before the scene starts */
  const two = await run(2);
  const beforeSnow = two.film.filter((x) => x.on && x.i < 3);
  ok('night two: camera eight is alive until it is not',
     beforeSnow.length > 2 && beforeSnow.every((x) => !x.wsDead),
     'dead in ' + beforeSnow.filter((x) => x.wsDead).length + ' of ' + beforeSnow.length + ' slices before it goes');
  ok('night two: and dead once the shift starts',
     two.film[two.film.length - 1].wsDead, '');

  const three = await run(3);
  const beforeDark = three.film.filter((x) => x.on && x.i < 4);
  ok('night three: the hall is lit until the third bank goes',
     beforeDark.length > 2 && beforeDark.every((x) => !x.dark),
     'dark in ' + beforeDark.filter((x) => x.dark).length + ' of ' + beforeDark.length + ' slices before it goes');
  ok('night three: and dark once the shift starts',
     three.film[three.film.length - 1].dark, '');

  /* a custom night is a sandbox */
  const custom = await p.evaluate(() => {
    const N = OuissysNightShift.__night;
    const r = N.begin(3, 0, { mode: 'custom' });
    const on = N.midState().on;
    N.begin(1);
    return { on, mode: r.mode };
  });
  ok('a custom night gets no scene', custom.on === false && custom.mode === 'custom',
     `mode ${custom.mode}, midState.on = ${custom.on}`);

  ok('and none of it threw', errs.length === 0, errs[0] || '');
  console.log(`\n${pass} passed, ${fail} failed`);
  await b.close();
  process.exit(fail ? 1 : 0);
})();
