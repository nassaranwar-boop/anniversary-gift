/* THE OPENING FILM: IS ANYTHING JAMMED AGAINST THE LENS.

   endcheck asks this of the LAST HOUR's film -- "nothing is close
   enough to the lens to be an unreadable shape". Nothing asked it of
   the opening statement, which is the first ninety seconds of the
   chapter and the thing a new player judges it by. Playing it cold put
   a black dome across the middle of the party-room beat.

   A pixel count cannot answer it: a toy shop at night is legitimately
   half black, so "how much of this frame is dark" flags every beat and
   proves nothing. What distinguishes a mood from a fault is DEPTH --
   an object a hand's breadth from the lens, filling the middle of the
   frame, lit by nothing because it is between the camera and every
   lamp in the room.

   So this walks each beat's move, and at each step fires rays through
   the middle of the frame and reports the nearest thing they hit. The
   camera is posed by the chapter's own introPose, which moves the light
   rig with it -- without that the rig stays in the room before and
   every shot reads as black, which cost three wrong answers.

   A room's own walls are allowed to be close at the start of a push-in.
   What is not allowed is something close in the MIDDLE of the move,
   when she is being asked to look at the room. */
const { chromium } = require('playwright-core');
const NEAR = Number(process.env.NEAR || 0.75);   // metres: against the lens
/* and how much of the picture is allowed to be something within arm's
   reach. A third is foreground -- a counter corner, the edge of a
   curtain, a shelf the camera is looking past -- and half is a wall. */
const FILL = Number(process.env.FILL || 0.42);

let pass = 0, fail = 0;
const t = (n, c, note) => { c ? pass++ : fail++;
  console.log(`${c ? 'PASS' : 'FAIL'}  ${n}${note !== undefined ? '   ' + note : ''}`); };

(async () => {
  const b = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox','--no-proxy-server','--use-gl=swiftshader','--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 1000, height: 640 } });
  p.on('pageerror', e => console.log('PAGEERROR', e.message));
  await p.route('**/*', r => { const u=r.request().url();
    if (u.indexOf('workers.dev')>=0||u.indexOf('cloudflareinsights')>=0) return r.fulfill({status:200,body:'{}'});
    return u.startsWith('http://127.0.0.1') ? r.continue() : r.abort(); });
  await p.goto('http://127.0.0.1:8899/index.html', { waitUntil:'domcontentloaded', timeout:60000 });
  await p.evaluate(() => { try{localStorage.clear();}catch(e){} showScreen('nightshift');
    return loadChapter('nightshift').then(()=>OuissysNightShift.start()); });
  await p.waitForFunction(()=>{try{return !!OuissysNightShift.__night.cast().jax;}catch(e){return false;}},
                          {timeout:180000, polling:500});

  const rows = await p.evaluate((NEAR) => {
    const N = OuissysNightShift.__night, three = N.three();
    const beats = N.script().intro.beats;
    const view = N.view();
    const out = [];
    const ARM = 1.4;                  /* metres: within arm's reach of the lens */
    for (let i = 0; i < beats.length; i++) {
      const room = N.rooms()[beats[i].room];
      let worst = { k: null, dist: 99, lum: null };
      let fill = { k: null, frac: 0 };
      const walk = [];
      for (let s = 0; s <= 8; s++) {
        const k = s / 8;
        N.introPose(i, k);
        room.group.updateMatrixWorld(true);
        const rc = new three.Raycaster();
        let nearest = 99;
        /* nine rays through the middle half of the frame */
        for (const x of [-0.25, 0, 0.25])
          for (const y of [-0.25, 0, 0.25]) {
            rc.setFromCamera(new three.Vector2(x, y), view);
            const h = rc.intersectObject(room.group, true);
            if (h.length && h[0].distance < nearest) nearest = h[0].distance;
          }
        /* AND HOW MUCH OF THE FRAME IT IS.

           Nine rays through the middle half answer "is the lens
           buried". They do not answer the other half of the question,
           which playing it cold raised: the foyer beat has a large
           flat pale slab filling the bottom-right third, and nothing
           in the middle of that frame is close to anything. A slab in
           a corner is foreground framing when it is a piece of the
           shop and an accident when it is a wall the camera has
           backed into, and the difference is how MUCH of the picture
           it is. So a 9x9 grid over the whole frame, and the fraction
           of it standing within arm's reach. */
        let near = 0, total = 0;
        for (let gx = 0; gx < 9; gx++)
          for (let gy = 0; gy < 9; gy++) {
            const u = -0.9 + (1.8 * gx) / 8, v = -0.9 + (1.8 * gy) / 8;
            rc.setFromCamera(new three.Vector2(u, v), view);
            const h = rc.intersectObject(room.group, true);
            total++;
            if (h.length && h[0].distance < ARM) near++;
          }
        const frac = near / total;
        if (frac > fill.frac) fill = { k: k, frac: +frac.toFixed(2) };
        walk.push(+nearest.toFixed(2));
        if (nearest < worst.dist) worst = { k: k, dist: +nearest.toFixed(2), lum: N.frameLum() };
      }
      out.push({ beat: i, room: beats[i].room, walk: walk, worst: worst, fill: fill });
    }
    return out;
  }, NEAR);

  console.log('how near the nearest thing gets, across each move (metres)\n');
  rows.forEach(r => {
    console.log(`  beat ${r.beat}  ${r.room.padEnd(9)} ${r.walk.join('  ')}`);
  });
  console.log();
  rows.forEach(r => {
    t(`beat ${r.beat} (${r.room}): nothing is jammed against the lens`,
      r.worst.dist >= NEAR,
      `closest ${r.worst.dist}m at ${Math.round(r.worst.k*100)}% through the move` +
      (r.worst.lum != null ? `, frame lum ${r.worst.lum}` : ''));
  });
  console.log();
  rows.forEach(r => {
    t(`beat ${r.beat} (${r.room}): the shot is not mostly a near wall`,
      r.fill.frac <= FILL,
      `${Math.round(r.fill.frac*100)}% of the frame within arm's reach` +
      (r.fill.k != null ? ` at ${Math.round(r.fill.k*100)}% through the move` : ''));
  });
  console.log(`\n${pass} passed, ${fail} failed`);
  await b.close();
  process.exit(fail ? 1 : 0);
})();
