// Milliseconds are not the measure here: this container rasterises canvas in
// software, so a full-screen blit dominates every number and hides what the
// code actually does. Count the drawing operations instead -- those are the
// same on this machine as on her phone.
const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});
  const ctx = await b.newContext({viewport:{width:390,height:844}, deviceScaleFactor:3, isMobile:true, hasTouch:true});
  await ctx.route('**/*', r => r.request().url().startsWith('http://127.0.0.1') ? r.continue() : r.abort());
  const p = await ctx.newPage();
  await p.addInitScript(()=>{
    window.__ops = {};
    const P = CanvasRenderingContext2D.prototype;
    ['fill','stroke','fillRect','drawImage','createLinearGradient','createRadialGradient',
     'createPattern','bezierCurveTo','quadraticCurveTo','arc','ellipse','beginPath','save','clip']
      .forEach(k=>{ const f=P[k]; P[k]=function(){ window.__ops[k]=(window.__ops[k]||0)+1; return f.apply(this,arguments); }; });
  });
  await p.goto('http://127.0.0.1:8899/index.html',{waitUntil:'domcontentloaded',timeout:60000});
  await p.waitForTimeout(2000);
  await p.evaluate(()=>{ showScreen('scrapbook'); if (window.startDioramas) startDioramas(); });
  await p.waitForTimeout(4000);           // let the still layer + sprites be cut
  await p.evaluate(()=>{ window.__ops={}; window.__f0 = window.__introFrames||0; });
  await p.waitForTimeout(6000);
  const r = await p.evaluate(()=>({ops:window.__ops, frames:(window.__introFrames||0)-window.__f0}));
  const tot = Object.values(r.ops).reduce((a,b)=>a+b,0);
  console.log('steady-state opening,', r.frames, 'frames:');
  Object.entries(r.ops).sort((a,b)=>b[1]-a[1]).forEach(([k,v])=>{
    console.log('   ' + k.padEnd(22), String(v).padStart(7), ' = ' + (v/r.frames).toFixed(1) + ' per frame');
  });
  console.log('   ' + 'TOTAL'.padEnd(22), String(tot).padStart(7), ' = ' + (tot/r.frames).toFixed(1) + ' per frame');
  await b.close();
})();
