/* NOTHING MAY CHANGE THE SIZE OF A SCREEN.

   He watched the site open and said, four times, that it appears and then
   zooms in a bit. Two rules in the stylesheet were doing exactly that:
   screenIn arrived from scale(.97) and screenExit left at scale(1.06). As
   a transition that is polish; as the first thing you see when the site
   opens it reads as the page settling into the wrong size and correcting
   itself, which is indistinguishable from the viewport bug we spent four
   passes on and is why it kept looking unfixed.

   This samples the real computed transform of the active screen through a
   whole entry animation, at speed, and fails if any frame is scaled. It
   also checks the shell never changes height mid-animation, which is the
   other half of what he was seeing. */
const { chromium } = require('playwright-core');

let pass = 0, fail = 0;
const ok = (n, c, x) => { if (c) { pass++; console.log('PASS  ' + n + (x ? '   ' + x : '')); }
                          else { fail++; console.log('FAIL  ' + n + (x ? '   ' + x : '')); } };

/* the scale a matrix() actually applies, which is the only thing that matters
   here — a named keyframe can hide it behind a shorthand */
function scaleOf(matrix) {
  if (!matrix || matrix === 'none') return 1;
  const n = matrix.match(/matrix\(([^)]+)\)/);
  if (!n) {
    const m3 = matrix.match(/matrix3d\(([^)]+)\)/);
    if (!m3) return 1;
    const p = m3[1].split(',').map(Number);
    return Math.hypot(p[0], p[1]);
  }
  const p = n[1].split(',').map(Number);
  return Math.hypot(p[0], p[1]);     // length of the first column vector
}

(async () => {
  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'],
  });

  for (const [w, h, label] of [[1366, 892, 'ipad'], [390, 844, 'iphone']]) {
    const page = await browser.newPage({
      viewport: { width: w, height: h },
      isMobile: w < 900, hasTouch: w < 900,
    });
    await page.route('**/*', r => r.request().url().startsWith('http://127.0.0.1')
      ? r.continue() : r.abort());
    const errs = [];
    page.on('pageerror', e => errs.push(e.message));
    await page.goto('http://127.0.0.1:8899/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(2000);

    /* Do NOT sample with requestAnimationFrame. rAF runs at about 3fps in
       this container, so a .65s animation is over before the second frame
       and every sample comes back at rest — a test that would pass no
       matter what the animation did. Drive it through the Web Animations
       API instead: pause it and step currentTime, which gives the exact
       computed transform at each point regardless of clock speed. */
    async function sweep(kind) {
      return await page.evaluate(async (which) => {
        showScreen('gate');
        const el = document.querySelector('.screen.active');
        if (which === 'exit') { el.classList.remove('anim-in'); el.classList.add('page-turning'); }
        await new Promise(r => setTimeout(r, 40));
        const anims = el.getAnimations();
        if (!anims.length) return { none: true };
        const a = anims[0];
        a.pause();
        const dur = a.effect.getTiming().duration || 650;
        const out = [];
        for (let i = 0; i <= 20; i++) {
          a.currentTime = (dur * i) / 20;
          const cs = getComputedStyle(el);
          out.push({ t: cs.transform, h: Math.round(el.getBoundingClientRect().height) });
        }
        a.cancel();
        el.classList.remove('page-turning');
        return { name: a.animationName || '(unnamed)', frames: out };
      }, kind);
    }

    const entry = await sweep('enter');
    if (entry.none) {
      ok(label + ': an entry animation exists to be measured', false, 'none found on the screen');
    } else {
      const scales = entry.frames.map(f => scaleOf(f.t));
      const worst = scales.reduce((a, b) => Math.abs(b - 1) > Math.abs(a - 1) ? b : a, 1);
      ok(label + ': no point in the entry animation scales the screen',
         scales.every(s => Math.abs(s - 1) < 0.001),
         entry.name + ', worst scale ' + worst.toFixed(4));
      const heights = [...new Set(entry.frames.map(f => f.h))];
      ok(label + ': the screen keeps one height right through it',
         heights.length === 1, 'heights seen ' + heights.join(', '));
    }

    const exit = await sweep('exit');
    if (exit.none) {
      ok(label + ': an exit animation exists to be measured', false, 'none found');
    } else {
      const ex = exit.frames.map(f => scaleOf(f.t));
      const exWorst = ex.reduce((a, b) => Math.abs(b - 1) > Math.abs(a - 1) ? b : a, 1);
      ok(label + ': no point in the exit animation scales the screen',
         ex.every(s => Math.abs(s - 1) < 0.001),
         exit.name + ', worst scale ' + exWorst.toFixed(4));
    }

    ok(label + ': no page errors', errs.length === 0, errs[0] || '');
    await page.close();
  }

  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
