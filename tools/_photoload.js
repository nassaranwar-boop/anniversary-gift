// How many bytes of photograph does the book pull, and how long before the
// first spread has all of its prints?
const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});
  const ctx = await b.newContext({viewport:{width:1400,height:900}, deviceScaleFactor:2});
  let bytes=0, files=0, full=0;
  ctx.on('response', async r => {
    const u=r.url();
    if (/\/assets\/photo-/.test(u)) {
      files++; if (!/\.page\./.test(u)) full++;
      try { bytes += (await r.body()).length; } catch(e){}
    }
  });
  await ctx.route('**/*', r => r.request().url().startsWith('http://127.0.0.1') ? r.continue() : r.abort());
  const p = await ctx.newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto('http://127.0.0.1:8899/index.html',{waitUntil:'domcontentloaded',timeout:60000});
  await p.waitForTimeout(2200);
  await p.evaluate(()=>{ showScreen('scrapbook'); if (window.startDioramas) startDioramas(); });
  await p.waitForTimeout(1600);
  await p.evaluate(()=>Scrapbook.skipIntro());
  await p.waitForTimeout(3000);
  // She reads the first spread for a moment. That is when the idle sweep
  // is meant to pull the rest of the book into the cache behind her.
  const t0 = Date.now();
  await p.waitForTimeout(9000);
  console.log('after 9s sitting on the first spread:');
  console.log('  photo requests      :', files, '  bytes', Math.round(bytes/1024) + 'KB');

  // now walk it fast and count how often a print is still empty
  let blanks=0, seen=0;
  for (let i=0;i<16;i++){
    const r = await p.evaluate(()=>{
      let b=0,s=0;
      document.querySelectorAll('#sb-spread .sb-photo-inner img').forEach(im=>{ s++; if(!im.complete||!im.naturalWidth) b++; });
      return [b,s];
    });
    blanks+=r[0]; seen+=r[1];
    await p.evaluate(()=>Scrapbook.next());
    await p.waitForTimeout(650);
  }
  console.log('then walking the whole book at speed:');
  console.log('  photo requests      :', files, '(' + full + ' of them the full file)');
  console.log('  photo bytes         :', Math.round(bytes/1024) + 'KB');
  console.log('  prints seen         :', seen);
  console.log('  still blank on turn :', blanks, '(' + Math.round(blanks/seen*100) + '%)');
  // and the lightbox: small first, then the full one
  await p.evaluate(()=>{const a=document.querySelectorAll('#sb-spread .sb-photo'); if(a[0]) a[0].click();});
  await p.waitForTimeout(300);
  const early = await p.evaluate(()=>{const i=document.querySelector('#sb-lightbox .sb-lb-frame img'); return i? {w:i.naturalWidth, src:i.currentSrc.split('/').pop()} : null;});
  await p.waitForTimeout(2500);
  const late = await p.evaluate(()=>{const i=document.querySelector('#sb-lightbox .sb-lb-frame img'); return i? {w:i.naturalWidth, src:i.currentSrc.split('/').pop()} : null;});
  console.log('  lightbox at 0.3s    :', JSON.stringify(early));
  console.log('  lightbox at 2.8s    :', JSON.stringify(late));
  console.log('errors:', errs.length? errs.slice(0,3):'none');
  await b.close();
})();
