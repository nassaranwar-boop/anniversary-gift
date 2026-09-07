const { chromium } = require('playwright-core');
(async () => {
  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox','--no-proxy-server','--disable-gpu','--use-gl=swiftshader','--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  page.on('pageerror', e => console.log('PAGEERROR', e.message));
  await page.route('**/*', r => r.request().url().startsWith('http://127.0.0.1') ? r.continue() : r.abort());
  // Simulate iOS: the visible box (dvh) is 99px shorter than window.innerHeight,
  // which is exactly the disagreement that caused the bug.
  await page.addInitScript(() => {
    document.addEventListener('DOMContentLoaded', () => {
      const st = document.createElement('style');
      st.textContent = ':root{--app-h:calc(100dvh - 99px) !important;}';
      document.head.appendChild(st);
    });
  });
  await page.goto('http://127.0.0.1:8899/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(3000);

  const check = async (label) => {
    const d = await page.evaluate(() => {
      const c = document.getElementById('book-canvas');
      const scr = document.querySelector('.screen.active');
      const cr = c.getBoundingClientRect(), sr = scr.getBoundingClientRect();
      return {
        innerH: window.innerHeight,
        screenBox: sr.width.toFixed(0)+'x'+sr.height.toFixed(0),
        canvasBox: cr.width.toFixed(0)+'x'+cr.height.toFixed(0),
        canvasInlineStyle: (c.style.width||'(none)')+' / '+(c.style.height||'(none)'),
        drawBuffer: c.width+'x'+c.height,
        bufferAspect: (c.width/c.height).toFixed(4),
        boxAspect: (cr.width/cr.height).toFixed(4),
        overflowsScreen: cr.bottom > sr.bottom + 0.5,
        docScrollable: document.documentElement.scrollHeight > document.documentElement.clientHeight,
      };
    });
    console.log('---', label); console.log(d);
    return d;
  };
  const a = await check('load, dvh 99px shorter than innerHeight');
  await page.setViewportSize({ width: 390, height: 745 });
  await page.waitForTimeout(700);
  await check('after a resize (leave/return)');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(700);
  await check('back again');
  await browser.close();
})();
