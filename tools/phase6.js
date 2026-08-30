/* Phase 6: the fight and the letter. */
const { chromium } = require('playwright-core');
const R=[]; const ok=(n,c,x)=>R.push((c?'PASS  ':'FAIL  ')+n+(x?'   '+x:''));
(async () => {
  const browser = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args:['--no-sandbox','--no-proxy-server','--disable-gpu'] });
  const page = await browser.newPage({ viewport:{width:1180,height:900} });
  const errs=[]; page.on('pageerror', e=>errs.push(e.message));
  await page.route('**/*', r => { const u=r.request().url();
    if (u.startsWith('http://127.0.0.1')||u.includes('fonts.g')) return r.continue(); return r.abort(); });
  await page.goto('http://127.0.0.1:8899/index.html', { waitUntil:'domcontentloaded', timeout:60000 });
  await page.waitForTimeout(800);

  const boot = async () => {
    await page.evaluate(() => { window.__soTestDrive = true; try{localStorage.clear();}catch(e){}
      if (window.SuperOuissy) SuperOuissy.stop(); showScreen('ouissy'); startSuperOuissy(); });
    await page.waitForSelector('.so-diff-card', { timeout:6000 });
    await page.click('[data-so-diff="hard"]'); await page.click('#so-play');
    await page.waitForTimeout(300);
    const how = await page.$('#so-how-ok'); if (how) await how.click();
    for (let i=0;i<30;i++){ await page.waitForTimeout(150);
      if (await page.evaluate(()=>window.__soInfo().state==='play')) break; }
    /* The door into the Death scene is narrow on purpose: the last world's
       boss, on Hard, taking her last life. Anything else is an ordinary
       game over, so the test has to stand in exactly that spot. */
    /* The world card runs on a real setTimeout rather than the pumped sim,
       so it can only be waited out in wall-clock time — pumping through it
       forever is how this sat on "card" for ten simulated seconds. */
    await page.evaluate(() => window.__soGoLevel(2));
    /* two world cards can be queued, so give it more than one card's worth */
    for (let i = 0; i < 12; i++) {
      await page.waitForTimeout(400);
      if (await page.evaluate(() => window.__soInfo().state === 'play')) break;
    }
    return await page.evaluate(() => {
      if (window.__soInfo().state !== 'play') return 'stuck on ' + window.__soInfo().state;
      window.__soDieToBoss();
      for (let i = 0; i < 300; i++) {
        window.__soPump(0.05);
        const s = window.Rescue && Rescue._state();
        if (s && s.kind === 'death') return true;
      }
      return 'no death scene';
    });
  };
  const st = () => page.evaluate(() => { const s = Rescue._state();
    return s && { kind:s.kind, phase:s.phase, round:s.round, hits:s.hits,
                  closeCalled:s.closeCalled, outcome:s.outcome, done:s.done }; });
  const pump = (secs) => page.evaluate((n) => window.__soPump(n), secs);
  /* Walk the scene to the choice, in-page. It must stop AT phase 6 without
     pressing, or it chooses for her. */
  const toChoice = () => page.evaluate(() => {
    for (let i = 0; i < 3000; i++) {
      const s = Rescue._state();
      if (!s) return false;
      if (s.phase === 6) return true;
      if (s.lines) Rescue.press('confirm');
      window.__soPump(0.05);
    }
    return false;
  });

  // ---------- the fight ----------
  const booted = await boot();
  console.log('   (reached the death scene: ' + booted + ')');
  let s = await st();
  ok('dying on the boss with no lives brings Death', s && s.kind === 'death', s && s.kind);
  ok('and it reaches her choice', await toChoice(), JSON.stringify(await st()));

  await page.evaluate(() => { const s = Rescue._state(); if (s) s.sel = 0; Rescue.press('confirm'); });
  await page.waitForTimeout(120);
  s = await st();
  ok('choosing to fight starts the fight, not the end', s.outcome === 'fight' && !s.done && s.phase >= 7,
     'phase=' + s.phase + ' done=' + s.done);

  /* Drive the whole fight inside the page. Hundreds of round-trips per
     round is slower than the fight itself and turns the test into a
     measurement of the wire. */
  const fight = await page.evaluate(() => {
    const windows = [];
    const keys = { block: 'jump', dodge: 'left', strike: 'jump' };
    let closeCalled = false;
    for (let i = 0; i < 4000; i++) {
      const s = Rescue._state();
      if (!s || s.done) break;
      if (s.closeCalled) closeCalled = true;
      if (s.phase === 9 && s.cue) {
        if (!windows.some(w => w.round === s.round)) {
          windows.push({ round: s.round, win: s.cueWindow, id: s.cue.id });
        }
        Rescue.press(keys[s.cue.id]);
      } else if (s.lines) {
        Rescue.press('confirm');
      }
      window.__soPump(0.05);
    }
    const s = Rescue._state();
    return { windows, closeCalled, done: s ? s.done : true, phase: s ? s.phase : -1 };
  });
  const sawCue = fight.windows.length;
  const windows = fight.windows;

  ok('the fight runs several rounds', sawCue >= 4, sawCue + ' rounds seen');
  const tightening = windows.length >= 2 && windows[windows.length-1].win < windows[0].win;
  ok('and the windows tighten as it goes', tightening,
     windows.map(w => w.win.toFixed(2)).join(' -> '));
  ok('the close call happens partway through', fight.closeCalled, 'closeCalled=' + fight.closeCalled);

  ok('the fight ends, and he wins', fight.done === true, 'done=' + fight.done + ' phase=' + fight.phase);
  await page.waitForTimeout(600);
  const after = await page.evaluate(() => window.__soState());
  ok('winning gives her the run back rather than ending it',
     after && after.state === 'play' && after.lives >= 1,
     after ? 'state=' + after.state + ' lives=' + after.lives : 'no state');

  /* The premise of the scene is that he wins. Miss every single cue —
     never press once — and it must still get there, with the close call
     still landing on its round. */
  await boot();
  await toChoice();
  await page.evaluate(() => { const s = Rescue._state(); if (s) s.sel = 0; Rescue.press('confirm'); });
  const missed = await page.evaluate(() => {
    let rounds = 0;
    for (let i = 0; i < 6000; i++) {
      const s = Rescue._state();
      if (!s || s.done) break;
      if (s.phase === 9 && s.cue) rounds = Math.max(rounds, s.round + 1);
      if (s.lines) Rescue.press('confirm');   // only ever advance dialogue
      window.__soPump(0.05);
    }
    const s = Rescue._state();
    return { done: s ? s.done : true, hits: s ? s.hits : -1, rounds,
             closeCalled: s ? s.closeCalled : false, phase: s ? s.phase : -1 };
  });
  ok('missing every cue still ends with him winning', missed.done === true,
     'done=' + missed.done + ' phase=' + missed.phase + ' hits=' + missed.hits);
  ok('and he lands none of them, so it was a real miss', missed.hits === 0, 'hits=' + missed.hits);
  ok('the close call still happens even then', missed.closeCalled === true);

  // ---------- the letter ----------
  await boot();
  console.log('   (second run booted)');
  await toChoice();
  await page.evaluate(() => { const s = Rescue._state(); if (s) s.sel = 1; Rescue.press('confirm'); });
  await page.waitForTimeout(120);
  s = await st();
  ok('letting go takes the other path', s.outcome === 'letgo' && !s.done, 'phase=' + s.phase);

  const letterRun = await page.evaluate(() => {
    let appeared = false;
    for (let i = 0; i < 4000; i++) {
      const s = Rescue._state();
      if (!s) break;
      const box = document.getElementById('so-letter');
      if (box && !box.hidden) appeared = true;
      if (appeared && !document.getElementById('so-letter-ok').hidden) break;
      if (s.lines) Rescue.press('confirm');
      window.__soPump(0.05);
    }
    return appeared;
  });
  ok('the letter appears', letterRun);

  const letter = await page.evaluate(() => ({
    body: document.getElementById('so-letter-body').textContent,
    close: document.getElementById('so-letter-close').textContent,
    sign: document.getElementById('so-letter-sign').textContent,
  }));
  ok('it writes itself out in full', letter.body.length > 200, letter.body.length + ' characters');
  ok('and it closes on the line she was promised',
     /I would've fought even Death for you, my love\./.test(letter.close), JSON.stringify(letter.close));
  ok('and it is signed', /Anwar/.test(letter.sign), letter.sign);

  /* Press, then pump: in test-drive mode nothing advances on its own, so
     waiting in wall-clock time proves nothing. */
  const closed = await page.evaluate(() => {
    Rescue.press('confirm');
    for (let i = 0; i < 200; i++) {
      window.__soPump(0.05);
      const b = document.getElementById('so-letter');
      if (!b || b.hidden) return true;
    }
    return false;
  });
  ok('closing the letter puts the letter away', closed);
  await page.waitForTimeout(400);
  ok('and the run is over', await page.evaluate(() => {
    const st = window.__soState();
    return st && st.state !== 'play';
  }), await page.evaluate(() => window.__soState() && window.__soState().state));

  console.log(R.join('\n'));
  console.log(errs.length ? 'ERRORS: '+errs.join(' | ') : 'no page errors');
  await browser.close();
  process.exit(R.some(r=>r.startsWith('FAIL')) ? 1 : 0);
})();
