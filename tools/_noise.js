/* the far touchline, big enough to see what the strip under the boards is */
const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox','--no-proxy-server'] });
  const p = await b.newPage({ viewport: { width: 960, height: 540 } });
  await p.route('**/*', r => r.request().url().startsWith('http://127.0.0.1') ? r.continue() : r.abort());
  await p.goto('http://127.0.0.1:8899/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForTimeout(900);
  await p.evaluate(() => { try { localStorage.clear(); } catch (e) {} showScreen('hub'); startHub(); });
  await p.waitForTimeout(250);
  await p.click('#hub-card-cup');
  await p.waitForFunction(() => window.OuissyCup && OuissyCup.__cup.state() !== null, { timeout: 60000 });
  await p.waitForTimeout(600);
  await p.evaluate(() => {
    const H = OuissyCup.__cup;
    H.quick(0); H.auto(true);
    for (let i = 0; i < 400 && H.state().state !== 'play'; i++) H.step(1, 0, 0, false);
    H.side(true);
    H.restart('corner', 1);
    for (let i = 0; i < 50; i++) H.step(1, 0, 0, false);
    H.camSnap();
  });
  await p.waitForTimeout(700);
  await p.screenshot({ path: '/tmp/noise.png' });
  /* and the raw internal rows, so the strip can be named rather than squinted at */
  console.log(await p.evaluate(() => {
    const R = OuissyCup.__cup.r2(), ctx = R.ctx, cv = ctx.canvas;
    /* find the far touchline on screen */
    const q = R.project(R.swap ? R.raw.halfW : 0, R.swap ? R.raw.len / 2 : R.raw.len);
    const y0 = Math.max(0, Math.round(q.y) - 10);
    const out = ['far touchline at y=' + Math.round(q.y) + '  (canvas ' + cv.width + 'x' + cv.height + ')'];
    for (let y = y0; y < Math.min(cv.height, y0 + 20); y++) {
      const d = ctx.getImageData(120, y, 90, 1).data;
      let s = '';
      for (let i = 0; i < 90; i++) {
        const r = d[i*4], g = d[i*4+1], bl = d[i*4+2];
        s += (g > r + 14 && g > bl + 14) ? '#' : (r + g + bl < 90 ? '.' : (bl > r + 20 ? 'B' : (r > g + 20 ? 'R' : 'o')));
      }
      out.push(String(y).padStart(3) + ' ' + s);
    }
    return out.join('\n');
  }));
  await b.close(); process.exit(0);
})();
