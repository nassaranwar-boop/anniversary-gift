/* =========================================================================
   OUISSY'S CUP — THE CHARACTER SPRITES

   Built to the character bible. Every rule in Part 1 is implemented here
   rather than remembered: the three-tone ramps, the single top-left
   light, the closed one-pixel outline in a darkened fill colour, the rim
   light on the shaded edge, and the colour budget.

   ---------------------------------------------------------------------
   WHY A COMPOSITOR AND NOT DRAWN SHEETS

   There is not an image file anywhere in this repository and there
   cannot be: every sprite in every chapter is made at runtime. The
   roster at the size the bible asks for is about two thousand frames —
   thirteen characters, five unique facings, eight animations. So this is
   a small pixel-art PROGRAM that draws one chibi footballer from a
   description and can therefore draw all of them in one hand.

   Every frame is rasterised into an index buffer one pixel at a time,
   never by the browser, because anything the browser draws it also
   antialiases, and one soft edge anywhere gives the whole thing away.

   ---------------------------------------------------------------------
   THE ORDER OF THE PASSES, AND WHY

     1. an index buffer, one byte per pixel, zero meaning nothing
     2. body parts rasterised as flat colour AREAS, back to front
     3. occlusion: hard shadow bands where forms meet — under the chin,
        under the arm, between the legs. Drawn, not derived, because a
        derived edge cannot know that an arm is in FRONT of a chest
        rather than beside it
     4. the cel pass: one light, top-left. An area pixel with nothing
        above-left takes that area's highlight; one with nothing
        below-right takes its shadow
     5. the outline: empty pixels touching the figure take the OUTLINE
        tone of whatever they touch, so a red kit is bounded by dark
        maroon and never by black
     6. the rim: outline pixels on the lower-right take a cool tint, so
        the figure separates from a busy crowd

   Indexes rather than colours the whole way through, which makes every
   pass a comparison and makes the colour budget structural.
   ========================================================================= */

