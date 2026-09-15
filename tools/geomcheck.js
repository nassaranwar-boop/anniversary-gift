/* WHERE THE FOUR OF THEM ACTUALLY STAND.

   Every figure in this chapter is put somewhere by name: a route says
   ["party","s1"] and putChar looks "s1" up in that room's anchor table
   and sets the group's position to it. Nothing has ever checked what is
   AT that position. A spot half a metre too far out is a soldier in a
   wall; two names pointing at the same spot is two figures in the same
   place; a missing name falls back to the room's origin, which is the
   middle of the floor at best and inside the furniture at worst.

   So this walks the real rooms in the real scene graph and asks four
   things of every standing spot the game can use:

     in the room     the spot is inside the room's own floor, with a
                     margin, rather than out past a wall
     not in a solid  nothing static is occupying it -- the bounding box
                     of every frozen mesh in the room is tested against
                     a body-sized box at the spot
     its own         no two spots a pair of them can be standing on at
                     the same time are within touching distance
     and in shot     the room's camera can see it, because a figure the
                     camera cannot see is a threat with no tell

   It reads the anchors and the geometry off the page rather than
   copying them here, so a room rebuilt tomorrow is checked as it is
   tomorrow. */
const { chromium } = require('playwright-core');

let pass = 0, fail = 0;
const ok = (n, c, note) => { c ? pass++ : fail++;
  console.log(`${c ? 'PASS' : 'FAIL'}  ${n}${note ? '   ' + note : ''}`); };

