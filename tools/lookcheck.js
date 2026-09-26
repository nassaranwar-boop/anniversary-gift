/* THE OFFICE, WHICH SHE HAS ONLY EVER LOOKED OUT OF.

   Five things in the room she actually sits in: the brass plate with
   her name on it, her photograph on the corkboard, the window, the
   filing cabinet, and the first toy he ever finished, which has been
   on that desk through everything that has happened in there.

   The thing that can go wrong here is not subtle and is invisible
   from the code: the seat pans about nineteen degrees either way, on
   purpose, and that is most of why something standing in her doorway
   is frightening. A thing outside that arc cannot be turned to at
   all, however carefully it is placed — it would simply be a hotspot
   that never appears. So the first question is whether she can
   actually look at each of them from the chair.

   That question has already earned its keep. The brass plate was in
   this list, with a nice idea attached — looking at it would bring
   the night-one line about it forward rather than add a fifth — and
   the answer came back NOT REACHED. The plate is screwed to the front
   edge of the desk, facing the door, and she sits behind it. The
   idea was wrong and the room was right. The desk toy went the same
   way: the seat pitches nine degrees and a desktop is forty degrees
   down.
                                                node tools/lookcheck.js */
const { chromium } = require('playwright-core');

let pass = 0, fail = 0;
const t = (n, c, note) => { c ? pass++ : fail++;
  console.log(`${c ? 'PASS' : 'FAIL'}  ${n}${note !== undefined ? '   ' + note : ''}`); };

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
                          null, { timeout: 180000, polling: 500 });

  const r = await p.evaluate(async () => {
    const N = OuissysNightShift.__night, G = () => N.state();
    const sleep = (ms) => new Promise((x) => setTimeout(x, ms));
    N.begin(1); N.midEnd();
    const l0 = N.looks();

    /* ---- can the chair turn to each of them? ---- */
    const reach = [];
    for (const d of l0.lines) {
      const aim = N.lookAt(d.id);
      /* give the pan time to ease over: it lerps at dt*5 */
      for (let i = 0; i < 16 && N.looks().near !== d.id; i++) await sleep(220);
      const st = N.looks();
      reach.push({ id: d.id, aim, near: st.near, why: st.why, got: st.near === d.id });
    }

    /* ---- and taking one ---- */
    let took = null;
    const first = reach.filter((x) => x.got)[0];
    if (first) {
      N.lookAt(first.id);
      for (let i = 0; i < 16 && N.looks().near !== first.id; i++) await sleep(220);
      const before = N.looks();
      const said = before.near ? N.lookTake() : null;
      const after = N.looks();
      took = { id: before.near, said, phase: G().phase,
               wasOut: before.out.length, nowOut: after.out.length,
               gone: after.out.indexOf(before.near) < 0 };
    }

    /* ---- and the office things must not show with the tube up ---- */
    N.begin(1); N.midEnd();
    N.camTo('hall');
    for (let i = 0; i < 8; i++) await sleep(200);
    const withTube = { shown: N.looks().shown, why: N.looks().why };

    return { l0, reach, took, withTube };
  });

  console.log(`  ${r.l0.defined.length} things in the office\n`);
  r.l0.lines.forEach((d) => {
    const got = r.reach.filter((x) => x.id === d.id)[0] || {};
    console.log('    ' + d.id.padEnd(9) +
                (got.got ? 'reached' : 'NOT REACHED — ' + (got.why || '?')) +
                (got.aim ? '  pan ' + got.aim.panTX + '/' + got.aim.panTY : ''));
  });
  console.log();

  t('every one of them has something to say',
    r.l0.lines.every((d) => d.t && d.t.length > 12),
    r.l0.lines.filter((d) => !d.t).map((d) => d.id).join(', ') || 'all ' + r.l0.lines.length);
  t('and the chair can turn to every one of them',
    r.reach.every((x) => x.got),
    r.reach.filter((x) => !x.got).map((x) => x.id).join(', ') ||
      'all ' + r.reach.length + ' inside the arc, ' +
      r.reach.filter((x) => x.aim && Math.abs(x.aim.panTX) >= 0.999).length + ' of them only at full pan');

  if (r.took) {
    console.log('  looked at "' + r.took.id + '": phase ' + r.took.phase + ', ' +
                r.took.wasOut + ' left -> ' + r.took.nowOut +
                '\n    it said: ' + JSON.stringify(String(r.took.said || '').slice(0, 58)) + '\n');
    t('looking at one says its line', !!r.took.said, r.took.said ? 'queued' : 'nothing of its own queued');
    t('and does not stop the night', r.took.phase === 'play', r.took.phase);
    t('and it is not offered twice', r.took.gone === true, r.took.gone ? 'done' : 'still offered');
  } else {
    t('there was one to look at', false, 'none reachable');
  }

  t('none of it shows while she is on the cameras', r.withTube.shown === false,
    r.withTube.why || 'shown with the tube up');
  t('nothing in any of that threw', errs.length === 0, errs.slice(0, 2).join(' | ') || 'clean');

  console.log(`\n${pass} passed, ${fail} failed`);
  await b.close();
  process.exit(fail ? 1 : 0);
})();
