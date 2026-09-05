/* Is a night ever boring? Walk one minute at a time and record what
   actually happened in it: arrivals, cues, false alarms, props that
   moved, and how frightened the score was. A minute with nothing in
   it at all is a minute she will spend looking at her phone. */
const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox','--no-proxy-server','--use-gl=swiftshader','--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 1000, height: 700 } });
  const errs = []; p.on('pageerror', e => { errs.push(e.message); console.log('PAGEERROR', e.message); });
  await p.route('**/*', r => {
    const u = r.request().url();
    if (u.indexOf('book-scene.js') >= 0) return r.abort();
    return u.startsWith('http://127.0.0.1') ? r.continue() : r.abort();
  });
  await p.goto('http://127.0.0.1:8899/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForTimeout(600);
  await p.evaluate(() => { try{localStorage.clear();}catch(e){} showScreen('nightshift'); OuissysNightShift.start(); });
  await p.waitForFunction(() => Object.keys(OuissysNightShift.__night.cast()).length >= 4, { timeout: 20000, polling: 200 });
  await p.evaluate(() => OuissysNightShift.__night.silence(true));
  for (const night of [1, 1, 2, 4, 6]) {
    const r = await p.evaluate((night) => {
      const w = OuissysNightShift.__night;
      w.route('night:' + night); w.route('go');
      const s = w.state();
      const hours = [];
      for (let h = 0; h < 6; h++) {
        const a0 = s.stats.arrivals, s0 = s.stats.shifts, k0 = s.stats.knocks, al0 = s.stats.alarms, m0 = s.stats.moves;
        let t = 0, quiet = 0, longestQuiet = 0;
        while (t < 56 && s.phase === 'play') {
          const before = s.stats.arrivals + s.stats.shifts + s.stats.knocks + s.stats.surges + s.stats.alarms + s.stats.moves;
          // an attentive guard: door only when something is there
          const cs = w.cast();
          ['left','right','hatch'].forEach(d => {
            let want = false;
            for (const k in cs) if (cs[k].awake && cs[k].atDoor && cs[k].def.door === d) want = true;
            if (want !== s.doors[d]) w.press(d);
          });
          w.pump(1, 0.25);
          t += 1;
          const after = s.stats.arrivals + s.stats.shifts + s.stats.knocks + s.stats.surges + s.stats.alarms + s.stats.moves;
          const anyClose = Object.keys(cs).some(k => cs[k].awake &&
            cs[k].step >= cs[k].def.route.length - 2);
          if (after === before && !anyClose) { quiet++; longestQuiet = Math.max(longestQuiet, quiet); }
          else quiet = 0;
        }
        hours.push({ h, arr: s.stats.arrivals - a0, shifts: s.stats.shifts - s0,
                     knocks: s.stats.knocks - k0, alarms: s.stats.alarms - al0,
                     moves: s.stats.moves - m0, longestQuiet });
        if (s.phase !== 'play') break;
      }
      return { night, phase: s.phase, hours };
    }, night);
    console.log('night', r.night, r.phase);
    r.hours.forEach(h => console.log('   hour', h.h, '| moves', h.moves, 'arrivals', h.arr,
      'alarms', h.alarms, 'shifts', h.shifts, 'knocks', h.knocks,
      '| longest dead stretch', h.longestQuiet + 's'));
  }
  console.log('errors:', errs.length);
  await b.close();
})();
