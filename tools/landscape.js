/* A PHONE ON ITS SIDE.

   Two faults lived here, and the second was the dangerous one.

   The stages were sized by `@media (max-width: 900px), (orientation:
   portrait)`. The comma is an OR, so a phone turned sideways is still
   under 900px wide and got the whole upright-phone layout — including a
   stage cut to 52% of a height that is already short. The apocalypse came
   out 361x203 in an 844x390 window: 22% of the screen, the rest empty.
   Turning the phone gave the game more room and it used less.

   And three buttons sat below the fold. Cards 510 to 553px tall, centred
   in a 390px screen, hang off both ends — and since the page is
   deliberately unscrollable (see HANDOFF 7c), whatever hung off the bottom
   was not awkward, it was unreachable. #btn-start opens the maze, so that
   chapter was simply shut on a landscape phone. Nothing in the existing
   suites would have caught it: regress.js checks for horizontal scroll and
   page errors, not whether a control is on the screen.

   So this asserts the two things directly: every control can be reached,
   and the game stages use the room they are given.

   Usage:  node landscape.js
*/
const { chromium } = require('playwright-core');

let pass = 0, fail = 0;
const ok = (n, c, x) => { if (c) { pass++; console.log('PASS  ' + n + (x ? '   ' + x : '')); }
                          else { fail++; console.log('FAIL  ' + n + (x ? '   ' + x : '')); } };

const SIZES = [
  [844, 390, 'iphone-landscape'],
  [932, 430, 'iphone-max-landscape'],
  [390, 844, 'iphone-portrait'],
];

/* screens whose controls must all be reachable, and how to open them */
const SCREENS = ['hello', 'details', 'level2intro', 'hub', 'keepsake', 'gate', 'end'];

(async () => {
  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'],
  });

  for (const [w, h, label] of SIZES) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h },
                                           isMobile: true, hasTouch: true });
    await ctx.route('**/*', r => r.request().url().startsWith('http://127.0.0.1')
      ? r.continue() : r.abort());
    const page = await ctx.newPage();
    const errs = [];
    page.on('pageerror', e => errs.push(e.message));
    await page.goto('http://127.0.0.1:8899/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(2200);

    /* ---- every control has to be on the screen, or inside something that
       scrolls far enough to bring it there ---- */
    const unreachable = [];
    for (const scr of SCREENS) {
      await page.evaluate((n) => {
        showScreen(n);
        const m = { hub: 'startHub', keepsake: 'startKeepsake' };
        if (m[n] && window[m[n]]) window[m[n]]();
      }, scr);
      await page.waitForTimeout(500);
      const bad = await page.evaluate((sid) => {
        const el = document.getElementById('screen-' + sid);
        const out = [];
        [...el.querySelectorAll('button,[role="button"],.hub-card')].forEach(c => {
          /* skip anything genuinely hidden, including by an ancestor —
             the apocalypse key pad is opacity:0/height:0 on touch, and
             counting it produced a false alarm the first time round */
          for (let n = c; n && n !== document.body; n = n.parentElement) {
            const s = getComputedStyle(n);
            if (s.display === 'none' || s.visibility === 'hidden' ||
                s.opacity === '0' || parseFloat(s.height) < 3) return;
          }
          const box = c.getBoundingClientRect();
          if (box.width < 4 || box.height < 4) return;
          const scroller = c.closest('.details-card,.cover-content,[style*="overflow"]');
          if (scroller && scroller.scrollHeight > scroller.clientHeight + 2) {
            scroller.scrollTop = scroller.scrollHeight;      // scroll it into reach
          }
          const b = c.getBoundingClientRect();
          const y = b.top + b.height / 2, x = b.left + b.width / 2;
          const on = y >= 0 && y <= innerHeight && x >= 0 && x <= innerWidth;
          const hit = on ? document.elementFromPoint(x, y) : null;
          if (!(on && hit && (hit === c || c.contains(hit) || hit.contains(c)))) {
            out.push((c.id || c.className || c.tagName).toString().split(' ')[0] +
                     ' @y' + Math.round(b.top) + '..' + Math.round(b.bottom));
          }
          if (scroller) scroller.scrollTop = 0;
        });
        return out;
      }, scr);
      bad.forEach(b => unreachable.push(scr + ': ' + b));
    }
    ok(label + ': every control can be reached', unreachable.length === 0,
       unreachable.length ? unreachable.slice(0, 3).join(' | ') : '');

    /* ---- the game stages should use the room they are given ---- */
    for (const [scr, starter] of [['apoc', 'startApocalypse'], ['race', 'startSuperOuissyRace']]) {
      await page.evaluate(([n, s]) => { showScreen(n); if (window[s]) window[s](); }, [scr, starter]);
      await page.waitForTimeout(900);
      const r = await page.evaluate((n) => {
        /* scoped to the screen under test: a bare '.ap-stage,.rc-stage'
           picks up the other game's hidden stage and measures 0x0 */
        const st = document.querySelector('#screen-' + n + ' .ap-stage, #screen-' + n + ' .rc-stage');
        if (!st) return null;
        const b = st.getBoundingClientRect();
        return { share: Math.round(b.width * b.height / (innerWidth * innerHeight) * 100),
                 w: Math.round(b.width), h: Math.round(b.height) };
      }, scr);
      if (!r) { ok(label + '/' + scr + ': a stage exists', false); continue; }
      /* upright the stage deliberately takes about half, leaving thumb room;
         sideways there is nothing to leave room for, so it should be most of it */
      const floor = h > w ? 20 : 55;
      ok(label + '/' + scr + ': the stage uses the screen', r.share >= floor,
         r.w + 'x' + r.h + ' = ' + r.share + '% (floor ' + floor + '%)');
    }

    ok(label + ': no page errors', errs.length === 0, errs[0] || '');
    await ctx.close();
  }

  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
