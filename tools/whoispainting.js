/* What is stacked at a given point on the book while a page is turning?
   Prints every element under the point, outermost last.
     node tools/whoispainting.js <spreads to skip> <progress> <x frac> <y frac> */
const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args:['--no-sandbox','--no-proxy-server','--disable-gpu','--use-gl=swiftshader','--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport:{width:1100,height:820} });
  await p.route('**/*', r => r.request().url().startsWith('http://127.0.0.1') ? r.continue() : r.abort());
  await p.goto('http://127.0.0.1:8899/index.html',{waitUntil:'domcontentloaded',timeout:60000});
  await p.waitForTimeout(1500);
  await p.evaluate(async()=>{ window.skipBookIntro&&window.skipBookIntro(); showScreen('scrapbook'); Scrapbook.start();
    await new Promise(r=>setTimeout(r,1200)); const i=document.querySelector('.sb-intro'); if(i) i.click();
    await new Promise(r=>setTimeout(r,2400)); });
  const skip=Number(process.argv[2]||3), hold=Number(process.argv[3]||0.05);
  const fx=Number(process.argv[4]||0.44), fy=Number(process.argv[5]||0.4);
  for(let i=0;i<skip;i++){ await p.evaluate(()=>Scrapbook.next()); await p.waitForTimeout(1400); }
  await p.evaluate((v)=>Scrapbook.__holdTurn(1,v), hold); await p.waitForTimeout(260);
  const out = await p.evaluate(([fx,fy])=>{
    const bk=document.querySelector('.sb-book-outer').getBoundingClientRect();
    const x=bk.x+bk.width*fx, y=bk.y+bk.height*fy;
    const els=document.elementsFromPoint(x,y).slice(0,10).map(n=>{
      const c=getComputedStyle(n), r=n.getBoundingClientRect();
      return {cls:(n.className||'').toString().slice(0,40)||n.tagName,
        z:c.zIndex, op:c.opacity, bg:c.backgroundColor,
        bgi:(c.backgroundImage||'none').slice(0,22),
        box:[+r.x.toFixed(1),+r.y.toFixed(1),+r.width.toFixed(1),+r.height.toFixed(1)]};
    });
    /* and every strip of the leaf that is on, with where it lands */
    const leaf=document.querySelector('.sb-leaf.on');
    const strips=[...leaf.children].map((s,i)=>{
      const r=s.getBoundingClientRect();
      const inn=s.querySelector('.sb-strip-inner');
      const ir=inn? inn.getBoundingClientRect() : null;
      return {i, x:+r.x.toFixed(1), w:+r.width.toFixed(1),
        innerX: ir? +ir.x.toFixed(1):null, innerW: ir? +ir.width.toFixed(1):null,
        shadeW: (()=>{const sh=s.querySelector('.sb-strip-shade'); return sh? getComputedStyle(sh).width : null;})(),
        shadeL: (()=>{const sh=s.querySelector('.sb-strip-shade'); return sh? getComputedStyle(sh).left : null;})()};
    });
    return {point:[+x.toFixed(1),+y.toFixed(1)], book:[+bk.x.toFixed(1),+bk.width.toFixed(1)],
            gutter:+(bk.x+bk.width/2).toFixed(1), els, strips:strips.slice(0,6)};
  }, [fx,fy]);
  console.log(JSON.stringify(out,null,1));
  await b.close();
})();
