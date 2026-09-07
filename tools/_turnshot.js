const { chromium } = require('playwright-core');
const fs = require('fs');
(async () => {
  const b = await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--no-sandbox',
          '--disable-background-timer-throttling','--disable-renderer-backgrounding',
          '--disable-backgrounding-occluded-windows','--disable-frame-rate-limit']});
  const ctx = await b.newContext({viewport:{width:1100,height:720}, reducedMotion:'no-preference'});
  await ctx.route('**/*', r => r.request().url().startsWith('http://127.0.0.1') ? r.continue() : r.abort());
  const p = await ctx.newPage();
  const cdp = await ctx.newCDPSession(p);
  await p.goto('http://127.0.0.1:8899/index.html',{waitUntil:'domcontentloaded',timeout:60000});
  await p.waitForTimeout(2500);
  await p.evaluate(()=>{ showScreen('scrapbook'); if (window.startDioramas) startDioramas(); });
  await p.waitForTimeout(2000);
  await p.evaluate(()=>Scrapbook.skipIntro());
  await p.waitForTimeout(4500);
  await p.evaluate(()=>Scrapbook.next());
  let best=null, bestLift=0;
  for (let i=0;i<30;i++){
    const s = await p.evaluate(()=>({
      lift:parseFloat(getComputedStyle(document.querySelector('.sb-spine')).getPropertyValue('--flip-lift'))||0,
      cut:Math.max(0,...[...document.querySelectorAll('.sb-strip-cut')].filter(c=>getComputedStyle(c).display!=='none').map(c=>parseFloat(getComputedStyle(c).opacity)||0)),
    }));
    if (s.lift > bestLift){
      bestLift = s.lift;
      const d = await cdp.send('Page.captureScreenshot',{format:'png'});
      best = {shot:Buffer.from(d.data,'base64'), ...s};
    }
    if (s.lift === 0 && bestLift > 0) break;
    await p.waitForTimeout(20);
  }
  if (best){ fs.writeFileSync('/tmp/shots/turn-mid.png', best.shot);
    console.log('caught a turn at --flip-lift', best.lift.toFixed(3), ' cut opacity', best.cut.toFixed(3)); }
  else console.log('never caught the turn in flight');
  await b.close();
})();
