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
/* one tune per place, and every one of them held to the same standard */
const PLACES = { STREET: grab('STREET'), WARD: grab('WARD'), ROAD: grab('ROAD'),
                 MORN: grab('MORN'), FENCE: grab('FENCE'), REST: grab('REST'),
                 SIGNAL: grab('SIGNAL'), DUSK: grab('DUSK'), CAMP: grab('CAMP'),
                 DAWN: grab('DAWN'), VIGIL: grab('VIGIL') };
const CHORDS = grab('CHORDS'), ROOTS = grab('ROOTS');
const CHORDS_B = grab('CHORDS_B'), ROOTS_B = grab('ROOTS_B');
const DYNS = grab('DYNS');

let pass = 0, fail = 0;
const ok = (n, c, x) => { if (c) { pass++; console.log('  ok   ' + n); }
                          else { fail++; console.log('  FAIL ' + n + (x ? '  ' + JSON.stringify(x) : '')); } };

const pc = n => ((n % 12) + 12) % 12;
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


/* ---- THE SECOND TIME ROUND ----
   The whole point of the second chord table is that the same two
   melodies can be played over it without a single note being changed.
   That is only true if every bar of it still contains the note each
   tune lands on, so it is checked exactly the way the first one is —
   and it has to actually be DIFFERENT, or it has bought nothing. */
ok('the second progression is eight bars too', CHORDS_B.length === 8, CHORDS_B.length);
ok('and has a bass note for each of them', ROOTS_B.length === 8, ROOTS_B.length);
const bOut = [];
CHORDS_B.forEach((c, i) => c.forEach(n => { if (!inScale(n)) bOut.push({ bar: i, n }); }));
ok('every note in it is in the key', bOut.length === 0, bOut);
const bRoot = ROOTS_B.map((r, i) => ({ bar: i, r, chord: CHORDS_B[i].map(pc) }))
                     .filter(o => o.chord.indexOf(pc(o.r)) < 0);
ok('and the bass is playing a note of its own chord', bRoot.length === 0, bRoot);

for (const [name, mel] of [['the tune', TUNE], ['the second tune', WARM]]) {
  const bad = [];
  for (const [b, n] of mel) {
    if (b % 4 !== 0) continue;
    const chord = CHORDS_B[Math.floor(b / 4)].map(pc);
    if (chord.indexOf(pc(n)) < 0) bad.push({ beat: b, note: n, chord });
  }
  ok(name + ' still lands on a chord tone the second time round',
     bad.length === 0, bad);
}
const sameTable = JSON.stringify(CHORDS_B.map(c => c.map(pc).sort())) ===
                  JSON.stringify(CHORDS.map(c => c.map(pc).sort()));
ok('and it is a different set of chords, not the same ones again', !sameTable);
const movedBars = CHORDS_B.filter((c, i) =>
  JSON.stringify(c.map(pc).sort()) !== JSON.stringify(CHORDS[i].map(pc).sort())).length;
ok('most of the bars actually change', movedBars >= 6, { movedBars });
const bassMoved = ROOTS_B.filter((r, i) => pc(r) !== pc(ROOTS[i])).length;
ok('and the bass walks somewhere new', bassMoved >= 5, { bassMoved });

/* the four passes have to be four different volumes, or they are one */
ok('the four times round are four different weights',
   new Set(DYNS).size === 4 && DYNS.length === 4, DYNS);
ok('and none of them is silent or twice as loud as the piece',
   DYNS.every(v => v > 0.5 && v <= 1.25), DYNS);

/* ---- ONE TUNE PER PLACE ----
   Two melodies over eleven cues is why the whole chapter sounded like
   one piece of music in eleven hats. There are eight now, and every one
   of the new ones has to survive exactly what the first two survive:
   in the key, one note at a time, eight bars with something in each of
   them, a singable range, and — the hard one — every downbeat landing
   on a chord tone in BOTH progressions, because that is the only reason
   any cue can follow any other without the ground moving. */
const both = [];
for (let i = 0; i < 8; i++) {
  const a = new Set(CHORDS[i].map(pc)), b2 = new Set(CHORDS_B[i].map(pc));
  both.push([...a].filter(n => b2.has(n)));
}
ok('every bar has somewhere for a melody to land in both progressions',
   both.every(x => x.length >= 2), both.map(x => x.length));

