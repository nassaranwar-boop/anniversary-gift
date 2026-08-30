const { chromium } = require('playwright-core');
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox','--no-proxy-server','--disable-gpu'] });
  const page = await browser.newPage({ viewport: { width: 1180, height: 900 } });
  page.on('pageerror', e=>console.log('ERR', e.message));
  await page.route('**/*', r => r.request().url().startsWith('http://127.0.0.1') ? r.continue() : r.abort());
  await page.goto('http://127.0.0.1:8899/index.html', { waitUntil:'domcontentloaded', timeout:60000 });
  await page.waitForTimeout(800);
  await page.evaluate(() => { showScreen('scrapbook'); if(window.Scrapbook) Scrapbook.start(); });
  await page.waitForTimeout(1800);
  await page.evaluate(() => { const s=document.getElementById('screen-scrapbook');
    s.classList.add('sb-intro-out','sb-open'); const i=document.getElementById('sb-intro'); if(i) i.style.display='none'; });
  await page.waitForTimeout(1400);
  console.log(await page.evaluate(() => ({
    photos: document.querySelectorAll('.sb-photo').length,
    empties: document.querySelectorAll('.sb-photo-empty').length,
    lb: !!document.getElementById('sb-lightbox'),
    api: window.Scrapbook ? Object.keys(window.Scrapbook) : null,
    leaves: document.querySelectorAll('.sb-leaf, .sb-page').length,
    classes: document.getElementById('screen-scrapbook').className,
  })));
  // try turning a page
  console.log('--- after turning pages ---');
  for (let i=0;i<3;i++){
    await page.evaluate(() => { const n = document.querySelector('.sb-next, .sb-nav-next, [data-sb-next]'); if (n) n.click(); });
    await page.waitForTimeout(700);
  }
  console.log(await page.evaluate(() => ({ photos: document.querySelectorAll('.sb-photo').length,
    empties: document.querySelectorAll('.sb-photo-empty').length })));
  await browser.close();
})();
