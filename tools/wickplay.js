/* Wick & Cogs, played the way a person plays it: click through the
   title, look at what is on the canvas, drive the shift with the
   __wick hooks, and assert the loop actually resolves.

   requestAnimationFrame runs at about 3fps in this container, so the
   shift is advanced with __wick.pump rather than by waiting — but the
   clicking, the screens and the canvas are all real. */
const { chromium } = require('playwright-core');
const fs = require('fs');
const OUT = process.argv[2] || '/tmp/wk';
let fails = 0, checks = 0;
/* Clicks go through the DOM rather than through page.click. The page
   never fires `load` here — the harness aborts every non-localhost
   request, Google Fonts included — and playwright's post-click
   "waiting for scheduled navigations" then sits there until it times
   out. That is the harness, not the site. */
async function tap(page, sel) {
  const hit = await page.evaluate((s) => {
    const els = Array.from(document.querySelectorAll(s.q));
    const el = s.text ? els.find((e) => (e.textContent || '').indexOf(s.text) >= 0) : els[0];
    if (!el) return false;
    /* pointerdown first: the office's own buttons answer to that, the
       way a thumb does */
    try { el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true })); }
    catch (e) { el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })); }
    el.click();
    return true;
  }, sel);
  if (!hit) { fails++; console.log('  FAIL could not tap ' + JSON.stringify(sel)); }
  return hit;
}

function ok(name, cond, extra) {
  checks++;
  if (!cond) { fails++; console.log('  FAIL ' + name + (extra ? '  ' + extra : '')); }
  else console.log('  ok   ' + name + (extra ? '  ' + extra : ''));
}

