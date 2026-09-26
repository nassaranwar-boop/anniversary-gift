const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args:['--no-sandbox','--no-proxy-server'] });
  const p = await b.newPage({ viewport:{width:1000,height:650}, deviceScaleFactor:1 });
  p.on('pageerror', e=>console.log('ERR '+e.message));
  await p.route('**/*', r=>r.request().url().startsWith('http://127.0.0.1')?r.continue():r.abort());
  await p.goto('http://127.0.0.1:8899/index.html',{waitUntil:'domcontentloaded',timeout:60000});
  await p.waitForTimeout(800);
  await p.evaluate(()=>window.loadChapter&&window.loadChapter('cup'));
  await p.waitForFunction(()=>!!window.OuissyCup,{timeout:30000});
  console.log('chapter loaded');
  await p.evaluate(()=>{try{localStorage.clear();}catch(e){} showScreen('cup');
                       OuissyCup.__cup.soundOff(); OuissyCup.start();});
  for (let i=0;i<12;i++){
    await p.waitForTimeout(1000);
    console.log(i+'s  ' + JSON.stringify(await p.evaluate(()=>{const u=OuissyCup.__cup.ui();
      return {on:u.on,name:u.name,age:u.age,size:u.size,n:u.widgets.length};})));
  }
  await b.close();
})();
