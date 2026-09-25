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
  console.log(await p.evaluate(() => {
    const H = OuissyCup.__cup, R = H.r2();
    H.quick(0); H.auto(true);
    for (let i = 0; i < 400 && H.state().state !== 'play'; i++) H.step(1, 0, 0, false);
    H.side(true); H.camSnap();
    const names = ['drawStand', 'drawGrass', 'drawSides', 'drawMarkings', 'drawGoal', 'cornerFlags', 'flush', 'present'];
    const tot = {}, calls = {}; names.forEach(n => { tot[n] = 0; calls[n] = 0; });
    let cur = null;
    const proto = CanvasRenderingContext2D.prototype;
    const realFR = proto.fillRect;
    proto.fillRect = function () { if (cur) calls[cur]++; return realFR.apply(this, arguments); };
    names.forEach(n => {
      const real = Object.getPrototypeOf(R)[n];
      if (!real) { tot[n] = -1; return; }
      Object.getPrototypeOf(R)[n] = function () {
        const was = cur; cur = n;
        const t0 = performance.now();
        const r = real.apply(this, arguments);
        tot[n] += performance.now() - t0;
        cur = was;
        return r;
      };
    });
    const N = 60;
    const t0 = performance.now();
    for (let i = 0; i < N; i++) { H.step(1, 0, 0, false); H.render(); }
    const whole = performance.now() - t0;
    const out = ['whole frame ' + (whole / N).toFixed(2) + 'ms'];
    names.forEach(n => out.push('   ' + n.padEnd(14) + (tot[n] / N).toFixed(2) + 'ms   '
      + Math.round(calls[n] / N) + ' fillRects'));
    return out.join('\n');
  }));
  await b.close(); process.exit(0);
})();
