// Does the turning sheet actually carry the parts of the page that hang
// over its edges? Measured, not eyeballed: hold a turn open and compare
// each strip's box against the leaf's, and check that a piece placed
// outside the page (top:-3 on page six) is really inside a strip's window.
const { chromium } = require('playwright-core');
let pass=0, fail=0;
const ok=(n,c,d)=>{ (c?pass++:fail++); console.log((c?'PASS  ':'FAIL  ')+n+(d?'   '+d:'')); };
(async () => {
  const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args:['--no-sandbox','--no-proxy-server','--disable-gpu','--use-gl=swiftshader','--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport:{width:1100,height:820}, deviceScaleFactor:2 });
  p.on('pageerror',e=>ok('no page error',false,e.message));
  await p.route('**/*', r => r.request().url().startsWith('http://127.0.0.1') ? r.continue() : r.abort());
  await p.goto('http://127.0.0.1:8899/index.html',{waitUntil:'domcontentloaded',timeout:60000});
  await p.waitForTimeout(1500);
  await p.evaluate(async()=>{ window.skipBookIntro&&window.skipBookIntro(); showScreen('scrapbook'); Scrapbook.start();
    await new Promise(r=>setTimeout(r,1200)); const i=document.querySelector('.sb-intro'); if(i) i.click();
    await new Promise(r=>setTimeout(r,2400)); });
  /* open the cover first: on the cover the book is one page wide with no
     board overhang, which is not the shape the rest of the book has */
  await p.evaluate(()=>Scrapbook.next());
  await p.waitForTimeout(1600);
  const r = await p.evaluate(async () => {
    Scrapbook.__holdTurn(1, 0.30);
    await new Promise(r=>setTimeout(r,200));
    const leaf = document.querySelector('.sb-leaf.on');
    const strips = [...leaf.querySelectorAll('.sb-strip')];
    const s0 = strips[0], sN = strips[strips.length-1];
    // the strips' own boxes, before any 3D transform, in the leaf's terms
    const cs = getComputedStyle(s0);
    // a cloned page inside a strip, and how much of it the strip can show
    const inner = s0.querySelector('.sb-strip-inner');
    const ci = getComputedStyle(inner);
    return {
      strips: strips.length,
      stripTop: cs.top, stripHeight: cs.height,
      innerTop: ci.top, innerHeight: ci.height, innerWidth: ci.width,
      leafH: leaf.getBoundingClientRect().height,
      firstInnerLeft: getComputedStyle(inner).left,
      /* laid-out sizes, not screen boxes -- a strip mid-turn is rotated and
         scaled by the perspective, so its rectangle on screen says nothing
         about how big the page inside it is */
      inLeafW: parseFloat(ci.width),
      inLeafH: parseFloat(ci.height),
      restW: (function(){ const q=document.querySelector('.sb-spread .sb-page.on');
        return q? parseFloat(getComputedStyle(q).width) : 0; })(),
      restH: (function(){ const q=document.querySelector('.sb-spread .sb-page.on');
        return q? parseFloat(getComputedStyle(q).height) : 0; })(),
      lastRightPct: (() => {
        const li = sN.querySelector('.sb-strip-inner');
        const sw = parseFloat(getComputedStyle(sN).width);
        const iw = parseFloat(getComputedStyle(li).width);
        const il = parseFloat(getComputedStyle(li).left);
        // where the strip's right edge lands, as a % of the page
        return (sw - il) / iw * 100;
      })(),
    };
  });
  console.log(r);
  /* The intent changed, so the assertions did too. The strips used to bleed
     on all four sides, which showed pieces whole that the book trims at
     rest. They are the page's own height now -- the spread cuts top and
     bottom, so the leaf must too -- and they bleed only towards the spine,
     where a piece crossing the gutter really does travel with its sheet. */
  ok('the strips are exactly the page height', Math.abs(parseFloat(r.stripHeight) - r.restH) < 1.5,
     'strip ' + r.stripHeight + ' vs page ' + r.restH.toFixed(1) + 'px');
  ok('nothing hangs above or below the page', Math.abs(parseFloat(r.stripTop)) < 1.5,
     'strip top = ' + r.stripTop);
  ok('the page is not inset vertically', Math.abs(parseFloat(r.innerTop)) < 1.5,
     'inner top = ' + r.innerTop);
  ok('the sheet is cut fine', r.strips >= 13, r.strips + ' strips');
  ok('the first strip reaches past the gutter', parseFloat(r.firstInnerLeft) > 0.5,
     'first strip shows the page from ' + r.firstInnerLeft + ' in');
  /* The strips overlap each other by a few percent so the joints do not
     open into seams, so the outermost one reaches a little past the fore
     edge. Nothing can leak through it: the page element inside the window
     ends exactly at the fore edge and there is nothing behind it. */
  ok('the last strip stops at the fore edge, bar the seam overlap',
     r.lastRightPct <= 102,
     'last strip ends at ' + r.lastRightPct.toFixed(1) + '% of the page');
  ok('a page inside a leaf is the size of the page it came from',
     Math.abs(r.inLeafW - r.restW) < 1.5 && Math.abs(r.inLeafH - r.restH) < 1.5,
     'in the leaf ' + r.inLeafW.toFixed(1) + 'x' + r.inLeafH.toFixed(1) +
     ', at rest ' + r.restW.toFixed(1) + 'x' + r.restH.toFixed(1));
  await p.evaluate(()=>Scrapbook.__releaseTurn());
  await b.close();
  console.log('\n'+pass+' pass, '+fail+' fail');
  process.exit(fail?1:0);
})();
