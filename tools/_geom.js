const { chromium } = require('playwright-core');
const SIZES = [[1000,650],[1999,1301],[1280,800],[1440,900],[1512,982],[1920,1080],
               [1366,768],[844,390],[390,844],[1180,820],[820,1180],[375,667],[2560,1440]];
(async () => {
  const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args:['--no-sandbox','--no-proxy-server'] });
  for (const [W,H] of SIZES) {
    const p = await b.newPage({ viewport:{width:W,height:H}, deviceScaleFactor:1 });
    await p.route('**/*', r=>r.request().url().startsWith('http://127.0.0.1')?r.continue():r.abort());
    await p.goto('http://127.0.0.1:8899/index.html',{waitUntil:'domcontentloaded',timeout:60000});
    await p.waitForTimeout(500);
    await p.evaluate(()=>window.loadChapter&&window.loadChapter('cup'));
    await p.waitForFunction(()=>!!window.OuissyCup,{timeout:30000});
    await p.evaluate(()=>{try{localStorage.clear();}catch(e){} showScreen('cup'); OuissyCup.__cup.soundOff(); OuissyCup.start();});
    await p.waitForTimeout(700);
    const r = await p.evaluate(()=>{
      const st=document.getElementById('cup-stage');
      const fr=document.querySelector('.cup-frame');
      const s=st.getBoundingClientRect(), f=fr.getBoundingClientRect();
      const u=OuissyCup.__cup.ui();
      return { stage:[Math.round(s.width),Math.round(s.height)],
               frame:[Math.round(f.width),Math.round(f.height)],
               ar:+(s.width/s.height).toFixed(3), ui:u.size,
               uiAr:+(u.size[0]/u.size[1]).toFixed(3),
               vw:window.innerWidth, vh:window.innerHeight,
               appH: getComputedStyle(document.documentElement).getPropertyValue('--app-h').trim() };
    });
    const squash = Math.abs(r.ar - 16/9) > 0.02 ? '  << SQUASHED' : '';
    const short  = r.ui[1] < 250 ? '  << UI SHORT' : '';
    console.log(`${String(W).padStart(4)}x${String(H).padEnd(5)} frame ${r.frame.join('x').padEnd(10)} stage ${r.stage.join('x').padEnd(10)} ar ${String(r.ar).padEnd(6)} UI ${r.ui.join('x').padEnd(9)} uiAr ${r.uiAr}${squash}${short}`);
    await p.close();
  }
  await b.close();
})();
