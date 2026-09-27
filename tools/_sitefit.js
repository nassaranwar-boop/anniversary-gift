const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox','--no-proxy-server','--use-gl=swiftshader','--enable-unsafe-swiftshader'] });
  for (const [w,h,label] of [[1280,800,'desktop'],[1024,768,'ipad'],[844,390,'phone'],[740,360,'small']]) {
    const p = await b.newPage({ viewport: { width: w, height: h }, isMobile: h < 500, hasTouch: h < 500 });
    await p.route('**/*', (r) => r.request().url().startsWith('http://127.0.0.1') ? r.continue() : r.abort());
    await p.goto('http://127.0.0.1:8899/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await p.waitForTimeout(800);
    for (const [scr, sel] of [['gate','.gate-card'],['hub','.hub-wrap'],['keepsake','.ks-wrap'],['end','.night-sky-inner']]) {
      await p.evaluate((s) => showScreen(s), scr);
      await p.waitForTimeout(700);
      console.log(label.padEnd(8), scr.padEnd(9), await p.evaluate((q) => {
        const a = document.querySelector('.screen.active');
        const e = a.querySelector(q);
        if (!e) return 'no ' + q;
        const r = e.getBoundingClientRect();
        const over = Math.max(0, Math.round(r.bottom - innerHeight), Math.round(-r.top),
                              Math.round(r.right - innerWidth), Math.round(-r.left));
        return Math.round(r.width) + 'x' + Math.round(r.height) + ' @' + Math.round(r.left) + ',' + Math.round(r.top)
          + ' scrollH=' + e.scrollHeight + ' over=' + over
          + ' tr=' + (e.style.transform || '-')
          + ' btns=' + [].map.call(a.querySelectorAll('button'), (x) => { const q2 = x.getBoundingClientRect();
              return (q2.bottom > innerHeight + 1 || q2.top < -1 || q2.right > innerWidth + 1 || q2.left < -1) ? (x.id||x.className).slice(0,14) : null; })
              .filter(Boolean).join(',') || 'all on';
      }, sel));
    }
    await p.close();
  }
  await b.close();
})();
