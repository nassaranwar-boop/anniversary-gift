const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox','--no-proxy-server','--use-gl=swiftshader','--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true });
  p.on('pageerror', (e) => console.log('PAGEERROR', e.message.slice(0,120)));
  await p.route('**/*', (r) => r.request().url().startsWith('http://127.0.0.1') ? r.continue() : r.abort());
  await p.goto('http://127.0.0.1:8899/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForTimeout(700);
  await p.evaluate(() => showScreen('gate'));
  await p.waitForTimeout(1500);
  console.log(await p.evaluate(() => {
    const wide = document.querySelector('.gate-frame-wide');
    const tall = document.querySelector('.gate-frame:not(.gate-frame-wide)');
    const out = [];
    const d = (e, n) => { if (!e) return out.push(n + ': MISSING');
      const cs = getComputedStyle(e), r = e.getBoundingClientRect();
      out.push(n + ': display=' + cs.display + ' ' + Math.round(r.width) + 'x' + Math.round(r.height)
        + ' op=' + cs.opacity + ' vis=' + cs.visibility); };
    d(wide, 'wide'); d(tall, 'tall');
    if (wide) {
      const rect = wide.querySelector('.gate-rule-o');
      const rr = rect.getBoundingClientRect();
      out.push('rule-o box ' + Math.round(rr.width) + 'x' + Math.round(rr.height)
        + ' stroke=' + getComputedStyle(rect).stroke);
      const u = wide.querySelector('use');
      out.push('first use href=' + u.getAttribute('href') + ' box ' + JSON.stringify(u.getBoundingClientRect().width));
      out.push('defs owner display=' + getComputedStyle(document.getElementById('gFlour').closest('svg')).display);
    }
    return out.join('\n   ');
  }));
  await b.close();
})();
