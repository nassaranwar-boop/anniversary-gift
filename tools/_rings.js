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
    H.restart('corner', 1);
    for (let i = 0; i < 50; i++) H.step(1, 0, 0, false);
    H.side(true); H.camSnap();
  });
  await p.waitForTimeout(900);
  console.log(JSON.stringify(await p.evaluate(() => {
    const R = OuissyCup.__cup.r2();
    const w = R.raw, k = R.k, RUN = 3.3 / k, APR = 3.7 / k;
    const camAlong = R.swap ? R.cam.y : R.cam.x, camDeep = R.swap ? R.cam.x : R.cam.y;
    const alongMin = R.swap ? 0 : -w.halfW, alongMax = R.swap ? w.len : w.halfW;
    const depthMin = R.swap ? -w.halfW : 0, depthMax = R.swap ? w.halfW : w.len;
    const out = { cam: [R.cam.x, R.cam.y], vw: R.vw, vh: R.vh, rows: [] };
    [120, 170, 200, 240, 265].forEach(y => {
      const d = R.depthAtY(y + 0.5);
      if (d <= 0) return;
      const wy = camDeep + (d - 5) / k;   // NEAR guess, refined below
      const scale = k * 220 / d;
      out.rows.push({ y, d: +d.toFixed(2) });
    });
    // authoritative: use project()
    const px = (a) => R.swap ? R.project(0, a).x : R.project(a, 0).x;
    out.alongEdges = { pMin: +px(alongMin).toFixed(1), pMax: +px(alongMax).toFixed(1),
                       rMax: +px(alongMax + RUN).toFixed(1), aMax: +px(alongMax + RUN + APR).toFixed(1) };
    out.consts = { RUN: +RUN.toFixed(1), APR: +APR.toFixed(1), alongMax, depthMin, depthMax, camAlong, camDeep };
    out.src = R.drawGrass.toString().indexOf('beyond') >= 0 ? 'NEW' : 'OLD';
    out.mode = R.mode;
    return out;
  }), null, 1));
  await p.screenshot({ path: '/tmp/rings.png' });
  console.log('GG ' + JSON.stringify(await p.evaluate(() => window.__gg.r200)));
  console.log(await p.evaluate(() => {
    const R = OuissyCup.__cup.r2();
    const cv = R.ctx.canvas;
    const out = ['internal ' + cv.width + 'x' + cv.height];
    [150, 200, 240].forEach(y => {
      const d = R.ctx.getImageData(0, y, cv.width, 1).data;
      let runs = [], last = null, start = 0;
      for (let x = 0; x < cv.width; x++) {
        const c = d[x*4] + ',' + d[x*4+1] + ',' + d[x*4+2];
        if (c !== last) { if (last !== null) runs.push(start + '-' + x + ' ' + last); last = c; start = x; }
      }
      runs.push(start + '-' + cv.width + ' ' + last);
      out.push('row ' + y + ': ' + runs.filter(r => { const [a,b] = r.split(' ')[0].split('-'); return b-a >= 3; }).join(' | '));
    });
    return out.join('\n');
  }));
  await b.close(); process.exit(0);
})();
