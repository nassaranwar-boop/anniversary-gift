/* IS THE ENDING A FILM, OR IS IT A WALL OF TEXT?

   The last hour used to be forty lines painted over a black sheet. It
   is now forty-one shots in the shop, and the difference is the whole
   point -- so this checks the things that would quietly turn it back
   into text: a camera that does not move, a shot pointed at a room
   nobody is standing in, a mark that does not exist, a character who
   keeps talking after the film has taken them out of the world, and an
   overlay that paints black over the thing she is meant to be
   watching.

   Half of it is arithmetic on the shot list and needs no browser. The
   other half drives the film by hand through __night.filmTick, because
   a headless page has no compositor and therefore no frame loop.
                                                node tools/endcheck.js */
const fs = require('fs');
const { chromium } = require('playwright-core');

let pass = 0, fail = 0;
const ok = (n, c, x) => { if (c) { pass++; console.log('  ok   ' + n); }
                          else { fail++; console.log('  FAIL ' + n + (x !== undefined ? '  ' + JSON.stringify(x) : '')); } };

/* ---- the shot list, read straight out of the source ---------------- */
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
const CAST = lift('CAST');
const SHOTS = NS.lastHour.shots;

/* the rooms the shots are allowed to be in, and the marks in them */
const ANCH = {};
src.replace(/R\.anchor\("([^"]+)"/g, (m, n) => { ANCH[n] = (ANCH[n] || 0) + 1; return m; });
const ROOM_IDS = lift('ROOMS').map((r) => r.id);

console.log('\n=== the shot list');

ok('every shot names a room that exists',
   SHOTS.every((s) => ROOM_IDS.indexOf(s.room) >= 0),
   SHOTS.filter((s) => ROOM_IDS.indexOf(s.room) < 0).map((s) => s.room));

ok('every shot has a camera: from, to and something to look at',
   SHOTS.every((s) => s.from && s.to && s.look && s.from.length === 3 && s.to.length === 3),
   SHOTS.map((s, i) => (s.from && s.to && s.look) ? null : i).filter((x) => x !== null));

/* A SHOT THAT DOES NOT MOVE IS A SLIDE. */
const still = [];
SHOTS.forEach((s, i) => {
  const d = Math.hypot(s.to[0] - s.from[0], s.to[1] - s.from[1], s.to[2] - s.from[2]);
  const z = Math.abs((s.fov1 || s.fov || 58) - (s.fov0 || s.fov || 58));
  if (d < 0.04 && z < 1) still.push(i);
});
ok('no shot is a still: the camera moves or the lens does, in every one', !still.length, still);

/* and a shot that moves too far in too little time is a whip pan */
const whips = [];
SHOTS.forEach((s, i) => {
  const d = Math.hypot(s.to[0] - s.from[0], s.to[1] - s.from[1], s.to[2] - s.from[2]);
  if (d / (s.secs || 3) > 0.9) whips.push([i, +(d / s.secs).toFixed(2)]);
});
ok('nothing moves faster than a walk (under 0.9 m/s of camera)', !whips.length, whips);

ok('every mark a shot puts somebody on is a real anchor',
   SHOTS.every((s) => !s.put || Object.keys(s.put).every((id) => ANCH[s.put[id]])),
   SHOTS.map((s) => s.put ? Object.keys(s.put).map((id) => s.put[id]).filter((a) => !ANCH[a]) : [])
        .reduce((a, b) => a.concat(b), []));

const ids = CAST.map((c) => c.id);
ok('everybody a shot moves or removes is one of the four',
   SHOTS.every((s) => (!s.gone || ids.indexOf(s.gone) >= 0) &&
                      (!s.put || Object.keys(s.put).every((id) => ids.indexOf(id) >= 0))));

/* NOBODY SPEAKS AFTER THEY ARE GONE. This is the one continuity error
   an ending like this cannot survive. */
