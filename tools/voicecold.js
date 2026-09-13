/* THE ONLY TEST THAT MATTERS: DOES SHE HEAR HIM?

   tools/voicelive.js said everything was fine and everything was not.
   It warmed each line first -- asked for the take, waited for it to
   arrive, and only then played it -- which is a thing the game never
   does. And its one assertion about the result, that the line lasted
   longer than four-tenths of a second, is true of the synthesiser too.
   Two weak checks covering for each other, and a player who heard the
   robot read every word of a chapter that had 117 recordings sitting
   next to it.

   This one goes cold. It opens the chapter the way she opens it, plays
   the lines in the order the game plays them, touching nothing first,
   and asks the chapter itself which path each line took. There is no
   way to pass it except by actually playing the recording.
                                                node tools/voicecold.js */
const { chromium } = require('playwright-core');

let pass = 0, fail = 0;
const ok = (n, c, x) => { if (c) { pass++; console.log('  ok   ' + n); }
                          else { fail++; console.log('  FAIL ' + n + (x !== undefined ? '  ' + JSON.stringify(x) : '')); } };

(async () => {
  const b = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox', '--no-proxy-server', '--use-gl=swiftshader',
           '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
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

  /* THE OPENING STATEMENT, COLD.
     Exactly what happens when she presses start: the lines go out one
     after another and nobody has asked for anything in advance. */
  const lines = await p.evaluate(() => {
    const NS = OuissysNightShift.__night.words();
    return NS.intro.beats.reduce((a, x) => a.concat(x.lines), []);
  });
  console.log('       ' + lines.length + ' lines in the opening statement\n');

  /* COUNT, DO NOT SAMPLE. A line whose take has not landed is held for
     a moment and played late, so it finishes after the caller has moved
     on -- and a check that asks "what happened just now" reads the
     previous line's answer and cheerfully reports success. */
  await p.evaluate((ls) => { ls.forEach((l) => OuissysNightShift.__night.speak(l)); }, lines);
  /* long enough for the cold-start wait to resolve: the chapter holds a
     line whose take has not landed rather than handing it to the robot,
     and a check that samples before that resolves is measuring the
     wait, not the outcome */
  await p.waitForTimeout(7000);
  const st = await p.evaluate(() => OuissysNightShift.__night.said());
  console.log('       ' + st.plays.tape + ' in his voice, ' + st.plays.speech
              + ' not (' + st.late + ' held for a take, ' + st.ready + ' takes in memory)\n');

  ok('every line of the opening statement is his recording',
     st.plays.tape === lines.length && st.plays.speech === 0, st.plays);
  /* the real guarantee is not "some were warmed" but that the whole
     chapter ends up in memory on its own, so that nothing later in the
     night is ever waiting on a download */
  const total = await p.evaluate(() => OuissysNightShift.__night.voiceState().lines);
  await p.waitForFunction((n) => OuissysNightShift.__night.said().ready >= n,
                          total, { timeout: 30000, polling: 250 }).catch(() => {});
  const st9 = await p.evaluate(() => OuissysNightShift.__night.said());
  ok('and the whole chapter loads itself into memory unprompted',
     st9.ready >= total, st9.ready + '/' + total + ' takes in memory');

  /* and the same for a night's tape, which she hears while playing */
  const tape = await p.evaluate(() => {
    const NS = OuissysNightShift.__night.words();
    return NS.tapes[1].slice(0, 6).map((x) => x.t);
  });
  const was = st.plays.tape;
  await p.evaluate((ls) => { ls.forEach((l) => OuissysNightShift.__night.speak(l)); }, tape);
  await p.waitForTimeout(1500);
  const st2 = await p.evaluate(() => OuissysNightShift.__night.said());
  ok('night one\'s tape is his voice too',
     st2.plays.tape - was === tape.length && st2.plays.speech === 0,
     { tape: st2.plays.tape - was, of: tape.length, spoken: st2.plays.speech });

  ok('no page errors', errs === 0, errs);
  await b.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
