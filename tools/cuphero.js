/* THE HERO SHOT.
 *
 * One character, in engine, on the pitch, under the new camera — which
 * is the only place the sprite work can actually be judged. A contact
 * sheet says whether the drawing is good; this says whether it is good
 * AT THE SIZE AND DISTANCE IT WILL BE SEEN, which is a different
 * question and the one that matters.
 *
 *   node tools/cuphero.js
 */
const { chromium } = require('playwright-core');

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist',
           '--no-sandbox', '--no-proxy-server'] });
  const p = await b.newPage({ viewport: { width: 1060, height: 660 }, deviceScaleFactor: 1 });
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.route('**/*', r => r.request().url().startsWith('http://127.0.0.1') ? r.continue() : r.abort());
  await p.goto('http://127.0.0.1:8899/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForTimeout(900);
  await p.evaluate(() => window.loadChapter && window.loadChapter('cup'));
  await p.waitForFunction(() => !!window.OuissyCup, { timeout: 30000 });
  await p.evaluate(() => { try { localStorage.clear(); } catch (e) {}
                           showScreen('cup'); OuissyCup.__cup.soundOff();
                           OuissyCup.__cup.shadows(true); OuissyCup.start(); });
  await p.waitForFunction(() => OuissyCup.__cup.state() !== null, { timeout: 40000 });
  await p.evaluate(() => OuissyCup.stop());

  /* put her in the middle of the park with the ball, running, and drive
     the simulation by hand so the frame is a chosen one rather than
     whatever the clock happened to land on */
  const info = await p.evaluate(() => {
    const C = OuissyCup.__cup;
    C.reset(0);
    const g = C.geometry();
    const me = C.players().findIndex(q => q.name === 'OUISSY');
    C.place(me, g.pitch.cx, g.pitch.cy + 30);
    C.control(me);
    /* A few steps with the stick held so she is mid-stride — driven
       towards the camera and across, which is the angle a hero shot
       wants: three-quarter front, not the back of a head.

       Control is re-asserted afterwards because pickControlled runs on
       every step and hands the stick to whoever is nearest the ball, so
       by the time the frame was drawn the first version of this had
       framed a completely different player. */
    for (let i = 0; i < 22; i++) C.step(1, 0.66, 0.74, false);
    C.control(me);
    C.step(1, 0.66, 0.74, false);
    C.render();
    return { players: C.players().length, me: C.me(), geom: g.cam };
  });
  console.log('driving: ' + JSON.stringify(info.me));
  await p.waitForTimeout(300);
  await p.screenshot({ path: '/tmp/cup-hero.png' });

  /* and a close crop of her, so the sprite can be seen at 1:1.

     This used to reach into the scene graph, build a THREE.Vector3 at
     her feet and project it through the camera. There is no scene graph
     and no camera object any more, so the renderer answers the same
     question directly: where on the screen is this place on the pitch? */
  const box = await p.evaluate(() => {
    const C = OuissyCup.__cup;
    const V = C.view2d(), me = C.me();
    const el = document.getElementById('cup-canvas').getBoundingClientRect();
    const feet = V.project(me.x, me.y);
    /* the renderer draws its virtual screen centred in the canvas at a
       whole-number scale, so undoing that is the same two numbers */
    const s = Math.max(1, Math.floor(Math.min(el.width / V.vw, el.height / V.vh)));
    const ox = el.left + (el.width - V.vw * s) / 2;
    const oy = el.top + (el.height - V.vh * s) / 2;
    return { x: ox + feet.x * s, yFeet: oy + feet.y * s,
             yHead: oy + (feet.y - 48) * s, scale: s };
  });
  console.log(errs.length ? 'ERRORS: ' + errs.slice(0, 3).join(' | ') : 'no page errors');
  console.log('  -> /tmp/cup-hero.png and /tmp/cup-hero-crop.png');
  await b.close();
})();
