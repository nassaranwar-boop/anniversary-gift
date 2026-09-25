/* DO THEY KEEP A SHAPE, OR DO THEY ALL GO AND STAND BY THE GOAL?
 *
 * "Sometimes all of them are next to the goal" is a complaint about a
 * thing that happens SOMETIMES, which is exactly the kind of thing you
 * cannot settle by watching. Two minutes of play look fine and the one
 * passage that looked wrong is over before you can say what it was.
 *
 * So play several matches, sample every side's shape a few times a
 * second, and count. Four numbers, each of which names a different way
 * of being wrong:
 *
 *   HUDDLE   all three outfielders of one side inside a circle small
 *            enough that they are in each other's way. This is the one
 *            she is describing.
 *   BOXFUL   four or more players of either side inside one penalty
 *            area while the ball is not. A box full of people with the
 *            ball at the other end is nobody marking anything.
 *   STACK    two team-mates within a body's width. One frame of it is
 *            a challenge; a steady percentage of it is a bug.
 *   WIDTH    how much of the pitch's width a side actually occupies.
 *            A team playing down a corridor has no shape even if it is
 *            spread out along it.
 *
 * The thresholds are not arbitrary: a player is 14 units wide and the
 * penalty area is 150 by 56, so "inside 46 units of each other" is
 * three people who could all be tackled by one opponent.
 *
 *   node tools/cupshape.js
 */
const { chromium } = require('playwright-core');

