/* what the SIMULATION costs standing still vs walking, with drawing left out */
const { boot } = require('./_aplib');
(async () => {
  const { browser, page } = await boot({ viewport: { width: 480, height: 270 } });
  await page.evaluate(() => { window.__apLoop(false); });
  for (const lvl of [1, 2, 3]) {
    await page.evaluate(i => window.__apEnter(i), lvl);
    await page.waitForTimeout(250);
    const r = await page.evaluate(() => {
      const K = (on) => { const e = t => new KeyboardEvent(t, { key:'ArrowUp', code:'ArrowUp', bubbles:true });
                          window.dispatchEvent(e(on ? 'keydown' : 'keyup')); };
      const run = (n) => { const t = performance.now();
                           for (let i = 0; i < n; i++) window.__apPump(1/60, 1);
                           return (performance.now() - t) / n; };
      K(false); run(60);                       // settle
      const idle = run(240);
      K(true);  run(60);
      const walk = run(240);
      K(false);
      const z = window.__apZombies ? window.__apZombies() : [];
      return { idle: +idle.toFixed(3), walk: +walk.toFixed(3),
               zombies: z.length, awake: z.filter(q => q.state && q.state !== 'idle').length };
    });
    console.log(`level ${lvl}: tick idle ${r.idle}ms  walking ${r.walk}ms  (x${(r.walk/r.idle).toFixed(1)})  zombies ${r.zombies} awake ${r.awake}`);
  }
  await browser.close();
})();
