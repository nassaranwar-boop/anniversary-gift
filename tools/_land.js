const { chromium } = require('playwright-core');
const fs = require('fs');
(async () => {
  const b = await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args:['--no-sandbox','--use-gl=swiftshader','--enable-unsafe-swiftshader']});
  for (const [n,w,h] of [['ipad',1194,834],['pc',1440,900]]) {
    for (const [card,id] of [['hub-card-race','race'],['hub-card-quest','quest'],['hub-card-ouissy','ouissy']]) {
      const ctx = await b.newContext({viewport:{width:w,height:h}, deviceScaleFactor:2, isMobile:true, hasTouch:true});
      await ctx.route('**/*', r => r.request().url().startsWith('http://127.0.0.1') ? r.continue() : r.abort());
      const p = await ctx.newPage(); const cdp = await ctx.newCDPSession(p);
      await p.goto('http://127.0.0.1:8899/index.html',{waitUntil:'domcontentloaded',timeout:60000});
      await p.waitForTimeout(1800);
      await p.evaluate(()=>{ showScreen('hub'); if(window.startHub) startHub(); });
      await p.waitForTimeout(900);
      await p.evaluate(c=>{const e=document.getElementById(c); if(e) e.click();}, card);
      await p.waitForTimeout(6000);
      const st = await p.evaluate(()=>{
        const c=document.querySelector('.screen.active .rc-stage, .screen.active .hv-stage, .screen.active .so-stage, .screen.active .ap-stage, .screen.active .ns-stage');
        if(!c) return 'no stage'; const r=c.getBoundingClientRect();
        return Math.round(r.width)+'x'+Math.round(r.height)+' at '+Math.round(r.left)+','+Math.round(r.top)+' of '+innerWidth+'x'+innerHeight;
      });
      console.log(n, id, st);
      const d = await cdp.send('Page.captureScreenshot',{format:'png'});
      fs.writeFileSync('/tmp/shots/L-'+n+'-'+id+'.png', Buffer.from(d.data,'base64'));
      await ctx.close();
    }
  }
  await b.close();
})();
