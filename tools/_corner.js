/* THE BOTTOM-LEFT CORNER, CLOSE UP. Something cream is painted there
   and it is clipped by the edge of the frame; the HUD is half DOM and
   half canvas so the only way to know which is to look at it big. */
const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args:['--no-sandbox','--no-proxy-server','--use-gl=swiftshader','--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport:{width:960,height:600} });
  p.on('pageerror', e=>console.log('ERR '+e.message));
  await p.route('**/*', r=>r.request().url().startsWith('http://127.0.0.1')?r.continue():r.abort());
  await p.goto('http://127.0.0.1:8899/index.html',{waitUntil:'domcontentloaded',timeout:60000});
  await p.waitForTimeout(800);
  await p.evaluate(()=>{ try{localStorage.clear();}catch(e){} showScreen('hub'); startHub(); });
  await p.waitForTimeout(250);
  await p.click('#hub-card-cup');
  await p.waitForFunction(()=>window.OuissyCup && OuissyCup.__cup.state()!==null,{timeout:60000});
  await p.waitForTimeout(600);
  await p.evaluate(()=>{ OuissyCup.__cup.quick(0); OuissyCup.__cup.auto(true); });
  await p.waitForTimeout(1500);
  /* blow the corner up so single pixels of the pixel UI are readable */
  /* WHICH LAYER PAINTS IT. The world and the pixel UI are two canvases
     stacked; blowing up the composite cannot say which one a shape came
     from, so each is enlarged on its own, one above the other. */
  await p.evaluate(()=>{
    const wrap = document.createElement('div');
    wrap.style.cssText = 'position:fixed;left:0;top:0;z-index:99999;background:#111';
    ['cup-canvas','cup-ui'].forEach((id, i)=>{
      const c = document.getElementById(id);
      const big = document.createElement('canvas');
      big.width = 900; big.height = 270;
      const g = big.getContext('2d'); g.imageSmoothingEnabled = false;
      g.fillStyle = '#ff00ff'; g.fillRect(0,0,900,270);
      g.drawImage(c, 0, c.height - 90, 300, 90, 0, 0, 900, 270);
      big.style.cssText = 'display:block;image-rendering:pixelated';
      wrap.appendChild(big);
    });
    document.body.appendChild(wrap);
  });
  await p.waitForTimeout(200);
  await p.screenshot({ path:'/tmp/corner.png', clip:{x:0,y:0,width:900,height:540} });
  console.log('-> /tmp/corner.png');
  await b.close();
})();
