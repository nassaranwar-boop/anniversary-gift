/* THE EIGHT CAMERAS, AND WHAT IS ACTUALLY ON THEM.

   The monitor is the whole defence in this chapter: she cannot see any
   room she is not looking at, and everything she decides comes from the
   picture. Every other suite here drives the simulation with the
   renderer taken out, so not one of them has ever asked the only
   question that matters about a camera -- press this button, and is the
   room you were promised on the glass, with the thing that is in it
   drawn, inside the frame.

   So this presses them. It runs the page's own loop, selects each
   camera the way the player does, waits for real frames, and reads what
   the renderer was given:

     the right room    shownRoom follows G.cam, and the plan on the
                       tube selects the room its label says
     the whole list    every camera number from 0 up is on it exactly
                       once, with no gaps and nothing twice
     the thing in it   a figure standing in that room is visible when
                       its camera is up and not visible when it is not,
                       because a threat you cannot see is not a threat,
                       it is a death with no warning
     in the frame      and it projects inside the picture the LIVE
                       camera is making, which is the one the player is
                       looking at rather than the one in the table
     the dark ones     the rooms the night has taken away read as lost,
                       and only those */
const { chromium } = require('playwright-core');

let pass = 0, fail = 0;
const ok = (n, c, note) => { c ? pass++ : fail++;
  console.log(`${c ? 'PASS' : 'FAIL'}  ${n}${note ? '   ' + note : ''}`); };

