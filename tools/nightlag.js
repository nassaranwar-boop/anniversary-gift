/* IS IT GOING TO LAG ON HER MACHINE?

   Not answerable by timing frames in here. This container has no GPU:
   it renders through SwiftShader at about two-thirds of a frame a
   second, so a wall-clock frame time measured here says nothing at all
   about a laptop, and a setTimeout can come back a second late.

   What IS honest, and portable:

   - the CPU cost of the chapter's own step, which is everything the
     game does that is not drawing. This is the part that would be slow
     on any machine, and it is measured by calling playStep a thousand
     times with the renderer out of the loop.
   - what a frame actually asks the GPU for: draw calls, triangles,
     programs, textures, geometries. These are the numbers that decide
     whether a laptop struggles, and they are the same on every machine.
   - whether either grows over a night. A step that costs more at five
     in the morning than at midnight, or a scene that gains draw calls
     as it goes, is a leak, and a leak is what "it gets laggy after a
     while" actually is.
   - the size of the thing that has to be fetched before any of it runs. */
const { chromium } = require('playwright-core');

const ok = (name, pass, detail) => {
  console.log((pass ? '  PASS  ' : '  FAIL  ') + name + (detail ? '   ' + detail : ''));
  return pass ? 0 : 1;
};

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox','--no-proxy-server','--use-gl=swiftshader','--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  p.on('pageerror', e => console.log('PAGEERROR', e.message));
  const bytes = {};
  p.on('response', async (r) => { try {
    const u = r.url(); if (!u.startsWith('http://127.0.0.1')) return;
    const h = r.headers()['content-length'];
    if (h) bytes[u.split('/').pop().split('?')[0]] = +h;
  } catch (e) {} });
  await p.route('**/*', r => { const u = r.request().url();
    if (u.indexOf('book-scene.js') >= 0) return r.abort();
    return u.startsWith('http://127.0.0.1') ? r.continue() : r.abort(); });
  await p.goto('http://127.0.0.1:8899/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForTimeout(700);
  await p.evaluate(() => { try{localStorage.clear();}catch(e){} showScreen('nightshift');
    return loadChapter('nightshift').then(() => OuissysNightShift.start()); });
  await p.waitForFunction(() => Object.keys(OuissysNightShift.__night.cast()).length >= 4,
                          { timeout: 20000, polling: 200 });
  await p.evaluate(() => OuissysNightShift.__night.silence(true));

  let bad = 0;
  for (const night of [1, 3]) {
    const r = await p.evaluate((night) => {
      const w = OuissysNightShift.__night;
      w.begin(night);
      const s = w.state();
      const info = () => { const t = OuissysNightShift.__three();
        const i = t.renderer ? t.renderer.info : null;
        return i ? { calls: i.render.calls, tris: i.render.triangles,
                     geo: i.memory.geometries, tex: i.memory.textures,
                     prog: i.programs ? i.programs.length : 0 } : null; };
      /* warm, so the first-call compile is not counted as the cost */
      for (let i = 0; i < 200; i++) { if (s.phase !== 'play') break; w.pumpFrame(0.05); }
      const early = info();
      const t0 = performance.now();
      let n = 0;
      for (; n < 1000; n++) {
        if (s.phase === 'reveal') { w.route('keep'); continue; }
        if (s.phase === 'held') { w.route('heldOut'); continue; }
        if (s.phase === 'find') { w.route('findOut'); continue; }
        if (s.phase !== 'play') break;
        w.pumpFrame(0.016);
      }
      const stepMs = (performance.now() - t0) / Math.max(1, n);
      /* and again at the far end of the night */
      /* the last night hands its fifth hour to the film, and dying
         ends the measurement, so the far end of a night is three
         o'clock on night three and five on the others */
      s.hour = night >= 3 ? 3 : 5;
      s.power = Math.max(s.power, 60);
      for (let i = 0; i < 200; i++) { if (s.phase === 'reveal') { w.route('keep'); continue; }
        if (s.phase === 'held') { w.route('heldOut'); continue; }
        if (s.phase === 'find') { w.route('findOut'); continue; }
        if (s.phase !== 'play') break;
        s.power = 100;
        s.doors.left = s.doors.right = s.doors.hatch = true;
        w.pumpFrame(0.05); }
      /* she cannot be allowed to die in the middle of a measurement:
         doors shut and the meter held up, so what is timed is a frame
         of the late night rather than the length of a game over */
      const t1 = performance.now();
      let m = 0;
      for (; m < 1000; m++) {
        if (s.phase === 'reveal') { w.route('keep'); continue; }
        if (s.phase === 'held') { w.route('heldOut'); continue; }
        if (s.phase === 'find') { w.route('findOut'); continue; }
        if (s.phase !== 'play') break;
        s.power = 100;
        s.doors.left = s.doors.right = s.doors.hatch = true;
        w.pumpFrame(0.016);
      }
      const lateMs = (performance.now() - t1) / Math.max(1, m);
      const lateWhy = m ? null : ('phase was ' + s.phase + ' at hour ' + s.hour);
      const late = info();
      const heap = performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null;
      return { early: early, late: late, stepMs: +stepMs.toFixed(3),
               lateMs: +lateMs.toFixed(3), n: n, m: m, heap: heap, lateWhy: lateWhy };
    }, night);

    console.log('\n=== NIGHT ' + night + ' ===');
    console.log('  the chapter\'s own step, midnight:  ' + r.stepMs.toFixed(3) + 'ms  (' + r.n + ' frames)');
    console.log('  and at the far end of the night:   ' + r.lateMs.toFixed(3) + 'ms  (' + r.m + ' frames)' +
                (r.lateWhy ? '   [' + r.lateWhy + ']' : ''));
    if (r.early) console.log('  a frame asks the card for:  ' + r.early.calls + ' draw calls, ' +
      r.early.tris + ' triangles, ' + r.early.geo + ' geometries, ' + r.early.tex + ' textures, ' +
      r.early.prog + ' programs');
    if (r.late) console.log('  and at the end of the night: ' + r.late.calls + ' draw calls, ' +
      r.late.tris + ' triangles, ' + r.late.geo + ' geometries, ' + r.late.tex + ' textures');
    if (r.heap != null) console.log('  javascript heap: ' + r.heap + 'MB');

    /* SIXTEEN MILLISECONDS IS THE WHOLE FRAME, AND THE DRAWING HAS TO
       FIT IN IT TOO. Four is a generous ceiling for the logic. */
    bad += ok('night ' + night + ': the step costs under 4ms of CPU a frame',
              r.stepMs < 4 && r.lateMs < 4, r.stepMs + 'ms / ' + r.lateMs + 'ms');
    bad += ok('night ' + night + ': and it does not get slower as the night goes on',
              r.lateMs < Math.max(1.6, r.stepMs * 2.2), r.stepMs + 'ms -> ' + r.lateMs + 'ms');
    if (r.early && r.late) {
      bad += ok('night ' + night + ': the scene does not gain geometry over a night',
                r.late.geo <= r.early.geo + 24 && r.late.tex <= r.early.tex + 6,
                r.early.geo + '->' + r.late.geo + ' geo, ' + r.early.tex + '->' + r.late.tex + ' tex');
      /* WHAT THE DRAW-CALL NUMBER ACTUALLY MEANS.

         Measured: 402 calls for 7,910 triangles on night one and 490
         for 15,250 on night three -- and geometries EQUALS calls, to
         the unit, on both. Nothing in the shop is merged or
         instanced; every prop, every drawer front, every little thing
         on the desk is its own mesh with its own geometry. Thirty
         triangles per call is nearly all overhead.

         It is not a fault today. A laptop from the last decade draws
         a thousand calls at sixty frames a second without noticing,
         and the chapter's own logic costs a fiftieth of a millisecond
         a frame, so if this ever runs badly the draw calls are where
         to look first and the only place. Nine hundred is where it
         would start to cost a weak machine real frames, so that is
         the line -- and it leaves room to see the number grow rather
         than only to see it break. */
      bad += ok('night ' + night + ': a frame stays under 900 draw calls',
                r.late.calls < 900, r.late.calls + ' calls, ' + r.late.tris + ' triangles, ' +
                Math.round(r.late.tris / Math.max(1, r.late.calls)) + ' triangles per call');
    }
  }

  const total = Object.keys(bytes).reduce((a, k) => a + bytes[k], 0);
  const big = Object.keys(bytes).sort((a, c) => bytes[c] - bytes[a]).slice(0, 6);
  console.log('\n=== WHAT HAS TO ARRIVE BEFORE ANY OF IT RUNS ===');
  big.forEach(k => console.log('  ' + String(Math.round(bytes[k] / 1024)).padStart(6) + 'KB  ' + k));
  console.log('  ' + Math.round(total / 1024) + 'KB in all, over ' + Object.keys(bytes).length + ' files');

  console.log('\n' + (bad ? bad + ' failed' : 'nothing here would lag'));
  process.exitCode = bad ? 1 : 0;
  await b.close();
})();
