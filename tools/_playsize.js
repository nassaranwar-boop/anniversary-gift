// Is the clip's play control actually there, and how big?
const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});
  for (const [name,w,h] of [['desktop',1400,900],['phone',390,844]]) {
    const ctx = await b.newContext({viewport:{width:w,height:h}, deviceScaleFactor:2});
    await ctx.route('**/*', r => r.request().url().startsWith('http://127.0.0.1') ? r.continue() : r.abort());
    const p = await ctx.newPage();
    await p.goto('http://127.0.0.1:8899/index.html',{waitUntil:'domcontentloaded',timeout:60000});
    await p.waitForTimeout(2200);
    await p.evaluate(()=>{ showScreen('scrapbook'); if (window.startDioramas) startDioramas(); });
    await p.waitForTimeout(1800);
    await p.evaluate(()=>Scrapbook.skipIntro());
    await p.waitForTimeout(6000);
    // walk to the last spread, where the clip lives
    for (let i=0;i<14;i++){
      await p.evaluate(()=>Scrapbook.next());
      await p.waitForFunction(()=>!document.getElementById('screen-scrapbook').classList.contains('sb-turning'),
        {timeout:30000, polling:120}).catch(()=>{});
      /* Every page lives in the spread all the time; only the one or two
         she is looking at wear a slot class and have a layout box at all.
         Querying the card globally finds it on a hidden page and measures
         0x0, which is what it means to have no box -- not a broken button. */
      const done = await p.evaluate(()=>!!document.querySelector(
        '#sb-spread .sb-page.leftpage .sb-w-ourvideo, #sb-spread .sb-page.rightpage .sb-w-ourvideo, #sb-spread .sb-page.solo .sb-w-ourvideo'));
      if (done) break;
    }
    await p.waitForTimeout(1500);
    const r = await p.evaluate(()=>{
      const SHOWN = '#sb-spread .sb-page.leftpage, #sb-spread .sb-page.rightpage, #sb-spread .sb-page.solo';
      const card = document.querySelector(SHOWN.split(', ').map(s=>s+' .sb-w-ourvideo').join(', '));
      if (!card) return { btn:'card not on the shown spread' };
      const btn = card.querySelector('.sb-vid-play');
      const ring = card.querySelector('.sb-ov-ring');
      const disc = card.querySelector('.sb-ov-disc-img');
      const word = card.querySelector('.sb-ov-word');
      const box = e => { if(!e) return 'missing'; const b=e.getBoundingClientRect();
        return Math.round(b.width)+'x'+Math.round(b.height); };
      return { btn: box(btn), ring: box(ring), word: box(word),
               discSrc: disc ? (disc.src ? (disc.complete && disc.naturalWidth ? 'loaded '+disc.naturalWidth+'px' : 'set, not decoded') : 'NO SRC') : 'missing',
               btnOpacity: btn ? getComputedStyle(btn).opacity : '-' };
    });
    console.log(`${name.padEnd(8)} button ${r.btn}  ring ${r.ring}  word ${r.word}  disc ${r.discSrc}  opacity ${r.btnOpacity}`);
    await ctx.close();
  }
  await b.close();
})();
