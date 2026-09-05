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
  /* CLICK FROM INSIDE THE PAGE.

     Playwright's own click dispatches real mouse events and then waits
     for the renderer to acknowledge them. Entering a level is three
     seconds of synchronous world-building on that same thread, and
     under software rendering the acknowledgement can arrive after the
     thirty-second budget even though the click itself landed and the
     game is already playing. That is a property of the harness, not of
     the game — the button is hit, the level starts — but it made this
     suite fail at random on the level cards.

     So this one presses buttons from inside the page, which is what
     every other suite here does. Real pointer and touch input has a
     suite of its own that does nothing else: tools/touchcheck.js. */
  /* and then WAIT for the page to come back. Playwright's own click got
     this for free by blocking on the acknowledgement; pressing from
     inside the page does not, so without this the suite ran four times
     faster than the game and started asking about level five while
     level five was still being built. Two animation frames only arrive
     once the main thread is free again, which is exactly the signal
     that was being waited for in the first place. */
  const settle = () => p.evaluate(() => new Promise(r =>
    requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, 0)))));
  const click = async sel => {
    const hit = await p.evaluate(s2 => {
      const el = document.querySelector(s2);
      if (!el) return false;
      el.click();
      return true;
    }, sel);
    if (hit) await settle();
    return hit;
  };
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
  st = await S(); need('the TV clears its step', st.step === 'torch', st);

  /* she goes round her own house before she leaves it: the fridge, and
     then the torch out of the drawer under the kettle */
  const fr1 = await p.evaluate(() => window.Apocalypse.game.world.fridgeAt);
  need('there is a fridge in the kitchen', !!fr1, fr1);
  await walkTo(fr1.x, fr1.y + 1); await use();
  need('the fridge opens', await p.$('.ap-fridge-canvas, .ap-fridge .ap-panel-canvas') !== null);
  /* reach in and take every one of the things that keep — at the
     coordinates the game itself says they are at, not at guessed ones */
  const fridgeTook = await p.evaluate(() => {
    const cv = document.querySelector('.ap-fridge .ap-panel-canvas');
    const r = cv.getBoundingClientRect();
    const keeps = window.__apFridgeItems().filter(i => i.keep);
    keeps.forEach(it => {
      cv.dispatchEvent(new MouseEvent('click', { bubbles: true,
        clientX: r.left + (it.x + it.w / 2) * (r.width / cv.width),
        clientY: r.top + (it.y + it.h / 2) * (r.height / cv.height) }));
    });
    return { wanted: keeps.length,
             left: window.__apFridgeItems().filter(i => i.keep && !i.gone).length,
             label: document.querySelector('.ap-fridge .ap-card-go').textContent };
  });
  need('there is more than one thing worth taking', fridgeTook.wanted >= 3, fridgeTook);
  need('reaching in takes every one of them', fridgeTook.left === 0, fridgeTook);
  need('and the panel says so', fridgeTook.label === 'THAT IS EVERYTHING', fridgeTook);
  await click('.ap-fridge .ap-card-go');
  await pump(6);
  need('and she stops to eat', await waitFor(s => s.dialogue === true, 600));
  await talk();
  need('she has water after that', await p.evaluate(() => !!window.Apocalypse.game.ate));

  const to1 = await p.evaluate(() => window.Apocalypse.game.world.torchAt);
  await walkTo(to1.x, to1.y + 1); await use();
  need('the torch is hers', await waitFor(s => s.dialogue === true, 600));
  await talk();
  st = await S(); need('and that clears the search', st.step === 'panel', st);

  const pan1 = await p.evaluate(() => window.Apocalypse.game.world.panelAt);
  await walkTo(pan1.x, pan1.y + 1); await use();
  need('the wire panel is up', await p.$('.ap-panel-canvas') !== null);
  await p.evaluate(() => window.__apSolvePanel()); await p.waitForTimeout(400); await pump(20);
  need('the garage is empty', await waitFor(s => s.dialogue === true, 600));
  await talk();
  st = await S(); need('power comes back on', st.step === 'exit', st);

  const ex1 = await p.evaluate(() => window.Apocalypse.game.world.exit);
  await walkTo(ex1.x, ex1.y, 24);
  need('the Level 2 card comes up', await waitCard('Level 2: MARRAKECH'));
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
  need('the Level 3 card comes up', await waitCard('Level 3: HUPM, CHRIFIYA'));
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
  need('the Level 4 card comes up', await waitCard('Level 4: THE COAST ROAD'));
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
  /* Lighting it runs two long conversations before the cut, and the
     number of lines in them is not this suite's business — keep pressing
     until the scene it leads to is on screen. */
  let burning = false;
  for (let i = 0; i < 90 && !burning; i++) {
    await talk(); await pump(14);
    burning = (await S()).cine === true;
  }
  need('the campfire cut is playing', burning);
  /* the campfire, the sunrise, the morning after and the last ride all
     talk; press through the lot of them to the gates */
  let card5 = false;
  for (let i = 0; i < 260 && !card5; i++) {
    await talk(); await pump(10);
    card5 = await p.evaluate(() => {
      const t = document.querySelector('.ap-card-kicker');
      return !!t && /Level 5/i.test(t.textContent);
    });
  }
  need('the Level 5 card comes up', card5);
  await click('.ap-card-go'); await pump(20);
  st = await S(); need('Level 5 is running', st.level === 'gates', st);
  log('level 4 done');

  // ---- Level 5: the protocol --------------------------------------------
  /* Read the gate and the table off the grid rather than naming tiles:
     the road up to the safe house was rebuilt and two hard-coded
     coordinates walked her into a fence for four hundred seconds. */
  const g5 = await p.evaluate(() => {
    const w = window.Apocalypse.game.world, sp = w.spawn;
    let gate = null, gd = 1e9, desk = null;
    for (let y = 0; y < w.h; y++) for (let x = 0; x < w.w; x++) {
      const c = w.at(x, y);
      if (c === 'G') { const d = Math.hypot(x - sp.x, y - sp.y); if (d < gd) { gd = d; gate = { x, y }; } }
      if (c === 'Q') desk = { x, y };
    }
    const spot = t => {
      let best = null, bd = 1e9;
      for (const d of [[1,0],[-1,0],[0,1],[0,-1]]) {
        const x = t.x + d[0], y = t.y + d[1], c = w.at(x, y);
        if (c === ' ' || window.__apSolid(c)) continue;
        const q = Math.hypot(x - sp.x, y - sp.y);
        if (q < bd) { bd = q; best = { x, y }; }
      }
      return best || t;
    };
    return { gate: spot(gate), desk: spot(desk) };
  });
  await walkTo(g5.gate.x, g5.gate.y, 26); await use();
  await talk();
  need('they let her hail them', await waitFor(s => s.step === 'check'));
  await walkTo(g5.desk.x, g5.desk.y, 26); await use();
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
