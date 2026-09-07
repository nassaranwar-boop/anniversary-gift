const { chromium } = require('playwright-core');
const fs = require('fs');
(async () => {
  const b = await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});
  const ctx = await b.newContext({viewport:{width:1400,height:900}});
  await ctx.route('**/*', r => r.request().url().startsWith('http://127.0.0.1') ? r.continue() : r.abort());
  const p = await ctx.newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  const cdp = await ctx.newCDPSession(p);
  const shot = async n => { const d = await cdp.send('Page.captureScreenshot',{format:'png'});
    fs.writeFileSync('/tmp/shots/'+n+'.png', Buffer.from(d.data,'base64')); console.log('shot',n); };
  await p.goto('http://127.0.0.1:8899/index.html',{waitUntil:'domcontentloaded',timeout:60000});
  await p.waitForTimeout(2500);
  await p.evaluate(()=>{ showScreen('scrapbook'); if (window.startDioramas) startDioramas(); });
  await p.waitForTimeout(2000);
  await p.evaluate(()=>Scrapbook.skipIntro());
  let last=-1, same=0;
  for (let i=0;i<40 && same<4;i++){ await p.waitForTimeout(600);
    const n = await p.evaluate(()=>document.querySelectorAll('#sb-spread .sb-page').length);
    if (n===last) same++; else {same=0; last=n;} }
  await p.evaluate(()=>Scrapbook.next());
  await p.waitForTimeout(1600);
  // every photo on this spread, report title+text
  const rows = await p.evaluate(()=>{
    const out=[];
    document.querySelectorAll('#sb-spread .sb-photo').forEach((el,i)=>{ out.push(i); });
    return out.length;
  });
  console.log('photos on spread', rows);
  await p.evaluate(()=>{ const a=document.querySelectorAll('#sb-spread .sb-photo'); if(a[3]) a[3].click(); });
  await p.waitForTimeout(1400);
  await p.waitForFunction(()=>{const i=document.querySelector('#sb-lightbox .sb-lb-frame img');return i&&i.complete&&i.naturalWidth>0;},{timeout:20000}).catch(e=>console.log('img never loaded'));
  await p.waitForTimeout(500);
  await shot('lightbox');
  const t = await p.evaluate(()=>{
    const b=document.getElementById('sb-lightbox');
    return {title:b.querySelector('.sb-lb-title').textContent, text:b.querySelector('.sb-lb-text').textContent};
  });
  console.log(JSON.stringify(t,null,1));
  console.log('errors:', errs.length? errs.slice(0,3): 'none');
  await b.close();
})();
