/* =========================================================================
   OUISSY'S CUP — THE CHARACTER SPRITES

   WHY THIS FILE EXISTS

   The players were low-poly figures built out of capsules and spheres. At
   match distance that reads as "some 3D people", which is the one thing a
   site made entirely of pixel art should never contain. They are pixel
   sprites now — drawn, shaded and outlined here, then stood up on the 3D
   pitch as camera-facing billboards, so the chapter keeps its camera,
   its depth and its venues and gains characters you can actually tell
   apart.

   ---------------------------------------------------------------------
   THE HONEST CONSTRAINT, AND WHAT IT FORCED

   Hand-drawn sheets are not available to this repository. The rule the
   whole site is built on is that there is not an image file in it —
   every sprite in every chapter is made at runtime. A hand-authored
   roster at the size asked for is about two thousand frames (fourteen
   characters, five unique facings, six animations), which is neither
   something that can be drawn into source nor something that would fit
   in a page load if it were.

   So this is a SPRITE COMPOSITOR: a small pixel-art program that draws
   one chibi footballer from a description — build, head, hair, skin,
   kit, accessories — and can therefore draw fourteen of them, from the
   same roster entries the game already uses. Every frame is rasterised
   by hand into an index buffer, never by the browser, because anything
   the browser draws it also antialiases, and one soft edge anywhere
   gives the whole thing away.

   WHAT THAT BUYS, AND WHAT IT COSTS

   Buys: fourteen characters in one consistent hand, every animation in
   every facing, palette clamped by construction, nothing to download,
   and a character whose silhouette can be changed by editing a number
   in cup.config.js.

   Costs: it is a drawing program, not an artist. The poses are built out
   of sine curves and offsets rather than felt frame by frame, so the run
   has a good bounce and will never have the tiny deliberate imperfection
   a person would put in it.

   ---------------------------------------------------------------------
   HOW A FRAME IS MADE

     1. an index buffer, one byte per pixel, zero meaning nothing
     2. body parts rasterised into it as flat colour FAMILIES
     3. a cel pass: one light direction, top-left. A pixel of a family
        whose up-left neighbour is empty becomes that family's highlight;
        one whose down-right neighbour is empty becomes its shadow
     4. an outline pass: empty pixels touching the figure take the dark
        tone of whatever they are touching — so the outline is a darker
        version of the colour beside it and never a black keyline
     5. a rim pass: outline pixels along the top-right edge take a cool
        bright tone, which is the back light that lifts a figure off a
        crowd

   INDEXES, NOT COLOURS, the whole way through: it makes every pass a
   comparison rather than a colour distance, and it makes the palette
   clamp a property of the file rather than a step at the end.
   ========================================================================= */

