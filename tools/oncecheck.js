/* THE LINES THAT ARE ONLY EVER SAID ONCE, SAID ONCE.

   The middle of this chapter is built out of first times. The first
   thing any of the four ever says to her. The first time she winds one
   and it thanks her. The first time she shuts a door on one and the one
   she shut it on tells her she was right to. Their own notes say so:
   "each is once, ever", "once each, ever".

   They were not. The guard was TAPE.said, which tapeReset empties at
   the start of every night because it is also what stops a line being
   repeated inside one shift -- so every one of them came back at the
   same minute of the next night, and the next. Played end to end,
   "You are still here. He said you would be. He was not sure, but he
   said it." -- the first words spoken to her by anything in that
   building -- arrived four nights running.

   So this plays nights one to four as one continuous playthrough, with
   nothing cleared in between, and writes down every line of theirs that
   reaches her. Anything that appears twice is a first time that
   happened again. */
const { chromium } = require('playwright-core');

let pass = 0, fail = 0;
const ok = (n, c, note) => { c ? pass++ : fail++;
  console.log(`${c ? 'PASS' : 'FAIL'}  ${n}${note ? '   ' + note : ''}`); };

(async () => {
  const b = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox', '--no-proxy-server', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 1000, height: 640 } });
  const errs = [];
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
  await p.waitForFunction(() => {
    try { return !!OuissysNightShift.__night.cast().jax; } catch (e) { return false; }
  }, { timeout: 30000, polling: 200 });

  const out = await p.evaluate(() => {
    const N = OuissysNightShift.__night, G = N.state(), cast = N.cast();
    /* a clean playthrough: she has been told nothing yet */
    N.forgetTold();
    const heard = [];
    for (const night of [1, 2, 3, 4]) {
      N.begin(night);
      let last = '';
      for (let k = 0; k < 60 * 30 * 8; k++) {
        /* played competently, and kept alive so the whole night runs */
        for (const side of ['left', 'right', 'hatch']) {
          let there = false;
          for (const id in cast) {
            const c = cast[id];
            if (c.awake && c.atDoor && !c.talking && c.def.door === side) there = true;
          }
          G.doors[side] = there;
        }
        G.power = Math.max(G.power, 45);
        if (G.phase !== 'play') G.phase = 'play';
        N.pumpFrame(1 / 30);
        const d = N.tapeDebug();
        if (d.line && d.line !== last) {
          heard.push({ night, who: d.who || 'anwar', t: d.line, hour: G.hour });
          last = d.line;
        }
        if (G.hour >= 6) break;
      }
    }
    return { heard, told: Object.keys(N.told()).length };
  });

  /* which of them are supposed to be once-ever */
  const seen = {};
  const twice = [];
  /* WHAT MAY BE REPEATED AND WHAT MAY NOT.

     Coming to a door and asking is a thing one of them does more than
     once over six nights, and saying thank you when she opens it is a
     thing anybody would say every time. What may not repeat is the
     PAYLOAD -- the thing it came to the door to tell her, which is
     written as a first time. So the asks and the two answers to them
     are excluded by name rather than by guesswork. */
  const asks = await p.evaluate(() => {
    const N = OuissysNightShift.__night, S = N.script() || {};
    const out = {};
    for (const k in (S.beg || {})) (S.beg[k] || []).forEach((l) => { out[l] = 1; });
    for (const k in (S.begShut || {})) out[S.begShut[k]] = 1;
    for (const k in (S.begOpen || {})) out[S.begOpen[k]] = 1;
    return out;
  });
  out.heard.forEach((h) => {
    if (h.who === 'anwar') return;              // his hourly tapes are per night by design
    if (asks[h.t]) return;                      // asking again is not repeating yourself
    if (seen[h.t]) twice.push({ t: h.t, who: h.who, first: seen[h.t], again: h.night });
    else seen[h.t] = h.night;
  });

  ok('a line one of the four says to her is never said to her again',
     twice.length === 0,
     twice.length ? `${twice.length} repeated` : `${Object.keys(seen).length} of theirs, each once`);
  twice.slice(0, 8).forEach((x) =>
    console.log(`        ${x.who.toUpperCase()} night ${x.first} and ${x.again}: [${x.t.length} chars] "${x.t}"`));

  ok('and the shop remembers what it has told her between nights',
     out.told > 0, out.told + ' lines remembered');

  /* and a fresh playthrough gets its first times back */
  const again = await p.evaluate(() => {
    const N = OuissysNightShift.__night, G = N.state(), cast = N.cast();
    N.forgetTold();
    N.begin(1);
    let first = null;
    for (let k = 0; k < 60 * 30 * 8; k++) {
      /* kept alive properly rather than resurrected: putting the phase
         back to play after a death leaves the tape system switched off
         and nothing is said for the rest of the run */
      G.doors.left = G.doors.right = G.doors.hatch = true;
      G.power = Math.max(G.power, 45);
      if (G.phase !== 'play') break;
      N.pumpFrame(1 / 30);
      const d = N.tapeDebug();
      if (d.line && d.who && d.who !== 'anwar') { first = d.line; break; }
      if (G.hour >= 6) break;
    }
    return first;
  });
  ok('and starting the story again gives her the first times back',
     !!again, again ? `"${String(again).slice(0, 56)}"` : 'nothing of theirs was said at all');

  ok('and none of it threw', errs.length === 0, errs[0] || '');
  console.log(`\n${pass} passed, ${fail} failed`);
  await b.close();
  process.exit(fail ? 1 : 0);
})();
