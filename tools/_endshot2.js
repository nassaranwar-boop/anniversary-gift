const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox','--no-proxy-server','--use-gl=swiftshader','--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 1100, height: 760 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message.slice(0,140)));
  await p.route('**/*', r => r.request().url().startsWith('http://127.0.0.1') ? r.continue() : r.abort());
  await p.goto('http://127.0.0.1:8899/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForTimeout(800);
  await p.evaluate(() => { try{localStorage.clear();}catch(e){} showScreen('nightshift');
    return loadChapter('nightshift').then(() => OuissysNightShift.start()); });
  await p.waitForFunction(() => window.OuissysNightShift &&
    Object.keys(OuissysNightShift.__night.cast()).length >= 4, { timeout: 25000, polling: 250 });
  const arm = process.argv[2] || 'wind';
  await p.evaluate((arm) => {
    const w = OuissysNightShift.__night;
    w.silence(true);
    try { localStorage.setItem('ns_kept', JSON.stringify({1:1,2:1,3:0,4:1,5:0,6:1})); } catch(e){}
    w.route(arm === 'wind' ? 'endWind' : 'endLeave');
  }, arm);
  await p.waitForTimeout(1200);
  const txt = await p.evaluate(() => {
    const c = document.querySelector('.ns-card-fin');
    if (!c) return null;
    const h = c.querySelector('.ns-hers');
    return { hasHers: !!h,
             hersText: h ? [...h.querySelectorAll('p')].map(x => x.textContent) : [],
             order: [...c.children].map(x => x.className || x.tagName).join(' | '),
             scrollH: c.scrollHeight, clientH: c.clientHeight };
  });
  console.log(JSON.stringify(txt, null, 1));
  const el = await p.$('.ns-card-fin');
  if (el) { await el.scrollIntoViewIfNeeded();
    await p.evaluate(() => { const c=document.querySelector('.ns-card-fin');
      const h=c.querySelector('.ns-hers-head'); if(h) h.scrollIntoView({block:'start'}); });
    await p.waitForTimeout(400); }
  await p.screenshot({ path: '/tmp/claude-0/shots/end-' + arm + '.png' });
  console.log('errors: ' + (errs.length ? errs.join('; ') : 'none'));
  await b.close();
})();
