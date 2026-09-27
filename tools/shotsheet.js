/* LOOK AT THE FILM: ONE FRAME OUT OF EACH SHOT, AS A CONTACT SHEET.

   FRAC says where in the shot to take it, 0 to 1 (default 0.17, about
   six tenths of a second in). Half the shots in this film are a move
   -- the last one walks the length of the workshop to a piece of paper
   on a bench -- and a sheet taken at the top of every shot only ever
   shows where each of them BEGINS. Render it twice, at 0.17 and at
   0.85, and the pair is the film's ins and outs.

       node tools/shotsheet.js <outdir> [shot,shot,...]
       FRAC=0.85 node tools/shotsheet.js /tmp/out                    */
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
  const frac = Math.max(0, Math.min(1, Number(process.env.FRAC || 0.17)));
  /* how long each shot runs, so the frame can be taken at the same
     point through a two-second cut and a six-second walk */
  const secs = await p.evaluate(() =>
    OuissysNightShift.__night.words().lastHour.shots.map((s) => s.secs || 3));
  const markOf = (i) => Math.max(3, Math.round((secs[i] || 3) * frac / 0.05));
  /* SEEK, THEN CRANK.

     Getting to shot fifty used to be five thousand round trips to the
     page, one per frame, whether or not anything was being looked at.
     filmSeek runs the film's own clock inside the page and stops at
     the top of a shot; only the frames up to the one being
     photographed are stepped by hand, and only the last few of those
     are painted. */
  const targets = want.length ? want.slice().sort((x, y) => x - y)
                              : secs.map((_, i) => i);
  for (const t of targets) {
    const at = await p.evaluate((x) => OuissysNightShift.__night.filmSeek(x), t);
    if (at === false) break;
    const m = markOf(t);
    for (let f = 1; f <= m; f++) {
      await p.evaluate((d) => OuissysNightShift.__night.filmFrame(0.05, d), f > m - 3);
    }
    await p.screenshot({ path: OUT + '/shot-' + String(t).padStart(2, '0') + '.png' });
  }
  await b.close();
})();
