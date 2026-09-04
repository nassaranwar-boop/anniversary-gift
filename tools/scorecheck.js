/* Is the music actually music?

   A wrong note in a written melody is silent to every other test in this
   repo: nothing throws, nothing renders differently, and the only way to
   find out is to hear it. This reads the written line out of the game and
   checks it against the harmony it is written over. */
const fs = require('fs');
const src = fs.readFileSync(__dirname + '/../apocalypse.js', 'utf8');
function grab(name) {
  const i = src.indexOf('var ' + name + ' = [');
  const j = src.indexOf('];', i);
  return eval(src.slice(src.indexOf('[', i), j + 1).replace(/\/\*[\s\S]*?\*\//g, ''));
}
const TUNE = grab('TUNE'), UNDER = grab('UNDER'), WARM = grab('WARM');
const CHORDS = grab('CHORDS'), ROOTS = grab('ROOTS');

let pass = 0, fail = 0;
const ok = (n, c, x) => { if (c) { pass++; console.log('  ok   ' + n); }
                          else { fail++; console.log('  FAIL ' + n + (x ? '  ' + JSON.stringify(x) : '')); } };

/* A natural minor: A B C D E F G */
const SCALE = [0, 2, 3, 5, 7, 8, 10];
const inScale = n => SCALE.indexOf(((n % 12) + 12) % 12) >= 0;

const outOfKey = TUNE.filter(([, n]) => !inScale(n)).map(([b, n]) => ({ b, n }));
ok('every note of the tune is in the key', outOfKey.length === 0, outOfKey);
const underOut = UNDER.filter(([, n]) => !inScale(n)).map(([b, n]) => ({ b, n }));
ok('so is the line underneath it', underOut.length === 0, underOut);

/* eight bars of four, and the tune covers all of them */
const end = Math.max(...TUNE.map(([b, , d]) => b + d));
ok('it is exactly eight bars long', end === 32, { end });
const bars = new Set(TUNE.map(([b]) => Math.floor(b / 4)));
ok('and there is something in every bar', bars.size === 8, { bars: [...bars] });

/* one note at a time: a melody with itself on top of itself is a chord */
const sorted = TUNE.slice().sort((a, b) => a[0] - b[0]);
let overlap = null;
for (let i = 1; i < sorted.length; i++)
  if (sorted[i][0] < sorted[i - 1][0] + sorted[i - 1][2] - 1e-9)
    overlap = { a: sorted[i - 1], b: sorted[i] };
ok('it is one note at a time', !overlap, overlap);

/* the note a bar lands on has to belong to that bar's chord, or the
   harmony is fighting the tune */
const clashes = [];
for (const [b, n] of TUNE) {
  if (b % 4 !== 0) continue;                     /* downbeats only */
  const chord = CHORDS[Math.floor(b / 4)].map(x => ((x % 12) + 12) % 12);
  if (chord.indexOf(((n % 12) + 12) % 12) < 0) clashes.push({ beat: b, note: n, chord });
}
ok('every downbeat lands on a chord tone', clashes.length === 0, clashes);

/* singable: a tenth is about as far as a tune should reach */
const lo = Math.min(...TUNE.map(([, n]) => n)), hi = Math.max(...TUNE.map(([, n]) => n));
ok('the range is singable', hi - lo <= 17, { lo, hi, span: hi - lo });

/* it should not finish on the root, or it stops rather than going round */
const last = sorted[sorted.length - 1][1];
ok('it ends unresolved, so it can go round again', ((last % 12) + 12) % 12 !== 0, { last });

/* the bass note of each bar is the root of that bar's chord */
const badRoot = [];
for (let i = 0; i < 8; i++) {
  const c = ((CHORDS[i][0] % 12) + 12) % 12, r = ((ROOTS[i] % 12) + 12) % 12;
  if (c !== r) badRoot.push({ bar: i, chord: CHORDS[i], root: ROOTS[i] });
}
ok('the bass is playing the root of each chord', badRoot.length === 0, badRoot);

/* the progression should move: eight bars of the same chord is a drone */
const distinct = new Set(CHORDS.map(c => c.join(',')));
ok('the harmony moves', distinct.size >= 4, { distinct: distinct.size });

/* ---- and the second tune, over the same eight bars ---- */
const warmOut = WARM.filter(([, n]) => !inScale(n)).map(([b, n]) => ({ b, n }));
ok('the second tune is in the key too', warmOut.length === 0, warmOut);
const wEnd = Math.max(...WARM.map(([b, , d]) => b + d));
ok('and it is the same eight bars', wEnd === 32, { wEnd });
const wSorted = WARM.slice().sort((a, b) => a[0] - b[0]);
let wOver = null;
for (let i = 1; i < wSorted.length; i++)
  if (wSorted[i][0] < wSorted[i - 1][0] + wSorted[i - 1][2] - 1e-9)
    wOver = { a: wSorted[i - 1], b: wSorted[i] };
ok('and one note at a time', !wOver, wOver);
const wClash = [];
for (const [b, n] of WARM) {
  if (b % 4 !== 0) continue;
  const chord = CHORDS[Math.floor(b / 4)].map(x => ((x % 12) + 12) % 12);
  if (chord.indexOf(((n % 12) + 12) % 12) < 0) wClash.push({ beat: b, note: n, chord });
}
ok('and every downbeat of it lands on a chord tone', wClash.length === 0, wClash);
/* the two of them have to be different tunes, not the same one twice */
const same = JSON.stringify(TUNE.map(x => x[1])) === JSON.stringify(WARM.map(x => x[1]));
ok('the two tunes are different tunes', !same);
/* the warm one settles rather than hanging: it should not end on the
   same unresolved note the first one does */
const wLast = wSorted[wSorted.length - 1][1];
ok('and it settles where the first one does not',
   ((wLast % 12) + 12) % 12 !== ((sorted[sorted.length - 1][1] % 12) + 12) % 12,
   { wLast });

console.log('');
console.log(pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
