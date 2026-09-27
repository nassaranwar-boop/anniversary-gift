/* WHERE THE SECONDS OF A NIGHT ACTUALLY GO.

   Lines written into the end of a night were never being said. This
   plays a night and accounts for every frame of it: speaking, the gap
   after a line, held off by a door, held off by the first minute, or
   simply nothing due. If the answer is "speaking", the night is
   over-written and prose has to go. If it is anything else, the night
   is long enough and something is standing in the way. */
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
  const night = Number(process.argv[2] || 3);
  const r = await p.evaluate((night) => {
    const w = OuissysNightShift.__night;
    /* the earlier choices, so the night owes what it really owes */
    try { localStorage.setItem('ns_kept', JSON.stringify({
      1:1, n1:1, h1:2.1, 2:0, n2:1, h2:4.5, 3:1, n3:2, h3:1.3, 4:0, n4:2, h4:4.15 })); } catch (e) {}
    w.begin(night);
    const s = w.state(); const bin = {}; let t = 0;
    const add = (k) => { bin[k] = (bin[k] || 0) + 0.05; };
    while (t < 700) {
      if (s.phase === 'reveal') { w.route('keep'); continue; }
      if (s.phase === 'find') { w.route('findOut'); continue; }
      if (s.phase === 'held') { w.route('heldOut'); continue; }
      if (s.phase !== 'play') break;
      const cs = w.cast();
      const tu = w.tutor(), tl = (tu && tu.line) || '';
      if (tl) {
        if (tl.indexOf('RAISE IT') >= 0) { if (!s.monitor) w.press('monitor'); }
        else if (tl.indexOf('STEP THROUGH') >= 0) { if (!s.monitor) w.press('monitor');
          else if (Math.round(t*20) % 8 === 0) w.press('next'); }
        else if (tl.indexOf('LOWER IT') >= 0) { if (s.monitor) w.press('monitor'); }
        else if (tl.indexOf('WEST DOOR: CLOSE') >= 0) { if (!s.doors.left) w.press('left'); }
        else if (tl.indexOf('ALSO DRAWS. OPEN') >= 0) { if (s.doors.left) w.press('left'); }
        else if (tl.indexOf('HATCH: LATCH') >= 0) { if (!s.doors.hatch) w.press('hatch'); }
        else if (tl.indexOf('UNLATCH') >= 0) { if (s.doors.hatch) w.press('hatch'); }
        else if (tl.indexOf('FIND HIM') >= 0) { if (!s.monitor) w.press('monitor');
          else if (cs.cogsworth) w.cam(cs.cogsworth.room); }
        else if (tl.indexOf('KEY IN HIS BACK') >= 0) { if (cs.cogsworth) cs.cogsworth.wound = 9; }
        w.pumpFrame(0.05); t += 0.05; add('orientation'); continue;
      }
      ['left','right','hatch'].forEach(d => { let want = false;
        for (const k in cs) if (cs[k].awake && cs[k].atDoor && cs[k].def.door === d) want = true;
        if (want !== s.doors[d]) w.press(d); });
      if (Math.round(t*20) % 800 === 0) ['cogsworth','chime','marabelle','jax']
        .forEach(k => { if (cs[k] && (cs[k].wound || 0) < 3) { cs[k].wound = 9; s.power -= 1.0; } });
      const d = w.tapeDebug(), ts = w.talkState ? w.talkState() : {}, ov = w.overState ? w.overState() : {};
      if (d.up || d.vox) add('speaking');
      else if (ts && ts.on) add('at the door');
      else if (w.midState().on) add('the first minute');
      else if (ov && ov.why && ov.why !== 'off' && ov.why !== 'too early') add('overheard waiting: ' + ov.why);
      else add('quiet — nothing said');
      w.pumpFrame(0.05); t += 0.05;
    }
    return { bin: bin, t: +t.toFixed(1), phase: s.phase, owed: w.tapeOwed() };
  }, night);
  console.log('\nNIGHT ' + night + ': ' + r.t + 's of play, ended ' + r.phase);
  Object.keys(r.bin).sort((a,c) => r.bin[c]-r.bin[a]).forEach(k =>
    console.log('   ' + String(Math.round(r.bin[k])).padStart(4) + 's  ' +
                String(Math.round(r.bin[k]/r.t*100)).padStart(3) + '%  ' + k));
  await b.close();
})();
