/* THREE THINGS THE GAME NEVER DID: talk back from inside the level, notice
   she is stuck in one PLACE rather than merely dying a lot, and let a heart
   be worth something other than points. */
const { chromium } = require('playwright-core');
const R = []; const ok = (n, c, x) => R.push((c ? 'ok   ' : 'FAIL ') + n + (x ? '   ' + x : ''));
(async () => {
  const browser = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args:['--no-sandbox','--no-proxy-server','--disable-gpu','--use-gl=swiftshader','--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport:{width:1180,height:900} });
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.route('**/*', r => r.request().url().startsWith('http://127.0.0.1') ? r.continue() : r.abort());
  await page.goto('http://127.0.0.1:8899/index.html', { waitUntil:'domcontentloaded', timeout:60000 });
  await page.waitForFunction(() => !!window.SuperOuissy, { timeout:30000 });
  const play = () => page.waitForFunction(() => window.__soInfo().state === 'play', { timeout:15000 });
  await page.evaluate(() => { window.__soTestDrive = true; try{localStorage.clear();}catch(e){}
    SuperOuissy.stop(); showScreen('ouissy'); startSuperOuissy(); });
  await page.waitForSelector('.so-diff-card', { timeout:6000 });
  await page.click('[data-so-diff="medium"]'); await page.click('#so-play');
  await page.waitForTimeout(250);
  const how = await page.$('#so-how-ok'); if (how) await how.click();
  await play();

  /* ---- the signposts ------------------------------------------------ */
  const seen = [];
  for (const w of [0, 1, 2]) {
    await page.evaluate(i => window.__soGoLevel(i), w); await play();
    const sg = await page.evaluate(() => {
      const L = window.__soInfo();
      return { s: window.__soSigns().map(o => ({ x: o.x, y: o.y, text: o.text })),
               ground: window.__soSigns().map(o => window.__soSolidAt
                 ? window.__soSolidAt(o.x, o.y) : null) };
    });
    seen.push(sg.s.map(o => o.text));
    ok(`world ${w + 1} has boards in it`, sg.s.length >= 2, `${sg.s.length}`);
    ok(`world ${w + 1}: spread out, not stacked`,
       sg.s.every((o, i) => i === 0 || o.x - sg.s[i - 1].x > 60), sg.s.map(o => o.x).join(','));
    ok(`world ${w + 1}: every board says something`,
       sg.s.every(o => typeof o.text === 'string' && o.text.length > 8));
  }
  const flat = seen.flat();
  ok('the three worlds do not say the same things', new Set(flat).size === flat.length, `${flat.length}`);

  /* AND NEITHER DO THE THREE DIFFICULTIES. A difficulty is its own three
     worlds, its own boss and its own score; the letters were the only
     thing that repeated, so going back for Hard was going back over the
     same post. */
  const piles = await page.evaluate(() => {
    const out = {};
    for (const d of ['easy', 'medium', 'hard']) { window.__soPeekDiff(d); out[d] = window.__soMoments(); }
    return out;
  });
  const texts = ['easy', 'medium', 'hard'].map(d => piles[d].all);
  ok('every difficulty has a full pile of letters',
     texts.every(t => t.length >= 8), texts.map(t => t.length).join('/'));
  ok('and no letter appears in two of them',
     new Set(texts.flat()).size === texts.flat().length, `${texts.flat().length} in all`);
  ok('each pile is remembered under its own name',
     new Set(['easy','medium','hard'].map(d => piles[d].key)).size === 3,
     ['easy','medium','hard'].map(d => piles[d].key).join(' '));
  await page.evaluate(() => window.__soPeekDiff('medium'));

  /* A LINE SHE CANNOT READ IS NOT A LINE. Every board has to stand on the
     floor she actually walks along, on every difficulty — the first pass of
     this put four of the twenty-seven on ledges and one thirteen rows up
     in the open sky. */
  const stranded = [];
  for (const d of ['easy', 'medium', 'hard']) {
    await page.evaluate(() => { window.__soTestDrive = true;
      SuperOuissy.stop(); showScreen('ouissy'); startSuperOuissy(); });
    await page.waitForSelector('.so-diff-card', { timeout:6000 });
    await page.click(`[data-so-diff="${d}"]`); await page.click('#so-play');
    await page.waitForTimeout(250);
    const h2 = await page.$('#so-how-ok'); if (h2) await h2.click();
    await play();
    const rows = await page.evaluate(diff => {
      const out = [];
      for (const w of [0, 1, 2]) {
        window.__soGoLevel(w); window.__soSkipCard();
        const box = window.__soLevelBox(), gy = window.__soGroundY();
        window.__soSigns().forEach(s => {
          const tx = Math.round(s.x / 16), ty = Math.round(s.y / 16);
          let floor = ty + 1;
          while (floor < box.h && !window.__soStand(tx, floor)) floor++;
          out.push({ where: `${diff} w${w + 1} @${tx}`, off: floor - gy });
        });
      }
      return out;
    }, d);
    rows.forEach(r => { if (Math.abs(r.off) > 1) stranded.push(`${r.where} is ${r.off} rows off the floor`); });
  }
  ok('every board stands on the floor she walks along, on all three difficulties',
     stranded.length === 0, stranded.slice(0, 4).join('; '));

  /* that loop ends on hard, and everything below is about the offer, which
     hard does not have — back to medium before going on */
  await page.evaluate(() => { window.__soTestDrive = true; try{localStorage.clear();}catch(e){}
    SuperOuissy.stop(); showScreen('ouissy'); startSuperOuissy(); });
  await page.waitForSelector('.so-diff-card', { timeout:6000 });
  await page.click('[data-so-diff="medium"]'); await page.click('#so-play');
  await page.waitForTimeout(250);
  const howM = await page.$('#so-how-ok'); if (howM) await howM.click();
  await play();

  await page.evaluate(() => window.__soGoLevel(0)); await play();
  ok('nothing is said before she reaches one',
     await page.evaluate(() => !document.querySelector('#so-sign-say.on')));
  await page.evaluate(() => { const s = window.__soSigns()[0]; window.__soPlayer({ x: s.x, y: s.y }); });
  await page.evaluate(() => window.__soPump(0.35, {}));
  const said = await page.evaluate(() => {
    const e = document.querySelector('#so-sign-say');
    return { on: !!(e && / on\b/.test(' ' + e.className)), text: e ? e.textContent : '',
             flagged: window.__soSigns()[0].said };
  });
  ok('walking past a board puts his line up', said.on === true && said.text.length > 8, said.text);
  ok('and the board remembers it has spoken', said.flagged === true);

  /* ---- stuck in the same PLACE -------------------------------------- */
  await page.evaluate(() => { window.__soLives(9); window.__soStuck(3); window.__soKill(); });
  await page.evaluate(() => window.__soPump(1.8, {}));
  ok('four falls in the same spot is still the level being difficult — no offer',
     await page.evaluate(() => !document.getElementById('so-hand')));
  ok('the ordinary revive card is what she gets',
     await page.evaluate(() => !!document.getElementById('so-revive-yes')));
  await page.evaluate(() => document.getElementById('so-revive-no').click());
  await play();

  await page.evaluate(() => { window.__soStuck(4); window.__soKill(); });
  await page.evaluate(() => window.__soPump(1.8, {}));
  const three = await page.evaluate(() => {
    const b = document.getElementById('so-hand');
    return { hand: !!b, label: b ? b.textContent.trim() : null,
             note: (document.querySelector('.so-card-note') || {}).textContent || '',
             kicker: (document.querySelector('.so-card-kicker') || {}).textContent || '' };
  });
  ok('five falls in the same spot and the offer appears', three.hand === true, three.label);
  ok('it says how many, truthfully', /5 times/.test(three.note), three.note.slice(0, 52) + '...');
  ok('and it promises the jump is still the jump', /still the jump/.test(three.note));
  ok('it does not promise a glow, a shield or an easier anything',
     !/glow|shield|easier|slower/i.test(three.note), three.note.slice(0, 90));
  ok('and it leads with the bit being mean, not with her', /MEAN/.test(three.kicker), three.kicker);
  ok('the paid way is still there beside it',
     await page.evaluate(() => !!document.getElementById('so-revive-yes')));

  const gate0 = await page.evaluate(() => window.__soStuck().gate);
  await page.evaluate(() => document.getElementById('so-revive-no').click());
  await play();
  const no = await page.evaluate(() => window.__soStuck());
  ok('saying no clears the count', no.n === 0);
  ok('and raises the bar so it does not nag', no.gate > gate0, `${gate0} -> ${no.gate}`);
  ok('the bar started at five, not three', gate0 === 5, `${gate0}`);

  /* dying somewhere ELSE is not the same stretch */
  await page.evaluate(() => { window.__soStuck(4); const p = window.__soPlayer(); window.__soPlayer({ x: p.x + 400 }); window.__soKill(); });
  await page.evaluate(() => window.__soPump(1.8, {}));
  ok('a fall a long way off starts a new count, not the offer',
     await page.evaluate(() => !document.getElementById('so-hand') && window.__soStuck().n === 1));
  await page.evaluate(() => document.getElementById('so-revive-no').click());
  await play();

  /* taking it */
  await page.evaluate(() => { window.__soLives(9); window.__soStuck(9); window.__soKill(); });
  await page.evaluate(() => window.__soPump(1.8, {}));
  ok('the offer comes back once she is stuck again',
     await page.evaluate(() => !!document.getElementById('so-hand')));
  const startX = await page.evaluate(() => window.__soInfo().levelStartX || 0);
  await page.evaluate(() => document.getElementById('so-hand').click());
  await play();
  const got = await page.evaluate(() => ({ st: window.__soStuck(), p: window.__soPlayer() }));
  ok('a ribbon is tied where she last stood safely', !!got.st.check, JSON.stringify(got.st.check));
  ok('she comes back at it, not at the start of the world',
     Math.abs(got.p.x - got.st.check.x) < 40, `player ${got.p.x | 0} vs ribbon ${got.st.check.x | 0}`);
  ok('and WITHOUT a glow-up: the jump that has been killing her is unchanged',
     got.p.big !== true, `big=${got.p.big}`);
  ok('and without lingering invulnerability either', got.p.invuln <= 1.5, `invuln=${got.p.invuln}`);
  ok('taking it clears the count', got.st.n === 0);

  await page.evaluate(() => window.__soGoLevel(1)); await play();
  const fresh = await page.evaluate(() => window.__soStuck());
  ok('a new world starts her at nought again',
     fresh.n === 0 && fresh.gate === 5 && !fresh.check, JSON.stringify(fresh));

  /* ---- and the two places it must never appear --------------------- */
  /* the Queen's room: the last fight is the point of the run */
  await page.evaluate(() => window.__soGoLevel(2)); await play();
  await page.evaluate(() => { window.__soLives(9); window.__soBossSet({ awake: true }); window.__soStuck(9); window.__soKill(); });
  await page.evaluate(() => window.__soPump(1.8, {}));
  ok('never in the Queen\'s room, however many times she falls',
     await page.evaluate(() => !document.getElementById('so-hand')));
  const inRoom = await page.evaluate(() => !!document.getElementById('so-revive-no'));
  if (inRoom) { await page.evaluate(() => document.getElementById('so-revive-no').click()); await play(); }

  /* HARD: the mode whose whole definition is "no ribbons" */
  await page.evaluate(() => { window.__soTestDrive = true;
    SuperOuissy.stop(); showScreen('ouissy'); startSuperOuissy(); });
  await page.waitForSelector('.so-diff-card', { timeout:6000 });
  await page.click('[data-so-diff="hard"]'); await page.click('#so-play');
  await page.waitForTimeout(250);
  const how2 = await page.$('#so-how-ok'); if (how2) await how2.click();
  await play();
  await page.evaluate(() => { window.__soLives(9); window.__soStuck(20); window.__soKill(); });
  await page.evaluate(() => window.__soPump(1.8, {}));
  ok('never on hard: she chose the mode with no ribbons',
     await page.evaluate(() => !document.getElementById('so-hand')));
  ok('hard still gets its own ordinary revive card',
     await page.evaluate(() => !!document.getElementById('so-revive-yes')));
  await page.evaluate(() => { const b = document.getElementById('so-revive-no'); if (b) b.click(); });
  await page.waitForTimeout(400);

  /* back to medium for the rest */
  await page.evaluate(() => { window.__soTestDrive = true;
    SuperOuissy.stop(); showScreen('ouissy'); startSuperOuissy(); });
  await page.waitForSelector('.so-diff-card', { timeout:6000 });
  await page.click('[data-so-diff="medium"]'); await page.click('#so-play');
  await page.waitForTimeout(250);
  const how3 = await page.$('#so-how-ok'); if (how3) await how3.click();
  await play();

  /* ---- hearts that buy moments -------------------------------------- */
  await page.evaluate(() => { window.__soSetHearts(25); window.__soFinish(); });
  await page.waitForSelector('#so-moment', { timeout: 6000 });
  ok('twenty-five hearts and the card offers a moment', true);
  ok('nothing has been read yet',
     await page.evaluate(() => window.__soMoments().read.length === 0));
  await page.click('#so-moment');
  const m1 = await page.evaluate(() => ({
    text: (document.querySelector('.so-moment-text') || {}).textContent || '',
    hearts: window.__soInfo().hearts, read: window.__soMoments().read.length }));
  ok('ten hearts buys a real one', m1.text.length > 30, m1.text.slice(0, 46) + '...');
  ok('and they are actually spent', m1.hearts === 15, `${m1.hearts}`);
  ok('and it is remembered between runs', m1.read === 1);
  await page.click('#so-moment');
  const m2 = await page.evaluate(() => ({
    text: (document.querySelector('.so-moment-text') || {}).textContent || '',
    hearts: window.__soInfo().hearts, read: window.__soMoments().read.length }));
  ok('a second one is a different one', m2.text !== m1.text);
  ok('and costs the same again', m2.hearts === 5 && m2.read === 2, `${m2.hearts}`);
  ok('with five left the button is gone, not broken',
     await page.evaluate(() => !document.getElementById('so-moment')));
  ok('and it says what she is short of',
     /5 hearts/.test(await page.evaluate(() => (document.querySelector('.so-moment-none') || {}).textContent || '')));
  ok('the HUD agrees about the hearts',
     await page.evaluate(() => (document.getElementById('so-hearts') || {}).textContent) === '05');

  /* READING A LETTER MUST NOT UNDO HER COLLECTING. The purse and the tally
     used to be the same number, so buying two moments quietly knocked
     twenty off the HEARTS line on the ending and off the saved best — she
     found twenty-five and the game would have told her fifteen. */
  const tally = await page.evaluate(() => ({ purse: window.__soInfo().hearts, ever: window.__soHeartsEver() }));
  ok('the purse went down', tally.purse === 5, `${tally.purse}`);
  ok('but what she COLLECTED did not', tally.ever === 25, `${tally.ever}`);
  const card = await page.evaluate(() => {
    window.__soShowEnding();
    const rows = [...document.querySelectorAll('.so-end-res .so-res-row')]
      .map(r => r.textContent.replace(/\s+/g, ' ').trim());
    const best = JSON.parse(localStorage.getItem('so_best') || '{}');
    return { rows, best: (best.medium || {}).hearts };
  });
  ok('the ending counts what she found, not what she has left',
     card.rows.some(r => /HEARTS\s*25/.test(r)), card.rows.join(' | '));
  ok('and so does the saved best', card.best === 25, `${card.best}`);

  /* ONCE THE PILE IS COMPLETE IT IS HERS. Ten hearts buy a letter she has
     not seen; charging ten again for a random repeat of one she already
     owns is a slot machine, not a purchase. */
  const readAll = await page.evaluate(() => {
    const M = window.__soMoments();
    const all = []; for (let i = 0; i < M.total; i++) all.push(i);
    localStorage.setItem(M.key, JSON.stringify(all));
    window.__soSetHearts(3);            /* nowhere near the price */
    window.__soFinish();
    const b = document.getElementById('so-moment');
    return { button: !!b, label: b ? b.textContent.trim() : null,
             note: (document.querySelector('.so-moment-none') || {}).textContent || '' };
  });
  ok('with every moment read, the button is still there at three hearts',
     readAll.button === true, readAll.label);
  ok('and it no longer asks for a price', !/10/.test(readAll.label || ''), readAll.label);
  ok('and says the pile is hers', /all of them/.test(readAll.note), readAll.note);
  const reread = await page.evaluate(() => {
    const before = window.__soInfo().hearts;
    document.getElementById('so-moment').click();
    return { before, after: window.__soInfo().hearts,
             text: (document.querySelector('.so-moment-text') || {}).textContent || '' };
  });
  ok('re-reading costs her nothing', reread.after === reread.before, `${reread.before} -> ${reread.after}`);
  ok('and still gives her a real one', reread.text.length > 30, reread.text.slice(0, 40) + '...');
  await page.evaluate(() => { localStorage.removeItem(window.__soMoments().key); });


  /* ---- THE LIFT ------------------------------------------------------
     A card taller than the stage used to say so with a dark gradient that,
     because the overlay is the scroller, scrolled INTO the middle of the
     card as a hard-edged band. There is a drawn groove and handle on the
     left instead, and it is not only a readout — it drags. */
  await page.evaluate(() => { window.__soSetHearts(30); window.__soFinish(); });
  await page.waitForTimeout(500);
  const L0 = await page.evaluate(() => {
    const ov = document.querySelector('.so-overlay.on'), el = document.getElementById('so-lift');
    const bar = document.getElementById('so-lift-bar');
    return { room: ov.scrollHeight - ov.clientHeight, on: el && el.classList.contains('on'),
             h: bar && parseFloat(bar.style.height), top: bar && parseFloat(bar.style.top),
             band: getComputedStyle(ov, '::before').content };
  });
  ok('a card taller than the stage shows the lift', L0.on === true, `room=${L0.room}`);
  ok('the handle is sized to how much there is to read',
     L0.h > 10 && L0.h < 96, `height=${L0.h}%`);
  ok('and it starts at the top', L0.top < 2, `top=${L0.top}%`);
  ok('the old dark band is gone', L0.band === 'none', L0.band);

  const L1 = await page.evaluate(() => {
    const ov = document.querySelector('.so-overlay.on');
    ov.scrollTop = ov.scrollHeight;
    ov.dispatchEvent(new Event('scroll'));
    const bar = document.getElementById('so-lift-bar');
    return { top: parseFloat(bar.style.top) };
  });
  /* the bottom of its TRAVEL, which is 100% less the handle's own height —
     a short card has a nearly-full handle that only moves a few percent */
  ok('reading to the end sends the handle to the bottom of its travel',
     Math.abs(L1.top - (100 - L0.h)) < 1.5 && L1.top > L0.top,
     `top=${L1.top}% of a possible ${(100 - L0.h).toFixed(1)}%`);

  /* dragging it back up actually scrolls the card */
  const L2 = await page.evaluate(() => {
    const el = document.getElementById('so-lift'), ov = document.querySelector('.so-overlay.on');
    const r = el.getBoundingClientRect();
    const ev = (t, y) => el.dispatchEvent(new PointerEvent(t, { clientY: y, clientX: r.left + 4, bubbles: true, pointerId: 1 }));
    ev('pointerdown', r.top + r.height * 0.9);
    ev('pointermove', r.top + 2);
    ev('pointerup', r.top + 2);
    return { scrollTop: ov.scrollTop, top: parseFloat(document.getElementById('so-lift-bar').style.top) };
  });
  ok('and dragging the handle takes her back up', L2.scrollTop < 8, `scrollTop=${L2.scrollTop}`);

  /* a card that fits has no lift at all */
  await page.evaluate(() => { window.__soGoLevel(0); window.__soSkipCard(); });
  const L3 = await page.evaluate(() => {
    const el = document.getElementById('so-lift');
    return el ? el.classList.contains('on') : false;
  });
  ok('and a closed overlay leaves no lift behind', L3 === false);

  ok('no page errors', errs.length === 0, errs.join(' | '));
  await browser.close();
  console.log(R.join('\n'));
  const f = R.filter(r => r.startsWith('FAIL')).length;
  console.log(`\n${R.length - f} passed, ${f} failed`);
  process.exit(f ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
