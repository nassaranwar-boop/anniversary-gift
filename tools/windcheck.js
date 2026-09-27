/* THE ONE CONTROL SHE USES TO BE KIND TO SOMETHING, AND IT DID NOT WORK.

   His report, and it is four separate faults: the hold is lost when the
   toy walks out from under her thumb; the key vanishes above 55% of a
   wind with nothing to say why; a stale target arms the button so the
   press does nothing at all; and with two of them in one room only the
   first in cast order can ever be wound.

   This drives the real element with real pointer events on a real wall
   clock, because every one of those is an input bug and an input bug is
   invisible to anything that calls windStart() directly.
                                              node tools/windcheck.js */
const { chromium } = require('playwright-core');
let pass = 0, fail = 0;
const ok = (n, c, x) => { if (c) { pass++; console.log('  ok   ' + n); }
  else { fail++; console.log('  FAIL ' + n + (x !== undefined ? '  ' + JSON.stringify(x) : '')); } };

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox', '--no-proxy-server', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 1000, height: 700 } });
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.route('**/*', (r) => { const u = r.request().url();
    if (u.indexOf('book-scene.js') >= 0) return r.abort();
    return u.startsWith('http://127.0.0.1') ? r.continue() : r.abort(); });
  await p.goto('http://127.0.0.1:8899/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.evaluate(() => { try { localStorage.clear(); } catch (e) {}
    localStorage.setItem('ns_seenintro', '1'); localStorage.setItem('ns_notutor', '1');
    showScreen('nightshift');
    return loadChapter('nightshift').then(() => OuissysNightShift.start()); });
  await p.waitForFunction(() => { try { return !!OuissysNightShift.__night.cast().jax; }
                                  catch (e) { return false; } }, null, { timeout: 30000, polling: 200 });
  await p.evaluate(() => OuissysNightShift.__night.silence(true));

  /* stand a night up with one of them parked in a room she is watching */
  /* `room` is not a field anybody may set: putChar derives it from the
     route step, so a harness that assigns it has it overwritten by the
     first sync. Steps, and the chapter's own camera call. */
  const setup = (who, step, wound, extra) => p.evaluate(([who, step, wound, extra]) => {
    const N = OuissysNightShift.__night, G = N.state(), cast = N.cast();
    N.begin(1); N.midEnd();
    Object.keys(cast).forEach((k) => { cast[k].awake = false; cast[k].asleep = true; });
    const put = (id, st, w) => { const c = cast[id];
      c.asleep = false; c.awake = true; c.cool = 9999; c.step = st; c.wound = w;
      N.syncOne(id); c.atDoor = false; return c; };
    const ch = put(who, step, wound);
    if (extra) put(extra.who, extra.step, extra.wound);
    G.hour = 2; G.power = 90; G.monOut = 0;
    N.camTo(ch.room);
    N.pumpFrame(0.05);
    return { room: ch.room, cam: G.cam };
  }, [who, step, wound, extra || null]);

  const key = p.locator('#ns-key');
  /* the frame loop is what positions and ticks it, and the harness has
     to keep it turning while the pointer is down */
  const spin = async (ms) => {
    const end = Date.now() + ms;
    while (Date.now() < end) { await p.evaluate(() => OuissysNightShift.__night.pumpFrame(0.05)); }
  };
  const box = async () => { const r = await key.boundingBox(); return r; };

  console.log('\n=== the key is there when one of his is');
  await setup('cogsworth', 0, 3);
  await p.evaluate(() => OuissysNightShift.__night.pumpFrame(0.05));
  ok('a half-wound one in the room she is watching has a key on it',
     !(await key.isHidden()), await p.evaluate(() => OuissysNightShift.__night.wind().target));

  /* THE ONE THAT MADE IT LOOK BROKEN */
  await setup('cogsworth', 0, 8.9);
  await p.evaluate(() => OuissysNightShift.__night.pumpFrame(0.05));
  const fullShown = !(await key.isHidden());
  const fullClass = await key.evaluate((el) => el.className);
  ok('and a fully wound one still has one, rather than nothing at all',
     fullShown && /full/.test(fullClass), { fullShown, fullClass });
  ok('and it says so on the label',
     /FULL/.test(await key.innerText()), await key.innerText());

  /* TWO IN A ROOM */
  await setup('marabelle', 0, 8.0, { who: 'jax', step: 3, wound: 1.0 });
  await p.evaluate(() => OuissysNightShift.__night.pumpFrame(0.05));
  ok('with two of them in one room it offers the one that needs it',
     (await p.evaluate(() => OuissysNightShift.__night.wind().target)) === 'jax',
     await p.evaluate(() => OuissysNightShift.__night.wind()));

  console.log('\n=== and holding it really winds it');
  await setup('cogsworth', 0, 1.0);
  await p.evaluate(() => OuissysNightShift.__night.pumpFrame(0.05));
  let r = await box();
  await p.mouse.move(r.x + r.width / 2, r.y + r.height / 2);
  await p.mouse.down();
  await spin(1500);
  await p.mouse.up();
  const after = await p.evaluate(() => OuissysNightShift.__night.wind());
  ok('a second and a bit of holding fills it', after.wound.cogsworth > 8, after.wound);
  ok('and the hold is let go of afterwards', !after.holding, after.holding);

  /* THE MAIN BUG: the button is positioned from a walking toy */
  console.log('\n=== and it survives the thing walking while she holds it');
  await setup('cogsworth', 0, 1.0);
  await p.evaluate(() => OuissysNightShift.__night.pumpFrame(0.05));
  r = await box();
  await p.mouse.move(r.x + r.width / 2, r.y + r.height / 2);
  await p.mouse.down();
  /* move it across the room under her thumb, the way a route step does */
  await p.evaluate(() => {
    const N = OuissysNightShift.__night, ch = N.cast().cogsworth;
    ch.step = 1; N.syncOne('cogsworth');
    ch.group.position.x += 1.4; ch.group.updateMatrixWorld(true);
  });
  await spin(1500);
  await p.mouse.up();
  const moved = await p.evaluate(() => OuissysNightShift.__night.wind());
  ok('the toy takes a step mid-hold and the wind still lands',
     moved.wound.cogsworth > 8, moved.wound);

  console.log('\n=== and the shop says when one has run out');
  const ran = await p.evaluate(() => {
    const N = OuissysNightShift.__night, G = N.state(), cast = N.cast();
    N.begin(1); N.midEnd();
    Object.keys(cast).forEach((k) => { cast[k].awake = false; cast[k].asleep = true; });
    const ch = cast.jax;
    ch.asleep = false; ch.awake = true; ch.cool = 9999; ch.wound = 0.02;
    G.hour = 3; G.power = 90;
    /* three in the morning on night one is inside a revelation's
       window, and a card stops the pump dead -- which is why the first
       version of this measured one frame of decay and reported the
       announcement as missing */
    for (let i = 0; i < 80; i++) {
      N.pumpFrame(0.1);
      if (N.state().phase === 'reveal') N.route('keep');
      if (N.state().phase === 'found') N.route('findOut');
    }
    return { wound: +cast.jax.wound.toFixed(3), said: !!cast.jax.slackSaid,
             slack: N.state().stats.slack };
  });
  ok('one that runs all the way down is announced, once',
     ran.wound === 0 && ran.said && ran.slack === 1, ran);

  ok('no page errors anywhere in that', errs.length === 0, errs.slice(0, 2));
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  await b.close(); process.exit(fail ? 1 : 0);
})();
