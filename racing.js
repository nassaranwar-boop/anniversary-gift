/* =========================================================
   SUPER OUISSY RACE — a Mode 7 pixel kart racer

   The look this is chasing is SNES-era Super Mario Kart, and the thing
   that actually makes that look is not the sprites — it is Mode 7: the
   ground is one big texture, and every scanline of the screen samples it
   at a different scale, so the road opens out towards you. Everything
   else here hangs off that.

   The whole world is baked once per track into a 2048x2048 canvas
   (grass, shoulder, rumble strip, road, markings). The renderer walks
   the visible scanlines, works out how far away each one is, and copies
   a row of that texture across the screen. Karts, trees and item boxes
   are billboards projected into the same space and drawn back to front.

   Nothing here is shared with the platformer or the apocalypse chapter —
   they are different games and they draw themselves their own way.
   ========================================================= */
window.SuperOuissyRace = (function () {
"use strict";

/* ---------------------------------------------------------
   1. NUMBERS THAT DEFINE THE CAMERA

   These are tuned together. Changing one without the others is what
   turns a racer into a slideshow of a carpet.
   --------------------------------------------------------- */
/* World units and texture pixels are deliberately not the same thing.

   A lap has to last 45-75 seconds, and the honest way to get there is a
   longer course — slowing the kart down to pad the clock just makes it
   feel like a milk float. But the baked sheet cannot grow without the
   memory growing with the square of it, so instead the sheet covers a
   bigger world at a slightly coarser resolution: WORLD units across,
   painted into TEX pixels. Every physics and camera number below stays
   in world units and stays exactly as it was tuned; only the sampling
   step divides through by TSCALE. */
const WORLD    = 3072;   // the world is this many units square
const TEX      = 2048;   // ...painted into this many pixels square
const TSCALE   = WORLD / TEX;   // world units per texel

const RW       = 400;    // internal render width  (then scaled up, unsmoothed)
const RH       = 225;    // internal render height
const HORIZON  = 90;     // screen row the ground vanishes at
const FOCAL    = 300;    // lens; bigger = narrower field of view
const CAM_H    = 30;     // camera height above the road
const CAM_DIST = 115;    // how far the camera trails the kart
const MAX_Z    = 2600;   // beyond this the ground is just haze

const ROAD_HALF   = 46;  // half the driveable width, world units
const RUMBLE_HALF = 56;  // rumble strip ends here
const SHOULDER    = 78;  // graded shoulder ends here; past it is scenery
const CUT_HALF    = 30;  // a shortcut is narrower, and that is the risk

const TWO_PI = Math.PI * 2;
const DEG    = Math.PI / 180;

/* ---------------------------------------------------------
   2. PALETTE
   The site's warm pastel arcade set. No neon, no flat defaults.
   --------------------------------------------------------- */
const P = {
  coral:"#ff7f8a", rose:"#ff5f95", plum:"#9b5de5", sky:"#7ec8e3",
  mint:"#7ddba3",  butter:"#ffe07a", cream:"#fff8e8", peach:"#ffc4a3",
  sand:"#e8d4b0",  gold:"#ffd166",  teal:"#5ab8a6",  denim:"#4a7fb5",
};

/* colour helpers — everything shaded is derived, so a palette change
   carries through the whole sprite set instead of half of it */
function hexToRgb(h) {
  h = h.replace("#", "");
  if (h.length === 3) h = h[0]+h[0]+h[1]+h[1]+h[2]+h[2];
  const v = parseInt(h, 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}
function shade(hex, f) {
  const [r, g, b] = hexToRgb(hex);
  const c = (x) => Math.max(0, Math.min(255, Math.round(x * f)));
  return `rgb(${c(r)},${c(g)},${c(b)})`;
}
function mixRgb(a, b, t) {
  const A = hexToRgb(a), B = hexToRgb(b);
  return [
    Math.round(A[0] + (B[0] - A[0]) * t),
    Math.round(A[1] + (B[1] - A[1]) * t),
    Math.round(A[2] + (B[2] - A[2]) * t),
  ];
}
function mix(a, b, t) {
  const c = mixRgb(a, b, t);
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}
/* the render buffer is a Uint32 view, so colours are packed ABGR */
function pack(hex) {
  const [r, g, b] = hexToRgb(hex);
  return (255 << 24) | (b << 16) | (g << 8) | r;
}
function packRgb(c) { return (255 << 24) | (c[2] << 16) | (c[1] << 8) | c[0]; }

/* ---------------------------------------------------------
   3. THE TRACKS

   Four courses, each a closed loop of control points in 0..1 space that
   gets smoothed into a spline. They are deliberately twisty: a plain
   oval in this bounding box would be over in fifteen seconds.
   --------------------------------------------------------- */
const TRACKS = [
  {
    id:"woods", name:"Cabin Woods", laps:3,
    blurb:"Out past the pines, over the log bridge, and round the little cabin where it all began.",
    grass:"#4f8f52", grassAlt:"#478248", shoulder:"#8a6b45",
    road:"#8f7a5e", roadAlt:"#877257", rumbleA:"#ff7f8a", rumbleB:"#fff8e8",
    sky:["#8fd0ea","#c9ecd8"], haze:"#bfe0d2", accent:"#7ddba3",
    light:-0.7,                       // sun bearing, for every cast shadow
    scenery:["pine","pine","pine","bush","rock","cabin","shed","signpost","flowerbox"],
    /* opening straight, sweep, forest esses, cabin detour, river wiggle,
       and a run home down the right-hand side */
    pts:[[0.54,0.93],[0.42,0.94],[0.30,0.93],
         [0.19,0.89],[0.11,0.81],[0.08,0.71],
         [0.14,0.63],[0.24,0.60],[0.30,0.53],[0.24,0.46],[0.13,0.44],
         [0.07,0.36],[0.08,0.26],[0.14,0.18],
         [0.24,0.12],[0.35,0.11],
         [0.42,0.17],[0.47,0.25],[0.55,0.28],[0.62,0.22],
         [0.68,0.14],[0.78,0.11],[0.87,0.16],
         [0.92,0.25],[0.90,0.35],[0.83,0.41],[0.86,0.50],[0.93,0.57],
         [0.92,0.68],[0.87,0.78],[0.79,0.86],[0.68,0.92]],
    /* the log bridge: straight over the top, skipping the cabin loop */
    cut:{ name:"log bridge", pts:[[0.37,0.12],[0.47,0.075],[0.58,0.07],[0.68,0.115]] },
  },
  {
    id:"town", name:"Hometown Streets", laps:3,
    blurb:"Corner stores, porch lights, the sprinklers that never got the memo, and the alley you always cut through.",
    grass:"#6fae5c", grassAlt:"#64a153", shoulder:"#b9a684",
    road:"#8e8e96", roadAlt:"#87878f", rumbleA:"#ffc4a3", rumbleB:"#fff8e8",
    sky:["#8fd0ea","#ffe6bd"], haze:"#e2d3b6", accent:"#ffc4a3",
    light:-0.5,
    scenery:["house","house","lamp","tree","postbox","bush","store","hydrant","flowerbox"],
    pts:[[0.55,0.93],[0.40,0.94],[0.26,0.92],
         [0.15,0.87],[0.09,0.78],[0.10,0.67],
         [0.18,0.60],[0.29,0.58],[0.35,0.50],
         [0.29,0.42],[0.17,0.40],[0.09,0.32],
         [0.11,0.21],[0.20,0.14],[0.32,0.11],
         [0.44,0.14],[0.50,0.22],[0.58,0.26],[0.66,0.21],
         [0.71,0.13],[0.82,0.12],[0.90,0.19],
         [0.92,0.30],[0.85,0.37],[0.79,0.45],
         [0.85,0.53],[0.93,0.61],[0.92,0.72],
         [0.86,0.81],[0.76,0.88],[0.66,0.92]],
    cut:{ name:"the back alley", pts:[[0.335,0.495],[0.42,0.44],[0.52,0.42],[0.60,0.45],[0.655,0.475]] },
  },
  {
    id:"ward", name:"Hospital Dash", laps:3,
    blurb:"Sunlit halls, a slalom of IV poles, and the gift-cart run everybody pretends not to take.",
    grass:"#b9c8de", grassAlt:"#adbdd6", shoulder:"#93a8c6",
    road:"#e9edf5", roadAlt:"#dde4ef", rumbleA:"#7ec8e3", rumbleB:"#fff8e8",
    sky:["#cfe4f4","#eef5fb"], haze:"#d6e6f2", accent:"#7ec8e3",
    light:-1.1,
    scenery:["pole","pole","plant","cart","chair","vending","plant","sign","bench"],
    pts:[[0.52,0.93],[0.38,0.94],[0.25,0.91],
         [0.14,0.85],[0.09,0.75],[0.12,0.65],
         [0.21,0.59],[0.32,0.61],[0.38,0.54],
         [0.33,0.46],[0.22,0.45],[0.13,0.38],
         [0.10,0.27],[0.18,0.17],[0.30,0.12],
         [0.41,0.15],[0.46,0.24],[0.54,0.29],[0.63,0.25],
         [0.69,0.16],[0.80,0.13],[0.89,0.20],
         [0.91,0.31],[0.84,0.39],[0.80,0.48],
         [0.87,0.56],[0.92,0.65],[0.88,0.76],
         [0.79,0.85],[0.66,0.91]],
    cut:{ name:"the gift-cart run", pts:[[0.383,0.535],[0.47,0.50],[0.56,0.49],[0.63,0.52],[0.665,0.555]] },
  },
  {
    id:"roof", name:"Rooftop Sunset", laps:3,
    blurb:"String lights, laundry lines, a plank across the gap, and every cat in the city out to watch the finish.",
    grass:"#4a3a63", grassAlt:"#433457", shoulder:"#6d5a49",
    road:"#8a7a68", roadAlt:"#82735f", rumbleA:"#ffd166", rumbleB:"#ff7f8a",
    sky:["#ff8a5c","#ffd08a"], haze:"#ffb583", accent:"#ffd166",
    light:-2.2,                       // low sun, long shadows the other way
    scenery:["lamp","cat","laundry","vent","cat","watertank","aircon","stringpole","planter"],
    pts:[[0.53,0.93],[0.40,0.93],[0.27,0.90],
         [0.16,0.84],[0.10,0.74],[0.13,0.63],
         [0.23,0.57],[0.33,0.59],[0.39,0.51],
         [0.32,0.44],[0.20,0.42],[0.12,0.34],
         [0.13,0.23],[0.22,0.15],[0.34,0.12],
         [0.43,0.16],[0.48,0.25],[0.57,0.27],[0.64,0.20],
         [0.70,0.12],[0.81,0.12],[0.90,0.21],
         [0.90,0.32],[0.83,0.40],[0.81,0.49],
         [0.88,0.58],[0.92,0.68],[0.86,0.79],
         [0.76,0.87],[0.65,0.92]],
    cut:{ name:"the plank", pts:[[0.392,0.505],[0.48,0.46],[0.57,0.45],[0.66,0.48],[0.72,0.51]] },
  },
];

/* ---------------------------------------------------------
   4. THE ROSTER

   Two playable, six opponents. Every one of them is a palette plus a
   head type — the kart underneath is the same box, so they read as one
   grid rather than six unrelated doodles.

   Ouissy's racing fit: a cream varsity jacket with coral sleeves and
   goggles pushed up on her hair. Of the three I sketched (pastel race
   suit, varsity, bomber) the varsity is the one that keeps her
   silhouette soft and still says "racer" at 20 pixels tall.
   Anwar gets the matching bomber in teal so the two never blur together.
   --------------------------------------------------------- */
const CHARS = [
  { id:"ouissy", name:"Ouissy", head:"ouissy",
    kart:"#ff7f8a", trim:"#fff1e0", accent:"#ff5f95",
    skin:"#f6dcc2", hair:"#8a6440", jacket:"#fff1e0", sleeve:"#ff7f8a",
    fit:"Varsity jacket + goggles" },
  { id:"anwar", name:"Anwar", head:"anwar",
    kart:"#5ab8a6", trim:"#eaf6f2", accent:"#4a7fb5",
    skin:"#d9ab7d", hair:"#2b1c12", jacket:"#5ab8a6", sleeve:"#3f8f80",
    fit:"Bomber jacket + goggles" },

  { id:"whiskers", name:"Whiskers", head:"cat",
    kart:"#e8a060", trim:"#fff0d8", accent:"#c97b3d",
    skin:"#e8a060", hair:"#c97b3d", jacket:"#fff0d8", sleeve:"#e8a060" },
  { id:"reaper", name:"Reaper", head:"reaper",
    kart:"#8f7bc4", trim:"#e6dcff", accent:"#6a5a8a",
    skin:"#d8cfe8", hair:"#4a3a6a", jacket:"#6a5a8a", sleeve:"#4a3a6a" },
  { id:"blossom", name:"Blossom", head:"flower",
    kart:"#f2a3bb", trim:"#ffe6ee", accent:"#d97a95",
    skin:"#ffe6ee", hair:"#e8778f", jacket:"#ffe6ee", sleeve:"#f2a3bb" },
  { id:"sparky", name:"Sparky", head:"star",
    kart:"#ffd166", trim:"#fff6cf", accent:"#e0a83a",
    skin:"#ffe9a8", hair:"#e0a83a", jacket:"#fff6cf", sleeve:"#ffd166" },
  { id:"frosty", name:"Frosty", head:"ice",
    kart:"#8fd4e8", trim:"#e8f8ff", accent:"#5aa8c4",
    skin:"#e8f8ff", hair:"#5aa8c4", jacket:"#e8f8ff", sleeve:"#8fd4e8" },
  { id:"coco", name:"Coco", head:"bear",
    kart:"#c08a63", trim:"#f2ddc4", accent:"#8f6242",
    skin:"#c08a63", hair:"#8f6242", jacket:"#f2ddc4", sleeve:"#c08a63" },
];

/* ---------------------------------------------------------
   5. ITEMS — the Mario Kart formula, reflavoured
   --------------------------------------------------------- */
const ITEMS = {
  letter:  { name:"Love Letter",  weight:26, tint:"#fff8e8" },
  arrow:   { name:"Cupid's Arrow",weight:18, tint:"#ff5f95" },
  heart:   { name:"Paper Heart",  weight:18, tint:"#ff7f8a" },
  rose:    { name:"Rose Thorns",  weight:16, tint:"#e8556f" },
  bouquet: { name:"Bouquet",      weight:12, tint:"#ff9ec4" },
  ring:    { name:"Anniversary Ring", weight:6, tint:"#ffd166" },
};
const ITEM_KEYS = Object.keys(ITEMS);

/* items are luck-of-the-draw, but the tail of the field gets the good
   stuff — same as the original, and it is what keeps a race close */
function rollItem(place, total) {
  const back = total > 1 ? (place - 1) / (total - 1) : 0;
  const w = ITEM_KEYS.map((k) => {
    let x = ITEMS[k].weight;
    if (k === "ring")    x *= 0.15 + back * 2.4;
    if (k === "bouquet") x *= 0.4 + back * 1.6;
    if (k === "arrow")   x *= 0.5 + back * 1.4;
    if (k === "letter")  x *= 1.4 - back * 0.5;
    return x;
  });
  let t = w.reduce((a, b) => a + b, 0) * Math.random();
  for (let i = 0; i < w.length; i++) { t -= w[i]; if (t <= 0) return ITEM_KEYS[i]; }
  return "letter";
}

/* =========================================================
   6. TRACK GEOMETRY
   ========================================================= */
let path = [];      // {x,y} in world units, closed loop
let segLen = [];    // length of each segment
let cumLen = [];    // distance from start to each node
let pathLen = 0;

/* the shortcut, when a track has one: an open spline that leaves the
   main loop and rejoins it further round */
let cut = null;     // { pts, from, to }  — from/to are along-values 0..1

function catmull(raw, closed) {
  const n = raw.length, out = [];
  const at = (i) => raw[closed ? (i + n) % n : Math.max(0, Math.min(n - 1, i))];
  const last = closed ? n : n - 1;
  for (let i = 0; i < last; i++) {
    const p0 = at(i - 1), p1 = at(i), p2 = at(i + 1), p3 = at(i + 2);
    for (let t = 0; t < 1; t += 1 / 14) {
      const t2 = t * t, t3 = t2 * t;
      out.push({
        x: 0.5 * (2*p1.x + (-p0.x+p2.x)*t + (2*p0.x-5*p1.x+4*p2.x-p3.x)*t2 + (-p0.x+3*p1.x-3*p2.x+p3.x)*t3),
        y: 0.5 * (2*p1.y + (-p0.y+p2.y)*t + (2*p0.y-5*p1.y+4*p2.y-p3.y)*t2 + (-p0.y+3*p1.y-3*p2.y+p3.y)*t3),
      });
    }
  }
  if (!closed) out.push({ x: raw[n - 1].x, y: raw[n - 1].y });
  return out;
}

function buildPath(def) {
  path = catmull(def.pts.map((p) => ({ x: p[0] * WORLD, y: p[1] * WORLD })), true);
  segLen = []; cumLen = []; pathLen = 0;
  for (let i = 0; i < path.length; i++) {
    cumLen.push(pathLen);
    const j = (i + 1) % path.length;
    const d = Math.hypot(path[j].x - path[i].x, path[j].y - path[i].y);
    segLen.push(d);
    pathLen += d;
  }

  cut = null;
  if (def.cut) {
    const pts = catmull(def.cut.pts.map((p) => ({ x: p[0] * WORLD, y: p[1] * WORLD })), false);
    /* where it leaves and where it rejoins, in main-loop along-values.
       These have to be found against the finished main path, which is
       why the shortcut is built second. */
    const a = projectMain(pts[0].x, pts[0].y);
    const b = projectMain(pts[pts.length - 1].x, pts[pts.length - 1].y);
    const len = [];
    let total = 0;
    for (let i = 0; i < pts.length - 1; i++) {
      len.push(total);
      total += Math.hypot(pts[i+1].x - pts[i].x, pts[i+1].y - pts[i].y);
    }
    len.push(total);
    cut = { pts, from: a.along, to: b.along, cum: len, len: total, name: def.cut.name };
  }
}

function tangentAt(i) {
  const j = (i + 1) % path.length;
  return Math.atan2(path[j].y - path[i].y, path[j].x - path[i].x);
}

/* Nearest point on the main loop. `hint` keeps the search local —
   without it this is the most expensive thing in the frame. */
function projectMain(x, y, hint) {
  const n = path.length;
  let lo = 0, hi = n;
  if (hint != null) { lo = hint - 24; hi = hint + 24; }
  let bd = Infinity, bi = 0, bt = 0;
  for (let k = lo; k < hi; k++) {
    const i = ((k % n) + n) % n, j = (i + 1) % n;
    const ax = path[i].x, ay = path[i].y;
    const dx = path[j].x - ax, dy = path[j].y - ay;
    const l2 = dx*dx + dy*dy;
    let t = l2 > 0 ? ((x-ax)*dx + (y-ay)*dy) / l2 : 0;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const cx = ax + t*dx, cy = ay + t*dy;
    const d = (x-cx)*(x-cx) + (y-cy)*(y-cy);
    if (d < bd) { bd = d; bi = i; bt = t; }
  }
  const ta = tangentAt(bi);
  const nx = -Math.sin(ta), ny = Math.cos(ta);
  const j = (bi + 1) % n;
  const cx = path[bi].x + bt * (path[j].x - path[bi].x);
  const cy = path[bi].y + bt * (path[j].y - path[bi].y);
  return {
    dist: Math.sqrt(bd), idx: bi, t: bt,
    along: (cumLen[bi] + bt * segLen[bi]) / pathLen,
    cx, cy, side: (x - cx) * nx + (y - cy) * ny,
    nx, ny, tan: ta, half: ROAD_HALF, onCut: false,
  };
}

/* Same, against the shortcut. Its along-value is interpolated between
   the two points where it meets the loop, so a kart on it keeps making
   ordinary forward progress and the lap counter never notices. */
function projectCut(x, y) {
  const p = cut.pts, n = p.length;
  let bd = Infinity, bi = 0, bt = 0;
  for (let i = 0; i < n - 1; i++) {
    const ax = p[i].x, ay = p[i].y;
    const dx = p[i+1].x - ax, dy = p[i+1].y - ay;
    const l2 = dx*dx + dy*dy;
    let t = l2 > 0 ? ((x-ax)*dx + (y-ay)*dy) / l2 : 0;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const cx = ax + t*dx, cy = ay + t*dy;
    const d = (x-cx)*(x-cx) + (y-cy)*(y-cy);
    if (d < bd) { bd = d; bi = i; bt = t; }
  }
  const ta = Math.atan2(p[bi+1].y - p[bi].y, p[bi+1].x - p[bi].x);
  const nx = -Math.sin(ta), ny = Math.cos(ta);
  const cx = p[bi].x + bt * (p[bi+1].x - p[bi].x);
  const cy = p[bi].y + bt * (p[bi+1].y - p[bi].y);
  const f = cut.len > 0
    ? (cut.cum[bi] + bt * (cut.cum[bi+1] - cut.cum[bi])) / cut.len : 0;
  /* the shortcut may straddle the start line, so walk forward from
     `from` rather than lerping straight to `to` */
  let span = cut.to - cut.from;
  if (span < 0) span += 1;
  let along = cut.from + span * f;
  if (along >= 1) along -= 1;
  return {
    dist: Math.sqrt(bd), idx: bi, t: bt, along,
    cx, cy, side: (x - cx) * nx + (y - cy) * ny,
    nx, ny, tan: ta, half: CUT_HALF, onCut: true,
  };
}

/* Whichever ribbon you are actually on. Being nearer the shortcut only
   counts while you are close enough to be on it — otherwise a kart out
   in the scenery could claim the shortcut's progress. */
function project(x, y, hint) {
  const m = projectMain(x, y, hint);
  if (!cut) return m;
  if (m.dist < ROAD_HALF) return m;          // plainly on the main road
  const c = projectCut(x, y);
  if (c.dist < m.dist && c.dist < SHOULDER) return c;
  return m;
}

/* =========================================================
   7. BAKING THE WORLD

   Everything the ground is made of is painted once, here, into a big
   canvas. Mode 7 then just reads it. Doing it this way means the road
   can have kerbs, seams, patches and paint without costing a thing at
   sixty frames a second.
   ========================================================= */
let texCvs = null, tex32 = null, bakedId = null;
let voidColor = 0;

function strokeLoop(g, width, style) { strokePts(g, path, width, style, true); }

function strokePts(g, pts, width, style, closed) {
  g.strokeStyle = style;
  g.lineWidth = width;
  g.lineJoin = "round";
  g.lineCap = "round";
  g.beginPath();
  const n = closed ? pts.length + 1 : pts.length;
  for (let i = 0; i < n; i++) {
    const p = pts[i % pts.length];
    if (i === 0) g.moveTo(p.x, p.y); else g.lineTo(p.x, p.y);
  }
  if (closed) g.closePath();
  g.stroke();
}

/* a cheap, chunky noise: thousands of little squares rather than a
   per-pixel loop. Reads as pixel texture and bakes in a few ms. */
function speckle(g, count, size, colors) {
  for (let i = 0; i < count; i++) {
    const x = Math.random() * WORLD, y = Math.random() * WORLD;
    g.fillStyle = colors[(Math.random() * colors.length) | 0];
    const s = size + ((Math.random() * 2) | 0);
    g.fillRect(x | 0, y | 0, s, s);
  }
}

/* Texture for the road and its shoulder has to be laid along the loop,
   not sprayed over the whole sheet. Scattering it globally is what put
   tarmac-coloured grit all over the grass. */
function speckleAlong(g, count, size, colors, minOff, maxOff) {
  const n = path.length;
  for (let i = 0; i < count; i++) {
    const k = (Math.random() * n) | 0;
    const ta = tangentAt(k);
    const off = (minOff + Math.random() * (maxOff - minOff)) * (Math.random() < 0.5 ? -1 : 1);
    const jit = (Math.random() - 0.5) * 14;
    const x = path[k].x - Math.sin(ta) * off + Math.cos(ta) * jit;
    const y = path[k].y + Math.cos(ta) * off + Math.sin(ta) * jit;
    g.fillStyle = colors[(Math.random() * colors.length) | 0];
    const s = size + ((Math.random() * 2) | 0);
    g.fillRect(x | 0, y | 0, s, s);
  }
}

function bakeTrack(def) {
  if (bakedId === def.id && tex32) return;
  if (!texCvs) { texCvs = document.createElement("canvas"); texCvs.width = texCvs.height = TEX; }
  const g = texCvs.getContext("2d", { willReadFrequently: true });

  /* Everything below is drawn in WORLD units. One transform here means
     every width, offset and radius in this function is the same number
     the physics uses, instead of each one needing a conversion. */
  g.setTransform(1 / TSCALE, 0, 0, 1 / TSCALE, 0, 0);

  /* --- the ground everything else sits on --- */
  g.fillStyle = def.grass;
  g.fillRect(0, 0, WORLD, WORLD);
  speckle(g, 14000, 3, [def.grassAlt, shade(def.grass, 1.08), shade(def.grass, 0.92)]);

  /* a few broad patches so the field is not one flat colour */
  for (let i = 0; i < 60; i++) {
    g.globalAlpha = 0.10 + Math.random() * 0.10;
    g.fillStyle = i % 2 ? shade(def.grass, 1.14) : shade(def.grass, 0.86);
    const r = 60 + Math.random() * 190;
    g.beginPath();
    g.ellipse(Math.random()*WORLD, Math.random()*WORLD, r, r*(0.6+Math.random()*0.6), Math.random()*Math.PI, 0, TWO_PI);
    g.fill();
  }
  g.globalAlpha = 1;

  /* --- the shortcut, first, so the main ribbon paints over its ends --- */
  if (cut) {
    strokePts(g, cut.pts, CUT_HALF * 2 + 26, "rgba(0,0,0,.14)", false);
    strokePts(g, cut.pts, CUT_HALF * 2 + 14, def.shoulder, false);
    strokePts(g, cut.pts, CUT_HALF * 2, shade(def.road, 0.94), false);
    /* boards across it, so it reads as a plank run rather than tarmac */
    g.save();
    g.globalAlpha = 0.45;
    g.strokeStyle = shade(def.road, 0.78);
    g.lineWidth = 2.5;
    for (let i = 0; i < cut.pts.length - 1; i += 2) {
      const a = cut.pts[i], b = cut.pts[i+1];
      const ta = Math.atan2(b.y - a.y, b.x - a.x);
      const nx = -Math.sin(ta) * CUT_HALF, ny = Math.cos(ta) * CUT_HALF;
      g.beginPath(); g.moveTo(a.x - nx, a.y - ny); g.lineTo(a.x + nx, a.y + ny); g.stroke();
    }
    g.restore();
    /* a chevron at the mouth, so you can see it coming */
    const m = cut.pts[1], mt = Math.atan2(cut.pts[2].y - m.y, cut.pts[2].x - m.x);
    g.save();
    g.translate(m.x, m.y); g.rotate(mt);
    g.fillStyle = "rgba(255,248,232,.55)";
    for (let k = 0; k < 3; k++) {
      g.beginPath();
      g.moveTo(k * 16, -CUT_HALF * 0.55);
      g.lineTo(k * 16 + 9, 0);
      g.lineTo(k * 16, CUT_HALF * 0.55);
      g.lineTo(k * 16 - 4, 0);
      g.fill();
    }
    g.restore();
  }

  /* --- shoulder, rumble, road: three strokes, widest first --- */
  g.strokeStyle = "rgba(0,0,0,.18)";
  strokeLoop(g, SHOULDER * 2 + 10, "rgba(0,0,0,.16)");   // soft ground shadow
  strokeLoop(g, SHOULDER * 2, def.shoulder);
  speckleAlong(g, 3200, 3, [shade(def.shoulder, 1.12), shade(def.shoulder, 0.88)],
               RUMBLE_HALF, SHOULDER - 3);

  /* the rumble strip is drawn as alternating short segments, which is
     how it gets its stripes without a repeating-pattern fill */
  g.lineCap = "butt";
  g.lineWidth = RUMBLE_HALF * 2;
  for (let i = 0; i < path.length; i++) {
    const a = path[i], b = path[(i + 1) % path.length];
    g.strokeStyle = (i >> 1) % 2 ? def.rumbleA : def.rumbleB;
    g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke();
  }

  strokeLoop(g, ROAD_HALF * 2, def.road);
  speckleAlong(g, 4200, 2, [def.roadAlt, shade(def.road, 1.07), shade(def.road, 0.93)],
               0, ROAD_HALF - 3);

  /* road wear: seams across, patches along, a darker racing line */
  g.save();
  g.globalAlpha = 0.5;
  for (let i = 0; i < path.length; i += 3) {
    const a = path[i], ta = tangentAt(i);
    const nx = -Math.sin(ta) * ROAD_HALF, ny = Math.cos(ta) * ROAD_HALF;
    g.strokeStyle = def.roadAlt; g.lineWidth = 2;
    g.beginPath(); g.moveTo(a.x - nx, a.y - ny); g.lineTo(a.x + nx, a.y + ny); g.stroke();
  }
  g.restore();
  g.globalAlpha = 0.08;
  strokeLoop(g, ROAD_HALF * 0.85, "#000");
  g.globalAlpha = 1;

  /* dashed centre line */
  g.setLineDash([26, 30]);
  strokeLoop(g, 4, "rgba(255,255,255,.5)");
  g.setLineDash([]);

  /* white edge lines just inside the rumble */
  for (const s of [-1, 1]) {
    g.strokeStyle = "rgba(255,255,255,.42)";
    g.lineWidth = 3;
    g.beginPath();
    for (let i = 0; i <= path.length; i++) {
      const idx = i % path.length;
      const p = path[idx], ta = tangentAt(idx);
      const nx = -Math.sin(ta) * (ROAD_HALF - 5) * s;
      const ny =  Math.cos(ta) * (ROAD_HALF - 5) * s;
      if (i === 0) g.moveTo(p.x + nx, p.y + ny); else g.lineTo(p.x + nx, p.y + ny);
    }
    g.closePath(); g.stroke();
  }

  /* --- start / finish, in checkers --- */
  const s0 = path[0], a0 = tangentAt(0);
  g.save();
  g.translate(s0.x, s0.y);
  g.rotate(a0);
  const cols = 10, rows = 3, cwid = (ROAD_HALF * 2) / cols, chei = 9;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      g.fillStyle = (r + c) % 2 ? "#26202a" : "#fff8e8";
      g.fillRect(-chei * rows / 2 + r * chei, -ROAD_HALF + c * cwid, chei, cwid);
    }
  }
  g.restore();

  bakeGroundShadows(g, def);

  g.setTransform(1, 0, 0, 1, 0, 0);
  const img = g.getImageData(0, 0, TEX, TEX);
  tex32 = new Uint32Array(img.data.buffer);
  /* Past the edge of the baked world there is nothing to sample. Filling
     it with flat grass leaves a hard band; pulling it towards the haze
     colour lets it pass for ground too far off to make out. */
  voidColor = packRgb(mixRgb(def.grass, def.haze, 0.3));
  bakedId = def.id;
}

/* Every track has one sun bearing, and everything that stands up drops
   a shadow along it — baked into the ground rather than drawn per frame,
   because these never move. This is most of what stops the scenery
   looking like stickers pasted onto a lawn. */
function bakeGroundShadows(g, def) {
  const a = def.light != null ? def.light : -0.7;
  const dx = Math.cos(a), dy = Math.sin(a);
  g.save();
  g.globalAlpha = 0.20;
  g.fillStyle = "#101018";
  for (const pr of props) {
    const spec = SCENERY[pr.kind];
    if (!spec) continue;
    const h = spec.h * pr.hv;
    const len = h * 0.62, wid = h * spec.foot * 0.42;
    g.save();
    g.translate(pr.x, pr.y);
    g.rotate(a);
    g.beginPath();
    g.ellipse(len * 0.45, 0, len * 0.55, wid, 0, 0, TWO_PI);
    g.fill();
    g.restore();
  }
  g.restore();
}

/* =========================================================
   8. THE SKY BAND

   Above the horizon there is no geometry, just a wide painted strip
   that slides sideways with the camera. Two copies are blitted so it
   wraps without a seam.
   ========================================================= */
let panoCvs = null, panoFar = null, panoMid = null, panoId = null;
const PANO_W = 1600, PANO_H = 150, PANO_MID = 46;

function bakePano(def) {
  if (panoId === def.id && panoCvs) return;
  const mk = (h) => { const c = document.createElement("canvas"); c.width = PANO_W; c.height = h; return c; };
  if (!panoCvs) { panoCvs = mk(PANO_H); panoFar = mk(PANO_H); panoMid = mk(PANO_MID); }
  const g = panoCvs.getContext("2d");
  g.clearRect(0, 0, PANO_W, PANO_H);
  const gf = panoFar.getContext("2d"); gf.clearRect(0, 0, PANO_W, PANO_H);
  const gm = panoMid.getContext("2d"); gm.clearRect(0, 0, PANO_W, PANO_MID);

  const sky = g.createLinearGradient(0, 0, 0, PANO_H);
  sky.addColorStop(0, def.sky[0]);
  sky.addColorStop(1, def.sky[1]);
  g.fillStyle = sky;
  g.fillRect(0, 0, PANO_W, PANO_H);

  const rnd = mulberry(def.id.length * 977 + 13);

  if (def.id === "roof") {
    /* a sunset, a low sun, and a city that goes on past the edge */
    g.fillStyle = "rgba(255,236,180,.85)";
    g.beginPath(); g.arc(PANO_W * 0.32, PANO_H - 34, 30, 0, TWO_PI); g.fill();
    g.fillStyle = "rgba(255,170,110,.35)";
    g.beginPath(); g.arc(PANO_W * 0.32, PANO_H - 34, 52, 0, TWO_PI); g.fill();
    for (let layer = 0; layer < 2; layer++) {
      const base = PANO_H - 6 - layer * 4;
      g.fillStyle = layer ? "#3a2b4e" : "#26203a";
      let x = -20;
      while (x < PANO_W + 20) {
        const w = 22 + rnd() * 40, h = 26 + rnd() * (layer ? 46 : 74);
        g.fillRect(x, base - h, w, h);
        if (!layer) {
          g.fillStyle = "rgba(255,206,122,.6)";
          for (let wy = base - h + 6; wy < base - 6; wy += 9)
            for (let wx = x + 4; wx < x + w - 5; wx += 8)
              if (rnd() > 0.45) g.fillRect(wx, wy, 3, 4);
          g.fillStyle = "#26203a";
        }
        x += w + 3 + rnd() * 8;
      }
    }
  } else if (def.id === "ward") {
    /* a sunlit window wall at the end of the corridor: the mullions are
       what stop it reading as a blank white field */
    g.fillStyle = "#dae4f0";
    g.fillRect(0, PANO_H - 66, PANO_W, 66);
    for (let x = 0; x < PANO_W; x += 46) {
      g.fillStyle = "#f6fbff";
      g.fillRect(x + 3, PANO_H - 62, 38, 54);
      g.fillStyle = "rgba(126,200,227,.55)";
      g.fillRect(x + 6, PANO_H - 59, 32, 30);
      g.fillStyle = "#9db0ca";
      g.fillRect(x, PANO_H - 66, 3, 62);
    }
    g.fillStyle = "#9db0ca";
    g.fillRect(0, PANO_H - 10, PANO_W, 4);
    g.fillStyle = "#8698b2";
    g.fillRect(0, PANO_H - 6, PANO_W, 6);
  } else if (def.id === "town") {
    /* a low skyline of roofs, and a water tower */
    g.fillStyle = "rgba(255,255,255,.55)";
    for (let i = 0; i < 14; i++) {
      const x = rnd() * PANO_W, y = 18 + rnd() * 40, r = 12 + rnd() * 18;
      g.beginPath();
      g.arc(x, y, r, 0, TWO_PI); g.arc(x + r, y + 3, r * 0.8, 0, TWO_PI);
      g.arc(x - r, y + 4, r * 0.7, 0, TWO_PI);
      g.fill();
    }
    let x = -10;
    while (x < PANO_W + 10) {
      const w = 34 + rnd() * 34, h = 22 + rnd() * 34;
      g.fillStyle = rnd() > 0.5 ? "#8a6f5c" : "#6f7f66";
      g.fillRect(x, PANO_H - 6 - h, w, h);
      g.fillStyle = "#5c4a3d";
      g.beginPath();
      g.moveTo(x - 4, PANO_H - 6 - h);
      g.lineTo(x + w / 2, PANO_H - 6 - h - 14);
      g.lineTo(x + w + 4, PANO_H - 6 - h);
      g.fill();
      x += w + 6 + rnd() * 10;
    }
  } else {
    /* woods: clouds and a ridge of far pines */
    g.fillStyle = "rgba(255,255,255,.6)";
    for (let i = 0; i < 16; i++) {
      const x = rnd() * PANO_W, y = 14 + rnd() * 36, r = 10 + rnd() * 16;
      g.beginPath();
      g.arc(x, y, r, 0, TWO_PI); g.arc(x + r, y + 2, r * 0.75, 0, TWO_PI);
      g.arc(x - r * 0.9, y + 3, r * 0.65, 0, TWO_PI);
      g.fill();
    }
    for (let layer = 0; layer < 2; layer++) {
      g.fillStyle = layer ? "#3f7a4c" : "#2f5f3c";
      const base = PANO_H - 4 - layer * 6;
      for (let x = -10; x < PANO_W + 10; x += 13 + rnd() * 10) {
        const h = (layer ? 26 : 42) + rnd() * 26;
        g.beginPath();
        g.moveTo(x, base); g.lineTo(x + 9, base - h); g.lineTo(x + 18, base);
        g.fill();
      }
    }
  }
  buildParallax(def, gf, gm);
  panoId = def.id;
}

/* the two extra depths: a pale ridge behind everything, and a band of
   nearer silhouettes that sits just above the horizon line */
function buildParallax(def, gf, gm) {
  const rnd = mulberry(def.id.length * 613 + 41);
  const far = mixRgb(def.haze, def.sky[0], 0.35);
  gf.fillStyle = `rgba(${far[0]},${far[1]},${far[2]},.55)`;

  if (def.id === "roof" || def.id === "town") {
    /* a further, paler skyline */
    let x = -20;
    while (x < PANO_W + 20) {
      const w = 30 + rnd() * 60, h = 20 + rnd() * 50;
      gf.fillRect(x, PANO_H - 6 - h, w, h);
      x += w + 8 + rnd() * 16;
    }
  } else if (def.id === "ward") {
    gf.fillRect(0, PANO_H - 40, PANO_W, 40);
  } else {
    /* rolling hills */
    for (let k = 0; k < 3; k++) {
      gf.beginPath();
      gf.moveTo(-10, PANO_H);
      for (let x = -10; x < PANO_W + 20; x += 40)
        gf.lineTo(x, PANO_H - 18 - Math.sin(x * 0.004 + k) * 14 - rnd() * 8);
      gf.lineTo(PANO_W + 20, PANO_H); gf.closePath(); gf.fill();
    }
  }

  /* the near band: whatever this track has lining its edges, in
     silhouette, so the middle distance is not empty */
  const midCol = mixRgb(def.grass, "#101018", 0.42);
  gm.fillStyle = `rgb(${midCol[0]},${midCol[1]},${midCol[2]})`;
  const kinds = def.scenery;
  for (let x = -20; x < PANO_W + 20; ) {
    const k = kinds[(rnd() * kinds.length) | 0];
    const tall = /pine|tree|lamp|pole|watertank|stringpole|laundry|signpost/.test(k);
    const w = tall ? 8 + rnd() * 10 : 16 + rnd() * 26;
    const h = tall ? 22 + rnd() * 18 : 10 + rnd() * 14;
    if (tall) {
      gm.beginPath();
      gm.moveTo(x, PANO_MID); gm.lineTo(x + w / 2, PANO_MID - h); gm.lineTo(x + w, PANO_MID);
      gm.closePath(); gm.fill();
    } else {
      gm.fillRect(x, PANO_MID - h, w, h);
      gm.beginPath();
      gm.moveTo(x - 2, PANO_MID - h); gm.lineTo(x + w / 2, PANO_MID - h - 7);
      gm.lineTo(x + w + 2, PANO_MID - h); gm.closePath(); gm.fill();
    }
    x += w + 10 + rnd() * 34;
  }
}

/* small deterministic RNG so a track looks the same every time it loads */
function mulberry(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* =========================================================
   9. SPRITES

   Karts are built as a little extruded box: the chassis quad is
   projected for the angle we want, drawn once as a top face and once
   below it, and the gap between is filled in as the sides. That is what
   gives them volume from every direction instead of the flat lozenge
   you get from drawing an ellipse and rotating it.

   Sixteen angles per character, baked once at start-up.
   --------------------------------------------------------- */
const ANGLES = 16;
const SPR_W = 64, SPR_H = 56;
const FLAT = 0.34;          // how hard the ground plane foreshortens
const kartSprites = {};     // id -> [canvas x16]

function proj2(x, y, a) {
  return {
    x:  x * Math.cos(a) + y * Math.sin(a),
    y: (-x * Math.sin(a) + y * Math.cos(a)) * FLAT,
  };
}

function quad(g, pts, fill) {
  g.fillStyle = fill;
  g.beginPath();
  g.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) g.lineTo(pts[i].x, pts[i].y);
  g.closePath();
  g.fill();
}

function buildKart(def, ai) {
  const a = (ai / ANGLES) * TWO_PI;
  const c = document.createElement("canvas");
  c.width = SPR_W; c.height = SPR_H;
  const g = c.getContext("2d");
  g.imageSmoothingEnabled = false;
  g.translate(SPR_W / 2, SPR_H - 16);

  const facing = Math.cos(a);        // >0 we see its back, <0 it faces us
  const bodyH  = 9;                  // how tall the chassis box stands

  /* --- wheels, far pair first --- */
  const wheels = [
    { x:-12, y: 14 }, { x: 12, y: 14 },   // front
    { x:-12, y:-14 }, { x: 12, y:-14 },   // rear
  ].map((w) => { const p = proj2(w.x, w.y, a); p.src = w; return p; })
   .sort((u, v) => u.y - v.y);

  const drawWheel = (p) => {
    const near = 1 + p.y * 0.02;
    const ww = Math.round(7 * near), wh = Math.round(10 * near);
    g.fillStyle = "#241c22";
    g.fillRect(Math.round(p.x - ww / 2), Math.round(p.y - wh + 2), ww, wh);
    /* a lit top edge and a hub, not a white band — a band across the
       back of a tyre reads as a brake light */
    g.fillStyle = "#3a2f38";
    g.fillRect(Math.round(p.x - ww / 2), Math.round(p.y - wh + 2), ww, 2);
    g.fillStyle = shade(def.kart, 0.8);
    g.fillRect(Math.round(p.x - 1), Math.round(p.y - wh / 2 - 1), 2, 2);
  };

  wheels.slice(0, 2).forEach(drawWheel);

  /* --- chassis, as a box --- */
  const corners = [{x:-13,y:-17},{x:13,y:-17},{x:13,y:17},{x:-13,y:17}].map((p) => proj2(p.x, p.y, a));
  const top = corners.map((p) => ({ x: p.x, y: p.y - bodyH }));

  /* side walls: every edge whose bottom sits in front of its top */
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    quad(g, [corners[i], corners[j], top[j], top[i]], shade(def.kart, 0.66));
  }
  quad(g, top, def.kart);

  /* a lighter panel down the middle, and the trim band */
  const midA = proj2(-6, -17, a), midB = proj2(6, -17, a);
  const midC = proj2(6, 17, a),   midD = proj2(-6, 17, a);
  quad(g, [midA, midB, midC, midD].map((p) => ({ x: p.x, y: p.y - bodyH })), shade(def.kart, 1.16));

  const trimA = proj2(-13, 2, a), trimB = proj2(13, 2, a);
  const trimC = proj2(13, 6, a),  trimD = proj2(-13, 6, a);
  quad(g, [trimA, trimB, trimC, trimD].map((p) => ({ x: p.x, y: p.y - bodyH })), def.trim);

  /* rear spoiler when we can see the back of it, nose when we cannot */
  if (facing > 0.15) {
    const sA = proj2(-11, -18, a), sB = proj2(11, -18, a);
    quad(g, [
      { x: sA.x, y: sA.y - bodyH - 7 }, { x: sB.x, y: sB.y - bodyH - 7 },
      { x: sB.x, y: sB.y - bodyH - 2 }, { x: sA.x, y: sA.y - bodyH - 2 },
    ], def.accent);
  } else if (facing < -0.15) {
    const nA = proj2(-10, 18, a), nB = proj2(10, 18, a);
    quad(g, [
      { x: nA.x, y: nA.y - bodyH + 1 }, { x: nB.x, y: nB.y - bodyH + 1 },
      { x: nB.x, y: nB.y - bodyH + 5 }, { x: nA.x, y: nA.y - bodyH + 5 },
    ], def.accent);
  }

  wheels.slice(2).forEach(drawWheel);

  /* --- the rider --- */
  const seat = proj2(0, -3, a);
  drawRider(g, def, a, seat.x, seat.y - bodyH - 3);

  return c;
}

