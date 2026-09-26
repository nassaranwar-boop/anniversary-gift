/* the temporary skip button: does it end the night the way the night
   ends, and does the next one unlock */
const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox','--no-proxy-server','--use-gl=swiftshader','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required'] });
  const p = await b.newPage({ viewport: { width: 900, height: 600 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.route('**/*', r => r.request().url().startsWith('http://127.0.0.1') ? r.continue() : r.abort());
  await p.goto('http://127.0.0.1:8899/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.evaluate(() => { try { localStorage.clear(); localStorage.setItem('ns_notutor','1'); } catch(e){}
    showScreen('nightshift'); return loadChapter('nightshift').then(() => OuissysNightShift.start()); });
  await p.waitForFunction(() => { try { return !!OuissysNightShift.__night.cast().jax; } catch(e){ return false; } },
                          null, { timeout: 180000, polling: 500 });
  const out = await p.evaluate(async () => {
    const N = OuissysNightShift.__night, G = () => N.state();
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const log = [];
    const done = () => { try { return Object.keys(JSON.parse(localStorage.getItem('ns_nights')||'{}')); } catch(e){ return []; } };
    N.begin(1); N.midEnd();
    await sleep(400);
    const el = document.getElementById('ns-skip');
    log.push('button exists: ' + !!el + ', visible during a shift: ' + (el ? !el.hidden : 'n/a'));
    const before = { phase: G().phase, night: G().night, done: done() };
    if (el) el.click();
    await sleep(1200);
    const after = { phase: G().phase, night: G().night, done: done() };
    log.push('before: phase ' + before.phase + ' night ' + before.night + ' done [' + before.done + ']');
    log.push('after:  phase ' + after.phase + ' night ' + after.night + ' done [' + after.done + ']');
    /* and the card it leaves is the real one */
    const btns = [].slice.call(document.querySelectorAll('#ns-overlay [data-go]'));
    log.push('the card offers: ' + (btns.map(x => x.innerText.trim()).join(' / ') || 'nothing yet'));
    /* it must not be pressable when there is no shift */
    N.route('title');
    await sleep(500);
    log.push('on the title the button is hidden: ' + (el ? el.hidden : 'n/a'));
    return { log, ok: after.phase === 'shift' && after.done.indexOf('1') >= 0 };
  });
  out.log.forEach(l => console.log('  ' + l));
  console.log('\n  ' + (out.ok ? 'PASS  it ends the night the real way and unlocks the next'
                                : 'FAIL  it did not end the night properly'));
  console.log('  ' + (errs.length ? 'FAIL  threw: ' + errs[0] : 'PASS  nothing threw'));
  await b.close();
  process.exit(out.ok && !errs.length ? 0 : 1);
})();
