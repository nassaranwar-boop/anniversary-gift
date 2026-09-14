/* NOTHING THAT WAS WRITTEN TO HAPPEN IS ALLOWED TO NOT HAPPEN.

   For four versions this chapter had a hole in the middle of it that
   no test could see, because it was not a bug: it was the story being
   optional. A player who is GOOD at this game -- doors shut the moment
   something moves, monitor down, nothing wasted -- was precisely the
   player who got the least of it. Shut doors meant the four never had
   to save her, so the one scene the middle of the chapter is built
   around never played. A tidy camera routine meant she walked past the
   maker's tags, and the only place in six nights where he says in his
   own hand what each of them is FOR was simply gone.

   That is exactly backwards, and none of it was catchable by anything
   that only checks that the code runs. So this checks the promises:

     - a page she walked past is still there the next night
     - and one of them tells her where, in their own voice
     - the character lines have a night and an hour by which they fire
       whether or not she has done the thing that would have cued them
     - and the save happens with the door shut, because the door
       holding is the rule of the game and what is on the far side of
       it is the story.
                                              node tools/storycheck.js */
const fs = require('fs');
const { chromium } = require('playwright-core');

let pass = 0, fail = 0;
const ok = (n, c, x) => { if (c) { pass++; console.log('  ok   ' + n); }
                          else { fail++; console.log('  FAIL ' + n + (x !== undefined ? '  ' + JSON.stringify(x) : '')); } };

const src = fs.readFileSync(__dirname + '/../night-shift.js', 'utf8');
function lift(name) {
  const i = src.indexOf('const ' + name + ' = ');
  const eq = src.indexOf('=', i);
  let open = eq + 1;
  while (' \n\r\t'.indexOf(src[open]) >= 0) open++;
  let d = 0, j = open;
  for (; j < src.length; j++) {
    const c = src[j];
    if (c === '{' || c === '[') d++;
    else if (c === '}' || c === ']') { d--; if (!d) break; }
  }
  return eval('(' + src.slice(open, j + 1) + ')');
}
const NS = lift('NS');

console.log('\n=== what the script promises');

/* every line one of the four says has a deadline on it */
const spoken = Object.keys(NS.tapeWhen).filter((k) => typeof NS.tapeWhen[k] !== 'string');
ok('every line one of the four speaks is somebody in particular',
   spoken.every((k) => NS.tapeWhen[k].who), spoken.filter((k) => !NS.tapeWhen[k].who));
ok('and every one of them fires by a night and an hour, cued or not',
   spoken.every((k) => Array.isArray(NS.tapeWhen[k].by) && NS.tapeWhen[k].by.length === 2),
   spoken.filter((k) => !NS.tapeWhen[k].by));
/* a deadline before the night it is allowed on would never fire */
const early = spoken.filter((k) => { const it = NS.tapeWhen[k];
  return it.after && it.by[0] < it.after; });
ok('no deadline falls before the night the line is allowed to exist', !early.length, early);
/* and none of them lands after the last night she could hear it */
const late = spoken.filter((k) => NS.tapeWhen[k].by[0] > 5);
ok('and none of them is left until a night that may never come', !late.length, late);
/* they are spread out: two of the four should not be due the same hour
   of the same night, or one talks over the other */
const slots = {};
const clash = [];
spoken.forEach((k) => { const s = NS.tapeWhen[k].by.join(':');
  if (slots[s]) clash.push([slots[s], k]); else slots[s] = k; });
ok('and no two of them come due in the same hour of the same night', !clash.length, clash);

/* the pages she can walk past, and the one who points at each */
const pointable = NS.finds.filter((f) => f.on < 6).map((f) => f.id);
ok('every page she can walk past has somebody who will point at it',
   pointable.every((id) => NS.pointAt[id]), pointable.filter((id) => !NS.pointAt[id]));
ok('and the one who points at a maker\'s tag is the toy it belongs to',
   ['cogsworth', 'chime', 'marabelle', 'jax'].every((id) => NS.pointAt[id].who === id),
   ['cogsworth', 'chime', 'marabelle', 'jax'].filter((id) => NS.pointAt[id].who !== id));
