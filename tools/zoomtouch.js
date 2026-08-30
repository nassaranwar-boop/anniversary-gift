/* Does the page sit at a true 100% with no void, at any zoom — and do
   taps and long presses behave? */
const { chromium } = require('playwright-core');
const R=[]; const ok=(n,c,x)=>R.push((c?'PASS  ':'FAIL  ')+n+(x?'   '+x:''));
(async () => {
  const browser = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args:['--no-sandbox','--no-proxy-server','--disable-gpu'] });

  // ---------- the viewport tag itself ----------
  {
    const page = await browser.newPage({ viewport:{width:390,height:844} });
    await page.route('**/*', r => { const u=r.request().url();
      if (u.startsWith('http://127.0.0.1')||u.includes('fonts.g')) return r.continue(); return r.abort(); });
    await page.goto('http://127.0.0.1:8899/index.html', { waitUntil:'domcontentloaded', timeout:60000 });
    const meta = await page.evaluate(() =>
      document.querySelector('meta[name="viewport"]').getAttribute('content'));
    ok('no forced scale in the viewport tag',
       !/maximum-scale/.test(meta) && !/user-scalable\s*=\s*no/.test(meta), meta);
    ok('it still sets width and an initial scale of 1',
       /width=device-width/.test(meta) && /initial-scale=1\b/.test(meta), meta);
    ok('the height comes from CSS, not a measured pixel value', await page.evaluate(() =>
      document.documentElement.style.getPropertyValue('--app-h') === '' &&
      getComputedStyle(document.documentElement).getPropertyValue('--app-h').trim() === '100dvh'),
      await page.evaluate(() => 'inline="' + document.documentElement.style.getPropertyValue('--app-h') +
        '" computed=' + getComputedStyle(document.documentElement).getPropertyValue('--app-h').trim()));
    await page.close();
  }

  // ---------- true 100%, and no void, at a range of zooms ----------
  for (const [w,h,label] of [[390,844,'phone'],[1180,900,'desktop']]) {
    /* One page per viewport, resized rather than reloaded. Browser zoom
       means fewer or more CSS pixels behind the same glass, which is
       exactly what changing the CSS viewport does. */
    const page = await browser.newPage({ viewport:{width:w,height:h},
      isMobile: label === 'phone', hasTouch: label === 'phone' });
    await page.route('**/*', r => { const u=r.request().url();
      if (u.startsWith('http://127.0.0.1')||u.includes('fonts.g')) return r.continue(); return r.abort(); });
    await page.goto('http://127.0.0.1:8899/index.html', { waitUntil:'domcontentloaded', timeout:60000 });
    await page.waitForTimeout(600);
    await page.evaluate(() => { try{localStorage.clear();}catch(e){} showScreen('hub'); if (window.startHub) startHub(); });
    await page.waitForTimeout(400);

    for (const zoom of [0.5, 0.8, 1, 1.5, 2]) {
      await page.setViewportSize({ width: Math.round(w/zoom), height: Math.round(h/zoom) });
      await page.waitForTimeout(320);
      /* The screen-entry animation ends on a scale, and its last frames
         leave the box a pixel or two short of the viewport. That is a
         transform mid-flight, not layout — measuring it measures the
         animation. */
      await page.evaluate(() => document.querySelectorAll('.anim-in')
        .forEach(el => el.classList.remove('anim-in')));
      await page.waitForTimeout(120);
      const m = await page.evaluate(() => {
        const de = document.documentElement;
        const scr = document.querySelector('.screen.active');
        const r = scr ? scr.getBoundingClientRect() : null;
        return { innerH: innerHeight, doc: de.scrollHeight,
                 screenH: r ? Math.round(r.height) : 0, screenTop: r ? Math.round(r.top) : 0,
                 canScroll: de.scrollHeight > innerHeight + 1 };
      });
      const fills = Math.abs(m.screenH - m.innerH) <= 1 && m.screenTop === 0;
      ok(`${label} @${zoom}x: the screen is exactly the viewport, no void`,
         fills && !m.canScroll,
         `screen ${m.screenH}px top ${m.screenTop} vs viewport ${m.innerH}, doc ${m.doc}`);
    }
    await page.close();
  }

  // ---------- rapid taps must not be treated as a zoom gesture ----------
  {
    const page = await browser.newPage({ viewport:{width:390,height:844}, isMobile:true, hasTouch:true });
    await page.route('**/*', r => { const u=r.request().url();
      if (u.startsWith('http://127.0.0.1')||u.includes('fonts.g')) return r.continue(); return r.abort(); });
    await page.goto('http://127.0.0.1:8899/index.html', { waitUntil:'networkidle', timeout:60000 });
    await page.waitForTimeout(700);
    await page.evaluate(() => { try{localStorage.clear();}catch(e){} showScreen('gate'); });
    await page.waitForTimeout(900);

    const controls = await page.evaluate(() => {
      const sel = ['[data-gate-key]','.gate-unlock','[data-so-key]','.dpad3-btn','.hub-card','button'];
      const out = {};
      sel.forEach(s => {
        const el = document.querySelector(s);
        if (!el) { out[s] = 'absent'; return; }
        const cs = getComputedStyle(el);
        out[s] = { touch: cs.touchAction, select: cs.userSelect || cs.webkitUserSelect,
                   callout: cs.webkitTouchCallout || '(unset)' };
      });
      return out;
    });
    const bad = Object.entries(controls).filter(([k,v]) =>
      v !== 'absent' && !(/manipulation|none/.test(v.touch)));
    ok('every control refuses the double-tap zoom gesture', bad.length === 0,
       bad.map(([k,v]) => k + '=' + v.touch).join(', ') || JSON.stringify(controls['[data-gate-key]']));
    const sel = Object.entries(controls).filter(([k,v]) => v !== 'absent' && v.select !== 'none');
    ok('and none of them behaves like selectable text', sel.length === 0,
       sel.map(([k,v]) => k + '=' + v.select).join(', '));

    // tap one rapidly and confirm nothing about the page scale moved
    const before = await page.evaluate(() => ({
      scale: (window.visualViewport && window.visualViewport.scale) || 1,
      w: innerWidth, h: innerHeight }));
    const box = await (await page.$('[data-gate-key="5"]')).boundingBox();
    for (let i = 0; i < 10; i++) {
      await page.touchscreen.tap(box.x + box.width/2, box.y + box.height/2);
      await page.waitForTimeout(45);          // fast enough to read as double taps
    }
    await page.waitForTimeout(500);
    const after = await page.evaluate(() => ({
      scale: (window.visualViewport && window.visualViewport.scale) || 1,
      w: innerWidth, h: innerHeight }));
    ok('ten rapid taps leave the page at the same scale',
       Math.abs(after.scale - before.scale) < 0.01 && after.w === before.w && after.h === before.h,
       `scale ${before.scale} -> ${after.scale}, ${before.w}x${before.h} -> ${after.w}x${after.h}`);

    // a long press must not select the label
    await page.mouse.move(box.x + box.width/2, box.y + box.height/2);
    await page.mouse.down();
    await page.waitForTimeout(900);
    await page.mouse.up();
    const selected = await page.evaluate(() => String(window.getSelection()));
    ok('a long press selects nothing', selected.trim() === '', JSON.stringify(selected));

    // but her writing is still selectable
    ok('her own words are still selectable', await page.evaluate(() => {
      const el = document.querySelector('.gate-sub');
      return el ? getComputedStyle(el).userSelect === 'text' : false;
    }));
    await page.close();
  }

  console.log(R.join('\n'));
  await browser.close();
  process.exit(R.some(r=>r.startsWith('FAIL')) ? 1 : 0);
})();
