const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox','--no-proxy-server','--use-gl=swiftshader','--enable-unsafe-swiftshader'] });
  for (const [w,h,label] of [[1280,800,'desktop'],[844,390,'phone-l'],[740,360,'small-l'],[390,844,'portrait']]) {
    const p = await b.newPage({ viewport: { width: w, height: h }, isMobile: h < 500, hasTouch: h < 500 });
    await p.route('**/*', (r) => r.request().url().startsWith('http://127.0.0.1') ? r.continue() : r.abort());
    await p.goto('http://127.0.0.1:8899/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await p.waitForTimeout(700);
    await p.evaluate(() => showScreen('gate'));
    await p.waitForTimeout(700);
    console.log('=== ' + label + ' ' + w + 'x' + h);
    console.log(await p.evaluate(() => {
      const out = [];
      const card = document.getElementById('gate-card');
      const cr = card.getBoundingClientRect();
      out.push('card ' + Math.round(cr.left) + ',' + Math.round(cr.top) + ' ' + Math.round(cr.width) + 'x' + Math.round(cr.height)
               + ' tr=' + (card.style.transform || '-'));
      const show = (el, name) => { const r = el.getBoundingClientRect();
        const cx = r.left + r.width/2, cy = r.top + r.height/2;
        const hit = (cx>=0&&cy>=0&&cx<=innerWidth&&cy<=innerHeight) ? document.elementFromPoint(cx, cy) : null;
        const cov = hit && hit !== el && !el.contains(hit) && !hit.contains(el);
        out.push('  ' + name.padEnd(12) + Math.round(r.left) + ',' + Math.round(r.top) + ' ' + Math.round(r.width) + 'x' + Math.round(r.height)
          + (r.bottom > innerHeight + 1 ? ' OFF-BOTTOM' : '') + (r.right > innerWidth + 1 ? ' OFF-RIGHT' : '')
          + (cov ? ' COVERED-BY ' + ((hit.id||hit.className)+'').slice(0,26) : '')); };
      ['1','0','clear','back'].forEach((k) => { const e = document.querySelector('[data-gate-key="'+k+'"]'); if (e) show(e, 'key ' + k); });
      const u = document.getElementById('gate-submit'); if (u) show(u, 'unlock');
      const pad = document.getElementById('gate-pad'); if (pad) show(pad, 'pad');
      return out.join('\n');
    }));
    await p.close();
  }
  await b.close();
})();
