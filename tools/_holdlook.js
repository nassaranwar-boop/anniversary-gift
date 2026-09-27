// The turn, held open at fixed progress. Scrapbook.__holdTurn exists for
// exactly this: the container's clock barely advances, so a turn cannot be
// caught in flight by waiting for it -- but it can be stopped and looked at.
const { chromium } = require('playwright-core');
const fs = require('fs');
(async () => {
  const b = await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});
  const ctx = await b.newContext({viewport:{width:1200,height:760}});
  await ctx.route('**/*', r => r.request().url().startsWith('http://127.0.0.1') ? r.continue() : r.abort());
  const p = await ctx.newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  const cdp = await ctx.newCDPSession(p);
  await p.goto('http://127.0.0.1:8899/index.html',{waitUntil:'domcontentloaded',timeout:60000});
  await p.waitForTimeout(2200);
  await p.evaluate(()=>{ showScreen('scrapbook'); if (window.startDioramas) startDioramas(); });
  await p.waitForTimeout(1800);
  await p.evaluate(()=>Scrapbook.skipIntro());
  await p.waitForTimeout(6000);
  await p.evaluate(()=>Scrapbook.next());
  await p.waitForFunction(()=>!document.getElementById('screen-scrapbook').classList.contains('sb-turning'),
    {timeout:30000, polling:120}).catch(()=>{});
  await p.waitForTimeout(1200);

  for (const q of [0.25, 0.5, 0.75]) {
    const held = await p.evaluate(v => Scrapbook.__holdTurn(1, v), q);
    await p.waitForTimeout(700);
    const r = await p.evaluate(()=>{
      const cuts=[...document.querySelectorAll('#sb-leaf-a .sb-strip-cut, #sb-leaf-b .sb-strip-cut')]
        .filter(c=>getComputedStyle(c).display!=='none');
      const shades=[...document.querySelectorAll('#sb-leaf-a .sb-strip-shade')];
      const val = (e,k)=>parseFloat(getComputedStyle(e).getPropertyValue(k))||0;
      return {
        cutOpacity: cuts.length? Math.max(...cuts.map(c=>parseFloat(getComputedStyle(c).opacity)||0)) : -1,
        lift: val(document.querySelector('.sb-spine'),'--flip-lift'),
        shadeMax: shades.length? Math.max(...shades.flatMap(s=>['--d0','--d1','--s0','--s1'].map(k=>val(s,k)))) : -1,
        shadeNear: parseFloat(getComputedStyle(document.querySelector('.sb-shade-near')).opacity),
        shadeFar: parseFloat(getComputedStyle(document.querySelector('.sb-shade-far')).opacity),
        videosInLeaves: document.querySelectorAll('#sb-leaf-a video, #sb-leaf-b video').length,
        strips: document.querySelectorAll('#sb-leaf-a .sb-strip').length,
      };
    });
    console.log(`p=${q}  held ${held}  cut ${r.cutOpacity.toFixed(3)}  lift ${r.lift.toFixed(3)}  shading ${r.shadeMax.toFixed(3)}  book-shadow near ${r.shadeNear.toFixed(2)} far ${r.shadeFar.toFixed(2)}  strips ${r.strips}  videos in leaves ${r.videosInLeaves}`);
    const d = await cdp.send('Page.captureScreenshot',{format:'png'});
    fs.writeFileSync('/tmp/shots/hold-'+String(q).replace('.','')+'.png', Buffer.from(d.data,'base64'));
    await p.evaluate(()=>Scrapbook.__releaseTurn());
    await p.waitForTimeout(900);
  }
  console.log('errors:', errs.length? errs.slice(0,3):'none');
  await b.close();
})();
