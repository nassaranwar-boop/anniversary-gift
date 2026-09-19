const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox','--no-proxy-server','--use-gl=swiftshader','--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true });
  await p.route('**/*', (r) => r.request().url().startsWith('http://127.0.0.1') ? r.continue() : r.abort());
  await p.goto('http://127.0.0.1:8899/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForTimeout(800);
  console.log(await p.evaluate(() => JSON.stringify({
    coarse: matchMedia('(pointer:coarse)').matches,
    fine: matchMedia('(pointer:fine)').matches,
    hoverHover: matchMedia('(hover:hover)').matches,
    touchPoints: navigator.maxTouchPoints })));
  await p.evaluate(() => { showScreen('hub'); if (window.startHub) startHub(); });
  await p.waitForTimeout(500);
  await p.evaluate(() => document.getElementById('hub-card-ouissy').click());
  await p.waitForSelector('#screen-ouissy.active #so-canvas', { timeout: 30000 });
  await p.waitForTimeout(2500);
  await p.evaluate(() => document.getElementById('so-play').click());
  await p.waitForTimeout(900);
  await p.evaluate(() => { const e = document.getElementById('so-how-ok'); if (e) e.click(); });
  await p.waitForTimeout(3500);
  console.log(await p.evaluate(() => {
    const pad = document.getElementById('so-pad');
    const r = pad.getBoundingClientRect(), cs = getComputedStyle(pad);
    const keys = [].map.call(pad.querySelectorAll('.so-key'), (k) => { const q = k.getBoundingClientRect();
      return (k.dataset.soKey) + ' ' + Math.round(q.left) + ',' + Math.round(q.top) + ' ' + Math.round(q.width) + 'x' + Math.round(q.height); });
    return JSON.stringify({ state: __soState().state,
      pad: [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)],
      disp: cs.display, aria: pad.getAttribute('aria-hidden'), cls: document.getElementById('screen-ouissy').className,
      keys: keys }, null, 1); }));
  await b.close();
})();
