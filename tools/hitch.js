/* Where the game stops for a beat. Times every level build and every
   cinematic start, on the main thread, the way a player feels them. */
const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--use-gl=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--no-sandbox']
  });
  const p = await b.newPage({ viewport: { width: 900, height: 560 } });
  p.on('console', m => { const t = m.text(); if (/^DRIVE|^CINE|^ENV|^LVL/.test(t)) console.log('    ' + t); });
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
  await p.evaluate(() => { window.__apLoop(false); window.__apQuality(1); });

  const time = async (label, code) => {
    const ms = await p.evaluate(c => {
      const t0 = performance.now(); (0, eval)(c); return performance.now() - t0;
    }, code);
    console.log(String(Math.round(ms)).padStart(6) + ' ms   ' + label);
    /* draw some frames: a player has been looking at this scene, so its
       textures and programs are already on the card. Timing a build in a
       harness that never paints measures the upload, not the build. */
    await p.evaluate(async () => {
      for (let i = 0; i < 24; i++) { window.__apPump(1/60); window.__apPaint(); }
    });
    return ms;
  };

  const info = async () => p.evaluate(() => window.__apGpu());
  console.log('--- building a level (the loading card covers this) ---');
  for (const [i, n] of [[0,'home'],[1,'streets'],[2,'hospital'],[3,'escape'],[4,'gates']]) {
    await time('enter ' + n, 'window.__apEnter(' + i + ')');
    console.log('           ' + JSON.stringify(await info()));
  }

  console.log('--- starting a cut (nothing covers these) ---');
  const clear = () => p.evaluate(() => { window.__apEndCine(); });
  await p.evaluate(() => window.__apEnter(3));
  await time('the drive', 'window.__apDrive()'); await clear();
  await p.evaluate(() => window.__apEnter(3));
  await time('the roadside', 'window.__apRoadside()');
  await time('the ride', 'window.__apRide()'); await clear();
  await time('the campsite', 'window.__apCampsite()');
  await time('the campfire', 'window.__apCampfire()'); await clear();
  await time('the sunrise', 'window.__apSunrise()'); await clear();
  await p.evaluate(() => window.__apEnter(4));
  await time('the roof', 'window.__apRoof()'); await clear();

  console.log('--- the longest single frame in a minute of play, per level ---');
  for (const [i, n] of [[1,'streets'],[2,'hospital'],[4,'gates']]) {
    const worst = await p.evaluate(async lv => {
      window.__apEnter(lv);
      if (window.__apSkipDialogue) window.__apSkipDialogue();
      let worst = 0, at = 0;
      for (let f = 0; f < 60 * 60; f++) {
        const t0 = performance.now();
        window.__apPump(1/60);
        const d = performance.now() - t0;
        if (d > worst) { worst = d; at = f; }
      }
      return { worst: Math.round(worst), at: Math.round(at / 60) + 's' };
    }, i);
    console.log(String(worst.worst).padStart(6) + ' ms   worst frame in ' + n + ' (at ' + worst.at + ')');
  }
  await b.close();
})();
