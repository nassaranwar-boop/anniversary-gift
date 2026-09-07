/* Both of his speeches must be skippable, with a finger. */
const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args:['--no-sandbox','--no-proxy-server','--use-gl=swiftshader','--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport:{width:390,height:844}, hasTouch:true, isMobile:true });
  p.on('pageerror', e=>console.log('PAGEERROR', e.message));
  await p.route('**/*', r=>{const u=r.request().url();
    if(u.indexOf('book-scene.js')>=0) return r.abort();
    return u.startsWith('http://127.0.0.1')?r.continue():r.abort();});
  await p.goto('http://127.0.0.1:8899/index.html',{waitUntil:'domcontentloaded',timeout:120000});
  await p.waitForTimeout(600);
  await p.evaluate(()=>{ try{localStorage.clear();}catch(e){} showScreen('nightshift');
    return loadChapter('nightshift').then(()=>OuissysNightShift.start()); });
  await p.waitForFunction(()=>window.OuissysNightShift&&OuissysNightShift.__night&&Object.keys(OuissysNightShift.__night.cast()).length>=4,null,{timeout:120000});
  await p.waitForTimeout(900);

  // 1. the film
  await p.evaluate(()=>OuissysNightShift.__night.route('start'));
  await p.waitForTimeout(2800);                       // its SKIP fades in at 2.2s
  let st = await p.evaluate(()=>OuissysNightShift.__night.state().phase);
  const filmBtn = await p.locator('#ns-cine-skip');
  const filmVis = await filmBtn.count() && await filmBtn.isVisible();
  const box1 = filmVis ? await filmBtn.boundingBox() : null;
  console.log(`the film     phase=${st}  SKIP visible=${filmVis}  ${box1?Math.round(box1.width)+'x'+Math.round(box1.height)+'px':''}`);
  // and the thing under its middle is really it
  const hit1 = box1 ? await p.evaluate(([x,y])=>{const e=document.elementFromPoint(x,y);return e&&e.id;},
      [box1.x+box1.width/2, box1.y+box1.height/2]) : null;
  console.log(`             a finger there lands on: ${hit1}`);
  await p.evaluate(()=>document.querySelector('#ns-cine-skip').click());
  await p.waitForTimeout(1200);
  st = await p.evaluate(()=>OuissysNightShift.__night.state().phase);
  console.log(`             after SKIP -> phase=${st}`);

  // 2. the terms
  const termBtn = await p.locator('#ns-terms-skip');
  const termVis = await termBtn.count() && await termBtn.isVisible();
  const box2 = termVis ? await termBtn.boundingBox() : null;
  console.log(`the terms    phase=${st}  SKIP visible=${termVis}  ${box2?Math.round(box2.width)+'x'+Math.round(box2.height)+'px':''}`);
  const hit2 = box2 ? await p.evaluate(([x,y])=>{const e=document.elementFromPoint(x,y);return e&&e.id;},
      [box2.x+box2.width/2, box2.y+box2.height/2]) : null;
  console.log(`             a finger there lands on: ${hit2}`);
  if (termVis) {
    await p.evaluate(()=>document.querySelector('#ns-terms-skip').click());
    await p.waitForTimeout(1500);
    st = await p.evaluate(()=>OuissysNightShift.__night.state().phase);
    const hour = await p.evaluate(()=>OuissysNightShift.__night.state().hour);
    console.log(`             after SKIP -> phase=${st} hour=${hour}  (play/0 = she is in the shift)`);
  }
  await b.close();
})();
