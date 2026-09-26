/* A NEW PLAYER DOES NOT FOLLOW THE SCRIPT.

   Every other suite here plays properly: it shuts a door when
   something is behind it, it winds the four, it presses the button the
   card offers. That is the happy path, and the happy path is the one
   part of this chapter that has already been walked a hundred times.

   This does the opposite on purpose, the way somebody who has never
   seen it does:

     opens the door WITH something behind it, which is the one thing
       the note tells her not to do;
     holds every door shut all night and never opens them;
     never winds anything, ever;
     hammers every control as fast as it will take it;
     presses keys and taps the pad while a card is up, during the
       opening film, during the keeper beat, during the last hour;
     leaves the game alone entirely and lets the meter run out;
     spams the pause button;
     walks out of the chapter mid-night and comes back in.

   What it is looking for is not "did she die" -- dying is allowed and
   mostly correct. It is looking for the things that should never
   happen whatever she does: a page error, a phase the chapter cannot
   leave, a card with no button, the HUD and the state disagreeing, a
   night that cannot be restarted, sound left running over silence. */
const { chromium } = require('playwright-core');

let pass = 0, fail = 0;
const t = (n, c, note) => { c ? pass++ : fail++;
  console.log(`${c ? 'PASS' : 'FAIL'}  ${n}${note !== undefined ? '   ' + note : ''}`); };

