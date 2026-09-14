/* THE WHOLE CHAPTER, START TO FINISH, THE WAY SHE PLAYS IT.

   In from the hub card, through the how-to, and then all five levels
   without ever being placed into one by hand: every level is reached by
   finishing the one before it, so the cards, the cuts, the hand-offs and
   the objectives are all exercised rather than stepped over. The five
   short suites beside this one each check one level closely; this is the
   one that proves the chapter is a chapter.

   It is also the one that has been dead longest. It used Playwright's
   own click, which hangs on this page waiting for a navigation the
   request filter has aborted, so it never even got off the hub. */
const { boot, reporter, driver } = require('./_aplib');

(async () => {
  const { browser, page, errs } = await boot();
  const R = reporter(), ok = R.ok, D = driver(page);

  /* ---- in from the hub ---- */
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} showScreen('hub'); startHub(); });
  await page.waitForTimeout(300);
  await page.evaluate(() => document.getElementById('hub-card-apoc').click());
  ok('the hub card opens the chapter',
     await D.until(() => document.getElementById('screen-apoc').classList.contains('active'), 12000));
  /* the how-to, then the level card -- however many the chapter puts up */
  for (let i = 0; i < 6; i++) {
    if (await page.evaluate(() => !!(window.__apPos && window.__apPos()))) break;
    if (!await D.click('.ap-card-go')) await page.waitForTimeout(400);
  }
  ok('and the cards put her in the house',
     await D.until(() => !!(window.__apPos && window.__apPos()), 15000));
  await D.talk(3);
  ok('which is level one', (await D.state()).level === 'home', await page.evaluate(() => window.__apState().level));

  /* ---- LEVEL ONE ---- */
  await D.at('T'); await D.click('.ap-tv .ap-card-go'); await D.talk(3);
  await D.at('1'); await D.talk(3);
  await D.at('W');
  ok('the board comes up in the garage', await D.has('.ap-panel-canvas'));
  await page.evaluate(() => window.__apSolvePanel());
  await D.until(() => !document.querySelector('.ap-panel-canvas'), 8000);
  await D.talk(3);
  await page.evaluate(() => { const x = window.__apFind('X'); window.__apClear();
                              window.__apTeleport(x[0].x, x[0].y); window.__apPump(1 / 60, 40); });
  await page.waitForTimeout(500);
  ok('finishing the house offers the next card',
     await D.until(() => !!document.querySelector('.ap-card-go'), 12000));
  await D.click('.ap-card-go');
  await D.talk(3);
  ok('which is level two, the city',
     await D.until(() => window.__apState().level === 'streets', 15000),
     await page.evaluate(() => window.__apState().level));

  /* ---- LEVEL TWO ---- */
  await D.at('N'); await D.click('.ap-note-ok'); await D.talk(3);
  const code = await page.evaluate(() => window.__apState().code);
  ok('she picks the number up on the way', /^\d{4}$/.test(code || ''), code);
  await D.at('D');
  await page.evaluate(c => window.__apKeypadType(c), code);
  await page.waitForTimeout(300);
  ok('and it opens the staff gate',
     await page.evaluate(() => window.__apState().doors.every(d => d.kind !== 'D' || !d.locked)));
  await page.evaluate(() => { const x = window.__apFind('X'); window.__apClear();
                              window.__apTeleport(x[0].x, x[0].y); window.__apPump(1 / 60, 40); });
  await page.waitForTimeout(500);
  await D.click('.ap-card-go');
  await D.talk(3);
  ok('level three is the hospital',
     await D.until(() => window.__apState().level === 'hospital', 20000),
     await page.evaluate(() => window.__apState().level));

  /* ---- LEVEL THREE ---- */
  await D.at('W');
  await page.evaluate(() => window.__apSolvePanel());
  await D.until(() => !document.querySelector('.ap-panel-canvas'), 8000);
  await D.talk(3);
  ok('the ward has power again', await page.evaluate(() => window.__apState().powered));
  /* stand next to him on whichever side is clear, rather than assuming
     the tile below him is walkable on every pass */
  for (const [dx, dy] of [[0, 1], [1, 0], [-1, 0], [0, -1], [0, 0]]) {
    if (await page.evaluate(() => window.__apState().anwar.found)) break;
    await page.evaluate(([dx, dy]) => {
      const a = window.__apState().anwar;
      window.__apClear();
      window.__apTeleport(a.tx + dx, a.ty + dy);
      window.__apPump(1 / 60, 6);
      window.__apUse();
    }, [dx, dy]);
    await page.waitForTimeout(350);
  }
  ok('and she finds him in it', await page.evaluate(() => window.__apState().anwar.found));
  await D.talk(10);
  await page.evaluate(() => { const x = window.__apFind('X'); window.__apClear();
                              window.__apTeleport(x[0].x, x[0].y); window.__apPump(1 / 60, 40); });
  await page.waitForTimeout(500);
  await D.talk(8);
  /* the room with the bolt on the door, and the radio in it */
  ok('the two of them get behind a door that shuts',
     await D.until(() => !!document.querySelector('.ap-radio'), 15000));
  for (let i = 0; i < 8; i++) { if (!await D.click('.ap-radio .ap-card-go')) break; }
  /* the hand-off runs on a fade, and a fade is advanced by the loop --
     which is frozen to three frames a second in here, so it is pumped */
  await D.pump(3); await page.waitForTimeout(300);
  await D.until(() => !!document.querySelector('.ap-card-go'), 12000);
  await D.click('.ap-card-go');
  await D.talk(3); await D.pump(2);
  ok('level four is the coast road',
     await D.until(() => window.__apState().level === 'escape', 20000),
     await page.evaluate(() => window.__apState().level));

  /* ---- LEVEL FOUR, AND THE ROAD ---- */
  await D.at('C'); await D.talk(6); await D.pump(2);
  let st = await D.skipCut();
  ok('the drive puts them at the roadside', st.level === 'roadside', st.level);
  await D.at('H'); await D.talk(10); await D.pump(2);
  st = await D.skipCut();
  ok('and the ride puts them at the campsite', st.level === 'campsite', st.level);
  await D.talk(6); await D.pump(3);
  for (let i = 0; i < 5; i++) {
    const got = await page.evaluate(() => { const f = window.__apFind('wg');
      if (!f.length) return null;
      window.__apTeleport(f[0].x, f[0].y + 1); window.__apPump(1 / 60, 4);
      window.__apUse(); return f[0]; });
    if (!got) break;
    await page.waitForTimeout(250); await D.talk(4); await D.pump(0.5);
    if ((await D.state()).step !== 'wood') break;
  }
  ok('they gather enough for a fire', (await D.state()).step !== 'wood', await D.step());
  await page.evaluate(() => { const w = window.Apocalypse.game.world;
    if (w.firePitAt) { window.__apClear();
      window.__apTeleport(w.firePitAt.x, w.firePitAt.y + 1);
      window.__apPump(1 / 60, 4); window.__apUse(); } });
  await page.waitForTimeout(400);
  await D.talk(12); await D.pump(4);
  st = await D.skipCut();
  ok('and the night by the fire leads somewhere',
     st.level !== 'campsite' || st.state !== 'play', 'lvl=' + st.level + ' state=' + st.state);

  /* ---- LEVEL FIVE ---- */
  for (let i = 0; i < 6; i++) { await D.talk(4); await D.pump(3); await D.skipCut();
    if ((await D.state()).level === 'gates') break; await D.click('.ap-card-go'); }
  ok('level five is the safe house',
     (await D.state()).level === 'gates', (await D.state()).level);

  if ((await D.state()).level === 'gates') {
    await D.talk(4);
    await D.at('G'); await D.talk(8); await D.pump(2);
    await D.at('Q');
    await D.clickAll('.ap-check-row');
    await D.click('.ap-check .ap-note-ok');
    ok('the intake and the inoculation both happen', await D.has('.ap-serum-canvas'));
    await page.evaluate(() => window.__apSerum());
    await D.until(() => !document.querySelector('.ap-serum'), 9000);
    await D.talk(6); await D.pump(3);
    await page.evaluate(() => { const x = window.__apFind('X'); window.__apClear();
                                window.__apTeleport(x[0].x, x[0].y); window.__apPump(1 / 60, 40); });
    await page.waitForTimeout(500);
    await D.talk(8); await D.pump(4);
    st = await D.skipCut();
    ok('and they are let in', st.state !== 'play' || st.level !== 'gates',
       'state=' + st.state + ' level=' + st.level);
  }

  ok('and none of the chapter threw', errs.length === 0, errs.slice(0, 2).join(' | '));
  console.log('');
  console.log(R.fail ? R.pass + ' passed, ' + R.fail + ' FAILED'
                     : 'all ' + R.pass + ' checks passed');
  await browser.close();
  process.exit(R.fail ? 1 : 0);
})();
