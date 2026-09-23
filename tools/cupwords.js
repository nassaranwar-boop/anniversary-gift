/* THE PARTS THAT ARE NOT FOOTBALL.
 *
 * The memory cards between the rounds and the trophy card at the end.
 * Both of them used to be either absent or hard-coded: MEMORIES and
 * VICTORY sat in cup.config.js being read by nothing, while the ending
 * congratulated her on winning with Morocco and a bear at the back,
 * three renames after either of those existed.
 *
 * So this walks a whole cup — winning every tie — and checks that what
 * she is shown between the rounds and at the end is what the config
 * says, that the trophy is actually drawn, and that no placeholder text
 * ever reaches her.
 *
 *   node tools/cupwords.js
 */
const { chromium } = require('playwright-core');
let pass = 0, fail = 0;
const ok = (n, c, x) => { if (c) { pass++; console.log('  ok   ' + n); }
                          else { fail++; console.log('  FAIL ' + n + (x ? '  ' + JSON.stringify(x).slice(0, 300) : '')); } };

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox', '--no-proxy-server'] });
  const p = await b.newPage({ viewport: { width: 1060, height: 660 } });
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.route('**/*', r => r.request().url().startsWith('http://127.0.0.1') ? r.continue() : r.abort());
  await p.goto('http://127.0.0.1:8899/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForTimeout(900);
  await p.evaluate(() => window.loadChapter && window.loadChapter('cup'));
  await p.waitForFunction(() => !!window.OuissyCup, { timeout: 30000 });
  await p.evaluate(() => { try { localStorage.clear(); } catch (e) {}
                           showScreen('cup'); OuissyCup.__cup.soundOff();
                           OuissyCup.__cup.shadows(false); OuissyCup.start(); });
  await p.waitForSelector('#cup-overlay .cup-card', { timeout: 40000 });
  await p.evaluate(() => { const b2 = document.querySelector('[data-go="back"]'); if (b2) b2.click(); });
  await p.waitForSelector('[data-go="coupe"]', { timeout: 20000 });

  const cardText = () => p.evaluate(() =>
    (document.querySelector('#cup-overlay .cup-card') || {}).textContent || '');
  const press = async (sel) => {
    await p.evaluate((s) => { const el = document.querySelector(s); if (el) el.click(); }, sel);
    await p.waitForTimeout(450);
  };
  /* WAIT FOR THE CARD, DO NOT GUESS AT IT.
     The first kick-off is much slower than the rest — it is the one that
     builds the world, the eight rigs and the venue — so a fixed sleep
     that is comfortable for rounds two and three reads an empty overlay
     on round one, and the failure looks like a missing full-time card
     rather than like a harness in a hurry. */
  const awaitCard = async (re, ms) => {
    try {
      await p.waitForFunction((src) => {
        const c = document.querySelector('#cup-overlay .cup-card');
        return !!c && new RegExp(src).test(c.textContent || '');
      }, re.source, { timeout: ms || 12000 });
    } catch (e) { /* let the assertion report what is actually there */ }
  };

  /* ---- the config's own words, to compare against ---- */
  const CFG = await p.evaluate(() => ({
    memories: (window.CUP_CONFIG.MEMORIES || []).map(m => ({ title: m.title, line: m.line })),
    victory: window.CUP_CONFIG.VICTORY,
    rounds: (window.CUP_CONFIG.ROUNDS || []).length,
  }));
  ok('the config has a memory for every round but the last',
     CFG.memories.length >= CFG.rounds - 1, CFG.memories.length);

  /* ---- nothing marked PLACEHOLDER survives anywhere ---- */
  const placeholders = await p.evaluate(() => {
    const hits = [];
    const walk = (o, path) => {
      if (typeof o === 'string') {
        if (/PLACEHOLDER|LOREM|TODO|XXX|your message goes here/i.test(o)) hits.push(path + ': ' + o.slice(0, 60));
        return;
      }
      if (o && typeof o === 'object') Object.keys(o).forEach(k => walk(o[k], path + '.' + k));
    };
    walk(window.CUP_CONFIG, 'CUP_CONFIG');
    return hits;
  });
  ok('no placeholder text is left in the config', placeholders.length === 0, placeholders);

  /* ---- walk the cup, winning every tie ---- */
  await press('[data-go="coupe"]');
  ok('the cup opens on a fixture card', /KICK OFF/.test(await cardText()));

  const seen = [];
  for (let round = 0; round < CFG.rounds; round++) {
    /* skip the football: start the match, then declare it won */
    await press('.cup-card-b');                       // KICK OFF
    await p.evaluate(() => { OuissyCup.__cup.setScore(3, 0); OuissyCup.__cup.finish(true); });
    await awaitCard(/FULL TIME|YOU WON/);
    const full = await cardText();

    if (round < CFG.rounds - 1) {
      ok('round ' + (round + 1) + ' ends on a full-time card', /FULL TIME/.test(full), full.slice(0, 80));
      await press('.cup-card-b');                     // NEXT ROUND -> memory
      await p.screenshot({ path: '/tmp/cup-memory-' + (round + 1) + '.png' });
      const mem = await cardText();
      seen.push(mem);
      const want = CFG.memories[round];
      ok('and then a memory, in the config\'s words',
         !!want && mem.indexOf(want.line.slice(0, 40)) >= 0,
         { want: want && want.line.slice(0, 40), got: mem.slice(0, 140) });
      ok('the memory card is styled as one, not as a fixture',
         await p.evaluate(() => !!document.querySelector('.cup-card-mem')));
      await press('.cup-card-b');                     // GO ON -> next fixture
      ok('and the next fixture follows it', /KICK OFF/.test(await cardText()));
    } else {
      /* the final: straight to the trophy */
      await p.waitForTimeout(900);
      await p.screenshot({ path: '/tmp/cup-ending.png' });
      ok('the final ends on the trophy card',
         await p.evaluate(() => !!document.querySelector('.cup-card-win')), full.slice(0, 100));
      const end = await cardText();
      ok('with the title from the config',
         end.indexOf(CFG.victory.title) >= 0, { want: CFG.victory.title, got: end.slice(0, 90) });
      const lines = CFG.victory.lines || [CFG.victory.message];
      ok('and every one of his lines',
         lines.every(l => end.indexOf(l.slice(0, 40)) >= 0),
         { lines: lines.length, got: end.length });
      ok('and it is signed',
         !CFG.victory.signOff || end.indexOf(CFG.victory.signOff) >= 0, CFG.victory.signOff);
      ok('there is a trophy drawn on it',
         await p.evaluate(() => {
           const c = document.querySelector('.cup-card-win .cup-cupart canvas');
           if (!c) return false;
           /* and it is not a blank canvas: something was painted */
           const x = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
           let ink = 0;
           for (let i = 3; i < x.length; i += 4) if (x[i] > 20) ink++;
           return ink > c.width * c.height * 0.08;
         }));
      ok('the button says what the config says',
         end.indexOf(CFG.victory.button) >= 0, CFG.victory.button);
      ok('and the hub is told she finished it',
         await p.evaluate(() => { try { return !!localStorage.getItem('hv_cup_done') ||
                                         Object.keys(localStorage).some(k => /cup/i.test(k)); }
                                  catch (e) { return true; } }));
    }
  }

  ok('the memories she saw were different from each other',
     new Set(seen).size === seen.length, seen.length);
  ok('no page errors', errs.length === 0, errs.slice(0, 4));
  console.log(pass + ' passed, ' + fail + ' failed');
  await b.close();
  process.exit(fail ? 1 : 0);
})();
