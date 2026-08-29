const { chromium } = require('playwright-core');
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox','--no-proxy-server','--disable-gpu'] });
  const page = await browser.newPage({ viewport: { width: 1000, height: 700 } });
  // wrap rAF before any site script runs, and record who asks and who fires
  await page.addInitScript(() => {
    window.__raf = [];
    const real = window.requestAnimationFrame.bind(window);
    const realCancel = window.cancelAnimationFrame.bind(window);
    window.requestAnimationFrame = function (cb) {
      const who = (new Error()).stack.split('\n')[2] || '?';
      const id = real(function (t) {
        const rec = window.__raf.find(r => r.id === id);
        if (rec) rec.fired = (rec.fired || 0) + 1;
        return cb(t);
      });
      const short = who.trim().replace(/^at\s+/, '').split('/').pop();
      let rec = window.__raf.find(r => r.who === short);
      if (!rec) { rec = { who: short, n: 0, fired: 0, id: id }; window.__raf.push(rec); }
      rec.n++; rec.id = id;
      return id;
    };
    window.cancelAnimationFrame = function (id) {
      window.__cancels = (window.__cancels || 0) + 1;
      window.__lastCancel = (new Error()).stack.split('\n')[2];
      return realCancel(id);
    };
  });
  const errs = [];
  page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
  await page.route('**/*', r => r.request().url().startsWith('http://127.0.0.1') ? r.continue() : r.abort());
  await page.goto('http://127.0.0.1:8899/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(600);
  await page.evaluate(() => { try{localStorage.clear();}catch(e){} showScreen('ouissy'); startSuperOuissy(); });
  await page.waitForTimeout(1500);
  const r = await page.evaluate(() => ({
    registrations: window.__raf.map(x => ({ who: x.who, asked: x.n, fired: x.fired })),
    cancels: window.__cancels || 0,
    lastCancel: (window.__lastCancel || '').trim(),
    loop: window.__soLoop(),
  }));
  console.log(JSON.stringify(r, null, 1));
  console.log(errs.length ? errs.join('\n') : 'no page errors');
  await browser.close();
})();
