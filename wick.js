/* =========================================================
   WICK & COGS — a night shift at the toy emporium

   An original camera-and-doors survival horror. You are the new night
   guard at Wick & Cogs Toy Emporium, alone from midnight to six, with a
   power meter, two doors, a ceiling hatch and eight cameras between you
   and four wind-up performers that are not supposed to move.

   ---------------------------------------------------------
   HOW THIS IS BUILT, AND WHY

   Three.js, on the copy already bundled in vendor/ for the book intro.
   The racing chapter is NOT Three.js — it is a hand-written Mode 7
   scanline renderer — so there was nothing there to extend. This is a
   clean parallel setup, deliberately kept generic (the texture library,
   the prop kit, the light rig and the contact-shadow helper below are
   all game-agnostic) so that if the racer is ever rebuilt in 3D the
   tooling is already here rather than written twice.

   Four rules were learned the hard way on the racer and are load-bearing
   here. Breaking any of them is a regression:

   1. NOTHING IS A FLAT CUTOUT. Every wall, shelf, cabinet, door and prop
      is a solid with faces the light hits differently. `slab()` and the
      kit builders below never return a single plane. The only planes in
      the whole file are contact shadows and glass, and both are marked.

   2. EVERYTHING IS GROUNDED. `place()` is the only way a prop enters a
      room, and it lays a soft contact shadow under whatever it places.
      If an object is in a room and it is not floating, it went through
      `place()`.

   3. NOTHING IS RECOMPUTED PER FRAME. A room is built once, in its own
      local space, into a Group whose world transform is set once at boot
      and never touched again. The camera moves; the world does not. On
      the racer, props were re-derived from the camera each frame and
      visibly swam. There is no code path here that can do that — the
      frame loop only writes to lights, doors, the cast and the clock.

   4. NOTHING IS STAMPED TWICE. Anything that appears more than once has
      a variant kit (`KIT.shelf` has four, `KIT.cabinet` four, `KIT.chair`
      three, `KIT.crate` three, `KIT.toy` six) and `place()` jitters
      rotation and scale. No two rooms share a builder.

   It carries no files of its own, the same rule Super Ouissy and the
   apocalypse follow: every texture is painted into a canvas at boot and
   every sound is synthesised, so the chapter adds one script and nothing
   else to the repo.
   ========================================================= */
