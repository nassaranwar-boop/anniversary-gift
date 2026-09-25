/* DOES THE ZOOM ZOOM BOTH WAYS?
 *
 * This cannot be answered with a screenshot, and trying to is how the
 * bug survived. Asking the renderer for zoom 2 and then rendering puts
 * it straight back to 1, because the camera sets the zoom every frame
 * from whatever shot it is currently on — so two screenshots taken that
 * way are two different MOMENTS at the same zoom, and any difference
 * between them is the match having moved on.
 *
 * The lens will answer directly, though. Measure the same two pairs of
 * world points at each zoom level: one pair separated across the pitch,
 * one separated in depth. An honest zoom magnifies both by the level,
 * so the fraction of the frame each pair spans must scale with it.
 *
 * It did not. Across came to 90 virtual pixels at every level while
 * depth came to 11.2, 5.6, 3.7 — and once blitted up those are the same
 * number of screen pixels, so the ground plane never zoomed. The
 * characters did, because a sprite's size comes off the depth ratio
 * rather than off the projection, which is why a cut-in doubled the
 * players and left the goal alone.
 *
 *   node tools/cupzoom.js
 */
const { chromium } = require('playwright-core');

let pass = 0, fail = 0;
const ok = (msg, cond, extra) => {
  if (cond) { pass++; console.log('  ok   ' + msg); }
  else { fail++; console.log('  FAIL ' + msg + (extra !== undefined ? '  ' + extra : '')); }
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

  const rows = await p.evaluate(() => {
    const H = OuissyCup.__cup;
    H.quick(0);
    for (let i = 0; i < 400 && H.state().state !== 'play'; i++) H.step(1, 0, 0, false);
    const R = H.r2();
    const was = R.zoom;
    const out = [];
    for (const z of [1, 2, 3]) {
      R.zoomTo(z);
      /* the renderer swaps its axes when the pitch is side-on, so ask
         for the depth argument rather than assuming which one it is */
      const AC = (t) => R.swap ? R.project(0, t) : R.project(t, 0);
      const DP = (t) => R.swap ? R.project(t, 0) : R.project(0, t);
      out.push({
        zoom: z, vw: R.vw, vh: R.vh,
        across: Math.abs(AC(20).x - AC(-20).x),
        depth: Math.abs(DP(80).y - DP(40).y),
      });
    }
    R.zoomTo(was);
    return out;
  });

  rows.forEach(r => console.log('   zoom ' + r.zoom + '  frame ' + r.vw + 'x' + r.vh
    + '   40 units across = ' + r.across.toFixed(2) + 'px'
    + '   40 units deep = ' + r.depth.toFixed(2) + 'px'
    + '   of frame: ' + (r.across / r.vw).toFixed(4) + ' / ' + (r.depth / r.vh).toFixed(4)));
  console.log('');

  const base = rows[0];
  rows.forEach(r => {
    /* what the eye actually receives: the fraction of the frame a fixed
       world distance covers, which the blit then scales by the level */
    const ax = (r.across / r.vw) / (base.across / base.vw);
    const dp = (r.depth / r.vh) / (base.depth / base.vh);
    ok('zoom ' + r.zoom + ' magnifies across by ' + r.zoom,
       Math.abs(ax - r.zoom) < 0.03, ax.toFixed(3));
    ok('zoom ' + r.zoom + ' magnifies in depth by ' + r.zoom,
       Math.abs(dp - r.zoom) < 0.03, dp.toFixed(3));
  });

  /* AND THE TWO AXES MUST AGREE WITH EACH OTHER, which is the part that
     shows up as a squashed picture rather than as a weak zoom. */
  rows.forEach(r => {
    const ratio = (r.across / r.vw) / (r.depth / r.vh);
    const baseRatio = (base.across / base.vw) / (base.depth / base.vh);
    ok('zoom ' + r.zoom + ' keeps the picture the same shape',
       Math.abs(ratio / baseRatio - 1) < 0.03, (ratio / baseRatio).toFixed(3));
  });

  ok('no page errors', errs.length === 0, JSON.stringify(errs.slice(0, 3)));
  console.log('');
  console.log(pass + ' passed, ' + fail + ' failed');
  await b.close();
  process.exit(fail ? 1 : 0);
})();
