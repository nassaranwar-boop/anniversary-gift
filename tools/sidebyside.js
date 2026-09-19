/* IS THE PHONE ON ITS SIDE THE SAME LAYOUT, SMALLER?

   The ask, in his words: the landscape phone should be an exact smaller
   iPad/PC version -- every game, every screen, every detail. That is a
   measurable claim, so this measures it rather than looking at it.

   For each screen it opens the same page at a desktop size, an iPad
   size and two landscape-phone sizes, and writes down, for every
   control and every landmark:

     is it there at all          a control that exists on the desktop
                                 and not on the phone is a missing
                                 feature, not a layout choice
     is it ON the screen         a rect outside the viewport is
                                 unreachable on a page that cannot
                                 scroll (HANDOFF 7c)
     is anything on top of it    elementFromPoint at its own centre --
                                 a button under a bar is a button that
                                 does nothing
     where is it, proportionally the position and size as a fraction of
                                 the stage it belongs to. A scaled copy
                                 keeps those; a different layout does
                                 not.

   Usage:  node tools/sidebyside.js [screen]
*/
const { chromium } = require('playwright-core');

const SIZES = [
  [1280, 800, 'desktop'],
  [1024, 768, 'ipad'],
  [844, 390, 'phone-landscape'],
  [740, 360, 'phone-landscape-small'],
];

/* every screen, how to open it, and what counts as its stage */
/* THE GAMES ARE STARTED, NOT SHOWN.

   Every one of them puts its controls up when it starts and not before
   -- the apocalypse's pad is aria-hidden until fitTouch has run -- so a
   harness that only switches the screen on is measuring a chapter that
   is not running, and reports every one of its buttons as dead. Each of
   these goes in through the real door. */
const SCREENS = {
  gate:      { open: null, stage: '.gate-card, .ancient-card, .screen-inner' },
  hub:       { go: () => showScreen('hub'), stage: '.hub-grid, .hub-inner, .screen-inner' },
  keepsake:  { go: () => startKeepsake(), stage: '.ks-card, .ancient-card, .screen-inner' },
  scrapbook: { go: () => showScreen('scrapbook'), stage: '.sb-stage, .sb-book, .screen-inner' },
  quest:     { go: () => startQuest(), stage: '.hv-stage', play: 3000 },
  ouissy:    { go: () => startSuperOuissy(), stage: '.so-stage', play: 3000 },
  apoc:      { go: () => startApocalypse(), stage: '.ap-stage', play: 3500 },
  race:      { go: () => startSuperOuissyRace(), stage: '.rc-stage', play: 3500 },
  nightshift:{ go: () => startNightShift(), stage: '.ns-stage', play: 4500 },
};

const PASSCODE = '2207';

async function inventory(p, stageSel) {
  return p.evaluate((sel) => {
    const vw = innerWidth, vh = innerHeight;
    const scr = document.querySelector('.screen.active');
    const stage = (sel.split(',').map((s) => s.trim())
      .map((s) => scr && scr.querySelector(s)).filter(Boolean))[0]
      || (scr && scr.querySelector('.screen-inner')) || scr;
    const sr = stage ? stage.getBoundingClientRect() : { left: 0, top: 0, width: vw, height: vh };
    const seen = [];
    const all = scr ? scr.querySelectorAll('button, a[href], [role="button"], input, canvas, [data-go], [data-k]') : [];
    all.forEach((el) => {
      const cs = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      const shown = cs.display !== 'none' && cs.visibility !== 'hidden' &&
                    Number(cs.opacity) > 0.05 && r.width > 1 && r.height > 1 &&
                    !el.closest('[hidden]') && !el.hasAttribute('hidden');
      if (!shown) return;
      /* what is actually at its middle */
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      const hit = (cx >= 0 && cy >= 0 && cx <= vw && cy <= vh)
        ? document.elementFromPoint(cx, cy) : null;
      const covered = !!(hit && hit !== el && !el.contains(hit) && !hit.contains(el));
      const id = el.id || (el.dataset && (el.dataset.go || el.dataset.k)) ||
                 (el.className && String(el.className).split(' ').slice(0, 2).join('.')) || el.tagName;
      seen.push({
        id: String(id).slice(0, 40), tag: el.tagName.toLowerCase(),
        text: (el.textContent || '').trim().slice(0, 24),
        on: r.left >= -1 && r.top >= -1 && r.right <= vw + 1 && r.bottom <= vh + 1,
        covered: covered, coveredBy: covered ? (hit.id || hit.className || hit.tagName).toString().slice(0, 28) : '',
        /* where it sits inside the stage, as a fraction */
        fx: +((r.left - sr.left) / (sr.width || 1)).toFixed(3),
        fy: +((r.top - sr.top) / (sr.height || 1)).toFixed(3),
        fw: +(r.width / (sr.width || 1)).toFixed(3),
        fh: +(r.height / (sr.height || 1)).toFixed(3),
        w: Math.round(r.width), h: Math.round(r.height),
      });
    });
    return {
      vw, vh, screen: scr ? scr.id : null,
      stage: { w: Math.round(sr.width), h: Math.round(sr.height),
               ar: +((sr.width || 1) / (sr.height || 1)).toFixed(3),
               fill: +(((sr.width * sr.height) / (vw * vh)) || 0).toFixed(3),
               off: sr.left < -1 || sr.top < -1 || sr.right > vw + 1 || sr.bottom > vh + 1 },
      controls: seen,
    };
  }, stageSel);
}

