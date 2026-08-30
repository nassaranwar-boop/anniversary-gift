const { chromium } = require('playwright-core'); const fs = require('fs');
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox','--no-proxy-server','--disable-gpu'] });
  const page = await browser.newPage({ viewport: { width: 1100, height: 860 }, deviceScaleFactor: 1 });
  page.on('pageerror', e => console.log('PAGEERROR', e.message));
  await page.route('**/*', r => r.request().url().startsWith('http://127.0.0.1') ? r.continue() : r.abort());
  await page.goto('http://127.0.0.1:8899/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(400);
  const cdp = await page.context().newCDPSession(page);
  const grab = async (name) => {
    await page.evaluate(() => {
      if (!document.getElementById('__noblur')) {
        const st = document.createElement('style'); st.id = '__noblur';
        st.textContent = '*{backdrop-filter:none !important;-webkit-backdrop-filter:none !important;}';
        document.head.appendChild(st);
      }
      window.__soHalt && window.__soHalt();
    });
    await page.waitForTimeout(150);
    const { data } = await cdp.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(name, Buffer.from(data, 'base64'));
    console.log('wrote', name, '| overlay:',
      (await page.evaluate(() => (document.getElementById('so-overlay').textContent||'').replace(/\s+/g,' ').slice(0,80))));

  };
  const boot = async (diff, fresh) => {
    await page.evaluate(f => { if (f) { try{localStorage.clear();}catch(e){} } if (window.SuperOuissy) SuperOuissy.stop(); showScreen('ouissy'); startSuperOuissy(); }, !!fresh);
    await page.waitForTimeout(400);
    await page.click(`[data-so-diff="${diff}"]`);
    await page.click('#so-play'); await page.waitForTimeout(350);
  };

  // 1. how to play (shown on a first ever launch)
  await boot('medium', true);
  await grab('s_howto.png');
  await page.evaluate(() => { window.__soHaltUndo && window.__soHaltUndo(); });
  const how = await page.$('#so-how-ok'); if (how) await how.click();
  await page.waitForTimeout(200);

  // 2. the world card
  await page.evaluate(() => { window.__soHaltUndo(); });
  await page.waitForTimeout(900);
  await grab('s_worldcard.png');
  await page.evaluate(() => { window.__soHaltUndo(); });
  await page.waitForTimeout(1600);

  // 3. pause
  await page.evaluate(() => { window.__soPump(0.2, {}); SuperOuissy.pause(); });
  await page.waitForTimeout(500);
  await grab('s_pause.png');

  // 4. results
  await page.evaluate(() => { window.__soHaltUndo(); SuperOuissy.pause();
    window.__soTele(window.__soGoalTile() - 4);
    window.__soPump(1.2, { right: true }); window.__soPump(4, { right: false }); });
  await page.waitForTimeout(500);
  await grab('s_results.png');

  // 5. the ending
  await page.evaluate(() => { window.__soHaltUndo(); window.__soShowEnding(); });
  await page.waitForTimeout(3000);
  await grab('s_ending.png');
  await browser.close();
})();