for (const [name, mel] of Object.entries(PLACES)) {
  const outK = mel.filter(([, n]) => !inScale(n)).map(([b, n]) => ({ b, n }));
  ok(name + ' is in the key', outK.length === 0, outK);
  const srt = mel.slice().sort((a, b3) => a[0] - b3[0]);
  let ov = null;
  for (let i = 1; i < srt.length; i++)
    if (srt[i][0] < srt[i - 1][0] + srt[i - 1][2] - 1e-9) ov = { a: srt[i - 1], b: srt[i] };
  ok(name + ' is one note at a time', !ov, ov);
  ok(name + ' is exactly eight bars',
     Math.max(...mel.map(([b3, , d]) => b3 + d)) === 32, name);
  ok(name + ' has something in every bar',
     new Set(mel.map(([b3]) => Math.floor(b3 / 4))).size === 8, name);
  const clash = mel.filter(([b3, n]) => b3 % 4 === 0 && both[b3 / 4].indexOf(pc(n)) < 0)
                   .map(([b3, n]) => ({ beat: b3, note: n }));
  ok(name + ' lands on a chord tone in both progressions', clash.length === 0, clash);
  const lo = Math.min(...mel.map(([, n]) => n)), hi = Math.max(...mel.map(([, n]) => n));
  ok(name + ' stays in a range one voice could sing', hi - lo <= 24, { lo, hi });
}
/* and they have to be eight DIFFERENT tunes, not one written out eight times */
const shapes = Object.entries(PLACES).concat([['TUNE', TUNE], ['WARM', WARM]])
  .map(([n, m]) => [n, JSON.stringify(m.map(x => x[1]))]);
const dupes = shapes.filter(([n, sh], i) => shapes.findIndex(o => o[1] === sh) !== i);
ok('all thirteen of them are different tunes', dupes.length === 0, dupes.map(d => d[0]));
ok('there are thirteen written tunes, not two', shapes.length === 13, shapes.length);

/* ---- THE CUES ----
   Eleven of them now, and the whole reason any one can follow any other
   without the harmony jumping is that they are all written on the same
   eight bars. That is an invariant, not a coincidence, so it is checked:
   every cue must read its bar out of the shared progression, and none
   may keep a chord table of its own. */
const cueBlock = src.slice(src.indexOf('var PIECES = {'),
                           src.indexOf('function retireBus'));
