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
    const txt = (id) => { const e = document.getElementById(id);
                          return e ? (e.innerText || '').trim() : ''; };
    const press = (k) => {
      const el = document.querySelector('#ns-pad [data-k="' + k + '"]');
      if (!el) return false;
      const r = el.getBoundingClientRect();
      const ev = (t) => new PointerEvent(t, { clientX: r.left + r.width / 2,
        clientY: r.top + r.height / 2, bubbles: true, cancelable: true,
        pointerId: 1, isPrimary: true });
      el.dispatchEvent(ev('pointerdown')); el.dispatchEvent(ev('pointerup'));
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

    window.__sweep = window.__sweep || 0;
    let seen = { tape: '', say: '', tutor: '', hour: -1 };
    for (let i = 0; i < ticks; i++) {
      const G = H.state();
      if (G.phase !== 'play') { log.push('!phase ' + G.phase); break; }

      const tutor = txt('ns-tutor');
      if (tutor) {
        if (tutor !== seen.tutor) { seen.tutor = tutor; log.push('(tutor) ' + tutor.replace(/\n/g, ' ')); }
        const w = tutor.toUpperCase();
        if (w.indexOf('MONITOR: RAISE') >= 0 && !G.monitor) press('monitor');
        else if (w.indexOf('MONITOR: LOWER') >= 0 && G.monitor) press('monitor');
        else if (w.indexOf('STEP THROUGH THE ROOMS') >= 0) { G.monitor ? press('next') : press('monitor'); }
        else if (w.indexOf('WEST DOOR: CLOSE') >= 0 && !G.doors.left) press('left');
        else if (w.indexOf('SHUT DOOR HOLDS') >= 0 && G.doors.left) press('left');
        else if (w.indexOf('HATCH: LATCH') >= 0 && !G.doors.hatch) press('hatch');
        else if (w.indexOf('UNLATCH') >= 0 && G.doors.hatch) press('hatch');
        else if (w.indexOf('FIND HIM') >= 0) { G.monitor ? press('next') : press('monitor'); }
        else if (w.indexOf('HOLD IT') >= 0 || w.indexOf('KEY IN HIS BACK') >= 0) await wind();
        /* the untimed lines are `hold:` timers inside playStep */
        for (let n = 0; n < warp * 30; n++) if (H.pumpFrame(1 / 30) !== 'play') break;
        await new Promise((r2) => setTimeout(r2, 0));
        continue;
      }

      /* doors: shut whatever is at one, open again the moment it is gone */
      const cast = H.cast();
      const at = { left: false, right: false, hatch: false };
      for (const id in cast) { const ch = cast[id];
        if (ch.awake && ch.atDoor && !ch.talking) at[ch.def.door] = true; }
      for (const side of ['left', 'right', 'hatch'])
        if (at[side] !== G.doors[side]) press(side);

      /* WIND THE FOUR, WHICH IS WHAT THE NOTE ASKED FOR.

         _nightplay2 and 3 never wound anything after orientation, so
         every night was played the one way the game tells her not to.
         If one of his is on the feed she is looking at and it is
         running low, she winds it -- which is also the only way the
         keeper beat, the wound-one lines and the meter cost ever get
         exercised by a playthrough. */
      let wound = false;
      if (G.monitor) {
        for (const id in cast) { const ch = cast[id];
          if (ch.def && ch.def.door && ch.room === G.cam && !ch.atDoor && (ch.wound || 0) < 3) {
            wound = await wind(); break; } }
      }

      /* cameras, the way a person uses them: up, three rooms, down */
      if (!wound) {
        const ph = (window.__sweep++) % 8;
        if (ph === 0) press('monitor');
        else if (ph < 4) press('next');
        else if (ph === 4 && G.monitor) press('monitor');
      }

      if (G.hour !== seen.hour) { seen.hour = G.hour;
        const where = [];
        for (const id in cast) if (cast[id].awake)
          where.push(id + '@' + (cast[id].room || '?') + (cast[id].atDoor ? '!' : '')
                     + '·' + Math.round(cast[id].wound || 0));
        log.push('  ' + G.hour + " o'clock — power " + Math.round(G.power)
                 + '% — cam ' + G.cam + ' — ' + where.join(' ')); }
      const tp = txt('ns-tape'), sy = txt('ns-say');
      if (tp && tp !== seen.tape) { seen.tape = tp; log.push('   " ' + tp.replace(/\n/g, ' ')); }
      if (sy && sy !== seen.say) { seen.say = sy; log.push('   [ ' + sy.replace(/\n/g, ' ')); }

      for (let n = 0; n < warp * 30; n++) if (H.pumpFrame(1 / 30) !== 'play') break;
      await new Promise((r2) => setTimeout(r2, 0));
    }
    const G = H.state();
    return { log: log, phase: G.phase, hour: G.hour, night: G.night, power: Math.round(G.power) };
  }, [warp, ticks]);

  for (let night = 1; night <= NIGHTS; night++) {
    say(`\n############################## NIGHT ${night}`);
    let shots = 0, lastHour = -1, guard = 0;
    const start = Date.now();

    while (Date.now() - start < 1000 * 60 * 20) {
      if (++guard > 600) { say('  !! guard tripped, night abandoned'); break; }
      const r = await run(WARP, CHUNK).catch((e) => ({ err: e.message }));
      if (r.err) { say('  !! ' + r.err); break; }
      r.log.forEach((l) => say(l));

      if (r.hour !== lastHour && r.phase === 'play') {
        lastHour = r.hour;
        if (shots < 7) { await shot(`n${night}-h${r.hour}`); shots++; }
      }
      if (r.phase === 'play') continue;

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
