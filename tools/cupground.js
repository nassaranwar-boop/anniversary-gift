/* TWO GROUNDS, SO YOU CAN SEE THEY ARE TWO GROUNDS.
 *
 * A per-team stadium system is only worth having if the grounds
 * actually look different, and "looks different" is the kind of claim
 * that is easy to believe about your own work. So this photographs the
 * same moment at each team's home ground, from the same camera, with
 * nothing changing but whose ground it is.
 *
 *   node tools/cupground.js
 */
const { chromium } = require('playwright-core');

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox', '--no-proxy-server', '--autoplay-policy=no-user-gesture-required'] });
  const p = await b.newPage({ viewport: { width: 960, height: 540 } });
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.route('**/*', r => r.request().url().startsWith('http://127.0.0.1') ? r.continue() : r.abort());
  await p.goto('http://127.0.0.1:8899/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForTimeout(900);
  await p.evaluate(() => { try { localStorage.clear(); } catch (e) {} showScreen('hub'); startHub(); });
  await p.waitForTimeout(250);
  await p.click('#hub-card-cup');
  await p.waitForFunction(() => window.OuissyCup && OuissyCup.__cup.state() !== null, { timeout: 60000 });
  await p.waitForTimeout(600);

  const teams = await p.evaluate(() => OuissyCup.__cup.teams().map(t => ({
    id: t.id, short: t.short, venue: t.venue, stadium: t.stadium || null })));

  for (const t of teams) {
    await p.evaluate((tid) => {
      const H = OuissyCup.__cup;
      H.quick(0); H.auto(true);
      for (let i = 0; i < 400 && H.state().state !== 'play'; i++) H.step(1, 0, 0, false);
      /* the same moment at every ground: ball on the spot, camera on it */
      const g = H.geometry().pitch;
      H.put(g.cx, g.cy, 0);
      for (let i = 0; i < 30; i++) H.step(1, 0, 0, false);
      H.ground(tid);
      H.camSnap(); H.render();
    }, t.id);
    await p.waitForTimeout(700);
    await p.screenshot({ path: '/tmp/ground-' + t.id + '.png' });
    console.log('  ' + t.short.padEnd(6) + ' @' + (t.venue || '?').padEnd(11)
      + (t.stadium ? '  mow ' + t.stadium.mow + ' x' + t.stadium.mowWidth
        + '  density ' + t.stadium.density + '  ' + (t.stadium.backdrop || '-')
        + '  ' + (t.stadium.lighting || '-') : '  (no stadium block)')
      + '   -> /tmp/ground-' + t.id + '.png');
  }
  console.log(errs.length ? 'PAGE ERRORS: ' + JSON.stringify(errs.slice(0, 3)) : '  no page errors');
  console.log('DONE');
  await b.close();
})();
