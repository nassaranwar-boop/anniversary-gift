/* EVERY CARD IN THE NIGHT SHIFT, ON A PHONE ON ITS SIDE.

   The side-by-side harness opens a chapter and looks at the first thing
   it shows. Most of the chapter is not that: the night card, how it
   works, the drawer, the record, the shift itself, the pause menu, the
   game over, the six o'clock card, the terms, the film's letter and the
   two endings all arrive later, and each of them was laid out against a
   laptop.

   This walks all of them at three landscape-phone sizes and asserts the
   two things that matter on a screen that cannot scroll: every control
   is ON the screen, and nothing is sitting on top of it. Controls are
   read from the whole chapter, not just the overlay, so the shift
   itself -- where the only controls are the HUD -- is checked the same
   way a card is.
                                                node tools/cardfit.js */
const { chromium } = require('playwright-core');

const SIZES = [[844, 390, '844x390'], [740, 360, '740x360'], [932, 430, '932x430']];

/* every card the chapter can put up, and how to ask for it.  nothing in
   here may leave the chapter: route('quit') hands the page back to the
   hub, and everything measured after it reads zero because it is being
   measured inside a hidden screen. */
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
  ['the monitor',(N) => { N.press('monitor'); }],
  ['paused',     (N) => { N.press('monitor'); N.pauseNow(); }],
  ['game over',  (N) => { N.route('resume'); N.begin(3); N.midEnd(); N.catchNow('jax'); }],
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

/* what is on the screen right now: the card if there is one, and every
   control anywhere in the chapter that a thumb could reach for */
function look() {
  const vw = innerWidth, vh = innerHeight;
  const root = document.getElementById('screen-nightshift') || document.body;
  const o = document.getElementById('ns-overlay');
  const out = { off: [], covered: [], card: null, ctrls: 0, live: false,
                txt: (o ? o.textContent || '' : '').trim().replace(/\s+/g, ' ').slice(0, 44) };
  /* the chapter's own screen has to still be the one on show -- anything
     measured inside a hidden section reads zero and passes everything */
  const rr = root.getBoundingClientRect();
  out.live = rr.width > 10 && rr.height > 10;
  const card = o && o.querySelector('.ns-card');
  if (card) {
    const cr = card.getBoundingClientRect();
    out.card = { h: Math.round(cr.height), top: Math.round(cr.top), bottom: Math.round(cr.bottom),
                 right: Math.round(cr.right), left: Math.round(cr.left),
                 scale: card.style.transform || 'none' };
  }
  root.querySelectorAll('button, [data-go], input, select').forEach((el) => {
    const cs = getComputedStyle(el);
    const r2 = el.getBoundingClientRect();
    if (cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0') return;
    if (r2.width < 2 || r2.height < 2) return;
    let p = el.parentElement, hid = false;
    while (p) { if (p.hidden || getComputedStyle(p).display === 'none') { hid = true; break; } p = p.parentElement; }
    if (hid) return;
    out.ctrls++;
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
}

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
      const err = await p.evaluate((src) => {
        const N = OuissysNightShift.__night;
        try { (new Function('N', 'return (' + src + ')(N)'))(N); return null; }
        catch (e) { return e.message.slice(0, 80); }
      }, fn.toString()).catch((e) => 'evaluate: ' + e.message.slice(0, 60));
      /* settle: whatever is coming has to arrive and stop moving.  the
         game over card is a second and a half of jumpscare behind the
         catch, so a flat wait either misses it or doubles the suite */
      let r = null, same = 0, seen = '';
      for (let i = 0; i < 34; i++) {
        await p.waitForTimeout(220);
        r = await p.evaluate(look);
        const sig = JSON.stringify([r.card, r.ctrls, r.txt]);
        /* only a screen with something to press is allowed to settle
           early: the game over card is three real seconds of jumpscare
           behind the catch, and the terms card puts its SKIP up on a
           2.2s fade -- a card with no button on it yet is a card that
           has not finished arriving */
        if (sig === seen && r.ctrls > 0) { if (++same >= 2) break; }
        else { same = 0; seen = sig; }
      }
      const tag = name.padEnd(16);
      if (err) { console.log('   ' + tag + ' DRIVER ERROR ' + err); fail++; continue; }
      ok(label + ' ' + name + ': the chapter is still the screen on show', r.live);
      ok(label + ' ' + name + ': something to press', r.ctrls > 0);
      ok(label + ' ' + name + ': every control on the screen', !r.off.length, r.off);
      ok(label + ' ' + name + ': nothing on top of anything', !r.covered.length, r.covered);
      if (r.card) ok(label + ' ' + name + ': the card has a size', r.card.h > 20, r.card);
      console.log('   ' + tag + ' ' + (r.card ? 'card ' + r.card.h + 'px ' + r.card.scale : 'no card')
                  + ' ' + r.ctrls + ' controls'
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
