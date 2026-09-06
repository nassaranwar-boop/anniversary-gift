/* the front door, driven with a finger, at four shapes */
const { chromium } = require('playwright-core');
let pass=0, fail=0;
const ok=(n,c,x)=>{ if(c){pass++;console.log('PASS  '+n+(x?'   '+x:''));} else {fail++;console.log('FAIL  '+n+(x?'   '+x:''));} };
(async () => {
  const b = await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});
  for (const [w,h,l] of [[390,844,'iphone-portrait'],[844,390,'iphone-landscape'],[932,430,'iphone-max-land'],[1180,820,'ipad-land']]) {
    const ctx = await b.newContext({viewport:{width:w,height:h}, isMobile:true, hasTouch:true});
    await ctx.route('**/*', r => r.request().url().startsWith('http://127.0.0.1') ? r.continue() : r.abort());
    const p = await ctx.newPage();
    const errs=[]; p.on('pageerror',e=>errs.push(e.message));
    await p.goto('http://127.0.0.1:8899/index.html',{waitUntil:'domcontentloaded',timeout:60000});
    await p.waitForTimeout(2200);
    await p.evaluate(()=>showScreen('gate'));
    await p.waitForTimeout(1400);

    /* Three digits and the plate: it should say so rather than guess. */
    for (const d of ['1','1','1']) await p.tap(`[data-gate-key="${d}"]`);
    await p.tap('#gate-submit');
    await p.waitForTimeout(400);
    let msg = await p.evaluate(()=>(document.getElementById('gate-error').textContent||'').trim());
    ok(l+': the plate asks for four first', /four/i.test(msg), msg);
    await p.tap('[data-gate-key="clear"]');

    /* A wrong code. The gate checks ITSELF 300ms after the fourth digit,
       so this waits rather than pressing the plate — pressing it here
       races the auto-check and reads its already-cleared buffer. */
    for (const d of ['1','1','1','1']) await p.tap(`[data-gate-key="${d}"]`);
    await p.waitForTimeout(120);
    let filled = await p.evaluate(()=>document.querySelectorAll('.gate-dot.filled').length);
    ok(l+': the keys fill the dots', filled===4, filled+'/4');
    /* A wrong code is deliberately NOT wiped out from under her: it shows
       the error, flashes the dots red and shakes the card, and clears 620ms
       later — 920ms after the fourth digit, counting the auto-check. Wait
       for the dots to empty rather than for a number of milliseconds, or a
       loaded machine reports the site as broken when it is only slow. */
    await p.waitForFunction(
      () => document.querySelectorAll('.gate-dot.filled').length === 0,
      { timeout: 15000, polling: 200 }).catch(() => {});
    let err = await p.evaluate(()=>({msg:(document.getElementById('gate-error').textContent||'').trim(),
                                     dots:document.querySelectorAll('.gate-dot.filled').length}));
    ok(l+': a wrong code is refused and cleared', err.msg.length>0 && err.dots===0, JSON.stringify(err));

    /* backspace */
    await p.tap('[data-gate-key="7"]'); await p.tap('[data-gate-key="7"]');
    await p.tap('[data-gate-key="back"]'); await p.waitForTimeout(120);
    filled = await p.evaluate(()=>document.querySelectorAll('.gate-dot.filled').length);
    ok(l+': backspace takes one off', filled===1, filled+'');
    await p.tap('[data-gate-key="clear"]'); await p.waitForTimeout(120);
    filled = await p.evaluate(()=>document.querySelectorAll('.gate-dot.filled').length);
    ok(l+': clear empties it', filled===0, filled+'');

    /* the real one */
    for (const d of ['2','2','0','7']) await p.tap(`[data-gate-key="${d}"]`);
    await p.waitForTimeout(3800);
    const where = await p.evaluate(()=>{const a=document.querySelector('.screen.active'); return a?a.id:'none';});
    ok(l+': 2207 opens the book', where==='screen-scrapbook', where);
    ok(l+': no errors at the gate', errs.length===0, errs[0]||'');
    await ctx.close();
  }
  await b.close();
  console.log('\n'+pass+' passed, '+fail+' failed');
  process.exit(fail?1:0);
})();
