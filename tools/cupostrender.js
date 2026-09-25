/* Render the cup's score to real audio, offline, and look at what came out.
 *
 * Same trick as tools/ostrender.js and for the same reason: you cannot
 * check music by reading it, and a synth score that throws inside its
 * note scheduler goes silent without reporting anything. This loads
 * cup.ost.js into a page against an OfflineAudioContext, lays a cue
 * down, and writes a .wav — so the piece can be played — plus what the
 * samples say: peak, RMS, whether it is silent, whether it clips, and
 * how many oscillators were actually started.
 *
 *   node tools/cupostrender.js <cue> [seconds] [out.wav]
 *   node tools/cupostrender.js --all         every cue, as a table
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
      const v = Math.max(-1, Math.min(1, channels[c][i]));
      buf.writeInt16LE(Math.round(v * 32767), o); o += 2;
    }
  }
  return buf;
}

(async () => {
  const args = process.argv.slice(2);
  const all = args[0] === '--all';
  const cue = all ? null : (args[0] || 'menu');
  const secs = +(args[1] || 24);
  const outPath = args[2] || ('/tmp/cup-' + (cue || 'all') + '.wav');

  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox', '--no-proxy-server', '--disable-gpu'] });
  const page = await browser.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  await page.route('**/*', r => r.request().url().startsWith('http://127.0.0.1') ? r.continue() : r.abort());
  await page.goto('http://127.0.0.1:8899/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(600);

  const render = (name, seconds) => page.evaluate(async ({ name, seconds }) => {
    const rate = 44100;
    const off = new OfflineAudioContext(2, Math.ceil(rate * seconds), rate);
    /* reload the file so its module-level state binds to the offline
       clock rather than to whatever the page is already using */
    await new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = 'cup.ost.js?render=' + Math.random();
      s.onload = res; s.onerror = rej;
      document.head.appendChild(s);
    });
    let notes = 0;
    const realOsc = off.createOscillator.bind(off);
    off.createOscillator = function () { notes++; return realOsc(); };
    window.CupScore.setOn(true);
    window.CupScore.init(off, off.destination, { volume: 1 });
    const bars = window.CupScore.__render(name, seconds);
    const buf = await off.startRendering();
    return { notes, bars, rate,
             left: Array.from(buf.getChannelData(0)),
             right: Array.from(buf.getChannelData(1)) };
  }, { name, seconds });

  const names = all ? await page.evaluate(async () => {
    await new Promise((res) => { const s = document.createElement('script');
      s.src = 'cup.ost.js'; s.onload = res; document.head.appendChild(s); });
    return Object.keys(window.CupScore.cues);
  }) : [cue];

  const rows = [];
  for (const name of names) {
    const r = await render(name, all ? 10 : secs);
    let peak = 0, sum = 0;
    for (let i = 0; i < r.left.length; i++) {
      const v = Math.abs(r.left[i]);
      if (v > peak) peak = v;
      sum += r.left[i] * r.left[i];
    }
    const rms = Math.sqrt(sum / r.left.length);
    rows.push({ name, peak: +peak.toFixed(4), rms: +rms.toFixed(5),
                notes: r.notes, bars: r.bars,
                silent: peak < 0.0005, clipping: peak > 0.999 });
    if (!all) {
      /* Normalised for listening only. In the chapter it sits under the
         crowd at the level it renders at; a file you are going to open
         on its own needs the headroom taking out. */
      const k = peak > 0.0001 ? (0.72 / peak) : 1;
      fs.writeFileSync(outPath, wav([r.left.map(v => v * k), r.right.map(v => v * k)], r.rate));
      console.log('wrote ' + outPath + '  ' + r.left.length + ' samples, normalised x' + k.toFixed(1));
    }
  }

  console.log('\ncue          peak     rms       bars  oscillators  verdict');
  rows.forEach(r => console.log(
    r.name.padEnd(12), String(r.peak).padEnd(8), String(r.rms).padEnd(9),
    String(r.bars).padEnd(5), String(r.notes).padEnd(12),
    r.silent ? 'SILENT' : (r.clipping ? 'CLIPPING' : 'ok')));
  if (errs.length) console.log('\npage errors: ' + errs.slice(0, 3).join(' | '));
  await browser.close();
  process.exit(rows.some(r => r.silent || r.clipping) || errs.length ? 1 : 0);
})();
