/* CAN SHE ACTUALLY GET THERE?

   A platformer level can be beautiful, load without an error, pass every
   render test in the suite and still be impossible to finish, and nothing
   here was asking the only question that matters: from where she starts,
   using the physics the game actually runs, can she reach the goal?

   So this walks the nine grids with the game's own numbers — the same
   gravity, the same jump velocity, the same run speed, the same 10x15 box
   — and floods outward from S through every jump and every fall the
   physics allows. What it cannot reach, she cannot reach.

   Powerups are deliberately NOT modelled. A level has to be finishable
   without the double jump and without the speed boost, because both are
   optional pickups; anything that needs one is a level that can be
   entered in a state that cannot finish it. */
const fs = require('fs');
const src = fs.readFileSync(require('path').join(__dirname, '..', 'super-ouissy.js'), 'utf8');

/* ---- the game's own numbers, read from the file rather than copied ---- */
function num(name) {
  const m = new RegExp(name + ':\\s*([\\d.]+)').exec(src);
  if (!m) throw new Error('cannot find TUNE.' + name);
  return parseFloat(m[1]);
}
const T = num('tile'), GU = num('gravityUp'), GD = num('gravityDown');
const JV = num('jumpVel'), RUN = num('maxRun'), AIR = num('airAccel'), MAXF = num('maxFall');
const SOLID = '#B?MI1PF';

/* ---- the grids, and which set each belongs to ---- */
function grid(name) {
  const m = new RegExp('var ' + name + ' = \\{[\\s\\S]*?rows: \\[([\\s\\S]*?)\\],\\s*\\};').exec(src);
  if (!m) throw new Error('cannot find ' + name);
  return m[1].match(/"[^"]*"/g).map(x => x.slice(1, -1));
}
const SETS = {
  easy:   { worlds: ['W_MEADOW', 'W_ORCHARD', 'W_GARDEN'],      gravityMul: 0.92, jumpMul: 1.06 },
  medium: { worlds: ['W_RIVERSIDE', 'W_WINDMILL', 'W_HILLTOWN'], gravityMul: 1,    jumpMul: 1 },
  hard:   { worlds: ['W_FOREST', 'W_RUINS', 'W_CASTLE'],         gravityMul: 1.08, jumpMul: 0.98 },
};

/* ---- the world, as the physics sees it ---- */
function makeLevel(rows) {
  const H = rows.length, W = rows[0].length;
  const at = (tx, ty) => (tx < 0 || tx >= W) ? '#' : (ty < 0 || ty >= H) ? '.' : rows[ty][tx];
  const solid = (tx, ty) => SOLID.indexOf(at(tx, ty)) >= 0;
  const oneWay = (tx, ty) => at(tx, ty) === '-';
  /* the deadly rows: a pit or a moat is not a place she can be */
  const deadly = (tx, ty) => at(tx, ty) === '~' || at(tx, ty) === '^';
  /* THE MOVING PLATFORMS ARE PART OF THE LEVEL.
     H slides four tiles to the right of where it is written, V rises three
     above it, T blinks in place; each is two tiles wide. They oscillate,
     so a platform she can board she can also ride to either end of its
     travel — which is why each one contributes a landing band and two
     nodes, not one. */
  const movers = [];
  for (let r = 0; r < H; r++)
    for (let c = 0; c < W; c++) {
      const ch = at(c, r);
      if (ch !== 'H' && ch !== 'V' && ch !== 'T') continue;
      const x = c * T, y = r * T, span = ch === 'H' ? T * 4 : T * 3;
      movers.push(ch === 'H' ? { x0: x, x1: x + span, y0: y, y1: y }
               : ch === 'V' ? { x0: x, x1: x, y0: y - span, y1: y }
                            : { x0: x, x1: x, y0: y, y1: y });
    }
  return { rows, W, H, at, solid, oneWay, deadly, movers };
}
const PW = 10, PH = 15;                    /* her box, small — the state she starts in */

