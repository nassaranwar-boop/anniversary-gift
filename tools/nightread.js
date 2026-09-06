/* THE PLAYTHROUGH, WRITTEN DOWN.

   Every suite here checks that a thing works. None of them can tell
   you whether the six hours read as a story — whether a night drags,
   whether two beats land on top of each other, whether she is ever
   left with nothing.

   So this plays the chapter from the film to the last morning and
   transcribes everything she would actually receive, in the order she
   would receive it, with the clock beside it. It asserts nothing. It
   is for reading. */
const { chromium } = require('playwright-core');

(async () => {
  const b = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox','--no-proxy-server','--use-gl=swiftshader','--enable-unsafe-swiftshader'],
  });
  const p = await b.newPage({ viewport: { width: 1000, height: 640 } });
  await p.route('**/*', r => { const u = r.request().url();
    if (u.indexOf('book-scene.js') >= 0) return r.abort();
    return u.startsWith('http://127.0.0.1') ? r.continue() : r.abort(); });
  await p.goto('http://127.0.0.1:8899/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForTimeout(700);
  await p.evaluate(() => { try { localStorage.clear(); } catch (e) {}
    showScreen('nightshift'); OuissysNightShift.start(); OuissysNightShift.__night.silence(true); });
  await p.waitForFunction(() => Object.keys(OuissysNightShift.__night.cast()).length >= 4,
                          { timeout: 20000, polling: 200 });

  const W = (fn, a) => p.evaluate(fn, a);
  const out = [];
  const say = (s) => { out.push(s); console.log(s); };

  /* ---- the opening ---- */
  say('\n' + '='.repeat(70) + '\n  THE FILM\n' + '='.repeat(70));
  const film = await W(() => {
    const NS = OuissysNightShift.__night.words();
    return { head: NS.intro.head, sub: NS.intro.sub,
             beats: NS.intro.beats.map(b => b.lines) };
  });
  say('  ' + film.head + ' — ' + film.sub);
  film.beats.forEach((ls, i) => { say(''); ls.forEach(l => say('    ' + l)); });

  say('\n' + '='.repeat(70) + '\n  THE TERMS (the shutters come down)\n' + '='.repeat(70));
  const terms = await W(() => OuissysNightShift.__night.words().terms.lines);
  terms.forEach(l => say('    ' + l));

  /* ---- each night ---- */
  for (let n = 1; n <= 6; n++) {
    const night = await W((n) => {
      const w = OuissysNightShift.__night, NS = w.words();
      w.route('night:' + n);
      const cfg = w.nightCfg(n);
      const card = document.querySelector('.ns-card-brief');
      return {
        name: cfg.name, title: cfg.title, blurb: cfg.blurb, tone: cfg.tone,
        why: NS.why[n],
        rule: (card && card.querySelector('.ns-rule')) ?
              card.querySelector('.ns-rule').textContent : null,
        tapes: (NS.tapes[n] || []).map(t => [t.h, t.t]),
        reveal: NS.reveal[n],
        hook: NS.hooks[n] || null,
        feel: (w.score().feel['n' + n] || {}).feel,
        find: (NS.finds.filter(f => f.on === n)[0] || {}),
      };
    }, n);
    say('\n' + '='.repeat(70));
    say('  ' + night.name + ' — ' + night.title + '   [' + night.tone + ' / ' + night.feel + ']');
    say('='.repeat(70));
    say('  card:   ' + night.blurb);
    say('  for:    ' + night.why);
    if (night.rule) say('  rule:   ' + night.rule);
    say('');
    let prev = 0, worst = 0, worstAt = 0;
    night.tapes.forEach(([h, t]) => {
      const secs = h * 56;
      const gap = secs - prev;
      if (gap > worst) { worst = gap; worstAt = secs; }
      prev = secs;
      const hh = Math.floor(h), mm = Math.round((h - hh) * 60);
      say('   ' + String(12 + hh === 12 ? 12 : (hh % 12)) .padStart(2) + ':' +
          String(mm).padStart(2, '0') + '  ' + t);
    });
    say('\n   [longest silence between his lines: ' + Math.round(worst) + 's]');
    say('\n   3:00 AM — SHE FINDS: ' + night.reveal.head + '  (' + night.reveal.at + ')');
    night.reveal.lines.forEach(l => say('        ' + l.replace(/&[a-z]+;/g, '"')));
    say('        he says: "' + night.reveal.say + '"');
    say('        > ' + night.reveal.keep + '   /   ' + night.reveal.burn);
    if (night.find && night.find.title) {
      say('\n   hidden on camera ' + (night.find.room || '?') + ': ' + night.find.title);
    }
    if (night.hook) say('\n   6:00 AM leaves her with: ' + night.hook);
  }

  /* ---- the last morning ---- */
  say('\n' + '='.repeat(70) + '\n  SIX O\'CLOCK ON THE LAST MORNING\n' + '='.repeat(70));
  const end = await W(() => {
    const NS = OuissysNightShift.__night.words();
    return { finale: NS.finale.lines, ask: NS.ending.ask,
             wind: NS.ending.wind.lines, leave: NS.ending.leave.lines,
             kept: NS.kept, last: NS.lastPage.lines };
  });
  end.finale.forEach(l => say('    ' + l));
  say('\n    ' + end.ask);
  say('\n  [WIND THEM]');
  end.wind.forEach(l => say('    ' + l));
  say('\n  [and then, out of the six nights of keeping and burning]');
  Object.keys(end.kept).filter(k => k !== 'ask').forEach(k =>
    say('    ' + k.padEnd(6) + ' ' + end.kept[k]));
  say('\n  [and the last thing the chapter says]');
  end.last.forEach(l => say('    ' + l.replace(/&[a-z]+;/g, '"')));

  await b.close();
})();
