/* LEVEL ONE, PLAYED THE WAY SHE PLAYS IT.

   Out of bed, down to the television, round her own house for the torch
   and the fridge, into the garage, the four cores into the board with a
   real pointer, and out through the shutter. Every beat is asserted, so
   a step that stops clearing is a failure here rather than something she
   finds on the night.

   This file used to print facts and never judge them, and most of the
   facts were wrong: it clicked `.ap-tv .ap-note-ok`, which the set has
   never had (its button is `.ap-card-go`); it called
   `__apPump(1.2, {down:true})`, which is not that function's shape; and
   it grepped the door list for the word "power", which no door in this
   file is called. All of it printed happily and asserted nothing. */
const { chromium } = require('playwright-core');
let pass = 0, fail = 0;
const ok = (n, c, x) => { if (c) { pass++; console.log('  ok   ' + n + (x ? '  ' + x : '')); }
                          else { fail++; console.log('  FAIL ' + n + (x ? '  ' + x : '')); } };

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox','--no-proxy-server','--disable-gpu'] });
  const p = await b.newPage({ viewport: { width: 1180, height: 820 } });
  const errs = [];
  p.on('pageerror', e => { errs.push(e.message); console.log('PAGEERROR', e.message); });
  await p.route('**/*', r => r.request().url().startsWith('http://127.0.0.1') ? r.continue() : r.abort());
  await p.goto('http://127.0.0.1:8899/index.html', { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(800);
  /* the chapter is fetched on demand -- index.html no longer carries it */
  await p.evaluate(() => window.loadChapter && window.loadChapter('apoc'));
  await p.waitForFunction(() => !!window.Apocalypse, null, { timeout: 20000 });
  await p.evaluate(() => { showScreen('apoc'); Apocalypse.start(); });
  /* and the hooks arrive later still: start() builds behind a promise */
  await p.waitForFunction(() => typeof window.__apEnter === 'function', null, { timeout: 30000 });
  await p.evaluate(() => window.__apEnter(0));
  await p.waitForTimeout(200);

  const st = () => p.evaluate(() => window.__apState());
  const step = async () => (await st()).step;
  /* stand next to a thing rather than guessing where it is */
  const at = async (ch, dy) => p.evaluate(([c, d]) => {
    const f = window.__apFind(c);
    if (!f.length) return false;
    window.__apClear();
    window.__apTeleport(f[0].x, f[0].y + d);
    window.__apPump(1 / 60, 4);
    return true;
  }, [ch, dy === undefined ? 1 : dy]);
  const talk = async (n) => {
    await p.evaluate((k) => { for (let i = 0; i < k; i++) window.__apSkipDialogue(); }, n || 1);
    await p.waitForTimeout(150);
  };

  ok('level one is the house', (await st()).level === 'home', (await st()).level);
  ok('and it opens on the television', await step() === 'tv');

  /* ---- the television ---- */
  await at('T');
  await p.evaluate(() => window.__apUse());
  await p.waitForTimeout(350);
  ok('standing at it turns it on', await p.evaluate(() => !!document.querySelector('.ap-tv')));
  ok('and there is a way to turn it off',
     await p.evaluate(() => !!document.querySelector('.ap-tv .ap-card-go')));
  /* click it in the page: Playwright's own click waits on "scheduled
     navigations" and this button starts an audio graph, which hangs it */
  await p.evaluate(() => document.querySelector('.ap-tv .ap-card-go').click());
  await p.waitForTimeout(300);
  ok('turning it off puts the screen out',
     await p.evaluate(() => { const w = window.Apocalypse.game.world;
                              return !!w && !!w.tvScreen && !w.tvScreen.material.map; }));
  await talk(2);
  ok('and the beat clears', await step() !== 'tv', 'now ' + await step());

  /* ---- the torch, and the last meal in the house ---- */
  ok('the next thing asked for is the torch', await step() === 'torch', await step());
  await at('1');
  await p.evaluate(() => window.__apUse());
  await p.waitForTimeout(250);
  ok('she picks it up', await p.evaluate(() => !!window.Apocalypse.game.player.hasTorch));
  await talk(2);
  ok('and it clears the beat', await step() !== 'torch', 'now ' + await step());

  await at('f');
  await p.evaluate(() => window.__apUse());
  await p.waitForTimeout(350);
  ok('the fridge opens', await p.evaluate(() => !!document.querySelector('.ap-fridge-canvas')));
  await p.evaluate(() => window.__apClear());
  await p.waitForTimeout(200);

  /* ---- the distribution board, dragged with a real pointer ---- */
  ok('and then the garage', await step() === 'panel', await step());
  await at('W');
  await p.evaluate(() => window.__apUse());
  await p.waitForTimeout(400);
  const hasPanel = await p.evaluate(() => !!document.querySelector('.ap-panel-canvas'));
  ok('the board is on the wall', hasPanel);

  if (hasPanel) {
    /* Drag them the way a hand does -- two with a mouse and two with a
       finger, because the finger is the path that broke once and nothing
       has watched it since. The events are dispatched inside the page:
       Playwright's own pointer hangs on this page waiting for a
       navigation the request filter has aborted, and these are the same
       events a browser sends, through the same three listeners. */
    const drag = (i, touch) => p.evaluate(([i, touch]) => {
      const cv = document.querySelector('.ap-panel-canvas');
      const r = cv.getBoundingClientRect();
      const P = window.__apPanelState();
      const map = (x, y) => ({ x: r.left + (x / P.w) * r.width,
                               y: r.top + (y / P.h) * r.height });
      const w = P.wires[i];
      const s = P.sockets.find(s => s.key === w.key);
      const from = map(w.ex, w.ey), to = map(s.x + 10, s.y);
      const mid = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };
      if (touch) {
        const t = (el, x, y) => new Touch({ identifier: 7, target: el, clientX: x, clientY: y });
        const fire = (el, type, x, y) => el.dispatchEvent(new TouchEvent(type, {
          bubbles: true, cancelable: true, changedTouches: [t(cv, x, y)],
          touches: type === 'touchend' ? [] : [t(cv, x, y)] }));
        fire(cv, 'touchstart', from.x, from.y);
        fire(window, 'touchmove', mid.x, mid.y);
        fire(window, 'touchmove', to.x, to.y);
        fire(window, 'touchend', to.x, to.y);
      } else {
        const fire = (el, type, x, y) => el.dispatchEvent(new MouseEvent(type, {
          bubbles: true, cancelable: true, clientX: x, clientY: y, buttons: 1 }));
        fire(cv, 'mousedown', from.x, from.y);
        fire(window, 'mousemove', mid.x, mid.y);
        fire(window, 'mousemove', to.x, to.y);
        fire(window, 'mouseup', to.x, to.y);
      }
      const after = window.__apPanelState();
      return !after || !!after.done[i];
    }, [i, touch]);

    const n = await p.evaluate(() => window.__apPanelState().wires.length);
    ok('it has four cores to place', n === 4, n + '');
    ok('a core dropped with a mouse seats', await drag(0, false));
    ok('and one dropped with a finger seats too', await drag(1, true));
    await drag(2, false);
    await drag(3, true);
    ok('all four in, the board reports itself solved',
       await p.evaluate(() => { const s = window.__apPanelState(); return !s || s.solved; }));
    await p.waitForTimeout(1400);
    ok('and it closes itself afterwards',
       await p.evaluate(() => !document.querySelector('.ap-panel-canvas')));
    await talk(3);
    const doors = await p.evaluate(() => window.__apState().doors);
    const dead = doors.filter(d => d.kind === 'P');
    ok('every door the board feeds lets go', dead.length > 0 && dead.every(d => !d.locked),
       dead.length + ' of them');
    ok('the shutter is up', await p.evaluate(() => !!window.Apocalypse.game.world.powered));
    ok('and the last beat is the way out', await step() === 'exit', await step());
  }

  /* ---- out through the drive ---- */
  await p.evaluate(() => {
    const x = window.__apFind('X');
    window.__apClear();
    if (x.length) window.__apTeleport(x[0].x, x[0].y);
    window.__apPump(1 / 60, 30);
  });
  await p.waitForTimeout(600);
  const end = await st();
  ok('walking onto the drive ends the level', end.state !== 'play' || end.level !== 'home',
     'state=' + end.state + ' level=' + end.level);

  ok('and none of it threw', errs.length === 0, errs.slice(0, 2).join(' | '));
  console.log('');
  console.log(fail ? pass + ' passed, ' + fail + ' FAILED' : 'all ' + pass + ' checks passed');
  await b.close();
  process.exit(fail ? 1 : 0);
})();
