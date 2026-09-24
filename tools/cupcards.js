/* THE CARDS, PHOTOGRAPHED.
 *
 * Everything between matches — the controls, the fixture, half time,
 * a memory and the ending — in one pass, because a set of cards is
 * only consistent when you look at them together.
 *
 *   node tools/cupcards.js
 */
const { chromium } = require('playwright-core');

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox','--no-proxy-server'] });
  const p = await b.newPage({ viewport: { width: 960, height: 600 }, deviceScaleFactor: 1 });
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.route('**/*', r => r.request().url().startsWith('http://127.0.0.1') ? r.continue() : r.abort());
  await p.goto('http://127.0.0.1:8899/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForTimeout(800);
  await p.evaluate(() => window.loadChapter && window.loadChapter('cup'));
  await p.waitForFunction(() => !!window.OuissyCup, { timeout: 30000 });
  await p.evaluate(() => { try { localStorage.clear(); } catch (e) {} showScreen('cup');
                           OuissyCup.__cup.soundOff(); OuissyCup.start(); });

  const settle = async (name) => {
    await p.waitForFunction((n) => OuissyCup.__cup.ui().name === n, name, { timeout: 40000 });
    await p.waitForFunction(() => OuissyCup.__cup.ui().age > 1.3, null,
                            { timeout: 90000, polling: 250 });
  };
  const shot = async (n) => { await p.screenshot({ path: '/tmp/card-' + n + '.png' }); console.log('  ' + n); };

  await settle('help');   await shot('help');
  await p.evaluate(() => OuissyCup.__cup.press('card_go'));
  await settle('title');
  await p.evaluate(() => OuissyCup.__cup.press('m_coupe'));
  await settle('round');  await shot('round');

  /* half time: start the match, then put the clock past the whistle */
  await p.evaluate(() => OuissyCup.__cup.press('card_go'));
  await p.evaluate(() => {
    for (let i = 0; i < 260 && OuissyCup.__cup.state().state !== 'play'; i++) {
      OuissyCup.__cup.step(1, 0, 0, false);
    }
    for (let i = 0; i < 160; i++) OuissyCup.__cup.step(1, 0.3, -0.8, false);
    OuissyCup.__cup.setClock(999);
    OuissyCup.__cup.step(1, 0, 0, false);
  });
  await settle('half');   await shot('half');

  /* a memory, and then the ending, both straight off their own hooks */
  await p.evaluate(() => OuissyCup.__cup.memory(0));
  await settle('memory'); await shot('memory');
  await p.evaluate(() => OuissyCup.__cup.ending());
  await settle('end');    await shot('end');

  console.log(errs.length ? 'ERRORS: ' + errs.slice(0, 3).join(' | ') : 'no page errors');
  await b.close();
})();
