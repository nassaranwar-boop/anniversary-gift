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
    var g = v.grass || "#4a8a44", st = v.stripe || mix(g, "#000000", 0.16);
    var night = !!v.floodlit;
    C.grassB = g;
    C.grassA = st;
    C.grassLit = mix(g, "#ffffff", 0.18);
    C.grassDk = mix(st, "#000000", night ? 0.34 : 0.22);
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
  }

  function Pitch(display, world) {
    this.display = display;
    this.buf = document.createElement("canvas");
    this.ctx = null;
    this.cam = { x: 0, y: 0 };      // world point at the near edge, centre
    this.t = 0;
    this.zoom = 1;
    this.flash = 0; this.flashCol = "#ffffff";
    this.shake = 0;
    this.items = [];
    this.conf = [];
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
    this.B = B0 * this.fy;
  };

  Pitch.prototype.rnd = function (i) { return this.seeds[(i | 0) & 2047]; };

  /* --------------------------------------------------------- projection */
  Pitch.prototype.project = function (wx, wy) {
    var k = this.k;
    var d = Math.max(8, NEAR + (wy - this.cam.y) * k);
    return {
      x: this.vw / 2 + (wx - this.cam.x) * k * FOCAL / d,
      y: this.A + this.B / d,
      d: d,
      k: FOCAL / d * k,          // screen pixels per WORLD unit, across
      ky: this.B / (d * d) * k,  // screen pixels per WORLD unit, in depth
    };
  };
  Pitch.prototype.depthAtY = function (sy) { return this.B / (sy - this.A); };

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
    var goal = this.project(0, this.raw.len);
    /* where the stand MEETS THE GROUND — a few units of run-off behind
       the goal line. The boards stand UP from this line and the tiers
       rise behind them; the first build drew them hanging down from it,
       and the grass, which starts at the same line, painted over every
       one of them. */
    var base = Math.min(this.vh - 1, Math.max(0, Math.round(
      this.project(0, this.raw.len + 7 / this.k).y)));
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
          /* the sway: whole columns lean together, a beat apart, which
             is what a crowd actually looks like from this far away */
          var sway = Math.round(Math.sin(this.t * 2.1 + cxx * 0.45 + r) * 0.9);
          ctx.fillStyle = CROWD[(this.rnd(id + 11) * CROWD.length) | 0];
          ctx.fillRect(sxp + sway, ry, 3, 2);
          ctx.fillStyle = "#1a1620";
          ctx.fillRect(sxp + sway, ry + 2, 3, 1);
        }
      }
      ctx.fillStyle = C.rail;  ctx.fillRect(0, Math.max(0, y - 2), this.vw, 1);
      ctx.fillStyle = C.roof;  ctx.fillRect(0, Math.max(0, y - 1), this.vw, 1);
      y = top; band++;
    }

    ctx.fillStyle = C.roof;
    ctx.fillRect(0, 0, this.vw, Math.max(0, y));
    ctx.fillStyle = C.wallLit;
    ctx.fillRect(0, Math.max(0, y - 1), this.vw, 1);

    /* THE ADVERTISING BOARDS. Blocks of flat colour with a lit lip: no
       words, because a word at this size is four grey pixels and reads
       as dirt. */
    ctx.fillStyle = C.board;
    ctx.fillRect(0, lip, this.vw, bh);
    for (var bx = 0; bx < this.vw; bx += 26) {
      var bn = this.rnd(bx * 13 + 5);
      ctx.fillStyle = bn > 0.55 ? "#a8283a" : (bn > 0.3 ? "#c8912f" : "#2f4f7a");
      ctx.fillRect(bx + 1, lip + 1, 23, Math.max(1, bh - 2));
      ctx.fillStyle = C.boardLip;
      ctx.fillRect(bx + 1, lip, 23, 1);
    }
    ctx.fillStyle = C.grassDk;
    ctx.fillRect(0, base, this.vw, 2);
  };

  /* ============================================================ THE GRASS
     Drawn row by row from the bottom of the screen up. Each screen row
     is a different depth, so the mowing bands are worked out per row and
     come out correctly foreshortened for nothing. */
  Pitch.prototype.drawGrass = function () {
    var ctx = this.ctx;
    var y0 = Math.max(0, Math.round(this.project(0, this.raw.len + 7 / this.k).y) + 2);
    var band = 9 / this.k;               // mowing band, in world units
    for (var y = y0; y < this.vh; y++) {
      var d = this.depthAtY(y + 0.5);
      if (d <= 0) continue;
      var wy = this.cam.y + (d - NEAR) / this.k;
      var bi = Math.floor(wy / band);
      var col = (bi & 1) ? C.grassA : C.grassB;
      /* the far half sits in the stand's shadow, which is the cheapest
         depth cue there is and the most convincing */
      if (wy > this.raw.len * 0.62) col = (bi & 1) ? C.grassDk : C.grassA;
      ctx.fillStyle = col;
      ctx.fillRect(0, y, this.vw, 1);
    }
  };

  /* ------------------------------------------------------- the markings */
  Pitch.prototype.wline = function (x0, y0, x1, y1, col) {
    var a = this.project(x0, y0), b = this.project(x1, y1);
    line(this.ctx, a.x, a.y, b.x, b.y, col || C.line);
  };
  Pitch.prototype.warc = function (cx, cy, r, a0, a1, col) {
    var n = 40, prev = null;
    for (var i = 0; i <= n; i++) {
      var a = a0 + (a1 - a0) * (i / n);
      var p = this.project(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
      if (prev) line(this.ctx, prev.x, prev.y, p.x, p.y, col || C.line);
      prev = p;
    }
  };

  Pitch.prototype.drawMarkings = function () {
    var w = this.raw, hw = w.halfW, L = w.len;
    this.wline(-hw, 0, -hw, L);
    this.wline(hw, 0, hw, L);
    this.wline(-hw, 0, hw, 0);
    this.wline(-hw, L, hw, L);
    this.wline(-hw, L / 2, hw, L / 2);
    this.warc(0, L / 2, w.circleR, 0, Math.PI * 2);
    var c = this.project(0, L / 2);
    this.ctx.fillStyle = C.line;
    this.ctx.fillRect(Math.round(c.x) - 1, Math.round(c.y), 2, 1);
    for (var e = 0; e < 2; e++) {
      var gl = e ? L : 0, s = e ? -1 : 1;
      this.wline(-w.boxHalf, gl, -w.boxHalf, gl + s * w.boxDepth);
      this.wline(w.boxHalf, gl, w.boxHalf, gl + s * w.boxDepth);
      this.wline(-w.boxHalf, gl + s * w.boxDepth, w.boxHalf, gl + s * w.boxDepth);
      this.wline(-w.sixHalf, gl, -w.sixHalf, gl + s * w.sixDepth);
      this.wline(w.sixHalf, gl, w.sixHalf, gl + s * w.sixDepth);
      this.wline(-w.sixHalf, gl + s * w.sixDepth, w.sixHalf, gl + s * w.sixDepth);
      var sp = this.project(0, gl + s * w.spot);
      this.ctx.fillStyle = C.line;
      this.ctx.fillRect(Math.round(sp.x), Math.round(sp.y), 1, 1);
      this.warc(0, gl + s * w.spot, w.circleR, s > 0 ? 0.35 : Math.PI + 0.35,
                s > 0 ? Math.PI - 0.35 : Math.PI * 2 - 0.35);
    }
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
  Pitch.prototype.drawGoal = function (far, bulge) {
    var ctx = this.ctx, w = this.raw;
    var gl = far ? w.len : 0, s = far ? 1 : -1;
    var p = this.project(0, gl);
    /* A GOAL BEHIND THE CAMERA IS NOT A GOAL, IT IS A LATTICE.

       The projection clamps depth to a minimum rather than failing, so
       a goal line behind the lens comes back with an enormous scale:
       the posts land thousands of pixels off either side and the loop
       that draws the netting walks the entire width of the screen at
       four-pixel intervals. On the match camera you never saw it; the
       moment a super cut the camera in close, the whole pitch came out
       covered in a dotted white mesh. */
    if (p.d <= NEAR + 1) return;
    /* THE CROSSBAR IS A FIXED HEIGHT IN PIXELS, and that is not a
       shortcut — it is the same decision the characters are drawn with.
       They never scale with depth, so a goal that did would tower over
       a keeper at one end and come up to his knee at the other. Its
       WIDTH stays in perspective because the width lies on the ground
       plane and the ground plane is the one thing here that is real. */
    var hgt = 52;
    var lp = this.project(-w.goalHalf, gl), rp = this.project(w.goalHalf, gl);
    var push = Math.round(Math.sin(Math.max(0, bulge || 0) * Math.PI) * 4);

    /* a lattice, not a fill: at three pixels the mesh closed up and the
       mouth of the goal read as a solid white box */
    var x0 = Math.max(-4, Math.round(lp.x)), x1 = Math.min(this.vw + 4, Math.round(rp.x));
    for (var x = x0; x <= x1; x += 4) {
      for (var y = Math.round(lp.y) - hgt; y < Math.round(lp.y); y += 4) {
        px(ctx, x, y + (far ? -push : push), C.net);
        px(ctx, x + 2, y + 2 + (far ? -push : push), C.postDk);
      }
    }
    ctx.fillStyle = C.post;
    ctx.fillRect(Math.round(lp.x) - 1, Math.round(lp.y) - hgt, 2, hgt);
    ctx.fillRect(Math.round(rp.x), Math.round(rp.y) - hgt, 2, hgt);
    ctx.fillRect(Math.round(lp.x) - 1, Math.round(lp.y) - hgt,
                 Math.round(rp.x - lp.x) + 3, 2);
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
  Pitch.prototype.shadow = function (wx, wy, r, air) {
    var p = this.project(wx, wy);
    var f = 1 - Math.min(0.55, (air || 0) * 0.055);
    fillEllipse(this.ctx, p.x, p.y - 1, Math.max(2, p.k * r * f),
                Math.max(1, p.ky * r * f * 1.8), C.shadow);
  };

  /* the ring under whoever the player is driving. A projected annulus
     with two gaps that rotate, so it reads as a live marker rather than
     a decal, and in the trophy gold so it is never lost in a kit. */
  Pitch.prototype.ring = function (wx, wy, phase, rad) {
    var ctx = this.ctx, n = 96, r = (rad || 1.7) / this.k;
    for (var i = 0; i < n; i++) {
      var a = (i / n) * Math.PI * 2;
      var g = ((i / n) + (phase || 0)) % 1;
      if (g < 0.07 || (g > 0.5 && g < 0.57)) continue;
      var p = this.project(wx + Math.cos(a) * r, wy + Math.sin(a) * r);
      px(ctx, p.x, p.y, C.ring);
      px(ctx, p.x, p.y + 1, C.ringDk);
    }
  };

  /* the character. Drawn at 1:1 with no smoothing and on whole pixels —
     the two things that keep the bible's outline one pixel wide. */
  Pitch.prototype.sprite = function (at, anim, faceId, frame, wx, wy, flip, air) {
    var ctx = this.ctx;
    var p = this.project(wx, wy);
    var uv = at.uv(anim, faceId, frame);
    if (!uv) return;
    var S = at.size;
    /* the cell's ground line is where the boots are, so that is what
       lands on the projected point rather than the bottom of the cell */
    var dx = Math.round(p.x - S / 2);
    /* `air` is in SPRITE PIXELS — it comes off the frame itself, which
       knows how far off the ground it drew her. Multiplying it by the
       lens, as the first version did, lifted a sliding tackle eighteen
       pixels into the sky and left its shadow on the grass underneath. */
    var dy = Math.round(p.y - at.ground - (air || 0));
    ctx.imageSmoothingEnabled = false;
    if (flip) {
      ctx.save();
      ctx.translate(dx + S, dy);
      ctx.scale(-1, 1);
      ctx.drawImage(at.canvas, uv.col * S, uv.row * S, S, S, 0, 0, S, S);
      ctx.restore();
    } else {
      ctx.drawImage(at.canvas, uv.col * S, uv.row * S, S, S, dx, dy, S, S);
    }
  };

  /* one call per player: the shadow, the ring under them if they are the
     one being driven, and the sprite, all at the same depth so the sort
     keeps them together */
  Pitch.prototype.player = function (o) {
    var self = this;
    this.add(o.wy, function () {
      self.shadow(o.wx, o.wy, o.shadow || 4, o.air);
      if (o.ring !== undefined && o.ring !== null) self.ring(o.wx, o.wy, o.ring);
      self.sprite(o.at, o.anim, o.face, o.frame, o.wx, o.wy, o.flip, o.air);
    });
  };

  /* the ball: three tones and a hard edge, never a gradient */
  Pitch.prototype.ball = function (wx, wy, h, tint, rw) {
    var self = this;
    this.add(wy, function () {
      var p = self.project(wx, wy);
      var ctx = self.ctx;
      /* the radius arrives in WORLD units. Working it out from the lens
         alone, as the first version did, gave a forty-pixel football
         sitting on top of the player who was dribbling it. */
      var r = Math.max(2, Math.round(p.k * (rw || 1.9)));
      var by = p.y - (h || 0) * p.k - r;
      fillEllipse(ctx, p.x, by, r, r, tint || "#f4f4e8");
      fillEllipse(ctx, p.x + 1, by + 1, r - 1, r - 1, tint ? tint : "#cfd2c4");
      px(ctx, p.x - 1, by - 1, "#ffffff");
      if (!tint) {
        px(ctx, p.x, by, "#3a3f38");
        px(ctx, p.x - 2, by + 1, "#3a3f38");
        px(ctx, p.x + 2, by - 1, "#3a3f38");
      }
    });
  };

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

  /* ------------------------------------------------------------- a frame */
  Pitch.prototype.begin = function (dt, bulge) {
    this.t += dt || 0;
    this.items.length = 0;
    this.drawStand();
    this.drawGrass();
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
    ctx.globalAlpha = 0.18; ctx.fillStyle = "#0a0812";
    for (var i = 0; i < 3; i++) {
      var w = 6 + i * 5;
      ctx.fillRect(0, 0, w, this.vh); ctx.fillRect(this.vw - w, 0, w, this.vh);
      ctx.fillRect(0, 0, this.vw, w * 0.6);
      ctx.fillRect(0, this.vh - w * 0.6, this.vw, w);
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
  Pitch.prototype.tick = function (dt) {
    if (this.flash > 0) this.flash = Math.max(0, this.flash - dt * 2.6);
    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 14);
  };

  return {
    create: function (display, world) { return new Pitch(display, world); },
    venue: venue, mix: mix,
    BASE_W: BASE_W, BASE_H: BASE_H, COLOURS: C, CROWD: CROWD,
  };
})();
