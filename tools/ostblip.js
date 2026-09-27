/* WHERE THE SPEAKER FARTS.

   He can hear a blip in the radio, the rooftop and the cats — all three
   apocalypse cues — and nothing in this repo has ever looked at a
   waveform. A click is a discontinuity: one sample a long way from the
   one before it. A "fart" on a small speaker is the other thing, energy
   far below what a phone can move, which flaps the cone instead of
   sounding.

   So this renders each cue through its own instruments into an
   OfflineAudioContext and reports both: the biggest sample-to-sample
   jumps, and how much of the signal sits under 45Hz, which is below
   what any phone or laptop can reproduce.

   node ostblip.js            every cue
   node ostblip.js signal 16  one cue, sixteen seconds, and write a wav
*/
const { chromium } = require('playwright-core'); const fs = require('fs');
const only = process.argv[2] || null;
const SECS = +(process.argv[3] || 12);

/* a step this big between neighbouring samples is audible as a click */
const JUMP = 0.06;
/* A REGRESSION GUARD, NOT A DIAGNOSIS.

   Be straight about what this number did and did not do. The blip was
   the clipping -- `home` measured a peak of 2.16 against a full scale
   of 1.0 and 85 discontinuities, and that is a fault you can hear. The
   bottom end was a secondary thing: it sat between -47 and -58 dBFS,
   which is quiet, and taking it out bought between one and eight
   decibels. Worth doing (it is inaudible on any phone and it was eating
   headroom) but it was not what he was hearing.

   So this sits just above where the score lands now: it will catch a
   cue that starts pushing real energy down there, and it does not
   pretend the score was ever broken by it. */
const SUB_MAX_DB = -45;

function wav(ch, rate) {
  const n = ch[0].length, c = ch.length, b = Buffer.alloc(44 + n*c*2);
  b.write('RIFF',0); b.writeUInt32LE(36+n*c*2,4); b.write('WAVE',8); b.write('fmt ',12);
  b.writeUInt32LE(16,16); b.writeUInt16LE(1,20); b.writeUInt16LE(c,22); b.writeUInt32LE(rate,24);
  b.writeUInt32LE(rate*c*2,28); b.writeUInt16LE(c*2,32); b.writeUInt16LE(16,34);
  b.write('data',36); b.writeUInt32LE(n*c*2,40);
  let o=44; for (let i=0;i<n;i++) for (let k=0;k<c;k++){
    let v=Math.max(-1,Math.min(1,ch[k][i])); b.writeInt16LE(Math.round(v*32767),o); o+=2; }
  return b;
}

/* HOW MUCH SIGNAL IS DOWN WHERE NOTHING CAN REPRODUCE IT.

   A single one-pole rolls off at 6dB an octave, which still passes most
   of the music: it reported the ratio going UP when the sub-bass was
   removed, because it was mostly measuring the midrange either way.
   Four in a row is 24dB an octave, steep enough that what comes out is
   actually the bottom end.

   And the number that matters is the ABSOLUTE level down there, in
   dBFS, not its share of the mix -- a quiet cue with a high ratio moves
   no air, and that is what a speaker responds to. */
function subRms(x, rate, f) {
  const a = Math.exp(-2 * Math.PI * f / rate);
  let s1 = 0, s2 = 0, s3 = 0, s4 = 0, sum = 0;
  for (let i = 0; i < x.length; i++) {
    s1 = (1 - a) * x[i] + a * s1;
    s2 = (1 - a) * s1   + a * s2;
    s3 = (1 - a) * s2   + a * s3;
    s4 = (1 - a) * s3   + a * s4;
    sum += s4 * s4;
  }
  return Math.sqrt(sum / x.length);
}
const dbfs = (v) => v > 0 ? 20 * Math.log10(v) : -999;

