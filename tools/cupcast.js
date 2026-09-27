/* THE TEAM PHOTOGRAPH, CLOSE UP.
 *
 * The match camera is a hundred units out, which is exactly the
 * distance at which a badly built head still looks fine. cupsquad.js
 * lines the whole roster up, but at 2x a 48-pixel character is 96
 * pixels and a face is nine of them -- big enough to check the
 * silhouette, nowhere near big enough to check the face. Only two of
 * the thirteen have ever been looked at this close.
 *
 * So this blows each of them up five times and lays out every facing,
 * front through profile to the back of the head, four characters to a
 * sheet, on a mid grey -- on white the rim light vanishes and on black
 * the outline does, and both have to be judged. It also counts the
 * colours each one uses, which is the palette discipline the bible
 * asks for, measured rather than asserted.
 *
 * It used to drive the 3D renderer that was removed with the
 * billboards, so it had been throwing on OuissyCup.__cup.three() for
 * as long as the sprites have existed.
 *
 *   node tools/cupcast.js [anim]        (default: idle)
 */
const { chromium } = require('playwright-core');
const anim = process.argv[2] || 'idle';
const PER_SHEET = 4;

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox', '--no-proxy-server'] });
  const p = await b.newPage({ viewport: { width: 1420, height: 1060 } });
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.route('**/*', r => r.request().url().startsWith('http://127.0.0.1') ? r.continue() : r.abort());
  await p.goto('http://127.0.0.1:8899/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForTimeout(500);
  /* the two files this needs and nothing else -- the chapter itself is
     not wanted, and loading it would start a match behind the sheet */
  await p.addScriptTag({ url: 'cup.config.js' });
  await p.addScriptTag({ url: 'cup.sprites.js' });
  await p.waitForFunction(() => !!window.CupSprites && !!window.CUP_CONFIG, { timeout: 20000 });

  const n = await p.evaluate(() => window.CUP_CONFIG.ROSTER.length);
  const sheets = Math.ceil(n / PER_SHEET);
  for (let s = 0; s < sheets; s++) {
    const info = await p.evaluate(({ anim, from, count }) => {
      const R = window.CUP_CONFIG.ROSTER, T = window.CUP_CONFIG.TEAMS;
      const cast = R.slice(from, from + count);
      const faces = ['s', 'se', 'e', 'ne', 'n'];
      const Z = 5;
      let S = 48, rows = [];
      cast.forEach((look) => {
        const team = T.filter(t => (t.squad || []).indexOf(look.id) >= 0)[0];
        const kit = team ? (look.role === 'gk' ? team.gkKit : team.kit) : null;
        const at = window.CupSprites.bake(look, kit);
        S = at.size;
        /* how many distinct colours this character actually uses */
        const px = at.canvas.getContext('2d')
          .getImageData(0, 0, at.canvas.width, at.canvas.height).data;
        const seen = new Set();
        for (let i = 0; i < px.length; i += 4) {
          if (px[i + 3] < 8) continue;
          seen.add((px[i] << 16) | (px[i + 1] << 8) | px[i + 2]);
        }
        rows.push({ look: look, at: at, colours: seen.size });
      });

      const lab = 86, cell = S * Z, gap = 6, head = 20;
      const cv = document.createElement('canvas');
      cv.width = lab + faces.length * (cell + gap);
      cv.height = rows.length * (cell + head) + 10;
      const x = cv.getContext('2d');
      x.imageSmoothingEnabled = false;
      x.fillStyle = '#6a7a6e';
      x.fillRect(0, 0, cv.width, cv.height);
      x.font = '13px monospace';

      rows.forEach((r, i) => {
        const y = 6 + i * (cell + head);
        x.fillStyle = '#f2f6f2';
        x.fillText(r.look.name + '  ' + r.look.role.toUpperCase(), 6, y + 14);
        x.fillStyle = '#d2dcd4';
        x.fillText(r.colours + ' colours', 6, y + 30);
        x.fillText(r.look.head, 6, y + 46);
        faces.forEach((f, c) => {
          const uv = r.at.uv(anim, f, 0);
          x.drawImage(r.at.canvas, uv.col * S, uv.row * S, S, S,
                      lab + c * (cell + gap), y + head, cell, cell);
          x.fillStyle = '#e8f0e8';
          x.fillText(f, lab + c * (cell + gap) + 2, y + head - 4);
        });
      });

      document.body.innerHTML = '';
      document.body.style.margin = '0';
      document.body.appendChild(cv);
      return { w: cv.width, h: cv.height,
               who: rows.map(r => r.look.name + '(' + r.colours + ')') };
    }, { anim, from: s * PER_SHEET, count: PER_SHEET });

    await p.waitForTimeout(150);
    const path = '/tmp/cup-cast-' + (s + 1) + '.png';
    await p.screenshot({ path: path,
      clip: { x: 0, y: 0, width: Math.min(1420, info.w), height: Math.min(1060, info.h) } });
    console.log('  ' + info.who.join('  ') + '  -> ' + path);
  }
  console.log(errs.length ? 'ERRORS: ' + errs.slice(0, 4).join(' | ') : 'no page errors');
  await b.close();
})();
