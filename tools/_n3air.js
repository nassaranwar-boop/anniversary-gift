/* DOES EVERY CHOICE SHE MAKES EVER GET ANSWERED?

   One of the four tells her what it made of the thing she kept or
   burned, on the night after she decided. Five of those speeches
   exist. This plays all three nights in a row, as an attentive guard
   would, writing down every line said with the hour it landed on --
   and at the end, which of the five never got the air to happen in. */
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
  await p.waitForFunction(() => Object.keys(OuissysNightShift.__night.cast()).length >= 4,
                          { timeout: 20000, polling: 200 });
  await p.evaluate(() => OuissysNightShift.__night.silence(true));

  const keepAll = process.argv[2] !== 'burn';
  for (const night of [1, 2, 3]) {
    const r = await p.evaluate(({ night, keepAll }) => {
      const w = OuissysNightShift.__night;
      w.begin(night);
      const s = w.state();
      const log = []; let last = null, t = 0, quietFor = 0; const stalls = [];
      while (t < 1200) {
        if (s.phase === 'reveal') { w.route(keepAll ? 'keep' : 'burn'); continue; }
        if (s.phase === 'find')   { w.route('findOut'); continue; }
        if (s.phase === 'held')   { w.route('heldOut'); continue; }
        if (s.phase !== 'play') break;
        const cs = w.cast();
        /* ORIENTATION HOLDS THE CLOCK, AND IT IS RIGHT TO.
           Night one does not start until she has done the eighteen
           things it asks, so a harness that ignores it measures a
           night that never happens. */
        const tu = w.tutor(), tl = (tu && tu.line) || '';
        if (tl) {
          if (tl.indexOf('RAISE IT') >= 0) { if (!s.monitor) w.press('monitor'); }
          else if (tl.indexOf('STEP THROUGH') >= 0) { if (!s.monitor) w.press('monitor');
            else if (Math.round(t * 20) % 8 === 0) w.press('next'); }
          else if (tl.indexOf('LOWER IT') >= 0) { if (s.monitor) w.press('monitor'); }
          else if (tl.indexOf('WEST DOOR: CLOSE') >= 0) { if (!s.doors.left) w.press('left'); }
          else if (tl.indexOf('ALSO DRAWS. OPEN') >= 0) { if (s.doors.left) w.press('left'); }
          else if (tl.indexOf('HATCH: LATCH') >= 0) { if (!s.doors.hatch) w.press('hatch'); }
          else if (tl.indexOf('UNLATCH') >= 0) { if (s.doors.hatch) w.press('hatch'); }
          else if (tl.indexOf('FIND HIM') >= 0) { if (!s.monitor) w.press('monitor');
            else if (cs.cogsworth) w.cam(cs.cogsworth.room); }
          else if (tl.indexOf('KEY IN HIS BACK') >= 0) { if (cs.cogsworth) cs.cogsworth.wound = 9; }
          w.pumpFrame(0.05); t += 0.05; continue;
        }
        ['left','right','hatch'].forEach(d => { let want = false;
          for (const k in cs) if (cs[k].awake && cs[k].atDoor && cs[k].def.door === d) want = true;
          if (want !== s.doors[d]) w.press(d); });
        if (Math.round(t * 20) % 800 === 0) ['cogsworth','chime','marabelle','jax']
          .forEach(k => { if (cs[k] && (cs[k].wound || 0) < 3) { cs[k].wound = 9; s.power -= 1.0; } });
        w.pumpFrame(0.05); t += 0.05;
        const d = w.tapeDebug();
        if (d.line && d.line !== last) { last = d.line; quietFor = 0;
          log.push({ h: +s.hour.toFixed(2), who: d.who || 'HIM', t: d.line }); }
        else if (!d.up && !d.vox) {
          quietFor += 0.05;
          /* nothing said for half a minute with night left: write down
             what every gate in the queue was doing, once */
          if (quietFor > 30 && stalls.length < 4) { quietFor = 0;
            const ov = w.overState ? w.overState() : {}, ts = w.talkState ? w.talkState() : {};
            stalls.push({ h: +s.hour.toFixed(2), up: d.up, vox: d.vox, held: d.held,
              pending: !!w.tapeOwed, owed: w.tapeOwed(), talk: !!(ts && ts.on),
              overOn: !!(ov && ov.on), overWhy: (ov && ov.why) || null,
              overDone: !!(ov && ov.done), quiet: w.tapeQuiet ? undefined : undefined }); }
        } else quietFor = 0;
      }
      const script = (w.words().tapes || {})[night] || [];
      const said = {}; log.forEach(x => said[x.t] = 1);
      const lost = script.filter(x => !said[x.t]).map(x => x.h + '  ' + (x.who || 'him') + '  ' + x.t.slice(0, 70));
      return { phase: s.phase, hour: +s.hour.toFixed(2), secs: +t.toFixed(1), log: log, lost: lost, stalls: stalls,
               kept: JSON.parse(localStorage.getItem('ns_kept') || '{}') };
    }, { night, keepAll });

    console.log('\n' + '='.repeat(74));
    console.log('NIGHT ' + night + '  —  ended ' + r.phase + ' at ' + r.hour +
                " o'clock (" + r.secs + 's of play)   ' + r.log.length + ' lines');
    console.log('='.repeat(74));
    r.log.forEach(x => console.log('  ' + x.h.toFixed(2).padStart(5) +
                  '  ' + x.who.toUpperCase().padEnd(10) + ' ' + x.t.slice(0, 84)));
    if (r.lost.length) { console.log('\n  HIS WRITTEN LINES THAT NEVER GOT SAID (' + r.lost.length + '):');
      r.lost.forEach(x => console.log('    ' + x)); }
    else console.log('\n  every written tape line got said.');
    if (r.stalls && r.stalls.length) { console.log('  STALLS (30s+ of silence):');
      r.stalls.forEach(x => console.log('    ' + JSON.stringify(x))); }
  }

  const missed = await p.evaluate(() => {
    const w = OuissysNightShift.__night, NS = w.words();
    const told = w.told(), kept = JSON.parse(localStorage.getItem('ns_kept') || '{}');
    const out = [];
    for (const n in (NS.afterChoice || {})) {
      const set = NS.afterChoice[n];
      if (kept[n] == null) { out.push('choice ' + n + ': never offered'); continue; }
      const it = kept[n] === 1 ? set.kept : set.burned;
      if (it && !told[it.t]) out.push('choice ' + n + ' (' + it.who + ', ' +
        (kept[n] === 1 ? 'kept' : 'burned') + '): never answered');
    }
    for (const k in (NS.pointAt || {})) if (!told[NS.pointAt[k].t]) out.push('pointAt.' + k + ': never said');
    return out;
  });
  console.log('\n' + '='.repeat(74));
  console.log('AT THE END OF THREE NIGHTS:');
  console.log(missed.length ? missed.map(x => '  ' + x).join('\n') : '  everything got the air it needed');
  await b.close();
})();
