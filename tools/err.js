const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox','--use-gl=swiftshader','--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 600, height: 400 } });
  p.on('pageerror', e => console.log('PAGEERR ' + e.message + '\n' + (e.stack||'').split('\n').slice(0,5).join('\n')));
  p.on('console', m => { if (m.type()==='error') console.log('CONSOLE ' + m.text()); });
  await p.route('**', r => (r.request().url().startsWith('http://localhost') ? r.continue() : r.abort()));
  await p.goto('http://localhost:8899/index.html', { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(1500);
  console.log('Apocalypse defined:', await p.evaluate(() => typeof window.Apocalypse));
  await b.close();
})();
