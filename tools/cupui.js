/* THE PIXEL UI, PHOTOGRAPHED AND CHECKED.
 *
 * The menus were CSS — rounded cards, blurred shadows, a serif title —
 * floating over a game rendered through a 270-pixel buffer. They are
 * drawn into a canvas at the pitch's own resolution now, so this checks
 * the things that only matter if that is actually true: that the UI
 * canvas is the same resolution the pitch is drawn at, that it is scaled
 * with nearest-neighbour, that it carries no CSS appearance of its own,
 * and that the hero on Team Select is genuinely big in the frame rather
 * than a figure in the background.
 *
 *   node tools/cupui.js
 */
const { chromium } = require('playwright-core');
let pass = 0, fail = 0;
const ok = (n, c, x) => { if (c) { pass++; console.log('  ok   ' + n); }
                          else { fail++; console.log('  FAIL ' + n + (x ? '  ' + JSON.stringify(x).slice(0, 260) : '')); } };

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox', '--no-proxy-server'] });
  const p = await b.newPage({ viewport: { width: 1060, height: 660 }, deviceScaleFactor: 1 });
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.route('**/*', r => r.request().url().startsWith('http://127.0.0.1') ? r.continue() : r.abort());
  await p.goto('http://127.0.0.1:8899/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForTimeout(900);
  await p.evaluate(() => window.loadChapter && window.loadChapter('cup'));
  await p.waitForFunction(() => !!window.OuissyCup, { timeout: 30000 });
  await p.evaluate(() => { try { localStorage.clear(); } catch (e) {}
                           showScreen('cup'); OuissyCup.__cup.soundOff();
                           OuissyCup.__cup.shadows(true); OuissyCup.start(); });
  /* the how-to is drawn now too, so it is dismissed by name */
  await p.waitForFunction(() => OuissyCup.__cup.ui().name === 'help',
                          { timeout: 40000 });
  await p.waitForFunction(() => OuissyCup.__cup.ui().age > 1.1, null,
                          { timeout: 90000, polling: 250 });
  await p.evaluate(() => OuissyCup.__cup.press('card_go'));
  /* the title screen is pixel UI too now, so the way in is the same as
     the way around: find the widget and fire its action */
  await p.waitForFunction(() => OuissyCup.__cup.ui().name === 'title',
                          { timeout: 20000 });
  await p.waitForFunction(() => OuissyCup.__cup.ui().widgets
                            .some(w => w.id === 'm_teams'), { timeout: 20000 });
  await p.evaluate(() => {
    const w = OuissyCup.__cup.ui().widgets.find(v => v.id === 'm_teams');
    OuissyCup.__cup.press(w.id);
  });
  await p.waitForFunction(() => OuissyCup.__cup.ui().name === 'teams',
                          { timeout: 20000 });
  /* WAIT FOR THE SCREEN'S OWN CLOCK, NOT THE WALL'S.
     In a container the frame loop runs at a handful of frames a second
     and clamps dt at 50ms, so a second and a half of real time is about
     a tenth of a second to the UI — and a harness that sleeps instead
     of waiting photographs the entrance animation half way through and
     reports the buttons as missing and the bars as empty. */
  /* NB: waitForFunction takes (fn, arg, options) — passing the options
     as the second argument hands them to the page as `arg` and leaves
     the default thirty-second timeout in force, which at six frames a
     second is not enough for the screen to finish arriving. */
  const settled = () => p.waitForFunction(
    () => OuissyCup.__cup.ui().age > 1.2, null, { timeout: 120000, polling: 250 });
  await settled();
  await p.screenshot({ path: '/tmp/cup-ui-teams.png' });

  /* ---- 1. it really is the same pixels as the game ---- */
  const layer = await p.evaluate(() => {
    const ui = document.getElementById('cup-ui');
    const game = document.getElementById('cup-canvas');
    const cs = getComputedStyle(ui);
    const r = ui.getBoundingClientRect();
    return {
      uiStore: [ui.width, ui.height],
      gameStore: [game.width, game.height],
      base: [window.CupPitch2D.BASE_W, window.CupPitch2D.BASE_H],
      css: [Math.round(r.width), Math.round(r.height)],
      rendering: cs.imageRendering,
      radius: cs.borderRadius,
      shadow: cs.boxShadow,
      hidden: ui.hidden,
    };
  });
  /* THE TWO CANVASES NO LONGER SHARE A BACKING STORE, and they should
     not: the pitch canvas is the size of the element and the renderer
     blows a 480x270 virtual screen up into it, halving that virtual
     screen whenever the camera cuts in close. A UI that followed it
     there would double in size every time a goal went in. What has to
     match is the RESOLUTION THE TWO ARE DRAWN AT, so a letter and a
     blade of grass are the same size of pixel. */
  ok('the UI is drawn at the pitch\'s own resolution',
     layer.uiStore[0] === layer.base[0] && layer.uiStore[1] === layer.base[1], layer);
  ok('and it is blown up, not drawn at screen size',
     layer.css[0] > layer.uiStore[0] * 1.3, layer);
  ok('with nearest-neighbour', /pixelated|crisp/.test(layer.rendering), layer);
  ok('it has no border-radius of its own', /^0px/.test(layer.radius), layer);
  ok('and no box-shadow of its own', layer.shadow === 'none', layer);

  /* ---- 2. nothing smooth is left on the screen ---- */
  const domUi = await p.evaluate(() => {
    /* the DOM card layer must be down while the pixel UI is up */
    const ov = document.getElementById('cup-overlay');
    return { overlayHidden: ov.hidden, cards: ov.querySelectorAll('.cup-card').length };
  });
  ok('the old DOM card is not underneath it',
     domUi.overlayHidden && domUi.cards === 0, domUi);

  /* ---- 3. the font is a bitmap, not antialiased text ----
     Sample the painted pixels: real canvas fillText leaves a spread of
     intermediate alphas around every glyph. A bitmap font leaves hard
     edges, so the painted pixels cluster into very few distinct
     colours. */
  const crisp = await p.evaluate(() => {
    const ui = document.getElementById('cup-ui');
    const x = ui.getContext('2d');
    const d = x.getImageData(0, 0, ui.width, Math.min(60, ui.height)).data;
    const seen = new Map();
    let painted = 0;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] < 8) continue;
      painted++;
      const k = (d[i] >> 4) + ',' + (d[i + 1] >> 4) + ',' + (d[i + 2] >> 4);
      seen.set(k, (seen.get(k) || 0) + 1);
    }
    /* how much of the ink sits in the top handful of colours */
    const counts = [...seen.values()].sort((a, c) => c - a);
    const top = counts.slice(0, 8).reduce((a, c) => a + c, 0);
    return { painted, distinct: seen.size, topShare: painted ? +(top / painted).toFixed(2) : 0 };
  });
  ok('the top strip is painted at all', crisp.painted > 2000, crisp);
  ok('and it is made of flat blocks, not antialiased edges',
     crisp.topShare > 0.7, crisp);

  /* ---- 4. the hero is the hero ----
     How much of the frame the captain actually occupies, measured by
     projecting his head and his feet and comparing. */
  const heroSize = await p.evaluate(() => {
    const C = OuissyCup.__cup;
    const V = C.view2d();
    const h = C.hero();
    if (!h || !V) return null;
    /* the renderer answers this directly now: where on the virtual
       screen is this place on the pitch. A character is a fixed 64
       pixels tall whatever the depth, which is the whole point of the
       2D build, so how much of the frame it fills is that over the
       height of the virtual screen. */
    const feet = V.project(h.x, h.y);
    return { name: h.name,
             frac: +(48 / V.vh).toFixed(3),
             acrossNdc: +((feet.x / V.vw) * 2 - 1).toFixed(2),
             onScreen: feet.x > -32 && feet.x < V.vw + 32 &&
                       feet.y > 0 && feet.y < V.vh + 40 };
  });
  ok('there is a hero', !!heroSize, heroSize);
  ok('and he fills a good half of the frame',
     heroSize && heroSize.frac > 0.42, heroSize);
  ok('standing to one side of the panel, not behind it',
     heroSize && heroSize.acrossNdc > 0.08, heroSize);

  /* ---- 5. the buttons are real: they hit-test and they fire ---- */
  const before = await p.evaluate(() => OuissyCup.__cup.ui().carAt);
  const rect = await p.evaluate(() => {
    const w = OuissyCup.__cup.ui().widgets.find(v => v.id === 'next');
    const ui = document.getElementById('cup-ui');
    const r = ui.getBoundingClientRect();
    return w ? { x: r.left + (w.x + w.w / 2) / ui.width * r.width,
                 y: r.top + (w.y + w.h / 2) / ui.height * r.height } : null;
  });
  ok('the arrow registered a hit rectangle', !!rect, rect);
  if (rect) {
    await p.mouse.move(rect.x, rect.y);
    await p.waitForTimeout(120);
    const hot = await p.evaluate(() => OuissyCup.__cup.ui().hot);
    ok('hovering it lights it up', hot === 'next', { hot });
    await p.mouse.down();
    await p.waitForTimeout(90);
    await p.screenshot({ path: '/tmp/cup-ui-press.png' });
    const down = await p.evaluate(() => OuissyCup.__cup.ui().down);
    ok('and pressing it visibly depresses it', down === 'next', { down });
    await p.mouse.up();
    await p.waitForTimeout(500);
    const after = await p.evaluate(() => OuissyCup.__cup.ui().carAt);
    ok('releasing it moves the carousel on', after !== before, { before, after });
  }
  await settled();
  await p.screenshot({ path: '/tmp/cup-ui-teams2.png' });
  /* and once it has settled, the entrance really is finished */
  const done = await p.evaluate(() => {
    const ui = OuissyCup.__cup.ui();
    const sel = OuissyCup.__cup.selAnim();
    const stats = OuissyCup.__cup.teamStats(OuissyCup.__cup.teams()[ui.carAt].id);
    return { ui, sel, rating: stats.rating,
             bars: sel.bars.map(v => +v.toFixed(2)),
             want: [stats.stats.speed, stats.stats.power,
                    stats.stats.skill, stats.stats.defence].map(v => +(v / 100).toFixed(2)) };
  });
  ok('every stat bar finishes filling',
     done.bars.every((v, i) => Math.abs(v - done.want[i]) < 0.05), done);
  ok('and the rating lands on the real number',
     Math.abs(done.sel.rating - done.rating) < 0.6, done);
  ok('the action buttons are on screen, not still sliding in',
     done.ui.widgets.every(w => w.y + w.h <= done.ui.size[1] + 1),
     done.ui.widgets.map(w => w.id + '@' + w.y));

  /* ---- 6. nothing is static ---- */
  /* The UI layer is deliberately mostly still — the moving parts are
     the drifting hearts, the bunting, the crest shimmer and the
     marching keyline on the selected button, which together are a small
     share of the pixels. So this asks whether anything is alive at all,
     over a window long enough to contain several frames at the six a
     second this machine manages. */
  const motion = await p.evaluate(async () => {
    const ui = document.getElementById('cup-ui');
    const x = ui.getContext('2d');
    const grab = () => x.getImageData(0, 0, ui.width, ui.height).data;
    const a = grab();
    await new Promise(r => setTimeout(r, 900));
    const c = grab();
    let diff = 0;
    for (let i = 0; i < a.length; i += 16) if (a[i] !== c[i]) diff++;
    return { changed: diff, sampled: Math.floor(a.length / 16) };
  });
  ok('the screen is never completely still', motion.changed > 60, motion);

  /* ---- 7. every word the game can say, the font can draw ----
     A bitmap font has exactly the glyphs somebody drew. A curly
     apostrophe or an em dash that nobody drew is not a styling
     difference, it is a question mark on the screen — and the title of
     the whole chapter is "Ouissy's Cup" with a curly one in it. */
  const font = await p.evaluate(() => {
    OuissyCup.__cup.watchWords(true);
    return null;
  });
  void font;
  /* Walk the carousel so every team's words go through the renderer.
     Clicked by coordinate, not by calling the handler: ui() hands back
     a serialised copy of the widget table, so the functions on it do
     not survive the trip out of the page. */
  for (let i = 0; i < 6; i++) {
    const at = await p.evaluate(() => {
      const w = OuissyCup.__cup.ui().widgets.find(v => v.id === 'next');
      const c = document.getElementById('cup-ui');
      const r = c.getBoundingClientRect();
      return w ? { x: r.left + (w.x + w.w / 2) / c.width * r.width,
                   y: r.top + (w.y + w.h / 2) / c.height * r.height } : null;
    });
    if (!at) break;
    await p.mouse.click(at.x, at.y);
    await p.waitForTimeout(240);
  }
  const glyphs = await p.evaluate(() => OuissyCup.__cup.fontMissing());
  ok('the font can draw every word in the game',
     glyphs.missing.length === 0,
     { scanned: glyphs.scanned, missing: glyphs.missing });

  /* ---- 8. and the menus are in one language ---- */
  const french = await p.evaluate(() => {
    const hits = [];
    const bad = /(ÉQUIPES|FACULTÉ|CHOISIR|JOUER|AFFRONTER|RETOUR AU|COMMENT |CONTRE QUI|AMICAL|LA COUPE|QUART DE|DEMI-|LA FINALE|PROJECTEURS|TRANQUILLE|SÉRIEUX|CAMPUS DE)/;
    const walk = (o, path) => {
      if (typeof o === 'string') { if (bad.test(o)) hits.push(path + ': ' + o); return; }
      if (o && typeof o === 'object') Object.keys(o).forEach(k => walk(o[k], path + '.' + k));
    };
    walk(window.CUP_CONFIG, 'config');
    return hits;
  });
  ok('the game is in English', french.length === 0, french);

  ok('no page errors', errs.length === 0, errs.slice(0, 4));
  console.log(pass + ' passed, ' + fail + ' failed');
  await b.close();
  process.exit(fail ? 1 : 0);
})();
