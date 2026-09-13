/* WHERE THE RACE FRAME GOES.

   "It feels laggy" is a report about the frame, and the frame here is two
   things: the simulation step and the draw. requestAnimationFrame runs at
   about 3fps in this container so a frame RATE measured here is
   meaningless -- but the WORK is real, and the work is what got heavier.
   Both are called directly, a few hundred times, and timed. */
const { chromium } = require("playwright-core");
(async () => {
  const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
    args: ["--no-sandbox", "--use-gl=swiftshader", "--enable-unsafe-swiftshader"] });
  const ctx = await b.newContext({ viewport: { width: 956, height: 440 }, deviceScaleFactor: 2,
    isMobile: true, hasTouch: true });
  await ctx.route("**/*", (r) => r.request().url().startsWith("http://127.0.0.1") ? r.continue() : r.abort());
  const p = await ctx.newPage();
  await p.goto("http://127.0.0.1:8899/index.html", { waitUntil: "domcontentloaded", timeout: 90000 });
  await p.waitForTimeout(1500);
  await p.evaluate(() => { showScreen("hub"); if (window.startHub) startHub(); });
  await p.waitForTimeout(600);
  await p.evaluate(() => { const e = document.getElementById("hub-card-race"); if (e) e.click(); });
  await p.waitForTimeout(9000);
  const click = async (s) => { await p.evaluate((q) => { const t = [...document.querySelectorAll("button")]
    .find((x) => x.matches(q)); if (t) t.click(); }, s); await p.waitForTimeout(600); };

  const which = +(process.argv[2] || 0);
  await click('[data-go="single"]'); await click('[data-char="0"]'); await click('[data-next="chars"]');
  await click('[data-track="' + which + '"]'); await click('[data-next="tracks"]');
  await p.waitForFunction(() => { try { const d = window.__RACE_DEBUG(); return d && d.racers && d.racers.length; }
    catch (e) { return false; } }, { timeout: 60000, polling: 250 }).catch(() => {});
  await p.waitForTimeout(1200);

  const r = await p.evaluate(() => {
    const d = window.__RACE_DEBUG();
    for (let i = 0; i < 600 && window.__RACE_DEBUG().state !== "race"; i++) d.step(1 / 60);
    /* let the field spread out so the numbers are a real race, not a grid */
    for (let i = 0; i < 60 * 8; i++) d.step(1 / 60);
    const dd = window.__RACE_DEBUG();
    const counts = {
      racers: dd.racers.length, props: (dd.props || []).length,
      obstacles: (dd.obstacles || []).length, coins: (dd.coins || []).length,
      ramps: (dd.ramps || []).length,
    };
    const time = (fn, n) => {
      fn(); // warm
      const t0 = performance.now();
      for (let i = 0; i < n; i++) fn();
      return (performance.now() - t0) / n;
    };
    const stepMs = time(() => d.step(1 / 60), 400);
    const drawMs = d.draw ? time(() => d.draw(), 120) : -1;
    /* how many of the props could possibly be on screen */
    const me0 = dd.racers.find((x) => x.isPlayer);
    let near = 0;
    for (const pr of (dd.props || [])) {
      const dx = pr.x - me0.x, dy = pr.y - me0.y;
      if (dx * dx + dy * dy <= 2600 * 2600) near++;
    }
    /* SPLIT THE DRAW. Empty the prop list and time it again: the
       difference is what the billboards cost, and the remainder is the
       Mode 7 floor, the sky and the karts. Then put them back. */
    const saved = dd.props.slice();
    dd.props.length = 0;
    const noPropsMs = d.draw ? time(() => d.draw(), 120) : -1;
    for (const x of saved) dd.props.push(x);
    const backMs = d.draw ? time(() => d.draw(), 60) : -1;

    /* and of the props that survive the distance cull, how many actually
       land on the glass */
    const cam = me0;
    let onScreen = 0, behind = 0, offSide = 0;
    const W = document.querySelector(".rc-canvas") ? document.querySelector(".rc-canvas").width : 960;
    for (const pr of saved) {
      const dx = pr.x - cam.x, dy = pr.y - cam.y;
      const ca = Math.cos(cam.angle), sa = Math.sin(cam.angle);
      const z = dx * ca + dy * sa;
      if (z < 78) { behind++; continue; }
      const xx = -dx * sa + dy * ca;
      const sx = W / 2 + (xx / z) * 300;
      if (sx < -W * 0.2 || sx > W * 1.2) offSide++; else onScreen++;
    }
    /* THE STALL, NOT THE STEADY COST. Scenery sprites are baked per lit
       side, and which side is lit comes from the CAMERA's heading -- so
       the first time she turns far enough for the sun to cross, every
       kind in view has to be drawn from scratch, mid-corner. Time a draw
       straight after forcing that flip against a warm one. */
    const meN = dd.racers.find((x) => x.isPlayer);
    const a0 = meN.angle;
    d.draw(); d.draw();
    const warm = time(() => d.draw(), 40);
    meN.angle = a0 + Math.PI;            // turn round: the sun changes side
    const t0 = performance.now();
    d.draw();
    const flipMs = performance.now() - t0;
    const t1 = performance.now();
    d.draw();
    const afterFlipMs = performance.now() - t1;
    meN.angle = a0;
    return { counts, near, onScreen, behind, offSide,
             warmMs: +warm.toFixed(3), flipMs: +flipMs.toFixed(1),
             afterFlipMs: +afterFlipMs.toFixed(3),
             stepMs: +stepMs.toFixed(3), drawMs: +drawMs.toFixed(3),
             noPropsMs: +noPropsMs.toFixed(3), backMs: +backMs.toFixed(3),
             track: dd.trackDef.name };
  });
  console.log(JSON.stringify(r));
  await ctx.close(); await b.close();
})();
