const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});
  for (const [w,h] of [[1400,900],[1280,800],[1512,982],[390,844]]) {
    const ctx = await b.newContext({viewport:{width:w,height:h}});
    await ctx.route('**/*', r => r.request().url().startsWith('http://127.0.0.1') ? r.continue() : r.abort());
    const p = await ctx.newPage();
    await p.goto('http://127.0.0.1:8899/index.html',{waitUntil:'domcontentloaded',timeout:60000});
    await p.waitForTimeout(2200);
    await p.evaluate(()=>{ showScreen('scrapbook'); if (window.startDioramas) startDioramas(); });
    await p.waitForTimeout(1600);
    await p.evaluate(()=>Scrapbook.skipIntro());
    await p.waitForTimeout(2600);
    await p.evaluate(()=>{const x=document.getElementById('sb-extras-btn'); if(x) x.click();});
    await p.waitForTimeout(2600);
    const r = await p.evaluate(()=>{
      const d = document.getElementById('sb-drawer');
      const cards = [...d.children].map(c=>({cls:c.className.split(' ')[1]||c.className.split(' ')[0],
        h:Math.round(c.getBoundingClientRect().height)}));
      return {scroll:d.scrollHeight, client:d.clientHeight, over:d.scrollHeight-d.clientHeight, cards};
    });
    console.log(`${w}x${h}  content ${r.scroll}  box ${r.client}  overflow ${r.over>0? r.over+'px  ← SCROLLS':'none'}`);
    r.cards.forEach(c=>console.log('     ', c.cls.padEnd(16), c.h));
    await ctx.close();
  }
  await b.close();
})();
