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
  await p.goto('http://127.0.0.1:8899/index.html',{waitUntil:'domcontentloaded',timeout:60000});
  await p.waitForTimeout(2500);
  await p.evaluate(()=>{ showScreen('scrapbook'); if (window.startDioramas) startDioramas(); });
  await p.waitForTimeout(2000);
  await p.evaluate(()=>Scrapbook.skipIntro());
  await p.waitForTimeout(4000);
  await p.evaluate(()=>Scrapbook.next());
  await p.waitForTimeout(2000);
  // freeze a mid-turn pose by driving the progress directly
  for (const q of [0.28, 0.5, 0.72]) {
    await p.evaluate(v=>{ Scrapbook.next(); }, q);
    await p.waitForTimeout(120);
    const d = await cdp.send('Page.captureScreenshot',{format:'png'});
    fs.writeFileSync('/tmp/shots/turn-'+String(q).replace('.','')+'.png', Buffer.from(d.data,'base64'));
    await p.waitForTimeout(1400);
  }
  console.log('errors:', errs.length? errs.slice(0,3):'none');
  await b.close();
})();
