// Show the tree/ground relationship at two different camera heights.
const { chromium } = require('playwright-core'); const fs = require('fs');
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
  await page.waitForTimeout(2300);
  await page.evaluate(() => { window.__soTestDrive = true; });

  const shot = async (name) => {
    const d = await page.evaluate(() => {
      const src = document.getElementById('so-canvas');
      const o = document.createElement('canvas'); o.width = src.width*3; o.height = src.height*3;
      const c = o.getContext('2d'); c.imageSmoothingEnabled=false; c.drawImage(src,0,0,o.width,o.height);
      return o.toDataURL('image/png');
    });
    fs.writeFileSync(name+'.png', Buffer.from(d.split(',')[1],'base64'));
  };

  // camera pinned low (she is on the ground) then high (mid jump)
  await page.evaluate(() => { window.__soTele(20); window.__soPump(0.3, {}); });
  console.log('grounded cam.y =', await page.evaluate(() => window.__soCam().y));
  await shot('px_ground');
  await page.evaluate(() => { window.__soPlayer({ y: 20 }); window.__soPump(0.05, {}); });
  console.log('lifted   cam.y =', await page.evaluate(() => window.__soCam().y));
  await shot('px_air');
  await browser.close();
})();
