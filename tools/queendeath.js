/* THE ONE DEATH THAT LEADS SOMEWHERE ELSE.

   Running out of lives inside the Queen's fight, on Hard, is supposed to
   open the Anwar-and-Death scene rather than a GAME OVER card. This checks
   the whole route into it: killed by the Queen herself, killed by the room
   she is standing in, and the whole chain of paid revives before it — and
   the four places it must NOT happen, because a scene that turns up on Easy
   or before the Queen has even woken up is worse than no scene at all. */
const { chromium } = require('playwright-core');
const R = []; const ok = (n, c, x) => R.push((c ? 'ok   ' : 'FAIL ') + n + (x ? '   ' + x : ''));
(async () => {
  const browser = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args:['--no-sandbox','--no-proxy-server','--disable-gpu','--use-gl=swiftshader','--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport:{width:1180,height:900} });
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.route('**/*', r => r.request().url().startsWith('http://127.0.0.1') ? r.continue() : r.abort());
  await page.goto('http://127.0.0.1:8899/index.html', { waitUntil:'domcontentloaded', timeout:60000 });
  await page.waitForFunction(() => !!window.SuperOuissy, { timeout:30000 });
  const play = () => page.waitForFunction(() => window.__soInfo().state === 'play', { timeout:15000 });

  /* put her in the Queen's room, awake, deep enough in that "where she
     fell" is not also the way in */
  const inTheRoom = async (diff, lives) => {
    await page.evaluate(() => { window.__soTestDrive = true; try{localStorage.clear();}catch(e){}
      SuperOuissy.stop(); showScreen('ouissy'); startSuperOuissy(); });
    await page.waitForSelector('.so-diff-card', { timeout:6000 });
    await page.click(`[data-so-diff="${diff}"]`); await page.click('#so-play');
    await page.waitForTimeout(250);
    const how = await page.$('#so-how-ok'); if (how) await how.click();
    await play();
    return page.evaluate(n => {
      const last = window.__soWorldNames().length - 1;
      window.__soGoLevel(last); window.__soSkipCard();
      window.__soLives(n);
      window.__soTele(Math.round(window.G_bossTile()) - 7);
      window.__soPump(0.1);
      window.__soBossSet({ awake: true });
      return { world: last, boss: window.__soBoss(), lives: window.__soInfo().lives };
    }, lives);
  };
  /* pump until something other than play happens, and say what it was */
  const settle = (frames = 300) => page.evaluate(n => {
    for (let i = 0; i < n; i++) window.__soPump(1 / 60);
    const S = window.Rescue && window.Rescue._state();
    return { state: window.__soInfo().state, lives: window.__soInfo().lives,
             kind: S ? S.kind : null,
             card: !!document.querySelector('.so-card-revive'),
             over: /OUT OF LIVES/.test(document.body.textContent || '') &&
                   !!document.querySelector('.so-ov-card') };
  }, frames);
  /* run whatever cutscene is up to its end, taking the fight when asked */
  const finishScene = () => page.evaluate(() => {
    for (let i = 0; i < 60 * 400; i++) {
      const S = window.Rescue && window.Rescue._state();
      if (!S || S.done) break;
      if (S.phase === 6) { if (S.sel !== 0) window.Rescue.press('left'); else window.Rescue.press('confirm'); }
      else if (S.phase === 10 && !S.ans) {
        const M = window.Rescue._moves(), need = M[S.move].need;
        window.Rescue.press(need === 'block' ? 'down' : need === 'dodge' ? 'left' : 'jump');
      } else if ((S.phase === 12 && !S.struck) || S.phase === 14) window.Rescue.press('jump');
      else if (S.phase === 22 || (S.lines && S.waiting)) window.Rescue.press('confirm');
      window.__soPump(1 / 60);
    }
    for (let i = 0; i < 120; i++) window.__soPump(1 / 60);
    return { state: window.__soInfo().state, lives: window.__soInfo().lives,
             outcome: window.Rescue ? window.Rescue.outcome() : null };
  });

  /* ---- 1. the Queen lands the killing blow ------------------------- */
  await inTheRoom('hard', 1);
  await page.evaluate(() => window.__soKill());
  let r = await settle();
  ok('hard, last life, killed by the Queen: the scene opens',
     r.state === 'cutscene' && r.kind === 'death', JSON.stringify(r));
  let done = await finishScene();
  ok('and winning it puts her back in the room with one life',
     done.state === 'play' && done.lives === 1 && done.outcome === 'fight', JSON.stringify(done));
  const kept = await page.evaluate(() => window.__soBoss());
  ok('with the Queen still standing where she left her', kept.awake === true && !kept.dead,
     `hp=${kept.hp}/${kept.hpMax}`);

  /* ---- 2. the ROOM kills her, not the Queen ------------------------ */
  await inTheRoom('hard', 1);
  const byPit = await page.evaluate(() => {
    /* a fall, inside the Queen's fight — she can just as easily be knocked
       into a pit on the last life, and that is still the fight ending */
    window.G_setHurtBy('pit');
    window.__soPlayer({ y: 99999, invuln: 0, star: 0, big: false });
    for (let i = 0; i < 300; i++) window.__soPump(1 / 60);
    const S = window.Rescue && window.Rescue._state();
    return { state: window.__soInfo().state, kind: S ? S.kind : null };
  });
  ok('hard, last life, killed by the room she is in: the scene still opens',
     byPit.state === 'cutscene' && byPit.kind === 'death', JSON.stringify(byPit));
  await finishScene();

  /* ---- 3. the chain: paid revives first, the scene only at the end -- */
  await inTheRoom('hard', 5);
  const chain = [];
  for (let round = 0; round < 4; round++) {
    await page.evaluate(() => window.__soKill());
    const st = await settle();
    chain.push({ lives: st.lives, card: st.card, state: st.state, kind: st.kind });
    if (st.card) {
      await page.evaluate(() => document.getElementById('so-revive-yes').click());
      await page.evaluate(() => { for (let i = 0; i < 60; i++) window.__soPump(1 / 60); });
      const S = await page.evaluate(() => !!(window.Rescue && window.Rescue._state() && !window.Rescue._state().done));
      if (S) await finishScene();
      await play();
    } else break;
  }
  ok('while she can afford it, she is asked rather than sent back',
     chain[0].card === true, JSON.stringify(chain[0]));
  ok('and the asking stops when she can no longer afford it',
     chain[chain.length - 1].card === false, JSON.stringify(chain[chain.length - 1]));
  ok('the lives actually come off each time she takes it',
     chain.length > 1 && chain[1].lives < chain[0].lives, chain.map(c => c.lives).join(' -> '));
  ok('and the last one opens the scene rather than a game over',
     chain[chain.length - 1].state === 'cutscene' && chain[chain.length - 1].kind === 'death',
     JSON.stringify(chain[chain.length - 1]));
  await finishScene();

  /* ---- 4. the four places it must not happen ----------------------- */
  await inTheRoom('hard', 4);
  await page.evaluate(() => window.__soKill());
  r = await settle();
  ok('more than a life left: the revive card, not the scene',
     r.state !== 'cutscene' && r.card === true, JSON.stringify(r));
  await page.evaluate(() => { const b = document.getElementById('so-revive-no'); if (b) b.click(); });
  await page.evaluate(() => { for (let i = 0; i < 60; i++) window.__soPump(1 / 60); });
  const S1 = await page.evaluate(() => !!(window.Rescue && window.Rescue._state() && !window.Rescue._state().done));
  if (S1) await finishScene();

  /* THE QUEEN ASLEEP. She has not met her yet, so there is nothing to
     lose to — and she has to be killed a long way off, because standing in
     front of the Queen wakes her again inside the half-second the death
     animation takes, which makes "asleep" untestable from arm's reach. */
  await inTheRoom('hard', 1);
  await page.evaluate(() => {
    window.__soTele(6);
    window.__soPump(0.1);
    window.__soBossSet({ awake: false });
    window.__soKill();
  });
  r = await settle();
  ok('the Queen still asleep, and a long way off: an ordinary game over',
     r.state !== 'cutscene', JSON.stringify(r));

  /* and neither Easy nor Medium has him at all */
  for (const d of ['easy', 'medium']) {
    await inTheRoom(d, 1);
    await page.evaluate(() => window.__soKill());
    r = await settle();
    /* kind is whatever scene ran LAST in this page, so it says nothing
       about whether one is running now — only the state does */
    ok(`${d}: no Anwar — that difficulty has never met him`,
       r.state !== 'cutscene' && r.over === true, JSON.stringify(r));
  }

  ok('no page errors', errs.length === 0, errs.slice(0, 3).join(' | '));
  await browser.close();
  console.log(R.join('\n'));
  const f = R.filter(r => r.startsWith('FAIL')).length;
  console.log(`\n${R.length - f} passed, ${f} failed`);
  process.exit(f ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
