/* DOES IT FILL THE SCREEN, ON A SCREEN THAT IS ACTUALLY BIG?

   Everything in here has been measured on a laptop and on a phone. A
   27-inch monitor and an ultrawide are neither: a layout that centres a
   fixed maximum looks deliberate at 1280 and looks like a postage
   stamp at 3440, and a stage sized from the HEIGHT gets very wide bands
   of nothing down the sides once the window is wider than 16:9.

   So, at every size a person is likely to have: how much of the window
   does the thing she is looking at actually use, is there anything she
   has to scroll to reach, and does any of it hang off the edge.

                                            node tools/bigscreen.js
*/
const { chromium } = require('playwright-core');

/* 4K AND ULTRAWIDE ARE BEHIND A FLAG, AND THE REASON IS THE CONTAINER.

   There is no GPU in here: every pixel is rasterised in software, and
   the cost is the pixel count. Measured at 3840x2160, one `goto` takes
   38 seconds and one showScreen 32 -- so the two biggest sizes alone
   are half an hour of a suite that otherwise runs in five minutes, and
   a run nobody has the patience for is a run nobody makes. What they
   would tell us is already told by 1920 and 2560: whether the
   composition grows with the window. Ask for them by name when you
   want them:   node tools/bigscreen.js huge                        */
const HUGE = process.argv[2] === 'huge';
const SIZES = [
  [1280, 800,  'laptop'],
  [1440, 900,  'laptop big'],
  [1512, 982,  'macbook 14'],
  [1920, 1080, 'desktop 1080p'],
  [2560, 1440, 'desktop 1440p'],
].concat(HUGE ? [[3440, 1440, 'ultrawide'], [3840, 2160, '4K']] : [])
 .concat([[1024, 1366, 'ipad pro upright'], [1366, 1024, 'ipad pro sideways']]);

/* what she is looking at on each screen, and the floor under how much of
   the window it is allowed to leave empty */
/* the floor is per shape, because a 16:9 stage in a 4:3 window CANNOT
   fill it -- the bands above and below are the picture's own shape, not
   a layout fault. A wide window is held to the higher figure. */
const SCREENS = [
  ['gate',      '.gate',        0.16, 0.16],
  ['scrapbook', '.sb-book',     0.45, 0.45],
  ['hub',       '.hub-wrap',    0.28, 0.20],
  /* the keepsake is a MANTELPIECE -- five photo cards in a row, 840 by
     204 -- so it can never fill a window by area the way a page does,
     and asking it to is asking for a different design. What matters for
     it is that it grows with the window and stays on it. */
  ['keepsake',  '.ks-wrap',     0.13, 0.09],
  ['quest',     '.hv-stage',    0.55, 0.40],
  ['ouissy',    '.so-stage',    0.55, 0.40],
  ['apoc',      '.ap-stage',    0.55, 0.40],
  ['race',      '.rc-stage',    0.55, 0.40],
  ['nightshift','.ns-stage',    0.55, 0.40],
  ['end',       '.night-sky',   0.90, 0.90],
];

/* the three that are a composition rather than a picture */
const GROWS = { gate: 1, hub: 1, keepsake: 1 };
const base = {};

let pass = 0, fail = 0;
const ok = (n, c, x) => { if (c) { pass++; } else { fail++;
  console.log('  FAIL ' + n + (x !== undefined ? '  ' + JSON.stringify(x) : '')); } };

