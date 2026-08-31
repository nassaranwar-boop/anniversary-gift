/* Level 3: power the ward doors, wake him, and get the two of them behind
   a door that shuts. */
const { chromium } = require('playwright-core');
const clicks = async (p, n) => { for (let i=0;i<n;i++){ await p.evaluate(()=>{const b=document.getElementById('ap-dlg-next'); if(b&&document.getElementById('ap-dlg').getAttribute('aria-hidden')==='false') b.click();}); await p.waitForTimeout(60);} };
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox','--no-proxy-server','--disable-gpu'] });
  const p = await b.newPage({ viewport: { width: 1180, height: 820 } });
  p.on('pageerror', e => console.log('PAGEERROR', e.message));
  await p.route('**/*', r => r.request().url().startsWith('http://127.0.0.1') ? r.continue() : r.abort());
  await p.goto('http://127.0.0.1:8899/index.html', { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(900);
  await p.evaluate(() => { showScreen('apoc'); Apocalypse.start(); window.__apEnter(2); });
  await clicks(p, 4);

  // ward doors, before the power
  await p.evaluate(() => { window.__apTeleport(20, 5); window.__apUse(); });
  await p.waitForTimeout(200);
  console.log('shut doors say:', await p.evaluate(() => document.getElementById('ap-dlg-text').textContent));
  await clicks(p, 2);

  // the plant room panel
  await p.evaluate(() => { window.__apTeleport(5, 5); window.__apUse(); });
  await p.waitForTimeout(300);
  console.log('panel title:', await p.evaluate(() => { const t=document.querySelector('.ap-panel-title'); return t && t.textContent; }));
  await p.evaluate(() => window.__apSolvePanel());
  await p.waitForTimeout(1900);
  await clicks(p, 2);
  console.log('ward doors:', await p.evaluate(() => window.__apState().doors.filter(d=>d.includes('power')).join()));

  // him
  await p.evaluate(() => { window.__apTeleport(30, 6); window.__apPump(0.4, {}); });
  await p.waitForTimeout(250);
  console.log('woken:', await p.evaluate(() => window.__apState().anwar));
  console.log('first line:', await p.evaluate(() => document.getElementById('ap-dlg-text').textContent));
  await clicks(p, 8);

  // he follows her
  const f = await p.evaluate(() => { window.__apPump(4, { left: true }); return window.__apState().anwar; });
  console.log('he follows to:', f);

  // and the supply room
  const r = await p.evaluate(() => { window.__apTeleport(3, 16); window.__apPump(0.3, {}); return window.__apState(); });
  console.log('state at the supply room:', r.state, '| step was:', r.step);
  console.log('hiding line:', await p.evaluate(() => document.getElementById('ap-dlg-text').textContent));
  await clicks(p, 24);
  console.log('after the beat:', await p.evaluate(() => ({ state: window.__apState().state, card: !!document.querySelector('.ap-card-title'), title: (document.querySelector('.ap-card-title')||{}).textContent })));
  await b.close();
})();
