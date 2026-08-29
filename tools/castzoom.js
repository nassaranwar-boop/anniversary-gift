const { chromium } = require('playwright-core'); const fs = require('fs');
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox','--no-proxy-server','--disable-gpu'] });
  const page = await browser.newPage({ viewport: { width: 900, height: 700 } });
  page.on('pageerror', e => console.log('PAGEERROR', e.message));
  await page.route('**/*', r => r.request().url().startsWith('http://127.0.0.1') ? r.continue() : r.abort());
  await page.goto('http://127.0.0.1:8899/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(600);
  const data = await page.evaluate(() => {
    Rescue.begin('rescue', {});
    var s = Rescue._state();
    var cast = Rescue._cast();
    var her = SuperOuissy.frame('idle', 0);
    var imgs = [her, cast.anwar[0], cast.anwar[1], cast.death[0], cast.death[1]];
    var SC = 9, gap = 3, W = 0, H = 0;
    imgs.forEach(function (i) { W += i.width + gap; H = Math.max(H, i.height); });
    var o = document.createElement('canvas'); o.width = W*SC; o.height = (H+2)*SC;
    var c = o.getContext('2d'); c.imageSmoothingEnabled = false;
    c.fillStyle = '#5a7a9a'; c.fillRect(0,0,o.width,o.height);
    var x = 0;
    imgs.forEach(function (i) {
      c.drawImage(i, x*SC, (H - i.height + 1)*SC, i.width*SC, i.height*SC);   // feet aligned
      x += i.width + gap;
    });
    return o.toDataURL('image/png');
  });
  fs.writeFileSync(process.argv[2] || 'cast.png', Buffer.from(data.split(',')[1], 'base64'));
  console.log('wrote', process.argv[2]);
  await browser.close();
})();