(async () => {
  const b = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox', '--no-proxy-server', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 1000, height: 640 } });
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  await p.route('**/*', (r) => {
    const u = r.request().url();
    if (u.indexOf('book-scene.js') >= 0) return r.abort();
    return u.startsWith('http://127.0.0.1') ? r.continue() : r.abort(); });
  await p.goto('http://127.0.0.1:8899/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.evaluate(() => {
    localStorage.setItem('ns_seenintro', '1');
    localStorage.setItem('ns_notutor', '1');
    showScreen('nightshift');
    return loadChapter('nightshift').then(() => OuissysNightShift.start()); });
  await p.waitForFunction(() => {
    try { const c = window.OuissysNightShift && OuissysNightShift.__night
                    && OuissysNightShift.__night.cast();
          return !!(c && c.cogsworth && c.jax); } catch (e) { return false; }
  }, { timeout: 30000, polling: 200 });

  /* ---- the list itself ---- */
  const list = await p.evaluate(() => {
    const N = OuissysNightShift.__night;
    const rooms = N.rooms();
    const out = [];
    for (const id in rooms) out.push({ id, cam: (N.roomDefs().filter((r) => r.id === id)[0] || {}).cam,
                                       cams: Object.keys(rooms[id].cams) });
    return out;
  });
  const numbered = list.filter((r) => r.cam >= 0).sort((a, c) => a.cam - c.cam);
  const nums = numbered.map((r) => r.cam);
  ok('every room on the monitor has a camera number, once, with no gaps',
     nums.length > 0 && nums.every((n, i) => n === i),
     nums.map((n, i) => n + ':' + numbered[i].id).join(' '));
  ok('and every one of them has a camera built in the room to look through',
     numbered.every((r) => r.cams.indexOf('main') >= 0),
     numbered.filter((r) => r.cams.indexOf('main') < 0).map((r) => r.id).join(',') || 'all have one');

  /* ---- and now press them ---- */
  await p.evaluate(() => { OuissysNightShift.__night.begin(1); });
  const wrong = [], unseen = [], leaked = [];
  for (const r of numbered) {
    const seen = await p.evaluate(async (rid) => {
      const N = OuissysNightShift.__night, G = N.state(), cast = N.cast(), T = N.three();
      /* one of the four, standing in it, awake, at its own spot */
      const ch = cast.cogsworth;
      ch.awake = true; ch.asleep = false;
      /* THE OFFICE CAMERA IS NOT A ROOM CAMERA.

         Camera zero is the angle on her own desk, for the one scene
         where something comes and stands at it. Its standing spots s0
         and s1 are the two doorways, which are behind and beside that
         lens on purpose -- a figure at her left door is not supposed to
         be in the desk picture, it is supposed to be over her shoulder.
         So the office is checked at its desk mark, and what she can see
         from the chair is asked separately below. */
      N.putAt('cogsworth', rid, rid === 'office' ? 'd1' : 's0');
      G.monitor = true; G.cam = rid;
      /* let the page's own loop take it */
      await new Promise((res) => setTimeout(res, 700));
      const view = N.view();
      const others = [];
      for (const id in cast) if (cast[id].group.visible) others.push(id + '@' + cast[id].room);
      let inFrame = null;
      if (view && ch.group.visible) {
        view.updateMatrixWorld(true);
        let mx = 0, my = 0, behind = false;
        for (const dy of [0.05, 1.3]) {
          const v = new T.Vector3(ch.group.position.x, ch.group.position.y + dy, ch.group.position.z).project(view);
          if (v.z > 1) behind = true;
          mx = Math.max(mx, Math.abs(v.x)); my = Math.max(my, Math.abs(v.y));
        }
        inFrame = { mx: +mx.toFixed(2), my: +my.toFixed(2), behind };
      }
      return { shown: N.shown(), cam: G.cam, room: ch.room,
               visible: ch.group.visible, drawn: others, inFrame };
    }, r.id);
    if (seen.shown !== r.id) wrong.push(`cam ${r.cam} (${r.id}) put ${seen.shown} on the glass`);
    if (seen.room === r.id && !seen.visible) unseen.push(`${r.id}: a figure standing in it was not drawn`);
    if (seen.inFrame && (seen.inFrame.behind || seen.inFrame.mx > 0.98 || seen.inFrame.my > 0.98))
      unseen.push(`${r.id}: the figure in it is outside the live picture (${seen.inFrame.mx}, ${seen.inFrame.my})`);
    const strays = (seen.drawn || []).filter((d) => d.split('@')[1] !== r.id);
    if (strays.length) leaked.push(`${r.id}: also drawing ${strays.join(', ')}`);
  }
  ok('pressing a camera puts that room on the glass', wrong.length === 0,
     wrong.length ? wrong.join('; ') : numbered.length + ' cameras, all correct');
  ok('and whatever is standing in that room is drawn, inside the picture',
     unseen.length === 0, unseen.length ? unseen.join('; ') : 'every room showed its figure');
  ok('and nothing from any other room is drawn with it', leaked.length === 0,
     leaked.length ? leaked.join('; ') : 'no room leaks into another');

  /* ---- the monitor down is the office, and both doors are in it ---- */
  const down = await p.evaluate(async () => {
    const N = OuissysNightShift.__night, G = N.state(), cast = N.cast(), T = N.three();
    G.monitor = false;
    await new Promise((res) => setTimeout(res, 700));
    const out = { shown: N.shown(), doors: {} };
    /* FROM THE CHAIR, WHICH IS WHERE SHE ACTUALLY IS.

       Everything that reaches her arrives at one of three ways in, and
       the only picture that has to contain them is the one she is
       looking at when the monitor is down. A thing at her door that
       does not appear in that view is a death with no warning at all. */
    for (const [id, spot] of [['cogsworth', 'leftDoor'], ['marabelle', 'rightDoor'], ['chime', 'hatch']]) {
      const ch = cast[id];
      ch.awake = true; ch.asleep = false;
      N.putAt(id, 'office', spot);
      await new Promise((res) => setTimeout(res, 700));
      const view = N.view();
      view.updateMatrixWorld(true);
      let mx = 0, my = 0, behind = false;
      for (const dy of [0.1, 1.2]) {
        const v = new T.Vector3(ch.group.position.x, ch.group.position.y + dy, ch.group.position.z).project(view);
        if (v.z > 1) behind = true;
        mx = Math.max(mx, Math.abs(v.x)); my = Math.max(my, Math.abs(v.y));
      }
      out.doors[spot] = { visible: ch.group.visible, mx: +mx.toFixed(2), my: +my.toFixed(2), behind };
      ch.awake = false;
    }
    return out;
  });
  ok('with the monitor down she is looking at the office', down.shown === 'office', 'shows ' + down.shown);
  for (const spot in down.doors) {
    const d = down.doors[spot];
    ok(`and something at the ${spot} is drawn where she can see it`,
       d.visible && !d.behind && d.mx <= 1.0 && d.my <= 1.0,
       `${d.visible ? 'drawn' : 'NOT DRAWN'}, ${d.behind ? 'behind the lens' : `${d.mx}, ${d.my} of 1.0`}`);
  }

  /* ---- the rooms the night takes away ---- */
  const lost = await p.evaluate(async () => {
    const N = OuissysNightShift.__night, G = N.state();
    const out = {};
    for (const n of [1, 2, 3]) {
      N.begin(n);
      /* the first minute is what breaks tonight's: let it run out */
      for (let k = 0; k < 60 * 30; k++) { N.pumpFrame(1 / 30); if (!N.midState().on) break; }
      const dead = {};
      for (const id in N.rooms()) dead[id] = !!N.roomDead(id);
      out[n] = { dead, hallDark: !!G.hallDark };
    }
    return out;
  });
  ok('night one: every camera works', !Object.values(lost[1].dead).some(Boolean),
     Object.keys(lost[1].dead).filter((k) => lost[1].dead[k]).join(',') || 'all eight good');
  ok('night two: camera eight is gone and nothing else is',
     lost[2].dead.workshop && Object.keys(lost[2].dead).filter((k) => lost[2].dead[k]).length === 1,
     Object.keys(lost[2].dead).filter((k) => lost[2].dead[k]).join(',') || 'none');
  ok('night three: and the hall has lost its lights as well',
     lost[3].hallDark && lost[3].dead.workshop, `hallDark ${lost[3].hallDark}, workshop ${lost[3].dead.workshop}`);

  ok('and none of it threw', errs.length === 0, errs[0] || '');
  console.log(`\n${pass} passed, ${fail} failed`);
  await b.close();
  process.exit(fail ? 1 : 0);
})();
