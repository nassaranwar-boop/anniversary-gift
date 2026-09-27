/* LEVEL FIVE: THE SAFE HOUSE AT ESSAOUIRA.

   Hail the gate, sit at the table, tick every line of the intake, take
   the inoculation, and go in. Then the settling, and the roof.

   The old file teleported to 13,10 and 20,9 for a gate that is at 15,11
   and a desk that is at 13,15, joined an array of objects with a space
   and printed "[object Object]" six times, and asserted nothing at all
   about any of it. */
const { boot, reporter, driver } = require('./_aplib');

(async () => {
  const { browser, page, errs } = await boot();
  const R = reporter(), ok = R.ok, D = driver(page);
  await D.enter(4);
  await D.talk(4);

  let st = await D.state();
  ok('level five is the safe house', st.level === 'gates', st.level);
  ok('and the first thing is to be let in', st.step === 'hail', st.step);
  const gates = st.doors.filter(d => d.kind === 'G');
  ok('the gates are shut when they arrive',
     gates.length > 0 && gates.every(d => d.locked && !d.open),
     gates.length + ' of them');
  ok('nothing is chasing her any more', st.zombies === 0, st.zombies + '');

  /* the gate */
  await D.at('G');
  ok('somebody answers when she hails it', /high-vis|other side|who/i.test(await D.line()),
     (await D.line()).slice(0, 45));
  await D.talk(8);
  await D.pump(2);
  ok('and they send her to the table', (await D.step()) === 'check', await D.step());

  /* the intake */
  await D.at('Q');
  ok('the intake form is on the desk', await D.has('.ap-check'));
  const rows = await page.evaluate(() => document.querySelectorAll('.ap-check-row').length);
  ok('and it has lines to tick', rows > 0, rows + ' of them');
  ok('the clerk will not stamp it half done',
     await page.evaluate(() => { const b = document.querySelector('.ap-check .ap-note-ok');
                                 return !!b && b.disabled; }));
  await D.clickAll('.ap-check-row');
  ok('every line ticked enables the stamp',
     await page.evaluate(() => { const b = document.querySelector('.ap-check .ap-note-ok');
                                 return !!b && !b.disabled; }));
  await D.click('.ap-check .ap-note-ok');

  /* the inoculation */
  ok('and the inoculation follows straight on', await D.has('.ap-serum-canvas'));
  await page.evaluate(() => window.__apSerum());
  ok('taking it closes the last card',
     await D.until(() => !document.querySelector('.ap-serum'), 9000));
  await D.talk(6);
  await D.pump(3);

  st = await D.state();
  ok('and the gates open once they are cleared',
     st.doors.filter(d => d.kind === 'G').some(d => !d.locked),
     st.doors.filter(d => d.kind === 'G' && !d.locked).length + ' unlocked');
  ok('which leaves only the way in', st.step === 'exit', st.step);

  /* in */
  await page.evaluate(() => {
    const x = window.__apFind('X');
    window.__apClear();
    window.__apTeleport(x[0].x, x[0].y);
    window.__apPump(1 / 60, 40);
  });
  await page.waitForTimeout(600);
  await D.pump(3);
  st = await D.state();
  ok('walking in ends the level', st.state !== 'play' || st.level !== 'gates',
     'state=' + st.state + ' level=' + st.level);

  /* and the two scenes that close the chapter */
  await D.talk(8);
  await D.pump(4);
  st = await D.skipCut();
  ok('the chapter has somewhere to go after the gates',
     st.state === 'cine' || st.level !== 'gates' || !!st.cut,
     'state=' + st.state + ' level=' + st.level);

  await R.done(browser, errs);
})();
