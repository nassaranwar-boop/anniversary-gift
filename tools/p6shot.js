/* node p6shot.js <out> <cue|letter> */
const { chromium } = require('playwright-core'); const fs = require('fs');
const [out, mode] = process.argv.slice(2);
(async () => {
  const browser = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args:['--no-sandbox','--no-proxy-server','--disable-gpu','--font-render-hinting=none'] });
  const page = await browser.newPage({ viewport:{width:1180,height:900} });
  page.on('pageerror', e=>console.log('ERR', e.message));
  await page.route('**/*', r => { const u=r.request().url();
    if (u.startsWith('http://127.0.0.1')||u.includes('fonts.g')) return r.continue(); return r.abort(); });
  await page.goto('http://127.0.0.1:8899/index.html', { waitUntil:'networkidle', timeout:60000 });
  await page.waitForTimeout(800);
  await page.evaluate(() => { window.__soTestDrive = true; try{localStorage.clear();}catch(e){}
    showScreen('ouissy'); startSuperOuissy(); });
  await page.waitForSelector('.so-diff-card', { timeout:6000 });
  await page.click('[data-so-diff="hard"]'); await page.click('#so-play');
  await page.waitForTimeout(300);
  const how = await page.$('#so-how-ok'); if (how) await how.click();
  for (let i=0;i<30;i++){ await page.waitForTimeout(150);
    if (await page.evaluate(()=>window.__soInfo().state==='play')) break; }
  await page.evaluate(() => window.__soGoLevel(2));
  for (let i=0;i<12;i++){ await page.waitForTimeout(400);
    if (await page.evaluate(() => window.__soInfo().state === 'play')) break; }
  await page.evaluate(() => { window.__soDieToBoss();
    for (let i=0;i<300;i++){ window.__soPump(0.05);
      const s = window.Rescue && Rescue._state(); if (s && s.kind==='death') break; } });
  await page.evaluate(() => { for (let i=0;i<3000;i++){ const s=Rescue._state();
    if (!s || s.phase===6) break; if (s.lines) Rescue.press('confirm'); window.__soPump(0.05); } });

  if (mode === 'cue') {
    await page.evaluate(() => { const s=Rescue._state(); s.sel=0; Rescue.press('confirm');
      // walk to the middle of a live window on a later, tighter round
      for (let i=0;i<3000;i++){ const st=Rescue._state();
        /* Hold on a later, tighter round: stop pressing once we are there
           and let the window drain so the bar is visibly mid-flight. */
        if (st.phase===9 && st.round>=3) {
          if (st.cueT > st.cueWindow*0.45) break;
          window.__soPump(0.03); continue;
        }
        if (st.phase===9 && st.cue) Rescue.press({block:'jump',dodge:'left',strike:'jump'}[st.cue.id]);
        else if (st.lines) Rescue.press('confirm');
        window.__soPump(0.03); } });
  } else {
    await page.evaluate(() => { const s=Rescue._state(); s.sel=1; Rescue.press('confirm');
      for (let i=0;i<4000;i++){ const st=Rescue._state(); if (!st) break;
        const b=document.getElementById('so-letter');
        if (b && !b.hidden && !document.getElementById('so-letter-ok').hidden) break;
        if (st.lines) Rescue.press('confirm'); window.__soPump(0.05); } });
  }
  await page.waitForTimeout(300);
  const cdp = await page.context().newCDPSession(page);
  const { data } = await cdp.send('Page.captureScreenshot', { format:'png' });
  fs.writeFileSync(out, Buffer.from(data,'base64'));
  console.log('wrote', out);
  await browser.close();
})();
