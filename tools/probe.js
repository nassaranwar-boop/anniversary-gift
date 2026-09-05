/* What is that thing on screen? Cast a ray through the pixel and ask. */
const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--use-gl=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--no-sandbox'] });
  const p = await b.newPage({ viewport: { width: 1000, height: 620 } });
  p.on('pageerror', e => console.log('PAGEERR', e.message));
  await p.route('**', r => (r.request().url().startsWith('http://localhost') ? r.continue() : r.abort()));
  await p.goto('http://localhost:8899/index.html', { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(400);
  await p.evaluate(() => {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById('screen-apoc').classList.add('active');
    window.Apocalypse.start();
  });
  await p.waitForFunction(() => !!window.__apEnter, { timeout: 40000 });
  await p.evaluate(() => { window.__apLoop(false); window.__apQuality(0); });
  console.log(JSON.stringify(await p.evaluate(() => {
    window.__apEnter(4); window.__apSkipDialogue(); window.__apRoof();
    for (let i = 0; i < 140; i++) window.__apPump(1/60);
    const G = window.Apocalypse.game, S = G.cine.scene, C = G.cine.camera;
    C.updateMatrixWorld(true); S.updateMatrixWorld(true);
    const rc = new THREE.Raycaster();
    const out = [];
    /* a grid of screen points across the middle band */
    for (const pt of [[0.03,-0.22],[0.0,-0.25],[-0.75,-0.15],[0.75,-0.15],[0,0.1]]) {
      rc.setFromCamera({ x: pt[0], y: pt[1] }, C);
      const hits = rc.intersectObjects(S.children, true).slice(0, 3).map(h => ({
        t: h.object.type,
        name: h.object.name || '',
        mat: h.object.material && h.object.material.type,
        col: h.object.material && h.object.material.color
             ? '#' + h.object.material.color.getHexString() : null,
        d: +h.distance.toFixed(1),
        p: [+h.point.x.toFixed(1), +h.point.y.toFixed(1), +h.point.z.toFixed(1)]
      }));
      out.push({ at: pt, hits });
    }
    return { cam: [+C.position.x.toFixed(2), +C.position.y.toFixed(2), +C.position.z.toFixed(2)], out };
  }), null, 1));
  await b.close();
})();
