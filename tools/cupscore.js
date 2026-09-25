/* IS THERE ACTUALLY A DIFFERENT PIECE OF MUSIC IN EACH PLACE?
 *
 * You cannot listen to a headless browser, so this reads the score
 * instead of hearing it. Every cue is asked three questions:
 *
 *   is it there at all — does asking for it change what is playing
 *   is it DIFFERENT — a key, a tempo and a set of clothes of its own
 *   is it moving — is the master gain off the floor, and are bars
 *                  being scheduled rather than the whole thing sitting
 *                  built and silent
 *
 * The third one matters most and is the one that fails quietly. A
 * synthesised score that is wired up, built, and never posts a note is
 * indistinguishable from a working one in every way except the only
 * way anybody cares about.
 *
 * It also checks the thing the score is FOR: that the three rounds of
 * the tournament are not the same music three times. Same theme, rising
 * key, rising tempo — a bracket you can hear.
 *
 *   node tools/cupscore.js
 */
const { chromium } = require('playwright-core');

let pass = 0, fail = 0;
const ok = (msg, cond, extra) => {
  if (cond) { pass++; console.log('  ok   ' + msg); }
  else { fail++; console.log('  FAIL ' + msg + (extra !== undefined ? '  ' + JSON.stringify(extra) : '')); }
};

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox', '--no-proxy-server', '--autoplay-policy=no-user-gesture-required'] });
  const p = await b.newPage({ viewport: { width: 960, height: 540 } });
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.route('**/*', r => r.request().url().startsWith('http://127.0.0.1') ? r.continue() : r.abort());
  await p.goto('http://127.0.0.1:8899/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForTimeout(900);
  await p.evaluate(() => { try { localStorage.clear(); } catch (e) {} showScreen('hub'); startHub(); });
  await p.waitForTimeout(250);
  await p.click('#hub-card-cup');
  await p.waitForFunction(() => window.OuissyCup && OuissyCup.__cup.state() !== null, { timeout: 60000 });
  await p.waitForTimeout(400);
  await p.mouse.click(480, 400);          // the audio context wants a gesture
  await p.waitForTimeout(300);

  ok('the score engine loaded', await p.evaluate(() => !!window.CupScore));

  const names = await p.evaluate(() => Object.keys(window.CupScore.cues));
  console.log('  ' + names.length + ' cues: ' + names.join(', '));
  console.log('');

  const seen = [];
  for (const n of names) {
    const d = await p.evaluate((nn) => {
      const H = OuissyCup.__cup;
      H.scoreTo(nn);
      /* long enough for the scheduler to wake up (it ticks every
         120ms) and for the next beat to arrive at the slowest tempo
         in the score, which is 64bpm — a beat is under a second */
      return new Promise(r => setTimeout(() => r(window.CupScore.debug()), 1300));
    }, n);
    seen.push(d);
    console.log('   ' + String(d.cue).padEnd(8)
      + ' key ' + String(d.key).padStart(2)
      + (d.minor ? ' min' : ' MAJ')
      + '  ' + String(d.bpm).padStart(3) + 'bpm'
      + '  theme ' + String(d.theme).padEnd(5)
      + ' on ' + String(d.themeInst).padEnd(8)
      + '  drum ' + String(d.drum).padEnd(6)
      + '  bars ' + String(d.bar).padStart(2)
      + '  gain ' + d.gain);
  }
  console.log('');

  ok('every cue plays when it is asked for',
     seen.every(d => d.cue && d.built), seen.filter(d => !d.cue).length);
  ok('every cue is actually scheduling music, not sitting built and silent',
     seen.every(d => d.bar > 0), seen.filter(d => !(d.bar > 0)).map(d => d.cue));
  ok('every cue is audible', seen.every(d => d.gain > 0.002),
     seen.filter(d => !(d.gain > 0.002)).map(d => [d.cue, d.gain]));

  /* no two cues are the same piece of music */
  const sig = seen.map(d => [d.key, d.minor, d.bpm, d.theme, d.themeInst, d.drum].join('/'));
  ok('no two cues are the same piece twice',
     new Set(sig).size === sig.length,
     sig.filter((x, i) => sig.indexOf(x) !== i));

  /* THE BRACKET. Same theme, each round a key higher and faster. */
  const rounds = ['tieA', 'tieB', 'tieC'].map(n => seen.filter(d => d.cue === n)[0]);
  ok('there is one piece of music per round', rounds.every(Boolean), rounds);
  if (rounds.every(Boolean)) {
    console.log('   the bracket: '
      + rounds.map(d => 'key ' + d.key + ' @' + d.bpm).join('  →  '));
    ok('the tournament climbs a key at a time',
       rounds[0].key < rounds[1].key && rounds[1].key < rounds[2].key,
       rounds.map(d => d.key));
    ok('and gets faster',
       rounds[0].bpm < rounds[1].bpm && rounds[1].bpm < rounds[2].bpm,
       rounds.map(d => d.bpm));
    ok('but it is the same tune every time',
       rounds.every(d => d.theme === 'full' && d.notes === rounds[0].notes),
       rounds.map(d => [d.theme, d.notes]));
  }

  /* the menu is its own thing, and the loss is the win in the minor */
  const by = (n) => seen.filter(d => d.cue === n)[0];
  ok('the menu has a piece nothing else uses',
     by('menu') && sig.filter(x => x === sig[names.indexOf('menu')]).length === 1);
  ok('losing is the same theme with the third flattened',
     by('lose') && by('lose').minor && by('win') && !by('win').minor,
     [by('lose') && by('lose').minor, by('win') && by('win').minor]);

  /* and turning the sound off actually stops it */
  const off = await p.evaluate(() => {
    OuissyCup.__cup.soundOff();
    return new Promise(r => setTimeout(() => r(window.CupScore.debug()), 400));
  });
  ok('the sound switch stops the score', !off.cue || off.gain < 0.002, off);

  ok('no page errors', errs.length === 0, errs.slice(0, 3));
  console.log('');
  console.log(pass + ' passed, ' + fail + ' failed');
  await b.close();
  process.exit(fail ? 1 : 0);
})();
