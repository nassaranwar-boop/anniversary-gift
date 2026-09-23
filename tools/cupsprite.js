/* THE SPRITE SHEET, ON ITS OWN.
 *
 * Judging a 48-pixel character by looking at it on a pitch a hundred
 * units away is judging it through the wrong end of a telescope. This
 * bakes one character and lays every facing and every animation out as
 * a contact sheet, blown up so each pixel is visible, so the drawing can
 * be fixed before any of it is wired into the 3D world.
 *
 *   node tools/cupsprite.js [id]        (default: ouissy)
 */
const { chromium } = require('playwright-core');
const who = process.argv[2] || 'ouissy';
const anim = process.argv[3] || 'run';

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox', '--no-proxy-server'] });
  const p = await b.newPage({ viewport: { width: 1560, height: 1040 } });
  p.on('pageerror', e => console.log('ERR', e.message));
  p.on('console', m => { if (m.type() === 'error') console.log('CONSOLE', m.text()); });
  await p.route('**/*', r => r.request().url().startsWith('http://127.0.0.1') ? r.continue() : r.abort());
  await p.goto('http://127.0.0.1:8899/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForTimeout(600);
  /* only the two scripts this needs — the chapter itself is not wanted */
  await p.addScriptTag({ url: 'cup.config.js' });
  await p.addScriptTag({ url: 'cup.sprites.js' });
  await p.waitForFunction(() => !!window.CupSprites && !!window.CUP_CONFIG, { timeout: 20000 });

  const info = await p.evaluate(({ id, anim }) => {
    const look = window.CUP_CONFIG.ROSTER.filter(r => r.id === id)[0];
    if (!look) return { error: 'no such character: ' + id };
    const team = window.CUP_CONFIG.TEAMS.filter(
      t => (t.squad || []).indexOf(id) >= 0)[0];
    const kit = team ? (look.role === 'gk' ? team.gkKit : team.kit) : null;

    const t0 = performance.now();
    const at = window.CupSprites.bake(look, kit);
    const ms = performance.now() - t0;

    /* ONE ANIMATION, FACINGS DOWN THE ROWS.

       The first layout ran every animation across in one row, which at
       any readable zoom meant only the first facing ever fitted on the
       screen — so the one thing it was built to show, whether the five
       facings actually differ, was the one thing it could not show. */
    const S = at.size, Z = 4;
    const faces = ['s', 'se', 'e', 'ne', 'n'];
    const n = at.anims[anim] || 4;
    const cv = document.createElement('canvas');
    cv.width = 64 + n * S * Z;
    cv.height = 24 + faces.length * (S * Z + 6);
    const x = cv.getContext('2d');
    x.imageSmoothingEnabled = false;
    /* a mid grey: on white the rim light vanishes and on black the
       outline does, and both have to be judged */
    x.fillStyle = '#6a7a6e';
    x.fillRect(0, 0, cv.width, cv.height);
    x.font = '13px monospace';
    x.fillStyle = '#fff';
    x.fillText(look.name + '  /  ' + anim, 6, 15);
    faces.forEach((f, fi) => {
      const y = 24 + fi * (S * Z + 6);
      x.fillStyle = '#e8f0e8';
      x.fillText(f, 8, y + 24);
      for (let fr = 0; fr < n; fr++) {
        const uv = at.uv(anim, f, fr);
        x.drawImage(at.canvas, uv.col * S, uv.row * S, S, S,
                    62 + fr * S * Z, y, S * Z, S * Z);
      }
    });
    document.body.innerHTML = '';
    document.body.style.margin = '0';
    document.body.appendChild(cv);

    /* how many distinct colours the character actually uses, which is
       the palette discipline the brief asks for, measured rather than
       asserted */
    const probe = at.canvas.getContext('2d')
      .getImageData(0, 0, at.canvas.width, at.canvas.height).data;
    const seen = new Set();
    let opaque = 0;
    for (let i = 0; i < probe.length; i += 4) {
      if (probe[i + 3] < 8) continue;
      opaque++;
      seen.add((probe[i] << 16) | (probe[i + 1] << 8) | probe[i + 2]);
    }
    return { name: look.name, ms: Math.round(ms),
             frames: Object.keys(at.frames).length,
             sheet: [at.canvas.width, at.canvas.height],
             colours: seen.size, opaque,
             w: cv.width, h: cv.height };
  }, { id: who, anim });

  if (info.error) { console.log(info.error); await b.close(); process.exit(1); }
  console.log(info.name + ': ' + info.frames + ' frames baked in ' + info.ms + 'ms');
  console.log('  sheet ' + info.sheet[0] + 'x' + info.sheet[1] +
              ', ' + info.colours + ' distinct colours, ' + info.opaque + ' lit pixels');
  await p.waitForTimeout(200);
  await p.screenshot({ path: '/tmp/sprite-' + who + '-' + anim + '.png',
                       clip: { x: 0, y: 0, width: Math.min(1560, info.w),
                               height: Math.min(1040, info.h) } });
  console.log('  -> /tmp/sprite-' + who + '-' + anim + '.png');
  await b.close();
})();
