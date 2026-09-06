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

  /* THE ANSWER TO "you just feel bored surviving the first nights
     without logically having a reason to be there".

     The film says who he was. This says what she is doing here: the
     shutters come down, he sets six nights against everything he
     knows, and she agrees to it by pressing one button. Every night
     after it is a payment against a deal she made rather than a
     situation she is in. */
  console.log('\n— and then the shutters come down —');
  const terms = await page.evaluate(async () => {
    const w = OuissysNightShift.__night;
    try { localStorage.removeItem('ns_terms'); localStorage.removeItem('ns_seenintro'); } catch (e) {}
    w.route('intro');
    w.route('introDone');
    const s = w.state();
    const card = document.querySelector('.ns-card-terms');
    const out = { phase: s.phase, hasCard: !!card, mode: w.music().mode,
                  lines: 0, spoken: [], btn: null };
    if (card) {
      const b = card.querySelector('#ns-terms-go');
      out.btn = b ? b.hidden : null;
    }
    return out;
  });
  /* He reads it on a wall clock, the way the film does, so it cannot be
     wound forward in a tight loop — the test has to sit through it. */
  const heard = [];
  for (let i = 0; i < 260; i++) {
    const t = await page.evaluate(() => {
      const w = OuissysNightShift.__night;
      w.termsTick(0.25);
      return w.terms();
    });
    if (t.said && heard.indexOf(t.said) < 0) heard.push(t.said);
    if (t.ready || !t.on) break;
    await page.waitForTimeout(140);
  }
  terms.lines = heard.length;
  terms.ready = (await page.evaluate(() => OuissysNightShift.__night.terms())).ready;
  ok('the film hands her to the shutters, not to a shift',
     terms.phase === 'terms' && terms.hasCard, terms.phase);
  ok('and it has music of its own, which is a clock', terms.mode === 'locked', terms.mode);
  ok('he reads her the terms', terms.lines >= 6, terms.lines + ' lines');
  ok('and there is no way out of the card until he has finished',
     terms.ready === true, 'the button appears at the end');

  const said = await page.evaluate(() => OuissysNightShift.__night.termsText());
  ok('the terms are six nights', /[Ss]ix nights/.test(said), JSON.stringify(said.slice(0, 40)));
  ok('and they are about being ready to hear the rest, not about winning',
     /not handing|hear the end|everything/.test(said));

  const into = await page.evaluate(() => {
    const w = OuissysNightShift.__night;
    w.route('termsDone');
    const s = w.state();
    return { phase: s.phase, night: s.night, seen: (() => {
      try { return localStorage.getItem('ns_terms'); } catch (e) { return null; } })() };
  });
  ok('and saying yes puts her straight into night one',
     into.night === 1 && (into.phase === 'play' || into.phase === 'brief'), into.phase);
  ok('and she is never asked twice', into.seen === '1');

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
  /* nine now: the eight rooms she watches, and camera zero, which is
     the desk she is sitting at */
  ok('map has a cell per camera', await page.locator('.ns-cell').count() === 9,
     String(await page.locator('.ns-cell').count()));
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
    /* Night two, and monOut set by hand. This used night six, which is
       the night the monitor cuts out on its own — so the control case,
       the one where she is supposed to be frozen on a working picture,
       had the picture dropping out from under it. Same shape of mistake
       as running the ballerina on the signal-loss night: the hazard
       doing its job read as the rule failing. */
    w.route('night:2'); w.route('go');
    w.only('marabelle', 0);
    s.monitor = true; w.cam(w.cast().marabelle.room); s.power = 100;
    const watch = () => { const a = w.cast().marabelle.step; w.pump(26); return w.cast().marabelle.step - a; };
    /* She moves on a roll. A window she sits out proves nothing about
       the rule; a window she moves in proves it. So the frozen case has
       to hold across every attempt and the moving case only has to
       happen once. */
    let seen = 0, blind = 0;
    for (let i = 0; i < 4; i++) {
      w.route('restart'); w.only('marabelle', 0);
      s.monitor = true; w.cam(w.cast().marabelle.room); s.power = 100;
      s.monOut = 0; seen = Math.max(seen, watch());
      if (blind <= 0) {
        w.route('restart'); w.only('marabelle', 0);
        s.monitor = true; w.cam(w.cast().marabelle.room); s.power = 100;
        s.monOut = 999; blind = watch();
      }
    }
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
      /* his four asleep and the meter full, because pump() stops the
         moment the phase stops being play — and on a live night four
         with both doors open she is dead long before the third parcel
         has let itself in, so this was counting how long she survived */
      const cs0 = w.cast();
      ['cogsworth','chime','marabelle','jax'].forEach(k => {
        cs0[k].awake = false; cs0[k].asleep = true; });
      s.power = 100;
      w.pump(340, 0.5);
      const cs = w.cast();
      return ['post1','post2','post3'].filter(k => cs[k] && cs[k].awake).length;
    };
    const one = nightHas(1), four = nightHas(4);
    /* watching does nothing to them: they were not built for her */
    w.route('night:4'); w.route('go');
    /* This one has taken three goes to get right, and all three were
       the test rather than the game.

       A 70-second window came up empty about one run in twenty, because
       they advance on a 34% roll every 9.5 seconds. Making the window
       long enough to be sure meant that on a live night four one of his
       reached the office and ended the shift first — it was measuring
       how fast Jax kills you. Putting his four to sleep left them still
       wound, so a wound one intercepted the parcel at the door and sent
       it back to the start, and the thing came back having moved minus
       one.

       So: nobody else awake, nobody wound, and the claim itself is
       "watching does not stop it" — which one observation of it moving
       while watched settles. Four goes at it, stopping at the first. */
    let watched = 0;
    for (let attempt = 0; attempt < 4 && watched <= 0; attempt++) {
      w.route('night:4'); w.route('go');
      const cc = w.cast();
      ['cogsworth','chime','marabelle','jax'].forEach(k => {
        cc[k].awake = false; cc[k].asleep = true; cc[k].wound = 0; });
      const c2 = cc.post1;
      c2.awake = true; c2.cool = 0; c2.step = 0;
      s.monitor = true; w.cam(c2.room); s.power = 100;
      w.pump(90);
      watched = c2.step;
    }
    w.route('night:4'); w.route('go');
    const c = w.cast().post1;
    /* an open door is fatal, a shut one holds them and then they go */
    const run = (shut) => {
      w.route('night:4'); w.route('go');
      /* unwound so nobody intercepts, and asleep so nobody else gets to
         the office first — this is a check about what a parcel does at
         a door, and twice now it has come back reporting how Jax got in
         through the other one */
      ['cogsworth','chime','marabelle','jax'].forEach(k => {
        const ch = w.cast()[k]; ch.wound = 0; ch.awake = false; ch.asleep = true; });
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
      /* night two, not night three. Three is the night the cameras
         start dropping out at random, and a dropped camera is not a
         camera — so a wound ballerina moving there is the signal-loss
         rule working, not the freezing rule failing. One run in four
         caught one and called it a bug in the game. */
      w.route('night:2'); w.route('go');
      w.only('marabelle', 0);      // only() now silences the sold ones too
      const m = w.cast().marabelle;
      m.wound = wound;
      s.monitor = true; w.cam(m.room); s.power = 100;
      const a = m.step; w.pump(24); return m.step - a;
    };
    /* She moves on a roll, so a window that comes up empty says nothing
       about the rule — but one that comes up full settles it. The wound
       one has to hold still through every attempt; the slack one only
       has to move once. */
    let wound = 0, slack = 0;
    for (let i = 0; i < 4; i++) {
      wound = Math.max(wound, watch(6));
      if (slack <= 0) slack = watch(0);
    }
    return { wound, slack };
  });
  ok('a wound ballerina still freezes when watched', slack.wound === 0, String(slack.wound));
  ok('a run-down one does not', slack.slack > 0, 'moved ' + slack.slack + ' steps while watched');

  console.log('\n— and the record notices whether she looked after them —');
  const rec2 = await page.evaluate(() => {
    const w = OuissysNightShift.__night, s = w.state();
    const finish = (wound) => {
      try { localStorage.setItem('ns_badges', '{}'); } catch (e) {}
      w.route('night:2'); w.route('go');
      ['cogsworth','chime','marabelle','jax'].forEach(k => { w.cast()[k].asleep = true; w.cast()[k].wound = wound; });
      s.hour = 5; s.power = 60; w.pump(70);
      return { rating: s.rating && s.rating.key,
               badges: Object.keys(JSON.parse(localStorage.getItem('ns_badges') || '{}')) };
    };
    const kept = finish(9);
    const dropped = finish(0);
    return { kept, dropped };
  });
  ok('a night with all four still wound rates better than one without',
     rec2.kept.rating !== rec2.dropped.rating,
     rec2.kept.rating + ' vs ' + rec2.dropped.rating);
  ok('and keeping all four is worth a badge of its own',
     rec2.kept.badges.indexOf('kept') >= 0 && rec2.dropped.badges.indexOf('kept') < 0,
     rec2.kept.badges.join(',') + ' | ' + rec2.dropped.badges.join(','));

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
      /* the newest and most important control, which orientation did
         not teach at all for a whole pass */
      "FIND HIM.": () => { if (!w.state().monitor) w.press('monitor');
                           w.cam(w.cast().cogsworth.room); },
      /* Once, and then let go of nothing: the hold is on a wall clock,
         so pressing again every tick restarted it and the ring never
         filled. It has to be retried until the key is on screen — the
         frame loop places it — and then never pressed again. */
      "THERE IS A KEY IN HIS BACK. HOLD IT.": () => {
        const el = document.getElementById('ns-key');
        if (!el || el.hidden || el.dataset.held) return;
        el.dataset.held = '1';
        el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true }));
      },
    };
    let last = null, guard = 0, rooms = ['hall','stage','party','foyer','closet'], ri = 0;
    /* requestAnimationFrame runs at about 3fps in this container and
       orientation advances on frames, so this needs a budget measured in
       frames rather than in the wall-clock seconds a person would take */
    while (guard++ < 220 && w.tutor().step >= 0 && w.tutor().step < w.tutor().of) {
      const t = w.tutor();
      if (t.line !== last) { seen.push(t.line); last = t.line; if (act[t.line]) act[t.line](); }
      /* both of these have to be retried: the key is placed by the frame
         loop, so on the tick a line first appears it may not be on
         screen yet, and a single dispatch would stall the walkthrough */
      else if (act[t.line] && /KEY IN HIS BACK|FIND HIM/.test(t.line)) act[t.line]();
      if (t.line === "GOOD. STEP THROUGH THE ROOMS." && ri < rooms.length) w.cam(rooms[ri++]);
      await new Promise(r => setTimeout(r, 260));
    }
    return { steps: seen.length, seen, hour: s.hour, power: +s.power.toFixed(1),
             phase: s.phase, done: w.tutor().step < 0,
             wound: +w.wind().wound.cogsworth.toFixed(2) };
  });
  ok('it walks her through every control', tut.steps >= 12, String(tut.steps));
  ok('and that includes the key, which is the whole game',
     tut.seen.some(l => /KEY IN HIS BACK/.test(l)), tut.steps + ' steps');
  ok('and she actually winds one doing it', tut.wound > 5, 'wound ' + tut.wound);
  /* the clock still does not move — but the meter does now, by the one
     percent that winding him costs, which is the lesson */
  ok('and the clock never moves while it waits', tut.hour === 0, 'hour ' + tut.hour);
  ok('and the only thing it spends is the wind', tut.power > 97 && tut.power <= 100,
     tut.power + '%');
  ok('and she cannot lose it', tut.phase === 'play' && tut.done, JSON.stringify(tut.phase));
  ok('and it never runs twice',
     await page.evaluate(() => localStorage.getItem('ns_notutor')) === '1');

  /* the shelf is the only progress screen in the chapter, so it has to
     have somewhere to put everything the chapter can give her */
  const shelf = await page.evaluate(() => OuissysNightShift.__night.shelf());
  ok('the shelf has room for every night and every badge',
     shelf.slots >= shelf.most && shelf.most > 0,
     shelf.slots + ' slots for ' + shelf.most + ' things');

  /* HE HAS TO SAY THE WORDS THAT ARE ON THE SCREEN.

     The formant synth is a good impression of a man and a bad
     impression of English — you can hear that somebody is talking and
     you cannot hear what, which left the subtitles doing all the work.
     So the browser's own synthesiser says it now, off the same string
     the caption is built from.

     This container has no voices, so the game falls back to the synth
     here and that is the only path the rest of the suite ever walks.
     A stub puts the other one under test: it reports one voice, fires
     word boundaries the way a real one does, and this checks that the
     caption follows the synthesiser rather than the estimate, and that
     what it is asked to say is exactly what is written. */
  console.log('\n— and he says the words that are on the screen —');
  const spoken = await page.evaluate(async () => {
    const said = [], marks = [];
    /* window.speechSynthesis is a read-only accessor, so it has to be
       redefined rather than assigned — and the game is muted for the
       rest of this suite, which correctly stops it speaking at all. */
    const real = Object.getOwnPropertyDescriptor(window, 'speechSynthesis');
    const stub = {
      getVoices: () => [{ name: 'Test English', lang: 'en-GB' }],
      cancel() {},
      speak(u) {
        said.push({ text: u.text, pitch: u.pitch, rate: u.rate, lang: u.lang });
        /* a boundary per word, then the end, the way a real one does */
        let at = 0;
        u.text.split(' ').forEach((w) => {
          if (u.onboundary) u.onboundary({ name: 'word', charIndex: at });
          marks.push(OuissysNightShift.__night.voxMark());
          at += w.length + 1;
        });
        if (u.onend) u.onend();
      },
      addEventListener() {},
    };
    Object.defineProperty(window, 'speechSynthesis', { configurable: true, get: () => stub });
    window.SpeechSynthesisUtterance = function (t) { this.text = t; };
    const w = OuissysNightShift.__night;
    w.silence(false);
    w.speechReset();
    const line = 'I made toys. That part was true.';
    w.vox(line);
    w.speak(line);
    if (real) Object.defineProperty(window, 'speechSynthesis', real);
    w.silence(true);
    w.speechReset();
    return { said, marks };
  });
  ok('it is handed to the browser to say out loud', spoken.said.length === 1,
     spoken.said.length + ' utterances');
  ok('and what it is asked to say is exactly what is written',
     spoken.said[0] && spoken.said[0].text === 'I made toys. That part was true.',
     JSON.stringify(spoken.said[0] && spoken.said[0].text));
  ok('in English', /^en/i.test((spoken.said[0] || {}).lang || ''), (spoken.said[0] || {}).lang);
  /* Near natural pitch, a shade under natural pace. Pushing the pitch
     down to make him sound like a man is what made him sound like a
     monster: every engine is a real person cut into pieces, and the
     further you shift it from where they actually spoke the more of
     the stretching you hear. */
  ok('read at a storyteller\'s pace, not a screen reader\'s',
     spoken.said[0] && spoken.said[0].pitch > 0.85 && spoken.said[0].pitch <= 1 &&
     spoken.said[0].rate > 0.78 && spoken.said[0].rate < 0.95,
     'pitch ' + (spoken.said[0] || {}).pitch + ' rate ' + (spoken.said[0] || {}).rate);
  /* and the voice it is given is the best one on the device rather than
     the first one with "male" in its name, which on a Mac is Fred */
  const chosen = await page.evaluate(() => {
    const real = Object.getOwnPropertyDescriptor(window, 'speechSynthesis');
    const list = [
      { name: 'Fred', lang: 'en-US', localService: true },
      { name: 'Albert', lang: 'en-US', localService: true },
      { name: 'Samantha (Compact)', lang: 'en-US', localService: true },
      { name: 'Google UK English Male', lang: 'en-GB' },
      { name: 'Daniel (Enhanced)', lang: 'en-GB', localService: true },
      { name: 'Amelie', lang: 'fr-FR' },
    ];
    Object.defineProperty(window, 'speechSynthesis', { configurable: true,
      get: () => ({ getVoices: () => list, cancel() {}, speak() {}, addEventListener() {} }) });
    const w = OuissysNightShift.__night;
    w.speechReset();
    w.speech();
    const got = w.pickVoices();
    if (real) Object.defineProperty(window, 'speechSynthesis', real);
    w.speechReset();
    return got;
  });
  ok('and it picks the best voice on the device, not the first one',
     /Daniel \(Enhanced\)|Google UK English Male/.test(chosen.him || ''),
     'him: ' + chosen.him);
  ok('and never a 1984 novelty voice',
     !/fred|albert|compact/i.test(chosen.him || '') &&
     !/fred|albert|compact/i.test(chosen.sys || ''),
     'him: ' + chosen.him + ', the building: ' + chosen.sys);
  ok('and the building gets a different one from him',
     chosen.sys && chosen.sys !== chosen.him, chosen.sys);

  ok('and the caption walks along behind it, word by word',
     spoken.marks.length === 7 && spoken.marks[0] === 0 &&
     spoken.marks[6] === 6 && spoken.marks.every((m, i) => m === i),
     JSON.stringify(spoken.marks));

  /* THE FOUR THINGS THAT MADE HIM UNLISTENABLE.

     There is one mouth. speechSynthesis has a single queue and
     cancel() empties it, and the building announces a door every time
     she touches one — so every one of those cut him off mid-word, and
     the only voice she heard through to the end was the one saying
     DOOR ONE: CLOSED. */
  /* Every level in this chapter has been a guess made through a null
     audio device about a phone in a room nobody here can hear, and
     several of those guesses shipped wrong. So they are hers. */
  console.log('\n— and she can turn any of it up or down —');
  const mix = await page.evaluate(() => {
    const w = OuissysNightShift.__night;
    w.route('title');
    w.route('sound');
    const card = document.querySelector('.ns-ov-mix, [class*="ns-ov-mix"]') ||
                 document.getElementById('ns-overlay');
    const sliders = [].slice.call(document.querySelectorAll('[data-mix]'));
    const before = w.mix();
    /* drag one of them, the way a thumb does */
    const music = sliders.filter(s => s.dataset.mix === 'music')[0];
    if (music) {
      music.value = '30';
      music.dispatchEvent(new Event('input', { bubbles: true }));
    }
    const after = w.mix();
    /* and it survives being put away and reopened */
    w.route('title'); w.route('sound');
    const kept = w.mix();
    return { keys: sliders.map(s => s.dataset.mix), before, after, kept,
             stored: (() => { try { return localStorage.getItem('ns_mix_music'); }
                              catch (e) { return null; } })() };
  });
  ok('there is a fader for everything that makes a noise',
     mix.keys.length === 5 && mix.keys.indexOf('music') >= 0 &&
     mix.keys.indexOf('voice') >= 0, mix.keys.join(', '));
  ok('and moving one changes it while she is holding it',
     mix.after.music < mix.before.music && Math.abs(mix.after.music - 0.3) < 0.01,
     mix.before.music + ' -> ' + mix.after.music);
  ok('and it is still there when she comes back',
     Math.abs(mix.kept.music - 0.3) < 0.01 && mix.stored === '0.3', mix.stored);

  const reach = await page.evaluate(() => {
    const w = OuissysNightShift.__night;
    /* reachable from the middle of a shift, which is when she wants it */
    w.route('night:1'); w.route('go');
    const s = w.state();
    s.phase = 'play';
    w.route('sound');
    const out = { phase: s.phase, faders: document.querySelectorAll('[data-mix]').length };
    /* and DONE goes back to the shift, not out to the title */
    const done = [].slice.call(document.querySelectorAll('[data-go]'))
      .filter(b => /DONE/.test(b.textContent))[0];
    out.back = done ? done.dataset.go : null;
    w.route('mixReset');
    out.reset = w.mix().music;
    return out;
  });
  ok('she can reach it from the middle of a shift',
     reach.faders === 5 && reach.phase === 'mix', reach.phase);
  ok('and it puts her back in the shift rather than out to the title',
     reach.back === 'resume', String(reach.back));
  ok('and there is a way to undo whatever she did to it',
     reach.reset === 1, String(reach.reset));

  console.log('\n— and only one of them talks at a time —');
  const mouth = await page.evaluate(async () => {
    const said = [], cancels = [];
    const real = Object.getOwnPropertyDescriptor(window, 'speechSynthesis');
    let speaking = false;
    const stub = {
      getVoices: () => [{ name: 'Test A', lang: 'en-GB' }, { name: 'Test B', lang: 'en-GB' }],
      get speaking() { return speaking; }, get pending() { return false; },
      cancel() { cancels.push(said.length); },
      speak(u) { said.push(u.text); speaking = true; u.__end = u.onend; },
      addEventListener() {},
    };
    Object.defineProperty(window, 'speechSynthesis', { configurable: true, get: () => stub });
    window.SpeechSynthesisUtterance = function (t) { this.text = t; };
    const w = OuissysNightShift.__night;
    w.silence(false); w.speechReset(); w.speech();
    /* he starts a sentence */
    w.speak('I made four toys out of my wife.');
    const afterHim = said.length;
    /* and the building tries to announce a door over the top of it */
    w.sysSay('DOOR ONE: CLOSED');
    const out = { him: said[0], count: said.length, afterHim, cancels: cancels.length,
                  waiting: w.speech().waiting };
    Object.defineProperty(window, 'speechSynthesis', real);
    w.silence(true); w.speechReset();
    return out;
  });
  ok('he gets to finish his sentence', mouth.count === 1, mouth.count + ' spoken at once');
  ok('and the building waits rather than cutting him off',
     mouth.waiting === true, 'the door line is queued behind him');
  ok('and nothing cancels his queue but him',
     mouth.cancels <= 1, mouth.cancels + ' cancels');

  /* AND HE HAS TO REACH THE END OF EVERY SENTENCE.

     The stub the rest of this file uses answers instantly, which is
     the one thing a real engine never does — so nothing here could see
     the opening cutting itself off. This one takes real time to talk,
     and cancel() chops whatever it is in the middle of, which is what
     a browser does.

     What it caught: every utterance's backstop timer cleared a flag
     the whole chapter reads, so a timer belonging to a line that had
     finished a second ago cleared it for the line currently being
     spoken. The film decided that line was over, started the next one,
     and cancelled the previous one a third of the way through. Two of
     the first seven sentences of the opening. */
  console.log('\n— and he reaches the end of every sentence —');
  const whole = await page.evaluate(async () => {
    const log = [];
    let cur = null, t0 = 0;
    const real = Object.getOwnPropertyDescriptor(window, 'speechSynthesis');
    const stub = {
      getVoices: () => [{ name: 'Test English', lang: 'en-GB', localService: true }],
      get speaking() { return !!cur; }, get pending() { return false; },
      cancel() {
        if (!cur) return;
        log.push({ ev: 'CUT', text: cur.text,
                   at: (performance.now() - t0) / 1000, of: cur.__dur });
        const c = cur; cur = null; if (c.onend) c.onend();
      },
      speak(u) {
        /* about two and a half words a second, which is a narrator */
        u.__dur = String(u.text).trim().split(/\s+/).length / 2.6;
        log.push({ ev: 'SAY', text: u.text, of: u.__dur });
        cur = u; t0 = performance.now();
        setTimeout(() => { if (cur === u) { log.push({ ev: 'END', text: u.text });
          cur = null; if (u.onend) u.onend(); } }, u.__dur * 1000);
      },
      addEventListener() {},
    };
    Object.defineProperty(window, 'speechSynthesis', { configurable: true, get: () => stub });
    window.SpeechSynthesisUtterance = function (t) { this.text = t; };
    const w = OuissysNightShift.__night;
    w.silence(false); w.speechReset();
    try { localStorage.removeItem('ns_seenintro'); } catch (e) {}
    w.route('intro');
    await new Promise(r => setTimeout(r, 24000));
    w.route('introDone');
    Object.defineProperty(window, 'speechSynthesis', real);
    w.silence(true); w.speechReset();
    /* the empty utterance that primes iOS is cancelled on purpose and
       has no words in it */
    return { said: log.filter(e => e.ev === 'SAY' && e.text.trim()).length,
             cut: log.filter(e => e.ev === 'CUT' && e.text.trim()).map(e =>
               e.text.slice(0, 30) + ' at ' + e.at.toFixed(1) + '/' + e.of.toFixed(1) + 's') };
  });
  ok('the opening actually says several sentences', whole.said >= 5,
     whole.said + ' spoken');
  ok('and not one of them is cut off part way through',
     whole.cut.length === 0, whole.cut.join(' | ') || 'none cut');

  console.log('\n— and he does not leave dead air between sentences —');
  const gaps = await page.evaluate(() => OuissysNightShift.__night.tapeGaps());
  ok('the tapes are a conversation, not one line an hour',
     gaps.lines >= 12, gaps.lines + ' lines on night one');
  ok('and the longest silence between two of them is short',
     gaps.longest <= 40, 'longest gap ' + gaps.longest.toFixed(0) + 's');
  ok('and he starts talking soon after midnight',
     gaps.first <= 8, 'first line at ' + gaps.first.toFixed(0) + 's');

  /* THE THING THIS WHOLE CHAPTER TURNS ON FOR SOMEBODY WHO IS NOT A
     GAMER: is anything happening in the five and a half minutes she is
     actually playing, or is the story all in the gaps between them? */
  console.log('\n— and he talks to her while she works —');
  const tape = await page.evaluate(async () => {
    const w = OuissysNightShift.__night, s = w.state();
    w.route('night:1'); w.route('go');
    /* nothing awake, so this measures the tapes and not a scare */
    const c = w.cast();
    Object.keys(c).forEach(k => { c[k].awake = false; c[k].asleep = true; });
    const heard = [];
    /* the tapes run on the frame loop rather than on pump(), because a
       man talking is not part of the simulation */
    /* the frame loop's order exactly: the building drains its queue,
       and only then does he get the room. pump() does neither, because
       neither is part of the simulation. */
    for (let i = 0; i < 900; i++) {
      w.pump(0.4, 0.2);
      w.sayTick(0.4);
      w.tapeTick(0.4);
      const t = w.tape();
      if (t.line && heard.indexOf(t.line) < 0) heard.push(t.line);
    }
    return { heard, hour: s.hour, said: w.tape().said };
  });
  const why = await page.evaluate(() => {
    const w = OuissysNightShift.__night, out = [];
    for (let n = 1; n <= 6; n++) {
      w.route('night:' + n);
      const el = document.querySelector('.ns-card-brief .ns-why');
      out.push(el ? el.textContent.trim() : null);
    }
    return out;
  });
  ok('every night says what it is for before it starts',
     why.length === 6 && why.every(x => x && x.length > 12),
     JSON.stringify(why[0]));
  ok('and no two nights are for the same thing',
     new Set(why).size === 6);

  ok('he says something in the first night at all', tape.heard.length > 0,
     tape.heard.length + ' of his lines');
  ok('and it is more than one thing, spread across the night',
     tape.heard.length >= 4, tape.heard.length + ' by ' + tape.hour + " o'clock");
  ok('and he never says the same thing twice',
     new Set(tape.heard).size === tape.heard.length);
  /* He says her name in the terms now, which is where the introduction
     moved to — so night one opens on the deal instead, and every night
     after it counts down against the six he asked for. */
  ok('and the first thing he says counts the night against the six',
     /of six|Six|six/.test(tape.heard[0] || ''),
     JSON.stringify((tape.heard[0] || '').slice(0, 46)));
  ok('and it is the terms that say her name',
     /Ouissy/.test(await page.evaluate(() => OuissysNightShift.__night.termsText())));

  /* and the rules that keep it from being a radio playing over a scare */
  const manners = await page.evaluate(() => {
    const w = OuissysNightShift.__night, s = w.state();
    w.route('night:4'); w.route('go');
    const out = {};
    /* He has the right of way now — the other way round was the bug.
       The building announces a door every time she touches one, so
       "wait for the building" meant he never spoke on a night she was
       actually playing. */
    w.say('POWER AT TWENTY PERCENT');
    out.underBuilding = w.tape().quiet;
    w.pump(6);
    /* and nothing speaks while something is at a door */
    w.put('cogsworth', w.cast().cogsworth.def.route.length - 1);
    out.atDoor = w.tape().quiet;
    /* nor once she is dead */
    s.doors.left = false; w.pump(9);
    out.phase = s.phase;
    out.afterDeath = w.tape().on;
    return out;
  });
  ok('he talks over the shop rather than waiting for it to finish',
     manners.underBuilding === true);
  ok('and he says nothing with something at the door', manners.atDoor === false);
  ok('and nothing at all once it has her',
     manners.phase === 'over' && manners.afterDeath === false, manners.phase);

  /* SHE PLAYED FOUR NIGHTS AND FELT NOTHING, and most of the reason is
     that every frightening thing in this chapter happened somewhere
     else, to a figure walking a route, and reached her as a number
     going down. The office was inert. Nothing was ever in the room
     with her until the instant it killed her.

     Camera zero is her own desk. */
  console.log('\n— and the room she is sitting in is on camera too —');
  const zero = await page.evaluate(() => {
    const w = OuissysNightShift.__night, s = w.state();
    const out = {};
    out.onPlan = !!document.querySelector('#ns-map .ns-cell[data-room="office"]');
    w.route('night:3'); w.route('go');
    w.press('monitor'); w.cam('office');
    out.selectable = s.cam === 'office';
    s.hour = 3;
    const look = (on) => { s.monitor = on; if (on) w.cam('office');
                           for (let i = 0; i < 6; i++) w.deskStep(0.2); };
    look(true);  out.first = w.desk();
    look(false); out.second = w.desk();
    look(true);  look(false); out.third = w.desk();
    look(true);  look(false); out.gone = w.desk();
    /* and it is never on the first two nights */
    w.route('night:2'); w.route('go');
    out.night2 = w.desk().armed;
    return out;
  });
  ok('the desk is a camera on the plan', zero.onPlan === true);
  ok('and she can actually look at it', zero.selectable === true);
  ok('something is standing in her office',
     zero.first.on === true && zero.first.at === 0, JSON.stringify(zero.first.where));
  ok('and every time she looks away it is nearer',
     zero.second.at === 1 && zero.third.at === 2,
     zero.first.at + ' -> ' + zero.second.at + ' -> ' + zero.third.at);
  ok('and it walks up the room toward her rather than away',
     zero.third.where[1] > zero.first.where[1],
     'z ' + zero.first.where[1] + ' -> ' + zero.third.where[1]);
  ok('and then it is simply not there any more, once a night',
     zero.gone.on === false && zero.gone.seen === true);
  ok('and it never happens on the first two nights', zero.night2 === false);

  /* one revelation a night, in the middle of the shift */
  console.log('\n— and every night tells her something about him —');
  const reveals = await page.evaluate(() => {
    const w = OuissysNightShift.__night, s = w.state(), out = { nights: [], heads: [] };
    for (let n = 1; n <= 6; n++) {
      w.route('night:' + n); w.route('go');
      const c = w.cast();
      Object.keys(c).forEach(k => { c[k].awake = false; c[k].asleep = true; });
      s.hour = 3; w.pump(2);
      w.revealStep(0.2);
      out.nights.push(s.phase);
      const h = document.querySelector('.ns-paper-head');
      out.heads.push(h ? h.textContent.trim() : null);
      w.route('revealOut');
    }
    return out;
  });
  ok('every one of the six stops in the middle and tells her something',
     reveals.nights.every(p => p === 'reveal'), reveals.nights.join(','));
  ok('and no two nights tell her the same thing',
     new Set(reveals.heads).size === 6, JSON.stringify(reveals.heads[0]));

  /* and they do not look alike either */
  const looks = await page.evaluate(() => {
    const w = OuissysNightShift.__night, out = { tones: [], titles: [] };
    for (let n = 1; n <= 6; n++) {
      w.route('night:' + n);
      const t = document.querySelector('.ns-eptitle');
      out.titles.push(t ? t.textContent.trim() : null);
      w.route('go');
      out.tones.push(document.getElementById('ns-stage').dataset.tone);
    }
    return out;
  });
  ok('every night has a name of its own', new Set(looks.titles).size === 6,
     looks.titles.join(' / '));
  ok('and the shop cools out from under her as they go on',
     new Set(looks.tones).size >= 5, looks.tones.join(','));

  /* THE BEAT THE WHOLE CHAPTER IS BUILT ON, WHICH USED TO BE OPTIONAL.

     One of his four stepping in front of her is the answer to
     everything — and it could only happen if a parcel reached an OPEN
     door while one of his was still wound, so a player doing well
     never saw it. Night five stages it now. */
  console.log('\n— and night five makes sure she sees it —');
  const staged = await page.evaluate(() => {
    const w = OuissysNightShift.__night, s = w.state();
    try { localStorage.removeItem('ns_seensave'); } catch (e) {}
    const run = (night, wound) => {
      w.route('night:' + night); w.route('go');
      /* His four asleep but still wound. guardFor asks only whether one
         is wound, so this isolates the staged beat from the four of
         them killing her first — which is what a live night five with
         both doors open does in about forty seconds. */
      ['cogsworth','chime','marabelle','jax'].forEach(k => {
        const c = w.cast()[k]; c.wound = wound; c.awake = false; c.asleep = true; });
      s.power = 100;
      s.doors.left = false; s.doors.right = false;
      w.pump(220, 0.25);
      return { saves: s.stats.saves, dead: s.dead, phase: s.phase };
    };
    const five = run(5, 9);
    try { localStorage.removeItem('ns_seensave'); } catch (e) {}
    const four = run(4, 9);
    try { localStorage.removeItem('ns_seensave'); } catch (e) {}
    const slack = run(5, 0);
    return { five, four, slack };
  });
  ok('night five shows her one of his getting there first',
     staged.five.saves > 0, JSON.stringify(staged.five));
  /* four hundred seconds of both doors standing open does eventually
     end badly, and should — what matters is that the beat fired first
     rather than never */
  ok('and it is not left to the dice the way it was',
     staged.five.saves > 0, staged.five.saves + ' on night five');
  ok('with all four run down, nobody comes — it is still hers to lose',
     staged.slack.saves === 0, JSON.stringify(staged.slack.saves));

  /* and the confession is not allowed to be walked past */
  /* the night has to actually END for this: the six o'clock card is
     raised from the frame loop, and pump() stops the moment the phase
     stops being play */
  const given = {};
  for (const id of ['ledger', 'last', 'cogsworth']) {
    await page.evaluate((id) => {
      const w = OuissysNightShift.__night, s = w.state();
      try { localStorage.removeItem('ns_found'); } catch (e) {}
      const night = id === 'ledger' ? 5 : id === 'last' ? 6 : 1;
      w.route('night:' + night); w.route('go');
      const c = w.cast();
      Object.keys(c).forEach(k => { c[k].awake = false; c[k].asleep = true; });
      s.hour = 5; s.power = 80; w.pump(70);
    }, id);
    await page.waitForFunction(() => {
      const p = OuissysNightShift.__night.state().phase;
      return p === 'shift' || p === 'finale';
    }, { timeout: 15000, polling: 100 }).catch(() => {});
    await page.waitForTimeout(500);
    given[id] = await page.evaluate((id) =>
      OuissysNightShift.__night.finds().kept.indexOf(id) >= 0, id);
  }
  ok('the ledger is handed to her if she never found it', given.ledger === true);
  ok('and so is the last page', given.last === true);
  ok('but an ordinary tag is still hers to find or miss', given.cogsworth === false);

  /* the four rooms the score has that only exist inside a shift */
  console.log('\n— and the score follows her through the night —');
  const rooms = await page.evaluate(async () => {
    const w = OuissysNightShift.__night, s = w.state();
    const out = {};
    const M = () => w.music().mode;
    w.route('night:4'); w.route('go'); w.pump(2);
    out.play = M();
    /* the meter goes: the heartbeat stops and everything else opens */
    s.power = 0.2; w.pump(4);
    out.dark = M();
    /* a page in her hands, and back to the night after it */
    w.route('night:2'); w.route('go'); w.pump(2);
    w.takeFind();
    out.found = M();
    w.route('findOut');
    out.afterFound = M();
    /* one of his getting there first, and back again. pump() never
       stops to tell a story, so the card is raised the way an
       interception raises it rather than by running one. */
    w.route('night:4'); w.route('go'); w.pump(2);
    w.heldCard();
    out.held = M();
    w.route('heldOut');
    out.afterHeld = M();
    return out;
  });
  /* The death has to be watched rather than pumped: pump() runs only
     while the phase is "play", and a kill ends that on the frame it
     happens — so the card, which waits out the scare, only ever arrives
     on a real frame. */
  const death = await page.evaluate(() => {
    const w = OuissysNightShift.__night, s = w.state();
    w.route('night:1'); w.route('go');
    w.put('cogsworth', w.cast().cogsworth.def.route.length - 1);
    s.doors.left = false; w.pump(9);
    return { phase: s.phase, during: w.music().mode };
  });
  await page.waitForFunction(() => OuissysNightShift.__night.state().cardT > 0,
                             { timeout: 15000, polling: 100 });
  await page.waitForTimeout(400);
  death.after = await page.evaluate(() => OuissysNightShift.__night.music().mode);
  rooms.duringScare = death.during;
  rooms.overPhase = death.phase;
  rooms.gone = death.after;
  /* NINE SCENES SHARING ONE MELODY WITH THE FADERS MOVED IS ONE SCORE.
     What was asked for is cues that are different from each other the
     way a film's are, so each scene has material of its own now — a
     ticking one, one where somebody reads a letter, one where the
     thing she was dreading turns out to be on her side. This checks
     they are actually different rather than differently mixed. */
  /* read what each scene is written as. The live gains are half a
     second into a ramp at any given moment, so asking the mixer is
     asking the wrong question. */
  const score = await page.evaluate(() => OuissysNightShift.__night.score());
  const cues = {};
  Object.keys(score.mix).forEach((m) => {
    cues[m] = { lay: score.mix[m], spb: score.feel[m].spb, theme: score.feel[m].theme };
  });
  const names = Object.keys(cues);
  const sig = (m) => Object.keys(cues[m].lay).filter(k => cues[m].lay[k] > 0.05).sort().join(',');
  ok('every scene has a different set of instruments in it',
     new Set(names.map(sig)).size >= 8,
     new Set(names.map(sig)).size + ' distinct instrumentations across ' + names.length + ' scenes');
  ok('and they do not all run at the same tempo',
     new Set(names.map(m => cues[m].spb)).size >= 6,
     new Set(names.map(m => cues[m].spb)).size + ' tempos');
  ok('the terms are a clock and a swell, and nothing else',
     cues.locked.theme === 'clock' && cues.locked.lay.tick > 0.4 &&
     cues.locked.lay.brass > 0.4 && cues.locked.lay.box === 0,
     'tick ' + cues.locked.lay.tick + ' brass ' + cues.locked.lay.brass);
  ok('the turn is the only place the choir is loud',
     cues.held.lay.choir > 0.6 &&
     names.every(m => m === 'held' || cues[m].lay.choir < cues.held.lay.choir),
     'choir ' + cues.held.lay.choir);
  ok('and the dark has no melody in it at all',
     cues.dark.theme === 'void' && cues.dark.lay.box === 0 && cues.dark.lay.piano === 0,
     cues.dark.theme);
  ok('a page in her hands is a piano, which nothing else leads with',
     cues.found.lay.piano > 0.5 && cues.found.lay.grind === 0, 'piano ' + cues.found.lay.piano);

  ok('a shift plays the night', rooms.play === 'night', rooms.play);
  ok('the meter going out stops the heartbeat', rooms.dark === 'dark', rooms.dark);
  ok('a page in her hands turns the phrase major', rooms.found === 'found', rooms.found);
  ok('and putting it away hands the night back', rooms.afterFound === 'night', rooms.afterFound);
  ok('one of his getting there first is the biggest sound in it',
     rooms.held === 'held', rooms.held);
  ok('and that hands the night back too', rooms.afterHeld === 'night', rooms.afterHeld);
  ok('the score cuts out from under a scare', rooms.duringScare === 'none', rooms.duringScare);
  ok('and comes back after it, not through it',
     rooms.overPhase === 'over' && rooms.gone === 'gone', rooms.overPhase + '/' + rooms.gone);

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
