/* The Queen's revive, driven the way a player meets it. */
const { chromium } = require('playwright-core');
let pass=0, fail=0;
const ok=(n,c,x)=>{ if(c){pass++;console.log('PASS  '+n+(x?'   '+x:''));} else {fail++;console.log('FAIL  '+n+(x?'   '+x:''));} };
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args:['--no-sandbox','--no-proxy-server','--use-gl=swiftshader','--enable-unsafe-swiftshader']});
  const p=await b.newPage({viewport:{width:1000,height:700}});
  p.on('pageerror',e=>{console.log('PAGEERROR',e.message);fail++;});
  await p.route('**/*', r=>{const u=r.request().url();
    if(u.indexOf('book-scene.js')>=0) return r.abort();
    return u.startsWith('http://127.0.0.1')?r.continue():r.abort();});
  await p.goto('http://127.0.0.1:8899/index.html',{waitUntil:'domcontentloaded',timeout:120000});
  await p.waitForTimeout(600);

  const setup = async (lives) => {
    await p.evaluate(async (lives)=>{
      try{localStorage.clear();localStorage.setItem('so_diff','hard');localStorage.setItem('so_howto','1');}catch(e){}
      showScreen('ouissy');
      await loadChapter('ouissy');
      SuperOuissy.start();
      const G=window.__soState;
    }, lives);
    await p.waitForFunction(()=>window.__soState && window.__soState(), null, {timeout:60000});
    // jump to the last world, wake the Queen, set lives
    await p.evaluate((lives)=>{
      window.__soGoLevel && window.__soGoLevel(2);
    }, lives);
    await p.waitForTimeout(400);
  };
  await setup(3);
  const st = await p.evaluate(()=>window.__soState());
  console.log('state hooks:', JSON.stringify(Object.keys(st).slice(0,14)));
  await b.close();
  console.log('\n'+pass+' passed, '+fail+' failed');
})();
