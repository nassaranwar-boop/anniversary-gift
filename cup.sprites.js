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

    } else if (anim === "catch") {
      /* GATHERING IT IN. Both hands out to meet it, then pulled into
         the chest, then the body closing round it. What says "he has
         hold of it" is the arms coming TOGETHER — a keeper who catches
         with his arms apart has not caught anything. */
      var kc = n > 1 ? f / (n - 1) : 0;
      p.legA = [4, 0]; p.legB = [-4, 0];
      p.armA = [Math.round(-5 + kc * 3), Math.round(-4 + kc * 4)];
      p.armB = [Math.round(5 - kc * 3), Math.round(-4 + kc * 4)];
      p.lean = Math.round(kc * 2);
      p.bob = kc > 0.4 ? 1 : 0;
      p.squash = kc > 0.4 ? 1 : 0;
      p.headBob = 1;
      p.hairLag = Math.round(kc * 2);

    } else if (anim === "punch") {
      /* PUTTING IT AWAY. He cannot hold this one, so both fists go
         through it: a short gather and then a hard extension, with the
         body rising into it. The arms go OUT, which is the opposite of
         the catch, and that opposition is the whole read. */
      var kp = n > 1 ? f / (n - 1) : 0;
      p.legA = [Math.round(3 + kp * 3), Math.round(-kp * 4)];
      p.legB = [-4, 0];
      if (kp < 0.35) {
        var a5 = kp / 0.35;
        p.armA = [Math.round(-2 - a5 * 2), Math.round(1 - a5 * 2)];
        p.armB = [Math.round(2 + a5 * 2), Math.round(1 - a5 * 2)];
        p.bob = 1; p.squash = 1;
      } else {
        var b5 = (kp - 0.35) / 0.65;
        p.armA = [Math.round(-4 + b5 * 2), Math.round(-1 - b5 * 5)];
        p.armB = [Math.round(4 - b5 * 2), Math.round(-1 - b5 * 5)];
        p.bob = -Math.round(b5 * 2); p.stretch = 1;
        p.air = Math.round(b5 * 4);
      }
      p.lean = -1;
      p.hairLag = -2;

    } else if (anim === "throw") {
      /* DISTRIBUTION. Overarm: the ball comes back past the ear, the
         front foot goes out, and the arm comes over. Four frames and
         the middle two are the whole of it. */
      var kt = n > 1 ? f / (n - 1) : 0;
      p.legB = [-4, 0];
      p.legA = [Math.round(2 + kt * 5), 0];
      if (kt < 0.45) {
        var a6 = kt / 0.45;
        p.armB = [Math.round(3 + a6 * 3), Math.round(-2 - a6 * 4)];
        p.armA = [Math.round(-2 - a6 * 2), Math.round(1 + a6)];
        p.lean = Math.round(-2 - a6);
      } else {
        var b6 = (kt - 0.45) / 0.55;
        p.armB = [Math.round(6 - b6 * 9), Math.round(-6 + b6 * 7)];
        p.armA = [Math.round(-4 + b6 * 3), Math.round(2 - b6)];
        p.lean = Math.round(-3 + b6 * 6);
      }
      p.hairLag = Math.round(-2 + kt * 4);
      p.headBob = kt > 0.5 ? 1 : 0;

    } else if (anim === "turn") {
      /* PLANTING A FOOT AND COMING ROUND.

         What sells a turn is not the feet, it is the HIPS: the body
         drops, leans into the new direction, and the outside arm comes
         across to balance it. The outside foot plants wide and stays
         planted while everything else rotates over it — which is why
         the planted leg barely moves across these four frames and the
         lean does almost all the work. */
      var k = n > 1 ? f / (n - 1) : 0;
      p.legA = [Math.round(7 - k * 3), 0];            // planted, wide
      p.legB = [Math.round(-2 - k * 4), Math.round(-k * 2)];
      /* the lean crosses over: away from the turn, then into it */
      p.lean = Math.round(-3 + k * 7);
      p.bob = k < 0.5 ? 1 : 0;                        // hips drop, then rise
      p.squash = k < 0.4 ? 1 : 0;
      p.armA = [Math.round(-4 + k * 7), Math.round(-2 + k * 3)];
      p.armB = [Math.round(3 - k * 6), Math.round(2 - k * 4)];
      p.hairLag = Math.round(-3 + k * 6);             // hair arrives late
      p.headBob = k < 0.5 ? 1 : 0;

    } else if (anim === "stop") {
      /* A SKID. Both feet come forward of the body, the weight goes
         back, and then it settles. Three frames is all it needs and all
         it can have — any longer and stopping feels like wading. */
      var k2 = n > 1 ? f / (n - 1) : 0;
      p.legA = [Math.round(6 - k2 * 2), 0];
      p.legB = [Math.round(3 - k2 * 7), 0];
      p.lean = Math.round(-4 + k2 * 4);               // weight back, then up
      p.bob = k2 < 0.6 ? 1 : 0;
      p.squash = k2 < 0.6 ? 1 : 0;
      p.armA = [Math.round(-5 + k2 * 4), Math.round(-3 + k2 * 3)];
      p.armB = [Math.round(5 - k2 * 4), Math.round(-3 + k2 * 3)];
      p.hairLag = Math.round(3 - k2 * 3);
      p.headBob = k2 < 0.4 ? 1 : 0;

    } else if (anim === "trap") {
      /* TAKING IT DOWN. A foot goes out to meet the ball, the body
         comes over the top of it, and the arms open for balance. The
         whole thing is a quarter of a second and its job is to say "he
         has it under control" — or, on a poor one, that he does not. */
      var k3 = n > 1 ? f / (n - 1) : 0;
      p.legA = [Math.round(3 + k3 * 5), Math.round(-k3 * 2)];  // reaching out
      p.legB = [-4, 0];
      p.lean = Math.round(1 + k3 * 2);                // over the ball
      p.bob = k3 > 0.4 ? 1 : 0;
      p.squash = k3 > 0.4 ? 1 : 0;
      p.armA = [Math.round(-3 - k3 * 2), 1];
      p.armB = [Math.round(3 + k3 * 2), Math.round(-1 - k3)];
      p.hairLag = 1;
      p.headBob = 1;                                  // eyes down on the ball

    } else if (anim === "pass") {
      /* A SIDE-FOOT.

         The same three beats as the shot and a fraction of the size of
         each. The leg comes back a third as far, the contact is across
         the body rather than through the ball, and there is almost no
         follow-through — which is exactly the difference you are
         trying to read at a glance when somebody rolls one square
         instead of hitting it. */
      var k4 = n > 1 ? f / (n - 1) : 0;
      p.legB = [-5, 0];                               // planted
      if (k4 < 0.4) {
        var a4 = k4 / 0.4;
        p.legA = [Math.round(2 - a4 * 4), 0];
        p.armB = [Math.round(1 + a4 * 2), -2];
        p.armA = [Math.round(-a4 * 2), 1];
        p.lean = -1;
      } else if (k4 < 0.7) {
        var b4 = (k4 - 0.4) / 0.3;
        p.legA = [Math.round(-2 + b4 * 7), Math.round(-b4 * 2)];
        p.armB = [Math.round(3 - b4 * 3), -2];
        p.armA = [Math.round(-2 + b4), 1];
        p.lean = Math.round(b4);
      } else {
        var c4 = (k4 - 0.7) / 0.3;
        p.legA = [Math.round(5 - c4 * 3), Math.round(-2 + c4 * 2)];
        p.armB = [0, -1];
        p.armA = [-1, 1];
        p.lean = 1;
      }

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

    /* dive and tackle are not in here: they are off her feet, and they
       are laid out along an axis by drawProne instead */

    } else if (anim === "cheer") {
      /* PART 4.5. She leaves the ground, so the shadow has something to
         shrink against, and the arms go all the way UP.

         The first version raised the hands by ten pixels while leaving
         the elbow where it was, so both arms bent at the shoulder and
         stopped level with her ears: she looked like she was shrugging
         at a goal rather than celebrating one. The elbow travels with
         the hand now, and it travels far enough to clear her head. */
      var c3 = Math.sin(t * Math.PI * 2);
      p.air = Math.max(0, Math.round(c3 * 6));
      p.bob = -p.air;
      p.armA = [-6, -20]; p.armB = [6, -20];
      p.legA = [-5, 0]; p.legB = [5, 0];
      p.browRaise = 1;
      p.hairLag = Math.round(-c3 * 2);

    } else if (anim === "sad") {
      /* shoulders down, head down, hands hanging in front, and a stance
         — she balanced on one boot here too */
      p.bob = f === 1 ? 1 : 0;
      p.headBob = 2;
      p.armA = [3, 3]; p.armB = [-3, 3];
      p.legA = [3, 0]; p.legB = [-3, 0];
      p.hairLag = 2;

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
    var LONG = { ouissy: 18, willow: 15 };

    /* MARINA's ponytail is not short hair and it is not long hair — it
       is a rope, gathered high and hanging clear of the shirt, and it is
       the whole reason you can tell which keeper is on. */
    if (L.head === "pony") {
      /* it hangs OUTSIDE the skull. Gathered at r-2 it sat inside the
         head's own circle, and the head — drawn afterwards — painted
         over the whole thing, so from the front she had no tail at all */
      var side = face.back ? 0 : -1;
      var bx = cx + side * (r + 1) - Math.round(lag);
      sh.ellipse(cx + side * (r - 3), cy - r + 3, 3, 2, hair.base);   // the tie
      for (var ty = 0; ty < 14; ty++) {
        var w3 = ty < 9 ? 3 : 2;
        var sw = Math.round(Math.sin(ty * 0.35) * 2) - Math.round(lag * (ty / 14));
        sh.rect(bx - 1 + sw, cy - r + 3 + ty, w3, 1, hair.base);
      }
      return;
    }
    if (!LONG[L.head]) return;
    var len = LONG[L.head];

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

  /* =======================================================================
     THIRTEEN HEADS

     Part 6 asks for a squad you can tell apart by silhouette alone, and
     the roster has been carrying the field for it all along: every entry
     names a `head`. Until now the compositor read exactly one of those
     names — hers — and drew the same cap of hair on the other twelve, so
     the squad was one character in thirteen colourways.

     Each of these adds something the OUTLINE can see. A colour that only
     shows inside the figure is no use: at this size, on grass, in
     motion, the shape is the whole identification.

     They are drawn in two passes because some of them sit behind the
     face and some in front of it: `crown` runs with the hair, `over`
     runs after the features, which is the only place glasses, goggles
     and a cap peak can go.
     ======================================================================= */
  var HEADS = {
    /* EMBER — flame: four spikes, tallest at the back */
    flame: {
      crown: function (sh, P, cx, cy, r, f) {
        var h = P.fam.hair;
        for (var i = 0; i < 4; i++) {
          var x = cx - r + 2 + i * 3, t = 3 + (i % 2) * 3;
          sh.rect(x, cy - r - t, 2, t + 3, h.base);
          sh.px(x, cy - r - t, h.light);
        }
      },
    },
    /* ATLAS — crop: a buzz cut, so the skull shows through it */
    crop: {
      tight: 2,
      crown: function (sh, P, cx, cy, r) {
        sh.rect(cx - r + 2, cy - r + 1, 3, 1, P.fam.hair.light);
      },
    },
    /* COMET — goggles: swept hair, and a visor pushed up on the brow */
    goggles: {
      over: function (sh, P, cx, cy, r, f) {
        if (f.back) return;
        var g = P.fam.trim, d = P.fam.boot;
        sh.rect(cx - r + 1, cy - r + 3, r * 2 - 1, 2, d.base);   // the strap
        sh.rect(cx - r + 2, cy - r + 2, 4, 3, g.light);          // two lenses
        sh.rect(cx + 1, cy - r + 2, 4, 3, g.light);
        sh.px(cx - r + 3, cy - r + 2, g.base);
      },
    },
    /* LUMI — bun: a knot high and behind */
    bun: {
      crown: function (sh, P, cx, cy, r, f) {
        var h = P.fam.hair, x = cx - (f.turn >= 0.9 ? 5 : 3);
        sh.ellipse(x, cy - r - 2, 4, 4, h.base);
        sh.rect(x - 2, cy - r - 4, 3, 1, h.light);
      },
    },
    /* SAGE — sprig: one leaf, standing up off the crown */
    sprig: {
      crown: function (sh, P, cx, cy, r) {
        var g = P.fam.gold;
        sh.rect(cx - 1, cy - r - 4, 2, 5, g.shadow);
        sh.ellipse(cx + 1, cy - r - 5, 3, 2, g.base);
        sh.px(cx + 1, cy - r - 5, g.light);
      },
    },
    /* ECHO — phones: a band over the top and a cup over each ear */
    phones: {
      over: function (sh, P, cx, cy, r, f) {
        var d = P.fam.boot, g = P.fam.gold;
        sh.rect(cx - r + 1, cy - r - 2, r * 2 - 1, 2, d.base);    // the band
        sh.rect(cx - r + 2, cy - r - 3, r * 2 - 3, 1, d.shadow);
        if (!f.profile) sh.rect(cx - r - 1, cy - 2, 3, 5, d.base);
        sh.rect(cx + r - 1, cy - 2, 3, 5, d.base);
        sh.px(cx + r, cy - 1, g.base);
      },
    },
    /* BOULDER — flat: a flat top, squared off at the corners */
    flat: {
      crown: function (sh, P, cx, cy, r) {
        var h = P.fam.hair;
        sh.rect(cx - r, cy - r - 2, r * 2 + 1, 4, h.base);
        sh.rect(cx - r + 1, cy - r - 2, r * 2 - 1, 1, h.light);
      },
    },
    /* THORN — pads: a headband, low and tied at the side */
    pads: {
      over: function (sh, P, cx, cy, r, f) {
        var g = P.fam.trim;
        sh.rect(cx - r, cy - r + 3, r * 2 + 1, 2, g.base);
        sh.rect(cx - r, cy - r + 4, r * 2 + 1, 1, g.shadow);
        if (!f.back) sh.rect(cx - r - 2, cy - r + 3, 3, 3, g.base);
      },
    },
    /* GUSTAV — cap: a keeper's peak, and it points where he looks */
    cap: {
      over: function (sh, P, cx, cy, r, f) {
        var k = P.fam.kit;
        sh.ellipse(cx, cy - r + 2, r, 4, k.base);
        sh.rect(cx - r, cy - r + 3, r * 2 + 1, 2, k.shadow);
        if (f.back) return;
        var pk = f.profile ? 6 : Math.round(3 + f.turn * 3);
        sh.rect(cx - 2, cy - r + 5, pk + 4, 2, k.shadow);        // the peak
        sh.rect(cx - 2, cy - r + 5, pk + 3, 1, k.base);
      },
    },
    /* MARINA — pony: gathered high, and it swings with the body */
    pony: { tail: 12 },
    /* ANWAR — curls, a beard along the jaw, and his glasses */
    anwar: {
      crown: function (sh, P, cx, cy, r) {
        /* curls are TEXTURE on the top of the dome. Drawn as five discs
           along the hairline they hung off both sides of his skull and
           he came out wearing horns. */
        var h = P.fam.hair;
        for (var i = 0; i < 4; i++) {
          sh.ellipse(cx - 5 + i * 3, cy - r + 1 + (i % 2 ? 1 : 0), 2, 2, h.base);
        }
        sh.px(cx - 4, cy - r, h.light);
      },
      over: function (sh, P, cx, cy, r, f) {
        if (f.back) return;
        var h = P.fam.hair, d = P.fam.boot;
        /* THE BEARD FOLLOWS THE JAW and stops at the jaw.

           Measured off the head's own circle it climbed the cheeks as
           far as his eyes, because that is where the circle is at the
           sides — and three pixels deep all the way round, it stopped
           being a beard and became a balaclava. Two pixels, inset, and
           nothing above the mouth but the moustache. */
        for (var x = -r + 3; x <= r - 3; x++) {
          var u = x / (r + 1);
          var dy = Math.round(Math.sqrt(Math.max(0, 1 - u * u)) * (r + 1)) - 3;
          sh.rect(cx + x, cy + dy - 1, 1, 2, h.shadow);
        }
        /* no moustache row: at cy+3 it landed on the bottom rail of the
           glasses and the two merged into one dark band across his face */

        /* the glasses are the single most recognisable thing about him,
           so they go in the outline — as two rings around the eyes,
           never as the filled bars that first went in here */
        var ring = function (x0, y0) {
          sh.rect(x0, y0 - 1, 5, 1, d.base);
          sh.rect(x0, y0 + 3, 5, 1, d.base);
          sh.rect(x0, y0, 1, 3, d.base);
          sh.rect(x0 + 4, y0, 1, 3, d.base);
        };
        if (f.profile) {
          ring(cx + 1, cy);
          sh.rect(cx - r + 2, cy, r - 1, 1, d.base);          // the temple arm
        } else {
          var o = Math.round(f.turn * 3);
          ring(cx - 6 + o, cy); ring(cx + 2 + o, cy);
          sh.rect(cx - 1 + o, cy + 1, 3, 1, d.base);          // the bridge
        }
      },
    },
  };

  function drawHead(sh, L, P, cx, cy, r, face, p) {
    var skin = P.fam.skin, hair = P.fam.hair;
    var back = face.back, profile = face.turn >= 0.9;
    var off = Math.round(face.turn * 3);
    var H = HEADS[L.head] || {};
    var fc = { back: back, profile: profile, turn: face.turn };
    var over = function () { if (H.over) H.over(sh, P, cx, cy, r, fc); };

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
      if (H.crown) H.crown(sh, P, cx, cy, r, fc);
      over();
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
        /* IN PROFILE THERE HAS TO BE A FACE TO PUT THE EYE ON.

           The hair came down to eye level right across the head, so all
           that was left of her was a five-pixel sliver of cheek with a
           round eye stuck on the front of it — which is what a fish
           looks like. The crown stops four pixels above the eye, the
           mass sits behind the ear, and the fringe sweeps back on a
           diagonal: forehead, brow, cheek, jaw, in that order. */
        sh.ellipse(cx - 7, cy, r - 2, r - 1, hair.base);      // behind the ear
        capDome(sh, cx - 2, cy - 1, r + 1, r, cy - 4, hair.base);
        for (var q = 0; q < 6; q++) {                         // the swept fringe
          sh.rect(cx - 12, cy - 4 + q, 17 - q * 3, 1, hair.base);
        }
        sh.rect(cx - 7, cy - r + 1, 4, 1, hair.light);        // the shine
      } else {
        capDome(sh, cx, cy - 1, r + 1, r, fringeY, hair.base);
        /* three-quarter: the fringe sweeps across, so it is deeper on
           the far side than the near one and the head has a direction */
        if (off) sh.rect(cx - r, fringeY - 2, r - off, 3, hair.base);
      }
      /* a parting is a LINE, off to one side. Four pixels wide down the
         middle of the crown is a hair slide, and she was wearing one in
         every frame of the first sheet. In profile the parting is on the
         far side of the head and the shine has already been placed, so
         neither belongs here — drawn unguarded they landed on her face. */
      if (!profile) {
        sh.rect(cx - 1 + off * 2, cy - r, 1, 5, hair.shadow);
        sh.rect(cx - r + 2 + off, cy - r + 1, 4, 1, hair.light);
      }
    } else {
      /* `tight` is for a buzz cut: the hair follows the skull instead of
         sitting on top of it, so BOULDER's flat top and ATLAS's crop are
         not the same shape with different colours in it */
      var grow = H.tight === undefined ? 1 : H.tight - 1;
      capDome(sh, cx + (profile ? -2 : 0), cy - 1, r + grow, r, fringeY, hair.base);
      if (!profile) sh.rect(cx - r + 2, cy - r + 1, 4, 1, hair.light);
    }
    if (H.crown) H.crown(sh, P, cx, cy, r, fc);

    /* PART 1.2 — a drawn occlusion shadow under the chin. Derived
       shading cannot know the head is in front of the chest. */
    sh.shadeIn(cx - r, cy + r - 1, r * 2 + 1, 3, skin.base, skin.shadow);

    var eyes = P.fam.eye, white = P.fam.white;
    var eyeY = cy + 1;
    if (profile) {
      /* AN EYE SEEN EDGE-ON IS A WEDGE, NOT A DISC.

         Front-on, an eye is a ring of white around a pupil, and that is
         what was drawn here: a three-by-three white block with a
         two-by-two pupil floating in it. From the side you are looking
         along the eyeball, so almost none of the white is facing you —
         what reads is the lash line on top, the dark of the iris under
         it, and at most one lit pixel of white towards the nose. A disc
         in a side view is the single thing that makes a face look like
         a fish, and she had one. */
      if (p.blink) {
        sh.rect(cx + 2, cy, 4, 1, eyes.base);
      } else {
        /* Six pixels, and the whole eye is in them: a lid across the
           top, the iris under it, and one lit pixel of white on the
           nose side. Anything taller grew a tail and read as a hook. */
        sh.rect(cx + 2, cy - 1, 3, 1, eyes.base);            // the lid
        sh.rect(cx + 2, cy, 2, 1, eyes.base);                // the iris
        sh.px(cx + 4, cy, white.base);                       // white, nose side
        /* no catch light here on purpose: the iris is two pixels wide,
           and lighting one of them leaves an L rather than an eye */
      }
      /* The brow is a DARKER gold than the fringe and stands off it by a
         pixel. Drawn in the fringe's own tone and butted up against it,
         it was not a brow at all — it was more hair. */
      sh.rect(cx + 2, cy - 3 + (p.browRaise ? -1 : 0), 3, 1, hair.dark);
      /* lips at the front of the face, not in the middle of the cheek */
      sh.rect(cx + 4, cy + 4, 3, 1, P.fam.mouth.base);
      sh.px(cx + r - 1, cy + 3, skin.shadow);                // under the nose
      sh.rect(cx + 1, cy + 2, 2, 1, P.fam.blush.base);
      over();
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
    over();
  }

  /* =======================================================================
     OFF YOUR FEET

     Two of the eight animations are not a person standing up. A keeper's
     dive and a slide tackle both put the body along the ground, and the
     upright layout — head at the top, hip below it, legs under that —
     cannot express either of them. Driving it harder only ever produced
     a crouch: on the first contact sheet the tackle was Ouissy standing
     still looking slightly annoyed, and the dive was the same thing with
     her arms out.

     So these two are laid out along an AXIS instead of down the cell.
     Everything hangs off one angle: the body runs from the hip along
     (sin a, -cos a), a is zero when she is upright and a right angle
     when she is flat, and the limbs are placed along that axis and the
     one perpendicular to it. Every part here is a capsule or an ellipse,
     both of which stay themselves when you rotate their endpoints, which
     is why this works at all.

     It is always drawn side-on, whatever facing was asked for. Nobody
     dives towards the camera, and the match picks the side facing and
     mirrors it.
     ======================================================================= */
  function drawProne(L, P, anim, f, n) {
    var sh = new Sheet(S, S);
    var t = n > 1 ? f / (n - 1) : 0;
    var dive = anim === "dive";
    var bw = (L.build && L.build.w) || 1;
    var bh = (L.build && L.build.h) || 1;

    var headR = Math.round(8 * (0.94 + bw * 0.06));
    var torsoH = Math.round(15 * bh);
    var legH = Math.round(14 * bh);
    var torsoW = Math.max(4, Math.round(5 * bw));

    /* a goes from a crouch to flat. The dive commits further and faster;
       a slide keeps a little more of the body up off the turf */
    var a = dive ? 0.45 + t * 1.05 : 0.70 + t * 0.72;
    var ax = Math.sin(a), ay = -Math.cos(a);
    var px2 = -ay, py2 = ax;                 // the perpendicular

    /* the hip is the pivot, and it travels: a dive rises and then falls,
       a slide just goes down and forwards */
    var hx = (S >> 1) - 13 + Math.round(t * 5);
    var hy = dive
      ? GROUND - 13 - Math.round(Math.sin(t * Math.PI) * 5)
      : GROUND - 11 + Math.round(t * 7);

    var P2 = function (d, s) {
      return [Math.round(hx + ax * d + px2 * s), Math.round(hy + ay * d + py2 * s)];
    };

    var skin = P.fam.skin, kit = P.fam.kit, boot = P.fam.boot;
    var shorts = P.fam.shorts, trim = P.fam.trim;
    var sp = P2(torsoH, 0);                          // the shoulder
    var hd = P2(torsoH + headR + 1, -1);             // the head

    /* THE LEGS.

       A slide goes in leg first: the tackling leg is thrown forward
       along the ground ahead of the hip, and the other is folded under.
       A dive trails both legs behind, the upper one straighter. */
    var legR = Math.max(2, Math.round(2.2 * bw));
    var drawLeg = function (d1, s1, d2, s2, near) {
      var k = P2(d1, s1), ft = P2(d2, s2);
      sh.limb(hx + px2 * s1 * 0.3, hy + py2 * s1 * 0.3, k[0], k[1], legR,
              near ? skin.base : skin.shadow);
      sh.limb(k[0], k[1], ft[0], ft[1], legR, near ? kit.base : kit.shadow);
      sh.rect(k[0] - legR, k[1], legR * 2 + 1, 1, near ? trim.base : trim.shadow);
      sh.ellipse(ft[0], ft[1], 4, 3, near ? boot.base : boot.shadow);
    };
    if (dive) {
      drawLeg(-legH * 0.5, 3, -legH * 0.95, 7, false);
      drawLeg(-legH * 0.55, -2, -legH * 1.0, -1, true);
    } else {
      drawLeg(-legH * 0.35, 6, -legH * 0.1, 10, false);     // folded under
      drawLeg(legH * 0.55, 4, legH * 1.25, 6, true);        // thrown forward
    }

    /* the torso as one capsule, so it turns with everything else */
    sh.limb(hx, hy, sp[0], sp[1], torsoW, kit.base);
    var hipA = P2(-2, 0), hipB = P2(4, 0);
    sh.limb(hipA[0], hipA[1], hipB[0], hipB[1], torsoW - 1, shorts.base);

    /* THE ARMS.

       The dive reaches: both arms out past the head along the body's own
       line, spread either side of it, which is what makes the shape read
       as going somewhere. The slide plants one hand back on the turf for
       balance and throws the other up and clear. */
    var armR = Math.max(2, Math.round(2 * bw));
    var drawArm = function (d1, s1, d2, s2, near) {
      var e = P2(d1, s1), h = P2(d2, s2);
      sh.limb(sp[0], sp[1], e[0], e[1], armR, near ? kit.base : kit.shadow);
      sh.limb(e[0], e[1], h[0], h[1], armR - 1, near ? skin.base : skin.shadow);
      sh.ellipse(h[0], h[1], armR - 1, armR - 1, near ? skin.base : skin.shadow);
      return h;
    };
    /* the far arm goes down before the head, the near arm after it. The
       first attempt drew both first and put them at the same distance
       along the axis as the skull, so the head — a nine-pixel disc —
       swallowed the pair of them and she dived with no arms at all. */
    if (dive) drawArm(torsoH + 3, 9, torsoH + 12, 13, false);
    else drawArm(torsoH - 3, 8, torsoH - 8, 13, false);     // planted behind

    drawHead(sh, L, P, hd[0], hd[1], headR,
             { id: "e", turn: 1, back: false },
             { blink: false, browRaise: 1 });

    if (dive) drawArm(torsoH + 3, -9, torsoH + 13, -12, true);
    else drawArm(torsoH + 4, -8, torsoH + 8, -14, true);
    /* the captain's armband travels with the arm it is on — left where
       it was drawn, it hung in mid-air the moment she left her feet */
    if (L.armband) {
      var mb = P2(torsoH + 1, dive ? -6 : -5), gd = P.fam.gold;
      sh.rect(mb[0] - 1, mb[1] - 1, 3, 2, gd.base);
      sh.rect(mb[0] - 1, mb[1] + 1, 3, 1, gd.shadow);
    }
    return { sheet: sh, air: Math.max(0, GROUND - 6 - hy) };
  }

  /* ------------------------------------------------------------- a frame */
  function drawFrame(L, P, face, anim, f, n) {
    if (anim === "dive" || anim === "tackle") return drawProne(L, P, anim, f, n);
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

    /* a ponytail hangs in FRONT of the shirt from behind and behind the
       shoulders from the front, same as any other long hair */
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
      /* the elbow goes where the hand goes. Pinning it to the torso
         meant a raised arm bent at the shoulder and got no higher than
         her ear, which is a shrug and not a celebration. */
      var elbowY = shoulderY + Math.round(torsoH * 0.55) + Math.round(o[1] * 0.5);
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
      /* the captain's armband rides on the upper arm. Drawn at a fixed
         spot beside the chest it stayed there while the arm went up,
         and she celebrated goals next to a floating gold rectangle. */
      if (L.armband && side < 0) {
        var gd = P.fam.gold;
        var mx = Math.round((sx + ex2) / 2) - 1;
        var my = Math.round((shoulderY + 4 + elbowY) / 2) - 1;
        sh.rect(mx - 1, my, 4, 2, gd.base);
        sh.rect(mx - 1, my + 2, 4, 1, gd.shadow);
      }
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
  /* =======================================================================
     WHAT A PLAYER CAN BE DOING

     Eight of these shipped first: idle, run, kick, tackle, cheer, sad,
     dive, ready. That set has a hole in it you can see from across the
     room — there is no way to CHANGE DIRECTION and no way to STOP. A
     player went from eight-frames-a-second sprinting to a standing
     breathing idle between one frame and the next, and turned through a
     hundred and eighty degrees at full pace without anything happening
     in the sprite at all. The physics already knew better: turnCost has
     been shedding pace on a hard turn since it was written, and nothing
     ever drew it.

     And one animation was doing three jobs. `kick` played for a
     thirty-yard shot, a five-yard square pass and the keeper's
     distribution, so nothing about the sprite said which of those it
     was. Power in an animation is almost entirely ANTICIPATION — how
     far back the leg goes and how long it stays there — and a pass and
     a shot have completely different amounts of it.

       turn   plant the outside foot, drop the hips, come round
       stop   skid, weight back, settle
       trap   a foot out to meet the ball, body over it
       pass   side-foot: short wind-up, quick contact, no follow-through
       kick   the shot, which is all three of those made large
     ======================================================================= */
  var ANIMS = [
    { id: "idle", n: 4 }, { id: "run", n: 8 }, { id: "kick", n: 6 },
    { id: "pass", n: 5 }, { id: "turn", n: 4 }, { id: "stop", n: 3 },
    { id: "trap", n: 3 },
    { id: "tackle", n: 5 }, { id: "cheer", n: 6 }, { id: "sad", n: 3 },
    { id: "dive", n: 5 }, { id: "ready", n: 4 },
    /* the keeper's own three. He is the most-watched player on the
       pitch and he had two animations: a dive and a crouch. */
    { id: "catch", n: 3 }, { id: "punch", n: 4 }, { id: "throw", n: 4 },
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
