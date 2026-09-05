/* Play the whole chapter twice and watch what the renderer is holding.
   A number that climbs on the second lap is something that is not being
   given back. */
const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox','--use-gl=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 800, height: 500 } });
  p.on('pageerror', e => console.log('PAGEERR', e.message));
  await p.route('**', r => (r.request().url().startsWith('http://localhost') ? r.continue() : r.abort()));
  await p.goto('http://localhost:8899/index.html', { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(400);
  await p.evaluate(() => { document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById('screen-apoc').classList.add('active'); window.Apocalypse.start(); });
  await p.waitForFunction(() => !!window.__apEnter, { timeout: 40000 });
  await p.evaluate(() => { window.__apLoop(false); });
  const step = async (label, code) => {
    await p.evaluate(c => { (0, eval)(c); }, code);
    await p.evaluate(() => { for (let i = 0; i < 12; i++) { window.__apPump(1/60); window.__apPaint(); } });
    const g = await p.evaluate(() => window.__apGpu());
    const js = await p.evaluate(() => (performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : -1));
    console.log(label.padEnd(22) + JSON.stringify(g) + '  heapMB=' + js);
  };
  for (let lap = 1; lap <= 2; lap++) {
    console.log('--- lap ' + lap + ' ---');
    await step('home',      'window.__apEnter(0)');
    await step('streets',   'window.__apEnter(1)');
    await step('hospital',  'window.__apEnter(2)');
    await step('escape',    'window.__apEnter(3)');
    await step('drive',     'window.__apDrive()');
    await step('  end cut', 'window.__apEndCine()');
    await step('roadside',  'window.__apRoadside()');
    await step('ride',      'window.__apRide()');
    await step('  end cut', 'window.__apEndCine()');
    await step('campsite',  'window.__apCampsite()');
    await step('gates',     'window.__apEnter(4)');
    await step('roof',      'window.__apRoof()');
    await step('  end cut', 'window.__apEndCine()');
  }
  await b.close();
})();
