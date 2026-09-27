const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox','--no-proxy-server','--use-gl=swiftshader','--enable-unsafe-swiftshader'] });
  for (const [w,h] of [[844,390],[844,340]]) {
    const p = await b.newPage({ viewport: { width: w, height: h }, isMobile: true, hasTouch: true });
    await p.route('**/*', (r) => r.request().url().startsWith('http://127.0.0.1') ? r.continue() : r.abort());
    await p.goto('http://127.0.0.1:8899/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await p.waitForTimeout(700);
    await p.evaluate(() => showScreen('gate'));
    await p.waitForTimeout(1800);
    console.log(w + 'x' + h, await p.evaluate(() => {
      const card = document.getElementById('gate-card').getBoundingClientRect();
      const pad = document.getElementById('gate-pad').getBoundingClientRect();
      const unlock = document.getElementById('gate-submit').getBoundingClientRect();
      const seal = document.querySelector('.gate-seal-wrap').getBoundingClientRect();
      /* where the drawn rule is: 4.4% of the height, 3% of the width */
      const ruleT = card.top + card.height * 0.044, ruleB = card.bottom - card.height * 0.044;
      const ruleL = card.left + card.width * 0.03, ruleR = card.right - card.width * 0.03;
      const r2 = (n) => Math.round(n);
      return 'pad air  left ' + r2(pad.left - ruleL) + '  right ' + r2(ruleR - pad.right)
           + '  top ' + r2(pad.top - ruleT) + '  bottom ' + r2(ruleB - pad.bottom)
           + ' | left col: seal top ' + r2(seal.top - ruleT) + ' unlock bottom ' + r2(ruleB - unlock.bottom)
           + ' | key ' + r2(document.querySelector('[data-gate-key="5"]').getBoundingClientRect().width);
    }));
    await p.close();
  }
  await b.close();
})();
