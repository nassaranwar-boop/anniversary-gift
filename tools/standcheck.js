/* WHERE THEY ACTUALLY END UP, OVER SIX NIGHTS OF REAL PLAY.

   geomcheck audits the ANCHOR TABLE -- every named spot is on the
   floor, in the room, clear of furniture. That is the right check and
   it passes. It is not the whole question, because a figure does not
   always stand on its anchor.

   Nothing here walks: stepCast advances `ch.step` and syncChar snaps
   the group to that step's anchor, so there is no interpolated stroll
   to clip through a table halfway along. The risk is every place the
   chapter puts a figure SOMEWHERE ELSE -- above all `standClear()`,
   which shoves the second arrival at a spot sideways by up to three
   spot-widths, or hands it a spare spot from `freeSpotIn()`, and tests
   neither against the furniture.

   Rather than invent crowds by hand -- which mostly tests this file's
   imagination, since the ballerina can no more reach the ceiling hatch
   than the owl can use the west door -- this plays the nights and
   samples every awake figure's real position, every few ticks, against
   geomcheck's own ruler: the torso band between knee and head, and how
   far into the footprint a solid reaches. Real positions, real crowds,
   real standClear. */
const { chromium } = require('playwright-core');

const BODY = { x: 0.34, z: 0.34 };
const DEEP = Number(process.env.DEEP || 0.12);
const NIGHTS = Number(process.env.NIGHTS || 6);
const SECS = Number(process.env.SECS || 340);   /* a whole night is 336 */