function drawRider(g, def, a, cx, cy) {
  const facing = Math.cos(a), side = Math.sin(a);
  const R = (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(Math.round(cx + x), Math.round(cy + y), w, h); };

  /* torso — a jacket, shoulders squared off, sleeves in the accent */
  R(-7, -9, 14, 11, def.jacket);
  R(-7, -9, 14, 2, shade(def.jacket, 1.12));
  const sx = Math.round(side * 2);
  R(-9 + sx, -8, 3, 9, def.sleeve);
  R( 6 + sx, -8, 3, 9, def.sleeve);
  R(-7, -1, 14, 2, def.sleeve);           // waistband

  /* head: an 11px ball, then whatever this character has on top */
  const hy = -20;
  R(-5, hy, 10, 11, def.skin);
  R(-5, hy, 10, 2, shade(def.skin, 1.08));
  R(-5, hy + 9, 10, 2, shade(def.skin, 0.88));

  const h = def.head;
  if (h === "ouissy") {
    /* long, centre-parted, and it hangs behind the shoulders */
    R(-7, hy + 2, 3, 14, def.hair);
    R( 4, hy + 2, 3, 14, def.hair);
    R(-6, hy - 2, 12, 5, def.hair);
    R(-1, hy - 2, 2, 3, shade(def.hair, 0.85));   // the parting
    if (facing > 0) R(-5, hy, 10, 9, def.hair);   // back of the head
  } else if (h === "anwar") {
    /* a rounded cap of curls rather than a crenellated wall — the curls
       are drawn as overlapping 2px blocks on a curve, so the outline
       comes out soft at this size */
    R(-7, hy - 3, 14, 7, def.hair);
    R(-8, hy, 3, 6, def.hair);
    R( 5, hy, 3, 6, def.hair);
    for (let i = 0; i < 7; i++) {
      const t = Math.PI + (i / 6) * Math.PI;
      R(Math.round(Math.cos(t) * 7) - 1, hy - 3 + Math.round(Math.sin(t) * 4) - 1, 3, 3, def.hair);
    }
    if (facing > 0) R(-5, hy, 10, 8, def.hair);
  } else if (h === "cat") {
    R(-6, hy - 5, 4, 5, def.hair);
    R( 2, hy - 5, 4, 5, def.hair);
    R(-5, hy - 1, 3, 3, shade(def.hair, 1.2));
    R( 2, hy - 1, 3, 3, shade(def.hair, 1.2));
  } else if (h === "reaper") {
    R(-7, hy - 4, 14, 12, def.jacket);
    R(-5, hy + 1, 10, 7, "#2a2233");
    R(-7, hy + 6, 14, 4, def.jacket);
    if (facing < 0) { R(-3, hy + 3, 2, 2, "#d9f0ff"); R(1, hy + 3, 2, 2, "#d9f0ff"); }
    return;
  } else if (h === "flower") {
    for (let i = 0; i < 6; i++) {
      const t = (i / 6) * TWO_PI;
      R(Math.round(Math.cos(t) * 7) - 2, hy + 4 + Math.round(Math.sin(t) * 7) - 2, 4, 4, def.hair);
    }
  } else if (h === "star") {
    for (let i = 0; i < 5; i++) {
      const t = (i / 5) * TWO_PI - Math.PI / 2;
      R(Math.round(Math.cos(t) * 8) - 2, hy + 4 + Math.round(Math.sin(t) * 8) - 2, 5, 5, def.hair);
    }
  } else if (h === "ice") {
    R(-6, hy - 4, 12, 4, def.hair);
    R(-2, hy - 8, 4, 5, def.hair);
    R(-6, hy - 6, 3, 3, def.hair);
    R( 3, hy - 6, 3, 3, def.hair);
  } else if (h === "bear") {
    R(-7, hy - 4, 5, 5, def.hair);
    R( 2, hy - 4, 5, 5, def.hair);
    R(-6, hy - 3, 3, 3, shade(def.hair, 1.25));
    R( 3, hy - 3, 3, 3, shade(def.hair, 1.25));
  }

  /* goggles ride on the forehead going away, over the eyes coming at us */
  if (facing < -0.1) {
    R(-6, hy + 2, 12, 4, "#3a3040");
    R(-5, hy + 3, 4, 2, def.accent);
    R( 1, hy + 3, 4, 2, def.accent);
    R(-3, hy + 7, 6, 1, shade(def.skin, 0.7));   // a small content mouth
    if (h === "anwar") {                          // and his glasses over them
      R(-6, hy + 2, 5, 4, "#20181c");
      R( 1, hy + 2, 5, 4, "#20181c");
      R(-1, hy + 3, 2, 1, "#20181c");
    }
  } else {
    R(-6, hy - 1, 12, 3, "#3a3040");
    R(-5, hy, 4, 1, def.accent);
    R( 1, hy, 4, 1, def.accent);
  }
}

