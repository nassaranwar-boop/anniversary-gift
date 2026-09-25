/* Render a ground's CHANT to real audio, offline, so it can be heard.
 *
 * The same trick as cupostrender.js and for a better reason: a tune is
 * the one thing in this repository that no assertion can judge. You can
 * prove a chant engine schedules bars, mixes five layers, and fades
 * them in the right order, and still have written eight bars of
 * nothing. The only test of a hook is whether a person hears a hook.
 *
 * Same trick as tools/ostrender.js and for the same reason: you cannot
 * check music by reading it, and a synth score that throws inside its
 * note scheduler goes silent without reporting anything. This loads
 * cup.chant.js into a page against an OfflineAudioContext, lays a cue
 * down, and writes a .wav — so the piece can be played — plus what the
 * samples say: peak, RMS, whether it is silent, whether it clips, and
 * how many oscillators were actually started.
 *
 *   node tools/cupchantrender.js <team id> [seconds] [out.wav]
 *   node tools/cupchantrender.js --all       every ground, as a table
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
  const cue = all ? null : (args[0] || 'upm');
  const secs = +(args[1] || 24);
  const outPath = args[2] || ('/tmp/chant-' + (cue || 'all') + '.wav');

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
      s.src = 'cup.chant.js?render=' + Math.random();
      s.onload = res; s.onerror = rej;
      document.head.appendChild(s);
    });
    let notes = 0;
    const realOsc = off.createOscillator.bind(off);
    off.createOscillator = function () { notes++; return realOsc(); };
    window.CupChant.init(off, off.destination, { volume: 1 });
    const team = (window.CUP_CONFIG.TEAMS.filter(t => t.id === name)[0]
                  || window.CUP_CONFIG.TEAMS[0]);
    window.CupChant.setTeam(team.anthem);
    const r0 = window.CupChant.__render(seconds, 0.92);
    const buf = await off.startRendering();
    return { notes, bars: r0.bars, barSecs: r0.barSecs, start: r0.start,
             rate, bpm: team.anthem.tempo,
             left: Array.from(buf.getChannelData(0)),
             right: Array.from(buf.getChannelData(1)) };
  }, { name, seconds });

  /* the config has to be in the page before any of this means anything */
  await page.evaluate(() => new Promise((res) => {
    const s = document.createElement('script');
    s.src = 'cup.config.js'; s.onload = res; document.head.appendChild(s);
  }));
  const names = all
    ? await page.evaluate(() => window.CUP_CONFIG.TEAMS.map(t => t.id))
    : [cue];

  const rows = [];
  for (const name of names) {
    const r = await render(name, all ? 26 : secs);
    let peak = 0, sum = 0;
    for (let i = 0; i < r.left.length; i++) {
      const v = Math.abs(r.left[i]);
      if (v > peak) peak = v;
      sum += r.left[i] * r.left[i];
    }
    const rms = Math.sqrt(sum / r.left.length);
    /* THE SHAPE OF THE SONG, AS NUMBERS.
       Eight bars with a hole in bar four is the whole design; if the
       drop is not measurably quieter than the bar that follows it, the
       structure is decoration and the anthem is a loop again. */
    const barLen = Math.round(r.rate * r.barSecs);
    const bar0 = Math.round(r.rate * r.start);
    /* THE SECOND HALF OF EACH BAR, not the whole of it.
       A held note at the end of the previous bar, plus a stadium
       reverb with a two-second tail on it, rings well past the bar
       line — so the first beat of the drop is still full of the bar
       before. That is correct music and a useless measurement. The
       hole is felt in the middle of the bar, so that is where it is
       read, and every bar is read the same way. */
    const bars = [];
    for (let k = 0; bar0 + k * barLen < r.left.length && k < 16; k++) {
      let s2 = 0, n2 = 0;
      const from = Math.round(bar0 + k * barLen + barLen * 0.45);
      const to = Math.min(bar0 + (k + 1) * barLen, r.left.length);
      for (let i = from; i < to; i++) {
        s2 += r.left[i] * r.left[i]; n2++;
      }
      bars.push(Math.sqrt(s2 / Math.max(1, n2)));
    }
    const drop = bars[4], back = bars[5];
    rows.push({ name, peak: +peak.toFixed(4), rms: +rms.toFixed(5),
                notes: r.notes, bars: r.bars, profile: bars,
                dropOk: drop !== undefined && back !== undefined && drop < back * 0.8,
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

  console.log('\nground       peak     rms       bars  oscillators  verdict');
  rows.forEach(r => console.log(
    r.name.padEnd(12), String(r.peak).padEnd(8), String(r.rms).padEnd(9),
    String(r.bars).padEnd(5), String(r.notes).padEnd(12),
    r.silent ? 'SILENT' : (r.clipping ? 'CLIPPING' : 'ok')));
  console.log('\nthe shape of each song, bar by bar (RMS \u00d7 1000):');
  console.log('   bar          0    1    2    3   [4]   5    6    7');
  console.log('                bed  bed  hook hook DROP full full lift');
  rows.forEach(r => console.log('   ' + r.name.padEnd(9)
    + r.profile.slice(0, 8).map(v => String(Math.round(v * 1000)).padStart(5)).join('')
    + (r.profile.length >= 6 ? (r.dropOk ? '   drop ok' : '   DROP DID NOT DROP') : '')));
  if (errs.length) console.log('\npage errors: ' + errs.slice(0, 3).join(' | '));
  await browser.close();
  process.exit(rows.some(r => r.silent || r.clipping
                             || (r.profile.length >= 6 && !r.dropOk))
               || errs.length ? 1 : 0);
})();
