// The three walls, shot the same way, so the book's can be judged against
// the two it sits between rather than on its own.
const { chromium } = require('playwright-core');
const fs = require('fs');
(async () => {
  const b = await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});
  const ctx = await b.newContext({viewport:{width:1200,height:760}});
  await ctx.route('**/*', r => r.request().url().startsWith('http://127.0.0.1') ? r.continue() : r.abort());
  const p = await ctx.newPage();
  const cdp = await ctx.newCDPSession(p);
  await p.goto('http://127.0.0.1:8899/index.html',{waitUntil:'domcontentloaded',timeout:60000});
  await p.waitForTimeout(2500);
  const shot = async n => { const d = await cdp.send('Page.captureScreenshot',{format:'png'});
    fs.writeFileSync('/tmp/shots/bg-'+n+'.png', Buffer.from(d.data,'base64')); console.log('shot', n); };

  await p.evaluate(()=>{ showScreen('hub'); if(window.startHub) startHub(); });
  await p.waitForTimeout(2500); await shot('hub');

  await p.evaluate(()=>{ showScreen('keepsake'); if(window.startKeepsake) startKeepsake(); });
  await p.waitForTimeout(3000); await shot('keepsake');

  await p.evaluate(()=>{ showScreen('scrapbook'); if (window.startDioramas) startDioramas(); });
  await p.waitForTimeout(2000);
  await p.evaluate(()=>Scrapbook.skipIntro());
  await p.waitForTimeout(4500);
  await shot('book-cover');
  await p.evaluate(()=>Scrapbook.next());
  await p.waitForTimeout(2500);
  await shot('book-open');
  await b.close();
})();
