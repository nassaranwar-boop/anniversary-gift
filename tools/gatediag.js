const { chromium } = require('playwright-core');
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox','--no-proxy-server','--disable-gpu'] });
  const page = await browser.newPage({ viewport: { width: 1180, height: 900 } });
  page.on('pageerror', e=>console.log('ERR', e.message));
  await page.route('**/*', r => { const u=r.request().url();
    if (u.startsWith('http://127.0.0.1')||u.includes('fonts.g')) return r.continue(); return r.abort(); });
  await page.goto('http://127.0.0.1:8899/index.html', { waitUntil:'networkidle', timeout:60000 });
  await page.waitForTimeout(900);
  await page.evaluate(() => showScreen('gate'));
  await page.waitForTimeout(900);
  console.log(await page.evaluate(() => {
    const row = document.getElementById('gate-code');
    const cells = Array.from(row.querySelectorAll('.gate-cell'));
    const scr = document.getElementById('screen-gate');
    return {
      screenClass: scr.className,
      screenBg: getComputedStyle(scr).backgroundImage.slice(0,90),
      rowAlign: getComputedStyle(row).alignItems,
      rowRect: (r => ({t:Math.round(r.top),h:Math.round(r.height)}))(row.getBoundingClientRect()),
      cells: cells.map(c => { const r = c.getBoundingClientRect(); const st = getComputedStyle(c);
        return { t:+r.top.toFixed(1), l:+r.left.toFixed(1), w:+r.width.toFixed(1), h:+r.height.toFixed(1),
                 mt: st.marginTop, va: st.verticalAlign, disp: st.display }; }),
    };
  }));
  await browser.close();
})();
