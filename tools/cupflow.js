/* The route she actually takes: hub card, chapter loads, match plays,
   a goal counts, half time comes, and the way out works. */
const { chromium } = require('playwright-core');
let pass = 0, fail = 0;
const ok = (n, c, x) => { if (c) { pass++; console.log('  ok   ' + n); }
                          else { fail++; console.log('  FAIL ' + n + (x ? '  ' + JSON.stringify(x) : '')); } };
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
    args: ['--use-gl=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist',
           '--no-sandbox','--no-proxy-server','--autoplay-policy=no-user-gesture-required'] });
  const p = await b.newPage({ viewport: { width: 900, height: 560 }, deviceScaleFactor: 1 });
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.route('**/*', r => r.request().url().startsWith('http://127.0.0.1') ? r.continue() : r.abort());
  await p.goto('http://127.0.0.1:8899/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForTimeout(1200);

  /* the hub, the way the site gets there */
  await p.evaluate(() => { try { localStorage.clear(); } catch (e) {} showScreen('hub'); startHub(); });
  await p.waitForTimeout(400);
  ok('the hub has six cards', await p.evaluate(() => document.querySelectorAll('.hub-card').length) === 6);
  ok('one of them is the cup', await p.evaluate(() => !!document.getElementById('hub-card-cup')));
  ok('and its poster is a drawing, not an empty box',
     await p.evaluate(() => !!document.querySelector('.hub-art-cup svg')));

  await p.click('#hub-card-cup');
  await p.waitForFunction(() => window.OuissyCup && OuissyCup.__cup.state() !== null, { timeout: 60000 });
  await p.waitForTimeout(900);
  ok('the cup screen is the one on show',
     await p.evaluate(() => document.getElementById('screen-cup').classList.contains('active')));
  ok('the pitch built', await p.evaluate(() => OuissyCup.__cup.geometry().rigs) === 8);
  ok('and the retro layer is on',
     await p.evaluate(() => document.getElementById('cup-canvas').classList.contains('px')));

  /* The chapter opens on its own title menu now rather than straight
     into a fixture, so the route she takes has one more step in it and
     so does this: PLAY THE CUP, then the round card, then kick off. */
  /* THE FIRST THING SHE EVER SEES is the controls, not the menu —
     RULES.showHelpFirstTime, once per browser. The harness clears
     localStorage, so it is always the first time in here. */
  await p.waitForSelector('#cup-overlay .cup-card', { timeout: 40000 });
  ok('it opens on the how-to the first time',
     await p.evaluate(() => /BEFORE YOU START/.test(document.querySelector('#cup-overlay').textContent)));
  await p.click('[data-go="back"]');
  await p.waitForFunction(() => OuissyCup.__cup.ui().name === 'title',
                          { timeout: 20000 });
  ok('and then on its own menu', true);
  ok('with all six of its rows drawn on the pitch',
     await p.evaluate(() => OuissyCup.__cup.ui().widgets
       .filter(w => w.id.indexOf('m_') === 0).length) >= 6);
  await clickUi(p, 'm_coupe');
  await p.waitForSelector('.cup-card-b', { timeout: 20000 });
  ok('and THE CUP puts up the fixture',
     /QUARTER-FINAL|UM6P/.test(await p.evaluate(() =>
       document.querySelector('#cup-overlay .cup-card').textContent)));
  await p.click('.cup-card-b');
  /* Drive the clock rather than waiting on one. requestAnimationFrame in
     this container runs at about three frames a second and the loop only
     ever takes six fixed steps a frame, so two seconds of wall time is
     about half a second of football — the first version of this test sat
     watching a kickoff that had barely started and called it a bug. */
  let s = await p.evaluate(() => {
    for (let i = 0; i < 200 && OuissyCup.__cup.state().state !== 'play'; i++) {
      OuissyCup.__cup.step(1, 0, 0, false);
    }
    return OuissyCup.__cup.state();
  });
  ok('the whistle goes and it is in play', s.state === 'play', s);
  ok('she is the one being driven', s.controlled === 'OUISSY', s);

  /* a goal, and it goes to the right side of the board */
  await p.evaluate(() => {
    const g = OuissyCup.__cup.geometry();
    /* off-centre and close in: down the middle from twenty yards is a
       ball the keeper catches, which is correct of him and useless as a
       test of who gets credited for it */
    OuissyCup.__cup.put(g.pitch.cx + 22, g.pitch.y0 + 7, 0);
    OuissyCup.__cup.kick(0, -260, 0);
    for (let i = 0; i < 8; i++) OuissyCup.__cup.step(1, 0, 0, false);
  });
  s = await p.evaluate(() => OuissyCup.__cup.state());
  ok('a ball over her opponents line is her goal', s.score[0] === 1 && s.score[1] === 0, s);

  /* and the same goal at the other end, after the break, is theirs —
     they change ends, which a hard-coded end gets backwards */
  await p.evaluate(() => {
    OuissyCup.__cup.setState('play');
    OuissyCup.__cup.setScore(0, 0);
    const g = OuissyCup.__cup.geometry();
    OuissyCup.__cup.put(g.pitch.cx - 22, g.pitch.y1 - 7, 0);
    OuissyCup.__cup.kick(0, 260, 0);
    for (let i = 0; i < 8; i++) OuissyCup.__cup.step(1, 0, 0, false);
  });
  s = await p.evaluate(() => OuissyCup.__cup.state());
  ok('and one over her own line is theirs', s.score[1] === 1 && s.score[0] === 0, s);

  /* half time arrives on the clock and offers a way on */
  await p.evaluate(() => {
    OuissyCup.__cup.setState('play');
    OuissyCup.__cup.setClock(999);
    OuissyCup.__cup.step(1, 0, 0, false);
  });
  await p.waitForTimeout(300);
  ok('the half ends by itself', await p.evaluate(() => OuissyCup.__cup.state().state) === 'half');
  ok('and says so on a card', await p.evaluate(() =>
    !!document.querySelector('#cup-overlay .cup-card') &&
    /HALF TIME/.test(document.querySelector('#cup-overlay h3').textContent)));

  ok('no page errors anywhere in that', errs.length === 0, errs.slice(0, 4));
  console.log(pass + ' passed, ' + fail + ' failed');
  await b.close();
  process.exit(fail ? 1 : 0);
})();
