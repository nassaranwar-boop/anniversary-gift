const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--use-gl=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--no-sandbox'] });
  const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
  p.on('pageerror', e => console.log('ERR', e.message));
  await p.route('**', r => (r.request().url().startsWith('http://localhost') ? r.continue() : r.abort()));
  await p.goto('http://localhost:8899/index.html', { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(400);
  await p.evaluate(() => {
    try { localStorage.removeItem('apoc.settings'); } catch (e) {}
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById('screen-apoc').classList.add('active');
    window.Apocalypse.start();
  });
  await p.waitForFunction(() => !!window.__apEnter, { timeout: 40000 });
  await p.evaluate(() => { window.__apLoop(false); window.__apQuality(2);
                           window.__apEnter(0); window.__apSkipDialogue(); });
  await p.waitForTimeout(300);
  /* walk her about so some of the plan is filled in, then hand her the atlas */
  console.log(await p.evaluate(async () => {
    const G = window.Apocalypse.game;
    G.hasMap = true;
    const dirs = ['right','down','left','up','right','down'];
    for (const d of dirs) {
      window.__apKey(d, true);
      for (let i = 0; i < 110; i++) window.__apPump(1/60);
      window.__apKey(d, false);
    }
    window.__apClear();
    window.__apMap();
    const cv = document.querySelector('.ap-map-canvas');
    return { state: window.__apState().state, canvas: !!cv,
             w: cv && cv.width, h: cv && cv.height,
             stops: document.querySelectorAll('.ap-map-stop').length,
             keys: document.querySelectorAll('.ap-map-key-item').length,
             dir: (document.querySelector('.ap-map-dir')||{}).textContent };
  }));
  await p.waitForTimeout(700);
  await p.addStyleTag({ content: '.ap-card,.ap-overlay,.ap-map{animation:none!important;opacity:1!important;filter:none!important;transform:none!important}' });
  await p.waitForTimeout(500);
  await p.screenshot({ path: process.argv[2] || '/tmp/map.png', animations: 'allow' });
  await b.close();
})();
