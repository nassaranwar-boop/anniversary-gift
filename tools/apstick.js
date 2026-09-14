/* the thumb reports faster than the game draws: a flood of touchmoves must
   not cost more than one stick update, and must still steer her */
const { boot, reporter } = require('./_aplib');
(async () => {
  const { browser, page, errs } = await boot({ viewport: { width: 900, height: 560 } });
  const R = reporter(), ok = R.ok;
  await page.evaluate(() => window.__apEnter(1));
  await page.waitForTimeout(300);

  const res = await page.evaluate(() => {
    const st = document.getElementById('ap-stage') || document.querySelector('#screen-apoc canvas').parentNode;
    const r = st.getBoundingClientRect();
    const ox = r.left + r.width * 0.2, oy = r.top + r.height * 0.7;
    const t = (x, y, id) => ({ identifier: id, clientX: x, clientY: y });
    const fire = (type, x, y) => {
      const ev = new Event(type, { bubbles: true, cancelable: true });
      ev.changedTouches = [t(x, y, 1)];
      ev.touches = [t(x, y, 1)];
      st.dispatchEvent(ev);
    };
    fire('touchstart', ox, oy);
    const before = window.__apPos();
    /* two hundred moves in one go, the way a fast thumb arrives */
    const t0 = performance.now();
    for (let i = 0; i < 200; i++) fire('touchmove', ox + 40, oy - 40 - (i % 3));
    const flood = performance.now() - t0;
    const keysAfterFlood = JSON.stringify(window.__apKeysRead ? window.__apKeysRead() : null);
    window.__apPump(1 / 60, 30);
    const after = window.__apPos();
    fire('touchend', ox + 40, oy - 40);
    return { flood: +flood.toFixed(1), before, after,
             moved: Math.abs(after.x - before.x) + Math.abs(after.y - before.y) };
  });
  ok('two hundred touchmoves cost almost nothing', res.flood < 60, res.flood + 'ms for 200 events');
  ok('and the stick still steers her', res.moved > 0.2, JSON.stringify(res));
  await R.done(browser, errs);
})();
