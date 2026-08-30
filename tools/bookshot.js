/* Opens the book and its drawer, then shoots. node bookshot.js <out> [w] [h] [drawer|cover|gate] */
const { chromium } = require('playwright-core'); const fs = require('fs');
const [out, W = 1180, H = 900, mode = 'drawer'] = process.argv.slice(2);
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox','--no-proxy-server','--disable-gpu','--font-render-hinting=none'] });
  const page = await browser.newPage({ viewport: { width: +W, height: +H }, deviceScaleFactor: 1 });
  page.on('pageerror', e => console.log('PAGEERROR', e.message));
  await page.route('**/*', r => {
    const u = r.request().url();
    if (u.startsWith('http://127.0.0.1')) return r.continue();
    if (u.includes('fonts.googleapis') || u.includes('fonts.gstatic')) return r.continue();
    if (u.includes('img.youtube.com')) return r.continue();
    return r.abort();
  });
  await page.goto('http://127.0.0.1:8899/index.html', { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(800);
  if (mode === 'gate' || mode === 'gate-typing') {
    await page.evaluate(() => { try{localStorage.clear();}catch(e){} showScreen('gate'); });
    await page.waitForTimeout(900);
    if (mode === 'gate-typing') {
      for (const k of ['2','2','0']) {
        await page.click(`[data-gate-key="${k}"]`);
        await page.waitForTimeout(160);
      }
      await page.waitForTimeout(400);
    }
  } else {
    await page.evaluate(() => { try{localStorage.clear();}catch(e){} showScreen('scrapbook');
      if (window.Scrapbook) Scrapbook.start(); });
    await page.waitForTimeout(1800);
    // skip the intro and open the book
    await page.evaluate(() => {
      const s = document.getElementById('screen-scrapbook');
      s.classList.add('sb-intro-out', 'sb-open');
      const i = document.getElementById('sb-intro'); if (i) i.style.display = 'none';
    });
    await page.waitForTimeout(1200);
    if (mode === 'note') {
      await page.evaluate(() => { const p = document.querySelectorAll('.sb-photo'); if (p[3]) p[3].click(); });
      await page.waitForTimeout(1200);
    }
    if (mode === 'drawer') {
      await page.evaluate(() => { const b = document.getElementById('sb-extras-btn'); if (b) b.click(); });
      await page.waitForTimeout(1600);
      await page.evaluate(() => { const d = document.getElementById('sb-drawer'); if (d) d.scrollTop = 0; });
      await page.waitForTimeout(300);
    }
  }
  await page.evaluate(() => { const st=document.createElement('style');
    st.textContent='*{backdrop-filter:none !important; animation-play-state:paused !important}';
    document.head.appendChild(st); });
  await page.waitForTimeout(250);
  const cdp = await page.context().newCDPSession(page);
  const { data } = await cdp.send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(out, Buffer.from(data, 'base64'));
  console.log('wrote', out);
  await browser.close();
})();