ok('and none of them simply reads the map out',
   Object.keys(NS.pointAt).every((k) => NS.pointAt[k].t.split(' ').length > 18),
   Object.keys(NS.pointAt).filter((k) => NS.pointAt[k].t.split(' ').length <= 18));

/* the shut-door save has its own card, because she cannot see a thing */
ok('the save behind a shut door is written as sound, not as a view',
   NS.heldShut && NS.heldShut.lines.length >= 3 &&
   !/she sees|looking at the thing in the corridor/.test(NS.heldShut.lines.join(' ')));
ok('and neither card names a door the game did not use',
   /\$1/.test(NS.held.where) && /\$1/.test(NS.heldShut.where));

/* the only real choice in the chapter, answered by the one it costs */
const choiceNights = Object.keys(NS.afterChoice || {}).map(Number).sort();
ok('every night she makes a choice but the last one gets an answer',
   choiceNights.join(',') === '1,2,3,4,5', choiceNights);
ok('and both ways of deciding are written, because both are the right one',
   choiceNights.every((n) => NS.afterChoice[n].kept && NS.afterChoice[n].burned),
   choiceNights.filter((n) => !(NS.afterChoice[n].kept && NS.afterChoice[n].burned)));
ok('and it is one of the four answering, never him',
   choiceNights.every((n) => ['cogsworth', 'chime', 'marabelle', 'jax']
     .indexOf(NS.afterChoice[n].kept.who) >= 0 &&
     NS.afterChoice[n].kept.who === NS.afterChoice[n].burned.who),
   choiceNights.map((n) => NS.afterChoice[n].kept.who));
/* and it is not the same voice every time, or it is one toy's chapter */
const answerers = choiceNights.map((n) => NS.afterChoice[n].kept.who);
ok('and the answering is shared out, not one of them all week',
   new Set(answerers).size >= 4, answerers);
/* neither branch may read as approval of the other */
ok('and neither branch simply repeats the other',
   choiceNights.every((n) => NS.afterChoice[n].kept.t !== NS.afterChoice[n].burned.t));

/* ---- AND THE WORDS REALLY GOT SAID ---------------------------------

   Six of these lines shipped, rendered, and committed as the phrase
   "[object Object]", read aloud in a Welsh documentary-narrator voice,
   because the renderer was handed {t, who} and called String() on it.
   Nothing failed. The audio existed, the manifest existed, the game
   played it. It is exactly the sort of thing that only a human ear
   catches, so here is an eye that catches it instead. */
