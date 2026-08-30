/* node mazeshot.js <out> [w] [h] */
const { chromium } = require('playwright-core'); const fs = require('fs');
const [out, W=390, H=844] = process.argv.slice(2);
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox','--no-proxy-server','--disable-gpu','--font-render-hinting=none'] });
  const page = await browser.newPage({ viewport:{width:+W,height:+H}, isMobile:+W<500, hasTouch:+W<500 });
  page.on('pageerror', e => console.log('PAGEERROR', e.message));
  await page.route('**/*', r => { const u=r.request().url();
    if (u.startsWith('http://127.0.0.1')||u.includes('fonts.g')) return r.continue(); return r.abort(); });
  await page.goto('http://127.0.0.1:8899/index.html', { waitUntil:'networkidle', timeout:60000 });
  await page.waitForTimeout(700);
  const mode = process.argv[5] || 'idle';
  await page.evaluate(() => { try{localStorage.clear();}catch(e){} showScreen('maze'); });
  await page.waitForTimeout(900);
  if (mode === 'watch') {
    // level 2, player parked in a watcher's corridor so it aims
    await page.evaluate(() => { initMaze(2); });
    await page.waitForTimeout(700);
    await page.evaluate(() => {
      const s = shooters[0];
      for (const [dr,dc] of [[0,4],[0,-4],[4,0],[-4,0],[0,2],[0,-2],[2,0],[-2,0]]) {
        const r = s.r+dr, c = s.c+dc;
        let clear = true;
        for (let k=1;k<=Math.abs(dr||dc);k++){
          const rr = s.r + Math.sign(dr)*k, cc = s.c + Math.sign(dc)*k;
          if (!cellOpen(rr,cc)) { clear = false; break; }
        }
        if (clear && cellOpen(r,c) && !treeSet.has(r+','+c)) {
          playerPos = { r, c }; isHidden = false;
          placeToken(document.getElementById('player-token'), playerPos, false);
          updateFog();
          return;
        }
      }
    });
    await page.waitForTimeout(700);
  }
  await page.waitForTimeout(500);
  const cdp = await page.context().newCDPSession(page);
  const { data } = await cdp.send('Page.captureScreenshot', { format:'png' });
  fs.writeFileSync(out, Buffer.from(data,'base64'));
  console.log('wrote', out);
  await browser.close();
})();