let pass = 0, fail = 0;
const ok = (n,c,x)=>{ if(c){pass++;console.log('  ok   '+n+(x?'  '+x:''));} else {fail++;console.log('  FAIL '+n+(x?'  '+x:''));} };

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox','--no-proxy-server','--disable-gpu'] });
  const page = await browser.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  await page.route('**/*', r => r.request().url().startsWith('http://127.0.0.1') ? r.continue() : r.abort());
  await page.goto('http://127.0.0.1:8899/index.html', { waitUntil:'domcontentloaded', timeout:60000 });
  await page.evaluate(() => window.loadChapter && window.loadChapter('apoc'));
  await page.waitForFunction(() => !!window.Apocalypse, null, { timeout: 30000 });
  await page.evaluate(() => { showScreen('apoc'); if (!window.__apEnter) Apocalypse.start(); });
  await page.waitForFunction(() => typeof window.__apScoreRender === 'function', null, { timeout: 40000 });

  const names = only ? [only]
    : await page.evaluate(() => window.__apScoreCues ? window.__apScoreCues() : null)
      || ['signal','after','settled','dawn','home','hearth','drive'];

  console.log('cue        peak    rms    worst jump  at        jumps>' + JUMP + '   sub45Hz  no-limiter');
  for (const name of names) {
    const r = await page.evaluate(([n,s]) => window.__apScoreRender(n,s), [name, SECS]);
    if (!r) { console.log(name.padEnd(10) + ' (no such cue)'); continue; }
    /* AND THE SAME CUE WITH THE CEILING TAKEN OUT.

       The limiter will hold almost anything under 1.0, so measuring the
       output cannot tell you whether the music is sane -- the cello bug
       measured 0.82 through it and passed. What the arrangement itself
       does is the thing to assert on. */
    const raw = await page.evaluate(([n,s]) => window.__apScoreRender(n,s,true), [name, SECS]);
    let rawPeak = 0;
    for (let i=0;i<raw.left.length;i++){ const v=Math.abs(raw.left[i]); if(v>rawPeak)rawPeak=v; }
    const L = r.left;
    let peak=0, sum=0, worst=0, worstAt=0, jumps=0;
    for (let i=0;i<L.length;i++){
      const v=Math.abs(L[i]); if(v>peak)peak=v; sum+=L[i]*L[i];
      if(i){ const d=Math.abs(L[i]-L[i-1]); if(d>worst){worst=d;worstAt=i;} if(d>JUMP)jumps++; }
    }
    const rms=Math.sqrt(sum/L.length);
    const sub=subRms(L, r.rate, 45), subDb=dbfs(sub);
    console.log(name.padEnd(10) +
      peak.toFixed(3).padStart(6) + rms.toFixed(4).padStart(8) +
      worst.toFixed(4).padStart(12) + (worstAt/r.rate).toFixed(2).padStart(8) + 's' +
      String(jumps).padStart(11) + subDb.toFixed(1).padStart(11) + ' dB' +
      rawPeak.toFixed(2).padStart(9) + ' raw');
    if (only) fs.writeFileSync('/tmp/ap-'+name+'.wav', wav([r.left,r.right], r.rate));
    ok(name + ': no clicks in it', jumps === 0, jumps ? jumps + ' jumps, worst ' + worst.toFixed(3) : '');
    ok(name + ': the writing stays inside full scale on its own',
       rawPeak <= 1.0, 'peaks at ' + rawPeak.toFixed(2) + ' with the ceiling out');
    ok(name + ': nothing a phone speaker cannot move', subDb <= SUB_MAX_DB,
       subDb.toFixed(1) + ' dBFS under 45Hz');
    if (r.errs && r.errs.length) ok(name + ': the cue does not throw', false, r.errs.join(' | '));
  }
  ok('nothing threw', errs.length === 0, errs.slice(0,2).join(' | '));
  console.log('');
  console.log(fail ? pass+' passed, '+fail+' FAILED' : 'all '+pass+' checks passed');
  await browser.close();
  process.exit(fail?1:0);
})();
