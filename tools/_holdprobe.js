const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox','--no-proxy-server','--use-gl=swiftshader','--enable-unsafe-swiftshader'] });
  const p = await b.newPage();
  p.on('pageerror', e => console.log('PAGEERR', e.message));
  await p.route('**/*', (r) => { const u=r.request().url();
    if (u.indexOf('book-scene.js')>=0) return r.abort();
    return u.startsWith('http://127.0.0.1') ? r.continue() : r.abort(); });
  await p.goto('http://127.0.0.1:8899/index.html', { waitUntil:'domcontentloaded', timeout:60000 });
  await p.evaluate(() => { localStorage.setItem('ns_seenintro','1'); showScreen('nightshift');
    return loadChapter('nightshift').then(() => OuissysNightShift.start()); });
  await p.waitForFunction(() => window.OuissysNightShift && OuissysNightShift.__night, {timeout:20000, polling:200});
  console.log(await p.evaluate(() => Object.keys(OuissysNightShift.__night).join(' ')));
  console.log('STATE', JSON.stringify(await p.evaluate(() => OuissysNightShift.__night.state())).slice(0,600));
  console.log('HOLD', JSON.stringify(await p.evaluate(() => OuissysNightShift.__night.holdShut('cogsworth','jax','left'))));
  await b.close();
})();
