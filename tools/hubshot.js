const { chromium } = require('playwright-core'); const fs=require('fs');
(async () => {
  const browser = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args:['--no-sandbox','--no-proxy-server','--disable-gpu','--use-gl=swiftshader','--enable-unsafe-swiftshader'] });
  const out = process.argv[2]; fs.mkdirSync(out,{recursive:true});
  for (const d of [{n:'iphone15',w:390,h:844},{n:'iphone15-urlbar',w:390,h:745},{n:'iphoneSE',w:375,h:667},{n:'desktop',w:1440,h:900}]) {
    const page = await browser.newPage({ viewport:{width:d.w,height:d.h}, deviceScaleFactor:2, isMobile:d.w<500, hasTouch:d.w<500 });
    await page.route('**/*', r => r.request().url().startsWith('http://127.0.0.1') ? r.continue() : r.abort());
    await page.goto('http://127.0.0.1:8899/index.html',{waitUntil:'domcontentloaded',timeout:60000});
    await page.waitForTimeout(1500);
    await page.evaluate(async()=>{ window.skipBookIntro&&window.skipBookIntro(); showScreen('hub'); startHub(); await new Promise(r=>setTimeout(r,700)); });
    await page.screenshot({ path:`${out}/hub-${d.n}.png` }); console.log('shot', d.n);
    await page.close();
  }
  await browser.close();
})();
