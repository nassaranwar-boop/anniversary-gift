/* does zoom scale both axes by the same amount? */
const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox', '--no-proxy-server'] });
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
    H.quick(0);
    for (let i = 0; i < 400 && H.state().state !== 'play'; i++) H.step(1, 0, 0, false);
    const R = H.r2();
    const rows = [];
    for (const z of [1, 2, 3]) {
      R.zoomTo(z);
      /* two points 40 world units apart ACROSS, and two 40 apart in DEPTH,
         both measured at the same depth, so the two scales are comparable */
      /* the renderer swaps its axes when the pitch is side-on, so the
         depth argument is whichever one project() treats as depth */
      const AC = (t) => R.swap ? R.project(0, t) : R.project(t, 0);
      const DP = (t) => R.swap ? R.project(t, 0) : R.project(0, t);
      const a = AC(-20), b2 = AC(20);
      const c = DP(40), d = DP(80);
      rows.push({
        zoom: z, vw: R.vw, vh: R.vh,
        acrossPx: +(b2.x - a.x).toFixed(2),
        depthPx: +(d.y - c.y).toFixed(2),
        /* per virtual pixel of frame, so a zoom that is honest keeps
           these two constant */
        acrossPerFrame: +((b2.x - a.x) / R.vw).toFixed(4),
        depthPerFrame: +((d.y - c.y) / R.vh).toFixed(4),
        A: +R.A.toFixed(2), B: +R.B.toFixed(0), oy: +R.oy.toFixed(1),
      });
    }
    R.zoomTo(1);
    return rows;
  });
  out.forEach(r => console.log(JSON.stringify(r)));
  await b.close();
})();
