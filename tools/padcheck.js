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
  /* AND NOTHING SITS ON TOP OF ANYTHING ELSE, IN ANY GAME, AT ANY SIZE.
     Buttons only: a joystick zone or a steering surface is deliberately
     large and lies UNDER the buttons, which is not the fault being looked
     for. Two things you can press occupying the same pixels is. */
  const SWEEP = [['iPad sideways', { width: 1180, height: 820 }],
                 ['iPhone sideways', { width: 844, height: 390 }],
                 ['laptop', { width: 1280, height: 800 }]];
  for (const [label, vp] of SWEEP) {
    const p = await b.newPage({ viewport: vp, deviceScaleFactor: 2,
                                isMobile: vp.width < 1100, hasTouch: vp.width < 1100 });
    p.on('pageerror', e => errs.push(label + ': ' + e.message));
    await p.route('**', r => (r.request().url().startsWith('http://localhost') ? r.continue() : r.abort()));
    await p.goto('http://localhost:8899/index.html', { waitUntil: 'domcontentloaded' });
    await p.waitForFunction(() => !!(window.SuperOuissy && window.Apocalypse && window.SuperOuissyRace),
                            { timeout: 40000 });
    for (const [chapter, go] of [['Super Ouissy', () => { showScreen('ouissy'); SuperOuissy.start(); }],
                                 ['the apocalypse', () => { showScreen('apoc'); Apocalypse.start(); }],
                                 ['the race', () => { showScreen('race'); SuperOuissyRace.start(); }]]) {
      await p.evaluate(go);
      await p.waitForTimeout(1400);
      for (let i = 0; i < 5; i++) {
        const went = await p.evaluate(() => {
          const q = document.querySelector('.screen.active .so-btn-go, .screen.active .ap-card-go, ' +
                                           '.screen.active .rc-btn-go, .screen.active #so-play, ' +
                                           '.screen.active #so-how-ok');
          if (q) { q.click(); return true; }
          return false;
        });
        await p.waitForTimeout(600);
        if (!went) break;
      }
      const hits = await p.evaluate(() => {
        const on = [];
        document.querySelectorAll('.screen.active button').forEach(el => {
          if (!el.offsetParent) return;
          const st = getComputedStyle(el);
          if (st.pointerEvents === 'none' || st.visibility === 'hidden' || +st.opacity === 0) return;
          /* checkVisibility walks the ancestors, which is the only way to
             notice the apocalypse's four keys: they are real buttons in a
             container that is opacity:0 and height:0, because on a touch
             screen the stick over the picture replaces them. They are not
             on screen and stacking them is not a fault. */
          if (el.checkVisibility && !el.checkVisibility({ opacityProperty: true,
                                                          visibilityProperty: true })) return;
          const r = el.getBoundingClientRect();
          if (r.width < 4 || r.height < 4) return;
          if (r.right < 0 || r.bottom < 0 || r.left > innerWidth || r.top > innerHeight) return;
          /* and it has to be the thing you actually hit when you press it */
          const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
          if (!top || !(top === el || el.contains(top))) return;
          on.push({ id: el.id || el.className.split(' ')[0] || el.tagName, r: r });
        });
        const bad = [];
        for (let i = 0; i < on.length; i++)
          for (let j = i + 1; j < on.length; j++) {
            const a = on[i].r, c = on[j].r;
            const w = Math.min(a.right, c.right) - Math.max(a.left, c.left);
            const h = Math.min(a.bottom, c.bottom) - Math.max(a.top, c.top);
            if (w > 1 && h > 1) bad.push(on[i].id + ' over ' + on[j].id +
                                         ' by ' + Math.round(w) + 'x' + Math.round(h));
          }
        return { count: on.length, bad: bad };
      });
      ok(label + ' / ' + chapter + ': no two buttons share the same pixels',
         hits.bad.length === 0, hits.bad.length ? { of: hits.count, overlapping: hits.bad.slice(0, 4) } : null);
    }
    await p.close();
  }

  ok('no page errors from any of it', errs.length === 0, errs.slice(0, 3));
  console.log('');
  console.log(pass + ' passed, ' + fail + ' failed');
  await b.close();
  process.exit(fail ? 1 : 0);
})();
