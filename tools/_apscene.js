// The apocalypse's props at the size a phone held sideways gives them,
// against the same props on an iPad.
const { chromium } = require('playwright-core');
const fs = require('fs');
(async () => {
  const b = await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args:['--no-sandbox','--use-gl=swiftshader','--enable-unsafe-swiftshader']});
  for (const [n,w,h] of [['phone',956,440],['ipad',1194,834]]) {
    const ctx = await b.newContext({viewport:{width:w,height:h}, deviceScaleFactor:2, isMobile:true, hasTouch:true});
    await ctx.route('**/*', r => r.request().url().startsWith('http://127.0.0.1') ? r.continue() : r.abort());
    const p = await ctx.newPage(); const cdp = await ctx.newCDPSession(p);
    await p.goto('http://127.0.0.1:8899/index.html',{waitUntil:'domcontentloaded',timeout:60000});
    await p.waitForTimeout(1800);
    await p.evaluate(()=>{ showScreen('hub'); if(window.startHub) startHub(); });
    await p.waitForTimeout(900);
    await p.evaluate(()=>{const e=document.getElementById('hub-card-apoc'); if(e) e.click();});
    await p.waitForTimeout(9000);
    const r = await p.evaluate(()=>{
      const out = {};
      ['.ap-tv','.ap-dlg','.ap-panel','.ap-note','.ap-stage'].forEach(sel=>{
        const e=document.querySelector(sel); if(!e) return;
        const b=e.getBoundingClientRect();
        if (b.width<2) return;
        out[sel]=Math.round(b.width)+'x'+Math.round(b.height)+
          (b.bottom>innerHeight+1||b.top<-1 ? '  OFF-SCREEN' : '');
      });
      out.vp = innerWidth+'x'+innerHeight;
      return out;
    });
    console.log(n, JSON.stringify(r));
    const d = await cdp.send('Page.captureScreenshot',{format:'png'});
    fs.writeFileSync('/tmp/shots/AP-'+n+'.png', Buffer.from(d.data,'base64'));
    await ctx.close();
  }
  await b.close();
})();
