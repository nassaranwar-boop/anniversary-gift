const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox','--no-proxy-server','--use-gl=swiftshader','--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 1100, height: 700 } });
  p.on('pageerror', e => console.log('PAGEERROR', e.message));
  await p.route('**/*', r => { const u = r.request().url();
    if (u.indexOf('book-scene.js') >= 0) return r.abort();
    return u.startsWith('http://127.0.0.1') ? r.continue() : r.abort(); });
  await p.goto('http://127.0.0.1:8899/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForTimeout(700);
  await p.evaluate(() => { try{localStorage.clear();}catch(e){} showScreen('nightshift');
    return loadChapter('nightshift').then(() => OuissysNightShift.start()); });
  await p.waitForFunction(() => Object.keys(OuissysNightShift.__night.cast()).length >= 4, { timeout: 20000, polling: 200 });
  await p.evaluate(() => OuissysNightShift.__night.silence(true));
  const dir = '/tmp/claude-0/shots'; require('fs').mkdirSync(dir, { recursive: true });
  const who = process.argv[2] || 'cogsworth';
  for (const at of [0.05, 0.3, 1.45, 1.70]) {
    await p.evaluate(({ who, at }) => {
      const w = OuissysNightShift.__night, s = w.state();
      if (s.phase !== 'play') { w.begin(2);
        for (let i = 0; i < 60; i++) { if (s.phase === 'reveal') { w.route('keep'); continue; }
          if (s.phase !== 'play') break; w.pumpFrame(0.05); } }
      if (s.phase === 'play') w.catchNow(who);
      /* hold the card off so the scare itself can be looked at */
      s.deadT = at; s.cardT = 1;
      w.pumpFrame(0.001); s.deadT = at;
    }, { who, at });
    await p.waitForTimeout(400);
    await p.screenshot({ path: dir + '/scare-' + who + '-' + String(at).replace('.', '') + '.png' });
  }
  console.log('done');
  await b.close();
})();
