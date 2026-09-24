/* WHICH WAY ROUND THE PITCH GOES — decided with the real sprites.
 *
 * The greybox answered "what does the camera frame"; it could not
 * answer the question that actually decides this, which is what a
 * character drawn at 1:1 looks like once she is allowed to change
 * depth. Blocks scale, so a greybox flatters an orientation that a
 * never-scaled 64-pixel sprite may not survive.
 *
 * So: the same moment of football, the same real baked atlas, drawn
 * both ways round, plus the one measurement that matters — how far the
 * player being driven travels in DEPTH while her size stays locked.
 *
 *   node tools/cupaxis.js
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
  await p.addScriptTag({ url: 'cup.sprites.js' });
  await p.addScriptTag({ url: 'cup.pitch2d.js' });
  await p.waitForFunction(() => !!window.CupSprites && !!window.CupPitch2D && !!window.CUP_CONFIG,
                          { timeout: 20000 });

  const out = await p.evaluate(() => {
    document.body.innerHTML = '';
    document.body.style.cssText = 'margin:0;background:#000';
    const cv = document.createElement('canvas');
    cv.width = 960; cv.height = 540;
    cv.style.cssText = 'display:block;image-rendering:pixelated';
    document.body.appendChild(cv);

    const W = { halfW: 144, len: 404, goalHalf: 34, goalDepth: 13,
                boxHalf: 75, boxDepth: 56, sixHalf: 41, sixDepth: 22,
                circleR: 46, spot: 40 };
    const P = window.CupPitch2D.create(cv, W);
    /* the palette is a VENUE, not a default: testing against the
       unbranded base palette measures a pitch the game never draws */
    const V = (window.CUP_CONFIG.VENUES || [])[0];
    if (V) window.CupPitch2D.venue(V);

    /* real atlases, real kits */
    const R = window.CUP_CONFIG.ROSTER, T = window.CUP_CONFIG.TEAMS;
    const look = id => R.filter(r => r.id === id)[0] || R[0];
    const teamOf = id => T.filter(t => (t.squad || []).indexOf(id) >= 0)[0] || T[0];
    const bake = id => window.CupSprites.bake(look(id), teamOf(id).kit);
    const home = bake('ouissy');
    const awayKit = T.filter(t => (t.squad || []).indexOf('ouissy') < 0)[0].kit;
    const away = window.CupSprites.bake(look('anwar'), awayKit);

    /* a break down the right: the carrier, two support runners, three
       defenders coming across, a keeper. Chosen so the frame contains
       players at BOTH extremes of depth, because that is exactly where
       a never-scaled sprite gives itself away. */
    const squad = [
      { x:  30, y: 236, at: home, me: true, face: 's',  anim: 'run' },
      { x: -58, y: 250, at: home, face: 'se', anim: 'run' },
      { x:  96, y: 206, at: home, face: 's',  anim: 'run' },
      { x: -12, y: 300, at: home, face: 's',  anim: 'idle' },
      { x:  52, y: 198, at: away, face: 'n',  anim: 'run' },
      { x: -20, y: 214, at: away, face: 'ne', anim: 'run' },
      { x: 104, y: 160, at: away, face: 'n',  anim: 'run' },
      { x:   0, y:  96, at: away, face: 'n',  anim: 'idle' },
      { x:   4, y:  10, at: away, face: 's',  anim: 'ready' },
    ];
    const ball = { x: 40, y: 230 };

    const shot = (swap, label, trail) => {
      P.setSwap(swap);
      if (swap) { P.cam.x = -W.halfW - trail; P.cam.y = W.len - ball.y; }
      else      { P.cam.x = ball.x;           P.cam.y = (W.len - ball.y) - trail; }
      P.zoomTo(1);
      P.begin(0.016, [0, 0]);
      squad.forEach((q, i) => {
        const wx = q.x, wy = W.len - q.y;
        const n = q.at.anims[q.anim] || 1;
        const f = i % n;
        const air = q.at.airOf(q.anim, q.face, f);
        P.shadow(wx, wy, 1.0, air);
        if (q.me) P.ring(wx, wy, 0.3);
        P.sprite(q.at, q.anim, q.face, f, wx, wy, false, air);
      });
      P.ball(ball.x, W.len - ball.y, 0, null, 0.4, { spin: 1.2 });
      P.flush();
      P.finish();
      P.present();

      /* THE MEASUREMENT THAT DECIDES IT: how much the depth under the
         player being driven changes as she covers the axis the camera
         does NOT track, and therefore how wrong a locked 1:1 sprite is
         while she does it. */
      const dOf = (x, y) => P.project(x, W.len - y).d;
      const near = swap ? dOf(-W.halfW + 8, ball.y) : dOf(ball.x, ball.y);
      const far  = swap ? dOf( W.halfW - 8, ball.y) : dOf(ball.x, ball.y);
      const yOf = (x, y) => P.project(x, W.len - y).y;
      const travel = swap
        ? Math.abs(yOf(W.halfW - 8, ball.y) - yOf(-W.halfW + 8, ball.y))
        : 0;
      return { label, carrierNear: +near.toFixed(1), carrierFar: +far.toFixed(1),
               sizeError: +(far / near).toFixed(2), travel: Math.round(travel),
               png: cv.toDataURL('image/png') };
    };

    return [
      shot(false, 'VERTICAL   camera tracks depth, carrier depth pinned', 82),
      shot(true,  'HORIZONTAL camera fixed off the touchline', 82),
    ];
  });

  out.forEach((o, i) => {
    const name = '/tmp/axis-' + (i ? 'horizontal' : 'vertical') + '.png';
    fs.writeFileSync(name, Buffer.from(o.png.split(',')[1], 'base64'));
    console.log(o.label);
    console.log('   carrier depth ' + o.carrierNear + ' .. ' + o.carrierFar +
                '  -> a 1:1 sprite is up to ' +
                Math.round(Math.abs(1 - o.sizeError) * 100) + '% wrong' +
                (o.travel ? ', over ' + o.travel + 'px of screen travel' : ''));
    console.log('   -> ' + name);
  });
  await b.close();
})();
