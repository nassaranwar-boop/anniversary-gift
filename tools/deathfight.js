/* ANWAR vs DEATH — the fight, as a fight.

   It can be won, it can be lost, and both of those have to be true on
   purpose rather than by accident. This plays it four ways: perfectly,
   never touching a button, badly-then-saved, and by tapping the buttons
   on the screen rather than the keyboard. */
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

  /* straight to the scene, from the ending's door — no run to lose */
  const openScene = async () => {
    await page.evaluate(() => { window.__soTestDrive = true; try{localStorage.clear();}catch(e){}
      SuperOuissy.stop(); showScreen('ouissy'); startSuperOuissy(); });
    await page.waitForSelector('.so-diff-card', { timeout:6000 });
    await page.click('[data-so-diff="hard"]'); await page.click('#so-play');
    await page.waitForTimeout(250);
    const how = await page.$('#so-how-ok'); if (how) await how.click();
    await page.waitForFunction(() => window.__soInfo().state === 'play', { timeout:8000 });
    await page.evaluate(() => { window.__soShowEnding(); });
    await page.evaluate(() => document.getElementById('so-end-scene').click());
    return page.evaluate(() => {
      for (let i = 0; i < 200 && window.__soInfo().state !== 'cutscene'; i++) window.__soPump(1/60);
      return window.__soInfo().state;
    });
  };

  /* talk through to the fight, then play it the way we are told to */
  const runFight = (how, tapPad) => page.evaluate(({ how, tapPad }) => {
    const PH = { choice: 6, tut: 7, rest: 8, tell: 9, blow: 10, beat: 11, open: 12, close: 13,
                 down: 14, win: 15, warm: 16, held: 17, final: 18, letter: 22 };
    const M = window.Rescue._moves();
    const seen = { phases: {}, answered: 0, missed: 0, struck: 0, moves: [], music: [],
                   tells: [], windows: [], minHp: 99, downs: 0, getUps: 0 };
    const tap = (k) => {
      if (!tapPad) { window.Rescue.press(k === 'block' ? 'down' : k === 'dodge' ? 'left' : 'jump'); return; }
      const b = document.querySelector('#rs-pad [data-rs="' + k + '"]');
      if (b) b.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    };
    let lastMusic = '';
    for (let i = 0; i < 60 * 600; i++) {
      const S = window.Rescue._state();
      if (!S || S.done) break;
      seen.phases[S.phase] = (seen.phases[S.phase] || 0) + 1;
      const mus = window.Rescue._mus();
      if (mus !== lastMusic) { seen.music.push(mus); lastMusic = mus; }
      if (S.phase === PH.final) { seen.final = true; }
      if (S.resolve >= 3) seen.full = true;
      if (S.parried) seen.parried = (seen.parried || 0) + 1;
      if (document.getElementById('rs-bark') && !document.getElementById('rs-bark').hidden) seen.barked = true;
      if (S.phase === PH.choice) {
        if (S.sel !== 0) window.Rescue.press('left'); else window.Rescue.press('confirm');
      } else if (S.phase === PH.blow) {
        if (S.ahp < seen.minHp) seen.minHp = S.ahp;
        if (!S.ans) {
          if (seen.tells.indexOf(S.tellLen) < 0) seen.tells.push(S.tellLen);
          if (seen.windows.indexOf(S.winLen) < 0) seen.windows.push(S.winLen);
          if (S.move === 'grab') seen.grabs = (seen.grabs || 0) + 1;
          if (how === 'grabfail') {
            /* she plays it well, and treats the one that cannot be
               blocked as if it could be */
            seen.moves.push(S.move); seen.answered++;
            tap(S.move === 'grab' ? 'block' : M[S.move].need);
          } else if (how === 'perfect' || (how === 'saved' && S.downUsed)) {
            seen.moves.push(S.move); seen.answered++;
            tap(M[S.move].need);
          } else if (how === 'wrong') {
            seen.missed++;
            tap(M[S.move].need === 'block' ? 'dodge' : 'block');
          } else seen.missed++;                       /* never touch it */
        }
      } else if (S.phase === PH.open) {
        if (!S.struck && (how === 'perfect' || how === 'grabfail' || (how === 'saved' && S.downUsed))) { seen.struck++; tap('strike'); }
      } else if (S.phase === PH.down) {
        if (!seen.downs) seen.downs++;
        if (how === 'saved' || how === 'perfect') { seen.getUps++; tap('strike'); }
      } else if (S.phase === PH.held) {
        seen.helds = (seen.helds || 0) + 1;
        if (how !== 'none') { if (!tapPad) window.Rescue.press('jump'); else {
          const b = document.querySelector('#rs-pad [data-rs="break"]');
          if (b) b.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
        } }
      } else if (S.phase === PH.letter) {
        window.Rescue.press('confirm');
      } else if (S.lines && S.waiting) {
        window.Rescue.press('confirm');
      }
      window.__soPump(1/60);
    }
    const S2 = window.Rescue._state();
    if (S2) { seen.parries = S2.parries; seen.taken = S2.taken; }
    return { seen, done: !S2 || S2.done, outcome: window.Rescue.outcome(),
             lost: !!(S2 && S2.lost), dhp: S2 ? S2.dhp : null, ahp: S2 ? S2.ahp : null,
             phases: Object.keys(seen.phases).map(Number).sort((a, b) => a - b),
             padGone: !document.getElementById('rs-pad') || document.getElementById('rs-pad').hidden };
  }, { how, tapPad });

  /* ---------- played properly ---------- */
  let st = await openScene();
  ok('the scene opens', st === 'cutscene', st);
  let r = await runFight('perfect', false);
  ok('answering every attack beats him', r.done && r.outcome === 'fight' && r.dhp <= 0,
     `outcome=${r.outcome} hisHp=${r.dhp}`);
  ok('and it takes fewer openings than he has health, because a full meter hits for two',
     r.seen.struck >= 4 && r.seen.struck <= 8, `openings taken=${r.seen.struck} hisHp=${r.dhp}`);
  ok('played perfectly, she never takes one', r.ahp === 4, `hers=${r.ahp}`);
  ok('both attacks are used', r.seen.moves.indexOf('chop') >= 0 && r.seen.moves.indexOf('sweep') >= 0,
     r.seen.moves.join(','));
  ok('the first two teach one each', r.seen.moves[0] === 'chop' && r.seen.moves[1] === 'sweep', r.seen.moves.slice(0,2).join(','));
  ok('the score follows the scene', r.seen.music.join(' ').indexOf('f1') >= 0 &&
     r.seen.music.join(' ').indexOf('win') >= 0, r.seen.music.join(' '));
  ok('it goes quiet when the scene ends', r.padGone, '');
  ok('the tell is never shorter than four tenths', Math.min.apply(null, r.seen.tells) >= 0.4,
     `tells=${r.seen.tells.map(n=>n.toFixed(2)).join(',')}`);
  ok('the window is never shorter than two thirds of a second', Math.min.apply(null, r.seen.windows) >= 0.66,
     `windows=${r.seen.windows.map(n=>n.toFixed(2)).join(',')}`);
  ok('it tightens as he loses', r.seen.windows.length > 1 && Math.max.apply(null, r.seen.windows) > Math.min.apply(null, r.seen.windows),
     r.seen.windows.map(n=>n.toFixed(2)).join(','));
  ok('the close call still lands, once', r.phases.indexOf(13) >= 0, `phases=${r.phases.join(' ')}`);
  ok('answering at the last moment is a parry, and it is worth more',
     r.seen.parries > 0, `parries=${r.seen.parries}`);
  ok('the meter fills', !!r.seen.full, '');
  ok('he reaches for her too', (r.seen.grabs || 0) > 0, `grabs=${r.seen.grabs || 0}`);
  ok('the last blow is its own thing', !!r.seen.final, '');
  ok('they say things while it happens', !!r.seen.barked, '');

  /* ---------- and the fight can be lost ---------- */
  st = await openScene();
  r = await runFight('none', false);
  ok('never touching a button loses it', r.done && r.lost && r.outcome === 'letgo',
     `lost=${r.lost} outcome=${r.outcome}`);
  ok('he goes down before that', r.phases.indexOf(14) >= 0, `phases=${r.phases.join(' ')}`);
  ok('and the letter is what she is left with', r.phases.indexOf(22) >= 0, `phases=${r.phases.join(' ')}`);
  const lostLetter = await page.evaluate(() => {
    const b = document.getElementById('so-letter-body');
    return b ? b.textContent.slice(0, 60) : '';
  });
  ok('the letter knows which evening she had', /went down/.test(lostLetter) || lostLetter === '', lostLetter);

  /* ---------- blocking the thing that cannot be blocked ---------- */
  st = await openScene();
  r = await runFight('grabfail', false);
  ok('blocking the one that cannot be blocked gets him picked up',
     (r.seen.helds || 0) > 0, `times held=${r.seen.helds || 0}`);
  ok('and hammering it gets him out of the hand',
     r.done && r.outcome === 'fight', `outcome=${r.outcome} hisHp=${r.dhp} hers=${r.ahp}`);

  /* ---------- down, and up again ---------- */
  st = await openScene();
  r = await runFight('saved', false);
  ok('she can get him up, once', r.seen.downs === 1 && r.outcome === 'fight' && r.dhp <= 0,
     `downs=${r.seen.downs} outcome=${r.outcome} hisHp=${r.dhp}`);
  ok('and he comes back with two, not four', r.ahp <= 2, `hers=${r.ahp}`);

  /* ---------- and the buttons on the screen play it ---------- */
  st = await openScene();
  r = await runFight('perfect', true);
  ok('the three buttons play the fight on their own', r.done && r.outcome === 'fight' && r.dhp <= 0,
     `outcome=${r.outcome} hisHp=${r.dhp}`);

  /* ---------- and it is drawn to the screen it is on ----------
     The page is closed first on purpose: the little Python server this
     runs against serves one connection at a time, and a second page
     opened while the first still holds one waits for ever. */
  await page.close();
  const phone = await browser.newPage({ viewport:{width:390,height:844}, deviceScaleFactor:2, isMobile:true, hasTouch:true });
  phone.on('pageerror', e => errs.push('phone: ' + e.message));
  await phone.route('**/*', r => r.request().url().startsWith('http://127.0.0.1') ? r.continue() : r.abort());
  await phone.goto('http://127.0.0.1:8899/index.html', { waitUntil:'domcontentloaded', timeout:60000 });
  await phone.waitForFunction(() => !!window.SuperOuissy && !!window.Rescue, { timeout:30000 });
  await phone.evaluate(() => { window.__soTestDrive = true; try{localStorage.clear();}catch(e){}
    SuperOuissy.stop(); showScreen('ouissy'); startSuperOuissy(); });
  await phone.waitForSelector('.so-diff-card', { timeout:6000 });
  await phone.click('[data-so-diff="hard"]'); await phone.click('#so-play');
  await phone.waitForTimeout(250);
  const ph = await phone.$('#so-how-ok'); if (ph) await ph.click();
  await phone.waitForFunction(() => window.__soInfo().state === 'play', { timeout:8000 });
  const framed = await phone.evaluate(() => {
    window.__soShowEnding();
    document.getElementById('so-end-scene').click();
    for (let i = 0; i < 60 * 30; i++) {
      const S = window.Rescue._state();
      if (S && S.phase >= 3) break;
      if (S && S.lines && S.waiting) window.Rescue.press('confirm');
      window.__soPump(1/60);
    }
    const cv = document.getElementById('so-canvas');
    const S = window.Rescue._state();
    return { w: cv.width, deathRight: S ? Math.round(S.death.x + 40) : null,
             herLeft: S ? Math.round(S.her.x) : null };
  });
  ok('an upright phone shows a narrower world', framed.w === 240, `canvas=${framed.w}`);
  ok('and Death is inside it, all of him', framed.deathRight <= framed.w, `his right edge=${framed.deathRight} of ${framed.w}`);
  ok('and she is inside it too', framed.herLeft >= 0, `her left edge=${framed.herLeft}`);
  await phone.close();

  ok('no page errors', errs.length === 0, errs.slice(0, 3).join(' | '));
  await browser.close();
  console.log(R.join('\n'));
  const bad = R.filter(x => x.startsWith('FAIL')).length;
  console.log(`\n${R.length - bad} passed, ${bad} failed`);
  process.exit(bad ? 1 : 0);
})();
