const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox', '--no-proxy-server'] });
  const p = await b.newPage({ viewport: { width: 960, height: 540 } });
  await p.addInitScript(() => {
    window.__errs = [];
    window.addEventListener('error', e => {
      window.__errs.push((e.message || '') + ' @ ' + (e.filename||'').split('/').pop() + ':' + e.lineno
        + '\n' + ((e.error && e.error.stack) || '').split('\n').slice(0,5).join('\n'));
    });
    window.addEventListener('unhandledrejection', e => {
      window.__errs.push('REJECT: ' + ((e.reason && e.reason.stack) || e.reason));
    });
  });
  await p.route('**/*', r => r.request().url().startsWith('http://127.0.0.1') ? r.continue() : r.abort());
  await p.goto('http://127.0.0.1:8899/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForTimeout(900);
  await p.evaluate(() => { try { localStorage.clear(); } catch (e) {} showScreen('hub'); startHub(); });
  await p.waitForTimeout(300);
  await p.click('#hub-card-cup');
  await p.waitForTimeout(5000);
  await p.screenshot({ path: '/tmp/boot.png' });
  console.log((await p.evaluate(() => window.__errs.slice(0, 3))).join('\n===\n') || 'none captured');
  console.log(JSON.stringify(await p.evaluate(() => ({
    screen: document.querySelector('.screen.active') && document.querySelector('.screen.active').id,
    ui: (window.OuissyCup && OuissyCup.__cup.ui) ? OuissyCup.__cup.ui().name : null,
    rigs: (window.OuissyCup && OuissyCup.__cup.geometry) ? OuissyCup.__cup.geometry().rigs : null,
  }))));
  await b.close();
})();
