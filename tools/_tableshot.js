// The table at the sizes it actually has to work at.
const { chromium } = require('playwright-core');
const fs = require('fs');
(async () => {
  const b = await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});
  for (const [name,w,h,dpr] of [['phone',390,844,3],['phone-land',844,390,3],['ipad',834,1112,2]]) {
    const ctx = await b.newContext({viewport:{width:w,height:h}, deviceScaleFactor:dpr,
      isMobile:true, hasTouch:true});
    await ctx.route('**/*', r => r.request().url().startsWith('http://127.0.0.1') ? r.continue() : r.abort());
    const p = await ctx.newPage();
    const cdp = await ctx.newCDPSession(p);
    await p.goto('http://127.0.0.1:8899/index.html',{waitUntil:'domcontentloaded',timeout:60000});
    await p.waitForTimeout(2200);
    await p.evaluate(()=>{ showScreen('scrapbook'); if (window.startDioramas) startDioramas(); });
    await p.waitForTimeout(1800);
    await p.evaluate(()=>Scrapbook.skipIntro());
    await p.waitForTimeout(4500);
    await p.evaluate(()=>Scrapbook.next());
    await p.waitForTimeout(2500);
    const r = await p.evaluate(()=>{
      const t=document.querySelector('.sb-table');
      const props=[...document.querySelectorAll('.sb-prop')].filter(e=>getComputedStyle(e).display!=='none');
      const sh=document.querySelector('.sb-book-shade');
      return {table:!!t, layers:t?t.children.length:0, propsShown:props.length,
              shade: sh? Math.round(sh.getBoundingClientRect().width)+'x'+Math.round(sh.getBoundingClientRect().height) : 'none'};
    });
    console.log(`${name.padEnd(11)} ${w}x${h}  table ${r.table?'built':'MISSING'}  layers ${r.layers}  props visible ${r.propsShown}  shade ${r.shade}`);
    const d = await cdp.send('Page.captureScreenshot',{format:'png'});
    fs.writeFileSync('/tmp/shots/table-'+name+'.png', Buffer.from(d.data,'base64'));
    await ctx.close();
  }
  await b.close();
})();
