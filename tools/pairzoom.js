/* magnify the two of them so the sprites can actually be judged */
const { chromium } = require('playwright-core'); const fs = require('fs');
(async () => {
  const browser = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args:['--no-sandbox','--no-proxy-server','--disable-gpu'] });
  const page = await browser.newPage({ viewport:{width:900,height:520} });
  page.on('pageerror', e=>console.log('ERR', e.message));
  await page.route('**/*', r => { const u=r.request().url();
    if (u.startsWith('http://127.0.0.1')) return r.continue(); return r.abort(); });
  await page.goto('http://127.0.0.1:8899/index.html', { waitUntil:'domcontentloaded', timeout:60000 });
  await page.waitForTimeout(1500);
  const b64 = await page.evaluate(() => {
    const c = document.createElement('canvas'); c.width=900; c.height=520;
    const x = c.getContext('2d'); x.imageSmoothingEnabled=false;
    x.fillStyle='#6b9a46'; x.fillRect(0,0,900,260);
    x.fillStyle='#2a2038'; x.fillRect(0,260,900,260);
    const scenes=[null,'ridge','orchard'];
    scenes.forEach((sc,i)=>{
      // idle, then the four walk frames, at 8x
      for (let f=0; f<5; f++) {
        const walk = f>0?1:0;
        const t = f>0 ? (f-1)/7.5 + 0.001 : 0;
        x.save();
        x.translate(40 + f*170, i<1?240:500);
        x.scale(1,1);
        hvDrawPair(x, 0, 0, 5.2, t, walk, sc);
        x.restore();
      }
    });
    return c.toDataURL('image/png').split(',')[1];
  });
  fs.writeFileSync(process.argv[2], Buffer.from(b64,'base64'));
  console.log('wrote', process.argv[2]);
  await browser.close();
})();
