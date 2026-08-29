const { chromium } = require('playwright-core');
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox','--no-proxy-server','--disable-gpu'] });
  const page = await browser.newPage({ viewport: { width: 900, height: 560 } });
  page.on('pageerror', e => console.log('PAGEERROR', e.message));
  await page.route('**/*', r => r.request().url().startsWith('http://127.0.0.1') ? r.continue() : r.abort());
  await page.goto('http://127.0.0.1:8899/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(400);
  await page.evaluate(() => { window.__soTestDrive = true; try{localStorage.clear();}catch(e){} showScreen('ouissy'); startSuperOuissy(); });
  await page.waitForTimeout(300);
  await page.click('[data-so-diff="medium"]'); await page.click('#so-play'); await page.waitForTimeout(250);
  const how = await page.$('#so-how-ok'); if (how) await how.click();
  for (let i = 0; i < 30; i++) { await page.waitForTimeout(200);
    if (await page.evaluate(() => window.__soInfo().state === 'play')) break; }
  console.log(await page.evaluate(() => JSON.stringify({
    firstHeartRowMajor: window.__soFindTile('o')[0],
    gift: window.__soFindGift('?'),
    grow: window.__soFindGift('M'),
  })));
  console.log(await page.evaluate(() => {
    var g = window.__soFindGift('?');
    window.__soReset(); window.__soTele(g.x);
    var before = window.__soInfo().score;
    var trace = [];
    for (var i = 0; i < 6; i++) {
      window.__soPump(0.15, { jump: i < 4 });
      trace.push(Math.round(window.__soPlayer().y) + '/' + window.__soInfo().usedBlocks);
    }
    return JSON.stringify({ giftAt: g, gained: window.__soInfo().score - before, trace: trace.join(' ') });
  }));
  await browser.close();
})();
