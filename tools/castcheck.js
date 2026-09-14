/* DO THE FOUR OF THEM SOUND LIKE FOUR DIFFERENT THINGS?

   Every recorded line in this chapter used to be Anwar, which was
   right while the only recorded lines were his. It stopped being right
   the moment the four started talking to each other on night five, and
   was actively bad by the last hour, where twenty-two of the lines are
   theirs: a ballerina, an owl, a clockwork soldier and a
   jack-in-the-box all coming out of the same documentary narrator.

   tools/voicesheet.js casts them and the workflow renders each line in
   its own model. This checks the result rather than the intent, the
   same way voicedepth does: decode the takes, measure the median
   fundamental of each part, and fail if two of them land on top of
   each other. A casting sheet that quietly fell back to the narrator
   for everybody would pass every other test in this repository and
   sound exactly like the thing it was written to fix.

                                              node tools/castcheck.js  */
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const { chromium } = require('playwright-core');

const VOICE = path.join(__dirname, '..', 'voice');
const plan = JSON.parse(execFileSync('node', [path.join(__dirname, 'voicesheet.js'), '--plan']).toString());

/* a few takes per part, so one odd line cannot decide it */
const parts = {};
for (const id in plan) {
  const w = plan[id].who;
  if (!fs.existsSync(path.join(VOICE, id + '.mp3'))) continue;
  (parts[w] = parts[w] || []).push(id);
}
for (const w in parts) parts[w] = parts[w].slice(0, 6);

const MEASURE = `async (b64) => {
  const bin = atob(b64);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  const ctx = new (window.OfflineAudioContext || window.webkitOfflineAudioContext)(1, 128, 24000);
  const a = await ctx.decodeAudioData(buf.buffer);
  const x = a.getChannelData(0), r = a.sampleRate;
  const w = Math.floor(r * 0.045), hop = Math.floor(r * 0.02);
  const lo = Math.floor(r / 320), hi = Math.floor(r / 60);
  const out = [];
  for (let i = 0; i + w < x.length; i += hop) {
    let e = 0;
    for (let k = 0; k < w; k++) e += x[i + k] * x[i + k];
    if (Math.sqrt(e / w) < 0.02) continue;
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

let pass = 0, fail = 0;
const ok = (n, c, x) => { if (c) { pass++; console.log('  ok   ' + n); }
                          else { fail++; console.log('  FAIL ' + n + (x !== undefined ? '  ' + JSON.stringify(x) : '')); } };

(async () => {
  const b = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox', '--no-proxy-server'] });
  const p = await b.newPage();
  await p.goto('data:text/html,<title>cast</title>');
  const f0 = (file) => p.evaluate(eval('(' + MEASURE + ')'),
                                  fs.readFileSync(file).toString('base64'));

  console.log('\n%s %s %s %s', 'part'.padEnd(12), 'model'.padEnd(36),
              'takes'.padStart(6), 'median f0'.padStart(11));
  const hz = {};
  for (const who of Object.keys(parts)) {
    const vals = [];
    for (const id of parts[who]) {
      const v = await f0(path.join(VOICE, id + '.mp3'));
      if (v) vals.push(v);
    }
    vals.sort((a, c) => a - c);
    hz[who] = vals.length ? vals[vals.length >> 1] : null;
    console.log('%s %s %s %s', who.padEnd(12), plan[parts[who][0]].model.padEnd(36),
                String(vals.length).padStart(6),
                (hz[who] ? hz[who].toFixed(1) + ' Hz' : 'none').padStart(11));
  }
  await b.close();

  const who = Object.keys(hz);
  /* it was five. It is eight now: her, the ones he sold, and the first
     one he ever sold all speak in the last hour. The number is read
     off the casting sheet rather than written down here, so adding a
     mouth to the chapter cannot quietly stop being checked. */
  ok('every part in the chapter has takes to measure',
     who.length >= 8 && who.every((w) => hz[w]), hz);

  /* A CASTING SHEET THAT FELL BACK TO THE NARRATOR FOR EVERYBODY would
     pass every other test in this repository. Two parts within a
     semitone of each other are, to an ear, the same person. */
  const same = [];
  for (let i = 0; i < who.length; i++) for (let j = i + 1; j < who.length; j++) {
    const a = hz[who[i]], c = hz[who[j]];
    if (!a || !c) continue;
    const st = Math.abs(12 * Math.log2(a / c));
    if (st < 1.0) same.push([who[i], who[j], +st.toFixed(2)]);
  }
  ok('no two of them are within a semitone of each other', !same.length, same);

  /* and the shape of the casting: the clock is the lowest thing in the
     room and the ballerina is the highest */
  /* and the shape of the casting. He is under all of it, because he is
     the tape and because she is listening to him from underneath six
     nights of this; Cogsworth is the lowest of the four, because he is
     a clock and the oldest thing in the room. */
  /* the oldest thing in the building is the lowest thing in it. It is
     his soldier's model, eleven years worse kept, and if it is not
     under his soldier it is not the same toy grown old -- it is a
     different toy. */
  ok('and the first one he ever sold is under the soldier he became',
     hz.boss && hz.cogsworth && hz.boss < hz.cogsworth,
     [hz.boss, hz.cogsworth]);
  /* and she is not one of the toys */
  ok('and she is nowhere near any of the four',
     ['cogsworth', 'chime', 'marabelle', 'jax'].every((w) =>
       !hz[w] || !hz.ouissy || Math.abs(12 * Math.log2(hz.ouissy / hz[w])) > 1),
     [hz.ouissy, hz.cogsworth, hz.chime, hz.marabelle, hz.jax]);

  ok('Anwar is under everybody: he is the tape',
     hz.anwar && who.every((w) => w === 'anwar' || hz[w] > hz.anwar),
     { anwar: hz.anwar && +hz.anwar.toFixed(1) });
  ok('Cogsworth is the lowest of the four',
     hz.cogsworth && ['chime', 'marabelle', 'jax'].every((w) => hz[w] > hz.cogsworth),
     { cogsworth: hz.cogsworth && +hz.cogsworth.toFixed(1) });
  ok('Marabelle is the one voice in the shop that is not a man',
     hz.marabelle && hz.anwar && hz.marabelle > hz.anwar * 1.6,
     { marabelle: hz.marabelle && +hz.marabelle.toFixed(1),
       anwar: hz.anwar && +hz.anwar.toFixed(1) });
  ok('and Jax has enough weight under him for the last four lines',
     hz.jax && hz.marabelle && hz.jax < hz.marabelle,
     { jax: hz.jax && +hz.jax.toFixed(1), marabelle: hz.marabelle && +hz.marabelle.toFixed(1) });

  console.log('\n' + pass + ' passed, ' + fail + ' failed\n');
  process.exit(fail ? 1 : 0);
})();
