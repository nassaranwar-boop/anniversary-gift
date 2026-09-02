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

/* The ground is drawn at this size and blown up unsmoothed, which is
   where the chunky Mode 7 look comes from. RW/RH, HORIZON and FOCAL
   scale together — change one alone and the horizon stops agreeing with
   where the billboards think the ground is. */
const RW       = 480;    // internal render width  (then scaled up, unsmoothed)
const RH       = 270;    // internal render height
const HORIZON  = 108;    // screen row the ground vanishes at
const FOCAL    = 360;    // lens; bigger = narrower field of view
const CAM_H    = 33;     // camera height above the road
const CAM_DIST = 122;    // how far the camera trails the kart
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
    scenery:["pine","pine","pine","pine","tree","bush","bush","rock","cabin","shed","signpost","flowerbox"],
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
    /* It runs down out of the hills, under the log bridge, and pools in
       the middle of the circuit. Placed to clear the racing surface
       everywhere — and where the road does cross it, the tarmac is
       painted afterwards, so it reads as a culvert. */
    river:{ w:30, pts:[[0.58,-0.08],[0.555,-0.01],[0.53,0.06],[0.515,0.13],
                       [0.505,0.20],[0.50,0.27],[0.505,0.34],[0.515,0.41],[0.53,0.47]] },
    /* the thing the blurb promises: logs down off the hill, lying half
       across the road. Always one side at a time, so there is a line
       through — an obstacle you cannot avoid is just a tax. */
    hazard:{ kind:"log", n:7, warn:"WATCH OUT · fallen logs across the road" },
  },
  {
    id:"town", name:"Hometown Streets", laps:3,
    blurb:"Corner stores, porch lights, the sprinklers that never got the memo, and the alley you always cut through.",
    grass:"#6fae5c", grassAlt:"#64a153", shoulder:"#b9a684",
    road:"#8e8e96", roadAlt:"#87878f", rumbleA:"#ffc4a3", rumbleB:"#fff8e8",
    sky:["#8fd0ea","#ffe6bd"], haze:"#e2d3b6", accent:"#ffc4a3",
    light:-0.5,
    scenery:["house","house","house","tree","bush","lamp","store","hydrant","postbox",
             "flowerbox","mailbox","bike","hoop","car","bench"],
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
    /* THE ENDPOINTS HAVE TO LAND ON THE MAIN LOOP.

       This one used to run from (0.335,0.495) to (0.655,0.475) — and
       there is no road within four hundred units of that second point.
       A kart coming out of it got snapped to the nearest ribbon, which
       was the RETURN leg on the far side of the infield, so the alley
       skipped half the circuit: measured at 40% of a lap, and the
       autopilot's lap times fell from 53s to 30s. The gift-cart run and
       the plank had the same fault. All three ends now sit on real
       main-path samples, leaving and rejoining within 25 degrees of the
       racing line, and each saves the three or four per cent of a lap
       the log bridge always did. */
    cut:{ name:"the back alley",
          pts:[[0.410,0.126],[0.485,0.116],[0.560,0.113],[0.635,0.118],[0.710,0.130]] },
    /* "the sprinklers that never got the memo" — they pulse, so a lap
       learned is a lap you can time your way through */
    hazard:{ kind:"sprinkler", n:9, warn:"WATCH OUT · sprinklers, and the wet patch they leave" },
  },
  {
    id:"ward", name:"Hospital Dash", laps:3,
    blurb:"Sunlit halls, a slalom of IV poles, and the gift-cart run everybody pretends not to take.",
    grass:"#b9c8de", grassAlt:"#adbdd6", shoulder:"#93a8c6",
    road:"#e9edf5", roadAlt:"#dde4ef", rumbleA:"#7ec8e3", rumbleB:"#fff8e8",
    sky:["#cfe4f4","#eef5fb"], haze:"#d6e6f2", accent:"#7ec8e3", tiles:true,
    light:-1.1,
    scenery:["pole","pole","plant","plant","cart","chair","vending","sign","bench"],
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
    cut:{ name:"the gift-cart run",
          pts:[[0.410,0.150],[0.480,0.143],[0.550,0.141],[0.620,0.148],[0.690,0.160]] },
    hazard:{ kind:"ivpole", n:10, warn:"WATCH OUT · a slalom of IV poles" },
  },
  {
    id:"roof", name:"Rooftop Sunset", laps:3,
    blurb:"String lights, laundry lines, a plank across the gap, and every cat in the city out to watch the finish.",
    grass:"#4a3a63", grassAlt:"#433457", shoulder:"#6d5a49",
    road:"#8a7a68", roadAlt:"#82735f", rumbleA:"#ffd166", rumbleB:"#ff7f8a",
    sky:["#ff8a5c","#ffd08a"], haze:"#ffb583", accent:"#ffd166",
    light:-2.2,                       // low sun, long shadows the other way
    scenery:["stringpole","cat","laundry","vent","cat","watertank","acunit","skylight",
             "dish","planter","shelter","trafficlight","car","lamp"],
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
    cut:{ name:"the plank",
          pts:[[0.396,0.136],[0.472,0.132],[0.548,0.128],[0.624,0.124],[0.700,0.120]] },
    hazard:{ kind:"washline", n:8, warn:"WATCH OUT · laundry lines hung too low" },
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
  { id:"ouissy", kart_shape:"round", name:"Ouissy", head:"ouissy",
    kart:"#ff7f8a", trim:"#fff1e0", accent:"#ff5f95",
    skin:"#f6dcc2", hair:"#8a6440", jacket:"#fff1e0", sleeve:"#ff7f8a",
    fit:"Varsity jacket + goggles" },
  { id:"anwar", kart_shape:"long", name:"Anwar", head:"anwar",
    kart:"#5ab8a6", trim:"#eaf6f2", accent:"#4a7fb5",
    skin:"#d9ab7d", hair:"#2b1c12", jacket:"#5ab8a6", sleeve:"#3f8f80",
    fit:"Bomber jacket + goggles" },

  { id:"whiskers", kart_shape:"wide", name:"Whiskers", head:"cat",
    kart:"#e8a060", trim:"#fff0d8", accent:"#c97b3d",
    skin:"#e8a060", hair:"#c97b3d", jacket:"#fff0d8", sleeve:"#e8a060" },
  { id:"reaper", kart_shape:"tall", name:"Reaper", head:"reaper",
    kart:"#8f7bc4", trim:"#e6dcff", accent:"#6a5a8a",
    skin:"#d8cfe8", hair:"#4a3a6a", jacket:"#6a5a8a", sleeve:"#4a3a6a" },
  { id:"blossom", kart_shape:"round", name:"Blossom", head:"flower",
    kart:"#f2a3bb", trim:"#ffe6ee", accent:"#d97a95",
    skin:"#ffe6ee", hair:"#e8778f", jacket:"#ffe6ee", sleeve:"#f2a3bb" },
  { id:"sparky", kart_shape:"wide", name:"Sparky", head:"star",
    kart:"#ffd166", trim:"#fff6cf", accent:"#e0a83a",
    skin:"#ffe9a8", hair:"#e0a83a", jacket:"#fff6cf", sleeve:"#ffd166" },
  { id:"frosty", kart_shape:"long", name:"Frosty", head:"ice",
    kart:"#8fd4e8", trim:"#e8f8ff", accent:"#5aa8c4",
    skin:"#e8f8ff", hair:"#5aa8c4", jacket:"#e8f8ff", sleeve:"#8fd4e8" },
  { id:"coco", kart_shape:"tall", name:"Coco", head:"bear",
    kart:"#c08a63", trim:"#f2ddc4", accent:"#8f6242",
    skin:"#c08a63", hair:"#8f6242", jacket:"#f2ddc4", sleeve:"#c08a63" },
];

/* ---------------------------------------------------------
   5. ITEMS — the Mario Kart formula, reflavoured
   --------------------------------------------------------- */
const ITEMS = {
  bouqshot:{ name:"Bouquet",      weight:0,  tint:"#ff9ec4" },
  letter:  { name:"Love Letter",  weight:26, tint:"#fff8e8" },
  arrow:   { name:"Cupid's Arrow",weight:18, tint:"#ff5f95" },
  heart:   { name:"Paper Heart",  weight:18, tint:"#ff7f8a" },
  rose:    { name:"Rose Thorns",  weight:16, tint:"#e8556f" },
  bouquet: { name:"Bouquet",      weight:12, tint:"#ff9ec4" },
  ring:    { name:"Anniversary Ring", weight:6, tint:"#ffd166" },
};
const ITEM_KEYS = Object.keys(ITEMS).filter((k) => ITEMS[k].weight > 0);

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
let river = null;   // an open spline of water, when a track has one
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

  river = def.river
    ? { pts: catmull(def.river.pts.map((q) => ({ x: q[0] * WORLD, y: q[1] * WORLD })), false),
        w: def.river.w }
    : null;

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
    cut = {
      pts, from: a.along, to: b.along, cum: len, len: total,
      fromIdx: a.idx, toIdx: b.idx, name: def.cut.name,
    };
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
  const frac = cut.len > 0
    ? (cut.cum[bi] + bt * (cut.cum[bi+1] - cut.cum[bi])) / cut.len : 0;
  const f = frac;
  /* the shortcut may straddle the start line, so walk forward from
     `from` rather than lerping straight to `to` */
  let span = cut.to - cut.from;
  if (span < 0) span += 1;
  let along = cut.from + span * f;
  if (along >= 1) along -= 1;
  return {
    dist: Math.sqrt(bd), idx: bi, t: bt, along,
    cx, cy, side: (x - cx) * nx + (y - cy) * ny,
    nx, ny, tan: ta, half: CUT_HALF, onCut: true, frac,
  };
}

/* Whichever ribbon you are actually on.

   `st` is the caller's memory — {hint, onCut} — and it matters. Deciding
   fresh every frame let a kart near a junction flip between the loop and
   the shortcut from one frame to the next, and because the two disagree
   about how far round you are in the middle of the shortcut, the tangent
   flipped with them. That is what was yanking the steering: the barrier
   nudge kept being handed a heading from the other ribbon. So a kart
   commits to one, and only leaves it off the end or by straying well
   clear of it. */
