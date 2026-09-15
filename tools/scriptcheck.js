/* THE SCRIPT HAS RULES. DOES THE GAME FOLLOW THEM.

   The chapter's writing is not a pile of lines, it is a schedule with
   conditions on it. His tapes are pinned to hours and belong to one
   night each. The things the four say to her are pinned to a night and
   an hour and are meant to happen once in a playthrough. The overheard
   exchanges belong to one night and run in a fixed order. The building's
   own announcements answer events.

   Every one of those is a promise that can quietly stop being kept, and
   none of them is the sort of thing a single playthrough proves: the
   shop is full of dice, so a fault that needs one particular ordering
   shows up on the fourth run and not the first. So a RUN here is a
   PLAYTHROUGH -- nights one to five, in order, in one page, the way
   she plays them, because several of these promises are about the week
   and not about Tuesday -- and there are several runs, each in a page
   of its own so that no run inherits the last one's memory.

   Per night:

     right night     a line pinned to night three is never heard on
                     night two
     not yet         nothing arrives before the night it opens on
     in order        his tapes arrive up the clock, not down it
     once a night    nothing is said twice inside one shift
     complete        an exchange that starts, finishes, in order
     never silent    and no stretch of a night is longer than a minute
                     and a half with nothing said at all, because that
                     is the "it drags" a player reports
     not cut off     and no line is replaced while it still had most of
                     itself left to say -- tapeSay marks a line said
                     whether or not anybody got to read it, so an
                     interrupted line is a line she never gets

   And across the week:

     the deadline    a line carrying one arrives by it, earned or not
     once ever       a line that promises to happen once does not
                     happen twice

   Before any of it is played, the script is checked for being well
   formed at all: a line is identified BY ITS WORDS everywhere in this
   chapter, so two entries with the same sentence in them are one line
   and saying either silences the other.

   Runs are counted so a rule that holds four times out of five is
   reported as the intermittent thing it is, rather than passing.

   One thing to know before reading a failure: this aborts voice/. The
   takes play on the wall clock and this drives six hours of night in a
   couple of real seconds, so one eleven-second recording is otherwise
   still sounding three game-hours later and everything in here that
   waits for the air to be free waits for ever. What the takes sound
   like is castcheck's and linecheck's business.

     RUNS=n    playthroughs (default 3)
     DUMP=1    print each night as a transcript, in the order she hears
               it. Read this before touching any of the dialogue code.
     NIGHT=n   narrow what is REPORTED to one night. Every night is
               still played: the week-long rules need the whole run. */
const { chromium } = require('playwright-core');
const RUNS = Number(process.env.RUNS || 3);
const ONLY = process.env.NIGHT ? [Number(process.env.NIGHT)] : null;

let pass = 0, fail = 0;
const ok = (n, c, note) => { c ? pass++ : fail++;
  console.log(`${c ? 'PASS' : 'FAIL'}  ${n}${note ? '   ' + note : ''}`); };