window.WickAndCogs = (function () {
"use strict";

/* =========================================================
   1. THE WORDS — everything the player reads
   ========================================================= */
const WK = {
  shop:  "WICK & COGS",
  sub:   "TOY EMPORIUM",
  tag:   "est. 1931 · wind-ups, marvels & mechanical friends",

  /* the voicemail that opens night one. Kept short and mundane on
     purpose — the horror is in what it does not say. */
  intro: {
    from: "voicemail — 11:52 PM",
    lines: [
      "Hey. You must be the new one. Sorry, I'd have met you at the door but I'm not coming back in.",
      "Rules are on the desk. Two doors, one hatch, and the power's on a meter — the whole night runs off one charge, so don't sit there with everything shut.",
      "The cameras cost you a bit too. Look when you need to. Not the whole time.",
      "The old performers... look. They were built to move. That's what they were for. Nobody ever wrote down how to make them stop.",
      "If one of them's at your door, shut it. If you hear the ceiling, that's not the pipes.",
      "Six o'clock and you're out. The last one didn't finish their shift. You will.",
    ],
  },

  /* short beats between nights. Found paper, mostly. */
  beats: {
    2: {
      title: "a note, taped inside the desk drawer",
      lines: [
        "They wind down by themselves around four. That's what the manual says.",
        "The manual is from 1931 and whoever wrote it never worked a night.",
        "— G.",
      ],
    },
    3: {
      title: "voicemail — 12:04 AM",
      lines: [
        "It's me again. I shouldn't be calling you.",
        "The ballerina — Marabelle. Don't take your eyes off her and she can't do anything. That's not superstition, I timed it.",
        "The owl doesn't care about your doors. It never did. Watch the ducts.",
        "And the jester. If he's at your door and you hold it, he'll just keep knocking until the meter's empty. Let him go past. I know how that sounds.",
        "Six o'clock. That's all any of us get.",
      ],
    },
  },

  finale: {
    title: "6:00 AM",
    lines: [
      "The shutters go up on their own at six. They always have.",
      "Out on the shop floor everything is exactly where it was at midnight — the soldier on his plinth, the owl in the rafters, the ballerina under her glass, the jester folded back into his box.",
      "One of them is facing the office. None of them were, last night.",
      "You lock up, and the morning comes in through the front windows the colour of weak tea, and the shop smells like brass and dust and nothing at all.",
      "Same time tomorrow.",
    ],
  },

  howTo: [
    ["THE SHIFT", "Midnight to six. Six hours, about six minutes. Survive them."],
    ["THE MONITOR", "Pull it up to see the shop. It hides the office while it is up — and it costs power every second it is on."],
    ["THE DOORS", "One on each side of you. Closed doors keep things out and drain the meter the whole time they are shut."],
    ["THE HATCH", "The ceiling vent. One of them does not use doors at all."],
    ["THE METER", "One charge for the whole night. Idle drain, cameras, doors. At zero the lights go and the doors will not answer."],
    ["LISTEN", "Every one of them sounds like itself. Headphones, if you have them."],
  ],
};

/* =========================================================
   2. TUNING — how the night feels

   Almost every complaint about a game like this is one of these
   numbers. They are all here, in one block, on purpose.
   ========================================================= */
const TUNE = {
  hourSeconds:  56,     // real seconds per in-game hour (6 hours ≈ 5:36)

  power: {
    start:      100,
    idle:       0.62,   // %/s just sitting there
    camera:     0.75,   // %/s extra while the monitor is up
    door:       1.05,   // %/s extra per closed door
    hatch:      0.85,   // %/s extra while the hatch is latched
    jaxDoor:    1.15,   // Jax leaning on a shut door costs this much more
    knock:      2.2,    // and each of his knocks takes this off outright
    warn:       25,     // the meter starts complaining here
    critical:   10,
  },

  /* the blackout. Not a game over — a held breath. The less power you
     wasted, the shorter it is, because the shift is nearly done. */
  blackout: {
    graceMin:   14,     // seconds of dark before anything can reach you
    graceMax:   26,
    approach:   9,      // seconds from the music starting to the end of it
  },

  cast: {
    /* seconds between movement rolls, and the chance each roll lands.
       Both are scaled per night and per hour by NIGHTS below. */
    cogsworth: { step: 5.0, chance: 0.30, doorGrace: 4.2, retreat: 2.4 },
    chime:     { step: 6.5, chance: 0.26, hatchGrace: 5.0, retreat: 3.0 },
    marabelle: { step: 4.4, chance: 0.34, doorGrace: 4.6, retreat: 2.6 },
    jax:       { step: 3.4, chance: 0.40, doorGrace: 3.4, retreat: 1.6 },
  },

  /* how loud a cue is at each distance from the office, in rooms */
  cueGain: [0.9, 0.55, 0.3, 0.16],
};

/* =========================================================
   3. THE NIGHTS

   A night names who is awake, when they wake, and a multiplier over
   TUNE.cast for each hour. Adding a fourth night is adding an entry —
   nothing else in the file knows how many there are.
   ========================================================= */
const NIGHTS = [
  {
    n: 1,
    name: "NIGHT ONE",
    blurb: "Nothing has ever happened here.",
    power: 100,
    /* who is awake, and from which hour (0 = midnight) */
    active: { cogsworth: 0, marabelle: 2, jax: 4 },
    /* aggression per hour, 12am → 5am */
    ramp: [0.55, 0.7, 0.85, 1.0, 1.15, 1.3],
    hazards: [],
  },
  {
    n: 2,
    name: "NIGHT TWO",
    blurb: "Something in the ducts has started keeping time with you.",
    power: 100,
    active: { cogsworth: 0, chime: 0, marabelle: 1, jax: 2 },
    ramp: [0.8, 0.95, 1.1, 1.25, 1.45, 1.6],
    /* the workshop camera never came back after last night */
    hazards: ["deadWorkshop"],
  },
  {
    n: 3,
    name: "NIGHT THREE",
    blurb: "The hall light has been going since ten. Nobody is coming to fix it.",
    power: 100,
    active: { cogsworth: 0, chime: 0, marabelle: 0, jax: 0 },
    ramp: [1.0, 1.15, 1.35, 1.55, 1.75, 2.0],
    /* cameras drop out one at a time, and the hall light dies with them */
    hazards: ["deadWorkshop", "signalLoss", "hallDark"],
  },
];

/* =========================================================
   4. THE SHOP — rooms, and how they join up

   `id` is the key everywhere. `cam` is the number on the monitor;
   the office has none because it is where you are sitting. `to` is
   the floor graph the walkers use; `duct` is the separate network
   above the ceiling that only the owl can use.
   ========================================================= */
const ROOMS = [
  { id:"office",   cam:0, name:"SECURITY OFFICE", to:["hall","party"], duct:["ducts"] },
  { id:"hall",     cam:1, name:"MAIN HALL",       to:["foyer","stage","arcade","office"], duct:[] },
  { id:"stage",    cam:2, name:"SHOW STAGE",      to:["hall","workshop"], duct:["ducts"] },
  { id:"arcade",   cam:3, name:"ARCADE ROW",      to:["hall","party"], duct:[] },
  { id:"party",    cam:4, name:"PARTY ROOM",      to:["arcade","closet","office"], duct:["ducts"] },
  { id:"foyer",    cam:5, name:"FRONT FOYER",     to:["hall"], duct:[] },
  { id:"closet",   cam:6, name:"SUPPLY CLOSET",   to:["party"], duct:["ducts"] },
  { id:"ducts",    cam:7, name:"DUCT JUNCTION",   to:[], duct:["stage","closet","party","office"] },
  { id:"workshop", cam:8, name:"REPAIR WORKSHOP", to:["stage"], duct:["ducts"] },
];
const ROOM = {};
ROOMS.forEach((r) => { ROOM[r.id] = r; });

/* the order the monitor lays them out in, as a little floor plan */
const MAP_PLAN = [
  { id:"workshop", x: 8,  y: 8,  w:22, h:20 },
  { id:"stage",    x:34,  y: 6,  w:30, h:24 },
  { id:"foyer",    x:68,  y: 8,  w:24, h:22 },
  { id:"hall",     x:20,  y:36,  w:60, h:14 },
  { id:"arcade",   x:12,  y:56,  w:26, h:22 },
  { id:"party",    x:42,  y:56,  w:26, h:22 },
  { id:"closet",   x:72,  y:56,  w:18, h:16 },
  { id:"ducts",    x:72,  y:76,  w:18, h:16 },
];

/* =========================================================
   5. THE CAST

   `route` is the floor path each one walks toward the office. The last
   entry is the doorway it attacks from: "left" is the hall side,
   "right" is the party side, "hatch" is the ceiling.
   ========================================================= */
const CAST = [
  {
    id:"cogsworth", name:"COGSWORTH",
    what:"clockwork tin soldier",
    threat:"Marches. You will hear him long before you see him — and the marching stops when he is at your door.",
    colour:"#c8564a",
    home:"stage",
    route:["stage","hall","hall","office"],
    door:"left",
  },
  {
    id:"chime", name:"CHIME",
    what:"clockwork owl",
    threat:"Lives above the ceiling. Doors mean nothing to it. Watch the ducts, and latch the hatch.",
    colour:"#8ea9c6",
    home:"workshop",
    route:["workshop","ducts","ducts","office"],
    door:"hatch",
    usesDuct:true,
  },
  {
    id:"marabelle", name:"MARABELLE",
    what:"porcelain music-box ballerina",
    threat:"Cannot move while she is being watched. Can move the entire time she is not.",
    colour:"#e6b7cd",
    home:"party",
    route:["party","party","office"],
    door:"right",
  },
  {
    id:"jax", name:"JAX",
    what:"jack-in-the-box jester",
    threat:"Fast, and he does not wait politely. A shut door only makes him knock, and every knock costs you.",
    colour:"#b46fd0",
    home:"closet",
    route:["closet","party","arcade","party","office"],
    door:"right",
  },
];
const BY_ID = {};
CAST.forEach((c) => { BY_ID[c.id] = c; });

/* =========================================================
   6. SMALL MATHS

   One seeded generator drives every texture and every scatter of
   props, so the shop is identical every time it is built — which
   matters, because "the crate moved" should only ever be true of a
   thing that is supposed to move.
   ========================================================= */
const T = window.THREE;
const TAU = Math.PI * 2;
const DEG = Math.PI / 180;

function mulberry(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function seedOf(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function rngFor(name) { return mulberry(seedOf(name)); }

const clamp  = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp   = (a, b, t) => a + (b - a) * t;
const smooth = (t) => t * t * (3 - 2 * t);
function pick(rnd, arr) { return arr[(rnd() * arr.length) | 0]; }
function range(rnd, a, b) { return a + rnd() * (b - a); }

/* colour, in the two forms the file needs: css strings for the canvas
   textures, and THREE.Color for the materials */
function shadeHex(hex, f) {
  const v = parseInt(hex.slice(1), 16);
  let r = (v >> 16) & 255, g = (v >> 8) & 255, b = v & 255;
  if (f >= 0) { r += (255 - r) * f; g += (255 - g) * f; b += (255 - b) * f; }
  else { r *= 1 + f; g *= 1 + f; b *= 1 + f; }
  return "#" + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
}
function rgba(hex, a) {
  const v = parseInt(hex.slice(1), 16);
  return "rgba(" + ((v >> 16) & 255) + "," + ((v >> 8) & 255) + "," + (v & 255) + "," + a + ")";
}

/* =========================================================
   7. THE TEXTURE LIBRARY

   Every surface in the shop is painted here, at boot, into a canvas.
   There is not one flat single-colour material in the game — this is
   what stops a wall reading as a coloured rectangle, and it is cheap:
   nine 256px canvases, drawn once, uploaded once.

   Each painter takes a seeded rng so two walls of "the same" plaster
   are never actually the same wall.
   ========================================================= */
const TX = {};                       // name -> THREE.Texture
const texCache = {};

function canvas(size) {
  const c = document.createElement("canvas");
  c.width = c.height = size || 256;
  return c;
}

/* the grain pass every painter finishes with: fine speckle plus a few
   broad blotches, so a surface never reads as uniform even in the dark */
function grain(g, w, h, rnd, amount, blotch) {
  const n = (w * h) / 26;
  g.save();
  for (let i = 0; i < n; i++) {
    const v = rnd();
    g.fillStyle = v > 0.5 ? "rgba(255,255,255," + (amount * rnd()) + ")"
                          : "rgba(0,0,0," + (amount * 1.3 * rnd()) + ")";
    g.fillRect((rnd() * w) | 0, (rnd() * h) | 0, 1 + ((rnd() * 1.6) | 0), 1);
  }
  if (blotch !== 0) {
    for (let i = 0; i < 14; i++) {
      const x = rnd() * w, y = rnd() * h, r = range(rnd, w * 0.06, w * 0.24);
      const gr = g.createRadialGradient(x, y, 0, x, y, r);
      const dark = rnd() > 0.45;
      gr.addColorStop(0, dark ? "rgba(0,0,0,.09)" : "rgba(255,255,255,.055)");
      gr.addColorStop(1, "rgba(0,0,0,0)");
      g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
    }
  }
  g.restore();
}

/* --- planks, with grain that follows the board and knots in it --- */
function paintWood(g, S, rnd, base, opts) {
  opts = opts || {};
  const boards = opts.boards || 6;
  const bh = S / boards;
  for (let i = 0; i < boards; i++) {
    const tint = shadeHex(base, range(rnd, -0.13, 0.11));
    g.fillStyle = tint;
    g.fillRect(0, i * bh, S, bh);
    /* grain: long shallow arcs down the length of the board */
    for (let k = 0; k < 26; k++) {
      const y = i * bh + range(rnd, 1, bh - 1);
      g.strokeStyle = rgba(rnd() > 0.5 ? "#000000" : "#ffffff", range(rnd, 0.03, 0.10));
      g.lineWidth = range(rnd, 0.5, 1.5);
      g.beginPath();
      g.moveTo(0, y);
      for (let x = 0; x <= S; x += S / 8) g.lineTo(x, y + Math.sin((x / S) * 6 + k) * range(rnd, 0.4, 2.2));
      g.stroke();
    }
    /* a knot or two */
    if (rnd() > 0.55) {
      const kx = rnd() * S, ky = i * bh + bh * 0.5;
      for (let r = bh * 0.34; r > 0.6; r -= 1.4) {
        g.strokeStyle = rgba("#2a1a10", range(rnd, 0.08, 0.2));
        g.lineWidth = 1;
        g.beginPath(); g.ellipse(kx, ky, r, r * 0.55, range(rnd, -0.4, 0.4), 0, TAU); g.stroke();
      }
    }
    /* the shadowed seam between boards, and the lit edge under it */
    g.fillStyle = "rgba(0,0,0,.34)"; g.fillRect(0, i * bh, S, 1.4);
    g.fillStyle = "rgba(255,255,255,.07)"; g.fillRect(0, i * bh + 1.6, S, 1);
  }
  grain(g, S, S, rnd, 0.05);
}

/* --- lino tile: a grid, worn through at the corners --- */
function paintTile(g, S, rnd, a, b) {
  const n = 4, t = S / n;
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const base = (x + y) % 2 ? a : b;
    g.fillStyle = shadeHex(base, range(rnd, -0.09, 0.07));
    g.fillRect(x * t, y * t, t, t);
    /* the speckled fleck lino actually has */
    for (let i = 0; i < 90; i++) {
      g.fillStyle = rgba(rnd() > 0.5 ? "#ffffff" : "#000000", range(rnd, 0.03, 0.13));
      g.fillRect(x * t + rnd() * t, y * t + rnd() * t, 1 + ((rnd() * 2) | 0), 1);
    }
    /* worn patch, off centre */
    if (rnd() > 0.5) {
      const cx = x * t + range(rnd, t * 0.2, t * 0.8), cy = y * t + range(rnd, t * 0.2, t * 0.8);
      const gr = g.createRadialGradient(cx, cy, 0, cx, cy, t * 0.45);
      gr.addColorStop(0, "rgba(255,255,255,.10)"); gr.addColorStop(1, "rgba(0,0,0,0)");
      g.fillStyle = gr; g.beginPath(); g.arc(cx, cy, t * 0.45, 0, TAU); g.fill();
    }
  }
  /* grout */
  g.strokeStyle = "rgba(0,0,0,.42)"; g.lineWidth = 1.6;
  for (let i = 0; i <= n; i++) {
    g.beginPath(); g.moveTo(i * t, 0); g.lineTo(i * t, S); g.stroke();
    g.beginPath(); g.moveTo(0, i * t); g.lineTo(S, i * t); g.stroke();
  }
  /* scuff marks — long, shallow, going one way */
  for (let i = 0; i < 22; i++) {
    g.strokeStyle = rgba("#1a1410", range(rnd, 0.04, 0.14));
    g.lineWidth = range(rnd, 1, 3.5);
    const x = rnd() * S, y = rnd() * S, l = range(rnd, 8, 40), an = range(rnd, -0.5, 0.5);
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(an) * l, y + Math.sin(an) * l); g.stroke();
  }
  grain(g, S, S, rnd, 0.04);
}

/* --- painted plaster, with a dado rail's worth of wear --- */
function paintPlaster(g, S, rnd, base) {
  g.fillStyle = base; g.fillRect(0, 0, S, S);
  /* trowel sweep — kept faint and small, because at any size the eye
     reads a big soft ellipse on a wall as wood grain, not as plaster */
  for (let i = 0; i < 130; i++) {
    const x = rnd() * S, y = rnd() * S, r = range(rnd, 3, 11);
    g.fillStyle = rgba(rnd() > 0.5 ? "#ffffff" : "#000000", range(rnd, 0.008, 0.022));
    g.beginPath(); g.ellipse(x, y, r, r * range(rnd, 0.4, 0.9), range(rnd, 0, Math.PI), 0, TAU); g.fill();
  }
  /* the fine orange-peel stipple a roller leaves */
  for (let i = 0; i < 3000; i++) {
    g.fillStyle = rnd() > 0.5 ? "rgba(255,255,255,.035)" : "rgba(0,0,0,.045)";
    g.fillRect((rnd() * S) | 0, (rnd() * S) | 0, 1, 1);
  }
  /* chips where the paint has gone, showing something older underneath */
  for (let i = 0; i < 16; i++) {
    const x = rnd() * S, y = rnd() * S, r = range(rnd, 1.5, 5);
    g.fillStyle = rgba("#6b5744", range(rnd, 0.25, 0.6));
    g.beginPath();
    g.moveTo(x, y);
    for (let k = 0; k < 6; k++) {
      const an = (k / 6) * TAU;
      g.lineTo(x + Math.cos(an) * r * range(rnd, 0.5, 1.4), y + Math.sin(an) * r * range(rnd, 0.5, 1.4));
    }
    g.closePath(); g.fill();
  }
  /* hairline cracks */
  for (let i = 0; i < 3; i++) {
    g.strokeStyle = "rgba(0,0,0,.22)"; g.lineWidth = 0.8;
    let x = rnd() * S, y = rnd() * S;
    g.beginPath(); g.moveTo(x, y);
    for (let k = 0; k < 9; k++) { x += range(rnd, -14, 14); y += range(rnd, 4, 16); g.lineTo(x, y); }
    g.stroke();
  }
  grain(g, S, S, rnd, 0.045, 0);
}

/* --- the party room's paper: faded stripes and a small repeat motif --- */
function paintPaper(g, S, rnd, a, b, dot) {
  g.fillStyle = a; g.fillRect(0, 0, S, S);
  const w = S / 8;
  for (let i = 0; i < 8; i += 2) {
    g.fillStyle = shadeHex(b, range(rnd, -0.06, 0.06));
    g.fillRect(i * w, 0, w, S);
  }
  /* the motif: a little wind-up key, drawn not stamped */
  for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
    const cx = x * (S / 4) + S / 8 + range(rnd, -2, 2);
    const cy = y * (S / 4) + S / 8 + range(rnd, -2, 2);
    g.save(); g.translate(cx, cy); g.rotate(range(rnd, -0.3, 0.3));
    g.strokeStyle = rgba(dot, 0.5); g.lineWidth = 2;
    g.beginPath(); g.arc(-3, 0, 3.4, 0.6, TAU - 0.6); g.stroke();
    g.beginPath(); g.arc(3, 0, 3.4, Math.PI + 0.6, Math.PI - 0.6); g.stroke();
    g.beginPath(); g.moveTo(0, 0); g.lineTo(0, 9); g.stroke();
    g.restore();
  }
  /* damp, coming up from one edge */
  const gr = g.createLinearGradient(0, S, 0, S * 0.55);
  gr.addColorStop(0, "rgba(120,96,64,.30)"); gr.addColorStop(1, "rgba(120,96,64,0)");
  g.fillStyle = gr; g.fillRect(0, 0, S, S);
  /* a seam where two drops of paper meet */
  g.fillStyle = "rgba(0,0,0,.14)"; g.fillRect(S - 2, 0, 2, S);
  grain(g, S, S, rnd, 0.04);
}

/* --- brick, English bond, mortar sunk between --- */
function paintBrick(g, S, rnd, base) {
  g.fillStyle = "#4a4038"; g.fillRect(0, 0, S, S);
  const rows = 8, bh = S / rows, bw = S / 4;
  for (let r = 0; r < rows; r++) {
    const off = (r % 2) * (bw / 2);
    for (let c = -1; c < 5; c++) {
      const x = c * bw + off + 2, y = r * bh + 2, w = bw - 4, h = bh - 4;
      g.fillStyle = shadeHex(base, range(rnd, -0.2, 0.14));
      g.fillRect(x, y, w, h);
      g.fillStyle = "rgba(255,255,255,.06)"; g.fillRect(x, y, w, 1.4);
      g.fillStyle = "rgba(0,0,0,.20)"; g.fillRect(x, y + h - 1.6, w, 1.6);
      for (let i = 0; i < 24; i++) {
        g.fillStyle = rgba(rnd() > 0.5 ? "#ffffff" : "#000000", range(rnd, 0.02, 0.09));
        g.fillRect(x + rnd() * w, y + rnd() * h, 1, 1);
      }
    }
  }
  grain(g, S, S, rnd, 0.05);
}

/* --- galvanised duct panel: ribs, rivets, and old dust --- */
function paintMetal(g, S, rnd, base) {
  const gr = g.createLinearGradient(0, 0, S, S);
  gr.addColorStop(0, shadeHex(base, 0.10));
  gr.addColorStop(0.5, base);
  gr.addColorStop(1, shadeHex(base, -0.16));
  g.fillStyle = gr; g.fillRect(0, 0, S, S);
  /* the spangle galvanised steel has */
  for (let i = 0; i < 60; i++) {
    const x = rnd() * S, y = rnd() * S, r = range(rnd, 5, 20);
    g.fillStyle = rgba(rnd() > 0.5 ? "#ffffff" : "#404850", range(rnd, 0.02, 0.07));
    g.beginPath();
    g.moveTo(x, y - r);
    for (let k = 1; k < 6; k++) g.lineTo(x + Math.cos(k * 1.25) * r * range(rnd, 0.5, 1), y + Math.sin(k * 1.25) * r * range(rnd, 0.5, 1));
    g.closePath(); g.fill();
  }
  /* stiffening ribs */
  for (let i = 0; i < 4; i++) {
    const x = i * (S / 4) + S / 8;
    g.fillStyle = "rgba(0,0,0,.24)"; g.fillRect(x - 3, 0, 6, S);
    g.fillStyle = "rgba(255,255,255,.13)"; g.fillRect(x - 1, 0, 2, S);
  }
  /* rivets down the seams */
  for (let y = 6; y < S; y += 18) {
    for (const x of [4, S - 6]) {
      g.fillStyle = "rgba(255,255,255,.18)"; g.beginPath(); g.arc(x, y, 2.2, 0, TAU); g.fill();
      g.fillStyle = "rgba(0,0,0,.35)"; g.beginPath(); g.arc(x + 0.6, y + 0.8, 1.6, 0, TAU); g.fill();
    }
  }
  grain(g, S, S, rnd, 0.05);
}

/* --- carpet: loop pile, a border, and the tracks people wear in it --- */
function paintCarpet(g, S, rnd, base, fleck) {
  g.fillStyle = base; g.fillRect(0, 0, S, S);
  for (let i = 0; i < 5200; i++) {
    const c = rnd();
    g.fillStyle = c > 0.86 ? rgba(fleck, range(rnd, 0.3, 0.7))
               : c > 0.5  ? "rgba(255,255,255,.045)" : "rgba(0,0,0,.06)";
    g.fillRect((rnd() * S) | 0, (rnd() * S) | 0, 1, 1 + ((rnd() * 1.5) | 0));
  }
  grain(g, S, S, rnd, 0.03);
}

/* --- velvet: vertical folds, deep in the trough, bright on the ridge --- */
function paintVelvet(g, S, rnd, base) {
  g.fillStyle = base; g.fillRect(0, 0, S, S);
  const folds = 7;
  for (let i = 0; i < folds; i++) {
    const x = (i / folds) * S + range(rnd, -4, 4), w = S / folds;
    const gr = g.createLinearGradient(x, 0, x + w, 0);
    gr.addColorStop(0, "rgba(0,0,0,.45)");
    gr.addColorStop(0.42, "rgba(255,255,255,.14)");
    gr.addColorStop(0.6, "rgba(255,255,255,.05)");
    gr.addColorStop(1, "rgba(0,0,0,.4)");
    g.fillStyle = gr; g.fillRect(x, 0, w, S);
  }
  for (let i = 0; i < 2400; i++) {
    g.fillStyle = rnd() > 0.5 ? "rgba(255,255,255,.03)" : "rgba(0,0,0,.05)";
    g.fillRect((rnd() * S) | 0, (rnd() * S) | 0, 1, 1);
  }
  grain(g, S, S, rnd, 0.03, 0);
}

/* --- painted metal for cabinets and lockers: flat coat, chipped --- */
function paintEnamel(g, S, rnd, base) {
  const gr = g.createLinearGradient(0, 0, 0, S);
  gr.addColorStop(0, shadeHex(base, 0.13));
  gr.addColorStop(0.55, base);
  gr.addColorStop(1, shadeHex(base, -0.18));
  g.fillStyle = gr; g.fillRect(0, 0, S, S);
  for (let i = 0; i < 30; i++) {
    const x = rnd() * S, y = rnd() * S, r = range(rnd, 1, 4);
    g.fillStyle = rgba("#7d6a55", range(rnd, 0.3, 0.7));
    g.beginPath(); g.ellipse(x, y, r, r * range(rnd, 0.4, 1), rnd() * Math.PI, 0, TAU); g.fill();
    g.fillStyle = "rgba(255,255,255,.16)";
    g.beginPath(); g.ellipse(x - 0.6, y - 0.6, r * 0.5, r * 0.3, 0, 0, TAU); g.fill();
  }
  for (let i = 0; i < 10; i++) {
    g.strokeStyle = rgba("#ffffff", range(rnd, 0.03, 0.09));
    g.lineWidth = range(rnd, 0.6, 1.6);
    const y = rnd() * S; g.beginPath(); g.moveTo(0, y); g.lineTo(S, y + range(rnd, -3, 3)); g.stroke();
  }
  grain(g, S, S, rnd, 0.04);
}

/* --- concrete: poured, stained, trowel-swept --- */
function paintConcrete(g, S, rnd, base) {
  g.fillStyle = base; g.fillRect(0, 0, S, S);
  for (let i = 0; i < 150; i++) {
    const x = rnd() * S, y = rnd() * S, r = range(rnd, 8, 40);
    g.fillStyle = rnd() > 0.5 ? "rgba(255,255,255,.025)" : "rgba(0,0,0,.04)";
    g.beginPath(); g.ellipse(x, y, r, r * range(rnd, 0.2, 0.6), range(rnd, 0, Math.PI), 0, TAU); g.fill();
  }
  for (let i = 0; i < 400; i++) {
    g.fillStyle = rgba("#8b8378", range(rnd, 0.1, 0.4));
    g.beginPath(); g.arc(rnd() * S, rnd() * S, range(rnd, 0.5, 1.8), 0, TAU); g.fill();
  }
  /* expansion joint */
  g.fillStyle = "rgba(0,0,0,.3)"; g.fillRect(0, S * 0.5 - 1, S, 2);
  grain(g, S, S, rnd, 0.05);
}

/* --- what is outside the office window ----------------------------
   Painted rather than modelled: the alley behind the shop, a wall
   opposite with two windows still on in it, and a moon that is mostly
   cloud. It is the only cold light in the room and it wants to read as
   somewhere else, not as a blue rectangle. */
function paintNight(g, S, rnd) {
  const sky = g.createLinearGradient(0, 0, 0, S);
  sky.addColorStop(0, "#2c405f");
  sky.addColorStop(0.45, "#38507a");
  sky.addColorStop(1, "#1a2740");
  g.fillStyle = sky; g.fillRect(0, 0, S, S);
  /* the moon, behind cloud */
  const mx = S * 0.68, my = S * 0.22;
  const mg = g.createRadialGradient(mx, my, 0, mx, my, S * 0.3);
  mg.addColorStop(0, "rgba(206,220,246,.75)");
  mg.addColorStop(0.16, "rgba(150,170,206,.28)");
  mg.addColorStop(1, "rgba(120,140,180,0)");
  g.fillStyle = mg; g.fillRect(0, 0, S, S);
  g.fillStyle = "rgba(238,244,255,.94)";
  g.beginPath(); g.arc(mx, my, S * 0.06, 0, TAU); g.fill();
  for (let i = 0; i < 5; i++) {
    g.fillStyle = "rgba(22,32,52,.5)";
    g.beginPath();
    g.ellipse(range(rnd, 0, S), range(rnd, S * 0.05, S * 0.4), range(rnd, S * 0.15, S * 0.4), range(rnd, S * 0.03, S * 0.07), 0, 0, TAU);
    g.fill();
  }
  /* the wall opposite, with a gutter and two windows still lit */
  g.fillStyle = "#131c2a";
  g.fillRect(0, S * 0.52, S, S * 0.48);
  g.fillStyle = "#182234";
  g.fillRect(0, S * 0.5, S, S * 0.04);
  for (const w of [[0.14, 0.6, "#c8a45c"], [0.62, 0.66, "#5e7a9a"]]) {
    g.fillStyle = w[2];
    g.globalAlpha = 0.55;
    g.fillRect(S * w[0], S * w[1], S * 0.11, S * 0.14);
    g.globalAlpha = 1;
    g.fillStyle = "rgba(10,14,20,.9)";
    g.fillRect(S * w[0] + S * 0.052, S * w[1], S * 0.006, S * 0.14);
    g.fillRect(S * w[0], S * w[1] + S * 0.066, S * 0.11, S * 0.006);
  }
  const dp = new Array(6).fill(0).map(() => range(rnd, 0.05, 0.95));
  dp.forEach((x) => { g.fillStyle = "rgba(6,9,14,.8)"; g.fillRect(S * x, S * 0.52, S * 0.02, S * 0.48); });
  /* rain on the glass */
  for (let i = 0; i < 90; i++) {
    g.strokeStyle = "rgba(190,206,232," + range(rnd, 0.04, 0.13) + ")";
    g.lineWidth = range(rnd, 0.6, 1.4);
    const x = rnd() * S, y = rnd() * S, l = range(rnd, 4, 18);
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + l * 0.18, y + l); g.stroke();
  }
  grain(g, S, S, rnd, 0.03, 0);
}

/* --- what the desk monitor is showing when it is not showing a room --
   Painted, not a flat fill: a phosphor wash, the shop's own mark, the
   scan lines and the roll bar you get out of a set this old. */
