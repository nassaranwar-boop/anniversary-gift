/* EVERY MENU SUPER OUISSY PUTS IN FRONT OF HER.

   Two rules, and both were broken by the same thing.

   THE RAIL GOES AT THE FAR RIGHT. It used to be pinned to the far LEFT
   edge of the stage -- the opposite side of the screen from the hand
   most people scroll with. It is at the right edge now, which is where
   he wants it, and it must never sit on top of the writing.

   AND IT IS ONLY THERE WHEN THERE IS SOMETHING BELOW. A menu that fits
   gets no bar at all, and is centred in the screen. That is the half of
   this that needs watching: a bar on a menu with nothing under the fold
   is a control that does nothing, and it eats taps.

   ALL NINE MENUS, not the four a click can reach. The title, the
   how-to, the world card and the pause are reachable by pressing
   things; the ones that only appear at the end of a run or after a boss
   kills her are not, and they are the long ones -- which makes them
   exactly the ones that scroll. SuperOuissy.__menu opens any of them.
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
    /* the message alone names the property and nothing else -- which line
       threw it is the whole of the diagnosis, so keep the top frame. */
    p.on('pageerror', e=>{
      const top = String(e.stack||'').split('\n').find(l=>/\.js:\d+/.test(l)) || '';
      errs.push(label+': '+e.message+(top?'  @'+top.trim():''));
    });
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
               liftFromRight: lr? Math.round(o.right-lr.right) : null,
               liftInStage: lr? (lr.left>=o.left-1 && lr.right<=o.right+1) : null };
    },tag);

    const seen=[];
    const names = await p.evaluate(()=>window.SuperOuissy.__menus||[]);
    for (const n of names) {
      const opened = await p.evaluate(m=>window.SuperOuissy.__menu(m), n);
      if (!opened) { console.log('  (' + n + ' would not open)'); continue; }
      await p.waitForTimeout(650);
      const r = await look(n); if (r) seen.push(r);
    }

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
        ok(label+': '+r.tag+' rail is over at the right-hand edge',
           r.liftFromRight >= 0 && r.liftFromRight <= 30,
           r.liftFromRight + 'px in from the right');
        ok(label+': '+r.tag+' rail is clear of the writing', r.liftClearsCard >= 0,
           r.liftClearsCard + 'px past the card');
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
