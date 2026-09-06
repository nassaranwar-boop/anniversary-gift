/* Which pieces of the collage hang over the edge of the page they are on?
   Lists them per page with how far over they go, as a percentage of the
   page, so they can be moved back rather than trimmed. */
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
  const rows = await p.evaluate(()=>{
    /* measure every page, shown or not, by making them all visible for a beat */
    const pages=[...document.querySelectorAll('.sb-spread .sb-page')];
    const out=[];
    pages.forEach((pg,pi)=>{
      const prevD=pg.style.display, prevL=pg.style.left, prevV=pg.style.visibility;
      const shown=document.querySelector('.sb-spread .sb-page.on');
      const wpx=shown? getComputedStyle(shown).width : '401px';
      const prevW=pg.style.width;
      pg.style.display='block'; pg.style.left='0px'; pg.style.visibility='hidden';
      pg.style.width=wpx;
      const pr=pg.getBoundingClientRect();
      [...pg.children].forEach(ch=>{
        const r=ch.getBoundingClientRect();
        if(!r.width||!r.height) return;
        const over={
          left:  +( (pr.left  - r.left ) / pr.width *100).toFixed(1),
          right: +( (r.right  - pr.right) / pr.width *100).toFixed(1),
          top:   +( (pr.top   - r.top  ) / pr.height*100).toFixed(1),
          bottom:+( (r.bottom - pr.bottom)/ pr.height*100).toFixed(1)
        };
        /* Only the gutter side matters: that is the edge with another page
           on the other side of it. The fore edges are trimmed by the book
           itself, at rest and turning alike. Left-hand pages are odd, so
           their gutter is on the right. */
        const gutterSide = (pi % 2 === 1) ? over.right : over.left;
        const worst = gutterSide;
        if (worst > 0.8) out.push({page:pi, cls:ch.className.toString().slice(0,42),
          txt:(ch.textContent||'').trim().slice(0,22), over, worst:+worst.toFixed(1),
          styleLeft:ch.style.left, styleTop:ch.style.top, styleW:ch.style.width});
      });
      pg.style.display=prevD; pg.style.left=prevL; pg.style.visibility=prevV;
      pg.style.width=prevW;
    });
    return out.sort((a,b)=>b.worst-a.worst);
  });
  rows.forEach(r=>console.log(
    `page ${String(r.page).padStart(2)}  over the gutter by ${String(r.worst).padStart(5)}%   ${r.cls.padEnd(30)} left:${r.styleLeft} top:${r.styleTop} w:${r.styleW} ${r.txt?'"'+r.txt+'"':''}`));
  console.log('\n'+rows.length+' pieces cross the gutter onto the facing page');
  await b.close();
})();
