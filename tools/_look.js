/* WHERE IS SHE LOOKING, AND WHY.
   Moves a real mouse to the places a hand goes and reads the yaw off
   the camera: straight ahead is 0, the west door is about -1.0, the
   east door about +1.0. */
const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox','--no-proxy-server','--use-gl=swiftshader','--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 900, height: 560 } });
  p.on('pageerror', (e) => console.log('PAGEERROR', e.message));
  await p.route('**/*', (r) => { const u = r.request().url();
    if (u.indexOf('book-scene.js') >= 0) return r.abort();
    return u.startsWith('http://127.0.0.1') ? r.continue() : r.abort(); });
  await p.goto('http://127.0.0.1:8899/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.evaluate(() => { localStorage.setItem('ns_seenintro','1'); localStorage.setItem('ns_terms','1');
    localStorage.setItem('ns_notutor','1'); showScreen('nightshift');
    return loadChapter('nightshift').then(() => OuissysNightShift.start()); });
  await p.waitForFunction(() => window.OuissysNightShift && OuissysNightShift.__night, { timeout: 20000, polling: 200 });
  await p.evaluate(() => OuissysNightShift.__night.begin(3));
  await p.evaluate(() => OuissysNightShift.__night.midEnd && OuissysNightShift.__night.midEnd());
  const yaw = async () => {
    await new Promise((r) => setTimeout(r, 2000));
    return p.evaluate(() => {
      const v = OuissysNightShift.__three().view, d = new window.THREE.Vector3();
      v.getWorldDirection(d);
      const N = OuissysNightShift.__night, C = N.cast();
      const at = Object.keys(C).filter((k) => C[k].atDoor && C[k].room === 'office');
      const tk = N.talkState ? N.talkState() : null;
      return +Math.atan2(d.x, -d.z).toFixed(2) + '   talk=' + JSON.stringify(tk)
             + ' atDoor=' + at.join(',');
    });
  };
  const box = async (sel) => p.evaluate((s) => {
    const el = document.querySelector(s); if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
  }, sel);
  const mid = { x: 450, y: 240 };
  await p.mouse.move(mid.x, mid.y);
  console.log('mouse in the middle of the shop      yaw', await yaw());
  const L = await box('#ns-pad [data-k="left"]');
  const R = await box('#ns-pad [data-k="right"]');
  const M = await box('#ns-pad [data-k="monitor"]');
  console.log('pad buttons at', JSON.stringify({ L, R, M }));
  if (L) { await p.mouse.move(L.x, L.y); console.log('hand on the LEFT DOOR button        yaw', await yaw()); }
  if (R) { await p.mouse.move(R.x, R.y); console.log('hand on the RIGHT DOOR button       yaw', await yaw()); }
  if (M) { await p.mouse.move(M.x, M.y); console.log('hand on the CAMS button             yaw', await yaw()); }
  await p.mouse.move(mid.x, mid.y);
  console.log('back to the middle                  yaw', await yaw());
  /* and what a player would actually do: press the left door, then
     something arrives at the right one and she has not moved her hand */
  if (L) { await p.mouse.move(L.x, L.y); await p.mouse.click(L.x, L.y); }
  console.log('after pressing LEFT, hand still there yaw', await yaw());
  console.log('   doors now', JSON.stringify(await p.evaluate(() => OuissysNightShift.__night.state().doors)));
  await b.close();
})();
