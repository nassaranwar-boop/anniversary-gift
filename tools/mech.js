const { chromium } = require('playwright-core');
const R = [];
const ok = (name, cond, extra) => { R.push((cond ? 'PASS  ' : 'FAIL  ') + name + (extra ? '   ' + extra : '')); };

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox','--no-proxy-server','--disable-gpu'] });
  const page = await browser.newPage({ viewport: { width: 900, height: 560 } });
  const errors = [];
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
  page.on('console', m => { if (m.type()==='error' && !/ERR_FAILED/.test(m.text())) errors.push('CONSOLE: '+m.text()); });
  await page.route('**/*', r => r.request().url().startsWith('http://127.0.0.1') ? r.continue() : r.abort());
  await page.goto('http://127.0.0.1:8899/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(400);
  await page.evaluate(() => { window.__soTestDrive = true; });

  const boot = async (diff) => {
    await page.evaluate(() => { try{localStorage.clear();}catch(e){} showScreen('ouissy'); if (window.SuperOuissy) SuperOuissy.stop(); startSuperOuissy(); });
    await page.waitForTimeout(250);
    await page.click(`[data-so-diff="${diff}"]`); await page.click('#so-play');
    await page.waitForTimeout(200);
    const how = await page.$('#so-how-ok'); if (how) await how.click();
    await page.waitForTimeout(2200);
    await page.evaluate(() => { window.__soTestDrive = true;  });
  };
  const pump = (sec, keys) => page.evaluate(([s,k]) => window.__soPump(s,k), [sec, keys||null]);
  const tele = async (t) => { await page.evaluate(() => window.__soReset()); await page.evaluate(t2 => window.__soTele(t2), t); };
  const info = () => page.evaluate(() => window.__soInfo());

  // ---------- MEDIUM, WORLD 1 ----------
  await boot('medium');
  ok('starts on world 1 with 3 lives', (await info()).lives === 3);

  // hearts: start just before the first one in the level, wherever it is
  const firstHeart = await page.evaluate(() => (window.__soFindReachableHeart() || {}).x);
  await tele(Math.max(2, firstHeart - 3)); await pump(0.1);
  let before = (await info()).hearts;
  await pump(1.2, { right: true, jump: true }); await pump(0.6, { right: false, jump: false });
  let a = await info();
  ok('collects hearts', a.hearts > before, 'hearts=' + a.hearts);

  // a gift block with room under it, wherever this world put one
  const gift = await page.evaluate(() => window.__soFindGift('?'));
  await tele(gift.x); await pump(0.2);
  before = (await info()).score;
  await pump(0.9, { jump: true }); await pump(0.6, { jump: false });
  a = await info();
  ok('bumping a gift block scores + opens it', a.score > before && a.usedBlocks > 0,
      'score+' + (a.score - before) + ' used=' + a.usedBlocks);

  // stomp: drop her straight onto the nearest walker
  await tele(await page.evaluate(() => (window.__soFindTile('w')[0] || { x: 20 }).x - 2));
  await pump(0.15);
  before = (await info()).enemiesAlive;
  await page.evaluate(() => window.__soAboveEnemy());
  await pump(1.2, {});
  a = await info();
  ok('stomping defeats an enemy', a.enemiesAlive < before,
      before + ' -> ' + a.enemiesAlive + ' lives=' + a.lives);
  ok('stomping did not cost a life', a.lives === 3, 'lives=' + a.lives);

  // grow power-up: the M block, wherever it is
  const grow = await page.evaluate(() => window.__soFindGift('M'));
  await tele(grow.x); await pump(0.2);
  await pump(1.0, { jump: true }); await pump(0.4, { jump: false });
  await pump(2.5, { jump: false });          // it pops out and walks off the block
  /* it paces between whatever it turned at, so sweep both ways rather than
     assuming which side of her it ended up on */
  await pump(1.6, { right: true });
  await pump(2.4, { left: true });
  await pump(2.0, { right: true });
  await pump(0.3, { right: false });
  a = await info();
  ok('the grow power-up makes her big', a.big, 'big=' + a.big);

  // big Ouissy breaks a brick; small Ouissy only knocks it
  const brick = await page.evaluate(() => window.__soFindGift('B'));
  await tele(brick.x); await pump(0.2);
  let bricksBefore = (await info()).bricks;
  await pump(0.9, { jump: true }); await pump(0.5, { jump: false });
  a = await info();
  ok('small Ouissy cannot break a brick', a.bricks === bricksBefore, 'bricks=' + a.bricks);
  await page.evaluate(() => window.__soMakeBig());
  await pump(0.3, {});
  await pump(0.9, { jump: true }); await pump(0.6, { jump: false });
  a = await info();
  ok('big Ouissy breaks bricks', a.bricks < bricksBefore, bricksBefore + ' -> ' + a.bricks);

  // pit on medium is fatal
  const pit = await page.evaluate(() => window.__soFindPit());
  await tele(pit.pit); await pump(0.2);
  before = (await info()).deaths;
  await pump(3.0, {});
  a = await info();
  ok('a pit is fatal on Medium', a.deaths > before, 'deaths=' + a.deaths);

  // ---------- EASY: the cloud catches her ----------
  await boot('easy');
  ok('Easy starts with 5 lives', (await info()).lives === 5, 'lives=' + (await info()).lives);
  const pitE = await page.evaluate(() => window.__soFindPit());
  await tele(pitE.pit); await pump(0.2);
  before = (await info()).deaths;
  await pump(3.0, {});
  a = await info();
  ok('Easy catches her instead of killing her', a.deaths === before && a.lives === 5,
      'deaths=' + a.deaths + ' lives=' + a.lives);

  // ---------- HARD: a clock, 2 lives, extra spikes ----------
  await boot('hard');
  a = await info();
  ok('Hard starts with 2 lives and a clock', a.lives === 2 && a.timeLeft > 0,
      'lives=' + a.lives + ' time=' + Math.round(a.timeLeft));
  ok('Hard world 1 has hazards of its own', a.spikes + (await page.evaluate(
     () => window.__soFindTile('~').length)) > 0, 'spikes=' + a.spikes);

  // each difficulty now walks its own three worlds, so check that — not
  // that one shared map grew extra spikes
  const setsOf = async (d) => { await boot(d);
    return page.evaluate(() => window.__soWorldNames()); };
  const eSet = await setsOf('easy'), mSet = await setsOf('medium'), hSet = await setsOf('hard');
  const overlap = eSet.filter(w => mSet.includes(w) || hSet.includes(w))
                      .concat(mSet.filter(w => hSet.includes(w)));
  ok('every difficulty walks three worlds', eSet.length === 3 && mSet.length === 3 && hSet.length === 3,
     eSet.length + '/' + mSet.length + '/' + hSet.length);
  ok('no world appears in more than one set', overlap.length === 0,
     overlap.length ? 'shared: ' + overlap.join(',') : 'nine distinct worlds');

  // ---------- WORLD 3: hazards and the boss ----------
  await boot('medium');
  await page.evaluate(() => window.__soGoLevel(2));
  await page.waitForTimeout(2200);
  a = await info();
  ok('world 3 has a boss and a locked pole', a.hasBoss && !a.goalOpen);

  // walking into the moat kills
  const moat = await page.evaluate(() => (window.__soFindTile('~')[0] || {}).x);
  await tele(moat - 3); await pump(0.2);
  before = (await info()).deaths;
  await pump(2.4, { right: true });
  a = await info();
  ok('the moat is fatal', a.deaths > before, 'deaths=' + a.deaths);

  // the boss: wake him and stomp him until he is done. She is made
  // unhurtable for this — the assertion is that he CAN be beaten, not that
  // she survives six stomps with no dodging.
  await page.evaluate(() => window.__soGoLevel(2));
  for (let i = 0; i < 30; i++) { await page.waitForTimeout(200);
    if (await page.evaluate(() => window.__soInfo().state === 'play')) break; }
  await tele(await page.evaluate(() => window.__soFindTile('X').length ? 0 : 0) || (await page.evaluate(() => Math.round(G_bossTile()))));
  await pump(0.3);
  a = await info();
  const hp0 = a.bossHp;
  const phasesSeen = {};
  for (let i = 0; i < 40 && (await info()).bossHp > 0; i++) {
    await page.evaluate(() => window.__soPlayer({ invuln: 9999 }));
    await page.evaluate(() => window.__soBossStomp());
    await pump(1.4, {});
    const b = await page.evaluate(() => window.__soBoss());
    if (b) phasesSeen[b.phase] = true;
  }
  a = await info();
  ok('the boss takes six stomps, two per phase', a.bossHp <= 0 && hp0 === 6, 'hp ' + hp0 + ' -> ' + a.bossHp);
  ok('all three boss phases are reached', Object.keys(phasesSeen).length === 3,
     'phases ' + Object.keys(phasesSeen).join(','));
  ok('beating the boss opens the pole', a.goalOpen);

  // the guarantees that make him readable, measured rather than assumed
  await boot('medium');
  await page.evaluate(() => window.__soGoLevel(2));
  for (let i = 0; i < 30; i++) { await page.waitForTimeout(200);
    if (await page.evaluate(() => window.__soInfo().state === 'play')) break; }
  const watch = await page.evaluate(() => {
    window.__soTele(Math.round(G_bossTile()) - 4);
    window.__soPlayer({ invuln: 99999, star: 0 });
    window.__soBossSet({ hp: 6, hurt: 0, dead: 0, awake: true, mode: 'wait', modeT: 0.2, shots: [] });
    var maxShots = 0, minTell = 99, minOpen = 99, last = null, run = 0, attackedFrom = {};
    for (var i = 0; i < 60 * 30; i++) {
      window.__soPump(1 / 60, {});
      var b = window.__soBoss();
      maxShots = Math.max(maxShots, b.shots);
      if (b.mode !== last) {
        if (last === 'tell') minTell = Math.min(minTell, run / 60);
        if (last === 'open') minOpen = Math.min(minOpen, run / 60);
        if (b.mode === 'attack') attackedFrom[last] = true;
        last = b.mode; run = 0;
      }
      run++;
    }
    return { maxShots: maxShots, minTell: +minTell.toFixed(2), minOpen: +minOpen.toFixed(2),
             attackedFrom: Object.keys(attackedFrom) };
  });
  ok('projectiles are hard-capped', watch.maxShots <= 4, 'most on screen at once: ' + watch.maxShots);
  ok('every attack is telegraphed for at least half a second', watch.minTell >= 0.5,
     'shortest tell ' + watch.minTell + 's');
  ok('every attack is followed by an opening', watch.minOpen >= 1.0,
     'shortest opening ' + watch.minOpen + 's');
  ok('he can only attack out of a telegraph', watch.attackedFrom.length === 1 && watch.attackedFrom[0] === 'tell',
     'attacks entered from: ' + watch.attackedFrom.join(','));

  console.log(R.join('\n'));
  console.log(errors.length ? 'ERRORS: ' + errors.join(' | ') : 'no page errors');
  await browser.close();
})();