function paintCRT(g, S, rnd) {
  const bg = g.createRadialGradient(S / 2, S / 2, S * 0.1, S / 2, S / 2, S * 0.72);
  bg.addColorStop(0, "#1d4a55");
  bg.addColorStop(0.6, "#12333d");
  bg.addColorStop(1, "#081b22");
  g.fillStyle = bg; g.fillRect(0, 0, S, S);
  g.fillStyle = "#7fe4d0";
  g.font = "bold " + (S * 0.115) + "px ui-monospace, monospace";
  g.textAlign = "center";
  g.fillText("WICK & COGS", S / 2, S * 0.38);
  g.font = (S * 0.062) + "px ui-monospace, monospace";
  g.fillStyle = "#4fc3ae";
  g.fillText("NIGHT SECURITY", S / 2, S * 0.5);
  g.fillText("— STANDBY —", S / 2, S * 0.62);
  /* a frame drawn in the phosphor, corners only */
  g.strokeStyle = "rgba(127,228,208,.5)"; g.lineWidth = S * 0.012;
  const m = S * 0.1, c = S * 0.09;
  [[m, m, 1, 1], [S - m, m, -1, 1], [m, S - m, 1, -1], [S - m, S - m, -1, -1]].forEach(([x, y, dx, dy]) => {
    g.beginPath(); g.moveTo(x + dx * c, y); g.lineTo(x, y); g.lineTo(x, y + dy * c); g.stroke();
  });
  /* scan lines and the roll bar */
  for (let y = 0; y < S; y += 3) {
    g.fillStyle = "rgba(0,0,0,.26)";
    g.fillRect(0, y, S, 1.4);
  }
  const rb = g.createLinearGradient(0, S * 0.7, 0, S * 0.86);
  rb.addColorStop(0, "rgba(255,255,255,0)");
  rb.addColorStop(0.5, "rgba(190,255,240,.08)");
  rb.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = rb; g.fillRect(0, S * 0.7, S, S * 0.16);
  grain(g, S, S, rnd, 0.05, 0);
}

/* the contact shadow every prop stands on. One texture, shared. */
function paintBlob(g, S) {
  const gr = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  gr.addColorStop(0,    "rgba(0,0,0,.95)");
  gr.addColorStop(0.42, "rgba(0,0,0,.62)");
  gr.addColorStop(0.72, "rgba(0,0,0,.22)");
  gr.addColorStop(1,    "rgba(0,0,0,0)");
  g.fillStyle = gr; g.fillRect(0, 0, S, S);
}

/* build one, cache it */
function tex(name, painter, size, repeat) {
  if (texCache[name]) return texCache[name];
  const S = size || 256;
  const c = canvas(S);
  const g = c.getContext("2d");
  painter(g, S, rngFor(name));
  const t = new T.CanvasTexture(c);
  t.colorSpace = T.SRGBColorSpace;
  t.wrapS = t.wrapT = T.RepeatWrapping;
  t.anisotropy = 4;
  if (repeat) t.repeat.set(repeat[0], repeat[1]);
  texCache[name] = t;
  return t;
}

function buildTextures() {
  TX.floorWood   = tex("floorWood",   (g,S,r) => paintWood(g,S,r,"#6b4a30",{boards:5}));
  TX.floorStage  = tex("floorStage",  (g,S,r) => paintWood(g,S,r,"#4e3524",{boards:7}));
  TX.floorTile   = tex("floorTile",   (g,S,r) => paintTile(g,S,r,"#8f8577","#6d6458"));
  TX.floorCheck  = tex("floorCheck",  (g,S,r) => paintTile(g,S,r,"#b8a48c","#4a3f39"));
  TX.floorCarpet = tex("floorCarpet", (g,S,r) => paintCarpet(g,S,r,"#3a2b3d","#c4657f"));
  TX.floorOffice = tex("floorOffice", (g,S,r) => paintCarpet(g,S,r,"#33302c","#7d6a4a"));
  TX.floorCon    = tex("floorCon",    (g,S,r) => paintConcrete(g,S,r,"#5a564e"));

  TX.wallCream   = tex("wallCream",   (g,S,r) => paintPlaster(g,S,r,"#8a7f6c"));
  TX.wallGreen   = tex("wallGreen",   (g,S,r) => paintPlaster(g,S,r,"#5b6a5c"));
  TX.wallBlue    = tex("wallBlue",    (g,S,r) => paintPlaster(g,S,r,"#4f5b6b"));
  TX.wallOffice  = tex("wallOffice",  (g,S,r) => paintPlaster(g,S,r,"#6d6152"));
  TX.wallPaper   = tex("wallPaper",   (g,S,r) => paintPaper(g,S,r,"#7d5f52","#8f6f5c","#e0c08a"));
  TX.brick       = tex("brick",       (g,S,r) => paintBrick(g,S,r,"#7a4c3c"));
  TX.metal       = tex("metal",       (g,S,r) => paintMetal(g,S,r,"#6f7780"));
  TX.velvet      = tex("velvet",      (g,S,r) => paintVelvet(g,S,r,"#5e1f2c"));
  TX.enamelRed   = tex("enamelRed",   (g,S,r) => paintEnamel(g,S,r,"#8c3f3a"));
  TX.enamelBlue  = tex("enamelBlue",  (g,S,r) => paintEnamel(g,S,r,"#33506b"));
  TX.enamelGreen = tex("enamelGreen", (g,S,r) => paintEnamel(g,S,r,"#3d6355"));
  TX.enamelCream = tex("enamelCream", (g,S,r) => paintEnamel(g,S,r,"#a89876"));
  TX.woodShelf   = tex("woodShelf",   (g,S,r) => paintWood(g,S,r,"#7d5b3c",{boards:3}));
  TX.woodDark    = tex("woodDark",    (g,S,r) => paintWood(g,S,r,"#4a3524",{boards:4}));
  TX.crt         = tex("crt", paintCRT, 256);
  TX.crt.wrapS = TX.crt.wrapT = T.ClampToEdgeWrapping;
  TX.night       = tex("night", paintNight, 256);
  TX.night.wrapS = TX.night.wrapT = T.ClampToEdgeWrapping;
  TX.blob        = tex("blob", paintBlob, 128);
  TX.blob.wrapS = TX.blob.wrapT = T.ClampToEdgeWrapping;
}

/* =========================================================
   8. MATERIALS

   MeshLambertMaterial throughout. It is per-fragment in r180, so a
   six-triangle box still takes a soft gradient across its face under a
   point light, which is the whole look — and it costs a fraction of
   what a standard material would on a phone.

   Repeats differ per surface, so the texture is cloned (the image is
   shared, only the wrap settings are not) and the result cached, so a
   room with forty props still issues a handful of material states.
   ========================================================= */
const matCache = {};

function mat(texName, rx, ry, tint, opts) {
  opts = opts || {};
  const key = texName + "|" + rx + "|" + ry + "|" + (tint || "") + "|" + JSON.stringify(opts);
  if (matCache[key]) return matCache[key];
  const src = TX[texName];
  let map = null;
  if (src) {
    map = src.clone();
    map.needsUpdate = true;
    map.wrapS = map.wrapT = T.RepeatWrapping;
    map.repeat.set(rx || 1, ry || 1);
    if (opts.offset) map.offset.set(opts.offset[0], opts.offset[1]);
    if (opts.rot) { map.center.set(0.5, 0.5); map.rotation = opts.rot; }
  }
  const m = new T.MeshLambertMaterial({
    map: map,
    color: new T.Color(tint || "#ffffff"),
    side: opts.side || T.FrontSide,
    transparent: !!opts.transparent,
    opacity: opts.opacity === undefined ? 1 : opts.opacity,
    emissive: new T.Color(opts.emissive || "#000000"),
    emissiveIntensity: opts.emissiveIntensity === undefined ? 1 : opts.emissiveIntensity,
  });
  matCache[key] = m;
  return m;
}

/* plain colour, still lit — for the small painted parts of a toy where
   a 256px texture would be invisible anyway */
function flat(hex, opts) {
  opts = opts || {};
  const key = "flat|" + hex + "|" + JSON.stringify(opts);
  if (matCache[key]) return matCache[key];
  const m = new T.MeshLambertMaterial({
    color: new T.Color(hex),
    emissive: new T.Color(opts.emissive || "#000000"),
    emissiveIntensity: opts.emissiveIntensity === undefined ? 1 : opts.emissiveIntensity,
    transparent: !!opts.transparent,
    opacity: opts.opacity === undefined ? 1 : opts.opacity,
    side: opts.side || T.FrontSide,
  });
  matCache[key] = m;
  return m;
}

/* a light source's own body — unlit, so a bulb reads as a bulb even
   when nothing else in the room is lit */
function glow(hex, opacity) {
  const key = "glow|" + hex + "|" + opacity;
  if (matCache[key]) return matCache[key];
  const m = new T.MeshBasicMaterial({
    color: new T.Color(hex),
    transparent: opacity !== undefined,
    opacity: opacity === undefined ? 1 : opacity,
    fog: true,
  });
  matCache[key] = m;
  return m;
}

/* =========================================================
   9. SOLIDS, AND THE RULE ABOUT THEM

   `slab` is the only box builder in the file. It exists so that the
   answer to "is this thing flat?" is always no: a slab has six faces
   and a minimum thickness, and asking for one thinner than 1.2cm gets
   you 1.2cm. Cutouts cannot be built by accident.
   ========================================================= */
const MIN_T = 0.012;

function slab(w, h, d, material, opts) {
  opts = opts || {};
  const g = new T.BoxGeometry(
    Math.max(w, MIN_T), Math.max(h, MIN_T), Math.max(d, MIN_T),
    opts.sw || 1, opts.sh || 1, opts.sd || 1
  );
  const m = new T.Mesh(g, material);
  m.matrixAutoUpdate = false;      // static geometry: never re-derived
  return m;
}

/* set a local transform once and bake it. Everything in a room goes
   through here or through `place`, and after boot nothing writes to a
   prop's matrix again. */
function at(mesh, x, y, z, rx, ry, rz, sx, sy, sz) {
  mesh.position.set(x || 0, y || 0, z || 0);
  mesh.rotation.set(rx || 0, ry || 0, rz || 0);
  if (sx !== undefined) mesh.scale.set(sx, sy === undefined ? sx : sy, sz === undefined ? sx : sz);
  mesh.updateMatrix();
  return mesh;
}

/* a group of parts, assembled in its own local space */
function part(x, y, z, ry) {
  const g = new T.Group();
  g.position.set(x || 0, y || 0, z || 0);
  if (ry) g.rotation.y = ry;
  return g;
}

/* --- the contact shadow -------------------------------------------
   Rule 2. A prop enters a room through `place`, and `place` lays a
   soft pool under it sized to its own footprint. Objects that touch
   the floor get a tight dark pool; objects on a shelf or a wall get a
   smaller, fainter one on whatever they sit on. Nothing floats.
   ------------------------------------------------------------------ */
const _box = new T.Box3();
const _sz  = new T.Vector3();
const _ctr = new T.Vector3();

function contactShadow(obj, opts) {
  opts = opts || {};
  _box.setFromObject(obj);
  if (!isFinite(_box.min.x)) return null;
  _box.getSize(_sz); _box.getCenter(_ctr);
  const foot = Math.max(_sz.x, _sz.z);
  const w = (_sz.x + foot * 0.28) * (opts.spread || 1);
  const d = (_sz.z + foot * 0.28) * (opts.spread || 1);
  /* the taller a thing is above its own base, the softer and weaker its
     contact pool — the same reason a chair leg is darker than a lampshade */
  const lift = clamp(1 - (_sz.y / (foot * 5 + 0.4)) * 0.5, 0.34, 1);
  const m = new T.Mesh(
    new T.PlaneGeometry(w, d),                 // a plane on purpose: it is a shadow
    new T.MeshBasicMaterial({
      map: TX.blob, transparent: true, depthWrite: false,
      opacity: (opts.opacity === undefined ? 0.62 : opts.opacity) * lift,
      color: new T.Color(opts.tint || "#000000"),
      blending: T.NormalBlending, fog: false,
    })
  );
  m.rotation.x = -Math.PI / 2;
  m.position.set(_ctr.x, (opts.y === undefined ? _box.min.y : opts.y) + 0.006, _ctr.z);
  m.renderOrder = -1;
  m.updateMatrix();
  m.matrixAutoUpdate = false;
  return m;
}

/* --- the only way a prop gets into a room -------------------------
   Rule 3 lives here too: the transform is written once, `updateMatrix`
   is called once, and `matrixAutoUpdate` goes off. The frame loop has
   no handle on any of it.
   ------------------------------------------------------------------ */
function place(room, obj, x, y, z, opts) {
  opts = opts || {};
  /* a caller may hand us an already-frozen subtree — re-arm it, or the
     transform we are about to write would never reach its matrix. This
     cost an hour: every prop in the office stacked up at the origin,
     one of them across the camera lens. */
  obj.matrixAutoUpdate = true;
  obj.matrixWorldAutoUpdate = true;
  obj.position.set(x, y || 0, z);
  if (opts.ry !== undefined) obj.rotation.y = opts.ry;
  if (opts.rx !== undefined) obj.rotation.x = opts.rx;
  if (opts.rz !== undefined) obj.rotation.z = opts.rz;
  if (opts.s !== undefined) obj.scale.setScalar(opts.s);
  obj.updateMatrixWorld(true);
  if (opts.shadow !== false) {
    const s = contactShadow(obj, {
      y: opts.shadowY !== undefined ? opts.shadowY : (y || 0),
      opacity: opts.shadowOpacity,
      spread: opts.shadowSpread,
    });
    if (s) { room.add(s); freeze(s); }
  }
  room.add(obj);
  freeze(obj);        // rule 3: composed once, then nothing may touch it
  return obj;
}

/* box + transform in one call, since almost every part wants both */
function sb(w, h, d, material, x, y, z, ry, rx, rz) {
  return at(slab(w, h, d, material), x, y, z, rx, ry, rz);
}

/* freeze a finished static subtree: every matrix composed once, then
   both auto-update flags off, so the frame loop skips the entire branch
   rather than walking it. This is rule 3 with teeth — a static prop
   cannot drift because nothing recomputes it, ever. */
function freeze(obj) {
  /* re-arm first: an object may already have been frozen once (built,
     then placed), and updateMatrixWorld will silently skip a node whose
     matrixWorldAutoUpdate is already off. Freezing before parenting and
     then never re-deriving is exactly how the racer's props ended up in
     the wrong room. */
  obj.traverse((o) => { o.matrixWorldAutoUpdate = true; });
  obj.updateMatrixWorld(true);
  obj.traverse((o) => { o.matrixAutoUpdate = false; o.matrixWorldAutoUpdate = false; });
  return obj;
}

/* =========================================================
   10. THE PROP KIT

   Rule 4: nothing in here returns the same object twice. Every builder
   takes a variant index and a seeded rng, and the callers vary both.
   Every builder returns a solid — uprights, boards, edges, feet — with
   faces the light can separate.
   ========================================================= */
const KIT = {};

/* --- shelving, four builds ---------------------------------------- */
KIT.shelf = function (v, rnd, opts) {
  opts = opts || {};
  const g = new T.Group();
  const woods = ["woodShelf", "woodDark", "woodShelf", "enamelGreen"];
  const wm = mat(woods[v % 4], 1.2, 0.5, ["#c9a678", "#9a8060", "#b39068", "#c8d0c4"][v % 4]);
  const W = opts.w || [1.5, 1.15, 1.9, 1.35][v % 4];
  const H = opts.h || [1.9, 2.2, 1.55, 2.0][v % 4];
  const D = opts.d || [0.42, 0.34, 0.5, 0.38][v % 4];
  const boards = [4, 5, 3, 4][v % 4];
  const post = 0.07;

  /* uprights — four, so it reads as a frame from any angle */
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    g.add(sb(post, H, post, wm, sx * (W / 2 - post / 2), H / 2, sz * (D / 2 - post / 2)));
  }
  /* boards, each with a lipped front edge so the shelf has a profile */
  for (let i = 0; i < boards; i++) {
    const y = 0.09 + (i / (boards - 1)) * (H - 0.24);
    g.add(sb(W - 0.03, 0.045, D - 0.02, wm, 0, y, 0));
    g.add(sb(W - 0.03, 0.075, 0.028, wm, 0, y - 0.03, D / 2 - 0.014));
  }
  /* a back — slatted on two of the four builds, panelled on the others */
  if (v % 2 === 0) {
    for (let i = 0; i < 5; i++) {
      g.add(sb(W - 0.14, H / 6.5, 0.02, wm, 0, 0.2 + i * (H / 5.3), -D / 2 + 0.02));
    }
  } else {
    g.add(sb(W - 0.06, H - 0.2, 0.022, wm, 0, H / 2, -D / 2 + 0.02));
  }
  /* kick plate and feet */
  g.add(sb(W - 0.04, 0.09, 0.03, wm, 0, 0.045, D / 2 - 0.05));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    g.add(sb(post * 1.3, 0.03, post * 1.3, flat("#2e241c"), sx * (W / 2 - post / 2), 0.015, sz * (D / 2 - post / 2)));
  }
  /* what is on it */
  if (opts.stock !== false) {
    for (let i = 0; i < boards - 1; i++) {
      const y = 0.115 + (i / (boards - 1)) * (H - 0.24);
      const n = 2 + ((rnd() * 3) | 0);
      for (let k = 0; k < n; k++) {
        const t = KIT.toy((rnd() * 6) | 0, rnd);
        const x = -W / 2 + 0.16 + (k + range(rnd, -0.18, 0.18)) * ((W - 0.32) / Math.max(1, n - 1 || 1));
        at(t, clamp(x, -W / 2 + 0.14, W / 2 - 0.14), y, range(rnd, -0.05, 0.05), 0, range(rnd, -0.6, 0.6), 0);
        /* the little pool a toy casts on the board it stands on */
        const s = contactShadow(t, { y: y, opacity: 0.4, spread: 0.8 });
        if (s) g.add(s);
        g.add(t);
      }
    }
  }
  return g;
};

