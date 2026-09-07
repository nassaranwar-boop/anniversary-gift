/* THE CONTROLS BELONG UNDER HER THUMBS.

   The pad used to be capped at 640px and centred, so on anything wider
   than a phone both clusters sat in the middle of the screen and both
   thumbs had to reach inwards for them. This measures where the buttons
   actually land on the sizes she plays on, and it measures the one thing
   she asked for besides: that nothing she presses mid-jump is anywhere
   near the pause button. */
const { chromium } = require('playwright-core');
let pass = 0, fail = 0;
const ok = (n, c, x) => { if (c) { pass++; console.log('  ok   ' + n); }
                          else { fail++; console.log('  FAIL ' + n + (x ? '  ' + JSON.stringify(x) : '')); } };

const SIZES = [
  ['iPad sideways',  { width: 1180, height: 820 }],
  ['iPad upright',   { width: 820, height: 1180 }],
  ['iPhone sideways',{ width: 844, height: 390 }],
  ['iPhone upright', { width: 390, height: 844 }],
];
const CLEAR = 44;                     /* a fingertip, in CSS pixels */

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--use-gl=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--no-sandbox'] });
  const errs = [];
  for (const [label, vp] of SIZES) {
    const p = await b.newPage({ viewport: vp, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    p.on('pageerror', e => errs.push(label + ': ' + e.message));
    await p.route('**', r => (r.request().url().startsWith('http://localhost') ? r.continue() : r.abort()));
    await p.goto('http://localhost:8899/index.html', { waitUntil: 'domcontentloaded' });
    await p.waitForFunction(() => !!window.SuperOuissy, { timeout: 40000 });
    await p.evaluate(() => { showScreen('ouissy'); SuperOuissy.start(); });
    await p.waitForTimeout(900);
    /* into a level: the pause button is hidden until one is running, and
       it is the whole point of the last assertion below. PLAY, then the
       world card, the way she gets there. */
    for (let i = 0; i < 6; i++) {
      const went = await p.evaluate(() => {
        const b = document.querySelector('#so-play, .so-card-go, #so-how-ok, .so-btn-go');
        if (b) { b.click(); return true; }
        return false;
      });
      await p.waitForTimeout(700);
      if (await p.evaluate(() => { const st = document.querySelector('.so-stage');
                                   return st && !st.classList.contains('so-nolevel'); })) break;
      if (!went) break;
    }
    await p.waitForTimeout(900);

    const r = await p.evaluate(() => {
      const box = el => { const b = el.getBoundingClientRect();
                          return { l: Math.round(b.left), r: Math.round(b.right),
                                   t: Math.round(b.top), b: Math.round(b.bottom) }; };
      const keys = {};
      document.querySelectorAll('[data-so-key]').forEach(k => { keys[k.dataset.soKey] = box(k); });
      const pause = document.getElementById('so-pause-btn');
      return { keys: keys, pause: pause && pause.offsetParent !== null ? box(pause) : null,
               W: innerWidth, padVisible: !!document.querySelector('[data-so-key]').offsetParent };
    });

    if (!r.padVisible) { await p.close(); continue; }
    const third = r.W / 3;
    console.log('\n== ' + label + '  ' + vp.width + 'x' + vp.height);
    console.log('   left ' + JSON.stringify(r.keys.left) + '  jump ' + JSON.stringify(r.keys.jump));
    console.log('   pause ' + JSON.stringify(r.pause) + '  of ' + r.W + ' wide');

    ok(label + ': the directions are under the left thumb',
       r.keys.left.l < third && r.keys.right.r < third * 1.15,
       { left: r.keys.left.l, right: r.keys.right.r, third: Math.round(third) });
    ok(label + ': jump and duck are under the right thumb',
       r.keys.jump.r > r.W - third && r.keys.down.l > r.W - third * 1.15,
       { jump: r.keys.jump.r, duck: r.keys.down.l, from: Math.round(r.W - third) });

    /* and the thing she actually asked for */
    ok(label + ': and the pause button is on screen to be checked against', !!r.pause, r.pause);
    if (r.pause) {
      const gap = (k) => {
        const dx = Math.max(0, Math.max(r.pause.l - k.r, k.l - r.pause.r));
        const dy = Math.max(0, Math.max(r.pause.t - k.b, k.t - r.pause.b));
        return Math.round(Math.hypot(dx, dy));
      };
      const worst = Object.entries(r.keys)
        .map(([n, k]) => ({ key: n, gap: gap(k) }))
        .sort((a, c) => a.gap - c.gap)[0];
      ok(label + ': no control is within a fingertip of the pause button',
         worst.gap >= CLEAR, { nearest: worst });
    }
    await p.close();
  }
  ok('no page errors from any of it', errs.length === 0, errs.slice(0, 3));
  console.log('');
  console.log(pass + ' passed, ' + fail + ' failed');
  await b.close();
  process.exit(fail ? 1 : 0);
})();
