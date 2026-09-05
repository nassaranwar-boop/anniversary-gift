// The two faults he reported, turned into assertions.
//
//   "it opens slightly zoomed"      -> the active screen, and anything
//                                      inside it, must exactly match the
//                                      visible box; a canvas composed for a
//                                      taller frame is the zoom.
//   "you can scroll down into void" -> the document must never be
//                                      scrollable, and nothing may hang
//                                      below the fold.
//
// Both are checked on several device shapes, and again after the tab has
// been away -- which is when he saw it change its mind.
const { chromium } = require('playwright-core');

let pass = 0, fail = 0;
const ok = (name, cond, detail) => {
  (cond ? pass++ : fail++);
  console.log((cond ? 'PASS  ' : 'FAIL  ') + name + (detail ? '   ' + detail : ''));
};

const DEVICES = [
  { n:'iPhone portrait',  w:390, h:844, dpr:3, m:true },
  { n:'iPhone landscape', w:844, h:390, dpr:3, m:true },
  { n:'iPhone SE',        w:375, h:667, dpr:2, m:true },
  { n:'iPad landscape',   w:1180,h:820, dpr:2, m:true },
  { n:'desktop',          w:1440,h:900, dpr:1, m:false },
];
const SCREENS = ['videointro','gate','scrapbook','hub','maze','quest','keepsake'];

(async () => {
  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox','--no-proxy-server','--disable-gpu','--use-gl=swiftshader','--enable-unsafe-swiftshader'] });

  for (const d of DEVICES) {
    const page = await browser.newPage({ viewport:{width:d.w,height:d.h}, deviceScaleFactor:d.dpr,
                                         isMobile:d.m, hasTouch:d.m });
    page.on('pageerror', e => ok(d.n + ': no page error', false, e.message));
    await page.route('**/*', r => r.request().url().startsWith('http://127.0.0.1') ? r.continue() : r.abort());
    // The URL bar is showing: the visible box is shorter than window.innerHeight.
    // This is the disagreement the whole bug lived in, so it is the default here.
    await page.addInitScript(() => {
      addEventListener('DOMContentLoaded', () => {
        const s = document.createElement('style');
        s.textContent = ':root{--app-h:calc(100dvh - 88px) !important;}';
        document.head.appendChild(s);
      });
    });
    await page.goto('http://127.0.0.1:8899/index.html', { waitUntil:'domcontentloaded', timeout:60000 });
    await page.waitForTimeout(2500);

    const probe = () => page.evaluate(() => {
      const de = document.documentElement;
      const scr = document.querySelector('.screen.active');
      const box = scr.getBoundingClientRect();
      const visible = parseFloat(getComputedStyle(de).getPropertyValue('--app-h')) ||
                      scr.getBoundingClientRect().height;
      // Only what is really showing past the edge. An element inside a
      // scroller or a clipped box is contained by it however big its own
      // rectangle is, and a drawer parked off to the side is meant to be
      // out there -- neither is a hole in the page.
      const clipped = (el) => {
        for (let p = el.parentElement; p && p !== scr; p = p.parentElement) {
          const o = getComputedStyle(p);
          if (o.overflow !== 'visible' || o.overflowY !== 'visible' || o.overflowX !== 'visible') return true;
        }
        return false;
      };
      const name = (el) => (el.id || (typeof el.className === 'string' ? el.className :
                   (el.getAttribute('class') || el.tagName))).slice(0, 32);
      const over = [];
      scr.querySelectorAll('*').forEach(el => {
        const b = el.getBoundingClientRect();
        if (b.width < 1 || b.height < 1) return;
        if (getComputedStyle(el).visibility === 'hidden') return;
        if (b.right < box.left + 1 || b.left > box.right - 1) return;   // parked off to the side
        /* 1.5px, not 1: a rotated card on a fractional-density screen lands
           on sub-pixel boundaries and one run in three reported a element a
           single pixel past the edge. A real overflow here is tens of
           pixels -- this tolerance cannot hide one. */
        if (b.bottom <= box.bottom + 1.5 && b.right <= box.right + 1.5) return;
        if (clipped(el)) return;
        over.push(name(el) + ' b=' + b.bottom.toFixed(0) + ' r=' + b.right.toFixed(0));
      });
      const cv = document.getElementById('book-canvas');
      return {
        id: scr.id,
        screenH: +box.height.toFixed(1), screenW: +box.width.toFixed(1),
        scrollable: de.scrollHeight > de.clientHeight + 1,
        scrollSlack: de.scrollHeight - de.clientHeight,
        overflowers: over.slice(0,4),
        canvasFits: !cv || (Math.abs(cv.getBoundingClientRect().height - box.height) < 1.5 &&
                            Math.abs(cv.getBoundingClientRect().width  - box.width)  < 1.5),
        canvasAspectMatch: !cv || !cv.width ? true :
          Math.abs((cv.width / cv.height) -
                   (cv.getBoundingClientRect().width / cv.getBoundingClientRect().height)) < 0.01,
      };
    });

    for (const name of SCREENS) {
      await page.evaluate(async (n) => {
        if (n !== 'videointro' && window.skipBookIntro) window.skipBookIntro();
        showScreen(n);
        if (n === 'scrapbook' && window.Scrapbook) Scrapbook.start();
        if (n === 'hub') startHub();
        if (n === 'maze') startMaze && startMaze();
        if (n === 'keepsake') startKeepsake && startKeepsake();
        await new Promise(r => setTimeout(r, 500));
      }, name).catch(()=>{});
      await page.waitForTimeout(700);
      const r = await probe();
      const tag = d.n + ' / ' + name;
      ok(tag + ': the page cannot be scrolled', !r.scrollable, r.scrollable ? r.scrollSlack + 'px of void' : '');
      ok(tag + ': nothing hangs past the screen', r.overflowers.length === 0, r.overflowers.join(' | '));
      if (name === 'videointro') {
        ok(tag + ': the 3D canvas matches its screen', r.canvasFits);
        ok(tag + ': the shot is composed for the frame you see', r.canvasAspectMatch);
      }
    }

    // and now the thing he described: leave, come back.
    await page.evaluate(() => { showScreen('videointro'); });
    // screenIn scales from .97 to 1 over .65s; measuring inside that reads
    // the animation, not the layout.
    await page.waitForTimeout(1000);
    const before = await probe();
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable:true, get:()=>true });
      Object.defineProperty(document, 'visibilityState', { configurable:true, get:()=>'hidden' });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await page.waitForTimeout(500);
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable:true, get:()=>false });
      Object.defineProperty(document, 'visibilityState', { configurable:true, get:()=>'visible' });
      document.dispatchEvent(new Event('visibilitychange'));
      dispatchEvent(new Event('pageshow'));
    });
    await page.waitForTimeout(900);
    const after = await probe();
    ok(d.n + ' / after leaving the tab and coming back: same height',
       Math.abs(after.screenH - before.screenH) <= 1.5, before.screenH + ' -> ' + after.screenH);
    ok(d.n + ' / after leaving the tab and coming back: still no void', !after.scrollable);
    ok(d.n + ' / after leaving the tab and coming back: canvas still fits', after.canvasFits);
    await page.close();
  }
  await browser.close();
  console.log('\n' + pass + ' pass, ' + fail + ' fail');
  process.exit(fail ? 1 : 0);
})();
