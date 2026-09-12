/* DOES A RECORDING ACTUALLY GET PLAYED?

   The chapter grew a path where a real recording of a real person
   replaces the synthesiser, and a path nobody has ever exercised is a
   path that does not work. This builds a fake take -- a tone of a
   known, odd length -- drops it in as one of his lines, and checks
   that the game finds it, decodes it, plays it INSTEAD of speaking,
   and reports the recording's length rather than its own estimate of
   how long the sentence ought to have taken.

   It puts everything back afterwards, including a manifest that was
   already there.                              node tools/voicecheck.js */
const { chromium } = require('playwright-core');
const fs = require('fs'), path = require('path');

const ROOT = path.join(__dirname, '..');
const DIR  = path.join(ROOT, 'voice');
const MAN  = path.join(DIR, 'manifest.json');
const LINE = 'I made toys. That part was true.';
const ID   = 'intro-3-1';
const TAKE = path.join(DIR, ID + '.mp3');
const SECS = 3.7;                       // nothing would guess this by accident

/* a WAV, named .mp3 on purpose: the decoder sniffs the bytes and the
   point of the test is the plumbing, not the codec */
function tone(secs) {
  const rate = 44100, n = Math.floor(rate * secs), b = Buffer.alloc(44 + n * 2);
  b.write('RIFF', 0); b.writeUInt32LE(36 + n * 2, 4); b.write('WAVE', 8);
  b.write('fmt ', 12); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20);
  b.writeUInt16LE(1, 22); b.writeUInt32LE(rate, 24); b.writeUInt32LE(rate * 2, 28);
  b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34);
  b.write('data', 36); b.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) {
    b.writeInt16LE(Math.round(Math.sin(2 * Math.PI * 180 * i / rate) * 9000), 44 + i * 2);
  }
  return b;
}

const hadMan = fs.existsSync(MAN), oldMan = hadMan ? fs.readFileSync(MAN) : null;
const hadTake = fs.existsSync(TAKE);
function cleanup() {
  try { hadMan ? fs.writeFileSync(MAN, oldMan) : fs.unlinkSync(MAN); } catch (e) {}
  if (!hadTake) { try { fs.unlinkSync(TAKE); } catch (e) {} }
}

(async () => {
  if (!fs.existsSync(DIR)) fs.mkdirSync(DIR);
  fs.writeFileSync(MAN, JSON.stringify({ [ID]: LINE }, null, 2));
  fs.writeFileSync(TAKE, tone(SECS));

  let pass = 0, fail = 0;
  const ok = (n, c, x) => { if (c) { pass++; console.log('  ok   ' + n); }
                            else { fail++; console.log('  FAIL ' + n + (x !== undefined ? '  ' + JSON.stringify(x) : '')); } };
  const b = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox','--no-proxy-server','--use-gl=swiftshader','--enable-unsafe-swiftshader',
           '--autoplay-policy=no-user-gesture-required'] });
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

  /* the manifest is fetched the first time anything touches the audio */
  await p.evaluate(() => OuissysNightShift.__night.voiceState());
  await p.waitForFunction(() => OuissysNightShift.__night.voiceState().on === true,
                          { timeout: 8000, polling: 100 }).catch(() => {});
  const st = await p.evaluate(() => OuissysNightShift.__night.voiceState());
  ok('the manifest is found and read', st.on === true, st);
  ok('and it knows about the line in it', st.lines === 1, st.lines);

  /* ask for the take, wait for it to decode */
  await p.evaluate((l) => OuissysNightShift.__night.voiceWant(l), LINE);
  await p.waitForFunction(() => OuissysNightShift.__night.voiceState().ready.length > 0,
                          { timeout: 8000, polling: 100 }).catch(() => {});
  const st2 = await p.evaluate(() => OuissysNightShift.__night.voiceState());
  ok('the take is fetched and decoded', st2.ready.length === 1, st2);

  /* and now the line should come back as the RECORDING's length */
  const dur = await p.evaluate((l) => OuissysNightShift.__night.speak(l), LINE);
  ok('the recording is what plays, not the synthesiser',
     Math.abs(dur - 3.7) < 0.12, dur);

  /* a line with no take must still be spoken the old way */
  const other = await p.evaluate(() => OuissysNightShift.__night.speak('For fifteen years I told you it was fine.'));
  ok('a line with no take still gets said', other > 0.3 && Math.abs(other - 3.7) > 0.2, other);

  /* and a take whose words have since been rewritten must NOT play */
  const stale = await p.evaluate(() => OuissysNightShift.__night.voiceWant('I made toys. That part was mostly true.'));
  ok('a take of words that have changed is ignored', stale === false, stale);

  ok('no page errors from any of it', errs === 0, errs);
  await b.close();
  cleanup();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch((e) => { cleanup(); console.error(e); process.exit(1); });
