/* The first and last turns: the card must stay put on the leaf. */
const { chromium } = require('playwright-core'); const fs = require('fs');
const R=[]; const ok=(n,c,x)=>R.push((c?'PASS  ':'FAIL  ')+n+(x?'   '+x:''));
(async () => {
  const browser = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args:['--no-sandbox','--no-proxy-server','--disable-gpu'] });
  const page = await browser.newPage({ viewport:{width:1180,height:900} });
  const errs=[]; page.on('pageerror', e=>errs.push(e.message));
  await page.route('**/*', r => { const u=r.request().url();
    if (u.startsWith('http://127.0.0.1')||u.includes('fonts.g')) return r.continue(); return r.abort(); });
  await page.goto('http://127.0.0.1:8899/index.html', { waitUntil:'networkidle', timeout:60000 });
  await page.waitForTimeout(800);
  await page.evaluate(() => { try{localStorage.clear();}catch(e){} showScreen('scrapbook');
    if (window.Scrapbook) Scrapbook.start(); });
  await page.waitForTimeout(1800);
  await page.evaluate(() => {
    const s = document.getElementById('screen-scrapbook');
    s.classList.add('sb-intro-out','sb-open');
    const i = document.getElementById('sb-intro'); if (i) i.style.display='none';
  });
  await page.waitForTimeout(1200);

  // start the very first turn and look at the leaf mid-flight
  await page.evaluate(() => Scrapbook.next());
  await page.waitForTimeout(190);
  const mid = await page.evaluate(() => {
    const clones = Array.from(document.querySelectorAll('.sb-leaf .sb-page.in-leaf'));
    return clones.map(c => {
      const cs = getComputedStyle(c);
      const label = c.querySelector('.sb-cover-label, .sb-page-back-inner, .sb-end-card');
      const cr = c.getBoundingClientRect();
      const lr = label ? label.getBoundingClientRect() : null;
      return { cls: c.className.replace('sb-page ', '').slice(0, 40),
               display: cs.display,
               // how far off-centre is the card on its own page?
               offsetX: lr ? Math.round((lr.left + lr.width/2) - (cr.left + cr.width/2)) : null,
               offsetTop: lr ? Math.round(lr.top - cr.top) : null,
               pageH: Math.round(cr.height) };
    });
  });
  ok('the turning sheet has clones on it', mid.length > 0, mid.length + ' clones');
  const cover = mid.filter(m => /cover/.test(m.cls));
  ok('the cover keeps its flex centring while it turns',
     cover.length === 0 || cover.every(m => m.display === 'flex'),
     cover.map(m => m.cls + '=' + m.display).join(', '));
  ok('and its card does not slide off centre',
     cover.length === 0 || cover.every(m => m.offsetX === null || Math.abs(m.offsetX) <= 4),
     cover.map(m => 'dx=' + m.offsetX).join(', '));
  ok('nor jump to the top of the page',
     cover.length === 0 || cover.every(m => m.offsetTop === null || m.offsetTop > m.pageH * 0.12),
     cover.map(m => 'top=' + m.offsetTop + '/' + m.pageH).join(', '));

  await page.waitForTimeout(1400);
  // and the same at the very end of the book
  const turned = await page.evaluate(async () => {
    let n = 0;
    while (n < 40) { const before = Scrapbook.next(); await new Promise(r=>setTimeout(r,140)); n++; }
    return n;
  });
  await page.waitForTimeout(900);
  await page.evaluate(() => Scrapbook.prev());
  await page.waitForTimeout(190);
  const back = await page.evaluate(() => {
    const clones = Array.from(document.querySelectorAll('.sb-leaf .sb-page.in-leaf'));
    return clones.map(c => ({ cls: c.className.slice(0,44), display: getComputedStyle(c).display }));
  });
  ok('the back page keeps its centring too',
     back.every(m => !/page-back/.test(m.cls) || m.display === 'flex'),
     back.map(m=>m.display).join(','));

  console.log(R.join('\n'));
  console.log(errs.length ? 'ERRORS: '+errs.join(' | ') : 'no page errors');
  await browser.close();
  process.exit(R.some(r=>r.startsWith('FAIL')) ? 1 : 0);
})();
