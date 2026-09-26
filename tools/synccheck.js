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

  const r = await p.evaluate(async () => {
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
    const lit = () => {
      const el = document.getElementById('ns-tape');
      if (!el || el.hidden) return { on: -1, of: -1 };
      const w = el.querySelectorAll('i[data-w]');
      let n = 0; w.forEach((x) => { if (x.className === 'on') n++; });
      return { on: n, of: w.length };
    };
    /* a real, recorded line nothing has used yet. tapeSay refuses a
       line it has already said, and measuring whatever caption
       happened to be on screen instead is how the first version of
       this reported six words of a seven-word line. */
    /* AND THE SHORTEST ONE, ON PURPOSE.

       The written line has its own reading time -- plan.dur plus a
       1.1s tail -- and on a cold load that clock was running during
       the wait for the take. A long line outlasts the wait and never
       shows it. A four-word line does not: 1.4s of reading plus 1.1s
       of tail is 2.5 seconds against a 3.5 second wait, so the
       caption hid itself and the take landed on an empty screen.
       Sorting by length makes the check meet the case that breaks
       rather than the case that happens to survive. */
    const script = N.words();
    const rows = [];
    for (const n of [1, 2, 3, 4, 5, 6])
      for (const row of (script.tapes[n] || [])) rows.push(row.t);
    rows.sort((x, y) => String(x).split(/\s+/).length - String(y).split(/\s+/).length);
    let line = null, dropped = null;
    for (const txt of rows) {
      /* voiceDrop hands back the take's id for a line that has one,
         and null for a line that does not -- which is also exactly
         the "is this line recorded" question */
      const id = N.voiceDrop(txt);
      if (id) { line = txt; dropped = id; break; }
    }
    if (!line) return { err: 'no recorded line anywhere in the tapes' };
    N.tapeQuiet();                         /* nothing else sounding */
    for (let i = 0; i < 80 && N.tapeDebug().vox; i++)
      await new Promise((r2) => setTimeout(r2, 50));

    if (!N.tapeSayRaw(line, null, false)) return { err: 'the line would not go up' };
    if (N.tape().line !== line) return { err: 'a different line is showing' };

    /* while the take is still in the air the line must be ON SCREEN and
       UNLIT -- a subtitle waiting for its speaker, not one running
       ahead of him and then rubbing itself out */
    let litWhileWaiting = 0, wentAway = false, held = false;
    let into = null, litThen = null, shownThen = null;
    for (let i = 0; i < 900; i++) {
      N.tapeTick(1 / 60);
      const d = N.tapeDebug();
      if (d.held) held = true;
      if (d.vox) { into = N.tapeInto(); litThen = lit(); shownThen = d.shown; break; }
      /* AND IT MUST NOT LEAVE WHILE HE IS ON HIS WAY.
         Not "did it come back": once tapeHide runs the element is
         emptied and TAPE.up is false, so voxAligned can no longer
         find the caption to realign, and he says the line to nothing. */
      if (!d.shown) { wentAway = true; break; }
      const l = lit();
      if (l.on > litWhileWaiting) litWhileWaiting = l.on;
      await new Promise((r2) => setTimeout(r2, 20));
    }
    return { line, dropped, intoWhenHeSpoke: into, litWhenHeSpoke: litThen,
             litWhileWaiting, wentAway, held, shownThen, words: N.tapeDebug().planWords,
             took: N.said().took, align: N.voxAlign() };
  });

  if (r.err) {
    t('the check could set itself up', false, r.err);
    console.log(`\n${pass} passed, ${fail} failed`);
    await b.close(); process.exit(1);
  }

  console.log(`  "${String(r.line).slice(0, 64)}" (${r.words} words)`);
  console.log(`  take ${r.dropped} dropped, so it had to be fetched the way a cold phone fetches it`);
  console.log(`  when his voice started the caption thought it was ${r.intoWhenHeSpoke}s into the line`);
  console.log(`  words already written when he began: ` +
              (r.litWhenHeSpoke ? r.litWhenHeSpoke.on + ' of ' + r.litWhenHeSpoke.of : 'n/a') + '\n');

  console.log('  voxAligned: ' + JSON.stringify(r.align) + '\n');
  console.log('  words lit while the take was still loading: ' + r.litWhileWaiting + '\n');
  console.log('  the caption was held for the take: ' + r.held + '\n');
  t('he speaks it off the recording, not the synthesiser', r.took === 'tape', 'took=' + r.took);
  t('the caption is still on the screen when his voice arrives', r.wentAway === false && r.shownThen !== false,
    r.wentAway ? 'it hid itself before he got there' : 'still up');
  t('the line sits unlit while his take is still loading', r.litWhileWaiting === 0,
    r.litWhileWaiting + ' word(s) lit against silence');
  t('the caption clock is at the top of the line when he starts',
    r.intoWhenHeSpoke !== null && r.intoWhenHeSpoke < 0.35, r.intoWhenHeSpoke + 's in');
  t('and no more than the first word is written before he says it',
    !!r.litWhenHeSpoke && r.litWhenHeSpoke.on <= 1,
    r.litWhenHeSpoke ? r.litWhenHeSpoke.on + ' of ' + r.litWhenHeSpoke.of : 'n/a');

  console.log(`\n${pass} passed, ${fail} failed`);
  await b.close();
  process.exit(fail ? 1 : 0);
})();
