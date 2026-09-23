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

  /* TEAM SELECT IS NOT DOM ANY MORE.

     It is drawn into the pixel UI canvas, so there is nothing here to
     query with a selector and nothing to click with one either — its
     buttons are rectangles inside a canvas. tools/cupui.js drives and
     checks that screen properly through the widget table the chapter
     exposes. This file goes straight on to the squad builder, which is
     still DOM. */
  const ui = () => p.evaluate(() => OuissyCup.__cup.ui());
  const uiClick = async (id) => {
    const el = await p.evaluate((wid) => {
      const w = OuissyCup.__cup.ui().widgets.find(v => v.id === wid);
      const c = document.getElementById('cup-ui');
      const r = c.getBoundingClientRect();
      return w ? { x: r.left + (w.x + w.w / 2) / c.width * r.width,
                   y: r.top + (w.y + w.h / 2) / c.height * r.height } : null;
    }, id);
    if (!el) throw new Error('no widget ' + id);
    await p.mouse.click(el.x, el.y);
  };

  await p.click('[data-go="teams"]');
  await p.waitForFunction(() => OuissyCup.__cup.ui().on, null, { timeout: 30000 });
  await p.waitForFunction(() => OuissyCup.__cup.ui().age > 1.2, null,
                          { timeout: 120000, polling: 250 });
  await p.screenshot({ path: '/tmp/cup-select.png' });
  console.log('carousel at:', (await ui()).carAt);

  await uiClick('next');
  await p.waitForFunction(() => OuissyCup.__cup.ui().age > 1.2, null,
                          { timeout: 120000, polling: 250 });
  await p.screenshot({ path: '/tmp/cup-select2.png' });
  console.log('next team at:', (await ui()).carAt);

  await uiClick('build');
  await p.waitForSelector('.cup-build', { timeout: 20000 });
  await p.waitForTimeout(400);
  await p.screenshot({ path: '/tmp/cup-builder-empty.png' });

  await p.click('[data-go="rand"]');
  await p.waitForTimeout(700);
  await p.screenshot({ path: '/tmp/cup-builder.png' });
  console.log('rating:', await p.evaluate(() =>
    document.querySelector('.cup-rating b').textContent));
  console.log('squad:', await p.evaluate(() =>
    Array.from(document.querySelectorAll('.cup-slot span')).map(s => s.textContent).join(' / ')));

  await p.click('[data-go="save"]');
  /* saving drops back onto the pixel carousel */
  await p.waitForFunction(() => OuissyCup.__cup.ui().on, null, { timeout: 30000 });
  await p.waitForFunction(() => OuissyCup.__cup.ui().age > 1.2, null,
                          { timeout: 120000, polling: 250 });
  await p.screenshot({ path: '/tmp/cup-saved.png' });
  console.log('saved, carousel at:', (await ui()).carAt);

  console.log(errs.length ? 'ERRORS: ' + errs.slice(0, 4).join(' | ') : 'no page errors');
  await b.close();
})();