const cues = [...cueBlock.matchAll(/^          ([a-z]+): \{ bpm: (\d+)/gm)]
                .map(m => ({ name: m[1], bpm: Number(m[2]) }));
const want = ['dread','streets','sterile','drive','open','hearth','hunt','held',
              'search','grief','gate','home','after',
              'signal','dusk','camp','dawn','settled'];
ok('every cue the game asks for exists',
   want.every(n => cues.some(c => c.name === n)),
   { found: cues.map(c => c.name), want });
ok('there are eighteen of them, not six', cues.length === want.length, cues.length);


/* each one has to take its harmony from the shared progression */
const bodies = {};
for (const c of cues) {
  const i = cueBlock.indexOf(c.name + ': { bpm:');
  const j = cueBlock.indexOf('\n          } },', i);
  bodies[c.name] = cueBlock.slice(i, j < 0 ? cueBlock.length : j);
}
/* the last cue is the only piece in the chapter allowed to come to rest:
   everything else ends on the fifth so that it can go round again */
ok('one of them, and only one, lands on the root',
   /hz\(0, 0\)/.test(bodies.after) &&
   cues.filter(c => /piano\(hz\(0, 0\)/.test(bodies[c.name])).length === 1,
   cues.filter(c => /piano\(hz\(0, 0\)/.test(bodies[c.name])).map(c => c.name));

/* and the places play their own tune rather than all sharing hers */
const OWN = { streets: 'STREET_AT', sterile: 'WARD_AT', drive: 'ROAD_AT',
              open: 'MORN_AT', gate: 'FENCE_AT', after: 'REST_AT',
              signal: 'SIGNAL_AT', dusk: 'DUSK_AT', camp: 'CAMP_AT',
              dawn: 'DAWN_AT', settled: 'VIGIL_AT' };
/* AND NO TWO SCENES IN A ROW MAY PLAY THE SAME ONE.
   The ride out, the sunrise and the ride in the morning were all the
   same cue, one after another with a level in between. */
const SEQUENCE = [
  ['the house', 'dread'], ['the city', 'streets'], ['the ward', 'sterile'],
  ['the radio', 'signal'], ['the ambulance bay', 'sterile'], ['the drive', 'drive'],
  ['the lane', 'streets'], ['the ride out', 'dusk'], ['the clearing', 'camp'],
  ['the fire', 'hearth'], ['the sunrise', 'dawn'], ['the coast road', 'open'],
  ['the gate', 'gate'], ['being let in', 'settled'], ['the roof', 'home'],
  ['the last screen', 'after']
];
const runs = SEQUENCE.filter((s2, i) => i && s2[1] === SEQUENCE[i - 1][1]);
ok('no two scenes running play the same cue', runs.length === 0, runs);
const distinctCues = new Set(SEQUENCE.map(s2 => s2[1]));
ok('sixteen scenes, fourteen different pieces of music',
   distinctCues.size >= 14, distinctCues.size);
const borrowed = Object.keys(OWN).filter(k => !bodies[k] || bodies[k].indexOf(OWN[k]) < 0);
ok('and each place plays the tune written for it', borrowed.length === 0, borrowed);

const rogue = cues.filter(c => !/RT\(b|CH\(b/.test(bodies[c.name]));
ok('and every one of them sits on the shared eight bars',
   rogue.length === 0, rogue.map(c => c.name));
/* and every one of them has to breathe with the passes, or it is a loop */
const flat = cues.filter(c => !/DYN\(b\)/.test(bodies[c.name]));
ok('and every one of them changes weight as the passes go round',
   flat.length === 0, flat.map(c => c.name));
const staticCues = cues.filter(c => !/passOf\(b\)|b % 128|b % 64|warmNow|late/.test(bodies[c.name]));
ok('and almost all of them play differently on a later pass',
   staticCues.length <= 1, staticCues.map(c => c.name));

/* a bar of the fastest cue and a bar of the slowest have to be joinable:
   a tempo change on a bar line is normal, a tempo change of ten times is
   a different piece of music */
const bpms = cues.map(c => c.bpm);
const ratio = Math.max(...bpms) / Math.min(...bpms);
ok('the fastest and the slowest are within reach of each other',
   ratio <= 3.2, { fastest: Math.max(...bpms), slowest: Math.min(...bpms), ratio });

/* the frightened ones must not carry a tune, and the tender ones must */
ok('being chased has no melody in it',
   !/line\(TUNE_AT|line\(WARM_AT/.test(bodies.hunt), 'hunt');
ok('and neither does hiding',
   !/line\(TUNE_AT|line\(WARM_AT/.test(bodies.held), 'held');
ok('the one that is allowed to hurt is her tune, slowly',
   /line\(TUNE_AT/.test(bodies.grief) && cues.find(c => c.name === 'grief').bpm <= 50,
   'grief');

/* ---- HOW ONE BECOMES ANOTHER ----
   The join is the whole point of writing them on one progression, so the
   machinery that makes it is checked too. */
const swap = src.slice(src.indexOf('function pump() {'),
                       src.indexOf('var wanted = null, muted'));
ok('a change waits for a bar line', /beat % 4 === 0/.test(swap), swap.slice(0, 80));
ok('unless it cannot wait', /urgent \|\| beat % 4 === 0/.test(swap));
/* The count may only be reset in the two places where restarting is the
   right answer: coming from silence, and a hand-off at a scene change,
   where the picture has cut and the new piece should begin at the top of
   its own first bar. Inside the scheduler — a change of cue within a
   level — it must never be touched, or the phrase restarts and the join
   sounds like a track change. */
ok('the beat carries across a change within a scene', !/beat = 0/.test(swap));
const setter = src.slice(src.indexOf('function setPiece(name, vol, now, cut)'),
                         src.indexOf('setPiece.mute'));
const resets = (setter.match(/beat = 0/g) || []).length;
ok('and it is only ever reset in the two places that earn it', resets === 2, resets);
ok('one of them is coming from silence', /if \(!piece\) \{[\s\S]{0,400}beat = 0/.test(setter));
ok('and the other is a scene change handing over',
   /if \(cut\) \{[\s\S]{0,900}beat = 0/.test(setter));
/* a hand-off has to actually be a hand-off: old one out, a gap, new one in */
ok('a cut lets the old cue finish before the new one starts',
   /retireBus\(ctx\.currentTime, 0\.4/.test(setter) && /setTimeout\(function/.test(setter));
ok('and both sides of it are scheduled in the audio clock, not wall time',
   /retireBus\(nextAt/.test(swap) && /startBus\(nextAt/.test(swap));

/* ---- WHO CHOOSES ----
   Danger over a mood over the step over the level, and a cut over all of
   it. If that order is wrong the music argues with the scene. */
const driver = src.slice(src.indexOf('function updateScore(dt) {'),
                         src.indexOf('function tick(dt)'));
ok('a cut is never argued with', /if \(G\.cine\) return;/.test(driver));
ok('being seen beats everything else',
   driver.indexOf('dangerCue = "hunt"') < driver.indexOf('moodT > 0'));
ok('a mood beats the step',
   driver.indexOf('moodT > 0') < driver.indexOf('st.cue'));
ok('and the danger holds on after the danger has gone',
   /dangerHold = 5\.0|dangerHold -= dt/.test(driver));

/* ---- THE THING THAT HURT ----
   A gain set straight to its value is not an attack, it is a step, and a
   step on a square wave is a click. Nothing in the score may do that. */
const voices = src.slice(src.indexOf('/* ---- the instruments ---- */'),
                         src.indexOf('/* play whatever the written line'));
/* only the value AT THE START of a note matters: holding a level part
   way through an envelope it has already ramped to is not a step. */
const steps = [...voices.matchAll(/gain\.setValueAtTime\(([^,]+), at\)/g)]
                 .map(m => m[1].trim())
                 .filter(v => !/^0\.0001$/.test(v));
ok('no voice in the score starts at full volume', steps.length === 0, steps);
ok('and the tick is not a square wave any more',
   !/o\.type = "square"/.test(voices.slice(voices.indexOf('function tick'))), 'tick');

/* ---- THE JOIN ---- */
ok('a change is played into, not cut to',
   /swell\(hz\(RT\(beat\), -3\), nextAt/.test(src));

console.log('');
console.log(pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
