/* THE CONVERSATION SHE IS NOT PART OF.

   Everything the four of them say on nights one to four is said TO her:
   four lines in four nights, each an answer to something she did. It
   works, and it also means that for four fifths of the chapter they are
   objects that speak only when spoken to. The one place they are ever
   people is the last hour of night six, where they talk to each other
   for ninety seconds -- which is a very long way to make somebody wait
   to find out that the things trying to get into her office have
   opinions about her husband.

   So each of the first four nights carries one exchange between two of
   them, about the shop, about him, about each other, and not about her.
   She gets it clear if she is watching that room on a live picture when
   it comes due, and through the wall if she is not.

   The two ways that goes wrong are opposite and this checks both:

     it is missable   the whole reason storycheck exists is that a good
                      player got the least of the story. A scene that
                      only plays for somebody who happens to be on the
                      right camera at the right minute is the same hole
                      with a nicer name. So: never looked, still heard.
     it is free       and the other way, where being on the right camera
                      buys nothing, so the sweep it is meant to reward
                      is not rewarded. So: looked, heard it clear, with
                      both names on it.

   Plus the four that would make it noise rather than a conversation:
   it may not start before its hour, two of them may never talk over
   each other, no line may be said twice, and it gives way to anything
   standing at a door.

   The run keeps her alive on purpose: the cast is frozen at the start
   of its routes, all three shutters are held closed and the meter is
   topped up. That is not cheating the test, it is removing the only
   thing that can end it -- the first version died at three in the
   morning of night four and reported the conversation as never having
   happened, which is a report about the harness and nothing else.
   Nothing here depends on where any of them is standing: the camera in
   that room has a microphone, which is the chapter's own rule, stated
   by the building on night three. */
const { chromium } = require('playwright-core');

let pass = 0, fail = 0;
const ok = (n, c, note) => { c ? pass++ : fail++;
  console.log(`${c ? 'PASS' : 'FAIL'}  ${n}${note ? '   ' + note : ''}`); };

