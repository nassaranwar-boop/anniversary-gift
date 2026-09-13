/* The first and last turns: the card must stay put on the leaf. */
const { chromium } = require('playwright-core'); const fs = require('fs');
const R=[]; const ok=(n,c,x)=>R.push((c?'PASS  ':'FAIL  ')+n+(x?'   '+x:''));
(async () => {
  const browser = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args:['--no-sandbox','--no-proxy-server','--disable-gpu'] });
  const page = await browser.newPage({ viewport:{width:1180,height:900} });
  const errs=[]; page.on('pageerror', e=>errs.push(e.message));
  await page.route('**/*', r => { const u=r.request().url();
    if (u.startsWith('http://127.0.0.1')||u.includes('fonts.g')) return r.continue(); return r.abort(); });
  await page.goto('http://127.0.0.1:8899/index.html', { waitUntil:'networkidle', timeout:60000 });
  await page.waitForTimeout(800);
  await page.evaluate(() => { try{localStorage.clear();}catch(e){} showScreen('scrapbook');
    if (window.Scrapbook) Scrapbook.start(); });
  await page.waitForTimeout(1800);
  /* END THE INTRO, DO NOT PAINT OVER IT.

     This used to add `sb-intro-out` and `sb-open` and hide #sb-intro by
     hand. That makes the intro invisible; it does not make it over. The
     book was still in its opening state internally and refused the turn
     below, so the first sample found an empty leaf and this suite has
     been reporting "0 clones" ever since -- while its own later checks,
     by then several seconds in, found thirty-six of them. The chapter
     has a hook for exactly this. */
  await page.evaluate(() => { if (window.Scrapbook && Scrapbook.skipIntro) Scrapbook.skipIntro(); });
  await page.waitForTimeout(1200);

  /* Waiting a fixed number of milliseconds for a turn is waiting on a
     duration that is allowed to change -- and it has, more than once.
     These wait for the thing they actually care about instead. */
  const leafFilled = () => page.waitForFunction(
    () => document.querySelectorAll('.sb-leaf .sb-page.in-leaf').length > 0,
    null, { timeout: 4000 });
  const turnDone = () => page.waitForFunction(
    () => !document.getElementById('screen-scrapbook').classList.contains('sb-turning'),
    null, { timeout: 6000 });

  // start the very first turn and look at the leaf mid-flight
  /* HOLD THE TURN AT A KNOWN PLACE TO MEASURE IT.

     Letting a real turn run and sampling whenever the leaf happened to
     fill meant measuring the card's centring while the book was still
     sliding under it -- the cover turn moves the whole book across its
     first half so the fold stays put. That put the answer three to five
     pixels off depending on which frame the sample landed on, which is
     a stopwatch reading, not a geometry check. Pinned at a quarter of
     the way through, the sheet is in a defined position and the number
     means what the assertion says it means. */
  await page.evaluate(() => Scrapbook.__holdTurn(1, 0.25));
  await page.waitForTimeout(120);
  const mid = await page.evaluate(() => {
    const clones = Array.from(document.querySelectorAll('.sb-leaf .sb-page.in-leaf'));
    return clones.map(c => {
      const cs = getComputedStyle(c);
      const label = c.querySelector('.sb-cover-label, .sb-page-back-inner, .sb-end-card');
      const cr = c.getBoundingClientRect();
      const lr = label ? label.getBoundingClientRect() : null;
      return { cls: c.className.replace('sb-page ', '').slice(0, 40),
               display: cs.display,
               // how far off-centre is the card on its own page?
               offsetX: lr ? Math.round((lr.left + lr.width/2) - (cr.left + cr.width/2)) : null,
               offsetTop: lr ? Math.round(lr.top - cr.top) : null,
               pageH: Math.round(cr.height) };
    });
  });
  ok('the turning sheet has clones on it', mid.length > 0, mid.length + ' clones');
  const cover = mid.filter(m => /cover/.test(m.cls));
  ok('the cover keeps its flex centring while it turns',
     cover.length === 0 || cover.every(m => m.display === 'flex'),
     cover.map(m => m.cls + '=' + m.display).join(', '));
  /* Six, not four. Four was calibrated when the turning sheet was a
     circular arc -- one curvature all the way along. It is paper now:
     the bend piles up at the binding and runs out towards the fore-edge,
     so the strips near the hinge are more foreshortened than the ones at
     the tip, and a card drawn across all of them projects a little
     differently on each. Pinned at a quarter turn the readings are
     -5,-5,-5,-4,-4,-3,-3,-2,-1,0,0,0 -- a smooth gradient from hinge to
     edge, which is the curve doing what it is supposed to do, not the
     card slipping. What this check is actually for is a card that has
     come off its page, and five pixels on a five-hundred-pixel page is
     not that. Anything genuinely loose still trips it. */
  ok('and its card does not slide off centre',
     cover.length === 0 || cover.every(m => m.offsetX === null || Math.abs(m.offsetX) <= 6),
     cover.map(m => 'dx=' + m.offsetX).join(', '));
  ok('nor jump to the top of the page',
     cover.length === 0 || cover.every(m => m.offsetTop === null || m.offsetTop > m.pageH * 0.12),
     cover.map(m => 'top=' + m.offsetTop + '/' + m.pageH).join(', '));

  await page.evaluate(() => Scrapbook.__releaseTurn());
  await page.waitForTimeout(300);

  /* ---- and the same at the very end of the book ----

     This used to fire forty turns 140ms apart. A turn takes longer than
     that and one already running refuses the next, so most of those
     calls did nothing and the book never actually reached the back
     cover -- which made the check below pass on whatever page it
     happened to be standing on. Each turn is waited out now, and the
     walk stops when the book stops moving, so "the very end" is the
     very end. */
  /* WHICH pages are showing, not what they are wearing. Comparing the
     class lists does not work: every spread in the book is "leftpage on"
     and "rightpage on", so two completely different pages compare equal
     and the walk stops after one step. The index of each showing page
     among all of them is the thing that actually changes. */
  const showing = () => page.evaluate(() => {
    const all = [...document.querySelectorAll('.sb-page')];
    return all.map((p, i) => p.classList.contains('on') ? i : -1)
              .filter(i => i >= 0).join(',');
  });
  let turned = 0;
  for (let i = 0; i < 40; i++) {
    const at = await showing();
    await page.evaluate(() => Scrapbook.next());
    await turnDone();
    if ((await showing()) === at) break;   /* the book would not go further */
    turned++;
  }
  ok('the walk reaches the end of the book', turned > 2 && turned < 40, turned + ' turns');

  await page.evaluate(() => Scrapbook.prev());
  await leafFilled();
  const back = await page.evaluate(() => {
    const clones = Array.from(document.querySelectorAll('.sb-leaf .sb-page.in-leaf'));
    return clones.map(c => ({ cls: c.className.slice(0,44), display: getComputedStyle(c).display }));
  });
  ok('the back page keeps its centring too',
     back.every(m => !/page-back/.test(m.cls) || m.display === 'flex'),
     back.map(m=>m.display).join(','));

  console.log(R.join('\n'));
  console.log(errs.length ? 'ERRORS: '+errs.join(' | ') : 'no page errors');
  await browser.close();
  process.exit(R.some(r=>r.startsWith('FAIL')) ? 1 : 0);
})();
