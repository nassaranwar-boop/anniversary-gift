/* IS ONE END OF THE PITCH EASIER THAN THE OTHER?
 *
 * The one question a match harness cannot answer on its own. If her
 * side is being beaten, there are three quite different reasons it
 * might be, and they need different fixes:
 *
 *   the CODE   — something is written in terms of a signed axis and is
 *                only right for the team attacking one way. Real, and
 *                this tool found one: the keeper's "how far off his
 *                line may he come" clamp was written as a range of y
 *                rather than as a distance out, so for the side
 *                attacking down the pitch the two bounds came out as
 *                -2 and 0 and her keeper was pinned to his own goal
 *                line for the whole match, never once claiming a ball.
 *   the SQUAD  — the two teams are genuinely not equal.
 *   the LUCK   — a four-a-side half is chaotic and one early goal
 *                changes the shape of the rest of it.
 *
 * Swapping which team is which tells them apart in one run: an effect
 * that stays with the INDEX is the code, an effect that follows the
 * SQUAD is the teams, and an effect that does neither is the luck.
 *
 *   node tools/cupsides.js
 */
const { chromium } = require('playwright-core');

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox', '--no-proxy-server'] });
  const p = await b.newPage({ viewport: { width: 900, height: 560 } });
  p.on('pageerror', e => console.log('ERR', e.message));
  await p.route('**/*', r => r.request().url().startsWith('http://127.0.0.1') ? r.continue() : r.abort());
  await p.goto('http://127.0.0.1:8899/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForTimeout(900);
  await p.evaluate(() => { showScreen('hub'); startHub(); });
  await p.waitForTimeout(250);
  await p.click('#hub-card-cup');
  await p.waitForFunction(() => window.OuissyCup && OuissyCup.__cup.state() !== null, { timeout: 60000 });
  await p.waitForTimeout(500);

  const ratings = await p.evaluate(() => ['fmpm', 'um6p', 'uir', 'fmdc'].map((id) => {
    const t = OuissyCup.__cup.teamStats(id);
    return t ? '  ' + id + '  rating ' + t.rating + '  ' + JSON.stringify(t.stats) : '  ' + id + ' (none)';
  }));
  console.log('the squads:');
  ratings.forEach(r => console.log(r));
  console.log('');

  for (const round of [0, 1, 2]) {
    for (const swap of [false, true]) {
      const r = await p.evaluate(({ rd, sw }) => {
        const H = OuissyCup.__cup;
        H.quick(rd, sw); H.auto(true);
        for (let i = 0; i < 400 && H.state().state !== 'play'; i++) H.step(1, 0, 0, false);
        for (let i = 0; i < 2400; i++) H.step(1, 0, 0, false);
        const s = H.scout();
        return { shots: s.stat.shots, score: s.score,
                 poss: s.stat.poss.map(v => +v.toFixed(0)),
                 carry: [s.dbg[0].carry | 0, s.dbg[1].carry | 0],
                 gkHold: [s.dbg[0].gkHold | 0, s.dbg[1].gkHold | 0] };
      }, { rd: round, sw: swap });
      console.log('round ' + round + (swap ? '  SWAPPED' : '  normal ') +
                  '   score ' + r.score.join('-') +
                  '   shots ' + r.shots.join('-') +
                  '   carried ' + r.carry.join('/') + ' frames' +
                  '   keeper held ' + r.gkHold.join('/'));
    }
  }
  console.log('');
  console.log('read it like this: a number that stays on the same SIDE of the');
  console.log('slash when the row says SWAPPED is the code favouring an end;');
  console.log('one that crosses over is the squad; one that does neither is noise.');
  await b.close();
})();
