/* IS ANYTHING FORCING A ZOOM ON THE WAY IN?

   Not "does the markup look right" — what the page actually does to the
   viewport in the first few seconds, measured on the device sizes she
   would open it on. A forced zoom shows up in four places and this looks
   at all four:

     the viewport tag        a scale the page asked for
     visualViewport.scale    the scale the browser ended up at
     the layout box          a document wider than the screen makes the
                             browser shrink the whole page to fit
     the transform chain     a scale() on any ancestor of the content

   It also checks the two things that get mistaken for a zoom: a page
   that overflows sideways, and a --app-h that disagrees with the real
   window (everything laid out against a box taller than the screen looks
   too big and cropped). */
const { chromium } = require('playwright-core');
let pass = 0, fail = 0;
const ok = (n, c, x) => { if (c) { pass++; console.log('  ok   ' + n); }
                          else { fail++; console.log('  FAIL ' + n + (x ? '  ' + JSON.stringify(x) : '')); } };

const SIZES = [
  ['iPhone upright',   { width: 390, height: 844 }, 3],
  ['iPhone sideways',  { width: 844, height: 390 }, 3],
  ['small Android',    { width: 360, height: 640 }, 3],
  ['iPad upright',     { width: 820, height: 1180 }, 2],
  ['desktop',          { width: 1366, height: 768 }, 1],
];

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--use-gl=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--no-sandbox'] });
  const errs = [];
  for (const [label, vp, dpr] of SIZES) {
    const p = await b.newPage({ viewport: vp, deviceScaleFactor: dpr, isMobile: vp.width < 900,
                                hasTouch: vp.width < 900 });
    p.on('pageerror', e => errs.push(label + ': ' + e.message));
    await p.route('**', r => (r.request().url().startsWith('http://localhost') ? r.continue() : r.abort()));
    await p.goto('http://localhost:8899/index.html', { waitUntil: 'domcontentloaded' });

    const read = () => p.evaluate(() => {
      const de = document.documentElement, vv = window.visualViewport;
      const meta = document.querySelector('meta[name="viewport"]');
      /* every transform on the chain from the content up to <html> */
      const chain = [];
      let el = document.querySelector('.screen.active') || document.body;
      while (el) {
        const t = getComputedStyle(el).transform;
        if (t && t !== 'none') chain.push((el.id || el.className || el.tagName) + ': ' + t);
        el = el.parentElement;
      }
      return {
        meta: meta ? meta.getAttribute('content') : null,
        scale: vv ? +(vv.scale || 1).toFixed(3) : 1,
        vvW: vv ? Math.round(vv.width) : null,
        vvH: vv ? Math.round(vv.height) : null,
        innerW: window.innerWidth, innerH: window.innerHeight,
        clientW: de.clientWidth, clientH: de.clientHeight,
        scrollW: de.scrollWidth, scrollH: de.scrollHeight,
        appH: de.style.getPropertyValue('--app-h'),
        appTop: de.style.getPropertyValue('--app-top'),
        chain: chain,
        screen: (document.querySelector('.screen.active') || {}).id || null,
      };
    });

    await p.waitForTimeout(300);
    const first = await read();
    await p.waitForTimeout(4000);          /* through the book intro's opening */
    const later = await read();

    console.log('\n== ' + label + '  ' + vp.width + 'x' + vp.height + ' @' + dpr);
    console.log('   tag        ' + first.meta);
    console.log('   at 0.3s    scale ' + first.scale + '  visual ' + first.vvW + 'x' + first.vvH +
                '  layout ' + first.clientW + 'x' + first.clientH + '  --app-h ' + (first.appH || '(unset)'));
    console.log('   at 4.3s    scale ' + later.scale + '  visual ' + later.vvW + 'x' + later.vvH +
                '  layout ' + later.clientW + 'x' + later.clientH + '  --app-h ' + (later.appH || '(unset)') +
                '  on ' + later.screen);

    ok(label + ': the page never asks for a scale of its own',
       /initial-scale=1\b/.test(first.meta || '') && !/maximum-scale|user-scalable|minimum-scale/.test(first.meta || ''),
       first.meta);
    ok(label + ': the browser is at 1:1 when it opens', first.scale === 1, first);
    ok(label + ': and still 1:1 once it has settled', later.scale === 1, later);
    ok(label + ': the layout box is the width of the screen',
       Math.abs(later.clientW - vp.width) <= 1, { clientW: later.clientW, want: vp.width });
    ok(label + ': nothing sticks out sideways',
       later.scrollW - later.clientW <= 1, { scrollW: later.scrollW, clientW: later.clientW });
    ok(label + ': nothing on the way up to <html> is scaled',
       later.chain.every(t => !/matrix\((?!1,\s*0,\s*0,\s*1)|scale\((?!1[,)])/.test(t)), later.chain);
    const appH = parseFloat(later.appH || '0');
    ok(label + ': the height it lays out against is the real one',
       appH > 0 && appH <= later.innerH + 1, { appH: appH, innerH: later.innerH });
    await p.close();
  }

  /* AND ONCE SHE IS INSIDE ONE.
     The entry is the question, but a chapter that scales its own stage
     would read the same way — and three of them draw into a fixed box
     that has to be fitted to the screen somehow. */
  const p2 = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3,
                               isMobile: true, hasTouch: true });
  p2.on('pageerror', e => errs.push('chapters: ' + e.message));
  await p2.route('**', r => (r.request().url().startsWith('http://localhost') ? r.continue() : r.abort()));
  await p2.goto('http://localhost:8899/index.html', { waitUntil: 'domcontentloaded' });
  await p2.waitForFunction(() => !!(window.Apocalypse && window.SuperOuissy && window.SuperOuissyRace),
                           { timeout: 40000 });
  const CHAPTERS = [['the hub', () => { showScreen('hub'); startHub(); }],
                    ['the adventure', () => { showScreen('quest'); startQuest(); }],
                    ['Super Ouissy', () => { showScreen('ouissy'); SuperOuissy.start(); }],
                    ['the apocalypse', () => { showScreen('apoc'); Apocalypse.start(); }],
                    ['the race', () => { showScreen('race'); SuperOuissyRace.start(); }],
                    ['the keepsake', () => { showScreen('keepsake'); startKeepsake(); }]];
  console.log('');
  for (const [name, go] of CHAPTERS) {
    await p2.evaluate(go);
    await p2.waitForTimeout(2200);
    const r = await p2.evaluate(() => {
      const de = document.documentElement, vv = window.visualViewport;
      const chain = [];
      let el = document.querySelector('.screen.active');
      while (el) {
        const t = getComputedStyle(el).transform;
        if (t && t !== 'none') chain.push((el.id || el.className || el.tagName) + ': ' + t);
        el = el.parentElement;
      }
      return { scale: vv ? +(vv.scale || 1).toFixed(3) : 1, chain: chain,
               over: de.scrollWidth - de.clientWidth };
    });
    ok(name + ': opens at 1:1, nothing scaled, nothing sticking out',
       r.scale === 1 && r.over <= 1 &&
       r.chain.every(t => !/matrix\((?!1,\s*0,\s*0,\s*1)|scale\((?!1[,)])/.test(t)), r);
  }
  await p2.close();

  ok('no page errors from any of it', errs.length === 0, errs.slice(0, 3));
  console.log('');
  console.log(pass + ' passed, ' + fail + ' failed');
  await b.close();
  process.exit(fail ? 1 : 0);
})();
