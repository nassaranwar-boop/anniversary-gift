/* DOES THE WHOLE SITE STILL WORK, EVERY CHAPTER, AFTER THE MERGE?

   The night shift came back onto main beside the cup, and the risk of
   a merge like that is not that the new chapter fails -- you notice
   that -- it is that one of the five that were already there quietly
   stops. So this opens every chapter in turn, in one page, and says
   whether it loaded, whether its screen exists, and whether its
   stylesheet is actually reaching it.

   That last one is the point. A chapter whose CSS is dead still LOADS
   and RUNS, which is exactly how five unclosed braces got onto main
   without the first check noticing.                node tools/sitecheck.js */
const { chromium } = require('playwright-core');
const CHAPTERS = [
  { key: 'quest',      screen: 'screen-quest',      probe: 'hv-stage',      css: '.hv-frame' },
  { key: 'ouissy',     screen: 'screen-ouissy',     probe: 'so-stage',     css: '.so-hud' },
  { key: 'apoc',       screen: 'screen-apoc',       probe: 'ap-stage',     css: '.ap-hud' },
  { key: 'race',       screen: 'screen-race',       probe: 'rc-stage',     css: '.rc-hud' },
  { key: 'cup',        screen: 'screen-cup',        probe: 'cup-stage',    css: '.cup-hud' },
  { key: 'nightshift', screen: 'screen-nightshift', probe: 'ns-stage',     css: '.ns-say' },
];
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox','--no-proxy-server','--use-gl=swiftshader','--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 1200, height: 760 } });
  const errs = [];
  p.on('pageerror', e => errs.push(String(e.message).slice(0, 150)));
  await p.route('**/*', r => r.request().url().startsWith('http://127.0.0.1') ? r.continue() : r.abort());
  await p.goto('http://127.0.0.1:8899/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForTimeout(2500);

  let bad = 0;
  const say = (ok, name, detail) => { if (!ok) bad++;
    console.log((ok ? '  PASS  ' : '  FAIL  ') + name + (detail ? '   ' + detail : '')); };

  /* the stylesheet has to have PARSED, or every rule after the break is
     silently nested and does nothing */
  const css = await p.evaluate(() => {
    for (const sh of document.styleSheets) {
      let r; try { r = sh.cssRules; } catch (e) { continue; }
      if (sh.href && sh.href.indexOf('style.css') >= 0) return { rules: r.length };
    }
    return { rules: 0 };
  });
  say(css.rules > 2000, 'the stylesheet parses whole', css.rules + ' top-level rules');

  const cards = await p.evaluate(() => [...document.querySelectorAll('.hub-card')].map(c => c.id));
  say(cards.length === 6, 'six chapters on the board', cards.length + ': ' +
      cards.map(c => c.replace('hub-card-', '')).join(', '));

  for (const c of CHAPTERS) {
    const r = await p.evaluate(async (c) => {
      const scr = document.getElementById(c.screen);
      if (!scr) return { screen: false };
      showScreen(c.key);
      let loaded = true;
      try { await loadChapter(c.key); } catch (e) { loaded = false; }
      /* is there a rule for this chapter's own class anywhere? */
      let styled = false;
      for (const sh of document.styleSheets) {
        let rules; try { rules = sh.cssRules; } catch (e) { continue; }
        for (const ru of rules) {
          if (ru.selectorText && ru.selectorText.split(',').some(s => s.trim() === c.css)) { styled = true; break; }
        }
        if (styled) break;
      }
      return { screen: true, loaded: loaded, styled: styled };
    }, c);
    say(r.screen && r.loaded && r.styled, c.key.padEnd(11) + ' screen, file and styles',
        'screen ' + (r.screen ? 'y' : 'N') + ', loads ' + (r.loaded ? 'y' : 'N') +
        ', ' + c.css + ' ' + (r.styled ? 'y' : 'N'));
  }

  say(errs.length === 0, 'and nothing threw', errs.length ? [...new Set(errs)].join(' | ') : 'clean');
  console.log('\n' + (bad ? bad + ' failed' : 'the whole site is intact'));
  await b.close();
  process.exitCode = bad ? 1 : 0;
})();
