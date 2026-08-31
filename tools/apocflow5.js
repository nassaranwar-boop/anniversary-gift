/* Level 5: up to the gate, through the check, the serum, and inside. */
const { chromium } = require('playwright-core');
const clicks = async (p,n) => { for(let i=0;i<n;i++){ await p.evaluate(()=>{const b=document.getElementById('ap-dlg-next'); if(b&&document.getElementById('ap-dlg').getAttribute('aria-hidden')==='false') b.click();}); await p.waitForTimeout(50);} };
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox','--no-proxy-server','--disable-gpu'] });
  const p = await b.newPage({ viewport: { width: 1180, height: 820 } });
  p.on('pageerror', e => console.log('PAGEERROR', e.message));
  await p.route('**/*', r => r.request().url().startsWith('http://127.0.0.1') ? r.continue() : r.abort());
  await p.goto('http://127.0.0.1:8899/index.html', { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(900);
  await p.evaluate(() => { showScreen('apoc'); Apocalypse.start(); window.__apEnter(4, true); });
  await clicks(p, 6);
  console.log('gates shut:', await p.evaluate(() => window.__apState().doors.join(' ')));

  await p.evaluate(() => { window.__apTeleport(13, 10); window.__apUse(); });
  await p.waitForTimeout(200);
  console.log('hail:', await p.evaluate(() => document.getElementById('ap-dlg-text').textContent));
  await clicks(p, 6);
  console.log('after hail, step:', await p.evaluate(() => window.__apState().step));

  await p.evaluate(() => { window.__apTeleport(20, 9); window.__apUse(); });
  await p.waitForTimeout(250);
  console.log('check card:', await p.evaluate(() => !!document.querySelector('.ap-check')));
  const rows = await p.$$('.ap-check-row');
  for (const r of rows) await r.click();
  await p.waitForTimeout(150);
  console.log('stamped clear:', await p.evaluate(() => { const s=document.querySelector('.ap-check-stamp'); return s && !s.hidden; }));
  await p.click('.ap-check .ap-note-ok');
  await p.waitForTimeout(300);
  console.log('serum card:', await p.evaluate(() => !!document.querySelector('.ap-serum-canvas')));
  await p.click('.ap-serum .ap-note-ok');
  await p.waitForTimeout(2600);
  await p.click('.ap-serum .ap-note-ok');
  await p.waitForTimeout(300);
  console.log('gates now:', await p.evaluate(() => window.__apState().doors.join(' ')));
  await clicks(p, 6);
  const r = await p.evaluate(() => { window.__apTeleport(32, 10); window.__apPump(0.3, {}); return window.__apState(); });
  console.log('at X:', r.state);
  await clicks(p, 6);
  console.log('end card:', await p.evaluate(() => { const t=document.querySelector('.ap-card-title'); return t && t.textContent; }));
  console.log('chapter marked done:', await p.evaluate(() => { try { return JSON.parse(localStorage.getItem('fal_chapters_done')||'{}').apoc === true; } catch(e){ return 'n/a'; } }));
  await b.close();
})();
