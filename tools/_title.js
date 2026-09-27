const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args:['--no-sandbox','--no-proxy-server'] });
  const p = await b.newPage({ viewport:{width:1280,height:800}, deviceScaleFactor:1 });
  p.on('pageerror', e=>console.log('ERR '+e.message));
  await p.route('**/*', r=>r.request().url().startsWith('http://127.0.0.1')?r.continue():r.abort());
  await p.goto('http://127.0.0.1:8899/index.html',{waitUntil:'domcontentloaded',timeout:60000});
  await p.waitForTimeout(800);
  await p.evaluate(()=>window.loadChapter&&window.loadChapter('cup'));
  await p.waitForFunction(()=>!!window.OuissyCup,{timeout:30000});
  await p.evaluate(()=>{try{localStorage.clear();}catch(e){} showScreen('cup');
                        OuissyCup.__cup.soundOff(); OuissyCup.start();});
  const settle = async (n)=>{ await p.waitForFunction((x)=>OuissyCup.__cup.ui().name===x,n,{timeout:60000});
                              await p.waitForFunction(()=>OuissyCup.__cup.ui().age>1.4,null,{timeout:120000,polling:200}); };
  await settle('help');
  await p.evaluate(()=>OuissyCup.__cup.press('card_go'));
  await settle('title');
  await p.screenshot({path:'/tmp/title-a.png'});
  await p.waitForTimeout(3500);
  await p.screenshot({path:'/tmp/title-b.png'});
  console.log('ok');
  await b.close();
})();
