/* the shift itself, night after night, played rather than pumped */
module.exports = async function (c) {
  const { p, T, tap, card, shot, say, NIGHTS, SPEED } = c;

  /* WHAT SHE DOES WITH HER HANDS.
     Sweep the cameras, drop the monitor to save the meter, and shut a
     door the moment anything is at one. All of it through the real
     buttons, so a control that is unreachable or does nothing shows up
     as her dying rather than as a passing test. */
  const press = (k) => p.evaluate((kk) => {
    const el = document.querySelector(`#ns-pad [data-k="${kk}"]`);
    if (!el) return false;
    const r = el.getBoundingClientRect();
    const ev = (t) => new PointerEvent(t, { clientX: r.left + r.width / 2, clientY: r.top + r.height / 2,
                                            bubbles: true, cancelable: true, pointerId: 1, isPrimary: true });
    el.dispatchEvent(ev('pointerdown')); el.dispatchEvent(ev('pointerup'));
    return true;
  }, k);

  const peek = () => p.evaluate(() => {
    const N = OuissysNightShift.__night, G = N.state(), cast = N.cast();
    const at = { left: false, right: false, hatch: false };
    for (const id in cast) {
      const ch = cast[id];
      if (ch.awake && ch.atDoor && !ch.talking) at[ch.def.door] = true;
    }
    return { phase: G.phase, hour: G.hour, night: G.night, power: Math.round(G.power),
             doors: Object.assign({}, G.doors), at, monitor: !!G.monitor, cam: G.cam };
  });

  for (let night = 1; night <= NIGHTS; night++) {
    say(`\n############################## NIGHT ${night}`);
    let seenTape = '', seenSay = '', shots = 0, lastHour = -1, guard = 0;
    const start = Date.now();

    while (Date.now() - start < 1000 * 60 * 12) {
      guard++;
      const s = await peek().catch(() => null);
      if (!s) break;

      if (s.phase !== 'play') {
        const c2 = await card();
        if (c2.card) {
          say(`\n--- card [${c2.phase}] at ${s.hour} o'clock\n${c2.card}`);
          say('    buttons: ' + JSON.stringify(c2.buttons));
          await shot(`n${night}-card-${c2.phase}`);
        }
        if (c2.phase === 'over') { say(`  *** CAUGHT on night ${night} at ${s.hour} o'clock`); }
        /* press the thing it offers. KEEP over BURN on the odd nights,
           BURN on the even ones, so both branches get seen. */
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
        await T(2500);
        const after = await peek().catch(() => null);
        if (after && after.night > night) { say(`  (night ${night} is over)`); break; }
        if (after && after.phase === 'title') { say('  (back at the menu)'); break; }
        if (!after || after.phase === 'play') continue;
        if (guard > 400) break;
        continue;
      }

      /* doors: shut whatever is at one, open again when it is gone */
      for (const side of ['left', 'right', 'hatch']) {
        if (s.at[side] !== s.doors[side]) await press(side);
      }
      /* CAMERAS, THE WAY A PERSON USES THEM.

         The first version of this raised the monitor and then only ever
         pressed NEXT, so the monitor was never lowered -- which drains
         the meter, and which parks the tutorial for ever on "MONITOR:
         LOWER IT. IT DRAWS WHILE IT IS UP." A real player sweeps a few
         rooms and drops it. Up, three rooms, down, a beat in the dark. */
      c.sweep = (c.sweep || 0) + 1;
      const phase = c.sweep % 8;
      if (phase === 0) await press('monitor');            // up
      else if (phase < 4) await press('next');            // three rooms
      else if (phase === 4 && s.monitor) await press('monitor');  // down

      if (s.hour !== lastHour) {
        lastHour = s.hour;
        if (shots < 7) { await shot(`n${night}-h${s.hour}`); shots++; }
        say(`  ${s.hour} o'clock — power ${s.power}% — cam ${s.cam}`);
      }
      const c3 = await card();
      if (c3.tape && c3.tape !== seenTape) { seenTape = c3.tape; say('   " ' + c3.tape.replace(/\n/g, ' ')); }
      if (c3.says && c3.says !== seenSay) { seenSay = c3.says; say('   [ ' + c3.says.replace(/\n/g, ' ')); }
      if (c3.tutor) say('   (tutor) ' + c3.tutor.replace(/\n/g, ' '));
      await T(1400 / SPEED);
    }
  }

  say('\n############################## AFTER THE SIX');
  const c4 = await card();
  say(JSON.stringify(c4, null, 1));
  await shot('after-the-week');
};
