/* BEING PUT BACK ON YOUR FEET.

   Any death, any world, any difficulty: if she has more lives than the
   price, she is asked whether to spend them and is stood back up exactly
   where she fell. The price is the difficulty's own — Easy 5, Medium 3,
   Hard 2 — and Anwar only ever appears on Hard, because that is the only
   difficulty he is a part of.

   Usage:  node queenrevive.js
*/
const { chromium } = require('playwright-core');
let pass=0, fail=0;
const ok=(n,c,x)=>{ if(c){pass++;console.log('  PASS  '+n+(x?'   '+x:''));}
                    else {fail++;console.log('  FAIL  '+n+(x?'   '+x:''));} };
const COST = { easy: 5, medium: 3, hard: 2 };

(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args:['--no-sandbox','--no-proxy-server','--use-gl=swiftshader','--enable-unsafe-swiftshader']});
  const p=await b.newPage({viewport:{width:1000,height:700}});
  p.on('pageerror',e=>{console.log('  PAGEERROR',e.message);fail++;});
  await p.route('**/*', r=>{const u=r.request().url();
    if(u.indexOf('book-scene.js')>=0) return r.abort();
    return u.startsWith('http://127.0.0.1')?r.continue():r.abort();});
  await p.goto('http://127.0.0.1:8899/index.html',{waitUntil:'domcontentloaded',timeout:120000});
  await p.waitForTimeout(500);
  await p.evaluate(async ()=>{ window.__soTestDrive=true;
    try{localStorage.clear();localStorage.setItem('so_howto','1');}catch(e){}
    showScreen('ouissy'); await loadChapter('ouissy'); SuperOuissy.start(); });
  await p.waitForFunction(()=>!!window.__soGoLevel,null,{timeout:60000});

  const go = async (diff, world, lives) => {
    await p.evaluate(([d,w])=>{ window.G_setDiff(d); window.__soGoLevel(w); }, [diff, world]);
    await p.waitForFunction(()=>window.__soInfo().state==='play',null,{timeout:15000});
    await p.evaluate((l)=>{ window.G_setLives(l); for(let i=0;i<40;i++) window.__soPump(1/60); }, lives);
  };
  const die = async () => {
    await p.evaluate(()=>window.__soKill());
    for (let i=0;i<200;i++){
      const s = await p.evaluate(()=>{ window.__soPump(1/60); return window.__soInfo().state; });
      if (s !== 'play') return s;
    }
    return 'play';
  };
  const settle = async () => { for(let i=0;i<900;i++){
    const t=await p.evaluate(()=>{window.__soPump(1/60);return window.__soInfo().state;}); if(t==='play')break; } };

  for (const diff of ['easy','medium','hard']) {
    const c = COST[diff];
    console.log('\n— ' + diff + ', where it costs ' + c + ' —');

    /* world 1, nowhere near a boss: this is a rule of the whole game */
    await go(diff, 0, c + 1);
    let st = await die();
    ok(diff + ': asked on an ordinary death, in world one', st === 'revive', 'state ' + st);
    const words = await p.evaluate(()=>({
      head: (document.querySelector('.so-card-revive h3')||{}).textContent || '',
      yes:  (document.getElementById('so-revive-yes')||{}).textContent || '',
      cost: [...document.querySelectorAll('.so-revive-cost b')].map(e=>e.textContent.trim()).join('->') }));
    ok(diff + ': it counts out its own price (after the death)', words.cost === c+'->1', words.cost);
    if (diff === 'hard') {
      ok('hard is the only place he is named', /his hand/i.test(words.yes) && /He can/i.test(words.head),
         words.yes + ' / ' + words.head);
    } else {
      ok(diff + ' never names him', !/his|he /i.test(words.yes + ' ' + words.head),
         words.yes + ' / ' + words.head);
    }
    await p.evaluate(()=>document.getElementById('so-revive-yes').click());
    await settle();
    const after = await p.evaluate(()=>window.__soInfo());
    ok(diff + ': the price is taken in full', after.lives === 1, (c+1) + ' -> ' + after.lives);
    ok(diff + ': and she is back in play', after.state === 'play', after.state);

    /* exactly the price is not enough to spend it */
    await go(diff, 0, c);
    st = await die();
    ok(diff + ': exactly the price is never offered', st !== 'revive', 'state ' + st);
  }

  await b.close();
  console.log('\n'+pass+' passed, '+fail+' failed');
  process.exit(fail?1:0);
})();
