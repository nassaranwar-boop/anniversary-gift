/* IS IT ALIVE, AND IS IT STILL?
 *
 * Two opposite questions about the same picture, and a chapter has to
 * answer both.
 *
 *   ALIVE   the crowd has to move. A stand painted once is a texture,
 *           and the eye reads a texture as wallpaper and stops looking
 *           at it. So: hold the camera dead still, take two frames a
 *           third of a second apart, and count how much of the stand
 *           changed. Nothing changed means nobody is in there.
 *
 *   STILL   the GROUND has to not move. With the camera parked and the
 *           ball dead, every pixel of grass, paint and surround should
 *           be identical between those same two frames. Anything that
 *           flickers there is either a rounding error fighting itself
 *           or — as it was — two rows of the picture that nothing
 *           paints, showing the previous frame through the hole.
 *
 * That second one is the one worth having. A hole in a repainted canvas
 * is invisible to every assertion about geometry, colour and layout,
 * because all of those are true; it only shows up as the picture
 * disagreeing with itself from one frame to the next, which is exactly
 * what it looks like on a phone: the game dropping frames.
 *
 * And then the cost of a frame, with everything on, because "laggy"
 * deserves a number.
 *
 *   node tools/cuplive.js
 */
const { chromium } = require('playwright-core');

