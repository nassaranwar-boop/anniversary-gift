/* The two paths nothing else here has ever walked: a real touch pointer
   on a phone-sized screen, and KEYWIND played past its first frame.

   The winding key is the only control in the chapter that is a HOLD
   rather than a tap, which makes it the one most likely to be broken by
   a touch pointer, a scrolling gesture or a thumb that leaves the
   button. And the cabinet has only ever been opened and closed. */
const { chromium, devices } = require('playwright-core');

(async () => {
  const b = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox','--no-proxy-server','--use-gl=swiftshader','--enable-unsafe-swiftshader'],
  });
  let fails = 0, checks = 0;
  const ok = (n, c, x) => { checks++; if (!c) { fails++; console.log('  FAIL ' + n + (x ? '  ' + x : '')); }
                            else console.log('  ok   ' + n + (x ? '  ' + x : '')); };
  /* a real phone: touch pointer, coarse hover, small screen */
  const p = await b.newPage({ viewport: { width: 390, height: 844 },
                              isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  p.on('pageerror', e => { fails++; console.log('PAGEERROR', e.message); });
  await p.route('**/*', r => { const u = r.request().url();
    if (u.indexOf('book-scene.js') >= 0) return r.abort();
    return u.startsWith('http://127.0.0.1') ? r.continue() : r.abort(); });
  await p.goto('http://127.0.0.1:8899/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForTimeout(700);
  await p.evaluate(() => { const st = document.createElement('style');
    st.textContent = '.screen.anim-in{animation:none !important}'; document.head.appendChild(st);
    try{localStorage.clear();}catch(e){} localStorage.setItem('ns_seenintro','1');
    localStorage.setItem('ns_notutor','1');
    showScreen('nightshift'); OuissysNightShift.start(); });
  await p.waitForFunction(() => Object.keys(OuissysNightShift.__night.cast()).length >= 7,
                          { timeout: 25000, polling: 200 });
  await p.evaluate(() => { const w = OuissysNightShift.__night; w.silence(true);
    w.route('night:2'); w.route('go'); });
  await p.waitForTimeout(400);

  console.log('\n— the pad, under a thumb —');
  /* measured twice, because the camera arrows only exist while the
     monitor is up and measuring a hidden element gets you 0x0 and a
     failure that is the test's fault rather than the pad's */
  const measurePad = () => p.evaluate(() => {
    const out = {};
    document.querySelectorAll('#ns-pad [data-k]').forEach(el => {
      if (el.offsetParent === null) return;          // not on screen right now
      const r = el.getBoundingClientRect();
      if (r.width === 0) return;
      out[el.dataset.k] = [Math.round(r.width), Math.round(r.height)];
    });
    return out;
  });
  const padDown = await measurePad();
  await p.evaluate(() => { const w = OuissysNightShift.__night;
    if (!w.state().monitor) w.press('monitor'); });
  await p.waitForTimeout(400);
  const padUp = await measurePad();
  await p.evaluate(() => { const w = OuissysNightShift.__night;
    if (w.state().monitor) w.press('monitor'); });
  const all = Object.assign({}, padDown, padUp);
  const small = Object.entries(all).filter(([, s]) => s[0] < 40 || s[1] < 34);
  ok('every control is thumb sized', small.length === 0,
     small.length ? JSON.stringify(small) : Object.keys(all).length + ' controls, smallest ' +
       Math.min(...Object.values(all).map(v => Math.min(v[0], v[1]))) + 'px');
  ok('and the camera arrows appear with the monitor',
     padUp.prev !== undefined && padUp.next !== undefined && padDown.prev === undefined,
     'down: ' + Object.keys(padDown).join(',') + ' | up: ' + Object.keys(padUp).join(','));

  console.log('\n— winding, with a finger —');
  /* put one where she can see it and let it run down */
  await p.evaluate(() => {
    const w = OuissysNightShift.__night, s = w.state();
    const c = w.cast().cogsworth;
    c.awake = true; c.wound = 0.3; c.cool = 999;
    w.put('cogsworth', 0);
    if (!s.monitor) w.press('monitor');
    w.cam(c.room);
  });
  await p.waitForTimeout(1600);
  const key = await p.evaluate(() => {
    const el = document.getElementById('ns-key');
    const r = el.getBoundingClientRect();
    return { hidden: el.hidden, w: Math.round(r.width), h: Math.round(r.height),
             x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) };
  });
  ok('the key is on screen', key.hidden === false, JSON.stringify(key));
  ok('and big enough for a thumb', key.w >= 40 && key.h >= 40, key.w + 'x' + key.h);

  /* a real touch: down, hold, up */
  const before = await p.evaluate(() => OuissysNightShift.__night.wind().wound.cogsworth);
  await p.touchscreen.tap(key.x, key.y);          // a tap alone must not wind it
  await p.waitForTimeout(300);
  const afterTap = await p.evaluate(() => OuissysNightShift.__night.wind().wound.cogsworth);
  ok('a tap is not enough', afterTap < 3, 'wound ' + afterTap.toFixed(2));

  await p.evaluate(([x, y]) => {
    const el = document.getElementById('ns-key');
    el.dispatchEvent(new PointerEvent('pointerdown',
      { bubbles: true, cancelable: true, pointerType: 'touch', clientX: x, clientY: y }));
  }, [key.x, key.y]);
  await p.waitForTimeout(1900);
  const held = await p.evaluate(() => OuissysNightShift.__night.wind().wound.cogsworth);
  await p.evaluate(() => document.getElementById('ns-key')
    .dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerType: 'touch' })));
  ok('but a hold winds it', held > 6, 'wound ' + held.toFixed(2) + ' from ' + before.toFixed(2));

  /* and a thumb that slides off mid-hold must not keep winding */
  await p.evaluate(() => {
    const w = OuissysNightShift.__night;
    const c = w.cast().cogsworth; c.wound = 0.3;
    const el = document.getElementById('ns-key');
    el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, pointerType: 'touch' }));
    el.dispatchEvent(new PointerEvent('pointerleave', { bubbles: true, pointerType: 'touch' }));
  });
  await p.waitForTimeout(1900);
  const slid = await p.evaluate(() => OuissysNightShift.__night.wind().wound.cogsworth);
  ok('and letting go part way does not', slid < 3, 'wound ' + slid.toFixed(2));

  console.log('\n— KEYWIND, played properly —');
  const arc = await p.evaluate(async () => {
    const w = OuissysNightShift.__night, s = w.state();
    w.route('night:1'); w.route('go');
    if (!s.monitor) w.press('monitor');
    w.cam('arcade');
    await new Promise(r => setTimeout(r, 1500));
    const hot = document.getElementById('ns-egg');
    if (hot.hidden) return { opened: false };
    hot.click();
    await new Promise(r => setTimeout(r, 400));
    const cvs = document.querySelector('.ns-arc-cvs');
    /* drive it: hold right, then left, and let the spring run down */
    const press = (dir, ms) => new Promise((res) => {
      const el = document.querySelector('[data-arc="' + dir + '"]');
      el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true }));
      setTimeout(() => { el.dispatchEvent(new PointerEvent('pointerup', { bubbles: true })); res(); }, ms);
    });
    const shot = () => { const d = cvs.getContext('2d').getImageData(0, 0, cvs.width, cvs.height).data;
      let n = 0; for (let i = 3; i < d.length; i += 400) if (d[i] > 0) n++; return n; };
    const painted = shot();
    const spring0 = w.arcade().spring;
    for (let i = 0; i < 14; i++) { await press(i % 2 ? 'left' : 'right', 220); }
    const mid = w.arcade();
    /* the design claim is that the spring runs down however well you
       play, so a run always ends. That is the thing worth asserting —
       a best score only exists if she happened to catch a cog. */
    let guard = 0;
    while (!w.arcade().over && guard++ < 60) await new Promise(r => setTimeout(r, 700));
    const end = w.arcade();
    return { opened: true, phase: s.phase, painted, stillPainted: shot(),
             spring0, mid: mid.spring, end, waited: guard };
  });
  ok('the cabinet opens on camera three', arc.opened === true);
  ok('and it draws', arc.painted > 20, 'samples ' + arc.painted);
  ok('and it is still drawing after being played', arc.stillPainted > 20, 'samples ' + arc.stillPainted);
  ok('the spring runs down as she plays',
     arc.mid < arc.spring0, arc.spring0 + ' to ' + arc.mid);
  ok('and a run always ends, however well she plays',
     arc.end.over === true, 'after ' + arc.waited + ' checks, spring ' + arc.end.spring);
  await p.evaluate(() => OuissysNightShift.__night.route('arcadeOut'));
  await p.waitForTimeout(300);
  ok('and hands the shift back',
     await p.evaluate(() => OuissysNightShift.__night.state().phase) === 'play');

  /* THE BLIND SPOT IN EVERY OTHER CHECK HERE.

     All three of the monitor's hotspots — the winding key, a found
     page, the arcade cabinet — live inside .ns-mon, which is
     pointer-events:none so the tube does not eat the office behind it.
     A child of that has to turn pointer events back on for itself, and
     none of them did. Every one of them was painted, correct, and
     completely unreachable by a finger.

     Nothing caught it because the suites dispatch events onto the
     element, and dispatching skips hit testing entirely: it proves the
     handler works, not that anything can reach it. So this asks the
     document what is actually under the middle of each one. */
  console.log('\n— and can a finger actually reach them —');
  const reach = await p.evaluate(() => {
    const w = OuissysNightShift.__night, c = w.cast();
    w.route('night:2'); w.route('go');
    c.cogsworth.awake = true; c.cogsworth.wound = 0.4; c.cogsworth.cool = 999;
    ['chime','marabelle','jax'].forEach(k => { c[k].awake = false; c[k].asleep = true; });
    if (!w.state().monitor) w.press('monitor');
    w.cam(c.cogsworth.room);
    return true;
  });
  await p.waitForTimeout(1200);
  const under = await p.evaluate(() => {
    const out = {};
    ['ns-key', 'ns-find', 'ns-egg'].forEach((id) => {
      const el = document.getElementById(id);
      if (!el) { out[id] = 'missing'; return; }
      out[id] = getComputedStyle(el).pointerEvents;
    });
    const k = document.getElementById('ns-key');
    if (k && !k.hidden) {
      const r = k.getBoundingClientRect();
      const at = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      out.underTheRing = at ? (at.id || at.className) : null;
    }
    return out;
  });
  ok('the winding key takes a pointer', under['ns-key'] === 'auto', under['ns-key']);
  ok('so does a found page', under['ns-find'] === 'auto', under['ns-find']);
  ok('and so does the cabinet', under['ns-egg'] === 'auto', under['ns-egg']);
  ok('and the thing under the middle of the ring is the ring',
     under.underTheRing === 'ns-key', String(under.underTheRing));

  /* and a real finger on it, dragging a little the way a thumb does */
  const ring = await p.$('#ns-key');
  if (ring) {
    const box = await ring.boundingBox();
    await p.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
    await p.waitForTimeout(120);
    const beforeHold = await p.evaluate(() => OuissysNightShift.__night.wind().wound.cogsworth);
    await p.evaluate(([x, y]) => {
      const el = document.getElementById('ns-key');
      el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true,
        clientX: x, clientY: y, pointerType: 'touch' }));
    }, [box.x + box.width / 2, box.y + box.height / 2]);
    await p.waitForTimeout(1800);
    const wound = await p.evaluate(() => OuissysNightShift.__night.wind().wound.cogsworth);
    const selected = await p.evaluate(() => String(window.getSelection()).length);
    ok('and holding it really does wind him', wound > 5,
       beforeHold.toFixed(2) + ' -> ' + wound.toFixed(2));
    ok('and holding it selects nothing on the page', selected === 0,
       selected + ' characters');
  }

  console.log('\n' + (fails ? 'FAILED ' + fails + ' of ' + checks
                             : 'all ' + checks + ' checks passed'));
  await b.close();
  process.exit(fails ? 1 : 0);
})();
