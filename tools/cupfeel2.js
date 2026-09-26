/* CAN SHE ACTUALLY DO THE FOUR THINGS?
 *
 * The old pad was one button meaning four things, separated by how
 * long she held it: a shot had to be held past 170ms and a pass
 * released inside it, so the two most important things you can do with
 * a football were told apart by a stopwatch. There was no dribble at
 * all.
 *
 * This drives the three new buttons the way a thumb does and asks, of
 * each one, whether the thing it claims to do actually happened to the
 * ball. A control that reads well in a help card and does nothing on
 * the pitch is exactly the bug this chapter has already had once.
 *
 *   node tools/cupfeel2.js
 */
const { chromium } = require('playwright-core');
let pass = 0, fail = 0;
const ok = (n, c, x) => { if (c) { pass++; console.log('  ok   ' + n + (x !== undefined ? '  ' + x : '')); }
                          else { fail++; console.log('  FAIL ' + n + (x !== undefined ? '  ' + x : '')); } };
(async () => {
  const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args:['--no-sandbox','--no-proxy-server'] });
  const p = await b.newPage({ viewport:{width:1000,height:640}, deviceScaleFactor:1 });
  const errs = [];
  p.on('pageerror', e=>errs.push(e.message));
  await p.route('**/*', r=>r.request().url().startsWith('http://127.0.0.1')?r.continue():r.abort());
  await p.goto('http://127.0.0.1:8899/index.html',{waitUntil:'domcontentloaded',timeout:60000});
  await p.waitForTimeout(700);
  await p.evaluate(()=>window.loadChapter&&window.loadChapter('cup'));
  await p.waitForFunction(()=>!!window.OuissyCup,{timeout:30000});
  await p.evaluate(()=>{try{localStorage.clear();}catch(e){} showScreen('cup');
                        OuissyCup.__cup.soundOff(); OuissyCup.start();});
  await p.waitForTimeout(400);

  const r = await p.evaluate(() => {
    const H = OuissyCup.__cup;
    const out = {};
    const intoPlay = () => {
      for (let i = 0; i < 400 && H.state() && H.state().state !== 'play'; i++) H.step(1, 0, 0, false);
    };
    /* give the controlled player the ball, standing still, with the
       match actually running. THE SECOND HALF OF THAT MATTERS: a shot
       taken in the block before this one puts the game into a goal
       kick or a corner, and in any state but "play" the input step is
       not called at all -- so a button held through a restart reads as
       a button that does nothing. */
    const giveHer = () => {
      for (let i = 0; i < 400 && H.state() && H.state().state !== 'play'; i++) {
        H.step(1, 0, 0, false);
      }
      const s = H.arm(0);                 // captain, ball at her feet
      for (let i = 0; i < 3; i++) H.step(1, 0, 0, false);
      return s;
    };
    H.quick(0); H.auto(false); intoPlay();
    out.reached = H.state() && H.state().state;

    /* ---- the buttons say what they will do ---- */
    giveHer();
    out.withBall = H.buttons();
    /* and without it */
    const st = H.state();
    out.hasHold = typeof H.hold === 'function';

    /* ---- SHOOT: a tap is a shot, not a pass ---- */
    giveHer();
    let before = H.state().ballZ, shots0 = H.scout ? 0 : 0;
    const s0 = H.stats ? H.stats() : null;
    const shotsBefore = H.state();
    H.tap('shot');
    let moved = 0;
    for (let i = 0; i < 20; i++) { H.step(1, 0, 0, false); }
    out.afterTapShot = { owner: H.state().owner, ballZ: H.state().ballZ };

    /* ---- SHOOT held charges ---- */
    giveHer();
    out.beforeHold = { owner: H.state().owner, controlled: H.state().controlled };
    H.hold('shot', true);
    out.rightAfterPress = H.buttons().down;
    for (let i = 0; i < 30; i++) H.step(1, 0, 0, false);
    out.afterSteps = { down: H.buttons().down, owner: H.state().owner,
                       controlled: H.state().controlled };
    /* read the BUTTON's own timer, not the ring: the opposition is
       live even with her own side's AI off, and a defender nicking it
       off her mid-hold takes `charge` to nought while the button is
       still very much held down */
    out.charge = H.buttons().held.shot;
    H.hold('shot', false);
    for (let i = 0; i < 10; i++) H.step(1, 0, 0, false);

    /* ---- PASS: the ball leaves her and goes to a team-mate ---- */
    giveHer();
    const owner0 = H.state().owner;
    H.tap('pass');
    for (let i = 0; i < 40; i++) H.step(1, 0, 0, false);
    out.afterPass = { was: owner0, now: H.state().owner };

    /* ---- DRIBBLE held = close control ---- */
    /* ONE FRAME, NOT SIX. Close control is set by the input step, so a
       single tick settles it -- and six ticks is long enough for a
       defender to take the ball off her, at which point she is not
       carrying, close control is correctly false, and the test reports
       a working control as broken. Twice, at random, which is worse
       than never working. */
    giveHer();
    H.hold('drib', true);
    H.step(1, 0.9, 0, false, 'drib');
    out.closeOn = { close: H.buttons().close, carrying: H.buttons().carrying };
    H.hold('drib', false);
    H.step(1, 0.9, 0, false);
    out.closeOff = H.buttons().close;

    /* ---- DRIBBLE tapped = a knock, with a burst ----
       AFTER THE COOLDOWN. The close-control block above let go inside
       the tap window, so it knocked too, and a knock blocks the next
       one for half a second -- the first version of this check was
       reading a knock that had been refused and calling the button
       broken. */
    for (let i = 0; i < 50; i++) H.step(1, 0, 0, false);
    giveHer();
    out.knockReady = H.buttons().burst === 0;
    H.tap('drib');
    out.burst = H.buttons().burst;
    /* the ball has to LEAVE her feet on the tap -- catching up with it
       again two frames later is the point of the thing, so that is
       read straight away rather than after a run */
    out.knockLoose = H.state().owner === null;
    /* HOW FAR THE BALL WENT, not who ended up with it. Whether she
       wins the race to it is a question about the defender who
       happens to be standing there, and a test that asks it is a coin
       toss. What the knock has to do is put the ball a long way in
       front of her -- further than any ordinary touch, which peaks
       around eighteen units -- and that is arithmetic. */
    const bx0 = H.state().ballX, by0 = H.state().ballY;
    for (let i = 0; i < 26; i++) H.step(1, 0.9, 0, false);
    out.knockRan = Math.round(Math.hypot(H.state().ballX - bx0,
                                         H.state().ballY - by0));

    /* ---- SHOOT without the ball changes player ---- */
    H.quick(0); H.auto(false); intoPlay();
    for (let i = 0; i < 40; i++) H.step(1, 0, 0, false);
    const who0 = H.state().controlled;
    let swapped = false;
    for (let i = 0; i < 6 && !swapped; i++) {
      H.tap('shot'); H.step(1, 0, 0, false);
      if (H.state().controlled !== who0) swapped = true;
    }
    out.swap = { from: who0, to: H.state().controlled, swapped };
    return out;
  });

  console.log(JSON.stringify(r, null, 1).slice(0, 1400));
  ok('the match reaches play', r.reached === 'play', r.reached);
  ok('the harness can hold a named button', r.hasHold);
  ok('with the ball the three read pass / run / shoot',
     r.withBall.pass === 'PASS' && r.withBall.drib === 'RUN' && r.withBall.shot === 'SHOOT');
  ok('a tapped shoot lets the ball go', r.afterTapShot.owner === null,
     'owner after: ' + r.afterTapShot.owner);
  ok('holding shoot charges it', r.charge > 0.25, r.charge + 's held');
  ok('a tapped pass lets the ball go', r.afterPass.now !== r.afterPass.was,
     r.afterPass.was + ' -> ' + r.afterPass.now);
  ok('holding dribble turns close control on', r.closeOn.close === true,
     'carrying: ' + r.closeOn.carrying);
  ok('and letting go turns it off', r.closeOff === false);
  ok('the knock is off cooldown before we ask', r.knockReady);
  ok('a tapped dribble knocks the ball out of her feet',
     r.burst > 0 && r.knockLoose,
     'burst ' + r.burst + 's, loose: ' + r.knockLoose);
  ok('and the ball runs a long way in front of her', r.knockRan > 20,
     r.knockRan + ' units, against about 18 for the longest normal touch');
  ok('shoot without the ball changes player', r.swap.swapped,
     r.swap.from + ' -> ' + r.swap.to);
  ok('no page errors', errs.length === 0, errs.slice(0,2).join(' | '));
  console.log('');
  console.log(fail ? pass + ' passed, ' + fail + ' FAILED' : 'all ' + pass + ' checks passed');
  await b.close();
  process.exit(fail ? 1 : 0);
})();
