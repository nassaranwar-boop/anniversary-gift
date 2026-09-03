/* Does she actually move when a person presses a key, or taps the pad?

   Everything else in this suite drives the world with __apPump, which steps
   the loop by hand and therefore proves nothing about whether an input ever
   reaches it. This presses real keys and touches real buttons at the page
   and watches the real requestAnimationFrame loop. */
const { chromium } = require('playwright-core');
let pass = 0, fail = 0;
const ok = (n, c, x) => { if (c) { pass++; console.log('  ok   ' + n); }
                          else { fail++; console.log('  FAIL ' + n + (x ? '  ' + JSON.stringify(x) : '')); } };

async function run(label, viewport, touch) {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox','--no-proxy-server','--use-gl=swiftshader',
           '--enable-unsafe-swiftshader','--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport, isMobile: touch, hasTouch: touch });
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.route('**', r => (r.request().url().startsWith('http://localhost') ? r.continue() : r.abort()));
  await p.goto('http://localhost:8899/index.html', { waitUntil: 'domcontentloaded' });
  await p.evaluate(() => { try { localStorage.clear(); } catch (e) {} showScreen('hub'); startHub(); });
  await p.waitForTimeout(200);
  await p.evaluate(() => document.getElementById('hub-card-apoc').click());
  await p.waitForSelector('.ap-card-go', { timeout: 40000 });
  await p.evaluate(() => document.querySelector('.ap-card-go').click());   // BEGIN
  await p.waitForTimeout(200);
  await p.evaluate(() => document.querySelector('.ap-card-go').click());   // GO -> level card
  await p.waitForTimeout(200);
  await p.evaluate(() => document.querySelector('.ap-card-go').click());   // GO -> play
  await p.waitForTimeout(1200);
  /* SwiftShader paints about one frame a second in here, so anything
     measured against the wall clock measures the container rather than the
     game. Drop the render scale, hold every input for seconds rather than
     milliseconds, and measure against the game's own clock: how far did she
     get per second of game time. */
  await p.evaluate(() => window.__apQuality(2));
  await p.waitForTimeout(800);

  const where = () => p.evaluate(() => {
    const s = window.__apState();
    return { x: s.player.x, z: s.player.z, state: s.state,
             t: window.Apocalypse.game.time };
  });

  // put her somewhere with room, and let the real loop run
  await p.evaluate(() => window.__apTeleport(8, 8));
  await p.waitForTimeout(400);
  /* The clock starts when the key goes down, not before. Sampling earlier
     folds the tap that precedes the hold, and the idle between them, into
     an average that is then compared against a walking speed — which makes
     this a test of how fast the renderer is rather than of whether the
     input arrived. */
  let a = await where(), held = null;
  if (!touch) {
    await p.keyboard.down('ArrowRight');
    await p.waitForTimeout(250);
    a = await where();
    await p.waitForTimeout(5750);
    held = await where();                         // sample while it is still down
    await p.keyboard.up('ArrowRight');
  } else {
    const btn = await p.$('.ap-key-right');
    const box = btn && await btn.boundingBox();
    if (box) {
      await p.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
      // a tap is a press and a release; hold it properly instead
      await p.evaluate(() => {
        const el = document.querySelector('.ap-key-right');
        el.dispatchEvent(new TouchEvent('touchstart', { bubbles: true, cancelable: true }));
      });
      await p.waitForTimeout(250);
      a = await where();
      await p.waitForTimeout(5750);
      held = await where();                       // sample while it is still down
      await p.evaluate(() => {
        const el = document.querySelector('.ap-key-right');
        el.dispatchEvent(new TouchEvent('touchend', { bubbles: true, cancelable: true }));
      });
    } else ok(label + ': the pad is on the page', false);
  }
  /* Measure her while the key is down. Sampling after the release folds
     the slowing-down into the average, and how much of the window that is
     depends on the frame rate — which makes this a test of the renderer
     rather than of whether the input arrived. */
  const c = held || await where();
  await p.waitForTimeout(1200);
  const gdt = c.t - a.t, gdx = c.x - a.x, speed = gdt > 0 ? gdx / gdt : 0;
  ok(label + ': she moves when a person asks her to, at a walk',
     gdt > 0.05 && speed > 3.5 && speed < 8.5, { gdx, gdt, speed });

  // she stops when the input stops
  await p.waitForTimeout(2500);
  const d = await where();
  ok(label + ': and stops when they let go', Math.abs(d.x - c.x) < 0.8, { c: c.x, d: d.x });

  // the loop is really turning over on its own
  const t1 = await p.evaluate(() => window.Apocalypse.game.time);
  await p.waitForTimeout(4000);
  const t2 = await p.evaluate(() => window.Apocalypse.game.time);
  ok(label + ': the render loop is turning over on its own', t2 - t1 > 0.02, { t1, t2 });

  if (!touch) {
    await p.keyboard.press('Escape');
    await p.waitForTimeout(250);
    const paused = await p.evaluate(() => window.__apState().state);
    ok(label + ': escape pauses', paused === 'paused', { paused });
    await p.evaluate(() => document.querySelector('.ap-card-go').click());
    await p.waitForTimeout(250);
    ok(label + ': and lets go again', (await p.evaluate(() => window.__apState().state)) === 'play');
  } else {
    await p.evaluate(() => document.getElementById('ap-pause-btn').click());
    await p.waitForTimeout(250);
    ok(label + ': the pause button pauses',
       (await p.evaluate(() => window.__apState().state)) === 'paused');
    await p.evaluate(() => document.querySelector('.ap-card-go').click());
    await p.waitForTimeout(250);
  }

  // nothing spills sideways at this size
  const overflow = await p.evaluate(() =>
    Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth));
  ok(label + ': no horizontal scroll', overflow === 0, { overflow });

  await p.evaluate(() => Apocalypse.stop());
  await p.waitForTimeout(300);
  ok(label + ': stop() leaves no page errors', errs.length === 0, errs.slice(0, 3));

  /* leaving and coming back is a thing people do, and a canvas only ever
     hands out one WebGL context */
  await p.evaluate(() => { showScreen('hub'); startHub(); });
  await p.waitForTimeout(200);
  await p.evaluate(() => document.getElementById('hub-card-apoc').click());
  await p.waitForSelector('.ap-card-go', { timeout: 20000 }).catch(() => {});
  await p.evaluate(() => document.querySelector('.ap-card-go').click());
  await p.waitForTimeout(200);
  await p.evaluate(() => document.querySelector('.ap-card-go').click());
  await p.waitForTimeout(200);
  await p.evaluate(() => document.querySelector('.ap-card-go').click());
  await p.waitForTimeout(1400);
  /* the drawing buffer is not preserved, so the read has to happen in the
     same turn as the paint that filled it */
  const again = await p.evaluate(() => {
    window.__apLoop(false);
    window.__apQuality(2);
    for (let i = 0; i < 20; i++) window.__apPump(1 / 60);
    window.__apPaint();
    const cv = document.getElementById('ap-canvas');
    const gl = cv.getContext('webgl2') || cv.getContext('webgl');
    if (!gl || gl.isContextLost()) return { painted: -1 };
    const w = gl.drawingBufferWidth, h = gl.drawingBufferHeight;
    const px = new Uint8Array(w * h * 4);
    gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);
    let painted = 0;
    for (let i = 0; i < px.length; i += 4000) if (px[i] + px[i+1] + px[i+2] > 12) painted++;
    return { painted: painted, state: window.__apState() && window.__apState().state };
  });
  ok(label + ': it opens again after being left', again.painted > 3, again);
  ok(label + ': and still no page errors', errs.length === 0, errs.slice(0, 3));
  await b.close();
}

(async () => {
  await run('desktop', { width: 1280, height: 800 }, false);
  await run('iphone',  { width: 390, height: 844 }, true);
  console.log('');
  console.log(`${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('FATAL', e); process.exit(1); });
