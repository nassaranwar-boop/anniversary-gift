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
    /* and turn to the spread the clip is actually on, or there is no shown
       page carrying it and every measurement below is taken off a hidden
       one. Scrapbook.goTo walks there in one step. */
    var onShown = function () {
      return document.querySelector(['leftpage','rightpage','solo']
        .map(function (c) { return '#sb-spread .sb-page.' + c + ' .sb-w-ourvideo'; })
        .join(', '));
    };
    for (var i = 0; i < 40 && !onShown(); i++) {
      Scrapbook.next();
      await new Promise(r=>setTimeout(r,420));
    }
    await new Promise(r=>setTimeout(r,1400));
    /* Every page lives in the spread all the time; only the one or two she
       is looking at wear a slot class and have a layout box at all. Taking
       the first .sb-w-ourvideo in the document takes the one on a hidden
       page, and everything measured off it comes back 0x0 -- which is what
       having no box means, not a button that has collapsed. Prefer the card
       on the spread that is actually shown. */
    const SHOWN = ['leftpage','rightpage','solo']
      .map(c => '#sb-spread .sb-page.' + c + ' .sb-w-ourvideo').join(', ');
    const card = document.querySelector(SHOWN) || document.querySelector('.sb-w-ourvideo');
    if (!card) return { found:false };
    const v = card.querySelector('video');
    // give the metadata a chance
    for (let i=0;i<40 && v.readyState<1;i++) await new Promise(r=>setTimeout(r,150));
    const poster = card.querySelector('.sb-ov-poster');
    for (let i=0;i<40 && !card.classList.contains('hasposter');i++) await new Promise(r=>setTimeout(r,120));
    const btn = card.querySelector('.sb-vid-play');
    const bb = btn && btn.getBoundingClientRect();
    return { found:true, src:v.getAttribute('src'), readyState:v.readyState,
             hasReadyClass: card.classList.contains('ready'),
             hasPosterClass: card.classList.contains('hasposter'),
             posterImage: poster && getComputedStyle(poster).backgroundImage.slice(0,60),
             mountPresent: !!card.querySelector('.sb-ov-mount'),
             sprockets: card.querySelectorAll('.sb-ov-holes i').length,
             playButton: btn ? Math.round(bb.width)+'x'+Math.round(bb.height)+' visible='+(getComputedStyle(btn).display!=='none') : 'MISSING',
             caption: (card.querySelector('.sb-vid-cap')||{}).textContent,
             slateHidden: getComputedStyle(card.querySelector('.sb-vid-empty')).display === 'none',
             err: v.error && v.error.code };
  });
  console.log('video card:', r);
  console.log('requests for the file:', reqs);
  await browser.close();
})();
