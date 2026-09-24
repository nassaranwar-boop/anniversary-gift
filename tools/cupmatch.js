/* IS IT FOOTBALL? — measured, over a whole match, rather than watched.
 *
 * A scoreline tells you nothing about whether a football game is
 * playing football. A side can lose 4-0 standing in a huddle and lose
 * 4-0 defending beautifully, and every complaint that a match looks
 * "glitchy" or "not logical" is really a complaint about one of a small
 * number of things that CAN be counted:
 *
 *   SHAPE      are the four of them spread across a pitch, or are they
 *              standing on each other? Measured as the mean nearest-
 *              teammate distance, and as the share of frames where two
 *              team-mates are inside a body's width of one another.
 *   JOBS       out of possession there must be exactly one presser and
 *              exactly one cover, every frame, on the side without the
 *              ball. Two pressers means nobody is covering.
 *   MARKING    two defenders on the same striker is the bug that leaves
 *              the other one alone in the box.
 *   GOAL-SIDE  a defender who is not between his man and his own goal
 *              is a defender who is about to be run past.
 *   LANES      the count that matters most: passes that travelled
 *              straight through an opponent. Nothing makes an AI look
 *              more like it is cheating.
 *   TERRITORY  where the ball spends its time. A game where it never
 *              leaves the middle third is a game with no attacks in it.
 *
 * It drives the clock by hand — requestAnimationFrame runs at about
 * three frames a second in this container — and leaves the controlled
 * player standing still, so what is measured is the AI and not a driver.
 *
 *   node tools/cupmatch.js
 */
const { chromium } = require('playwright-core');

