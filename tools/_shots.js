const { chromium } = require('playwright-core');
const SIZES = [['laptop', 1280, 800], ['wide', 1000, 650], ['phone', 844, 390], ['upright', 390, 844]];
(async () => {
  const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args:['--no-sandbox','--no-proxy-server'] });
  for (const [label, W, H] of SIZES) {
    const p = await b.newPage({ viewport:{width:W,height:H}, deviceScaleFactor:1 });
    p.on('pageerror', e=>console.log('  ERR '+e.message));
    await p.route('**/*', r=>r.request().url().startsWith('http://127.0.0.1')?r.continue():r.abort());
    await p.goto('http://127.0.0.1:8899/index.html',{waitUntil:'domcontentloaded',timeout:60000});
    await p.waitForTimeout(800);
    await p.evaluate(()=>window.loadChapter&&window.loadChapter('cup'));
    await p.waitForFunction(()=>!!window.OuissyCup,{timeout:30000});
    await p.evaluate(()=>{try{localStorage.clear();}catch(e){} showScreen('cup');
                         OuissyCup.__cup.soundOff(); OuissyCup.start();});
    const settle = async (n)=>{ await p.waitForFunction((x)=>OuissyCup.__cup.ui().name===x,n,{timeout:40000});
                                await p.waitForFunction(()=>OuissyCup.__cup.ui().age>1.4,null,{timeout:90000,polling:200}); };
    const over = async (what) => {
      const r = await p.evaluate(()=>{ const u=OuissyCup.__cup.ui();
        return { size:u.size, bad:u.widgets.filter(w=>w.y+w.h>u.size[1]||w.x+w.w>u.size[0]||w.y<0||w.x<0)
                        .map(w=>w.id+' @'+w.x+','+w.y+' '+w.w+'x'+w.h) }; });
      console.log('   ' + what + ': UI ' + r.size[0]+'x'+r.size[1] +
                  '   outside: ' + (r.bad.length? r.bad.join(', ') : 'none'));
    };
    console.log('\n== ' + label + '  window ' + W + 'x' + H);
    await settle('help');
    await p.evaluate(()=>OuissyCup.__cup.press('card_go'));
    await settle('title');  await over('title');
    await p.screenshot({path:'/tmp/s-'+label+'-title.png'});
    await p.evaluate(()=>OuissyCup.__cup.press('m_teams'));
    await settle('teams');  await over('teams');
    await p.screenshot({path:'/tmp/s-'+label+'-teams.png'});
    await p.evaluate(()=>OuissyCup.__cup.press('build'));
    await settle('builder');  await over('build');
    await p.screenshot({path:'/tmp/s-'+label+'-build.png'});
    await p.close();
  }
  await b.close();
})();