const dead = {}; const ghosts = [];
SHOTS.forEach((s, i) => {
  if (s.line && s.line.who && dead[s.line.who]) ghosts.push([i, s.line.who]);
  /* including their own shot: `gone` fires at the top of it, so a
     character removed on the shot they speak on is removed one frame
     before their line. That is exactly how the last words in the
     chapter played the first time. */
  if (s.gone && s.line && s.line.who === s.gone) ghosts.push([i, s.gone, 'gone on their own line']);
  if (s.gone) dead[s.gone] = i;
});
ok('nobody speaks after the film has taken them out of it', !ghosts.length, ghosts);

/* and everybody who speaks has been put somewhere first -- which for
   the three that are not one of the four means their own staging:
   `oui` stands her up, `boss` walks the first one he ever sold in, and
   `swarm` is the only thing that puts the crowd anywhere */
const placed = {}; const unplaced = [];
/* a two-version line counts as spoken whichever way it goes */
SHOTS.forEach((s) => { if (s.line && s.line.pick) s.line.t = s.line.t || s.line.a; });
SHOTS.forEach((s, i) => {
  if (s.put) Object.keys(s.put).forEach((id) => { placed[id] = 1; });
  if (s.oui) placed.ouissy = 1;
  if (s.boss) placed.boss = 1;
  if (s.swarm) placed.ret = 1;
  if (s.ouiGone) delete placed.ouissy;
  if (s.bossGone) delete placed.boss;
  /* a line declared off screen is exempt by definition: she is under
     the floorboards for both of hers, and being nowhere the camera can
     see her is the whole reason the line is marked */
  if (s.line && s.line.who && !s.line.off && !placed[s.line.who]) unplaced.push([i, s.line.who]);
});
ok('nobody speaks before the film has put them in the room', !unplaced.length, unplaced);

/* IS THE CAMERA POINTED AT ANYTHING WHILE SOMEBODY DESCRIBES IT?

   The chapter's own rule for this ending is that it is lived rather
   than read, and the failure mode is specific and easy to miss: a
   sentence about something dramatic, played over a room with nothing
   in it. It reads fine in the script. On screen it is a voice over an
   empty wall.

   So the shot list is walked with a note of who is in each room --
   the four as they are put and taken away, the crowd as it is placed
   and cleared, the first one he ever sold, and her -- and any shot
   with a line but nobody in frame has to say so on the shot itself,
   with `bare: 1`. Some genuinely are about the emptiness: two rooms
   away there is a bench with nothing on it. Those are allowed, and
   they are allowed OUT LOUD. */
const inRoom = {};      // id -> room
let hasSwarm = null, hasBoss = null, hasOui = null;
const empty = [];
SHOTS.forEach((s, i) => {
  if (s.put) Object.keys(s.put).forEach((id) => { inRoom[id] = s.room; });
  if (s.gone) delete inRoom[s.gone];
  if (s.clear) hasSwarm = null;
  if (s.swarm) hasSwarm = s.swarm[0];
  if (s.boss) hasBoss = s.boss[0];
  if (s.bossGone) hasBoss = null;
  if (s.oui) hasOui = s.room;
  if (s.ouiGone) hasOui = null;
  if (!s.line || s.bare) return;
  const here = Object.keys(inRoom).some((id) => inRoom[id] === s.room) ||
               hasSwarm === s.room || hasBoss === s.room || hasOui === s.room;
  if (!here) empty.push([i, s.room, String(s.line.t).slice(0, 38)]);
});
ok('nobody describes a room the camera is showing empty', !empty.length, empty);

/* --- and the three new mouths are used the way they were meant to be */
const said = {};
SHOTS.forEach((s) => { if (s.line && s.line.who) said[s.line.who] = (said[s.line.who] || 0) + 1; });
ok('she speaks in the last hour, having said nothing for six nights',
   said.ouissy > 0, said.ouissy || 0);
