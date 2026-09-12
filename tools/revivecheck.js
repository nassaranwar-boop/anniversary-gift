/* WHAT "BE REVIVED" IS SUPPOSED TO MEAN.

   The offer says "Right where you fell, with everything exactly as you
   left it." This checks that it is true — on every difficulty, in more
   than one world, and for every way there is to die. */
const { chromium } = require('playwright-core');
const R = []; const ok = (n, c, x) => R.push((c ? 'ok   ' : 'FAIL ') + n + (x ? '   ' + x : ''));
const T = 16;

(async () => {
  const browser = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args:['--no-sandbox','--no-proxy-server','--disable-gpu','--use-gl=swiftshader','--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport:{width:1180,height:900} });
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.route('**/*', r => r.request().url().startsWith('http://127.0.0.1') ? r.continue() : r.abort());
  await page.goto('http://127.0.0.1:8899/index.html', { waitUntil:'domcontentloaded', timeout:60000 });
  await page.waitForFunction(() => !!window.SuperOuissy, { timeout:30000 });
  await page.waitForTimeout(400);

  const boot = async (d) => {
    await page.evaluate(() => { window.__soTestDrive = true; try{localStorage.clear();}catch(e){}
      if (window.SuperOuissy) SuperOuissy.stop(); showScreen('ouissy'); startSuperOuissy(); });
    await page.waitForSelector('.so-diff-card', { timeout:6000 });
    await page.click(`[data-so-diff="${d}"]`); await page.click('#so-play');
    await page.waitForTimeout(250);
    const how = await page.$('#so-how-ok'); if (how) await how.click();
    for (let i=0;i<40;i++){ await page.waitForTimeout(100);
      if (await page.evaluate(()=>window.__soInfo && window.__soInfo().state==='play')) break; }
  };

  /* kill her one of four ways, take the offer, and report where she came back */
  const trial = async (how, tile) => page.evaluate(async ({how, tile}) => {
    window.__soLives(9);
    if (tile !== null) window.__soTele(tile);
    window.__soPump(0.05);
    const p0 = window.__soPlayer();
    const died = { x: p0.x, y: p0.y };
    if (how === 'pit')      window.__soPlayer({ y: 99999 });
    else if (how === 'time') window.__soSetTime(0.2);  /* let it RUN OUT: the clock only kills on the way past zero */
    else if (how === 'spike') {
      const sp = window.__soFindTile('^')[0] || window.__soFindTile('v')[0];
      if (!sp) return { skip: true };
      window.__soTele(sp.x, sp.y - 1);
      died.x = window.__soPlayer().x; died.y = window.__soPlayer().y;
      window.__soKill();
    } else window.__soKill();
    for (let i = 0; i < 40 && window.__soInfo().state !== 'revive'; i++) window.__soPump(0.12);
    const offered = window.__soInfo().state === 'revive';
    if (!offered) {
      /* Easy promises a pit never kills: a cloud catches her and stands her
         on the last ground she was on. That is not the revive, but it is
         the same promise, so it counts — as long as the ground it picked
         is where she was playing and not the start of the world. */
      const p = window.__soPlayer();
      return { offered:false, caught:true, died, back:{x:p.x,y:p.y}, startX: window.__soLevelBox().startX };
    }
    document.getElementById('so-revive-yes').click();
    for (let i = 0; i < 60; i++) { window.__soPump(0.12); if (window.__soInfo().state === 'play') break; }
    const p1 = window.__soPlayer();
    return { offered:true, died, back:{x:p1.x,y:p1.y}, startX: window.__soLevelBox().startX };
  }, { how, tile });

  for (const d of ['easy','medium','hard']) {
    await boot(d);
    for (const lvl of [0, 2]) {
      await page.evaluate(l => window.__soGoLevel(l), lvl);
      /* startLevel() puts the world card up and closes it on a timer of its
         own; pumping does not advance a timer, so this waits in real time
         for the card to go rather than testing a paused game. */
      await page.waitForFunction(() => window.__soInfo().state === 'play', { timeout: 8000 });
      const mid = await page.evaluate(() => Math.round(window.__soLevelBox().w * 0.55));
      const clock = await page.evaluate(() => !!window.__soDiffFlag('timeLimit'));
      for (const how of ['hit','pit','time','spike']) {
        if (how === 'time' && !clock) { ok(`${d} L${lvl} time: this difficulty has no clock (skipped)`, true); continue; }
        const r = await trial(how, how === 'spike' ? null : mid);
        if (r.skip) { ok(`${d} L${lvl} ${how}: no spikes in this level (skipped)`, true); continue; }
        if (!r.offered) {
          const safety = await page.evaluate(() => !!window.__soDiffFlag('pitSafety'));
          if (how === 'pit' && safety) {
            const dxc = Math.abs(r.back.x - r.died.x) / T;
            ok(`${d} L${lvl} pit: the cloud catches her where she fell (this difficulty has no fatal pits)`,
               dxc < 6 && Math.abs(r.back.x - r.startX) > T * 2,
               `fell x=${Math.round(r.died.x/T)}t  caught x=${Math.round(r.back.x/T)}t`);
            continue;
          }
          ok(`${d} L${lvl} ${how}: the offer appears`, false); continue;
        }
        const dx = Math.abs(r.back.x - r.died.x) / T;
        const atStart = Math.abs(r.back.x - r.startX) < T * 2;
        ok(`${d} L${lvl} ${how}: she comes back where she fell, not at the start`,
           !atStart && dx < 6, `died x=${Math.round(r.died.x/T)}t  back x=${Math.round(r.back.x/T)}t  start=${Math.round(r.startX/T)}t`);
      }
    }
  }
  ok('no page errors', errs.length === 0, errs.slice(0,2).join(' | '));
  await browser.close();
  console.log(R.join('\n'));
  const bad = R.filter(r => r.startsWith('FAIL')).length;
  console.log(`\n${R.length - bad} passed, ${bad} failed`);
  process.exit(bad ? 1 : 0);
})();
