const { chromium } = require('playwright-core');
const fs = require('fs');

(async () => {
  const vw = parseInt(process.env.VW || '1000', 10), vh = parseInt(process.env.VH || '640', 10);
  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox', '--no-proxy-server', '--disable-gpu', '--autoplay-policy=no-user-gesture-required'],
  });
  const page = await browser.newPage({ viewport: { width: vw, height: vh }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/ERR_FAILED/.test(m.text())) errors.push('CONSOLE: ' + m.text()); });
  await page.route('**/*', r => r.request().url().startsWith('http://127.0.0.1') ? r.continue() : r.abort());
  await page.goto('http://127.0.0.1:8899/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(500);

  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} showScreen('ouissy'); startSuperOuissy(); });
  await page.waitForTimeout(400);

  const diff = process.env.DIFF || 'medium';
  await page.click(`[data-so-diff="${diff}"]`);
  await page.click('#so-play');
  await page.waitForTimeout(300);
  const how = await page.$('#so-how-ok');
  if (how) await how.click();
  await page.waitForTimeout(2200);          // through the world card

  // teleport + play helpers exposed for the test only
  const shots = JSON.parse(process.env.SHOTS || '[{"hold":1200,"name":"play"}]');
  for (const s of shots) {
    if (s.jump) await page.evaluate(x => window.__soTele(x), s.jump);
    if (s.keys) {
      for (const k of s.keys) await page.keyboard.down(k);
      await page.waitForTimeout(s.hold || 500);
      for (const k of s.keys) await page.keyboard.up(k);
    } else {
      await page.waitForTimeout(s.hold || 500);
    }
    if (s.name) {
      const data = await page.evaluate(() => {
        const src = document.getElementById('so-canvas');
        const o = document.createElement('canvas');
        o.width = src.width * 3; o.height = src.height * 3;
        const c = o.getContext('2d');
        c.imageSmoothingEnabled = false;
        c.drawImage(src, 0, 0, o.width, o.height);
        return o.toDataURL('image/png');
      });
      fs.writeFileSync(s.name + '.png', Buffer.from(data.split(',')[1], 'base64'));
    }
  }
  const state = await page.evaluate(() => window.__soState ? window.__soState() : null);
  console.log(JSON.stringify({ errors, state }, null, 1));
  await browser.close();
})();