function buildAllKarts() {
  CHARS.forEach((def) => {
    const arr = [];
    for (let i = 0; i < ANGLES; i++) arr.push(buildKart(def, i));
    kartSprites[def.id] = arr;
  });
}

/* --- scenery ---

   Everything that stands beside the track. Each piece is painted into a
   sheet and then cropped to what it actually covers, so the world height
   below is the height you see and the shadow matches the footprint.

   The rule for every structure here: never a flat rectangle. A building
   is a foundation, a wall and a roof, each with its own shading, its own
   material pattern, and a lit side and a shaded side agreeing with the
   track's one sun. That plus real window frames is the whole difference
   between "a box with a triangle on top" and something you would believe
   somebody lives in.                                                     */
const SCENERY = {
  pine:{ h:158, foot:.55 }, tree:{ h:130, foot:.6 },  bush:{ h:26, foot:.9 },
  rock:{ h:24,  foot:.9  }, cabin:{ h:132, foot:.9, smoke:true },
  house:{ h:128, foot:.9, smoke:true }, store:{ h:126, foot:.95 },
  shed:{ h:80,  foot:.9, smoke:true },
  lamp:{ h:112, foot:.3  }, postbox:{ h:30, foot:.8 }, hydrant:{ h:26, foot:.8 },
  signpost:{ h:76, foot:.35 }, flowerbox:{ h:22, foot:.95 },
  pole:{ h:104, foot:.35 }, cart:{ h:58, foot:.8 },  chair:{ h:46, foot:.7 },
  plant:{ h:48, foot:.8  }, vending:{ h:80, foot:.85 }, sign:{ h:72, foot:.4 },
  bench:{ h:38, foot:.95 },
  laundry:{ h:108, foot:.3 }, cat:{ h:18, foot:.85 }, vent:{ h:44, foot:.9 },
  watertank:{ h:122, foot:.7 }, aircon:{ h:46, foot:.9 },
  stringpole:{ h:112, foot:.25 }, planter:{ h:32, foot:.95 },
};