ok('and she does not suddenly become talkative', said.ouissy <= 6, said.ouissy);
ok('the ones he sold speak, and the first one he sold speaks alone',
   said.ret > 0 && said.boss > 0, [said.ret, said.boss]);
/* the crowd is a crowd: every line of theirs is layered */
const solo = SHOTS.map((s, i) => [i, s.line])
  .filter(([, l]) => l && l.who === 'ret' && !l.many).map(([i]) => i);
ok('and every line the crowd has is more than one mouth', !solo.length, solo);
/* nobody but the crowd is layered -- the first one he sold is one thing */
const ganged = SHOTS.map((s, i) => [i, s.line])
  .filter(([, l]) => l && l.many && l.who !== 'ret').map(([i]) => i);
ok('and nobody else in the film is doubled', !ganged.length, ganged);
/* off-screen lines are legitimate, and a film made of them is a radio play */
const offs = SHOTS.map((s, i) => [i, s.line]).filter(([, l]) => l && l.off).map(([i]) => i);
ok('and almost nobody speaks from off screen', offs.length <= 3, offs);

/* a line that changes with what she did has to be written both ways,
   and both ways have to be sayable */
const picks = SHOTS.map((s, i) => [i, s.line]).filter(([, l]) => l && l.pick);
ok('a line that changes with what she did is written both ways',
   picks.every(([, l]) => l.a && l.b && l.a !== l.b), picks.map(([i]) => i));
ok('and neither way of it tells her off',
   picks.every(([, l]) => !/should have|you failed|too late/i.test(l.a + ' ' + l.b)),
   picks.map(([i]) => i));

ok('all four of them are in it, and all four of them go', ids.every((id) => placed[id] && dead[id] !== undefined),
   ids.filter((id) => !placed[id] || dead[id] === undefined));

/* THE CROWD HAS TO CLEAR WHEN THE CAMERA LEAVES THE ROOM, or it is
   standing in the hall while the shot is in the office. */
let crowdRoom = null, bossRoom = null; const strays = [];
SHOTS.forEach((s, i) => {
  if (s.clear) { crowdRoom = null; bossRoom = null; }
  if (s.bossGone) bossRoom = null;
  if (s.swarm) crowdRoom = s.swarm[0];
  if (s.boss) bossRoom = s.boss[0];
  if (crowdRoom && crowdRoom !== s.room) strays.push([i, 'crowd', crowdRoom, s.room]);
  if (bossRoom && bossRoom !== s.room) strays.push([i, 'the first one', bossRoom, s.room]);
});
ok('the crowd is never left standing in a room the camera has left', !strays.length, strays);

/* THE LETTER HAS TO BE FINDABLE.

   The last card in the chapter is read aloud now, and the lookup is by
   the exact words. The card is written with &ldquo; in it, the browser
   hands textContent back as a curly quote, and the casting sheet wrote
   a plain one into the manifest -- so without a normalising step the
   two lines of his letter that have quotation marks in them are
   exactly the two he does not read, and nothing anywhere fails. */
const MAN = (() => {
  try { return JSON.parse(fs.readFileSync(__dirname + '/../voice/manifest.json', 'utf8')); }
  catch (e) { return null; }
})();
const decode = (t) => String(t)
  .replace(/&[lr]dquo;/g, '"').replace(/&[lr]squo;/g, "'")
  .replace(/&mdash;/g, '\u2014').replace(/&amp;/g, '&')
  .replace(/&nbsp;/g, ' ').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
if (MAN) {
  const words = {};
  for (const k in MAN) words[MAN[k]] = k;
  const lost = (NS.lastHour.after.lines || []).map((l, i) => words[decode(l)] ? null : i)
                                              .filter((x) => x !== null);
  ok('every line of his letter can be found in the manifest by its words', !lost.length, lost);
  /* and the same for the narration, which is the bulk of it */
  const nar = SHOTS.map((s, i) => (s.line && !s.line.sys && !words[decode(s.line.t)]) ? i : null)
                   .filter((x) => x !== null);
  ok('and so can every line anybody speaks in the film', !nar.length, nar);
}

