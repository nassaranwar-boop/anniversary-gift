/* IS THE NIGHT SHIFT'S SCORE ACTUALLY MUSIC?

   The chapter grew a harmony: eight bars of chords with the tune
   played twice across them, a bass, and a long line over the top. None
   of that is checkable by anything else in this repo. A wrong note in
   a written melody throws nothing, renders identically, and is silent
   to every other suite here — the only way to find it is to read the
   line out of the source and hold it against the chord it is now
   written over. That is all this does.

   The sibling of tools/scorecheck.js, which does the same job for
   apocalypse.js. Both exist because "it sounded fine to me" is not a
   test.                                      node tools/shiftscore.js */
const fs = require('fs');
const src = fs.readFileSync(__dirname + '/../night-shift.js', 'utf8');
function grab(name) {
  /* the source lines these up in columns, so the spacing before the
     equals sign is not fixed */
  const m = new RegExp('const\\s+' + name + '\\s*=\\s*\\[').exec(src);
  if (!m) throw new Error('no ' + name);
  const i = m.index;
  const j = src.indexOf('];', i);
  return eval(src.slice(src.indexOf('[', i), j + 1).replace(/\/\*[\s\S]*?\*\//g, ''));
}
const FIG = grab('FIG'), FIG_B = grab('FIG_B'), FIG_C = grab('FIG_C'), FIG_D = grab('FIG_D');
const WARM = grab('WARM'), WARM3 = grab('WARM3');
const CHORDS = grab('CHORDS'), BASS = grab('BASS'), HYMN = grab('HYMN');
const CHORDS_W = grab('CHORDS_W'), BASS_W = grab('BASS_W'), HYMN_W = grab('HYMN_W');
const ARCH = grab('ARCH');
const BARS = [FIG, FIG_B, FIG_C, FIG_D];

let pass = 0, fail = 0;
const ok = (n, c, x) => { if (c) { pass++; console.log('  ok   ' + n); }
                          else { fail++; console.log('  FAIL ' + n + (x ? '  ' + JSON.stringify(x) : '')); } };
const pc = (n) => ((n % 12) + 12) % 12;
const NAME = ['A','A#','B','C','C#','D','D#','E','F','F#','G','G#'];
const nm = (n) => NAME[pc(n)];
/* the two keys the chapter is in, as pitch classes from A */
const MINOR = [0, 2, 3, 5, 7, 8, 10];          // A B C D E F G
const MAJOR = [0, 2, 4, 5, 7, 9, 11];          // A B C# D E F# G#

console.log('THE EIGHT BARS');
[['minor', CHORDS, BASS, HYMN, MINOR], ['major', CHORDS_W, BASS_W, HYMN_W, MAJOR]]
  .forEach(([key, ch, bs, hy, scale]) => {
  ok(key + ': eight bars of chords', ch.length === 8, ch.length);
  ok(key + ': a root for every bar', bs.length === 8, bs.length);
  ok(key + ': a hymn note for every bar', hy.length === 8, hy.length);
  /* every note of every chord has to belong to the key, or the pad is
     playing in one key while the music box plays in another */
  const off = [];
  ch.forEach((c, i) => c.forEach((n) => {
    if (scale.indexOf(pc(n)) < 0) off.push('bar' + i + ' ' + nm(n));
  }));
  ok(key + ': every chord tone is in the key', off.length === 0, off);
  /* the root the bass plays has to be the root the chord is built on */
  const wrong = [];
  ch.forEach((c, i) => { if (pc(bs[i]) !== pc(c[0])) wrong.push('bar' + i + ' ' + nm(bs[i]) + ' vs ' + nm(c[0])); });
  ok(key + ': the bass plays the chord it is under', wrong.length === 0, wrong);
  /* the bass has to stay in a register that a phone can reproduce and
     that does not cross up into the tune */
  const range = bs.map((n) => 220 * Math.pow(2, n / 12));
  ok(key + ': the bass stays between 80 and 160 Hz',
     Math.min(...range) > 80 && Math.max(...range) < 160,
     range.map((f) => Math.round(f)));
  /* THE LINE. Every note of it has to be in the chord underneath it --
     this is the one voice with nothing to hide behind. */
  const clash = [];
  hy.forEach((n, i) => {
    if (!ch[i].some((c) => pc(c) === pc(n))) clash.push('bar' + i + ' ' + nm(n) + ' over ' + ch[i].map(nm).join(''));
  });
  ok(key + ': every hymn note is a chord tone', clash.length === 0, clash);
  /* and it has to be a LINE, not a series of arrivals: seven steps and
     exactly one leap, which is the one the whole phrase is built for */
  const steps = hy.slice(1).map((n, i) => n - hy[i]);
  const leaps = steps.filter((x) => Math.abs(x) > 2);
  ok(key + ': the hymn moves by step except where it leaps',
     leaps.length <= 2, steps);
  ok(key + ': the leap is in the seventh bar and it is upward',
     hy[6] - hy[5] >= 4 && hy[6] === Math.max(...hy), { from: nm(hy[5]), to: nm(hy[6]) });
  /* the eighth bar has to be the one that wants the first bar back */
  ok(key + ': the phrase ends on the dominant', pc(ch[7][0]) === pc(-5), nm(ch[7][0]));
  ok(key + ': and the seventh bar is somewhere it has not been',
     !ch.slice(0, 6).some((c) => pc(c[0]) === pc(ch[6][0])), nm(ch[6][0]));
});

console.log('\nTHE TUNE AGAINST THE CHORDS');
/* the four-bar figure plays twice across the eight, so every bar of it
   is heard over two different chords. Both of those have to work. */
const strong = [0, 4, 8, 12];
const bad = [];
for (let b = 0; b < 8; b++) {
  const fig = BARS[b & 3], ch = CHORDS[b];
  strong.forEach((s) => {
    const n = fig[s];
    const inChord = ch.some((c) => pc(c) === pc(n));
    /* a strong beat is either in the chord or a step from one of its
       notes -- anything else is a note sitting on a chord it is not in */
    const near = ch.some((c) => Math.abs(pc(c - n)) === 1 || Math.abs(pc(c - n)) === 2 ||
                                Math.abs(pc(c - n)) === 10 || Math.abs(pc(c - n)) === 11);
    if (!inChord && !near) bad.push('bar' + b + ' beat' + (s / 4 + 1) + ' ' + nm(n) + ' over ' + ch.map(nm).join(''));
  });
}
ok('every strong beat of the tune belongs over its chord', bad.length === 0, bad);
/* and the first beat of each bar, which is the one she hears as the
   note, should be IN the chord more often than not */
let landed = 0;
for (let b = 0; b < 8; b++) if (CHORDS[b].some((c) => pc(c) === pc(BARS[b & 3][0]))) landed++;
ok('the downbeat is a chord tone in most bars', landed >= 5, landed + '/8');

/* the same for the warm phrase, which plays over the major set */
const badW = [];
for (let b = 0; b < 8; b++) {
  strong.forEach((s) => {
    [WARM[s], WARM3[s]].forEach((n) => {
      if (MAJOR.indexOf(pc(n)) < 0) badW.push('bar' + b + ' ' + nm(n));
    });
  });
}
ok('the warm phrase stays inside A major', badW.length === 0, badW);

console.log('\nTHE SHAPE');
ok('eight bars of arch', ARCH.length === 8, ARCH.length);
ok('the loudest bar is the seventh',
   ARCH.indexOf(Math.max(...ARCH)) === 6, ARCH);
ok('the quietest bar is the first', ARCH.indexOf(Math.min(...ARCH)) === 0, ARCH);
ok('the second pass starts back down', ARCH[4] < ARCH[3], [ARCH[3], ARCH[4]]);
ok('the eighth bar lets go', ARCH[7] < ARCH[6], [ARCH[6], ARCH[7]]);
/* a phrase nobody can hear the shape of is not a phrase */
ok('the arch is worth at least a fifth of the level',
   Math.max(...ARCH) / Math.min(...ARCH) >= 1.25,
   (Math.max(...ARCH) / Math.min(...ARCH)).toFixed(2));
/* and not so much that a quiet bar disappears */
ok('and not more than half', Math.max(...ARCH) / Math.min(...ARCH) <= 1.8);

console.log('\nTHE MELODY ITSELF');
/* the figure was rewritten because the old one was 86% leaps. It has
   to stay a line. */
BARS.forEach((fig, i) => {
  const notes = fig.filter((_, k) => k % 2 === 0);
  const iv = notes.slice(1).map((n, k) => Math.abs(n - notes[k]));
  const leaps = iv.filter((x) => x > 2).length;
  ok('bar ' + i + ' of the figure is mostly steps',
     leaps / iv.length <= 0.34, leaps + '/' + iv.length);
});

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
