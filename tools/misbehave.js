/* A NEW PLAYER DOES NOT FOLLOW THE SCRIPT.

   Every other suite here plays properly: it shuts a door when
   something is behind it, it winds the four, it presses the button the
   card offers. That is the happy path, and the happy path is the one
   part of this chapter that has already been walked a hundred times.

   This does the opposite on purpose, the way somebody who has never
   seen it does:

     opens the door WITH something standing behind it, which is the one
       thing the note tells her not to do;
     opens it and panics and shuts it again a half second later;
     holds every door shut all night and never winds a thing;
     hammers every control as fast as it will take it;
     presses the pad and the keys while a card is up;
     mashes the pause;
     walks out of the chapter mid-night and comes back in.

   What it is looking for is not "did she die" -- dying is allowed and
   mostly correct. It is looking for the things that should never
   happen whatever she does: a page error, a phase the chapter cannot
   leave, a card with no button, the pad and the game disagreeing about
   which doors are shut, a night that will not start over.

   IT PRESSES THE BUTTONS. Poking G.doors by hand is not the same
   action: the clamp that gives her a moment when she opens a door on
   something -- ch.doorT = min(doorT, 1.3) -- lives inside toggleDoor,
   so a test that sets the flag directly measures a mechanic that was
   never invoked. Everything here goes through the pad, which means
   living with its 320ms debounce and waiting between presses. */
const { chromium } = require('playwright-core');

let pass = 0, fail = 0;
const t = (n, c, note) => { c ? pass++ : fail++;
  console.log(`${c ? 'PASS' : 'FAIL'}  ${n}${note !== undefined ? '   ' + note : ''}`); };

