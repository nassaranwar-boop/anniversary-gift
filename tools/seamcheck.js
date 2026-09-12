/* DOES THE SCORE CHANGE KEY WITHOUT PUTTING A WRONG NOTE IN THE AIR?

   The chapter's cues live in two keys now -- the night in A minor, the
   letters and the morning in A major -- and they hand over to each
   other while the outgoing chord is still sounding, because a pad note
   is deliberately longer than its bar. That overlap used to be a blur.
   With a key under it, it is a C and a C sharp at the same time.

   Measured before the fix, on three handovers: dark into six o'clock
   and a death into his letter both put both thirds of A in the air
   across the seam, and the loudest level jump in a forty-second render
   landed exactly on it. This is the check that keeps that fixed.

   It looks for TONAL peaks only -- something standing well clear of
   the local noise floor -- because the air layer is broadband and a
   naive peak picker will happily name six notes in a hiss. And it
   samples the last third of each bar, away from note onsets, because
   the sung voice scoops up into every note from half a semitone below
   and a window containing that scoop reads it as the note underneath.
   Both of those were false alarms this tool raised before it was
   taught not to.
                                                node tools/seamcheck.js */
const { chromium } = require('playwright-core');

/* THE HANDOVERS THE GAME ACTUALLY MAKES, and only those.

   An earlier version of this list was every pairing that changes key,
   which included `held -> brief` -- a turn in the middle of a night
   handing straight over to the card before a night, which cannot
   happen: the turn goes back to the shift it interrupted. It failed,
   and the failure was the third harmonic of the grind layer's
   deliberate minor second reading as an F against the outgoing major.
   Testing a transition the chapter never performs is how you end up
   tuning the score to satisfy a test instead of a player. */
const SEAMS = [
  ['menu',  'film'],      // the title into his statement
  ['film',  'locked'],    // his statement into the terms
  ['brief', 'night'],     // the card into the shift
  ['night', 'found'],     // a shift into something he wrote
  ['found', 'night'],     // and back out of it
  ['night', 'dark'],      // the meter goes
  ['dark',  'night'],     // and comes back
  ['night', 'gone'],      // a death
  ['night', 'held'],      // one of his got there first
  ['held',  'night'],     // and back to work
  ['night', 'dawn'],      // six o'clock
  ['dawn',  'gallery'],   // the shop in daylight
  ['gallery', 'menu'],    // and home
];
const NAMES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
const name = (f) => {
  const m = Math.round(12 * Math.log2(f / 440) + 69);
  return NAMES[((m % 12) + 12) % 12];
};
/* the three pairs that cannot both be sounding: in A, the minor third
   against the major third, and the two leading notes */
const PAIRS = [['C', 'C#'], ['G', 'G#'], ['F', 'F#']];

function tones(seg, rate) {
  const N = 1 << 15;
  const re = new Float64Array(N), im = new Float64Array(N);
  const n = Math.min(N, seg.length);
  for (let i = 0; i < n; i++) re[i] = seg[i] * (0.5 - 0.5 * Math.cos(2 * Math.PI * i / n));
  /* a plain DFT over the band we care about is cheaper here than an
     FFT, because the band is 60 bins wide and the transform is 32768 */
  const lo = 230, hi = 780, out = [], mag = [], freq = [];
  const step = rate / N;
  for (let k = Math.floor(lo / step); k < hi / step; k++) {
    let a = 0, b = 0;
    for (let i = 0; i < n; i += 2) {            // every other sample: plenty
      const w = -2 * Math.PI * k * i / N;
      a += re[i] * Math.cos(w); b += re[i] * Math.sin(w);
    }
    mag.push(Math.hypot(a, b)); freq.push(k * step);
  }
  const sorted = mag.slice().sort((x, y) => x - y);
  const floor = sorted[Math.floor(sorted.length * 0.5)] || 1e-9;
  const idx = mag.map((m, i) => i).sort((i, j) => mag[j] - mag[i]);
  for (const i of idx) {
    if (mag[i] < 6 * floor) break;
    if (out.every((f) => Math.abs(freq[i] - f) > 7)) out.push(freq[i]);
    if (out.length >= 8) break;
  }
  return out.map(name);
}

(async () => {
  const b = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox','--no-proxy-server','--use-gl=swiftshader','--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 900, height: 600 } });
  let errs = 0;
  p.on('pageerror', (e) => { errs++; console.log('PAGEERROR', e.message); });
  await p.route('**/*', (r) => {
    const u = r.request().url();
    if (u.indexOf('book-scene.js') >= 0) return r.abort();
    return u.startsWith('http://127.0.0.1') ? r.continue() : r.abort();
  });
  await p.goto('http://127.0.0.1:8899/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.evaluate(() => { try { localStorage.clear(); } catch (e) {}
    localStorage.setItem('ns_seenintro', '1'); showScreen('nightshift');
    return loadChapter('nightshift').then(() => OuissysNightShift.start()); });
  await p.waitForFunction(() => window.OuissysNightShift && OuissysNightShift.__night,
                          { timeout: 20000, polling: 200 });

  let pass = 0, fail = 0;
  for (const [a, c] of SEAMS) {
    const buf = await p.evaluate(([w, s]) => OuissysNightShift.__night.offline(w, s),
                                 ['cross:' + a + '>' + c, 26]);
    if (!buf) { console.log('  FAIL ' + a + ' -> ' + c + '  nothing rendered'); fail++; continue; }
    const rate = buf.rate, L = buf.l, R = buf.r;
    const mono = new Float64Array(L.length);
    for (let i = 0; i < L.length; i++) mono[i] = (L[i] + R[i]) / 2;
    const swap = L.length / rate / 2;
    /* right across the handover, in 0.35s looks */
    /* A CLASH HAS TO LAST. A sung note arrives at its pitch from
       about a third of a semitone below over a tenth of a second, on
       purpose, and a single window that happens to contain that
       attack will read the note underneath as sounding. So a pair only
       counts if it is still there a quarter of a second later, which
       no attack is. This tool cried wolf on six seams before it was
       taught that, and the cues themselves were clean. */
    const at = (off) => {
      const i = Math.floor((swap + off) * rate);
      if (i < 0 || i + rate * 0.3 > mono.length) return null;
      return tones(mono.subarray(i, i + Math.floor(rate * 0.3)), rate);
    };
    const bad = [];
    for (const off of [-0.4, 0.05, 0.3, 0.6, 1.0, 1.5]) {
      const a1 = at(off), a2 = at(off + 0.25);
      if (!a1 || !a2) continue;
      for (const [x, y] of PAIRS) {
        const both = (n) => n.indexOf(x) >= 0 && n.indexOf(y) >= 0;
        if (both(a1) && both(a2)) bad.push(off.toFixed(2) + 's ' + x + '+' + y);
      }
    }
    if (bad.length) { console.log('  FAIL ' + a + ' -> ' + c + '  ' + bad.join(', ')); fail++; }
    else { console.log('  ok   ' + a + ' -> ' + c); pass++; }
  }
  await b.close();
  console.log('\n' + pass + ' clean seams, ' + fail + ' with a wrong note in them'
              + (errs ? ', ' + errs + ' page errors' : ''));
  process.exit(fail || errs ? 1 : 0);
})();
