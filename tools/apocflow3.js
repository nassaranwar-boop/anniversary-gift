/* LEVEL THREE: HUPM, CHRIFIYA.

   The ward doors are dead, so the plant room comes first; then him, in
   the room at the end; then the two of them out of the building
   together. Every beat asserted -- the old file printed six lines and
   judged none of them, teleported to tiles that have not been the plant
   room or the ward for a long time, and read `anwar` off a state report
   that has never had it in it. */
const { boot, reporter, driver } = require('./_aplib');

(async () => {
  const { browser, page, errs } = await boot();
  const R = reporter(), ok = R.ok, D = driver(page);
  await D.enter(2);
  await D.talk(3);

  let st = await D.state();
  ok('level three is the hospital', st.level === 'hospital', st.level);
  ok('and it opens on the plant room', st.step === 'panel', st.step);
  ok('the ward is not empty', st.zombies > 0, st.zombies + ' of them');
  ok('and he is somewhere in it', !!st.anwar && !st.anwar.found,
     st.anwar ? 'at ' + st.anwar.tx + ',' + st.anwar.ty : 'MISSING');

  /* a ward door, before the power */
  const dead = st.doors.filter(d => d.kind === 'P');
  ok('the doors the board feeds are dead to start with',
     dead.length > 0 && dead.every(d => d.locked), dead.length + ' of them');
  await page.evaluate(() => {
    const d = window.__apState().doors.filter(x => x.kind === 'P')[0];
    window.__apClear();
    window.__apTeleport(d.x, d.y + 1);
    window.__apPump(1 / 60, 4);
    window.__apUse();
  });
  await page.waitForTimeout(300);
  ok('and pushing one says so', /dead|not running/i.test(await D.line()),
     (await D.line()).slice(0, 50));
  await D.talk(2);

  /* the plant room */
  await D.at('W');
  ok('the board is in the plant room', await D.has('.ap-panel-canvas'));
  ok('and it is the same board she did at home',
     /DISTRIBUTION BOARD/.test(await D.text('.ap-panel-title') || ''));
  await page.evaluate(() => window.__apSolvePanel());
  ok('solving it closes the board',
     await D.until(() => !document.querySelector('.ap-panel-canvas'), 6000));
  await D.talk(3);
  st = await D.state();
  ok('the power comes back', st.powered);
  ok('and every ward door lets go',
     st.doors.filter(d => d.kind === 'P').every(d => !d.locked));
  ok('which moves her on to him', st.step === 'anwar', st.step);

  /* him */
  const a = st.anwar;
  await page.evaluate(a => { window.__apClear();
                             window.__apTeleport(a.tx, a.ty + 1);
                             window.__apPump(1 / 60, 4);
                             window.__apUse(); }, a);
  await page.waitForTimeout(400);
  ok('standing over him wakes him', (await D.state()).anwar.found);
  ok('and he has something to say', (await D.line() || '').length > 0,
     (await D.line() || '').slice(0, 50));
  await D.talk(10);

  /* and he comes with her */
  const before = (await D.state()).anwar;
  await page.evaluate(() => {
    const x = window.__apFind('X');
    window.__apClear();
    window.__apTeleport(x[0].x, x[0].y + 2);
    window.__apPump(1 / 60, 120);
  });
  await page.waitForTimeout(300);
  const after = (await D.state()).anwar;
  ok('he follows her across the ward',
     Math.hypot(after.x - before.x, after.z - before.z) > 2,
     'he moved ' + Math.hypot(after.x - before.x, after.z - before.z).toFixed(1));

  /* out */
  ok('and the last thing asked is the way out', (await D.state()).step === 'exit',
     await D.step());
  await page.evaluate(() => {
    const x = window.__apFind('X');
    window.__apClear();
    window.__apTeleport(x[0].x, x[0].y);
    window.__apPump(1 / 60, 40);
  });
  await page.waitForTimeout(700);
  const end = await D.state();
  ok('reaching it ends the level', end.state !== 'play' || end.level !== 'hospital',
     'state=' + end.state + ' level=' + end.level);

  await R.done(browser, errs);
})();
