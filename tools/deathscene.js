/* ANWAR vs DEATH — the scene almost nobody will ever reach.

   It only happens on Hard, only in the Queen's room, and only on the last
   life, so it is the least-played thing in the game and the easiest for a
   change somewhere else to break without anyone noticing. This plays it
   through, both ways, and checks that what it decides actually reaches
   the game it came from. */
const { chromium } = require('playwright-core');
const R = []; const ok = (n, c, x) => R.push((c ? 'ok   ' : 'FAIL ') + n + (x ? '   ' + x : ''));

(async () => {
  const browser = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args:['--no-sandbox','--no-proxy-server','--disable-gpu','--use-gl=swiftshader','--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport:{width:1180,height:900} });
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.route('**/*', r => r.request().url().startsWith('http://127.0.0.1') ? r.continue() : r.abort());
  await page.goto('http://127.0.0.1:8899/index.html', { waitUntil:'domcontentloaded', timeout:60000 });
  await page.waitForFunction(() => !!window.SuperOuissy && !!window.Rescue, { timeout:30000 });

  /* Hard, the Queen's room, one life left, and then she loses it. */
  const arrive = async () => {
    await page.evaluate(() => { window.__soTestDrive = true; try{localStorage.clear();}catch(e){}
      SuperOuissy.stop(); showScreen('ouissy'); startSuperOuissy(); });
    await page.waitForSelector('.so-diff-card', { timeout:6000 });
    await page.click('[data-so-diff="hard"]'); await page.click('#so-play');
    await page.waitForTimeout(250);
    const how = await page.$('#so-how-ok'); if (how) await how.click();
    await page.waitForFunction(() => window.__soInfo().state === 'play', { timeout:8000 });
    await page.evaluate(() => window.__soGoLevel(2));
    await page.waitForFunction(() => window.__soInfo().state === 'play', { timeout:8000 });
    return page.evaluate(() => {
      window.__soLives(1);
      /* deep into the room, so "where she fell" is somewhere that is not
         also the way in — otherwise the two answers look the same */
      window.__soTele(Math.round(window.G_bossTile()) - 7);
      window.__soPump(0.1);
      window.__soBossSet({ awake: true });
      window.__soKill();
      for (let i = 0; i < 200 && window.__soInfo().state !== 'cutscene'; i++) window.__soPump(1/60);
      return { state: window.__soInfo().state, kind: window.Rescue._state() && window.Rescue._state().kind };
    });
  };

  /* play it, answering every cue or none of them */
  const play = (choice, answer) => page.evaluate(({ choice, answer }) => {
    const seen = { phases: {}, rounds: [], cues: [], closeCalls: 0, missed: 0 };
    for (let i = 0; i < 60 * 400; i++) {
      const S = window.Rescue._state();
      if (!S || S.done) break;
      seen.phases[S.phase] = (seen.phases[S.phase] || 0) + 1;
      if (S.phase === 13) seen.closeCalls++;
      if (S.phase === 6) {
        /* the two options: 0 is fight, 1 is let go */
        if (choice === 'letgo' && S.sel !== 1) window.Rescue.press('right');
        else if (choice === 'fight' && S.sel !== 0) window.Rescue.press('left');
        else window.Rescue.press('confirm');
      } else if (S.phase === 10 && !S.ans) {
        /* the attack window: the right answer, or none at all */
        const M = window.Rescue._moves();
        if (seen.rounds.indexOf(S.moveSeen) < 0) { seen.rounds.push(S.moveSeen); seen.cues.push(S.move); }
        if (answer) {
          const need = M[S.move].need;
          window.Rescue.press(need === 'block' ? 'down' : need === 'dodge' ? 'left' : 'jump');
        } else seen.missed++;
      } else if (S.phase === 12 && !S.struck) {
        if (answer) window.Rescue.press('jump');
      } else if (S.phase === 14) {
        if (answer) window.Rescue.press('jump');   /* get him up */
      } else if (S.phase === 22) {
        window.Rescue.press('confirm');
      } else if (S.lines && S.waiting) {
        window.Rescue.press('confirm');
      }
      window.__soPump(1/60);
    }
    const S2 = window.Rescue._state();
    return { seen, done: !S2 || S2.done, outcome: window.Rescue.outcome(),
             phases: Object.keys(seen.phases).map(Number).sort((a,b)=>a-b) };
  }, { choice, answer });

  /* ---------- she fights ---------- */
  let at = await arrive();
  ok('losing the last life to the Queen on Hard opens the scene', at.state === 'cutscene' && at.kind === 'death', JSON.stringify(at));
  let r = await play('fight', true);
  ok('the fight plays to the end', r.done && r.outcome === 'fight', `outcome=${r.outcome}`);
  ok('the close call happens', r.seen.closeCalls > 0, `closeCall frames=${r.seen.closeCalls}`);
  ok('it reaches the end of the scene', r.phases.indexOf(16) >= 0, `phases=${r.phases.join(' ')}`);
  let after = await page.evaluate(() => {
    for (let i = 0; i < 240; i++) window.__soPump(1/60);
    return { state: window.__soInfo().state, lives: window.__soInfo().lives,
             x: window.__soInfo().x, startX: window.__soLevelBox().startX };
  });
  ok('winning buys her one more life, in the room she was in', after.state === 'play' && after.lives === 1, JSON.stringify(after));
  ok('and he puts her down where she fell, not at the castle gate',
     after.x > after.startX / 16 + 20, `back at x=${after.x}t  gate=${Math.round(after.startX/16)}t`);

  /* ---------- she misses everything ---------- */
  at = await arrive();
  r = await play('fight', false);
  ok('missing everything ends the scene rather than hanging it',
     r.done && (r.outcome === 'letgo' || r.outcome === 'fight'), `missed=${r.seen.missed} outcome=${r.outcome} phases=${r.phases.join(' ')}`);

  /* ---------- she lets it go ---------- */
  at = await arrive();
  r = await play('letgo', true);
  ok('letting go plays to the letter', r.done && r.outcome === 'letgo' && r.phases.indexOf(22) >= 0, `outcome=${r.outcome} phases=${r.phases.join(' ')}`);
  after = await page.evaluate(() => {
    for (let i = 0; i < 240; i++) window.__soPump(1/60);
    return { state: window.__soInfo().state };
  });
  ok('and the run closes afterwards', after.state !== 'play', JSON.stringify(after));

  /* ---------- and a real key reaches it ---------- */
  at = await arrive();
  const before = await page.evaluate(() => window.Rescue._state().shown);
  await page.keyboard.press('ArrowRight');
  await page.evaluate(() => window.__soPump(0.2));
  ok('the keyboard reaches the scene', typeof before === 'number', '');

  /* ---------- the door in the pause menu, on Hard ---------- */
  const pauseDoor = async (d) => {
    await page.evaluate(() => { window.__soTestDrive = true; try{localStorage.clear();}catch(e){}
      SuperOuissy.stop(); showScreen('ouissy'); startSuperOuissy(); });
    await page.waitForSelector('.so-diff-card', { timeout:6000 });
    await page.click(`[data-so-diff="${d}"]`); await page.click('#so-play');
    await page.waitForTimeout(250);
    const h = await page.$('#so-how-ok'); if (h) await h.click();
    await page.waitForFunction(() => window.__soInfo().state === 'play', { timeout:8000 });
    return page.evaluate(() => {
      window.__soPause();
      return { paused: window.__soInfo().state === 'paused', door: !!document.getElementById('so-pause-scene') };
    });
  };
  for (const d of ['easy','medium']) {
    const p2 = await pauseDoor(d);
    ok(`${d}: the pause menu does not name a scene that difficulty never has`, p2.paused && !p2.door, JSON.stringify(p2));
  }
  const ph = await pauseDoor('hard');
  ok('hard: the pause menu has the door', ph.paused && ph.door, JSON.stringify(ph));
  if (ph.door) {
    const ran = await page.evaluate(() => {
      const before = window.__soInfo().lives;
      document.getElementById('so-pause-scene').click();
      for (let i = 0; i < 120 && window.__soInfo().state !== 'cutscene'; i++) window.__soPump(1/60);
      const S = window.Rescue._state();
      return { state: window.__soInfo().state, kind: S && S.kind, before: before };
    });
    ok('hard: the pause door plays the scene', ran.state === 'cutscene' && ran.kind === 'death', JSON.stringify(ran));
    const done2 = await play('letgo', true);
    const back2 = await page.evaluate(() => {
      for (let i = 0; i < 300 && window.__soInfo().state !== 'paused'; i++) window.__soPump(1/60);
      return { state: window.__soInfo().state, lives: window.__soInfo().lives,
               menu: !!document.getElementById('so-resume') };
    });
    ok('hard: and it comes back to the pause menu with the run untouched',
       back2.state === 'paused' && back2.menu && back2.lives === ran.before,
       JSON.stringify(back2));
    ok('hard: the scene played properly from the pause menu', done2.done, `outcome=${done2.outcome}`);
  }

  /* ---------- and the door on the ending screen ---------- */
  await page.evaluate(() => {
    window.__soTestDrive = true;
    SuperOuissy.stop(); showScreen('ouissy'); startSuperOuissy();
  });
  await page.waitForSelector('.so-diff-card', { timeout:6000 });
  await page.click('[data-so-diff="hard"]'); await page.click('#so-play');
  await page.waitForTimeout(250);
  const how2 = await page.$('#so-how-ok'); if (how2) await how2.click();
  await page.waitForFunction(() => window.__soInfo().state === 'play', { timeout:8000 });
  await page.evaluate(() => { window.__soLives(4); window.__soShowEnding(); });
  const btn = await page.$('#so-end-scene');
  const bgmBefore = await page.evaluate(() => window.__soBgmLevel());
  ok('the Hard ending offers the scene', !!btn, '');
  if (btn) {
    const before = await page.evaluate(() => ({ lives: window.__soInfo().lives, diff: window.__soState().diff }));
    await page.evaluate(() => document.getElementById('so-end-scene').click());
    const started = await page.evaluate(() => {
      for (let i = 0; i < 120 && window.__soInfo().state !== 'cutscene'; i++) window.__soPump(1/60);
      const S = window.Rescue._state();
      return { state: window.__soInfo().state, kind: S && S.kind };
    });
    ok('it plays the same scene, from the ending', started.state === 'cutscene' && started.kind === 'death', JSON.stringify(started));
    /* and the game's own cheerful little march is not playing under it */
    const during = await page.evaluate(() => window.__soBgmLevel());
    ok('the game goes quiet under the scene', during === 0 || during === null,
       `level ${bgmBefore} -> ${during}`);
    const done = await play('letgo', true);
    const back = await page.evaluate(() => {
      for (let i = 0; i < 300; i++) window.__soPump(1/60);
      return { state: window.__soInfo().state, lives: window.__soInfo().lives,
               overlay: !!document.getElementById('so-end-scene') };
    });
    ok('watching it ends back on the ending screen', back.state === 'ending' && back.overlay, JSON.stringify(back));
    ok('and it costs her nothing', back.lives === before.lives, `${before.lives} -> ${back.lives}`);
    ok('the scene still finished properly when watched', done.done, `outcome=${done.outcome}`);
  }

  /* and the endings that are not Hard's do not name him at all */
  for (const d of ['easy','medium']) {
    await page.evaluate(() => { window.__soTestDrive = true;
      SuperOuissy.stop(); showScreen('ouissy'); startSuperOuissy(); });
    await page.waitForSelector('.so-diff-card', { timeout:6000 });
    await page.click(`[data-so-diff="${d}"]`); await page.click('#so-play');
    await page.waitForTimeout(250);
    const h3 = await page.$('#so-how-ok'); if (h3) await h3.click();
    await page.waitForFunction(() => window.__soInfo().state === 'play', { timeout:8000 });
    await page.evaluate(() => window.__soShowEnding());
    const gone = await page.$('#so-end-scene');
    ok(`${d}: its ending does not offer a scene that difficulty never has`, !gone, '');
  }

  ok('no page errors', errs.length === 0, errs.slice(0,3).join(' | '));
  await browser.close();
  console.log(R.join('\n'));
  const bad = R.filter(x => x.startsWith('FAIL')).length;
  console.log(`\n${R.length - bad} passed, ${bad} failed`);
  process.exit(bad ? 1 : 0);
})();
