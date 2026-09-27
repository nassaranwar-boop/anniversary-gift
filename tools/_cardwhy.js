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

  const dump = async (label) => {
    await p.waitForTimeout(600);
    const r = await p.evaluate(() => {
      const o = document.getElementById('ns-overlay');
      const rows = [];
      const walk = (el, d) => { if (d > 3) return;
        const b = el.getBoundingClientRect(), cs = getComputedStyle(el);
        rows.push('  '.repeat(d) + (el.tagName + '.' + (el.className||'')).slice(0,46)
          + ' ' + Math.round(b.width) + 'x' + Math.round(b.height)
          + ' @' + Math.round(b.left) + ',' + Math.round(b.top)
          + ' disp=' + cs.display + ' pos=' + cs.position + ' of=' + cs.overflow
          + ' mh=' + cs.maxHeight + ' tr=' + (el.style.transform || '-'));
        [].forEach.call(el.children, (c) => walk(c, d + 1)); };
      walk(o, 0);
      const pad = document.getElementById('ns-pad');
      return { phase: OuissysNightShift.__night.state().phase, err: window.__cardErr || null,
               ohidden: o.hidden, pad: pad ? (pad.hidden ? 'hidden' : 'shown ' + Math.round(pad.getBoundingClientRect().height)) : 'none',
               rows: rows.join('\n') };
    });
    console.log('=== ' + label + '  phase=' + r.phase + ' pad=' + r.pad + (r.err ? ' ERR ' + r.err : ''));
    console.log(r.rows);
  };

  await p.evaluate(() => { const N = OuissysNightShift.__night; N.begin(4); const G = N.state();
    const c = N.cast(); Object.keys(c).forEach((k) => { c[k].asleep = true; });
    G.hour = 5; G.power = 70; N.pump(70); });
  await dump('six o clock');

  await p.evaluate(() => { const N = OuissysNightShift.__night; N.begin(2); N.midEnd(); });
  await dump('a shift');

  await p.evaluate(() => { const N = OuissysNightShift.__night; try { N.press('monitor'); } catch(e){ window.__cardErr='press:'+e.message; }
    try { N.route('quit'); } catch(e){ window.__cardErr=(window.__cardErr||'')+' quit:'+e.message; } });
  await dump('paused');
  await b.close();
})();
