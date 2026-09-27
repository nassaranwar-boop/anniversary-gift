/* EVERY THING ON THE PITCH AND WHERE IT ACTUALLY IS.
   The HUD is half DOM and half painted canvas, so "what is that box in
   the corner" is not a question you can answer by reading either one.
   This lists every visible element inside the stage with its rectangle,
   and flags any that hang outside the frame. */
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
  await p.waitForTimeout(1200);
  console.log(await p.evaluate(()=>{
    const st = document.getElementById('cup-stage').getBoundingClientRect();
    const out = [];
    document.querySelectorAll('#screen-cup *').forEach(el=>{
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0) return;
      const r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) return;
      if (el.children.length && el.tagName !== 'BUTTON' && el.tagName !== 'P') return;
      const out_l = r.left < st.left - 1, out_r = r.right > st.right + 1;
      const out_t = r.top < st.top - 1, out_b = r.bottom > st.bottom + 1;
      out.push((el.id || el.className || el.tagName).toString().slice(0,28).padEnd(30)
        + [Math.round(r.left-st.left), Math.round(r.top-st.top),
           Math.round(r.width), Math.round(r.height)].join(',').padEnd(20)
        + ((out_l||out_r||out_t||out_b) ? '  OUTSIDE' : ''));
    });
    return 'stage ' + Math.round(st.width) + 'x' + Math.round(st.height) + '\n' + out.join('\n');
  }));
  await b.close();
})();
