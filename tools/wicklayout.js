/* The panel measured at real device sizes. Reports anything that
   overflows its stage, any control smaller than a thumb, and takes a
   picture of each. node wicklayout.js <outdir> */
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
      showScreen('wick'); WickAndCogs.start(); WickAndCogs.__wick.silence(true);
      WickAndCogs.__wick.route('start'); WickAndCogs.__wick.route('go');
      WickAndCogs.__wick.press('monitor');
    });
    await p.waitForTimeout(1400);
    const m = await p.evaluate(() => {
      const st = document.getElementById('wick-stage').getBoundingClientRect();
      const out = { stage: [Math.round(st.width), Math.round(st.height)], small: [], outside: [], hScroll: document.documentElement.scrollWidth > window.innerWidth + 1 };
      document.querySelectorAll('#wk-pad .wk-key, #wk-map .wk-cell, .wk-pause-btn').forEach((el) => {
        const r = el.getBoundingClientRect();
        const label = (el.dataset.k || el.dataset.room || el.className.split(' ')[0]);
        if (r.width < 40 || r.height < 34) out.small.push(label + ' ' + Math.round(r.width) + 'x' + Math.round(r.height));
        if (r.left < st.left - 1 || r.right > st.right + 1 || r.top < st.top - 1 || r.bottom > st.bottom + 1) out.outside.push(label);
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
