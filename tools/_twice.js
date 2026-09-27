/* DOES THE CUP COME BACK? Open it from the hub, leave, open it again,
   and report the chapter's own state at each step rather than guessing
   from the screen class. */
const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args:['--no-sandbox','--no-proxy-server','--use-gl=swiftshader','--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport:{width:1280,height:800} });
  p.on('pageerror', e=>console.log('ERR '+e.message));
  await p.route('**/*', r=>r.request().url().startsWith('http://127.0.0.1')?r.continue():r.abort());
  await p.goto('http://127.0.0.1:8899/index.html',{waitUntil:'domcontentloaded',timeout:60000});
  await p.waitForTimeout(900);
  const look = () => p.evaluate(()=>({
    screen: (document.querySelector('.screen.active')||{}).id || null,
    cup: !!window.OuissyCup,
    ui: window.OuissyCup ? OuissyCup.__cup.ui() : null,
    state: window.OuissyCup ? (OuissyCup.__cup.state() ? OuissyCup.__cup.state().state : null) : null,
  }));
  for (const visit of ['first','second']) {
    await p.evaluate(()=>{ showScreen('hub'); startHub(); });
    await p.waitForTimeout(300);
    await p.evaluate(()=>document.getElementById('hub-card-cup').click());
    await p.waitForFunction(()=>window.OuissyCup && OuissyCup.__cup && OuissyCup.__cup.ui().on,
      {timeout:30000,polling:200}).catch(()=>{});
    console.log(visit+' in:  '+JSON.stringify(await look()));
    await p.evaluate(()=>{ if (window.OuissyCup) OuissyCup.stop(); showScreen('hub'); startHub(); });
    await p.waitForTimeout(500);
    console.log(visit+' out: '+JSON.stringify(await look()));
  }
  await b.close();
})();
