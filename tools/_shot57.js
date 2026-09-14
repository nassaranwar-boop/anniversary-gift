const { chromium } = require('playwright-core');
const fs = require('fs');
(async () => {
  fs.mkdirSync('/tmp/dark', { recursive: true });
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
  const cdp = await p.context().newCDPSession(p);
  const want = (process.argv[2]||'57').split(',').map(Number);
  await p.evaluate(() => OuissysNightShift.__night.finale());
  let shot = -1;
  for (let k=0;k<24000;k++) {
    const st = await p.evaluate((w) => {
      const N = OuissysNightShift.__night;
      const i = N.filmFrame(0.2,false);
      if (i===false) return {done:true};
      return {i:i, on:N.finaleState().on};
    }, want);
    if (st.done || !st.on) break;
    if (st.i !== shot) {
      shot = st.i;
      if (want.indexOf(shot) >= 0) {
        const lum = await p.evaluate(() => { const N=OuissysNightShift.__night;
          N.filmFrame(0.25,false); N.filmFrame(0.25,false); N.filmFrame(0.001,true);
          return N.frameLum(); });
        const {data} = await cdp.send('Page.captureScreenshot',{format:'png'});
        fs.writeFileSync('/tmp/dark/shot-'+shot+'.png', Buffer.from(data,'base64'));
        console.log('  shot '+shot+'  lum '+lum);
      }
    }
  }
  await b.close();
})();
