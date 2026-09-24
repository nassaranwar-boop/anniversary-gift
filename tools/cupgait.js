/* THE NEW ANIMATIONS, LAID OUT SO THEY CAN BE JUDGED.
 *
 * turn, stop, trap and pass are the four that were missing, and all
 * four are the kind of thing that is either obviously right or
 * obviously wrong the moment you see the frames next to each other and
 * completely impossible to tell from the code. One row per animation,
 * one column per frame, at 4x, facing the camera and facing across it.
 *
 *   node tools/cupgait.js
 */
const { chromium } = require('playwright-core');
const fs = require('fs');

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox', '--no-proxy-server'] });
  const p = await b.newPage({ viewport: { width: 1100, height: 700 }, deviceScaleFactor: 1 });
  p.on('pageerror', e => console.log('ERR', e.message));
  await p.route('**/*', r => r.request().url().startsWith('http://127.0.0.1') ? r.continue() : r.abort());
  await p.goto('http://127.0.0.1:8899/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForTimeout(500);
  await p.addScriptTag({ url: 'cup.config.js' });
  await p.addScriptTag({ url: 'cup.sprites.js' });
  await p.waitForFunction(() => !!window.CupSprites && !!window.CUP_CONFIG, { timeout: 20000 });

  const out = await p.evaluate((face) => {
    const R = window.CUP_CONFIG.ROSTER, T = window.CUP_CONFIG.TEAMS;
    const look = R.filter(r => r.id === 'ouissy')[0] || R[0];
    const team = T.filter(t => (t.squad || []).indexOf('ouissy') >= 0)[0] || T[0];
    const t0 = performance.now();
    const at = window.CupSprites.bake(look, team.kit);
    const bakeMs = Math.round(performance.now() - t0);

    const SHOW = ['run', 'turn', 'stop', 'trap', 'pass', 'kick'];
    const Z = 4, S = at.size, PAD = 3;
    const maxN = Math.max(...SHOW.map(a => at.anims[a] || 0));
    const cv = document.createElement('canvas');
    cv.width = 96 + maxN * (S * Z + PAD);
    cv.height = SHOW.length * 2 * (S * Z + PAD) + 20;
    const c = cv.getContext('2d');
    c.imageSmoothingEnabled = false;
    c.fillStyle = '#26402a';
    c.fillRect(0, 0, cv.width, cv.height);

    let y = 10;
    SHOW.forEach((a) => {
      [face, 'e'].forEach((fc) => {
        c.fillStyle = '#cfe0d8';
        c.font = '13px monospace';
        c.fillText(a + ' ' + fc, 6, y + 20);
        const n = at.anims[a] || 0;
        for (let f = 0; f < n; f++) {
          const uv = at.uv(a, fc, f);
          if (!uv) continue;
          c.drawImage(at.canvas, uv.col * S, uv.row * S, S, S,
                      96 + f * (S * Z + PAD), y, S * Z, S * Z);
        }
        y += S * Z + PAD;
      });
    });
    return { png: cv.toDataURL('image/png'), bakeMs,
             anims: Object.keys(at.anims).length,
             frames: Object.keys(at.frames).length,
             sheet: [at.canvas.width, at.canvas.height] };
  }, 's');

  fs.writeFileSync('/tmp/gait.png', Buffer.from(out.png.split(',')[1], 'base64'));
  console.log('baked ' + out.anims + ' animations, ' + out.frames + ' frames, ' +
              out.sheet.join('x') + 'px atlas, in ' + out.bakeMs + 'ms');
  console.log('  -> /tmp/gait.png');
  await b.close();
})();
