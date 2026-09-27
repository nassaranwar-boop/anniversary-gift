const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args:['--no-sandbox','--use-gl=swiftshader','--enable-unsafe-swiftshader']});
  for (const [n,w,h] of [['SE',667,375],['13mini',812,375]]) {
    const ctx = await b.newContext({viewport:{width:w,height:h}, deviceScaleFactor:3, isMobile:true, hasTouch:true});
    await ctx.route('**/*', r => r.request().url().startsWith('http://127.0.0.1') ? r.continue() : r.abort());
    const p = await ctx.newPage();
    await p.goto('http://127.0.0.1:8899/index.html',{waitUntil:'domcontentloaded',timeout:60000});
    await p.waitForTimeout(2000);
    await p.evaluate(()=>{ showScreen('scrapbook'); if (window.startDioramas) startDioramas(); });
    await p.waitForTimeout(1500);
    await p.evaluate(()=>Scrapbook.skipIntro());
    await p.waitForTimeout(4500);
    await p.evaluate(()=>{const x=document.getElementById('sb-extras-btn'); if(x) x.click();});
    await p.waitForTimeout(4000);
    const r = await p.evaluate(()=>{
      const d=document.getElementById('sb-drawer'); const cs=getComputedStyle(d);
      const rect=d.getBoundingClientRect();
      return { on: document.getElementById('screen-scrapbook').className,
               display: cs.display, width: cs.width, transform: cs.transform,
               rect: Math.round(rect.left)+','+Math.round(rect.top)+' '+Math.round(rect.width)+'x'+Math.round(rect.height),
               cols: cs.gridTemplateColumns, over: d.scrollHeight-d.clientHeight };
    });
    console.log(n, w+'x'+h, JSON.stringify(r, null, 0));
    await ctx.close();
  }
  await b.close();
})();
