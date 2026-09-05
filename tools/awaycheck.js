/* THE WHOLE SITE GOES QUIET, NOT JUST THE ONE CHAPTER.
   Every chapter that makes a noise puts its context on the site
   register; leaving the page has to stop all of them, and a scene that
   is still ticking in a window you have left must not wake them up
   again by playing a sound into them. */
const { chromium } = require('playwright-core');
let pass = 0, fail = 0;
const ok = (n, c, x) => { if (c) { pass++; console.log('  ok   ' + n); }
                          else { fail++; console.log('  FAIL ' + n + (x ? '  ' + JSON.stringify(x) : '')); } };

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--use-gl=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--no-sandbox',
           '--autoplay-policy=no-user-gesture-required'] });
  const p = await b.newPage({ viewport: { width: 1100, height: 700 } });
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(() => {
    window.__ctxs = [];
    const AC = window.AudioContext;
    window.AudioContext = function () { const c = new AC(); window.__ctxs.push(c); return c; };
    window.AudioContext.prototype = AC.prototype;
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => !!window.__hidden });
    Object.defineProperty(document, 'visibilityState',
      { configurable: true, get: () => (window.__hidden ? 'hidden' : 'visible') });
  });
  await p.goto('http://localhost:8899/index.html', { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(500);

  for (const chap of ['race', 'super']) {
    await p.evaluate((which) => {
      document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
      if (which === 'race') {
        const s = document.getElementById('screen-race') || document.getElementById('screen-racing');
        if (s) s.classList.add('active');
        window.SuperOuissyRace.start();
      } else {
        const s = document.getElementById('screen-super');
        if (s) s.classList.add('active');
        window.SuperOuissy.start();
      }
    }, chap);
    await p.waitForTimeout(1200);
    /* a gesture, so the context is unlocked and running */
    await p.evaluate(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', bubbles: true }));
      document.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    });
    await p.waitForTimeout(700);
    const live = await p.evaluate(() => window.__ctxs.map(c => c.state));
    ok(chap + ': it is making a noise', live.some(s => s === 'running'), live);

    const gone = await p.evaluate(async () => {
      window.__hidden = true;
      document.dispatchEvent(new Event('visibilitychange'));
      window.dispatchEvent(new Event('blur'));
      await new Promise(r => setTimeout(r, 400));
      /* a scene still ticking makes a sound into a context we put down */
      for (let i = 0; i < 30; i++) {
        try { if (window.SuperOuissy && SuperOuissy.step) SuperOuissy.step(1 / 60); } catch (e) {}
      }
      await new Promise(r => setTimeout(r, 600));
      return { states: window.__ctxs.map(c => c.state), flag: typeof window.audioAsleep === 'function' ? window.audioAsleep() : null };
    });
    ok(chap + ': leaving the page stops every one of them',
       gone.states.every(s => s !== 'running'), gone);
    ok(chap + ': and the site knows it put them down', gone.flag === true, gone);

    const back = await p.evaluate(async () => {
      window.__hidden = false;
      document.dispatchEvent(new Event('visibilitychange'));
      window.dispatchEvent(new Event('focus'));
      await new Promise(r => setTimeout(r, 900));
      return { states: window.__ctxs.map(c => c.state), flag: typeof window.audioAsleep === 'function' ? window.audioAsleep() : null };
    });
    ok(chap + ': and coming back starts them again',
       back.states.some(s => s === 'running'), back);
    ok(chap + ': the site knows they are up', back.flag === false, back);
  }

  /* ---- AND THE CONTROL THAT WAS BEING HELD WHEN YOU LEFT ----
     The slide steering claims the touch it started on and refuses a new
     one while it holds it. Lift that thumb in another app and the
     touchend goes to the app, not to us: the zone holds a dead touch
     for ever and steering never works again. */
  await p.evaluate(() => {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const s = document.getElementById('screen-race') || document.getElementById('screen-racing');
    if (s) s.classList.add('active');
    window.SuperOuissyRace.start();
  });
  await p.waitForTimeout(1000);
  const steer = await p.evaluate(async () => {
    const zone = document.getElementById('rc-steer') ||
                 document.querySelector('[id*="steer"]');
    if (!zone) return { missing: true };
    const touch = (x) => new TouchEvent('touchstart', {
      bubbles: true, cancelable: true,
      changedTouches: [new Touch({ identifier: 7, target: zone, clientX: x, clientY: 300 })] });
    zone.dispatchEvent(touch(400));
    const held = zone.dataset.on;
    /* away, and the finger comes off somewhere we never hear about */
    window.__hidden = true;
    document.dispatchEvent(new Event('visibilitychange'));
    window.dispatchEvent(new Event('blur'));
    await new Promise(r => setTimeout(r, 300));
    const after = zone.dataset.on;
    window.__hidden = false;
    document.dispatchEvent(new Event('visibilitychange'));
    window.dispatchEvent(new Event('focus'));
    await new Promise(r => setTimeout(r, 300));
    zone.dispatchEvent(touch(420));
    return { held, after, again: zone.dataset.on };
  });
  ok('the steering takes a thumb', steer.held === '1', steer);
  ok('leaving lets go of it', steer.after === '0', steer);
  ok('and it takes a new one when you come back', steer.again === '1', steer);

  ok('no page errors from any of it', errs.length === 0, errs.slice(0, 3));
  console.log('');
  console.log(pass + ' passed, ' + fail + ' failed');
  await b.close();
  process.exit(fail ? 1 : 0);
})();
