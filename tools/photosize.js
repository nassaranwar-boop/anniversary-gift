const { chromium } = require('playwright-core');
(async () => {
  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox','--no-proxy-server','--disable-gpu','--use-gl=swiftshader','--enable-unsafe-swiftshader'] });
  for (const dev of [
      { name:'desktop', viewport:{width:1440,height:900}, dpr:2 },
      { name:'iPhone-portrait', viewport:{width:390,height:844}, dpr:3, isMobile:true, hasTouch:true },
      { name:'iPad-landscape', viewport:{width:1180,height:820}, dpr:2, isMobile:true, hasTouch:true },
  ]) {
    const page = await browser.newPage({ viewport: dev.viewport, deviceScaleFactor: dev.dpr, isMobile: dev.isMobile, hasTouch: dev.hasTouch });
    await page.route('**/*', r => r.request().url().startsWith('http://127.0.0.1') ? r.continue() : r.abort());
    await page.goto('http://127.0.0.1:8899/index.html', { waitUntil:'domcontentloaded', timeout:60000 });
    await page.waitForTimeout(1200);
    const res = await page.evaluate(async (dpr) => {
      window.skipBookIntro && window.skipBookIntro();
      document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
      const s = document.getElementById('screen-scrapbook'); s.classList.add('active');
      window.Scrapbook && Scrapbook.start();
      await new Promise(r=>setTimeout(r,2500));
      // reveal every page so all frames lay out
      document.querySelectorAll('.sb-page').forEach(p=>{ p.style.display='block'; p.style.visibility='visible'; });
      await new Promise(r=>setTimeout(r,600));
      let max=0, maxSel='', n=0; const sizes=[];
      document.querySelectorAll('#screen-scrapbook img').forEach(img=>{
        const b=img.getBoundingClientRect();
        if (b.width<2) return; n++;
        const need = Math.max(b.width, b.height)*dpr;
        sizes.push(Math.round(need));
        if (need>max){ max=need; maxSel=img.parentElement.className; }
      });
      sizes.sort((a,b)=>b-a);
      return { count:n, top:sizes.slice(0,8), maxDevicePx:Math.round(max), where:maxSel,
               lightboxCardW: (()=>{const c=document.querySelector('.sb-lb-card'); return c?Math.round(c.getBoundingClientRect().width*dpr):null;})() };
    }, dev.dpr);
    console.log(dev.name, JSON.stringify(res));
    await page.close();
  }
  await browser.close();
})();
