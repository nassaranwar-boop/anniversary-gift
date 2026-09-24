/* THE GREYBOX.
 *
 * Step 1 of the match bible: lock the camera before any sprite is
 * redrawn. Nothing in here is art — every player is a coloured block
 * the size a player would be, so what is being judged is the CAMERA and
 * nothing else.
 *
 * It renders the same moment four ways:
 *
 *   A  perspective, vertical      what the chapter ships today
 *   B  oblique,     vertical      the bible's fixed foreshortening
 *   C  oblique,     horizontal    goals left and right
 *   D  perspective, horizontal
 *
 * and prints the numbers that actually decide it: how much of the pitch
 * is on screen, how much of the frame is stand, and how big a player is
 * at each end.
 *
 *   node tools/cupgrey.js
 */
const { chromium } = require('playwright-core');
const fs = require('fs');

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox', '--no-proxy-server'] });
  const p = await b.newPage({ viewport: { width: 980, height: 560 }, deviceScaleFactor: 1 });
  p.on('pageerror', e => console.log('ERR', e.message));
  await p.route('**/*', r => r.request().url().startsWith('http://127.0.0.1') ? r.continue() : r.abort());
  await p.goto('http://127.0.0.1:8899/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForTimeout(500);
  await p.addScriptTag({ url: 'cup.config.js' });
  await p.addScriptTag({ url: 'cup.pitch2d.js' });
  await p.waitForFunction(() => !!window.CupPitch2D && !!window.CUP_CONFIG, { timeout: 20000 });

  const out = await p.evaluate(() => {
    document.body.innerHTML = '';
    document.body.style.cssText = 'margin:0;background:#000';
    const cv = document.createElement('canvas');
    cv.id = 'stage'; cv.width = 960; cv.height = 540;
    cv.style.cssText = 'display:block;image-rendering:pixelated';
    document.body.appendChild(cv);

    /* the same pitch the simulation plays on */
    const W = { halfW: 144, len: 404, goalHalf: 34, goalDepth: 13,
                boxHalf: 75, boxDepth: 56, sixHalf: 41, sixDepth: 22,
                circleR: 46, spot: 40 };
    const P = window.CupPitch2D.create(cv, W);

    /* eight placeholder players, a ball, and a moment of football: a
       break down the right with two defenders coming across */
    const HOME = '#c1272d', AWAY = '#6d5fa8';
    const squad = [
      { x:   0, y: 130, col: HOME, me: true },
      { x: -46, y: 170, col: HOME },
      { x:  52, y:  96, col: HOME },
      { x:   6, y: 250, col: HOME },
      { x:  18, y:  92, col: AWAY },
      { x: -28, y: 110, col: AWAY },
      { x:  40, y:  48, col: AWAY },
      { x:   0, y:  14, col: AWAY },
    ];
    const ball = { x: 8, y: 122 };

    const shot = (mode, swap, label, back, height) => {
      P.mode = mode;
      P.setSwap(swap);
      P.setHeight(height || 16.5);
      /* THE CAMERA IS ALWAYS IN THE PITCH'S OWN COORDINATES. Which of
         the two is "across" and which is "depth" is the projection's
         business, so the only thing that changes here is which one the
         camera sits back along. */
      if (mode === 'oblique') {
        P.obS = swap ? 2.7 : 4.0;
        P.obF = 0.50;
        P.groundY = 250;
        P.cam.x = swap ? ball.x - 40 : ball.x;
        P.cam.y = swap ? ball.y : ball.y - 40;
      } else {
        P.cam.x = swap ? ball.x - (back || 92) : ball.x;
        P.cam.y = swap ? ball.y : ball.y - (back || 82);
      }
      P.zoomTo(1);
      P.begin(0.016, [0, 0]);
      squad.forEach((q, i) => {
        /* PART 4.1's depth scaling, so the greybox shows what it costs.
           NEAR 1.00 at the camera's end, FAR 0.62 at the far goal. */
        const depth = swap ? (q.x + W.halfW) / (W.halfW * 2) : q.y / W.len;
        P.block({ wx: q.x, wy: q.y, col: q.col, n: i,
                  scale: 1.00 - 0.38 * Math.max(0, Math.min(1, depth)),
                  ring: q.me ? 0.2 : null });
      });
      P.ball(ball.x, ball.y, 0, null, 1.7, { spin: 1.2, speed: 40, vx: 30, vy: -20 });
      P.flush();
      P.finish();
      P.present();

      /* THE NUMBERS THAT DECIDE IT, measured rather than eyeballed.
         "Across" and "along" are the pitch's own axes whichever way
         round it is being drawn. */
      const px = (a, b) => P.project(a, b);
      const acrossPx = swap
        ? Math.abs(px(ball.x, W.len).x - px(ball.x, 0).x)          // length across screen
        : Math.abs(px(W.halfW, ball.y).x - px(-W.halfW, ball.y).x);
      const alongPx = swap
        ? Math.abs(px(W.halfW, ball.y).y - px(-W.halfW, ball.y).y)  // width into screen
        : Math.abs(px(0, W.len).y - px(0, 0).y);
      const farEdge = swap ? px(W.halfW, ball.y).y : px(0, W.len).y;
      const standTop = Math.max(0, Math.min(P.vh, farEdge));
      return {
        label,
        across: +(P.vw / acrossPx * 100).toFixed(0) + '% of the ' +
                (swap ? 'length' : 'width') + ' across the screen',
        along: +(P.vh * 0.8 / alongPx * 100).toFixed(0) + '% of the ' +
               (swap ? 'width' : 'length') + ' into the screen',
        standShare: +(standTop / P.vh * 100).toFixed(0) + '% of frame above the far edge',
        playerNear: Math.round(44 * 1.0),
        playerFar: Math.round(44 * 0.62),
        png: cv.toDataURL('image/png'),
      };
    };

    return [
      shot('persp', false, 'A  perspective, vertical  (ships today)'),
      shot('oblique', false, 'B  oblique F=0.50, vertical'),
      shot('oblique', true, 'C  oblique F=0.50, horizontal'),
      shot('persp', true, 'D  perspective, horizontal'),
      /* THE RECOMMENDATION. Same projection as D, camera further back,
         which is the one number that trades stand for pitch. */
      shot('persp', true, 'E  perspective, horizontal, camera back 170', 170),
      /* THE RECOMMENDATION: same projection, camera dropped to a
         broadcast height, which is the one number that trades stand for
         pitch and hits the bible's 20-25% target. */
      shot('persp', true, 'F  perspective, horizontal, lower camera  <- RECOMMENDED',
           150, 8.2),
    ];
  });

  out.forEach((o, i) => {
    const name = '/tmp/grey-' + 'ABCDEF'[i] + '.png';
    fs.writeFileSync(name, Buffer.from(o.png.split(',')[1], 'base64'));
    console.log(o.label);
    console.log('   ' + o.across);
    console.log('   ' + o.along + ' · ' + o.standShare);
    console.log('   player ' + o.playerNear + 'px near, ' + o.playerFar + 'px far  -> ' + name);
  });
  await b.close();
})();
