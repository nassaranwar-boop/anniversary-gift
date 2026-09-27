/* WHERE THE GAME STOPS DEAD.

   smooth.js walks the book, the hub and the door into each chapter. It
   has never measured the one thing that actually freezes a phone:
   BUILDING A LEVEL. The apocalypse constructs a whole Three.js world --
   floors, walls, furniture, lights, people -- on the main thread, and
   nothing in this repo has ever put a number on it.

   READ THE NUMBERS PROPERLY, THOUGH. The first run of this reported
   fifty-six seconds for opening Super Ouissy and fifty for the roof,
   and that is not the game -- it was `setSize`, `getContext` and
   `getProgramInfoLog`, which are WebGL driver calls. This container has
   no GPU: SwiftShader compiles every shader and clears every buffer on
   the processor, and those three are where it does it. On her phone the
   driver does that work on the card.

   So what is reported is the time in the SITE'S OWN JavaScript -- the
   frames that belong to a file in this repo -- because that is the part
   that costs the same on her phone as it does here, and the only part
   there is any point in me changing. The driver total is printed beside
   it, clearly labelled, so nobody mistakes one for the other again.
*/
const { chromium } = require('playwright-core');

/* Behind a loading card, and paid once a session -- the textures are
   cached after the first level that uses them, which is why `home` is
   the dear one and everything after it is half that. Set just above
   where it lands now so a regression shows, not as an ideal: 962ms for
   the first level, 400-460 for the rest. */
const BUDGET_BUILD = 1200;
const BUDGET_LIVE  = 120;    /* under her thumb, mid-play */

let pass=0, fail=0;
const ok=(n,c,x)=>{ if(c){pass++;console.log('  ok   '+n+(x?'  '+x:''));}
                    else {fail++;console.log('  FAIL '+n+(x?'  '+x:''));} };

const OURS = /(apocalypse|super-ouissy|racing|night-shift|scrapbook|script|ost|book-scene|rescue)\.js/;
/* self time in files this repo owns, and separately in the graphics
   driver, which here is a software rasteriser doing the card's job */
