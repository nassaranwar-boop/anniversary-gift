/* SIX GROUNDS, SO YOU CAN SEE THEY ARE SIX GROUNDS.
 *
 * A per-team stadium system is only worth having if the grounds
 * actually look different, and "looks different" is the kind of claim
 * that is easy to believe about your own work. So this photographs the
 * same moment at each team's home ground, from the same camera, with
 * nothing changing but whose ground it is.
 *
 * And then it does the harder thing: it TAKES THE COLOUR OUT and asks
 * whether they are still six grounds.
 *
 * That is the test worth having, because colour is the cheap answer.
 * Six stadiums that differ only in the hex of their seats are one
 * stadium photographed six times, and the eye knows it immediately even
 * when it cannot say why — because the silhouette is identical, and
 * silhouette is how you recognise a place from a distance. So every
 * pair is compared in luminance only, over the top of the frame where
 * the architecture is: how many tiers, whether there is a roof, what
 * shape it is, whether the light comes off it.
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

  const shots = {};
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
    /* the architecture, in luminance, from the renderer's own canvas
       so the HUD and the players are not in the comparison */
    shots[t.id] = await p.evaluate(() => {
      const R = OuissyCup.__cup.r2();
      const top = Math.max(1, R.groundTop());
      const d = R.ctx.getImageData(0, 0, R.vw, top).data;
      const out = new Array(d.length / 4);
      for (let i = 0; i < out.length; i++) {
        out[i] = Math.round(0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2]);
      }
      return { lum: out, w: R.vw, h: top };
    });
    console.log('  ' + t.short.padEnd(6) + ' @' + (t.venue || '?').padEnd(11)
      + (t.stadium ? '  mow ' + t.stadium.mow + ' x' + t.stadium.mowWidth
        + '  density ' + t.stadium.density + '  ' + (t.stadium.backdrop || '-')
        + '  ' + (t.stadium.lighting || '-') : '  (no stadium block)')
      + '   -> /tmp/ground-' + t.id + '.png');
  }
  /* ------------------------------------------- are they six, or one? */
  console.log('');
  console.log('  with the colour taken out, how much of the architecture differs:');
  const ids = teams.map(t => t.id);
  let worst = 1, worstPair = null, fail = 0;
  const head = '        ' + ids.map(i => i.padStart(6)).join('');
  console.log(head);
  for (const a of ids) {
    let row = '  ' + a.padEnd(6);
    for (const b2 of ids) {
      if (a === b2) { row += '     \u2014'; continue; }
      const A = shots[a], B = shots[b2];
      const n = Math.min(A.lum.length, B.lum.length);
      let diff = 0;
      for (let i = 0; i < n; i++) if (Math.abs(A.lum[i] - B.lum[i]) > 12) diff++;
      const pc = diff / n;
      if (pc < worst) { worst = pc; worstPair = a + '/' + b2; }
      row += (100 * pc).toFixed(0).padStart(6);
    }
    console.log(row);
  }
  console.log('');
  /* THE BAR. Two grounds that share a tier plan, a roof and a light
     source still differ in their crowd, their backdrop and their
     density, so a fifth of the picture is a floor rather than a
     target — but below that they are one stadium with the lights
     changed. */
  if (worst < 0.20) {
    console.log('  FAIL the closest pair is ' + worstPair + ' at '
                + (100 * worst).toFixed(0) + '% \u2014 too alike to be two places');
    fail++;
  } else {
    console.log('  ok   even the closest pair (' + worstPair + ') differs in '
                + (100 * worst).toFixed(0) + '% of its architecture');
  }
  console.log(errs.length ? 'PAGE ERRORS: ' + JSON.stringify(errs.slice(0, 3)) : '  no page errors');
  console.log('DONE');
  await b.close();
  process.exit(fail || errs.length ? 1 : 0);
})();
