/* WHAT THE CARD AND THE PROCESSOR ARE BEING ASKED TO DO, PER LEVEL.

   SwiftShader cannot tell you a frame rate that means anything, so this
   does not pretend to. It reports the two numbers that decide whether a
   real phone holds sixty -- draw calls and triangles -- and the one this
   container CAN measure honestly, which is how long the game's own
   simulation takes on the processor, with the drawing left out of it.

   Thresholds are the budget at sixty frames a second: 16.7ms for
   everything. A tick that costs more than about 3ms leaves too little of
   it for the picture on a phone. */
const { boot, reporter, driver } = require('./_aplib');

const LIMITS = { calls: 420, tris: 480000, tick: 3.2 };

(async () => {
  const { browser, page, errs } = await boot({ viewport: { width: 480, height: 270 } });
  const R = reporter(), ok = R.ok, D = driver(page);
  await page.evaluate(() => { window.__apLoop(false); window.__apQuality(2); });

  const names = ['home', 'streets', 'hospital', 'escape', 'gates', 'roadside', 'campsite'];
  console.log('level         calls    tris   geoms  texs  lights   tick ms');
  const rows = [];
  for (let i = 0; i < names.length; i++) {
    if (names[i] === 'roadside') await page.evaluate(() => { window.__apClear(); window.__apRoadside(); });
    else if (names[i] === 'campsite') await page.evaluate(() => { window.__apClear(); window.__apCampsite(); });
    else await page.evaluate(n => window.__apEnter(n), i);
    await page.evaluate(() => window.__apPump(1 / 60, 40));
    const r = await page.evaluate(() => {
      const st = window.__apRenderStats();
      /* the simulation on its own, with no drawing in it: a hundred
         ticks, and the middle one of them, so a stray long frame does
         not become the answer */
      const t = [];
      for (let k = 0; k < 100; k++) {
        const a = performance.now();
        window.__apPump(1 / 60, 1);
        t.push(performance.now() - a);
      }
      t.sort((a, b) => a - b);
      st.tick = +t[t.length >> 1].toFixed(3);
      return st;
    });
    rows.push([names[i], r]);
    console.log(names[i].padEnd(12) + String(r.calls).padStart(6) +
                String(r.triangles).padStart(9) + String(r.geometries).padStart(7) +
                String(r.textures).padStart(6) + String(r.lights).padStart(7) +
                String(r.tick).padStart(10));
  }
  console.log('');
  for (const [n, r] of rows) {
    ok(n + ': few enough draw calls for a phone', r.calls <= LIMITS.calls, r.calls + '');
    ok(n + ': few enough triangles', r.triangles <= LIMITS.tris, r.triangles + '');
    ok(n + ': and the simulation leaves room for the picture',
       r.tick <= LIMITS.tick, r.tick + 'ms of 16.7');
  }
  /* AND IT MUST COME DOWN WHEN THE MACHINE CANNOT KEEP UP.
     The ladder is the only thing standing between an old phone and a
     slideshow, so prove it still moves. */
  const ladder = await page.evaluate(() => {
    const before = window.__apScale();
    window.__apSet('quality', 'smooth');
    const smooth = window.__apScale();
    window.__apSet('quality', 'crisp');
    const crisp = window.__apScale();
    window.__apSet('quality', 'auto');
    return { before, smooth, crisp };
  });
  ok('asking for smooth drops the render scale',
     ladder.smooth.scale < ladder.crisp.scale,
     'smooth ' + ladder.smooth.scale + ' vs crisp ' + ladder.crisp.scale);
  ok('and it never renders above the screen it is on',
     ladder.crisp.dpr <= 2, 'dpr ' + ladder.crisp.dpr);

  await R.done(browser, errs);
})();
