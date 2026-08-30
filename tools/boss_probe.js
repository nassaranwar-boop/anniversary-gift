// Watch the boss's state machine and count projectiles over a whole fight.
const { chromium } = require('playwright-core'); const fs = require('fs');
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
  await page.waitForTimeout(2300);
  await page.evaluate(() => { window.__soTestDrive = true; window.__soTele(182); });

  const r = await page.evaluate(() => {
    var log = [], maxShots = 0, modes = {}, seen = [], lastMode = '';
    var b = window.__soBoss();
    for (var i = 0; i < 60 * 45; i++) {            // 45s of game time
      window.__soPump(1/60, {});
      b = window.__soBoss();
      if (!b) break;
      maxShots = Math.max(maxShots, b.shots);
      modes[b.mode] = (modes[b.mode] || 0) + 1;
      if (b.mode !== lastMode) { seen.push(b.mode + '(p' + b.phase + ')'); lastMode = b.mode; }
    }
    return { maxShots: maxShots, modeFrames: modes, sequence: seen.slice(0, 18).join(' -> '),
             hp: b && b.hp, hpMax: b && b.hpMax };
  });
  console.log(JSON.stringify(r, null, 1));

  // and now actually beat him, checking every phase is reached
  const fight = await page.evaluate(() => {
    var phases = {}, guard = 0, shotsMax = 0, perPhaseShots = {};
    while (window.__soBoss() && window.__soBoss().hp > 0 && guard++ < 60) {
      window.__soPlayer({ star: 99 });          // she cannot die during this
      window.__soBossStomp();
      window.__soPump(1.6, {});
      var b = window.__soBoss();
      if (b) {
        phases[b.phase] = true;
        shotsMax = Math.max(shotsMax, b.shots);
        perPhaseShots[b.phase] = Math.max(perPhaseShots[b.phase] || 0, b.shots);
      }
    }
    window.__soPlayer({ star: 0 });
    var b2 = window.__soBoss();
    return { hp: b2 ? b2.hp : null, phasesSeen: Object.keys(phases), stomps: guard,
             maxShotsInFight: shotsMax, perPhase: perPhaseShots,
             goalOpen: window.__soInfo().goalOpen };
  });
  console.log('fight:', JSON.stringify(fight));
  await browser.close();
})();
