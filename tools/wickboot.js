const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox','--no-proxy-server','--use-gl=swiftshader','--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 1280, height: 860 } });
  p.on('pageerror', e => console.log('PAGEERROR', e.message));
  await p.route('**/*', r => r.request().url().startsWith('http://127.0.0.1') ? r.continue() : r.abort());
  await p.goto('http://127.0.0.1:8899/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForTimeout(600);
  console.log('starting');
  const t = await p.evaluate(() => {
    showScreen('wick');
    const t0 = performance.now();
    WickAndCogs.start();
    return performance.now() - t0;
  });
  console.log('start() ms:', t.toFixed(0));
  await p.waitForTimeout(2500);
  const st = await p.evaluate(() => ({ phase: WickAndCogs.__wick.state().phase, ov: !!document.querySelector('.wk-ov-title') }));
  console.log('state', JSON.stringify(st));
  console.log('clicking BEGIN');
  await p.click('.wk-btn-go', { timeout: 15000 }).catch(e => console.log('CLICKFAIL', e.message.split('\n')[0]));
  await p.waitForTimeout(800);
  console.log('after begin', JSON.stringify(await p.evaluate(() => ({ phase: WickAndCogs.__wick.state().phase }))));
  await b.close();
})();
