const { chromium } = require('playwright-core'); const fs=require('fs');
(async () => {
  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox','--no-proxy-server','--disable-gpu','--use-gl=swiftshader','--enable-unsafe-swiftshader'] });
  const out = process.argv[2] || 'shots';
  fs.mkdirSync(out, { recursive: true });
  const page = await browser.newPage({ viewport:{width:390,height:844}, deviceScaleFactor:2, isMobile:true, hasTouch:true });
  page.on('pageerror', e=>console.log('PAGEERROR', e.message));
  await page.route('**/*', r => r.request().url().startsWith('http://127.0.0.1') ? r.continue() : r.abort());
  await page.goto('http://127.0.0.1:8899/index.html', { waitUntil:'domcontentloaded', timeout:60000 });
  await page.waitForTimeout(3000);
  const shot = async (n) => { await page.screenshot({ path: `${out}/${n}.png` }); console.log('shot', n); };
  await shot('01-intro');
  await page.evaluate(()=>{ window.skipBookIntro&&window.skipBookIntro(); showScreen('gate'); });
  await page.waitForTimeout(800); await shot('02-gate');
  await page.evaluate(async ()=>{ showScreen('scrapbook'); Scrapbook.start(); });
  await page.waitForTimeout(5000); await shot('03-book-cover');
  for (let i=0;i<3;i++){ await page.evaluate(()=>Scrapbook.next()); await page.waitForTimeout(1600); }
  await shot('04-book-spread');
  await page.evaluate(()=>{ Scrapbook.stop(); showScreen('hub'); startHub(); });
  await page.waitForTimeout(900); await shot('05-hub');
  await browser.close();
})();
