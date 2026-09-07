/* screenshot a node at a chosen moment, so a line of dialogue can be
   caught mid-conversation. node hvvoiceshot.js <out> <node> <seconds> */
const { chromium } = require('playwright-core'); const fs = require('fs');
const [out, node, when] = process.argv.slice(2);
(async () => {
  const browser = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args:['--no-sandbox','--no-proxy-server','--disable-gpu'] });
  const page = await browser.newPage({ viewport:{width:1180,height:900} });
  page.on('pageerror', e=>console.log('ERR', e.message));
  await page.route('**/*', r => r.request().url().startsWith('http://127.0.0.1') ? r.continue() : r.abort());
  await page.goto('http://127.0.0.1:8899/index.html', { waitUntil:'domcontentloaded', timeout:60000 });
  await page.waitForTimeout(1400);
  await page.evaluate(({node, when}) => {
    try{localStorage.clear();}catch(e){}
    showScreen('quest'); startQuest();
    hvNode = node; hvRender(false);
    hvArrive = 0; hvPaintFrame(+when, 0.016);
  }, {node, when});
  await page.waitForTimeout(400);
  const cdp = await page.context().newCDPSession(page);
  const { data } = await cdp.send('Page.captureScreenshot', { format:'png' });
  fs.writeFileSync(out, Buffer.from(data,'base64'));
  console.log('wrote', out);
  await browser.close();
})();
