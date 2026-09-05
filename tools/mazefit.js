const { chromium } = require('playwright-core');
(async () => {
  const browser = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args:['--no-sandbox','--no-proxy-server','--disable-gpu','--use-gl=swiftshader','--enable-unsafe-swiftshader'] });
  for (const d of [{n:'iPhone landscape',w:844,h:390},{n:'iPhone landscape, url bar',w:844,h:330},
                   {n:'iPhone portrait',w:390,h:844},{n:'iPhone SE',w:375,h:667},{n:'desktop',w:1440,h:900}]) {
    const page = await browser.newPage({ viewport:{width:d.w,height:d.h}, deviceScaleFactor:2, isMobile:d.w<900, hasTouch:d.w<900 });
    await page.route('**/*', r => r.request().url().startsWith('http://127.0.0.1') ? r.continue() : r.abort());
    await page.goto('http://127.0.0.1:8899/index.html',{waitUntil:'domcontentloaded',timeout:60000});
    await page.waitForTimeout(1200);
    const r = await page.evaluate(async () => {
      window.skipBookIntro&&window.skipBookIntro(); showScreen('maze'); initMaze(1);
      await new Promise(r=>setTimeout(r,900));
      const scr=document.getElementById('screen-maze').getBoundingClientRect();
      const pick=(sel)=>{const e=document.querySelector(sel); if(!e) return 'missing';
        const b=e.getBoundingClientRect();
        const hit=document.elementFromPoint(b.left+b.width/2,b.top+b.height/2);
        return Math.round(b.top)+'..'+Math.round(b.bottom)+
          (b.bottom<=scr.bottom+1&&b.top>=scr.top-1 ? ' ok':' CUT')+
          (hit&&(hit===e||e.contains(hit))?'':' UNTAPPABLE');};
      return { screen:Math.round(scr.bottom), stage:pick('#maze-stage'), dpad:pick('.dpad-3d'),
               up:pick('.dpad3-up'), down:pick('.dpad3-down'), hud:pick('.maze-hud, .hud-pill') };
    });
    console.log(d.n.padEnd(28), 'screen 0..'+r.screen, ' stage', r.stage, ' dpad', r.dpad, ' down-btn', r.down);
    await page.close();
  }
  await browser.close();
})();
