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

  // hearts: run along the arc at tiles 16-20
  await tele(14); await pump(0.1);
  let before = (await info()).hearts;
  await pump(1.2, { right: true, jump: true }); await pump(0.6, { right: false, jump: false });
  let a = await info();
  ok('collects hearts', a.hearts > before, 'hearts=' + a.hearts);

  // gift block at tile 21: jump under it
  await tele(21); await pump(0.2);
  before = (await info()).score;
  await pump(0.9, { jump: true }); await pump(0.6, { jump: false });
  a = await info();
  ok('bumping a gift block scores + opens it', a.score > before && a.usedBlocks > 0,
      'score+' + (a.score - before) + ' used=' + a.usedBlocks);

  // stomp: drop her straight onto the nearest walker
  await tele(26); await pump(0.15);
  before = (await info()).enemiesAlive;
  await page.evaluate(() => window.__soAboveEnemy());
  await pump(1.2, {});
  a = await info();
  ok('stomping defeats an enemy', a.enemiesAlive < before,
      before + ' -> ' + a.enemiesAlive + ' lives=' + a.lives);
  ok('stomping did not cost a life', a.lives === 3, 'lives=' + a.lives);

  // grow power-up: the M block at tile 42
  await tele(42); await pump(0.2);
  await pump(1.0, { jump: true }); await pump(0.4, { jump: false });
  await pump(2.5, { jump: false });          // it pops out and walks off the block
  await pump(0.6, { right: true });          // she walks into it
  a = await info();
  ok('the grow power-up makes her big', a.big, 'big=' + a.big);

  // big Ouissy breaks a brick; small Ouissy only knocks it
  await tele(41); await pump(0.2);
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
  await tele(49); await pump(0.2);
  before = (await info()).deaths;
  await pump(3.0, {});
  a = await info();
  ok('a pit is fatal on Medium', a.deaths > before, 'deaths=' + a.deaths);

  // ---------- EASY: the cloud catches her ----------
  await boot('easy');
  ok('Easy starts with 5 lives', (await info()).lives === 5, 'lives=' + (await info()).lives);
  await tele(49); await pump(0.2);
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
  ok('Hard adds extra spikes to world 1', a.spikes > 0, 'spikes=' + a.spikes);

  await boot('medium');
  const medSpikes = (await info()).spikes;
  await boot('hard');
  ok('Hard has strictly more spikes than Medium', (await info()).spikes > medSpikes,
     'medium=' + medSpikes + ' hard=' + (await info()).spikes);

  // ---------- WORLD 3: hazards and the boss ----------
  await boot('medium');
  await page.evaluate(() => window.__soGoLevel(2));
  await page.waitForTimeout(2200);
  a = await info();
  ok('world 3 has a boss and a locked pole', a.hasBoss && !a.goalOpen);

  // walking into the moat kills
  await tele(20); await pump(0.2);
  before = (await info()).deaths;
  await pump(2.4, { right: true });
  a = await info();
  ok('the moat is fatal', a.deaths > before, 'deaths=' + a.deaths);

  // the boss: wake him and stomp him until he is done
  await page.evaluate(() => window.__soGoLevel(2));
  await page.waitForTimeout(2200);
  await tele(182); await pump(0.3);
  a = await info();
  const hp0 = a.bossHp;
  for (let i = 0; i < 40 && (await info()).bossHp > 0; i++) {
    await page.evaluate(() => window.__soBossStomp());
    await pump(1.4, {});
  }
  a = await info();
  ok('the boss can be defeated', a.bossHp <= 0, 'hp ' + hp0 + ' -> ' + a.bossHp);
  ok('beating the boss opens the pole', a.goalOpen);

  console.log(R.join('\n'));
  console.log(errors.length ? 'ERRORS: ' + errors.join(' | ') : 'no page errors');
  await browser.close();
})();
