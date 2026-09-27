/* Does the stealth actually work? Drive it and assert, rather than hoping. */
const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox','--no-proxy-server','--disable-gpu'] });
  const p = await b.newPage({ viewport: { width: 1180, height: 820 } });
  p.on('pageerror', e => console.log('PAGEERROR', e.message));
  await p.route('**/*', r => r.request().url().startsWith('http://127.0.0.1') ? r.continue() : r.abort());
  await p.goto('http://127.0.0.1:8899/index.html', { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(1000);
  /* The chapter is fetched on demand now -- index.html no longer
     carries apocalypse.js, so `Apocalypse` does not exist until the
     site has been asked for it. Every suite in this folder was
     written before that and died on `Apocalypse is not defined`. */
  await p.evaluate(() => window.loadChapter && window.loadChapter('apoc'));
  await p.waitForFunction(() => !!window.Apocalypse, null, { timeout: 20000 });
  /* And the hooks arrive later still. start() builds the scene behind a
     promise and only installs them when that resolves, so every suite
     here called start() and used __apEnter in the same synchronous
     block -- which cannot work, and reported "not a function". */
  await p.evaluate(() => { showScreen('apoc'); Apocalypse.start(); });
  await p.waitForFunction(() => typeof window.__apEnter === 'function', null, { timeout: 30000 });
  const out = await p.evaluate(() => {
    const R = [];
    const ok = (n, c, x) => R.push([(c ? 'PASS  ' : 'FAIL  ') + n, x === undefined ? '' : x]);

    /* THE API THIS FILE WAS WRITTEN AGAINST NO LONGER EXISTS.

       It called __apPump(2, {left:true}) and read .x off the result.
       __apPump takes (dt, howManyTicks) and returns the state string --
       there is no key map and no position in it. Keys are held with
       __apKey and the position comes from __apState().player. So every
       movement assertion here was reading `undefined.x`, and the whole
       file has been dying before its first check for a long time. */
    const P = () => window.__apState().player;
    const hold = (keys, secs) => {
      keys.forEach(k => window.__apKey(k, 1));
      window.__apPump(1 / 60, Math.round(secs * 60));
      keys.forEach(k => window.__apKey(k, 0));
      return window.__apState();
    };

    /* ---- the house: walls, doors, hiding ---- */
    window.__apEnter(0);
    ok('level 1 builds', !!window.__apState(), window.__apState().level);

    /* a wall stops her: walk hard at one and see how far she gets */
    window.__apTeleport(4, 3);
    const p0 = P();
    hold(['left'], 2);
    const p1 = P();
    ok('a wall stops her', Math.abs(p1.x - p0.x) < 4,
       'moved ' + Math.abs(p1.x - p0.x).toFixed(2) + ' world units');

    /* she does move when nothing is in the way */
    window.__apTeleport(4, 3);
    const q0 = P();
    hold(['down'], 1.2);
    const q1 = P();
    ok('and she moves when nothing is', Math.abs(q1.z - q0.z) > 0.2,
       'moved ' + Math.abs(q1.z - q0.z).toFixed(2));

    /* hiding, in a tile found on the map rather than assumed */
    const spots = window.__apHideSpots();
    ok('the house has somewhere to hide', spots.length > 0, spots.length + ' spots');
    if (spots.length) {
      window.__apTeleport(spots[0].x, spots[0].y);
      window.__apPump(1 / 60, 20);
      ok('hiding in one reports hidden', !!P().hidden, 'tile "' + spots[0].c + '"');
    }

    /* ---- the street: the stealth proper. This is where the zombies
       are; the old file ran every stealth check on the house, which has
       none of them. ---- */
    window.__apEnter(1);
    const z = window.__apZombies();
    ok('the street has zombies in it', z.length > 0, z.length + ' of them');

    if (z.length) {
      window.__apClear();
      window.__apTeleport(z[0].tx, z[0].ty);
      const caught = hold([], 1.5);
      ok('standing on one is a close call',
         caught.state !== 'play' || caught.closeCalls > 0,
         'state=' + caught.state + ' closeCalls=' + caught.closeCalls);

      window.__apPump(1 / 60, 300);
      ok('and she comes out of it', window.__apState().state === 'play',
         'state=' + window.__apState().state);

      const hides = window.__apHideSpots();
      if (hides.length) {
        window.__apClear();
        window.__apTeleport(hides[0].x, hides[0].y);
        window.__apMoveZombie(0, hides[0].x, hides[0].y);
        const safe = hold([], 1.5);
        ok('hidden, with one on top of her, she is not caught',
           safe.state === 'play', 'hidden=' + P().hidden + ' state=' + safe.state);
      } else {
        ok('the street has somewhere to hide', false, 'no hide tiles on this map');
      }
    }
    return R;
  });
  out.forEach(r => console.log(...r));
  const bad = out.filter(r => String(r[0]).startsWith('FAIL')).length;
  console.log(bad ? bad + ' failed' : 'all ' + out.length + ' checks passed');
  await b.close();
})();
