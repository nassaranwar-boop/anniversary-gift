/* where is everybody, shot by shot, and is their model actually drawn */
const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox', '--no-proxy-server', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 640, height: 400 } });
  p.on('pageerror', (e) => console.log('PAGEERROR', e.message));
  await p.route('**/*', (r) => {
    const u = r.request().url();
    if (u.indexOf('book-scene.js') >= 0) return r.abort();
    return u.startsWith('http://127.0.0.1') ? r.continue() : r.abort(); });
  await p.goto('http://127.0.0.1:8899/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.evaluate(() => { localStorage.setItem('ns_seenintro', '1'); showScreen('nightshift');
    return loadChapter('nightshift').then(() => OuissysNightShift.start()); });
  await p.waitForFunction(() => window.OuissysNightShift && OuissysNightShift.__night, { timeout: 20000, polling: 200 });
  await p.evaluate(() => OuissysNightShift.__night.finale());
  let shot = -1, n = 0, seen = {};
  for (let k = 0; k < 4200; k++) {
    const i = await p.evaluate(() => OuissysNightShift.__night.filmFrame(0.05, false));
    if (i === false) break;
    if (i !== shot) { shot = i; n = 0; }
    n++;
    if (n === 12 && !seen[i]) {
      seen[i] = 1;
      const row = await p.evaluate(() => {
        const N = OuissysNightShift.__night, C = N.cast(), out = {};
        for (const id in C) {
          const c = C[id];
          out[id] = [c.awake ? 1 : 0, c.group.visible ? 1 : 0,
                     +c.group.position.x.toFixed(2), +c.group.position.y.toFixed(2),
                     +c.group.position.z.toFixed(2), c.anchor, c.room];
        }
        return out;
      });
      const want = (process.argv[2] || 'chime').split(',');
      const s = want.map((w) => w + ' ' + JSON.stringify(row[w])).join('  ');
      console.log(String(i).padStart(2) + '  ' + s);
    }
  }
  await b.close();
})();
