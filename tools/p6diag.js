const { chromium } = require('playwright-core');
(async () => {
  const browser = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args:['--no-sandbox','--no-proxy-server','--disable-gpu'] });
  const page = await browser.newPage({ viewport:{width:1180,height:900} });
  page.on('pageerror', e=>console.log('ERR', e.message));
  await page.route('**/*', r => { const u=r.request().url();
    if (u.startsWith('http://127.0.0.1')||u.includes('fonts.g')) return r.continue(); return r.abort(); });
  await page.goto('http://127.0.0.1:8899/index.html', { waitUntil:'domcontentloaded', timeout:60000 });
  await page.waitForTimeout(800);
  await page.evaluate(() => { window.__soTestDrive = true; try{localStorage.clear();}catch(e){}
    showScreen('ouissy'); startSuperOuissy(); });
  await page.waitForSelector('.so-diff-card', { timeout:6000 });
  await page.click('[data-so-diff="hard"]'); await page.click('#so-play');
  await page.waitForTimeout(300);
  const how = await page.$('#so-how-ok'); if (how) await how.click();
  await page.waitForTimeout(600);
  console.log(await page.evaluate(() => {
    for (let i=0;i<60;i++){ window.__soPump(0.1); if (window.__soInfo().state==='play') break; }
    window.__soGoLevel(2);
    const inf = window.__soInfo();
    const stt = window.__soState();
    return { state: inf.state, world: stt.world, diff: stt.diff, lives: stt.lives,
             hasRescue: !!window.Rescue };
  }));
  await page.waitForTimeout(2200);
  console.log('state now:', await page.evaluate(() => window.__soInfo().state));
  console.log('level has a boss?', await page.evaluate(() => {
    const st = window.__soState(); const b = window.__soBoss ? window.__soBoss() : null;
    return { world: st.world, diff: st.diff, lives: st.lives, boss: b };
  }));
  console.log(await page.evaluate(() => {
    window.__soDieToBoss();
    const out = [];
    for (let i=0;i<200;i++){
      window.__soPump(0.05);
      const s = window.Rescue && Rescue._state();
      const st = window.__soState();
      if (i % 25 === 0) out.push(i + ':' + st.state + ' lives=' + st.lives + ' rescue=' + (s? s.kind : 'none'));
      if (s && s.kind === 'death') { out.push('DEATH at ' + i); break; }
    }
    return out;
  }));
  await browser.close();
})();