function hitsSolid(L, x, y) {
  const x0 = Math.floor(x / T), x1 = Math.floor((x + PW - 1) / T);
  const y0 = Math.floor(y / T), y1 = Math.floor((y + PH - 1) / T);
  for (let tx = x0; tx <= x1; tx++)
    for (let ty = y0; ty <= y1; ty++)
      if (L.solid(tx, ty)) return true;
  return false;
}
function onGround(L, x, y) {
  const feet = y + PH;
  const ty = Math.floor((feet + 1) / T);
  const x0 = Math.floor(x / T), x1 = Math.floor((x + PW - 1) / T);
  for (let tx = x0; tx <= x1; tx++) {
    if (L.solid(tx, ty)) return true;
    if (L.oneWay(tx, ty) && Math.abs(feet - ty * T) <= 2) return true;
  }
  return false;
}
function inDeath(L, x, y) {
  const x0 = Math.floor(x / T), x1 = Math.floor((x + PW - 1) / T);
  const y0 = Math.floor(y / T), y1 = Math.floor((y + PH - 1) / T);
  for (let tx = x0; tx <= x1; tx++)
    for (let ty = y0; ty <= y1; ty++)
      if (L.deadly(tx, ty)) return true;
  return false;
}

/* One launch, simulated the way the game integrates it: separate axes,
   the same two gravities, the same air control. Returns where she lands. */
function fly(L, x0, y0, vx0, vy0, hold, mul) {
  const gUp = GU * mul.gravityMul, gDn = GD * mul.gravityMul;
  let x = x0, y = y0, vx = vx0, vy = vy0;
  const dt = 1 / 60;
  for (let step = 0; step < 240; step++) {
    /* air control towards the direction she launched in */
    const want = hold * RUN * (mul.slow || 1);
    if (vx < want) vx = Math.min(want, vx + AIR * dt);
    else if (vx > want) vx = Math.max(want, vx - AIR * dt);

    let nx = x + vx * dt;
    if (hitsSolid(L, nx, y)) { let s = vx > 0 ? -1 : 1, g = 0;
      while (hitsSolid(L, nx, y) && g++ < 64) nx += s;
      vx = 0; }
    x = nx;

    vy = Math.min(MAXF, vy + (vy < 0 ? gUp : gDn) * dt);
    let ny = y + vy * dt;
    const prevBottom = y + PH;
    let landed = false;
    if (hitsSolid(L, x, ny)) {
      let s = vy > 0 ? -1 : 1, g = 0;
      while (hitsSolid(L, x, ny) && g++ < 64) ny += s;
      if (vy > 0) landed = true;
      vy = 0;
    } else if (vy > 0) {
      /* a moving platform, anywhere along the travel she could wait for */
      for (const m of L.movers) {
        if (x + PW <= m.x0 || x >= m.x1 + T * 2) continue;
        const top0 = m.y0, top1 = m.y1;
        const feetWas = prevBottom, feetNow = ny + PH;
        if (feetNow >= top0 && feetWas <= top1 + 6 && feetNow <= top1 + 8) {
          const land = Math.max(top0, Math.min(top1, feetNow));
          return { x: x, y: land - PH, mover: m };
        }
      }
      /* one-way ledges catch her only from above */
      const tx0 = Math.floor(x / T), tx1 = Math.floor((x + PW - 1) / T);
      const ty = Math.floor((ny + PH - 1) / T);
      for (let tx = tx0; tx <= tx1; tx++) {
        if (L.oneWay(tx, ty) && prevBottom <= ty * T + 6) { ny = ty * T - PH; vy = 0; landed = true; break; }
      }
    }
    y = ny;
    if (inDeath(L, x, y)) return null;
    if (y > L.H * T + 40) return null;                 /* fell out of the world */
    if (landed && onGround(L, x, y)) return { x: x, y: y };
  }
  return null;
}

/* Flood outward from where she starts. Nodes are standing spots, rounded
   to 4px so the search closes; every edge is a jump or a fall the physics
   above actually completed. */
