/* EVERYTHING THAT MOVES, AND WHETHER ANY OF IT BREAKS DOWN.

   Three kinds of platform (sliding, rising, blinking), three kinds of enemy
   (walker, flyer, guard), six power-ups and the blocks they come out of, on
   every world and every difficulty. The interesting failures here are not
   "it does not appear" — they are drift, NaN, a platform that wanders out of
   the level after two minutes, a blinking one that never comes back, an
   enemy that falls through the floor, a rider carried into a wall. So most
   of this is a SOAK: run the world for two minutes of game time with nobody
   touching it, and check that everything is still where its own rules say
   it should be. */
const { chromium } = require('playwright-core');
const R = []; const ok = (n, c, x) => R.push((c ? 'ok   ' : 'FAIL ') + n + (x ? '   ' + x : ''));
const fin = v => typeof v === 'number' && isFinite(v);

(async () => {
  const browser = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args:['--no-sandbox','--no-proxy-server','--disable-gpu','--use-gl=swiftshader','--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport:{width:1180,height:900} });
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.route('**/*', r => r.request().url().startsWith('http://127.0.0.1') ? r.continue() : r.abort());
  await page.goto('http://127.0.0.1:8899/index.html', { waitUntil:'domcontentloaded', timeout:60000 });
  await page.waitForFunction(() => !!window.SuperOuissy, { timeout:30000 });
  const play = () => page.waitForFunction(() => window.__soInfo().state === 'play', { timeout:15000 });
  const boot = async (d) => {
    await page.evaluate(() => { window.__soTestDrive = true; try{localStorage.clear();}catch(e){}
      SuperOuissy.stop(); showScreen('ouissy'); startSuperOuissy(); });
    await page.waitForSelector('.so-diff-card', { timeout:6000 });
    await page.click(`[data-so-diff="${d}"]`); await page.click('#so-play');
    await page.waitForTimeout(250);
    const how = await page.$('#so-how-ok'); if (how) await how.click();
    await play();
  };
  const go = async (i) => { await page.evaluate(x => window.__soGoLevel(x), i); await play(); };

  /* ---- 1. is every moving thing in the game actually IN the game? ---- */
  await boot('medium');
  const census = { movers: {}, enemies: {}, items: {} };
  for (const w of [0, 1, 2]) {
    await go(w);
    const c = await page.evaluate(() => {
      const m = {}, e = {}, it = {};
      window.__soMovers().forEach(o => m[o.type] = (m[o.type] || 0) + 1);
      window.__soEnemies().forEach(o => e[o.type] = (e[o.type] || 0) + 1);
      /* three of the six only ever exist INSIDE a block, so counting
         loose items alone reports them missing from a game that has them */
      const BLOCK = { heart:'?', grow:'M', star:'I', life:'1', boost:'P', wing:'F' };
      ['heart','grow','star','life','boost','wing'].forEach(t => {
        const n = window.__soFindItem(t).length + window.__soFindTile(BLOCK[t]).length;
        if (n) it[t] = n;
      });
      return { m, e, it };
    });
    for (const k in c.m) census.movers[k] = (census.movers[k] || 0) + c.m[k];
    for (const k in c.e) census.enemies[k] = (census.enemies[k] || 0) + c.e[k];
    for (const k in c.it) census.items[k] = (census.items[k] || 0) + c.it[k];
  }
  for (const t of ['H','V','T'])
    ok(`the ${({H:'sliding',V:'rising',T:'blinking'})[t]} platform exists somewhere`,
       (census.movers[t] || 0) > 0, `${census.movers[t] || 0}`);
  for (const t of ['walker','flyer','guard'])
    ok(`the ${t} exists somewhere`, (census.enemies[t] || 0) > 0, `${census.enemies[t] || 0}`);
  for (const t of ['heart','grow','star','life','boost','wing'])
    ok(`the ${t} exists somewhere`, (census.items[t] || 0) > 0, `${census.items[t] || 0}`);

  /* ---- 2. the soak: two minutes per world, nobody touching anything --- */
  for (const w of [0, 1, 2]) {
    await go(w);
    const before = await page.evaluate(() => ({
      m: window.__soMovers(), e: window.__soEnemies(),
      box: window.__soLevelBox(),
    }));
    /* WALK THE WHOLE LEVEL. Enemies off screen are deliberately frozen, so
       parking her at the start and pumping for two minutes exercises the
       first screen and nothing else. She is moved along in twelve stops
       instead, and kept invulnerable, because a death would end the soak
       and turn every later assertion into a lie. */
    const soak = await page.evaluate(() => {
      const box = window.__soLevelBox();
      /* stop short of the flagpole: walking into it finishes the world, and
         a soak that ends on a results card has not soaked anything */
      const end = (window.__soGoalTile() || box.w) - 6;
      const stops = 12, secs = 10;
      for (let sN = 0; sN < stops; sN++) {
        const tx = Math.round(4 + (end - 6) * (sN / (stops - 1)));
        window.__soTele(tx);
        for (let i = 0; i < 60 * secs; i++) {
          if (i % 30 === 0) window.__soPlayer({ invuln: 99, dead: 0 });
          window.__soPump(1 / 60);
        }
        if (window.__soInfo().state !== 'play') return { stop: sN, state: window.__soInfo().state };
      }
      return { stop: stops, state: window.__soInfo().state };
    });
    const after = await page.evaluate(() => ({
      m: window.__soMovers(), e: window.__soEnemies(), state: window.__soInfo().state,
    }));
    const W = `world ${w + 1}`;
    ok(`${W}: two minutes with every screen running, and it is still playing`,
       soak.state === 'play' && after.state === 'play', `stopped at ${soak.stop}, state=${soak.state}`);

    /* every platform: finite, home-bound, and moving on the axis it should */
    const bad = [];
    after.m.forEach((m, i) => {
      const b = before.m[i];
      if (!fin(m.x) || !fin(m.y) || !fin(m.dx) || !fin(m.dy)) bad.push(`${m.type}#${i} not a number`);
      if (m.type === 'H') {
        if (m.x < b.homeX - 1 || m.x > b.homeX + b.span + 1) bad.push(`${m.type}#${i} left its rail (${m.x|0} vs ${b.homeX|0}..${(b.homeX+b.span)|0})`);
        if (Math.abs(m.y - b.homeY) > 0.01) bad.push(`${m.type}#${i} drifted vertically`);
      } else if (m.type === 'V') {
        if (m.y > b.homeY + 1 || m.y < b.homeY - b.span - 1) bad.push(`${m.type}#${i} left its shaft`);
        if (Math.abs(m.x - b.homeX) > 0.01) bad.push(`${m.type}#${i} drifted horizontally`);
      } else {
        if (m.x !== b.homeX || m.y !== b.homeY) bad.push(`${m.type}#${i} moved, and it should not`);
        if (m.on !== true && m.timer > 2.2) bad.push(`${m.type}#${i} went away and stayed away`);
      }
    });
    ok(`${W}: no platform drifted, wandered or became NaN`, bad.length === 0, bad.slice(0, 3).join('; '));

    /* every enemy: finite, inside the level, not sunk through the floor */
    const ebad = [];
    after.e.forEach((e, i) => {
      if (!fin(e.x) || !fin(e.y)) ebad.push(`${e.type}#${i} not a number`);
      if (!e.alive) return;
      if (e.x < -32 || e.x > before.box.w * 16 + 32) ebad.push(`${e.type}#${i} left the level (x=${e.x})`);
      if (e.y > before.box.h * 16 + 32) ebad.push(`${e.type}#${i} fell out of the world (y=${e.y})`);
    });
    ok(`${W}: no enemy escaped, sank or became NaN`, ebad.length === 0, ebad.slice(0, 3).join('; '));
    ok(`${W}: they are all still alive — nothing killed itself`,
       after.e.filter(e => e.alive).length === before.e.filter(e => e.alive).length,
       `${before.e.filter(e => e.alive).length} -> ${after.e.filter(e => e.alive).length}`);
  }

  /* ---- 3. the sliding and rising ones actually carry her -------------- */
  await go(0);
  for (const type of ['H', 'V']) {
    const res = await page.evaluate(t => {
      let idx = -1;
      for (const w of [0, 1, 2]) {
        window.__soGoLevel(w); window.__soSkipCard();
        idx = window.__soMovers().findIndex(m => m.type === t);
        if (idx >= 0) break;
      }
      if (idx < 0) return null;
      window.__soPlayer({ invuln: 99 });
      window.__soRide(idx);
      const p0 = window.__soPlayer(), m0 = window.__soMovers()[idx];
      for (let i = 0; i < 90; i++) window.__soPump(1 / 60);
      const p1 = window.__soPlayer(), m1 = window.__soMovers()[idx];
      return { moved: t === 'H' ? Math.abs(m1.x - m0.x) : Math.abs(m1.y - m0.y),
               carried: t === 'H' ? Math.abs(p1.x - p0.x) : Math.abs(p1.y - p0.y),
               gap: Math.round((p1.y + 15) - m1.y), riding: m1.riding, dead: p1.dead };
    }, type);
    const name = type === 'H' ? 'the sliding platform' : 'the rising platform';
    if (!res) { ok(`${name}: found one to stand on`, false); continue; }
    ok(`${name} moves`, res.moved > 3, `${res.moved.toFixed(1)}px in 1.5s`);
    ok(`${name} takes her with it`, res.carried > 2, `she moved ${res.carried.toFixed(1)}px`);
    ok(`${name} does not drop her through itself`, Math.abs(res.gap) < 8, `gap=${res.gap}`);
    ok(`${name} does not kill her by carrying her`, !res.dead);
  }

  /* ---- 4. the blinking one goes AND comes back ------------------------ */
  const blink = await page.evaluate(() => {
    for (const w of [0, 1, 2]) {
      window.__soGoLevel(w); window.__soSkipCard();
      const idx = window.__soMovers().findIndex(m => m.type === 'T');
      if (idx < 0) continue;
      window.__soRide(idx);
      const home = window.__soMovers()[idx];
      let wentOff = false, cameBack = false, offFrames = 0;
      for (let i = 0; i < 60 * 12; i++) {
        window.__soPump(1 / 60);
        const m = window.__soMovers()[idx];
        if (!m.on) { wentOff = true; offFrames++; }
        else if (wentOff) { cameBack = true; break; }
      }
      const m = window.__soMovers()[idx];
      return { world: w, wentOff, cameBack, offSecs: offFrames / 60,
               samePlace: m.x === home.homeX && m.y === home.homeY, on: m.on, fade: m.fade };
    }
    return null;
  });
  if (blink) {
    ok('the blinking platform goes when she stands on it', blink.wentOff === true);
    ok('and it comes back', blink.cameBack === true, `off for ${blink.offSecs.toFixed(1)}s`);
    ok('in exactly the same place, so it can never strand her', blink.samePlace === true);
    ok('and it is solid again when it does', blink.on === true && blink.fade === 1, `on=${blink.on} fade=${blink.fade}`);
  } else ok('a blinking platform to stand on', false);
  await play();

  /* ---- 5. every enemy: stomping kills it, walking into it hurts ------- */
  for (const type of ['walker', 'flyer', 'guard']) {
    const res = await page.evaluate(t => {
      for (const w of [0, 1, 2]) {
        window.__soGoLevel(w); window.__soSkipCard();
        const list = window.__soEnemies();
        const i = list.findIndex(e => e.type === t && e.alive);
        if (i < 0) continue;
        /* stomp: drop onto it from above */
        window.__soLives(9);
        const before = window.__soInfo();
        window.__soPlayer({ big: false, star: 0, wing: false });
        window.__soAboveEnemy(i);
        let killed = false;
        for (let k = 0; k < 180 && !killed; k++) {
          window.__soPump(1 / 60);
          const e = window.__soEnemies()[i];
          if (e && !e.alive) killed = true;
        }
        const mid = window.__soInfo();
        /* side-on: put her level with another one of the same kind */
        window.__soGoLevel(w); window.__soSkipCard();
        const list2 = window.__soEnemies();
        const j = list2.findIndex(e => e.type === t && e.alive);
        window.__soLives(9); window.__soPlayer({ invuln: 0, star: 0, big: false });
        const e2 = window.__soEnemies()[j];
        window.__soPlayer({ x: e2.x, y: e2.y, invuln: 0 });
        let hurt = false;
        for (let k = 0; k < 30 && !hurt; k++) {
          window.__soPump(1 / 60);
          if (window.__soPlayer().dead) hurt = true;
        }
        return { world: w, killed, hurt, scored: mid.score > before.score };
      }
      return null;
    }, type);
    if (!res) { ok(`${type}: one to test`, false); continue; }
    ok(`the ${type} can be stomped`, res.killed === true, `world ${res.world + 1}`);
    ok(`and stomping it scores`, res.scored === true);
    ok(`and walking into the ${type} hurts her`, res.hurt === true);
  }
  await play();

  /* ---- 6. every power-up does the thing it says ----------------------- */
  /* Three of the four live only inside blocks, so each is tried loose
     FIRST and bumped out of its block otherwise — "no loose one exists"
     is not the same finding as "it does not work". */
  const POW = {
    grow:  p => p.big === true,
    star:  p => p.star > 0,
    boost: p => p.boost > 0,
    wing:  p => p.wing === true,
  };
  const BLOCK = { grow:'M', star:'I', boost:'P', wing:'F' };
  for (const t of ['grow', 'star', 'boost', 'wing']) {
    const res = await page.evaluate(({ type, ch }) => {
      const clean = () => window.__soPlayer({ big:false, star:0, wing:false, boost:0, invuln:99, dead:0 });
      for (const w of [0, 1, 2]) {
        window.__soGoLevel(w); window.__soSkipCard();
        const loose = window.__soFindItem(type);
        if (loose.length) {
          clean();
          window.__soPlayer({ x: loose[0].x * 16, y: loose[0].y * 16 });
          for (let k = 0; k < 60; k++) window.__soPump(1 / 60);
          const p = window.__soPlayer();
          return { world: w, how: 'loose', big:p.big, star:p.star, wing:p.wing, boost:p.boost };
        }
        /* WHERE SHE HAS TO STAND TO BUMP IT.

           Three of these blocks hang in the sky over a one-way ledge —
           that is the point of them, they are the secrets. A probe that
           asks solidAt what is underneath sees nothing at all and reports
           a power-up that cannot be reached, which is a lie about a level
           that is fine. The ledge has to be found by asking what she can
           STAND on, which includes the one-ways. */
        const hits = window.__soFindTile(ch);
        if (!hits.length) continue;
        const box = window.__soLevelBox();
        let g = null;
        for (const t2 of hits) {
          let y = t2.y + 1;
          while (y < box.h && !window.__soStand(t2.x, y)) y++;
          if (y < box.h && y - t2.y >= 2 && y - t2.y <= 6) { g = { x: t2.x, y: t2.y, floor: y }; break; }
        }
        if (!g) continue;
        /* stood ON the ledge, not dropped from above it: the block is
           solid and two tiles up, so a drop that starts any higher starts
           INSIDE it and gets shoved a tile sideways, which looks exactly
           like a block that will not open */
        clean();
        window.__soPlayer({ x: g.x * 16 + 3, y: g.floor * 16 - 15, vy: 0, vx: 0 });
        for (let k = 0; k < 12; k++) window.__soPump(1 / 60);
        clean();
        /* PULSE the jump rather than holding it: holding is one jump, and
           if that one misses the block the test reports a broken power-up
           when what actually happened is the harness stood in the wrong
           place. */
        let outAt = -1;
        for (let k = 0; k < 420 && outAt < 0; k++) {
          window.__soPlayer({ x: g.x * 16 + 3 });   /* hold her under it */
          window.__soPump(1 / 60, { jump: k % 36 < 10 });
          if (window.__soFindItem(type).length) outAt = k;
        }
        if (outAt < 0) return { world: w, how: 'block(never came out)', at: g };
        /* then go and get it: it walks off the block, so she is put back on
           it until it is hers */
        clean();
        for (let k = 0; k < 260; k++) {
          const li = window.__soFindItem(type);
          if (li.length) window.__soPlayer({ x: li[0].x * 16, y: li[0].y * 16 - 2, invuln: 99 });
          window.__soPump(1 / 60);
          const p = window.__soPlayer();
          if (p.big || p.star > 0 || p.wing || p.boost > 0) break;
        }
        const p = window.__soPlayer();
        return { world: w, how: 'block', big:p.big, star:p.star, wing:p.wing, boost:p.boost };
      }
      return null;
    }, { type: t, ch: BLOCK[t] });
    if (!res) { ok(`${t}: one in the levels, loose or in a block`, false); continue; }
    ok(`the ${t} applies when she gets it`, POW[t](res), `${res.how}, ${JSON.stringify(res)}`);
  }
  /* a heart is worth a heart, and a life is worth a life */
  const heart = await page.evaluate(() => {
    window.__soGoLevel(0); window.__soSkipCard();
    const h = window.__soFindReachableHeart();
    const before = window.__soInfo();
    window.__soPlayer({ x: h.x * 16, y: h.y * 16, invuln: 4 });
    for (let k = 0; k < 40; k++) window.__soPump(1 / 60);
    const after = window.__soInfo();
    return { got: after.hearts - before.hearts, score: after.score - before.score };
  });
  ok('a heart is collected once, not twice', heart.got === 1, `+${heart.got}`);
  ok('and it scores', heart.score > 0, `+${heart.score}`);

  /* a gift block bumped from underneath gives up what is in it */
  const gift = await page.evaluate(() => {
    for (const w of [0, 1, 2]) {
      window.__soGoLevel(w); window.__soSkipCard();
      const g = window.__soFindGift('?');
      if (!g) continue;
      const before = window.__soInfo().hearts;
      window.__soTele(g.x);
      for (let k = 0; k < 30; k++) window.__soPump(1 / 60);
      for (let k = 0; k < 150; k++) window.__soPump(1 / 60, { jump: true });
      return { world: w, gained: window.__soInfo().hearts - before };
    }
    return null;
  });
  ok('a gift block gives up what is in it when she hits it',
     !!gift && gift.gained >= 1, gift ? `+${gift.gained}` : 'no block found');

  /* ---- 7. and none of it breaks when the level is put back ------------ */
  const reset = await page.evaluate(() => {
    window.__soGoLevel(1); window.__soSkipCard();
    const e0 = window.__soEnemies();
    /* kill a few, then put the world back the way a respawn does */
    for (let i = 0; i < Math.min(3, e0.length); i++) {
      window.__soAboveEnemy(i);
      for (let k = 0; k < 150; k++) window.__soPump(1 / 60);
    }
    const downed = window.__soEnemies().filter(e => !e.alive).length;
    window.__soReset();
    const e1 = window.__soEnemies();
    return { downed, back: e1.every(e => e.alive),
             home: e1.every((e, i) => Math.abs(e.x - e0[i].x) < 2 && Math.abs(e.y - e0[i].y) < 2) };
  });
  ok('enemies can be put down', reset.downed > 0, `${reset.downed}`);
  ok('and they all come back on a restart', reset.back === true);
  ok('at the places they started, not where they died', reset.home === true);

  ok('no page errors through any of it', errs.length === 0, errs.slice(0, 3).join(' | '));
  await browser.close();
  console.log(R.join('\n'));
  const f = R.filter(r => r.startsWith('FAIL')).length;
  console.log(`\n${R.length - f} passed, ${f} failed`);
  process.exit(f ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
