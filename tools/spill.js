/* A frame at rest and a frame mid-turn, plus every element whose box
   reaches outside the spread. Bounding boxes only -- a box outside the
   spread is not proof that anything paints there, so read it alongside
   tools/clipproof.js rather than instead of it.
     node tools/spill.js <spreads to skip> */
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
  const skip=Number(process.argv[2]||0);
  for(let i=0;i<skip;i++){ await p.evaluate(()=>Scrapbook.next()); await p.waitForTimeout(1500); }
  const o='/tmp/spill'; fs.mkdirSync(o,{recursive:true});
  await p.screenshot({path:o+'/rest.png'});
  await p.evaluate(()=>Scrapbook.__holdTurn(1,0.34)); await p.waitForTimeout(200);
  await p.screenshot({path:o+'/t34.png'});
  // what actually sits outside the spread box?
  const info = await p.evaluate(()=>{
    const s=document.querySelector('.sb-spread').getBoundingClientRect();
    const out=[];
    document.querySelectorAll('#screen-scrapbook *').forEach(n=>{
      const r=n.getBoundingClientRect();
      if(!r.width||!r.height) return;
      const dy=Math.max(s.top-r.top, r.bottom-s.bottom);
      const dx=Math.max(s.left-r.left, r.right-s.right);
      if(dy>3||dx>3) out.push({cls:n.className&&n.className.toString().slice(0,42), tag:n.tagName,
        dx:+dx.toFixed(1), dy:+dy.toFixed(1), op:getComputedStyle(n).opacity});
    });
    return out.slice(0,40);
  });
  console.log(JSON.stringify(info,null,1));
  await b.close();
})();
