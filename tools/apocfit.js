/* DOES EVERY CARD IN THE CHAPTER FIT ON THE SCREEN IT IS DRAWN ON?

   Nothing here had ever asked. The overlays are sized in cqw -- a share
   of the stage's width -- and most of them cap the BOX at a pixel width
   while leaving the TYPE inside it scaling with the stage. On a phone
   the two agree. On an iPad held sideways the box stops at its ceiling
   and the words in it keep growing, so the hint under the wire board
   wraps six times and pushes "STEP BACK" off the bottom of the picture
   -- on the one puzzle the chapter asks her to solve twice.

   So: open each card at four shapes and measure it. Nothing may hang
   off the stage, and every button on it must be reachable. */
const { boot, reporter, driver } = require('./_aplib');

const SIZES = [
  ['iPad sideways',   { width: 1180, height: 820 }],
  ['iPad upright',    { width: 820, height: 1180 }],
  ['iPhone sideways', { width: 844, height: 390 }],
  ['iPhone upright',  { width: 390, height: 844 }],
  ['laptop',          { width: 1280, height: 800 }],
];
/* what to open, which level it lives on, and what it is called in the
   document. The keypad needs a door with a keypad on it and the intake
   needs the gates, so each card is opened on a level that has it. */
const CARDS = [
  [0, 'the how-to',      'howto',  '.ap-card'],
  [0, 'the level card',  'card',   '.ap-card'],
  [0, 'the television',  'tv',     '.ap-tv'],
  [0, 'the wire board',  'panel',  '.ap-panel'],
  [0, 'the fridge',      'fridge', '.ap-fridge'],
  [0, 'the radio',       'radio',  '.ap-radio'],
  [0, 'the note',        'note',   '.ap-note'],
  [1, 'the keypad',      'keypad', '.ap-keypad'],
  [1, 'the map',         'map',    '.ap-map'],
  [4, 'the intake sheet','check',  '.ap-check'],
  [4, 'the inoculation', 'serum',  '.ap-serum'],
];

(async () => {
  const R = reporter();
  const ok = R.ok;
  const allErrs = [];
  for (const [label, vp] of SIZES) {
    const { browser, page, errs } = await boot({ viewport: vp });
    const D = driver(page);
    console.log('\n== ' + label + '  ' + vp.width + 'x' + vp.height);
    let on = -1;
    for (const [level, name, what, sel] of CARDS) {
      if (level !== on) { await D.enter(level); on = level; }
      const opened = await page.evaluate(w => window.__apOpen(w), what);
      if (!opened) { console.log('   (' + name + ' does not open on this level)'); continue; }
      await page.waitForTimeout(420);
      const m = await page.evaluate(s => {
        const stage = document.getElementById('ap-stage');
        const card = document.querySelector(s);
        if (!stage || !card) return null;
        const S = stage.getBoundingClientRect(), C = card.getBoundingClientRect();
        /* a button below the fold of a card that SCROLLS is reachable:
           the intake sheet has four rows and a stamp, and on a phone
           held upright nothing would make that fit. One that hangs off a
           card which does not scroll is simply in the dark. */
        const scrollable = (el) => {
          for (let n = el; n && n !== document.body; n = n.parentElement) {
            const o = getComputedStyle(n);
            if (/auto|scroll/.test(o.overflowY) || /auto|scroll/.test(o.overflow)) {
              if (n.scrollHeight > n.clientHeight + 2) return true;
            }
          }
          return false;
        };
        const btns = [];
        card.querySelectorAll('button').forEach(b => {
          const r = b.getBoundingClientRect();
          if (r.width < 2 || r.height < 2) return;
          if (scrollable(b)) return;
          btns.push({ t: (b.textContent || '').trim().slice(0, 14),
                      out: Math.round(Math.max(0, S.top - r.top, r.bottom - S.bottom,
                                               S.left - r.left, r.right - S.right)) });
        });
        return { over: { top: Math.round(S.top - C.top), bottom: Math.round(C.bottom - S.bottom),
                         left: Math.round(S.left - C.left), right: Math.round(C.right - S.right) },
                 w: Math.round(C.width), h: Math.round(C.height),
                 stage: Math.round(S.width) + 'x' + Math.round(S.height), btns: btns };
      }, sel);
      if (!m) { console.log('   (' + name + ': nothing rendered)'); continue; }
      const spill = Math.max(m.over.top, m.over.bottom, m.over.left, m.over.right);
      ok(label + ': ' + name + ' fits inside the picture', spill <= 1,
         m.w + 'x' + m.h + ' in ' + m.stage + ', over by ' + JSON.stringify(m.over));
      const lost = m.btns.filter(b => b.out > 0);
      ok(label + ': and every button on it can be pressed', lost.length === 0,
         lost.map(b => '"' + b.t + '" off by ' + b.out).join(', '));
      await page.evaluate(() => window.__apClear());
      await page.waitForTimeout(120);
    }
    allErrs.push.apply(allErrs, errs);
    await browser.close();
  }
  console.log('');
  ok('and none of it threw', allErrs.length === 0, allErrs.slice(0, 2).join(' | '));
  console.log(R.fail ? R.pass + ' passed, ' + R.fail + ' FAILED'
                     : 'all ' + R.pass + ' checks passed');
  process.exit(R.fail ? 1 : 0);
})();
