/* Which layer is painting a thing? Shoots the same moment of a turn three
   ways: as it is, with the leaves hidden, and with the spread hidden.
     node tools/whodunnit.js <spreads to skip> <progress> */
const { chromium } = require('playwright-core'); const fs=require('fs');
(async () => {
  const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args:['--no-sandbox','--no-proxy-server','--disable-gpu','--use-gl=swiftshader','--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport:{width:1100,height:820}, deviceScaleFactor:2 });
  await p.route('**/*', r => r.request().url().startsWith('http://127.0.0.1') ? r.continue() : r.abort());
  await p.goto('http://127.0.0.1:8899/index.html',{waitUntil:'domcontentloaded',timeout:60000});
  await p.waitForTimeout(1500);
  await p.evaluate(async()=>{ window.skipBookIntro&&window.skipBookIntro(); showScreen('scrapbook'); Scrapbook.start();
    await new Promise(r=>setTimeout(r,1200)); const i=document.querySelector('.sb-intro'); if(i) i.click();
    await new Promise(r=>setTimeout(r,2400)); });
  const skip=Number(process.argv[2]||3), hold=Number(process.argv[3]||0.05);
  for(let i=0;i<skip;i++){ await p.evaluate(()=>Scrapbook.next()); await p.waitForTimeout(1400); }
  const clip = await p.evaluate(()=>{ const s=document.querySelector('.sb-book-outer').getBoundingClientRect();
    return {x:Math.round(s.x),y:Math.round(s.y),width:Math.round(s.width),height:Math.round(s.height)}; });
  const out='/tmp/who'; fs.mkdirSync(out,{recursive:true});
  await p.evaluate((v)=>Scrapbook.__holdTurn(1,v), hold); await p.waitForTimeout(260);
  await p.screenshot({path:out+'/all.png', clip});
  await p.evaluate(()=>{ const s=document.createElement('style'); s.id='x1';
    s.textContent='.sb-leaf{display:none !important}'; document.head.appendChild(s); });
  await p.waitForTimeout(180);
  await p.screenshot({path:out+'/no-leaf.png', clip});
  await p.evaluate(()=>{ document.getElementById('x1').remove();
    const s=document.createElement('style'); s.id='x2';
    s.textContent='.sb-spread{visibility:hidden !important}'; document.head.appendChild(s); });
  await p.waitForTimeout(180);
  await p.screenshot({path:out+'/no-spread.png', clip});
  /* and what the spread is actually showing */
  const st = await p.evaluate(()=>[...document.querySelectorAll('.sb-spread .sb-page')]
    .filter(n=>getComputedStyle(n).display!=='none')
    .map(n=>({cls:n.className.slice(0,46), left:getComputedStyle(n).left, w:getComputedStyle(n).width})));
  console.log(JSON.stringify(st,null,1));
  await b.close();
})();
