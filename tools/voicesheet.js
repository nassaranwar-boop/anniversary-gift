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
     cogsworth  108 Hz  clear of him, and slower than anybody: he is a
                        clock, he does not hurry, and he is the oldest
                        of the four. He was two semitones lower until
                        castcheck put him within a semitone of Anwar,
                        which to an ear is the same man.
     jax        142 Hz  a real voice with weight in it, quick: he talks
                        like somebody who has decided not to be afraid
                        out loud, and he says the last four lines in
                        the chapter, which is why he is not the bright
                        one. He and Chime swapped models after a render
                        put him and Marabelle a third of a semitone
                        apart.
     marabelle  202 Hz  the one voice in the shop that is not a man,
                        level and unbothered — she is the only one of
                        the four who is never frightened of anything.
     chime      265 Hz  small, quick, birdlike. He is an owl with a
                        bell in him and he is the only one of the four
                        who goes over the roof.

   No two of those are within a semitone of each other, which is the
   check castcheck actually makes: closer than that and, to an ear,
   they are the same person.                                          */
const VOICE = {
  anwar:     { model: 'en_GB-alan-medium',                  pace: '1.16', depth: '1.2' },
  cogsworth: { model: 'en_GB-northern_english_male-medium', pace: '1.26', depth: '0.8' },
  /* The owl and the ballerina were both sitting at -2.0 and landed two
     and a half semitones apart on the takes that existed at the time.
     Five more lines moved both medians and closed that to 0.76, which
     is the same person to an ear -- and they are two of the four that
     speak in the same rooms on the same nights. The owl goes down,
     where a thing that lives in the rafters and never touches the
     floor can sit; the ballerina comes back up to nearly her model's
     own pitch, because she is the one voice in the shop that is not a
     man and the lowering was never doing anything for her. */
  /* and up again, by a semitone and a half: the render of 2026-09-15
     put the owl at 228.6Hz and her at 216.2, which is 0.96 of a
     semitone -- the same person to an ear, and she is in the room with
     him. She is the one voice that is never processed, so the owl is
     the one that moves. */
  chime:     { model: 'en_GB-semaine-medium',               pace: '1.02', depth: '-5.5' },
  marabelle: { model: 'en_US-lessac-high',                  pace: '1.12', depth: '-0.6' },
  jax:       { model: 'en_US-ryan-high',                    pace: '0.98', depth: '0' },

  /* HER. The only person in the building who is alive, and the only
     voice in the chapter that is not processed at all -- no shift, no
     slowing, the model's own pitch and the model's own pace. Every
     other mouth here is a tape or a mechanism and is treated like
     one. She is the one thing in the shop that is actually in the
     room, and that should be audible without anybody being told. */
  ouissy:    { model: 'en_GB-jenny_dioco-medium',           pace: '1.0',  depth: '0' },

  /* THE ONES HE SOLD, who speak only in the last hour. Rendered once
     and then played three times over itself at slightly different
     rates and offsets, because four hundred of them came off the same
     drawing and a crowd of identical things is never quite in time
     with itself.

     Three semitones DOWN, which is depth +3.0 and not -3.0: the chain
     is ratio = 2 ** (-depth/12), so the number is how much deeper it
     goes, and asking for -3.0 put them three semitones UP and landed
     them at 233.0Hz -- the same pitch as the owl, to the decimal. Two
     characters in the same room, same voice. Measured, not guessed:
     tools/castcheck.js. */
  ret:       { model: 'en_GB-alba-medium',                  pace: '0.94', depth: '3.0' },

  /* THE FIRST ONE HE EVER SOLD. It is written as "a soldier like the
     one standing in her office except older and worse kept", so it
     gets that soldier's exact model and goes under it: the soldier
     sits at 107.6Hz, and five semitones down from his own setting
     puts the first one he ever sold at about eighty-five, which is
     lower than anything else in the shop including the tape.

     Same sign error as the crowd, and worse here -- it came out at
     150Hz, a third of a semitone off Jax, so the oldest thing in the
     building sounded like the one he made in an afternoon.

     And down again after the 2026-09-15 render: it came back at 86.3Hz
     against the tape's 91.3, which is 0.97 of a semitone. The oldest
     thing in the building is not allowed to sound like the man who
     made it. */
  boss:      { model: 'en_GB-northern_english_male-medium', pace: '0.86', depth: '6.5' },
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
for (const k in (NS.tapeWhen || {})) {
  /* these used to be bare strings. Six of them are objects now, because
     six of them are one of the four speaking rather than him, and
     String({t,who}) is "[object Object]" said out loud in a Welsh accent */
  const it = NS.tapeWhen[k];
  if (typeof it === 'string') add('when-' + k, it, 'when she does the thing');
  else add('when-' + k, it.t, 'when she does the thing', it.who);
}
/* and the one who tells her where she left his card */
for (const k in (NS.pointAt || {}))
  add('point-' + k, NS.pointAt[k].t, 'the night after she walked past it', NS.pointAt[k].who);
/* and the one she left standing in the dark with nothing in it */
for (const k in (NS.ranDown || {}))
  add('randown-' + k, NS.ranDown[k].t, 'when she has let this one run all the way down', NS.ranDown[k].who);
/* and the one that answers what she did with his things */
for (const n in (NS.afterChoice || {})) {
  ['kept', 'burned'].forEach((w) => {
    const it = NS.afterChoice[n][w];
    if (it) add('chose-' + n + '-' + w, it.t,
                'the night after she ' + (w === 'kept' ? 'kept' : 'burned') + ' night ' + n + "'s", it.who);
  });
}
/* AND THE ASKING, WHICH WAS NEVER IN HERE AT ALL.

   Every one of the four can come to a door and ask to be let in, and
   has two ways of asking, plus something to say for each answer she can
   give. Twenty-one lines, none of which had ever been rendered --
   because they were written after this sheet was, and nothing pointed
   it out: an unrendered line does not fail, it just comes out of the
   browser's own speech engine in a voice that is not the character's,
   or out of nothing at all on a device that has no engine for it. Which
   is what "sometimes it does not read" turned out to mean. */
for (const k in (NS.beg || {}))
  (NS.beg[k] || []).forEach((l, i) =>
    add('beg-' + k + '-' + (i + 1), l, 'it has come to a door and is asking to be let in', k));
for (const k in (NS.begShut || {}))
  add('begshut-' + k, NS.begShut[k], 'she left the door shut, so it says it through the door', k);
for (const k in (NS.begOpen || {}))
  add('begopen-' + k, NS.begOpen[k], 'she opened the door for it', k);
/* and the four who are made of her, when she lets one run down */
for (const n in (NS.reveal || {})) add('reveal-' + n, NS.reveal[n].say, 'three in the morning, night ' + n);
add('caught-first', NS.caught && NS.caught.first, 'the first time something reaches her');
add('caught-later', NS.caught && NS.caught.later, 'every time after that');
/* and the one that actually did it, answering for itself */
for (const k in (NS.gotYou || {}))
  add('gotyou-' + k, NS.gotYou[k], 'when this one is the one that reached her', k);
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
  /* a line with two versions needs two takes: the film picks between
     them at run time off something she did all week, and rendering one
     branch means half the players get a silent shot */
  if (sh.line.pick) {
    add(id + 'a', sh.line.a, 'the last hour, shot ' + (k + 1) + ' — if she did', sh.line.who);
    add(id + 'b', sh.line.b, 'the last hour, shot ' + (k + 1) + ' — if she did not', sh.line.who);
    return;
  }
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
