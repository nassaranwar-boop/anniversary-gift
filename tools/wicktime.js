const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox','--no-proxy-server','--use-gl=swiftshader','--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  p.on('pageerror', e => console.log('PAGEERROR', e.message));
  await p.route('**/*', r => r.request().url().startsWith('http://127.0.0.1') ? r.continue() : r.abort());
  await p.goto('http://127.0.0.1:8899/tools/wickshot.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForTimeout(400);
  const t = await p.evaluate(() => {
    const marks = {};
    const t0 = performance.now();
    WickAndCogs.preview(document.getElementById('stage'), document.getElementById('cvs'), 'office', 'main');
    marks.total = performance.now() - t0;
    const r = WickAndCogs.__three ? null : null;
    return marks;
  });
  console.log('build+first render ms:', t.total.toFixed(0));
  const t2 = await p.evaluate(() => {
    const t0 = performance.now();
    for (let i = 0; i < 20; i++) WickAndCogs.preview(document.getElementById('stage'), document.getElementById('cvs'), 'hall', 'main');
    return (performance.now() - t0) / 20;
  });
  console.log('per render ms (hall):', t2.toFixed(1));
  await b.close();
})();
