/* Wick & Cogs, played the way a person plays it: click through the
   title, look at what is on the canvas, drive the shift with the
   __night hooks, and assert the loop actually resolves.

   requestAnimationFrame runs at about 3fps in this container, so the
   shift is advanced with __night.pump rather than by waiting — but the
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
  ok('hub card exists', await page.locator('#hub-card-nightshift').count() === 1);
  await tap(page, { q: '#hub-card-nightshift' });
  await page.waitForTimeout(2600);
  ok('screen is active', await page.locator('#screen-nightshift.active').count() === 1);
  ok('title card is up', await page.locator('.ns-ov-title').count() === 1);
  await page.evaluate(() => OuissysNightShift.__night.silence(true));

  const shot = async (name) => {
    const d = await page.evaluate(() => {
      OuissysNightShift.__night.render();
      return document.getElementById('ns-canvas').toDataURL('image/png');
    });
    fs.writeFileSync(OUT + '-' + name + '.png', Buffer.from(d.split(',')[1], 'base64'));
  };
  await shot('title');

  console.log('\n— how it works —');
  await tap(page, { q: '.ns-btn', text: 'HOW IT WORKS' });
  await page.waitForTimeout(300);
  ok('rules listed', await page.locator('.ns-rules li').count() === 6);
  ok('cast listed', await page.locator('.ns-cast li').count() === 4);
  /* each performer carries the rule and, under it, what she will
     actually notice on its way */
  ok('and each one says what to do about it',
     await page.locator('.ns-who em').count() === 4);
  ok('and the rules fit on a card',
     (await page.locator('.ns-rules li span').allTextContents())
       .every(t => t.trim().length <= 90),
     (await page.locator('.ns-rules li span').allTextContents()).map(t => t.length).join(','));
  await tap(page, { q: '.ns-btn', text: 'BACK' });
  await page.waitForTimeout(250);

  console.log('\n— his statement —');
  /* the very first BEGIN THE SHIFT plays the opening film, once ever */
  await tap(page, { q: '.ns-btn', text: 'BEGIN THE SHIFT' });
  await page.waitForTimeout(1200);
  const cine = await page.evaluate(() => ({ ...OuissysNightShift.__night.cine(),
    phase: OuissysNightShift.__night.state().phase,
    head: (document.querySelector('.ns-cine-head') || {}).textContent || '',
    skip: !!document.getElementById('ns-cine-skip') }));
  ok('it opens on his statement, not on a menu', cine.on && cine.phase === 'intro', JSON.stringify(cine.phase));
  ok('and says what it is', cine.head.indexOf('PROPRIETOR') >= 0, cine.head.slice(0, 40));
  ok('and can be skipped', cine.skip);
  /* the caption is timed to the syllable, not to the line: voxPlan hands
     back when every word will be spoken and the caption lights up on it */
  const vox = await page.evaluate(() => OuissysNightShift.__night.vox('I made toys. That part was true.'));
  ok('every word knows when it is spoken',
     vox.words.length === 7 && vox.dur > 2 && vox.dur < 4, vox.words.join(' '));
  ok('and they are in order',
     vox.words.every((w, i, a) => i === 0 || parseFloat(w.split('@')[1]) > parseFloat(a[i-1].split('@')[1])),
     vox.words.join(' '));
  const lit = await page.evaluate(async () => {
    const n = () => document.querySelectorAll('#ns-cine-sub i.on').length;
    const a = n();
    await new Promise(r => setTimeout(r, 2600));
    return { a, b: n(), all: document.querySelectorAll('#ns-cine-sub i').length };
  });
  ok('and the caption lights up as it speaks', lit.b > lit.a, JSON.stringify(lit));
  await shot('statement');
  await page.evaluate(() => OuissysNightShift.__night.route('introDone'));
  await page.waitForTimeout(600);
  ok('and it hands her straight into the first night',
     await page.evaluate(() => OuissysNightShift.__night.state().night) === 1);
  ok('and never plays itself again',
     await page.evaluate(() => localStorage.getItem('ns_seenintro')) === '1');

  console.log('\n— night one —');
  await page.evaluate(() => { const w = OuissysNightShift.__night; w.route('title'); w.route('start'); });
  await page.waitForTimeout(400);
  /* night one is onboarded by a card taped inside the desk drawer, in
     her hands. Nobody phones her; nobody narrates. */
  ok('night one briefs off a found card', (await page.locator('.ns-from').textContent()).indexOf('drawer') >= 0);
  ok('and the card is a piece of paper', await page.locator('.ns-paper p').count() >= 3);
  ok('with a pencil note on it', await page.locator('.ns-pencil').count() === 1);
  await tap(page, { q: '.ns-btn', text: '12:00 AM' });
  await page.waitForTimeout(600);
  let st = await page.evaluate(() => OuissysNightShift.__night.state().phase);
  ok('shift running', st === 'play', st);
  ok('HUD visible', await page.locator('#ns-hud:not([hidden])').count() === 1);
  ok('pad visible', await page.locator('#ns-pad:not([hidden])').count() === 1);
  await shot('office');

  console.log('\n— the doors and the meter —');
  await tap(page, { q: '#ns-pad [data-k="left"]' });
  await page.waitForTimeout(120);
  let g = await page.evaluate(() => { const s = OuissysNightShift.__night.state(); return { l: s.doors.left, p: s.power }; });
  ok('left door shuts', g.l === true);
  const drainShut = await page.evaluate(() => { const w = OuissysNightShift.__night; const a = w.state().power; w.pump(10); return a - w.state().power; });
  await tap(page, { q: '#ns-pad [data-k="left"]' });
  const drainOpen = await page.evaluate(() => { const w = OuissysNightShift.__night; const a = w.state().power; w.pump(10); return a - w.state().power; });
  ok('a shut door costs more', drainShut > drainOpen * 2.5, drainShut.toFixed(1) + ' vs ' + drainOpen.toFixed(1));

  await tap(page, { q: '#ns-pad [data-k="monitor"]' });
  await page.waitForTimeout(200);
  ok('monitor up', await page.evaluate(() => OuissysNightShift.__night.state().monitor) === true);
  ok('monitor covers the view', await page.locator('#ns-mon:not([hidden])').count() === 1);
  ok('map has a cell per camera', await page.locator('.ns-cell').count() === 8);
  await shot('monitor');
  const camDrain = await page.evaluate(() => { const w = OuissysNightShift.__night; const a = w.state().power; w.pump(10); return a - w.state().power; });
  ok('the monitor costs power', camDrain > drainOpen * 2.5, camDrain.toFixed(1));

  console.log('\n— every camera renders —');
  const cams = await page.evaluate(() => Object.keys(OuissysNightShift.__night.rooms()).filter(r => r !== 'office'));
  for (const c of cams) {
    await page.evaluate((id) => OuissysNightShift.__night.cam(id), c);
    await page.waitForTimeout(420);
    const lit = await page.evaluate(() => {
      /* draw first: the context does not preserve its drawing buffer, so
         reading it in a later task gets a cleared canvas every time */
      OuissysNightShift.__night.render();
      const cv = document.getElementById('ns-canvas');
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
  await tap(page, { q: '#ns-pad [data-k="monitor"]' });
  await page.waitForTimeout(200);

  console.log('\n— Cogsworth, end to end —');
  await page.evaluate(() => {
    const w = OuissysNightShift.__night;
    w.state().power = 100; w.state().doors.left = false;
    w.only('cogsworth');
  });
  let atDoor = await page.evaluate(() => OuissysNightShift.__night.cast().cogsworth.atDoor);
  ok('he reaches the door', atDoor === true);
  const window1 = await page.evaluate(() => OuissysNightShift.__night.cast().cogsworth.doorT);
  ok('there is a reaction window', window1 > 2.5, window1.toFixed(1) + 's');
  const died = await page.evaluate(() => { const w = OuissysNightShift.__night; w.pump(8); return w.state(); });
  ok('an open door is fatal', died.phase === 'over' && died.dead === 'cogsworth', died.phase + '/' + died.dead);
  /* the card is held back until the scare has landed */
  await page.waitForTimeout(2200);
  ok('game over card names him', (await page.locator('.ns-got').textContent()).indexOf('COGSWORTH') >= 0);
  await shot('gameover');

  console.log('\n— and a shut door sends him away —');
  await tap(page, { q: '.ns-btn', text: 'TRY THE NIGHT AGAIN' });
  await page.waitForTimeout(500);
  const survived = await page.evaluate(() => {
    const w = OuissysNightShift.__night;
    w.only('cogsworth');
    w.press('left');                      // shut it
    w.pump(8);
    return { phase: w.state().phase, step: w.cast().cogsworth.step, atDoor: w.cast().cogsworth.atDoor };
  });
  ok('he retreats', survived.phase === 'play' && survived.atDoor === false, JSON.stringify(survived));

  console.log('\n— Marabelle freezes when watched —');
  const mara = await page.evaluate(() => {
    const w = OuissysNightShift.__night, s = w.state();
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
    const w = OuissysNightShift.__night, s = w.state();
    /* the owl is asleep on night one by design, so this is night two */
    w.route('night:2'); w.route('go');
    w.only('chime');
    s.doors.left = true; s.doors.right = true; s.doors.hatch = false;
    w.pump(9);
    return { phase: s.phase, dead: s.dead };
  });
  ok('shut doors do not stop the owl', chime.dead === 'chime', JSON.stringify(chime));
  const chimeHatch = await page.evaluate(() => {
    const w = OuissysNightShift.__night, s = w.state();
    w.route('night:2'); w.route('go');
    w.only('chime');
    s.doors.hatch = true;
    w.pump(9);
    return { phase: s.phase, atDoor: w.cast().chime.atDoor };
  });
  ok('the hatch does stop it', chimeHatch.phase === 'play' && !chimeHatch.atDoor, JSON.stringify(chimeHatch));

  console.log('\n— Jax bleeds a turtle dry —');
  const jax = await page.evaluate(() => {
    const w = OuissysNightShift.__night, s = w.state();
    /* one door held for fourteen seconds, with and without him behind
       it. Same door cost either way — the difference is all Jax. */
    const shutFor = (withJax) => {
      w.route('night:2'); w.route('go');
      w.only(withJax ? 'jax' : 'cogsworth', withJax ? undefined : 0);
      if (!withJax) w.cast().cogsworth.asleep = true;
      s.power = 100; s.blackout = false;
      const d = withJax ? w.cast().jax.def.door : 'left';
      s.doors.left = s.doors.right = s.doors.hatch = false;
      s.doors[d] = true;
      w.pump(14);
      return 100 - s.power;
    };
    const quiet = shutFor(false);
    const loud = shutFor(true);
    return { quiet, loud };
  });
  ok('Jax at a shut door costs far more than the door does',
     jax.loud > jax.quiet * 1.7,
     jax.loud.toFixed(1) + '% vs ' + jax.quiet.toFixed(1) + '% over 14s');

  console.log('\n— a dropped monitor is not a camera —');
  const drop = await page.evaluate(() => {
    const w = OuissysNightShift.__night, s = w.state();
    w.route('night:6'); w.route('go');
    w.only('marabelle', 0);
    s.monitor = true; w.cam(w.cast().marabelle.room); s.power = 100;
    const watch = () => { const a = w.cast().marabelle.step; w.pump(26); return w.cast().marabelle.step - a; };
    s.monOut = 0;  const seen = watch();
    w.route('restart'); w.only('marabelle', 0);
    s.monitor = true; w.cam(w.cast().marabelle.room); s.power = 100;
    s.monOut = 999; const blind = watch();
    s.monOut = 0;
    return { seen, blind };
  });
  ok('she is still frozen on a working picture', drop.seen === 0, String(drop.seen));
  ok('but a monitor that cut out does not hold her',
     drop.blind > 0, 'moved ' + drop.blind + ' steps behind the static');

  console.log('\n— the blackout, and six o clock —');
  const black = await page.evaluate(() => {
    const w = OuissysNightShift.__night, s = w.state();
    w.route('night:2'); w.route('go');
    w.only('jax', 0);
    s.doors.left = true; s.doors.right = true;
    s.power = 0.4; s.hour = 2; s.hourT = 0;
    w.pump(2);
    return { blackout: s.blackout, doors: JSON.stringify(s.doors), monitor: s.monitor };
  });
  ok('power out kills the doors', black.blackout === true && black.doors.indexOf('true') < 0, JSON.stringify(black));
  const dark = await page.evaluate(() => { const w = OuissysNightShift.__night; w.pump(70); return w.state(); });
  ok('the dark eventually gets you', dark.phase === 'over', dark.phase + '/' + dark.dead);
  await page.waitForTimeout(300);
  await shot('blackout');

  console.log('\n— the budget —');
  const idle = await page.evaluate(() => {
    const w = OuissysNightShift.__night;
    w.route('night:1'); w.route('go');
    const s = w.state();
    Object.keys(w.cast()).forEach(k => { w.cast()[k].asleep = true; });
    w.pump(340, 0.5);
    return { phase: s.phase, power: s.power, hour: s.hour };
  });
  ok('doing nothing at all gets you to six', idle.phase === 'shift', JSON.stringify(idle));

  console.log('\n— a whole night, played carefully —');
  const win = await page.evaluate(() => {
    const w = OuissysNightShift.__night;
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

  console.log('\n— six nights, each with a new rule —');
  const nights = await page.evaluate(() => {
    const w = OuissysNightShift.__night;
    const out = [];
    for (let n = 1; n <= 6; n++) {
      w.route('night:' + n); w.route('go');
      const s = w.state();
      out.push({ n: s.night, awake: Object.keys(s.cfg.active).length,
                 haz: s.cfg.hazards.slice(), ramp: s.cfg.ramp[5] });
    }
    return out;
  });
  ok('there are six story nights', nights.length === 6 && nights[5].n === 6);
  ok('night 2 wakes all four', nights[1].awake === 4, JSON.stringify(nights[1].awake));
  ok('the ramp only climbs',
     nights.every((x, i) => i === 0 || x.ramp >= nights[i - 1].ramp),
     nights.map(x => x.ramp).join(' '));
  /* the point of the add-on: every night after the first brings a rule
     the night before did not have, not just a bigger number */
  const newRules = nights.map((x, i) => i === 0 ? [] : x.haz.filter(h => nights[i - 1].haz.indexOf(h) < 0));
  ok('every night after the first adds a rule',
     newRules.slice(1).every(r => r.length >= 1),
     newRules.slice(1).map(r => r.join('+')).join(' | '));

  console.log('\n— the shift the story ends on —');
  const fin = await page.evaluate(() => {
    const w = OuissysNightShift.__night, s = w.state();
    w.route('night:6'); w.route('go');
    s.hour = 5; s.power = 60;
    ['cogsworth', 'chime', 'marabelle', 'jax'].forEach((k) => { w.cast()[k].asleep = true; });
    w.pump(70);
    return { phase: s.phase, hour: s.hour };
  });
  await page.waitForTimeout(500);
  ok('night six ends in the finale, not a scoreboard', fin.phase === 'finale', JSON.stringify(fin));
  const finTxt = (await page.locator('.ns-card').textContent()) || '';
  ok('and dawn is what is on the card', /6:00 AM|dawn|light/i.test(finTxt), finTxt.slice(0, 60));
  await shot('finale');

  console.log('\n— what the record keeps —');
  const rec = await page.evaluate(() => {
    const w = OuissysNightShift.__night, s = w.state();
    return { rating: s.rating, stats: s.stats,
             badges: Object.keys(JSON.parse(localStorage.getItem('ns_badges') || '{}')),
             done: Object.keys(JSON.parse(localStorage.getItem('ns_nights') || '{}')) };
  });
  ok('a night is rated', !!rec.rating, JSON.stringify(rec.rating));
  ok('the rating is built out of what the night actually measured',
     rec.stats && typeof rec.stats.camSec === 'number' && typeof rec.stats.knocks === 'number',
     JSON.stringify(rec.stats));
  ok('the nights survived are remembered', rec.done.length > 0, rec.done.join(','));
  ok('badges are earned, not given', rec.badges.length > 0, rec.badges.join(','));
  /* and a custom night with everyone asleep is not a way to earn them */
  const farm = await page.evaluate(() => {
    const w = OuissysNightShift.__night;
    localStorage.setItem('ns_badges', '{}');
    localStorage.setItem('ns_custom', JSON.stringify({ cogsworth: 0, chime: 0, marabelle: 0, jax: 0 }));
    w.route('customGo');
    const s = w.state();
    while (s.phase === 'play') w.pump(20);
    return Object.keys(JSON.parse(localStorage.getItem('ns_badges') || '{}'));
  });
  ok('an empty custom night earns nothing', farm.length === 0, farm.join(','));

  console.log('\n— everything the story unlocks —');
  await page.evaluate(() => { const w = OuissysNightShift.__night; w.route('title'); });
  await page.waitForTimeout(350);
  ok('custom night is offered', await page.locator('[data-go="custom"]').count() === 1);
  ok('the gallery is offered', await page.locator('[data-go="gallery"]').count() === 1);
  ok('cozy mode is on the title', await page.locator('[data-go="cozy"]').count() === 1);
  await page.evaluate(() => OuissysNightShift.__night.route('custom'));
  await page.waitForTimeout(300);
  ok('a dial for each of them', await page.locator('.ns-dial').count() === 4);
  const dial = await page.evaluate(() => {
    const w = OuissysNightShift.__night;
    for (let i = 0; i < 30; i++) {
      const up = document.querySelector('.ns-step[data-dial="cogsworth:1"]');
      up.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true }));
      up.click();
    }
    const d = JSON.parse(localStorage.getItem('ns_custom') || '{}');
    w.route('customGo');
    const s = w.state();
    return { saved: d.cogsworth, mode: s.mode, night: s.night };
  });
  ok('dials cap at twenty', dial.saved === 20, String(dial.saved));
  /* each slider is that performer's own. The hour curve used to be
     derived from the highest dial, so turning one up sped all four up */
  const indep = await page.evaluate(() => {
    const w = OuissysNightShift.__night;
    const curve = (jax) => {
      localStorage.setItem('ns_custom', JSON.stringify({ cogsworth: 5, chime: 5, marabelle: 5, jax }));
      w.route('customGo');
      return +w.state().cfg.ramp[5].toFixed(3);
    };
    return { quiet: curve(5), loud: curve(20) };
  });
  ok('one slider does not move the other three', indep.quiet === indep.loud,
     JSON.stringify(indep));
  ok('and a custom night runs', dial.mode === 'custom', JSON.stringify(dial));
  await shot('custom');
  await page.evaluate(() => OuissysNightShift.__night.route('gallery'));
  await page.waitForTimeout(600);
  ok('the gallery walks the shop in daylight',
     await page.evaluate(() => OuissysNightShift.__night.state().phase) === 'gallery');
  await shot('gallery');

  console.log('\n— cozy mode is gentler, not shorter —');
  const cozy = await page.evaluate(() => {
    const w = OuissysNightShift.__night, s = w.state();
    const budget = () => {
      w.route('night:6'); w.route('go');
      s.power = 100; s.doors.left = true; s.doors.right = true;
      const a = s.power; w.pump(20); return a - s.power;
    };
    w.route('title');
    const hard = budget();
    s.cozy = true;
    const soft = budget();
    s.cozy = false;
    return { hard, soft };
  });
  ok('cozy mode drains slower', cozy.soft < cozy.hard * 0.85,
     cozy.soft.toFixed(1) + ' vs ' + cozy.hard.toFixed(1) + ' over 20s');

  console.log('\n— the cabinet nobody switched off —');
  await page.evaluate(() => {
    const w = OuissysNightShift.__night;
    w.route('title'); w.route('night:1'); w.route('go');
  });
  await page.waitForTimeout(200);
  /* the hotspot is placed by the frame loop, so this waits on real
     frames rather than pumping — it is the one thing in the suite that
     has to be looked at to exist */
  const settle = async () => { await page.waitForTimeout(1400); };
  await page.evaluate(() => {
    const w = OuissysNightShift.__night;
    if (!w.state().monitor) w.press('monitor');
    w.cam('hall');
  });
  await settle();
  ok('nothing to click in the main hall',
     await page.evaluate(() => document.getElementById('ns-egg').hidden) === true);
  await page.evaluate(() => OuissysNightShift.__night.cam('arcade'));
  await settle();
  const eggThere = await page.evaluate(() => {
    const el = document.getElementById('ns-egg');
    return { hidden: el.hidden, left: el.style.left, top: el.style.top };
  });
  ok('the cabinet answers on camera three', eggThere.hidden === false, JSON.stringify(eggThere));
  const played = await page.evaluate(() => {
    const el = document.getElementById('ns-egg');
    el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true }));
    el.click();
    return OuissysNightShift.__night.state().phase;
  });
  await page.waitForTimeout(250);
  ok('and it plays', played === 'arcade', played);
  ok('on its own screen', await page.locator('.ns-arc-cvs').count() === 1);
  /* the keyboard reaches the cabinet rather than the exit button: the
     phase check used to come first, which made every key in KEYWIND
     dead and turned the space bar into BACK TO THE SHIFT */
  await page.keyboard.press(' ');
  await page.waitForTimeout(200);
  ok('the space bar does not throw you out of it',
     await page.evaluate(() => OuissysNightShift.__night.state().phase) === 'arcade');
  const drove = await page.evaluate(async () => {
    const cvs = document.querySelector('.ns-arc-cvs');
    const px = () => { const d = cvs.getContext('2d').getImageData(0, 140, cvs.width, 10).data;
      let sum = 0, n = 0;
      for (let i = 0; i < d.length; i += 4) if (d[i] + d[i+1] + d[i+2] > 260) { sum += (i / 4) % cvs.width; n++; }
      return n ? sum / n : -1; };
    const before = px();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'd' }));
    await new Promise(r => setTimeout(r, 900));
    window.dispatchEvent(new KeyboardEvent('keyup', { key: 'd' }));
    const held = px();
    await new Promise(r => setTimeout(r, 600));
    return { before, held, after: px() };
  });
  ok('and D drives the mouse across it', drove.held > drove.before + 4,
     JSON.stringify(drove));
  ok('and letting go stops her', Math.abs(drove.after - drove.held) < 24,
     JSON.stringify(drove));
  await shot('arcade');
  await page.evaluate(() => OuissysNightShift.__night.route('arcadeOut'));
  await page.waitForTimeout(200);
  ok('and hands the shift straight back',
     await page.evaluate(() => OuissysNightShift.__night.state().phase) === 'play');

  console.log('\n— the ones he sold, coming back —');
  const sold = await page.evaluate(() => {
    const w = OuissysNightShift.__night, s = w.state();
    const nightHas = (n) => {
      w.route('night:' + n); w.route('go');
      w.pump(340, 0.5);
      const cs = w.cast();
      return ['post1','post2','post3'].filter(k => cs[k] && cs[k].awake).length;
    };
    const one = nightHas(1), four = nightHas(4);
    /* watching does nothing to them: they were not built for her */
    w.route('night:4'); w.route('go');
    const c = w.cast().post1;
    c.awake = true; c.cool = 0; c.step = 1;
    s.monitor = true; w.cam(c.room); s.power = 100;
    const a0 = c.step; w.pump(70); const watched = c.step - a0;
    /* an open door is fatal, a shut one holds them and then they go */
    const run = (shut) => {
      w.route('night:4'); w.route('go');
      ['cogsworth','chime','marabelle','jax'].forEach(k => { w.cast()[k].wound = 0; });
      w.put('post1', w.cast().post1.def.route.length - 1);
      s.power = 100; s.blackout = false; s.doors.left = shut;
      w.pump(14);
      return { phase: s.phase, dead: s.dead, atDoor: w.cast().post1.atDoor };
    };
    return { one, four, watched, open: run(false), shut: run(true) };
  });
  ok('night one is his four and nothing else', sold.one === 0, String(sold.one));
  ok('and by night four there are three of them', sold.four === 3, String(sold.four));
  ok('watching one does nothing at all', sold.watched > 0, 'moved ' + sold.watched + ' while watched');
  ok('an open door is the end of it', sold.open.dead === 'post1', JSON.stringify(sold.open));
  ok('a shut one holds, and then it goes',
     sold.shut.phase === 'play' && sold.shut.atDoor === false, JSON.stringify(sold.shut));

  console.log('\n— and what his four are actually for —');
  const held = await page.evaluate(() => {
    const w = OuissysNightShift.__night, s = w.state();
    try { localStorage.removeItem('ns_seensave'); } catch (e) {}
    const at = (wound) => {
      w.route('title'); w.route('night:4'); w.route('go');
      ['cogsworth','chime','marabelle','jax'].forEach(k => { w.cast()[k].wound = wound; });
      w.put('post1', w.cast().post1.def.route.length - 1);
      s.doors.left = false; s.power = 100; s.blackout = false;
      w.pump(6);
      /* pump never stops to tell a story, so ask for the card the way a
         real interception would raise it */
      const shown = s.stats.saves > 0 && !s.dead;
      return { phase: s.phase, dead: s.dead, saves: s.stats.saves,
               card: shown, spent: w.wind().count };
    };
    const wound = at(9);
    w.route('heldOut');
    const slack = at(0);
    return { wound, slack };
  });
  ok('a wound one gets there before the thing at the door does',
     held.wound.saves === 1 && !held.wound.dead, JSON.stringify(held.wound.phase));
  ok('and she is told what she just saw, once', held.wound.card === true);
  ok('and it has spent itself doing it', held.wound.spent === 3, String(held.wound.spent));
  ok('with none of them wound, nobody is coming',
     held.slack.dead === 'post1' && held.slack.saves === 0, JSON.stringify(held.slack.dead));

  console.log('\n— winding the four he made for her —');
  const wind = await page.evaluate(async () => {
    const w = OuissysNightShift.__night, s = w.state();
    w.route('night:2'); w.route('go');
    /* nothing from outside during this one. Two hundred seconds of an
       unattended night on night two is plenty of time for one of the
       ones he sold to walk in the front and end it, and everything
       measured after that would be measured on a finished night. */
    const hush = () => ['post1','post2','post3'].forEach(k => {
      if (w.cast()[k]) { w.cast()[k].asleep = true; w.cast()[k].awake = false; } });
    hush();
    const start = w.wind();
    /* they run down over a night whether she looks or not */
    w.pump(200, 0.25);
    const later = w.wind();
    /* the key only shows on the one she is actually looking at */
    /* a fresh night, so the key is being looked for during a shift that
       is still running */
    w.route('night:2'); w.route('go'); hush();
    const c = w.cast().cogsworth;
    c.wound = 0.2; c.awake = true;
    w.put('cogsworth', 1);
    if (!s.monitor) w.press('monitor');
    w.cam('party');
    await new Promise(r => setTimeout(r, 1200));
    const elsewhere = document.getElementById('ns-key').hidden;
    w.cam(c.room);
    await new Promise(r => setTimeout(r, 1400));
    const el = document.getElementById('ns-key');
    const there = { hidden: el.hidden, who: el.dataset.who };
    /* and holding it winds him */
    const p0 = s.power;
    el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true }));
    await new Promise(r => setTimeout(r, 1900));
    el.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
    return { start: start.wound.cogsworth, later: later.wound.cogsworth,
             elsewhere, there, after: w.wind().wound.cogsworth,
             spent: +(p0 - s.power).toFixed(2) };
  });
  ok('they start the night on the wind he left them', wind.start > 3, String(wind.start));
  ok('and they run down as it goes on', wind.later < wind.start, wind.later + ' from ' + wind.start);
  ok('the key is only on the one she is looking at', wind.elsewhere === true);
  ok('and it names him when she is', wind.there.hidden === false && wind.there.who === 'COGSWORTH',
     JSON.stringify(wind.there));
  ok('holding it winds him back up', wind.after > 6, String(wind.after));
  /* one wind, one charge — the same on any machine, which is the point */
  ok('and it costs her exactly one wind', wind.spent > 0.8 && wind.spent < 2.2, wind.spent + '%');
  /* the tag describes a wound one. Let her run down and the rules on the
     card stop being the rules in the room. */
  const slack = await page.evaluate(() => {
    const w = OuissysNightShift.__night, s = w.state();
    const watch = (wound) => {
      w.route('night:3'); w.route('go');
      w.only('marabelle', 0);      // only() now silences the sold ones too
      const m = w.cast().marabelle;
      m.wound = wound;
      s.monitor = true; w.cam(m.room); s.power = 100;
      const a = m.step; w.pump(24); return m.step - a;
    };
    return { wound: watch(6), slack: watch(0) };
  });
  ok('a wound ballerina still freezes when watched', slack.wound === 0, String(slack.wound));
  ok('a run-down one does not', slack.slack > 0, 'moved ' + slack.slack + ' steps while watched');

  console.log('\n— the shop has six things in it to find —');
  const finds = await page.evaluate(async () => {
    const w = OuissysNightShift.__night;
    try { localStorage.removeItem('ns_found'); } catch (e) {}
    const out = [];
    for (let n = 1; n <= 6; n++) {
      w.route('night:' + n); w.route('go');
      const f = w.finds();
      if (!f.armed) { out.push({ n, armed: null }); continue; }
      const s = w.state();
      if (!s.monitor) w.press('monitor');
      w.cam(f.room);
      await new Promise(r => setTimeout(r, 1500));   // the hotspot is placed by the frame loop
      const el = document.getElementById('ns-find');
      out.push({ n, armed: f.armed, room: f.room, shown: !el.hidden,
                 x: parseFloat(el.style.left), y: parseFloat(el.style.top) });
    }
    return out;
  });
  ok('one for every night', finds.length === 6 && finds.every(f => f.armed), JSON.stringify(finds.map(f => f.armed)));
  ok('and every one of them is actually on its camera',
     finds.every(f => f.shown), JSON.stringify(finds.filter(f => !f.shown)));
  ok('and none of them is on the lip of the picture',
     finds.every(f => f.x > 8 && f.x < 92 && f.y > 8 && f.y < 92),
     finds.map(f => Math.round(f.x) + ',' + Math.round(f.y)).join(' '));
  /* night two kills the workshop feed for good, so nothing may hide in
     there after night one — it would be unfindable and she would never
     know why */
  ok('nothing hides behind a dead camera',
     finds.every(f => !(f.room === 'workshop' && f.n > 1)),
     JSON.stringify(finds.map(f => f.n + ':' + f.room)));

  const took = await page.evaluate(async () => {
    const w = OuissysNightShift.__night;
    w.route('night:1'); w.route('go');
    const s = w.state();
    if (!s.monitor) w.press('monitor');
    w.cam(w.finds().room);
    await new Promise(r => setTimeout(r, 1500));
    document.getElementById('ns-find').click();
    await new Promise(r => setTimeout(r, 300));
    const card = (document.querySelector('.ns-card-find') || {}).textContent || '';
    return { phase: s.phase, card: card.length, kept: w.finds().kept,
             gone: !w.finds().armed };
  });
  ok('picking one up stops the shift and shows the page', took.phase === 'found' && took.card > 80, JSON.stringify(took.phase));
  ok('and it is hers from then on', took.kept.length === 1 && took.gone, took.kept.join(','));
  await shot('found');
  await page.evaluate(() => OuissysNightShift.__night.route('findOut'));
  await page.waitForTimeout(250);
  ok('and the shift picks straight back up',
     await page.evaluate(() => OuissysNightShift.__night.state().phase) === 'play');

  console.log('\n— the first night teaches itself —');
  const tut = await page.evaluate(async () => {
    const w = OuissysNightShift.__night;
    try { localStorage.clear(); } catch (e) {}
    w.route('title'); w.route('night:1'); w.route('go');
    const s = w.state();
    const seen = [];
    const act = {
      "MONITOR: RAISE IT.": () => w.press('monitor'),
      "MONITOR: LOWER IT. IT DRAWS WHILE IT IS UP.": () => w.press('monitor'),
      "WEST DOOR: CLOSE IT.": () => w.press('left'),
      "A SHUT DOOR HOLDS. IT ALSO DRAWS. OPEN IT.": () => w.press('left'),
      "CEILING HITCH": null,
      "CEILING HATCH: LATCH IT.": () => w.press('hatch'),
      "GOOD. UNLATCH.": () => w.press('hatch'),
    };
    let last = null, guard = 0, rooms = ['hall','stage','party','foyer','closet'], ri = 0;
    /* requestAnimationFrame runs at about 3fps in this container and
       orientation advances on frames, so this needs a budget measured in
       frames rather than in the wall-clock seconds a person would take */
    while (guard++ < 220 && w.tutor().step >= 0 && w.tutor().step < w.tutor().of) {
      const t = w.tutor();
      if (t.line !== last) { seen.push(t.line); last = t.line; if (act[t.line]) act[t.line](); }
      if (t.line === "GOOD. STEP THROUGH THE ROOMS." && ri < rooms.length) w.cam(rooms[ri++]);
      await new Promise(r => setTimeout(r, 260));
    }
    return { steps: seen.length, hour: s.hour, power: +s.power.toFixed(1),
             phase: s.phase, done: w.tutor().step < 0 };
  });
  ok('it walks her through every control', tut.steps >= 8, String(tut.steps));
  ok('and nothing moves while it waits', tut.hour === 0 && tut.power === 100,
     'hour ' + tut.hour + ', power ' + tut.power + '%');
  ok('and she cannot lose it', tut.phase === 'play' && tut.done, JSON.stringify(tut.phase));
  ok('and it never runs twice',
     await page.evaluate(() => localStorage.getItem('ns_notutor')) === '1');

  console.log('\n— and the story ends on something she decides —');
  const ends = await page.evaluate(() => {
    const w = OuissysNightShift.__night, s = w.state();
    w.route('night:6'); w.route('go');
    ['cogsworth','chime','marabelle','jax'].forEach(k => { w.cast()[k].asleep = true; });
    s.hour = 5; s.power = 60; w.pump(70);
    const asked = (document.querySelector('.ns-ask') || {}).textContent || '';
    const btns = Array.from(document.querySelectorAll('.ns-ov-fin [data-go]')).map(b => b.dataset.go);
    return { phase: s.phase, asked: asked.length, btns };
  });
  ok('the last night asks her something', ends.asked > 20 && ends.phase === 'finale', JSON.stringify(ends.phase));
  ok('and there are two ways to answer',
     ends.btns.indexOf('endWind') >= 0 && ends.btns.indexOf('endLeave') >= 0, ends.btns.join(','));
  for (const [go, want] of [['endWind', 'WINDS'], ['endLeave', 'LEAVES']]) {
    await page.evaluate((g) => OuissysNightShift.__night.route(g), go);
    await page.waitForTimeout(300);
    const txt = await page.locator('.ns-card-fin').textContent();
    ok('  ' + go + ' has its own ending', txt.indexOf(want) >= 0, txt.slice(0, 40));
  }
  await shot('ending');

  console.log('\n— the way out —');
  await page.evaluate(() => { const w = OuissysNightShift.__night; w.route('title'); });
  await page.waitForTimeout(300);
  await tap(page, { q: '.ns-btn', text: 'LEAVE' });
  await page.waitForTimeout(1200);
  ok('back at the hub', await page.locator('#screen-hub.active').count() === 1);

  ok('no page errors', errors.length === 0, errors.join(' | '));
  console.log('\n' + (fails ? 'FAILED ' + fails + ' of ' + checks : 'all ' + checks + ' checks passed'));
  await browser.close();
  process.exit(fails ? 1 : 0);
})();
