const { chromium } = require('playwright-core'); const fs=require('fs');
(async () => {
  const browser = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args:['--no-sandbox','--no-proxy-server','--disable-gpu','--use-gl=swiftshader','--enable-unsafe-swiftshader'] });
  const out=process.argv[2]; fs.mkdirSync(out,{recursive:true});
  const page = await browser.newPage({ viewport:{width:430,height:932}, deviceScaleFactor:2, isMobile:true, hasTouch:true });
  page.on('pageerror',e=>console.log('PAGEERROR',e.message));
  await page.route('**/*', r => r.request().url().startsWith('http://127.0.0.1') ? r.continue() : r.abort());
  await page.goto('http://127.0.0.1:8899/index.html',{waitUntil:'domcontentloaded',timeout:60000});
  await page.waitForTimeout(1500);
  await page.evaluate(async()=>{ window.skipBookIntro&&window.skipBookIntro(); showScreen('scrapbook'); Scrapbook.start();
    await new Promise(r=>setTimeout(r,1200));
    // the candle waits for a tap
    const intro=document.querySelector('.sb-intro'); if(intro) intro.click();
    await new Promise(r=>setTimeout(r,2200)); });
  const n = Number(process.argv[3]||13);
  for (let i=0;i<n;i++){
    await page.screenshot({path:`${out}/p${String(i).padStart(2,'0')}.png`});
    await page.evaluate(()=>Scrapbook.next());
    await page.waitForTimeout(1500);
  }
  console.log('shot', n, 'pages');
  await browser.close();
})();
