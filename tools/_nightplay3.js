/* THE SHIFT, PLAYED THROUGH -- WITH THE CLOCK CARRIED.

   _nightplay2.js plays the nights on the wall clock, which is the
   honest way and the only way on a phone. It cannot be done here. This
   container draws the shop at 0.7 frames a second at laptop size and
   1.8 at a quarter of it, and the frame loop clamps dt to a tenth of a
   second so a backgrounded tab cannot skip a night. The two together
   mean the game's own clock runs at about a fifth to a fourteenth of
   real time: a 336-second night takes half an hour to over an hour of
   wall time, and the six of them take most of a day.

   So the hands stay real -- every door, every camera, every card is a
   pointer event on the actual control -- and only the clock is helped.
   Between actions the same playStep the frame loop calls is run in
   thirtieth-of-a-second slices until the night has had as much time as
   a player sitting there would have given it. Nothing is skipped and
   nothing is faked: the toys walk their routes, the meter drains, the
   tape plays out, the hour turns. It is the difference between playing
   the game and watching the render take its time. */
module.exports = async function (c) {
  const { p, T, card, shot, say, NIGHTS } = c;
  const WARP = Number(process.env.WARP || 1.2);   /* game-seconds per tick */

  const press = (k) => p.evaluate((kk) => {
    const el = document.querySelector(`#ns-pad [data-k="${kk}"]`);
    if (!el) return false;
    const r = el.getBoundingClientRect();
    const ev = (t) => new PointerEvent(t, { clientX: r.left + r.width / 2, clientY: r.top + r.height / 2,
                                            bubbles: true, cancelable: true, pointerId: 1, isPrimary: true });
    el.dispatchEvent(ev('pointerdown')); el.dispatchEvent(ev('pointerup'));
    return true;
  }, k);

  const windHold = () => p.evaluate(async () => {
    const el = document.getElementById('ns-key');
    if (!el || el.hidden) return false;
    const r = el.getBoundingClientRect();
    const ev = (t) => new PointerEvent(t, { clientX: r.left + r.width / 2, clientY: r.top + r.height / 2,
                                            bubbles: true, cancelable: true, pointerId: 1, isPrimary: true });
    el.dispatchEvent(ev('pointerdown'));
    await new Promise((res) => setTimeout(res, 1500));
    el.dispatchEvent(ev('pointerup'));
    return true;
  });

  /* the clock, carried. The same step, in the same size slices the
     loop would use if the loop could keep up. */
  const warp = (sec) => p.evaluate((s) => {
    const H = OuissysNightShift.__night;
    let n = 0;
    while (n < s) { if (H.pumpFrame(1 / 30) !== 'play') break; n += 1 / 30; }
    return n;
  }, sec);

  const peek = () => p.evaluate(() => {
    const N = OuissysNightShift.__night, G = N.state(), cast = N.cast();
    const at = { left: false, right: false, hatch: false };
    const where = [];
    for (const id in cast) {
      const ch = cast[id];
      if (ch.awake && ch.atDoor && !ch.talking) at[ch.def.door] = true;
      if (ch.awake) where.push(id + '@' + (ch.room || '?') + (ch.atDoor ? '!' : ''));
    }
    return { phase: G.phase, hour: G.hour, night: G.night, power: Math.round(G.power),
             doors: Object.assign({}, G.doors), at, monitor: !!G.monitor, cam: G.cam,
             where: where.join(' ') };
  });

  for (let night = 1; night <= NIGHTS; night++) {
    say(`\n############################## NIGHT ${night}`);
    let seenTape = '', seenSay = '', seenTut = '', shots = 0, lastHour = -1, guard = 0;
    const start = Date.now();

    while (Date.now() - start < 1000 * 60 * 25) {
      if (++guard > 3000) { say('  !! guard tripped, night abandoned'); break; }
      const s = await peek().catch(() => null);
      if (!s) break;

      if (s.phase !== 'play') {
        const c2 = await card();
        if (c2.card) {
          say(`\n--- card [${c2.phase}] at ${s.hour} o'clock\n${c2.card}`);
          say('    buttons: ' + JSON.stringify(c2.buttons));
          await shot(`n${night}-card-${c2.phase}`);
        }
        if (c2.phase === 'over') say(`  *** CAUGHT on night ${night} at ${s.hour} o'clock`);
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
        await T(1800);
        const after = await peek().catch(() => null);
        if (after && after.night > night) { say(`  (night ${night} is over)`); break; }
        if (after && after.phase === 'title') { say('  (back at the menu)'); break; }
        if (after && after.phase !== 'play' && !pressed) { await T(1200); }
        continue;
      }

      const c1 = await card();
      const tut = c1.tutor || '';
      if (tut) {
        if (tut !== seenTut) { seenTut = tut; say('   (tutor) ' + tut.replace(/\n/g, ' ')); }
        const want = tut.toUpperCase();
        if (want.indexOf('MONITOR: RAISE') >= 0 && !s.monitor) await press('monitor');
        else if (want.indexOf('MONITOR: LOWER') >= 0 && s.monitor) await press('monitor');
        else if (want.indexOf('STEP THROUGH THE ROOMS') >= 0) {
          if (!s.monitor) await press('monitor'); else await press('next');
        }
        else if (want.indexOf('WEST DOOR: CLOSE') >= 0 && !s.doors.left) await press('left');
        else if (want.indexOf('SHUT DOOR HOLDS') >= 0 && s.doors.left) await press('left');
        else if (want.indexOf('HATCH: LATCH') >= 0 && !s.doors.hatch) await press('hatch');
        else if (want.indexOf('UNLATCH') >= 0 && s.doors.hatch) await press('hatch');
        else if (want.indexOf('FIND HIM') >= 0) {
          if (!s.monitor) await press('monitor'); else await press('next');
        }
        else if (want.indexOf('HOLD IT') >= 0 || want.indexOf('KEY IN HIS BACK') >= 0) await windHold();
        await T(300);
        continue;                       /* orientation owns the hands */
      }

      for (const side of ['left', 'right', 'hatch']) {
        if (s.at[side] !== s.doors[side]) await press(side);
      }
      c.sweep = (c.sweep || 0) + 1;
      const ph = c.sweep % 8;
      if (ph === 0) await press('monitor');
      else if (ph < 4) await press('next');
      else if (ph === 4 && s.monitor) await press('monitor');

      if (s.hour !== lastHour) {
        lastHour = s.hour;
        if (shots < 7) { await shot(`n${night}-h${s.hour}`); shots++; }
        say(`  ${s.hour} o'clock — power ${s.power}% — cam ${s.cam} — ${s.where}`);
      }
      if (c1.tape && c1.tape !== seenTape) { seenTape = c1.tape; say('   " ' + c1.tape.replace(/\n/g, ' ')); }
      if (c1.says && c1.says !== seenSay) { seenSay = c1.says; say('   [ ' + c1.says.replace(/\n/g, ' ')); }

      await warp(WARP);
    }
  }

  say('\n############################## AFTER THE SIX');
  say(JSON.stringify(await card(), null, 1));
  await shot('after-the-week');
};
