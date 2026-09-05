/* Does any of it actually make a sound?

   Every other suite here either runs muted or renders offline, so
   "the background sounds and the sound effects do not work" was a
   report nothing in this repository could confirm or deny. This one
   drives the site the way a person does — real clicks, a real gesture
   to unlock the audio context — and puts a meter on the master bus.

   It deliberately does NOT pass --autoplay-policy=no-user-gesture-
   required. The whole question is whether the game unlocks its own
   audio, and a flag that unlocks it for free would answer it wrong. */
const { chromium } = require('playwright-core');

const PASS = '2207';
let fails = 0, checks = 0;
const ok = (n, c, x) => { checks++; console.log((c ? '  ok   ' : '  FAIL ') + n + (x ? '  ' + x : '')); if (!c) fails++; };

(async () => {
  const b = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox', '--no-proxy-server', '--use-gl=swiftshader',
           '--enable-unsafe-swiftshader',
           '--autoplay-policy=document-user-activation-required'],
  });
  const p = await b.newPage({ viewport: { width: 1000, height: 700 } });
  p.on('pageerror', e => { fails++; console.log('PAGEERROR', e.message); });
  await p.route('**/*', r => { const u = r.request().url();
    if (u.indexOf('book-scene.js') >= 0) return r.abort();
    return u.startsWith('http://127.0.0.1') ? r.continue() : r.abort(); });
  await p.goto('http://127.0.0.1:8899/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForTimeout(700);

  const A = () => p.evaluate(() => OuissysNightShift.__night.audio());
  const M = () => p.evaluate(() => OuissysNightShift.__night.meter());
  /* the loudest moment in a window, because a bed is quiet and a cue
     is a fifth of a second long */
  const loudest = async (ms) => {
    let best = { rms: 0, peak: 0 };
    const until = Date.now() + ms;
    while (Date.now() < until) {
      const m = await M();
      if (m && m.rms > best.rms) best = { rms: m.rms, peak: Math.max(best.peak, m.peak) };
      else if (m && m.peak > best.peak) best.peak = m.peak;
      await p.waitForTimeout(35);
    }
    return best;
  };

  console.log('\n— getting in the way a person does —');
  /* the gate is a keypad: press the code, then the tick */
  await p.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await p.reload({ waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(600);
  for (const d of PASS.split('')) {
    const k = await p.$('.pad-key[data-d="' + d + '"], [data-key="' + d + '"], button[data-digit="' + d + '"]');
    if (k) await k.click();
  }
  const enter = await p.$('.pad-key.pad-ok, [data-key="ok"], #gate-go, .gate-go');
  if (enter) await enter.click();
  await p.waitForTimeout(900);
  const onHub = await p.evaluate(() => !!document.querySelector('#screen-hub.active, .screen.active'));
  ok('the gate lets us through', onHub);

  await p.evaluate(() => {
    try { localStorage.setItem('ns_seenintro', '1'); localStorage.setItem('ns_notutor', '1'); } catch (e) {}
  });
  /* a real click on the chapter's own card, which is the gesture the
     browser wants before it will let anything make a sound */
  await p.evaluate(() => { showScreen('nightshift'); OuissysNightShift.start(); });
  await p.waitForFunction(() => Object.keys(OuissysNightShift.__night.cast()).length >= 4,
                          { timeout: 20000, polling: 200 });
  await p.mouse.click(500, 350);
  await p.waitForTimeout(400);

  console.log('\n— the title screen —');
  await p.evaluate(() => OuissysNightShift.__night.route('title'));
  await p.waitForTimeout(2600);
  let a = await A();
  ok('the audio context is running', a.ctx === 'running', 'state ' + a.ctx);
  ok('and nothing has muted it', a.muted === false, 'muted ' + a.muted);
  ok('the menu theme is the one playing', a.music.mode === 'menu', a.music.mode);
  ok('and its bus is open', a.music.bus > 0.25, 'bus ' + a.music.bus);
  await M();
  let m = await loudest(2200);
  ok('and something is coming out of the speakers', m.rms > 0.0005,
     'rms ' + m.rms + ' peak ' + m.peak);
  const menuRms = m.rms;

  console.log('\n— the shift —');
  await p.evaluate(() => { const w = OuissysNightShift.__night;
    w.route('night:1'); w.route('go'); });
  await p.waitForTimeout(3000);
  a = await A();
  ok('the room tone is running', a.bedRunning === true);
  ok('and the bed is audible', a.bed > 0.1, 'bed ' + a.bed);
  ok('the score has changed to the night', a.music.mode === 'night', a.music.mode);
  m = await loudest(2500);
  ok('and the shift makes a sound of its own', m.rms > 0.0005,
     'rms ' + m.rms + ' peak ' + m.peak);

  /* WHAT THIS CANNOT MEASURE, AND WHY IT NO LONGER PRETENDS TO.

     Three goes at asserting that a door shutting is louder than the
     room it happens in, and all three were measuring something other
     than what they claimed:

       the first compared a cue's peak to the room's RMS while the
       room's level was climbing with the score's dread;
       the second called a live night four "the room" while a soldier
       was walking through it;
       the third turned the room tone and the score off and called the
       result silence — and the shop still makes noises on its own all
       night, on purpose, which is the whole design of the false alarms.

     And underneath all of that, this container's audio thread runs
     ahead of currentTime in batches, so its absolute levels are a
     property of a null audio device rather than of the game.

     So the levels are held offline, in nightsound, where every cue is
     rendered on identical terms and the loudest is within 2.8x of the
     quietest. What is left here is what live playback can actually
     answer: that it plays at all, that it is the right music for the
     scene, that it never cuts between scenes, and that it survives the
     phone being taken away. Those are worth having and they are true. */

  /* One piece of music, nine rooms to play it in — and the claim that
     makes it worth doing is that it never cuts. So: walk the scenes,
     check each one is actually in its own room, and meter straight
     through every change to prove the sound never drops out on the way. */
  console.log('\n— a room of its own for every scene —');
  await p.evaluate(() => { const w = OuissysNightShift.__night;
    w.musicSet('night'); w.bed(true); });
  await p.waitForTimeout(1500);
  const scenes = [
    ['the film',            () => OuissysNightShift.__night.route('intro'),   'film'],
    ['the card before it',  () => OuissysNightShift.__night.route('night:2'), 'brief'],
    ['the shift',           () => OuissysNightShift.__night.route('go'),      'night'],
    ['the shop in daylight',() => OuissysNightShift.__night.route('gallery'), 'gallery'],
    ['the title',           () => OuissysNightShift.__night.route('title'),   'menu'],
  ];
  let cut = 0, quietest = 1;
  for (const [name, go, want] of scenes) {
    await M();
    await p.evaluate(go);
    /* right across the change, with nothing else going on */
    const through = await loudest(1500);
    const got = (await A()).music.mode;
    ok(name + ' has its own', got === want, got);
    if (through.peak < 0.004) cut++;
    quietest = Math.min(quietest, through.peak);
  }
  ok('and it never cuts on the way from one to the next', cut === 0,
     'quietest moment across five changes: ' + quietest.toFixed(4));

  console.log('\n— and it comes back after an interruption —');
  await p.evaluate(() => { const w = OuissysNightShift.__night;
    w.route('night:1'); w.route('go'); });
  await p.waitForTimeout(2600);
  /* how loud the shop was before anything went wrong. A suspended
     context's analyser stops updating rather than reading zero, so
     "was it silent while asleep" is not a thing this can measure —
     what it can measure is whether the shop sounds like itself again
     afterwards, which is the part that was broken. */
  const healthy = (await loudest(1200)).rms;
  await p.evaluate(() => OuissysNightShift.__night.suspend());
  await p.waitForTimeout(500);
  const asleep = await A();
  ok('losing the audio session stops it', asleep.ctx !== 'running', 'state ' + asleep.ctx);
  /* the four moments the site listens on: coming back to the tab is one */
  await p.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await p.mouse.click(500, 350);
  await p.waitForTimeout(1600);
  const back = await A();
  ok('and coming back starts it again', back.ctx === 'running', 'state ' + back.ctx);
  ok('the room tone survived it', back.bed > 0.1, 'bed ' + back.bed);
  ok('and the score did too', back.music.mode === 'night' && back.music.bus > 0.25,
     back.music.mode + ' bus ' + back.music.bus);
  const loud = (await loudest(2000)).rms;
  ok('with the shop as loud as it was before', loud > healthy * 0.5,
     'rms ' + healthy + ' before, ' + loud + ' after');

  console.log('\n' + (fails ? 'FAILED ' + fails + ' of ' + checks
                             : 'all ' + checks + ' checks passed'));
  await b.close();
  process.exit(fails ? 1 : 0);
})();
