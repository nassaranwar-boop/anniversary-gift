const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox','--no-proxy-server','--use-gl=swiftshader','--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true });
  await p.route('**/*', (r) => r.request().url().startsWith('http://127.0.0.1') ? r.continue() : r.abort());
  await p.goto('http://127.0.0.1:8899/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForTimeout(800);
  await p.evaluate(() => { showScreen('hub'); if (window.startHub) startHub(); });
  await p.waitForTimeout(500);
  await p.evaluate(() => document.getElementById('hub-card-quest').click());
  await p.waitForSelector('#screen-quest.active .hv-stage', { timeout: 30000 });
  await p.waitForTimeout(1200);
  const CH = '#hv-left .hv-btn, #hv-centre .hv-btn, #hv-right .hv-btn, #hv-cards .hv-card';
  await p.evaluate(() => document.querySelector('.hv-btn-start').click());
  await p.waitForTimeout(1300);
  await p.evaluate((s) => { const e = document.querySelector(s); if (e) e.click(); }, CH);
  await p.waitForTimeout(1500);
  await p.evaluate((s) => { const e = document.querySelector(s); if (e) e.click(); }, CH);
  for (let i = 0; i < 8; i++) {
    await p.waitForTimeout(700);
    console.log((i+1)*0.7 + 's', await p.evaluate((sel) => {
      const e = document.querySelector(sel); if (!e) return 'none';
      const par = e.parentElement, cs = getComputedStyle(par);
      const r = e.getBoundingClientRect();
      const hit = document.elementFromPoint(r.left+r.width/2, r.top+r.height/2);
      return '"' + e.textContent.trim().slice(0,10) + '" parOp=' + cs.opacity + ' parPe=' + cs.pointerEvents
        + ' hushed=' + par.classList.contains('hv-hushed') + ' disabled=' + e.disabled
        + ' hit=' + (hit ? hit.tagName+'#'+(hit.id||'') : 'none'); }, CH));
  }
  await b.close();
})();
