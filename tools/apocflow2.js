/* Level 2: find the note, use the code on the staff gate, reach the hospital. */
const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox','--no-proxy-server','--disable-gpu'] });
  const p = await b.newPage({ viewport: { width: 1180, height: 820 } });
  p.on('pageerror', e => console.log('PAGEERROR', e.message));
  await p.route('**/*', r => r.request().url().startsWith('http://127.0.0.1') ? r.continue() : r.abort());
  await p.goto('http://127.0.0.1:8899/index.html', { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(900);
  await p.evaluate(() => { showScreen('apoc'); Apocalypse.start(); window.__apEnter(1); });

  // the gate, before she has the code
  await p.evaluate(() => { window.__apTeleport(31, 20); window.__apUse(); });
  await p.waitForTimeout(250);
  console.log('gate without a code says:', await p.evaluate(() => document.getElementById('ap-dlg-text').textContent));
  await p.evaluate(() => { const n = document.getElementById('ap-dlg-next'); if (n) n.click(); });

  // the note, in the shop
  await p.evaluate(() => { window.__apTeleport(11, 21); window.__apUse(); });
  await p.waitForTimeout(250);
  console.log('note shown:', await p.evaluate(() => { const n = document.querySelector('.ap-note-code'); return n && n.textContent; }));
  await p.click('.ap-note-ok');
  await p.waitForTimeout(200);
  for (let i = 0; i < 3; i++) { await p.evaluate(() => { const n = document.getElementById('ap-dlg-next'); if (n) n.click(); }); await p.waitForTimeout(100); }
  console.log('carrying code:', await p.evaluate(() => window.__apState().code));

  // now the gate takes it
  await p.evaluate(() => { window.__apTeleport(31, 20); window.__apUse(); });
  await p.waitForTimeout(250);
  console.log('keypad up:', await p.evaluate(() => !!document.querySelector('.ap-keypad')));
  for (const d of '4180') await p.click(`.ap-keypad-pad .ap-key-btn:nth-child(${d === '0' ? 11 : +d})`);
  await p.click('.ap-key-btn.go');
  await p.waitForTimeout(300);
  console.log('gate open:', await p.evaluate(() => window.__apState().doors.filter(d => d.includes('locked')).join()));

  // and out through the car park to the hospital
  const r = await p.evaluate(() => {
    window.__apTeleport(35, 25);
    window.__apPump(2.5, { down: true });
    window.__apTeleport(44, 28);
    window.__apPump(0.3, {});
    return window.__apState();
  });
  console.log('after reaching X:', r.state);
  await b.close();
})();
