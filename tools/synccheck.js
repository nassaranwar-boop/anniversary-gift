/* THE SUBTITLE AGAINST THE READING.

   Every caption in this chapter that lights word by word does it off
   `perf() - <its own t0>`. Where the browser's own synthesiser is
   talking that clock is corrected by real word boundaries through
   voxMark, so it cannot drift. A RECORDING reports no boundaries --
   and recordings are the whole point here, 278 of them -- so for his
   actual voice that clock IS the subtitle. If it starts before the
   sound does, the words run ahead of him.

   voxSpeak deliberately holds a line for up to three and a half
   seconds while its take loads, because a line that starts a beat
   late is still his voice and a line that does not wait is a machine
   reading his last words to her. That wait is the first thing a new
   visitor meets, and it is exactly when the caption clock and the
   sound can come apart.

   voiceWarm has the whole chapter in memory seconds after the
   manifest lands, so by the time any suite runs the wait can never
   fire on its own. This drops one take back out of the cache to put
   the page in the state a cold phone is in, then asks: when he
   finally spoke, how much of the sentence was already written? */
const { chromium } = require('playwright-core');

let pass = 0, fail = 0;
const t = (n, c, note) => { c ? pass++ : fail++;
  console.log(`${c ? 'PASS' : 'FAIL'}  ${n}${note !== undefined ? '   ' + note : ''}`); };

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox', '--no-proxy-server', '--use-gl=swiftshader', '--enable-unsafe-swiftshader',
           '--autoplay-policy=no-user-gesture-required'] });
  const p = await b.newPage({ viewport: { width: 900, height: 600 } });
  p.on('pageerror', (e) => console.log('PAGEERROR', e.message));
  await p.route('**/*', (r) => r.request().url().startsWith('http://127.0.0.1') ? r.continue() : r.abort());
  await p.goto('http://127.0.0.1:8899/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.evaluate(() => { try { localStorage.clear(); } catch (e) {} localStorage.setItem('ns_notutor', '1');
    showScreen('nightshift');
    return loadChapter('nightshift').then(() => OuissysNightShift.start()); });
  await p.waitForFunction(() => { try { return !!OuissysNightShift.__night.cast().jax; } catch (e) { return false; } },
                          { timeout: 180000, polling: 500 });
  /* voiceWarm has to have actually warmed, or every take looks absent
     and the drop below finds nothing to drop */
  await p.waitForFunction(() => { try { return OuissysNightShift.__night.voiceState().ready.length > 3; }
                                  catch (e) { return false; } }, { timeout: 180000, polling: 500 });

  const res = await p.evaluate(async () => {
    const N = OuissysNightShift.__night;
    /* THE NIGHT MUST NOT TALK OVER THE MEASUREMENT.

       begin() starts a shift, and a running shift has its own tape:
       tapeDue fires his next line whenever it is due, overwriting the
       caption this is timing. That is how an earlier pass reported
       fifteen words lit on a thirteen-word line -- it was counting a
       different line that had replaced ours mid-count. Pausing stops
       playStep, so nothing new comes due, while tapeTick called by
       hand still drives the caption. */
    N.begin(2); N.midEnd();
    if (N.state().phase === 'play') N.pauseNow();
    const sleep = (ms) => new Promise((r2) => setTimeout(r2, ms));
    const lit = () => {
      const el = document.getElementById('ns-tape');
      if (!el || el.hidden) return { on: -1, of: -1 };
      const w = el.querySelectorAll('i[data-w]');
      let n = 0; w.forEach((x) => { if (x.className === 'on') n++; });
      return { on: n, of: w.length };
    };

    /* AND THE SHORTEST LINES FIRST, ON PURPOSE.

       The written line has its own reading time -- plan.dur plus a
       1.1s tail -- and on a cold load that clock was running during
       the wait for the take. A long line outlasts the wait and never
       shows it. A three-word line does not: about 1.4s of reading
       plus 1.1s of tail against a wait of up to 3.5 seconds, so the
       caption hid itself and the take landed on an empty screen.
       Sorting by length makes the check meet the case that breaks. */
    const script = N.words();
    const rows = [];
    for (const n of [1, 2, 3, 4, 5, 6])
      for (const row of (script.tapes[n] || [])) rows.push(row.t);
    rows.sort((x, y) => String(x).split(/\s+/).length - String(y).split(/\s+/).length);

    /* ONE LINE IS NOT ENOUGH, BECAUSE THE TAKE MAY NOT GET BACK.

       voiceWait gives a dropped take 2.6 seconds to re-arrive and
       decode, and then the line goes out without it -- by design. On
       a starved machine that deadline is missed often, and the line
       then takes the silent caption path, which is a DIFFERENT path
       with different rules: nothing will ever speak it, so it is
       correct for it to read on its own clock and go. An earlier
       pass measured exactly that and reported five failures about a
       recording that was never going to play. So each attempt says
       which path it took, and the run keeps trying lines until one
       of them actually comes back in his voice. */
    const tries = [];
    let got = null;
    for (const txt of rows) {
      if (tries.length >= 6) break;
      const id = N.voiceDrop(txt);
      if (!id) continue;                       /* not a recorded line */
      N.tapeQuiet();
      for (let i = 0; i < 80 && N.tapeDebug().vox; i++) await sleep(50);
      if (!N.tapeSayRaw(txt, null, false)) { tries.push({ line: txt, why: 'would not go up' }); continue; }
      if (N.tape().line !== txt) { tries.push({ line: txt, why: 'a different line is showing' }); continue; }

      let litWhileWaiting = 0, wentAway = false, held = false, lowSpeakT = 99;
      let into = null, litThen = null, shownThen = null;
      for (let i = 0; i < 900; i++) {
        N.tapeTick(1 / 60);
        const d = N.tapeDebug();
        if (d.held) { held = true; if (d.speakT < lowSpeakT) lowSpeakT = d.speakT; }
        if (d.vox) { into = N.tapeInto(); litThen = lit(); shownThen = d.shown; break; }
        /* AND IT MUST NOT LEAVE WHILE HE IS ON HIS WAY.
           Not "did it come back": once tapeHide runs the element is
           emptied and TAPE.up is false, so voxAligned can no longer
           find the caption to realign, and he says it to nothing. */
        if (!d.shown) { wentAway = true; break; }
        const l = lit();
        if (l.on > litWhileWaiting) litWhileWaiting = l.on;
        await sleep(20);
      }
      const took = N.said().took;
      const words = N.tapeDebug().planWords;
      const rec = { line: txt, dropped: id, took, words, held, wentAway,
                    litWhileWaiting, shownThen, lowSpeakT,
                    intoWhenHeSpoke: into, litWhenHeSpoke: litThen };
      tries.push(rec);
      if (took === 'tape') { got = rec; break; }
      /* the silent path still has to obey the hold while it is on:
         a line nobody will ever speak may read and go, but it may not
         hide itself DURING the wait, before voxAligned has released
         it */
      await sleep(200);
    }
    return { tries, got, align: N.voxAlign() };
  });

  const best = res.got || res.tries[res.tries.length - 1] || {};
  if (!res.tries.length) best.err = 'no recorded line anywhere in the tapes';

  if (best.err) {
    t('the check could set itself up', false, best.err);
    console.log(`\n${pass} passed, ${fail} failed`);
    await b.close(); process.exit(1);
  }

  res.tries.forEach((x, i) => {
    console.log(`  try ${i + 1}: "${String(x.line).slice(0, 48)}" (${x.words} words) -> ` +
                (x.why || 'took=' + x.took + (x.held ? ', held for the take' : ', not held')));
  });
  console.log();

  const r = best;
  console.log(`  "${String(r.line).slice(0, 64)}" (${r.words} words)`);
  console.log(`  take ${r.dropped} dropped, so it had to be fetched the way a cold phone fetches it`);
  console.log(`  it went out by the ${r.took} path`);
  console.log(`  when his voice started the caption thought it was ${r.intoWhenHeSpoke}s into the line`);
  console.log(`  words already written when he began: ` +
              (r.litWhenHeSpoke ? r.litWhenHeSpoke.on + ' of ' + r.litWhenHeSpoke.of : 'n/a'));
  console.log(`  the caption was held for the take: ${r.held}`);
  console.log(`  words lit while the take was still loading: ${r.litWhileWaiting}`);
  console.log(`  voxAligned: ${JSON.stringify(res.align)}\n`);

  /* THE HOLD IS THE FIX, AND IT IS TESTABLE WHATEVER THE TAKE DOES.

     Whether a dropped take gets back inside voiceWait's 2.6 seconds is
     the network's business, not the chapter's. What the chapter owes
     is this: while a line is in the air its caption stays on the
     screen and stays unlit. Both hold on every path, so both are
     asserted on whichever line the run ended up with. */
  t('the caption is held while his take is in the air', r.held === true,
    r.held ? 'held' : 'nothing stopped its reading clock');
  t('it is still on the screen when the wait ends', r.wentAway === false,
    r.wentAway ? 'it hid itself before anything spoke' : 'still up');
  t('and it sits unlit for the whole of that wait', r.litWhileWaiting === 0,
    r.litWhileWaiting + ' word(s) lit against silence');

  /* and these only mean anything about a line that really played off a
     recording -- on the silent path there is no voice to be in step
     with, and asserting against one measures nothing */
  if (r.took === 'tape') {
    t('he speaks it off the recording, not the synthesiser', true, 'took=tape');
    t('the caption clock is at the top of the line when he starts',
      r.intoWhenHeSpoke !== null && r.intoWhenHeSpoke < 0.35, r.intoWhenHeSpoke + 's in');
    t('and no more than the first word is written before he says it',
      !!r.litWhenHeSpoke && r.litWhenHeSpoke.on <= 1,
      r.litWhenHeSpoke ? r.litWhenHeSpoke.on + ' of ' + r.litWhenHeSpoke.of : 'n/a');
  } else {
    console.log('  NOT ASKED: no dropped take got back inside voiceWait\'s 2.6s on this\n' +
                '  machine, so every attempt went out by the ' + r.took + ' path. The three\n' +
                '  assertions above still hold; the two about being in step with a\n' +
                '  recording were not exercised and are not claimed.\n');
  }

  console.log(`\n${pass} passed, ${fail} failed`);
  await b.close();
  process.exit(fail ? 1 : 0);
})();
