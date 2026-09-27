// What the gate card is actually made of, at each sideways size, so the
// trim can be aimed instead of guessed.
const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args:['--no-sandbox','--use-gl=swiftshader','--enable-unsafe-swiftshader']});
  for (const [n,w,h] of [['SE',667,375],['13mini',812,375],['13Pro',844,390],['13Pro·bar',844,340],
                         ['16Pro',874,402],['15PM',932,430],['16PM',956,440],['16PM·bar',956,390]]) {
    const ctx = await b.newContext({viewport:{width:w,height:h}, deviceScaleFactor:3, isMobile:true, hasTouch:true});
    await ctx.route('**/*', r => r.request().url().startsWith('http://127.0.0.1') ? r.continue() : r.abort());
    const p = await ctx.newPage();
    await p.goto('http://127.0.0.1:8899/index.html',{waitUntil:'domcontentloaded',timeout:60000});
    await p.waitForTimeout(1400);
    await p.evaluate(()=>showScreen('gate'));
    await p.waitForTimeout(1600);
    const r = await p.evaluate(()=>{
      const card=document.querySelector('.gate-card');
      const cb=card.getBoundingClientRect();
      const kid=[...card.querySelectorAll('.gate-seal-wrap,.gate-heading,.gate-field,.gate-error,.gate-pad,.gate-unlock')]
        .map(e=>({c:(e.className||'').split(' ')[0].replace('gate-',''),
                  h:Math.round(e.getBoundingClientRect().height),
                  f:Math.round(parseFloat(getComputedStyle(e).fontSize)*10)/10}));
      const key=card.querySelector('.gate-key');
      const kb=key?key.getBoundingClientRect():null;
      const sub=card.querySelector('.gate-unlock').getBoundingClientRect();
      return { card:Math.round(cb.width)+'x'+Math.round(cb.height),
               top:Math.round(cb.top), bottom:Math.round(cb.bottom), vh:innerHeight,
               over:Math.round(Math.max(0, cb.bottom-innerHeight) + Math.max(0,-cb.top)),
               submitBottom:Math.round(sub.bottom), submitH:Math.round(sub.height),
               key: kb? Math.round(kb.width)+'x'+Math.round(kb.height):'-',
               kid };
    });
    console.log(`${n.padEnd(10)} ${String(w+'x'+h).padEnd(8)} card ${r.card.padEnd(9)} top ${String(r.top).padStart(4)} bottom ${String(r.bottom).padStart(4)} of ${r.vh}  over ${r.over}  submit ${r.submitH}px ends ${r.submitBottom}  key ${r.key}`);
    console.log('           ' + r.kid.map(k=>k.c+' '+k.h+(k.f?'/'+k.f+'px':'')).join('  '));
    await ctx.close();
  }
  await b.close();
})();
