/* LEVEL TWO: EIGHT KILOMETRES OF MARRAKECH, ON FOOT.

   The one thing the level asks is that she gets across it, and the one
   thing standing in the way is the staff gate with a number on it. Find
   the note, use the number, come out the far side.

   The old file was a list of console.logs with no assertion in it, and
   every coordinate in it was a tile from a map that has since been
   redrawn -- it teleported to 31,20 for a gate that is at 32,23 and to
   11,21 for a note that is at 11,24, so it printed empty strings and
   nulls and reported nothing wrong. */
const { boot, reporter, driver } = require('./_aplib');

(async () => {
  const { browser, page, errs } = await boot();
  const R = reporter(), ok = R.ok, D = driver(page);
  await D.enter(1);
  await D.talk(2);

  const st = await D.state();
  ok('level two is the city', st.level === 'streets', st.level);
  ok('and the only thing asked is the way out', st.step === 'exit', st.step);
  ok('it has people in it', st.zombies > 0, st.zombies + ' of them');

  /* the gate, before she has the number */
  await D.at('D');
  ok('the staff gate turns her away without the code',
     /keypad|number/i.test(await D.line()), (await D.line()).slice(0, 60));
  await D.talk(2);
  ok('and it stays shut',
     (await D.state()).doors.some(d => d.kind === 'D' && d.locked));

  /* the note, in the shop */
  await D.at('N');
  ok('the note is on the wall of the shop', await D.has('.ap-note-code'));
  const code = await D.text('.ap-note-code');
  ok('and it has four figures on it', /^\d{4}$/.test((code || '').trim()), code);
  await D.click('.ap-note-ok');
  await D.talk(2);
  ok('she is carrying the number now', (await D.state()).code === code, (await D.state()).code);

  /* the gate again */
  await D.at('D');
  ok('and now the gate puts a keypad up', await D.has('.ap-keypad-pad'));
  await page.evaluate(() => window.__apKeypadType('0000'));
  await page.waitForTimeout(250);
  ok('a wrong number does not open it',
     (await D.state()).doors.some(d => d.kind === 'D' && d.locked));
  const stillUp = await D.has('.ap-keypad-pad');
  ok('and it leaves the pad up to try again', stillUp);
  if (stillUp) {
    await page.evaluate(c => window.__apKeypadType(c), (code || '').trim());
    await page.waitForTimeout(300);
    ok('the right one unlocks it',
       (await D.state()).doors.every(d => d.kind !== 'D' || !d.locked));
    ok('and the pad goes away', !(await D.has('.ap-keypad-pad')));
  }

  /* and out the far side */
  await page.evaluate(() => {
    const x = window.__apFind('X');
    window.__apClear();
    window.__apTeleport(x[0].x, x[0].y);
    window.__apPump(1 / 60, 30);
  });
  await page.waitForTimeout(600);
  const end = await D.state();
  ok('reaching the far side ends the level',
     end.state !== 'play' || end.level !== 'streets',
     'state=' + end.state + ' level=' + end.level);

  await R.done(browser, errs);
})();