/* --- arcade cabinets, four builds ---------------------------------- */
KIT.cabinet = function (v, rnd) {
  const g = new T.Group();
  const skins = ["enamelRed", "enamelBlue", "enamelGreen", "enamelCream"];
  const tints = ["#c98a72", "#7e9ec4", "#84b39c", "#cbb98c"];
  const bm = mat(skins[v % 4], 0.8, 1.4, tints[v % 4]);
  const W = [0.72, 0.66, 0.8, 0.62][v % 4];
  const H = [1.78, 1.9, 1.66, 1.84][v % 4];
  const D = 0.78;

  /* body: two side panels and a back, so the cabinet is hollow the way
     a real one is, and the light gets in between them */
  for (const sx of [-1, 1]) g.add(sb(0.06, H, D, bm, sx * (W / 2 - 0.03), H / 2, 0));
  g.add(sb(W - 0.12, H, 0.06, bm, 0, H / 2, -D / 2 + 0.03));
  g.add(sb(W - 0.12, 0.72, 0.06, bm, 0, 0.36, D / 2 - 0.03));       // coin door front
  g.add(sb(W - 0.12, 0.06, D - 0.12, bm, 0, H - 0.03, 0));           // top
  /* the control deck, sloped */
  const deck = sb(W - 0.1, 0.07, 0.34, mat("enamelCream", 1, 1, "#8e8068"), 0, 1.02, D / 2 - 0.15, 0, -0.30);
  g.add(deck);
  g.add(sb(W - 0.1, 0.26, 0.06, bm, 0, 0.9, D / 2 - 0.02));          // deck front lip
  /* joystick and two buttons — small, but they are what makes it a cabinet */
  const stick = part(-W * 0.22, 1.09, D / 2 - 0.18);
  stick.add(sb(0.055, 0.13, 0.055, flat("#2b2b30"), 0, 0.06, 0));
  const ball = new T.Mesh(new T.SphereGeometry(0.042, 10, 8), flat(["#d0435c", "#e0b13c", "#3f8fd0"][v % 3]));
  g.add(at(ball, -W * 0.22, 1.2, D / 2 - 0.18));
  g.add(stick);
  for (let i = 0; i < 2; i++) {
    const b = new T.Mesh(new T.CylinderGeometry(0.032, 0.032, 0.022, 10), flat(["#d0435c", "#e0b13c"][i]));
    g.add(at(b, W * 0.1 + i * 0.11, 1.075, D / 2 - 0.2, -0.30));
  }
  /* the screen: recessed behind a bezel, and it is the thing that lights
     the room, so it is a glow not a lit surface */
  g.add(sb(W - 0.16, 0.62, 0.03, flat("#15161c"), 0, 1.42, D / 2 - 0.16));
  const scr = sb(W - 0.26, 0.5, 0.012, glow(["#2b4a6e", "#3d2b52", "#1f4a44", "#4a3520"][v % 4]), 0, 1.42, D / 2 - 0.145);
  scr.userData.screen = true;
  g.add(scr);
  g.add(sb(W - 0.12, 0.1, 0.09, bm, 0, 1.76, D / 2 - 0.14));         // bezel hood
  /* marquee, lit from behind */
  g.add(sb(W - 0.1, 0.26, 0.07, glow(["#e8a04a", "#c85c8a", "#6ec0a0", "#e0c060"][v % 4], 0.85), 0, H - 0.2, D / 2 - 0.06));
  g.add(sb(W - 0.06, 0.05, 0.1, bm, 0, H - 0.05, D / 2 - 0.06));
  /* feet, so it stands on something */
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    g.add(sb(0.07, 0.045, 0.07, flat("#1e1e22"), sx * (W / 2 - 0.06), 0.022, sz * (D / 2 - 0.08)));
  }
  return g;
};

/* --- seating, three builds ----------------------------------------- */
KIT.chair = function (v, rnd) {
  const g = new T.Group();
  if (v % 3 === 0) {
    /* a party chair: moulded seat, tube legs */
    const seatM = flat(pick(rnd, ["#c96a70", "#5f9ec4", "#78b08a", "#d2a24c"]));
    g.add(sb(0.4, 0.05, 0.38, seatM, 0, 0.44, 0));
    g.add(sb(0.4, 0.42, 0.05, seatM, 0, 0.66, -0.17, 0, -0.12));
    const legM = flat("#8a8f96");
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      g.add(sb(0.026, 0.44, 0.026, legM, sx * 0.16, 0.22, sz * 0.15, 0, 0, sx * 0.04));
    }
    g.add(sb(0.34, 0.02, 0.02, legM, 0, 0.14, 0.15));
  } else if (v % 3 === 1) {
    /* a workshop stool */
    const wm = mat("woodDark", 1, 1, "#9a7a58");
    const top = new T.Mesh(new T.CylinderGeometry(0.19, 0.2, 0.055, 14), wm);
    g.add(at(top, 0, 0.62, 0));
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * TAU + 0.4;
      const leg = new T.Mesh(new T.CylinderGeometry(0.018, 0.026, 0.63, 8), wm);
      g.add(at(leg, Math.cos(a) * 0.13, 0.315, Math.sin(a) * 0.13, 0, 0, -Math.cos(a) * 0.12));
      const ring = new T.Mesh(new T.TorusGeometry(0.15, 0.012, 6, 16), wm);
      if (i === 0) g.add(at(ring, 0, 0.22, 0, Math.PI / 2));
    }
  } else {
    /* the guard's own chair: castors, a worn cushion, a bent back */
    const cm = mat("enamelBlue", 1, 1, "#5a6a7c");
    g.add(sb(0.46, 0.09, 0.44, cm, 0, 0.47, 0));
    g.add(sb(0.42, 0.5, 0.08, cm, 0, 0.76, -0.2, 0, -0.16));
    const col = new T.Mesh(new T.CylinderGeometry(0.035, 0.045, 0.42, 10), flat("#3a3d42"));
    g.add(at(col, 0, 0.22, 0));
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * TAU;
      g.add(sb(0.05, 0.03, 0.24, flat("#33363b"), Math.cos(a) * 0.11, 0.06, Math.sin(a) * 0.11, -a));
      const w = new T.Mesh(new T.CylinderGeometry(0.035, 0.035, 0.022, 8), flat("#22242a"));
      g.add(at(w, Math.cos(a) * 0.22, 0.035, Math.sin(a) * 0.22, 0, 0, Math.PI / 2));
    }
  }
  return g;
};

/* --- crates and boxes, three builds -------------------------------- */
KIT.crate = function (v, rnd) {
  const g = new T.Group();
  if (v % 3 === 2) {
    /* a cardboard carton, flaps open */
    const cm = mat("woodShelf", 1, 1, "#b09274");
    const W = range(rnd, 0.34, 0.48), H = range(rnd, 0.26, 0.4), D = range(rnd, 0.3, 0.42);
    for (const sx of [-1, 1]) g.add(sb(0.014, H, D, cm, sx * W / 2, H / 2, 0));
    for (const sz of [-1, 1]) g.add(sb(W, H, 0.014, cm, 0, H / 2, sz * D / 2));
    g.add(sb(W, 0.014, D, cm, 0, 0.007, 0));
    g.add(sb(W, 0.012, D * 0.44, cm, 0, H + 0.05, -D * 0.28, 0, -0.5));
    g.add(sb(W, 0.012, D * 0.44, cm, 0, H + 0.05, D * 0.28, 0, 0.5));
    return g;
  }
  /* a slatted wooden crate with corner posts */
  const wm = mat(v % 3 === 0 ? "woodShelf" : "woodDark", 1, 1, v % 3 === 0 ? "#c0a078" : "#8a6a4a");
  const W = range(rnd, 0.42, 0.6), H = range(rnd, 0.3, 0.46), D = range(rnd, 0.4, 0.54);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    g.add(sb(0.05, H, 0.05, wm, sx * (W / 2 - 0.025), H / 2, sz * (D / 2 - 0.025)));
  }
  const slats = 3;
  for (let i = 0; i < slats; i++) {
    const y = 0.05 + i * ((H - 0.1) / (slats - 1));
    for (const sz of [-1, 1]) g.add(sb(W - 0.02, 0.07, 0.018, wm, 0, y, sz * (D / 2 - 0.01)));
    for (const sx of [-1, 1]) g.add(sb(0.018, 0.07, D - 0.02, wm, sx * (W / 2 - 0.01), y, 0));
  }
  g.add(sb(W - 0.04, 0.02, D - 0.04, wm, 0, H, 0));
  g.add(sb(W - 0.04, 0.02, D - 0.04, wm, 0, 0.01, 0));
  return g;
};

/* --- the small things on shelves, six builds ----------------------- */
KIT.toy = function (v, rnd) {
  const g = new T.Group();
  const s = range(rnd, 0.88, 1.15);
  if (v === 0) {                                  /* a stacking-ring tower */
    const cols = ["#c8534e", "#e0a83c", "#4d90c0", "#6fb07a"];
    const base = new T.Mesh(new T.CylinderGeometry(0.075, 0.085, 0.016, 12), flat("#8a6a4a"));
    g.add(at(base, 0, 0.008, 0));
    for (let i = 0; i < 4; i++) {
      const r = 0.07 - i * 0.013;
      const ring = new T.Mesh(new T.TorusGeometry(r, 0.019, 6, 14), flat(cols[i]));
      g.add(at(ring, 0, 0.032 + i * 0.036, 0, Math.PI / 2));
    }
    const pin = new T.Mesh(new T.CylinderGeometry(0.008, 0.01, 0.19, 8), flat("#c4a27a"));
    g.add(at(pin, 0, 0.095, 0));
  } else if (v === 1) {                           /* a tin drum */
    const body = new T.Mesh(new T.CylinderGeometry(0.075, 0.075, 0.085, 14), mat("enamelRed", 1, 1, "#c46a5c"));
    g.add(at(body, 0, 0.045, 0));
    for (const y of [0.005, 0.086]) {
      const skin = new T.Mesh(new T.CylinderGeometry(0.078, 0.078, 0.006, 14), flat("#e6dcc4"));
      g.add(at(skin, 0, y + 0.002, 0));
    }
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU;
      g.add(sb(0.008, 0.09, 0.008, flat("#d8c070"), Math.cos(a) * 0.076, 0.045, Math.sin(a) * 0.076, 0, 0, 0.28 * (i % 2 ? 1 : -1)));
    }
  } else if (v === 2) {                           /* a blocky bear */
    const fur = flat(pick(rnd, ["#a8794e", "#8a6440", "#c0a074"]));
    g.add(sb(0.09, 0.1, 0.07, fur, 0, 0.06, 0));
    g.add(sb(0.075, 0.07, 0.065, fur, 0, 0.145, 0.005));
    for (const sx of [-1, 1]) {
      const e = new T.Mesh(new T.SphereGeometry(0.021, 8, 6), fur);
      g.add(at(e, sx * 0.033, 0.185, 0));
      g.add(sb(0.028, 0.075, 0.028, fur, sx * 0.06, 0.075, 0, 0, 0, sx * 0.3));
      g.add(sb(0.032, 0.032, 0.05, fur, sx * 0.025, 0.016, 0.01));
    }
    const sn = new T.Mesh(new T.SphereGeometry(0.018, 8, 6), flat("#e0cfb4"));
    g.add(at(sn, 0, 0.135, 0.04));
    for (const sx of [-1, 1]) {
      const ey = new T.Mesh(new T.SphereGeometry(0.007, 6, 5), flat("#171310"));
      g.add(at(ey, sx * 0.021, 0.158, 0.031));
    }
  } else if (v === 3) {                           /* a spinning top */
    const top = new T.Mesh(new T.ConeGeometry(0.07, 0.1, 12), mat("enamelBlue", 1, 1, "#7aa0c8"));
    g.add(at(top, 0, 0.058, 0, Math.PI));
    const cap = new T.Mesh(new T.CylinderGeometry(0.03, 0.055, 0.03, 12), flat("#d8b45c"));
    g.add(at(cap, 0, 0.12, 0));
    const knob = new T.Mesh(new T.CylinderGeometry(0.009, 0.009, 0.05, 8), flat("#a08050"));
    g.add(at(knob, 0, 0.155, 0));
  } else if (v === 4) {                           /* a wind-up car */
    const bm = flat(pick(rnd, ["#c8534e", "#3f7fb0", "#5fa070", "#d2a03c"]));
    g.add(sb(0.16, 0.05, 0.085, bm, 0, 0.045, 0));
    g.add(sb(0.085, 0.045, 0.075, bm, -0.012, 0.09, 0));
    g.add(sb(0.07, 0.03, 0.078, glow("#2e3a48", 0.9), -0.012, 0.096, 0));
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const w = new T.Mesh(new T.CylinderGeometry(0.026, 0.026, 0.014, 10), flat("#26262c"));
      g.add(at(w, sx * 0.055, 0.026, sz * 0.048, 0, 0, Math.PI / 2));
    }
    const key = new T.Mesh(new T.TorusGeometry(0.018, 0.005, 5, 10), flat("#d8c070"));
    g.add(at(key, 0.085, 0.055, 0, 0, Math.PI / 2));
  } else {                                        /* a ball, on a little ring */
    const c = pick(rnd, ["#d05a72", "#4f92c4", "#e0b03c", "#6fb07a"]);
    const b = new T.Mesh(new T.SphereGeometry(0.06, 12, 9), flat(c));
    g.add(at(b, 0, 0.062, 0));
    const band = new T.Mesh(new T.TorusGeometry(0.06, 0.011, 5, 14), flat("#efe4cc"));
    g.add(at(band, 0, 0.062, 0, 0, 0, 0.4));
    const ring = new T.Mesh(new T.TorusGeometry(0.035, 0.008, 5, 12), flat("#8a6a4a"));
    g.add(at(ring, 0, 0.008, 0, Math.PI / 2));
  }
  g.scale.setScalar(s);
  return g;
};

/* --- wall grates, four builds -------------------------------------- */
KIT.grate = function (v, rnd, w, h) {
  const g = new T.Group();
  const W = w || [0.6, 0.46, 0.75, 0.52][v % 4];
  const H = h || [0.4, 0.46, 0.34, 0.4][v % 4];
  const fm = mat("metal", 1, 1, "#7c848c");
  /* frame — four solid members, mitred by overlap, plus a recessed back */
  g.add(sb(W, 0.05, 0.05, fm, 0,  H / 2, 0));
  g.add(sb(W, 0.05, 0.05, fm, 0, -H / 2, 0));
  g.add(sb(0.05, H, 0.05, fm, -W / 2, 0, 0));
  g.add(sb(0.05, H, 0.05, fm,  W / 2, 0, 0));
  g.add(sb(W - 0.06, H - 0.06, 0.02, flat("#0a0b0d"), 0, 0, -0.045));
  /* louvres, angled, each one a solid with a lit top edge and a dark under */
  const n = v % 4 === 1 ? 7 : 5;
  for (let i = 0; i < n; i++) {
    const y = -H / 2 + 0.06 + i * ((H - 0.12) / (n - 1));
    g.add(sb(W - 0.08, 0.035, 0.045, fm, 0, y, -0.005, 0, -0.55));
  }
  /* four screws, because it is bolted to a wall */
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
    const s = new T.Mesh(new T.CylinderGeometry(0.011, 0.011, 0.018, 6), flat("#9aa2aa"));
    g.add(at(s, sx * (W / 2 - 0.022), sy * (H / 2 - 0.022), 0.03, Math.PI / 2));
  }
  return g;
};

