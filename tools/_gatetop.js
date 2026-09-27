const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox','--no-proxy-server','--use-gl=swiftshader','--enable-unsafe-swiftshader'] });
  for (const [w,h,label] of [[1280,800,'desktop'],[844,390,'phone-l'],[740,360,'small-l']]) {
    const p = await b.newPage({ viewport: { width: w, height: h }, isMobile: h < 500, hasTouch: h < 500 });
    await p.route('**/*', (r) => r.request().url().startsWith('http://127.0.0.1') ? r.continue() : r.abort());
    await p.goto('http://127.0.0.1:8899/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await p.waitForTimeout(700);
    await p.evaluate(() => showScreen('gate'));
    await p.waitForTimeout(900);
    console.log('=== ' + label, await p.evaluate(() => {
      const s = document.getElementById('screen-gate');
      const out = [];
      out.push('--app-h=' + getComputedStyle(document.documentElement).getPropertyValue('--app-h').trim()
               + ' innerH=' + innerHeight);
      [].forEach.call(s.children, (e) => { const r = e.getBoundingClientRect();
        if (r.height < 1) return;
        out.push((e.tagName + '.' + (e.className||'')).slice(0,30) + ' ' + Math.round(r.top) + '..' + Math.round(r.bottom)); });
      const card = document.getElementById('gate-card');
      out.push('card scrollH=' + card.scrollHeight + ' offH=' + card.offsetHeight);
      const inner = [].map.call(card.children, (e) => { const r = e.getBoundingClientRect();
        const cs = getComputedStyle(e);
        return r.height > 1 ? (e.className+'').slice(0,18) + ' ' + Math.round(r.top) + '..' + Math.round(r.bottom) + ' ' + cs.position : null; }).filter(Boolean);
      return out.join(' | ') + '\n   ' + inner.join('\n   ');
    }));
    await p.close();
  }
  await b.close();
})();
