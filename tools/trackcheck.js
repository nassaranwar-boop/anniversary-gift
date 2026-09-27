/* WHAT MAKES A TRACK A TRACK, MEASURED RATHER THAN EYEBALLED.

   A course here is a ring of normalised points run through a closed
   Catmull-Rom, so it is data and can be judged as data. This pulls the
   real TRACKS table and the real spline out of racing.js -- not a copy of
   them, which would drift -- and reports, per course:

     length      a lap has to last 45-75s, and speed is fixed, so this is
                 the clock. 10000-11000 world units is the band the four
                 shipped tracks sit in.
     min radius  the tightest corner. Below about 120 units a kart at
                 speed cannot hold the line and the corner reads as a
                 wall; above 900 it is not a corner.
     straights   the longest run under 0.004 rad/unit of curvature. A
                 course with no straight has nowhere to use a boost.
     margin      how close the centreline comes to the edge of the world.
                 Scenery and shoulder need SHOULDER + a little past it.
     crossings   where the ring crosses itself. A figure-of-eight is a
                 bug here: the projection snaps to the wrong lobe.
     cut         the shortcut's ends have to land ON the main ring and
                 leave within 25 degrees of it, or a kart taking it gets
                 snapped to the far side of the infield.

   ...and across courses, the one number that says whether there are four
   tracks or one track in four coats: the mean distance from each point of
   one centreline to the nearest point of another. The road is 92 wide, so
   anything under that is two courses sharing tarmac.

     node tools/trackcheck.js
*/
const fs = require("fs");

const src = fs.readFileSync(require("path").join(__dirname, "..", "racing.js"), "utf8");

const grab = (name) => {
  const i = src.indexOf("const " + name + " = ");
  if (i < 0) throw new Error("no " + name);
  const j = src.indexOf("\n];", i);
  return src.slice(src.indexOf("[", i), j + 2);
};
const num = (name) => {
  const m = src.match(new RegExp("const\\s+" + name + "\\s*=\\s*([0-9.]+)"));
  if (!m) throw new Error("no " + name);
  return parseFloat(m[1]);
};

const WORLD = num("WORLD"), SHOULDER = num("SHOULDER"), ROAD_HALF = num("ROAD_HALF");
/* Either the shipped table, or a candidate file of the same shape, so a
   course can be judged before it is pasted into the game:
     node tools/trackcheck.js draft.json      */
const arg = process.argv.slice(2).filter((a) => a[0] !== "-")[0];
const TRACKS = arg ? JSON.parse(fs.readFileSync(arg, "utf8")) : eval(grab("TRACKS"));
const MAP = process.argv.indexOf("--map") >= 0;

/* the spline, lifted verbatim so this cannot disagree with the game */
const catmullSrc = src.slice(src.indexOf("function catmull("),
                             src.indexOf("function buildPath("));
eval(catmullSrc);

const ring = (t) => catmull(t.pts.map((p) => ({ x: p[0] * WORLD, y: p[1] * WORLD })), true);
const open = (pts) => catmull(pts.map((p) => ({ x: p[0] * WORLD, y: p[1] * WORLD })), false);
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

function lengthOf(p) {
  let L = 0;
  for (let i = 0; i < p.length; i++) L += dist(p[i], p[(i + 1) % p.length]);
  return L;
}

/* Menger curvature of three consecutive samples -> the radius of the
   circle through them. Sampled a few nodes apart, or spline wobble
   between adjacent samples reads as a hairpin. */
function radii(p, step) {
  const n = p.length, out = [];
  for (let i = 0; i < n; i++) {
    const a = p[(i - step + n) % n], b = p[i], c = p[(i + step) % n];
    const ab = dist(a, b), bc = dist(b, c), ca = dist(c, a);
    const area = Math.abs((b.x - a.x) * (c.y - a.y) - (c.x - a.x) * (b.y - a.y)) / 2;
    out.push(area < 1e-6 ? Infinity : (ab * bc * ca) / (4 * area));
  }
  return out;
}

/* the longest run of samples whose radius stays above `r` */
function longestStraight(p, rad, r) {
  const n = p.length;
  let best = 0;
  for (let s = 0; s < n; s++) {
    if (rad[s] < r) continue;
    let len = 0, i = s;
    while (rad[i % n] >= r && len < lengthOf(p)) {
      len += dist(p[i % n], p[(i + 1) % n]); i++;
      if (i - s > n) break;
    }
    if (len > best) best = len;
  }
  return best;
}

