/* The panel measured at real device sizes. Reports anything that
   overflows its stage, any control smaller than a thumb, and takes a
   picture of each. node nightlayout.js <outdir> */
const { chromium } = require('playwright-core');
const fs = require('fs');
const OUT = process.argv[2] || '/tmp/wklay';
const SIZES = [
  /* 375 is the narrowest phone still in use and it is the one that
     breaks things: the gallery's eight rooms wrap to a fourth row here
     and nowhere else, which pushed BACK off the bottom of the panel. */
  ['iphone-se', 375, 667],
  ['iphone-portrait', 390, 844],
  ['iphone-landscape', 844, 390],
  ['ipad-portrait', 820, 1180],
  ['ipad-landscape', 1180, 820],
  ['desktop', 1440, 900],
];
let fails = 0;
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox','--no-proxy-server','--use-gl=swiftshader','--enable-unsafe-swiftshader'] });
  for (const [name, w, h] of SIZES) {
    const p = await b.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1,
      hasTouch: w < 1200, isMobile: w < 1200 });
    p.on('pageerror', e => { console.log('  PAGEERROR', e.message); fails++; });
    await p.route('**/*', r => {
      const u = r.request().url();
      if (u.indexOf('book-scene.js') >= 0) return r.abort();
      return u.startsWith('http://127.0.0.1') ? r.continue() : r.abort();
    });
    await p.goto('http://127.0.0.1:8899/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await p.waitForTimeout(500);
    await p.evaluate(() => {
      const st = document.createElement('style');
      st.textContent = '.screen.anim-in{animation:none !important}';
      document.head.appendChild(st);
      try { localStorage.clear(); } catch (e) {}
      /* the opening film plays on a clean slate, and route('start') hands
         straight to it — so this measured a hidden pad with every control
         collapsed at 0,0 and called all six of them "outside the frame"
         at every size, including the desktop. Skip the film. */
      try { localStorage.setItem('ns_seenintro', '1'); localStorage.setItem('ns_notutor', '1'); } catch (e) {}
      showScreen('nightshift'); OuissysNightShift.start(); OuissysNightShift.__night.silence(true);
    });
    /* start() shows a loading card and builds the shop a frame later, so
       the shift cannot be routed in the same turn as the boot */
    await p.waitForFunction(() => Object.keys(OuissysNightShift.__night.cast()).length >= 4,
                            { timeout: 20000, polling: 200 });
    await p.evaluate(() => {
      OuissysNightShift.__night.route('night:1'); OuissysNightShift.__night.route('go');
      OuissysNightShift.__night.press('monitor');
    });
    await p.waitForTimeout(1400);
    const m = await p.evaluate(() => {
      const st = document.getElementById('ns-stage').getBoundingClientRect();
      /* held upright the controls sit under the stage, so the box they
         must stay inside is the frame, not the stage */
      const fr = document.querySelector('.ns-frame').getBoundingClientRect();
      const out = { stage: [Math.round(st.width), Math.round(st.height)], small: [], outside: [], overlap: [], hScroll: document.documentElement.scrollWidth > window.innerWidth + 1 };
      /* the plan on the tube is a display first: on a phone it is the
         arrows on the pad that change camera, so its cells are only
         held to a thumb target on a screen big enough for a pointer */
      const sel = window.innerWidth >= 900
        ? '#ns-pad .ns-key:not([hidden]), #ns-map .ns-cell, .ns-pause-btn'
        : '#ns-pad .ns-key, .ns-pause-btn';
      document.querySelectorAll(sel).forEach((el) => {
        if (getComputedStyle(el).display === 'none') return;
        const r = el.getBoundingClientRect();
        const label = (el.dataset.k || el.dataset.room || el.className.split(' ')[0]);
        if (r.width < 40 || r.height < 34) out.small.push(label + ' ' + Math.round(r.width) + 'x' + Math.round(r.height));
        if (r.left < fr.left - 1 || r.right > fr.right + 1 || r.top < fr.top - 1 || r.bottom > fr.bottom + 1) out.outside.push(label);
      });
      /* Do any two controls sit on top of each other? Nothing else here
         would have caught the winding key's class colliding with the
         pad's: every button was still its full size and still inside
         the frame, they were simply all in the same place. */
      const boxes = [];
      document.querySelectorAll('#ns-pad .ns-key').forEach((el) => {
        if (getComputedStyle(el).display === 'none') return;
        const r = el.getBoundingClientRect();
        if (r.width && r.height) boxes.push([el.dataset.k || '?', r]);
      });
      for (let i = 0; i < boxes.length; i++)
        for (let j = i + 1; j < boxes.length; j++) {
          const a = boxes[i][1], c = boxes[j][1];
          if (a.left < c.right - 1 && c.left < a.right - 1 &&
              a.top < c.bottom - 1 && c.top < a.bottom - 1)
            out.overlap.push(boxes[i][0] + '/' + boxes[j][0]);
        }
      return out;
    });
    /* --- and the screens that are not the shift ---------------------
       Everything above measures the play HUD. Nothing here had ever
       looked at an overlay, so a caption that grew from one line to
       three sat on top of its own heading on a phone and the suite
       stayed green. An overlay that does not fit its panel is the same
       class of bug as a control outside the frame. */
    const overlays = await p.evaluate(() => {
      const n = OuissysNightShift.__night;
      const bad = [];
      const fits = (where) => {
        const panel = document.querySelector('.ns-ov, #ns-overlay');
        if (!panel) return;
        const inner = panel.firstElementChild;
        if (!inner) return;
        /* Overflow on its own is not a bug: `.ns-card` is deliberately
           `overflow-y:auto`, because HOW TO PLAY, the badges and the
           custom night's dials are long lists and scrolling them is the
           design. The first draft of this check flagged all three and
           would have had somebody "fixing" three screens that work.
           What is a bug is content taller than a panel that cannot
           scroll it — which is what the gallery was. */
        const canScroll = ['auto', 'scroll', 'overlay'].indexOf(getComputedStyle(inner).overflowY) >= 0;
        if (!canScroll && inner.scrollHeight > inner.clientHeight + 2)
          bad.push(where + ': overflows a panel that cannot scroll, by ' + (inner.scrollHeight - inner.clientHeight) + 'px');
        /* and do any two of its stacked blocks land on each other */
        const rows = [...inner.children].filter((e) => {
          const st = getComputedStyle(e);
          return st.display !== 'none' && st.position !== 'absolute';
        });
        const boxes = rows.map((e) => [e.className.split(' ')[0] || e.tagName, e.getBoundingClientRect()]);
        for (let i = 0; i < boxes.length - 1; i++) {
          const a = boxes[i][1], c = boxes[i + 1][1];
          if (a.height && c.height && a.bottom > c.top + 1)
            bad.push(where + ': ' + boxes[i][0] + ' sits on ' + boxes[i + 1][0]);
        }
        /* and is the last control still inside the panel */
        const last = boxes.length ? boxes[boxes.length - 1][1] : null;
        const pr = panel.getBoundingClientRect();
        if (!canScroll && last && last.bottom > pr.bottom + 1)
          bad.push(where + ': last control is below the panel and it does not scroll');
      };
      const screens = ['title', 'howto', 'badges', 'drawer', 'mix', 'voice', 'custom'];
      for (const scr of screens) { try { n.route(scr); fits(scr); } catch (e) {} }
      /* the gallery, once per captioned room, because the caption is the
         part that changes length */
      try {
        n.route('gallery');
        for (const room of ['office', 'stage', 'party', 'closet', 'ducts']) {
          const b = document.querySelector('.ns-groom[data-room="' + room + '"]');
          if (b) b.click();
          fits('gallery/' + room);
        }
      } catch (e) {}
      try { n.route('title'); } catch (e) {}
      return bad;
    });
    if (overlays.length) { overlays.forEach((x) => console.log('  FAIL ' + x)); fails += overlays.length; }

    console.log(name + '  stage ' + m.stage.join('x'));
    if (m.hScroll) { console.log('  FAIL horizontal scroll'); fails++; }
    if (m.outside.length) { console.log('  FAIL outside the stage: ' + m.outside.join(', ')); fails++; }
    if (m.small.length) { console.log('  FAIL too small to hit: ' + m.small.join(', ')); fails++; }
    if (m.overlap.length) { console.log('  FAIL controls on top of each other: ' + m.overlap.join(', ')); fails++; }
    if (!m.hScroll && !m.outside.length && !m.small.length && !m.overlap.length && !overlays.length) console.log('  ok');
    const cdp = await p.context().newCDPSession(p);
    const { data } = await cdp.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(OUT + '-' + name + '.png', Buffer.from(data, 'base64'));
    await p.close();
  }
  console.log(fails ? '\nFAILED ' + fails : '\nall sizes ok');
  await b.close();
  process.exit(fails ? 1 : 0);
})();