/* --- what hangs on a wall, five builds ----------------------------- */
KIT.decor = function (v, rnd) {
  const g = new T.Group();
  const k = v % 5;
  if (k === 0) {                          /* a framed shop notice */
    const W = range(rnd, 0.4, 0.6), H = range(rnd, 0.3, 0.46);
    const fm = mat("woodDark", 1, 1, "#a07c50");
    g.add(sb(W, 0.045, 0.045, fm, 0, H / 2, 0));
    g.add(sb(W, 0.045, 0.045, fm, 0, -H / 2, 0));
    g.add(sb(0.045, H, 0.045, fm, -W / 2, 0, 0));
    g.add(sb(0.045, H, 0.045, fm, W / 2, 0, 0));
    g.add(sb(W - 0.05, H - 0.05, 0.014, flat("#c8b892"), 0, 0, -0.012));
    /* three bands of "print", raised, so it is not a painted rectangle */
    for (let i = 0; i < 3; i++) {
      g.add(sb((W - 0.16) * range(rnd, 0.5, 1), 0.022, 0.006, flat("#4a3f34"), 0, H / 4 - i * (H / 4), 0));
    }
  } else if (k === 1) {                   /* a wall clock, hands and all */
    const r = range(rnd, 0.15, 0.2);
    const case_ = new T.Mesh(new T.CylinderGeometry(r, r * 0.96, 0.07, 20), mat("woodDark", 1, 1, "#8a6a48"));
    g.add(at(case_, 0, 0, 0, Math.PI / 2));
    const face = new T.Mesh(new T.CylinderGeometry(r * 0.86, r * 0.86, 0.012, 20), flat("#ddd2b4"));
    g.add(at(face, 0, 0, 0.04, Math.PI / 2));
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * TAU;
      g.add(sb(0.012, 0.03, 0.008, flat("#2e2620"), Math.sin(a) * r * 0.7, Math.cos(a) * r * 0.7, 0.048, 0, 0, -a));
    }
    g.add(sb(0.014, r * 0.5, 0.01, flat("#241e18"), 0, r * 0.2, 0.056, 0, 0, 0.5));
    g.add(sb(0.011, r * 0.68, 0.01, flat("#241e18"), -r * 0.2, -r * 0.16, 0.058, 0, 0, 2.2));
    const hub = new T.Mesh(new T.SphereGeometry(0.018, 8, 6), flat("#c8a860"));
    g.add(at(hub, 0, 0, 0.06));
  } else if (k === 2) {                   /* a corner bracket shelf with one thing on it */
    const wm = mat("woodShelf", 1, 1, "#b08c60");
    g.add(sb(0.5, 0.035, 0.2, wm, 0, 0, 0.09));
    for (const sx of [-1, 1]) {
      g.add(sb(0.022, 0.13, 0.16, wm, sx * 0.19, -0.08, 0.07, 0, 0, 0));
      g.add(sb(0.022, 0.2, 0.022, wm, sx * 0.19, -0.075, 0.155, 0, -0.7));
    }
    const t = KIT.toy((rnd() * 6) | 0, rnd);
    at(t, range(rnd, -0.1, 0.1), 0.018, 0.09, 0, range(rnd, 0, TAU), 0);
    const s = contactShadow(t, { y: 0.018, opacity: 0.35, spread: 0.8 });
    if (s) g.add(s);
    g.add(t);
  } else if (k === 3) {                   /* a fire point: extinguisher on a bracket */
    const br = mat("metal", 1, 1, "#6a727a");
    g.add(sb(0.14, 0.03, 0.09, br, 0, 0.12, 0.05));
    g.add(sb(0.14, 0.03, 0.09, br, 0, -0.14, 0.05));
    const body = new T.Mesh(new T.CylinderGeometry(0.055, 0.055, 0.34, 12), flat("#a83c34"));
    g.add(at(body, 0, -0.02, 0.075));
    const dome = new T.Mesh(new T.SphereGeometry(0.055, 12, 6, 0, TAU, 0, Math.PI / 2), flat("#a83c34"));
    g.add(at(dome, 0, 0.15, 0.075));
    const nk = new T.Mesh(new T.CylinderGeometry(0.02, 0.02, 0.06, 8), flat("#4a4a50"));
    g.add(at(nk, 0, 0.19, 0.075));
    g.add(sb(0.09, 0.02, 0.02, flat("#c8b038"), 0.04, 0.21, 0.075, 0, 0, 0.2));
  } else {                                /* bunting, as real triangles on a real string */
    const n = 7;
    const cord = new T.Mesh(new T.CylinderGeometry(0.006, 0.006, 1.5, 5), flat("#8a7a5a"));
    g.add(at(cord, 0, 0, 0, 0, 0, Math.PI / 2));
    const cols = ["#d05a6c", "#e0b44c", "#5f9ec4", "#78b08a", "#c98ac0"];
    for (let i = 0; i < n; i++) {
      const x = -0.66 + i * (1.32 / (n - 1));
      const sag = Math.sin((i / (n - 1)) * Math.PI) * 0.06;
      const f = new T.Mesh(new T.ConeGeometry(0.07, 0.15, 3), flat(cols[i % 5]));
      g.add(at(f, x, -0.09 - sag, 0.012, Math.PI, 0, range(rnd, -0.2, 0.2)));
    }
  }
  return g;
};

/* --- light fittings ------------------------------------------------ */
KIT.bulb = function (kind, tint) {
  const g = new T.Group();
  if (kind === "pendant") {
    const flex = new T.Mesh(new T.CylinderGeometry(0.008, 0.008, 0.5, 5), flat("#2a2620"));
    g.add(at(flex, 0, 0.25, 0));
    const rose = new T.Mesh(new T.CylinderGeometry(0.05, 0.06, 0.035, 10), flat("#3a332a"));
    g.add(at(rose, 0, 0.5, 0));
    const shade = new T.Mesh(new T.ConeGeometry(0.19, 0.16, 14, 1, true), flat(tint || "#7a6a52", { side: T.DoubleSide }));
    g.add(at(shade, 0, 0.04, 0));
    const b = new T.Mesh(new T.SphereGeometry(0.045, 10, 8), glow("#ffe7bd"));
    b.userData.lamp = true;
    g.add(at(b, 0, -0.03, 0));
  } else if (kind === "strip") {
    const body = sb(1.25, 0.09, 0.16, mat("metal", 1, 1, "#7a828a"), 0, 0.045, 0);
    g.add(body);
    const t = sb(1.12, 0.03, 0.1, glow("#e8f0ff"), 0, -0.01, 0);
    t.userData.lamp = true;
    g.add(t);
    for (const sx of [-1, 1]) g.add(sb(0.05, 0.14, 0.18, mat("metal", 1, 1, "#6a7078"), sx * 0.61, 0.03, 0));
    for (const sx of [-1, 1]) {
      const ch = new T.Mesh(new T.CylinderGeometry(0.005, 0.005, 0.22, 4), flat("#4a4e54"));
      g.add(at(ch, sx * 0.45, 0.2, 0));
    }
  } else if (kind === "sconce") {
    g.add(sb(0.1, 0.16, 0.05, mat("metal", 1, 1, "#6a6258"), 0, 0, 0.025));
    const cup = new T.Mesh(new T.CylinderGeometry(0.11, 0.05, 0.13, 12, 1, true), flat(tint || "#8a7452", { side: T.DoubleSide }));
    g.add(at(cup, 0, 0.09, 0.11, 0.4));
    const b = new T.Mesh(new T.SphereGeometry(0.038, 8, 6), glow("#ffdcae"));
    b.userData.lamp = true;
    g.add(at(b, 0, 0.09, 0.11));
  } else {                                 /* a desk lamp with an arm */
    const gm = mat("enamelGreen", 1, 1, "#5e7a6c");
    const base = new T.Mesh(new T.CylinderGeometry(0.1, 0.125, 0.035, 16), gm);
    g.add(at(base, 0, 0.018, 0));
    g.add(at(new T.Mesh(new T.CylinderGeometry(0.055, 0.09, 0.03, 16), gm), 0, 0.05, 0));
    const arm = new T.Mesh(new T.CylinderGeometry(0.015, 0.018, 0.44, 8), flat("#48524e"));
    g.add(at(arm, 0.05, 0.27, 0, 0, 0, -0.22));
    const joint = new T.Mesh(new T.SphereGeometry(0.028, 10, 8), flat("#5a6460"));
    g.add(at(joint, -0.005, 0.47, 0));
    /* a shade with a real rim and a lit inside, tipped down over the desk */
    const shade = part(-0.14, 0.44, 0);
    shade.rotation.z = 0.42;
    shade.add(at(new T.Mesh(new T.ConeGeometry(0.135, 0.17, 16, 1, true), mat("enamelGreen", 1, 1, "#5e7a6c", { side: T.DoubleSide })), 0, 0, 0));
    shade.add(at(new T.Mesh(new T.ConeGeometry(0.126, 0.155, 16, 1, true), glow("#ffe2b4", 0.9)), 0, 0.006, 0));
    shade.add(at(new T.Mesh(new T.TorusGeometry(0.132, 0.011, 6, 18), gm), 0, -0.085, 0, Math.PI / 2));
    g.add(shade);
    const b = new T.Mesh(new T.SphereGeometry(0.038, 10, 8), glow("#ffdba6"));
    b.userData.lamp = true;
    g.add(at(b, -0.16, 0.38, 0));
  }
  return g;
};

/* --- a length of wall, with holes in it where the doorways are ------
   Doorways are built as gaps between solid segments with real jambs and
   a lintel over the top, so you can see the wall's thickness through
   the opening. That thickness is what stops a room reading as a set of
   painted flats.
   ------------------------------------------------------------------ */
function wallRun(len, height, thick, material, openings, opts) {
  opts = opts || {};
  const g = new T.Group();
  const cuts = (openings || []).slice().sort((a, b) => a.x - b.x);
  let x = -len / 2;
  const segs = [];
  cuts.forEach((o) => {
    const a = o.x - o.w / 2, b = o.x + o.w / 2;
    if (a > x) segs.push([x, a]);
    /* lintel over the opening */
    if (o.h < height) g.add(sb(o.w, height - o.h, thick, material, o.x, o.h + (height - o.h) / 2, 0));
    /* and, for a window, the wall under the sill */
    if (o.y0) {
      g.add(sb(o.w, o.y0, thick, material, o.x, o.y0 / 2, 0));
      g.add(sb(o.w, 0.05, thick + 0.02, opts.jamb || material, o.x, o.y0 + 0.025, 0));
    }
    /* jambs — the visible edge of the wall, in a lighter dressing */
    const jm = opts.jamb || material;
    const y0 = o.y0 || 0;
    for (const s of [-1, 1]) {
      g.add(sb(0.04, o.h - y0, thick + 0.02, jm, o.x + s * (o.w / 2 - 0.02), y0 + (o.h - y0) / 2, 0));
    }
    g.add(sb(o.w, 0.05, thick + 0.02, jm, o.x, o.h - 0.025, 0));
    x = b;
  });
  if (x < len / 2) segs.push([x, len / 2]);
  segs.forEach(([a, b]) => {
    if (b - a < 0.002) return;
    g.add(sb(b - a, height, thick, material, (a + b) / 2, height / 2, 0));
  });
  /* skirting along the bottom and a picture rail near the top: two more
     solids, and the shadow they throw is what gives a wall its scale */
  if (opts.skirt !== false) {
    const sm = opts.skirtMat || mat("woodDark", 2, 0.3, "#5a4632");
    const skirtSegs = segs.concat(cuts.filter((o) => o.y0 > 0.2).map((o) => [o.x - o.w / 2, o.x + o.w / 2]));
    skirtSegs.forEach(([a, b]) => {
      if (b - a < 0.06) return;
      g.add(sb(b - a, 0.13, thick + 0.03, sm, (a + b) / 2, 0.065, 0));
      g.add(sb(b - a, 0.02, thick + 0.045, sm, (a + b) / 2, 0.13, 0));
    });
  }
  if (opts.rail) {
    const rm = opts.railMat || mat("woodShelf", 2, 0.2, "#9a7f5c");
    segs.forEach(([a, b]) => {
      if (b - a < 0.06) return;
      g.add(sb(b - a, 0.05, thick + 0.045, rm, (a + b) / 2, opts.rail, 0));
      g.add(sb(b - a, 0.022, thick + 0.03, rm, (a + b) / 2, opts.rail + 0.036, 0));
    });
  }
  return g;
}

/* --- ambient occlusion, painted rather than computed ---------------
   A gradient laid along the foot of every wall and up from it. It is
   two triangles and no maths per frame, and it does the job the racer's
   props never had done for them: it welds the geometry to the floor.
   ------------------------------------------------------------------ */
function aoGradient() {
  if (texCache.aoGrad) return texCache.aoGrad;
  const c = canvas(64);
  const g = c.getContext("2d");
  const gr = g.createLinearGradient(0, 64, 0, 0);
  gr.addColorStop(0, "rgba(0,0,0,.85)");
  gr.addColorStop(0.35, "rgba(0,0,0,.34)");
  gr.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  const t = new T.CanvasTexture(c);
  t.colorSpace = T.SRGBColorSpace;
  t.wrapS = T.RepeatWrapping; t.wrapT = T.ClampToEdgeWrapping;
  texCache.aoGrad = t;
  return t;
}
function aoMat(strength) {
  const key = "ao|" + strength;
  if (matCache[key]) return matCache[key];
  const m = new T.MeshBasicMaterial({
    map: aoGradient(), transparent: true, depthWrite: false,
    opacity: strength, fog: false,
  });
  matCache[key] = m;
  return m;
}
/* one skirt of shade: `len` along X, reaching `depth` out from the wall
   at z = 0, lying on the floor at y */
function aoSkirt(len, depth, y, strength) {
  const m = new T.Mesh(new T.PlaneGeometry(len, depth), aoMat(strength === undefined ? 0.5 : strength));
  m.rotation.x = -Math.PI / 2;
  m.position.set(0, (y || 0) + 0.004, depth / 2);
  m.renderOrder = -1;
  m.updateMatrix(); m.matrixAutoUpdate = false;
  return m;
}
/* and the matching one climbing the wall itself */
function aoRise(len, height, strength) {
  const m = new T.Mesh(new T.PlaneGeometry(len, height), aoMat(strength === undefined ? 0.42 : strength));
  m.position.set(0, height / 2, 0.01);
  m.updateMatrix(); m.matrixAutoUpdate = false;
  return m;
}

/* =========================================================
   11. THE SHELL

   Every room is a box of solids: a floor with thickness, a ceiling with
   thickness, four walls with thickness, skirting, and shade in the
   corners. `openings` cuts real doorways with visible jambs.
   ========================================================= */
function shell(opts) {
  const g = new T.Group();
  const W = opts.w, D = opts.d, H = opts.h || 3.0;
  const t = 0.16;

  /* floor — a slab, not a plane, so its edge shows in a doorway */
  g.add(sb(W + t * 2, t, D + t * 2, opts.floor, 0, -t / 2, 0));
  /* ceiling, and the joists under it where a room would have them */
  if (opts.ceiling !== false) {
    g.add(sb(W + t * 2, t, D + t * 2, opts.ceil || opts.wall, 0, H + t / 2, 0));
    if (opts.joists) {
      const jm = mat("woodDark", 1, 0.4, "#4a3a28");
      const n = Math.max(2, Math.round(D / 0.9));
      for (let i = 0; i < n; i++) {
        g.add(sb(W, 0.11, 0.07, jm, 0, H - 0.055, -D / 2 + (i + 0.5) * (D / n)));
      }
    }
  }

  const sides = [
    { k: "n", len: W, x: 0, z: -D / 2, ry: 0 },
    { k: "s", len: W, x: 0, z:  D / 2, ry: Math.PI },
    { k: "w", len: D, x: -W / 2, z: 0, ry: Math.PI / 2 },
    { k: "e", len: D, x:  W / 2, z: 0, ry: -Math.PI / 2 },
  ];
  sides.forEach((s) => {
    const run = wallRun(s.len, H, t, opts.wall, opts.openings && opts.openings[s.k], {
      rail: opts.rail, jamb: opts.jamb || opts.wall, skirtMat: opts.skirtMat,
    });
    run.position.set(s.x, 0, s.z);
    run.rotation.y = s.ry;
    g.add(run);
    /* the shade where that wall meets the floor */
    const ao = new T.Group();
    ao.position.set(s.x, 0, s.z);
    ao.rotation.y = s.ry;
    ao.add(aoSkirt(s.len, 0.55, 0, opts.aoFloor === undefined ? 0.5 : opts.aoFloor));
    ao.add(aoRise(s.len, 0.7, opts.aoWall === undefined ? 0.34 : opts.aoWall));
    g.add(ao);
  });
  return g;
}

/* =========================================================
   12. THE WORLD

   One scene. Every room is built once, in its own local space, and
   parked at its own address sixty metres from its neighbours, so no
   room's light can reach another and nothing has to be torn down and
   rebuilt when the view changes. Switching camera is: move one camera,
   re-point six lights, change the fog colour. Nothing else moves.
   ========================================================= */
const SPACING = 60;

/* three.js has been on physical light units since r155: a point light's
   intensity is candela, so the numbers a room asks for below are written
   in a readable 0-3 range and multiplied through here. One number to
   brighten or darken the whole shop, which is exactly what you want at
   two in the morning with a headache. */
const LUX = 11;

let renderer = null, scene = null, view = null;   // view = the one camera
const rooms = {};                                 // id -> room record
let rigAmbient = null;
const rig = [];                                   // the fixed pool of point lights
const RIG_N = 8;

function makeRoomRecord(id, index) {
  const g = new T.Group();
  g.position.set(index * SPACING, 0, 0);
  g.updateMatrix();
  g.matrixAutoUpdate = false;     // the address never changes
  const rec = {
    id, index, group: g,
    lights: [],          // {x,y,z,color,intensity,distance,decay,tag}
    cams:   {},          // name -> {pos:[], look:[], fov}
    anchors:{},          // name -> {x,y,z,ry}  — where the cast can stand
    fog:    { color: "#05060a", near: 2, far: 22 },
    ambient:{ color: "#20242e", intensity: 0.5 },
    live:   new T.Group(),   // the only branch of a room that may animate
  };
  rec.live.position.set(0, 0, 0);
  g.add(rec.live);
  rooms[id] = rec;
  return rec;
}

/* the little API a room builder is handed */
function roomAPI(rec) {
  return {
    id: rec.id,
    /* static: goes into the frozen branch */
    add(obj)      { rec.group.add(obj); freeze(obj); return obj; },
    place(obj, x, y, z, o) { return place(rec.group, obj, x, y, z, o); },
    /* animated: goes into the live branch, which keeps its auto-update */
    live(obj)     { rec.live.add(obj); return obj; },
    light(o)      { rec.lights.push(o); return o; },
    cam(name, pos, look, fov, o) {
      rec.cams[name] = Object.assign({ pos, look, fov: fov || 60 }, o || {});
    },
    anchor(name, x, y, z, ry) { rec.anchors[name] = { x, y, z, ry: ry || 0 }; },
    mood(o)       { if (o.fog) rec.fog = o.fog; if (o.ambient) rec.ambient = o.ambient; },
    rnd: rngFor("room:" + rec.id),
  };
}

/* world position of a room-local point */
function worldOf(rec, x, y, z, out) {
  out = out || new T.Vector3();
  return out.set(x + rec.index * SPACING, y, z);
}

/* --- pointing the one camera and the one light rig at a room ------- */
const _lookAt = new T.Vector3();

