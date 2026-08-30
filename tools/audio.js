/* Does the sound survive an interruption, and does the toggle really
   bring it back? Both were broken; both are asserted here. */
const { chromium } = require('playwright-core');
const R=[]; const ok=(n,c,x)=>R.push((c?'PASS  ':'FAIL  ')+n+(x?'   '+x:''));
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox','--no-proxy-server','--disable-gpu','--autoplay-policy=no-user-gesture-required'] });
  const page = await browser.newPage({ viewport: { width: 1180, height: 900 } });
  const errs=[]; page.on('pageerror', e=>errs.push(e.message));
  await page.route('**/*', r => r.request().url().startsWith('http://127.0.0.1') ? r.continue() : r.abort());
  await page.goto('http://127.0.0.1:8899/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(700);

  // item 2: the dead control is gone, everywhere
  ok('the floating mute button is gone from the DOM',
     await page.evaluate(() => !document.getElementById('music-toggle') &&
       !document.querySelector('.music-toggle')));

  // the keeper exists and is wired
  ok('the shared audio keeper is exposed',
     await page.evaluate(() => typeof window.wakeAudio === 'function' && typeof window.registerAudio === 'function'));

  // an "interrupted" context is treated as recoverable, not ignored.
  // This is THE bug: the old check only ever looked for "suspended".
  const rec = await page.evaluate(async () => {
    let resumed = 0, state = 'interrupted';
    const fake = { get state(){ return state; }, resume(){ resumed++; state='running'; return Promise.resolve(); } };
    let woke = false;
    window.wakeAudio(fake, () => { woke = true; });
    await new Promise(r => setTimeout(r, 60));
    return { resumed, woke, state };
  });
  ok('an interrupted context is resumed, not ignored', rec.resumed >= 1 && rec.state === 'running',
     'resume calls=' + rec.resumed);
  ok('and the work waiting on it runs only after the resume lands', rec.woke === true);

  // a closed context is never resumed (it cannot be) and never throws
  const closed = await page.evaluate(async () => {
    let calls = 0;
    const fake = { state: 'closed', resume(){ calls++; return Promise.resolve(); } };
    window.wakeAudio(fake, () => {});
    await new Promise(r => setTimeout(r, 500));
    return calls;
  });
  ok('a closed context is not pointlessly resumed', closed === 0, 'calls=' + closed);

  // Safari's case: resume() resolves but the state stays stuck. The retry must fire.
  const stuck = await page.evaluate(async () => {
    let calls = 0, state = 'interrupted';
    const fake = { get state(){ return state; },
      resume(){ calls++; if (calls >= 2) state = 'running'; return Promise.resolve(); } };
    window.wakeAudio(fake, () => {});
    await new Promise(r => setTimeout(r, 700));
    return { calls, state };
  });
  ok('a resume that resolves but does not take is retried', stuck.calls >= 2 && stuck.state === 'running',
     'calls=' + stuck.calls);

  /* The pad must NOT start by itself. It is a continuous drone with no
     control anywhere to stop it, so a tap on the intro used to begin a
     noise that ran for the whole visit. */
  await page.mouse.click(600, 450);
  await page.waitForTimeout(1200);
  let st = await page.evaluate(() => window.__audioProbe());
  ok('a gesture alone does not start the pad', st.on === false && st.gain <= 0.0002,
     'on=' + st.on + ' gain=' + st.gain);

  /* But the machinery underneath is intact and still worth testing —
     everything below covers the context recovery a real control would
     depend on the day there is one. */
  await page.evaluate(() => setMusic(true));
  await page.waitForTimeout(1600);
  st = await page.evaluate(() => window.__audioProbe());
  ok('asking for it explicitly starts it and it runs', st.ctx === 'running' && st.on === true,
     'ctx=' + st.ctx + ' on=' + st.on);
  ok('and it is actually audible (master gain lifted)', st.gain > 0.05, 'gain=' + st.gain.toFixed(3));
  ok('the bell chain is scheduled', st.bell === true);

  // off, then on again — the reported failure
  await page.evaluate(() => setMusic(false));
  await page.waitForTimeout(900);
  st = await page.evaluate(() => window.__audioProbe());
  ok('turning it off silences it', st.gain < 0.02, 'gain=' + st.gain.toFixed(4));
  ok('and it stops the bells', st.bell === false);

  await page.evaluate(() => setMusic(true));
  await page.waitForTimeout(1900);
  st = await page.evaluate(() => window.__audioProbe());
  ok('turning it back on restores the sound', st.gain > 0.05, 'gain=' + st.gain.toFixed(3));
  ok('and restores the bells, which used to die for good', st.bell === true);

  // survive a real suspend/resume round trip, twice
  for (let i = 1; i <= 2; i++) {
    await page.evaluate(() => window.__audioSuspend());
    await page.waitForTimeout(300);
    await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
    await page.waitForTimeout(900);
    st = await page.evaluate(() => window.__audioProbe());
    ok('round trip ' + i + ': the watchdog brings a suspended context back',
       st.ctx === 'running', 'ctx=' + st.ctx);
  }

  console.log(R.join('\n'));
  console.log(errs.length ? 'ERRORS: '+errs.join(' | ') : 'no page errors');
  await browser.close();
  process.exit(R.some(r=>r.startsWith('FAIL')) ? 1 : 0);
})();