console.log('\n=== and the words really got said');
let man = null;
try { man = JSON.parse(fs.readFileSync(__dirname + '/../voice/manifest.json', 'utf8')); } catch (e) {}
ok('there is a voice manifest at all', !!man);
if (man) {
  const junk = Object.keys(man).filter((k) => /\[object|undefined|null/i.test(String(man[k])));
  ok('and not one line in it is a stringified object', !junk.length, junk);

  const plain = (t) => String(t).replace(/&[lr]dquo;/g, '"').replace(/&mdash;/g, '—')
    .replace(/&amp;/g, '&').replace(/<[^>]+>/g, '').trim();
  const want = [];
  for (const k in NS.tapeWhen) {
    const it = NS.tapeWhen[k];
    want.push(['when-' + k, typeof it === 'string' ? it : it.t]);
  }
  for (const k in NS.pointAt) want.push(['point-' + k, NS.pointAt[k].t]);
  for (const n in (NS.afterChoice || {}))
    ['kept', 'burned'].forEach((w) => {
      const it = NS.afterChoice[n][w];
      if (it) want.push(['chose-' + n + '-' + w, it.t]);
    });

  const missing = want.filter(([id]) => !man[id]);
  ok('every line one of them says has a take of its own', !missing.length,
     missing.map((m) => m[0]));
  const wrong = want.filter(([id, t]) => man[id] && man[id] !== plain(t));
  ok('and the take says the words that are in the script', !wrong.length,
     wrong.map(([id]) => [id, String(man[id]).slice(0, 40)]));
  const nofile = want.filter(([id]) => man[id] && !fs.existsSync(__dirname + '/../voice/' + id + '.mp3'));
  ok('and there is really a recording behind each one', !nofile.length,
     nofile.map((m) => m[0]));
}

/* ---- and now the game, running ------------------------------------- */
(async () => {
  const b = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox', '--no-proxy-server', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 1100, height: 700 } });
  let errs = [];
  p.on('pageerror', (e) => { errs.push(e.message); });
  await p.route('**/*', (r) => {
    const u = r.request().url();
    if (u.indexOf('book-scene.js') >= 0) return r.abort();
    return u.startsWith('http://127.0.0.1') ? r.continue() : r.abort();
  });
  await p.goto('http://127.0.0.1:8899/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.evaluate(() => { localStorage.setItem('ns_seenintro', '1'); showScreen('nightshift');
    return loadChapter('nightshift').then(() => OuissysNightShift.start()); });
  await p.waitForFunction(() => window.OuissysNightShift && OuissysNightShift.__night,
                          { timeout: 20000, polling: 200 });

  console.log('\n=== the shop, keeping what she walked past');

  /* she finds nothing, ever. Every night she still has something to find,
     and it is always the oldest thing she missed. */
  const sloppy = await p.evaluate(() =>
    [1, 2, 3, 4, 5, 6].map((n) => OuissysNightShift.__night.carry(n, {})));
  ok('a player who finds nothing still has something out there every night',
     sloppy.every((s) => s.armed), sloppy);
  ok('and on each night it is that night\'s own page, in order',
     sloppy.map((s) => s.armed).join(',') === 'cogsworth,chime,marabelle,jax,ledger,last',
     sloppy.map((s) => s.armed));

  /* she misses night one and is perfect afterwards: night one's tag is
     put back out, and the soldier tells her where it is */
  const back = await p.evaluate(() => {
    const N = OuissysNightShift.__night;
    return { n2: N.carry(2, { chime: true }),
             n3: N.carry(3, { chime: true, marabelle: true }),
             n4: N.carry(4, { chime: true, marabelle: true, jax: true }) };
  });
  ok('the tag she walked past on night one is out again on night two',
     back.n2.armed === 'cogsworth' && back.n2.back === 'cogsworth', back.n2);
  ok('and it is still out on night three, and on night four',
     back.n3.armed === 'cogsworth' && back.n4.armed === 'cogsworth', back);
  ok('and the soldier is the one who tells her where he left it',
     back.n2.points === 'cogsworth', back.n2);

  /* two missed: the older one comes back first */
  const two = await p.evaluate(() =>
    OuissysNightShift.__night.carry(4, { marabelle: true, jax: true }));
  ok('two missed, and the older one is the one the shop puts back first',
     two.armed === 'cogsworth' && two.back === 'cogsworth', two);

  /* nothing is ever handed to her early */
  const ahead = await p.evaluate(() => {
    const N = OuissysNightShift.__night;
    return [1, 2, 3].map((n) => N.carry(n, { cogsworth: true, chime: true }));
  });
  ok('and a thorough player is never handed a later night\'s page early',
     ahead[0].armed === null && ahead[1].armed === null && ahead[2].armed === 'marabelle',
     ahead.map((a) => a.armed));

  console.log('\n=== and it really comes due inside a night');

  /* everything his own deadlines would queue, already said, so the
     sweep gets past them to the things that come after */
  const hisDone = {};
  for (const k in NS.tapeWhen) {
    const it = NS.tapeWhen[k];
    hisDone[typeof it === 'string' ? it : it.t] = 1;
  }
  const due = (night, hour, opts) => p.evaluate(
    ([n, h, o]) => OuissysNightShift.__night.dueNow(n, h, o), [night, hour, opts]);

  /* a line of his that she never cued fires anyway, on the night and
     hour it was written for */
  const never = await due(1, 3, { said: {} });
  ok('a line she never did the thing for comes due on its own',
     never && never.t === NS.tapeWhen.theySeen.t, never);
  ok('and it is the soldier saying it, not the tape',
     never && never.who === 'cogsworth', never && never.who);

  /* and a shut door does not hold it out either */
  const shutIn = await due(1, 3, { said: {}, shut: true });
  ok('and a shut door does not keep it out', shutIn && shutIn.t === never.t, shutIn);

  /* what she did with his things, answered the night after */
  const kept1 = await due(2, 2, { said: hisDone, chose: { 1: 1 } });
  const burn1 = await due(2, 2, { said: hisDone, chose: { 1: 0 } });
  ok('keeping the key is answered, by the soldier',
     kept1 && kept1.t === NS.afterChoice[1].kept.t && kept1.who === 'cogsworth', kept1);
  ok('and burning it gets a different answer, from the same one',
     burn1 && burn1.t === NS.afterChoice[1].burned.t && burn1.who === 'cogsworth', burn1);
  ok('and the two answers are not the same sentence', kept1.t !== burn1.t);

  /* the first hour of a night is still his */
  const early = await due(2, 0, { said: hisDone, chose: { 1: 1 } });
  ok('but none of them speaks over his first hour', early === null, early);

  /* and it is only ever said once */
  const again = await due(3, 2, { said: Object.assign({}, hisDone,
    { [NS.afterChoice[1].kept.t]: 1 }), chose: { 1: 1 } });
  ok('and once answered it is never answered again',
     !again || again.t !== NS.afterChoice[1].kept.t, again);

  /* the page she walked past, pointed at -- after the choices are done */
  const pointed = await due(3, 3, {
    said: Object.assign({}, hisDone, { [NS.afterChoice[1].kept.t]: 1 }),
    chose: { 1: 1 }, found: { marabelle: true } });
  ok('and the one whose tag she walked past tells her where it is',
     pointed && pointed.t === NS.pointAt.cogsworth.t && pointed.who === 'cogsworth', pointed);

  /* nothing is pointed at when she has missed nothing */
  const clean = await due(3, 3, {
    said: Object.assign({}, hisDone, { [NS.afterChoice[1].kept.t]: 1 }),
    chose: { 1: 1 }, found: { cogsworth: true, chime: true, marabelle: true } });
  ok('and nobody points at anything when she has missed nothing', clean === null, clean);

  console.log('\n=== and she can watch it a second time');

  const rewatch = await p.evaluate(() => {
    const N = OuissysNightShift.__night;
    /* the title, with the whole chapter behind her */
    localStorage.setItem('ns_nights', JSON.stringify({ 1: 1, 2: 1, 3: 1, 4: 1, 5: 1, 6: 1 }));
    /* the title may already be up from an earlier check, and pressing
       title while on the title does not rebuild the card -- so go via
       another screen and come back, the way a player would */
    N.route('howto');
    N.route('title');
    const ov = document.getElementById('ns-overlay');
    const btn = ov && ov.querySelector('[data-go="lasthour"]');
    if (!btn) return { offered: false, phase: N.state().phase,
      gos: [].slice.call(ov ? ov.querySelectorAll('[data-go]') : []).map((e) => e.getAttribute('data-go')),
      nights: localStorage.getItem('ns_nights') };
    N.route('lasthour');
    const st = N.finaleState();
    return { offered: true, on: st.on, again: true, phase: st.phase };
  });
  ok('the last hour is on the title screen once the chapter is finished',
     rewatch.offered, rewatch);
  ok('and pressing it really starts the film again',
     rewatch.on && rewatch.phase === 'finale', rewatch);

  /* and getting to the end of a re-watch must not re-ask the one
     question the chapter asks, because it has already been answered */
  const out = await p.evaluate(() => {
    const N = OuissysNightShift.__night;
    N.route('finaleDone');
    const ov = document.getElementById('ns-overlay');
    return { phase: N.state().phase,
             title: !!(ov && ov.querySelector('.ns-card-title')),
             asked: !!(ov && ov.querySelector('[data-go="endWind"]')) };
  });
  ok('and a second watch hands her back to the title', out.title && out.phase === 'title', out);
  ok('and never re-asks her the question she has already answered', !out.asked, out);

  console.log('\n=== and the one that reached her answers for it');

  const caught = await p.evaluate(() => {
    const N = OuissysNightShift.__night;
    const o = {};
    ['cogsworth', 'chime', 'marabelle', 'jax', 'post1'].forEach((id) => {
      o[id] = N.caughtBy(id, true);
    });
    return o;
  });
  ok('each of the four answers for it in its own words',
     ['cogsworth', 'chime', 'marabelle', 'jax']
       .every((id) => caught[id].line === NS.gotYou[id]),
     Object.keys(caught).map((k) => [k, (caught[k].line || '').slice(0, 32)]));
  ok('and no two of them say the same thing',
     new Set(['cogsworth', 'chime', 'marabelle', 'jax'].map((id) => caught[id].line)).size === 4);
  /* the ones he sold have no voice until the last hour, so when one of
     those is what got her it has to still be him who says something */
  ok('and a parcel that reaches her gets his line, not one of its own',
     caught.post1.line === NS.caught.first, (caught.post1.line || '').slice(0, 40));
  /* each one owns up to its own mechanic, which is the only tutorial in
     the chapter that costs something to read */
  const tells = { cogsworth: /late/i, chime: /over the top/i,
                  marabelle: /look/i, jax: /leave rooms/i };
  ok('and each one owns up to the mechanic that actually killed her',
     Object.keys(tells).every((id) => tells[id].test(caught[id].line || '')),
     Object.keys(tells).filter((id) => !tells[id].test(caught[id].line || '')));

  console.log('\n=== the drawer, and what burning something costs');

  const led = await p.evaluate(() =>
    OuissysNightShift.__night.ledger({ 1: 1, 2: 0, 3: 1, 4: 0 }));
  ok('the six o\'clock card shows one mark per night of the chapter',
     led.marks.length === 6, led.marks);
  ok('and the marks say what she did with each of them',
     led.marks.slice(0, 4).join(',') === 'kept,burned,kept,burned', led.marks);
  ok('and a night she has not got to yet is neither',
     led.marks[4] === 'open' && led.marks[5] === 'open', led.marks);
  ok('anything she kept can be taken out and read again',
     led.opens.join(',') === '1,3', led.opens);
  ok('and nothing she burned can be read again, ever',
     led.shut.indexOf(2) >= 0 && led.shut.indexOf(4) >= 0, led.shut);

  console.log('\n=== the save, through a shut door');

  const held = await p.evaluate(() => {
    const N = OuissysNightShift.__night;
    return { left: N.holdShut('post1', 'cogsworth'),
             right: N.holdShut('post2', 'marabelle') };
  });
  ok('a toy that runs out of patience at a SHUT door is still taken away',
     held.left.saves === 1 && held.right.saves === 1, held);
  ok('and the one that took it away has spent itself doing it',
     held.left.keeperWound === 0 && held.right.keeperWound === 0, held);
  ok('and the door she shut is still shut afterwards -- the rule holds',
     held.left.doorStillShut && held.right.doorStillShut, held);
  ok('and it is off her door', !held.left.threatAtDoor && !held.right.threatAtDoor, held);

  /* the card she gets is the one she can hear rather than the one she
     can see, and it names the door it happened on */
  const card = await p.evaluate(() => {
    const N = OuissysNightShift.__night;
    N.heldCard(true, 'right');
    const el = document.querySelector('.ns-card-held');
    return { from: el.querySelector('.ns-from').textContent,
             body: el.querySelector('.ns-lines').textContent };
  });
  ok('behind a shut door she gets the card she cannot see out of',
     /cannot see it/.test(card.from) && /east door/.test(card.from), card.from);
  ok('and it is the sound of it, all the way through',
     /handle stops turning/.test(card.body) && /hand flat on it/.test(card.body));

  ok('no page errors anywhere in that', !errs.length, errs.slice(0, 3));

  console.log('\n' + pass + ' passed, ' + fail + ' failed\n');
  await b.close();
  process.exit(fail ? 1 : 0);
})();
