// The turn frozen at a series of points, so the bend and the light on it
// can be looked at instead of guessed at.
const { chromium } = require('playwright-core'); const fs=require('fs');
(async () => {
  const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args:['--no-sandbox','--no-proxy-server','--disable-gpu','--use-gl=swiftshader','--enable-unsafe-swiftshader'] });
  const out=process.argv[2]; fs.mkdirSync(out,{recursive:true});
  const p = await b.newPage({ viewport:{width:1100,height:820}, deviceScaleFactor:2 });
  p.on('pageerror',e=>console.log('PAGEERROR',e.message));
  await p.route('**/*', r => r.request().url().startsWith('http://127.0.0.1') ? r.continue() : r.abort());
  await p.goto('http://127.0.0.1:8899/index.html',{waitUntil:'domcontentloaded',timeout:60000});
  await p.waitForTimeout(1500);
  await p.evaluate(async()=>{ window.skipBookIntro&&window.skipBookIntro(); showScreen('scrapbook'); Scrapbook.start();
    await new Promise(r=>setTimeout(r,1200)); const i=document.querySelector('.sb-intro'); if(i) i.click();
    await new Promise(r=>setTimeout(r,2400)); });
  for (let k=0;k<(Number(process.argv[3])||3);k++){ await p.evaluate(()=>Scrapbook.next()); await p.waitForTimeout(1400); }
  // hold the turn open at fixed progress values
  const stops=[0.10,0.22,0.36,0.52];
  for (const v of stops) {
    await p.evaluate((v)=>{ Scrapbook.__holdTurn(1, v); }, v);
    await p.waitForTimeout(160);
    await p.screenshot({ path:`${out}/t${String(Math.round(v*100)).padStart(3,'0')}.png` });
  }
  console.log('shot', stops.length);
  await b.close();
})();