window.CupSprites = (function () {
  "use strict";

  /* Part 1.1: a 64 cell with a 48-pixel figure in it. The headroom is
     for the celebrate frames, where she leaves the ground. */
  var S = 64;
  var FIGURE = 48;
  var GROUND = 56;            // the line the boots stand on

  function rgb(h) {
    var n = parseInt(h.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  /* --------------------------------------------------------- the sheet */
  function Sheet(w, h) { this.w = w; this.h = h; this.d = new Uint8Array(w * h); }
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
    for (var yy = 0; yy < h; yy++) for (var xx = 0; xx < w; xx++) this.px(x + xx, y + yy, i);
  };
  /* filled ellipse by the midpoint test — the same chunky stepped edge a
     person drawing one by hand would make */
  Sheet.prototype.ellipse = function (cx, cy, rx, ry, i) {
    for (var yy = -ry; yy <= ry; yy++) {
      for (var xx = -rx; xx <= rx; xx++) {
        var a = (xx + 0.5) / (rx + 0.5), b = (yy + 0.5) / (ry + 0.5);
        if (a * a + b * b <= 1) this.px(cx + xx, cy + yy, i);
      }
    }
  };
  /* a capsule, which is what every limb actually is */
  Sheet.prototype.limb = function (x0, y0, x1, y1, r, i) {
    var n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) + 1;
    for (var s = 0; s <= n; s++) {
      var t = s / n;
      this.ellipse(Math.round(x0 + (x1 - x0) * t), Math.round(y0 + (y1 - y0) * t), r, r, i);
    }
  };
  /* Paint over pixels that already belong to `only`. The drawn occlusion
     shadows need this: a band under the chin must darken the CHEST, not
     punch a hole in the air beside it. */
  Sheet.prototype.shadeIn = function (x, y, w, h, only, to) {
    for (var yy = 0; yy < h; yy++) {
      for (var xx = 0; xx < w; xx++) {
        if (this.at(x + xx, y + yy) === only) this.px(x + xx, y + yy, to);
      }
    }
  };

  /* ------------------------------------------------------- the palette
     Parts 1.2 and 1.3: every area is four explicit tones — outline,
     shadow, base, highlight — taken from the bible rather than derived,
     so what is on screen is what was specified. */
  function Palette() { this.cols = ["#000000"]; this.fam = {}; }
  Palette.prototype.area = function (name, ramp) {
    var i = this.cols.length;
    this.cols.push(ramp[3] || ramp[0]);      // outline
    this.cols.push(ramp[0]);                 // shadow
    this.cols.push(ramp[1]);                 // base
    this.cols.push(ramp[2]);                 // highlight
    this.fam[name] = { dark: i, shadow: i + 1, base: i + 2, light: i + 3 };
    return this.fam[name];
  };
  Palette.prototype.flat = function (name, col) {
    var i = this.cols.length;
    this.cols.push(col);
    this.fam[name] = { dark: i, shadow: i, base: i, light: i, flat: true };
    return this.fam[name];
  };

  function shift(h, d) {
    var c = rgb(h);
    var f = function (v) { return Math.max(0, Math.min(255, Math.round(v + d))); };
    return "#" + ((1 << 24) + (f(c[0]) << 16) + (f(c[1]) << 8) + f(c[2])).toString(16).slice(1);
  }
  function derive(base) { return [shift(base, -38), base, shift(base, 34), shift(base, -78)]; }

  /* ------------------------------------------------------------ OUISSY
     Part 5.2, with one deliberate departure that was asked for directly.

     The bible's own table gives her warm-brown skin and dark-brown hair,
     while Part 5.0 and 5.4 say she must match the sprite she has in the
     other chapters of this site — and in super-ouissy.js she is very
     light skinned with long blonde hair. Those cannot both be true. She
     keeps her own colouring: a version of her with brown hair in one
     game is a different person. Everything else below is the bible's.

     The two skin and three hair tones are lifted straight out of
     super-ouissy.js so the two games agree exactly. */
  var BIBLE = {
    ouissy: {
      /* shadow, base, highlight, outline */
      skin:  ["#f2c8b0", "#ffe6d4", "#fff6ec", "#b8845f"],
      hair:  ["#b8862f", "#e0b34e", "#ffe9a8", "#8a6220"],
      kit:   ["#a8283a", "#c73847", "#e05561", "#6e1824"],
      trim:  ["#d9cba8", "#f4ecd8", "#fffaf0", "#b89d6a"],
      gold:  ["#c8912f", "#e8b84b", "#f6d878", "#8a5f18"],
      heart: ["#c03a52", "#e0556b", "#f07a8c", "#7a1e30"],
      boot:  ["#241c26", "#3d3040", "#554860", "#160f18"],
      /* her ink purple, not black — the colour her eyes and outlines are
         in every other chapter */
      eye:   "#3d2340",
      white: "#f4f4e8",
      blush: "#ff8fae",
      mouth: "#b0455e",
    },
  };

  function paletteFor(L, kit) {
    var P = new Palette();
    var B = BIBLE[L.id];
    if (B) {
      P.area("skin", B.skin);   P.area("hair", B.hair);
      P.area("kit", B.kit);     P.area("trim", B.trim);
      /* THE SHORTS ARE NOT THE TRIM.

         The bible's cream (#f4ecd8) sits two points away from her skin
         (#ffe6d4). On a collar that is fine. On the shorts it meant her
         hem, her thighs and her hands were one continuous pale mass with
         no edge anywhere in it — at sprite size the entire middle of the
         character disappeared. Same cream, taken down far enough that
         skin reads against it, with the bible's value kept as the
         highlight so the family still belongs to the kit. */
      P.area("shorts", ["#cbbc97", "#e6dabb", "#f4ecd8", "#8f7f5a"]);
      P.area("gold", B.gold);   P.area("heart", B.heart);
      P.area("boot", B.boot);
      P.flat("eye", B.eye);     P.flat("white", B.white);
      P.flat("blush", B.blush); P.flat("mouth", B.mouth);
    } else {
      /* anyone not yet drawn to the bible is built from their roster
         colours, so the compositor can still draw the whole squad while
         only the approved character is held to the spec */
      P.area("skin", derive(L.skin || "#b98555"));
      P.area("hair", derive(L.hair || "#3a2a1c"));
      P.area("kit", derive((kit && kit.shirt) || "#c73847"));
      P.area("trim", derive((kit && kit.trim) || "#f4ecd8"));
      P.area("shorts", derive((kit && kit.shorts) || "#e6dabb"));
      P.area("gold", derive((kit && kit.trim) || "#e8b84b"));
      P.area("heart", derive((L.super && L.super.colour) || "#e0556b"));
      P.area("boot", derive("#3d3040"));
      P.flat("eye", L.eye || "#2a1c22");
      P.flat("white", "#f4f4e8");
      P.flat("blush", "#c07a5a");
      P.flat("mouth", "#7a1e30");
    }
    /* Part 1.4: one cool tint for the whole figure, because a back light
       is one light and not one per material */
    P.flat("rim", "#93b2c8");
    return P;
  }

  /* =======================================================================
     THE PASSES
     ======================================================================= */
  function celPass(sh, famIdx) {
    var out = new Uint8Array(sh.d);
    for (var y = 0; y < sh.h; y++) {
      for (var x = 0; x < sh.w; x++) {
        var i = sh.at(x, y), f = famIdx[i];
        if (!f || f.flat || i !== f.base) continue;
        if (sh.at(x - 1, y - 1) === 0 || sh.at(x, y - 1) === 0) out[y * sh.w + x] = f.light;
        else if (sh.at(x + 1, y + 1) === 0 || sh.at(x, y + 1) === 0) out[y * sh.w + x] = f.shadow;
      }
    }
    sh.d = out;
  }
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
  function rimPass(sh, famIdx, rimIdx) {
    var out = new Uint8Array(sh.d);
    for (var y = 0; y < sh.h; y++) {
      for (var x = 0; x < sh.w; x++) {
        var i = sh.at(x, y), f = famIdx[i];
        if (!f || i !== f.dark) continue;
        /* the shaded edge — lower and right — and only where there is
           solid figure inside it, or every loose strand of hair gets a
           streak and the back light reads as a drawing error */
        if (sh.at(x + 1, y) !== 0 && sh.at(x, y + 1) !== 0) continue;
        var inward = sh.at(x - 1, y) || sh.at(x, y - 1);
        var g = famIdx[inward];
        if (!g || inward === g.dark) continue;
        out[y * sh.w + x] = rimIdx;
      }
    }
    sh.d = out;
  }

  /* =======================================================================
     THE FIGURE

     Part 1.1 proportions for a 48-pixel character: head 20, torso 16
     with real WIDTH — twenty pixels across, which is what stops it
     reading as a plank — legs 12, chunky feet.
     ======================================================================= */
  var FACING = [
    { id: "s",  turn: 0,   back: false },
    { id: "se", turn: 0.5, back: false },
    { id: "e",  turn: 1,   back: false },
    { id: "ne", turn: 0.5, back: true },
    { id: "n",  turn: 0,   back: true },
  ];

  function pose(anim, f, n) {
    var p = { bob: 0, lean: 0, squash: 0, stretch: 0, headBob: 0, hairLag: 0,
              legA: [0, 0], legB: [0, 0], armA: [0, 0], armB: [0, 0],
              blink: false, air: 0, browRaise: 0 };
    var t = n > 1 ? f / n : 0;
    var ph = t * Math.PI * 2;

    if (anim === "idle") {
      /* Part 4.1: a one-pixel breathing bob, a head bob, and a blink.
         The feet stand APART: with both at centre she balanced on a
         single boot in every idle frame like a flamingo. */
      p.bob = (f === 1 || f === 2) ? -1 : 0;
      p.headBob = f === 2 ? -1 : 0;
      p.blink = f === 3;
      p.hairLag = f === 1 ? 1 : 0;
      p.legA = [5, 0]; p.legB = [-5, 0];
      p.armA = [-1, 0]; p.armB = [1, 0];

    } else if (anim === "run") {
      /* PART 4.2 — A RUN CYCLE, NOT TWO PENDULUMS.

         The first version swung both feet on a sine and put the lift on
         |sin| of the same phase, which meant that on the cross-over
         frames BOTH feet were at zero: she passed through two frames of
         every eight standing perfectly still with her legs welded
         together. A leg is on the ground for half the cycle, travelling
         backwards flat, and in the air for the other half, lifted and
         swinging forward. Those two halves are what a run is. */
      var stride = function (a) {
        var x = Math.cos(a) * 6;
        var air = Math.sin(a) < 0 ? -Math.sin(a) * 5 : 0;  // swing half only
        return [Math.round(x), -Math.round(air)];
      };
      p.legA = stride(ph);
      p.legB = stride(ph + Math.PI);
      /* ARMS OPPOSE THE LEGS, AND THEY SWING IN Y AS WELL AS X.

         Swinging them left and right is what a front-facing sprite
         cannot show: forwards and backwards is almost entirely depth
         from this angle. What the eye reads instead is the hand rising
         and tucking IN towards the chest on the forward swing and
         dropping and opening OUT on the back swing. */
      var c0 = Math.cos(ph);
      p.armA = [Math.round(c0 * 2), Math.round(-c0 * 4)];   // left, forward with the right leg
      p.armB = [Math.round(c0 * 2), Math.round(c0 * 4)];    // right, the other way
      var contact = Math.abs(Math.cos(ph));        // 1 at each foot plant
      p.bob = -Math.round((1 - contact) * 3);      // up between the plants
      p.squash = contact > 0.88 ? 1 : 0;           // plant: shorter, wider
      p.stretch = contact < 0.16 ? 1 : 0;          // extension: taller, thinner
      p.lean = 2;
      p.hairLag = Math.round(Math.cos(ph) * 2);    // secondary motion

    } else if (anim === "kick") {
      /* Part 4.3: anticipation, contact, follow-through.

         The standing leg is PLANTED and stays planted — the first pass
         left it at centre, so the swinging leg passed straight through
         it and the whole kick happened on a single stacked pair of
         boots. Everything else in the pose hangs off that plant. */
      var k = n > 1 ? f / (n - 1) : 0;
      p.legB = [-5, 0];
      if (k < 0.34) {
        var a = k / 0.34;                      // anticipation: leg cocked back
        p.legA = [Math.round(2 - a * 8), Math.round(-a * 3)];
        p.armB = [Math.round(2 + a * 4), -3];
        p.armA = [Math.round(-a * 3), 2];
        p.lean = -2; p.hairLag = -2;
      } else if (k < 0.56) {
        var b = (k - 0.34) / 0.22;             // contact
        p.legA = [Math.round(-6 + b * 15), Math.round(-3 - b * 3)];
        p.armB = [Math.round(6 - b * 8), -3];
        p.armA = [Math.round(-3 + b * 2), 1];
        p.lean = Math.round(b * 3); p.hairLag = Math.round(b * 3);
        p.bob = -1;
      } else {
        var c = (k - 0.56) / 0.44;             // follow-through
        p.legA = [Math.round(9 - c * 4), Math.round(-6 + c * 4)];
        p.armB = [Math.round(-2 + c * 3), -2];
        p.armA = [-1, 1];
        p.lean = 3 - Math.round(c); p.hairLag = 2;
      }

    } else if (anim === "tackle") {
      var s2 = n > 1 ? f / (n - 1) : 0;
      p.bob = Math.round(7 + s2 * 4);
      p.lean = Math.round(3 + s2 * 4);
      p.legA = [Math.round(5 + s2 * 6), 3];
      p.legB = [Math.round(-3 - s2 * 2), 1];
      p.armA = [-4, -2]; p.armB = [4, -3];
      p.hairLag = -3;

    } else if (anim === "cheer") {
      /* Part 4.5: she leaves the ground, so the shadow has something to
         shrink against */
      var c3 = Math.sin(t * Math.PI * 2);
      p.air = Math.max(0, Math.round(c3 * 6));
      p.bob = -p.air;
      p.armA = [-3, -10]; p.armB = [3, -10];
      p.legA = [-2, 0]; p.legB = [2, 0];
      p.browRaise = 1;
      p.hairLag = Math.round(-c3 * 2);

    } else if (anim === "sad") {
      p.bob = f === 1 ? 1 : 0;
      p.headBob = 2;
      p.armA = [2, 2]; p.armB = [-2, 2];
      p.hairLag = 2;

    } else if (anim === "dive") {
      var d = n > 1 ? f / (n - 1) : 0;
      p.air = Math.round(d * 5);
      p.bob = -p.air;
      p.lean = Math.round(d * 9);
      p.armA = [Math.round(-3 - d * 6), Math.round(-5 - d * 4)];
      p.armB = [Math.round(3 + d * 9), Math.round(-5 - d * 4)];
      p.legA = [Math.round(-d * 6), 1]; p.legB = [Math.round(-d * 4), 0];
      p.hairLag = Math.round(-d * 3);

    } else if (anim === "ready") {
      p.bob = f === 1 ? -1 : 0;
      p.armA = [-4, -3]; p.armB = [4, -3];
      p.legA = [-3, 0]; p.legB = [3, 0];
    }
    return p;
  }

  /* ---------------------------------------------------------- the head */
  function capDome(sh, cx, cy, rx, ry, fringeY, i) {
    for (var yy = -ry; yy <= ry; yy++) {
      if (cy + yy > fringeY) break;
      for (var xx = -rx; xx <= rx; xx++) {
        var a = (xx + 0.5) / (rx + 0.5), b = (yy + 0.5) / (ry + 0.5);
        if (a * a + b * b <= 1) sh.px(cx + xx, cy + yy, i);
      }
    }
  }

  /* What falls behind the shoulders, drawn before the body — the only
     way long hair reads as long rather than as a bib. `lag` is Part
     4.2's secondary motion: the hair trails the body by a frame. */
  function backHair(sh, L, P, cx, cy, r, face, lag) {
    var hair = P.fam.hair;
    if (L.head !== "ouissy" && L.head !== "willow") return;
    var len = L.head === "ouissy" ? 18 : 12;

    /* FROM BEHIND, THE HAIR IS THE CHARACTER. It is not two strands
       either side of a shirt — it is one mass down the back, and the
       shirt is what shows around it. */
    if (face.back) {
      /* It falls down her back — it does not swallow her. The first
         attempt made the mass two pixels WIDER than her head and as
         long as her whole body, which from behind turned her into a
         blonde peanut with boots. It is narrower than the skull and it
         stops at the waist, so the shirt reads around it. */
      /* the mass has a SHAPE: it pinches at the nape, spreads across the
         shoulder blades, then tapers to a point. A column of constant
         width from the skull to the shorts is a cape. */
      var ln = len - 8;
      for (var y2 = 0; y2 < ln; y2++) {
        var t2 = y2 / (ln - 1);
        var w0 = Math.round(3 + Math.sin(Math.min(1, t2 * 1.5) * Math.PI * 0.5) * 3
                              - t2 * t2 * 4);
        var dr = Math.round(lag * t2);
        sh.rect(cx - w0 - dr, cy + r - 2 + y2, w0 * 2 + 1, 1, hair.base);
      }
      sh.rect(cx - 1, cy + r - 1, 2, ln - 3, hair.shadow);   // the parting seam
      sh.rect(cx - 4, cy + r, 2, ln - 6, hair.light);
      return;
    }

    /* in profile only the far side shows — Part 3.1's asymmetry */
    var sides = face.turn >= 0.9 ? [-1] : [-1, 1];
    sides.forEach(function (s) {
      for (var yy = 0; yy < len; yy++) {
        var wob = ((yy + 2) >> 2) % 2 ? 1 : 0;
        var w = yy < 6 ? 5 : 4;
        var drift = Math.round(lag * (yy / len));
        var x0 = cx + s * (r - 1) + s * wob - drift - (s > 0 ? 0 : w - 1);
        sh.rect(x0, cy - 3 + yy, w, 1, hair.base);
      }
    });
    sh.ellipse(cx - Math.round(lag * 0.5), cy + 6, r, 6, hair.base);
  }

  function drawHead(sh, L, P, cx, cy, r, face, p) {
    var skin = P.fam.skin, hair = P.fam.hair;
    var back = face.back, profile = face.turn >= 0.9;
    var off = Math.round(face.turn * 3);

    /* PART 3.2 — FROM BEHIND THERE IS NO FACE, AND ALMOST NO SKIN.
       The first build drew the skull, then a fringe across the top of
       it, and called that a back view: from behind she was a blank
       flesh-coloured disc with a hat on. From behind you see HAIR, the
       nape under it, and nothing else. */
    if (back) {
      sh.ellipse(cx, cy, r, r, skin.base);
      sh.ellipse(cx, cy - 1, r, r, hair.base);
      /* a nape only shows on someone whose hair is short enough to have
         one; on her it sat as a flesh-coloured patch in the middle of a
         head of hair */
      if (L.head !== "ouissy" && L.head !== "willow") {
        sh.rect(cx - 2, cy + r - 2, 5, 3, skin.shadow);
      }
      /* the crown catches the light at the top-left and the far side
         falls away — without it the back of her head is one flat gold
         disc the size of her shoulders, which is a balloon, not hair */
      sh.rect(cx - r + 2, cy - r, 4, 2, hair.light);
      sh.rect(cx - 1, cy - r + 3, 2, r + 2, hair.shadow);
      sh.rect(cx + r - 2, cy - r + 4, 3, r * 2 - 5, hair.shadow);
      sh.shadeIn(cx - r, cy + r - 1, r * 2 + 1, 3, skin.base, skin.shadow);
      return;
    }

    sh.ellipse(cx, cy, r, r, skin.base);

    /* PART 3.1 — A TRUE PROFILE. The nose is the tell; without one a
       side view is a front view with the eyes moved, which is exactly
       what the first build looked like. */
    if (profile) {
      sh.rect(cx + r - 1, cy, 2, 2, skin.base);
      sh.px(cx + r, cy + 2, skin.shadow);
    }

    var fringeY = cy - Math.round(r * 0.22);
    if (L.head === "ouissy") {
      if (profile) {
        /* the back of the head is a MASS and the face edge is clean —
           symmetric bangs on both sides is what made E read as S */
        /* the mass sits BEHIND the face, not over it — the first pass
           reached as far forward as the eye and left her with a fringe
           where her expression should be */
        capDome(sh, cx - 2, cy - 1, r + 1, r, fringeY + 2, hair.base);
        sh.ellipse(cx - 4, cy + 1, r - 2, r - 1, hair.base);
      } else {
        capDome(sh, cx, cy - 1, r + 1, r, fringeY, hair.base);
        /* three-quarter: the fringe sweeps across, so it is deeper on
           the far side than the near one and the head has a direction */
        if (off) sh.rect(cx - r, fringeY - 2, r - off, 3, hair.base);
      }
      /* a parting is a LINE, off to one side. Four pixels wide down the
         middle of the crown is a hair slide, and she was wearing one in
         every frame of the first sheet. */
      sh.rect(cx - 1 + off * 2, cy - r, 1, 5, hair.shadow);
      sh.rect(cx - r + 2 + off, cy - r + 1, 4, 1, hair.light);   // the shine
    } else {
      capDome(sh, cx + (profile ? -2 : 0), cy - 1, r + 1, r, fringeY, hair.base);
    }

    /* PART 1.2 — a drawn occlusion shadow under the chin. Derived
       shading cannot know the head is in front of the chest. */
    sh.shadeIn(cx - r, cy + r - 1, r * 2 + 1, 3, skin.base, skin.shadow);

    var eyes = P.fam.eye, white = P.fam.white;
    var eyeY = cy + 1;
    if (profile) {
      if (p.blink) {
        sh.rect(cx + 2, eyeY + 1, 3, 1, eyes.base);
      } else {
        sh.rect(cx + 2, eyeY - 1, 3, 3, white.base);
        sh.rect(cx + 3, eyeY, 2, 2, eyes.base);
        sh.px(cx + 3, eyeY, white.light);
      }
      sh.rect(cx + 1, cy - 2 + (p.browRaise ? -1 : 0), 4, 1, hair.shadow);
      sh.rect(cx + 3, cy + 4, 3, 1, P.fam.mouth.base);
      sh.rect(cx + 1, eyeY + 3, 2, 1, P.fam.blush.base);
      return;
    }

    /* on a three-quarter the near cheek breaks the circle: a two-pixel
       bump where the nose is and a shaded plane behind it */
    if (off) {
      sh.rect(cx + r - 1, cy + 1, 2, 2, skin.base);
      sh.px(cx + r, cy + 3, skin.shadow);
      sh.rect(cx - r + 1, cy, 1, 4, skin.shadow);
    }

    var ex = 3;
    if (p.blink) {
      sh.rect(cx - ex - 1 + off, eyeY + 1, 4, 1, eyes.base);
      sh.rect(cx + ex - 1 + off, eyeY + 1, 4, 1, eyes.base);
    } else {
      /* Part 5.3: whites, a dark pupil, and a lit pixel upper-left.
         On a three-quarter the FAR eye is foreshortened — it loses a
         pixel of width and sits tight against the edge of the face.
         Two identical eyes slid sideways is what made SE read as S. */
      var fw = 3 - (off ? 1 : 0);
      sh.rect(cx - ex - 1 + off, eyeY - 1, fw, 3, white.base);
      sh.rect(cx + ex - 1 + off, eyeY - 1, 3, 3, white.base);
      sh.rect(cx - ex + off, eyeY, fw - 1, 2, eyes.base);
      sh.rect(cx + ex + off, eyeY, 2, 2, eyes.base);
      sh.px(cx - ex + off, eyeY, white.light);
      sh.px(cx + ex + off, eyeY, white.light);
    }
    /* brows, which is where most of the expression lives */
    var by = cy - 2 + (p.browRaise ? -1 : 0);
    sh.rect(cx - ex - 1 + off, by, 3, 1, hair.shadow);
    sh.rect(cx + ex - 1 + off, by, 3, 1, hair.shadow);
    sh.rect(cx - ex - 2 + off, eyeY + 3, 2, 1, P.fam.blush.base);
    sh.rect(cx + ex + 1 + off, eyeY + 3, 2, 1, P.fam.blush.base);
    sh.rect(cx - 1 + off, cy + 4, 3, 1, P.fam.mouth.base);
  }

  /* ------------------------------------------------------------- a frame */
  function drawFrame(L, P, face, anim, f, n) {
    var sh = new Sheet(S, S);
    var p = pose(anim, f, n);
    var bw = (L.build && L.build.w) || 1;
    var bh = (L.build && L.build.h) || 1;
    var profile = face.turn >= 0.9;

    var cx = (S >> 1) + p.lean;
    var g = GROUND + p.bob;

    /* Part 1.1's proportions, adjusted once against the contact sheet:
       at head 9 / torso 16 / leg 12 the shorts ate half the leg and she
       came out bottom-heavy and stumpy. The visible leg — the part below
       the hem — is what the eye measures, not the leg. */
    var headR = Math.round(8 * (0.94 + bw * 0.06));
    var torsoH = Math.round(15 * bh);
    var legH = Math.round(14 * bh);
    /* the chest is never wider than the head — at 21 pixels against a
       17-pixel head she read as a bell rather than a footballer */
    var torsoW = Math.round(8 * bw * (1 - face.turn * 0.24));

    if (p.squash) { torsoH -= 1; torsoW += 1; }
    if (p.stretch) { torsoH += 1; torsoW -= 1; }

    var hipY = g - legH;
    var shoulderY = hipY - torsoH;
    var headCy = shoulderY - headR + 3 + p.headBob;

    /* PART 3.1 — THE THREE-QUARTER HAS TO BE A DIFFERENT DRAWING.
       Narrowing the chest by a pixel and sliding the eyes across is not
       a turn; side by side on a contact sheet, S and SE came out as the
       same character twice. The upper body rotates OVER the hips, so the
       chest and the head sit off the line the feet stand on. */
    var twist = Math.round(face.turn * 2);
    var ux = cx + twist;

    var skin = P.fam.skin, kit = P.fam.kit, trim = P.fam.trim, boot = P.fam.boot;

    if (!face.back) backHair(sh, L, P, ux, headCy, headR, face, p.hairLag);

    /* THE LEG IS THREE THINGS, NOT ONE.

       The first build drew each leg as a single kit-coloured capsule and
       then painted the shorts over the top of it, which left a red stump
       between a cream slab and a boot — legs that were technically
       present and completely unreadable. A footballer's leg reads as
       thigh, sock, boot: skin, then kit colour, then dark. Three bands
       in twelve pixels is what makes it a leg at a glance. */
    var legR = Math.max(2, Math.round(2.2 * bw));
    var leg = function (o, near) {
      var hx = cx + (near ? 1 : -1) * Math.round(torsoW * 0.40);
      var fx = cx + o[0], fy = g + o[1];
      var kx = Math.round(hx + (fx - hx) * 0.5);
      /* the knee comes up with the foot — a lifted boot under a knee
         that stayed put is a foot that has come off the leg */
      var kneeY = hipY + Math.round(legH * 0.55) + Math.round(o[1] * 0.55);
      sh.limb(hx, hipY - 2, kx, kneeY, legR, near ? skin.base : skin.shadow);
      sh.limb(kx, kneeY, fx, fy - 3, legR, near ? kit.base : kit.shadow);
      /* the turnover at the top of the sock: two pixels of trim that
         give the leg a third edge and stop it reading as one red tube */
      sh.rect(kx - legR, kneeY, legR * 2 + 1, 1, near ? trim.base : trim.shadow);
      /* chunky feet, and in profile they read as a stride */
      sh.ellipse(fx + (profile && near ? 1 : 0), fy - 1, profile ? 4 : 3, 2,
                 near ? boot.base : boot.shadow);
    };
    leg(p.legB, false);

    /* the torso: real width */
    sh.ellipse(ux, shoulderY + Math.round(torsoH / 2), torsoW,
               Math.round(torsoH / 2) + 1, kit.base);
    sh.rect(ux - torsoW, shoulderY + 2, torsoW * 2 + 1, torsoH - 2, kit.base);

    leg(p.legA, true);

    /* Shorts go on after both the shirt and the legs, and they are
       NARROWER than the torso: a hem the full width of the chest is a
       skirt, and that is exactly what the first pass looked like. */
    var shorts = P.fam.shorts;
    var shW = torsoW;
    sh.rect(cx - shW, hipY - 4, shW * 2 + 1, 5, shorts.base);
    sh.rect(cx - shW + 1, hipY + 1, shW * 2 - 1, 1, shorts.shadow);  // the hem

    /* arms: shoulder, a bend, and a hand — Part 1.1 says not blobs.
       They start OUTSIDE the chest, or the whole arm disappears into
       the silhouette and she has none. */
    var arm = function (side, o, near) {
      if (profile && !near) return;                  // one arm behind the torso
      /* the far shoulder rolls behind the chest as she turns, so the far
         arm starts closer in and shows less of itself */
      /* the arm never crosses INTO the chest: a red sleeve on a red
         shirt is an arm that has been deleted, so the swing tucks the
         hand as far as the edge of the body and no further */
      var sx = ux + side * (torsoW + 3 - (side < 0 ? twist * 2 : 0));
      var ex2 = sx + Math.round(o[0] * 0.5);
      var elbowY = shoulderY + Math.round(torsoH * 0.55);
      /* the hand stops above the hem. Reaching to torsoH * 0.95 plus the
         swing put her fingertips below her shorts, and a pale forearm
         hanging past the hem reads as a stick she is carrying. */
      var hx = sx + o[0], hy = shoulderY + Math.round(torsoH * 0.82) + o[1];
      var c = near ? kit.base : kit.shadow;
      var sc = near ? skin.base : skin.shadow;
      var rr = Math.max(2, Math.round(2 * bw));
      /* THE SHOULDER OVERLAPS THE CHEST.

         Starting the sleeve outside the body left a one-pixel notch
         between the two where the outline pass then drew a dark line,
         and the arms came out as red blocks propped against her sides
         rather than attached to her. */
      sh.limb(ux + side * (torsoW - 2), shoulderY + 2, sx, shoulderY + 4, rr, c);
      sh.limb(sx, shoulderY + 4, ex2, elbowY, rr, c);              // sleeve
      sh.limb(ex2, elbowY, hx, hy - 2, rr - 1, sc);                // forearm
      sh.ellipse(hx, hy, rr - 1, rr - 1, sc);                      // the hand
    };
    arm(-1, p.armA, !profile);
    arm(1, p.armB, true);

    /* PART 1.2 — DRAWN OCCLUSION, under the arms and between the legs.

       Both sleeves are the same red as the chest, so where an arm lies
       against the body there is no edge at all and the arm vanishes. A
       band of the shadow tone down each side of the torso is what puts
       it back — this is the one shadow the light direction cannot
       derive, because it depends on which of two touching shapes is in
       front. */
    sh.shadeIn(ux + torsoW - 2, shoulderY + 4, 3, torsoH - 6, kit.base, kit.shadow);
    sh.shadeIn(ux - torsoW, shoulderY + 5, 2, torsoH - 8, kit.base, kit.shadow);
    sh.shadeIn(cx - 1, hipY - 3, 3, 5, shorts.base, shorts.shadow);

    /* the captain's armband, on the arm rather than hovering over the
       seam between the arm and the chest */
    if (L.armband) {
      var gd = P.fam.gold;
      sh.rect(ux - torsoW - 5, shoulderY + 6, 4, 2, gd.base);
      sh.rect(ux - torsoW - 5, shoulderY + 7, 4, 1, gd.shadow);
    }

    if (face.back) {
      /* from behind she is a back, so: a number, and her hair over the
         shoulders rather than tucked behind them */
      var ny = shoulderY + 5, gp = P.fam.trim;
      sh.rect(ux - 1, ny, 3, 7, gp.light);
      sh.rect(ux - 2, ny + 1, 1, 5, gp.light);
      backHair(sh, L, P, ux, headCy, headR, face, p.hairLag);
    } else if (L.emblem === "heart" && torsoW >= 6) {
      var ey = shoulderY + 6, hp = P.fam.heart;
      sh.rect(ux - 3, ey, 2, 2, hp.base); sh.rect(ux + 2, ey, 2, 2, hp.base);
      sh.rect(ux - 3, ey + 1, 7, 2, hp.base);
      sh.rect(ux - 2, ey + 3, 5, 1, hp.base);
      sh.rect(ux - 1, ey + 4, 3, 1, hp.base);
      sh.px(ux, ey + 5, hp.base);
    }

    drawHead(sh, L, P, ux, headCy, headR, face, p);
    return { sheet: sh, air: p.air || 0 };
  }

  /* =======================================================================
     BAKING
     ======================================================================= */
  var ANIMS = [
    { id: "idle", n: 4 }, { id: "run", n: 8 }, { id: "kick", n: 6 },
    { id: "tackle", n: 5 }, { id: "cheer", n: 6 }, { id: "sad", n: 3 },
    { id: "dive", n: 5 }, { id: "ready", n: 4 },
  ];

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

    var list = [];
    ANIMS.forEach(function (a) {
      FACING.forEach(function (face) {
        for (var f = 0; f < a.n; f++) list.push({ a: a, face: face, f: f });
      });
    });

    var cols = 10, rows = Math.ceil(list.length / cols);
    var cv = document.createElement("canvas");
    cv.width = cols * S; cv.height = rows * S;
    var ctx = cv.getContext("2d");
    var img = ctx.createImageData(S, S);
    var map = {}, airs = {};

    list.forEach(function (fr, i) {
      var made = drawFrame(L, P, fr.face, fr.a.id, fr.f, fr.a.n);
      var sh = made.sheet;
      celPass(sh, fi);
      outlinePass(sh, fi);
      rimPass(sh, fi, rim);
      var d = img.data;
      for (var q = 0; q < S * S; q++) {
        var idx = sh.d[q];
        if (!idx) { d[q * 4 + 3] = 0; continue; }
        var c = rgb(P.cols[idx]);
        d[q * 4] = c[0]; d[q * 4 + 1] = c[1]; d[q * 4 + 2] = c[2]; d[q * 4 + 3] = 255;
      }
      ctx.putImageData(img, (i % cols) * S, Math.floor(i / cols) * S);
      var key = fr.a.id + ":" + fr.face.id + ":" + fr.f;
      map[key] = { col: i % cols, row: Math.floor(i / cols) };
      airs[key] = made.air;
    });

    return {
      canvas: cv, frames: map, cols: cols, rows: rows, size: S,
      ground: GROUND, figure: FIGURE, palette: P,
      anims: ANIMS.reduce(function (o, a) { o[a.id] = a.n; return o; }, {}),
      /* how far off the ground a frame is, so the shadow can shrink while
         the character rises — Part 1.7 */
      airOf: function (anim, faceId, f) { return airs[anim + ":" + faceId + ":" + f] || 0; },
      facing: function (dir8) {
        var d = ((dir8 % 8) + 8) % 8;
        return [{ id: "s", flip: false }, { id: "se", flip: false },
                { id: "e", flip: false }, { id: "ne", flip: false },
                { id: "n", flip: false }, { id: "ne", flip: true },
                { id: "e", flip: true }, { id: "se", flip: true }][d];
      },
      uv: function (anim, faceId, f) {
        return map[anim + ":" + faceId + ":" + f] || map["idle:s:0"];
      },
    };
  }

  return { bake: bake, SIZE: S, GROUND: GROUND, FIGURE: FIGURE,
           ANIMS: ANIMS, FACING: FACING, BIBLE: BIBLE };
})();
