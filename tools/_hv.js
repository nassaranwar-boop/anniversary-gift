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
  await p.evaluate(() => document.getElementById('hub-card-quest').click());
  await p.waitForSelector('#screen-quest.active .hv-stage', { timeout: 30000 });
  const dump = () => p.evaluate(() => {
    const btns = [].map.call(document.querySelectorAll('#screen-quest button'), (e) => {
      const r = e.getBoundingClientRect();
      return (e.id || e.className).slice(0,22) + '"' + (e.textContent||'').trim().slice(0,16) + '" ' + Math.round(r.width) + 'x' + Math.round(r.height); });
    return JSON.stringify({ note: (document.getElementById('hv-note')||{}).textContent.slice(0,40),
      node: window.hvNode || (window.HV && HV.node) || null, btns: btns }); });
  for (let i = 0; i < 5; i++) {
    await p.waitForTimeout(1200);
    console.log(i, await dump());
    await p.evaluate(() => { const b2 = document.querySelector('#hv-left .hv-btn, #hv-centre .hv-btn, #hv-right .hv-btn, #hv-cards .hv-card');
      if (b2) b2.click(); });
  }
  await b.close();
})();
