/* HOW FAR ABOVE THE MUSIC IS HE, IN DECIBELS?

   He said the narrator was so loud you could not hear the melodies,
   and he was right by about six decibels. Every level in this chapter
   had been set by reading a number and thinking it looked reasonable:
   the takes are normalised to -18 LUFS, which is loud; they played at
   0.92; and the score was ducked another 6.4dB underneath them. Three
   sensible-looking decisions multiplying into a documentary mix, where
   the words are the content and the music is wallpaper.

   Here the music IS the content. It is the thing meant to make her
   cry, the words are on screen as captions anyway, and a score she
   cannot hear is a score that did not need writing.

   So the balance is a measured number now, with a meter on each bus.
   The one trap, which this tool fell into on its first run: meter the
   music AFTER the duck. MUS.bus feeds sideGain and sideGain is what
   the duck moves, so a meter on the bus reads the score at full level
   however far under the voice it has been pushed -- it reported a
   0.9dB dip during a line that was really ducking six and a half, and
   called a ten decibel gap three.
                                                  node tools/balance.js */
const { chromium } = require('playwright-core');

/* HOW WIDE THE BAND HAS TO BE TO BE HONEST.

   He should be in front, and not by so much that the eight bars
   underneath him stop being something she can follow. The band is
   wider than the ideal on purpose: a voice's loudness measured over
   three seconds depends on what it happens to say in them -- how many
   commas, how the sentence falls -- and the score's own phrase arch
   swings a third either way underneath it. Run twice on identical
   code this reads about two decibels apart.

   A tolerance narrower than the measurement's own repeatability is not
   a stricter guard, it is a guard that fails at random, and a check
   that cries wolf gets ignored on the day it is right. This one still
   catches by a mile the thing it was written for: a narrator ten
   decibels over the top of the music. */
const FLOOR = 0.5, CEIL = 7.5;

(async () => {
  const b = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox', '--no-proxy-server', '--use-gl=swiftshader',
           '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
  const p = await b.newPage();
  let errs = 0;
  p.on('pageerror', (e) => { errs++; console.log('PAGEERROR', e.message); });
  await p.route('**/*', (r) => {
    const u = r.request().url();
    if (u.indexOf('book-scene.js') >= 0) return r.abort();
    return u.startsWith('http://127.0.0.1') ? r.continue() : r.abort();
  });
  await p.goto('http://127.0.0.1:8899/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.evaluate(() => { localStorage.setItem('ns_seenintro', '1'); showScreen('nightshift');
    return loadChapter('nightshift').then(() => OuissysNightShift.start()); });
  await p.waitForFunction(() => window.OuissysNightShift && OuissysNightShift.__night,
                          { timeout: 20000, polling: 200 });

  let pass = 0, fail = 0;
  const ok = (n, c, x) => { if (c) { pass++; console.log('  ok   ' + n); }
                            else { fail++; console.log('  FAIL ' + n + (x !== undefined ? '  ' + x : '')); } };

  /* three scenes, because the mix is per-scene and a balance that is
     right in one can be wrong in another */
  for (const [mode, what] of [['night', 'a shift'], ['held', 'the turn'], ['dawn', 'six o\'clock']]) {
    await p.evaluate((m) => OuissysNightShift.__night.bedMode(m), mode);
    /* LONG ENOUGH TO COVER A PHRASE.
       The score's own arch swings its level by about a third across
       eight bars, so a window shorter than a phrase reads a different
       number every run -- this tool wandered by three decibels between
       identical runs before the windows were widened, which is more
       than the thing it is trying to measure. */
    await p.waitForTimeout(3000);
    const quiet = await p.evaluate(() => OuissysNightShift.__night.balance(5000));
    const line = await p.evaluate(() => OuissysNightShift.__night.words().intro.beats[3].lines[1]);
    await p.evaluate((l) => OuissysNightShift.__night.voiceWant(l), line);
    await p.waitForTimeout(900);
    await p.evaluate((l) => OuissysNightShift.__night.speak(l), line);
    await p.waitForTimeout(400);
    /* and during speech, for as long as the take lasts */
    const talk = await p.evaluate(() => OuissysNightShift.__night.balance(2600));
    console.log('\n  ' + what + ': music alone ' + quiet.music + ' dB, '
                + 'under him ' + talk.music + ' dB, he is ' + talk.gap + ' dB above'
                + '   [score rms ' + talk.rms + ', voice trim ' + talk.trim + ']');
    ok('he is in front during ' + what, talk.gap >= FLOOR, talk.gap + ' dB');
    ok('but not on top of it', talk.gap <= CEIL, talk.gap + ' dB');
    ok('and the score is still clearly playing under him',
       talk.music - quiet.music > -6, (talk.music - quiet.music).toFixed(1) + ' dB dip');
    await p.waitForTimeout(2600);
  }
  ok('no page errors', errs === 0, errs);
  await b.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
