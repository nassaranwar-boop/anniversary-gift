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
    var cast = Rescue._cast();
    var her = SuperOuissy.frame('idle', 0);
    var imgs = [cast.anwar[0], cast.anwar[1], her];
    var SC = 13, gap = 5;
    var W = imgs.reduce(function (a, i) { return a + i.width + gap; }, gap);
    var H = Math.max.apply(null, imgs.map(function (i) { return i.height; })) + 3;
    var o = document.createElement('canvas'); o.width = W * SC; o.height = H * SC;
    var c = o.getContext('2d'); c.imageSmoothingEnabled = false;
    var g = c.createLinearGradient(0, 0, 0, o.height);
    g.addColorStop(0, '#4e4358'); g.addColorStop(1, '#292231');
    c.fillStyle = g; c.fillRect(0, 0, o.width, o.height);
    var x = gap;
    imgs.forEach(function (i) {
      c.drawImage(i, x * SC, (H - 1 - i.height) * SC, i.width * SC, i.height * SC);
      x += i.width + gap;
    });
    return o.toDataURL('image/png');
  });
  fs.writeFileSync(process.argv[2] || 'anwar.png', Buffer.from(data.split(',')[1], 'base64'));
  console.log('wrote', process.argv[2]);
  await browser.close();
})();