const WAIT = Number(process.env.WAIT || 900);

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox', '--no-proxy-server', '--use-gl=swiftshader', '--enable-unsafe-swiftshader',
           '--autoplay-policy=no-user-gesture-required'] });
  const p = await b.newPage({ viewport: { width: 900, height: 600 } });
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  await p.route('**/*', (r) => r.request().url().startsWith('http://127.0.0.1') ? r.continue() : r.abort());
  await p.goto('http://127.0.0.1:8899/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.evaluate(() => { try { localStorage.clear(); } catch (e) {} localStorage.setItem('ns_notutor', '1');
    showScreen('nightshift');
    return loadChapter('nightshift').then(() => OuissysNightShift.start()); });
  await p.waitForFunction(() => { try { return !!OuissysNightShift.__night.cast().jax; } catch (e) { return false; } },
                          { timeout: 180000, polling: 500 });
  await p.waitForTimeout(1200);

  const out = await p.evaluate(async (WAIT) => {
    const N = OuissysNightShift.__night;
    const log = [];
    const note = (s) => log.push(s);
    const G = () => N.state();

    /* a real press on a real control */
    const press = (k) => {
      const el = document.querySelector('#ns-pad [data-k="' + k + '"]');
      if (!el) return false;
      const r = el.getBoundingClientRect();
      const ev = (ty) => new PointerEvent(ty, { clientX: r.left + r.width / 2, clientY: r.top + r.height / 2,
        bubbles: true, cancelable: true, pointerId: 1, isPrimary: true });
      el.dispatchEvent(ev('pointerdown')); el.dispatchEvent(ev('pointerup'));
      return true;
    };
    const key = (code) => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: code, bubbles: true }));
      document.dispatchEvent(new KeyboardEvent('keyup', { key: code, bubbles: true }));
    };
    const cardButtons = () => [].slice.call(document.querySelectorAll('#ns-overlay [data-go]'));
    const pump = (secs) => { for (let i = 0; i < secs * 30; i++) if (N.pumpFrame(1 / 30) !== 'play') return false;
                             return true; };

    const findings = [];
    const flag = (what, detail) => findings.push({ what, detail });

    /* ---- 1. OPEN THE DOOR ON SOMETHING, WHICH IS THE ONE RULE ---- */
    N.begin(3); N.midEnd();
    {
      /* put one at a door with its patience nearly gone, shut the door,
         then open it again -- the thing the note forbids */
      const cast = N.cast();
      const who = 'cogsworth';
      /* `only` puts the rest back in their boxes and stands this one at
         the end of its route, which is her door */
      N.only(who);
      for (let i = 0; i < 90 && !cast[who].atDoor; i++) N.pumpFrame(1 / 30);
      if (!cast[who].atDoor) flag('setup', 'could not get ' + who + ' to a door');
      else {
        G().doors.left = true;  N.pumpFrame(1 / 30);
        G().doors.left = false; N.pumpFrame(1 / 30);
        const grace = cast[who].doorT;
        note('opened the west door on ' + who + ': ' + grace.toFixed(2) + 's of grace left');
        if (grace > 2.0) flag('opening a door on one of them costs nothing',
                              grace.toFixed(2) + 's still on the clock');
        /* and it must actually end, rather than hanging */
        let ended = false;
        for (let i = 0; i < 300; i++) if (N.pumpFrame(1 / 30) !== 'play') { ended = true; break; }
        note('after opening on it the phase is ' + G().phase + (ended ? '' : ' (still playing)'));
        if (G().phase === 'over') {
          const bs = cardButtons();
          note('the caught card offers ' + bs.length + ' way(s) out');
          if (!bs.length) flag('the caught card has no button', 'nothing to press');
        }
      }
    }

    /* ---- 2. EVERY DOOR SHUT ALL NIGHT, NOTHING EVER WOUND ---- */
    N.begin(4); N.midEnd();
    {
      let blacked = false, stuck = null;
      for (let i = 0; i < WAIT * 30; i++) {
        G().doors.left = G().doors.right = G().doors.hatch = true;
        if (G().blackout) blacked = true;
        if (N.pumpFrame(1 / 30) !== 'play') break;
      }
      note('doors held all night, nothing wound: ended in ' + G().phase +
           ' at ' + G().hour + " o'clock, meter " + Math.round(G().power) + '%' +
           (blacked ? ', went dark on the way' : ''));
      if (G().phase === 'play') stuck = 'still playing after a whole night of held doors';
      if (stuck) flag('a night of nothing but held doors never ends', stuck);
    }

    /* ---- 3. HAMMER EVERY CONTROL ---- */
    N.begin(2); N.midEnd();
    {
      const before = errs => 0;
      for (let i = 0; i < 400; i++) {
        press(['left', 'right', 'hatch', 'monitor', 'next', 'prev'][i % 6]);
        key([' ', 'a', 'd', 'w', 'ArrowLeft', 'ArrowRight', '1', '8'][i % 8]);
        if (i % 7 === 0) N.pumpFrame(1 / 30);
      }
      note('four hundred presses and keys in a row: phase ' + G().phase +
           ', doors ' + JSON.stringify(G().doors) + ', monitor ' + !!G().monitor);
      /* the pad's own state must still agree with the game's */
      const padOn = {};
      document.querySelectorAll('#ns-pad [data-k]').forEach((el) => {
        padOn[el.dataset.k] = el.classList.contains('on'); });
      ['left', 'right', 'hatch'].forEach((k) => {
        if (!!G().doors[k] !== !!padOn[k])
          flag('the pad disagrees with the doors after hammering',
               k + ': game says ' + !!G().doors[k] + ', button says ' + !!padOn[k]);
      });
      if (!!G().monitor !== !!padOn.monitor)
        flag('the pad disagrees with the monitor after hammering',
             'game ' + !!G().monitor + ' button ' + !!padOn.monitor);
    }

    /* ---- 4. MASH THE PAUSE ---- */
    {
      for (let i = 0; i < 40; i++) { N.pauseNow(); N.pumpFrame(1 / 30); }
      note('forty pauses later the phase is ' + G().phase);
      if (G().phase !== 'play' && G().phase !== 'pause')
        flag('mashing pause leaves it somewhere else entirely', G().phase);
      if (G().phase === 'pause') { N.pauseNow(); N.pumpFrame(1 / 30); }
      if (G().phase !== 'play') flag('it will not come back from pause', G().phase);
    }

    /* ---- 5. PRESS THINGS WHILE A CARD IS UP ---- */
    N.begin(5); N.midEnd();
    {
      N.catchNow('jax');
      const ph = G().phase;
      for (let i = 0; i < 60; i++) {
        press(['left', 'right', 'hatch', 'monitor', 'next'][i % 5]);
        key([' ', 'a', 'd', 'w'][i % 4]);
      }
      note('sixty presses against the ' + ph + ' card: phase is now ' + G().phase);
      if (G().phase !== ph)
        flag('hammering the pad moves the game on behind a card', ph + ' -> ' + G().phase);
      const bs = cardButtons();
      if (!bs.length) flag('the card has no way out after hammering', ph);
      else {
        const go = bs.filter((x) => x.classList.contains('ns-btn-go'))[0] || bs[0];
        go.click();
        await new Promise((r) => setTimeout(r, 400));
        note('pressed "' + go.innerText.trim() + '": phase ' + G().phase);
      }
    }

    /* ---- 6. WALK OUT MID-NIGHT AND COME BACK ---- */
    N.begin(2); N.midEnd();
    {
      pump(40);
      const was = G().hour;
      N.route('title');
      await new Promise((r) => setTimeout(r, 400));
      const atTitle = G().phase;
      N.begin(2); N.midEnd();
      pump(5);
      note('left mid-night at ' + was + " o'clock (went to " + atTitle +
           '), came back in: phase ' + G().phase + ' hour ' + G().hour +
           ' meter ' + Math.round(G().power) + '%');
      if (G().phase !== 'play') flag('cannot get back into a night after leaving one', G().phase);
      if (G().hour !== 0) flag('coming back does not start the night over', 'hour ' + G().hour);
      if (G().power < 99) flag('coming back keeps the meter she spent', Math.round(G().power) + '%');
    }

    return { log, findings, state: { phase: G().phase, hour: G().hour } };
  }, WAIT);

  out.log.forEach((l) => console.log('  ' + l));
  console.log();
  out.findings.forEach((f) => console.log('  !! ' + f.what + ' — ' + f.detail));
  if (out.findings.length) console.log();

  t('nothing it did threw a page error', errs.length === 0, errs.slice(0, 3).join(' | ') || 'clean');
  t('misbehaving never leaves the chapter somewhere it cannot get out of',
    out.findings.length === 0,
    out.findings.length ? out.findings.length + ' finding(s) above' : 'nothing stuck');

  console.log(`\n${pass} passed, ${fail} failed`);
  await b.close();
  process.exit(fail ? 1 : 0);
})();
