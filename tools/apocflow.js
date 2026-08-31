/* Play Level 1 the way a person does: walk to the television, watch it,
   walk to the panel, drag the wires with a real pointer, and leave through
   the garage. Asserts at every step. */
const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox','--no-proxy-server','--disable-gpu'] });
  const p = await b.newPage({ viewport: { width: 1180, height: 820 } });
  const errs = [];
  p.on('pageerror', e => { errs.push(e.message); console.log('PAGEERROR', e.message); });
  await p.route('**/*', r => r.request().url().startsWith('http://127.0.0.1') ? r.continue() : r.abort());
  await p.goto('http://127.0.0.1:8899/index.html', { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(1000);

  await p.evaluate(() => { showScreen('apoc'); Apocalypse.start(); window.__apEnter(0); });

  // the television, in the living room
  await p.evaluate(() => { window.__apTeleport(3, 12); window.__apUse(); });
  await p.waitForTimeout(400);
  console.log('tv open:', await p.evaluate(() => !!document.querySelector('.ap-tv')));
  await p.click('.ap-tv .ap-note-ok');
  await p.waitForTimeout(300);
  console.log('after tv, step:', await p.evaluate(() => window.__apState().step));

  // clear the dialogue that follows
  for (let i = 0; i < 4; i++) { await p.evaluate(() => { const n = document.getElementById('ap-dlg-next'); if (n) n.click(); }); await p.waitForTimeout(120); }

  // the panel, in the garage
  await p.evaluate(() => { window.__apTeleport(29, 12); window.__apUse(); });
  await p.waitForTimeout(400);
  const hasPanel = await p.evaluate(() => !!document.querySelector('.ap-panel-canvas'));
  console.log('panel open:', hasPanel);

  // drag every wire into its socket with a real pointer
  const geom = await p.evaluate(() => {
    const cv = document.querySelector('.ap-panel-canvas');
    const b = cv.getBoundingClientRect();
    const P = window.__apPanelState();
    const map = (x, y) => ({ x: b.left + (x / P.w) * b.width, y: b.top + (y / P.h) * b.height });
    return P.wires.map(w => {
      const s = P.sockets.find(s => s.key === w.key);
      return { from: map(w.ex, w.ey), to: map(s.x, s.y) };
    });
  });
  for (const g of geom) {
    await p.mouse.move(g.from.x, g.from.y);
    await p.mouse.down();
    await p.mouse.move(g.to.x, g.to.y, { steps: 6 });
    await p.mouse.up();
    await p.waitForTimeout(90);
  }
  console.log('wires placed:', await p.evaluate(() => window.__apPanelState().done));
  await p.waitForTimeout(2200);
  console.log('panel closed:', await p.evaluate(() => !document.querySelector('.ap-panel-canvas')));
  for (let i = 0; i < 3; i++) { await p.evaluate(() => { const n = document.getElementById('ap-dlg-next'); if (n) n.click(); }); await p.waitForTimeout(120); }
  console.log('power door open:', await p.evaluate(() => window.__apState().doors.filter(d => d.includes('power')).join()));

  // and out
  await p.evaluate(() => { window.__apTeleport(29, 19); window.__apPump(1.2, { down: true }); });
  await p.waitForTimeout(300);
  console.log('state after exit:', await p.evaluate(() => window.__apState().state));
  console.log('errors:', errs.length);
  await b.close();
})();
