const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args:['--no-sandbox','--no-proxy-server','--use-gl=swiftshader','--enable-unsafe-swiftshader'] });
  const p = await b.newPage();
  await p.route('**/*', r => { const u=r.request().url();
    if (u.indexOf('book-scene.js')>=0) return r.abort();
    return u.startsWith('http://127.0.0.1') ? r.continue() : r.abort(); });
  await p.goto('http://127.0.0.1:8899/index.html',{waitUntil:'domcontentloaded',timeout:60000});
  await p.evaluate(() => { localStorage.setItem('ns_seenintro','1');
    showScreen('nightshift');
    return loadChapter('nightshift').then(() => OuissysNightShift.start()); });
  await p.waitForFunction(() => window.OuissysNightShift && OuissysNightShift.__night,{timeout:20000,polling:200});
  console.log(await p.evaluate(() => {
    const N = OuissysNightShift.__night;
    localStorage.setItem('ns_nights', JSON.stringify({1:1,2:1,3:1,4:1,5:1,6:1,7:1}));
    N.press('howto'); N.press('title');
    const ov = document.getElementById('ns-overlay');
    return JSON.stringify({
      phase: N.state().phase,
      hasTitle: !!ov.querySelector('.ns-card-title'),
      gos: [].slice.call(ov.querySelectorAll('[data-go]')).map(e=>e.getAttribute('data-go')),
    });
  }));
  await b.close();
})();
