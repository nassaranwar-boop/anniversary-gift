/* DOES SHE MOVE WHEN A PERSON PRESSES A KEY?

   Everything else in this folder drives the world with __apPump, which
   sets the keys itself and steps the fixed timestep by hand -- so it
   proves the physics and proves nothing at all about whether a keypress
   reaches them. This comes in through the hub the way she does, presses
   real keys at the page, and drives the real loop.

   The one thing it may not do is judge her by wall-clock travel:
   headless throttles rAF to two or three frames a second, so a hold of
   any length proves nothing about speed. It reads the key state while
   the key is down -- which is exact -- and then advances the world
   itself to see that the held key is what moves her. */
const { boot, reporter, driver } = require('./_aplib');

const KEYS = [
  ['ArrowRight', 'right', 1, 0], ['ArrowLeft', 'left', -1, 0],
  ['ArrowDown', 'down', 0, 1], ['ArrowUp', 'up', 0, -1],
  ['d', 'right', 1, 0], ['a', 'left', -1, 0],
  ['s', 'down', 0, 1], ['w', 'up', 0, -1],
];

(async () => {
  const { browser, page, errs } = await boot();
  const R = reporter(), ok = R.ok, D = driver(page);

  /* in from the hub, exactly as she does it */
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} showScreen('hub'); startHub(); });
  await page.waitForTimeout(300);
  await page.evaluate(() => document.getElementById('hub-card-apoc').click());
  ok('the hub card opens the chapter',
     await D.until(() => document.getElementById('screen-apoc').classList.contains('active'), 12000));
  for (let i = 0; i < 6; i++) {
    const went = await D.click('.ap-card-go');
    if (!went) break;
    if (await page.evaluate(() => !!(window.__apPos && window.__apPos()))) break;
  }
  ok('and the cards lead into a level she is standing in',
     await D.until(() => !!(window.__apPos && window.__apPos()), 15000));
  for (let i = 0; i < 8; i++) { await page.keyboard.press('Space'); await page.waitForTimeout(90); }
  await page.evaluate(() => window.__apClear());

  const pos = () => page.evaluate(() => window.__apPos());
  for (const [key, dir, dx, dy] of KEYS) {
    await page.evaluate(() => window.__apTeleport(16, 8));
    await page.keyboard.down(key);
    await page.waitForTimeout(140);
    const held = await page.evaluate(() => window.__apKeys());
    ok('"' + key + '" reaches the game as ' + dir, !!held[dir], JSON.stringify(held));
    /* and it is that key that moves her: the loop is throttled here, so
       the world is advanced by hand while the key is genuinely down */
    const before = await pos();
    await page.evaluate(() => window.__apPump(1 / 60, 40));
    const after = await pos();
    await page.keyboard.up(key);
    await page.waitForTimeout(80);
    const moved = (after.x - before.x) * dx + (after.y - before.y) * dy;
    ok('and holding it walks her that way', moved > 3, Math.round(moved) + 'px');
  }

  await page.keyboard.down('Shift');
  await page.waitForTimeout(140);
  ok('shift reaches the game as the creep',
     await page.evaluate(() => !!window.__apKeys().sneak));
  await page.keyboard.up('Shift');

  /* and it lets go */
  await page.waitForTimeout(150);
  ok('and every key is released when she lets go',
     await page.evaluate(() => { const k = window.__apKeys();
                                 return !k.left && !k.right && !k.up && !k.down && !k.sneak; }));

  await R.done(browser, errs);
})();