function cropToContent(c) {
  const g = c.getContext("2d");
  const d = g.getImageData(0, 0, c.width, c.height).data;
  let minX = c.width, minY = c.height, maxX = -1, maxY = -1;
  for (let y = 0; y < c.height; y++) {
    for (let x = 0; x < c.width; x++) {
      if (d[(y * c.width + x) * 4 + 3] > 8) {
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return c;
  const w = maxX - minX + 1, h = maxY - minY + 1;
  const o = document.createElement("canvas");
  o.width = w; o.height = h;
  o.getContext("2d").drawImage(c, minX, minY, w, h, 0, 0, w, h);
  return o;
}

const sceneryCache = {};

function buildScenery(kind, def) {
  /* the sun sits on one side per track, and the sprites are baked with
     that side lit — so the cache is keyed by which side that is */
  const sunX = def ? Math.cos(def.light != null ? def.light : -0.7) : 0.75;
  const litRight = sunX >= 0;
  const key = kind + (litRight ? "|R" : "|L");
  if (sceneryCache[key]) return sceneryCache[key];

  const W = 96, H = 128;
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const g = c.getContext("2d");
  const mid = W / 2;

  /* ---- shared painters ---- */
  const R = (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
  const LIT = 1.14, DIM = 0.74;          // the two faces of everything

  /* a wall with its lit return, its material pattern, and a shadow
     gathering where it meets the ground */
  function wall(x, y, w, h, col, material) {
    const side = Math.max(4, Math.round(w * 0.16));
    R(x, y, w, h, col);
    // the return face, on whichever side the sun is not
    R(litRight ? x : x + w - side, y, side, h, shade(col, DIM));
    R(litRight ? x + w - side : x, y, side, h, shade(col, LIT));

    if (material === "wood") {
      g.save(); g.globalAlpha = 0.22;
      for (let yy = y + 3; yy < y + h; yy += 5) {
        g.fillStyle = (yy & 1) ? shade(col, 0.82) : shade(col, 1.12);
        g.fillRect(Math.round(x), Math.round(yy), Math.round(w), 1);
      }
      // a few grain streaks running with the boards
      g.globalAlpha = 0.16; g.fillStyle = shade(col, 0.7);
      for (let i = 0; i < 8; i++) {
        const gy = y + 4 + ((i * 37) % Math.max(1, h - 8));
        g.fillRect(Math.round(x + ((i * 23) % Math.max(1, w - 10))), Math.round(gy), 6 + (i % 3) * 3, 1);
      }
      g.restore();
    } else if (material === "brick") {
      g.save(); g.globalAlpha = 0.20; g.fillStyle = shade(col, 0.66);
      for (let yy = y + 4, row = 0; yy < y + h; yy += 5, row++) {
        g.fillRect(Math.round(x), Math.round(yy), Math.round(w), 1);
        for (let xx = x + (row % 2 ? 5 : 0); xx < x + w; xx += 10)
          g.fillRect(Math.round(xx), Math.round(yy - 4), 1, 4);
      }
      g.restore();
    } else if (material === "siding") {
      g.save(); g.globalAlpha = 0.18;
      for (let yy = y + 4; yy < y + h; yy += 6) {
        g.fillStyle = shade(col, 0.72);
        g.fillRect(Math.round(x), Math.round(yy), Math.round(w), 1);
        g.fillStyle = shade(col, 1.18);
        g.fillRect(Math.round(x), Math.round(yy + 1), Math.round(w), 1);
      }
      g.restore();
    } else if (material === "panel") {
      g.save(); g.globalAlpha = 0.16; g.fillStyle = shade(col, 0.7);
      for (let xx = x + 6; xx < x + w - 2; xx += 9) g.fillRect(Math.round(xx), Math.round(y + 2), 1, h - 4);
      g.restore();
    }

    // ambient occlusion where the wall meets the ground
    g.save(); g.globalAlpha = 0.24; g.fillStyle = "#1a1420";
    g.fillRect(Math.round(x), Math.round(y + h - 3), Math.round(w), 3);
    g.restore();
  }

  /* a foundation course, so nothing sits straight on the grass */
  function footing(x, y, w, h, col) {
    R(x - 2, y, w + 4, h, shade(col, 0.8));
    R(x - 2, y, w + 4, 1, shade(col, 1.1));
    g.save(); g.globalAlpha = 0.3; g.fillStyle = shade(col, 0.55);
    for (let xx = x; xx < x + w; xx += 7) g.fillRect(Math.round(xx), Math.round(y + 1), 1, h - 1);
    g.restore();
  }

  /* a pitched roof with courses of shingles, an overhang and a gutter */
  function roof(x, y, w, rise, col) {
    const over = 5;
    const x0 = x - over, x1 = x + w + over, apex = y - rise;
    g.fillStyle = col;
    g.beginPath(); g.moveTo(x0, y); g.lineTo(mid, apex); g.lineTo(x1, y); g.closePath(); g.fill();
    // the shaded half, split down the ridge
    g.fillStyle = shade(col, DIM);
    g.beginPath();
    g.moveTo(litRight ? x0 : x1, y); g.lineTo(mid, apex); g.lineTo(mid, y); g.closePath(); g.fill();
    // shingle courses, clipped to the roof
    g.save();
    g.beginPath(); g.moveTo(x0, y); g.lineTo(mid, apex); g.lineTo(x1, y); g.closePath(); g.clip();
    g.globalAlpha = 0.30;
    for (let yy = y - 3; yy > apex; yy -= 4) {
      g.fillStyle = shade(col, 0.72);
      g.fillRect(x0, Math.round(yy), x1 - x0, 1);
      const off = ((y - yy) / 4 | 0) % 2 ? 4 : 0;
      for (let xx = x0 + off; xx < x1; xx += 8) g.fillRect(Math.round(xx), Math.round(yy - 3), 1, 3);
    }
    g.restore();
    // ridge cap and gutter
    R(mid - 2, apex, 4, 3, shade(col, 1.2));
    R(x0, y - 1, x1 - x0, 2, shade(col, 0.6));
    R(x0, y + 1, x1 - x0, 1, "rgba(0,0,0,.3)");
  }

  /* a window: frame, panes, a mullion, and warmer light behind */
  function window_(x, y, w, h, lit) {
    R(x - 1, y - 1, w + 2, h + 2, "#5b4634");
    R(x, y, w, h, lit ? "#ffd98a" : "#9fb4c8");
    // interior light is a touch warmer at the bottom of the pane
    g.save(); g.globalAlpha = 0.5;
    g.fillStyle = lit ? "#ffb457" : "#7f97ad";
    g.fillRect(Math.round(x), Math.round(y + h * 0.55), Math.round(w), Math.round(h * 0.45));
    g.restore();
    // glazing bars
    R(x + w / 2 - 0.5, y, 1, h, "#5b4634");
    R(x, y + h / 2 - 0.5, w, 1, "#5b4634");
    // a highlight across the top-left pane
    g.save(); g.globalAlpha = 0.4; g.fillStyle = "#fff";
    g.fillRect(Math.round(x + 1), Math.round(y + 1), Math.round(w / 2 - 2), 1);
    g.restore();
    // sill
    R(x - 2, y + h, w + 4, 2, "#6d5540");
  }

  function door(x, y, w, h, col) {
    R(x, y, w, h, col);
    R(x, y, w, 1, shade(col, 1.25));
    R(x, y, 1, h, shade(col, litRight ? 1.15 : 0.85));
    // two sunken panels
    g.save(); g.globalAlpha = 0.28; g.fillStyle = shade(col, 0.6);
    g.fillRect(Math.round(x + 2), Math.round(y + 2), Math.round(w - 4), Math.round(h * 0.36));
    g.fillRect(Math.round(x + 2), Math.round(y + h * 0.5), Math.round(w - 4), Math.round(h * 0.36));
    g.restore();
    R(x + w - 3, y + h * 0.5, 2, 2, "#ffd166");    // the handle
  }

  function chimney(x, y, h, col) {
    R(x, y - h, 8, h, col);
    R(litRight ? x + 6 : x, y - h, 2, h, shade(col, litRight ? LIT : DIM));
    R(x - 1, y - h - 3, 10, 3, shade(col, 0.7));   // the cap
  }

  /* ---- the pieces ---- */
  if (kind === "pine") {
    R(mid - 3, H - 14, 6, 14, "#5a3f28");
    R(mid - 3, H - 14, 2, 14, "#6f5136");
    for (let i = 0; i < 5; i++) {
      const y = H - 5 - i * 19, w = 32 - i * 5.5;
      g.fillStyle = i % 2 ? "#2f6b3d" : "#3b8149";
      g.beginPath(); g.moveTo(mid, y - 29); g.lineTo(mid - w, y); g.lineTo(mid + w, y); g.fill();
      g.fillStyle = litRight ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.14)";
      g.beginPath(); g.moveTo(mid, y - 29); g.lineTo(mid + w, y); g.lineTo(mid + w * 0.25, y); g.fill();
    }
  } else if (kind === "tree") {
    R(mid - 4, H - 26, 8, 26, "#6a4a2c");
    R(mid - 4, H - 26, 3, 26, "#7d5936");
    const blobs = [[0,-48,24],[-17,-36,17],[17,-36,17],[-7,-58,15],[9,-56,14]];
    blobs.forEach(([bx,by,br]) => {
      g.fillStyle = "#3f8a48";
      g.beginPath(); g.arc(mid+bx, H+by, br, 0, TWO_PI); g.fill();
    });
    // dappled light along the sunward edge, not one flat disc over the top
    g.save();
    g.beginPath();
    blobs.forEach(([bx,by,br]) => { g.moveTo(mid+bx+br, H+by); g.arc(mid+bx, H+by, br, 0, TWO_PI); });
    g.clip();
    g.fillStyle = "#5cab63";
    blobs.forEach(([bx,by,br]) => {
      g.beginPath();
      g.arc(mid+bx+(litRight?br*0.34:-br*0.34), H+by-br*0.34, br*0.7, 0, TWO_PI);
      g.fill();
    });
    g.fillStyle = "rgba(255,255,255,.14)";
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * TWO_PI, rr = 18 + (i % 4) * 9;
      g.fillRect(mid + Math.cos(a) * rr + (litRight ? 6 : -6),
                 H - 46 + Math.sin(a) * rr * 0.7, 3, 3);
    }
    g.restore();
  } else if (kind === "bush") {
    g.fillStyle = "#3f8a48";
    [[0,-16,16],[-13,-10,12],[13,-10,12]].forEach(([bx,by,br]) => {
      g.beginPath(); g.arc(mid+bx, H+by, br, 0, TWO_PI); g.fill();
    });
    g.fillStyle = "rgba(255,255,255,.16)";
    g.beginPath(); g.arc(mid + (litRight?5:-5), H-22, 9, 0, TWO_PI); g.fill();
    // blossom sits ON the foliage, not floating above it
    [[-8,-20],[6,-16],[-2,-25]].forEach(([bx,by],i) =>
      R(mid+bx, H+by, 3, 3, i%2 ? "#ff9ec4" : "#fff1e0"));
  } else if (kind === "rock") {
    g.fillStyle = "#8c8577";
    g.beginPath(); g.moveTo(mid-18, H); g.lineTo(mid-11, H-20);
    g.lineTo(mid+5, H-24); g.lineTo(mid+18, H); g.fill();
    g.fillStyle = litRight ? "#a49c8c" : "#7a7367";
    g.beginPath(); g.moveTo(mid+1, H-22); g.lineTo(mid+18, H); g.lineTo(mid+6, H); g.fill();
    g.fillStyle = "rgba(255,255,255,.18)";
    g.beginPath(); g.moveTo(mid-6,H-16); g.lineTo(mid+2,H-22); g.lineTo(mid+5,H-13); g.fill();

  } else if (kind === "cabin") {
    footing(mid - 30, H - 8, 60, 8, "#7a6a58");
    wall(mid - 30, H - 46, 60, 38, "#8a6a4a", "wood");
    roof(mid - 30, H - 46, 60, 26, "#7a3f30");
    chimney(mid + 14, H - 60, 16, "#8d6b57");
    window_(mid - 22, H - 38, 13, 11, true);
    window_(mid + 9, H - 38, 13, 11, true);
    door(mid - 6, H - 26, 13, 18, "#5c3b26");
    // a porch step and two posts holding a small awning
    R(mid - 12, H - 8, 25, 3, "#6f523a");
    R(mid - 13, H - 22, 2, 14, "#6f523a");
    R(mid + 11, H - 22, 2, 14, "#6f523a");
    R(mid - 15, H - 24, 30, 2, "#5e4630");
    // a couple of logs stacked against the lit wall
    for (let i = 0; i < 3; i++) R(mid + 22, H - 14 - i * 4, 9, 3, i % 2 ? "#8a6a4a" : "#7a5c3f");

  } else if (kind === "house") {
    footing(mid - 30, H - 8, 60, 8, "#9a8a76");
    wall(mid - 30, H - 50, 60, 42, "#e0c3a4", "siding");
    roof(mid - 30, H - 50, 60, 24, "#9c6152");
    chimney(mid - 20, H - 66, 14, "#a8705c");
    window_(mid - 23, H - 43, 14, 12, false);
    window_(mid + 9, H - 43, 14, 12, true);
    door(mid - 6, H - 28, 13, 20, "#7d5340");
    // porch: deck, posts, a shallow awning with a scalloped edge
    R(mid - 20, H - 8, 41, 3, "#c8a98c");
    R(mid - 20, H - 26, 2, 18, "#c8a98c");
    R(mid + 19, H - 26, 2, 18, "#c8a98c");
    R(mid - 22, H - 29, 45, 3, "#8c5b4a");
    g.fillStyle = "#a8705c";
    for (let x = mid - 22; x < mid + 23; x += 5) { g.beginPath(); g.arc(x + 2, H - 26, 2.5, 0, Math.PI); g.fill(); }
    // a flower box under the lit window
    R(mid + 8, H - 30, 16, 5, "#8c5b4a");
    [0,4,8,12].forEach((o,i) => R(mid + 9 + o, H - 33, 3, 3, ["#ff9ec4","#ffe07a","#fff1e0","#ff7f8a"][i]));

  } else if (kind === "store") {
    footing(mid - 34, H - 8, 68, 8, "#8e8378");
    wall(mid - 34, H - 54, 68, 46, "#cbb59a", "brick");
    // a flat parapet rather than a pitch, so it reads as a shop
    R(mid - 37, H - 60, 74, 6, "#a8927a");
    R(mid - 37, H - 60, 74, 2, "#c2ab90");
    R(mid - 37, H - 54, 74, 2, "rgba(0,0,0,.28)");
    // striped awning over the full frontage
    for (let i = 0, x = mid - 34; x < mid + 34; x += 8, i++) {
      g.fillStyle = i % 2 ? "#ff9ec4" : "#fff1e0";
      g.beginPath();
      g.moveTo(x, H - 34); g.lineTo(x + 8, H - 34);
      g.lineTo(x + 8, H - 27); g.lineTo(x, H - 27); g.fill();
    }
    R(mid - 34, H - 27, 68, 2, "rgba(0,0,0,.25)");
    // shopfront glazing, in three bays
    for (let i = 0; i < 3; i++) window_(mid - 30 + i * 21, H - 24, 17, 14, true);
    door(mid + 22, H - 24, 11, 16, "#6f5a44");
    // a small hanging sign
    R(mid - 3, H - 46, 6, 2, "#6f5a44");
    R(mid - 12, H - 44, 24, 8, "#7ec8e3");
    R(mid - 12, H - 44, 24, 1, "#a8dcef");
    for (let i = 0; i < 4; i++) R(mid - 8 + i * 5, H - 41, 3, 3, "#2e4a58");

  } else if (kind === "shed") {
    footing(mid - 18, H - 6, 36, 6, "#7a6a58");
    wall(mid - 18, H - 32, 36, 26, "#9a7a52", "wood");
    // a lean-to roof, one slope only
    g.fillStyle = "#6a4030";
    g.beginPath();
    g.moveTo(mid - 22, H - 32); g.lineTo(mid + 22, H - 42);
    g.lineTo(mid + 22, H - 38); g.lineTo(mid - 22, H - 28); g.fill();
    g.fillStyle = "rgba(0,0,0,.22)";
    g.beginPath(); g.moveTo(mid - 22, H - 30); g.lineTo(mid + 22, H - 40); g.lineTo(mid + 22, H - 38); g.lineTo(mid - 22, H - 28); g.fill();
    door(mid - 6, H - 24, 12, 18, "#5c3b26");
    window_(mid + 6, H - 28, 9, 8, false);

  } else if (kind === "lamp") {
    R(mid - 3, H - 6, 6, 6, "#4a4650");           // base
    R(mid - 2, H - 62, 4, 56, "#4d4a55");
    R(mid - 2, H - 62, 1, 56, "#63606d");
    R(mid - 9, H - 70, 18, 8, "#6a6675");
    R(mid - 9, H - 70, 18, 2, "#807c8c");
    R(mid - 7, H - 68, 14, 5, "#ffe6a8");
    g.save(); g.globalAlpha = 0.30; g.fillStyle = "#ffd166";
    g.beginPath(); g.arc(mid, H - 64, 17, 0, TWO_PI); g.fill();
    g.restore();
    // a hanging basket, because a bare pole is a bare pole
    R(mid + 6, H - 56, 2, 5, "#4d4a55");
    R(mid + 3, H - 51, 8, 4, "#8c5b4a");
    [0,3,6].forEach((o,i) => R(mid + 3 + o, H - 54, 3, 3, ["#ff9ec4","#ffe07a","#ff7f8a"][i]));

  } else if (kind === "postbox") {
    R(mid - 4, H - 6, 8, 6, "#6a5550");
    R(mid - 9, H - 32, 18, 26, "#c0524f");
    R(litRight ? mid + 5 : mid - 9, H - 32, 4, 26, shade("#c0524f", litRight ? LIT : DIM));
    g.fillStyle = "#a8403f";
    g.beginPath(); g.arc(mid, H - 32, 9, Math.PI, 0); g.fill();
    g.fillStyle = "#cf615e";
    g.beginPath(); g.arc(mid - 2, H - 33, 5, Math.PI, 0); g.fill();
    R(mid - 6, H - 27, 12, 3, "#2f2530");
    R(mid - 6, H - 18, 12, 1, "#8e3a38");

  } else if (kind === "hydrant") {
    R(mid - 6, H - 4, 12, 4, "#8a3f3c");
    R(mid - 5, H - 22, 10, 18, "#c85a4e");
    R(litRight ? mid + 2 : mid - 5, H - 22, 3, 18, shade("#c85a4e", litRight ? LIT : DIM));
    R(mid - 8, H - 18, 16, 3, "#c85a4e");
    g.fillStyle = "#d97a6b";
    g.beginPath(); g.arc(mid, H - 22, 5, Math.PI, 0); g.fill();
    R(mid - 1, H - 29, 2, 4, "#8a3f3c");

  } else if (kind === "signpost") {
    R(mid - 2, H - 52, 4, 52, "#6f5a44");
    R(mid - 2, H - 52, 1, 52, "#87705a");
    // two fingerposts pointing opposite ways
    g.fillStyle = "#fff1e0";
    g.beginPath(); g.moveTo(mid - 26, H - 48); g.lineTo(mid + 2, H - 48);
    g.lineTo(mid + 2, H - 40); g.lineTo(mid - 26, H - 40); g.lineTo(mid - 31, H - 44); g.fill();
    g.fillStyle = "#e8d9c0";
    g.fillRect(mid - 26, H - 42, 28, 2);
    for (let i = 0; i < 4; i++) R(mid - 23 + i * 5, H - 46, 3, 2, "#7a5c3f");
    g.fillStyle = "#ffd9a0";
    g.beginPath(); g.moveTo(mid - 2, H - 36); g.lineTo(mid + 24, H - 36);
    g.lineTo(mid + 29, H - 32); g.lineTo(mid + 24, H - 28); g.lineTo(mid - 2, H - 28); g.fill();
    for (let i = 0; i < 3; i++) R(mid + 2 + i * 5, H - 34, 3, 2, "#7a5c3f");

  } else if (kind === "flowerbox") {
    R(mid - 16, H - 10, 32, 10, "#8c5b4a");
    R(mid - 16, H - 10, 32, 2, "#a8705c");
    g.save(); g.globalAlpha = 0.3; g.fillStyle = "#5e3d31";
    for (let x = mid - 14; x < mid + 15; x += 6) g.fillRect(x, H - 8, 1, 8);
    g.restore();
    R(mid - 14, H - 13, 28, 3, "#3f7a48");
    for (let i = 0; i < 7; i++)
      R(mid - 14 + i * 4, H - 17, 3, 4, ["#ff9ec4","#ffe07a","#fff1e0","#ff7f8a","#ffc4a3"][i % 5]);

  } else if (kind === "pole") {                    // IV pole
    R(mid - 6, H - 4, 12, 4, "#98a2b3");
    R(mid - 1, H - 66, 3, 62, "#b9c2d1");
    R(mid - 1, H - 66, 1, 62, "#d5dce7");
    R(mid - 10, H - 70, 20, 4, "#b9c2d1");
    R(mid - 8, H - 64, 9, 16, "#e8f4ff");
    R(mid - 7, H - 60, 7, 10, "#a8d8ef");
    R(mid - 7, H - 60, 7, 2, "#c9e8f7");
    R(mid + 3, H - 66, 2, 12, "#cfd8e4");

  } else if (kind === "cart") {                    // the gift cart
    R(mid - 18, H - 30, 36, 20, "#e3e8f0");
    R(litRight ? mid + 12 : mid - 18, H - 30, 6, 20, "#c8d0dc");
    R(mid - 18, H - 34, 36, 5, "#c3cbd8");
    R(mid - 18, H - 34, 36, 1, "#dfe5ee");
    // the parcel on top, with a ribbon and a bow
    R(mid - 13, H - 48, 26, 14, "#ff9ec4");
    R(mid - 13, H - 48, 26, 2, "#ffc0d8");
    R(mid - 2, H - 48, 4, 14, "#fff1e0");
    R(mid - 13, H - 42, 26, 3, "#fff1e0");
    g.fillStyle = "#fff1e0";
    g.beginPath(); g.arc(mid - 3, H - 50, 3, 0, TWO_PI); g.arc(mid + 3, H - 50, 3, 0, TWO_PI); g.fill();
    [-14, 8].forEach((o) => { R(mid + o, H - 10, 7, 7, "#5a5f6b"); R(mid + o + 2, H - 8, 3, 3, "#8f96a4"); });

  } else if (kind === "chair") {
    R(mid - 13, H - 24, 26, 6, "#9fb4cc");
    R(mid - 13, H - 24, 26, 1, "#bccbdd");
    R(mid - 13, H - 42, 5, 20, "#9fb4cc");
    R(mid - 13, H - 42, 5, 1, "#bccbdd");
    R(mid - 14, H - 8, 5, 8, "#4f5865"); R(mid + 8, H - 8, 5, 8, "#4f5865");
    R(mid - 8, H - 20, 18, 2, "#8aa0ba");

  } else if (kind === "plant") {
    g.strokeStyle = "#3f7a48"; g.lineWidth = 2;
    for (let i = 0; i < 5; i++) {
      const t = -Math.PI / 2 + (i - 2) * 0.42;
      g.beginPath(); g.moveTo(mid, H - 16);
      g.lineTo(mid + Math.cos(t) * 12, H - 19 + Math.sin(t) * 15); g.stroke();
    }
    g.fillStyle = "#4f9e58";
    for (let i = 0; i < 5; i++) {
      const t = -Math.PI / 2 + (i - 2) * 0.42;
      g.beginPath();
      g.ellipse(mid + Math.cos(t) * 13, H - 21 + Math.sin(t) * 15, 5, 11, t + Math.PI / 2, 0, TWO_PI);
      g.fill();
    }
    g.fillStyle = "rgba(255,255,255,.18)";
    g.beginPath(); g.ellipse(mid + (litRight?6:-6), H - 30, 4, 8, 0, 0, TWO_PI); g.fill();
    R(mid - 10, H - 18, 20, 5, "#d69a72");
    R(mid - 8, H - 14, 16, 14, "#c98f68");
    R(litRight ? mid + 4 : mid - 8, H - 14, 4, 14, shade("#c98f68", litRight ? LIT : DIM));

  } else if (kind === "vending") {
    footing(mid - 15, H - 5, 30, 5, "#6f7684");
    wall(mid - 15, H - 46, 30, 41, "#5f7f9a", "panel");
    R(mid - 11, H - 42, 15, 24, "#0f1a24");
    // rows of little bottles behind the glass
    for (let r = 0; r < 4; r++)
      for (let cc = 0; cc < 4; cc++)
        R(mid - 10 + cc * 4, H - 41 + r * 6, 3, 5, ["#ff7f8a","#ffd166","#7ddba3","#7ec8e3"][(r+cc)%4]);
    g.save(); g.globalAlpha = 0.18; g.fillStyle = "#fff";
    g.beginPath(); g.moveTo(mid - 11, H - 20); g.lineTo(mid - 11, H - 42); g.lineTo(mid - 3, H - 42); g.fill();
    g.restore();
    R(mid + 6, H - 40, 7, 12, "#3f4a58");
    for (let i = 0; i < 3; i++) R(mid + 7, H - 38 + i * 4, 5, 2, "#7f8b9c");
    R(mid + 6, H - 24, 7, 4, "#2a323c");

  } else if (kind === "sign") {
    R(mid - 2, H - 40, 4, 40, "#9aa6b6");
    R(mid - 2, H - 40, 1, 40, "#b7c1ce");
    R(mid - 20, H - 62, 40, 22, "#fff8e8");
    R(mid - 20, H - 62, 40, 2, "#ffffff");
    R(mid - 20, H - 42, 40, 2, "rgba(0,0,0,.2)");
    R(mid - 17, H - 58, 34, 3, "#7ec8e3");
    for (let i = 0; i < 3; i++) R(mid - 17, H - 53 + i * 4, 20 - i * 4, 2, "#9fb0c4");
    // a little heart in the corner, because it is that kind of hospital
    g.fillStyle = "#ff7f8a";
    g.beginPath();
    g.moveTo(mid + 13, H - 47); g.bezierCurveTo(mid + 8, H - 52, mid + 10, H - 56, mid + 13, H - 53);
    g.bezierCurveTo(mid + 16, H - 56, mid + 18, H - 52, mid + 13, H - 47); g.fill();

  } else if (kind === "bench") {
    R(mid - 20, H - 6, 4, 6, "#6f7684"); R(mid + 16, H - 6, 4, 6, "#6f7684");
    for (let i = 0; i < 3; i++) R(mid - 22, H - 14 + i * 3, 44, 2, i % 2 ? "#b58a5f" : "#c9a06f");
    for (let i = 0; i < 3; i++) R(mid - 22, H - 30 + i * 4, 44, 3, "#c9a06f");
    R(mid - 22, H - 30, 44, 1, "#dcb885");

  } else if (kind === "laundry") {
    R(mid - 3, H - 6, 6, 6, "#5e5044");
    R(mid - 2, H - 64, 4, 58, "#7a6a58");
    R(mid - 2, H - 64, 1, 58, "#8f7d68");
    g.strokeStyle = "#d8cfc0"; g.lineWidth = 1;
    g.beginPath(); g.moveTo(mid - 30, H - 60); g.quadraticCurveTo(mid, H - 54, mid + 30, H - 60); g.stroke();
    const cols = ["#ff9ec4", "#ffe07a", "#7ec8e3", "#fff1e0", "#ffc4a3"];
    for (let i = 0; i < 5; i++) {
      const x = mid - 26 + i * 12;
      const sag = H - 59 + Math.sin((i / 4) * Math.PI) * 4;
      R(x, sag, 9, 16, cols[i]);
      R(x, sag, 9, 2, shade(cols[i], 1.15));
      R(x, sag + 16, 9, 1, "rgba(0,0,0,.2)");
      R(x + 3, sag - 2, 3, 2, "#c9b8a4");            // the peg
    }

  } else if (kind === "watertank") {
    // legs
    [-14, 10].forEach((o) => { R(mid + o, H - 30, 4, 30, "#5e5248"); R(mid + o, H - 30, 1, 30, "#75675a"); });
    R(mid - 16, H - 22, 32, 2, "#5e5248");
    // the drum, banded
    R(mid - 18, H - 66, 36, 36, "#8a7461");
    R(litRight ? mid + 10 : mid - 18, H - 66, 8, 36, shade("#8a7461", litRight ? LIT : DIM));
    for (let i = 0; i < 3; i++) R(mid - 18, H - 60 + i * 11, 36, 2, "#6d5c4c");
    g.save(); g.globalAlpha = 0.2;
    for (let x = mid - 16; x < mid + 17; x += 5) g.fillRect(x, H - 66, 1, 36);
    g.restore();
    // conical lid
    g.fillStyle = "#6d5c4c";
    g.beginPath(); g.moveTo(mid - 20, H - 66); g.lineTo(mid, H - 78); g.lineTo(mid + 20, H - 66); g.fill();
    g.fillStyle = "rgba(0,0,0,.2)";
    g.beginPath(); g.moveTo(litRight ? mid - 20 : mid + 20, H - 66); g.lineTo(mid, H - 78); g.lineTo(mid, H - 66); g.fill();

  } else if (kind === "aircon") {
    R(mid - 17, H - 26, 34, 26, "#8d8894");
    R(litRight ? mid + 11 : mid - 17, H - 26, 6, 26, shade("#8d8894", litRight ? LIT : DIM));
    R(mid - 17, H - 30, 34, 5, "#a29daa");
    R(mid - 17, H - 30, 34, 1, "#bab5c2");
    g.fillStyle = "#4f4a58";
    g.beginPath(); g.arc(mid, H - 14, 10, 0, TWO_PI); g.fill();
    g.strokeStyle = "#8d8894"; g.lineWidth = 2;
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * TWO_PI + 0.4;
      g.beginPath(); g.moveTo(mid, H - 14);
      g.lineTo(mid + Math.cos(a) * 9, H - 14 + Math.sin(a) * 9); g.stroke();
    }
    for (let i = 0; i < 3; i++) R(mid - 14, H - 6 + i, 28, 1, "#6e6976");

  } else if (kind === "stringpole") {
    R(mid - 4, H - 6, 8, 6, "#4a4038");
    R(mid - 2, H - 66, 4, 60, "#5e5044");
    R(mid - 2, H - 66, 1, 60, "#75675a");
    // two runs of lights leaving in both directions
    [-1, 1].forEach((s) => {
      g.strokeStyle = "rgba(60,50,44,.7)"; g.lineWidth = 1;
      g.beginPath(); g.moveTo(mid, H - 64);
      g.quadraticCurveTo(mid + s * 20, H - 56, mid + s * 40, H - 60); g.stroke();
      for (let i = 1; i <= 4; i++) {
        const t = i / 5;
        const x = mid + s * (40 * t);
        const y = H - 64 + (1 - (1 - t) * (1 - t)) * 8 - t * 4;
        const col = ["#ffd166", "#ff9ec4", "#7ec8e3", "#7ddba3"][i % 4];
        R(x - 1, y, 3, 4, col);
        g.save(); g.globalAlpha = 0.35; g.fillStyle = col;
        g.beginPath(); g.arc(x, y + 2, 5, 0, TWO_PI); g.fill();
        g.restore();
      }
    });

  } else if (kind === "planter") {
    R(mid - 18, H - 14, 36, 14, "#7a6a58");
    R(mid - 18, H - 14, 36, 2, "#8f7d68");
    R(litRight ? mid + 12 : mid - 18, H - 14, 6, 14, shade("#7a6a58", litRight ? LIT : DIM));
    g.save(); g.globalAlpha = 0.25; g.fillStyle = "#5b4c3d";
    for (let x = mid - 16; x < mid + 17; x += 7) g.fillRect(x, H - 12, 1, 12);
    g.restore();
    g.fillStyle = "#3f7a48";
    [[-10,-20,8],[0,-24,9],[10,-20,8]].forEach(([bx,by,br]) => {
      g.beginPath(); g.arc(mid+bx, H+by, br, 0, TWO_PI); g.fill();
    });
    [[-8,-26],[4,-29],[10,-24]].forEach(([bx,by],i) =>
      R(mid+bx, H+by, 3, 3, ["#ffd166","#ff9ec4","#fff1e0"][i]));

  } else if (kind === "vent") {
    R(mid - 16, H - 24, 32, 24, "#6f6a78");
    R(litRight ? mid + 10 : mid - 16, H - 24, 6, 24, shade("#6f6a78", litRight ? LIT : DIM));
    R(mid - 16, H - 29, 32, 5, "#88818f");
    R(mid - 16, H - 29, 32, 1, "#9f98a6");
    for (let x = mid - 12; x < mid + 12; x += 6) R(x, H - 20, 3, 16, "#544f5e");
    R(mid - 12, H - 20, 24, 1, "#3f3b47");

  } else if (kind === "cat") {
    const body = "#3a3340";
    g.fillStyle = body;
    g.beginPath(); g.ellipse(mid, H - 11, 13, 11, 0, 0, TWO_PI); g.fill();
    g.beginPath(); g.arc(mid + 2, H - 26, 10, 0, TWO_PI); g.fill();
    g.beginPath(); g.moveTo(mid - 6, H - 33); g.lineTo(mid - 2, H - 42); g.lineTo(mid + 3, H - 33); g.fill();
    g.beginPath(); g.moveTo(mid + 5, H - 33); g.lineTo(mid + 10, H - 42); g.lineTo(mid + 12, H - 33); g.fill();
    g.fillStyle = "rgba(255,255,255,.14)";
    g.beginPath(); g.arc(mid + (litRight ? 6 : -3), H - 29, 5, 0, TWO_PI); g.fill();
    R(mid - 3, H - 28, 3, 3, "#ffd166"); R(mid + 5, H - 28, 3, 3, "#ffd166");
    R(mid - 2, H - 28, 1, 3, "#2a2230"); R(mid + 6, H - 28, 1, 3, "#2a2230");
    g.strokeStyle = body; g.lineWidth = 3;
    g.beginPath(); g.moveTo(mid - 12, H - 9);
    g.quadraticCurveTo(mid - 24, H - 16, mid - 19, H - 29); g.stroke();
  }

  sceneryCache[key] = cropToContent(c);
  return sceneryCache[key];
}


/* the heart box, spinning — eight frames is plenty at this size */
let boxFrames = null;
function buildBoxFrames() {
  if (boxFrames) return boxFrames;
  boxFrames = [];
  for (let f = 0; f < 8; f++) {
    const S = 48;
    const c = document.createElement("canvas");
    c.width = S; c.height = S;
    const g = c.getContext("2d");
    const t = (f / 8) * TWO_PI;
    const w = Math.max(6, Math.abs(Math.cos(t)) * 30 + 6);
    g.translate(S / 2, S / 2);

    g.fillStyle = "rgba(255,95,149,.34)";
    g.beginPath(); g.arc(0, 0, 21, 0, TWO_PI); g.fill();

    g.fillStyle = shade("#ff7f8a", 0.72);
    g.fillRect(-w / 2, -16, w, 32);
    g.fillStyle = "#ff9ec4";
    g.fillRect(-w / 2, -16, w, 26);
    g.fillStyle = "rgba(255,255,255,.5)";
    g.fillRect(-w / 2, -16, w, 4);

    /* a heart on the face, squashed with the spin */
    const hs = w / 30;
    g.save(); g.scale(hs, 1);
    g.fillStyle = "#fff8e8";
    g.beginPath();
    g.moveTo(0, 8);
    g.bezierCurveTo(-13, -1, -9, -12, 0, -5);
    g.bezierCurveTo(9, -12, 13, -1, 0, 8);
    g.fill();
    g.restore();

    g.fillStyle = "#ffd166";
    g.fillRect(-w / 2, 12, w, 4);
    boxFrames.push(c);
  }
  return boxFrames;
}

/* =========================================================
   10. RENDER TARGETS
   ========================================================= */
let cvs, ctx, cw = 0, ch = 0;

/* live camera state — the spring the chase camera rides on */
let camAngle = 0, camLag = 0, camFocal = FOCAL, camStep = 1 / 60;
let sceneCvs, sceneCtx, sceneImg, buf32;

function initBuffers() {
  sceneCvs = document.createElement("canvas");
  sceneCvs.width = RW; sceneCvs.height = RH;
  sceneCtx = sceneCvs.getContext("2d");
  sceneCtx.imageSmoothingEnabled = false;
  sceneImg = sceneCtx.createImageData(RW, RH);
  buf32 = new Uint32Array(sceneImg.data.buffer);
}

/* --- the Mode 7 floor --- */
function renderGround(camX, camY, camA, focal) {
  const cosA = Math.cos(camA), sinA = Math.sin(camA);
  const rx = -sinA, ry = cosA;              // camera right vector
  const halfW = RW / 2;

  for (let py = HORIZON; py < RH; py++) {
    const dy = py - HORIZON;
    const z = (CAM_H * focal) / (dy < 1 ? 1 : dy);
    let o = py * RW;

    if (z > MAX_Z) {                        // too far to resolve — haze it
      for (let px = 0; px < RW; px++) buf32[o++] = voidColor;
      continue;
    }

    /* step straight into texel space — the divide by TSCALE happens once
       per row here rather than once per pixel in the inner loop */
    const sc = z / focal;
    let wx = (camX + cosA * z + rx * -halfW * sc) / TSCALE;
    let wy = (camY + sinA * z + ry * -halfW * sc) / TSCALE;
    const sx = rx * sc / TSCALE, sy = ry * sc / TSCALE;

    for (let px = 0; px < RW; px++, o++) {
      const tx = wx | 0, ty = wy | 0;
      buf32[o] = (tx >= 0 && tx < TEX && ty >= 0 && ty < TEX)
        ? tex32[(ty << 11) + tx]            // TEX is 2048, so <<11
        : voidColor;
      wx += sx; wy += sy;
    }
  }
  sceneCtx.putImageData(sceneImg, 0, 0);
}

/* --- sky + parallax band above the horizon --- */
function renderSky(def, camA) {
  const g = sceneCtx;
  const grad = g.createLinearGradient(0, 0, 0, HORIZON);
  grad.addColorStop(0, def.sky[0]);
  grad.addColorStop(1, def.sky[1]);
  g.fillStyle = grad;
  g.fillRect(0, 0, RW, HORIZON);

  /* Three depths, each scrolling at its own rate against the camera's
     heading. Far ridge barely moves, the midground band moves about
     twice as fast, and the ground under them moves fastest of all —
     which is what reads as distance rather than as a painted backdrop. */
  const draw = (cvs2, rate, y, alpha) => {
    if (!cvs2) return;
    const off = (((camA / TWO_PI) * PANO_W * rate) % PANO_W + PANO_W) % PANO_W;
    g.globalAlpha = alpha;
    g.drawImage(cvs2, -off, y);
    g.drawImage(cvs2, -off + PANO_W, y);
    if (off < RW) g.drawImage(cvs2, -off - PANO_W, y);
    g.globalAlpha = 1;
  };
  draw(panoFar, 0.55, HORIZON - PANO_H + 10, 0.85);
  draw(panoCvs, 1.0, HORIZON - PANO_H + 4, 1);
  draw(panoMid, 1.9, HORIZON - PANO_MID + 3, 1);
}

/* --- distance haze, so the far road melts into the sky. Kept shallow
   and light on purpose: laid on too thick it stops reading as distance
   and starts reading as a lake sitting across the track. --- */
function renderHaze(def) {
  const g = sceneCtx;
  const grad = g.createLinearGradient(0, HORIZON, 0, HORIZON + 44);
  grad.addColorStop(0, def.haze);
  grad.addColorStop(1, "rgba(255,255,255,0)");
  g.globalAlpha = 0.6;
  g.fillStyle = grad;
  g.fillRect(0, HORIZON, RW, 44);
  g.globalAlpha = 1;
}

/* --- billboards --- */
function projectSprite(wx, wy, camX, camY, camA) {
  const dx = wx - camX, dy = wy - camY;
  const cosA = Math.cos(camA), sinA = Math.sin(camA);
  const z =  dx * cosA + dy * sinA;
  const x = -dx * sinA + dy * cosA;
  /* Anything nearer than this is between the camera and the player, and
     1/z blows it up to fill the screen. The camera trails by CAM_DIST,
     so this only ever culls things already well behind the kart — and
     it fades out over the last stretch rather than vanishing. */
  if (z < 62) return null;
  return {
    z,
    sx: RW / 2 + (x / z) * camFocal,
    sy: HORIZON + (CAM_H / z) * camFocal,
    scale: camFocal / z,
    fade: z < 96 ? (z - 62) / 34 : 1,
  };
}

/* =========================================================
   11. RACERS
   ========================================================= */
/* ---------------------------------------------------------
   HANDLING

   The first pass drove like a cursor: the throttle added a constant
   number every frame, and the steering wrote straight into the heading
   so the kart changed direction with no sense of weight. These are the
   numbers for a model that behaves like a kart instead.

   Speeds are world units per frame at 60fps; the loop runs a fixed
   step so they mean the same thing on any display.
   --------------------------------------------------------- */
const TOP_SPEED = 4.55;   // flat out on tarmac
const ENGINE    = 0.150;  // pull off the line, before the taper
const ACC_TAPER = 2.15;   // how hard acceleration falls away near the top
const BRAKE     = 0.115;  // on the brake
const ENGINE_BR = 0.030;  // off the throttle entirely
const ROLL      = 0.006;  // rolling resistance, always
const TURN      = 3.05 * DEG;  // steering authority at the sweet spot
const GRIP      = 0.14;   // how fast the kart's heading catches its steer
const DRIFT_GRIP= 0.075;  // ...and how much lazier it is mid-drift
const OFFROAD_SP= 0.56;   // top speed multiplier off the tarmac
const OFFROAD_DR= 0.55;   // and how much steering authority you keep there

class Racer {
  constructor(def, isPlayer, lane, back) {
    this.def = def;
    this.isPlayer = isPlayer;
    this.lane = lane;
    const a0 = tangentAt(0);
    const startIdx = (path.length - back) % path.length;
    const p = path[startIdx];
    const ta = tangentAt(startIdx);
    this.x = p.x - Math.sin(ta) * lane;
    this.y = p.y + Math.cos(ta) * lane;
    this.angle = ta;
    this.steer = 0;      // where the wheels point; the heading chases it
    this.speed = 0;
    this.hint = startIdx;

    /* Everyone starts *behind* the line, so the very first crossing is
       the start of lap one rather than the end of it. Counting from -1
       is what makes that work without a separate "have we begun" flag. */
    this.lap = -1;
    this.along = project(this.x, this.y, this.hint).along;
    this.prevAlong = this.along;
    this.progress = -1;          // laps + along, for ordering
    this.place = 1;
    this.finished = false;
    this.finishTime = 0;

    this.item = null;
    this.drifting = false;
    this.driftDir = 0;
    this.driftCharge = 0;
    this.boost = 0;
    this.spin = 0;
    this.invuln = 0;   // the ring: flashes, and shrugs off everything
    this.iframe = 0;   // the moment after a hit, so you cannot be chained
    this.shield = 0;
    this.offroad = false;
    this.aiTarget = (startIdx + 8) % path.length;
    this.aiLine = null;
    this.aiJitter = Math.random() * TWO_PI;
    this.aiItemWait = 1 + Math.random() * 3;
    /* about half the grid knows about the shortcut */
    this.takesCut = !isPlayer && Math.random() < 0.5;
  }

  get maxSpeed() {
    let m = TOP_SPEED;
    if (!this.isPlayer) m *= [0.955, 0.995, 1.03][difficulty];
    if (this.offroad) m *= OFFROAD_SP;
    if (this.boost > 0) m *= 1.55;
    return m;
  }

  update(dt) {
    if (this.finished) { this.speed *= 0.94; this.advance(dt); return; }

    if (this.iframe > 0) this.iframe -= dt;

    if (this.spin > 0) {
      this.spin -= dt;
      this.angle += 11 * DEG * dt * 60;
      this.speed *= 0.93;
      this.advance(dt);
      return;
    }
    if (this.boost  > 0) this.boost  -= dt;
    if (this.invuln > 0) this.invuln -= dt;
    if (this.shield > 0) this.shield -= dt;

    if (this.isPlayer) this.drivePlayer(dt); else this.driveAI(dt);
    this.advance(dt);
  }

  drivePlayer(dt) {
    const gas   = input.up,   rev  = input.down;
    const left  = input.left, right = input.right;
    const dkey  = input.drift;
    const k     = dt * 60;
    const max   = this.maxSpeed;

    /* Acceleration tapers towards the top end instead of being a flat
       addition: hard shove off the line, and the last few units of speed
       take real time to find. */
    if (gas) {
      const head = Math.max(0, 1 - Math.max(0, this.speed) / max);
      this.speed += ENGINE * Math.pow(head, ACC_TAPER) * k;
      if (this.speed > max) this.speed += (max - this.speed) * 0.10 * k;
    } else if (rev) {
      this.speed -= BRAKE * k;
      if (this.speed < -max * 0.32) this.speed = -max * 0.32;
    } else {
      /* engine braking, not a handbrake — you coast */
      const drop = (ENGINE_BR + ROLL) * k;
      this.speed -= Math.sign(this.speed) * Math.min(Math.abs(this.speed), drop);
    }
    if (this.speed > 0) this.speed -= Math.min(this.speed, ROLL * k);
    if (!gas && !rev && Math.abs(this.speed) < 0.02) this.speed = 0;

    /* Drift: hold the button while turning and it locks a direction,
       builds a charge, and pays out a boost on release. Three tiers,
       flagged by the colour of the sparks. */
    const turning = left || right;
    if (dkey && turning && this.speed > TOP_SPEED * 0.42) {
      if (!this.drifting) {
        this.drifting = true; this.driftDir = left ? -1 : 1; this.driftCharge = 0;
        Snd.drift(true);
      }
      this.driftCharge = Math.min(this.driftCharge + dt, 3);
    } else if (this.drifting) {
      let tier = 0;
      if (this.driftCharge > 1.7)      { this.boost = 1.15; tier = 3; }
      else if (this.driftCharge > 1.0) { this.boost = 0.75; tier = 2; }
      else if (this.driftCharge > 0.5) { this.boost = 0.42; tier = 1; }
      this.drifting = false;
      this.driftCharge = 0;
      Snd.drift(false);
      if (tier) Snd.boost(tier);
    }

    /* Steering sets where the front wheels point; the kart's heading
       then chases it. That gap is the whole difference between a kart
       with mass and a cursor that snaps to its new direction. */
    const speedFrac = Math.min(1, Math.abs(this.speed) / TOP_SPEED);
    /* tight at low speed, lazier as it winds up — a real turning circle */
    let rate = TURN * (1.35 - 0.55 * speedFrac);
    if (this.drifting) rate *= 1.45;
    if (this.offroad)  rate *= OFFROAD_DR;
    /* Authority falls off as you slow, but never to nothing. Letting it
       reach zero meant a kart that nosed into the verge and stopped
       could not steer out of it, because steering needed speed and
       speed needed steering — you were simply stuck there for good. */
    rate *= Math.min(1, (Math.abs(this.speed) + 0.30) / (TOP_SPEED * 0.30));
    const dir = this.speed < 0 ? -1 : 1;
    if (left)  this.steer -= rate * k * dir;
    if (right) this.steer += rate * k * dir;
    if (!left && !right) {
      /* self-centring, so letting go straightens the kart out */
      const back = TURN * 1.5 * k;
      this.steer -= Math.sign(this.steer) * Math.min(Math.abs(this.steer), back);
    }
    const lock = TURN * 22;
    this.steer = Math.max(-lock, Math.min(lock, this.steer));
    if (this.drifting) this.steer += this.driftDir * TURN * 0.30 * k;

    const grip = (this.drifting ? DRIFT_GRIP : GRIP) * (this.offroad ? 0.7 : 1);
    this.angle += (this.steer) * grip * k;
    /* the heading having caught up spends the steering input */
    this.steer -= this.steer * grip * k;

    if (input.itemPressed) { input.itemPressed = false; this.fire(); }
  }

  driveAI(dt) {
    const n = path.length;
    const k = dt * 60;

    /* Some of the field will take the shortcut. They aim at its own
       waypoints while their progress sits inside its span, then rejoin. */
    let line = path, tIdxMax = n;
    if (cut && this.takesCut) {
      let span = cut.to - cut.from; if (span < 0) span += 1;
      let rel = this.along - cut.from; if (rel < 0) rel += 1;
      if (rel < span * 1.05 && rel > -0.01) { line = cut.pts; tIdxMax = cut.pts.length; }
    }
    if (line !== this.aiLine) { this.aiLine = line; this.aiTarget = 0; }

    let tries = 0;
    while (tries++ < 10) {
      const tp = line[Math.min(this.aiTarget, tIdxMax - 1)];
      if (Math.hypot(tp.x - this.x, tp.y - this.y) > 60) break;
      this.aiTarget = line === path ? (this.aiTarget + 1) % n
                                    : Math.min(this.aiTarget + 1, tIdxMax - 1);
    }
    const tIdx = line === path ? this.aiTarget : Math.min(this.aiTarget, tIdxMax - 1);
    const nx2 = line[Math.min(tIdx + 1, tIdxMax - 1)] || line[tIdx];
    const ta = Math.atan2(nx2.y - line[tIdx].y, nx2.x - line[tIdx].x);
    this.aiJitter += dt * 0.7;
    const lane = (line === path ? this.lane * 0.75 : this.lane * 0.3)
               + Math.sin(this.aiJitter) * 10;
    const tx = line[tIdx].x - Math.sin(ta) * lane;
    const ty = line[tIdx].y + Math.cos(ta) * lane;

    let diff = Math.atan2(ty - this.y, tx - this.x) - this.angle;
    while (diff >  Math.PI) diff -= TWO_PI;
    while (diff < -Math.PI) diff += TWO_PI;

    /* the AI steers through the same wheels-then-heading model the
       player does, so they lean into corners rather than pivoting */
    const speedFrac = Math.min(1, Math.abs(this.speed) / TOP_SPEED);
    const rate = TURN * (1.35 - 0.55 * speedFrac) * 1.7 * k;
    const wantSteer = Math.max(-rate, Math.min(rate, diff * 2.6));
    this.steer += (wantSteer - this.steer) * 0.35 * k;
    const lock = TURN * 22;
    this.steer = Math.max(-lock, Math.min(lock, this.steer));
    const grip = GRIP * (this.offroad ? 0.7 : 1);
    this.angle += this.steer * grip * k;
    this.steer -= this.steer * grip * k;

    /* ease off through the tight stuff, and rubber-band gently so the
       race stays alive without feeling rigged */
    let want = this.maxSpeed * (1 - Math.min(0.42, Math.abs(diff) * 0.85));
    const p = racers.find((r) => r.isPlayer);
    if (p && !p.finished) {
      const gap = p.progress - this.progress;
      if (gap >  0.06) want *= 1.05 + Math.min(0.10, gap * 0.5);
      if (gap < -0.06) want *= 0.94;
    }
    this.speed += (want - this.speed) * 2.4 * dt;

    if (this.item) {
      this.aiItemWait -= dt;
      if (this.aiItemWait <= 0) { this.fire(); this.aiItemWait = 4 + Math.random() * 6; }
    }
  }

  advance(dt) {
    const k = dt * 60;
    this.x += Math.cos(this.angle) * this.speed * k;
    this.y += Math.sin(this.angle) * this.speed * k;

    const pr = project(this.x, this.y, this.hint);
    if (!pr.onCut) this.hint = pr.idx;
    this.onCut = pr.onCut;
    /* widths are relative to whichever ribbon you are on — the shortcut
       is narrower, which is the price of taking it */
    const rumble = pr.half + (RUMBLE_HALF - ROAD_HALF);
    const bound  = pr.half + (SHOULDER - ROAD_HALF);
    this.offroad = pr.dist > rumble;

    /* the wall is soft: past the shoulder you get pushed back and lose
       most of your speed, rather than stopping dead */
    if (pr.dist > bound) {
      const push = pr.dist - bound;
      const s = Math.sign(pr.side) || 1;
      this.x -= pr.nx * s * push;
      this.y -= pr.ny * s * push;
      /* Scrape, don't stop. The push above already removes the sideways
         motion; taking a big bite out of the speed as well every frame
         meant a kart that touched the verge simply died there. */
      this.speed *= 0.97;
      /* and swing the nose back down the road, so a kart that arrives
         at the barrier square-on slides along it rather than grinding
         to a halt pointing at the scenery */
      let td = pr.tan - this.angle;
      while (td >  Math.PI) td -= TWO_PI;
      while (td < -Math.PI) td += TWO_PI;
      if (Math.abs(td) < Math.PI * 0.55) this.angle += td * 0.07 * k;
      if (this.isPlayer) shake = Math.min(2, shake + push * 0.04);
    }
    if (this.offroad && Math.abs(this.speed) > 1.2 && Math.random() < 0.5) {
      addPuff(this.x, this.y, "#d9c9a8");
    }

    /* lap counting, with the wrap in both directions so reversing over
       the line cannot farm laps */
    const a = pr.along;
    if (this.prevAlong > 0.82 && a < 0.18) {
      this.lap++;
      /* lap 0 is the start line itself — announcing "LAP 1" there just
         puts a banner over the countdown you have only just cleared */
      if (mode !== "tutorial" && this.isPlayer &&
          this.lap >= 1 && this.lap < trackDef.laps) {
        flashBanner("LAP " + (this.lap + 1));
        Snd.lap();
      }
      if (this.lap >= trackDef.laps && !this.finished) {
        this.finished = true;
        this.finishTime = raceTime;
        if (this.isPlayer) onPlayerFinished();
      }
    } else if (this.prevAlong < 0.18 && a > 0.82) {
      this.lap = Math.max(0, this.lap - 1);
    }
    this.prevAlong = a;
    this.along = a;
    this.progress = this.lap + a;

    if (this.drifting && Math.abs(this.speed) > 1)
      addSpark(this.x, this.y, this.angle, this.driftCharge);
    if (this.boost > 0 && Math.random() < 0.7)
      addFlame(this.x, this.y, this.angle, this.def.accent);
  }

  fire() {
    if (!this.item) return;
    const it = this.item;
    this.item = null;
    if (this.isPlayer) Snd.use(it);
    if (it === "letter") {
      this.boost = Math.max(this.boost, 1.0);
      if (this.isPlayer) flashBanner("BOOST!");
    } else if (it === "ring") {
      this.invuln = 6; this.boost = Math.max(this.boost, 5.4);
      if (this.isPlayer) flashBanner("INVINCIBLE!");
    } else if (it === "bouquet") {
      this.shield = 8;
    } else if (it === "rose") {
      hazards.push({
        x: this.x - Math.cos(this.angle) * 44,
        y: this.y - Math.sin(this.angle) * 44,
        life: 12, spin: 0,
      });
    } else {
      shots.push({
        x: this.x + Math.cos(this.angle) * 42,
        y: this.y + Math.sin(this.angle) * 42,
        a: this.angle,
        sp: it === "arrow" ? 8.4 : 7.0,
        kind: it,
        owner: this,
        life: it === "arrow" ? 6 : 5,
        bounce: it === "heart" ? 4 : 0,
        hint: this.hint,
      });
    }
  }
}

/* =========================================================
   12. EFFECTS
   ========================================================= */
let fx = [];
/* Sparks come off the two rear wheels, not out of the middle of the
   kart, and they are small and quick — big slow ones read as litter
   blowing across the track rather than as tyres letting go. */
function addSpark(x, y, a, charge) {
  const tier = charge > 1.7 ? 2 : charge > 1.0 ? 1 : 0;
  const col = ["#9ad9ef", "#ffd166", "#ff5f95"][tier];
  const back = a + Math.PI;
  const lx = -Math.sin(a), ly = Math.cos(a);
  for (const sgn of [-1, 1]) {
    const ox = x + Math.cos(back) * 13 + lx * sgn * 11;
    const oy = y + Math.sin(back) * 13 + ly * sgn * 11;
    const spread = back + (Math.random() - 0.5) * 0.5;
    fx.push({
      x: ox, y: oy, z: 2 + Math.random() * 3,
      vx: Math.cos(spread) * 1.5, vy: Math.sin(spread) * 1.5, vz: 1.1,
      life: 0.22, max: 0.22, col, size: 1.6 + tier * 0.7,
    });
  }
}
function addFlame(x, y, a, col) {
  const back = a + Math.PI;
  fx.push({
    x: x + Math.cos(back) * 17, y: y + Math.sin(back) * 17, z: 4,
    vx: Math.cos(back) * 1.0, vy: Math.sin(back) * 1.0, vz: 1.5,
    life: 0.24, max: 0.24, col, size: 2.6,
  });
}
function addPuff(x, y, col) {
  fx.push({
    x, y, z: 2, vx: (Math.random()-0.5)*1.1, vy: (Math.random()-0.5)*1.1, vz: 1.0,
    life: 0.42, max: 0.42, col, size: 3.2,
  });
}
function addPop(x, y, col) {
  for (let i = 0; i < 12; i++) {
    const t = Math.random() * TWO_PI;
    fx.push({
      x, y, z: 8, vx: Math.cos(t) * 2.2, vy: Math.sin(t) * 2.2, vz: 1.6 + Math.random() * 1.4,
      life: 0.5, max: 0.5, col, size: 2.4,
    });
  }
}
function stepFx(dt) {
  for (let i = fx.length - 1; i >= 0; i--) {
    const p = fx[i];
    p.life -= dt;
    if (p.life <= 0) { fx.splice(i, 1); continue; }
    p.x += p.vx; p.y += p.vy; p.z += p.vz;
    p.vz -= 0.22; if (p.z < 0) { p.z = 0; p.vz *= -0.3; }
    p.vx *= 0.94; p.vy *= 0.94;
  }
}

/* =========================================================
   13. RACE STATE
   ========================================================= */
let racers = [], boxes = [], shots = [], hazards = [], props = [];
let trackDef = TRACKS[0];
let raceTime = 0, countdown = 0, shake = 0;
let mode = "single";           // single | gp | trial
let difficulty = 1;
let playerCharIdx = 0, trackIdx = 0;
let gpRound = 0, gpPoints = [];
let state = "title";           // title|chars|tracks|count|race|paused|results|gpboard
let ghost = null, ghostRec = null, ghostPlay = null;
let bannerT = 0;
let lastPlace = 0;

const GP_POINTS = [15, 12, 10, 8, 6, 4, 3, 2];

/* Setting textContent alone will not restart the CSS keyframe, so the
   second "LAP 2" of a race would appear with no animation at all —
   toggling hidden and forcing a reflow between is what re-arms it. */
function flashBanner(t) {
  bannerT = 1.4;
  if (!el.banner) return;
  el.banner.hidden = true;
  el.banner.textContent = t;
  void el.banner.offsetWidth;
  el.banner.hidden = false;
}

function placeProps(def) {
  props = [];
  const rnd = mulberry(def.id.length * 3121 + 7);
  for (let i = 0; i < path.length; i += 4) {
    for (const s of [-1, 1]) {
      if (rnd() > 0.62) continue;
      const ta = tangentAt(i);
      const off = SHOULDER + 26 + rnd() * 150;
      const kind = def.scenery[(rnd() * def.scenery.length) | 0];
      props.push({
        x: path[i].x - Math.sin(ta) * off * s,
        y: path[i].y + Math.cos(ta) * off * s,
        kind,
        hv: 0.85 + rnd() * 0.35,   // a little variety in height per instance
        smokeX: (rnd() < 0.5 ? -1 : 1) * (0.14 + rnd() * 0.14),
      });
    }
  }
}

function placeBoxes() {
  boxes = [];
  const n = path.length;
  for (let g = 0; g < 5; g++) {
    const base = Math.floor((g + 0.5) * n / 5);
    const ta = tangentAt(base);
    for (let k = -1; k <= 1; k++) {
      boxes.push({
        x: path[base].x - Math.sin(ta) * k * 26,
        y: path[base].y + Math.cos(ta) * k * 26,
        alive: true, t: 0, spin: Math.random() * 8,
      });
    }
  }
}

function startRace() {
  trackDef = TRACKS[trackIdx];
  buildPath(trackDef);
  /* props are placed before the bake so their shadows can be painted
     into the ground texture along with everything else */
  placeProps(trackDef);
  bakeTrack(trackDef);
  bakePano(trackDef);
  placeBoxes();

  shots = []; hazards = []; fx = [];
  raceTime = 0; countdown = 3.9; shake = 0;
  bannerT = 0; setBanner("");
  lastItem = "__";           // force the item slot to repaint from empty

  const field = [];
  const playerDef = CHARS[playerCharIdx];
  field.push({ def: playerDef, player: true });
  if (mode !== "trial") {
    field.push({ def: CHARS[playerCharIdx === 0 ? 1 : 0], player: false });
    const pool = CHARS.slice(2);
    for (let i = 0; i < 6; i++) field.push({ def: pool[i % pool.length], player: false });
  }

  racers = field.map((f, i) => {
    const lane = ((i % 2) * 2 - 1) * 22;
    const back = 6 + Math.floor(i / 2) * 9;
    return new Racer(f.def, f.player, lane, back);
  });
  racers.forEach((r) => { r.progress = r.lap + r.along; });

  /* time trial: race your own best lap as a ghost */
  if (mode === "trial") {
    ghostRec = [];
    ghostPlay = loadGhost(trackDef.id);
    ghost = ghostPlay ? { x: 0, y: 0, angle: 0, def: playerDef } : null;
  } else {
    ghostRec = null; ghostPlay = null; ghost = null;
  }

  camAngle = racers[0] ? racers[0].angle : 0;
  camLag = 0; camFocal = FOCAL;
  lastPlace = 0;
  Snd.resume();
  Snd.music(trackDef.id);

  state = "count";
  showHud(true);
  setOverlay("");
  drawMini();
}

function onPlayerFinished() {
  const me = racers.find((r) => r.isPlayer);
  order();
  if (mode === "trial") {
    const best = loadBest(trackDef.id);
    if (!best || me.finishTime < best) {
      saveBest(trackDef.id, me.finishTime);
      if (ghostRec) saveGhost(trackDef.id, ghostRec);
      flashBanner("NEW BEST!");
    }
  }
  setTimeout(() => {
    if (state === "race") finishRace();
  }, 2200);
}

function finishRace() {
  racers.forEach((r) => {
    if (!r.finished) { r.finished = true; r.finishTime = raceTime + (r.place * 1.4); }
  });
  order();
  if (mode === "gp") {
    const me = racers.find((r) => r.isPlayer);
    gpPoints[gpRound] = GP_POINTS[Math.min(me.place - 1, GP_POINTS.length - 1)];
  }
  state = "results";
  showHud(false);
  Snd.engineOff();
  Snd.drift(false);
  Snd.music("menu");
  Snd.fanfare();
  renderResults();
}

function order() {
  const s = [...racers].sort((a, b) => {
    if (a.finished && b.finished) return a.finishTime - b.finishTime;
    if (a.finished) return -1;
    if (b.finished) return 1;
    return b.progress - a.progress;
  });
  s.forEach((r, i) => (r.place = i + 1));
}

/* ---- best times & ghosts ---- */
function loadBest(id) {
  try { const v = localStorage.getItem("sor_best_" + id); return v ? parseFloat(v) : null; } catch (e) { return null; }
}
function saveBest(id, t) { try { localStorage.setItem("sor_best_" + id, String(t)); } catch (e) {} }
function loadGhost(id) {
  try { const v = localStorage.getItem("sor_ghost_" + id); return v ? JSON.parse(v) : null; } catch (e) { return null; }
}
function saveGhost(id, rec) {
  try { localStorage.setItem("sor_ghost_" + id, JSON.stringify(rec)); } catch (e) {}
}

/* =========================================================
   14. SIMULATION STEP
   ========================================================= */
function step(dt) {
  if (state === "count") {
    const before = Math.ceil(countdown - 0.9);
    countdown -= dt;
    const after = Math.ceil(countdown - 0.9);
    if (after !== before) Snd.beep(after <= 0);
    paintCount();
    if (countdown <= 0) { state = "race"; setCount(""); Snd.engineOn(); }
    return;
  }
  if (state !== "race") return;

  raceTime += dt;
  if (bannerT > 0) { bannerT -= dt; if (bannerT <= 0) setBanner(""); }
  if (shake > 0) shake = Math.max(0, shake - dt * 6);

  racers.forEach((r) => r.update(dt));
  order();

  const me0 = racers.find((r) => r.isPlayer);
  if (me0) {
    Snd.engine(Math.min(1, Math.abs(me0.speed) / TOP_SPEED), me0.offroad);
    if (me0.drifting) Snd.driftCharge(me0.driftCharge > 1.7 ? 3 : me0.driftCharge > 1.0 ? 2 : 1);
    if (me0.offroad && Math.abs(me0.speed) > 1.4 && Math.random() < 0.12) Snd.scrape();
    if (me0.place !== lastPlace) { if (lastPlace) Snd.tick(); lastPlace = me0.place; }
  }

  /* ghost: record where we were, replay where we were last time */
  if (mode === "trial") {
    const me = racers.find((r) => r.isPlayer);
    if (ghostRec && !me.finished) {
      const slot = Math.floor(raceTime * 10);
      if (ghostRec.length <= slot) ghostRec[slot] = [Math.round(me.x), Math.round(me.y), +me.angle.toFixed(2)];
    }
    if (ghostPlay) {
      const slot = Math.floor(raceTime * 10);
      const g = ghostPlay[Math.min(slot, ghostPlay.length - 1)];
      if (g) { ghost.x = g[0]; ghost.y = g[1]; ghost.angle = g[2]; }
    }
  }

  /* item boxes */
  boxes.forEach((b) => {
    b.spin += dt * 4.5;
    if (!b.alive) { b.t -= dt; if (b.t <= 0) b.alive = true; return; }
    for (const r of racers) {
      if (r.item || r.finished) continue;
      if ((r.x - b.x) ** 2 + (r.y - b.y) ** 2 < 30 * 30) {
        r.item = rollItem(r.place, racers.length);
        b.alive = false; b.t = 4;
        addPop(b.x, b.y, "#ff9ec4");
        if (r.isPlayer) { paintItem(); Snd.pickup(); }
        break;
      }
    }
  });

  /* shots */
  for (let i = shots.length - 1; i >= 0; i--) {
    const s = shots[i];
    s.life -= dt;
    if (s.life <= 0) { shots.splice(i, 1); continue; }

    if (s.kind === "arrow") {
      /* Cupid's arrow goes for whoever is one place ahead of its owner */
      let best = null, bestGap = Infinity;
      for (const r of racers) {
        if (r === s.owner || r.finished) continue;
        const gap = r.progress - s.owner.progress;
        if (gap > 0 && gap < bestGap) { bestGap = gap; best = r; }
      }
      if (best) {
        let d = Math.atan2(best.y - s.y, best.x - s.x) - s.a;
        while (d >  Math.PI) d -= TWO_PI;
        while (d < -Math.PI) d += TWO_PI;
        const rate = 3.4 * DEG * dt * 60;
        s.a += Math.max(-rate, Math.min(rate, d));
      }
    }

    s.x += Math.cos(s.a) * s.sp * dt * 60;
    s.y += Math.sin(s.a) * s.sp * dt * 60;

    if (s.bounce > 0) {
      const pr = project(s.x, s.y, s.hint);
      s.hint = pr.idx;
      if (pr.dist > ROAD_HALF) {
        /* reflect off the verge, so paper hearts ping down the road */
        const nx = pr.nx * Math.sign(pr.side), ny = pr.ny * Math.sign(pr.side);
        const dot = Math.cos(s.a) * nx + Math.sin(s.a) * ny;
        const rxv = Math.cos(s.a) - 2 * dot * nx, ryv = Math.sin(s.a) - 2 * dot * ny;
        s.a = Math.atan2(ryv, rxv);
        s.x = pr.cx + nx * (ROAD_HALF - 4);
        s.y = pr.cy + ny * (ROAD_HALF - 4);
        s.bounce--;
      }
    }

    for (const r of racers) {
      if (r === s.owner || r.finished) continue;
      if ((r.x - s.x) ** 2 + (r.y - s.y) ** 2 < 26 * 26) {
        hit(r);
        addPop(s.x, s.y, ITEMS[s.kind].tint);
        shots.splice(i, 1);
        break;
      }
    }
  }

  /* dropped roses */
  for (let i = hazards.length - 1; i >= 0; i--) {
    const h = hazards[i];
    h.life -= dt; h.spin += dt * 2;
    if (h.life <= 0) { hazards.splice(i, 1); continue; }
    for (const r of racers) {
      if (r.finished) continue;
      if ((r.x - h.x) ** 2 + (r.y - h.y) ** 2 < 24 * 24) {
        hit(r);
        addPop(h.x, h.y, "#e8556f");
        hazards.splice(i, 1);
        break;
      }
    }
  }

  /* kart on kart: a nudge, not a crash */
  for (let i = 0; i < racers.length; i++) {
    for (let j = i + 1; j < racers.length; j++) {
      const a = racers[i], b = racers[j];
      const dx = b.x - a.x, dy = b.y - a.y;
      const d2 = dx * dx + dy * dy;
      if (d2 > 34 * 34 || d2 < 0.01) continue;
      const d = Math.sqrt(d2), push = (34 - d) * 0.5;
      const ux = dx / d, uy = dy / d;
      a.x -= ux * push; a.y -= uy * push;
      b.x += ux * push; b.y += uy * push;
    }
  }

  if (mode === "tutorial") stepTutorial(dt);

  stepFx(dt);
}

/* A spin costs about a second. Without the grace period afterwards a
   field of seven opponents can chain their items on you and you never
   drive again — which is exactly what happened the first time this was
   played through end to end. */
function hit(r) {
  if (r.invuln > 0 || r.spin > 0 || r.iframe > 0) return;
  if (r.shield > 0) { r.shield = 0; r.iframe = 0.8; addPop(r.x, r.y, "#ff9ec4"); return; }
  r.spin = 1.05;
  r.iframe = 2.0;
  r.speed *= 0.34;
  r.boost = 0;
  r.drifting = false;
  if (r.isPlayer) { shake = 3; flashBanner("OUCH!"); Snd.hit(); }
}

/* =========================================================
   15. DRAW
   ========================================================= */
function draw() {
  const me = racers.find((r) => r.isPlayer);
  if (!me) return;

  /* The camera trails the kart on a spring rather than being welded to
     its back. Turning in swings the tail out and you see into the
     corner; on boost it drops back and the lens widens, which is most
     of why a boost reads as fast rather than just numerically faster. */
  let d = me.angle - camAngle;
  while (d >  Math.PI) d -= TWO_PI;
  while (d < -Math.PI) d += TWO_PI;
  camAngle += d * Math.min(1, 0.12 * camStep * 60);
  camLag += ((me.boost > 0 ? 1 : 0) - camLag) * Math.min(1, 0.06 * camStep * 60);

  const dist = CAM_DIST * (1 + camLag * 0.14);
  const camA = camAngle;
  const camX = me.x - Math.cos(camA) * dist;
  const camY = me.y - Math.sin(camA) * dist;
  camFocal = FOCAL * (1 - camLag * 0.10);

  renderGround(camX, camY, camA, camFocal);
  renderSky(trackDef, camA);
  renderHaze(trackDef);

  /* everything that stands up, sorted far to near */
  const bill = [];
  props.forEach((p) => {
    const s = projectSprite(p.x, p.y, camX, camY, camA);
    if (s && s.z < MAX_Z) bill.push({ s, kind: "prop", o: p });
  });
  boxes.forEach((b) => {
    if (!b.alive) return;
    const s = projectSprite(b.x, b.y, camX, camY, camA);
    if (s) bill.push({ s, kind: "box", o: b });
  });
  hazards.forEach((h) => {
    const s = projectSprite(h.x, h.y, camX, camY, camA);
    if (s) bill.push({ s, kind: "rose", o: h });
  });
  shots.forEach((sh) => {
    const s = projectSprite(sh.x, sh.y, camX, camY, camA);
    if (s) bill.push({ s, kind: "shot", o: sh });
  });
  if (ghost && ghostPlay) {
    const s = projectSprite(ghost.x, ghost.y, camX, camY, camA);
    if (s) bill.push({ s, kind: "ghost", o: ghost });
  }
  racers.forEach((r) => {
    const s = projectSprite(r.x, r.y, camX, camY, camA);
    if (s) bill.push({ s, kind: "kart", o: r });
  });
  fx.forEach((p) => {
    const s = projectSprite(p.x, p.y, camX, camY, camA);
    if (s) bill.push({ s, kind: "fx", o: p });
  });

  bill.sort((a, b) => b.s.z - a.s.z);

  const g = sceneCtx;
  g.imageSmoothingEnabled = false;
  bill.forEach((b) => {
    switch (b.kind) {
      case "prop":  drawProp(g, b);  break;
      case "box":   drawBox(g, b);   break;
      case "rose":  drawRose(g, b);  break;
      case "shot":  drawShot(g, b);  break;
      case "kart":  drawKart(g, b, camA); break;
      case "ghost": drawKart(g, b, camA, true); break;
      case "fx":    drawFx(g, b);    break;
    }
  });

  /* boost pulls the whole picture in a little */
  if (me.boost > 0) drawSpeedLines(g, me.boost);

  /* --- blit to the visible canvas, unsmoothed so it stays pixel art --- */
  ctx.imageSmoothingEnabled = false;
  const sx = shake ? (Math.random() - 0.5) * shake * (cw / RW) * 2 : 0;
  const sy = shake ? (Math.random() - 0.5) * shake * (ch / RH) * 2 : 0;
  ctx.clearRect(0, 0, cw, ch);
  ctx.drawImage(sceneCvs, sx, sy, cw, ch);
}

function shadowUnder(g, sx, sy, w) {
  g.fillStyle = "rgba(0,0,0,.3)";
  g.beginPath();
  g.ellipse(sx, sy, w * 0.5, w * 0.2, 0, 0, TWO_PI);
  g.fill();
}

function drawProp(g, b) {
  const { s, o } = b;
  if (s.fade < 1) g.globalAlpha = s.fade;
  const img = buildScenery(o.kind, trackDef);
  const spec = SCENERY[o.kind] || { h: 90, foot: 0.6 };
  const h = spec.h * o.hv * s.scale;
  const w = h * (img.width / img.height);
  if (w < 1.2) return;
  shadowUnder(g, s.sx, s.sy, w * spec.foot * 0.8);
  g.drawImage(img, s.sx - w / 2, s.sy - h, w, h);

  /* smoke from the chimney, drawn live rather than baked so it drifts.
     Three puffs on staggered phases, rising and spreading as they go. */
  if (spec.smoke && w > 14) {
    const cx = s.sx + w * (o.smokeX || 0.2);
    const cy = s.sy - h * 0.9;
    g.save();
    for (let i = 0; i < 3; i++) {
      const t = ((raceTime * 0.34 + i / 3 + o.hv) % 1);
      const r = w * (0.045 + t * 0.075);
      if (r < 0.6) continue;
      g.globalAlpha = 0.30 * (1 - t);
      g.fillStyle = "#e8e2ea";
      g.beginPath();
      g.arc(cx + Math.sin(t * 3.2 + i) * w * 0.06, cy - t * h * 0.34, r, 0, TWO_PI);
      g.fill();
    }
    g.restore();
  }
  g.globalAlpha = 1;
}

function drawBox(g, b) {
  const { s, o } = b;
  const frames = buildBoxFrames();
  const img = frames[Math.floor(o.spin) % frames.length];
  const h = 20 * s.scale, w = h;
  if (w < 1.2) return;
  const bob = Math.sin(o.spin * 0.8) * 3 * s.scale;
  shadowUnder(g, s.sx, s.sy, w * 0.5);
  g.drawImage(img, s.sx - w / 2, s.sy - h + bob, w, h);
}

function drawRose(g, b) {
  const { s, o } = b;
  const r = 11 * s.scale;
  if (r < 0.8) return;
  shadowUnder(g, s.sx, s.sy, r * 2);
  g.fillStyle = "#3f7a3f";
  g.fillRect(s.sx - r * 0.2, s.sy - r * 1.4, r * 0.4, r * 1.4);
  g.fillStyle = "#e8556f";
  g.beginPath(); g.arc(s.sx, s.sy - r * 1.6, r * 0.85, 0, TWO_PI); g.fill();
  g.fillStyle = "#ff9ec4";
  g.beginPath(); g.arc(s.sx - r * 0.2, s.sy - r * 1.8, r * 0.4, 0, TWO_PI); g.fill();
}

function drawShot(g, b) {
  const { s, o } = b;
  const r = 9 * s.scale;
  if (r < 0.7) return;
  g.save();
  g.translate(s.sx, s.sy - r * 1.4);
  if (o.kind === "arrow") {
    g.fillStyle = "#ff5f95";
    g.fillRect(-r, -r * 0.3, r * 2, r * 0.6);
    g.beginPath();
    g.moveTo(r * 1.5, 0); g.lineTo(r * 0.4, -r * 0.8); g.lineTo(r * 0.4, r * 0.8);
    g.fill();
    g.fillStyle = "#fff1e0";
    g.fillRect(-r * 1.3, -r * 0.7, r * 0.5, r * 1.4);
  } else {
    g.fillStyle = "#ff7f8a";
    g.beginPath();
    g.moveTo(0, r * 0.9);
    g.bezierCurveTo(-r * 1.4, -r * 0.1, -r, -r * 1.3, 0, -r * 0.5);
    g.bezierCurveTo(r, -r * 1.3, r * 1.4, -r * 0.1, 0, r * 0.9);
    g.fill();
    g.fillStyle = "rgba(255,255,255,.55)";
    g.fillRect(-r * 0.5, -r * 0.6, r * 0.35, r * 0.5);
  }
  g.restore();
}

function drawKart(g, b, camA, isGhost) {
  const { s, o } = b;
  if (s.fade < 1 && !o.isPlayer) { g.save(); g.globalAlpha = s.fade; drawKartInner(g, b, camA, isGhost); g.restore(); return; }
  drawKartInner(g, b, camA, isGhost);
}

function drawKartInner(g, b, camA, isGhost) {
  const { s, o } = b;
  const rel = o.angle - camA;
  let ai = Math.round((((rel % TWO_PI) + TWO_PI) % TWO_PI) / TWO_PI * ANGLES) % ANGLES;
  const set = kartSprites[o.def.id];
  if (!set) return;
  const img = set[ai];

  /* KART_ON_SCREEN is the kart's height in world units as far as the
     projection is concerned. It is smaller than the sprite's true
     footprint on purpose: drawn at literal scale the player's own kart
     fills half the screen and you cannot see the corner you are about
     to take. A quarter of the screen height is the SNES proportion. */
  const h = 21 * s.scale;
  const w = h * (img.width / img.height);
  if (w < 1.5) return;

  shadowUnder(g, s.sx, s.sy, w * 0.5);

  g.save();
  if (isGhost) g.globalAlpha = 0.4;
  /* the ring makes you flash; a spin makes you wobble */
  if (!isGhost && o.invuln > 0 && Math.floor(o.invuln * 12) % 2) g.globalAlpha = 0.55;
  if (!isGhost && o.spin > 0) {
    g.translate(s.sx, s.sy);
    g.rotate(Math.sin(o.spin * 22) * 0.22);
    g.translate(-s.sx, -s.sy);
  }
  g.drawImage(img, s.sx - w / 2, s.sy - h, w, h);
  g.restore();

  /* the bouquet orbits whoever is holding it */
  if (!isGhost && o.shield > 0) {
    for (let i = 0; i < 3; i++) {
      const t = raceTime * 3 + (i / 3) * TWO_PI;
      const ox = Math.cos(t) * w * 0.55, oy = Math.sin(t) * w * 0.2;
      const hr = w * 0.13;
      g.fillStyle = "#ff9ec4";
      g.beginPath();
      g.moveTo(s.sx + ox, s.sy - h * 0.55 + oy + hr);
      g.bezierCurveTo(s.sx + ox - hr * 1.5, s.sy - h * 0.55 + oy - hr * 0.2,
                      s.sx + ox - hr,       s.sy - h * 0.55 + oy - hr * 1.4,
                      s.sx + ox,            s.sy - h * 0.55 + oy - hr * 0.5);
      g.bezierCurveTo(s.sx + ox + hr,       s.sy - h * 0.55 + oy - hr * 1.4,
                      s.sx + ox + hr * 1.5, s.sy - h * 0.55 + oy - hr * 0.2,
                      s.sx + ox,            s.sy - h * 0.55 + oy + hr);
      g.fill();
    }
  }
  /* the ring's sparkle */
  if (!isGhost && o.invuln > 0) {
    for (let i = 0; i < 4; i++) {
      const t = raceTime * 7 + i * 1.6;
      g.fillStyle = i % 2 ? "#ffd166" : "#fff8e8";
      const px = s.sx + Math.cos(t) * w * 0.7;
      const py = s.sy - h * 0.5 + Math.sin(t * 1.3) * h * 0.4;
      const q = Math.max(1, w * 0.07);
      g.fillRect(px - q / 2, py - q / 2, q, q);
    }
  }
}

function drawFx(g, b) {
  const { s, o } = b;
  const q = Math.max(1, o.size * s.scale * 0.5);
  const a = Math.max(0, o.life / o.max);
  g.globalAlpha = a;
  g.fillStyle = o.col;
  g.fillRect(s.sx - q / 2, s.sy - o.z * s.scale - q / 2, q, q);
  g.globalAlpha = 1;
}

function drawSpeedLines(g, boost) {
  const n = 16;
  g.globalAlpha = Math.min(0.5, boost * 0.4);
  g.strokeStyle = "#fff8e8";
  g.lineWidth = 1;
  for (let i = 0; i < n; i++) {
    const t = (i / n) * TWO_PI + raceTime * 6;
    const r0 = RW * 0.28, r1 = RW * (0.4 + Math.random() * 0.2);
    const cx = RW / 2, cy = HORIZON + 46;
    g.beginPath();
    g.moveTo(cx + Math.cos(t) * r0, cy + Math.sin(t) * r0 * 0.6);
    g.lineTo(cx + Math.cos(t) * r1, cy + Math.sin(t) * r1 * 0.6);
    g.stroke();
  }
  g.globalAlpha = 1;
}

/* =========================================================
   16. HUD  (DOM, in Press Start 2P and cqw units — canvas text at this
   resolution is unreadable, which is the same reason the platformer
   keeps its dialogue in the DOM)
   ========================================================= */
let el = {};
function grabEls() {
  const id = (s) => document.getElementById(s);
  el = {
    stage: id("race-stage"), hud: id("rc-hud"), lap: id("rc-lap"),
    time: id("rc-time"), pos: id("rc-pos"), posNum: id("rc-pos-n"),
    posSuf: id("rc-pos-s"), item: id("rc-item"), itemCvs: id("rc-item-cvs"),
    map: id("rc-map"), boost: id("rc-boost"), boostFill: id("rc-boost-f"),
    count: id("rc-count"), banner: id("rc-banner"), overlay: id("rc-overlay"),
    tut: id("rc-tut"),
    pad: id("rc-pad"), pause: id("rc-pause-btn"),
  };
}
function showHud(on) {
  if (!el.hud) return;
  el.hud.hidden = !on;
  if (el.pad) el.pad.hidden = !on;
  if (el.pause) el.pause.hidden = !on;
}
function setCount(t) { if (el.count) { el.count.textContent = t; el.count.hidden = !t; } }
function setBanner(t) { if (el.banner) { el.banner.textContent = t; el.banner.hidden = !t; } }

function fmt(t) {
  const m = Math.floor(t / 60), s = Math.floor(t % 60), c = Math.floor((t * 100) % 100);
  return m + ":" + String(s).padStart(2, "0") + "." + String(c).padStart(2, "0");
}

function paintCount() {
  const n = Math.ceil(countdown - 0.9);
  if (countdown > 0.9) setCount(String(Math.max(1, Math.min(3, n))));
  else setCount("GO!");
  if (el.count) el.count.dataset.go = countdown <= 0.9 ? "1" : "0";
}

function paintHud() {
  const me = racers.find((r) => r.isPlayer);
  if (!me || !el.lap) return;
  if (el.hud) el.hud.dataset.mode = mode === "tutorial" ? "tutorial" : "race";
  if (mode === "tutorial") {
    el.time.textContent = fmt(raceTime);
    paintItem();
    drawMini();
    if (el.boost) {
      const on = me.drifting && me.driftCharge > 0.1;
      el.boost.hidden = !on;
      if (on) {
        el.boostFill.style.width = (Math.min(1, me.driftCharge / 1.7) * 100) + "%";
        el.boost.dataset.tier = me.driftCharge > 1.7 ? "3" : me.driftCharge > 1.0 ? "2" : "1";
      }
    }
    return;
  }
  el.lap.textContent = Math.max(1, Math.min(me.lap + 1, trackDef.laps)) + "/" + trackDef.laps;
  el.time.textContent = fmt(raceTime);
  if (el.posNum) {
    el.posNum.textContent = me.place;
    el.posSuf.textContent = ["ST","ND","RD","TH","TH","TH","TH","TH"][Math.min(me.place - 1, 7)];
    el.pos.dataset.p = Math.min(me.place, 4);
  }
  if (el.boost) {
    const on = me.drifting && me.driftCharge > 0.1;
    el.boost.hidden = !on;
    if (on) {
      const f = Math.min(1, me.driftCharge / 1.7);
      el.boostFill.style.width = (f * 100) + "%";
      el.boost.dataset.tier = me.driftCharge > 1.7 ? "3" : me.driftCharge > 1.0 ? "2" : "1";
    }
  }
  paintItem();
  drawMini();
}

let lastItem = "__";
function paintItem() {
  const me = racers.find((r) => r.isPlayer);
  if (!me || !el.itemCvs) return;
  if (me.item === lastItem) return;
  lastItem = me.item;
  el.item.dataset.empty = me.item ? "0" : "1";
  const g = el.itemCvs.getContext("2d");
  const S = el.itemCvs.width;
  g.clearRect(0, 0, S, S);
  if (!me.item) return;
  drawItemIcon(g, me.item, S);
}

function drawItemIcon(g, kind, S) {
  const c = S / 2;
  g.save();
  g.translate(c, c);
  const heart = (r, col) => {
    g.fillStyle = col;
    g.beginPath();
    g.moveTo(0, r * 0.85);
    g.bezierCurveTo(-r * 1.5, -r * 0.1, -r, -r * 1.35, 0, -r * 0.5);
    g.bezierCurveTo(r, -r * 1.35, r * 1.5, -r * 0.1, 0, r * 0.85);
    g.fill();
  };
  if (kind === "letter") {
    g.fillStyle = "#fff8e8"; g.fillRect(-13, -9, 26, 18);
    g.strokeStyle = "#e8b9c4"; g.lineWidth = 2;
    g.beginPath(); g.moveTo(-13, -9); g.lineTo(0, 2); g.lineTo(13, -9); g.stroke();
    heart(4, "#ff5f95");
  } else if (kind === "arrow") {
    g.rotate(-0.5);
    g.fillStyle = "#c98f68"; g.fillRect(-14, -1.5, 24, 3);
    g.fillStyle = "#ff5f95";
    g.beginPath(); g.moveTo(16, 0); g.lineTo(7, -6); g.lineTo(7, 6); g.fill();
    g.fillStyle = "#fff1e0";
    g.beginPath(); g.moveTo(-14, 0); g.lineTo(-8, -6); g.lineTo(-6, 0); g.lineTo(-8, 6); g.fill();
  } else if (kind === "heart") {
    heart(12, "#ff7f8a");
    g.fillStyle = "rgba(255,255,255,.5)"; g.fillRect(-6, -7, 4, 6);
  } else if (kind === "rose") {
    g.fillStyle = "#3f7a3f"; g.fillRect(-1.5, 0, 3, 15);
    g.fillStyle = "#2f6b30";
    g.beginPath(); g.moveTo(1, 5); g.lineTo(9, 2); g.lineTo(1, 9); g.fill();
    heart(0, "#e8556f");
    g.fillStyle = "#e8556f"; g.beginPath(); g.arc(0, -4, 9, 0, TWO_PI); g.fill();
    g.fillStyle = "#ff9ec4"; g.beginPath(); g.arc(-2, -6, 4.5, 0, TWO_PI); g.fill();
  } else if (kind === "bouquet") {
    for (let i = 0; i < 3; i++) {
      const t = -Math.PI / 2 + (i - 1) * 0.9;
      g.save(); g.translate(Math.cos(t) * 9, Math.sin(t) * 9 + 2); heart(6, "#ff9ec4"); g.restore();
    }
    g.fillStyle = "#3f7a3f"; g.fillRect(-2, 6, 4, 12);
  } else if (kind === "ring") {
    g.strokeStyle = "#ffd166"; g.lineWidth = 4;
    g.beginPath(); g.arc(0, 4, 10, 0, TWO_PI); g.stroke();
    g.fillStyle = "#fff8e8";
    g.beginPath(); g.moveTo(0, -14); g.lineTo(5, -7); g.lineTo(-5, -7); g.fill();
    g.fillStyle = "#ffe07a";
    g.beginPath(); g.arc(0, -10, 3.4, 0, TWO_PI); g.fill();
  }
  g.restore();
}

/* the little course map, with a dot per racer */
function drawMini() {
  if (!el.map || !path.length) return;
  const g = el.map.getContext("2d");
  const S = el.map.width;
  g.clearRect(0, 0, S, S);

  const pad = 10;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const extent = cut ? path.concat(cut.pts) : path;
  for (const p of extent) {
    if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y; if (p.y > maxY) maxY = p.y;
  }
  const sc = Math.min((S - pad * 2) / (maxX - minX), (S - pad * 2) / (maxY - minY));
  const ox = pad + ((S - pad * 2) - (maxX - minX) * sc) / 2;
  const oy = pad + ((S - pad * 2) - (maxY - minY) * sc) / 2;
  const M = (p) => ({ x: ox + (p.x - minX) * sc, y: oy + (p.y - minY) * sc });

  /* the dark casing is what keeps the map legible over a bright track
     as well as a dark one */
  g.lineJoin = g.lineCap = "round";
  g.strokeStyle = "rgba(16,8,22,.78)"; g.lineWidth = 10;
  g.beginPath();
  path.forEach((p, i) => { const m = M(p); i ? g.lineTo(m.x, m.y) : g.moveTo(m.x, m.y); });
  g.closePath(); g.stroke();

  g.strokeStyle = "rgba(255,248,232,.85)"; g.lineWidth = 5;
  g.beginPath();
  path.forEach((p, i) => { const m = M(p); i ? g.lineTo(m.x, m.y) : g.moveTo(m.x, m.y); });
  g.closePath(); g.stroke();

  /* the shortcut, dashed, so she can see there is another way round */
  if (cut) {
    g.setLineDash([4, 4]);
    g.strokeStyle = "rgba(255,209,102,.9)"; g.lineWidth = 3;
    g.beginPath();
    cut.pts.forEach((p, i) => { const m = M(p); i ? g.lineTo(m.x, m.y) : g.moveTo(m.x, m.y); });
    g.stroke();
    g.setLineDash([]);
  }

  const s0 = M(path[0]);
  g.fillStyle = "#26202a"; g.fillRect(s0.x - 3, s0.y - 3, 6, 6);
  g.fillStyle = "#fff8e8"; g.fillRect(s0.x - 3, s0.y - 3, 3, 3); g.fillRect(s0.x, s0.y, 3, 3);

  racers.forEach((r) => {
    const m = M(r);
    g.fillStyle = r.isPlayer ? "#fff8e8" : r.def.kart;
    g.beginPath(); g.arc(m.x, m.y, r.isPlayer ? 4.5 : 3.2, 0, TWO_PI); g.fill();
    if (r.isPlayer) {
      g.strokeStyle = r.def.accent; g.lineWidth = 2;
      g.beginPath(); g.arc(m.x, m.y, 6, 0, TWO_PI); g.stroke();
    }
  });
}

/* =========================================================
   17. MENUS  (also DOM — pixel cards, same language as the hub)
   ========================================================= */
function setOverlay(html, cls) {
  if (!el.overlay) return;
  el.overlay.innerHTML = html;
  el.overlay.className = "rc-overlay" + (html ? " on" : "") + (cls ? " " + cls : "");
  el.overlay.setAttribute("aria-hidden", html ? "false" : "true");
}

function renderTitle() {
  state = "title";
  showHud(false);
  Snd.engineOff();
  Snd.drift(false);
  Snd.music("menu");
  setOverlay(`
    <div class="rc-title">
      <p class="rc-logo"><span>SUPER</span><b>OUISSY</b><i>RACE</i></p>
      <p class="rc-tag">Two racers. Four memories. One finish line — and we cross it together.</p>
      <div class="rc-menu">
        <button class="rc-btn" data-go="single">SINGLE RACE</button>
        <button class="rc-btn" data-go="gp">GRAND PRIX</button>
        <button class="rc-btn" data-go="trial">TIME TRIAL</button>
        <button class="rc-btn rc-btn-s" data-tut="1">HOW TO RACE</button>
        <button class="rc-btn rc-btn-s" data-settings="title">SOUND</button>
      </div>
      <div class="rc-diff">
        <span class="rc-diff-lab">DIFFICULTY</span>
        <div class="rc-diff-row">
          <button class="rc-dbtn" data-diff="0">EASY</button>
          <button class="rc-dbtn" data-diff="1">NORMAL</button>
          <button class="rc-dbtn" data-diff="2">HARD</button>
        </div>
      </div>
      <button class="rc-quit" data-quit="1">‹ back to the hub</button>
    </div>`, "rc-ov-title");
  markDiff();
}
function markDiff() {
  if (!el.overlay) return;
  el.overlay.querySelectorAll(".rc-dbtn").forEach((b) => {
    b.classList.toggle("on", +b.dataset.diff === difficulty);
  });
}

function renderChars() {
  state = "chars";
  const cards = CHARS.slice(0, 2).map((c, i) => `
    <button class="rc-card rc-char${i === playerCharIdx ? " sel" : ""}" data-char="${i}">
      <span class="rc-card-art" data-art="char" data-i="${i}"></span>
      <span class="rc-card-name">${c.name}</span>
      <span class="rc-card-sub">${c.fit}</span>
    </button>`).join("");
  setOverlay(`
    <div class="rc-panel">
      <h3 class="rc-h">CHOOSE YOUR RACER</h3>
      <div class="rc-cards rc-cards-2">${cards}</div>
      <div class="rc-row">
        <button class="rc-btn rc-btn-s" data-back="title">‹ BACK</button>
        <button class="rc-btn rc-btn-go" data-next="chars">GO ›</button>
      </div>
    </div>`, "rc-ov-panel");
  paintCardArt();
}

function renderTracks() {
  state = "tracks";
  const cards = TRACKS.map((t, i) => {
    const best = loadBest(t.id);
    return `
    <button class="rc-card rc-track${i === trackIdx ? " sel" : ""}" data-track="${i}">
      <span class="rc-card-art" data-art="track" data-i="${i}"></span>
      <span class="rc-card-name">${t.name}</span>
      <span class="rc-card-sub">${t.laps} LAPS${best ? " · BEST " + fmt(best) : ""}</span>
    </button>`;
  }).join("");
  setOverlay(`
    <div class="rc-panel">
      <h3 class="rc-h">CHOOSE YOUR TRACK</h3>
      <div class="rc-cards rc-cards-4">${cards}</div>
      <p class="rc-blurb" id="rc-blurb">${TRACKS[trackIdx].blurb}</p>
      <div class="rc-row">
        <button class="rc-btn rc-btn-s" data-back="chars">‹ BACK</button>
        <button class="rc-btn rc-btn-go" data-next="tracks">START ›</button>
      </div>
    </div>`, "rc-ov-panel");
  paintCardArt();
}

/* the little pictures on the cards are drawn, like everything else */
function paintCardArt() {
  if (!el.overlay) return;
  el.overlay.querySelectorAll("[data-art]").forEach((span) => {
    const c = document.createElement("canvas");
    c.width = 120; c.height = 84;
    const g = c.getContext("2d");
    g.imageSmoothingEnabled = false;
    const i = +span.dataset.i;

    if (span.dataset.art === "char") {
      const def = CHARS[i];
      const grad = g.createLinearGradient(0, 0, 0, 84);
      grad.addColorStop(0, mix(def.kart, "#fff8e8", 0.55));
      grad.addColorStop(1, mix(def.accent, "#2a1840", 0.35));
      g.fillStyle = grad; g.fillRect(0, 0, 120, 84);
      const spr = kartSprites[def.id][0];
      const h = 74, w = h * (spr.width / spr.height);
      g.drawImage(spr, 60 - w / 2, 82 - h, w, h);
    } else {
      const t = TRACKS[i];
      const grad = g.createLinearGradient(0, 0, 0, 84);
      grad.addColorStop(0, t.sky[0]);
      grad.addColorStop(1, t.grass);
      g.fillStyle = grad; g.fillRect(0, 0, 120, 84);

      /* a thumbnail of the actual loop, not a stand-in */
      const pts = t.pts;
      let mnx = 1, mny = 1, mxx = 0, mxy = 0;
      pts.forEach((p) => {
        mnx = Math.min(mnx, p[0]); mxx = Math.max(mxx, p[0]);
        mny = Math.min(mny, p[1]); mxy = Math.max(mxy, p[1]);
      });
      const sc = Math.min(96 / (mxx - mnx), 60 / (mxy - mny));
      const ox = (120 - (mxx - mnx) * sc) / 2, oy = (84 - (mxy - mny) * sc) / 2;
      const M = (p) => [ox + (p[0] - mnx) * sc, oy + (p[1] - mny) * sc];
      g.lineJoin = g.lineCap = "round";
      g.strokeStyle = "rgba(20,10,26,.45)"; g.lineWidth = 9;
      g.beginPath(); pts.forEach((p, k) => { const m = M(p); k ? g.lineTo(m[0], m[1]) : g.moveTo(m[0], m[1]); });
      g.closePath(); g.stroke();
      g.strokeStyle = t.rumbleA; g.lineWidth = 7;
      g.beginPath(); pts.forEach((p, k) => { const m = M(p); k ? g.lineTo(m[0], m[1]) : g.moveTo(m[0], m[1]); });
      g.closePath(); g.stroke();
      g.strokeStyle = "#fff8e8"; g.lineWidth = 4;
      g.beginPath(); pts.forEach((p, k) => { const m = M(p); k ? g.lineTo(m[0], m[1]) : g.moveTo(m[0], m[1]); });
      g.closePath(); g.stroke();
    }
    span.appendChild(c);
  });
}

function renderResults() {
  const me = racers.find((r) => r.isPlayer);
  const sorted = [...racers].sort((a, b) => a.place - b.place);

  /* the podium: three blocks, and everyone else listed under it */
  const podiumOrder = [1, 0, 2];   // 2nd, 1st, 3rd — left to right
  const podium = podiumOrder.map((k) => {
    const r = sorted[k];
    if (!r) return "";
    return `<div class="rc-pod rc-pod-${k + 1}">
      <span class="rc-pod-art" data-pod="${CHARS.indexOf(r.def)}"></span>
      <span class="rc-pod-block"><b>${k + 1}</b></span>
      <span class="rc-pod-name">${r.def.name}</span>
    </div>`;
  }).join("");

  const rest = sorted.slice(3).map((r) => `
    <li${r.isPlayer ? ' class="me"' : ""}><b>${r.place}</b><span>${r.def.name}</span><i>${fmt(r.finishTime)}</i></li>`).join("");

  let msg;
  if (mode === "trial") {
    const best = loadBest(trackDef.id);
    msg = `Your time: ${fmt(me.finishTime)}${best ? ` · best ${fmt(best)}` : ""}`;
  } else if (me.place === 1) {
    msg = "First across — but you'd have waited at the line anyway.";
  } else if (me.place <= 3) {
    msg = "On the podium, and still the best company on the grid.";
  } else {
    msg = "Every lap was worth it. Same time tomorrow?";
  }

  const isGP = mode === "gp";
  const more = isGP && gpRound < TRACKS.length - 1;
  const total = gpPoints.reduce((a, b) => a + (b || 0), 0);

  setOverlay(`
    <div class="rc-panel rc-res">
      <h3 class="rc-h">${isGP ? "ROUND " + (gpRound + 1) + " OF " + TRACKS.length : "RESULTS"}</h3>
      <div class="rc-podium">${podium}</div>
      <ol class="rc-rest">${rest}</ol>
      ${isGP ? `<p class="rc-points">GRAND PRIX POINTS · ${total}</p>` : ""}
      <p class="rc-msg">${msg}</p>
      <div class="rc-row">
        <button class="rc-btn rc-btn-s" data-back="title">MENU</button>
        <button class="rc-btn rc-btn-go" data-next="${more ? "gpnext" : isGP ? "gpend" : "again"}">
          ${more ? "NEXT TRACK ›" : isGP ? "FINISH ›" : "RACE AGAIN ›"}
        </button>
      </div>
    </div>`, "rc-ov-panel");

  el.overlay.querySelectorAll("[data-pod]").forEach((span) => {
    const def = CHARS[+span.dataset.pod];
    const c = document.createElement("canvas");
    c.width = 64; c.height = 56;
    const g = c.getContext("2d");
    g.imageSmoothingEnabled = false;
    g.drawImage(kartSprites[def.id][8], 0, 0);   // facing the camera
    span.appendChild(c);
  });
}

/* the Grand Prix closer: both of them over the line at once */
function renderGPEnd() {
  state = "gpboard";
  const total = gpPoints.reduce((a, b) => a + (b || 0), 0);
  markDone();
  setOverlay(`
    <div class="rc-panel rc-fin">
      <h3 class="rc-h">GRAND PRIX COMPLETE</h3>
      <div class="rc-fin-art" id="rc-fin-art"></div>
      <p class="rc-points">${total} POINTS ACROSS ${TRACKS.length} TRACKS</p>
      <p class="rc-msg rc-msg-big">
        No winner today. You crossed the line together, on the roof,
        with the whole city lit up behind you — which was always the point.
      </p>
      <div class="rc-row">
        <button class="rc-btn rc-btn-go" data-back="title">‹ MENU</button>
        <button class="rc-quit" data-quit="1">back to the hub</button>
      </div>
    </div>`, "rc-ov-panel rc-ov-fin");

  /* a small drawn curtain call, with confetti */
  const host = document.getElementById("rc-fin-art");
  if (!host) return;
  const c = document.createElement("canvas");
  c.width = 320; c.height = 120;
  const g = c.getContext("2d");
  g.imageSmoothingEnabled = false;
  const grad = g.createLinearGradient(0, 0, 0, 120);
  grad.addColorStop(0, "#ff8a5c"); grad.addColorStop(1, "#ffd08a");
  g.fillStyle = grad; g.fillRect(0, 0, 320, 120);
  g.fillStyle = "rgba(38,32,58,.85)";
  for (let x = 0; x < 320; x += 26) g.fillRect(x, 74 - (x % 3) * 9, 20, 50);
  g.fillStyle = "#6d5a49"; g.fillRect(0, 104, 320, 16);
  for (let i = 0; i < 10; i++) {
    g.fillStyle = (i % 2) ? "#26202a" : "#fff8e8";
    g.fillRect(120 + i * 8, 100, 8, 6);
  }
  const a = kartSprites[CHARS[0].id][8], b = kartSprites[CHARS[1].id][8];
  g.drawImage(a, 112, 44, 64, 56);
  g.drawImage(b, 152, 44, 64, 56);
  const rnd = mulberry(99);
  for (let i = 0; i < 70; i++) {
    g.fillStyle = ["#ff7f8a","#ffd166","#7ec8e3","#7ddba3","#fff8e8"][(rnd()*5)|0];
    g.fillRect((rnd()*320)|0, (rnd()*100)|0, 3, 4);
  }
  host.appendChild(c);
}

function renderPause() {
  state = "paused";
  Snd.engineOff();
  Snd.drift(false);
  setOverlay(`
    <div class="rc-panel rc-pausep">
      <h3 class="rc-h">PAUSED</h3>
      <div class="rc-menu">
        <button class="rc-btn" data-resume="1">RESUME</button>
        <button class="rc-btn" data-restart="1">RESTART</button>
        <button class="rc-btn" data-settings="pause">SOUND</button>
        <button class="rc-btn" data-tut="1">HOW TO RACE</button>
        <button class="rc-btn" data-back="title">QUIT TO MENU</button>
      </div>
    </div>`, "rc-ov-panel");
}

/* Sound settings. `from` remembers where we came in from, so closing
   goes back to the pause card rather than dumping you on the title. */
function renderSettings(from) {
  const pct = (v) => Math.round(v * 100);
  const row = (k, label) => `
    <label class="rc-slider">
      <span class="rc-slider-lab">${label}</span>
      <input type="range" min="0" max="100" value="${pct(Snd.vol[k])}" data-vol="${k}">
      <output data-out="${k}">${pct(Snd.vol[k])}</output>
    </label>`;
  setOverlay(`
    <div class="rc-panel">
      <h3 class="rc-h">SOUND</h3>
      <div class="rc-sliders">
        ${row("master", "MASTER")}
        ${row("music",  "MUSIC")}
        ${row("sfx",    "EFFECTS")}
      </div>
      <button class="rc-btn rc-btn-s" data-mute="1">${Snd.muted() ? "UNMUTE" : "MUTE ALL"}</button>
      <div class="rc-row">
        <button class="rc-btn rc-btn-go" data-closeset="${from}">‹ BACK</button>
      </div>
    </div>`, "rc-ov-panel");

  el.overlay.querySelectorAll("[data-vol]").forEach((sl) => {
    const k = sl.dataset.vol;
    const out = el.overlay.querySelector(`[data-out="${k}"]`);
    sl.addEventListener("input", () => {
      Snd.resume();
      Snd.setVol(k, sl.value / 100);
      out.textContent = sl.value;
    });
    /* a click on the track counts as a preview, so you hear the change */
    sl.addEventListener("change", () => Snd.click());
  });
}


/* =========================================================
   17b. AUDIO  (named Snd, so it does not shadow the DOM's Audio)

   All of it is synthesised here and now — oscillators, a noise buffer,
   and envelopes. Nothing is fetched, nothing is licensed, and the whole
   soundtrack costs a few hundred lines instead of a few megabytes.

   Chiptune in practice means: square and pulse waves for the melody,
   a triangle for the bass, filtered white noise for percussion, and
   hard little envelopes so every note has an edge on it.

   The context cannot start until she touches the page, so everything
   is written to be safe to call before that and to wake up on the
   first gesture.
   ========================================================= */
const Snd = (function () {
  let ctx = null, master = null, musicBus = null, sfxBus = null;
  let noiseBuf = null;
  let ready = false;
  let vol = { master: 0.75, music: 0.55, sfx: 0.8 };
  let muted = false;

  /* the running engine, kept alive between calls */
  let engine = null;
  let driftNode = null;
  let song = null;          // the scheduler for whatever is playing

  try {
    const saved = JSON.parse(localStorage.getItem("sor_vol") || "null");
    if (saved) vol = Object.assign(vol, saved);
    muted = localStorage.getItem("sor_mute") === "1";
  } catch (e) {}

  function save() {
    try {
      localStorage.setItem("sor_vol", JSON.stringify(vol));
      localStorage.setItem("sor_mute", muted ? "1" : "0");
    } catch (e) {}
  }

  function init() {
    if (ctx) return true;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
    master = ctx.createGain();
    musicBus = ctx.createGain();
    sfxBus = ctx.createGain();
    musicBus.connect(master); sfxBus.connect(master);
    master.connect(ctx.destination);

    /* one second of white noise, reused for every percussive sound */
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;

    applyVol();
    ready = true;
    return true;
  }

  function resume() {
    if (!init()) return;
    if (ctx.state === "suspended") ctx.resume();
  }

  function applyVol() {
    if (!ctx) return;
    master.gain.value = muted ? 0 : vol.master;
    musicBus.gain.value = vol.music;
    sfxBus.gain.value = vol.sfx;
  }

  /* ---- primitives ---- */

  /* a pulse wave, which is the sound the NES actually made. Built from
     a periodic wave so the duty cycle is real rather than a filtered
     square pretending. */
  const waveCache = {};
  function pulseWave(duty) {
    const key = duty.toFixed(2);
    if (waveCache[key]) return waveCache[key];
    const n = 32;
    const re = new Float32Array(n), im = new Float32Array(n);
    for (let i = 1; i < n; i++) {
      re[i] = (2 / (i * Math.PI)) * Math.sin(Math.PI * i * duty);
    }
    const w = ctx.createPeriodicWave(re, im, { disableNormalization: false });
    waveCache[key] = w;
    return w;
  }

  function tone(opt) {
    if (!ready) return null;
    const t0 = opt.at != null ? opt.at : ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    if (opt.duty) o.setPeriodicWave(pulseWave(opt.duty));
    else o.type = opt.type || "square";
    o.frequency.setValueAtTime(opt.f, t0);
    if (opt.f2) o.frequency.exponentialRampToValueAtTime(Math.max(1, opt.f2), t0 + opt.dur);
    const peak = opt.gain != null ? opt.gain : 0.2;
    const atk = opt.atk != null ? opt.atk : 0.005;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(peak, t0 + atk);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + opt.dur);
    o.connect(g); g.connect(opt.bus || sfxBus);
    o.start(t0); o.stop(t0 + opt.dur + 0.02);
    return { o, g };
  }

  function noise(opt) {
    if (!ready) return null;
    const t0 = opt.at != null ? opt.at : ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = opt.filter || "bandpass";
    f.frequency.setValueAtTime(opt.f, t0);
    if (opt.f2) f.frequency.exponentialRampToValueAtTime(Math.max(40, opt.f2), t0 + opt.dur);
    f.Q.value = opt.q != null ? opt.q : 1;
    const g = ctx.createGain();
    const peak = opt.gain != null ? opt.gain : 0.2;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(peak, t0 + (opt.atk || 0.004));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + opt.dur);
    src.connect(f); f.connect(g); g.connect(opt.bus || sfxBus);
    src.start(t0); src.stop(t0 + opt.dur + 0.02);
    return { src, g, f };
  }

  /* ---- the songs ----

     Each track gets a mood, written as note names over a chord loop.
     A tiny scheduler walks a bar ahead of the clock, which is what keeps
     the loop seamless — waiting on setInterval alone drifts and clicks. */
  const NOTE = { C:0, "C#":1, D:2, "D#":3, E:4, F:5, "F#":6, G:7, "G#":8, A:9, "A#":10, B:11 };
  function hz(name) {
    const m = /^([A-G]#?)(-?\d)$/.exec(name);
    if (!m) return 0;
    return 440 * Math.pow(2, (NOTE[m[1]] + (+m[2] - 4) * 12 - 9) / 12);
  }

  /* "-" holds, "." rests */
  const SONGS = {
    menu: {
      bpm: 104, duty: 0.5,
      lead:"E4 . G4 A4 - . B4 A4 G4 . E4 . D4 . E4 . " +
           "C5 . B4 A4 - . G4 A4 B4 . A4 . G4 . E4 . ",
      bass:"A2 - E2 - F2 - C3 - G2 - D2 - A2 - E2 - " +
           "A2 - E2 - F2 - C3 - G2 - E2 - A2 - - - ",
      drums:"k . h . s . h . k . h . s . h h ",
    },
    woods: {
      bpm: 132, duty: 0.5,
      lead:"E4 G4 A4 B4 - A4 G4 A4 E4 G4 A4 C5 - B4 A4 G4 " +
           "D4 F4 A4 B4 - A4 F4 A4 E4 G4 B4 A4 - G4 E4 D4 ",
      bass:"E2 - E3 - A2 - A3 - D2 - D3 - E2 - B2 - " +
           "E2 - E3 - A2 - A3 - G2 - D3 - E2 - E3 - ",
      drums:"k h s h k h s h k h s h k h s s ",
    },
    town: {
      bpm: 124, duty: 0.25,
      lead:"C4 E4 G4 - E4 G4 C5 - B4 G4 E4 - D4 E4 G4 - " +
           "F4 A4 C5 - A4 C5 F5 - E5 C5 A4 - G4 E4 C4 - ",
      bass:"C2 - G2 - C2 - G2 - F2 - C3 - F2 - G2 - " +
           "C2 - G2 - A2 - E3 - F2 - G2 - C2 - - - ",
      drums:"k . s . k . s . k . s . k k s . ",
    },
    ward: {
      bpm: 116, duty: 0.5,
      lead:"G4 - B4 - D5 - B4 - C5 - A4 - G4 - - - " +
           "A4 - C5 - E5 - C5 - D5 - B4 - G4 - - - ",
      bass:"G2 - D3 - G2 - D3 - C3 - G2 - C3 - D3 - " +
           "G2 - D3 - E3 - B2 - C3 - D3 - G2 - - - ",
      drums:"k . h . s . h . k . h . s . h . ",
    },
    roof: {
      bpm: 108, duty: 0.35,
      lead:"A4 - C5 D5 - E5 - D5 C5 - A4 - G4 - A4 - " +
           "F4 - A4 C5 - D5 - C5 A4 - G4 - E4 - D4 - ",
      bass:"A2 - E3 - F2 - C3 - G2 - D3 - A2 - E3 - " +
           "F2 - C3 - G2 - D3 - A2 - - - - - - - ",
      drums:"k . h . s . h k . h s . k . s h ",
    },
  };

  function parse(s) { return s.trim().split(/\s+/); }

  function playSong(name) {
    if (!ready) { song = { pending: name }; return; }
    if (song && song.name === name && !song.stopped) return;
    stopSong();
    const def = SONGS[name];
    if (!def) return;
    const lead = parse(def.lead), bass = parse(def.bass), drums = parse(def.drums);
    const steps = Math.max(lead.length, bass.length);
    const spb = 60 / def.bpm / 4;          // one sixteenth
    song = { name, stopped: false, step: 0, next: ctx.currentTime + 0.06, timer: 0 };

    const gain = ctx.createGain();
    gain.gain.value = 0.5;
    gain.connect(musicBus);
    song.gain = gain;

    function schedule() {
      if (!song || song.stopped) return;
      while (song.next < ctx.currentTime + 0.25) {
        const i = song.step % steps;
        const t = song.next;

        const L = lead[i % lead.length];
        if (L && L !== "-" && L !== ".") {
          tone({ f: hz(L), dur: spb * 2.6, gain: 0.13, duty: def.duty, at: t, bus: gain });
        }
        const B = bass[i % bass.length];
        if (B && B !== "-" && B !== ".") {
          tone({ f: hz(B), dur: spb * 3.2, gain: 0.20, type: "triangle", at: t, bus: gain });
        }
        const D = drums[i % drums.length];
        if (D === "k") {
          tone({ f: 130, f2: 42, dur: 0.13, gain: 0.32, type: "sine", at: t, bus: gain });
        } else if (D === "s") {
          noise({ f: 1500, q: 0.8, dur: 0.11, gain: 0.11, at: t, bus: gain });
        } else if (D === "h") {
          noise({ f: 7200, q: 1.4, dur: 0.035, gain: 0.045, at: t, bus: gain });
        }

        song.next += spb;
        song.step++;
      }
      song.timer = setTimeout(schedule, 60);
    }
    schedule();
  }

  function stopSong() {
    if (!song) return;
    song.stopped = true;
    if (song.timer) clearTimeout(song.timer);
    if (song.gain) {
      try {
        song.gain.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.08);
        const g = song.gain;
        setTimeout(() => { try { g.disconnect(); } catch (e) {} }, 600);
      } catch (e) {}
    }
    song = null;
  }

  /* ---- the engine, which never stops while a race is running ---- */
  function engineOn() {
    if (!ready || engine) return;
    const o = ctx.createOscillator();
    o.setPeriodicWave(pulseWave(0.18));
    o.frequency.value = 60;
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass"; lp.frequency.value = 900;
    const g = ctx.createGain();
    g.gain.value = 0.0001;
    o.connect(lp); lp.connect(g); g.connect(sfxBus);
    o.start();
    engine = { o, g, lp };
  }
  function engineOff() {
    if (!engine) return;
    try {
      engine.g.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.05);
      const e = engine;
      setTimeout(() => { try { e.o.stop(); e.g.disconnect(); } catch (x) {} }, 300);
    } catch (e) {}
    engine = null;
  }
  /* frac 0..1 of top speed, load 0..1 for how hard it is working */
  function engineAt(frac, offroad) {
    if (!engine || !ready) return;
    const t = ctx.currentTime;
    const f = 48 + frac * 132;
    engine.o.frequency.setTargetAtTime(f, t, 0.05);
    engine.lp.frequency.setTargetAtTime(offroad ? 480 : 700 + frac * 900, t, 0.08);
    engine.g.gain.setTargetAtTime(0.035 + frac * 0.055, t, 0.06);
  }

  /* ---- tyres ---- */
  function driftSound(on) {
    if (!ready) return;
    if (on && !driftNode) {
      const src = ctx.createBufferSource();
      src.buffer = noiseBuf; src.loop = true;
      const f = ctx.createBiquadFilter();
      f.type = "bandpass"; f.frequency.value = 2200; f.Q.value = 3.5;
      const g = ctx.createGain();
      g.gain.value = 0.0001;
      src.connect(f); f.connect(g); g.connect(sfxBus);
      src.start();
      g.gain.setTargetAtTime(0.075, ctx.currentTime, 0.05);
      driftNode = { src, f, g };
    } else if (!on && driftNode) {
      const d = driftNode; driftNode = null;
      try {
        d.g.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.04);
        setTimeout(() => { try { d.src.stop(); d.g.disconnect(); } catch (x) {} }, 300);
      } catch (e) {}
    }
  }
  /* the charge climbing through its three tiers */
  function driftCharge(tier) {
    if (!driftNode || !ready) return;
    driftNode.f.frequency.setTargetAtTime(1600 + tier * 900, ctx.currentTime, 0.08);
  }

  /* ---- one-shots ---- */
  const S = {
    boost(tier) {
      const t = ctx ? ctx.currentTime : 0;
      tone({ f: 180 + tier * 90, f2: 900 + tier * 320, dur: 0.24, gain: 0.24, duty: 0.5, at: t });
      noise({ f: 900, f2: 4200, dur: 0.22, gain: 0.14, at: t });
      tone({ f: 520 + tier * 120, dur: 0.1, gain: 0.16, duty: 0.25, at: t + 0.02 });
    },
    pickup() {
      const t = ctx ? ctx.currentTime : 0;
      [660, 880, 1320].forEach((f, i) =>
        tone({ f, dur: 0.1, gain: 0.16, duty: 0.5, at: t + i * 0.055 }));
    },
    use(kind) {
      const t = ctx ? ctx.currentTime : 0;
      if (kind === "letter")      tone({ f: 500, f2: 1400, dur: 0.2, gain: 0.2, duty: 0.5, at: t });
      else if (kind === "arrow")  { tone({ f: 1200, f2: 420, dur: 0.28, gain: 0.18, duty: 0.25, at: t }); }
      else if (kind === "heart")  tone({ f: 780, f2: 560, dur: 0.16, gain: 0.18, duty: 0.5, at: t });
      else if (kind === "rose")   noise({ f: 700, f2: 240, dur: 0.2, gain: 0.16, at: t });
      else if (kind === "bouquet"){ [660,830,990].forEach((f,i)=>tone({f,dur:0.14,gain:0.13,duty:0.35,at:t+i*0.04})); }
      else if (kind === "ring")   { [523,659,784,1047,1319].forEach((f,i)=>tone({f,dur:0.3,gain:0.15,duty:0.5,at:t+i*0.06})); }
    },
    hit() {
      const t = ctx ? ctx.currentTime : 0;
      noise({ f: 420, f2: 90, dur: 0.3, gain: 0.28, filter: "lowpass", at: t });
      tone({ f: 190, f2: 55, dur: 0.26, gain: 0.2, type: "square", at: t });
    },
    scrape() {   /* the verge, while you are on it */
      if (!ready) return;
      noise({ f: 320, dur: 0.14, gain: 0.05, filter: "lowpass", q: 0.5 });
    },
    click() { tone({ f: 720, dur: 0.05, gain: 0.12, duty: 0.5 }); },
    hover() { tone({ f: 480, dur: 0.035, gain: 0.06, duty: 0.25 }); },
    beep(last) {
      const t = ctx ? ctx.currentTime : 0;
      if (last) {
        [523, 784, 1047].forEach((f, i) =>
          tone({ f, dur: 0.34, gain: 0.24, duty: 0.5, at: t + i * 0.045 }));
        noise({ f: 3000, f2: 800, dur: 0.3, gain: 0.14, at: t });
      } else {
        tone({ f: 440, dur: 0.16, gain: 0.2, duty: 0.5, at: t });
      }
    },
    lap() {
      const t = ctx ? ctx.currentTime : 0;
      [784, 1047].forEach((f, i) => tone({ f, dur: 0.16, gain: 0.18, duty: 0.5, at: t + i * 0.08 }));
    },
    tick() { tone({ f: 1400, dur: 0.03, gain: 0.07, duty: 0.25 }); },
    fanfare() {
      const t = ctx ? ctx.currentTime : 0;
      const notes = [523, 659, 784, 1047, 784, 1047, 1319];
      notes.forEach((f, i) =>
        tone({ f, dur: i === notes.length - 1 ? 0.7 : 0.17, gain: 0.2, duty: 0.5, at: t + i * 0.15 }));
      [0, 0.15, 0.3, 0.45].forEach((d) =>
        tone({ f: 131, dur: 0.14, gain: 0.18, type: "triangle", at: t + d }));
      /* a small crowd: filtered noise swelling under the last chord */
      noise({ f: 900, q: 0.4, dur: 1.6, gain: 0.09, atk: 0.5, at: t + 0.5 });
    },
  };

  /* every one-shot needs the context awake and must be harmless before */
  const api = {};
  ["boost","pickup","use","hit","scrape","click","hover","beep","lap","tick","fanfare"]
    .forEach((k) => { api[k] = (a) => { if (!ready) return; S[k](a); }; });

  api.resume = resume;
  api.music = (name) => { if (!ready) { init(); } if (ready) playSong(name); };
  api.stopMusic = stopSong;
  api.engineOn = () => { if (ready) engineOn(); };
  api.engineOff = engineOff;
  api.engine = engineAt;
  api.drift = driftSound;
  api.driftCharge = driftCharge;
  api.vol = vol;
  api.setVol = (k, v) => { vol[k] = v; applyVol(); save(); };
  api.muted = () => muted;
  api.setMuted = (m) => { muted = m; applyVol(); save(); };
  api.ready = () => ready;
  return api;
})();


