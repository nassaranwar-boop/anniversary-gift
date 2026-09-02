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
const TEX      = 2048;   // the baked world, in texture pixels
const RW       = 400;    // internal render width  (then scaled up, unsmoothed)
const RH       = 225;    // internal render height
const HORIZON  = 90;     // screen row the ground vanishes at
const FOCAL    = 300;    // lens; bigger = narrower field of view
const CAM_H    = 30;     // camera height above the road
const CAM_DIST = 115;    // how far the camera trails the kart
const MAX_Z    = 2600;   // beyond this the ground is just haze

const ROAD_HALF   = 46;  // half the driveable width, texture pixels
const RUMBLE_HALF = 56;  // rumble strip ends here
const SHOULDER    = 78;  // graded shoulder ends here; past it is scenery

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
    blurb:"Through the pines, past the river bend, around the little cabin where it all began.",
    grass:"#4f8f52", grassAlt:"#478248", shoulder:"#8a6b45",
    road:"#8f7a5e", roadAlt:"#877257", rumbleA:"#ff7f8a", rumbleB:"#fff8e8",
    sky:["#8fd0ea","#c9ecd8"], haze:"#bfe0d2", accent:"#7ddba3",
    scenery:["pine","pine","pine","cabin","rock","bush"],
    pts:[[0.50,0.90],[0.33,0.88],[0.21,0.80],[0.17,0.68],[0.25,0.60],[0.37,0.57],
         [0.43,0.49],[0.35,0.41],[0.21,0.37],[0.14,0.27],[0.23,0.15],[0.39,0.10],
         [0.55,0.12],[0.67,0.20],[0.71,0.33],[0.81,0.37],[0.89,0.47],[0.87,0.61],
         [0.77,0.69],[0.79,0.81],[0.67,0.89]],
  },
  {
    id:"town", name:"Hometown Streets", laps:3,
    blurb:"Corner stores, porch lights, and the sprinklers that never once got the memo.",
    grass:"#6fae5c", grassAlt:"#64a153", shoulder:"#b9a684",
    road:"#8e8e96", roadAlt:"#87878f", rumbleA:"#ffc4a3", rumbleB:"#fff8e8",
    sky:["#8fd0ea","#ffe6bd"], haze:"#e2d3b6", accent:"#ffc4a3",
    scenery:["house","lamp","house","tree","postbox","bush"],
    pts:[[0.50,0.90],[0.30,0.87],[0.18,0.79],[0.15,0.66],[0.22,0.57],[0.34,0.53],
         [0.32,0.43],[0.20,0.38],[0.15,0.26],[0.26,0.16],[0.42,0.13],[0.52,0.20],
         [0.62,0.14],[0.76,0.17],[0.86,0.28],[0.84,0.41],[0.72,0.47],[0.74,0.58],
         [0.86,0.64],[0.85,0.79],[0.70,0.89]],
  },
  {
    id:"ward", name:"Hospital Dash", laps:3,
    blurb:"Bright halls, gift-cart shortcuts, and a slalom of IV poles. All joy, no gloom.",
    /* Bright, but not bleached: the ward was washing out to one flat
       white because the floor, the road and the sky were all within a
       few percent of each other. The road stays the lightest thing on
       screen and everything around it steps down, so the ribbon reads. */
    grass:"#b9c8de", grassAlt:"#adbdd6", shoulder:"#93a8c6",
    road:"#e9edf5", roadAlt:"#dde4ef", rumbleA:"#7ec8e3", rumbleB:"#fff8e8",
    sky:["#cfe4f4","#eef5fb"], haze:"#d6e6f2", accent:"#7ec8e3",
    scenery:["pole","cart","plant","pole","chair","plant"],
    pts:[[0.50,0.90],[0.32,0.86],[0.22,0.76],[0.26,0.65],[0.38,0.60],[0.36,0.50],
         [0.24,0.45],[0.16,0.34],[0.24,0.21],[0.40,0.14],[0.56,0.15],[0.66,0.23],
         [0.62,0.35],[0.70,0.43],[0.83,0.42],[0.90,0.53],[0.84,0.66],[0.72,0.71],
         [0.76,0.83],[0.64,0.90]],
  },
  {
    id:"roof", name:"Rooftop Sunset", laps:3,
    blurb:"String lights, laundry lines, and every cat in the city out to watch the finish.",
    grass:"#4a3a63", grassAlt:"#433457", shoulder:"#6d5a49",
    road:"#8a7a68", roadAlt:"#82735f", rumbleA:"#ffd166", rumbleB:"#ff7f8a",
    sky:["#ff8a5c","#ffd08a"], haze:"#ffb583", accent:"#ffd166",
    scenery:["lamp","cat","laundry","cat","vent","lamp"],
    pts:[[0.50,0.90],[0.31,0.86],[0.19,0.75],[0.22,0.62],[0.34,0.56],[0.30,0.45],
         [0.18,0.39],[0.17,0.26],[0.30,0.17],[0.46,0.13],[0.58,0.18],[0.56,0.29],
         [0.66,0.35],[0.79,0.31],[0.88,0.41],[0.86,0.55],[0.74,0.62],[0.79,0.74],
         [0.68,0.86]],
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
let path = [];      // {x,y} in texture pixels, closed loop
let segLen = [];    // length of each segment
let cumLen = [];    // distance from start to each node
let pathLen = 0;

function buildPath(def) {
  const raw = def.pts.map((p) => ({ x: p[0] * TEX, y: p[1] * TEX }));
  const n = raw.length;
  const out = [];
  /* Catmull-Rom through every control point, so the loop closes cleanly
     and there are no corners the spline did not ask for */
  for (let i = 0; i < n; i++) {
    const p0 = raw[(i - 1 + n) % n], p1 = raw[i];
    const p2 = raw[(i + 1) % n],     p3 = raw[(i + 2) % n];
    for (let t = 0; t < 1; t += 1 / 14) {
      const t2 = t * t, t3 = t2 * t;
      out.push({
        x: 0.5 * (2*p1.x + (-p0.x+p2.x)*t + (2*p0.x-5*p1.x+4*p2.x-p3.x)*t2 + (-p0.x+3*p1.x-3*p2.x+p3.x)*t3),
        y: 0.5 * (2*p1.y + (-p0.y+p2.y)*t + (2*p0.y-5*p1.y+4*p2.y-p3.y)*t2 + (-p0.y+3*p1.y-3*p2.y+p3.y)*t3),
      });
    }
  }
  path = out;
  segLen = []; cumLen = []; pathLen = 0;
  for (let i = 0; i < path.length; i++) {
    cumLen.push(pathLen);
    const j = (i + 1) % path.length;
    const d = Math.hypot(path[j].x - path[i].x, path[j].y - path[i].y);
    segLen.push(d);
    pathLen += d;
  }
}

function tangentAt(i) {
  const j = (i + 1) % path.length;
  return Math.atan2(path[j].y - path[i].y, path[j].x - path[i].x);
}

/* Nearest point on the loop. `hint` keeps the search local — without it
   this is the most expensive thing in the frame. */
function project(x, y, hint) {
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
  const dist = Math.sqrt(bd);
  const along = (cumLen[bi] + bt * segLen[bi]) / pathLen;
  /* which side of the road we are on, for nudging back on */
  const ta = tangentAt(bi);
  const nx = -Math.sin(ta), ny = Math.cos(ta);
  const j = (bi + 1) % n;
  const cx = path[bi].x + bt * (path[j].x - path[bi].x);
  const cy = path[bi].y + bt * (path[j].y - path[bi].y);
  const side = (x - cx) * nx + (y - cy) * ny;
  return { dist, idx: bi, t: bt, along, cx, cy, side, nx, ny, tan: ta };
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

function strokeLoop(g, width, style) {
  g.strokeStyle = style;
  g.lineWidth = width;
  g.lineJoin = "round";
  g.lineCap = "round";
  g.beginPath();
  for (let i = 0; i <= path.length; i++) {
    const p = path[i % path.length];
    if (i === 0) g.moveTo(p.x, p.y); else g.lineTo(p.x, p.y);
  }
  g.closePath();
  g.stroke();
}

/* a cheap, chunky noise: thousands of little squares rather than a
   per-pixel loop. Reads as pixel texture and bakes in a few ms. */
function speckle(g, count, size, colors) {
  for (let i = 0; i < count; i++) {
    const x = Math.random() * TEX, y = Math.random() * TEX;
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

  /* --- the ground everything else sits on --- */
  g.fillStyle = def.grass;
  g.fillRect(0, 0, TEX, TEX);
  speckle(g, 14000, 3, [def.grassAlt, shade(def.grass, 1.08), shade(def.grass, 0.92)]);

  /* a few broad patches so the field is not one flat colour */
  for (let i = 0; i < 60; i++) {
    g.globalAlpha = 0.10 + Math.random() * 0.10;
    g.fillStyle = i % 2 ? shade(def.grass, 1.14) : shade(def.grass, 0.86);
    const r = 60 + Math.random() * 190;
    g.beginPath();
    g.ellipse(Math.random()*TEX, Math.random()*TEX, r, r*(0.6+Math.random()*0.6), Math.random()*Math.PI, 0, TWO_PI);
    g.fill();
  }
  g.globalAlpha = 1;

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

  const img = g.getImageData(0, 0, TEX, TEX);
  tex32 = new Uint32Array(img.data.buffer);
  /* Past the edge of the baked world there is nothing to sample. Filling
     it with flat grass leaves a hard band; pulling it towards the haze
     colour lets it pass for ground too far off to make out. */
  voidColor = packRgb(mixRgb(def.grass, def.haze, 0.5));
  bakedId = def.id;
}

/* =========================================================
   8. THE SKY BAND

   Above the horizon there is no geometry, just a wide painted strip
   that slides sideways with the camera. Two copies are blitted so it
   wraps without a seam.
   ========================================================= */
let panoCvs = null, panoId = null;
const PANO_W = 1600, PANO_H = 150;

function bakePano(def) {
  if (panoId === def.id && panoCvs) return;
  if (!panoCvs) { panoCvs = document.createElement("canvas"); panoCvs.width = PANO_W; panoCvs.height = PANO_H; }
  const g = panoCvs.getContext("2d");
  g.clearRect(0, 0, PANO_W, PANO_H);

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
  panoId = def.id;
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

/* --- scenery: one small canvas per kind, drawn as a billboard ---

   Each is painted into a 64x96 sheet and then cropped to whatever it
   actually covers. Without the crop a bush — which only occupies the
   bottom quarter of its sheet — gets drawn as a tall mostly-empty
   rectangle, so it floats and carries a shadow far wider than itself.
   Cropping means the world height below is the height you see.        */
const SCENERY = {
  pine:{ h:170, foot:.55 }, tree:{ h:140, foot:.6 },  bush:{ h:34, foot:.9 },
  rock:{ h:32,  foot:.9  }, cabin:{ h:150, foot:.9 }, house:{ h:145, foot:.9 },
  lamp:{ h:135, foot:.3  }, postbox:{ h:46, foot:.8 },pole:{ h:130, foot:.35 },
  cart:{ h:76,  foot:.8  }, chair:{ h:66, foot:.7 },  plant:{ h:58, foot:.8 },
  vent:{ h:56,  foot:.9  }, laundry:{ h:130, foot:.3 },cat:{ h:52, foot:.85 },
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
function buildScenery(kind) {
  if (sceneryCache[kind]) return sceneryCache[kind];
  const W = 64, H = 96;
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const g = c.getContext("2d");
  const R = (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
  const mid = W / 2;

  if (kind === "pine") {
    /* the trunk goes down first and the lowest skirt comes down over
       it, so only a few pixels of stem show — a long bare trunk reads
       as a fence post once the foliage is up out of frame */
    R(mid - 3, H - 14, 6, 14, "#5a3f28");
    R(mid - 3, H - 14, 2, 14, "#6f5136");
    for (let i = 0; i < 4; i++) {
      const y = H - 5 - i * 17, w = 29 - i * 5.5;
      g.fillStyle = i % 2 ? "#2f6b3d" : "#3b8149";
      g.beginPath();
      g.moveTo(mid, y - 26); g.lineTo(mid - w, y); g.lineTo(mid + w, y);
      g.fill();
      g.fillStyle = "rgba(255,255,255,.10)";
      g.beginPath();
      g.moveTo(mid, y - 26); g.lineTo(mid - w, y); g.lineTo(mid - w * 0.3, y);
      g.fill();
    }
  } else if (kind === "tree") {
    R(mid - 4, H - 24, 8, 24, "#6a4a2c");
    g.fillStyle = "#3f8a48";
    g.beginPath(); g.arc(mid, H - 44, 22, 0, TWO_PI); g.fill();
    g.beginPath(); g.arc(mid - 15, H - 34, 15, 0, TWO_PI); g.fill();
    g.beginPath(); g.arc(mid + 15, H - 34, 15, 0, TWO_PI); g.fill();
    g.fillStyle = "#4f9e58";
    g.beginPath(); g.arc(mid - 5, H - 50, 13, 0, TWO_PI); g.fill();
  } else if (kind === "bush") {
    g.fillStyle = "#3f8a48";
    g.beginPath(); g.arc(mid, H - 12, 14, 0, TWO_PI); g.fill();
    g.beginPath(); g.arc(mid - 11, H - 8, 10, 0, TWO_PI); g.fill();
    g.beginPath(); g.arc(mid + 11, H - 8, 10, 0, TWO_PI); g.fill();
    g.fillStyle = "#ff9ec4";
    R(mid - 6, H - 20, 3, 3, "#ff9ec4"); R(mid + 6, H - 16, 3, 3, "#fff1e0");
  } else if (kind === "rock") {
    g.fillStyle = "#8c8577";
    g.beginPath(); g.moveTo(mid - 16, H); g.lineTo(mid - 10, H - 18);
    g.lineTo(mid + 4, H - 22); g.lineTo(mid + 16, H); g.fill();
    g.fillStyle = "#a49c8c";
    g.beginPath(); g.moveTo(mid - 6, H - 14); g.lineTo(mid + 2, H - 20);
    g.lineTo(mid + 8, H - 8); g.lineTo(mid - 2, H - 6); g.fill();
  } else if (kind === "cabin") {
    R(mid - 26, H - 38, 52, 38, "#8a6a4a");
    for (let y = H - 36; y < H - 2; y += 7) R(mid - 26, y, 52, 1, "#6f523a");
    g.fillStyle = "#7a3f30";
    g.beginPath(); g.moveTo(mid - 32, H - 38); g.lineTo(mid, H - 62);
    g.lineTo(mid + 32, H - 38); g.fill();
    R(mid - 7, H - 22, 14, 22, "#5c3b26");
    R(mid + 10, H - 32, 11, 10, "#ffd98a");
    R(mid - 21, H - 32, 11, 10, "#ffd98a");
  } else if (kind === "house") {
    R(mid - 24, H - 40, 48, 40, "#e0c3a4");
    g.fillStyle = "#9c6152";
    g.beginPath(); g.moveTo(mid - 29, H - 40); g.lineTo(mid, H - 60);
    g.lineTo(mid + 29, H - 40); g.fill();
    R(mid - 6, H - 20, 12, 20, "#7d5340");
    R(mid + 9, H - 34, 10, 9, "#ffd98a");
    R(mid - 19, H - 34, 10, 9, "#ffd98a");
    R(mid - 26, H - 22, 52, 3, "#c8a98c");     // porch lip
  } else if (kind === "lamp") {
    R(mid - 2, H - 56, 4, 56, "#4d4a55");
    R(mid - 8, H - 62, 16, 8, "#6a6675");
    R(mid - 6, H - 60, 12, 5, "#ffe6a8");
    g.globalAlpha = 0.35; g.fillStyle = "#ffd166";
    g.beginPath(); g.arc(mid, H - 57, 15, 0, TWO_PI); g.fill();
    g.globalAlpha = 1;
  } else if (kind === "postbox") {
    R(mid - 8, H - 30, 16, 30, "#c0524f");
    g.fillStyle = "#a8403f";
    g.beginPath(); g.arc(mid, H - 30, 8, Math.PI, 0); g.fill();
    R(mid - 5, H - 26, 10, 3, "#2f2530");
  } else if (kind === "pole") {          // IV pole
    R(mid - 1, H - 62, 3, 62, "#b9c2d1");
    R(mid - 9, H - 66, 18, 4, "#b9c2d1");
    R(mid - 7, H - 60, 8, 14, "#dff0ff");
    R(mid - 6, H - 56, 6, 9, "#a8d8ef");
    R(mid - 7, H - 4, 14, 4, "#98a2b3");
  } else if (kind === "cart") {          // gift cart
    R(mid - 16, H - 26, 32, 18, "#e3e8f0");
    R(mid - 16, H - 30, 32, 5, "#c3cbd8");
    R(mid - 12, H - 42, 24, 13, "#ff9ec4");
    R(mid - 12, H - 37, 24, 3, "#fff1e0");
    R(mid - 2, H - 42, 4, 13, "#fff1e0");
    R(mid - 13, H - 8, 6, 6, "#5a5f6b"); R(mid + 7, H - 8, 6, 6, "#5a5f6b");
  } else if (kind === "chair") {
    R(mid - 11, H - 20, 22, 6, "#9fb4cc");
    R(mid - 11, H - 36, 5, 18, "#9fb4cc");
    R(mid - 12, H - 6, 5, 6, "#4f5865"); R(mid + 7, H - 6, 5, 6, "#4f5865");
  } else if (kind === "plant") {
    /* stems first, so the leaves grow out of the pot instead of hovering
       a few pixels above it with daylight in between */
    g.strokeStyle = "#3f7a48"; g.lineWidth = 2;
    for (let i = 0; i < 5; i++) {
      const t = -Math.PI / 2 + (i - 2) * 0.42;
      g.beginPath();
      g.moveTo(mid, H - 16);
      g.lineTo(mid + Math.cos(t) * 11, H - 18 + Math.sin(t) * 13);
      g.stroke();
    }
    g.fillStyle = "#4f9e58";
    for (let i = 0; i < 5; i++) {
      const t = -Math.PI / 2 + (i - 2) * 0.42;
      g.beginPath();
      g.ellipse(mid + Math.cos(t) * 12, H - 20 + Math.sin(t) * 13, 5, 10, t + Math.PI / 2, 0, TWO_PI);
      g.fill();
    }
    R(mid - 9, H - 17, 18, 5, "#d69a72");
    R(mid - 7, H - 13, 14, 13, "#c98f68");
    R(mid - 7, H - 13, 3, 13, "#d9a67f");
  } else if (kind === "vent") {
    R(mid - 14, H - 22, 28, 22, "#6f6a78");
    R(mid - 14, H - 26, 28, 5, "#88818f");
    for (let x = mid - 10; x < mid + 10; x += 6) R(x, H - 18, 3, 14, "#544f5e");
  } else if (kind === "laundry") {
    R(mid - 2, H - 60, 4, 60, "#7a6a58");
    R(mid - 24, H - 58, 48, 2, "#d8cfc0");
    const cols = ["#ff9ec4", "#ffe07a", "#7ec8e3", "#fff1e0"];
    for (let i = 0; i < 4; i++) R(mid - 20 + i * 12, H - 56, 9, 16, cols[i]);
  } else if (kind === "cat") {
    const body = "#3a3340";
    g.fillStyle = body;
    g.beginPath(); g.ellipse(mid, H - 10, 12, 10, 0, 0, TWO_PI); g.fill();
    g.beginPath(); g.arc(mid + 2, H - 24, 9, 0, TWO_PI); g.fill();
    g.beginPath(); g.moveTo(mid - 5, H - 30); g.lineTo(mid - 2, H - 38); g.lineTo(mid + 2, H - 30); g.fill();
    g.beginPath(); g.moveTo(mid + 5, H - 30); g.lineTo(mid + 9, H - 38); g.lineTo(mid + 11, H - 30); g.fill();
    R(mid - 2, H - 26, 2, 2, "#ffd166"); R(mid + 5, H - 26, 2, 2, "#ffd166");
    g.strokeStyle = body; g.lineWidth = 3;
    g.beginPath(); g.moveTo(mid - 11, H - 8); g.quadraticCurveTo(mid - 22, H - 14, mid - 18, H - 26); g.stroke();
  }
  sceneryCache[kind] = cropToContent(c);
  return sceneryCache[kind];
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
function renderGround(camX, camY, camA) {
  const cosA = Math.cos(camA), sinA = Math.sin(camA);
  const rx = -sinA, ry = cosA;              // camera right vector
  const halfW = RW / 2;

  for (let py = HORIZON; py < RH; py++) {
    const dy = py - HORIZON;
    const z = (CAM_H * FOCAL) / (dy < 1 ? 1 : dy);
    let o = py * RW;

    if (z > MAX_Z) {                        // too far to resolve — haze it
      for (let px = 0; px < RW; px++) buf32[o++] = voidColor;
      continue;
    }

    const sc = z / FOCAL;
    let wx = camX + cosA * z + rx * -halfW * sc;
    let wy = camY + sinA * z + ry * -halfW * sc;
    const sx = rx * sc, sy = ry * sc;

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

  const off = ((camA / TWO_PI) * PANO_W) % PANO_W;
  const y = HORIZON - PANO_H + 4;
  g.drawImage(panoCvs, -off, y);
  g.drawImage(panoCvs, -off + PANO_W, y);
  if (off < RW) g.drawImage(panoCvs, -off - PANO_W, y);
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
     so this only ever culls things already well behind the kart. */
  if (z < 50) return null;
  return {
    z,
    sx: RW / 2 + (x / z) * FOCAL,
    sy: HORIZON + (CAM_H / z) * FOCAL,
    scale: FOCAL / z,
  };
}

/* =========================================================
   11. RACERS
   ========================================================= */
const TOP_SPEED = 4.55;         // texture pixels per frame at 60fps
const ACCEL     = 0.055;
const BRAKE     = 0.11;
const DRAG      = 0.018;
const TURN      = 2.5 * DEG;

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
    this.aiJitter = Math.random() * TWO_PI;
    this.aiItemWait = 1 + Math.random() * 3;
  }

  get maxSpeed() {
    let m = TOP_SPEED;
    if (!this.isPlayer) m *= [0.955, 0.995, 1.03][difficulty];
    if (this.offroad) m *= 0.52;
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

    if (gas)      this.speed += ACCEL * dt * 60;
    else if (rev) this.speed -= BRAKE * dt * 60;
    else          this.speed -= Math.sign(this.speed) * DRAG * dt * 60;

    const max = this.maxSpeed;
    if (this.speed >  max) this.speed += (max - this.speed) * 0.08;
    if (this.speed < -max * 0.35) this.speed = -max * 0.35;
    if (!gas && !rev && Math.abs(this.speed) < 0.02) this.speed = 0;

    /* Drift: hold the button while turning and it locks a direction,
       builds a charge, and pays out a boost on release. Three tiers,
       flagged by the colour of the sparks. */
    const turning = left || right;
    if (dkey && turning && this.speed > TOP_SPEED * 0.42) {
      if (!this.drifting) { this.drifting = true; this.driftDir = left ? -1 : 1; this.driftCharge = 0; }
      this.driftCharge = Math.min(this.driftCharge + dt, 3);
    } else if (this.drifting) {
      if (this.driftCharge > 1.7)      this.boost = 1.15;
      else if (this.driftCharge > 1.0) this.boost = 0.75;
      else if (this.driftCharge > 0.5) this.boost = 0.42;
      this.drifting = false;
      this.driftCharge = 0;
    }

    let rate = TURN * (this.drifting ? 1.5 : 1);
    rate *= 0.55 + 0.45 * Math.min(1, Math.abs(this.speed) / (TOP_SPEED * 0.6));
    const dir = this.speed < 0 ? -1 : 1;
    if (left)  this.angle -= rate * dt * 60 * dir;
    if (right) this.angle += rate * dt * 60 * dir;
    /* a drift keeps pulling the way it was started, even mid-correction */
    if (this.drifting) this.angle += this.driftDir * TURN * 0.32 * dt * 60;

    if (input.itemPressed) { input.itemPressed = false; this.fire(); }
  }

  driveAI(dt) {
    const n = path.length;
    /* aim a few nodes ahead, offset onto its own line so the field does
       not drive as one stack */
    let tries = 0;
    while (tries++ < 8) {
      const tp = path[this.aiTarget];
      if (Math.hypot(tp.x - this.x, tp.y - this.y) > 55) break;
      this.aiTarget = (this.aiTarget + 1) % n;
    }
    const tIdx = this.aiTarget;
    const ta = tangentAt(tIdx);
    this.aiJitter += dt * 0.7;
    const lane = this.lane * 0.75 + Math.sin(this.aiJitter) * 10;
    const tx = path[tIdx].x - Math.sin(ta) * lane;
    const ty = path[tIdx].y + Math.cos(ta) * lane;

    let diff = Math.atan2(ty - this.y, tx - this.x) - this.angle;
    while (diff >  Math.PI) diff -= TWO_PI;
    while (diff < -Math.PI) diff += TWO_PI;
    const rate = TURN * 1.25 * dt * 60;
    this.angle += Math.max(-rate, Math.min(rate, diff));

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
    this.hint = pr.idx;
    this.offroad = pr.dist > RUMBLE_HALF;

    /* the wall is soft: past the shoulder you get pushed back and lose
       most of your speed, rather than stopping dead */
    if (pr.dist > SHOULDER) {
      const push = pr.dist - SHOULDER;
      const s = Math.sign(pr.side) || 1;
      this.x -= pr.nx * s * push;
      this.y -= pr.ny * s * push;
      /* Scrape, don't stop. The push above already removes the sideways
         motion; taking a big bite out of the speed as well every frame
         meant a kart that touched the verge simply died there. */
      this.speed *= 0.97;
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
      if (this.isPlayer && this.lap >= 1 && this.lap < trackDef.laps)
        flashBanner("LAP " + (this.lap + 1));
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
  bakeTrack(trackDef);
  bakePano(trackDef);
  placeProps(trackDef);
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
    countdown -= dt;
    paintCount();
    if (countdown <= 0) { state = "race"; setCount(""); }
    return;
  }
  if (state !== "race") return;

  raceTime += dt;
  if (bannerT > 0) { bannerT -= dt; if (bannerT <= 0) setBanner(""); }
  if (shake > 0) shake = Math.max(0, shake - dt * 6);

  racers.forEach((r) => r.update(dt));
  order();

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
        if (r.isPlayer) paintItem();
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
  if (r.isPlayer) { shake = 3; flashBanner("OUCH!"); }
}

/* =========================================================
   15. DRAW
   ========================================================= */
function draw() {
  const me = racers.find((r) => r.isPlayer);
  if (!me) return;

  /* the camera trails the kart, and lags its heading a touch so hard
     corners swing rather than snap */
  const camA = me.angle;
  const camX = me.x - Math.cos(camA) * CAM_DIST;
  const camY = me.y - Math.sin(camA) * CAM_DIST;

  renderGround(camX, camY, camA);
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
  const img = buildScenery(o.kind);
  const spec = SCENERY[o.kind] || { h: 90, foot: 0.6 };
  const h = spec.h * o.hv * s.scale;
  const w = h * (img.width / img.height);
  if (w < 1.2) return;
  shadowUnder(g, s.sx, s.sy, w * spec.foot);
  g.drawImage(img, s.sx - w / 2, s.sy - h, w, h);
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
  for (const p of path) {
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
  setOverlay(`
    <div class="rc-title">
      <p class="rc-logo"><span>SUPER</span><b>OUISSY</b><i>RACE</i></p>
      <p class="rc-tag">Two racers. Four memories. One finish line — and we cross it together.</p>
      <div class="rc-menu">
        <button class="rc-btn" data-go="single">SINGLE RACE</button>
        <button class="rc-btn" data-go="gp">GRAND PRIX</button>
        <button class="rc-btn" data-go="trial">TIME TRIAL</button>
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
  setOverlay(`
    <div class="rc-panel rc-pausep">
      <h3 class="rc-h">PAUSED</h3>
      <div class="rc-menu">
        <button class="rc-btn" data-resume="1">RESUME</button>
        <button class="rc-btn" data-restart="1">RESTART</button>
        <button class="rc-btn" data-back="title">QUIT TO MENU</button>
      </div>
    </div>`, "rc-ov-panel");
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
  const d = t.dataset;

  if (d.quit)    { leave(); return; }
  if (d.diff)    { difficulty = +d.diff; markDiff(); return; }
  if (d.diff === "0") { difficulty = 0; markDiff(); return; }
  if (d.go)      { mode = d.go; renderChars(); return; }
  if (d.char !== undefined) { playerCharIdx = +d.char; renderChars(); return; }
  if (d.track !== undefined) { trackIdx = +d.track; renderTracks(); return; }
  if (d.back === "title") { setOverlay(""); showHud(false); renderTitle(); return; }
  if (d.back === "chars") { renderChars(); return; }
  if (d.resume)  { setOverlay(""); state = "race"; return; }
  if (d.restart) { setOverlay(""); startRace(); return; }
  if (d.next === "chars" || d.next === "tracks") { next(d.next); return; }
  if (d.next === "again")  { startRace(); return; }
  if (d.next === "gpnext") { gpRound++; trackIdx = gpRound; startRace(); return; }
  if (d.next === "gpend")  { renderGPEnd(); return; }
}

/* the on-screen pad: press-and-hold, multi-touch, and it never scrolls
   the page out from under her */
function bindPad() {
  if (!el.pad) return;
  el.pad.querySelectorAll("[data-k]").forEach((btn) => {
    const k = btn.dataset.k;
    const on  = (e) => { e.preventDefault(); btn.classList.add("on");
                         if (k === "item") input.itemPressed = true; else input[k] = true; };
    const off = (e) => { e.preventDefault(); btn.classList.remove("on");
                         if (k !== "item") input[k] = false; };
    btn.addEventListener("touchstart", on,  { passive:false });
    btn.addEventListener("touchend",   off, { passive:false });
    btn.addEventListener("touchcancel",off, { passive:false });
    btn.addEventListener("mousedown",  on);
    btn.addEventListener("mouseup",    off);
    btn.addEventListener("mouseleave", off);
  });
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
  if (el.pause) el.pause.addEventListener("click", () => {
    if (state === "race") renderPause(); else if (state === "paused") { setOverlay(""); state = "race"; }
  });
  bindPad();

  resize();
  renderTitle();
  raf = requestAnimationFrame(frame);
}

function stop() {
  running = false;
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
