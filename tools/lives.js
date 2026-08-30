/* Lives must mean lives: at zero the run is over. */
const { chromium } = require('playwright-core');
const R=[]; const ok=(n,c,x)=>R.push((c?'PASS  ':'FAIL  ')+n+(x?'   '+x:''));
(async () => {
  const browser = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args:['--no-sandbox','--no-proxy-server','--disable-gpu'] });
  const page = await browser.newPage({ viewport:{width:1180,height:900} });
  const errs=[]; page.on('pageerror', e=>errs.push(e.message));
  await page.route('**/*', r => { const u=r.request().url();
    if (u.startsWith('http://127.0.0.1')||u.includes('fonts.g')) return r.continue(); return r.abort(); });
  await page.goto('http://127.0.0.1:8899/index.html', { waitUntil:'networkidle', timeout:60000 });
  await page.waitForTimeout(900);
  if (errs.length) { console.log('LOAD ERRORS:', errs.join(' | ')); }

  const boot = async (d) => {
    await page.evaluate(() => { window.__soTestDrive = true; try{localStorage.clear();}catch(e){}
      if (window.SuperOuissy) SuperOuissy.stop(); showScreen('ouissy'); startSuperOuissy(); });
    await page.waitForSelector('.so-diff-card', { timeout:6000 });
    await page.click(`[data-so-diff="${d}"]`); await page.click('#so-play');
    await page.waitForTimeout(300);
    const how = await page.$('#so-how-ok'); if (how) await how.click();
    for (let i=0;i<30;i++){ await page.waitForTimeout(150);
      if (await page.evaluate(()=>window.__soInfo().state==='play')) break; }
  };

  /* Medium, not Easy: Easy has no fatal pits by design, so dropping her
     out of the world there does nothing and the run never ends. */
  await boot('medium');
  const trace = await page.evaluate(() => {
    const out = [];
    for (let d = 0; d < 12; d++) {
      const st = window.__soState();
      if (st.state !== 'play') { out.push({ death: d, state: st.state, hud: null }); break; }
      const hud = document.getElementById('so-lives').textContent.replace(/[^0-9]/g, '');
      out.push({ death: d, state: st.state, lives: st.lives, hud: hud });
      window.__soPlayer({ y: 99999 });
      /* Pump right through the death AND the respawn. Breaking the moment
         the counter moves leaves her mid-animation, and the next kill lands
         on a corpse and does nothing — which is why this only ever
         registered one death. */
      let dropped = false;
      for (let i = 0; i < 400; i++) {
        window.__soPump(0.05);
        const s = window.__soState();
        if (s.state !== 'play') { dropped = true; break; }
        if (s.lives !== st.lives) dropped = true;
        if (dropped && !window.__soPlayer().dead) break;
      }
    }
    return out;
  });
  const playedAtZero = trace.some(t => t.state === 'play' && t.lives === 0);
  ok('the game never stays playable at zero lives', !playedAtZero,
     trace.map(t => t.state === 'play' ? t.lives : '[' + t.state + ']').join(' -> '));
  const shownZero = trace.some(t => t.state === 'play' && t.hud === '0');
  ok('and the HUD never shows zero while she can still play', !shownZero,
     trace.filter(t=>t.state==='play').map(t => 'hud' + t.hud).join(' '));
  ok('the run does end', trace.some(t => t.state && t.state !== 'play'),
     trace[trace.length-1].state);

  // his lines: all ten, and never the same one twice running
  const bag = await page.evaluate(() => {
    const seen = [];
    for (let i = 0; i < 40; i++) {
      Rescue.begin('rescue', { herX: 100, herY: 90 });
      const s = Rescue._state();
      seen.push(s.lines[0].text);
    }
    return seen;
  });
  const uniq = new Set(bag);
  ok('all ten of his lines are in rotation', uniq.size === 10, uniq.size + ' distinct in 40 rescues');
  let backToBack = 0;
  for (let i = 1; i < bag.length; i++) if (bag[i] === bag[i-1]) backToBack++;
  ok('and none repeats immediately', backToBack === 0, backToBack + ' back-to-back repeats');
  ok('they are his lines, word for word',
     bag.includes('Up you go. I’ve got you.') &&
     bag.includes('Back on your feet. That’s my girl.'));

  console.log(R.join('\n'));
  console.log(errs.length ? 'ERRORS: '+errs.join(' | ') : 'no page errors');
  await browser.close();
  process.exit(R.some(r=>r.startsWith('FAIL')) ? 1 : 0);
})();
