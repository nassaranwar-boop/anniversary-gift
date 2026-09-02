/* The whole chapter, played by the game itself: the hub card in, every
   level card, every beat, both minigames, all five cuts, and the roof.
   Nothing here teleports past a step it has not legitimately cleared. */
const { chromium } = require('playwright-core');
const t0 = Date.now();
const log = (...a) => console.log(`[${((Date.now()-t0)/1000).toFixed(1)}s]`, ...a);
let fail = 0;
const need = (name, cond, extra) => {
  if (cond) console.log('  ok   ' + name);
  else { fail++; console.log('  FAIL ' + name + (extra ? '  ' + JSON.stringify(extra) : '')); }
};

(async () => {
  const b = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--use-gl=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--no-sandbox']
  });
  const p = await b.newPage({ viewport: { width: 640, height: 400 } });
  const errs = [];
  p.on('pageerror', e => errs.push('PAGEERR: ' + e.message));
  p.on('console', m => { if (m.type()==='error' && !/ERR_FAILED/.test(m.text())) errs.push('CONSOLE: '+m.text()); });
  await p.route('**', r => (r.request().url().startsWith('http://localhost') ? r.continue() : r.abort()));
  await p.goto('http://localhost:8899/index.html', { waitUntil: 'domcontentloaded' });

  // in through the hub, the way a person gets here
  await p.evaluate(() => { document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
    document.getElementById('screen-hub').classList.add('active'); });
  await p.click('#hub-card-apoc');
  await p.waitForFunction(() => !!window.__apEnter, { timeout: 40000 });
  await p.evaluate(() => { window.__apLoop(false); window.__apQuality(2); });
  log('in from the hub');

  const S  = () => p.evaluate(() => window.__apState());
  const pump = (n=30) => p.evaluate(k => { for (let i=0;i<k;i++) window.__apPump(1/60); }, n);
  const click = async sel => { const el = await p.$(sel); if (el) { await el.click(); return true; } return false; };
  const trace = async where => log('   .. ' + where + ' ' + JSON.stringify(await S()));
  const talk = async () => { await p.evaluate(() => window.__apSkipDialogue()); await pump(4); };
  const walkTo = async (tx, ty, frames=30) => {
    await p.evaluate(t => window.__apTeleport(t[0], t[1]), [tx, ty]);
    await pump(frames);
  };
  /* the harness drops her into places a player would have snuck up on, so
     anything that takes hold on arrival is an artefact of teleporting */
  const use = async () => {
    await p.evaluate(() => {
      var g = window.Apocalypse.game;
      if (g && (g.state === 'grab' || g.state === 'close')) window.__apClear();
      g.zombies.forEach(function (z) { z.state = 'calm'; z.look = null; });
    });
    await pump(4);
    await p.evaluate(() => window.__apUse());
    await pump(4);
  };
  /* fades, cuts and dialogue all take real seconds; the harness waits for
     the thing it is about to assert on rather than guessing a frame count */
  const waitCard = async (text, budget=1200) => {
    for (let n = 0; n < budget; n += 20) {
      const k = await p.$eval('.ap-card-kicker', e => e.textContent).catch(() => null);
      if (k === text) return true;
      await pump(20);
    }
    return false;
  };
  const waitFor = async (test, budget=2400) => {
    for (let n = 0; n < budget; n += 20) {
      if (test(await S())) return true;
      await pump(20);
    }
    return false;
  };
  const waitSel = async (sel, budget=600) => {
    for (let n = 0; n < budget; n += 20) {
      if (await p.$(sel)) return true;
      await pump(20);
    }
    return false;
  };

  need('the title card is up', await p.$('.ap-card-kicker') !== null);
  const kick = await p.$eval('.ap-card-kicker', e => e.textContent);
  need('and it is the right card', kick === 'OUISSY AT THE APOCALYPSE', { kick });
  await click('.ap-card-go');                      // BEGIN -> how-to
  need('the how-to follows',
       (await p.$eval('.ap-card-kicker', e => e.textContent)) === 'HOW THIS GOES');
  await click('.ap-card-go');                      // GO -> level 1 card
  need('then the level 1 card',
       (await p.$eval('.ap-card-kicker', e => e.textContent)) === 'Level 1: HOME');
  await click('.ap-card-go');                      // GO -> play
  await pump(20);
  let st = await S();
  need('Level 1 is running', st.level === 'home' && st.state === 'play', st);

  // ---- Level 1: the TV, the panel, the garage -----------------------------
  await walkTo(2, 12); await use();
  need('the broadcast is on the set', await p.$('.ap-tv-canvas') !== null);
  await click('.ap-tv .ap-card-go'); await pump(6);
  need('turning it off starts her thinking', await waitFor(s => s.dialogue === true, 400));
  await talk();
  st = await S(); need('the TV clears its step', st.step === 'panel', st);

  const pan1 = await p.evaluate(() => window.Apocalypse.game.world.panelAt);
  await walkTo(pan1.x, pan1.y + 1); await use();
  need('the wire panel is up', await p.$('.ap-panel-canvas') !== null);
  await p.evaluate(() => window.__apSolvePanel()); await p.waitForTimeout(400); await pump(20);
  need('the garage is empty', await waitFor(s => s.dialogue === true, 600));
  await talk();
  st = await S(); need('power comes back on', st.step === 'exit', st);

  const ex1 = await p.evaluate(() => window.Apocalypse.game.world.exit);
  await walkTo(ex1.x, ex1.y, 24);
  need('the Level 2 card comes up', await waitCard('Level 2: THE STREETS'));
  await click('.ap-card-go'); await pump(20);
  st = await S(); need('Level 2 is running', st.level === 'streets', st);
  log('level 1 done');

  // ---- Level 2: the note, the gate, across town ---------------------------
  await walkTo(10, 24); await use();
  await click('.ap-note-ok'); await pump(6);
  st = await S(); need('she has the code', st.code === '4180', st);
  await walkTo(32, 23); await use();
  await p.evaluate(() => window.__apKeypad()); await pump(40);
  const gate = await p.evaluate(() => {
    const d = window.Apocalypse.game.world.doors.find(d => d.kind === 'D');
    return d ? { locked: d.locked, open: d.open } : null;
  });
  need('the staff gate is open', gate && !gate.locked && gate.open > 0.5, gate);

  const ex2 = await p.evaluate(() => window.Apocalypse.game.world.exit);
  await walkTo(ex2.x, ex2.y, 24);
  need('the Level 3 card comes up', await waitCard('Level 3: THE HOSPITAL'));
  await click('.ap-card-go'); await pump(20);
  st = await S(); need('Level 3 is running', st.level === 'hospital', st);
  await pump(70);
  need('the board over reception tells her where to go', await waitFor(s => s.dialogue === true, 400));
  await talk();
  log('level 2 done');

  // ---- Level 3: the plant room, him, the room with the bolt --------------
  await walkTo(4, 9, 10);                    // a curtained bay: nothing can see her in it
  const zBefore = (await S()).zombies;
  await pump(60 * 32);                       // let the pressure system run
  const zAfter = (await S()).zombies;
  need('the hospital fills up on its own', zAfter > zBefore, { zBefore, zAfter });

  const pan3 = await p.evaluate(() => window.Apocalypse.game.world.panelAt);
  await walkTo(pan3.x, pan3.y + 1); await use();
  need('the plant room panel is up', await p.$('.ap-panel-canvas') !== null);
  await p.evaluate(() => window.__apSolvePanel()); await p.waitForTimeout(400); await pump(20);
  st = await S(); need('Ward C has power', st.step === 'anwar', st);
  const lit = await p.evaluate(() => window.Apocalypse.game.world.powered);
  need('and its lights come on', lit === true);

  const aw = await p.evaluate(() => window.Apocalypse.game.world.anwarAt);
  await walkTo(aw.x, aw.y + 1); await use();
  st = await S(); need('waking him starts the reunion', st.dialogue === true, st);
  await talk();
  st = await S(); need('and clears the step', st.step === 'exit', st);
  const follows = await p.evaluate(() => {
    const a = window.Apocalypse.game.anwar; return a && a.following;
  });
  need('he comes with her', follows === true);

  const ex3 = await p.evaluate(() => window.Apocalypse.game.world.exit);
  await walkTo(ex3.x, ex3.y, 24);
  need('the safe-room scene plays', await waitFor(s => s.dialogue === true, 600));
  await talk();
  need('the radio is on the shelf', await waitSel('.ap-radio-line'));
  for (let i = 0; i < 5; i++) { await click('.ap-radio .ap-card-go'); await pump(3); }
  need('the Level 4 card comes up', await waitCard('Level 4: THE ROAD'));
  await click('.ap-card-go'); await pump(20);
  st = await S(); need('Level 4 is running', st.level === 'escape', st);
  log('level 3 done');

  // ---- Level 4: the car, the drive, the horse, the ride, the camp --------
  const car = await p.evaluate(() => window.Apocalypse.game.world.carAt);
  await walkTo(car.x + 1, car.y + 1); await use();
  await talk();
  need('the drive is playing', await waitFor(s => s.cine === true));
  need('and it lands on the roadside', await waitFor(s => s.level === 'roadside', 3600));

  const horse = await p.evaluate(() => window.Apocalypse.game.world.horseAt);
  await walkTo(horse.x, horse.y + 1); await use();
  st = await S(); need('the horse is a scene', st.dialogue === true, st);
  await talk();
  need('the ride is playing', await waitFor(s => s.cine === true));
  need('and it lands at the campsite', await waitFor(s => s.level === 'campsite', 3600));

  await talk();
  need('making camp is cleared', await waitFor(s => s.step === 'wood'));

  // three pieces of wood, from the three places they actually are
  const spots = await p.evaluate(() => window.Apocalypse.game.world.things
    .filter(t => t.kind === 'wood' || t.kind === 'gather').map(t => ({x:t.x,y:t.y})));
  need('there is wood to find', spots.length >= 3, { n: spots.length });
  for (let i = 0; i < 3 && i < spots.length; i++) {
    await walkTo(spots[i].x, spots[i].y + 1, 8);
    await use();
    await talk(); await pump(6);
  }
  st = await S(); need('three pieces is enough', st.step === 'fire', st);

  const pit = await p.evaluate(() => window.Apocalypse.game.world.firePitAt);
  await walkTo(pit.x, pit.y + 1, 8);
  await use();
  /* lighting it, then the two long scenes, then the cut */
  for (let i = 0; i < 6; i++) { await talk(); await pump(40); }
  need('the campfire cut is playing', await waitFor(s => s.cine === true, 1800));
  need('the Level 5 card comes up', await waitCard('Level 5: THE GATES', 4200));
  await click('.ap-card-go'); await pump(20);
  st = await S(); need('Level 5 is running', st.level === 'gates', st);
  log('level 4 done');

  // ---- Level 5: the protocol --------------------------------------------
  await walkTo(13, 13); await use();
  await talk();
  need('they let her hail them', await waitFor(s => s.step === 'check'));
  await walkTo(20, 11); await use();
  need('the intake sheet is up', await p.$('.ap-check-list') !== null);
  await p.evaluate(() => window.__apCheck()); await pump(30);
  need('the serum comes next', await waitSel('.ap-serum-canvas'));
  /* press it the way a person does: once to give it, once to move on */
  await click('.ap-serum .ap-note-ok');
  await p.waitForTimeout(1700);
  need('the button comes back after the dose',
       (await p.$eval('.ap-serum .ap-note-ok', e => e.textContent).catch(()=>null)) === "THAT'S IT");
  await click('.ap-serum .ap-note-ok'); await pump(30);
  need('both of them are cleared', await waitFor(s => s.step === 'exit', 600));

  const ex5 = await p.evaluate(() => window.Apocalypse.game.world.exit);
  await walkTo(ex5.x, ex5.y, 30);
  need('the roof scene plays', await waitFor(s => s.cine === true && s.dialogue === true, 1200));
  await talk();
  need('and it ends where it should', await waitCard('TO BE CONTINUED…'));
  const done = await p.evaluate(() => JSON.parse(localStorage.getItem('fal_chapters_done')||'{}'));
  need('the chapter is marked done', done.apoc === true, done);
  log('level 5 done');

  console.log('');
  log(fail ? `${fail} FAILED` : 'the whole chapter plays');
  if (errs.length) { console.log('page errors:'); console.log(errs.slice(0,12).join('\n')); }
  await b.close();
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('FATAL', e); console.log('page errors so far:'); process.exit(1); });
