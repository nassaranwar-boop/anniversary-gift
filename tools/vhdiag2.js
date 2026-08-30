const { chromium } = require('playwright-core');
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox','--no-proxy-server','--disable-gpu'] });
  const page = await browser.newPage({ viewport: { width: 1180, height: 900 } });
  page.on('pageerror', e => console.log('PAGEERROR:', e.message));
  page.on('console', m => { if (m.type()==='error') console.log('CONSOLE ERR:', m.text()); });
  await page.route('**/*', r => r.request().url().startsWith('http://127.0.0.1') ? r.continue() : r.abort());
  await page.goto('http://127.0.0.1:8899/index.html', { waitUntil:'domcontentloaded', timeout:60000 });
  await page.waitForTimeout(900);
  await page.evaluate(() => showScreen('scrapbook'));
  await page.waitForTimeout(700);
  await page.evaluate(() => { window.__rz = 0; addEventListener('resize', () => window.__rz++); });
  console.log('before:', await page.evaluate(() => ({ appH: document.documentElement.style.getPropertyValue('--app-h'), innerH: innerHeight, fn: typeof fitViewport })));
  await page.setViewportSize({ width: 1180, height: 810 });
  await page.waitForTimeout(500);
  console.log('after resize:', await page.evaluate(() => ({ rz: window.__rz, appH: document.documentElement.style.getPropertyValue('--app-h'), innerH: innerHeight })));
  await page.evaluate(() => { if (typeof fitViewport === 'function') fitViewport(); });
  console.log('after manual call:', await page.evaluate(() => ({ appH: document.documentElement.style.getPropertyValue('--app-h'), innerH: innerHeight })));
  await browser.close();
})();
