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
  await p.click('#hub-card-apoc');
  await p.waitForSelector('.ap-card-go', { timeout: 40000 });
  await p.evaluate(() => document.querySelector('.ap-card-go').click());   // BEGIN
  await p.waitForTimeout(200);
  await p.evaluate(() => document.querySelector('.ap-card-go').click());   // GO -> level card
  await p.waitForTimeout(200);
  await p.evaluate(() => document.querySelector('.ap-card-go').click());   // GO -> play
  await p.waitForTimeout(1200);

  const where = () => p.evaluate(() => {
    const s = window.__apState();
    return { x: s.player.x, z: s.player.z, state: s.state };
  });

  // put her somewhere with room, and let the real loop run
  await p.evaluate(() => window.__apTeleport(8, 8));
  await p.waitForTimeout(400);
  const a = await where();

  if (!touch) {
    await p.keyboard.down('ArrowRight');
    await p.waitForTimeout(900);
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
      await p.waitForTimeout(900);
      await p.evaluate(() => {
        const el = document.querySelector('.ap-key-right');
        el.dispatchEvent(new TouchEvent('touchend', { bubbles: true, cancelable: true }));
      });
    } else ok(label + ': the pad is on the page', false);
  }
  await p.waitForTimeout(200);
  const c = await where();
  ok(label + ': she moves when a person asks her to', c.x - a.x > 2, { from: a.x, to: c.x });

  // she stops when the input stops
  await p.waitForTimeout(500);
  const d = await where();
  ok(label + ': and stops when they let go', Math.abs(d.x - c.x) < 0.6, { c: c.x, d: d.x });

  // the loop is really running: the clock moves on its own
  const t1 = await p.evaluate(() => window.Apocalypse.game.time);
  await p.waitForTimeout(500);
  const t2 = await p.evaluate(() => window.Apocalypse.game.time);
  ok(label + ': the render loop is running', t2 - t1 > 0.2, { t1, t2 });

  if (!touch) {
    await p.keyboard.press('Escape');
    await p.waitForTimeout(250);
    const paused = await p.evaluate(() => window.__apState().state);
    ok(label + ': escape pauses', paused === 'paused', { paused });
    await p.evaluate(() => document.querySelector('.ap-card-go').click());
    await p.waitForTimeout(250);
    ok(label + ': and lets go again', (await p.evaluate(() => window.__apState().state)) === 'play');
  } else {
    await p.click('#ap-pause-btn');
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
  await p.click('#hub-card-apoc');
  await p.waitForSelector('.ap-card-go', { timeout: 20000 }).catch(() => {});
  await p.evaluate(() => document.querySelector('.ap-card-go').click());
  await p.waitForTimeout(200);
  await p.evaluate(() => document.querySelector('.ap-card-go').click());
  await p.waitForTimeout(200);
  await p.evaluate(() => document.querySelector('.ap-card-go').click());
  await p.waitForTimeout(1400);
  const again = await p.evaluate(() => {
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
