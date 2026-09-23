/* The menus, photographed: the title, the carousel and the builder. */
const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--use-gl=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist',
           '--no-sandbox','--no-proxy-server','--autoplay-policy=no-user-gesture-required'] });
  const p = await b.newPage({ viewport: { width: 1060, height: 660 }, deviceScaleFactor: 1 });
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.route('**/*', r => r.request().url().startsWith('http://127.0.0.1') ? r.continue() : r.abort());
  await p.goto('http://127.0.0.1:8899/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForTimeout(1000);
  await p.evaluate(() => window.loadChapter && window.loadChapter('cup'));
  await p.waitForFunction(() => !!window.OuissyCup, { timeout: 30000 });
  await p.evaluate(() => { try { localStorage.clear(); } catch (e) {}
                           showScreen('cup'); OuissyCup.__cup.soundOff();
                           OuissyCup.__cup.shadows(false); OuissyCup.start(); });
  await p.waitForSelector('#cup-overlay .cup-menu', { timeout: 40000 });
  /* the how-to comes up on its own the first time, and localStorage is
     cleared above, so it is always the first time in here */
  await p.waitForTimeout(500);
  await p.screenshot({ path: '/tmp/cup-help.png' });
  if (await p.$('[data-go="back"]')) await p.click('[data-go="back"]');
  await p.waitForSelector('[data-go="coupe"]', { timeout: 20000 });
  /* long enough for the line-up to walk out and the camera to settle */
  await p.waitForTimeout(1400);
  await p.screenshot({ path: '/tmp/cup-title.png' });

  await p.click('[data-go="teams"]');
  await p.waitForTimeout(800);
  await p.screenshot({ path: '/tmp/cup-select.png' });
  console.log('carousel team:', await p.evaluate(() =>
    document.querySelector('.cup-tcard-name h4').textContent));

  await p.click('[data-go="next"]');
  await p.waitForTimeout(600);
  await p.screenshot({ path: '/tmp/cup-select2.png' });
  console.log('next team:', await p.evaluate(() =>
    document.querySelector('.cup-tcard-name h4').textContent));

  await p.click('[data-go="build"]');
  await p.waitForTimeout(600);
  await p.screenshot({ path: '/tmp/cup-builder-empty.png' });

  await p.click('[data-go="rand"]');
  await p.waitForTimeout(700);
  await p.screenshot({ path: '/tmp/cup-builder.png' });
  console.log('rating:', await p.evaluate(() =>
    document.querySelector('.cup-rating b').textContent));
  console.log('squad:', await p.evaluate(() =>
    Array.from(document.querySelectorAll('.cup-slot span')).map(s => s.textContent).join(' / ')));

  await p.click('[data-go="save"]');
  await p.waitForTimeout(700);
  await p.screenshot({ path: '/tmp/cup-saved.png' });
  console.log('saved as:', await p.evaluate(() =>
    document.querySelector('.cup-tcard-name h4').textContent));
  console.log(errs.length ? 'ERRORS: ' + errs.slice(0, 4).join(' | ') : 'no page errors');
  await b.close();
})();
