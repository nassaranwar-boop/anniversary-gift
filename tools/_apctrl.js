const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox','--no-proxy-server','--use-gl=swiftshader','--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true });
  p.on('pageerror', (e) => console.log('PAGEERROR', e.message.slice(0,90)));
  await p.route('**/*', (r) => r.request().url().startsWith('http://127.0.0.1') ? r.continue() : r.abort());
  await p.goto('http://127.0.0.1:8899/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForTimeout(800);
  await p.evaluate(() => { showScreen('hub'); if (window.startHub) startHub(); });
  await p.waitForTimeout(500);
  await p.evaluate(() => document.getElementById('hub-card-apoc').click());
  await p.waitForSelector('#screen-apoc.active #ap-canvas', { timeout: 40000 });
  await p.waitForTimeout(3000);
  for (let i = 0; i < 6; i++) {
    const did = await p.evaluate(() => { const bn = document.querySelector('#ap-overlay button'); if (bn) { bn.click(); return bn.textContent.trim().slice(0,20); } return null; });
    if (!did) break; console.log('pressed', did); await p.waitForTimeout(900);
  }
  await p.waitForTimeout(1500);
  console.log('state', await p.evaluate(() => JSON.stringify(__apState() && { s: __apState().state, p: !!__apState().player })));
  await p.evaluate(() => { const st = document.getElementById('ap-stage'); const r = st.getBoundingClientRect();
    const x = r.left + r.width*0.22, y = r.top + r.height*0.66;
    const mk = (t, cx) => { const tt = new Touch({ identifier: 5, target: st, clientX: cx, clientY: y });
      return new TouchEvent(t, { bubbles: true, cancelable: true, changedTouches: [tt], touches: t==='touchend'?[]:[tt] }); };
    st.dispatchEvent(mk('touchstart', x)); for (let i=1;i<=6;i++) st.dispatchEvent(mk('touchmove', x+i*7));
    st.dispatchEvent(mk('touchend', x+42)); });
  await p.waitForTimeout(900);
  console.log(await p.evaluate(() => {
    const out = [];
    document.querySelectorAll('#screen-apoc button, #screen-apoc [data-ap-key]').forEach((el) => {
      const cs = getComputedStyle(el), r = el.getBoundingClientRect();
      let q = el.parentElement, why = '';
      while (q) { const qs = getComputedStyle(q);
        if (q.hidden || qs.display === 'none' || qs.visibility === 'hidden' || qs.opacity === '0') { why = 'ancestor ' + (q.id||q.className) + ' ' + qs.display + '/' + qs.opacity; break; } q = q.parentElement; }
      const hit = (r.width>1 && r.height>1) ? document.elementFromPoint(r.left+r.width/2, r.top+r.height/2) : null;
      out.push((el.id || el.dataset.apKey || el.className).slice(0,20) + ' ' + Math.round(r.width) + 'x' + Math.round(r.height)
        + ' op=' + cs.opacity + ' pe=' + cs.pointerEvents + (why ? ' HIDDEN-BY ' + why : '')
        + ' hit=' + (hit ? hit.tagName + '#' + (hit.id||'') : 'none'));
    });
    out.push('ap-touch aria=' + document.getElementById('ap-touch').getAttribute('aria-hidden'));
    return out.join('\n   ');
  }));
  await b.close();
})();
