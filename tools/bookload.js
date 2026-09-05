// What does opening the book actually pull down, and when?
const { chromium } = require('playwright-core');
(async () => {
  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox','--no-proxy-server','--disable-gpu','--use-gl=swiftshader','--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport:{width:390,height:844}, deviceScaleFactor:3, isMobile:true, hasTouch:true });
  page.on('pageerror', e=>console.log('PAGEERROR', e.message));
  const photos = [];
  page.on('response', r => { const u=r.url(); if (/photo-\d+\.(jpg|webp|png)/.test(u))
      photos.push({ f:u.split('/').pop(), kb:Math.round(Number(r.headers()['content-length']||0)/1024), st:r.status() }); });
  await page.route('**/*', r => r.request().url().startsWith('http://127.0.0.1') ? r.continue() : r.abort());
  await page.goto('http://127.0.0.1:8899/index.html', { waitUntil:'domcontentloaded', timeout:60000 });
  await page.waitForTimeout(2500);
  const mark = (label) => {
    const kb = photos.reduce((a,p)=>a+p.kb,0);
    const bad = photos.filter(p=>p.st>=400);
    console.log(label.padEnd(42) + photos.length + ' photo requests, ' + kb + ' KB' + (bad.length? '   404s: '+bad.map(b=>b.f).join(','):''));
    return photos.length;
  };
  mark('before the book is opened');
  await page.evaluate(async () => {
    window.skipBookIntro && window.skipBookIntro();
    showScreen('scrapbook'); Scrapbook.start();
    await new Promise(r=>setTimeout(r,4000));
  });
  mark('book open, sitting on the cover');
  // turn a few pages
  for (let i=0;i<4;i++) { await page.evaluate(()=>Scrapbook.next()); await page.waitForTimeout(1500); }
  mark('after four page turns');
  const dom = await page.evaluate(() => ({
    nodes: document.getElementById('screen-scrapbook').querySelectorAll('*').length,
    imgs: document.getElementById('screen-scrapbook').querySelectorAll('img').length,
    lazy: document.getElementById('screen-scrapbook').querySelectorAll('img[loading="lazy"]').length,
  }));
  console.log('book DOM:', dom);
  console.log('format actually used:', [...new Set(photos.map(p=>p.f.split('.').pop()))].join(', '));
  await browser.close();
})();
