const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox', '--no-proxy-server', '--autoplay-policy=no-user-gesture-required'] });
  const ctx = await b.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  await p.route('**/*', r => r.request().url().startsWith('http://127.0.0.1') ? r.continue() : r.abort());
  await p.goto('http://127.0.0.1:8899/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForTimeout(900);
  await p.evaluate(() => { try { localStorage.clear(); } catch (e) {} showScreen('hub'); startHub(); });
  await p.waitForTimeout(300);
  await p.click('#hub-card-cup');
  await p.waitForFunction(() => window.OuissyCup && OuissyCup.__cup.state() !== null, { timeout: 60000 });
  await p.waitForTimeout(700);
  await p.evaluate(() => { const H = OuissyCup.__cup; H.quick(0); H.auto(true);
    document.getElementById('cup-pad').hidden = false;
    document.getElementById('cup-pad').classList.add('touch');
    for (let i = 0; i < 400 && H.state().state !== 'play'; i++) H.step(1,0,0,false); });
  await p.waitForTimeout(900);
  console.log(JSON.stringify(await p.evaluate(() => {
    const lab = document.getElementById('cup-btn-lab');
    const btn = document.getElementById('cup-btn');
    const cs = getComputedStyle(lab), bs = getComputedStyle(btn);
    return { text: lab.textContent, scrollW: lab.scrollWidth, clientW: lab.clientWidth,
             rect: Math.round(lab.getBoundingClientRect().width),
             btnW: Math.round(btn.getBoundingClientRect().width),
             font: cs.fontSize, family: cs.fontFamily, maxW: cs.maxWidth,
             overflow: cs.overflow, textOverflow: cs.textOverflow,
             btnOverflow: bs.overflow };
  }), null, 1));
  await b.close();
})();
