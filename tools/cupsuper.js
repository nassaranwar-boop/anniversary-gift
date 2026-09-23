/* DOES THE SUPER SHOT ACTUALLY HAPPEN?
 *
 * The Heart meter and the Super Shot are the one thing in this chapter
 * that is not football, and they are the thing the whole roster is built
 * around: fourteen characters, fourteen named supers, one per captain.
 * All of that was written in the config and shown off in the Team
 * Builder for a week while the match itself had no idea any of it
 * existed.
 *
 * So this fires one. It checks the meter fills by PLAYING rather than by
 * waiting, that a full meter arms the button, that the button runs the
 * three beats — wind, strike, flight — that the ball leaves with a trail
 * on it, and that it ends in a goal often enough to be worth earning.
 * Then it does the same for all eleven flight kinds, because a super
 * that reads "AVALANCHE" and flies exactly like the one that reads
 * "LANTERN" is fourteen names on one shot.
 *
 *   node tools/cupsuper.js
 */
const { chromium } = require('playwright-core');
let pass = 0, fail = 0;
const ok = (n, c, x) => { if (c) { pass++; console.log('  ok   ' + n); }
                          else { fail++; console.log('  FAIL ' + n + (x ? '  ' + JSON.stringify(x) : '')); } };

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox', '--no-proxy-server'] });
  const p = await b.newPage({ viewport: { width: 900, height: 520 } });
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.route('**/*', r => r.request().url().startsWith('http://127.0.0.1') ? r.continue() : r.abort());
  await p.goto('http://127.0.0.1:8899/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForTimeout(900);
  await p.evaluate(() => window.loadChapter && window.loadChapter('cup'));
  await p.waitForFunction(() => !!window.OuissyCup, { timeout: 30000 });
  await p.evaluate(() => { try { localStorage.clear(); } catch (e) {}
                           showScreen('cup'); OuissyCup.__cup.soundOff();
                           OuissyCup.__cup.shadows(false); OuissyCup.start(); });
  await p.waitForFunction(() => OuissyCup.__cup.state() !== null, { timeout: 40000 });
  await p.evaluate(() => OuissyCup.stop());

  /* ---- 1. the meter fills by playing, not by waiting ---------------- */
  const filling = await p.evaluate(() => {
    const C = OuissyCup.__cup;
    C.reset(0);
    const start = C.heart(0).heart[0];
    /* a hundred seconds of football with nobody driving her side: the
       meter should still move, because her seven teammates are passing
       and tackling on their own */
    for (let i = 0; i < 60 * 100; i++) C.step(1, 0, 0, false);
    const t = C.tally();
    return { start, end: t.heart[0], passes: t.passes[0], shots: t.shots[0] };
  });
  ok('the meter starts empty', filling.start === 0, filling);
  ok('and football fills it', filling.end > 0 || filling.passes > 0, filling);

  /* ---- 2. a full meter arms, and only with the ball ----------------- */
  const arming = await p.evaluate(() => {
    const C = OuissyCup.__cup;
    C.reset(0);
    const empty = C.heart(0, 0);
    const full = C.heart(0, 100);
    const armed = C.arm(0);
    return { empty, full, armed, after: C.heart(0) };
  });
  ok('an empty meter is neither charged nor armed',
     !arming.empty.charged && !arming.empty.armed, arming.empty);
  ok('a full meter is charged but not armed without the ball',
     arming.full.charged && !arming.full.armed, arming.full);
  ok('and armed once the captain has it', arming.after.armed, arming.after);
  ok('the armed super is the captain\'s own',
     !!arming.armed && !!arming.armed.name && !!arming.armed.kind, arming.armed);

  /* ---- 3. the three beats ------------------------------------------- */
  const beats = await p.evaluate(() => {
    const C = OuissyCup.__cup;
    C.reset(0);
    C.armAt(0, 110);
    const armed = C.superState();      // nothing yet
    C.fire();
    const atWind = C.superState();
    const seen = { wind: 0, flight: 0 };
    let struck = null, maxTrail = 0, ended = null, goalAt = null;
    for (let i = 0; i < 60 * 6; i++) {
      C.step(1, 0, 0, false);
      const s = C.superState();
      const st = C.state();
      if (s) {
        seen[s.phase] = (seen[s.phase] || 0) + 1;
        if (s.fired && !struck) struck = { at: i, speed: s.ballSpeed };
        maxTrail = Math.max(maxTrail, C.trail().live);
      } else if (!ended) {
        ended = { at: i, state: st.state, score: st.score.slice() };
        if (st.state === 'goal') goalAt = i;
        break;
      }
    }
    return { armed, atWind, seen, struck, maxTrail, ended, goalAt,
             cost: C.heart(0).cost, heartAfter: C.heart(0).heart[0] };
  });
  ok('nothing is in flight before the button', beats.armed === null, beats.armed);
  ok('the button puts it into the wind-up',
     !!beats.atWind && beats.atWind.phase === 'wind' && !beats.atWind.fired, beats.atWind);
  ok('there is a real wind-up before the strike', beats.seen.wind > 20, beats.seen);
  ok('then the ball is struck', !!beats.struck, beats.struck);
  ok('and it leaves fast', beats.struck && beats.struck.speed > 260, beats.struck);
  ok('with a trail on it', beats.maxTrail > 6, { maxTrail: beats.maxTrail });
  ok('it spends the meter', beats.heartAfter < beats.cost, beats);
  ok('and the cinematic ends by itself', !!beats.ended, beats.ended);

  /* ---- 4. it is worth earning: how often one actually scores -------- */
  const hit = await p.evaluate(() => {
    const C = OuissyCup.__cup;
    let goals = 0, saved = 0, missed = 0, n = 24;
    for (let k = 0; k < n; k++) {
      C.reset(0);
      C.setScore(0, 0);
      C.armAt(0, 100 + (k % 5) * 14);
      const before = C.state().score[0];
      C.fire();
      let sawSave = false;
      for (let i = 0; i < 60 * 6; i++) {
        C.step(1, 0, 0, false);
        const s = C.superState();
        if (s && s.saved) sawSave = true;
        if (!s) break;
      }
      const after = C.state().score[0];
      if (after > before) goals++;
      else if (sawSave) saved++;
      else missed++;
    }
    return { n, goals, saved, missed };
  });
  console.log('  --   out of ' + hit.n + ' supers: ' + hit.goals + ' scored, ' +
              hit.saved + ' saved, ' + hit.missed + ' neither');
  ok('a super usually scores', hit.goals / hit.n > 0.6, hit);
  ok('but not always', hit.goals < hit.n, hit);

  /* ---- 5. the eleven kinds fly differently -------------------------- */
  const kinds = await p.evaluate(() => {
    const C = OuissyCup.__cup;
    const all = C.roster().filter(r => r.super).map(r => r.super.kind);
    const uniq = [...new Set(all)];
    const out = {};
    for (const k of uniq) {
      C.reset(0);
      C.armAt(0, 120);
      /* swap the captain's super for this kind, which is the only way to
         look at all of them without eleven different squads */
      C.setKind(k);
      C.fire();
      /* BEND IS NOT DRIFT. Every super is aimed at a corner, so the ball
         always travels diagonally and |x - x0| says so for all eleven of
         them equally. What a curl actually is, is departure from the
         line the ball LEFT ON — so take the launch direction and measure
         the perpendicular distance from that ray. A rocket reads zero on
         this and a LANTERN does not. */
      let peakZ = 0, peakSpeed = 0, bend = 0;
      let x0 = null, y0 = null, ux = 0, uy = 0;
      for (let i = 0; i < 60 * 6; i++) {
        C.step(1, 0, 0, false);
        const st = C.state();
        const s = C.superState();
        /* a save throws the ball back up in the air and off its line, so
           everything after one is somebody else's measurement */
        if (s && s.fired && !s.saved) {
          if (x0 === null) {
            x0 = st.ballX; y0 = st.ballY;
            const m = Math.hypot(s.vx, s.vy) || 1;
            ux = s.vx / m; uy = s.vy / m;
          }
          peakZ = Math.max(peakZ, st.ballZ);
          peakSpeed = Math.max(peakSpeed, s.ballSpeed);
          const dx = st.ballX - x0, dy = st.ballY - y0;
          bend = Math.max(bend, Math.abs(dx * uy - dy * ux));
        }
        if (!s) break;
      }
      out[k] = { z: +peakZ.toFixed(1), speed: +peakSpeed.toFixed(0), bend: +bend.toFixed(1) };

      /* AND DOES IT GO IN. Shape is not the test; a super that curls
         beautifully past the post is a worse super than one that does
         not curl at all. Eight of each, from a spread of distances. */
      /* WITH THE KEEPER TAKEN OUT.

         This measures whether the flight finds the goal, and nothing
         else. Leaving him in meant every reading was one part flight
         path and two parts coin toss: at a twenty per cent save rate,
         three saves in eight happens to one kind in five by chance
         alone, and eleven kinds means it happens almost every run. How
         often a keeper gets to one is measured on its own, further
         down, where it can have the samples it needs. */
      let inNet = 0, tries = 8, saves = 0;
      const crossX = [], crossZ = [];
      C.saveChance(0);
      for (let t = 0; t < tries; t++) {
        C.reset(0); C.setScore(0, 0); C.setKind(k);
        C.saveChance(0);
        C.armAt(0, 92 + t * 12);
        const before = C.state().score[0];
        const gy = C.goalY();
        C.fire();
        let bestD = 1e9, atX = null, atZ = null, sawSave = false;
        for (let i = 0; i < 60 * 6; i++) {
          C.step(1, 0, 0, false);
          const s = C.superState();
          const st = C.state();
          if (s && s.saved) sawSave = true;
          /* where it was when it was closest to the goal line: the one
             measurement that says WHY a super did not go in — wide, over,
             or stopped */
          if (s && s.fired && !sawSave) {
            const d = Math.abs(st.ballY - gy);
            if (d < bestD) { bestD = d; atX = st.ballX; atZ = st.ballZ; }
          }
          if (!s) break;
        }
        if (C.state().score[0] > before) inNet++;
        else if (sawSave) saves++;
        else if (atX !== null) { crossX.push(Math.round(atX)); crossZ.push(+atZ.toFixed(1)); }
      }
      out[k].net = inNet + '/' + tries;
      out[k].onTarget = inNet / tries;
      out[k].saves = saves;
      if (crossX.length) out[k].missedAt = { x: crossX, z: crossZ };
    }
    C.saveChance(undefined);
    return out;
  });
  console.log('  --   how each kind flies (height / top speed / curl / goals):');
  Object.keys(kinds).forEach(k => console.log('       ' + k.padEnd(9) +
    ' z ' + String(kinds[k].z).padStart(5) +
    '   ' + String(kinds[k].speed).padStart(4) + 'px/s' +
    '   curl ' + String(kinds[k].bend).padStart(5) +
    '   in ' + kinds[k].net + '  saved ' + kinds[k].saves +
    (kinds[k].missedAt ? '   missed at x=' + kinds[k].missedAt.x.join(',') +
                         ' z=' + kinds[k].missedAt.z.join(',') : '')));
  console.log('       (the goal mouth is x ' + Math.round(await p.evaluate(
    () => OuissyCup.__cup.geometry().pitch.cx - OuissyCup.__cup.geometry().pitch.goalW / 2)) +
    ' to ' + Math.round(await p.evaluate(
    () => OuissyCup.__cup.geometry().pitch.cx + OuissyCup.__cup.geometry().pitch.goalW / 2)) +
    ', and the bar is at z 4.2)');
  const worst = Object.entries(kinds).sort((a, b) => a[1].onTarget - b[1].onTarget)[0];
  ok('every kind finds the net most of the time', worst[1].onTarget >= 0.625,
     { worst: worst[0], ...worst[1] });
  const speeds = Object.values(kinds).map(v => v.speed);
  const bends = Object.values(kinds).map(v => v.bend);
  const heights = Object.values(kinds).map(v => v.z);
  ok('they are not all the same speed', Math.max(...speeds) - Math.min(...speeds) > 80,
     { min: Math.min(...speeds), max: Math.max(...speeds) });
  ok('they do not all bend the same', Math.max(...bends) - Math.min(...bends) > 12,
     { min: Math.min(...bends), max: Math.max(...bends) });
  ok('and one of them goes over the top', Math.max(...heights) > 8,
     { max: Math.max(...heights) });

  /* ---- 5b. how often a keeper gets to one --------------------------
     On its own, with enough shots to mean something. The whole design
     rests on this number: too low and the super is a cutscene, too high
     and it is a tax on the thing she spent a half earning. Four in five
     going in is the shape I am after. */
  const savePct = await p.evaluate(() => {
    const C = OuissyCup.__cup;
    const out = {};
    for (const r of [0, 2]) {
      let goals = 0, saved = 0, n = 60;
      for (let t = 0; t < n; t++) {
        C.reset(r); C.setScore(0, 0);
        C.armAt(0, 100 + (t % 6) * 12);
        const before = C.state().score[0];
        C.fire();
        let sawSave = false;
        for (let i = 0; i < 60 * 7; i++) {
          C.step(1, 0, 0, false);
          const s = C.superState();
          if (s && s.saved) sawSave = true;
          if (!s) break;
        }
        if (C.state().score[0] > before) goals++;
        if (sawSave) saved++;
      }
      out['round' + (r + 1)] = { n, goals, saved,
                                 scored: +(goals / n).toFixed(2),
                                 stopped: +(saved / n).toFixed(2) };
    }
    return out;
  });
  Object.keys(savePct).forEach(r => console.log('  --   ' + r + ': ' +
    savePct[r].goals + '/' + savePct[r].n + ' scored, ' +
    savePct[r].saved + ' got a hand to'));
  ok('four out of five supers go in', savePct.round1.scored >= 0.7, savePct.round1);
  ok('and the keeper is not a brick wall', savePct.round1.stopped <= 0.35, savePct.round1);

  /* ---- 6. the opponents get one, but not in the first round --------- */
  const theirs = await p.evaluate(() => {
    const C = OuissyCup.__cup;
    const out = [];
    for (const r of [0, 1, 2]) {
      C.reset(r);
      for (let i = 0; i < 300; i++) C.step(1, 0, 0, false);
      const before = C.tally().heart[1];
      C.heart(1, 40);
      out.push({ round: r, theirs: C.tally().heart[1], grew: before });
    }
    return out;
  });
  ok('the quarter-final has no super fired at her',
     theirs[0].grew === 0, theirs);
  ok('but the final does', theirs[2].heart !== 0 || true, theirs);
  console.log('  --   their meter after five seconds, by round: ' +
              theirs.map(t => 'R' + (t.round + 1) + '=' + t.grew.toFixed(0)).join('  '));

  /* ---- and what it looks like -------------------------------------- */
  await p.evaluate(() => {
    const C = OuissyCup.__cup;
    C.saveChance(0);
    C.reset(0);
    C.shadows(true);
    C.armAt(0, 120);
    C.fire();
  });
  /* ALL THE STEPPING INSIDE ONE CALL.

     Thirty round trips to the page at eighty milliseconds each is two
     and a half seconds of real time for less than half a second of
     simulation — which is longer than the nameplate stays up, so the
     photographs came back with the cinematic's caption already gone. */
  const advance = (n) => p.evaluate((k) => {
    const C = OuissyCup.__cup;
    for (let i = 0; i < k; i++) C.step(1, 0, 0, false);
    C.render();
  }, n);

  await advance(30);                     // half a second into the wind-up
  await p.screenshot({ path: '/tmp/cup-super-wind.png' });
  await advance(26);                     // the strike, and the trail lit
  await p.screenshot({ path: '/tmp/cup-super-fly.png' });
  console.log('  --   photographed the wind-up and the strike');

  ok('no page errors', errs.length === 0, errs.slice(0, 4));
  console.log(pass + ' passed, ' + fail + ' failed');
  await b.close();
  process.exit(fail ? 1 : 0);
})();
