/* The panel measured at real device sizes. Reports anything that
   overflows its stage, any control smaller than a thumb, and takes a
   picture of each. node nightlayout.js <outdir> */
const { chromium } = require('playwright-core');
const fs = require('fs');
const OUT = process.argv[2] || '/tmp/wklay';
const SIZES = [
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
      showScreen('nightshift'); OuissysNightShift.start(); OuissysNightShift.__night.silence(true);
    });
    /* start() shows a loading card and builds the shop a frame later, so
       the shift cannot be routed in the same turn as the boot */
    await p.waitForFunction(() => Object.keys(OuissysNightShift.__night.cast()).length === 4,
                            { timeout: 20000, polling: 200 });
    await p.evaluate(() => {
      OuissysNightShift.__night.route('start'); OuissysNightShift.__night.route('go');
      OuissysNightShift.__night.press('monitor');
    });
    await p.waitForTimeout(1400);
    const m = await p.evaluate(() => {
      const st = document.getElementById('ns-stage').getBoundingClientRect();
      /* held upright the controls sit under the stage, so the box they
         must stay inside is the frame, not the stage */
      const fr = document.querySelector('.ns-frame').getBoundingClientRect();
      const out = { stage: [Math.round(st.width), Math.round(st.height)], small: [], outside: [], hScroll: document.documentElement.scrollWidth > window.innerWidth + 1 };
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
      return out;
    });
    console.log(name + '  stage ' + m.stage.join('x'));
    if (m.hScroll) { console.log('  FAIL horizontal scroll'); fails++; }
    if (m.outside.length) { console.log('  FAIL outside the stage: ' + m.outside.join(', ')); fails++; }
    if (m.small.length) { console.log('  FAIL too small to hit: ' + m.small.join(', ')); fails++; }
    if (!m.hScroll && !m.outside.length && !m.small.length) console.log('  ok');
    const cdp = await p.context().newCDPSession(p);
    const { data } = await cdp.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(OUT + '-' + name + '.png', Buffer.from(data, 'base64'));
    await p.close();
  }
  console.log(fails ? '\nFAILED ' + fails : '\nall sizes ok');
  await b.close();
  process.exit(fails ? 1 : 0);
})();
