/* node hvshot.js <out> <node> [w] [h] */
const { chromium } = require('playwright-core'); const fs = require('fs');
const [out, node, W=1180, H=900] = process.argv.slice(2);
(async () => {
  const browser = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args:['--no-sandbox','--no-proxy-server','--disable-gpu','--font-render-hinting=none'] });
  const page = await browser.newPage({ viewport:{width:+W,height:+H} });
  page.on('pageerror', e=>console.log('ERR', e.message));
  await page.route('**/*', r => { const u=r.request().url();
    if (u.startsWith('http://127.0.0.1')||u.includes('fonts.g')) return r.continue(); return r.abort(); });
  await page.goto('http://127.0.0.1:8899/index.html', { waitUntil:'networkidle', timeout:60000 });
  await page.waitForTimeout(900);
  await page.evaluate((n) => { try{localStorage.clear();}catch(e){}
    showScreen('quest'); if (window.startQuest) startQuest();
    hvNode = n; hvRender(); }, node);
  await page.waitForTimeout(1400);
  const cdp = await page.context().newCDPSession(page);
  const { data } = await cdp.send('Page.captureScreenshot', { format:'png' });
  fs.writeFileSync(out, Buffer.from(data,'base64'));
  console.log('wrote', out, node);
  await browser.close();
})();