(async () => {
  const b = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox', '--no-proxy-server', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const errs = [];
  let p = null;

  /* A RUN IS A PLAYTHROUGH, AND A PLAYTHROUGH GETS ITS OWN PAGE.

     Some of what this checks is remembered across nights on purpose --
     a line that is once-ever is kept in localStorage, and the ask a toy
     makes is counted there too. So the four nights of one run are
     played in one page, in order, the way she plays them. But two runs
     must not see each other: the second one would start with the first
     one's record of what has already been said, and the rules here are
     about what a night contains rather than what a week does. A night
     begun while the previous one's dawn is still running is not a night
     anybody plays either. Fresh page, every run. */
  const openPage = async () => {
    if (p) await p.close();
    p = await b.newPage({ viewport: { width: 1000, height: 640 } });
    p.on('pageerror', (e) => errs.push(e.message));
    await p.route('**/*', (r) => {
      const u = r.request().url();
      if (u.indexOf('book-scene.js') >= 0) return r.abort();
      /* AND NO RECORDED VOICES, BECAUSE THIS SUITE PUMPS FRAMES.

         The takes play on the wall clock. This drives the night's own
         clock as fast as the machine will go -- six hours in a couple
         of real seconds -- so one eleven-second take is still sounding
         three game-hours later, and "is anybody speaking" is true for
         the rest of the shift. Everything that waits for the air to be
         free then waits for ever, and the night reads as silent when
         the real fault is that the harness outran the loudspeaker.
         Without the manifest the chapter falls back to its own word
         clock, which is counted in dt and therefore pumps. What the
         takes themselves sound like is castcheck's and linecheck's
         business. */
      if (u.indexOf('/voice/') >= 0) return r.abort();
      return u.startsWith('http://127.0.0.1') ? r.continue() : r.abort(); });
    await p.goto('http://127.0.0.1:8899/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await p.evaluate(() => {
      localStorage.clear();
      localStorage.setItem('ns_seenintro', '1');
      localStorage.setItem('ns_notutor', '1');
      showScreen('nightshift');
      return loadChapter('nightshift').then(() => OuissysNightShift.start()); });
    await p.waitForFunction(() => {
      try { return !!OuissysNightShift.__night.cast().jax; } catch (e) { return false; }
    }, { timeout: 40000, polling: 200 });
  };

  await openPage();
  const script = await p.evaluate(() => OuissysNightShift.__night.script());

  /* ONE NIGHT, PLAYED COMPETENTLY.

     Shut whatever is at a door, sweep the cameras, keep the meter up,
     and -- this is the part a first draft of this got wrong -- READ THE
     CARDS. A find stops the shift and puts a page up; a save stops it
     and explains what she just heard. Both wait for a button. A harness
     that pumps frames and never presses one stops dead at three in the
     morning and then reports the rest of the night as missing, which is
     a fault in the harness wearing the costume of a fault in the game.

     So the loop runs in chunks: frames until something stops it, then
     back out to the page to press the button a player would press, then
     on with the night. Every word is written down with the hour it was
     said in, how much of it was still owed when it went away, and what
     replaced it. */
  const startNight = (n) => p.evaluate((night) => {
    const N = OuissysNightShift.__night, G = N.state();
    N.begin(night);
    window.__sc = { said: [], last: '', lastOwed: 0, sweep: 0, at: 0,
                    k: 0, cards: 0, end: null };
    return { phase: G.phase, tape: N.tape().on, quiet: N.tape().quiet };
  }, n);

  /* frames until the phase leaves play, dawn, or the chunk is used up */
  const chunk = (frames) => p.evaluate((max) => {
    const N = OuissysNightShift.__night, G = N.state(), cast = N.cast();
    const CAMS = N.roomDefs().filter((x) => x.cam > 0).map((x) => x.id);
    const S = window.__sc;
    const DT = 1 / 30;
    for (let i = 0; i < max; i++) {
      if (S.k > 60 * 30 * 9) { S.end = { why: 'ranOut' }; return S.end; }
      for (const side of ['left', 'right', 'hatch']) {
        let there = false;
        for (const id in cast) {
          const c = cast[id];
          if (c.awake && c.atDoor && !c.talking && c.def.door === side) there = true;
        }
        G.doors[side] = there;
      }
      G.power = Math.max(G.power, 45);
      S.sweep += DT;
      if (S.sweep > 2.2) {
        S.sweep = 0; S.at = (S.at + 1) % CAMS.length;
        G.monitor = true; G.cam = CAMS[S.at];
      }
      if (G.phase !== 'play') { S.end = { why: G.phase, dead: G.dead || null }; return S.end; }
      N.pumpFrame(DT);
      S.k++;
      const d = N.tapeDebug();
      if (d.line && d.line !== S.last) {
        S.said.push({ t: d.line, who: d.who || 'anwar',
                      hour: G.hour + (G.hourT || 0) / 56,
                      at: +(S.k * DT).toFixed(1),
                      /* what the line before it still had left to say */
                      cut: S.last ? S.lastOwed : 0, after: S.last });
        S.last = d.line;
      }
      S.lastOwed = N.tapeOwed();
      if (window.__scDump && S.k % 300 === 0) {
        const tp = N.tape();
        S.trace = S.trace || [];
        S.trace.push({ t: +(S.k * DT).toFixed(0), on: tp.on, quiet: tp.quiet,
                       said: tp.said, hour: G.hour, mon: G.monitor,
                       line: (N.tapeDebug().line || '').slice(0, 18) });
      }
      if (G.hour >= 6) { S.end = { why: 'dawn' }; return S.end; }
    }
    return null;
  }, frames);

  const grab = () => p.evaluate(() => window.__sc);

  /* the button a player presses, and nothing else: a card is read and
     dismissed, and anything the harness does not know how to answer
     ends the run honestly rather than silently */
  const answerCard = () => p.evaluate(() => {
    const G = OuissysNightShift.__night.state();
    const hit = (sel) => {
      const el = document.querySelector(sel);
      if (!el) return false;
      el.click();
      return true;
    };
    if (G.phase === 'held') return hit('[data-go="heldOut"]') ? 'held' : null;
    if (G.phase === 'reveal') {
      /* she keeps them. Burning is checked by its own suite. */
      const card = document.querySelector('.ns-card-find');
      if (card) card.click();                       // the rest of the page, at once
      return hit('[data-go="keep"]') ? 'reveal' : null;
    }
    return null;
  });

  const play = async (night) => {
    if (process.env.DUMP) await p.evaluate(() => { window.__scDump = 1; });
    const began = await startNight(night);
    if (process.env.DUMP) console.log(`   [begin night ${night}] ${JSON.stringify(began)}`);
    for (let guard = 0; guard < 400; guard++) {
      const stop = await chunk(4000);
      if (!stop) continue;
      if (stop.why === 'dawn' || stop.why === 'ranOut') break;
      if (stop.why === 'over') {
        const S = await grab();
        return { said: S.said, died: true, why: 'caught by ' + stop.dead };
      }
      const answered = await answerCard();
      if (!answered) {
        const S = await grab();
        return { said: S.said, died: true, why: 'stuck in ' + stop.why };
      }
      /* THE CARD'S OWN ANIMATION RUNS ON THE WALL CLOCK.

         So wait for it to go -- but wait for it to stop being a card,
         not for it to become play. Once the button is pressed the
         shift is live again and running on the page's own frames, and
         if something reaches her in that second the phase goes
         straight past play to over. Waiting for the word 'play'
         specifically would then hang until the timeout and report a
         harness stall instead of the death that actually happened. */
      const was = stop.why;
      await p.waitForFunction((w) => OuissysNightShift.__night.state().phase !== w,
                              was, { timeout: 20000, polling: 60 })
             .catch(() => {});
      const now = await p.evaluate(() => OuissysNightShift.__night.state().phase);
      if (now === was) {
        const S = await grab();
        return { said: S.said, died: true, why: 'the ' + was + ' card would not close' };
      }
      /* a card is not an interruption. The shift stopped, the tape
         system was switched off under it, and whatever was on screen
         when it stopped was not cut off by the line that comes after
         the card -- it was cut off by her reading something. */
      await p.evaluate(() => { window.__sc.cards++; window.__sc.lastOwed = 0; });
    }
    const S = await grab();
    if (process.env.DUMP && S.trace) S.trace.forEach((x) => console.log('     .', JSON.stringify(x)));
    return { said: S.said, died: false, why: '' };
  };

  /* ---- BEFORE PLAYING ANY OF IT: IS THE SCRIPT ITSELF WELL FORMED ----

     A line in this chapter is identified BY ITS WORDS. `TAPE.said` is
     keyed on the text, the once-ever record is keyed on the text, and
     the voice manifest looks a recording up by the text. So two
     different entries with the same sentence in them are one line as
     far as every one of those is concerned: say either and the other
     is marked said and silently never happens. Nothing would report
     it. And his tapes are read off a list in order and stop at the
     first one whose hour is in the future, so an hour out of sequence
     takes everything after it with it. */
  const texts = {};
  const dupes = [];
  const note = (t, where) => {
    if (!t) return;
    if (texts[t]) dupes.push(`"${t.slice(0, 40)}" is both ${texts[t]} and ${where}`);
    else texts[t] = where;
  };
  for (const n in (script.tapes || {}))
    script.tapes[n].forEach((it, i) => note(it.t, `tape ${n}.${i}`));
  for (const k in (script.tapeWhen || {})) {
    const it = script.tapeWhen[k];
    note(typeof it === 'string' ? it : it && it.t, 'tapeWhen ' + k);
  }
  for (const n in (script.afterChoice || {})) {
    note(script.afterChoice[n].kept && script.afterChoice[n].kept.t, `afterChoice ${n} kept`);
    note(script.afterChoice[n].burned && script.afterChoice[n].burned.t, `afterChoice ${n} burned`);
  }
  for (const k in (script.pointAt || {})) note(script.pointAt[k].t, 'pointAt ' + k);
  for (const k in (script.ranDown || {})) note(script.ranDown[k].t, 'ranDown ' + k);
  for (const n in (script.overheard || {}))
    script.overheard[n].lines.forEach((l, i) => note(l.t, `overheard ${n}.${i}`));
  ok('no two lines in the chapter are the same sentence',
     dupes.length === 0, dupes[0] || Object.keys(texts).length + ' distinct lines');

  const outOfHour = [];
  for (const n in (script.tapes || {})) {
    let last = -1;
    script.tapes[n].forEach((it, i) => {
      if (it.h < last) outOfHour.push(`night ${n} line ${i} at ${it.h} after ${last}`);
      last = it.h;
    });
  }
  ok('and his tapes are written down the page in the order he says them',
     outOfHour.length === 0, outOfHour[0] || 'every night in order');

  const CAST_IDS = { cogsworth: 1, marabelle: 1, chime: 1, jax: 1 };
  const strays = [];
  const whoOf = (who, where) => { if (who && !CAST_IDS[who]) strays.push(`${where}: ${who}`); };
  for (const n in (script.tapes || {}))
    script.tapes[n].forEach((it, i) => whoOf(it.who, `tape ${n}.${i}`));
  for (const k in (script.tapeWhen || {})) {
    const it = script.tapeWhen[k];
    if (typeof it !== 'string') whoOf(it.who, 'tapeWhen ' + k);
  }
  for (const n in (script.overheard || {}))
    script.overheard[n].lines.forEach((l, i) => whoOf(l.who, `overheard ${n}.${i}`));
  ok('and everybody a line is signed to is one of the four',
     strays.length === 0, strays[0] || 'no strays');

  const DUMP = !!process.env.DUMP;
  /* NIGHT FIVE IS IN HERE TOO.

     It has no overheard exchange -- by then they talk to her directly,
     which overcheck asserts -- but it has the most of his tape in it
     and it is the night the four of them all start speaking, so every
     other rule applies to it and nothing had ever played it through.
     Night six is the last hour and belongs to endcheck. */
  const NIGHTS = [1, 2, 3, 4, 5];
  const all = { 1: [], 2: [], 3: [], 4: [], 5: [] };
  for (let r = 0; r < RUNS; r++) {
    if (r) await openPage();
    /* every night is played whatever NIGHT says: the week-long rule at
       the bottom needs the whole playthrough. NIGHT only narrows what
       is reported, for reading one night's transcript. */
    for (const night of NIGHTS) all[night].push(await play(night));
  }

  for (const night of (ONLY || NIGHTS)) {
    const runs = all[night];
    if (DUMP) runs.forEach((run, ri) => {
      console.log(`\n--- night ${night} run ${ri + 1}${run.died ? '  [' + run.why + ']' : ''}`);
      let prev = 0;
      run.said.forEach((l) => {
        const gap = Math.round(l.at - prev); prev = l.at;
        console.log(`   ${String(l.at).padStart(7)}s ${String(gap).padStart(4)}s` +
                    `${l.cut > 1.2 ? ' CUT(' + l.cut + ')' : '       '} ${l.who}: ${l.t.slice(0, 54)}`);
      });
      console.log('');
    });

    /* ---- his tapes: right night, up the clock, once each ---- */
    const mine = (script.tapes && script.tapes[night]) || [];
    const wrongNight = [], outOfOrder = [], twice = [];
    runs.forEach((run) => {
      let lastH = -1;
      const seen = {};
      run.said.forEach((l) => {
        if (l.who !== 'anwar') return;
        const entry = mine.filter((x) => x.t === l.t)[0];
        if (!entry) {
          /* one of his from another night's list is a real fault */
          for (const n2 in script.tapes)
            if (n2 !== String(night) && script.tapes[n2].some((x) => x.t === l.t))
              wrongNight.push(`night ${n2}'s "${l.t.slice(0, 40)}" on night ${night}`);
          return;
        }
        if (entry.h < lastH - 0.02) outOfOrder.push(`"${l.t.slice(0, 32)}" at ${entry.h} after ${lastH}`);
        lastH = Math.max(lastH, entry.h);
        if (seen[l.t]) twice.push(l.t.slice(0, 40));
        seen[l.t] = 1;
      });
    });
    ok(`night ${night}: he only ever says this night's lines`,
       wrongNight.length === 0, wrongNight[0] || `${RUNS} runs`);
    ok(`night ${night}: and says them up the clock, never back down it`,
       outOfOrder.length === 0, outOfOrder[0] || 'in order every run');
    ok(`night ${night}: and nothing is said twice in one shift`,
       twice.length === 0, twice[0] || 'no repeats');

    /* ---- the gated lines: never before the night they open on ----

       Two numbers, and they are not the same kind of number. `after` is
       the night one of these is allowed to start happening on: she does
       the thing that earns it and it answers. `by` is the DEADLINE --
       the night and hour at which, if she has not earned it, it happens
       anyway, because a player who is good at this game is otherwise
       the player who gets the least of the story. So a line arriving
       before its `by` is the mechanism working, and a line arriving
       before its `after` is the fault. */
    const early = [];
    runs.forEach((run) => run.said.forEach((l) => {
      for (const k in script.tapeWhen) {
        const it = script.tapeWhen[k];
        if (!it || typeof it === 'string' || it.t !== l.t || !it.after) continue;
        if (night < it.after)
          early.push(`${k} on night ${night}, and it does not open until night ${it.after}`);
      }
    }));
    ok(`night ${night}: nothing gated arrives before the night it opens on`,
       early.length === 0, early[0] || 'every gate held');

    /* ---- the overheard exchange: all of it, in order ---- */
    const ex = script.overheard && script.overheard[night];
    if (ex) {
      const bad = [];
      runs.forEach((run, ri) => {
        const heard = run.said.filter((l) => ex.lines.some((x) => x.t === l.t));
        if (heard.length !== ex.lines.length) {
          bad.push(`run ${ri + 1}: ${heard.length} of ${ex.lines.length}` + (run.died ? ' (' + run.why + ')' : ''));
          return;
        }
        heard.forEach((h, i) => {
          if (h.t !== ex.lines[i].t) bad.push(`run ${ri + 1}: out of order at line ${i + 1}`);
        });
      });
      ok(`night ${night}: the exchange between two of them plays in full, in order`,
         bad.length === 0, bad.join('; ') || `${RUNS} runs, ${ex.lines.length} lines each`);
    }

    /* ---- and the shop is never quiet for too long ---- */
    const quiet = [];
    runs.forEach((run, ri) => {
      let prev = 0;
      run.said.forEach((l) => {
        if (l.at - prev > 95) quiet.push(`run ${ri + 1}: ${Math.round(l.at - prev)}s of nothing before ${l.at}s`);
        prev = l.at;
      });
    });

    /* ---- and nothing is cut off by the thing that follows it ----
       A line replaced while it still had most of itself left to say is
       a line she never read, and tapeSay marks it said, so she never
       gets it again either. Half a second of overlap is a crossfade;
       four seconds owed is an interruption. */
    const cut = [];
    runs.forEach((run, ri) => run.said.forEach((l) => {
      if (l.cut > 1.2)
        cut.push(`run ${ri + 1}: "${(l.after || '').slice(0, 34)}" had ${l.cut}s left when "${l.t.slice(0, 26)}" arrived`);
    }));
    ok(`night ${night}: and no line is cut off by the one after it`,
       cut.length === 0, cut[0] || 'nothing interrupted');
    ok(`night ${night}: and no stretch of it is left in silence`,
       quiet.length === 0, quiet[0] || 'nothing longer than 95s');
  }

  /* ---- AND ACROSS THE WEEK: A FIRST TIME HAPPENS ONCE ----

     Everything above is about one night. This is the rule that only a
     playthrough can see, which is why each run is one: several kinds of
     line in this chapter promise to arrive once and never again -- the
     five that explain a thing she has just done for the first time, the
     four the toys say to her on a gate, the one that answers what she
     did with his things, the one that tells her where she left
     something, and the one a toy says when she has let it run all the
     way down. A per-night record cannot keep that promise, and a line
     she has already had is worse than no line: it says the shop was not
     listening the first time. */
  const onceEver = {};
  for (const k in (script.tapeWhen || {})) {
    const it = script.tapeWhen[k];
    const t = typeof it === 'string' ? it : (it && it.t);
    if (!t) continue;
    if ((typeof it === 'object' && it.by) || k.indexOf('first') === 0) onceEver[t] = k;
  }
  for (const n in (script.afterChoice || {})) {
    const set = script.afterChoice[n];
    if (set.kept) onceEver[set.kept.t] = 'afterChoice ' + n + ' kept';
    if (set.burned) onceEver[set.burned.t] = 'afterChoice ' + n + ' burned';
  }
  for (const k in (script.pointAt || {})) onceEver[script.pointAt[k].t] = 'pointAt ' + k;
  for (const k in (script.ranDown || {})) onceEver[script.ranDown[k].t] = 'ranDown ' + k;

  const twice = [];
  for (let r = 0; r < RUNS; r++) {
    const seen = {};
    NIGHTS.forEach((night) => {
      const run = all[night][r];
      if (!run) return;
      run.said.forEach((l) => {
        if (!onceEver[l.t]) return;
        if (seen[l.t] != null)
          twice.push(`run ${r + 1}: ${onceEver[l.t]} on night ${seen[l.t]} and again on night ${night}`);
        else seen[l.t] = night;
      });
    });
  }
  /* ---- AND EVERY DEADLINE IS MET ----

     The other half of the same pair. Each of these carries a night and
     an hour by which it has to have happened whether or not she ever
     did the thing that earns it -- "what is written to happen, happens"
     -- and a deadline that quietly stops being met is exactly the kind
     of hole this suite exists for: nothing breaks, she simply never
     hears it. Checked over a whole playthrough rather than a night,
     because several of them are earned on one night and fall due on a
     later one. */
  const missed = [];
  for (let r = 0; r < RUNS; r++) {
    const heard = {};
    NIGHTS.forEach((night) => {
      const run = all[night][r];
      if (run) run.said.forEach((l) => { if (heard[l.t] == null) heard[l.t] = night; });
    });
    for (const k in script.tapeWhen) {
      const it = script.tapeWhen[k];
      if (!it || typeof it === 'string' || !it.by) continue;
      if (it.by[0] > NIGHTS[NIGHTS.length - 1]) continue;   // falls due after the last night played
      if (heard[it.t] == null) missed.push(`run ${r + 1}: ${k} never arrived, due night ${it.by[0]} by ${it.by[1]}`);
      else if (heard[it.t] > it.by[0]) missed.push(`run ${r + 1}: ${k} arrived night ${heard[it.t]}, due night ${it.by[0]}`);
    }
  }
  ok('and a line with a deadline arrives by it, earned or not',
     missed.length === 0, missed.slice(0, 3).join('; ') || 'every deadline met');

  ok('a line that is meant to happen once never happens twice in a week',
     twice.length === 0, twice.slice(0, 3).join('; ') || `${Object.keys(onceEver).length} such lines, ${RUNS} playthroughs`);

  ok('and none of it threw', errs.length === 0, errs[0] || '');
  console.log(`\n${pass} passed, ${fail} failed   (${RUNS} runs of each night)`);
  await b.close();
  process.exit(fail ? 1 : 0);
})();
