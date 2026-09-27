const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args:['--no-sandbox','--no-proxy-server','--use-gl=swiftshader','--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport:{width:900,height:560} });
  await p.route('**/*', r => { const u=r.request().url();
    if (u.indexOf('book-scene.js')>=0) return r.abort();
    return u.startsWith('http://127.0.0.1') ? r.continue() : r.abort(); });
  await p.goto('http://127.0.0.1:8899/index.html',{waitUntil:'domcontentloaded',timeout:60000});
  await p.evaluate(() => { localStorage.setItem('ns_seenintro','1'); showScreen('nightshift');
    return loadChapter('nightshift').then(() => OuissysNightShift.start()); });
  await p.waitForFunction(() => window.OuissysNightShift && OuissysNightShift.__night,{timeout:20000,polling:200});
  const want = (process.argv[2]||'26').split(',').map(Number);
  console.log(JSON.stringify(await p.evaluate((W) => {
    const N = OuissysNightShift.__night; N.finale();
    const out = []; let shot = -1;
    for (let k=0;k<24000 && N.finaleState().on;k++) {
      const i = N.filmFrame(0.2,false);
      if (i===false) break;
      if (i!==shot) { shot=i;
        if (W.indexOf(i)>=0) {
          N.filmFrame(0.001,true);
          /* step through the shot the way endcheck does, and report
             the closest thing at its closest moment */
          let best = { d: 99 };
          for (let f = 0; f < 8; f++) {
            N.filmFrame(0.25, false); N.filmFrame(0.25, false);
            N.filmFrame(0.001, true);
            [[-0.82,-0.82],[0,-0.82],[0.82,-0.82],[-0.82,0],[0,0],[0.82,0],
             [-0.82,0.82],[0,0.82],[0.82,0.82]].forEach(([x,y]) => {
              const h = N.whatIsAt(x,y);
              if (h && h[0] && h[0].d < best.d) best = Object.assign({ndc:[x,y]}, h[0]);
            });
          }
          out.push({ i:i, closest: best });
        }
      }
    }
    return out;
  }, want), null, 1));
  await b.close();
})();
