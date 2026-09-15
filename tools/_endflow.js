const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox','--no-proxy-server','--use-gl=swiftshader','--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 520, height: 340 } });
  p.on('pageerror', (e) => console.log('PAGEERROR', e.message));
  await p.route('**/*', (r) => { const u = r.request().url();
    if (u.indexOf('book-scene.js') >= 0) return r.abort();
    return u.startsWith('http://127.0.0.1') ? r.continue() : r.abort(); });
  await p.goto('http://127.0.0.1:8899/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.evaluate(() => { localStorage.setItem('ns_seenintro','1'); localStorage.setItem('ns_terms','1');
    localStorage.setItem('ns_notutor','1'); showScreen('nightshift');
    return loadChapter('nightshift').then(() => OuissysNightShift.start()); });
  await p.waitForFunction(() => window.OuissysNightShift && OuissysNightShift.__night, { timeout: 20000, polling: 200 });
  console.log(JSON.stringify(await p.evaluate(() => {
    const w = OuissysNightShift.__night, s = w.state();
    w.begin(6); w.midEnd();
    const c = w.cast();
    Object.keys(c).forEach(k => { c[k].asleep = true; c[k].awake = false; });
    s.hour = 5; s.power = 60; w.pump(70);
    const a = { phase: s.phase, film: w.finaleState().on, i: w.finaleState().i };
    const seek = w.filmSeek(999);
    const st = w.finaleState();
    return Object.assign(a, { seek: seek, after: s.phase, on: st.on, i2: st.i, of: st.of,
      card: (document.querySelector('.ns-ov-fin') || {}).className || 'none',
      ask: (document.querySelector('.ns-ask') || {}).textContent || '',
      btns: Array.from(document.querySelectorAll('[data-go]')).map(x => x.dataset.go).slice(0, 8) });
  }), null, 1));
  await b.close();
})();
