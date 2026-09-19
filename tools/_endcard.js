const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox','--no-proxy-server','--use-gl=swiftshader','--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 900, height: 560 } });
  p.on('pageerror', (e) => console.log('PAGEERROR', e.message.slice(0,140)));
  await p.route('**/*', (r) => r.request().url().startsWith('http://127.0.0.1') ? r.continue() : r.abort());
  await p.goto('http://127.0.0.1:8899/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.evaluate(() => { localStorage.setItem('ns_seenintro','1'); localStorage.setItem('ns_terms','1');
    localStorage.setItem('ns_notutor','1'); showScreen('nightshift');
    return loadChapter('nightshift').then(() => OuissysNightShift.start()); });
  await p.waitForFunction(() => window.OuissysNightShift && OuissysNightShift.__night, { timeout: 25000, polling: 200 });
  const out = await p.evaluate(() => {
    const N = OuissysNightShift.__night, G = N.state();
    N.begin(6); N.midEnd();
    const c = N.cast(); Object.keys(c).forEach((k) => { c[k].asleep = true; c[k].awake = false; });
    G.hour = 5; G.power = 60; N.pump(70);
    N.filmSeek(999);
    N.route('finaleDone');
    const o = document.getElementById('ns-overlay');
    return { night: G.night, cfg: G.cfg ? G.cfg.name : null, rating: G.rating,
             html: o.innerHTML.slice(0, 700) };
  });
  console.log('night', out.night, 'cfg', out.cfg, 'rating', JSON.stringify(out.rating));
  console.log(out.html.replace(/></g, '>\n<'));
  await b.close();
})();
