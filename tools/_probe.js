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
    window.__apEnter(3); window.__apSkipDialogue(); window.__apDrive();
    for (let i = 0; i < 200; i++) window.__apPump(1/60);
    const G = window.Apocalypse.game, out = [];
    G.cine.scene.children.filter(o => o.children.length >= 3).forEach(o => {
      const v = new (o.position.constructor)();
      o.getWorldPosition(v);
      out.push({ type: o.type, name: o.name || '', kids: o.children.length,
                 p: [+v.x.toFixed(2), +v.y.toFixed(2), +v.z.toFixed(2)] });
    });
    const c = G.cine.camera;
    return { cam: [+c.position.x.toFixed(2), +c.position.y.toFixed(2), +c.position.z.toFixed(2)], kids: out };
  }), null, 1));
  await b.close();
})();
