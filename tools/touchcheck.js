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

  /* ---- 5. a thumb on a line of dialogue turns the page ----
     The joystick owned the whole left half of the picture and took the
     touch with preventDefault, which cancels the click the dialogue box
     was listening for. So on a tablet the line never advanced and the
     stick jumped instead — under the very text you were trying to
     read. */
  await p.evaluate(() => { window.__apClear(); window.__apCampsite(); });
  await p.waitForTimeout(400);
  const dlgTap = await p.evaluate(() => {
    const G = window.Apocalypse.game;
    return { showing: !!G.dlg, at: G.dlg ? G.dlg.i : -1 };
  });
  ok('the house opens in a conversation', dlgTap.showing, dlgTap);
  const box = await p.evaluate(() => {
    const d = document.getElementById('ap-dlg').getBoundingClientRect();
    return { x: d.left + d.width / 2, y: d.top + d.height / 2, w: d.width };
  });
  /* raw touch, with no synthetic click behind it: this is exactly what
     the browser delivers once something has called preventDefault, and
     it is the case the joystick was breaking */
  await p.evaluate(pt => {
    const d = document.getElementById('ap-dlg');
    const mk = (type, x, y) => {
      const t = new Touch({ identifier: 7, target: d, clientX: x, clientY: y });
      return new TouchEvent(type, { touches: type === 'touchend' ? [] : [t],
        changedTouches: [t], targetTouches: type === 'touchend' ? [] : [t],
        bubbles: true, cancelable: true });
    };
    d.dispatchEvent(mk('touchstart', pt.x, pt.y));
    d.dispatchEvent(mk('touchend', pt.x, pt.y));
  }, box);
  await p.waitForTimeout(120);
  const after = await p.evaluate(() => {
    const G = window.Apocalypse.game;
    return { at: G.dlg ? G.dlg.i : 999,
             stick: document.getElementById('ap-stick').classList.contains('live'),
             keys: window.__apKeys ? window.__apKeys() : null };
  });
  ok('tapping the line turns the page', after.at > dlgTap.at, { before: dlgTap, after });
  ok('and does not pick the joystick up under it', !after.stick, after);

  /* ---- 6. the wire panel, under a finger ----
     pos() read e.touches[0], and on a touchend that list is empty — the
     finger it is telling you about is in changedTouches. So the drop
     threw every time and the core sprang back: the panel could only be
     solved with a mouse. */
  const panel = await p.evaluate(() => {
    window.__apClear();
    window.__apEnter(2);                       /* the hospital has one */
    return !!window.Apocalypse.game;
  });
  await p.evaluate(() => {
    const w = window.Apocalypse.game.world;
    window.__apTeleport(w.panelAt.x, w.panelAt.y + 1);
  });
  await p.evaluate(() => { for (let i = 0; i < 20; i++) window.__apPump(1 / 60); });
  await p.evaluate(() => window.__apUse());
  await p.waitForTimeout(300);
  const geom = await p.evaluate(() => {
    const cv = document.querySelector('.ap-panel-canvas');
    if (!cv) return null;
    const r = cv.getBoundingClientRect();
    const s = r.width / cv.width;
    return { r: { x: r.left, y: r.top }, s: s, w: cv.width, h: cv.height,
             order: window.__apPanelOrder ? window.__apPanelOrder() : null };
  });
  ok('the distribution board is up', !!geom, geom);
  if (geom && geom.order) {
    /* drag every core across with touch events only */
    for (let core = 0; core < 4; core++) {
      const socket = geom.order.order.indexOf(core);
      const from = { x: geom.r.x + geom.order.wx * geom.s, y: geom.r.y + geom.order.wy[core] * geom.s };
      const to = { x: geom.r.x + geom.order.sx * geom.s, y: geom.r.y + geom.order.sy[socket] * geom.s };
      await p.evaluate(pts => {
        const cv = document.querySelector('.ap-panel-canvas');
        const mk = (type, x, y, target) => {
          const t = new Touch({ identifier: 1, target: target, clientX: x, clientY: y });
          return new TouchEvent(type, { touches: type === 'touchend' ? [] : [t],
            changedTouches: [t], targetTouches: type === 'touchend' ? [] : [t],
            bubbles: true, cancelable: true });
        };
        cv.dispatchEvent(mk('touchstart', pts.from.x, pts.from.y, cv));
        window.dispatchEvent(mk('touchmove', (pts.from.x + pts.to.x) / 2, (pts.from.y + pts.to.y) / 2, cv));
        window.dispatchEvent(mk('touchmove', pts.to.x, pts.to.y, cv));
        window.dispatchEvent(mk('touchend', pts.to.x, pts.to.y, cv));
      }, { from, to });
      await p.waitForTimeout(60);
    }
    const solved = await p.evaluate(() => window.__apPanelDone());
    ok('every core can be dragged home with a finger', solved === 4, solved);
  }

  /* ---- 7. every button in the left half of the picture ----
     The joystick's touchstart handler called preventDefault on anything
     in the left half below the HUD, and preventing a touchstart is what
     stops the browser synthesising a click. So on a tablet, half of
     every card, every overlay button, the fridge, the keypad and the
     intake sheet were simply dead: nothing wrong with the buttons, the
     joystick was eating the tap on its way past. */
  await p.waitForTimeout(900);            /* the solved panel closes itself first */
  await p.evaluate(() => { window.__apClear(); window.__apEnter(2); });
  await p.evaluate(() => {
    const w = window.Apocalypse.game.world;
    window.__apTeleport(w.panelAt.x, w.panelAt.y + 1);
  });
  await p.evaluate(() => { for (let i = 0; i < 20; i++) window.__apPump(1 / 60); });
  await p.evaluate(() => window.__apUse());
  await p.waitForTimeout(300);
  const leftHalf = await p.evaluate(() => {
    const stage = document.getElementById('ap-stage').getBoundingClientRect();
    const b = document.querySelector('.ap-panel-leave');
    if (!b) return null;
    const r = b.getBoundingClientRect();
    return { x: r.left + r.width * 0.18, y: r.top + r.height / 2,
             inLeft: (r.left + r.width * 0.18 - stage.left) < stage.width * 0.48,
             belowHud: (r.top - stage.top) > stage.height * 0.24,
             r: { l: Math.round(r.left), t: Math.round(r.top), w: Math.round(r.width) },
             stage: { l: Math.round(stage.left), t: Math.round(stage.top),
                      w: Math.round(stage.width), h: Math.round(stage.height) } };
  });
  ok('the step-back button sits where the joystick used to swallow taps',
     leftHalf && leftHalf.inLeft && leftHalf.belowHud, leftHalf);
  /* Whether the browser will turn a tap into a click comes down to one
     thing: did anybody call preventDefault on the touchstart. That is
     the property to assert, rather than hoping the harness synthesises
     a click the way a phone would. */
  const prevented = await p.evaluate(() => {
    function tapAt(sel) {
      const el = document.querySelector(sel);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      const t = new Touch({ identifier: 3, target: el,
                            clientX: r.left + r.width * 0.18, clientY: r.top + r.height / 2 });
      const ev = new TouchEvent('touchstart', { touches: [t], changedTouches: [t],
        targetTouches: [t], bubbles: true, cancelable: true });
      el.dispatchEvent(ev);
      const stuck = document.getElementById('ap-stick').classList.contains('live');
      document.getElementById('ap-stick').classList.remove('live');
      return { prevented: ev.defaultPrevented, stick: stuck };
    }
    return { leave: tapAt('.ap-panel-leave'), canvas: tapAt('.ap-panel-canvas') };
  });
  ok('a thumb on step-back is left alone by the joystick',
     prevented.leave && !prevented.leave.prevented && !prevented.leave.stick, prevented.leave);
  ok('and the panel itself is the panel\'s, not the joystick\'s',
     prevented.canvas && !prevented.canvas.stick, prevented.canvas);
  const beats = await p.evaluate(() => window.__apFaults());
  ok('no story beat threw on its way past', beats.length === 0, beats.slice(0, 3));

  ok('no page errors from any of it', errs.length === 0, errs.slice(0, 3));
  console.log('');
  console.log(pass + ' passed, ' + fail + ' failed');
  await b.close();
  process.exit(fail ? 1 : 0);
})();
