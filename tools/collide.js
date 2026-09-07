/* WHAT IS SITTING ON TOP OF THE WORDS?

   Three pages have text you cannot finish reading because a photograph
   landed on it. This measures it rather than leaving it to the eye: for
   every text piece on every page, how much of its box is covered by a
   later sibling (later means drawn on top), and by which one. */
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
    await new Promise(r=>setTimeout(r,2600)); });
  const rows = await p.evaluate(()=>{
    const TEXT = ['sb-note','sb-script','sb-curve','sb-curvetext','sb-label','sb-label2',
                  'sb-letterpage','sb-id','sb-back-card','sb-typecol','sb-bigtype'];
    const isText = n => TEXT.some(c => n.classList.contains(c));
    const out=[];
    const pages=[...document.querySelectorAll('.sb-spread .sb-page')];
    const shown=document.querySelector('.sb-spread .sb-page.on');
    const wpx=shown?getComputedStyle(shown).width:'401px';
    pages.forEach((pg,pi)=>{
      const d=pg.style.display,l=pg.style.left,v=pg.style.visibility,w=pg.style.width;
      pg.style.display='block'; pg.style.left='0px'; pg.style.visibility='hidden'; pg.style.width=wpx;
      const kids=[...pg.children];
      kids.forEach((n,i)=>{
        if(!isText(n)) return;
        const r=n.getBoundingClientRect();
        if(!r.width||!r.height) return;
        const area=r.width*r.height;
        kids.slice(i+1).forEach(o=>{
          const q=o.getBoundingClientRect();
          if(!q.width||!q.height) return;
          const ow=Math.max(0,Math.min(r.right,q.right)-Math.max(r.left,q.left));
          const oh=Math.max(0,Math.min(r.bottom,q.bottom)-Math.max(r.top,q.top));
          const cover=(ow*oh)/area*100;
          if(cover>4) out.push({page:pi, text:n.className.split(' ')[0],
            words:(n.textContent||'').trim().replace(/\s+/g,' ').slice(0,34),
            by:o.className.split(' ').slice(0,2).join('.'), cover:+cover.toFixed(1)});
        });
      });
      pg.style.display=d; pg.style.left=l; pg.style.visibility=v; pg.style.width=w;
    });
    return out.sort((a,b)=>b.cover-a.cover);
  });
  rows.forEach(r=>console.log(
    `page ${String(r.page).padStart(2)}  ${String(r.cover).padStart(5)}% of "${r.words}" is under ${r.by}`));
  console.log('\n'+rows.length+' text pieces are covered by something drawn after them');
  await b.close();
})();
