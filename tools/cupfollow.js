/* DOES THE MUSIC FOLLOW THE MATCH, AND DOES THE GROUND SAY ANYTHING?
 *
 * Two claims, and both of them are the kind that sound true in a
 * comment and do nothing in code.
 *
 * ONE: the song has sections, and the match chooses them. Before this,
 * cup.chant.js took a phase from the game on every frame and stored it
 * in a variable that nothing ever read — so the chorus arrived when a
 * bar counter said so, which on average is sixteen bars after anything
 * happened. A goal has to move the band, and it has to move it ON A
 * BAR LINE, because a section change halfway through a bar is not a
 * section change, it is a mistake.
 *
 * TWO: the ground reacts. There were eight event kinds in the chant
 * engine and the game fired four of them. A shot, a save, the
 * woodwork, a tackle, a foul, a card, half-time and the final whistle
 * all went past in total silence. The only honest way to test that is
 * to PLAY A MATCH — the AI drives all eight players, the clock is
 * pumped by hand because rAF runs at three frames a second in this
 * container — and record every reaction the game actually asks for.
 * A kind that never fires in ninety seconds of football is a sound
 * nobody will ever hear.
 *
 *   node tools/cupfollow.js
 */
const { chromium } = require('playwright-core');

let pass = 0, fail = 0;
const ok = (n, c, x) => { if (c) { pass++; console.log('  ok   ' + n + (x !== undefined ? '  ' + x : '')); }
                          else { fail++; console.log('  FAIL ' + n + (x !== undefined ? '  ' + x : '')); } };

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox', '--no-proxy-server', '--autoplay-policy=no-user-gesture-required'] });
  const p = await b.newPage({ viewport: { width: 900, height: 560 } });
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.route('**/*', r => r.request().url().startsWith('http://127.0.0.1') ? r.continue() : r.abort());
  await p.goto('http://127.0.0.1:8899/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForTimeout(900);
  await p.evaluate(() => { try { localStorage.clear(); } catch (e) {} showScreen('hub'); startHub(); });
  await p.waitForTimeout(250);
  await p.click('#hub-card-cup');
  await p.waitForFunction(() => window.OuissyCup && OuissyCup.__cup.state() !== null, { timeout: 60000 });
  await p.waitForTimeout(600);
  /* A MATCH, AND THEN STOPPED.

     The chant engine needs a ground and an anthem, and the only way to
     get one is to start a fixture. But a fixture that is RUNNING fires
     its own reactions -- a shot here, a save there -- and every one of
     them takes the music fader for itself, which is correct in a game
     and ruinous in a measurement: the first version of this file spent
     an afternoon reporting that the duck was broken when what it had
     actually caught was a tackle landing on top of the goal it was
     timing. So the match is paused for everything that measures the
     engine on its own, and started again for the part that measures
     the game. */
  await p.evaluate(() => { OuissyCup.__cup.quick(0); OuissyCup.__cup.auto(true); });
  await p.waitForTimeout(400);
  await p.evaluate(() => OuissyCup.pause());
  await p.waitForTimeout(200);

  ok('the chant engine is running a song', await p.evaluate(
    () => !!(window.CupChant && CupChant.debug().anthem)));

  /* ---------------------------------------------------------------- 1
     THE FORM MOVES, AND IT MOVES ON A BAR LINE                        */
  console.log('\n== the band follows the match');

  /* a jump lands exactly on the first bar of the section it was asked
     for. Any other landing position means it took effect mid-bar and
     the drop is in the wrong place. */
  const jump = async (call, want) => p.evaluate(async ([c, w]) => {
    const D = () => CupChant.debug();
    const before = D().section;
    if (c.ev) CupChant.event(c.ev); else CupChant.section(c.sec);
    const queued = D().queued;
    const START = { intro: 0, build: 8, chorus: 16, break: 24, last: 28 };
    /* watch every bar until it arrives, and note where it landed */
    let landedAt = null, seen = [];
    for (let i = 0; i < 90; i++) {
      await new Promise(r => setTimeout(r, 60));
      const d = D();
      seen.push(d.pos);
      if (d.section === w && landedAt === null) { landedAt = d.pos; break; }
    }
    return { before, queued, landedAt, want: START[w], saw: seen.length };
  }, [call, want]);

  const g = await jump({ ev: 'goalHome' }, 'chorus');
  ok('a goal asks for the chorus', g.queued === 'chorus', 'queued ' + g.queued);
  ok('and the chorus arrives', g.landedAt !== null, 'landed at bar ' + g.landedAt);
  ok('and it arrives ON the bar line, at the top of the section',
     g.landedAt === g.want, 'landed ' + g.landedAt + ', section starts at ' + g.want);

  const c = await jump({ ev: 'goalAway' }, 'break');
  ok('conceding drops the band to the quiet eight', c.landedAt === 24,
     'landed at bar ' + c.landedAt);

  const k = await jump({ ev: 'kickoff' }, 'intro');
  ok('the whistle puts them back at the top', k.landedAt === 0,
     'landed at bar ' + k.landedAt);

  /* ---------------------------------------------------------------- 2
     AND THE SECTION AFTER THAT IS A QUESTION ABOUT THE GROUND         */
  const walk = (e, bars) => p.evaluate(async ([en, n]) => {
    CupChant.event('kickoff');
    const seen = {};
    for (let i = 0; i < n; i++) {
      CupChant.energy(en, 'play');
      await new Promise(r => setTimeout(r, 70));
      seen[CupChant.debug().section] = true;
    }
    return Object.keys(seen).sort();
  }, [e, bars]);

  const quiet = await walk(0.15, 130);
  ok('a flat match never reaches the chorus', quiet.indexOf('chorus') < 0,
     quiet.join(' '));
  const loud = await walk(0.95, 130);
  ok('a roaring one does', loud.indexOf('chorus') >= 0 || loud.indexOf('last') >= 0,
     loud.join(' '));
  ok('and the two are not the same arrangement',
     quiet.join() !== loud.join(), quiet.join(' ') + '   vs   ' + loud.join(' '));

  /* ---------------------------------------------------------------- 3
     THE TUNE STEPS BACK WHEN THE GROUND SHOUTS                        */
  console.log('\n== the roar and the band are not in the same place');
  /* =====================================================================
     SAMPLED ON THE AUDIO CLOCK, NOT THE WALL CLOCK

     This test called a working duck broken three times over before it
     was pointed at the right clock. Headless Chrome here has no audio
     device to pace the graph against, so the AudioContext renders as
     fast as it can compute: measured, 44 seconds of context time pass
     in one second of wall clock. Every fader in the Web Audio API is
     a function of context time, so a 70ms attack and a two-and-a-half
     second release are over in about sixty milliseconds of real time
     -- and a test that awaits 40ms between readings lands one sample
     somewhere in the middle of the whole envelope and concludes the
     fader never moved.

     So it does not await. It spins, reading the context's own clock
     alongside the fader, and reports the envelope in the units the
     envelope is actually written in.
     ===================================================================== */
  const duck = await p.evaluate(() => {
    CupChant.energy(0.8, 'play');
    const D = () => CupChant.debug();
    const before = D().musicDuck, muted = D().muted, t0 = D().now;
    CupChant.event('goalHome');
    const seen = [];
    const wall = performance.now();
    /* until the whole envelope has gone by -- 70ms of attack and two
       and a half seconds of release -- with a wall-clock escape hatch
       in case this container's audio clock is running at 1x rather
       than the 44x it sometimes does. One reading per hundredth of a
       context second is plenty and keeps the array small. */
    let last = -1;
    while (D().now - t0 < 3.0 && performance.now() - wall < 6000) {
      const at = +(D().now - t0).toFixed(2);
      if (at !== last) { seen.push([at, D().musicDuck]); last = at; }
    }
    const low = seen.reduce((m, r) => Math.min(m, r[1]), 1);
    const lowAt = (seen.find(r => r[1] === low) || [null])[0];
    return { before, muted, low, lowAt, n: seen.length,
             ctxSecs: +(D().now - t0).toFixed(2),
             back: seen.length ? seen[seen.length - 1][1] : null,
             /* every tenth reading, so the shape is visible */
             shape: seen.filter((_, i) => i % Math.ceil(seen.length / 14) === 0)
                        .map(r => r[0] + 's:' + r[1]).join('  ') };
  });
  console.log('   ' + duck.shape);
  console.log('   ' + duck.n + ' readings over ' + duck.ctxSecs + 's of audio time');
  ok('the music is at full before it', duck.before > 0.9, String(duck.before));
  ok('a goal pulls it back, and by a lot', duck.low < 0.7,
     'down to ' + duck.low + ' at ' + duck.lowAt + 's' + (duck.muted ? '  (MUTED)' : ''));
  ok('it is at its quietest right at the start, with the roar',
     duck.lowAt !== null && duck.lowAt < 0.4, duck.lowAt + 's in');
  ok('and it comes all the way back up on its own', duck.back > 0.95,
     'at ' + duck.back + ' after ' + duck.ctxSecs + 's');

  /* ---------------------------------------------------------------- 4
     EVERY REACTION IS A SOUND THAT EXISTS                             */
  console.log('\n== every reaction the engine knows');
  const KINDS = ['goalHome', 'goalAway', 'shot', 'nearMiss', 'miss', 'missTheirs',
                 'post', 'save', 'saveTheirs', 'tackle', 'tackleLost', 'foul',
                 'card', 'superWind', 'superHit', 'kickoff', 'halfTime',
                 'fullTime', 'win', 'lose'];
  const threw = await p.evaluate(async (kinds) => {
    const bad = [];
    for (const k of kinds) {
      try { CupChant.event(k); } catch (e) { bad.push(k + ': ' + e.message); }
      await new Promise(r => setTimeout(r, 120));
    }
    return bad;
  }, KINDS);
  ok('none of the ' + KINDS.length + ' reactions throws', threw.length === 0, threw.join(' | '));

  /* ---------------------------------------------------------------- 5
     AND THE MATCH ACTUALLY ASKS FOR THEM

     The whole point. A sound the game never calls for is a sound
     nobody hears, which is exactly the state the four unwired ones
     were in before this.                                              */
  console.log('\n== what a real match asks the ground for');
  const heard = await p.evaluate(async () => {
    const seen = {};
    const real = CupChant.event.bind(CupChant);
    CupChant.event = function (k) { seen[k] = (seen[k] || 0) + 1; return real(k); };
    const H = OuissyCup.__cup;
    /* two halves of AI football, clock pumped by hand */
    for (let r = 0; r < 2; r++) {
      H.quick(r); H.auto(true);
      for (let i = 0; i < 400 && H.state() && H.state().state !== 'play'; i++) H.step(1, 0, 0, false);
      for (let i = 0; i < 70; i++) {
        H.step(60, 0, 0, false);
        await new Promise(r2 => setTimeout(r2, 0));
      }
    }
    CupChant.event = real;
    return seen;
  });
  const names = Object.keys(heard).sort();
  console.log('   ' + names.map(n => n + '×' + heard[n]).join('  '));
  /* the ones a half of football cannot avoid producing */
  ['shot', 'kickoff'].forEach(k =>
    ok('a match asks for "' + k + '"', !!heard[k], (heard[k] || 0) + ' times'));
  ok('a match asks for a reaction to a chance that went',
     !!(heard.miss || heard.nearMiss || heard.missTheirs),
     'miss ' + (heard.miss || 0) + ', near ' + (heard.nearMiss || 0) +
     ', theirs ' + (heard.missTheirs || 0));
  ok('and for something other than the four it used to',
     names.filter(n => ['superWind', 'superHit', 'goalHome', 'goalAway'].indexOf(n) < 0).length >= 3,
     names.join(' '));

  ok('no page errors', errs.length === 0, errs.slice(0, 2).join(' | '));
  console.log('');
  console.log(fail ? pass + ' passed, ' + fail + ' FAILED' : 'all ' + pass + ' checks passed');
  await b.close();
  process.exit(fail ? 1 : 0);
})();
