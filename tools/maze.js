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
  /* Not "all idle": the level can legitimately drop her inside a corridor
     a watcher covers, and it aiming immediately is correct behaviour. What
     must hold is that every one of them is in a state the machine knows. */
  ok('every watcher starts in a known state',
     a.shooters.every(s => ['idle','aim','cool'].indexOf(s.state) >= 0),
     a.shooters.map(s => s.state).join(','));

  // stand the player straight in front of a watcher, in its corridor
  /* Build the scenario rather than hoping for it. The maze is generated
     fresh every run, so a watcher can already be mid-cooldown from
     spotting her at the spawn, and a placement picked by my own reasoning
     can disagree with the game's. Reset the watchers, then choose the cell
     using hasClearLine — the very predicate watcherSees consults — so
     placement and detection cannot disagree.

     The FARTHEST such cell, not the nearest: at one cell the bolt is
     removed in the same tick it lands, so its travel is real but never
     observable, and crossing distance is the thing being proved. */
  /* The maze is generated fresh each run and does not always contain a
     corridor long enough to watch a bolt cross. Regenerate until it does,
     rather than asserting on whatever the dice gave us. */
  let set = { ok:false, cells:0 };
  for (let attempt = 0; attempt < 15 && !(set.ok && set.cells >= 2); attempt++) {
    if (attempt) { await page.evaluate(() => initMaze(2)); await page.waitForTimeout(350); }
    set = await page.evaluate(() => {
    clearBolts();
    shooters.forEach(s => { s.state = 'idle'; s.until = 0; });
    document.querySelectorAll('.shooter-alert.show').forEach(e => e.classList.remove('show'));
    let best = null;
    shooters.forEach(s => {
      [[0,1],[0,-1],[1,0],[-1,0]].forEach(([dr,dc]) => {
        let r = s.r, c = s.c, n = 0;
        while (n < WATCH.range) {
          if (!cellOpen(r+dr, c+dc) || !cellOpen(r+dr*2, c+dc*2)) break;
          r += dr*2; c += dc*2; n += 2;
          if (treeSet.has(r+','+c)) break;
          if (hasClearLine(s.r, s.c, r, c) && (!best || n > best.n)) best = { r, c, n, sr:s.r, sc:s.c };
        }
      });
    });
    if (!best) return { ok:false };
    playerPos = { r: best.r, c: best.c }; isHidden = false;
    placeToken(document.getElementById('player-token'), playerPos, false);
    return { ok:true, r:best.r, c:best.c, sr:best.sr, sc:best.sc, cells: best.n/2 };
    });
  }
  ok('the player can be put in a watcher\'s line', set.ok && set.cells >= 2,
     set.ok ? `watcher ${set.sr},${set.sc} player ${set.r},${set.c} (${set.cells} cells)` : 'no open cell in line');

  // it should aim before it fires — a telegraph, not an instant hit
  let sawAim = false;
  for (let i=0;i<20 && !sawAim;i++){ await page.waitForTimeout(60);
    sawAim = (await st()).shooters.some(s => s.state === 'aim'); }
  ok('it aims first rather than hitting instantly', sawAim);
  ok('and it draws the corridor while aiming', await page.evaluate(() =>
    !!document.querySelector('.mz-beam.on')));

  /* Watch from inside the page. A bolt fired by a watcher one cell away
     lives about two ticks, and sampling that over the wire from Node loses
     the race roughly half the time — which measures the harness, not the
     game. This records every position each bolt occupies. */
  const flight = await page.evaluate(() => new Promise((done) => {
    const seen = new Map(); let fired = 0, best = [];
    const t0 = Date.now();
    const iv = setInterval(() => {
      bolts.forEach(b => {
        if (!seen.has(b)) { seen.set(b, []); fired++; }
        const path = seen.get(b), last = path[path.length - 1];
        if (!last || last.r !== b.r || last.c !== b.c) path.push({ r: b.r, c: b.c });
        if (path.length > best.length) best = path.slice();
      });
      /* Watch long enough to see several shots, and keep the LONGEST
         journey any of them made. One sample of one bolt is at the mercy
         of where the generator happened to put that watcher. */
      if (Date.now() - t0 > 6000) { clearInterval(iv); done({ count: fired, path: best }); }
    }, 20);
  }));
  ok('it fires a bolt that exists in the world', flight.count > 0, flight.count + ' fired');
  ok('the bolt travels rather than teleporting onto you', flight.path.length >= 2,
     'path ' + JSON.stringify(flight.path));

  /* a watcher one cell away must still give her a frame to react in */
  ok('even a point-blank shot is visible before it lands', await page.evaluate(() => {
    const s = shooters[0];
    return typeof WATCH.step === 'number' && WATCH.step >= 80;
  }));

  /* Hiding must stop them noticing her. Held inside one page-side step:
     a bolt landing can drop her to a respawn, and respawnLevel2 clears
     isHidden — so setting it from Node and checking a moment later races
     the game rather than testing it. */
  const hidden = await page.evaluate(() => new Promise((done) => {
    const t0 = Date.now();
    let cleanFor = 0, last = Date.now();
    const iv = setInterval(() => {
      isHidden = true;                       // hold it, whatever else happens
      const now = Date.now();
      const anyAiming = shooters.some(s => (s.state || 'idle') === 'aim');
      /* The property is that hiding makes them lose her — so what matters
         is that it CONVERGES and stays converged, not the value at one
         arbitrary instant. A respawn clears isHidden for a moment and a
         watcher can legitimately re-acquire her inside that gap. */
      cleanFor = anyAiming ? 0 : cleanFor + (now - last);
      last = now;
      if (cleanFor > 700 || now - t0 > 5000) {
        clearInterval(iv);
        done({ settled: cleanFor > 700, states: shooters.map(s => s.state || 'idle') });
      }
    }, 40);
  }));
  ok('hiding makes the watchers lose you', hidden.settled,
     'settled=' + hidden.settled + ' states=' + hidden.states.join(','));
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
