const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox','--no-proxy-server','--use-gl=swiftshader','--enable-unsafe-swiftshader'] });
  for (const [w,h,label] of [[1280,800,'desktop'],[844,390,'phone-l']]) {
  const p = await b.newPage({ viewport: { width: w, height: h }, isMobile: h<500, hasTouch: h<500 });
  p.on('pageerror', (e) => console.log('PAGEERROR', e.message.slice(0,90)));
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
  for (let i = 0; i < 2; i++) { await p.evaluate((s) => { const e = document.querySelector(s); if (e) e.click(); }, CH); await p.waitForTimeout(1400); }
  console.log('=== ' + label, await p.evaluate((sel) => {
    const out = [(document.getElementById('hv-note')||{}).textContent.slice(0,50)];
    document.querySelectorAll(sel).forEach((e) => { const r = e.getBoundingClientRect(); const cs = getComputedStyle(e);
      const hit = document.elementFromPoint(r.left+r.width/2, r.top+r.height/2);
      out.push('"' + (e.textContent||'').trim().slice(0,14) + '" ' + Math.round(r.left)+','+Math.round(r.top)+' '+Math.round(r.width)+'x'+Math.round(r.height)
        + ' z=' + cs.zIndex + ' pos=' + cs.position + ' par=' + (e.parentElement.id||e.parentElement.className)
        + ' hit=' + (hit ? hit.tagName+'#'+(hit.id||'') : 'none')); });
    const c = document.getElementById('hv-canvas'); const cr = c.getBoundingClientRect();
    out.push('canvas ' + Math.round(cr.left)+','+Math.round(cr.top)+' '+Math.round(cr.width)+'x'+Math.round(cr.height) + ' z=' + getComputedStyle(c).zIndex);
    ['hv-left','hv-centre','hv-right','hv-cards'].forEach((id) => { const e = document.getElementById(id); const r = e.getBoundingClientRect(); const cs = getComputedStyle(e);
      out.push(id + ' ' + Math.round(r.left)+','+Math.round(r.top)+' '+Math.round(r.width)+'x'+Math.round(r.height) + ' z=' + cs.zIndex + ' pos=' + cs.position + ' pe=' + cs.pointerEvents); });
    return out.join('\n   ');
  }, CH));
  await p.close();
  }
  await b.close();
})();
