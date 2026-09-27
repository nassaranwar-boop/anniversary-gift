const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox','--no-proxy-server','--use-gl=swiftshader','--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 740, height: 360 }, isMobile: true, hasTouch: true });
  p.on('pageerror', (e) => console.log('PAGEERROR', e.message.slice(0,120)));
  await p.route('**/*', (r) => r.request().url().startsWith('http://127.0.0.1') ? r.continue() : r.abort());
  await p.goto('http://127.0.0.1:8899/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForTimeout(800);
  await p.evaluate(() => { showScreen('nightshift'); });
  await p.evaluate(() => loadChapter('nightshift').then(() => OuissysNightShift.start()));
  await p.waitForTimeout(3500);
  console.log(JSON.stringify(await p.evaluate(() => {
    const o = document.getElementById('ns-overlay');
    const c = o && o.querySelector('.ns-card');
    const st = document.querySelector('.ns-stage');
    const r = c && c.getBoundingClientRect();
    return {
      hasFit: typeof window.fitCard,
      overlay: o ? { cls: o.className, h: Math.round(o.getBoundingClientRect().height) } : null,
      stage: st ? { h: Math.round(st.getBoundingClientRect().height) } : null,
      card: c ? { off: c.offsetHeight, scroll: c.scrollHeight, rect: Math.round(r.height),
                  top: Math.round(r.top), bottom: Math.round(r.bottom),
                  transform: c.style.transform, maxH: getComputedStyle(c).maxHeight } : null,
      parent: c && c.parentElement ? { tag: c.parentElement.className,
                h: Math.round(c.parentElement.getBoundingClientRect().height) } : null,
    };
  }), null, 1));
  await b.close();
})();
