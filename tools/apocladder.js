/* THE ONE THING PROTECTING HER PHONE, AND NOTHING HAS EVER TESTED IT.

   The chapter renders at the screen's own pixel ratio and gives that up
   a rung at a time if the machine cannot hold a frame. That ladder is
   the difference between an old phone playing this and an old phone
   showing a slideshow -- and it could not be tested by playing, because
   the frame rate in a test container is the container's, not the
   game's: SwiftShader paints every frame on the processor, so the
   ladder would simply sit on the bottom rung and tell you nothing.

   So it is fed instead. watchPerformance is handed a run of frames of a
   chosen length, which is exactly what a machine of a chosen speed
   would hand it, and where it settles is the answer. Every number below
   is a real device: 8.3ms is an iPad at 120, 16.7 a phone holding
   sixty, 33 one managing thirty, 50 one in trouble. */
const { boot, reporter, driver } = require('./_aplib');

(async () => {
  const { browser, page, errs } = await boot();
  const R = reporter(), ok = R.ok, D = driver(page);
  await D.enter(0);

  const feed = (ms, n) => page.evaluate(([m, k]) => {
    window.__apPerfReset();
    return window.__apFeedFrames(m, k);
  }, [ms, n]);
  const rungs = await page.evaluate(() => window.__apScale());
  console.log('   top of the ladder: scale ' + rungs.scale + ', rung ' + rungs.rung);

  /* a machine holding the frame is left alone */
  let r = await feed(16.0, 400);
  ok('a machine holding sixty is left at the top', r.rung === 0,
     'rung ' + r.rung + ', scale ' + r.scale);

  /* one that cannot must come down */
  r = await feed(33.0, 400);
  ok('one managing thirty is brought down the ladder', r.rung > 0,
     'rung ' + r.rung + ', scale ' + r.scale);
  ok('and it does not fall off the bottom of it', r.scale >= 0.5, 'scale ' + r.scale);

  /* HOW FAR IT DROPS IS HOW FAR OVER IT IS.

     A machine a little over budget and a machine at half the frame rate
     it needs are not the same problem, and the ladder is meant to tell
     them apart: one rung for the first, three for the second, so a
     phone in real trouble does not have to wait twenty-five seconds to
     walk down six of them. Both runs are two seconds of frames -- one
     decision's worth -- or the ladder simply keeps stepping until it
     hits the bottom and the two look alike. */
  const curve = [];
  for (const ms of [16, 18, 20, 25, 33, 40, 50, 66]) {
    const one = await feed(ms, Math.round(2000 / ms));   /* two seconds */
    curve.push([ms, one.rung]);
  }
  console.log('   one decision\'s worth of frames, and the rung it drops to:');
  console.log('      ' + curve.map(c => c[0] + 'ms->' + c[1]).join('   '));
  const drops = curve.map(c => c[1]);
  ok('the worse the machine, the further it drops',
     drops.every((d, i) => i === 0 || d >= drops[i - 1]),
     drops.join(','));
  ok('and a machine holding the frame is not touched at all', drops[0] === 0);
  ok('one a little over comes down gently', drops[2] <= 2,
     'rung ' + drops[2] + ' at 20ms');
  ok('one in real trouble is not made to walk down one rung at a time',
     drops[drops.length - 1] >= 3, 'rung ' + drops[drops.length - 1] + ' at 66ms');

  /* THE TWO WAYS A LADDER LIKE THIS GOES WRONG */

  /* one long frame is a door opening, not a machine falling over */
  await page.evaluate(() => window.__apPerfReset());
  await page.evaluate(() => window.__apFeedFrames(16.0, 200));
  let before = await page.evaluate(() => window.__apScale().rung);
  await page.evaluate(() => window.__apFeedFrames(120, 1));
  await page.evaluate(() => window.__apFeedFrames(16.0, 200));
  let after = await page.evaluate(() => window.__apScale().rung);
  ok('a single long frame does not drop the picture', after === before,
     'rung ' + before + ' -> ' + after);

  /* and coming back from another tab is not a slow machine */
  await page.evaluate(() => window.__apPerfReset());
  await page.evaluate(() => window.__apFeedFrames(16.0, 200));
  before = await page.evaluate(() => window.__apScale().rung);
  const woke = await page.evaluate(() => {
    /* the real loop refuses to measure a frame this long at all */
    const raw = 8.0;                       /* eight seconds away */
    return raw < 0.25;
  });
  ok('a gap from another tab is never measured as a frame', woke === false);

  /* it climbs back when the machine recovers */
  await page.evaluate(() => window.__apPerfReset());
  await page.evaluate(() => window.__apFeedFrames(50.0, 600));
  const low = await page.evaluate(() => window.__apScale().rung);
  await page.evaluate(() => window.__apFeedFrames(10.0, 3000));
  const back = await page.evaluate(() => window.__apScale().rung);
  ok('and it climbs back when the frames come back', back < low,
     'rung ' + low + ' -> ' + back);

  /* the torch stops carving shadows before the picture gets ugly */
  await page.evaluate(() => window.__apPerfReset());
  await page.evaluate(() => window.__apFeedFrames(50.0, 600));
  const shadow = await page.evaluate(() => {
    const t = window.Apocalypse.game.player.torch;
    const sp = t && t.userData.spot;
    return { rung: window.__apScale().rung, casts: !!(sp && sp.castShadow) };
  });
  ok('a struggling machine stops drawing the torch shadow',
     shadow.rung < 3 || !shadow.casts,
     'rung ' + shadow.rung + ', torch casts ' + shadow.casts);

  /* and a person who has asked for one or the other is obeyed */
  const pinned = await page.evaluate(() => {
    window.__apSet('quality', 'smooth');
    window.__apFeedFrames(10.0, 2000);        /* a fast machine */
    const s = window.__apScale();
    window.__apSet('quality', 'auto');
    return s;
  });
  ok('choosing "smooth" is not second-guessed by a fast machine',
     pinned.scale < 1, 'scale ' + pinned.scale);

  await R.done(browser, errs);
})();
