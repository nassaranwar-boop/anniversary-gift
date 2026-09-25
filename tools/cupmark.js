/* WHY A MARKER IS ON THE WRONG SIDE.
 *
 * cupmatch says a marker is the wrong side of his man 40% of the time
 * in his own half, and that the failure is concentrated on one fixture
 * — round 2, the final, the strongest opponent — where it runs at 68%
 * while round 1 sits at 18%. That is a shape, not noise, and a single
 * percentage cannot say what is wrong with it.
 *
 * There are only two ways to be on the wrong side, and they want
 * opposite fixes:
 *
 *   THE TARGET IS WRONG. He is standing where the code told him to
 *   stand and that place is not goal-side. Fixing his legs would not
 *   help; the aiming point has to move.
 *
 *   HE CANNOT GET THERE. The target is goal-side and he is nowhere near
 *   it, because the man he is marking is quicker than he is or because
 *   he keeps being sent somewhere else. Moving the aiming point would
 *   change nothing; what has to change is the chase.
 *
 * So this reports both, per fixture, along with the pace difference
 * between the markers and the men they are marking.
 *
 *   node tools/cupmark.js
 */
const { chromium } = require('playwright-core');

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox', '--no-proxy-server', '--autoplay-policy=no-user-gesture-required'] });
  const p = await b.newPage({ viewport: { width: 640, height: 360 } });
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

  const rounds = [0, 1, 2, 0, 1, 2];
  const all = [];
  for (const r of rounds) {
    const out = await p.evaluate((rd) => {
      const H = OuissyCup.__cup;
      H.quick(rd); H.auto(true);
      for (let i = 0; i < 400 && H.state().state !== 'play'; i++) H.step(1, 0, 0, false);
      const g = H.geometry().pitch;
      const acc = {
        n: 0, wrong: 0,
        /* of the wrong-side frames, how many had a goal-side target */
        targetGood: 0, targetBad: 0,
        /* how far he was from that target when wrong-side */
        missSum: 0,
        /* and when he was RIGHT-side, for a baseline */
        okMissSum: 0, okN: 0,
        /* pace, marker against man, over wrong-side frames */
        spdMk: 0, spdMan: 0,
        /* how far away the MAN himself was */
        manSum: 0, okManSum: 0,
        /* and how often the assignment changed hands at all */
        changes: 0, seen: 0,
      };
      const lastMark = {};
      for (let t = 0; t < 3400; t++) {
        H.step(1, 0, 0, false);
        if (H.state().state !== 'play') continue;
        const s = H.scout();
        if (!s || !s.owner) continue;
        const def = 1 - s.owner.team;
        const gk = s.players.find(q => q.gk && q.t === def);
        if (!gk) continue;
        s.players.forEach(q => {
          if (q.t !== def || q.gk || q.job !== 'mark' || q.mark < 0) return;
          const m = s.players[q.mark];
          if (!m || !q.want) return;
          if (Math.abs(m.y - gk.y) > 205) return;
          acc.n++;
          const key = q.i;
          acc.seen++;
          if (lastMark[key] !== undefined && lastMark[key] !== q.mark) acc.changes++;
          lastMark[key] = q.mark;
          const toGoal = Math.sign(gk.y - m.y);
          const wrong = Math.sign(q.y - m.y) !== toGoal;
          const miss = Math.hypot(q.x - q.want[0], q.y - q.want[1]);
          const toMan = Math.hypot(q.x - m.x, q.y - m.y);
          if (!wrong) { acc.okN++; acc.okMissSum += miss; acc.okManSum += toMan; return; }
          acc.wrong++;
          acc.missSum += miss;
          acc.manSum += toMan;
          acc.spdMk += q.spd; acc.spdMan += m.spd;
          /* was the TARGET goal-side of the man, even though he was not? */
          if (Math.sign(q.want[1] - m.y) === toGoal) acc.targetGood++;
          else acc.targetBad++;
        });
      }
      const pc = (a, t) => t ? +(a / t * 100).toFixed(1) : 0;
      return {
        round: rd,
        samples: acc.n,
        wrongPct: pc(acc.wrong, acc.n),
        /* of the wrong-side frames: */
        targetWasGoalSidePct: pc(acc.targetGood, acc.wrong),
        missWhenWrong: acc.wrong ? +(acc.missSum / acc.wrong).toFixed(1) : 0,
        missWhenRight: acc.okN ? +(acc.okMissSum / acc.okN).toFixed(1) : 0,
        manWhenWrong: acc.wrong ? +(acc.manSum / acc.wrong).toFixed(1) : 0,
        manWhenRight: acc.okN ? +(acc.okManSum / acc.okN).toFixed(1) : 0,
        markChangesPerSec: acc.seen ? +(acc.changes / acc.seen * 60).toFixed(2) : 0,
        paceMarker: acc.wrong ? +(acc.spdMk / acc.wrong).toFixed(3) : 0,
        paceMan: acc.wrong ? +(acc.spdMan / acc.wrong).toFixed(3) : 0,
      };
    }, r);
    console.log(JSON.stringify(out));
    all.push(out);
  }

  const sum = (k) => all.reduce((a, o) => a + o[k] * o.samples, 0) / all.reduce((a, o) => a + o.samples, 0);
  console.log('');
  console.log('   wrong-side overall: ' + sum('wrongPct').toFixed(1) + '%');
  console.log('   of those, the TARGET was goal-side: ' + sum('targetWasGoalSidePct').toFixed(1) + '%');
  console.log('   distance from target when wrong-side: ' + sum('missWhenWrong').toFixed(1)
              + '   when right-side: ' + sum('missWhenRight').toFixed(1));
  console.log('   distance to the MAN when wrong-side: ' + sum('manWhenWrong').toFixed(1)
              + '   when right-side: ' + sum('manWhenRight').toFixed(1));
  console.log('   the mark changes hands ' + sum('markChangesPerSec').toFixed(2) + ' times a second');
  console.log('   pace, marker ' + sum('paceMarker').toFixed(3) + ' vs man ' + sum('paceMan').toFixed(3));
  console.log(errs.length ? 'PAGE ERRORS: ' + JSON.stringify(errs.slice(0, 4)) : 'no page errors');
  console.log('DONE');
  await b.close();
})();
