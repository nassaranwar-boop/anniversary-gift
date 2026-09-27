/* HOW LOUD IS THE MENU, REALLY.
 *
 * A cue can report "on" and still be inaudible, and the container's audio
 * clock runs tens of times faster than the wall clock, so awaiting
 * milliseconds samples a fader once at random. Everything here is measured
 * in a tight loop on the context clock instead. It meters the menu score,
 * then the same bus under a running match, so the two can be compared
 * rather than guessed at.
 *
 *   node tools/_music.js
 */
const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args:['--no-sandbox','--no-proxy-server','--autoplay-policy=no-user-gesture-required'] });
  const p = await b.newPage({ viewport:{width:1000,height:640} });
  p.on('pageerror', e=>console.log('ERR '+e.message));
  await p.route('**/*', r=>r.request().url().startsWith('http://127.0.0.1')?r.continue():r.abort());
  await p.goto('http://127.0.0.1:8899/index.html',{waitUntil:'domcontentloaded',timeout:60000});
  await p.waitForTimeout(700);
  await p.evaluate(()=>window.loadChapter&&window.loadChapter('cup'));
  await p.waitForFunction(()=>!!window.OuissyCup,{timeout:30000});
  await p.evaluate(()=>{try{localStorage.clear();}catch(e){} showScreen('cup'); OuissyCup.start();});
  const settle = async (n)=>{ await p.waitForFunction((x)=>OuissyCup.__cup.ui().name===x,n,{timeout:60000});
                              await p.waitForFunction(()=>OuissyCup.__cup.ui().age>1.4,null,{timeout:120000,polling:200}); };
  const meter = (which, ms) => p.evaluate(({which, ms}) => {
    const B = OuissyCup.__cup.buses();
    if (!B.ctx || !B[which]) return 'no bus';
    const an = B.ctx.createAnalyser(); an.fftSize = 2048;
    B[which].connect(an);
    const buf = new Float32Array(an.fftSize);
    let peak = 0, sum = 0, n = 0; const t0 = performance.now();
    while (performance.now() - t0 < ms) {
      an.getFloatTimeDomainData(buf);
      for (let i = 0; i < buf.length; i++) {
        const v = Math.abs(buf[i]);
        if (v > peak) peak = v;
        sum += v * v; n++;
      }
    }
    B[which].disconnect(an);
    return { peak: +peak.toFixed(4), rms: +Math.sqrt(sum/Math.max(1,n)).toFixed(5),
             db: +(20*Math.log10(Math.max(1e-6, Math.sqrt(sum/Math.max(1,n))))).toFixed(1) };
  }, {which, ms});

  await settle('help');
  await p.evaluate(()=>OuissyCup.__cup.press('card_go'));
  await settle('title');
  console.log('menu cue:   ' + JSON.stringify(await p.evaluate(()=>OuissyCup.__cup.score())));
  console.log('menu heard: ' + JSON.stringify(await meter('music', 3000)));

  /* and the same bus with a match under it, which is the level the menu
     has to sit beside without sounding like a different game */
  await p.evaluate(()=>{ OuissyCup.__cup.quick(0); OuissyCup.__cup.auto(true); });
  await p.waitForTimeout(600);
  console.log('state:      ' + JSON.stringify(await p.evaluate(()=>OuissyCup.__cup.state())));
  console.log('match cue:  ' + JSON.stringify(await p.evaluate(()=>OuissyCup.__cup.score())));
  console.log('match heard:' + JSON.stringify(await meter('music', 3000)));
  await b.close();
})();