function split(profile) {
  const nodes = new Map(profile.nodes.map(n=>[n.id,n]));
  const d = profile.timeDeltas||[];
  let ours=0, driver=0, run=0, best=0;
  (profile.samples||[]).forEach((id,i)=>{
    const n=nodes.get(id); const ms=(d[i]||0)/1000;
    if(!n){ run=0; return; }
    const f=n.callFrame, url=f.url||'', name=f.functionName||'';
    if (OURS.test(url)) { ours+=ms; run+=ms; if(run>best)best=run; }
    else {
      if (!url || /^\(/.test(name)) driver+=ms;   /* native: gl, gc, idle */
      run=0;
    }
  });
  return { ours:Math.round(ours), driver:Math.round(driver), longest:Math.round(best) };
}
/* and who was on the stack while it happened */
function hot(profile, n) {
  const nodes=new Map(profile.nodes.map(x=>[x.id,x]));
  const t=new Map(); const d=profile.timeDeltas||[];
  (profile.samples||[]).forEach((id,i)=>{ const nd=nodes.get(id); if(!nd) return;
    const f=nd.callFrame; if(/^\(/.test(f.functionName||'')) return;
    if(!OURS.test(f.url||'')) return;
    const k=(f.functionName||'(anon)')+' @'+(f.url||'').split('/').pop()+':'+f.lineNumber;
    t.set(k,(t.get(k)||0)+(d[i]||0)/1000); });
  return [...t].sort((a,b)=>b[1]-a[1]).slice(0,n||4)
               .map(r=>r[0]+' '+r[1].toFixed(0)+'ms');
}

(async () => {
  const browser = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args:['--no-sandbox','--no-proxy-server','--use-gl=swiftshader','--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport:{width:900,height:600} });
  const errs=[]; page.on('pageerror', e=>errs.push(e.message));
  await page.route('**/*', r=>r.request().url().startsWith('http://127.0.0.1')?r.continue():r.abort());
  await page.goto('http://127.0.0.1:8899/index.html',{waitUntil:'domcontentloaded',timeout:60000});
  await page.waitForTimeout(900);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Profiler.enable');
  await cdp.send('Profiler.setSamplingInterval',{interval:200});

  const measure = async (label, fn, settle) => {
    await cdp.send('Profiler.start');
    await fn();
    await page.waitForTimeout(settle||600);
    const { profile } = await cdp.send('Profiler.stop');
    const sp = split(profile);
    return { label, js: sp.longest, ours: sp.ours, driver: sp.driver, hot: hot(profile) };
  };

  /* ---- the apocalypse builds a world per level ---- */
  await page.evaluate(()=>window.loadChapter&&window.loadChapter('apoc'));
  await page.waitForFunction(()=>!!window.Apocalypse,null,{timeout:40000});
  await page.evaluate(()=>{ showScreen('apoc'); if(!window.__apEnter) Apocalypse.start(); });
  await page.waitForFunction(()=>typeof window.__apEnter==='function',null,{timeout:60000});
  await page.evaluate(()=>window.__apLoop(false));

  console.log('\n— building a level —');
  const names=['home','streets','hospital','escape','gates'];
  for (let i=0;i<names.length;i++){
    const r = await measure(names[i], ()=>page.evaluate(n=>window.__apEnter(n), i), 900);
    console.log('  ' + names[i].padEnd(10) + String(r.ours).padStart(5) + 'ms ours   (' +
                r.driver + 'ms in the software rasteriser)');
    if (r.hot.length) console.log('      ' + r.hot.join('\n      '));
    ok('building ' + names[i] + ' does not freeze her', r.ours <= BUDGET_BUILD, r.ours + 'ms of our own');
  }

  /* ---- and the cuts, which build a whole scene of their own ---- */
  console.log('\n— a cut —');
  for (const [n, call] of [['the drive','__apDrive'], ['the campfire','__apCampfire'],
                           ['the roof','__apRoof']]) {
    const r = await measure(n, ()=>page.evaluate(c=>{ window.__apClear(); window[c](); }, call), 900);
    console.log('  ' + n.padEnd(14) + String(r.ours).padStart(5) + 'ms ours   (' +
                r.driver + 'ms in the software rasteriser)');
    if (r.hot.length) console.log('      ' + r.hot.join('\n      '));
    ok('starting ' + n + ' does not freeze her', r.ours <= BUDGET_BUILD, r.ours + 'ms of our own');
  }

  /* ---- the other chapters' doors ---- */
  console.log('\n— the other chapters —');
  for (const [n, k, go] of [
    ['Super Ouissy','ouissy',()=>{showScreen('ouissy'); SuperOuissy.start();}],
    ['the race','race',()=>{showScreen('race'); SuperOuissyRace.start();}],
    ['the night shift','nightshift',()=>{showScreen('nightshift'); OuissysNightShift.start();}]]) {
    await page.evaluate(c=>window.loadChapter&&window.loadChapter(c), k);
    await page.waitForTimeout(1200);
    const r = await measure(n, ()=>page.evaluate(go), 1600);
    console.log('  ' + n.padEnd(16) + String(r.ours).padStart(5) + 'ms ours   (' +
                r.driver + 'ms in the software rasteriser)');
    if (r.hot.length) console.log('      ' + r.hot.join('\n      '));
    ok('opening ' + n + ' does not freeze her', r.ours <= BUDGET_BUILD, r.ours + 'ms of our own');
  }

  ok('nothing threw', errs.length===0, errs.slice(0,2).join(' | '));
  console.log('');
  console.log(fail? pass+' passed, '+fail+' FAILED' : 'all '+pass+' checks passed');
  await browser.close();
  process.exit(fail?1:0);
})();
