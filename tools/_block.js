/* WHEN A WRITTEN LINE IS NEVER SAID, WHAT WAS IN THE WAY?

   Plays a night, and from the moment the first line that ends up lost
   becomes due, counts every frame by what the queue was doing. */
const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox','--no-proxy-server','--use-gl=swiftshader','--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 1000, height: 700 } });
  p.on('pageerror', e => console.log('PAGEERROR', e.message));
  await p.route('**/*', r => { const u = r.request().url();
    if (u.indexOf('book-scene.js') >= 0) return r.abort();
    return u.startsWith('http://127.0.0.1') ? r.continue() : r.abort(); });
  await p.goto('http://127.0.0.1:8899/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForTimeout(600);
  await p.evaluate(() => { try{localStorage.clear();}catch(e){} showScreen('nightshift');
    return loadChapter('nightshift').then(() => OuissysNightShift.start()); });
  await p.waitForFunction(() => Object.keys(OuissysNightShift.__night.cast()).length >= 4, { timeout: 20000, polling: 200 });
  await p.evaluate(() => OuissysNightShift.__night.silence(true));
  const night = Number(process.argv[2] || 2);
  const r = await p.evaluate((night) => {
    const w = OuissysNightShift.__night;
    try { localStorage.setItem('ns_kept', JSON.stringify({
      1:1, n1:1, h1:2.1, 2:0, n2:1, h2:4.5, 3:1, n3:2, h3:1.3, 4:0, n4:2, h4:4.15 })); } catch (e) {}
    w.begin(night);
    const s = w.state(); const script = (w.words().tapes || {})[night] || [];
    const trace = []; let t = 0;
    while (t < 700) {
      if (s.phase === 'reveal') { w.route('keep'); continue; }
      if (s.phase === 'find') { w.route('findOut'); continue; }
      if (s.phase === 'held') { w.route('heldOut'); continue; }
      if (s.phase !== 'play') break;
      const cs = w.cast();
      ['left','right','hatch'].forEach(d => { let want = false;
        for (const k in cs) if (cs[k].awake && cs[k].atDoor && cs[k].def.door === d) want = true;
        if (want !== s.doors[d]) w.press(d); });
      if (Math.round(t*20) % 800 === 0) ['cogsworth','chime','marabelle','jax']
        .forEach(k => { if (cs[k] && (cs[k].wound || 0) < 3) { cs[k].wound = 9; s.power -= 1.0; } });
      const d = w.tapeDebug(), ts = w.talkState ? w.talkState() : {}, ov = w.overState ? w.overState() : {};
      const hourNow = s.hour + (s.hourT || 0) / 56;
      trace.push({ h: +hourNow.toFixed(2),
        st: (d.up || d.vox) ? ('saying: ' + String(d.line).slice(0, 38))
          : ts.on ? 'at the door'
          : (ov && ov.on) ? 'the four of them talking'
          : w.midState().on ? 'the first minute'
          : (ov && ov.why && ov.why !== 'off' && ov.why !== 'too early') ? ('overheard: ' + ov.why)
          : 'idle' });
      w.pumpFrame(0.05); t += 0.05;
    }
    const said = w.told();
    const lost = script.filter(x => !w.tapeSaid || true).filter(x => !said[x.t]);
    return { script: script.map(x => [x.h, x.t]), trace: trace, t: +t.toFixed(1) };
  }, night);
  /* which lines never appeared in the trace */
  const heard = new Set(r.trace.filter(x => x.st.indexOf('saying: ') === 0).map(x => x.st.slice(8)));
  const lost = r.script.filter(([h, t]) => !heard.has(String(t).slice(0, 38)));
  console.log('\nNIGHT ' + night + ': ' + r.t + 's.  lost ' + lost.length + ' of ' + r.script.length);
  if (!lost.length) { await b.close(); return; }
  const from = lost[0][0];
  console.log('  first lost line was due at ' + from + " o'clock:\n    " + lost[0][1].slice(0, 80));
  const bin = {};
  r.trace.filter(x => x.h >= from).forEach(x => {
    const k = x.st.indexOf('saying: ') === 0 ? 'saying something else' : x.st;
    bin[k] = (bin[k] || 0) + 0.05; });
  const tot = Object.values(bin).reduce((a, x) => a + x, 0);
  console.log('  from then to the end of the night, ' + Math.round(tot) + 's:');
  Object.keys(bin).sort((a,c)=>bin[c]-bin[a]).forEach(k =>
    console.log('    ' + String(Math.round(bin[k])).padStart(4) + 's  ' + k));
  const after = [];
  r.trace.filter(x => x.h >= from && x.st.indexOf('saying: ') === 0)
    .forEach(x => { const v = x.st.slice(8); if (after[after.length-1] !== v) after.push(v); });
  console.log('  what it said instead:');
  after.forEach(v => console.log('     ' + v));
  lost.forEach(([h,t]) => console.log('  LOST ' + h + '  ' + t.slice(0, 70)));
  await b.close();
})();
