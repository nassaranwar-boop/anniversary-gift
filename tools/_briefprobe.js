const { chromium } = require('playwright-core');
const PORT = process.argv[2] || '8899';
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox','--no-proxy-server','--use-gl=swiftshader','--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 600, height: 400 } });
  p.on('pageerror', (e) => console.log('PAGEERROR', e.message));
  await p.route('**/*', (r) => { const u = r.request().url();
    if (u.indexOf('book-scene.js') >= 0) return r.abort();
    return u.startsWith('http://127.0.0.1') ? r.continue() : r.abort(); });
  await p.goto('http://127.0.0.1:' + PORT + '/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.evaluate(() => { localStorage.setItem('ns_seenintro','1'); localStorage.setItem('ns_terms','1');
    showScreen('nightshift'); return loadChapter('nightshift').then(() => OuissysNightShift.start()); });
  await p.waitForFunction(() => window.OuissysNightShift && OuissysNightShift.__night, { timeout: 20000, polling: 200 });
  await p.evaluate(() => { const w = OuissysNightShift.__night; w.route('title'); w.route('start'); });
  await p.waitForTimeout(500);
  const out = await p.evaluate(() => {
    const G = OuissysNightShift.__night.state();
    const ov = document.getElementById('ns-overlay');
    return { phase: G.phase, night: G.night,
             overlayHidden: ov ? ov.hidden : 'none',
             cls: ov ? (ov.firstElementChild ? ov.firstElementChild.className : 'empty') : '-',
             txt: ov ? ov.textContent.slice(0, 140) : '' };
  });
  console.log(JSON.stringify(out, null, 1));
  await b.close();
})();
