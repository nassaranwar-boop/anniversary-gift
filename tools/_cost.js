/* WHAT A FRAME OF A NIGHT COSTS, split into the part a phone can do
   nothing about (drawing) and the part this repository controls (the
   simulation, the score, the UI). */
const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox','--no-proxy-server','--use-gl=swiftshader','--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 900, height: 560 } });
  p.on('pageerror', (e) => console.log('PAGEERROR', e.message));
  await p.route('**/*', (r) => { const u = r.request().url();
    if (u.indexOf('book-scene.js') >= 0) return r.abort();
    return u.startsWith('http://127.0.0.1') ? r.continue() : r.abort(); });
  await p.goto('http://127.0.0.1:8899/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.evaluate(() => { localStorage.setItem('ns_seenintro','1'); localStorage.setItem('ns_terms','1');
    localStorage.setItem('ns_notutor','1'); showScreen('nightshift');
    return loadChapter('nightshift').then(() => OuissysNightShift.start()); });
  await p.waitForFunction(() => window.OuissysNightShift && OuissysNightShift.__night, { timeout: 20000, polling: 200 });
  for (const n of [1, 4, 6]) {
    const out = await p.evaluate((night) => {
      const N = OuissysNightShift.__night;
      N.begin(night); N.midEnd();
      /* the simulation, on its own, with nothing drawn */
      let t0 = performance.now();
      for (let i = 0; i < 300; i++) N.pumpFrame(0.016);
      const sim = (performance.now() - t0) / 300;
      /* and the same thing with the monitor up, which is the heavy view */
      N.press('monitor');
      t0 = performance.now();
      for (let i = 0; i < 300; i++) N.pumpFrame(0.016);
      const simMon = (performance.now() - t0) / 300;
      N.press('monitor');
      const cost = N.filmCost ? N.filmCost() : null;
      return { night, sim: +sim.toFixed(3), simMon: +simMon.toFixed(3), cost };
    }, n);
    console.log('night ' + out.night + ': simulation ' + out.sim + 'ms a frame, '
                + out.simMon + 'ms with the monitor up   draw ' +
                (out.cost ? out.cost.calls + ' calls / ' + out.cost.tris + ' triangles' : '?'));
  }
  await b.close();
})();
