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
  await p.evaluate(() => document.getElementById('hub-card-apoc').click());
  await p.waitForSelector('#screen-apoc.active #ap-canvas', { timeout: 40000 });
  await p.waitForTimeout(4000);
  await p.evaluate(() => { if (window.__apClear) __apClear(); if (window.__apTouchUI) __apTouchUI(true); });
  await p.waitForTimeout(600);
  console.log('=== ' + label, await p.evaluate(() => {
    const out = [];
    const show = (sel) => { const e = document.querySelector(sel); if (!e) return out.push(sel + ' MISSING');
      const r = e.getBoundingClientRect(), cs = getComputedStyle(e);
      const hit = document.elementFromPoint(r.left + r.width/2, r.top + r.height/2);
      out.push(sel + ' ' + Math.round(r.left) + ',' + Math.round(r.top) + ' ' + Math.round(r.width) + 'x' + Math.round(r.height)
        + ' disp=' + cs.display + ' op=' + cs.opacity + ' pe=' + cs.pointerEvents + ' z=' + cs.zIndex
        + ' aria=' + e.getAttribute('aria-hidden')
        + ' hit=' + (hit ? (hit.tagName + '#' + (hit.id||'')) : 'none')); };
    ['#ap-pad', '.ap-key-up', '#ap-map-btn', '#ap-pause-btn', '.ap-act-use', '#ap-canvas', '#ap-stage'].forEach(show);
    const cvs = document.getElementById('ap-canvas');
    out.push('canvas z=' + getComputedStyle(cvs).zIndex + ' pos=' + getComputedStyle(cvs).position);
    return out.join('\n   ');
  }));
  await p.close();
  }
  await b.close();
})();