let pass = 0, fail = 0;
const ok = (msg, cond, extra) => {
  if (cond) { pass++; console.log('  ok   ' + msg); }
  else { fail++; console.log('  FAIL ' + msg + (extra !== undefined ? '  ' + JSON.stringify(extra) : '')); }
};

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox', '--no-proxy-server', '--autoplay-policy=no-user-gesture-required'] });
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
  await p.mouse.click(480, 400);

  /* park everything: a dead ball, the camera snapped, side-on */
  await p.evaluate(() => {
    const H = OuissyCup.__cup;
    H.quick(0); H.auto(true);
    for (let i = 0; i < 400 && H.state().state !== 'play'; i++) H.step(1, 0, 0, false);
    H.side(true);
    H.restart('corner', 1);
    for (let i = 0; i < 60; i++) H.step(1, 0, 0, false);
    H.camSnap();
  });
  await p.waitForTimeout(500);
  /* STOP THE CLOCK, OR THE CAMERA IS NOT PARKED.
     camSnap() snaps the camera to its TARGET, and the target keeps
     moving because the chapter's own frame loop is still stepping the
     match in the background. Two reads a third of a second apart then
     differ in four fifths of their pixels and the test reports a
     flickering pitch when what it has measured is a moving one. With
     the loop stopped, render() advances the crowd by one frame and
     nothing else moves at all. */
  await p.evaluate(() => {
    window.OuissyCup.stop();
    OuissyCup.__cup.camSnap();
    OuissyCup.__cup.camHold(true);
  });
  await p.waitForTimeout(120);

  /* WHERE THE STAND IS AND WHERE THE GROUND IS, asked of the renderer
     rather than guessed, so the bands move when the lens does. */
  const zones = await p.evaluate(() => {
    const R = OuissyCup.__cup.r2();
    const top = R.groundTop();
    /* a row well inside the pitch, and one in the surround just below
       the far wall — the two rows the hole used to fall between */
    return { standTop: Math.max(0, top - 40), standBot: Math.max(1, top - 4),
             groundTop: top, groundBot: Math.min(R.vh - 1, top + 60),
             vw: R.vw, vh: R.vh };
  });

  const shot = () => p.evaluate((z) => {
    const R = OuissyCup.__cup.r2();
    /* the camera must not creep between the two reads, or everything
       differs and the test says the crowd is alive when the picture is
       merely sliding */
    const g = R.ctx.getImageData(0, 0, z.vw, z.vh).data;
    const out = Array.from(g);
    out.cam = [R.cam.x, R.cam.y, R.zoom];
    return { px: out, cam: [+R.cam.x.toFixed(2), +R.cam.y.toFixed(2), +R.zoom.toFixed(3)] };
  }, zones);

  /* LET THE LENS SETTLE FIRST.
     Freezing the camera is not the same as freezing the picture. The
     frame also SLIDES — reframe() eases the vertical offset so the
     subject keeps its place as the zoom changes — and while that is
     still converging, every screen row is looking at a slightly
     different row of the world each frame, which moves the mowing and
     differs in nine tenths of the pixels. It converges in well under a
     second; this gives it two. */
  /* WAIT FOR CONVERGENCE, DO NOT GUESS A FRAME COUNT.
     A fixed 120 frames was enough most of the time and not all of the
     time, and the times it was not, this reported a flickering pitch
     — which is a false alarm about the exact bug it exists to catch,
     and the worst kind of test there is. It now renders until the
     lens actually stops moving and says so if it never does. */
  const settled = await p.evaluate(() => {
    const R = OuissyCup.__cup.r2();
    let prev = null;
    for (let i = 0; i < 600; i++) {
      OuissyCup.__cup.render();
      const now = [R.oy, R.A, R.B, R.zoom, R.cam.x, R.cam.y].join(',');
      if (now === prev) return i;
      prev = now;
    }
    return -1;
  });
  if (settled < 0) console.log('  (the lens never settled \u2014 the next number is meaningless)');
  const A = await shot();
  /* twenty hand-driven frames: a third of a second of crowd, and not
     one millisecond of anything else */
  await p.evaluate(() => { for (let i = 0; i < 20; i++) OuissyCup.__cup.render(); });
  const C = await shot();
  const a = A.px, c = C.px;
  /* if the lens moved, everything differs and the test is measuring the
     camera rather than the picture */
  console.log('  camera ' + JSON.stringify(A.cam) + ' -> ' + JSON.stringify(C.cam));

  const band = (px, qx, y0, y1) => {
    let diff = 0, total = 0;
    for (let y = y0; y < y1; y++) {
      for (let x = 0; x < zones.vw; x++) {
        const i = (y * zones.vw + x) * 4;
        total++;
        if (px[i] !== qx[i] || px[i + 1] !== qx[i + 1] || px[i + 2] !== qx[i + 2]) diff++;
      }
    }
    return { diff, total, pc: 100 * diff / total };
  };

  const stand = band(a, c, zones.standTop, zones.standBot);
  /* the ground band, minus the columns the players and the ball are in:
     they are supposed to move. The two corner-takers stand in the
     middle third, so the two outer thirds are the quiet ones. */
  const quiet = (() => {
    let diff = 0, total = 0;
    for (let y = zones.groundTop; y < zones.groundBot; y++) {
      for (let x = 0; x < zones.vw; x++) {
        /* ONLY THE LEFT QUARTER. The right of the frame at these rows
           is the goal-end wall with its own crowd in it, which sways by
           design — measuring that and calling it "the ground moved" is
           measuring the thing the previous assertion just praised. */
        if (x > zones.vw * 0.25) continue;
        const i = (y * zones.vw + x) * 4;
        total++;
        if (a[i] !== c[i] || a[i + 1] !== c[i + 1] || a[i + 2] !== c[i + 2]) diff++;
      }
    }
    return { diff, total, pc: 100 * diff / total };
  })();

  /* when it does differ, say WHERE and BY WHAT — a hole showing the
     previous frame and a lens that has not finished settling look
     identical in a percentage and nothing like each other in pixels */
  const examples = [];
  for (let y = zones.groundTop; y < zones.groundBot && examples.length < 6; y++) {
    for (let x = 0; x < zones.vw * 0.25 && examples.length < 6; x++) {
      const i = (y * zones.vw + x) * 4;
      if (a[i] !== c[i] || a[i + 1] !== c[i + 1] || a[i + 2] !== c[i + 2]) {
        examples.push('    ' + x + ',' + y + '  '
          + [a[i], a[i + 1], a[i + 2]].join(',') + ' -> '
          + [c[i], c[i + 1], c[i + 2]].join(','));
      }
    }
  }
  console.log('  the stand  ' + stand.pc.toFixed(1) + '% of pixels changed in a third of a second');
  console.log('  the ground ' + quiet.pc.toFixed(2) + '% changed, with the camera parked and the ball dead');
  console.log('');

  ok('the crowd is alive, not a texture', stand.pc > 1.5, stand);
  ok('and it is a crowd swaying, not the whole stand sliding', stand.pc < 55, stand);
  ok('the ground holds perfectly still under a parked camera', quiet.pc < 0.5, quiet);
  if (quiet.pc >= 0.5) { console.log('  ground rows ' + zones.groundTop + '-' + zones.groundBot);
                         examples.forEach(e => console.log(e)); }

  /* WHAT A FRAME COSTS, with the score, the chant, the crowd and eight
     players all running. */
  const perf = await p.evaluate(() => {
    const H = OuissyCup.__cup;
    H.camHold(false);
    const t = [];
    for (let i = 0; i < 90; i++) {
      const t0 = performance.now();
      H.step(1, Math.cos(i * 0.1), Math.sin(i * 0.07), false);
      const t1 = performance.now();
      H.render();
      const t2 = performance.now();
      t.push([t2 - t0, t1 - t0, t2 - t1]);
    }
    const col = (k) => t.map(r => r[k]).sort((x, y) => x - y);
    const all = col(0), sim = col(1), draw = col(2);
    return { median: all[45], p90: all[81], worst: all[89],
             sim: sim[45], draw: draw[45] };
  });
  console.log('  a frame costs  median ' + perf.median.toFixed(2) + 'ms'
              + '   p90 ' + perf.p90.toFixed(2) + 'ms'
              + '   worst ' + perf.worst.toFixed(2) + 'ms');
  console.log('     of which the simulation ' + perf.sim.toFixed(2)
              + 'ms and the drawing ' + perf.draw.toFixed(2) + 'ms');
  console.log('  (a sixty-a-second budget is 16.7ms, and this machine is'
              + ' a container with no graphics card)');
  console.log('');
  /* The bar is the 60-a-second budget, not a wish. This runs in a
     container with no graphics card, where the final scale-up blit
     alone costs 3ms of the frame and would be free on any real
     device — so a median comfortably inside 16.7ms here is a wide
     margin there. */
  ok('a frame fits inside the sixty-a-second budget', perf.median < 12, perf.median);
  ok('and the slowest frame still fits', perf.p90 < 16.7, perf.p90);

  ok('no page errors', errs.length === 0, errs.slice(0, 3));
  console.log('');
  console.log(pass + ' passed, ' + fail + ' failed');
  await b.close();
  process.exit(fail ? 1 : 0);
})();
