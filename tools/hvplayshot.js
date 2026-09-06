/* screenshot a node mid-mechanic */
const { chromium } = require('playwright-core'); const fs = require('fs');
const [out, node, kind] = process.argv.slice(2);
(async () => {
  const browser = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args:['--no-sandbox','--no-proxy-server','--disable-gpu'] });
  const page = await browser.newPage({ viewport:{width:1180,height:900} });
  page.on('pageerror', e=>console.log('ERR', e.message));
  await page.route('**/*', r => r.request().url().startsWith('http://127.0.0.1') ? r.continue() : r.abort());
  await page.goto('http://127.0.0.1:8899/index.html', { waitUntil:'domcontentloaded', timeout:60000 });
  await page.waitForTimeout(1400);
  await page.evaluate(({node, kind}) => {
    try{localStorage.clear();}catch(e){}
    showScreen('quest'); startQuest();
    hvNode = node; hvRender(false);
    if (kind === 'stones') { for (let i=0;i<3;i++){ hvPlayPress(0.4); for(let k=0;k<30;k++) hvPlayStep(0.4,0.4,0.05);} }
    if (kind === 'bridge') { for (let i=0;i<2;i++){ hvPlayPress(0.4); hvPlayStep(0.4,0.4,0.05);} }
    if (kind === 'orchard') { hvHold=true; for(let k=0;k<40;k++) hvPlayStep(k*0.05, k*0.05, 0.05); hvHold=false; }
    // draw one frame at a chosen time
    hvArrive = 0; hvPaintFrame(kind==='orchard'?3.0:2.2, 0.016);
  }, {node, kind});
  await page.waitForTimeout(500);
  const cdp = await page.context().newCDPSession(page);
  const { data } = await cdp.send('Page.captureScreenshot', { format:'png' });
  fs.writeFileSync(out, Buffer.from(data,'base64'));
  console.log('wrote', out);
  await browser.close();
})();
