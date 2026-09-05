const { chromium } = require('playwright-core');
(async () => {
  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox','--no-proxy-server','--disable-gpu','--use-gl=swiftshader','--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport:{width:390,height:844}, deviceScaleFactor:3, isMobile:true, hasTouch:true });
  page.on('pageerror', e=>console.log('PAGEERROR', e.message));
  const reqs = [];
  page.on('response', r => { if (r.url().includes('our-video')) reqs.push(r.status()+' '+r.url().split('/').pop()+' '+(r.headers()['content-length']||'?')); });
  await page.route('**/*', r => r.request().url().startsWith('http://127.0.0.1') ? r.continue() : r.abort());
  await page.goto('http://127.0.0.1:8899/index.html', { waitUntil:'domcontentloaded', timeout:60000 });
  await page.waitForTimeout(1500);
  console.log('codec support h264/aac:', await page.evaluate(() =>
    document.createElement('video').canPlayType('video/mp4; codecs="avc1.42E01E, mp4a.40.2"') || '(none)'));
  const r = await page.evaluate(async () => {
    window.skipBookIntro && window.skipBookIntro();
    document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
    document.getElementById('screen-scrapbook').classList.add('active');
    Scrapbook.start();
    await new Promise(r=>setTimeout(r,3000));
    const card = document.querySelector('.sb-w-ourvideo');
    if (!card) return { found:false };
    const v = card.querySelector('video');
    // give the metadata a chance
    for (let i=0;i<40 && v.readyState<1;i++) await new Promise(r=>setTimeout(r,150));
    return { found:true, src:v.getAttribute('src'), readyState:v.readyState,
             duration:v.duration, w:v.videoWidth, h:v.videoHeight,
             hasReadyClass: card.classList.contains('ready'),
             hasPlayButton: !!card.querySelector('.sb-vid-play'),
             networkState: v.networkState, err: v.error && v.error.code };
  });
  console.log('video card:', r);
  console.log('requests for the file:', reqs);
  await browser.close();
})();
