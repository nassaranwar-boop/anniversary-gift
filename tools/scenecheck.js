/* THE THINGS YOU ONLY FIND BY PLAYING IT.

   A cut that runs off the end of its own scenery still renders, still
   ends, and throws nothing — it just shows you the edge of the world
   halfway through a conversation. A horse parked fifteen tiles off the
   side of the screen is a horse that exists. And two volume sliders
   wired to the same gain both "work". None of it is visible to a test
   that only asks whether something happened. */
const { chromium } = require('playwright-core');
let pass = 0, fail = 0;
const ok = (n, c, x) => { if (c) { pass++; console.log('  ok   ' + n); }
                          else { fail++; console.log('  FAIL ' + n + (x ? '  ' + JSON.stringify(x) : '')); } };
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--use-gl=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--no-sandbox',
           '--autoplay-policy=no-user-gesture-required'] });
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
  await p.evaluate(() => { window.__apLoop(false); window.__apQuality(2); window.__apEnter(0); });

  /* ---- 1. the road cannot run out ---- */
  const road = await p.evaluate(() => {
    window.__apClear(); window.__apDrive();
    const G = window.Apocalypse.game, c = G.cine;
    const car = c.parts && c.parts.car;
    const land = c.scene.userData.land, strip = c.scene.userData.road;
    const seen = [];
    /* drive it for twice as long as the cut lasts */
    for (let i = 0; i < 60 * 110; i++) {
      c.t += 1 / 60;
      c.update(1 / 60, c.t);
      if (i % 600 === 0 && car) {
        seen.push({ car: Math.round(car.group.position.x),
                    land: Math.round(land.position.x),
                    strip: Math.round(strip.position.x) });
      }
    }
    const x = car.group.position.x;
    return { hasLand: !!land, hasStrip: !!strip,
             carX: Math.round(x),
             /* the ground must have kept up with it, within one period */
             landGap: Math.abs(x - land.position.x),
             stripGap: Math.abs(x - strip.position.x),
             landSpan: land.userData.span, stripSpan: strip.userData.span,
             seen: seen.slice(0, 4) };
  });
  ok('the drive has ground that can be moved', road.hasLand && road.hasStrip, road);
  ok('the car goes a long way past the end of the old world', road.carX > 1400, road);
  ok('and the land is still underneath it',
     road.landGap <= road.landSpan / 2 + 1, road);
  ok('and so is the road', road.stripGap <= road.stripSpan / 2 + 1, road);

  /* the ride has to do the same, because it holds until they stop talking */
  const ride = await p.evaluate(() => {
    window.__apEndCine(); window.__apRide(true);
    const c = window.Apocalypse.game.cine;
    for (let i = 0; i < 60 * 200; i++) { c.t += 1 / 60; c.update(1 / 60, c.t); }
    const land = c.scene.userData.land;
    /* the horse is inside the cut; find it by what moved */
    return { duration: c.duration, land: !!land,
             landX: Math.round(land.position.x) };
  });
  ok('the ride holds for as long as they are talking', ride.duration === Infinity || ride.duration === null, ride);
  ok('and its land has moved with them', ride.land && Math.abs(ride.landX) > 1000, ride);

  /* ---- 2. the horse is at the camp, and she ties it up ---- */
  const camp = await p.evaluate(() => {
    window.__apEndCine(); window.__apCampsite();
    for (let i = 0; i < 30; i++) window.__apPump(1 / 60);
    const G = window.Apocalypse.game;
    const h = G.horseRig, pl = G.player;
    const near = h ? Math.hypot(h.root.position.x - pl.x, h.root.position.z - pl.z) : -1;
    const start = { near: near, tied: !!G.horseTied,
                    hx: h.root.position.x, hz: h.root.position.z };
    /* talk until she says the line, then let the walk run */
    let guard = 0;
    while (window.__apState().dialogue && guard++ < 300) {
      window.__apSay();
      if (G.anim) break;
    }
    for (let i = 0; i < 60 * 6; i++) window.__apPump(1 / 60);
    return { start: start, tied: !!G.horseTied,
             moved: Math.hypot(h.root.position.x - start.hx, h.root.position.z - start.hz) };
  });
  ok('the horse they rode in on is standing with them',
     camp.start.near > 0 && camp.start.near < 8, camp.start);
  ok('and it is not tied up yet when they get down', camp.start.tied === false, camp.start);
  /* the tree is at the western edge of the clearing, three tiles off:
     a short walk, which is the right length for it — she is tired */
  ok('she walks it to the tree during the conversation', camp.moved > 4, camp);
  ok('and it is tied when she has done it', camp.tied === true, camp);

  /* ---- 3. two sliders, two things ---- */
  const vol = await p.evaluate(async () => {
    window.__apClear(); window.__apEnter(1);
    window.__apAudio();
    await new Promise(r => setTimeout(r, 400));
    const read = () => window.__apMix();
    /* sound down, music up */
    window.__apSet('vol', 0); window.__apSet('musicVol', 0.9);
    await new Promise(r => setTimeout(r, 350));
    const quietSfx = read();
    /* and the other way round */
    window.__apSet('vol', 0.8); window.__apSet('musicVol', 0);
    await new Promise(r => setTimeout(r, 350));
    const quietMus = read();
    window.__apSet('vol', 0.8); window.__apSet('musicVol', 0.9);
    await new Promise(r => setTimeout(r, 350));
    return { quietSfx, quietMus, both: read() };
  });
  ok('turning the sound off leaves the music playing',
     vol.quietSfx.sfx < 0.02 && vol.quietSfx.mus > 0.5, vol.quietSfx);
  ok('turning the music off leaves the sound on',
     vol.quietMus.mus < 0.02 && vol.quietMus.sfx > 0.5, vol.quietMus);
  ok('and neither of them takes the master down with it',
     vol.quietSfx.master > 0.4 && vol.quietMus.master > 0.4, vol);
  ok('with both of them up, both are up',
     vol.both.sfx > 0.5 && vol.both.mus > 0.5, vol.both);

  /* ---- 4. she is in her own scene ----
     The model of her is only moved onto p.x/p.z by the player update,
     and that does not run while a conversation is on screen — so at the
     camp she stood at the origin of the grid for the whole of the
     arrival, which is the far corner of the clearing. */
  const her = await p.evaluate(() => {
    window.__apEndCine(); window.__apClear(); window.__apCampsite();
    for (let i = 0; i < 12; i++) window.__apPump(1 / 60);
    const G = window.Apocalypse.game, r = G.player.rig.root.position;
    return { dlg: G.state === 'dialogue',
             gap: Math.hypot(r.x - G.player.x, r.z - G.player.z),
             rig: [+r.x.toFixed(2), +r.z.toFixed(2)] };
  });
  ok('the camp opens in a conversation', her.dlg, her);
  ok('and she is standing where she is, not at the origin of the map',
     her.gap < 0.05, her);

  /* ---- 5. the roads go somewhere ----
     A road that stops at the edge of the grid is a road nobody drove
     down. Both of these levels are entered off one. */
  for (const lv of ['roadside', 'gates']) {
    const road = await p.evaluate(name => {
      window.__apEndCine(); window.__apClear();
      if (name === 'roadside') window.__apRoadside(); else window.__apEnter(4);
      const G = window.Apocalypse.game, w = G.world;
      let tiles = 0, edge = 0;
      for (let y = 0; y < w.h; y++) for (let x = 0; x < w.w; x++) {
        if (w.at(x, y) !== '-') continue;
        tiles++;
        if (x === 0 || y === 0 || x === w.w - 1 || y === w.h - 1) edge++;
      }
      /* and the carriageway has to reach the tile she starts on */
      const sp = w.spawn;
      let near = false;
      for (let j = -2; j <= 2 && !near; j++) for (let i = -2; i <= 2; i++) {
        if (w.at(sp.x + i, sp.y + j) === '-') { near = true; break; }
      }
      return { tiles, edge, near, approach: (G.def.approach || []).length,
               storeys: G.def.rise || 0 };
    }, lv);
    ok(lv + ': there is a carriageway', road.tiles > 30, road);
    ok(lv + ': it runs off the edge of the map', road.edge >= 3, road);
    ok(lv + ': and carries on past it', road.approach >= 1, road);
    ok(lv + ': she arrives on it', road.near, road);
    ok(lv + ': nothing out here is a block of flats', road.storeys === 1, road);
  }

  /* ---- 6. the roof: both beats, and a hug that closes ----
     Two whenLine hooks on one conversation used to cancel each other
     out, so the first one to fire deleted the second and the hug never
     happened. */
  const roof = await p.evaluate(() => {
    window.__apEndCine(); window.__apClear(); window.__apRoof();
    const G = window.Apocalypse.game;
    const bones = {};
    const grab = () => {
      const s = G.cine.scene; s.updateMatrixWorld(true);
      const out = {};
      s.traverse(o => {
        if (!o.isBone) return;
        if (o.name === 'head') (out.heads = out.heads || []).push(+o.matrixWorld.elements[12].toFixed(3));
        if (o.name === 'handL') (out.hands = out.hands || []).push(o.matrixWorld.elements.slice(12, 15).map(v => +v.toFixed(3)));
      });
      return out;
    };
    const before = grab();
    let k = 0, held = false;
    while (G.dlg && k++ < 400) {
      const cur = G.dlg.lines[G.dlg.i - 1];
      if (cur && cur[1] === 'He reaches over and takes her hand, and that is where it stays.') held = true;
      if (cur && cur[1] === 'Come here.') break;
      window.__apSay();
    }
    const atCue = grab();
    for (let i = 0; i < 60 * 4; i++) window.__apPump(1 / 60);
    const after = grab();
    return { held, before, atCue, after };
  });
  const gapOf = h => Math.abs(h.heads[0] - h.heads[1]);
  ok('the roof plays the hand-holding beat too', roof.held, roof.held);
  ok('they are apart before he says it', gapOf(roof.before) > 1.1, roof.before);
  ok('and together after', gapOf(roof.after) < 0.75, roof.after);
  /* his hand ends up on her, not out over the roof behind him */
  ok('his arm goes round her rather than backwards',
     roof.after.hands.some(h => h[0] > 0.05 && h[1] > 1.15), roof.after.hands);

  /* ---- 7. no two scenes running sound the same ----
     The ride out, the sunrise and the ride in the morning were one cue
     played three times, with a level in between each — which is where a
     player stops hearing music and starts hearing a loop. */
  const heard = await p.evaluate(async () => {
    const seen = [];
    const note = name => seen.push([name, window.__apScoreWant()]);
    window.__apEndCine(); window.__apClear();
    window.__apRoadside(); note('the lane');
    window.__apEndCine(); window.__apRide(false); note('the ride out');
    window.__apEndCine(); window.__apCampsite(); note('the clearing');
    window.__apEndCine(); window.__apCampfire(); note('the fire');
    window.__apEndCine(); window.__apCut('sunrise'); note('the sunrise');
    window.__apEndCine(); window.__apRide(true); note('the coast road');
    window.__apEndCine(); window.__apClear(); window.__apEnter(4); note('the gate');
    window.__apEndCine(); window.__apRoof(); note('the roof');
    return seen;
  });
  const runs = heard.filter((h, i) => i && h[1] === heard[i - 1][1]);
  ok('every scene down off the road has its own music', runs.length === 0, heard);
  ok('and eight of them are eight different pieces',
     new Set(heard.map(h => h[1])).size === heard.length, heard);

  ok('no page errors from any of it', errs.length === 0, errs.slice(0, 3));
  console.log('');
  console.log(pass + ' passed, ' + fail + ' failed');
  await b.close();
  process.exit(fail ? 1 : 0);
})();
