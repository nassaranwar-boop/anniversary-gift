// Does the frame ever move? Ten trips out of the tab and back, each one
// jittering the window through a random run of wrong sizes on the way in,
// the way Safari's restore animation does. The framing is recorded before
// the first trip and compared after every one of them.
const { chromium } = require('playwright-core');
let pass=0, fail=0;
const ok=(n,c,d)=>{ (c?pass++:fail++); console.log((c?'PASS  ':'FAIL  ')+n+(d?'   '+d:'')); };

(async () => {
  const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args:['--no-sandbox','--no-proxy-server','--disable-gpu','--use-gl=swiftshader','--enable-unsafe-swiftshader'] });

  for (const dev of [{n:'iPad 12.9',w:1366,h:892},{n:'iPhone',w:390,h:844},{n:'iPad landscape',w:1180,h:820}]) {
    const p = await b.newPage({ viewport:{width:dev.w,height:dev.h}, deviceScaleFactor:2, isMobile:true, hasTouch:true });
    p.on('pageerror',e=>ok(dev.n+': no page error',false,e.message));
    await p.route('**/*', r => r.request().url().startsWith('http://127.0.0.1') ? r.continue() : r.abort());
    // the toolbar is showing: innerHeight and the visible box disagree
    await p.addInitScript(() => { addEventListener('DOMContentLoaded', () => {
      const s=document.createElement('style');
      s.textContent=':root{--app-h:calc(100dvh - 88px) !important;}';
      document.head.appendChild(s); }); });
    await p.goto('http://127.0.0.1:8899/index.html',{waitUntil:'domcontentloaded',timeout:60000});
    await p.waitForTimeout(3000);

    const frame = () => p.evaluate(() => {
      const c=document.getElementById('book-canvas');
      const s=document.querySelector('.screen.active').getBoundingClientRect();
      const r=c.getBoundingClientRect();
      return { screenH:+s.height.toFixed(1), boxW:+r.width.toFixed(1), boxH:+r.height.toFixed(1),
               bufAspect:+(c.width/c.height).toFixed(4), boxAspect:+(r.width/r.height).toFixed(4),
               scrollable: document.documentElement.scrollHeight > document.documentElement.clientHeight+1 };
    });
    const base = await frame();
    ok(dev.n+': the canvas fits the screen on first load', Math.abs(base.boxH-base.screenH)<1.5,
       'canvas '+base.boxH+' vs screen '+base.screenH);
    let moved = 0, stretched = 0, scrolled = 0, oversized = 0;

    for (let i=0;i<10;i++) {
      await p.evaluate(()=>{ Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});
        Object.defineProperty(document,'visibilityState',{configurable:true,get:()=>'hidden'});
        document.dispatchEvent(new Event('visibilitychange')); });
      await p.waitForTimeout(150 + Math.random()*250);
      await p.evaluate(()=>{ Object.defineProperty(document,'hidden',{configurable:true,get:()=>false});
        Object.defineProperty(document,'visibilityState',{configurable:true,get:()=>'visible'});
        document.dispatchEvent(new Event('visibilitychange'));
        dispatchEvent(new Event('focus')); dispatchEvent(new Event('pageshow')); });
      // the restore animation: a random run of wrong heights
      const steps = 3 + Math.floor(Math.random()*5);
      for (let k=0;k<steps;k++){
        const jitter = Math.round(dev.h * (0.35 + Math.random()*0.6));
        await p.setViewportSize({ width: dev.w, height: Math.max(200, jitter) });
        await p.waitForTimeout(10 + Math.random()*30);
      }
      await p.setViewportSize({ width: dev.w, height: dev.h });
      await p.waitForTimeout(1300);
      const f = await frame();
      if (Math.abs(f.boxH-base.boxH)>1 || Math.abs(f.boxW-base.boxW)>1) moved++;
      if (Math.abs(f.bufAspect-f.boxAspect)>0.01) stretched++;
      /* THE assertion. Checking the canvas only against its own earlier self
         passes happily when it is consistently wrong -- which is exactly
         what the old code does: it makes the canvas innerHeight tall, the
         buffer matches that, and both agree with each other while
         disagreeing with the screen you are looking at. The canvas has to
         match the SCREEN. */
      if (Math.abs(f.boxH-f.screenH)>1.5) oversized++;
      if (f.scrollable) scrolled++;
    }
    ok(dev.n+': the canvas is the size of the screen, every time',
       oversized===0, oversized?oversized+' of 10 did not fit the screen':'10/10 matched the screen exactly');
    ok(dev.n+': the frame never moved across 10 trips out and back', moved===0, moved?moved+' of 10 moved':'10/10 identical');
    ok(dev.n+': the shot was never stretched', stretched===0, stretched?stretched+' of 10 stretched':'buffer matched the box every time');
    ok(dev.n+': never scrollable', scrolled===0);
    await p.close();
  }
  await b.close();
  console.log('\n'+pass+' pass, '+fail+' fail');
  process.exit(fail?1:0);
})();
