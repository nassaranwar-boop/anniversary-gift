/* IS HE ACTUALLY DEEPER?

   The narrator chain drops him by a number of semitones, and the way
   it does that -- relabelling the samples with a different rate and
   then putting the tempo back -- is only correct relative to the rate
   the file really has. Get that number wrong and the shift silently
   goes the other way: the first version of the chain hardcoded 24000
   against Piper's 22050 medium voices, asked for a semitone down, and
   produced half a semitone UP on every single line. Nothing failed.
   Nothing looked wrong. The only way to know was to measure the pitch
   of the result.

   So this measures the pitch of the result.

     node tools/voicedepth.js <before-dir> <after-dir> [semitones]

   Both directories hold takes with matching names. It reports the
   median fundamental of each and the shift between them, and fails if
   the shift is not within a quarter-tone of what was asked for.     */
const fs = require('fs'), path = require('path');
const { chromium } = require('playwright-core');

const A = process.argv[2], B = process.argv[3];
const WANT = process.argv[4] === undefined ? -1.0 : Number(process.argv[4]);
if (!A || !B) { console.error('need a before and an after directory'); process.exit(1); }

const names = fs.readdirSync(A).filter((f) => /\.mp3$/.test(f) && fs.existsSync(path.join(B, f)));
if (!names.length) { console.error('no matching takes in both directories'); process.exit(1); }

/* decoding an mp3 by hand is a bad idea and there is a decoder right
   there in the browser, so the measurement runs in a page: decodeAudioData
   for the samples, autocorrelation for the pitch */
const MEASURE = `async (b64) => {
  const bin = atob(b64);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  const ctx = new (window.OfflineAudioContext || window.webkitOfflineAudioContext)(1, 128, 24000);
  const a = await ctx.decodeAudioData(buf.buffer);
  const x = a.getChannelData(0), r = a.sampleRate;
  const w = Math.floor(r * 0.045), hop = Math.floor(r * 0.02);
  const lo = Math.floor(r / 300), hi = Math.floor(r / 60);
  const out = [];
  for (let i = 0; i + w < x.length; i += hop) {
    let e = 0;
    for (let k = 0; k < w; k++) e += x[i + k] * x[i + k];
    if (Math.sqrt(e / w) < 0.02) continue;          // not voiced
    let mean = 0;
    for (let k = 0; k < w; k++) mean += x[i + k];
    mean /= w;
    let a0 = 0;
    for (let k = 0; k < w; k++) a0 += (x[i + k] - mean) * (x[i + k] - mean);
    let best = 0, bestV = 0;
    for (let lag = lo; lag < hi && lag < w; lag++) {
      let v = 0;
      for (let k = 0; k + lag < w; k++) v += (x[i + k] - mean) * (x[i + k + lag] - mean);
      if (v > bestV) { bestV = v; best = lag; }
    }
    if (best && bestV > 0.3 * a0) out.push(r / best);
  }
  out.sort((p, q) => p - q);
  return out.length ? out[out.length >> 1] : null;
}`;

(async () => {
  const b = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox', '--no-proxy-server'] });
  const p = await b.newPage();
  await p.goto('data:text/html,<title>f0</title>');
  const f0 = (file) => p.evaluate(eval('(' + MEASURE + ')'),
                                  fs.readFileSync(file).toString('base64'));

  let fail = 0;
  const shifts = [];
  console.log('%s %s %s %s', 'line'.padEnd(34), 'before'.padStart(10),
              'after'.padStart(10), 'semitones'.padStart(11));
  for (const n of names) {
    const before = await f0(path.join(A, n)), after = await f0(path.join(B, n));
    if (!before || !after) { console.log('  ' + n + '  no voiced frames'); fail++; continue; }
    const st = 12 * Math.log2(after / before);
    shifts.push(st);
    console.log('%s %s %s %s', n.replace(/\.mp3$/, '').padEnd(34),
                (before.toFixed(1) + ' Hz').padStart(10),
                (after.toFixed(1) + ' Hz').padStart(10),
                (st >= 0 ? '+' : '') + st.toFixed(2).padStart(10));
  }
  await b.close();
  shifts.sort((x, y) => x - y);
  const med = shifts[shifts.length >> 1];
  const off = Math.abs(med - WANT);
  console.log('\nmedian %s semitones, asked for %s',
              (med >= 0 ? '+' : '') + med.toFixed(2), WANT.toFixed(2));
  /* a quarter-tone, because a voice is not a tuning fork and the median
     of a read moves a little with what is being said */
  if (off > 0.5) { console.log('OFF BY ' + off.toFixed(2) + ' SEMITONES'); fail++; }
  else console.log('within a quarter-tone of it');
  process.exit(fail ? 1 : 0);
})();
