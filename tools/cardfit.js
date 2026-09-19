/* EVERY CARD IN THE NIGHT SHIFT, ON A PHONE ON ITS SIDE.

   The side-by-side harness opens a chapter and looks at the first thing
   it shows. Most of the cards in this one are not that: the night card,
   how it works, the drawer, the record, the six o'clock card, the game
   over, the terms, the two endings and the film's letter all arrive
   later, and each of them is laid out against a laptop.

   This walks all of them at two landscape-phone sizes and asserts the
   two things that matter on a screen that cannot scroll: every control
   is ON the screen, and nothing is sitting on top of it.
                                                node tools/cardfit.js */
const { chromium } = require('playwright-core');

const SIZES = [[844, 390, '844x390'], [740, 360, '740x360'], [932, 430, '932x430']];
/* every card the chapter can put up, and how to ask for it */
const CARDS = [
  ['title',      (N) => N.route('title')],
  ['how it works', (N) => N.route('howto')],
  ['the record', (N) => N.route('badges')],
  ['the drawer', (N) => N.route('drawer')],
  ['sound',      (N) => N.route('sound')],
  ['custom night', (N) => N.route('custom')],
  ['the terms',  (N) => N.route('terms')],
  ['the night card', (N) => { N.route('title'); N.route('start'); }],
  ['a shift',    (N) => { N.begin(2); N.midEnd(); }],
  ['paused',     (N) => { N.begin(2); N.midEnd(); N.press('monitor'); N.route('quit'); }],
  ['game over',  (N) => { N.begin(3); N.midEnd();
                          const c = N.cast(), G = N.state();
                          Object.keys(c).forEach((k) => { c[k].asleep = true; c[k].awake = false; });
                          const j = c.jax; j.asleep = false; j.awake = true; j.wound = 9;
                          j.step = j.def.route.length - 2; N.syncOne('jax');
                          G.doors.left = G.doors.right = G.doors.hatch = false;
                          for (let i = 0; i < 900 && G.phase === 'play'; i++) N.pumpFrame(0.05); }],
  ['six o clock',(N) => { N.begin(4); const G = N.state();
                          const c = N.cast(); Object.keys(c).forEach((k) => { c[k].asleep = true; });
                          G.hour = 5; G.power = 70; N.pump(70); }],
  ['the film ending', (N) => { N.begin(6); const G = N.state();
                          const c = N.cast(); Object.keys(c).forEach((k) => { c[k].asleep = true; });
                          G.hour = 5; G.power = 60; N.pump(70); N.filmSeek(999); }],
  ['after the film', (N) => { N.route('finaleDone'); }],
];

let pass = 0, fail = 0;
const ok = (n, c, x) => { if (c) { pass++; } else { fail++; console.log('  FAIL ' + n + (x !== undefined ? '  ' + JSON.stringify(x) : '')); } };

(async () => {
  const b = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox', '--no-proxy-server', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  for (const [w, h, label] of SIZES) {
    const p = await b.newPage({ viewport: { width: w, height: h }, isMobile: true, hasTouch: true });
    const errs = [];
    p.on('pageerror', (e) => errs.push(e.message.slice(0, 90)));
    await p.route('**/*', (r) => r.request().url().startsWith('http://127.0.0.1') ? r.continue() : r.abort());
    await p.goto('http://127.0.0.1:8899/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await p.evaluate(() => { localStorage.setItem('ns_seenintro', '1'); localStorage.setItem('ns_terms', '1');
      localStorage.setItem('ns_notutor', '1');
      try { localStorage.setItem('ns_nights', JSON.stringify({1:1,2:1,3:1,4:1,5:1,6:1})); } catch (e) {}
      showScreen('nightshift');
      return loadChapter('nightshift').then(() => OuissysNightShift.start()); });
    await p.waitForFunction(() => window.OuissysNightShift && OuissysNightShift.__night,
                            { timeout: 25000, polling: 200 });
    console.log('\n--- ' + label);
    for (const [name, fn] of CARDS) {
      await p.evaluate((src) => {
        const N = OuissysNightShift.__night;
        try { (new Function('N', 'return (' + src + ')(N)'))(N); } catch (e) { window.__cardErr = e.message; }
      }, fn.toString()).catch(() => {});
      await p.waitForTimeout(700);
      const r = await p.evaluate(() => {
        const vw = innerWidth, vh = innerHeight;
        const o = document.getElementById('ns-overlay');
        const up = o && !o.hidden && getComputedStyle(o).display !== 'none' && o.innerHTML.trim().length > 0;
        const out = { up: !!up, off: [], covered: [], card: null,
                      cls: o.className.slice(0, 40),
                      txt: (o.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 44) };
        if (!up) return out;
        const card = o.querySelector('.ns-card, .ns-card-win, .ns-card-over, .ns-card-fin, [class*="ns-card"]');
        if (card) {
          const cr = card.getBoundingClientRect();
          out.card = { h: Math.round(cr.height), top: Math.round(cr.top), bottom: Math.round(cr.bottom),
                       scale: card.style.transform || 'none' };
        }
        o.querySelectorAll('button, [data-go], input').forEach((el) => {
          const cs = getComputedStyle(el);
          const r2 = el.getBoundingClientRect();
          if (cs.display === 'none' || cs.visibility === 'hidden' || r2.width < 2 || r2.height < 2) return;
          const id = (el.dataset && el.dataset.go) || el.id || (el.textContent || '').trim().slice(0, 18) || el.tagName;
          if (r2.left < -1 || r2.top < -1 || r2.right > vw + 1 || r2.bottom > vh + 1) out.off.push(id);
          const cx = r2.left + r2.width / 2, cy = r2.top + r2.height / 2;
          if (cx < 0 || cy < 0 || cx > vw || cy > vh) return;
          const hit = document.elementFromPoint(cx, cy);
          if (hit && hit !== el && !el.contains(hit) && !hit.contains(el)) {
            out.covered.push(id + '<' + ((hit.id || hit.className || hit.tagName) + '').slice(0, 20));
          }
        });
        return out;
      });
      const tag = name.padEnd(16);
      if (!r.up) { console.log('   ' + tag + ' (nothing on screen)'); fail++; continue; }
      ok(label + ' ' + name + ': every control on the screen', !r.off.length, r.off);
      ok(label + ' ' + name + ': nothing on top of anything', !r.covered.length, r.covered);
      console.log('   ' + tag + ' card ' + (r.card ? r.card.h + 'px ' + r.card.scale : '-')
                  + '  [' + r.txt + ']'
                  + (r.off.length ? '  OFF: ' + r.off.join(',') : '')
                  + (r.covered.length ? '  COVERED: ' + r.covered.join(',') : ''));
    }
    if (errs.length) { console.log('   page errors: ' + errs.slice(0, 3).join(' | ')); fail += errs.length; }
    await p.close();
  }
  console.log('\n' + pass + ' passed, ' + fail + ' failed\n');
  await b.close();
  process.exit(fail ? 1 : 0);
})();