const WAIT = Number(process.env.WAIT || 420);

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox', '--no-proxy-server', '--use-gl=swiftshader', '--enable-unsafe-swiftshader',
           '--autoplay-policy=no-user-gesture-required'] });
  const p = await b.newPage({ viewport: { width: 900, height: 600 } });
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  await p.route('**/*', (r) => r.request().url().startsWith('http://127.0.0.1') ? r.continue() : r.abort());
  await p.goto('http://127.0.0.1:8899/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.evaluate(() => { try { localStorage.clear(); localStorage.setItem('ns_notutor', '1'); } catch (e) {}
    showScreen('nightshift');
    return loadChapter('nightshift').then(() => OuissysNightShift.start()); });
  await p.waitForFunction(() => { try { return !!OuissysNightShift.__night.cast().jax; } catch (e) { return false; } },
                          /* the second positional is the ARGUMENT, not the
                             options: passing options there silently leaves
                             the 30s default in place, which is how a boot
                             that takes 40s on a busy container came back as
                             "Timeout 30000ms exceeded" against a stated
                             180000 */
                          null, { timeout: 180000, polling: 500 });
  await p.waitForTimeout(1200);

  const out = await p.evaluate(async (WAIT) => {
    const N = OuissysNightShift.__night;
    const log = [];
    const note = (s) => log.push(s);
    const G = () => N.state();
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

    /* a real press on a real control, the way a thumb makes one */
    const press = (k) => {
      const el = document.querySelector('#ns-pad [data-k="' + k + '"]');
      if (!el) return false;
      const r = el.getBoundingClientRect();
      const ev = (ty) => new PointerEvent(ty, { clientX: r.left + r.width / 2, clientY: r.top + r.height / 2,
        bubbles: true, cancelable: true, pointerId: 1, isPrimary: true });
      el.dispatchEvent(ev('pointerdown')); el.dispatchEvent(ev('pointerup'));
      return true;
    };
    /* ...and one that is allowed to land, debounce and all */
    const tap = async (k) => { press(k); await sleep(340); };
    const key = (code) => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: code, bubbles: true }));
      document.dispatchEvent(new KeyboardEvent('keyup', { key: code, bubbles: true }));
    };
    const cardButtons = () => [].slice.call(
      document.querySelectorAll('#ns-overlay [data-go], .ns-card [data-go]'));
    /* wait for the real frame loop to put a card up, however slowly it
       is running: up to twelve seconds, then give up and let the
       assertion speak */
    const p_waitCard = async () => {
      for (let i = 0; i < 60; i++) {
        if (document.querySelectorAll('#ns-overlay [data-go], .ns-card [data-go]').length) return true;
        await sleep(200);
      }
      return false;
    };
    const pump = (secs) => { for (let i = 0; i < secs * 30; i++) if (N.pumpFrame(1 / 30) !== 'play') return false;
                             return true; };

    const findings = [];
    const flag = (what, detail) => findings.push({ what, detail });

    /* ---- 1. OPEN THE DOOR ON SOMETHING, WHICH IS THE ONE RULE ---- */
    N.begin(3); N.midEnd();
    {
      const who = 'cogsworth', side = 'left';
      /* hold it shut first, so walking him up to it is safe */
      if (!G().doors[side]) await tap(side);
      N.only(who);
      const cast = N.cast();
      for (let i = 0; i < 120 && !cast[who].atDoor; i++) N.pumpFrame(1 / 30);
      if (!cast[who].atDoor) flag('setup', 'could not get ' + who + ' to a door');
      else {
        const held = cast[who].doorT;
        await tap(side);                                  /* OPEN IT ON HIM */
        const grace = cast[who].doorT;
        note('the west door opened with ' + who + ' behind it: ' +
             held.toFixed(2) + 's of patience became ' + grace.toFixed(2) + 's');
        if (grace > 1.4)
          flag('opening a door on one of them costs her nothing',
               grace.toFixed(2) + 's still on the clock — the moment is not a moment');
        /* and the moment must actually run out, not hang */
        let ended = 0;
        for (let i = 0; i < 300; i++) { if (N.pumpFrame(1 / 30) !== 'play') break; ended++; }
        note('it took ' + (ended / 30).toFixed(2) + 's for that to end in ' + G().phase);
        if (G().phase === 'play')
          flag('she can stand in an open door with one of them in it forever', 'ten seconds, nothing');
        if (G().phase === 'over') {
          /* THE CARD IS NOT UP THE INSTANT SHE IS CAUGHT.

             kill() calls noOverlay() and sets deadT to zero: the face
             is in the lens for 1.15 seconds of real frames before
             screenOver() draws anything. pumpFrame only steps play, so
             no amount of pumping brings the card -- it needs the real
             loop, which in this container runs at about one frame a
             second. An earlier pass waited half a second, found no
             buttons, and reported a card with no way out. */
          await p_waitCard();
          const bs = cardButtons();
          note('the caught card offers ' + bs.length + ' way(s) out: ' +
               bs.map((x) => x.innerText.trim()).join(' / '));
          if (!bs.length) flag('the caught card has no button', 'nothing to press');
        }
      }
    }

    /* ---- 1b. OPEN IT AND PANIC AND SHUT IT AGAIN ---- */
    N.begin(3); N.midEnd();
    {
      const who = 'cogsworth', side = 'left';
      if (!G().doors[side]) await tap(side);
      N.only(who);
      const cast = N.cast();
      for (let i = 0; i < 120 && !cast[who].atDoor; i++) N.pumpFrame(1 / 30);
      if (cast[who].atDoor) {
        await tap(side);                                  /* open */
        for (let i = 0; i < 15; i++) N.pumpFrame(1 / 30);  /* half a second of regret */
        const left = cast[who].doorT;
        await tap(side);                                  /* shut it again */
        let alive = true;
        for (let i = 0; i < 300; i++) if (N.pumpFrame(1 / 30) !== 'play') { alive = false; break; }
        note('opened it and shut it again after half a second (' + left.toFixed(2) +
             's left): she ' + (alive ? 'lived' : 'did not') + ', phase ' + G().phase +
             ', he is ' + (cast[who].atDoor ? 'still at the door' : 'gone from it'));
        if (!alive)
          flag('shutting the door again does not save her',
               'the clamp gives 1.3s and she used 0.5 of it');
      }
    }

    /* ---- 2. EVERY DOOR SHUT ALL NIGHT, NOTHING EVER WOUND ---- */
    N.begin(4); N.midEnd();
    {
      /* THE STORY CARDS ARE NOT THE END OF THE NIGHT.

         A held night still finds the page and still turns three
         o'clock, and both put a card up and take the phase off
         'play'. An earlier pass read that as the night ending and
         reported "ended in held at 1 o'clock", which proved nothing
         about whether a night of held doors ever finishes. Walk
         through them the way she would -- press the one button they
         offer -- and only stop at an ending. */
      let blacked = false, cards = 0;
      for (let i = 0; i < WAIT * 30; i++) {
        G().doors.left = G().doors.right = G().doors.hatch = true;
        if (G().blackout) blacked = true;
        if (N.pumpFrame(1 / 30) !== 'play') {
          const ph = G().phase;
          if (ph === 'reveal' || ph === 'held') {
            cards++;
            try { N.route(ph === 'held' ? 'heldOut' : 'keep'); } catch (e) {}
            if (G().phase === 'play') continue;
            flag('a story card on a held night will not let her back out',
                 ph + ' stayed ' + G().phase);
          }
          break;
        }
      }
      note('walked past ' + cards + ' story card(s) on the way');
      note('doors held all night, nothing wound: ended in ' + G().phase +
           ' at ' + G().hour + " o'clock, meter " + Math.round(G().power) + '%' +
           (blacked ? ', went dark on the way' : ''));
      if (G().phase === 'play')
        flag('a night of nothing but held doors never ends',
             'still playing after ' + WAIT + 's of game clock');
    }

    /* ---- 3. HAMMER EVERY CONTROL ---- */
    N.begin(2); N.midEnd();
    {
      for (let i = 0; i < 400; i++) {
        press(['left', 'right', 'hatch', 'monitor', 'next', 'prev'][i % 6]);
        key([' ', 'a', 'd', 'w', 'ArrowLeft', 'ArrowRight', '1', '8'][i % 8]);
        if (i % 7 === 0) N.pumpFrame(1 / 30);
      }
      note('four hundred presses and keys as fast as they go: phase ' + G().phase +
           ', doors ' + JSON.stringify(G().doors) + ', monitor ' + !!G().monitor);
      /* and then a dozen that the debounce actually lets through */
      for (let i = 0; i < 12; i++) { await tap(['left', 'right', 'hatch', 'monitor'][i % 4]);
                                     N.pumpFrame(1 / 30); }
      note('twelve slow ones after it: doors ' + JSON.stringify(G().doors) +
           ', monitor ' + !!G().monitor + ', phase ' + G().phase);
      /* the pad's own lights must still agree with the game */
      const padOn = {};
      document.querySelectorAll('#ns-pad [data-k]').forEach((el) => {
        padOn[el.dataset.k] = el.classList.contains('on'); });
      ['left', 'right', 'hatch'].forEach((k) => {
        if (!!G().doors[k] !== !!padOn[k])
          flag('the pad disagrees with the doors after hammering',
               k + ': game says ' + !!G().doors[k] + ', the button is lit ' + !!padOn[k]);
      });
      if (!!G().monitor !== !!padOn.monitor)
        flag('the pad disagrees with the monitor after hammering',
             'game ' + !!G().monitor + ', button lit ' + !!padOn.monitor);
    }

    /* ---- 4. MASH THE PAUSE ---- */
    {
      if (G().phase !== 'play') { N.begin(2); N.midEnd(); }
      for (let i = 0; i < 40; i++) { N.pauseNow(); N.pumpFrame(1 / 30); }
      note('forty pauses later the phase is ' + G().phase);
      if (G().phase !== 'play' && G().phase !== 'pause')
        flag('mashing the pause leaves it somewhere else entirely', G().phase);
      if (G().phase === 'pause') { N.pauseNow(); N.pumpFrame(1 / 30); }
      if (G().phase !== 'play') flag('it will not come back from pause', G().phase);
    }

    /* ---- 5. PRESS THINGS THE INSTANT A CARD ARRIVES ---- */
    N.begin(5); N.midEnd();
    {
      /* THE PRESS THAT WAS ALREADY ON ITS WAY.

         The fault is not "a player presses a button on a card". It is
         that space is the monitor key during play AND the card's OK
         key the moment play stops, so the flick she started before
         anything happened lands on the card that has just replaced
         what she was looking at.

         Reproducing that needs the press to arrive in the same
         instant the card does, and wall-clock waiting cannot do it
         here: this container renders at about one frame a second and
         a setTimeout(200) comes back a second and a half late, which
         is how an earlier pass "hammered immediately" a full second
         after the card and concluded the guard did nothing. A
         MutationObserver on the overlay runs as a microtask off the
         same innerHTML write, so the keys go in with the card's ink
         still wet -- which is exactly the hand already in motion. */
      let ageAtPress = null, phaseAfter = null, fired = false;
      const obs = new MutationObserver(() => {
        if (fired) return;
        if (!document.querySelector('#ns-overlay [data-go]')) return;
        fired = true;
        ageAtPress = N.cardAge();
        for (let i = 0; i < 12; i++) { key(' '); key('Enter'); }
        phaseAfter = G().phase;
      });
      obs.observe(document.getElementById('ns-overlay'), { childList: true, subtree: true });
      N.catchNow('jax');
      await p_waitCard();
      obs.disconnect();
      note('the caught card was ' + ageAtPress + 's old when twenty-four keys hit it: phase ' +
           phaseAfter + (fired ? '' : ' (the observer never fired)'));
      if (!fired) flag('the check could not press the card as it arrived', 'no mutation seen');
      else if (phaseAfter !== 'over')
        flag('a key already in flight dismisses the card that says who reached her',
             'over -> ' + phaseAfter + ' at ' + ageAtPress + 's old');

      /* and now the slower, deliberate hammering: it may well get out,
         but the card must still be there to get out OF */
      const ph = G().phase;
      for (let i = 0; i < 60; i++) {
        press(['left', 'right', 'hatch', 'monitor', 'next'][i % 5]);
        key([' ', 'a', 'd', 'w'][i % 4]);
      }
      note('and sixty more presses after that: phase ' + G().phase +
           ' (card ' + N.cardAge() + 's old)');

      if (G().phase === ph) {
        const bs = cardButtons();
        if (!bs.length) flag('the card has no way out', 'phase ' + ph);
        else {
          /* the keyboard must still WORK, deliberately, a moment later:
             the guard is a moment's deafness, not a deaf card */
          await sleep(1200);
          key('Enter');
          await sleep(1200);
          note('a deliberate Enter afterwards: phase ' + G().phase);
          if (G().phase === ph) {
            flag('the card cannot be answered from the keyboard at all',
                 'Enter did nothing to ' + ph + ' seconds after it came up');
            const go = bs.filter((x) => x.classList.contains('ns-btn-go'))[0] || bs[0];
            go.click();
            await sleep(2000);
            note('pressed "' + go.innerText.trim() + '" instead: phase ' + G().phase);
            if (G().phase === ph) flag('the only button on the card does nothing', ph);
          }
        }
      }
    }

    /* ---- 6. WALK OUT MID-NIGHT AND COME BACK ---- */
    N.begin(2); N.midEnd();
    {
      pump(40);
      const was = G().hour, spent = Math.round(G().power);
      N.route('title');
      await sleep(600);
      const atTitle = G().phase;
      N.begin(2); N.midEnd();
      pump(5);
      note('left mid-night at ' + was + " o'clock on " + spent + '% (went to ' + atTitle +
           '), came back in: phase ' + G().phase + ', hour ' + G().hour +
           ', meter ' + Math.round(G().power) + '%');
      if (G().phase !== 'play') flag('she cannot get back into a night after leaving one', G().phase);
      if (G().hour !== 0) flag('coming back does not start the night over', 'hour ' + G().hour);
      if (G().power < 99) flag('coming back keeps the meter she already spent',
                               Math.round(G().power) + '%');
    }

    return { log, findings };
  }, WAIT);

  out.log.forEach((l) => console.log('  ' + l));
  console.log();
  out.findings.forEach((f) => console.log('  !! ' + f.what + ' — ' + f.detail));
  if (out.findings.length) console.log();

  t('nothing she did off-script threw a page error', errs.length === 0,
    errs.slice(0, 3).join(' | ') || 'clean');
  t('misbehaving never leaves the chapter somewhere it cannot get out of',
    out.findings.length === 0,
    out.findings.length ? out.findings.length + ' finding(s) above' : 'nothing stuck');

  console.log(`\n${pass} passed, ${fail} failed`);
  await b.close();
  process.exit(fail ? 1 : 0);
})();
