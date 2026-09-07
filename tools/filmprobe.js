const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args:['--no-sandbox','--no-proxy-server','--disable-gpu','--use-gl=swiftshader','--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport:{width:900,height:760} });
  await p.route('**/*', r => r.request().url().startsWith('http://127.0.0.1') ? r.continue() : r.abort());
  await p.goto('http://127.0.0.1:8899/index.html',{waitUntil:'domcontentloaded',timeout:60000});
  await p.waitForTimeout(1500);
  await p.evaluate(async()=>{ window.skipBookIntro&&window.skipBookIntro(); showScreen('scrapbook'); Scrapbook.start();
    await new Promise(r=>setTimeout(r,1200)); const i=document.querySelector('.sb-intro'); if(i) i.click();
    await new Promise(r=>setTimeout(r,2400)); });
  const out = await p.evaluate(()=>{
    const pages=[...document.querySelectorAll('.sb-spread .sb-page')];
    const shown=document.querySelector('.sb-spread .sb-page.on');
    const wpx=shown?getComputedStyle(shown).width:'401px';
    let r=null;
    pages.forEach(pg=>{
      const f=pg.querySelector('.sb-film'); if(!f||r) return;
      const d=pg.style.display,l=pg.style.left,v=pg.style.visibility,w=pg.style.width;
      pg.style.display='block'; pg.style.left='0'; pg.style.visibility='hidden'; pg.style.width=wpx;
      const box=n=>{const q=n.getBoundingClientRect(); const c=getComputedStyle(n);
        return {w:+q.width.toFixed(1), h:+q.height.toFixed(1), pos:c.position, disp:c.display};};
      const hole=f.querySelector('.sb-film-holes i');
      r={ film:box(f), holes:box(f.querySelector('.sb-film-holes')),
          hole: hole?box(hole):null, holeCount:f.querySelectorAll('.sb-film-holes.a i').length,
          cells:box(f.querySelector('.sb-film-cells')),
          cell:box(f.querySelector('.sb-film-cell')),
          photo:box(f.querySelector('.sb-photo')),
          filmPos:getComputedStyle(f).position };
      pg.style.display=d; pg.style.left=l; pg.style.visibility=v; pg.style.width=w;
    });
    return r;
  });
  console.log(JSON.stringify(out,null,1));
  await b.close();
})();
