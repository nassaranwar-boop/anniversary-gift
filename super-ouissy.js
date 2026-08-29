/* =========================================================================
   SUPER-OUISSY.JS — a platformer, three worlds, one prince at the end

   Ouissy runs, jumps, stomps and collects her way through Sunny Meadows,
   the Twilight Forest and the Castle of Sweethearts. Everything here is
   drawn pixel by pixel onto a 320x180 canvas at runtime — there is not one
   image file in this game — and blown up with image-rendering:pixelated so
   the grid stays honest, exactly like the adventure in script.js.

   The file is laid out in the order you would want to read it:

     1. CUSTOMISE ME     the words, the names, the ending
     2. TUNING           speeds, gravity, jump — every number in one block
     3. DIFFICULTY       Easy / Medium / Hard, as multipliers over TUNING
     4. LEVELS           three character grids + the legend that reads them
     5. PALETTES         one per world
     6. PIXEL HELPERS    px, blob, dither — the same primitives as the site
     7. SPRITES          Ouissy, the enemies, the pickups, the Heartbreaker
     8. WORLD ART        tile atlas + parallax backdrops, baked once per level
     9. THE LEVEL        turning a grid into tiles and entities
    10. PHYSICS          collision, then the player, then everything else
    11. THE GAME LOOP    fixed order: input -> step -> camera -> paint
    12. SCREENS          difficulty select, how-to-play, pause, results
    13. SOUND            Web Audio only; no files, no download
    14. PUBLIC API       SuperOuissy.start() / .stop()

   Public API used by script.js:
     SuperOuissy.start()   difficulty select, then play from World 1
     SuperOuissy.stop()    tear the loop down and silence it
   ========================================================================= */
