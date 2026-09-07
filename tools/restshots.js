/* Every spread at rest, straight through the book.
     node tools/restshots.js <out dir> <spreads> */
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
  const out=process.argv[2]; fs.mkdirSync(out,{recursive:true});
  const n=Number(process.argv[3]||10);
  for(let k=0;k<n;k++){
    await p.waitForTimeout(700);
    await p.screenshot({path:`${out}/s${String(k).padStart(2,'0')}.png`});
    await p.evaluate(()=>Scrapbook.next()); await p.waitForTimeout(1400);
  }
  console.log('shot', n);
  await b.close();
})();
