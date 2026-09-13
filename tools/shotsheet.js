/* look at the film: one frame out of each shot, as a contact sheet */
const { chromium } = require('playwright-core');
const OUT = process.argv[2] || '/tmp/shots';
require('fs').mkdirSync(OUT, { recursive: true });
(async () => {
  const b = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox', '--no-proxy-server', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 900, height: 560 } });
  p.on('pageerror', (e) => console.log('PAGEERROR', e.message));
  await p.route('**/*', (r) => {
    const u = r.request().url();
    if (u.indexOf('book-scene.js') >= 0) return r.abort();
    return u.startsWith('http://127.0.0.1') ? r.continue() : r.abort();
  });
  await p.goto('http://127.0.0.1:8899/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.evaluate(() => { localStorage.setItem('ns_seenintro', '1'); showScreen('nightshift');
    return loadChapter('nightshift').then(() => OuissysNightShift.start()); });
  await p.waitForFunction(() => window.OuissysNightShift && OuissysNightShift.__night, { timeout: 20000, polling: 200 });
  await p.evaluate(() => OuissysNightShift.__night.finale());
  const want = (process.argv[3] || '').split(',').filter(Boolean).map(Number);
  let shot = -1, n = 0, drew = {};
  for (let k = 0; k < 4200; k++) {
    /* only paint the frames that are about to be photographed: drawing
       is the slow half and the other three thousand are not looked at */
    const draw = n >= 9 && n <= 13;
    const i = await p.evaluate((d) => OuissysNightShift.__night.filmFrame(0.05, d), draw);
    if (i === false) break;
    if (i !== shot) { shot = i; n = 0; }
    n++;
    if (n === 12 && !drew[i] && (!want.length || want.indexOf(i) >= 0)) {
      drew[i] = 1;
      await p.screenshot({ path: OUT + '/shot-' + String(i).padStart(2, '0') + '.png' });
    }
  }
  await b.close();
})();