const secs = SHOTS.reduce((a, s) => a + (s.secs || 3), 0);
/* THE CAP WAS FIVE MINUTES AND THE FILM IS LONGER THAN THAT NOW.

   Ten lines went in for the three mouths that had never had one --
   her, the crowd, and the first one he ever sold -- and two of them
   replaced narration rather than adding to it, so the whole cost is
   about twenty-six seconds. Five minutes was never a fact about
   films; it was the number this one happened to be under at the time
   the check was written. Six is the point where a climax built out of
   six nights starts to outstay itself, so that is the number now, and
   it is still a ceiling rather than a target. */
ok('the whole thing runs between two and six minutes', secs > 120 && secs < 360, Math.round(secs));

const longest = SHOTS.reduce((a, s) => Math.max(a, s.secs || 0), 0);
ok('no single shot outstays its welcome (under 7s)', longest < 7, longest);

/* the office is 6.6 by 5.0 with the back wall at z = 2.5: a camera
   outside that is a camera in a wall */
const outside = [];
SHOTS.forEach((s, i) => {
  if (s.room !== 'office') return;
  [s.from, s.to].forEach((p) => {
    if (Math.abs(p[0]) > 3.2 || p[2] > 2.45 || p[2] < -2.45 || p[1] < 0.15 || p[1] > 2.8) outside.push([i, p]);
  });
});
ok('no office shot puts the camera inside a wall, the ceiling or the floor', !outside.length, outside);

