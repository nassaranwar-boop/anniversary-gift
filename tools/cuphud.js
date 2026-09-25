/* HOW MUCH OF THE SCREEN THE HUD IS WEARING.
 *
 * "It feels too full" is a real complaint and a useless instruction, so
 * this turns it into a number. The HUD is painted on its own canvas
 * over the pitch, so the fraction of that canvas which is not
 * transparent IS the fraction of the picture she cannot see the match
 * through. Count it during open play, when there is nothing on screen
 * that has any business being there except the instruments she plays
 * with.
 *
 * It also lists what is up, because the count does not say which of
 * eight things to remove.
 *
 *   node tools/cuphud.js
 */
const { chromium } = require('playwright-core');

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox', '--no-proxy-server', '--autoplay-policy=no-user-gesture-required'] });
  const p = await b.newPage({ viewport: { width: 960, height: 540 }, deviceScaleFactor: 1 });
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.route('**/*', r => r.request().url().startsWith('http://127.0.0.1') ? r.continue() : r.abort());
  await p.goto('http://127.0.0.1:8899/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForTimeout(900);
  await p.evaluate(() => { try { localStorage.clear(); } catch (e) {} showScreen('hub'); startHub(); });
  await p.waitForTimeout(250);
  await p.click('#hub-card-cup');
  await p.waitForFunction(() => window.OuissyCup && OuissyCup.__cup.state() !== null, { timeout: 60000 });
  await p.waitForTimeout(600);

  /* OPEN PLAY, AT THE MATCH CAMERA. A celebration or a replay is a
     different picture with different things on it, and measuring one of
     those answers a question nobody asked. */
  const settle = async (mins) => {
    await p.evaluate((m) => {
      const H = OuissyCup.__cup;
      H.quick(0); H.auto(true);
      for (let i = 0; i < 400 && H.state().state !== 'play'; i++) H.step(1, 0, 0, false);
      /* far enough in that the first-match legend has faded, unless we
         are deliberately looking at the first minute */
      for (let i = 0; i < m; i++) H.step(1, 0, 0, false);
      for (let i = 0; i < 4000 && H.state().state !== 'play'; i++) H.step(1, 0, 0, false);
      H.camSnap();
    }, mins);
    await p.waitForTimeout(700);
  };

  const cover = () => p.evaluate(() => {
    const c = document.getElementById('cup-ui');
    const x = c.getContext('2d');
    const d = x.getImageData(0, 0, c.width, c.height).data;
    let ink = 0;
    /* ROWS, so the shape of the clutter shows as well as its size */
    const rows = new Array(10).fill(0), band = c.height / 10;
    for (let i = 0, px = 0; i < d.length; i += 4, px++) {
      if (d[i + 3] > 12) {
        ink++;
        rows[Math.min(9, Math.floor(Math.floor(px / c.width) / band))]++;
      }
    }
    const total = c.width * c.height;
    return {
      size: [c.width, c.height],
      inkPct: +(ink / total * 100).toFixed(1),
      rowPct: rows.map((r, i) => +(r / (c.width * band) * 100).toFixed(0)),
    };
  });

  await settle(2400);
  const late = await cover();
  console.log('   open play, later in the half');
  console.log('     HUD covers ' + late.inkPct + '% of the picture   (' + late.size.join('x') + ')');
  console.log('     by tenth of the frame, top to bottom: ' + late.rowPct.join(' '));
  await p.screenshot({ path: '/tmp/hud-late.png' });

  await settle(60);
  const early = await cover();
  console.log('   open play, first minute (the legend is still up)');
  console.log('     HUD covers ' + early.inkPct + '% of the picture');
  console.log('     by tenth of the frame, top to bottom: ' + early.rowPct.join(' '));
  await p.screenshot({ path: '/tmp/hud-early.png' });

  console.log(errs.length ? 'PAGE ERRORS: ' + JSON.stringify(errs.slice(0, 3)) : '   no page errors');
  console.log('DONE');
  await b.close();
})();