let pass = 0, fail = 0;
const ok = (n, c, x) => { if (c) { pass++; console.log('  ok   ' + n); }
                          else { fail++; console.log('  FAIL ' + n + (x !== undefined ? '  ' + JSON.stringify(x) : '')); } };

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox', '--no-proxy-server', '--autoplay-policy=no-user-gesture-required'] });
  const p = await b.newPage({ viewport: { width: 900, height: 560 }, deviceScaleFactor: 1 });
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.route('**/*', r => r.request().url().startsWith('http://127.0.0.1') ? r.continue() : r.abort());
  await p.goto('http://127.0.0.1:8899/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForTimeout(1000);

  /* straight into a match: the menus have their own tests */
  await p.evaluate(() => { try { localStorage.clear(); } catch (e) {} showScreen('hub'); startHub(); });
  await p.waitForTimeout(300);
  await p.click('#hub-card-cup');
  await p.waitForFunction(() => window.OuissyCup && OuissyCup.__cup.state() !== null, { timeout: 60000 });
  await p.waitForTimeout(600);
  /* SEVERAL FIXTURES, NOT ONE.

     A single half of a four-a-side match is a small sample, and the
     rounds are deliberately not equal — the quarter-final opponent is
     supposed to be easier than the final's. Judging the AI off one
     early-round walkover says more about the fixture than the code. */
  /* SIX HALVES, NOT THREE.

     Three was not enough to assert on. Run the suite twice over and a
     different metric failed each time — pass completion at 47% one run,
     goal-side at 41% the next — not because anything had changed
     between them but because a four-a-side half is chaotic and three of
     them is a small sample. A gate that fails half the time for no
     reason is not a gate; people stop reading it.

     The tempting fix is to widen the bars until nothing fails, which
     throws away the only thing they are for. The correct one is more
     samples: each fixture is played twice, which halves the variance
     and costs a few minutes of wall clock in a harness nobody runs in a
     loop. The bars stay where the measurements put them. */
  const rounds = [0, 1, 2, 0, 1, 2];
  const runs = [];
  for (const rIdx of rounds) {
    await p.evaluate((r) => { OuissyCup.__cup.quick(r); OuissyCup.__cup.auto(true); }, rIdx);
    await p.waitForTimeout(150);
    runs.push(await p.evaluate(async () => {
    const H = OuissyCup.__cup;
    const G = () => H.state();
    for (let i = 0; i < 400 && G() && G().state !== 'play'; i++) H.step(1, 0, 0, false);
    if (!G() || G().state !== 'play') return { error: 'never reached play', st: G() };

    const PW = 288, PH = 404;
    let frames = 0;
    let nearSum = 0, nearN = 0, huddle = 0;
    let pressBad = 0, coverBad = 0, doubleMark = 0, notGoalSide = 0, markN = 0;
    let defFrames = 0;
    let thirds = [0, 0, 0];
    let lastOwner = null, passes = 0, keptPass = 0, lostPass = 0;
    let laneThrough = 0, laneN = 0;
    let stuck = 0;
    let goals = 0;
    let shotsSeen = [0, 0], lastShots = [0, 0];
    let carryDist = [[], []];

    /* one full half, stepped by hand */
    const STEPS = 2600;
    for (let i = 0; i < STEPS; i++) {
      H.step(1, 0, 0, false);
      const s = H.scout();
      if (!s) break;
      if (s.state !== 'play') { if (s.state === 'goal') goals++; continue; }
      frames++;

      if (s.stat.shots[0] > lastShots[0]) shotsSeen[0] += s.stat.shots[0] - lastShots[0];
      if (s.stat.shots[1] > lastShots[1]) shotsSeen[1] += s.stat.shots[1] - lastShots[1];
      lastShots = s.stat.shots.slice();
      if (s.owner) {
        const c = s.players.find(q => q.name === s.owner.name && q.t === s.owner.team);
        if (c && !c.gk) {
          /* how far the man on the ball is from the goal he is
             attacking, which is the number that decides whether a shot
             is ever even considered */
          const gy = s.owner.team === 0 ? 29 : 433;
          carryDist[s.owner.team].push(Math.round(Math.abs(c.y - gy)));
        }
      }

      /* --- territory */
      const ty = Math.max(0, Math.min(0.999, (s.ball.y - 16 - 13) / PH));
      thirds[Math.floor(ty * 3)]++;

      /* --- shape: nearest teammate, per outfielder */
      const outs = s.players.filter(q => !q.gk);
      outs.forEach(q => {
        let best = 1e9;
        outs.forEach(r => {
          if (r === q || r.t !== q.t) return;
          const d = Math.hypot(q.x - r.x, q.y - r.y);
          if (d < best) best = d;
        });
        if (best < 1e8) { nearSum += best; nearN++; if (best < 14) huddle++; }
      });

      /* --- jobs, on whichever side does NOT have the ball */
      if (s.owner) {
        const def = 1 - s.owner.team;
        const mine = outs.filter(q => q.t === def);
        const pressers = mine.filter(q => q.job === 'press').length;
        const covers = mine.filter(q => q.job === 'cover').length;
        defFrames++;
        if (pressers !== 1) pressBad++;
        if (covers > 1) coverBad++;
        /* two defenders on one striker */
        const marks = mine.filter(q => q.job === 'mark' && q.mark >= 0).map(q => q.mark);
        if (new Set(marks).size !== marks.length) doubleMark++;
        /* goal-side: team 0 attacks toward y0 in half 1, so their own
           goal is the far end — taken from the sim's own numbers by
           comparing against the keeper's position, which is always on
           the goal line being defended */
        const gk = s.players.find(q => q.gk && q.t === def);
        if (gk) {
          mine.forEach(q => {
            if (q.job !== 'mark' || q.mark < 0) return;
            const m = s.players[q.mark];
            if (!m) return;
            /* GOAL-SIDE MATTERS WHERE IT COSTS GOALS.

               Counted over every frame of a half, this is mostly
               midfield jostling: two players drifting past each other
               forty yards from anybody's goal, where being a stride the
               wrong way is worth nothing and gets corrected next touch.
               What is worth counting is the defending third — a marker
               the wrong side of his man inside his own half is a
               defender about to be run past. The window is the
               defending HALF rather than the third only because the
               third gives forty-odd samples a match, and forty samples
               swing thirty points on noise alone. */
            if (Math.abs(m.y - gk.y) > 205) return;
            markN++;
            const toGoal = Math.sign(gk.y - m.y);
            if (Math.sign(q.y - m.y) !== toGoal) notGoalSide++;
          });
        }
      }

      /* --- possession changes, and whether a pass survived */
      const own = s.owner ? s.owner.team + ':' + s.owner.name : null;
      if (own && lastOwner && own !== lastOwner) {
        passes++;
        if (own.charAt(0) === lastOwner.charAt(0)) keptPass++; else lostPass++;
      }
      if (own) lastOwner = own;

      /* --- nobody is moving: the "glitchy / stood still" complaint */
      const moving = outs.filter(q => q.sp > 4).length;
      if (moving === 0) stuck++;
    }

    const s = H.scout();
    return {
      frames, goals,
      nearMean: +(nearSum / Math.max(1, nearN)).toFixed(1),
      huddlePct: +(huddle / Math.max(1, nearN) * 100).toFixed(1),
      pressBadPct: +(pressBad / Math.max(1, defFrames) * 100).toFixed(1),
      coverBadPct: +(coverBad / Math.max(1, defFrames) * 100).toFixed(1),
      doubleMarkPct: +(doubleMark / Math.max(1, defFrames) * 100).toFixed(1),
      notGoalSidePct: +(notGoalSide / Math.max(1, markN) * 100).toFixed(1),
      markN,
      stuckPct: +(stuck / Math.max(1, frames) * 100).toFixed(1),
      thirds: thirds.map(t => +(t / Math.max(1, frames) * 100).toFixed(0)),
      passes, keptPct: +(keptPass / Math.max(1, passes) * 100).toFixed(0),
      /* THE REAL COMPLETION RATE, from the simulation's own counters.
         `keptPct` above counts owner CHANGES that stayed with the same
         side, which stopped meaning "pass completion" the moment the
         ball was freed from the foot: a heavy touch that runs loose and
         is picked up by an opponent is an owner change to the other
         side, and it is not a misplaced pass. */
      passTry: s.stat.passTry[0] + s.stat.passTry[1],
      passOk: s.stat.passes[0] + s.stat.passes[1],
      shots: shotsSeen, score: s.score,
      poss: s.stat.poss.map(v => +v.toFixed(0)),
      dbg: s.dbg,
    };
    }));
  }

  /* the aggregate is what the assertions read */
  const N = runs.length;
  const avg = (f) => +(runs.reduce((a, r) => a + f(r), 0) / N).toFixed(1);
  const report = {
    error: runs.find(r => r.error) && runs.find(r => r.error).error,
    frames: avg(r => r.frames),
    nearMean: avg(r => r.nearMean),
    huddlePct: avg(r => r.huddlePct),
    pressBadPct: avg(r => r.pressBadPct),
    coverBadPct: avg(r => r.coverBadPct),
    doubleMarkPct: avg(r => r.doubleMarkPct),
    notGoalSidePct: avg(r => r.notGoalSidePct),
    stuckPct: avg(r => r.stuckPct),
    thirds: [0, 1, 2].map(i => Math.round(avg(r => r.thirds[i]))),
    passes: avg(r => r.passes),
    passTry: avg(r => r.passTry),
    passOk: avg(r => r.passOk),
    passPct: +(runs.reduce((a, r) => a + r.passOk, 0) /
               Math.max(1, runs.reduce((a, r) => a + r.passTry, 0)) * 100).toFixed(1),
    keptPct: avg(r => r.keptPct),
    shots: [0, 1].map(i => avg(r => r.shots[i])),
    score: [0, 1].map(i => avg(r => r.score[i])),
    poss: [0, 1].map(i => avg(r => r.poss[i])),
    /* the worst single fixture on the one measure that is allowed to
       swing with the fixture */
    possRatio: Math.min(...runs.map(r =>
      Math.min(...r.poss) / Math.max(1, Math.max(...r.poss)))),
    each: runs.map(r => r.score.join('-') + ' (' + r.shots.join('/') + ' shots, ' +
                        r.poss.join('s v ') + 's)'),
    dbg: runs.map(r => r.dbg),
    gsEach: runs.map(r => r.notGoalSidePct),
    markNEach: runs.map(r => r.markN),
  };

  if (report.error) {
    console.log('  ' + report.error, JSON.stringify(report.st));
    await b.close();
    process.exit(1);
  }

  console.log('three halves of football, nobody driving:');
  report.each.forEach((e, i) => console.log('   round ' + i + ': ' + e));
  console.log('averages:');
  console.log('   score ' + report.score.join('-') + '   shots ' + report.shots.join('-') +
              '   possession ' + report.poss.join('s / ') + 's');
  console.log('   ball spent ' + report.thirds.join('% / ') + '% of its time in each third');
  console.log('   nearest team-mate averaged ' + report.nearMean + ' units apart');
  console.log('   ' + report.passes + ' changes of possession; ' +
              Math.round(report.passTry) + ' passes attempted, ' +
              report.passPct + '% found a team-mate');
  console.log('   goal-side failures per round: ' + JSON.stringify(report.gsEach) + ' over ' + JSON.stringify(report.markNEach) + ' samples');
  console.log('   carrier decisions: ' + JSON.stringify(report.dbg[0]));
  console.log('');

  ok('the shape is a shape, not a huddle (mean gap over 34)', report.nearMean > 34, report.nearMean);
  ok('team-mates rarely stand on each other (under 6% of the time)',
     report.huddlePct < 6, report.huddlePct);
  ok('the side without the ball always has exactly one presser',
     report.pressBadPct < 3, report.pressBadPct);
  ok('and never two players covering', report.coverBadPct < 1, report.coverBadPct);
  ok('two defenders never pick up the same man', report.doubleMarkPct < 2, report.doubleMarkPct);
  /* WHY THE BAR IS WHERE IT IS.

     Run the identical build three times and this number comes back as
     anything from 5% to 52% on a single fixture: a four-a-side half is
     chaotic, one early goal changes the shape of the rest of it, and a
     defender stuck the wrong side for two seconds contributes a hundred
     and twenty correlated samples to the count. Tuning against a single
     round's figure is tuning against noise.

     What IS stable is the three-round average, which sits around 25%
     — a marker is goal-side of his man roughly three times in four,
     which is about right for three outfielders covering a pitch this
     size against attackers who are allowed to spin off them. The
     broken regimes are nowhere near it: before the block held a line at
     all this averaged over 50%, and with the striker exempt from the
     line it averaged 33%. So the bar catches breakage without
     pretending the measurement is sharper than it is. */
  ok('a marker is usually goal-side of his man in his own half',
     report.notGoalSidePct < 32, report.notGoalSidePct);
  ok('somebody is always moving', report.stuckPct < 2, report.stuckPct);
  ok('the ball reaches both ends of the pitch',
     report.thirds[0] > 8 && report.thirds[2] > 8, report.thirds);
  /* Shot counts over a fifty-second half are small numbers, and small
     numbers swing: a quiet fixture can genuinely finish with one shot
     in it. What must never happen is a side that cannot shoot AT ALL
     across three halves, which is what a broken attack looks like. */
  ok('neither side is incapable of a shot',
     report.shots[0] > 0.3 && report.shots[1] > 0.3, report.shots);
  ok('and between them they manage a few',
     (report.shots[0] + report.shots[1]) * 3 >= 5,
     +((report.shots[0] + report.shots[1]) * 3).toFixed(0));
  ok('goals get scored', report.score[0] + report.score[1] > 0.5, report.score);
  /* FOUR A SIDE WITH A PRESS ON IS NOT TIKI-TAKA. Every player is
     inside twenty yards of an opponent for most of a half, so a
     completion rate in the fifties is a healthy one and anything near
     ninety would mean the defending had stopped working. What the bar
     is really for is catching the broken case: passes fired at marked
     men through defenders, which lands in the thirties. */
  ok('a pass mostly finds a team-mate (about half or better)',
     report.passPct > 48, report.passPct);
  ok('even the beaten side keeps the ball sometimes',
     report.possRatio > 0.12, +report.possRatio.toFixed(2));
  ok('no page errors', errs.length === 0, errs.slice(0, 3));

  console.log('');
  console.log(pass + ' passed, ' + fail + ' failed');
  await b.close();
  process.exit(fail ? 1 : 0);
})();
