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

  ok('no page errors from any of it', errs.length === 0, errs.slice(0, 3));
  console.log('');
  console.log(pass + ' passed, ' + fail + ' failed');
  await b.close();
  process.exit(fail ? 1 : 0);
})();
