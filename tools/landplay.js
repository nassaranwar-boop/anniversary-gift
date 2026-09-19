/* PLAYING ALL FIVE OF THEM ON A PHONE LYING DOWN.

   sidebyside.js opens each game and looks at it; landscape.js and
   buttons.js measure the controls. None of them PRESSES anything, so
   all three would stay green on a game whose touch pad is beautifully
   laid out and wired to nothing -- and on a phone a touch pad wired to
   nothing is the whole game.

   So this walks in through the front door at landscape-phone size and
   plays: taps the menus the way a thumb does, holds the controls, and
   asks the game itself whether it noticed. Every press is checked twice
   over --

     reachable   elementFromPoint at the middle of the control is the
                 control, so nothing is lying over it
     wired       the game's own state changed when it was pressed

   -- because either one alone has been green while the other was
   broken.

                                node tools/landplay.js [game]
*/
const { chromium } = require('playwright-core');

const SIZES = [[844, 390, '844x390'], [740, 360, '740x360']];
const PASSCODE = '2207';

let pass = 0, fail = 0;
const ok = (n, c, x) => { if (c) { pass++; } else { fail++;
  console.log('  FAIL ' + n + (x !== undefined ? '  ' + JSON.stringify(x).slice(0, 140) : '')); } };

/* ---- pressing things ------------------------------------------------

   Playwright's own click hangs on these pages: the request filter
   aborts every off-site request and its actionability check waits for a
   navigation that is never going to settle (tools/_aplib.js paid for
   that one twice). So a press is dispatched inside the page -- and
   because dispatching bypasses hit testing, which is exactly what has
   to be checked here, every press first asks what is actually at the
   middle of the control. */
async function press(p, sel, hold) {
  return p.evaluate(async ([s, ms]) => {
    /* SCOPED, OR IT PRESSES ANOTHER GAME.

       The kart's steering keys and the night shift's doors are both
       [data-k="left"], and the racer's markup comes first in the page,
       so an unscoped query reached into a screen that was not even on
       and reported the night shift's own door as unreachable. */
    const el = document.querySelector(s);
    if (!el) return { found: false };
    const r = el.getBoundingClientRect();
    /* a control with no size is not on the screen at all -- the
       apocalypse's MAP button is only there once she has found a map,
       and a 0x0 box passes every "is it on the screen" test ever
       written while elementFromPoint reports whatever is behind it */
    if (r.width < 2 || r.height < 2) return { found: false, empty: true };
    const x = r.left + r.width / 2, y = r.top + r.height / 2;
    const on = r.left >= -1 && r.top >= -1 && r.right <= innerWidth + 1 && r.bottom <= innerHeight + 1;
    const hit = document.elementFromPoint(x, y);
    const reachable = !!(hit && (hit === el || el.contains(hit)));
    const opts = { bubbles: true, cancelable: true, clientX: x, clientY: y,
                   pointerId: 1, pointerType: 'touch', isPrimary: true, button: 0, buttons: 1 };
    el.dispatchEvent(new PointerEvent('pointerdown', opts));
    el.dispatchEvent(new Event('touchstart', { bubbles: true, cancelable: true }));
    if (ms) await new Promise((k) => setTimeout(k, ms));
    el.dispatchEvent(new PointerEvent('pointerup', Object.assign({}, opts, { buttons: 0 })));
    document.dispatchEvent(new PointerEvent('pointerup', Object.assign({}, opts, { buttons: 0 })));
    el.dispatchEvent(new Event('touchend', { bubbles: true, cancelable: true }));
    el.dispatchEvent(new MouseEvent('click', opts));
    return { found: true, on: on, reachable: reachable,
             what: hit ? (hit.tagName + '#' + (hit.id || '') + '.' + (hit.className || '')).slice(0, 40) : null };
  }, [sel, hold || 0]);
}

/* every control the chapter has up right now, and whether a thumb could
   land on it */
