// What a page turn costs the main thread, measured through CDP rather than
// through requestAnimationFrame -- rAF runs at about 3fps in this container
// and any timing built on it is fiction. Style, layout and paint durations
// are real numbers whatever the frame rate.
const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args:['--no-sandbox','--no-proxy-server','--disable-gpu','--use-gl=swiftshader','--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport:{width:430,height:932}, deviceScaleFactor:2, isMobile:true, hasTouch:true });
  await p.route('**/*', r => r.request().url().startsWith('http://127.0.0.1') ? r.continue() : r.abort());
  const cdp = await p.context().newCDPSession(p);
  await cdp.send('Performance.enable');
  const metrics = async () => Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(m=>[m.name,m.value]));
  await p.goto('http://127.0.0.1:8899/index.html',{waitUntil:'domcontentloaded',timeout:60000});
  await p.waitForTimeout(1500);
  await p.evaluate(async()=>{ window.skipBookIntro&&window.skipBookIntro(); showScreen('scrapbook'); Scrapbook.start();
    await new Promise(r=>setTimeout(r,1200)); const i=document.querySelector('.sb-intro'); if(i) i.click();
    await new Promise(r=>setTimeout(r,2400)); });
  const a = await metrics();
  for (let i=0;i<8;i++){ await p.evaluate(()=>Scrapbook.next()); await p.waitForTimeout(1300); }
  const z = await metrics();
  const d = (k)=> +( (z[k]-a[k]) * 1000 ).toFixed(1);
  console.log('over 8 page turns:');
  console.log('  style recalc :', d('RecalcStyleDuration'), 'ms  (', z['RecalcStyleCount']-a['RecalcStyleCount'], 'passes )');
  console.log('  layout       :', d('LayoutDuration'), 'ms  (', z['LayoutCount']-a['LayoutCount'], 'passes )');
  console.log('  script       :', d('ScriptDuration'), 'ms');
  console.log('  total task   :', d('TaskDuration'), 'ms');
  console.log('  nodes        :', z['Nodes']);
  await b.close();
})();
