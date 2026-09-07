/* Which way does a shoulder bone actually turn? Guessing costs a render
   each time, so render the candidates side by side and look. */
const { chromium } = require('playwright-core');
const fs = require('fs');
const OUT = '/tmp/claude-0/-home-user-anniversary-gift/85bd4ff5-90c7-5866-8597-7159ac2fad5f/scratchpad/shots';
const CAND = JSON.parse(fs.readFileSync(process.env.CAND, 'utf8'));
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
  await p.evaluate(() => {
    window.__apEnter(4); window.__apSkipDialogue(); window.__apCampfire();
    const G = window.Apocalypse.game;
    const LEAN = 'Her head finds his shoulder, and stays there.';
    for (let i = 0; i < 60; i++) window.__apPump(1/60);
    let n = 0;
    while (G.dlg && n++ < 400) {
      const l = G.dlg.lines[G.dlg.i - 1];
      if (l && l[1] === LEAN) break;
      window.__apSay(); window.__apPump(1/60);
    }
    for (let i = 0; i < 400; i++) window.__apPump(1/60);

  });
  for (const c of CAND) {
    await p.evaluate(c => {
      const G = window.Apocalypse.game;
      window.__apPump(1/60);
      const him = G.cine.him, her = G.cine.her;
      var A = c.side === 'R' ? him.armR : him.armL;
      A.upper.rotation.set(c.ux, c.uy || 0, c.uz);
      A.elbow.rotation.z = c.ez;
      if (c.sx != null) A.shoulder.rotation.x = c.sx;
      if (c.hx != null) her.root.position.x = c.hx;
      if (c.harmL) { her.armL.upper.rotation.set(c.harmL[0], c.harmL[1], c.harmL[2]); her.armL.elbow.rotation.z = c.harmL[3]; }
      if (c.harmR) { her.armR.upper.rotation.set(c.harmR[0], c.harmR[1], c.harmR[2]); her.armR.elbow.rotation.z = c.harmR[3]; }
      if (c.sz != null) her.spine.rotation.z = c.sz;
      if (c.nz != null) { her.neck.rotation.z = c.nz; her.head.rotation.z = c.hz == null ? c.nz : c.hz; }
      if (c.cam) { G.cine.camera.position.set(c.cam[0], c.cam[1], c.cam[2]); G.cine.camera.lookAt(c.cam[3], c.cam[4], c.cam[5]); }
      window.__apPaint();
    }, c);
    await p.screenshot({ path: `${OUT}/A-${c.name}.png`, clip: { x: 0, y: 0, width: 1000, height: 560 } });
    console.log('shot', c.name);
  }
  await b.close();
})();