(async () => {
  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox', '--no-proxy-server', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 860 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', e => { errors.push(e.message); console.log('PAGEERROR', e.message); });
  page.on('console', m => { if (m.type() === 'error') console.log('CONSOLE', m.text()); });
  /* book-scene.js never loads in this run. It is the 3D opening — ACES,
     PMREM, bloom, bokeh, light shafts — and on a software rasteriser it
     takes the main thread and does not give it back, so every step
     below times out behind it before it can even be told to stop. It is
     not what this suite is testing; regress.js covers it. */
  await page.route('**/*', r => {
    const u = r.request().url();
    if (u.indexOf('book-scene.js') >= 0) return r.abort();
    return u.startsWith('http://127.0.0.1') ? r.continue() : r.abort();
  });
  await page.goto('http://127.0.0.1:8899/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(700);

  /* The site's screen-entry animation is a 0.65s keyframe, and under
     swiftshader the main thread is busy enough that it does not finish
     inside playwright's actionability check — the chapter is fine, the
     harness is not. Turn it off for the run. */
  await page.evaluate(() => {
    const st = document.createElement('style');
    st.textContent = '.screen.anim-in{animation:none !important}';
    document.head.appendChild(st);
  });
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} showScreen('hub'); if (window.startHub) startHub(); });
  await page.waitForTimeout(400);

  console.log('\n— getting in —');
  ok('hub card exists', await page.locator('#hub-card-wick').count() === 1);
  await tap(page, { q: '#hub-card-wick' });
  await page.waitForTimeout(2600);
  ok('screen is active', await page.locator('#screen-wick.active').count() === 1);
  ok('title card is up', await page.locator('.wk-ov-title').count() === 1);
  await page.evaluate(() => WickAndCogs.__wick.silence(true));

  const shot = async (name) => {
    const d = await page.evaluate(() => {
      WickAndCogs.__wick.render();
      return document.getElementById('wick-canvas').toDataURL('image/png');
    });
    fs.writeFileSync(OUT + '-' + name + '.png', Buffer.from(d.split(',')[1], 'base64'));
  };
  await shot('title');

  console.log('\n— how it works —');
  await tap(page, { q: '.wk-btn', text: 'HOW IT WORKS' });
  await page.waitForTimeout(300);
  ok('rules listed', await page.locator('.wk-rules li').count() === 6);
  ok('cast listed', await page.locator('.wk-cast li').count() === 4);
  await tap(page, { q: '.wk-btn', text: 'BACK' });
  await page.waitForTimeout(250);

  console.log('\n— night one —');
  await tap(page, { q: '.wk-btn', text: 'BEGIN THE SHIFT' });
  await page.waitForTimeout(300);
  ok('brief shows the voicemail', (await page.locator('.wk-from').textContent()).indexOf('voicemail') >= 0);
  await tap(page, { q: '.wk-btn', text: '12:00 AM' });
  await page.waitForTimeout(600);
  let st = await page.evaluate(() => WickAndCogs.__wick.state().phase);
  ok('shift running', st === 'play', st);
  ok('HUD visible', await page.locator('#wk-hud:not([hidden])').count() === 1);
  ok('pad visible', await page.locator('#wk-pad:not([hidden])').count() === 1);
  await shot('office');

  console.log('\n— the doors and the meter —');
  await tap(page, { q: '#wk-pad [data-k="left"]' });
  await page.waitForTimeout(120);
  let g = await page.evaluate(() => { const s = WickAndCogs.__wick.state(); return { l: s.doors.left, p: s.power }; });
  ok('left door shuts', g.l === true);
  const drainShut = await page.evaluate(() => { const w = WickAndCogs.__wick; const a = w.state().power; w.pump(10); return a - w.state().power; });
  await tap(page, { q: '#wk-pad [data-k="left"]' });
  const drainOpen = await page.evaluate(() => { const w = WickAndCogs.__wick; const a = w.state().power; w.pump(10); return a - w.state().power; });
  ok('a shut door costs more', drainShut > drainOpen * 2.5, drainShut.toFixed(1) + ' vs ' + drainOpen.toFixed(1));

  await tap(page, { q: '#wk-pad [data-k="monitor"]' });
  await page.waitForTimeout(200);
  ok('monitor up', await page.evaluate(() => WickAndCogs.__wick.state().monitor) === true);
  ok('monitor covers the view', await page.locator('#wk-mon:not([hidden])').count() === 1);
  ok('map has a cell per camera', await page.locator('.wk-cell').count() === 8);
  await shot('monitor');
  const camDrain = await page.evaluate(() => { const w = WickAndCogs.__wick; const a = w.state().power; w.pump(10); return a - w.state().power; });
  ok('the monitor costs power', camDrain > drainOpen * 2.5, camDrain.toFixed(1));

  console.log('\n— every camera renders —');
  const cams = await page.evaluate(() => Object.keys(WickAndCogs.__wick.rooms()).filter(r => r !== 'office'));
  for (const c of cams) {
    await page.evaluate((id) => WickAndCogs.__wick.cam(id), c);
    await page.waitForTimeout(420);
    const lit = await page.evaluate(() => {
      /* draw first: the context does not preserve its drawing buffer, so
         reading it in a later task gets a cleared canvas every time */
      WickAndCogs.__wick.render();
      const cv = document.getElementById('wick-canvas');
      const t = document.createElement('canvas'); t.width = 96; t.height = 54;
      t.getContext('2d').drawImage(cv, 0, 0, 96, 54);
      const d = t.getContext('2d').getImageData(0, 0, 96, 54).data;
      let sum = 0, n = 0;
      for (let i = 0; i < d.length; i += 4) { sum += (d[i] + d[i + 1] + d[i + 2]) / 3; n++; }
      return sum / n;
    });
    ok('cam ' + c + ' has a picture', lit > 8, 'mean=' + lit.toFixed(1));
    await shot('cam-' + c);
  }
  await tap(page, { q: '#wk-pad [data-k="monitor"]' });
  await page.waitForTimeout(200);

  console.log('\n— Cogsworth, end to end —');
  await page.evaluate(() => {
    const w = WickAndCogs.__wick;
    w.state().power = 100; w.state().doors.left = false;
    w.only('cogsworth');
  });
  let atDoor = await page.evaluate(() => WickAndCogs.__wick.cast().cogsworth.atDoor);
  ok('he reaches the door', atDoor === true);
  const window1 = await page.evaluate(() => WickAndCogs.__wick.cast().cogsworth.doorT);
  ok('there is a reaction window', window1 > 2.5, window1.toFixed(1) + 's');
  const died = await page.evaluate(() => { const w = WickAndCogs.__wick; w.pump(8); return w.state(); });
  ok('an open door is fatal', died.phase === 'over' && died.dead === 'cogsworth', died.phase + '/' + died.dead);
  /* the card is held back until the scare has landed */
  await page.waitForTimeout(2200);
  ok('game over card names him', (await page.locator('.wk-got').textContent()).indexOf('COGSWORTH') >= 0);
  await shot('gameover');

  console.log('\n— and a shut door sends him away —');
  await tap(page, { q: '.wk-btn', text: 'TRY THE NIGHT AGAIN' });
  await page.waitForTimeout(500);
  const survived = await page.evaluate(() => {
    const w = WickAndCogs.__wick;
    w.only('cogsworth');
    w.press('left');                      // shut it
    w.pump(8);
    return { phase: w.state().phase, step: w.cast().cogsworth.step, atDoor: w.cast().cogsworth.atDoor };
  });
  ok('he retreats', survived.phase === 'play' && survived.atDoor === false, JSON.stringify(survived));

  console.log('\n— Marabelle freezes when watched —');
  const mara = await page.evaluate(() => {
    const w = WickAndCogs.__wick, s = w.state();
    w.only('marabelle', 0);
    s.doors.left = false; s.doors.right = false;
    const m = w.cast().marabelle;
    m.cool = 0;
    s.monitor = true; s.cam = m.room;      // stare at her
    w.pump(60);
    const watched = m.step;
    s.monitor = false;
    m.cool = 0;
    w.pump(60);
    return { watched, unwatched: m.step };
  });
  ok('she cannot move while watched', mara.watched === 0, 'watched step=' + mara.watched);
  ok('she moves when you look away', mara.unwatched > 0, 'unwatched step=' + mara.unwatched);

  console.log('\n— Chime ignores the doors —');
  const chime = await page.evaluate(() => {
    const w = WickAndCogs.__wick, s = w.state();
    /* the owl is asleep on night one by design, so this is night two */
    w.route('night:2'); w.route('go');
    w.only('chime');
    s.doors.left = true; s.doors.right = true; s.doors.hatch = false;
    w.pump(9);
    return { phase: s.phase, dead: s.dead };
  });
  ok('shut doors do not stop the owl', chime.dead === 'chime', JSON.stringify(chime));
  const chimeHatch = await page.evaluate(() => {
    const w = WickAndCogs.__wick, s = w.state();
    w.route('night:2'); w.route('go');
    w.only('chime');
    s.doors.hatch = true;
    w.pump(9);
    return { phase: s.phase, atDoor: w.cast().chime.atDoor };
  });
  ok('the hatch does stop it', chimeHatch.phase === 'play' && !chimeHatch.atDoor, JSON.stringify(chimeHatch));

  console.log('\n— Jax bleeds a turtle dry —');
  const jax = await page.evaluate(() => {
    const w = WickAndCogs.__wick, s = w.state();
    const shutFor = (withJax) => {
      w.route('night:2'); w.route('go');
      w.only(withJax ? 'jax' : 'cogsworth', withJax ? undefined : 0);
      if (!withJax) w.cast().cogsworth.asleep = true;
      s.power = 100; s.blackout = false;
      s.doors.left = true; s.doors.right = true; s.doors.hatch = true;
      w.pump(14);
      return 100 - s.power;
    };
    const quiet = shutFor(false);
    const loud = shutFor(true);
    return { quiet, loud };
  });
  ok('Jax at a shut door costs far more than the door does',
     jax.loud > jax.quiet * 1.4,
     jax.loud.toFixed(1) + '% vs ' + jax.quiet.toFixed(1) + '% over 14s');

  console.log('\n— the blackout, and six o clock —');
  const black = await page.evaluate(() => {
    const w = WickAndCogs.__wick, s = w.state();
    w.route('night:2'); w.route('go');
    w.only('jax', 0);
    s.doors.left = true; s.doors.right = true;
    s.power = 0.4; s.hour = 2; s.hourT = 0;
    w.pump(2);
    return { blackout: s.blackout, doors: JSON.stringify(s.doors), monitor: s.monitor };
  });
  ok('power out kills the doors', black.blackout === true && black.doors.indexOf('true') < 0, JSON.stringify(black));
  const dark = await page.evaluate(() => { const w = WickAndCogs.__wick; w.pump(70); return w.state(); });
  ok('the dark eventually gets you', dark.phase === 'over', dark.phase + '/' + dark.dead);
  await page.waitForTimeout(300);
  await shot('blackout');

  console.log('\n— the budget —');
  const idle = await page.evaluate(() => {
    const w = WickAndCogs.__wick;
    w.route('night:1'); w.route('go');
    const s = w.state();
    Object.keys(w.cast()).forEach(k => { w.cast()[k].asleep = true; });
    w.pump(340, 0.5);
    return { phase: s.phase, power: s.power, hour: s.hour };
  });
  ok('doing nothing at all gets you to six', idle.phase === 'shift', JSON.stringify(idle));

  console.log('\n— a whole night, played carefully —');
  const win = await page.evaluate(() => {
    const w = WickAndCogs.__wick;
    w.route('night:1'); w.route('go');
    const s = w.state();
    /* an attentive guard: a look at the cameras every twenty seconds,
       and a door only when something is actually at it */
    let t = 0, doorSec = 0, camSec = 0, visits = 0, wasDoor = false;
    while (s.phase === 'play' && t < 420) {
      const cs = w.cast();
      ['left', 'right', 'hatch'].forEach((d) => {
        let want = false;
        for (const k in cs) if (cs[k].awake && cs[k].atDoor && cs[k].def.door === d) want = true;
        if (want !== s.doors[d]) w.press(d);
      });
      s.monitor = (t % 20) < 4;
      if (s.monitor) camSec += 0.5;
      const shut = (s.doors.left ? 1 : 0) + (s.doors.right ? 1 : 0) + (s.doors.hatch ? 1 : 0);
      doorSec += shut * 0.5;
      const anyDoor = Object.keys(cs).some((k) => cs[k].awake && cs[k].atDoor);
      if (anyDoor && !wasDoor) visits++;
      wasDoor = anyDoor;
      w.pump(0.5, 0.25);
      t += 0.5;
    }
    return { phase: s.phase, hour: s.hour, power: Math.round(s.power * 10) / 10, dead: s.dead, t,
             doorSec, camSec, visits };
  });
  ok('an attentive guard survives night one', win.phase === 'shift', JSON.stringify(win));
  ok('and with power in hand', win.power > 12, win.power.toFixed(1) + '%');
  await page.waitForTimeout(400);
  await shot('shiftdone');

  console.log('\n— nights 2 and 3 exist and are harder —');
  const nights = await page.evaluate(() => {
    const w = WickAndCogs.__wick;
    const out = [];
    [2, 3].forEach((n) => {
      w.route('night:' + n); w.route('go');
      const s = w.state();
      out.push({ n: s.night, awake: Object.keys(s.cfg.active).length, haz: s.cfg.hazards.length, ramp: s.cfg.ramp[5] });
    });
    return out;
  });
  ok('night 2 wakes more of them', nights[0].awake === 4, JSON.stringify(nights[0]));
  ok('night 3 is the fastest', nights[1].ramp > nights[0].ramp, JSON.stringify(nights[1]));

  console.log('\n— the way out —');
  await page.evaluate(() => { const w = WickAndCogs.__wick; w.route('title'); });
  await page.waitForTimeout(300);
  await tap(page, { q: '.wk-btn', text: 'LEAVE' });
  await page.waitForTimeout(1200);
  ok('back at the hub', await page.locator('#screen-hub.active').count() === 1);

  ok('no page errors', errors.length === 0, errors.join(' | '));
  console.log('\n' + (fails ? 'FAILED ' + fails + ' of ' + checks : 'all ' + checks + ' checks passed'));
  await browser.close();
  process.exit(fails ? 1 : 0);
})();
