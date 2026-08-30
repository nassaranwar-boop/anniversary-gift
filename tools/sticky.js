// Every way a touch button can get stuck down, exercised on a phone viewport.
const { chromium } = require('playwright-core');
const R = [];
const ok = (n, c, x) => R.push((c ? 'PASS  ' : 'FAIL  ') + n + (x ? '   ' + x : ''));
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox','--no-proxy-server','--disable-gpu'] });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  page.on('pageerror', e => console.log('PAGEERROR', e.message));
  await page.route('**/*', r => r.request().url().startsWith('http://127.0.0.1') ? r.continue() : r.abort());
  await page.goto('http://127.0.0.1:8899/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(400);
  await page.evaluate(() => { try{localStorage.clear();}catch(e){} showScreen('ouissy'); startSuperOuissy(); });
  await page.waitForTimeout(400);
  await page.click('[data-so-diff="easy"]'); await page.click('#so-play'); await page.waitForTimeout(300);
  const how = await page.$('#so-how-ok'); if (how) await how.click();
  for (let i = 0; i < 30; i++) { await page.waitForTimeout(200);
    if (await page.evaluate(() => window.__soInfo().state === 'play')) break; }
  const keys = () => page.evaluate(() => G_keys());
  const box = async (sel) => (await page.$(sel)).boundingBox();

  // 1. a normal press and release
  const right = await box('[data-so-key="right"]');
  await page.mouse.move(right.x + right.width/2, right.y + right.height/2);
  await page.mouse.down();
  let k = await keys();
  ok('press sets the key', k.right === true);
  await page.mouse.up();
  k = await keys();
  ok('release clears it', k.right === false);

  // 2. press, then drag the finger off the button and release elsewhere
  await page.mouse.move(right.x + right.width/2, right.y + right.height/2);
  await page.mouse.down();
  await page.mouse.move(20, 40);            // way off the button
  await page.mouse.up();
  k = await keys();
  ok('releasing off the button still clears it', k.right === false, JSON.stringify(k));

  // 3. press and never release, then change screen (pause)
  await page.mouse.move(right.x + right.width/2, right.y + right.height/2);
  await page.mouse.down();
  await page.evaluate(() => SuperOuissy.pause());
  await page.waitForTimeout(200);
  k = await keys();
  ok('pausing mid-press clears it', k.right === false, JSON.stringify(k));
  await page.mouse.up();
  await page.evaluate(() => SuperOuissy.pause());
  await page.waitForTimeout(300);

  // 4. the button must not keep focus after a tap
  const jump = await box('[data-so-key="jump"]');
  await page.mouse.click(jump.x + jump.width/2, jump.y + jump.height/2);
  await page.waitForTimeout(100);
  const focused = await page.evaluate(() => (document.activeElement || {}).getAttribute
    ? document.activeElement.getAttribute('data-so-key') : null);
  ok('a tapped button does not keep focus', focused === null, 'focus=' + focused);
  k = await keys();
  ok('and the tap did not leave jump held', k.jump === false, JSON.stringify(k));

  // 5. rapid tapping leaves nothing held
  for (let i = 0; i < 12; i++) {
    await page.mouse.move(right.x + right.width/2, right.y + right.height/2);
    await page.mouse.down(); await page.mouse.up();
  }
  await page.waitForTimeout(120);
  k = await keys();
  ok('rapid tapping leaves nothing held', !k.right && !k.jump && !k.left, JSON.stringify(k));

  // 6. and she is not still moving
  const before = await page.evaluate(() => window.__soPlayer().x);
  await page.waitForTimeout(700);
  const after = await page.evaluate(() => window.__soPlayer().x);
  ok('she has stopped moving on her own', Math.abs(after - before) < 4,
     'drifted ' + Math.round(Math.abs(after - before)) + 'px');

  console.log(R.join('\n'));
  await browser.close();
})();
