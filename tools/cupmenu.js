/* The menus, photographed: the title, the carousel and the builder. */
const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox','--no-proxy-server','--autoplay-policy=no-user-gesture-required'] });
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
  /* the how-to comes up on its own the first time, and localStorage is
     cleared above, so it is always the first time in here */
  await p.waitForFunction(() => OuissyCup.__cup.ui().name === 'help',
                          { timeout: 40000 });
  await p.waitForFunction(() => OuissyCup.__cup.ui().age > 1.2, null,
                          { timeout: 90000, polling: 250 });
  await p.screenshot({ path: '/tmp/cup-help.png' });
  await p.evaluate(() => OuissyCup.__cup.press('card_go'));
  /* THE TITLE SCREEN IS NOT DOM ANY MORE EITHER. It waits on the
     screen's own clock rather than the wall's, because under
     a slow container a second and a half of real time is a fraction of a second
     to the UI and the entrance would still be in flight. */
  await p.waitForFunction(() => OuissyCup.__cup.ui().name === 'title',
                          { timeout: 20000 });
  await p.waitForFunction(() => OuissyCup.__cup.ui().age > 1.2, null,
                          { timeout: 90000, polling: 250 });
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

  await p.evaluate(() => OuissyCup.__cup.press('m_teams'));
  await p.waitForFunction(() => OuissyCup.__cup.ui().name === 'teams', null,
                          { timeout: 30000 });
  await p.waitForFunction(() => OuissyCup.__cup.ui().age > 1.2, null,
                          { timeout: 120000, polling: 250 });
  await p.screenshot({ path: '/tmp/cup-select.png' });
  console.log('carousel at:', (await ui()).carAt);

  await uiClick('next');
  await p.waitForFunction(() => OuissyCup.__cup.ui().age > 1.2, null,
                          { timeout: 120000, polling: 250 });
  await p.screenshot({ path: '/tmp/cup-select2.png' });
  console.log('next team at:', (await ui()).carAt);

  /* THE BUILDER IS DRAWN TOO. It was the last screen in the chapter
     made of elements, so this is the last place a harness could reach
     into the page and read a rating out of an <b>. */
  await uiClick('build');
  await p.waitForFunction(() => OuissyCup.__cup.ui().name === 'builder',
                          { timeout: 20000 });
  await p.waitForFunction(() => OuissyCup.__cup.ui().age > 1.2, null,
                          { timeout: 90000, polling: 250 });
  await p.screenshot({ path: '/tmp/cup-builder-empty.png' });

  await p.evaluate(() => OuissyCup.__cup.press('b_1'));      // RANDOMISE
  await p.waitForTimeout(700);
  await p.screenshot({ path: '/tmp/cup-builder.png' });
  console.log('squad:', await p.evaluate(() =>
    OuissyCup.__cup.build().squad.join(' / ')));
  console.log('rating:', await p.evaluate(() => OuissyCup.__cup.build().rating));

  await p.evaluate(() => OuissyCup.__cup.press('b_0'));      // SAVE
  /* saving drops back onto the pixel carousel */
  await p.waitForFunction(() => OuissyCup.__cup.ui().on, null, { timeout: 30000 });
  await p.waitForFunction(() => OuissyCup.__cup.ui().age > 1.2, null,
                          { timeout: 120000, polling: 250 });
  await p.screenshot({ path: '/tmp/cup-saved.png' });
  console.log('saved, carousel at:', (await ui()).carAt);

  console.log(errs.length ? 'ERRORS: ' + errs.slice(0, 4).join(' | ') : 'no page errors');
  await b.close();
})();
