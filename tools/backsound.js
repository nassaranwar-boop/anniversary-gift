/* DOES THE MUSIC ACTUALLY COME BACK?
 *
 * Leaving the page stops the sound — that part is tested elsewhere and
 * it works. This asks the other half, which is the half that was
 * reported broken: after you come back, is anything being PLAYED again?
 *
 * "The context resumed" is not the question. A resumed context with a
 * dead scheduler is silent, and so is a live scheduler writing onto a
 * clock that never restarted. So this counts real note events — every
 * oscillator and buffer source that gets start()ed — and asks for more
 * of them after the return than there were during the absence.
 *
 * Three ways back in, because the platforms disagree about which one
 * you get:
 *   A. tab switch          hidden/visible  (+ blur/focus)
 *   B. another app window  blur/focus only, tab never hidden
 *   C. phone, locked       hidden/visible, and the context comes back
 *                          only on the first touch afterwards
 *
 *   node tools/backsound.js
 */
const { chromium } = require('playwright-core');
let pass = 0, fail = 0;
const ok = (n, c, x) => { if (c) { pass++; console.log('  ok   ' + n); }
                          else { fail++; console.log('  FAIL ' + n + (x ? '  ' + JSON.stringify(x) : '')); } };

(async () => {
  const b = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox', '--no-proxy-server', '--disable-gpu',
           '--autoplay-policy=no-user-gesture-required'] });
  const errs = [];
  let p = null;
  const fresh = async () => {
    if (p) await p.close();
    p = await b.newPage({ viewport: { width: 1100, height: 760 } });
    p.on('pageerror', e => errs.push(e.message));
    await p.route('**/*', r => r.request().url().startsWith('http://127.0.0.1') ? r.continue() : r.abort());
    await p.addInitScript(init);
  };

  const init = (() => {
    /* document.hidden is read-only, so the tab switch has to be faked */
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => !!window.__hidden });
    Object.defineProperty(document, 'visibilityState',
      { configurable: true, get: () => (window.__hidden ? 'hidden' : 'visible') });

    /* every note the page plays, counted at the source */
    window.__notes = 0;
    const wrap = (proto) => {
      if (!proto || !proto.start || proto.__counted) return;
      const real = proto.start;
      proto.start = function () { window.__notes++; return real.apply(this, arguments); };
      proto.__counted = true;
    };
    wrap(window.AudioScheduledSourceNode && window.AudioScheduledSourceNode.prototype);
    wrap(window.OscillatorNode && window.OscillatorNode.prototype);
    wrap(window.AudioBufferSourceNode && window.AudioBufferSourceNode.prototype);

    window.__ctxs = [];
    const AC = window.AudioContext;
    window.AudioContext = function () { const c = new AC(); window.__ctxs.push(c); return c; };
    window.AudioContext.prototype = AC.prototype;
  });

  /* Each round gets a page of its own. Sharing one page across them
     made every failure ambiguous: a round that came back wrong left the
     next round starting from wrong, and there was no telling which of
     the two had actually broken. */
  const start = async () => {
    await fresh();
    await p.goto('http://127.0.0.1:8899/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await p.waitForTimeout(400);
    await p.evaluate(() => window.loadChapter && window.loadChapter('quest'));
    await p.waitForFunction(() => !!window.OST, { timeout: 30000 });
    await p.evaluate(() => {
      try { localStorage.clear(); } catch (e) {}
      showScreen('quest'); startQuest();
      document.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    });
  };

  const notes = () => p.evaluate(() => window.__notes);
  const state = () => p.evaluate(() =>
    ({ ctx: (window.__ctxs.map(c => c.state).join(',')), asleep: window.audioAsleep && window.audioAsleep(),
       ost: window.OST && window.OST.debug && window.OST.debug() }));

  const away = (hide) => p.evaluate((hide) => {
    if (hide) { window.__hidden = true; document.dispatchEvent(new Event('visibilitychange')); }
    window.dispatchEvent(new Event('blur'));
  }, hide);
  const back = (hide) => p.evaluate((hide) => {
    if (hide) { window.__hidden = false; document.dispatchEvent(new Event('visibilitychange')); }
    window.dispatchEvent(new Event('focus'));
  }, hide);

  /* How many notes came out over the next few seconds.
     The window has to be long. The title cue is sparse — a piano, alone,
     a phrase and then air — so a short look can land in a rest and
     report silence from a score that is playing perfectly. That made
     this suite fail one run in four on a page with nothing wrong with
     it, which is worse than useless. Five seconds spans a bar of the
     slowest cue in the game. */
  const over = async (seconds) => {
    const a = await notes();
    await p.waitForTimeout(seconds * 1000);
    return (await notes()) - a;
  };

  /* one round trip: play, leave, come back, and count notes in each part */
  async function round(label, hide, tapOnReturn) {
    await start();
    await p.waitForTimeout(1500);
    ok(label + ': the music is playing before she leaves', (await over(5)) > 4,
       await state());

    await away(hide);
    await p.waitForTimeout(800);
    ok(label + ': nothing plays while she is away', (await over(4)) <= 2,
       await state());

    await back(hide);
    if (tapOnReturn) {
      await p.waitForTimeout(300);
      await p.evaluate(() => document.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })));
    }
    await p.waitForTimeout(700);
    ok(label + ': the music plays again when she comes back', (await over(5)) > 4,
       await state());
  }

  console.log('A. tab switch (hidden + blur)');
  await round('tab', true, false);

  console.log('B. another window (blur only, tab still visible)');
  await round('window', false, false);

  console.log('C. phone: away and back, then a touch');
  await round('phone', true, true);

  /* D. THE ONE THE OTHER THREE CANNOT SEE.
     On a phone the audio session is taken away by the system, not by
     us, and it comes back only inside a real gesture: until she
     touches the glass, resume() does nothing and the context reports
     itself "interrupted". Every handler that fires on the way back in
     has therefore already been spent by the time the sound is allowed
     to return, and whatever they restarted was restarted onto a clock
     that was still stopped.
     Faked here by gating resume() on a flag and letting the first tap
     open it, which is exactly what iOS does. */
  console.log('D. phone, where the sound may only come back on a touch');
  await start();
  await p.waitForTimeout(3000);
  await p.evaluate(() => {
    const c = window.__ctxs[window.__ctxs.length - 1];
    window.__ctx = c;
    window.__locked = false;
    const proto = Object.getPrototypeOf(c);
    const realState = Object.getOwnPropertyDescriptor(
      Object.getPrototypeOf(proto) || proto, 'state') ||
      Object.getOwnPropertyDescriptor(proto, 'state');
    const realResume = c.resume.bind(c);
    c.resume = () => (window.__locked ? Promise.resolve() : realResume());
    Object.defineProperty(c, 'state', { configurable: true,
      get: () => (window.__locked ? 'interrupted' : realState.get.call(c)) });
  });

  ok('phone: playing before the system takes the audio away', (await over(5)) > 4);

  await p.evaluate(() => { window.__locked = true; });
  await away(true);
  await p.waitForTimeout(1200);
  ok('phone: and the system taking it away is silence', (await over(3)) <= 2);

  await back(true);                      // every handler fires, and none can help
  ok('phone: coming back is not enough on its own', (await over(3)) <= 2, await state());

  /* the tap that opens the audio session again */
  await p.evaluate(() => {
    window.__locked = false;
    document.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
  });
  ok('phone: the first touch after coming back brings the music back',
     (await over(5)) > 4, await state());

  /* E. THE LONG ABSENCE, WITH NOBODY TOUCHING ANYTHING.
     The same locked session, except that this time she comes back and
     just looks at it. Nothing fires: the events are spent, there is no
     gesture, and the hardware hands the session back a few seconds
     later on its own — which is what a desktop does after a long
     absence and what a phone does when the call ends while the page is
     already in front of you.
     This is the case a single attempt cannot pass. Whatever restarted
     the chapter did so onto a clock that had not started yet, and there
     was no second attempt: the context comes back running, the score
     reports a healthy scheduler, and the room is silent. */
  console.log('E. a long absence, and she comes back and touches nothing');
  await p.evaluate(() => { window.__locked = true; });
  await away(true);
  await p.waitForTimeout(1200);
  ok('nothing plays while she is away', (await over(3)) <= 2);

  await back(true);
  ok('and nothing plays yet, because the audio is still not hers', (await over(3)) <= 2);

  /* the hardware relents, quietly, with no event and no gesture */
  await p.evaluate(() => { window.__locked = false; });
  await p.waitForTimeout(3000);
  ok('the music comes back on its own once the audio is given back',
     (await over(5)) > 4, await state());

  /* F. THE RETURN THAT ARRIVES AS A TOUCH AND NOTHING ELSE.
     Not every way back into a page delivers focus, or a
     visibilitychange, or a pageshow. A window restored by the system
     rather than by a click on the tab, a page thawed while it was
     already the visible one, Safari handing an app back — she is simply
     there again, and the first thing the page hears about it is her
     finger.
     This is the shape of the report. The context comes back, because a
     touch has always poked the context. The chapter does not, because
     the chapter was only ever told by the events, and none of them
     came: the score's scheduler is still stopped from the way out and
     there is nothing left to start it. Running context, healthy score,
     silence, and clicking around does not help. */
  console.log('F. she is just back, and the only signal is her finger');
  await start();
  await p.waitForTimeout(1500);
  ok('playing before she goes', (await over(5)) > 4);
  await away(true);
  await p.waitForTimeout(1000);
  ok('quiet while she is gone', (await over(3)) <= 2);

  /* back, with the page told nothing at all */
  await p.evaluate(() => { window.__hidden = false; });
  await p.waitForTimeout(500);
  await p.evaluate(() => document.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })));
  await p.waitForTimeout(700);
  ok('her first touch is enough to bring the whole chapter back',
     (await over(5)) > 4, await state());

  /* and the toggle still has to work after all that */
  await start();
  await p.waitForTimeout(1500);
  await p.evaluate(() => { hvSetSound(false); });
  await p.waitForTimeout(800);
  ok('sound off really is off', (await over(3)) <= 2);
  await p.evaluate(() => { hvSetSound(true); });
  ok('and turning it back on starts it again', (await over(5)) > 4, await state());

  ok('no page errors', errs.length === 0, errs.slice(0, 4));
  console.log(pass + ' passed, ' + fail + ' failed');
  await b.close();
  process.exit(fail ? 1 : 0);
})();
