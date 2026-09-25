/* IS THE PENALTY BOX SKEWED, OR JUST IN PERSPECTIVE?
 *
 * A rectangle painted on the ground does NOT have right angles on
 * screen — that is what a perspective camera is for, and from a
 * touchline the near box is a trapezoid with one horizontal edge and
 * two diagonals. So "it looks skewed" has two possible causes and they
 * want opposite answers: either the lines are drawn somewhere the
 * geometry does not put them, which is a bug, or they are exactly
 * where they belong and the shape is correct.
 *
 * This asks the projection where each corner of the box lands, then
 * samples the rendered pitch at that pixel. If the corners are on white
 * paint, the box is drawn where it is supposed to be.
 *
 *   node tools/cupbox.js
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
  await p.route('**/*', r => r.request().url().startsWith('http://127.0.0.1') ? r.continue() : r.abort());
  await p.goto('http://127.0.0.1:8899/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForTimeout(900);
  await p.evaluate(() => { try { localStorage.clear(); } catch (e) {} showScreen('hub'); startHub(); });
  await p.waitForTimeout(250);
  await p.click('#hub-card-cup');
  await p.waitForFunction(() => window.OuissyCup && OuissyCup.__cup.state() !== null, { timeout: 60000 });
  await p.waitForTimeout(600);

  const out = await p.evaluate(() => {
    const H = OuissyCup.__cup;
    H.quick(0); H.auto(true);
    for (let i = 0; i < 400 && H.state().state !== 'play'; i++) H.step(1, 0, 0, false);
    /* park the camera on one penalty area and hold it there */
    const g = H.geometry().pitch;
    /* the renderer's frame counts back from the far goal line, so its
       gl = 0 is the pitch's y1 end — park the ball at that one */
    H.put(g.cx, g.y1 - 40, 0);
    for (let i = 0; i < 60; i++) H.step(1, 0, 0, false);
    H.camSnap(); H.render();

    const R = H.r2();
    const w = R.raw;
    const gl = 0;                      // the near goal line, renderer frame
    /* the box: two edges of constant pitch-x running out from the goal
       line, and a front edge of constant pitch-y joining them */
    const corners = [
      ['box near-left  on the line', -w.boxHalf, gl],
      ['box near-right on the line',  w.boxHalf, gl],
      ['box far-left  at the edge', -w.boxHalf, gl + w.boxDepth],
      ['box far-right at the edge',  w.boxHalf, gl + w.boxDepth],
      ['six-yard left at the edge', -w.sixHalf, gl + w.sixDepth],
      ['six-yard right at the edge', w.sixHalf, gl + w.sixDepth],
    ];
    const cvs = document.getElementById('cup-canvas');
    const cx2 = cvs.getContext('2d');
    /* the buffer is blitted into the canvas at a whole-number scale and
       centred, so a virtual pixel has to be mapped through that */
    const sc = Math.max(1, Math.floor(Math.min(cvs.width / R.vw, cvs.height / R.vh)));
    const ox = ((cvs.width - R.vw * sc) / 2) | 0, oy = ((cvs.height - R.vh * sc) / 2) | 0;

    const white = (px) => px[0] > 150 && px[1] > 170 && px[2] > 150;
    return corners.map(([name, wx, wy]) => {
      const pr = R.project(wx, wy);
      const sx = Math.round(ox + pr.x * sc), sy = Math.round(oy + pr.y * sc);
      let hit = false, best = null;
      /* a 2px window, because the paint is two world units wide and
         lands on whichever pixel rounding chooses */
      for (let dy = -2; dy <= 2 && !hit; dy++) {
        for (let dx = -2; dx <= 2 && !hit; dx++) {
          const q = cx2.getImageData(sx + dx, sy + dy, 1, 1).data;
          if (white(q)) { hit = true; best = [dx, dy]; }
        }
      }
      return { name, at: [Math.round(pr.x), Math.round(pr.y)],
               onScreen: pr.x > 2 && pr.x < R.vw - 2 && pr.y > 2 && pr.y < R.vh - 2,
               painted: hit, off: best };
    });
  });

  out.forEach(c => {
    console.log('   ' + c.name.padEnd(28) + ' at ' + JSON.stringify(c.at)
                + (c.onScreen ? (c.painted ? '   painted' : '   NOT PAINTED') : '   (off frame)'));
  });
  console.log('');
  const seen = out.filter(c => c.onScreen);
  ok('every box corner that is on screen has paint on it',
     seen.length > 0 && seen.every(c => c.painted), seen.filter(c => !c.painted));
  console.log('');
  console.log(pass + ' passed, ' + fail + ' failed');
  await p.screenshot({ path: '/tmp/box.png' });
  await b.close();
  process.exit(fail ? 1 : 0);
})();
