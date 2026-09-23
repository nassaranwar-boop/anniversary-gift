/* THE WHOLE SQUAD, SIDE BY SIDE.
 *
 * Part 6 of the character bible asks for a roster you can tell apart by
 * silhouette alone. That is not a thing you can check one character at a
 * time: it is only true or false when they are lined up together, which
 * is what this does. Every player in the roster, in their own team's
 * kit, one row facing the camera and one row in profile.
 *
 * The silhouette test runs on the row underneath: the same figures with
 * every colour thrown away and one flat ink instead. If two of them are
 * the same shape, that row is where it shows.
 *
 *   node tools/cupsquad.js [anim]        (default: idle)
 */
const { chromium } = require('playwright-core');
const anim = process.argv[2] || 'idle';

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox', '--no-proxy-server'] });
  const p = await b.newPage({ viewport: { width: 1920, height: 760 } });
  p.on('pageerror', e => console.log('ERR', e.message));
  await p.route('**/*', r => r.request().url().startsWith('http://127.0.0.1') ? r.continue() : r.abort());
  await p.goto('http://127.0.0.1:8899/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForTimeout(500);
  await p.addScriptTag({ url: 'cup.config.js' });
  await p.addScriptTag({ url: 'cup.sprites.js' });
  await p.waitForFunction(() => !!window.CupSprites && !!window.CUP_CONFIG, { timeout: 20000 });

  const info = await p.evaluate((anim) => {
    const R = window.CUP_CONFIG.ROSTER, T = window.CUP_CONFIG.TEAMS;
    const S = window.CupSprites.SIZE, Z = 2;
    const cv = document.createElement('canvas');
    cv.width = 24 + R.length * (S * Z + 4);
    cv.height = 3 * (S * Z + 18) + 10;
    const x = cv.getContext('2d');
    x.imageSmoothingEnabled = false;
    x.fillStyle = '#6a7a6e'; x.fillRect(0, 0, cv.width, cv.height);
    x.font = '11px monospace';

    const slow = [];
    R.forEach((look, i) => {
      const team = T.filter(t => (t.squad || []).indexOf(look.id) >= 0)[0];
      const kit = team ? (look.role === 'gk' ? team.gkKit : team.kit) : null;
      const t0 = performance.now();
      const at = window.CupSprites.bake(look, kit);
      slow.push(Math.round(performance.now() - t0));
      const cx0 = 12 + i * (S * Z + 4);
      ['s', 'e'].forEach((f, row) => {
        const uv = at.uv(anim, f, 0);
        x.drawImage(at.canvas, uv.col * S, uv.row * S, S, S,
                    cx0, 14 + row * (S * Z + 18), S * Z, S * Z);
      });
      x.fillStyle = '#e8f0e8';
      x.fillText(look.name.slice(0, 9), cx0, 10);

      /* THE SILHOUETTE TEST. Everything that is not transparent becomes
         one flat ink, so nothing but the outline is left to tell them
         apart — which is the only test Part 1.5 actually asks for. */
      const uv = at.uv(anim, 's', 0);
      const tmp = document.createElement('canvas');
      tmp.width = S; tmp.height = S;
      const tx = tmp.getContext('2d');
      tx.drawImage(at.canvas, uv.col * S, uv.row * S, S, S, 0, 0, S, S);
      const d = tx.getImageData(0, 0, S, S);
      for (let q = 0; q < d.data.length; q += 4) {
        if (d.data[q + 3] > 8) { d.data[q] = 20; d.data[q + 1] = 18; d.data[q + 2] = 26; }
      }
      tx.putImageData(d, 0, 0);
      x.imageSmoothingEnabled = false;
      x.drawImage(tmp, 0, 0, S, S, cx0, 14 + 2 * (S * Z + 18), S * Z, S * Z);
    });

    document.body.innerHTML = '';
    document.body.style.margin = '0';
    document.body.appendChild(cv);
    return { n: R.length, w: cv.width, h: cv.height, slowest: Math.max.apply(null, slow),
             total: slow.reduce((a, c) => a + c, 0) };
  }, anim);

  console.log(info.n + ' characters baked, ' + info.total + 'ms total, ' +
              'slowest ' + info.slowest + 'ms');
  await p.waitForTimeout(200);
  await p.screenshot({ path: '/tmp/squad-' + anim + '.png',
                       clip: { x: 0, y: 0, width: Math.min(1920, info.w),
                               height: Math.min(760, info.h) } });
  console.log('  -> /tmp/squad-' + anim + '.png');
  await b.close();
})();
