/* WHAT THE MATCH ACTUALLY LOOKS LIKE — four frames, fast.
 *
 * cupshot walks the menus the way a thumb does, which is the right
 * thing for testing the menus and far too slow to use while working on
 * the pitch. This goes straight in through the quick-match hook and
 * photographs the things that were changed: open play, the HUD, a
 * goalmouth, and the super's nameplate now that it is drawn rather than
 * a DOM card.
 *
 *   node tools/cuplook.js
 */
const { chromium } = require('playwright-core');
const fs = require('fs');

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox', '--no-proxy-server', '--autoplay-policy=no-user-gesture-required'] });
  const p = await b.newPage({ viewport: { width: 960, height: 540 }, deviceScaleFactor: 1 });
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

  const shot = async (name, setup, hold, arg) => {
    await p.evaluate(setup, arg);
    if (hold) { await p.waitForTimeout(500);
                await p.screenshot({ path: '/tmp/look-' + name + '.png' });
                console.log('  -> /tmp/look-' + name + '.png'); return; }
    /* LET THE FRAME LOOP CATCH UP BEFORE PHOTOGRAPHING.

       The sim is stepped by hand, hundreds of ticks inside a single JS
       turn, but the goal flash and the screen shake decay on the RENDER
       clock — so a shot taken immediately after a hand-stepped goal
       catches the white flash at full strength and comes out as a pink
       rectangle with a stadium faintly behind it. Waiting for the flash
       to have decayed is waiting for the thing that actually matters. */
    await p.waitForFunction(() => {
      const s = OuissyCup.__cup.state();
      return s && s.state === 'play';
    }, null, { timeout: 20000, polling: 100 }).catch(() => {});
    await p.evaluate(() => OuissyCup.__cup.camSnap());
    await p.waitForTimeout(1300);
    await p.screenshot({ path: '/tmp/look-' + name + '.png' });
    console.log('  -> /tmp/look-' + name + '.png');
  };

  await shot('play', () => {
    const H = OuissyCup.__cup;
    H.quick(0); H.auto(true);
    for (let i = 0; i < 400 && H.state().state !== 'play'; i++) H.step(1, 0, 0, false);
    for (let i = 0; i < 900; i++) H.step(1, 0, 0, false);
  });

  await shot('hearts', () => {
    /* the meter part-filled, so the hearts are caught mid-count rather
       than all empty or all full */
    const H = OuissyCup.__cup;
    H.heart(0, 58);
    for (let i = 0; i < 60; i++) H.step(1, 0, 0, false);
  });

  await shot('goalmouth', () => {
    const H = OuissyCup.__cup;
    const g = H.geometry ? H.geometry() : null;
    /* put the ball in front of a goal and let it run */
    H.put(20, 70, 0);
    for (let i = 0; i < 260; i++) H.step(1, 0, 0, false);
  });

  /* THE SUPER NEEDS THE CAPTAIN ON THE BALL, which is the whole point
     of it — so the shot has to actually engineer that rather than just
     filling the meter. The ball is placed at each outfielder's feet in
     turn until the super arms, which is the cheapest way to find the
     captain without a hook that exists only for this. */
  await shot('super', () => {
    const H = OuissyCup.__cup;
    H.quick(0);
    for (let i = 0; i < 400 && H.state().state !== 'play'; i++) H.step(1, 0, 0, false);
    H.superNow(0);
    for (let i = 0; i < 20; i++) H.step(1, 0, 0, false);
  }, true);

  /* A GOAL, CAUGHT DURING THE REPLAY — which is also the only way to
     photograph the lower third and the crowd's reaction together. */
  await shot('goal', () => {
    const H = OuissyCup.__cup;
    H.quick(0); H.auto(true);
    for (let i = 0; i < 400 && H.state().state !== 'play'; i++) H.step(1, 0, 0, false);
    /* put one in rather than waiting for one */
    for (let i = 0; i < 4000 && H.state().state !== 'replay'; i++) H.step(1, 0, 0, false);
    for (let i = 0; i < 30; i++) H.step(1, 0, 0, false);
    H.camSnap();
  }, true);

  /* THE PASS INDICATOR, which only exists while SHE is driving — so
     this shot deliberately does not turn the autopilot on, and puts the
     ball at the feet of whoever the game has given her. */
  await shot('passhint', () => {
    const H = OuissyCup.__cup;
    H.quick(0);
    for (let i = 0; i < 400 && H.state().state !== 'play'; i++) H.step(1, 0, 0, false);
    for (let i = 0; i < 200; i++) H.step(1, 0, 0, false);
    const s = H.scout();
    const me = s.players.find(q => q.name === H.state().controlled && !q.gk);
    if (me) H.put(me.x, me.y, 0);
    /* long enough for her to actually take possession AND for the hint
       to recompute — it only refreshes eight times a second */
    for (let i = 0; i < 90; i++) H.step(1, 0, 0, false);
    H.camSnap();
  }, true);

  /* a booking, which a match will not produce on demand */
  await shot('card', () => {
    const H = OuissyCup.__cup;
    H.quick(0); H.auto(true);
    for (let i = 0; i < 400 && H.state().state !== 'play'; i++) H.step(1, 0, 0, false);
    for (let i = 0; i < 90; i++) H.step(1, 0, 0, false);
    H.book(false);
    for (let i = 0; i < 24; i++) H.step(1, 0, 0, false);
    H.camSnap();
  }, true);

  /* the two restarts, caught mid-walk so the marks can be judged */
  for (const kind of ['corner', 'goalkick']) {
    await shot(kind, (k) => {
      const H = OuissyCup.__cup;
      H.quick(0); H.auto(true);
      for (let i = 0; i < 400 && H.state().state !== 'play'; i++) H.step(1, 0, 0, false);
      for (let i = 0; i < 120; i++) H.step(1, 0, 0, false);
      H.restart(k, 1);
      for (let i = 0; i < 55; i++) H.step(1, 0, 0, false);
      H.camSnap();
    }, true, kind);
  }

  if (errs.length) console.log('PAGE ERRORS: ' + JSON.stringify(errs.slice(0, 4)));
  await b.close();
})();
