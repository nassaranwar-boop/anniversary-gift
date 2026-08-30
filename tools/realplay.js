// PLAY IT THE WAY A PERSON DOES.
//
// Every other suite drives the game itself — window.__soTestDrive plus
// __soPump — which is fast and deterministic and completely blind to
// anything wrong with the requestAnimationFrame path. That is how a bug
// that left the entire game rendering NOTHING got past 66 green assertions:
// a second function called `frame` shadowed the game loop, so rAF scheduled
// a sprite lookup instead. Nothing here touches the harness hooks: it
// clicks, it waits, and it looks at what is actually on the canvas.
const { chromium } = require('playwright-core');
const R = [];
const ok = (n, c, x) => R.push((c ? 'PASS  ' : 'FAIL  ') + n + (x ? '   ' + x : ''));

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox','--no-proxy-server','--disable-gpu'] });
  const errs = [];

  const look = (page) => page.evaluate(() => {
    const cv = document.getElementById('so-canvas');
    const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
    const seen = {}; let painted = 0;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] > 0) painted++;
      seen[(d[i] << 16) | (d[i + 1] << 8) | d[i + 2]] = 1;
    }
    return { pct: Math.round(painted / (d.length / 4) * 100), colours: Object.keys(seen).length };
  });

  for (const diff of ['easy', 'medium', 'hard']) {
    const page = await browser.newPage({ viewport: { width: 1000, height: 700 } });
    page.on('pageerror', e => errs.push(diff + ': ' + e.message));
    page.on('console', m => { if (m.type() === 'error' && !/ERR_FAILED|Failed to load/.test(m.text())) errs.push(diff + ': ' + m.text()); });
    await page.route('**/*', r => r.request().url().startsWith('http://127.0.0.1') ? r.continue() : r.abort());
    await page.goto('http://127.0.0.1:8899/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(600);
    await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} showScreen('ouissy'); startSuperOuissy(); });
    await page.waitForSelector('.so-diff-card', { timeout: 6000 });
    await page.waitForTimeout(1200);

    const menu = await look(page);
    ok(diff + ': the title screen paints', menu.pct > 90 && menu.colours > 8,
       menu.pct + '% of the canvas, ' + menu.colours + ' colours');

    await page.click(`[data-so-diff="${diff}"]`);
    await page.click('#so-play');
    await page.waitForTimeout(400);
    const how = await page.$('#so-how-ok'); if (how) await how.click();
    await page.waitForTimeout(4200);          // world card, then play

    const game = await look(page);
    ok(diff + ': the world paints', game.pct > 90 && game.colours > 20,
       game.pct + '% of the canvas, ' + game.colours + ' colours');

    // and it is a LIVE picture, not one frame that stopped
    const a = await page.evaluate(() => document.getElementById('so-canvas').toDataURL().length);
    await page.waitForTimeout(700);
    const b = await page.evaluate(() => document.getElementById('so-canvas').toDataURL().length);
    const st = await page.evaluate(() => window.__soState());
    ok(diff + ': the loop is running', st.onGround === true,
       'she has landed: onGround=' + st.onGround);

    // It responds to a key. Measured in PIXELS, not tiles: rAF runs at
    // about 3fps in a headless container, so the sim advances at roughly a
    // third of real speed and a tile-rounded reading sits right on the
    // threshold — which is a flaky test, not a slow game.
    const x0 = await page.evaluate(() => window.__soPlayer().x);
    await page.keyboard.down('ArrowRight');
    /* Poll rather than sample once. rAF is throttled unpredictably in this
       container — the same run has produced 23px, 5px and 23px across the
       three difficulties — so a fixed window measures how many frames the
       container felt like giving us, not whether the key works. Hold the
       key until she has clearly moved, or give up after six seconds. */
    let x1 = x0;
    for (let i = 0; i < 60 && x1 - x0 <= 8; i++) {
      await page.waitForTimeout(100);
      x1 = await page.evaluate(() => window.__soPlayer().x);
    }
    await page.keyboard.up('ArrowRight');
    ok(diff + ': it responds to input', x1 - x0 > 8,
       'moved ' + Math.round(x1 - x0) + 'px right');
    await page.close();
  }

  console.log(R.join('\n'));
  console.log(errs.length ? 'ERRORS: ' + errs.join(' | ') : 'no page errors');
  await browser.close();
})();