/* =========================================================
   17c. HOW TO RACE

   A short practice loop on its own small track. Each step names one
   thing and then waits until she has actually done it — the drift step
   will not advance on a description of a drift, only on a drift. That
   is the whole point: you cannot skim past a mechanic you have not
   performed.

   It runs on the ordinary race loop, with the field emptied out and a
   watcher stepping the prompts, so nothing here is a second physics
   implementation that could drift away from the real one.
   ========================================================= */
const TUT_TRACK = {
  id:"tutorial", name:"Practice Loop", laps:99,
  blurb:"A quiet loop behind the cabin, with nobody watching.",
  grass:"#4f8f52", grassAlt:"#478248", shoulder:"#8a6b45",
  road:"#8f7a5e", roadAlt:"#877257", rumbleA:"#ff7f8a", rumbleB:"#fff8e8",
  sky:["#8fd0ea","#c9ecd8"], haze:"#bfe0d2", accent:"#7ddba3",
  light:-0.7,
  scenery:["pine","bush","rock","flowerbox","signpost","pine"],
  /* a soft oval with one long straight and two open bends — nothing
     here should be hard, it is a place to feel the kart */
  pts:[[0.50,0.80],[0.32,0.78],[0.20,0.68],[0.18,0.54],[0.24,0.42],
       [0.38,0.34],[0.54,0.32],[0.68,0.36],[0.78,0.46],[0.80,0.60],
       [0.72,0.72],[0.62,0.79]],
};

