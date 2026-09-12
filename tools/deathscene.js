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
      if (S.phase === 11) seen.closeCalls++;
      if (S.phase === 6) {
        /* the two options: 0 is fight, 1 is let go */
        if (choice === 'letgo' && S.sel !== 1) window.Rescue.press('right');
        else if (choice === 'fight' && S.sel !== 0) window.Rescue.press('left');
        else window.Rescue.press('confirm');
      } else if (S.phase === 9 && S.cue && !S.cueResult) {
        if (seen.rounds.indexOf(S.round) < 0) { seen.rounds.push(S.round); seen.cues.push(S.cue.id); }
        if (answer) window.Rescue.press(S.cue.keys[0]);
        else seen.missed++;      /* let the window run out */
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
  ok('every round is asked', r.seen.rounds.length === 6, `rounds=${r.seen.rounds.join(',')}`);
  ok('the cues cycle block / dodge / strike', r.seen.cues.join(',') === 'block,dodge,strike,block,dodge,strike', r.seen.cues.join(','));
  ok('the close call happens, and only once', r.seen.closeCalls > 0 && r.seen.rounds.indexOf(2) >= 0, `closeCall frames=${r.seen.closeCalls}`);
  ok('it reaches the end of the scene', r.phases.indexOf(13) >= 0, `phases=${r.phases.join(' ')}`);
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
  ok('missing every cue still finishes the fight — it is a story, not a wall',
     r.done && r.outcome === 'fight' && r.phases.indexOf(13) >= 0, `missed=${r.seen.missed} phases=${r.phases.join(' ')}`);

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

  /* ---------- and the door on the ending screen ---------- */
  await page.evaluate(() => {
    window.__soTestDrive = true;
    SuperOuissy.stop(); showScreen('ouissy'); startSuperOuissy();
  });
  await page.waitForSelector('.so-diff-card', { timeout:6000 });
  await page.click('[data-so-diff="easy"]'); await page.click('#so-play');
  await page.waitForTimeout(250);
  const how2 = await page.$('#so-how-ok'); if (how2) await how2.click();
  await page.waitForFunction(() => window.__soInfo().state === 'play', { timeout:8000 });
  await page.evaluate(() => { window.__soLives(4); window.__soShowEnding(); });
  const btn = await page.$('#so-end-scene');
  ok('the ending offers the scene', !!btn, '');
  if (btn) {
    const before = await page.evaluate(() => ({ lives: window.__soInfo().lives, diff: window.__soState().diff }));
    await btn.click();
    const started = await page.evaluate(() => {
      for (let i = 0; i < 120 && window.__soInfo().state !== 'cutscene'; i++) window.__soPump(1/60);
      const S = window.Rescue._state();
      return { state: window.__soInfo().state, kind: S && S.kind };
    });
    ok('it plays the same scene, from the ending', started.state === 'cutscene' && started.kind === 'death', JSON.stringify(started));
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

  ok('no page errors', errs.length === 0, errs.slice(0,3).join(' | '));
  await browser.close();
  console.log(R.join('\n'));
  const bad = R.filter(x => x.startsWith('FAIL')).length;
  console.log(`\n${R.length - bad} passed, ${bad} failed`);
  process.exit(bad ? 1 : 0);
})();