(async () => {
  const b = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox', '--no-proxy-server', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  for (const [w, h, label] of SIZES) {
    const p = await b.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
    const errs = [];
    p.on('pageerror', (e) => errs.push(e.message.slice(0, 90)));
    await p.route('**/*', (r) => r.request().url().startsWith('http://127.0.0.1') ? r.continue() : r.abort());
    await p.goto('http://127.0.0.1:8899/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await p.waitForTimeout(1200);
    console.log('\n--- ' + label + '  ' + w + 'x' + h);
    for (const [name, sel, floorWide, floorTall] of SCREENS) {
      /* a chapter that is not in this tree is not a fault of it -- and
         asking for one used to bring the whole suite down on
         showScreen's `el.classList` */
      if (!(await p.evaluate((n) => !!document.getElementById('screen-' + n), name))) {
        console.log('   ' + name.padEnd(11) + 'not in this tree');
        continue;
      }
      const floor = w >= h ? floorWide : floorTall;
      await p.evaluate((n) => { showScreen(n); if (n === 'hub' && window.startHub) startHub(); }, name);
      /* EVERY SCREEN ARRIVES BY ANIMATION: screenIn slides it 14px up
         over .65s. This container paints about four frames a second, so
         that is still running seconds later, and a screen measured
         inside it starts 14px down and reports its own bottom edge as
         hanging off the window. Wait for the transform to come to rest
         -- and not on getAnimations().finished, which never settles
         here because half the site's animations are infinite. */
      await p.waitForFunction(() => {
        const s2 = document.querySelector('.screen.active');
        const t = s2 && getComputedStyle(s2).transform;
        return !t || t === 'none' || /matrix\(1,\s*0,\s*0,\s*1,\s*0,\s*0\)/.test(t);
      }, { timeout: 15000, polling: 200 }).catch(() => {});
      const r = await p.evaluate(([n, s]) => {
        return new Promise((done) => setTimeout(() => {
          const scr = document.querySelector('.screen.active');
          const el = scr && scr.querySelector(s);
          const vw = innerWidth, vh = innerHeight;
          const rr = el ? el.getBoundingClientRect() : null;
          done({
            found: !!el,
            box: rr ? [Math.round(rr.left), Math.round(rr.top), Math.round(rr.width), Math.round(rr.height)] : null,
            fill: rr ? +((rr.width * rr.height) / (vw * vh)).toFixed(3) : 0,
            off: rr ? (rr.left < -2 || rr.top < -2 || rr.right > vw + 2 || rr.bottom > vh + 2) : false,
            /* a page that scrolls sideways is a page that is too wide */
            scrollX: document.documentElement.scrollWidth > vw + 2,
            scrollY: document.documentElement.scrollHeight > vh + 2,
            /* and the two bands: how much window is left either side */
            side: rr ? Math.round((vw - rr.width) / 2) : 0,
            band: rr ? Math.round((vh - rr.height) / 2) : 0,
          });
        }, 650));
      }, [name, sel]);
      ok(label + ' ' + name + ': it is there', r.found);
      if (!r.found) continue;
      ok(label + ' ' + name + ': nothing hangs off the window', !r.off, r.box);
      ok(label + ' ' + name + ': the page does not scroll sideways', !r.scrollX);
      ok(label + ' ' + name + ': the page does not scroll down', !r.scrollY);
      /* WHAT "FILLS THE SCREEN" MEANS DEPENDS ON WHAT IT IS.

         A stage is a picture and is held to a share of the window. The
         gate, the hub and the keepsake are compositions with a fixed
         measure -- a 360pt sheet, a 620pt board -- and no share of a 4K
         window is the right answer for them: what has to be true is
         that they GROW with the window rather than sitting at their
         laptop size in the middle of it. So they are measured against
         themselves on a laptop. */
      if (GROWS[name]) {
        if (label === 'laptop') base[name] = r.box[2] * r.box[3];
        else if (base[name] && w >= 1400 && h >= 860) {
          /* 1.05, not 1.3: how much it CAN grow is the slack in the
             window less the margin it is told to keep, so at 1440x900
             -- the first size that grows at all -- the honest answer is
             a tenth, and at 1440x900 a tenth is right. What is being
             asserted is that it does not sit at its laptop size in the
             middle of a bigger window. */
          ok(label + ' ' + name + ': it grows with the window',
             (r.box[2] * r.box[3]) / base[name] >= 1.05,
             { times: +((r.box[2] * r.box[3]) / base[name]).toFixed(2), box: r.box });
        }
      } else {
        ok(label + ' ' + name + ': it uses the window it is given', r.fill >= floor,
           { fill: r.fill, floor: floor, box: r.box, sideBand: r.side, topBand: r.band });
      }
      console.log('   ' + name.padEnd(11) + (r.box[2] + 'x' + r.box[3]).padEnd(10)
                  + ' fills ' + (r.fill * 100).toFixed(0) + '%'
                  + '  bands ' + r.side + 'px either side, ' + r.band + 'px top and bottom'
                  + (r.scrollX ? '  SCROLLS SIDEWAYS' : '') + (r.scrollY ? '  SCROLLS DOWN' : ''));
    }
    const real = errs.filter((e) => !/ERR_FAILED|net::/.test(e));
    ok(label + ': nothing threw', !real.length, real.slice(0, 2));
    await p.close();
  }
  console.log('\n' + pass + ' passed, ' + fail + ' failed\n');
  await b.close();
  process.exit(fail ? 1 : 0);
})();
