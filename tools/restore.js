// Replaying the failure the recordings actually show.
//
// Returning to Safari does not snap the window back, it animates it back.
// From his iPad clip, the top of the page area walked
//   411 -> 346 -> 277 -> 208 -> 195 -> 165 -> 143 -> 127 -> 112 -> 101
//   -> 97 -> 88 -> 85 -> 81 -> 75 -> 72 -> 93
// over roughly three tenths of a second. Every step there is a different
// viewport height, and whichever one the renderer happened to measure was
// the one it kept. This drives that same sequence and then checks that what
// the canvas ended up with is the SETTLED size and not one of the steps.
const { chromium } = require('playwright-core');
let pass=0, fail=0;
const ok=(n,c,d)=>{ (c?pass++:fail++); console.log((c?'PASS  ':'FAIL  ')+n+(d?'   '+d:'')); };

(async () => {
  const browser = await chromium.launch({
    executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args:['--no-sandbox','--no-proxy-server','--disable-gpu','--use-gl=swiftshader','--enable-unsafe-swiftshader'] });

  for (const dev of [{n:'iPad',w:1024,h:768},{n:'iPhone',w:390,h:844}]) {
    const page = await browser.newPage({ viewport:{width:dev.w,height:dev.h}, deviceScaleFactor:2, isMobile:true, hasTouch:true });
    page.on('pageerror', e=>ok(dev.n+': no page error', false, e.message));
    await page.route('**/*', r => r.request().url().startsWith('http://127.0.0.1') ? r.continue() : r.abort());
    // The heart of the iOS fault, which a desktop browser does not have on
    // its own: window.innerHeight and the height you can actually see are
    // not the same number. On a phone or an iPad with the toolbar showing
    // they differ by the height of that toolbar. Here that is forced, so
    // any code that sizes itself from the window instead of from its own
    // box gets it wrong by exactly that much -- which is the bug.
    await page.addInitScript(() => {
      addEventListener('DOMContentLoaded', () => {
        const st=document.createElement('style');
        st.textContent=':root{--app-h:calc(100dvh - 88px) !important;}';
        document.head.appendChild(st);
      });
    });
    await page.goto('http://127.0.0.1:8899/index.html',{waitUntil:'domcontentloaded',timeout:60000});
    await page.waitForTimeout(2600);

    const state = () => page.evaluate(() => {
      const c=document.getElementById('book-canvas');
      const s=document.querySelector('.screen.active').getBoundingClientRect();
      const b=c.getBoundingClientRect();
      const de=document.documentElement;
      return { screen:[+s.width.toFixed(1),+s.height.toFixed(1)],
               box:[+b.width.toFixed(1),+b.height.toFixed(1)],
               bufAspect:+(c.width/c.height).toFixed(4),
               boxAspect:+(b.width/b.height).toFixed(4),
               scrollable: de.scrollHeight > de.clientHeight+1 };
    });
    const before = await state();

    // go away
    await page.evaluate(() => {
      Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});
      Object.defineProperty(document,'visibilityState',{configurable:true,get:()=>'hidden'});
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await page.waitForTimeout(400);

    // come back: the window animates through a run of wrong sizes...
    await page.evaluate(() => {
      Object.defineProperty(document,'hidden',{configurable:true,get:()=>false});
      Object.defineProperty(document,'visibilityState',{configurable:true,get:()=>'visible'});
      document.dispatchEvent(new Event('visibilitychange'));
      dispatchEvent(new Event('focus')); dispatchEvent(new Event('pageshow'));
    });
    for (const h of [dev.h-340, dev.h-270, dev.h-200, dev.h-120, dev.h-60, dev.h-20]) {
      await page.setViewportSize({ width: dev.w, height: h });
      await page.waitForTimeout(18);
    }
    // ...and settles back where it started
    await page.setViewportSize({ width: dev.w, height: dev.h });
    await page.waitForTimeout(1400);
    const after = await state();

    ok(dev.n+': the screen is the size it was',
       after.screen[1]===before.screen[1], before.screen.join('x')+' -> '+after.screen.join('x'));
    ok(dev.n+': the canvas still fills the screen exactly',
       Math.abs(after.box[1]-after.screen[1])<1.5 && Math.abs(after.box[0]-after.screen[0])<1.5,
       'canvas '+after.box.join('x')+' vs screen '+after.screen.join('x'));
    ok(dev.n+': the shot is composed for the frame you can see',
       Math.abs(after.bufAspect-after.boxAspect)<0.01,
       'buffer '+after.bufAspect+' vs box '+after.boxAspect);
    ok(dev.n+': the framing is what it was before you left',
       Math.abs(after.boxAspect-before.boxAspect)<0.01,
       before.boxAspect+' -> '+after.boxAspect);
    ok(dev.n+': there is nothing to scroll into', !after.scrollable);
    await page.close();
  }
  await browser.close();
  console.log('\n'+pass+' pass, '+fail+' fail');
  process.exit(fail?1:0);
})();
