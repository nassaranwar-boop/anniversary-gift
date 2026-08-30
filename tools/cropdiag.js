const { chromium } = require('playwright-core');
(async () => {
  const browser = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args:['--no-sandbox','--no-proxy-server','--disable-gpu'] });
  for (const [w,h,label] of [[390,844,'phone'],[390,667,'short'],[1180,900,'desktop']]) {
    const page = await browser.newPage({ viewport:{width:w,height:h}, isMobile:label!=='desktop', hasTouch:label!=='desktop' });
    await page.route('**/*', r => { const u=r.request().url();
      if (u.startsWith('http://127.0.0.1')||u.includes('fonts.g')) return r.continue(); return r.abort(); });
    await page.goto('http://127.0.0.1:8899/index.html', { waitUntil:'networkidle', timeout:60000 });
    await page.waitForTimeout(700);
    for (const scr of ['gate','details','level2intro','hub','keepsake','ouissy']) {
      await page.evaluate((s) => { try{localStorage.clear();}catch(e){} showScreen(s);
        if (s==='hub' && window.startHub) startHub(); }, scr);
      await page.waitForTimeout(450);
      const m = await page.evaluate(() => {
        document.querySelectorAll('.anim-in').forEach(e => e.classList.remove('anim-in'));
        const s = document.querySelector('.screen.active');
        if (!s) return null;
        const sr = s.getBoundingClientRect();
        const cs = getComputedStyle(s);
        let top = Infinity, bottom = -Infinity, tallest = '';
        Array.from(s.children).forEach(c => {
          const st = getComputedStyle(c);
          if (st.display === 'none' || st.position === 'absolute' || st.position === 'fixed') return;
          const r = c.getBoundingClientRect();
          if (r.height < 4) return;
          if (r.top < top) { top = r.top; tallest = c.className.split(' ')[0] + ' h=' + Math.round(r.height); }
          if (r.bottom > bottom) bottom = r.bottom;
        });
        return { id: s.id, screenTop: Math.round(sr.top), screenH: Math.round(sr.height),
                 vh: innerHeight, align: cs.alignItems, justify: cs.justifyContent,
                 overflowY: cs.overflowY,
                 contentTop: top === Infinity ? null : Math.round(top),
                 contentBottom: bottom === -Infinity ? null : Math.round(bottom),
                 who: tallest };
      });
      if (!m) continue;
      const clippedTop = m.contentTop !== null && m.contentTop < m.screenTop - 1;
      const clippedBot = m.contentBottom !== null && m.contentBottom > m.screenTop + m.screenH + 1;
      console.log(`${label.padEnd(8)} ${String(m.id).padEnd(20)} screen ${m.screenH}/${m.vh}` +
        ` align=${m.align} ovf=${m.overflowY}` +
        ` content ${m.contentTop}..${m.contentBottom}` +
        (clippedTop ? `  <<< TOP CLIPPED by ${m.screenTop - m.contentTop}px (${m.who})` : '') +
        (clippedBot ? `  >>> bottom over by ${m.contentBottom - (m.screenTop+m.screenH)}px` : ''));
    }
    await page.close();
  }
  await browser.close();
})();
