/* Where do the dead actually stand?

   A zombie parked in the only corridor between here and the objective is
   not a stealth problem, it is a wall: there is nothing to sneak around
   and no decision to make. This walks the route a player has to take —
   spawn, each objective in turn, the way out — and reports every one of
   them sitting on it or beside it, plus how wide the route is at that
   point, so "on the path" can be told from "beside the path". */
const fs = require('fs');
const src = fs.readFileSync(__dirname + '/../apocalypse.js', 'utf8');

function grab(name) {
  const i = src.indexOf('MAPS.' + name + ' = [');
  const j = src.indexOf('];', i);
  return src.slice(src.indexOf('[', i) + 1, j)
    .split('\n').map(s => s.trim()).filter(s => s.startsWith('"'))
    .map(s => s.slice(1, s.lastIndexOf('"')));
}
const SOLID = (src.match(/var SOLID\s*=\s*"([^"]*)"/) || [, ''])[1].replace(/ /g, '');
/* doors are listed solid because they block until they are opened; a
   route through a level goes through its doors */
const DOORS = 'dDPG';
const walk = c => c !== ' ' && (SOLID.indexOf(c) < 0 || DOORS.indexOf(c) >= 0);

/* the things she has to reach, in the order the level asks for them */
const GOALS = {
  home:     ['T', 'W', 'X'],
  streets:  ['X'],
  hospital: ['W', 'A', 'X'],
  escape:   ['C', 'X'],
  gates:    ['X']
};

function find(g, ch) {
  for (let y = 0; y < g.length; y++) {
    const x = g[y].indexOf(ch);
    if (x >= 0) return { x, y };
  }
  return null;
}

/* shortest walk, four-connected, with the target itself allowed to be a
   prop she stands at rather than on */
function path(g, from, to) {
  const H = g.length, W = Math.max(...g.map(r => r.length));
  const at = (x, y) => (y < 0 || y >= H || x < 0 || x >= (g[y] || '').length) ? '#' : g[y][x];
  const seen = new Map(), q = [[from.x, from.y]];
  seen.set(from.x + ',' + from.y, null);
  while (q.length) {
    const [cx, cy] = q.shift();
    if (cx === to.x && cy === to.y) break;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = cx + dx, ny = cy + dy, k = nx + ',' + ny;
      if (seen.has(k)) continue;
      const c = at(nx, ny);
      const isGoal = nx === to.x && ny === to.y;
      if (!isGoal && !walk(c)) continue;
      seen.set(k, [cx, cy]);
      q.push([nx, ny]);
    }
  }
  const key = to.x + ',' + to.y;
  if (!seen.has(key)) return null;
  const out = [];
  let cur = [to.x, to.y];
  while (cur) { out.push(cur); cur = seen.get(cur[0] + ',' + cur[1]); }
  return out.reverse();
}

/* The question is not how wide the corridor looks, it is whether there is
   another way. Block the tile the zombie stands on and see whether the
   route still exists: if it does not, she is not sneaking past it, she is
   walking into it, and the stealth has nothing to work with. */
function chokes(g, from, goals, at) {
  const blocked = g.map((r, y) => y === at.y
    ? r.slice(0, at.x) + '#' + r.slice(at.x + 1) : r);
  let cur = from;
  for (const t of goals) {
    const p = path(blocked, cur, t);
    if (!p) return true;
    cur = t;
  }
  return false;
}

let fails = 0;
const bad = (m, d) => { fails++; console.log('  FAIL ' + m + (d ? '  ' + JSON.stringify(d) : '')); };
const ok = m => console.log('  ok   ' + m);

for (const name of Object.keys(GOALS)) {
  const g = grab(name);
  if (!g.length) continue;
  console.log('\n== ' + name);
  const start = find(g, 'S') || { x: 1, y: 1 };
  let cur = start, route = [], broken = false;
  const stops = [];
  for (const ch of GOALS[name]) {
    const t0 = find(g, ch);
    if (!t0) continue;
    /* she stands next to a television and presses USE; she does not walk
       into it. Aim at whichever neighbour she can actually stand on. */
    let t = t0;
    if (!walk((g[t0.y] || '')[t0.x])) {
      const n = [[1,0],[-1,0],[0,1],[0,-1]]
        .map(d => ({ x: t0.x + d[0], y: t0.y + d[1] }))
        .filter(q => walk((g[q.y] || '')[q.x]));
      if (n.length) t = n[0];
    }
    const p = path(g, cur, t);
    if (!p) { bad('no route to ' + ch, { from: cur, to: t }); broken = true; break; }
    route = route.concat(p);
    stops.push(t);
    cur = t;
  }
  if (broken) continue;
  ok('the route exists, ' + route.length + ' tiles');

  const on = new Set(route.map(p => p[0] + ',' + p[1]));
  const zs = [];
  for (let y = 0; y < g.length; y++)
    for (let x = 0; x < g[y].length; x++)
      if (g[y][x] === 'z' || g[y][x] === 'x') zs.push({ x, y, c: g[y][x] });

  const blocking = [], beside = [];
  for (const z of zs) {
    const onIt = on.has(z.x + ',' + z.y);
    let near = false;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]])
      if (on.has((z.x + dx) + ',' + (z.y + dy))) near = true;
    if (!onIt && !near) continue;
    const rec = { x: z.x, y: z.y, c: z.c, choke: chokes(g, start, stops, z) };
    (onIt ? blocking : beside).push(rec);
  }
  console.log('     ' + zs.length + ' of them; ' + blocking.length + ' standing on the route, '
              + beside.length + ' beside it');
  const walls = blocking.concat(beside).filter(b => b.choke);
  if (walls.length) bad('standing in the only way through', walls);
  else ok('every one of them can be gone round');
  if (blocking.length > 2) bad('too many standing in the way', blocking);
  else ok('at most two stand on the route itself');
}

console.log('');
console.log(fails ? fails + ' failed' : 'the routes are walkable');
process.exit(fails ? 1 : 0);
