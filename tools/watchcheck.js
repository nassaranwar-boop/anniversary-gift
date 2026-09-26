/* HOLDING A CAMERA, WHICH THE CHAPTER ALREADY REWARDED AND NEVER SAID SO.

   Six seconds on one of the four and it notices. That has been in
   here for versions, and two things were wrong with it that only
   showed up when somebody asked what a player actually learns:

     it paid out TWICE in six nights -- Cogsworth early, Chime on
       night four -- and the other two never answered being looked at
       at all, which is strange for Marabelle in particular, who
       cannot move while she is watched
     and which line came back was chosen by the NIGHT, not by who was
       on the tube, so holding the camera on Jax could be answered by
       the soldier standing in the next room

   Both are fixed, and a ring now fills next to whoever she is holding
   it on -- but only while there is something still to be had, because
   a signal that promises nothing is worse than no signal at all.

   That last clause is the one worth checking hardest: the ring must
   be honest. If it is showing, a line must come.
                                               node tools/watchcheck.js */
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
    const says = N.watching().says;

    /* ---- hold the camera on each of the four in turn ---- */
    const runs = [];
    for (const row of says) {
      /* a night late enough for this one's line to be allowed */
      const night = Math.max(1, row.after || 1);
      N.begin(night); N.midEnd();
      const cast = N.cast();
      /* stand it somewhere that is not a doorway and look at it */
      N.only(row.id, 1);
      const ch = cast[row.id];
      ch.awake = true; ch.atDoor = false;
      N.camTo(ch.room);
      G().monOut = 0; G().lost = {};
      let sawRing = false, ringAt = null, fired = null;
      for (let k = 0; k < 400; k++) {
        N.pumpFrame(1 / 30);
        const w = N.watching();
        if (w.ring && !sawRing) { sawRing = true; ringAt = w.t; }
        const pend = N.tape().pending;
        if (pend && pend.t) { fired = pend.t; break; }
      }
      const w2 = N.watching();
      runs.push({ id: row.id, night, key: row.key, want: row.t,
                  fired, ok: fired === row.t, sawRing, ringAt,
                  who: w2.who, held: w2.t });
    }

    /* ---- and the ring must never promise what it cannot pay ---- */
    /* hold on one that has already said its piece: no ring */
    let honest = null;
    {
      const row = says[0];
      N.begin(Math.max(1, row.after || 1)); N.midEnd();
      const cast = N.cast();
      N.only(row.id, 1);
      cast[row.id].awake = true; cast[row.id].atDoor = false;
      N.camTo(cast[row.id].room);
      G().monOut = 0; G().lost = {};
      /* say its line first, so there is nothing left to be had */
      N.tapeSayRaw(row.t, row.who, false);
      let ring = false;
      for (let k = 0; k < 400; k++) { N.pumpFrame(1 / 30); if (N.watching().ring) { ring = true; break; } }
      honest = { id: row.id, ring };
    }

    return { says, runs, honest };
  });

  console.log('  what each of them says for being looked at:\n');
  r.says.forEach((s) => console.log('    ' + s.id.padEnd(10) + 'from night ' + (s.after || 1) +
                                    ', in ' + (s.who || 'anwar') + "'s voice"));
  console.log();
  r.runs.forEach((x) => console.log('    held on ' + x.id.padEnd(10) +
    (x.ok ? 'answered by itself' : 'ANSWERED BY ' + JSON.stringify(String(x.fired || 'nothing').slice(0, 40))) +
    (x.sawRing ? '   ring from ' + x.ringAt + 's' : '   NO RING')));
  console.log();

  t('all four of them have something to say for being watched',
    r.says.every((s) => s.t && s.t.length > 12),
    r.says.filter((s) => !s.t).map((s) => s.id).join(', ') || 'four of four');
  t('and each of them is cast to its own voice, not the narrator',
    r.says.every((s) => s.who && s.who === s.id),
    r.says.filter((s) => s.who !== s.id).map((s) => s.id + '=' + s.who).join(', ') || 'each its own');
  t('the one she is looking at is the one that answers',
    r.runs.every((x) => x.ok),
    r.runs.filter((x) => !x.ok).map((x) => x.id).join(', ') || 'four of four');
  t('and the ring shows while she is holding it',
    r.runs.every((x) => x.sawRing),
    r.runs.filter((x) => !x.sawRing).map((x) => x.id).join(', ') || 'every time');
  t('but never once there is nothing left to be had',
    r.honest && r.honest.ring === false,
    r.honest ? (r.honest.ring ? 'it promised a line that was already said' : 'stays dark') : 'not tested');
  t('nothing in any of that threw', errs.length === 0, errs.slice(0, 2).join(' | ') || 'clean');

  console.log(`\n${pass} passed, ${fail} failed`);
  await b.close();
  process.exit(fail ? 1 : 0);
})();
