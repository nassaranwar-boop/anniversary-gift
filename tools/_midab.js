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
  await p.evaluate(() => { localStorage.setItem('ns_seenintro','1'); localStorage.setItem('ns_notutor','1');
    showScreen('nightshift'); return loadChapter('nightshift').then(() => OuissysNightShift.start()); });
  await p.waitForFunction(() => window.OuissysNightShift && OuissysNightShift.__night, { timeout: 20000, polling: 200 });
  for (const [n, skip] of [[2, true], [2, false]]) {
    await p.evaluate(([x, s]) => { const N = OuissysNightShift.__night; N.begin(x); if (s) N.midEnd(); }, [n, skip]);
    /* let the shift run 12 seconds of wall clock */
    const seen = [];
    for (let k = 0; k < 40; k++) {
      await new Promise((r) => setTimeout(r, 120));
      const st = await p.evaluate(() => { const G = OuissysNightShift.__night.state();
        const C = OuissysNightShift.__night.cast();
        return { cap: G.caption, at: Object.keys(C).filter((i) => C[i].atDoor).join(','),
                 awake: Object.keys(C).filter((i) => C[i].awake).join(','), hr: G.hour }; });
      const line = st.hr + ' awake[' + st.awake + '] door[' + st.at + '] ' + st.cap;
      if (seen[seen.length - 1] !== line) seen.push(line);
    }
    console.log('--- night ' + n + (skip ? ' (beat skipped)' : ' (beat played)'));
    seen.slice(0, 8).forEach((l) => console.log('   ' + l));
  }
  await b.close();
})();
