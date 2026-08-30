const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args:['--no-sandbox','--no-proxy-server','--disable-gpu'] });
  const p = await b.newPage({ viewport:{width:1180,height:900} });
  p.on('pageerror', e => console.log('PAGEERROR:', e.message));
  p.on('console', m => { if (m.type()==='error') console.log('CONSOLE:', m.text()); });
  p.on('requestfailed', r => console.log('FAILED:', r.url().slice(0,80), r.failure() && r.failure().errorText));
  await p.route('**/*', r => { const u=r.request().url();
    if (u.startsWith('http://127.0.0.1')||u.includes('fonts.g')) return r.continue(); return r.abort(); });
  await p.goto('http://127.0.0.1:8899/index.html', { waitUntil:'domcontentloaded', timeout:60000 });
  await p.waitForTimeout(2000);
  console.log(await p.evaluate(() => ({
    showScreen: typeof window.showScreen,
    startSuperOuissy: typeof window.startSuperOuissy,
    Rescue: typeof window.Rescue,
    SuperOuissy: typeof window.SuperOuissy,
  })));
  await b.close();
})();
