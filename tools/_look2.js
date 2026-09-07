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
  // the hub first
  await p.evaluate(()=>showScreen('hub'));
  await p.waitForTimeout(1600);
  await shot('hub');
  // the book
  await p.evaluate(()=>{ showScreen('scrapbook'); if (window.startDioramas) startDioramas(); });
  await p.waitForTimeout(2000);
  await p.evaluate(()=>Scrapbook.skipIntro());
  let last=-1, same=0;
  for (let i=0;i<40 && same<4;i++){ await p.waitForTimeout(600);
    const n = await p.evaluate(()=>document.querySelectorAll('#sb-spread .sb-page').length);
    if (n===last) same++; else {same=0; last=n;} }
  await shot('cover');
  for (const v of [1,4,5]) {
    for (let k=0;k<(v===1?1:(v===4?3:1));k++){
      await p.evaluate(()=>Scrapbook.next());
      await p.waitForFunction(()=>!document.getElementById('screen-scrapbook').classList.contains('sb-turning'),
        {timeout:60000, polling:120}).catch(()=>{});
      await p.waitForTimeout(900);
    }
    await shot('spread-'+v);
  }
  await p.evaluate(()=>{const x=document.getElementById('sb-extras-btn'); if(x) x.click();});
  await p.waitForTimeout(2600);
  await shot('drawer');
  console.log('errors:', errs.length? errs.slice(0,3): 'none');
  await b.close();
})();
