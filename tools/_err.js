const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox', '--no-proxy-server'] });
  const p = await b.newPage({ viewport: { width: 960, height: 540 } });
  const errs = [];
  p.on('pageerror', e => errs.push(e.message + '\n' + (e.stack || '').split('\n').slice(0,4).join('\n')));
  p.on('console', m => errs.push(m.type() + ': ' + m.text()));
  await p.route('**/*', r => r.request().url().startsWith('http://127.0.0.1') ? r.continue() : r.abort());
  await p.goto('http://127.0.0.1:8899/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForTimeout(900);
  await p.evaluate(() => { try { localStorage.clear(); } catch (e) {} showScreen('hub'); startHub(); });
  await p.waitForTimeout(300);
  await p.click('#hub-card-cup');
  await p.waitForTimeout(9000);
  const st = await p.evaluate(() => ({
    hasCup: !!window.OuissyCup,
    hasHook: !!(window.OuissyCup && OuissyCup.__cup),
    state: (window.OuissyCup && OuissyCup.__cup && OuissyCup.__cup.state) ? 'fn' : 'none',
    val: (() => { try { return JSON.stringify(OuissyCup.__cup.state()); } catch (e) { return 'THREW: ' + e.message; } })(),
  })).catch(e => ({ evalFailed: e.message }));
  console.log(JSON.stringify(st, null, 1));
  console.log(errs.length ? errs.slice(0,3).join('\n---\n') : 'no errors');
  await b.close();
})();
