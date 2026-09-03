/* Close-ups aimed off the skeleton rather than off a guess: give it a
   bone path and a direction, and it frames that bone. */
const { chromium } = require('playwright-core');
const fs = require('fs');
const OUT = '/tmp/claude-0/-home-user-anniversary-gift/85bd4ff5-90c7-5866-8597-7159ac2fad5f/scratchpad/shots';
const PLAN = JSON.parse(fs.readFileSync(process.env.PLAN, 'utf8'));
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--use-gl=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--no-sandbox'] });
  const p = await b.newPage({ viewport: { width: 1000, height: 620 } });
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.route('**', r => (r.request().url().startsWith('http://localhost') ? r.continue() : r.abort()));
  await p.goto('http://localhost:8899/index.html', { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(400);
  await p.evaluate(() => {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById('screen-apoc').classList.add('active');
    window.Apocalypse.start();
  });
  await p.waitForFunction(() => !!window.__apEnter, { timeout: 40000 });
  await p.evaluate(() => { window.__apLoop(false); window.__apQuality(0); window.__apEnter(0); window.__apSkipDialogue(); });
  for (const s of PLAN) {
    const info = await p.evaluate(st => {
      if (st.who) window.__apPortrait(st.who);
      if (st.turn != null) window.__apPortraitTurn(st.turn);
      window.__apPortraitPose(st.t || 0, st.gait || 0, st.opts || {});
      if (st.set) {
        const R = window.Apocalypse.game.cine.figure;
        for (const k in st.set) {
          const parts = k.split('.'); let o = R;
          for (let i = 0; i < parts.length - 1; i++) o = o[parts[i]];
          o.rotation[parts[parts.length - 1]] = st.set[k];
        }
      }
      const G = window.Apocalypse.game, c = G.cine.camera;
      let look = st.at || [0, 0.98, 0];
      if (st.bone) {
        const bb = window.__apBone(st.bone);
        if (bb) look = bb.p;
      }
      c.fov = st.fov || 34; c.updateProjectionMatrix();
      const d = st.from || [1.4, 0.5, 1.9];
      c.position.set(look[0] + d[0], look[1] + d[1], look[2] + d[2]);
      c.lookAt(look[0], look[1], look[2]);
      c.updateMatrixWorld(true);
      window.__apPaint();
      return { look: look.map(v => +v.toFixed(3)) };
    }, s);
    await p.screenshot({ path: `${OUT}/${s.name}.png` });
    console.log('shot', s.name, JSON.stringify(info));
  }
  console.log('errors:', errs.length ? errs.slice(0, 3) : 'none');
  await b.close();
})();
