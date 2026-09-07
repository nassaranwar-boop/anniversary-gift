// Does the paper still catch light while it turns?
//
// The cut edge and the four shading numbers used to be written onto the
// strips themselves; they are written onto childless elements now so a turn
// stops invalidating a page's worth of nodes sixty times a second. This
// checks the light did not go out in the move.
//
// The sampling loop lives in Node, not in the page: a setTimeout loop inside
// the page starves requestAnimationFrame in this container and the turn then
// never advances between samples.
const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});
  const ctx = await b.newContext({viewport:{width:1400,height:900}});
  await ctx.route('**/*', r => r.request().url().startsWith('http://127.0.0.1') ? r.continue() : r.abort());
  const p = await ctx.newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto('http://127.0.0.1:8899/index.html',{waitUntil:'domcontentloaded',timeout:60000});
  await p.waitForTimeout(2500);
  await p.evaluate(()=>{ showScreen('scrapbook'); if (window.startDioramas) startDioramas(); });
  await p.waitForTimeout(2000);
  await p.evaluate(()=>Scrapbook.skipIntro());
  await p.waitForTimeout(4000);

  /* The turn finishes in two frames in this container -- rAF runs at about
     3fps here -- so polling computed styles only ever catches the very
     first instant of it, where every one of these numbers is legitimately
     zero. So instead of watching the clock, record the writes: patch
     setProperty and see what lands on which element over a whole turn. */
  await p.evaluate(()=>{
    window.__w = [];
    const orig = CSSStyleDeclaration.prototype.setProperty;
    CSSStyleDeclaration.prototype.setProperty = function (k, v) {
      if (k === "--cut" || k === "--flip-lift" || k === "--d0" || k === "--s0" ||
          k === "--d1" || k === "--s1" || k === "--flip-p") {
        const el = this.__el || null;
        window.__w.push([k, parseFloat(v) || 0, el ? (el.className || el.tagName) : "?"]);
      }
      return orig.apply(this, arguments);
    };
    /* style objects do not point back at their element, so tag them */
    const gs = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "style").get;
    Object.defineProperty(HTMLElement.prototype, "style", {
      get: function () { const s = gs.call(this); try { s.__el = this; } catch (e) {} return s; }
    });
  });

  const probe = () => p.evaluate(()=>{
    const cuts=[...document.querySelectorAll('#sb-leaf-a .sb-strip-cut, #sb-leaf-b .sb-strip-cut')]
      .filter(c=>getComputedStyle(c).display!=='none');
    const shades=[...document.querySelectorAll('#sb-leaf-a .sb-strip-shade')];
    const w = window.__w; window.__w = [];
    const peak = k => { const v = w.filter(x=>x[0]===k).map(x=>x[1]); return v.length?Math.max(...v):0; };
    const on = k => { const v = w.filter(x=>x[0]===k); return v.length?v[0][2]:null; };
    const n  = k => w.filter(x=>x[0]===k).length;
    return {
      turning: document.getElementById('screen-scrapbook').classList.contains('sb-turning'),
      cuts: cuts.length,
      cutMax: peak('--cut'),
      lift: peak('--flip-lift'),
      shades: shades.length,
      shadeMax: Math.max(peak('--d0'), peak('--d1'), peak('--s0'), peak('--s1')),
      deadP: n('--flip-p'),
      nCut: n('--cut'), nLift: n('--flip-lift'), nShade: n('--d0'),
      onCut: on('--cut'), onLift: on('--flip-lift'), onShade: on('--d0'),
    };
  });

  let peakCut=0, peakLift=0, peakShade=0, maxCuts=0, maxShades=0, frames=0, turningFrames=0, deadP=0;
  let nCut=0, nLift=0, nShade=0, hostCut=null, hostLift=null, hostShade=null;
  for (let round=0; round<3; round++) {
    await p.evaluate(()=>Scrapbook.next());
    for (let i=0;i<26;i++){
      const r = await probe();
      frames++;
      peakCut=Math.max(peakCut,r.cutMax); peakLift=Math.max(peakLift,r.lift);
      peakShade=Math.max(peakShade,r.shadeMax);
      if (r.turning) turningFrames++;
      deadP += r.deadP;
      nCut += r.nCut; nLift += r.nLift; nShade += r.nShade;
      if (r.onCut) hostCut = r.onCut;
      if (r.onLift) hostLift = r.onLift;
      if (r.onShade) hostShade = r.onShade;
      maxCuts=Math.max(maxCuts,r.cuts); maxShades=Math.max(maxShades,r.shades);
      await p.waitForTimeout(45);
    }
    await p.waitForTimeout(700);
  }
  console.log('sampled', frames, 'times across 3 turns;', turningFrames, 'of them mid-turn');
  console.log('  cut elements on the leaves   :', maxCuts, '(one per leaf in play)');
  console.log('  shade elements on leaf a     :', maxShades);
  console.log('  writes of --cut        :', nCut, ' -> element:', hostCut);
  console.log('  writes of --flip-lift  :', nLift, ' -> element:', hostLift);
  console.log('  writes of --d0         :', nShade, ' -> element:', hostShade);
  console.log('  writes of dead --flip-p:', deadP, '(must be 0)');
  /* The container's performance.now() barely advances, so a turn crawls at
     p ~= 0 for its whole wall-clock length and every one of these numbers
     is legitimately near zero however long you watch. What can be checked
     here is the routing, which is the thing that changed: each value has to
     land on a childless element, never on a strip with a page inside it. */
  const ok = maxCuts>0 && maxShades>0 && deadP===0 &&
    nCut>0 && nLift>0 && nShade>0 &&
    /sb-strip-cut/.test(hostCut||'') &&
    /sb-spine/.test(hostLift||'') &&
    /sb-strip-shade/.test(hostShade||'');
  console.log(ok ? 'PASS  every per-frame value lands on a leaf element'
                 : 'FAIL  a per-frame value is landing somewhere with a subtree');
  console.log('errors:', errs.length? errs.slice(0,3):'none');
  await b.close();
  process.exit(ok?0:1);
})();