function project(x, y, st) {
  if (!cut) {
    const m = projectMain(x, y, st ? st.hint : null);
    if (st) { st.hint = m.idx; st.onCut = false; }
    return m;
  }

  const c = projectCut(x, y);
  let use;

  if (st && st.onCut) {
    if (c.frac <= 0.03) {
      use = projectMain(x, y, cut.fromIdx);         // backed out of the mouth
    } else if (c.frac >= 0.97) {
      use = projectMain(x, y, cut.toIdx);           // out the far end
    } else if (c.dist > CUT_HALF + 46) {
      use = projectMain(x, y, c.frac < 0.5 ? cut.fromIdx : cut.toIdx);
    } else {
      use = c;
    }
  } else {
    const m = projectMain(x, y, st ? st.hint : null);
    /* only joinable from on the shortcut itself, and never from the far
       side of the loop where it happens to pass close by */
    use = (c.dist < CUT_HALF && c.frac > 0.04 && c.frac < 0.96 && c.dist < m.dist)
        ? c : m;
  }

  if (st) {
    st.onCut = !!use.onCut;
    if (!use.onCut) st.hint = use.idx;
  }
  return use;
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
  speckle(g, 26000, 3, [def.grassAlt, shade(def.grass, 1.14), shade(def.grass, 0.86),
                        shade(def.grass, 1.06), shade(def.grass, 0.94)]);
  /* a scatter of longer tufts, so the ground has a direction to it */
  for (let i = 0; i < 5200; i++) {
    const x = Math.random() * WORLD, y = Math.random() * WORLD;
    g.fillStyle = Math.random() < 0.5 ? shade(def.grass, 1.2) : shade(def.grass, 0.8);
    g.fillRect(x | 0, y | 0, 2, 4 + ((Math.random() * 3) | 0));
  }

  /* a hard floor rather than ground: a tile grid with a sheen on it */
  if (def.tiles) {
    const T = 46;
    g.save();
    g.globalAlpha = 0.5;
    for (let x = 0; x < WORLD; x += T) {
      for (let y = 0; y < WORLD; y += T) {
        if (((x / T) + (y / T)) % 2 === 0) {
          g.fillStyle = shade(def.grass, 1.05);
          g.fillRect(x, y, T, T);
        }
        /* the grout, and a highlight along the top-left of each tile */
        g.fillStyle = shade(def.grass, 0.86);
        g.fillRect(x, y, T, 1.5); g.fillRect(x, y, 1.5, T);
        g.fillStyle = "rgba(255,255,255,.30)";
        g.fillRect(x + 1.5, y + 1.5, T - 3, 1);
      }
    }
    /* long soft reflections, as if the polish were catching the windows */
    g.globalAlpha = 0.10; g.fillStyle = "#ffffff";
    for (let i = 0; i < 90; i++) {
      const x = Math.random() * WORLD, y = Math.random() * WORLD;
      g.fillRect(x, y, 10 + Math.random() * 90, 5 + Math.random() * 10);
    }
    g.restore();
  }

  /* Broad tonal patches, then bands running with the road like mown
     stripes, then clumps. One flat plane of green is the thing that
     reads as unfinished more than anything else out here. */
  const gr = mulberry(seedOf(def.id, 7717));
  for (let i = 0; i < path.length; i += 7) {
    const ta = tangentAt(i);
    for (const sgn of [-1, 1]) {
      if (gr() > 0.55) continue;
      const off = SHOULDER + 20 + gr() * 260;
      const cx = path[i].x - Math.sin(ta) * off * sgn;
      const cy = path[i].y + Math.cos(ta) * off * sgn;
      g.save();
      g.globalAlpha = 0.13 + gr() * 0.12;
      g.fillStyle = gr() > 0.5 ? shade(def.grass, 1.18) : shade(def.grass, 0.84);
      g.beginPath();
      g.ellipse(cx, cy, 40 + gr() * 90, 22 + gr() * 50, ta, 0, TWO_PI);
      g.fill();
      g.restore();
    }
  }
  /* clumps of planting, and the odd bare patch of earth */
  for (let i = 0; i < 240; i++) {
    const k = (gr() * path.length) | 0;
    const ta = tangentAt(k);
    const sgn = gr() < 0.5 ? -1 : 1;
    const off = SHOULDER + 12 + gr() * 190;
    const cx = path[k].x - Math.sin(ta) * off * sgn;
    const cy = path[k].y + Math.cos(ta) * off * sgn;
    if (gr() > 0.34) {
      g.fillStyle = shade(def.grass, 0.72);
      for (let b = 0; b < 9; b++)
        g.fillRect((cx + (gr() - 0.5) * 26) | 0, (cy + (gr() - 0.5) * 18) | 0, 3, 3);
    } else {
      const cols = ["#ff9ec4", "#ffe07a", "#fff1e0", "#ff7f8a", "#c8a8ff"];
      for (let b = 0; b < 7; b++) {
        g.fillStyle = cols[(gr() * cols.length) | 0];
        g.fillRect((cx + (gr() - 0.5) * 22) | 0, (cy + (gr() - 0.5) * 14) | 0, 2, 2);
      }
    }
  }

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

  /* --- water, before anything paved, so every crossing bridges it --- */
  if (river) {
    const W2 = river.w;
    const wr = mulberry(seedOf(def.id, 9187));
    /* damp earth and pebbles along the banks */
    strokePts(g, river.pts, W2 * 2 + 42, "rgba(90,74,48,.35)", false);
    strokePts(g, river.pts, W2 * 2 + 22, "#8a7554", false);
    for (let i = 0; i < 900; i++) {
      const k = (wr() * (river.pts.length - 1)) | 0;
      const a2 = Math.atan2(river.pts[k+1].y - river.pts[k].y, river.pts[k+1].x - river.pts[k].x);
      const off = (W2 + 2 + wr() * 18) * (wr() < 0.5 ? -1 : 1);
      const px = river.pts[k].x - Math.sin(a2) * off;
      const py = river.pts[k].y + Math.cos(a2) * off;
      g.fillStyle = ["#9a8a70", "#7d6f58", "#b2a48a"][(wr() * 3) | 0];
      g.fillRect(px | 0, py | 0, 2 + ((wr() * 3) | 0), 2 + ((wr() * 2) | 0));
    }
    /* the water itself: shallow at the edges, deep down the middle */
    strokePts(g, river.pts, W2 * 2,       "#5f9fb0", false);
    strokePts(g, river.pts, W2 * 1.55,    "#4a8ba4", false);
    strokePts(g, river.pts, W2 * 0.95,    "#3d7b96", false);
    /* current lines running with the flow */
    g.save();
    g.globalAlpha = 0.30;
    for (let lane = -0.62; lane <= 0.62; lane += 0.31) {
      g.strokeStyle = "#8fd0dd"; g.lineWidth = 2;
      g.setLineDash([16 + wr() * 20, 26 + wr() * 26]);
      g.beginPath();
      river.pts.forEach((q, i) => {
        const j = Math.min(i + 1, river.pts.length - 1);
        const a2 = Math.atan2(river.pts[j].y - q.y, river.pts[j].x - q.x);
        const px = q.x - Math.sin(a2) * W2 * lane;
        const py = q.y + Math.cos(a2) * W2 * lane;
        if (i === 0) g.moveTo(px, py); else g.lineTo(px, py);
      });
      g.stroke();
    }
    g.setLineDash([]);
    /* glints where the light catches the ripples */
    g.globalAlpha = 0.5;
    for (let i = 0; i < 260; i++) {
      const k = (wr() * (river.pts.length - 1)) | 0;
      const a2 = Math.atan2(river.pts[k+1].y - river.pts[k].y, river.pts[k+1].x - river.pts[k].x);
      const off = (wr() * 2 - 1) * W2 * 0.85;
      g.fillStyle = wr() > 0.5 ? "#cfeef5" : "#a8dce8";
      g.fillRect((river.pts[k].x - Math.sin(a2) * off) | 0,
                 (river.pts[k].y + Math.cos(a2) * off) | 0, 3 + ((wr() * 4) | 0), 1);
    }
    g.restore();
    /* a few boulders standing in the water */
    for (let i = 0; i < 14; i++) {
      const k = (wr() * (river.pts.length - 1)) | 0;
      const a2 = Math.atan2(river.pts[k+1].y - river.pts[k].y, river.pts[k+1].x - river.pts[k].x);
      const off = (wr() * 2 - 1) * W2 * 0.7;
      const px = river.pts[k].x - Math.sin(a2) * off;
      const py = river.pts[k].y + Math.cos(a2) * off;
      const r2 = 4 + wr() * 7;
      g.fillStyle = "#7f7869";
      g.beginPath(); g.ellipse(px, py, r2, r2 * 0.72, 0, 0, TWO_PI); g.fill();
      g.fillStyle = "#9a9384";
      g.beginPath(); g.ellipse(px - r2 * 0.2, py - r2 * 0.25, r2 * 0.55, r2 * 0.4, 0, 0, TWO_PI); g.fill();
      g.fillStyle = "rgba(207,238,245,.55)";
      g.fillRect((px - r2) | 0, (py + r2 * 0.5) | 0, r2 * 2, 1);
    }
  }

  /* Shadows go down before any tarmac does. A tall pine standing just
     off the verge throws a shadow long enough to reach the racing line,
     and a dark smear lying across the road looked like a hole in it.
     Painting the road afterwards clips them for free. */
  bakeGroundShadows(g, def);

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

  /* a scuffed edge on the kerb blocks */
  speckleAlong(g, 2600, 2, ["rgba(255,255,255,.22)", "rgba(0,0,0,.16)"],
               ROAD_HALF + 2, RUMBLE_HALF - 1);

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

  /* Two darkened bands where the racing line runs, laid down before the
     patches so the wear sits under them. Nothing sells a track surface
     like the marks of everyone who has already been round it. */
  for (const lane of [-0.34, 0.34]) {
    g.save();
    g.globalAlpha = 0.13;
    g.strokeStyle = shade(def.road, 0.7);
    g.lineWidth = ROAD_HALF * 0.30;
    g.lineJoin = g.lineCap = "round";
    g.beginPath();
    for (let i = 0; i <= path.length; i++) {
      const idx = i % path.length;
      const ta = tangentAt(idx);
      const px = path[idx].x - Math.sin(ta) * ROAD_HALF * lane;
      const py = path[idx].y + Math.cos(ta) * ROAD_HALF * lane;
      if (i === 0) g.moveTo(px, py); else g.lineTo(px, py);
    }
    g.closePath(); g.stroke();
    g.restore();
  }

  /* worn patches and a few painted arrows, so the tarmac has something
     going on other than being grey */
  const rr = mulberry(seedOf(def.id, 4441));
  for (let i = 0; i < 90; i++) {
    const k = (rr() * path.length) | 0;
    const ta = tangentAt(k);
    const off = (rr() - 0.5) * ROAD_HALF * 1.5;
    g.save();
    g.globalAlpha = 0.10 + rr() * 0.10;
    g.fillStyle = rr() > 0.5 ? shade(def.road, 0.78) : shade(def.road, 1.14);
    g.beginPath();
    g.ellipse(path[k].x - Math.sin(ta) * off, path[k].y + Math.cos(ta) * off,
              9 + rr() * 22, 5 + rr() * 12, ta, 0, TWO_PI);
    g.fill();
    g.restore();
  }
  for (let k = 26; k < path.length; k += 70) {
    const ta = tangentAt(k);
    g.save();
    g.translate(path[k].x, path[k].y);
    g.rotate(ta);
    g.globalAlpha = 0.4;
    g.fillStyle = "#fff8e8";
    g.beginPath();
    g.moveTo(16, 0); g.lineTo(2, -9); g.lineTo(2, -3.5);
    g.lineTo(-14, -3.5); g.lineTo(-14, 3.5); g.lineTo(2, 3.5); g.lineTo(2, 9);
    g.closePath(); g.fill();
    g.restore();
  }

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

  g.setTransform(1, 0, 0, 1, 0, 0);
  const img = g.getImageData(0, 0, TEX, TEX);
  tex32 = new Uint32Array(img.data.buffer);
  /* Past the edge of the baked world there is nothing to sample. Filling
     it with flat grass leaves a hard band; pulling it towards the haze
     colour lets it pass for ground too far off to make out. */
  voidColor = packRgb(mixRgb(def.grass, def.haze, 0.3));
  if (hazeKey !== def.haze) { hazeKey = def.haze; hazeCache.clear(); }
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
let panoCvs = null, panoFar = null, panoId = null;
const PANO_W = 1600, PANO_H = 150;
const PANO_K  = RH / 225;      // the band was authored for a 225-tall buffer

function bakePano(def) {
  if (panoId === def.id && panoCvs) return;
  const mk = (h) => { const c = document.createElement("canvas"); c.width = PANO_W; c.height = h; return c; };
  if (!panoCvs) { panoCvs = mk(PANO_H); panoFar = mk(PANO_H); }
  const g = panoCvs.getContext("2d");
  g.clearRect(0, 0, PANO_W, PANO_H);
  const gf = panoFar.getContext("2d"); gf.clearRect(0, 0, PANO_W, PANO_H);

  const sky = g.createLinearGradient(0, 0, 0, PANO_H);
  sky.addColorStop(0, def.sky[0]);
  sky.addColorStop(1, def.sky[1]);
  g.fillStyle = sky;
  g.fillRect(0, 0, PANO_W, PANO_H);

  const rnd = mulberry(seedOf(def.id, 977));
  const base = PANO_H - 4;

  if (def.id === "roof") {
    /* --- a night skyline with a low sun still on it ---
       Varied silhouettes: flat tops, stepped setbacks, water towers,
       antenna spires and a lit rooftop sign, with the windows lit in
       irregular runs rather than a uniform grid. */
    g.fillStyle = "rgba(255,236,180,.9)";
    g.beginPath(); g.arc(PANO_W * 0.32, base - 30, 22, 0, TWO_PI); g.fill();
    g.fillStyle = "rgba(255,170,110,.26)";
    g.beginPath(); g.arc(PANO_W * 0.32, base - 30, 42, 0, TWO_PI); g.fill();
    /* a soft glow band along the tops, the city lighting the haze */
    const glow = g.createLinearGradient(0, base - 70, 0, base);
    glow.addColorStop(0, "rgba(255,170,120,0)");
    glow.addColorStop(1, "rgba(255,150,110,.30)");
    g.fillStyle = glow; g.fillRect(0, base - 70, PANO_W, 70);

    const lightWindows = (x, w, top, bot) => {
      /* lit in runs, with whole floors dark, and the odd neon one */
      for (let wy = top + 5; wy < bot - 4; wy += 7) {
        if (rnd() < 0.28) continue;                 // this floor is dark
        let on = rnd() < 0.5;
        for (let wx = x + 3; wx < x + w - 3; wx += 6) {
          if (rnd() < 0.34) on = !on;               // runs, not a grid
          if (!on) continue;
          const neon = rnd() < 0.06;
          g.fillStyle = neon
            ? ["#7ec8e3", "#ff9ec4", "#7ddba3"][(rnd() * 3) | 0]
            : (rnd() < 0.25 ? "#ffd9a0" : "#ffce7a");
          g.fillRect(wx, wy, 2, 3);
          if (neon) {
            g.save(); g.globalAlpha = 0.35; g.fillStyle = g.fillStyle;
            g.fillRect(wx - 1, wy - 1, 4, 5); g.restore();
          }
        }
      }
    };

    let x = -24;
    while (x < PANO_W + 24) {
      const w = 18 + rnd() * 30;
      const h = 22 + rnd() * 52;
      const top = base - h;
      const shape = rnd();

      g.fillStyle = "#2b2440";
      g.fillRect(x, top, w, h);
      g.fillStyle = "#372e50";                       // the lit return
      g.fillRect(x, top, Math.max(2, w * 0.24), h);
      g.fillStyle = "#4a3f66";                       // the roof edge catching light
      g.fillRect(x, top, w, 2);
      lightWindows(x, w, top, base);

      if (shape < 0.28) {
        /* a stepped setback tower */
        const w2 = w * 0.6, h2 = 10 + rnd() * 22;
        const x2 = x + (w - w2) / 2;
        g.fillStyle = "#2b2440"; g.fillRect(x2, top - h2, w2, h2);
        g.fillStyle = "#372e50"; g.fillRect(x2, top - h2, Math.max(2, w2 * 0.24), h2);
        g.fillStyle = "#4a3f66"; g.fillRect(x2, top - h2, w2, 2);
        lightWindows(x2, w2, top - h2, top);
        if (rnd() < 0.5) {                           // spire with a red lamp
          g.fillStyle = "#3a3252"; g.fillRect(x2 + w2 / 2 - 1, top - h2 - 14, 2, 14);
          g.fillStyle = "#ff6b6b"; g.fillRect(x2 + w2 / 2 - 1.5, top - h2 - 16, 3, 3);
        }
      } else if (shape < 0.46) {
        /* a rooftop water tower on legs */
        const tx = x + w * 0.5 - 6;
        g.fillStyle = "#4a3f36";
        g.fillRect(tx + 1, top - 7, 2, 7); g.fillRect(tx + 9, top - 7, 2, 7);
        g.fillRect(tx, top - 20, 12, 13);
        g.fillStyle = "#5c4e42"; g.fillRect(tx, top - 20, 4, 13);
        g.beginPath();
        g.moveTo(tx - 2, top - 20); g.lineTo(tx + 6, top - 26); g.lineTo(tx + 14, top - 20);
        g.closePath(); g.fill();
      } else if (shape < 0.60) {
        /* a lit rooftop sign */
        const sw = Math.min(w - 4, 22);
        const sx3 = x + (w - sw) / 2;
        g.fillStyle = "#3a3252"; g.fillRect(sx3 - 1, top - 12, sw + 2, 11);
        g.fillStyle = ["#ff9ec4", "#ffd166", "#7ec8e3"][(rnd() * 3) | 0];
        g.fillRect(sx3, top - 11, sw, 9);
        g.save(); g.globalAlpha = 0.30; g.fillStyle = g.fillStyle;
        g.fillRect(sx3 - 3, top - 14, sw + 6, 15); g.restore();
        g.fillStyle = "#2b2440";
        for (let i = 0; i < 3; i++) g.fillRect(sx3 + 3 + i * 6, top - 8, 3, 4);
      } else if (shape < 0.70) {
        /* aerials */
        g.fillStyle = "#3a3252";
        for (let i = 0; i < 3; i++)
          g.fillRect(x + 4 + i * (w / 3), top - 6 - rnd() * 8, 1, 6 + rnd() * 8);
      }
      x += w + 2 + rnd() * 6;
    }

    /* --- the street below: shopfronts, lamps and parked cars --- */
    g.fillStyle = "#1d1830"; g.fillRect(0, base - 12, PANO_W, 12);
    for (let sx4 = -10; sx4 < PANO_W + 10; sx4 += 24 + rnd() * 22) {
      if (rnd() < 0.45) {                            // a lit shopfront
        const sw = 12 + rnd() * 14;
        g.fillStyle = "#ffce7a"; g.fillRect(sx4, base - 10, sw, 7);
        g.save(); g.globalAlpha = 0.28; g.fillStyle = "#ffce7a";
        g.fillRect(sx4 - 3, base - 12, sw + 6, 12); g.restore();
        g.fillStyle = "#241d3a";                     // an awning over it
        g.fillRect(sx4 - 2, base - 12, sw + 4, 3);
      }
      if (rnd() < 0.4) {                             // a streetlamp and its pool
        g.fillStyle = "#3a3252"; g.fillRect(sx4 + 6, base - 18, 1, 18);
        g.fillStyle = "#ffe6a8"; g.fillRect(sx4 + 4, base - 20, 5, 2);
        g.save(); g.globalAlpha = 0.22; g.fillStyle = "#ffd166";
        g.beginPath(); g.ellipse(sx4 + 6, base - 1, 9, 3, 0, 0, TWO_PI); g.fill();
        g.restore();
      }
      if (rnd() < 0.35) {                            // a car at the kerb
        g.fillStyle = "#171227";
        g.fillRect(sx4 + 2, base - 6, 14, 4);
        g.fillRect(sx4 + 5, base - 9, 8, 3);
        g.fillStyle = "#ff8a6b"; g.fillRect(sx4 + 1, base - 5, 2, 2);
      }
    }

  } else if (def.id === "ward") {
    /* the sunlit window wall at the end of the corridor */
    g.fillStyle = "#dae4f0";
    g.fillRect(0, base - 54, PANO_W, 54);
    for (let x = 0; x < PANO_W; x += 38) {
      g.fillStyle = "#f6fbff";
      g.fillRect(x + 3, base - 50, 30, 42);
      g.fillStyle = "rgba(126,200,227,.5)";
      g.fillRect(x + 6, base - 47, 24, 22);
      g.fillStyle = "#9db0ca";
      g.fillRect(x, base - 54, 3, 50);
    }
    g.fillStyle = "#9db0ca"; g.fillRect(0, base - 8, PANO_W, 3);
    g.fillStyle = "#8698b2"; g.fillRect(0, base - 5, PANO_W, 5);

  } else if (def.id === "town") {
    /* clouds, then a modest roofline — houses at the horizon should be
       small. Slabs the size of the ones the first pass drew read as
       cardboard flats standing behind the track. */
    g.fillStyle = "rgba(255,255,255,.6)";
    for (let i = 0; i < 16; i++) {
      const x = rnd() * PANO_W, y = 16 + rnd() * 34, r = 8 + rnd() * 13;
      g.beginPath();
      g.arc(x, y, r, 0, TWO_PI); g.arc(x + r, y + 2, r * 0.75, 0, TWO_PI);
      g.arc(x - r * 0.9, y + 3, r * 0.65, 0, TWO_PI);
      g.fill();
    }
    let x = -10;
    while (x < PANO_W + 10) {
      /* a mixed roofline: bungalows, two-storeys, the odd garage, each
         with a lit face and a shaded one so none of them reads flat */
      const two = rnd() < 0.42;
      const w = (two ? 22 : 26) + rnd() * 16;
      const h = (two ? 26 : 14) + rnd() * 12;
      const wall = ["#a2937f", "#93a087", "#a89383", "#8f9aa2"][(rnd() * 4) | 0];
      const roofC = ["#7d6555", "#6f7580", "#85614f"][(rnd() * 3) | 0];
      g.fillStyle = wall;      g.fillRect(x, base - h, w, h);
      g.fillStyle = shade(wall, 1.16);
      g.fillRect(x, base - h, Math.max(3, w * 0.28), h);
      g.fillStyle = shade(wall, 0.82);
      g.fillRect(x + w - 3, base - h, 3, h);
      g.fillStyle = roofC;
      g.beginPath();
      g.moveTo(x - 3, base - h); g.lineTo(x + w / 2, base - h - (two ? 12 : 9));
      g.lineTo(x + w + 3, base - h); g.closePath(); g.fill();
      g.fillStyle = shade(roofC, 0.78);
      g.beginPath();
      g.moveTo(x + w / 2, base - h - (two ? 12 : 9));
      g.lineTo(x + w + 3, base - h); g.lineTo(x + w / 2, base - h); g.closePath(); g.fill();
      if (rnd() < 0.45) {                       // a chimney
        g.fillStyle = shade(roofC, 1.1);
        g.fillRect(x + w * 0.68, base - h - (two ? 15 : 12), 4, 8);
      }
      g.fillStyle = "rgba(255,224,160,.85)";
      for (let wy = base - h + 4; wy < base - 4; wy += 9)
        for (let wx = x + 4; wx < x + w - 4; wx += 8)
          if (rnd() > 0.4) g.fillRect(wx, wy, 3, 4);
      if (rnd() < 0.3) {                        // a hedge out front
        g.fillStyle = "#5f8f57";
        g.fillRect(x + 2, base - 4, w - 4, 4);
      }
      x += w + 4 + rnd() * 12;
    }

  } else {
    /* woods: clouds and two ridges of far pines */
    g.fillStyle = "rgba(255,255,255,.62)";
    for (let i = 0; i < 18; i++) {
      const x = rnd() * PANO_W, y = 12 + rnd() * 32, r = 8 + rnd() * 12;
      g.beginPath();
      g.arc(x, y, r, 0, TWO_PI); g.arc(x + r, y + 2, r * 0.75, 0, TWO_PI);
      g.arc(x - r * 0.9, y + 3, r * 0.65, 0, TWO_PI);
      g.fill();
    }
    for (let layer = 0; layer < 2; layer++) {
      g.fillStyle = layer ? "#41805090" : "#2f5f3c";
      const yb = base - layer * 5;
      for (let x = -10; x < PANO_W + 10; x += 9 + rnd() * 7) {
        const h = (layer ? 16 : 26) + rnd() * 16;
        g.beginPath();
        g.moveTo(x, yb); g.lineTo(x + 5, yb - h); g.lineTo(x + 10, yb);
        g.closePath(); g.fill();
      }
    }
  }

  buildParallax(def, gf);
  panoId = def.id;
}

/* The two extra depths.

   Both are deliberately small and low-contrast. The first attempt drew
   them at the same size as the main band, which put a row of enormous
   flat silhouettes across the horizon that fought with the real
   billboards in front of them — it read as a bug rather than as depth.
   Distance means smaller, paler and slower, all three at once. */
function buildParallax(def, gf) {
  const rnd = mulberry(seedOf(def.id, 613));
  const far = mixRgb(def.haze, def.sky[0], 0.4);
  const fbase = PANO_H - 4;

  gf.fillStyle = `rgba(${far[0]},${far[1]},${far[2]},.5)`;
  if (def.id === "roof" || def.id === "town") {
    let x = -20;
    while (x < PANO_W + 20) {
      const w = 22 + rnd() * 34, h = 12 + rnd() * 26;
      gf.fillRect(x, fbase - h, w, h);
      x += w + 6 + rnd() * 14;
    }
  } else if (def.id === "ward") {
    gf.fillRect(0, fbase - 26, PANO_W, 26);
  } else {
    for (let k = 0; k < 2; k++) {
      gf.beginPath();
      gf.moveTo(-10, PANO_H);
      for (let x = -10; x < PANO_W + 20; x += 46)
        gf.lineTo(x, fbase - 10 - Math.sin(x * 0.0032 + k * 1.7) * 9 - rnd() * 5);
      gf.lineTo(PANO_W + 20, PANO_H); gf.closePath(); gf.fill();
    }
  }

}

/* A real string hash. Seeding off def.id.length gave "town", "ward" and
   "roof" — all four characters — the identical seed, so three of the
   four tracks laid out their scenery and skyline exactly alike. */
function seedOf(str, salt) {
  let h = 2166136261 ^ salt;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
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
/* The rider is a whole little body now, so the sheet needs headroom
   above the kart. KART_H below is scaled by the same amount, so the kart
   itself comes out exactly the size it was — only the empty space above
   it grew. */
const SPR_W = 64, SPR_H = 68;
const KART_H = 21 * (68 / 56);
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

function buildKart(def, ai, pose) {
  const a = (ai / ANGLES) * TWO_PI;
  const c = document.createElement("canvas");
  c.width = SPR_W; c.height = SPR_H;
  const g = c.getContext("2d");
  g.imageSmoothingEnabled = false;
  g.translate(SPR_W / 2, SPR_H - 16);

  const facing = Math.cos(a);        // >0 we see its back, <0 it faces us
  /* Everyone drove the identical box in a different colour. Each racer
     now has a chassis of their own: a rounded runabout, a long low one,
     a wide stubby one, and so on. Same silhouette language, different
     machine. */
  const K = {
    round: { hw:13, hl:16, h:9,  wx:11, wy:13, nose:1.0, tail:1.0 },
    long:  { hw:11, hl:20, h:8,  wx:10, wy:16, nose:1.2, tail:0.9 },
    wide:  { hw:15, hl:14, h:10, wx:13, wy:12, nose:0.9, tail:1.2 },
    tall:  { hw:12, hl:15, h:12, wx:11, wy:12, nose:1.0, tail:1.0 },
  }[def.kart_shape || "round"];
  const bodyH  = K.h;                // how tall the chassis box stands

  /* --- wheels, far pair first --- */
  const wheels = [
    { x:-K.wx, y: K.wy }, { x: K.wx, y: K.wy },   // front
    { x:-K.wx, y:-K.wy }, { x: K.wx, y:-K.wy },   // rear
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
  const corners = [
    { x:-K.hw * K.tail, y:-K.hl }, { x: K.hw * K.tail, y:-K.hl },
    { x: K.hw * K.nose, y: K.hl }, { x:-K.hw * K.nose, y: K.hl },
  ].map((p) => proj2(p.x, p.y, a));
  const top = corners.map((p) => ({ x: p.x, y: p.y - bodyH }));

  /* side walls: every edge whose bottom sits in front of its top */
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    quad(g, [corners[i], corners[j], top[j], top[i]], shade(def.kart, 0.66));
  }
  quad(g, top, def.kart);

  /* a lighter panel down the middle, and the trim band */
  const midA = proj2(-6, -K.hl, a), midB = proj2(6, -K.hl, a);
  const midC = proj2(6, K.hl, a),   midD = proj2(-6, K.hl, a);
  quad(g, [midA, midB, midC, midD].map((p) => ({ x: p.x, y: p.y - bodyH })), shade(def.kart, 1.16));

  const trimA = proj2(-K.hw, 2, a), trimB = proj2(K.hw, 2, a);
  const trimC = proj2(K.hw, 6, a),  trimD = proj2(-K.hw, 6, a);
  quad(g, [trimA, trimB, trimC, trimD].map((p) => ({ x: p.x, y: p.y - bodyH })), def.trim);

  /* rear spoiler when we can see the back of it, nose when we cannot */
  if (facing > 0.15) {
    const sA = proj2(-K.hw + 2, -K.hl - 1, a), sB = proj2(K.hw - 2, -K.hl - 1, a);
    quad(g, [
      { x: sA.x, y: sA.y - bodyH - 7 }, { x: sB.x, y: sB.y - bodyH - 7 },
      { x: sB.x, y: sB.y - bodyH - 2 }, { x: sA.x, y: sA.y - bodyH - 2 },
    ], def.accent);
  } else if (facing < -0.15) {
    const nA = proj2(-K.hw + 3, K.hl + 1, a), nB = proj2(K.hw - 3, K.hl + 1, a);
    quad(g, [
      { x: nA.x, y: nA.y - bodyH + 1 }, { x: nB.x, y: nB.y - bodyH + 1 },
      { x: nB.x, y: nB.y - bodyH + 5 }, { x: nA.x, y: nA.y - bodyH + 5 },
    ], def.accent);
  }

  wheels.slice(2).forEach(drawWheel);

  /* --- the rider --- */
  const seat = proj2(0, -3, a);
  drawRider(g, def, a, seat.x, seat.y - bodyH - 3, pose | 0);

  return c;
}

function litSideDim(side) { return side > 0 ? 0.86 : 0.94; }

function drawRider(g, def, a, cx, cy, pose) {
  const facing = Math.cos(a), side = Math.sin(a);
  const R = (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(Math.round(cx + x), Math.round(cy + y), w, h); };

  /* A whole little person, not a coloured block with a face on it.
     Shoulders, a chest with a collar, two arms that reach forward to the
     wheel with hands on it, and a head sitting proud of the shoulders —
     that reads as a character at a glance, which the old flat torso
     never did on the AI racers. */
  const sx = Math.round(side * 2);
  /* pose 1 hauls the wheel left, pose 2 right: the inside arm pulls in
     and down, the outside arm reaches across */
  const pz = pose | 0;
  const turn = pz === 1 ? -1 : pz === 2 ? 1 : 0;

  /* arms reaching to the wheel, drawn behind the chest */
  const reach = facing < 0 ? 5 : 3;
  const lDrop = turn > 0 ? 2 : 0, rDrop = turn < 0 ? 2 : 0;
  const lOut  = turn < 0 ? -1 : 1, rOut = turn > 0 ? 1 : -1;
  R(-9 + sx + lOut, -8 + lDrop, 3, 7, shade(def.sleeve, 0.9));
  R( 6 + sx + rOut, -8 + rDrop, 3, 7, shade(def.sleeve, 0.9));
  R(-9 + sx + lOut, -3 + lDrop, 4, reach, def.sleeve);
  R( 5 + sx + rOut, -3 + rDrop, 4, reach, def.sleeve);
  if (facing < 0) {                       // hands, when we can see them
    R(-9 + sx + lOut, -3 + reach + lDrop, 4, 3, def.skin);
    R( 5 + sx + rOut, -3 + reach + rDrop, 4, 3, def.skin);
  }

  /* the torso: shoulders wider than the waist, with a collar */
  R(-7, -10, 14, 12, def.jacket);
  R(-8, -10, 16, 3, def.jacket);          // shoulder line
  R(-8, -10, 16, 2, shade(def.jacket, 1.16));
  R(-7, -1, 14, 2, def.sleeve);           // waistband
  R(-7, -10, 3, 12, shade(def.jacket, litSideDim(side)));
  if (facing < 0) {                       // a collar and a zip facing us
    R(-4, -8, 8, 2, def.sleeve);
    R(-1, -8, 2, 8, shade(def.jacket, 0.86));
  } else {                                // a number panel on the back
    R(-4, -7, 8, 7, shade(def.jacket, 1.1));
    R(-2, -5, 4, 3, def.accent);
  }

  /* a neck, so the head is not resting straight on the shoulders */
  R(-2, -12, 4, 3, shade(def.skin, 0.9));

  /* head: an 11px ball, then whatever this character has on top. It
     leans into the corner with the shoulders. */
  const hy = -23;
  if (turn) { cx += turn * 1; }
  R(-5, hy, 10, 11, def.skin);
  R(-5, hy, 10, 2, shade(def.skin, 1.08));
  R(-5, hy + 9, 10, 2, shade(def.skin, 0.88));
  R(-6, hy + 2, 1, 6, shade(def.skin, 0.9));   // ears
  R( 5, hy + 2, 1, 6, shade(def.skin, 0.9));

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

/* Three poses per facing: sitting square, and hauling the wheel each
   way. The rider was completely static before — nobody turned the
   wheel, nobody leaned — which for a game about two people was the
   detail most worth fixing. Poses are baked (the sprites are), and the
   bob and the flinch are applied live at draw time on top. */
const POSES = 3;
function buildAllKarts() {
  CHARS.forEach((def) => {
    const arr = [];
    for (let pz = 0; pz < POSES; pz++)
      for (let i = 0; i < ANGLES; i++) arr.push(buildKart(def, i, pz));
    kartSprites[def.id] = arr;
  });
}
function kartFrame(id, ai, pose) {
  const set = kartSprites[id];
  return set ? set[(pose | 0) * ANGLES + ai] : null;
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
/* --- scenery ---

   Everything that stands beside the track. Each piece is painted into a
   sheet and then cropped to what it actually covers, so the world height
   below is the height you see and the shadow matches the footprint.

   Two rules run through all of it.

   Nothing is a flat silhouette. Every solid is built with box3(), which
   draws a front, a receding side and a top in three different tones —
   a single-colour rectangle reads as a sticker no matter how much
   detail you paint on it, and three faces is the cheapest thing that
   reads as an object with a back to it.

   Nothing repeats. Most kinds have several variants and each instance
   picks one, so a street is a row of different houses rather than one
   house printed nine times.                                            */
const SCENERY = {
  pine:{ h:158, foot:.55, variants:4 }, tree:{ h:130, foot:.6, variants:3 },
  bush:{ h:26,  foot:.9,  variants:3 }, rock:{ h:24, foot:.9, variants:2 },
  cabin:{ h:132, foot:.9, smoke:true, variants:2 },
  house:{ h:126, foot:.9, smoke:true, variants:4 },
  store:{ h:126, foot:.95, variants:2 },
  shed:{ h:80,  foot:.9, smoke:true, variants:2 },
  lamp:{ h:112, foot:.3  }, postbox:{ h:30, foot:.8 }, hydrant:{ h:26, foot:.8 },
  signpost:{ h:76, foot:.35 }, flowerbox:{ h:22, foot:.95, variants:2 },
  mailbox:{ h:34, foot:.5 }, bike:{ h:30, foot:.8 }, hoop:{ h:96, foot:.35 },
  pole:{ h:104, foot:.35 }, cart:{ h:58, foot:.8 },  chair:{ h:46, foot:.7 },
  plant:{ h:48, foot:.8, variants:2 }, vending:{ h:80, foot:.85 },
  sign:{ h:72, foot:.4, variants:2 }, bench:{ h:38, foot:.95 },
  laundry:{ h:108, foot:.3 }, cat:{ h:18, foot:.85, variants:3 },
  vent:{ h:44, foot:.9 }, watertank:{ h:122, foot:.7 },
  acunit:{ h:40, foot:.9 }, skylight:{ h:26, foot:.95 }, dish:{ h:52, foot:.5 },
  stringpole:{ h:112, foot:.25 }, planter:{ h:32, foot:.95 },
  trafficlight:{ h:104, foot:.3 }, shelter:{ h:86, foot:.95 },
  car:{ h:44, foot:.95, variants:3 },
  /* the track furniture — these stand ON the road, not beside it */
  log:{ h:30, foot:1 , variants:2 }, sprinkler:{ h:36, foot:.6 },
  ivpole:{ h:88, foot:.28, variants:2 }, washline:{ h:74, foot:.3, variants:2 },
};

/* WHAT EACH ONE DOES TO YOU

   Every course promised something in its blurb and then had nothing on
   the road to back it up. These are the promises kept. Radii are in
   world units; a kart is about 34 across. */
const HAZ = {
  log:      { r:27, effect:"spin"  },
  sprinkler:{ r:23, effect:"slick", cycle:3.1, duty:0.42 },
  /* a pole on castors goes flying rather than stopping you dead — the
     slalom is meant to be threaded, not survived */
  ivpole:   { r:18, effect:"knock" },
  washline: { r:28, effect:"snag"  },
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

/* AERIAL PERSPECTIVE

   A tree a hundred units away and one two thousand units away were
   rendering at identical saturation, which flattens the whole scene —
   distance is mostly read as things washing out towards the colour of
   the air. Repainting a sprite per frame is far too expensive, so each
   one gets a silhouette of itself filled with the track's haze colour,
   cached alongside it; drawing that over the sprite at an opacity taken
   from its depth blends it toward the horizon for the cost of one extra
   drawImage. */
const hazeCache = new Map();
const shadeCache = new Map();
let hazeKey = "";

function hazeSprite(img, id) {
  const k = id + "|" + hazeKey;
  let h = hazeCache.get(k);
  if (h) return h;
  const c = document.createElement("canvas");
  c.width = img.width; c.height = img.height;
  const g2 = c.getContext("2d");
  g2.drawImage(img, 0, 0);
  g2.globalCompositeOperation = "source-in";
  g2.fillStyle = hazeKey || "#ffffff";
  g2.fillRect(0, 0, c.width, c.height);
  hazeCache.set(k, c);
  return c;
}

/* The same trick as the haze silhouette, but dark: a shadow shaped like
   the thing throwing it. An ellipse under a house is a puddle; a
   house-shaped shadow lying away from the sun is a building standing in
   daylight. */
function shadowSprite(img, id) {
  let c = shadeCache.get(id);
  if (c) return c;
  c = document.createElement("canvas");
  c.width = img.width; c.height = img.height;
  const g2 = c.getContext("2d");
  g2.drawImage(img, 0, 0);
  g2.globalCompositeOperation = "source-in";
  g2.fillStyle = "#17121f";
  g2.fillRect(0, 0, c.width, c.height);
  shadeCache.set(id, c);
  return c;
}

/* Lay the silhouette flat on the ground: anchored at the foot, sheared
   along the sun's bearing and squashed towards the horizon. */
function castShadow(g, img, id, sx, sy, w, h, strength, fade) {
  const L = 0.62 * (strength || 1);
  const dx = Math.sin(sunRel) * L;
  const dy = -Math.cos(sunRel) * L * 0.34;
  g.save();
  /* a shadow fades into the distance with the thing throwing it — a
     full-strength shadow under a half-faded tree is the tell that the
     two are drawn by different code */
  g.globalAlpha = 0.26 * (fade == null ? 1 : fade);
  g.setTransform(1, 0, 0, 1, 0, 0);          // shear is applied by hand
  g.transform(cw / RW, 0, 0, ch / RH, shakeX, shakeY);
  g.transform(1, 0, -dx, -dy, sx, sy);
  g.drawImage(shadowSprite(img, id), -w / 2, -h, w, h);
  g.restore();
}

/* 0 at the near plane, rising to a cap far out */
const HAZE_NEAR = 260, HAZE_FAR = 2100, HAZE_MAX = 0.62;
function hazeAmount(z) {
  if (z <= HAZE_NEAR) return 0;
  return Math.min(HAZE_MAX, ((z - HAZE_NEAR) / (HAZE_FAR - HAZE_NEAR)) * HAZE_MAX);
}
function drawHazed(g, img, id, x, y, w, h, z, flip) {
  const a = hazeAmount(z);
  const put = (im) => {
    if (flip) { g.save(); g.translate(x + w / 2, 0); g.scale(-1, 1); g.drawImage(im, -w / 2, y, w, h); g.restore(); }
    else g.drawImage(im, x, y, w, h);
  };
  put(img);
  if (a > 0.01) {
    g.save(); g.globalAlpha = a; put(hazeSprite(img, id)); g.restore();
  }
}

/* Three colour casts. Two pines of the same variant standing next to
   each other still want to be different greens, and a tint costs one
   composited rectangle at bake time rather than anything per frame. */
const TINTS = [null, "rgba(70,110,150,.13)", "rgba(255,190,120,.13)"];

function buildScenery(kind, variant, def, tint) {
  /* the sun sits on one side per track, and the sprites are baked with
     that side lit — so the cache is keyed by which side that is */
  const sunX = def ? Math.cos(def.light != null ? def.light : -0.7) : 0.75;
  const litRight = sunX >= 0;
  const v = variant | 0;
  const ti = (tint | 0) % TINTS.length;
  const key = kind + "|" + v + "|" + ti + (litRight ? "|R" : "|L");
  if (sceneryCache[key]) return sceneryCache[key];

  const W = 128, H = 150;
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const g = c.getContext("2d");
  const mid = W / 2;

  /* a tiny deterministic stream, so a variant is the same every load */
  const rnd = mulberry(seedOf(kind + v, 5381));

  /* ---- shared painters ---- */
  const R = (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
  const poly = (pts, col) => {
    g.fillStyle = col; g.beginPath();
    pts.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])));
    g.closePath(); g.fill();
  };
  const LIT = 1.16, SIDE = 0.66, TOP = 1.24;
  /* the box recedes away from the sun, so the face you see most is lit */
  const sd = litRight ? -1 : 1;

  /* THE primitive: a solid with a front, a side and a top, each its own
     tone. Everything built out of these reads as having a back to it. */
  function box3(x, y, w, h, d, col, opts) {
    const o = opts || {};
    const dx = sd * d * 0.52, dy = -d * 0.40;
    const xs = sd < 0 ? x : x + w;
    /* side first, so the front edge sits over it cleanly */
    poly([[xs, y], [xs + dx, y + dy], [xs + dx, y + h + dy], [xs, y + h]], shade(col, SIDE));
    if (o.top !== false)
      poly([[x, y], [x + dx, y + dy], [x + w + dx, y + dy], [x + w, y]], shade(col, TOP));
    R(x, y, w, h, col);
    if (o.material) material(x, y, w, h, col, o.material);
    /* the seam where two faces meet, and the dark gather at the ground */
    g.save(); g.globalAlpha = 0.35; g.fillStyle = "#120e18";
    g.fillRect(Math.round(sd < 0 ? x : x + w - 1), Math.round(y), 1, Math.round(h));
    g.globalAlpha = 0.28;
    g.fillRect(Math.round(x), Math.round(y + h - 3), Math.round(w), 3);
    g.restore();
    return { dx, dy };
  }

  function material(x, y, w, h, col, kind2) {
    g.save();
    if (kind2 === "wood") {
      g.globalAlpha = 0.22;
      for (let yy = y + 3; yy < y + h; yy += 5) {
        g.fillStyle = shade(col, (yy & 1) ? 0.82 : 1.12);
        g.fillRect(Math.round(x), Math.round(yy), Math.round(w), 1);
      }
      g.globalAlpha = 0.16; g.fillStyle = shade(col, 0.7);
      for (let i = 0; i < 10; i++)
        g.fillRect(Math.round(x + ((i * 23) % Math.max(1, w - 10))),
                   Math.round(y + 4 + ((i * 37) % Math.max(1, h - 8))), 6 + (i % 3) * 3, 1);
    } else if (kind2 === "log") {
      g.globalAlpha = 0.30;
      for (let yy = y + 4; yy < y + h; yy += 7) {
        g.fillStyle = shade(col, 0.72);
        g.fillRect(Math.round(x), Math.round(yy), Math.round(w), 1);
        g.fillStyle = shade(col, 1.14);
        g.fillRect(Math.round(x), Math.round(yy + 1), Math.round(w), 2);
      }
      /* the cut ends of the logs at the corner */
      g.globalAlpha = 0.5; g.fillStyle = shade(col, 0.6);
      for (let yy = y + 4; yy < y + h; yy += 7)
        g.fillRect(Math.round(sd < 0 ? x : x + w - 3), Math.round(yy), 3, 4);
    } else if (kind2 === "brick") {
      g.globalAlpha = 0.20; g.fillStyle = shade(col, 0.62);
      for (let yy = y + 4, row = 0; yy < y + h; yy += 5, row++) {
        g.fillRect(Math.round(x), Math.round(yy), Math.round(w), 1);
        for (let xx = x + (row % 2 ? 5 : 0); xx < x + w; xx += 10)
          g.fillRect(Math.round(xx), Math.round(yy - 4), 1, 4);
      }
    } else if (kind2 === "siding") {
      g.globalAlpha = 0.20;
      for (let yy = y + 4; yy < y + h; yy += 6) {
        g.fillStyle = shade(col, 0.70); g.fillRect(Math.round(x), Math.round(yy), Math.round(w), 1);
        g.fillStyle = shade(col, 1.20); g.fillRect(Math.round(x), Math.round(yy + 1), Math.round(w), 1);
      }
    } else if (kind2 === "stucco") {
      g.globalAlpha = 0.12;
      for (let i = 0; i < 90; i++) {
        g.fillStyle = shade(col, i % 2 ? 1.2 : 0.8);
        g.fillRect(Math.round(x + rnd() * w), Math.round(y + rnd() * h), 2, 2);
      }
    } else if (kind2 === "panel") {
      g.globalAlpha = 0.18; g.fillStyle = shade(col, 0.68);
      for (let xx = x + 7; xx < x + w - 2; xx += 10) g.fillRect(Math.round(xx), Math.round(y + 2), 1, h - 4);
    }
    g.restore();
  }

  /* a pitched roof as a solid: gable end, receding slope, ridge, eaves */
  function gable(x, y, w, rise, d, col) {
    const over = 5;
    const x0 = x - over, x1 = x + w + over;
    const apex = y - rise, cx = x + w / 2;
    const dx = sd * d * 0.52, dy = -d * 0.40;
    /* the slope going back */
    poly([[cx, apex], [cx + dx, apex + dy], [x1 + dx, y + dy], [x1, y]], shade(col, 0.72));
    poly([[cx, apex], [cx + dx, apex + dy], [x0 + dx, y + dy], [x0, y]], shade(col, 0.58));
    /* the gable you are looking at */
    poly([[x0, y], [cx, apex], [x1, y]], col);
    /* shingle courses, clipped to the gable */
    g.save();
    g.beginPath(); g.moveTo(x0, y); g.lineTo(cx, apex); g.lineTo(x1, y); g.closePath(); g.clip();
    g.globalAlpha = 0.28;
    for (let yy = y - 3; yy > apex; yy -= 4) {
      g.fillStyle = shade(col, 0.7);
      g.fillRect(x0, Math.round(yy), x1 - x0, 1);
      const off = (((y - yy) / 4) | 0) % 2 ? 4 : 0;
      for (let xx = x0 + off; xx < x1; xx += 8) g.fillRect(Math.round(xx), Math.round(yy - 3), 1, 3);
    }
    g.restore();
    R(cx - 2, apex, 4, 3, shade(col, 1.25));          // ridge cap
    R(x0, y - 1, x1 - x0, 2, shade(col, 0.55));       // eaves
    R(x0, y + 1, x1 - x0, 1, "rgba(0,0,0,.32)");      // and their shadow
  }

  /* a flat roof with a parapet, for shops and towers */
  function parapet(x, y, w, d, col) {
    const dx = sd * d * 0.52, dy = -d * 0.40;
    poly([[x - 3, y], [x - 3 + dx, y + dy], [x + w + 3 + dx, y + dy], [x + w + 3, y]], shade(col, TOP));
    R(x - 3, y - 5, w + 6, 6, col);
    R(x - 3, y - 5, w + 6, 2, shade(col, LIT));
    R(x - 3, y + 1, w + 6, 2, "rgba(0,0,0,.3)");
  }

  function footing(x, y, w, h, col) {
    R(x - 2, y, w + 4, h, shade(col, 0.78));
    R(x - 2, y, w + 4, 1, shade(col, 1.12));
    g.save(); g.globalAlpha = 0.3; g.fillStyle = shade(col, 0.5);
    for (let xx = x; xx < x + w; xx += 7) g.fillRect(Math.round(xx), Math.round(y + 1), 1, h - 1);
    g.restore();
  }

  /* frame, panes, mullions, sill — and a warmer light deeper in */
  function window_(x, y, w, h, lit, frameCol) {
    R(x - 1.5, y - 1.5, w + 3, h + 3, frameCol || "#5b4634");
    R(x, y, w, h, lit ? "#ffd98a" : "#93a9c0");
    g.save(); g.globalAlpha = 0.55;
    g.fillStyle = lit ? "#ffab48" : "#74899e";
    g.fillRect(Math.round(x), Math.round(y + h * 0.52), Math.round(w), Math.round(h * 0.48));
    g.restore();
    R(x + w / 2 - 0.5, y, 1, h, frameCol || "#5b4634");
    R(x, y + h / 2 - 0.5, w, 1, frameCol || "#5b4634");
    g.save(); g.globalAlpha = 0.45; g.fillStyle = "#fff";
    g.fillRect(Math.round(x + 1), Math.round(y + 1), Math.round(w / 2 - 2), 1);
    g.restore();
    R(x - 2.5, y + h + 1.5, w + 5, 2, shade(frameCol || "#6d5540", 1.05));
    if (lit) {                                   // light spilling on the sill
      g.save(); g.globalAlpha = 0.2; g.fillStyle = "#ffd98a";
      g.fillRect(Math.round(x - 3), Math.round(y + h + 3), Math.round(w + 6), 2);
      g.restore();
    }
  }

  function door(x, y, w, h, col) {
    R(x, y, w, h, col);
    R(x, y, w, 1, shade(col, 1.3));
    R(x, y, 1, h, shade(col, litRight ? 1.18 : 0.82));
    g.save(); g.globalAlpha = 0.3; g.fillStyle = shade(col, 0.55);
    g.fillRect(Math.round(x + 2), Math.round(y + 2), Math.round(w - 4), Math.round(h * 0.34));
    g.fillRect(Math.round(x + 2), Math.round(y + h * 0.48), Math.round(w - 4), Math.round(h * 0.34));
    g.restore();
    R(x + w - 3, y + h * 0.5, 2, 2, "#ffd166");
    R(x - 2, y + h, w + 4, 2, "#b9a68e");            // the step
    R(x - 2, y + h + 2, w + 4, 1, "rgba(0,0,0,.3)");
  }

  function chimney(x, y, h, col, stone) {
    box3(x, y - h, 9, h, 6, col, { });
    if (stone) {
      g.save(); g.globalAlpha = 0.32; g.fillStyle = shade(col, 0.6);
      for (let yy = y - h + 3; yy < y; yy += 4)
        for (let xx = x + ((yy & 1) ? 0 : 3); xx < x + 9; xx += 5)
          g.fillRect(Math.round(xx), Math.round(yy), 3, 2);
      g.restore();
    }
    R(x - 1.5, y - h - 3, 12, 3, shade(col, 0.62));
  }

  /* =============== the pieces =============== */

  if (kind === "pine") {
    /* three shapes of conifer: tall and narrow, broad, and a young one */
    /* four genuinely different conifers: a tall spire, a broad old one,
       a young sapling, and a wind-thinned ragged one */
    const P = [{b:7,w:33,s:15,r:34},{b:5,w:47,s:20,r:25},
               {b:4,w:29,s:13,r:22},{b:6,w:39,s:17,r:28}][v % 4];
    const tip = ["#3e8850", "#46905a", "#4d9a5e", "#3a7f54"][v % 4];
    const dk  = ["#2e6b3c", "#2a6238", "#356f42", "#27603c"][v % 4];
    const trunkTop = H - 30;
    poly([[mid - 5, H], [mid - 2.5, trunkTop], [mid + 2.5, trunkTop], [mid + 5, H]], "#54391f");
    poly([[mid + (litRight ? 1 : -5), H], [mid + (litRight ? 1 : -2.5), trunkTop],
          [mid + (litRight ? 2.5 : -1), trunkTop], [mid + (litRight ? 5 : -1), H]],
         litRight ? "#6d4b2b" : "#412c18");
    for (let i = 0; i < P.b; i++) {
      const t = i / (P.b - 1);
      const base = H - 16 - i * P.s;
      /* the ragged variant loses width unevenly, which is what stops a
         treeline reading as the same cone printed over and over */
      const rag = v % 4 === 3 ? (i % 2 ? 0.82 : 1.06) : 1;
      const halfW = (P.w * (1 - t * 0.80) + 3) * rag;
      const rise = P.r - t * 8, teeth = 9 - i, hem = 9 - t * 4;
      g.beginPath();
      g.moveTo(mid, base - rise);
      for (let k = 0; k <= teeth; k++) {
        const f = k / teeth;
        g.lineTo(mid - halfW + halfW * 2 * f, base + (k % 2 ? hem : hem * 0.25));
      }
      g.closePath();
      g.fillStyle = i % 2 ? dk : shade(dk, 1.08); g.fill();
      g.save(); g.clip();
      g.fillStyle = i % 2 ? tip : shade(tip, 1.05);
      poly([[mid, base - rise],
            [mid + (litRight ? halfW : -halfW), base + hem],
            [mid + (litRight ? halfW * 0.18 : -halfW * 0.18), base + hem]], g.fillStyle);
      g.fillStyle = "rgba(18,40,26,.34)";
      g.fillRect(mid - halfW, base - rise, halfW * 2, 6);
      g.restore();
    }
    poly([[mid, H - 16 - (P.b - 1) * P.s - P.r - 4], [mid - 3, H - 16 - (P.b - 1) * P.s - 22],
          [mid + 3, H - 16 - (P.b - 1) * P.s - 22]], tip);

  } else if (kind === "tree") {
    /* round, tall-oval, and a wind-leaned one */
    const shapes = [
      [[0,-66,25],[-19,-56,19],[19,-55,19],[-10,-78,18],[11,-76,17],[-27,-44,14],[27,-43,14],[1,-50,21],[-14,-40,13],[15,-39,13]],
      [[0,-78,20],[-14,-64,17],[14,-63,17],[-6,-92,15],[7,-90,14],[-20,-50,13],[20,-49,13],[0,-58,19]],
      [[6,-64,24],[-14,-52,18],[22,-58,17],[-4,-80,16],[16,-76,15],[-22,-42,13],[26,-46,12],[4,-50,20]],
    ][v % 3];
    const tone = [["#2c6b39","#3a8449","#4d9c5b","#63b26e"],
                  ["#2f6d40","#3d8a52","#519f63","#68b477"],
                  ["#356b34","#438442","#579b55","#6db26a"]][v % 3];
    const forkY = H - 34;
    poly([[mid - 6, H], [mid - 3, forkY], [mid + 3, forkY], [mid + 6, H]], "#5f4126");
    R(mid + (litRight ? 1 : -5), forkY, 4, H - forkY, litRight ? "#79532f" : "#48311c");
    /* bark */
    g.save(); g.globalAlpha = 0.3; g.fillStyle = "#3d2a17";
    for (let i = 0; i < 9; i++) g.fillRect(mid - 4 + (i % 3) * 3, forkY + 3 + i * 3, 1, 4);
    g.restore();
    g.strokeStyle = "#5f4126"; g.lineWidth = 5; g.lineCap = "round";
    g.beginPath(); g.moveTo(mid, forkY + 4); g.lineTo(mid - 13, forkY - 16); g.stroke();
    g.beginPath(); g.moveTo(mid, forkY + 4); g.lineTo(mid + 12, forkY - 18); g.stroke();
    g.lineWidth = 3;
    g.beginPath(); g.moveTo(mid - 9, forkY - 10); g.lineTo(mid - 18, forkY - 22); g.stroke();
    g.beginPath(); g.moveTo(mid + 8, forkY - 12); g.lineTo(mid + 17, forkY - 24); g.stroke();

    const canopy = () => {
      g.beginPath();
      shapes.forEach(([bx, by, br]) => { g.moveTo(mid + bx + br, H + by); g.arc(mid + bx, H + by, br, 0, TWO_PI); });
    };
    canopy(); g.fillStyle = tone[0]; g.fill();
    g.save(); canopy(); g.clip();
    g.fillStyle = tone[1];
    shapes.forEach(([bx, by, br]) => { g.beginPath(); g.arc(mid + bx, H + by - br * 0.22, br * 0.94, 0, TWO_PI); g.fill(); });
    const sx2 = litRight ? 1 : -1;
    g.fillStyle = tone[2];
    shapes.forEach(([bx, by, br]) => { g.beginPath(); g.arc(mid + bx + br * 0.30 * sx2, H + by - br * 0.34, br * 0.68, 0, TWO_PI); g.fill(); });
    g.fillStyle = tone[3];
    shapes.slice(0, 5).forEach(([bx, by, br]) => { g.beginPath(); g.arc(mid + bx + br * 0.44 * sx2, H + by - br * 0.46, br * 0.38, 0, TWO_PI); g.fill(); });
    g.fillStyle = "rgba(24,52,32,.55)";
    [[-6,-60,4],[12,-64,3],[-20,-50,3]].forEach(([bx,by,br]) => { g.beginPath(); g.arc(mid+bx, H+by, br, 0, TWO_PI); g.fill(); });
    g.fillStyle = "rgba(206,238,180,.34)";
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * TWO_PI, rr = 30 + (i % 3) * 6;
      if (litRight ? Math.cos(a) < -0.15 : Math.cos(a) > 0.15) continue;
      if (Math.sin(a) > 0.55) continue;
      g.fillRect(Math.round(mid + Math.cos(a) * rr * 0.95 + sx2 * 5),
                 Math.round(H - 62 + Math.sin(a) * rr * 0.62 - 4), 3, 2);
    }
    g.restore();
    g.save(); g.globalAlpha = 0.3; g.fillStyle = "#1c4326";
    g.beginPath(); g.ellipse(mid, forkY - 4, 16, 6, 0, 0, TWO_PI); g.fill(); g.restore();

  } else if (kind === "bush") {
    const sets = [[[0,-16,16],[-13,-10,12],[13,-10,12]],
                  [[0,-13,13],[-11,-8,10],[10,-9,11],[3,-19,9]],
                  [[-8,-12,12],[8,-14,13],[0,-8,10]]][v % 3];
    const col = ["#3f8a48", "#458f4e", "#3a8455"][v % 3];
    g.fillStyle = col;
    sets.forEach(([bx,by,br]) => { g.beginPath(); g.arc(mid+bx, H+by, br, 0, TWO_PI); g.fill(); });
    g.save();
    g.beginPath(); sets.forEach(([bx,by,br]) => { g.moveTo(mid+bx+br,H+by); g.arc(mid+bx, H+by, br, 0, TWO_PI); });
    g.clip();
    g.fillStyle = shade(col, 1.22);
    sets.forEach(([bx,by,br]) => { g.beginPath(); g.arc(mid+bx+(litRight?br*0.3:-br*0.3), H+by-br*0.3, br*0.66, 0, TWO_PI); g.fill(); });
    g.restore();
    if (v !== 2) [[-8,-20],[6,-16],[-2,-25]].forEach(([bx,by],i) =>
      R(mid+bx, H+by, 3, 3, i%2 ? "#ff9ec4" : "#fff1e0"));

  } else if (kind === "rock") {
    const P = v % 2 ? [20,26,10] : [18,22,8];
    poly([[mid-P[0], H],[mid-P[0]*0.6, H-P[1]],[mid+P[2]*0.4, H-P[1]-3],[mid+P[0], H]], "#8c8577");
    poly([[mid+1, H-P[1]-1],[mid+P[0], H],[mid+P[0]*0.35, H]], litRight ? "#a49c8c" : "#767065");
    g.fillStyle = "rgba(255,255,255,.2)";
    poly([[mid-6,H-P[1]*0.7],[mid+2,H-P[1]],[mid+5,H-P[1]*0.45]], g.fillStyle);
    g.save(); g.globalAlpha = 0.25; g.fillStyle = "#4f4a44";
    for (let i = 0; i < 7; i++) g.fillRect(mid - P[0] + rnd() * P[0] * 2, H - rnd() * P[1], 2, 2);
    g.restore();

  } else if (kind === "cabin") {
    const wallCol = v % 2 ? "#8a6a4a" : "#7d6144";
    footing(mid - 32, H - 8, 64, 8, "#7a6a58");
    box3(mid - 32, H - 48, 64, 40, 20, wallCol, { material: "log", top: false });
    gable(mid - 32, H - 48, 64, 26, 20, v % 2 ? "#7a3f30" : "#6b4a35");
    chimney(mid + (v % 2 ? 15 : -22), H - 62, 18, "#9a8c80", true);
    window_(mid - 24, H - 40, 14, 12, true);
    window_(mid + 10, H - 40, 14, 12, true);
    door(mid - 6, H - 27, 13, 19, "#5c3b26");
    R(mid - 14, H - 8, 28, 3, "#6f523a");
    R(mid - 15, H - 24, 2, 16, "#6f523a");
    R(mid + 13, H - 24, 2, 16, "#6f523a");
    R(mid - 17, H - 26, 34, 2, "#5e4630");
    for (let i = 0; i < 3; i++) R(mid + 24, H - 14 - i * 4, 10, 3, i % 2 ? "#8a6a4a" : "#7a5c3f");

  } else if (kind === "house") {
    /* four genuinely different houses, so a street is a street */
    const wallCols = ["#e0c3a4", "#cfd8c4", "#e8d4c0", "#d6c8dc"];
    const roofCols = ["#9c6152", "#6f7f8c", "#8c6a4a", "#7a6280"];
    const trimCols = ["#fff4e6", "#f2f6ee", "#fff0dc", "#f4eefa"];
    const wall = wallCols[v % 4], roof = roofCols[v % 4], trim = trimCols[v % 4];

    if (v % 4 === 0) {                       /* single-storey ranch, wide */
      footing(mid - 36, H - 8, 72, 8, "#9a8a76");
      box3(mid - 36, H - 42, 72, 34, 22, wall, { material: "siding", top: false });
      gable(mid - 36, H - 42, 72, 18, 22, roof);
      chimney(mid + 20, H - 54, 13, "#a8705c");
      window_(mid - 28, H - 36, 15, 12, false, trim);
      window_(mid + 12, H - 36, 15, 12, true, trim);
      door(mid - 6, H - 26, 13, 18, "#7d5340");
      R(mid - 22, H - 8, 44, 3, "#c8a98c");
      R(mid - 22, H - 25, 2, 17, trim); R(mid + 20, H - 25, 2, 17, trim);
      R(mid - 24, H - 28, 48, 3, shade(roof, 0.9));

    } else if (v % 4 === 1) {                /* two-storey colonial */
      footing(mid - 28, H - 8, 56, 8, "#9a8a76");
      box3(mid - 28, H - 58, 56, 50, 20, wall, { material: "siding", top: false });
      gable(mid - 28, H - 58, 56, 20, 20, roof);
      chimney(mid - 20, H - 70, 15, "#a8705c");
      window_(mid - 21, H - 52, 12, 11, true,  trim);
      window_(mid + 9,  H - 52, 12, 11, false, trim);
      window_(mid - 21, H - 33, 12, 11, false, trim);
      window_(mid + 9,  H - 33, 12, 11, true,  trim);
      door(mid - 6, H - 26, 13, 18, "#5f4a6b");
      R(mid - 12, H - 30, 25, 3, shade(roof, 0.9));   // door hood
      R(mid - 11, H - 27, 2, 1, trim);

    } else if (v % 4 === 2) {                /* cottage with a wrap porch */
      footing(mid - 30, H - 8, 60, 8, "#9a8a76");
      box3(mid - 30, H - 44, 60, 36, 18, wall, { material: "stucco", top: false });
      gable(mid - 30, H - 44, 60, 22, 18, roof);
      window_(mid - 22, H - 38, 13, 11, true, trim);
      window_(mid + 10, H - 38, 13, 11, true, trim);
      door(mid - 5, H - 26, 12, 18, "#8a5a44");
      /* the porch: deck, four posts, a scalloped valance */
      R(mid - 34, H - 8, 68, 3, "#c8a98c");
      for (const px of [-34, -14, 12, 31]) R(mid + px, H - 27, 2, 19, trim);
      R(mid - 36, H - 30, 72, 3, shade(roof, 0.85));
      g.fillStyle = shade(roof, 1.05);
      for (let x = mid - 36; x < mid + 37; x += 5) { g.beginPath(); g.arc(x + 2, H - 27, 2.5, 0, Math.PI); g.fill(); }
      R(mid + 14, H - 34, 16, 5, "#8c5b4a");
      [0,4,8,12].forEach((o,i) => R(mid + 15 + o, H - 37, 3, 3, ["#ff9ec4","#ffe07a","#fff1e0","#ff7f8a"][i]));

    } else {                                  /* small bungalow, hipped */
      footing(mid - 24, H - 6, 48, 6, "#9a8a76");
      box3(mid - 24, H - 36, 48, 30, 16, wall, { material: "siding", top: false });
      /* a hipped roof: shallow, with the ridge short */
      const dx = sd * 16 * 0.52, dy = -16 * 0.40;
      poly([[mid - 28, H - 36], [mid - 8, H - 50], [mid + 8, H - 50], [mid + 28, H - 36]], roof);
      poly([[mid - 8, H - 50], [mid + 8, H - 50], [mid + 8 + dx, H - 50 + dy], [mid - 8 + dx, H - 50 + dy]], shade(roof, 1.15));
      poly([[mid + 8, H - 50], [mid + 28, H - 36], [mid + 28 + dx, H - 36 + dy], [mid + 8 + dx, H - 50 + dy]], shade(roof, 0.7));
      R(mid - 28, H - 37, 56, 2, shade(roof, 0.55));
      window_(mid - 18, H - 31, 13, 11, true, trim);
      door(mid + 4, H - 24, 12, 18, "#6b5340");
      R(mid + 2, H - 28, 17, 3, shade(roof, 0.9));
    }
    /* every house gets a path out to the kerb */
    R(mid - 5, H - 4, 11, 4, "#c9c2b4");
    R(mid - 5, H - 4, 11, 1, "#dcd6ca");

  } else if (kind === "store") {
    const wall = v % 2 ? "#cbb59a" : "#b9c2cc";
    footing(mid - 36, H - 8, 72, 8, "#8e8378");
    box3(mid - 36, H - 54, 72, 46, 24, wall, { material: "brick", top: false });
    parapet(mid - 36, H - 54, 72, 24, shade(wall, 0.85));
    for (let i = 0, x = mid - 36; x < mid + 36; x += 8, i++) {
      poly([[x, H - 34], [x + 8, H - 34], [x + 8, H - 27], [x, H - 27]],
           i % 2 ? (v % 2 ? "#ff9ec4" : "#7ec8e3") : "#fff1e0");
    }
    R(mid - 36, H - 27, 72, 2, "rgba(0,0,0,.28)");
    for (let i = 0; i < 3; i++) window_(mid - 32 + i * 22, H - 24, 18, 14, true, "#6f5a44");
    door(mid + 24, H - 24, 11, 16, "#6f5a44");
    R(mid - 3, H - 46, 6, 2, "#6f5a44");
    R(mid - 13, H - 44, 26, 9, v % 2 ? "#7ec8e3" : "#ffd166");
    R(mid - 13, H - 44, 26, 1, "rgba(255,255,255,.6)");
    for (let i = 0; i < 4; i++) R(mid - 9 + i * 5, H - 41, 3, 3, "#2e4a58");

  } else if (kind === "shed") {
    /* A lean-to, seated properly.

       The first version drew a flat wall top and then a roof that rose
       ten pixels above it on the high side, with nothing filling the
       triangle underneath — so the roof read as a slab floating off the
       building at the wrong angle. The wall now carries a gable wedge up
       to meet the roof, and the roof sits on it with an eave overhang,
       which is what makes it look attached rather than balanced there. */
    const hi = v % 2 ? 12 : 10;              // how far the high side lifts
    const wallCol = v % 2 ? "#9a7a52" : "#8b7157";
    const roofCol = v % 2 ? "#6a4030" : "#5d5342";
    const L = mid - 20, Rt = mid + 20, top = H - 34;
    footing(L, H - 6, 40, 6, "#7a6a58");
    box3(L, top, 40, 28, 14, wallCol, { material: "wood", top: false });
    /* the wedge that carries the roof up to its high edge */
    poly([[L, top], [Rt, top - hi], [Rt, top], [L, top]], wallCol);
    material(L, top - hi, 40, hi + 2, wallCol, "wood");
    poly([[L, top], [Rt, top - hi], [Rt, top]], shade(wallCol, 0.9));

    const dx = sd * 14 * 0.52, dy = -14 * 0.40;
    /* the roof plane, overhanging both ends, and its fascia */
    poly([[L - 5, top + 2], [Rt + 5, top - hi - 1],
          [Rt + 5 + dx, top - hi - 1 + dy], [L - 5 + dx, top + 2 + dy]], shade(roofCol, 1.12));
    poly([[L - 5, top + 2], [Rt + 5, top - hi - 1],
          [Rt + 5, top - hi + 3], [L - 5, top + 6]], roofCol);
    /* plank lines running down the slope */
    g.save();
    g.beginPath();
    g.moveTo(L - 5, top + 2); g.lineTo(Rt + 5, top - hi - 1);
    g.lineTo(Rt + 5 + dx, top - hi - 1 + dy); g.lineTo(L - 5 + dx, top + 2 + dy);
    g.closePath(); g.clip();
    g.globalAlpha = 0.3; g.strokeStyle = shade(roofCol, 0.7); g.lineWidth = 1;
    for (let k = -5; k <= 45; k += 6) {
      g.beginPath();
      g.moveTo(L + k, top + 2 - k * (hi / 50));
      g.lineTo(L + k + dx, top + 2 - k * (hi / 50) + dy);
      g.stroke();
    }
    g.restore();
    door(mid - 7, H - 26, 13, 20, "#5c3b26");
    window_(mid + 8, H - 30, 9, 8, v % 2 === 0);
    if (v % 2) {                              // a water butt against the wall
      box3(mid + 20, H - 20, 9, 14, 6, "#5f6b52", { top: true });
      R(mid + 19, H - 21, 11, 2, "#75835f");
    }

  } else if (kind === "lamp") {
    R(mid - 4, H - 6, 8, 6, "#4a4650");
    R(mid - 4, H - 6, 8, 1, "#5e5a66");
    box3(mid - 2, H - 64, 4, 58, 3, "#544f5e", { top: false });
    R(mid - 10, H - 72, 20, 8, "#6a6675");
    R(mid - 10, H - 72, 20, 2, "#847f92");
    R(mid - 8, H - 70, 16, 5, "#ffe6a8");
    g.save(); g.globalAlpha = 0.32; g.fillStyle = "#ffd166";
    g.beginPath(); g.arc(mid, H - 66, 18, 0, TWO_PI); g.fill();
    /* the pool of light it throws on the ground */
    g.globalAlpha = 0.22;
    g.beginPath(); g.ellipse(mid, H - 2, 22, 7, 0, 0, TWO_PI); g.fill();
    g.restore();
    R(mid + 7, H - 58, 2, 5, "#544f5e");
    R(mid + 4, H - 53, 9, 4, "#8c5b4a");
    [0,3,6].forEach((o,i) => R(mid + 4 + o, H - 56, 3, 3, ["#ff9ec4","#ffe07a","#ff7f8a"][i]));

  } else if (kind === "postbox") {
    R(mid - 5, H - 6, 10, 6, "#6a5550");
    box3(mid - 9, H - 32, 18, 26, 9, "#c0524f", { top: false });
    g.fillStyle = "#a8403f"; g.beginPath(); g.arc(mid, H - 32, 9, Math.PI, 0); g.fill();
    g.fillStyle = "#cf615e"; g.beginPath(); g.arc(mid - 2, H - 33, 5, Math.PI, 0); g.fill();
    R(mid - 6, H - 27, 12, 3, "#2f2530");
    R(mid - 6, H - 18, 12, 1, "#8e3a38");

  } else if (kind === "hydrant") {
    R(mid - 7, H - 4, 14, 4, "#7a3a36");
    box3(mid - 5, H - 22, 10, 18, 6, "#c85a4e", { top: false });
    R(mid - 9, H - 18, 18, 3, "#c85a4e");
    R(mid - 9, H - 18, 18, 1, "#dd7566");
    g.fillStyle = "#d97a6b"; g.beginPath(); g.arc(mid, H - 22, 5, Math.PI, 0); g.fill();
    R(mid - 1.5, H - 29, 3, 5, "#8a3f3c");
    R(mid - 3, H - 30, 6, 2, "#a04c46");

  } else if (kind === "signpost") {
    box3(mid - 2, H - 52, 4, 52, 3, "#6f5a44", { top: false });
    poly([[mid - 27, H - 48], [mid + 2, H - 48], [mid + 2, H - 40], [mid - 27, H - 40], [mid - 32, H - 44]], "#fff1e0");
    R(mid - 27, H - 42, 29, 2, "#e0d0b6");
    for (let i = 0; i < 4; i++) R(mid - 24 + i * 5, H - 46, 3, 2, "#7a5c3f");
    poly([[mid - 2, H - 36], [mid + 25, H - 36], [mid + 30, H - 32], [mid + 25, H - 28], [mid - 2, H - 28]], "#ffd9a0");
    for (let i = 0; i < 3; i++) R(mid + 3 + i * 5, H - 34, 3, 2, "#7a5c3f");

  } else if (kind === "flowerbox" || kind === "planter") {
    const w = kind === "planter" ? 20 : 17;
    box3(mid - w, H - 12, w * 2, 12, 8, "#8c5b4a", { top: false });
    R(mid - w, H - 14, w * 2, 3, "#a8705c");
    R(mid - w + 2, H - 16, w * 2 - 4, 3, "#3f7a48");
    const cols = ["#ff9ec4","#ffe07a","#fff1e0","#ff7f8a","#ffc4a3","#c8a8ff"];
    for (let i = 0; i * 4 < w * 2 - 4; i++)
      R(mid - w + 2 + i * 4, H - 20, 3, 4, cols[(i + v) % cols.length]);

  } else if (kind === "mailbox") {
    box3(mid - 1.5, H - 24, 3, 24, 3, "#6f5a44", { top: false });
    box3(mid - 8, H - 34, 16, 10, 8, "#7f8c9c", { top: true });
    R(mid + 6, H - 33, 2, 6, "#c0524f");            // the flag, up
    R(mid + 5, H - 34, 4, 3, "#c0524f");

  } else if (kind === "bike") {
    g.strokeStyle = "#3a3540"; g.lineWidth = 2;
    g.beginPath(); g.arc(mid - 8, H - 8, 7, 0, TWO_PI); g.stroke();
    g.beginPath(); g.arc(mid + 9, H - 8, 7, 0, TWO_PI); g.stroke();
    g.strokeStyle = "#e8556f"; g.lineWidth = 2.4;
    g.beginPath(); g.moveTo(mid - 8, H - 8); g.lineTo(mid - 1, H - 20);
    g.lineTo(mid + 9, H - 8); g.moveTo(mid - 1, H - 20); g.lineTo(mid + 4, H - 20);
    g.stroke();
    R(mid - 4, H - 23, 7, 2, "#2f2a34");

  } else if (kind === "hoop") {
    box3(mid - 2, H - 52, 4, 52, 3, "#6a6675", { top: false });
    R(mid - 12, H - 62, 24, 14, "#f2ede4");
    R(mid - 12, H - 62, 24, 2, "#ffffff");
    R(mid - 5, H - 56, 10, 6, "#c0524f");
    g.strokeStyle = "#e8863f"; g.lineWidth = 2;
    g.beginPath(); g.moveTo(mid - 6, H - 48); g.lineTo(mid + 6, H - 48); g.stroke();
    g.strokeStyle = "rgba(255,255,255,.7)"; g.lineWidth = 1;
    for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(mid - 5 + i * 3.3, H - 47); g.lineTo(mid - 3 + i * 2.2, H - 41); g.stroke(); }

  } else if (kind === "pole") {
    R(mid - 7, H - 4, 14, 4, "#98a2b3");
    box3(mid - 1.5, H - 66, 3, 62, 3, "#b9c2d1", { top: false });
    R(mid - 11, H - 70, 22, 4, "#b9c2d1");
    R(mid - 11, H - 70, 22, 1, "#dfe6ef");
    R(mid - 9, H - 64, 10, 17, "#e8f4ff");
    R(mid - 8, H - 60, 8, 11, "#a8d8ef");
    R(mid - 8, H - 60, 8, 2, "#c9e8f7");
    R(mid + 3, H - 66, 2, 13, "#cfd8e4");

  } else if (kind === "cart") {
    box3(mid - 19, H - 30, 38, 20, 12, "#e3e8f0", { top: true });
    R(mid - 19, H - 34, 38, 5, "#c3cbd8");
    R(mid - 19, H - 34, 38, 1, "#dfe5ee");
    box3(mid - 14, H - 48, 28, 14, 10, "#ff9ec4", { top: true });
    R(mid - 2, H - 48, 4, 14, "#fff1e0");
    R(mid - 14, H - 42, 28, 3, "#fff1e0");
    g.fillStyle = "#fff1e0";
    g.beginPath(); g.arc(mid - 3, H - 50, 3, 0, TWO_PI); g.arc(mid + 3, H - 50, 3, 0, TWO_PI); g.fill();
    [-15, 9].forEach((o) => { R(mid + o, H - 10, 7, 7, "#5a5f6b"); R(mid + o + 2, H - 8, 3, 3, "#8f96a4"); });

  } else if (kind === "chair") {
    box3(mid - 14, H - 24, 28, 6, 10, "#9fb4cc", { top: true });
    box3(mid - 14, H - 44, 5, 22, 8, "#9fb4cc", { top: true });
    R(mid - 15, H - 8, 5, 8, "#4f5865"); R(mid + 9, H - 8, 5, 8, "#4f5865");
    R(mid - 9, H - 20, 19, 2, "#8aa0ba");

  } else if (kind === "plant") {
    g.strokeStyle = "#3f7a48"; g.lineWidth = 2;
    for (let i = 0; i < 5; i++) {
      const t = -Math.PI / 2 + (i - 2) * (v % 2 ? 0.5 : 0.42);
      g.beginPath(); g.moveTo(mid, H - 16);
      g.lineTo(mid + Math.cos(t) * 12, H - 19 + Math.sin(t) * 15); g.stroke();
    }
    g.fillStyle = "#4f9e58";
    for (let i = 0; i < 5; i++) {
      const t = -Math.PI / 2 + (i - 2) * (v % 2 ? 0.5 : 0.42);
      g.beginPath();
      g.ellipse(mid + Math.cos(t) * 13, H - 21 + Math.sin(t) * 13, 5, 10, t + Math.PI / 2, 0, TWO_PI);
      g.fill();
    }
    g.fillStyle = "rgba(255,255,255,.2)";
    g.beginPath(); g.ellipse(mid + (litRight ? 6 : -6), H - 30, 4, 8, 0, 0, TWO_PI); g.fill();
    R(mid - 10, H - 18, 20, 4, "#d69a72");
    box3(mid - 8, H - 14, 16, 14, 8, "#c98f68", { top: false });

  } else if (kind === "vending") {
    footing(mid - 16, H - 5, 32, 5, "#6f7684");
    box3(mid - 16, H - 46, 32, 41, 12, "#5f7f9a", { material: "panel", top: true });
    R(mid - 12, H - 42, 16, 25, "#0f1a24");
    for (let r = 0; r < 4; r++)
      for (let cc = 0; cc < 4; cc++)
        R(mid - 11 + cc * 4, H - 41 + r * 6, 3, 5, ["#ff7f8a","#ffd166","#7ddba3","#7ec8e3"][(r+cc)%4]);
    g.save(); g.globalAlpha = 0.2; g.fillStyle = "#fff";
    poly([[mid - 12, H - 19],[mid - 12, H - 42],[mid - 4, H - 42]], "#fff");
    g.restore();
    R(mid + 6, H - 40, 8, 13, "#3f4a58");
    for (let i = 0; i < 3; i++) R(mid + 7, H - 38 + i * 4, 6, 2, "#7f8b9c");
    R(mid + 6, H - 24, 8, 4, "#2a323c");

  } else if (kind === "sign") {
    box3(mid - 2, H - 40, 4, 40, 3, "#9aa6b6", { top: false });
    box3(mid - 21, H - 62, 42, 22, 6, "#fff8e8", { top: true });
    R(mid - 18, H - 58, 36, 3, v % 2 ? "#7ec8e3" : "#7ddba3");
    for (let i = 0; i < 3; i++) R(mid - 18, H - 53 + i * 4, 22 - i * 5, 2, "#9fb0c4");
    g.fillStyle = "#ff7f8a";
    g.beginPath();
    g.moveTo(mid + 14, H - 47); g.bezierCurveTo(mid + 9, H - 52, mid + 11, H - 56, mid + 14, H - 53);
    g.bezierCurveTo(mid + 17, H - 56, mid + 19, H - 52, mid + 14, H - 47); g.fill();

  } else if (kind === "bench") {
    R(mid - 21, H - 6, 4, 6, "#6f7684"); R(mid + 17, H - 6, 4, 6, "#6f7684");
    for (let i = 0; i < 3; i++) R(mid - 23, H - 14 + i * 3, 46, 2, i % 2 ? "#b58a5f" : "#c9a06f");
    for (let i = 0; i < 3; i++) R(mid - 23, H - 30 + i * 4, 46, 3, "#c9a06f");
    R(mid - 23, H - 30, 46, 1, "#dcb885");

  } else if (kind === "laundry") {
    R(mid - 4, H - 6, 8, 6, "#5e5044");
    box3(mid - 2, H - 66, 4, 60, 3, "#7a6a58", { top: false });
    g.strokeStyle = "#d8cfc0"; g.lineWidth = 1;
    g.beginPath(); g.moveTo(mid - 32, H - 62); g.quadraticCurveTo(mid, H - 55, mid + 32, H - 62); g.stroke();
    const cols = ["#ff9ec4", "#ffe07a", "#7ec8e3", "#fff1e0", "#ffc4a3"];
    for (let i = 0; i < 5; i++) {
      const x = mid - 28 + i * 13;
      const sag = H - 61 + Math.sin((i / 4) * Math.PI) * 5;
      /* a hanging shape rather than a flat rectangle */
      poly([[x, sag], [x + 10, sag], [x + 11, sag + 17], [x - 1, sag + 17]], cols[i]);
      R(x, sag, 10, 2, shade(cols[i], 1.18));
      R(x - 1, sag + 17, 12, 1, "rgba(0,0,0,.22)");
      R(x + 3, sag - 2, 3, 2, "#c9b8a4");
    }

  } else if (kind === "watertank") {
    [-15, 11].forEach((o) => { box3(mid + o, H - 30, 4, 30, 3, "#5e5248", { top: false }); });
    R(mid - 17, H - 22, 34, 2, "#5e5248");
    box3(mid - 19, H - 66, 38, 36, 16, "#8a7461", { top: false });
    for (let i = 0; i < 3; i++) R(mid - 19, H - 60 + i * 11, 38, 2, "#6d5c4c");
    g.save(); g.globalAlpha = 0.22; g.fillStyle = "#5b4c3d";
    for (let x = mid - 17; x < mid + 18; x += 5) g.fillRect(x, H - 66, 1, 36);
    g.restore();
    poly([[mid - 21, H - 66], [mid, H - 80], [mid + 21, H - 66]], "#6d5c4c");
    poly([[litRight ? mid - 21 : mid + 21, H - 66], [mid, H - 80], [mid, H - 66]], "rgba(0,0,0,.22)");

  } else if (kind === "acunit") {
    /* Squarely a machine bolted to a roof: a boxed housing with a louvre
       grille and a small recessed fan. The old one was a big bare disc
       and read as an ambiguous icon rather than an object. */
    R(mid - 20, H - 5, 40, 5, "#4f4a58");
    box3(mid - 18, H - 30, 36, 25, 16, "#8d8894", { material: "panel", top: true });
    R(mid - 14, H - 27, 15, 19, "#5a5563");
    for (let yy = H - 25; yy < H - 9; yy += 3) R(mid - 13, yy, 13, 2, "#726d7c");
    g.fillStyle = "#3f3a48";
    g.beginPath(); g.arc(mid + 8, H - 18, 7, 0, TWO_PI); g.fill();
    g.strokeStyle = "#a49fac"; g.lineWidth = 1.6;
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * TWO_PI + 0.5;
      g.beginPath(); g.moveTo(mid + 8, H - 18);
      g.lineTo(mid + 8 + Math.cos(a) * 6, H - 18 + Math.sin(a) * 6); g.stroke();
    }
    R(mid + 7, H - 19, 2, 2, "#c6c1ce");
    R(mid - 18, H - 34, 8, 4, "#6e6976");           // the pipe run
    R(mid - 16, H - 40, 4, 7, "#6e6976");

  } else if (kind === "skylight") {
    R(mid - 18, H - 6, 36, 6, "#5e5a66");
    poly([[mid - 16, H - 6], [mid - 8, H - 20], [mid + 16, H - 20], [mid + 8, H - 6]], "#9fd6ea");
    poly([[mid - 8, H - 20], [mid + 16, H - 20], [mid + 16, H - 17], [mid - 8, H - 17]], "#cfeaf6");
    g.save(); g.globalAlpha = 0.35; g.fillStyle = "#fff";
    poly([[mid - 13, H - 8], [mid - 7, H - 18], [mid + 1, H - 18], [mid - 5, H - 8]], "#fff");
    g.restore();
    g.strokeStyle = "#6e6976"; g.lineWidth = 1.5;
    g.beginPath(); g.moveTo(mid - 4, H - 19); g.lineTo(mid + 4, H - 6); g.stroke();

  } else if (kind === "dish") {
    box3(mid - 2, H - 26, 4, 26, 3, "#6e6976", { top: false });
    g.save();
    g.translate(mid, H - 34); g.rotate(litRight ? -0.5 : 0.5);
    g.fillStyle = "#c6c1ce";
    g.beginPath(); g.ellipse(0, 0, 15, 11, 0, 0, TWO_PI); g.fill();
    g.fillStyle = "#9a95a4";
    g.beginPath(); g.ellipse(2, 1, 12, 8, 0, 0, TWO_PI); g.fill();
    g.fillStyle = "#6e6976"; g.fillRect(-1, -2, 8, 2);
    g.restore();

  } else if (kind === "trafficlight") {
    R(mid - 6, H - 5, 12, 5, "#3f3a48");
    box3(mid - 2, H - 56, 4, 51, 3, "#4a4650", { top: false });
    box3(mid - 8, H - 78, 16, 24, 8, "#3a3540", { top: true });
    [["#e8556f", -73], ["#ffd166", -66], ["#7ddba3", -59]].forEach(([col, yy]) => {
      g.fillStyle = col; g.beginPath(); g.arc(mid, H + yy, 4, 0, TWO_PI); g.fill();
      g.save(); g.globalAlpha = 0.3; g.fillStyle = col;
      g.beginPath(); g.arc(mid, H + yy, 8, 0, TWO_PI); g.fill(); g.restore();
    });

  } else if (kind === "shelter") {
    box3(mid - 24, H - 34, 3, 34, 6, "#6e7884", { top: false });
    box3(mid + 21, H - 34, 3, 34, 6, "#6e7884", { top: false });
    g.save(); g.globalAlpha = 0.42;
    R(mid - 21, H - 32, 42, 26, "#bcd6e4");
    g.restore();
    R(mid - 21, H - 32, 42, 1, "rgba(255,255,255,.5)");
    box3(mid - 27, H - 40, 54, 6, 12, "#8a94a2", { top: true });
    R(mid - 20, H - 12, 40, 4, "#c9a06f");           // the seat
    R(mid - 20, H - 12, 40, 1, "#dcb885");
    R(mid - 16, H - 30, 20, 12, "#ffd166");          // a lit poster
    R(mid - 15, H - 29, 18, 10, "#ffe9a8");

  } else if (kind === "car") {
    const body = ["#7f9ec4", "#c47f8a", "#8fb98f"][v % 3];
    R(mid - 22, H - 6, 44, 6, "rgba(0,0,0,.18)");
    box3(mid - 20, H - 18, 40, 13, 12, body, { top: true });
    /* the cabin, set back and glassed */
    box3(mid - 11, H - 28, 21, 10, 10, shade(body, 0.92), { top: true });
    R(mid - 9, H - 26, 17, 6, "#2e3a48");
    R(mid - 9, H - 26, 17, 1, "rgba(255,255,255,.35)");
    R(mid - 20, H - 12, 40, 2, shade(body, 1.2));
    R(mid + 16, H - 15, 4, 3, "#ffe6a8");            // lights
    R(mid - 20, H - 15, 4, 3, "#e8556f");
    [-14, 8].forEach((o) => {
      g.fillStyle = "#2a2530";
      g.beginPath(); g.arc(mid + o + 3, H - 5, 5, 0, TWO_PI); g.fill();
      g.fillStyle = "#6a6572";
      g.beginPath(); g.arc(mid + o + 3, H - 5, 2, 0, TWO_PI); g.fill();
    });

  } else if (kind === "vent") {
    box3(mid - 17, H - 24, 34, 24, 14, "#6f6a78", { material: "panel", top: true });
    for (let x = mid - 12; x < mid + 12; x += 6) R(x, H - 20, 3, 16, "#544f5e");
    R(mid - 12, H - 20, 24, 1, "#3f3b47");

  } else if (kind === "stringpole") {
    R(mid - 5, H - 6, 10, 6, "#4a4038");
    box3(mid - 2, H - 68, 4, 62, 3, "#5e5044", { top: false });
    [-1, 1].forEach((s2) => {
      g.strokeStyle = "rgba(60,50,44,.75)"; g.lineWidth = 1;
      g.beginPath(); g.moveTo(mid, H - 66);
      g.quadraticCurveTo(mid + s2 * 22, H - 57, mid + s2 * 44, H - 62); g.stroke();
      for (let i = 1; i <= 4; i++) {
        const t = i / 5;
        const x = mid + s2 * (44 * t);
        const y = H - 66 + (1 - (1 - t) * (1 - t)) * 9 - t * 4;
        const col = ["#ffd166", "#ff9ec4", "#7ec8e3", "#7ddba3"][i % 4];
        /* a bulb with a filament and its own halo, not a dot on a line */
        g.save(); g.globalAlpha = 0.4; g.fillStyle = col;
        g.beginPath(); g.arc(x, y + 3, 6, 0, TWO_PI); g.fill(); g.restore();
        R(x - 1, y, 3, 2, "#6b5f52");
        g.fillStyle = col;
        g.beginPath(); g.arc(x + 0.5, y + 4, 2.6, 0, TWO_PI); g.fill();
        g.fillStyle = "rgba(255,255,255,.8)";
        g.fillRect(Math.round(x), Math.round(y + 3), 1, 1);
      }
    });

  } else if (kind === "cat") {
    const coats = ["#3a3340", "#e8a060", "#f0e8d8"];
    const body = coats[v % 3];
    g.fillStyle = body;
    g.beginPath(); g.ellipse(mid, H - 11, 13, 11, 0, 0, TWO_PI); g.fill();
    g.beginPath(); g.arc(mid + 2, H - 26, 10, 0, TWO_PI); g.fill();
    poly([[mid - 6, H - 33], [mid - 2, H - 42], [mid + 3, H - 33]], body);
    poly([[mid + 5, H - 33], [mid + 10, H - 42], [mid + 12, H - 33]], body);
    g.fillStyle = "rgba(255,255,255,.16)";
    g.beginPath(); g.arc(mid + (litRight ? 6 : -3), H - 29, 5, 0, TWO_PI); g.fill();
    R(mid - 3, H - 28, 3, 3, "#ffd166"); R(mid + 5, H - 28, 3, 3, "#ffd166");
    R(mid - 2, H - 28, 1, 3, "#2a2230"); R(mid + 6, H - 28, 1, 3, "#2a2230");
    g.strokeStyle = body; g.lineWidth = 3;
    g.beginPath(); g.moveTo(mid - 12, H - 9);
    g.quadraticCurveTo(mid - 24, H - 16, mid - 19, H - 29); g.stroke();

  /* ---- track furniture: things that stand ON the road ---- */

  } else if (kind === "log") {
    /* A pine that came down off the hill and never got moved. Lying
       lengthways, sawn end towards you, so it reads as a cylinder
       rather than a brown stripe. */
    const bark = v ? "#6b5240" : "#7a5f47";
    const len = 74, rad = 12, y0 = H - 8 - rad * 2;
    /* the barrel */
    g.fillStyle = bark;
    g.beginPath(); g.roundRect ? g.roundRect(mid - len / 2, y0, len, rad * 2, rad)
                               : g.rect(mid - len / 2, y0, len, rad * 2);
    g.fill();
    /* lit along the top, dark in the gutter underneath */
    g.save(); g.globalAlpha = 0.5;
    R(mid - len / 2 + 3, y0 + 2, len - 6, 4, shade(bark, 1.26));
    g.globalAlpha = 0.42;
    R(mid - len / 2 + 3, y0 + rad * 2 - 6, len - 6, 5, shade(bark, 0.64));
    g.restore();
    /* bark: long broken ridges, not stripes */
    g.save(); g.globalAlpha = 0.30;
    for (let i = 0; i < 26; i++) {
      const bx = mid - len / 2 + 5 + rnd() * (len - 12);
      const by = y0 + 4 + rnd() * (rad * 2 - 9);
      g.fillStyle = shade(bark, rnd() < 0.5 ? 0.7 : 1.2);
      g.fillRect(Math.round(bx), Math.round(by), 3 + ((rnd() * 9) | 0), 1);
    }
    g.restore();
    /* the sawn end, with rings */
    const ex = sd < 0 ? mid - len / 2 : mid + len / 2 - 9;
    g.fillStyle = "#c9a877";
    g.beginPath(); g.ellipse(ex + 4, y0 + rad, 6, rad - 1, 0, 0, TWO_PI); g.fill();
    g.strokeStyle = "rgba(120,92,58,.55)"; g.lineWidth = 1;
    for (let rr = 2.5; rr < rad - 2; rr += 3.2) {
      g.beginPath(); g.ellipse(ex + 4, y0 + rad, rr * 0.45, rr, 0, 0, TWO_PI); g.stroke();
    }
    /* a snapped branch stub and a patch of moss, so no two read alike */
    poly([[mid + (v ? 13 : -16), y0 + 4], [mid + (v ? 22 : -25), y0 - 6],
          [mid + (v ? 25 : -28), y0 - 3], [mid + (v ? 16 : -13), y0 + 8]], shade(bark, 0.82));
    g.save(); g.globalAlpha = 0.55; g.fillStyle = "#6f9a5a";
    for (let i = 0; i < (v ? 14 : 6); i++)
      g.fillRect(Math.round(mid - len / 2 + 4 + rnd() * (len - 10)),
                 Math.round(y0 + 1 + rnd() * (v ? 8 : 4)), 4 + ((rnd() * 7) | 0), 2);
    g.restore();
    /* the second one has been down a lot longer: the bark has come away
       in a long strip and the heartwood underneath has gone silver */
    if (v) {
      g.save();
      g.fillStyle = "#a89078";
      g.beginPath();
      g.moveTo(mid - 20, y0 + rad * 0.5);
      g.quadraticCurveTo(mid - 2, y0 + rad * 0.1, mid + 20, y0 + rad * 0.6);
      g.quadraticCurveTo(mid - 2, y0 + rad * 1.0, mid - 20, y0 + rad * 0.5);
      g.fill();
      g.globalAlpha = 0.35; g.fillStyle = "#7a6650";
      for (let xx = mid - 17; xx < mid + 17; xx += 5)
        g.fillRect(Math.round(xx), Math.round(y0 + rad * 0.42), 1, 6);
      g.restore();
      /* and a split running out from the sawn end */
      g.save(); g.globalAlpha = 0.45;
      g.strokeStyle = "#3f3126"; g.lineWidth = 1;
      g.beginPath();
      g.moveTo(sd < 0 ? mid - len / 2 + 8 : mid + len / 2 - 8, y0 + rad);
      g.lineTo(mid + (sd < 0 ? -6 : 6), y0 + rad * 1.35);
      g.stroke();
      g.restore();
    }

  } else if (kind === "sprinkler") {
    /* just the head — the water is drawn live, because it pulses */
    g.fillStyle = "#5f7a4e";
    g.beginPath(); g.ellipse(mid, H - 6, 11, 4, 0, 0, TWO_PI); g.fill();
    g.fillStyle = "#7c9a66";
    g.beginPath(); g.ellipse(mid, H - 7, 9, 3, 0, 0, TWO_PI); g.fill();
    box3(mid - 3, H - 18, 6, 12, 5, "#8a9aa6", { top: true });
    R(mid - 5, H - 21, 10, 4, "#b3c0c8");
    R(mid - 5, H - 21, 10, 1, "#e2eaee");
    /* the nozzle, cocked over the way it throws */
    poly([[mid + sd * 4, H - 20], [mid + sd * 13, H - 25],
          [mid + sd * 14, H - 22], [mid + sd * 5, H - 17]], "#9fb0ba");
    R(mid - 1, H - 24, 2, 4, "#cfd9de");

  } else if (kind === "ivpole") {
    /* chrome stand, castor base, a bag of something hopeful */
    [-9, 0, 9].forEach((o) => {
      g.strokeStyle = "#6d7a89"; g.lineWidth = 2;
      g.beginPath(); g.moveTo(mid, H - 10); g.lineTo(mid + o, H - 4); g.stroke();
      g.fillStyle = "#3d4552";
      g.beginPath(); g.arc(mid + o, H - 3, 2.4, 0, TWO_PI); g.fill();
    });
    /* Against the ward's white walls a chrome pole disappears. A mint
       bumper collar at knee height is what makes it read as an object
       standing in the road from far enough away to do something about
       it — and it is the kind of thing a real ward would have. */
    R(mid - 2, H - 74, 4, 65, "#8d9aa8");
    R(mid - 2, H - 74, 1, 65, "#dbe4ec");          // the chrome highlight
    R(mid + 1, H - 74, 1, 65, "#5d6875");
    R(mid - 4, H - 30, 8, 5, "#5ab8a6");
    R(mid - 4, H - 30, 8, 1, "#8fded0");
    R(mid - 4, H - 26, 8, 1, "#3d8c7e");
    /* the T-bar */
    R(mid - 11, H - 76, 22, 3, "#aab6c2");
    R(mid - 11, H - 76, 22, 1, "#e6edf3");
    const bags = v ? 2 : 1;
    for (let i = 0; i < bags; i++) {
      const bx = mid + (bags === 1 ? 0 : (i ? 8 : -8));
      /* Saturated, not pale. The ward's road is #e9edf5 and the bags
         used to be #dff0f7 — a hundred and thirteen units apart in RGB,
         which is to say invisible. A thing standing in the road has to
         be a different colour from the road. */
      const col = i ? "#f2a1bb" : "#7fcfc0";
      g.strokeStyle = "#8f9aa6"; g.lineWidth = 1;
      g.beginPath(); g.moveTo(bx, H - 74); g.lineTo(bx, H - 68); g.stroke();
      poly([[bx - 7, H - 69], [bx + 7, H - 69], [bx + 6, H - 47], [bx - 6, H - 47]], "#3f4a55");
      poly([[bx - 6, H - 68], [bx + 6, H - 68], [bx + 5, H - 48], [bx - 5, H - 48]], col);
      g.save(); g.globalAlpha = 0.5;
      R(bx - 6, H - 68, 3, 20, shade(col, 1.12));
      R(bx + 3, H - 68, 3, 20, shade(col, 0.84));
      g.restore();
      R(bx - 5, H - 58, 10, 8, shade(col, 0.9));   // the fill line
      g.strokeStyle = "rgba(140,150,160,.8)";
      g.beginPath(); g.moveTo(bx, H - 48); g.lineTo(bx + 1, H - 34); g.stroke();
    }

  } else if (kind === "washline") {
    /* somebody's washing, strung too low, right where you want to be */
    box3(mid - 2, H - 70, 4, 65, 4, "#8c7a62", { top: false });
    R(mid - 9, H - 72, 18, 3, "#7a6a55");
    g.strokeStyle = "rgba(60,52,44,.8)"; g.lineWidth = 1;
    g.beginPath(); g.moveTo(mid - 30, H - 68);
    g.quadraticCurveTo(mid, H - 62, mid + 30, H - 68); g.stroke();
    const wash = v ? ["#ffd9c2", "#cfe6f2", "#ffe9a8"] : ["#e8dff2", "#d6f0dc", "#ffd0d8"];
    [-19, 0, 19].forEach((o, i) => {
      const col = wash[i % 3];
      const top = H - 66 + Math.abs(o) * -0.09 + 3;
      const w2 = 15 - i % 2 * 3, h2 = 26 + (i % 2) * 7;
      /* two pegs and a sheet that hangs with a bit of a belly */
      R(mid + o - 1, top - 3, 2, 4, "#c08a5a");
      g.fillStyle = col;
      g.beginPath();
      g.moveTo(mid + o - w2 / 2, top);
      g.lineTo(mid + o + w2 / 2, top);
      g.quadraticCurveTo(mid + o + w2 / 2 + 2, top + h2 * 0.6, mid + o + w2 / 2 - 1, top + h2);
      g.quadraticCurveTo(mid + o, top + h2 + 3, mid + o - w2 / 2 + 1, top + h2);
      g.quadraticCurveTo(mid + o - w2 / 2 - 2, top + h2 * 0.6, mid + o - w2 / 2, top);
      g.fill();
      g.save(); g.globalAlpha = 0.42;
      R(mid + o - w2 / 2, top, 4, h2, shade(col, litRight ? 0.78 : 1.18));
      R(mid + o + w2 / 2 - 4, top, 4, h2, shade(col, litRight ? 1.18 : 0.78));
      g.restore();
      g.save(); g.globalAlpha = 0.22; g.fillStyle = shade(col, 0.7);
      for (let yy = top + 5; yy < top + h2; yy += 6)
        g.fillRect(Math.round(mid + o - w2 / 2 + 2), Math.round(yy), w2 - 4, 1);
      g.restore();
    });
  }

  if (TINTS[ti]) {
    g.globalCompositeOperation = "source-atop";
    g.fillStyle = TINTS[ti];
    g.fillRect(0, 0, W, H);
    g.globalCompositeOperation = "source-over";
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
let shakeX = 0, shakeY = 0;
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
  const PW = PANO_W * PANO_K, PH = PANO_H * PANO_K;
  const draw = (cvs2, rate, y, alpha) => {
    if (!cvs2) return;
    const off = (((camA / TWO_PI) * PW * rate) % PW + PW) % PW;
    g.globalAlpha = alpha;
    g.drawImage(cvs2, -off, y, PW, PH);
    g.drawImage(cvs2, -off + PW, y, PW, PH);
    if (off < RW) g.drawImage(cvs2, -off - PW, y, PW, PH);
    g.globalAlpha = 1;
  };
  /* Only genuinely distant things live up here, and they respond to the
     camera turning and nothing else. A band pretending to be midground
     was the other half of the "props don't stay put" problem: it slid
     with rotation but not with travel, so driving straight down a road
     it hung motionless while the world went past it. Anything close
     enough to need travel parallax is a real world-space billboard now,
     and gets it for free from the projection. */
  draw(panoFar, 0.55, HORIZON - PH + 8 * PANO_K, 0.8);
  draw(panoCvs, 1.0,  HORIZON - PH + 4 * PANO_K, 1);

  /* Clouds drift on their own clock as well as with the camera — the
     one thing up there that is allowed to move by itself. */
  if (def.clouds !== false) {
    g.save();
    g.globalAlpha = 0.5;
    g.fillStyle = def.cloud || "rgba(255,255,255,.85)";
    for (let i = 0; i < 7; i++) {
      const spd = 5 + (i % 3) * 3;
      const cx = (((i * 137 + raceTime * spd - (camA / TWO_PI) * PW * 0.35) % (RW + 200)) + RW + 200) % (RW + 200) - 100;
      const cy = 10 + (i * 13) % Math.max(12, HORIZON - 46);
      const r = 7 + (i % 4) * 4;
      g.beginPath();
      g.arc(cx, cy, r, 0, TWO_PI);
      g.arc(cx + r, cy + 2, r * 0.72, 0, TWO_PI);
      g.arc(cx - r * 0.9, cy + 3, r * 0.6, 0, TWO_PI);
      g.fill();
    }
    g.restore();
  }
}

