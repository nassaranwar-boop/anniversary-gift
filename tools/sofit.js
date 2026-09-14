/* EVERY MENU SUPER OUISSY PUTS IN FRONT OF HER.

   Two rules, and both were broken by the same thing.

   THE RAIL BELONGS TO THE CARD. `#so-lift` is the scrollbar for the
   overlay, and it was pinned to the far LEFT edge of the stage: on a
   phone that left thirty-four points of dark between it and the card it
   scrolls, on an iPad a hundred and ten. It read as a gold light down
   the side of the picture rather than as this card's scrollbar. It sits
   against the card's right edge now, measured, and it may never cross
   the writing or leave the stage.

   AND IT IS ONLY THERE WHEN THERE IS SOMETHING BELOW. A menu that fits
   gets no bar at all, and it is centred in the screen — which is the
   other half of what he asked for.
*/
const { chromium } = require('playwright-core');

const SIZES = [['desktop',1280,800],['iPad sideways',1180,820],['iPad upright',820,1180],
               ['iPhone sideways',844,390],['iPhone upright',390,844],['iPhone SE',375,667]];
let pass=0, fail=0;
const ok=(n,c,x)=>{ if(c){pass++;console.log('  ok   '+n+(x?'  '+x:''));}
                    else {fail++;console.log('  FAIL '+n+(x?'  '+x:''));} };

(async () => {
  const browser = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args:['--no-sandbox','--no-proxy-server','--use-gl=swiftshader','--enable-unsafe-swiftshader'] });
  const errs=[];
  for (const [label,w,h] of SIZES) {
    const p = await browser.newPage({ viewport:{width:w,height:h}, deviceScaleFactor:2,
                                      isMobile:w<900, hasTouch:w<900 });
    p.on('pageerror', e=>errs.push(label+': '+e.message));
    await p.route('**/*', r=>r.request().url().startsWith('http://127.0.0.1')?r.continue():r.abort());
    await p.goto('http://127.0.0.1:8899/index.html',{waitUntil:'domcontentloaded',timeout:60000});
    await p.waitForTimeout(700);
    await p.evaluate(()=>window.loadChapter&&window.loadChapter('ouissy'));
    await p.waitForFunction(()=>!!window.SuperOuissy,null,{timeout:40000});
    await p.evaluate(()=>{try{localStorage.clear();}catch(e){} showScreen('ouissy'); SuperOuissy.start();});
    await p.waitForTimeout(1100);
    console.log('\n== ' + label + '  ' + w + 'x' + h);

    const look = (tag) => p.evaluate((t)=>{
      const ov=document.querySelector('.so-overlay');
      const card=ov&&ov.firstElementChild;
      if(!ov||!card||!ov.classList.contains('on')) return null;
      const o=ov.getBoundingClientRect(), c=card.getBoundingClientRect();
      const lift=document.getElementById('so-lift');
      const on = !!(lift && lift.classList.contains('on') && lift.offsetParent);
      const lr = on ? lift.getBoundingClientRect() : null;
      return { tag:t, kind:(ov.className.match(/so-ov-\w+/)||['?'])[0],
               scrolls: ov.scrollHeight>ov.clientHeight+4,
               above:Math.round(c.top-o.top), below:Math.round(o.bottom-c.bottom),
               cardL:Math.round(c.left-o.left), cardR:Math.round(o.right-c.right),
               lift:on, liftClearsCard: lr? Math.round(lr.left-c.right) : null,
               liftInStage: lr? (lr.left>=o.left-1 && lr.right<=o.right+1) : null };
    },tag);

    const seen=[];
    const step = async (tag, act) => {
      if (act) { await p.evaluate(act); await p.waitForTimeout(800); }
      const r = await look(tag); if (r) seen.push(r); return r;
    };
    await step('title', null);
    await step('how', ()=>{const e=document.querySelector('#so-play'); if(e)e.click();});
    await step('world', ()=>{const e=document.querySelector('#so-how-ok'); if(e)e.click();});
    await step('pause', ()=>{ if(window.SuperOuissy&&SuperOuissy.__pause) SuperOuissy.__pause();
                              else document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape'})); });

    for (const r of seen) {
      const tail = r.kind + (r.scrolls ? ' (scrolls)' : ' (fits)');
      /* a menu that fits is centred; one that scrolls starts at its top */
      if (!r.scrolls)
        ok(label+': '+r.tag+' is centred when it fits', Math.abs(r.above-r.below)<=2,
           tail+' top '+r.above+' bottom '+r.below);
      ok(label+': '+r.tag+' sits square left to right', Math.abs(r.cardL-r.cardR)<=2,
         tail+' left '+r.cardL+' right '+r.cardR);
      ok(label+': '+r.tag+' shows a rail only if there is more below',
         r.lift === r.scrolls, tail+' rail=' + r.lift);
      if (r.lift) {
        ok(label+': '+r.tag+' rail is beside the card, not out in the dark',
           r.liftClearsCard >= 0 && r.liftClearsCard <= 40, r.liftClearsCard + 'px from it');
        ok(label+': '+r.tag+' rail stays on the stage', r.liftInStage === true);
      }
    }
    await p.close();
  }
  ok('nothing threw', errs.length===0, errs.slice(0,2).join(' | '));
  console.log('');
  console.log(fail? pass+' passed, '+fail+' FAILED' : 'all '+pass+' checks passed');
  await browser.close();
  process.exit(fail?1:0);
})();
