/* RENDER THE TUNE TO A FILE SO A PERSON CAN LISTEN TO IT.

   Everything else here measures the music. Nothing could play it. This
   renders a named cue through the chapter's own synths in an offline
   context and writes a WAV, so the question "is this melody any good"
   can be answered by ear instead of by argument.

     node tools/hearit.js theme 9  out.wav                            */
const { chromium } = require('playwright-core');
const fs = require('fs');

(async () => {
  const which = process.argv[2] || 'theme';
  const secs  = Number(process.argv[3] || 9);
  const out   = process.argv[4] || ('/tmp/' + which + '.wav');
  const b = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox','--no-proxy-server','--use-gl=swiftshader','--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 1000, height: 700 } });
  p.on('pageerror', e => console.log('PAGEERROR', e.message));
  await p.route('**/*', r => { const u = r.request().url();
    if (u.indexOf('book-scene.js') >= 0) return r.abort();
    return u.startsWith('http://127.0.0.1') ? r.continue() : r.abort(); });
  await p.goto('http://127.0.0.1:8899/index.html', { waitUntil:'domcontentloaded', timeout:60000 });
  await p.waitForTimeout(700);
  await p.evaluate(() => { try{localStorage.clear();}catch(e){} localStorage.setItem('ns_seenintro','1');
    showScreen('nightshift'); return loadChapter('nightshift').then(() => OuissysNightShift.start()); });
  await p.waitForFunction(() => window.OuissysNightShift && OuissysNightShift.__night,
                          { timeout: 20000, polling: 200 });
  const buf = await p.evaluate(([w,s]) => OuissysNightShift.__night.offline(w, s), [which, secs]);
  await b.close();
  if (!buf) { console.log('no offline context'); process.exit(1); }

  const L = buf.l, R = buf.r, n = L.length, rate = buf.rate;
  let peak = 0;
  for (let i = 0; i < n; i++) { peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i])); }
  /* normalise to -3dBFS so a quiet cue is still audible on a phone */
  const g = peak > 1e-6 ? (0.707 / peak) : 1;
  const data = Buffer.alloc(n * 4);
  for (let i = 0; i < n; i++) {
    const l = Math.max(-1, Math.min(1, L[i] * g)) * 32767;
    const r = Math.max(-1, Math.min(1, R[i] * g)) * 32767;
    data.writeInt16LE(l | 0, i * 4);
    data.writeInt16LE(r | 0, i * 4 + 2);
  }
  const head = Buffer.alloc(44);
  head.write('RIFF', 0); head.writeUInt32LE(36 + data.length, 4); head.write('WAVE', 8);
  head.write('fmt ', 12); head.writeUInt32LE(16, 16); head.writeUInt16LE(1, 20);
  head.writeUInt16LE(2, 22); head.writeUInt32LE(rate, 24);
  head.writeUInt32LE(rate * 4, 28); head.writeUInt16LE(4, 32); head.writeUInt16LE(16, 34);
  head.write('data', 36); head.writeUInt32LE(data.length, 40);
  fs.writeFileSync(out, Buffer.concat([head, data]));
  console.log(`${out}  ${(n/rate).toFixed(1)}s  peak ${peak.toFixed(4)}  gain x${g.toFixed(1)}`);
})();
