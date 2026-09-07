// How big is a photograph actually drawn, in device pixels, on each device?
// Whatever the answer is, everything above it is bytes she waits for and
// never sees.
const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});
  for (const [name,w,h,dpr] of [['desktop',1512,982,2],['iphone',390,844,3],['ipad',834,1112,2]]) {
    const ctx = await b.newContext({viewport:{width:w,height:h}, deviceScaleFactor:dpr});
    await ctx.route('**/*', r => r.request().url().startsWith('http://127.0.0.1') ? r.continue() : r.abort());
    const p = await ctx.newPage();
    await p.goto('http://127.0.0.1:8899/index.html',{waitUntil:'domcontentloaded',timeout:60000});
    await p.waitForTimeout(2200);
    await p.evaluate(()=>{ showScreen('scrapbook'); if (window.startDioramas) startDioramas(); });
    await p.waitForTimeout(1600);
    await p.evaluate(()=>Scrapbook.skipIntro());
    await p.waitForTimeout(3000);
    let worstPage=0, n=0;
    for (let i=0;i<14;i++){
      const r = await p.evaluate((d)=>{
        let m=0,c=0;
        document.querySelectorAll('#sb-spread .sb-photo-inner img').forEach(im=>{
          const b=im.getBoundingClientRect();
          if (b.width>1){ m=Math.max(m, Math.max(b.width,b.height)*d); c++; }
        });
        return [m,c];
      }, dpr);
      worstPage=Math.max(worstPage,r[0]); n+=r[1];
      await p.evaluate(()=>Scrapbook.next());
      await p.waitForTimeout(700);
    }
    // and the lightbox, the one place a photo is shown large
    await p.evaluate(()=>{const a=document.querySelectorAll('#sb-spread .sb-photo'); if(a[0]) a[0].click();});
    await p.waitForTimeout(1400);
    const lb = await p.evaluate((d)=>{
      const im=document.querySelector('#sb-lightbox .sb-lb-frame img');
      if(!im) return 0; const b=im.getBoundingClientRect();
      return Math.round(Math.max(b.width,b.height)*d);
    }, dpr);
    console.log(`${name.padEnd(8)} dpr ${dpr}  biggest on a page ${Math.round(worstPage)}px   in the lightbox ${lb}px   (${n} prints seen)`);
    await ctx.close();
  }
  await b.close();
})();
