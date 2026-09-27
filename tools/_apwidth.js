// What width each capped prop resolves to, on each device, without having to
// play the chapter as far as the scene that shows it.
const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args:['--no-sandbox','--use-gl=swiftshader','--enable-unsafe-swiftshader']});
  for (const [n,w,h] of [['phone 956x440',956,440],['phone 844x390',844,390],['ipad 1194x834',1194,834],['pc 1440x900',1440,900]]) {
    const ctx = await b.newContext({viewport:{width:w,height:h}, deviceScaleFactor:2, isMobile:w<1100, hasTouch:w<1100});
    await ctx.route('**/*', r => r.request().url().startsWith('http://127.0.0.1') ? r.continue() : r.abort());
    const p = await ctx.newPage();
    await p.goto('http://127.0.0.1:8899/index.html',{waitUntil:'domcontentloaded',timeout:60000});
    await p.waitForTimeout(1800);
    await p.evaluate(()=>{ showScreen('hub'); if(window.startHub) startHub(); });
    await p.waitForTimeout(900);
    await p.evaluate(()=>{const e=document.getElementById('hub-card-apoc'); if(e) e.click();});
    await p.waitForTimeout(8000);
    const r = await p.evaluate(()=>{
      const stage = document.querySelector('.ap-stage');
      if (!stage) return 'no stage';
      const sb = stage.getBoundingClientRect();
      const out = { stage: Math.round(sb.width)+'x'+Math.round(sb.height) };
      ['ap-tv','ap-radio','ap-serum','ap-panel','ap-note','ap-keypad','ap-check','ap-fridge'].forEach(c=>{
        const probe = document.createElement('div');
        probe.className = c; probe.style.visibility='hidden'; probe.style.position='absolute';
        stage.appendChild(probe);
        out[c] = Math.round(probe.getBoundingClientRect().width) + 'px';
        probe.remove();
      });
      return out;
    });
    console.log(n.padEnd(15), JSON.stringify(r).replace(/"/g,''));
    await ctx.close();
  }
  await b.close();
})();
