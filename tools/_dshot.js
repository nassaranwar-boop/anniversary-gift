const { chromium } = require('playwright-core');
const fs = require('fs');
(async () => {
  const b = await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});
  for (const [w,h] of [[1280,800],[390,844]]) {
    const ctx = await b.newContext({viewport:{width:w,height:h}, deviceScaleFactor:1, isMobile:w<600, hasTouch:w<600});
    await ctx.route('**/*', r => r.request().url().startsWith('http://127.0.0.1') ? r.continue() : r.abort());
    const p = await ctx.newPage();
    const cdp = await ctx.newCDPSession(p);
    await p.goto('http://127.0.0.1:8899/index.html',{waitUntil:'domcontentloaded',timeout:60000});
    await p.waitForTimeout(2200);
    await p.evaluate(()=>{ showScreen('scrapbook'); if (window.startDioramas) startDioramas(); });
    await p.waitForTimeout(1600);
    await p.evaluate(()=>Scrapbook.skipIntro());
    await p.waitForTimeout(2800);
    await p.evaluate(()=>{const x=document.getElementById('sb-extras-btn'); if(x) x.click();});
    await p.waitForTimeout(3000);
    const d = await cdp.send('Page.captureScreenshot',{format:'png'});
    fs.writeFileSync('/tmp/shots/drawer-'+w+'.png', Buffer.from(d.data,'base64'));
    console.log('shot drawer-'+w);
    await ctx.close();
  }
  await b.close();
})();