window.SuperOuissy = (function () {
  "use strict";

  /* =======================================================================
     1. ✏️  CUSTOMISE ME — the only block you need to touch for the words
     ======================================================================= */
  var SO = {
    /* The three worlds, as they appear on the level card and the HUD. */
    worlds: [
      { title: "Sunny Meadows",        card: "where every good morning starts" },
      { title: "Twilight Forest",      card: "the light goes, the path does not" },
      { title: "Castle of Sweethearts", card: "he is at the top of it, waiting" },
    ],

    /* The line under the title on the difficulty screen. */
    tagline: "a quest, three worlds, and a prince at the end",

    /* Shown once, the first time she ever presses play. */
    howTo: [
      ["←  →", "run"],
      ["SPACE / ↑", "jump — hold it longer to jump higher"],
      ["↓", "duck"],
      ["ESC / ❚❚", "pause, and change the difficulty"],
      ["", "land on a critter to bop it. Collect hearts. Find the secrets."],
    ],

    /* The castle scene at the very end. Replace every line of this. */
    ending: {
      kicker: "and there he was —",
      lines: [
        "[Your first line goes here — the one you want her to read first.]",
        "[And the second. Take the whole screen if you want it.]",
        "[Something only the two of you would understand.]",
      ],
      signOff: "— Anwar 💗",
      /* The joke the last castle in Mario always makes, turned around. */
      notAnotherCastle: "and this time, the prince really was in this castle.",
    },
  };

  /* =======================================================================
     2. TUNING — every number that decides how she feels to control.
        Units are pixels and seconds, at the game's own 320x180 scale, so
        one tile is 16 and a comfortable jump clears about three and a half
        of them. Change these first; almost every complaint about a
        platformer is one of these six numbers.
     ======================================================================= */
  var TUNE = {
    tile:        16,
    gravityUp:   800,   // while rising — lower than falling, so the arc floats
    gravityDown: 1150,  // while falling — higher, so she drops with weight
    jumpVel:     300,   // straight up out of a standing jump  (~56px of air)
    jumpCut:     0.42,  // let go early and the rise is cut to this fraction
    runAccel:    900,
    airAccel:    620,
    maxRun:      130,
    friction:    1300,
    airDrag:     260,
    maxFall:     420,
    stompVel:    250,   // the bounce off a defeated enemy
    stompBoost:  330,   // ...if she is still holding jump when she lands
    coyote:      0.10,  // grace after walking off a ledge
    buffer:      0.12,  // grace for pressing jump just before landing
    invuln:      1.5,   // flashing seconds after taking a hit
    enemySpeed:  46,   // below about 40 they advance under a pixel a
    flyerSpeed:  54,   // frame and the movement reads as stepping
    guardSpeed:  62,
    moverSpeed:  36,
    itemWalk:    52,   // how fast a power-up slides off its block
    boostMul:    1.32,  // what the love boost multiplies run speed by
    boostTime:   9,
    starTime:    9,
    scores:      { heart: 100, stomp: 200, block: 50, secret: 500, boss: 3000, timeBonus: 15, lifeBonus: 500 },

    /* ---- the Heartbreaker ------------------------------------------------
       He runs on one loop — WAIT, then TELL, then ATTACK, then OPEN — and
       he can only ever be in one of them. That is the whole design: she
       reads the tell, gets out of the way, and punishes him in the opening.
       Everything below is per phase, and difficulty scales the timings
       only. It never touches `maxShots` or the length of a tell, because
       those are what make him readable, and Hard should be faster, not
       unfair. */
    boss: {
      hitsPerPhase: 2,        // 3 phases, so six stomps in all
      maxShots:     4,        // hard cap. At the cap, nothing new spawns.
      wake:         150,      // how close she gets before he notices her
      phases: [
        { name: "hop",   wait: 1.1, tell: 0.70, attack: 0.9, open: 1.6, shots: 2, speed: 34 },
        { name: "rain",  wait: 0.9, tell: 0.80, attack: 1.0, open: 1.5, shots: 3, speed: 40 },
        { name: "sweep", wait: 0.7, tell: 0.60, attack: 1.1, open: 2.0, shots: 2, speed: 78 },
      ],
      shotSpeed:    82,
      shotLife:     3.2,
    },
  };

  /* =======================================================================
     3. DIFFICULTY — read by every system, so tuning a mode is one line.
        `pitSafety` is the promise made on Easy: falling never kills, a
        cloud catches her and puts her back on the last ground she stood on.
     ======================================================================= */
  var DIFF = {
    easy: {
      label: "Easy", blurb: "5 lives, a soft landing, a ribbon in every world",
      lives: 5, enemyMul: 0.72, gravityMul: 0.92, jumpMul: 1.06,
      coyoteMul: 1.7, bufferMul: 1.6, invulnMul: 1.5,
      pitSafety: true, checkpoints: true, hardOnly: false, mediumUp: false,
      timeLimit: 0, timedPlatform: 1.6, bossSpeedMul: 0.78, bossCooldownMul: 1.35, bossExtraShot: 0,
    },
    medium: {
      label: "Medium", blurb: "3 lives, real pits, the way it is meant to play",
      lives: 3, enemyMul: 1, gravityMul: 1, jumpMul: 1,
      coyoteMul: 1, bufferMul: 1, invulnMul: 1,
      pitSafety: false, checkpoints: true, hardOnly: false, mediumUp: true,
      timeLimit: 0, timedPlatform: 1.1, bossSpeedMul: 1, bossCooldownMul: 1, bossExtraShot: 0,
    },
    hard: {
      label: "Hard", blurb: "2 lives, a clock, more of everything sharp",
      lives: 2, enemyMul: 1.35, gravityMul: 1.08, jumpMul: 0.98,
      coyoteMul: 0.5, bufferMul: 0.5, invulnMul: 0.7,
      pitSafety: false, checkpoints: false, hardOnly: true, mediumUp: true,
      timeLimit: [150, 170, 190], timedPlatform: 0.75, bossSpeedMul: 1.3, bossCooldownMul: 0.72, bossExtraShot: 1,
    },
  };

  /* =======================================================================
     4. LEVELS — each world is a grid of characters, one per 16px tile.

        THE LEGEND (edit the grids freely; anything not listed is empty air)

          .   air                       S   where she starts
          #   solid ground / wall       G   the goal — a heart-topped pole
          -   one-way platform          C   checkpoint ribbon
          B   breakable brick           X   the Heartbreaker (mini-boss)
          ^   spikes                    ~   moat / lava — deadly to touch
          o   a heart to collect

          ?   gift block -> a heart     M   grow (the glow-up)
          I   invincibility sparkle     1   an extra life
          P   love boost (speed)        F   wing feather (double jump)

        M I 1 P F follow one rule: put one in mid-air and it is a gift
        block to be hit from underneath; put one directly on top of ground
        or a platform and it is the item itself, sitting there to be walked
        into. `?` is always a block.

          w   walker                    f   flyer
          g   castle guard              H   platform that slides sideways
          V   platform that rides up    T   platform that blinks out

        Two characters are difficulty-gated, so one grid covers all three
        modes without a second copy of the map:

          ;   a walker that only appears on Medium and Hard
          ,   spikes that only appear on Hard
     ======================================================================= */
  var LEVELS = [
    {
      biome: "meadow",
      rows: [
      "....................................................................................................................................................................................",
      ".....................................................................................................................................ooIo...........................................",
      "............................................................o...o....................................................................----...........................................",
      ".............................................................o.o............................o.of.................................--.................................................",
      "....................................o.o.......................o..............................o......................................................................................",
      "................o...o................o..............................................................................................--....................o...o.....................",
      ".................o.o.?.........o.o.......BMB....o.o.........................................---...............o.o...o.o...?........................;.......o.o..o.o.................",
      "..................o.............o...---..........o..........#####.....................---.........---..........o.....o..........--................######....o....o..................",
      "...........................................................#######...............................................................................########...........................",
      "...S........................w....,....................;...#########.....................................w..,................................w...##########..,........C......G.......",
      "################################################...#######################.######.############################...###...#########################################...#################",
      "################################################...#######################........############################...###...#########################################...#################",
      "################################################...#######################.ooo1oo.############################...###...#########################################...#################",
      "################################################...###########################################################...###...#########################################...#################",
      ],
    },
    {
      biome: "forest",
      rows: [
      "............................................................................................................................................o..o........................................",
      ".................................................................................................................................1...........oo.........................................",
      "......................................................................................................................#.......----------------..........................................",
      "......................................................................................................................#.oooo................----........................................",
      "......................................................................................................................#.----........................;...................................",
      "......................................................................................................................#.................#.........----..................................",
      "......................................................................................................................#.......---.......#...............................................",
      "......................................................................P...............................................#..............f..#...............................................",
      "....................................................................ooooo.............................................#............V....#...............----..o.Mo......................",
      "....................................................................-----.............................................#.................#......................oo.......................",
      ".............................o.f..............................................f.......................................#.......---.......#...............................................",
      "..............................o.................................V.............................o.o.....................#.................#.....................----......................",
      "...........................................o..o.................................--......o.o....o......................#.---.............#...............................................",
      "...............o...o.........---............oo..............--...........................o............................#.....f...........#...............................................",
      "................o.o.?...........................................................................................?.....#.......---.......#...........................----..o..o..........",
      ".................o......---.......---...................--..................--................TT......................#.................#..................................oo...........",
      ".........................................H..............................................TT............................#.---.............#...............................................",
      "...S....,...w.......................................;..,.........................,..w.............................;.....................#...............................C.........G.....",
      "########################################.........#######################################....##....##.#####.###############################################################....##########",
      "########################################.........#######################################....##....##.......B....##########################################################....##########",
      "########################################.........#######################################....##....##.ooooo.B.F.o##########################################################....##########",
      "########################################.........#######################################....##....########################################################################....##########",
      ],
    },
    {
      biome: "castle",
      rows: [
      "............................................................................................................................................................................................................",
      "............................................................................................................................................................................................................",
      ".........................................................................................................................o...o..............................................................................",
      "..........................................................................................................................o.o...................................................#.....................#.....",
      "...........................................................................................................................o....................o.o.............................#.....................#.....",
      "...................................................o..o.....................o..o............o.o..................................................o.f............................#.....................#.....",
      "........................o..o........................oo.......................oo.......o.o....o...........o.o....o.o..........V..................................................#.....................#.....",
      ".........................oo...................................................f........o..................o......o...............................--..................oo.........#.....................#.....",
      "..............o..o.?......................................BIB...............----.................................................M..................................---.........#...--............--..#.....",
      "...............oo........--.............---.......H.........................................TT............--....---.....H....................--......--...H.....................#.....................#.....",
      "......................................................................................TT..............................................................................................................#.....",
      "...S......g.....................^^...,.......g............................g.......,...............C....^^....^^..g..,.................g.^.g.....................;.........C...............X.......G...#.....",
      "########################~~~~######################~~~~~~########.#####.###############~~~###~~~#########################~~~~~~~~##########################~~~~##############################################",
      "########################~~~~######################~~~~~~########.......B...###########~~~###~~~#########################~~~~~~~~##########################~~~~##############################################",
      "########################~~~~######################~~~~~~########.ooooo.B.1.###########~~~###~~~#########################~~~~~~~~##########################~~~~##############################################",
      "########################~~~~######################~~~~~~##############################~~~###~~~#########################~~~~~~~~##########################~~~~##############################################",
      ],
    },
  ];

  /* =======================================================================
     5. PALETTES — one per world. Brighter and more saturated than the rest
        of the site on purpose: the adventure already keeps its own pixel
        palette, and an arcade game wants candy, not parchment.
     ======================================================================= */

  /* Ouissy herself never changes colour, whichever world she is in. */
  var OUI = {
    ink:    "#3d2340",
    skin:   "#ffd9c4", skinSh: "#f0b096",
    hair:   "#5c3352", hairMid: "#7d4770", hairHi: "#a3679a",
    dress:  "#ff9ec4", dressSh: "#df6f9f", dressHi: "#ffc8de",
    blouse: "#fffaf5", blouseSh: "#ffe1ec",
    bow:    "#ff5f95", bowHi: "#ffb0cd",
    boot:   "#6b2f52", bootHi: "#9a4a74",
    blush:  "#ff8fae",
    star:   "#fff0a0",
    crown:  "#ffd166",
  };

  var BIOME = {
    meadow: {
      sky:  [{ p: 0, c: "#8fe3ff" }, { p: .45, c: "#bdf0ff" }, { p: 1, c: "#eafcff" }],
      far:  ["#bff0d8", "#9de0c2", "#7fcaa9"],          // distant hills
      mid:  ["#8ee5a8", "#66cf8a", "#48ab6c"],          // nearer hills + trees
      grass:["#8ff0a8", "#5fd684", "#3fae61", "#2c8347"],
      dirt: ["#f0c48a", "#d69a5c", "#b0783f", "#8a5a2c"],
      brick:["#ffd9a8", "#e8ac6f", "#c1854c"],
      stone:["#e6f2ff", "#c2d8ee", "#9db8d4"],
      cloud:["#ffffff", "#eaf7ff", "#cfe9fb"],
      accent:"#ffe27a",
      hazard:["#7fd8ff", "#4fb6ee"],
    },
    forest: {
      sky:  [{ p: 0, c: "#3b2a63" }, { p: .38, c: "#7a4a86" }, { p: .68, c: "#d1738f" }, { p: 1, c: "#ffb28a" }],
      far:  ["#4a3a72", "#3a2c5c", "#2d2148"],
      mid:  ["#38566a", "#2b4354", "#1f3240"],
      grass:["#a8f0c0", "#5cc08c", "#31805c", "#1e5a3e"],
      dirt: ["#a97fbe", "#7d5590", "#5c3d6c", "#412a4e"],
      brick:["#c9a6dd", "#9a76b0", "#6f5183"],
      stone:["#d8cff0", "#ab9fcc", "#8074a6"],
      cloud:["#ffd3c0", "#f0aebb", "#c98ba6"],
      accent:"#ffe8a0",
      hazard:["#8fe0ff", "#57b2e0"],
    },
    castle: {
      sky:  [{ p: 0, c: "#1e1233" }, { p: .42, c: "#3d1c46" }, { p: .78, c: "#7a2450" }, { p: 1, c: "#c03a63" }],
      far:  ["#3a2350", "#2c1a3e", "#1f1230"],
      mid:  ["#5a3a68", "#452c52", "#32203c"],
      grass:["#ffe0b0", "#e0b489", "#a87f68", "#7a5a52"],   // lit flagstone edge
      dirt: ["#8f6fa8", "#6b4f80", "#4d375e", "#332444"],
      brick:["#b58fce", "#8a68a4", "#63487a"],
      stone:["#e0cff0", "#b09ad0", "#8574a8"],
      cloud:["#ff9ec0", "#e0729c", "#b04f78"],
      accent:"#ffcf6a",
      hazard:["#ff8fb8", "#ff4d7d", "#d42a5c"],
    },
  };

  /* =======================================================================
     6. PIXEL HELPERS — the same primitives the rest of the site draws with,
        kept local so this file has no load-order dependency on script.js.
     ======================================================================= */
  var BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];

  function px(c, x, y, w, h, col) {
    c.fillStyle = col;
    c.fillRect(x | 0, y | 0, Math.max(1, w | 0), Math.max(1, h | 0));
  }

  /* Vertical ordered-dither gradient — pixel art's honest sky. */
  function ditherSky(c, x0, y0, w, h, stops) {
    for (var y = 0; y < h; y++) {
      var t = y / (h - 1 || 1), i = 0;
      while (i < stops.length - 2 && t > stops[i + 1].p) i++;
      var a = stops[i], b = stops[i + 1];
      var lt = (t - a.p) / ((b.p - a.p) || 1);
      for (var x = 0; x < w; x++) {
        c.fillStyle = lt > (BAYER[y & 3][x & 3] + 0.5) / 16 ? b.c : a.c;
        c.fillRect(x0 + x, y0 + y, 1, 1);
      }
    }
  }

  /* A shaded ellipse: the building block of every soft form here. */
  function blob(c, cx, cy, rx, ry, tones, lx, ly) {
    lx = lx === undefined ? -0.5 : lx; ly = ly === undefined ? -0.6 : ly;
    for (var y = -ry; y <= ry; y++) {
      for (var x = -rx; x <= rx; x++) {
        var d = (x * x) / (rx * rx) + (y * y) / (ry * ry);
        if (d > 1) continue;
        var lit = (x / rx) * lx + (y / ry) * ly;
        var idx = lit > 0.34 ? 0 : lit > -0.05 ? 1 : lit > -0.5 ? 2 : 3;
        c.fillStyle = tones[Math.min(idx, tones.length - 1)];
        c.fillRect((cx + x) | 0, (cy + y) | 0, 1, 1);
      }
    }
  }

  /* A filled ellipse in one flat colour — used for outlines under blobs. */
  function oval(c, cx, cy, rx, ry, col) {
    for (var y = -ry; y <= ry; y++)
      for (var x = -rx; x <= rx; x++)
        if ((x * x) / (rx * rx) + (y * y) / (ry * ry) <= 1) px(c, cx + x, cy + y, 1, 1, col);
  }

  /* A heart, the shape this whole game is made of.

     The classic implicit curve (u^2+v^2-1)^3 - u^2 v^3 <= 0, sampled on the
     pixel grid. `r` is the half-width; the shape is 1.13r either side, runs
     from v=-1 (the point, at the bottom) to v=1.25 at the lobes, and dips to
     v=1 in the middle, which is the cleft. Anything less faithful than this
     reads as a blob at 8px. */
  function heart(c, cx, cy, r, col, hi) {
    var s = r / 1.13;
    var yTop = Math.ceil(s * 1.3), yBot = Math.ceil(s), xw = Math.ceil(r) + 1;
    for (var y = -yTop; y <= yBot; y++) {
      for (var x = -xw; x <= xw; x++) {
        var u = x / s, v = -y / s;
        var t = u * u + v * v - 1;
        if (t * t * t - u * u * v * v * v <= 0) px(c, cx + x, cy + y, 1, 1, col);
      }
    }
    if (hi && r >= 2.5) {
      /* the little shine on the upper left lobe */
      px(c, Math.round(cx - r * 0.5), Math.round(cy - s * 0.5), 1, 1, hi);
      px(c, Math.round(cx - r * 0.5) + 1, Math.round(cy - s * 0.5), 1, 1, hi);
      px(c, Math.round(cx - r * 0.5), Math.round(cy - s * 0.5) + 1, 1, 1, hi);
    }
  }

  /* A leafy mass: several overlapping blobs rather than one, then speckles
     on the lit side. One blob on its own gives that hard diagonal band that
     makes pixel foliage look like a plastic bead. */
  function canopy(c, cx, cy, r, tones, rnd, speckle) {
    var puffs = 5 + Math.floor(rnd() * 3);
    for (var i = 0; i < puffs; i++) {
      var a = (i / puffs) * Math.PI * 2 + rnd() * 0.6;
      blob(c, cx + Math.cos(a) * r * 0.46, cy + Math.sin(a) * r * 0.32,
           r * (0.52 + rnd() * 0.2), r * (0.42 + rnd() * 0.16), tones);
    }
    blob(c, cx, cy, r * 0.78, r * 0.6, tones);
    if (speckle) {
      for (var k = 0; k < r * 1.8; k++) {
        var an = rnd() * Math.PI * 2, rr = rnd() * r * 0.8;
        px(c, cx + Math.cos(an) * rr, cy + Math.sin(an) * rr * 0.7 - r * 0.15, 1, 1, speckle);
      }
    }
  }

  function spriteCanvas(w, h) {
    var c = document.createElement("canvas");
    c.width = w; c.height = h;
    var ctx = c.getContext("2d");
    ctx.imageSmoothingEnabled = false;
    return { c: c, ctx: ctx };
  }

  /* A moon: shaded by distance from the light rather than by a flat linear
     ramp, and dithered between tones, so it reads round instead of striped. */
  function moon(c, cx, cy, r, tones, craters) {
    for (var y = -r; y <= r; y++) {
      for (var x = -r; x <= r; x++) {
        if (x * x + y * y > r * r) continue;
        /* how far this pixel is from the lit point, over the disc */
        var d = Math.sqrt(Math.pow(x + r * 0.5, 2) + Math.pow(y + r * 0.5, 2)) / (r * 2.1);
        var f = Math.pow(clamp(d, 0, 1), 1.4) * (tones.length - 1);
        var i = Math.floor(f), frac = f - i;
        /* only dither near a boundary; the middle of a band stays flat */
        if (frac > 0.72 || (frac > 0.4 && frac > (BAYER[(cy + y) & 3][(cx + x) & 3] + 0.5) / 16)) i++;
        px(c, cx + x, cy + y, 1, 1, tones[clamp(i, 0, tones.length - 1)]);
      }
    }
    (craters || []).forEach(function (k) {
      for (var y2 = -k[2]; y2 <= k[2]; y2++)
        for (var x2 = -k[2]; x2 <= k[2]; x2++) {
          if (x2 * x2 + y2 * y2 > k[2] * k[2]) continue;
          px(c, cx + k[0] + x2, cy + k[1] + y2, 1, 1, tones[Math.min(tones.length - 1, 2)]);
        }
      px(c, cx + k[0] - k[2], cy + k[1] - k[2], k[2], 1, tones[1]);
    });
  }

  /* deterministic little RNG so a level looks the same every time */
  function seeded(str) {
    var h = 1779033703 ^ str.length;
    for (var i = 0; i < str.length; i++) {
      h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
      h = (h << 13) | (h >>> 19);
    }
    return function () {
      h = Math.imul(h ^ (h >>> 16), 2246822507);
      h = Math.imul(h ^ (h >>> 13), 3266489909);
      return ((h ^= h >>> 16) >>> 0) / 4294967296;
    };
  }

  var clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };

  /* =======================================================================
     7. SPRITES — Ouissy first, then everything that gets in her way.

        Ouissy is built out of parts rather than a fixed pixel map, so a
        frame is only a set of offsets: the head bobs, the skirt swings,
        the arms swing against the legs. That is what makes the run read
        as a run instead of two pictures swapping.
     ======================================================================= */

  /* Ouissy, authored pixel by pixel — one character per pixel. Sixteen
     wide, eighteen tall, deliberately chibi: at this size the head has
     to carry the whole character or there is no face at all.

     Edit these strings and she changes. Keep every row sixteen long.

       .  nothing      K  ink          H  hair dark   h  hair mid
       i  hair shine   S  skin         B  blush       E  eye
       W  eye white    w  blouse       D  dress       d  dress shade
       L  dress shine  R  ribbon       r  ribbon lit  O  boot
       o  boot shine   Y  crown gold                                */
  var OUI_HEAD = [
      ".....KKKKKK.....",
      "...KKhhhhhhKK...",
      "..KhhiihhhhiihK.",
      ".KhhSSSSSSSShhK.",
      "RRKhSSSSSSSShKRR",
      "rRKhWESSSSWEhKRr",
      ".HKhEESSSSEEhKH.",
      ".HKhBSSSSSSBhKH.",
      ".HKhSSSKKSSShKH.",
      ".HHKhSSSSSShKHH."
  ];
  var OUI_BODY = [
      ".HH.KwwwwwwK.HH.",
      ".HH.KwDDDDwK.HH.",
      "..KSKDDDDDDKSK..",
      "..KSKDDDDDDKSK..",
      ".KLDDDDDDDDDDdK.",
      ".KdDDDDDDDDDDDK."
  ];
  var OUI_LEGS = {
    stand: ["....SS....SS....", "...OooO..OooO..."],
    runA: ["...SS......SS...", "..OooO....OooO.."],
    runB: ["....SSS..SS.....", "...OooO..OooO..."],
    runC: ["...SS......SS...", "..OooO....OooO.."],
    jump: ["....SS..SS......", "...OooO.OooO...."],
    fall: ["...SS......SS...", "..OooO....OooO.."],
  };
  /* rows swapped in for a particular pose */
  var OUI_ALT = {
    blinkEyes: "rRKhSSSSSSSShKRr",
    smile: ".HKhSSKKKKSShKH.",
    ouch: ".HKhSSKSSKSShKH.",
    crownA: "....Y..Y..Y.....",
    crownB: "...KYYYYYYYYK...",
    hemL: "KdDDDDDDDDDDDK..",
    hemR: "..KdDDDDDDDDDDDK",
    duckHem: ".KLDDDDDDDDDDdK.",
    duckBoots: "..OooO....OooO..",
  };

  /* which colour each character stands for */
  var OUI_MAP = {
    K: OUI.ink, H: OUI.hair, h: OUI.hairMid, i: OUI.hairHi,
    S: OUI.skin, s: OUI.skinSh, B: OUI.blush, E: OUI.ink, W: "#ffffff",
    w: OUI.blouse, D: OUI.dress, d: OUI.dressSh, L: OUI.dressHi,
    R: OUI.bow, r: OUI.bowHi, O: OUI.boot, o: OUI.bootHi, Y: OUI.crown,
  };

  /* paint one row of a map at (x, y), skipping the transparent character */
  function mapRow(c, row, x, y, swap) {
    for (var i = 0; i < row.length; i++) {
      var ch = row.charAt(i);
      if (ch === ".") continue;
      var col = (swap && swap[ch]) || OUI_MAP[ch];
      if (col) px(c, x + i, y, 1, 1, col);
    }
  }

  /* --- one Ouissy frame ------------------------------------------------
     pose: idle | run | jump | fall | duck | hurt | win
     k:    the frame index inside that pose
     big:  the glow-up — a crown, and a longer skirt

     Big Ouissy is the same maps with the skirt stretched by repeating one
     of its rows, so there is only ever one drawing of her to keep in step.
     ---------------------------------------------------------------- */
  function paintOuissy(pose, k, big) {
    var stretch = big ? 5 : 0;
    var crownH = big ? 2 : 0;
    var W = 16, H = 18 + stretch + crownH;
    var s = spriteCanvas(W, H), c = s.ctx;

    /* the breath on idle, the bounce on the run */
    var bob = pose === "run" ? [0, 1, 0, 1][k % 4] : pose === "idle" && k === 1 ? 1 : 0;
    var y = crownH + bob;
    var shut = pose === "hurt" || (pose === "idle" && k === 3);
    var happy = pose === "win" || pose === "jump";

    /* ---- the crown, only on the glow-up -------------------------------- */
    if (big) {
      mapRow(c, OUI_ALT.crownA, 0, bob);
      mapRow(c, OUI_ALT.crownB, 0, bob + 1);
    }

    /* ---- the head ------------------------------------------------------- */
    for (var r = 0; r < OUI_HEAD.length; r++) {
      var row = OUI_HEAD[r];
      if (r === 6 && shut) row = OUI_ALT.blinkEyes;
      if (r === 9) row = happy ? OUI_ALT.smile : pose === "hurt" ? OUI_ALT.ouch : row;
      mapRow(c, row, 0, y + r);
      /* the tails swing behind her — only the outer three columns move, so
         her face never slides out from under her own hair */
      if (r >= 6) {
        var sw = pose === "run" ? [0, -1, 0, 1][k % 4] : pose === "jump" ? -1 : pose === "fall" ? 1 : 0;
        if (sw) {
          c.clearRect(0, y + r, 3, 1);
          c.clearRect(13, y + r, 3, 1);
          mapRow(c, row.slice(0, 3), sw, y + r);
          mapRow(c, row.slice(13), 13 + sw, y + r);
        }
      }
    }
    y += OUI_HEAD.length;

    /* ---- crouched: collar, a squashed hem, boots, and that is all ------- */
    if (pose === "duck") {
      mapRow(c, OUI_BODY[0], 0, y);
      mapRow(c, OUI_ALT.duckHem, 0, y + 1);
      mapRow(c, OUI_ALT.duckBoots, 0, y + 2);
      return s.c;
    }

    /* ---- the dress; row 3 repeats to make the glow-up taller ------------ */
    for (var b = 0; b < OUI_BODY.length; b++) {
      mapRow(c, OUI_BODY[b], 0, y); y++;
      if (big && b === 4) for (var e = 0; e < stretch; e++) { mapRow(c, OUI_BODY[3], 0, y); y++; }
    }
    /* the hem swings a pixel with the stride */
    if (pose === "run") {
      var sway = [0, 1, 0, -1][k % 4];
      if (sway > 0) mapRow(c, OUI_ALT.hemR, 0, y - 1);
      else if (sway < 0) mapRow(c, OUI_ALT.hemL, 0, y - 1);
    }

    /* ---- legs ------------------------------------------------------------ */
    var set = pose === "run" ? ["stand", "runA", "runB", "runC"][k % 4]
            : pose === "jump" ? "jump"
            : (pose === "fall" || pose === "win") ? "fall" : "stand";
    mapRow(c, OUI_LEGS[set][0], 0, y);
    mapRow(c, OUI_LEGS[set][1], 0, y + 1);
    return s.c;
  }

  /* Every frame Ouissy will ever need, baked once at load. */
  var OUISSY = {};
  (function bakeOuissy() {
    ["idle", "run", "jump", "fall", "duck", "hurt", "win"].forEach(function (pose) {
      var n = pose === "run" ? 4 : pose === "idle" ? 4 : 1;
      OUISSY[pose] = { small: [], big: [] };
      for (var k = 0; k < n; k++) {
        OUISSY[pose].small.push(paintOuissy(pose, k, false));
        OUISSY[pose].big.push(paintOuissy(pose, k, true));
      }
    });
  })();
  /* --- the walker: a grumpy little cloud that will not move out of the way */
  function paintWalker(k, squashed) {
    var s = spriteCanvas(16, 14), c = s.ctx;
    var K = "#3d2340";
    if (squashed) {                      // the pancake, for one beat after a stomp
      px(c, 2, 10, 12, 1, K);
      blob(c, 8, 12, 6, 2, ["#ffffff", "#e6e8f5", "#c4c8de", "#a6abc6"]);
      px(c, 4, 11, 2, 1, K); px(c, 10, 11, 2, 1, K);
      return s.c;
    }
    var bob = k ? 1 : 0;
    blob(c, 8, 6 + bob, 6, 4, ["#ffffff", "#eef1fb", "#ccd2e8", "#adb4d0"]);
    blob(c, 4, 8 + bob, 3.4, 2.6, ["#ffffff", "#eef1fb", "#ccd2e8", "#adb4d0"]);
    blob(c, 12, 8 + bob, 3.4, 2.6, ["#ffffff", "#eef1fb", "#ccd2e8", "#adb4d0"]);
    px(c, 2, 10 + bob, 12, 1, "#c4cae0");                    // the flat underside
    /* a face that is cross rather than frightening */
    px(c, 5, 6 + bob, 2, 2, K); px(c, 9, 6 + bob, 2, 2, K);
    px(c, 5, 5 + bob, 3, 1, K); px(c, 9, 5 + bob, 3, 1, K);   // the frown of the brows
    px(c, 6, 9 + bob, 4, 1, K);
    px(c, 3, 8 + bob, 2, 1, "#ffb0c8"); px(c, 11, 8 + bob, 2, 1, "#ffb0c8");
    /* two little feet, out of step with each other */
    px(c, 4 + (k ? 1 : 0), 12, 3, 2, "#8ea0c8");
    px(c, 9 - (k ? 1 : 0), 12, 3, 2, "#8ea0c8");
    return s.c;
  }

  /* --- the flyer: a heart with wings, which is only cute until it is level
         with your head */
  function paintFlyer(k) {
    var s = spriteCanvas(18, 14), c = s.ctx;
    var K = "#3d2340", up = k < 2;
    var wy = up ? 3 : 7;
    for (var w = 0; w < 2; w++) {
      var d = w ? 1 : -1;
      for (var i = 0; i < 5; i++) {
        px(c, 9 + d * (4 + i), wy + (up ? i : -i) * 0.6, 2, 3 - (i > 2 ? 1 : 0), i < 2 ? "#ffffff" : "#ffe6f2");
        px(c, 9 + d * (4 + i), wy + (up ? i : -i) * 0.6, 1, 1, "#ffd0e6");
      }
    }
    heart(c, 9, 8, 4.6, K);
    heart(c, 9, 8, 3.8, "#ff6f9e", "#ffc0d8");
    px(c, 7, 7, 1, 2, K); px(c, 10, 7, 1, 2, K);
    px(c, 8, 10, 3, 1, K);
    return s.c;
  }

  /* --- the castle guard: a thistle in armour, faster and grumpier */
  function paintGuard(k) {
    var s = spriteCanvas(16, 16), c = s.ctx;
    var K = "#3d2340", step = k ? 1 : 0;
    px(c, 4, 14 - step, 3, 2, "#5c4470"); px(c, 9, 14 + step - 1, 3, 2, "#5c4470");
    oval(c, 8, 8, 5, 5, K);
    blob(c, 8, 8, 4, 4, ["#e2c9f2", "#b79ad4", "#8f74ae", "#6c5488"]);
    /* the helmet, with a heart-shaped visor slot */
    px(c, 3, 4, 10, 3, "#8f74ae"); px(c, 3, 4, 10, 1, "#d6bff0");
    px(c, 5, 7, 6, 2, K);
    px(c, 6, 7, 1, 1, "#ff6f9e"); px(c, 9, 7, 1, 1, "#ff6f9e");
    /* the plume */
    px(c, 7, 1, 2, 3, "#ff6f9e"); px(c, 6, 2, 1, 2, "#ff9ec4"); px(c, 9, 2, 1, 2, "#ff9ec4");
    /* thorns down the back */
    for (var i = 0; i < 3; i++) px(c, 13, 8 + i * 2, 2, 1, "#6c5488");
    return s.c;
  }

  /* --- the Heartbreaker: a cracked heart in a crown, three stomps deep --- */
  function paintBoss(k, hurtFlash) {
    var s = spriteCanvas(40, 34), c = s.ctx;
    var K = "#3d2340";
    var body = hurtFlash ? "#ffffff" : "#e0426e";
    var hi   = hurtFlash ? "#ffffff" : "#ff7ba0";
    var sh   = hurtFlash ? "#e8e8f0" : "#a52a4e";
    var squat = k === 1 ? 2 : 0;                   // he crouches before he hops
    heart(c, 20, 20 + squat, 15, K);
    heart(c, 20, 20 + squat, 13.4, body, null);
    /* three tones so he is not a flat shape */
    for (var y = -12; y < 12; y++)
      for (var x = -13; x < 0; x++) {
        var f = (x + 13) / 13;
        if (f < 0.35 && ((BAYER[(y + 20) & 3][(x + 20) & 3] + .5) / 16) > f * 2.2)
          px(c, 20 + x, 20 + y + squat, 1, 1, hi);
      }
    for (var y2 = 2; y2 < 14; y2++)
      for (var x2 = 2; x2 < 13; x2++)
        if (((x2 * x2 + y2 * y2) < 190) && ((BAYER[y2 & 3][x2 & 3] + .5) / 16) < .5)
          px(c, 20 + x2, 20 + y2 + squat, 1, 1, sh);
    /* the crack down the middle — it opens a little with every hit */
    var crack = 1 + (k === 2 ? 1 : 0);
    for (var cy = -8; cy < 12; cy++)
      px(c, 20 + Math.round(Math.sin(cy * 0.8) * 2), 20 + cy + squat, crack, 1, "#5c1730");
    /* the crown */
    px(c, 12, 4 + squat, 17, 3, K);
    px(c, 13, 5 + squat, 15, 2, OUI.crown);
    px(c, 13, 2 + squat, 2, 3, OUI.crown); px(c, 20, 0 + squat, 2, 4, OUI.crown);
    px(c, 26, 2 + squat, 2, 3, OUI.crown);
    px(c, 20, 5 + squat, 1, 1, "#ff6f9e");
    /* the face */
    px(c, 13, 15 + squat, 3, 4, K); px(c, 24, 15 + squat, 3, 4, K);
    px(c, 13, 14 + squat, 4, 1, K); px(c, 23, 14 + squat, 4, 1, K);
    px(c, 14, 15 + squat, 1, 1, "#ffffff"); px(c, 25, 15 + squat, 1, 1, "#ffffff");
    px(c, 16, 24 + squat, 8, 2, K);
    px(c, 17, 23 + squat, 2, 1, K); px(c, 21, 23 + squat, 2, 1, K);
    return s.c;
  }

  /* --- the pickups ----------------------------------------------------- */
  function paintHeartPickup(k) {
    var s = spriteCanvas(12, 12), c = s.ctx;
    var r = 4.2 + (k === 1 ? 0.5 : k === 3 ? -0.4 : 0);
    heart(c, 6, 6, r + 0.9, "#3d2340");
    heart(c, 6, 6, r, "#ff5f95", "#ffd6e6");
    if (k === 1) { px(c, 2, 2, 1, 1, "#fff6c0"); px(c, 9, 3, 1, 1, "#fff6c0"); }
    return s.c;
  }

  /* Every power-up shares a frame so they read as a set. */
  function paintPower(kind, k) {
    var s = spriteCanvas(14, 14), c = s.ctx;
    var K = "#3d2340", pop = k === 1 ? 1 : 0;
    if (kind === "grow") {                       // a heart-shaped sweet
      heart(c, 7, 8 - pop, 5.6, K);
      heart(c, 7, 8 - pop, 4.8, "#ff9ec4", "#ffe6f2");
      px(c, 4, 6 - pop, 6, 1, "#fffaf5"); px(c, 5, 9 - pop, 4, 1, "#ffd6e6");
      px(c, 6, 1 - pop, 2, 3, "#8c4569");        // the little wrapper twist
    } else if (kind === "star") {                // the sparkle that makes her safe
      var pts = [[7, 0], [8, 5], [13, 6], [9, 9], [11, 14], [7, 11], [3, 14], [5, 9], [1, 6], [6, 5]];
      c.fillStyle = K; c.beginPath();
      pts.forEach(function (p, i) { i ? c.lineTo(p[0], p[1] - pop) : c.moveTo(p[0], p[1] - pop); });
      c.closePath(); c.fill();
      c.fillStyle = k % 2 ? "#fff6a8" : "#ffe27a"; c.beginPath();
      pts.forEach(function (p, i) {
        var x = 7 + (p[0] - 7) * 0.74, y = 7 + (p[1] - 7) * 0.74 - pop;
        i ? c.lineTo(x, y) : c.moveTo(x, y);
      });
      c.closePath(); c.fill();
      px(c, 6, 5 - pop, 2, 2, "#ffffff");
    } else if (kind === "life") {                // a second chance
      heart(c, 7, 7 - pop, 6, K);
      heart(c, 7, 7 - pop, 5.2, "#6fd08a", "#c8f4d8");
      /* a small "1" stamped on it — a letter U is what you get if you try
         to fit "1UP" into nine pixels */
      px(c, 7, 4 - pop, 1, 6, "#ffffff");
      px(c, 6, 5 - pop, 1, 1, "#ffffff");
      px(c, 5, 10 - pop, 5, 1, "#ffffff");
    } else if (kind === "boost") {               // the love boost
      heart(c, 8, 8 - pop, 4.4, K);
      heart(c, 8, 8 - pop, 3.6, "#ff6f4d", "#ffc9a8");
      for (var i = 0; i < 3; i++) px(c, 0, 4 + i * 3 - pop, 4 - i, 1, "#ffd166");
    } else {                                     // the wing feather
      px(c, 7, 2 - pop, 1, 10, "#c9b48e");
      for (var w = 0; w < 9; w++) {
        var ww = 4 - Math.abs(w - 4) * 0.5;
        px(c, 7 - ww, 3 + w - pop, ww, 1, "#ffffff");
        px(c, 8, 3 + w - pop, ww, 1, "#e6ecff");
      }
      px(c, 6, 1 - pop, 3, 1, "#ffd6e6");
    }
    return s.c;
  }

  /* Every sprite the game will ever draw, baked once. */
  var ART = {
    walker: [paintWalker(0), paintWalker(1)],
    walkerSquash: paintWalker(0, true),
    flyer: [paintFlyer(0), paintFlyer(1), paintFlyer(2), paintFlyer(3)],
    guard: [paintGuard(0), paintGuard(1)],
    boss: [paintBoss(0), paintBoss(1), paintBoss(2)],
    bossHurt: [paintBoss(0, true), paintBoss(1, true), paintBoss(2, true)],
    heart: [paintHeartPickup(0), paintHeartPickup(1), paintHeartPickup(2), paintHeartPickup(3)],
    power: {
      grow: [paintPower("grow", 0), paintPower("grow", 1)],
      star: [paintPower("star", 0), paintPower("star", 1)],
      life: [paintPower("life", 0), paintPower("life", 1)],
      boost: [paintPower("boost", 0), paintPower("boost", 1)],
      wing: [paintPower("wing", 0), paintPower("wing", 1)],
    },
  };

  /* =======================================================================
     8. WORLD ART — the tile atlas and the parallax backdrops.

        Both are painted once when a level loads and then only blitted, so
        a frame costs almost nothing however busy the screen looks. The
        atlas is a strip of 16x16 cells; `TILE_INDEX` says which cell each
        legend character uses.
     ======================================================================= */
  var T = TUNE.tile;

  /* How much of the world fits on screen. The height never changes, so the
     backdrops and everything that reasons about camera Y stay as they are;
     only the width narrows. On a portrait phone a 16:9 letterbox leaves her
     with a stamp of a game in the middle of a tall screen, so there we show
     less world and show it bigger — which is the right trade on a small
     screen anyway. */
  var VIEW = { w: 320, h: 180 };

  function pickView() {
    var portrait = window.innerHeight > window.innerWidth * 1.2;
    var narrow = window.innerWidth < 620;
    VIEW.w = (portrait && narrow) ? 240 : 320;
    var cv = $("so-canvas");
    if (cv && cv.width !== VIEW.w) { cv.width = VIEW.w; cv.height = VIEW.h; }
    var st = $("so-stage");
    if (st) {
      st.style.aspectRatio = VIEW.w + " / " + VIEW.h;
      st.style.setProperty("--so-arn", (VIEW.w / VIEW.h).toFixed(4));
    }
    if (G) G.camSnap = true;
  }

  /* The atlas is a strip of 16x16 cells. Ground is three cells deep on
     purpose — surface, subsoil, bedrock — because a wall of one repeated
     tile is the fastest way to make a platformer look cheap. */
  var CELL = { body: 0, oneWay: 1, brick: 2, gift: 3, spike: 4, moat: 5, top: 6, used: 7, deep: 8 };

  function buildAtlas(biome) {
    var P = BIOME[biome];
    var s = spriteCanvas(T * 9, T), c = s.ctx;
    var rnd = seeded("atlas" + biome);

    /* --- 0. subsoil. No lit top or dark bottom edge, so a column of these
             reads as one mass instead of a stack of bricks. --- */
    px(c, 0, 0, T, T, P.dirt[1]);
    for (var i = 0; i < 40; i++) {
      var gx = (rnd() * T) | 0, gy = (rnd() * T) | 0;
      px(c, gx, gy, 1, 1, rnd() > .45 ? P.dirt[2] : P.dirt[0]);
    }
    /* two little stones, lit from above like everything else here */
    for (var st = 0; st < 2; st++) {
      var sx = 2 + (rnd() * (T - 6)) | 0, sy = 3 + (rnd() * (T - 7)) | 0;
      px(c, sx, sy, 3, 2, P.dirt[3]);
      px(c, sx, sy, 3, 1, P.dirt[2]);
    }

    /* --- 8. bedrock: the same, darker and coarser, for anything more than
             a tile below the surface --- */
    c.drawImage(s.c, 0, 0, T, T, T * 8, 0, T, T);
    c.save(); c.globalAlpha = .42; px(c, T * 8, 0, T, T, "#2a1630"); c.restore();
    for (var b2 = 0; b2 < 8; b2++)
      px(c, T * 8 + ((rnd() * T) | 0), (rnd() * T) | 0, 2, 1, P.dirt[3]);

    /* --- 6. the surface: subsoil with a grass crown, blades and all --- */
    c.drawImage(s.c, 0, 0, T, T, T * 6, 0, T, T);
    px(c, T * 6, 0, T, 4, P.grass[1]);
    px(c, T * 6, 0, T, 1, P.grass[0]);
    px(c, T * 6, 4, T, 1, P.grass[2]);
    for (var g = 0; g < T; g++) {
      var blade = ((g * 7 + 3) % 5);
      if (blade < 2) px(c, T * 6 + g, 5, 1, 1 + blade, P.grass[2]);
      if (blade === 3) px(c, T * 6 + g, 0, 1, 1, P.grass[0]);
      if (blade === 4) px(c, T * 6 + g, 1, 1, 2, P.grass[3] || P.grass[2]);
    }

    /* --- 1. the one-way ledge: thin, with a lip, so it reads as something
             you can pass through from below --- */
    px(c, T, 2, T, 5, P.brick[1]);
    px(c, T, 2, T, 1, P.brick[0]);
    px(c, T, 6, T, 1, P.brick[2]);
    for (var v = 1; v < T; v += 4) px(c, T + v, 3, 1, 3, P.brick[2]);
    px(c, T, 7, 3, 1, P.brick[2]); px(c, T + T - 3, 7, 3, 1, P.brick[2]);

    /* --- 2. breakable brick --- */
    px(c, T * 2, 0, T, T, P.brick[1]);
    px(c, T * 2, 0, T, 1, P.brick[0]);
    px(c, T * 2, T - 1, T, 1, P.brick[2]);
    px(c, T * 2, T / 2 - 1, T, 1, P.brick[2]);
    px(c, T * 2 + T / 2, 0, 1, T / 2, P.brick[2]);
    px(c, T * 2 + T / 4, T / 2, 1, T / 2, P.brick[2]);
    px(c, T * 2 + T * 3 / 4, T / 2, 1, T / 2, P.brick[2]);
    px(c, T * 2 + 1, 1, T - 2, 1, P.brick[0]);

    /* --- 3. the gift block, a heart stamped on gold --- */
    px(c, T * 3, 0, T, T, "#ffcf6a");
    px(c, T * 3, 0, T, 1, "#ffeaa8"); px(c, T * 3, T - 1, T, 1, "#c98f36");
    px(c, T * 3, 0, 1, T, "#ffeaa8"); px(c, T * 3 + T - 1, 0, 1, T, "#c98f36");
    px(c, T * 3 + 1, 1, 2, 2, "#fff6d0"); px(c, T * 3 + T - 3, T - 3, 2, 2, "#a9741f");
    heart(c, T * 3 + T / 2, T / 2 + 1, 4.4, "#e0426e", "#ffc0d8");

    /* --- 7. a gift block already opened --- */
    px(c, T * 7, 0, T, T, "#b98d4e");
    px(c, T * 7, 0, T, 1, "#d3a86a"); px(c, T * 7, T - 1, T, 1, "#8a6432");
    px(c, T * 7 + 3, 3, T - 6, T - 6, "#9d7440");
    px(c, T * 7 + 3, 3, T - 6, 1, "#8a6432");

    /* --- 4. spikes --- */
    px(c, T * 4, T - 3, T, 3, P.stone[2]);
    px(c, T * 4, T - 3, T, 1, P.stone[1]);
    for (var sp = 0; sp < 4; sp++) {
      for (var h = 0; h < 11; h++) {
        var ww = Math.max(1, 4 - Math.round(h * 0.34));
        px(c, T * 4 + sp * 4 + 2 - (ww >> 1), T - 3 - h, ww, 1, h > 7 ? "#ffffff" : P.stone[h > 3 ? 0 : 1]);
      }
    }

    /* --- 5. the moat surface; it ripples in drawTiles --- */
    px(c, T * 5, 0, T, T, P.hazard[1]);
    px(c, T * 5, 0, T, 2, P.hazard[0]);
    if (P.hazard[2]) px(c, T * 5, T - 5, T, 5, P.hazard[2]);
    return s.c;
  }

  /* --- the backdrop: three layers that scroll at three speeds ---------- */
  function buildBackdrop(biome) {
    var P = BIOME[biome], VW = 320, VH = 180;
    var rnd = seeded("bg" + biome);

    /* layer 0 — the sky, and whatever hangs in it. Never scrolls. */
    var sky = spriteCanvas(VW, VH), sc = sky.ctx;
    ditherSky(sc, 0, 0, VW, VH, P.sky);
    if (biome === "meadow") {
      /* the sun: a bright core, then two dithered falloffs, so the halo
         fades instead of ending on a hard ring */
      for (var y = -20; y <= 20; y++)
        for (var x = -20; x <= 20; x++) {
          var d = Math.sqrt(x * x + y * y), th = (BAYER[(30 + y) & 3][(262 + x) & 3] + .5) / 16;
          if (d <= 8) px(sc, 262 + x, 30 + y, 1, 1, "#fffbe0");
          else if (d <= 11) px(sc, 262 + x, 30 + y, 1, 1, "#fff0a8");
          else if (d <= 15 && th < 1 - (d - 11) / 4) px(sc, 262 + x, 30 + y, 1, 1, "#ffe27a");
          else if (d <= 20 && th < .55 - (d - 15) / 9) px(sc, 262 + x, 30 + y, 1, 1, "#ffeec0");
        }
      /* a couple of soft clouds up in the static sky */
      for (var cl = 0; cl < 4; cl++) {
        var clx = 30 + cl * 84 + rnd() * 30, cly = 22 + rnd() * 30;
        blob(sc, clx, cly, 15, 5, P.cloud.concat([P.cloud[2]]));
        blob(sc, clx - 11, cly + 2, 9, 4, P.cloud.concat([P.cloud[2]]));
        blob(sc, clx + 12, cly + 2, 10, 4, P.cloud.concat([P.cloud[2]]));
        px(sc, clx - 20, cly + 4, 40, 1, P.cloud[0]);
      }
    } else if (biome === "forest") {
      for (var i = 0; i < 60; i++) {
        var sx = rnd() * VW, sy = rnd() * 70;
        px(sc, sx, sy, 1, 1, rnd() > .6 ? "#ffffff" : "#ffe9c8");
      }
      /* a low moon, with a couple of seas on it */
      moon(sc, 54, 44, 12, ["#fffaf0", "#f3ddc6", "#dcc0a8", "#c2a48c", "#a98d78"],
           [[-4, -3, 3], [4, 4, 2], [1, -6, 2]]);
    } else {
      for (var j = 0; j < 40; j++) px(sc, rnd() * VW, rnd() * 60, 1, 1, rnd() > .5 ? "#ffd6e6" : "#c8a0d8");
      /* a big low blood-orange moon behind the castle */
      moon(sc, 250, 40, 17, ["#ffe2c0", "#ffc49a", "#e89a7c", "#c07464", "#96534e"],
           [[-5, 3, 4], [6, -4, 3], [2, 8, 2]]);
    }

    /* layer 1 — the far silhouettes. Scrolls slowly. Tiles horizontally. */
    var farW = 480;
    var far = spriteCanvas(farW, VH), fc = far.ctx;
    if (biome === "meadow") {
      for (var h = 0; h < 5; h++) {
        var cxh = 40 + h * 100 + rnd() * 40, rw = 60 + rnd() * 50, rh = 30 + rnd() * 24;
        for (var x2 = -rw; x2 <= rw; x2++) {
          var yy = 130 - Math.round(Math.sqrt(Math.max(0, 1 - (x2 * x2) / (rw * rw))) * rh);
          px(fc, cxh + x2, yy, 1, VH - yy, P.far[1]);
          px(fc, cxh + x2, yy, 1, 2, P.far[0]);
          px(fc, cxh + x2, yy + 2, 1, 1, P.far[2]);
        }
        /* a handful of far trees along each crest, so the hills have scale */
        for (var ft = 0; ft < 4; ft++) {
          var ftx = cxh - rw + rnd() * rw * 2;
          var fty = 130 - Math.round(Math.sqrt(Math.max(0, 1 - Math.pow(ftx - cxh, 2) / (rw * rw))) * rh);
          px(fc, ftx, fty - 7, 1, 7, P.far[2]);
          blob(fc, ftx, fty - 10, 4, 3.4, [P.far[0], P.far[1], P.far[2], P.far[2]]);
        }
      }
    } else if (biome === "forest") {
      for (var t2 = 0; t2 < 46; t2++) {
        var tx = rnd() * farW, th = 40 + rnd() * 52;
        for (var ty = 0; ty < th; ty++) {
          var tw = Math.round((ty / th) * 13) + 1;
          px(fc, tx - tw - 1, 138 - th + ty, tw * 2 + 2, 1, P.far[ty > th * .5 ? 1 : 0]);
        }
        px(fc, tx - 1, 130, 2, 12, P.far[2]);
      }
    } else {
      for (var b = 0; b < 7; b++) {
        var bx = 20 + b * 68 + rnd() * 20, bw = 26 + rnd() * 22, bh = 50 + rnd() * 40;
        px(fc, bx, 140 - bh, bw, bh, P.far[1]);
        px(fc, bx, 140 - bh, 1, bh, P.far[0]);
        for (var w2 = 4; w2 < bw - 4; w2 += 9)
          for (var wy = 8; wy < bh - 10; wy += 13) px(fc, bx + w2, 140 - bh + wy, 3, 4, "#ffb45c");
        /* the roof, widest at the eaves and narrowing to the point */
        for (var r3 = 0; r3 < 14; r3++)
          px(fc, bx + r3 * (bw / 28), 140 - bh - 1 - r3, Math.max(1, bw - r3 * (bw / 14)), 1, P.far[0]);
      }
    }

    /* layer 2 — the near band, just behind the tiles. Scrolls faster. */
    var midW = 480;
    var mid = spriteCanvas(midW, VH), mc = mid.ctx;
    if (biome === "meadow") {
      for (var m = 0; m < 8; m++) {
        var mx = 18 + m * 58 + rnd() * 22, mh = 30 + rnd() * 20;
        /* trunk first, then a canopy of overlapping puffs with lit speckles */
        for (var tr = 0; tr < mh; tr++) {
          var tw2 = tr < mh * .7 ? 4 : 6;
          px(mc, mx - (tw2 >> 1), 152 - tr, tw2, 1, "#8a5f3a");
          px(mc, mx - (tw2 >> 1), 152 - tr, 1, 1, "#a87a4e");
          px(mc, mx + (tw2 >> 1) - 1, 152 - tr, 1, 1, "#6b4527");
        }
        canopy(mc, mx, 152 - mh - 8, 17 + rnd() * 5,
               [P.mid[0], P.mid[1], P.mid[2], P.mid[2]], rnd, "#c6f5cf");
      }
      /* low bushes between the trunks. They stop above the tile line: any
         lower and they show through a pit as a floating green slab. */
      for (var hb = 0; hb < midW; hb += 26)
        blob(mc, hb + rnd() * 18, 148 + rnd() * 3, 7 + rnd() * 4, 4,
             [P.mid[0], P.mid[1], P.mid[2], P.mid[2]]);
    } else if (biome === "forest") {
      for (var m2 = 0; m2 < 12; m2++) {
        var mx2 = 14 + m2 * 40 + rnd() * 18, mh2 = 44 + rnd() * 26;
        for (var tr2 = 0; tr2 < mh2; tr2++) {
          px(mc, mx2 - 3, 154 - tr2, 6, 1, P.mid[2]);
          px(mc, mx2 - 3, 154 - tr2, 1, 1, "#5c7a8c");
        }
        canopy(mc, mx2, 154 - mh2 - 6, 21 + rnd() * 6,
               [P.mid[0], P.mid[1], P.mid[2], P.mid[2]], rnd, "#8fd8c0");
        /* lanterns hanging in the branches — the forest is dusk, not danger */
        if (m2 % 3 === 0) {
          px(mc, mx2 + 12, 154 - mh2 + 6, 1, 5, "#3a2c5c");
          blob(mc, mx2 + 12, 154 - mh2 + 12, 3, 4, ["#fff0b0", "#ffd166", "#e0a84e", "#b07c30"]);
        }
      }
    } else {
      for (var p2 = 0; p2 < 12; p2++) {
        var px2 = p2 * 42 + 10, ph = 60 + (p2 % 3) * 16;
        px(mc, px2, 160 - ph, 22, ph, P.mid[1]);
        px(mc, px2, 160 - ph, 2, ph, P.mid[0]);
        px(mc, px2 + 20, 160 - ph, 2, ph, "#2a1836");
        px(mc, px2 - 2, 160 - ph - 6, 26, 6, P.mid[0]);
        for (var cr = 0; cr < 26; cr += 6) px(mc, px2 - 2 + cr, 160 - ph - 10, 3, 4, P.mid[0]);
        /* one lit window per tower, at a different height each time */
        px(mc, px2 + 8, 160 - ph + 14 + (p2 % 4) * 9, 5, 7, "#ffb45c");
        px(mc, px2 + 8, 160 - ph + 14 + (p2 % 4) * 9, 5, 1, "#ffe0a0");
      }
    }
    /* Where the ground line sits inside each layer's own canvas. paint()
       lines these up with the level's real ground row, which is the whole
       reason scenery stays planted — see the note there. */
    var horizons = {
      meadow: { far: 180, mid: 152 },   // hills fill to the foot of the canvas
      forest: { far: 142, mid: 154 },
      castle: { far: 140, mid: 160 },
    }[biome];

    /* Below its horizon each layer gets a solid mass in its own darkest
       tone. Two things need it: the far trees would otherwise stand on
       nothing with sky between their trunks, and looking down a bottomless
       pit would show a bare slab of sky where there should be the ground
       receding into shadow. */
    px(fc, 0, horizons.far, farW, VH - horizons.far, P.far[2]);
    px(fc, 0, horizons.far, farW, 1, P.far[1]);
    px(mc, 0, horizons.mid, midW, VH - horizons.mid, P.mid[2]);
    px(mc, 0, horizons.mid, midW, 1, P.mid[1]);
    return { sky: sky.c, far: far.c, mid: mid.c, farW: farW, midW: midW,
             farHorizon: horizons.far, midHorizon: horizons.mid };
  }
  /* =======================================================================
     9. THE LEVEL — turning a grid of characters into tiles and entities.

        Anything that moves, is collected or can be stood on by something
        other than gravity is lifted OUT of the tile grid and becomes an
        entity; what is left in the grid is only the static world, which is
        what makes collision cheap.
     ======================================================================= */

  var SOLID   = "#B?MI1PF";          // tiles that stop her dead
  var GIFT    = "?MI1PF";            // tiles that pop something when bumped
  var GIFT_OF = { "?": "heart", "M": "grow", "I": "star", "1": "life", "P": "boost", "F": "wing" };
  var LOOSE   = "MI1PF";             // ...the same letters, free-standing, are the item

  var G = null;                      // the whole game state lives here

  function buildLevel(index) {
    var def = LEVELS[index], rows = def.rows;
    var h = rows.length, w = rows[0].length;
    var d = DIFF[G.diff];

    var grid = [];
    var ents = [], items = [], start = { x: 32, y: 32 }, goal = null, checks = [], boss = null;

    for (var y = 0; y < h; y++) {
      grid.push(rows[y].split(""));
      for (var x = 0; x < w; x++) {
        var ch = grid[y][x];
        var wx = x * T, wy = y * T;

        /* --- the two difficulty-gated characters ------------------------ */
        if (ch === ";") { grid[y][x] = "."; if (d.mediumUp) ents.push(mkEnemy("walker", wx, wy)); continue; }
        if (ch === ",") { grid[y][x] = d.hardOnly ? "^" : "."; continue; }

        switch (ch) {
          case "S": grid[y][x] = "."; start = { x: wx, y: wy }; break;
          case "G": grid[y][x] = "."; goal = { x: wx + 4, y: wy, raised: 0 }; break;
          case "C": grid[y][x] = "."; checks.push({ x: wx, y: wy, taken: false }); break;
          case "o": grid[y][x] = "."; items.push(mkItem("heart", wx + 2, wy + 2, true)); break;
          case "w": grid[y][x] = "."; ents.push(mkEnemy("walker", wx, wy)); break;
          case "f": grid[y][x] = "."; ents.push(mkEnemy("flyer", wx, wy)); break;
          case "g": grid[y][x] = "."; ents.push(mkEnemy("guard", wx, wy)); break;
          case "H": grid[y][x] = "."; ents.push(mkMover("H", wx, wy)); break;
          case "V": grid[y][x] = "."; ents.push(mkMover("V", wx, wy)); break;
          case "T": grid[y][x] = "."; ents.push(mkMover("T", wx, wy)); break;
          case "X": grid[y][x] = "."; boss = mkBoss(wx, wy); break;
          case "M": case "I": case "1": case "P": case "F":
            /* A power-up letter RESTING on something is the item itself,
               sitting there waiting to be walked into. One hanging in the
               air is a gift block, to be hit from underneath. Keeping the
               rule this way round means a block can never end up at head
               height above a ledge, where it would wall her in. */
            var below = rows[y + 1] && rows[y + 1][x];
            if (isSolidChar(below) || below === "-") {
              grid[y][x] = ".";
              items.push(mkItem(GIFT_OF[ch], wx + 2, wy + 3, true));
            }
            break;
        }
      }
    }

    return {
      w: w, h: h, grid: grid, pxW: w * T, pxH: h * T,
      groundY: findGroundY(grid, w, h),
      ents: ents, items: items, start: start, goal: goal,
      checks: checks, boss: boss, biome: def.biome,
      atlas: buildAtlas(def.biome), bg: buildBackdrop(def.biome),
      secretsFound: 0,
    };
  }

  function isSolidChar(ch) { return !!ch && SOLID.indexOf(ch) >= 0; }

  /* The row the main ground surface sits on: the one with the most tiles
     that are solid with air directly above. Worked out rather than written
     down, so editing a level's layout cannot leave it stale. */
  function findGroundY(grid, w, h) {
    var counts = [], y, x;
    for (y = 0; y < h; y++) {
      counts[y] = 0;
      for (x = 0; x < w; x++)
        if (isSolidChar(grid[y][x]) && !isSolidChar(grid[y - 1] && grid[y - 1][x])) counts[y]++;
    }
    var best = 0;
    for (y = 1; y < h; y++) if (counts[y] > counts[best]) best = y;
    return best * T;
  }

  /* ---- tile queries ---------------------------------------------------
     Outside the level horizontally counts as wall, so she can never walk
     off the start; outside vertically counts as air, so a pit is a pit. */
  function tileAt(tx, ty) {
    var L = G.level;
    if (tx < 0 || tx >= L.w) return "#";
    if (ty < 0 || ty >= L.h) return ".";
    return L.grid[ty][tx];
  }
  function solidAt(tx, ty) { return isSolidChar(tileAt(tx, ty)); }
  function oneWayAt(tx, ty) { return tileAt(tx, ty) === "-"; }

  /* Does this box overlap any solid tile? */
  function boxHitsSolid(x, y, w, h) {
    var x0 = Math.floor(x / T), x1 = Math.floor((x + w - 1) / T);
    var y0 = Math.floor(y / T), y1 = Math.floor((y + h - 1) / T);
    for (var ty = y0; ty <= y1; ty++)
      for (var tx = x0; tx <= x1; tx++)
        if (solidAt(tx, ty)) return true;
    return false;
  }

  /* Every deadly tile the box is touching right now. */
  function boxHitsHazard(x, y, w, h) {
    var x0 = Math.floor(x / T), x1 = Math.floor((x + w - 1) / T);
    var y0 = Math.floor(y / T), y1 = Math.floor((y + h - 1) / T);
    for (var ty = y0; ty <= y1; ty++)
      for (var tx = x0; tx <= x1; tx++) {
        var ch = tileAt(tx, ty);
        if (ch === "~") return "moat";
        /* spikes only bite the lower two thirds of their tile, so brushing
           the very top of one while jumping past is forgiving */
        if (ch === "^" && y + h > ty * T + 5) return "spike";
      }
    return null;
  }

  /* =======================================================================
     10. PHYSICS

        Move on one axis, resolve on that axis, then the other. Doing both
        at once is where platformers get their corner bugs, so we never do.
        `one-way` tiles are only solid when she is falling and her feet
        were above the top of the tile a moment ago.
     ======================================================================= */
  /* Both resolvers back the body out a pixel at a time. The step count is
     bounded: outside the level counts as wall, so a body that somehow ends
     up embedded would otherwise walk out of the world forever and hang the
     tab. If the budget runs out we put it back where it started, which is
     always somewhere it fitted. */
  var PUSH_LIMIT = 64;

  function moveX(b, dx) {
    var was = b.x;
    b.x += dx;
    if (!boxHitsSolid(b.x, b.y, b.w, b.h)) return false;
    var step = dx > 0 ? -1 : 1, guard = 0;
    while (boxHitsSolid(b.x, b.y, b.w, b.h) && guard++ < PUSH_LIMIT) b.x += step;
    if (guard >= PUSH_LIMIT) b.x = was;
    b.vx = 0;
    return true;
  }

  function moveY(b, dy, useOneWay) {
    var prevBottom = b.y + b.h;
    b.y += dy;
    var hit = boxHitsSolid(b.x, b.y, b.w, b.h);

    /* one-way ledges: only ever caught from above, and only while falling */
    if (!hit && useOneWay && dy > 0) {
      var x0 = Math.floor(b.x / T), x1 = Math.floor((b.x + b.w - 1) / T);
      var ty = Math.floor((b.y + b.h - 1) / T);
      for (var tx = x0; tx <= x1; tx++) {
        if (oneWayAt(tx, ty) && prevBottom <= ty * T + 6) {
          b.y = ty * T - b.h; b.vy = 0; return "ground";
        }
      }
    }
    if (!hit) return false;

    var step = dy > 0 ? -1 : 1, guard = 0;
    while (boxHitsSolid(b.x, b.y, b.w, b.h) && guard++ < PUSH_LIMIT) b.y += step;
    if (guard >= PUSH_LIMIT) b.y = prevBottom - b.h;
    var res = dy > 0 ? "ground" : "ceiling";
    b.vy = 0;
    return res;
  }

  /* Is there floor directly under her feet? At 60fps gravity moves her a
     third of a pixel, which is not always enough to re-enter the tile she is
     standing on, so asking the question outright is more honest than reading
     it off the last collision. */
  function groundedProbe(b) {
    var feet = b.y + b.h;
    var ty = Math.floor((feet + 1) / T);
    var x0 = Math.floor(b.x / T), x1 = Math.floor((b.x + b.w - 1) / T);
    for (var tx = x0; tx <= x1; tx++) {
      if (solidAt(tx, ty)) return true;
      if (oneWayAt(tx, ty) && Math.abs(feet - ty * T) <= 2) return true;
    }
    return false;
  }

  /* ---- the moving platforms are solid too, but they are entities, so
          they get their own pass after the tiles ------------------------ */
  function ridePlatforms(b, wasBottom) {
    var landed = null;
    G.level.ents.forEach(function (e) {
      if (e.kind !== "mover" || !e.on) return;
      if (b.x + b.w <= e.x || b.x >= e.x + e.w) return;
      if (b.vy < 0) return;
      var top = e.y;
      if (wasBottom <= top + 4 && b.y + b.h >= top && b.y + b.h <= top + e.h) {
        b.y = top - b.h; b.vy = 0; landed = e;
      }
    });
    return landed;
  }

  /* =======================================================================
     ENTITY CONSTRUCTORS
     ======================================================================= */
  function mkEnemy(type, x, y) {
    var d = DIFF[G.diff], mul = d.enemyMul;
    if (type === "walker")
      return { kind: "enemy", type: type, x: x + 1, y: y + 2, w: 14, h: 14,
               vx: -TUNE.enemySpeed * mul, vy: 0, anim: 0, dead: 0, alive: true };
    if (type === "guard")
      return { kind: "enemy", type: type, x: x, y: y, w: 14, h: 16,
               vx: -TUNE.guardSpeed * mul, vy: 0, anim: 0, dead: 0, alive: true };
    /* the flyer never touches the ground: it patrols a span and bobs */
    return { kind: "enemy", type: "flyer", x: x, y: y, w: 14, h: 12,
             vx: TUNE.flyerSpeed * mul, vy: 0, anim: 0, dead: 0, alive: true,
             homeX: x, homeY: y, span: 46, ph: (x % 40) / 40 * 6.28 };
  }

  function mkMover(type, x, y) {
    var d = DIFF[G.diff];
    return {
      kind: "mover", type: type, x: x, y: y, w: T * 2, h: 6,
      homeX: x, homeY: y, dx: 0, dy: 0,
      span: type === "H" ? T * 4 : T * 3,
      ph: 0, on: true, fade: 1,
      timer: 0, hold: d.timedPlatform,     // only used by the blinking ones
    };
  }

  function mkItem(kind, x, y, floating) {
    return {
      kind: "item", type: kind, x: x, y: y,
      w: kind === "heart" ? 8 : 12, h: kind === "heart" ? 8 : 12,
      /* a free-standing item waits where it was placed; one that has just
         come out of a block walks off it (see stepItems) */
      vx: floating ? 0 : TUNE.itemWalk, vy: 0,
      anim: Math.random() * 4, gone: false,
      floating: !!floating, born: 0, popping: 0,
    };
  }

  function mkBoss(x, y) {
    var B = TUNE.boss;
    var total = B.hitsPerPhase * B.phases.length;
    return {
      kind: "boss", x: x - 12, y: y - 18, w: 34, h: 30, vx: 0, vy: 0,
      hp: total, hpMax: total,
      phase: 0, mode: "wait", modeT: B.phases[0].wait,
      hurt: 0, anim: 0, awake: false, onGround: true, dead: 0,
      shots: [], face: -1, hopsLeft: 0, flash: 0,
    };
  }

  /* Which phase his health puts him in: 0 while the top third is intact,
     then 1, then 2. Written off hp so changing hitsPerPhase just works. */
  function bossPhase(b) {
    var per = TUNE.boss.hitsPerPhase;
    return clamp(TUNE.boss.phases.length - 1 - Math.floor((b.hp - 1) / per),
                 0, TUNE.boss.phases.length - 1);
  }
  function bossSpec(b) { return TUNE.boss.phases[b.phase]; }

  function mkPlayer(x, y) {
    return {
      x: x, y: y, w: 10, h: 15, vx: 0, vy: 0,
      face: 1, onGround: false, pose: "idle", frame: 0, animT: 0,
      big: false, star: 0, boost: 0, wing: false, jumpsLeft: 0,
      coyote: 0, buffer: 0, invuln: 0, ducking: false, holdJump: false,
      squash: 0, riding: null, lastSafe: { x: x, y: y }, dead: 0, winT: 0,
    };
  }

  /* Ouissy's box changes when she grows, and it grows UPWARD so she never
     ends up standing inside the ceiling. */
  function setBig(p, big) {
    if (p.big === big) return;
    var bottom = p.y + p.h;
    p.big = big;
    p.h = big ? 22 : 15;
    p.w = big ? 11 : 10;
    p.y = bottom - p.h;
    /* if growing pushed her into something, nudge her down until she fits */
    var guard = 0;
    while (boxHitsSolid(p.x, p.y, p.w, p.h) && guard++ < 24) p.y++;
  }
  /* =======================================================================
     PARTICLES — the whole reason a stomp feels like a stomp
     ======================================================================= */
  function burst(x, y, n, colours, spd, opts) {
    opts = opts || {};
    for (var i = 0; i < n; i++) {
      var a = (i / n) * 6.283 + Math.random() * 0.5;
      G.parts.push({
        x: x, y: y,
        vx: Math.cos(a) * (spd * (0.5 + Math.random())),
        vy: Math.sin(a) * (spd * (0.5 + Math.random())) - (opts.lift || 20),
        g: opts.g === undefined ? 320 : opts.g,
        life: 0, max: opts.max || (0.45 + Math.random() * 0.35),
        c: colours[(Math.random() * colours.length) | 0],
        s: opts.size || 2,
      });
    }
  }

  function stepParts(dt) {
    for (var i = G.parts.length - 1; i >= 0; i--) {
      var p = G.parts[i];
      p.life += dt;
      if (p.life >= p.max) { G.parts.splice(i, 1); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt; p.vy += p.g * dt;
    }
    for (var j = G.floats.length - 1; j >= 0; j--) {
      var f = G.floats[j];
      f.life += dt; f.y -= 22 * dt;
      if (f.life > 0.9) G.floats.splice(j, 1);
    }
  }

  function popText(x, y, text, colour) {
    G.floats.push({ x: x, y: y, t: text, c: colour || "#fff6c0", life: 0 });
  }

  function shake(amount) { G.shake = Math.max(G.shake, amount); }

  /* =======================================================================
     THE PLAYER
     ======================================================================= */
  function stepPlayer(dt) {
    var p = G.player, d = DIFF[G.diff], K = G.keys;

    if (p.dead) {                       // the death arc: she pops up, then falls
      p.dead += dt;
      p.vy += TUNE.gravityDown * dt;
      p.y += p.vy * dt;
      if (p.dead > 1.5) afterDeath();
      return;
    }
    if (p.winT) { stepWinWalk(dt); return; }

    var gravUp = TUNE.gravityUp * d.gravityMul, gravDn = TUNE.gravityDown * d.gravityMul;
    var maxRun = TUNE.maxRun * (p.boost > 0 ? TUNE.boostMul : 1);

    /* ---- horizontal: accelerate towards the held direction ------------- */
    var want = (K.right ? 1 : 0) - (K.left ? 1 : 0);
    p.ducking = !!K.down && p.onGround && !want;
    if (want && !p.ducking) {
      var acc = (p.onGround ? TUNE.runAccel : TUNE.airAccel) * dt;
      p.vx += want * acc;
      p.vx = clamp(p.vx, -maxRun, maxRun);
      p.face = want;
    } else {
      var fr = (p.onGround ? TUNE.friction : TUNE.airDrag) * dt;
      if (p.vx > 0) p.vx = Math.max(0, p.vx - fr); else p.vx = Math.min(0, p.vx + fr);
    }

    /* ---- jumping: coyote time forgives a late press, the buffer forgives
            an early one, and holding the button keeps the rise going ----- */
    p.coyote = p.onGround ? TUNE.coyote * d.coyoteMul : Math.max(0, p.coyote - dt);
    p.buffer = K.jumpPressed ? TUNE.buffer * d.bufferMul : Math.max(0, p.buffer - dt);
    K.jumpPressed = false;

    if (p.buffer > 0) {
      if (p.coyote > 0) {
        p.vy = -TUNE.jumpVel * d.jumpMul; p.onGround = false;
        p.coyote = 0; p.buffer = 0; p.holdJump = true;
        p.squash = -1; sfx("jump");
        burst(p.x + p.w / 2, p.y + p.h, 5, ["#ffffff", "#ffd6e6"], 40, { lift: -10, g: 220, max: .3, size: 1 });
      } else if (p.wing && p.jumpsLeft > 0) {           // the feather's second jump
        p.vy = -TUNE.jumpVel * d.jumpMul * 0.92;
        p.jumpsLeft--; p.buffer = 0; p.holdJump = true; p.squash = -1;
        sfx("wing");
        burst(p.x + p.w / 2, p.y + p.h, 10, ["#ffffff", "#e6ecff", "#ffd6e6"], 55, { g: 120, max: .5, size: 1 });
      }
    }
    if (!K.jump && p.vy < 0 && p.holdJump) { p.vy *= TUNE.jumpCut; p.holdJump = false; }
    if (p.vy >= 0) p.holdJump = false;

    p.vy += (p.vy < 0 ? gravUp : gravDn) * dt;
    p.vy = Math.min(p.vy, TUNE.maxFall);

    /* ---- move, then resolve, one axis at a time ------------------------ */
    var wasBottom = p.y + p.h;
    moveX(p, p.vx * dt);

    /* the platform she is standing on carries her sideways */
    if (p.riding && p.riding.on) p.x += p.riding.dx;

    var was = p.onGround;
    p.onGround = false; p.riding = null;
    var res = moveY(p, p.vy * dt, true);
    if (res === "ground") p.onGround = true;
    if (res === "ceiling") bumpBlocks(p);

    var rode = ridePlatforms(p, wasBottom);
    if (rode) { p.onGround = true; p.riding = rode; p.y += rode.dy; }
    if (!p.onGround && p.vy >= 0) p.onGround = groundedProbe(p);

    if (p.onGround && !was) {           // the landing
      p.squash = 1; p.jumpsLeft = p.wing ? 1 : 0;
      if (p.vy > 200 || true) burst(p.x + p.w / 2, p.y + p.h, 4, ["#ffffff"], 30, { lift: -6, g: 260, max: .22, size: 1 });
    }
    if (p.onGround) p.lastSafe = { x: p.x, y: p.y };

    /* ---- timers -------------------------------------------------------- */
    if (p.invuln > 0) p.invuln -= dt;
    if (p.star > 0) {
      p.star -= dt;
      if (p.star <= 0) popText(p.x, p.y - 8, "sparkle out", "#ffd6e6");
      else if (Math.random() < 0.55)
        burst(p.x + p.w / 2 + (Math.random() - .5) * 8, p.y + p.h / 2, 1,
              ["#fff6a8", "#ffd166", "#ffffff"], 12, { g: -20, max: .5, size: 1 });
    }
    if (p.boost > 0) {
      p.boost -= dt;
      if (Math.abs(p.vx) > 60 && Math.random() < .5)
        burst(p.x + p.w / 2 - p.face * 6, p.y + p.h - 3, 1, ["#ffd166", "#ff9ec4"], 10, { g: 60, max: .3, size: 1 });
    }
    p.squash += (0 - p.squash) * Math.min(1, dt * 12);

    /* ---- what she is standing in --------------------------------------- */
    var hz = boxHitsHazard(p.x, p.y + 2, p.w, p.h - 2);
    if (hz && p.star <= 0) hurtPlayer(true);

    /* ---- out of the world ---------------------------------------------- */
    if (p.y > G.level.pxH + 24) {
      if (d.pitSafety) {                // Easy: a cloud catches her
        p.x = p.lastSafe.x; p.y = p.lastSafe.y - 4;
        p.vx = 0; p.vy = -120; p.invuln = 1;
        burst(p.x + p.w / 2, p.y + p.h, 16, ["#ffffff", "#cfe9fb"], 60, { g: 120, max: .6 });
        popText(p.x, p.y - 10, "caught you!", "#ffffff");
        sfx("save"); shake(3);
      } else hurtPlayer(true);
    }

    /* ---- the animation state machine ----------------------------------- */
    p.animT += dt;
    if (!p.onGround) { p.pose = p.vy < 0 ? "jump" : "fall"; p.frame = 0; }
    else if (p.ducking) { p.pose = "duck"; p.frame = 0; }
    else if (Math.abs(p.vx) > 12) {
      p.pose = "run";
      p.frame = Math.floor(p.animT * (7 + Math.abs(p.vx) / 26)) % 4;
    } else {
      p.pose = "idle";
      p.frame = Math.floor(p.animT * 1.6) % 4;
    }
  }

  /* Hitting a block with your head: gift blocks pop, bricks break if she
     is big, and everything else just stops her. */
  function bumpBlocks(p) {
    var ty = Math.floor((p.y - 1) / T);
    var x0 = Math.floor((p.x + 2) / T), x1 = Math.floor((p.x + p.w - 3) / T);
    for (var tx = x0; tx <= x1; tx++) {
      var ch = tileAt(tx, ty);
      if (GIFT.indexOf(ch) >= 0) {
        G.level.grid[ty][tx] = "u";                       // 'u' draws as a used block
        G.bumps.push({ tx: tx, ty: ty, t: 0 });
        var kind = GIFT_OF[ch];
        if (kind === "heart") { collectHeart(tx * T + 8, ty * T); }
        else {
          var it = mkItem(kind, tx * T + 2, ty * T - 13, false);
          it.born = 0.35; it.vy = -90;
          G.level.items.push(it);
        }
        addScore(TUNE.scores.block);
        sfx("bump"); shake(1.5);
      } else if (ch === "B") {
        if (p.big) {
          G.level.grid[ty][tx] = ".";
          burst(tx * T + 8, ty * T + 8, 14, [BIOME[G.level.biome].brick[0], BIOME[G.level.biome].brick[1], BIOME[G.level.biome].brick[2]], 90, { max: .6, size: 2 });
          addScore(TUNE.scores.block); sfx("break"); shake(3);
        } else { G.bumps.push({ tx: tx, ty: ty, t: 0 }); sfx("bump"); }
      }
    }
  }

  /* =======================================================================
     WHAT HAPPENS WHEN SHE IS HIT
     ======================================================================= */
  function hurtPlayer(fatal) {
    var p = G.player, d = DIFF[G.diff];
    if (p.dead || p.winT) return;
    if (p.invuln > 0 && !fatal) return;
    if (p.star > 0) return;

    if (p.big && !fatal) {              // the glow-up takes the hit for her
      setBig(p, false);
      p.invuln = TUNE.invuln * d.invulnMul;
      burst(p.x + p.w / 2, p.y + p.h / 2, 18, ["#ff9ec4", "#ffffff", "#ffd6e6"], 90, { max: .6 });
      sfx("shrink"); shake(4);
      return;
    }
    if (!fatal && p.invuln > 0) return;

    p.dead = 0.001; p.vy = -230; p.vx = 0; p.pose = "hurt";
    G.deaths++;
    burst(p.x + p.w / 2, p.y + p.h / 2, 20, ["#ff5f95", "#ffffff"], 100, { max: .8 });
    sfx("die"); shake(6);
  }

  function afterDeath() {
    G.lives--;
    if (G.lives < 0) { endRun(false); return; }
    respawn();
  }

  function respawn() {
    var L = G.level, d = DIFF[G.diff];
    var at = L.start, cp = null;
    if (d.checkpoints) L.checks.forEach(function (c) { if (c.taken) cp = c; });
    if (cp) at = cp;
    G.player = mkPlayer(at.x + 2, at.y - 2);
    G.player.invuln = 1.4;
    G.camSnap = true;
    if (d.timeLimit) G.timeLeft = d.timeLimit[G.levelIndex];
    /* enemies come back so a checkpoint is a real restart of the stretch */
    L.ents.forEach(function (e) {
      if (e.kind === "enemy" && e.alive === false && e.respawnable !== false) { e.alive = true; e.dead = 0; e.x = e.spawnX; e.y = e.spawnY; }
    });
  }

  /* =======================================================================
     ENEMIES
     ======================================================================= */
  function stepEnemies(dt) {
    var p = G.player, L = G.level;
    L.ents.forEach(function (e) {
      if (e.kind === "mover") return stepMover(e, dt);
      if (!e.alive) {
        if (e.dead > 0) { e.dead -= dt; e.y += 90 * dt; }
        return;
      }
      if (e.spawnX === undefined) { e.spawnX = e.x; e.spawnY = e.y; }
      /* off-screen enemies are frozen — it keeps the level cheap and it is
         what the games this is modelled on all did */
      /* Frozen off screen, but with a wide enough margin that she never
         watches one start moving. The phone view is only 240 wide, so the
         old 80px margin had them waking up almost in shot. */
      if (e.x < G.cam.x - 160 || e.x > G.cam.x + VIEW.w + 160) { e.anim += dt; return; }

      e.anim += dt;
      if (e.type === "flyer") {
        e.x += e.vx * dt;
        if (e.x < e.homeX - e.span) { e.x = e.homeX - e.span; e.vx = -e.vx; }
        if (e.x > e.homeX + e.span) { e.x = e.homeX + e.span; e.vx = -e.vx; }
        e.y = e.homeY + Math.sin(e.anim * 2.1 + e.ph) * 11;
      } else {
        /* Gravity only while she is actually falling. Applying it every
           frame regardless moves a standing enemy a third of a pixel, the
           collision puts it back, and it bobs by one pixel forever — which
           is what read as the enemies lagging. Exactly the bug that made
           her own run animation flicker into a fall. */
        var onFloor = groundedProbe(e);
        if (onFloor && e.vy >= 0) e.vy = 0; else e.vy += TUNE.gravityDown * dt;

        moveX(e, e.vx * dt) && (e.vx = -e.vx);
        var landed = moveY(e, e.vy * dt, true) === "ground" || onFloor;

        /* Every ground enemy looks before it steps. It will walk down a
           step, because it is trying to reach her, but it turns at a real
           drop rather than marching into the pit the level put there. */
        if (landed && !enemyFloorAhead(e)) e.vx = -e.vx;
        if (landed && boxHitsHazard(e.x, e.y, e.w, e.h)) e.vx = -e.vx;
      }
      hitPlayerOrGetStomped(e);
    });
  }

  /* Is there floor ahead of this enemy within a step it could survive?
     `ENEMY_DROP` is how many tiles it will walk down; anything deeper it
     treats as a pit and turns. The same shape of check the power-ups use. */
  var ENEMY_DROP = 4;

  function enemyFloorAhead(e) {
    var ahead = e.x + (e.vx > 0 ? e.w + 2 : -2);
    var col = Math.floor(ahead / T);
    var under = Math.floor((e.y + e.h + 4) / T);
    for (var look = 0; look <= ENEMY_DROP; look++)
      if (solidAt(col, under + look) || oneWayAt(col, under + look)) return true;
    return false;
  }

  /* The one rule the whole game turns on: coming down on top of something
     defeats it, touching it any other way hurts. */
  function hitPlayerOrGetStomped(e) {
    var p = G.player;
    if (p.dead || p.winT) return;
    if (p.x + p.w <= e.x + 2 || p.x >= e.x + e.w - 2) return;
    if (p.y + p.h <= e.y + 2 || p.y >= e.y + e.h - 2) return;

    var falling = p.vy > 30;
    var fromAbove = (p.y + p.h) - e.y < e.h * 0.62;

    if (p.star > 0) { defeat(e, true); return; }
    if (falling && fromAbove) {
      defeat(e, false);
      p.vy = -(G.keys.jump ? TUNE.stompBoost : TUNE.stompVel);
      p.squash = 1.2;
      return;
    }
    hurtPlayer(false);
  }

  function defeat(e, spun) {
    e.alive = false;
    e.dead = spun ? 0.9 : 0.45;
    e.spun = spun;
    addScore(TUNE.scores.stomp);
    popText(e.x, e.y - 4, "+" + TUNE.scores.stomp, "#fff6c0");
    burst(e.x + e.w / 2, e.y + e.h / 2, 12, ["#ffffff", "#ffd6e6", "#ff9ec4"], 80, { max: .5 });
    sfx(spun ? "star" : "stomp");
    shake(3);
  }

  /* ---- moving platforms ------------------------------------------------ */
  function stepMover(m, dt) {
    var px0 = m.x, py0 = m.y;
    if (m.type === "H") {
      m.ph += dt * (TUNE.moverSpeed / m.span);
      m.x = m.homeX + (0.5 - 0.5 * Math.cos(m.ph)) * m.span;
    } else if (m.type === "V") {
      m.ph += dt * (TUNE.moverSpeed / m.span);
      m.y = m.homeY - (0.5 - 0.5 * Math.cos(m.ph)) * m.span;
    } else {
      /* the blinking one: it holds while she stands on it, then goes */
      var standing = G.player.riding === m;
      if (m.on) {
        if (standing) m.timer += dt;
        if (m.timer > m.hold) { m.on = false; m.timer = 0; sfx("blink"); }
        m.fade = m.timer > m.hold * 0.55 ? (Math.sin(m.timer * 26) > 0 ? 1 : 0.25) : 1;
      } else {
        m.timer += dt; m.fade = 0;
        if (m.timer > 2.0) { m.on = true; m.timer = 0; m.fade = 1; }
      }
    }
    m.dx = m.x - px0; m.dy = m.y - py0;
  }

  /* =======================================================================
     PICKUPS
     ======================================================================= */
  function collectHeart(x, y) {
    G.hearts++;
    addScore(TUNE.scores.heart);
    burst(x, y, 8, ["#ff5f95", "#ffd6e6", "#ffffff"], 70, { max: .45, size: 1 });
    sfx("heart");
    if (G.hearts % 50 === 0) { G.lives++; popText(x, y - 10, "1 UP", "#8ff0a8"); sfx("life"); }
  }

  function stepItems(dt) {
    var p = G.player, L = G.level;
    for (var i = L.items.length - 1; i >= 0; i--) {
      var it = L.items[i];
      it.anim += dt * 6;
      if (it.born > 0) {                 // rising out of a block it was in
        it.born -= dt; it.y += it.vy * dt; it.vy += 240 * dt;
        continue;
      }
      if (!it.floating && it.type !== "heart") {
        /* A power-up out of a block walks, the way a mushroom does: it
           slides off the block it came from, turns at walls, and ends up
           somewhere she can actually run into. Left sitting on its own
           block it would only ever be reachable by landing on top of it. */
        it.vy = Math.min(it.vy + 620 * dt, 260);
        var b = { x: it.x, y: it.y, w: it.w, h: it.h, vy: it.vy, vx: it.vx };
        if (moveX(b, it.vx * dt)) it.vx = -it.vx;
        var landed = moveY(b, it.vy * dt, true) === "ground";
        if (landed) it.vy = 0;
        it.x = b.x; it.y = b.y;
        /* Unlike the mushroom this is modelled on, a power-up looks before
           it steps. Left to walk off the first ledge it meets, the one from
           the block in world 1 marches straight into the pit six tiles
           later and she never gets to have it. */
        if (landed) {
          /* It will happily walk off a step — it is trying to get down to
             her — but it turns at a real drop. Left to behave like the
             mushroom this is modelled on, the one from the block in world 1
             marches into the pit six tiles later and she never gets it. */
          var ahead = it.x + (it.vx > 0 ? it.w + 2 : -2);
          var col = Math.floor(ahead / T), under = Math.floor((it.y + it.h + 4) / T);
          var floorBelow = false;
          for (var look = 0; look < 9 && !floorBelow; look++)
            floorBelow = solidAt(col, under + look) || oneWayAt(col, under + look);
          if (!floorBelow) it.vx = -it.vx;
        }
        if (it.y > G.level.pxH + 40) { L.items.splice(i, 1); continue; }
      }
      if (it.x < G.cam.x - 40 || it.x > G.cam.x + VIEW.w + 60) continue;

      if (p.x + p.w > it.x && p.x < it.x + it.w && p.y + p.h > it.y && p.y < it.y + it.h && !p.dead) {
        L.items.splice(i, 1);
        takeItem(it);
      }
    }
  }

  function takeItem(it) {
    var p = G.player;
    if (it.type === "heart") { collectHeart(it.x + 4, it.y + 4); return; }

    burst(it.x + 6, it.y + 6, 16, ["#fff6a8", "#ffffff", "#ffd6e6"], 90, { max: .6 });
    shake(2);
    if (it.type === "grow") {
      setBig(p, true); popText(it.x, it.y - 8, "GLOW UP!", "#ff9ec4"); sfx("power");
    } else if (it.type === "star") {
      p.star = TUNE.starTime; popText(it.x, it.y - 8, "SPARKLE!", "#fff6a8"); sfx("power");
    } else if (it.type === "life") {
      G.lives++; popText(it.x, it.y - 8, "1 UP", "#8ff0a8"); sfx("life");
    } else if (it.type === "boost") {
      p.boost = TUNE.boostTime; popText(it.x, it.y - 8, "LOVE BOOST", "#ffd166"); sfx("power");
    } else if (it.type === "wing") {
      p.wing = true; p.jumpsLeft = 1; popText(it.x, it.y - 8, "DOUBLE JUMP", "#e6ecff"); sfx("power");
    }
    addScore(400);
  }

  /* =======================================================================
     THE HEARTBREAKER — the last thing between her and the door
     ======================================================================= */
  /* =======================================================================
     THE HEARTBREAKER

     One state machine, four states, and he is only ever in one of them:

       wait   —  standing, closed, doing nothing. Short.
       tell   —  the wind-up. He crouches, or rears, or plants his feet, and
                 the crown flares. This is the only warning she gets and it
                 is deliberately long enough to react to.
       attack —  the thing he told her he was going to do.
       open   —  panting, stationary, unable to start anything. The window.

     He cannot attack out of `open`, or out of `wait` without going through
     `tell` first, which is what stops the old behaviour where he simply
     emitted hearts on every landing until the floor was covered. Projectiles
     are hard-capped: at the cap, nothing new spawns, ever.
     ======================================================================= */
  function stepBoss(dt) {
    var b = G.level.boss, p = G.player;
    if (!b) return;
    var B = TUNE.boss, d = DIFF[G.diff];
    b.anim += dt;

    if (b.dead) {                        // he comes apart slowly, on purpose
      b.dead += dt;
      b.shots.length = 0;
      if (b.dead < 1.6 && Math.random() < .4)
        burst(b.x + b.w / 2 + (Math.random() - .5) * 30, b.y + b.h / 2 + (Math.random() - .5) * 24,
              4, ["#ff9ec4", "#ffffff", "#ffd166"], 70, { max: .7 });
      return;
    }
    if (!b.awake) {
      if (Math.abs(p.x - b.x) < B.wake) {
        b.awake = true; sfx("bossWake"); shake(6);
        b.mode = "wait"; b.modeT = bossSpec(b).wait;
      }
      stepBossShots(dt);
      return;
    }
    if (b.hurt > 0) b.hurt -= dt;
    if (b.flash > 0) b.flash -= dt;
    b.face = p.x < b.x ? -1 : 1;

    /* gravity always; he is a heavy thing */
    b.vy += 900 * dt;
    moveX(b, b.vx * dt);
    var wasGround = b.onGround;
    b.onGround = moveY(b, b.vy * dt, false) === "ground";
    if (b.onGround && !wasGround) bossLanded(b);

    /* ---- the loop ------------------------------------------------------ */
    b.modeT -= dt;
    if (b.modeT <= 0) bossNextMode(b);

    if (b.mode === "attack") bossAttackStep(b, dt);
    else if (b.mode !== "tell" && b.onGround) b.vx *= 0.82;   // he settles

    stepBossShots(dt);
    bossTouch(b);
  }

  /* wait -> tell -> attack -> open -> wait ... */
  function bossNextMode(b) {
    var B = TUNE.boss, sp = bossSpec(b), cd = DIFF[G.diff].bossCooldownMul;
    if (b.mode === "wait") {
      b.mode = "tell"; b.modeT = sp.tell;      // the tell is NEVER scaled
      sfx("bossHop");
      /* dust at his feet, so the wind-up is visible as well as audible */
      burst(b.x + b.w / 2, b.y + b.h, 10, ["#ffffff", "#ffd6e6"], 40, { g: 120, max: .5, lift: 6 });
    } else if (b.mode === "tell") {
      /* A hop ends when he lands, not when a clock says so. Scaling its
         window down on Hard made it expire mid-air, so he came down without
         the cracks that are the whole point of the attack. The ceiling here
         only exists so a hop that somehow never lands cannot hang him. */
      b.mode = "attack";
      b.modeT = sp.name === "hop" ? 2.4 : sp.attack * cd;
      bossAttackStart(b);
    } else if (b.mode === "attack") {
      /* The sweep never leaves the ground, so the landing hook that drops
         cracks after a hop never fires for it. It leaves them where it
         stops instead, which is also the fairer place for them. */
      if (sp.name === "sweep") {
        var n = sp.shots + DIFF[G.diff].bossExtraShot;
        for (var i = 0; i < n; i++)
          bossShoot(b, b.x + b.w / 2, b.y + b.h - 7,
                    (i % 2 ? 1 : -1) * TUNE.boss.shotSpeed * DIFF[G.diff].bossSpeedMul, 0, false);
        sfx("bossLand"); shake(5);
        burst(b.x + b.w / 2, b.y + b.h, 14, ["#ffd166", "#ffffff"], 100, { max: .5 });
      }
      b.mode = "open"; b.modeT = sp.open;      // the opening is never scaled
      b.vx = 0;
    } else {
      b.mode = "wait"; b.modeT = sp.wait * cd;
    }
  }

  function bossAttackStart(b) {
    var sp = bossSpec(b), mul = DIFF[G.diff].bossSpeedMul;
    if (sp.name === "hop") {
      b.vy = -330; b.vx = b.face * sp.speed * mul; b.hopsLeft = 1;
      b.onGround = false;
    } else if (sp.name === "rain") {
      /* he rears and throws a fixed spread — the same three arcs every time,
         so the way through them is something she can learn */
      var n = sp.shots + DIFF[G.diff].bossExtraShot;
      for (var i = 0; i < n; i++) {
        bossShoot(b, b.x + b.w / 2, b.y + 4,
                  (-1 + (2 * i) / Math.max(1, n - 1)) * 70 * mul, -190, true);
      }
      sfx("bossLand");
    } else {
      b.vx = b.face * sp.speed * mul;         // the sweep
      shake(3);
    }
  }

  function bossAttackStep(b, dt) {
    var sp = bossSpec(b);
    if (sp.name === "sweep" && b.onGround) {
      /* he grinds along the floor, throwing sparks, and drops a crack at
         each end of the run */
      if (Math.random() < 0.5)
        burst(b.x + b.w / 2 - b.face * 14, b.y + b.h - 2, 1,
              ["#ffd166", "#ffffff"], 40, { g: 200, max: .35, size: 1 });
      if (boxHitsSolid(b.x + b.face * 3, b.y, b.w, b.h)) { b.vx = 0; b.modeT = Math.min(b.modeT, 0.05); }
    }
  }

  function bossLanded(b) {
    var sp = bossSpec(b);
    shake(7); sfx("bossLand");
    burst(b.x + b.w / 2, b.y + b.h, 18, ["#ffffff", "#ff9ec4"], 120, { max: .5 });
    if (b.mode === "attack" && (sp.name === "hop" || sp.name === "sweep") && b.hopsLeft >= 0) {
      var n = sp.shots + DIFF[G.diff].bossExtraShot;
      for (var i = 0; i < n; i++) {
        var dir = i % 2 ? 1 : -1;
        bossShoot(b, b.x + b.w / 2, b.y + b.h - 7, dir * TUNE.boss.shotSpeed * DIFF[G.diff].bossSpeedMul, 0, false);
      }
      b.hopsLeft = -1;
      if (sp.name === "hop") b.modeT = 0.05;   // landed; hand over to the opening
    }
    b.vx = 0;
  }

  /* One place where a projectile can come into existence, so the cap can
     never be worked around by adding another attack later. */
  function bossShoot(b, x, y, vx, vy, arc) {
    if (b.shots.length >= TUNE.boss.maxShots + DIFF[G.diff].bossExtraShot) return;
    b.shots.push({ x: x, y: y, vx: vx, vy: vy, arc: !!arc, life: 0 });
  }

  function stepBossShots(dt) {
    var b = G.level.boss, p = G.player;
    for (var i = b.shots.length - 1; i >= 0; i--) {
      var s = b.shots[i];
      s.life += dt;
      s.x += s.vx * dt;
      if (s.arc) { s.vy += 520 * dt; s.y += s.vy * dt; }
      var gone = s.life > TUNE.boss.shotLife || boxHitsSolid(s.x, s.y, 6, 6) ||
                 s.y > G.level.pxH || s.x < -20 || s.x > G.level.pxW + 20;
      if (gone) {
        burst(s.x + 3, s.y + 3, 5, ["#ff9ec4", "#ffffff"], 40, { max: .3, size: 1 });
        b.shots.splice(i, 1); continue;
      }
      if (!p.dead && !p.winT && p.star <= 0 &&
          p.x + p.w > s.x && p.x < s.x + 6 && p.y + p.h > s.y && p.y < s.y + 6) {
        b.shots.splice(i, 1);
        hurtPlayer(false);
      }
    }
  }

  /* Landing on him. He can be hurt in any state — she does not have to wait
     for the opening — but the opening is when it is actually survivable. */
  function bossTouch(b) {
    var p = G.player;
    if (p.dead || p.winT) return;
    if (!(p.x + p.w > b.x + 3 && p.x < b.x + b.w - 3 &&
          p.y + p.h > b.y + 2 && p.y < b.y + b.h - 2)) return;

    var fromAbove = (p.y + p.h) - b.y < b.h * 0.5 && p.vy > 30;
    if (b.hurt > 0) return;

    if (fromAbove || p.star > 0) {
      var wasPhase = b.phase;
      b.hp--; b.hurt = 1.1;
      if (fromAbove) p.vy = -TUNE.stompBoost;
      shake(8); sfx("bossHit");
      burst(b.x + b.w / 2, b.y + 8, 22, ["#ffffff", "#ff5f95", "#ffd166"], 130, { max: .8 });

      if (b.hp <= 0) {
        b.dead = 0.001; b.shots.length = 0;
        addScore(TUNE.scores.boss);
        popText(b.x, b.y - 10, "+" + TUNE.scores.boss, "#fff6a8");
        sfx("bossDie"); shake(12);
        G.level.goal.open = true;
        return;
      }
      b.phase = bossPhase(b);
      if (b.phase !== wasPhase) {
        /* a phase change is a beat of its own: everything clears, he flares
           white, and neither of them does anything for a second */
        b.shots.length = 0;
        b.flash = 1;
        b.mode = "open"; b.modeT = 1;
        b.vx = 0;
        shake(10); sfx("bossWake");
        popText(b.x, b.y - 18, "!", "#fff6a8");
      } else {
        b.mode = "open"; b.modeT = Math.max(b.modeT, 0.7);
      }
      return;
    }
    if (p.star <= 0) hurtPlayer(false);
  }

  /* =======================================================================
     THE GOAL, THE CHECKPOINTS, AND THE WALK OFF THE END OF THE LEVEL
     ======================================================================= */
  function stepGoal(dt) {
    var L = G.level, p = G.player;
    if (p.dead || p.winT) return;

    L.checks.forEach(function (c) {
      if (c.taken) return;
      if (p.x + p.w > c.x && p.x < c.x + T && p.y + p.h > c.y - 8 && p.y < c.y + T) {
        c.taken = true;
        popText(c.x, c.y - 16, "checkpoint", "#8ff0a8");
        burst(c.x + 8, c.y, 14, ["#ffffff", "#8ff0a8", "#ffd6e6"], 70, { max: .7 });
        sfx("check");
      }
    });

    var g = L.goal;
    if (!g) return;
    /* on the last level the pole is chained shut until the boss is done */
    if (L.boss && !g.open) return;
    if (p.x + p.w > g.x && p.x < g.x + 10 && p.y + p.h > g.y - T * 5 && p.y < g.y + T) {
      p.winT = 0.001; p.vx = 0; p.vy = 0;
      /* how high up the pole she caught it is worth something */
      var high = clamp(1 - ((p.y + p.h) - (g.y - T * 5)) / (T * 5), 0, 1);
      G.poleBonus = Math.round(200 + high * 800);
      addScore(G.poleBonus);
      sfx("goal");
      burst(g.x + 4, p.y, 26, ["#ff5f95", "#fff6a8", "#ffffff"], 110, { max: 1 });
    }
  }

  /* She slides down the pole, then walks off to the right. */
  function stepWinWalk(dt) {
    var p = G.player, g = G.level.goal;
    p.winT += dt;
    if (p.winT < 0.9) {
      p.pose = "idle"; p.frame = 0;
      p.x = g.x - 6;
      p.y = Math.min(g.y - p.h, p.y + 90 * dt);
      if (Math.random() < .4) burst(p.x + 5, p.y + 6, 1, ["#fff6a8", "#ff9ec4"], 20, { g: 40, max: .6, size: 1 });
    } else {
      p.pose = "run"; p.face = 1;
      p.frame = Math.floor(p.winT * 9) % 4;
      p.x += 78 * dt;
      p.vy += TUNE.gravityDown * dt;
      moveY(p, p.vy * dt, true) === "ground" && (p.vy = 0);
      if (p.winT > 2.6) finishLevel();
    }
  }

  /* =======================================================================
     11. THE GAME LOOP — input has already been collected by the listeners,
         so a frame is only: step the world, move the camera, paint it.
     ======================================================================= */
  function step(dt) {
    if (G.state !== "play") return;
    G.elapsed += dt;

    var d = DIFF[G.diff];
    if (d.timeLimit && G.timeLeft > 0) {
      G.timeLeft -= dt;
      if (G.timeLeft <= 30 && !G.warned) { G.warned = true; sfx("hurry"); }
      if (G.timeLeft <= 0) { G.timeLeft = 0; hurtPlayer(true); }
    }

    stepPlayer(dt);
    stepEnemies(dt);
    stepItems(dt);
    stepBoss(dt);
    stepGoal(dt);
    stepParts(dt);

    for (var i = G.bumps.length - 1; i >= 0; i--) {
      G.bumps[i].t += dt;
      if (G.bumps[i].t > 0.22) G.bumps.splice(i, 1);
    }
    G.shake = Math.max(0, G.shake - dt * 26);
    moveCamera(dt);
    updateHud();
  }

  function moveCamera(dt) {
    var p = G.player, L = G.level, c = G.cam;
    /* look a little the way she is going, so she can see what is coming */
    var tx = p.x + p.w / 2 - VIEW.w / 2 + p.face * (VIEW.w * 0.106);
    var ty = p.y + p.h / 2 - VIEW.h * 0.533;
    if (G.camSnap) { c.x = tx; c.y = ty; G.camSnap = false; }
    else {
      c.x += (tx - c.x) * Math.min(1, dt * 7);
      c.y += (ty - c.y) * Math.min(1, dt * (p.onGround ? 4.5 : 2.6));
    }
    c.x = clamp(c.x, 0, Math.max(0, L.pxW - VIEW.w));
    c.y = clamp(c.y, 0, Math.max(0, L.pxH - VIEW.h));
  }

  /* =======================================================================
     PAINTING
     ======================================================================= */
  function paint(t) {
    var cv = G.canvas;
    if (!cv) return;
    var c = cv.getContext("2d");
    c.imageSmoothingEnabled = false;
    var L = G.level;
    if (!L) { c.clearRect(0, 0, VIEW.w, VIEW.h); return; }

    /* the shake is applied to the camera only for drawing, never to physics */
    var sh = G.shake;
    var ox = Math.round(G.cam.x + (sh ? (Math.random() - .5) * sh : 0));
    var oy = Math.round(G.cam.y + (sh ? (Math.random() - .5) * sh : 0));

    /* ---- 1. the backdrop, three layers at three speeds ------------------
       The parallax layers are offset vertically, which leaves a strip of
       bare canvas at the foot of the screen. Tiles normally cover it — but
       look down a bottomless pit and you would see straight through to
       nothing, so the whole frame is flooded with the sky's lowest colour
       first and the pit reads as distance instead of a hole in the page. */
    var bg = L.bg, BP = BIOME[L.biome];
    px(c, 0, 0, VIEW.w, VIEW.h, BP.sky[BP.sky.length - 1].c);
    /* Anything below the ground line that no layer reaches is darkness, not
       sky: without this, looking down a bottomless pit shows a bare slab of
       whatever colour the sky happens to end on. */
    var horizonY = Math.round(L.groundY - oy);
    if (horizonY < VIEW.h) px(c, 0, horizonY, VIEW.w, VIEW.h - horizonY, BP.mid[2]);
    c.drawImage(bg.sky, 0, Math.round(-oy * 0.12) - 6);

    /* Parallax is HORIZONTAL only for the two scenery layers. A tree stands
       on the same ground she does, so its base is at the same world Y as the
       ground and has to move exactly with it; scrolling it at 0.55 while the
       tiles scroll at 1.0 makes it drift twenty pixels as the camera rises
       and lands, which reads as the trees floating. Each layer is instead
       pinned by its own horizon to the level's real ground row, so it is
       planted at every camera height and in every world. Only the sky, which
       touches nothing, keeps a vertical drift. */
    drawTiled(c, bg.far, ox * 0.22, Math.round(L.groundY - bg.farHorizon - oy), bg.farW);
    drawTiled(c, bg.mid, ox * 0.52, Math.round(L.groundY - bg.midHorizon - oy), bg.midW);

    /* ---- 2. the tiles ---------------------------------------------------- */
    drawTiles(c, ox, oy, t);

    /* ---- 3. everything in the world ------------------------------------- */
    drawGoal(c, ox, oy, t);
    L.checks.forEach(function (ck) { drawCheck(c, ck, ox, oy, t); });
    L.items.forEach(function (it) { drawItem(c, it, ox, oy); });
    L.ents.forEach(function (e) { e.kind === "mover" ? drawMover(c, e, ox, oy) : drawEnemy(c, e, ox, oy); });
    drawBoss(c, ox, oy, t);
    drawPlayer(c, ox, oy, t);

    /* ---- 4. the sparkle and the fizz ------------------------------------ */
    G.parts.forEach(function (p) {
      var a = 1 - p.life / p.max;
      if (a < 0.35 && Math.sin(p.life * 50) < 0) return;
      px(c, p.x - ox, p.y - oy, a > .5 ? p.s : 1, a > .5 ? p.s : 1, p.c);
    });
    G.floats.forEach(function (f) {
      c.save();
      c.globalAlpha = clamp(1 - f.life / 0.9, 0, 1);
      c.font = "6px monospace"; c.textAlign = "center";
      c.fillStyle = "rgba(40,20,40,.6)"; c.fillText(f.t, f.x - ox + 1, f.y - oy + 1);
      c.fillStyle = f.c; c.fillText(f.t, f.x - ox, f.y - oy);
      c.restore();
    });

    /* a rainbow wash while the sparkle is on */
    if (G.player.star > 0) {
      c.save();
      c.globalAlpha = 0.1 + 0.06 * Math.sin(t * 14);
      c.fillStyle = ["#fff6a8", "#ffd6e6", "#d6f0ff", "#e6ffd6"][(t * 12 | 0) % 4];
      c.fillRect(0, 0, VIEW.w, VIEW.h);
      c.restore();
    }
    if (G.player.invuln > 0 && G.player.star <= 0) { /* handled by the flicker in drawPlayer */ }
  }

  /* A layer wide enough to repeat: drawn twice so the seam never shows. */
  function drawTiled(c, img, offset, y, width) {
    var x = -(offset % width);
    c.drawImage(img, Math.round(x), y);
    c.drawImage(img, Math.round(x + width), y);
    if (x + width < VIEW.w) c.drawImage(img, Math.round(x + width * 2), y);
  }

  function drawTiles(c, ox, oy, t) {
    var L = G.level, A = L.atlas;
    var x0 = Math.max(0, Math.floor(ox / T)), x1 = Math.min(L.w - 1, Math.floor((ox + VIEW.w) / T));
    var y0 = Math.max(0, Math.floor(oy / T)), y1 = Math.min(L.h - 1, Math.floor((oy + VIEW.h) / T));
    var P = BIOME[L.biome];

    for (var ty = y0; ty <= y1; ty++) {
      for (var tx = x0; tx <= x1; tx++) {
        var ch = L.grid[ty][tx];
        if (ch === "." || ch === "S" || ch === "G" || ch === "C") continue;
        var cell = -1;
        if (ch === "#") cell = !solidAt(tx, ty - 1) ? CELL.top
                             : solidAt(tx, ty - 2) ? CELL.deep : CELL.body;
        else if (ch === "-") cell = CELL.oneWay;
        else if (ch === "B") cell = CELL.brick;
        else if (GIFT.indexOf(ch) >= 0) cell = CELL.gift;
        else if (ch === "u") cell = CELL.used;
        else if (ch === "^") cell = CELL.spike;
        else if (ch === "~") cell = CELL.moat;
        if (cell < 0) continue;

        var dx = tx * T - ox, dy = ty * T - oy;

        /* the little upward knock when a block is hit from below */
        for (var b = 0; b < G.bumps.length; b++) {
          var bm = G.bumps[b];
          if (bm.tx === tx && bm.ty === ty) dy -= Math.round(Math.sin(bm.t / 0.22 * Math.PI) * 5);
        }

        if (ch === "~") {
          /* the moat ripples, and only its surface tile gets the bright top */
          var surface = tileAt(tx, ty - 1) !== "~";
          if (surface) {
            var wob = Math.round(Math.sin(t * 2.6 + tx * 0.8) * 1.4);
            c.drawImage(A, CELL.moat * T, 0, T, T, dx, dy + wob, T, T);
            px(c, dx, dy + wob, T, 1, P.hazard[0]);
            if ((tx + (t * 3 | 0)) % 7 === 0) px(c, dx + 4, dy + wob - 2, 2, 2, P.hazard[0]);
          } else {
            px(c, dx, dy, T, T, P.hazard[P.hazard.length - 1]);
            if ((tx * 3 + ty * 5) % 11 === 0) px(c, dx + 5, dy + 6, 3, 2, P.hazard[1]);
          }
          continue;
        }
        c.drawImage(A, cell * T, 0, T, T, dx, dy, T, T);
      }
    }
  }

  function drawPlayer(c, ox, oy, t) {
    var p = G.player;
    if (p.invuln > 0 && p.star <= 0 && Math.sin(t * 40) < 0) return;

    var set = OUISSY[p.pose] || OUISSY.idle;
    var arr = p.big ? set.big : set.small;
    var img = arr[Math.min(p.frame, arr.length - 1)];

    /* squash and stretch: a scale, not a new sprite. Positive squashes on
       landing, negative stretches on the way up. */
    var sq = clamp(p.squash, -1, 1.3);
    var sx = 1 + sq * 0.22, sy = 1 - sq * 0.26;
    var w = img.width * sx, h = img.height * sy;
    /* her feet stay put whatever the squash does to her height */
    var dx = Math.round(p.x + p.w / 2 - w / 2 - ox);
    var dy = Math.round(p.y + p.h - h + (p.big ? 2 : 1) - oy);

    c.save();
    if (p.star > 0) {
      /* the sparkle state tints her without redrawing every frame */
      c.globalAlpha = 0.92;
      c.filter = "hue-rotate(" + ((t * 320) % 360) + "deg) saturate(1.5)";
    }
    if (p.face < 0) {
      c.translate(dx + w, dy); c.scale(-1, 1);
      c.drawImage(img, 0, 0, w, h);
    } else {
      c.drawImage(img, dx, dy, w, h);
    }
    c.restore();
  }

  function drawEnemy(c, e, ox, oy) {
    if (!e.alive && e.dead <= 0) return;
    var img, dx = Math.round(e.x - ox), dy = Math.round(e.y - oy);
    if (dx < -40 || dx > VIEW.w + 40) return;

    if (!e.alive) {
      if (e.spun) {                       // knocked away by the sparkle state
        c.save(); c.translate(dx + e.w / 2, dy + e.h / 2);
        c.rotate((0.9 - e.dead) * 9); c.globalAlpha = clamp(e.dead / .9, 0, 1);
        img = e.type === "flyer" ? ART.flyer[0] : e.type === "guard" ? ART.guard[0] : ART.walker[0];
        c.drawImage(img, -img.width / 2, -img.height / 2);
        c.restore(); return;
      }
      c.save(); c.globalAlpha = clamp(e.dead / .45, 0, 1);
      c.drawImage(ART.walkerSquash, dx - 1, dy);
      c.restore(); return;
    }

    if (e.type === "flyer") img = ART.flyer[Math.floor(e.anim * 9) % 4];
    else if (e.type === "guard") img = ART.guard[Math.floor(e.anim * 6) % 2];
    else img = ART.walker[Math.floor(e.anim * 5) % 2];

    if (e.vx > 0) {
      c.save(); c.translate(dx + e.w, dy); c.scale(-1, 1);
      c.drawImage(img, 0, -1); c.restore();
    } else c.drawImage(img, dx - 1, dy - 1);
  }

  function drawMover(c, m, ox, oy) {
    var dx = Math.round(m.x - ox), dy = Math.round(m.y - oy);
    if (dx < -50 || dx > VIEW.w + 50) return;
    var P = BIOME[G.level.biome];
    c.save();
    if (m.type === "T") c.globalAlpha = m.fade;
    px(c, dx, dy, m.w, m.h, P.brick[1]);
    px(c, dx, dy, m.w, 1, P.brick[0]);
    px(c, dx, dy + m.h - 1, m.w, 1, P.brick[2]);
    for (var i = 2; i < m.w; i += 6) px(c, dx + i, dy + 2, 2, 2, P.brick[2]);
    /* a chain or a ribbon, so it reads as a thing that moves */
    if (m.type === "V") { px(c, dx + m.w / 2 - 1, dy - 40, 2, 40, "rgba(255,255,255,.22)"); }
    if (m.type === "H") { heart(c, dx + m.w / 2, dy + 3, 2, "#ff5f95"); }
    if (m.type === "T" && m.on) heart(c, dx + m.w / 2, dy + 3, 2, "#fff6a8");
    c.restore();
  }

  function drawItem(c, it, ox, oy) {
    var dx = Math.round(it.x - ox), dy = Math.round(it.y - oy);
    if (dx < -30 || dx > VIEW.w + 30) return;
    var k = Math.floor(it.anim) % 4;
    var bobY = it.floating ? Math.round(Math.sin(it.anim * 0.5) * 1.2) : 0;
    if (it.type === "heart") c.drawImage(ART.heart[k], dx - 2, dy - 2 + bobY);
    else c.drawImage(ART.power[it.type][k % 2], dx - 1, dy - 1 + bobY);
  }

  function drawCheck(c, ck, ox, oy, t) {
    var dx = Math.round(ck.x - ox), dy = Math.round(ck.y - oy);
    if (dx < -30 || dx > VIEW.w + 30) return;
    px(c, dx + 7, dy - 22, 2, 38, "#a3679a");                 // the post
    px(c, dx + 7, dy - 22, 1, 38, "#c48cbc");
    var sway = Math.sin(t * 2 + ck.x) * 1.5;
    var col = ck.taken ? "#8ff0a8" : "#ff9ec4";
    for (var i = 0; i < 8; i++) {                              // the ribbon
      var w = 9 - Math.abs(i - 3) * 0.7;
      px(c, dx + 9, dy - 21 + i, w + (ck.taken ? sway : 0), 1, i % 2 ? col : "#ffffff");
    }
    if (ck.taken) heart(c, dx + 8, dy - 25, 3, "#8ff0a8", "#ffffff");
  }

  function drawGoal(c, ox, oy, t) {
    var g = G.level.goal;
    if (!g) return;
    var dx = Math.round(g.x - ox), dy = Math.round(g.y - oy);
    if (dx < -60 || dx > VIEW.w + 80) return;
    var locked = G.level.boss && !g.open;

    /* the pole */
    for (var y = 0; y < T * 5 + 12; y++)
      px(c, dx + 2, dy + T - y, 3, 1, y % 6 < 3 ? "#ffd6e6" : "#ff9ec4");
    px(c, dx + 2, dy + T - (T * 5 + 12), 3, 2, OUI.crown);

    /* the heart on top, beating */
    var beat = 1 + Math.sin(t * 4) * 0.08;
    heart(c, dx + 3, dy - T * 4 - 6, 7 * beat, locked ? "#7a5a70" : "#3d2340");
    heart(c, dx + 3, dy - T * 4 - 6, 6 * beat, locked ? "#9a7a90" : "#ff5f95", locked ? null : "#ffd6e6");

    /* the ribbon banner hanging off it */
    for (var i = 0; i < 10; i++) {
      var w2 = 12 - Math.abs(i - 4) * 0.8 + Math.sin(t * 3 + i * 0.6) * 1.4;
      px(c, dx + 5, dy - T * 4 + 2 + i, w2, 1, locked ? "#8a6a80" : (i % 2 ? "#ff9ec4" : "#ffffff"));
    }
    if (locked) {
      /* a chain and a padlock, so it is obvious the boss is the way through */
      for (var ch = 0; ch < 5; ch++) px(c, dx, dy - ch * 8, 7, 3, "#c9c0d8");
      px(c, dx + 1, dy - T, 6, 6, OUI.crown);
      px(c, dx + 3, dy - T + 2, 2, 2, "#8a6432");
    }
  }

  function drawBoss(c, ox, oy, t) {
    var b = G.level.boss;
    if (!b) return;
    var dx = Math.round(b.x - ox - 3), dy = Math.round(b.y - oy - 4);

    /* his projectiles: cracked hearts, and the arcing ones trail */
    b.shots.forEach(function (s) {
      var sx = Math.round(s.x - ox), sy = Math.round(s.y - oy);
      if (s.arc) {
        px(c, sx + 1, sy - 3, 2, 2, "rgba(255,158,196,.5)");
        px(c, sx + 1, sy - 6, 1, 1, "rgba(255,158,196,.3)");
      }
      heart(c, sx, sy, 3.6, "#3d2340");
      heart(c, sx, sy, 2.8, Math.sin(t * 30 + s.life * 10) > 0 ? "#ff5f95" : "#ffd166");
    });

    if (b.dead) {
      if (b.dead > 1.6) return;
      c.save(); c.globalAlpha = clamp(1 - b.dead / 1.6, 0, 1);
      c.translate(dx + 20, dy + 17); c.rotate(b.dead * 1.6); c.scale(1 - b.dead * .4, 1 - b.dead * .4);
      c.drawImage(ART.boss[0], -20, -17);
      c.restore(); return;
    }
    if (!b.awake) { c.drawImage(ART.boss[Math.sin(t) > 0 ? 0 : 1], dx, dy); return; }

    /* THE TELL. This is the whole point of the redesign, so it is loud:
       he squashes down, a ring opens out from him, and the closer the
       attack gets the faster everything pulses. */
    if (b.mode === "tell") {
      var sp = bossSpec(b);
      var k = 1 - clamp(b.modeT / sp.tell, 0, 1);        // 0 -> 1 across the tell
      var ringR = 6 + k * 26;
      c.save();
      c.globalAlpha = 0.5 * (1 - k);
      c.strokeStyle = sp.name === "rain" ? "#ffd166" : "#ff5f95";
      c.lineWidth = 2;
      c.beginPath();
      c.arc(dx + 20, dy + 17, ringR, 0, 6.283);
      c.stroke();
      c.restore();
      /* an exclamation over his crown, blinking faster as it lands */
      if (Math.sin(t * (14 + k * 34)) > 0) {
        px(c, dx + 19, dy - 9, 2, 5, "#fff6a8");
        px(c, dx + 19, dy - 3, 2, 2, "#fff6a8");
      }
    }

    /* the sprite: frame 1 is his crouch, 2 his open mouth */
    var k2 = b.mode === "tell" ? 1 : b.mode === "attack" ? 2 : b.onGround ? 0 : 2;
    var white = b.flash > 0 ? Math.sin(b.flash * 26) > 0
              : b.hurt > 0 && Math.sin(b.hurt * 40) > 0;
    var img = (white ? ART.bossHurt : ART.boss)[k2];

    /* he heaves while he is open — the tell that he can be hit */
    var pant = b.mode === "open" ? Math.sin(t * 7) * 1.2 : 0;
    c.drawImage(img, dx, Math.round(dy + Math.abs(pant)));

    /* and a soft glow round him in the opening, so it reads as an invitation */
    if (b.mode === "open" && b.hurt <= 0) {
      c.save();
      c.globalAlpha = 0.16 + 0.1 * Math.sin(t * 5);
      c.fillStyle = "#fff6a8";
      c.fillRect(dx + 2, dy + 2, 36, 30);
      c.restore();
    }
  }

  /* =======================================================================
     12. SCREENS — the difficulty select, how to play, the pause menu, the
         results card and the ending. All of them are HTML injected into one
         overlay so they inherit the site's fonts and buttons.
     ======================================================================= */
  function $(id) { return document.getElementById(id); }

  function overlay(html, cls) {
    var ov = $("so-overlay");
    if (!ov) return;
    ov.className = "so-overlay on " + (cls || "");
    ov.innerHTML = html;
    /* a tall card (the ending) must start at its own top, not wherever the
       last overlay happened to be scrolled to */
    ov.scrollTop = 0;
    ov.setAttribute("aria-hidden", "false");
  }
  function closeOverlay() {
    var ov = $("so-overlay");
    if (!ov) return;
    ov.className = "so-overlay";
    ov.innerHTML = "";
    ov.setAttribute("aria-hidden", "true");
  }

  /* ---- what she has done before, kept per difficulty ------------------- */
  var BEST_KEY = "so_best", DIFF_KEY = "so_diff", HOWTO_KEY = "so_howto";
  function loadBest() {
    try { return JSON.parse(localStorage.getItem(BEST_KEY) || "{}") || {}; } catch (e) { return {}; }
  }
  function saveBest(b) { try { localStorage.setItem(BEST_KEY, JSON.stringify(b)); } catch (e) {} }
  function bestFor(diff) {
    var b = loadBest()[diff];
    return b || { score: 0, time: 0, hearts: 0, cleared: false };
  }

  /* ---- 1. the difficulty select ---------------------------------------- */
  function showDifficulty() {
    G.state = "menu";
    var saved = "medium";
    try { saved = localStorage.getItem(DIFF_KEY) || "medium"; } catch (e) {}
    var cards = ["easy", "medium", "hard"].map(function (k) {
      var d = DIFF[k], b = bestFor(k);
      return '<button class="so-diff-card' + (k === saved ? " sel" : "") + '" data-so-diff="' + k + '">' +
        '<span class="so-diff-hearts">' + Array(d.lives + 1).join("♥") + "</span>" +
        '<span class="so-diff-name">' + d.label + "</span>" +
        '<span class="so-diff-blurb">' + d.blurb + "</span>" +
        (b.cleared ? '<span class="so-diff-best">best ' + b.score + " · " + fmtTime(b.time) + "</span>"
                   : '<span class="so-diff-best">not yet finished</span>') +
        "</button>";
    }).join("");

    overlay(
      '<div class="so-menu">' +
        '<div class="so-logo" id="so-logo"></div>' +
        '<p class="so-tag">' + SO.tagline + "</p>" +
        '<div class="so-diff-row">' + cards + "</div>" +
        '<div class="so-menu-actions">' +
          '<button class="so-btn so-btn-go" id="so-play">PLAY</button>' +
          '<button class="so-btn" id="so-howto">HOW TO PLAY</button>' +
          '<button class="so-btn so-btn-quiet" id="so-quit-menu">← BACK</button>' +
        "</div>" +
      "</div>", "so-ov-menu");

    paintLogo($("so-logo"));
    var picked = saved;
    Array.prototype.forEach.call(document.querySelectorAll("[data-so-diff]"), function (b) {
      b.addEventListener("click", function () {
        picked = b.getAttribute("data-so-diff");
        Array.prototype.forEach.call(document.querySelectorAll("[data-so-diff]"), function (o) {
          o.classList.toggle("sel", o === b);
        });
        sfx("pick");
      });
    });
    $("so-play").addEventListener("click", function () {
      G.diff = picked;
      try { localStorage.setItem(DIFF_KEY, picked); } catch (e) {}
      var seen = false;
      try { seen = localStorage.getItem(HOWTO_KEY) === "1"; } catch (e) {}
      if (seen) beginRun(); else showHowTo(beginRun);
    });
    $("so-howto").addEventListener("click", function () { showHowTo(showDifficulty); });
    $("so-quit-menu").addEventListener("click", quitToHub);
  }

  /* the title, drawn as pixels rather than set in a font */
  function paintLogo(host) {
    if (!host) return;
    var s = spriteCanvas(200, 54), c = s.ctx;
    c.font = "bold 20px 'Press Start 2P', monospace";
    c.textAlign = "center";
    /* a heart behind the words */
    heart(c, 100, 30, 26, "rgba(255,95,149,.22)");
    var lines = [["SUPER", 20], ["OUISSY", 44]];
    lines.forEach(function (ln, i) {
      var txt = ln[0], y = ln[1];
      c.font = "bold " + (i ? 20 : 14) + "px 'Press Start 2P', monospace";
      c.fillStyle = "#3d2340";
      for (var dx = -2; dx <= 2; dx++) for (var dy = -2; dy <= 2; dy++) c.fillText(txt, 100 + dx, y + dy);
      c.fillStyle = i ? "#ff5f95" : "#ffd166";
      c.fillText(txt, 100, y);
      c.fillStyle = i ? "#ffb0cd" : "#ffeaa8";
      c.fillText(txt, 100, y - 2);
    });
    for (var i = 0; i < 26; i++) {
      var a = Math.random() * 6.28, r = 34 + Math.random() * 60;
      px(c, 100 + Math.cos(a) * r, 28 + Math.sin(a) * r * .45, 2, 2, Math.random() > .5 ? "#fff6a8" : "#ffffff");
    }
    host.innerHTML = "";
    host.appendChild(s.c);
  }

  /* ---- 2. how to play --------------------------------------------------- */
  function showHowTo(then) {
    var rows = SO.howTo.map(function (r) {
      return '<div class="so-how-row"><b>' + r[0] + "</b><span>" + r[1] + "</span></div>";
    }).join("");
    overlay(
      '<div class="so-card">' +
        '<h3 class="so-card-title">HOW TO PLAY</h3>' +
        '<div class="so-how">' + rows + "</div>" +
        '<p class="so-card-note">on a phone, use the buttons at the bottom of the screen</p>' +
        '<button class="so-btn so-btn-go" id="so-how-ok">GOT IT</button>' +
      "</div>", "so-ov-card");
    try { localStorage.setItem(HOWTO_KEY, "1"); } catch (e) {}
    $("so-how-ok").addEventListener("click", function () { closeOverlay(); then(); });
  }

  /* ---- 3. the card before each world ------------------------------------ */
  function showLevelCard(then) {
    var w = SO.worlds[G.levelIndex];
    G.state = "card";
    overlay(
      '<div class="so-card so-card-world">' +
        '<p class="so-world-kicker">WORLD ' + (G.levelIndex + 1) + "</p>" +
        '<h3 class="so-world-name">' + w.title + "</h3>" +
        '<p class="so-world-sub">' + w.card + "</p>" +
        '<p class="so-world-lives">OUISSY  ×  ' + G.lives + "</p>" +
      "</div>", "so-ov-card so-ov-world");
    setTimeout(function () {
      if (G.state !== "card") return;
      closeOverlay(); G.state = "play"; G.camSnap = true; then && then();
    }, 1700);
  }

  /* ---- 4. pause --------------------------------------------------------- */
  function togglePause(force) {
    if (G.state === "play" && force !== false) {
      G.state = "paused";
      bgmDuck(true);
      overlay(
        '<div class="so-card">' +
          '<h3 class="so-card-title">PAUSED</h3>' +
          '<div class="so-pause-diff">' +
            ["easy", "medium", "hard"].map(function (k) {
              return '<button class="so-mini' + (k === G.diff ? " sel" : "") + '" data-so-setdiff="' + k + '">' +
                DIFF[k].label + "</button>";
            }).join("") +
          "</div>" +
          '<p class="so-card-note">changing it restarts this world</p>' +
          '<button class="so-btn so-btn-go" id="so-resume">RESUME</button>' +
          '<button class="so-btn" id="so-restart">RESTART WORLD</button>' +
          '<button class="so-btn" id="so-bgm">MUSIC: ' + (G.bgmOn ? "ON" : "OFF") + "</button>" +
          '<button class="so-btn so-btn-quiet" id="so-quit">QUIT TO HUB</button>' +
        "</div>", "so-ov-card");
      $("so-resume").addEventListener("click", function () { togglePause(false); });
      $("so-restart").addEventListener("click", function () { closeOverlay(); startLevel(G.levelIndex); });
      $("so-bgm").addEventListener("click", function () {
        setBgm(!G.bgmOn); $("so-bgm").textContent = "MUSIC: " + (G.bgmOn ? "ON" : "OFF");
      });
      $("so-quit").addEventListener("click", quitToHub);
      Array.prototype.forEach.call(document.querySelectorAll("[data-so-setdiff]"), function (b) {
        b.addEventListener("click", function () {
          var k = b.getAttribute("data-so-setdiff");
          if (k === G.diff) return;
          G.diff = k;
          try { localStorage.setItem(DIFF_KEY, k); } catch (e) {}
          G.lives = DIFF[k].lives;
          closeOverlay(); startLevel(G.levelIndex);
        });
      });
    } else if (G.state === "paused") {
      closeOverlay(); G.state = "play"; bgmDuck(false);
      G.keys.left = G.keys.right = G.keys.down = G.keys.jump = false;
    }
  }

  /* ---- 5. the results card after a world -------------------------------- */
  function finishLevel() {
    G.state = "results";
    var d = DIFF[G.diff];
    var timeBonus = d.timeLimit ? Math.round(G.timeLeft) * TUNE.scores.timeBonus : 0;
    G.score += timeBonus;
    G.levelStats.push({ time: G.elapsed - G.levelStartT, hearts: G.hearts - G.levelStartHearts, deaths: G.deaths - G.levelStartDeaths });
    var st = G.levelStats[G.levelStats.length - 1];
    sfx("fanfare");

    var last = G.levelIndex >= LEVELS.length - 1;
    overlay(
      '<div class="so-card so-card-res">' +
        '<h3 class="so-card-title">WORLD ' + (G.levelIndex + 1) + " CLEARED</h3>" +
        '<div class="so-res">' +
          row("TIME", fmtTime(st.time)) +
          row("HEARTS", st.hearts) +
          row("FALLS", st.deaths) +
          row("POLE", "+" + (G.poleBonus || 0)) +
          (timeBonus ? row("TIME BONUS", "+" + timeBonus) : "") +
          row("SCORE", pad(G.score, 6)) +
        "</div>" +
        '<button class="so-btn so-btn-go" id="so-next">' + (last ? "TO THE CASTLE ♥" : "NEXT WORLD →") + "</button>" +
      "</div>", "so-ov-card");
    function row(a, b) { return '<div class="so-res-row"><span>' + a + "</span><b>" + b + "</b></div>"; }
    $("so-next").addEventListener("click", function () {
      closeOverlay();
      if (last) showEnding();
      else { G.levelIndex++; startLevel(G.levelIndex); }
    });
  }

  /* ---- 6. game over ------------------------------------------------------ */
  function endRun(won) {
    G.state = "over";
    bgmDuck(true);
    sfx("gameover");
    overlay(
      '<div class="so-card">' +
        '<h3 class="so-card-title">OUT OF LIVES</h3>' +
        '<p class="so-card-note">she is not giving up. she just needs a run-up.</p>' +
        '<div class="so-res">' +
          '<div class="so-res-row"><span>SCORE</span><b>' + pad(G.score, 6) + "</b></div>" +
          '<div class="so-res-row"><span>HEARTS</span><b>' + G.hearts + "</b></div>" +
        "</div>" +
        '<button class="so-btn so-btn-go" id="so-again">TRY THIS WORLD AGAIN</button>' +
        '<button class="so-btn" id="so-easier">CHANGE DIFFICULTY</button>' +
        '<button class="so-btn so-btn-quiet" id="so-over-quit">QUIT TO HUB</button>' +
      "</div>", "so-ov-card");
    $("so-again").addEventListener("click", function () {
      closeOverlay(); G.lives = DIFF[G.diff].lives; bgmDuck(false); startLevel(G.levelIndex);
    });
    $("so-easier").addEventListener("click", function () { bgmDuck(false); showDifficulty(); });
    $("so-over-quit").addEventListener("click", quitToHub);
  }

  /* ---- 7. the ending: the castle, and him in it -------------------------- */
  function showEnding() {
    G.state = "ending";
    setBgm(false);
    /* remember the run */
    var all = loadBest(), b = all[G.diff] || { score: 0, time: 0, hearts: 0, cleared: false };
    var total = G.elapsed;
    if (G.score > b.score) b.score = G.score;
    if (!b.time || total < b.time) b.time = total;
    if (G.hearts > b.hearts) b.hearts = G.hearts;
    b.cleared = true;
    all[G.diff] = b; saveBest(all);
    if (window.markSuperOuissyDone) window.markSuperOuissyDone();

    overlay(
      '<div class="so-end">' +
        '<div class="so-end-art" id="so-end-art"></div>' +
        '<p class="so-end-kicker">' + SO.ending.kicker + "</p>" +
        '<div class="so-end-lines">' + SO.ending.lines.map(function (l) { return "<p>" + l + "</p>"; }).join("") + "</div>" +
        '<p class="so-end-joke">' + SO.ending.notAnotherCastle + "</p>" +
        '<p class="so-end-sign">' + SO.ending.signOff + "</p>" +
        '<div class="so-res so-end-res">' +
          '<div class="so-res-row"><span>FINAL SCORE</span><b>' + pad(G.score, 6) + "</b></div>" +
          '<div class="so-res-row"><span>HEARTS</span><b>' + G.hearts + "</b></div>" +
          '<div class="so-res-row"><span>TOTAL TIME</span><b>' + fmtTime(total) + "</b></div>" +
          '<div class="so-res-row"><span>DIFFICULTY</span><b>' + DIFF[G.diff].label + "</b></div>" +
        "</div>" +
        '<div class="so-menu-actions">' +
          '<button class="so-btn so-btn-go" id="so-end-again">PLAY AGAIN</button>' +
          '<button class="so-btn so-btn-quiet" id="so-end-quit">BACK TO THE HUB</button>' +
        "</div>" +
      "</div>", "so-ov-end");
    startEndingArt($("so-end-art"));
    sfx("victory");
    $("so-end-again").addEventListener("click", function () { closeOverlay(); showDifficulty(); });
    $("so-end-quit").addEventListener("click", quitToHub);
  }

  /* The last picture: a lit castle doorway, Ouissy, and him waiting. */
  var endRaf = null;
  function startEndingArt(host) {
    if (!host) return;
    var s = spriteCanvas(240, 120), c = s.ctx;
    host.innerHTML = ""; host.appendChild(s.c);
    var t0 = 0;
    function frame(now) {
      endRaf = requestAnimationFrame(frame);
      if (!t0) t0 = now;
      var t = (now - t0) / 1000;
      var P = BIOME.castle;
      ditherSky(c, 0, 0, 240, 120, P.sky);
      var rnd = seeded("endsky");
      for (var i = 0; i < 50; i++) {
        var sx = rnd() * 240, sy = rnd() * 60;
        if (Math.sin(t * 2 + sx) > -0.4) px(c, sx, sy, 1, 1, "#ffe9c8");
      }
      /* the castle */
      px(c, 40, 34, 160, 76, "#6b4f80");
      px(c, 40, 34, 160, 2, "#8a68a4");
      for (var tw = 0; tw < 3; tw++) {
        var tx = 44 + tw * 74;
        px(c, tx, 18, 26, 92, "#7d5590");
        px(c, tx, 18, 2, 92, "#a97fbe");
        px(c, tx - 3, 12, 32, 6, "#a97fbe");
        for (var cr = 0; cr < 32; cr += 7) px(c, tx - 3 + cr, 6, 4, 6, "#a97fbe");
      }
      /* windows, warm */
      for (var wx = 56; wx < 190; wx += 22)
        for (var wy = 46; wy < 86; wy += 24) {
          var lit = Math.sin(t * 1.4 + wx * 0.3 + wy) > -0.5;
          px(c, wx, wy, 6, 9, lit ? "#ffcf6a" : "#4d375e");
          if (lit) px(c, wx, wy, 6, 2, "#fff0b0");
        }
      /* the doorway, wide open */
      px(c, 108, 74, 26, 36, "#3d2340");
      px(c, 110, 76, 22, 34, "#ffd8a0");
      for (var a2 = 0; a2 < 12; a2++) px(c, 110 + a2, 74 - Math.round(Math.sqrt(144 - (a2 - 11) * (a2 - 11))), 24 - a2 * 2, 3, "#ffd8a0");

      /* him, waiting in the light */
      var pb = Math.sin(t * 2) > 0 ? 0 : 1;
      px(c, 116, 88 + pb, 8, 14, "#3d5a8a");           // his coat
      px(c, 116, 88 + pb, 8, 2, "#5a7ab0");
      blob(c, 120, 84 + pb, 5, 5, ["#ffd9c4", "#f0b096", "#d8967c", "#c07f66"]);
      px(c, 116, 79 + pb, 9, 3, "#3a2a22");             // his hair
      px(c, 118, 84 + pb, 1, 1, "#3d2340"); px(c, 122, 84 + pb, 1, 1, "#3d2340");
      px(c, 119, 87 + pb, 3, 1, "#3d2340");

      /* her, arriving */
      var walk = Math.min(1, t / 3.2);
      var ox2 = 20 + walk * 76;
      var img = walk < 1 ? OUISSY.run.small[Math.floor(t * 8) % 4] : OUISSY.win.small[0];
      c.drawImage(img, Math.round(ox2), 88 - (walk < 1 ? 0 : Math.abs(Math.sin(t * 3)) * 3));

      /* hearts rising between them once she is there */
      if (walk >= 1) {
        for (var h2 = 0; h2 < 7; h2++) {
          var hp = (t * 0.5 + h2 / 7) % 1;
          heart(c, 104 + Math.sin(hp * 7 + h2) * 8, 100 - hp * 60, 3 - hp * 1.6,
                ["#ff5f95", "#ffd166", "#ffffff"][h2 % 3]);
        }
      }
      /* falling sparkles over the whole scene */
      for (var k2 = 0; k2 < 30; k2++) {
        var kx = (k2 * 53) % 240, ky = ((t * (14 + k2 % 7) + k2 * 31) % 130);
        px(c, kx, ky, 1, 1, Math.sin(t * 6 + k2) > 0 ? "#fff6a8" : "#ffd6e6");
      }
    }
    endRaf = requestAnimationFrame(frame);
  }
  function stopEndingArt() { if (endRaf) cancelAnimationFrame(endRaf); endRaf = null; }

  /* =======================================================================
     THE HUD
     ======================================================================= */
  function pad(n, w) { n = Math.max(0, Math.round(n)) + ""; while (n.length < w) n = "0" + n; return n; }
  function fmtTime(s) {
    s = Math.max(0, s);
    var m = Math.floor(s / 60), r = Math.floor(s % 60);
    return m + ":" + (r < 10 ? "0" : "") + r;
  }
  function addScore(n) { G.score += n; }

  function updateHud() {
    var d = DIFF[G.diff];
    setText("so-score", pad(G.score, 6));
    setText("so-hearts", pad(G.hearts, 2));
    setText("so-world", (G.levelIndex + 1) + "-1");
    setText("so-lives", "×" + Math.max(0, G.lives));
    var timeEl = $("so-time");
    if (timeEl) {
      if (d.timeLimit) {
        timeEl.textContent = pad(G.timeLeft, 3);
        timeEl.parentNode.classList.toggle("low", G.timeLeft < 30);
      } else {
        timeEl.textContent = fmtTime(G.elapsed - G.levelStartT);
        timeEl.parentNode.classList.remove("low");
      }
    }
    var bar = $("so-bossbar");
    if (bar) {
      var b = G.level && G.level.boss;
      bar.classList.toggle("on", !!(b && b.awake && !b.dead));
      if (b) {
        var fill = $("so-bossfill");
        if (fill) fill.style.width = Math.max(0, (b.hp / b.hpMax) * 100) + "%";
      }
    }
    var st = $("so-stage");
    if (st) {
      st.classList.toggle("so-big", G.player.big);
      st.classList.toggle("so-star", G.player.star > 0);
    }
  }
  function setText(id, v) { var e = $(id); if (e && e.textContent !== v) e.textContent = v; }

  /* =======================================================================
     13. SOUND — Web Audio only. There is not a single audio file in this
         game, so it adds nothing to the size of the repo.
     ======================================================================= */
  var ac = null;
  function actx() {
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      if (!ac) ac = window.__soAudio || (window.__soAudio = new AC());
      if (ac.state === "suspended") ac.resume();
      return ac;
    } catch (e) { return null; }
  }

  var SFX = {
    jump:     { type: "square",   f: 340,  to: 720,  d: .13, v: .05 },
    wing:     { type: "triangle", f: 520,  to: 1040, d: .18, v: .05 },
    heart:    { type: "triangle", f: 880,  to: 1500, d: .12, v: .06 },
    stomp:    { type: "square",   f: 300,  to: 90,   d: .14, v: .06 },
    bump:     { type: "square",   f: 200,  to: 320,  d: .07, v: .05 },
    break:    { type: "sawtooth", f: 420,  to: 110,  d: .2,  v: .05 },
    power:    { type: "triangle", f: 520,  to: 1560, d: .38, v: .07 },
    life:     { type: "triangle", f: 660,  to: 1320, d: .34, v: .07 },
    shrink:   { type: "sawtooth", f: 620,  to: 180,  d: .3,  v: .05 },
    die:      { type: "sawtooth", f: 420,  to: 70,   d: .6,  v: .06 },
    save:     { type: "sine",     f: 300,  to: 900,  d: .3,  v: .05 },
    check:    { type: "triangle", f: 700,  to: 1180, d: .26, v: .06 },
    goal:     { type: "triangle", f: 600,  to: 1600, d: .5,  v: .07 },
    star:     { type: "square",   f: 900,  to: 1700, d: .12, v: .05 },
    pick:     { type: "square",   f: 520,  to: 780,  d: .08, v: .04 },
    blink:    { type: "square",   f: 900,  to: 400,  d: .1,  v: .04 },
    hurry:    { type: "square",   f: 880,  to: 880,  d: .5,  v: .05 },
    bossWake: { type: "sawtooth", f: 120,  to: 60,   d: .8,  v: .07 },
    bossHop:  { type: "square",   f: 180,  to: 260,  d: .1,  v: .04 },
    bossLand: { type: "sawtooth", f: 140,  to: 50,   d: .25, v: .07 },
    bossHit:  { type: "square",   f: 700,  to: 200,  d: .28, v: .07 },
    bossDie:  { type: "sawtooth", f: 300,  to: 40,   d: 1.1, v: .08 },
    gameover: { type: "triangle", f: 400,  to: 120,  d: .9,  v: .06 },
  };

  function sfx(kind) {
    var c = actx();
    if (!c || !G || G.muted) return;
    if (kind === "fanfare") return arpeggio([523, 659, 784, 1047], .1, "triangle");
    if (kind === "victory") return arpeggio([523, 659, 784, 1047, 1319, 1568], .12, "triangle");
    var spec = SFX[kind];
    if (!spec) return;
    try {
      var t = c.currentTime, o = c.createOscillator(), g = c.createGain();
      o.type = spec.type;
      o.frequency.setValueAtTime(spec.f, t);
      o.frequency.exponentialRampToValueAtTime(Math.max(20, spec.to), t + spec.d);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(spec.v, t + .012);
      g.gain.exponentialRampToValueAtTime(0.0001, t + spec.d);
      o.connect(g); g.connect(c.destination);
      o.start(t); o.stop(t + spec.d + .02);
    } catch (e) {}
  }

  function arpeggio(notes, gap, type) {
    var c = actx(); if (!c) return;
    notes.forEach(function (f, i) {
      try {
        var t = c.currentTime + i * gap, o = c.createOscillator(), g = c.createGain();
        o.type = type || "square"; o.frequency.value = f;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(.07, t + .01);
        g.gain.exponentialRampToValueAtTime(0.0001, t + gap * 2.2);
        o.connect(g); g.connect(c.destination);
        o.start(t); o.stop(t + gap * 2.4);
      } catch (e) {}
    });
  }

  /* ---- the background music: a short chiptune loop, written as note
          numbers so you can retune it without touching the player ------- */
  var BGM = {
    /* one bar is 8 steps; 0 is a rest. Numbers are semitones from C4. */
    lead: [
      12, 0, 16, 0, 19, 0, 16, 0,  14, 0, 17, 0, 21, 0, 17, 0,
      12, 0, 16, 0, 19, 12, 24, 0, 21, 19, 16, 0, 14, 0, 12, 0,
    ],
    bass: [
      0, 0, 7, 0, 0, 0, 7, 0,   2, 0, 9, 0, 2, 0, 9, 0,
      0, 0, 7, 0, 0, 0, 7, 0,   5, 0, 0, 0, 7, 0, 7, 0,
    ],
    tempo: 0.14,
  };
  var bgmTimer = null, bgmStep = 0, bgmGain = null;

  function setBgm(on) {
    G.bgmOn = on;
    try { localStorage.setItem("so_bgm", on ? "1" : "0"); } catch (e) {}
    if (!on) { stopBgm(); return; }
    var c = actx(); if (!c) return;
    if (!bgmGain) { bgmGain = c.createGain(); bgmGain.gain.value = 0.055; bgmGain.connect(c.destination); }
    if (bgmTimer) return;
    bgmStep = 0;
    bgmTimer = setInterval(tickBgm, BGM.tempo * 1000);
  }
  function stopBgm() { if (bgmTimer) clearInterval(bgmTimer); bgmTimer = null; }
  function bgmDuck(on) { if (bgmGain) bgmGain.gain.value = on ? 0.014 : 0.055; }

  function tickBgm() {
    var c = actx(); if (!c || !bgmGain) return;
    var i = bgmStep % BGM.lead.length;
    voice(c, BGM.lead[i], "square", 0, BGM.tempo * 0.9, .5);
    voice(c, BGM.bass[i], "triangle", -24, BGM.tempo * 1.6, .8);
    bgmStep++;
  }
  function voice(c, note, type, shift, dur, vol) {
    if (!note) return;
    try {
      var t = c.currentTime;
      var o = c.createOscillator(), g = c.createGain();
      o.type = type;
      o.frequency.value = 261.63 * Math.pow(2, (note + shift) / 12);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + .01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(bgmGain);
      o.start(t); o.stop(t + dur + .02);
    } catch (e) {}
  }
  /* =======================================================================
     INPUT — keyboard and the on-screen pad write into the same little
     object, so nothing downstream ever needs to know which was used.
     ======================================================================= */
  function freshKeys() {
    return { left: false, right: false, down: false, jump: false, jumpPressed: false };
  }

  function onScreen() {
    var s = $("screen-ouissy");
    return !!s && s.classList.contains("active");
  }

  var KEYMAP = {
    ArrowLeft: "left", a: "left", A: "left", q: "left", Q: "left",
    ArrowRight: "right", d: "right", D: "right",
    ArrowDown: "down", s: "down", S: "down",
    ArrowUp: "jump", w: "jump", W: "jump", z: "jump", Z: "jump", " ": "jump",
  };

  function bindInput() {
    document.addEventListener("keydown", function (e) {
      if (!onScreen()) return;
      if (e.key === "Escape" || e.key === "p" || e.key === "P") {
        e.preventDefault();
        if (G.state === "play" || G.state === "paused") togglePause();
        return;
      }
      var k = KEYMAP[e.key];
      if (!k) return;
      e.preventDefault();
      if (k === "jump" && !G.keys.jump) G.keys.jumpPressed = true;
      G.keys[k] = true;
    }, { passive: false });

    document.addEventListener("keyup", function (e) {
      if (!onScreen()) return;
      var k = KEYMAP[e.key];
      if (!k) return;
      e.preventDefault();
      G.keys[k] = false;
    }, { passive: false });

    /* the pad. pointer events cover mouse, pen and finger in one go, and
       setPointerCapture means a finger that slides off the button still
       counts as held — which is how she will actually hold it. */
    Array.prototype.forEach.call(document.querySelectorAll("[data-so-key]"), function (btn) {
      var k = btn.getAttribute("data-so-key");
      function down(e) {
        e.preventDefault();
        btn.classList.add("held");
        if (k === "jump" && !G.keys.jump) G.keys.jumpPressed = true;
        G.keys[k] = true;
        try { btn.setPointerCapture(e.pointerId); } catch (er) {}
      }
      function up(e) {
        if (e) e.preventDefault();
        btn.classList.remove("held");
        G.keys[k] = false;
      }
      btn.addEventListener("pointerdown", down);
      btn.addEventListener("pointerup", up);
      btn.addEventListener("pointercancel", up);
      btn.addEventListener("lostpointercapture", up);
      btn.addEventListener("contextmenu", function (e) { e.preventDefault(); });
    });

    var pb = $("so-pause-btn");
    if (pb) pb.addEventListener("click", function () { if (G.state === "play" || G.state === "paused") togglePause(); });

    /* losing the tab should not mean losing a life */
    document.addEventListener("visibilitychange", function () {
      if (document.hidden && onScreen() && G.state === "play") togglePause();
    });
  }

  /* =======================================================================
     RUN AND LEVEL LIFECYCLE
     ======================================================================= */
  function beginRun() {
    closeOverlay();
    G.lives = DIFF[G.diff].lives;
    G.score = 0; G.hearts = 0; G.deaths = 0; G.elapsed = 0;
    G.levelIndex = 0; G.levelStats = [];
    var want = true;
    try { want = localStorage.getItem("so_bgm") !== "0"; } catch (e) {}
    setBgm(want);
    startLevel(0);
  }

  function startLevel(i) {
    G.levelIndex = i;
    G.level = buildLevel(i);
    G.player = mkPlayer(G.level.start.x + 2, G.level.start.y - 2);
    G.parts = []; G.floats = []; G.bumps = [];
    G.cam = { x: 0, y: 0 }; G.camSnap = true;
    G.shake = 0; G.poleBonus = 0; G.warned = false;
    G.levelStartT = G.elapsed;
    G.levelStartHearts = G.hearts;
    G.levelStartDeaths = G.deaths;
    var d = DIFF[G.diff];
    G.timeLeft = d.timeLimit ? d.timeLimit[i] : 0;
    G.keys = freshKeys();
    moveCamera(1);
    updateHud();
    showLevelCard();
  }

  function quitToHub() {
    stop();
    if (window.leaveSuperOuissy) window.leaveSuperOuissy();
  }

  /* =======================================================================
     THE FRAME DRIVER

     A fixed step keeps the physics identical on a 60Hz phone and a 144Hz
     monitor; whatever time is left over is carried into the next frame.
     ======================================================================= */
  var raf = null, lastT = 0, acc = 0;
  var STEP = 1 / 60, MAX_FRAME = 0.1;

  function frame(now) {
    raf = requestAnimationFrame(frame);
    if (!lastT) lastT = now;
    var dt = Math.min(MAX_FRAME, (now - lastT) / 1000);
    lastT = now;

    if (!onScreen()) return;

    /* the offline harness drives step() itself, so the loop only paints */
    if (window.__soTestDrive) { paint(now / 1000); return; }

    if (G.state === "play") {
      acc += dt;
      var guard = 0;
      while (acc >= STEP && guard++ < 6) { step(STEP); acc -= STEP; }
    } else {
      acc = 0;
      /* even paused, the world keeps breathing — sprites still animate */
      if (G.level) { stepParts(Math.min(dt, .05)); G.shake = Math.max(0, G.shake - dt * 26); }
    }
    paint(now / 1000);
  }

  function onResize() { pickView(); fitStage(); }

  function fitStage() {
    /* The canvas is letterboxed by CSS; this only keeps the pad out of the
       way when there is no room for it under the stage in landscape. */
    var st = $("so-stage"), fr = $("screen-ouissy");
    if (!st || !fr) return;
    fr.classList.toggle("so-landscape", window.innerWidth > window.innerHeight * 1.25);
  }

  /* =======================================================================
     14. PUBLIC API
     ======================================================================= */
  var booted = false;

  function start() {
    G = {
      diff: "medium", state: "menu", level: null, levelIndex: 0,
      lives: 3, score: 0, hearts: 0, deaths: 0, elapsed: 0,
      levelStartT: 0, levelStartHearts: 0, levelStartDeaths: 0,
      timeLeft: 0, warned: false, poleBonus: 0, levelStats: [],
      player: mkPlayer(0, 0), parts: [], floats: [], bumps: [],
      cam: { x: 0, y: 0 }, camSnap: true, shake: 0,
      keys: freshKeys(), canvas: $("so-canvas"),
      bgmOn: false, muted: false, bossBar: 1,
    };
    if (!booted) { bindInput(); booted = true; }
    window.addEventListener("resize", onResize);
    pickView();
    fitStage();
    if (window.duckAmbient) window.duckAmbient(true);
    lastT = 0; acc = 0;
    if (!raf) raf = requestAnimationFrame(frame);
    showDifficulty();
  }

  function stop() {
    if (raf) cancelAnimationFrame(raf);
    raf = null;
    stopBgm();
    stopEndingArt();
    closeOverlay();
    if (window.duckAmbient) window.duckAmbient(false);
    if (G) G.state = "menu";
  }

  /* Two hooks used only by the offline screenshot harness, so the game can
     be driven and inspected without a person at the keyboard. They read
     and move state that is already public to the loop; nothing in the game
     itself calls them. */
  /* =======================================================================
     OFFLINE TEST HOOKS

     None of this runs while she plays; nothing in the game calls any of it.
     It exists so the game can be driven and inspected from a headless
     browser, which is how every bug in this file was actually found —
     reading the code was not enough for a single one of them.

     The one that matters is __soPump: requestAnimationFrame runs at about
     three frames a second in a headless container, so a test that waited on
     real time ran in slow motion and proved nothing. Setting
     __soTestDrive makes the frame loop paint only, and __soPump advances
     the world by an exact number of fixed steps instead.

     There is a harness in the scratchpad of the session that wrote this;
     if it is gone, the shape of it is: serve the folder, open the page,
     window.__soTestDrive = true, then pump and assert.
     ======================================================================= */

  /* --- driving --- */
  window.__soPump = function (seconds, keys) {
    if (keys) for (var k in keys) {
      if (k === "jump" && keys[k] && !G.keys.jump) G.keys.jumpPressed = true;
      G.keys[k] = keys[k];
    }
    var n = Math.round((seconds || 1) * 60);
    for (var i = 0; i < n; i++) step(1 / 60);
    paint(performance.now() / 1000);
    return window.__soState();
  };
  window.__soHalt = function () { if (raf) cancelAnimationFrame(raf); raf = null; };
  window.__soHaltUndo = function () { if (!raf) { lastT = 0; raf = requestAnimationFrame(frame); } };

  /* --- putting her somewhere --- */
  window.__soGoLevel = function (i) { startLevel(i); };
  window.__soShowEnding = function () { showEnding(); };
  window.__soTele = function (tx, ty) {
    if (!G || !G.level) return;
    G.player.x = tx * T;
    if (ty === undefined) {
      /* the real floor: first solid tile scanning UP from the bottom, then
         the top of that run. Scanning down from the sky lands her on the
         roof of whatever block happens to be in the column. */
      var r = G.level.h - 1;
      while (r >= 0 && !solidAt(tx, r)) r--;
      while (r > 0 && solidAt(tx, r - 1)) r--;
      G.player.y = r < 0 ? -16 : r * T - G.player.h - 1;
    } else G.player.y = ty * T;
    G.player.vx = 0; G.player.vy = 0;
    G.camSnap = true; moveCamera(1);
  };
  window.__soReset = function () {
    var keep = { score: G.score, hearts: G.hearts, deaths: G.deaths };
    G.player = mkPlayer(G.level.start.x + 2, G.level.start.y - 2);
    G.lives = DIFF[G.diff].lives;
    G.score = keep.score; G.hearts = keep.hearts; G.deaths = keep.deaths;
    G.state = "play";
    G.keys = freshKeys();
  };
  window.__soMakeBig = function () { setBig(G.player, true); };
  /* read or poke the player directly — G is module-scoped, so a test in the
     page has no other way to set up a state like "already has the feather" */
  window.__soPlayer = function (patch) {
    if (patch) for (var k in patch) G.player[k] = patch[k];
    var p = G.player;
    return { x: p.x, y: p.y, vy: p.vy, big: p.big, star: p.star, wing: p.wing,
             jumpsLeft: p.jumpsLeft, onGround: p.onGround, dead: p.dead };
  };
  window.__soSetTime = function (t) { G.timeLeft = t; };
  window.__soBossSet = function (patch) { var b = G.level.boss; if (b) { for (var k in patch) b[k] = patch[k]; b.phase = bossPhase(b); } };
  window.__soBoss = function () {
    var b = G.level.boss; if (!b) return null;
    return { hp: b.hp, hpMax: b.hpMax, phase: b.phase, mode: b.mode,
             modeT: +b.modeT.toFixed(2), shots: b.shots.length, awake: b.awake, dead: b.dead };
  };
  window.__soEnemies = function () {
    return G.level.ents.filter(function (e) { return e.kind === "enemy"; })
      .map(function (e) { return { type: e.type, x: Math.round(e.x), y: Math.round(e.y),
                                   vx: Math.round(e.vx), alive: e.alive }; });
  };
  window.__soCam = function () { return { x: Math.round(G.cam.x), y: Math.round(G.cam.y) }; };
  window.__soDiffFlag = function (k) { return DIFF[G.diff][k]; };
  window.__soGoalTile = function () { return Math.round(G.level.goal.x / T); };
  window.__soKillBoss = function () {
    if (G.level.boss) { G.level.boss.hp = 0; G.level.boss.dead = 0.001; G.level.goal.open = true; }
  };
  /* stand her on the nearest live enemy, or on the boss, so a stomp can be
     tested without simulating a person's timing */
  window.__soAboveEnemy = function () {
    var e = G.level.ents.filter(function (x) { return x.kind === "enemy" && x.alive; })
      .sort(function (a, b) { return Math.abs(a.x - G.player.x) - Math.abs(b.x - G.player.x); })[0];
    if (!e) return null;
    G.player.x = e.x + e.w / 2 - G.player.w / 2;
    G.player.y = e.y - G.player.h - 10;
    G.player.vx = 0; G.player.vy = 60;
    G.camSnap = true; moveCamera(1);
    return Math.round(e.x / T);
  };
  window.__soBossStomp = function () {
    var b = G.level.boss; if (!b) return;
    b.awake = true; b.hurt = 0;
    G.player.x = b.x + b.w / 2 - G.player.w / 2;
    G.player.y = b.y - G.player.h + 1;
    G.player.vy = 120;
  };

  /* --- looking at it --- */
  window.__soState = function () {
    if (!G) return null;
    return {
      state: G.state, world: G.levelIndex + 1, diff: G.diff, lives: G.lives,
      score: G.score, hearts: G.hearts, deaths: G.deaths,
      x: Math.round(G.player.x / T), y: Math.round(G.player.y / T),
      onGround: G.player.onGround, big: G.player.big,
    };
  };
  /* everything a test might want to assert on, counted off the live level */
  window.__soInfo = function () {
    var L = G.level, used = 0, bricks = 0, spikes = 0;
    for (var y = 0; y < L.h; y++) for (var x = 0; x < L.w; x++) {
      var ch = L.grid[y][x];
      if (ch === "u") used++; else if (ch === "B") bricks++; else if (ch === "^") spikes++;
    }
    return {
      state: G.state, world: G.levelIndex + 1, lives: G.lives, score: G.score,
      hearts: G.hearts, deaths: G.deaths, timeLeft: G.timeLeft,
      big: G.player.big, star: G.player.star > 0, wing: G.player.wing,
      x: Math.round(G.player.x / T), usedBlocks: used, bricks: bricks, spikes: spikes,
      enemiesAlive: L.ents.filter(function (e) { return e.kind === "enemy" && e.alive; }).length,
      items: L.items.length, hasBoss: !!L.boss, bossHp: L.boss ? L.boss.hp : null,
      goalOpen: !!(L.goal && L.goal.open),
    };
  };
  /* a contact sheet of every sprite in the game, for reviewing the art */
  window.__soSheet = function (scale) {
    var SC = scale || 5, pad = 6;
    var rows = [];
    ["idle", "run", "jump", "fall", "duck", "hurt", "win"].forEach(function (pose) {
      rows.push(OUISSY[pose].small.concat(OUISSY[pose].big));
    });
    rows.push(ART.walker.concat([ART.walkerSquash], ART.flyer, ART.guard));
    rows.push(ART.heart.concat(ART.power.grow, ART.power.star, ART.power.life,
                               ART.power.boost, ART.power.wing));
    rows.push(ART.boss.concat(ART.bossHurt));
    var w = 0, h = 0;
    rows.forEach(function (r) {
      var rw = 0, rh = 0;
      r.forEach(function (i) { rw += i.width * SC + pad; rh = Math.max(rh, i.height * SC); });
      w = Math.max(w, rw); h += rh + pad * 2;
    });
    var o = document.createElement("canvas");
    o.width = w + 20; o.height = h + 20;
    var c = o.getContext("2d");
    c.imageSmoothingEnabled = false;
    c.fillStyle = "#4a6a8a"; c.fillRect(0, 0, o.width, o.height);
    var y = 10;
    rows.forEach(function (r) {
      var x = 10, tall = 0;
      r.forEach(function (img) {
        c.drawImage(img, x, y, img.width * SC, img.height * SC);
        x += img.width * SC + pad; tall = Math.max(tall, img.height * SC);
      });
      y += tall + pad * 2;
    });
    return o.toDataURL("image/png");
  };

  return { start: start, stop: stop, pause: function () { if (G && G.state === "play") togglePause(); } };
})();
