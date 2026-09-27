/* DOES THE MERGED SITE ACTUALLY WORK?

   Six chapters on one board now: the night shift came back off the
   branch it was parked on and the cup is still here. This loads the
   real page, counts the cards, opens the night shift, plays a little
   of night one, and then opens the cup -- because the whole risk of
   this merge is that adding one chapter quietly broke another. */
const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox','--no-proxy-server','--use-gl=swiftshader','--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 1100, height: 700 } });
  const errs = [];
  p.on('pageerror', e => errs.push(String(e.message).slice(0, 160)));
  p.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 160)); });
  await p.route('**/*', r => r.request().url().startsWith('http://127.0.0.1')
    ? r.continue() : r.abort());
  await p.goto('http://127.0.0.1:8901/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForTimeout(2500);

  const cards = await p.evaluate(() =>
    [...document.querySelectorAll('.hub-card')].map(c => c.id));
  console.log('hub cards (' + cards.length + '): ' + cards.join(', '));

  const ns = await p.evaluate(() => {
    if (typeof showScreen !== 'function') return { err: 'no showScreen' };
    showScreen('nightshift');
    return loadChapter('nightshift')
      .then(() => { OuissysNightShift.start(); return { ok: !!window.OuissysNightShift }; })
      .catch(e => ({ err: String(e).slice(0, 140) }));
  });
  console.log('night shift starts: ' + JSON.stringify(ns));
  await p.waitForFunction(() => window.OuissysNightShift &&
    Object.keys(OuissysNightShift.__night.cast()).length >= 4,
    { timeout: 25000, polling: 250 }).catch(() => console.log('  (cast never built)'));
  const played = await p.evaluate(() => {
    const w = OuissysNightShift.__night;
    w.silence(true); w.begin(1);
    const s = w.state();
    for (let i = 0; i < 300; i++) { if (s.phase !== 'play') break; w.pumpFrame(0.05); }
    return { phase: s.phase, cast: Object.keys(w.cast()).length, tutor: w.tutor().step };
  });
  console.log('night one runs: ' + JSON.stringify(played));

  const cup = await p.evaluate(() => {
    showScreen('cup');
    return loadChapter('cup')
      .then(() => ({ ok: !!window.OuissyCup }))
      .catch(e => ({ err: String(e).slice(0, 140) }));
  });
  console.log('cup still loads: ' + JSON.stringify(cup));

  console.log('\npage errors: ' + (errs.length ? '\n  ' + [...new Set(errs)].join('\n  ') : 'none'));
  await b.close();
  process.exitCode = errs.length ? 1 : 0;
})();