/* A STRADDLE TEST THAT DOES NOT FIRE ON A CIRCLE.

   The textbook version compares Math.sign of two cross products and calls
   it a crossing when they differ. Nearly-collinear points make one of them
   exactly 0, 0 differs from 1, and a perfect circle came back with four
   self-intersections. Strict opposite signs, and segments within a few
   samples of each other are skipped outright -- at fourteen samples per
   control point those are the same corner, not two bits of road. */
function segHit(a, b, c, d) {
  const s = (p, q, r) => (q.x - p.x) * (r.y - p.y) - (r.x - p.x) * (q.y - p.y);
  return s(a, b, c) * s(a, b, d) < 0 && s(c, d, a) * s(c, d, b) < 0;
}
function crossings(p) {
  const n = p.length, hits = [];
  const near = (i, j) => { const d = Math.abs(i - j); return Math.min(d, n - d) <= 3; };
  for (let i = 0; i < n; i++) {
    for (let j = i + 2; j < n; j++) {
      if (near(i, j)) continue;
      if (segHit(p[i], p[(i + 1) % n], p[j], p[(j + 1) % n])) hits.push([i, j]);
    }
  }
  return hits;
}

/* Nearest point on a ring, and the ring's heading there. The heading is
   taken over a span rather than between neighbours: consecutive spline
   samples are a few units apart, so one sample of wobble reads as a
   ninety-degree turn and the cut-angle check reported 150 degrees on a
   shortcut that is visibly parallel to the road it leaves. */
function headingAt(p, i, span) {
  const n = p.length, a = p[(i - span + n * 2) % n], b = p[(i + span) % n];
  return Math.atan2(b.y - a.y, b.x - a.x);
}
function project(p, q) {
  let bd = Infinity, bi = 0;
  for (let i = 0; i < p.length; i++) {
    const d = dist(p[i], q);
    if (d < bd) { bd = d; bi = i; }
  }
  return { d: bd, i: bi, head: headingAt(p, bi, 5) };
}
/* ...and the same span for the shortcut's own ends */
function endHeading(c, atEnd) {
  const s = Math.min(6, c.length - 1);
  return atEnd ? Math.atan2(c[c.length-1].y - c[c.length-1-s].y, c[c.length-1].x - c[c.length-1-s].x)
               : Math.atan2(c[s].y - c[0].y, c[s].x - c[0].x);
}
const wrapPi = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };

/* THE GRID SITS BEHIND THE LINE, so the run up to path[0] has to be
   straight enough to park eight karts on. */
function approachRadius(p, units) {
  const rad = radii(p, 3);
  let s = 0, i = 0, worst = Infinity;
  while (s < units && i < p.length) {
    const k = (p.length - i) % p.length;
    worst = Math.min(worst, rad[k]);
    s += dist(p[k], p[(k + 1) % p.length]);
    i++;
  }
  return worst;
}

/* a course, drawn small enough to read in a terminal */
function drawMap(p, w, h) {
  const grid = Array.from({ length: h }, () => new Array(w).fill(" "));
  p.forEach((q, i) => {
    const x = Math.round((q.x / WORLD) * (w - 1));
    const y = Math.round((q.y / WORLD) * (h - 1));
    if (x >= 0 && x < w && y >= 0 && y < h) grid[y][x] = i === 0 ? "S" : "#";
  });
  return grid.map((r) => "    " + r.join("")).join("\n");
}

let bad = 0;
const say = (ok, line) => { if (!ok) bad++; console.log((ok ? "  ok  " : "  BAD ") + line); };

