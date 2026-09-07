const { chromium } = require('playwright-core');
(async () => {
  const browser = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args:['--no-sandbox','--no-proxy-server','--disable-gpu','--use-gl=swiftshader','--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport:{width:1440,height:900}, deviceScaleFactor:2 });
  page.on('pageerror',e=>console.log('PAGEERROR',e.message));
  await page.route('**/*', r => r.request().url().startsWith('http://127.0.0.1') ? r.continue() : r.abort());
  await page.goto('http://127.0.0.1:8899/index.html',{waitUntil:'domcontentloaded',timeout:60000});
  await page.waitForTimeout(1500);
  const idx = Number(process.argv[2] || 6);
  const r = await page.evaluate(async (idx) => {
    window.skipBookIntro && window.skipBookIntro();
    showScreen('scrapbook'); Scrapbook.start();
    await new Promise(r=>setTimeout(r,2600));
    const pages=[...document.querySelectorAll('.sb-page')];
    const pg=pages[idx];
    if(!pg) return {error:'no page '+idx+' of '+pages.length};
    pg.style.display='block'; pg.style.visibility='visible'; pg.style.opacity='1';
    await new Promise(r=>setTimeout(r,300));
    const pb=pg.getBoundingClientRect();
    const pct=(b)=>({ left:+((b.left-pb.left)/pb.width*100).toFixed(1),
                      top:+((b.top-pb.top)/pb.height*100).toFixed(1),
                      right:+((b.right-pb.left)/pb.width*100).toFixed(1),
                      bottom:+((b.bottom-pb.top)/pb.height*100).toFixed(1) });
    const items=[...pg.children].map(el=>({
      cls: el.className.toString().slice(0,28), ...pct(el.getBoundingClientRect())
    }));
    return { pageIndex:idx, pages:pages.length, pageBox:[Math.round(pb.width),Math.round(pb.height)], items };
  }, idx);
  console.log(JSON.stringify(r,null,1));
  await browser.close();
})();
