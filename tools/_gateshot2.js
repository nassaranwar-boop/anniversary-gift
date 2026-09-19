const { chromium } = require('playwright-core');
const OUT = process.argv[2] || '/tmp/gate';
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox','--no-proxy-server','--use-gl=swiftshader','--enable-unsafe-swiftshader'] });
  for (const [w,h,tag] of [[844,390,'844x390'],[740,360,'740x360'],[932,430,'932x430'],[812,375,'812x375'],[844,340,'844x340']]) {
    const p = await b.newPage({ viewport: { width: w, height: h }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
    await p.route('**/*', (r) => r.request().url().startsWith('http://127.0.0.1') ? r.continue() : r.abort());
    await p.goto('http://127.0.0.1:8899/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await p.waitForTimeout(700);
    await p.evaluate(() => showScreen('gate'));
    await p.waitForFunction(() => { const c = document.getElementById('gate-card'), s = document.getElementById('screen-gate');
      const id = (t) => !t || t === 'none' || /matrix\(1,\s*0,\s*0,\s*1,\s*0,\s*0\)/.test(t);
      return c && id(getComputedStyle(c).transform) && id(getComputedStyle(s).transform); }, { timeout: 20000, polling: 200 }).catch(() => {});
    await p.waitForTimeout(400);
    await p.screenshot({ path: OUT + '-' + tag + '.png', timeout: 60000, animations: 'disabled' });
    console.log(tag, await p.evaluate(() => {
      const r = (s) => { const e = document.querySelector(s); if (!e) return s + ':none';
        const q = e.getBoundingClientRect();
        return s.replace(/[\[\]"=]|data-gate-key/g,'') + ' ' + Math.round(q.width) + 'x' + Math.round(q.height); };
      const card = document.getElementById('gate-card').getBoundingClientRect();
      return 'card ' + Math.round(card.width) + 'x' + Math.round(card.height)
        + ' @' + Math.round(card.left) + ',' + Math.round(card.top)
        + ' | ' + ['[data-gate-key="5"]', '#gate-submit', '.gate-heading', '.gate-title img'].map(r).join(' | ')
        + ' | fills ' + (100 * card.width * card.height / (innerWidth * innerHeight)).toFixed(0) + '%';
    }));
    await p.close();
  }
  await b.close();
})();
