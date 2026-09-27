const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox','--no-proxy-server','--use-gl=swiftshader','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required'] });
  const p = await b.newPage({ viewport: { width: 900, height: 600 } });
  p.on('pageerror', e => console.log('PAGEERROR', e.message));
  await p.route('**/*', r => r.request().url().startsWith('http://127.0.0.1') ? r.continue() : r.abort());
  await p.goto('http://127.0.0.1:8899/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.evaluate(() => { try { localStorage.clear(); localStorage.setItem('ns_notutor','1'); } catch(e){}
    showScreen('nightshift'); return loadChapter('nightshift').then(() => OuissysNightShift.start()); });
  await p.waitForFunction(() => { try { return !!OuissysNightShift.__night.cast().jax; } catch(e){ return false; } }, { timeout: 180000, polling: 500 });
  await p.waitForTimeout(1200);
  const out = await p.evaluate(async () => {
    const N = OuissysNightShift.__night, G = () => N.state();
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const log = [];
    N.begin(5); N.midEnd(); N.catchNow('jax');
    for (let i = 0; i < 60 && !document.querySelector('#ns-overlay [data-go]'); i++) await sleep(200);
    log.push('card up, phase ' + G().phase + ', buttons ' + document.querySelectorAll('#ns-overlay [data-go]').length);
    const press = k => { const el = document.querySelector('#ns-pad [data-k="'+k+'"]'); if (!el) return;
      const r = el.getBoundingClientRect();
      const ev = ty => new PointerEvent(ty, { clientX:r.left+r.width/2, clientY:r.top+r.height/2, bubbles:true, cancelable:true, pointerId:1, isPrimary:true });
      el.dispatchEvent(ev('pointerdown')); el.dispatchEvent(ev('pointerup')); };
    const key = c => { document.dispatchEvent(new KeyboardEvent('keydown', { key:c, bubbles:true }));
                       document.dispatchEvent(new KeyboardEvent('keyup', { key:c, bubbles:true })); };
    let culprit = null;
    for (let i = 0; i < 60; i++) {
      const pk = ['left','right','hatch','monitor','next'][i % 5];
      press(pk);
      if (G().phase !== 'over') { culprit = 'pad ' + pk + ' at i=' + i; break; }
      const kk = [' ','a','d','w'][i % 4];
      key(kk);
      if (G().phase !== 'over') { culprit = 'key "' + kk + '" at i=' + i; break; }
    }
    log.push('after hammering: phase ' + G().phase + ', culprit ' + (culprit || 'none'));
    return log;
  });
  out.forEach(l => console.log('  ' + l));
  await b.close();
})();
