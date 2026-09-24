/* EVERY POSE, PHOTOGRAPHED.
 *
 * The match only shows you an animation when the match feels like it,
 * which is no way to find out that the keeper's dive puts his head
 * through the grass. This holds one player in each pose in turn and
 * takes a picture of it from a few feet away.
 */
const { chromium } = require('playwright-core');
const POSES = ['idle', 'run', 'kick', 'slide', 'ready', 'dive',
               'armsUp', 'knee', 'planeRun', 'heart', 'cheer', 'dejected'];
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox','--no-proxy-server','--autoplay-policy=no-user-gesture-required'] });
  const p = await b.newPage({ viewport: { width: 1100, height: 380 }, deviceScaleFactor: 1 });
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.route('**/*', r => r.request().url().startsWith('http://127.0.0.1') ? r.continue() : r.abort());
  await p.goto('http://127.0.0.1:8899/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForTimeout(1000);
  await p.evaluate(() => window.loadChapter && window.loadChapter('cup'));
  await p.waitForFunction(() => !!window.OuissyCup, { timeout: 30000 });
  await p.evaluate(() => { showScreen('cup'); OuissyCup.__cup.soundOff(); OuissyCup.start(); });
  await p.waitForFunction(() => OuissyCup.__cup.state() !== null, { timeout: 40000 });
  await p.waitForTimeout(500);
  await p.evaluate(() => { OuissyCup.stop(); });

  /* six of them in a row, each held in a different pose, lit and posed
     by the game's own code rather than by the harness */
  const shoot = (from, count) => p.evaluate(({ from, count, POSES }) => {
    const t = OuissyCup.__cup.three();
    const THREE = t.THREE, scene = t.scene, cam = t.camera;
    OuissyCup.__cup.matchVisible(false);
    if (window.__row) scene.remove(window.__row);
    window.__row = new THREE.Group();
    scene.add(window.__row);
    const use = POSES.slice(from, from + count);
    use.forEach((state, i) => {
      const rig = OuissyCup.__cup.rig({ face: state === 'dive' || state === 'ready' ? 'soldier' : 'ouissy',
                                        teamId: 'mar',
                                        gk: state === 'dive' || state === 'ready' });
      const g = rig.group;
      g.position.set((i - (use.length - 1) / 2) * 15, 0, 0);
      g.rotation.y = Math.PI;
      window.__row.add(g);
      /* pose it with the game's own poser, on a fake player */
      const fake = { x: 160, y: 231, vx: 0, vy: 0, dir: Math.PI / 2, team: 0,
                     gk: g.userData.gk, tackleT: 0, diveDir: 1,
                     anim: { state: state, t: 0.42, dur: 99, once: true, seed: 0.3 } };
      OuissyCup.__cup.poseOnly(fake, rig, 0.016);
      g.position.set((i - (use.length - 1) / 2) * 15, g.position.y, 0);
      g.rotation.y = Math.PI;
    });
    cam.position.set(0, 12, 58);
    cam.lookAt(0, 8, 0);
    t.renderer.render(scene, cam);
    return use;
  }, { from, count, POSES });

  console.log('row 1:', (await shoot(0, 6)).join(' '));
  await p.screenshot({ path: '/tmp/cup-pose-a.png' });
  console.log('row 2:', (await shoot(6, 6)).join(' '));
  await p.screenshot({ path: '/tmp/cup-pose-b.png' });
  console.log(errs.length ? 'ERRORS: ' + errs.slice(0, 4).join(' | ') : 'no page errors');
  await b.close();
})();
