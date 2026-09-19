const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox','--no-proxy-server','--use-gl=swiftshader','--enable-unsafe-swiftshader'] });
  for (const [w,h,label] of [[1280,800,'desktop'],[1024,768,'ipad'],[844,390,'phone']]) {
    const p = await b.newPage({ viewport: { width: w, height: h }, isMobile: h < 500, hasTouch: h < 500 });
    await p.route('**/*', (r) => r.request().url().startsWith('http://127.0.0.1') ? r.continue() : r.abort());
    await p.goto('http://127.0.0.1:8899/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await p.waitForTimeout(900);
    await p.evaluate(() => { const c = document.getElementById('book-canvas') || document.body;
      c.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); c.click(); });
    await p.waitForTimeout(1000);
    await p.evaluate(() => { if (!document.querySelector('#screen-gate.active')) showScreen('gate'); });
    for (const d of '2207') { try { await p.click(`[data-gate-key="${d}"]`, {timeout:4000}); } catch(e){} await p.waitForTimeout(120); }
    try { await p.click('#gate-submit', {timeout:4000}); } catch(e){}
    try { await p.waitForSelector('#screen-hub.active', { timeout: 12000 }); } catch(e){ console.log(label,'no hub'); }
    await p.waitForTimeout(900);
    for (const scr of ['hub','scrapbook']) {
      await p.evaluate((s) => showScreen(s), scr);
      await p.waitForTimeout(1200);
      console.log(label, scr, await p.evaluate(() => {
        const a = document.querySelector('.screen.active');
        const sel = ['.hub-grid','.hub-inner','.sb-stage','.sb-book','.screen-inner'];
        const out = [];
        sel.forEach((q) => { const e = a.querySelector(q); if (!e) return;
          const r = e.getBoundingClientRect();
          out.push(q + ' ' + Math.round(r.left) + ',' + Math.round(r.top) + ' ' + Math.round(r.width) + 'x' + Math.round(r.height)); });
        out.push('scrollY=' + scrollY + ' bodyScroll=' + document.body.scrollHeight + '/' + innerHeight);
        return out.join(' | '); }));
    }
    await p.close();
  }
  await b.close();
})();
