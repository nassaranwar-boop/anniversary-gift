/* The gate has to let her in — the prettiest lock is still a lock. */
const { chromium } = require('playwright-core');
const R=[]; const ok=(n,c,x)=>R.push((c?'PASS  ':'FAIL  ')+n+(x?'   '+x:''));
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox','--no-proxy-server','--disable-gpu'] });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const errs=[]; page.on('pageerror', e=>errs.push(e.message));
  await page.route('**/*', r => { const u=r.request().url();
    if (u.startsWith('http://127.0.0.1')||u.includes('fonts.g')) return r.continue(); return r.abort(); });
  const boot = async () => {
    await page.goto('http://127.0.0.1:8899/index.html', { waitUntil:'domcontentloaded', timeout:60000 });
    await page.waitForTimeout(900);
    await page.evaluate(() => { try{localStorage.clear();}catch(e){} showScreen('gate'); });
    /* Measure only once the pixel face has actually arrived: the fallback
       monospace is a good deal narrower, and measuring against it makes a
       correctly sized title look like a bug. */
    await page.evaluate(() => document.fonts && document.fonts.ready);
    await page.waitForTimeout(800);
  };
  const tap = async (k) => { await page.click(`[data-gate-key="${k}"]`); await page.waitForTimeout(140); };
  /* dots, not digits: read how many are filled */
  const cells = () => page.evaluate(() => Array.from(document.querySelectorAll('#gate-code .gate-dot'))
    .map(d => d.classList.contains('filled') ? 1 : 0));

  await boot();
  ok('twelve keys, four dots and no text field', await page.evaluate(() =>
    document.querySelectorAll('[data-gate-key]').length === 12 &&
    document.querySelectorAll('#gate-code .gate-dot').length === 4 &&
    !document.querySelector('#screen-gate input')));
  ok('the sheet, seal and ornament are drawn; the plaque and keys are the art', await page.evaluate(() => {
    const c = document.getElementById('gate-card');
    return !!document.querySelector('#gate-seal .gate-wax-blob') &&
           !!c.querySelector('.gate-sheet-grain') &&
           document.querySelectorAll('.gate-flour use').length >= 8 &&
           /gate-title\.png/.test(document.querySelector('.gate-title img').src) &&
           /gate-unlock\.png/.test(document.querySelector('.gate-unlock img').src);
  }));
  ok('every key carries its own cut-out', await page.evaluate(() => {
    const want = ['1','2','3','4','5','6','7','8','9','back','0','clear'];
    return want.every(k => {
      const b = document.querySelector(`[data-gate-key="${k}"] img`);
      return b && new RegExp(`gate-key-${k}\\.png`).test(b.src) && b.naturalWidth > 0;
    });
  }));
  ok('the keys sit on one even grid', await page.evaluate(() => {
    const r = Array.from(document.querySelectorAll('.gate-key')).map(b => b.getBoundingClientRect());
    return r.every(x => Math.abs(x.width - r[0].width) < 0.6 && Math.abs(x.height - r[0].height) < 0.6);
  }));
  ok('flowers and hearts are drifting behind it', await page.evaluate(() =>
    document.querySelectorAll('.gate-blooms .gate-bloom').length >= 20));
  ok('nothing on the gate leans on an emoji', await page.evaluate(() =>
    !/[\u{1F300}-\u{1FAFF}\u{2190}-\u{27BF}]/u.test(document.getElementById('screen-gate').innerText)));


  // the card must fit the phone with nothing past the fold
  const fits = await page.evaluate(() => {
    const c = document.getElementById('gate-card').getBoundingClientRect();
    const t = document.querySelector('.gate-title').getBoundingClientRect();
    return { top: Math.round(t.top), bottom: Math.round(c.bottom), vh: innerHeight,
             titleW: Math.round(t.width), vw: innerWidth };
  });
  ok('the whole gate fits the screen', fits.top >= 0 && fits.bottom <= fits.vh,
     'title top=' + fits.top + ' card bottom=' + fits.bottom + '/' + fits.vh);
  ok('the title spans the screen without spilling', fits.titleW < fits.vw && fits.titleW > fits.vw * 0.6,
     fits.titleW + 'px of ' + fits.vw);

  await tap('2'); await tap('2');
  ok('tapping fills the dots left to right',
     JSON.stringify(await cells()) === JSON.stringify([1,1,0,0]), JSON.stringify(await cells()));
  await tap('back');
  ok('back empties the last dot',
     JSON.stringify(await cells()) === JSON.stringify([1,0,0,0]), JSON.stringify(await cells()));
  await tap('9'); await tap('9'); await tap('clear');
  ok('clear empties them all',
     JSON.stringify(await cells()) === JSON.stringify([0,0,0,0]), JSON.stringify(await cells()));

  // a wrong code
  for (const k of ['1','1','1','1']) await tap(k);
  await page.waitForTimeout(800);
  ok('a wrong code shakes the card and flashes the dots red', await page.evaluate(() =>
    document.getElementById('gate-card').classList.contains('shake') &&
    document.getElementById('gate-code').classList.contains('bad')));
  await page.waitForTimeout(900);
  ok('and then clears itself', await page.evaluate(() => {
    const e = document.getElementById('gate-error').textContent;
    return e.length > 0 && document.getElementById('screen-gate').classList.contains('active') &&
           !document.querySelector('#gate-code .gate-dot.filled');
  }), await page.evaluate(() => document.getElementById('gate-error').textContent));

  // the real one, on the fourth tap
  await boot();
  for (const k of ['2','2','0','7']) await tap(k);
  await page.waitForTimeout(500);
  ok('the right code glows the card gold and breaks the seal', await page.evaluate(() =>
    document.getElementById('gate-card').classList.contains('ok') &&
    document.getElementById('gate-seal').classList.contains('crack')));
  await page.waitForTimeout(2400);
  ok('the right code opens the book on the fourth tap', await page.evaluate(() =>
    !document.getElementById('screen-gate').classList.contains('active')),
    await page.evaluate(() => (document.querySelector('.screen.active')||{id:'none'}).id));

  // ...and via the Unlock plate
  await boot();
  for (const k of ['2','2','0']) await tap(k);
  await page.click('#gate-submit');
  await page.waitForTimeout(400);
  ok('Unlock on a short code just asks for the rest', await page.evaluate(() =>
    document.getElementById('screen-gate').classList.contains('active') &&
    document.getElementById('gate-error').textContent.length > 0));

  console.log(R.join('\n'));
  console.log(errs.length ? 'ERRORS: '+errs.join(' | ') : 'no page errors');
  await browser.close();
  process.exit(R.some(r=>r.startsWith('FAIL')) ? 1 : 0);
})();
