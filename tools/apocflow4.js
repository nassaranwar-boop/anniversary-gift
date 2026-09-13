/* LEVEL FOUR AND THE ROAD OUT OF THE CITY.

   The car in the yard, the drive, the lane where it runs out of road,
   the horse, the ride, and the clearing they stop in for the night. It
   is the longest unbroken run in the chapter and the only part of it
   that is not a room, which is exactly why nothing had been watching
   it: the old file could not get past the first beat, because
   `__apPump(10, {})` steps the world zero times -- `n = times || 1`
   with an object gives `0 < {}`, which is false. */
const { boot, reporter, driver } = require('./_aplib');

(async () => {
  const { browser, page, errs } = await boot();
  const R = reporter(), ok = R.ok, D = driver(page);
  await D.enter(3);
  await D.talk(3);

  let st = await D.state();
  ok('level four starts in the yard', st.level === 'escape', st.level);
  ok('and the only thing asked for is a car', st.step === 'car', st.step);
  ok('with a crowd between her and it', st.zombies > 5, st.zombies + ' of them');

  /* the car */
  const car = await D.at('C');
  ok('there is a car on the map', !!car, car ? car.x + ',' + car.y : 'MISSING');
  ok('and the key is in it', /key/i.test(await D.line()), (await D.line()).slice(0, 45));
  await D.talk(4);
  await D.pump(2);
  st = await D.state();
  ok('taking it starts the drive', st.state === 'cine' && !!st.cut,
     'state=' + st.state);
  ok('and the drive is a set length she can sit through',
     !!st.cut && isFinite(st.cut.duration) && st.cut.duration > 20,
     st.cut ? st.cut.duration + 's' : '');

  /* the lane */
  st = await D.skipCut();
  ok('the drive puts them down at the roadside', st.level === 'roadside', st.level);
  ok('and the next thing is the horse', st.step === 'horse', st.step);

  const h = await D.at('H');
  ok('the horse is in the field', !!h, h ? h.x + ',' + h.y : 'MISSING');
  ok('and she talks to it before she gets on', (await D.line() || '').length > 10,
     (await D.line() || '').slice(0, 45));
  await D.talk(10);
  await D.pump(2);
  st = await D.state();
  ok('getting on starts the ride', st.state === 'cine' && !!st.cut, 'state=' + st.state);

  /* the clearing */
  st = await D.skipCut();
  ok('the ride ends at the campsite', st.level === 'campsite', st.level);
  await D.talk(6);
  await D.pump(3);
  st = await D.state();
  ok('and the night there begins with the fire to build', st.step === 'wood', st.step);

  const wood = await page.evaluate(() => window.__apFind('wg').length);
  ok('there is wood lying about to build it with', wood >= 3, wood + ' piles');

  /* One at a time, and let each line finish -- gathering latches while
     she is talking about it, and the latch is released by the callback
     on the last line. Cutting the dialogue short leaves it held. */
  for (let i = 0; i < 5; i++) {
    const got = await page.evaluate(() => {
      const f = window.__apFind('wg');
      if (!f.length) return null;
      window.__apTeleport(f[0].x, f[0].y + 1);
      window.__apPump(1 / 60, 4);
      window.__apUse();
      return f[0];
    });
    if (!got) break;
    await page.waitForTimeout(250);
    await D.talk(4);
    await D.pump(0.5);
    if ((await D.state()).step !== 'wood') break;
  }
  st = await D.state();
  ok('gathering three of them clears the beat', st.step !== 'wood', 'now ' + st.step);

  await R.done(browser, errs);
})();
