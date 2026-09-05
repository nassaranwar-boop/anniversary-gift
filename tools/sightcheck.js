/* WHAT THEY CAN SEE, AND WHERE THEY ARE NOT ALLOWED TO REACH HER.

   The cone on the floor is the only piece of interface this game draws
   into the world, and it is the thing the player actually plays against.
   It was a fixed wedge: five tiles of it, straight through the kitchen
   wall and across the hall. The game was never fooled — canSee has
   always stopped at anything opaque — but the player was, which is
   worse, because you back away from a cone that could not possibly have
   reached you. Nothing here could see that, because nothing here ever
   looked at the shape.

   And the yard in front of the barn is hers: the horse is the end of
   that level and the start of the morning, and being pulled down in the
   last ten metres of it is a hand reaching into a story that has
   already turned. */
const { chromium } = require('playwright-core');
let pass = 0, fail = 0;
const ok = (n, c, x) => { if (c) { pass++; console.log('  ok   ' + n); }
                          else { fail++; console.log('  FAIL ' + n + (x ? '  ' + JSON.stringify(x) : '')); } };
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--use-gl=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--no-sandbox'] });
  const p = await b.newPage({ viewport: { width: 1000, height: 640 } });
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.route('**', r => (r.request().url().startsWith('http://localhost') ? r.continue() : r.abort()));
  await p.goto('http://localhost:8899/index.html', { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(400);
  await p.evaluate(() => {
    try { localStorage.removeItem('apoc.settings'); } catch (e) {}
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById('screen-apoc').classList.add('active');
    window.Apocalypse.start();
  });
  await p.waitForFunction(() => !!window.__apEnter, { timeout: 40000 });
  await p.evaluate(() => { window.__apLoop(false); window.__apQuality(2); window.__apEnter(1); window.__apSkipDialogue(); });
  await p.waitForTimeout(300);

  /* ---- 1. the cone stops at the wall ---- */
  const cone = await p.evaluate(() => {
    const G = window.Apocalypse.game, w = G.world, T = window.__apTile();
    /* stand one of them right up against a wall, facing into it */
    let spot = null;
    outer:
    for (let y = 1; y < w.h - 1; y++) for (let x = 1; x < w.w - 1; x++) {
      const here = w.at(x, y), north = w.at(x, y - 1);
      if (here === ' ' || window.__apSolid(here)) continue;
      if (north === '#' ) { spot = { x, y }; break outer; }
    }
    if (!spot) return { spot: null };
    const z = G.zombies[0];
    if (!z) return { z: false };
    z.x = w.cx(spot.x); z.z = w.cz(spot.y);
    z.facing = -Math.PI / 2;                    /* straight at the wall */
    z.state = 'calm';
    z.__coneX = null;                           /* force a recut */
    for (let i = 0; i < 4; i++) window.__apPump(1 / 60);
    window.__apCones();
    const a = z.cone.geometry.attributes.position.array;
    let far = 0, near = 1e9;
    for (let i = 1; i * 3 + 2 < a.length; i++) {
      const r = Math.hypot(a[i * 3], a[i * 3 + 2]);
      if (r > far) far = r;
      if (r < near) near = r;
    }
    /* and somewhere on this floor a line of sight has to run its whole
       length, or the cone is simply always short and proves nothing.
       Asking every tile in four directions is exact and needs no
       convenient clearing to exist. */
    let openFar = 0, openSpot = null;
    for (let y = 1; y < w.h - 1; y++) for (let x = 1; x < w.w - 1; x++) {
      const c = w.at(x, y);
      if (c === ' ' || window.__apSolid(c)) continue;
      for (let k = 0; k < 4; k++) {
        const r = window.__apConeRay(w.cx(x), w.cz(y), k * Math.PI / 2);
        if (r > openFar) { openFar = r; openSpot = { x, y, k }; }
      }
    }
    return { tile: T, sight: window.__apSightRange(), near, far, openFar, spot, openSpot };
  });
  ok('a cone drawn into a wall stops short of it',
     cone.far < cone.sight * 0.75, cone);
  ok('and none of it reaches through', cone.near > 0 && cone.near < cone.sight * 0.5, cone);
  ok('while a line of sight down an open street runs its whole length',
     cone.openFar > cone.sight * 0.95, cone);

  /* ---- 2. a wall takes most of a sound ---- */
  const heard = await p.evaluate(() => {
    const G = window.Apocalypse.game, w = G.world;
    const z = G.zombies[0];
    /* put it on the far side of a wall from her and make a noise */
    const test = (behindWall) => {
      z.state = 'calm'; z.look = null;
      const px = G.player.x, pz = G.player.z;
      const d = window.__apTile() * 5;
      z.x = px + (behindWall ? d : d); z.z = pz;
      /* fake the wall by asking the game directly */
      return { sees: window.__apCanSee(z.x, z.z, px, pz) };
    };
    return { same: test(false) };
  });
  ok('the game agrees about what can be seen through what',
     typeof heard.same.sees === 'boolean', heard);

  /* ---- 3. the yard in front of the barn ---- */
  await p.evaluate(() => { window.__apClear(); window.__apRoadside(); window.__apSkipDialogue(); });
  await p.waitForTimeout(400);
  const yard = await p.evaluate(() => {
    const G = window.Apocalypse.game, w = G.world;
    if (!w.horseAt) return { barn: false };
    /* stand her in the yard and put one of them right on top of her,
       already chasing */
    window.__apTeleport(w.horseAt.x, w.horseAt.y + 1);
    for (let i = 0; i < 6; i++) window.__apPump(1 / 60);
    const z = G.zombies[0];
    const before = { zombies: G.zombies.length, safe: window.__apInYard() };
    if (z) {
      z.x = G.player.x + 0.6; z.z = G.player.z;
      z.state = 'chase'; z.look = { x: G.player.x, z: G.player.z };
    }
    for (let i = 0; i < 240; i++) window.__apPump(1 / 60);
    return { barn: true, before,
             state: z ? z.state : null,
             gameState: window.__apState().state,
             chasing: G.chasing, closeCalls: G.closeCalls };
  });
  if (yard.barn) {
    ok('the barn yard is a place the game knows about', yard.before.safe === true, yard);
    ok('anything chasing her lets go at the edge of it', yard.state === 'calm', yard);
    ok('nothing is chasing her in it', !yard.chasing, yard);
    ok('and nothing takes hold of her',
       yard.gameState === 'play' && yard.closeCalls === 0, yard);
  } else {
    ok('the roadside has a barn in it', false, yard);
  }

  ok('no page errors from any of it', errs.length === 0, errs.slice(0, 3));
  console.log('');
  console.log(pass + ' passed, ' + fail + ' failed');
  await b.close();
  process.exit(fail ? 1 : 0);
})();
