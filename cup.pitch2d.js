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

  /* =======================================================================
     HOW FAR THE GROUND GOES PAST THE PAINT

     A wall has to stand ON something, and for a long time these two
     numbers lived inside drawSides while the grass ran to the edge of
     the screen — so the field had no boundary and the walls stood on
     nothing. They are up here now because the grass and the walls have
     to agree about them to the pixel: if the ground stops short the
     stand floats, and if it runs long the stand is drawn standing in
     the middle of a lawn.

     The two ends get more room than the two sides, because they do in
     a real ground: behind a goal there is a keeper's warm-up area and
     a camera position, and beside a touchline there is a bench and not
     much else. That asymmetry is also why one number would not do.
     ======================================================================= */
  var EDGE_END = 7;          // renderer units of ground beyond a goal line
  var EDGE_SIDE = 4;         // ... and beyond a touchline
  var RUN_SHARE = 0.72;      // of which this much is turf, and the rest apron
  var SHADE_SHARE = 0.55;    // of the apron, the part the wall keeps in shade

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
    grassA: "#3f8a44", grassB: "#57ad5a", grassLit: "#6ac06d",
    grassDk: "#35743a", line: "#eaf4e4", lineDk: "#b8cfb2",
    net: "#dfe4d8", post: "#f4f4e8", postDk: "#c8ccc0",
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
    /* =====================================================================
       THE LIGHT OF THE GROUND

       "lighting" is the readable name the config uses and it decides
       two things: whether the ground is floodlit, and what colour the
       sky over it is. Sunset is not a venue, it is a TIME — it belongs
       to the final rather than to any one team's ground, which is why
       it overrides the sky rather than living in the VENUES table.
       ===================================================================== */
    if (v.lighting === "sunset") {
      v = Object.keys(v).reduce(function (o, k) { o[k] = v[k]; return o; }, {});
      v.sky = "#6b4a7a"; v.horizon = "#f4a86b"; v.sun = "#e8746a";
      v.floodlit = false;
    }
    var night = !!v.floodlit;
    var g0 = v.grass || "#4a8a44";
    /* lift the base a little: a floodlit pitch on television is a much
       more saturated green than a photograph of grass */
    /* THE LIFT USED TO BE APPLIED TWICE — once toward a yellow-green
       and again toward white — so a venue asking for a particular green
       got something noticeably paler and flatter than it wrote down,
       and the mown bands came out close enough together to read as one
       colour. Now the config's two greens are very nearly what lands on
       the screen, which is the only way a per-ground palette is worth
       having: what you type is what you see. */
    var g = mix(g0, "#8fd86a", 0.10);
    var st = v.stripe || mix(g, "#000000", 0.20);
    C.grassB = mix(g, "#ffffff", 0.05);
    C.grassA = st;
    C.grassLit = mix(g, "#ffffff", 0.30);
    C.grassDk = mix(st, "#000000", night ? 0.18 : 0.14);
    C.line = night ? "#f4f8f4" : "#eaf4e4";
    C.lineDk = mix(C.line, st, 0.4);
    var sd = v.stand || "#5b6570";
    /* =====================================================================
       WHAT IS AROUND THE FIELD

       A pitch is not green all the way to the wall. Outside the paint
       there is a strip of unmown grass, and outside that a hard apron
       the photographers and the substitutes stand on — and those two
       bands are the entire reason a real ground reads as a FIELD
       sitting inside a bowl rather than as a green rectangle with a
       stand behind it.

       Without them the grass simply runs to the hoarding, which is
       what it did: the mowing was drawn as a full-width band on every
       row, so the field had no edges anywhere and behind the goal it
       never ended at all.

       The run-off is the same turf with no stripe in it. The apron is
       taken from the stand's own concrete so it belongs to the ground
       it is in. */
    /* THE RUN-OFF IS TURF AND HAS TO LOOK LIKE TURF, just turf nobody
       mows in a pattern and nobody walks on: darker, and pulled towards
       the stripe's own colour so it belongs to this ground's grass
       rather than to a palette. It was barely a shade off the pitch the
       first time, which is the same as not drawing it. */
    C.runoff = mix(mix(g, "#0a1408", night ? 0.34 : 0.26), st, 0.30);
    /* THE APRON IS NOT GREEN. That is the whole job it does. The eye
       reads the field's edge off the moment the ground stops being
       grass, so an apron tinted green is an apron that does nothing.
       It takes a little of the stand's colour, so each ground's
       surround still belongs to it, and is then dragged most of the way
       to concrete. */
    C.apron = mix(mix(sd, "#6d6a66", 0.62), "#000000", night ? 0.40 : 0.24);
    C.apronLip = mix(C.apron, "#ffffff", night ? 0.16 : 0.24);
    /* and the dark under the hoardings, which is what the wall stands in */
    C.beyond = mix(sd, "#000000", night ? 0.76 : 0.66);
    /* the stand's shade, thrown out across the apron and the run-off:
       one band of it is worth more for depth than anything else drawn
       out here, because a shadow is the only thing in the picture that
       proves the wall has a height */
    C.edgeShade = mix(C.apron, "#000000", 0.38);
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
    /* WHAT THIS PARTICULAR GROUND DOES DIFFERENTLY.

       A venue is a campus and a stadium is a club's ground on it, so
       the team's own block is merged over the venue before it gets
       here — see groundFor() in cup.js. Everything below is a property
       of the GROUND rather than of the renderer, which is the whole
       point: a new ground is a few lines of config, not a code path. */
    GROUND.mow = v.mow || "along";
    GROUND.mowWidth = v.mowWidth || 1;
    GROUND.density = v.density === undefined ? 0.88 : v.density;
    GROUND.backdrop = v.backdrop || null;
    GROUND.night = night;
    bakeGrass();
    bakeBoards();
  }

  /* the ground's own settings, read by the drawing rather than passed
     down through six arguments */
  var GROUND = { mow: "along", mowWidth: 1, density: 0.88,
                 backdrop: null, night: false };

  /* =======================================================================
     THE BOARDS, BAKED ONCE AND WRAPPED ROUND THE CORNER

     The hoardings along the far touchline carry the words; the ones
     behind the goals carried only colour, because that wall is drawn a
     screen column at a time in perspective and you cannot letter a
     column. So the ground had writing down one side and blank boards
     at both ends, which is the one place a stadium never is blank —
     the boards behind a goal are the ones on camera every time anybody
     shoots.

     Baking the whole run into a strip solves it. Each board is drawn
     once, flat, with its word on it; the wall then samples the strip by
     WORLD POSITION along itself, one pixel-column at a time, and the
     perspective falls out for free — the boards compress toward the
     corner exactly as the wall does, and the lettering compresses with
     them, which is what lettering on a board seen at an angle does.
     ======================================================================= */
  var BSTRIP = null;                    // the baked run of boards
  var BSTRIP_H = 12;                    // its height, in strip pixels
  var BSTRIP_BW = 76;                   // one board, in strip pixels
  var BSTRIP_WORLD = 34;                // and what that board is, in world

  function bakeBoards() {
    var n = HOARDING.length;
    var c = document.createElement("canvas");
    c.width = n * BSTRIP_BW; c.height = BSTRIP_H;
    var x = c.getContext("2d");
    x.imageSmoothingEnabled = false;
    for (var i = 0; i < n; i++) {
      var bx = i * BSTRIP_BW;
      /* the same three faces the touchline boards use, in a fixed order
         so a ground looks the same every time it is drawn */
      var face = (i % 3 === 0) ? "#a8283a" : (i % 3 === 1 ? "#c8912f" : "#2f4f7a");
      x.fillStyle = C.board;
      x.fillRect(bx, 0, BSTRIP_BW, BSTRIP_H);
      x.fillStyle = face;
      x.fillRect(bx + 1, 1, BSTRIP_BW - 3, BSTRIP_H - 2);
      x.fillStyle = C.boardLip;
      x.fillRect(bx + 1, 0, BSTRIP_BW - 3, 1);
      var word = HOARDING[i];
      var tw = textWidth(word);
      if (tw <= BSTRIP_BW - 7) {
        var tx = Math.round(bx + 1 + (BSTRIP_BW - 3 - tw) / 2);
        var ty = Math.round((BSTRIP_H - GLYPH_H) / 2);
        drawText(x, word, tx, ty + 1, mix(face, "#000000", 0.55));
        drawText(x, word, tx, ty, "#f2f6f4");
      }
    }
    BSTRIP = c;
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
    /* how far the frame is slid up the lens — see reframe(). Set here
       so a projection asked for before the first zoomTo is a number
       rather than a NaN that quietly poisons every row on the screen. */
    this.oy = 0;
    /* the buffer the camera was tuned against; setViewport replaces it
       with one that fits the screen the moment there is a screen */
    this.baseW = BASE_W; this.baseH = BASE_H;
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
    this.energy = 0.25;
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
    this.B = FOCAL * h;
    this.reframe();
  };

  Pitch.prototype.setSwap = function (on) {
    this.swap = !!on;
    var half = on ? this.raw.len / 2 : this.raw.halfW;
    this.k = DEFAULT.halfW / half;
  };

  /* =======================================================================
     A FRAME THE SIZE OF THE SCREEN IT IS ON

     present() blits the buffer at a WHOLE-NUMBER scale, because a pixel
     that is 1.44 screen pixels wide is two pixels here and one there
     and the whole picture crawls. That part is right and stays.

     What was wrong is that the buffer was always 480x270, so the whole
     number it could be blitted at was whatever happened to fit — and
     the rest of the frame was filled in with the roof colour. At
     960x540 that is exactly two and there is nothing left over, which
     is the size every harness in tools/ runs at, which is why a hundred
     green assertions never once mentioned it. Everywhere else:

       1280x720 laptop        44% of the frame dead
       1440x900 laptop        44% dead
       phone, landscape       52% dead
       phone, upright         cropped by 90x51

     So the buffer is chosen FROM the screen instead. Pick the whole
     number scale whose resulting frame is nearest the 270 rows the
     camera was tuned against, then take as many rows and columns as fit
     at that scale. A bigger window gets more of the stadium rather than
     the same picture with a border; a smaller one gets fewer, larger
     pixels, which is what a small screen wants anyway.

     The dimensions come out as multiples of six because the zoom levels
     are whole divisors — 2 and 3 — and a buffer that does not divide by
     both of them cleanly would reintroduce the same border every time
     the camera cut in.
     ======================================================================= */
  var REF_H = BASE_H;        // the frame height the camera was tuned against

  Pitch.prototype.setViewport = function (dw, dh) {
    dw = Math.max(64, dw | 0); dh = Math.max(36, dh | 0);
    var best = 1, err = 1e9;
    for (var s = 1; s <= 8; s++) {
      /* nearest in RATIO, not in pixels: half the rows is as far from
         the reference as twice the rows, and a difference measured in
         pixels would not agree */
      var e = Math.abs(Math.log((dh / s) / REF_H));
      if (e < err) { err = e; best = s; }
    }
    var bw = Math.max(120, 6 * Math.floor(dw / best / 6));
    var bh = Math.max(72, 6 * Math.floor(dh / best / 6));
    if (bw === this.baseW && bh === this.baseH) return;
    this.baseW = bw; this.baseH = bh;
    var was = this.zoom || 1;
    this.zoom = 0;                      // make zoomTo rebuild the buffer
    this.zoomTo(was);
  };

  Pitch.prototype.zoomTo = function (level) {
    /* 1 is the match, 2 is a cut-in, 3 is a portrait. Whole divisors
       only: 480/2 and 480/3 are both whole numbers of pixels and the
       blit back up is a whole number too, which is the entire reason
       this is how the camera pushes in. */
    level = Math.max(1, Math.min(3, Math.round(level || 1)));
    if (level === this.zoom && this.ctx) return;
    this.zoom = level;
    this.vw = Math.round((this.baseW || BASE_W) / level);
    this.vh = Math.round((this.baseH || BASE_H) / level);
    this.buf.width = this.vw; this.buf.height = this.vh;
    this.ctx = this.buf.getContext("2d");
    this.ctx.imageSmoothingEnabled = false;
    this.A = A0;
    this.B = FOCAL * (this.height || HEIGHT);
    this.reframe();
  };

  /* =======================================================================
     A ZOOM THAT ZOOMS BOTH WAYS

     Zooming in halves the buffer and lets present() blit it at twice the
     scale, which is the whole reason the levels are whole divisors. The
     horizontal half of that works: the frame gets narrower, the world
     per pixel stays the same, so twice the magnification.

     The vertical half did not. A and B — the horizon row and the
     ground-plane constant — were multiplied by the frame's own height,
     so halving the frame also halved the vertical scale. The two
     cancelled exactly: measured, forty world units across the pitch
     came to 90 virtual pixels at every zoom level, while forty units of
     DEPTH came to 11.2, then 5.6, then 3.7. Blitted up, that is the
     same number of screen pixels at all three — the ground plane never
     zoomed at all.

     The characters did, because a sprite is drawn at a size that comes
     off the depth ratio and not off A or B. So a cut-in to a goal
     celebration doubled the players and left the goal they had just
     scored in exactly the size it was: at zoom 2 the keeper stood
     nearly as tall as his own crossbar, and at zoom 1 he came up to
     half of it.

     So A and B are constants now, as a lens is, and what the zoom
     changes is how much of the picture the frame can hold. Which then
     needs somewhere to hold it — see reframe.
     ======================================================================= */
  /* WHERE THE FRAME SITS ON A LENS THAT NO LONGER MOVES.

     With A and B fixed, the ground plane lands on the same rows
     whatever size the frame is, so a frame shorter than the reference
     one would simply cut the bottom off the picture. This slides the
     frame instead, keeping the point the camera is watching at the same
     FRACTION of the frame it occupies at the reference size — so a
     shorter frame crops evenly around the play instead of from one end,
     and a taller one shows more of the stadium above it and more grass
     below.

     A ZOOM MAGNIFIES ABOUT SOMETHING, and the something is whatever the
     camera is watching. The first version of this used a fixed row
     three quarters of the way down instead, on the reasoning that a
     reference tied to the ball would make the picture drift every time
     the ball moved toward or away from the camera. It does not drift —
     because at the reference frame size the offset is zero whatever the
     reference row is, and at any other size the subject is held at the
     same FRACTION of the frame it already had, which is the definition
     of not moving.

     What the fixed row did instead was frame the wrong thing: a
     celebration cut put the players in the top quarter of the shot with
     an empty two thirds of grass underneath them, because the scorer
     was nowhere near three quarters down.

     So the offset is the subject's own row times how much the frame has
     shrunk. At the reference size it is zero, which is what keeps the
     match camera exactly as it was tuned. */
  Pitch.prototype.reframe = function () {
    var yRef = this.focusD
      ? this.A + this.B / this.focusD
      : 0.78 * BASE_H;                  // before anything has been watched
    this.oy = yRef * (1 - this.vh / REF_H);
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
      y: this.A + this.B / d - this.oy,
      d: d,
      k: FOCAL / d * k,          // screen pixels per WORLD unit, across
      ky: this.B / (d * d) * k,  // screen pixels per WORLD unit, in depth
    };
  };
  /* =======================================================================
     THE ONE ROW THE STAND AND THE GRASS HAVE TO AGREE ON

     The far stand is drawn standing on the back edge of the ground and
     the grass is drawn down from it, so they are the same row twice.
     Computed twice, they disagreed: the stand put its foot seven units
     past the far line and the grass stopped at four, because side-on
     the far line is a TOUCHLINE and the seven belongs to a goal end.
     Two rows in between then belonged to nobody — and nothing clears
     this canvas, so what showed there was the PREVIOUS FRAME'S grass,
     scrolling against the current one. It reads exactly like the game
     is dropping frames, and it is really a two-pixel hole.

     One function, called from both, and the hole cannot come back.
     ======================================================================= */
  Pitch.prototype.groundTop = function () {
    var edge = (this.swap ? EDGE_SIDE : EDGE_END) / this.k;
    var q = this.swap ? this.project(this.raw.halfW + edge, 0)
                      : this.project(0, this.raw.len + edge);
    return Math.min(this.vh - 1, Math.max(0, Math.round(q.y)));
  };

  /* the inverse of project's row, offset and all */
  Pitch.prototype.depthAtY = function (sy) {
    return this.B / (sy + this.oy - this.A);
  };

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
    }, o.wx);
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
    var base = this.groundTop();
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
    /* =====================================================================
       A CROWD, RATHER THAN A TEXTURE

       The first one was a perfectly even lattice of identical three-by-
       two blocks, all the same distance apart, on a flat fill. At this
       size that is not a stand full of people; it is wallpaper, and the
       eye reads it as noise and stops looking.

       Four things fix it, and none of them is more pixels:

         THE ROOF SHADOW. A stand is not evenly lit. The back rows sit
         under the overhang and go nearly black; the front rows catch
         the floodlights. A ramp instead of a flat fill is the single
         biggest change here, because it gives the stand a top and a
         bottom.

         GANGWAYS. Every stand has stairs up through it. The vertical
         breaks are most of what says "a structure with people in it"
         rather than "a repeating pattern", and they cost one skipped
         column each.

         ROW SPACING THAT GOES THE RIGHT WAY. It widened toward the
         back, which is backwards: the back rows are further away, so
         they should be TIGHTER and their people smaller. Getting that
         inverted flattened the whole stand.

         A HEAD. Two pixels of body read as a dash. One lighter pixel
         above it reads as a person, and at three pixels a row that is
         the entire difference.
       ===================================================================== */
    /* THREE TIERS, NOT TWO. Two reads as a bank; three reads as a
       stand, because the third one is small and dark and sits up under
       the roof where the eye expects the ground to keep going. */
    var tiers = [{ h: 26, rows: 7, base: C.tierLit },
                 { h: 20, rows: 5, base: C.tier },
                 { h: 13, rows: 4, base: mix(C.tier, "#000000", 0.22) }];
    var y = lip, band = 0;
    for (var ti = 0; ti < tiers.length; ti++) {
      var T = tiers[ti];
      var top = y - T.h;

      /* the light falling down the tier, back to front */
      for (var sy2 = 0; sy2 < T.h; sy2++) {
        var f = sy2 / Math.max(1, T.h - 1);
        ctx.fillStyle = mix(mix(T.base, "#090810", 0.66), T.base, f * f);
        var ry2 = top + sy2;
        if (ry2 >= 0 && ry2 < this.vh) ctx.fillRect(0, ry2, this.vw, 1);
      }

      /* WHERE THE STAIRS ARE. Spaced rather than scattered — a stand
         with its gangways bunched at one end is a stand nobody could
         get out of — with enough jitter that they are not a comb. */
      var bays = 9, bayW = this.vw / bays, aisle = [];
      for (var ai = 1; ai < bays; ai++) {
        aisle.push(ai * bayW + (this.rnd(band * 71 + ai * 29) - 0.5) * bayW * 0.35);
      }

      var step = T.h / T.rows;
      for (var r = 0; r < T.rows; r++) {
        var ry = Math.round(top + r * step);
        if (ry < -4 || ry > this.vh) continue;
        /* front rows are nearer, so they are further apart on screen */
        var pitchX = 5.2 + r * 0.42;
        /* and the back of a tier is emptier as well as darker: the seats
           nobody wants, plus the ones the overhang eats */
        /* the ground's own fullness, plus the back rows being emptier
           as well as darker: the seats nobody wants, and the ones the
           overhang eats */
        var gone = (1 - GROUND.density) + (1 - r / Math.max(1, T.rows - 1)) * 0.10;
        for (var cxx = -2; cxx < this.vw / pitchX + 2; cxx++) {
          var id = band * 977 + r * 131 + cxx * 7;
          if (this.rnd(id) < gone) continue;              // an empty seat
          var sxp = Math.round(cxx * pitchX + this.rnd(id + 3) * 2.4);
          /* nobody sits on the stairs */
          var onStair = false;
          for (var q2 = 0; q2 < aisle.length; q2++) {
            if (Math.abs(sxp - aisle[q2]) < 2.2) { onStair = true; break; }
          }
          if (onStair) continue;
          /* the sway is VERTICAL, and always was meant to be: a crowd
             seen from the far end of a pitch bobs, it does not shuffle
             sideways, and drawing the idle motion in x made the whole
             stand shimmer left and right like a bad tracking shot. The
             wave rides on the same number. */
          var cf = Math.max(0, Math.min(0.999, sxp / this.vw));
          var lift = Math.round(this.standLift(cf, r));
          var col = this.seatCol(id, cf);
          /* A ROUSED STAND IS A BRIGHTER STAND — people stand up, and
             standing up is the same thing as catching more of the
             light coming off the roof. */
          var eLift = (this.energy === undefined ? 0.25 : this.energy);
          if (eLift > 0.3) col = mix(col, "#ffe8c0", (eLift - 0.3) * 0.22);
          /* the further back, the deeper in shadow — the same ramp the
             tier behind them is drawn with, so they sit IN it */
          var shade = 0.42 * (1 - r / Math.max(1, T.rows - 1));
          col = mix(col, "#0b0a12", shade);
          var yy = ry + lift;
          /* =============================================================
             FIVE PEOPLE, NOT ONE PERSON FIVE THOUSAND TIMES

             Every figure was the same three-by-two block with the same
             one-pixel head, and a crowd of identical shapes is a
             pattern however many colours you give it — the eye locks
             onto the repeat and the whole stand goes flat again.

             Five silhouettes is enough to break that, and they are
             chosen off the same seeded number as the colour so a given
             seat is always the same person: a plain one, a broad one, a
             thin one, one with an arm up, and one holding a scarf over
             their head. The last two are the ones that read from
             distance, because a raised arm breaks the top line of the
             row and that is the only part of a crowd you actually see.
             ============================================================= */
          /* WEIGHTED, not one in five each. An arm up and a scarf held
             overhead are the two that read from distance, which is
             exactly why they have to be rare: at a fifth of the crowd
             apiece the stand turned into a field of bright dashes and
             the very thing that was supposed to catch the eye became
             the texture. Roughly one in twelve puts an arm up and one
             in sixteen has a scarf, which is about what a stand looks
             like when nothing has happened yet. */
          var kr = this.rnd(id + 77);
          var kind = kr < 0.42 ? 0 : kr < 0.66 ? 1 : kr < 0.86 ? 2
                   : kr < 0.94 ? 3 : 4;
          var skin = mix(col, "#f2d9c0", 0.34);
          var bw2 = kind === 1 ? 4 : (kind === 2 ? 2 : 3);
          if (kind === 3) {                       // an arm up
            ctx.fillStyle = col;
            ctx.fillRect(sxp + 2, yy - 3, 1, 2);
          } else if (kind === 4) {                // a scarf held overhead
            ctx.fillStyle = mix(col, "#ffffff", 0.30);
            ctx.fillRect(sxp - 1, yy - 3, 5, 1);
            ctx.fillStyle = col;
            ctx.fillRect(sxp, yy - 2, 1, 1);
            ctx.fillRect(sxp + 2, yy - 2, 1, 1);
          }
          ctx.fillStyle = skin;
          ctx.fillRect(sxp + (bw2 > 2 ? 1 : 0), yy - 1, 1, 1);
          ctx.fillStyle = col;
          ctx.fillRect(sxp, yy, bw2, 2);
          ctx.fillStyle = "#141018";
          ctx.fillRect(sxp, yy + 2, bw2, 1);
        }
      }
      /* the stairs themselves, once the people are down, so a gangway
         is a lit strip up the stand rather than a hole in it */
      for (var q3 = 0; q3 < aisle.length; q3++) {
        var axp = Math.round(aisle[q3]);
        for (var sy3 = 0; sy3 < T.h; sy3 += 2) {
          var ay3 = top + sy3;
          if (ay3 < 0 || ay3 >= this.vh) continue;
          ctx.fillStyle = mix(T.base, "#ffffff", 0.16 * (sy3 / T.h));
          ctx.fillRect(axp, ay3, 2, 1);
        }
      }
      /* THE RAILING AT THE FRONT OF THE TIER, which is the line that
         says a tier is a floor with an edge rather than a change of
         colour */
      ctx.fillStyle = C.rail;  ctx.fillRect(0, Math.max(0, y - 2), this.vw, 1);
      ctx.fillStyle = C.roof;  ctx.fillRect(0, Math.max(0, y - 1), this.vw, 1);

      /* AND THE BANNERS TIED TO IT.

         A few per tier, in the two clubs' colours, hung over the front
         rail the way flags actually are. They are the only wide flat
         shapes in a stand made of three-pixel people, which is exactly
         why they read from any distance and why a ground without them
         looks like a texture rather than somewhere people brought
         something. */
      var nB = 4;
      for (var fb = 0; fb < nB; fb++) {
        var seed = band * 211 + fb * 53;
        if (this.rnd(seed) < 0.35) continue;
        var fx = Math.round(this.rnd(seed + 1) * this.vw);
        var fw2 = 9 + Math.round(this.rnd(seed + 2) * 12);
        var fh2 = 3 + Math.round(this.rnd(seed + 3) * 2);
        var fcol = this.rnd(seed + 4) < 0.5
          ? (this.crowdHome || "#c8912f") : (this.crowdAway || "#2f4f7a");
        var fy2 = Math.max(0, y - 2 - fh2);
        ctx.fillStyle = mix(fcol, "#000000", 0.35);
        ctx.fillRect(fx, fy2, fw2, fh2);
        ctx.fillStyle = fcol;
        ctx.fillRect(fx, fy2, fw2, fh2 - 1);
        /* a light stripe across it, which is what a banner has on it */
        ctx.fillStyle = mix(fcol, "#ffffff", 0.55);
        ctx.fillRect(fx + 1, fy2 + Math.floor(fh2 / 2) - 1, fw2 - 2, 1);
      }
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

    /* =====================================================================
       THE LAMPS ALONG THE ROOF

       The corner towers are anchored to the ground's corners now, which
       is right, and it means that from a camera on the halfway line
       they are both a hundred units outside the frame — so the sky over
       the stand went completely empty. A ground of this size does not
       light itself from four masts anyway; it lights itself from a run
       of lamps under the roof, and those are the things you actually
       see glowing at a night match.

       Each one throws a short cone down onto the front of the stand,
       which is also what puts the light ON the crowd instead of just
       near it. */
    var LAMP_EVERY = 58;
    var lampOff = Math.round(this.rnd(9) * LAMP_EVERY);
    for (var lx = -lampOff; lx < this.vw; lx += LAMP_EVERY) {
      var cxl = Math.round(lx + LAMP_EVERY / 2);
      if (cxl < -8 || cxl > this.vw + 8) continue;
      var ly2 = Math.max(0, roofY - 1);
      /* the housing */
      ctx.fillStyle = mix(C.roof, "#ffffff", 0.34);
      ctx.fillRect(cxl - 5, ly2 - 3, 10, 3);
      /* the bulbs, a couple of which are always a shade off */
      for (var bl = 0; bl < 4; bl++) {
        var fl2 = this.rnd(bl * 23 + (cxl | 0)) * 6 + this.t * 1.7;
        ctx.fillStyle = Math.sin(fl2) > -0.9 ? "#fff8e0" : "#c0b490";
        ctx.fillRect(cxl - 4 + bl * 2, ly2 - 2, 1, 1);
      }
      /* and the spill down the face of the stand */
      ctx.fillStyle = "#fff6d8";
      for (var gl2 = 0; gl2 < 4; gl2++) {
        var gw2 = 12 + gl2 * gl2 * 4;
        ctx.globalAlpha = 0.07 / (1 + gl2 * 1.1);
        ctx.fillRect(Math.round(cxl - gw2 / 2), ly2 + gl2 * 3, Math.round(gw2), 3);
      }
      ctx.globalAlpha = 1;
    }

    this.drawBackdrop(roofY);
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
    var anchor = this.swap
      ? this.project(this.raw.halfW + EDGE_SIDE / this.k, this.raw.len * 0.30)
      : this.project(-this.raw.halfW * 0.62, this.raw.len + EDGE_END / this.k);
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
  /* =======================================================================
     WHAT IS BEHIND THE STAND

     A ground with nothing over its roofline is a ground that could be
     anywhere, and "could be anywhere" is the one thing a home stadium
     must not be. A silhouette costs almost nothing — it is a run of
     dark rectangles against the sky — and it is the single cheapest way
     to make two grounds feel like two places.

     It is drawn BEHIND the roof, dark, with no detail in it, because a
     skyline seen over a floodlit stand at night is a shape and nothing
     else. Anything more would compete with the match.
     ======================================================================= */
  Pitch.prototype.drawBackdrop = function (roofY) {
    var kind = GROUND.backdrop;
    if (!kind || roofY < 14) return;
    var ctx = this.ctx;
    /* HOW MUCH SKY THERE IS TO STAND IN.

       Written against a fixed set of heights, the tallest blocks came
       to thirty-six rows in a sky that is thirty-one — so every
       building ran off the top of the frame and the skyline became a
       solid dark band with no silhouette in it at all. A silhouette
       needs sky ABOVE it or it is just a wall, so the whole run is
       scaled to leave the top third of the sky empty. */
    var room = roofY * 0.66;
    var sky = C.sky;
    /* A SILHOUETTE HAS TO BE THE LIGHTER SHAPE HERE.

       Drawn darker than the sky, which is what a skyline is in
       daylight, it vanished: the frame's edges are dimmed hard by the
       vignette, so the sky at the top of the picture is already down at
       a twentieth of its own brightness and there is nothing left below
       it to be darker THAN. A city seen from a ground at dusk or under
       lights is the lit thing anyway — haze, windows, streetlight
       bouncing off it — so it goes lighter and reads immediately. */
    var near = mix(sky, "#ffe8c0", 0.20);
    var far = mix(sky, "#ffe8c0", 0.10);
    /* the skyline PARALLAXES: it is miles away, so it moves a fraction
       of what the camera does rather than not at all, which is what
       stops it reading as a sticker on the glass */
    var pan = ((this.swap ? this.cam.y : this.cam.x) * 0.06) | 0;

    var topOf = function (i, seed, base, vary) {
      return roofY - base - Math.round(vary * (0.35 + seed));
    };
    var put = function (x, w2, h2, col) {
      var yTop = Math.max(0, roofY - h2);
      if (yTop >= roofY) return;
      ctx.fillStyle = col;
      ctx.fillRect(x, yTop, w2, roofY - yTop);
    };

    if (kind === "hills") {
      /* two ridges, the far one paler, drawn as a run of steps */
      for (var pass = 0; pass < 2; pass++) {
        var col = pass ? near : far;
        var amp = (pass ? 13 : 9) * room / 22, base = (pass ? 4 : 9) * room / 22;
        for (var hx = -8; hx < this.vw + 8; hx += 4) {
          var u = (hx + pan * (pass ? 1 : 0.6)) * 0.021 + pass * 3.1;
          var hh = base + Math.round((Math.sin(u) * 0.6 + Math.sin(u * 2.3) * 0.4 + 1) * amp * 0.5);
          put(hx, 4, hh, col);
        }
      }
      return;
    }

    /* the built skylines: a run of blocks of varying height, with a
       landmark or two standing above them */
    var spec = {
      marrakech: { w: [7, 11, 5], h: [7, 22], towerEvery: 5, towerH: 30, minaret: true },
      oldtown:   { w: [9, 6, 13], h: [5, 15], towerEvery: 7, towerH: 22, minaret: true },
      coast:     { w: [6, 9, 7], h: [8, 26], towerEvery: 4, towerH: 34, minaret: false },
      campus:    { w: [13, 9, 17], h: [6, 18], towerEvery: 6, towerH: 24, minaret: false },
    }[kind] || { w: [9, 7, 12], h: [6, 18], towerEvery: 6, towerH: 24, minaret: false };

    var hs = room / 30;                   // the spec is written for 30 rows
    var i = 0, x = -((pan % 40) + 40);
    while (x < this.vw + 8) {
      var sd = this.rnd(i * 47 + 3);
      var bw2 = spec.w[i % spec.w.length];
      var bh2 = Math.round((spec.h[0] + sd * (spec.h[1] - spec.h[0])) * hs);
      var isTower = (i % spec.towerEvery) === 2;
      if (isTower) bh2 = Math.round((spec.towerH + sd * 6) * hs);
      bh2 = Math.max(2, bh2);
      put(x, bw2, bh2, i % 2 ? near : mix(near, far, 0.45));
      /* a lit window or two, which is the only detail it gets */
      if (GROUND.night && bh2 > 10 && sd > 0.4) {
        ctx.fillStyle = "#e8c87a";
        var wy2 = roofY - bh2 + 3 + ((this.rnd(i * 13) * (bh2 - 6)) | 0);
        ctx.globalAlpha = 0.7;
        ctx.fillRect(x + 1 + ((bw2 - 2) >> 1), wy2, 1, 1);
        ctx.globalAlpha = 1;
      }
      /* and a minaret's cap, where the ground has one */
      if (isTower && spec.minaret) {
        ctx.fillStyle = near;
        ctx.fillRect(x + ((bw2 - 3) >> 1), Math.max(0, roofY - bh2 - 4), 3, 4);
        ctx.fillRect(x + ((bw2 - 1) >> 1), Math.max(0, roofY - bh2 - 6), 1, 2);
      }
      x += bw2 + 2; i++;
    }
  };

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
    /* =====================================================================
       THE TOWERS STAND ON THE GROUND, NOT ON THE FRAME

       These were placed at eleven and eighty-nine per cent of the
       screen's width, which means they never moved: pan the camera the
       length of the pitch and the floodlights slid along the sky with
       it, always the same distance in from the edges. A thing in the
       distance that keeps pace with the camera is the one cue that
       instantly says "painted backdrop", and it was undoing the work
       the rest of the stadium was doing.

       They belong at the ground's own four corners. Projected, the two
       behind the far side come out where they should, they separate as
       the camera nears them and close up as it pans away, and the ones
       behind the camera are simply off the frame — which is also what a
       corner floodlight does.
       ======================================================================= */
    var w = this.raw;
    var corners = this.swap
      ? [[w.halfW + 10 / this.k, -10 / this.k],
         [w.halfW + 10 / this.k, w.len + 10 / this.k]]
      : [[-(w.halfW + 10 / this.k), w.len + 10 / this.k],
         [w.halfW + 10 / this.k, w.len + 10 / this.k]];
    for (var ci = 0; ci < corners.length; ci++) {
      var cp = this.project(corners[ci][0], corners[ci][1]);
      if (!cp.flat && cp.d <= NEAR + 1) continue;
      if (cp.x < -60 || cp.x > this.vw + 60) continue;
      mast(cp.x);
    }
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
  /* =========================================================================
     THE GROUND, AND WHERE IT STOPS

     This drew the mowing as a full-width band on every screen row —
     fillRect(0, y, vw, 1) — which means the pitch had no edges at all.
     The touchlines and goal lines were paint on an infinite green
     plane, and behind the goal the field simply never ended: the grass
     ran straight into the hoarding with nothing between them. That is
     the single reason the goal end looked flat and cheap, and no amount
     of work on the stand behind it was ever going to fix it, because
     the thing that was missing was in front of the stand.

     A real ground is four materials in concentric rings:

         the pitch        mown, striped, with the paint on it
         the run-off      the same turf, unmown, a few metres of it
         the apron        hard standing, where the photographers sit
         the wall         hoardings, and the stand above them

     Drawn as rings, the field becomes a bounded object with a near
     edge, a far edge and two ends — and a bounded object in
     perspective is what reads as three-dimensional. The rings are real
     ground, so they foreshorten and converge by themselves; nothing
     here draws a trapezoid.

     Every row therefore asks two questions: which ring it is in by
     DEPTH, and where the rings fall ALONG it. A row deep in the apron
     is apron all the way across; a row through the middle of the pitch
     is apron, run-off, pitch, run-off, apron.
     ========================================================================= */
  Pitch.prototype.drawGrass = function () {
    var ctx = this.ctx, w = this.raw;
    if (this.mode === "oblique") return this.drawGrassFlat();

    /* THE RINGS, PER AXIS, because the ends and the sides are not the
       same width — see EDGE_END and EDGE_SIDE. Side-on, the depth axis
       is the pitch's WIDTH, so the rings that recede away from the
       camera are the touchlines' and the rings that run across the
       frame are the goal ends'; turned up the pitch it is the other way
       about. Getting this the same for both was the bug that hid the
       whole far surround: the touchline wall stands at four units and
       the apron was drawn out to seven, so the wall was built on top of
       its own apron and the eye saw grass running into a hoarding. */
    var edgeDeep = (this.swap ? EDGE_SIDE : EDGE_END) / this.k;
    var edgeAlong = (this.swap ? EDGE_END : EDGE_SIDE) / this.k;
    var runD = edgeDeep * RUN_SHARE;
    var runA = edgeAlong * RUN_SHARE;

    /* WHICH WORLD AXIS IS WHICH depends on the camera. */
    var depthMin = this.swap ? -w.halfW : 0;
    var depthMax = this.swap ? w.halfW : w.len;
    var alongMin = this.swap ? 0 : -w.halfW;
    var alongMax = this.swap ? w.len : w.halfW;
    var camAlong = this.swap ? this.cam.y : this.cam.x;
    var camDeep = this.swap ? this.cam.x : this.cam.y;
    var depthSpan = depthMax - depthMin;

    var band = 11 / this.k * (GROUND.mowWidth || 1);

    /* the top of the picture is the row the far wall stands on, which
       is the stand's business above and the ground's below. Not that
       row PLUS ONE: the stand paints down to it and the grass from it,
       and a row of daylight between two things that touch is a row
       nothing paints at all. */
    var y0 = this.groundTop();
    var prevOut = 1e9;

    for (var y = y0; y < this.vh; y++) {
      var d = this.depthAtY(y + 0.5);
      if (d <= 0) continue;
      var wy = camDeep + (d - NEAR) / this.k;

      /* HOW FAR OUTSIDE THE FIELD THIS ROW IS, in world units. Negative
         is inside it. One number answers the depth ring. */
      var outD = Math.max(depthMin - wy, wy - depthMax);
      if (outD > edgeDeep) {
        ctx.fillStyle = C.beyond;
        ctx.fillRect(0, y, this.vw, 1);
        prevOut = outD;
        continue;
      }
      /* A WALL THROWS A SHADOW ON WHAT IT STANDS ON, and a band of it
         hugging the hoardings is worth more for depth than anything
         else out here: it is the only thing in the picture that proves
         the wall has a HEIGHT. It has to be a band, though. Shading the
         whole surround, which is what this did first, does not read as
         a stand casting shade — it reads as a hole behind the goal. */
      var shadeD = runD + (edgeDeep - runD) * (1 - SHADE_SHARE);
      var apronCol = outD > shadeD ? C.edgeShade : C.apron;

      var scale = this.k * FOCAL / d;
      /* =================================================================
         DETAIL THAT CANNOT RESOLVE IS NOT DETAIL, IT IS NOISE.

         The far touchline of a side-on view is the whole width of the
         pitch away, so its entire surround lands in three screen rows.
         Asking those three rows for a shadow, an apron, a kerb and a
         strip of run-off does not produce a detailed surround: it
         produces one grey row, one green row and one grey row, and
         because the camera pans a third of a pixel at a time, which
         feature owns which row changes every frame. It flickers, and a
         flickering band under the hoardings reads as the game dropping
         frames — which is exactly what it was reported as.

         So: how many rows would this row's surround get? Below about
         six, it is drawn as one flat band and nothing else. The eye
         loses nothing it could have seen, and gains a steady picture.
         ================================================================= */
      var rowsHere = edgeDeep /
        Math.max(1e-6, Math.abs(this.depthAtY(y + 1.5) - this.depthAtY(y + 0.5)) / this.k);
      var fine = rowsHere >= 6;
      var xAt = function (wa) { return this.vw / 2 + (wa - camAlong) * scale; };
      xAt = xAt.bind(this);
      var aLo = xAt(alongMin - edgeAlong), aHi = xAt(alongMax + edgeAlong);
      var rLo = xAt(alongMin - runA), rHi = xAt(alongMax + runA);
      var pLo = xAt(alongMin), pHi = xAt(alongMax);

      var seg = function (x0, x1, col) {
        var a = Math.max(0, Math.round(x0)), b = Math.min(this.vw, Math.round(x1));
        if (b <= a) return;
        ctx.fillStyle = col;
        ctx.fillRect(a, y, b - a, 1);
      };
      seg = seg.bind(this);

      /* OUTSIDE IN. Each ring paints over the one outside it, which is
         cheaper than working out the gaps and impossible to leave a
         seam in. */
      seg(0, this.vw, C.beyond);
      seg(aLo, aHi, apronCol);
      /* and the same band from the two walls that run across the frame,
         so the corners of the ground go dark from both directions the
         way they actually do */
      if (fine && outD <= shadeD) {
        var sh = (edgeAlong - runA) * SHADE_SHARE * scale;
        seg(aLo, aLo + sh, C.edgeShade);
        seg(aHi - sh, aHi, C.edgeShade);
      }
      /* THE KERB, where the hard standing meets the turf. One pixel of
         a lighter line, and the two rings stop being two greys and
         start being two SURFACES at different heights. */
      if (outD <= runD) {
        if (fine) {
          seg(rLo - 1, rLo, C.apronLip);
          seg(rHi, rHi + 1, C.apronLip);
        }
        seg(rLo, rHi, C.runoff);
      }
      /* and the same kerb running across the frame, drawn on whichever
         row the far or near one falls on */
      if (fine && prevOut > runD && outD <= runD) seg(aLo, aHi, C.apronLip);
      prevOut = outD;

      /* the pitch itself, only where there actually is pitch */
      if (outD > 0) continue;

      var t = Math.max(0, Math.min(1, (wy - depthMin) / depthSpan));
      var gi = Math.min(GRADE_N - 1, Math.max(0, Math.round(t * (GRADE_N - 1))));
      var cA = C.gradA[gi], cB = C.gradB[gi];

      /* BANDS ACROSS THE PITCH are bands of depth, so the whole row is
         one band and there is nothing to solve along it. */
      if (GROUND.mow === "across") {
        seg(pLo, pHi, (Math.floor(wy / band) & 1) ? cA : cB);
        continue;
      }
      var perBand = band * scale;
      if (!(perBand > 2)) {
        /* too far away to resolve — one flat row rather than a hundred
           one-pixel rectangles fighting each other */
        seg(pLo, pHi, cA);
        continue;
      }
      /* ONE COLOUR CHANGE A ROW, NOT ONE A BAND. Setting fillStyle is
         what a 2D canvas actually charges for; laying one colour down
         and painting the other one's bands over it is the same picture
         for two. */
      seg(pLo, pHi, cA);
      var flip = GROUND.mow === "check" && (Math.floor(wy / band) & 1);
      ctx.fillStyle = flip ? mix(cA, cB, 0.5) : cB;
      var lo = Math.max(0, pLo), hi = Math.min(this.vw, pHi);
      var b0 = Math.floor((camAlong + (lo - this.vw / 2) / scale) / band);
      if (b0 & 1) b0 += 1;               // start on a band cB owns
      var xEdge = this.vw / 2 + (b0 * band - camAlong) * scale;
      for (; xEdge < hi; xEdge += perBand * 2) {
        var sx2 = Math.max(lo, Math.round(xEdge));
        var ex2 = Math.min(hi, Math.round(xEdge + perBand));
        if (ex2 > sx2) ctx.fillRect(sx2, y, ex2 - sx2, 1);
      }
    }
  };

  /* =======================================================================
     THE CORNER FLAGS

     Four of them, and they were simply missing — which is the kind of
     absence nobody names and everybody feels, because a corner of a
     pitch with nothing standing in it does not read as a corner. They
     are also the only thing on the ground that shows which way the wind
     is going, and a pennant that moves is worth more than its nine
     pixels on a wide shot of an empty half.

     They go into the depth list with the players rather than being
     painted with the markings, because a flag is a thing standing UP on
     the grass and a striker running past one should pass in front of it
     or behind it depending on where he is.
     ======================================================================= */
  Pitch.prototype.cornerFlags = function () {
    var w = this.raw, self = this;
    var pts = [[-w.halfW, 0], [w.halfW, 0], [-w.halfW, w.len], [w.halfW, w.len]];
    pts.forEach(function (c, i) {
      var wx = c[0], wy = c[1];
      self.add(wy, function () {
        var p = self.project(wx, wy);
        if (!p.flat && p.d <= NEAR + 1) return;
        var sc = self.depthScale(p);
        var hgt = Math.max(5, Math.round(17 * sc));
        var x = Math.round(p.x), y = Math.round(p.y);
        var ctx = self.ctx;
        /* the shadow it throws, so it stands on the grass rather than
           floating above it */
        ctx.globalAlpha = 0.24;
        fillEllipse(ctx, x, y, Math.max(1, Math.round(2 * sc)),
                    Math.max(1, Math.round(p.ky * 1.4)), "#000000");
        ctx.globalAlpha = 1;
        /* the pole */
        ctx.fillStyle = "#e8eee6";
        ctx.fillRect(x, y - hgt, 1, hgt);
        ctx.fillStyle = "#9fb0a8";
        ctx.fillRect(x, y - 1, 1, 1);
        /* the pennant, which flutters — the phase is off the flag's own
           index so the four of them are not one flag drawn four times */
        var fw = Math.max(2, Math.round(hgt * 0.42));
        var fh = Math.max(2, Math.round(hgt * 0.30));
        var flap = Math.sin(self.t * 3.1 + i * 1.7);
        var dir = wx < 0 ? 1 : -1;
        for (var ry = 0; ry < fh; ry++) {
          var curl = Math.round(Math.sin(self.t * 3.1 + i * 1.7 + ry * 0.9) * 0.8);
          var len = Math.max(1, Math.round(fw * (1 - ry / (fh + 1) * 0.35)));
          ctx.fillStyle = ry === 0 ? "#ffd166" : (flap > 0 ? "#f5b73f" : "#e8a92f");
          ctx.fillRect(dir > 0 ? x + 1 : x - len,
                       y - hgt + ry + curl, len, 1);
        }
      }, wx);
    });
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
    /* WHICH TWO WALLS THESE ARE DEPENDS ON WHICH WAY THE PITCH RUNS.

       Up and down the pitch they are the touchlines. Turned sideways
       they are the two GOAL ENDS — and it is the same piece of
       geometry, because in both cases they are a wall standing on a
       line of constant ACROSS-coordinate, receding away from the
       camera. The only thing that changes is which of the pitch's two
       axes "across" means and which number the camera sits on.

       Working that out once, here, is the whole difference between a
       side-on view with a stadium round it and a side-on view with two
       bare edges where the goals are. */
    var across = this.swap
      ? [0 - EDGE_END / this.k, w.len + EDGE_END / this.k]   // behind each goal
      : [-(w.halfW + EDGE_SIDE / this.k), w.halfW + EDGE_SIDE / this.k];
    var acrossCam = this.swap ? this.cam.y : this.cam.x;
    var BOARD = 9, TIER = 42, ROOF = 7;
    var farEdge = (this.swap ? w.halfW + EDGE_SIDE / this.k - this.cam.x
                             : w.len + EDGE_END / this.k - this.cam.y);
    var farY = this.A + this.B / (NEAR + farEdge * this.k) - this.oy;
    /* how deep the ground goes, which is how far along these walls run:
       the pitch's depth extent plus its run-off, at both ends */
    var camDeep = this.swap ? this.cam.x : this.cam.y;
    var deepLo = this.swap ? -(w.halfW + EDGE_SIDE / this.k) : -(EDGE_END / this.k);
    var deepHi = this.swap ? (w.halfW + EDGE_SIDE / this.k)
                           : (w.len + EDGE_END / this.k);
    var dLo = Math.max(NEAR, NEAR + (deepLo - camDeep) * this.k);
    var dHi = NEAR + (deepHi - camDeep) * this.k;

    for (var si = 0; si < 2; si++) {
      var wx = across[si];
      /* which side of the frame this wall is on, which is all `side`
         was ever used for */
      var side = wx < acrossCam ? -1 : 1;
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
        var d = (wx - acrossCam) * this.k * FOCAL / off;
        if (!isFinite(d) || d <= NEAR) continue;
        /* A WALL IS A FINITE THING.

           This walks screen columns and asks, for each, at what depth
           the wall crosses it — which is right, and was answered for
           every depth from the lens to infinity. A wall that runs to
           infinity comes to a point, so as the camera panned toward one
           end of the ground that end's wall collapsed into a ONE PIXEL
           COLUMN of crowd painted straight down the middle of the
           pitch, over the grass, because the sides are drawn after it.
           It reads exactly like a corrupted sprite and it is really a
           wall two hundred metres long seen end-on.

           The wall only exists across the width of the ground, so the
           columns that would show it beyond that are columns where
           there is no wall. */
        if (d < dLo || d > dHi) continue;
        var gy = Math.round(this.A + this.B / d - this.oy);
        /* nothing beyond the far corner: that is the end stand's job,
           and two stands drawn over each other is a wall with a seam */
        if (gy <= farY || gy > this.vh + BOARD) continue;
        ground[x] = gy;

        /* THE BOARDS ALONG THE FRONT, sampled out of the baked run by
           where this column is ALONG the wall — see bakeBoards. World
           position rather than screen position is the whole trick:
           sampled by screen x the lettering would slide along the
           boards as the camera panned. */
        if (BSTRIP) {
          var wAlong = camDeep + (d - NEAR) / this.k;
          var span = BSTRIP.width / BSTRIP_BW * BSTRIP_WORLD;
          var f = ((wAlong % span) + span) % span / span;
          var sxs = Math.min(BSTRIP.width - 1, Math.floor(f * BSTRIP.width));
          ctx.drawImage(BSTRIP, sxs, 0, 1, BSTRIP_H, x, gy - BOARD, 1, BOARD);
        } else {
          ctx.fillStyle = C.board;
          ctx.fillRect(x, gy - BOARD, 1, BOARD);
        }

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

        /* AND THE SHADOW THE STAND THROWS AT ITS OWN FOOT.
           In the stand's own shade, not in the grass's: this was
           C.grassDk, from back when the ground ran to the edge of the
           picture and whatever a wall stood on was turf by definition.
           It stands on the apron now, and two dark green pixels at the
           bottom of a hoarding read as a strip of lawn nobody mows. */
        ctx.fillStyle = C.edgeShade;
        ctx.fillRect(x, gy, 1, 1);
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

  /* a marking ACROSS the pitch: one depth, therefore one rectangle —
     unless the pitch is turned, in which case it is the receding one
     and has to be solved a row at a time */
  Pitch.prototype.wbandY = function (x0, x1, y, wid, col) {
    var ctx = this.ctx;
    if (this.swap) {
      var a2 = this.project(x0, y), b2 = this.project(x1, y);
      var r0 = Math.max(0, Math.round(Math.min(a2.y, b2.y)));
      var r1 = Math.min(this.vh - 1, Math.round(Math.max(a2.y, b2.y)));
      var lo = Math.min(x0, x1), hi = Math.max(x0, x1);
      ctx.fillStyle = col || C.line;
      for (var r = r0; r <= r1; r++) {
        /* rowAt gives the DEPTH coordinate, which turned sideways is
           the pitch's x — so the row tells us which x we are looking at
           and the projection tells us where this line is at that x */
        var wx2 = this.rowAt(r + 0.5);
        if (wx2 < lo - 0.6 || wx2 > hi + 0.6) continue;
        var pr = this.project(wx2, y);
        if (!pr.flat && pr.d <= NEAR + 0.5) continue;
        var t = Math.max(1, Math.round(pr.k * (wid || LINEW)));
        var px0 = Math.round(pr.x - t / 2);
        if (px0 + t < 0 || px0 > this.vw) continue;
        ctx.fillRect(px0, r, t, 1);
      }
      return;
    }
    var a = this.project(x0, y), b = this.project(x1, y);
    if (!a.flat && a.d <= NEAR + 0.5) return;
    var th = Math.max(1, Math.round(a.ky * (wid || LINEW)));
    var sx = Math.max(-2, Math.round(Math.min(a.x, b.x)));
    var ex = Math.min(this.vw + 2, Math.round(Math.max(a.x, b.x)));
    if (ex < sx) return;
    var sy = Math.round(a.y - th / 2);
    if (sy + th < 0 || sy > this.vh) return;
    ctx.fillStyle = col || C.line;
    ctx.fillRect(sx, sy, ex - sx + 1, th);
  };

  /* a marking UP the pitch: solved per screen row */
  Pitch.prototype.wbandX = function (x, y0, y1, wid, col) {
    var a = this.project(x, y0), b = this.project(x, y1);
    var r0 = Math.max(0, Math.round(Math.min(a.y, b.y)));
    var r1 = Math.min(this.vh - 1, Math.round(Math.max(a.y, b.y)));
    var lo = Math.min(y0, y1), hi = Math.max(y0, y1);
    var ctx = this.ctx;
    ctx.fillStyle = col || C.line;

    /* TURNED SIDEWAYS, THIS LINE IS THE OTHER SHAPE.

       Up and down the pitch, a line of constant pitch-x recedes: every
       screen ROW is looking at a different depth, so it is solved one
       row at a time. Turned sideways the same line lies ACROSS the
       screen at a single depth — it is the constant-y case — and
       solving it by row would walk a hundred rows to draw one
       rectangle.

       This used to bail out to the one-pixel Bresenham path, on the
       grounds that only the greybox ever turned the pitch. That is no
       longer true, and the Bresenham path is the shimmer the band
       rasteriser exists to get rid of. Both orientations get the
       treatment they deserve now, which is one rectangle here and the
       row solve below. */
    if (this.swap) {
      /* Both ends of this line share a pitch-x, and turned sideways
         pitch-x IS the depth — so both project to the same screen row
         and the line is a horizontal rectangle lying across the frame.
         Its thickness is paint measured in depth, which is `ky`. */
      if (!a.flat && a.d <= NEAR + 0.5) return;
      var th = Math.max(1, Math.round(a.ky * (wid || LINEW)));
      var sx = Math.max(-2, Math.round(Math.min(a.x, b.x)));
      var ex = Math.min(this.vw + 2, Math.round(Math.max(a.x, b.x)));
      if (ex < sx) return;
      var sy = Math.round(a.y - th / 2);
      if (sy + th < 0 || sy > this.vh) return;
      ctx.fillRect(sx, sy, ex - sx + 1, th);
      return;
    }

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
    /* =====================================================================
       THE CREST IN THE CENTRE CIRCLE

       Ghosted into the turf, the way a club paints or mows its badge
       there. It is the one piece of a ground that says WHOSE it is
       without a word on it, and at this size it only works if it is
       nearly invisible: a crest drawn solid in the middle of a pitch is
       a sticker the players walk over. A tenth of an alpha, in the
       grass's own light colour, reads as mown rather than painted.
       ===================================================================== */
    if (this.emblem) {
      var ec = this.project(0, L / 2);
      if (ec.flat || ec.d > NEAR + 1) {
        var ew = Math.round(w.circleR * 1.5 * ec.k);
        var eh = Math.round(ew * (this.emblem.height / this.emblem.width));
        if (ew >= 8 && ew < this.vw) {
          /* drawMarkings works through the band helpers and has no ctx
             of its own, which is why this one asks for it */
          var ectx = this.ctx;
          ectx.save();
          ectx.globalAlpha = 0.13;
          ectx.imageSmoothingEnabled = false;
          ectx.drawImage(this.emblem, Math.round(ec.x - ew / 2),
                         Math.round(ec.y - eh / 2), ew, eh);
          ectx.restore();
        }
      }
    }

    /* the four corner quadrants */
    this.warc(-hw, 0, w.circleR * 0.2, 0, Math.PI / 2);
    this.warc(hw, 0, w.circleR * 0.2, Math.PI / 2, Math.PI);
    this.warc(-hw, L, w.circleR * 0.2, -Math.PI / 2, 0);
    this.warc(hw, L, w.circleR * 0.2, Math.PI, Math.PI * 1.5);
  };

  /* =======================================================================
     A NET IS A MESH, NOT A FEW THREADS

     The netting was six straight lines across a panel and four down it,
     which at this size reads as a wire fence: you can see through the
     gaps to the grass and the eye finds a grid rather than a fabric.
     What says "net" is the CROSS-HATCH — two families of diagonals
     crossing at a few pixels' pitch — because that is the only pattern
     that stays a texture as it gets smaller instead of breaking into
     separate lines.

     The panel is a bilinear quad, so the mesh follows whatever
     perspective the four corners are already in: it leans with the goal
     rather than being laid over the top of it. Diagonals are counted in
     cells, not in a fixed number of threads, so a goal in the far
     distance gets a few and the one you are standing next to gets many,
     and neither of them gets a moire.
     ======================================================================= */
  function netMesh(ctx, A, B, C2, D, cell, alpha, col) {
    /* A-B is the top edge, D-C2 the bottom; u runs A->B, v runs A->D */
    var at = function (u, v) {
      var x0 = A[0] + (B[0] - A[0]) * u, y0 = A[1] + (B[1] - A[1]) * u;
      var x1 = D[0] + (C2[0] - D[0]) * u, y1 = D[1] + (C2[1] - D[1]) * u;
      return [x0 + (x1 - x0) * v, y0 + (y1 - y0) * v];
    };
    var len = function (a, b) {
      var dx = a[0] - b[0], dy = a[1] - b[1];
      return Math.sqrt(dx * dx + dy * dy);
    };
    var eU = (len(A, B) + len(D, C2)) / 2;
    var eV = (len(A, D) + len(B, C2)) / 2;
    if (eU < 5 || eV < 5) return;               // too small to be a net
    /* CAPPED, because the cost of a net is the number of threads and a
       goal filling the screen during a celebration would otherwise ask
       for a hundred and sixty of them per panel. Past about two dozen
       the weave is a texture anyway and more threads only cost. */
    var nU = Math.max(2, Math.min(24, Math.round(eU / cell)));
    var nV = Math.max(2, Math.min(24, Math.round(eV / cell)));

    /* where a diagonal of index k crosses the panel's four edges. sgn is
       +1 for the family running one way and -1 for the other, which is
       the whole of the difference between them. */
    var ends = [];
    var edge = function (k, sgn) {
      ends.length = 0;
      var u, v;
      u = k / nU;              if (u >= 0 && u <= 1) ends.push([u, 0]);
      u = (k - sgn * nV) / nU; if (u >= 0 && u <= 1) ends.push([u, 1]);
      v = sgn * k / nV;        if (v > 0 && v < 1) ends.push([0, v]);
      v = sgn * (k - nU) / nV; if (v > 0 && v < 1) ends.push([1, v]);
      return ends.length >= 2;
    };

    ctx.globalAlpha = alpha;
    for (var fam = 0; fam < 2; fam++) {
      var sgn = fam ? -1 : 1;
      var lo = sgn > 0 ? 0 : -nV, hi = sgn > 0 ? nU + nV : nU;
      for (var k = lo; k <= hi; k++) {
        if (!edge(k, sgn)) continue;
        var a = at(ends[0][0], ends[0][1]), b = at(ends[1][0], ends[1][1]);
        line(ctx, a[0], a[1], b[0], b[1], col);
      }
    }
    ctx.globalAlpha = 1;
  }

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
  /* =======================================================================
     A GOAL SEEN FROM THE SIDE IS A DIFFERENT OBJECT

     Not a different drawing of the same object — a different object.
     Face on, the mouth is a rectangle sixty-eight units wide and the
     two posts stand at the same distance, so one height and one width
     describe the whole frame. From a touchline camera the mouth is
     EDGE ON: the near post is thirty-four units closer than the far
     one, which puts them at different depths, different heights, and
     — when the camera is square on to the goal — at exactly the same
     place across the screen.

     That last part is what broke the face-on drawing rather than
     merely distorting it. It measures the mouth as the gap between the
     two posts' screen x and gives up when that gap falls under three
     pixels, which is the right guard for a goal that has gone behind
     the lens and precisely the wrong one for a goal you are looking
     straight at: pan the side-on camera onto the goalmouth and the
     goal disappeared. So the side view gets its own routine, in which
     the separation between the posts is vertical and the near post is
     a thing that stands in FRONT of the keeper.
     ======================================================================= */
  Pitch.prototype.drawGoalSide = function (far, bulge) {
    var ctx = this.ctx, w = this.raw;
    var gl = far ? w.len : 0;
    var out = far ? 1 : -1;
    /* the camera is off the low-x touchline, so -goalHalf is the near
       post and +goalHalf the far one, in both goals */
    var fN = this.project(-w.goalHalf, gl), fF = this.project(w.goalHalf, gl);
    if (fN.d <= NEAR + 1 || fF.d <= NEAR + 1) return;
    var bk = gl + out * w.goalDepth;
    var bN = this.project(-w.goalHalf, bk), bF = this.project(w.goalHalf, bk);
    var solid = bN.d > NEAR + 1 && bF.d > NEAR + 1;
    var push = Math.sin(Math.max(0, Math.min(1, bulge || 0)) * Math.PI) * 5;

    /* EACH POST IS AS TALL AS A PLAYER STANDING BESIDE IT. The face-on
       goal uses one fixed height because both its posts are the same
       distance away; here they are not, and a crossbar drawn level
       between two posts at different depths is the one thing that
       would make the whole stadium look flat. */
    var HGT = 52;
    var hN = Math.max(8, Math.round(HGT * this.depthScale(fN)));
    var hF = Math.max(8, Math.round(HGT * this.depthScale(fF)));
    var hBN = Math.round(hN * 0.70), hBF = Math.round(hF * 0.70);

    var xN = Math.round(fN.x), yN = Math.round(fN.y);
    var xF = Math.round(fF.x), yF = Math.round(fF.y);
    /* THE BULGE PUSHES THE BACK PANEL AWAY FROM THE LINE, and from here
       "away" is whichever way the net already goes on screen — which
       side of the frame that is depends on which goal this is and
       where the camera is panned to, so it is taken from the drawing
       rather than assumed. */
    var awayX = bN.x - fN.x, awayY = bN.y - fN.y;
    var awayL = Math.max(0.001, Math.sqrt(awayX * awayX + awayY * awayY));
    var pushX = awayX / awayL * push, pushY = awayY / awayL * push;
    var xbN = Math.round(bN.x + pushX), ybN = Math.round(bN.y + pushY);
    var xbF = Math.round(bF.x + pushX), ybF = Math.round(bF.y + pushY);
    if (Math.abs(yF - yN) < 3) return;          // edge-on to the point of nothing

    var self = this;
    var wob = function (i) {
      return Math.round(Math.sin(self.t * 1.9 + i * 0.7) * 0.8 + push * 0.3);
    };
    /* a point on the goal's frame: t runs near post (0) to far post (1),
       u runs the goal line (0) to the back of the net (1), and h is how
       far up the frame, 0 at the grass and 1 at the bar */
    var P = function (t, u, h) {
      var gx = (xN + (xF - xN) * t) * (1 - u) + (xbN + (xbF - xbN) * t) * u;
      var gy = (yN + (yF - yN) * t) * (1 - u) + (ybN + (ybF - ybN) * t) * u;
      var top = (hN + (hF - hN) * t) * (1 - u) + (hBN + (hBF - hBN) * t) * u;
      return [gx, gy - top * h];
    };

    /* ---- the shadow the frame throws forward onto the grass */
    var sf = this.project(-w.goalHalf, gl - out * 4.5);
    var sfF = this.project(w.goalHalf, gl - out * 4.5);
    ctx.globalAlpha = 0.24;
    ctx.fillStyle = "#000000";
    for (var q = 0; q <= 1.0001; q += 0.08) {
      var ax = xN + (xF - xN) * q, ay = yN + (yF - yN) * q;
      var bx = sf.x + (sfF.x - sf.x) * q, by = sf.y + (sfF.y - sf.y) * q;
      ctx.fillRect(Math.round(Math.min(ax, bx)), Math.round(Math.min(ay, by)),
                   Math.max(2, Math.round(Math.abs(bx - ax)) + 2),
                   Math.max(1, Math.round(Math.abs(by - ay)) + 1));
    }
    ctx.globalAlpha = 1;

    /* ---- the volume inside, so the ball goes somewhere dark */
    if (solid) {
      ctx.globalAlpha = 0.30;
      ctx.fillStyle = mix(C.grassDk, "#000000", 0.55);
      ctx.beginPath();
      var ring = [P(0, 0, 1), P(1, 0, 1), P(1, 1, 1), P(1, 1, 0), P(0, 1, 0), P(0, 0, 0)];
      ctx.moveTo(ring[0][0], ring[0][1]);
      for (var ri = 1; ri < ring.length; ri++) ctx.lineTo(ring[ri][0], ring[ri][1]);
      ctx.closePath(); ctx.fill();
      ctx.globalAlpha = 1;
    }

    /* ---- the netting. The panel you actually see from here is the
       SIDE of the net nearest the camera, which face on is the one
       panel that is edge-on and invisible. */
    /* THREE PANELS AND A ROOF, each a cross-hatch over its own four
       corners — the back of the net, the far side, and the roof. The
       NEAR side is deliberately missing from this pass: it is the one
       panel between the camera and the goalmouth, so it waits for the
       depth pass at the bottom of this function and is drawn in front
       of whoever is standing in the goal. */
    /* WHICH PANEL YOU ACTUALLY SEE, AND HOW HARD IT SHOULD PUSH.

       From a touchline the camera looks ALONG the goal line, so the two
       SIDE panels are the ones facing it square and the back panel is
       nearly edge-on. That is the opposite of the face-on camera, and
       it is why the side net has to be the loose one: drawn at the
       density the back panel wants, it fills the whole mouth with a
       sheet of frosted glass and you cannot see the ball go in.

       So the side you look through is wide-celled and faint, and the
       back — which you are seeing through it — is tighter and brighter,
       because a net reads as a net mostly from the panel BEHIND the
       one you are looking through. */
    var CELL = 4;
    if (solid) {
      /* the back: from near post to far post, at the back of the net */
      netMesh(ctx, P(0, 1, 1), P(1, 1, 1), P(1, 1, 0), P(0, 1, 0),
              CELL, 0.50, C.net);
      /* the far side, mostly hidden behind the near one */
      netMesh(ctx, P(1, 0, 1), P(1, 1, 1), P(1, 1, 0), P(1, 0, 0),
              CELL + 1, 0.20, C.net);
      /* the roof, a lid rather than a surface */
      netMesh(ctx, P(0, 0, 1), P(1, 0, 1), P(1, 1, 1), P(0, 1, 1),
              CELL + 1, 0.18, C.net);
    }

    /* ---- the frame */
    var post = function (t, u, bright) {
      var a = P(t, u, 0), b = P(t, u, 1);
      ctx.fillStyle = bright ? C.post : C.postDk;
      ctx.fillRect(Math.round(a[0]) - 1, Math.round(b[1]), 2,
                   Math.max(2, Math.round(a[1] - b[1])));
      ctx.fillStyle = C.postDk;
      ctx.fillRect(Math.round(a[0]) + 1, Math.round(b[1]) + 1, 1,
                   Math.max(1, Math.round(a[1] - b[1]) - 1));
    };
    /* the stanchions at the back of the net, dimmer because further */
    if (solid) { ctx.globalAlpha = 0.7; post(0, 1); post(1, 1); ctx.globalAlpha = 1; }
    post(1, 0, true);

    /* ---- AND THE NEAR POST IS NOT SCENERY, IT IS AN OBSTRUCTION.

       Everything above is painted before the players, which is right
       for a goal you are looking into: the net is behind everybody.
       The post nearest a touchline camera is not — a keeper on his
       line stands BEHIND it, and a near post painted first is a post
       the keeper walks over the top of. So the near post and the
       crossbar go into the same depth-sorted list as the players, at
       the post's own distance, and painter's order does the rest. */
    var self2 = this;
    this.add(gl, function () {
      var barA = P(0, 0, 1), barB = P(1, 0, 1);
      ctx.fillStyle = C.post;
      var steps = Math.max(2, Math.round(Math.abs(barB[1] - barA[1])) + 1);
      for (var bi = 0; bi <= steps; bi++) {
        var bt = bi / steps;
        ctx.fillRect(Math.round(barA[0] + (barB[0] - barA[0]) * bt),
                     Math.round(barA[1] + (barB[1] - barA[1]) * bt), 2, 2);
      }
      post(0, 0, true);
      /* the near side panel, which from a touchline is the big one and
         the one a keeper stands behind */
      if (solid) {
        netMesh(ctx, P(0, 0, 1), P(0, 1, 1), P(0, 1, 0), P(0, 0, 0),
                CELL + 1, 0.24, C.net);
      }
      return self2;
    }, -w.goalHalf);
  };

  Pitch.prototype.drawGoal = function (far, bulge) {
    if (this.swap) return this.drawGoalSide(far, bulge);
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
  /* WHICH COORDINATE IS "HOW FAR AWAY".

     Up and down the pitch it is the second one, and for most of this
     file's life there was no reason to say so. Turned sideways it is
     the FIRST one, and a list sorted on the wrong axis is not subtly
     wrong: it sorts the players by which end of the pitch they are at
     instead of by which touchline they are near, so a defender on the
     far side is painted over the striker in front of him whenever the
     two happen to be level.

     Both point the same way — the camera sits below the minimum of
     whichever axis it is watching along, so bigger is always further —
     so the only thing needed is to be handed the right number. Callers
     that draw something standing on the grass pass both. */
  Pitch.prototype.add = function (wy, fn, wx) {
    this.items.push({ y: this.swap && wx !== undefined ? wx : wy, fn: fn });
  };

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

  /* WHAT COUNTS AS FULL SIZE.

     The depth ramp is a ratio against some reference depth, and the
     reference used to be "whatever depth the screen row four fifths of
     the way down is looking at" — a property of the lens alone. That is
     right for a camera that always sits the same distance behind the
     play, which is what the up-and-down camera does, and completely
     wrong for one that sits off a touchline: move the camera back and
     every player on the pitch falls past the clamp at once, so the
     whole match is drawn at five eighths.

     The reference is the thing the camera is LOOKING AT, which is the
     ball. The player on it is always full size and everybody else is
     sized against him, in either orientation, at any distance. */
  Pitch.prototype.setFocus = function (wx, wy) {
    var p = this.project(wx, wy);
    this.focusD = p.flat ? NEAR : p.d;
    /* the frame is hung off the thing being watched, so moving the one
       moves the other — see reframe() */
    this.reframe();
  };
  Pitch.prototype.refDepth = function () {
    if (this.mode === "oblique") return NEAR;
    return this.focusD || this.depthAtY(this.vh * 0.78);
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
    }, o.wx);
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
    }, wx);
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
    }, wx - 0.01);
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
    this.cornerFlags();
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
  /* the home side's badge, baked by the chapter because the crests live
     there — the renderer only needs something it can stamp */
  Pitch.prototype.setEmblem = function (canvas) { this.emblem = canvas || null; };

  Pitch.prototype.setCrowd = function (home, away) {
    this.crowdHome = home || null;
    this.crowdAway = away || null;
  };
  /* somebody scored: send it round the ground */
  Pitch.prototype.startWave = function () { this.wave = 0; };
  Pitch.prototype.setMood = function (v) { this.mood = clampN(v, -1, 1); };
  /* =======================================================================
     THE CROWD'S ENERGY

     One number, nought to one, worked out by the match and read by
     everything: how hard the stand sways, how bright it is, how far
     forward it is leaning — and, in cup.js, how many layers of the
     chant are playing. Both halves reading the SAME number is the
     whole point. Anything else and the ground looks roused while it
     sounds bored, which is worse than either.
     ======================================================================= */
  Pitch.prototype.setEnergy = function (v) { this.energy = clampN(v, 0, 1); };
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
    /* ENERGY SETS THE BASELINE, MOOD SETS THE SPIKE. A ground that is
       up for it sways harder and faster all match; a goal against it
       drops the mood for a few seconds on top of that. */
    var e = this.energy === undefined ? 0.25 : this.energy;
    var amp = (0.55 + e * 1.1) * (1 + this.mood * (this.mood > 0 ? 1.6 : 0.85));
    var idle = Math.sin(this.t * (1.7 + e * 1.4 + this.mood * 1.1)
                        + colFrac * 9 + row) * amp;
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
