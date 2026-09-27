const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox','--no-proxy-server','--use-gl=swiftshader','--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true });
  p.on('pageerror', (e) => console.log('PAGEERROR', e.message.slice(0,120)));
  await p.route('**/*', (r) => r.request().url().startsWith('http://127.0.0.1') ? r.continue() : r.abort());
  await p.goto('http://127.0.0.1:8899/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.evaluate(() => { localStorage.setItem('ns_seenintro','1'); localStorage.setItem('ns_terms','1');
    localStorage.setItem('ns_notutor','1');
    localStorage.setItem('ns_nights', JSON.stringify({1:1,2:1,3:1,4:1,5:1,6:1}));
    showScreen('nightshift'); return loadChapter('nightshift').then(() => OuissysNightShift.start()); });
  await p.waitForFunction(() => window.OuissysNightShift && OuissysNightShift.__night, { timeout: 25000, polling: 200 });
  await p.evaluate(() => { const N = OuissysNightShift.__night; N.begin(6); const G = N.state();
    const c = N.cast(); Object.keys(c).forEach((k) => { c[k].asleep = true; });
    G.hour = 5; G.power = 60; N.pump(70); N.filmSeek(999); N.route('finaleDone'); });
  await p.waitForTimeout(1500);
  console.log(await p.evaluate(() => {
    const o = document.getElementById('ns-overlay');
    const card = o.querySelector('.ns-card');
    const cs = getComputedStyle(card), cr = card.getBoundingClientRect();
    const oc = getComputedStyle(o), orr = o.getBoundingClientRect();
    const rows = [];
    [].forEach.call(card.children, (e) => { const r = e.getBoundingClientRect();
      rows.push('  ' + (e.tagName + '.' + e.className).slice(0,26) + ' ' + Math.round(r.top) + '..' + Math.round(r.bottom) + ' h' + Math.round(r.height)); });
    const btn = card.querySelector('[data-go="endWind"]').getBoundingClientRect();
    return JSON.stringify({ vh: innerHeight,
      overlay: { h: Math.round(orr.height), top: Math.round(orr.top), disp: oc.display, align: oc.alignItems, pad: oc.padding, clientH: o.clientHeight },
      card: { rect: [Math.round(cr.top), Math.round(cr.bottom), Math.round(cr.height)],
              off: card.offsetHeight, scroll: card.scrollHeight, mh: cs.maxHeight, ov: cs.overflowY,
              tr: card.style.transform, cls: card.className },
      btn: [Math.round(btn.top), Math.round(btn.bottom), Math.round(btn.left), Math.round(btn.right)] }, null, 1) + '\n' + rows.join('\n');
  }));
  await b.close();
})();
