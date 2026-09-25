/* THE CAPTION, WHICH IS HOW SHE KNOWS WHO IS TALKING.

   Four of the five voices in this chapter belong to things that walk,
   and the only way the player can tell a soldier from an owl from a
   jack-in-the-box is the name on the front of the line. It is put there
   as an <em> in the character's own colour, ahead of the words.

   Then the words light up one at a time as they are spoken, and the
   loop that did that lighting walked EVERY child of the caption and
   wrote className on it. The name is a child. So one frame after any of
   them said anything, the loop wiped the class that makes the name a
   name -- and, because the name occupies the first slot, lit every word
   one position late and never lit the last word at all. Anwar has no
   name chip, so his lines were fine, which is why it survived: the only
   lines that were wrong were the ones belonging to the characters the
   whole middle of the chapter is about.

   So this puts a line up through the chapter's own call and then looks
   at the caption, frame by frame, for the things a player would see. */
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

  const run = (who, through) => p.evaluate(async ([w, th]) => {
    const N = OuissysNightShift.__night, G = N.state();
    N.begin(1);
    /* the first minute holds the whole night still and nothing speaks
       over it, so the shift has to have started before a caption means
       anything: this is the same thing touching any control does */
    N.midEnd();
    const el = () => document.getElementById('ns-tape');
    /* a different sentence per speaker, because a take is looked up by
       its words and the chapter will not say the same line twice */
    const line = w === 'cogsworth' ? 'Alpha bravo charlie delta echo foxtrot golf hotel india juliet.'
               : w === 'chime'     ? 'Kilo lima mike november oscar papa quebec romeo sierra tango.'
               :                     'Uniform victor whiskey xray yankee zulu alpha bravo charlie delta.';
    N.tapeSayRaw(line, w, th);
    const look = () => {
      const e = el();
      const chip = e.querySelector('.ns-tape-who');
      const words = e.querySelectorAll('i[data-w]');
      const txt = [].map.call(words, (x) => x.textContent).join(' ');
      return { chip: chip ? chip.textContent : null,
               colour: chip ? chip.getAttribute('style') : null,
               cls: e.className,
               n: words.length,
               /* IS THIS STILL OUR LINE.

                  The night is running while this watches, so his own
                  tapes come due and replace the caption -- and a frame
                  showing one of HIS lines has no name on it, correctly,
                  and would otherwise read as the name having been lost.
                  Only frames still showing the test line count. */
               mine: txt.indexOf(line.split(' ')[0]) === 0,
               lit: [].map.call(words, (x) => x.className === 'on') };
    };
    /* IN REAL TIME, BECAUSE THE WORDS ARE ON A REAL CLOCK.

       The lighting is driven by perf() - the moment the line went up,
       so pumping two hundred frames in four milliseconds of wall clock
       lights nothing at all: the first word is not due yet. The page's
       own loop runs tapeTick; all this has to do is wait and look. */
    const film = [look()];
    for (let k = 0; k < 26; k++) {
      await new Promise((r) => setTimeout(r, 260));
      film.push(look());
    }
    return film;
  }, [who, through]);

  /* ---- one of the four, clear ---- */
  const cog = await run('cogsworth', false);
  ok('a line by one of the four is signed with its name',
     cog[0].chip === 'COGSWORTH', 'the caption opens with "' + cog[0].chip + '"');
  const mineC = cog.filter((f) => f.mine);
  ok('and the name is still there for the whole of the line',
     mineC.length > 3 && mineC.every((f) => f.chip === 'COGSWORTH'),
     mineC.length + ' frames of it, ' + mineC.filter((f) => f.chip === 'COGSWORTH').length + ' with the name');
  ok('and it is in that character\'s own colour',
     /--c:\s*#c8564a/.test(cog[0].colour || ''), cog[0].colour || 'no colour');
  ok('the caption is marked as one of theirs rather than his',
     /\bthem\b/.test(cog[0].cls) && !/through/.test(cog[0].cls), cog[0].cls);

  /* ---- the words light in order, and all of them do ---- */
  const litFrames = cog.filter((f) => f.mine);
  const firstOn = litFrames.map((f) => f.lit.indexOf(true)).filter((i) => i >= 0);
  const everLit = litFrames.length
    ? litFrames[litFrames.length - 1].lit.map((_, i) => litFrames.some((f) => f.lit[i])) : [];
  ok('every word of it lights up at some point, including the last one',
     everLit.length > 0 && everLit.every(Boolean),
     everLit.length ? everLit.filter(Boolean).length + ' of ' + everLit.length + ' words'
                    : 'no words');
  ok('and they light from the front, never out of order',
     litFrames.every((f) => {
       const on = f.lit.lastIndexOf(true);
       return on < 0 || f.lit.slice(0, on + 1).every(Boolean);
     }), 'a run from the first word');
  ok('and the first word is the first to light',
     firstOn.length === 0 || firstOn.every((i) => i === 0),
     firstOn.length ? 'first lit index ' + Math.min.apply(null, firstOn) : 'none lit');

  /* ---- through a wall ---- */
  const owl = await run('chime', true);
  ok('a line heard through a wall says so on the caption',
     /through/.test(owl[0].cls) && owl[0].chip === 'CHIME', owl[0].cls + ' / ' + owl[0].chip);

  /* ---- and his are unsigned, because there is only one of him ---- */
  const him = await run(null, false);
  ok('his own lines carry no name, because there is only one of him',
     him[0].chip === null && !/\bthem\b/.test(him[0].cls), him[0].cls);
  ok('and every word of HIS lights too',
     (() => { const f = him.filter((x) => x.mine);
       if (!f.length) return false;
       const ever = f[f.length - 1].lit.map((_, i) => f.some((y) => y.lit[i]));
       return ever.length > 0 && ever.every(Boolean); })(),
     (() => { const f = him.filter((x) => x.mine);
       if (!f.length) return 'his line never appeared';
       const ever = f[f.length - 1].lit.map((_, i) => f.some((y) => y.lit[i]));
       return ever.filter(Boolean).length + ' of ' + ever.length + ' words'; })());

  ok('and none of it threw', errs.length === 0, errs[0] || '');

  /* ---- AND THE BUILDING DOES NOT TALK OVER HIM ----

     Played cold, at two o'clock on night one: "HOUR ZERO TWO." in its
     own dark plate, printed across the words "and she was sitting", in
     the middle of Chime's line about him never once being four minutes
     early. Two captions, same pixels, neither readable.

     The two were given fixed offsets -- the strip at `bottom:14cqh`,
     the tape at `bottom:9cqh` -- which is fine while the tape is one
     line of his and wrong the moment it is three: a name, a line, and
     THROUGH THE DOOR under it. That is most of what the caption is once
     the four of them start talking, and the hour turns six times a
     night.

     The tape's height is the thing that varies, and it varies with the
     screen, so this asks at three shapes and it asks for the worst case
     the chapter can produce: one of them, through a wall, saying
     something long enough to wrap. */
  console.log();
  for (const vp of [{ width: 1000, height: 640, name: 'laptop' },
                    { width: 740, height: 360, name: 'phone sideways' },
                    { width: 390, height: 780, name: 'phone upright' }]) {
    const q = await b.newPage({ viewport: { width: vp.width, height: vp.height } });
    await q.route('**/*', (r) => { const u = r.request().url();
      if (u.indexOf('book-scene.js') >= 0) return r.abort();
      return u.startsWith('http://127.0.0.1') ? r.continue() : r.abort(); });
    await q.goto('http://127.0.0.1:8899/index.html', { waitUntil: 'domcontentloaded', timeout: 120000 });
    await q.evaluate(() => { try { localStorage.clear(); } catch (e) {} showScreen('nightshift');
      return loadChapter('nightshift').then(() => OuissysNightShift.start()); });
    await q.waitForFunction(() => { try { return !!OuissysNightShift.__night.cast().jax; } catch (e) { return false; } },
                            { timeout: 180000, polling: 500 });
    await q.evaluate(() => { const N = OuissysNightShift.__night; N.begin(1); N.midEnd();
      N.tapeSayRaw('He was never four minutes early in his life, and he told her he would be, every night, for fifteen years.',
                   'chime', true);
      N.announce('HOUR ZERO TWO.'); });
    /* the page's own loop is what moves the strip, and a frame in here
       costs a second and a half */
    await q.waitForTimeout(4000);
    const r = await q.evaluate(() => {
      const t = document.getElementById('ns-tape'), y = document.getElementById('ns-say');
      const st = document.getElementById('ns-stage');
      if (!t || !y || t.hidden || y.hidden) return { up: false, tape: !t || t.hidden, say: !y || y.hidden };
      const a = t.getBoundingClientRect(), c = y.getBoundingClientRect(), s = st.getBoundingClientRect();
      return { up: true,
               over: !(c.bottom <= a.top || c.top >= a.bottom || c.right <= a.left || c.left >= a.right),
               gap: Math.round(a.top - c.bottom),
               inside: c.top >= s.top - 1 && c.bottom <= s.bottom + 1,
               tapeH: Math.round(a.height), sayH: Math.round(c.height),
               lift: getComputedStyle(st).getPropertyValue('--ns-say-lift').trim() };
    });
    ok(`${vp.name}: both captions are up at once`, r.up, JSON.stringify(r));
    if (r.up) {
      ok(`${vp.name}: the building does not print through his tape`, !r.over,
         `gap ${r.gap}px, tape ${r.tapeH}px tall, lifted ${r.lift || '0px'}`);
      ok(`${vp.name}: and the strip is still on the screen`, r.inside, JSON.stringify(r));
    }
    await q.close();
  }

  console.log(`\n${pass} passed, ${fail} failed`);
  await b.close();
  process.exit(fail ? 1 : 0);
})();
