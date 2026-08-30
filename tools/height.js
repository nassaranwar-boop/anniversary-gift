const { chromium } = require('playwright-core');
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox','--no-proxy-server','--disable-gpu'] });
  for (const vp of [[390,844,'phone'],[1180,900,'desktop']]) {
    const page = await browser.newPage({ viewport: { width: vp[0], height: vp[1] }, isMobile: vp[2]==='phone', hasTouch: vp[2]==='phone' });
    await page.route('**/*', r => r.request().url().startsWith('http://127.0.0.1') ? r.continue() : r.abort());
    await page.goto('http://127.0.0.1:8899/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(900);
    for (const scr of ['gate','hub','ouissy','scrapbook']) {
      await page.evaluate((s) => { try{localStorage.clear();}catch(e){} showScreen(s); if(s==='hub'&&window.startHub) startHub(); }, scr);
      await page.waitForTimeout(500);
      const m = await page.evaluate(() => {
        const de = document.documentElement, b = document.body;
        // who is taller than the viewport?
        const over = [];
        document.querySelectorAll('body *').forEach(el => {
          const r = el.getBoundingClientRect();
          if (r.height > 0 && r.bottom > innerHeight + 2 && getComputedStyle(el).position !== 'fixed') {
            over.push({ t: el.tagName.toLowerCase() + (el.id ? '#'+el.id : '') + (el.className && typeof el.className==='string' ? '.'+el.className.trim().split(/\s+/).slice(0,2).join('.') : ''),
                        bottom: Math.round(r.bottom), h: Math.round(r.height) });
          }
        });
        over.sort((a,b)=>b.bottom-a.bottom);
        return { innerH: innerHeight, deScroll: de.scrollHeight, bodyScroll: b.scrollHeight,
                 deClient: de.clientHeight, over: over.slice(0,4),
                 bodyH: getComputedStyle(b).height, deH: getComputedStyle(de).height,
                 bodyMin: getComputedStyle(b).minHeight };
      });
      console.log(vp[2], scr.padEnd(10),
        'inner=' + m.innerH, 'docScroll=' + m.deScroll, 'bodyScroll=' + m.bodyScroll,
        'overflow=' + (m.deScroll - m.innerH),
        '| body h=' + m.bodyH + ' min=' + m.bodyMin,
        m.over.length ? '\n        tallest: ' + m.over.map(o=>o.t+'(b='+o.bottom+',h='+o.h+')').join(', ') : '');
    }
    await page.close();
  }
  await browser.close();
})();
