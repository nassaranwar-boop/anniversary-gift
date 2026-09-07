/* Does the resolution ladder actually move? Runs the real loop under a
   software rasteriser, which cannot hold 60fps, so it should climb down —
   and reports where it ended up. */
const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox','--no-proxy-server','--use-gl=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.route('**', r => (r.request().url().startsWith('http://localhost') ? r.continue() : r.abort()));
  await p.goto('http://localhost:8899/index.html', { waitUntil: 'domcontentloaded' });
  await p.evaluate(() => { try { localStorage.clear(); } catch (e) {} showScreen('hub'); startHub(); });
  await p.waitForTimeout(200);
  await p.evaluate(() => document.getElementById('hub-card-apoc').click());
  await p.waitForSelector('.ap-card-go', { timeout: 40000 });
  for (let i = 0; i < 3; i++) {
    await p.evaluate(() => { const b = document.querySelector('.ap-card-go'); if (b) b.click(); });
    await p.waitForTimeout(400);
  }
  console.log('start ', JSON.stringify(await p.evaluate(() => window.__apScale())));
  for (let s = 0; s < 6; s++) {
    await p.waitForTimeout(5000);
    console.log(((s + 1) * 5) + 's   ', JSON.stringify(await p.evaluate(() => window.__apScale())));
  }
  console.log('errors:', errs.length ? errs.slice(0, 3) : 'none');
  await b.close();
})();
