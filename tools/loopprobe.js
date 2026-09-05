// Which animation loops are actually running, screen by screen.
// A loop that keeps ticking after you have left its screen is paying for a
// frame nobody is looking at, and several of them at once is the jank.
const { chromium } = require('playwright-core');
(async () => {
  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox','--no-proxy-server','--disable-gpu','--use-gl=swiftshader','--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport:{width:390,height:844}, deviceScaleFactor:3, isMobile:true, hasTouch:true });
  page.on('pageerror', e=>console.log('PAGEERROR', e.message));
  await page.route('**/*', r => r.request().url().startsWith('http://127.0.0.1') ? r.continue() : r.abort());
  await page.addInitScript(() => {
    const raf = window.requestAnimationFrame.bind(window);
    window.__tick = {};
    window.requestAnimationFrame = function (cb) {
      let site = 'anonymous';
      try {
        const st = new Error().stack.split('\n');
        // the frame that called rAF
        const line = st[2] || st[1] || '';
        site = line.trim().replace(/^at\s+/, '').replace(/\s*\(.*?([^\/]+:\d+):\d+\)$/, ' @$1');
      } catch (e) {}
      return raf(function (t) {
        window.__tick[site] = (window.__tick[site] || 0) + 1;
        return cb(t);
      });
    };
    window.__sample = async (ms) => { window.__tick = {}; await new Promise(r=>setTimeout(r, ms)); return window.__tick; };
  });
  await page.goto('http://127.0.0.1:8899/index.html', { waitUntil:'domcontentloaded', timeout:60000 });
  await page.waitForTimeout(2500);

  const show = async (label) => {
    const t = await page.evaluate(ms => window.__sample(ms), 1500);
    const rows = Object.entries(t).sort((a,b)=>b[1]-a[1]).filter(([k,v])=>v>1);
    console.log('\n--- ' + label);
    if (!rows.length) console.log('    (nothing ticking)');
    rows.forEach(([k,v]) => console.log('    ' + String(v).padStart(4) + '  ' + k));
  };
  await show('the 3D book intro (expected: the intro renderer)');

  await page.evaluate(() => { window.skipBookIntro && window.skipBookIntro();
    document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
    document.getElementById('screen-gate').classList.add('active'); });
  await page.waitForTimeout(600);
  await show('the passcode gate (the 3D scene has been disposed)');

  await page.evaluate(async () => {
    document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
    document.getElementById('screen-scrapbook').classList.add('active');
    Scrapbook.start(); });
  await page.waitForTimeout(3000);
  await show('the memory book');

  await page.evaluate(() => { if (window.Scrapbook) Scrapbook.stop();
    document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
    showScreen('hub'); startHub(); });
  await page.waitForTimeout(1200);
  await show('the hub, after leaving the book (expected: nothing from the book)');

  await page.evaluate(() => { showScreen('apoc'); startApocalypse(); });
  await page.waitForTimeout(3000);
  await show('the apocalypse');

  await page.evaluate(() => { stopApocalypse(); showScreen('hub'); startHub(); });
  await page.waitForTimeout(1500);
  await show('back at the hub (expected: nothing from the apocalypse)');
  await browser.close();
})();
