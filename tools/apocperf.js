/* What the card is being asked to do, per level. SwiftShader cannot tell
   you a frame rate that means anything, but draw calls and triangles are
   the numbers that decide whether a real GPU holds 60. */
const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--use-gl=swiftshader','--enable-unsafe-swiftshader','--no-sandbox'] });
  const p = await b.newPage({ viewport: { width: 480, height: 270 } });
  p.on('pageerror', e => console.log('PAGEERR', e.message));
  await p.route('**', r => (r.request().url().startsWith('http://localhost') ? r.continue() : r.abort()));
  await p.goto('http://localhost:8899/index.html', { waitUntil: 'domcontentloaded' });
  await p.evaluate(() => { document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
    document.getElementById('screen-apoc').classList.add('active'); window.Apocalypse.start(); });
  await p.waitForFunction(() => !!window.__apEnter, { timeout: 40000 });
  await p.evaluate(() => { window.__apLoop(false); window.__apQuality(2); });

  const names = ['home','streets','hospital','escape','gates'];
  console.log('level        calls   tris     lines  points  geoms  texs  lights');
  for (let i = 0; i < names.length; i++) {
    await p.evaluate(n => window.__apEnter(n), i);
    await p.evaluate(() => { for (let k=0;k<40;k++) window.__apPump(1/60); });
    const r = await p.evaluate(() => {
      const R = window.Apocalypse.game && window.THREE ? null : null;
      const st = window.__apRenderStats();
      return st;
    });
    console.log(
      names[i].padEnd(12) +
      String(r.calls).padStart(5) +
      String(r.triangles).padStart(9) +
      String(r.lines).padStart(7) +
      String(r.points).padStart(8) +
      String(r.geometries).padStart(7) +
      String(r.textures).padStart(6) +
      String(r.lights).padStart(8));
  }
  await b.close();
})().catch(e => { console.error('FATAL', e); process.exit(1); });
