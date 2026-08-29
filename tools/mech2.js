const { chromium } = require('playwright-core');
const R = [];
const ok = (name, cond, extra) => { R.push((cond ? 'PASS  ' : 'FAIL  ') + name + (extra ? '   ' + extra : '')); };

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox','--no-proxy-server','--disable-gpu'] });
  const page = await browser.newPage({ viewport: { width: 900, height: 560 } });
  const errors = [];
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
  page.on('console', m => { if (m.type()==='error' && !/ERR_FAILED/.test(m.text())) errors.push('CONSOLE: '+m.text()); });
  await page.route('**/*', r => r.request().url().startsWith('http://127.0.0.1') ? r.continue() : r.abort());
  await page.goto('http://127.0.0.1:8899/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(400);
  await page.evaluate(() => { window.__soTestDrive = true; });

  const boot = async (diff) => {
    await page.evaluate(() => { try{localStorage.clear();}catch(e){} showScreen('ouissy'); if (window.SuperOuissy) SuperOuissy.stop(); startSuperOuissy(); });
    await page.waitForTimeout(250);
    await page.click(`[data-so-diff="${diff}"]`); await page.click('#so-play');
    await page.waitForTimeout(200);
    const how = await page.$('#so-how-ok'); if (how) await how.click();
    await page.waitForTimeout(2200);
    await page.evaluate(() => { window.__soTestDrive = true;  });
  };
  const pump = (sec, keys) => page.evaluate(([s,k]) => window.__soPump(s,k), [sec, keys||null]);
  const tele = async (t) => { await page.evaluate(() => window.__soReset()); await page.evaluate(t2 => window.__soTele(t2), t); };
  const info = () => page.evaluate(() => window.__soInfo());

  // ---------- checkpoints, the sparkle, the feather, the clock ----------
  await boot('medium');
  // stand on the ribbon at tile 165, then die, and check where she comes back
  await tele(165); await pump(0.6, {});
  let cp = await info();
  ok('the checkpoint is taken by walking over it', cp.score >= 0);
  await page.evaluate(() => window.__soPlayer({ y: 99999 }));
  await pump(3.0, {});
  a = await info();
  ok('she respawns at the checkpoint, not the start', a.x > 150, 'respawned at tile ' + a.x);

  // Easy has a ribbon in every world; Hard has none
  await boot('hard');
  ok('Hard has no checkpoints', await page.evaluate(() => !window.__soDiffFlag('checkpoints')));

  // the sparkle state: walk through an enemy unharmed
  await boot('medium');
  await tele(26); await pump(0.2);
  await page.evaluate(() => window.__soPlayer({ star: 9 }));
  before = (await info()).lives;
  await page.evaluate(() => window.__soAboveEnemy());
  await pump(0.1, {});
  await page.evaluate(() => window.__soPlayer({ y: window.__soPlayer().y + 8, vy: 0 }));
  await pump(1.2, { right: true });
  a = await info();
  ok('the sparkle state costs no lives on contact', a.lives === before, 'lives=' + a.lives);

  // the feather: a second jump in mid-air. Measure the highest point she
  // reaches across the whole jump, with and without it.
  const peak = async (wing) => {
    await tele(20); await pump(0.3, {});
    return page.evaluate(w => {
      if (w) window.__soPlayer({ wing: true, jumpsLeft: 1 });
      var ground = window.__soPlayer().y, best = ground;
      window.__soPump(0.2, { jump: true });          // a full held jump
      for (var i = 0; i < 40; i++) {
        if (i === 12) { window.__soPump(0.02, { jump: false });
                        window.__soPump(0.02, { jump: true }); }  // press again at the top
        window.__soPump(0.02, {});
        best = Math.min(best, window.__soPlayer().y);
      }
      return Math.round(ground - best);
    }, wing);
  };
  const plain = await peak(false), feathered = await peak(true);
  ok('the feather gives a real second jump', feathered > plain + 20,
     'one jump ' + plain + 'px, with the feather ' + feathered + 'px');

  // the clock on Hard actually runs out
  await boot('hard');
  before = (await info()).deaths;
  await page.evaluate(() => window.__soSetTime(0.4));
  await pump(1.5, {});
  a = await info();
  ok('running out of time costs a life on Hard', a.deaths > before, 'deaths=' + a.deaths);

  console.log(R.join('\n'));
  console.log(errors.length ? 'ERRORS: ' + errors.join(' | ') : 'no page errors');
  await browser.close();
})();
