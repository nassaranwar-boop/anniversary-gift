/* Render the score to real audio, offline, and look at what came out.
 *
 * You cannot check music by reading it. This loads ost.js in a page,
 * swaps the live AudioContext for an OfflineAudioContext, plays a cue
 * into it for N seconds, and writes a .wav — so the piece can actually
 * be listened to — plus a summary of what the samples say: peak, RMS,
 * whether it is silent, whether it clips, and how many distinct notes
 * were scheduled.
 *
 *   node ostrender.js <cue> [seconds] [out.wav]
 *   node ostrender.js --all            renders every cue and prints the table
 *
 * The trap this exists for: a synth score that throws inside a note
 * scheduler fails silently. Every oscillator after the throw simply
 * never starts, the page reports no error because it is inside a
 * try/catch, and the game plays in total silence while every assertion
 * about "the music is on" passes.
 */
const { chromium } = require('playwright-core');
const fs = require('fs');

function wav(channels, rate) {
  const n = channels[0].length, ch = channels.length;
  const buf = Buffer.alloc(44 + n * ch * 2);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * ch * 2, 4); buf.write('WAVE', 8);
  buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(ch, 22); buf.writeUInt32LE(rate, 24);
  buf.writeUInt32LE(rate * ch * 2, 28); buf.writeUInt16LE(ch * 2, 32);
  buf.writeUInt16LE(16, 34); buf.write('data', 36); buf.writeUInt32LE(n * ch * 2, 40);
  let o = 44;
  for (let i = 0; i < n; i++) {
    for (let c = 0; c < ch; c++) {
      let v = Math.max(-1, Math.min(1, channels[c][i]));
      buf.writeInt16LE(Math.round(v * 32767), o); o += 2;
    }
  }
  return buf;
}

(async () => {
  const args = process.argv.slice(2);
  const all = args[0] === '--all';
  const cue = all ? null : (args[0] || 'sakura');
  const secs = +(args[1] || 20);
  const outPath = args[2] || ('/tmp/ost-' + (cue || 'all') + '.wav');

  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox', '--no-proxy-server', '--disable-gpu'] });
  const page = await browser.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  await page.route('**/*', r => r.request().url().startsWith('http://127.0.0.1') ? r.continue() : r.abort());
  await page.goto('http://127.0.0.1:8899/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(1200);

  const render = (name, seconds) => page.evaluate(async ({ name, seconds }) => {
    /* Rebuild the score against an OfflineAudioContext. ost.js takes
       its context from window.hvSharedCtx, so pointing that at an
       offline one and re-running the file's own build path renders the
       real thing rather than a reimplementation of it. */
    const rate = 44100;
    const off = new OfflineAudioContext(2, Math.ceil(rate * seconds), rate);
    const realShared = window.hvSharedCtx;
    window.hvSharedCtx = () => off;
    const realWake = window.wakeAudio;
    window.wakeAudio = () => {};

    /* reload ost.js into this page so it binds to the offline clock */
    await new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = 'ost.js?render=' + Math.random();
      s.onload = res; s.onerror = rej;
      document.head.appendChild(s);
    });

    let notes = 0;
    const realOsc = off.createOscillator.bind(off);
    off.createOscillator = function () { notes++; return realOsc(); };

    window.OST.setOn(true);
    const bars = window.OST.__render(name, seconds);

    const buf = await off.startRendering();
    window.hvSharedCtx = realShared;
    window.wakeAudio = realWake;
    return {
      notes,
      left: Array.from(buf.getChannelData(0)),
      right: Array.from(buf.getChannelData(1)),
      rate,
      bars,
      dbg: window.OST.debug(),
    };
  }, { name, seconds });

  const names = all ? await page.evaluate(() => Object.keys(window.OST.cues)) : [cue];
  const rows = [];
  for (const name of names) {
    const r = await render(name, all ? 8 : secs);
    let peak = 0, sum = 0;
    for (let i = 0; i < r.left.length; i++) {
      const v = Math.abs(r.left[i]);
      if (v > peak) peak = v;
      sum += r.left[i] * r.left[i];
    }
    const rms = Math.sqrt(sum / r.left.length);
    rows.push({ name, peak: +peak.toFixed(4), rms: +rms.toFixed(5), notes: r.notes,
                silent: peak < 0.0005, clipping: peak > 0.999 });
    if (!all) {
      /* Normalised for listening only. In the game the score sits under
         the ambience bed and the effects at the level it renders at;
         a file you are going to open on its own needs the headroom
         taking out or it sounds like it is in the next room. */
      const k = peak > 0.0001 ? (0.7 / peak) : 1;
      fs.writeFileSync(outPath, wav([r.left.map(v => v * k), r.right.map(v => v * k)], r.rate));
      console.log('wrote', outPath, r.left.length + ' samples, normalised x' + k.toFixed(1));
    }

  }

  console.log('\ncue          peak     rms      notes  verdict');
  rows.forEach(r => console.log(
    r.name.padEnd(12),
    String(r.peak).padEnd(8),
    String(r.rms).padEnd(8),
    String(r.notes).padEnd(6),
    r.silent ? 'SILENT — nothing was scheduled' : r.clipping ? 'CLIPPING' : 'ok'));
  if (errs.length) console.log('\npage errors:\n' + errs.join('\n'));
  const bad = rows.filter(r => r.silent || r.clipping);
  await browser.close();
  process.exit(bad.length || errs.length ? 1 : 0);
})();
