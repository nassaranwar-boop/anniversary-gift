// Walk every screen that existed before this change and confirm it still
// works: no page errors, no horizontal scroll, the expected nodes present.
const { chromium } = require('playwright-core');
const out = [];
const ok = (n, c, x) => out.push((c ? 'PASS  ' : 'FAIL  ') + n + (x ? '   ' + x : ''));
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox','--no-proxy-server','--disable-gpu'] });
  for (const [label, w, h] of [['desktop', 1280, 800], ['iphone', 390, 844]]) {
    const page = await browser.newPage({ viewport: { width: w, height: h }, isMobile: w < 900, hasTouch: w < 900 });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error' && !/ERR_FAILED|Failed to load resource/.test(m.text())) errors.push(m.text()); });
    await page.route('**/*', r => r.request().url().startsWith('http://127.0.0.1') ? r.continue() : r.abort());
    await page.goto('http://127.0.0.1:8899/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(900);

    const hs = () => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    ok(label + ': loads with no page errors', errors.length === 0, errors[0] || '');
    ok(label + ': the book intro is up', await page.evaluate(() =>
      !!document.querySelector('.screen.active')));

    // the passcode gate
    await page.evaluate(() => { if (window.finishBookIntro) finishBookIntro(); });
    const gateUp = await page.waitForFunction(
      () => document.getElementById('screen-gate').classList.contains('active'),
      { timeout: 12000, polling: 200 }).then(() => true).catch(() => false);
    ok(label + ': gate reached', gateUp);
    await page.evaluate(() => { if (window.skipBookIntro) skipBookIntro(); });
    for (const d of '2207') {
      await page.click(`[data-gate-key="${d}"]`, { force: true });
      await page.waitForTimeout(160);
    }
    await page.click('#gate-submit', { force: true });
    await page.waitForTimeout(3200);
    ok(label + ': passcode 2207 still opens the book',
       await page.evaluate(() => document.getElementById('screen-scrapbook').classList.contains('active')));
    ok(label + ': the scrapbook module is alive', await page.evaluate(() => !!window.Scrapbook));

    // straight to the hub, then each chapter in turn
    await page.evaluate(() => { stopDioramas(); showScreen('hub'); startHub(); });
    await page.waitForTimeout(500);
    const cards = await page.evaluate(() => Array.from(document.querySelectorAll('.hub-card')).map(c => c.id));
    /* Named, not counted. This said `=== 4` and had been failing on every
       run since the racing chapter became the fifth card — a suite that is
       always red is a suite nobody reads. Listing them by name means adding
       a chapter fails here once, on purpose, instead of silently. */
    const WANT = ['hub-card-maze','hub-card-quest','hub-card-ouissy','hub-card-apoc','hub-card-race'];
    ok(label + ': the hub has every card',
       WANT.every(id => cards.includes(id)) && cards.length === WANT.length,
       cards.join(','));
    ok(label + ': no horizontal scroll on the hub', (await hs()) === 0, 'overflow ' + (await hs()));

    await page.evaluate(() => { level = 1; showScreen('details'); });
    await page.waitForTimeout(300);
    await page.evaluate(() => { showScreen('maze'); initMaze(1); });
    await page.waitForTimeout(900);
    const maze = await page.evaluate(() => ({
      tiles: document.querySelectorAll('#maze-grid .cell, #maze-grid > *').length,
      player: !!document.getElementById('player-token'),
      hud: (document.getElementById('hud-time') || {}).textContent,
    }));
    ok(label + ': the maze still builds', maze.tiles > 0 && maze.player, 'tiles=' + maze.tiles);
    ok(label + ': no horizontal scroll in the maze', (await hs()) === 0);

    await page.evaluate(() => { showScreen('quest'); startQuest(); });
    await page.waitForTimeout(1100);
    const quest = await page.evaluate(() => {
      const cv = document.getElementById('hv-canvas');
      const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
      let painted = 0; for (let i = 3; i < d.length; i += 4000) if (d[i] > 0) painted++;
      return { painted: painted, buttons: document.querySelectorAll('.hv-btn').length };
    });
    ok(label + ': the adventure still paints', quest.painted > 5, 'samples=' + quest.painted);

    await page.evaluate(() => { hvStopLoop(); showScreen('keepsake'); startKeepsake(); });
    await page.waitForTimeout(400);
    ok(label + ': the keepsake still builds',
       await page.evaluate(() => document.querySelectorAll('#ks-board .ks-card').length > 0));

    // the apocalypse, from its hub card, through to a level that paints
    await page.evaluate(() => { showScreen('hub'); startHub(); });
    await page.waitForTimeout(300);
    await page.click('#hub-card-apoc');
    await page.waitForSelector('.ap-card-go', { timeout: 6000 }).catch(() => {});
    ok(label + ': the hub card opens the apocalypse',
       await page.evaluate(() => document.getElementById('screen-apoc').classList.contains('active')));
    ok(label + ': no horizontal scroll in it', (await hs()) === 0, 'overflow ' + (await hs()));
    const apoc = await page.evaluate(() => {
      window.__apEnter(0);
      window.__apPaint();
      const cv = document.getElementById('ap-canvas');
      const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
      let painted = 0; for (let i = 3; i < d.length; i += 4000) if (d[i] > 0) painted++;
      return { painted: painted, state: window.__apState().state };
    });
    ok(label + ': the apocalypse paints', apoc.painted > 5, 'samples=' + apoc.painted);
    await page.evaluate(() => Apocalypse.stop());

    // the ending it hands off to
    await page.evaluate(() => { showScreen('end'); activateEndingScene(); });
    /* Same again: poll for the first painted frame instead of guessing. */
    await page.waitForFunction(() => {
      const cv = document.getElementById('night-canvas');
      if (!cv) return false;
      const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
      for (let i = 3; i < d.length; i += 4000) if (d[i] > 0) return true;
      return false;
    }, { timeout: 10000, polling: 200 }).catch(() => {});
    const endShot = await page.evaluate(() => {
      const cv = document.getElementById('night-canvas');
      if (!cv) return { painted: 0, views: 0 };
      const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
      let painted = 0; for (let i = 3; i < d.length; i += 4000) if (d[i] > 0) painted++;
      return { painted: painted, views: nightBases.length };
    });
    ok(label + ': the roof ending paints', endShot.painted > 5, 'samples=' + endShot.painted);
    ok(label + ': it has all four shots', endShot.views === 4, 'views=' + endShot.views);
    await page.evaluate(() => stopNightScene());

    // and Super Ouissy, from its hub card
    await page.evaluate(() => { showScreen('hub'); startHub(); });
    await page.waitForTimeout(300);
    await page.click('#hub-card-ouissy');
    // wait for the thing itself rather than guessing at a duration: the
    // dissolve is 420ms and the menu is built after it
    await page.waitForSelector('.so-diff-card', { timeout: 6000 }).catch(() => {});
    ok(label + ': the hub card opens Super Ouissy',
       await page.evaluate(() => document.getElementById('screen-ouissy').classList.contains('active')
                              && !!document.querySelector('.so-diff-card')));
    // and back out again, leaving the hub intact
    await page.click('#so-quit-menu');
    await page.waitForFunction(
      () => document.getElementById('screen-hub').classList.contains('active'),
      { timeout: 6000 }).catch(() => {});
    ok(label + ': quitting returns to the hub',
       await page.evaluate(() => document.getElementById('screen-hub').classList.contains('active')));
    ok(label + ': still no page errors after all of that', errors.length === 0, errors.slice(0,2).join(' | '));
    await page.close();
  }
  console.log(out.join('\n'));
  await browser.close();
})();
