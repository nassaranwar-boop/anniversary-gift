/* EVERY LINE THE CHAPTER CAN SAY, AND WHETHER IT HAS A VOICE.

   The chapter looks a recording up BY ITS WORDS, not by an id: the
   manifest maps an id to the exact sentence that was recorded for it,
   and the game asks "is there a take whose words are these". That is
   deliberate and it is right -- rewrite a line and it stops matching,
   so it goes back to the synthesiser instead of playing a take of the
   old words over the new caption.

   It also means a line can go quiet without anything failing. Nobody
   sees an error. The caption still appears. It simply comes out of
   whatever speech engine the phone has, in a voice that is not the
   character's, or out of nothing at all on a phone that has none. That
   is what "sometimes it does not read" turned out to mean the last time
   somebody played this, and sixteen lines were in that state.

   So, with no browser and in under a second:

     rendered     every line the script can speak has a take whose words
                  match it exactly
     on disk      every take the manifest names is actually a file
     no orphans   and no take is left in the manifest for words that are
                  not in the script any more, because that is a line
                  somebody rewrote and a recording nobody will ever hear
     cast         every line that belongs to one of the four is cast to
                  that character's model and not to the narrator

   It reads the script the same way voicesheet does -- out of the source
   -- so it cannot drift from what the chapter actually says. */
const fs = require('fs');
const { execFileSync } = require('child_process');

let pass = 0, fail = 0;
const ok = (n, c, note) => { c ? pass++ : fail++;
  console.log(`${c ? 'PASS' : 'FAIL'}  ${n}${note ? '   ' + note : ''}`); };

const root = __dirname + '/..';
const sheet = JSON.parse(execFileSync('node', [__dirname + '/voicesheet.js', '--json'], { encoding: 'utf8' }));
const plan = JSON.parse(execFileSync('node', [__dirname + '/voicesheet.js', '--plan'], { encoding: 'utf8' }));
const manifest = JSON.parse(fs.readFileSync(root + '/voice/manifest.json', 'utf8'));

const norm = (t) => String(t).trim();
const recorded = new Set(Object.values(manifest).map(norm));

/* ---- 1. every line the script can speak has a take ---- */
const silent = [];
for (const id in sheet) if (!recorded.has(norm(sheet[id]))) silent.push({ id, t: sheet[id] });
ok('every line in the script has a recording of those exact words',
   silent.length === 0,
   silent.length ? `${silent.length} silent, first: ${silent[0].id} "${String(silent[0].t).slice(0, 60)}"` :
                   Object.keys(sheet).length + ' lines, all rendered');
if (silent.length) silent.slice(0, 40).forEach((x) => console.log(`        ${x.id}   "${String(x.t).slice(0, 78)}"`));

/* ---- 2. every take the manifest names is on disk ---- */
const gone = Object.keys(manifest).filter((id) => !fs.existsSync(`${root}/voice/${id}.mp3`));
ok('every take the manifest names is a file that exists', gone.length === 0,
   gone.length ? gone.slice(0, 8).join(', ') : Object.keys(manifest).length + ' files');

/* ---- 3. no take is stranded on words the script no longer uses ---- */
const inScript = new Set(Object.values(sheet).map(norm));
const orphan = Object.keys(manifest).filter((id) => !inScript.has(norm(manifest[id])));
ok('no recording is left over from a line that has since been rewritten',
   orphan.length === 0,
   orphan.length ? `${orphan.length}: ` + orphan.slice(0, 6).join(', ') : 'none stranded');
if (orphan.length) orphan.slice(0, 20).forEach((id) =>
  console.log(`        ${id}   "${String(manifest[id]).slice(0, 78)}"`));

/* ---- 4. the four are cast as themselves ---- */
const FOUR = ['cogsworth', 'chime', 'marabelle', 'jax'];
const miscast = [];
for (const id in plan) {
  const who = plan[id].who;
  if (FOUR.indexOf(who) < 0) continue;
  if (plan[id].model === plan.__narrator || !plan[id].model) miscast.push(id);
}
const models = {};
for (const id in plan) models[plan[id].who] = plan[id].model;
/* TWO PARTS MAY SHARE A MODEL. THEY MAY NOT SHARE A VOICE.

   The soldier and the man who bought the shop are both read by the
   northern male model, and that is deliberate: the one is the other's
   employer and they are meant to sound like they come from the same
   place. What separates them is the pitch they are rendered at -- the
   soldier a little under his own, the boss six and a half semitones
   below -- and whether that is enough is a question about the audio,
   which tools/castcheck.js answers by measuring the takes. All this can
   honestly ask is that the sheet does not cast two parts identically,
   model and pitch both, which would make them the same voice by
   construction. */
const depth = {};
for (const id in plan) depth[plan[id].who] = plan[id].model + ' at ' + plan[id].depth;
const shared = [];
const byModel = {};
for (const who in depth) (byModel[depth[who]] = byModel[depth[who]] || []).push(who);
for (const m in byModel) if (byModel[m].length > 1) shared.push(`${byModel[m].join(' and ')} are both ${m}`);
ok('every one of the four is cast to a voice of its own', miscast.length === 0,
   miscast.length ? miscast.slice(0, 5).join(', ') : Object.keys(models).length + ' parts: ' +
     Object.keys(models).map((w) => w + '=' + models[w].replace(/^en_[A-Z]{2}-/, '')).join(', '));
ok('and no two parts are cast identically, model and pitch both',
   shared.length === 0, shared.length ? shared.join('; ') : 'every part its own');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
