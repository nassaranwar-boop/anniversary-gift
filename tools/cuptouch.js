/* IS THE BALL ACTUALLY LOOSE? — the dribble, measured.
 *
 * A ball welded to the foot and a ball being dribbled look identical in
 * a screenshot and behave nothing alike, so this counts the things that
 * tell them apart:
 *
 *   THE GAP      how far the ball sits from the man carrying it. Welded,
 *                it is a constant. Dribbled, it should cycle — out on
 *                the touch, back as he runs onto it — so what matters is
 *                the SPREAD, not the mean.
 *   THE CADENCE  touches per second while running. A person takes three
 *                or four; a metronome takes sixty and a magnet takes
 *                none at all.
 *   THE RISK     how often a touch runs away from its owner, and how
 *                often somebody else steps in front of the ball and
 *                takes it. Both should happen. Neither should dominate.
 *   THE SPELL    how long an average possession lasts. This is the one
 *                that catches the disaster case: if freeing the ball has
 *                brought back the old seven-changes-a-second thrash, the
 *                average spell collapses and everything else is noise.
 *
 *   node tools/cuptouch.js
 */
const { chromium } = require('playwright-core');

let pass = 0, fail = 0;
const ok = (n, c, x) => { if (c) { pass++; console.log('  ok   ' + n); }
                          else { fail++; console.log('  FAIL ' + n + (x !== undefined ? '  ' + JSON.stringify(x) : '')); } };

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox', '--no-proxy-server', '--autoplay-policy=no-user-gesture-required'] });
  const p = await b.newPage({ viewport: { width: 900, height: 560 }, deviceScaleFactor: 1 });
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.route('**/*', r => r.request().url().startsWith('http://127.0.0.1') ? r.continue() : r.abort());
  await p.goto('http://127.0.0.1:8899/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForTimeout(1000);
  await p.evaluate(() => { try { localStorage.clear(); } catch (e) {} showScreen('hub'); startHub(); });
  await p.waitForTimeout(300);
  await p.click('#hub-card-cup');
  await p.waitForFunction(() => window.OuissyCup && OuissyCup.__cup.state() !== null, { timeout: 60000 });
  await p.waitForTimeout(600);

  const r = await p.evaluate(() => {
    const H = OuissyCup.__cup;
    H.quick(0); H.auto(true);
    for (let i = 0; i < 400 && H.state().state !== 'play'; i++) H.step(1, 0, 0, false);

    const FIXED = 1 / 60;
    let gaps = [], speeds = [];
    let carried = 0, touches = 0, movingCarried = 0;
    let spells = [], spell = 0, lastOwner = -2;
    let lostLoose = 0, nicked = 0, kicked = 0;
    let prevBallV = 0, prevGap = 0;

    for (let i = 0; i < 4200; i++) {
      H.step(1, 0, 0, false);
      const s = H.scout();
      if (!s || s.state !== 'play') continue;
      const own = s.owner ? s.owner.i : -1;

      /* --- how long a spell of possession lasts */
      if (own !== lastOwner) {
        if (lastOwner >= 0 && spell > 0) spells.push(spell * FIXED);
        /* what ended the last one: a kick sends the ball away fast, a
           heavy touch leaves it rolling slowly, a nick swaps the owner
           without the ball speeding up at all */
        if (lastOwner >= 0) {
          if (own >= 0) nicked++;
          else if (s.ballV > 90) kicked++;
          else lostLoose++;
        }
        spell = 0;
        lastOwner = own;
      }
      if (own >= 0) spell++;

      if (own >= 0) {
        const c = s.players[own];
        const g = Math.hypot(s.ball.x - c.x, s.ball.y - c.y);
        carried++;
        gaps.push(g);
        speeds.push(c.sp);
        if (c.sp > 20) {
          movingCarried++;
          /* a touch is the frame the ball's speed jumps while somebody
             still owns it — it cannot be a kick, because a kick ends the
             possession on the same frame */
          /* the simulation counts its own touches; inferring them
             from the ball's speed missed every shift across the body */
          touches = s.stat.touches[0] + s.stat.touches[1];
        }
        prevBallV = s.ballV; prevGap = g;
      } else { prevBallV = s.ballV; }
    }

    const mean = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0;
    const sd = a => { const m = mean(a); return Math.sqrt(mean(a.map(v => (v - m) * (v - m)))); };
    const sorted = gaps.slice().sort((x, y) => x - y);
    return {
      carriedFrames: carried,
      gapMean: +mean(gaps).toFixed(1),
      gapSd: +sd(gaps).toFixed(1),
      gapMin: +(sorted[Math.floor(sorted.length * 0.05)] || 0).toFixed(1),
      gapMax: +(sorted[Math.floor(sorted.length * 0.95)] || 0).toFixed(1),
      carrySpeed: +mean(speeds).toFixed(0),
      touchesPerSec: +(touches / Math.max(1e-6, movingCarried * FIXED)).toFixed(2),
      spellMean: +mean(spells).toFixed(2),
      spells: spells.length,
      endedByKick: kicked, endedByNick: nicked, endedLoose: lostLoose,
    };
  });

  console.log('a half of dribbling, nobody driving:');
  console.log('   the ball sat ' + r.gapMean + ' units from its carrier on average, ' +
              'spread ' + r.gapSd + ' (5th–95th: ' + r.gapMin + '–' + r.gapMax + ')');
  console.log('   ' + r.touchesPerSec + ' touches a second while running at ' + r.carrySpeed + ' px/s');
  console.log('   ' + r.spells + ' spells of possession, ' + r.spellMean + 's each');
  console.log('   ended by: ' + r.endedByKick + ' kicks, ' + r.endedByNick +
              ' nicked off, ' + r.endedLoose + ' run away');
  console.log('');

  ok('the ball is not welded to the foot (it moves relative to the carrier)',
     r.gapSd > 2.5, r.gapSd);
  ok('it genuinely travels out in front', r.gapMax > 12, r.gapMax);
  ok('and comes back under the foot', r.gapMin < 11, r.gapMin);
  ok('but never further than the carrier can hold it', r.gapMax < 34, r.gapMax);
  ok('a running player takes two to six touches a second',
     r.touchesPerSec > 1.6 && r.touchesPerSec < 6.5, r.touchesPerSec);
  /* WHERE THIS BAR COMES FROM. Not from an idea of how long a spell of
     possession ought to last — from what this game measured BEFORE the
     ball was freed: 16.5 seconds of owned ball in a half, which is
     exactly what it measures now. Four a side with a press on is a
     frantic game and always was. The bar exists to catch the disaster
     the old proximity rule caused, where the average spell collapsed to
     0.14s and the ball was just an object being chased. */
  ok('possession still lasts — the old thrash has not come back',
     r.spellMean > 0.28, r.spellMean);
  ok('a touch sometimes runs away from its owner', r.endedLoose > 2, r.endedLoose);
  ok('and somebody sometimes steps in front of it', r.endedByNick > 0, r.endedByNick);
  ok('but most possessions still end with a pass or a shot',
     r.endedByKick >= r.endedByNick, [r.endedByKick, r.endedByNick]);
  ok('no page errors', errs.length === 0, errs.slice(0, 3));

  console.log('');
  console.log(pass + ' passed, ' + fail + ' failed');
  await b.close();
  process.exit(fail ? 1 : 0);
})();
