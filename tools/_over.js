const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox','--no-proxy-server','--use-gl=swiftshader','--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true });
  p.on('pageerror', (e) => console.log('PAGEERROR', e.message.slice(0,120)));
  await p.route('**/*', (r) => r.request().url().startsWith('http://127.0.0.1') ? r.continue() : r.abort());
  await p.goto('http://127.0.0.1:8899/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.evaluate(() => { localStorage.setItem('ns_seenintro','1'); localStorage.setItem('ns_terms','1');
    localStorage.setItem('ns_notutor','1');
    localStorage.setItem('ns_nights', JSON.stringify({1:1,2:1,3:1,4:1,5:1,6:1}));
    showScreen('nightshift'); return loadChapter('nightshift').then(() => OuissysNightShift.start()); });
  await p.waitForFunction(() => window.OuissysNightShift && OuissysNightShift.__night, { timeout: 25000, polling: 200 });
  console.log(await p.evaluate(() => { const N = OuissysNightShift.__night;
    const a = N.begin(3); const b = N.catchNow('jax');
    return JSON.stringify({ begin: a, after: b, dead: N.state().dead }); }));
  for (let i = 0; i < 6; i++) { await p.waitForTimeout(600);
    const s = await p.evaluate(() => { const G = OuissysNightShift.__night.state();
      const o = document.getElementById('ns-overlay');
      return G.phase + ' deadT=' + (+G.deadT).toFixed(2) + ' cardT=' + G.cardT + ' ov=' + o.innerHTML.length; });
    console.log(s); }
  console.log('TERMS:', await p.evaluate(() => { OuissysNightShift.__night.route('terms');
    return document.getElementById('ns-overlay').innerHTML.slice(0, 600); }));
  await b.close();
})();
