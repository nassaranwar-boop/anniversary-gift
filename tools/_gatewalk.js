const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox','--no-proxy-server','--use-gl=swiftshader','--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
  p.on('pageerror', (e) => console.log('PAGEERROR', e.message.slice(0,120)));
  await p.route('**/*', (r) => r.request().url().startsWith('http://127.0.0.1') ? r.continue() : r.abort());
  await p.goto('http://127.0.0.1:8899/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForTimeout(900);
  const where = async (t) => console.log(t, await p.evaluate(() => (document.querySelector('.screen.active')||{}).id
    + ' code=' + (window.gateCode === undefined ? '?' : window.gateCode)
    + ' dots=' + [].map.call(document.querySelectorAll('#gate-code .gate-dot'), d => d.classList.contains('filled')?1:0).join('')));
  await where('start');
  await p.evaluate(() => { const c = document.getElementById('book-canvas') || document.body;
    c.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); c.click(); });
  await p.waitForTimeout(1200);
  await where('after tap');
  await p.evaluate(() => { if (!document.querySelector('#screen-gate.active')) showScreen('gate'); });
  await p.waitForTimeout(600);
  await where('at gate');
  for (const d of '2207') {
    try { await p.click(`[data-gate-key="${d}"]`, { timeout: 4000 }); }
    catch (e) { console.log('click', d, 'FAILED', e.message.slice(0,60)); }
    await p.waitForTimeout(160);
    await where('  after ' + d);
  }
  try { await p.click('#gate-submit', { timeout: 4000 }); } catch (e) { console.log('submit FAILED', e.message.slice(0,60)); }
  await p.waitForTimeout(2500);
  await where('after submit');
  console.log('err:', await p.evaluate(() => (document.getElementById('gate-error')||{}).textContent));
  await b.close();
})();
