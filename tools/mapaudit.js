/* Static audit of the level grids. Nothing renders: this reads the same
   arrays the game builds from and asks the questions a playthrough cannot
   ask cheaply — is the exit reachable, is a prop standing in a doorway,
   is one of them spawned inside a wall. */
const fs = require('fs');
const src = fs.readFileSync(__dirname + '/../apocalypse.js', 'utf8');

/* pull the grids and the character classes straight out of the source */
function grab(name) {
  const i = src.indexOf('MAPS.' + name + ' = [');
  const j = src.indexOf('];', i);
  return src.slice(src.indexOf('[', i) + 1, j)
    .split('\n').map(s => s.trim()).filter(s => s.startsWith('"'))
    .map(s => s.slice(1, s.lastIndexOf('"')));
}
function constOf(re) { const m = src.match(re); return m ? m[1] : ''; }
const SOLID = constOf(/var SOLID\s*=\s*"([^"]*)"/).replace(/ /g, '');
const OPAQUE = constOf(/var OPAQUE\s*=\s*"([^"]*)"/);
const HIDE = constOf(/var HIDE\s*=\s*"([^"]*)"/);
/* the game decides walkability by "not in SOLID", so this does too */
const EXTRA = '.,y '; 

const NAMES = ['home', 'streets', 'hospital', 'escape', 'roadside', 'campsite', 'gates'];
let fails = 0, warns = 0;
const bad = (m, d) => { fails++; console.log('  FAIL ' + m + (d ? '  ' + JSON.stringify(d) : '')); };
const warn = (m, d) => { warns++; console.log('  warn ' + m + (d ? '  ' + JSON.stringify(d) : '')); };
const ok = m => console.log('  ok   ' + m);

for (const name of NAMES) {
  const g = grab(name);
  console.log('\n== ' + name + '  ' + g[0].length + 'x' + g.length);
  const W = g[0].length, H = g.length;
  const at = (x, y) => (x < 0 || y < 0 || x >= W || y >= H) ? '#' : g[y][x];

  /* 1. every row the same width */
  const wrong = g.map((r, i) => [i, r.length]).filter(r => r[1] !== W);
  if (wrong.length) bad('rows are not all the same width', wrong); else ok('rectangular');

  /* 2. every character is one the builder knows */
  const KNOWN = new Set((SOLID + OPAQUE + HIDE + EXTRA +
    'hlqriSXzxbg*NAaI1').split(''));
  const unknown = {};
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const c = at(x, y);
    if (!KNOWN.has(c)) unknown[c] = (unknown[c] || 0) + 1;
  }
  if (Object.keys(unknown).length) bad('characters the grid legend does not cover', unknown);
  else ok('every character is known');

  /* 3. flood fill from the spawn */
  let spawn = null, exit = null;
  const marks = { A: [], C: [], H: [], W: [], T: [], N: [], Q: [], w: [], g: [], z: [], x: [] };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const c = at(x, y);
    if (c === 'S') spawn = { x, y };
    if (c === 'X') exit = { x, y };
    if (marks[c]) marks[c].push({ x, y });
  }
  if (!spawn) { warn('no start tile'); }
  const walkable = c => c !== ' ' && SOLID.indexOf(c) < 0;
  const seen = new Set();
  if (spawn) {
    const q = [spawn]; seen.add(spawn.y * W + spawn.x);
    while (q.length) {
      const p = q.pop();
      for (const d of [[1,0],[-1,0],[0,1],[0,-1]]) {
        const nx = p.x + d[0], ny = p.y + d[1], k = ny * W + nx;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H || seen.has(k)) continue;
        const c = at(nx, ny);
        /* doors are walkable once opened, so treat them as passable here */
        if (!walkable(c) && 'dDPG'.indexOf(c) < 0) continue;
        seen.add(k); q.push({ x: nx, y: ny });
      }
    }
    ok('reachable floor: ' + seen.size + ' tiles');
  }
  const reach = p => seen.has(p.y * W + p.x);
  /* something standing next to a marker still counts: she interacts from beside it */
  const nearReach = p => reach(p) || [[1,0],[-1,0],[0,1],[0,-1]].some(d => {
    const k = (p.y + d[1]) * W + (p.x + d[0]); return seen.has(k);
  });

  if (exit && spawn) {
    if (nearReach(exit)) ok('the way out is reachable'); else bad('the way out is walled off', exit);
  }
  for (const [c, label] of [['A','him'],['C','the car'],['H','the horse'],['W','the wire panel'],
                            ['T','the television'],['N','the note'],['Q','the desk'],
                            ['w','the woodpiles'],['g','the fire pit']]) {
    let miss = 0;
    for (const p of marks[c]) if (!nearReach(p)) { bad(label + ' cannot be got to', p); miss++; }
    if (marks[c].length && !miss) ok(label + ': ' + marks[c].length + ' reachable');
  }
  for (const p of marks.z.concat(marks.x)) {
    if (!nearReach(p)) bad('one of them is spawned somewhere it can never leave', p);
  }
  if (marks.z.length + marks.x.length) ok('all ' + (marks.z.length + marks.x.length) + ' of them can move');

  /* 4. nothing solid parked in a doorway, and no door that opens into a wall */
  let doorBad = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const c = at(x, y);
    if ('dDPG'.indexOf(c) < 0) continue;
    const ns = [at(x-1,y), at(x+1,y), at(x,y-1), at(x,y+1)];
    const open = ns.filter(n => walkable(n) || 'dDPG'.indexOf(n) >= 0).length;
    if (open < 2) { bad('a door with nothing on one side of it', { x, y, ns }); doorBad++; }
  }
  if (!doorBad) ok('every door has a room on both sides');

  /* 5. a hiding place you cannot get into is not a hiding place */
  let hideBad = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (HIDE.indexOf(at(x, y)) < 0) continue;
    if (!reach({ x, y })) { bad('a hiding place that cannot be reached', { x, y }); hideBad++; }
  }
  if (!hideBad) ok('every hiding place can be got into');
}
console.log('\n' + (fails ? fails + ' failed' : 'all grids sound') + (warns ? ', ' + warns + ' warnings' : ''));
process.exit(fails ? 1 : 0);
