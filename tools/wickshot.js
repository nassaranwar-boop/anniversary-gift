/* Still of any Wick & Cogs room, straight out of the WebGL canvas.
   node wickshot.js <out.png> <room> [cam] [w] [h]
   Goes through toDataURL rather than page.screenshot, because a
   screenshot hangs while a canvas loop is painting. */
const { chromium } = require('playwright-core'); const fs = require('fs');
const [out, room = 'office', cam = 'main', who = '[]', W = 1280, H = 720] = process.argv.slice(2);
(async () => {
  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox', '--no-proxy-server', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
  });
  const page = await browser.newPage({ viewport: { width: +W + 40, height: +H + 40 }, deviceScaleFactor: 1 });
  page.on('pageerror', e => console.log('PAGEERROR', e.message));
  page.on('console', m => { if (m.type() === 'error') console.log('CONSOLE', m.text()); });
  await page.route('**/*', r => r.request().url().startsWith('http://127.0.0.1') ? r.continue() : r.abort());
  await page.goto('http://127.0.0.1:8899/tools/wickshot.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(500);
  await page.evaluate(([w, h]) => {
    const s = document.getElementById('stage'); s.style.width = w + 'px'; s.style.height = h + 'px';
  }, [+W, +H]);
  const data = await page.evaluate(([r, c, w]) => window.__shoot(r, c, JSON.parse(w)), [room, cam, who]);
  fs.writeFileSync(out, Buffer.from(data.split(',')[1], 'base64'));
  console.log('wrote', out, room + '/' + cam);
  await browser.close();
})();
