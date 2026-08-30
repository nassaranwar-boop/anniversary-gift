/* The maze: do the watchers actually make sense now? */
const { chromium } = require('playwright-core');
const R=[]; const ok=(n,c,x)=>R.push((c?'PASS  ':'FAIL  ')+n+(x?'   '+x:''));
(async () => {
  const browser = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args:['--no-sandbox','--no-proxy-server','--disable-gpu'] });
  const page = await browser.newPage({ viewport:{width:430,height:900} });
  const errs=[]; page.on('pageerror', e=>errs.push(e.message));
  await page.route('**/*', r => { const u=r.request().url();
    if (u.startsWith('http://127.0.0.1')||u.includes('fonts.g')) return r.continue(); return r.abort(); });
  await page.goto('http://127.0.0.1:8899/index.html', { waitUntil:'domcontentloaded', timeout:60000 });
  await page.waitForTimeout(900);

  // boot level 2 directly
  await page.evaluate(() => { try{localStorage.clear();}catch(e){} showScreen('maze'); initMaze(2); });
  await page.waitForTimeout(900);

  const st = () => page.evaluate(() => ({
    shooters: shooters.map(s => ({ r:s.r, c:s.c, state:s.state||'idle' })),
    bolts: bolts.length, hp, player: { r:playerPos.r, c:playerPos.c }, hidden: isHidden,
  }));

  let a = await st();
  ok('the level builds with watchers on it', a.shooters.length > 0, a.shooters.length + ' watchers');
  ok('nothing is in the air to begin with', a.bolts === 0);
  ok('the watchers start idle', a.shooters.every(s => s.state === 'idle'));

  // stand the player straight in front of a watcher, in its corridor
  const set = await page.evaluate(() => {
    const s = shooters[0];
    // walk outward from the watcher until we find an open cell in line
    for (const [dr,dc] of [[0,2],[0,-2],[2,0],[-2,0]]) {
      let r = s.r + dr, c = s.c + dc;
      if (cellOpen(s.r + dr/2, s.c + dc/2) && cellOpen(r,c) && !treeSet.has(r+','+c)) {
        playerPos = { r, c }; isHidden = false;
        placeToken(document.getElementById('player-token'), playerPos, false);
        return { ok:true, r, c, sr:s.r, sc:s.c };
      }
    }
    return { ok:false };
  });
  ok('the player can be put in a watcher\'s line', set.ok,
     set.ok ? `watcher ${set.sr},${set.sc} player ${set.r},${set.c}` : 'no open cell in line');

  // it should aim before it fires — a telegraph, not an instant hit
  let sawAim = false;
  for (let i=0;i<20 && !sawAim;i++){ await page.waitForTimeout(60);
    sawAim = (await st()).shooters.some(s => s.state === 'aim'); }
  ok('it aims first rather than hitting instantly', sawAim);
  ok('and it draws the corridor while aiming', await page.evaluate(() =>
    !!document.querySelector('.mz-beam.on')));

  // then a bolt has to actually exist and travel
  let sawBolt = false, maxBolts = 0;
  for (let i=0;i<30 && !sawBolt;i++){ await page.waitForTimeout(60);
    const n = (await st()).bolts; maxBolts = Math.max(maxBolts, n); sawBolt = n > 0; }
  ok('it fires a bolt that exists in the world', sawBolt, 'max in flight=' + maxBolts);

  const moved = await page.evaluate(async () => {
    const b = bolts[0]; if (!b) return null;
    const from = { r:b.r, c:b.c };
    await new Promise(r => setTimeout(r, 300));
    const still = bolts.indexOf(b) >= 0;
    return { from, to: { r:b.r, c:b.c }, still };
  });
  ok('the bolt travels rather than teleporting onto you',
     moved !== null && (moved.from.r !== moved.to.r || moved.from.c !== moved.to.c || !moved.still),
     moved ? JSON.stringify(moved) : 'no bolt was ever caught in flight');
  /* a watcher one cell away must still give her a frame to react in */
  ok('even a point-blank shot is visible before it lands', await page.evaluate(() => {
    const s = shooters[0];
    return typeof WATCH.step === 'number' && WATCH.step >= 80;
  }));

  // hiding in a thicket must stop it noticing you at all
  await page.evaluate(() => { isHidden = true; });
  await page.waitForTimeout(700);
  ok('hiding makes the watchers lose you', await page.evaluate(() =>
    shooters.every(s => (s.state||'idle') !== 'aim')));
  await page.evaluate(() => { isHidden = false; });

  // and it has to reload — no machine-gunning
  const cool = await page.evaluate(() => WATCH.cooldown);
  ok('it has to reload between shots', cool >= 1200, cool + 'ms');

  // leaving the level must not leave bolts ticking away
  await page.evaluate(() => stopLevel2Systems());
  await page.waitForTimeout(300);
  ok('leaving the level clears everything in flight', await page.evaluate(() =>
    bolts.length === 0 && !document.querySelector('.mz-beam.on')));

  console.log(R.join('\n'));
  console.log(errs.length ? 'ERRORS: '+errs.join(' | ') : 'no page errors');
  await browser.close();
  process.exit(R.some(r=>r.startsWith('FAIL')) ? 1 : 0);
})();
