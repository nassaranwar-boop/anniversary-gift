// What the opening costs the main thread while it runs, and what it looks
// like. rAF is throttled in this container so frames-per-second is fiction;
// script and paint durations through CDP are not.
const { chromium } = require('playwright-core');
const fs = require('fs');
(async () => {
  const b = await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});
  const ctx = await b.newContext({viewport:{width:390,height:844}, deviceScaleFactor:3, isMobile:true, hasTouch:true});
  await ctx.route('**/*', r => r.request().url().startsWith('http://127.0.0.1') ? r.continue() : r.abort());
  const p = await ctx.newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  const cdp = await ctx.newCDPSession(p);
  await cdp.send('Performance.enable');
  const m = async () => Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(x=>[x.name,x.value]));
  await p.goto('http://127.0.0.1:8899/index.html',{waitUntil:'domcontentloaded',timeout:60000});
  await p.waitForTimeout(2000);
  await p.evaluate(()=>{ showScreen('scrapbook'); if (window.startDioramas) startDioramas(); });
  await p.waitForTimeout(2500);
  const a = await m();
  const t0 = Date.now();
  await p.waitForTimeout(10000);
  const z = await m();
  const wall = (Date.now()-t0)/1000;
  const d = k => +(((z[k]-a[k])*1000)).toFixed(1);
  const frames = await p.evaluate(()=>window.__introFrames||0);
  const bakes  = await p.evaluate(()=>window.__introBakes||0);
  console.log(`over ${wall.toFixed(1)}s of the opening running:`);
  console.log('  script       :', d('ScriptDuration'), 'ms  (' + (d('ScriptDuration')/wall).toFixed(0) + ' ms/s of wall clock)');
  console.log('  total task   :', d('TaskDuration'), 'ms');
  console.log('  style recalc :', d('RecalcStyleDuration'), 'ms');
  console.log('  frames drawn :', frames, ' =', (frames/wall).toFixed(1), 'fps, ', (d('ScriptDuration')/Math.max(1,frames)).toFixed(1), 'ms of script each');
  console.log('  still bakes  :', bakes, '(must be 1, or 2 with the linen arriving late)');
  const shot = await cdp.send('Page.captureScreenshot',{format:'png'});
  fs.writeFileSync('/tmp/shots/intro.png', Buffer.from(shot.data,'base64'));
  console.log('  shot         : /tmp/shots/intro.png');
  console.log('errors:', errs.length? errs.slice(0,3):'none');
  await b.close();
})();
