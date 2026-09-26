/* WHERE THE SIX PAGES ARE, so the same question can be asked of the
   chapter before the findSpot refactor and the chapter after it. */
const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox','--no-proxy-server','--use-gl=swiftshader','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required'] });
  const p = await b.newPage({ viewport: { width: 900, height: 600 } });
  p.on('pageerror', e => console.log('PAGEERROR', e.message));
  await p.route('**/*', r => r.request().url().startsWith('http://127.0.0.1') ? r.continue() : r.abort());
  await p.goto('http://127.0.0.1:8899/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.evaluate(() => { try { localStorage.clear(); localStorage.setItem('ns_notutor','1'); } catch(e){}
    showScreen('nightshift'); return loadChapter('nightshift').then(() => OuissysNightShift.start()); });
  await p.waitForFunction(() => { try { return !!OuissysNightShift.__night.cast().jax; } catch(e){ return false; } },
                          null, { timeout: 180000, polling: 500 });
  const out = await p.evaluate(() => {
    const N = OuissysNightShift.__night;
    const fs = N.finds();
    const rows = [];
    for (let n = 1; n <= 6; n++) {
      N.begin(n); N.midEnd();
      const s = N.finds();
      rows.push({ night: n, armed: s.armed, room: s.room, at: s.at });
    }
    return { placed: fs.placed, rows };
  });
  console.log('  placed: ' + JSON.stringify(out.placed));
  out.rows.forEach(r => console.log('  night ' + r.night + '  ' + String(r.armed).padEnd(10) +
    String(r.room).padEnd(10) + JSON.stringify(r.at)));
  await b.close();
})();