let pass = 0, fail = 0;
const t = (n, c, note) => { c ? pass++ : fail++;
  console.log(`${c ? 'PASS' : 'FAIL'}  ${n}${note !== undefined ? '   ' + note : ''}`); };

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox', '--no-proxy-server', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 900, height: 600 } });
  p.on('pageerror', (e) => console.log('PAGEERROR', e.message));
  await p.route('**/*', (r) => { const u = r.request().url();
    if (u.indexOf('book-scene.js') >= 0) return r.abort();
    return u.startsWith('http://127.0.0.1') ? r.continue() : r.abort(); });
  await p.goto('http://127.0.0.1:8899/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.evaluate(() => { try { localStorage.clear(); } catch (e) {} localStorage.setItem('ns_notutor', '1');
    showScreen('nightshift');
    return loadChapter('nightshift').then(() => OuissysNightShift.start()); });
  await p.waitForFunction(() => { try { return !!OuissysNightShift.__night.cast().jax; } catch (e) { return false; } },
                          { timeout: 180000, polling: 500 });

  const all = [];
  for (let night = 1; night <= NIGHTS; night++) {
    const r = await p.evaluate(([night, BODY, DEEP, SECS]) => {
      const N = OuissysNightShift.__night, T = N.three();
      const rooms = N.rooms(), SPACING = N.spacing(), cast = N.cast();

      /* every static mesh in a room, as a box, in room-local space */
      const cacheKey = '__solids';
      if (!window[cacheKey]) {
        window[cacheKey] = {};
        for (const rid in rooms) {
          const rec = rooms[rid], ox = rec.index * SPACING, out = [];
          rec.group.updateMatrixWorld(true);
          rec.group.traverse((o) => {
            if (!o.isMesh || !o.geometry) return;
            const bb = new T.Box3().setFromObject(o);
            if (!isFinite(bb.min.x)) return;
            const size = bb.getSize(new T.Vector3());
            if (size.y < 0.12) return;
            let nm = o.name || (o.userData && o.userData.tag) || '';
            for (let a = o.parent; a && !nm; a = a.parent)
              nm = a.name || (a.userData && a.userData.tag) || '';
            if (!nm) nm = (o.geometry.type || 'mesh').replace('Geometry', '') +
                          ' ' + size.x.toFixed(1) + 'x' + size.y.toFixed(1) + 'x' + size.z.toFixed(1);
            out.push({ name: nm, min: [bb.min.x - ox, bb.min.y, bb.min.z],
                                 max: [bb.max.x - ox, bb.max.y, bb.max.z] });
          });
          window[cacheKey][rid] = out;
        }
      }
      const SOL = window[cacheKey];

      const depthAt = (solids, x, y, z) => {
        const band = [y + 0.20, y + 0.90];
        const lo = [x - BODY.x, z - BODY.z], hi = [x + BODY.x, z + BODY.z];
        let worst = 0, who = null;
        for (const s of solids) {
          /* something whose top is at or below the knee is floor:
             the stage deck is 3.6 by 7.2 and you stand on it */
          if (s.max[1] <= y + 0.20) continue;
          if (s.min[1] > band[1]) continue;
          const dx = Math.min(hi[0], s.max[0]) - Math.max(lo[0], s.min[0]);
          const dz = Math.min(hi[1], s.max[2]) - Math.max(lo[1], s.min[2]);
          if (dx <= 0 || dz <= 0) continue;
          const inX = x > s.min[0] && x < s.max[0];
          const inZ = z > s.min[2] && z < s.max[2];
          const d = (inX && inZ) ? Math.min(dx, dz) : Math.min(dx, dz) * 0.5;
          if (d > worst) { worst = d; who = s.name; }
        }
        return { d: +worst.toFixed(3), who };
      };

      N.begin(night); N.midEnd();
      const G = N.state();
      const bad = [], samples = { n: 0 };
      for (let i = 0; i < SECS * 30; i++) {
        /* SHE SURVIVES THE NIGHT, BECAUSE THIS IS ABOUT WHERE THEY
           STAND AND NOT ABOUT WHETHER SHE LIVES.

           Left to itself with nobody at the controls the shift ends
           about one in the morning, which is a minute of walking and
           nowhere near enough of it. Every door held and the meter
           kept full means they arrive, find it shut, retreat and set
           off again all night: the most walking, the most retreating
           and the most crowding the shop can produce. */
        G.doors.left = G.doors.right = G.doors.hatch = true;
        G.power = 100;
        if (N.pumpFrame(1 / 30) !== 'play') {
          /* A CARD IS NOT THE END OF THE NIGHT.

             The find at three and the keeper beat both take the phase
             off `play`, and stopping there threw away half of every
             night. Take whatever the card offers and carry on; only a
             death or the dawn ends this. */
          if (G.phase === 'reveal' || G.phase === 'held') {
            try { N.route(G.phase === 'held' ? 'heldOut' : 'keep'); } catch (e) {}
            if (N.state().phase !== 'play') break;
            continue;
          }
          break;
        }
        if (i % 15) continue;                       /* twice an in-game second */
        for (const id in cast) {
          const c = cast[id];
          /* `visible` is about which room is on the monitor, and nothing
             here is rendering one. Where a figure IS does not depend on
             whether she happens to be looking at it. */
          if (!c.awake || c.asleep || !c.group) continue;
          const rec = rooms[c.room];
          if (!rec) continue;
          const ox = rec.index * SPACING;
          const x = c.group.position.x - ox, y = c.group.position.y, z = c.group.position.z;
          samples.n++;
          /* a figure at its OWN door is inside that door's frame or the
             hatch housing, which is what arriving looks like */
          const own = c.def && c.def.door;
          const oa = rec.anchors && rec.anchors[own === 'hatch' ? 'hatch'
                                   : own === 'left' ? 'leftDoor' : 'rightDoor'];
          if (oa && Math.abs(oa.x - x) < 0.03 && Math.abs(oa.z - z) < 0.03) continue;
          const r = depthAt(SOL[c.room] || [], x, y, z);
          if (r.d >= DEEP)
            bad.push({ night: night, room: c.room, who: id, anchor: c.anchor,
                       at: [+x.toFixed(2), +y.toFixed(2), +z.toFixed(2)],
                       depth: r.d, into: r.who, atDoor: !!c.atDoor });
        }
      }
      return { bad: bad, samples: samples.n, hour: G.hour, phase: G.phase };
    }, [night, BODY, DEEP, SECS]);
    console.log(`  night ${night}: ${r.samples} figure-samples to ${r.hour} o'clock (${r.phase})` +
                (r.bad.length ? `  — ${r.bad.length} in the furniture` : ''));
    all.push(...r.bad);
  }

  console.log();
  if (all.length) {
    const seen = new Map();
    all.forEach((r) => {
      const k = r.room + '/' + r.who + '/' + r.anchor + '/' + r.into;
      if (!seen.has(k)) seen.set(k, { ...r, n: 0 });
      seen.get(k).n++;
    });
    [...seen.values()].sort((a, b) => b.depth - a.depth).forEach((r) => {
      console.log(`  ${r.room}  ${r.who} at ${r.anchor || '(off-anchor)'} ${r.at.join(',')} ` +
                  `is ${r.depth}m inside ${r.into}   seen ${r.n}x`);
    });
    console.log();
  }
  t('nobody ends a tick standing inside the furniture', all.length === 0,
    all.length ? all.length + ' samples at or past ' + DEEP + 'm' : 'all clear');

  console.log(`\n${pass} passed, ${fail} failed`);
  await b.close();
  process.exit(fail ? 1 : 0);
})();
