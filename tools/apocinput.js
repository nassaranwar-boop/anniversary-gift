/* Does she actually move when a person presses a key?

   Every previous test drove the world with __apPump, which sets the keys
   itself and steps the fixed timestep by hand — so it proves the physics
   and proves nothing at all about whether a keypress reaches them. This
   presses real keys at the page and watches the real loop, which is the
   only way to answer the question that was asked. */
const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox','--no-proxy-server','--disable-gpu'] });
  const p = await b.newPage({ viewport: { width: 1180, height: 820 } });
  p.on('pageerror', e => console.log('PAGEERROR', e.message));
  await p.route('**/*', r => r.request().url().startsWith('http://127.0.0.1') ? r.continue() : r.abort());
  await p.goto('http://127.0.0.1:8899/index.html', { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(1000);

  await p.evaluate(() => { try { localStorage.clear(); } catch (e) {} showScreen('hub'); startHub(); });
  await p.waitForTimeout(200);
  await p.click('#hub-card-apoc');
  await p.waitForTimeout(1200);
  await p.evaluate(() => document.querySelector('.ap-card-go').click());   // how-to
  await p.waitForTimeout(300);
  await p.evaluate(() => document.querySelector('.ap-card-go').click());   // level 1
  await p.waitForTimeout(600);
  // clear the opening dialogue the way a person would: press the key
  for (let i = 0; i < 6; i++) { await p.keyboard.press('Space'); await p.waitForTimeout(120); }

  const at = () => p.evaluate(() => {
    const s = window.__apState ? window.__apState() : {};
    return { x: Math.round(window.__apPos().x), y: Math.round(window.__apPos().y), state: s.state };
  });

  console.log('state before pressing anything:', JSON.stringify(await at()));

  for (const [key, label] of [['ArrowRight','ArrowRight'], ['ArrowDown','ArrowDown'], ['d','d (WASD)'], ['s','s (WASD)']]) {
    const before = await at();
    await p.keyboard.down(key);
    await p.waitForTimeout(1500);            // real time, real rAF
    await p.keyboard.up(key);
    await p.waitForTimeout(120);
    const after = await at();
    const moved = Math.hypot(after.x - before.x, after.y - before.y);
    console.log(`hold ${label} for 1.5s -> moved ${Math.round(moved)}px`, moved > 6 ? 'OK' : '*** SHE DID NOT MOVE ***');
  }

  // how many frames the loop is actually managing
  const fps = await p.evaluate(() => new Promise(res => {
    let n = 0; const t0 = performance.now();
    (function tick() { n++; if (performance.now() - t0 < 1000) requestAnimationFrame(tick); else res(n); })();
  }));
  console.log('frames the page manages in one second:', fps);
  await b.close();
})();
