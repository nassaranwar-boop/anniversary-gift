const { chromium } = require('playwright-core'); const fs=require('fs');
(async () => {
  const browser = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args:['--no-sandbox','--no-proxy-server','--disable-gpu','--use-gl=swiftshader','--enable-unsafe-swiftshader'] });
  const out=process.argv[2]; fs.mkdirSync(out,{recursive:true});
  for (const d of [{n:'landscape',w:844,h:390},{n:'landscape-urlbar',w:844,h:330},{n:'portrait',w:390,h:844}]) {
    const page = await browser.newPage({ viewport:{width:d.w,height:d.h}, deviceScaleFactor:2, isMobile:true, hasTouch:true });
    await page.route('**/*', r => r.request().url().startsWith('http://127.0.0.1') ? r.continue() : r.abort());
    await page.goto('http://127.0.0.1:8899/index.html',{waitUntil:'domcontentloaded',timeout:60000});
    await page.waitForTimeout(1200);
    await page.evaluate(async()=>{ window.skipBookIntro&&window.skipBookIntro(); showScreen('maze'); initMaze(1); await new Promise(r=>setTimeout(r,900)); });
    await page.screenshot({path:`${out}/maze-${d.n}.png`}); console.log('shot',d.n);
    await page.close();
  }
  await browser.close();
})();
