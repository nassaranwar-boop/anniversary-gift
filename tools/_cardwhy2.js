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

  const chain = async (label) => {
    await p.waitForTimeout(700);
    const r = await p.evaluate(() => {
      const o = document.getElementById('ns-overlay');
      const card = o.querySelector('[class*="ns-card"]');
      const out = [];
      let el = card || o;
      while (el && el !== document.documentElement) {
        const cs = getComputedStyle(el), b = el.getBoundingClientRect();
        out.push((el.tagName + '#' + (el.id||'') + '.' + (el.className||'')).slice(0, 44)
          + ' ' + Math.round(b.width) + 'x' + Math.round(b.height)
          + ' disp=' + cs.display + ' vis=' + cs.visibility + ' op=' + cs.opacity + ' hidden=' + el.hidden);
        el = el.parentElement;
      }
      return { phase: OuissysNightShift.__night.state().phase, chain: out.join('\n  ') };
    });
    console.log('=== ' + label + ' phase=' + r.phase + '\n  ' + r.chain);
  };

  // exact cardfit order for the tail
  await p.evaluate(() => { const N = OuissysNightShift.__night; N.route('title'); N.route('start'); });
  await p.waitForTimeout(400);
  await p.evaluate(() => { const N = OuissysNightShift.__night; N.begin(2); N.midEnd(); });
  await p.waitForTimeout(400);
  await p.evaluate(() => { const N = OuissysNightShift.__night; N.begin(3); N.midEnd();
    const c = N.cast(), G = N.state();
    Object.keys(c).forEach((k) => { c[k].asleep = true; c[k].awake = false; });
    const j = c.jax; j.asleep = false; j.awake = true; j.wound = 9;
    j.step = j.def.route.length - 2; N.syncOne('jax');
    G.doors.left = G.doors.right = G.doors.hatch = false;
    for (let i = 0; i < 900 && G.phase === 'play'; i++) N.pumpFrame(0.05); });
  await chain('game over attempt');
  await p.evaluate(() => { const N = OuissysNightShift.__night; N.begin(4); const G = N.state();
    const c = N.cast(); Object.keys(c).forEach((k) => { c[k].asleep = true; });
    G.hour = 5; G.power = 70; N.pump(70); });
  await chain('six o clock after it');
  await b.close();
})();