function useView(roomId, camName, opts) {
  opts = opts || {};
  const rec = rooms[roomId];
  if (!rec) return;
  const c = rec.cams[camName] || rec.cams.main;
  if (!c) return;
  const ox = rec.index * SPACING;
  view.fov = c.fov;
  view.position.set(c.pos[0] + ox, c.pos[1], c.pos[2]);
  _lookAt.set(c.look[0] + ox, c.look[1], c.look[2]);
  view.lookAt(_lookAt);
  view.updateProjectionMatrix();
  view.userData.base = { pos: view.position.clone(), quat: view.quaternion.clone() };

  /* the light rig follows. Six slots, always present, so the shader is
     compiled once and switching rooms never stalls on a recompile. */
  const L = rec.lights;
  for (let i = 0; i < RIG_N; i++) {
    const l = rig[i];
    const src = L[i];
    if (src) {
      l.position.set(src.x + ox, src.y, src.z);
      l.color.set(src.color);
      l.userData.base = src.intensity * LUX;
      l.userData.tag = src.tag || "";
      l.intensity = l.userData.base;
      l.distance = src.distance || 9;
      l.decay = src.decay === undefined ? 1.6 : src.decay;
    } else {
      l.position.set(ox, -50, 0);
      l.userData.base = 0;
      l.userData.tag = "";
      l.intensity = 0;
    }
  }
  rigAmbient.color.set(rec.ambient.color);
  rigAmbient.intensity = rec.ambient.intensity;
  rigAmbient.userData.base = rec.ambient.intensity;
  scene.fog.color.set(rec.fog.color);
  scene.fog.near = rec.fog.near;
  scene.fog.far = rec.fog.far;
  if (renderer) renderer.setClearColor(new T.Color(rec.fog.color), 1);
  return rec;
}

/* =========================================================
   13. THE SECURITY OFFICE

   The room the whole game is played from, so it gets the most work.
   Six metres by five, one desk, two doorways with the wall's thickness
   showing through them, a duct grate up under the ceiling, and enough
   of somebody's night in it — a mug, a radio, a fan, a wind-up toy
   they have clearly been fiddling with — that it reads as a place a
   person sits rather than a menu with a floor.
   ========================================================= */
const OFFICE = { W: 6.6, D: 5.0, H: 2.9, doorZ: -0.9, doorW: 1.15, doorH: 2.15 };

function buildOffice(R) {
  const { W, D, H, doorZ, doorW, doorH } = OFFICE;
  const rnd = R.rnd;

  const wallM  = mat("wallOffice", 2.2, 1.1, "#9c8f78");
  const jambM  = mat("woodDark", 0.6, 0.6, "#7a5f42");
  const floorM = mat("floorOffice", 5, 5, "#b2a693");
  const ceilM  = mat("wallOffice", 3, 3, "#6a6152");

  R.add(freeze(shell({
    w: W, d: D, h: H,
    floor: floorM, wall: wallM, ceil: ceilM, jamb: jambM,
    rail: 1.06,
    openings: {
      w: [{ x: -doorZ, w: doorW, h: doorH }],
      e: [{ x:  doorZ, w: doorW, h: doorH }],
      n: [{ x: -1.75, w: 1.62, h: 2.24, y0: 1.02 }],
    },
    aoFloor: 0.55, aoWall: 0.36,
  })));

  /* --- the corridor stubs beyond each doorway ---------------------
     Without them a doorway is a hole onto nothing and the room reads
     as a stage flat. Each stub is a real little box of walls and floor
     with its own light, so a shape standing in it is a silhouette. */
  [-1, 1].forEach((s) => {
    const stub = new T.Group();
    const sm = mat(s < 0 ? "wallCream" : "wallPaper", 1.4, 1, s < 0 ? "#7d7260" : "#7a7060");
    stub.add(sb(2.2, 0.14, 2.0, mat("floorTile", 3, 3, "#7f766a"), 0, -0.07, 0));
    stub.add(sb(2.2, 2.5, 0.14, sm, 0, 1.25, -1.0));
    stub.add(sb(2.2, 2.5, 0.14, sm, 0, 1.25,  1.0));
    stub.add(sb(0.14, 2.5, 2.0, sm, s * 1.1, 1.25, 0));
    stub.add(sb(2.2, 0.14, 2.0, ceilM, 0, 2.55, 0));
    /* skirting in the stub too — the eye reads the join */
    for (const z of [-1, 1]) stub.add(sb(2.2, 0.13, 0.05, mat("woodDark", 1, 0.3, "#54402c"), 0, 0.065, z * 0.92));
    R.place(freeze(stub), s * (W / 2 + 1.0), 0, doorZ, { shadow: false });
  });

  /* --- the desk --------------------------------------------------- */
  const deskZ = 1.18;
  const desk = new T.Group();
  const topM = mat("woodShelf", 1.6, 0.8, "#a8825a");
  const carM = mat("enamelCream", 1, 1, "#8f8674");
  desk.add(sb(2.35, 0.055, 0.8, topM, 0, 0.755, 0));            // top
  desk.add(sb(2.35, 0.03, 0.06, mat("woodDark", 1, 1, "#6a4f34"), 0, 0.715, 0.4));  // front lip
  desk.add(sb(2.2, 0.42, 0.03, carM, 0, 0.5, -0.36));            // modesty panel
  /* two pedestals, with drawer fronts that are proud of the carcass */
  [-1, 1].forEach((s) => {
    const p = part(s * 0.83, 0, 0);
    p.add(sb(0.52, 0.72, 0.74, carM, 0, 0.36, 0));
    for (let i = 0; i < 3; i++) {
      const y = 0.16 + i * 0.22;
      p.add(sb(0.5, 0.19, 0.03, mat("enamelCream", 1, 1, "#9a9280"), 0, y, 0.375));
      const h = new T.Mesh(new T.CylinderGeometry(0.012, 0.012, 0.16, 6), flat("#b8a878"));
      p.add(at(h, 0, y, 0.4, 0, 0, Math.PI / 2));
    }
    p.add(sb(0.54, 0.05, 0.76, carM, 0, 0.735, 0));
    desk.add(p);
  });
  /* the desk's own feet, so the carcass is not sitting in the carpet */
  [-1, 1].forEach((sx) => [-1, 1].forEach((sz) => {
    desk.add(sb(0.06, 0.03, 0.06, flat("#2a2620"), sx * 1.05, 0.015, sz * 0.32));
  }));
  R.place(freeze(desk), 0, 0, deskZ, { shadowOpacity: 0.7 });

  /* --- the monitor, which is also half the light in the room ------ */
  const mon = new T.Group();
  mon.add(sb(0.62, 0.5, 0.52, mat("enamelCream", 1, 1, "#8a8070"), 0, 0.27, -0.06));
  mon.add(sb(0.56, 0.44, 0.05, flat("#2a2822"), 0, 0.3, 0.2));
  const face = sb(0.47, 0.35, 0.02, new T.MeshBasicMaterial({ map: TX.crt, fog: true }), 0, 0.3, 0.225);
  face.userData.screen = "office";
  mon.add(face);
  mon.add(sb(0.62, 0.06, 0.5, mat("enamelCream", 1, 1, "#7a7264"), 0, 0.03, -0.05));
  for (let i = 0; i < 3; i++) {
    const k = new T.Mesh(new T.CylinderGeometry(0.014, 0.014, 0.02, 8), flat("#4a463c"));
    mon.add(at(k, -0.18 + i * 0.09, 0.05, 0.21, Math.PI / 2));
  }
  R.place(freeze(mon), 1.1, 0.785, deskZ - 0.24, { ry: -0.55, s: 0.92, shadowOpacity: 0.5 });

  /* --- desk lamp, radio, fan, mug, paperwork ---------------------- */
  R.place(freeze(KIT.bulb("desk")), -0.98, 0.785, deskZ - 0.26, { ry: 1.9, shadowOpacity: 0.45 });

  const radio = new T.Group();
  radio.add(sb(0.36, 0.2, 0.15, mat("woodDark", 1, 1, "#8a6742"), 0, 0.1, 0));
  radio.add(sb(0.19, 0.13, 0.02, flat("#3b3229"), -0.07, 0.11, 0.076));
  for (let i = 0; i < 7; i++) radio.add(sb(0.17, 0.008, 0.012, flat("#5e5346"), -0.07, 0.055 + i * 0.016, 0.084));
  radio.add(sb(0.12, 0.05, 0.015, glow("#c8a24a", 0.9), 0.1, 0.14, 0.078));
  for (let i = 0; i < 2; i++) {
    const k = new T.Mesh(new T.CylinderGeometry(0.022, 0.024, 0.02, 10), flat("#c0a878"));
    radio.add(at(k, 0.06 + i * 0.08, 0.055, 0.08, Math.PI / 2));
  }
  radio.add(sb(0.01, 0.26, 0.01, flat("#b0b4b8"), 0.16, 0.32, -0.04, 0, 0, 0.22));
  R.place(freeze(radio), -0.78, 0.785, deskZ + 0.24, { ry: 0.5, shadowOpacity: 0.5 });

  /* the fan turns, so it is the one thing on the desk that lives in the
     animated branch. Everything else here is frozen. */
  const fanBase = new T.Group();
  fanBase.add(sb(0.2, 0.03, 0.16, mat("enamelBlue", 1, 1, "#5a6e84"), 0, 0.015, 0));
  const stem = new T.Mesh(new T.CylinderGeometry(0.018, 0.022, 0.2, 8), flat("#4e6076"));
  fanBase.add(at(stem, 0, 0.12, 0));
  const hub = new T.Mesh(new T.CylinderGeometry(0.05, 0.05, 0.06, 12), mat("enamelBlue", 1, 1, "#5a6e84"));
  fanBase.add(at(hub, 0, 0.25, 0.02, Math.PI / 2));
  for (let i = 0; i < 4; i++) {
    const r = new T.Mesh(new T.TorusGeometry(0.045 + i * 0.024, 0.0035, 4, 18), flat("#8a9098"));
    fanBase.add(at(r, 0, 0.25, 0.06));
  }
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU;
    fanBase.add(sb(0.006, 0.19, 0.006, flat("#8a9098"), Math.sin(a) * 0.0, 0.25, 0.06, 0, 0, a));
  }
  R.place(freeze(fanBase), 1.44, 0.785, deskZ + 0.1, { ry: -0.5, shadowOpacity: 0.45 });
  const blades = new T.Group();
  for (let i = 0; i < 4; i++) {
    const holder = new T.Group();
    holder.rotation.z = (i / 4) * TAU;
    /* each blade is pitched, so the fan reads as a fan and not a cross */
    holder.add(at(sb(0.15, 0.06, 0.014, flat("#c0c6cc"), 0, 0, 0), 0.085, 0, 0, 0.5));
    blades.add(holder);
  }
  blades.add(at(new T.Mesh(new T.SphereGeometry(0.026, 8, 6), flat("#8a9098")), 0, 0, 0));
  blades.position.set(1.44, 1.035, deskZ + 0.16);
  blades.userData.spin = true;
  R.live(blades);

  /* mug, pen pot, clipboard, and the wind-up toy somebody left out */
  const mug = new T.Group();
  const cup = new T.Mesh(new T.CylinderGeometry(0.043, 0.037, 0.095, 14), flat("#c8d0c4"));
  mug.add(at(cup, 0, 0.048, 0));
  const tea = new T.Mesh(new T.CylinderGeometry(0.038, 0.038, 0.005, 14), flat("#5a4028"));
  mug.add(at(tea, 0, 0.082, 0));
  const hnd = new T.Mesh(new T.TorusGeometry(0.03, 0.008, 5, 12), flat("#c8d0c4"));
  mug.add(at(hnd, 0.05, 0.05, 0, 0, Math.PI / 2));
  R.place(freeze(mug), 0.24, 0.785, deskZ + 0.28, { shadowOpacity: 0.55 });

  const pot = new T.Group();
  const pc = new T.Mesh(new T.CylinderGeometry(0.042, 0.036, 0.1, 10), mat("enamelGreen", 1, 1, "#6a8878"));
  pot.add(at(pc, 0, 0.05, 0));
  for (let i = 0; i < 4; i++) {
    const p = new T.Mesh(new T.CylinderGeometry(0.005, 0.005, 0.16, 5), flat(["#d05a5a", "#3f6fa0", "#e0b040", "#2e2e34"][i]));
    pot.add(at(p, range(rnd, -0.02, 0.02), 0.12, range(rnd, -0.02, 0.02), range(rnd, -0.16, 0.16), 0, range(rnd, -0.2, 0.2)));
  }
  R.place(freeze(pot), 0.66, 0.785, deskZ - 0.2, { shadowOpacity: 0.5 });

  const clip = new T.Group();
  clip.add(sb(0.22, 0.012, 0.3, flat("#8a6a44"), 0, 0.006, 0));
  clip.add(sb(0.2, 0.008, 0.27, flat("#d8cfb4"), 0, 0.016, 0.005));
  clip.add(sb(0.09, 0.02, 0.035, flat("#9aa0a6"), 0, 0.026, -0.13));
  for (let i = 0; i < 5; i++) clip.add(sb(0.13, 0.002, 0.006, flat("#6a6152"), -0.01, 0.021, -0.06 + i * 0.045));
  R.place(freeze(clip), -0.2, 0.785, deskZ + 0.2, { ry: -0.22, shadowOpacity: 0.45 });

  const toy = KIT.toy(4, rnd);
  R.place(freeze(toy), 0.52, 0.785, deskZ + 0.24, { ry: -0.9, s: 1.1, shadowOpacity: 0.5 });

  /* --- the meter and the three lamps: the office's own instruments --
     Deliberately physical. The overlay HUD says the number; this says
     it the way a 1931 shop fitting would, with a needle that wobbles. */
  const gauge = new T.Group();
  gauge.add(sb(0.44, 0.3, 0.14, mat("enamelGreen", 1, 1, "#5e7468"), 0, 0.15, 0));
  gauge.add(sb(0.38, 0.24, 0.02, flat("#e4dcc0"), 0, 0.16, 0.072));
  gauge.add(sb(0.42, 0.03, 0.03, flat("#c0a860"), 0, 0.295, 0.06));
  for (let i = 0; i <= 8; i++) {
    const a = -1.05 + (i / 8) * 2.1;
    gauge.add(sb(i % 4 === 0 ? 0.012 : 0.007, i % 4 === 0 ? 0.035 : 0.022, 0.006,
      flat(i < 2 ? "#a83c34" : "#3a352c"),
      Math.sin(a) * 0.115, 0.14 + Math.cos(a) * 0.115, 0.082, 0, 0, -a));
  }
  R.place(freeze(gauge), -0.5, 0.785, deskZ - 0.24, { ry: 0.24, shadowOpacity: 0.55 });
  const needle = new T.Group();
  needle.add(at(sb(0.008, 0.12, 0.005, flat("#b03c30"), 0, 0.06, 0)));
  const nhub = new T.Mesh(new T.SphereGeometry(0.016, 8, 6), flat("#c8b070"));
  needle.add(at(nhub, 0, 0, 0.004));
  const needleHolder = new T.Group();
  needleHolder.position.set(-0.5, 0.925, deskZ - 0.24);
  needleHolder.rotation.y = 0.24;
  needle.position.set(0, 0, 0.086);
  needleHolder.add(needle);
  needleHolder.userData.needle = needle;
  R.live(needleHolder);

  /* the three status lamps, in a brass strip */
  const lampStrip = new T.Group();
  lampStrip.add(sb(0.54, 0.075, 0.14, mat("metal", 1, 1, "#a2905e"), 0, 0.038, 0));
  lampStrip.add(sb(0.5, 0.03, 0.1, flat("#2f2a22"), 0, 0.09, -0.012, 0, -0.5));
  const lampMeshes = [];
  ["left", "right", "hatch"].forEach((k, i) => {
    lampStrip.add(sb(0.09, 0.02, 0.09, flat("#6a5c40"), -0.17 + i * 0.17, 0.08, 0.012));
    const cap = new T.Mesh(new T.SphereGeometry(0.04, 12, 9, 0, TAU, 0, Math.PI / 2), glow("#3a2a26"));
    at(cap, -0.17 + i * 0.17, 0.088, 0.012);
    cap.userData.statusLamp = k;
    lampMeshes.push(cap);
    lampStrip.add(cap);
  });
  lampStrip.position.set(0.2, 0.785, deskZ - 0.26);
  lampStrip.rotation.y = -0.1;
  R.live(lampStrip);

  /* --- the north wall: window, corkboard, filing cabinet, duct ----- */
  const win = new T.Group();
  const fm = mat("woodDark", 1, 1, "#6e5236");
  win.add(sb(1.7, 0.1, 0.16, fm, 0, 0.6, 0));
  win.add(sb(1.7, 0.1, 0.16, fm, 0, -0.6, 0));
  win.add(sb(0.1, 1.3, 0.16, fm, -0.85, 0, 0));
  win.add(sb(0.1, 1.3, 0.16, fm, 0.85, 0, 0));
  win.add(sb(0.07, 1.2, 0.12, fm, 0, 0, 0));
  win.add(sb(1.6, 0.06, 0.12, fm, 0, 0, 0));
  win.add(sb(1.8, 0.09, 0.24, fm, 0, -0.66, 0.05));                 // sill, proud of the wall
  /* the glass: the one plane besides shadows, and it is glass */
  const glass = new T.Mesh(new T.PlaneGeometry(1.72, 1.3), new T.MeshBasicMaterial({
    map: TX.night, fog: true,
  }));
  win.add(at(glass, 0, 0, -0.15));
  /* bars outside it, because the shop has a window onto an alley */
  for (let i = 0; i < 5; i++) win.add(sb(0.026, 1.24, 0.026, flat("#2e3238"), -0.6 + i * 0.3, 0, -0.09));
  R.place(freeze(win), -1.75, 1.62, -D / 2 + 0.09, { shadow: false });

  const cork = new T.Group();
  cork.add(sb(1.0, 0.66, 0.05, mat("woodShelf", 1, 1, "#8a6a44"), 0, 0, 0));
  cork.add(sb(0.92, 0.58, 0.02, flat("#a08050"), 0, 0, 0.03));
  const notes = ["#e8e0c4", "#d8c8a8", "#e4d8b8", "#cfc4a0", "#e8dcc0"];
  for (let i = 0; i < 6; i++) {
    const nx = range(rnd, -0.36, 0.36), ny = range(rnd, -0.2, 0.2);
    cork.add(sb(range(rnd, 0.14, 0.2), range(rnd, 0.12, 0.18), 0.006, flat(notes[i % 5]), nx, ny, 0.043, 0, 0, range(rnd, -0.14, 0.14)));
    const pin = new T.Mesh(new T.SphereGeometry(0.012, 6, 5), flat(["#c8443c", "#3f7fb0", "#e0b040"][i % 3]));
    cork.add(at(pin, nx, ny + 0.06, 0.052));
  }
  R.place(freeze(cork), 1.25, 1.62, -D / 2 + 0.06, { shadow: false });

  const cab = new T.Group();
  const cm = mat("enamelGreen", 0.8, 1.4, "#6a7a68");
  cab.add(sb(0.5, 1.3, 0.62, cm, 0, 0.65, 0));
  for (let i = 0; i < 3; i++) {
    cab.add(sb(0.46, 0.38, 0.04, mat("enamelGreen", 1, 1, "#78886e"), 0, 0.24 + i * 0.42, 0.32));
    cab.add(sb(0.14, 0.035, 0.05, flat("#b8ac84"), 0, 0.24 + i * 0.42, 0.35));
    cab.add(sb(0.08, 0.05, 0.012, flat("#d8cfb0"), -0.13, 0.35 + i * 0.42, 0.345));
  }
  cab.add(sb(0.54, 0.045, 0.66, cm, 0, 1.32, 0));
  cab.add(sb(0.46, 0.06, 0.58, flat("#2a2b28"), 0, 0.03, 0));
  const cbox = KIT.crate(2, rnd);
  at(cbox, 0, 1.34, 0, 0, 0.3, 0);
  cab.add(cbox);
  const cs = contactShadow(cbox, { y: 1.343, opacity: 0.45 });
  if (cs) cab.add(cs);
  R.place(freeze(cab), -2.85, 0, -D / 2 + 0.5, { ry: 0.06, shadowOpacity: 0.72 });

  /* the duct, and the grate the owl comes to */
  const duct = new T.Group();
  const dm = mat("metal", 1.5, 0.6, "#7a828a");
  duct.add(sb(2.6, 0.42, 0.44, dm, 0, 0, 0));
  for (let i = 0; i < 4; i++) duct.add(sb(0.05, 0.48, 0.5, dm, -1.0 + i * 0.66, 0, 0));
  for (const sx of [-1, 1]) {
    const st = new T.Mesh(new T.CylinderGeometry(0.012, 0.012, 0.22, 5), flat("#5a6068"));
    duct.add(at(st, sx * 0.9, 0.3, 0));
  }
  R.place(freeze(duct), 1.9, 2.66, -D / 2 + 1.35, { ry: Math.PI / 2, shadow: false });
  /* the elbow that drops the run onto the grate */
  const elbow = new T.Group();
  elbow.add(sb(0.5, 0.5, 0.48, dm, 0, 0, 0));
  elbow.add(sb(0.56, 0.06, 0.54, mat("metal", 1, 1, "#5e666e"), 0, 0.25, 0));
  R.place(freeze(elbow), 1.9, 2.5, -D / 2 + 0.32, { shadow: false });

  const grate = KIT.grate(2, rnd, 0.86, 0.56);
  R.place(freeze(grate), 1.9, 2.16, -D / 2 + 0.06, { shadow: false });
  R.anchor("hatch", 1.9, 1.86, -D / 2 - 0.36, 0);

  /* the dark behind the grate, so something can be seen moving in it */
  const ductVoid = sb(0.96, 0.66, 0.5, flat("#07080b"), 1.9, 2.16, -D / 2 - 0.28);
  R.add(freeze(ductVoid));

  /* --- side walls, corners, floor clutter -------------------------- */
  R.place(freeze(KIT.decor(1, rnd)), -W / 2 + 0.1, 1.85, 1.5, { ry: Math.PI / 2, shadow: false });
  R.place(freeze(KIT.decor(3, rnd)),  W / 2 - 0.1, 1.5, 1.4, { ry: -Math.PI / 2, shadow: false });
  R.place(freeze(KIT.decor(0, rnd)),  W / 2 - 0.1, 1.72, -1.9, { ry: -Math.PI / 2, shadow: false });
  R.place(freeze(KIT.decor(2, rnd)), -W / 2 + 0.1, 1.5, -1.9, { ry: Math.PI / 2, shadow: false });

  const bin = new T.Group();
  const bb = new T.Mesh(new T.CylinderGeometry(0.15, 0.12, 0.34, 12, 1, true), mat("metal", 1, 1, "#6a7078", { side: T.DoubleSide }));
  bin.add(at(bb, 0, 0.17, 0));
  bin.add(sb(0.22, 0.02, 0.22, flat("#2e3238"), 0, 0.01, 0));
  for (let i = 0; i < 3; i++) {
    const p = new T.Mesh(new T.SphereGeometry(range(rnd, 0.04, 0.06), 6, 5), flat("#d8cfb0"));
    bin.add(at(p, range(rnd, -0.07, 0.07), 0.3 + i * 0.03, range(rnd, -0.07, 0.07)));
  }
  R.place(freeze(bin), -2.55, 0, 1.55, { shadowOpacity: 0.68 });

  const stack = new T.Group();
  for (let i = 0; i < 3; i++) {
    const c = KIT.crate(i % 3, rnd);
    at(c, range(rnd, -0.05, 0.05), i * 0.36, range(rnd, -0.05, 0.05), 0, range(rnd, -0.4, 0.4), 0);
    stack.add(c);
    if (i > 0) { const s2 = contactShadow(c, { y: i * 0.36, opacity: 0.4 }); if (s2) stack.add(s2); }
  }
  R.place(freeze(stack), 2.72, 0, 1.7, { ry: -0.3, shadowOpacity: 0.75 });

  R.place(freeze(KIT.chair(1, rnd)), 2.5, 0, -1.9, { ry: 0.7, shadowOpacity: 0.7 });

  /* a cable from the desk to the wall, in three real segments */
  const cable = new T.Group();
  const cm2 = flat("#22242a");
  cable.add(at(new T.Mesh(new T.CylinderGeometry(0.012, 0.012, 1.1, 5), cm2), 0.5, 0.012, 0.3, 0, 0, Math.PI / 2));
  cable.add(at(new T.Mesh(new T.CylinderGeometry(0.012, 0.012, 0.9, 5), cm2), -0.05, 0.012, -0.15, Math.PI / 2, 0, 0));
  cable.add(at(new T.Mesh(new T.CylinderGeometry(0.012, 0.012, 0.4, 5), cm2), -0.05, 0.2, -0.6, 0, 0, 0));
  R.place(freeze(cable), -0.4, 0, 0.7, { shadow: false });

  /* --- the overhead bulb, which is on its way out ----------------- */
  const pend = KIT.bulb("pendant", "#6a5a44");
  pend.position.set(-0.35, 2.38, -0.45);
  pend.userData.pendant = true;
  R.live(pend);

  /* --- lighting ---------------------------------------------------
     Four pools and two spills. Nothing uniform: the desk is warm, the
     monitor is cold, the ceiling bulb is failing, and each doorway has
     just enough light beyond it to make a silhouette out of anything
     standing there. */
  R.light({ x: -0.86, y: 1.16, z: deskZ - 0.16, color: "#ffb765", intensity: 2.4, distance: 5.0, decay: 1.4, tag: "desk" });
  R.light({ x: 0.66, y: 1.12, z: deskZ + 0.2, color: "#79b6e2", intensity: 1.5, distance: 3.0, decay: 1.6, tag: "monitor" });
  R.light({ x: -0.35, y: 2.3, z: -0.45, color: "#ffd0a0", intensity: 1.5, distance: 7.4, decay: 1.35, tag: "pendant" });
  R.light({ x: -1.75, y: 1.5, z: -D / 2 + 0.75, color: "#7f9ad6", intensity: 0.8, distance: 4.8, decay: 1.6, tag: "window" });
  R.light({ x: -W / 2 - 0.7, y: 1.75, z: doorZ, color: "#ffc98a", intensity: 1.5, distance: 3.6, decay: 1.5, tag: "doorL" });
  R.light({ x:  W / 2 + 0.75, y: 1.8, z: doorZ, color: "#d9b9a4", intensity: 1.5, distance: 3.8, decay: 1.5, tag: "doorR" });

  R.mood({
    fog: { color: "#080a10", near: 3.5, far: 17 },
    ambient: { color: "#2b2c34", intensity: 0.5 },
  });

  /* --- the seat ---------------------------------------------------- */
  R.cam("main", [0, 1.62, 2.16], [0, 1.06, -2.7], 74);

  /* where the cast stands when it gets here */
  R.anchor("leftDoor",  -W / 2 - 0.62, 0, doorZ,  Math.PI / 2);
  R.anchor("rightDoor",  W / 2 + 0.62, 0, doorZ, -Math.PI / 2);
  R.anchor("leftHall",  -W / 2 - 1.5, 0, doorZ,  Math.PI / 2);
  R.anchor("rightHall",  W / 2 + 1.5, 0, doorZ, -Math.PI / 2);

  return { lampMeshes, needleHolder, blades, pend, face };
}