const TUT_STEPS = [
  { id:"gas",    title:"THE THROTTLE",
    body:"Hold {GAS} to go. It builds — the last of the speed takes a moment to arrive.",
    goal:"get up to speed" },
  { id:"brake",  title:"THE BRAKE",
    body:"{BRAKE} slows you. Let go of everything and you coast, you don't stop dead.",
    goal:"slow down again" },
  { id:"steer",  title:"STEERING",
    body:"{LEFT} and {RIGHT} turn the wheels; the kart leans in after them. Follow the bend.",
    goal:"take a corner" },
  { id:"drift",  title:"DRIFTING",
    body:"Hold {DRIFT} while you turn to slide. Sparks go blue, then gold, then pink.",
    goal:"hold a drift" },
  { id:"boost",  title:"THE MINI-TURBO",
    body:"Let {DRIFT} go while the sparks are lit and the slide pays you back a boost.",
    goal:"release for a boost" },
  { id:"item",   title:"HEART BOXES",
    body:"Drive through a heart box to pick something up.",
    goal:"collect an item" },
  { id:"use",    title:"USING IT",
    body:"{ITEM} sends it. A Love Letter shoves you forward; an arrow goes hunting.",
    goal:"use the item" },
  { id:"grass",  title:"OFF THE TARMAC",
    body:"The grass drags — you lose your top end and the steering goes vague. Stay on the road.",
    goal:"feel the grass" },
  { id:"done",   title:"THAT'S EVERYTHING",
    body:"That's the whole game. The rest is just which road we're on.",
    goal:null },
];

