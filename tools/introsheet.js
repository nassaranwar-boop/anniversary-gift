/* THE OPENING, FRAME BY FRAME — AND ONE RULE ABOUT IT.

   __bookCapture.frame(t) renders a deterministic frame of the intro at a
   chosen second, so the opening can be looked at rather than described,
   and __bookCapture.state() says where the cover is and what is on the
   grass at that instant.

   THE RULE: the left-hand page stack rests ON the opened front cover --
   its base sits one cover-thickness off the ground. So it may not be on
   screen while the cover is still up in the air, or it is a loose sheet
   of parchment lying on a lawn a book's width from the spine. It was
   exactly that for a long time: revealed at fifty-eight degrees, five
   millimetres thick, and the first thing anybody saw of this site.

   Usage:  node introsheet.js                 walk it and judge it
           node introsheet.js /tmp/out        ...and write a png per beat
           node introsheet.js /tmp/out 1.2    ...just that second
*/
const { chromium } = require('playwright-core'); const fs = require('fs');
const outdir = process.argv[2] || null;
const times = process.argv.slice(3).map(Number);

/* the cover must be at least this far over before anything may appear on
   the ground to the left of the spine. 125 degrees is well past vertical
   and leaning over that patch of grass. */
const COVER_MIN_DEG = 125;

let pass = 0, fail = 0;
const ok = (n, c, x) => { if (c) { pass++; console.log('  ok   ' + n + (x ? '  ' + x : '')); }
                          else { fail++; console.log('  FAIL ' + n + (x ? '  ' + x : '')); } };

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox','--no-proxy-server','--use-gl=swiftshader',
           '--enable-unsafe-swiftshader','--font-render-hinting=none'] });
  const page = await browser.newPage({ viewport: { width: 1180, height: 760 }, deviceScaleFactor: 1 });
  const errs = [];
  page.on('pageerror', e => { errs.push(e.message); console.log('PAGEERROR', e.message); });
  await page.route('**/*', r => {
    const u = r.request().url();
    if (u.startsWith('http://127.0.0.1')) return r.continue();
    if (u.includes('fonts.g')) return r.continue();
    return r.abort();
  });
  await page.goto('http://127.0.0.1:8899/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => window.__bookCapture && window.__bookCapture.ready, null, { timeout: 40000 });
  const TL = await page.evaluate(() => window.__bookCapture.timeline);
  console.log('timeline ' + JSON.stringify(TL));

  const at = async (t) => {
    await page.evaluate((tt) => window.__bookCapture.frame(2.0 + tt), t);
    return page.evaluate(() => window.__bookCapture.state());
  };

  /* ---- walk the whole opening closely ---- */
  const walk = [];
  for (let t = 0; t <= TL.climaxStart; t += 0.05) walk.push(+t.toFixed(2));
  const bad = [];
  let firstSeen = null, poppedAt = null, lastThick = 0;
  for (const t of walk) {
    const st = await at(t);
    if (st.leftStack) {
      if (firstSeen === null) firstSeen = { t, st };
      if (st.coverDeg < COVER_MIN_DEG) bad.push(t + 's: cover only ' + st.coverDeg + 'deg');
      /* and it must arrive by growing, not by appearing at full size */
      if (poppedAt === null && lastThick === 0 && st.leftThick > 0.0035) {
        poppedAt = t + 's at ' + st.leftThick;
      }
      lastThick = st.leftThick;
    }
  }
  ok('nothing lies on the grass while the cover is still in the air',
     bad.length === 0, bad.slice(0, 4).join(' | '));
  ok('the left-hand stack arrives by growing, not by popping in',
     poppedAt === null, poppedAt || '');
  ok('and it does arrive', firstSeen !== null,
     firstSeen ? 'at ' + firstSeen.t + 's, cover ' + firstSeen.st.coverDeg + 'deg' : 'never');

  /* ---- and the opening still gets where it is going ---- */
  const end = await at(TL.climaxStart);
  ok('the cover is flat on the grass by the climax', end.coverDeg > 179, end.coverDeg + 'deg');
  ok('the pages have fanned across', end.heroPages > 0, end.heroPages + ' in the air or landed');
  ok('and the left stack has real thickness under them', end.leftThick > 0.02, end.leftThick + '');
  ok('nothing threw', errs.length === 0, errs.slice(0, 2).join(' | '));

  /* ---- pictures, if asked for ---- */
  if (outdir) {
    fs.mkdirSync(outdir, { recursive: true });
    const cdp = await page.context().newCDPSession(page);
    const list = times.length ? times : [0.3, 0.8, 1.0, 1.2, 1.4, 1.6, 1.8, 2.0, 2.3, 2.6, 3.0];
    console.log('');
    for (const t of list) {
      const st = await at(t);
      const { data } = await cdp.send('Page.captureScreenshot', { format: 'png' });
      const name = 'intro-' + String(t).replace('.', '_') + '.png';
      fs.writeFileSync(`${outdir}/${name}`, Buffer.from(data, 'base64'));
      console.log('  t+' + t.toFixed(2) + 's  ' + JSON.stringify(st) + '  -> ' + name);
    }
  }

  console.log('');
  console.log(fail ? pass + ' passed, ' + fail + ' FAILED' : 'all ' + pass + ' checks passed');
  await browser.close();
  process.exit(fail ? 1 : 0);
})();