/* ---- and now the film itself --------------------------------------- */
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

  console.log('\n=== the film, running');
  const n = await p.evaluate(() => OuissysNightShift.__night.finale());
  ok('it starts, and it has every shot in it', n === SHOTS.length, n);

  const s0 = await p.evaluate(() => OuissysNightShift.__night.finaleState());
  ok('the screen is the shop, not a sheet over it',
     s0.on === true && s0.phase === 'finale', s0);
  const cls = await p.evaluate(() => document.getElementById('ns-overlay').className);
  ok('the overlay is the film layer, which paints nothing', cls.indexOf('ns-ov-film') >= 0, cls);
  const paint = await p.evaluate(() => {
    const o = document.getElementById('ns-overlay');
    const cs = getComputedStyle(o), be = getComputedStyle(o, '::before');
    return { bg: cs.backgroundColor, img: cs.backgroundImage, before: be.content };
  });
  ok('and it really is transparent',
     (paint.bg === 'rgba(0, 0, 0, 0)' || paint.bg === 'transparent') && paint.img === 'none', paint);

  /* drive it by hand and watch the camera */
  const run = await p.evaluate(() => {
    const N = OuissysNightShift.__night;
    const out = [], moved = {}, rooms = {}, seen = {}, eyes = {};
    let last = null;
    /* TWENTY-FOUR THOUSAND, NOT NINE.

       Every line in the film has a real recording behind it now, and a
       shot waits for the voice: voxTalking is true for as long as the
       take is actually playing, which is real seconds, and a loop
       stepping film-time at a twentieth of a second gets through very
       little real time per step. So each spoken shot runs out to its
       cap of two and a bit times its written length instead of
       stopping when the estimate says the words are done, and the film
       costs about eleven thousand steps rather than five. At nine
       thousand it simply stopped at shot forty-seven and reported the
       ending as broken. */
    for (let k = 0; k < 24000 && N.finaleState().on; k++) {
      const st = N.filmTick(0.05);
      if (!st) break;
      const i = st[4];
      rooms[N.finaleState().room] = 1;
      N.finaleState().seen.forEach((id) => { seen[id] = 1; });
      /* and where the speaker's eyes are in the frame while they speak */
      const st2 = N.finaleState();
      if (st2.eyes) {
        const e = st2.eyes;
        const off = Math.abs(e.x) > 0.92 || Math.abs(e.y) > 0.92 || e.z > 1 || e.z < -1;
        if (!eyes[i]) eyes[i] = { who: e.who, on: 0, off: 0, tall: 0, away: 99 };
        eyes[i][off ? 'off' : 'on']++;
        if (!off) {
          eyes[i].tall = Math.max(eyes[i].tall, e.tall);
          eyes[i].away = Math.min(eyes[i].away, e.away);
        }
      }
      if (last && last[4] === i) {
        const d = Math.hypot(st[0] - last[0], st[1] - last[1], st[2] - last[2]) +
                  Math.abs(st[3] - last[3]) * 0.01;
        moved[i] = (moved[i] || 0) + d;
      }
      last = st;
      out.push(i);
    }
    const hit = {};
    out.forEach((i) => { hit[i] = (hit[i] || 0) + 1; });
    return { moved, rooms: Object.keys(rooms), seen: Object.keys(seen), eyes,
             hit, frames: out.length, state: N.finaleState() };
  });
  ok('it plays all the way to the end on its own', run.state.on === false, run.state);
  const missed = SHOTS.map((s, i) => run.hit[i] ? null : i).filter((x) => x !== null);
  ok('and every single shot gets played', !missed.length, missed);
  const rushed = SHOTS.map((s, i) => (run.hit[i] || 0) * 0.05 < (s.secs || 3) * 0.8 ? i : null).filter((x) => x !== null);
  ok('and each one gets the time it was written for', !rushed.length, rushed);
  const dead2 = Object.keys(run.moved).filter((i) => run.moved[i] < 0.03);
  ok('the camera really moves in every shot, frame by frame', !dead2.length, dead2);
  ok('it visits more than one room', run.rooms.length >= 3, run.rooms);
  /* THE ONE THAT CAUGHT THE REAL BUG: a close-up aimed at nobody.

     Three shots were pointed at a height none of the four has -- the
     owl is eighty-six centimetres tall and two of his close-ups were
     aimed at a metre and a half of empty wall. A third of the shot is
     the bar rather than all of it, because two shots deliberately
     leave the speaker: one tilts off Chime onto the ceiling he is not
     going to reach, and one follows Jax's hand down to the floor. */
  const blind = Object.keys(run.eyes)
    .filter((i) => run.eyes[i].on / (run.eyes[i].on + run.eyes[i].off) < 0.3)
    .map((i) => [Number(i), run.eyes[i].who,
                 +(run.eyes[i].on / (run.eyes[i].on + run.eyes[i].off)).toFixed(2)]);
  ok('whoever is speaking is in the frame while they speak', !blind.length, blind);

  /* AND AT A SIZE SOMEBODY CAN READ.

     On-screen is not a shot size. When the four moved from the back of
     the office to the three doorways, every close-up written for the
     old marks stayed put and ended up about forty centimetres from a
     face: "He made you last" played as two painted eyes filling the
     whole frame, and the check above said yes to it very happily.

     A figure taller than the frame is an eyeball. A figure under a
     twelfth of the frame is a dot with a subtitle under it. Both are
     failures and neither is visible to a test that only asks whether
     something is inside the rectangle. */
  const sized = Object.keys(run.eyes).filter((i) => run.eyes[i].on > 0);
  /* DISTANCE, NOT SCREEN HEIGHT.

     Screen height was the obvious measure and it is the wrong one: a
     figure standing below the middle of the frame stretches hard under
     the perspective divide, so a perfectly good medium shot of
     somebody two metres away measures taller than the screen and a
     threshold set on it fails eighteen shots that are fine.

     How far the lens is from the person talking is unambiguous and is
     what actually went wrong. Under eighty-five centimetres is inside
     their face -- the shots this check was written for sat at about
     forty. Past five and a half metres they are a dot with a subtitle
     under them. A metre is a tight close-up and four of the last
     lines in the chapter are deliberately shot at one. */
  const close = sized.filter((i) => run.eyes[i].away < 0.85)
                     .map((i) => [Number(i), run.eyes[i].who, run.eyes[i].away]);
  ok('and the lens is not inside the face of whoever is talking', !close.length, close);
  const far = sized.filter((i) => run.eyes[i].away > 5.5)
                   .map((i) => [Number(i), run.eyes[i].who, run.eyes[i].away]);
  ok('and they are near enough to be the subject of their own shot', !far.length, far);
  ok('all four of them are drawn at some point in it', run.seen.length === 4, run.seen);

  /* WHAT THE BUSIEST SHOT COSTS.

     Twenty-eight toys is about six hundred solids on top of a room. A
     phone draws eighteen (the ladder is one number in start()), but a
     desktop draws all of them, and a shot nobody can render at speed
     is not a shot. Walk the film again, drawing this time, and keep
     the worst frame. */
  const cost = await p.evaluate(() => {
    const N = OuissysNightShift.__night;
    N.finale();
    let worst = { calls: 0 }, shot = -1;
    /* ONE DRAWN FRAME PER SHOT, not one per step. Drawing a room with
       six hundred toys in it through a software rasteriser is most of a
       second, and stepping the whole film at a fifth of a second with
       the draw on was twenty minutes of taking the same fifty-six
       measurements over and over. */
    for (let k = 0; k < 24000 && N.finaleState().on; k++) {
      const i = N.filmFrame(0.2, false);
      if (i === false) break;
      if (i !== shot) {
        shot = i;
        N.filmFrame(0.001, true);
        const c = N.filmCost();
        if (c && c.calls > worst.calls) worst = c;
      }
    }
    return worst;
  });
  ok('the busiest shot in it stays inside a frame budget',
     cost.calls > 0 && cost.calls < 1400, cost);

  await p.evaluate(() => { OuissysNightShift.__night.finale(); });
  const run2 = await p.evaluate(() => {
    const N = OuissysNightShift.__night;
    for (let k = 0; k < 24000 && N.finaleState().on; k++) N.filmTick(0.2);
    return N.finaleState();
  });
  ok('and it still reaches the end when it is run fast', run2.on === false, run2);

  /* THE SUBTITLE MUST NOT SIT ON THE BAR.

     The letterbox is pure black and so is the shadow under the text,
     so a two-line subtitle riding down onto the lower bar does not
     look broken -- it looks like nobody checked. Measured rather than
     eyeballed, at the longest line in the film and at a phone width as
     well, because that is where two lines become three. */
  const bars = await p.evaluate(() => {
    const N = OuissysNightShift.__night;
    N.finale();
    /* walk to the longest subtitle in the film */
    let worst = null;
    for (let k = 0; k < 24000 && N.finaleState().on; k++) {
      N.filmTick(0.2, false);
      const row = document.querySelector('.ns-fin-row');
      const bar = document.querySelector('.ns-fin-bar.b');
      if (!row || !bar) continue;
      const r = row.getBoundingClientRect(), b = bar.getBoundingClientRect();
      const over = r.bottom - b.top;
      if (!worst || over > worst.over) {
        worst = { over: Math.round(over), text: (row.textContent || '').slice(0, 40),
                  rows: Math.round(r.height / parseFloat(getComputedStyle(row).lineHeight || 20)) };
      }
    }
    return worst;
  });
  ok('no subtitle in the film lands on the lower letterbox bar',
     bars && bars.over < 0, bars);

  const end = await p.evaluate(() => ({
    card: !!document.querySelector('.ns-card-find'),
    go: !!document.querySelector('[data-go="finaleDone"]'),
    phase: OuissysNightShift.__night.finaleState().phase,
  }));
  ok('and it hands her his letter at the end of it', end.card && end.go, end);

  ok('no page errors anywhere in that', !errs.length, errs.slice(0, 3));

  console.log('\n' + pass + ' passed, ' + fail + ' failed\n');
  await b.close();
  process.exit(fail ? 1 : 0);
})();
