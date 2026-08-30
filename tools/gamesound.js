/* Do the maze and the adventure actually make sounds now? Count real
   oscillators — a flag proves nothing. */
const { chromium } = require('playwright-core');
const R=[]; const ok=(n,c,x)=>R.push((c?'PASS  ':'FAIL  ')+n+(x?'   '+x:''));
(async () => {
  const browser = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args:['--no-sandbox','--no-proxy-server','--disable-gpu','--autoplay-policy=no-user-gesture-required'] });
  const page = await browser.newPage({ viewport:{width:1180,height:900} });
  const errs=[]; page.on('pageerror', e=>errs.push(e.message));
  await page.addInitScript(() => {
    window.__osc = 0; window.__noise = 0;
    const patch = (C) => { if (!C) return;
      const f = C.prototype.createOscillator;
      C.prototype.createOscillator = function(){ window.__osc++; return f.apply(this, arguments); };
      const b = C.prototype.createBufferSource;
      C.prototype.createBufferSource = function(){ window.__noise++; return b.apply(this, arguments); }; };
    patch(window.AudioContext); patch(window.webkitAudioContext);
  });
  await page.route('**/*', r => { const u=r.request().url();
    if (u.startsWith('http://127.0.0.1')||u.includes('fonts.g')) return r.continue(); return r.abort(); });
  await page.goto('http://127.0.0.1:8899/index.html', { waitUntil:'domcontentloaded', timeout:60000 });
  await page.waitForTimeout(800);

  /* Takes a real function and an argument. Passing a source STRING makes
     page.evaluate treat it as an expression: the arrow function is built
     and never called, so every voice measures as silent. */
  const count = async (fn, arg) => {
    const a = await page.evaluate(() => ({ o: window.__osc, n: window.__noise }));
    await page.evaluate(fn, arg);
    await page.waitForTimeout(120);
    const b = await page.evaluate(() => ({ o: window.__osc, n: window.__noise }));
    return { osc: b.o - a.o, noise: b.n - a.n };
  };

  // every named voice must actually produce something
  const voices = ['pick','collect','bad','yay','spot','shot','step','key','phial','locked','respawn','arrive','page','hover'];
  const dead = [];
  for (const v of voices) {
    const c = await count((name) => hvSfx(name), v);
    if (c.osc < 1) dead.push(v);
  }
  ok('every voice makes a sound', dead.length === 0, dead.length ? 'silent: ' + dead.join(', ') : voices.length + ' voices');

  // the ones built from noise must really carry a noise layer
  const stepC = await count(() => hvSfx('step'));
  const pageC = await count(() => hvSfx('page'));
  ok('a footstep is a knock, not a beep', stepC.noise >= 1, 'noise sources=' + stepC.noise);
  ok('a page turn is paper, not a beep', pageC.noise >= 1, 'noise sources=' + pageC.noise);
  const collectC = await count(() => hvSfx('collect'));
  ok('the ringing voices layer a second oscillator', collectC.osc >= 2, collectC.osc + ' oscillators');

  // the maze's own moments
  await page.evaluate(() => { try{localStorage.clear();}catch(e){} showScreen('maze'); initMaze(2); });
  await page.waitForTimeout(800);
  const mazeMoments = {
    'picking up a phial': () => { meds[0].taken=false; meds[0].r=playerPos.r; meds[0].c=playerPos.c; onPlayerMovedLevel2(); },
    'finding the key':    () => { hasKey=false; keyPos={r:playerPos.r,c:playerPos.c}; onPlayerMovedLevel2(); },
    'a locked door':      () => { hasKey=false; const t=targetPos; targetPos={r:playerPos.r,c:playerPos.c}; checkWin(); targetPos=t; },
    'losing a life':      () => { respawnLevel2(); },
  };
  for (const [name, fn] of Object.entries(mazeMoments)) {
    const c = await count(fn);
    ok('the maze makes a sound when ' + name, c.osc >= 1, c.osc + ' oscillators');
  }

  console.log(R.join('\n'));
  console.log(errs.length ? 'ERRORS: '+errs.join(' | ') : 'no page errors');
  await browser.close();
  process.exit(R.some(r=>r.startsWith('FAIL')) ? 1 : 0);
})();