function reachable(L, mul) {
  const key = (x, y) => (Math.round(x / 4) * 4) + ':' + (Math.round(y / 4) * 4);
  let start = null;
  for (let r = 0; r < L.H && !start; r++)
    for (let c = 0; c < L.W; c++)
      if (L.at(c, r) === 'S') { start = { x: c * T + 3, y: r * T + (T - PH) }; break; }
  if (!start) throw new Error('no S');

  const seen = new Set([key(start.x, start.y)]);
  const queue = [start];
  const spots = [start];
  /* what she can do from a standing start: walk left/right, and jump with
     a full or a cut rise, from a standstill or at a run, both ways */
  const R = RUN * (mul.slow || 1);
  const RUNS = [-R, -R * 0.6, 0, R * 0.6, R];
  const RISES = [1, 0.42];                              /* full, and jumpCut */
  while (queue.length) {
    const p = queue.pop();
    const tries = [];
    /* walking: a step at a time, so she can round a corner or drop off */
    for (const d of [-1, 1]) tries.push({ vx: d * R, vy: 0.0001, hold: d });
    for (const rise of RISES)
      for (const vx of RUNS)
        tries.push({ vx: vx, vy: -JV * mul.jumpMul * rise, hold: Math.sign(vx) || 0 });
    for (const t of tries) {
      const land = fly(L, p.x, p.y, t.vx, t.vy, t.hold, mul);
      if (!land) continue;
      /* riding one to either end of its travel is part of what it is for */
      const here = land.mover
        ? [{ x: land.mover.x0 + 3, y: land.mover.y0 - PH },
           { x: land.mover.x1 + T * 2 - PW - 3, y: land.mover.y1 - PH }]
        : [land];
      for (const q of here) {
        const k = key(q.x, q.y);
        if (seen.has(k)) continue;
        seen.add(k);
        queue.push(q);
        spots.push(q);
      }
    }
  }
  return spots;
}

let pass = 0, fail = 0;
const ok = (n, c, x) => { if (c) { pass++; console.log('  ok   ' + n); }
                          else { fail++; console.log('  FAIL ' + n + (x ? '  ' + JSON.stringify(x) : '')); } };

for (const [diff, set] of Object.entries(SETS)) {
  set.worlds.forEach((name, i) => {
    const L = makeLevel(grid(name));
    const spots = reachable(L, set);
    /* the goal, and every checkpoint on the way to it */
    const want = [];
    for (let r = 0; r < L.H; r++)
      for (let c = 0; c < L.W; c++)
        if (L.at(c, r) === 'G' || L.at(c, r) === 'C') want.push({ c: c, r: r, ch: L.at(c, r) });
    const near = (c, r) => spots.some(s =>
      Math.abs(s.x + PW / 2 - (c * T + T / 2)) < T * 1.1 && Math.abs(s.y + PH - (r * T + T)) < T * 1.1);
    const missed = want.filter(w => !near(w.c, w.r));
    const east = Math.max.apply(null, spots.map(s => Math.round(s.x / T)));
    ok(diff + ' ' + (i + 1) + ' (' + name.slice(2).toLowerCase() + '): every checkpoint and the goal can be reached',
       missed.length === 0,
       missed.length ? { unreachable: missed.map(m => m.ch + '@col' + m.c), 'gets as far as col': east, 'level is': L.W + ' wide' } : null);

    /* AND IT MUST NOT BE KNIFE-EDGE.
       Possible is not the same as fair. A route that only exists at a
       perfect run-up and a perfectly held jump is a route she will fail
       twenty times, which is indistinguishable from impossible while you
       are the one holding the phone. So the whole level is walked again
       by a player who jumps a tenth lower and runs a tenth slower, and it
       still has to go all the way through. */
    const clumsy = { gravityMul: set.gravityMul, jumpMul: set.jumpMul * 0.9, slow: 0.9 };
    const spots2 = reachable(L, clumsy);
    const near2 = (c, r) => spots2.some(s =>
      Math.abs(s.x + PW / 2 - (c * T + T / 2)) < T * 1.1 && Math.abs(s.y + PH - (r * T + T)) < T * 1.1);
    const missed2 = want.filter(w => !near2(w.c, w.r));
    ok(diff + ' ' + (i + 1) + ': and still with a tenth less jump and a tenth less speed',
       missed2.length === 0,
       missed2.length ? { 'too tight at': missed2.map(m => m.ch + '@col' + m.c),
                          'a clumsy run gets as far as col':
                            Math.max.apply(null, spots2.map(s => Math.round(s.x / T))) } : null);
  });
}
console.log('');
console.log(pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
