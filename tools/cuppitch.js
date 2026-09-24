/* OUISSY, IN ENGINE, ON THE 2D PITCH.
 *
 * The character bible's Part 8 asks for one thing before anything else
 * is built: her S, SE and E facings, idle and run, on the faux-
 * perspective pitch, with the drop shadow and the controlled-player
 * ring. Not a contact sheet — the actual renderer, at the actual size,
 * against the actual grass, because that is the only place a sprite can
 * be judged.
 *
 * Writes a numbered strip of frames which the caller stitches into a
 * gif, plus one still at 3x for looking at the pixels.
 *
 *   node tools/cuppitch.js
 */
const { chromium } = require('playwright-core');
const fs = require('fs');

const OUT = '/tmp/pitch';
const FPS = 12, SEG = 12;          // four segments of a second each

(async () => {
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });

  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox', '--no-proxy-server'] });
  const p = await b.newPage({ viewport: { width: 960, height: 540 }, deviceScaleFactor: 1 });
  p.on('pageerror', e => console.log('ERR', e.message));
  p.on('console', m => { if (m.type() === 'error') console.log('CONSOLE', m.text()); });
  await p.route('**/*', r => r.request().url().startsWith('http://127.0.0.1') ? r.continue() : r.abort());
  await p.goto('http://127.0.0.1:8899/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForTimeout(500);
  await p.addScriptTag({ url: 'cup.config.js' });
  await p.addScriptTag({ url: 'cup.sprites.js' });
  await p.addScriptTag({ url: 'cup.pitch2d.js' });
  await p.waitForFunction(() => !!window.CupSprites && !!window.CupPitch2D && !!window.CUP_CONFIG,
                          { timeout: 20000 });

  const info = await p.evaluate(({ fps, seg }) => {
    document.body.innerHTML = '';
    document.body.style.cssText = 'margin:0;background:#000;overflow:hidden';
    const cv = document.createElement('canvas');
    cv.id = 'stage'; cv.width = 960; cv.height = 540;
    cv.style.cssText = 'display:block;image-rendering:pixelated';
    document.body.appendChild(cv);

    const look = window.CUP_CONFIG.ROSTER.filter(r => r.id === 'ouissy')[0];
    const team = window.CUP_CONFIG.TEAMS.filter(
      t => (t.squad || []).indexOf('ouissy') >= 0)[0];
    const at = window.CupSprites.bake(look, team ? team.kit : null);
    const P = window.CupPitch2D.create(cv);

    /* THE SCRIPT.
       Four seconds: running at the camera, running across it to the
       right, running away up the pitch, then standing. Her facing is
       taken from the direction she is travelling, which is the same
       thing the match will do. */
    const L = window.CupPitch2D.PITCH.len;
    const legs = [
      { face: 's',  anim: 'run',  vx: 0,    vy: -13, flip: false },
      { face: 'se', anim: 'run',  vx: 11,   vy: -7,  flip: false },
      { face: 'e',  anim: 'run',  vx: 14,   vy: 0,   flip: false },
      { face: 's',  anim: 'idle', vx: 0,    vy: 0,   flip: false },
    ];

    let wx = -14, wy = L * 0.64;
    let lastI = -1;
    window.__shot = function (i) {
      const dt = 1 / fps;
      /* advance the world one frame at a time, so the run actually
         covers ground rather than teleporting between poses */
      while (lastI < i) {
        lastI++;
        const g = legs[Math.min(legs.length - 1, Math.floor(lastI / seg))];
        wx += g.vx * dt; wy += g.vy * dt;
      }
      const g = legs[Math.min(legs.length - 1, Math.floor(i / seg))];
      /* the camera trails her, a little short, so she sits above the
         middle of the frame with the pitch opening out ahead */
      P.cam.x += (wx - P.cam.x) * 0.25;
      P.cam.y += ((wy - 26) - P.cam.y) * 0.25;
      P.t = i / fps;

      P.begin(0);
      const n = at.anims[g.anim];
      const f = Math.floor(i * (g.anim === 'run' ? 1 : 0.5)) % n;
      const air = at.airOf(g.anim, g.face, f);
      P.shadow(wx, wy, 1.0, air);
      P.ring(wx, wy, (i / fps) * 0.5);
      P.sprite(at, g.anim, g.face, f, wx, wy, g.flip, air);
      P.ball(wx + 2.6, wy + 1.4, 0, null, 0.35, { spin: i * 0.4 });
      P.finish();
      P.present();
      return { wx: Math.round(wx), wy: Math.round(wy), face: g.face, f };
    };

    /* warm the camera up on the first pose so frame one is not a jump */
    P.cam.x = wx; P.cam.y = wy - 26;
    return { frames: legs.length * seg, colours: at.anims.run };
  }, { fps: FPS, seg: SEG });

  console.log('rendering ' + info.frames + ' frames');
  /* Pull the pixels straight off the canvas rather than asking Playwright
     for an element screenshot: the screenshot path costs about thirteen
     seconds a frame in this container, which turns a four-second
     animation into a ten-minute wait. */
  for (let i = 0; i < info.frames; i++) {
    const st = await p.evaluate((k) => {
      const s = window.__shot(k);
      s.png = document.getElementById('stage').toDataURL('image/png');
      return s;
    }, i);
    fs.writeFileSync(OUT + '/f' + String(i).padStart(3, '0') + '.png',
                     Buffer.from(st.png.split(',')[1], 'base64'));
    if (i % 12 === 0) console.log('  ' + i + ': ' + st.face + ' f' + st.f +
                                  ' at (' + st.wx + ',' + st.wy + ')');
  }
  fs.copyFileSync(OUT + '/f005.png', '/tmp/pitch-still.png');

  console.log('  -> ' + OUT + '/f*.png  and  /tmp/pitch-still.png');
  await b.close();
})();
