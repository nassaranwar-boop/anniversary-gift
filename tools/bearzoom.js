/* The bears, magnified, on the grounds they actually stand on.
   Guessing at a 66-pixel-wide animal from a screenshot is how three
   rewrites in a row came out looking like rocks. */
const { chromium } = require('playwright-core'); const fs = require('fs');
(async () => {
  const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args:['--no-sandbox','--no-proxy-server','--disable-gpu'] });
  const page = await b.newPage({ viewport:{width:1100,height:560} });
  await page.route('**/*', r => r.request().url().startsWith('http://127.0.0.1') ? r.continue() : r.abort());
  await page.goto('http://127.0.0.1:8899/index.html', { waitUntil:'domcontentloaded', timeout:60000 });
  await page.waitForTimeout(1400);
  const b64 = await page.evaluate(() => {
    const c=document.createElement('canvas'); c.width=1100; c.height=560;
    const x=c.getContext('2d'); x.imageSmoothingEnabled=false;
    // the two grounds they stand on, so contrast is judged against the real thing
    x.fillStyle='#6b9945'; x.fillRect(0,0,1100,280);        // the sunlit wood
    x.fillStyle='#2c2733'; x.fillRect(0,280,1100,280);      // the orchard at night
    const put=(img,dx,dy,s)=>x.drawImage(img,0,0,img.width,img.height,dx,dy,img.width*s,img.height*s);
    put(drawBearLurking(), 40, 30, 5);
    put(drawBearGrazing(), 40, 300, 5);
    put(drawBearAlert(), 420, 300, 5);
    return c.toDataURL('image/png').split(',')[1];
  });
  fs.writeFileSync(process.argv[2], Buffer.from(b64,'base64'));
  console.log('wrote', process.argv[2]);
  await b.close();
})();
