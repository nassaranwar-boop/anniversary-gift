/* THE CONTROLS, PRESSED.

   Every suite here drove the game through __apKey, which sets the key
   the game reads directly — so USE and CREEP could be completely
   unwired and every one of them still passed. This one touches the
   actual buttons in the actual document, the way a thumb does, and
   asks the game what happened. It also measures where the controls sit
   against everything else on screen, because a pause button on top of
   the creep button is a bug you can only see by looking. */
const { chromium } = require('playwright-core');
let pass = 0, fail = 0;
const ok = (n, c, x) => { if (c) { pass++; console.log('  ok   ' + n); }
                          else { fail++; console.log('  FAIL ' + n + (x ? '  ' + JSON.stringify(x) : '')); } };
const hit = (a, b) => !(a.bottom <= b.top || b.bottom <= a.top ||
                        a.right <= b.left || b.right <= a.left);
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--use-gl=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--no-sandbox'] });
  const p = await b.newPage({ viewport: { width: 1024, height: 768 }, hasTouch: true, isMobile: false });
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
  await p.evaluate(() => { window.__apLoop(false); window.__apQuality(2); window.__apEnter(0); window.__apSkipDialogue(); });
  await p.waitForTimeout(300);

  /* ---- 1. they exist where the code that binds them looks ---- */
  const where = await p.evaluate(() => {
    const stage = document.getElementById('ap-stage');
    const touch = document.getElementById('ap-touch');
    const a = stage.getBoundingClientRect(), b = touch.getBoundingClientRect();
    return { keyed: document.getElementById('screen-apoc').querySelectorAll('[data-ap-key]').length,
             /* they line up with the picture, which is why they live
                inside it; what must never come back is a full-size layer
                that FADES, which is what cost the frame */
             dx: Math.abs(a.left - b.left), dy: Math.abs(a.top - b.top),
             dw: Math.abs(a.width - b.width), dh: Math.abs(a.height - b.height) };
  });
  ok('the buttons are where the binder looks', where.keyed >= 2, where);
  ok('and the controls lie exactly over the picture',
     where.dx <= 1 && where.dy <= 1 && where.dw <= 1 && where.dh <= 1, where);
  /* The one thing that must never come back: a box the size of the
     picture that fades or moves. That is a compositing layer over the
     canvas, and this environment has now been bitten by one three times
     — backdrop-filter, a mask on a scrolling list, and this. A named
     transition property is fine as long as nothing is ever animated
     through it, so what is measured is the duration. */
  const layer = await p.evaluate(() => {
    const t = document.getElementById('ap-touch');
    const cs = getComputedStyle(t);
    return { op: cs.opacity, dur: cs.transitionDuration, anim: cs.animationName,
             filt: cs.filter, tf: cs.transform };
  });
  ok('and the full-size box itself never fades or moves',
     layer.op === '1' && /^0s(,\s*0s)*$/.test(layer.dur) &&
     (layer.anim === 'none' || !layer.anim) &&
     (layer.filt === 'none' || !layer.filt) &&
     (layer.tf === 'none' || !layer.tf), layer);

  /* ---- 2. the buttons are actually wired ---- */
  const wired = await p.evaluate(() => {
    const t = el => {
      const r = el.getBoundingClientRect();
      const pt = { identifier: 1, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2, target: el };
      return pt;
    };
    const fire = (el, type) => {
      const ev = new TouchEvent(type, { bubbles: true, cancelable: true,
        touches: type === 'touchend' ? [] : [new Touch(t(el))],
        changedTouches: [new Touch(t(el))] });
      el.dispatchEvent(ev);
    };
    const use = document.querySelector('[data-ap-key="use"]');
    const creep = document.querySelector('[data-ap-key="sneak"]');
    const out = { bound: { use: !!use.__bound, creep: !!creep.__bound } };

    /* CREEP is a hold: down, she creeps; up, she stops */
    fire(creep, 'touchstart');
    for (let i = 0; i < 8; i++) window.__apPump(1 / 60);
    out.creeping = window.Apocalypse.game.player.creeping;
    out.lit = creep.classList.contains('on');
    fire(creep, 'touchend');
    for (let i = 0; i < 8; i++) window.__apPump(1 / 60);
    out.stopped = window.Apocalypse.game.player.creeping;

    /* USE opens whatever she is standing at */
    const W = window.Apocalypse.game.world;
    window.__apTeleport(W.tvAt.x, W.tvAt.y + 1);
    for (let i = 0; i < 8; i++) window.__apPump(1 / 60);
    const before = window.__apState().state;
    /* The first press after a conversation ends is swallowed on purpose —
       that is the fix for the television loop. A thumb presses again. */
    for (let n = 0; n < 4 && window.__apState().state === 'play'; n++) {
      fire(use, 'touchstart');
      window.__apPump(1 / 60);
      fire(use, 'touchend');
      for (let i = 0; i < 8; i++) window.__apPump(1 / 60);
    }
    out.before = before;
    out.after = window.__apState().state;
    out.talking = !!window.__apState().dialogue;
    /* the set puts the broadcast up first: that is an overlay, and the
       conversation follows it */
    out.opened = out.after !== 'play';
    return out;
  });
  ok('both buttons are bound', wired.bound.use && wired.bound.creep, wired.bound);
  ok('holding CREEP makes her creep', wired.creeping === true, wired);
  ok('and it lights up while it is held', wired.lit === true, wired);
  ok('letting go stops her', wired.stopped === false, wired);
  ok('pressing USE at the television turns it on',
     wired.before === 'play' && wired.opened, wired);

  /* ---- 3. nothing is sitting on top of anything else ---- */
  await p.evaluate(() => { window.__apClear(); window.__apSkipDialogue(); });
  await p.waitForTimeout(200);
  const boxes = await p.evaluate(() => {
    /* show the controls the way a thumb would */
    const stage = document.getElementById('ap-stage');
    const r = stage.getBoundingClientRect();
    const pt = { identifier: 9, clientX: r.left + r.width * 0.2, clientY: r.top + r.height * 0.7 };
    stage.dispatchEvent(new TouchEvent('touchstart', { bubbles: true, cancelable: true,
      touches: [new Touch({ ...pt, target: stage })], changedTouches: [new Touch({ ...pt, target: stage })] }));
    const g = id => { const e = document.getElementById(id) || document.querySelector(id);
                      return e ? e.getBoundingClientRect().toJSON() : null; };
    /* the map button only exists once she has the atlas; when it is not
       showing, read where it WOULD be from the stylesheet instead */
    const mb = document.getElementById('ap-map-btn');
    const wasHidden = mb.style.display === 'none';
    if (wasHidden) mb.style.display = '';
    const mr = mb.getBoundingClientRect();
    const out = { mapTop: mr.top - r.top, mapRight: r.right - mr.right };
    if (wasHidden) mb.style.display = 'none';
    return { ...out, stage: r.toJSON(), pause: g('ap-pause-btn'), map: mr.toJSON(),
             compass: g('ap-compass'), use: g('[data-ap-key="use"]'),
             creep: g('[data-ap-key="sneak"]'), hud: g('.ap-hud-right') };
  });
  ok('the pause button is in the top right',
     boxes.pause.top - boxes.stage.top < boxes.stage.height * 0.25 &&
     boxes.stage.right - boxes.pause.right < boxes.stage.width * 0.12, boxes.pause);
  ok('the map button is with it, not on the controls',
     boxes.mapTop < boxes.stage.height * 0.35 &&
     boxes.mapRight < boxes.stage.width * 0.12, { mapTop: boxes.mapTop, mapRight: boxes.mapRight });
  ok('pause does not sit on creep', !hit(boxes.pause, boxes.creep), boxes);
  ok('nor on use', !hit(boxes.pause, boxes.use), boxes);
  ok('the map does not sit on either',
     !hit(boxes.map, boxes.creep) && !hit(boxes.map, boxes.use), boxes);
  ok('the compass is clear of both buttons',
     !hit(boxes.compass, boxes.pause) && !hit(boxes.compass, boxes.map), boxes);
  ok('and clear of the controls',
     !hit(boxes.compass, boxes.use) && !hit(boxes.compass, boxes.creep), boxes);
  ok('the readout is clear of the buttons',
     !hit(boxes.hud, boxes.pause) && !hit(boxes.hud, boxes.map), boxes);
  ok('use and creep are not on top of each other', !hit(boxes.use, boxes.creep), boxes);
  ok('both are inside the picture',
     boxes.use.right <= boxes.stage.right + 1 && boxes.use.bottom <= boxes.stage.bottom + 1 &&
     boxes.creep.left >= boxes.stage.left - 1, boxes);

  /* ---- 4. hidden controls do not swallow taps ---- */
  const hidden = await p.evaluate(() => {
    window.__apTouchUI(false);
    const use = document.querySelector('[data-ap-key="use"]');
    const r = use.getBoundingClientRect();
    const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return { swallows: !!(top && top.closest && top.closest('.ap-actions')) };
  });
  ok('controls that are not showing do not catch taps', !hidden.swallows, hidden);

  ok('no page errors from any of it', errs.length === 0, errs.slice(0, 3));
  console.log('');
  console.log(pass + ' passed, ' + fail + ' failed');
  await b.close();
  process.exit(fail ? 1 : 0);
})();