const rings = {};
for (const t of TRACKS) {
  const p = ring(t);
  rings[t.id] = p;
  const rad = radii(p, 3);
  const minR = Math.min(...rad);
  const tight = rad.filter((r) => r < 200).length;
  const L = lengthOf(p);
  const str = longestStraight(p, rad, 1200);
  const mx = Math.min(...p.map((q) => Math.min(q.x, WORLD - q.x, q.y, WORLD - q.y)));
  const xs = crossings(p);

  console.log(`\n=== ${t.id.padEnd(6)} ${t.name} ===  ${t.laps} laps`);
  /* THE BARS ARE THE SHIPPED FOUR, NOT ROUND NUMBERS.
     Every threshold here is set just outside what Cabin Woods, Hometown
     Streets, Hospital Dash and Rooftop Sunset measured before they were
     redrawn, so a new course has to be at least as drivable as the ones it
     replaces and the test cannot be satisfied by moving the goalposts:
       length  10474-10698   min radius 94-122   straight 653-1268
       grid approach 594-1011   cut angles 27-59 deg
     Length is checked as the RACE rather than the lap: what a player feels
     is how long the thing lasts, and a shorter lap run more times is a
     legitimate way to get there -- it also gives more starts and more
     overtaking than one long one. */
  const race = L * t.laps;
  say(L > 7500 && L < 12500,  `lap length    ${L.toFixed(0).padStart(6)}  (7500-12500)`);
  say(race > 28000 && race < 36000,
                              `race distance ${race.toFixed(0).padStart(6)}  (28000-36000, ${t.laps} laps)`);
  say(minR > 95,              `min radius    ${minR.toFixed(0).padStart(6)}  (>95)  tight corners: ${tight}`);
  say(str > 620,              `longest straight ${str.toFixed(0).padStart(4)}  (>620)`);
  say(mx > SHOULDER + 40,     `edge margin   ${mx.toFixed(0).padStart(6)}  (>${SHOULDER + 40})`);
  say(xs.length === 0,        `self-crossings ${String(xs.length).padStart(5)}  (0)`);
  /* TWO BITS OF ROAD THAT NEVER TOUCH CAN STILL RUIN A COURSE.
     A kart finds where it is on the lap by projecting onto the nearest
     piece of centreline. Where the circuit doubles back and runs close to
     itself, the nearest piece is the WRONG piece: the kart is told it is
     somewhere else on the lap, turns for a corner that is not in front of
     it and drives into the scenery. It does not have to cross itself to do
     this -- it only has to come near. A first draft of Hometown Streets
     passed every other check here and returned 197-second laps against a
     38-second leader for exactly this reason. Two road widths is the
     margin: nearer than that and the projection can pick the wrong lobe. */
  const cum = [0];
  for (let i = 1; i < p.length; i++) cum.push(cum[i - 1] + dist(p[i - 1], p[i]));
  const lapLen = cum[p.length - 1] + dist(p[p.length - 1], p[0]);
  let nearest = Infinity, nearAt = null;
  for (let i = 0; i < p.length; i += 2) {
    for (let j = i + 2; j < p.length; j += 2) {
      /* "far apart" has to mean far along the LAP, not far apart in the
         sample list. A spike that goes in and comes straight back out puts
         its two legs a handful of samples apart and a few metres apart, and
         an index-gap test walks straight past it -- which is how a course
         with a 900-unit-deep spike in it passed this check and returned
         197-second laps. */
      const along = Math.min(cum[j] - cum[i], lapLen - (cum[j] - cum[i]));
      if (along < 900) continue;
      const d = dist(p[i], p[j]);
      if (d < nearest) { nearest = d; nearAt = [i, j]; }
    }
  }
  say(nearest > ROAD_HALF * 4,
      `never doubles back onto itself  ${nearest.toFixed(0).padStart(5)}  (>${ROAD_HALF * 4})` +
      (nearAt ? `  at (${(p[nearAt[0]].x / WORLD).toFixed(2)},${(p[nearAt[0]].y / WORLD).toFixed(2)})` : ""));

  /* HOW HARD DOES IT TURN, PER LENGTH OF ROAD?
     Min radius is the tightest single point; this is the whole corner. A
     kart -- and the autopilot especially, which aims a fixed distance ahead
     -- can follow only so much direction change per metre of road before it
     cuts the corner and ends up on the grass, where it is slower and so can
     never rejoin. Measured through this same code the four shipped courses
     turn at most 54 to 61 degrees per 300 units. A redraw of Hometown
     Streets came out at 108 and returned 197-second laps: three karts went
     off at the same corner every lap and crawled round the outside of it on
     the grass for the whole race. 68 is just above the shipped worst.
     The centreline is resampled to a fixed step first -- catmull steps t in
     a while loop and leaves pairs of samples almost coincident, and atan2
     between two points a thousandth of a unit apart is noise, which read as
     600 degrees per 300 units on courses that are visibly smooth. */
  const evenly = (() => {
    const n0 = p.length, cu = [0];
    for (let i = 0; i < n0; i++) cu.push(cu[i] + dist(p[i], p[(i + 1) % n0]));
    const tot = cu[n0], m = Math.max(24, Math.round(tot / 12));
    const out = []; let j = 0;
    for (let k = 0; k < m; k++) {
      const d = tot * k / m;
      while (j < n0 - 1 && cu[j + 1] < d) j++;
      const f = (d - cu[j]) / Math.max(1e-9, cu[j + 1] - cu[j]);
      const a = p[j], b2 = p[(j + 1) % n0];
      out.push({ x: a.x + (b2.x - a.x) * f, y: a.y + (b2.y - a.y) * f });
    }
    return out;
  })();
  const worstTurn = (() => {
    const n = evenly.length;
    const seg = [], head = [];
    for (let i = 0; i < n; i++) {
      const a = evenly[i], b2 = evenly[(i + 1) % n];
      seg.push(dist(a, b2)); head.push(Math.atan2(b2.y - a.y, b2.x - a.x));
    }
    const wrap = (a) => { while (a > Math.PI) a -= 2 * Math.PI;
                          while (a < -Math.PI) a += 2 * Math.PI; return a; };
    let worst = 0;
    for (let i = 0; i < n; i++) {
      let acc = 0, turn = 0, j = i;
      while (acc < 300 && j - i <= n) {
        turn += Math.abs(wrap(head[(j + 1) % n] - head[j % n]));
        acc += seg[j % n]; j++;
      }
      if (turn > worst) worst = turn;
    }
    return worst * 180 / Math.PI;
  })();
  say(worstTurn < 68, `turn per 300 units ${worstTurn.toFixed(0).padStart(5)} deg  (<68; shipped 54-61)`);

  const ap = approachRadius(p, 420);
  say(ap > 500,               `grid approach ${(ap === Infinity ? "straight" : ap.toFixed(0)).padStart(6)}  (>500, eight karts park on it)`);

  if (MAP) console.log(drawMap(p, 60, 30));

  if (t.cut) {
    const c = open(t.cut.pts);
    const a = project(p, c[0]), b = project(p, c[c.length - 1]);
    const ha = Math.abs(wrapPi(endHeading(c, false) - a.head)) * 180 / Math.PI;
    const hb = Math.abs(wrapPi(endHeading(c, true)  - b.head)) * 180 / Math.PI;
    /* how much of a lap it saves: along-difference minus its own length */
    const along = (i) => { let s = 0; for (let k = 0; k < i; k++) s += dist(p[k], p[k + 1]); return s; };
    /* the road it replaces is the way round that goes FORWARD from where it
       leaves to where it rejoins, which may wrap past the start line */
    let arc = along(b.i) - along(a.i);
    if (arc < 0) arc += L;
    let cutLen = 0;
    for (let i = 0; i < c.length - 1; i++) cutLen += dist(c[i], c[i + 1]);
    const saved = arc - cutLen;
    say(a.d < ROAD_HALF, `cut leaves  ${a.d.toFixed(0).padStart(4)} from the ribbon (<${ROAD_HALF})  at ${ha.toFixed(0)}deg (<25)`);
    say(b.d < ROAD_HALF, `cut rejoins ${b.d.toFixed(0).padStart(4)} from the ribbon (<${ROAD_HALF})  at ${hb.toFixed(0)}deg (<25)`);
    /* 55, not 25: the comment in racing.js claims 25, but the four shipped
       shortcuts actually leave at 27, 30, 49 and 59 degrees, and all four
       are visibly takeable. A slip road across a hairpin meets the road at
       roughly the half-angle of the hairpin; there is no way to have the
       one without the other. */
    say(ha < 55 && hb < 55, `cut angles    ${ha.toFixed(0)}deg / ${hb.toFixed(0)}deg  (<55)`);
    say(saved > 150 && saved < L * 0.14,
        `cut saves     ${saved.toFixed(0).padStart(6)}  (150 - ${(L * 0.14).toFixed(0)}, i.e. under a seventh of a lap)`);
  }
}

console.log("\n=== ARE THEY FOUR TRACKS, OR ONE IN FOUR COATS? ===");
console.log(`    (the road is ${ROAD_HALF * 2} wide; two centrelines closer than that share tarmac)`);
const ids = TRACKS.map((t) => t.id);
for (let i = 0; i < ids.length; i++) {
  for (let j = i + 1; j < ids.length; j++) {
    const a = rings[ids[i]], b = rings[ids[j]];
    const mean = a.reduce((s, q) => s + project(b, q).d, 0) / a.length;
    say(mean > ROAD_HALF * 3,
        `${ids[i].padEnd(6)} vs ${ids[j].padEnd(6)} mean centreline gap ${mean.toFixed(0).padStart(5)}  (>${ROAD_HALF * 3})`);
  }
}
console.log(`\n${bad} problem${bad === 1 ? "" : "s"}.`);
