/* IS THE FOOTBALL ANY GOOD?
 *
 * Everything else in this folder checks that the game WORKS. Nothing has
 * ever checked whether it is worth playing, which is the only question
 * that matters and the one I had been answering from screenshots.
 *
 * So this plays whole matches on the fixed clock with nothing drawn and
 * counts the things that decide whether a football game is fun:
 *
 *   goals          none and it is boring; ten and it is noise
 *   shots          how often anybody gets a sight of goal at all
 *   turnovers      possession changing hands. Too few is a procession,
 *                  far too many is pinball and nobody can build anything
 *   loose          the share of the match where NOBODY has the ball.
 *                  This is the big one: a game that is 60% loose ball is
 *                  two teams chasing a rolling object round a field
 *   holdTime       how long an average possession lasts, in seconds
 *   switches       how often control is taken off the player. Above
 *                  about one every two seconds it feels like the game is
 *                  playing itself
 *   reach          how far up the pitch she gets, 0 own goal, 1 theirs
 *
 *   node tools/cupfeel.js
 */
const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--use-gl=swiftshader','--enable-unsafe-swiftshader','--no-sandbox','--no-proxy-server'] });
  const p = await b.newPage({ viewport: { width: 700, height: 420 } });
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.route('**/*', r => r.request().url().startsWith('http://127.0.0.1') ? r.continue() : r.abort());
  await p.goto('http://127.0.0.1:8899/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForTimeout(900);
  await p.evaluate(() => window.loadChapter && window.loadChapter('cup'));
  await p.waitForFunction(() => !!window.OuissyCup, { timeout: 30000 });
  await p.evaluate(() => { try { localStorage.clear(); } catch (e) {}
                           showScreen('cup'); OuissyCup.__cup.soundOff();
                           OuissyCup.__cup.shadows(false); OuissyCup.start(); });
  await p.waitForFunction(() => OuissyCup.__cup.state() !== null, { timeout: 40000 });
  await p.evaluate(() => OuissyCup.stop());

  /* `drive` is how a person would play: run at their goal with the ball,
     chase it without, and hit it when the goal is in range. Crude, but it
     is what a first-timer does and it is the bar the game has to clear. */
  const play = (drive) => p.evaluate(({ drive }) => {
    const C = OuissyCup.__cup;
    C.reset(0);
    const G = C.geometry();
    let goals = [0, 0], shots = 0, turn = 0, loose = 0, held = 0, switches = 0;
    let lastOwner = null, lastCtl = null, possStart = 0, possLens = [];
    let reach = 0, t = 0, theirHalf = 0, inBox = 0, mineHas = 0;
    const DT = 1 / 60;
    for (let i = 0; i < 60 * 104 && !C.state().over; i++) {
      let ux = 0, uy = 0, hold = false;
      const s = C.state();
      if (drive) {
        const me = C.me();
        if (me) {
          /* THE STICK IS READ IN THE CAMERA'S FRAME, not the pitch's.
             She always attacks to the RIGHT of the screen, whichever
             end her team is kicking towards, because the camera crosses
             at half time. A driver written in pitch coordinates sends
             her sideways — which is how a version of this reported her
             holding the ball for 58% of a match and spending 3% of it
             in the opposition half. */
          const sd = C.camSide();
          if (s.owner === me.name) {
            const toGoal = Math.abs(me.y - C.goalY());
            ux = 1;                                   // always: at their goal
            uy = sd * (G.pitch.cx - me.x) * 0.02;     // drift back to the middle
            if (toGoal < 130) hold = true;            // wind one up
            if (toGoal < 85 && C.charged() > 0.5) { C.release(); hold = false; }
          } else {
            const wdx = s.ballX - me.x;               // across the pitch
            const wdy = s.ballY - me.y;               // up it
            const m = Math.hypot(wdx, wdy) || 1;
            ux = sd * (wdy / m);
            uy = sd * (wdx / m);
          }
        }
      }
      C.step(1, ux, uy, hold);
      t += DT;
      const st = C.state();
      goals = st.score;
      if (!st.owner) loose += DT; else held += DT;
      if (st.owner !== lastOwner) {
        if (lastOwner && st.owner) turn++;
        if (lastOwner) possLens.push(t - possStart);
        possStart = t;
        lastOwner = st.owner;
      }
      if (st.controlled !== lastCtl) { if (lastCtl) switches++; lastCtl = st.controlled; }
      reach = Math.max(reach, C.reach());
      const pr = C.probe();
      if (pr.half) theirHalf += DT;
      if (pr.box) inBox += DT;
      if (pr.owner === 0) mineHas += DT;
    }
    shots = C.shots();
    return { goals, shotsBy: C.shotsBy(),
             theirHalf: +(theirHalf / t).toFixed(3),
             inBox: +(inBox / t).toFixed(3),
             mineHas: +(mineHas / t).toFixed(3),
             shots, turn, loose: +(loose / t).toFixed(3),
             hold: +(possLens.length ? possLens.reduce((a, c) => a + c, 0) / possLens.length : 0).toFixed(2),
             switches, t: +t.toFixed(1), reach: +reach.toFixed(2) };
  }, { drive });

  const rows = [];
  for (let i = 0; i < 3; i++) rows.push(await play(false));
  const rows2 = [];
  for (let i = 0; i < 3; i++) rows2.push(await play(true));

  const show = (label, rs) => {
    const avg = (k) => (rs.reduce((a, r) => a + (Array.isArray(r[k]) ? 0 : r[k]), 0) / rs.length).toFixed(2);
    const gg = rs.map(r => r.goals.join('-')).join('  ');
    console.log('\n' + label);
    console.log('  score        ' + gg);
    console.log('  shots        ' + avg('shots') + '   hers/theirs  ' +
      rs.map(r => r.shotsBy.join('/')).join('  '));
    console.log('  her attack   ' + (avg('theirHalf') * 100).toFixed(0) +
      '% in their half, ' + (avg('inBox') * 100).toFixed(0) + '% in their box');
    console.log('  she has it   ' + (avg('mineHas') * 100).toFixed(0) + '% of the match');
    console.log('  turnovers    ' + avg('turn') + '   (per match)');
    console.log('  loose ball   ' + (avg('loose') * 100).toFixed(0) + '%  of the match');
    console.log('  possession   ' + avg('hold') + 's  average, before it is lost');
    console.log('  switches     ' + avg('switches') + '   control taken off her');
    console.log('  got as far   ' + avg('reach') + '   (0 her goal, 1 theirs)');
    console.log('  match length ' + avg('t') + 's');
  };
  show('LEFT ALONE  (both sides on AI)', rows);
  show('PLAYED      (a first-timer: run at goal, shoot when close)', rows2);
  console.log(errs.length ? '\nERRORS: ' + errs.slice(0, 3).join(' | ') : '\nno page errors');
  await b.close();
})();
