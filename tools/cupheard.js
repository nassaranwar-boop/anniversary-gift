/* DOES ANY OF IT ACTUALLY MAKE A SOUND?
 *
 * tools/cupsfx.js counts the calls, which answers "is this sound ever
 * asked for" and cannot answer "does asking for it produce anything".
 * Those are different questions and the second one is the one that
 * bites: a sound built out of a filter with the wrong Q, or a buffer
 * that is not ready yet, fires exactly as often as a working one and
 * is silent.
 *
 * So this hangs a meter on the effects bus and fires every sound in
 * the bank one at a time, with a gap, and reports the peak each one
 * reached. Nought is a sound that does not exist.
 *
 *   node tools/cupheard.js
 */
const { chromium } = require('playwright-core');
let pass = 0, fail = 0;
const ok = (n, c, x) => { if (c) { pass++; console.log('  ok   ' + n + (x !== undefined ? '  ' + x : '')); }
                          else { fail++; console.log('  FAIL ' + n + (x !== undefined ? '  ' + x : '')); } };
(async () => {
  const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args:['--no-sandbox','--no-proxy-server','--autoplay-policy=no-user-gesture-required'] });
  const p = await b.newPage({ viewport:{width:900,height:560} });
  const errs = []; p.on('pageerror', e=>errs.push(e.message));
  await p.route('**/*', r=>r.request().url().startsWith('http://127.0.0.1')?r.continue():r.abort());
  await p.goto('http://127.0.0.1:8899/index.html',{waitUntil:'domcontentloaded',timeout:60000});
  await p.waitForTimeout(700);
  await p.evaluate(()=>window.loadChapter&&window.loadChapter('cup'));
  await p.waitForFunction(()=>!!window.OuissyCup,{timeout:30000});
  await p.evaluate(()=>{try{localStorage.clear();}catch(e){} showScreen('cup'); OuissyCup.start();});
  await p.waitForTimeout(600);
  /* the audio context has to exist, so a match is started and then
     STOPPED: a match still running is a crowd bed and a band playing
     under every reading. */
  await p.evaluate(()=>{ const H=OuissyCup.__cup; H.quick(0);
    for(let i=0;i<300 && H.state() && H.state().state!=='play';i++) H.step(1,0,0,false); });
  await p.waitForTimeout(300);
  await p.evaluate(()=>OuissyCup.stop());
  await p.waitForTimeout(500);

  const r = await p.evaluate(async () => {
    const H = OuissyCup.__cup;
    const B = H.buses();
    if (!B.ctx || !B.sfx) return { err: 'no buses' };
    const an = B.ctx.createAnalyser();
    an.fftSize = 2048;
    B.sfx.connect(an);
    const buf = new Float32Array(an.fftSize);
    /* A TIGHT LOOP, NOT AN AWAIT.

       The first version of this slept eight milliseconds between
       readings, which is fine on an idle page and useless on this one:
       the match renders at about three frames a second in this
       container, so each await came back a third of a second later and
       every sound was sampled once, at a random moment. It reported a
       louder sound as silent and a quieter one as fine, in the same
       run. The audio thread fills the analyser whatever the main
       thread is doing, so blocking it is exactly the right thing to
       do here. */
    const peakOver = (ms) => {
      let peak = 0;
      const t0 = performance.now();
      while (performance.now() - t0 < ms) {
        an.getFloatTimeDomainData(buf);
        for (let i = 0; i < buf.length; i++) {
          const v = Math.abs(buf[i]);
          if (v > peak) peak = v;
        }
      }
      return +peak.toFixed(4);
    };
    const SFX = H.sfx();
    const out = {};
    out.floor = peakOver(200);       // what the match alone is doing
    const names = Object.keys(SFX);
    for (const n of names) {
      try { SFX[n](0.8); } catch (e) { out[n] = 'THREW: ' + e.message; continue; }
      out[n] = peakOver(420);
    }
    return out;
  });

  if (r.err) { console.log(r.err); process.exit(1); }
  const floor = r.floor;
  console.log('  the match on its own peaks at ' + floor);
  const dead = [], threw = [];
  Object.keys(r).forEach(n => {
    if (n === 'floor') return;
    if (typeof r[n] === 'string') { threw.push(n + ' ' + r[n]); return; }
    console.log('   ' + n.padEnd(14) + String(r[n]).padStart(8) +
                (r[n] <= floor + 0.004 ? '   <-- SILENT' : ''));
    if (r[n] <= floor + 0.004) dead.push(n);
  });
  ok('nothing in the bank throws', threw.length === 0, threw.join(' | '));
  ok('every sound in the bank makes a sound', dead.length === 0, dead.join(', '));
  ok('no page errors', errs.length === 0, errs.slice(0,2).join(' | '));
  console.log('');
  console.log(fail ? pass + ' passed, ' + fail + ' FAILED' : 'all ' + pass + ' checks passed');
  await b.close();
  process.exit(fail ? 1 : 0);
})();
