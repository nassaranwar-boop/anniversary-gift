/* WHAT IS IT ACTUALLY LIKE TO BE HER?
 *
 * Every other harness in here drives the match with the AI on both
 * sides and asks whether the code runs. Nothing has ever measured the
 * thing she complained about, which is not a bug -- it is the minute
 * to minute experience of holding the stick toward their goal and
 * pressing things.
 *
 * So this plays like somebody who has never played a game: it holds
 * the stick at the opponent's goal, presses SHOOT when it is close
 * enough to be worth it, presses PASS now and then, and otherwise just
 * runs. Then it reports the numbers that decide whether that is fun:
 *
 *   HAS IT      -- what fraction of the match her side has the ball
 *   CHASING     -- how long the man she is driving spends more than a
 *                  stride from the ball, which is what "the ball flies
 *                  between the players" feels like from the inside
 *   KEEP        -- how long a possession of hers lasts before it is
 *                  gone. Under about two seconds there is no game: she
 *                  never gets to do anything with it
 *   SHOTS       -- how many times she got to have a go
 *   SWAPS       -- how often the game took her player off her, which
 *                  above a certain rate is the single most disorienting
 *                  thing an assisted football game does
 *
 *   node tools/cupplay.js [seconds]      (default: 90)
 */
const { chromium } = require('playwright-core');
const SECS = +(process.argv[2] || 90);

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox', '--no-proxy-server', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
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
  await p.evaluate(() => { OuissyCup.__cup.quick(0); OuissyCup.__cup.soundOff(); });
  await p.waitForTimeout(400);

  /* THE WHOLE MATCH IS PUMPED INSIDE ONE evaluate. requestAnimationFrame
     runs at about three frames a second in this container, so ninety
     seconds of football driven from node would take half an hour and
     be measured through a straw. step() advances the fixed timestep
     directly. */
  const r = await p.evaluate((SECS) => {
    const H = OuissyCup.__cup;
    const FIXED = 1 / 60;
    const ticks = Math.round(SECS / FIXED);

    /* THE STICK IS READ IN THE CAMERA'S FRAME, NOT THE PITCH'S.

       controlStep does driveP(p, sd * v.y, sd * v.x) -- screen across is
       pitch along, screen down is pitch across, and both flip with the
       camera when the sides change ends. A harness that pushes "towards
       their goal" in pitch coordinates steers her at ninety degrees to
       where it meant to, and then reports that the controls are broken.
       This converts once, here, and everything below is in pitch
       coordinates like a person thinking about football. */
    const toStick = (ax, ay) => {
      const sd = H.camSide();
      return { ux: sd * ay, uy: sd * ax };
    };

    const gy = H.goalY();                 // the goal she is attacking
    const gx = 160;                       // the middle of it
    let mine = 0, theirs = 0, looseT = 0;
    let chasing = 0, far = 0;
    let shots = 0, passes = 0, swaps = 0;
    let lastCtl = null;
    const keeps = [], dists = [];
    let keepT = 0;
    let firedThis = false, lastPass = -999, live = 0;
    const support = [];
    /* WHAT STATE IS THE MATCH ACTUALLY IN? A game that is loose 80 per
       cent of the time is either a pinball table or a game that spends
       most of its life stopped for a restart, and those are opposite
       problems with opposite fixes. */
    const states = {};
    /* and WHY nobody has it, counted */
    const why = { locked: 0, air: 0, tooFar: 0, owned: 0, ticks: 0 };
    let nearSum = 0;

    for (let i = 0; i < ticks; i++) {
      const s = H.state();
      if (!s) break;
      const me = H.me();
      if (!me) { H.step(1, 0, 0, false); continue; }

      /* A BEGINNER'S HANDS. Run at the ball when it is not hers and at
         their goal when it is, because that is what anybody does before
         they have learned anything else. */
      const carrying = s.owner && s.controlled && s.owner === s.controlled;
      const tx = carrying ? gx : s.ballX;
      const ty = carrying ? gy : s.ballY;
      let ax = tx - me.x, ay = ty - me.y;
      const L = Math.hypot(ax, ay) || 1;
      ax /= L; ay /= L;
      const st = toStick(ax, ay);

      /* ONE SHOT PER POSSESSION, NOT SIXTY A SECOND.

         The first version pressed SHOOT on every frame it was inside
         seventy units of the goal, which is not a beginner, it is a
         machine gun -- and since every shot gives the ball away it
         made "how long can she keep the ball" read as a third of a
         second no matter what the game did. The measurement was
         reporting itself. She shoots once when she gets in range, then
         runs again until she has won it back. */
      let btn = null, down = false;
      if (carrying && s.state === 'play') {
        const toGoal = Math.hypot(gx - me.x, gy - me.y);
        if (toGoal < 70 && !firedThis) { btn = 'shot'; down = true; firedThis = true; }
        else if (i - lastPass > 150) { btn = 'pass'; down = true; lastPass = i; }
      }
      if (!carrying) firedThis = false;
      H.step(1, st.ux, st.uy, down, btn || 'shot');
      if (down && btn) { H.hold(btn, false); if (btn === 'shot') shots++; else passes++; }

      /* PRESS ON THROUGH HALF TIME. A hundred and twenty seconds of
         match time crosses the interval, and the interval is a card
         waiting for somebody to press it -- so thirty-eight per cent
         of the run was her standing still on a screen the harness
         never touched, and every percentage below was measured through
         that. She presses it, the way a person does. */
      const s2 = H.state(), me2 = H.me();
      if (s2 && s2.state !== 'play') {
        const w = H.ui && H.ui();
        if (w && w.on && w.widgets && w.widgets.length) H.press(w.widgets[0].id);
      }
      states[s2.state] = (states[s2.state] || 0) + 1;
      if (s2.state === 'play') {
        const sup = H.support && H.support();
        if (sup && sup.n) support.push(sup.near);
        const w = H.ballWhy();
        why.ticks++;
        nearSum += w.near;
        if (w.owner) why.owned++;
        else if (w.lock > 0) why.locked++;
        else if (w.z > w.airCap) why.air++;
        else if (w.near > w.reach) why.tooFar++;
      }
      /* EVERYTHING BELOW IS MEASURED WHILE THE MATCH IS LIVE. A
         percentage that includes the stoppages tells you about the
         stoppages, which the state line already does, and buries what
         it was asked about. */
      const isMine = !!(s2.controlled && s2.owner === s2.controlled);
      if (s2.state === 'play') {
        live++;
        if (s2.owner === null) looseT++;
        else if (isMine) mine++;
        else theirs++;
        if (me2) {
          const d = Math.hypot(s2.ballX - me2.x, s2.ballY - me2.y);
          dists.push(d);
          if (d > 12) chasing++;
          if (d > 60) far++;
          if (lastCtl !== null && me2.name !== lastCtl) swaps++;
          lastCtl = me2.name;
        }
        if (isMine) keepT += FIXED;
        else if (keepT > 0) { if (keepT > 0.12) keeps.push(keepT); keepT = 0; }
      }
    }
    if (keepT > 0) keeps.push(keepT);
    dists.sort((a, c) => a - c);
    keeps.sort((a, c) => a - c);
    const med = (arr) => arr.length ? arr[Math.floor(arr.length / 2)] : 0;
    const s3 = H.state();
    return {
      secs: SECS,
      mine: +(mine / live * 100).toFixed(1),
      theirs: +(theirs / live * 100).toFixed(1),
      loose: +(looseT / live * 100).toFixed(1),
      chasing: +(chasing / live * 100).toFixed(1),
      far: +(far / live * 100).toFixed(1),
      distMed: +med(dists).toFixed(1),
      keepN: keeps.length,
      keepMed: +med(keeps).toFixed(2),
      keepMax: +(keeps[keeps.length - 1] || 0).toFixed(2),
      shots: shots, passes: passes,
      swapsPerMin: +(swaps / (live * FIXED) * 60).toFixed(1),
      support: support.length
        ? (() => { const a = support.slice().sort((x, y) => x - y);
                   return a[Math.floor(a.length / 2)].toFixed(1); })()
        : '-',
      why: (why.ticks ? ['owned ' + (why.owned / why.ticks * 100).toFixed(0) + '%',
             'locked ' + (why.locked / why.ticks * 100).toFixed(0) + '%',
             'in the air ' + (why.air / why.ticks * 100).toFixed(0) + '%',
             'nobody near enough ' + (why.tooFar / why.ticks * 100).toFixed(0) + '%',
             'nearest player ' + (nearSum / why.ticks).toFixed(1) + ' units'].join('  ') : '-'),
      states: Object.keys(states).sort((a, c) => states[c] - states[a])
        .map((k) => k + ' ' + (states[k] / ticks * 100).toFixed(0) + '%').join('  '),
      shotsBy: H.shotsBy ? H.shotsBy() : null,
      possBy: H.possBy ? H.possBy() : null,
      score: s3 ? s3.score : null,
    };
  }, SECS);

  console.log('  a beginner plays for ' + r.secs + ' seconds; everything below is measured WHILE PLAY IS LIVE');
  console.log('    ball is HERS          ' + r.mine + '%');
  console.log('    ball is THEIRS        ' + r.theirs + '%');
  console.log('    ball is LOOSE         ' + r.loose + '%');
  console.log('    her man is CHASING    ' + r.chasing + '%   (more than a stride from the ball)');
  console.log('    ...and MILES away     ' + r.far + '%   (over 60 units)');
  console.log('    median distance       ' + r.distMed + ' units');
  console.log('    possessions           ' + r.keepN + ', median ' + r.keepMed + 's, best ' + r.keepMax + 's');
  console.log('    shots she got off     ' + r.shots);
  console.log('    player taken off her  ' + r.swapsPerMin + ' times a minute');
  console.log('    nearest team-mate to whoever has it  ' + r.support + ' units');
  console.log('    while play ran        ' + r.why);
  console.log('    the match was in      ' + r.states);
  console.log('    shots on the board    ' + (r.shotsBy || []).join(' v '));
  console.log('    possession the game thinks ' + (r.possBy || []).join(' v '));
  console.log('    score                 ' + (r.score || []).join('-'));
  console.log(errs.length ? '  ERRORS: ' + errs.slice(0, 3).join(' | ') : '  no page errors');
  await b.close();
})();
