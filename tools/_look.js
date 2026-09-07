/* Photograph the things he pointed at. */
const { chromium } = require('playwright-core');
const fs = require('fs');
(async () => {
  const b = await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});
  const ctx = await b.newContext({viewport:{width:1400,height:900}, deviceScaleFactor:1});
  await ctx.route('**/*', r => r.request().url().startsWith('http://127.0.0.1') ? r.continue() : r.abort());
  const p = await ctx.newPage();
  const cdp = await ctx.newCDPSession(p);
  const shot = async (name) => {
    const d = await cdp.send('Page.captureScreenshot', {format:'png'});
    fs.writeFileSync('/tmp/shots/'+name+'.png', Buffer.from(d.data,'base64'));
    console.log('shot', name);
  };
  await p.goto('http://127.0.0.1:8899/index.html',{waitUntil:'domcontentloaded',timeout:60000});
  await p.waitForTimeout(2500);
  await p.evaluate(()=>{ showScreen('scrapbook'); if (window.startDioramas) startDioramas(); });
  await p.waitForTimeout(2500);
  await shot('00-cover');
  await p.evaluate(()=>Scrapbook.skipIntro());
  // let it build
  let last=-1, same=0;
  for (let i=0;i<40 && same<4;i++){ await p.waitForTimeout(600);
    const n = await p.evaluate(()=>document.querySelectorAll('#sb-spread .sb-page').length);
    if (n===last) same++; else {same=0; last=n;} }
  await shot('01-cover-built');
  for (let v=1; v<=10; v++) {
    await p.evaluate(()=>Scrapbook.next());
    await p.waitForFunction(()=>!document.getElementById('screen-scrapbook').classList.contains('sb-turning'),
      {timeout:60000, polling:120}).catch(()=>{});
    await p.waitForTimeout(1400);
    await shot('spread-'+String(v).padStart(2,'0'));
  }
  // the drawer
  await p.evaluate(()=>{const b=document.getElementById('sb-extras-btn'); if(b) b.click();});
  await p.waitForTimeout(2500);
  await shot('20-drawer');
  await b.close();
})();
