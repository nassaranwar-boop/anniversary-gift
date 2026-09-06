/* Hunt for a seam: a thin vertical line of light or dark down a page that
   is starting to turn, and anything showing through it from underneath.
   Shoots the early part of a turn and reports the columns where the
   picture changes sharply, so a hairline can be located instead of
   squinted at.
     node tools/seamhunt.js <spreads to skip> <dir 1|-1> */
const { chromium } = require('playwright-core'); const fs=require('fs');
(async () => {
  const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args:['--no-sandbox','--no-proxy-server','--disable-gpu','--use-gl=swiftshader','--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport:{width:1100,height:820}, deviceScaleFactor:2 });
  await p.route('**/*', r => r.request().url().startsWith('http://127.0.0.1') ? r.continue() : r.abort());
  await p.goto('http://127.0.0.1:8899/index.html',{waitUntil:'domcontentloaded',timeout:60000});
  await p.waitForTimeout(1500);
  await p.evaluate(async()=>{ window.skipBookIntro&&window.skipBookIntro(); showScreen('scrapbook'); Scrapbook.start();
    await new Promise(r=>setTimeout(r,1200)); const i=document.querySelector('.sb-intro'); if(i) i.click();
    await new Promise(r=>setTimeout(r,2400)); });
  const skip=Number(process.argv[2]||3), dir=Number(process.argv[3]||1);
  for(let i=0;i<skip;i++){ await p.evaluate(()=>Scrapbook.next()); await p.waitForTimeout(1400); }
  const out='/tmp/seam'; fs.mkdirSync(out,{recursive:true});
  const clip = await p.evaluate(()=>{ const s=document.querySelector('.sb-book-outer').getBoundingClientRect();
    return {x:Math.round(s.x),y:Math.round(s.y),width:Math.round(s.width),height:Math.round(s.height)}; });
  await p.screenshot({path:out+'/rest.png', clip});
  for (const v of [0.02,0.05,0.09,0.14]) {
    await p.evaluate(([d,v])=>Scrapbook.__holdTurn(d,v), [dir,v]);
    await p.waitForTimeout(260);
    await p.screenshot({path:`${out}/p${String(Math.round(v*100)).padStart(3,'0')}.png`, clip});
  }
  console.log('wrote '+out+'   book box '+JSON.stringify(clip));
  await b.close();
})();
