/* THE FILM IS NOT SKIPPABLE, AND THERE IS ALWAYS A WAY OUT.

   Two things he asked for and one trap between them.

   1. No key and no touch may jump a cut. USE used to run any finite
      cut to its end after two seconds -- the drive is fifty-two of
      them -- so one press of space threw the whole scene away.
   2. The pause button is on screen from the first level to the end of
      the roof. It used to go out during every cut AND during every
      line of dialogue, which between them is most of the chapter.

   The trap: making the button visible during a cut is worthless if
   pressing it does nothing, and worse than worthless if the film keeps
   running behind the card. Both are checked.
*/
const { boot, reporter, driver } = require('./_aplib');

(async () => {
  const { browser, page, errs } = await boot();
  const R = reporter(), ok = R.ok, D = driver(page);

  const st = () => page.evaluate(() => window.__apState());
  const cutT = async () => { const s = await st(); return s.cut ? s.cut.t : null; };
  const vis = (sel) => page.evaluate(s => {
    const e = document.querySelector(s);
    if (!e || e.offsetParent === null) return null;
    const r = e.getBoundingClientRect(), cs = getComputedStyle(e);
    const hit = document.elementFromPoint(r.left + r.width/2, r.top + r.height/2);
    return { op: +cs.opacity, pe: cs.pointerEvents, h: Math.round(r.height),
             hits: !!(hit && (hit === e || e.contains(hit))) };
  }, sel);

  /* ---- into the drive, the longest cut in the chapter ---- */
  await D.enter(3); await D.talk(3);
  await D.at('C'); await D.talk(6); await D.pump(2);
  let s = await st();
  ok('the drive is playing', s.state === 'cine' && !!s.cut, 'state=' + s.state);
  ok('and it is a long one', s.cut && s.cut.duration > 20, s.cut ? s.cut.duration + 's' : '');

  /* every way she could try to get out of it */
  const before = await cutT();
  /* Escape is deliberately NOT in this list: it opens the pause card,
     which is a way out rather than a skip, and pressing it here left
     the card covering the button every check that followed. */
  await page.keyboard.press('Space');
  await page.keyboard.press('Enter');
  await page.keyboard.press('KeyE');
  await page.evaluate(() => { window.__apKey('use', 1); window.__apPump(1/60, 8); window.__apKey('use', 0); });
  await page.evaluate(() => {
    const cv = document.querySelector('#ap-stage canvas') || document.body;
    ['pointerdown','pointerup','click','touchstart','touchend'].forEach(t => {
      try { cv.dispatchEvent(new Event(t, { bubbles: true })); } catch (e) {}
    });
  });
  await D.pump(1);
  const after = await cutT();
  s = await st();
  ok('no key and no touch skips it',
     s.state === 'cine' && !!s.cut && after < s.cut.duration - 1,
     'still at ' + (after || 0).toFixed(1) + 's of ' + (s.cut ? s.cut.duration : '?'));

  /* ---- and the way out is on screen while it plays ---- */
  const pb = await vis('#ap-pause-btn');
  ok('the pause button is on screen during the cut', !!pb && pb.op > 0.5 && pb.pe !== 'none',
     pb ? 'opacity ' + pb.op + ', ' + pb.pe : 'not rendered');
  ok('and it is a thumb big', !!pb && pb.h >= 40, pb ? pb.h + 'px' : '');
  ok('and a tap at its middle lands on it', !!pb && pb.hits);

  /* pressing it must actually pause, and the film must stop with it */
  await page.evaluate(() => document.getElementById('ap-pause-btn').click());
  await page.waitForTimeout(300);
  ok('pressing it puts the card up', await D.has('.ap-card'));
  const held = await cutT();
  await page.evaluate(() => window.__apPump(1/60, 120));   /* two seconds of loop */
  const stillHeld = await cutT();
  ok('and the film does not run on behind it',
     Math.abs((stillHeld || 0) - (held || 0)) < 0.05,
     'moved ' + Math.abs((stillHeld || 0) - (held || 0)).toFixed(2) + 's while paused');

  await D.click('.ap-card-go');
  await page.waitForTimeout(300);
  await D.pump(1);
  s = await st();
  ok('and it picks the cut back up where it stopped', s.state === 'cine',
     'state=' + s.state + ', t=' + (s.cut ? s.cut.t.toFixed(1) : '-'));

  /* ---- the same for the ride, and the roof at the end ---- */
  await D.skipCut();
  await D.at('H'); await D.talk(10); await D.pump(2);
  s = await st();
  if (s.state === 'cine') {
    const t0 = await cutT();
    await page.keyboard.press('Space');
    await page.evaluate(() => { window.__apKey('use', 1); window.__apPump(1/60, 8); window.__apKey('use', 0); });
    await D.pump(1);
    s = await st();
    ok('the ride cannot be skipped either', s.state === 'cine', 'state=' + s.state);
    const p2 = await vis('#ap-pause-btn');
    ok('and the way out is on screen there too', !!p2 && p2.op > 0.5 && p2.pe !== 'none');
  }

  /* ---- and while anybody is talking ---- */
  await page.evaluate(() => window.__apClear());
  await D.enter(0);
  await page.evaluate(() => window.__apSay && window.__apSay());
  await D.at('T');
  await page.waitForTimeout(300);
  const p3 = await vis('#ap-pause-btn');
  ok('the pause button is there while they are talking too',
     !!p3 && p3.op > 0.5 && p3.pe !== 'none', p3 ? 'opacity ' + p3.op : 'not rendered');

  await R.done(browser, errs);
})();
