// Jump straight to a given world and position, for reviewing later levels.
const { chromium } = require('playwright-core'); const fs = require('fs');
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox','--no-proxy-server','--disable-gpu'] });
  const page = await browser.newPage({ viewport: { width: 960, height: 600 } });
  const errors = [];
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
  page.on('console', m => { if (m.type()==='error' && !/ERR_FAILED/.test(m.text())) errors.push('CONSOLE: '+m.text()); });
  await page.route('**/*', r => r.request().url().startsWith('http://127.0.0.1') ? r.continue() : r.abort());
  await page.goto('http://127.0.0.1:8899/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(400);
  await page.evaluate(d => { try{localStorage.clear();}catch(e){} showScreen('ouissy'); startSuperOuissy(); }, null);
  await page.waitForTimeout(250);
  await page.click(`[data-so-diff="${process.env.DIFF||'medium'}"]`);
  await page.click('#so-play'); await page.waitForTimeout(200);
  const how = await page.$('#so-how-ok'); if (how) await how.click();
  await page.waitForTimeout(2100);
  const shots = JSON.parse(process.env.SHOTS || '[]');
  for (const s of shots) {
    if (s.world !== undefined) { await page.evaluate(w => window.__soGoLevel(w), s.world); await page.waitForTimeout(2100); }
    if (s.at !== undefined) { await page.evaluate(a => window.__soTele(a), s.at); }
    await page.waitForTimeout(s.hold || 600);
    const data = await page.evaluate(() => {
      const src = document.getElementById('so-canvas');
      const o = document.createElement('canvas'); o.width = src.width*3; o.height = src.height*3;
      const c = o.getContext('2d'); c.imageSmoothingEnabled = false;
      c.drawImage(src, 0, 0, o.width, o.height); return o.toDataURL('image/png');
    });
    fs.writeFileSync(s.name + '.png', Buffer.from(data.split(',')[1],'base64'));
  }
  console.log(JSON.stringify({errors, state: await page.evaluate(()=>window.__soState())}));
  await browser.close();
})();
