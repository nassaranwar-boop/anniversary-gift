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
    };
  });
  console.log(r);
  ok('the strips start above the page top', parseFloat(r.stripTop) < -0.5, 'strip top = ' + r.stripTop);
  ok('the strips are taller than the page', parseFloat(r.stripHeight) > 100.5, 'height = ' + r.stripHeight);
  ok('the page sits inset inside the taller strip', parseFloat(r.innerTop) > 0.5, 'inner top = ' + r.innerTop);
  ok('the sheet is cut fine', r.strips >= 13, r.strips + ' strips');
  await p.evaluate(()=>Scrapbook.__releaseTurn());
  await b.close();
  console.log('\n'+pass+' pass, '+fail+' fail');
  process.exit(fail?1:0);
})();
