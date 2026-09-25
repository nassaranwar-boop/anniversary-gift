/* BOTH OF HIS SPEECHES MUST BE SKIPPABLE, WITH A FINGER — AND THE
   THING SHE PUTS IT ON HAS TO BE THE BUTTON.

   This used to print what was under the SKIP and then assert nothing
   about it, which is how the film's SKIP spent its whole life buried
   under the letterbox bar: `.ns-cine::after` paints after every child
   of `.ns-cine`, the button sits 3.4% off the bottom, the bar is 11%
   and opaque, so the button was drawn, faded in on cue, answered a
   click, and could not be seen. `isVisible()` said true, because to
   Playwright a thing with a box and no `display:none` is visible; only
   elementFromPoint knows the difference, and its answer was going
   straight to the console with nobody reading it.

   So it judges now. Four things per speech: the button is there and
   has a thumb's worth of box, a finger in the middle of it lands on
   the button rather than on whatever is over it, pressing it leaves
   the speech, and the phase it leaves for is the right one. */
const { chromium } = require('playwright-core');

let pass = 0, fail = 0;
const t = (n, c, note) => { c ? pass++ : fail++;
  console.log(`${c ? 'PASS' : 'FAIL'}  ${n}${note !== undefined ? '   ' + note : ''}`); };

(async () => {
  const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args:['--no-sandbox','--no-proxy-server','--use-gl=swiftshader','--enable-unsafe-swiftshader'] });

  /* upright and sideways: the bar is a percentage of the stage, and the
     button has a pixel floor, so the two move against each other */
  for (const vp of [{ width:390, height:844, name:'phone upright' },
                    { width:740, height:360, name:'phone sideways' },
                    { width:1000, height:640, name:'laptop' }]) {
    console.log('\n--- ' + vp.name + '  ' + vp.width + 'x' + vp.height);
    const p = await b.newPage({ viewport:{ width:vp.width, height:vp.height },
                                hasTouch:true, isMobile:vp.width < 800 });
    p.on('pageerror', e=>console.log('PAGEERROR', e.message));
    await p.route('**/*', r=>{const u=r.request().url();
      if(u.indexOf('book-scene.js')>=0) return r.abort();
      return u.startsWith('http://127.0.0.1')?r.continue():r.abort();});
    await p.goto('http://127.0.0.1:8899/index.html',{waitUntil:'domcontentloaded',timeout:120000});
    await p.waitForTimeout(600);
    await p.evaluate(()=>{ try{localStorage.clear();}catch(e){} showScreen('nightshift');
      return loadChapter('nightshift').then(()=>OuissysNightShift.start()); });
    await p.waitForFunction(()=>window.OuissysNightShift&&OuissysNightShift.__night&&Object.keys(OuissysNightShift.__night.cast()).length>=4,null,{timeout:120000});
    await p.waitForTimeout(900);

    /* what a finger at the middle of a button actually reaches */
    const under = (id) => p.evaluate((i)=>{
      const el = document.getElementById(i);
      if (!el) return { there:false };
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      const x = r.left + r.width/2, y = r.top + r.height/2;
      const hit = document.elementFromPoint(x, y);
      return { there:true, w:Math.round(r.width), h:Math.round(r.height),
               opacity:+cs.opacity, hit: hit ? (hit.id || hit.className || hit.tagName) : null,
               mine: !!(hit && (hit === el || el.contains(hit))),
               inFrame: r.top >= 0 && r.left >= 0 && r.bottom <= innerHeight && r.right <= innerWidth };
    }, id);

    /* 1. the film */
    await p.evaluate(()=>OuissysNightShift.__night.route('start'));
    await p.waitForTimeout(3200);                    // its SKIP fades in at 2.2s
    let st = await p.evaluate(()=>OuissysNightShift.__night.state().phase);
    t('the film is playing', st === 'intro', 'phase=' + st);
    const f = await under('ns-cine-skip');
    t('the film SKIP is on the screen', f.there && f.inFrame, JSON.stringify(f));
    t('the film SKIP is a thumb', f.there && f.w >= 44 && f.h >= 44, f.there ? f.w + 'x' + f.h : '-');
    t('the film SKIP has faded in', f.there && f.opacity > 0.9, f.there ? 'opacity ' + f.opacity : '-');
    t('a finger on the film SKIP reaches it', !!f.mine, 'it lands on: ' + f.hit);
    await p.evaluate(()=>document.querySelector('#ns-cine-skip').click());
    await p.waitForTimeout(1400);
    st = await p.evaluate(()=>OuissysNightShift.__night.state().phase);
    t('pressing it leaves the film', st !== 'intro', 'phase=' + st);

    /* 2. the terms */
    const g = await under('ns-terms-skip');
    t('the terms SKIP is on the screen', g.there && g.inFrame, JSON.stringify(g));
    t('the terms SKIP is a thumb', g.there && g.w >= 44 && g.h >= 44, g.there ? g.w + 'x' + g.h : '-');
    t('a finger on the terms SKIP reaches it', !!g.mine, 'it lands on: ' + g.hit);
    if (g.there) {
      await p.evaluate(()=>document.querySelector('#ns-terms-skip').click());
      await p.waitForTimeout(1800);
      const s2 = await p.evaluate(()=>OuissysNightShift.__night.state());
      t('pressing it puts her in the shift', s2.phase === 'play' && s2.hour === 0,
        'phase=' + s2.phase + ' hour=' + s2.hour);
    }
    await p.close();
  }

  console.log(`\n${pass} passed, ${fail} failed`);
  await b.close();
  process.exit(fail ? 1 : 0);
})();