(async () => {
  const b = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox', '--no-proxy-server', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 900, height: 600 } });
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

  if (process.env.SUGGEST)
    await p.evaluate((r) => { window.__geomSuggest = r; }, process.env.SUGGEST);
  const data = await p.evaluate(() => {
    const N = OuissysNightShift.__night;
    const rooms = N.rooms(), cast = N.cast(), T = N.three();
    const CAST = N.castDefs();

    /* a body: shoulder to shoulder and head high, standing on the spot */
    const BODY = { x: 0.34, y: 0.95, z: 0.34 };

    const want = (window.__geomSuggest || '');
    const out = { rooms: {}, routes: {} };
    /* THE FOUR ARE NOT THE ONLY THINGS THAT WALK.

       The three that came back use the same rooms and, in two cases,
       the same named spots -- post1 walks the hall exactly where the
       soldier does and post2 crosses the party room exactly where the
       ballerina does. They are placed through the same syncChar, so
       they are separated at run time like everything else, but a route
       that collides on paper is still a route somebody has to think
       about, and leaving them out of this made it look like nobody had
       to. */
    CAST.concat(N.soldDefs ? N.soldDefs() : []).forEach((d) => { out.routes[d.id] = d.route; });

    for (const id in rooms) {
      const rec = rooms[id];
      const ox = rec.index * (N.spacing());
      /* THE FLOOR IS THE ROOM.

         setFromObject on the whole group swept in the backdrop planes
         and the deep scenery behind the windows, and reported the party
         room as a hundred metres wide and three hundred and fifty deep.
         Every "is this spot in the room" check then passed because
         everything is inside a box that size. The floor is the thing a
         figure can stand on, so the floor is the extent. */
      let whole = null;
      rec.group.traverse((o) => {
        if (!o.isMesh || !o.geometry) return;
        const bb0 = new T.Box3().setFromObject(o);
        if (!isFinite(bb0.min.x)) return;
        const sz = bb0.getSize(new T.Vector3());
        if (sz.y > 0.25) return;                       // not a floor
        if (bb0.max.y > 0.35 || bb0.min.y < -0.6) return;
        if (sz.x < 2 || sz.z < 2) return;              // not the whole floor
        if (!whole || (sz.x * sz.z) > (whole.getSize(new T.Vector3()).x *
                                        whole.getSize(new T.Vector3()).z)) whole = bb0;
      });
      if (!whole) whole = new T.Box3().setFromObject(rec.group);
      /* every static mesh, as a box, in room-local space */
      const solids = [];
      rec.group.traverse((o) => {
        if (!o.isMesh || !o.geometry) return;
        /* the figures live in their own groups, not in the room */
        const bb = new T.Box3().setFromObject(o);
        if (!isFinite(bb.min.x)) return;
        const size = bb.getSize(new T.Vector3());
        /* a floor or a ceiling is not something you stand inside */
        const flat = size.y < 0.12;
        /* name it by whatever it has: its own name, its tag, its parent's
           name, or failing all of that its size, because "Mesh by 0.5m"
           tells nobody which thing is in the way */
        let nm = o.name || (o.userData && o.userData.tag) || '';
        /* walk up for a name: props are built as groups and only the
           group tends to carry one */
        for (let a = o.parent; a && !nm; a = a.parent)
          nm = a.name || (a.userData && a.userData.tag) || '';
        /* and say how big the whole prop is, not the one face of it
           that happens to overlap */
        if (o.parent && o.parent !== rec.group) {
          const pb = new T.Box3().setFromObject(o.parent);
          if (isFinite(pb.min.x)) {
            const ps = pb.getSize(new T.Vector3());
            nm = (nm ? nm + ' ' : '') + 'prop ' + ps.x.toFixed(1) + 'x' + ps.y.toFixed(1) + 'x' + ps.z.toFixed(1) +
                 ' @' + ((pb.min.x + pb.max.x) / 2 - ox).toFixed(2) +
                 ',' + ((pb.min.y + pb.max.y) / 2).toFixed(2) +
                 ',' + ((pb.min.z + pb.max.z) / 2).toFixed(2);
          }
        }
        if (!nm) nm = (o.geometry.type || 'mesh').replace('Geometry', '') +
                      ' ' + size.x.toFixed(1) + 'x' + size.y.toFixed(1) + 'x' + size.z.toFixed(1) +
                      ' @' + ((bb.min.x + bb.max.x) / 2 - ox).toFixed(1) +
                      ',' + ((bb.min.y + bb.max.y) / 2).toFixed(1) +
                      ',' + ((bb.min.z + bb.max.z) / 2).toFixed(1);
        solids.push({ name: nm,
                      min: [bb.min.x - ox, bb.min.y, bb.min.z],
                      max: [bb.max.x - ox, bb.max.y, bb.max.z],
                      flat });
      });

      const anchors = {};
      for (const a in rec.anchors) {
        const A = rec.anchors[a];
        /* THE TORSO BAND, AND THE FOOTPRINT.

           The first version measured the smallest overlap on any of the
           three axes, which is the wrong question: a figure standing
           dead centre inside a tall cabinet clips its thin front panel
           by a hundredth of a metre and scored 0.01, while a shoulder
           grazing a wall scored more. What actually matters is whether
           something solid occupies the space the BODY is in -- so only
           meshes that reach into the band between its knees and its
           head count, and the depth is how far into the footprint the
           thing comes, which is the number you would have to move it
           by to get it out. */
        const band = [A.y + 0.20, A.y + 0.90];
        const lo = [A.x - BODY.x, A.z - BODY.z];
        const hi = [A.x + BODY.x, A.z + BODY.z];
        const inside = [];
        for (const s of solids) {
          if (s.flat) continue;
          if (s.max[1] < band[0] || s.min[1] > band[1]) continue;   // over or under it
          const ox2 = Math.min(hi[0], s.max[0]) - Math.max(lo[0], s.min[0]);
          const oz2 = Math.min(hi[1], s.max[2]) - Math.max(lo[1], s.min[2]);
          if (ox2 <= 0 || oz2 <= 0) continue;
          /* AND THE ONE THAT IS NOT A GRAZE.

             A prop built out of thin panels gives a small overlap
             against every one of them, so a figure standing dead in the
             middle of a cabinet scores the thickness of its front
             door. If the spot ITSELF -- not its shoulders, the point
             the feet are on -- is inside the footprint, it is not
             brushing past the thing, it is in it. */
          const dead = A.x > s.min[0] && A.x < s.max[0] &&
                       A.z > s.min[2] && A.z < s.max[2];
          inside.push({ what: s.name, dead,
                        deep: +(dead ? Math.max(ox2, oz2) : Math.min(ox2, oz2)).toFixed(2) });
        }
        inside.sort((x, y) => y.deep - x.deep);
        anchors[a] = { x: A.x, y: A.y, z: A.z, ry: A.ry, inside: inside.slice(0, 3) };
      }

      /* WHERE A FIGURE COULD STAND INSTEAD.

         Finding a clear metre of floor by reading a room builder and
         guessing is how the spots in here ended up inside a barrel
         organ and a repair stand in the first place. So the room is
         asked: sweep the floor on a ten-centimetre grid, keep the
         points where nothing solid reaches into the body, that the
         camera can see, and that are clear of the other spots, and
         report the roomiest of them. Run with SUGGEST=<room>. */
      let free = null;
      if (want === id) {
        free = [];
        const cam0 = rec.cams.main || rec.cams[Object.keys(rec.cams)[0]];
        let pc0 = null;
        if (cam0) {
          pc0 = new T.PerspectiveCamera(cam0.fov, 16 / 9, 0.1, 100);
          pc0.position.set(cam0.pos[0] + ox, cam0.pos[1], cam0.pos[2]);
          pc0.lookAt(cam0.look[0] + ox, cam0.look[1], cam0.look[2]);
          pc0.updateMatrixWorld(true); pc0.updateProjectionMatrix();
        }
        const step = 0.1;
        for (let x = whole.min.x - ox + 0.5; x <= whole.max.x - ox - 0.5; x += step)
          for (let z = whole.min.z + 0.5; z <= whole.max.z - 0.5; z += step) {
            const band = [0.20, 0.90];
            const lo = [x - BODY.x, z - BODY.z], hi = [x + BODY.x, z + BODY.z];
            let clear = true, room2 = 9;
            for (const s2 of solids) {
              if (s2.flat) continue;
              if (s2.max[1] < band[0] || s2.min[1] > band[1]) continue;
              const oxx = Math.min(hi[0], s2.max[0]) - Math.max(lo[0], s2.min[0]);
              const ozz = Math.min(hi[1], s2.max[2]) - Math.max(lo[1], s2.min[2]);
              if (oxx > 0 && ozz > 0) { clear = false; break; }
              /* how much elbow room: distance to the nearest solid */
              const dx2 = Math.max(s2.min[0] - x, 0, x - s2.max[0]);
              const dz2 = Math.max(s2.min[2] - z, 0, z - s2.max[2]);
              room2 = Math.min(room2, Math.hypot(dx2, dz2));
            }
            if (!clear) continue;
            /* the whole figure has to be in the picture, head and feet,
               which is the same projection the check below runs */
            if (pc0) {
              let bad = false, mx = 0, my = 0;
              for (const [sx4, dy4] of [[0, 0.05], [0, 1.35], [-0.3, 0.7], [0.3, 0.7]]) {
                const v4 = new T.Vector3(x + ox + sx4, dy4, z).project(pc0);
                if (v4.z > 1) { bad = true; break; }
                mx = Math.max(mx, Math.abs(v4.x)); my = Math.max(my, Math.abs(v4.y));
              }
              if (bad || mx > 0.86 || my > 0.86) continue;
            }
            let near = 9;
            for (const an2 in rec.anchors) {
              const B = rec.anchors[an2];
              near = Math.min(near, Math.hypot(B.x - x, B.z - z));
            }
            free.push({ x: +x.toFixed(2), z: +z.toFixed(2), room: +room2.toFixed(2), near: +near.toFixed(2) });
          }
        free = free.filter((f) => f.near > 0.9).sort((a, c) => (c.room + c.near * 0.4) - (a.room + a.near * 0.4)).slice(0, 8);
      }

      /* CAN THE CAMERA SEE THE WHOLE OF IT.

         "Within the field of view" is not the question a player asks.
         She asks whether she can see the thing, and a figure whose feet
         are below the bottom of the picture is a figure standing in a
         room she is looking straight at and cannot find. So the real
         camera is built, the figure's head and feet are projected
         through it, and both have to land inside the frame with a
         margin. */
      const cams = {};
      for (const cn in rec.cams) {
        const c = rec.cams[cn];
        cams[cn] = { pos: c.pos, look: c.look, fov: c.fov };
      }
      const camMain = rec.cams.main || rec.cams[Object.keys(rec.cams)[0]];
      const shot = {};
      if (camMain) {
        const pc = new T.PerspectiveCamera(camMain.fov, 16 / 9, 0.1, 100);
        pc.position.set(camMain.pos[0] + ox, camMain.pos[1], camMain.pos[2]);
        pc.lookAt(camMain.look[0] + ox, camMain.look[1], camMain.look[2]);
        pc.updateMatrixWorld(true);
        pc.updateProjectionMatrix();
        for (const an in rec.anchors) {
          const A = rec.anchors[an];
          const pts = [[0, 0.05], [0, 1.35], [-0.3, 0.7], [0.3, 0.7]];
          let worstX = 0, worstY = 0, behind = false;
          for (const [sx, dy] of pts) {
            const v = new T.Vector3(A.x + ox + sx, A.y + dy, A.z).project(pc);
            if (v.z > 1) behind = true;
            worstX = Math.max(worstX, Math.abs(v.x));
            worstY = Math.max(worstY, Math.abs(v.y));
          }
          shot[an] = { x: +worstX.toFixed(2), y: +worstY.toFixed(2), behind };
        }
      }
      out.rooms[id] = { index: rec.index, anchors, cams, free, shot,
                        box: { min: [whole.min.x - ox, whole.min.y, whole.min.z],
                               max: [whole.max.x - ox, whole.max.y, whole.max.z] },
                        solids: solids.length };
    }
    return out;
  });

  if (process.env.DUMP) {
    for (const rid in data.rooms) {
      const R = data.rooms[rid];
      const cam = R.cams.main;
      console.log(`--- ${rid}  floor x ${R.box.min[0].toFixed(1)}..${R.box.max[0].toFixed(1)}  z ${R.box.min[2].toFixed(1)}..${R.box.max[2].toFixed(1)}` +
                  (cam ? `  cam at ${cam.pos.map((v) => v.toFixed(1))} -> ${cam.look.map((v) => v.toFixed(1))} fov ${cam.fov}` : ''));
      for (const an of Object.keys(R.anchors).sort()) {
        const A = R.anchors[an];
        console.log(`    ${an.padEnd(10)} ${A.x.toFixed(2).padStart(6)} ${A.y.toFixed(2).padStart(5)} ${A.z.toFixed(2).padStart(6)}  ry ${A.ry.toFixed(2)}` +
                    (A.inside.length ? (A.inside.some((i) => i.dead) ? '   STANDING IN ' : '   clips ') +
                      A.inside[0].what + ' by ' + A.inside[0].deep : ''));
      }
    }
  }

  if (process.env.SUGGEST) {
    const R = data.rooms[process.env.SUGGEST];
    console.log(`clear floor in ${process.env.SUGGEST}, roomiest first:`);
    (R && R.free || []).forEach((f) =>
      console.log(`    (${f.x}, 0, ${f.z})   ${f.room}m of elbow room, ${f.near}m from the nearest other spot`));
  }

  /* ---- 1. no spot is inside anything ---- */
  const buried = [];
  for (const rid in data.rooms) {
    const R = data.rooms[rid];
    for (const an in R.anchors) {
      const A = R.anchors[an];
      /* THE ONE THAT IS MEANT TO BE INSIDE SOMETHING.

         The owl comes through the ceiling, and the office's hatch spot
         is the mouth of the duct it comes out of -- deliberately inside
         the dark box behind the grate, which the room builder puts
         there so that something can be seen moving in it. s2 is the
         same coordinate under another name. Everything else that is
         inside something is a fault. */
      if (rid === 'office' && (an === 'hatch' || an === 's2')) continue;
      const dead = A.inside.filter((i) => i.dead)[0];
      if (dead) buried.push(`${rid}/${an} is STANDING IN ${dead.what}`);
      else if (A.inside.length && A.inside[0].deep >= 0.18)
        buried.push(`${rid}/${an} clips ${A.inside[0].what} by ${A.inside[0].deep}m`);
    }
  }
  ok('no standing spot is inside a wall or a prop', buried.length === 0,
     buried.length ? buried.length + ' of them' : 'all clear');
  if (buried.length) buried.forEach((x) => console.log('        ' + x));

  /* ---- 2. every spot a route uses exists ---- */
  const missing = [];
  for (const who in data.routes)
    for (const [rid, an] of data.routes[who]) {
      const R = data.rooms[rid];
      if (!R) { missing.push(`${who}: no room ${rid}`); continue; }
      if (!R.anchors[an]) missing.push(`${who}: ${rid} has no "${an}"`);
    }
  ok('every spot a route names actually exists', missing.length === 0,
     missing.length ? missing.join('; ') : 'all present');

  /* ---- 3. two of them never stand in the same place ---- */
  /* which pairs can be in the same room at the same time: anybody whose
     route visits a room another route also visits */
  const clash = [], clashPairs = [];
  const ids = Object.keys(data.routes);
  for (let i = 0; i < ids.length; i++)
    for (let j = i + 1; j < ids.length; j++) {
      const a = data.routes[ids[i]], c = data.routes[ids[j]];
      for (const [ra, aa] of a)
        for (const [rc, ac] of c) {
          if (ra !== rc) continue;
          const A = data.rooms[ra] && data.rooms[ra].anchors[aa];
          const C = data.rooms[rc] && data.rooms[rc].anchors[ac];
          if (!A || !C) continue;
          const d = Math.hypot(A.x - C.x, A.y - C.y, A.z - C.z);
          /* the office doorways are the exception and cannot be
             anything else: two right-door performers both have to come
             to the right-hand door. They are separated as they arrive
             instead, which the live run below measures. */
          if (ra === 'office') continue;
          if (d < 0.55) {
            clash.push(`${ids[i]}@${ra}/${aa} and ${ids[j]}@${rc}/${ac}`);
            clashPairs.push([ids[i], ra, aa, ids[j], rc, ac]);
          }
        }
    }
  /* WHICH PAIRS COLLIDE ON PAPER IS INTERESTING. WHETHER THEY COLLIDE
     IN THE SHOP IS THE QUESTION.

     Twelve pairs of routes name the same spot in the same room -- the
     soldier and the parcel that came back walk the hall through exactly
     the same three stations, and two of the parcels share a route
     almost end to end. That is a reasonable way to build a shop with
     nine rooms in it, and it is not a fault on its own: every one of
     them is placed through syncChar, which stands anybody aside who
     arrives on top of somebody. So the list is printed, because
     somebody editing a route should know, and then every pair on it is
     STAGED and measured, which is the part that can actually be wrong. */
  console.log(`      ${clash.length} pairs of routes name the same spot; each is staged below`);

  /* ---- 4. AND NOW THE LIVE ONE ----

     The checks above are arithmetic on the tables, which cannot see
     what happens when the shop is running: two of them walking into the
     same room on the same tick, the fallback picking a spot, one being
     sent to a door another is already standing in. So four nights are
     played out with every figure's position read on every tick, and the
     closest any two of them ever came is the answer. */
  const live = await p.evaluate(() => {
    const N = OuissysNightShift.__night, G = N.state(), cast = N.cast();
    const CLEAR = N.spotClear();
    const worst = {};
    for (const night of [1, 2, 3, 4]) {
      N.begin(night);
      let closest = 99, when = '';
      for (let k = 0; k < 60 * 30 * 7; k++) {
        /* SHE HAS TO SURVIVE TO SIX FOR THIS TO MEAN ANYTHING.

           The first version let the night kill her, so it broke out at
           about three o'clock and reported "never two in a room
           together" -- which was true of the run and told nobody
           anything about the game. Shutters down, meter topped up: the
           whole night plays, and the four of them walk their whole
           routes. */
        G.doors.left = G.doors.right = G.doors.hatch = true;
        G.power = Math.max(G.power, 50);
        if (G.phase !== 'play') break;
        N.pumpFrame(1 / 30);
        const ids2 = Object.keys(cast).filter((i) => cast[i].awake);
        for (let a = 0; a < ids2.length; a++)
          for (let c = a + 1; c < ids2.length; c++) {
            const A = cast[ids2[a]], C = cast[ids2[c]];
            if (A.room !== C.room) continue;
            const d = Math.hypot(A.group.position.x - C.group.position.x,
                                 A.group.position.z - C.group.position.z);
            if (d < closest) { closest = d;
              when = `${ids2[a]} and ${ids2[c]} in the ${A.room} at ${G.hour} o'clock`; }
          }
        if (G.hour >= 6) break;
      }
      worst[night] = { closest: +closest.toFixed(2), when };
    }
    return { worst, CLEAR };
  });
  /* EVERY PAIR THAT CAN COLLIDE, PUT ON TOP OF EACH OTHER ON PURPOSE ---- */
  const staged = await p.evaluate((pairs) => {
    const N = OuissysNightShift.__night, cast = N.cast();
    const CLEAR = N.spotClear();
    const bad = [];
    for (const [a, ra, aa, c, rc, ac] of pairs) {
      N.begin(4);
      const A = cast[a], C = cast[c];
      if (!A || !C) continue;
      A.awake = true; A.asleep = false;
      C.awake = true; C.asleep = false;
      N.putAt(a, ra, aa);
      N.putAt(c, rc, ac);
      /* the second one placed is the one that has to stand aside, which
         is what happens in the shop: whoever walks in last moves */
      N.standAside(c);
      const d = Math.hypot(A.group.position.x - C.group.position.x,
                           A.group.position.z - C.group.position.z);
      if (d < CLEAR - 0.02) bad.push(`${a} and ${c} at ${ra}/${aa}: ${d.toFixed(2)}m`);
    }
    return { bad, n: pairs.length, CLEAR };
  }, clashPairs);
  ok('and every one of them is stood aside when it happens',
     staged.bad.length === 0,
     staged.bad.length ? staged.bad.slice(0, 5).join('; ')
                       : `${staged.n} staged collisions, all separated by at least ${staged.CLEAR}m`);

  /* AND THE ONE CASE THAT MATTERS, STAGED RATHER THAN WAITED FOR.

     Two right-door performers finishing at the same doorway is the
     collision that cannot be designed away, and waiting for a random
     night to produce it is not a test. So it is made to happen: both of
     them put on the last step of their own routes, which is the same
     spot, and then measured. */
  const doorway = await p.evaluate(() => {
    const N = OuissysNightShift.__night, G = N.state(), cast = N.cast();
    N.begin(4);
    const out = [];
    for (const pair of [['marabelle', 'jax'], ['cogsworth', 'chime']]) {
      for (const id of pair) {
        const ch = cast[id];
        ch.awake = true; ch.asleep = false;
        ch.step = N.castDefs().filter((d) => d.id === id)[0].route.length - 1;
        N.syncOne(id);
      }
      const A = cast[pair[0]], B = cast[pair[1]];
      out.push({ pair: pair.join(' and '), room: A.room + '/' + B.room,
                 d: +Math.hypot(A.group.position.x - B.group.position.x,
                                A.group.position.z - B.group.position.z).toFixed(2),
                 doors: [A.def.door, B.def.door] });
    }
    return out;
  });
  doorway.forEach((d) => {
    const same = d.doors[0] === d.doors[1];
    ok(`both at the ${d.doors[0] === d.doors[1] ? d.doors[0] + ' door' : 'their own doors'}: ${d.pair} stand apart`,
       d.d >= live.CLEAR - 0.02 || !same,
       `${d.d}m apart in ${d.room}` + (same ? ' (the same doorway)' : ''));
  });

  for (const n of [1, 2, 3, 4]) {
    const w = live.worst[n];
    ok(`night ${n}, played out: no two of them are ever in the same place`,
       w.closest >= live.CLEAR - 0.02,
       w.closest === 99 ? 'NEVER TWO IN A ROOM TOGETHER — this run proved nothing'
                        : `closest ${w.closest}m (needs ${live.CLEAR}) — ${w.when}`);
  }

  /* ---- 5. every spot is inside its own room ---- */
  const outside = [];
  for (const rid in data.rooms) {
    const R = data.rooms[rid];
    for (const an in R.anchors) {
      const A = R.anchors[an];
      /* the office's door and hall spots are deliberately in the doorway
         and the corridor beyond it */
      if (rid === 'office' && /Door|Hall|hatch|^s[012]$/.test(an)) continue;
      const m = 0.9;
      if (A.x < R.box.min[0] - m || A.x > R.box.max[0] + m ||
          A.z < R.box.min[2] - m || A.z > R.box.max[2] + m)
        outside.push(`${rid}/${an} at (${A.x},${A.z}) outside [${R.box.min[0].toFixed(1)}..${R.box.max[0].toFixed(1)}, ${R.box.min[2].toFixed(1)}..${R.box.max[2].toFixed(1)}]`);
    }
  }
  ok('every spot is inside the room it belongs to', outside.length === 0,
     outside.length ? outside.slice(0, 4).join('; ') : 'all inside');

  /* ---- 6. the whole figure is in the picture ---- */
  const unseen = [];
  for (const rid in data.rooms) {
    const R = data.rooms[rid];
    for (const an in R.anchors) {
      if (!/^s[0-9]$|^far$|^mid$|^near$/.test(an)) continue;
      const v = R.shot && R.shot[an];
      if (!v) continue;
      if (v.behind) { unseen.push(`${rid}/${an} is behind the ${rid} camera`); continue; }
      if (v.x > 0.94 || v.y > 0.94)
        unseen.push(`${rid}/${an} runs off the ${v.y > 0.94 ? 'top or bottom' : 'side'} of the ${rid} picture (${v.x}, ${v.y} of 1.0)`);
    }
  }
  ok('every figure stands wholly inside the picture its camera makes',
     unseen.length === 0, unseen.length ? unseen.join('; ') : 'all fully in frame');

  ok('and none of it threw', errs.length === 0, errs[0] || '');
  console.log(`\n${pass} passed, ${fail} failed`);
  await b.close();
  process.exit(fail ? 1 : 0);
})();
