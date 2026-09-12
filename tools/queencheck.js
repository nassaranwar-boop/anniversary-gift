/* THE QUEEN, ON EVERY DIFFICULTY.

   Two things have to be true of a boss at once: she has to be a real
   fight, and she has to be a fight that can be won. This measures both,
   and it measures them per difficulty, because each one is meant to be a
   different fight rather than the same fight at a different speed.

   The fairness numbers are the ones the design rests on:
     - the TELL is never scaled. It is the only warning there is.
     - the OPENING is long enough to cross the room and land on her.
     - the hearts on the floor are capped, and the cap is honoured.     */
const { chromium } = require('playwright-core');
const R = []; const ok = (n, c, x) => R.push((c ? 'ok   ' : 'FAIL ') + n + (x ? '   ' + x : ''));

const WANT = {
  easy:   { hp: 4, bands: [1,1,2], rage: 0 },
  medium: { hp: 7, bands: [2,2,3], rage: 1 },
  hard:   { hp: 8, bands: [2,3,3], rage: 2 },
};

(async () => {
  const browser = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args:['--no-sandbox','--no-proxy-server','--disable-gpu','--use-gl=swiftshader','--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport:{width:1180,height:900} });
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.route('**/*', r => r.request().url().startsWith('http://127.0.0.1') ? r.continue() : r.abort());
  await page.goto('http://127.0.0.1:8899/index.html', { waitUntil:'domcontentloaded', timeout:60000 });
  await page.waitForFunction(() => !!window.SuperOuissy, { timeout:30000 });

  const boot = async (d) => {
    await page.evaluate(() => { window.__soTestDrive = true; try{localStorage.clear();}catch(e){}
      if (window.SuperOuissy) SuperOuissy.stop(); showScreen('ouissy'); startSuperOuissy(); });
    await page.waitForSelector('.so-diff-card', { timeout:6000 });
    await page.click(`[data-so-diff="${d}"]`); await page.click('#so-play');
    await page.waitForTimeout(250);
    const how = await page.$('#so-how-ok'); if (how) await how.click();
    await page.waitForFunction(() => window.__soInfo().state === 'play', { timeout:8000 });
    await page.evaluate(() => window.__soGoLevel(2));
    await page.waitForFunction(() => window.__soInfo().state === 'play', { timeout:8000 });
    await page.evaluate(() => { window.__soLives(9); window.__soBossSet({ awake: true }); });
  };

  for (const d of ['easy','medium','hard']) {
    await boot(d);
    const w = WANT[d];

    /* ---- the shape of the fight ------------------------------------- */
    const b0 = await page.evaluate(() => window.__soBoss());
    ok(`${d}: she takes ${w.hp} hits`, b0.hpMax === w.hp, `hpMax=${b0.hpMax}`);

    /* walk her health down one hit at a time and watch where the phases
       change, which is what makes each difficulty its own fight */
    const bands = await page.evaluate((hp) => {
      const seen = [];
      for (let left = hp; left >= 1; left--) { window.__soBossSet({ hp: left }); seen.push(window.__soBoss().phase); }
      const out = [0,0,0];
      seen.forEach(p => out[p]++);
      return out;
    }, w.hp);
    ok(`${d}: the phases last ${w.bands.join('/')} hits`, bands.join(',') === w.bands.join(','), `got ${bands.join('/')}`);

    /* ---- every window she has to react in ---------------------------
       The phase is not settable: it is derived from her health, which is
       the right way round — so a sample of "phase 2" is taken by putting
       her health at the top of that band and leaving it there. */
    const timings = await page.evaluate((bands) => {
      const hpFor = (ph) => bands.slice(ph).reduce((a, b) => a + b, 0);
      const out = [];
      for (let ph = 0; ph < 3; ph++) {
        const hp = hpFor(ph);
        /* she watches from out of reach, and nothing may kill her mid
           sample or the numbers stop being about the boss */
        window.__soTele(4);
        window.__soPlayer({ invuln: 99999 });
        window.__soBossSet({ hp: hp });
        const seen = {};
        let mode = null, frames = 0, maxShots = 0, phaseHeld = true;
        for (let i = 0; i < 60 * 45; i++) {
          const b = window.__soBoss();
          if (b.hp !== hp) window.__soBossSet({ hp: hp });
          if (b.phase !== ph) phaseHeld = false;
          if (b.mode !== mode) {
            if (mode) seen[mode] = Math.max(seen[mode] || 0, frames / 60);
            mode = b.mode; frames = 0;
          }
          frames++;
          maxShots = Math.max(maxShots, b.shots);
          if (i % 30 === 0) window.__soPlayer({ invuln: 99999 });
          window.__soPump(1/60);
        }
        out.push({ phase: ph, held: phaseHeld, tell: seen.tell || 0, open: seen.open || 0,
                   attack: seen.attack || 0, maxShots: maxShots });
      }
      return out;
    }, w.bands);
    for (const t of timings) {
      ok(`${d} phase ${t.phase+1}: the sample really is that phase`, t.held, `held=${t.held}`);
      ok(`${d} phase ${t.phase+1}: the tell is still a tell`, t.tell >= 0.55, `tell=${t.tell.toFixed(2)}s`);
      ok(`${d} phase ${t.phase+1}: the opening is long enough to punish`, t.open >= 1.2, `open=${t.open.toFixed(2)}s`);
      ok(`${d} phase ${t.phase+1}: the floor never fills with hearts`, t.maxShots <= 6, `most at once=${t.maxShots}`);
    }

    /* ---- the last phase is where she gets worse, and only there ------ */
    const rage = await page.evaluate((bands) => {
      const hpFor = (ph) => bands.slice(ph).reduce((a, b) => a + b, 0);
      const r = {};
      window.__soBossSet({ hp: hpFor(0) }); r.first = window.__soRage();
      window.__soBossSet({ hp: hpFor(2) }); r.last  = window.__soRage();
      return r;
    }, w.bands);
    ok(`${d}: nothing extra in the first phase`, rage.first === 0, `rage=${rage.first}`);
    ok(`${d}: the last phase is ${w.rage === 0 ? 'no harder' : 'harder'}`, rage.last === w.rage, `rage=${rage.last}`);

    /* ---- and it can actually be finished ---------------------------- */
    const win = await page.evaluate(() => {
      window.__soBossSet({ hp: window.__soBoss().hpMax });
      let stomps = 0;
      for (let i = 0; i < 60 * 120 && !window.__soBoss().dead; i++) {
        const b = window.__soBoss();
        /* a player who takes every opening and nothing else. hurt > 0 is
           the flash after a hit, when landing on her does nothing — a
           second stomp inside it is not a second hit, and counting it as
           one is how a harness convinces itself it has won. */
        if (b.mode === 'open' && b.hp > 0 && b.hurt <= 0) {
          window.__soPlayer({ invuln: 3 });   /* she got there clean */
          window.__soBossStomp(); stomps++;
          for (let k = 0; k < 10; k++) window.__soPump(1/60);
        } else {
          if (i % 30 === 0) window.__soPlayer({ invuln: 3 });
          window.__soPump(1/60);
        }
      }
      return { stomps: stomps, dead: !!window.__soBoss().dead, goal: window.__soInfo().goalOpen };
    });
    ok(`${d}: punishing every opening beats her`, win.dead && win.goal, `stomps=${win.stomps} dead=${win.dead} goalOpen=${win.goal}`);
    ok(`${d}: and it took every one of her ${w.hp} hits`, win.stomps === w.hp, `stomps=${win.stomps}`);
  }

  /* the second sweep belongs to Hard alone */
  const sweeps = {};
  for (const d of ['easy','medium','hard']) {
    await boot(d);
    sweeps[d] = await page.evaluate((bands) => {
      const hp = bands[2];
      window.__soTele(4); window.__soPlayer({ invuln: 99999 });
      window.__soBossSet({ hp: hp });
      let passes = 0, was = null, tells = 0;
      for (let i = 0; i < 60 * 40; i++) {
        const b = window.__soBoss();
        if (b.hp !== hp) window.__soBossSet({ hp: hp });
        if (i % 30 === 0) window.__soPlayer({ invuln: 99999 });
        if (b.mode !== was) {
          if (b.mode === 'attack') passes++;
          if (b.mode === 'tell') tells++;
          was = b.mode;
        }
        window.__soPump(1/60);
      }
      return { passes: passes, tells: tells };
    }, WANT[d].bands);
  }
  ok('every sweep is announced, on every difficulty',
     ['easy','medium','hard'].every(d => sweeps[d].tells >= sweeps[d].passes),
     JSON.stringify(sweeps));
  ok('only Hard gets the second pass',
     sweeps.hard.passes > sweeps.medium.passes && sweeps.medium.passes >= sweeps.easy.passes - 1,
     `passes easy=${sweeps.easy.passes} medium=${sweeps.medium.passes} hard=${sweeps.hard.passes}`);

  ok('no page errors', errs.length === 0, errs.slice(0,2).join(' | '));
  await browser.close();
  console.log(R.join('\n'));
  const bad = R.filter(r => r.startsWith('FAIL')).length;
  console.log(`\n${R.length - bad} passed, ${bad} failed`);
  process.exit(bad ? 1 : 0);
})();