(async () => {
  const want = process.argv[2];
  const names = want ? [want] : Object.keys(SCREENS);
  const b = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox', '--no-proxy-server', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const out = {};
  for (const [w, h, label] of SIZES) {
    const p = await b.newPage({ viewport: { width: w, height: h },
                                isMobile: h < 500, hasTouch: h < 500,
                                deviceScaleFactor: 1 });
    p.on('pageerror', (e) => console.log('  PAGEERROR ' + label + ': ' + e.message.slice(0, 90)));
    await p.route('**/*', (r) => {
      const u = r.request().url();
      return u.startsWith('http://127.0.0.1') ? r.continue() : r.abort();
    });
    await p.goto('http://127.0.0.1:8899/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await p.waitForTimeout(900);
    /* PAST THE OPENING, THE WAY SHE GOES.

       The site opens on the 3D book and waits for a tap; the gate is
       behind it and the passcode is four taps on a keypad. Both are
       driven here rather than jumped over, so anything that only
       breaks on the way in still breaks. */
    await p.evaluate(() => {
      const c = document.getElementById('book-canvas') || document.body;
      c.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
      c.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
      c.click();
    });
    await p.waitForTimeout(1200);
    /* if the book is still up, go round it */
    await p.evaluate(() => {
      if (document.querySelector('#screen-gate.active')) return;
      if (window.showScreen) showScreen('gate');
    });
    await p.waitForTimeout(400);
    for (const d of PASSCODE.split('')) {
      const hit = await p.evaluate((digit) => {
        const keys = Array.from(document.querySelectorAll('#screen-gate button, #screen-gate [data-d], .key, .gate-key'));
        const k = keys.filter((el) => (el.textContent || '').trim() === digit)[0];
        if (k) { k.click(); return true; }
        return false;
      }, d);
      if (!hit) break;
      await p.waitForTimeout(160);
    }
    await p.waitForTimeout(1600);
    for (const name of names) {
      const s = SCREENS[name];
      /* IN THROUGH THE REAL DOOR.

         The chapters are loaded on demand, so calling startQuest()
         before its file has arrived throws and leaves the page where it
         was -- which is how a first run of this reported every game as
         "one control, the canvas" while actually sitting on the
         scrapbook. A player presses the card on the hub; so does this,
         and then it waits for the screen and for the chapter to say it
         is ready. */
      const ready = {
        quest: '#screen-quest.active .hv-stage',
        ouissy: '#screen-ouissy.active .so-stage canvas, #screen-ouissy.active canvas',
        apoc: '#screen-apoc.active #ap-canvas',
        race: '#screen-race.active #rc-canvas, #screen-race.active canvas',
        nightshift: '#screen-nightshift.active #ns-canvas',
      };
      if (name === 'hub') {
        await p.evaluate(() => showScreen('hub'));
      } else if (name === 'keepsake') {
        await p.evaluate(() => { try { startKeepsake(); } catch (e) { showScreen('keepsake'); } });
      } else if (name === 'scrapbook') {
        await p.evaluate(() => showScreen('scrapbook'));
      } else if (ready[name]) {
        await p.evaluate(() => showScreen('hub'));
        await p.waitForTimeout(350);
        await p.evaluate((n) => {
          const c = document.getElementById('hub-card-' + n);
          if (c) c.click();
        }, name);
        try { await p.waitForSelector(ready[name], { timeout: 25000 }); }
        catch (e) { console.log('  ' + label + ': ' + name + ' never came up'); }
      }
      await p.waitForTimeout(s.play || 800);
      out[name] = out[name] || {};
      out[name][label] = await inventory(p, s.stage);
      if (process.env.SHOTS) {
        const fs = require('fs');
        fs.mkdirSync(process.env.SHOTS, { recursive: true });
        await p.screenshot({ path: process.env.SHOTS + '/' + name + '-' + label + '.png' });
      }
    }
    await p.close();
  }
  console.log(JSON.stringify(out));
  await b.close();
})();
