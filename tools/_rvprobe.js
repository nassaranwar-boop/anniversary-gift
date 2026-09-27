const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox','--no-proxy-server','--use-gl=swiftshader','--enable-unsafe-swiftshader'] });
  const p = await b.newPage();
  await p.route('**/*', (r) => { const u=r.request().url();
    if (u.indexOf('book-scene.js')>=0) return r.abort();
    return u.startsWith('http://127.0.0.1') ? r.continue() : r.abort(); });
  await p.goto('http://127.0.0.1:8899/index.html', { waitUntil:'domcontentloaded', timeout:60000 });
  await p.evaluate(() => { localStorage.setItem('ns_seenintro','1'); showScreen('nightshift');
    return loadChapter('nightshift').then(() => OuissysNightShift.start()); });
  await p.waitForFunction(() => window.OuissysNightShift && OuissysNightShift.__night, {timeout:20000, polling:200});
  const out = await p.evaluate(() => new Promise((done) => {
    const asked = [], fired = [];
    const raw = window.setTimeout;
    window.setTimeout = function (fn, d) {
      if (d >= 500 && d <= 3000) {
        const at = performance.now(); asked.push([Math.round(at), d]);
        return raw.call(window, function () { fired.push([Math.round(performance.now()), d, Math.round(performance.now()-at)]); return fn.apply(this, arguments); }, d);
      }
      return raw.apply(window, arguments);
    };
    OuissysNightShift.__night.begin(4, 1);
    raw.call(window, () => {
      OuissysNightShift.__night.reveal(4);
      raw.call(window, () => { window.setTimeout = raw; done({ asked, fired }); }, 12000);
    }, 600);
  }));
  console.log('asked delays:', JSON.stringify(out.asked.map(a => a[1])));
  console.log('actual waits:', JSON.stringify(out.fired.map(f => f[2])));
  await b.close();
})();
