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
  /* pin the scene at a second AND wait for a frame to actually render it:
     __soEndT only moves when a frame runs, and this browser can go a
     second or more without one */
  const holdAt = async (secs) => {
    await page.evaluate(v => window.__soEndHold(v), secs);
    for (let i = 0; i < 24; i++) {
      const t = await page.evaluate(() => window.__soEndT());
      if (Math.abs(t - secs) < 0.001) return t;
      await page.waitForTimeout(120);
    }
    return page.evaluate(() => window.__soEndT());
  };
  const playing = () => page.evaluate(() => {
    const e = document.querySelector('.so-end');
    if (!e) return null;
    const line = document.querySelector('.so-end-sign');
    return { playing: e.classList.contains('playing'),
             signOpacity: line ? +getComputedStyle(line).opacity : null };
  });

  /* ---- the scene, played straight through ------------------------- */
  /* THE SCENE'S CLOCK IS PINNED, NOT WAITED ON. This browser's frame clock
     jumps whole seconds at a time, so "open it and look a moment later"
     lands anywhere between the first frame and three seconds in. The scene
     is held at the second being tested instead. */
  await page.evaluate(() => window.__soShowEnding());
  await page.waitForSelector('#so-end-art canvas', { timeout: 5000 });
  const heldAt = await holdAt(0.12);
  ok('the scene can be held at its opening second', Math.abs(heldAt - 0.12) < 0.01, `t=${heldAt}`);
  const t0 = await look(), s0 = await playing();
  ok('the scene starts on its own frame', !!t0 && t0.w === 240, t0 && `${t0.w}x${t0.h}`);
  ok('it opens in the dark', t0.bright < 40, `brightness=${t0.bright.toFixed(1)}`);
  ok('the reading is held back while it plays', s0.playing === true && s0.signOpacity === 0,
     `playing=${s0.playing} sign opacity=${s0.signOpacity}`);
  await page.evaluate(() => window.__soEndHold(null));   /* let it run on */

  /* THE SCENE'S OWN CLOCK, not the harness's. A software-rendered headless
     browser stalls its frame clock for a second at a time and then catches
     up, so "wait 1.6s and look" is a coin toss. Everything below waits for
     the scene to reach a beat and then asserts. */
  const at = async (secs, cap = 40) => {
    for (let i = 0; i < cap; i++) {
      if (await page.evaluate(() => window.__soEndT()) >= secs) return true;
      await page.waitForTimeout(250);
    }
    return false;
  };
  ok('the scene keeps its own clock', await at(1.6), 'reached 1.6s');
  const t1 = await look();
  ok('she walks in out of it', t1.sig !== t0.sig && t1.bright > t0.bright,
     `brightness ${t0.bright.toFixed(1)} -> ${t1.bright.toFixed(1)}`);
  /* still short of the meeting: the card must not have arrived */
  const mid = await page.evaluate(() => ({ t: window.__soEndT(),
    playing: document.querySelector('.so-end').classList.contains('playing') }));
  let walking = false;
  for (let i = 0; i < 16 && !walking; i++) { await page.waitForTimeout(200); walking = (await look()).sig !== t1.sig; }
  ok('and she is still moving a moment later', walking);
  ok('the text has not arrived before they meet', mid.t >= 7.4 || mid.playing === true,
     `t=${mid.t.toFixed(1)} playing=${mid.playing}`);

  ok('the scene reaches the meeting', await at(7.6), 'reached 7.6s');
  await page.waitForTimeout(400);
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
  let skGone = false;
  for (let i = 0; i < 16 && !skGone; i++) { await page.waitForTimeout(250); skGone = (await playing()).playing === false; }
  ok('a tap gets her straight to them', skGone === true);
  /* and wait for a frame to actually render the skipped-to moment before
     judging how bright it is */
  let skl = await look();
  for (let i = 0; i < 20 && skl.bright < 40; i++) { await page.waitForTimeout(150); skl = await look(); }
  ok('and it skips forward rather than cutting to black', skl.bright > 40,
     `brightness=${skl.bright.toFixed(1)}`);

  /* ---- and the keyboard half of "anywhere, any key" -----------------
     Decided on the scene's own clock rather than on "did the card turn up
     within four seconds": the card turns up by ITSELF at 7.4s, and this
     browser's frame clock jumps whole seconds, so a four-second poll can
     watch the scene finish and call it a keypress. The scene is held at
     half a second, the key is pressed with focus outside the overlay, and
     the clock has to be at the end immediately afterwards. */
  /* held mid-play so the press cannot be confused with the scene simply
     arriving at the meeting by itself */
  await page.evaluate(() => window.__soShowEnding());
  await page.waitForSelector('#so-end-art canvas', { timeout: 5000 });
  await holdAt(0.5);
  await page.evaluate(() => { if (document.activeElement) document.activeElement.blur(); });
  const beforeKey = await page.evaluate(() => ({ t: window.__soEndT(),
    live: document.querySelector('.so-end').classList.contains('playing'),
    focus: (document.activeElement && document.activeElement.id) || document.activeElement.tagName }));
  ok('the scene is held mid-play for the keyboard test',
     beforeKey.live === true && Math.abs(beforeKey.t - 0.5) < 0.01, JSON.stringify(beforeKey));
  /* dispatched ON THE DOCUMENT rather than through the browser's focus
     routing — which is the whole point of the change being tested. A
     listener parked on the overlay div cannot see this; one on the
     document can. (Playwright's own key delivery depends on what holds
     focus, which is exactly the thing that used to decide whether the
     keyboard worked at all.) */
  await page.evaluate(() => document.dispatchEvent(
    new KeyboardEvent('keydown', { key: ' ', code: 'Space', bubbles: true })));
  await page.waitForTimeout(400);
  const afterKey = await page.evaluate(() => window.__soEndT());
  ok('with focus outside the overlay, a key still ends it',
     afterKey >= 9, `t ${beforeKey.t.toFixed(2)} -> ${afterKey.toFixed(2)}, focus=${beforeKey.focus}, ` +
     `skippable=${await page.evaluate(() => window.__soEndCan())}, live=${await page.evaluate(() => window.__soEndLive())}`);
  let keyGone = false;
  for (let i = 0; i < 12 && !keyGone; i++) { await page.waitForTimeout(200); keyGone = (await playing()).playing === false; }
  ok('and the card comes with it', keyGone === true);

  /* ---- one scene at a time -----------------------------------------
     showEnding is reachable over and over: play again, title screen and
     back, off to the Death scene and back. Every one of those used to
     start another animation loop and stop none of them, so they all ran
     for the rest of the session, painting canvases that had been thrown
     away and fighting over the scene's own clock. */
  for (let i = 0; i < 4; i++) {
    await page.evaluate(() => window.__soShowEnding());
    await page.waitForTimeout(120);
  }
  ok('four openings leave one scene running, not four',
     await page.evaluate(() => window.__soEndLive()) === 1,
     `${await page.evaluate(() => window.__soEndLive())} live`);
  const lone = await holdAt(0.4);
  ok('and the clock is the live one\'s, not whatever ran last',
     Math.abs(lone - 0.4) < 0.01, `t=${lone}`);
  await page.evaluate(() => window.__soEndHold(null));

  /* ---- coming back to the card is not the scene again -------------- */
  await page.evaluate(() => window.__soShowEnding(true));
  await page.waitForTimeout(350);
  /* the same stall the other way round: the canvas exists before the
     first frame has been painted into it, and an unpainted canvas is
     black — which is not the same finding as "the scene is black" */
  let agl = await look();
  for (let i = 0; i < 20 && agl.bright < 1; i++) { await page.waitForTimeout(150); agl = await look(); }
  const ag = await playing();
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
