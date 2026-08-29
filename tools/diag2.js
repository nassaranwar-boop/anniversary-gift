const { chromium } = require('playwright-core');
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox','--no-proxy-server','--disable-gpu'] });
  const page = await browser.newPage({ viewport: { width: 1000, height: 700 } });
  const errs = [];
  page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
  await page.route('**/*', r => r.request().url().startsWith('http://127.0.0.1') ? r.continue() : r.abort());
  await page.goto('http://127.0.0.1:8899/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(700);

  await page.evaluate(() => { try{localStorage.clear();}catch(e){} showScreen('ouissy'); startSuperOuissy(); });
  await page.waitForTimeout(1000);
  console.log('right after start :', JSON.stringify(await page.evaluate(() => window.__soLoop())));

  // is the registered id dead? cancel and re-register through the module
  await page.evaluate(() => { window.__soHalt(); window.__soHaltUndo(); });
  await page.waitForTimeout(1000);
  console.log('after halt+undo   :', JSON.stringify(await page.evaluate(() => window.__soLoop())));

  console.log(errs.length ? errs.join('\n') : 'no page errors');
  await browser.close();
})();
