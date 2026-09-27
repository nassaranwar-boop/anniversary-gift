/* THE HUB, AT THE SIZES SHE HOLDS THE PHONE.

   It used to print six lines and judge none of them. It judges now, and
   it judges two things that were both wrong:

   1. A CENTRED COLUMN THAT OVERFLOWS PUSHES ITS TOP OUT OF REACH.
      `.hub-wrap` is `justify-content:center` and scrolls when it must --
      but a centred flex column overflows off BOTH ends, and the part
      above the top can never be scrolled back to, because the scroll
      origin IS the top. On an iPhone SE with every chapter done,
      "Choose your adventure" sat forty pixels above the scroll origin
      and there was no gesture that would bring it back.

   2. THE WAY BACK TO THE BOOK WAS INVISIBLE.
      The hub has a "Back to the book" button, wired and styled, and it
      carried `hub-keepsake` -- the class that hides the keepsake until
      the story is finished. So it was never shown, not even once the
      story WAS finished, because only the keepsake is ever given `.on`.
      A door in the markup that nobody could see.
*/
const { chromium } = require('playwright-core');

const SIZES = [
  { n:'iPhone 15 portrait', w:390, h:844 }, { n:'iPhone 15, URL bar showing', w:390, h:745 },
  { n:'iPhone SE', w:375, h:667 }, { n:'iPhone SE, URL bar showing', w:375, h:600 },
  { n:'small android', w:360, h:640 },
  { n:'iPhone landscape', w:844, h:390 }, { n:'iPad portrait', w:820, h:1180 },
  { n:'desktop', w:1440, h:900 },
];
/* every chapter finished: the fullest the hub ever gets, and the state
   she will actually be in by the time she looks for the way back */
const DONE = { quest:true, ouissy:true, apoc:true, race:true, nightshift:true };

let pass = 0, fail = 0;
const ok = (n, c, x) => { if (c) { pass++; console.log('  ok   ' + n + (x ? '  ' + x : '')); }
                          else { fail++; console.log('  FAIL ' + n + (x ? '  ' + x : '')); } };

