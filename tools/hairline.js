/* Lists everything that reaches past the book's own edges while a page
   is turning, with its box and its opacity -- for tracking down a stray
   line or a piece of paper hanging in the air outside the covers. */
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
  for(let i=0;i<3;i++){ await p.evaluate(()=>Scrapbook.next()); await p.waitForTimeout(1400); }
  await p.evaluate(()=>Scrapbook.__holdTurn(1,0.52)); await p.waitForTimeout(220);
  // anything that reaches above the book's own top edge
  const out = await p.evaluate(()=>{
    const bk=document.querySelector('.sb-book-outer').getBoundingClientRect();
    const rows=[];
    document.querySelectorAll('#screen-scrapbook *').forEach(n=>{
      const r=n.getBoundingClientRect();
      if(r.width<0.5||r.height<0.5) return;
      if(r.top < bk.top-2 || r.bottom > bk.bottom+2){
        const c=getComputedStyle(n);
        rows.push({cls:(n.className||'').toString().slice(0,34), tag:n.tagName,
          x:+r.x.toFixed(1), y:+r.y.toFixed(1), w:+r.width.toFixed(1), h:+r.height.toFixed(1),
          op:c.opacity, bg:c.backgroundColor.slice(0,24), bs:(c.boxShadow||'none').slice(0,28)});
      }
    });
    return {book:[+bk.x.toFixed(1),+bk.y.toFixed(1),+bk.width.toFixed(1),+bk.height.toFixed(1)], rows:rows.slice(0,25)};
  });
  console.log(JSON.stringify(out,null,1));
  await b.close();
})();