/* --- distance haze, so the far road melts into the sky. Kept shallow
   and light on purpose: laid on too thick it stops reading as distance
   and starts reading as a lake sitting across the track. --- */
function renderHaze(def) {
  const g = sceneCtx;
  const hz = 44 * PANO_K;
  const grad = g.createLinearGradient(0, HORIZON, 0, HORIZON + hz);
  grad.addColorStop(0, def.haze);
  grad.addColorStop(1, "rgba(255,255,255,0)");
  g.globalAlpha = 0.6;
  g.fillStyle = grad;
  g.fillRect(0, HORIZON, RW, hz);
  g.globalAlpha = 1;
}

/* --- billboards --- */
function projectSprite(wx, wy, camX, camY, camA) {
  const dx = wx - camX, dy = wy - camY;
  const cosA = Math.cos(camA), sinA = Math.sin(camA);
  const z =  dx * cosA + dy * sinA;
  const x = -dx * sinA + dy * cosA;
  /* Anything nearer than this is between the camera and the player. The
     camera trails by CAM_DIST, so cutting at a little under that drops
     karts once they are behind you — which is what you want, and what
     stops one lingering half-transparent in the middle of the screen
     looking like a ghost. Roadside props sit far enough off the
     centreline that by this depth they are already off the side of the
     frame, so nothing visibly pops. */
  if (z < 78) return null;
  return {
    z,
    sx: RW / 2 + (x / z) * camFocal,
    sy: HORIZON + (CAM_H / z) * camFocal,
    scale: camFocal / z,
    fade: z < 102 ? (z - 78) / 24 : 1,
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
/* Lowered from 4.55 when the throttle curve was fixed. The old curve
   never reached its own maximum — it topped out around 77% — so the
   number was a fiction and the real speed was about 3.5. Making the
   maximum reachable made the karts genuinely faster and dropped laps to
   40s, under the 45s the courses are built for, so the figure now says
   what it means. */
const TOP_SPEED = 3.70;   // flat out on tarmac
/* The throttle curve, fitted rather than guessed.

   The previous pair asymptoted: acceleration fell to nothing as the
   speed approached the maximum, so the kart never actually got there —
   eight seconds flat out still left it at 77% of its own top speed,
   which is most of why it felt gutless. An exponent below one keeps it
   pulling right to the end. Simulated at 60Hz this reaches half speed
   at 0.65s and full speed at 2.27s. */
const ENGINE    = 0.0565; // pull off the line
const ACC_TAPER = 0.36;   // <1, so top speed is actually reachable
const BRAKE     = 0.150;  // on the brake — clearly harder than coasting
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
    this.yaw = 0;        // how far the body is turned out of its travel
    this.roll = 0;       // lean into the corner
    this.dip = 0;        // weight shift under braking
    this.speed = 0;
    this.hint = startIdx;
    this.nav = { hint: startIdx, onCut: false };

    /* Everyone starts *behind* the line, so the very first crossing is
       the start of lap one rather than the end of it. Counting from -1
       is what makes that work without a separate "have we begun" flag. */
    this.lap = -1;
    this.along = project(this.x, this.y, this.nav).along;
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
    this.bog = 0;        // a flooded start, briefly
    this.slick = 0;      // through a sprinkler: the grip goes away
    this.snag = 0;       // through the washing: dragging it with you
    this.coins = 0;      // hearts picked up off the road
    this.jolt = 0;       // suspension, loaded up over the rumble strip
    this.squash = 0;     // and the compression on landing a hop
    this.draft = 0;      // how long we have been sitting in clean air
    this.hop = 0;        // the little jump that starts a drift
    this.ammo = 0;       // how many of a multi-shot item are left
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
    if (this.bog > 0) m *= 0.45;
    if (this.snag > 0) m *= 0.62;
    /* a full set of hearts is worth about six per cent — enough to
       matter down a straight, not enough to decide a race on its own */
    m *= 1 + Math.min(this.coins, COIN_CAP) * 0.006;
    if (this.boost > 0) m *= 1.55;
    return m;
  }

  update(dt) {
    if (this.finished) { this.speed *= 0.94; this.advance(dt); return; }

    if (this.iframe > 0) this.iframe -= dt;
    if (this.bog > 0) this.bog -= dt;
    if (this.slick > 0) this.slick -= dt;
    if (this.snag > 0) this.snag -= dt;
    if (this.squash > 0) this.squash = Math.max(0, this.squash - dt * 3.2);

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
      if (this.speed > max) this.speed = max;
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
    /* Tapping drift hops the kart. It does nothing mechanically, and
       that is the point — it is the tell that says the button did
       something, and it is what a kart racer feels like. */
    if (dkey && !this.dkeyWas && this.speed > TOP_SPEED * 0.2 && this.hop <= 0) {
      this.hop = 0.34;
      Snd.hop();
    }
    this.dkeyWas = dkey;
    if (this.hop > 0) {
      const was = this.hop;
      this.hop -= dt;
      /* the landing: the chassis compresses, the tyres puff, and for a
         moment you are wider than you are tall. Coming down with no
         weight in it was the last thing that made the hop feel like a
         sprite moving up and down rather than a kart jumping. */
      if (this.hop <= 0 && was > 0) {
        this.squash = 0.26;
        const back = this.angle + Math.PI;
        for (const sgn of [-1, 1])
          addPuff(this.x + Math.cos(back) * 12 - Math.sin(this.angle) * sgn * 12,
                  this.y + Math.sin(back) * 12 + Math.cos(this.angle) * sgn * 12,
                  "#fff8e8");
        if (this.isPlayer) shake = Math.max(shake, 0.9);
      }
    }

    const turning = left || right;
    if (dkey && turning && this.speed > TOP_SPEED * 0.42) {
      if (!this.drifting) {
        this.drifting = true; this.driftDir = left ? -1 : 1; this.driftCharge = 0;
        Snd.drift(true);
      }
      this.driftCharge = Math.min(this.driftCharge + dt, 3);
    } else if (this.drifting) {
      /* Three tiers, and nothing at all below the first — the risk of
         holding the slide a moment longer is the whole point. */
      let tier = 0;
      if (this.driftCharge > 2.0)      { this.boost = 1.30; tier = 3; }
      else if (this.driftCharge > 1.2) { this.boost = 0.85; tier = 2; }
      else if (this.driftCharge > 0.5) { this.boost = 0.45; tier = 1; }
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

    const grip = (this.drifting ? DRIFT_GRIP : GRIP)
               * (this.offroad ? 0.7 : 1) * (this.slick > 0 ? 0.40 : 1);
    this.angle += (this.steer) * grip * k;
    /* the heading having caught up spends the steering input */
    this.steer -= this.steer * grip * k;

    /* ---- what the body does, as opposed to where it is going ----
       In a slide the kart points noticeably out of its direction of
       travel; in a normal corner it just leans. Both are visual only —
       the physics above is untouched — but they are most of what makes
       a corner feel like it has weight in it. */
    const wantYaw = this.drifting
      ? this.driftDir * (0.30 + Math.min(0.22, this.driftCharge * 0.12))
      : Math.max(-0.13, Math.min(0.13, this.steer * 1.6));
    this.yaw += (wantYaw - this.yaw) * 0.14 * k;

    const wantRoll = Math.max(-0.16, Math.min(0.16,
      (this.drifting ? this.driftDir * 0.13 : 0) + this.steer * 1.9)) * speedFrac;
    this.roll += (wantRoll - this.roll) * 0.16 * k;

    const wantDip = rev && this.speed > TOP_SPEED * 0.2 ? 1 : 0;
    this.dip += (wantDip - this.dip) * 0.20 * k;

    if (input.itemPressed) { input.itemPressed = false; this.fire(); }
  }

  /* Nearest index on a ribbon. Searched in a sliding window around last
     frame's answer, because a full scan of five hundred samples for
     eight karts every frame is not free. `full` forces the whole scan,
     which is what a kart wants the moment it changes ribbons. */
  nearIdx(line, from, wrap, full) {
    const m = line.length;
    let best = 0, bd = Infinity;
    const lo = full ? 0 : -6, hi = full ? m - 1 : 16;
    for (let o = lo; o <= hi; o++) {
      let i = full ? o : from + o;
      if (wrap) i = ((i % m) + m) % m;
      else if (i < 0 || i >= m) continue;
      const dx = line[i].x - this.x, dy = line[i].y - this.y;
      const d = dx * dx + dy * dy;
      if (d < bd) { bd = d; best = i; }
    }
    return best;
  }

  driveAI(dt) {
    const n = path.length;
    const k = dt * 60;
    const sf0 = Math.min(1, Math.abs(this.speed) / TOP_SPEED);

    /* Some of the field will take the shortcut. They aim at its own
       waypoints while their progress sits inside its span, then rejoin. */
    let line = path, tIdxMax = n;
    if (cut && this.takesCut) {
      let span = cut.to - cut.from; if (span < 0) span += 1;
      let rel = this.along - cut.from; if (rel < 0) rel += 1;
      if (rel < span * 1.05) {
        /* ...and only when the alley is actually within reach. An
           along-value inside the span is not the same thing as being
           next to the mouth, and a kart that swings at it from the far
           side of the main road just sets off across the scenery. */
        const ci = this.nearIdx(cut.pts, 0, false, true);
        const cx = cut.pts[ci].x - this.x, cy = cut.pts[ci].y - this.y;
        if (cx * cx + cy * cy < 150 * 150) { line = cut.pts; tIdxMax = cut.pts.length; }
      }
    }

    /* THE AIM POINT FOLLOWS THE KART. IT DOES NOT RUN FREE.

       aiTarget used to be a counter that crept forward only while the
       kart was within sixty units of it, and it was reset to zero every
       time a kart moved between the main line and the shortcut. So an
       opponent rejoining the road at sample three hundred began aiming
       at sample zero — half a lap behind itself — turned round, and
       spent the rest of the race pinned against the shoulder at walking
       pace. Measured: all eight opponents permanently off-road, lap
       pace 90-150s against the player's 50-58s on the same course.

       Anchoring the aim to where the kart actually IS on the ribbon
       makes it self-correcting. Shoved, spun, knocked wide or dropped
       out of the alley, it has the racing line again on the next
       frame, because the aim point is derived rather than remembered. */
    const swapped = line !== this.aiLine;
    if (swapped) this.aiLine = line;
    const here = this.nearIdx(line, this.aiTarget, line === path, swapped);
    this.aiTarget = here;

    /* look a fixed distance up the road, further the faster you go */
    const stepLen = Math.max(1, line === path
      ? pathLen / n
      : cut.len / Math.max(1, cut.pts.length - 1));
    const look = Math.max(3, Math.round((95 + 85 * sf0) / stepLen));
    const tIdx = line === path ? (here + look) % n
                               : Math.min(here + look, tIdxMax - 1);
    const nIdx = line === path ? (tIdx + 1) % n : Math.min(tIdx + 1, tIdxMax - 1);
    let ta;
    if (nIdx === tIdx) {
      /* the very end of the shortcut: take the heading from behind it,
         so the tangent is never atan2 of nothing */
      const pIdx = Math.max(0, tIdx - 1);
      ta = Math.atan2(line[tIdx].y - line[pIdx].y, line[tIdx].x - line[pIdx].x);
    } else {
      ta = Math.atan2(line[nIdx].y - line[tIdx].y, line[nIdx].x - line[tIdx].x);
    }
    this.aiJitter += dt * 0.7;
    let lane = (line === path ? this.lane * 0.75 : this.lane * 0.3)
             + Math.sin(this.aiJitter) * 10;

    /* Look up the road and move off the line if something is parked on
       it. Without this the field simply drives into the logs, which
       turns a hazard into a lottery and makes the AI look blind. */
    lane += this.dodge(ta);

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
    const grip = GRIP * (this.offroad ? 0.7 : 1) * (this.slick > 0 ? 0.45 : 1);
    this.angle += this.steer * grip * k;
    this.steer -= this.steer * grip * k;
    const sf = Math.min(1, Math.abs(this.speed) / TOP_SPEED);
    const wr = Math.max(-0.14, Math.min(0.14, this.steer * 1.7)) * sf;
    this.roll += (wr - this.roll) * 0.14 * k;
    this.yaw  += (Math.max(-0.11, Math.min(0.11, this.steer * 1.4)) - this.yaw) * 0.12 * k;

    /* ease off through the tight stuff, and rubber-band gently so the
       race stays alive without feeling rigged */
    let want = this.maxSpeed * (1 - Math.min(0.42, Math.abs(diff) * 0.85));
    const p = racers.find((r) => r.isPlayer);
    if (p && !p.finished) {
      const gap = p.progress - this.progress;
      if (this.rival) {
        /* THE RIVAL

           One of them is written to stay in your mirrors from the lights
           to the flag: he will not run away up the road and he will not
           drop off the back. Everything a race needs emotionally comes
           from having exactly one car you are actually racing, and it
           was missing — the field simply strung out by lap two. */
        if (gap >  0.015) want *= 1.10 + Math.min(0.18, gap * 1.1);
        if (gap < -0.015) want *= 0.89;
      } else {
        if (gap >  0.06) want *= 1.05 + Math.min(0.10, gap * 0.5);
        if (gap < -0.06) want *= 0.94;
      }
    }
    this.speed += (want - this.speed) * 2.4 * dt;

    if (this.item) this.thinkItem(dt);
  }

  /* How far sideways to move to miss whatever is coming. Returns a
     lateral offset in world units, biased towards whichever side of the
     obstacle has more road behind it. */
  dodge(ta) {
    let push = 0;
    const lx = -Math.sin(ta), ly = Math.cos(ta);
    for (const h of obstacles) {
      const spec = HAZ[h.kind];
      if (spec.cycle && !h.on) continue;       // a sprinkler between bursts
      const dx = h.x - this.x, dy = h.y - this.y;
      const ahead = dx * Math.cos(ta) + dy * Math.sin(ta);
      if (ahead < 10 || ahead > 260) continue;
      const across = dx * lx + dy * ly;        // its offset from our line
      const room = spec.r + 22;
      if (Math.abs(across) > room) continue;
      /* go round the side it is not on; nearer means harder */
      const urgency = 1 - ahead / 260;
      const dir = across >= 0 ? -1 : 1;
      push += dir * (room - Math.abs(across)) * (0.7 + urgency * 0.9);
    }
    return Math.max(-ROAD_HALF * 0.8, Math.min(ROAD_HALF * 0.8, push));
  }

  /* AI items used to go off on a stopwatch, which meant hearts fired
     down empty road and a boost spent halfway round a hairpin. Each
     item now waits for the moment it was made for, and the better the
     difficulty the more often it recognises one. */
  thinkItem(dt) {
    this.aiItemWait -= dt;
    if (this.aiItemWait > 0) return;
    const it = this.item;
    const skill = [0.35, 0.62, 0.9][difficulty];
    let go = false;

    if (it === "letter" || it === "ring") {
      /* spend the speed where there is road to use it */
      go = Math.abs(this.steer) < TURN * 5 && !this.offroad
        && Math.abs(this.speed) > TOP_SPEED * 0.5;
    } else if (it === "rose") {
      /* drop it in front of whoever is close behind */
      go = racers.some((o) => o !== this && !o.finished
        && o.progress < this.progress
        && (o.x - this.x) ** 2 + (o.y - this.y) ** 2 < 300 * 300);
    } else if (it === "arrow") {
      /* it homes, so all it needs is somebody up the road */
      go = racers.some((o) => o !== this && !o.finished && o.progress > this.progress);
    } else {
      go = !!this.aimAt();
    }

    if (!go) { this.aiItemWait = 0.3; return; }
    /* and even then, they miss their moment sometimes */
    if (Math.random() > skill) { this.aiItemWait = 0.7; return; }
    this.fire();
    this.aiItemWait = 1.4 + Math.random() * 2.4;
  }

  /* anyone actually in the firing line? */
  aimAt() {
    for (const o of racers) {
      if (o === this || o.finished) continue;
      const dx = o.x - this.x, dy = o.y - this.y;
      const d2 = dx * dx + dy * dy;
      if (d2 > 520 * 520 || d2 < 26 * 26) continue;
      let bear = Math.atan2(dy, dx) - this.angle;
      bear = Math.atan2(Math.sin(bear), Math.cos(bear));
      if (Math.abs(bear) < 0.32) return o;
    }
    return null;
  }

  advance(dt) {
    const k = dt * 60;
    this.x += Math.cos(this.angle) * this.speed * k;
    this.y += Math.sin(this.angle) * this.speed * k;

    const pr = project(this.x, this.y, this.nav);
    this.hint = this.nav.hint;
    this.onCut = this.nav.onCut;
    /* widths are relative to whichever ribbon you are on — the shortcut
       is narrower, which is the price of taking it */
    const rumble = pr.half + (RUMBLE_HALF - ROAD_HALF);
    const bound  = pr.half + (SHOULDER - ROAD_HALF);
    this.offroad = pr.dist > rumble;

    /* SUSPENSION

       Riding the kerb should be felt, not just heard. The chassis loads
       up over the rumble strip and unloads again on the way off it, and
       the drawing reads that number — so a wheel dropping off the edge
       of the road makes the whole kart shudder. */
    const onKerb = pr.dist > pr.half && pr.dist <= rumble;
    const load = onKerb ? Math.min(1, Math.abs(this.speed) / (TOP_SPEED * 0.55)) : 0;
    this.jolt += (load - this.jolt) * (onKerb ? 0.35 : 0.10) * k;
    if (onKerb && this.isPlayer && Math.abs(this.speed) > TOP_SPEED * 0.4)
      shake = Math.max(shake, 0.55 * load);

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
    } else if (Math.abs(this.speed) > TOP_SPEED * 0.45 && Math.random() < 0.22) {
      /* a thin wake off the tarmac too, so speed reads before a boost */
      const back = this.angle + Math.PI;
      addPuff(this.x + Math.cos(back) * 20, this.y + Math.sin(back) * 20,
              "rgba(255,248,232,.5)");
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
        if (this.lap === trackDef.laps - 1) {
          /* the last one should feel like the last one */
          flashBanner("FINAL LAP!");
          Snd.finalLap();
          finalLap = true;
        } else {
          flashBanner("LAP " + (this.lap + 1));
          Snd.lap();
        }
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

    if (this.drifting && Math.abs(this.speed) > 1) {
      addSpark(this.x, this.y, this.angle, this.driftCharge);
      if (Math.random() < 0.6) {
        const back = this.angle + Math.PI;
        addPuff(this.x + Math.cos(back) * 16, this.y + Math.sin(back) * 16,
                "rgba(240,236,244,.55)");
      }
    }
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
      /* three of them, orbiting until thrown, one per press */
      this.ammo = 3;
      this.item = "bouqshot";
      this.shield = 0;
      return;
    } else if (it === "bouqshot") {
      shots.push({
        x: this.x + Math.cos(this.angle) * 42,
        y: this.y + Math.sin(this.angle) * 42,
        a: this.angle, sp: 7.0, kind: "heart", owner: this,
        life: 5, bounce: 3, nav: { hint: this.hint, onCut: false },
      });
      this.ammo--;
      if (this.ammo > 0) this.item = "bouqshot";
      if (this.isPlayer) paintItem();
      return;
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
        nav: { hint: this.hint, onCut: false },
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
  const tier = charge > 2.0 ? 2 : charge > 1.2 ? 1 : 0;
  const col = ["#fff8e8", "#7ec8e3", "#ff9a3c"][tier];
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
/* thin lines of disturbed air, pulled off whoever is in front */
function addStreak(r) {
  const side = (Math.random() < 0.5 ? -1 : 1) * (12 + Math.random() * 16);
  const lx = -Math.sin(r.angle), ly = Math.cos(r.angle);
  fx.push({
    x: r.x + lx * side + Math.cos(r.angle) * 30,
    y: r.y + ly * side + Math.sin(r.angle) * 30,
    z: 6 + Math.random() * 10,
    vx: -Math.cos(r.angle) * 5.2, vy: -Math.sin(r.angle) * 5.2, vz: 0,
    life: 0.24, max: 0.24, col: "rgba(255,255,255,.85)", size: 2.2, streak: true,
  });
}

function addPuff(x, y, col) {
  fx.push({
    x, y, z: 2, vx: (Math.random()-0.5)*1.1, vy: (Math.random()-0.5)*1.1, vz: 1.0,
    life: 0.42, max: 0.42, col, size: 3.2,
  });
}
function addRing(x, y, col) {
  fx.push({ x, y, z: 6, vx:0, vy:0, vz:0, life:0.45, max:0.45, col, size:1, ring:true });
}
function addPop(x, y, col) {
  addRing(x, y, col);
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
let obstacles = [], coins = [];
let trackDef = TRACKS[0];
let raceTime = 0, countdown = 0, shake = 0;
let mode = "single";           // single | gp | trial
let difficulty = 1;
let playerCharIdx = 0, trackIdx = 0;
let gpRound = 0, gpPoints = [];
let gpTable = {};
let state = "title";           // title|chars|tracks|count|race|paused|results|gpboard
let ghost = null, ghostRec = null, ghostPlay = null;
let bannerT = 0;
let lastPlace = 0;
let revUp = 0, revTotal = 0;      // how the player worked the countdown
let draftOn = false;
let finalLap = false;
let rivalCall = 0;   // cooldown on the rival calling you out
let photoDone = false;
let slowMo = 0;      // the photo-finish stretch

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

/* How far the nearest bit of ANY driveable ribbon is. The offset from
   the local stretch of road is not enough on its own: the loop doubles
   back on itself, and there is a shortcut cutting across the middle, so
   a tree placed a comfortable distance from the corner it belongs to
   could still be standing in the middle of the road somewhere else. */
function distToAnyTrack(x, y) {
  let best = Infinity;
  const n = path.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const ax = path[i].x, ay = path[i].y;
    const dx = path[j].x - ax, dy = path[j].y - ay;
    const l2 = dx*dx + dy*dy;
    let t = l2 > 0 ? ((x-ax)*dx + (y-ay)*dy) / l2 : 0;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const cx = ax + t*dx, cy = ay + t*dy;
    const d = (x-cx)*(x-cx) + (y-cy)*(y-cy);
    if (d < best) best = d;
  }
  if (cut) {
    const p = cut.pts;
    for (let i = 0; i < p.length - 1; i++) {
      const ax = p[i].x, ay = p[i].y;
      const dx = p[i+1].x - ax, dy = p[i+1].y - ay;
      const l2 = dx*dx + dy*dy;
      let t = l2 > 0 ? ((x-ax)*dx + (y-ay)*dy) / l2 : 0;
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      const cx = ax + t*dx, cy = ay + t*dy;
      const d = (x-cx)*(x-cx) + (y-cy)*(y-cy);
      if (d < best) best = d;
    }
  }
  return Math.sqrt(best);
}

/* Small enough to stand close to the road without towering over it when
   you pass. Anything not on this list gets held back beyond the camera
   distance so it can never fill the screen. */
/* what sways, and how hard */
const SWAY = {
  laundry:{ rate:1.5, amt:0.045 }, stringpole:{ rate:1.1, amt:0.028 },
  tree:{ rate:0.9, amt:0.014 },    bush:{ rate:1.7, amt:0.030 },
  plant:{ rate:1.4, amt:0.032 },   flowerbox:{ rate:1.9, amt:0.022 },
  planter:{ rate:1.6, amt:0.020 },
};
/* what glows, and how it breathes */
const GLOWS = {
  stringpole:{ n:6, rate:2.2, base:0.24, amp:0.16, r:0.055, y:0.52, spread:1.5,
               cols:["#ffd166","#ff9ec4","#7ec8e3","#7ddba3","#ffd166","#ff9ec4"] },
  lamp:{ n:1, rate:1.3, base:0.26, amp:0.07, r:0.16, y:0.86, spread:0,
         cols:["#ffd166"] },
};

/* who gets up and cheers when the bell rings */
const CROWD = { cat:1, bike:1, plant:1, flowerbox:1, planter:1, bush:1 };

const NEAR_KINDS = {
  bush:1, rock:1, flowerbox:1, planter:1, mailbox:1, hydrant:1,
  postbox:1, cat:1, bike:1, plant:1, skylight:1,
};

function placeProps(def) {
  props = [];
  const lastVariant = {};
  let lastKind = "";
  const rnd = mulberry(seedOf(def.id, 3121));
  for (let i = 0; i < path.length; i += 3) {
    for (const s of [-1, 1]) {
      if (rnd() > 0.66) continue;
      const ta = tangentAt(i);
      /* Not the same kind twice running either. Guarding only the
         variant still let three signposts line up in a row, because a
         kind with no variants repeats happily. */
      let kind = def.scenery[(rnd() * def.scenery.length) | 0];
      for (let t2 = 0; t2 < 3 && kind === lastKind; t2++)
        kind = def.scenery[(rnd() * def.scenery.length) | 0];
      lastKind = kind;
      const spec = SCENERY[kind] || { h: 90, foot: 0.6 };
      const hv = 0.76 + rnd() * 0.56;
      /* Pick a variant, and never the same one twice running for this
         kind — a row of nine identical houses is the single thing that
         makes a street look copy-pasted. */
      const nv = spec.variants || 1;
      let vv = (rnd() * nv) | 0;
      if (nv > 1 && vv === lastVariant[kind]) vv = (vv + 1) % nv;
      lastVariant[kind] = vv;
      /* the bigger the thing, the more room it needs beside the road */
      const bulk = spec.h * hv * spec.foot * 0.22;
      const clear = SHOULDER + (NEAR_KINDS[kind] ? 6 : 20) + bulk;

      /* Two bands. Small things line the verge, where they read as
         planting and kerbside clutter; anything with bulk is held back
         past the camera distance so it can never loom. Without the near
         band the ground beside the road is one uninterrupted plane of
         green, which is what made it look unfinished. */
      const near = !!NEAR_KINDS[kind];
      let placed = null;
      for (let attempt = 0; attempt < 5; attempt++) {
        const off = near ? SHOULDER + 10 + rnd() * 60
                         : SHOULDER + 48 + rnd() * 210;
        const jitter = (rnd() - 0.5) * 40;
        const x = path[i].x - Math.sin(ta) * off * s + Math.cos(ta) * jitter;
        const y = path[i].y + Math.cos(ta) * off * s + Math.sin(ta) * jitter;
        if (x < 30 || y < 30 || x > WORLD - 30 || y > WORLD - 30) continue;
        if (distToAnyTrack(x, y) < clear) continue;
        placed = { x, y };
        break;
      }
      if (!placed) continue;      // nowhere safe here; leave the gap

      props.push({
        x: placed.x, y: placed.y, kind, hv, v: vv,
        /* a mirror and a colour cast, so even two of the same variant
           standing together do not read as a printed pattern */
        flip: rnd() < 0.5,
        tint: (rnd() * 3) | 0,
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

/* THE TRACK FURNITURE

   Each course's blurb named something — logs, sprinklers, a slalom of
   IV poles, laundry lines — and for a long time none of it existed. It
   does now, and the placement rule is the whole design: never more than
   one obstacle across the road at a time, and never further out than
   two thirds of the half-width, so there is always a line through for
   somebody who is paying attention. An obstacle you cannot avoid is
   not a hazard, it is a toll. */
function placeObstacles(def) {
  obstacles = [];
  const spec = def.hazard;
  if (!spec) return;
  const rnd = mulberry(seedOf(def.id, 7717));
  const n = path.length;
  for (let k = 0; k < spec.n; k++) {
    /* spread round the loop, leaving the start-finish stretch clear so
       nobody eats one before the lights have finished */
    const f = 0.09 + ((k + 0.35 + rnd() * 0.3) / spec.n) * 0.84;
    const i = Math.floor(f * n) % n;
    const ta = tangentAt(i);
    /* Out towards the edge of the lane, never straddling the middle.
       Measured: at a third of the half-width the centre line runs
       straight through everything, and a lap went from fifty seconds to
       ninety because the only line was the one through the obstacle. */
    const side = (k % 2 ? 1 : -1) * (0.46 + rnd() * 0.38);
    const off = side * ROAD_HALF;
    let hx = path[i].x - Math.sin(ta) * off;
    let hy = path[i].y + Math.cos(ta) * off;
    /* never on top of an item box — being unable to reach a box because
       something is parked in it is the sort of thing you only find out
       about on the fifth playthrough, when it is somebody else playing */
    let clash = 0, ii = i;
    while (clash < 6 && boxes.some((bx) => (bx.x - hx) ** 2 + (bx.y - hy) ** 2 < 74 * 74)) {
      clash++;
      ii = (i + clash * 4) % n;
      const ta2 = tangentAt(ii);
      hx = path[ii].x - Math.sin(ta2) * off;
      hy = path[ii].y + Math.cos(ta2) * off;
    }
    obstacles.push({
      x: hx, y: hy,
      kind: spec.kind, a: tangentAt(ii),
      v: (rnd() * (SCENERY[spec.kind].variants || 1)) | 0,
      idx: ii, phase: rnd() * TWO_PI, t: 0, on: true, hitT: 0,
    });
  }
}

/* HEARTS ON THE ROAD

   The item boxes come round every fifth of a lap, and between them
   there was nothing to aim at — you simply held the throttle. Trails of
   hearts give the straights a line to follow and the corners a reason
   to take the inside. Ten of them is a real edge; a hit costs you two,
   so they are worth defending. */
const COIN_CAP = 10;
function placeCoins(def) {
  coins = [];
  const rnd = mulberry(seedOf(def.id, 4441));
  const n = path.length;
  for (let g = 0; g < 9; g++) {
    const base = Math.floor(((g + 0.30) / 9) * n) % n;
    const len = 5 + ((rnd() * 4) | 0);
    const lane = (rnd() * 2 - 1) * 22;
    const arc  = (rnd() - 0.5) * 46;
    for (let k = 0; k < len; k++) {
      const i = (base + k * 2) % n;
      const ta = tangentAt(i);
      const t = len > 1 ? k / (len - 1) : 0;
      const off = lane + Math.sin(t * Math.PI) * arc;
      const cx = path[i].x - Math.sin(ta) * off;
      const cy = path[i].y + Math.cos(ta) * off;
      /* and a trail never leads you straight into something. Bait is
         only fun if taking it is a decision rather than a trap. */
      if (obstacles.some((h) => (h.x - cx) ** 2 + (h.y - cy) ** 2
                                < (HAZ[h.kind].r + 20) ** 2)) continue;
      coins.push({ x: cx, y: cy, alive: true, t: 0, ph: rnd() * TWO_PI });
    }
  }
}

/* Baking a 2048-square world takes long enough to drop a frame or two,
   and a silent freeze reads as a crash. Put a card up, let the browser
   paint it, then do the work. */
function startRace() {
  setOverlay(`<div class="rc-loading"><p>${TRACKS[trackIdx].name}</p><span></span></div>`, "rc-ov-load");
  showHud(false);
  requestAnimationFrame(() => requestAnimationFrame(() => buildRace()));
}

function buildRace() {
  trackDef = TRACKS[trackIdx];
  buildPath(trackDef);
  /* props are placed before the bake so their shadows can be painted
     into the ground texture along with everything else */
  placeProps(trackDef);
  bakeTrack(trackDef);
  bakePano(trackDef);
  placeBoxes();
  placeObstacles(trackDef);
  placeCoins(trackDef);

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
  /* the other half of the pair is your rival — Anwar if you picked
     Ouissy, Ouissy if you picked Anwar */
  if (mode !== "trial" && racers[1]) racers[1].rival = true;
  rivalCall = 0;

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
  revUp = 0; revTotal = 0; draftOn = false; finalLap = false;
  rivalCall = 0; photoDone = false; slowMo = 0;
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
    racers.forEach((r) => {
      const id = r.def.id;
      gpTable[id] = (gpTable[id] || 0) + GP_POINTS[Math.min(r.place - 1, GP_POINTS.length - 1)];
    });
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

    /* The rocket start. Come on the throttle inside the last stretch of
       the countdown and you launch; sit on it from the very beginning
       and you flood it and bog down instead. That gamble at the lights
       is free excitement and it was missing. */
    if (input.up) revUp += dt; else revUp = 0;
    if (revUp > 0.02) revTotal += dt;

    if (countdown <= 0) {
      state = "race";
      setCount("");
      Snd.engineOn();
      const me = racers.find((r) => r.isPlayer);
      if (me) {
        if (revTotal > 1.45) {            // held far too long: flooded
          me.bog = 1.1;
          flashBanner("FLOODED!");
        } else if (revUp > 0.14 && revUp < 0.95) {
          me.boost = Math.max(me.boost, 1.05);
          flashBanner("ROCKET START!");
          Snd.boost(3);
        }
      }
    }
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
    if (me0.drifting) Snd.driftCharge(me0.driftCharge > 2.0 ? 3 : me0.driftCharge > 1.2 ? 2 : 1);
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

  /* the track's own furniture */
  for (const h of obstacles) {
    h.t += dt;
    if (h.hitT > 0) h.hitT -= dt;
    const spec = HAZ[h.kind];
    /* the ones that pulse are learnable: watch a lap and you can time
       your way through without lifting */
    h.on = spec.cycle
      ? ((h.t + h.phase) % spec.cycle) < spec.cycle * spec.duty
      : true;
    if (!h.on) continue;
    for (const r of racers) {
      if (r.finished || r.spin > 0 || r.invuln > 0) continue;
      const dx = r.x - h.x, dy = r.y - h.y;
      if (dx * dx + dy * dy > spec.r * spec.r) continue;
      if (spec.effect === "spin") {
        if (r.iframe > 0) continue;
        hit(r);
        addPop(h.x, h.y, "#c9a877");
        h.hitT = 0.45;
      } else if (spec.effect === "slick") {
        if (r.slick > 0.9) continue;
        r.slick = 1.5;
        r.speed *= 0.90;
        for (let i = 0; i < 4; i++) addPuff(h.x, h.y, "#dff0f7");
        if (r.isPlayer) { flashBanner("SLIPPERY!"); shake = Math.max(shake, 1.4); Snd.splash(); }
      } else if (spec.effect === "knock") {
        if (r.iframe > 0 || h.hitT > 0.5) continue;
        r.speed *= 0.58;
        r.iframe = 0.5;
        r.jolt = 1;
        h.hitT = 1.0;
        /* and it topples away from you rather than standing there */
        h.knock = Math.sign((r.x - h.x) * -Math.sin(h.a) + (r.y - h.y) * Math.cos(h.a)) || 1;
        addPop(h.x, h.y, "#dff0f7");
        if (r.isPlayer) { shake = Math.max(shake, 2.2); flashBanner("CLATTER!"); Snd.clatter(); }
      } else if (spec.effect === "snag") {
        if (r.snag > 0.4) continue;
        r.snag = 1.0;
        r.speed *= 0.52;
        r.boost = 0;
        addPop(h.x, h.y, "#ffd9c2");
        if (r.isPlayer) { flashBanner("TANGLED!"); shake = Math.max(shake, 1.8); Snd.scrape(); }
      }
    }
  }

  /* hearts on the road */
  for (const c of coins) {
    if (!c.alive) { c.t -= dt; if (c.t <= 0) c.alive = true; continue; }
    for (const r of racers) {
      if (r.finished) continue;
      const dx = r.x - c.x, dy = r.y - c.y;
      if (dx * dx + dy * dy > 26 * 26) continue;
      c.alive = false; c.t = 9;
      if (r.coins < COIN_CAP) r.coins++;
      r.speed += 0.09;
      if (r.isPlayer) {
        Snd.pickup();
        addPop(c.x, c.y, "#ff9ec4");
        if (r.coins === COIN_CAP) flashBanner("HEARTS FULL!");
      }
      break;
    }
  }

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
      const pr = project(s.x, s.y, s.nav);
      if (pr.dist > pr.half) {
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

  /* SLIPSTREAM

     Tuck in behind someone and the air comes off them; hold it and you
     get pulled along, which is the mechanic that makes a pack of karts
     a race rather than a queue. You have to stay in the cone to keep
     it, and it fades the moment you pull out. */
  for (const r of racers) {
    if (r.finished) { r.draft = 0; continue; }
    let inWake = false;
    for (const o of racers) {
      if (o === r || o.finished) continue;
      const dx = o.x - r.x, dy = o.y - r.y;
      const d = Math.hypot(dx, dy);
      if (d < 26 || d > 190) continue;
      /* is he in front of us, and are we pointing at him? */
      const bearing = Math.atan2(dy, dx) - r.angle;
      const bs = Math.abs(Math.atan2(Math.sin(bearing), Math.cos(bearing)));
      if (bs > 0.42) continue;
      /* and is he going roughly our way, not sideways across us? */
      let hd = o.angle - r.angle;
      hd = Math.abs(Math.atan2(Math.sin(hd), Math.cos(hd)));
      if (hd > 0.9) continue;
      inWake = true; break;
    }
    if (inWake) r.draft = Math.min(2.4, r.draft + dt);
    else        r.draft = Math.max(0, r.draft - dt * 2.2);

    if (r.draft > 0.75) {
      const pull = Math.min(1, (r.draft - 0.75) / 1.2);
      r.speed += 0.030 * pull * dt * 60;
      if (r.isPlayer) {
        if (!draftOn) { draftOn = true; flashBanner("SLIPSTREAM!"); }
        if (Math.random() < 0.5) addStreak(r);
      }
    } else if (r.isPlayer) draftOn = false;
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
      /* a knock costs a little speed and shoves you off line, rather
         than the two of you passing through each other politely */
      const closing = (a.speed - b.speed);
      if (Math.abs(closing) > 0.6) {
        a.speed *= 0.93; b.speed *= 0.93;
        if (a.isPlayer || b.isPlayer) shake = Math.max(shake, 1.2);
      }
    }
  }

  /* THE RIVAL, AND THE PHOTO FINISH

     Two small things that turn a lap counter into a race. The rival
     says something when he gets past you, so a pass registers as an
     event; and if the two of you arrive at the line together the whole
     picture goes into slow motion for the last stretch, which is the
     single most Mario-Kart thing a racing game can do. */
  if (rivalCall > 0) rivalCall -= dt;
  const you = racers.find((r) => r.isPlayer);
  const riv = racers.find((r) => r.rival);
  if (you && riv && !you.finished && !riv.finished && mode !== "tutorial") {
    const gap = riv.progress - you.progress;
    if (riv.wasAhead === undefined) riv.wasAhead = gap > 0;
    if (gap > 0 && !riv.wasAhead && rivalCall <= 0) {
      flashBanner(riv.def.name.toUpperCase() + " IS PAST YOU!");
      rivalCall = 9;
    } else if (gap <= 0 && riv.wasAhead && rivalCall <= 0) {
      flashBanner("YOU GOT " + riv.def.name.toUpperCase() + "!");
      rivalCall = 9;
    }
    riv.wasAhead = gap > 0;

    if (finalLap && !photoDone && you.along > 0.94) {
      let closest = Infinity;
      for (const o of racers) {
        if (o === you || o.finished) continue;
        closest = Math.min(closest, Math.abs(o.progress - you.progress));
      }
      if (closest < 0.014) {
        photoDone = true;
        slowMo = 1.6;
        flashBanner("PHOTO FINISH!");
        Snd.finalLap();
      }
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
  /* and it scatters two of your hearts, which is what makes them worth
     holding onto rather than just worth collecting */
  if (r.coins > 0) {
    const lost = Math.min(2, r.coins);
    r.coins -= lost;
    for (let i = 0; i < lost * 3; i++) addPuff(r.x, r.y, "#ff9ec4");
  }
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

  sunRel = (trackDef.light != null ? trackDef.light : -0.7) - camA;
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
  obstacles.forEach((h) => {
    const s = projectSprite(h.x, h.y, camX, camY, camA);
    if (s && s.z < MAX_Z) bill.push({ s, kind: "haz", o: h });
  });
  coins.forEach((c) => {
    if (!c.alive) return;
    const s = projectSprite(c.x, c.y, camX, camY, camA);
    if (s && s.z < MAX_Z * 0.5) bill.push({ s, kind: "coin", o: c });
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

  /* Shadows all go down first, in their own pass.

     Drawing each sprite's shadow immediately before that sprite meant a
     near object's shadow could land on top of a far object that had
     already been painted — a tree's shadow lying across a house behind
     it. Ground first, then everything standing on it. */

  /* ------------------------------------------------------------------
     The ground goes down first, at the low internal resolution, and is
     blown up to the panel. Everything that STANDS UP is then drawn
     straight onto the full-size canvas through a scale transform.

     This is the fix for props that would not stay put. They were always
     stored in world space and re-projected properly — but they were
     being drawn into the 400x225 buffer, so a prop could only ever land
     on that coarse grid. Its true position slid smoothly while its
     drawn position snapped a whole buffer pixel at a time, which at
     this zoom is three or four screen pixels, and the Mode 7 ground
     under it was sampled per-pixel and flowed on smoothly. The prop
     therefore swam against the road. Drawing through the transform
     keeps the coordinates below in the same 400x225 space — so none of
     the code changes — while the positions themselves stay continuous.
     ------------------------------------------------------------------ */
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.imageSmoothingEnabled = false;
  shakeX = shake ? (Math.random() - 0.5) * shake * (cw / RW) * 2 : 0;
  shakeY = shake ? (Math.random() - 0.5) * shake * (ch / RH) * 2 : 0;
  ctx.clearRect(0, 0, cw, ch);
  ctx.drawImage(sceneCvs, shakeX, shakeY, cw, ch);

  ctx.setTransform(cw / RW, 0, 0, ch / RH, shakeX, shakeY);
  const g = ctx;
  g.imageSmoothingEnabled = false;
  bill.forEach((b) => {
    g.globalAlpha = 1;
    if (b.kind === "prop") {
      const spec = SCENERY[b.o.kind] || { h: 90, foot: 0.6 };
      const img = buildScenery(b.o.kind, b.o.v || 0, trackDef, b.o.tint || 0);
      const hh = spec.h * b.o.hv * b.s.scale;
      const ww = hh * (img.width / img.height);
      if (ww < 1.2) return;
      castShadow(g, img, b.o.kind + b.o.v + (b.o.tint || 0),
                 b.s.sx, b.s.sy, ww, hh, 0.55 + Math.min(0.5, spec.h / 300), b.s.fade);
      contactPatch(g, b.s.sx, b.s.sy, ww * spec.foot * 0.62, b.s.fade);
    } else if (b.kind === "kart" || b.kind === "ghost") {
      const o = b.o;
      const rel2 = o.angle + (o.yaw || 0) - camA;
      const ai2 = Math.round((((rel2 % TWO_PI) + TWO_PI) % TWO_PI) / TWO_PI * ANGLES) % ANGLES;
      const st2 = o.steer || 0, lk = TURN * 22;
      const pz2 = o.spin > 0 ? 0 : st2 < -lk * 0.22 ? 1 : st2 > lk * 0.22 ? 2 : 0;
      const im2 = kartFrame(o.def.id, ai2, pz2);
      if (!im2) return;
      const hh = KART_H * b.s.scale, ww = hh * (im2.width / im2.height);
      if (ww < 1.5) return;
      castShadow(g, im2, "k" + o.def.id + ai2 + "p" + pz2, b.s.sx, b.s.sy, ww, hh, 0.6, b.s.fade);
      contactPatch(g, b.s.sx, b.s.sy, ww * 0.42, b.s.fade);
    } else if (b.kind === "haz") {
      const spec = SCENERY[b.o.kind] || { h: 40, foot: 0.8 };
      const img = buildScenery(b.o.kind, b.o.v || 0, trackDef, 0);
      const hh = spec.h * b.s.scale;
      const ww = hh * (img.width / img.height);
      if (ww < 1.2) return;
      castShadow(g, img, "h" + b.o.kind + b.o.v, b.s.sx, b.s.sy, ww, hh, 0.6, b.s.fade);
      contactPatch(g, b.s.sx, b.s.sy, ww * spec.foot * 0.7, b.s.fade);
    } else if (b.kind === "box") {
      contactPatch(g, b.s.sx, b.s.sy, 20 * b.s.scale * 0.5);
    } else if (b.kind === "coin") {
      contactPatch(g, b.s.sx, b.s.sy, 9 * b.s.scale);
    }
  });

  bill.forEach((b) => {
    /* belt and braces: whatever the previous billboard did, this one
       starts from a clean slate. One unbalanced alpha in here dims
       every sprite drawn after it, and that is a maddening bug to see
       and an easy one to reintroduce. */
    g.globalAlpha = 1;
    switch (b.kind) {
      case "prop":  drawProp(g, b);  break;
      case "box":   drawBox(g, b);   break;
      case "haz":   drawHaz(g, b);   break;
      case "coin":  drawCoin(g, b);  break;
      case "rose":  drawRose(g, b);  break;
      case "shot":  drawShot(g, b);  break;
      case "kart":  drawKart(g, b, camA); break;
      case "ghost": drawKart(g, b, camA, true); break;
      case "fx":    drawFx(g, b);    break;
    }
  });

  /* Speed lines come in with the speedometer, not only with a boost —
     the picture should already be moving before you are boosting. */
  const sf = Math.min(1, Math.abs(me.speed) / TOP_SPEED);
  const lines = (me.boost > 0 ? 1 : 0) + Math.max(0, (sf - 0.55) / 0.45) * 0.55;
  if (lines > 0.02) drawSpeedLines(g, lines);

  /* THE PHOTO FINISH

     Bars in from the top and bottom and the colour pushed warm, for as
     long as the slow motion lasts. It is a cheap trick and it works
     every time somebody sees it. */
  if (slowMo > 0) {
    const k = Math.min(1, slowMo / 0.35);
    g.save();
    g.fillStyle = "#140b1a";
    const bar = RH * 0.10 * k;
    g.fillRect(0, 0, RW, bar);
    g.fillRect(0, RH - bar, RW, bar);
    g.globalAlpha = 0.13 * k;
    g.fillStyle = "#ffd166";
    g.fillRect(0, 0, RW, RH);
    g.restore();
  }

  ctx.setTransform(1, 0, 0, 1, 0, 0);
}

/* The blob under everything was the same blob whatever the sun was
   doing. A shadow that leans away from the light, and squashes as the
   light comes round towards the camera, is what plants a thing on the
   ground rather than parking it there. `sunScreen` is the sun's bearing
   relative to where the camera is looking, so both fall out of it. */
let sunRel = 0.7;
function contactPatch(g, sx, sy, w, fade) {
  g.save();
  if (fade != null && fade < 1) g.globalAlpha = fade;
  g.fillStyle = "rgba(18,12,24,.30)";
  g.beginPath();
  g.ellipse(sx, sy, w * 0.5, w * 0.17, 0, 0, TWO_PI);
  g.fill();
  g.restore();
}

function shadowUnder(g, sx, sy, w, tall) {
  const len = (tall || 0.55) * w;
  const dx = Math.sin(sunRel) * len;
  const dy = -Math.cos(sunRel) * len * 0.34;
  g.save();
  g.fillStyle = "rgba(20,14,26,.24)";
  g.beginPath();
  g.ellipse(sx + dx * 0.5, sy + dy * 0.5,
            w * 0.5 + Math.abs(dx) * 0.30, w * 0.20, Math.atan2(dy, dx) * 0.35, 0, TWO_PI);
  g.fill();
  /* a tighter, darker core right at the contact point */
  g.fillStyle = "rgba(20,14,26,.26)";
  g.beginPath();
  g.ellipse(sx, sy, w * 0.34, w * 0.13, 0, 0, TWO_PI);
  g.fill();
  g.restore();
}

function drawProp(g, b) {
  const { s, o } = b;
  const img = buildScenery(o.kind, o.v || 0, trackDef, o.tint || 0);
  const spec = SCENERY[o.kind] || { h: 90, foot: 0.6 };
  const h = spec.h * o.hv * s.scale;
  const w = h * (img.width / img.height);
  if (w < 1.2) return;
  /* The fade is set AFTER the early return. Setting it before meant a
     prop too small to draw bailed out with the canvas still dimmed, and
     every tree and house drawn after it that frame came out translucent
     — which is exactly what the flickering was. */
  if (s.fade < 1) g.globalAlpha = s.fade;
  /* A world where the only moving thing is chimney smoke reads as a
     diorama. Whatever ought to be moving in the breeze, moves. */
  /* THE CROWD, ON THE LAST LAP

     Everything alive at the side of the road gets to its feet when the
     bell goes. It costs one sine wave and it is the difference between
     a final lap that is announced and a final lap that is felt. */
  let cheer = 0;
  if (finalLap && CROWD[o.kind]) {
    const ph = raceTime * 6.5 + (o.x + o.y) * 0.02;
    cheer = Math.max(0, Math.sin(ph)) * h * 0.22;
  }

  const sway = SWAY[o.kind];
  if (cheer > 0) {
    g.save();
    g.translate(0, -cheer);
    if (sway) {
      const ph = raceTime * sway.rate + (o.x + o.y) * 0.004;
      g.translate(s.sx, s.sy); g.rotate(Math.sin(ph) * sway.amt); g.translate(-s.sx, -s.sy);
    }
    drawHazed(g, img, o.kind + o.v + (o.tint || 0), s.sx - w / 2, s.sy - h, w, h, s.z, o.flip);
    g.restore();
  } else if (sway) {
    const ph = raceTime * sway.rate + (o.x + o.y) * 0.004;
    g.save();
    /* Pivot at the FOOT, not the top. Rotating about the top swung the
       base of everything off the ground and left a visible gap under
       every bush, tree and planter — a thing that sways is rooted and
       moves at its crown. */
    g.translate(s.sx, s.sy);
    g.rotate(Math.sin(ph) * sway.amt);
    g.translate(-s.sx, -s.sy);
    drawHazed(g, img, o.kind + o.v + (o.tint || 0), s.sx - w / 2, s.sy - h, w, h, s.z, o.flip);
    g.restore();
  } else {
    drawHazed(g, img, o.kind + o.v + (o.tint || 0), s.sx - w / 2, s.sy - h, w, h, s.z, o.flip);
  }

  /* bulbs and lamps breathe, independently of each other */
  const lit = GLOWS[o.kind];
  if (lit && w > 10) {
    g.save();
    for (let i = 0; i < lit.n; i++) {
      const ph = raceTime * lit.rate + i * 2.1 + o.x * 0.01;
      const a2 = lit.base + Math.sin(ph) * lit.amp;
      g.globalAlpha = Math.max(0, a2);
      g.fillStyle = lit.cols[i % lit.cols.length];
      const gx = s.sx + (i / (lit.n - 1) - 0.5) * w * lit.spread;
      const gy = s.sy - h * lit.y;
      g.beginPath(); g.arc(gx, gy, w * lit.r, 0, TWO_PI); g.fill();
    }
    g.restore();
  }

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
  /* a glow that breathes under the box, so it reads as something worth
     driving into rather than a decal on the tarmac */
  const pulse = 0.55 + Math.sin(o.spin * 1.6) * 0.45;
  g.save();
  g.globalAlpha = 0.16 + pulse * 0.18;
  g.fillStyle = "#ff9ec4";
  g.beginPath();
  g.arc(s.sx, s.sy - h * 0.45 + bob, w * (0.62 + pulse * 0.16), 0, TWO_PI);
  g.fill();
  g.restore();
  g.drawImage(img, s.sx - w / 2, s.sy - h + bob, w, h);
}

/* The furniture standing on the road. Half of it is alive — the
   sprinklers pulse, the washing swings, and a log you just clipped
   shudders — so the sprite is only the still half of the drawing. */
function drawHaz(g, b) {
  const { s, o } = b;
  const spec = SCENERY[o.kind] || { h: 40, foot: 0.8 };
  const hz = HAZ[o.kind];
  const img = buildScenery(o.kind, o.v || 0, trackDef, 0);
  const h = spec.h * s.scale;
  const w = h * (img.width / img.height);
  if (w < 1.2) return;

  /* distant billboards fade in rather than popping in, the same as the
     scenery does */
  const fa = s.fade < 1 ? s.fade : 1;
  g.save();
  if (o.kind === "sprinkler") {
    const cy = s.sy - h * 0.66;
    const span = w * 2.6;                       // how far it throws
    /* The damp ring never dries out. It is the thing you read at
       distance — a dark, shiny patch of road in the middle of the lane
       is a warning you can take a line around before you can make out
       what is standing in it. */
    g.globalAlpha = 0.30 * fa;
    g.fillStyle = "#5f6f7a";
    g.beginPath();
    g.ellipse(s.sx, s.sy - h * 0.03, span * 0.8, span * 0.26, 0, 0, TWO_PI);
    g.fill();
    g.globalAlpha = 0.16 * fa;
    g.fillStyle = "#cfe6f2";
    g.beginPath();
    g.ellipse(s.sx - span * 0.14, s.sy - h * 0.05, span * 0.46, span * 0.13, 0, 0, TWO_PI);
    g.fill();

    if (o.on && w > 2) {
      /* four arcs of water leaving the nozzle a beat apart, so it reads
         as a sweep rather than a static fan */
      for (let k = 0; k < 4; k++) {
        const ph = ((o.t * 1.6 + o.phase * 0.4 + k * 0.25) % 1);
        const a = 0.55 * (1 - ph * 0.8) * fa;
        g.globalAlpha = a;
        g.strokeStyle = k % 2 ? "#f2fbff" : "#cfe6f2";
        g.lineWidth = Math.max(0.7, w * 0.10);
        for (const dir of [-1, 1]) {
          g.beginPath();
          g.moveTo(s.sx, cy);
          g.quadraticCurveTo(s.sx + dir * span * 0.32 * (0.3 + ph),
                             cy - h * 0.85 * (1 - ph * 0.55),
                             s.sx + dir * span * 0.5 * (0.35 + ph * 0.65),
                             s.sy - h * 0.04);
          g.stroke();
        }
      }
      /* and the spatter where it lands */
      g.globalAlpha = 0.5 * fa;
      g.fillStyle = "#f2fbff";
      for (let k = 0; k < 8; k++) {
        const t2 = (o.t * 3 + k * 0.77) % 1;
        const dir = k % 2 ? 1 : -1;
        const q = Math.max(0.8, w * 0.07);
        g.fillRect(s.sx + dir * span * (0.2 + t2 * 0.32) - q / 2,
                   s.sy - h * 0.05 - Math.sin(t2 * Math.PI) * h * 0.18, q, q);
      }
    }
    g.globalAlpha = fa;
  }
  g.globalAlpha = fa;

  /* the washing swings on its line; a heavier swing just after a kart
     has been through it */
  let rot = 0;
  if (o.kind === "washline") rot = Math.sin(raceTime * 1.7 + o.phase) * 0.05
                                 + (o.hitT > 0 ? Math.sin(raceTime * 22) * o.hitT * 0.22 : 0);
  /* a clipped log rocks, then settles */
  if (o.kind === "log" && o.hitT > 0) rot = Math.sin(raceTime * 26) * o.hitT * 0.10;
  if (o.kind === "ivpole") rot = Math.sin(raceTime * 1.1 + o.phase) * 0.02
                               + (o.hitT > 0
                                  ? (o.knock || 1) * o.hitT * 0.55
                                    + Math.sin(raceTime * 19) * o.hitT * 0.14
                                  : 0);

  if (rot) {
    /* pivot at the foot, never the middle — a sway about the centre
       lifts the base off the ground, which is the exact bug that made
       everything look like it was floating */
    g.translate(s.sx, s.sy);
    g.rotate(rot);
    g.translate(-s.sx, -s.sy);
  }
  drawHazed(g, img, "h" + o.kind + (o.v || 0), s.sx - w / 2, s.sy - h, w, h, s.z, false);
  g.restore();

  /* a warning glint on the ones that will actually put you in the wall,
     so a first lap is a lesson and not an ambush */
  if (hz && hz.effect !== "slick" && w > 8) {
    const p = 0.5 + Math.sin(raceTime * 4 + o.phase) * 0.5;
    g.save();
    g.globalAlpha = (0.10 + p * 0.12) * fa;
    g.fillStyle = "#ffd166";
    g.beginPath();
    g.ellipse(s.sx, s.sy - h * 0.03, w * 0.62, w * 0.20, 0, 0, TWO_PI);
    g.fill();
    g.restore();
  }
}

/* A heart on the road: spins on its vertical axis, bobs, and throws a
   soft light down onto the tarmac. Drawn rather than blitted, because
   at this size a cached sprite would be four pixels of mush. */
function drawCoin(g, b) {
  const { s, o } = b;
  const r = 7 * s.scale;
  if (r < 0.5) return;
  const t = raceTime * 3.4 + o.ph;
  const spin = Math.abs(Math.cos(t));          // 0 = edge on
  const bob = Math.sin(t * 0.8) * r * 0.5;
  const cy = s.sy - r * 2.1 + bob;

  const fa = s.fade < 1 ? s.fade : 1;
  g.save();
  g.globalAlpha = (0.18 + spin * 0.12) * fa;
  g.fillStyle = "#ff9ec4";
  g.beginPath(); g.ellipse(s.sx, s.sy, r * 1.5, r * 0.5, 0, 0, TWO_PI); g.fill();
  g.globalAlpha = fa;

  const hw = Math.max(0.6, r * (0.25 + spin * 0.75));
  g.fillStyle = spin > 0.28 ? "#ff5f95" : "#d64a78";
  g.beginPath();
  g.moveTo(s.sx, cy + r * 0.85);
  g.bezierCurveTo(s.sx - hw * 1.5, cy + r * 0.05, s.sx - hw, cy - r * 0.9, s.sx, cy - r * 0.25);
  g.bezierCurveTo(s.sx + hw, cy - r * 0.9, s.sx + hw * 1.5, cy + r * 0.05, s.sx, cy + r * 0.85);
  g.fill();
  if (spin > 0.45 && r > 1.6) {
    g.fillStyle = "rgba(255,255,255,.75)";
    g.beginPath();
    g.ellipse(s.sx - hw * 0.42, cy - r * 0.18, hw * 0.24, r * 0.20, -0.5, 0, TWO_PI);
    g.fill();
  }
  g.restore();
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
  /* the body's own heading — in a slide that is turned out of the
     direction the kart is actually travelling, which is what makes a
     drift look like a drift rather than a tight turn */
  const rel = o.angle + (o.yaw || 0) - camA;
  let ai = Math.round((((rel % TWO_PI) + TWO_PI) % TWO_PI) / TWO_PI * ANGLES) % ANGLES;
  /* which way the rider is hauling the wheel */
  const st = o.steer || 0;
  const lock = TURN * 22;
  const pose = o.spin > 0 ? 0 : st < -lock * 0.22 ? 1 : st > lock * 0.22 ? 2 : 0;
  const img = kartFrame(o.def.id, ai, pose);
  if (!img) return;

  /* KART_ON_SCREEN is the kart's height in world units as far as the
     projection is concerned. It is smaller than the sprite's true
     footprint on purpose: drawn at literal scale the player's own kart
     fills half the screen and you cannot see the corner you are about
     to take. A quarter of the screen height is the SNES proportion. */
  const h = KART_H * s.scale;
  const w = h * (img.width / img.height);
  if (w < 1.5) return;

  g.save();
  /* lean into the corner, and dip the nose under braking */
  if (!isGhost && (o.roll || o.dip)) {
    g.translate(s.sx, s.sy);
    g.rotate(-(o.roll || 0) * 0.55);
    g.translate(0, (o.dip || 0) * h * 0.05);
    g.translate(-s.sx, -s.sy);
  }
  if (isGhost) g.globalAlpha = 0.4;
  /* the ring makes you flash; a spin makes you wobble */
  if (!isGhost && o.invuln > 0 && Math.floor(o.invuln * 12) % 2) g.globalAlpha = 0.55;
  if (!isGhost && o.spin > 0) {
    g.translate(s.sx, s.sy);
    g.rotate(Math.sin(o.spin * 22) * 0.22);
    g.translate(-s.sx, -s.sy);
  }
  /* a little vertical bob, faster the quicker you are going, so the
     kart rides the road instead of sliding along a sheet of glass */
  const bobA = Math.min(1, Math.abs(o.speed || 0) / TOP_SPEED);
  const hopY = o.hop > 0 ? Math.sin((1 - o.hop / 0.34) * Math.PI) * h * 0.16 : 0;
  const bob = Math.sin((raceTime * 13 + (o.lane || 0)) ) * bobA * h * 0.018
            + (o.offroad ? Math.sin(raceTime * 27) * bobA * h * 0.028 : 0)
            /* the kerb, going through the springs */
            + Math.sin(raceTime * 41 + (o.lane || 0)) * (o.jolt || 0) * h * 0.030
            - hopY;
  /* squash and stretch. The chassis is compressed on landing and again
     over a big jolt; conserving area — wider by as much as it is
     shorter — is what stops it reading as the sprite being resized. */
  const sq = Math.min(0.30, (o.squash || 0) + (o.jolt || 0) * 0.05);
  const hS = h * (1 - sq), wS = w * (1 + sq * 0.62);
  drawHazed(g, img, "k" + o.def.id + ai + "p" + pose,
            s.sx - wS / 2, s.sy - hS + bob, wS, hS, s.z, false);
  g.restore();

  /* the bouquet orbits whoever is holding it */
  const orbit = o.item === "bouqshot" ? (o.ammo || 0) : (o.shield > 0 ? 3 : 0);
  if (!isGhost && orbit > 0) {
    for (let i = 0; i < orbit; i++) {
      const t = raceTime * 3 + (i / Math.max(1, orbit)) * TWO_PI;
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
  /* seeing stars, while spun */
  if (!isGhost && o.spin > 0) {
    for (let i = 0; i < 4; i++) {
      const t = raceTime * 9 + (i / 4) * TWO_PI;
      const px = s.sx + Math.cos(t) * w * 0.42;
      const py = s.sy - h * 1.02 + Math.sin(t) * h * 0.10;
      const q = Math.max(1.5, w * 0.075);
      g.fillStyle = i % 2 ? "#ffd166" : "#fff8e8";
      g.fillRect(px - q / 2, py - q / 2, q, q);
      g.fillRect(px - q, py - q / 6, q * 2, q / 3);
      g.fillRect(px - q / 6, py - q, q / 3, q * 2);
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
  const a = Math.max(0, o.life / o.max);
  const y = s.sy - o.z * s.scale;
  g.globalAlpha = a;
  if (o.streak) {
    const len = Math.max(2, 16 * s.scale);
    g.strokeStyle = o.col;
    g.lineWidth = Math.max(1, o.size * s.scale * 0.4);
    g.beginPath(); g.moveTo(s.sx, y); g.lineTo(s.sx, y + len); g.stroke();
  } else if (o.ring) {
    g.strokeStyle = o.col;
    g.lineWidth = Math.max(1, 2 * s.scale);
    g.beginPath();
    g.ellipse(s.sx, y, (1 - a) * o.size * 8 * s.scale,
              (1 - a) * o.size * 3 * s.scale, 0, 0, TWO_PI);
    g.stroke();
  } else {
    const q = Math.max(1, o.size * s.scale * 0.5);
    g.fillStyle = o.col;
    g.fillRect(s.sx - q / 2, y - q / 2, q, q);
  }
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
    hearts: id("rc-hearts"), heartsChip: id("rc-hearts-chip"),
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
  if (el.heartsChip) el.heartsChip.hidden = mode === "tutorial";
  if (mode === "tutorial") {
    el.time.textContent = fmt(raceTime);
    if (el.heartsChip) el.heartsChip.hidden = true;
    paintItem();
    drawMini();
    if (el.boost) {
      const on = me.drifting && me.driftCharge > 0.1;
      el.boost.hidden = !on;
      if (on) {
        el.boostFill.style.width = (Math.min(1, me.driftCharge / 2.0) * 100) + "%";
        el.boost.dataset.tier = me.driftCharge > 2.0 ? "3" : me.driftCharge > 1.2 ? "2" : "1";
      }
    }
    return;
  }
  el.lap.textContent = Math.max(1, Math.min(me.lap + 1, trackDef.laps)) + "/" + trackDef.laps;
  el.time.textContent = fmt(raceTime);
  if (el.hearts) {
    el.hearts.textContent = me.coins + "/" + COIN_CAP;
    el.heartsChip.dataset.full = me.coins >= COIN_CAP ? "1" : "0";
  }
  if (el.posNum) {
    el.posNum.textContent = me.place;
    el.posSuf.textContent = ["ST","ND","RD","TH","TH","TH","TH","TH"][Math.min(me.place - 1, 7)];
    el.pos.dataset.p = Math.min(me.place, 4);
  }
  if (el.boost) {
    const on = me.drifting && me.driftCharge > 0.1;
    el.boost.hidden = !on;
    if (on) {
      const f = Math.min(1, me.driftCharge / 2.0);
      el.boostFill.style.width = (f * 100) + "%";
      el.boost.dataset.tier = me.driftCharge > 2.0 ? "3" : me.driftCharge > 1.2 ? "2" : "1";
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
  } else if (kind === "bouquet" || kind === "bouqshot") {
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

  /* what is lying in wait, and where the hearts are — a lap you can
     read off the map before you get there is a lap you can plan */
  obstacles.forEach((h) => {
    const m = M(h);
    g.fillStyle = h.on ? "rgba(255,127,138,.95)" : "rgba(255,127,138,.35)";
    g.fillRect(m.x - 1.5, m.y - 1.5, 3, 3);
  });
  g.fillStyle = "rgba(255,95,149,.55)";
  coins.forEach((c) => {
    if (!c.alive) return;
    const m = M(c);
    g.fillRect(m.x - 0.8, m.y - 0.8, 1.6, 1.6);
  });

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
    } else if (r.rival) {
      g.strokeStyle = "rgba(255,209,102,.9)"; g.lineWidth = 1.6;
      g.beginPath(); g.arc(m.x, m.y, 5, 0, TWO_PI); g.stroke();
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
      ${TRACKS[trackIdx].hazard && TRACKS[trackIdx].hazard.warn
        ? `<p class="rc-warn">${TRACKS[trackIdx].hazard.warn}</p>` : ""}
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
      const spr = kartFrame(def.id, 0, 0);
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

  /* the hearts get counted at the end, because a thing you collect and
     nobody mentions afterwards stops feeling worth collecting */
  if (me.coins > 0)
    msg += ` <b>${me.coins}</b> heart${me.coins === 1 ? "" : "s"} in hand at the flag.`;

  const isGP = mode === "gp";
  const more = isGP && gpRound < TRACKS.length - 1;
  const total = gpPoints.reduce((a, b) => a + (b || 0), 0);

  setOverlay(`
    <div class="rc-panel rc-res">
      <h3 class="rc-h">${isGP ? "ROUND " + (gpRound + 1) + " OF " + TRACKS.length : "RESULTS"}</h3>
      <div class="rc-podium">${podium}</div>
      <ol class="rc-rest">${rest}</ol>
      ${isGP ? gpStandings() : ""}
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
    g.drawImage(kartFrame(def.id, 8, 0), 0, 0);  // facing the camera
    span.appendChild(c);
  });
}

/* The championship as it actually stands, everyone in it. A single
   number for the player told you nothing about whether you were
   winning. */
function gpStandings() {
  const rows = Object.keys(gpTable)
    .map((id) => ({ def: CHARS.find((c) => c.id === id), pts: gpTable[id] }))
    .filter((r) => r.def)
    .sort((a, b) => b.pts - a.pts);
  if (!rows.length) return "";
  const me = CHARS[playerCharIdx].id;
  return `
    <div class="rc-standings">
      <h4>CHAMPIONSHIP &middot; AFTER ROUND ${gpRound + 1} OF ${TRACKS.length}</h4>
      <ol>${rows.map((r, i) => `
        <li${r.def.id === me ? ' class="me"' : ""}>
          <b>${i + 1}</b><span>${r.def.name}</span><i>${r.pts}</i>
        </li>`).join("")}</ol>
    </div>`;
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
      ${gpStandings()}
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

        if (finalLap && !song.pushed) { song.pushed = true; }
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

        song.next += spb * (finalLap ? 0.88 : 1);   // last lap runs hotter
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
    /* a chrome pole going over: three bright metal hits, falling away */
    clatter() {
      const t = ctx ? ctx.currentTime : 0;
      [1180, 860, 640].forEach((f, i) =>
        tone({ f, f2: f * 0.55, dur: 0.09, gain: 0.13 - i * 0.03, type: "square", at: t + i * 0.055 }));
      noise({ f: 2400, f2: 700, dur: 0.22, gain: 0.10, filter: "bandpass", at: t });
    },
    /* the sprinkler catching you: a wet slap and a hiss */
    splash() {
      const t = ctx ? ctx.currentTime : 0;
      noise({ f: 900, f2: 2600, dur: 0.30, gain: 0.13, filter: "bandpass", at: t });
      tone({ f: 300, f2: 140, dur: 0.14, gain: 0.10, duty: 0.5, at: t });
    },
    scrape() {   /* the verge, while you are on it */
      if (!ready) return;
      noise({ f: 320, dur: 0.14, gain: 0.05, filter: "lowpass", q: 0.5 });
    },
    hop() {
      const t = ctx ? ctx.currentTime : 0;
      tone({ f: 520, f2: 900, dur: 0.09, gain: 0.13, duty: 0.25, at: t });
      noise({ f: 2400, dur: 0.05, gain: 0.05, at: t });
    },
    finalLap() {
      const t = ctx ? ctx.currentTime : 0;
      [660, 880, 1047, 1319].forEach((f, i) =>
        tone({ f, dur: 0.2, gain: 0.20, duty: 0.5, at: t + i * 0.09 }));
      noise({ f: 2600, f2: 900, dur: 0.35, gain: 0.10, at: t });
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
  ["boost","pickup","use","hit","scrape","click","hover","beep","lap","tick","fanfare","hop","finalLap","clatter","splash"]
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
  obstacles = []; coins = [];      // the tutorial lane stays clear
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
    if (mode === "gp") { gpRound = 0; gpPoints = []; gpTable = {}; trackIdx = 0; startRace(); }
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
  if (d.go)      { mode = d.go; gpTable = {}; renderChars(); return; }
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
    /* the photo finish: everything but the clock on the wall drops to a
       third speed for the run to the line */
    if (slowMo > 0) { slowMo = Math.max(0, slowMo - dt); dt *= 0.34; }
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

/* a hatch for the test harness — nothing in the page uses it */
if (typeof window !== "undefined")
  window.__RACE_DEBUG = () => ({ obstacles, coins, racers, props, trackDef, state, mode, path, cut, raceTime, buildScenery, SCENERY, HAZ });

return { start, stop };
})();
