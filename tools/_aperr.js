const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox','--no-proxy-server','--use-gl=swiftshader','--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true });
  p.on('pageerror', (e) => console.log('PAGEERROR', e.message, '\n', (e.stack||'').split('\n').slice(0,6).join('\n')));
  await p.route('**/*', (r) => r.request().url().startsWith('http://127.0.0.1') ? r.continue() : r.abort());
  await p.goto('http://127.0.0.1:8899/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForTimeout(800);
  await p.evaluate(() => { showScreen('hub'); if (window.startHub) startHub(); });
  await p.waitForTimeout(500);
  await p.evaluate(() => document.getElementById('hub-card-apoc').click());
  await p.waitForSelector('#screen-apoc.active #ap-canvas', { timeout: 40000 });
  for (let i = 0; i < 6; i++) { await p.waitForTimeout(1200);
    console.log(i, await p.evaluate(() => { const s = window.__apState && __apState(); return s ? s.state + ' player=' + !!s.player : 'no state'; })); }
  await b.close();
})();
