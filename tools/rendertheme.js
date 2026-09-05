/* Render the score to a WAV, outside the browser.

   The game synthesises it live through Web Audio, which nobody can
   listen to from a terminal. This is the same written music and the
   same voices done numerically, so the tune can be heard on its own —
   and so a wrong note is audible rather than theoretical. */
const fs = require('fs');
/* 22 kHz mono is plenty for a preview of a piano and some strings, and
   it is a quarter of the file */
const SR = Number(process.env.SR || 22050);

const src = fs.readFileSync(__dirname + '/../apocalypse.js', 'utf8');
/* pull the written music straight out of the game, so this can never
   drift away from what actually plays */
function grabArray(name) {
  const i = src.indexOf('var ' + name + ' = [');
  const j = src.indexOf('];', i);
  const body = src.slice(src.indexOf('[', i), j + 1)
    .replace(/\/\*[\s\S]*?\*\//g, '');
  return eval(body);
}
const TUNE = grabArray('TUNE');
const WARM = grabArray('WARM');
const UNDER = grabArray('UNDER');
const CHORDS = grabArray('CHORDS');
const ROOTS = grabArray('ROOTS');

const A0 = 27.5;
const hz = (semi, oct) => A0 * Math.pow(2, (semi / 12) + 4 + (oct || 0));

function mix(buf, at, samples) {
  const start = Math.floor(at * SR);
  for (let i = 0; i < samples.length; i++) {
    const k = start + i;
    if (k >= 0 && k < buf.length) buf[k] += samples[i];
  }
}
function env(n, a, d, s, r, len) {
  const out = new Float32Array(n);
  const A = a * SR, D = d * SR, R = r * SR, L = len * SR;
  for (let i = 0; i < n; i++) {
    let v;
    if (i < A) v = i / A;
    else if (i < A + D) v = 1 - (1 - s) * ((i - A) / D);
    else if (i < L - R) v = s;
    else v = Math.max(0, s * (1 - (i - (L - R)) / R));
    out[i] = v;
  }
  return out;
}
function piano(f, v, len) {
  const n = Math.floor((len + 0.2) * SR), o = new Float32Array(n);
  const parts = [[1, 1.0, 1.00], [2, 0.34, 0.55], [3, 0.13, 0.34]];
  for (const [h, amp, dec] of parts) {
    const fr = f * h * (1 + h * 0.0004), w = 2 * Math.PI * fr / SR;
    for (let i = 0; i < n; i++) {
      const e = Math.exp(-i / (dec * len * SR / 3));
      o[i] += Math.sin(w * i) * amp * e;
    }
  }
  /* a little lowpass so it is not glassy */
  let p = 0;
  for (let i = 0; i < n; i++) { p += (o[i] - p) * 0.22; o[i] = p * v; }
  return o;
}
function bowed(f, v, len, cut) {
  const n = Math.floor((len + 0.3) * SR), o = new Float32Array(n);
  const e = env(n, Math.min(1.4, len * 0.35), 0.1, 1, Math.min(1.2, len * 0.3), len);
  for (const cents of [-4, 4]) {
    const fr = f * Math.pow(2, cents / 1200);
    let ph = 0;
    for (let i = 0; i < n; i++) {
      const vib = 1 + Math.sin(2 * Math.PI * 4.7 * i / SR) * 0.0026;
      ph += fr * vib / SR; ph -= Math.floor(ph);
      o[i] += (2 * ph - 1) * 0.5;            /* saw */
    }
  }
  let p = 0, k = (cut || 1400) / (SR / 2) * 1.4;
  for (let i = 0; i < n; i++) { p += (o[i] - p) * k; o[i] = p * e[i] * v; }
  return o;
}

/* ---- arrange one cue ---- */
function render(name, bpm, bars, opts) {
  const sp = 60 / bpm;
  const total = bars * 4 * sp + 4;
  const buf = new Float32Array(Math.floor(total * SR));
  for (let bar = 0; bar < bars; bar++) {
    const c = CHORDS[bar % 8], r = ROOTS[bar % 8];
    const at = bar * 4 * sp;
    if (opts.pad)
      c.forEach(s2 => mix(buf, at, bowed(hz(s2, -1), 0.055, sp * 4.4, opts.cut)));
    if (opts.bass) mix(buf, at, bowed(hz(r, -2), 0.09, sp * 4.2, 520));
  }
  const cycles = Math.ceil(bars / 8);
  for (let c2 = 0; c2 < cycles; c2++) {
    const base = c2 * 32 * sp;
    const LINE = opts.tune === 'warm' ? WARM : TUNE;
    for (const [b, n, d] of LINE) {
      const at = base + b * sp;
      if (opts.melody === 'piano') mix(buf, at, piano(hz(n, 0), 0.30, Math.max(2.4, d * sp * 1.3)));
      else mix(buf, at, bowed(hz(n, 0), 0.10, d * sp + 0.4, 2400));
      if (opts.octave) mix(buf, at, bowed(hz(n, 1), 0.035, d * sp + 0.4, 2600));
    }
    if (opts.under)
      for (const [b, n, d] of UNDER)
        mix(buf, base + b * sp, bowed(hz(n, -1), 0.075, d * sp, 520));
  }
  /* a plate: two short taps, which is all a room needs to stop sounding dead */
  const out = new Float32Array(buf.length);
  const d1 = Math.floor(0.055 * SR), d2 = Math.floor(0.081 * SR);
  for (let i = 0; i < buf.length; i++) {
    out[i] = buf[i]
      + (i > d1 ? out[i - d1] * 0.30 : 0)
      + (i > d2 ? out[i - d2] * 0.22 : 0);
  }
  let peak = 0;
  for (let i = 0; i < out.length; i++) peak = Math.max(peak, Math.abs(out[i]));
  const g = peak > 0 ? 0.82 / peak : 1;
  for (let i = 0; i < out.length; i++) out[i] = Math.tanh(out[i] * g * 1.1) * 0.92;
  return out;
}

function wav(samples) {
  const n = samples.length, buf = Buffer.alloc(44 + n * 2);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 2, 4); buf.write('WAVE', 8);
  buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22); buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 2, 28);
  buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34);
  buf.write('data', 36); buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++)
    buf.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(samples[i] * 32767))), 44 + i * 2);
  return buf;
}

const OUT = process.env.OUT || '/tmp';
const BARS = Number(process.env.BARS || 8);
const jobs = [
  /* her tune, and the one about the two of them */
  ['theme-hers', 56, BARS, { pad: 1, bass: 1, melody: 'piano', under: 1, cut: 900 }],
  ['theme-them', 56, BARS, { pad: 1, bass: 1, melody: 'piano', under: 1, cut: 900, tune: 'warm' }],
  ['roof',       54, BARS, { pad: 1, bass: 1, melody: 'piano', under: 1, octave: 1, cut: 1700, tune: 'warm' }],
  ['morning',    66, BARS, { pad: 1, bass: 1, melody: 'strings', under: 1, cut: 1300 }]
];
for (const [name, bpm, bars, opts] of jobs) {
  const s = render(name, bpm, bars, opts);
  fs.writeFileSync(OUT + '/ouissy-' + name + '.wav', wav(s));
  console.log('wrote', OUT + '/ouissy-' + name + '.wav',
              (s.length / SR).toFixed(1) + 's');
}
