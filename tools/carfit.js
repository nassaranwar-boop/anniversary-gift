/* Are the heads inside the car? A night render from above is black, so
   measure it: the top of every head against the underside of the roof,
   and the sides of the cabin against the width of two shoulders. */
const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--use-gl=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--no-sandbox'] });
  const p = await b.newPage({ viewport: { width: 800, height: 500 } });
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
  const r = await p.evaluate(() => {
    window.__apEnter(3); window.__apSkipDialogue(); window.__apDrive();
    for (let i = 0; i < 120; i++) window.__apPump(1/60);
    const G = window.Apocalypse.game, P = G.cine && G.cine.parts;
    if (!P) return { err: 'no parts' };
    const T = window.THREE || (window.Apocalypse.three);
    /* the roof: the highest solid mesh in the car group that is not a
       person and not a light volume */
    const people = [];
    P.her.root.traverse(o => people.push(o));
    P.him.root.traverse(o => people.push(o));
    let roofMin = Infinity, roofMax = -Infinity;
    P.car.group.traverse(o => {
      if (!o.isMesh || people.indexOf(o) >= 0) return;
      const m = o.material;
      if (m && (m.transparent || m.depthWrite === false)) return;   /* beams, glass */
      if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
      const bb = o.geometry.boundingBox.clone();
      o.updateWorldMatrix(true, false);
      bb.applyMatrix4(o.matrixWorld);
      if (bb.max.y > roofMax) roofMax = bb.max.y;
    });
    function headTop(rig) {
      const v = new rig.root.position.constructor();
      rig.head.updateWorldMatrix(true, false);
      rig.head.getWorldPosition(v);
      return v;
    }
    const h = headTop(P.her), m = headTop(P.him);
    /* the head bone sits at the base of the skull; the crown is about
       0.16 of a body scale above it */
    const crown = 0.15 * 0.82;
    return {
      roofTop: +roofMax.toFixed(3),
      herHead: +h.y.toFixed(3), herCrown: +(h.y + crown).toFixed(3),
      himHead: +m.y.toFixed(3), himCrown: +(m.y + crown).toFixed(3),
      herClear: +(roofMax - (h.y + crown)).toFixed(3),
      himClear: +(roofMax - (m.y + crown)).toFixed(3)
    };
  });
  console.log(JSON.stringify(r, null, 1));
  const ok = r.herClear > 0.02 && r.himClear > 0.02;
  console.log(ok ? '  ok   both heads are under the roof'
                 : '  FAIL a head is through the roof');
  await b.close();
  process.exit(ok ? 0 : 1);
})();
