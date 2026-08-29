const { chromium } = require('playwright-core'); const fs = require('fs');
const shot = async (page, name) => {
  const d = await page.evaluate(() => {
    const src = document.getElementById('so-canvas');
    const o = document.createElement('canvas'); o.width = src.width*3; o.height = src.height*3;
    const c = o.getContext('2d'); c.imageSmoothingEnabled=false; c.drawImage(src,0,0,o.width,o.height);
    return o.toDataURL('image/png');
  });
  fs.writeFileSync(name+'.png', Buffer.from(d.split(',')[1],'base64'));
};
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox','--no-proxy-server','--disable-gpu'] });
  const page = await browser.newPage({ viewport: { width: 1000, height: 680 } });
  const errors = [];
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
  page.on('console', m => { if (m.type()==='error' && !/ERR_FAILED/.test(m.text())) errors.push('CONSOLE: '+m.text()); });
  await page.route('**/*', r => r.request().url().startsWith('http://127.0.0.1') ? r.continue() : r.abort());
  await page.goto('http://127.0.0.1:8899/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(400);
  await page.evaluate(() => { try{localStorage.clear();}catch(e){} showScreen('ouissy'); startSuperOuissy(); });
  await page.waitForTimeout(250);
  await page.click('[data-so-diff="easy"]'); await page.click('#so-play'); await page.waitForTimeout(200);
  const how = await page.$('#so-how-ok'); if (how) await how.click();
  await page.waitForTimeout(2200);

  for (let w = 0; w < 3; w++) {
    if (w === 2) await page.evaluate(() => window.__soKillBoss());
    await page.evaluate(() => window.__soTele(window.__soGoalTile() - 4));
    await page.evaluate(() => window.__soPump(1.2, { right: true }));
    const s = await page.evaluate(() => window.__soPump(4.0, { right: false }));
    await shot(page, 'flow_canvas'+(w+1));
    await page.waitForTimeout(250);
    const txt = await page.evaluate(() => (document.getElementById('so-overlay')||{}).textContent || '');
    console.log('world', w+1, '| state', s.state, '| overlay:', txt.replace(/\s+/g,' ').slice(0,140));
    const next = await page.$('#so-next');
    if (!next) { console.log('  !! no results button'); break; }
    await next.click();
    await page.waitForTimeout(w === 2 ? 1600 : 2400);
  }
  console.log('ending shown:', !!(await page.$('#so-end-again')));
  const endTxt = await page.evaluate(() => (document.getElementById('so-overlay')||{}).textContent || '');
  console.log('ending overlay:', endTxt.replace(/\s+/g,' ').slice(0,220));
  console.log('chapter marked:', await page.evaluate(() => localStorage.getItem('fal_chapters_done')));
  console.log('best saved:', await page.evaluate(() => localStorage.getItem('so_best')));
  console.log(JSON.stringify({errors}));
  await browser.close();
})();