window.CupSprites = (function () {
  "use strict";

  /* One frame is 48 by 48. Big enough that a face is a face at the
     distance this is played from, small enough that a whole roster of
     atlases does not become the largest thing on the page. */
  var S = 48;

  /* Where the figure sits inside the frame. `ground` is the line the
     boots stand on, which is also the point the billboard is pinned to
     the pitch at, so a character never floats or sinks. */
  var GROUND = 44;

  /* ------------------------------------------------------------ colour */
  function rgb(hex) {
    var n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function hex(c) {
    return "#" + ((1 << 24) + (c[0] << 16) + (c[1] << 8) + c[2]).toString(16).slice(1);
  }
  /* Shading by a fixed step and a slight hue push rather than by a
     percentage: multiplying a dark colour by 0.8 is no visible change,
     and real pixel art warms its highlights and cools its shadows. */
  function tone(h, amt, warm) {
    var c = rgb(h);
    var w = warm || 0;
    return hex([
      clamp8(c[0] + amt + w * 6),
      clamp8(c[1] + amt + w * 2),
      clamp8(c[2] + amt - w * 8),
    ]);
  }
  function clamp8(v) { return v < 0 ? 0 : v > 255 ? 255 : Math.round(v); }

  /* --------------------------------------------------------- the sheet
     An index buffer and the smallest set of rasterising primitives that
     can draw a person. Every one of them is a loop over integer pixels:
     there is no path, no stroke and no fill in here, because the moment
     the browser draws a shape it also feathers its edge. */
  function Sheet(w, h) {
    this.w = w; this.h = h;
    this.d = new Uint8Array(w * h);
  }
  Sheet.prototype.px = function (x, y, i) {
    x |= 0; y |= 0;
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    this.d[y * this.w + x] = i;
  };
  Sheet.prototype.at = function (x, y) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return 0;
    return this.d[y * this.w + x];
  };
  Sheet.prototype.rect = function (x, y, w, h, i) {
    for (var yy = 0; yy < h; yy++) {
      for (var xx = 0; xx < w; xx++) this.px(x + xx, y + yy, i);
    }
  };
  /* A filled ellipse by the midpoint test, which gives the same chunky
     stepped edge a person drawing one by hand would produce. */
  Sheet.prototype.ellipse = function (cx, cy, rx, ry, i) {
    for (var yy = -ry; yy <= ry; yy++) {
      for (var xx = -rx; xx <= rx; xx++) {
        var a = (xx + 0.5) / (rx + 0.5), b = (yy + 0.5) / (ry + 0.5);
        if (a * a + b * b <= 1) this.px(cx + xx, cy + yy, i);
      }
    }
  };
  /* a capsule: the shape every limb in here actually is */
  Sheet.prototype.limb = function (x0, y0, x1, y1, r, i) {
    var steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) + 1;
    for (var s = 0; s <= steps; s++) {
      var t = s / steps;
      this.ellipse(Math.round(x0 + (x1 - x0) * t),
                   Math.round(y0 + (y1 - y0) * t), r, r, i);
    }
  };

  /* ------------------------------------------------------- the palette
     A character is at most five colour FAMILIES and each family is four
     indexes: dark (its own outline), shadow, base, light. Twenty-one
     slots including the empty one, which is the "max about five colours
     per character" rule made structural rather than remembered. */
  function Palette() {
    this.cols = ["#000000"];        // index 0 is never drawn
    this.fam = {};
  }
  Palette.prototype.family = function (name, base, opts) {
    opts = opts || {};
    var i = this.cols.length;
    this.cols.push(tone(base, opts.darkAmt === undefined ? -78 : opts.darkAmt, -1));
    this.cols.push(tone(base, -34, -1));
    this.cols.push(base);
    this.cols.push(tone(base, opts.liteAmt === undefined ? 30 : opts.liteAmt, 1));
    this.fam[name] = { dark: i, shadow: i + 1, base: i + 2, light: i + 3 };
    return this.fam[name];
  };
  /* one flat index that takes no shading at all — eyes, the ball, a
     charm — because a two-pixel eye with a highlight on it is mush */
  Palette.prototype.flat = function (name, col) {
    var i = this.cols.length;
    this.cols.push(col);
    this.fam[name] = { dark: i, shadow: i, base: i, light: i, flat: true };
    return this.fam[name];
  };

  /* =======================================================================
     THE PASSES
     ======================================================================= */

  /* Cel shading: one light, from the top left. A family pixel with
     nothing above-left of it catches the light; one with nothing
     below-right of it falls into shadow. Two tones and a hard border
     between them, which is what cel means. */
  function celPass(sh, pal, famIdx) {
    var out = new Uint8Array(sh.d);
    for (var y = 0; y < sh.h; y++) {
      for (var x = 0; x < sh.w; x++) {
        var i = sh.at(x, y);
        var f = famIdx[i];
        if (!f || f.flat || i !== f.base) continue;
        var upLeft = sh.at(x - 1, y - 1) === 0 || sh.at(x, y - 1) === 0;
        var downRight = sh.at(x + 1, y + 1) === 0 || sh.at(x, y + 1) === 0;
        if (upLeft) out[y * sh.w + x] = f.light;
        else if (downRight) out[y * sh.w + x] = f.shadow;
      }
    }
    sh.d = out;
  }

  /* The outline takes the dark tone of whatever it is drawn against, so
     a figure is bounded by a darker version of its own colours rather
     than by one black line laid over everything. */
  function outlinePass(sh, famIdx) {
    var out = new Uint8Array(sh.d);
    for (var y = 0; y < sh.h; y++) {
      for (var x = 0; x < sh.w; x++) {
        if (sh.at(x, y) !== 0) continue;
        var n = sh.at(x, y - 1) || sh.at(x, y + 1) || sh.at(x - 1, y) || sh.at(x + 1, y);
        if (!n) continue;
        var f = famIdx[n];
        out[y * sh.w + x] = f ? f.dark : n;
      }
    }
    sh.d = out;
  }

  /* The back light. Outline pixels along the top and right take a cool
     bright tone — the one thing that stops a figure sinking into a
     crowd the same brightness as it is. */
  function rimPass(sh, famIdx, rimIdx) {
    var out = new Uint8Array(sh.d);
    for (var y = 0; y < sh.h; y++) {
      for (var x = 0; x < sh.w; x++) {
        var i = sh.at(x, y);
        if (!i) continue;
        var f = famIdx[i];
        if (!f || i !== f.dark) continue;          // outline pixels only
        /* The right-hand edge only, and only where there is solid
           figure immediately inside it. Without that second test every
           loose strand of hair got a bright streak down it and the back
           light read as a drawing error rather than as light. */
        if (sh.at(x + 1, y) !== 0 || sh.at(x + 1, y - 1) !== 0) continue;
        var inward = sh.at(x - 1, y);
        var g2 = famIdx[inward];
        if (!g2 || inward === g2.dark) continue;
        out[y * sh.w + x] = rimIdx;
      }
    }
    sh.d = out;
  }

  /* =======================================================================
     THE FIGURE

     Two and a bit heads tall. Everything below is expressed against
     GROUND so a taller or wider character grows from the boots up rather
     than drifting off the bottom of the frame.
     ======================================================================= */

  /* How far round the character is turned, and whether we are behind
     them. Five unique facings are drawn; the other three are the mirror
     of three of these and are flipped when they are put on the pitch. */
  var FACING = [
    { id: "s",  turn: 0.0, back: false },
    { id: "se", turn: 0.5, back: false },
    { id: "e",  turn: 1.0, back: false },
    { id: "ne", turn: 0.5, back: true },
    { id: "n",  turn: 0.0, back: true },
  ];

  /* The poses. Everything a limb does is an offset in pixels, worked out
     from the frame number — a run is a pair of sine curves a half cycle
     apart and a bob at twice the rate, which is the whole of a cartoon
     run cycle. */
  function pose(anim, f, n) {
    var p = { bob: 0, lean: 0, squash: 0, headBob: 0,
              legA: [0, 0], legB: [0, 0], armA: [0, 0], armB: [0, 0],
              blink: false, armLift: 0 };
    var t = n > 1 ? f / n : 0;
    var ph = t * Math.PI * 2;

    if (anim === "idle") {
      p.bob = Math.round(Math.sin(ph) * 0.9);
      p.headBob = p.bob > 0 ? 1 : 0;
      p.armA = [0, Math.round(Math.sin(ph) * 0.8)];
      p.armB = [0, Math.round(Math.sin(ph) * 0.8)];
      p.blink = f === 2;

    } else if (anim === "run") {
      var sw = Math.sin(ph);
      var sw2 = Math.sin(ph + Math.PI);
      /* the legs swing, and the foot that is down plants hard */
      p.legA = [Math.round(sw * 5), Math.round(-Math.abs(sw) * 2.4)];
      p.legB = [Math.round(sw2 * 5), Math.round(-Math.abs(sw2) * 2.4)];
      /* the arms pump against them */
      p.armA = [Math.round(sw2 * 3.4), Math.round(-Math.abs(sw2) * 1.6)];
      p.armB = [Math.round(sw * 3.4), Math.round(-Math.abs(sw) * 1.6)];
      /* up on the stride, down on the plant, twice a cycle */
      p.bob = -Math.round(Math.abs(Math.cos(ph)) * 3.2) + 1;
      p.squash = Math.abs(Math.cos(ph)) > 0.86 ? 1 : 0;
      p.lean = 1;

    } else if (anim === "kick") {
      /* ANTICIPATION, STRIKE, FOLLOW-THROUGH. The leg goes back further
         than it goes forward, because a kick that starts at the moment
         of contact has no weight in it at all. */
      var k = n > 1 ? f / (n - 1) : 0;
      if (k < 0.34) {                       // wind up
        var a = k / 0.34;
        p.legA = [Math.round(-a * 6), Math.round(-a * 2)];
        p.armB = [Math.round(a * 3), -1];
        p.lean = -1;
        p.bob = 0;
      } else if (k < 0.55) {                // plant and swing through
        var b2 = (k - 0.34) / 0.21;
        p.legA = [Math.round(-6 + b2 * 12), Math.round(-2 - b2 * 1)];
        p.armB = [Math.round(3 - b2 * 5), -1];
        p.lean = Math.round(b2 * 2);
        p.bob = -1;
      } else {                              // follow through
        var c2 = (k - 0.55) / 0.45;
        p.legA = [Math.round(6 - c2 * 2), Math.round(-3 + c2 * 2)];
        p.armB = [Math.round(-2 + c2 * 2), -1];
        p.lean = 2;
        p.bob = 0;
      }
      p.armA = [-2, 0];

    } else if (anim === "tackle") {
      var s2 = n > 1 ? f / (n - 1) : 0;
      p.bob = Math.round(6 + s2 * 3);       // down on the grass
      p.lean = Math.round(2 + s2 * 3);
      p.legA = [Math.round(4 + s2 * 4), 2];
      p.legB = [Math.round(-2 - s2), 1];
      p.armA = [-3, -2]; p.armB = [3, -2];

    } else if (anim === "cheer") {
      var c3 = Math.sin(t * Math.PI * 2);
      p.bob = -Math.round(Math.max(0, c3) * 4);
      p.armLift = 1;
      p.armA = [-2, -7]; p.armB = [2, -7];
      p.legA = [-1, 0]; p.legB = [1, 0];

    } else if (anim === "sad") {
      p.bob = Math.round(Math.sin(ph) * 0.6) + 1;
      p.headBob = 2;
      p.armA = [1, 1]; p.armB = [-1, 1];

    } else if (anim === "dive") {
      var d2 = n > 1 ? f / (n - 1) : 0;
      p.bob = Math.round(-2 - d2 * 5);
      p.lean = Math.round(d2 * 7);
      p.armA = [Math.round(-2 - d2 * 5), Math.round(-4 - d2 * 3)];
      p.armB = [Math.round(2 + d2 * 7), Math.round(-4 - d2 * 3)];
      p.legA = [Math.round(-d2 * 5), 1]; p.legB = [Math.round(-d2 * 3), 0];

    } else if (anim === "ready") {           // the keeper, set
      p.bob = 1;
      p.armA = [-3, -2]; p.armB = [3, -2];
      p.legA = [-2, 0]; p.legB = [2, 0];
    }
    return p;
  }

  /* ---------------------------------------------------------- the head

     PROPORTION FIRST. The first attempt hung the head off the shoulders
     and grew it with the body, which produced a figure about one and a
     half heads tall with its legs buried under its shirt. The head is
     pinned near the TOP of the frame at a near-constant size now and
     everything else is measured down from it, so a short character is a
     big head on a short body — which is what chibi is — and a tall one
     is the same head with more leg.

     The hair is built as a half-dome that follows the skull rather than
     a rectangle sitting on it: draw the face, then lay the cap over the
     rows above the fringe line. A rectangle was the single thing making
     every character look like a peg doll. */
  function capDome(sh, cx, cy, r, fringeY, i, grow) {
    var rx = r + (grow || 0), ry = r + (grow || 0);
    for (var yy = -ry; yy <= ry; yy++) {
      if (cy + yy > fringeY) break;
      for (var xx = -rx; xx <= rx; xx++) {
        var a = (xx + 0.5) / (rx + 0.5), b = (yy + 0.5) / (ry + 0.5);
        if (a * a + b * b <= 1) sh.px(cx + xx, cy + yy, i);
      }
    }
  }

  /* what falls BEHIND the shoulders — drawn before the body, which is
     the only way long hair reads as long rather than as a bib */
  function drawBackHair(sh, L, P, cx, cy, r, face) {
    var hair = P.fam.hair;
    var k = L.head;
    if (k === "ouissy") {
      /* Hers, and it has to be hers: long, past the shoulders, stepping
         a pixel in and out as it falls so it waves rather than hangs —
         the same hair she has in every other chapter on this site. */
      for (var s2 = -1; s2 <= 1; s2 += 2) {
        for (var yy = 0; yy < 17; yy++) {
          var wob = ((yy + 2) >> 2) % 2 ? 1 : 0;
          var w = yy < 5 ? 4 : 3;
          var x0 = cx + s2 * (r - 1) + s2 * wob - (s2 > 0 ? 0 : w - 1);
          sh.rect(x0, cy - 3 + yy, w, 1, hair.base);
        }
      }
      /* and a mass of it across the back of the shoulders */
      sh.ellipse(cx, cy + 5, r, 5, hair.base);
    } else if (k === "willow") {
      for (var s3 = -1; s3 <= 1; s3 += 2) {
        for (var y3 = 0; y3 < 11; y3++) {
          sh.rect(cx + s3 * (r - 1) - (s3 > 0 ? 0 : 1), cy - 1 + y3, 2, 1, hair.base);
        }
      }
    } else if (k === "pony") {
      var px2 = face.back ? cx - 1 : cx + (face.turn > 0.6 ? -r - 2 : r - 1);
      for (var y4 = 0; y4 < 12; y4++) {
        sh.rect(px2, cy - 2 + y4 + (y4 > 6 ? 1 : 0), 3, 1, hair.base);
      }
    } else if (k === "bun") {
      sh.ellipse(cx + (face.back ? 0 : -r - 1), cy - r + 1, 3, 3, hair.base);
    }
  }

  function drawHead(sh, L, P, cx, cy, r, face) {
    var skin = P.fam.skin, hair = P.fam.hair;
    var turn = face.turn, back = face.back;
    var off = Math.round(turn * 2.5);          // the face slides round
    var k = L.head;

    /* the skull */
    sh.ellipse(cx, cy, r, r, skin.base);

    /* the fringe line: how much of the face the hair comes down over */
    var fringeY = cy - Math.round(r * 0.25);

    if (k === "flame") {
      capDome(sh, cx, cy - 1, r, fringeY, hair.base, 0);
      /* five spikes of different heights leaning back: the only head in
         the game with a jagged top edge */
      [[-4, 5], [-2, 7], [0, 8], [2, 6], [4, 4]].forEach(function (f2) {
        for (var i = 0; i < f2[1]; i++) {
          sh.rect(cx + f2[0] - 1 + (i >> 1), cy - r - i + 1, 2, 1, hair.base);
        }
      });
    } else if (k === "anwar") {
      capDome(sh, cx, cy - 1, r, fringeY, hair.base, 0);
      /* curls round the crown, so the silhouette is bumpy not smooth */
      for (var a = 0; a <= 8; a++) {
        var ang = -Math.PI - 0.2 + a * (Math.PI / 8.4);
        sh.ellipse(cx + Math.round(Math.cos(ang) * (r - 0.5)),
                   cy + Math.round(Math.sin(ang) * (r - 0.5)) - 1, 2, 2, hair.base);
      }
    } else if (k === "goggles") {
      capDome(sh, cx, cy - 1, r, fringeY, hair.base, 0);
    } else if (k === "flat" || k === "cap") {
      capDome(sh, cx, cy - 1, r, fringeY, hair.base, 0);
    } else {
      capDome(sh, cx, cy - 1, r, fringeY, hair.base, 0);
    }

    /* things that sit ON the head, after the hair */
    if (k === "goggles") {
      sh.rect(cx - r, cy - r + 2, r * 2 + 1, 2, P.fam.trim.dark);
      if (!back) {
        sh.ellipse(cx - 3 + off, cy - r + 3, 2, 1, P.fam.trim.light);
        sh.ellipse(cx + 3 + off, cy - r + 3, 2, 1, P.fam.trim.light);
      }
    } else if (k === "flat" || k === "cap") {
      sh.rect(cx - r - 1, cy - r + 1, r * 2 + 3, 2, P.fam.trim.base);
      if (!back) sh.rect(cx - r + off, cy - r + 3, r + 2, 1, P.fam.trim.dark);
    } else if (k === "sprig") {
      sh.rect(cx + 1, cy - r - 3, 1, 4, P.fam.trim.dark);
      sh.ellipse(cx + 3, cy - r - 3, 2, 1, P.fam.trim.base);
      sh.ellipse(cx, cy - r - 4, 1, 1, P.fam.trim.base);
    } else if (k === "phones") {
      sh.rect(cx - r - 2, cy - 2, 2, 5, P.fam.trim.base);
      sh.rect(cx + r + 1, cy - 2, 2, 5, P.fam.trim.base);
      sh.rect(cx - r - 1, cy - r - 1, r * 2 + 3, 2, P.fam.trim.dark);
    } else if (k === "pads") {
      sh.rect(cx - r - 2, cy + r - 1, r * 2 + 5, 3, P.fam.trim.base);
    }

    /* HER FRINGE, and the shine that says blonde. Only from the front:
       a parting drawn on the back of a head is a mistake you can see
       from the other side of the room. */
    if (k === "ouissy" && !back) {
      sh.rect(cx - 2 + off, cy - r, 3, 4, hair.shadow);
      sh.rect(cx - r + 2 + off, cy - r + 1, 3, 1, hair.light);
    }

    /* THE FACE. Never drawn from behind. */
    if (back) return;
    var eyeY = cy + 1;
    var eyes = P.fam.eye;
    if (turn >= 1) {
      /* in profile there is one eye and a nose, and that is the entire
         difference between a profile and a front view turned sideways */
      sh.rect(cx + 2 + off, eyeY - 1, 2, 3, eyes.base);
      if (!face.blink) sh.px(cx + 2 + off, eyeY - 1, P.fam.white.base);
      else sh.rect(cx + 2 + off, eyeY, 2, 1, eyes.base);
      sh.px(cx + r - 1, eyeY + 1, skin.light);
      sh.rect(cx + 2 + off, cy + 4, 2, 1, P.fam.mouth.base);
      if (L.blush) sh.rect(cx + off, eyeY + 3, 2, 1, P.fam.blush.base);
      return;
    }
    var ex = 2;
    if (face.blink) {
      sh.rect(cx - ex - 1 + off, eyeY, 3, 1, eyes.base);
      sh.rect(cx + ex + off, eyeY, 3, 1, eyes.base);
    } else {
      sh.rect(cx - ex - 1 + off, eyeY - 1, 2, 3, eyes.base);
      sh.rect(cx + ex + off, eyeY - 1, 2, 3, eyes.base);
      /* one lit pixel in each, which is the whole of the life in a
         pixel face */
      sh.px(cx - ex - 1 + off, eyeY - 1, P.fam.white.base);
      sh.px(cx + ex + off, eyeY - 1, P.fam.white.base);
    }
    if (L.blush) {
      sh.rect(cx - ex - 2 + off, eyeY + 2, 2, 1, P.fam.blush.base);
      sh.rect(cx + ex + 1 + off, eyeY + 2, 2, 1, P.fam.blush.base);
    }
    sh.rect(cx - 1 + off, cy + 4, 3, 1, P.fam.mouth.base);
  }

  /* ------------------------------------------------------------- a frame */
  function drawFrame(L, P, face, anim, f, n) {
    var sh = new Sheet(S, S);
    var p = pose(anim, f, n);
    face = { turn: face.turn, back: face.back, blink: p.blink };

    var bw = (L.build && L.build.w) || 1;
    var bh = (L.build && L.build.h) || 1;
    var cx = (S >> 1) + p.lean;
    var g = GROUND + p.bob;

    /* MEASURED DOWN FROM THE HEAD. Two and a half heads tall at an
       average build; a short character is the same head on less body. */
    /* TWO AND A HALF HEADS, MEASURED ON THE HAIR.

       At radius 8 in a 40-tall figure the skull alone was two and a half
       heads — but a skull is not a head, and once the hair went on top
       the visible block was half the character. The rule has to be
       applied to what you can SEE, so the skull came down and the figure
       went up. */
    var headR = Math.round(6.6 * (0.92 + bw * 0.08));
    var totalH = Math.round(42 * bh);
    var headCy = g - totalH + headR + p.headBob;
    var shoulderY = headCy + headR - 1;
    var bodyH = Math.round(12.5 * bh);
    var hipY = shoulderY + bodyH;

    /* in profile the body is narrower — the cheapest and most effective
       thing a billboard can do to say it has turned */
    var bodyW = Math.max(3, Math.round(6.5 * bw * (1 - face.turn * 0.26)));
    /* a three-quarter view is offset as well as narrowed, which is what
       stops "ne" and "n" being the same picture */
    if (face.turn > 0.2 && face.turn < 0.9) cx += face.back ? -1 : 1;

    var kit = P.fam.shirt, sock = P.fam.sock, boot = P.fam.boot, shortF = P.fam.short;

    drawBackHair(sh, L, P, cx, headCy, headR, face);

    /* legs. The far one first so the near one overlaps it, which is the
       only depth cue a flat sprite gets for free. */
    var leg = function (o, near) {
      var hx = cx + (near ? 1 : -1) * Math.round(bodyW * 0.42);
      /* The swing is NOT mirrored per leg. legA and legB are already a
         half cycle apart; flipping the far one's sign as well put them
         back in phase, so the run cycle was both feet going the same
         way at once — a hop, not a run. */
      var fx = cx + o[0];
      var fy = g + o[1];
      sh.limb(hx, hipY, fx, fy - 3, Math.max(1, Math.round(1.7 * bw)),
              near ? sock.base : sock.shadow);
      sh.ellipse(fx, fy - 1, Math.round(2.5 * bw), 2, near ? boot.base : boot.shadow);
    };
    leg(p.legB, false);
    leg(p.legA, true);

    /* the body */
    sh.ellipse(cx, shoulderY + Math.round(bodyH / 2), bodyW,
               Math.round(bodyH / 2) + 1, kit.base);
    sh.rect(cx - bodyW, shoulderY + 1, bodyW * 2 + 1, bodyH - 1, kit.base);
    /* THE SHORTS GO ON AFTER THE SHIRT. Painted first, the body ellipse
       drawn over them swallowed the lot, and a red shirt above red
       socks with nothing between them is one red column with a face on
       top — which is exactly what the first sheet looked like. */
    sh.rect(cx - bodyW, hipY - 4, bodyW * 2 + 1, 6, shortF.base);
    if (face.back) sh.rect(cx - 2, shoulderY + 4, 4, 5, P.fam.trim.base);

    /* arms — and in profile there is only one of them */
    /* An arm has to sit OUTSIDE the body's silhouette or it is not an
       arm, it is a stripe on a shirt. They start a pixel clear of the
       shoulder and the hand is drawn in skin at the end of a short
       sleeve, which is what makes the limb legible at this size. */
    var arm = function (side, o, near) {
      var sx = cx + side * (bodyW + 2);
      var hx = sx + o[0], hy = shoulderY + Math.round(bodyH * 0.72) + o[1];
      var c = near ? kit.base : kit.shadow;
      var rr = Math.max(1, Math.round(1.7 * bw));
      sh.limb(sx, shoulderY + 3, hx, hy - 2, rr, c);
      sh.ellipse(hx, hy, rr, rr, near ? P.fam.skin.base : P.fam.skin.shadow);
    };
    if (face.turn < 0.9) arm(-1, p.armA, false);
    arm(1, p.armB, true);

    if (L.armband) sh.rect(cx - bodyW - 1, shoulderY + 3, 3, 2, P.fam.band.base);

    drawHead(sh, L, P, cx, headCy, headR, face);

    /* a small emblem on the chest: the one piece of a kit that is about
       the person wearing it rather than the team */
    if (L.emblem === "heart" && !face.back && bodyW >= 5) {
      var ey = shoulderY + 4;
      sh.rect(cx - 2, ey, 2, 2, P.fam.band.base);
      sh.rect(cx + 1, ey, 2, 2, P.fam.band.base);
      sh.rect(cx - 2, ey + 1, 5, 2, P.fam.band.base);
      sh.rect(cx - 1, ey + 3, 3, 1, P.fam.band.base);
      sh.px(cx, ey + 4, P.fam.band.base);
    }

    if (p.squash) squashRow(sh, shoulderY + Math.round(bodyH / 2));
    return sh;
  }

  /* take one row out and pull everything below it up a pixel */
  function squashRow(sh, y) {
    for (var yy = y; yy < sh.h - 1; yy++) {
      for (var x = 0; x < sh.w; x++) {
        sh.d[yy * sh.w + x] = sh.d[(yy + 1) * sh.w + x];
      }
    }
  }

  /* =======================================================================
     BAKING

     Every frame of every facing into one canvas, once, with the passes
     run over each. The canvas goes to three.js as a texture with
     nearest filtering, and a billboard picks its frame by moving its UV
     window — so an animating character costs two numbers a frame and no
     new geometry.
     ======================================================================= */
  var ANIMS = [
    { id: "idle",   n: 4 },
    { id: "run",    n: 8 },
    { id: "kick",   n: 6 },
    { id: "tackle", n: 4 },
    { id: "cheer",  n: 6 },
    { id: "sad",    n: 2 },
    { id: "dive",   n: 4 },
    { id: "ready",  n: 2 },
  ];

  function paletteFor(L, kit) {
    var P = new Palette();
    P.family("skin", L.skin || "#f0cfae");
    P.family("hair", L.hair || "#4a2f1c");
    P.family("shirt", (kit && kit.shirt) || "#c1272d");
    P.family("short", (kit && kit.shorts) || "#f6efdd");
    P.family("sock", (kit && kit.socks) || "#c1272d");
    P.family("boot", "#2a2430");
    P.family("trim", (kit && kit.trim) || "#e8b23c");
    P.family("band", (L.super && L.super.colour) || "#ff5f8f");
    P.flat("eye", L.eye || "#3d2340");
    P.flat("white", "#fffdf8");
    P.flat("mouth", "#8a3b44");
    P.flat("blush", "#ff8fae");
    /* the rim: one cool bright tone shared by the whole figure, because
       a back light is one light and not one per material */
    P.flat("rim", "#a9d9f2");
    return P;
  }

  /* index -> family, so the passes can ask what a pixel belongs to */
  function famIndex(P) {
    var m = {};
    Object.keys(P.fam).forEach(function (k) {
      var f = P.fam[k];
      m[f.dark] = f; m[f.shadow] = f; m[f.base] = f; m[f.light] = f;
    });
    return m;
  }

  function bake(L, kit) {
    var P = paletteFor(L, kit);
    var fi = famIndex(P);
    var rim = P.fam.rim.base;

    var frames = [];
    ANIMS.forEach(function (a) {
      FACING.forEach(function (face) {
        for (var f = 0; f < a.n; f++) {
          frames.push({ key: a.id + ":" + face.id + ":" + f, a: a.id,
                        face: face.id, f: f, L: L, P: P, face3: face });
        }
      });
    });

    var cols = 10;
    var rows = Math.ceil(frames.length / cols);
    var cv = document.createElement("canvas");
    cv.width = cols * S; cv.height = rows * S;
    var ctx = cv.getContext("2d");
    var img = ctx.createImageData(S, S);

    var map = {};
    frames.forEach(function (fr, i) {
      var sh = drawFrame(fr.L, fr.P, fr.face3, fr.a, fr.f,
                         ANIMS.filter(function (x) { return x.id === fr.a; })[0].n);
      celPass(sh, fr.P, fi);
      outlinePass(sh, fi);
      rimPass(sh, fi, rim);

      var d = img.data;
      for (var q = 0; q < S * S; q++) {
        var idx = sh.d[q];
        if (!idx) { d[q * 4 + 3] = 0; continue; }
        var c = rgb(fr.P.cols[idx]);
        d[q * 4] = c[0]; d[q * 4 + 1] = c[1]; d[q * 4 + 2] = c[2]; d[q * 4 + 3] = 255;
      }
      var cxp = (i % cols) * S, cyp = Math.floor(i / cols) * S;
      ctx.putImageData(img, cxp, cyp);
      map[fr.key] = { col: i % cols, row: Math.floor(i / cols) };
    });

    return {
      canvas: cv, frames: map, cols: cols, rows: rows, size: S,
      ground: GROUND, palette: P,
      anims: ANIMS.reduce(function (o, a) { o[a.id] = a.n; return o; }, {}),
      /* Which of the eight compass facings this is, and whether it has
         to be flipped: only five are drawn and the other three are the
         mirror of three of them. */
      facing: function (dir8) {
        var d = ((dir8 % 8) + 8) % 8;
        var table = [
          { id: "s",  flip: false }, { id: "se", flip: false },
          { id: "e",  flip: false }, { id: "ne", flip: false },
          { id: "n",  flip: false }, { id: "ne", flip: true },
          { id: "e",  flip: true },  { id: "se", flip: true },
        ];
        return table[d];
      },
      uv: function (anim, faceId, f) {
        var key = anim + ":" + faceId + ":" + f;
        var at = map[key] || map["idle:s:0"];
        return at;
      },
    };
  }

  return { bake: bake, SIZE: S, GROUND: GROUND, ANIMS: ANIMS, FACING: FACING,
           /* exposed so a harness can photograph a sheet on its own */
           _sheet: Sheet, _palette: paletteFor };
})();
