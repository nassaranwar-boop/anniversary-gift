const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox','--no-proxy-server','--use-gl=swiftshader','--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true });
  p.on('pageerror', (e) => console.log('PAGEERROR', e.message.slice(0,100)));
  await p.route('**/*', (r) => r.request().url().startsWith('http://127.0.0.1') ? r.continue() : r.abort());
  await p.goto('http://127.0.0.1:8899/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForTimeout(800);
  await p.evaluate(() => { showScreen('hub'); if (window.startHub) startHub(); });
  await p.waitForTimeout(500);
  await p.evaluate(() => document.getElementById('hub-card-race').click());
  await p.waitForSelector('#screen-race.active #race-canvas', { timeout: 30000 });
  await p.waitForTimeout(3000);
  const click = async (s) => { await p.evaluate((q) => { const e = document.querySelector('#screen-race ' + q); if (e) e.click(); }, s); await p.waitForTimeout(700); };
  for (const s of ['[data-go="single"]','[data-char="0"]','[data-next="chars"]','[data-track="0"]','[data-next="tracks"]']) await click(s);
  await p.waitForTimeout(6000);
  console.log(await p.evaluate(() => {
    const d = window.__RACE_DEBUG();
    const me = d.racers.filter(x => x.isPlayer)[0] || d.racers[0];
    const gas = document.querySelector('#screen-race [data-k="up"]');
    const r = gas.getBoundingClientRect();
    const hit = document.elementFromPoint(r.left + r.width/2, r.top + r.height/2);
    const chain = []; let e = hit; while (e && chain.length < 5) { chain.push(e.tagName + '#' + (e.id||'') + '.' + (e.className||'')); e = e.parentElement; }
    return JSON.stringify({ state: d.state, keys: Object.keys(me).slice(0, 40),
      gas: [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)],
      chain: chain, zGas: getComputedStyle(gas).zIndex, zHit: hit ? getComputedStyle(hit).zIndex : null }, null, 1);
  }));
  await b.close();
})();
