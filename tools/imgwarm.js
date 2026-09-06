/* Are the book's photographs loaded and decoded before they are needed?
   Reports how many are still pending while the book sits still, and the
   state of every image on the resting pages once a turn is under way. */
const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args:['--no-sandbox','--no-proxy-server','--disable-gpu','--use-gl=swiftshader','--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport:{width:1100,height:820} });
  await p.route('**/*', r => r.request().url().startsWith('http://127.0.0.1') ? r.continue() : r.abort());
  await p.goto('http://127.0.0.1:8899/index.html',{waitUntil:'domcontentloaded',timeout:60000});
  await p.waitForTimeout(1500);
  await p.evaluate(async()=>{ window.skipBookIntro&&window.skipBookIntro(); showScreen('scrapbook'); Scrapbook.start();
    await new Promise(r=>setTimeout(r,1200)); const i=document.querySelector('.sb-intro'); if(i) i.click();
    await new Promise(r=>setTimeout(r,2400)); });
  for(let i=0;i<3;i++){ await p.evaluate(()=>Scrapbook.next()); await p.waitForTimeout(1400); }
  const before = await p.evaluate(()=>{
    const out=[];
    document.querySelectorAll('.sb-page img').forEach(im=>{
      out.push({src:(im.getAttribute('src')||'').split('/').pop(), lazy:im.loading, done:im.complete, w:im.naturalWidth});
    });
    const n=out.length, done=out.filter(o=>o.done).length, lazy=out.filter(o=>o.lazy==='lazy').length;
    return {n, done, lazy, notdone: out.filter(o=>!o.done).slice(0,8)};
  });
  console.log('while the book sits still:', JSON.stringify(before));
  await p.evaluate(()=>Scrapbook.__holdTurn(1,0.52)); await p.waitForTimeout(200);
  const during = await p.evaluate(()=>{
    const shown=[...document.querySelectorAll('.sb-spread .sb-page.on img')];
    return shown.map(im=>({src:(im.getAttribute('src')||'').split('/').pop(), lazy:im.loading,
      done:im.complete, w:im.naturalWidth}));
  });
  console.log('the resting pages 200ms into the turn:');
  during.forEach(d=>console.log('  ', JSON.stringify(d)));
  await b.close();
})();
