/* DOES THE PICTURE FILL THE FRAME?
 *
 * present() blits a fixed 480x270 buffer at a WHOLE-NUMBER scale and
 * centres it, filling whatever is left over with the roof colour. That
 * is exact at 960x540 — which is the size every other harness runs at,
 * which is why nobody has ever seen it go wrong. At any other size the
 * picture is either letterboxed inside the frame or cropped by it.
 *
 * This measures the waste at the sizes people actually have.
 *
 *   node tools/cupfit.js
 */
const { chromium } = require('playwright-core');

const SIZES = [
  ['harness 960x540', 960, 540],
  ['laptop 1280x720', 1280, 720],
  ['laptop 1440x900', 1440, 900],
  ['desktop 1920x1080', 1920, 1080],
  ['phone landscape 844x390', 844, 390],
  ['phone portrait 390x844', 390, 844],
];

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox', '--no-proxy-server', '--autoplay-policy=no-user-gesture-required'] });
  const p = await b.newPage({ viewport: { width: 960, height: 540 } });
  await p.route('**/*', r => r.request().url().startsWith('http://127.0.0.1') ? r.continue() : r.abort());
  await p.goto('http://127.0.0.1:8899/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForTimeout(900);
  await p.evaluate(() => { try { localStorage.clear(); } catch (e) {} showScreen('hub'); startHub(); });
  await p.waitForTimeout(250);
  await p.click('#hub-card-cup');
  await p.waitForFunction(() => window.OuissyCup && OuissyCup.__cup.state() !== null, { timeout: 60000 });
  await p.waitForTimeout(600);

  console.log('  window            canvas      scale  picture     wasted');
  for (const [name, w, h] of SIZES) {
    await p.setViewportSize({ width: w, height: h });
    await p.waitForTimeout(500);
    const m = await p.evaluate(() => {
      const c = document.getElementById('cup-canvas');
      const R = OuissyCup.__cup.r2();
      const s = Math.max(1, Math.floor(Math.min(c.width / R.vw, c.height / R.vh)));
      const pw = R.vw * s, ph = R.vh * s;
      const shown = Math.min(pw, c.width) * Math.min(ph, c.height);
      return { cw: c.width, ch: c.height, vw: R.vw, vh: R.vh, s: s, pw: pw, ph: ph,
               wasted: +(100 - shown / (c.width * c.height) * 100).toFixed(0),
               cropped: pw > c.width || ph > c.height };
    });
    console.log('  ' + name.padEnd(18) + (m.cw + 'x' + m.ch).padEnd(12)
                + ('x' + m.s).padEnd(7) + (m.pw + 'x' + m.ph).padEnd(12)
                + (m.cropped ? 'CROPPED by ' + (m.pw - m.cw) + 'x' + (m.ph - m.ch)
                             : m.wasted + '% dead frame'));
  }
  console.log('DONE');
  await b.close();
})();
