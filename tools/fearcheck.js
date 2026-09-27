/* HOW OFTEN IS SHE ACTUALLY IN TROUBLE?

   "I do not feel scared at all." That is not a thing a suite can
   measure directly, but the four things that cause it are:

     can she lose        a horror game a careful player cannot lose is
                         not frightening, whatever is on the screen
     how close           seconds spent with something at an OPEN door,
                         which is the only window in which she can die
     how thin            the meter at six, and how long it spends under
                         a quarter
     how often anything  door arrivals, knocks, blackouts, something in
                         her own office

   It plays each night three ways -- perfectly, normally, and badly --
   and prints all of it, because "night one is too easy" and "night one
   is too easy FOR A GOOD PLAYER" are different reports.
                                               node tools/fearcheck.js */
const { chromium } = require('playwright-core');
const RUNS = +(process.env.RUNS || 3);
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox', '--no-proxy-server', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 1000, height: 700 } });
  p.on('pageerror', (e) => console.log('PAGEERROR', e.message));
  await p.route('**/*', (r) => { const u = r.request().url();
    if (u.indexOf('book-scene.js') >= 0) return r.abort();
    return u.startsWith('http://127.0.0.1') ? r.continue() : r.abort(); });
  await p.goto('http://127.0.0.1:8899/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.evaluate(() => { try { localStorage.clear(); } catch (e) {}
    localStorage.setItem('ns_seenintro', '1'); localStorage.setItem('ns_notutor', '1');
    showScreen('nightshift');
    return loadChapter('nightshift').then(() => OuissysNightShift.start()); });
  await p.waitForFunction(() => { try { return !!OuissysNightShift.__night.cast().jax; }
                                  catch (e) { return false; } }, null, { timeout: 30000, polling: 200 });
  await p.evaluate(() => OuissysNightShift.__night.silence(true));

  /* skill: 1 = perfect (shuts the instant something arrives, winds
     everything, monitor only in bursts), 0.6 = normal (half a second
     late, misses a wind here and there), 0.25 = careless */
  const play = (night, skill) => p.evaluate(([night, skill]) => {
    const N = OuissysNightShift.__night, G = N.state(), cast = N.cast();
    N.begin(night); N.midEnd();
    const DT = 1 / 20;
    let openDoorSec = 0, arrivals = 0, blackouts = 0, wasBlack = false;
    let thin = 0, deskSeen = 0, reactT = {}, lowest = 100;
    const wasAt = {};
    for (let k = 0; k < 20 * 60 * 7 && G.hour < 6; k++) {
      if (G.phase === 'reveal') { N.route('keep'); continue; }
      if (G.phase === 'found')  { N.route('findOut'); continue; }
      if (G.phase === 'held')   { N.route('heldOut'); continue; }
      if (G.phase !== 'play') break;

      /* --- how she plays --------------------------------------- */
      /* WHAT SHE CAN ACTUALLY KNOW.

         Reading cast[].atDoor is the harness cheating: the player is
         told by the annunciator, which names the door -- until the
         last night, where the sensors stop resolving a bearing and she
         has only the panned cue. A run that keeps reading atDoor on
         that night measures a game nobody is playing. So on a blind
         night she is slower to place it, and the careless one shuts
         both and pays for it. */
      const blind = !!N.hazardOn && N.hazardOn('blindSensors');
      const anyDoor = {};
      let anywhere = false;
      ['left', 'right', 'hatch'].forEach((d) => { anyDoor[d] = false; });
      for (const id in cast) {
        const c = cast[id];
        if (c && c.awake && c.atDoor) { anyDoor[c.def.door] = true; anywhere = true; }
      }
      ['left', 'right', 'hatch'].forEach((d) => {
        const there = blind ? anywhere : anyDoor[d];
        if (there) {
          reactT[d] = (reactT[d] || 0) + DT;
          /* placing it by ear costs time; a careless player does not
             place it at all and holds everything */
          const lag = (1 - skill) * 1.2 + (blind ? (skill > 0.8 ? 0.7 : 1.4) : 0);
          if (reactT[d] >= lag) {
            /* a good player on a blind night still works out the side
               and opens the other two straight back up */
            if (!blind || skill > 0.8) G.doors[d] = anyDoor[d] || (blind && reactT[d] < lag + 0.8);
            else G.doors[d] = true;
          }
        } else if (!blind) { reactT[d] = 0; G.doors[d] = false; }
        else if (!anywhere) { reactT[d] = 0; G.doors[d] = false; }
      });
      /* the monitor: a good player sweeps in short bursts, a careless
         one leaves it up */
      if (skill > 0.8) G.monitor = (k % 200) < 26;
      else if (skill > 0.4) G.monitor = (k % 200) < 60;
      else G.monitor = (k % 200) < 130;
      /* winding, by hand, at the rate that skill implies */
      if (k % 40 === 0) {
        const order = Object.keys(cast).filter((id) => cast[id] && !cast[id].sold)
          .sort((a, c) => (cast[a].wound || 0) - (cast[c].wound || 0));
        const want = Math.round(skill * 4);
        for (let i = 0; i < want; i++) {
          const c = cast[order[i]];
          if (c && (c.wound || 0) < 4) { c.wound = 9; G.power -= 1; }
        }
      }

      N.pumpFrame(DT);

      /* --- what it cost her ------------------------------------ */
      for (const id in cast) {
        const c = cast[id];
        if (!c || !c.awake) { if (c) wasAt[id] = false; continue; }
        if (c.atDoor && !wasAt[id]) { arrivals++; wasAt[id] = true; }
        if (!c.atDoor) wasAt[id] = false;
        if (c.atDoor && !G.doors[c.def.door]) openDoorSec += DT;
      }
      if (G.blackout && !wasBlack) blackouts++;
      wasBlack = G.blackout;
      if (G.power < 25) thin += DT;
      lowest = Math.min(lowest, G.power);
      if (N.desk && N.desk().on) deskSeen++;
    }
    return { night, skill, end: G.phase, hour: +G.hour.toFixed(1),
             power: +G.power.toFixed(1), lowest: +lowest.toFixed(1),
             openDoorSec: +openDoorSec.toFixed(1), arrivals,
             blackouts, thin: Math.round(thin), knocks: G.stats.knocks,
             slack: G.stats.slack, died: G.phase === 'over' ? (G.dead || 'yes') : '' };
  }, [night, skill]);

  const rows = [];
  for (const skill of [1, 0.6, 0.25]) {
    for (const night of [1, 2, 3]) {
      for (let r = 0; r < RUNS; r++) rows.push(await play(night, skill));
    }
  }
  const label = { 1: 'perfect', 0.6: 'normal ', 0.25: 'careless' };
  console.log('\n  skill     n   died      ended   meter  lowest  <25%   open-door  arrivals  knocks');
  for (const skill of [1, 0.6, 0.25]) {
    for (const night of [1, 2, 3]) {
      const g = rows.filter((x) => x.skill === skill && x.night === night);
      const died = g.filter((x) => x.died).length;
      const avg = (f) => (g.reduce((a, x) => a + f(x), 0) / g.length).toFixed(1);
      console.log('  ' + label[skill].padEnd(9) + night +
        '   ' + (died + '/' + g.length).padEnd(9) +
        ' ' + avg((x) => x.hour).padStart(5) +
        '  ' + avg((x) => x.power).padStart(5) + '%' +
        '  ' + avg((x) => x.lowest).padStart(5) + '%' +
        '  ' + avg((x) => x.thin).padStart(4) + 's' +
        '  ' + avg((x) => x.openDoorSec).padStart(8) + 's' +
        '  ' + avg((x) => x.arrivals).padStart(8) +
        '  ' + avg((x) => x.knocks).padStart(6));
    }
  }
  /* --- AND IT JUDGES, so "it is not frightening" cannot come back
         quietly. These are the four things that were measurably wrong,
         written as the floor rather than as a target. */
  let pass = 0, fail = 0;
  const ok = (n, c, x) => { if (c) { pass++; console.log('  ok   ' + n); }
    else { fail++; console.log('  FAIL ' + n + (x !== undefined ? '  ' + JSON.stringify(x) : '')); } };
  const pick = (skill, night) => rows.filter((x) => x.skill === skill && x.night === night);
  const died = (skill, night) => pick(skill, night).filter((x) => x.died).length;
  const mean = (skill, night, f) => pick(skill, night).reduce((a, x) => a + f(x), 0) / RUNS;

  console.log('');
  /* the whole complaint, in one line: before this it was one death in
     twenty-seven runs across every skill level and every night */
  ok('a careless player can lose the chapter',
     died(0.25, 2) + died(0.25, 3) > 0,
     { n2: died(0.25, 2), n3: died(0.25, 3) });
  ok('and skill is what saves her: a perfect one never loses',
     died(1, 1) + died(1, 2) + died(1, 3) === 0,
     [died(1, 1), died(1, 2), died(1, 3)]);
  /* the last night takes the bearing away, so even a good player spends
     real time with something at an open door while she places it */
  ok('the last night costs a good player real seconds at an open door',
     mean(1, 3, (x) => x.openDoorSec) > 5,
     +mean(1, 3, (x) => x.openDoorSec).toFixed(1));
  ok('and it takes a normal one to the wire',
     mean(0.6, 3, (x) => x.power) < 12, +mean(0.6, 3, (x) => x.power).toFixed(1));
  /* the curve still has to be a curve */
  ok('the nights get harder rather than merely different',
     mean(0.6, 1, (x) => x.power) > mean(0.6, 2, (x) => x.power) &&
     mean(0.6, 2, (x) => x.power) > mean(0.6, 3, (x) => x.power),
     [1, 2, 3].map((n) => +mean(0.6, n, (x) => x.power).toFixed(1)));

  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  await b.close();
  process.exit(fail ? 1 : 0);
})();
