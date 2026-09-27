/* WHAT IS ACTUALLY IN THE MIDDLE OF THE FRAME, AND WHERE IS THE PERSON
   SPEAKING. Three numbers per shot: the speaker in normalised device
   coordinates (0,0 is the middle of the frame, anything outside -1..1
   is off it), and what a ray down the middle of the lens hits first. */
const { chromium } = require('playwright-core');
const WANT = (process.argv[2] || '36,37,50,53').split(',').map(Number);
const WHO = (process.argv[3] || 'chime,cogsworth,jax').split(',');
(async () => {
  const b = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox', '--no-proxy-server', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 640, height: 400 } });
  p.on('pageerror', (e) => console.log('PAGEERROR', e.message));
  await p.route('**/*', (r) => {
    const u = r.request().url();
    if (u.indexOf('book-scene.js') >= 0) return r.abort();
    return u.startsWith('http://127.0.0.1') ? r.continue() : r.abort(); });
  await p.goto('http://127.0.0.1:8899/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.evaluate(() => { localStorage.setItem('ns_seenintro', '1'); showScreen('nightshift');
    return loadChapter('nightshift').then(() => OuissysNightShift.start()); });
  await p.waitForFunction(() => window.OuissysNightShift && OuissysNightShift.__night, { timeout: 20000, polling: 200 });
  await p.evaluate(() => OuissysNightShift.__night.finale());
  for (const target of WANT.slice().sort((a, b) => a - b)) {
    /* walk the film's clock to the top of the shot in one round trip,
       then hand-crank the dozen frames that are actually looked at */
    const at = await p.evaluate((t) => OuissysNightShift.__night.filmSeek(t), target);
    if (at === false) break;
    const FR = Number(process.env.FRAMES || 12);
    for (let f = 0; f < FR; f++) await p.evaluate(() => OuissysNightShift.__night.filmFrame(0.05, false));
    {
      const i = target;
      const row = await p.evaluate((who) => {
        const N = OuissysNightShift.__night, T = window.THREE, C = N.cast();
        const TH = OuissysNightShift.__three(), v = TH.view, scene = TH.scene;
        const out = { cam: v.position.toArray().map((x) => +x.toFixed(2)), who: {} };
        const d = new T.Vector3(); v.getWorldDirection(d);
        out.dir = d.toArray().map((x) => +x.toFixed(2));
        for (const id of who) {
          const c = C[id];
          if (!c) continue;
          const e = c.group.position.clone(); e.y += (c.group.userData && c.group.userData.eyeY) || 1;
          const q = e.clone().project(v);
          out.who[id] = { vis: c.group.visible ? 1 : 0,
                          ndc: [+q.x.toFixed(2), +q.y.toFixed(2), +q.z.toFixed(2)],
                          away: +v.position.distanceTo(e).toFixed(2) };
        }
        /* and what the middle of the lens is looking at */
        const rc = new T.Raycaster(); rc.far = 40;
        rc.set(v.position, d);
        const hits = rc.intersectObject(scene, true).filter((h) => h.object.visible);
        if (hits.length) {
          const h = hits[0];
          const bb = new T.Box3().setFromObject(h.object), sz = new T.Vector3();
          bb.getSize(sz);
          /* which top-level thing in the room it belongs to, so it can
             be found in the source by the coordinates it was placed at */
          const R = N.rooms(), rec = R[N.finaleState().room];
          let top = h.object;
          while (top.parent && rec && top.parent !== rec.group && top.parent !== scene) top = top.parent;
          out.hit = { at: +h.distance.toFixed(2),
                      p: h.object.getWorldPosition(new T.Vector3()).toArray().map((x) => +x.toFixed(2)),
                      size: sz.toArray().map((x) => +x.toFixed(2)),
                      placed: top.position.toArray().map((x) => +x.toFixed(2)),
                      kids: top.children.length,
                      wreck: (N.wreckAt() || []).filter((w) => w[0] === top.id)
                               .map((w) => [w[1], w[2], w[3]])[0] || 0,
                      col: (h.object.material && h.object.material.color)
                             ? '#' + h.object.material.color.getHexString() : '?' };
        }
        out.eyes = N.finaleState().eyes || null;
        out.boss = N.bossWhere();
        return out;
      }, WHO);
      console.log(String(i).padStart(2), JSON.stringify(row));
    }
  }
  await b.close();
})();
