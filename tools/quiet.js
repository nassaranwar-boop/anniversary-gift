/* The site itself must be silent. The games may make noise; the pages
   she is only walking through may not. */
const { chromium } = require('playwright-core');
const R=[]; const ok=(n,c,x)=>R.push((c?'PASS  ':'FAIL  ')+n+(x?'   '+x:''));
(async () => {
  const browser = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args:['--no-sandbox','--no-proxy-server','--disable-gpu','--autoplay-policy=no-user-gesture-required'] });
  const page = await browser.newPage({ viewport:{width:390,height:844}, isMobile:true, hasTouch:true });
  await page.addInitScript(() => {
    window.__osc = 0; window.__started = [];
    const patch = (C) => { if (!C) return;
      const f = C.prototype.createOscillator;
      C.prototype.createOscillator = function(){
        const o = f.apply(this, arguments);
        const st = o.start.bind(o);
        o.start = function(){ window.__osc++; window.__started.push(o.type); return st.apply(o, arguments); };
        return o; }; };
    patch(window.AudioContext); patch(window.webkitAudioContext);
  });
  await page.route('**/*', r => { const u=r.request().url();
    if (u.startsWith('http://127.0.0.1')||u.includes('fonts.g')) return r.continue(); return r.abort(); });
  await page.goto('http://127.0.0.1:8899/index.html', { waitUntil:'domcontentloaded', timeout:60000 });
  await page.waitForTimeout(900);

  ok('nothing is playing before she touches anything', await page.evaluate(() => window.__osc === 0),
     await page.evaluate(() => window.__osc + ' oscillators'));

  // the very first tap — the one that begins the book intro
  await page.touchscreen.tap(195, 500);
  await page.waitForTimeout(2500);
  const afterTap = await page.evaluate(() => window.__osc);
  ok('the first tap does not start a drone', afterTap === 0, afterTap + ' oscillators after the intro tap');

  // and it stays quiet as she walks through the site
  for (const scr of ['gate','hub','scrapbook','keepsake']) {
    await page.evaluate((s) => showScreen(s), scr);
    await page.waitForTimeout(900);
  }
  const afterWalk = await page.evaluate(() => window.__osc);
  ok('and quiet all the way through the site', afterWalk === 0,
     afterWalk + ' oscillators after four screens');

  ok('the ambient pad is not running', await page.evaluate(() => {
    const p = window.__audioProbe ? window.__audioProbe() : null;
    return p ? (p.on === false && p.gain <= 0.0002) : true;
  }), JSON.stringify(await page.evaluate(() => window.__audioProbe && window.__audioProbe())));

  // but the games must still be able to make sound
  const gameNoise = await page.evaluate(() => {
    const before = window.__osc;
    hvSfx('collect');
    return { before, after: window.__osc };
  });
  ok('the games can still make sound', gameNoise.after > gameNoise.before,
     gameNoise.before + ' -> ' + gameNoise.after);

  console.log(R.join('\n'));
  await browser.close();
  process.exit(R.some(r=>r.startsWith('FAIL')) ? 1 : 0);
})();
