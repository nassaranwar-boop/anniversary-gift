/* EVERY BUTTON ON EVERY SCREEN, AT FOUR SHAPES.

   landscape.js asks whether a control is reachable. This asks the rest of
   what a finger needs, on every screen the site has rather than the seven
   that fitted the landscape story:

     - is it actually on the screen, or inside something that scrolls far
       enough to bring it there
     - is the thing under its middle the button itself (or a child), or has
       something else been laid over the top of it
     - is it big enough to hit — 44px is Apple's number and this is a site
       he uses on a phone
     - does the page report an error while any of that is happening

   Usage:  node buttons.js
*/
const { chromium } = require('playwright-core');

let pass = 0, fail = 0;
const ok = (n, c, x) => { if (c) { pass++; console.log('PASS  ' + n + (x ? '   ' + x : '')); }
                          else { fail++; console.log('FAIL  ' + n + (x ? '   ' + x : '')); } };

const SIZES = [
  [390, 844, 'iphone-portrait'],
  [844, 390, 'iphone-landscape'],
  [820, 1180, 'ipad-portrait'],
  [1180, 820, 'ipad-landscape'],
];

/* every screen in index.html that a person can be standing on, minus the
   ones that are a canvas with its own controls (those have their own
   suites) and minus the video intro, which is a film */
const SCREENS = ['gate', 'scrapbook', 'hub', 'keepsake', 'quest', 'hello',
                 'details', 'level2intro', 'divider', 'end'];

/* Collect the controls on one screen and say what is wrong with each. Runs
   in the page. */
const AUDIT = (scr) => {
  const root = document.getElementById('screen-' + scr);
  if (!root) return { missing: true };

  const shown = (el) => {
    for (let n = el; n && n !== document.body; n = n.parentElement) {
      const s = getComputedStyle(n);
      if (s.display === 'none' || s.visibility === 'hidden') return false;
      if (parseFloat(s.opacity) < 0.05) return false;
    }
    return true;
  };

  const sel = 'button, [role="button"], a[href], input, select, textarea, ' +
              '.btn, .hub-card, .key, .gate-key, [data-goto], [onclick]';
  const out = { off: [], covered: [], small: [], n: 0 };

  for (const el of root.querySelectorAll(sel)) {
    if (el.disabled || el.getAttribute('aria-hidden') === 'true') continue;
    if (!shown(el)) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) continue;
    out.n++;
    const name = (el.id ? '#' + el.id : el.className.toString().split(' ')[0] || el.tagName)
                 + ' "' + (el.textContent || '').trim().slice(0, 14) + '"';

    /* --- on the screen? counting a scrollable ancestor as reachable --- */
    let onScreen = r.top >= -1 && r.bottom <= innerHeight + 1;
    if (!onScreen) {
      for (let n = el.parentElement; n && !onScreen; n = n.parentElement) {
        if (n.scrollHeight > n.clientHeight + 2) {
          const s = getComputedStyle(n);
          if (/auto|scroll/.test(s.overflowY)) onScreen = true;
        }
      }
    }
    if (!onScreen) out.off.push(name + ' @y' + Math.round(r.top) + '..' + Math.round(r.bottom));

    /* --- is the button the thing under its own middle? --- */
    const cx = Math.min(innerWidth - 1, Math.max(0, r.left + r.width / 2));
    const cy = Math.min(innerHeight - 1, Math.max(0, r.top + r.height / 2));
    if (r.top >= 0 && r.bottom <= innerHeight) {
      const hit = document.elementFromPoint(cx, cy);
      if (hit && hit !== el && !el.contains(hit) && !hit.contains(el)) {
        const who = (hit.id ? '#' + hit.id : hit.className.toString().split(' ')[0] || hit.tagName);
        out.covered.push(name + ' <- ' + who);
      }
    }

    /* --- big enough for a thumb? ---
       The HIT area, not the painted box: a small chip may carry an
       invisible ::after target around itself, and what a finger cares
       about is what elementFromPoint returns 22px out from the middle. */
    const owns = (x, y) => {
      if (x < 0 || y < 0 || x >= innerWidth || y >= innerHeight) return false;
      const q = document.elementFromPoint(x, y);
      return !!q && (q === el || el.contains(q));
    };
    const reach = (dx, dy) => owns(cx + dx, cy + dy);
    const wide = Math.max(r.width, 44 * (reach(-21, 0) && reach(21, 0) ? 1 : 0));
    const tall = Math.max(r.height, 44 * (reach(0, -21) && reach(0, 21) ? 1 : 0));
    if (Math.min(wide, tall) < 40) {
      out.small.push(name + ' hit ' + Math.round(wide) + 'x' + Math.round(tall));
    }
  }
  return out;
};

(async () => {
  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'],
  });

  for (const [w, h, label] of SIZES) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h },
                                           isMobile: h > w || w < 1000, hasTouch: true });
    await ctx.route('**/*', r => r.request().url().startsWith('http://127.0.0.1')
      ? r.continue() : r.abort());
    const page = await ctx.newPage();
    const errs = [];
    page.on('pageerror', e => errs.push(e.message));
    /* Only OUR failures count. Every script here aborts non-localhost
       requests so the blocked Google Fonts call logs an ERR_FAILED that
       has nothing to do with the site. */
    page.on('requestfailed', r => { if (r.url().startsWith('http://127.0.0.1'))
      errs.push('request failed: ' + r.url()); });
    page.on('response', r => { if (r.url().startsWith('http://127.0.0.1') && r.status() >= 400)
      errs.push('HTTP ' + r.status() + ' ' + r.url()); });
    await page.goto('http://127.0.0.1:8899/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(2400);

    const off = [], covered = [], small = [];
    let total = 0;
    for (const scr of SCREENS) {
      await page.evaluate((s) => showScreen(s), scr);
      /* Long enough for the entry animations to land. The gate's card comes
         in over .95s from translateY(20px) scale(.97) — measured early it is
         smaller and lower than it ends up, which is a good way to measure a
         control as fitting when the settled one does not. */
      await page.waitForTimeout(1400);
      const r = await page.evaluate(AUDIT, scr);
      if (r.missing) { off.push(scr + ': no such screen'); continue; }
      total += r.n;
      r.off.forEach(x => off.push(scr + ': ' + x));
      r.covered.forEach(x => covered.push(scr + ': ' + x));
      r.small.forEach(x => small.push(scr + ': ' + x));
    }

    ok(label + ': every control is on the screen', off.length === 0,
       off.length ? off.slice(0, 4).join(' | ') : total + ' controls');
    ok(label + ': nothing is laid over a control', covered.length === 0,
       covered.length ? covered.slice(0, 4).join(' | ') : '');
    ok(label + ': every control is big enough to hit', small.length === 0,
       small.length ? small.slice(0, 6).join(' | ') : '44px floor');
    ok(label + ': no errors while walking them', errs.length === 0, errs[0] || '');

    await ctx.close();
  }

  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
