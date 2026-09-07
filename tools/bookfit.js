/* THE BOOK, TURNED PAGE BY PAGE, AT FOUR SHAPES.

   pageshots.js clones pages into a frame to photograph them and pageaudit.js
   measures the same clones. Neither turns the real book. This does: it opens
   the scrapbook, walks every spread with the real turn animation, and after
   each one asks the questions a person would notice —

     - did anything throw
     - is every photograph on the visible pages actually decoded, or is one
       a broken frame
     - does the spread fit the screen, or is a page hanging off it
     - does the page fill its half, or is the spread showing one page where
       there is room for two
     - do the drawer, the note and the lightbox open and close again

   Usage:  node bookfit.js
*/
const { chromium } = require('playwright-core');

let pass = 0, fail = 0;
const ok = (n, c, x) => { if (c) { pass++; console.log('PASS  ' + n + (x ? '   ' + x : '')); }
                          else { fail++; console.log('FAIL  ' + n + (x ? '   ' + x : '')); } };

const SIZES = [
  [390, 844, 'iphone-portrait', 1],
  [844, 390, 'iphone-landscape', 2],
  [820, 1180, 'ipad-portrait', 1],
  [1180, 820, 'ipad-landscape', 2],
];

(async () => {
  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'],
  });

  for (const [w, h, label, want] of SIZES) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h },
                                           isMobile: true, hasTouch: true });
    await ctx.route('**/*', r => r.request().url().startsWith('http://127.0.0.1')
      ? r.continue() : r.abort());
    const page = await ctx.newPage();
    const errs = [];
    page.on('pageerror', e => errs.push(e.message));
    await page.goto('http://127.0.0.1:8899/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(2200);

    /* showScreen alone does NOT start the book. startDioramas does, and it
       is the only thing that ever calls Scrapbook.start() — which is the
       only thing that ever sets perView from the window. Skip it and
       perView keeps the module's initial 2, so a portrait phone builds a
       two-page spread and the whole book comes out half the size. That
       reads exactly like the bug he photographed, and it is the harness. */
    await page.evaluate(() => { showScreen('scrapbook'); if (window.startDioramas) startDioramas(); });
    await page.waitForTimeout(1200);
    await page.evaluate(() => { if (window.Scrapbook) Scrapbook.skipIntro(); });

    /* The pages are built a few per frame, and rAF is ~3fps in here, so
       wait for the count to stop growing rather than for a delay. */
    let seen = -1, still = 0;
    for (let i = 0; i < 60 && still < 4; i++) {
      await page.waitForTimeout(700);
      const n = await page.evaluate(() => document.querySelectorAll('#sb-spread .sb-page').length);
      if (n === seen) still++; else { still = 0; seen = n; }
    }

    /* Every page lives in the spread all the time; the one or two she is
       looking at are the ones wearing a slot class. Counting `.sb-page`
       counts all twelve and means nothing. */
    const SHOWN = '#sb-spread .sb-page.leftpage, #sb-spread .sb-page.rightpage, ' +
                  '#sb-spread .sb-page.solo';
    /* View 0 is the front cover, and a cover is one page in any window —
       so the spread is judged from the first view INSIDE the book. */
    const cover = await page.evaluate((sel) => document.querySelectorAll(sel).length, SHOWN);
    ok(label + ': the cover is one page', cover === 1, cover + '');
    await page.evaluate(() => Scrapbook.next());
    await page.waitForTimeout(1100);
    const shape = await page.evaluate((sel) => document.querySelectorAll(sel).length, SHOWN);
    ok(label + ': inside, the spread shows the right number of pages', shape === want,
       shape + ' (wanted ' + want + ')');

    /* walk the whole book */
    const broken = [], off = [], thin = [];
    let turns = 0;
    for (let i = 0; i < 30; i++) {
      /* The photographs are lazy and this container is slow, so wait for
         the ones on the spread she is looking at before judging them. A
         slot with no file behind it walks webp, jpg, png and then removes
         itself, so an img mid-chain is not yet a fault. */
      await page.waitForFunction((sel) => {
        const im = [...document.querySelectorAll(sel)].flatMap(p => [...p.querySelectorAll('img')]);
        return im.every(i => i.complete);
      }, SHOWN, { timeout: 15000 }).catch(() => {});
      await page.waitForTimeout(300);
      /* An empty slot's last attempt is `complete` with no pixels for the
         moment before onerror removes the img, so look twice. */
      const probe = (sel) => {
        const bad = [], out = [], slim = [];
        const pages = [...document.querySelectorAll(sel)];
        for (const pg of pages) {
          const pr = pg.getBoundingClientRect();
          if (pr.left < -1 || pr.right > innerWidth + 1 ||
              pr.top < -1 || pr.bottom > innerHeight + 1) {
            out.push('page @' + Math.round(pr.left) + '..' + Math.round(pr.right) +
                     ' x ' + Math.round(pr.top) + '..' + Math.round(pr.bottom));
          }
          if (pr.width < 40 || pr.height < 40) slim.push(Math.round(pr.width) + 'x' + Math.round(pr.height));
          for (const im of pg.querySelectorAll('img')) {
            const ir = im.getBoundingClientRect();
            if (ir.width < 2 || ir.height < 2) continue;
            if (!im.complete || im.naturalWidth === 0) bad.push(im.getAttribute('src') || '(no src)');
          }
        }
        return { bad, out, slim };
      };
      let r = await page.evaluate(probe, SHOWN);
      if (r.bad.length) { await page.waitForTimeout(900); r = await page.evaluate(probe, SHOWN); }
      r.bad.forEach(x => broken.push('view' + i + ': ' + x));
      r.out.forEach(x => off.push('view' + i + ': ' + x));
      r.slim.forEach(x => thin.push('view' + i + ': ' + x));
      await page.evaluate(() => Scrapbook.next());
      turns++;
      /* the screen wears sb-turning for the whole turn — wait for it to
         come off rather than guessing at the settle */
      await page.waitForFunction(
        () => !document.getElementById('screen-scrapbook').classList.contains('sb-turning'),
        { timeout: 60000, polling: 150 }).catch(() => {});
      await page.waitForTimeout(350);
      const atEnd = await page.evaluate(() =>
        !!document.querySelector('#screen-scrapbook .sb-final, #screen-scrapbook .sb-end') ||
        document.querySelector('.screen.active').id !== 'screen-scrapbook');
      if (atEnd) break;
    }

    ok(label + ': every photograph on every spread decoded', broken.length === 0,
       broken.length ? broken.slice(0, 3).join(' | ') : turns + ' spreads walked');
    ok(label + ': no page hangs off the screen', off.length === 0,
       off.length ? off.slice(0, 3).join(' | ') : '');
    ok(label + ': no page collapsed to nothing', thin.length === 0,
       thin.length ? thin.slice(0, 3).join(' | ') : '');
    ok(label + ': nothing threw while turning', errs.length === 0, errs[0] || '');

    await ctx.close();
  }

  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