/* =========================================================
   14. THE DOORS AND THE HATCH

   Roller shutters, because a hinged door would have to swing through
   the doorway the thing is standing in. Each is a stack of real slats
   with a lip on every one, so the corrugation catches the doorway
   light as it comes down, and a bottom rail that lands with a bang.

   The shutter is the only geometry in the office that moves, and it
   moves in Y only. Its housing, guides and jambs are frozen.
   ========================================================= */
function buildOfficeDoors(R) {
  const { W, H, doorZ, doorW, doorH } = OFFICE;
  const out = {};

  ["left", "right"].forEach((side) => {
    const s = side === "left" ? -1 : 1;
    const x = s * (W / 2);

    /* housing and guides — static */
    const fixed = new T.Group();
    const hm = mat("metal", 1.2, 0.5, "#79818a");
    fixed.add(sb(0.3, 0.34, doorW + 0.34, hm, 0, doorH + 0.17, 0));
    fixed.add(sb(0.34, 0.06, doorW + 0.4, mat("metal", 1, 1, "#5e666e"), 0, doorH + 0.35, 0));
    for (const sz of [-1, 1]) {
      fixed.add(sb(0.16, doorH + 0.1, 0.08, hm, 0, (doorH + 0.1) / 2, sz * (doorW / 2 + 0.05)));
    }
    /* a warning stripe on the floor under it, painted on the threshold */
    const thr = sb(0.3, 0.02, doorW + 0.1, mat("enamelCream", 2, 1, "#b8a45c"), 0, 0.012, 0);
    fixed.add(thr);
    R.place(freeze(fixed), x, 0, doorZ, { shadow: false });

    /* the shutter — live */
    const sh = new T.Group();
    const slatM = mat("metal", 1.6, 0.35, "#8a929a");
    const N = 13;
    for (let i = 0; i < N; i++) {
      const y = 0.1 + i * ((doorH - 0.2) / (N - 1));
      sh.add(sb(0.075, 0.135, doorW + 0.02, slatM, 0, y, 0));
      sh.add(sb(0.11, 0.03, doorW + 0.02, mat("metal", 1, 1, "#a2aab2"), 0, y + 0.052, 0));
      sh.add(sb(0.09, 0.02, doorW + 0.02, flat("#3e444a"), 0, y - 0.062, 0));
    }
    sh.add(sb(0.12, 0.1, doorW + 0.06, mat("metal", 1, 1, "#6a727a"), 0, 0.05, 0));   // bottom rail
    sh.add(sb(0.14, 0.03, 0.2, flat("#b8a45c"), 0, 0.05, 0));                          // its grab handle
    sh.position.set(x, doorH + 0.12, doorZ);
    sh.userData.shutter = side;
    R.live(sh);
    out[side] = { mesh: sh, openY: doorH + 0.12, closedY: 0, y: doorH + 0.12 };
  });

  /* the hatch over the duct grate: a steel plate on a slide */
  const hx = 1.9, hy = 2.16, hz = -OFFICE.D / 2 + 0.15;
  const hFixed = new T.Group();
  const hm2 = mat("metal", 1, 1, "#6e767e");
  hFixed.add(sb(1.16, 0.09, 0.1, hm2, 0, 0.36, 0));
  hFixed.add(sb(1.16, 0.09, 0.1, hm2, 0, -0.36, 0));
  for (const sx of [-1, 1]) hFixed.add(sb(0.08, 0.8, 0.1, hm2, sx * 0.54, 0, 0));
  R.place(freeze(hFixed), hx, hy, hz, { shadow: false });

  const plate = new T.Group();
  plate.add(sb(0.98, 0.62, 0.05, mat("metal", 1, 1, "#98a0a8"), 0, 0, 0));
  for (let i = 0; i < 3; i++) plate.add(sb(0.9, 0.035, 0.02, mat("metal", 1, 1, "#767e86"), 0, -0.2 + i * 0.2, 0.034));
  plate.add(sb(0.16, 0.05, 0.06, flat("#b8a45c"), 0.36, 0, 0.05));
  plate.position.set(hx - 1.16, hy, hz);
  plate.userData.shutter = "hatch";
  R.live(plate);
  out.hatch = { mesh: plate, openX: hx - 1.16, closedX: hx, x: hx - 1.16 };

  return out;
}

/* =========================================================
   15. THE MAIN HALL

   Twelve metres of shop floor between the front of the building and
   the office door, and the route Cogsworth walks. It is built long and
   narrow on purpose: the camera sits above the office end, so anything
   coming reads first as a change in one of the pools of light and only
   afterwards as a shape.

   Nothing in here is reused from the office. Different floor, different
   wall, different ceiling, different fittings, different clutter.
   ========================================================= */
const HALL = { W: 5.0, D: 12.0, H: 3.25 };

