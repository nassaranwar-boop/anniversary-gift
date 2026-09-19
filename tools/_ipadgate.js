const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox','--no-proxy-server','--use-gl=swiftshader','--enable-unsafe-swiftshader'] });
  const ctx = await b.newContext({ viewport: { width: 1180, height: 820 }, isMobile: true, hasTouch: true });
  await ctx.route('**/*', (r) => r.request().url().startsWith('http://127.0.0.1') ? r.continue() : r.abort());
  const p = await ctx.newPage();
  p.on('pageerror', (e) => console.log('PAGEERROR', e.message.slice(0, 130)));
  await p.goto(`http://127.0.0.1:${process.argv[2] || 8899}/index.html`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForTimeout(900);
  await p.evaluate(() => { try { localStorage.clear(); } catch (e) {} showScreen('gate'); });
  await p.waitForTimeout(900);
  for (const d of ['2','2','0','7']) { await p.tap(`[data-gate-key="${d}"]`); await p.waitForTimeout(150); }
  for (let i = 0; i < 8; i++) {
    await p.waitForTimeout(700);
    console.log((i+1)*0.7 + 's', await p.evaluate(() => {
      const a = document.querySelector('.screen.active');
      const card = document.getElementById('gate-card');
      return (a ? a.id : 'none')
        + ' | dots ' + document.querySelectorAll('.gate-dot.filled').length
        + ' | err "' + (document.getElementById('gate-error')||{}).textContent + '"'
        + ' | card.ok=' + card.classList.contains('ok')
        + ' | gateCode=' + (typeof gateCode === 'undefined' ? '?' : gateCode);
    }));
  }
  await b.close();
})();
