/* =========================================================================
   OUISSY'S CUP — THE 2D PITCH

   The character bible's Part 8 settles an argument I had lost: no 3D,
   no billboards, a faux-perspective pitch drawn in two dimensions. This
   is that pitch.

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

   The lens is long (focal 1200 over a visible depth of 54 to 112) so the
   nearest player is only about twice as close as the furthest one, and
   at a constant sprite size that error never gets a chance to shout.

   ---------------------------------------------------------------------
   NOTHING IS LOADED

   No textures, no images, no fonts. The grass, the mowing, the markings,
   the nets, the boards and every single person in the crowd are drawn
   here, in code, one rectangle at a time — the same rule the whole site
   runs on.
   ========================================================================= */

window.CupPitch2D = (function () {
  "use strict";

  /* the virtual screen. Everything is drawn at this size and then blown
     up by a whole number, which is the only way pixels stay square */
  var VW = 480, VH = 270;

  /* THE LENS, and how these five numbers were chosen.

     A world unit is 0.64 metres. That is not arbitrary: the bible fixes
     the character at 48 pixels, so the unit is whatever makes a 48-pixel
     figure read as a person at the distance the camera sits. At the
     depth the action plays out (about 70) the lens gives 12 pixels per
     unit, which puts her at four units — two and a half metres. Arcade
     football has always drawn its players a head too big; two and a half
     metres is that exaggeration and not a mistake.

     A is the horizon. The first build had it 250 pixels above the top of
     the screen, which is what a broadcast camera actually does — and it
     meant the far goal and the entire stand were off-screen unless she
     was inside the last quarter of the pitch. Every frame was a wall of
     grass. Ten pixels down from the top gives a stadium that is there
     the whole time. */
  var FOCAL = 850;
  var HEIGHT = 16.5;         // how high the camera sits, in world units
  var B = FOCAL * HEIGHT;
  var A = 10;                // the horizon, just inside the top edge
  var NEAR = 54;             // depth of the bottom edge of the screen

  /* the pitch at full size, converted into those units: 68 metres by
     105, the boxes and the circle all measured rather than eyeballed */
  var PITCH = { halfW: 53, len: 164 };

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
     chroma, with only the odd shirt catching the light — so these are
     the kit colours taken down towards the stand's own darkness, and
     most of the stand is the two dull ones. */
  var CROWD = ["#6b3540", "#7a6438", "#8c8474", "#35506e", "#4a3a5e",
               "#2f5a4c", "#7a4630", "#3a3644", "#3a3644", "#2f2b38"];

  function Pitch(display) {
    this.display = display;
    this.buf = document.createElement("canvas");
    this.buf.width = VW; this.buf.height = VH;
    this.ctx = this.buf.getContext("2d");
    this.ctx.imageSmoothingEnabled = false;
    this.cam = { x: 0, y: 0 };      // world point sitting at the near edge
    this.t = 0;
    this.vw = VW; this.vh = VH;
    /* one fixed noise field, so the crowd is the same crowd every frame
       instead of a different crowd sixty times a second */
    this.seeds = [];
    for (var i = 0; i < 2048; i++) {
      this.seeds.push(((Math.sin(i * 12.9898) * 43758.5453) % 1 + 1) % 1);
    }
  }

  Pitch.prototype.rnd = function (i) { return this.seeds[(i | 0) & 2047]; };

  /* --------------------------------------------------------- projection */
  Pitch.prototype.depth = function (wy) { return NEAR + (wy - this.cam.y); };
  Pitch.prototype.project = function (wx, wy) {
    var d = Math.max(8, NEAR + (wy - this.cam.y));
    return {
      x: VW / 2 + (wx - this.cam.x) * FOCAL / d,
      y: A + B / d,
      d: d,
      k: FOCAL / d,            // horizontal pixels per world unit
      ky: B / (d * d),         // vertical pixels per world unit of depth
    };
  };
  /* the inverse, for working out which world rows to draw */
  Pitch.prototype.depthAtY = function (sy) { return B / (sy - A); };

  /* ------------------------------------------------------ pixel drawing
     Every one of these lands on integer coordinates. The canvas will
     happily antialias an arc or a diagonal, and a single soft pixel
     anywhere in a pixel-art frame reads as a mistake. */
  function px(ctx, x, y, col) {
    ctx.fillStyle = col; ctx.fillRect(x | 0, y | 0, 1, 1);
  }
  function hline(ctx, x0, x1, y, col) {
    if (x1 < x0) { var t = x0; x0 = x1; x1 = t; }
    ctx.fillStyle = col;
    ctx.fillRect(Math.round(x0), Math.round(y), Math.round(x1 - x0) + 1, 1);
  }
  function line(ctx, x0, y0, x1, y1, col) {
    x0 = Math.round(x0); y0 = Math.round(y0);
    x1 = Math.round(x1); y1 = Math.round(y1);
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
    var ctx = this.ctx;
    var goal = this.project(0, PITCH.len);
    /* where the stand MEETS THE GROUND — a few units of run-off behind
       the goal line. The boards stand UP from this line and the tiers
       rise behind them; the first build drew them hanging down from it,
       and the grass, which starts at the same line, painted over every
       one of them. */
    var base = Math.min(VH - 1, Math.max(0, Math.round(
      this.project(0, PITCH.len + 7).y)));
    var bh = Math.max(4, Math.round(goal.k * 1.6));
    var lip = Math.max(0, base - bh);

    ctx.fillStyle = C.sky;
    ctx.fillRect(0, 0, VW, Math.max(0, base));
    if (base <= 0) return;

    /* THE TIERS.

       A stadium is not a wall with dots on it. It is a stack of shallow
       steps, each one lit slightly differently, with a rail along the
       front and a dark gap under it — and that stack is what gives the
       far end depth without a single line of perspective. */
    var tiers = [
      { h: 26, rows: 7, top: 0 },
      { h: 20, rows: 5, top: 0 },
    ];
    var y = lip;
    var band = 0;
    for (var ti = 0; ti < tiers.length; ti++) {
      var T = tiers[ti];
      var top = y - T.h;
      ctx.fillStyle = ti ? C.tier : C.tierLit;
      ctx.fillRect(0, Math.max(0, top), VW, Math.min(T.h, y));

      /* the people */
      var step = T.h / T.rows;
      for (var r = 0; r < T.rows; r++) {
        var ry = Math.round(top + r * step);
        if (ry < -4 || ry > VH) continue;
        var pitchX = 6 + (T.rows - r) * 0.25;
        for (var cxx = -2; cxx < VW / pitchX + 2; cxx++) {
          var id = band * 977 + r * 131 + cxx * 7;
          var n = this.rnd(id);
          if (n < 0.12) continue;                 // an empty seat
          var sxp = Math.round(cxx * pitchX + this.rnd(id + 3) * 2);
          /* the sway: whole columns lean together, a beat apart, which
             is what a crowd actually looks like from this far away */
          var sway = Math.round(Math.sin(this.t * 2.1 + cxx * 0.45 + r) * 0.9);
          var col = CROWD[(this.rnd(id + 11) * CROWD.length) | 0];
          ctx.fillStyle = col;
          ctx.fillRect(sxp + sway, ry, 3, 2);
          ctx.fillStyle = "#1a1620";
          ctx.fillRect(sxp + sway, ry + 2, 3, 1);
        }
      }
      /* the rail at the front of the tier, and the shadow under it */
      ctx.fillStyle = C.rail;  ctx.fillRect(0, Math.max(0, y - 2), VW, 1);
      ctx.fillStyle = C.roof;  ctx.fillRect(0, Math.max(0, y - 1), VW, 1);
      y = top; band++;
    }

    /* the roof, and the strip of night above it */
    ctx.fillStyle = C.roof;
    ctx.fillRect(0, 0, VW, Math.max(0, y));
    ctx.fillStyle = C.wallLit;
    ctx.fillRect(0, Math.max(0, y - 1), VW, 1);

    /* THE ADVERTISING BOARDS, along the front of the stand. Blocks of
       flat colour with a lit lip: no words, because a word at this size
       is four grey pixels and reads as dirt. */
    ctx.fillStyle = C.board;
    ctx.fillRect(0, lip, VW, bh);
    for (var bx = 0; bx < VW; bx += 26) {
      var bn = this.rnd(bx * 13 + 5);
      ctx.fillStyle = bn > 0.55 ? "#a8283a" : (bn > 0.3 ? "#c8912f" : "#2f4f7a");
      ctx.fillRect(bx + 1, lip + 1, 23, bh - 2);
      ctx.fillStyle = C.boardLip;
      ctx.fillRect(bx + 1, lip, 23, 1);
    }
    /* the strip of shadow the boards throw onto the run-off */
    ctx.fillStyle = C.grassDk;
    ctx.fillRect(0, base, VW, 2);
  };

  /* ============================================================ THE GRASS
     Drawn row by row from the bottom of the screen up. Each screen row
     is a different depth, so the mowing bands are worked out per row and
     come out correctly foreshortened for nothing. */
  Pitch.prototype.drawGrass = function () {
    var ctx = this.ctx;
    var y0 = Math.max(0, Math.round(this.project(0, PITCH.len + 7).y) + 2);
    for (var y = y0; y < VH; y++) {
      var d = this.depthAtY(y + 0.5);
      if (d <= 0) continue;
      var wy = this.cam.y + d - NEAR;
      var bandI = Math.floor(wy / 9);
      var col = (bandI & 1) ? C.grassA : C.grassB;
      /* the far half of the pitch sits in the stand's shadow, which is
         the cheapest depth cue there is and the most convincing */
      if (wy > PITCH.len * 0.62) col = (bandI & 1) ? C.grassDk : C.grassA;
      ctx.fillStyle = col;
      ctx.fillRect(0, y, VW, 1);
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
    var hw = PITCH.halfW, L = PITCH.len;
    /* touchlines and goal lines */
    this.wline(-hw, 0, -hw, L);
    this.wline(hw, 0, hw, L);
    this.wline(-hw, 0, hw, 0);
    this.wline(-hw, L, hw, L);
    /* the halfway line and the centre circle */
    this.wline(-hw, L / 2, hw, L / 2);
    this.warc(0, L / 2, 14.3, 0, Math.PI * 2);
    this.ctx.fillStyle = C.line;
    var c = this.project(0, L / 2);
    this.ctx.fillRect(Math.round(c.x) - 1, Math.round(c.y), 2, 1);
    /* both penalty areas and both six-yard boxes */
    for (var e = 0; e < 2; e++) {
      var gl = e ? L : 0, s = e ? -1 : 1;
      this.wline(-31.5, gl, -31.5, gl + s * 26);
      this.wline(31.5, gl, 31.5, gl + s * 26);
      this.wline(-31.5, gl + s * 26, 31.5, gl + s * 26);
      this.wline(-14.3, gl, -14.3, gl + s * 8.6);
      this.wline(14.3, gl, 14.3, gl + s * 8.6);
      this.wline(-14.3, gl + s * 8.6, 14.3, gl + s * 8.6);
      var sp = this.project(0, gl + s * 17);
      this.ctx.fillStyle = C.line;
      this.ctx.fillRect(Math.round(sp.x), Math.round(sp.y), 1, 1);
      this.warc(0, gl + s * 17, 14.3, s > 0 ? 0.35 : Math.PI + 0.35,
                s > 0 ? Math.PI - 0.35 : Math.PI * 2 - 0.35);
    }
    /* corner arcs */
    this.warc(-hw, 0, 3, 0, Math.PI / 2);
    this.warc(hw, 0, 3, Math.PI / 2, Math.PI);
    this.warc(-hw, L, 3, -Math.PI / 2, 0);
    this.warc(hw, L, 3, Math.PI, Math.PI * 1.5);
  };

  /* --------------------------------------------------------- the goals
     A frame, and a net made of a one-pixel lattice rather than a grey
     wash: the lattice is what says "net" at this size. */
  Pitch.prototype.drawGoal = function (far) {
    var ctx = this.ctx;
    var gl = far ? PITCH.len : 0;
    var s = far ? 1 : -1;
    var p = this.project(0, gl);
    /* a goal is 7.32 metres across and 2.44 high — 11.4 units by 3.8.
       Its height on screen is a HORIZONTAL measure (it stands up out of
       the ground plane), so it scales with k, not with ky. */
    var hgt = Math.max(4, Math.round(p.k * 3.8));      // crossbar height
    var half = 5.7;
    var lp = this.project(-half, gl), rp = this.project(half, gl);
    var lb = this.project(-half, gl + s * 3), rb = this.project(half, gl + s * 3);
    var bh = Math.max(3, Math.round(this.project(0, gl + s * 3).k * 3));

    /* the netting: a lattice inside the mouth, dark where it crosses the
       grass and light where it crosses the stand */
    /* a lattice, not a fill: at three pixels the mesh closed up and the
       mouth of the goal read as a solid white box */
    for (var x = Math.round(lp.x); x <= Math.round(rp.x); x += 4) {
      for (var y = Math.round(lp.y) - hgt; y < Math.round(lp.y); y += 4) {
        px(ctx, x, y, C.net);
        px(ctx, x + 2, y + 2, C.postDk);
      }
    }
    /* the back of the net, set behind the line and a little lower */
    ctx.fillStyle = C.postDk;
    ctx.fillRect(Math.round(lb.x), Math.round(lb.y) - bh,
                 Math.round(rb.x - lb.x) + 1, 1);

    /* posts and crossbar last, so nothing crosses them */
    ctx.fillStyle = C.post;
    ctx.fillRect(Math.round(lp.x) - 1, Math.round(lp.y) - hgt, 2, hgt);
    ctx.fillRect(Math.round(rp.x), Math.round(rp.y) - hgt, 2, hgt);
    ctx.fillRect(Math.round(lp.x) - 1, Math.round(lp.y) - hgt,
                 Math.round(rp.x - lp.x) + 3, 2);
  };

  /* ====================================================== WHAT STANDS ON IT */

  /* Part 1.7: the shadow is an ellipse on the ground, and it SHRINKS and
     darkens towards a point as the character rises. A shadow that stays
     the same size while its owner jumps nails them to the turf. */
  Pitch.prototype.shadow = function (wx, wy, r, air) {
    var p = this.project(wx, wy);
    var f = 1 - Math.min(0.55, (air || 0) * 0.07);
    fillEllipse(this.ctx, p.x, p.y - 1, Math.max(2, p.k * r * f),
                Math.max(1, p.ky * r * f * 1.8), C.shadow);
  };

  /* the ring under whoever the player is driving. It is a projected
     annulus with a gap that rotates, so it reads as a live marker rather
     than a decal, and it is drawn in the trophy gold so it never gets
     lost against the kit colours. */
  Pitch.prototype.ring = function (wx, wy, phase) {
    var ctx = this.ctx, n = 96;
    for (var i = 0; i < n; i++) {
      var a = (i / n) * Math.PI * 2;
      var g = ((i / n) + (phase || 0)) % 1;
      if (g < 0.07 || (g > 0.5 && g < 0.57)) continue;   // two rotating gaps
      var r = 1.7;
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
    var S = at.size;
    /* the cell's ground line is where the boots are, so that is what
       lands on the projected point rather than the bottom of the cell */
    var dx = Math.round(p.x - S / 2);
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

  /* the ball: three tones and a hard edge, never a gradient */
  Pitch.prototype.ball = function (wx, wy, h) {
    var p = this.project(wx, wy);
    var r = 3;
    var by = p.y - (h || 0) - r;
    fillEllipse(this.ctx, p.x, by, r, r, "#f4f4e8");
    fillEllipse(this.ctx, p.x + 1, by + 1, r - 1, r - 1, "#cfd2c4");
    px(this.ctx, p.x - 1, by - 1, "#ffffff");
    px(this.ctx, p.x, by, "#3a3f38");
    px(this.ctx, p.x - 2, by + 1, "#3a3f38");
    px(this.ctx, p.x + 2, by - 1, "#3a3f38");
  };

  /* ------------------------------------------------------------- a frame */
  Pitch.prototype.begin = function (dt) {
    this.t += dt || 0;
    this.drawStand();
    this.drawGrass();
    this.drawMarkings();
    this.drawGoal(true);
    this.drawGoal(false);
  };

  /* PART 8's VIGNETTE, done without a gradient: two rings of dimmed
     corners at fixed strengths. A CSS gradient over a pixel scene is the
     exact mismatch the whole rebuild is about. */
  Pitch.prototype.finish = function () {
    var ctx = this.ctx;
    ctx.globalAlpha = 0.18; ctx.fillStyle = "#0a0812";
    for (var i = 0; i < 3; i++) {
      var w = 6 + i * 5;
      ctx.fillRect(0, 0, w, VH); ctx.fillRect(VW - w, 0, w, VH);
      ctx.fillRect(0, 0, VW, w * 0.6); ctx.fillRect(0, VH - w * 0.6, VW, w);
    }
    ctx.globalAlpha = 1;
  };

  /* blit the virtual screen onto the real one at a WHOLE number of
     pixels per pixel, centred, with the letterbox in the stand colour */
  Pitch.prototype.present = function () {
    var d = this.display, c = d.getContext("2d");
    var s = Math.max(1, Math.floor(Math.min(d.width / VW, d.height / VH)));
    c.imageSmoothingEnabled = false;
    c.fillStyle = C.roof;
    c.fillRect(0, 0, d.width, d.height);
    var w = VW * s, h = VH * s;
    c.drawImage(this.buf, ((d.width - w) / 2) | 0, ((d.height - h) / 2) | 0, w, h);
  };

  return {
    create: function (display) { return new Pitch(display); },
    VW: VW, VH: VH, PITCH: PITCH, COLOURS: C,
  };
})();
