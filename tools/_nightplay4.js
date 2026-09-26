/* THE SHIFT, PLAYED FROM INSIDE THE PAGE.

   _nightplay3.js carried the clock but still crossed the wire for
   every single thing it did: read the state, read the card, press the
   monitor, press a door, pump. Six or seven `p.evaluate` round-trips a
   tick, and each one waits on a main thread that is busy drawing the
   shop at 0.7 frames a second, so a tick that is worth 1.4 seconds of
   game cost three and a half seconds of wall clock. Orientation alone
   took a quarter of an hour.

   The reaction window is what stops that being solved by simply
   pumping harder: `doorGrace` is 3.4 seconds for Jax, so a player who
   only looks every 2.5 seconds is a player who dies to him unfairly,
   and a suite that dies unfairly is measuring the suite.

   So the whole tick moves inside the page -- read, decide, dispatch
   the real pointer events on the real controls, pump -- and one round
   trip carries ten of them. The hands are no less real; they are just
   not waiting on a screenshot bus between fingers. The loop yields
   between ticks so the page's own rAF still runs and the picture is
   still a picture when a screenshot is taken between chunks. */
module.exports = async function (c) {
  const { p, T, card, shot, say, NIGHTS } = c;
  const WARP = Number(process.env.WARP || 1.4);     /* game-seconds a tick */
  const CHUNK = Number(process.env.CHUNK || 10);    /* ticks per round trip */

  /* one round trip: CHUNK ticks of read-decide-press-pump, and a
     written record of everything the screen said while they ran */
  const run = (warp, ticks) => p.evaluate(async ([warp, ticks]) => {
    const H = OuissysNightShift.__night;
    const log = [];
    const t0 = performance.now();
    const txt = (id) => { const e = document.getElementById(id);
                          return e ? (e.innerText || '').trim() : ''; };
    /* THE PAD DEBOUNCES AT 320 MILLISECONDS, AND A THUMB DOES TOO.

       Every button in the pad answers pointerdown AND click and guards
       the pair with `if (t - b.__wkT < 320) return;`, which is right:
       it is what stops one tap counting twice.

       This loop's ticks are about 94 milliseconds apart in wall clock,
       because almost all of a tick is pumpFrame and none of it is a
       person deciding. So the driver was pressing the same key three or
       four times inside one debounce window and losing the press it
       wanted along with the ones it did not: it hammered LEFT for
       fourteen ticks trying to open a door with nothing behind it, and
       when Cogsworth actually arrived the shut landed inside a window
       and was dropped. He got in. The log said `found=true
       blackout=false phase=play shut=true` -- the button was reached
       and the door did not move -- which reads like the game refusing a
       door and was this instead.

       So it waits its turn, the way a hand does. Nothing in a tick is
       urgent enough to mind: Jax gives her 3.4 seconds at a door and
       this costs a third of one. */
    /* Waiting out the window on EVERY press made a chunk cost half a
       minute, because parking the camera means pressing NEXT up to
       eight times in a row and each one stood in the queue. A camera is
       not urgent -- it can wait for the tick after. A door is, so a
       door waits and a camera is simply skipped when its turn has not
       come round. */
    const HOLD = 340;
    const lastAt = {};
    const press = async (k, soft) => {
      const el = document.querySelector('#ns-pad [data-k="' + k + '"]');
      if (!el) return false;
      const since = performance.now() - (lastAt[k] || -1e9);
      if (since < HOLD) {
        if (soft) return 'waiting';
        await new Promise((r2) => setTimeout(r2, HOLD - since));
      }
      const r = el.getBoundingClientRect();
      const ev = (t) => new PointerEvent(t, { clientX: r.left + r.width / 2,
        clientY: r.top + r.height / 2, bubbles: true, cancelable: true,
        pointerId: 1, isPrimary: true });
      el.dispatchEvent(ev('pointerdown')); el.dispatchEvent(ev('pointerup'));
      lastAt[k] = performance.now();
      return true;
    };
    const wind = async () => {
      const el = document.getElementById('ns-key');
      if (!el || el.hidden) return false;
      const r = el.getBoundingClientRect();
      const ev = (t) => new PointerEvent(t, { clientX: r.left + r.width / 2,
        clientY: r.top + r.height / 2, bubbles: true, cancelable: true,
        pointerId: 1, isPrimary: true });
      el.dispatchEvent(ev('pointerdown'));
      /* WIND.hold is 1.15s of WALL clock, checked inside playStep --
         so the hold has to be real time AND have steps run inside it */
      const t0 = performance.now();
      while (performance.now() - t0 < 1500) { H.pumpFrame(1 / 30);
        await new Promise((r2) => setTimeout(r2, 30)); }
      el.dispatchEvent(ev('pointerup'));
      return true;
    };

    const CASTIDS = H.castDefs().map((d) => d.id);
    window.__sweep = window.__sweep || 0;
    let seen = { tape: '', say: '', tutor: '', hour: -1 };
    const ring = [];
    const note = (G, at) => {
      const d = (o) => (o.left ? 'L' : '-') + (o.right ? 'R' : '-') + (o.hatch ? 'H' : '-');
      ring.push(G.hour + ':' + Math.round(G.power) + '% doors=' + d(G.doors)
                + ' at=' + d(at) + (G.monitor ? ' cam=' + G.cam : ' down'));
      if (ring.length > 10) ring.shift();
    };
    for (let i = 0; i < ticks; i++) {
      const G = H.state();
      if (G.phase !== 'play') { log.push('!phase ' + G.phase); break; }

      const tutor = txt('ns-tutor');
      if (tutor) {
        if (tutor !== seen.tutor) { seen.tutor = tutor; log.push('(tutor) ' + tutor.replace(/\n/g, ' ')); }
        const w = tutor.toUpperCase();
        if (w.indexOf('MONITOR: RAISE') >= 0 && !G.monitor) await press('monitor');
        else if (w.indexOf('MONITOR: LOWER') >= 0 && G.monitor) await press('monitor');
        else if (w.indexOf('STEP THROUGH THE ROOMS') >= 0) { await press(G.monitor ? 'next' : 'monitor'); }
        else if (w.indexOf('WEST DOOR: CLOSE') >= 0 && !G.doors.left) await press('left');
        else if (w.indexOf('SHUT DOOR HOLDS') >= 0 && G.doors.left) await press('left');
        else if (w.indexOf('HATCH: LATCH') >= 0 && !G.doors.hatch) await press('hatch');
        else if (w.indexOf('UNLATCH') >= 0 && G.doors.hatch) await press('hatch');
        else if (w.indexOf('FIND HIM') >= 0) { await press(G.monitor ? 'next' : 'monitor'); }
        else if (w.indexOf('HOLD IT') >= 0 || w.indexOf('KEY IN HIS BACK') >= 0) await wind();
        /* the untimed lines are `hold:` timers inside playStep */
        for (let n = 0; n < warp * 30; n++) if (H.pumpFrame(1 / 30) !== 'play') break;
        continue;
      }

      /* doors: shut whatever is at one, open again the moment it is gone */
      /* AND IT READS THE SIGNAL THE PLAYER IS GIVEN, NOT A DIFFERENT ONE.

         This carried `&& !ch.talking` down from the first driver, so a
         toy that started speaking while it stood at a door stopped
         counting as being at one. The rule below then saw at=false,
         doors=true, and OPENED the door on it -- and `toggleDoor` is
         explicit about what that buys you: "opening a door on something
         standing behind it gives you a moment, and only a moment",
         1.3 seconds, which is shorter than a tick. Night five died that
         way six times and night six four, always the same shape:
         `doors=-R- at=-R-` held for three ticks, then `at=L--` while
         she was still behind it, then dead.

         The shop never lied about it. The edge of the screen warms from
         `ch.awake && ch.atDoor` with no such exclusion, so the amber
         stays lit the whole time one of them is talking at a door and a
         player watching the screen keeps it shut. The driver was
         reading a different signal from the one the game shows. Now it
         reads the same one. */
      const cast = H.cast();
      const at = { left: false, right: false, hatch: false };
      for (const id in cast) { const ch = cast[id];
        if (ch.awake && ch.atDoor) at[ch.def.door] = true; }
      note(G, at);
      for (const side of ['left', 'right', 'hatch'])
        if (at[side] !== G.doors[side]) {
          const found = await press(side);
          /* A PRESS THAT DOES NOT MOVE THE DOOR IS THE ONLY THING WORTH
             A LINE IN THE LOG. "She was caught" is not a diagnosis. */
          if (G.doors[side] !== at[side])
            log.push('   !! ' + side + ' would not move: found=' + found
                     + ' blackout=' + !!G.blackout + ' phase=' + G.phase
                     + ' mon=' + !!G.monitor + ' shut=' + !!G.doors[side]);
        }

      /* AND SHE PLAYS THE WAY THE GAME TELLS HER TO.

         The first version of this swept the cameras on a fixed cycle --
         up, three rooms, down -- and lost night one five times running.
         The card it lost to says, in Marabelle's own words, what it was
         doing wrong: "Frozen while she is on camera. Moves the moment
         you look away. ... do not take your eyes off me."

         A suite that ignores the one instruction the game stops the
         night to give her is not measuring the game, it is measuring
         the suite. So when Marabelle is awake and not yet at a door,
         the monitor goes up and parks on her, which is the whole point
         of her -- she is the reason the cameras cost something. The
         sweep is what happens when there is nothing to hold. */
      /* AND SHE LISTENS TO THE OTHER HALF OF THE INSTRUCTION TOO.

         Night two, at ten past two, in his voice: "Do not look at her
         all night, though. You will lose the meter and she will still
         be there." The driver did exactly that -- parked on Marabelle
         from midnight -- and ran the reserve to nothing at five, went
         dark, and Jax walked in. That is the game being right: the
         warning exists, it is specific, and ignoring it costs the
         night.

         So the camera is a thing she can afford, not a thing she does.
         Below forty-five per cent the monitor stays down and the doors
         do the work, which is what he told her on the first night --
         a shut door holds. */
      const mara = cast.marabelle;
      const hold = mara && mara.awake && !mara.atDoor && !mara.asleep
                   && G.power > 45 ? mara.room : null;

      /* WIND THE FOUR, WHICH IS WHAT THE NOTE ASKED FOR.

         _nightplay2 and 3 never wound anything after orientation, so
         every night was played the one way the game tells her not to.
         If one of his is on the feed she is looking at and it is
         running low, she winds it -- which is also the only way the
         keeper beat, the wound-one lines and the meter cost ever get
         exercised by a playthrough. */
      let wound = false;
      /* WINDING IS NOT A LUXURY, AND THE LOW-POWER RULE WAS TREATING IT
         AS ONE.

         Below forty-five per cent the monitor goes down to save meter.
         But a wind needs the monitor up, so at low power the driver
         stopped winding entirely -- and night five's own instruction is
         "Wind all four of them tonight. A key in the back, about a
         second each." A run that saved meter by not winding blacked out
         at five with all four of his run down to zero and nothing
         standing between her and the door.

         So the rule is about IDLE camera time, not about work: when any
         of his four is empty, the monitor may come up to fix that
         however low the meter is. */
      const runDown = CASTIDS.some((id) => cast[id] && cast[id].awake
                                           && (cast[id].wound || 0) <= 0);
      /* and never with something at a door: a wind is a second and a
         half of both hands, and Jax gives her three and a bit */
      const clear = !at.left && !at.right && !at.hatch;
      if ((G.monitor || runDown) && clear) {
        if (!G.monitor) await press('monitor');
        for (const id in cast) { const ch = cast[id];
          if (ch.def && ch.def.door && ch.room === G.cam && !ch.atDoor && (ch.wound || 0) < 1.5) {
            wound = await wind(); break; } }
      }

      if (!wound) {
        if (hold) {
          /* hold the camera on her */
          if (!G.monitor) await press('monitor', true);
          else if (G.cam !== hold) await press('next', true);
        } else if (G.power < 45 && !runDown) {
          /* low: the monitor goes down and stays down */
          if (G.monitor) await press('monitor', true);
        } else {
          /* nothing to watch: sweep, and put the monitor down again,
             because it draws the whole time it is up */
          const ph = (window.__sweep++) % 8;
          if (ph === 0) await press('monitor', true);
          else if (ph < 4) await press('next', true);
          else if (ph === 4 && G.monitor) await press('monitor', true);
        }
      }

      if (G.hour !== seen.hour) { seen.hour = G.hour;
        const where = [];
        for (const id in cast) if (cast[id].awake)
          where.push(id + '@' + (cast[id].room || '?') + (cast[id].atDoor ? '!' : '')
                     + '·' + Math.round(cast[id].wound || 0));
        const shut = ['left', 'right', 'hatch'].filter((k) => G.doors[k]);
        log.push('  ' + G.hour + " o'clock — power " + Math.round(G.power)
                 + '% — cam ' + (G.monitor ? G.cam : 'down')
                 + (shut.length ? ' — shut: ' + shut.join(',') : '')
                 + ' — ' + where.join(' ')); }
      const tp = txt('ns-tape'), sy = txt('ns-say');
      if (tp && tp !== seen.tape) { seen.tape = tp; log.push('   " ' + tp.replace(/\n/g, ' ')); }
      if (sy && sy !== seen.say) { seen.say = sy; log.push('   [ ' + sy.replace(/\n/g, ' ')); }

      for (let n = 0; n < warp * 30; n++) if (H.pumpFrame(1 / 30) !== 'play') break;
    }
    /* ONE FRAME AT THE END, NOT ONE PER TICK.

       The loop used to hand the page back between every tick so its own
       rAF could run. A frame costs a second and a half here, so ten
       ticks bought fourteen seconds of rendering nobody was going to
       look at -- the screenshots are capped at seven a night and they
       are taken between chunks. One yield at the end is enough to leave
       a current picture on the glass for whoever takes one. */
    await new Promise((r2) => setTimeout(r2, 0));
    const G = H.state();
    const killed = G.killChar && G.killChar.def ? G.killChar.def.name
                 : (G.dead && G.dead.def ? G.dead.def.name : null);
    return { log: log, phase: G.phase, hour: G.hour, night: G.night, power: Math.round(G.power),
             ms: Math.round(performance.now() - t0),
             last: (killed ? killed + ' — ' : '') + ring.join(' | ') };
  }, [warp, ticks]);

  /* FROM=5 starts the week at night five. The story state a real
     player would be carrying is not there, so this is for looking at
     one night's shape after a change, never for judging the week. */
  const FROM = Number(process.env.FROM || 1);
  if (FROM > 1) {
    say(`\n(starting at night ${FROM}, so the four before it are not played)`);
    await p.evaluate((n) => OuissysNightShift.__night.begin(n), FROM);
    await T(1500);
  }
  for (let night = FROM; night <= NIGHTS; night++) {
    say(`\n############################## NIGHT ${night}`);
    let shots = 0, lastHour = -1, guard = 0;
    const start = Date.now();

    while (Date.now() - start < 1000 * 60 * 20) {
      if (++guard > 600) { say('  !! guard tripped, night abandoned'); break; }
      const r = await run(WARP, CHUNK).catch((e) => ({ err: e.message }));
      if (r.err) { say('  !! ' + r.err); break; }
      r.log.forEach((l) => say(l));
      if (guard === 1 || r.ms > 20000)
        say(`  (a chunk of ${CHUNK} ticks cost ${r.ms}ms in the page)`);

      if (r.hour !== lastHour && r.phase === 'play') {
        lastHour = r.hour;
        if (shots < 7) { await shot(`n${night}-h${r.hour}`); shots++; }
      }
      if (r.phase === 'play') continue;
      if (r.phase === 'over' && r.last) {
        /* THE LAST FEW SECONDS, WHICH IS THE ONLY PART THAT EXPLAINS IT.
           `G.killChar` is a live scene node, so it cannot come back over
           the wire -- everything here is flattened to a string in the
           page before it leaves. */
        say('  (the last ticks: ' + r.last + ')');
      }

      const c2 = await card();
      if (c2.card) {
        say(`\n--- card [${c2.phase}] at ${r.hour} o'clock\n${c2.card}`);
        say('    buttons: ' + JSON.stringify(c2.buttons));
        await shot(`n${night}-card-${c2.phase}`);
      }
      if (c2.phase === 'over') say(`  *** CAUGHT on night ${night} at ${r.hour} o'clock`);
      const pressed = await p.evaluate((wantBurn) => {
        const bs = [].slice.call(document.querySelectorAll('#ns-overlay [data-go]'));
        if (!bs.length) return null;
        const burn = bs.filter((x) => x.getAttribute('data-go') === 'burn')[0];
        const keep = bs.filter((x) => x.getAttribute('data-go') === 'keep')[0];
        const go = (wantBurn && burn) || keep ||
                   bs.filter((x) => x.classList.contains('ns-btn-go'))[0] || bs[0];
        const t = go.innerText.trim(); go.click(); return t;
      }, night % 2 === 0);
      if (pressed) say('  pressed: ' + pressed);
      await T(1600);
      const st = await p.evaluate(() => { const G = OuissysNightShift.__night.state();
                                          return { phase: G.phase, night: G.night }; }).catch(() => null);
      if (st && st.night > night) { say(`  (night ${night} is over)`); break; }
      if (st && st.phase === 'title') { say('  (back at the menu)'); break; }
    }
  }

  say('\n############################## AFTER THE SIX');
  say(JSON.stringify(await card(), null, 1));
  await shot('after-the-week');
};
