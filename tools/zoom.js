const { chromium } = require('playwright-core'); const fs = require('fs');
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox','--no-proxy-server','--disable-gpu'] });
  const page = await browser.newPage({ viewport: { width: 800, height: 500 } });
  page.on('pageerror', e => console.log('PAGEERROR', e.message));
  await page.route('**/*', r => r.request().url().startsWith('http://127.0.0.1') ? r.continue() : r.abort());
  await page.goto('http://127.0.0.1:8899/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(600);
  const data = await page.evaluate(w => {
    var imgs = ({ idle: OUISSY_FRAMES('idle','small'), idleBig: OUISSY_FRAMES('idle','big'),
                  run: OUISSY_FRAMES('run','small') })[w] || OUISSY_FRAMES('idle','small');
    var SC = 16, gap = 2, W = 0, H = 0;
    imgs.forEach(function (i) { W += i.width + gap; H = Math.max(H, i.height); });
    var o = document.createElement('canvas'); o.width = W*SC; o.height = H*SC;
    var c = o.getContext('2d'); c.imageSmoothingEnabled = false;
    c.fillStyle = '#4a6a8a'; c.fillRect(0,0,o.width,o.height);
    var x = 0;
    imgs.forEach(function (i) { c.drawImage(i, x*SC, 0, i.width*SC, i.height*SC); x += i.width + gap; });
    return o.toDataURL('image/png');
  }, process.argv[2] || 'idle');
  fs.writeFileSync(process.argv[3] || 'zoom.png', Buffer.from(data.split(',')[1], 'base64'));
  console.log('wrote', process.argv[3]);
  await browser.close();
})();
