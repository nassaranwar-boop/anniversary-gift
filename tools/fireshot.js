/* DOES THE FIRE LOOK LIKE FIRE?

   Every failure mode of an additive-billboard effect is invisible to
   an assertion: quads that never turn to face the lens and read as
   flat squares, flames the size of a room, sparks that fall through
   the floor and go on falling, smoke that is a black rectangle. So:
   pictures, at three points in the burn.
                                   node tools/fireshot.js [outdir]   */
const { chromium } = require('playwright-core');
const fs = require('fs');
const OUT = process.argv[2] || '/tmp/fire';
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox','--no-proxy-server','--use-gl=swiftshader','--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 900, height: 560 } });
  await p.route('**/*', r => { const u = r.request().url();
    if (u.indexOf('book-scene.js') >= 0) return r.abort();
    return u.startsWith('http://127.0.0.1') ? r.continue() : r.abort(); });
  await p.goto('http://127.0.0.1:8899/index.html', { waitUntil:'domcontentloaded', timeout:60000 });
  await p.evaluate(() => { localStorage.setItem('ns_seenintro','1'); showScreen('nightshift');
    return loadChapter('nightshift').then(() => OuissysNightShift.start()); });
  await p.waitForFunction(() => window.OuissysNightShift && OuissysNightShift.__night,{timeout:20000,polling:200});
  const cdp = await p.context().newCDPSession(p);
  const snap = async (n) => { const {data} = await cdp.send('Page.captureScreenshot',{format:'png'});
    fs.writeFileSync(OUT+'/'+n+'.png', Buffer.from(data,'base64')); };

  await p.evaluate(() => { const N = OuissysNightShift.__night;
    N.state().phase='play'; N.state().monitor=true; N.cam('arcade');
    const ov=document.getElementById('ns-overlay');
    if (ov){ov.innerHTML='';ov.hidden=true;ov.style.display='none';}
    const hud=document.getElementById('ns-hud'); if(hud)hud.style.display='none'; });

  /* a machine pulled over and shorting out */
  await p.evaluate(() => { const N = OuissysNightShift.__night;
    N.wreck('arcade', 12);
    for (let i=0;i<70;i++) N.wreckStep(0.05);
    N.fx('sparks','arcade',-1.6,1.05,-1.5,26,1.4);
    N.fx('fire','arcade',-1.6,0.25,-1.5,6,1.2);
    N.fx('smoke','arcade',-1.6,1.3,-1.5,4,1.3); });
  for (let i=0;i<6;i++) await p.evaluate(() => OuissysNightShift.__night.fxStep(0.05));
  await p.evaluate(() => OuissysNightShift.__night.render());
  await snap('1-catches');

  for (let i=0;i<50;i++) await p.evaluate(() => OuissysNightShift.__night.fxStep(0.05));
  await p.evaluate(() => OuissysNightShift.__night.render());
  console.log('  burning: ' + JSON.stringify(await p.evaluate(() => OuissysNightShift.__night.fxCount())));
  await snap('2-burning');

  /* and the blast */
  await p.evaluate(() => { const N = OuissysNightShift.__night;
    N.fxClear(); N.state().monitor=true; N.cam('office');
    N.fx('blast','office',-1.9,1.0,-0.9);
    N.fx('fire','office',-2.2,0.2,-0.9,6,1.2); });
  for (let i=0;i<8;i++) await p.evaluate(() => OuissysNightShift.__night.fxStep(0.04));
  await p.evaluate(() => OuissysNightShift.__night.render());
  console.log('  blast:   ' + JSON.stringify(await p.evaluate(() => OuissysNightShift.__night.fxCount())));
  await snap('3-blast');
  console.log('\n  written to ' + OUT);
  await b.close();
})();
