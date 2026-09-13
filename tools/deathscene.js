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

  /* ---------- AND NO DOOR STRAIGHT INTO IT ----------
     There used to be an ANWAR vs DEATH button on the ending card and
     another in the pause menu. They were scaffolding — the scene only
     happens if the Queen takes the last life on Hard, so a way in was
     needed to check it worked at all. A shortcut to it costs the thing
     itself: it is the reward for having lost the whole run to her, in the
     last room, on the hardest difficulty, and a button that hands it over
     on request turns the worst moment in the game into a menu item.

     These assertions are the opposite way round on purpose: the doors are
     gone and have to STAY gone, on every difficulty, in both places. */
  const noDoor = async (d) => {
    await page.evaluate(() => { window.__soTestDrive = true; try{localStorage.clear();}catch(e){}
      SuperOuissy.stop(); showScreen('ouissy'); startSuperOuissy(); });
    await page.waitForSelector('.so-diff-card', { timeout:6000 });
    await page.click(`[data-so-diff="${d}"]`); await page.click('#so-play');
    await page.waitForTimeout(250);
    const h = await page.$('#so-how-ok'); if (h) await h.click();
    await page.waitForFunction(() => window.__soInfo().state === 'play', { timeout:8000 });
    const pause = await page.evaluate(() => {
      window.__soPause();
      return { paused: window.__soInfo().state === 'paused',
               door: !!document.getElementById('so-pause-scene'),
               resume: !!document.getElementById('so-resume'),
               quit: !!document.getElementById('so-quit') };
    });
    await page.evaluate(() => window.__soPause());
    const end = await page.evaluate(() => {
      window.__soShowEnding();
      return { door: !!document.getElementById('so-end-scene'),
               again: !!document.getElementById('so-end-again'),
               title: !!document.getElementById('so-end-title'),
               quit: !!document.getElementById('so-end-quit'),
               text: (document.querySelector('.so-end') || {}).textContent || '' };
    });
    return { pause, end };
  };
  for (const d of ['easy', 'medium', 'hard']) {
    const n2 = await noDoor(d);
    ok(`${d}: the pause menu has no way into the scene`, n2.pause.paused && !n2.pause.door,
       JSON.stringify(n2.pause));
    ok(`${d}: and the pause menu still works`, n2.pause.resume && n2.pause.quit);
    ok(`${d}: the ending has no way into the scene either`, !n2.end.door, JSON.stringify(n2.end.door));
    ok(`${d}: and the ending still offers the ways out it should`,
       n2.end.again && n2.end.title && n2.end.quit, JSON.stringify(n2.end));
    ok(`${d}: and nothing on the ending names it`, !/ANWAR vs DEATH/i.test(n2.end.text));
  }

  ok('no page errors', errs.length === 0, errs.slice(0,3).join(' | '));
  await browser.close();
  console.log(R.join('\n'));
  const bad = R.filter(x => x.startsWith('FAIL')).length;
  console.log(`\n${R.length - bad} passed, ${bad} failed`);
  process.exit(bad ? 1 : 0);
})();
