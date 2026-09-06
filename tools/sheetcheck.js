/* The turning sheet at one moment, shot twice: as it is, and again with
   the shading layer switched off -- which separates what the paper looks
   like from what the light on it is doing.
     node tools/sheetcheck.js <spreads to skip> <progress> <1 | -1> */
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
  const skip=Number(process.argv[2]||3), hold=Number(process.argv[3]||0.52);
  for(let i=0;i<skip;i++){ await p.evaluate(()=>Scrapbook.next()); await p.waitForTimeout(1400); }
  fs.mkdirSync('/tmp/sheet',{recursive:true});
  const dir=Number(process.argv[4]||1);
  await p.evaluate(([d,v])=>Scrapbook.__holdTurn(d,v), [dir,hold]); await p.waitForTimeout(400);
  await p.screenshot({path:'/tmp/sheet/with-shade.png'});
  await p.evaluate(()=>{ const s=document.createElement('style'); s.id='noshade';
    s.textContent='.sb-strip-shade{display:none !important}'; document.head.appendChild(s); });
  await p.waitForTimeout(200);
  await p.screenshot({path:'/tmp/sheet/no-shade.png'});
  console.log('wrote /tmp/sheet');
  await b.close();
})();