let tut = null;   // { i, held, doneAt } while the tutorial is running

function tutKeyName(tag) {
  const touch = el.pad && el.pad.dataset.want === "1";
  const map = touch
    ? { GAS:"GO", BRAKE:"BRAKE", LEFT:"◀", RIGHT:"▶", DRIFT:"DRIFT", ITEM:"ITEM" }
    : { GAS:"↑", BRAKE:"↓", LEFT:"←", RIGHT:"→", DRIFT:"SPACE", ITEM:"E" };
  return map[tag] || tag;
}

function startTutorial() {
  mode = "tutorial";
  trackDef = TUT_TRACK;
  buildPath(trackDef);
  placeProps(trackDef);
  bakeTrack(trackDef);
  bakePano(trackDef);

  /* one heart box on the straight, and nothing else to worry about */
  boxes = [];
  const n = path.length;
  for (let k = -1; k <= 1; k++) {
    const base = Math.floor(n * 0.42);
    const ta = tangentAt(base);
    boxes.push({
      x: path[base].x - Math.sin(ta) * k * 26,
      y: path[base].y + Math.cos(ta) * k * 26,
      alive: true, t: 0, spin: Math.random() * 8,
    });
  }

  shots = []; hazards = []; fx = [];
  raceTime = 0; countdown = 0; shake = 0; bannerT = 0; setBanner("");
  lastItem = "__"; lastPlace = 0;

  racers = [new Racer(CHARS[playerCharIdx], true, 0, 6)];
  racers[0].lap = 0;                 // no lap counting in here
  camAngle = racers[0].angle; camLag = 0; camFocal = FOCAL;

  tut = { i: 0, held: 0, cornered: 0, startAngle: racers[0].angle, seen: {} };
  state = "race";
  showHud(true);
  setOverlay("");
  Snd.resume();
  Snd.music("woods");
  Snd.engineOn();
  drawMini();
  paintTutStep();
}

