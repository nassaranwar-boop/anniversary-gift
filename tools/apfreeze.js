/* WHERE THE APOCALYPSE FREEZES, AND ON WHAT.

   apocperf says the steady state is fine: 0.1ms of simulation and both
   draw calls and triangles inside a phone's budget on every level. A
   freeze is not the steady state. It is one long piece of work in the
   middle of something, and the two places it was reported -- walking, and
   arriving somewhere new -- are exactly the two moments a WebGL game does
   what it has been putting off: compiling a shader the first time a
   material is drawn, and uploading a texture the first time it is
   sampled.

   requestAnimationFrame runs at about 3fps in this container, so waiting
   for frames and sampling long tasks would measure the container. Frames
   are driven by hand instead: render, and time the render. The first one
   after arriving carries whatever was deferred; the rest are the real
   cost. Three.js counts its compiled programs, so a spike with the count
   going up is a shader compile and a spike with it flat is something
   else.

     node tools/apfreeze.js
*/
const { boot, reporter, driver } = require('./_aplib');

/* One frame at sixty is 16.7ms. A first frame that costs more than about
   ten of them is a stall you see; walking should never cost more than a
   couple. */
const FIRST = 170, WALK = 40;

(async () => {
  const { browser, page, errs } = await boot({ viewport: { width: 480, height: 270 } });
  const R = reporter(), ok = R.ok, D = driver(page);
  await page.evaluate(() => { window.__apLoop(false); window.__apQuality(2); });

  const render = () => page.evaluate(() => {
    const t = performance.now();
    const s = window.__apRenderStats();
    return { ms: performance.now() - t, programs: s ? s.programs : -1 };
  });

  const names = ['home', 'streets', 'hospital', 'escape', 'gates', 'roadside', 'campsite'];
  const rows = [];
  for (let i = 0; i < names.length; i++) {
    await D.enter(i);
    await page.waitForTimeout(500);

    const first = await render();
    const rest = [];
    for (let k = 0; k < 8; k++) rest.push((await render()).ms);
    rest.sort((a, b) => a - b);
    const steady = rest[Math.floor(rest.length / 2)];

    /* then walk it: teleport along the level and render at each step, so
       whatever comes into view for the first time has to be paid for */
    const here = await page.evaluate(() => window.__apPos());
    let worstWalk = 0, walkPrograms = first.programs;
    if (here) {
      for (let k = 1; k <= 10; k++) {
        await page.evaluate(([x, y]) => { window.__apTeleport(x, y); window.__apPump(1 / 60, 3); },
                            [here.x + (k % 5) * 2 - 4, here.y + k * 2]);
        const r = await render();
        if (r.ms > worstWalk) worstWalk = r.ms;
        walkPrograms = r.programs;
      }
    }
    rows.push({ n: names[i], first: first.ms, steady, worstWalk,
                p0: first.programs, p1: walkPrograms });
  }

  console.log('');
  console.log('level        first frame   steady   worst while walking   programs');
  for (const r of rows)
    console.log('  ' + r.n.padEnd(11) + String(Math.round(r.first)).padStart(8) + 'ms' +
                String(r.steady.toFixed(1)).padStart(9) + 'ms' +
                String(Math.round(r.worstWalk)).padStart(16) + 'ms' +
                String(r.p0 + ' -> ' + r.p1).padStart(14));
  console.log('');

  for (const r of rows) {
    ok(r.n + ': arriving does not lock up', r.first <= FIRST,
       Math.round(r.first) + 'ms for the first frame, steady ' + r.steady.toFixed(1) +
       'ms  (programs ' + r.p0 + ')');
    ok(r.n + ': walking does not stutter', r.worstWalk <= WALK,
       'worst ' + Math.round(r.worstWalk) + 'ms against a steady ' + r.steady.toFixed(1) +
       'ms  (programs ' + r.p0 + ' -> ' + r.p1 + ')');
  }
  await R.done(browser, errs);
})();
