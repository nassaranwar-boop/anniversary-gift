const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args:['--no-sandbox','--no-proxy-server','--use-gl=swiftshader','--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport:{width:900,height:560} });
  const fs = require('fs'); fs.mkdirSync('/tmp/dark',{recursive:true});
  await p.route('**/*', r => { const u=r.request().url();
    if (u.indexOf('book-scene.js')>=0) return r.abort();
    return u.startsWith('http://127.0.0.1') ? r.continue() : r.abort(); });
  await p.goto('http://127.0.0.1:8899/index.html',{waitUntil:'domcontentloaded',timeout:60000});
  await p.evaluate(() => { localStorage.setItem('ns_seenintro','1'); showScreen('nightshift');
    return loadChapter('nightshift').then(() => OuissysNightShift.start()); });
  await p.waitForFunction(() => window.OuissysNightShift && OuissysNightShift.__night,{timeout:20000,polling:200});
  console.log(JSON.stringify(await p.evaluate(() => {
    const N = OuissysNightShift.__night;
    N.finale();
    const out = [];
    let shot = -1;
    for (let k=0;k<24000 && N.finaleState().on;k++) {
      const i = N.filmFrame(0.2,false);
      if (i===false) break;
      if (i!==shot) {
        shot=i;
        N.filmFrame(0.001,true);
        if ([6,17,57].indexOf(i)>=0) {
          N.filmFrame(0.25,false); N.filmFrame(0.25,false); N.filmFrame(0.25,false);
          N.filmFrame(0.001,true);
          const st=N.state();
          const f=N.fxCount();
          out.push({ i:i, lum:N.frameLum(),
                     lux:+st.filmLux.toFixed(3), room:N.finaleState().room,
                     flames:f.kinds.flame||0, n:f.n });
          window.__grab = window.__grab || [];
          window.__grab.push(i);
        }
      }
    }
    return out;
  }), null, 1));
  const cdp = await p.context().newCDPSession(p);
  const {data} = await cdp.send('Page.captureScreenshot',{format:'png'});
  fs.writeFileSync('/tmp/dark/last.png', Buffer.from(data,'base64'));
  await b.close();
})();
