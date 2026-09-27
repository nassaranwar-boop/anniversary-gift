const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox','--no-proxy-server','--use-gl=swiftshader','--enable-unsafe-swiftshader'] });
  for (let i = 0; i < 5; i++) {
    const p = await b.newPage({ viewport: { width: 1024, height: 768 } });
    await p.route('**/*', (r) => r.request().url().startsWith('http://127.0.0.1') ? r.continue() : r.abort());
    await p.goto('http://127.0.0.1:8899/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await p.waitForTimeout(700);
    await p.evaluate(() => showScreen('gate'));
    await p.waitForTimeout(900);
    console.log(i, await p.evaluate(() => {
      const c = document.getElementById('gate-card'), g = document.querySelector('.gate');
      const r = c.getBoundingClientRect();
      return 'rect ' + Math.round(r.width) + 'x' + Math.round(r.height)
        + ' off ' + c.offsetWidth + 'x' + c.offsetHeight
        + ' tr=' + (c.style.transform || '-')
        + ' appH=' + getComputedStyle(document.documentElement).getPropertyValue('--app-h').trim()
        + ' gateH=' + g.clientHeight + ' cardW=' + getComputedStyle(c).width;
    }));
    await p.close();
  }
  await b.close();
})();
