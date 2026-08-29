const { chromium } = require('playwright-core');
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox','--no-proxy-server','--disable-gpu'] });
  const page = await browser.newPage({ viewport: { width: 1180, height: 900 } });
  await page.route('**/*', r => r.request().url().startsWith('http://127.0.0.1') ? r.continue() : r.abort());
  await page.goto('http://127.0.0.1:8899/index.html', { waitUntil:'domcontentloaded', timeout:60000 });
  await page.waitForTimeout(800);

  for (const scr of ['ouissy','scrapbook']) {
    await page.evaluate((s)=>{ showScreen(s); }, scr);
    await page.waitForTimeout(500);
    console.log('--- ' + scr + ' ---');
    console.log(await page.evaluate(() => {
      const out = [];
      document.querySelectorAll('body *').forEach(el => {
        const st = getComputedStyle(el);
        if (st.position === 'fixed' || st.display === 'none') return;
        const r = el.getBoundingClientRect();
        if (r.height > 0 && r.bottom > innerHeight + 2) {
          out.push({ sel: el.tagName.toLowerCase()+(el.id?'#'+el.id:'')+(typeof el.className==='string'&&el.className?'.'+el.className.trim().split(/\s+/).join('.'):''),
            top: Math.round(r.top), bottom: Math.round(r.bottom), h: Math.round(r.height),
            pos: st.position, height: st.height, minH: st.minHeight, pad: st.paddingTop+'/'+st.paddingBottom,
            mt: st.marginTop, mb: st.marginBottom, parent: el.parentElement ? el.parentElement.tagName.toLowerCase()+(el.parentElement.id?'#'+el.parentElement.id:'') : '-' });
        }
      });
      return out.slice(0, 6);
    }));
  }
  console.log('--- who is focused when resize happens ---');
  await page.setViewportSize({ width: 1180, height: 810 });
  await page.waitForTimeout(400);
  console.log(await page.evaluate(() => ({
    active: document.activeElement ? document.activeElement.tagName + (document.activeElement.id?'#'+document.activeElement.id:'') : 'none',
    appH: getComputedStyle(document.documentElement).getPropertyValue('--app-h').trim(),
    innerH: innerHeight,
  })));
  await browser.close();
})();
