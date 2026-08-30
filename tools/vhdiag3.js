const { chromium } = require('playwright-core');
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox','--no-proxy-server','--disable-gpu'] });
  const page = await browser.newPage({ viewport: { width: 820, height: 1180 } });
  await page.route('**/*', r => r.request().url().startsWith('http://127.0.0.1') ? r.continue() : r.abort());
  await page.goto('http://127.0.0.1:8899/index.html', { waitUntil:'domcontentloaded', timeout:60000 });
  await page.waitForTimeout(900);
  for (const scr of ['gate','hub','ouissy','scrapbook']) {
    await page.evaluate((x)=>{ try{localStorage.clear();}catch(e){} showScreen(x); if(x==='hub'&&window.startHub) startHub(); }, scr);
    await page.waitForTimeout(400);
    await page.evaluate(() => document.querySelectorAll('.anim-in').forEach(el=>el.classList.remove('anim-in')));
    await page.waitForTimeout(120);
  }
  await page.evaluate(() => { window.__rz=0; window.__ro=0;
    addEventListener('resize', ()=>window.__rz++);
    new ResizeObserver(()=>window.__ro++).observe(document.documentElement); });
  await page.setViewportSize({ width: 820, height: 1090 });
  for (const t of [200, 600, 1500]) {
    await page.waitForTimeout(t === 200 ? 200 : t - (t===600?200:600));
    console.log('t='+t, await page.evaluate(() => ({ rz: window.__rz, ro: window.__ro,
      appH: document.documentElement.style.getPropertyValue('--app-h'), innerH: innerHeight, active: document.activeElement ? document.activeElement.tagName+(document.activeElement.id?'#'+document.activeElement.id:'') : 'none',
      htmlH: Math.round(document.documentElement.getBoundingClientRect().height) })));
  }
  await browser.close();
})();
