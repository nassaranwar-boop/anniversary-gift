/* EVERY WORD HE SAYS OUT LOUD, AS A THING A PERSON CAN READ.

   The chapter's most important asset is a man's voice and it does not
   have one: it has whatever text-to-speech engine is installed on the
   phone it is being played on. This prints the script so that can be
   fixed by somebody standing in a quiet room with a phone.

     node tools/voicesheet.js              the script, to read
     node tools/voicesheet.js --json       voice/manifest.json

   The manifest maps an id to the EXACT words that were recorded for
   it, and the game looks a line up by its words rather than by its id.
   That is deliberate: rewrite a line and it stops matching, so it goes
   back to the synthesiser instead of playing a take of the old words
   over the top of the new caption. Re-record it and it comes back.

   Ids are readable on purpose — intro-03, tape2-07, reveal-4 — because
   somebody has to name a hundred and fifty files by hand and
   a1b2c3d4.mp3 is not a thing anybody can name by hand.             */
const fs = require('fs');
const src = fs.readFileSync(__dirname + '/../night-shift.js', 'utf8');

/* the script object is a literal in the source; pull it out and run it
   in a bare sandbox rather than loading the whole chapter, which wants
   a DOM, an audio context and a WebGL canvas */
const key = 'const NS = {';
const i = src.indexOf(key);
if (i < 0) { console.error('cannot find the script'); process.exit(1); }
let depth = 0, j = i + key.length - 1;
for (; j < src.length; j++) {
  const c = src[j];
  if (c === '{') depth++;
  else if (c === '}') { depth--; if (!depth) break; }
}
const NS = eval('(' + src.slice(i + key.length - 1, j + 1) + ')');

/* everything that is SPOKEN. Not everything that is shown: the cards,
   the tags and the pages are read off the screen and always were. */
/* WHO SAYS IT, AND IN WHOSE VOICE.

   For a long time every recorded line in the chapter was Anwar, which
   was right while the only recorded lines were his. It stopped being
   right the moment the four of them started talking to each other on
   night five and all the way through the last hour: a ballerina and an
   owl and a jack-in-the-box were all coming out of the same fifty-year
   -old documentary narrator.

   Five models, five parts. The pace and the pitch shift are per
   character too, because two of these are the same model family and
   what separates a clock from a jester is as much tempo as timbre.

   Measured with tools/castcheck.js rather than guessed, because the
   one failure mode that would pass every other test in this repository
   is a casting sheet that quietly fell back to the narrator for all
   four and sounded exactly like the thing it was written to fix.
   Median fundamentals, as rendered:

     anwar       92 Hz  the tape, and the lowest thing in the chapter.
                        He is talking to her from underneath all of it.
     cogsworth  100 Hz  just above him, slower than anybody: he is a
                        clock, he does not hurry, and he is the oldest
                        of the four.
     chime      139 Hz  a small brass owl with a bell in it.
     jax        178 Hz  light and fast, because he talks like somebody
                        who has decided not to be afraid out loud, and
                        pulled down three semitones from where his
                        model sits so that the last four lines in the
                        chapter have some weight under them.
     marabelle  195 Hz  the one voice in the shop that is not a man,
                        level and unbothered — she is the only one of
                        the four who is never frightened of anything.

   No two of those are within a semitone of each other, which is the
   check castcheck actually makes: closer than that and, to an ear,
   they are the same person.                                          */
const VOICE = {
  anwar:     { model: 'en_GB-alan-medium',                  pace: '1.16', depth: '1.2' },
  cogsworth: { model: 'en_GB-northern_english_male-medium', pace: '1.26', depth: '2.2' },
  chime:     { model: 'en_US-ryan-high',                    pace: '1.02', depth: '-1.6' },
  marabelle: { model: 'en_US-lessac-high',                  pace: '1.12', depth: '-2.0' },
  jax:       { model: 'en_GB-semaine-medium',               pace: '0.98', depth: '3.0' },
};

const OUT = [];
const add = (id, text, note, who) => {
  if (!text) return;
  /* the screen markup never reaches a mouth */
  const t = String(text)
    .replace(/&[lr]dquo;/g, '"').replace(/&mdash;/g, '—')
    .replace(/&amp;/g, '&').replace(/<[^>]+>/g, '').trim();
  if (t) OUT.push({ id, text: t, note: note || '', who: who || 'anwar' });
};

