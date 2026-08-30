/* Does Super Ouissy actually make any sound? Count real oscillators
   rather than trusting a flag. */
const { chromium } = require('playwright-core');
const R=[]; const ok=(n,c,x)=>R.push((c?'PASS  ':'FAIL  ')+n+(x?'   '+x:''));
(async () => {
  const browser = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args:['--no-sandbox','--no-proxy-server','--disable-gpu','--autoplay-policy=no-user-gesture-required'] });
  const page = await browser.newPage({ viewport:{width:1180,height:900} });
  const errs=[]; page.on('pageerror', e=>errs.push(e.message));
  await page.addInitScript(() => {
    window.__osc = 0;
    const patch = (C) => { if (!C) return; const f = C.prototype.createOscillator;
      C.prototype.createOscillator = function(){ window.__osc++; return f.apply(this, arguments); }; };
    patch(window.AudioContext); patch(window.webkitAudioContext);
  });
  await page.route('**/*', r => { const u=r.request().url();
    if (u.startsWith('http://127.0.0.1')||u.includes('fonts.g')) return r.continue(); return r.abort(); });
  await page.goto('http://127.0.0.1:8899/index.html', { waitUntil:'domcontentloaded', timeout:60000 });
  await page.waitForTimeout(700);

  await page.evaluate(() => { try{localStorage.clear();}catch(e){} showScreen('ouissy'); startSuperOuissy(); });
  await page.waitForSelector('.so-diff-card', { timeout:8000 });
  await page.click('[data-so-diff="easy"]'); await page.click('#so-play');
  await page.waitForTimeout(400);
  const how = await page.$('#so-how-ok'); if (how) await how.click();
  for (let i=0;i<30;i++){ await page.waitForTimeout(200);
    if (await page.evaluate(()=>window.__soInfo && window.__soInfo().state==='play')) break; }

  const ctx = await page.evaluate(() => window.__soAudio ? window.__soAudio.state : 'none');
  ok('the game has a running audio context', ctx === 'running', 'state=' + ctx);

  const before = await page.evaluate(() => window.__osc);
  await page.keyboard.down('ArrowRight');
  await page.waitForTimeout(200);
  await page.keyboard.press('Space');                     // jump
  await page.waitForTimeout(500);
  await page.keyboard.up('ArrowRight');
  const after = await page.evaluate(() => window.__osc);
  ok('an action makes a sound', after > before, before + ' -> ' + after + ' oscillators');

  const bgm = await page.evaluate(() => {
    const s = window.__soState();
    return { on: s.bgmOn, running: s.bgmRunning, audio: s.audio,
             saved: (()=>{ try { return localStorage.getItem('so_bgm'); } catch(e){ return 'x'; } })() };
  });
  ok('the music is on when the game starts', bgm.on === true && bgm.running === true,
     'bgmOn=' + bgm.on + ' timer=' + bgm.running + ' saved=' + bgm.saved);
  ok('and its context is awake', bgm.audio === 'running', bgm.audio);

  /* The bass is mostly root notes, and a rest written as 0 used to eat
     every one of them. Drive a whole bar by hand — setInterval is
     throttled in a headless tab, so timing it off the clock would measure
     the browser rather than the tune. */
  const bar = await page.evaluate(() => window.__soBgmBar());
  ok('the bass keeps its root notes', bar.bassRoots > 0,
     bar.bassRoots + ' roots, ' + bar.bassNotes + ' bass notes of ' + bar.steps + ' steps');
  const barNotes = await page.evaluate(() => {
    const start = window.__osc;
    window.__soBgmSteps(32);
    return window.__osc - start;
  });
  ok('a full bar plays a real tune, not a handful of notes',
     barNotes >= bar.leadNotes + bar.bassNotes - 2,
     barNotes + ' notes for a bar of ' + (bar.leadNotes + bar.bassNotes));

  /* and the loop is genuinely armed, whatever the tab's timer budget */
  ok('the music loop is armed and stays armed', await page.evaluate(() =>
    window.__soState().bgmRunning === true));

  /* the trap this all came from: a frozen clock swallows everything */
  const frozen = await page.evaluate(async () => {
    await window.__soAudio.suspend();
    const start = window.__osc;
    window.__soBgmSteps(16);
    const during = window.__osc - start;
    await window.__soAudio.resume();
    return during;
  });
  ok('nothing is scheduled into a suspended context', frozen === 0,
     frozen + ' notes scheduled while asleep');
  await page.waitForTimeout(400);
  const after2 = await page.evaluate(() => {
    const start = window.__osc; window.__soBgmSteps(16); return window.__osc - start;
  });
  ok('and it picks up again once the context wakes', after2 > 4, after2 + ' notes after waking');

  console.log(R.join('\n'));
  console.log(errs.length ? 'ERRORS: '+errs.join(' | ') : 'no page errors');
  await browser.close();
  process.exit(R.some(r=>r.startsWith('FAIL')) ? 1 : 0);
})();