function controls(rootSel) {
  return function () {
    const root = document.querySelector(document.__lpRoot) || document.body;
    const out = { n: 0, off: [], covered: [] };
    root.querySelectorAll('button, [data-k], [data-ap-key], [data-so-key], [data-go]').forEach((el) => {
      const cs = getComputedStyle(el), r = el.getBoundingClientRect();
      if (cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0') return;
      /* a control the page has deliberately made transparent to taps is
         not a control right now -- the apocalypse's USE and CREEP are
         pointer-events:none until a thumb has touched the picture, so
         that the first tap goes to the picture */
      if (cs.pointerEvents === 'none') return;
      if (r.width < 2 || r.height < 2) return;
      /* and an ancestor can hide it just as well: the apocalypse's
         legacy d-pad is opacity:0 and its keys are not, so asking the
         key alone called four invisible buttons live and then reported
         them as buried under the picture */
      let q = el.parentElement, hid = false;
      while (q) {
        const qs = getComputedStyle(q);
        if (q.hidden || qs.display === 'none' || qs.visibility === 'hidden' || qs.opacity === '0') { hid = true; break; }
        q = q.parentElement;
      }
      if (hid) return;
      out.n++;
      const id = el.id || (el.dataset && (el.dataset.k || el.dataset.apKey || el.dataset.soKey || el.dataset.go))
                 || (el.textContent || '').trim().slice(0, 14) || el.tagName;
      if (r.left < -1 || r.top < -1 || r.right > innerWidth + 1 || r.bottom > innerHeight + 1) out.off.push(id);
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      if (cx < 0 || cy < 0 || cx > innerWidth || cy > innerHeight) return;
      const hit = document.elementFromPoint(cx, cy);
      if (hit && hit !== el && !el.contains(hit) && !hit.contains(el)) {
        out.covered.push(id + '<' + ((hit.id || hit.className || hit.tagName) + '').slice(0, 20));
      }
    });
    return out;
  };
}

async function look(p, rootSel) {
  await p.evaluate((s) => { document.__lpRoot = s; }, rootSel);
  return p.evaluate(controls());
}

/* ---- the games ------------------------------------------------------ */
const GAMES = {
  race: {
    card: 'race', root: '#screen-race', ready: '#screen-race.active #race-canvas',
    async play(p, label, note, press) {
      /* single player, first driver, first course -- the menu order
         matters: data-next="chars" is GO on the driver screen */
      for (const s of ['[data-go="single"]', '[data-char="0"]', '[data-next="chars"]',
                       '[data-track="0"]', '[data-next="tracks"]']) {
        const r = await press(s);
        ok(label + ' race: ' + s + ' is reachable', r.found && r.reachable !== false, r);
        await p.waitForTimeout(700);
      }
      await p.waitForTimeout(6000);
      const st = await p.evaluate(() => {
        const d = window.__RACE_DEBUG && window.__RACE_DEBUG();
        if (!d) return null;
        const me = d.racers.filter((x) => x.isPlayer)[0] || d.racers[0];
        return { state: d.state, speed: +me.speed.toFixed(3), lap: me.lap,
                 hud: !document.getElementById('rc-hud').hidden,
                 steer: !document.getElementById('rc-steer').hidden,
                 pad: !document.getElementById('rc-pad').hidden };
      });
      ok(label + ' race: the race is on', !!st && st.state !== 'menu', st);
      ok(label + ' race: the HUD is up', !!st && st.hud, st);
      /* ON GLASS THE KART DRIVES ITSELF AND THE WHOLE PICTURE IS THE
         WHEEL. There is no throttle to hold and no pad -- #rc-pad only
         appears if she asks for buttons -- so a harness that presses
         [data-k="up"] is pressing a control this device does not have,
         and reporting it as broken. */
      ok(label + ' race: there is a steering zone on the glass', !!st && st.steer, st);
      note('state ' + (st && st.state) + ' lap ' + (st && st.lap));

      /* THE COUNTDOWN DOES NOT COUNT IN HERE.

         Wall-clock time barely advances under software rendering --
         racelap.js records the lights sitting on three for fourteen
         real seconds -- so the race is stepped by hand to the green,
         exactly as that suite does, and then driven. */
      const green = await p.evaluate(() => {
        const d = window.__RACE_DEBUG();
        for (let i = 0; i < 60 * 12 && d.state !== 'race'; i++) d.step(1 / 60);
        return window.__RACE_DEBUG().state;
      });
      ok(label + ' race: the lights go green', green === 'race' || green === 'results', green);

      const drove = await p.evaluate(() => {
        const d = window.__RACE_DEBUG();
        const me = d.racers.filter((x) => x.isPlayer)[0] || d.racers[0];
        const was = { x: me.x, y: me.y, s: me.speed };
        /* nobody is touching anything: the throttle is supposed to hold
           itself on glass */
        for (let i = 0; i < 120; i++) d.step(1 / 60);
        return { was: was, now: { x: +me.x.toFixed(2), y: +me.y.toFixed(2), s: +me.speed.toFixed(3) } };
      });
      ok(label + ' race: the throttle holds itself and the kart drives',
         Math.abs(drove.now.x - drove.was.x) + Math.abs(drove.now.y - drove.was.y) > 0.5, drove);

      /* a thumb put down on the picture and slid left.  the zone listens
         for touches, not pointers -- dispatching PointerEvents at it
         does nothing at all, which is not the same as the control being
         broken */
      const slid = await p.evaluate(async () => {
        const zone = document.getElementById('rc-steer');
        const r = zone.getBoundingClientRect();
        const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
        const hit = document.elementFromPoint(cx, cy);
        const reachable = !!(hit && (hit === zone || zone.contains(hit) || hit.contains(zone)));
        const touch = (x) => new Touch({ identifier: 11, target: zone, clientX: x, clientY: cy });
        const fire = (t, x) => zone.dispatchEvent(new TouchEvent(t, {
          bubbles: true, cancelable: true, changedTouches: [touch(x)], touches: t === 'touchend' ? [] : [touch(x)] }));
        const d = window.__RACE_DEBUG();
        const me = d.racers.filter((x) => x.isPlayer)[0] || d.racers[0];
        fire('touchstart', cx);
        for (let i = 1; i <= 10; i++) fire('touchmove', cx - i * 14);
        const axis = d.input.axisWant !== undefined ? d.input.axisWant : d.input.axis;
        const was = me.angle;
        for (let i = 0; i < 60; i++) d.step(1 / 60);
        const now = me.angle;
        fire('touchend', cx - 140);
        return { reachable: reachable, axis: axis, was: +was.toFixed(4), now: +now.toFixed(4) };
      });
      ok(label + ' race: the glass takes a thumb', slid.reachable, slid);
      ok(label + ' race: sliding left asks for left lock', slid.axis < -0.05, slid);
      ok(label + ' race: and the kart turns', Math.abs(slid.now - slid.was) > 0.0005, slid);

      const seen = await look(p, '#screen-race');
      ok(label + ' race: every control on the screen', !seen.off.length, seen.off);
      ok(label + ' race: nothing on top of a control', !seen.covered.length, seen.covered);

      const paused = await press('#rc-pause-btn');
      ok(label + ' race: the pause button is reachable', paused.found && paused.reachable, paused);
      await p.waitForTimeout(900);
      ok(label + ' race: pausing puts a card up',
         await p.evaluate(() => !!document.querySelector('#rc-overlay button')));
    },
  },

  ouissy: {
    card: 'ouissy', root: '#screen-ouissy', ready: '#screen-ouissy.active #so-canvas',
    async play(p, label, note, press) {
      /* PLAY, then GOT IT on the how-to (which only appears the first
         time), then the world card, which closes itself after 1.7s */
      const play = await press('#so-play');
      ok(label + ' ouissy: PLAY is reachable', play.found && play.reachable, play);
      await p.waitForTimeout(900);
      /* THE HOW-TO IS A CARD THAT SCROLLS, ON EVERY SIZE.

         Its GOT IT is below the fold on a laptop too -- sofit.js checks
         exactly that, and that the rail at the right-hand edge says so
         -- so a phone that also scrolls is the same card, smaller. What
         has to be true is that she can get to the button: the rail is
         up, and scrolling brings it within reach. */
      let how = await press('#so-how-ok');
      if (how.found && !how.reachable) {
        const rail = await p.evaluate(() => {
          const c = document.querySelector('#so-overlay .so-card');
          const lift = document.getElementById('so-lift');
          const more = c ? c.scrollHeight > c.clientHeight + 2 : false;
          if (c) c.scrollTop = c.scrollHeight;
          return { scrolls: more, rail: !!(lift && getComputedStyle(lift).display !== 'none') };
        });
        ok(label + ' ouissy: the how-to says there is more below it', !rail.scrolls || rail.rail, rail);
        await p.waitForTimeout(400);
        how = await press('#so-how-ok');
      }
      if (how.found) ok(label + ' ouissy: GOT IT can be reached', how.reachable, how);
      await p.waitForTimeout(3200);
      const up = await p.evaluate(() => ({
        state: window.__soState ? __soState().state : null,
        /* whether the pad is THERE, measured -- its aria-hidden was set
           once in the markup and never updated, so asking the attribute
           reported the only controls the game has as absent */
        pad: (function () { const r = document.getElementById('so-pad').getBoundingClientRect();
                            return r.width > 10 && r.height > 10; })(),
        keysOn: [].map.call(document.querySelectorAll('#so-pad .so-key'), (k) => k.dataset.soKey).join(','),
        card: !!document.querySelector('#so-overlay .so-card'),
        keys: window.__soKeys ? window.__soKeys() : null }));
      ok(label + ' ouissy: the level is being played', !up.card, up);
      ok(label + ' ouissy: the pad is up once the level starts', up.pad, up);
      note((up.pad ? 'pad up' : 'no pad') + (up.card ? ', a card is still up' : ''));

      const seen = await look(p, '#screen-ouissy');
      ok(label + ' ouissy: every control on the screen', !seen.off.length, seen.off);
      ok(label + ' ouissy: nothing on top of a control', !seen.covered.length, seen.covered);

      /* the keys answer to touches and pointers both; what matters is
         that holding one is held, and that holding it moves her */
      const held = await p.evaluate(async () => {
        const el = document.querySelector('#so-pad [data-so-key="right"]');
        const r = el.getBoundingClientRect();
        const x = r.left + r.width / 2, y = r.top + r.height / 2;
        const hit = document.elementFromPoint(x, y);
        const reachable = !!(hit && (hit === el || el.contains(hit)));
        const o = { bubbles: true, cancelable: true, clientX: x, clientY: y,
                    pointerId: 3, pointerType: 'touch', isPrimary: true, buttons: 1 };
        el.dispatchEvent(new PointerEvent('pointerdown', o));
        const t = new Touch({ identifier: 3, target: el, clientX: x, clientY: y });
        el.dispatchEvent(new TouchEvent('touchstart', { bubbles: true, cancelable: true, changedTouches: [t], touches: [t] }));
        const got = window.__soKeys ? JSON.parse(JSON.stringify(window.__soKeys())) : null;
        const was = window.__soState().x;
        const ran = window.__soPump ? window.__soPump(0.8) : null;
        el.dispatchEvent(new PointerEvent('pointerup', Object.assign({}, o, { buttons: 0 })));
        el.dispatchEvent(new TouchEvent('touchend', { bubbles: true, cancelable: true, changedTouches: [t], touches: [] }));
        if (window.__soReleaseAll) window.__soReleaseAll();
        return { reachable: reachable, keys: got, was: was, ran: ran };
      });
      ok(label + ' ouissy: RIGHT is reachable', held.reachable, held);
      ok(label + ' ouissy: holding RIGHT is held', !!held.keys && !!held.keys.right, held.keys);
      ok(label + ' ouissy: and she runs while it is held',
         !!held.ran && held.ran.x > held.was, { from: held.was, to: held.ran && held.ran.x });

      const jump = await p.evaluate(() => {
        const el = document.querySelector('#so-pad [data-so-key="jump"]');
        const r = el.getBoundingClientRect();
        const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        return !!(hit && (hit === el || el.contains(hit)));
      });
      ok(label + ' ouissy: JUMP is reachable', jump);

      const pz = await press('#so-pause-btn');
      ok(label + ' ouissy: the pause button is reachable', pz.found && pz.reachable, pz);
      await p.waitForTimeout(800);
      ok(label + ' ouissy: pausing puts a card up',
         await p.evaluate(() => !!document.querySelector('#so-overlay #so-resume')));
    },
  },

  apoc: {
    card: 'apoc', root: '#screen-apoc', ready: '#screen-apoc.active #ap-canvas',
    async play(p, label, note, press) {
      await p.evaluate(() => { if (window.__apQuality) __apQuality(2); });
      /* past whatever card is up and into plain play */
      for (let i = 0; i < 6; i++) {
        const r = await press('#ap-overlay button, #ap-dlg-next');
        if (!r.found) break;
        await p.waitForTimeout(500);
      }
      await p.evaluate(() => { if (window.__apClear) __apClear(); });
      await p.waitForTimeout(600);
      const st0 = await p.evaluate(() => window.__apState && __apState());
      ok(label + ' apoc: a level is running', !!st0 && !!st0.player, st0 && st0.state);
      note('state ' + (st0 && st0.state) + ' at ' + (st0 && st0.player && st0.player.tx + ',' + st0.player.ty));
      /* THE STICK IS NOT A BUTTON.

         There is no control to aim at: a thumb put down anywhere on the
         left half of the picture, below the HUD, becomes the stick
         wherever it lands -- and the visible ring is only the drawing
         of it. The first touch is also what puts the action buttons on
         screen, which is why they are pointer-events:none until it
         happens. So this touches the picture where a thumb would. */
      const walked = await p.evaluate(async () => {
        const st = document.getElementById('ap-stage');
        const r = st.getBoundingClientRect();
        const x = r.left + r.width * 0.22, y = r.top + r.height * 0.66;
        const mk = (t, cx) => { const tt = new Touch({ identifier: 5, target: st, clientX: cx, clientY: y });
          return new TouchEvent(t, { bubbles: true, cancelable: true,
            changedTouches: [tt], touches: t === 'touchend' ? [] : [tt] }); };
        const was = window.__apState();
        st.dispatchEvent(mk('touchstart', x));
        for (let i = 1; i <= 6; i++) st.dispatchEvent(mk('touchmove', x + i * 7));
        if (window.__apPump) window.__apPump(1 / 30, 45);
        const now = window.__apState();
        const ui = document.getElementById('ap-touch').getAttribute('aria-hidden');
        st.dispatchEvent(mk('touchend', x + 42));
        return { was: was.player, now: now.player, ui: ui };
      });
      ok(label + ' apoc: a thumb on the picture brings the controls up', walked.ui === 'false', walked.ui);
      ok(label + ' apoc: and it walks her',
         Math.abs(walked.now.x - walked.was.x) + Math.abs(walked.now.z - walked.was.z) > 0.01, walked);

      /* the buttons fade in over a quarter of a second, and this
         container paints about four frames in that time */
      await p.waitForTimeout(900);
      const seen = await look(p, '#screen-apoc');
      ok(label + ' apoc: every control on the screen', !seen.off.length, seen.off);
      ok(label + ' apoc: nothing on top of a control', !seen.covered.length, seen.covered);
      ok(label + ' apoc: the controls are there to be pressed', seen.n >= 3, seen.n);
      note(seen.n + ' controls once the thumb is down');

      const use = await press('[data-ap-key="use"]');
      ok(label + ' apoc: USE is reachable', use.found && use.reachable, use);
      const creep = await press('[data-ap-key="sneak"]');
      ok(label + ' apoc: CREEP is reachable', creep.found && creep.reachable, creep);
      /* the map button is only on the screen once she has found a map,
         so it is checked where it exists rather than demanded here */
      const mp = await press('#ap-map-btn');
      if (mp.found) ok(label + ' apoc: the map button is reachable', mp.reachable, mp);
      const pz = await press('#ap-pause-btn');
      ok(label + ' apoc: the pause button is reachable', pz.found && pz.reachable, pz);
      await p.waitForTimeout(600);
      await p.evaluate(() => { if (window.__apClear) __apClear(); });
    },
  },

  quest: {
    card: 'quest', root: '#screen-quest', ready: '#screen-quest.active .hv-stage',
    async play(p, label, note, press) {
      const start = await press('.hv-btn-start');
      ok(label + ' quest: BEGIN is reachable', start.found && start.reachable, start);
      await p.waitForTimeout(1400);
      /* a choice is a .hv-btn in one of the three columns, or one of the
         picture cards in #hv-cards -- the harness read ".hv-cards" as a
         class, which is an id, and then gave up after one node */
      const CHOICE = '#hv-left .hv-btn, #hv-centre .hv-btn, #hv-right .hv-btn, #hv-cards .hv-card';
      const where = () => p.evaluate((sel) => ({
        note: ((document.getElementById('hv-note') || {}).textContent || '').trim().slice(0, 48),
        choices: [].map.call(document.querySelectorAll(sel), (e) => (e.textContent || '').trim().slice(0, 14)).join('|'),
      }), CHOICE);
      /* THE CHOICES WAIT FOR THE CONVERSATION.

         A scene with talking in it holds its buttons back -- hushed and
         genuinely disabled -- until the two of them have finished, and
         there is deliberately no way to hurry them. A line is up for
         2.9 seconds, so a three-line scene is ten seconds before there
         is anything to press. A harness that presses at 1.4s is not
         finding a broken button, it is interrupting. */
      const live = async () => {
        for (let i = 0; i < 30; i++) {
          const yes = await p.evaluate(() => !document.querySelector('#hv-left.hv-hushed, #hv-right.hv-hushed, #hv-centre.hv-hushed, #hv-cards.hv-hushed'));
          if (yes) return true;
          await p.waitForTimeout(700);
        }
        return false;
      };
      let moved = 0, last = await where();
      for (let i = 0; i < 4; i++) {
        ok(label + ' quest: the choices arrive once they have finished talking', await live());
        const r = await press(CHOICE);
        if (!r.found) break;
        ok(label + ' quest: choice ' + (i + 1) + ' is reachable', r.reachable, r);
        await p.waitForTimeout(1400);
        const now = await where();
        if (now.note !== last.note || now.choices !== last.choices) moved++;
        last = now;
      }
      ok(label + ' quest: the story moves when she chooses', moved >= 2, { moved: moved, at: last });
      note('at "' + last.note + '"');
      const seen = await look(p, '#screen-quest');
      ok(label + ' quest: every control on the screen', !seen.off.length, seen.off);
      ok(label + ' quest: nothing on top of a control', !seen.covered.length, seen.covered);
      /* the chips at the top are small by design and carry an invisible
         44px target; what matters here is that they answer */
      const back = await press('#hv-back');
      ok(label + ' quest: back is reachable', back.found && back.reachable, back);
    },
  },

  nightshift: {
    card: 'nightshift', root: '#screen-nightshift', ready: '#screen-nightshift.active #ns-canvas',
    async play(p, label, note, press) {
      await p.evaluate(() => {
        const N = OuissysNightShift.__night;
        N.begin(2); N.midEnd();
      });
      await p.waitForTimeout(900);
      const seen = await look(p, '#screen-nightshift');
      ok(label + ' nightshift: every control on the screen', !seen.off.length, seen.off);
      ok(label + ' nightshift: nothing on top of a control', !seen.covered.length, seen.covered);
      note(seen.n + ' controls in the shift');
      const l = await press('[data-k="left"]');
      ok(label + ' nightshift: the left door is reachable', l.found && l.reachable, l);
      await p.waitForTimeout(500);
      ok(label + ' nightshift: pressing it shuts the door',
         await p.evaluate(() => OuissysNightShift.__night.state().doors.left === true));
      const m = await press('[data-k="monitor"]');
      ok(label + ' nightshift: the camera button is reachable', m.found && m.reachable, m);
      await p.waitForTimeout(700);
      ok(label + ' nightshift: it opens the monitor',
         await p.evaluate(() => OuissysNightShift.__night.state().monitor === true));
      const onCam = await look(p, '#screen-nightshift');
      ok(label + ' nightshift: every control on the monitor is on the screen', !onCam.off.length, onCam.off);
      ok(label + ' nightshift: nothing on top of a control on the monitor', !onCam.covered.length, onCam.covered);
      await press('[data-k="monitor"]');
      await p.waitForTimeout(400);
      const pz = await press('#ns-pause-btn');
      ok(label + ' nightshift: the pause button is reachable', pz.found && pz.reachable, pz);
    },
  },
};

(async () => {
  const want = process.argv[2];
  const names = want ? [want] : Object.keys(GAMES);
  const b = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox', '--no-proxy-server', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  for (const [w, h, label] of SIZES) {
    console.log('\n=== ' + label);
    for (const name of names) {
      const g = GAMES[name];
      const p = await b.newPage({ viewport: { width: w, height: h }, isMobile: true, hasTouch: true });
      const errs = [];
      p.on('pageerror', (e) => errs.push(e.message.slice(0, 100)));
      await p.route('**/*', (r) => r.request().url().startsWith('http://127.0.0.1') ? r.continue() : r.abort());
      await p.goto('http://127.0.0.1:8899/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
      await p.waitForTimeout(900);
      /* in through the hub, the way she goes */
      await p.evaluate(() => { showScreen('hub'); if (window.startHub) startHub(); });
      await p.waitForTimeout(600);
      const opened = await press(p, '#hub-card-' + g.card);
      ok(label + ' ' + name + ': the hub card is reachable', opened.found && opened.reachable, opened);
      let came = true;
      try { await p.waitForSelector(g.ready, { timeout: 30000 }); }
      catch (e) { came = false; }
      ok(label + ' ' + name + ': it opens', came);
      if (came) {
        await p.waitForTimeout(g.card === 'nightshift' ? 4000 : 2500);
        const note = (t) => console.log('   ' + name.padEnd(11) + t);
        const P = (sel, hold) => press(p, g.root + ' ' + sel.split(',').map((x) => x.trim()).join(', ' + g.root + ' '), hold);
        try { await g.play(p, label, note, P); }
        catch (e) { fail++; console.log('  FAIL ' + label + ' ' + name + ': threw  ' + e.message.split('\n').slice(0,4).join(' | ').slice(0, 320)); }
      }
      const real = errs.filter((e) => !/ERR_FAILED|net::/.test(e));
      ok(label + ' ' + name + ': nothing threw while playing', !real.length, real.slice(0, 3));
      await p.close();
    }
  }
  console.log('\n' + pass + ' passed, ' + fail + ' failed\n');
  await b.close();
  process.exit(fail ? 1 : 0);
})();