function paintTutStep() {
  if (!tut) return;
  const st = TUT_STEPS[tut.i];
  if (!el.tut) return;
  const body = st.body.replace(/\{(\w+)\}/g, (_, t) => `<b>${tutKeyName(t)}</b>`);
  el.tut.innerHTML = `
    <div class="rc-bubble">
      <span class="rc-bubble-tag">${tut.i + 1}/${TUT_STEPS.length}</span>
      <h4>${st.title}</h4>
      <p>${body}</p>
      ${st.goal ? `<span class="rc-bubble-goal" id="rc-tut-goal">${st.goal}</span>`
                : `<button class="rc-btn rc-btn-go rc-bubble-btn" data-tutend="1">BACK TO THE MENU</button>`}
      <button class="rc-bubble-skip" data-tutskip="1">skip the lesson</button>
    </div>`;
  el.tut.hidden = false;
}

function tutSatisfied() { el.tut && el.tut.classList.add("ok"); }

/* watches the kart and ticks a step off once she has actually done it */
function stepTutorial(dt) {
  if (!tut) return;
  const me = racers[0];
  if (!me) return;
  if (tut.advancing) return;
  const st = TUT_STEPS[tut.i];
  if (!st || !st.goal) return;
  let hit = false;

  switch (st.id) {
    case "gas":
      if (me.speed > TOP_SPEED * 0.55) hit = true;
      break;
    case "brake":
      if (tut.seen.fast || me.speed > TOP_SPEED * 0.5) tut.seen.fast = true;
      if (tut.seen.fast && me.speed < TOP_SPEED * 0.16) hit = true;
      break;
    case "steer": {
      let d = me.angle - tut.startAngle;
      while (d >  Math.PI) d -= TWO_PI;
      while (d < -Math.PI) d += TWO_PI;
      if (Math.abs(d) > 1.05) hit = true;
      break;
    }
    case "drift":
      if (me.drifting) tut.held += dt; else tut.held = 0;
      if (tut.held > 0.75) hit = true;
      break;
    case "boost":
      if (me.boost > 0) hit = true;
      break;
    case "item":
      if (me.item) hit = true;
      break;
    case "use":
      if (tut.seen.hadItem && !me.item) hit = true;
      if (me.item) tut.seen.hadItem = true;
      break;
    case "grass":
      if (me.offroad) tut.held += dt; else tut.held = 0;
      if (tut.held > 0.5) hit = true;
      break;
  }

  if (hit) {
    tut.held = 0;
    tut.startAngle = me.angle;
    tut.advancing = true;         // the beat between "well done" and the next card
    tutSatisfied();
    Snd.lap();
    tut.wait = setTimeout(() => {
      if (!tut) return;
      tut.advancing = false;
      el.tut.classList.remove("ok");
      tut.i++;
      /* make sure a box is back for the item step */
      if (TUT_STEPS[tut.i] && TUT_STEPS[tut.i].id === "item")
        boxes.forEach((b) => { b.alive = true; b.t = 0; });
      if (TUT_STEPS[tut.i]) paintTutStep();
    }, 750);
  }
}

function endTutorial() {
  if (tut && tut.wait) clearTimeout(tut.wait);
  tut = null;
  if (el.tut) { el.tut.hidden = true; el.tut.classList.remove("ok"); el.tut.innerHTML = ""; }
  mode = "single";
  racers = [];
  state = "title";
  showHud(false);
  Snd.engineOff();
  Snd.drift(false);
  renderTitle();
}

/* =========================================================
   18. INPUT
   ========================================================= */
const input = { up:false, down:false, left:false, right:false, drift:false, itemPressed:false };
const KEYMAP = {
  ArrowUp:"up", w:"up", W:"up",
  ArrowDown:"down", s:"down", S:"down",
  ArrowLeft:"left", a:"left", A:"left",
  ArrowRight:"right", d:"right", D:"right",
  " ":"drift", Shift:"drift",
};

function onKey(e) {
  if (!running) return;
  const down = e.type === "keydown";
  const m = KEYMAP[e.key];
  if (m) { input[m] = down; e.preventDefault(); }
  if (!down) return;

  if (e.key === "e" || e.key === "E" || e.key === "Control") input.itemPressed = true;
  if (e.key === "Escape") {
    if (mode === "tutorial" && state === "race") { endTutorial(); return; }
    if (state === "race") renderPause();
    else if (state === "paused") { setOverlay(""); state = "race"; }
    else if (state === "chars") renderTitle();
    else if (state === "tracks") renderChars();
  }
  if (e.key === "Enter") {
    if (state === "title")  { mode = "single"; renderChars(); }
    else if (state === "chars")  next("chars");
    else if (state === "tracks") next("tracks");
    else if (state === "paused") { setOverlay(""); state = "race"; }
  }
  if (state === "chars" && (m === "left" || m === "right")) {
    playerCharIdx = m === "left" ? 0 : 1;
    renderChars();
  }
  if (state === "tracks" && m) {
    if (m === "left")  trackIdx = (trackIdx + TRACKS.length - 1) % TRACKS.length;
    if (m === "right") trackIdx = (trackIdx + 1) % TRACKS.length;
    if (m === "up")    trackIdx = (trackIdx + TRACKS.length - 2) % TRACKS.length;
    if (m === "down")  trackIdx = (trackIdx + 2) % TRACKS.length;
    renderTracks();
  }
}

function next(from) {
  if (from === "chars") {
    if (mode === "gp") { gpRound = 0; gpPoints = []; trackIdx = 0; startRace(); }
    else renderTracks();
  } else if (from === "tracks") {
    startRace();
  }
}

/* clicks on the overlay drive every menu, so touch and mouse work the
   same way without a second code path */
function onOverlayClick(e) {
  const t = e.target.closest("button");
  if (!t) return;
  Snd.resume();
  Snd.click();
  const d = t.dataset;

  if (d.quit)    { leave(); return; }
  if (d.diff)    { difficulty = +d.diff; markDiff(); return; }
  if (d.diff === "0") { difficulty = 0; markDiff(); return; }
  if (d.go)      { mode = d.go; renderChars(); return; }
  if (d.char !== undefined) { playerCharIdx = +d.char; padAccent(); renderChars(); return; }
  if (d.track !== undefined) { trackIdx = +d.track; renderTracks(); return; }
  if (d.back === "title") { setOverlay(""); showHud(false); renderTitle(); return; }
  if (d.back === "chars") { renderChars(); return; }
  if (d.settings) { renderSettings(d.settings); return; }
  if (d.closeset) {
    if (d.closeset === "pause") renderPause(); else renderTitle();
    return;
  }
  if (d.mute) { Snd.setMuted(!Snd.muted()); renderSettings(
      el.overlay.querySelector("[data-closeset]").dataset.closeset); return; }
  if (d.tut) { startTutorial(); return; }
  if (d.resume)  { setOverlay(""); state = "race"; Snd.engineOn(); return; }
  if (d.restart) { setOverlay(""); startRace(); return; }
  if (d.next === "chars" || d.next === "tracks") { next(d.next); return; }
  if (d.next === "again")  { startRace(); return; }
  if (d.next === "gpnext") { gpRound++; trackIdx = gpRound; startRace(); return; }
  if (d.next === "gpend")  { renderGPEnd(); return; }
}

/* ---------------------------------------------------------
   THE TOUCH PAD

   Drawn, not borrowed: each key's face is a little canvas painted at
   20x20 and blown up unsmoothed, so the chevrons and the drift glyph
   are the same pixel art as everything else rather than a font
   character or an SVG that would sit at a different weight.
   --------------------------------------------------------- */
function paintPadIcons() {
  if (!el.pad) return;
  el.pad.querySelectorAll("[data-k]").forEach((btn) => {
    const c = btn.querySelector(".rc-ico");
    if (!c) return;
    const g = c.getContext("2d");
    g.clearRect(0, 0, 20, 20);
    const k = btn.dataset.k;
    const px = (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
    const ink = "#fff8e8", dim = "rgba(20,10,26,.45)";

    if (k === "left" || k === "right") {
      /* a chevron, mirrored — one shape so both keys match exactly */
      g.save();
      if (k === "right") { g.translate(20, 0); g.scale(-1, 1); }
      for (let i = 0; i < 6; i++) { px(12 - i, 4 + i, 3, 2, ink); px(12 - i, 14 - i, 3, 2, ink); }
      px(6, 9, 9, 2, ink);
      g.restore();
    } else if (k === "up") {
      /* a chunky throttle arrow */
      for (let i = 0; i < 5; i++) px(9 - i, 5 + i, 2 + i * 2, 2, ink);
      px(7, 12, 6, 5, ink);
      px(7, 12, 6, 1, dim);
    } else if (k === "down") {
      for (let i = 0; i < 5; i++) px(5 + i, 13 - i, 10 - i * 2, 2, ink);
      px(7, 4, 6, 5, ink);
      px(7, 8, 6, 1, dim);
    } else if (k === "drift") {
      /* a kart tail sliding, with two skid marks behind it */
      px(7, 6, 8, 5, ink);
      px(6, 11, 10, 2, ink);
      px(6, 8, 2, 2, dim); px(14, 8, 2, 2, dim);
      px(2, 14, 5, 2, "#7ec8e3"); px(9, 15, 6, 2, "#7ec8e3");
      px(4, 17, 4, 2, "rgba(126,200,227,.5)");
    } else if (k === "item") {
      /* the heart box */
      px(4, 5, 12, 11, ink);
      px(4, 5, 12, 2, "rgba(255,255,255,.55)");
      g.fillStyle = "#ff5f95";
      px(6, 8, 3, 3, "#ff5f95"); px(11, 8, 3, 3, "#ff5f95");
      px(6, 10, 8, 2, "#ff5f95"); px(7, 12, 6, 1, "#ff5f95"); px(9, 13, 2, 1, "#ff5f95");
    }
  });
}

/* a small burst of pixels when a key goes down, so a tap answers back */
function padSpark(btn) {
  const kind = btn.dataset.k;
  for (let i = 0; i < 6; i++) {
    const s = document.createElement("i");
    s.className = "rc-spark" + (kind === "item" ? " heart" : "");
    const a = (i / 6) * TWO_PI + Math.random() * 0.6;
    s.style.setProperty("--dx", (Math.cos(a) * (16 + Math.random() * 14)).toFixed(1) + "px");
    s.style.setProperty("--dy", (Math.sin(a) * (16 + Math.random() * 14)).toFixed(1) + "px");
    btn.appendChild(s);
    setTimeout(() => s.remove(), 420);
  }
}

/* press-and-hold, multi-touch, and it never scrolls the page out from
   under her */
function bindPad() {
  if (!el.pad) return;
  el.pad.querySelectorAll("[data-k]").forEach((btn) => {
    const k = btn.dataset.k;
    const on = (e) => {
      e.preventDefault();
      if (btn.classList.contains("on")) return;
      btn.classList.add("on");
      padSpark(btn);
      Snd.resume();
      if (k === "item") input.itemPressed = true; else input[k] = true;
    };
    const off = (e) => {
      e.preventDefault();
      btn.classList.remove("on");
      if (k !== "item") input[k] = false;
    };
    btn.addEventListener("touchstart", on,  { passive:false });
    btn.addEventListener("touchend",   off, { passive:false });
    btn.addEventListener("touchcancel",off, { passive:false });
    btn.addEventListener("mousedown",  on);
    btn.addEventListener("mouseup",    off);
    btn.addEventListener("mouseleave", off);
  });
  paintPadIcons();
}

/* The pad shows itself when it is wanted and gets out of the way when
   it is not: visible on a touch device, gone the moment a key is
   pressed, back again on the next touch. */
let padWanted = false;
function setPadVisible(on) {
  padWanted = on;
  if (el.pad) el.pad.dataset.want = on ? "1" : "0";
}
function watchPointer() {
  try { setPadVisible(window.matchMedia("(pointer: coarse)").matches); } catch (e) {}
  window.addEventListener("touchstart", () => setPadVisible(true), { passive: true, capture: true });
  window.addEventListener("keydown", (e) => {
    if (KEYMAP[e.key] || e.key === "e" || e.key === "E") setPadVisible(false);
  }, { capture: true });
}

/* the pad borrows the chosen racer's accent for its glow */
function padAccent() {
  if (!el.pad) return;
  el.pad.style.setProperty("--rc-accent", CHARS[playerCharIdx].accent);
  el.pad.style.setProperty("--rc-kart", CHARS[playerCharIdx].kart);
}

/* =========================================================
   19. LOOP & LIFECYCLE
   ========================================================= */
let running = false, raf = null, prev = 0, acc = 0;
const FIXED = 1 / 60;

function resize() {
  if (!el.stage) return;
  const r = el.stage.getBoundingClientRect();
  const w = Math.max(2, Math.round(r.width));
  const h = Math.max(2, Math.round(r.height));
  if (cvs.width !== w || cvs.height !== h) { cvs.width = w; cvs.height = h; }
  cw = w; ch = h;
}

function frame(ts) {
  if (!running) return;
  raf = requestAnimationFrame(frame);

  let dt = (ts - prev) / 1000;
  prev = ts;
  if (!isFinite(dt) || dt < 0) dt = 0;
  dt = Math.min(dt, 0.1);

  resize();
  camStep = dt;

  /* physics on a fixed step so the handling is identical on a 60Hz
     laptop and a 120Hz phone */
  if (state === "race" || state === "count") {
    acc += dt;
    let guard = 0;
    while (acc >= FIXED && guard++ < 5) { step(FIXED); acc -= FIXED; }
  }

  if (state === "race" || state === "count" || state === "paused") {
    if (racers.length) { draw(); paintHud(); }
  } else {
    ctx.clearRect(0, 0, cw, ch);
  }
}

function markDone() {
  if (window.markSuperOuissyRaceDone) window.markSuperOuissyRaceDone();
}
function leave() {
  if (window.leaveSuperOuissyRace) window.leaveSuperOuissyRace();
}

function start() {
  cvs = document.getElementById("race-canvas");
  if (!cvs) return;
  ctx = cvs.getContext("2d");
  grabEls();
  if (!sceneCvs) initBuffers();
  if (!Object.keys(kartSprites).length) buildAllKarts();

  running = true;
  prev = performance.now();
  acc = 0;
  racers = [];
  state = "title";

  document.addEventListener("keydown", onKey);
  document.addEventListener("keyup", onKey);
  if (el.overlay) el.overlay.addEventListener("click", onOverlayClick);
  if (el.tut) el.tut.addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    Snd.click();
    if (b.dataset.tutskip || b.dataset.tutend) endTutorial();
  });
  if (el.pause) el.pause.addEventListener("click", () => {
    if (state === "race") renderPause(); else if (state === "paused") { setOverlay(""); state = "race"; }
  });
  bindPad();
  watchPointer();
  padAccent();

  resize();
  renderTitle();
  raf = requestAnimationFrame(frame);
}

function stop() {
  running = false;
  if (tut && tut.wait) clearTimeout(tut.wait);
  tut = null;
  if (el.tut) { el.tut.hidden = true; el.tut.innerHTML = ""; }
  Snd.engineOff();
  Snd.drift(false);
  Snd.stopMusic();
  if (raf) cancelAnimationFrame(raf);
  raf = null;
  document.removeEventListener("keydown", onKey);
  document.removeEventListener("keyup", onKey);
  if (el.overlay) el.overlay.removeEventListener("click", onOverlayClick);
  Object.keys(input).forEach((k) => (input[k] = false));
  setOverlay("");
  showHud(false);
  setCount("");
  setBanner("");
}

return { start, stop };
})();