(NS.intro && NS.intro.beats || []).forEach((b, bi) => {
  b.lines.forEach((l, li) => add('intro-' + (bi + 1) + '-' + (li + 1), l,
    'the camera is in the ' + b.room));
});
(NS.terms && NS.terms.lines || []).forEach((l, k) => add('terms-' + (k + 1), l,
  'the shutters are coming down'));
for (const n in (NS.tapes || {})) {
  NS.tapes[n].forEach((x, k) => add('tape' + n + '-' + String(k + 1).padStart(2, '0'), x.t,
    'night ' + n + ', about ' + (12 + Math.floor(x.h)) % 12 + ' o\'clock', x.who));
}
for (const k in (NS.tapeWhen || {})) add('when-' + k, NS.tapeWhen[k], 'when she does the thing');
for (const n in (NS.reveal || {})) add('reveal-' + n, NS.reveal[n].say, 'three in the morning, night ' + n);
add('caught-first', NS.caught && NS.caught.first, 'the first time something reaches her');
add('caught-later', NS.caught && NS.caught.later, 'every time after that');
/* AND THE LAST HOUR.

   The narration in the ending is his, the same as the narration
   everywhere else, and an ending that went quiet at the exact moment
   it matters most would be the one place in the chapter where the
   voice she has listened to all week is missing. Only the narrator
   lines: the four of them speak for themselves, and the building's
   lines belong to the annunciator. */
(NS.lastHour && NS.lastHour.shots || []).forEach((sh, k) => {
  if (!sh.line || sh.line.sys) return;
  const id = 'last-' + String(k + 1).padStart(2, '0');
  add(id, sh.line.t, 'the last hour, shot ' + (k + 1), sh.line.who);
});

/* and the letter, which is the last thing in the chapter and was a
   silent card until it was not. His voice, one line at a time, with
   the staging waiting for him rather than for a clock. */
((NS.lastHour && NS.lastHour.after && NS.lastHour.after.lines) || []).forEach((l, k) =>
  add('note-' + (k + 1), l, 'the letter on the bench'));

add('kept-clean', NS.kept && NS.kept.clean, 'six nights, untouched');
add('kept-hurt',  NS.kept && NS.kept.hurt,  'six nights, not untouched');

if (process.argv.indexOf('--json') >= 0) {
  const m = {};
  OUT.forEach((o) => { m[o.id] = o.text; });
  console.log(JSON.stringify(m, null, 2));
  process.exit(0);
}

/* the casting sheet: which model says which line, and how. The render
   reads this instead of one voice for everything. */
if (process.argv.indexOf('--plan') >= 0) {
  const m = {};
  OUT.forEach((o) => {
    const v = VOICE[o.who] || VOICE.anwar;
    m[o.id] = { who: o.who, model: v.model, pace: v.pace, depth: v.depth };
  });
  console.log(JSON.stringify(m, null, 2));
  process.exit(0);
}

/* how long this is, honestly, so nobody starts it thinking it is ten
   minutes: about 150 words a minute read slowly, plus retakes */
const words = OUT.reduce((n, o) => n + o.text.split(/\s+/).length, 0);
console.log('ANWAR — EVERY LINE HE SAYS OUT LOUD');
console.log(OUT.length + ' lines, ' + words + ' words, about '
            + Math.ceil(words / 150) + ' minutes of speech\n');
console.log('Record each one as its own file: voice/<id>.mp3');
console.log('Read it the way you would say it to her. Do not perform it.');
console.log('Leave half a second of room at each end and do not trim it tight.');
console.log('A phone held a hand\'s width away, indoors, is the right microphone.\n');
let section = '';
OUT.forEach((o) => {
  const s = o.id.replace(/-.*$/, '');
  if (s !== section) { section = s; console.log('\n--- ' + section.toUpperCase() + ' ---'); }
  console.log('\n  ' + o.id + (o.note ? '   (' + o.note + ')' : ''));
  console.log('  ' + o.text);
});