function buildHall(R) {
  const { W, D, H } = HALL;
  const rnd = R.rnd;
  const wallM = mat("wallCream", 3.2, 1.2, "#9a8f76");
  const floorM = mat("floorCheck", 6, 16, "#9a9084");
  const ceilM = mat("wallCream", 4, 4, "#6e6656");

  R.add(freeze(shell({
    w: W, d: D, h: H,
    floor: floorM, wall: wallM, ceil: ceilM,
    jamb: mat("woodDark", 0.6, 0.6, "#71583c"),
    rail: 1.12,
    openings: {
      /* south end: the office. north end: the foyer arch.
         east wall: the stage and the arcade. */
      s: [{ x: 0.35, w: 1.15, h: 2.15 }],
      n: [{ x: 0, w: 2.4, h: 2.5 }],
      e: [{ x: -2.6, w: 1.5, h: 2.3 }, { x: 2.3, w: 1.4, h: 2.3 }],
    },
    aoFloor: 0.52, aoWall: 0.34,
  })));

  /* --- the runner: a real strip of carpet with a bound edge -------- */
  const runner = new T.Group();
  runner.add(sb(1.5, 0.022, D - 0.6, mat("floorCarpet", 2, 14, "#b07868"), 0, 0.011, 0));
  for (const sx of [-1, 1]) runner.add(sb(0.07, 0.03, D - 0.6, mat("woodDark", 0.4, 10, "#5e4436"), sx * 0.76, 0.015, 0));
  R.place(freeze(runner), -0.15, 0, 0.2, { shadow: false });

  /* --- display cases down the west wall, four different builds ----- */
  const caseZ = [-4.4, -1.9, 1.4, 4.0];
  caseZ.forEach((z, i) => {
    const c = new T.Group();
    const Wc = [1.6, 1.15, 1.9, 1.35][i], Hc = [1.35, 1.6, 1.2, 1.45][i], Dc = 0.55;
    const fm = mat(i % 2 ? "woodDark" : "woodShelf", 1, 1, i % 2 ? "#8a6a46" : "#b08a5c");
    /* plinth, frame, glass, top rail — a case, not a box */
    c.add(sb(Wc, 0.34, Dc, fm, 0, 0.17, 0));
    c.add(sb(Wc + 0.06, 0.05, Dc + 0.06, fm, 0, 0.36, 0));
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      c.add(sb(0.055, Hc - 0.4, 0.055, fm, sx * (Wc / 2 - 0.03), 0.38 + (Hc - 0.4) / 2, sz * (Dc / 2 - 0.03)));
    }
    c.add(sb(Wc + 0.05, 0.09, Dc + 0.05, fm, 0, Hc, 0));
    c.add(sb(Wc - 0.02, 0.03, Dc - 0.02, fm, 0, 0.7, 0));       // the middle shelf
    /* glass: two planes, called what they are */
    const gm = new T.MeshBasicMaterial({ color: new T.Color("#9fc4d8"), transparent: true, opacity: 0.13, side: T.DoubleSide, fog: true });
    c.add(at(new T.Mesh(new T.PlaneGeometry(Wc - 0.1, Hc - 0.45), gm), 0, 0.38 + (Hc - 0.4) / 2, Dc / 2 - 0.02));
    c.add(at(new T.Mesh(new T.PlaneGeometry(Dc - 0.1, Hc - 0.45), gm), Wc / 2 - 0.02, 0.38 + (Hc - 0.4) / 2, 0, 0, Math.PI / 2, 0));
    /* the toys inside, on both shelves, each grounded on the shelf */
    [0.39, 0.72].forEach((sy) => {
      const n = 2 + ((rnd() * 2) | 0);
      for (let k = 0; k < n; k++) {
        const t = KIT.toy((rnd() * 6) | 0, rnd);
        at(t, -Wc / 2 + 0.25 + k * ((Wc - 0.5) / Math.max(1, n - 1)), sy, range(rnd, -0.08, 0.08), 0, range(rnd, 0, TAU), 0);
        const s = contactShadow(t, { y: sy, opacity: 0.42, spread: 0.85 });
        if (s) c.add(s);
        c.add(t);
      }
    });
    /* feet */
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      c.add(sb(0.07, 0.03, 0.07, flat("#2c241c"), sx * (Wc / 2 - 0.06), 0.015, sz * (Dc / 2 - 0.06)));
    }
    R.place(freeze(c), -W / 2 + 0.36, 0, z, { ry: range(rnd, -0.03, 0.03), shadowOpacity: 0.72 });
  });

  /* --- a bench, a fern, a floor sign, a radiator ------------------- */
  const bench = new T.Group();
  const bm = mat("woodShelf", 1.4, 0.5, "#a07c50");
  for (let i = 0; i < 4; i++) bench.add(sb(1.5, 0.045, 0.1, bm, 0, 0.44, -0.18 + i * 0.12));
  for (let i = 0; i < 3; i++) bench.add(sb(1.4, 0.09, 0.035, bm, 0, 0.62 + i * 0.13, -0.24, 0, -0.2));
  for (const sx of [-1, 1]) {
    bench.add(sb(0.07, 0.44, 0.07, bm, sx * 0.66, 0.22, 0.16));
    bench.add(sb(0.07, 0.44, 0.07, bm, sx * 0.66, 0.22, -0.2));
    bench.add(sb(0.07, 0.06, 0.42, bm, sx * 0.66, 0.03, -0.02));
  }
  R.place(freeze(bench), W / 2 - 0.62, 0, 4.5, { ry: -Math.PI / 2 - 0.05, shadowOpacity: 0.72 });

  const fern = new T.Group();
  const potM = mat("enamelRed", 1, 1, "#9a6a56");
  const pot = new T.Mesh(new T.CylinderGeometry(0.2, 0.15, 0.3, 12), potM);
  fern.add(at(pot, 0, 0.15, 0));
  fern.add(at(new T.Mesh(new T.CylinderGeometry(0.215, 0.205, 0.05, 12), potM), 0, 0.29, 0));
  const soil = new T.Mesh(new T.CylinderGeometry(0.18, 0.18, 0.03, 12), flat("#3a2c20"));
  fern.add(at(soil, 0, 0.3, 0));
  for (let i = 0; i < 11; i++) {
    const a = (i / 11) * TAU + rnd() * 0.4;
    const len = range(rnd, 0.3, 0.52);
    const frond = sb(0.055, len, 0.02, flat(i % 2 ? "#41603f" : "#4e7049"), 0, 0, 0);
    const holder = part(Math.cos(a) * 0.05, 0.32, Math.sin(a) * 0.05);
    holder.rotation.set(Math.cos(a) * 0.75, -a, Math.sin(a) * 0.75);
    at(frond, 0, len / 2, 0);
    holder.add(frond);
    fern.add(holder);
  }
  R.place(freeze(fern), W / 2 - 0.5, 0, -4.8, { shadowOpacity: 0.7 });

  const sign = new T.Group();
  const sm = mat("woodDark", 1, 1, "#7a5a3c");
  for (const s of [-1, 1]) {
    sign.add(sb(0.06, 1.0, 0.05, sm, s * 0.24, 0.5, s * 0.08, 0, 0, -s * 0.14));
    sign.add(sb(0.5, 0.62, 0.03, flat("#d4c49c"), s * 0.06, 0.72, s * 0.05, 0, 0, -s * 0.14));
  }
  sign.add(sb(0.52, 0.05, 0.16, sm, 0, 1.04, 0));
  for (let i = 0; i < 4; i++) sign.add(sb(range(rnd, 0.2, 0.36), 0.028, 0.008, flat("#4a3c2c"), -0.02, 0.88 - i * 0.11, 0.062));
  R.place(freeze(sign), -1.35, 0, 0.9, { ry: 0.65, shadowOpacity: 0.6 });

  const rad = new T.Group();
  const rm = mat("enamelCream", 1, 1, "#9a9280");
  for (let i = 0; i < 12; i++) rad.add(sb(0.055, 0.56, 0.11, rm, -0.36 + i * 0.066, 0.35, 0));
  rad.add(sb(0.82, 0.05, 0.13, rm, 0, 0.65, 0));
  rad.add(sb(0.82, 0.05, 0.13, rm, 0, 0.06, 0));
  for (const sx of [-1, 1]) rad.add(at(new T.Mesh(new T.CylinderGeometry(0.02, 0.02, 0.14, 8), flat("#8a8070")), sx * 0.4, 0.12, 0));
  R.place(freeze(rad), W / 2 - 0.16, 0.12, 0.4, { ry: -Math.PI / 2, shadowOpacity: 0.5 });

  /* wall décor, four different ones, none of them at the same height */
  R.place(freeze(KIT.decor(1, rnd)), -W / 2 + 0.09, 2.1, 3.0, { ry: Math.PI / 2, shadow: false });
  R.place(freeze(KIT.decor(0, rnd)),  W / 2 - 0.09, 1.8, -1.0, { ry: -Math.PI / 2, shadow: false });
  R.place(freeze(KIT.decor(3, rnd)),  W / 2 - 0.09, 1.5, 2.2, { ry: -Math.PI / 2, shadow: false });
  R.place(freeze(KIT.decor(0, rnd)), -W / 2 + 0.09, 1.75, -5.2, { ry: Math.PI / 2, shadow: false });
  R.place(freeze(KIT.grate(0, rnd)),  W / 2 - 0.09, 2.6, -3.4, { ry: -Math.PI / 2, shadow: false });

  /* --- what is beyond each opening --------------------------------
     A doorway onto the clear colour is the flattest thing a room can
     do. Each one gets a real recess behind it with its own floor,
     walls and a little of the next room's light, so the hall has
     depth at all four of its exits. */
  function beyond(x, z, ry, tint, floorTex, fill) {
    /* the recess runs away from the doorway along its own -Z, deep
       enough that the back of it falls off into the dark, and it is
       given something to stand in it — a doorway wants a room behind
       it, not a painted panel */
    const b = new T.Group();
    /* the recess is hung so its mouth lands exactly on the outside face
       of the wall it is behind: local +0.6 in Z is the doorway plane. */
    const DEP = 3.8, WID = 3.4;
    const bm = mat("wallGreen", 1.2, 1, tint);
    b.add(sb(WID, 0.12, DEP, mat(floorTex, 4, 4, "#8a8074"), 0, -0.06, -DEP / 2 + 0.6));
    b.add(sb(WID, 2.8, 0.12, bm, 0, 1.4, -DEP + 0.6));
    for (const sx of [-1, 1]) b.add(sb(0.12, 2.8, DEP, bm, sx * WID / 2, 1.4, -DEP / 2 + 0.6));
    b.add(sb(WID, 0.12, DEP, mat("wallCream", 2, 2, "#4e4638"), 0, 2.82, -DEP / 2 + 0.6));
    for (const sx of [-1, 1]) {
      b.add(sb(0.12, 0.13, DEP, mat("woodDark", 1, 0.4, "#54402c"), sx * (WID / 2 - 0.06), 0.065, -DEP / 2 + 0.6));
    }
    if (fill) fill(b);
    R.place(freeze(b), x, 0, z, { ry: ry, shadow: false });
  }
  /* the foyer: the front doors, seen end-on and full of moonlight */
  beyond(0, -D / 2 - 0.68, 0, "#7d8a94", "floorTile", (b) => {
    b.add(sb(2.0, 2.3, 0.14, flat("#20303f"), 0, 1.15, -3.14));
    for (const sx of [-1, 1]) b.add(sb(0.09, 2.3, 0.2, mat("metal", 1, 1, "#5a6068"), sx * 0.98, 1.15, -3.06));
    b.add(sb(2.1, 0.12, 0.22, mat("metal", 1, 1, "#5a6068"), 0, 2.3, -3.06));
    const p = KIT.crate(0, rnd); at(p, -1.2, 0, -2.2, 0, 0.4, 0); b.add(p);
    const ps = contactShadow(p, { y: 0, opacity: 0.6 }); if (ps) b.add(ps);
  });
  /* the stage: the edge of a velvet curtain and a plinth */
  beyond(W / 2 + 0.68, -2.6, -Math.PI / 2, "#8a7a6a", "floorStage", (b) => {
    b.add(sb(0.55, 2.6, 0.34, mat("velvet", 0.5, 1.6, "#8a3040"), -1.15, 1.3, -1.5));
    b.add(sb(0.55, 2.6, 0.34, mat("velvet", 0.5, 1.6, "#7a2a38"), 1.15, 1.3, -1.5));
    b.add(sb(1.2, 0.46, 1.2, mat("woodDark", 1, 1, "#7a5a3c"), 0, 0.23, -1.7));
    b.add(sb(1.32, 0.06, 1.32, mat("woodShelf", 1, 1, "#a07c50"), 0, 0.49, -1.7));
  });
  /* the arcade: two cabinets, one of them still lit */
  beyond(W / 2 + 0.68, 2.3, -Math.PI / 2, "#6f7a86", "floorCarpet", (b) => {
    const c1 = KIT.cabinet(1, rnd); at(c1, -1.05, 0, -1.25, 0, 0.5, 0); b.add(c1);
    const s1 = contactShadow(c1, { y: 0, opacity: 0.6 }); if (s1) b.add(s1);
    const c2 = KIT.cabinet(3, rnd); at(c2, 0.98, 0, -1.7, 0, -0.7, 0); b.add(c2);
    const s2 = contactShadow(c2, { y: 0, opacity: 0.6 }); if (s2) b.add(s2);
    b.add(sb(0.9, 0.1, 0.9, mat("woodDark", 1, 1, "#6a4e34"), 0.1, 0.05, -2.7, 0, 0, 0));
  });
  /* the office: its own doorway light, from the other side */
  beyond(0, D / 2 + 0.68, Math.PI, "#8a8070", "floorOffice", (b) => {
    b.add(sb(2.6, 0.12, 0.6, mat("woodShelf", 2, 1, "#a8825a"), 0, 0.76, -2.6));
    b.add(sb(2.4, 0.72, 0.5, mat("enamelCream", 1, 1, "#8f8674"), 0, 0.36, -2.6));
  });

  /* --- the fittings: four strip lights down the ceiling ------------ */
  const stripZ = [-4.6, -1.6, 1.4, 4.4];
  stripZ.forEach((z, i) => {
    const s = KIT.bulb("strip");
    s.userData.stripIndex = i;
    R.place(freeze(s), -0.1, H - 0.16, z, { shadow: false });
  });

  /* --- lighting: pools, not a wash -------------------------------- */
  R.light({ x: -0.1, y: H - 0.35, z: -4.6, color: "#cfd8e6", intensity: 1.5, distance: 7.5, decay: 1.5, tag: "strip0" });
  R.light({ x: -0.1, y: H - 0.35, z: -1.6, color: "#cfd8e6", intensity: 1.3, distance: 7.0, decay: 1.5, tag: "strip1" });
  R.light({ x: -0.1, y: H - 0.35, z:  1.4, color: "#d8d0c0", intensity: 1.35, distance: 7.0, decay: 1.5, tag: "strip2" });
  R.light({ x: -0.1, y: H - 0.35, z:  4.4, color: "#ffcf9a", intensity: 1.5, distance: 7.0, decay: 1.5, tag: "strip3" });
  R.light({ x: 0, y: 1.9, z: -D / 2 - 1.2, color: "#5f7ec0", intensity: 1.7, distance: 7.5, decay: 1.6, tag: "foyerSpill" });
  R.light({ x: 0.35, y: 1.6, z: D / 2 + 0.6, color: "#ffbe7a", intensity: 1.0, distance: 4.0, decay: 1.6, tag: "officeSpill" });
  R.light({ x: W / 2 + 1.6, y: 1.95, z: -2.6, color: "#e0a05a", intensity: 1.3, distance: 5.4, decay: 1.6, tag: "stageSpill" });
  R.light({ x: W / 2 + 1.55, y: 1.55, z:  2.3, color: "#8ea8c0", intensity: 1.3, distance: 5.4, decay: 1.6, tag: "arcadeSpill" });

  R.mood({
    fog: { color: "#070910", near: 7, far: 32 },
    ambient: { color: "#1e2431", intensity: 0.36 },
  });

  /* the camera lives high in the office end corner, looking up the hall */
  /* The camera hangs on the office-end centre line rather than in a
     corner. A corner mount looked more like a real CCTV bracket, but it
     put the two side doorways at a glancing angle where all you could
     ever see through them was floor — and those doorways are where
     Cogsworth comes from. Down the middle, the hall reads as a hall and
     a shape in it reads as a shape. */
  R.cam("main", [0.05, 2.74, 5.5], [-0.05, 0.86, -5.2], 62);

  /* the stations along Cogsworth's march */
  R.anchor("far",  -0.4, 0, -4.6, 0);
  R.anchor("mid",  -0.1, 0, -0.9, 0);
  R.anchor("near",  0.3, 0,  3.1, 0);
  R.anchor("stageDoor", W / 2 - 0.8, 0, -2.6, -Math.PI / 2);
  R.anchor("arcadeDoor", W / 2 - 0.8, 0, 2.3, -Math.PI / 2);
  R.anchor("foyerArch", 0, 0, -5.4, Math.PI);
}

/* =========================================================
   16. BOOT

   One renderer, one scene, one camera, six lights. Rooms are built at
   their addresses and then left alone; only the one being looked at is
   visible, so the draw call count is a room's worth and not a shop's.
   ========================================================= */
const BUILDERS = {
  office: buildOffice,
  hall:   buildHall,
};

let built = false;
let officeParts = null, officeDoors = null;
let stageEl = null, canvasEl = null;
let pixelCap = 1.5;

function buildWorld(cvs) {
  if (built) return;
  canvasEl = cvs;

  renderer = new T.WebGLRenderer({
    canvas: cvs, antialias: true, alpha: false,
    powerPreference: "high-performance", stencil: false,
  });
  renderer.outputColorSpace = T.SRGBColorSpace;
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.setClearColor(new T.Color("#05060a"), 1);

  scene = new T.Scene();
  scene.fog = new T.Fog(new T.Color("#05060a"), 3, 20);

  view = new T.PerspectiveCamera(70, 16 / 9, 0.06, 70);

  rigAmbient = new T.AmbientLight(new T.Color("#20242e"), 0.5);
  rigAmbient.userData.base = 0.5;
  scene.add(rigAmbient);
  for (let i = 0; i < RIG_N; i++) {
    const l = new T.PointLight(new T.Color("#ffffff"), 0, 9, 1.6);
    l.userData.base = 0;
    scene.add(l);
    rig.push(l);
  }

  buildTextures();

  ROOMS.forEach((r, i) => {
    const rec = makeRoomRecord(r.id, i);
    scene.add(rec.group);
    rec.group.updateMatrixWorld(true);   // so props freeze at the right address
    const api = roomAPI(rec);
    const b = BUILDERS[r.id];
    if (b) rec.parts = b(api) || {};
    rec.group.visible = false;
  });

  /* the office's moving parts are built after its shell so they can sit
     in the doorways the shell cut */
  officeParts = rooms.office.parts;
  officeDoors = buildOfficeDoors(roomAPI(rooms.office));

  built = true;
}

function sizeRenderer() {
  if (!renderer || !stageEl) return;
  const w = stageEl.clientWidth || 960;
  const h = stageEl.clientHeight || 540;
  const dpr = Math.min(window.devicePixelRatio || 1, pixelCap);
  renderer.setPixelRatio(dpr);
  renderer.setSize(w, h, false);
  view.aspect = w / Math.max(1, h);
  view.updateProjectionMatrix();
}

/* only one room is ever visible, so a frame costs one room */
let shownRoom = null;
function showRoom(id) {
  if (shownRoom === id) return;
  if (shownRoom && rooms[shownRoom]) rooms[shownRoom].group.visible = false;
  shownRoom = id;
  if (rooms[id]) rooms[id].group.visible = true;
}

/* --- a still of any room from any of its cameras -------------------
   Used by the offline checks in tools/ to look at the geometry without
   playing a shift. It is also the fastest way to answer "is anything
   floating?", which is the question this build has to keep answering. */
function preview(stage, cvs, roomId, camName) {
  stageEl = stage;
  buildWorld(cvs);
  sizeRenderer();
  showRoom(roomId);
  useView(roomId, camName || "main");
  if (rooms.office && officeDoors) {
    officeDoors.left.mesh.updateMatrixWorld(true);
    officeDoors.right.mesh.updateMatrixWorld(true);
  }
  renderer.render(scene, view);
}

return { preview, __rooms: rooms, __three: () => ({ renderer, scene, view }) };
})();
