/* =========================================================================
   OUISSY'S CUP — THE 2D PITCH

   The character bible's Part 8 settles an argument I had lost: no 3D,
   no billboards, a faux-perspective pitch drawn in two dimensions. This
   is that pitch, and now the whole scene on it — the stand, the grass,
   the markings, the goals, the players, the ball, the shadows, the
   confetti and the camera.

   ---------------------------------------------------------------------
   WHAT "FAUX PERSPECTIVE" MEANS HERE

   The ground is a real perspective projection. A point d units ahead of
   the lens lands at

       screenY = A + B / d          B = focal * cameraHeight
       screenX = centre + worldX * focal / d

   which is the same arithmetic a 3D renderer does, done in a 2D canvas
   so that every line, every stripe and every marking can be laid down as
   whole pixels instead of arriving pre-blurred from a rasteriser.

   The CHARACTERS, though, are drawn at 1:1 and never scaled. That is the
   "faux" part and it is deliberate:

     - a 64-pixel sprite scaled to 0.83 drops every sixth row of pixels,
       and the bible's one-pixel outline is the first casualty
     - arcade football has always drawn its players far larger than the
       pitch would allow. It is what makes them read as characters rather
       than as markers

   The lens is long so the nearest player is only about twice as close as
   the furthest one, and at a constant sprite size that error never gets
   a chance to shout.

   ---------------------------------------------------------------------
   HOW IT PUSHES IN WITHOUT BREAKING A SINGLE PIXEL

   A celebration wants to come in close and a super wants to come in
   closer. Scaling a pixel scene by 1.6 is exactly the thing this whole
   rebuild exists to stop, so the camera does not scale anything: it
   HALVES THE VIRTUAL SCREEN. Drawing the same world into 240x135 and
   blowing that up by twice as much shows half as much of the pitch at
   twice the size, and every pixel is still a whole pixel, square, with
   hard edges. Two levels, 1 and 2, and the move between them is a cut,
   not a zoom — which is what a broadcast does anyway.

   ---------------------------------------------------------------------
   NOTHING IS LOADED

   No textures, no images, no fonts. The grass, the mowing, the markings,
   the nets, the boards and every single person in the crowd are drawn
   here, in code, one rectangle at a time — the same rule the whole site
   runs on.
   ========================================================================= */

