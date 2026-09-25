/* THE SAME MATCH, PHOTOGRAPHED BOTH WAYS ROUND.
 *
 * The question "is side-on better?" cannot be answered by two
 * screenshots of two different matches, which is what a reload gives:
 * different players, different positions, different light. So this
 * steps ONE match to an interesting moment, photographs it, turns the
 * pitch through ninety degrees without touching the simulation, and
 * photographs the same instant again. The only difference between the
 * two pictures is the one being judged.
 *
 *   node tools/cupside.js
 */
const { chromium } = require('playwright-core');

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

  /* one match, stepped to each moment in turn */
  const moments = [
    ['midfield', 900],
    ['buildup', 1700],
    ['final-third', 2600],
  ];

  for (const [name, ticks] of moments) {
    await p.evaluate((n) => {
      const H = OuissyCup.__cup;
      H.quick(0); H.auto(true);
      for (let i = 0; i < 400 && H.state().state !== 'play'; i++) H.step(1, 0, 0, false);
      for (let i = 0; i < n; i++) H.step(1, 0, 0, false);
    }, ticks);

    for (const side of [false, true]) {
      await p.evaluate((on) => {
        const H = OuissyCup.__cup;
        /* WAIT FOR OPEN PLAY BEFORE PHOTOGRAPHING EITHER WAY.

           Left to step a fixed number of ticks, the match sometimes
           lands mid-celebration, and the celebration camera is a
           two-times push-in on the scorer that cuts over several
           frames. Photographed at that instant it comes back as a
           frame of empty stand — which looks exactly like a broken
           renderer and is really a shot taken during a cut. */
        for (let i = 0; i < 3000 && H.state().state !== 'play'; i++) H.step(1, 0, 0, false);
        H.side(on);
        /* a handful of frames so the camera settles and the sprites
           pick their new facings, but not enough to move the play */
        for (let i = 0; i < 4; i++) H.step(1, 0, 0, false);
        H.camSnap();
      }, side);
      await p.waitForTimeout(900);
      const f = `/tmp/side-${name}-${side ? 'across' : 'up'}.png`;
      await p.screenshot({ path: f });
      console.log('  -> ' + f);
    }
    /* leave it upright for the next moment */
    await p.evaluate(() => OuissyCup.__cup.side(false));
  }

  /* AND A GOALMOUTH, which is the shot the side-on camera is supposed
     to be good at and the one the upright camera struggles with. */
  await p.evaluate(() => {
    const H = OuissyCup.__cup;
    H.quick(0); H.auto(true);
    for (let i = 0; i < 400 && H.state().state !== 'play'; i++) H.step(1, 0, 0, false);
    for (let i = 0; i < 600; i++) H.step(1, 0, 0, false);
    H.put(20, 70, 0);
    for (let i = 0; i < 120; i++) H.step(1, 0, 0, false);
  });
  for (const side of [false, true]) {
    await p.evaluate((on) => {
      const H = OuissyCup.__cup;
      /* open play only — see the note in the loop above */
      for (let i = 0; i < 3000 && H.state().state !== 'play'; i++) H.step(1, 0, 0, false);
      H.side(on);
      for (let i = 0; i < 4; i++) H.step(1, 0, 0, false);
      H.camSnap();
    }, side);
    await p.waitForTimeout(900);
    const f = `/tmp/side-goalmouth-${side ? 'across' : 'up'}.png`;
    await p.screenshot({ path: f });
    console.log('  -> ' + f);
  }

  if (errs.length) console.log('PAGE ERRORS: ' + JSON.stringify(errs.slice(0, 5)));
  console.log('DONE');
  await b.close();
})();
