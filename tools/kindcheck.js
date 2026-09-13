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
  await page.evaluate(() => { window.__soLives(9); window.__soStuck(1); window.__soKill(); });
  await page.evaluate(() => window.__soPump(1.8, {}));
  ok('two falls is a world doing its job — no offer',
     await page.evaluate(() => !document.getElementById('so-hand')));
  ok('the ordinary revive card is what she gets',
     await page.evaluate(() => !!document.getElementById('so-revive-yes')));
  await page.evaluate(() => document.getElementById('so-revive-no').click());
  await play();

  await page.evaluate(() => { window.__soStuck(2); window.__soKill(); });
  await page.evaluate(() => window.__soPump(1.8, {}));
  const three = await page.evaluate(() => {
    const b = document.getElementById('so-hand');
    return { hand: !!b, label: b ? b.textContent.trim() : null,
             note: (document.querySelector('.so-card-note') || {}).textContent || '',
             kicker: (document.querySelector('.so-card-kicker') || {}).textContent || '' };
  });
  ok('three falls in the same spot and the offer appears', three.hand === true, three.label);
  ok('it says how many, truthfully', /3 times/.test(three.note), three.note.slice(0, 52) + '...');
  ok('and it leads with the bit being mean, not with her', /MEAN/.test(three.kicker), three.kicker);
  ok('the paid way is still there beside it',
     await page.evaluate(() => !!document.getElementById('so-revive-yes')));

  const gate0 = await page.evaluate(() => window.__soStuck().gate);
  await page.evaluate(() => document.getElementById('so-revive-no').click());
  await play();
  const no = await page.evaluate(() => window.__soStuck());
  ok('saying no clears the count', no.n === 0);
  ok('and raises the bar so it does not nag', no.gate > gate0, `${gate0} -> ${no.gate}`);

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
  ok('and with the glow on, so the stretch gets one free mistake', got.p.big === true);
  ok('taking it clears the count', got.st.n === 0);

  await page.evaluate(() => window.__soGoLevel(1)); await play();
  const fresh = await page.evaluate(() => window.__soStuck());
  ok('a new world starts her at nought again',
     fresh.n === 0 && fresh.gate === 3 && !fresh.check, JSON.stringify(fresh));

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

  ok('no page errors', errs.length === 0, errs.join(' | '));
  await browser.close();
  console.log(R.join('\n'));
  const f = R.filter(r => r.startsWith('FAIL')).length;
  console.log(`\n${R.length - f} passed, ${f} failed`);
  process.exit(f ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
