/* Enter the same level over and over. Anything that climbs is not being
   given back by teardown. */
const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox','--use-gl=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 640, height: 400 } });
  p.on('pageerror', e => console.log('PAGEERR', e.message));
  await p.route('**', r => (r.request().url().startsWith('http://localhost') ? r.continue() : r.abort()));
  await p.goto('http://localhost:8899/index.html', { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(400);
  await p.evaluate(() => { document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById('screen-apoc').classList.add('active'); window.Apocalypse.start(); });
  await p.waitForFunction(() => !!window.__apEnter, { timeout: 40000 });
  await p.evaluate(() => { window.__apLoop(false); });
  for (const [lv, name] of [[1, 'streets'], [0, 'home']]) {
    console.log('--- ' + name + ' entered six times ---');
    for (let i = 0; i < 6; i++) {
      const g = await p.evaluate(l => {
        window.__apEnter(l);
        for (let k = 0; k < 4; k++) window.__apPump(1/60);
        window.__apPaint();
        return window.__apGpu();
      }, lv);
      console.log('  ' + (i + 1) + '  ' + JSON.stringify(g));
    }
  }
  await b.close();
})();
