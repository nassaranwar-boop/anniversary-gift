/* Does the stealth actually work? Drive it and assert, rather than hoping. */
const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox','--no-proxy-server','--disable-gpu'] });
  const p = await b.newPage({ viewport: { width: 1180, height: 820 } });
  p.on('pageerror', e => console.log('PAGEERROR', e.message));
  await p.route('**/*', r => r.request().url().startsWith('http://127.0.0.1') ? r.continue() : r.abort());
  await p.goto('http://127.0.0.1:8899/index.html', { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(1000);
  const out = await p.evaluate(() => {
    const R = [];
    showScreen('apoc'); Apocalypse.start();
    const info = window.__apEnter(0);
    R.push(['level builds', info]);

    // 1. a wall stops her
    window.__apTeleport(4, 3);
    const before = window.__apPump(0.1, {});
    const wall = window.__apPump(2, { left: true });
    R.push(['wall stops her', wall.x > 0 && wall.x < before.x + 4]);

    // 2. a plain door opens by being walked into
    window.__apTeleport(5, 5);
    window.__apPump(2.5, { down: true });
    const st = window.__apState();
    R.push(['door opened', st.doors.filter(d => d.includes('open')).length]);

    // 3. hiding: standing in an h tile reports hidden
    window.__apTeleport(2, 1);
    const hid = window.__apPump(0.2, {});
    R.push(['wardrobe hides her', hid.hidden]);

    // 4. a zombie catches her when she stands on it unhidden
    const z = window.__apZombies();
    window.__apTeleport(Math.round(z[0].x / 16), Math.round(z[0].y / 16));
    const c = window.__apPump(0.5, {});
    R.push(['caught triggers', c.state, 'closeCalls=' + c.closeCalls]);

    // 5. and she recovers on her own
    const rec = window.__apPump(3, {});
    R.push(['recovers to play', rec.state]);

    // 6. hidden next to a zombie is NOT caught
    window.__apEnter(0);
    const z2 = window.__apZombies();
    window.__apTeleport(2, 1);           // the wardrobe
    window.__apMoveZombie(0, 2, 1);      // put one right on top of her
    const safe = window.__apPump(1, {});
    R.push(['hidden is safe', safe.state === 'play', 'hidden=' + safe.hidden]);
    return R;
  });
  out.forEach(r => console.log(...r));
  await b.close();
})();