let pass = 0, fail = 0;
const ok = (msg, cond, extra) => {
  if (cond) { pass++; console.log('  ok   ' + msg); }
  else { fail++; console.log('  FAIL ' + msg + (extra !== undefined ? '  ' + JSON.stringify(extra) : '')); }
};

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox', '--no-proxy-server'] });
  const p = await b.newPage({ viewport: { width: 960, height: 540 } });
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.route('**/*', r => r.request().url().startsWith('http://127.0.0.1') ? r.continue() : r.abort());
  await p.goto('http://127.0.0.1:8899/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForTimeout(900);
  await p.evaluate(() => { try { localStorage.clear(); } catch (e) {} showScreen('hub'); startHub(); });
  await p.waitForTimeout(250);
  await p.click('#hub-card-cup');
  await p.waitForFunction(() => window.OuissyCup && OuissyCup.__cup.state() !== null, { timeout: 60000 });
  await p.waitForTimeout(600);

  const r = await p.evaluate(() => {
    const H = OuissyCup.__cup;
    const g = H.geometry().pitch;
    const S = { frames: 0, huddle: 0, boxful: 0, stack: 0, width: 0,
                worst: null, worstAt: 1e9, byState: {} };
    const HUDDLE_R = 46;      // three players one opponent could cover
    const STACK_R = 16;       // a body's width

    for (let round = 0; round < 3; round++) {
      H.quick(round); H.auto(true);
      for (let i = 0; i < 400 && H.state().state !== 'play'; i++) H.step(1, 0, 0, false);
      /* four minutes of football per round, sampled six times a second */
      for (let t = 0; t < 2400; t++) {
        H.step(1, 0, 0, false);
        if (t % 10) continue;
        const st = H.state();
        /* ONLY WHILE THE BALL IS IN PLAY. Players are SUPPOSED to run
           at each other during a goal celebration, and a restart has
           everybody standing on a mark by definition; counting those
           measures the celebration, not the shape. */
        if (st.state !== 'play') continue;
        const all = H.players();
        const ps = all.filter(q => !q.gk);
        /* state() carries the owner's NAME and the ball's coordinates,
           not an object — reading st.ball.y gave undefined, so "is the
           ball in this box" was always false and every crowded box was
           counted as a crowded box with the ball elsewhere. */
        const held = st.owner ? all.filter(q => q.name === st.owner)[0] : null;
        const poss = held ? held.team : -1;
        S.frames++;
        S.byState[st.state] = (S.byState[st.state] || 0) + 1;

        for (let team = 0; team < 2; team++) {
          const o = ps.filter(q => q.team === team);
          if (o.length < 3) continue;
          /* the smallest circle that holds them, near enough: the
             largest distance from their own centre */
          const cx = o.reduce((a, q) => a + q.x, 0) / o.length;
          const cy = o.reduce((a, q) => a + q.y, 0) / o.length;
          let far = 0;
          o.forEach(q => { far = Math.max(far, Math.hypot(q.x - cx, q.y - cy)); });
          if (far * 2 < HUDDLE_R) {
            S.huddle++;
            if (far * 2 < S.worstAt) {
              S.worstAt = far * 2;
              S.worst = { state: st.state, team: team, spread: Math.round(far * 2),
                          at: o.map(q => [Math.round(q.x), Math.round(q.y)]) };
            }
          }
          const xs = o.map(q => q.x);
          const wd = (Math.max.apply(null, xs) - Math.min.apply(null, xs)) / g.w;
          S.width += wd;
          /* split by whether this side has the ball, because a shape
             out of possession is arranged around the ball and a shape
             in possession is arranged around the formation — if only
             one of them is narrow, only one of them needs fixing */
          const mine = poss === team;
          const k = mine ? 'on' : 'off';
          S[k] = (S[k] || 0) + wd; S[k + 'N'] = (S[k + 'N'] || 0) + 1;
          const ys = o.map(q => q.y);
          S[k + 'D'] = (S[k + 'D'] || 0) + (Math.max.apply(null, ys) - Math.min.apply(null, ys)) / g.h;
        }
        /* two team-mates standing on each other */
        for (let i = 0; i < ps.length; i++) {
          for (let j = i + 1; j < ps.length; j++) {
            if (ps[i].team !== ps[j].team) continue;
            if (Math.hypot(ps[i].x - ps[j].x, ps[i].y - ps[j].y) < STACK_R) { S.stack++; i = ps.length; break; }
          }
        }
        /* a penalty area with a crowd in it and the ball somewhere else */
        [[g.y0, g.y0 + g.boxH], [g.y1 - g.boxH, g.y1]].forEach(([a, c]) => {
          const inBox = ps.filter(q => q.y >= a && q.y <= c
                                   && Math.abs(q.x - g.cx) <= g.boxW / 2).length;
          const ballIn = st.ballY >= a - 20 && st.ballY <= c + 20;
          if (inBox >= 4 && !ballIn) S.boxful++;
        });
      }
    }
    S.width = S.width / (S.frames * 2);
    return S;
  });

  const pc = (n) => (100 * n / r.frames).toFixed(1) + '%';
  console.log('  ' + r.frames + ' samples across three rounds');
  console.log('  huddle  ' + pc(r.huddle) + '   (a side\'s three outfielders inside 46 units)');
  console.log('  boxful  ' + pc(r.boxful) + '   (four in a penalty area, ball elsewhere)');
  console.log('  stack   ' + pc(r.stack) + '   (two team-mates inside a body\'s width)');
  console.log('  width   ' + (100 * r.width).toFixed(0) + '%   (of the pitch a side spans, on average)');
  console.log('     with the ball    ' + (100 * r.on / r.onN).toFixed(0) + '% wide, '
              + (100 * r.onD / r.onN).toFixed(0) + '% deep');
  console.log('     without it       ' + (100 * r.off / r.offN).toFixed(0) + '% wide, '
              + (100 * r.offD / r.offN).toFixed(0) + '% deep');
  if (r.worst) console.log('  tightest: ' + JSON.stringify(r.worst));
  console.log('');

  ok('they do not all stand together', r.huddle / r.frames < 0.04, pc(r.huddle));
  ok('a penalty area does not fill up with the ball elsewhere',
     r.boxful / r.frames < 0.03, pc(r.boxful));
  ok('team-mates are not standing on each other', r.stack / r.frames < 0.06, pc(r.stack));
  ok('a side uses the width of the pitch', r.width > 0.34, r.width);
  ok('no page errors', errs.length === 0, errs.slice(0, 3));
  console.log('');
  console.log(pass + ' passed, ' + fail + ' failed');
  await b.close();
  process.exit(fail ? 1 : 0);
})();
