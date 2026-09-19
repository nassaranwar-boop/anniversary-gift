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

const SIZES = [
  [1280, 800,  'laptop'],
  [1440, 900,  'laptop big'],
  [1512, 982,  'macbook 14'],
  [1920, 1080, 'desktop 1080p'],
  [2560, 1440, 'desktop 1440p'],
  [3440, 1440, 'ultrawide'],
  [3840, 2160, '4K'],
  [1024, 1366, 'ipad pro upright'],
  [1366, 1024, 'ipad pro sideways'],
];

/* what she is looking at on each screen, and the floor under how much of
   the window it is allowed to leave empty */
const SCREENS = [
  ['gate',      '.gate',        0.16],
  ['scrapbook', '.sb-book',     0.45],
  ['hub',       '.hub-wrap',    0.28],
  ['keepsake',  '.ks-wrap',     0.28],
  ['quest',     '.hv-stage',    0.55],
  ['ouissy',    '.so-stage',    0.55],
  ['apoc',      '.ap-stage',    0.55],
  ['race',      '.rc-stage',    0.55],
  ['nightshift','.ns-stage',    0.55],
  ['end',       '.night-sky',   0.90],
];

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
    for (const [name, sel, floor] of SCREENS) {
      const r = await p.evaluate(([n, s]) => {
        showScreen(n);
        if (n === 'hub' && window.startHub) startHub();
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
      ok(label + ' ' + name + ': it uses the window it is given', r.fill >= floor,
         { fill: r.fill, floor: floor, box: r.box, sideBand: r.side, topBand: r.band });
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
