/* ARE THE RECORDINGS ACTUALLY IN THE GAME?

   tools/voicecheck.js proves the PLUMBING works, using one fake take of
   a known length. That is a different question from whether the real
   render landed, is complete, and is what the chapter plays -- and the
   difference between those two questions is the difference between "the
   code supports recordings" and "he has a voice".

   So this checks the real thing: every line in the manifest has a file,
   every file decodes to something a person could have said, the game
   finds them, and the opening statement -- the first seven things she
   ever hears -- comes back as recordings rather than as the
   synthesiser.
                                                node tools/voicelive.js */
const fs = require('fs'), path = require('path');
const { chromium } = require('playwright-core');

const ROOT = path.join(__dirname, '..');
const DIR = path.join(ROOT, 'voice');
const MAN = path.join(DIR, 'manifest.json');

let pass = 0, fail = 0;
const ok = (n, c, x) => { if (c) { pass++; console.log('  ok   ' + n); }
                          else { fail++; console.log('  FAIL ' + n + (x !== undefined ? '  ' + JSON.stringify(x) : '')); } };

(async () => {
  /* --- what is on disk ------------------------------------------- */
  if (!fs.existsSync(MAN)) {
    console.log('  FAIL there is no voice/manifest.json, so the game is still');
    console.log('       using the browser speech engine for every line.');
    console.log('       Put a "full ..." line in voice/RENDER and push.');
    process.exit(1);
  }
  const man = JSON.parse(fs.readFileSync(MAN, 'utf8'));
  const ids = Object.keys(man);
  ok('the manifest is there and full', ids.length > 100, ids.length + ' lines');

  const missing = ids.filter((id) => !fs.existsSync(path.join(DIR, id + '.mp3')));
  ok('every line in it has a take', missing.length === 0, missing.slice(0, 6));

  /* a file that exists but is 400 bytes is a failed render that nobody
     noticed, and it would play as a click */
  const tiny = ids.filter((id) => {
    const p = path.join(DIR, id + '.mp3');
    return fs.existsSync(p) && fs.statSync(p).size < 3000;
  });
  ok('and none of them is too short to be a sentence', tiny.length === 0, tiny.slice(0, 6));

  const stray = fs.readdirSync(DIR).filter((f) => /\.mp3$/.test(f))
                  .filter((f) => ids.indexOf(f.replace(/\.mp3$/, '')) < 0);
  ok('and there are no takes of lines that no longer exist', stray.length === 0, stray.slice(0, 6));

  const bytes = ids.reduce((n, id) => n + fs.statSync(path.join(DIR, id + '.mp3')).size, 0);
  console.log('       ' + ids.length + ' takes, ' + (bytes / 1e6).toFixed(1) + ' MB');

  /* --- and what the game does with it ----------------------------- */
  const b = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox', '--no-proxy-server', '--use-gl=swiftshader',
           '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
  const p = await b.newPage({ viewport: { width: 900, height: 600 } });
  let errs = 0, missed = [];
  p.on('pageerror', (e) => { errs++; console.log('PAGEERROR', e.message); });
  p.on('response', (r) => { if (r.status() === 404 && /voice\//.test(r.url())) missed.push(r.url()); });
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

  await p.evaluate(() => OuissysNightShift.__night.voiceState());
  await p.waitForFunction(() => OuissysNightShift.__night.voiceState().on === true,
                          { timeout: 10000, polling: 100 }).catch(() => {});
  const st = await p.evaluate(() => OuissysNightShift.__night.voiceState());
  ok('the game loads the manifest', st.on === true, st);
  ok('and sees every line in it', st.lines === ids.length, st.lines);

  /* THE FIRST SEVEN THINGS SHE EVER HEARS.
     If the opening statement is not on tape, nothing else matters. */
  const intro = await p.evaluate(() => {
    const NS = OuissysNightShift.__night.words();
    return NS.intro.beats.reduce((a, b) => a.concat(b.lines), []);
  }).catch(() => null);
  if (!intro) { ok('could read the opening statement out of the chapter', false); }
  else {
    let got = 0;
    for (const line of intro) {
      const had = await p.evaluate((l) => OuissysNightShift.__night.voiceWant(l), line);
      if (!had) {
        await p.waitForFunction((l) => OuissysNightShift.__night.voiceWant(l),
                                line, { timeout: 6000, polling: 100 }).catch(() => {});
      }
      if (await p.evaluate((l) => OuissysNightShift.__night.voiceWant(l), line)) got++;
    }
    ok('every line of the opening statement is on tape', got === intro.length,
       got + '/' + intro.length);

    /* and it PLAYS as a recording: a spoken line returns the engine's
       own estimate of how long it ought to take, a recording returns
       how long it actually is, and they never agree */
    const durs = [];
    for (const line of intro.slice(0, 4)) {
      durs.push(await p.evaluate((l) => OuissysNightShift.__night.speak(l), line));
      await p.waitForTimeout(120);
    }
    ok('and the chapter plays them rather than speaking them',
       durs.every((d) => d > 0.4), durs.map((d) => d.toFixed(2)));
  }

  ok('nothing in voice/ 404s', missed.length === 0, missed.slice(0, 4));
  ok('no page errors', errs === 0, errs);
  await b.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
