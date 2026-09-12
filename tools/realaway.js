/* THE SAME QUESTION, BUT WITH THE BROWSER ACTUALLY DOING IT.
 *
 * backsound.js dispatches visibilitychange and blur by hand, and the
 * chapter passes that. A hand-fired event is not a hidden tab, though:
 * a really-backgrounded page has its timers throttled to about one a
 * minute, its rAF stopped dead, and its AudioContext handled by the
 * browser rather than by us. Every one of those can break the way back
 * in without touching the way out.
 *
 * So this opens a second tab and brings it to the front, which is a
 * real tab switch, waits there long enough for the throttling to bite,
 * and then comes back and asks whether the music is playing.
 *
 *   node tools/realaway.js
 */
const { chromium } = require('playwright-core');
let pass = 0, fail = 0;
const ok = (n, c, x) => { if (c) { pass++; console.log('  ok   ' + n); }
                          else { fail++; console.log('  FAIL ' + n + (x ? '  ' + JSON.stringify(x) : '')); } };

(async () => {
  /* Headless Chromium never backgrounds a tab: bringToFront moves the
     page but document.hidden stays false and no blur is delivered, so
     the whole point of this harness is lost. Run it under a real (if
     virtual) display — `xvfb-run node tools/realaway.js` — and the tab
     switch is the browser's own. */
  const b = await chromium.launch({
    headless: !process.env.DISPLAY,
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox', '--no-proxy-server', '--disable-gpu',
           '--autoplay-policy=no-user-gesture-required'] });
  const ctxb = await b.newContext({ viewport: { width: 1100, height: 760 } });
  const p = await ctxb.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));

  await p.addInitScript(() => {
    window.__notes = 0;
    window.__log = [];
    const wrap = (proto) => {
      if (!proto || !proto.start || proto.__counted) return;
      const real = proto.start;
      proto.start = function () { window.__notes++; return real.apply(this, arguments); };
      proto.__counted = true;
    };
    wrap(window.OscillatorNode && window.OscillatorNode.prototype);
    wrap(window.AudioBufferSourceNode && window.AudioBufferSourceNode.prototype);
    window.__ctxs = [];
    const AC = window.AudioContext;
    window.AudioContext = function () { const c = new AC(); window.__ctxs.push(c); return c; };
    window.AudioContext.prototype = AC.prototype;
    ['visibilitychange'].forEach(e => document.addEventListener(e,
      () => window.__log.push(e + ':' + document.visibilityState)));
    ['blur', 'focus', 'pageshow', 'pagehide'].forEach(e => window.addEventListener(e,
      () => window.__log.push(e)));
  });

  await p.goto('http://127.0.0.1:8899/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForTimeout(500);
  await p.evaluate(() => window.loadChapter && window.loadChapter('quest'));
  await p.waitForFunction(() => !!window.OST, { timeout: 30000 });
  await p.evaluate(() => {
    try { localStorage.clear(); } catch (e) {}
    showScreen('quest'); startQuest();
    document.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
  });
  await p.waitForTimeout(3000);

  const notes = () => p.evaluate(() => window.__notes);
  const state = () => p.evaluate(() => ({
    ctx: window.__ctxs.map(c => c.state).join(','),
    asleep: window.audioAsleep && window.audioAsleep(),
    ost: window.OST && window.OST.debug && window.OST.debug(),
    amb: typeof hvAmb !== 'undefined' && hvAmb ? { scene: hvAmb.scene, timer: !!hvAmb.timer } : null,
    log: window.__log.slice(-8),
  }));

  const n0 = await notes();
  await p.waitForTimeout(2000);
  const n1 = await notes();
  ok('the music is playing to begin with', n1 > n0, { n0, n1, ...(await state()) });

  /* a real tab switch: a second page brought to the front */
  const other = await ctxb.newPage();
  await other.goto('about:blank');
  await other.bringToFront();
  await p.waitForTimeout(1200);

  /* Does this machine actually background a tab? Chromium here does not
     — bringToFront moves the page, and the one it moved off stays
     visible and focused, so no listener anywhere ever fires. Asserting
     against that would be asserting against the harness. Say so, and
     stop: backsound.js covers the same ground by firing the events
     directly, and this file only earns its keep somewhere with a real
     window manager. */
  const heard = await p.evaluate(() => window.__log.filter(
    e => e === 'blur' || e.indexOf('visibilitychange') === 0).length);
  if (!heard) {
    console.log('  --   this browser does not background a tab; nothing exercised.');
    console.log('       (run it somewhere with a real display, or use backsound.js)');
    await b.close();
    process.exit(0);
  }
  const n2 = await notes();
  await new Promise(r => setTimeout(r, 6000));       // long enough to be throttled
  const n3 = await notes();
  ok('nothing plays while the tab is in the background', n3 - n2 <= 2,
     { newNotes: n3 - n2, ...(await state()) });

  await p.bringToFront();
  await p.waitForTimeout(3500);
  const n4 = await notes();
  ok('the music plays again on coming back to the tab', n4 - n3 > 4,
     { newNotes: n4 - n3, ...(await state()) });

  /* and again, this time with a click on return, which is what a person
     would actually do */
  await other.bringToFront();
  await new Promise(r => setTimeout(r, 6000));
  const n5 = await notes();
  await p.bringToFront();
  await p.waitForTimeout(400);
  await p.mouse.click(550, 400);
  await p.waitForTimeout(3000);
  const n6 = await notes();
  ok('and plays again when she comes back and clicks', n6 - n5 > 4,
     { newNotes: n6 - n5, ...(await state()) });

  ok('no page errors', errs.length === 0, errs.slice(0, 4));
  console.log(pass + ' passed, ' + fail + ' failed');
  await b.close();
  process.exit(fail ? 1 : 0);
})();
