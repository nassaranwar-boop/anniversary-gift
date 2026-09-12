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
const OUT = [];
const add = (id, text, note) => {
  if (!text) return;
  /* the screen markup never reaches a mouth */
  const t = String(text)
    .replace(/&[lr]dquo;/g, '"').replace(/&mdash;/g, '—')
    .replace(/&amp;/g, '&').replace(/<[^>]+>/g, '').trim();
  if (t) OUT.push({ id, text: t, note: note || '' });
};

(NS.intro && NS.intro.beats || []).forEach((b, bi) => {
  b.lines.forEach((l, li) => add('intro-' + (bi + 1) + '-' + (li + 1), l,
    'the camera is in the ' + b.room));
});
(NS.terms && NS.terms.lines || []).forEach((l, k) => add('terms-' + (k + 1), l,
  'the shutters are coming down'));
for (const n in (NS.tapes || {})) {
  NS.tapes[n].forEach((x, k) => add('tape' + n + '-' + String(k + 1).padStart(2, '0'), x.t,
    'night ' + n + ', about ' + (12 + Math.floor(x.h)) % 12 + ' o\'clock'));
}
for (const k in (NS.tapeWhen || {})) add('when-' + k, NS.tapeWhen[k], 'when she does the thing');
for (const n in (NS.reveal || {})) add('reveal-' + n, NS.reveal[n].say, 'three in the morning, night ' + n);
add('caught-first', NS.caught && NS.caught.first, 'the first time something reaches her');
add('caught-later', NS.caught && NS.caught.later, 'every time after that');
add('kept-clean', NS.kept && NS.kept.clean, 'six nights, untouched');
add('kept-hurt',  NS.kept && NS.kept.hurt,  'six nights, not untouched');

if (process.argv.indexOf('--json') >= 0) {
  const m = {};
  OUT.forEach((o) => { m[o.id] = o.text; });
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
