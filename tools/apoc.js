/* Drive "Ouissy at the Apocalypse" from outside and look at what it paints.
   node apoc.js <out.png> [level] [action]
     action: card | play | panel | note | keypad | walk:<dx>,<dy>,<secs>
   rAF is about 3fps in this container, so the world is advanced with
   __apPump rather than by waiting — the same trap super-ouissy documents. */
const { chromium } = require('playwright-core'); const fs = require('fs');
const [out, level = '0', action = 'play'] = process.argv.slice(2);
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox','--no-proxy-server','--disable-gpu','--font-render-hinting=none'] });
  const page = await browser.newPage({ viewport: { width: 1180, height: 820 }, deviceScaleFactor: 1 });
  const errs = [];
  page.on('pageerror', e => { errs.push(e.message); console.log('PAGEERROR', e.message); });
  page.on('console', m => { if (m.type() === 'error') console.log('CONSOLE', m.text()); });
  await page.route('**/*', r => {
    const u = r.request().url();
    if (u.startsWith('http://127.0.0.1')) return r.continue();
    if (u.includes('fonts.googleapis') || u.includes('fonts.gstatic')) return r.continue();
    return r.abort();
  });
  await page.goto('http://127.0.0.1:8899/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(1200);

  await page.evaluate(([lv, act]) => {
    try { localStorage.clear(); } catch (e) {}
    showScreen('apoc');
    Apocalypse.start();
    window.__apEnter(+lv);
    if (act === 'card') return;
  }, [level, action]);
  await page.waitForTimeout(400);

  if (action.startsWith('walk:')) {
    const [dx, dy, secs] = action.slice(5).split(',').map(Number);
    await page.evaluate(([dx, dy, s]) => window.__apPump(s, { right: dx > 0, left: dx < 0, down: dy > 0, up: dy < 0 }), [dx, dy, secs]);
  } else if (action !== 'card' && action !== 'play') {
    await page.evaluate((a) => window.__apOpen(a), action);
  }
  await page.waitForTimeout(300);
  await page.evaluate(() => window.__apPaint && window.__apPaint());
  await page.waitForTimeout(200);

  const cdp = await page.context().newCDPSession(page);
  const { data } = await cdp.send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(out, Buffer.from(data, 'base64'));
  console.log('wrote', out, 'errors:', errs.length);
  await browser.close();
})();
