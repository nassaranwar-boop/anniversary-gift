/* EVERY PAGE OF THE BOOK, AS A PICTURE.

   The scrapbook only ever shows one spread at a time and there is no
   public way to jump to a page, so judging the composition meant turning
   pages by hand and hoping. This clones each built page into a clean
   frame at a fixed size and captures it, so all ten can be laid out side
   by side and compared.

   Two things this has to work around, both written up in the handoff:
   page.screenshot() hangs while the scrapbook's canvas loop is painting,
   so capture goes through CDP; and the webfonts are blocked in this
   container, so everything is routed to localhost only and the fonts
   fall back to system faces. Type sizes are still true — only the faces
   differ from the real thing.

   Usage:  node pageshots.js [outdir]      (default ../.pageshots)
*/
const { chromium } = require('playwright-core');
const fs = require('fs');
const path = require('path');

const OUT = path.resolve(process.argv[2] || path.join(__dirname, '..', '.pageshots'));
const W = 480, H = 640;                       // the page is 3:4
const SCALE = Number(process.env.SCALE || 1);  // 1 is plenty to judge a layout by

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'],
  });
  const ctx = await browser.newContext({ viewport: { width: W + 80, height: H + 80 },
                                         deviceScaleFactor: SCALE });
  await ctx.route('**/*', r => r.request().url().startsWith('http://127.0.0.1')
    ? r.continue() : r.abort());
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  await page.goto('http://127.0.0.1:8899/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(2500);
  await page.evaluate(() => { showScreen('scrapbook'); if (window.startDioramas) startDioramas(); });
  await page.waitForTimeout(4000);

  /* The book lazy-loads its photographs, and every page but the open one
     is off screen, so a clone taken now would come back full of empty
     frames — which is not what the page looks like and is no basis for
     judging a layout. Force them all to load and wait for it. */
  const loaded = await page.evaluate(async () => {
    const imgs = [...document.querySelectorAll('.sb-page img')];
    imgs.forEach(im => { im.loading = 'eager'; if (im.dataset.src && !im.src) im.src = im.dataset.src; });
    await Promise.all(imgs.map(im => im.complete ? null :
      new Promise(res => { im.addEventListener('load', res, {once:true});
                           im.addEventListener('error', res, {once:true}); })));
    return { total: imgs.length, ok: imgs.filter(i => i.naturalWidth > 0).length };
  });
  console.log('photographs in the book:', loaded.ok + '/' + loaded.total, 'loaded');
  await page.waitForTimeout(1200);

  /* A clean stage the clones can sit in, with nothing else on screen. */
  const count = await page.evaluate(({ w, h }) => {
    const s = document.getElementById('screen-scrapbook');
    s.classList.add('sb-open');
    const intro = document.getElementById('sb-intro');
    if (intro) intro.style.display = 'none';
    const stage = document.createElement('div');
    stage.id = '__stage';
    stage.style.cssText =
      'position:fixed;left:40px;top:40px;width:' + w + 'px;height:' + h + 'px;' +
      'z-index:99999;background:#efe2da;overflow:hidden;';
    document.body.appendChild(stage);
    window.__pages = [...document.querySelectorAll('.sb-page')];
    return window.__pages.length;
  }, { w: W, h: H });

  console.log('pages found:', count);
  const cdp = await ctx.newCDPSession(page);

  for (let i = 0; i < count; i++) {
    const label = await page.evaluate(({ i, w, h }) => {
      const stage = document.getElementById('__stage');
      stage.innerHTML = '';
      const clone = window.__pages[i].cloneNode(true);
      /* the real page is absolutely placed inside the spread and may be
         mid-turn; the clone is pinned flat so we see it as designed */
      clone.style.cssText += ';position:absolute;left:0;top:0;margin:0;' +
        'width:' + w + 'px;height:' + h + 'px;transform:none;opacity:1;' +
        'visibility:visible;display:flex;box-shadow:none;border-radius:0;';
      clone.classList.remove('sb-page-turning');
      stage.appendChild(clone);
      return clone.className;
    }, { i, w: W, h: H });

    /* cloneNode copies the src but not the decoded bitmap, so the clone
       re-fetches. Capturing on a timer caught them mid-load and produced
       pages full of empty frames that do not exist in the real book —
       wait for the clone's own images instead of guessing. */
    await page.evaluate(async () => {
      const imgs = [...document.querySelectorAll('#__stage img')];
      await Promise.all(imgs.map(im => im.complete && im.naturalWidth
        ? null
        : new Promise(res => { im.addEventListener('load', res, {once:true});
                               im.addEventListener('error', res, {once:true});
                               setTimeout(res, 4000); })));
    });
    await page.waitForTimeout(160);
    const shot = await cdp.send('Page.captureScreenshot', {
      format: 'png',
      clip: { x: 40, y: 40, width: W, height: H, scale: SCALE },
      captureBeyondViewport: false,
    });
    const name = 'page-' + String(i).padStart(2, '0') + '.png';
    fs.writeFileSync(path.join(OUT, name), Buffer.from(shot.data, 'base64'));
    console.log('  ' + name + '  ' + label);
  }

  console.log('\nwritten to ' + OUT);
  if (errs.length) console.log('page errors:', errs.slice(0, 5));
  await browser.close();
})();
