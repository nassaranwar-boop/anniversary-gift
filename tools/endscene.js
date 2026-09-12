/* THE ENDING IS A SCENE NOW. It used to be a picture that appeared under a
   wall of text at the same instant the text did. This checks that it is
   directed: that it starts dark, that she crosses, that the text is held
   back until they meet, that the sun comes up, and — the important one —
   that a tap gets her out of it from the first frame. */
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

  await page.evaluate(() => { window.__soTestDrive = true; try{localStorage.clear();}catch(e){}
    SuperOuissy.stop(); showScreen('ouissy'); startSuperOuissy(); });
  await page.waitForSelector('.so-diff-card', { timeout:6000 });
  await page.click('[data-so-diff="hard"]'); await page.click('#so-play');
  await page.waitForTimeout(250);
  const how = await page.$('#so-how-ok'); if (how) await how.click();
  await page.waitForFunction(() => window.__soInfo().state === 'play', { timeout:8000 });

  /* read the scene canvas: average brightness, and a cheap fingerprint so
     two frames can be told apart */
  const look = () => page.evaluate(() => {
    const cv = document.querySelector('#so-end-art canvas');
    if (!cv) return null;
    const g = cv.getContext('2d');
    const d = g.getImageData(0, 0, cv.width, cv.height).data;
    let sum = 0, sig = 0, n = 0;
    for (let i = 0; i < d.length; i += 4 * 7) {
      const v = (d[i] + d[i+1] + d[i+2]) / 3;
      sum += v; sig = (sig * 31 + (v | 0)) % 1000003; n++;
    }
    return { bright: sum / n, sig, w: cv.width, h: cv.height };
  });
  const playing = () => page.evaluate(() => {
    const e = document.querySelector('.so-end');
    if (!e) return null;
    const line = document.querySelector('.so-end-sign');
    return { playing: e.classList.contains('playing'),
             signOpacity: line ? +getComputedStyle(line).opacity : null };
  });

  /* ---- the scene, played straight through ------------------------- */
  await page.evaluate(() => window.__soShowEnding());
  await page.waitForSelector('#so-end-art canvas', { timeout: 5000 });
  await page.waitForTimeout(150);
  const t0 = await look(), s0 = await playing();
  ok('the scene starts on its own frame', !!t0 && t0.w === 240, t0 && `${t0.w}x${t0.h}`);
  ok('it opens in the dark', t0.bright < 40, `brightness=${t0.bright.toFixed(1)}`);
  ok('the reading is held back while it plays', s0.playing === true && s0.signOpacity === 0,
     `playing=${s0.playing} sign opacity=${s0.signOpacity}`);

  await page.waitForTimeout(1600);
  const t1 = await look();
  ok('she walks in out of it', t1.sig !== t0.sig && t1.bright > t0.bright,
     `brightness ${t0.bright.toFixed(1)} -> ${t1.bright.toFixed(1)}`);
  await page.waitForTimeout(1400);
  const t2 = await look();
  ok('and she is still moving a second later', t2.sig !== t1.sig);
  ok('the text has not arrived yet', (await playing()).playing === true);

  /* they meet at 7.4s; give it to 8.6 */
  await page.waitForTimeout(5400);
  const t3 = await look(), s3 = await playing();
  ok('once they meet, the card arrives', s3.playing === false, `playing=${s3.playing}`);
  /* a fade and a raf loop are wall-clock things and this browser is
     software-rendered, so both of these are waited for rather than
     sampled at one instant */
  let op = 0;
  for (let i = 0; i < 24 && op <= 0.9; i++) { await page.waitForTimeout(250); op = (await playing()).signOpacity; }
  ok('and it is readable', op > 0.9, `opacity=${op}`);
  ok('the sun came up while she crossed', t3.bright > t1.bright + 8,
     `${t1.bright.toFixed(1)} -> ${t3.bright.toFixed(1)}`);
  let moved = false, last = await look();
  for (let i = 0; i < 12 && !moved; i++) { await page.waitForTimeout(200); moved = (await look()).sig !== last.sig; }
  ok('the scene keeps running under the card', moved);

  /* ---- the skip --------------------------------------------------- */
  await page.evaluate(() => { window.__soShowEnding(); });
  await page.waitForTimeout(300);
  ok('a replay plays the scene again', (await playing()).playing === true);
  await page.evaluate(() => document.querySelector('.so-ov-end').dispatchEvent(
    new PointerEvent('pointerdown', { bubbles: true })));
  await page.waitForTimeout(400);
  const sk = await playing(), skl = await look();
  ok('a tap gets her straight to them', sk.playing === false, `playing=${sk.playing}`);
  ok('and it skips forward rather than cutting to black', skl.bright > 40,
     `brightness=${skl.bright.toFixed(1)}`);

  /* ---- coming back to the card is not the scene again -------------- */
  await page.evaluate(() => window.__soShowEnding(true));
  await page.waitForTimeout(350);
  const ag = await playing(), agl = await look();
  ok('coming back from a sub-screen does not replay it', ag.playing === false);
  ok('and lands on the two of them, lit', agl.bright > 40, `brightness=${agl.bright.toFixed(1)}`);
  ok('the card is readable straight away', ag.signOpacity > 0.9, `opacity=${ag.signOpacity}`);

  /* ---- and the buttons still work --------------------------------- */
  ok('what-now is still wired', await page.evaluate(() => !!document.getElementById('so-end-again')));
  ok('no page errors', errs.length === 0, errs.join(' | '));

  await browser.close();
  console.log(R.join('\n'));
  const f = R.filter(r => r.startsWith('FAIL')).length;
  console.log(`\n${R.length - f} passed, ${f} failed`);
  process.exit(f ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
