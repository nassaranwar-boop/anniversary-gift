/* The power budget, measured rather than guessed. Plays every night as
   an attentive guard would — a door shut only while something is
   actually at it, the monitor up a fifth of the time — and prints where
   the meter lands. Night one should finish comfortable and night six on
   fumes; if that curve is not monotonic, TUNE.power is wrong. */
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
  await p.evaluate(() => { try{localStorage.clear();}catch(e){} showScreen('nightshift'); OuissysNightShift.start(); });
  await p.waitForFunction(() => Object.keys(OuissysNightShift.__night.cast()).length >= 4, { timeout: 20000, polling: 200 });
  await p.evaluate(() => OuissysNightShift.__night.silence(true));
  for (const night of [1,1,2,3,4,5,6,6]) {
    const r = await p.evaluate((night) => {
      const w = OuissysNightShift.__night;
      w.route('night:' + night); w.route('go');
      const s = w.state();
      let t = 0, doorSec = 0, camSec = 0;
      while (s.phase === 'play' && t < 460) {
        const cs = w.cast();
        ['left','right','hatch'].forEach(d => {
          let want = false;
          for (const k in cs) if (cs[k].awake && cs[k].atDoor && cs[k].def.door === d) want = true;
          if (want !== s.doors[d]) w.press(d);
        });
        s.monitor = (t % 20) < 4;
        /* she does what the note says: keeps the four wound. Measuring a
           budget against somebody who ignores the core mechanic measures
           the wrong game. */
        if (t % 40 === 0) {
          ['cogsworth','chime','marabelle','jax'].forEach(k => {
            if (cs[k] && (cs[k].wound || 0) < 2.5) { cs[k].wound = 9; s.power -= 1.0; }
          });
        }
        if (s.monitor) camSec += 0.5;
        doorSec += ((s.doors.left?1:0)+(s.doors.right?1:0)+(s.doors.hatch?1:0)) * 0.5;
        w.pump(0.5, 0.25); t += 0.5;
      }
      return { night, phase: s.phase, hour: s.hour, power: +s.power.toFixed(1), dead: s.dead,
               doorSec, camSec, knocks: s.stats.knocks, returns: s.stats.returns,
               wound: OuissysNightShift.__night.wind().count };
    }, night);
    console.log('night', r.night, r.phase, 'hr', r.hour, 'power', r.power + '%',
                r.dead || '', '| door', r.doorSec, 'cam', r.camSec, 'knocks', r.knocks,
                '| returners at the door', r.returns, '| still wound', r.wound);
  }
  await b.close();
})();
