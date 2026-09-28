/* WHY IS THE TURN-YOUR-PHONE CARD SHOWING ON A DESKTOP? */
const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args:['--no-sandbox','--no-proxy-server'] });
  for (const [label,w,h,mob] of [['desktop',1280,800,false],['iphone',390,844,true]]) {
    const p = await b.newPage({ viewport:{width:w,height:h}, isMobile:mob, hasTouch:mob });
    await p.route('**/*', r=>r.request().url().startsWith('http://127.0.0.1')?r.continue():r.abort());
    await p.goto('http://127.0.0.1:8899/index.html',{waitUntil:'domcontentloaded',timeout:60000});
    await p.waitForTimeout(800);
    console.log(label + ': ' + JSON.stringify(await p.evaluate(()=>{
      const el = document.getElementById('rotate-me');
      const cs = getComputedStyle(el);
      const rules = [];
      for (const sheet of document.styleSheets) {
        let list; try { list = sheet.cssRules; } catch (e) { continue; }
        const walk = (rs, cond) => { for (const r of rs) {
          if (r.cssRules) { walk(r.cssRules, (r.conditionText || r.media && r.media.mediaText || '')); continue; }
          if (!r.selectorText) continue;
          if (/rotate-me/.test(r.selectorText) && /display/.test(r.cssText))
            rules.push((cond ? '@media ' + cond + ' ' : '') + r.selectorText + ' {' + r.style.display + '}');
        } };
        walk(list, '');
      }
      return { display: cs.display, html: document.documentElement.className,
               matchPortrait: matchMedia('(orientation:portrait)').matches,
               matchCoarse: matchMedia('(pointer:coarse)').matches,
               matchNarrow: matchMedia('(max-width:600px)').matches,
               rules: rules };
    })));
    await p.close();
  }
  await b.close();
})();
