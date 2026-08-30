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

  /* Two separate questions, and the old test confused them.

     One: does a keypress actually reach the game? That is answered by
     reading the key state while the key is down, and it is exact.

     Two: does she move? That depends on the frame rate, and this container
     gives about two frames a second even on a blank page — so a fixed
     wall-clock hold proves very little. She is put somewhere with room
     around her first, and held for long enough that even two frames a
     second has to show something. */
  for (const [key, label, dx, dy] of [
    ['ArrowRight', 'ArrowRight', 1, 0], ['ArrowLeft', 'ArrowLeft', -1, 0],
    ['ArrowDown', 'ArrowDown', 0, 1], ['ArrowUp', 'ArrowUp', 0, -1],
    ['d', 'd (WASD)', 1, 0], ['a', 'a (WASD)', -1, 0],
    ['s', 's (WASD)', 0, 1], ['w', 'w (WASD)', 0, -1],
  ]) {
    // the middle of the landing, which is open in every direction
    await p.evaluate(() => window.__apTeleport(16, 8));
    const before = await at();
    await p.keyboard.down(key);
    await p.waitForTimeout(120);
    const held = await p.evaluate(() => JSON.stringify(window.__apKeys()));
    await p.waitForTimeout(2600);
    await p.keyboard.up(key);
    await p.waitForTimeout(150);
    const after = await at();
    const moved = (after.x - before.x) * dx + (after.y - before.y) * dy;
    const registered = JSON.parse(held);
    const keyOn = registered.left || registered.right || registered.up || registered.down;
    console.log(`${label.padEnd(11)} key reaches the game: ${keyOn ? 'yes' : 'NO'}   she travelled ${Math.round(moved)}px ${moved > 5 ? 'OK' : '*** NOT MOVING ***'}`);
  }

  // and the modifier
  await p.evaluate(() => window.__apTeleport(16, 8));
  await p.keyboard.down('Shift');
  await p.waitForTimeout(150);
  const sneak = await p.evaluate(() => window.__apKeys().sneak);
  await p.keyboard.up('Shift');
  console.log(`SHIFT       key reaches the game: ${sneak ? 'yes' : 'NO'}   (creep)`);

  const fps = await p.evaluate(() => new Promise(res => {
    let n = 0; const t0 = performance.now();
    (function tick() { n++; if (performance.now() - t0 < 1000) requestAnimationFrame(tick); else res(n); })();
  }));
  console.log('frames the page manages in one second:', fps);
  await b.close();
})();
