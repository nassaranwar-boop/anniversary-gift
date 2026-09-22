/* THE TEAM PHOTOGRAPH.
 *
 * The match camera is a hundred units out, which is exactly the distance
 * at which a badly built head still looks fine. So this lines every
 * character in the game up on the halfway line and photographs them from
 * six feet, front and back, which is where a cat that is not a cat and a
 * bear that is a brown ball show up.
 */
const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--use-gl=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist',
           '--no-sandbox','--no-proxy-server','--autoplay-policy=no-user-gesture-required'] });
  const p = await b.newPage({ viewport: { width: 1100, height: 420 }, deviceScaleFactor: 1 });
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.route('**/*', r => r.request().url().startsWith('http://127.0.0.1') ? r.continue() : r.abort());
  await p.goto('http://127.0.0.1:8899/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForTimeout(1000);
  await p.evaluate(() => window.loadChapter && window.loadChapter('cup'));
  await p.waitForFunction(() => !!window.OuissyCup, { timeout: 30000 });
  await p.evaluate(() => { showScreen('cup'); OuissyCup.__cup.soundOff(); OuissyCup.start(); });
  await p.waitForFunction(() => OuissyCup.__cup.state() !== null, { timeout: 40000 });
  await p.waitForTimeout(600);
  /* stop the match loop, or the next frame puts the match camera back
     and paints the round card over the top of the photograph */
  await p.evaluate(() => { OuissyCup.stop(); });
  await p.waitForTimeout(200);

  /* Rebuild the scene as a line-up: one of everybody, in a kit, facing
     the camera, with the match's own lights and materials. */
  const shoot = (turn, from, count) => p.evaluate(({ turn, from, count }) => {
    const t = OuissyCup.__cup.three();
    const THREE = t.THREE, scene = t.scene, cam = t.camera;
    if (!window.__parade) {
      window.__parade = new THREE.Group();
      scene.add(window.__parade);
    }
    window.__parade.clear();
    OuissyCup.__cup.matchVisible(false);
    const all = Object.keys(OuissyCup.__cup.cast());
    const cast = all.slice(from, from + count);
    const kits = ['mar', 'ger', 'bra', 'anw'];
    cast.forEach((face, i) => {
      const rig = OuissyCup.__cup.rig({ face: face, teamId: kits[i % 4],
                                        gk: face === 'soldier' || face === 'jester' });
      rig.group.position.set((i - (cast.length - 1) / 2) * 14, 0, 0);
      rig.group.rotation.y = turn;
      window.__parade.add(rig.group);
    });
    cam.position.set(0, 13, 52);
    cam.lookAt(0, 8, 0);
    t.renderer.render(scene, cam);
    return cast;
  }, { turn, from, count });

  const a = await shoot(0, 0, 6);
  await p.screenshot({ path: '/tmp/cup-cast-a.png' });
  const c = await shoot(0, 6, 6);
  await p.screenshot({ path: '/tmp/cup-cast-b.png' });
  await shoot(Math.PI, 0, 6);
  await p.screenshot({ path: '/tmp/cup-cast-back.png' });
  console.log('cast:', a.join(' '), '|', c.join(' '));
  console.log(errs.length ? 'ERRORS: ' + errs.slice(0, 4).join(' | ') : 'no page errors');
  await b.close();
})();
