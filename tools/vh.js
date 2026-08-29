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
    // --app-h must track a resize (the URL bar hiding is exactly this)
    await page.setViewportSize({ width: w, height: h - 90 });
    /* Poll rather than sample once: the observer callback lands somewhere
       between one and several frames after the resize in this container,
       and a fixed wait turns a correct result into a coin toss. */
    let tracked;
    for (let i = 0; i < 30; i++) {
      await page.waitForTimeout(100);
      tracked = await page.evaluate(() => ({
        appH: getComputedStyle(document.documentElement).getPropertyValue('--app-h').trim(), innerH: innerHeight }));
      if (parseInt(tracked.appH) === tracked.innerH) break;
    }
    ok(label + ': --app-h follows the browser UI hiding and showing',
       parseInt(tracked.appH) === tracked.innerH, tracked.appH + ' vs ' + tracked.innerH + 'px');
    await page.close();
  }
  console.log(R.join('\n'));
  await browser.close();
  process.exit(R.some(r=>r.startsWith('FAIL')) ? 1 : 0);
})();