window.CupPitch2D = (function () {
  "use strict";

  /* the virtual screen at zoom 1. Everything is drawn at this size and
     then blown up by a whole number, which is the only way pixels stay
     square */
  var BASE_W = 480, BASE_H = 270;

  /* THE LENS, and how these numbers were chosen.

     The internal unit is 0.64 metres. That is not arbitrary: the bible
     fixes the character at 48 pixels, so the unit is whatever makes a
     48-pixel figure read as a person at the distance the camera sits. At
     the depth the action plays out the lens gives about twelve pixels
     per unit, which puts her at four units — two and a half metres.
     Arcade football has always drawn its players a head too big; two and
     a half metres is that exaggeration and not a mistake.

     A is the horizon. The first build had it 250 pixels above the top of
     the screen, which is what a broadcast camera actually does — and it
     meant the far goal and the entire stand were off-screen unless she
     was inside the last quarter of the pitch. Every frame was a wall of
     grass. Ten pixels down from the top gives a stadium that is there
     the whole time. */
  var FOCAL = 850;
  var HEIGHT = 16.5;
  var B0 = FOCAL * HEIGHT;
  var A0 = 10;
  var NEAR = 54;             // depth of the bottom edge of the screen

  /* the pitch, in internal units, if nobody says otherwise */

  /* =======================================================================
     FOUR PIXELS WIDE, AND IT HAS TO BE

     The advertising boards used to be blocks of flat colour, on the
     stated grounds that "a word at this size is four grey pixels and
     reads as dirt". That was true of the board they were drawn at —
     twenty-three pixels wide and eight tall, which is room for five
     letters of a five-by-seven font, and five letters is dirt.

     The fix is not a smaller font, it is a WIDER BOARD. A hoarding that
     is seventy-odd pixels long holds thirteen characters of a four-by-
     five face at full contrast, and thirteen characters is MEMORY LANE
     with room to spare. It also happens to be what a real hoarding
     looks like: they are long, there are few of them, and you read them
     from the other side of a stadium.

     The face is four wide because five will not fit thirteen of them
     across a board that also has to fit across the screen, and three is
     the width at which M and N stop being different letters. Each glyph
     is five rows of four bits, most significant bit on the left.
     ======================================================================= */
  var GLYPH = {
    A: [0x6, 0x9, 0xF, 0x9, 0x9], B: [0xE, 0x9, 0xE, 0x9, 0xE],
    C: [0x7, 0x8, 0x8, 0x8, 0x7], D: [0xE, 0x9, 0x9, 0x9, 0xE],
    E: [0xF, 0x8, 0xE, 0x8, 0xF], F: [0xF, 0x8, 0xE, 0x8, 0x8],
    G: [0x7, 0x8, 0xB, 0x9, 0x7], H: [0x9, 0x9, 0xF, 0x9, 0x9],
    I: [0xE, 0x4, 0x4, 0x4, 0xE], J: [0x3, 0x1, 0x1, 0x9, 0x6],
    K: [0x9, 0xA, 0xC, 0xA, 0x9], L: [0x8, 0x8, 0x8, 0x8, 0xF],
    M: [0x9, 0xF, 0xF, 0x9, 0x9], N: [0x9, 0xD, 0xF, 0xB, 0x9],
    O: [0x6, 0x9, 0x9, 0x9, 0x6], P: [0xE, 0x9, 0xE, 0x8, 0x8],
    Q: [0x6, 0x9, 0x9, 0xB, 0x7], R: [0xE, 0x9, 0xE, 0xA, 0x9],
    S: [0x7, 0x8, 0x6, 0x1, 0xE], T: [0xF, 0x4, 0x4, 0x4, 0x4],
    U: [0x9, 0x9, 0x9, 0x9, 0x6], V: [0x9, 0x9, 0x9, 0x6, 0x6],
    W: [0x9, 0x9, 0xF, 0xF, 0x9], X: [0x9, 0x9, 0x6, 0x9, 0x9],
    Y: [0x9, 0x9, 0x6, 0x4, 0x4], Z: [0xF, 0x1, 0x6, 0x8, 0xF],
    "0": [0x6, 0xB, 0xD, 0x9, 0x6], "1": [0x4, 0xC, 0x4, 0x4, 0xE],
    "2": [0xE, 0x1, 0x6, 0x8, 0xF], "3": [0xE, 0x1, 0x6, 0x1, 0xE],
    "4": [0x9, 0x9, 0xF, 0x1, 0x1], "5": [0xF, 0x8, 0xE, 0x1, 0xE],
    "6": [0x6, 0x8, 0xE, 0x9, 0x6], "7": [0xF, 0x1, 0x2, 0x4, 0x4],
    "8": [0x6, 0x9, 0x6, 0x9, 0x6], "9": [0x6, 0x9, 0x7, 0x1, 0x6],
    "'": [0x4, 0x4, 0x0, 0x0, 0x0], "-": [0x0, 0x0, 0xF, 0x0, 0x0],
    " ": [0, 0, 0, 0, 0],
  };
  var GLYPH_W = 4, GLYPH_H = 5, GLYPH_PITCH = 5;

  function textWidth(str) { return str.length * GLYPH_PITCH - 1; }

  function drawText(ctx, str, x, y, col) {
    ctx.fillStyle = col;
    for (var i = 0; i < str.length; i++) {
      var g = GLYPH[str.charAt(i)];
      if (!g) continue;
      var gx = x + i * GLYPH_PITCH;
      for (var r = 0; r < GLYPH_H; r++) {
        var bits = g[r];
        if (!bits) continue;
        for (var c = 0; c < GLYPH_W; c++) {
          if (bits & (1 << (GLYPH_W - 1 - c))) ctx.fillRect(gx + c, y + r, 1, 1);
        }
      }
    }
  }

  /* WHAT THE HOARDINGS SAY.

     Every one of them is something out of her own three years, because
     a stadium that advertises nothing at all is a stadium nobody has
     ever been to, and a stadium that advertises a real company is a
     stadium that belongs to somebody else. */
  var HOARDING = [
    "MEMORY LANE", "OUISSY'S CUP", "LONG WAY", "SUPER OUISSY",
    "2247", "GUISSY'S CLUB", "THE LONG WAY", "22 04 2023",
  ];

  var DEFAULT = {
    halfW: 53, len: 164, goalHalf: 5.7, goalDepth: 4,
    boxHalf: 31.5, boxDepth: 26, sixHalf: 14.3, sixDepth: 8.6,
    circleR: 14.3, spot: 17,
  };

  /* -------------------------------------------------------- the palette
     Part 1.3's discipline applied to the world as well as the people:
     three tones per material and no more. */
  var C = {
    grassA: "#3f7a3c", grassB: "#4a8a44", grassLit: "#59a052",
    grassDk: "#2f5e2e", line: "#eaf4e4", lineDk: "#b8cfb2",
    net: "#dfe8e0", post: "#f4f8f2", postDk: "#b6c4b6",
    board: "#1d2733", boardLip: "#33465a",
    wall: "#2a2233", wallLit: "#3b3145",
    tier: "#1e1926", tierLit: "#2c2534", rail: "#4a4157",
    roof: "#161220", sky: "#101826",
    shadow: "#1e3b23", ring: "#ffe9a8", ringDk: "#c8912f",
  };

  /* THE CROWD'S PALETTE.

     The first pass drew people in the full-strength kit colours and the
     far end came out as confetti: twelve hundred maximally saturated
     three-pixel blocks fighting the players for attention. A crowd seen
     from a hundred metres away in stadium light is dark and low in
     chroma, with only the odd shirt catching the light. */
  var CROWD = ["#6b3540", "#7a6438", "#8c8474", "#35506e", "#4a3a5e",
               "#2f5a4c", "#7a4630", "#3a3644", "#3a3644", "#2f2b38"];

  /* THE VENUE, WHICH IS FIVE COLOURS AND NOT A LIGHTING RIG.

     In the 3D build a campus was a sun colour, a hemisphere light, an
     ambient level, a fog range and a sky dome, and the renderer worked
     the rest out. None of that survives the move: there is no light
     here, so a venue has to BE the palette. Every tone the ground and
     the stand are drawn in is derived from the venue's own grass, stand
     and horizon colours, which means the night derby is genuinely a
     different-coloured pitch rather than the same pitch with a filter
     over it. */
  var BASE = {};
  Object.keys(C).forEach(function (k) { BASE[k] = C[k]; });

  function mix(a, b, t) {
    var ca = parseInt(a.slice(1), 16), cb = parseInt(b.slice(1), 16);
    var f = function (s) {
      var x = Math.round((((ca >> s) & 255) * (1 - t)) + (((cb >> s) & 255) * t));
      return Math.max(0, Math.min(255, x));
    };
    return "#" + ((1 << 24) + (f(16) << 16) + (f(8) << 8) + f(0)).toString(16).slice(1);
  }

  function venue(v) {
    if (!v) { Object.keys(BASE).forEach(function (k) { C[k] = BASE[k]; }); return; }
    /* =====================================================================
       THE GRADE: BRIGHT, AND WITH THE MOWING VISIBLE

       The first pass took the venue's grass colour as given and mowed
       it by sixteen per cent, which on a dark night pitch is a
       difference of about four values out of 255 — invisible. And
       because the stripe was made by DARKENING only, adding stripes
       could only ever make the pitch darker than the colour chosen for
       it, so every venue came out duller than its own palette.

       Now the two bands straddle the venue colour: one lifted, one
       dropped. The pitch's average stays the colour that was picked,
       the mowing is a real twenty-odd values apart, and the whole
       ground reads brighter because half of it genuinely is. */
    var night = !!v.floodlit;
    var g0 = v.grass || "#4a8a44";
    /* lift the base a little: a floodlit pitch on television is a much
       more saturated green than a photograph of grass */
    var g = mix(g0, "#8fd86a", night ? 0.16 : 0.10);
    var st = v.stripe || mix(g, "#000000", 0.20);
    C.grassB = mix(g, "#ffffff", 0.11);
    C.grassA = st;
    C.grassLit = mix(g, "#ffffff", 0.26);
    C.grassDk = mix(st, "#000000", night ? 0.26 : 0.16);
    C.line = night ? "#f4f8f4" : "#eaf4e4";
    C.lineDk = mix(C.line, st, 0.4);
    var sd = v.stand || "#5b6570";
    C.tierLit = mix(sd, "#000000", 0.42);
    C.tier = mix(sd, "#000000", 0.58);
    C.rail = mix(sd, "#ffffff", 0.18);
    C.roof = mix(sd, "#000000", 0.76);
    C.sky = mix(v.horizon || "#8fc9e8", "#000000", night ? 0.6 : 0.2);
    C.board = mix(sd, "#000000", 0.7);
    C.boardLip = mix(sd, "#ffffff", 0.1);
    C.shadow = mix(st, "#000000", night ? 0.5 : 0.36);
    /* the seats read brighter under lights and warmer in the sun, which
       is the one thing that stops a night stand being a black wall */
    var tone = v.seats === "warm" ? "#c8a878" : v.seats === "bright" ? "#e8eef8" : "#9fb0bc";
    CROWD.length = 0;
    ["#6b3540", "#7a6438", "#8c8474", "#35506e", "#4a3a5e",
     "#2f5a4c", "#7a4630", "#3a3644", "#3a3644", "#2f2b38"].forEach(function (c) {
      CROWD.push(mix(c, tone, night ? 0.28 : 0.16));
    });
    bakeGrass();
  }

  /* THE GROUND'S LIGHT, BAKED ONCE.

     Grass is drawn a row at a time, and a row needs to know two things:
     which mowing band it is in, and how much light reaches it. Working
     the second one out per row meant parsing two hex strings and
     blending them sixteen thousand times a second for a value that only
     ever takes a handful of distinct settings — so the handful is
     computed once, here, and the row draw is an array lookup.

     The ramp runs from the near touchline, which is closest to the
     lights and to the camera, up into the far half where the stand
     throws its shadow. It is the cheapest depth cue on the pitch and
     the most convincing: a flat green field has no distance in it. */
  var GRADE_N = 14;
  function bakeGrass() {
    C.gradA = []; C.gradB = [];
    for (var i = 0; i < GRADE_N; i++) {
      var t = i / (GRADE_N - 1);              // 0 near, 1 far
      /* lifted just in front of the camera, dropped into the far half */
      /* smooth on both sides: a hard threshold put a visible STEP
         across the pitch where the stand's shadow was declared to
         start, which is a thing grass does not do */
      var sh = Math.max(0, (t - 0.42) / 0.58);
      var lift = 0.13 * (1 - t) * (1 - t) - 0.21 * sh * sh;
      var f = function (base) {
        return lift >= 0 ? mix(base, "#ffffff", lift * 0.7)
                         : mix(base, C.grassDk, -lift * 1.5);
      };
      C.gradA.push(f(C.grassA));
      C.gradB.push(f(C.grassB));
    }
  }
  bakeGrass();

  function Pitch(display, world) {
    this.display = display;
    this.buf = document.createElement("canvas");
    this.ctx = null;
    this.cam = { x: 0, y: 0 };      // world point at the near edge, centre
    this.t = 0;
    this.zoom = 1;
    /* the camera's own shape. "persp" is what ships; "oblique" is the
       fixed-foreshortening alternative the greybox exists to compare. */
    this.mode = "persp";
    this.swap = false;              // true = goals left and right
    this.obS = 4.0;                 // screen pixels per world unit, across
    this.obF = 0.50;                // and the depth ramp: 0.50 is a 30-degree camera
    this.groundY = 250;             // where the camera's own row sits on screen
    /* WHOSE CROWD IT IS. Two kit colours and a seed; the stand is cut
       into blocks and each block leans one way, which is what an end
       full of one team's supporters looks like from the other side of a
       pitch — not a uniform speckle. */
    this.crowdHome = null; this.crowdAway = null;
    /* the wave. -1 is "not running"; otherwise it is how far round the
       front has travelled, in screen widths. */
    this.wave = -1;
    /* HOW THE GROUND FEELS. +1 is a goal at the right end, -1 is a goal
       at the wrong one. A crowd that celebrates identically whichever
       way the ball went in is a crowd that is not watching. */
    this.mood = 0;
    this.flash = 0; this.flashCol = "#ffffff";
    this.shake = 0;
    this.items = [];
    this.conf = [];
    this.divots = [];
    this.setWorld(world);
    this.zoomTo(1);
    /* one fixed noise field, so the crowd is the same crowd every frame
       instead of a different crowd sixty times a second */
    this.seeds = [];
    for (var i = 0; i < 2048; i++) {
      this.seeds.push(((Math.sin(i * 12.9898) * 43758.5453) % 1 + 1) % 1);
    }
  }

  /* THE WORLD ARRIVES IN SOMEBODY ELSE'S UNITS.

     The match keeps its pitch in the numbers the simulation was tuned
     on, and those are nothing like the ones this lens was tuned on.
     Rather than make the chapter convert every coordinate it hands over
     — which is the kind of thing that gets forgotten in exactly one
     place and puts one player in the car park — the scale is worked out
     once, here, from the width of the pitch, and every coordinate that
     comes in goes through it. */
  Pitch.prototype.setWorld = function (world) {
    var w = {};
    Object.keys(DEFAULT).forEach(function (k) { w[k] = DEFAULT[k]; });
    if (world) Object.keys(world).forEach(function (k) { w[k] = world[k]; });
    this.k = DEFAULT.halfW / w.halfW;
    this.raw = w;
    var k = this.k, W = {};
    Object.keys(w).forEach(function (key) { W[key] = w[key] * k; });
    this.W = W;
  };

  /* WHAT SCALES WITH THE ZOOM AND WHAT DOES NOT.

     Halving the virtual screen doubles everything on it, because the
     blit back up to the canvas doubles with it. That is true of the
     ground plane, which the projection handles, AND of anything sized
     in buffer pixels — a 64-pixel sprite, a 52-pixel crossbar, a
     26-pixel tier — because a buffer pixel is simply twice as big.

     So none of those may be multiplied by fy. The first version scaled
     the crossbar and the stand by it "to be consistent", which kept
     them exactly the same size on screen while the players doubled: a
     keeper twice the height of the goal he was standing in. fy belongs
     to the projection and nowhere else. */
  /* TURNING THE PITCH SIDEWAYS CHANGES THE LENS.

     The perspective scale is derived from how wide the pitch is, so
     when the long axis becomes the screen's long axis the scale has to
     come off the length instead — otherwise a horizontal pitch is drawn
     at the lens of a vertical one and three-quarters of it is off the
     sides of the screen. */
  /* HOW HIGH THE CAMERA SITS, which is the one number that trades
     stand for pitch. A lower camera compresses the ground toward the
     horizon: the far edge climbs, the stand above it shrinks, and more
     of the pitch's length fits in frame. */
  Pitch.prototype.setHeight = function (h) {
    this.height = h;
    this.B = FOCAL * h * this.fy;
  };

  Pitch.prototype.setSwap = function (on) {
    this.swap = !!on;
    var half = on ? this.raw.len / 2 : this.raw.halfW;
    this.k = DEFAULT.halfW / half;
  };

  Pitch.prototype.zoomTo = function (level) {
    /* 1 is the match, 2 is a cut-in, 3 is a portrait. Whole divisors
       only: 480/2 and 480/3 are both whole numbers of pixels and the
       blit back up is a whole number too, which is the entire reason
       this is how the camera pushes in. */
    level = Math.max(1, Math.min(3, Math.round(level || 1)));
    if (level === this.zoom && this.ctx) return;
    this.zoom = level;
    this.vw = Math.round(BASE_W / level);
    this.vh = Math.round(BASE_H / level);
    this.buf.width = this.vw; this.buf.height = this.vh;
    this.ctx = this.buf.getContext("2d");
    this.ctx.imageSmoothingEnabled = false;
    this.fy = this.vh / BASE_H;
    this.A = A0 * this.fy;
    this.B = FOCAL * (this.height || HEIGHT) * this.fy;
  };

  Pitch.prototype.rnd = function (i) { return this.seeds[(i | 0) & 2047]; };

  /* --------------------------------------------------------- projection */
  /* =======================================================================
     TWO WAYS TO PUT A PITCH ON A SCREEN

     PERSPECTIVE (the default, and what the chapter ships): a real
     ground-plane projection. The touchlines converge on a vanishing
     point, the far goal is smaller than the near one, and the pitch is
     a trapezoid. Depth is genuinely depth.

     OBLIQUE: a fixed foreshortening ramp. A world unit across is always
     the same number of screen pixels, and a world unit UP the pitch is
     always that number times F. Nothing converges, so the touchlines
     are parallel vertical lines and the pitch is a RECTANGLE. The
     centre circle is an ellipse of one constant squash.

     These are different pictures and you cannot have half of each: a
     trapezoid IS convergence, and convergence is what makes the
     foreshortening vary with depth. The chapter carries both so the
     choice can be made by looking rather than by arguing.

     F is the foreshortening. It is also the camera's tilt, because for
     an orthographic camera looking down at an angle the depth axis is
     compressed by the sine of that angle: F = 0.50 is a 30-degree
     camera, F = 0.64 is 40 degrees. A higher camera sees less pitch.
     ======================================================================= */
  Pitch.prototype.project = function (wx, wy) {
    /* HORIZONTAL ORIENTATION is a swap, not a second projection. The
       pitch's long axis becomes the screen's long axis; everything else
       in this file goes on working in the pitch's own coordinates. */
    if (this.swap) { var t = wx; wx = wy; wy = t; }
    var cx = this.swap ? this.cam.y : this.cam.x;
    var cy = this.swap ? this.cam.x : this.cam.y;

    if (this.mode === "oblique") {
      var S = this.obS, F = this.obF;
      return {
        x: this.vw / 2 + (wx - cx) * S,
        y: this.groundY - (wy - cy) * S * F,
        d: NEAR, k: S, ky: S * F, flat: true,
      };
    }
    var k = this.k;
    var d = Math.max(8, NEAR + (wy - cy) * k);
    return {
      x: this.vw / 2 + (wx - cx) * k * FOCAL / d,
      y: this.A + this.B / d,
      d: d,
      k: FOCAL / d * k,          // screen pixels per WORLD unit, across
      ky: this.B / (d * d) * k,  // screen pixels per WORLD unit, in depth
    };
  };
  Pitch.prototype.depthAtY = function (sy) { return this.B / (sy - this.A); };

  /* the world row a screen row is looking at, either way round */
  Pitch.prototype.rowAt = function (sy) {
    var cy = this.swap ? this.cam.x : this.cam.y;
    if (this.mode === "oblique") {
      return cy + (this.groundY - sy) / (this.obS * this.obF);
    }
    return cy + (this.depthAtY(sy) - NEAR) / this.k;
  };

  /* PLACEHOLDER BLOCKS.

     A greybox is for judging the CAMERA, so the people in it are
     deliberately not people: a coloured box the size a player would be,
     with a lighter top face and a darker front, a ground shadow and a
     number. The whole point is that no sprite work is risked on a
     camera that has not been agreed. */
  Pitch.prototype.block = function (o) {
    var self = this;
    this.add(o.wy, function () {
      var p = self.project(o.wx, o.wy);
      var sc = o.scale === undefined ? 1 : o.scale;
      var w = Math.max(4, Math.round(18 * sc));
      var h = Math.max(8, Math.round(44 * sc));
      var x = Math.round(p.x - w / 2), y = Math.round(p.y - h);
      fillEllipse(self.ctx, p.x, p.y - 1, Math.round(w * 0.62),
                  Math.max(1, Math.round(p.ky * 3.2)), C.shadow);
      if (o.ring) self.ring(o.wx, o.wy, o.ring);
      var ctx = self.ctx;
      ctx.fillStyle = "#0d1412"; ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
      ctx.fillStyle = o.col;     ctx.fillRect(x, y, w, h);
      ctx.fillStyle = mix(o.col, "#ffffff", 0.32);
      ctx.fillRect(x, y, w, Math.max(2, Math.round(h * 0.18)));
      ctx.fillStyle = mix(o.col, "#000000", 0.34);
      ctx.fillRect(x, y + h - Math.max(2, Math.round(h * 0.22)), w,
                   Math.max(2, Math.round(h * 0.22)));
      /* a head block, so the silhouette has a top and the scale reads */
      ctx.fillStyle = "#0d1412";
      ctx.fillRect(x + Math.round(w * 0.2) - 1, y - Math.round(h * 0.34) - 1,
                   Math.round(w * 0.6) + 2, Math.round(h * 0.34) + 1);
      ctx.fillStyle = mix(o.col, "#ffffff", 0.55);
      ctx.fillRect(x + Math.round(w * 0.2), y - Math.round(h * 0.34),
                   Math.round(w * 0.6), Math.round(h * 0.34));
      if (o.n !== undefined && w >= 10) {
        ctx.fillStyle = "#0d1412";
        ctx.fillRect(x + Math.round(w / 2) - 1, y + Math.round(h * 0.4), 2, 4);
      }
    });
  };

  /* ------------------------------------------------------ pixel drawing
     Every one of these lands on integer coordinates. The canvas will
     happily antialias an arc or a diagonal, and a single soft pixel
     anywhere in a pixel-art frame reads as a mistake. */
  function px(ctx, x, y, col) {
    ctx.fillStyle = col; ctx.fillRect(x | 0, y | 0, 1, 1);
  }
  /* COHEN-SUTHERLAND, AND WHY IT IS NOT OPTIONAL.

     A pitch marking is drawn between two projected points, and a point
     behind the camera or far off to the side projects to an enormous
     coordinate. Bresenham walking from there to here will happily draw
     a diagonal right across the screen — which, once the camera cut in
     close for a super, turned the penalty arcs and the centre circle
     into a spray of white streaks over the grass. Clipping the segment
     to the screen first is the whole fix. */
  function outcode(x, y, w, h) {
    return (x < 0 ? 1 : x > w ? 2 : 0) | (y < 0 ? 4 : y > h ? 8 : 0);
  }
  function clipLine(x0, y0, x1, y1, w, h) {
    var a = outcode(x0, y0, w, h), b = outcode(x1, y1, w, h), guard = 0;
    while (guard++ < 12) {
      if (!(a | b)) return [x0, y0, x1, y1];
      if (a & b) return null;
      var o = a || b, x = 0, y = 0;
      if (o & 8) { x = x0 + (x1 - x0) * (h - y0) / (y1 - y0); y = h; }
      else if (o & 4) { x = x0 + (x1 - x0) * (0 - y0) / (y1 - y0); y = 0; }
      else if (o & 2) { y = y0 + (y1 - y0) * (w - x0) / (x1 - x0); x = w; }
      else { y = y0 + (y1 - y0) * (0 - x0) / (x1 - x0); x = 0; }
      if (!isFinite(x) || !isFinite(y)) return null;
      if (o === a) { x0 = x; y0 = y; a = outcode(x0, y0, w, h); }
      else { x1 = x; y1 = y; b = outcode(x1, y1, w, h); }
    }
    return null;
  }
  function line(ctx, x0, y0, x1, y1, col) {
    if (!isFinite(x0) || !isFinite(y0) || !isFinite(x1) || !isFinite(y1)) return;
    var c = clipLine(x0, y0, x1, y1, ctx.canvas.width - 1, ctx.canvas.height - 1);
    if (!c) return;
    x0 = Math.round(c[0]); y0 = Math.round(c[1]);
    x1 = Math.round(c[2]); y1 = Math.round(c[3]);
    var dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
    var sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1, err = dx + dy;
    ctx.fillStyle = col;
    for (var g = 0; g < 4000; g++) {
      ctx.fillRect(x0, y0, 1, 1);
      if (x0 === x1 && y0 === y1) break;
      var e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  }
  function fillEllipse(ctx, cx, cy, rx, ry, col) {
    ctx.fillStyle = col;
    for (var y = -ry; y <= ry; y++) {
      var f = 1 - (y / (ry + 0.5)) * (y / (ry + 0.5));
      if (f <= 0) continue;
      var w = Math.round(rx * Math.sqrt(f));
      if (w < 1) continue;
      ctx.fillRect(Math.round(cx - w), Math.round(cy + y), w * 2 + 1, 1);
    }
  }

  /* ============================================================ THE SKY,
     which is really the far end of the stadium: a back wall, a roof, and
     several thousand people who are each four pixels. */
  Pitch.prototype.drawStand = function () {
    var ctx = this.ctx, W = this.W;
    if (this.mode === "oblique") return this.drawStandFlat();
    /* WHICH EDGE IS THE FAR ONE depends on which way the pitch is
       turned: up the pitch it is the far goal line, sideways it is the
       far touchline. Asking project for the right point is the whole
       difference — drawn without it, the stand lands in the middle of a
       horizontal pitch with the players standing on top of it. */
    var goal = this.swap ? this.project(this.raw.halfW, 0)
                         : this.project(0, this.raw.len);
    /* where the stand MEETS THE GROUND — a few units of run-off behind
       the goal line. The boards stand UP from this line and the tiers
       rise behind them; the first build drew them hanging down from it,
       and the grass, which starts at the same line, painted over every
       one of them. */
    var base = Math.min(this.vh - 1, Math.max(0, Math.round(
      (this.swap ? this.project(this.raw.halfW + 7 / this.k, 0)
                 : this.project(0, this.raw.len + 7 / this.k)).y)));
    var bh = Math.max(3, Math.round(goal.k * 1.6 / this.k));
    var lip = Math.max(0, base - bh);

    ctx.fillStyle = C.sky;
    ctx.fillRect(0, 0, this.vw, Math.max(0, base));
    if (base <= 0) return;

    /* THE TIERS.

       A stadium is not a wall with dots on it. It is a stack of shallow
       steps, each one lit slightly differently, with a rail along the
       front and a dark gap under it — and that stack is what gives the
       far end depth without a single line of perspective. */
    var tiers = [{ h: 26, rows: 7 }, { h: 20, rows: 5 }];
    var y = lip, band = 0;
    for (var ti = 0; ti < tiers.length; ti++) {
      var T = tiers[ti];
      var top = y - T.h;
      ctx.fillStyle = ti ? C.tier : C.tierLit;
      ctx.fillRect(0, Math.max(0, top), this.vw, Math.min(T.h, y));

      var step = T.h / T.rows;
      for (var r = 0; r < T.rows; r++) {
        var ry = Math.round(top + r * step);
        if (ry < -4 || ry > this.vh) continue;
        var pitchX = 6 + (T.rows - r) * 0.25;
        for (var cxx = -2; cxx < this.vw / pitchX + 2; cxx++) {
          var id = band * 977 + r * 131 + cxx * 7;
          if (this.rnd(id) < 0.12) continue;              // an empty seat
          var sxp = Math.round(cxx * pitchX + this.rnd(id + 3) * 2);
          /* the sway is VERTICAL, and always was meant to be: a crowd
             seen from the far end of a pitch bobs, it does not shuffle
             sideways, and drawing the idle motion in x made the whole
             stand shimmer left and right like a bad tracking shot. The
             wave rides on the same number. */
          var cf = Math.max(0, Math.min(0.999, sxp / this.vw));
          var lift = Math.round(this.standLift(cf, r));
          ctx.fillStyle = this.seatCol(id, cf);
          ctx.fillRect(sxp, ry + lift, 3, 2);
          ctx.fillStyle = "#1a1620";
          ctx.fillRect(sxp, ry + lift + 2, 3, 1);
        }
      }
      ctx.fillStyle = C.rail;  ctx.fillRect(0, Math.max(0, y - 2), this.vw, 1);
      ctx.fillStyle = C.roof;  ctx.fillRect(0, Math.max(0, y - 1), this.vw, 1);
      y = top; band++;
    }

    /* ================================================== THE ROOF AND ABOVE

       The stand used to stop at a flat black band with nothing above
       it, which is the silhouette of a wall rather than of a stadium.
       What makes a ground read as a ground from the outside is the
       ROOFLINE: a lit fascia, the trusses under it, and the floodlights
       standing over the back of it against the sky. */
    var roofY = Math.max(0, y);
    ctx.fillStyle = C.roof;
    ctx.fillRect(0, 0, this.vw, roofY + 5);
    /* the underside of the roof, caught by the lights below it */
    ctx.fillStyle = mix(C.wallLit, "#ffffff", 0.10);
    ctx.fillRect(0, roofY, this.vw, 1);
    ctx.fillStyle = C.wall;
    ctx.fillRect(0, roofY + 1, this.vw, 3);
    /* the trusses: a stadium roof is held up by something */
    ctx.fillStyle = mix(C.roof, "#ffffff", 0.16);
    for (var tx = 8; tx < this.vw; tx += 34) ctx.fillRect(tx, roofY + 1, 2, 3);
    /* the fascia, one bright line, which is the whole silhouette */
    ctx.fillStyle = mix(C.rail, "#ffffff", 0.22);
    ctx.fillRect(0, Math.max(0, roofY - 1), this.vw, 1);

    this.drawPylons(roofY);

    /* ======================================================= THE HOARDINGS

       Long boards with words on, rather than short boards without. The
       lettering only goes on when there is genuinely room for it: at a
       cut-in zoom the virtual screen is half the size and a board is
       too short to hold a line, and half a word is worse than none. */
    ctx.fillStyle = C.board;
    ctx.fillRect(0, lip, this.vw, bh);
    var BW = 76;                                  // one hoarding
    var off = Math.round(this.rnd(3) * BW);
    for (var bx = -off; bx < this.vw; bx += BW) {
      var idx = Math.abs(Math.round((bx + off) / BW)) % HOARDING.length;
      var bn = this.rnd(idx * 13 + 5);
      var face = bn > 0.62 ? "#a8283a" : (bn > 0.34 ? "#c8912f" : "#2f4f7a");
      ctx.fillStyle = face;
      ctx.fillRect(bx + 1, lip + 1, BW - 3, Math.max(1, bh - 2));
      ctx.fillStyle = C.boardLip;
      ctx.fillRect(bx + 1, lip, BW - 3, 1);
      var word = HOARDING[idx];
      if (bh >= 8 && textWidth(word) <= BW - 7) {
        var tw = textWidth(word);
        var tx2 = Math.round(bx + 1 + (BW - 3 - tw) / 2);
        var ty2 = Math.round(lip + (bh - GLYPH_H) / 2) + 1;
        /* a dark backing row so white letters do not vibrate on red */
        drawText(ctx, word, tx2, ty2 + 1, mix(face, "#000000", 0.55));
        drawText(ctx, word, tx2, ty2, "#f2f6f4");
      }
    }
    /* the tunnel goes on AFTER the boards, because it interrupts them:
       drawn first, the hoarding loop simply painted over it */
    this.drawTunnel(lip, bh, base);
    ctx.fillStyle = C.grassDk;
    ctx.fillRect(0, base, this.vw, 2);
  };

  /* THE TUNNEL.

     A dark mouth cut into the boards with a lit lip over it and a step
     down into it. It is about fourteen pixels of black and it
     does more for the stand than any of the seats do: a wall of crowd
     with no way in or out of it is a backdrop, and a wall of crowd with
     a hole in it is a place the players came from. */
  Pitch.prototype.drawTunnel = function (lip, bh, base) {
    var ctx = this.ctx;
    if (bh < 5) return;
    /* ANCHORED TO THE GROUND, NOT TO THE FRAME.

       Placed at the middle of the SCREEN it sits dead centre of every
       shot and slides along the stand as the camera pans, which is a
       tunnel on rails. It belongs at a fixed place on the pitch — off
       to one side, so it is not permanently hidden behind the goal —
       and the projection puts it where that lands. */
    var w = 26, h = bh + 6;
    var anchor = this.project(-this.raw.halfW * 0.62,
                              this.swap ? 0 : this.raw.len + 7 / this.k);
    var x = Math.round(anchor.x - w / 2);
    if (x + w < 0 || x > this.vw) return;
    var y = Math.round(lip - 6);
    /* the surround, then the mouth, then the dark inside it */
    ctx.fillStyle = mix(C.board, "#ffffff", 0.14);
    ctx.fillRect(x - 2, y - 2, w + 4, h + 2);
    ctx.fillStyle = "#07090c";
    ctx.fillRect(x, y, w, h);
    /* a little light spilling out of it onto the boards */
    ctx.globalAlpha = 0.18;
    ctx.fillStyle = "#cfe0d8";
    ctx.fillRect(x + 3, y + h - 3, w - 6, 3);
    ctx.globalAlpha = 1;
    /* the lintel */
    ctx.fillStyle = mix(C.board, "#ffffff", 0.3);
    ctx.fillRect(x - 2, y - 2, w + 4, 1);
  };

  /* =======================================================================
     THE FLOODLIGHTS

     Four pylons, of which two are in shot on a pitch that runs up and
     down. They are the one piece of the ground that stands against the
     sky, so they are what says "stadium" in a frame where the stand
     itself is only forty pixels tall.

     A lamp is not a white blob: it is a bank of bulbs on a head, with a
     soft halo under it that falls on the roof. The halo is the reason
     the pylon reads as LIT rather than as a shape. */
  Pitch.prototype.drawPylons = function (roofY) {
    var ctx = this.ctx;
    if (roofY < 12) return;                 // no sky to stand them in
    var self = this;
    var mast = function (cx) {
      cx = Math.round(cx);
      var headW = 22, headH = 9;
      var topY = Math.max(2, roofY - 32);
      /* THE HALO IS A CONE, NOT A STACK OF BOXES.

         Four rectangles of equal alpha piled up under the head read as
         exactly what they are: a grey box in the sky with steps down
         its sides. A light spilling out of a lamp gets WIDER and WEAKER
         together, so each band is both broader and fainter than the one
         above it, and the faintest is under a twentieth — at which
         point there is no edge left to see. */
      ctx.fillStyle = "#fff6d8";
      for (var g = 0; g < 5; g++) {
        var gw = headW + 4 + g * g * 5, gh = 4 + g * 3;
        ctx.globalAlpha = 0.085 / (1 + g * 0.9);
        ctx.fillRect(Math.round(cx - gw / 2), topY + headH + g * 2, Math.round(gw), gh);
      }
      ctx.globalAlpha = 1;
      /* the mast: a lattice, two legs and the cross-bracing */
      ctx.fillStyle = mix(C.roof, "#ffffff", 0.30);
      var legTop = topY + headH, legBot = roofY + 4;
      ctx.fillRect(cx - 4, legTop, 2, legBot - legTop);
      ctx.fillRect(cx + 2, legTop, 2, legBot - legTop);
      for (var ly = legTop + 3; ly < legBot; ly += 6) {
        ctx.fillRect(cx - 3, ly, 6, 1);
      }
      /* the head, and the bulbs in it */
      ctx.fillStyle = mix(C.roof, "#ffffff", 0.18);
      ctx.fillRect(cx - headW / 2, topY, headW, headH);
      ctx.fillStyle = "#6a6250";
      ctx.fillRect(cx - headW / 2 + 1, topY + 1, headW - 2, headH - 2);
      for (var r = 0; r < 2; r++) {
        for (var c = 0; c < 6; c++) {
          /* the odd bulb flickers, because they do */
          var fl = self.rnd(c * 37 + r * 11) * 6 + self.t * 2.2;
          var lit = Math.sin(fl) > -0.92;
          ctx.fillStyle = lit ? "#fff8e0" : "#b8ac88";
          ctx.fillRect(cx - headW / 2 + 2 + c * 3, topY + 2 + r * 3, 2, 2);
        }
      }
    };
    /* stood behind the corners of the far end */
    mast(this.vw * 0.11);
    mast(this.vw * 0.89);
  };

  /* the far stand, oblique: a band above the far goal line, and the
     side stands are two columns outside the touchlines */
  Pitch.prototype.drawStandFlat = function () {
    var ctx = this.ctx, w = this.raw;
    var far = Math.round(this.project(0, this.swap ? 0 : w.len).y);
    var l = this.project(-w.halfW, 0), r = this.project(w.halfW, 0);
    var x0 = Math.round(Math.min(l.x, r.x)) - 6, x1 = Math.round(Math.max(l.x, r.x)) + 6;
    var self = this;
    var tier = function (bx, by, bw, bh, band) {
      ctx.fillStyle = C.tierLit; ctx.fillRect(bx, by, bw, bh);
      ctx.fillStyle = C.tier;    ctx.fillRect(bx, by, bw, Math.round(bh * 0.42));
      ctx.fillStyle = C.rail;    ctx.fillRect(bx, by + Math.round(bh * 0.42), bw, 1);
      for (var r2 = 0; r2 < 7; r2++) {
        var ry = Math.round(by + 2 + r2 * (bh / 7));
        for (var cx2 = bx; cx2 < bx + bw; cx2 += 5) {
          var id = band * 977 + r2 * 131 + cx2 * 7;
          if (self.rnd(id) < 0.14) continue;
          var sw = Math.round(Math.sin(self.t * 2.1 + cx2 * 0.2 + r2) * 0.9);
          ctx.fillStyle = CROWD[(self.rnd(id + 11) * CROWD.length) | 0];
          ctx.fillRect(cx2, ry + sw, 3, 2);
          ctx.fillStyle = "#1a1620"; ctx.fillRect(cx2, ry + sw + 2, 3, 1);
        }
      }
      ctx.fillStyle = C.roof; ctx.fillRect(bx, by - 4, bw, 4);
    };
    /* behind the far goal */
    ctx.fillStyle = C.sky; ctx.fillRect(0, 0, this.vw, Math.max(0, far - 6));
    if (far > 8) tier(0, Math.max(0, far - 54), this.vw, 48, 0);
    ctx.fillStyle = C.board; ctx.fillRect(0, far - 8, this.vw, 8);
    /* and down both touchlines */
    if (x0 > 0) tier(0, Math.max(0, far - 54), x0, this.vh, 1);
    if (x1 < this.vw) tier(x1, Math.max(0, far - 54), this.vw - x1, this.vh, 2);
  };

  /* ============================================================ THE GRASS
     Drawn row by row from the bottom of the screen up. Each screen row
     is a different depth, so the mowing bands are worked out per row and
     come out correctly foreshortened for nothing. */
  Pitch.prototype.drawGrass = function () {
    var ctx = this.ctx;
    if (this.mode === "oblique") return this.drawGrassFlat();
    var y0 = Math.max(0, Math.round(
      (this.swap ? this.project(this.raw.halfW + 7 / this.k, 0)
                 : this.project(0, this.raw.len + 7 / this.k)).y) + 2);
    /* THE MOWING RUNS ACROSS THE PITCH, so a band is a band of DEPTH
       and therefore a band of screen rows — which is exactly why the
       stripes come out as trapezoids narrowing toward the far goal
       without anything here having to draw a trapezoid. Perspective
       does it, because the bands are real ground. */
    var band = 11 / this.k;              // mowing band, in world units
    var L = this.raw.len;
    for (var y = y0; y < this.vh; y++) {
      var d = this.depthAtY(y + 0.5);
      if (d <= 0) continue;
      var wy = (this.swap ? this.cam.x : this.cam.y) + (d - NEAR) / this.k;
      var bi = Math.floor(wy / band);
      var t = Math.max(0, Math.min(1, wy / L));
      var gi = Math.min(GRADE_N - 1, Math.max(0, Math.round(t * (GRADE_N - 1))));
      ctx.fillStyle = (bi & 1) ? C.gradA[gi] : C.gradB[gi];
      ctx.fillRect(0, y, this.vw, 1);
    }
  };

  /* ============================================================ THE SIDES

     The stadium used to be one stand at the far end and then nothing:
     the touchlines ran off into bare grass and the vignette, so from
     the halfway line she was playing in a field with a grandstand in
     it. This is the other two.

     A side stand is a wall standing on a line that RECEDES, so it is
     rasterised by COLUMN rather than by row. For a screen column, the
     depth at which the touchline crosses it comes straight out of the
     projection — screenX = centre + worldX * focal / d rearranges to
     d = worldX * focal / offset — and everything else follows from that
     one number: where the ground is, and therefore where the boards,
     the tiers and the roof are stacked above it.

     Its height is fixed in pixels, like the crossbar and like the
     characters. A wall scaled by depth would be four storeys high at
     the near corner and a kerb at the far one.
     ======================================================================= */
  Pitch.prototype.drawSides = function () {
    var ctx = this.ctx, w = this.raw;
    if (this.mode === "oblique") return;    // drawStandFlat does both
    /* the side stands run along the touchlines, which only face the
       camera when the pitch runs up and down. Turned sideways they are
       the two GOAL ends, and that is a different piece of geometry —
       greyboxing does not need it to answer the question it is asking. */
    if (this.swap) return;
    var edge = w.halfW + 4 / this.k;          // touchline, then the run-off
    var BOARD = 9, TIER = 42, ROOF = 7;
    var farY = this.A + this.B / (NEAR + (w.len + 12 - this.cam.y) * this.k);

    for (var side = -1; side <= 1; side += 2) {
      var wx = side * edge;
      /* WHERE THE GROUND IS, PER COLUMN, WORKED OUT ONCE.

         The structure and the crowd are two passes over the same
         numbers because a person is three pixels wide and the columns
         are one: painted inside the first pass, everybody was drawn and
         then immediately buried under the next column's tier, and the
         whole stand came out empty with a scatter of single pixels in
         it. */
      var ground = new Int16Array(this.vw);
      for (var x = 0; x < this.vw; x++) {
        ground[x] = -1;
        var off = (x + 0.5) - this.vw / 2;
        if (side < 0 ? off >= -1 : off <= 1) continue;
        var d = (wx - this.cam.x) * this.k * FOCAL / off;
        if (!isFinite(d) || d <= NEAR) continue;
        var gy = Math.round(this.A + this.B / d);
        /* nothing beyond the far corner: that is the end stand's job,
           and two stands drawn over each other is a wall with a seam */
        if (gy <= farY || gy > this.vh + BOARD) continue;
        ground[x] = gy;

        /* the boards along the front */
        var bn = this.rnd((((x / 26) | 0) + side * 7) * 13 + 5);
        ctx.fillStyle = C.board;
        ctx.fillRect(x, gy - BOARD, 1, BOARD);
        ctx.fillStyle = bn > 0.55 ? "#a8283a" : (bn > 0.3 ? "#c8912f" : "#2f4f7a");
        ctx.fillRect(x, gy - BOARD + 1, 1, BOARD - 2);
        if (x % 26 === 0 || x % 26 === 24) {
          ctx.fillStyle = C.roof; ctx.fillRect(x, gy - BOARD, 1, BOARD);
        }
        ctx.fillStyle = C.boardLip;
        ctx.fillRect(x, gy - BOARD, 1, 1);

        /* the two tiers, the rail between them, and the roof */
        var top = gy - BOARD - TIER, split = Math.round(TIER * 0.44);
        ctx.fillStyle = C.tierLit;  ctx.fillRect(x, top, 1, TIER);
        ctx.fillStyle = C.tier;     ctx.fillRect(x, top, 1, split);
        ctx.fillStyle = C.rail;     ctx.fillRect(x, top + split, 1, 1);
        ctx.fillStyle = C.roof;     ctx.fillRect(x, top + split + 1, 1, 1);
        ctx.fillRect(x, top - ROOF, 1, ROOF);
        ctx.fillStyle = C.rail;     ctx.fillRect(x, gy - BOARD - 2, 1, 1);
        ctx.fillStyle = C.roof;     ctx.fillRect(x, gy - BOARD - 1, 1, 1);
        ctx.fillStyle = C.wallLit;  ctx.fillRect(x, top - ROOF, 1, 1);

        /* and the shadow the stand throws onto the run-off */
        ctx.fillStyle = C.grassDk;
        ctx.fillRect(x, gy, 1, 2);
      }

      /* pass two: the people, three pixels across like the ones opposite */
      for (var x2 = 0; x2 < this.vw; x2 += 3) {
        var g2 = ground[x2];
        if (g2 < 0) continue;
        var t2 = g2 - BOARD - TIER;
        for (var r = 0; r < 8; r++) {
          var ry = Math.round(t2 + 2 + r * (TIER / 8));
          if (ry < 0 || ry > this.vh) continue;
          var id = x2 * 31 + r * 131 + (side > 0 ? 977 : 0);
          if (this.rnd(id) < 0.14) continue;
          var sway = Math.round(Math.sin(this.t * 2.1 + x2 * 0.14 + r) * 0.9);
          ctx.fillStyle = CROWD[(this.rnd(id + 11) * CROWD.length) | 0];
          ctx.fillRect(x2, ry + sway, 3, 2);
          ctx.fillStyle = "#1a1620";
          ctx.fillRect(x2, ry + sway + 2, 3, 1);
        }
      }
    }
  };

  /* THE GRASS, WITHOUT A VANISHING POINT.

     In an oblique projection the pitch is a rectangle: the touchlines
     do not converge, so every screen row is the same width and the
     mowing bands are bands of constant height. It is a simpler draw
     than the perspective one and it looks it — which is the thing to
     judge, not the thing to argue about. */
  Pitch.prototype.drawGrassFlat = function () {
    var ctx = this.ctx, w = this.raw;
    var band = 9 / this.k;
    var l = this.project(-w.halfW, 0), r = this.project(w.halfW, 0);
    var x0 = Math.round(Math.min(l.x, r.x)), x1 = Math.round(Math.max(l.x, r.x));
    var top = this.project(0, w.len).y, bot = this.project(0, 0).y;
    if (this.swap) { top = this.project(0, 0).y; bot = this.project(0, w.len).y; }
    var yTop = Math.round(Math.min(top, bot)), yBot = Math.round(Math.max(top, bot));
    /* beyond the pitch in both directions is run-off, then the stands */
    ctx.fillStyle = C.grassDk;
    ctx.fillRect(0, 0, this.vw, this.vh);
    for (var y = Math.max(0, yTop); y <= Math.min(this.vh - 1, yBot); y++) {
      var wy = this.rowAt(y + 0.5);
      var bi = Math.floor(wy / band);
      ctx.fillStyle = (bi & 1) ? C.grassA : C.grassB;
      ctx.fillRect(Math.max(0, x0), y, Math.min(this.vw, x1) - Math.max(0, x0) + 1, 1);
    }
  };

  /* ------------------------------------------------------- the markings */
  Pitch.prototype.wline = function (x0, y0, x1, y1, col) {
    var a = this.project(x0, y0), b = this.project(x1, y1);
    line(this.ctx, a.x, a.y, b.x, b.y, col || C.line);
  };

  /* =======================================================================
     A PITCH LINE IS NOT A LINE, IT IS A STRIP OF PAINT

     Every marking here used to be a one-pixel Bresenham run between two
     ROUNDED endpoints. Two things are wrong with that, and both of them
     are things you can see.

     It SHIMMERS. Round the two ends, and the staircase between them is
     recomputed from the rounded values every frame; pan the camera by a
     third of a pixel and pixels three-quarters of the way along the run
     jump sideways, because the whole staircase has re-solved. A pitch
     whose lines crawl while the camera moves is the single loudest
     "this is a computer drawing" tell there is.

     It has NO WIDTH. Real pitch markings are about twelve centimetres
     of paint, which near the camera is several pixels and at the far
     goal is one. Drawn at a constant pixel everywhere, the near lines
     are too thin to read as paint and the far ones are too thick.

     So a marking is drawn as the strip of ground it actually is, and
     the strip is rasterised from the SCREEN side rather than from its
     endpoints:

       - a line across the pitch (constant pitch-y) lies at one single
         depth, so it is exactly one horizontal rectangle, and a
         rectangle cannot shimmer;

       - a line up the pitch (constant pitch-x) is solved once PER
         SCREEN ROW: the row says what depth it is looking at, the
         projection says where that line is at that depth and how wide
         the paint is there. Each row is independent, so panning moves
         each row's rounding smoothly and on its own instead of
         restaircasing the whole run.

     Both come out solid, continuous, and thicker near the camera, which
     is what paint on grass does.
     ======================================================================= */
  var LINEW = 2.4;                    // world units of paint, both ways

  /* a marking ACROSS the pitch: one depth, therefore one rectangle */
  Pitch.prototype.wbandY = function (x0, x1, y, wid, col) {
    var a = this.project(x0, y), b = this.project(x1, y);
    if (!a.flat && a.d <= NEAR + 0.5) return;
    var th = Math.max(1, Math.round(a.ky * (wid || LINEW)));
    var sx = Math.max(-2, Math.round(Math.min(a.x, b.x)));
    var ex = Math.min(this.vw + 2, Math.round(Math.max(a.x, b.x)));
    if (ex < sx) return;
    var sy = Math.round(a.y - th / 2);
    if (sy + th < 0 || sy > this.vh) return;
    this.ctx.fillStyle = col || C.line;
    this.ctx.fillRect(sx, sy, ex - sx + 1, th);
  };

  /* a marking UP the pitch: solved per screen row */
  Pitch.prototype.wbandX = function (x, y0, y1, wid, col) {
    /* turned sideways this is the other axis's job, and the greybox is
       the only thing that ever turns it sideways */
    if (this.swap) return this.wline(x, y0, x, y1, col);
    var a = this.project(x, y0), b = this.project(x, y1);
    var r0 = Math.max(0, Math.round(Math.min(a.y, b.y)));
    var r1 = Math.min(this.vh - 1, Math.round(Math.max(a.y, b.y)));
    var lo = Math.min(y0, y1), hi = Math.max(y0, y1);
    var ctx = this.ctx;
    ctx.fillStyle = col || C.line;
    for (var r = r0; r <= r1; r++) {
      var wy = this.rowAt(r + 0.5);
      if (wy < lo - 0.6 || wy > hi + 0.6) continue;
      var pr = this.project(x, wy);
      if (!pr.flat && pr.d <= NEAR + 0.5) continue;
      var t = Math.max(1, Math.round(pr.k * (wid || LINEW)));
      var px0 = Math.round(pr.x - t / 2);
      if (px0 + t < 0 || px0 > this.vw) continue;
      ctx.fillRect(px0, r, t, 1);
    }
  };

  /* AN ARC IS SAMPLED UNTIL IT IS SOLID.

     Forty samples joined by one-pixel lines was a centre circle that
     came apart into dashes near the camera, where forty samples are
     twenty pixels apart. The sample count now comes off the arc's
     measured length ON SCREEN, and each sample is a paint-sized
     rectangle rather than a pixel, so consecutive samples overlap and
     the result is a continuous stroke at every depth. */
  Pitch.prototype.warc = function (cx, cy, r, a0, a1, col, wid) {
    var ctx = this.ctx;
    var mid = this.project(cx, cy);
    var span = Math.abs(a1 - a0) * r * Math.max(mid.k, mid.ky);
    var n = Math.max(32, Math.min(420, Math.ceil(span * 1.6)));
    ctx.fillStyle = col || C.line;
    for (var i = 0; i <= n; i++) {
      var a = a0 + (a1 - a0) * (i / n);
      var q = this.project(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
      if (!q.flat && q.d <= NEAR + 0.5) continue;
      var tw = Math.max(1, Math.round(q.k * (wid || LINEW)));
      var th = Math.max(1, Math.round(q.ky * (wid || LINEW)));
      var x = Math.round(q.x - tw / 2), y = Math.round(q.y - th / 2);
      if (x + tw < 0 || x > this.vw || y + th < 0 || y > this.vh) continue;
      ctx.fillRect(x, y, tw, th);
    }
  };

  /* a spot is a disc of paint, not a pixel */
  Pitch.prototype.wspot = function (x, y, r) {
    var q = this.project(x, y);
    if (!q.flat && q.d <= NEAR + 0.5) return;
    fillEllipse(this.ctx, q.x, q.y, Math.max(1, Math.round(q.k * r)),
                Math.max(1, Math.round(q.ky * r)), C.line);
  };

  Pitch.prototype.drawMarkings = function () {
    var w = this.raw, hw = w.halfW, L = w.len;
    /* touchlines and goal lines */
    this.wbandX(-hw, 0, L);
    this.wbandX(hw, 0, L);
    this.wbandY(-hw, hw, 0);
    this.wbandY(-hw, hw, L);
    /* THE HALFWAY LINE IS THE WIDEST PAINT ON THE PITCH, which is not a
       liberty: it is the one line the eye uses to judge which half the
       ball is in, and at this size a hair's difference is what makes
       that readable at a glance. */
    this.wbandY(-hw, hw, L / 2, LINEW * 1.15);
    this.warc(0, L / 2, w.circleR, 0, Math.PI * 2);
    this.wspot(0, L / 2, 1.6);
    for (var e = 0; e < 2; e++) {
      var gl = e ? L : 0, sg = e ? -1 : 1;
      this.wbandX(-w.boxHalf, gl, gl + sg * w.boxDepth);
      this.wbandX(w.boxHalf, gl, gl + sg * w.boxDepth);
      this.wbandY(-w.boxHalf, w.boxHalf, gl + sg * w.boxDepth);
      this.wbandX(-w.sixHalf, gl, gl + sg * w.sixDepth);
      this.wbandX(w.sixHalf, gl, gl + sg * w.sixDepth);
      this.wbandY(-w.sixHalf, w.sixHalf, gl + sg * w.sixDepth);
      this.wspot(0, gl + sg * w.spot, 1.6);
      /* THE D IS THE PART OF THE ARC OUTSIDE THE BOX, and only that
         part: swept from the penalty spot across its whole half it drew
         a full half-circle straight through the eighteen-yard line, so
         every box had a bite taken out of it. The cut-off is worked out
         rather than guessed — it is where the arc crosses the line. */
      var reach = w.boxDepth - w.spot;        // spot to the edge of the box
      if (Math.abs(reach) < w.circleR) {
        var cut = Math.acos(Math.max(-1, Math.min(1, reach / w.circleR)));
        this.warc(0, gl + sg * w.spot, w.circleR,
                  sg > 0 ? cut : Math.PI + cut,
                  sg > 0 ? Math.PI - cut : Math.PI * 2 - cut);
      }
    }
    /* the four corner quadrants */
    this.warc(-hw, 0, w.circleR * 0.2, 0, Math.PI / 2);
    this.warc(hw, 0, w.circleR * 0.2, Math.PI / 2, Math.PI);
    this.warc(-hw, L, w.circleR * 0.2, -Math.PI / 2, 0);
    this.warc(hw, L, w.circleR * 0.2, Math.PI, Math.PI * 1.5);
  };

  /* --------------------------------------------------------- the goals
     A frame, and a net made of a one-pixel lattice rather than a grey
     wash: the lattice is what says "net" at this size. `bulge` is how
     hard the ball has just hit it, and it is the only thing on the pitch
     that tells you a goal went in before the crowd does. */
  /* =======================================================================
     A GOAL IS AN ENCLOSURE, NOT A PATTERN

     The old one drew a four-pixel grid of single pixels across the
     mouth. At this size a grid of isolated pixels does not read as
     netting — it reads as polka dots painted on the grass, and because
     nothing behind the mouth was ever drawn, the goal had no inside.

     A net reads from three things, in this order of importance:

       1. THE BACK PLANE. Almost everything you actually see of a net is
          the panel at the back, several feet behind the line and
          therefore smaller and higher up. Drawing it is what gives the
          goal a volume for the ball to go INTO.
       2. CONTINUOUS THREADS. Vertical threads full height, horizontal
          threads full width — lines, not dots. Verticals carry more of
          the reading, so they are drawn stronger.
       3. THE ROOF AND SIDES, as a few threads running from the front
          frame back to the back panel. Three or four each is enough;
          what they supply is the perspective, not the detail.

     The wobble is per COLUMN and driven by the clock, so the net
     breathes when nothing is happening and snaps when the ball arrives.
     ======================================================================= */
  Pitch.prototype.drawGoal = function (far, bulge) {
    var ctx = this.ctx, w = this.raw;
    var gl = far ? w.len : 0;
    var out = far ? 1 : -1;                    // which way is "behind the goal"
    var fp = this.project(0, gl);
    /* A GOAL BEHIND THE CAMERA IS NOT A GOAL, IT IS A LATTICE.

       The projection clamps depth to a minimum rather than failing, so
       a goal line behind the lens comes back with an enormous scale and
       the netting loop walks the whole width of the screen. On the
       match camera you never saw it; the moment a super cut in close,
       the entire pitch came out under a dotted mesh. */
    if (fp.d <= NEAR + 1) return;

    /* THE FRAME IS A FIXED HEIGHT IN PIXELS, and that is the same
       decision the characters are drawn with. They never scale with
       depth, so a goal that did would tower over a keeper at one end
       and come up to his knee at the other. Its WIDTH stays in
       perspective because width lies on the ground plane, and the
       ground plane is the one thing here that is real. */
    var hgt = 52;
    var lf = this.project(-w.goalHalf, gl), rf = this.project(w.goalHalf, gl);
    var bk = gl + out * w.goalDepth;
    var lb = this.project(-w.goalHalf, bk), rb = this.project(w.goalHalf, bk);
    /* the near goal's back panel can fall behind the lens; when it does
       there is no volume to draw and the mouth is all there is */
    var solid = lb.d > NEAR + 1 && rb.d > NEAR + 1;
    var push = Math.sin(Math.max(0, Math.min(1, bulge || 0)) * Math.PI) * 5;

    var fx0 = Math.round(lf.x), fx1 = Math.round(rf.x);
    var fyB = Math.round(lf.y), fyT = fyB - hgt;
    /* the back panel stands lower than the frame, the way a net that is
       pegged to the ground does */
    var bhgt = Math.round(hgt * 0.70);
    var bx0 = Math.round(lb.x), bx1 = Math.round(rb.x);
    var byB = Math.round(lb.y) - Math.round(out * push);
    var byT = byB - bhgt;
    if (!solid) { bx0 = fx0; bx1 = fx1; byB = fyB; byT = fyT; }
    if (fx1 - fx0 < 3) return;

    /* ---- the shadow the frame throws on the grass, in front of it */
    var sh = this.project(0, gl - out * 4.5);
    ctx.globalAlpha = 0.26;
    fillEllipse(ctx, (lf.x + rf.x) / 2, (fp.y + sh.y) / 2,
                Math.round((rf.x - lf.x) / 2) + 2,
                Math.max(1, Math.round(Math.abs(sh.y - fp.y) / 2) + 1), "#000000");
    ctx.globalAlpha = 1;

    /* ---- the volume behind the line, so the ball goes somewhere */
    if (solid) {
      ctx.globalAlpha = 0.34;
      ctx.fillStyle = mix(C.grassDk, "#000000", 0.55);
      var vTop = Math.min(byT, fyT), vBot = Math.max(byB, fyB);
      ctx.fillRect(Math.min(bx0, fx0), vTop,
                   Math.max(bx1, fx1) - Math.min(bx0, fx0) + 1, vBot - vTop + 1);
      ctx.globalAlpha = 1;
    }

    var self = this;
    var wob = function (i) {
      /* a net breathes; when the ball hits it, it snaps */
      return Math.round(Math.sin(self.t * 1.9 + i * 0.7) * 0.8 + push * 0.3);
    };

    /* ---- the back panel: verticals, then horizontals */
    var step = 3;
    ctx.fillStyle = C.net;
    ctx.globalAlpha = 0.55;
    var cols = Math.max(3, Math.floor((bx1 - bx0) / step));
    for (var i = 0; i <= cols; i++) {
      var cx = bx0 + Math.round((bx1 - bx0) * (i / cols));
      var wv = wob(i);
      ctx.fillRect(cx, byT + wv, 1, byB - byT + 1);
    }
    ctx.globalAlpha = 0.34;
    for (var yy = byT; yy <= byB; yy += step) {
      ctx.fillRect(bx0, yy + wob(yy * 0.4), bx1 - bx0 + 1, 1);
    }
    ctx.globalAlpha = 1;

    /* ---- roof and side panels: a few threads each, which is all the
       perspective needs and all that survives at fifty-two pixels */
    if (solid) {
      ctx.globalAlpha = 0.40;
      for (var u = 0; u <= 1.0001; u += 0.25) {
        line(ctx, fx0 + (fx1 - fx0) * u, fyT,
                  bx0 + (bx1 - bx0) * u, byT + wob(u * 9), C.net);
      }
      for (var v = 0; v <= 1.0001; v += 0.34) {
        var fy = fyT + (fyB - fyT) * v, by = byT + (byB - byT) * v;
        line(ctx, fx0, fy, bx0, by, C.net);
        line(ctx, fx1, fy, bx1, by, C.net);
      }
      ctx.globalAlpha = 1;
    }

    /* ---- the frame. Bright, two pixels, with a shaded edge so a post
       is a round thing and not a white stick. */
    ctx.fillStyle = C.post;
    ctx.fillRect(fx0 - 1, fyT, 2, hgt);
    ctx.fillRect(fx1, fyT, 2, hgt);
    ctx.fillRect(fx0 - 1, fyT, fx1 - fx0 + 3, 2);
    ctx.fillStyle = C.postDk;
    ctx.fillRect(fx0 + 1, fyT + 2, 1, hgt - 2);
    ctx.fillRect(fx1 + 2, fyT + 2, 1, hgt - 2);
    ctx.fillRect(fx0 - 1, fyT + 2, fx1 - fx0 + 3, 1);
    /* and the stanchions at the back, dimmer because they are further */
    if (solid) {
      ctx.globalAlpha = 0.7;
      ctx.fillStyle = C.postDk;
      ctx.fillRect(bx0, byT, 1, byB - byT);
      ctx.fillRect(bx1, byT, 1, byB - byT);
      ctx.globalAlpha = 1;
    }
  };

  /* ====================================================== WHAT STANDS ON IT

     Everything on the grass goes into one list and comes out sorted by
     how far away it is. Painter's order is the whole of depth in a 2D
     scene: get it wrong and a defender stands in front of the striker
     they are behind. */
  Pitch.prototype.add = function (wy, fn) { this.items.push({ y: wy, fn: fn }); };

  /* Part 1.7: the shadow is an ellipse on the ground, and it SHRINKS and
     darkens towards a point as the character rises. A shadow that stays
     the same size while its owner jumps nails them to the turf. */
  /* =======================================================================
     A FLOODLIT PLAYER HAS MORE THAN ONE SHADOW

     There are four pylons drawn on the roofline of this stadium and
     every player on the pitch cast exactly one soft ellipse, directly
     underneath them, as though lit by a single lamp hanging from the
     sky. It is the detail that most separates a night match in a
     professional football game from a sprite standing on grass, and it
     costs two more ellipses.

     Real floodlighting throws a shadow away from each tower, so a
     player near the middle of the pitch has three or four faint ones
     fanning out around his feet and a player under a tower has one long
     one. What sells it is that the fan CHANGES as he crosses the pitch:
     the shadows swing round him, which is motion the eye reads as
     lighting without ever thinking about it.

     Two compromises, both deliberate. The offsets are worked out from
     where the towers are on the ground rather than from any real light
     maths — at this size the difference is invisible and the maths is
     not. And the shadows are drawn faintest-first so the darkest one is
     on top, because three equal ellipses overlapping read as a stain
     rather than as light from three directions.
     ======================================================================= */
  var LAMPS = [
    /* across the pitch, along it, and how strong — the two behind the
       far corners are the ones in shot, so they get most of the weight */
    { x: -0.82, y: 1.30, w: 1.00 },
    { x: 0.82, y: 1.30, w: 1.00 },
    { x: -0.82, y: -0.30, w: 0.62 },
    { x: 0.82, y: -0.30, w: 0.62 },
  ];

  Pitch.prototype.shadow = function (wx, wy, r, air) {
    var p = this.project(wx, wy);
    var f = 1 - Math.min(0.55, (air || 0) * 0.055);
    var rx = Math.max(2, p.k * r * f), ry = Math.max(1, p.ky * r * f * 1.8);
    var w = this.raw, ctx = this.ctx;
    /* how far along the pitch this player is, and how far across */
    var ax = wx / Math.max(1, w.halfW), ay = wy / Math.max(1, w.len);
    for (var i = 0; i < LAMPS.length; i++) {
      var L = LAMPS[i];
      /* the direction from the lamp to the player, on the ground */
      var dx = ax - L.x, dy = ay - L.y;
      var dl = Math.sqrt(dx * dx + dy * dy) || 1;
      /* the further from the tower, the longer and fainter the throw */
      var reach = Math.min(1.35, 0.45 + dl * 0.75);
      var ox = dx / dl * reach * rx * 1.45;
      var oy = dy / dl * reach * ry * 1.45;
      ctx.globalAlpha = 0.21 * L.w;
      fillEllipse(ctx, p.x + ox, p.y - 1 + oy, rx * 0.96, ry * 0.96, C.shadow);
    }
    ctx.globalAlpha = 1;
    /* and the contact shadow, hard and directly underneath, which is
       what actually plants the boots on the grass */
    fillEllipse(ctx, p.x, p.y - 1, rx * 0.84, ry * 0.84, C.shadow);
  };

  /* THE RING UNDER THE PLAYER BEING DRIVEN.

     A projected annulus with two rotating gaps, so it reads as a live
     marker rather than a decal. Two things on top of that:

     It BREATHES. A ring that only spins reads as decoration; a ring
     that changes size reads as a thing that is SELECTED — and on a
     pitch with eight near-identical figures on it, knowing which one is
     yours at a glance is the most important piece of information on the
     screen.

     And it carries the team's hue without losing the gold's brightness.
     The original was flat trophy gold specifically so that it could
     never be lost against a kit, which is a real constraint and not a
     preference: a dark trim on a dark pitch is a ring you cannot see.
     Tinting it the whole way to the team colour would have thrown that
     away, so the colour is blended half and half — the hue says whose
     it is, the luminance keeps it legible on any grass. */
  Pitch.prototype.ring = function (wx, wy, phase, rad, col) {
    var ctx = this.ctx, n = 96;
    var pulse = 1 + Math.sin(this.t * 4.2) * 0.075;
    var r = (rad || 1.7) * pulse / this.k;
    var lit = col ? mix(C.ring, col, 0.5) : C.ring;
    var dk = col ? mix(lit, "#000000", 0.45) : C.ringDk;
    for (var i = 0; i < n; i++) {
      var a = (i / n) * Math.PI * 2;
      var g = ((i / n) + (phase || 0)) % 1;
      if (g < 0.07 || (g > 0.5 && g < 0.57)) continue;
      var p = this.project(wx + Math.cos(a) * r, wy + Math.sin(a) * r);
      px(ctx, p.x, p.y, lit);
      px(ctx, p.x, p.y + 1, dk);
    }
  };

  /* the character. Drawn at 1:1 with no smoothing and on whole pixels —
     the two things that keep the bible's outline one pixel wide. */
  /* =======================================================================
     HOW BIG A PLAYER IS AT A GIVEN DEPTH — IN FOUR SIZES, NOT A HUNDRED

     Drawn at 1:1 everywhere, a keeper standing on his own goal line came
     out the same height as the striker running at him from the centre
     circle, and the pitch lost its depth the moment two players at
     different ends were on screen together.

     Scaling them is the fix, but scaling a PIXEL sprite is not free:
     nearest-neighbour at 0.83 drops every sixth row, and the first
     thing to go is the one-pixel outline that separates a player from
     the grass. Worse, a scale that varies CONTINUOUSLY with depth makes
     the dropped rows move as the player runs — the sprite boils.

     So the ramp is QUANTISED to eighths. A player is drawn at 64, 56,
     48 or 40 pixels and nothing in between: every one of those is a
     whole-pixel divisor of the cell, the dropped rows land in the same
     places every frame, and a player crossing from one step to the next
     does it once rather than continuously. Four sizes is what a sprite
     game of this kind actually shipped, and for the same reason.

     The ramp itself is real perspective — a ratio of depths, not a
     fraction of the pitch — measured against the depth of the row the
     player being driven stands on, so she is always the full 64 and
     everything else is sized relative to her. */
  var MIN_SCALE = 0.625;             // five eighths, and no further
  Pitch.prototype.refDepth = function () {
    if (this.mode === "oblique") return NEAR;
    return this.depthAtY(this.vh * 0.78);
  };
  Pitch.prototype.depthScale = function (p) {
    if (p.flat) return 1;
    var s = this.refDepth() / Math.max(1, p.d);
    s = Math.max(MIN_SCALE, Math.min(1, s));
    return Math.round(s * 8) / 8;
  };

  Pitch.prototype.sprite = function (at, anim, faceId, frame, wx, wy, flip, air, scale) {
    var ctx = this.ctx;
    var p = this.project(wx, wy);
    var uv = at.uv(anim, faceId, frame);
    if (!uv) return;
    var S = at.size;
    var sc = scale === undefined || scale === null ? this.depthScale(p) : scale;
    var D = Math.max(8, Math.round(S * sc));
    /* the cell's ground line is where the boots are, so that is what
       lands on the projected point rather than the bottom of the cell */
    var dx = Math.round(p.x - D / 2);
    /* `air` is in SPRITE PIXELS — it comes off the frame itself, which
       knows how far off the ground it drew her. Multiplying it by the
       lens, as the first version did, lifted a sliding tackle eighteen
       pixels into the sky and left its shadow on the grass underneath.
       It does scale with the sprite, because it is measured in that
       sprite's own pixels. */
    var dy = Math.round(p.y - at.ground * sc - (air || 0) * sc);
    ctx.imageSmoothingEnabled = false;
    if (flip) {
      ctx.save();
      ctx.translate(dx + D, dy);
      ctx.scale(-1, 1);
      ctx.drawImage(at.canvas, uv.col * S, uv.row * S, S, S, 0, 0, D, D);
      ctx.restore();
    } else {
      ctx.drawImage(at.canvas, uv.col * S, uv.row * S, S, S, dx, dy, D, D);
    }
  };

  /* one call per player: the shadow, the ring under them if they are the
     one being driven, and the sprite, all at the same depth so the sort
     keeps them together */
  Pitch.prototype.player = function (o) {
    var self = this;
    this.add(o.wy, function () {
      var sc = o.scale === undefined || o.scale === null
        ? self.depthScale(self.project(o.wx, o.wy)) : o.scale;
      /* the shadow shrinks with the player standing on it */
      self.shadow(o.wx, o.wy, (o.shadow || 4) * sc, (o.air || 0) * sc);
      if (o.ring !== undefined && o.ring !== null) self.ring(o.wx, o.wy, o.ring, null, o.ringCol);
      self.sprite(o.at, o.anim, o.face, o.frame, o.wx, o.wy, o.flip, o.air, sc);
      if (o.num) self.shirtNumber(o, sc);
    });
  };

  /* =======================================================================
     THE NUMBER ON THE BACK

     Only on the back, and only at full size, because those are the two
     conditions under which it is a number rather than a smudge. A
     player running away from the camera shows you his shirt; a player
     running at you shows you his face, which is a better identifier
     than a digit anyway.

     It is painted over the sprite rather than baked into the atlas on
     purpose. Baking it would mean a separate atlas per player instead
     of per look-and-kit — fourteen bakes where there are now eight —
     to add five pixels that are visible from two of the five facings.
     ======================================================================= */
  Pitch.prototype.shirtNumber = function (o, sc) {
    /* TOO FAR AWAY TO READ.

       The first cut of this asked for a full-size sprite, which sounds
       right and never fired once: the depth scale is quantised to
       eighths, and a player standing at the depth the camera is
       actually focused on comes out at 0.875 rather than 1. The two
       nearest size steps are the ones a four-pixel digit survives. */
    if (sc < 0.8) return;
    var f = o.face;
    if (f !== "n" && f !== "ne") return;          // only from behind
    var p = this.project(o.wx, o.wy);
    var ctx = this.ctx;
    var str = String(o.num);
    var w = textWidth(str);
    /* on the shoulder blades: a third of the way down the figure from
       the top of the head, which lands between the neck and the waist */
    var x = Math.round(p.x - w / 2) + (f === "ne" ? (o.flip ? 2 : -2) : 0);
    /* ON THE SHOULDER BLADES, MEASURED UP FROM THE BOOTS.

       Measuring down from the top of the CELL is measuring from empty
       space: the cell is sixty-four tall, the figure is forty-eight of
       it, and the head takes the first third of that — so three tenths
       of the cell put the number in her hair, which is exactly where it
       appeared. The feet are the one landmark that is always at a known
       place (the projected point itself), so the upper back is six
       tenths of the figure's height above them. */
    var y = Math.round(p.y - (o.air || 0) * sc - o.at.figure * sc * 0.60);
    drawText(ctx, str, x, y + 1, "rgba(8,12,10,.55)");
    drawText(ctx, str, x, y, o.numCol || "#f4f6f2");
  };

  /* the ball: three tones and a hard edge, never a gradient */
  /* THE BALL, WITH WEIGHT

     Three things make a drawn football heavy, and none of them is
     detail: it FLATTENS on the frame it is struck, it STRETCHES along
     the line it is travelling, and it TURNS. A hard disc that slides
     across the grass at a constant size is a counter on a board — which
     is exactly what this was for the whole of the 2D port, because the
     simulation went on computing `struck` and nothing read it.

     The stretch is axis-aligned rather than rotated to the direction of
     travel. At six pixels across, a rotated ellipse is a smear; which
     axis is longer is the whole of the information, and it is the part
     that survives at this size. */
  Pitch.prototype.ball = function (wx, wy, h, tint, rw, o) {
    var self = this;
    o = o || {};
    this.add(wy, function () {
      var p = self.project(wx, wy);
      var ctx = self.ctx;
      /* the radius arrives in WORLD units. Working it out from the lens
         alone, as the first version did, gave a forty-pixel football
         sitting on top of the player who was dribbling it. */
      var r = Math.max(2, Math.round(p.k * (rw || 1.9)));
      var hit = Math.min(1, o.struck || 0);
      var sp = o.speed || 0;
      /* which way it is going, on the screen */
      var ax = Math.abs(o.vx || 0), ay = Math.abs(o.vy || 0) * 0.5;
      var along = sp > 8 ? Math.min(0.30, sp * 0.0016) : 0;
      var wide = ax >= ay ? along : -along * 0.6;
      var rx = Math.max(1, Math.round(r * (1 + hit * 0.40 + wide)));
      var ry = Math.max(1, Math.round(r * (1 - hit * 0.30 - wide * 0.7)));
      var by = p.y - (h || 0) * p.k - ry;
      fillEllipse(ctx, p.x, by, rx, ry, tint || "#f4f4e8");
      fillEllipse(ctx, p.x + 1, by + 1, rx - 1, ry - 1,
                  tint ? tint : "#cfd2c4");
      px(ctx, p.x - 1, by - 1, "#ffffff");
      if (tint) return;
      /* AND IT TURNS. Three panels carried round on the ball's own
         rolled angle: at this size that is the difference between a ball
         and a white dot. */
      /* ROLLED IN STEPS, NOT SWEPT.

         Carried round on a continuous angle, three panels on a six-pixel
         ball spend most of their time halfway between two pixels, and
         what that looks like is not rotation — it is three dots
         twitching. Snapped to eighths of a turn, each panel sits
         somewhere definite and moves in visible increments, which is
         what actually reads as a ball rolling. It is the same argument
         as the sprite scale being quantised, for the same reason. */
      var STEPS = 8;
      var a0 = Math.round((o.spin || 0) / (Math.PI * 2 / STEPS)) * (Math.PI * 2 / STEPS);
      for (var i = 0; i < 3; i++) {
        var a = a0 + i * (Math.PI * 2 / 3);
        px(ctx, Math.round(p.x + Math.cos(a) * rx * 0.55),
           Math.round(by + Math.sin(a) * ry * 0.55), "#3a3f38");
      }
      px(ctx, p.x, by, "#3a3f38");
    });
  };

  /* =======================================================================
     WHO THE PASS IS GOING TO

     Pressing pass and finding out afterwards who received it is the
     oldest complaint about football games, and the answer every one of
     them arrived at is the same: show the receiver before the ball is
     struck. Two marks, because one is not enough:

       THE CHEVRON above the man, which says WHO. It bobs, because a
       static arrow over a running player reads as part of the sprite
       and a moving one reads as a pointer.

       THE LANE on the grass, which says WHERE — and, because it is
       drawn along the actual line the ball will travel, it also shows
       when a defender is standing in it without having to say so.

     Both are drawn under everything that stands on the pitch, so a
     player never has a lane painted across his chest.
     ======================================================================= */
  Pitch.prototype.marker = function (wx, wy, col, phase) {
    var self = this;
    this.add(wy - 0.01, function () {
      var p = self.project(wx, wy);
      if (!p.flat && p.d <= NEAR + 1) return;
      var bob = Math.round(Math.sin((phase || 0) * 6) * 1.5);
      var x = Math.round(p.x), y = Math.round(p.y) - 56 + bob;
      var ctx = self.ctx;
      /* a chevron, drawn as three rows so it is a wedge and not a v */
      for (var r = 0; r < 4; r++) {
        var w = 7 - r * 2;
        if (w < 1) break;
        ctx.fillStyle = "#0d1412";
        ctx.fillRect(x - Math.floor(w / 2) - 1, y + r, w + 2, 1);
      }
      for (var r2 = 0; r2 < 4; r2++) {
        var w2 = 7 - r2 * 2;
        if (w2 < 1) break;
        ctx.fillStyle = r2 === 0 ? lift2(col, 60) : col;
        ctx.fillRect(x - Math.floor(w2 / 2), y + r2, w2, 1);
      }
    });
  };

  /* the lane, dotted and travelling, so it reads as a direction rather
     than as a line somebody drew on the pitch */
  Pitch.prototype.lane = function (x0, y0, x1, y1, col, phase) {
    var a = this.project(x0, y0), b2 = this.project(x1, y1);
    if ((!a.flat && a.d <= NEAR + 1) || (!b2.flat && b2.d <= NEAR + 1)) return;
    var dx = b2.x - a.x, dy = b2.y - a.y;
    var L = Math.sqrt(dx * dx + dy * dy);
    if (L < 6) return;
    var n = Math.floor(L / 5);
    var ctx = this.ctx;
    for (var i = 1; i < n; i++) {
      var t = ((i / n) + ((phase || 0) * 0.35 % (1 / n))) % 1;
      var px2 = Math.round(a.x + dx * t), py2 = Math.round(a.y + dy * t);
      /* it fades toward the receiver, so the eye runs the right way */
      ctx.globalAlpha = 0.16 + 0.5 * (1 - t);
      ctx.fillStyle = col;
      ctx.fillRect(px2, py2, 2, 1);
    }
    ctx.globalAlpha = 1;
  };

  function lift2(hex, amt) {
    var c = parseInt(hex.slice(1), 16);
    var f = function (sh) {
      return Math.max(0, Math.min(255, ((c >> sh) & 255) + amt));
    };
    return "#" + ((1 << 24) + (f(16) << 16) + (f(8) << 8) + f(0)).toString(16).slice(1);
  }

  /* a bead of the super's trail: no additive blending, no soft edges,
     just a hard disc of the shot's own colour going dark behind it */
  Pitch.prototype.bead = function (wx, wy, h, r, col) {
    var p = this.project(wx, wy);
    fillEllipse(this.ctx, p.x, p.y - (h || 0) * p.k,
                Math.max(1, r), Math.max(1, r), col);
  };

  /* ---------------------------------------------------------- confetti
     Two hundred rectangles falling out of the stand when somebody
     scores. They live in world coordinates so they fall past the players
     rather than over the top of everything. */
  Pitch.prototype.burst = function (wx, wy, n, cols) {
    for (var i = 0; i < n; i++) {
      this.conf.push({
        x: wx + (Math.random() - 0.5) * 90 / this.k,
        y: wy + (Math.random() - 0.5) * 60 / this.k,
        h: 40 / this.k + Math.random() * 30 / this.k,
        vx: (Math.random() - 0.5) * 14 / this.k,
        vy: (Math.random() - 0.5) * 14 / this.k,
        vh: -2 / this.k - Math.random() * 6 / this.k,
        life: 2.4 + Math.random() * 1.6,
        col: cols[(Math.random() * cols.length) | 0],
        w: 1 + ((Math.random() * 2) | 0),
      });
      if (this.conf.length > 260) this.conf.shift();
    }
  };
  Pitch.prototype.confettiStep = function (dt) {
    var self = this;
    for (var i = this.conf.length - 1; i >= 0; i--) {
      var c = this.conf[i];
      c.life -= dt;
      if (c.life <= 0 || c.h < -4) { this.conf.splice(i, 1); continue; }
      c.x += c.vx * dt; c.y += c.vy * dt;
      c.h += c.vh * dt; c.vh += 26 / this.k * dt;
      /* it flutters, which is one sine and the only thing that stops two
         hundred squares falling like gravel */
      c.vx += Math.sin(this.t * 6 + c.life * 9) * 6 / this.k * dt;
    }
    this.conf.forEach(function (c) {
      self.add(c.y, function () {
        var p = self.project(c.x, c.y);
        var fl = Math.abs(Math.sin(self.t * 7 + c.life * 11)) > 0.4 ? 1 : 0;
        self.ctx.fillStyle = c.col;
        self.ctx.fillRect(Math.round(p.x), Math.round(p.y - c.h * p.k),
                          c.w + fl, 1 + fl);
      });
    });
  };

  /* =======================================================================
     THE PITCH COMES UP

     Grass, thrown by a sliding tackle, a hard turn, a struck ball or a
     keeper going down. A couple of dozen two-pixel flecks that arc up,
     fall back and lie there for a moment before fading.

     It is the only thing in the match that says the players are
     standing ON the ground rather than in front of it, and it costs
     almost nothing: they are the confetti with a shorter life, a
     heavier fall and no flutter — grass does not flutter, it goes up
     and it comes down.

     They sort by depth with everything else, so a divot kicked up at
     the far post goes behind the players in front of it. */
  Pitch.prototype.turf = function (wx, wy, n, ang) {
    for (var i = 0; i < n; i++) {
      var a = (ang === undefined) ? Math.random() * Math.PI * 2
                                  : ang + (Math.random() - 0.5) * 2.0;
      var sp = (10 + Math.random() * 26) / this.k;
      this.divots.push({
        x: wx + (Math.random() - 0.5) * 5 / this.k,
        y: wy + (Math.random() - 0.5) * 4 / this.k,
        h: 1 + Math.random() * 3,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.55,
        vh: 16 + Math.random() * 30,
        life: 0.34 + Math.random() * 0.4,
        big: Math.random() < 0.34,
        lit: Math.random() < 0.34,
      });
      if (this.divots.length > 200) this.divots.shift();
    }
  };

  Pitch.prototype.turfStep = function (dt) {
    var self = this;
    for (var i = this.divots.length - 1; i >= 0; i--) {
      var g = this.divots[i];
      g.life -= dt;
      if (g.life <= 0) { this.divots.splice(i, 1); continue; }
      g.x += g.vx * dt; g.y += g.vy * dt;
      g.h += g.vh * dt; g.vh -= 190 * dt;
      if (g.h < 0) { g.h = 0; g.vh = 0; g.vx *= 0.4; g.vy *= 0.4; }
    }
    this.divots.forEach(function (g) {
      self.add(g.y, function () {
        var p = self.project(g.x, g.y);
        if (!p.flat && p.d <= NEAR + 1) return;
        self.ctx.fillStyle = g.lit ? C.grassLit : C.grassDk;
        self.ctx.fillRect(Math.round(p.x), Math.round(p.y - g.h),
                          g.big ? 2 : 1, g.big ? 2 : 1);
      });
    });
  };

  /* ------------------------------------------------------------- a frame */
  Pitch.prototype.begin = function (dt, bulge) {
    this.t += dt || 0;
    this.items.length = 0;
    this.drawStand();
    this.drawGrass();
    /* the sides go on AFTER the grass, because they stand on it: drawn
       first, the grass rows painted straight over them */
    this.drawSides();
    this.drawMarkings();
    this.drawGoal(true, bulge && bulge[1]);
    this.drawGoal(false, bulge && bulge[0]);
  };

  /* far things first. Everything that touches the grass went into one
     list precisely so that this is the only place depth is decided. */
  Pitch.prototype.flush = function () {
    this.items.sort(function (a, b) { return b.y - a.y; });
    for (var i = 0; i < this.items.length; i++) this.items[i].fn();
    this.items.length = 0;
  };

  /* PART 8's VIGNETTE, done without a gradient: rings of dimmed edge at
     fixed strengths. A CSS gradient over a pixel scene is the exact
     mismatch the whole rebuild is about. */
  Pitch.prototype.finish = function () {
    var ctx = this.ctx;
    /* THE VIGNETTE IS A FRAME, NOT A MOOD.

       Three passes at eighteen per cent stacked to just under half
       opacity at the very edge, which pulled the corners of a bright
       pitch down into mud and made the whole chapter read darker than
       every other screen on the site. Two passes at nine keep the
       job it is actually doing — holding the eye off the edges of the
       frame — without grading the game down to do it. */
    ctx.globalAlpha = 0.09; ctx.fillStyle = "#0a0812";
    for (var i = 0; i < 2; i++) {
      var w = 5 + i * 6;
      ctx.fillRect(0, 0, w, this.vh); ctx.fillRect(this.vw - w, 0, w, this.vh);
      ctx.fillRect(0, 0, this.vw, w * 0.55);
      ctx.fillRect(0, this.vh - w * 0.55, this.vw, w);
    }
    ctx.globalAlpha = 1;
    if (this.flash > 0) {
      ctx.globalAlpha = Math.min(0.85, this.flash);
      ctx.fillStyle = this.flashCol;
      ctx.fillRect(0, 0, this.vw, this.vh);
      ctx.globalAlpha = 1;
    }
  };

  /* blit the virtual screen onto the real one at a WHOLE number of
     pixels per pixel, centred, with the letterbox in the stand colour */
  Pitch.prototype.present = function () {
    var d = this.display, c = d.getContext("2d");
    var s = Math.max(1, Math.floor(Math.min(d.width / this.vw, d.height / this.vh)));
    c.imageSmoothingEnabled = false;
    c.fillStyle = C.roof;
    c.fillRect(0, 0, d.width, d.height);
    var w = this.vw * s, h = this.vh * s;
    /* the shake is applied HERE, in whole source pixels, so it never
       lands the scene on a half pixel */
    var sx = 0, sy = 0;
    if (this.shake > 0) {
      sx = Math.round((Math.random() - 0.5) * this.shake) * s;
      sy = Math.round((Math.random() - 0.5) * this.shake) * s;
    }
    c.drawImage(this.buf, ((d.width - w) / 2 | 0) + sx, ((d.height - h) / 2 | 0) + sy,
                w, h);
  };

  /* decay the two things that are time-based and not part of the sim */
  Pitch.prototype.setCrowd = function (home, away) {
    this.crowdHome = home || null;
    this.crowdAway = away || null;
  };
  /* somebody scored: send it round the ground */
  Pitch.prototype.startWave = function () { this.wave = 0; };
  Pitch.prototype.setMood = function (v) { this.mood = clampN(v, -1, 1); };
  function clampN(v, a, b) { return v < a ? a : (v > b ? b : v); }

  Pitch.prototype.tick = function (dt) {
    if (this.flash > 0) this.flash = Math.max(0, this.flash - dt * 2.6);
    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 14);
    if (this.wave >= 0) {
      this.wave += dt * 0.55;
      if (this.wave > 2.6) this.wave = -1;      // two and a half laps
    }
    /* the mood fades back to an ordinary Saturday over about ten
       seconds, which is roughly how long a crowd stays on its feet */
    if (this.mood !== 0) {
      var k = dt * 0.10;
      this.mood += this.mood > 0 ? -Math.min(k, this.mood)
                                 : Math.min(k, -this.mood);
    }
  };

  /* HOW FAR OUT OF HIS SEAT A GIVEN COLUMN IS.

     A wave is not everybody jumping at once, it is a NARROW FRONT
     travelling sideways: a column is up only while the front is passing
     it, and it goes up faster than it comes down. Everything else in
     the stand is the idle sway, which never stops. */
  Pitch.prototype.standLift = function (colFrac, row) {
    /* A JUBILANT CROWD BOUNCES AND A SICK ONE SITS DOWN. The idle sway
       is the same sine either way; what changes is how much of it there
       is, and at a goal against them it very nearly stops — which reads,
       from the far end of a pitch, exactly as a stand going quiet. */
    var amp = 0.9 * (1 + this.mood * (this.mood > 0 ? 1.6 : 0.85));
    var idle = Math.sin(this.t * (2.1 + this.mood * 1.1) + colFrac * 9 + row) * amp;
    if (this.wave < 0) return idle;
    var front = (this.wave % 1);
    var d = colFrac - front;
    if (d < -0.5) d += 1; else if (d > 0.5) d -= 1;
    var up = Math.max(0, 1 - Math.abs(d) / 0.16);
    return idle - up * up * 7;
  };

  /* the seat colour, once allegiance is taken into account */
  Pitch.prototype.seatCol = function (id, colFrac) {
    var base = CROWD[(this.rnd(id + 11) * CROWD.length) | 0];
    if (!this.crowdHome && !this.crowdAway) return base;
    /* eight blocks across the end, each leaning one way or the other */
    var blk = Math.floor(colFrac * 8);
    var lean = this.rnd(blk * 313 + 7);
    var side = lean < 0.42 ? this.crowdHome : (lean < 0.84 ? this.crowdAway : null);
    if (!side) return base;
    /* NOT EVERYBODY IN A BLOCK WEARS THE SHIRT, and a shirt seen from
       the far end of a pitch under floodlights is a long way off its
       box-fresh colour.

       The first pass tinted three in five seats by nearly two-thirds
       toward a full-strength kit colour, and the far end came out as
       confetti — which is precisely the failure the crowd palette was
       written to avoid in the first place, reintroduced by the thing
       that was supposed to give the ground an allegiance. Barely half
       the block wears it, and what they wear is dark. */
    if (this.rnd(id + 53) < 0.55) return base;
    return mix(base, mix(side, "#2a2430", 0.42), 0.55);
  };

  return {
    create: function (display, world) { return new Pitch(display, world); },
    venue: venue, mix: mix,
    BASE_W: BASE_W, BASE_H: BASE_H, COLOURS: C, CROWD: CROWD,
  };
})();
