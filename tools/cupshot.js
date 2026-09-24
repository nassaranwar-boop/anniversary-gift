/* A look at the cup in the places a screenshot is worth taking: the
   round card, the kickoff, the goalmouth and the moment after one goes
   in. Renders, not assertions — tools/cup.js does the asserting. */
const { chromium } = require('playwright-core');
/* THE MENUS ARE DRAWN, NOT LAID OUT.

   The title screen used to be DOM buttons with data-go on them. It is
   pixel UI now — one canvas, hit-tested by rectangle — so a harness
   presses one the way a thumb does: find the widget's rectangle, work
   out where that lands on the page, and click there. */
async function clickUi(p, id) {
  /* WAIT FOR IT TO STOP MOVING FIRST. Every row slides in on its own
     delay, so a rectangle read mid-entrance is a rectangle the button
     has already left by the time the mouse gets there — which is a
     click on the grass, and a test that fails once in three runs. */
  await p.waitForFunction(() => OuissyCup.__cup.ui().age > 1.1,
                          null, { timeout: 60000, polling: 200 });
  const rect = await p.evaluate((wid) => {
    const w = OuissyCup.__cup.ui().widgets.find(v => v.id === wid);
    const ui = document.getElementById('cup-ui');
    const r = ui.getBoundingClientRect();
    return w ? { x: r.left + (w.x + w.w / 2) / ui.width * r.width,
                 y: r.top + (w.y + w.h / 2) / ui.height * r.height } : null;
  }, id);
  if (!rect) throw new Error('no such pixel button: ' + id);
  await p.mouse.move(rect.x, rect.y);
  await p.mouse.down();
  await p.waitForTimeout(60);
  await p.mouse.up();
  await p.waitForTimeout(400);
}

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
  console.log('card:', await p.evaluate(() =>
    (document.querySelector('#cup-overlay .cup-card') || {}).childElementCount));

  /* THE ROUTE HAS TWO MORE DOORS IN IT than when this was written: the
     controls come up the first time anyone opens the chapter, and then
     the title menu, and only then the fixture. */
  await p.click('[data-go="back"]').catch(() => {});
  await p.waitForFunction(() => OuissyCup.__cup.ui().name === 'title',
                          { timeout: 20000 });
  await p.waitForFunction(() => OuissyCup.__cup.ui().age > 1.2,
                          null, { timeout: 60000, polling: 250 });
  await p.screenshot({ path: '/tmp/cup-menu.png' });
  await clickUi(p, 'm_coupe');
  await p.waitForSelector('.cup-card-b', { timeout: 20000 });
  await p.screenshot({ path: '/tmp/cup-card.png' });
  await p.click('.cup-card-b');
  await p.evaluate(() => {
    for (let i = 0; i < 260 && OuissyCup.__cup.state().state !== 'play'; i++) {
      OuissyCup.__cup.step(1, 0, 0, false);
    }
    for (let i = 0; i < 90; i++) OuissyCup.__cup.step(1, 0.2, -0.9, false);
    OuissyCup.__cup.render();
  });
  await p.waitForTimeout(400);
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

  /* THE SHADOWS COST NOTHING NOW. There is no shadow map: every shadow
     in the game is an ellipse drawn on the grass, so this frame used to
     be the expensive one and is now the same as any other. It is kept
     because a cartoon with nothing under its feet floats, and that is
     worth checking on something other than faith. */
  await p.evaluate(() => {
    OuissyCup.__cup.setState('play');
    const g = OuissyCup.__cup.geometry();
    OuissyCup.__cup.put(g.pitch.cx - 6, g.pitch.y0 + 110, 0);
    for (let i = 0; i < 50; i++) OuissyCup.__cup.step(1, 0.25, -1, false);
  });
  await p.waitForTimeout(400);
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

  /* half time, with the numbers on it */
  await p.evaluate(() => {
    OuissyCup.__cup.setState('play');
    OuissyCup.__cup.setClock(999);
    OuissyCup.__cup.step(1, 0, 0, false);
  });
  await p.waitForTimeout(700);
  await p.screenshot({ path: '/tmp/cup-half.png' });
  console.log('celebrating:', JSON.stringify(await p.evaluate(() => OuissyCup.__cup.celebration())));
  console.log('anims:', await p.evaluate(() => OuissyCup.__cup.anims()));
  console.log(errs.length ? 'ERRORS: ' + errs.slice(0, 4).join(' | ') : 'no page errors');
  await b.close();
})();
