/* THE SLICE OF NOTHING AT THE BOTTOM.

   The site pins every screen to --app-h, a height it measures rather than
   asks for, because two of the browsers it has to run in hand the page a
   box taller than the part you can see. Measuring can go wrong in the
   other direction too, and when it does the page comes out SHORTER than
   the screen and a strip of bare background is left along the bottom.

   Each case below fakes one browser doing one thing, and then measures
   the gap between the bottom of the page and the bottom of the visible
   viewport. The gap is the bug, in pixels. */
const { chromium } = require('playwright-core');
let pass = 0, fail = 0;
const ok = (n, c, x) => { if (c) { pass++; console.log('  ok   ' + n); }
                          else { fail++; console.log('  FAIL ' + n + (x ? '  ' + JSON.stringify(x) : '')); } };

const H = 1180, W = 820;                 /* an iPad, upright */

/* Each case is an init script: it runs before the page does, and lies to
   it the way the browser under test does. */
const CASES = {

  'an honest browser': () => {},

  /* Chrome and Brave on iOS lay the web view over the whole screen and
     draw the toolbar on top of it. One API then reports the short number
     while the rest report the tall one — and the site takes the smallest
     of everything on offer, so it takes the short one and comes up 44
     pixels shy of the glass. */
  'innerHeight is 44 short of the visible area': () => {
    Object.defineProperty(window, 'innerHeight', { configurable: true, get: () => 1180 - 44 });
  },

  'the visual viewport is 44 short of the visible area': () => {
    const vv = window.visualViewport;
    if (!vv) return;
    Object.defineProperty(vv, 'height', { configurable: true, get: () => 1180 - 44 });
  },

  /* FURNITURE, MODELLED HONESTLY.

     A pad element is not a toolbar: shrink the page under a pad and the
     pad stays put, so the scroll range GROWS — that is oversized content,
     which is a different thing and is covered below. What makes an inset
     an inset is that shortening the document by it absorbs it, and the
     range collapses to nothing. So this is the scroll range itself, as a
     function of how tall the page currently is. */
  'a toolbar that is there and stays there': () => {
    window.__furniture = 44;
    /* on the prototype, because documentElement does not exist yet when
       this runs, and only for the root element the probe actually drives */
    const d = Object.getOwnPropertyDescriptor(Element.prototype, 'scrollTop');
    Object.defineProperty(Element.prototype, 'scrollTop', {
      configurable: true,
      get() {
        if (this !== document.documentElement) return d.get.call(this);
        const h = parseFloat(getComputedStyle(this).height) || 1180;
        return Math.max(0, Math.round(window.__furniture - (1180 - h)));
      },
      set(v) { if (this !== document.documentElement) d.set.call(this, v); },
    });
  },

  /* The same toolbar, which then collapses. Everything above this fix
     could only ever make the page shorter, so the 44 came off and was
     never given back — a slice of bare background along the bottom for
     the rest of the session. */
  'a toolbar that is measured and then hides': () => {
    window.__furniture = 44;
    const d = Object.getOwnPropertyDescriptor(Element.prototype, 'scrollTop');
    Object.defineProperty(Element.prototype, 'scrollTop', {
      configurable: true,
      get() {
        if (this !== document.documentElement) return d.get.call(this);
        const h = parseFloat(getComputedStyle(this).height) || 1180;
        return Math.max(0, Math.round(window.__furniture - (1180 - h)));
      },
      set(v) { if (this !== document.documentElement) d.set.call(this, v); },
    });
    addEventListener('DOMContentLoaded', () => {
      setTimeout(() => { window.__furniture = 0; dispatchEvent(new Event('resize')); }, 2000);
    });
  },

  /* And the thing the probe must never mistake for furniture: something
     on the page that is simply too tall. Shortening the page does not
     shorten it, so the right answer is to leave the height alone. */
  'an element on the page that is too tall': () => {
    addEventListener('DOMContentLoaded', () => {
      const pad = document.createElement('div');
      pad.style.cssText = 'position:absolute;top:0;left:0;width:1px;height:1400px;';
      document.documentElement.appendChild(pad);
    });
  },

  /* A pinch that has been let go of can leave the visual viewport offset
     for a frame or two. Honouring it pushes the page down by that much
     and hangs the same distance off the bottom. */
  'a visual viewport that reports an offset it does not have': () => {
    const vv = window.visualViewport;
    if (!vv) return;
    Object.defineProperty(vv, 'offsetTop', { configurable: true, get: () => 38 });
  },
};

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--use-gl=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--no-sandbox'] });
  const errs = [];
  for (const [name, lie] of Object.entries(CASES)) {
    const p = await b.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 2,
                                isMobile: true, hasTouch: true });
    p.on('pageerror', e => errs.push(name + ': ' + e.message));
    await p.addInitScript(lie);
    await p.route('**', r => (r.request().url().startsWith('http://localhost') ? r.continue() : r.abort()));
    await p.goto('http://localhost:8899/index.html', { waitUntil: 'domcontentloaded' });
    await p.waitForTimeout(5200);        /* past the burst of re-measurements */

    const r = await p.evaluate((visible) => {
      const de = document.documentElement;
      const s = document.querySelector('.screen.active');
      const box = s ? s.getBoundingClientRect() : null;
      return {
        appH: parseFloat(de.style.getPropertyValue('--app-h')) || 0,
        appTop: parseFloat(de.style.getPropertyValue('--app-top')) || 0,
        screenTop: box ? Math.round(box.top) : null,
        screenBottom: box ? Math.round(box.bottom) : null,
        /* what the person can actually see, which the lies above never touch */
        visible: visible,
        /* proof the lie is live inside the page */
        saysInner: window.innerHeight,
        saysClient: de.clientHeight,
        saysVV: window.visualViewport ? Math.round(window.visualViewport.height) : null,
        saysOffset: window.visualViewport ? window.visualViewport.offsetTop : null,
        known: (window.__viewport ? window.__viewport().known : null),
        strip: (window.__viewport ? window.__viewport().strip : null),
      };
    }, H);
    const voidPx = r.screenBottom == null ? -1 : (r.visible - r.screenBottom);
    console.log('\n== ' + name);
    console.log('   it thinks: inner ' + r.saysInner + '  client ' + r.saysClient +
                '  vv ' + r.saysVV + '  offsetTop ' + r.saysOffset +
                '  knownStrip ' + r.known + '  strip now ' + r.strip);
    console.log('   --app-h ' + r.appH + '  --app-top ' + r.appTop +
                '  screen ' + r.screenTop + '..' + r.screenBottom +
                ' of ' + r.visible + '   VOID ' + voidPx + 'px');
    if (/stays there/.test(name)) {
      /* here the visible area really IS 44 shorter, so the right answer is
         a page 44 shorter — and nothing left hidden behind the toolbar */
      ok(name + ': the page stays out from under it', Math.abs(r.appH - (r.visible - 44)) <= 1,
         { appH: r.appH, want: r.visible - 44 });
      ok(name + ': and there is nothing left hidden', r.strip <= 2, { strip: r.strip });
    } else if (/too tall/.test(name)) {
      ok(name + ': does not shrink the page', Math.abs(r.appH - r.visible) <= 1,
         { appH: r.appH, want: r.visible });
    } else {
      ok(name + ': the page reaches the bottom of the screen', voidPx >= 0 && voidPx <= 1,
         { void: voidPx, appH: r.appH, appTop: r.appTop });
    }
    await p.close();
  }
  ok('no page errors from any of it', errs.length === 0, errs.slice(0, 3));
  console.log('');
  console.log(pass + ' passed, ' + fail + ' failed');
  await b.close();
  process.exit(fail ? 1 : 0);
})();
