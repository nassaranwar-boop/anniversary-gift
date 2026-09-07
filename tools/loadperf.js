const { chromium } = require('playwright-core');
(async () => {
  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox','--no-proxy-server','--disable-gpu','--use-gl=swiftshader','--enable-unsafe-swiftshader'] });
  const ctx = await browser.newContext({ viewport:{width:390,height:844}, deviceScaleFactor:3, isMobile:true, hasTouch:true });
  const page = await ctx.newPage();
  let bytes = 0, n = 0, critical = 0, criticalN = 0; let fcpDone = false; const big = [];
  page.on('response', async r => {
    if (!r.url().startsWith('http://127.0.0.1')) return;
    const len = Number(r.headers()['content-length'] || 0);
    bytes += len; n++;
    if (!fcpDone) { critical += len; criticalN++; }
    if (len > 40000) big.push((len/1024).toFixed(0).padStart(6)+' KB  '+r.url().split('/').slice(-1)[0]);
  });
  await page.route('**/*', r => r.request().url().startsWith('http://127.0.0.1') ? r.continue() : r.abort());
  const t0 = Date.now();
  await page.goto('http://127.0.0.1:8899/index.html', { waitUntil:'domcontentloaded', timeout:60000 });
  const paint = await page.evaluate(() => new Promise(res => {
    new PerformanceObserver(list => { const e = list.getEntries().find(e=>e.name==='first-contentful-paint'); if (e) res(Math.round(e.startTime)); })
      .observe({ type:'paint', buffered:true });
    setTimeout(()=>res(-1), 8000);
  }));
  // let the idle prefetch settle so we can see what it costs and when
  await page.waitForTimeout(6000);
  const t1 = Date.now();
  fcpDone = true;
  console.log('first contentful paint: ' + paint + ' ms');
  console.log('downloaded before first paint: ' + (critical/1048576).toFixed(2) + ' MB in ' + criticalN + ' requests');
  console.log('requests: ' + n + ',  bytes: ' + (bytes/1048576).toFixed(2) + ' MB  (including the idle prefetch)');
  console.log('largest:\n' + big.sort((a,b)=>parseInt(b)-parseInt(a)).join('\n'));
  await browser.close();
})();
