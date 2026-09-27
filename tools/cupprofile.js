/* THE SIDE VIEW, BIG ENOUGH TO ARGUE ABOUT.
 *
 * A profile is the hardest facing to draw and the easiest to fake: the
 * front drawing, narrowed, with the eyes slid across. Every fake reads
 * the same way -- the hair sits centred on the skull like a helmet
 * instead of massing behind the face, the chest has no depth, and both
 * feet point at the camera. None of that is visible at the size the
 * match draws them, which is why it survived.
 *
 * Front, three-quarter and profile side by side at eight times, two
 * characters to a sheet, so the three can be compared as drawings.
 *
 *   node tools/cupprofile.js [anim]        (default: idle)
 */
const { chromium } = require('playwright-core');
const anim = process.argv[2] || 'idle';
const PER_SHEET = 1;

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox', '--no-proxy-server'] });
  const p = await b.newPage({ viewport: { width: 1010, height: 360 } });
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.route('**/*', r => r.request().url().startsWith('http://127.0.0.1') ? r.continue() : r.abort());
  await p.goto('http://127.0.0.1:8899/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForTimeout(500);
  await p.addScriptTag({ url: 'cup.config.js' });
  await p.addScriptTag({ url: 'cup.sprites.js' });
  await p.waitForFunction(() => !!window.CupSprites && !!window.CUP_CONFIG, { timeout: 20000 });

  const only = process.argv.slice(3).filter(a => a[0] !== '-');
  const ids = await p.evaluate((only) => window.CUP_CONFIG.ROSTER
    .map(r => r.id).filter(id => !only.length || only.indexOf(id) >= 0), only);

  for (let s = 0; s * PER_SHEET < ids.length; s++) {
    const info = await p.evaluate(({ anim, ids }) => {
      const R = window.CUP_CONFIG.ROSTER, T = window.CUP_CONFIG.TEAMS;
      const cast = ids.map(id => R.filter(r => r.id === id)[0]);
      const faces = ['s', 'se', 'e'];
      const Z = 5;
      /* THE SPRITE IS 64, NOT 48. The canvas was sized off a literal
         and the cells drawn off at.size, so the third column -- the
         profile, the only one this tool exists for -- was laid out past
         the right edge of the screenshot and never appeared in it. */
      const S = window.CupSprites.SIZE;
      const cv = document.createElement('canvas');
      const head = 22;
      cv.width = 8 + faces.length * (S * Z + 8);
      cv.height = cast.length * (S * Z + head) + 8;
      const x = cv.getContext('2d');
      x.imageSmoothingEnabled = false;
      x.fillStyle = '#6a7a6e';
      x.fillRect(0, 0, cv.width, cv.height);
      x.font = '14px monospace';
      cast.forEach((look, i) => {
        const team = T.filter(t => (t.squad || []).indexOf(look.id) >= 0)[0];
        const kit = team ? (look.role === 'gk' ? team.gkKit : team.kit) : null;
        const at = window.CupSprites.bake(look, kit);
        const y = 4 + i * (S * Z + head);
        x.fillStyle = '#f2f6f2';
        x.fillText(look.name + '   hair: ' + look.head, 8, y + 15);
        faces.forEach((f, c) => {
          const uv = at.uv(anim, f, 0);
          x.drawImage(at.canvas, uv.col * S, uv.row * S, S, S,
                      8 + c * (S * Z + 8), y + head, S * Z, S * Z);
        });
      });
      document.body.innerHTML = '';
      document.body.style.margin = '0';
      document.body.appendChild(cv);
      return { w: cv.width, h: cv.height, who: cast.map(c => c.name) };
    }, { anim, ids: ids.slice(s * PER_SHEET, s * PER_SHEET + PER_SHEET) });

    await p.waitForTimeout(120);
    const path = '/tmp/cup-profile-' + (s + 1) + '.png';
    await p.screenshot({ path: path,
      clip: { x: 0, y: 0, width: Math.min(1010, info.w), height: Math.min(360, info.h) } });
    console.log('  ' + info.who.join('  ') + '  -> ' + path);
  }
  console.log(errs.length ? 'ERRORS: ' + errs.slice(0, 3).join(' | ') : 'no page errors');
  await b.close();
})();
