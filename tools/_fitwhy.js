const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox','--no-proxy-server','--use-gl=swiftshader','--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 1024, height: 768 } });
  await p.route('**/*', (r) => r.request().url().startsWith('http://127.0.0.1') ? r.continue() : r.abort());
  await p.goto('http://127.0.0.1:8899/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.evaluate(() => {
    window.__fitLog = [];
    const orig = window.fitCard;
    window.fitCard = function (el, pad) {
      const room = el.parentElement || document.body;
      const before = { t: performance.now().toFixed(0), cls: (el.className||'').slice(0,18),
        roomH: room.clientHeight, appH: getComputedStyle(document.documentElement).getPropertyValue('--app-h').trim(),
        natH: Math.max(el.offsetHeight, el.scrollHeight), natW: Math.max(el.offsetWidth, el.scrollWidth) };
      const k = orig.apply(this, arguments);
      before.used = k; before.tr = el.style.transform || '-';
      window.__fitLog.push(before);
      return k;
    };
  });
  await p.waitForTimeout(600);
  await p.evaluate(() => showScreen('gate'));
  await p.waitForTimeout(2500);
  console.log(JSON.stringify(await p.evaluate(() => window.__fitLog), null, 1));
  console.log('final card:', await p.evaluate(() => { const c = document.getElementById('gate-card');
    const r = c.getBoundingClientRect(); return Math.round(r.width) + 'x' + Math.round(r.height) + ' tr=' + (c.style.transform||'-'); }));
  await b.close();
})();
