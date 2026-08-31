/* Level 4: out of the hospital, get the car going, the drive, the lane,
   the horse, and the ride to the gates. */
const { chromium } = require('playwright-core');
const clicks = async (p, n) => { for (let i=0;i<n;i++){ await p.evaluate(()=>{const b=document.getElementById('ap-dlg-next'); if(b&&document.getElementById('ap-dlg').getAttribute('aria-hidden')==='false') b.click();}); await p.waitForTimeout(50);} };
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox','--no-proxy-server','--disable-gpu'] });
  const p = await b.newPage({ viewport: { width: 1180, height: 820 } });
  p.on('pageerror', e => console.log('PAGEERROR', e.message));
  await p.route('**/*', r => r.request().url().startsWith('http://127.0.0.1') ? r.continue() : r.abort());
  await p.goto('http://127.0.0.1:8899/index.html', { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(900);
  await p.evaluate(() => { showScreen('apoc'); Apocalypse.start(); window.__apEnter(3, true); });
  await clicks(p, 3);
  console.log('radio up:', await p.evaluate(() => !!document.querySelector('.ap-radio')));
  console.log('radio says:', await p.evaluate(() => { const l=document.querySelector('.ap-radio-line'); return l && l.textContent; }));
  await p.click('.ap-radio .ap-note-ok');
  await p.waitForTimeout(200);
  await clicks(p, 6);

  // the car
  await p.evaluate(() => { window.__apTeleport(12, 18); window.__apUse(); });
  await p.waitForTimeout(300);
  console.log('bonnet open:', await p.evaluate(() => { const t=document.querySelector('.ap-panel-title'); return t && t.textContent; }));
  await p.evaluate(() => window.__apSolvePanel());
  await p.waitForTimeout(1900);
  console.log('driving:', await p.evaluate(() => window.__apState().state));
  await p.evaluate(() => window.__apPump(10, {}));
  await p.waitForTimeout(200);
  const st = await p.evaluate(() => window.__apState());
  console.log('after the drive: map =', await p.evaluate(() => window.__apMapKey()), '| step =', st.step);
  await clicks(p, 6);

  // the horse
  await p.evaluate(() => { window.__apTeleport(38, 21); window.__apUse(); });
  await p.waitForTimeout(250);
  console.log('horse line:', await p.evaluate(() => document.getElementById('ap-dlg-text').textContent));
  await clicks(p, 12);
  console.log('riding:', await p.evaluate(() => window.__apState().state));
  await p.evaluate(() => window.__apPump(10, {}));
  await p.waitForTimeout(200);
  console.log('after the ride:', await p.evaluate(() => window.__apState().state));
  console.log('outro line:', await p.evaluate(() => document.getElementById('ap-dlg-text').textContent));
  await b.close();
})();
