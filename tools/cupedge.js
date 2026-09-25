/* DOES THE FIELD END?
 *
 * For a long time it did not. The mowing was painted as a full-width
 * band on every screen row, so the touchlines and goal lines were paint
 * on a green plane that ran to the edge of the picture — and behind the
 * goal the grass went straight into the advertising hoardings with
 * nothing in between. That is the whole reason the goal end looked
 * cheap, and it is invisible to every other harness here, because a
 * pitch with no edges renders perfectly happily.
 *
 * So this one asks the only question that matters about it: walking
 * outward from the middle of the pitch, in all four directions, do you
 * cross from turf, to unmown run-off, to hard apron, to the dark under
 * the hoardings? Four materials, in that order, on all four sides.
 *
 * It reads the pixels rather than the code, because the code has been
 * right and the picture wrong before now: the rings were computed
 * correctly for a whole afternoon while the touchline wall stood at
 * four units and the apron was drawn out to seven, so the wall was
 * built on top of its own surround and none of it was ever visible.
 *
 *   node tools/cupedge.js
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

  /* park the ball in the middle, hold the match still and let the
     camera settle, so nobody is standing on the pixel being read */
  const look = (side, at) => p.evaluate(([s, a]) => {
    const H = OuissyCup.__cup;
    H.quick(0); H.auto(true);
    /* out of the kickoff first. Parking the ball during the restart is
       parking it where the restart is about to take it from. */
    for (let i = 0; i < 400 && H.state().state !== 'play'; i++) H.step(1, 0, 0, false);
    H.side(s);
    /* PITCH.x is the pitch's WIDTH and PITCH.y its LENGTH, which is
       worth saying out loud: parking the ball at x1 to photograph "the
       goal end" put the camera on a touchline in the middle of the
       pitch, and the edge under test was simply not in the frame. */
    const g = H.geometry().pitch;
    const spot = { centre: [g.cx, g.cy],
                   end: [g.cx, g.y1 - 14],
                   wing: [g.x1 - 26, g.cy] }[a];
    /* HOLDING THE CAMERA STILL IS THE HARD PART.
       The match keeps running on the frame clock while the harness
       sleeps, so a ball dropped at the goal line is tackled and carried
       back up the pitch before the screenshot happens — which is how
       the goal end came to be photographed from the halfway line. A
       dead ball holds everybody where they are put. */
    if (a === 'end') { H.restart('corner', 1); for (let i = 0; i < 50; i++) H.step(1, 0, 0, false); }
    H.put(spot[0], spot[1], 0);
    for (let i = 0; i < 6; i++) { H.put(spot[0], spot[1], 0); H.step(1, 0, 0, false); }
    H.put(spot[0], spot[1], 0);
    H.camSnap();
  }, [side, at]);

  /* WALK OUTWARD AND NAME WHAT YOU STAND ON.
   *
   * The samples are taken at world coordinates rather than screen ones,
   * so the test says what it means: this is the turf a metre inside the
   * line, this is the run-off, this is the apron, this is the foot of
   * the wall. Where they land on screen is the renderer's business. */
  const walk = (axis, sign) => p.evaluate(([ax, sg]) => {
    const R = OuissyCup.__cup.r2();
    const w = R.raw, ctx = R.ctx;
    const isEnd = ax === 'y';
    const edge = (isEnd ? 7 : 4) / R.k;
    const line = isEnd ? (sg > 0 ? w.len : 0) : sg * w.halfW;
    const probes = [
      ['turf', -edge * 0.5],
      ['runoff', edge * 0.36],
      ['apron', edge * 0.80],
      /* AND THE SAME QUESTION ASKED SUB-PIXEL. The far touchline of a
         side-on view is three pixels of surround: which of the four
         materials a given fraction of the way out lands on is then a
         rounding accident, and the test would be measuring Math.round.
         These four are read together and only their BEST answer counts,
         because at that size "is any of this not grass" is the only
         thing the picture can be asked. */
      ['c1', edge * 0.55], ['c2', edge * 0.70],
      ['c3', edge * 0.92], ['c4', edge * 1.06],
      /* AT THE FOOT OF THE WALL, not past it. Sampling beyond the
         hoardings reads the advertising, which is a different colour
         every few metres by design, and a blue panel is not evidence
         about the ground. What is worth asking is whether the last of
         the surround lies in the wall's shade. */
      ['shade', edge * 0.99],
    ];
    /* WHERE ALONG THE LINE TO LOOK.
     *
     * Not a fixed spot. A camera that has panned to one end of the
     * ground has most of the far touchline off the side of the frame,
     * and a probe that lands outside the canvas returns nothing and
     * reads exactly like a missing ring. So walk the whole line, keep
     * only the positions where all four samples are actually inside the
     * picture, and take the commonest answer across those — which also
     * means one player standing on one of them cannot decide it. */
    const lo = isEnd ? -w.halfW * 0.8 : w.len * 0.06;
    const hi = isEnd ? w.halfW * 0.8 : w.len * 0.94;
    const seen = probes.map(() => ({}));
    let used = 0;
    for (let i = 0; i <= 40; i++) {
      const a = lo + (hi - lo) * (i / 40);
      const pts = probes.map(([, off]) => {
        const o = line + sg * off;
        const q = isEnd ? R.project(a, o) : R.project(o, a);
        return [Math.round(q.x), Math.round(q.y)];
      });
      if (pts.some(([x, y]) => x < 2 || y < 2
          || x >= ctx.canvas.width - 2 || y >= ctx.canvas.height - 2)) continue;
      used++;
      pts.forEach(([x, y], n) => {
        const d = ctx.getImageData(x, y, 1, 1).data;
        const k = d[0] + ',' + d[1] + ',' + d[2];
        seen[n][k] = (seen[n][k] || 0) + 1;
      });
    }
    /* HOW THICK THE SURROUND IS ON SCREEN, at the place being read.
       The far touchline of a side-on view is the whole ground away, so
       its four materials land inside three or four pixels — and
       demanding four distinguishable colours out of three pixels is
       demanding that perspective not happen. Where it is thin, the
       question is only the one that matters: does the grass stop before
       the hoarding does. */
    const mid = (lo + hi) / 2;
    const qa = isEnd ? R.project(mid, line) : R.project(line, mid);
    const qb = isEnd ? R.project(mid, line + sg * edge) : R.project(line + sg * edge, mid);
    const out = { used: used, cam: [Math.round(R.cam.x), Math.round(R.cam.y)], thick: Math.round(Math.hypot(qb.x - qa.x, qb.y - qa.y)) };
    probes.forEach(([name], n) => {
      let best = null, c = 0;
      Object.keys(seen[n]).forEach(k => { if (seen[n][k] > c) { c = seen[n][k]; best = k; } });
      out[name] = best;
    });
    return out;
  }, [axis, sign]);

  const lum = (c) => { const [r, g, bl] = c.split(',').map(Number); return 0.299 * r + 0.587 * g + 0.114 * bl; };
  const green = (c) => { const [r, g, bl] = c.split(',').map(Number); return g > r + 14 && g > bl + 14; };

  const sides = [
    ['side-on, far touchline', true, 'centre', 'x', 1],
    ['side-on, near touchline', true, 'centre', 'x', -1],
    ['side-on, the goal end', true, 'end', 'y', 1],
    ['up the pitch, far goal line', false, 'centre', 'y', 1],
    ['up the pitch, the touchline', false, 'wing', 'x', 1],
  ];

  for (const [name, sideOn, at, axis, sign] of sides) {
    await look(sideOn, at);
    await p.waitForTimeout(500);
    const r = await walk(axis, sign);
    console.log('  ' + name);
    console.log('     turf ' + r.turf + '   run-off ' + r.runoff
                + '   apron ' + r.apron + '   shade ' + r.shade
                + '   (' + r.used + ' places, ' + r.thick + 'px thick, cam ' + JSON.stringify(r.cam) + ')');
    ok('   this edge is actually in the picture', r.used >= 4, r);
    ok('   the turf is turf', !!r.turf && green(r.turf), r);
    /* the one thing every edge has to do, at any size */
    const crust = [r.apron, r.c1, r.c2, r.c3, r.c4].filter(Boolean);
    ok('   the grass stops before the hoardings do',
       crust.length > 0 && crust.some(c => !green(c)), r);
    if (r.thick >= 8) {
      ok('   the run-off is turf too, and darker than the pitch',
         !!r.runoff && green(r.runoff) && lum(r.runoff) < lum(r.turf), r);
      ok('   and the wall stands in its own shade',
         !!r.shade && !green(r.shade) && lum(r.shade) <= lum(r.apron), r);
    } else {
      console.log('     (' + r.thick + 'px of surround here \u2014 too far away to'
                  + ' resolve the rings, so only the boundary is checked)');
    }
  }

  ok('no page errors', errs.length === 0, errs.slice(0, 3));
  console.log('');
  console.log(pass + ' passed, ' + fail + ' failed');
  await b.close();
  process.exit(fail ? 1 : 0);
})();
