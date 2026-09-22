/* A look at the cup in the places a screenshot is worth taking: the
   round card, the kickoff, the goalmouth and the moment after one goes
   in. Renders, not assertions — tools/cup.js does the asserting. */
const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox','--no-proxy-server','--disable-gpu','--autoplay-policy=no-user-gesture-required'] });
  const p = await b.newPage({ viewport: { width: 960, height: 600 }, deviceScaleFactor: 1 });
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.route('**/*', r => r.request().url().startsWith('http://127.0.0.1') ? r.continue() : r.abort());
  await p.goto('http://127.0.0.1:8899/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForTimeout(800);
  await p.evaluate(() => window.loadChapter && window.loadChapter('cup'));
  await p.waitForFunction(() => !!window.OuissyCup, { timeout: 30000 });
  await p.evaluate(() => { try { localStorage.clear(); } catch (e) {} showScreen('cup'); OuissyCup.__cup.soundOff(); OuissyCup.__cup.shadows(false); OuissyCup.start(); });
  await p.waitForTimeout(500);
  await p.screenshot({ path: '/tmp/cup-card.png' });

  await p.click('.cup-card-b');
  await p.waitForTimeout(2400);
  await p.screenshot({ path: '/tmp/cup-play.png' });

  /* the goalmouth she is shooting at */
  await p.evaluate(() => {
    const g = OuissyCup.__cup.geometry();
    OuissyCup.__cup.put(g.pitch.cx + 14, g.pitch.y0 + 40, 0);
    for (let i = 0; i < 90; i++) OuissyCup.__cup.step(1, 0, -1, false);
    OuissyCup.__cup.draw();
  });
  await p.screenshot({ path: '/tmp/cup-goalmouth.png' });
  console.log('at the goalmouth:', JSON.stringify(await p.evaluate(() => OuissyCup.__cup.state())));

  /* and one going in */
  await p.evaluate(() => {
    const g = OuissyCup.__cup.geometry();
    OuissyCup.__cup.put(g.pitch.cx, g.pitch.y0 + 26, 0);
    OuissyCup.__cup.kick(0, -220, 0);
    for (let i = 0; i < 26; i++) OuissyCup.__cup.step(1, 0, 0, false);
    OuissyCup.__cup.draw();
  });
  await p.waitForTimeout(200);
  await p.screenshot({ path: '/tmp/cup-goal.png' });
  console.log('after a shot:', JSON.stringify(await p.evaluate(() => OuissyCup.__cup.state())));

  /* and one with the shadow map on, which is how it actually ships.
     swiftshader hates shadows, so this is the only frame that pays for
     them — but a cartoon with nothing under its feet floats, and that is
     worth checking on something other than faith. */
  await p.evaluate(() => {
    OuissyCup.__cup.shadows(true);
    OuissyCup.__cup.setState('play');
    const g = OuissyCup.__cup.geometry();
    OuissyCup.__cup.put(g.pitch.cx - 6, g.pitch.y0 + 110, 0);
    for (let i = 0; i < 50; i++) OuissyCup.__cup.step(1, 0.25, -1, false);
  });
  await p.waitForTimeout(3000);
  await p.screenshot({ path: '/tmp/cup-shadows.png' });
  /* a goal, and what happens for the three seconds afterwards */
  await p.evaluate(() => {
    OuissyCup.__cup.setState('play');
    OuissyCup.__cup.setScore(0, 0);
    const g = OuissyCup.__cup.geometry();
    OuissyCup.__cup.put(g.pitch.cx + 18, g.pitch.y0 + 8, 0);
    OuissyCup.__cup.kick(0, -260, 0);
    for (let i = 0; i < 8; i++) OuissyCup.__cup.step(1, 0, 0, false);
    for (let i = 0; i < 55; i++) OuissyCup.__cup.step(1, 0, 0, false);
  });
  await p.waitForTimeout(1400);
  await p.screenshot({ path: '/tmp/cup-celebrate.png' });
  console.log('celebrating:', JSON.stringify(await p.evaluate(() => OuissyCup.__cup.celebration())));
  console.log('anims:', await p.evaluate(() => OuissyCup.__cup.anims()));
  console.log(errs.length ? 'ERRORS: ' + errs.slice(0, 4).join(' | ') : 'no page errors');
  await b.close();
})();
