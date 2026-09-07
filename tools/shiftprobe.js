/* The book's boxes at rest and at a chosen point in a turn, side by side:
   the spread, the leaf, a strip and the page inside it. This is what
   showed the lifting page was not the size of the page it replaced.
     node tools/shiftprobe.js <progress> */
const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args:['--no-sandbox','--no-proxy-server','--disable-gpu','--use-gl=swiftshader','--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport:{width:1100,height:820}, deviceScaleFactor:1 });
  await p.route('**/*', r => r.request().url().startsWith('http://127.0.0.1') ? r.continue() : r.abort());
  await p.goto('http://127.0.0.1:8899/index.html',{waitUntil:'domcontentloaded',timeout:60000});
  await p.waitForTimeout(1500);
  await p.evaluate(async()=>{ window.skipBookIntro&&window.skipBookIntro(); showScreen('scrapbook'); Scrapbook.start();
    await new Promise(r=>setTimeout(r,1200)); const i=document.querySelector('.sb-intro'); if(i) i.click();
    await new Promise(r=>setTimeout(r,2400)); });
  await p.evaluate(()=>Scrapbook.next()); await p.waitForTimeout(1600);
  const rect = () => p.evaluate(()=>{
    const r = n => { if(!n) return null; const b=n.getBoundingClientRect();
      return [b.x,b.y,b.width,b.height].map(v=>+v.toFixed(2)); };
    const leaf = document.querySelector('.sb-leaf');
    const strips = [...document.querySelectorAll('.sb-strip')];
    return {
      book: r(document.querySelector('.sb-book')),
      spread: r(document.querySelector('.sb-spread')),
      rightPage: r(document.querySelector('.sb-spread .sb-page.right, .sb-spread .sb-page:last-child')),
      leaf: r(leaf),
      leafCls: leaf? leaf.className : null,
      leafXf: leaf? getComputedStyle(leaf).transform : null,
      bookCls: document.querySelector('.sb-book').className,
      outerCls: document.querySelector('.sb-book-outer').className,
      lift: getComputedStyle(document.querySelector('.sb-book-outer')).getPropertyValue('--flip-lift'),
      s0: r(strips[0]), sN: r(strips[strips.length-1]), n: strips.length,
      inner0: strips[0]? r(strips[0].querySelector('.sb-strip-inner')) : null,
      inner0css: strips[0]? (function(i){const c=getComputedStyle(i);
        return {w:c.width,h:c.height,t:c.top,l:c.left,r:c.right};})(strips[0].querySelector('.sb-strip-inner')) : null,
      strip0css: strips[0]? (function(c){return {w:c.width,h:c.height,t:c.top,l:c.left};})(getComputedStyle(strips[0])) : null,
      pageInLeaf: strips[0]? r(strips[0].querySelector('.sb-page')) : null,
      pageAtRest: r(document.querySelector('.sb-spread .sb-page.on')),
      opac: (function(){
        const out=[];
        document.querySelectorAll('.sb-leaf.on, .sb-leaf.on .sb-strip, .sb-leaf.on .sb-strip-inner, .sb-leaf.on .sb-page').forEach((n,i)=>{
          if(i>4) return; const c=getComputedStyle(n);
          out.push({c:n.className.toString().slice(0,40), op:c.opacity, bg:c.backgroundColor,
                    bgi:(c.backgroundImage||'').slice(0,28), mix:c.mixBlendMode, iso:c.isolation});
        });
        return out;
      })()
    };
  });
  console.log('REST  ', JSON.stringify(await rect(), null, 1));
  const HOLD=Number(process.argv[2]||0.0015);
  await p.evaluate((v)=>Scrapbook.__holdTurn(1,v), HOLD); await p.waitForTimeout(250);
  console.log('FLAT  ', JSON.stringify(await rect(), null, 1));
  await b.close();
})();
