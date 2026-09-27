const { chromium } = require('playwright-core');
const fs = require('fs');
(async () => {
  const b = await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args:['--no-sandbox','--use-gl=swiftshader','--enable-unsafe-swiftshader']});
  const shots = [];
  for (const [n,w,h] of [['ipad',1194,834]]) {
    // 1. the 3D book intro
    for (const kind of ['drawer']) {
      const ctx = await b.newContext({viewport:{width:w,height:h}, deviceScaleFactor:2, isMobile:true, hasTouch:true});
      await ctx.route('**/*', r => r.request().url().startsWith('http://127.0.0.1') ? r.continue() : r.abort());
      const p = await ctx.newPage(); const cdp = await ctx.newCDPSession(p);
      await p.goto('http://127.0.0.1:8899/index.html',{waitUntil:'domcontentloaded',timeout:60000});
      await p.waitForTimeout(2000);
      if (kind === 'intro') {
        await p.evaluate(()=>showScreen('videointro'));
        await p.waitForTimeout(7000);
      } else {
        await p.evaluate(()=>{ showScreen('scrapbook'); if (window.startDioramas) startDioramas(); });
        await p.waitForTimeout(1600);
        await p.evaluate(()=>Scrapbook.skipIntro());
        await p.waitForTimeout(5000);
        await p.evaluate(()=>Scrapbook.next());
        await p.waitForFunction(()=>!document.getElementById('screen-scrapbook').classList.contains('sb-turning'),{timeout:30000,polling:120}).catch(()=>{});
        await p.waitForTimeout(1200);
        if (kind === 'drawer') {
          await p.evaluate(()=>{const x=document.getElementById('sb-extras-btn'); if(x) x.click();});
          await p.waitForTimeout(7000);
        }
      }
      const d = await cdp.send('Page.captureScreenshot',{format:'png'});
      const f = '/tmp/shots/P-'+n+'-'+kind+'.png';
      fs.writeFileSync(f, Buffer.from(d.data,'base64')); shots.push(kind);
      await ctx.close();
    }
  }
  console.log('shot', shots.join(' '));
  await b.close();
})();
