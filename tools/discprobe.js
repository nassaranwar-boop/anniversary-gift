const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args:['--no-sandbox','--no-proxy-server','--disable-gpu','--use-gl=swiftshader','--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport:{width:430,height:932}, deviceScaleFactor:2, isMobile:true, hasTouch:true });
  await p.route('**/*', r => r.request().url().startsWith('http://127.0.0.1') ? r.continue() : r.abort());
  await p.goto('http://127.0.0.1:8899/index.html',{waitUntil:'domcontentloaded',timeout:60000});
  await p.waitForTimeout(1200);
  await p.evaluate(async()=>{ window.skipBookIntro&&window.skipBookIntro(); showScreen('scrapbook'); Scrapbook.start();
    await new Promise(r=>setTimeout(r,1200)); const i=document.querySelector('.sb-intro'); if(i) i.click();
    await new Promise(r=>setTimeout(r,2000)); });
  for(let i=0;i<10;i++){ await p.evaluate(()=>Scrapbook.next()); await p.waitForTimeout(1200); }
  console.log(await p.evaluate(()=>{
    const d=document.querySelector('.sb-ov-disc'), btn=document.querySelector('.sb-w-ourvideo .sb-vid-play');
    const f=document.querySelector('.sb-w-ourvideo .sb-vid-frame');
    if(!d) return 'no disc';
    const r=d.getBoundingClientRect(), br=btn.getBoundingClientRect(), fr=f.getBoundingClientRect();
    const cs=getComputedStyle(d);
    return { disc:[+r.width.toFixed(1),+r.height.toFixed(1)], button:[+br.width.toFixed(1),+br.height.toFixed(1)],
             frame:[+fr.width.toFixed(1),+fr.height.toFixed(1)],
             css:[cs.width,cs.height,cs.flexShrink,cs.alignSelf,cs.display] };
  }));
  await b.close();
})();
