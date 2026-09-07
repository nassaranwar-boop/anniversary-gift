const { chromium } = require('playwright-core'); const fs=require('fs');
(async () => {
  const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args:['--no-sandbox','--no-proxy-server','--disable-gpu','--use-gl=swiftshader','--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport:{width:1366,height:892}, deviceScaleFactor:1 });
  await p.route('**/*', r => r.request().url().startsWith('http://127.0.0.1') ? r.continue() : r.abort());
  // the toolbar is showing, so the visible box is 88px shorter than the window
  await p.addInitScript(() => { addEventListener('DOMContentLoaded', () => {
    const s=document.createElement('style');
    s.textContent=':root{--app-h:calc(100dvh - 88px) !important;}';
    document.head.appendChild(s); }); });
  const cdp = await p.context().newCDPSession(p);
  await p.goto('http://127.0.0.1:8899/index.html',{waitUntil:'domcontentloaded',timeout:60000});
  await p.waitForTimeout(4500);
  // capture only the part of the window the person can actually see
  const { data } = await cdp.send('Page.captureScreenshot', { format:'png',
    clip:{ x:0, y:0, width:1366, height:892-88, scale:1 } });
  fs.writeFileSync(process.argv[2], Buffer.from(data,'base64'));
  console.log('wrote', process.argv[2]);
  await b.close();
})();
