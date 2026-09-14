/* IS THERE ACTUALLY MUSIC IN EVERY CUE, AND IS IT LEVEL WITH THE REST?

   seamcheck asks whether two cues can hand over without putting a wrong
   note in the air. It cannot tell you that a cue is SILENT: a handover
   from something to nothing has no clash in it and passes clean. Nor
   can it tell you that one cue is twice as loud as the two either side
   of it, which is the other way a score goes wrong -- not a bad chord,
   just a scene that shouts.

   So this renders every cue the chapter uses, on its own, offline, and
   measures three things:

     level     the RMS of the whole render. A cue under the floor is a
               scene with no music in it, which is a bug every time,
               because every one of these is named in a shot.
     peak      the loudest sample. Over 1.0 is clipping, which in an
               offline render means it is clipping in the game too.
     onsets    how many times the energy jumps. A pad with no notes in
               it has a level and no onsets, and reads as music in a
               meter and as a drone to a person.

   It reads the cue list out of the film itself, so a cue added to a
   shot is checked from the moment it is added and a cue nobody plays
   is not.
                                                node tools/cuecheck.js */
const { chromium } = require('playwright-core');
const fs = require('fs');

let pass = 0, fail = 0;
const ok = (n, c, x) => { if (c) { pass++; console.log('  ok   ' + n); }
                          else { fail++; console.log('  FAIL ' + n + (x !== undefined ? '  ' + JSON.stringify(x) : '')); } };

const src = fs.readFileSync(__dirname + '/../night-shift.js', 'utf8');
/* the cues the last hour actually plays, in the order it plays them */
const FILM = (() => {
  const k = src.indexOf('shots: [', src.indexOf('  lastHour: {'));
  let d = 0, e = k + 8;
  for (; e < src.length; e++) {
    if (src[e] === '[') d++;
    else if (src[e] === ']') { if (!d) break; d--; }
  }
  const out = [];
  src.slice(k, e).replace(/cue: "(\w+)"/g, (m, c) => { if (out.indexOf(c) < 0) out.push(c); });
  return out;
})();
/* and the ones a night plays, which are not in any shot */
const SHIFT = ['night', 'found', 'held', 'dark', 'gone', 'brief', 'locked', 'dawn', 'menu'];

(async () => {
  const b = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox', '--no-proxy-server', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 800, height: 520 } });
  let errs = 0;
  p.on('pageerror', (e) => { errs++; console.log('PAGEERROR', e.message); });
  await p.route('**/*', (r) => {
    const u = r.request().url();
    if (u.indexOf('book-scene.js') >= 0) return r.abort();
    return u.startsWith('http://127.0.0.1') ? r.continue() : r.abort();
  });
  await p.goto('http://127.0.0.1:8899/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.evaluate(() => { localStorage.setItem('ns_seenintro', '1'); showScreen('nightshift');
    return loadChapter('nightshift').then(() => OuissysNightShift.start()); });
  await p.waitForFunction(() => window.OuissysNightShift && OuissysNightShift.__night,
                          { timeout: 20000, polling: 200 });

  const rows = [];
  for (const cue of FILM.concat(SHIFT)) {
    const buf = await p.evaluate(([c, s]) => OuissysNightShift.__night.offline('score:' + c, s),
                                 [cue, 14]);
    if (!buf) { console.log('  FAIL ' + cue + ': nothing rendered'); fail++; continue; }
    const L = buf.l, R = buf.r, rate = buf.rate;
    let sum = 0, peak = 0;
    const n = L.length;
    const env = [];
    const win = Math.floor(rate * 0.01);
    let acc = 0, c2 = 0;
    for (let i = 0; i < n; i++) {
      const v = (L[i] + R[i]) / 2;
      sum += v * v;
      const a = Math.abs(v);
      if (a > peak) peak = a;
      acc += v * v; c2++;
      if (c2 === win) { env.push(Math.sqrt(acc / win)); acc = 0; c2 = 0; }
    }
    const rms = Math.sqrt(sum / n);
    /* AN ONSET IS A RISE OUT OF A DIP, NOT A RISE OUT OF THE LAST
       WINDOW. Every cue here has a pad under it, so the envelope never
       returns to zero and a plain window-to-window ratio finds nothing
       at all -- the first cut of this check reported zero onsets for
       all twenty-seven cues, including the one that is nothing but a
       tick on every other step. So each window is measured against the
       QUIETEST of the fifteen before it, with a refractory gap so one
       note is not counted three times as it swells. */
    let onsets = 0, hold = 0;
    const sortedEnv = env.slice().sort((x, y) => x - y);
    const floorEnv = sortedEnv[Math.floor(sortedEnv.length * 0.25)] || 1e-9;
    for (let i = 18; i < env.length; i++) {
      if (hold > 0) { hold--; continue; }
      let dip = Infinity;
      for (let j = i - 18; j <= i - 4; j++) if (env[j] < dip) dip = env[j];
      if (env[i] > dip * 1.6 && env[i] > floorEnv * 1.25) { onsets++; hold = 8; }
    }
    rows.push({ cue, rms: +rms.toFixed(5), peak: +peak.toFixed(3), onsets });
  }

  console.log('');
  rows.forEach((r) => console.log('   ' + r.cue.padEnd(9) + ' rms ' + String(r.rms).padEnd(9)
                                  + ' peak ' + String(r.peak).padEnd(7) + ' onsets ' + r.onsets));
  console.log('');

  const quiet = rows.filter((r) => r.rms < 0.004).map((r) => [r.cue, r.rms]);
  ok('every cue the chapter plays has something in it', !quiet.length, quiet);
  const clip = rows.filter((r) => r.peak >= 1).map((r) => [r.cue, r.peak]);
  ok('and none of them clips', !clip.length, clip);
  const dead = rows.filter((r) => r.onsets < 3).map((r) => [r.cue, r.onsets]);
  ok('and every one of them is played rather than held', !dead.length, dead);
  /* level: the loudest cue against the median, so one scene cannot
     shout over the rest of the film */
  const sorted = rows.map((r) => r.rms).sort((a, b) => a - b);
  const mid = sorted[Math.floor(sorted.length / 2)];
  const loud = rows.filter((r) => r.rms > mid * 3.2).map((r) => [r.cue, +(r.rms / mid).toFixed(2)]);
  ok('and no cue is more than three times the level of the median', !loud.length, loud);

  ok('no page errors anywhere in that', !errs);
  console.log('\n' + pass + ' passed, ' + fail + ' failed   (' + rows.length + ' cues)\n');
  await b.close();
  process.exit(fail || errs ? 1 : 0);
})();
