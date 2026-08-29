const { chromium } = require('playwright-core');
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox','--no-proxy-server','--disable-gpu'] });
  const page = await browser.newPage({ viewport: { width: 900, height: 560 } });
  page.on('pageerror', e => console.log('PAGEERROR', e.message));
  await page.route('**/*', r => r.request().url().startsWith('http://127.0.0.1') ? r.continue() : r.abort());
  await page.goto('http://127.0.0.1:8899/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(400);
  await page.evaluate(() => { window.__soTestDrive = true; try{localStorage.clear();}catch(e){} showScreen('ouissy'); startSuperOuissy(); });
  await page.waitForTimeout(300);
  await page.click(`[data-so-diff="${process.env.DIFF||'medium'}"]`); await page.click('#so-play'); await page.waitForTimeout(250);
  const how = await page.$('#so-how-ok'); if (how) await how.click();
  await page.waitForTimeout(2300);
  await page.evaluate(() => { window.__soTestDrive = true; window.__soGoLevel(2); });
  // the world card holds state at "card" for 1.7s and step() is a no-op
  // until it clears, so wait it out properly rather than racing it
  for (let i = 0; i < 30; i++) {
    await page.waitForTimeout(200);
    if (await page.evaluate(() => window.__soInfo().state === 'play')) break;
  }

  for (const hp of [6, 4, 2]) {
    const r = await page.evaluate(h => {
      var state0 = window.__soInfo().state;
      window.__soTele(178);
      // stand back and be unhurtable: star would let her damage him on
      // contact, which changes the phase we are trying to observe
      window.__soPlayer({ invuln: 99999, star: 0 });
      window.__soBossSet({ hp: h, hurt: 0, dead: 0, awake: true, mode: 'wait', modeT: 0.3, shots: [], vx: 0 });
      var maxShots = 0, tells = [], opens = [], last = null, run = 0, gaps = [], sinceAttack = 0, seq = [];
      for (var i = 0; i < 60 * 25; i++) {
        window.__soPump(1/60, {});
        var b = window.__soBoss();
        if (!b) break;
        maxShots = Math.max(maxShots, b.shots);
        sinceAttack += 1/60;
        if (b.mode !== last) { seq.push(b.mode+':'+b.modeT.toFixed(1));
          if (last === 'tell') tells.push(+(run/60).toFixed(2));
          if (last === 'open') opens.push(+(run/60).toFixed(2));
          if (b.mode === 'attack') { gaps.push(+sinceAttack.toFixed(2)); sinceAttack = 0; }
          last = b.mode; run = 0;
        }
        run++;
      }
      var bb = window.__soBoss();
      return { state0: state0, seq: seq.slice(0,8).join(' '), awake: bb.awake, phase: bb.phase, maxShots: maxShots,
               tell: tells[1], open: opens[1],
               gapBetweenAttacks: gaps.length > 2 ? gaps[2] : gaps[gaps.length-1],
               attacks: gaps.length };
    }, hp);
    console.log('hp ' + hp + ' ->', JSON.stringify(r));
  }
  await browser.close();
})();
