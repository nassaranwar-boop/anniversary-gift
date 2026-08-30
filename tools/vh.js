const { chromium } = require('playwright-core');
const R=[]; const ok=(n,c,x)=>R.push((c?'PASS  ':'FAIL  ')+n+(x?'   '+x:''));
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox','--no-proxy-server','--disable-gpu'] });
  for (const [w,h,label] of [[390,844,'phone'],[414,896,'phone-l'],[820,1180,'tablet'],[1180,900,'desktop']]) {
    const page = await browser.newPage({ viewport:{width:w,height:h}, isMobile:label.startsWith('phone'), hasTouch:label.startsWith('phone') });
    await page.route('**/*', r => r.request().url().startsWith('http://127.0.0.1') ? r.continue() : r.abort());
    await page.goto('http://127.0.0.1:8899/index.html', { waitUntil:'domcontentloaded', timeout:60000 });
    await page.waitForTimeout(800);
    for (const scr of ['gate','hub','ouissy','scrapbook']) {
      await page.evaluate((s)=>{ try{localStorage.clear();}catch(e){} showScreen(s); if(s==='hub'&&window.startHub) startHub(); }, scr);
      await page.waitForTimeout(400);
      /* The screen-entry animation scales and slides the whole screen, so
         mid-flight every child briefly measures past the fold. That is a
         transform on a clipped fixed element, not layout, and it cannot be
         scrolled to — settle it before measuring or the numbers are noise. */
      await page.evaluate(() => document.querySelectorAll('.anim-in')
        .forEach(el => el.classList.remove('anim-in')));
      await page.waitForTimeout(120);
      const m = await page.evaluate(() => {
        const de = document.documentElement;
        const appH = getComputedStyle(de).getPropertyValue('--app-h').trim();
        // anything non-fixed reaching past the fold is void-making overflow
        let worst = 0, who = '';
        document.querySelectorAll('body *').forEach(el => {
          const st = getComputedStyle(el);
          if (st.position === 'fixed' || st.display === 'none' || st.visibility === 'hidden') return;
          /* Anything inside an <svg> is clipped by that element's own
             viewport, so a <g> whose user-space contents run past the box
             cannot put a pixel on the page — measuring it only produces
             false overflow. The document-height check below is the one
             that actually decides whether a void exists. */
          if (el.ownerSVGElement) return;
          const r = el.getBoundingClientRect();
          if (r.height > 0 && r.bottom - innerHeight > worst) { worst = r.bottom - innerHeight; who = el.tagName + (el.id?'#'+el.id:''); }
        });
        return { appH, innerH: innerHeight, doc: de.scrollHeight, over: Math.round(worst), who,
                 canScroll: de.scrollHeight > innerHeight + 1 };
      });
      ok(label+'/'+scr+': the page fills the screen with nothing past it',
         !m.canScroll && m.over <= 2, 'app-h=' + m.appH + ' doc=' + m.doc + '/' + m.innerH +
         (m.over > 2 ? ' overflow=' + m.over + 'px by ' + m.who : ''));
    }
    /* The height must follow the viewport when the browser UI hides. It is
       CSS that owns this now — --app-h resolves to the 100dvh keyword, not
       a pixel value — so measure the thing that matters: does the active
       screen still come out exactly the height of the viewport? */
    await page.setViewportSize({ width: w, height: h - 90 });
    let tracked;
    for (let i = 0; i < 20; i++) {
      await page.waitForTimeout(100);
      tracked = await page.evaluate(() => {
        document.querySelectorAll('.anim-in').forEach(el => el.classList.remove('anim-in'));
        const scr = document.querySelector('.screen.active');
        const r = scr ? scr.getBoundingClientRect() : null;
        return { screenH: r ? Math.round(r.height) : 0, top: r ? Math.round(r.top) : -1,
                 innerH: innerHeight };
      });
      if (Math.abs(tracked.screenH - tracked.innerH) <= 1 && tracked.top === 0) break;
    }
    ok(label + ': the screen follows the browser UI hiding and showing',
       Math.abs(tracked.screenH - tracked.innerH) <= 1 && tracked.top === 0,
       tracked.screenH + 'px at top ' + tracked.top + ' vs ' + tracked.innerH + 'px');
    await page.close();
  }
  console.log(R.join('\n'));
  await browser.close();
  process.exit(R.some(r=>r.startsWith('FAIL')) ? 1 : 0);
})();
