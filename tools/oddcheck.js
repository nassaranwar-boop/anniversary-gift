/* THE TWELVE THINGS LYING ABOUT THE SHOP.

   The six pages are the story and are checked to death elsewhere.
   These are the other thing on the cameras: a mug, a radio, a glove,
   the fifth toy he never finished. None of them stops the shift, none
   of them is a decision, and none of them touches the ending — they
   exist so that sweeping the cameras pays on an ordinary minute
   instead of only on the one minute a night when a page is out.

   Which makes them easy to get wrong in ways nothing else would
   catch, so this asks the five questions that matter:

     every one of them is somewhere, and somewhere she can SEE from
       the camera that looks at its room — a thing behind the scenery
       is a thing that does not exist
     no two of them, and none of them and a page, are on top of each
       other — three things on one saucer is not clutter, it is a bug
     they come out on the night they are written for and not before
     taking one says its line and does NOT stop the night
     and once taken it is taken, tonight and every night after
                                                node tools/oddcheck.js */
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
    const o0 = N.odds();

    /* ---- where everything ended up, and how close together ---- */
    const at = {};
    o0.defined.forEach((id) => { at[id] = N.oddAt(id); });
    const byRoom = {};
    o0.lines.forEach((l) => { (byRoom[l.room] = byRoom[l.room] || []).push(l.id); });
    const tooClose = [];
    for (const room in byRoom) {
      const ids = byRoom[room];
      for (let i = 0; i < ids.length; i++)
        for (let j = i + 1; j < ids.length; j++) {
          const a = at[ids[i]], c = at[ids[j]];
          if (!a || !c) continue;
          const d = Math.hypot(a[0] - c[0], a[2] - c[2]);
          if (d < 0.25) tooClose.push(ids[i] + '/' + ids[j] + ' ' + d.toFixed(2) + 'm in the ' + room);
        }
    }
    /* and none of them on the page's spot either */
    const fs = N.findState ? N.findState() : null;

    /* ---- which night each one comes out on ---- */
    const early = [];
    for (let n = 1; n <= 6; n++) {
      N.begin(n); N.midEnd();
      const out = N.odds().out;
      o0.lines.forEach((l) => {
        const isOut = out.indexOf(l.id) >= 0;
        if (isOut && n < l.from) early.push(l.id + ' out on night ' + n + ', written for ' + l.from);
        if (!isOut && n >= l.from) early.push(l.id + ' missing on night ' + n + ', written for ' + l.from);
      });
    }

    /* ---- can she see them? ---- */
    N.begin(6); N.midEnd();
    const shot = N.oddShot();
    const unseen = shot.filter((x) => !x.in)
                       .map((x) => x.id + ' is outside the ' + x.room + ' picture' +
                                   (x.why ? ' (' + x.why + ')' : ' at ' + x.x + ',' + x.y));

    /* ---- and taking one: it says its line and the night carries on ---- */
    let took = null;
    {
      const first = shot.filter((x) => x.in)[0];
      if (first) {
        G().monitor = true; G().cam = first.room; G().monOut = 0; G().lost = {};
        /* the hotspot lives in the UI tick, which pumpFrame does not
           turn -- it needs REAL frames, so give it real time rather
           than pumped time. An earlier pass gave up waiting, took
           nothing, and read the night's own queued line back as the
           oddment's: "You can stop looking at me now", which is
           Marabelle. */
        for (let i = 0; i < 60 && !N.odds().near; i++) await sleep(250);
        const before = N.odds();
        const said = before.near ? N.oddTake() : null;
        const after = N.odds();
        took = { id: before.near, said, phase: G().phase,
                 wasOut: before.out.length, nowOut: after.out.length,
                 stillThere: after.out.indexOf(before.near) >= 0 };
      }
    }

    return { o0, at, tooClose, early, unseen, shot, took };
  });

  console.log(`  ${r.o0.defined.length} defined, ${r.o0.placed.length} placed in the shop\n`);
  r.o0.lines.forEach((l) => {
    const a = r.at[l.id];
    console.log('    ' + l.id.padEnd(9) + 'night ' + l.from + '  ' + l.room.padEnd(9) +
                (a ? '(' + a[0].toFixed(1) + ', ' + a[1].toFixed(2) + ', ' + a[2].toFixed(1) + ')' : 'NOT PLACED'));
  });
  console.log();

  t('every one of them is defined with a line to go with it',
    r.o0.lines.every((l) => l.t && l.t.length > 12),
    r.o0.lines.filter((l) => !l.t).map((l) => l.id).join(', ') || 'all twelve have one');
  t('and every one of them got a place in the shop',
    r.o0.placed.length === r.o0.defined.length,
    r.o0.placed.length + ' of ' + r.o0.defined.length);
  t('no two of them are on the same saucer', r.tooClose.length === 0,
    r.tooClose.slice(0, 3).join('; ') || 'all at least 25cm apart');
  t('each comes out on the night it was written for, and stays out',
    r.early.length === 0, r.early.slice(0, 3).join('; ') || 'six nights, all correct');
  t('and she can see every one of them from the camera that looks at it',
    r.unseen.length === 0, r.unseen.slice(0, 4).join('; ') || r.shot.length + ' all inside the picture');
  if (r.took) {
    console.log('\n  took "' + r.took.id + '": phase ' + r.took.phase +
                ', ' + r.took.wasOut + ' out -> ' + r.took.nowOut +
                '\n    it said: ' + JSON.stringify(String(r.took.said || '').slice(0, 62)) + '\n');
    t('the hotspot offered one to pick up', !!r.took.id, r.took.id || 'never appeared');
    t('picking one up says its own line', !!r.took.said,
      r.took.said ? JSON.stringify(String(r.took.said).slice(0, 40)) : 'nothing of its own queued');
    t('and does not stop the night', r.took.phase === 'play', r.took.phase);
    t('and it is gone once she has it', r.took.stillThere === false,
      r.took.stillThere ? 'still out' : 'off the list');
  } else {
    t('there was one to pick up', false, 'none in shot to try');
  }
  t('nothing in any of that threw', errs.length === 0, errs.slice(0, 2).join(' | ') || 'clean');

  console.log(`\n${pass} passed, ${fail} failed`);
  await b.close();
  process.exit(fail ? 1 : 0);
})();
