/* IS THERE A SOUND FOR EVERY THING THAT HAPPENS?
 *
 * You cannot listen to a harness, so this does the next best thing: it
 * counts the calls. Every entry in the sound bank is wrapped, a match
 * is played out, and afterwards the tally says which sounds a real
 * passage of football actually produced — and, more usefully, which
 * ones it never did.
 *
 * A sound that is defined and never fires is the same as a sound that
 * does not exist, and it is the failure mode you cannot hear: nothing
 * is wrong, there is simply nothing there. Footsteps were exactly that
 * for the whole of this chapter's life — a player ran the length of the
 * pitch in silence and the only evidence was that it felt cheap.
 *
 *   node tools/cupsfx.js
 */
const { chromium } = require('playwright-core');

let pass = 0, fail = 0;
const ok = (msg, cond, extra) => {
  if (cond) { pass++; console.log('  ok   ' + msg); }
  else { fail++; console.log('  FAIL ' + msg + (extra !== undefined ? '  ' + JSON.stringify(extra) : '')); }
};

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
  await p.waitForTimeout(400);
  await p.mouse.click(480, 400);          // the audio context wants a gesture

  const tally = await p.evaluate(() => {
    const H = OuissyCup.__cup;
    const bank = H.sfx();
    const count = {};
    Object.keys(bank).forEach(k => {
      const real = bank[k];
      count[k] = 0;
      bank[k] = function () { count[k]++; return real.apply(null, arguments); };
    });
    /* two full matches, driven, so shots and tackles actually happen */
    for (let round = 0; round < 2; round++) {
      H.quick(round); H.auto(true);
      for (let i = 0; i < 400 && H.state().state !== 'play'; i++) H.step(1, 0, 0, false);
      for (let t = 0; t < 3000; t++) {
        /* drive her about so the controlled-player paths run too */
        const a = t * 0.04;
        H.step(1, Math.cos(a), Math.sin(a * 0.7), (t % 140) > 130);
      }
    }
    return count;
  });

  const rows = Object.keys(tally).sort((a, c) => tally[c] - tally[a]);
  rows.forEach(k => console.log('   ' + k.padEnd(13) + String(tally[k]).padStart(6)));
  console.log('');

  /* the ones a passage of football cannot happen without */
  const must = ['step', 'kick', 'pass', 'shot', 'tackle', 'whistle', 'bounce'];
  must.forEach(k => ok('"' + k + '" is heard during a match', (tally[k] || 0) > 0, tally[k]));
  ok('footsteps keep pace with the play, without becoming a drum roll',
     tally.step > 120 && tally.step < 6000, tally.step);
  const silent = rows.filter(k => !tally[k]);
  console.log('   never fired in two matches: ' + (silent.join(', ') || 'none'));
  ok('no page errors', errs.length === 0, errs.slice(0, 3));
  console.log('');
  console.log(pass + ' passed, ' + fail + ' failed');
  await b.close();
  process.exit(fail ? 1 : 0);
})();
