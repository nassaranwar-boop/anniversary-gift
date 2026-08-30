const { chromium } = require('playwright-core');
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox','--no-proxy-server','--disable-gpu'] });
  const page = await browser.newPage({ viewport: { width: 1000, height: 700 } });
  const errs = [];
  page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
  page.on('console', m => { if (m.type()==='error' && !/ERR_FAILED|Failed to load/.test(m.text())) errs.push('CONSOLE: '+m.text()); });
  await page.route('**/*', r => r.request().url().startsWith('http://127.0.0.1') ? r.continue() : r.abort());
  await page.goto('http://127.0.0.1:8899/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(700);

  // count our own rAF ticks, so we know whether the browser is animating
  await page.evaluate(() => {
    window.__tick = 0;
    (function f(){ window.__tick++; requestAnimationFrame(f); })();
  });

  await page.evaluate(() => { try{localStorage.clear();}catch(e){} showScreen('ouissy'); startSuperOuissy(); });
  await page.waitForSelector('.so-diff-card', { timeout: 6000 });
  await page.waitForTimeout(1200);
  console.log('AT MENU  :', JSON.stringify(await page.evaluate(() => {
    const cv = document.getElementById('so-canvas');
    const d = cv.getContext('2d').getImageData(0,0,cv.width,cv.height).data;
    let painted = 0; for (let i=3;i<d.length;i+=4) if (d[i]>0) painted++;
    return { ticks: window.__tick, canvasPainted: Math.round(painted/(d.length/4)*100),
             active: document.getElementById('screen-ouissy').className,
             cw: cv.width, ch: cv.height,
             cssW: Math.round(cv.getBoundingClientRect().width) };
  })));

  await page.click('[data-so-diff="easy"]');
  await page.click('#so-play');
  await page.waitForTimeout(400);
  const how = await page.$('#so-how-ok'); if (how) await how.click();
  await page.waitForTimeout(4000);

  console.log('IN GAME  :', JSON.stringify(await page.evaluate(() => {
    const cv = document.getElementById('so-canvas');
    const d = cv.getContext('2d').getImageData(0,0,cv.width,cv.height).data;
    let painted = 0; for (let i=3;i<d.length;i+=4) if (d[i]>0) painted++;
    return { ticks: window.__tick, canvasPainted: Math.round(painted/(d.length/4)*100),
             active: document.getElementById('screen-ouissy').className,
             cw: cv.width, ch: cv.height,
             cssW: Math.round(cv.getBoundingClientRect().width),
             state: window.__soState().state,
             loop: window.__soLoop ? window.__soLoop() : 'no hook' };
  })));

  // can we draw on that canvas by hand?
  console.log('MANUAL   :', JSON.stringify(await page.evaluate(() => {
    const cv = document.getElementById('so-canvas');
    const c = cv.getContext('2d');
    c.fillStyle = '#ff0000'; c.fillRect(0,0,50,50);
    const d = c.getImageData(0,0,cv.width,cv.height).data;
    let painted = 0; for (let i=3;i<d.length;i+=4) if (d[i]>0) painted++;
    return { afterManualFill: Math.round(painted/(d.length/4)*100) };
  })));

  // decisive: paint red by hand, then wait. If the game is painting to this
  // canvas it will overwrite it; if the red survives, it is painting to
  // something else — or not painting at all.
  await page.waitForTimeout(900);
  console.log('AFTER WAIT:', JSON.stringify(await page.evaluate(() => {
    const cv = document.getElementById('so-canvas');
    const d = cv.getContext('2d').getImageData(0,0,cv.width,cv.height).data;
    let red = 0, painted = 0;
    for (let i=0;i<d.length;i+=4) {
      if (d[i+3]>0) painted++;
      if (d[i]>200 && d[i+1]<60 && d[i+2]<60) red++;
    }
    return { redSurvives: red > 100, painted: Math.round(painted/(d.length/4)*100),
             canvasCount: document.querySelectorAll('#so-canvas').length,
             allCanvases: document.querySelectorAll('canvas').length };
  })));
  // Does paint() itself work? __soPump ends by calling it directly.
  console.log('VIA PUMP  :', JSON.stringify(await page.evaluate(() => {
    window.__soPump(0.02, {});
    const cv = document.getElementById('so-canvas');
    const d = cv.getContext('2d').getImageData(0,0,cv.width,cv.height).data;
    let painted = 0; for (let i=3;i<d.length;i+=4) if (d[i]>0) painted++;
    return { painted: Math.round(painted/(d.length/4)*100) };
  })));
  console.log(errs.length ? errs.join('\n') : 'no page errors');
  await browser.close();
})();
