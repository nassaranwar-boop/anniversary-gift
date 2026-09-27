const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox','--no-proxy-server','--use-gl=swiftshader','--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true });
  p.on('pageerror', (e) => console.log('PAGEERROR', e.message.slice(0,120)));
  await p.route('**/*', (r) => r.request().url().startsWith('http://127.0.0.1') ? r.continue() : r.abort());
  await p.goto('http://127.0.0.1:8899/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.evaluate(() => { localStorage.setItem('ns_seenintro','1'); localStorage.setItem('ns_notutor','1');
    localStorage.removeItem('ns_terms');
    showScreen('nightshift'); return loadChapter('nightshift').then(() => OuissysNightShift.start()); });
  await p.waitForFunction(() => window.OuissysNightShift && OuissysNightShift.__night, { timeout: 25000, polling: 200 });
  await p.evaluate(() => OuissysNightShift.__night.route('terms'));
  for (let i = 0; i < 10; i++) {
    await p.waitForTimeout(900);
    console.log(await p.evaluate(() => {
      const o = document.getElementById('ns-overlay');
      return [].map.call(o.querySelectorAll('button'), (e) => {
        const cs = getComputedStyle(e), r = e.getBoundingClientRect();
        return (e.id || e.dataset.go) + ' op=' + cs.opacity + ' hid=' + e.hidden + ' disp=' + cs.display
          + ' ' + Math.round(r.width) + 'x' + Math.round(r.height) + ' @' + Math.round(r.top)
          + ' anim=' + cs.animationName; }).join(' | ')
        + ' sub="' + (document.getElementById('ns-terms-sub')||{textContent:''}).textContent.slice(0,24) + '"'; }));
  }
  await b.close();
})();
