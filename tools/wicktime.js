/* What a frame of the night shift costs. Reports the build, the draw
   calls and the triangle count for the heaviest room, and a per-frame
   CPU figure for the office and for a camera.
   node wicktime.js */
const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox','--no-proxy-server','--use-gl=swiftshader','--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  p.on('pageerror', e => console.log('PAGEERROR', e.message));
  await p.route('**/*', r => r.request().url().startsWith('http://127.0.0.1') ? r.continue() : r.abort());
  await p.goto('http://127.0.0.1:8899/tools/wickshot.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForTimeout(400);
  const build = await p.evaluate(() => {
    const t0 = performance.now();
    WickAndCogs.preview(document.getElementById('stage'), document.getElementById('cvs'), 'office', 'main');
    return performance.now() - t0;
  });
  console.log('build + first render : ' + build.toFixed(0) + ' ms');
  for (const room of ['office', 'hall', 'stage', 'party', 'arcade', 'foyer', 'workshop', 'closet', 'ducts']) {
    const m = await p.evaluate((r) => {
      const stage = document.getElementById('stage'), cvs = document.getElementById('cvs');
      WickAndCogs.preview(stage, cvs, r, 'main');
      const t0 = performance.now();
      for (let i = 0; i < 20; i++) WickAndCogs.preview(stage, cvs, r, 'main');
      const ms = (performance.now() - t0) / 20;
      const info = WickAndCogs.__three ? WickAndCogs.__three().renderer.info.render : null;
      return { ms, calls: info ? info.calls : -1, tris: info ? info.triangles : -1 };
    }, room);
    console.log(room.padEnd(9) + ' : ' + m.ms.toFixed(1) + ' ms/frame   ' +
                m.calls + ' draw calls   ' + m.tris + ' triangles');
  }
  await b.close();
})();
