/* the ending, at rest, so a cleanup can be proved to change nothing */
const { chromium } = require('playwright-core');
const OUT = process.argv[2] || '/tmp/end';
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox','--no-proxy-server','--use-gl=swiftshader','--enable-unsafe-swiftshader'] });
  for (const [w,h,tag] of [[1280,800,'laptop'],[844,390,'phone']]) {
    const p = await b.newPage({ viewport: { width: w, height: h }, isMobile: h<500, hasTouch: h<500 });
    const got = [];
    p.on('request', (r) => { const u = r.url(); if (/\.(png|jpg|webp|mp4)$/.test(u)) got.push(u.split('/').pop()); });
    await p.route('**/*', (r) => r.request().url().startsWith('http://127.0.0.1') ? r.continue() : r.abort());
    await p.goto('http://127.0.0.1:8899/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await p.waitForTimeout(900);
    await p.evaluate(() => { showScreen('end'); if (window.activateEndingScene) activateEndingScene(); });
    await p.waitForFunction(() => { const s = document.querySelector('.screen.active');
      const t = s && getComputedStyle(s).transform;
      return !t || t === 'none' || /matrix\(1,\s*0,\s*0,\s*1,\s*0,\s*0\)/.test(t); }, { timeout: 15000, polling: 200 }).catch(() => {});
    await p.waitForTimeout(2500);
    await p.screenshot({ path: OUT + '-' + tag + '.png' });
    console.log(tag, 'cat files requested:', got.filter((f) => /black_|white_/.test(f)).join(',') || 'none',
      '| scene classes:', await p.evaluate(() => (document.getElementById('night-sky')||{}).className));
    await p.close();
  }
  await b.close();
})();