(async () => {
  const b = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox', '--no-proxy-server', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const errs = [];
  /* A FRESH SHOP FOR EVERY RUN.

     The first version drove all eight runs through one page, and the
     chapter keeps state across a night that beginNight does not clear
     -- how long the shop is left alone after somebody has been to the
     door, most obviously. By the seventh run that had pushed night
     four's conversation three quarters of an hour later than it starts
     on a fresh page, and the suite reported a scene that works as one
     that does not. Eight page loads is a slower test and a true one. */
  const open = async () => {
    const p = await b.newPage({ viewport: { width: 900, height: 600 } });
    p.on('pageerror', (e) => errs.push(e.message));
    await p.route('**/*', (r) => {
      const u = r.request().url();
      if (u.indexOf('book-scene.js') >= 0) return r.abort();
      return u.startsWith('http://127.0.0.1') ? r.continue() : r.abort(); });
    await p.goto('http://127.0.0.1:8899/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await p.evaluate(() => {
      localStorage.setItem('ns_seenintro', '1');
      localStorage.setItem('ns_notutor', '1');
      showScreen('nightshift');
      return loadChapter('nightshift').then(() => OuissysNightShift.start()); });
    /* __night exists before the shop does: wait for the four of them to
       be in it, or beginNight resets a cast that is not there yet */
    await p.waitForFunction(() => {
      try {
        const c = window.OuissysNightShift && OuissysNightShift.__night
                  && OuissysNightShift.__night.cast();
        return !!(c && c.cogsworth && c.chime && c.marabelle && c.jax);
      } catch (e) { return false; }
    }, { timeout: 30000, polling: 200 });
    /* AND THE VOICES HAVE TO BE WARM, BECAUSE THEY ARE WARM IN PLAY.

       This drives a whole night inside one synchronous evaluate, so
       no timer fires while it runs. A line whose take has not been
       decoded yet is deferred by voxSpeak and its caption is HELD
       until the deferred speak comes back -- which, with no timer
       turns, is never. The caption then stays up, TAPE.up stays
       raised, and overTick reads every silence as "he is speaking"
       and waits the full OVER_HOLD for each line: measured, two of
       night two's four lines never got out, purely because the page
       had been open for two seconds rather than twenty.

       That is not the state a player is in. The exchange this
       measures happens at one or two in the morning, two real
       minutes into a night, by which time voiceWarm has the chapter
       in memory. Waiting for that here is not softening the check,
       it is putting the page in the condition the thing being
       checked actually happens in. */
    await p.waitForFunction(() => {
      try { return OuissysNightShift.__night.voiceState().ready.length > 3; }
      catch (e) { return false; }
    }, { timeout: 120000, polling: 500 });
    return p;
  };
  const p = await open();

  const script = await p.evaluate(() => OuissysNightShift.__night.overScript());

  /* a night holds a LIST of these: four exchanges over the two nights
     before they ever speak to her, two on each */
  const scenesOf = (n) => !script[n] ? [] : (script[n].length ? script[n] : [script[n]]);

  ok('the two nights before they speak to her have two exchanges each',
     [1, 2].every((n) => scenesOf(n).length === 2 &&
                         scenesOf(n).every((sc) => sc.lines.length >= 3)),
     [1, 2].map((n) => scenesOf(n).map((sc) => sc.lines.length).join('+')).join(' / '));
  ok('and the last night does not, because by then they talk to her',
     !script[3], Object.keys(script).join(','));
  ok('and the second one on a night is held back to the far side of it',
     [1, 2].every((n) => scenesOf(n)[1].from >= scenesOf(n)[0].from + 2),
     [1, 2].map((n) => scenesOf(n).map((sc) => sc.from).join('->')).join(' / '));
  ok('every line in them is spoken by one of the four, and no line by the speaker before it',
     [1, 2].every((n) => scenesOf(n).every((sc) => sc.lines.every((l, i) =>
       ['cogsworth', 'chime', 'marabelle', 'jax'].indexOf(l.who) >= 0 &&
       (i === 0 || l.who !== sc.lines[i - 1].who)))), 'two voices, taking turns');

  /* one night, pumped to six o'clock, with the camera either parked on
     the room the conversation is in or deliberately never on it */
  const run = async (night, watch) => {
    const pg = await open();
    const out = await runOn(pg, night, watch);
    await pg.close();
    return out;
  };
  const runOn = (p, night, watch) => p.evaluate(([n, w]) => {
    const N = OuissysNightShift.__night, G = N.state(), cast = N.cast();
    N.begin(n);
    const raw = N.overScript()[n];
    const scenes = raw.length ? raw : [raw];
    /* every line of every exchange the night has, so one run measures
       both of them and their order across the whole night */
    const all = [];
    scenes.forEach((s2, j) => s2.lines.forEach((l) => all.push({ t: l.t, who: l.who, scene: j })));
    const sc = scenes[0];
    const film = [];
    const DT = 1 / 30;
    let said = [], lastCap = '';
    let overlapped = 0, early = null, twice = 0, died = 0;
    const seen = {};
    for (let k = 0; k < 60 * 30 * 8; k++) {
      /* nobody walks, nothing gets in, and the meter never runs out */
      Object.keys(cast).forEach((id) => { cast[id].step = 0; cast[id].cool = 999;
                                          if (!cast[id].talking) cast[id].atDoor = false; });
      G.doors.left = G.doors.right = G.doors.hatch = true;
      G.power = Math.max(G.power, 40);
      /* AND IF SHE DIES, THE RUN IS OVER.

         The first version pushed the phase back to "play" and carried
         on, which is not her surviving -- a death switches the tape
         system off, and nothing switches it back on until the next
         night begins. What that produced was a zombie shop in which
         one of his lines sat queued for ever and the conversation this
         is measuring never started, reported as "she never heard it".
         A death ends the run; the exchange has to have happened before
         it, which is the real requirement anyway. */
      /* A CARD IS NOT A DEATH.

         There are two and three revelations a night now rather than
         one at three in the morning, and every one of them stops the
         shop -- which this read as "she died", ended the run, and
         reported the conversation it was measuring as never having
         happened. Night two's first card is due at half past one and
         took six of the night's seven overheard lines with it. A card
         is read and put down; only a scare ends a run. */
      if (G.phase === 'reveal') { N.route('keep'); continue; }
      if (G.phase === 'found')  { N.route('findOut'); continue; }
      if (G.phase === 'held')   { N.route('heldOut'); continue; }
      if (G.phase !== 'play') { died++; break; }
      /* HOLD THE PICTURE UP FOR THE WATCHING RUN.

         Nights three upwards drop feeds one at a time on their own, so
         a run that parks the camera on the right room can still lose it
         mid-sentence -- and the chapter is deliberately built to carry
         on through a wall when that happens. Right behaviour, wrong
         thing to measure here: this run is asking whether WATCHING gets
         it clear, so the feed is held up and the dropout is left to the
         run below, which never looks at all. */
      /* park on whichever exchange is armed right now: with two on a
         night the room changes halfway through */
      if (w) { G.monitor = true; G.cam = (N.overState().room || sc.room);
               G.lost = {}; G.monOut = 0; }
      else   { G.monitor = false; }
      N.pumpFrame(DT);
      const st = N.overState();
      /* READ WHAT THE CAPTION SYSTEM WAS HANDED, NOT THE DOM.

         The first version scraped #ns-tape's textContent and matched it
         against the written line. The caption is rebuilt word by word
         out of a speech plan, so what is on the screen is a normalised
         copy of the line rather than the line -- close enough to match
         on three nights out of four and not on the fourth, which is the
         worst possible behaviour for a test. The exact words, whether
         they came through a wall, and whether the element is actually
         up are all things the chapter can simply be asked. */
      const d = N.tapeDebug();
      if (d.line && d.line !== lastCap) {
        const hit = all.filter((l) => l.t === d.line)[0];
        if (hit) {
          if (seen[hit.t]) twice++;
          seen[hit.t] = 1;
          said.push({ t: hit.t, who: hit.who, scene: hit.scene, through: d.through,
                      shown: d.shown, hour: G.hour, at: +(k * DT).toFixed(2) });
          if (early === null && G.hour < scenes[hit.scene].from) early = G.hour;
        }
        lastCap = d.line;
      }
      /* whether they take turns is measured below, from the times the
         lines actually went out */
      /* not "the first one finished" any more: the night is over when
         the last of its exchanges is done, or the clock runs out */
      if (st.done && !st.on && !st.armed) break;
      if (G.hour >= 6) break;
    }
    return { said, overlapped, early, twice, died, state: N.overState(),
             want: all.length, hour: G.hour };
  }, [night, watch]);

  for (const n of [1, 2]) {
    const scenes = scenesOf(n);
    const w = { room: scenes.map((s2) => s2.room).join(' then '),
                lines: [].concat.apply([], scenes.map((s2) => s2.lines)),
                from: scenes[0].from };

    /* WATCHING: she gets all of it, clear */
    const on = await run(n, true);
    ok(`night ${n}, on the ${w.room} camera: she hears both exchanges whole`,
       on.said.length === w.lines.length, `${on.said.length} of ${w.lines.length}`);
    ok(`night ${n}, on camera: in the order they were written`,
       on.said.every((x, i) => w.lines[i] && x.t === w.lines[i].t &&
                               x.who === w.lines[i].who), 'in order');
    ok(`night ${n}, on camera: clear, not through a wall`,
       on.said.length > 0 && on.said.every((x) => !x.through),
       on.said.filter((x) => x.through).length + ' muffled');
    ok(`night ${n}, on camera: and the words are on the screen`,
       on.said.length > 0 && on.said.every((x) => x.shown),
       on.said.filter((x) => !x.shown).length + ' never shown');
    ok(`night ${n}: neither of them starts before its hour`,
       on.early === null, 'first line at ' + (on.said[0] ? on.said[0].hour : '-'));
    ok(`night ${n}: nothing is said twice`, on.twice === 0, on.twice + ' repeats');
    /* TAKING TURNS IS A MEASUREMENT, NOT A FLAG.

       The first version counted a beat counter running ahead of the
       captions, which cannot happen -- one line replaces the last one
       in the same element, so the two counters move together whatever
       the spacing is. What two of them talking over each other actually
       looks like is four lines going out inside a fifth of a second,
       which is what happened while the silence after a line was applied
       only during audible speech. Note what this does and does not
       prove: in a healthy night the lines are held apart by the length
       of the line before them anyway, so removing that silence again
       does NOT turn this red. It is the spacing itself that is being
       asserted, because the spacing is the thing that has to be true --
       and the case it was written for is the one where the tape tick
       has been switched off and nothing else is holding them apart. */
    /* only within one exchange: the gap ACROSS the two of them is
       two hours of night and says nothing about taking turns */
    const gaps = on.said.slice(1)
      .map((x, i) => [x.scene === on.said[i].scene, +(x.at - on.said[i].at).toFixed(2)])
      .filter(([same]) => same).map(([, g]) => g);
    ok(`night ${n}: they take turns rather than talk over each other`,
       gaps.length > 0 && gaps.every((g) => g >= 0.8),
       gaps.length ? gaps.join('s, ') + 's apart' : 'nothing said');

    /* NEVER LOOKING: she still gets all of it, through the wall */
    const off = await run(n, false);
    ok(`night ${n}, never on that camera: she still hears all of it`,
       off.said.length === w.lines.length, `${off.said.length} of ${w.lines.length}`);
    ok(`night ${n}, never on that camera: and it comes through the wall`,
       off.said.length > 0 && off.said.every((x) => x.through),
       off.said.filter((x) => !x.through).length + ' of them came through clear');
  }

  /* it gives way to anything standing at her door */
  const yields = await p.evaluate(() => {
    const N = OuissysNightShift.__night, G = N.state(), cast = N.cast();
    N.begin(2);
    const DT = 1 / 30;
    /* run it up past the hour it is due, then put something at a door
       and hold it there */
    for (let k = 0; k < 60 * 30 * 4; k++) {
      Object.keys(cast).forEach((id) => { cast[id].step = 0; cast[id].cool = 999; });
      G.doors.left = G.doors.right = G.doors.hatch = true;
      G.power = Math.max(G.power, 40);
      if (G.phase !== 'play') break;
      G.monitor = false;
      N.pumpFrame(DT);
      if (G.hour >= 3) break;
    }
    const before = N.overState().i;
    /* awake, at her door, and NOT one of the ones that came to talk --
       a toy that came to speak is excepted from the rule about being
       interrupted by toys, so setting `talking` here would have tested
       the exception rather than the rule */
    const ch = cast.jax;
    ch.awake = true; ch.room = 'office'; ch.atDoor = true;
    ch.talking = false; ch.doorT = 999;
    let moved = 0;
    for (let k = 0; k < 60 * 30; k++) {
      G.power = Math.max(G.power, 40);
      if (G.phase !== 'play') break;
      ch.awake = true; ch.room = 'office'; ch.atDoor = true; ch.talking = false;
      N.pumpFrame(DT);
      if (N.overState().i !== before) { moved++; break; }
    }
    ch.atDoor = false;
    return { before, moved };
  });
  ok('it stops while something is standing at her door',
     yields.moved === 0, `line ${yields.before} -> moved ${yields.moved}`);

  /* a custom night is a sandbox */
  const custom = await p.evaluate(() => {
    const N = OuissysNightShift.__night;
    N.begin(2, 0, { mode: 'custom' });
    const st = N.overState();
    N.begin(1);
    return st.armed;
  });
  ok('a custom night gets none of it', custom === false, 'armed = ' + custom);

  ok('and none of it threw', errs.length === 0, errs[0] || '');
  console.log(`\n${pass} passed, ${fail} failed`);
  await b.close();
  process.exit(fail ? 1 : 0);
})();