(async () => {
  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox','--no-proxy-server','--use-gl=swiftshader','--enable-unsafe-swiftshader'] });
  const errs = [];
  for (const d of SIZES) {
    const page = await browser.newPage({ viewport:{width:d.w,height:d.h}, deviceScaleFactor:2,
                                         isMobile:d.w<500, hasTouch:d.w<500 });
    page.on('pageerror', e => errs.push(d.n + ': ' + e.message));
    await page.route('**/*', r => r.request().url().startsWith('http://127.0.0.1') ? r.continue() : r.abort());
    await page.goto('http://127.0.0.1:8899/index.html', { waitUntil:'domcontentloaded', timeout:60000 });
    await page.waitForTimeout(1200);
    const r = await page.evaluate(async (done) => {
      window.skipBookIntro && window.skipBookIntro();
      try { localStorage.setItem('fal_chapters_done', JSON.stringify(done)); } catch (e) {}
      showScreen('hub'); startHub();
      await new Promise(r=>setTimeout(r,600));
      const scr = document.getElementById('screen-hub').getBoundingClientRect();
      const wrapEl = document.querySelector('.hub-wrap');

      /* reachable, not merely visible: scroll to it the way she would and
         check a tap at its middle actually lands on it */
      const reach = async (el) => {
        wrapEl.scrollTop = 0; await new Promise(r=>setTimeout(r,40));
        el.scrollIntoView({ block:'nearest' });
        await new Promise(r=>setTimeout(r,60));
        const b = el.getBoundingClientRect();
        const hit = document.elementFromPoint(b.left + b.width/2, b.top + b.height/2);
        return { top:Math.round(b.top), bottom:Math.round(b.bottom), h:Math.round(b.height),
                 fully: b.top >= scr.top - 0.5 && b.bottom <= scr.bottom + 0.5,
                 hit: !!(hit && (hit === el || el.contains(hit))) };
      };

      const cards = [];
      for (const c of document.querySelectorAll('.hub-card'))
        cards.push(Object.assign({ id:c.id.replace('hub-card-','') }, await reach(c)));

      const book = document.getElementById('hub-book');
      const keep = document.getElementById('hub-keepsake');
      const bookR = await reach(book), keepR = await reach(keep);

      /* AND THE TOP MUST BE REACHABLE. At the very start of the scroll,
         nothing may already be above the box -- there is no gesture that
         goes further back than scrollTop 0. */
      wrapEl.scrollTop = 0; await new Promise(r=>setTimeout(r,60));
      const wr = wrapEl.getBoundingClientRect();
      let above = 0;
      for (const kid of wrapEl.children)
        above = Math.max(above, Math.round(wr.top - kid.getBoundingClientRect().top));

      return { cards, book: bookR, keepsake: keepR, cutAboveTop: above,
               bookShown: book.offsetParent !== null,
               scrolls: wrapEl.scrollHeight > wrapEl.clientHeight + 1 };
    }, DONE);

    console.log('\n== ' + d.n + '  ' + d.w + 'x' + d.h + (r.scrolls ? '  [the list scrolls]' : ''));
    const lost = r.cards.filter(c => !c.fully || !c.hit);
    ok(d.n + ': every chapter card can be reached and pressed', lost.length === 0,
       lost.map(c => c.id + ' ' + c.top + '-' + c.bottom + (c.hit ? '' : '/UNTAPPABLE')).join(' '));
    ok(d.n + ': nothing is cut off above the top of the list', r.cutAboveTop <= 0,
       r.cutAboveTop > 0 ? r.cutAboveTop + 'px out of reach' : '');
    ok(d.n + ': the way back to the book is on the hub', r.bookShown);
    ok(d.n + ': and it can be reached and pressed', r.book.fully && r.book.hit,
       r.book.top + '-' + r.book.bottom);
    ok(d.n + ': it is a thumb big', r.book.h >= 44, r.book.h + 'px tall');
    ok(d.n + ': and so is the keepsake beside it', r.keepsake.fully && r.keepsake.hit && r.keepsake.h >= 44,
       r.keepsake.top + '-' + r.keepsake.bottom + ', ' + r.keepsake.h + 'px');
    await page.close();
  }

  /* ---- the button is only a door if it opens ---- */
  console.log('');
  const page = await browser.newPage({ viewport:{width:1180,height:820} });
  page.on('pageerror', e => errs.push('door: ' + e.message));
  await page.route('**/*', r => r.request().url().startsWith('http://127.0.0.1') ? r.continue() : r.abort());
  await page.goto('http://127.0.0.1:8899/index.html', { waitUntil:'domcontentloaded', timeout:60000 });
  await page.waitForTimeout(1000);
  /* nothing finished at all: the book is not a reward, it is always there */
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} showScreen('hub'); startHub(); });
  await page.waitForTimeout(500);
  ok('the way back is there before anything has been finished',
     await page.evaluate(() => document.getElementById('hub-book').offsetParent !== null));
  ok('and the keepsake is still kept back until it is earned',
     await page.evaluate(() => document.getElementById('hub-keepsake').offsetParent === null));
  await page.evaluate(() => document.getElementById('hub-book').click());
  await page.waitForTimeout(2400);
  ok('pressing it opens the book',
     await page.evaluate(() => document.querySelector('.screen.active').id) === 'screen-scrapbook');
  /* and it opens on the candle with the butterflies round it, which is
     the thing she went back for */
  const lit = await page.evaluate(() => {
    const c = document.getElementById('sb-intro-canvas');
    if (!c) return null;
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    let n = 0; const seen = {};
    for (let i = 0; i < d.length; i += 4) { if (d[i+3] > 0) n++; seen[(d[i]<<16)|(d[i+1]<<8)|d[i+2]] = 1; }
    return { pct: Math.round(n/(d.length/4)*100), colours: Object.keys(seen).length };
  });
  ok('and it opens on the candle, with the butterflies round it',
     !!lit && lit.pct > 90 && lit.colours > 500,
     lit ? lit.pct + '% painted, ' + lit.colours + ' colours' : 'no intro canvas');
  await page.close();

  ok('nothing threw', errs.length === 0, errs.slice(0,2).join(' | '));
  console.log('');
  console.log(fail ? pass + ' passed, ' + fail + ' FAILED' : 'all ' + pass + ' checks passed');
  await browser.close();
  process.exit(fail ? 1 : 0);
})();
