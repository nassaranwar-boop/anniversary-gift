const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args:['--no-sandbox','--no-proxy-server','--use-gl=swiftshader','--enable-unsafe-swiftshader'] });
  for (const [label,w,h] of [['desktop',1280,800],['iphone',390,844]]) {
    const p = await b.newPage({ viewport:{width:w,height:h}, isMobile:w<900, hasTouch:w<900 });
    p.on('pageerror', e=>console.log(label+' ERR '+e.message));
    await p.route('**/*', r=>r.request().url().startsWith('http://127.0.0.1')?r.continue():r.abort());
    await p.goto('http://127.0.0.1:8899/index.html',{waitUntil:'domcontentloaded',timeout:60000});
    await p.waitForTimeout(900);
    await p.evaluate(()=>{ if (window.finishBookIntro) finishBookIntro(); });
    await p.waitForFunction(()=>document.getElementById('screen-gate').classList.contains('active'),{timeout:12000,polling:200}).catch(()=>{});
    await p.evaluate(()=>{ if (window.skipBookIntro) skipBookIntro(); });
    console.log(label+' key2: '+JSON.stringify(await p.evaluate(()=>{
      const k=document.querySelector('[data-gate-key="2"]'); const r=k.getBoundingClientRect();
      const top=document.elementFromPoint(r.x+r.width/2, r.y+r.height/2);
      const cs=getComputedStyle(k);
      return { rect:[Math.round(r.x),Math.round(r.y),Math.round(r.width),Math.round(r.height)],
               hitIsKey: !!(top&&top.closest&&top.closest('[data-gate-key="2"]')),
               hit: top?(top.id||top.className||top.tagName):null,
               hitText: top?(top.textContent||'').trim().slice(0,60):null,
               hitPath: (function(){ var n=top,a=[]; while(n&&n!==document.body){
                 a.unshift(n.tagName.toLowerCase()+(n.id?'#'+n.id:'')+(n.className&&n.className.baseVal===undefined&&n.className?'.'+String(n.className).split(' ').join('.'):'')); n=n.parentElement; } return a.join(' > '); })(),
               hitBox: (function(){ var r2=top.getBoundingClientRect();
                 return [Math.round(r2.x),Math.round(r2.y),Math.round(r2.width),Math.round(r2.height),
                         getComputedStyle(top).position, getComputedStyle(top).zIndex, getComputedStyle(top).pointerEvents]; })(),
               pe: cs.pointerEvents, ta: cs.touchAction, disp: cs.display,
               padPE: getComputedStyle(document.getElementById('gate-pad')).pointerEvents };
    })));
    /* three ways in, to find which one the page actually hears */
    await p.click('[data-gate-key="2"]', { force: true });
    await p.waitForTimeout(200);
    console.log(label+' after click: filled='+await p.evaluate(()=>document.querySelectorAll('#gate-code .gate-dot.filled').length));
    await p.tap('[data-gate-key="2"]', { force: true }).catch(e=>console.log(label+' tap threw: '+e.message.split('\n')[0]));
    await p.waitForTimeout(200);
    console.log(label+' after tap:   filled='+await p.evaluate(()=>document.querySelectorAll('#gate-code .gate-dot.filled').length));
    await p.evaluate(()=>{ const k=document.querySelector('[data-gate-key="0"]');
      k.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,cancelable:true})); });
    await p.waitForTimeout(200);
    console.log(label+' after synth: filled='+await p.evaluate(()=>document.querySelectorAll('#gate-code .gate-dot.filled').length));
    await p.evaluate(()=>{ if (window.gateClear) gateClear(); });
    for (const d of '2207') {
      await p.click(`[data-gate-key="${d}"]`, { force: true });
      await p.waitForTimeout(160);
      console.log(label+' after '+d+': filled='+await p.evaluate(()=>
        document.querySelectorAll('#gate-code .gate-dot.filled').length));
    }
    const box = await p.evaluate(()=>{ const u=document.getElementById('gate-submit');
      const r=u.getBoundingClientRect(); const top=document.elementFromPoint(r.x+r.width/2, r.y+r.height/2);
      return { rect:[Math.round(r.x),Math.round(r.y),Math.round(r.width),Math.round(r.height)],
               onTop: top ? (top.id||top.className||top.tagName) : null,
               isSubmit: !!(top && top.closest && top.closest('#gate-submit')) }; });
    console.log(label+' submit: '+JSON.stringify(box));
    await p.click('#gate-submit', { force: true });
    await p.waitForTimeout(3600);
    console.log(label+' after unlock: active='+await p.evaluate(()=>{
      const a=document.querySelector('.screen.active'); return a?a.id:'(none)';})
      +' err="'+await p.evaluate(()=>{const n=document.getElementById('gate-error');return n?n.textContent.trim():'';})+'"');
    await p.close();
  }
  await b.close();
})();
