/* =========================================================================
   OUISSY'S CUP — the football one

   Four a side, two halves, three rounds and a trophy at the end of it.

   ---------------------------------------------------------------------
   WHAT IT IS AND WHY IT IS BUILT THIS WAY

   The reference was Toon Cup: a cartoon four-a-side with one thumbstick,
   one button, and a pitch that scrolls up and down while you run at the
   far goal. That is a good arcade football game and it is a very old
   one underneath — Sensible Soccer with nicer faces. What makes those
   games work is not the simulation, it is three things:

     1. You always control the player nearest the ball, and the game
        changes that for you without being asked.
     2. One button has to mean four things, and which four it means is
        decided by whether you have the ball and whether you are holding
        it down. Nobody reads a control list on a phone.
     3. The ball is not attached to anybody. It is a physical object with
        its own drag and its own height, and possession is just "whose
        foot is closest". Every fun thing in a football game — a tackle,
        a deflection, a loose ball in the box — falls out of that one
        decision, and none of it can happen if the ball is a property of
        a player.

   So the ball is a free body, the control switches itself, and the
   button is contextual. Everything else is dressing.

   ---------------------------------------------------------------------
   THE RULES THIS REPOSITORY IS BUILT ON, WHICH THIS FILE KEEPS

   - There is not an image file or an audio file in here. The pitch, the
     crowd, the players, the ball, the net, the flags and every sound
     are made at runtime. The whole chapter adds one script and nothing
     else to the site.
   - Sprites are PIXEL MAPS, one character per pixel, not shaded blobs.
     That rule is written down in HANDOFF.md and it was learned the hard
     way on the platformer: at sixteen pixels tall a blob-shaded face
     turns to mush. Every character in here is a grid of letters.
   - The view is 320x180 like the rest of the site, scaled up with
     image-rendering: pixelated, and the text is DOM over the top —
     because pixel text painted into a 320-wide buffer and blown up
     cannot be read, which the racer and the platformer both found out
     before this did.

   ---------------------------------------------------------------------
   WHO IS IN IT

   Her side is Morocco and she is the captain. The rest of the squad is
   borrowed from the other chapters: the cat that narrates the walk up
   the valley, the bear from the orchard, and Cogsworth out of the toy
   shop in goal, because a clockwork soldier who only moves when he has
   to is exactly what a goalkeeper is.

   Three rounds: Germany, then Brazil, then the final — and the final is
   against his side, playing under a small paper heart instead of a
   flag. It is the same paper heart she picks up in the first minute of
   The Long Way Round.

   ---------------------------------------------------------------------
   WHERE TO EDIT

   TUNE      how it feels to play: speeds, drag, how hard a shot is
   TEAMS     the four sides, their kits, their squads and their flags
   CUP       the three rounds and what is said before each of them
   Sprites   the pixel maps, further down, one section per character
   ========================================================================= */

window.OuissyCup = (function () {
  "use strict";

  /* Everything personal lives in cup.config.js and is read once, here.
     The fallback is not a second copy of the settings: it is only enough
     to stop the chapter throwing if that file fails to arrive, which on
     a static site means a bad deploy rather than a case worth designing
     around. */
  var CFG = window.CUP_CONFIG || {};
  function cfg(path, dflt) {
    var v = CFG, parts = path.split(".");
    for (var i = 0; i < parts.length; i++) {
      if (v == null) return dflt;
      v = v[parts[i]];
    }
    return v === undefined ? dflt : v;
  }
  var ROSTER = {};
  (cfg("ROSTER", []) || []).forEach(function (r) { ROSTER[r.id] = r; });
  var FALLBACK_LOOK = { name: "PLAYER", skin: "#e8c9a8", hair: "#5a4632",
                        head: "crop", build: { h: 1, w: 1 },
                        stats: { speed: 75, power: 75, skill: 75, defence: 75 } };

  /* A team, by id, out of the config. */
  function teamById(id) {
    var list = cfg("TEAMS", []);
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }
  /* A team's four, resolved from the roster, keeper first. A squad she
     has built herself arrives in exactly this shape, so nothing
     downstream knows or cares which kind it is looking at. */
  function squadOf(team) {
    var ids = (team && team.squad) || [];
    return ids.map(function (rid, i) {
      var r = ROSTER[rid] || FALLBACK_LOOK;
      return { id: rid, name: r.name || String(rid).toUpperCase(), face: rid,
               role: i === 0 ? "gk" : (r.role === "gk" ? "mid" : (r.role || "mid")),
               star: !!r.star, stats: r.stats || FALLBACK_LOOK.stats,
               captain: !!(team && team.captain === rid) };
    });
  }

  /* =======================================================================
     1. THE VIEW

     320x180, the house size. The pitch is exactly the width of it, so the
     whole width of the field is on screen at all times and the camera
     only ever moves up and down. That is deliberate: a football game
     where you cannot see the far touchline is a football game where you
     cannot pass, and on a phone there is no room to scroll two ways
     without losing the ball behind your own thumb.
     ======================================================================= */
  var VIEW = { w: 320, h: 180 };

  /* The world. y grows downward; she attacks UP the screen in the first
     half. The margin is the grass outside the lines, which exists so the
     pitch has somewhere to end — a white line flush against the edge of
     the screen reads as a UI border, not as a touchline. */
  var PITCH = {
    margin: 16,                 // grass outside the touchline
    w: 288,                     // playing area, left to right
    h: 404,                     // playing area, goal line to goal line
    goalW: 68,                  // the mouth of the goal
    goalDepth: 13,              // how far the net goes back
    boxW: 150, boxH: 56,        // the penalty area
    sixW: 82, sixH: 22,         // the six-yard box
    circleR: 46,                // the centre circle
    spot: 40,                   // penalty spot, out from the goal line
  };
  PITCH.x0 = PITCH.margin;
  PITCH.x1 = PITCH.margin + PITCH.w;
  PITCH.y0 = PITCH.margin + PITCH.goalDepth;         // their goal line
  PITCH.y1 = PITCH.y0 + PITCH.h;                     // her goal line
  PITCH.cx = (PITCH.x0 + PITCH.x1) / 2;
  PITCH.cy = (PITCH.y0 + PITCH.y1) / 2;
  var WORLD_H = PITCH.y1 + PITCH.goalDepth + PITCH.margin;

  /* =======================================================================
     2. TUNE — how it feels

     Every number that decides whether the game is fun is in this one
     object, and nothing outside it is a magic number. The comments say
     what each one trades against, because that is the part you cannot
     get back by reading the value.
     ======================================================================= */
  var TUNE = {
    /* --- running --- */
    runSpeed: 62,           // px/sec with the ball at your feet
    freeSpeed: 74,          // px/sec without it: chasing must beat carrying,
                            //   or a breakaway can never be caught and the
                            //   whole game becomes one long unopposed run
    sprintMul: 1.34,        // holding the button with no ball
    sprintDrain: 0.55,      // stamina per second while sprinting
    sprintFill: 0.30,       // and back per second while not
    accel: 420,             // px/sec^2 — high, because arcade football is
                            //   about direction, not about momentum
    turnEase: 15,           // how fast the sprite's facing catches up
    turnCost: 3.2,          // pace shed for turning hard at speed
    switchHold: 0.65,       // she keeps a player at least this long
    switchGap: 26,          // and a swap needs this much of a gap

    /* --- the ball --- */
    ballDrag: 0.86,         // per second, ground friction
    ballAirDrag: 0.30,      // in the air it keeps going
    gravity: 300,           // px/sec^2 for lofted balls
    bounce: 0.46,           // how much of the drop comes back
    dribbleReach: 9,        // how close a loose ball has to be to be won
    keepReach: 17,          // and how far the carrier can be shoved off it
                            //   before it counts as lost. Bigger than the
                            //   reach above on purpose: that asymmetry IS
                            //   shielding, and without it being crowded
                            //   loses you the ball for nothing
    dribblePush: 26,        // how far in front the carrier nudges it
    settle: 0.28,           // after winning it, nobody can touch it
    controlLock: 0.20,      // seconds after a touch before anyone else can
                            //   take it — without this two players standing
                            //   on the ball trade it sixty times a second
                            //   and it vibrates in place

    /* --- passing and shooting --- */
    passSpeed: 150,
    passLead: 0.30,         // seconds of lead given to a moving target
    shotMin: 130, shotMax: 260,
    chargeTime: 0.62,       // to a full-power shot
    shotLift: 0.42,         // how much of a full shot goes upward
    lobSpeed: 120,

    /* --- tackling --- */
    tackleReach: 13,
    tackleTime: 0.34,
    tackleCool: 0.55,
    tacklePush: 70,         // how hard the ball is knocked away

    /* --- the keeper --- */
    gkSpeed: 52,
    gkReach: 13,
    gkAnticipate: 0.34,     // how far ahead of the ball he reads
    gkHold: 1.1,            // seconds he holds it before rolling it out

    /* --- the match --- */
    halfSeconds: 52,        // real seconds per half; the clock on screen
                            //   runs 0' to 45' across it
    kickoffWait: 1.5,
    goalCheer: 3.2,
    goldenGoal: 60,         // sudden death if the final is level

    /* --- the camera --- */
    camEase: 5.2,
    camLead: 26,            // how far ahead of the ball it looks
  };

  /* =======================================================================
     3. THE TEAMS

     A kit is four colours and a stripe pattern; a squad is four named
     players, the first of whom is the keeper. `face` picks which set of
     head maps that player is drawn with, so the cat is a cat and the
     bear is a bear without either of them needing a body of their own.
     ======================================================================= */
  /* The sides used to be written out here. They live in cup.config.js
     now, along with eight more, and they are reached through teamById()
     — so nothing about a team is in this file any more: not its name,
     not its kit, and not who plays for it. */

  /* =======================================================================
     4. THE CUP

     Three rounds. `skill` is the one dial the opponents get: it scales
     how quickly they close down, how far ahead they read a pass and how
     often they shoot rather than carry. It is not a speed multiplier —
     an opponent who simply runs faster than you is not harder, it is
     unfair, and the difference is obvious within about ten seconds.
     ======================================================================= */
  /* The rounds, the opponents and the campuses all come out of
     cup.config.js. The draw is fixed so that the final is the derby —
     his faculty against hers — because that is the story the chapter is
     telling, and a random bracket would tell a different one. */
  var CUP = cfg("ROUNDS", []);


  /* =======================================================================
     5. THE CAST, AS THINGS IN A WORLD

     This chapter is 3D. It was pixel first — flat top-down sprites on a
     painted pitch, the same as every other chapter here — and it worked,
     but it was not what was asked for: the reference is a cartoon played
     on a real pitch with a camera behind the play, and a sprite on a
     texture cannot be that however carefully it is drawn.

     So the renderer is three.js, on vendor/three.bundle.js — the same
     bundle index.html already loads for the book intro and the same one
     the apocalypse runs on, so it costs the page nothing new.

     WHAT SURVIVED THE CHANGE, AND WHY THAT MATTERS: all of it except
     the drawing. The ball physics, possession, the tackling, the four
     AI brains, the keeper, the match clock, the cup — none of that ever
     knew what it looked like. It works in (x, y) with a height, and
     3D is that with the axes renamed: world x is x, world y is z, and
     the ball's height is y. A renderer is a renderer.

     A character is a look, not a model: a skin, a hair colour, a head
     shape and whatever that particular one brings with it — ears, a
     muzzle, a shako, a bun. The rig underneath is the same for all of
     them, which is what lets a cat and a bear and a tin soldier line up
     in the same kit without one of them needing a body of its own.
     ======================================================================= */
  var CAST = {
    ouissy:  { skin: "#f0cfae", hair: "#4a2f1c", head: "long",   build: 1.00 },
    anwar:   { skin: "#e0b189", hair: "#2f231b", head: "crop",   build: 1.06 },
    cat:     { skin: "#cfd4dc", hair: "#6b6f78", head: "ears",   build: 0.92, muzzle: "#f2f4f7", spot: "#e88fa4" },
    bear:    { skin: "#d9b98e", hair: "#7a5230", head: "bear",   build: 1.18, muzzle: "#e8d2b0", spot: "#3c2a1c" },
    soldier: { skin: "#e8c9a8", hair: "#2a2b33", head: "shako",  build: 0.96, spot: "#c8564a" },
    jester:  { skin: "#f0d8c0", hair: "#b46fd0", head: "jester", build: 0.94, spot: "#f5d020" },
    ballet:  { skin: "#fbe8dc", hair: "#e6b7cd", head: "bun",    build: 0.88 },
    zombie:  { skin: "#7d9a5e", hair: "#3f5230", head: "crop",   build: 1.04, eye: "#cfe89a" },
    blond:   { skin: "#f0cfae", hair: "#d9b25e", head: "crop",   build: 1.00 },
    dark:    { skin: "#a8764c", hair: "#2a2118", head: "crop",   build: 1.02 },
    curly:   { skin: "#8a5f3d", hair: "#38281c", head: "afro",   build: 1.00 },
    keeper:  { skin: "#e8c9a8", hair: "#5a4632", head: "crop",   build: 1.04 },
  };

  var INK = "#141a16";        /* the outline. Not black: pure black against
                                 this green reads as a hole, not an edge. */

  /* How tall a player is, in the same units the pitch is measured in.
     Deliberately huge next to a real footballer — the pitch is 288 by
     404 and a person is 15 — because that is the cartoon proportion the
     reference uses and it is what makes four players fill a pitch. */
  var PH = 15;

  /* the ball, which is the one object in here whose real size matters:
     it sets the roll rate and the reach of a foot */
  var BALL_R = 1.7;

  /* =======================================================================
     6. THE WORLD

     Axes: x across the pitch, z up and down it, y the sky. Everything the
     game thinks in is (x, y) and a height, so there is exactly one place
     that translates — `place()` — and nothing else in the file has to
     hold both ideas in its head at once.
     ======================================================================= */
  var THREE = null, renderer = null, scene = null, camera = null, goals = [];
  /* what a venue changes when the fixture moves to another campus */
  var VEN = { sky: null, ground: null, hemi: null, amb: null,
              stands: [], seats: [], masts: [], lamps: [], cur: null };
  var sun = null, pitchGroup = null, rigs = [], ballMesh = null, ballGroup = null;
  var shadowsOn = true;

  /* THE ONE PLACE THE TWO IDEAS MEET.
     The simulation thinks in (x across the pitch, y up it). The camera
     watches from the touchline, so on screen the LENGTH of the pitch
     runs left to right and the width runs into the distance:

         scene X  =  y   how far up the pitch      (screen left/right)
         scene Z  =  x   how far across it         (towards the camera)
         scene Y  =  height

     Every builder, every rig and the camera itself goes through here.
     Nothing else in the file holds both ideas at once. */
  function place(o, x, y, h) {
    o.position.set(y - PITCH.cy, h || 0, x - PITCH.cx);
  }
  function sceneX(y) { return y - PITCH.cy; }
  function sceneZ(x) { return x - PITCH.cx; }

  function loadThree() {
    if (THREE) return Promise.resolve(THREE);
    if (window.THREE) { THREE = window.THREE; return Promise.resolve(THREE); }
    return new Promise(function (res, rej) {
      var s = document.createElement("script");
      s.src = "vendor/three.bundle.js";
      s.onload = function () { THREE = window.THREE; res(THREE); };
      s.onerror = rej;
      document.head.appendChild(s);
    });
  }

  /* ---- textures, all painted into canvases at load ---- */
  function mkCanvas(w, h) {
    var c = document.createElement("canvas");
    c.width = w; c.height = h;
    return { c: c, x: c.getContext("2d") };
  }
  function tex(canvas, repX, repY) {
    var t = new THREE.CanvasTexture(canvas);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    if (repX || repY) {
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.repeat.set(repX || 1, repY || 1);
    }
    return t;
  }

  /* THE PITCH, painted flat and then laid on the ground.

     Four pixels of texture to one unit of world, which is enough that a
     goal line stays a crisp line when the camera is right on top of it
     and not so much that the texture costs more than the rest of the
     scene put together. */
  var TPX = 4;
  function pitchTexture() {
    var P = PITCH;
    var W = Math.round((P.w + P.margin * 2) * TPX);
    var H = Math.round((P.h + (P.goalDepth + P.margin) * 2) * TPX);
    var p = mkCanvas(W, H);
    var x = p.x;
    var ox = P.margin * TPX, oy = (P.goalDepth + P.margin) * TPX;

    /* The mown stripes, across the pitch the way they are cut — and
       then some wear in them. A pitch of two flat greens is a snooker
       table: what makes grass read as grass at this distance is that
       every band has a little variation along it and the middle is
       scuffed where everybody has been standing. */
    for (var i = 0; i < H; i++) {
      var band = Math.floor(i / (11 * TPX)) % 2;
      x.fillStyle = band ? (VEN.cur && VEN.cur.stripe || "#3f9b46")
                         : (VEN.cur && VEN.cur.grass || "#4bab52");
      x.fillRect(0, i, W, 1);
    }
    for (var n = 0; n < 5200; n++) {
      var gx = Math.random() * W, gy = Math.random() * H;
      x.fillStyle = Math.random() < 0.5 ? "rgba(255,255,255,.035)" : "rgba(0,50,10,.045)";
      x.fillRect(gx, gy, 2 + Math.random() * 7, 1);
    }
    /* the worn strip down the middle and the two goalmouths */
    var wear = x.createLinearGradient(0, 0, 0, H);
    wear.addColorStop(0, "rgba(150,130,70,.16)");
    wear.addColorStop(0.16, "rgba(150,130,70,0)");
    wear.addColorStop(0.84, "rgba(150,130,70,0)");
    wear.addColorStop(1, "rgba(150,130,70,.16)");
    x.fillStyle = wear;
    x.fillRect(W * 0.30, 0, W * 0.40, H);
    /* outside the touchline it is a shade deeper, so the playing area is
       the lit part of the picture rather than a rectangle of lines */
    x.fillStyle = "rgba(8,38,14,.20)";
    x.fillRect(0, 0, ox, H); x.fillRect(W - ox, 0, ox, H);
    x.fillRect(0, 0, W, oy); x.fillRect(0, H - oy, W, oy);

    var L = 0.9 * TPX;
    x.strokeStyle = "rgba(248,252,244,.92)";
    x.lineWidth = L;
    var box = function (bx, by, bw, bh) { x.strokeRect(bx, by, bw, bh); };
    box(ox, oy, P.w * TPX, P.h * TPX);
    x.beginPath();
    x.moveTo(ox, oy + (P.h / 2) * TPX); x.lineTo(ox + P.w * TPX, oy + (P.h / 2) * TPX);
    x.stroke();
    x.beginPath();
    x.arc(ox + (P.w / 2) * TPX, oy + (P.h / 2) * TPX, P.circleR * TPX, 0, Math.PI * 2);
    x.stroke();
    x.fillStyle = "rgba(248,252,244,.92)";
    x.beginPath();
    x.arc(ox + (P.w / 2) * TPX, oy + (P.h / 2) * TPX, 1.4 * TPX, 0, Math.PI * 2);
    x.fill();

    [0, 1].forEach(function (end) {
      var gl = oy + (end ? P.h : 0) * TPX;
      var sgn = end ? -1 : 1;
      box(ox + (P.w / 2 - P.boxW / 2) * TPX, end ? gl - P.boxH * TPX : gl,
          P.boxW * TPX, P.boxH * TPX);
      box(ox + (P.w / 2 - P.sixW / 2) * TPX, end ? gl - P.sixH * TPX : gl,
          P.sixW * TPX, P.sixH * TPX);
      var spotY = gl + sgn * P.spot * TPX;
      x.beginPath();
      x.arc(ox + (P.w / 2) * TPX, spotY, 1.4 * TPX, 0, Math.PI * 2);
      x.fill();
      /* the D, which everybody can draw from memory and nobody includes */
      x.beginPath();
      x.arc(ox + (P.w / 2) * TPX, spotY, 30 * TPX,
            end ? Math.PI : 0, end ? Math.PI * 2 : Math.PI);
      x.stroke();
    });
    return p.c;
  }

  /* the net: a transparent canvas with a grid on it, tiled */
  function netTexture() {
    var n = mkCanvas(64, 64);
    var x = n.x;
    x.strokeStyle = "rgba(255,255,255,.78)";
    x.lineWidth = 3;
    for (var i = 0; i <= 64; i += 16) {
      x.beginPath(); x.moveTo(i, 0); x.lineTo(i, 64); x.stroke();
      x.beginPath(); x.moveTo(0, i); x.lineTo(64, i); x.stroke();
    }
    return n.c;
  }

  /* the stand: rows of little people, seeded off their index so the
     crowd does not shimmer when the camera moves across it */
  var CROWD_COLS = ["#e0607f", "#f5d020", "#5fb0d6", "#f2f2ef", "#b46fd0",
                    "#7f9a5e", "#e88a4a", "#c1272d", "#4a5f86", "#e6b7cd"];
  function crowdTexture() {
    var c = mkCanvas(512, 128);
    var x = c.x;
    x.fillStyle = "#1c2933"; x.fillRect(0, 0, 512, 128);
    for (var r = 0; r < 128; r += 16) {
      x.fillStyle = "rgba(0,0,0,.22)";
      x.fillRect(0, r + 13, 512, 3);
      for (var i = 0; i < 512; i += 14) {
        var s = (i * 7 + r * 31) % CROWD_COLS.length;
        var jitter = ((i * 13 + r * 7) % 5) - 2;
        x.fillStyle = CROWD_COLS[s];
        x.fillRect(i + 3 + (r / 16 % 2) * 7, r + 4 + jitter, 8, 9);
        x.fillStyle = ["#f0cfae", "#c9926a", "#8a5f3d", "#e8c9a8"][(i + r) % 4];
        x.beginPath();
        x.arc(i + 7 + (r / 16 % 2) * 7, r + 3 + jitter, 3.4, 0, Math.PI * 2);
        x.fill();
      }
    }
    return c.c;
  }

  /* the advertising boards, which are what stop the crowd bleeding into
     the grass and are the one place the other chapters get a mention */
  function boardTexture() {
    var c = mkCanvas(1024, 64);
    var x = c.x;
    var words = ["THE LONG WAY ROUND", "SUPER OUISSY", "WICK & COGS TOYS",
                 "MEMORY LANE", "2207", "OUISSY'S CUP"];
    var bg = ["#12324a", "#c1272d", "#1f6f4a", "#3a3f6b", "#8a2f5e", "#12324a"];
    for (var i = 0; i < 6; i++) {
      x.fillStyle = bg[i];
      x.fillRect(i * 171, 0, 171, 64);
      x.fillStyle = "rgba(255,255,255,.92)";
      x.font = "bold 30px 'Silkscreen', monospace";
      x.textAlign = "center"; x.textBaseline = "middle";
      x.fillText(words[i], i * 171 + 85, 34);
    }
    return c.c;
  }

  function skyTexture(v) {
    v = v || {};
    var c = mkCanvas(8, 256);
    var g = c.x.createLinearGradient(0, 0, 0, 256);
    g.addColorStop(0, v.sky || "#2f7fc4");
    g.addColorStop(0.62, mixHex(v.sky || "#2f7fc4", v.horizon || "#dfeef5", 0.55));
    g.addColorStop(1, v.horizon || "#dfeef5");
    c.x.fillStyle = g; c.x.fillRect(0, 0, 8, 256);
    return c.c;
  }
  function mixHex(a, b, t) {
    var A = parseInt(a.slice(1), 16), B = parseInt(b.slice(1), 16);
    var r = Math.round((((A >> 16) & 255) * (1 - t)) + (((B >> 16) & 255) * t));
    var g2 = Math.round(((((A >> 8) & 255)) * (1 - t)) + ((((B >> 8) & 255)) * t));
    var b2 = Math.round(((A & 255) * (1 - t)) + ((B & 255) * t));
    return "#" + ((1 << 24) + (r << 16) + (g2 << 8) + b2).toString(16).slice(1);
  }

  /* ---- materials ---- */
  function toon(col, opts) {
    opts = opts || {};
    var m = new THREE.MeshToonMaterial({ color: new THREE.Color(col) });
    if (opts.map) m.map = opts.map;
    if (opts.transparent) { m.transparent = true; m.opacity = opts.opacity; }
    if (opts.side) m.side = opts.side;
    return m;
  }
  /* The outline: a copy of the mesh, grown a little and turned inside
     out. It is the single thing that makes a cartoon look drawn rather
     than modelled, and it is why the reference reads the way it does. */
  function outline(mesh, grow) {
    var o = new THREE.Mesh(mesh.geometry, new THREE.MeshBasicMaterial({
      color: new THREE.Color(INK), side: THREE.BackSide,
    }));
    o.scale.multiplyScalar(grow || 1.07);
    o.position.copy(mesh.position);
    o.rotation.copy(mesh.rotation);
    o.renderOrder = -1;
    return o;
  }

  /* ---- the stadium ---- */
  function buildWorld() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color("#8fc9e8");
    scene.fog = new THREE.Fog(new THREE.Color("#a8d6ea"), 380, 760);

    var P = PITCH;
    var fullW = P.w + P.margin * 2, fullH = P.h + (P.goalDepth + P.margin) * 2;

    /* the sky, on the inside of a big dome */
    var sky = new THREE.Mesh(
      new THREE.SphereGeometry(900, 24, 16),
      new THREE.MeshBasicMaterial({ map: tex(skyTexture()), side: THREE.BackSide, fog: false })
    );
    scene.add(sky);
    VEN.sky = sky;

    /* the grass the stadium is standing on, beyond the pitch itself */
    var around = new THREE.Mesh(
      new THREE.PlaneGeometry(fullH + 240, fullW + 240),
      toon("#3c8c42")
    );
    around.rotation.x = -Math.PI / 2;
    around.position.y = -0.4;
    around.receiveShadow = true;
    scene.add(around);

    pitchGroup = new THREE.Group();
    scene.add(pitchGroup);

    /* the pitch texture is painted the way the simulation thinks — long
       axis vertical — so the plane is laid out long-axis-horizontal and
       the texture is turned a quarter turn to match rather than being
       painted twice */
    var pt = tex(pitchTexture());
    pt.center.set(0.5, 0.5);
    pt.rotation = Math.PI / 2;
    var ground = new THREE.Mesh(new THREE.PlaneGeometry(fullH, fullW), toon("#ffffff", { map: pt }));
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    pitchGroup.add(ground);
    VEN.ground = ground;

    buildGoal(0);
    buildGoal(1);
    buildStands(fullW, fullH);
    buildCornerFlags();

    /* ---- light. A cartoon wants one strong key and a lot of bounce:
       the shadows are what put the players ON the grass, and the fill is
       what stops the shaded side of a head going muddy. ---- */
    VEN.hemi = new THREE.HemisphereLight(new THREE.Color("#cfe9ff"),
                                         new THREE.Color("#2f6b34"), 1.15);
    scene.add(VEN.hemi);
    sun = new THREE.DirectionalLight(new THREE.Color("#fff6e0"), 2.1);
    sun.position.set(-120, 240, 150);
    sun.castShadow = true;
    /* The shadow camera follows the ball rather than covering the whole
       pitch. A map stretched over 288 by 404 units is a map with about
       three texels per player on it, and what that looks like is a
       smudge — so it covers a hundred units around the action instead
       and moves with it. */
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.left = -110; sun.shadow.camera.right = 110;
    sun.shadow.camera.top = 110; sun.shadow.camera.bottom = -110;
    sun.shadow.camera.near = 10; sun.shadow.camera.far = 620;
    sun.shadow.bias = -0.0022;
    sun.shadow.normalBias = 0.6;
    scene.add(sun);
    scene.add(sun.target);
    VEN.amb = new THREE.AmbientLight(new THREE.Color("#ffffff"), 0.35);
    scene.add(VEN.amb);
  }

  /* =======================================================================
     THE VENUE

     Six faculties, five campuses, and every fixture played at one of
     them. A venue is an hour of the day more than it is a place: the
     sky, the key light, how much bounce there is, the turf and the
     concrete all move together, and that is enough to make the same
     pitch read as Marrakech at half six and Casablanca at eleven.

     The floodlit one is the important one. It is the final, and the
     derby, and it needs far more ambient than a daylight match or
     every face on the pitch goes to silhouette and the game stops
     being readable — which is the whole trap with night lighting.
     ======================================================================= */
  function venueById(id) {
    var list = cfg("VENUES", []);
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return list[0] || null;
  }

  function applyVenue(id) {
    var v = venueById(id);
    if (!v || !scene) return;
    VEN.cur = v;

    scene.background = new THREE.Color(v.horizon || "#8fc9e8");
    if (scene.fog) {
      scene.fog.color.set(v.horizon || "#a8d6ea");
      if (v.fog) { scene.fog.near = v.fog[0]; scene.fog.far = v.fog[1]; }
    }
    if (VEN.sky) {
      if (VEN.sky.material.map) VEN.sky.material.map.dispose();
      VEN.sky.material.map = tex(skyTexture(v));
      VEN.sky.material.needsUpdate = true;
    }
    if (sun) {
      sun.color.set(v.sun || "#fff6e0");
      sun.intensity = v.sunStrength || 2.1;
    }
    if (VEN.hemi) {
      VEN.hemi.color.set(mixHex(v.sky || "#cfe9ff", "#ffffff", 0.35));
      VEN.hemi.groundColor.set(v.stripe || "#2f6b34");
      VEN.hemi.intensity = v.floodlit ? 0.75 : 1.15;
    }
    if (VEN.amb) VEN.amb.intensity = v.ambient || 0.35;

    /* the turf is baked into a texture, so a new campus means a new one.
       Once per fixture, which is nothing. */
    if (VEN.ground) {
      if (VEN.ground.material.map) VEN.ground.material.map.dispose();
      var pt = tex(pitchTexture());
      pt.center.set(0.5, 0.5); pt.rotation = Math.PI / 2;
      VEN.ground.material.map = pt;
      VEN.ground.material.needsUpdate = true;
    }
    VEN.stands.forEach(function (m) { if (m.material.color) m.material.color.set(v.stand || "#5b6570"); });
    /* the crowd goes darker at night and brighter in the sun, which is
       what stops a night stand reading as a black wall */
    var seatTone = v.seats === "warm" ? "#c8a878" : v.seats === "bright" ? "#ffffff" : "#e8eef2";
    VEN.seats.forEach(function (m) { if (m.material.color) m.material.color.set(seatTone); });
    /* floodlights only burn when the fixture needs them */
    VEN.lamps.forEach(function (l) {
      l.material.color.set(v.floodlit ? "#fffbe8" : "#7e8894");
    });
    /* Under lights the grass goes cooler and a shade down, and the key
       light comes from above rather than across. Left at daylight
       values a night match is simply a dark sky over a sunny pitch,
       which reads as a mistake rather than as an evening. */
    if (VEN.ground && VEN.ground.material.color) {
      VEN.ground.material.color.set(v.floodlit ? "#cfe0e8" : "#ffffff");
    }
    VEN.masts.forEach(function (m) { m.visible = true; });
  }

  function buildGoal(end) {
    var P = PITCH;
    var gl = end ? P.y1 : P.y0;
    var sgn = end ? 1 : -1;                    // which way the net goes back
    var g = new THREE.Group();
    var postR = 1.1, H = 13, halfW = P.goalW / 2, D = P.goalDepth;
    var white = toon("#f8fbf4");

    var bar = new THREE.Mesh(new THREE.CylinderGeometry(postR, postR, P.goalW, 10), white);
    bar.rotation.z = Math.PI / 2;
    bar.position.set(0, H, 0);
    bar.castShadow = true;
    g.add(bar); g.add(outline(bar, 1.16));

    [-1, 1].forEach(function (s) {
      var post = new THREE.Mesh(new THREE.CylinderGeometry(postR, postR, H, 10), white);
      post.position.set(s * halfW, H / 2, 0);
      post.castShadow = true;
      g.add(post); g.add(outline(post, 1.16));
    });

    /* the net: a back and two sides, and a roof, in one tiled texture */
    var nt = tex(netTexture(), 5, 3);
    var netMat = new THREE.MeshBasicMaterial({
      map: nt, transparent: true, side: THREE.DoubleSide, depthWrite: false, opacity: 0.85,
    });
    var back = new THREE.Mesh(new THREE.PlaneGeometry(P.goalW, H), netMat);
    back.position.set(0, H / 2, sgn * D);
    g.add(back);
    /* kept, so a goal can push the back of the net out and let it
       settle — a ball that goes in and changes nothing has not gone in */
    g.userData.netBack = back;
    g.userData.restZ = sgn * D;
    g.userData.sgn = sgn;
    goals[end] = g;
    [-1, 1].forEach(function (s) {
      var side = new THREE.Mesh(new THREE.PlaneGeometry(D, H), netMat);
      side.rotation.y = Math.PI / 2;
      side.position.set(s * halfW, H / 2, sgn * D / 2);
      g.add(side);
    });
    var roof = new THREE.Mesh(new THREE.PlaneGeometry(P.goalW, D), netMat);
    roof.rotation.x = Math.PI / 2;
    roof.position.set(0, H, sgn * D / 2);
    g.add(roof);

    place(g, P.cx, gl, 0);
    /* built with its mouth along local X; the mouth spans the WIDTH of
       the pitch, which is scene Z now, so it turns a quarter */
    g.rotation.y = Math.PI / 2;
    pitchGroup.add(g);
  }

  function buildStands(fullW, fullH) {
    var ct = tex(crowdTexture(), 8, 1);
    var bt = tex(boardTexture(), 3, 1);
    var crowdMat = toon("#ffffff", { map: ct });
    var boardMat = toon("#ffffff", { map: bt });
    var concrete = toon("#5b6570");
    var steel = toon("#8e98a4");

    /* Four sides. `along` is how long that side of the ground is and
       `out` is how far from the middle it sits; the two ends are short
       and the two touchlines are long, and in this view the touchlines
       are the ones you see. */
    var sides = [
      { rot: 0,             along: fullH, out: fullW / 2 + 14, axis: "z", sign: 1 },
      { rot: Math.PI,       along: fullH, out: fullW / 2 + 14, axis: "z", sign: -1 },
      { rot: Math.PI / 2,   along: fullW, out: fullH / 2 + 14, axis: "x", sign: 1 },
      { rot: -Math.PI / 2,  along: fullW, out: fullH / 2 + 14, axis: "x", sign: -1 },
    ];
    sides.forEach(function (sd) {
      var grp = new THREE.Group();

      var board = new THREE.Mesh(new THREE.BoxGeometry(sd.along, 7, 2.4), boardMat);
      board.position.set(0, 3.5, 0);
      board.castShadow = true;
      grp.add(board);

      /* the rake of seats, and a lip of concrete under it so the stand
         does not appear to be balancing on the advertising */
      /* OUTWARD. Every part of a stand is placed along its own local
         +z, which each side's rotation turns into "away from the
         pitch". Built along -z, as these were, the four stands are
         erected across the grass: the rake lands on the touchline, the
         roof hangs over the penalty area, and the pillars stand in the
         middle of the picture like scaffolding nobody took down. */
      var kerb = new THREE.Mesh(new THREE.BoxGeometry(sd.along + 26, 6, 10), concrete);
      kerb.position.set(0, 3, 7);
      grp.add(kerb);

      var rake = new THREE.Mesh(new THREE.BoxGeometry(sd.along + 26, 52, 58), crowdMat);
      rake.position.set(0, 26, 34);
      rake.rotation.x = 0.32;
      grp.add(rake);

      var roof = new THREE.Mesh(new THREE.BoxGeometry(sd.along + 40, 3.5, 66), concrete);
      roof.position.set(0, 60, 46);
      grp.add(roof);
      for (var i = -2; i <= 2; i++) {
        var col = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 60, 8), steel);
        col.position.set(i * (sd.along / 5), 30, 74);
        grp.add(col);
      }

      grp.rotation.y = sd.rot;
      if (sd.axis === "z") grp.position.set(0, 0, sd.sign * sd.out);
      else grp.position.set(sd.sign * sd.out, 0, 0);
      pitchGroup.add(grp);
      VEN.stands.push(kerb, roof);
      VEN.seats.push(rake);
    });

    /* four floodlights, one per corner, because a stadium at this hour
       has them on and they are the tallest thing in the picture */
    [[1, 1], [1, -1], [-1, 1], [-1, -1]].forEach(function (c) {
      var m = new THREE.Group();
      var mast = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 2.4, 96, 8), toon("#7b8590"));
      mast.position.y = 48;
      m.add(mast);
      var rigM = new THREE.Mesh(new THREE.BoxGeometry(22, 13, 3), toon("#4b535c"));
      rigM.position.set(0, 98, 0);
      m.add(rigM);
      for (var a = 0; a < 3; a++) for (var b2 = 0; b2 < 2; b2++) {
        var lamp = new THREE.Mesh(new THREE.BoxGeometry(5.6, 4.6, 1.4),
          new THREE.MeshBasicMaterial({ color: new THREE.Color("#fff7d8") }));
        lamp.position.set((a - 1) * 7, 98 + (b2 ? 3.2 : -3.2), 1.9);
        m.add(lamp);
        VEN.lamps.push(lamp);
      }
      m.position.set(c[0] * (fullH / 2 + 46), 0, c[1] * (fullW / 2 + 40));
      pitchGroup.add(m);
      VEN.masts.push(m);
    });
  }

  function buildCornerFlags() {
    var P = PITCH;
    [[P.x0, P.y0], [P.x1, P.y0], [P.x0, P.y1], [P.x1, P.y1]].forEach(function (c) {
      var g = new THREE.Group();
      var pole = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 10, 6), toon("#f8fbf4"));
      pole.position.y = 5;
      g.add(pole);
      var flag = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 3.2),
                                toon("#f5d020", { side: THREE.DoubleSide }));
      flag.position.set(2.3, 8.6, 0);
      g.add(flag);
      place(g, c[0], c[1], 0);
      pitchGroup.add(g);
    });
  }

  /* =======================================================================
     7. A PLAYER, BUILT

     Big head, small body, thick outline — the cartoon proportion. Every
     part is a primitive and every part is named, because the run cycle
     is just four rotations and a bob and it needs to reach them.
     ======================================================================= */
  function buildRig(pl) {
    /* `pl` is either a player on the pitch or a bare {face, teamId, gk}
       from a menu or a harness. Either way the look comes out of the
       roster in cup.config.js and the kit comes off the team. */
    var look = ROSTER[pl.face] || ROSTER[pl.id] || FALLBACK_LOOK;
    var team = teamById(pl.teamId) || teamById("mar") || {};
    var kit = pl.kit || (pl.gk ? team.gkKit : team.kit) || {
      shirt: "#c1272d", shirtDark: "#8f1a20", shorts: "#0e6b3c",
      shortsDark: "#08492a", socks: "#c1272d", trim: "#ffffff" };
    var bh = (look.build && look.build.h) || 1;
    var bw = (look.build && look.build.w) || 1;
    var b = 1;
    var g = new THREE.Group();
    var parts = { group: g, build: { h: bh, w: bw }, look: look };

    var skinM = toon(look.skin);
    var shirtM = toon(kit.shirt);
    var shortM = toon(kit.shorts);
    var sockM = toon(kit.socks);
    var bootM = toon("#26221f");
    var hairM = toon(look.hair);

    /* legs */
    parts.legs = [-1, 1].map(function (s) {
      var leg = new THREE.Group();
      var thigh = new THREE.Mesh(new THREE.CapsuleGeometry(1.15 * b, 2.6 * b, 4, 8), shortM);
      thigh.position.y = -1.6 * b;
      thigh.castShadow = true;
      leg.add(thigh);
      var shin = new THREE.Mesh(new THREE.CapsuleGeometry(1.0 * b, 2.4 * b, 4, 8), sockM);
      shin.position.y = -4.1 * b;
      shin.castShadow = true;
      leg.add(shin);
      var boot = new THREE.Mesh(new THREE.BoxGeometry(2.1 * b, 1.3 * b, 3.2 * b), bootM);
      boot.position.set(0, -5.8 * b, 0.5 * b);
      boot.castShadow = true;
      leg.add(boot);
      leg.position.set(s * 1.5 * b, 6.4 * b, 0);
      g.add(leg);
      return leg;
    });

    /* body */
    var torso = new THREE.Mesh(new THREE.CapsuleGeometry(2.9 * b, 2.6 * b, 5, 12), shirtM);
    torso.position.y = 8.4 * b;
    torso.castShadow = true;
    g.add(torso); g.add(outline(torso, 1.11));
    parts.torso = torso;

    /* the number on the back, which is the one bit of kit detail that
       reads from where this camera sits */
    var numM = toon(kit.trim);
    var num = new THREE.Mesh(new THREE.CircleGeometry(1.5 * b, 12), numM);
    num.position.set(0, 9.1 * b, -2.75 * b);
    num.rotation.y = Math.PI;
    g.add(num);

    /* arms */
    parts.arms = [-1, 1].map(function (s) {
      var arm = new THREE.Group();
      var up = new THREE.Mesh(new THREE.CapsuleGeometry(0.85 * b, 2.0 * b, 4, 8), shirtM);
      up.position.y = -1.3 * b;
      arm.add(up);
      var lo = new THREE.Mesh(new THREE.CapsuleGeometry(0.78 * b, 2.0 * b, 4, 8),
                              pl.gk ? toon(kit.trim) : skinM);
      lo.position.y = -3.6 * b;
      lo.castShadow = true;
      arm.add(lo);
      arm.position.set(s * 3.3 * b, 9.8 * b, 0);
      arm.rotation.z = s * 0.14;
      g.add(arm);
      return arm;
    });

    /* head */
    var head = new THREE.Group();
    head.position.y = 12.6 * b;
    var skull = new THREE.Mesh(new THREE.SphereGeometry(3.2 * b, 18, 14), skinM);
    skull.castShadow = true;
    head.add(skull); head.add(outline(skull, 1.10));
    parts.head = head;

    /* eyes, always two, always on the front, because a head with no eyes
       is a ball and you cannot tell which way a ball is facing */
    var eyeM = toon("#ffffff");
    var pupilM = toon(look.eye || "#1b1712");
    /* Set close together and well forward. The first pair sat at 1.15
       out and 2.62 deep, which is still on the sphere but far enough
       round it that from the front they read as eyes on the SIDES of the
       head — the character looked like a fish. A face wants its eyes
       inside the middle third of it. */
    [-1, 1].forEach(function (s) {
      var w = new THREE.Mesh(new THREE.SphereGeometry(0.80 * b, 10, 8), eyeM);
      w.position.set(s * 0.95 * b, 0.30 * b, 2.85 * b);
      w.scale.set(1, 1.2, 0.52);
      head.add(w);
      var pu = new THREE.Mesh(new THREE.SphereGeometry(0.38 * b, 8, 6), pupilM);
      pu.position.set(s * 1.0 * b, 0.22 * b, 3.16 * b);
      head.add(pu);
    });
    /* and a mouth, for the ones whose face is not already a muzzle */
    if (!look.muzzle) {
      var mouth = new THREE.Mesh(new THREE.SphereGeometry(0.62 * b, 10, 8),
                                 toon(look.head === "crop" && look.eye ? "#2a3820" : "#8a3b44"));
      mouth.position.set(0, -1.35 * b, 2.86 * b);
      mouth.scale.set(1.5, 0.55, 0.4);
      head.add(mouth);
    }

    addHead(head, look, b, hairM, skinM);
    g.add(head);

    /* the ground shadow, which is a fallback for when the real ones are
       switched off on a slow device rather than a decoration */
    /* a hand on the end of each arm — one more ball, and the cheapest
       thing there is that stops an arm reading as a stick */
    parts.arms.forEach(function (arm) {
      var hand = new THREE.Mesh(new THREE.SphereGeometry(0.95 * b, 8, 6),
                                pl.gk ? toon("#f0e6d2") : skinM);
      hand.position.y = -5.0 * b;
      arm.add(hand);
    });
    /* the captain's armband, in the colour their super burns */
    if (look.armband) {
      var bandM = new THREE.Mesh(new THREE.CylinderGeometry(1.0 * b, 1.0 * b, 1.1 * b, 8),
                                 toon(look.super ? look.super.colour : "#ffd45e"));
      bandM.position.set(-3.3 * b, 8.3 * b, 0);
      bandM.rotation.z = 0.14;
      g.add(bandM);
    }

    var blob = new THREE.Mesh(new THREE.CircleGeometry(3.4 * b, 16),
      new THREE.MeshBasicMaterial({ color: new THREE.Color("#12401c"),
                                    transparent: true, opacity: 0.26, depthWrite: false }));
    blob.rotation.x = -Math.PI / 2;
    blob.position.y = 0.18;
    g.add(blob);
    parts.blob = blob;

    /* THE SILHOUETTE. Height and width come from the roster, and they
       are the first thing that tells one of these from another at the
       distance the game is played at: Boulder is half again as wide as
       Comet and you can still tell them apart with the colour turned
       off, which is the test. */
    g.scale.set(bw, bh, bw);
    return parts;
  }

  /* WHAT EACH ONE HAS ON TOP.

     This is where the roster stops being a table and becomes fourteen
     different people. The rule every one is built to: it must be
     tellable from the others with the colour turned off. Flame hair,
     goggles on a forehead, a flat cap, a bun, shoulder pads — each is a
     different OUTLINE, because at the size this is played at the
     outline arrives about a tenth of a second before anything inside it
     does. */
  function addHead(head, look, b, hairM, skinM) {
    var kind = look.head;
    var accent = toon((look.colour && look.colour.c) || "#ffd45e");
    var cap = function (frac, lift) {
      var m = new THREE.Mesh(new THREE.SphereGeometry(3.3 * b, 18, 14,
        0, Math.PI * 2, 0, Math.PI * (frac || 0.52)), hairM);
      m.position.y = (lift === undefined ? 0.16 : lift) * b;
      head.add(m);
      return m;
    };

    if (kind === "ouissy") {
      cap(0.62, 0.12);
      [-1, 1].forEach(function (s) {
        var fall = new THREE.Mesh(new THREE.CapsuleGeometry(0.98 * b, 4.0 * b, 4, 8), hairM);
        fall.position.set(s * 2.15 * b, -2.3 * b, -0.7 * b);
        fall.rotation.z = s * 0.10;
        head.add(fall);
      });
      var back = new THREE.Mesh(new THREE.SphereGeometry(2.7 * b, 14, 12), hairM);
      back.position.set(0, -1.1 * b, -1.6 * b);
      head.add(back);

    } else if (kind === "anwar") {
      cap(0.50, 0.18);
      var fr = new THREE.Mesh(new THREE.BoxGeometry(5.0 * b, 0.9 * b, 1.2 * b), hairM);
      fr.position.set(0, 1.9 * b, 2.2 * b);
      head.add(fr);

    } else if (kind === "flame") {
      /* Ember: five spikes of different heights leaning back — the only
         head in the game with a jagged top edge. */
      cap(0.46, 0.2);
      [[-2.0, 2.6, -0.4], [-0.9, 3.9, 0.2], [0.2, 4.8, -0.1],
       [1.3, 3.6, 0.3], [2.2, 2.4, -0.3]].forEach(function (sp) {
        var f = new THREE.Mesh(new THREE.ConeGeometry(0.85 * b, sp[1] * b, 5), hairM);
        f.position.set(sp[0] * b, (2.0 + sp[1] * 0.42) * b, sp[2] * b);
        f.rotation.x = -0.32; f.rotation.z = -sp[0] * 0.09;
        f.castShadow = true;
        head.add(f);
      });

    } else if (kind === "goggles") {
      /* Comet: goggles pushed up on the forehead — a hard horizontal
         bar across a round head, which reads instantly. */
      cap(0.50, 0.18);
      var strap = new THREE.Mesh(new THREE.CylinderGeometry(3.32 * b, 3.32 * b, 1.3 * b,
                                                           16, 1, true), toon("#2b3340"));
      strap.position.y = 1.5 * b;
      head.add(strap);
      [-1, 1].forEach(function (s) {
        var lens = new THREE.Mesh(new THREE.CylinderGeometry(1.15 * b, 1.15 * b, 0.6 * b, 10), accent);
        lens.rotation.x = Math.PI / 2;
        lens.position.set(s * 1.35 * b, 1.7 * b, 2.5 * b);
        head.add(lens);
      });

    } else if (kind === "bun") {
      cap(0.58, 0.14);
      var bun = new THREE.Mesh(new THREE.SphereGeometry(1.5 * b, 12, 10), hairM);
      bun.position.set(0, 2.5 * b, -2.2 * b);
      bun.castShadow = true;
      head.add(bun);
      if (look.charm) {
        var ch = new THREE.Mesh(new THREE.BoxGeometry(1.1 * b, 1.4 * b, 1.1 * b), accent);
        ch.position.set(2.7 * b, -1.6 * b, 0.6 * b);
        head.add(ch);
      }

    } else if (kind === "sprig") {
      cap(0.56, 0.14);
      var tail = new THREE.Mesh(new THREE.CapsuleGeometry(1.0 * b, 3.4 * b, 4, 8), hairM);
      tail.position.set(0, -1.4 * b, -2.6 * b);
      tail.rotation.x = 0.5;
      head.add(tail);
      [0, 1, 2].forEach(function (i) {
        var lf = new THREE.Mesh(new THREE.SphereGeometry(0.62 * b, 8, 6), accent);
        lf.scale.set(0.5, 1.5, 0.9);
        lf.position.set(2.6 * b, (1.4 + i * 0.9) * b, -1.0 * b);
        lf.rotation.z = -0.4 - i * 0.16;
        head.add(lf);
      });

    } else if (kind === "phones") {
      var c7 = cap(0.54, 0.14);
      c7.scale.set(1.12, 1, 1);
      var flick = new THREE.Mesh(new THREE.BoxGeometry(2.4 * b, 2.6 * b, 1.4 * b), hairM);
      flick.position.set(-2.4 * b, 1.1 * b, 0.8 * b);
      flick.rotation.z = 0.5;
      head.add(flick);
      var bandH = new THREE.Mesh(new THREE.TorusGeometry(2.6 * b, 0.42 * b, 6, 14, Math.PI),
                                 toon("#3a3f4a"));
      bandH.rotation.z = Math.PI;
      bandH.position.y = -2.6 * b;
      head.add(bandH);
      [-1, 1].forEach(function (s) {
        var cu = new THREE.Mesh(new THREE.CylinderGeometry(1.0 * b, 1.0 * b, 0.9 * b, 10), accent);
        cu.rotation.z = Math.PI / 2;
        cu.position.set(s * 2.7 * b, -2.4 * b, 0);
        head.add(cu);
      });

    } else if (kind === "flat") {
      /* Boulder: no neck, a squat head and a flat top — the widest and
         lowest outline on the pitch. */
      var sq = new THREE.Mesh(new THREE.BoxGeometry(5.6 * b, 3.0 * b, 5.0 * b), hairM);
      sq.position.y = 1.9 * b;
      sq.castShadow = true;
      head.add(sq); head.add(outline(sq, 1.07));
      var brow = new THREE.Mesh(new THREE.BoxGeometry(5.0 * b, 0.7 * b, 0.8 * b), hairM);
      brow.position.set(0, 0.9 * b, 2.7 * b);
      head.add(brow);

    } else if (kind === "pads") {
      cap(0.48, 0.18);
      [-1, 1].forEach(function (s) {
        var pad = new THREE.Mesh(new THREE.ConeGeometry(1.9 * b, 2.4 * b, 4), accent);
        pad.position.set(s * 3.5 * b, -3.2 * b, 0);
        pad.rotation.z = -s * 0.5;
        pad.castShadow = true;
        head.add(pad);
      });

    } else if (kind === "willow") {
      cap(0.58, 0.12);
      [-1, -0.45, 0.45, 1].forEach(function (s, i) {
        var str = new THREE.Mesh(new THREE.CapsuleGeometry(0.62 * b, 6.2 * b, 4, 6), hairM);
        str.position.set(s * 2.3 * b, -3.6 * b, -1.2 * b + (i % 2) * 0.6 * b);
        str.rotation.z = s * 0.12;
        head.add(str);
      });

    } else if (kind === "cap") {
      var crown = new THREE.Mesh(new THREE.SphereGeometry(3.3 * b, 14, 10,
        0, Math.PI * 2, 0, Math.PI * 0.46), accent);
      crown.position.y = 0.5 * b;
      crown.scale.set(1.05, 0.8, 1.05);
      crown.castShadow = true;
      head.add(crown);
      var peak = new THREE.Mesh(new THREE.BoxGeometry(4.6 * b, 0.5 * b, 2.6 * b), accent);
      peak.position.set(0, 1.5 * b, 2.6 * b);
      head.add(peak);
      [-1, 1].forEach(function (s) {
        var bw2 = new THREE.Mesh(new THREE.BoxGeometry(1.5 * b, 0.6 * b, 0.7 * b), hairM);
        bw2.position.set(s * 1.1 * b, 1.35 * b, 2.75 * b);
        bw2.rotation.z = -s * 0.22;
        head.add(bw2);
      });

    } else if (kind === "pony") {
      cap(0.52, 0.16);
      var tie = new THREE.Mesh(new THREE.SphereGeometry(0.85 * b, 8, 6), accent);
      tie.position.set(0, 2.6 * b, -2.0 * b);
      head.add(tie);
      var pony = new THREE.Mesh(new THREE.CapsuleGeometry(0.95 * b, 4.6 * b, 4, 8), hairM);
      pony.position.set(0, 1.0 * b, -3.6 * b);
      pony.rotation.x = 0.85;
      pony.castShadow = true;
      head.add(pony);

    } else {
      cap(0.52, 0.16);                       /* "crop", and anything new */
    }
  }

  /* =======================================================================
     8. SOUND

     No files, like everything else. A crowd is filtered noise that swells
     when something happens; a whistle is two square waves a fifth apart
     with a wobble on them; a kick is a click and a thump together.

     It goes on the site's audio register with a wake and a sleep, so
     leaving the page stops the crowd and coming back starts it again —
     the machinery for that lives in script.js and every chapter uses it.
     ======================================================================= */
  var AC = null, master = null, crowdGain = null, crowdSrc = null,
      registered = false, soundOn = true, noiseBuf = null;

  function audio() {
    if (AC) return AC;
    try {
      AC = window.hvSharedCtx ? window.hvSharedCtx()
                              : new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) { return null; }
    if (!AC) return null;
    master = AC.createGain();
    master.gain.value = 0.9;
    master.connect(AC.destination);

    var len = Math.floor(AC.sampleRate * 2);
    noiseBuf = AC.createBuffer(1, len, AC.sampleRate);
    var d = noiseBuf.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;

    if (window.registerAudio && !registered) {
      registered = true;
      window.registerAudio(function () { return AC; }, wakeSound, sleepSound);
    }
    return AC;
  }

  function startCrowd() {
    if (!audio() || crowdSrc || !soundOn) return;
    crowdSrc = AC.createBufferSource();
    crowdSrc.buffer = noiseBuf; crowdSrc.loop = true;
    var band = AC.createBiquadFilter();
    band.type = "bandpass"; band.frequency.value = 520; band.Q.value = 0.7;
    crowdGain = AC.createGain(); crowdGain.gain.value = 0.018;
    crowdSrc.connect(band); band.connect(crowdGain); crowdGain.connect(master);
    crowdSrc.start();
  }
  function stopCrowd() {
    if (!crowdSrc) return;
    try { crowdSrc.stop(); } catch (e) {}
    crowdSrc = null; crowdGain = null;
  }
  /* the stand getting louder, which is the only feedback in the game that
     something good is about to happen or just has */
  function crowdSwell(amount, secs) {
    if (!crowdGain || !AC) return;
    var t = AC.currentTime;
    crowdGain.gain.cancelScheduledValues(t);
    crowdGain.gain.setValueAtTime(crowdGain.gain.value, t);
    crowdGain.gain.linearRampToValueAtTime(0.018 + amount, t + 0.12);
    crowdGain.gain.linearRampToValueAtTime(0.018, t + (secs || 1.4));
  }

  function tone(type, f0, f1, dur, vol, delay) {
    if (!audio() || !soundOn) return;
    var t = AC.currentTime + (delay || 0);
    var o = AC.createOscillator(), g = AC.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(master);
    o.start(t); o.stop(t + dur + 0.02);
  }
  function burst(dur, vol, freq, q) {
    if (!audio() || !soundOn) return;
    var t = AC.currentTime;
    var s = AC.createBufferSource(); s.buffer = noiseBuf;
    var f = AC.createBiquadFilter();
    f.type = "bandpass"; f.frequency.value = freq; f.Q.value = q || 1;
    var g = AC.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(master);
    s.start(t); s.stop(t + dur + 0.02);
  }

  var SFX = {
    kick:    function () { burst(0.07, 0.22, 1400, 1.2); tone("sine", 180, 70, 0.10, 0.18); },
    pass:    function () { burst(0.05, 0.13, 1100, 1.4); tone("sine", 150, 80, 0.07, 0.10); },
    shot:    function () { burst(0.09, 0.30, 1700, 1.0); tone("sine", 220, 60, 0.14, 0.24); },
    tackle:  function () { burst(0.13, 0.18, 380, 0.8); },
    post:    function () { tone("square", 900, 520, 0.16, 0.16); },
    net:     function () { burst(0.22, 0.12, 2600, 0.6); },
    save:    function () { burst(0.10, 0.20, 700, 1.0); tone("sine", 120, 60, 0.12, 0.14); },
    whistle: function () {
      tone("square", 2100, 2100, 0.20, 0.10);
      tone("square", 3150, 3150, 0.20, 0.07);
    },
    longWhistle: function () {
      tone("square", 2100, 2100, 0.70, 0.10);
      tone("square", 3150, 3150, 0.70, 0.07);
    },
    goal: function () {
      crowdSwell(0.16, 3.0);
      [0, 0.13, 0.26, 0.46].forEach(function (d, i) {
        tone("square", [523, 659, 784, 1046][i], [523, 659, 784, 1046][i], 0.28, 0.09, d);
      });
    },
    concede: function () { tone("sawtooth", 200, 120, 0.5, 0.10); crowdSwell(0.05, 1.6); },
    pick:    function () { tone("square", 620, 900, 0.07, 0.07); },
  };

  function wakeSound() {
    if (!playing || !soundOn) return;
    startCrowd();
  }
  function sleepSound() { stopCrowd(); }

  /* =======================================================================
     9. THE MATCH

     `G` is the whole of it. There is no other mutable state in this file
     except the sprite cache and the audio graph, which means a match can
     be thrown away and restarted by assigning a new G — and that is what
     the round card does between games.

     One decision worth explaining because it looks like a shortcut and
     is not: THE BALL NEVER GOES OUT OF PLAY. The pitch is boarded, and
     the ball rebounds off the touchlines and off the goal lines either
     side of the posts. The reference does the same thing. Throw-ins,
     corners and goal kicks are four more restarts to write, four more
     states to be stuck in, and every one of them stops the game — which
     in a match that lasts ninety seconds is most of the match. Arcade
     football is continuous; that is the genre.
     ======================================================================= */
  var G = null, playing = false, raf = null, lastT = 0, acc = 0;
  var EL = {}, stage = null, cvs = null;
  var FIXED = 1 / 60;

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function len(x, y) { return Math.sqrt(x * x + y * y); }
  function dist(a, b) { return len(a.x - b.x, a.y - b.y); }

  /* which way this team is kicking. She attacks up the screen in the
     first half and they change ends, like everybody does. */
  function attackDir(team) {
    var up = (team === 0) === (G.half === 1);
    return up ? -1 : 1;
  }
  function goalY(team) { return attackDir(team) < 0 ? PITCH.y0 : PITCH.y1; }
  function ownGoalY(team) { return attackDir(team) < 0 ? PITCH.y1 : PITCH.y0; }

  /* Formation, in the team's own attacking frame: `up` is 0 at their own
     goal line and 1 at the one they are shooting at, `across` is 0 at the
     left touchline and 1 at the right. Kept as fractions so the same four
     numbers work whichever end a side is kicking towards. */
  var SLOTS = {
    gk:  { up: 0.035, across: 0.5 },
    def: { up: 0.26,  across: 0.5 },
    mid: { up: 0.50,  across: 0.34 },
    st:  { up: 0.70,  across: 0.62 },
  };
  function slotPos(pl) {
    var s = SLOTS[pl.role] || SLOTS.mid;
    var d = attackDir(pl.team);
    var own = ownGoalY(pl.team);
    return {
      x: PITCH.x0 + s.across * PITCH.w,
      y: own + d * s.up * PITCH.h,
    };
  }

  function makePlayer(teamIdx, teamId, def, i) {
    return {
      team: teamIdx, teamId: teamId, def: def, name: def.name,
      face: def.face, role: def.role, gk: def.role === "gk", star: !!def.star,
      x: 0, y: 0, vx: 0, vy: 0,
      dir: attackDirSafe(teamIdx), anim: 0, legs: "stand",
      facing: "down", flip: false,
      tackleT: 0, coolT: 0, stamina: 1, hold: 0, idx: i,
    };
  }
  /* makePlayer runs while G is still being built, so it cannot ask
     attackDir which needs G.half */
  function attackDirSafe(teamIdx) { return teamIdx === 0 ? -Math.PI / 2 : Math.PI / 2; }

  function newMatch(roundIdx, opts) {
    opts = opts || {};
    var round = (opts && opts.round) || CUP[roundIdx] || CUP[0] ||
                { skill: 0.5, round: "MATCH", venue: "rabat" };
    var g = {
      roundIdx: roundIdx, round: round,
      ids: [(opts && opts.mine) || run.myTeam || "fmpm",
            (opts && opts.theirs) || round.id],
      venue: (opts && opts.venue) || round.venue || "rabat",
      score: [0, 0], half: 1, clock: 0,
      state: "kickoff", stateT: 0, msg: "",
      players: [], ball: { x: PITCH.cx, y: PITCH.cy, z: 0, vx: 0, vy: 0, vz: 0,
                           owner: null, lastTouch: null, lock: 0, spin: 0,
                           curve: 0, struck: 0 },
      timeScale: 1, scoredBy: 0, scorerP: null, celebration: "armsUp",
      cam: { y: PITCH.cy },
      controlled: null, kickoffTeam: 0, golden: false, over: false,
      shake: 0, flash: 0, scorer: "", stat: { shots: [0, 0], poss: [0, 0] },
    };
    g.ids.forEach(function (id, t) {
      squadOf(teamById(id)).forEach(function (def, i) {
        g.players.push(makePlayer(t, id, def, i));
      });
    });
    return g;
  }

  /* everybody back to their own half for a kickoff; the side taking it
     puts one player on the ball */
  function resetPositions(kickTeam) {
    G.ball.x = PITCH.cx; G.ball.y = PITCH.cy;
    G.ball.z = 0; G.ball.vx = G.ball.vy = G.ball.vz = 0;
    G.ball.owner = null; G.ball.lastTouch = null; G.ball.lock = 0;
    G.players.forEach(function (p) {
      var s = slotPos(p);
      var d = attackDir(p.team);
      /* pulled back into their own half, which is what a kickoff is */
      p.x = s.x; p.y = s.y - d * PITCH.h * 0.10;
      if (p.gk) { p.x = PITCH.cx; p.y = ownGoalY(p.team) + d * 8; }
      p.vx = p.vy = 0; p.tackleT = 0; p.coolT = 0; p.hold = 0;
      p.legs = "stand"; p.stamina = 1;
    });
    var taker = G.players.filter(function (p) { return p.team === kickTeam && p.role === "st"; })[0];
    if (taker) { taker.x = PITCH.cx - 7; taker.y = PITCH.cy + attackDir(kickTeam) * -6; }
    G.cam.y = PITCH.cy;
    pickControlled(true);
  }

  /* =======================================================================
     10. WHO YOU ARE

     You are always the outfield player nearest the ball. That is the one
     rule that makes a four-a-side game playable with one stick: without
     it you spend the match running a defender up the pitch behind play
     and never touch the ball.

     It does NOT switch while you are carrying — taking the player away
     from somebody mid-dribble is the single most infuriating thing an
     arcade football game can do, and it used to happen here every time a
     teammate drifted a pixel closer to the ball than the carrier's own
     centre point.
     ======================================================================= */
  var switchT = 0;
  function pickControlled(force, dt) {
    switchT += dt || 0;
    var mine = G.players.filter(function (p) { return p.team === 0 && !p.gk; });
    if (!mine.length) return;

    /* if one of hers has the ball, that IS the one she is driving —
       no distance test, no cooldown, no argument */
    if (G.ball.owner && G.ball.owner.team === 0 && !G.ball.owner.gk) {
      if (G.controlled !== G.ball.owner) { G.controlled = G.ball.owner; switchT = 0; }
      return;
    }
    /* and it never switches away while she is carrying it */
    if (!force && G.controlled && G.ball.owner === G.controlled) return;

    var best = null, bd = 1e9;
    mine.forEach(function (p) {
      var d = dist(p, G.ball);
      if (d < bd) { bd = d; best = p; }
    });
    if (!best) return;
    if (force || !G.controlled) { G.controlled = best; switchT = 0; return; }
    if (best === G.controlled) return;

    /* HYSTERESIS, AND A MINIMUM STAY.

       Picking the nearest player every frame switched control five
       hundred and forty-seven times in a hundred-second match —
       measured — which is about five times a second. Nobody can play
       that: the moment you start running somewhere, you are somebody
       else standing somewhere different. So a swap now needs the new
       candidate to be properly closer, not a pixel closer, and she
       gets to keep whoever she has for a beat first. */
    if (switchT < TUNE.switchHold) return;
    var mineD = dist(G.controlled, G.ball);
    if (bd > mineD - TUNE.switchGap) return;
    G.controlled = best;
    switchT = 0;
  }

  /* =======================================================================
     11. THE BALL

     A free body. Nobody owns it; a player is "on" it when their feet are
     within reach and the short lock from the last touch has run out.

     The lock is not decoration. Without it, two players standing over the
     ball each take it sixty times a second, and what you see is a ball
     vibrating in place between two people while neither of them can do
     anything with it.
     ======================================================================= */
  function ballStep(dt) {
    var b = G.ball;
    b.lock = Math.max(0, b.lock - dt);

    if (b.owner) {
      /* carried: the ball is pushed a little in front of the foot, and it
         is still a physical object — it just has somewhere to be */
      var o = b.owner;
      /* The touch. She pushes it further in front the faster she is
         going and keeps it under her when she slows, which is what
         dribbling is; a ball welded a fixed distance ahead cannot be
         shielded and cannot be knocked off anybody. */
      var osp = len(o.vx, o.vy);
      var push = TUNE.dribblePush * (0.20 + Math.min(0.42, osp * 0.0062));
      var tx = o.x + Math.cos(o.dir) * push;
      var ty = o.y + Math.sin(o.dir) * push;
      b.x += (tx - b.x) * Math.min(1, dt * 11);
      b.y += (ty - b.y) * Math.min(1, dt * 11);
      b.z = Math.max(0, b.z - dt * 40);
      b.vx = o.vx; b.vy = o.vy;
      b.spin += len(o.vx, o.vy) * dt * 0.4;
      return;
    }

    b.x += b.vx * dt; b.y += b.vy * dt;
    b.spin += len(b.vx, b.vy) * dt * 0.05;

    if (b.z > 0 || b.vz !== 0) {
      b.vz -= TUNE.gravity * dt;
      b.z += b.vz * dt;
      if (b.z <= 0) {
        b.z = 0;
        if (Math.abs(b.vz) > 22) { b.vz = -b.vz * TUNE.bounce; }
        else b.vz = 0;
      }
    }
    /* the bend, applied across the direction of travel and dying away
       with the pace, so it curls most while it is still flying */
    if (b.curve) {
      var spd = len(b.vx, b.vy);
      if (spd > 30) {
        var cx2 = -b.vy / spd, cy2 = b.vx / spd;
        b.vx += cx2 * b.curve * dt;
        b.vy += cy2 * b.curve * dt;
        b.curve *= Math.pow(0.35, dt);
      } else b.curve = 0;
    }
    b.struck = Math.max(0, (b.struck || 0) - dt * 5);
    var drag = Math.pow(b.z > 2 ? TUNE.ballAirDrag : TUNE.ballDrag, dt);
    b.vx *= drag; b.vy *= drag;
    if (len(b.vx, b.vy) < 3) { b.vx = 0; b.vy = 0; }

    boardsAndGoals();
  }

  /* The boards. The ball comes off them; the only gaps are the two goal
     mouths, and going through one of those is the point of the game. */
  function boardsAndGoals() {
    var b = G.ball, P = PITCH;
    var gx0 = P.cx - P.goalW / 2, gx1 = P.cx + P.goalW / 2;

    if (b.x < P.x0 + 2) { b.x = P.x0 + 2; b.vx = Math.abs(b.vx) * 0.62; SFX.tackle(); }
    if (b.x > P.x1 - 2) { b.x = P.x1 - 2; b.vx = -Math.abs(b.vx) * 0.62; SFX.tackle(); }

    [0, 1].forEach(function (end) {
      var gl = end ? P.y1 : P.y0;
      var past = end ? b.y > gl : b.y < gl;
      if (!past) return;
      var inMouth = b.x > gx0 + 1 && b.x < gx1 - 1;
      /* over the bar is not a goal. The crossbar is four pixels up,
         which is the whole reason a shot has any height at all. */
      if (inMouth && b.z < 4.2) {
        /* Whose goal this is, asked rather than assumed. It used to be
           `scored(end ? 0 : 1)`, which is right for one half and exactly
           backwards for the other — they change ends, so the top goal
           belongs to a different side after the break and a hard-coded
           end credits every second-half goal to the team that conceded
           it. ownGoalY knows; nothing else has to. */
        if (b.y * (end ? 1 : -1) > (gl + (end ? 2 : -2)) * (end ? 1 : -1)) {
          var conceded = ownGoalY(0) === gl ? 0 : 1;
          scored(1 - conceded);
        }
        return;
      }
      if (inMouth && b.z >= 4.2) {
        /* over: it comes back off the stanchion rather than leaving the
           world, because there is no out of play here */
        b.y = gl - (end ? 1 : -1) * 2; b.vy = -b.vy * 0.5; SFX.post();
        return;
      }
      b.y = gl + (end ? -2 : 2); b.vy = -b.vy * 0.62; SFX.tackle();
    });
  }

  function kickBall(from, ang, speed, lift, bender) {
    var b = G.ball;
    b.owner = null;
    b.lastTouch = from;
    b.lock = TUNE.controlLock;
    b.vx = Math.cos(ang) * speed;
    b.vy = Math.sin(ang) * speed;
    b.vz = lift || 0;
    /* BEND. A ball struck by somebody running across it keeps some of
       that sideways momentum as spin, and spin pulls it through the
       air. It is one line of Magnus and it is the difference between a
       shot that travels and a shot that is aimed. */
    b.curve = bender ? clamp((-Math.sin(ang) * bender.vx + Math.cos(ang) * bender.vy) * 0.85, -70, 70) : 0;
    b.struck = 1;
    b.x = from.x + Math.cos(ang) * 6;
    b.y = from.y + Math.sin(ang) * 6;
  }

  /* WHO IS ON THE BALL.

     This was the worst thing in the game and it did not look like a bug.
     Anyone whose feet came within nine pixels of the ball took it — so
     with eight players converging, and separate() shoving them through
     each other, the ball changed hands about seven times a second.
     Measured: an average possession lasted 0.14 SECONDS and two thirds
     of the match had nobody in charge of the ball at all. What that
     feels like to play is a rolling object being chased by a crowd, and
     no amount of camera work or celebration rescues it.

     So possession is now something you TAKE, not something you walk
     into:

       - a loose ball goes to the nearest player who can reach it
       - a carried ball CANNOT be taken by proximity, at any distance,
         by anybody. It comes loose when it is tackled, when it is
         kicked, or when the carrier is knocked far enough off it
       - the carrier's own reach is bigger than a challenger's, so
         shielding works and being crowded does not simply lose it

     That single change is the difference between a football game and a
     game of bulldog with a ball in it. */
  function resolvePossession() {
    var b = G.ball;
    if (b.lock > 0) return;
    if (b.z > 7) { if (b.owner) b.owner = null; return; }

    /* somebody already has it: they keep it until it is taken off them */
    if (b.owner) {
      var o = b.owner;
      var away = len(o.x - b.x, o.y - b.y);
      if (away > TUNE.keepReach) b.owner = null;       // knocked off it
      return;
    }

    var best = null, bd = TUNE.dribbleReach;
    G.players.forEach(function (p) {
      if (p.tackleT > 0 && !p.gk) return;
      var d = len(p.x - b.x, p.y - b.y);
      var reach = p.gk && inBox(p, b) ? TUNE.gkReach : TUNE.dribbleReach;
      if (d < reach && d < bd) { bd = d; best = p; }
    });
    if (!best) return;
    b.owner = best;
    b.lastTouch = best;
    /* a settle, so the instant after a tackle is not a scramble in which
       the same two players trade it forty times */
    b.lock = TUNE.settle;
    if (best.gk && inBox(best, b)) {
      best.hold = TUNE.gkHold;
      if (len(b.vx, b.vy) > 90) {
        best.diveDir = (b.x < best.x) ? 1 : -1;
        setAnim(best, "dive", 0.55);
        crowdSwell(0.05, 1.0);
      }
      SFX.save();
    }
  }

  function inBox(p, b) {
    var gl = ownGoalY(p.team);
    var near = Math.abs(b.y - gl) < PITCH.boxH;
    return near && Math.abs(b.x - PITCH.cx) < PITCH.boxW / 2;
  }

  /* =======================================================================
     12. A GOAL
     ======================================================================= */
  function scored(team) {
    if (G.state !== "play") return;
    G.score[team]++;
    G.state = "goal"; G.stateT = 0;
    var by = G.ball.lastTouch && G.ball.lastTouch.team === team ? G.ball.lastTouch : null;
    G.scorer = by ? by.name : "";
    G.scoredBy = team;
    G.scorerP = by || nearestTo(G.ball, team, true);
    G.celebration = G.scorerP && G.scorerP.face === "ouissy"
      ? "heart"                                  // hers is her own
      : CELEBRATIONS[Math.floor(Math.random() * CELEBRATIONS.length)];
    if (G.scorerP) setAnim(G.scorerP, G.celebration, TUNE.goalCheer);
    /* the moment stretches, then lets go. Half a second of slow motion
       is the difference between a number changing and something
       happening. */
    G.timeScale = 0.35;
    setCamMode("goal", G.scorerP, TUNE.goalCheer);
    confettiBurst(G.scorerP || G.ball, team === 0 ? 150 : 40);
    G.kickoffTeam = 1 - team;
    G.flash = 1; G.shake = 1;
    G.ball.vx = G.ball.vy = G.ball.vz = 0; G.ball.owner = null;
    /* which net just bulged: the one she was shooting at */
    var endHit = ownGoalY(0) === PITCH.y0 ? (team === 0 ? 1 : 0) : (team === 0 ? 0 : 1);
    var gg = goals[endHit];
    if (gg) gg.userData.bulge = 1;
    SFX.net();
    if (team === 0) SFX.goal(); else SFX.concede();
    banner(team === 0
      ? (G.scorer ? G.scorer + "!" : "GOAL!")
      : "THEY SCORE", team === 0 ? "good" : "bad");
    if (G.golden) endMatch();
  }

  /* =======================================================================
     13. THE PLAYERS

     Everybody runs the same way. The only difference between the one you
     are driving and the other seven is where the direction comes from:
     yours comes from a thumb, theirs comes from `think`.
     ======================================================================= */
  function moveTo(p, tx, ty, dt, speedMul) {
    var dx = tx - p.x, dy = ty - p.y;
    var d = len(dx, dy);
    if (d < 1.2) { p.vx *= 0.7; p.vy *= 0.7; return; }
    driveP(p, dx / d, dy / d, dt, speedMul);
  }

  function driveP(p, ux, uy, dt, speedMul) {
    var carrying = G.ball.owner === p;
    var base = carrying ? TUNE.runSpeed : TUNE.freeSpeed;
    var top = base * (speedMul || 1);
    /* TURNING COSTS SOMETHING. Steering used to be free: full speed in
       one direction became full speed in the opposite one inside a
       frame, and what that feels like is a cursor rather than a person.
       A hard turn now sheds pace, which is also what makes a defender
       committing to a tackle a mistake she can punish. */
    var sp0 = len(p.vx, p.vy);
    if (sp0 > 12) {
      var dot = (p.vx * ux + p.vy * uy) / sp0;
      if (dot < 0.5) {
        var bite = (0.5 - dot) * TUNE.turnCost * dt;
        p.vx -= p.vx * bite; p.vy -= p.vy * bite;
      }
    }
    p.vx += (ux * top - p.vx) * Math.min(1, TUNE.accel / top * dt);
    p.vy += (uy * top - p.vy) * Math.min(1, TUNE.accel / top * dt);
    if (ux || uy) {
      var want = Math.atan2(uy, ux);
      var diff = Math.atan2(Math.sin(want - p.dir), Math.cos(want - p.dir));
      p.dir += diff * Math.min(1, TUNE.turnEase * dt);
    }
  }

  function playerStep(p, dt) {
    animStep(p, dt);
    p.coolT = Math.max(0, p.coolT - dt);
    p.hold = Math.max(0, p.hold - dt);
    if (p.tackleT > 0) {
      p.tackleT -= dt;
      p.vx *= 0.90; p.vy *= 0.90;
      p.legs = "slide";
      if (p.tackleT <= 0) p.coolT = TUNE.tackleCool;
    }
    p.x += p.vx * dt; p.y += p.vy * dt;
    p.x = clamp(p.x, PITCH.x0 - 4, PITCH.x1 + 4);
    p.y = clamp(p.y, PITCH.y0 - 10, PITCH.y1 + 10);

    /* `legs` is down to two poses now. It used to name a frame of a
       four-frame pixel run cycle; the rig swings its own legs off a sine
       wave, so all the simulation still has to say is whether this
       player is on their feet or sliding. */
    if (p.tackleT <= 0) p.legs = len(p.vx, p.vy) > 6 ? "run" : "stand";
  }

  /* players do not stand inside each other */
  function separate() {
    for (var i = 0; i < G.players.length; i++) {
      for (var j = i + 1; j < G.players.length; j++) {
        var a = G.players[i], b = G.players[j];
        var dx = b.x - a.x, dy = b.y - a.y;
        var d = len(dx, dy);
        if (d > 8.5 || d === 0) continue;
        var push = (8.5 - d) / 2;
        dx /= d; dy /= d;
        if (!a.gk) { a.x -= dx * push; a.y -= dy * push; }
        if (!b.gk) { b.x += dx * push; b.y += dy * push; }
      }
    }
  }

  /* =======================================================================
     14. WHAT THE OTHER SEVEN ARE THINKING

     `skill` is the only dial. It moves how tightly they close down, how
     far ahead they read a pass and how willing they are to shoot from
     distance. It deliberately does NOT move their top speed: an opponent
     who simply runs faster than you is not a harder game, it is a rigged
     one, and it takes about ten seconds to feel the difference.
     ======================================================================= */
  function think(p, dt) {
    var skill = p.team === 0 ? 0.55 : G.round.skill;
    var b = G.ball;
    if (p.gk) return thinkKeeper(p, dt, skill);

    var mineHasBall = b.owner && b.owner.team === p.team;
    var slot = slotPos(p);
    var d = attackDir(p.team);

    if (b.owner === p) return thinkCarrier(p, dt, skill);

    if (mineHasBall) {
      /* make a run: push up the pitch, and get away from whoever has it
         so there is somewhere to pass to */
      var tx = slot.x + (p.x < b.owner.x ? -18 : 18);
      var ty = slot.y + d * PITCH.h * 0.12 + (b.y - PITCH.cy) * 0.45;
      moveTo(p, clamp(tx, PITCH.x0 + 8, PITCH.x1 - 8),
             clamp(ty, PITCH.y0 + 10, PITCH.y1 - 10), dt, 0.92);
      return;
    }

    /* the nearest one chases; on her team the controlled player is the
       chaser, so the rest hold shape instead of all piling in */
    /* WHO GOES FOR IT.

       This line is why her team lost every match 0-4 without having a
       single shot. It read: I am the chaser if I am nearest AND NOT
       (this is her team and she is driving an outfielder). She is
       ALWAYS driving an outfielder — that is what the chapter does —
       so on her side the condition was permanently false and none of
       her players ever chased the ball. The one she was steering was
       excluded from think() anyway, being hers to run, so between them
       nobody on her team went for it at all: measured at 0% possession,
       0 shots, and 0% of the match spent in the opposition box.

       The rule that was meant: the nearest player chases — and if the
       nearest happens to be the one she is driving, the next nearest
       goes instead, so her team is never standing about waiting for
       her to do all of it herself. */
    var chaser = nearestTo(b, p.team, true);
    if (p.team === 0 && chaser === G.controlled) {
      chaser = nearestTo(b, 0, true, G.controlled);
    }
    var iAmChaser = chaser === p;

    if (iAmChaser) {
      var lead = TUNE.gkAnticipate * skill;
      var tx2 = b.x + b.vx * lead, ty2 = b.y + b.vy * lead;
      moveTo(p, tx2, ty2, dt, 1 + skill * 0.10);
      /* a tackle, when it is worth one */
      if (b.owner && b.owner.team !== p.team && p.coolT <= 0 &&
          dist(p, b) < TUNE.tackleReach + 3 && Math.random() < 0.6 * skill) {
        startTackle(p);
      }
      return;
    }
    /* everybody else drops between the ball and their own goal */
    var goalx = PITCH.cx, goaly = ownGoalY(p.team);
    var mix = 0.34 + skill * 0.18;
    moveTo(p, clamp(slot.x * (1 - mix) + (b.x * 0.6 + goalx * 0.4) * mix, PITCH.x0 + 8, PITCH.x1 - 8),
           clamp(slot.y * (1 - mix) + (b.y * 0.55 + goaly * 0.45) * mix, PITCH.y0 + 10, PITCH.y1 - 10),
           dt, 0.9);
  }

  function thinkCarrier(p, dt, skill) {
    var gy = goalY(p.team), d = attackDir(p.team);
    var toGoal = Math.abs(p.y - gy);
    var press = nearestOpponent(p);
    var pressed = press && dist(press, p) < 22;

    /* shoot */
    if (toGoal < 95 + skill * 45 && Math.abs(p.x - PITCH.cx) < 70) {
      if (Math.random() < (0.02 + skill * 0.06) || (pressed && Math.random() < 0.05)) {
        return shoot(p, 0.55 + Math.random() * 0.45);
      }
    }
    /* pass, if there is somebody better off */
    if (pressed && Math.random() < 0.05 + skill * 0.08) {
      var mate = bestPass(p);
      if (mate) return passTo(p, mate);
    }
    /* otherwise carry it, angling away from the nearest opponent */
    var ux = (PITCH.cx - p.x) * 0.01, uy = d;
    if (press) {
      var ax = p.x - press.x, ay = p.y - press.y;
      var ad = len(ax, ay) || 1;
      ux += (ax / ad) * 0.8; uy += (ay / ad) * 0.25;
    }
    var m = len(ux, uy) || 1;
    driveP(p, ux / m, uy / m, dt, 1);
  }

  function thinkKeeper(p, dt, skill) {
    var b = G.ball, gl = ownGoalY(p.team), d = attackDir(p.team);
    if (G.ball.owner === p) {
      if (p.hold <= 0) {
        var mate = bestPass(p) || nearestTo(p, p.team, true);
        if (mate) passTo(p, mate, true); else shoot(p, 0.6);
      }
      return;
    }
    /* he tracks the ball across his line, never further out than the
       six-yard box unless the ball is loose inside the area */
    var tx = PITCH.cx + clamp(b.x - PITCH.cx, -PITCH.goalW * 0.45, PITCH.goalW * 0.45);
    var ty = gl + d * 6;
    var threat = Math.abs(b.y - gl) < PITCH.boxH * 0.9 &&
                 Math.abs(b.x - PITCH.cx) < PITCH.boxW / 2;
    if (threat && (!b.owner || b.owner.team !== p.team)) {
      ty = gl + d * (8 + (1 - skill) * 4);
      if (!b.owner && Math.abs(b.y - gl) < 30) { tx = b.x; ty = b.y; }
    }
    moveTo(p, tx, ty, dt, TUNE.gkSpeed / TUNE.freeSpeed);
  }

  function nearestTo(thing, team, outfieldOnly, except) {
    var best = null, bd = 1e9;
    G.players.forEach(function (p) {
      if (p.team !== team) return;
      if (outfieldOnly && p.gk) return;
      if (except && p === except) return;
      var d = len(p.x - thing.x, p.y - thing.y);
      if (d < bd) { bd = d; best = p; }
    });
    return best;
  }
  function nearestOpponent(p) {
    var best = null, bd = 1e9;
    G.players.forEach(function (o) {
      if (o.team === p.team) return;
      var d = dist(o, p);
      if (d < bd) { bd = d; best = o; }
    });
    return best;
  }

  /* the teammate who is most worth the ball: ahead of you, not marked,
     and not so far away that the pass takes a week */
  function bestPass(p) {
    var d = attackDir(p.team), best = null, bs = -1e9;
    G.players.forEach(function (m) {
      if (m === p || m.team !== p.team || m.gk) return;
      var ahead = (m.y - p.y) * d;
      var far = dist(m, p);
      if (far > 165) return;
      var mark = nearestOpponent(m);
      var space = mark ? Math.min(40, dist(mark, m)) : 40;
      var s = ahead * 1.15 + space * 1.4 - far * 0.30;
      if (s > bs) { bs = s; best = m; }
    });
    return best;
  }

  function passTo(p, mate, soft) {
    var lead = TUNE.passLead;
    var tx = mate.x + mate.vx * lead, ty = mate.y + mate.vy * lead;
    var ang = Math.atan2(ty - p.y, tx - p.x);
    var far = len(tx - p.x, ty - p.y);
    var sp = clamp(far * 1.9, 95, TUNE.passSpeed * 1.35);
    kickBall(p, ang, soft ? sp * 0.8 : sp, 0);
    setAnim(p, "kick", 0.34);
    SFX.pass();
  }

  function shoot(p, power) {
    var gy = goalY(p.team);
    /* aimed at a random point inside the mouth rather than at the middle,
       which is what stops every shot in the game being the same shot */
    var aimX = PITCH.cx + (Math.random() - 0.5) * PITCH.goalW * 0.62;
    var ang = Math.atan2(gy - p.y, aimX - p.x);
    var sp = TUNE.shotMin + (TUNE.shotMax - TUNE.shotMin) * power;
    kickBall(p, ang, sp, power * TUNE.shotLift * 46, p);
    setAnim(p, "kick", 0.34);
    G.stat.shots[p.team]++;
    SFX.shot();
    crowdSwell(0.03, 0.8);
  }

  function startTackle(p) {
    p.tackleT = TUNE.tackleTime;
    setAnim(p, "slide", TUNE.tackleTime + 0.12);
    var b = G.ball;
    if (dist(p, b) < TUNE.tackleReach && b.owner && b.owner.team !== p.team) {
      var ang = Math.atan2(b.y - p.y, b.x - p.x);
      b.owner = null; b.lastTouch = p; b.lock = TUNE.controlLock;
      b.vx = Math.cos(ang) * TUNE.tacklePush;
      b.vy = Math.sin(ang) * TUNE.tacklePush;
      SFX.tackle();
    }
  }

  /* =======================================================================
     15. THE THUMB

     One stick and one button, and the button means four things:

        no ball, tap      tackle
        no ball, hold     sprint
        ball, tap         pass
        ball, hold        wind up a shot, release to hit it

     Nobody reads a control list on a phone, so the button also SHOWS
     which of the four it is about to do — the ring around it fills while
     a shot charges and goes hard-edged when a tackle is available.
     ======================================================================= */
  var IN = { ux: 0, uy: 0, held: false, heldT: 0, tapT: 0, keys: {},
             stickId: null, stickX: 0, stickY: 0, curX: 0, curY: 0, btnId: null };

  function inputVector() {
    var kx = 0, ky = 0;
    if (IN.keys.left) kx -= 1;
    if (IN.keys.right) kx += 1;
    if (IN.keys.up) ky -= 1;
    if (IN.keys.down) ky += 1;
    if (kx || ky) { var m = len(kx, ky); return { x: kx / m, y: ky / m }; }
    if (IN.stickId !== null) {
      var dx = IN.curX - IN.stickX, dy = IN.curY - IN.stickY;
      var d = len(dx, dy);
      if (d < 5) return { x: 0, y: 0 };
      var s = Math.min(1, d / 34);
      return { x: (dx / d) * s, y: (dy / d) * s };
    }
    return { x: 0, y: 0 };
  }

  function pressButton() {
    if (G.state !== "play") { skipState(); return; }
    IN.held = true; IN.heldT = 0;
  }
  function releaseButton() {
    if (!IN.held) return;
    IN.held = false;
    var p = G.controlled;
    if (!p || G.state !== "play") return;
    var carrying = G.ball.owner === p;
    if (carrying) {
      if (IN.heldT < 0.17) {
        var mate = bestPass(p);
        if (mate) passTo(p, mate); else shoot(p, 0.4);
      } else {
        shoot(p, clamp(IN.heldT / TUNE.chargeTime, 0.25, 1));
      }
    } else if (IN.heldT < 0.22 && p.coolT <= 0 && p.tackleT <= 0) {
      startTackle(p);
    }
    IN.heldT = 0;
  }

  function controlStep(dt) {
    var p = G.controlled;
    if (!p) return;
    if (IN.held) IN.heldT += dt;
    if (p.tackleT > 0) return;
    var v = inputVector();
    var carrying = G.ball.owner === p;
    var sprinting = IN.held && !carrying && p.stamina > 0.02;
    if (sprinting) p.stamina = Math.max(0, p.stamina - TUNE.sprintDrain * dt);
    else p.stamina = Math.min(1, p.stamina + TUNE.sprintFill * dt);
    var mul = sprinting ? TUNE.sprintMul : 1;
    /* winding a shot up roots you a little, which is the cost of power */
    if (carrying && IN.held) mul *= 0.55;
    /* The thumb pushes towards a place on the SCREEN, and the screen is
       the camera's, not the pitch's. When they change ends the camera
       crosses to the other touchline, and without this line every
       control in the second half is mirrored. */
    var sd = camSide();
    if (v.x || v.y) driveP(p, sd * v.y, sd * v.x, dt, mul * (len(v.x, v.y)));
    else { p.vx *= Math.pow(0.02, dt); p.vy *= Math.pow(0.02, dt); }
  }

  /* =======================================================================
     16. THE CLOCK AND THE STATES
     ======================================================================= */
  function step(dt) {
    if (!G) return;
    G.stateT += dt;
    G.shake = Math.max(0, G.shake - dt * 3);
    G.flash = Math.max(0, G.flash - dt * 2.2);

    if (G.state === "kickoff") {
      if (G.stateT > TUNE.kickoffWait) {
        G.state = "play"; G.stateT = 0;
        SFX.whistle();
      }
    } else if (G.state === "goal") {
      if (G.stateT > TUNE.goalCheer && !G.over) {
        setCamMode("play");
        resetPositions(G.kickoffTeam);
        G.state = "kickoff"; G.stateT = 0;
        clearBanner();
      }
    } else if (G.state === "play") {
      G.clock += dt;
      var limit = G.golden ? TUNE.goldenGoal : TUNE.halfSeconds;
      if (G.clock >= limit) {
        if (G.golden) { endMatch(); }
        else if (G.half === 1) halfTime();
        else endMatch();
      }
    }

    if (G.state === "play" || G.state === "goal") {
      if (G.state === "play") {
        controlStep(dt);
        G.players.forEach(function (p) { if (p !== G.controlled) think(p, dt); });
        G.stat.poss[G.ball.owner ? G.ball.owner.team : 0] += dt;
      } else {
        celebrate(dt);
      }
      G.players.forEach(function (p) { playerStep(p, dt); });
      separate();
      if (G.state === "play") { ballStep(dt); resolvePossession(); pickControlled(false, dt); }
    }
    cameraStep(dt);
  }

  /* G.cam.y is the point up the pitch the camera is watching.

     It used to be the top edge of a 180-pixel-tall scrolling window,
     because that is what a flat renderer needs — and when the renderer
     became a camera in a world, that half-a-view offset stayed behind
     and quietly aimed everything ninety units past the ball. What you
     got was a lovely view of the far penalty area with the match
     happening somewhere below the bottom of the screen. */
  /* WHAT EVERYBODY DOES FOR THE NEXT THREE SECONDS.

     The scorer wheels away towards the corner flag; their side runs
     after them and piles in; the other side stands still and looks at
     the floor, which is the only animation in the game that is about
     not moving. A goal used to be everybody decelerating politely. */
  function celebrate(dt) {
    var sc = G.scorerP;
    G.players.forEach(function (p) {
      if (p.gk) { p.vx *= 0.9; p.vy *= 0.9; return; }
      if (p === sc) {
        /* away towards the near corner of the end they were attacking */
        var tx = p.celX || (p.celX = PITCH.cx + (p.x > PITCH.cx ? 1 : -1) * 98);
        var ty = p.celY || (p.celY = goalY(p.team) + attackDir(p.team) * -34);
        if (G.stateT < 1.9) moveTo(p, tx, ty, dt, 1.05);
        else { p.vx *= 0.88; p.vy *= 0.88; }
        return;
      }
      if (p.team === G.scoredBy && sc) {
        moveTo(p, sc.x + (p.idx - 2) * 9, sc.y + 10, dt, 0.98);
      } else {
        p.vx *= 0.86; p.vy *= 0.86;
        p.celX = p.celY = null;
      }
    });
  }

  function cameraStep(dt) {
    var b = G.ball;
    var want = b.y + clamp(b.vy, -60, 60) * (TUNE.camLead / 60);
    want = clamp(want, PITCH.y0 - 16, PITCH.y1 + 16);
    G.cam.y += (want - G.cam.y) * Math.min(1, TUNE.camEase * dt);
  }

  function halfTime() {
    G.state = "half"; G.stateT = 0; G.clock = 0;
    SFX.longWhistle();
    overlay("HALF TIME", scoreLine(), "PLAY THE SECOND HALF", function () {
      G.half = 2; G.kickoffTeam = 1;
      resetPositions(G.kickoffTeam);
      G.state = "kickoff"; G.stateT = 0;
      setCamMode("play");
      hideOverlay();
    }, { kicker: "45'", body: statsBlock() });
  }

  function endMatch() {
    if (G.over) return;
    var a = G.score[0], b = G.score[1];
    if (a === b && !G.golden) {
      /* level at the end of ninety. There is no replay and there are no
         penalties in this game, so it is the next goal. */
      G.golden = true; G.clock = 0; G.half = 2;
      G.state = "kickoff"; G.stateT = 0;
      G.kickoffTeam = 0;
      resetPositions(0);
      SFX.longWhistle();
      banner("GOLDEN GOAL", "good");
      setTimeout(clearBanner, 1800);
      return;
    }
    G.over = true;
    G.state = "full"; G.stateT = 0;
    SFX.longWhistle();
    var won = a > b;
    if (won) { crowdSwell(0.2, 3.2); SFX.goal(); }
    finishRound(won);
  }

  function scoreLine() {
    return teamById(G.ids[0]).short + "  " + G.score[0] + " – " + G.score[1] +
           "  " + teamById(G.ids[1]).short;
  }

  /* =======================================================================
     17. PUTTING THE SIMULATION ON THE SCREEN

     Nothing here decides anything. The match has already happened by the
     time this runs; all it does is move meshes to where the simulation
     says its people are, and point a camera at them.

     The run cycle is four rotations and a bob. It is not motion capture
     and it does not need to be — what makes a cartoon run read is the
     legs swinging out of phase with the arms and the whole body dipping
     on each step, and both of those are one sine wave.
     ======================================================================= */
  /* =======================================================================
     THE POSES

     Everything a player can be doing, and what their bones are at while
     they do it. There is no skeleton and no clip here — it is nine
     rotations recomputed every frame — but that is enough, because what
     makes a cartoon run read is not the fidelity of the joint angles. It
     is that the legs swing out of phase with the arms, the body dips on
     each step, and the whole thing leans into where it is going.

     `pl.anim` lives in the simulation rather than the renderer, so a
     celebration is the same length whatever the frame rate is doing.
     ======================================================================= */
  var CELEBRATIONS = ["armsUp", "knee", "planeRun", "heart"];

  function setAnim(pl, state, dur) {
    if (pl.anim && pl.anim.state === state && !pl.anim.once) return;
    pl.anim = { state: state, t: 0, dur: dur || 0, once: !!dur,
                seed: Math.random(), prev: pl.anim ? pl.anim.state : "idle", blend: 0 };
  }
  function animStep(pl, dt) {
    if (!pl.anim) setAnim(pl, "idle");
    pl.anim.t += dt;
    pl.anim.blend = Math.min(1, pl.anim.blend + dt * 9);
    if (pl.anim.once && pl.anim.t >= pl.anim.dur) { pl.anim.once = false; pl.anim = null; }
  }
  /* what the simulation thinks this player is doing, if nothing has
     asked for something specific */
  function baseAnim(pl) {
    if (pl.tackleT > 0) return "slide";
    if (G.state === "goal") {
      if (G.scorerP === pl) return G.celebration;
      return pl.team === G.scoredBy ? "cheer" : "dejected";
    }
    if (G.state === "full") return G.score[0] > G.score[1]
      ? (pl.team === 0 ? "cheer" : "dejected") : (pl.team === 1 ? "cheer" : "dejected");
    var sp = len(pl.vx, pl.vy);
    if (pl.gk && ballNear(pl)) return "ready";
    if (sp > 4) return "run";
    return "idle";
  }
  function ballNear(pl) {
    return Math.abs(G.ball.y - ownGoalY(pl.team)) < PITCH.boxH &&
           Math.abs(G.ball.x - PITCH.cx) < PITCH.boxW / 2;
  }

  /* WHICH WAY IS OUT.

     An arm hangs from its shoulder down the -Y axis, so rotating it
     about Z by θ points it at (sin θ, -cos θ). The LEFT arm is the one
     at -X, which means raising it away from the body needs a NEGATIVE
     angle and the right one needs a positive. Every celebration in here
     was first written with those the other way round, and what that
     does is not obvious from the code and completely obvious on the
     screen: the arms swing up THROUGH the chest and finish inside the
     head, so a player celebrating a goal looks exactly like a player
     standing still. Hence two named helpers and no bare signs. */
  function armsOut(A, v, lift) {
    A[0].rotation.z = -v; A[1].rotation.z = v;
    if (lift !== undefined) { A[0].rotation.x = lift; A[1].rotation.x = lift; }
  }
  function armsIn(A, v, lift) {
    A[0].rotation.z = v; A[1].rotation.z = -v;
    if (lift !== undefined) { A[0].rotation.x = lift; A[1].rotation.x = lift; }
  }

  function syncRig(pl, r, dt) {
    var g = r.group;
    g.position.set(sceneX(pl.y), 0, sceneZ(pl.x));
    /* A three.js object faces -Z, and yaw turns that to (-sin, -cos).
       The simulation's heading is measured from +x in its own flat
       world, which `place` maps to (sin d, cos d) on the ground. Setting
       those equal gives exactly this. */
    g.rotation.y = pl.dir + Math.PI;
    g.rotation.x = 0; g.rotation.z = 0;
    /* the build, not unity: resetting this every frame is how a roster
       of fourteen different shapes becomes fourteen of the same one */
    g.scale.set(r.build.w, r.build.h, r.build.w);

    var state = (pl.anim && pl.anim.once) ? pl.anim.state : baseAnim(pl);
    if (!pl.anim || (!pl.anim.once && pl.anim.state !== state)) setAnim(pl, state);
    var t = pl.anim ? pl.anim.t : 0;
    var sp = len(pl.vx, pl.vy);

    /* defaults, so every pose only has to say what it changes */
    var L = r.legs, A = r.arms;
    L[0].rotation.set(0, 0, 0); L[1].rotation.set(0, 0, 0);
    A[0].rotation.set(0, 0, 0); A[1].rotation.set(0, 0, 0); armsOut(A, 0.14);
    r.head.rotation.set(0, 0, 0);
    r.torso.rotation.set(0, 0, 0);
    g.position.y = 0;

    if (state === "run") {
      var amp = Math.min(1, sp / 66);
      pl.gait = (pl.gait || 0) + dt * (5.0 + sp * 0.085);
      var sw = Math.sin(pl.gait);
      L[0].rotation.x = sw * 1.02 * amp;
      L[1].rotation.x = -sw * 1.02 * amp;
      A[0].rotation.x = -sw * 0.80 * amp;
      A[1].rotation.x = sw * 0.80 * amp;
      armsOut(A, 0.20);
      g.rotation.x = -Math.min(0.24, sp * 0.0028);
      g.position.y = Math.abs(sw) * 0.62 * amp;
      r.head.rotation.x = Math.min(0.18, sp * 0.0020);

    } else if (state === "idle") {
      var br = Math.sin(t * 1.9 + pl.anim.seed * 6) * 0.055;
      r.torso.rotation.x = br;
      A[0].rotation.x = br * 0.6; A[1].rotation.x = br * 0.6;
      g.position.y = Math.abs(br) * 1.2;
      /* a look around, every few seconds, so a standing player is not
         a statue — the cheapest life there is */
      var look = Math.sin(t * 0.7 + pl.anim.seed * 9);
      r.head.rotation.y = look * 0.34;

    } else if (state === "ready") {                 // the keeper, set
      L[0].rotation.z = -0.30; L[1].rotation.z = 0.30;     // feet apart
      armsOut(A, 1.15, -0.35);                             // and set
      g.position.y = -0.7;
      r.torso.rotation.x = 0.22;

    } else if (state === "kick") {
      /* plant, swing through, follow through. One curve, read three
         ways: before the contact it is a wind-up and after it is a
         finish, and the ball leaves on the frame it crosses zero. */
      var k = clamp(t / 0.34, 0, 1);
      var swing = Math.sin(k * Math.PI) * (k < 0.4 ? -1 : 1);
      L[0].rotation.x = k < 0.4 ? 0.9 * k * 2.5 : -1.5 * Math.sin((k - 0.4) * 2.6);
      L[1].rotation.x = -0.25;
      armsOut(A, 0.62);
      A[0].rotation.x = 0.55; A[1].rotation.x = -0.75;      // one counters
      g.rotation.x = -0.12 + swing * 0.08;

    } else if (state === "slide") {
      g.rotation.x = -1.12;
      g.position.y = 1.5;
      L[0].rotation.x = -0.95; L[1].rotation.x = -0.15;
      armsOut(A, 0.85);
      A[0].rotation.x = 1.25; A[1].rotation.x = 1.05;

    } else if (state === "dive") {
      var d2 = clamp(t / 0.5, 0, 1);
      g.rotation.z = (pl.diveDir || 1) * 1.25 * Math.sin(d2 * Math.PI * 0.7);
      g.position.y = Math.sin(d2 * Math.PI) * 5.5;
      armsOut(A, 2.15);
      L[0].rotation.x = -0.3; L[1].rotation.x = 0.3;

    } else if (state === "armsUp" || state === "cheer") {
      var c = t * 6;
      armsOut(A, 2.55 + Math.sin(c) * 0.22, -0.3);
      g.position.y = Math.max(0, Math.sin(c * 0.75)) * 2.6;    // jumping
      L[0].rotation.x = -0.25; L[1].rotation.x = 0.25;
      r.head.rotation.x = -0.22;

    } else if (state === "knee") {                   // the knee slide
      var s2 = clamp(t / 1.4, 0, 1);
      g.rotation.x = -0.55 * (1 - s2 * 0.4);
      g.position.y = 0.4;
      L[0].rotation.x = -1.5; L[1].rotation.x = 0.35;
      armsOut(A, 2.42);
      r.head.rotation.x = -0.4;

    } else if (state === "planeRun") {               // arms out, banking
      armsOut(A, 1.62);
      g.rotation.z = Math.sin(t * 2.4) * 0.26;
      pl.gait = (pl.gait || 0) + dt * 8;
      L[0].rotation.x = Math.sin(pl.gait) * 0.9;
      L[1].rotation.x = -Math.sin(pl.gait) * 0.9;
      g.position.y = Math.abs(Math.sin(pl.gait)) * 0.5;

    } else if (state === "heart") {                  /* hands together over
                                                        her head, which is
                                                        the only one of
                                                        these that is for
                                                        one person */
      /* hers, and the only one that comes IN: the hands meet */
      armsIn(A, 2.72, -0.5);
      r.head.rotation.x = -0.3;
      g.position.y = Math.max(0, Math.sin(t * 4)) * 1.4;

    } else if (state === "dejected") {
      r.head.rotation.x = 0.55;
      r.torso.rotation.x = 0.26;
      armsOut(A, 0.42, 0.5);                               // hands on hips
      g.position.y = Math.sin(t * 1.4) * 0.15;
    }

    /* the keeper spreads himself whenever the ball is in his half of
       the picture, whatever else he is doing */
    if (pl.gk && state === "run" && ballNear(pl)) {
      armsOut(A, 1.0);
    }
    r.blob.visible = !shadowsOn;
  }

  function syncBall() {
    var b = G.ball;
    ballGroup.position.set(sceneX(b.y), BALL_R + b.z, sceneZ(b.x));
    /* squash and stretch, which is the oldest trick in animation and the
       cheapest weight a ball can be given: fat on the frame it is hit,
       drawn out along its travel while it is moving fast */
    var hit = b.struck || 0;
    var spd2 = len(b.vx, b.vy);
    var st = 1 + Math.min(0.16, spd2 * 0.0006) - hit * 0.22;
    ballGroup.scale.set(1 + hit * 0.34, st, 1 + hit * 0.34);
    /* Rolled, not slid. It turns about the axis lying across its own
       direction of travel, through the angle the distance it covered
       subtends on its own radius — which is what makes a ball look
       heavy instead of looking like a sticker being dragged. */
    var sp = len(b.vx, b.vy);
    if (sp > 1) {
      var uX = b.vy / sp, uZ = b.vx / sp;
      ballMesh.rotateOnWorldAxis(new THREE.Vector3(uZ, 0, -uX), sp * 0.0166 / BALL_R);
    }
  }

  /* THE CAMERA — the whole reason this is 3D.

     It sits behind the play and above it, looking at the goal she is
     attacking, and it swaps ends at half time because she does. Its x
     only partly follows the ball: all the way and the goal slides about
     the screen and you lose your bearings; not at all and the play walks
     off the side of the frame. Two thirds of the way is where it stops
     feeling like either. */
  /* Close. The first go sat at 132 up and 118 back, which frames the
     whole pitch beautifully and is the wrong game: at that distance a
     player is fifteen units tall in a view two hundred and eighty wide
     and you are watching a tactics board. The reference is down among
     them. This is about a hundred and twenty out at forty-five degrees,
     which puts roughly two thirds of the pitch width on screen and a
     player at about an eighth of its height. */
  /* =======================================================================
     THE CAMERA

     It stands on the near touchline, about level with the play, and it
     does three things: it follows the ball up and down the pitch, it
     pulls in and out depending on how spread the football is, and it
     leaves the game entirely when somebody scores.

     THE ZOOM IS THE POINT. A camera at a fixed distance is either too
     far out to see a face or too close to see a pass coming, and it is
     the single thing that separates a game that feels made from one
     that feels assembled. So it frames a box: the ball, the player she
     is driving, and whoever is closest to contesting it. When those
     three are on top of each other it comes right in and you can see
     boots; when somebody hits it fifty units downfield it pulls back
     and lets you watch it travel.

     She always attacks to the RIGHT. Real football swaps ends at half
     time and so does this, but the camera crosses to the other
     touchline when it happens, so the goal she is running at is on the
     same side of the screen all match. Getting that wrong is a whole
     half spent running the wrong way.
     ======================================================================= */
  var CAM = {
    near: 96,           // closest it comes in
    /* and furthest out. Capped by the architecture: the near touchline
       is 160 out and the stand starts just past it, so a camera allowed
       further than this is a camera standing behind its own crowd,
       filming the back of a roof. */
    far: 150,
    lift: 0.30,         // height as a fraction of distance
    base: 22,           // plus this much, so it is never level with the grass
    ease: 3.2,
    lookUp: 9,          // the point it aims at, above the grass
  };
  var camNow = { x: 0, z: 0, dist: 150, tx: 0, ty: CAM.lookUp, tz: 0, side: 1 };
  var camMode = { kind: "play", t: 0, at: null, hold: 0 };

  /* which touchline it is standing on: whichever keeps her attacking right */
  function camSide() { return attackDir(0) > 0 ? 1 : -1; }

  function wantFraming() {
    var b = G.ball;
    var pts = [{ x: sceneX(b.y), z: sceneZ(b.x) }];
    if (G.controlled) pts.push({ x: sceneX(G.controlled.y), z: sceneZ(G.controlled.x) });
    var near = nearestTo(b, G.ball.owner && G.ball.owner.team === 0 ? 1 : 0, true);
    if (near) pts.push({ x: sceneX(near.y), z: sceneZ(near.x) });
    /* the ball is going somewhere: look where it will be, not where it is */
    pts.push({ x: sceneX(b.y + b.vy * 0.42), z: sceneZ(b.x + b.vx * 0.42) });

    var minX = 1e9, maxX = -1e9, minZ = 1e9, maxZ = -1e9;
    pts.forEach(function (p) {
      minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
      minZ = Math.min(minZ, p.z); maxZ = Math.max(maxZ, p.z);
    });
    var spread = Math.max(maxX - minX, (maxZ - minZ) * 1.5);
    var dist = clamp(spread * 1.45 + 96, CAM.near, CAM.far);
    /* and tighter in the penalty area, because that is where the story is */
    var toGoal = Math.min(Math.abs(b.y - PITCH.y0), Math.abs(b.y - PITCH.y1));
    if (toGoal < 70) dist -= (70 - toGoal) * 0.30;
    return {
      x: clamp((minX + maxX) / 2, sceneX(PITCH.y0) - 6, sceneX(PITCH.y1) + 6),
      z: (minZ + maxZ) / 2 * 0.45,
      dist: clamp(dist, CAM.near, CAM.far),
    };
  }

  /* what the camera is doing this second */
  function setCamMode(kind, at, hold) {
    camMode.kind = kind; camMode.t = 0; camMode.at = at || null;
    camMode.hold = hold || 0;
  }

  function placeCamera(dt, snap) {
    camMode.t += dt;
    var side = camSide();
    var want;

    if (camMode.kind === "goal" && camMode.at) {
      /* THE CELEBRATION SHOT.

         In front of the scorer, roughly chest height, drifting round
         them — what a broadcast cuts to and what this did not have.

         Two things were wrong with the first one. It stood about forty
         units from a player fifteen tall, so they filled the frame and
         spilled off the side of it; and it eased from `camNow.x/z`,
         which the playing camera never wrote to, so every celebration
         began with a swoop in from the middle of the world. The playing
         branch keeps those two in step now, and this starts from
         wherever the camera actually was. */
      var p = camMode.at;
      var px2 = sceneX(p.y), pz2 = sceneZ(p.x);
      var orbit = 0.42 + camMode.t * 0.34;
      var r = 74 - Math.min(16, camMode.t * 6);
      var wx = px2 + Math.sin(orbit) * r * 0.55;
      var wz = pz2 + side * Math.cos(orbit * 0.6) * r * 0.85;
      var k2 = Math.min(1, 3.0 * dt);
      camNow.x += (wx - camNow.x) * k2;
      camNow.z += (wz - camNow.z) * k2;
      camNow.tx += (px2 - camNow.tx) * k2;
      camNow.tz += (pz2 - camNow.tz) * k2;
      camNow.ty += (10 - camNow.ty) * k2;
      var hh = 30 - Math.min(8, camMode.t * 3);
      camNow.h = (camNow.h === undefined ? hh : camNow.h + (hh - camNow.h) * k2);
      camera.position.set(camNow.x, camNow.h, camNow.z);
      camera.lookAt(camNow.tx, camNow.ty, camNow.tz);
      if (sun) {
        sun.target.position.set(px2, 0, pz2);
        sun.position.set(px2 - 90, 250, pz2 + 160);
        sun.target.updateMatrixWorld();
      }
      return;
    }

    want = wantFraming();
    var k = snap ? 1 : Math.min(1, CAM.ease * dt);
    camNow.tx += (want.x - camNow.tx) * k;
    camNow.tz += (want.z - camNow.tz) * k;
    camNow.ty += (CAM.lookUp - camNow.ty) * k;
    /* the distance eases more slowly than the pan, because a zoom that
       snaps is a zoom you notice */
    camNow.dist += (want.dist - camNow.dist) * (snap ? 1 : Math.min(1, 1.9 * dt));
    camNow.side += (side - camNow.side) * (snap ? 1 : Math.min(1, 2.2 * dt));

    var shake = G.shake > 0 ? (Math.random() - 0.5) * G.shake * 3.4 : 0;
    var h = CAM.base + camNow.dist * CAM.lift;
    camNow.x = camNow.tx + shake;
    camNow.z = camNow.tz + camNow.side * camNow.dist;
    camNow.h = h;
    camera.position.set(camNow.x, camNow.h, camNow.z);
    camera.lookAt(camNow.tx, camNow.ty, camNow.tz);

    if (sun) {
      sun.target.position.set(sceneX(G.ball.y), 0, sceneZ(G.ball.x));
      sun.position.set(sceneX(G.ball.y) - 90, 250, sceneZ(G.ball.x) + 160);
      sun.target.updateMatrixWorld();
    }
  }

  function draw(dt) {
    if (!renderer || !G) return;
    for (var i = 0; i < G.players.length; i++) {
      if (rigs[i]) syncRig(G.players[i], rigs[i], dt || 0);
    }
    syncBall();
    /* the net settling back */
    goals.forEach(function (g2) {
      if (!g2 || !g2.userData.netBack) return;
      var u = g2.userData;
      u.bulge = Math.max(0, (u.bulge || 0) - (dt || 0) * 2.4);
      var push = Math.sin(u.bulge * Math.PI) * 5.5;
      u.netBack.position.z = u.restZ + u.sgn * push;
    });
    confettiStep(dt || 0);
    placeCamera(dt || 0, false);
    renderer.render(scene, camera);
  }

  /* =======================================================================
     CONFETTI

     One instanced mesh of two hundred little rectangles that fall out of
     the stand when somebody scores. Instanced because two hundred
     separate meshes is two hundred draw calls for a thing that is on
     screen for three seconds, and a goal is the one moment in the game
     that must not stutter.
     ======================================================================= */
  var confetti = null, confParts = [], confDummy = null;
  var CONF_N = 220;
  function buildConfetti() {
    var geo = new THREE.BoxGeometry(1.5, 2.4, 0.2);
    var mat = new THREE.MeshBasicMaterial({ vertexColors: true });
    confetti = new THREE.InstancedMesh(geo, mat, CONF_N);
    confetti.instanceMatrix.setUsage(THREE.DynamicDrawUsage || 35048);
    var cols = new Float32Array(CONF_N * 3);
    var c = new THREE.Color();
    for (var i = 0; i < CONF_N; i++) {
      c.set(CROWD_COLS[i % CROWD_COLS.length]);
      cols[i * 3] = c.r; cols[i * 3 + 1] = c.g; cols[i * 3 + 2] = c.b;
      confParts.push({ life: 0 });
    }
    confetti.geometry.setAttribute("color",
      new THREE.InstancedBufferAttribute(cols, 3));
    confetti.frustumCulled = false;
    confetti.count = CONF_N;
    confDummy = new THREE.Object3D();
    scene.add(confetti);
    hideConfetti();
  }
  function hideConfetti() {
    if (!confetti) return;
    for (var i = 0; i < CONF_N; i++) {
      confDummy.position.set(0, -500, 0);
      confDummy.updateMatrix();
      confetti.setMatrixAt(i, confDummy.matrix);
    }
    confetti.instanceMatrix.needsUpdate = true;
  }
  function confettiBurst(at, n) {
    if (!confetti) return;
    var used = 0;
    for (var i = 0; i < CONF_N && used < n; i++) {
      var p = confParts[i];
      if (p.life > 0) continue;
      used++;
      p.life = 2.6 + Math.random() * 1.8;
      p.x = sceneX(at.y) + (Math.random() - 0.5) * 120;
      p.z = sceneZ(at.x) + (Math.random() - 0.5) * 90;
      p.y = 60 + Math.random() * 34;
      p.vx = (Math.random() - 0.5) * 9;
      p.vz = (Math.random() - 0.5) * 9;
      p.vy = -8 - Math.random() * 7;
      p.rx = Math.random() * 6; p.ry = Math.random() * 6;
      p.sx = 4 + Math.random() * 5;
    }
  }
  function confettiStep(dt) {
    if (!confetti) return;
    var any = false;
    for (var i = 0; i < CONF_N; i++) {
      var p = confParts[i];
      if (p.life <= 0) continue;
      any = true;
      p.life -= dt;
      p.vy -= 16 * dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      p.rx += p.sx * dt; p.ry += p.sx * 0.7 * dt;
      if (p.y < 0) { p.life = 0; confDummy.position.set(0, -500, 0); }
      else confDummy.position.set(p.x, p.y, p.z);
      confDummy.rotation.set(p.rx, p.ry, 0);
      confDummy.updateMatrix();
      confetti.setMatrixAt(i, confDummy.matrix);
    }
    if (any) confetti.instanceMatrix.needsUpdate = true;
  }

  /* The ring under whoever she is driving. It is a mesh on the grass
     rather than something drawn over the top, so it sits in the world
     and goes round the player instead of following him about the screen. */
  var ring = null;
  function buildMarkers() {
    ring = new THREE.Mesh(
      new THREE.TorusGeometry(4.6, 0.55, 8, 24),
      new THREE.MeshBasicMaterial({ color: new THREE.Color("#7fd4f5"),
                                    transparent: true, opacity: 0.95, depthWrite: false })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.3;
    scene.add(ring);
  }
  function syncRing() {
    if (!ring) return;
    var me = G && G.controlled;
    ring.visible = !!me && G.state !== "full";
    if (!me) return;
    ring.position.set(sceneX(me.y), 0.3, sceneZ(me.x));
    ring.material.color.set(G.ball.owner === me ? "#ffe066" : "#7fd4f5");
  }


  /* =======================================================================
     18. THE FLAGS

     Small enough that a flag is four rectangles and a shape. The heart is
     not a country: it is the paper heart she picks up in the first minute
     of the walk up the valley, and it is his side's badge in the final.
     ======================================================================= */
  function flagCanvas(kind, w, h) {
    var f = mkCanvas(w, h);
    var x = f.x;
    if (kind === "mar") {
      x.fillStyle = "#c1272d"; x.fillRect(0, 0, w, h);
      x.strokeStyle = "#0e6b3c"; x.lineWidth = Math.max(1, w * 0.06);
      star(x, w / 2, h / 2, h * 0.30, h * 0.13);
    } else if (kind === "ger") {
      x.fillStyle = "#1c1c22"; x.fillRect(0, 0, w, h / 3);
      x.fillStyle = "#c1272d"; x.fillRect(0, h / 3, w, h / 3);
      x.fillStyle = "#e8b23c"; x.fillRect(0, (2 * h) / 3, w, h / 3);
    } else if (kind === "bra") {
      x.fillStyle = "#0f7a3c"; x.fillRect(0, 0, w, h);
      x.fillStyle = "#f5d020";
      x.beginPath();
      x.moveTo(w / 2, h * 0.12); x.lineTo(w * 0.88, h / 2);
      x.lineTo(w / 2, h * 0.88); x.lineTo(w * 0.12, h / 2);
      x.closePath(); x.fill();
      x.fillStyle = "#1d4fa0";
      x.beginPath(); x.arc(w / 2, h / 2, h * 0.19, 0, Math.PI * 2); x.fill();
    } else {
      /* the paper heart */
      x.fillStyle = "#f6efdd"; x.fillRect(0, 0, w, h);
      x.fillStyle = "#d4405f";
      var cx = w / 2, cy = h * 0.46, r = h * 0.22;
      x.beginPath();
      x.arc(cx - r * 0.7, cy, r * 0.75, 0, Math.PI * 2);
      x.arc(cx + r * 0.7, cy, r * 0.75, 0, Math.PI * 2);
      x.fill();
      x.beginPath();
      x.moveTo(cx - r * 1.42, cy + r * 0.18);
      x.lineTo(cx, cy + r * 1.7);
      x.lineTo(cx + r * 1.42, cy + r * 0.18);
      x.closePath(); x.fill();
    }
    return f.c;
  }
  /* =======================================================================
     CRESTS

     A painted badge per shape, in the team's own two colours. Drawn
     rather than lettered because a crest has to be recognisable at the
     size of a thumbnail on a scoreboard, and three letters at that size
     is a smudge.
     ======================================================================= */
  function crestCanvas(kind, base, trim, w, h) {
    var f = mkCanvas(w, h);
    var x = f.x, cx = w / 2, cy = h / 2, u = Math.min(w, h) / 2;
    x.fillStyle = base;
    x.beginPath();
    x.moveTo(cx - u * 0.78, cy - u * 0.9);
    x.lineTo(cx + u * 0.78, cy - u * 0.9);
    x.lineTo(cx + u * 0.78, cy + u * 0.18);
    x.quadraticCurveTo(cx + u * 0.72, cy + u * 0.92, cx, cy + u * 0.98);
    x.quadraticCurveTo(cx - u * 0.72, cy + u * 0.92, cx - u * 0.78, cy + u * 0.18);
    x.closePath(); x.fill();
    x.strokeStyle = "rgba(0,0,0,.45)"; x.lineWidth = Math.max(1, u * 0.10); x.stroke();

    x.fillStyle = trim; x.strokeStyle = trim;
    x.lineWidth = Math.max(1, u * 0.16);
    x.lineCap = "round"; x.lineJoin = "round";
    var s = u * 0.52;

    if (kind === "heart") {
      x.beginPath();
      x.arc(cx - s * 0.46, cy - s * 0.18, s * 0.5, 0, Math.PI * 2);
      x.arc(cx + s * 0.46, cy - s * 0.18, s * 0.5, 0, Math.PI * 2);
      x.fill();
      x.beginPath();
      x.moveTo(cx - s * 0.95, cy - s * 0.02);
      x.lineTo(cx, cy + s * 1.0); x.lineTo(cx + s * 0.95, cy - s * 0.02);
      x.closePath(); x.fill();
    } else if (kind === "star") {
      starPath(x, cx, cy, s, s * 0.44); x.fill();
    } else if (kind === "flame") {
      x.beginPath();
      x.moveTo(cx, cy - s * 1.05);
      x.quadraticCurveTo(cx + s * 0.9, cy, cx + s * 0.3, cy + s * 0.9);
      x.quadraticCurveTo(cx, cy + s * 0.3, cx - s * 0.35, cy + s * 0.9);
      x.quadraticCurveTo(cx - s * 0.85, cy, cx, cy - s * 1.05);
      x.fill();
    } else if (kind === "mountain") {
      x.beginPath();
      x.moveTo(cx - s, cy + s * 0.7); x.lineTo(cx - s * 0.2, cy - s * 0.9);
      x.lineTo(cx + s * 0.25, cy + s * 0.05); x.lineTo(cx + s * 0.55, cy - s * 0.4);
      x.lineTo(cx + s, cy + s * 0.7); x.closePath(); x.fill();
    } else if (kind === "lantern") {
      x.fillRect(cx - s * 0.5, cy - s * 0.5, s, s * 1.1);
      x.fillRect(cx - s * 0.7, cy - s * 0.72, s * 1.4, s * 0.24);
      x.beginPath(); x.moveTo(cx, cy - s * 1.1); x.lineTo(cx, cy - s * 0.72); x.stroke();
    } else if (kind === "leaf" || kind === "branch") {
      x.beginPath();
      x.moveTo(cx - s * 0.7, cy + s * 0.7);
      x.quadraticCurveTo(cx - s * 0.2, cy - s, cx + s * 0.8, cy - s * 0.7);
      x.quadraticCurveTo(cx + s * 0.3, cy + s * 0.6, cx - s * 0.7, cy + s * 0.7);
      x.fill();
      if (kind === "branch") {
        x.beginPath(); x.moveTo(cx - s * 0.7, cy + s * 0.7);
        x.lineTo(cx + s * 0.7, cy - s * 0.6); x.stroke();
      }
    } else if (kind === "note") {
      x.beginPath(); x.arc(cx - s * 0.35, cy + s * 0.55, s * 0.42, 0, Math.PI * 2); x.fill();
      x.fillRect(cx, cy - s * 0.95, s * 0.22, s * 1.5);
      x.fillRect(cx, cy - s * 0.95, s * 0.75, s * 0.28);
    } else if (kind === "wave") {
      x.beginPath();
      for (var i = 0; i <= 3; i++) {
        var wx = cx - s + (i / 3) * s * 2;
        if (i === 0) x.moveTo(wx, cy);
        else x.quadraticCurveTo(wx - s * 0.33, cy + (i % 2 ? -s * 0.8 : s * 0.8), wx, cy);
      }
      x.stroke();
    } else if (kind === "key") {
      x.beginPath(); x.arc(cx - s * 0.4, cy - s * 0.3, s * 0.45, 0, Math.PI * 2); x.stroke();
      x.beginPath(); x.moveTo(cx - s * 0.1, cy); x.lineTo(cx + s * 0.8, cy + s * 0.8); x.stroke();
      x.beginPath(); x.moveTo(cx + s * 0.45, cy + s * 0.45);
      x.lineTo(cx + s * 0.75, cy + s * 0.15); x.stroke();
    } else if (kind === "book") {
      x.fillRect(cx - s * 0.9, cy - s * 0.65, s * 0.8, s * 1.3);
      x.fillRect(cx + s * 0.1, cy - s * 0.65, s * 0.8, s * 1.3);
      x.fillStyle = base; x.fillRect(cx - s * 0.08, cy - s * 0.7, s * 0.16, s * 1.4);
    } else if (kind === "moon") {
      x.beginPath(); x.arc(cx + s * 0.1, cy, s * 0.9, 0, Math.PI * 2); x.fill();
      x.fillStyle = base;
      x.beginPath(); x.arc(cx + s * 0.55, cy - s * 0.2, s * 0.8, 0, Math.PI * 2); x.fill();
    } else if (kind === "rose") {
      x.beginPath(); x.arc(cx, cy - s * 0.1, s * 0.62, 0, Math.PI * 2); x.fill();
      x.fillStyle = base;
      x.beginPath(); x.arc(cx, cy - s * 0.1, s * 0.3, 0, Math.PI * 2); x.fill();
      x.fillStyle = trim;
      x.beginPath(); x.moveTo(cx, cy + s * 0.5); x.lineTo(cx, cy + s * 1.0); x.stroke();
    } else if (kind === "glove") {
      x.fillRect(cx - s * 0.55, cy - s * 0.3, s * 1.1, s * 1.05);
      for (var g2 = 0; g2 < 3; g2++)
        x.fillRect(cx - s * 0.5 + g2 * s * 0.38, cy - s * 0.95, s * 0.26, s * 0.7);
    } else if (kind === "tooth") {
      /* his faculty. A molar: two roots and a crown. */
      x.beginPath();
      x.moveTo(cx - s * 0.75, cy - s * 0.35);
      x.quadraticCurveTo(cx, cy - s * 1.05, cx + s * 0.75, cy - s * 0.35);
      x.lineTo(cx + s * 0.55, cy + s * 0.9);
      x.quadraticCurveTo(cx + s * 0.28, cy + s * 0.15, cx + s * 0.06, cy + s * 0.95);
      x.quadraticCurveTo(cx - s * 0.2, cy + s * 0.15, cx - s * 0.5, cy + s * 0.9);
      x.closePath(); x.fill();
    } else if (kind === "caduceus") {
      /* hers. A staff with two wings and a serpent turn. */
      x.beginPath(); x.moveTo(cx, cy - s * 1.0); x.lineTo(cx, cy + s * 1.0); x.stroke();
      [-1, 1].forEach(function (sg) {
        x.beginPath();
        x.moveTo(cx, cy - s * 0.72);
        x.quadraticCurveTo(cx + sg * s * 0.95, cy - s * 0.95, cx + sg * s * 0.85, cy - s * 0.35);
        x.stroke();
      });
      x.beginPath();
      x.moveTo(cx - s * 0.5, cy - s * 0.1);
      x.quadraticCurveTo(cx + s * 0.55, cy + s * 0.12, cx - s * 0.45, cy + s * 0.55);
      x.stroke();
    } else if (kind === "mortar") {
      /* pharmacy: a mortar and pestle */
      x.beginPath();
      x.moveTo(cx - s * 0.7, cy - s * 0.05);
      x.quadraticCurveTo(cx, cy + s * 1.05, cx + s * 0.7, cy - s * 0.05);
      x.closePath(); x.fill();
      x.fillRect(cx - s * 0.9, cy - s * 0.3, s * 1.8, s * 0.26);
      x.beginPath(); x.moveTo(cx + s * 0.15, cy - s * 0.45);
      x.lineTo(cx + s * 0.85, cy - s * 1.05); x.stroke();
    } else if (kind === "molecule" || kind === "atom") {
      x.beginPath(); x.arc(cx, cy, s * 0.30, 0, Math.PI * 2); x.fill();
      for (var mi = 0; mi < 3; mi++) {
        var ma = (mi / 3) * Math.PI;
        x.save(); x.translate(cx, cy); x.rotate(ma);
        x.beginPath();
        if (kind === "atom") x.ellipse(0, 0, s * 1.0, s * 0.42, 0, 0, Math.PI * 2);
        else { x.moveTo(0, 0); x.lineTo(s * 0.95, 0); }
        x.stroke();
        if (kind === "molecule") { x.beginPath(); x.arc(s * 0.95, 0, s * 0.26, 0, Math.PI * 2); x.fill(); }
        x.restore();
      }
    } else if (kind === "tooth") {
      /* his faculty: a molar, two roots and a crown */
      x.beginPath();
      x.moveTo(cx - s * 0.75, cy - s * 0.35);
      x.quadraticCurveTo(cx, cy - s * 1.05, cx + s * 0.75, cy - s * 0.35);
      x.lineTo(cx + s * 0.55, cy + s * 0.9);
      x.quadraticCurveTo(cx + s * 0.28, cy + s * 0.15, cx + s * 0.06, cy + s * 0.95);
      x.quadraticCurveTo(cx - s * 0.2, cy + s * 0.15, cx - s * 0.5, cy + s * 0.9);
      x.closePath(); x.fill();
    } else if (kind === "caduceus") {
      /* hers: a staff, two wings and a serpent turn */
      x.beginPath(); x.moveTo(cx, cy - s * 1.0); x.lineTo(cx, cy + s * 1.0); x.stroke();
      [-1, 1].forEach(function (sg) {
        x.beginPath();
        x.moveTo(cx, cy - s * 0.72);
        x.quadraticCurveTo(cx + sg * s * 0.95, cy - s * 0.95, cx + sg * s * 0.85, cy - s * 0.35);
        x.stroke();
      });
      x.beginPath();
      x.moveTo(cx - s * 0.5, cy - s * 0.1);
      x.quadraticCurveTo(cx + s * 0.55, cy + s * 0.12, cx - s * 0.45, cy + s * 0.55);
      x.stroke();
    } else if (kind === "mortar") {
      x.beginPath();
      x.moveTo(cx - s * 0.7, cy - s * 0.05);
      x.quadraticCurveTo(cx, cy + s * 1.05, cx + s * 0.7, cy - s * 0.05);
      x.closePath(); x.fill();
      x.fillRect(cx - s * 0.9, cy - s * 0.3, s * 1.8, s * 0.26);
      x.beginPath(); x.moveTo(cx + s * 0.15, cy - s * 0.45);
      x.lineTo(cx + s * 0.85, cy - s * 1.05); x.stroke();
    } else if (kind === "molecule" || kind === "atom") {
      x.beginPath(); x.arc(cx, cy, s * 0.30, 0, Math.PI * 2); x.fill();
      for (var mi = 0; mi < 3; mi++) {
        x.save(); x.translate(cx, cy); x.rotate((mi / 3) * Math.PI);
        x.beginPath();
        if (kind === "atom") { x.ellipse(0, 0, s * 1.0, s * 0.42, 0, 0, Math.PI * 2); x.stroke(); }
        else {
          x.moveTo(0, 0); x.lineTo(s * 0.95, 0); x.stroke();
          x.beginPath(); x.arc(s * 0.95, 0, s * 0.26, 0, Math.PI * 2); x.fill();
        }
        x.restore();
      }
    } else {
      x.fillRect(cx - s * 0.8, cy - s * 0.2, s * 1.6, s * 0.4);
      x.fillRect(cx - s * 0.2, cy - s * 0.8, s * 0.4, s * 1.6);
    }
    return f.c;
  }
  function starPath(x, cx, cy, R, r) {
    x.beginPath();
    for (var i = 0; i < 10; i++) {
      var a = -Math.PI / 2 + (i * Math.PI) / 5;
      var rad = i % 2 ? r : R;
      var px2 = cx + Math.cos(a) * rad, py = cy + Math.sin(a) * rad;
      if (i) x.lineTo(px2, py); else x.moveTo(px2, py);
    }
    x.closePath();
  }

  function star(x, cx, cy, R, r) {
    x.beginPath();
    for (var i = 0; i < 10; i++) {
      var a = -Math.PI / 2 + (i * Math.PI) / 5;
      var rad = i % 2 ? r : R;
      var px2 = cx + Math.cos(a) * rad, py = cy + Math.sin(a) * rad;
      if (i) x.lineTo(px2, py); else x.moveTo(px2, py);
    }
    x.closePath(); x.stroke();
  }

  /* =======================================================================
     19. THE DOM OVER THE TOP

     Everything with words in it is DOM, for the reason every other
     chapter here reached the same conclusion: pixel text painted into a
     320-wide buffer and blown up four times cannot be read.
     ======================================================================= */
  function $(id) { return document.getElementById(id); }
  function cacheEls() {
    ["cup-stage", "cup-canvas", "cup-hud", "cup-clock", "cup-round",
     "cup-h-score", "cup-a-score", "cup-h-flag", "cup-a-flag",
     "cup-h-name", "cup-a-name", "cup-stam", "cup-stam-f",
     "cup-banner", "cup-overlay", "cup-pause-btn", "cup-pad", "cup-half",
     "cup-stick", "cup-stick-k", "cup-btn", "cup-btn-ring", "cup-btn-lab",
     "cup-btn-ico", "cup-poss-h", "cup-poss-a", "cup-poss-lab",
     "cup-shot-h", "cup-shot-a", "cup-keys", "cup-stats"]
      .forEach(function (id) { EL[id] = $(id); });
    stage = EL["cup-stage"];
    cvs = EL["cup-canvas"];
  }

  /* The renderer is sized to the element and capped at two device
     pixels per CSS pixel. A phone with a 3x screen asking for a 3x
     buffer is asking to render nine times the area of a 1x one, and on
     a cartoon with hard colours the third pixel buys nothing you can
     see. */
  /* THE RETRO LAYER.

     The chapter is modelled and lit in 3D and then rendered through a
     small buffer and blown up with hard edges, so it comes out looking
     placed by hand like the rest of the site while keeping the depth
     and the camera a flat version could not have.

     There is no shader and no post pass in it: the canvas BACKING STORE
     is simply made small, and CSS stretches it with image-rendering:
     pixelated. That is precisely the trick the other five chapters use
     to get a 320x180 buffer onto a phone — so this is not a new idea in
     this codebase, it is the same idea pointed at WebGL. It is also the
     cheapest possible way to do it: a quarter of the pixels is a
     quarter of the shading, which is what pays for real shadows.

     Everything with words in it is DOM over the top, so nothing that
     has to be READ goes through the buffer. */
  function sizeRenderer() {
    if (!renderer || !stage) return;
    var r = stage.getBoundingClientRect();
    var w = Math.max(2, Math.round(r.width)), h = Math.max(2, Math.round(r.height));
    var aspect = w / h;
    if (cfg("PIXEL.on", true)) {
      var ph = Math.max(120, Math.round(cfg("PIXEL.height", 270)));
      var pw = Math.max(2, Math.round(ph * aspect));
      renderer.setPixelRatio(1);
      renderer.setSize(pw, ph, false);
      if (cvs) cvs.classList.add("px");
    } else {
      renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
      renderer.setSize(w, h, false);
      if (cvs) cvs.classList.remove("px");
    }
    if (camera) { camera.aspect = aspect; camera.updateProjectionMatrix(); }
  }

  function buildRenderer() {
    renderer = new THREE.WebGLRenderer({ canvas: cvs, antialias: true, alpha: false,
                                         powerPreference: "high-performance" });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = shadowsOn;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    camera = new THREE.PerspectiveCamera(52, 16 / 9, 1, 1400);
    sizeRenderer();
    window.addEventListener("resize", sizeRenderer);
  }

  /* one rig per player, built once and kept */
  function buildRigs() {
    rigs.forEach(function (r) { if (r && r.group) scene.remove(r.group); });
    rigs = G.players.map(function (p) {
      var r = buildRig(p);
      scene.add(r.group);
      return r;
    });
  }

  function buildBall() {
    ballGroup = new THREE.Group();
    ballMesh = new THREE.Mesh(new THREE.SphereGeometry(BALL_R, 22, 16), toon("#f8f8f4"));
    ballMesh.castShadow = true;
    ballGroup.add(ballMesh);
    ballGroup.add(outline(ballMesh, 1.1));
    /* the panels, so a rolling ball reads as rolling */
    for (var i = 0; i < 6; i++) {
      var a = (i / 6) * Math.PI * 2;
      var pan = new THREE.Mesh(new THREE.CircleGeometry(0.52, 6), toon("#24242a"));
      pan.position.set(Math.cos(a) * 1.62, Math.sin(a) * 0.9, Math.sin(a + 1) * 1.3);
      pan.lookAt(0, 0, 0);
      pan.position.multiplyScalar(1.02);
      ballMesh.add(pan);
    }
    scene.add(ballGroup);
  }

  /* A side shows its flag if it is a country and its crest if it is
     not. The memory-lane teams are places, not nations, so a flag would
     be a lie and a crest is the honest badge for them. */
  function setFlag(el, team) {
    if (!el || !team) return;
    el.innerHTML = "";
    el.appendChild(badgeCanvas(team, 30, 20));
  }
  function badgeCanvas(team, w, h) {
    if (team.flag && team.flag !== "crest") return flagCanvas(team.flag, w, h);
    return crestCanvas(team.crest || "shield",
                       team.kit ? team.kit.shirt : "#c1272d",
                       team.kit ? team.kit.trim : "#ffffff", w, h);
  }

  /* The three icons the button wears. Drawn rather than lettered,
     because at the size a thumb covers it the word is gone and the
     shape is not. */
  var BTN_ICON = {
    pass:   "M4 12h11M11 7l5 5-5 5M18 6v12",
    shoot:  "M3 17c4-1 6-4 7-7M10 10l7-4 4 6-7 4z M13 18l6-2",
    tackle: "M3 19l7-4M8 16l5-7 6 2-4 6zM15 6a2 2 0 104 0 2 2 0 10-4 0",
  };
  var btnMode = "";
  function setBtn(mode) {
    if (mode === btnMode) return;
    btnMode = mode;
    if (EL["cup-btn-lab"]) EL["cup-btn-lab"].textContent = mode.toUpperCase();
    var ico = EL["cup-btn-ico"];
    if (ico) {
      ico.innerHTML = '<path d="' + BTN_ICON[mode] + '" fill="none" stroke="#08334a" ' +
                      'stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"/>';
    }
  }

  function syncHud() {
    if (!G || !EL["cup-clock"]) return;
    var mins;
    if (G.golden) mins = "90+";
    else {
      var base = G.half === 1 ? 0 : 45;
      mins = Math.floor(base + (G.clock / TUNE.halfSeconds) * 45) + "'";
    }
    EL["cup-clock"].textContent = mins;
    EL["cup-h-score"].textContent = G.score[0];
    EL["cup-a-score"].textContent = G.score[1];
    if (EL["cup-half"]) {
      EL["cup-half"].textContent = G.golden ? "GOLDEN GOAL"
        : G.half === 1 ? "1ST HALF" : "2ND HALF";
    }

    /* possession, as a share of the time somebody has actually had it */
    var tot = G.stat.poss[0] + G.stat.poss[1];
    var hp = tot > 2 ? G.stat.poss[0] / tot : 0.5;
    if (EL["cup-poss-h"]) {
      EL["cup-poss-h"].style.width = (hp * 100).toFixed(1) + "%";
      EL["cup-poss-a"].style.width = ((1 - hp) * 100).toFixed(1) + "%";
      EL["cup-poss-lab"].textContent = Math.round(hp * 100) + "%";
    }
    if (EL["cup-shot-h"]) {
      EL["cup-shot-h"].textContent = G.stat.shots[0];
      EL["cup-shot-a"].textContent = G.stat.shots[1];
    }

    if (EL["cup-stam-f"]) {
      EL["cup-stam-f"].style.width = Math.round(G.controlled ? G.controlled.stamina * 100 : 100) + "%";
    }
    var p = G.controlled;
    var carrying = p && G.ball.owner === p;
    setBtn(carrying ? (IN.held ? "shoot" : "pass") : "tackle");
    if (EL["cup-btn-ring"]) {
      var f = (carrying && IN.held) ? clamp(IN.heldT / TUNE.chargeTime, 0, 1) : 0;
      EL["cup-btn-ring"].style.setProperty("--f", f.toFixed(3));
      EL["cup-btn"].dataset.f = f > 0.92 ? "1" : "0";
    }
  }

  var bannerT = null;
  function banner(text, tone) {
    var el = EL["cup-banner"];
    if (!el) return;
    el.textContent = text;
    el.dataset.tone = tone || "good";
    el.hidden = false;
    if (bannerT) clearTimeout(bannerT);
    bannerT = setTimeout(clearBanner, 2400);
  }
  function clearBanner() {
    if (bannerT) { clearTimeout(bannerT); bannerT = null; }
    if (EL["cup-banner"]) EL["cup-banner"].hidden = true;
  }

  var overlayGo = null;
  function overlay(title, line, action, onGo, opts) {
    var el = EL["cup-overlay"];
    if (!el) return;
    opts = opts || {};
    el.innerHTML =
      '<div class="cup-card' + (opts.big ? " cup-card-big" : "") + '">' +
      '<p class="cup-card-k">' + (opts.kicker || "") + '</p>' +
      '<h3>' + title + '</h3>' +
      (line ? '<p class="cup-card-l">' + line + '</p>' : "") +
      (opts.html || opts.body || "") +
      (opts.note ? '<p class="cup-card-n">' + opts.note + '</p>' : "") +
      /* a card with nothing to press is a card that is telling her to
         wait, and an empty button is worse than no button */
      (action ? '<button class="cup-card-b" type="button">' + action + '</button>' : "") +
      (opts.alt ? '<button class="cup-card-alt" type="button">' + opts.alt + '</button>' : "") +
      '</div>';
    el.hidden = false;
    el.setAttribute("aria-hidden", "false");
    overlayGo = onGo || null;
    var b = el.querySelector(".cup-card-b");
    if (b) b.addEventListener("click", function (e) {
      e.stopPropagation(); SFX.pick();
      if (overlayGo) overlayGo();
    });
    paintCardFlags();
    var a = el.querySelector(".cup-card-alt");
    if (a && opts.onAlt) a.addEventListener("click", function (e) {
      e.stopPropagation(); SFX.pick(); opts.onAlt();
    });
  }
  function hideOverlay() {
    var el = EL["cup-overlay"];
    if (!el) return;
    el.hidden = true;
    el.setAttribute("aria-hidden", "true");
    el.innerHTML = "";
    overlayGo = null;
  }
  /* the button during a card, and the tap-anywhere that goes with it */
  function skipState() { if (overlayGo) overlayGo(); }

  /* =======================================================================
     WHAT A CARD CAN BE MADE OF

     Three blocks, reused by every screen in the chapter: the two team
     sheets, the run through the tournament, and a table of how a half
     actually went. A round card that says only who she is playing tells
     her less than the fixture list on a wall.
     ======================================================================= */
  var ROLE_NAME = { gk: "GK", def: "DEF", mid: "MID", st: "ST" };

  function teamSheet(id, sideLabel) {
    var t = teamById(id);
    var rows = squadOf(t).map(function (m) {
      return "<li><em>" + (ROLE_NAME[m.role] || "") + "</em> " +
             (m.captain || m.star ? "<b>" + m.name + "</b>" : m.name) + "</li>";
    }).join("");
    return '<div class="cup-team">' +
           '<span class="cup-team-flag" data-team="' + t.id + '"></span>' +
           "<h4>" + t.name + "</h4><ol>" + rows + "</ol>" +
           (sideLabel ? "" : "") + "</div>";
  }
  function teamsBlock(a, b) {
    return '<div class="cup-teams">' + teamSheet(a) +
           '<span class="cup-vs">v</span>' + teamSheet(b) + "</div>";
  }
  function bracketBlock(at) {
    return '<div class="cup-bracket">' + CUP.map(function (r, i) {
      var st = i < at ? "won" : i === at ? "now" : "next";
      return '<span class="cup-leg" data-s="' + st + '">' + r.round +
             "<b>" + (teamById(r.id) || {}).short + "</b></span>";
    }).join("") + "</div>";
  }
  function statsBlock() {
    var tot = G.stat.poss[0] + G.stat.poss[1];
    var hp = tot > 2 ? Math.round((G.stat.poss[0] / tot) * 100) : 50;
    var rows = [
      ["POSSESSION", hp + "%", (100 - hp) + "%"],
      ["SHOTS", G.stat.shots[0], G.stat.shots[1]],
      ["GOALS", G.score[0], G.score[1]],
    ];
    return '<div class="cup-table">' + rows.map(function (r) {
      return "<div><b>" + r[1] + "</b><span>" + r[0] + "</span><b>" + r[2] + "</b></div>";
    }).join("") + "</div>";
  }
  /* the flags are canvases, so they go in after the card is in the DOM */
  function paintCardFlags() {
    var el = EL["cup-overlay"];
    if (!el) return;
    Array.prototype.forEach.call(el.querySelectorAll("[data-team]"), function (n) {
      var t = teamById(n.dataset.team);
      if (!t) return;
      n.innerHTML = "";
      n.appendChild(badgeCanvas(t, 96, 64));
    });
  }

  /* =======================================================================
     THE MENUS — title, team select, and the squad builder

     All DOM inside the same card the round screens use, so they arrive
     with the same weight as everything else in the chapter rather than
     looking like a settings dialog that wandered in.

     The builder is the piece with real state behind it: a squad she has
     put together is saved to localStorage and then joins the carousel
     as a team like any other, which is why `squadOf` and `teamById` do
     not care where a side came from.
     ======================================================================= */
  var CUSTOM_KEY = "cup_custom_v1";
  var carAt = 0;
  var build = null;                     // the squad under construction

  function loadCustom() {
    try {
      var raw = localStorage.getItem(CUSTOM_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) { return []; }
  }
  function saveCustom(list) {
    try { localStorage.setItem(CUSTOM_KEY, JSON.stringify(list)); } catch (e) {}
  }
  /* every side she can pick: the config's, then her own */
  function allTeams() { return cfg("TEAMS", []).concat(loadCustom()); }
  var customPatched = false;
  function patchTeamLookup() {
    if (customPatched) return;
    customPatched = true;
    var base = teamById;
    teamById = function (id) {
      var t = base(id);
      if (t) return t;
      var mine = loadCustom();
      for (var i = 0; i < mine.length; i++) if (mine[i].id === id) return mine[i];
      return null;
    };
  }

  /* a side's four stats, averaged, and the rating that comes out of them */
  function teamStats(team) {
    var sq = squadOf(team);
    var o = { speed: 0, power: 0, skill: 0, defence: 0 };
    if (!sq.length) return o;
    sq.forEach(function (m) {
      o.speed += m.stats.speed; o.power += m.stats.power;
      o.skill += m.stats.skill; o.defence += m.stats.defence;
    });
    Object.keys(o).forEach(function (k) { o[k] = Math.round(o[k] / sq.length); });
    return o;
  }
  function teamRating(team) {
    var st = teamStats(team);
    return Math.round((st.speed + st.power + st.skill + st.defence) / 4);
  }

  function barsHtml(st) {
    var rows = [["spd", "SPEED", st.speed], ["pow", "POWER", st.power],
                ["skl", "SKILL", st.skill], ["def", "DEFENCE", st.defence]];
    return '<div class="cup-bars">' + rows.map(function (r) {
      return '<span class="cup-bar" data-k="' + r[0] + '"><u>' + r[1] +
             '</u><i><b data-w="' + r[2] + '"></b></i><s>' + r[2] + '</s></span>';
    }).join("") + "</div>";
  }
  /* the bars grow after the card is in the DOM, which is the whole
     reason they are worth having rather than printing four numbers */
  function animateBars() {
    var el = EL["cup-overlay"];
    if (!el) return;
    requestAnimationFrame(function () {
      Array.prototype.forEach.call(el.querySelectorAll(".cup-bar b"), function (b) {
        b.style.width = Math.max(2, Math.min(100, +b.dataset.w)) + "%";
      });
    });
  }

  /* ---------------------------------------------------------------- title */
  function titleMenu() {
    var modes = cfg("MODES", []);
    overlay(cfg("TITLE", "Ouissy\u2019s Cup"), "", "", null, {
      kicker: "QUATRE CONTRE QUATRE",
      html: '<div class="cup-menu">' +
        '<p class="cup-menu-sub">' + cfg("TAGLINE", "") + "</p>" +
        '<div class="cup-menu-list">' +
        modes.map(function (m) {
          return '<button class="cup-menu-b' + (m.primary ? " primary" : "") +
                 '" data-go="' + m.id + '">' + m.name +
                 (m.note ? "<small>" + m.note + "</small>" : "") + "</button>";
        }).join("") +
        '<button class="cup-menu-b" data-go="teams">LES \u00c9QUIPES' +
          "<small>pick a faculty, or build your own squad</small></button>" +
        '<button class="cup-menu-b" data-go="help">COMMENT JOUER</button>' +
        '<button class="cup-menu-b" data-go="quit">RETOUR AU LIVRE</button>' +
        "</div></div>",
    });
    wireMenu({
      coupe: function () {
        run.fixture = null; run.quick = false; run.round = 0;
        hideOverlay(); roundCard();
      },
      /* the derby is its own fixture: his faculty against hers, under
         the lights, and it does not need a bracket to matter */
      derby: function () {
        var mine = derbyTeam("hers"), theirs = derbyTeam("his");
        run.myTeam = mine;
        run.quick = true;
        run.fixture = { mine: mine, theirs: theirs, venue: "night",
          round: { round: "LE DERBY", skill: 0.72, venue: "night",
                   before: "Dentaire contre m\u00e9decine. He has been talking " +
                           "about this one for a fortnight.",
                   won: "You beat his faculty. He will hear about it all year.",
                   lost: "His faculty took it. He is being very gracious, which is worse." } };
        run.round = 0;
        hideOverlay(); roundCard();
      },
      amical: function () { carAt = 0; teamSelect("quick"); },
      teams: function () { carAt = 0; teamSelect("pick"); },
      help: function () { helpCard(titleMenu); },
      quit: function () { quit(); },
    });
  }

  /* whose faculty is whose, out of the config rather than by name */
  function derbyTeam(side) {
    var list = cfg("TEAMS", []);
    for (var i = 0; i < list.length; i++) if (list[i].derby === side) return list[i].id;
    return side === "hers" ? "fmpm" : "fmdc";
  }

  function wireMenu(map) {
    var el = EL["cup-overlay"];
    if (!el) return;
    Array.prototype.forEach.call(el.querySelectorAll("[data-go]"), function (b) {
      b.addEventListener("click", function (e) {
        e.stopPropagation();
        SFX.pick();
        var fn = map[b.dataset.go];
        if (fn) fn(b);
      });
    });
  }

  /* ------------------------------------------------------------ carousel */
  function teamSelect(mode) {
    var list = allTeams();
    if (!list.length) return titleMenu();
    carAt = ((carAt % list.length) + list.length) % list.length;
    var t = list[carAt];
    var st = teamStats(t);
    var sq = squadOf(t);
    var cap = sq.filter(function (m) { return m.captain; })[0] || sq[1] || sq[0];
    var capR = cap ? ROSTER[cap.id] : null;

    overlay(mode === "quick" ? "VOTRE FACULT\u00c9"
          : mode === "opp" ? "CONTRE QUI ?" : "LES \u00c9QUIPES", "", "", null, {
      kicker: (carAt + 1) + " / " + list.length,
      html: '<div class="cup-menu">' +
        '<div class="cup-car">' +
        '<button class="cup-car-arrow" data-go="prev">&#9664;</button>' +
        '<div class="cup-tcard">' +
          '<div class="cup-tcard-top">' +
            '<span class="cup-tcard-badge" data-team="' + t.id + '"></span>' +
            '<span class="cup-tcard-name"><h4>' + t.name + "</h4>" +
            "<span>" + (t.sub ? t.sub + " \u00b7 " : "") +
            (t.custom ? "your own squad" : "rated " + teamRating(t)) +
            "</span></span>" +
          "</div>" +
          '<div class="cup-tcard-body">' +
            '<ol class="cup-tcard-squad">' + sq.map(function (m) {
              return "<li><em>" + (ROLE_NAME[m.role] || "") + "</em> " +
                     (m.captain ? "<b>" + m.name + "</b>" : m.name) + "</li>";
            }).join("") + "</ol>" +
            barsHtml(st) +
          "</div>" +
          (capR && capR.super ?
            '<p class="cup-super"><b style="background:' + capR.super.colour + '">\u2665 ' +
            capR.super.name + "</b> \u2014 " + capR.super.note + "</p>" : "") +
        "</div>" +
        '<button class="cup-car-arrow" data-go="next">&#9654;</button>' +
        "</div>" +
        '<div class="cup-btnrow">' +
        '<button class="cup-menu-b primary" data-go="use">' +
          (mode === "quick" ? "JOUER AVEC EUX"
           : mode === "opp" ? "LES AFFRONTER" : "CHOISIR") + "</button>" +
        '<button class="cup-menu-b" data-go="build">BUILD YOUR OWN</button>' +
        (t.custom ? '<button class="cup-menu-b" data-go="del">DELETE</button>' : "") +
        '<button class="cup-menu-b" data-go="back">BACK</button>' +
        "</div></div>",
    });
    animateBars();
    wireMenu({
      prev: function () { carAt--; teamSelect(mode); },
      next: function () { carAt++; teamSelect(mode); },
      use: function () {
        patchTeamLookup();
        if (mode === "quick") {
          /* a friendly is two choices: her side, then theirs. The second
             pass through the same carousel picks the opponent, and the
             match is played at whichever campus THEY are at home on. */
          run.myTeam = t.id;
          carAt = (carAt + 1) % list.length;
          return teamSelect("opp");
        }
        if (mode === "opp") {
          var them = t;
          run.quick = true;
          run.fixture = { mine: run.myTeam, theirs: them.id,
            venue: them.venue || "rabat",
            round: { round: "MATCH AMICAL", skill: 0.58, venue: them.venue || "rabat",
                     before: "A friendly, on their grass.",
                     won: "Won it. It counts for nothing and it counts for everything.",
                     lost: "Lost a friendly. It is called a friendly for a reason." } };
          run.round = 0;
          hideOverlay(); roundCard();
          return;
        }
        run.myTeam = t.id;
        hideOverlay();
        titleMenu();
      },
      build: function () { openBuilder(mode); },
      del: function () {
        saveCustom(loadCustom().filter(function (c) { return c.id !== t.id; }));
        carAt = 0; teamSelect(mode);
      },
      back: function () { titleMenu(); },
    });
  }

  /* ------------------------------------------------------------- builder */
  var SWATCHES = ["#c1272d", "#1d6b6e", "#e8a63c", "#7a4fb0", "#2f7fc4",
                  "#5f9a5c", "#b8556e", "#2b3340", "#f6efdd", "#e8764a"];
  var CRESTS = ["heart", "star", "flame", "mountain", "lantern", "leaf",
                "note", "shield", "rose", "wave", "key", "book", "moon"];

  function blankBuild() {
    return { id: "own_" + Date.now(), custom: true, name: "OUR SIDE", short: "OUR",
             crest: "heart", flag: "crest", squad: [null, null, null, null],
             captain: null, formation: "diamond",
             kit: { shirt: "#c1272d", shirtDark: "#8f1a20", shorts: "#f6efdd",
                    shortsDark: "#cdbf9f", socks: "#c1272d", trim: "#e8a63c" },
             gkKit: { shirt: "#2a2438", shirtDark: "#1a1626", shorts: "#12101c",
                      shortsDark: "#0a0812", socks: "#2a2438", trim: "#ffd45e" } };
  }
  function shade(hex, f) {
    var n = parseInt(hex.slice(1), 16);
    var r = Math.round(((n >> 16) & 255) * f), g2 = Math.round(((n >> 8) & 255) * f),
        b2 = Math.round((n & 255) * f);
    return "#" + ((1 << 24) + (r << 16) + (g2 << 8) + b2).toString(16).slice(1);
  }

  function openBuilder(backTo) {
    if (!build) build = blankBuild();
    drawBuilder(backTo);
  }

  function drawBuilder(backTo) {
    var roster = cfg("ROSTER", []);
    var keepers = roster.filter(function (r) { return r.role === "gk"; });
    var outfield = roster.filter(function (r) { return r.role !== "gk"; });
    var chosen = build.squad.filter(Boolean);
    var full = chosen.length === 4;
    var rating = full ? teamRating(build) : 0;

    var pick = function (r) {
      var on = build.squad.indexOf(r.id) >= 0;
      var isGk = r.role === "gk";
      var slotFull = isGk ? !!build.squad[0] && !on
                          : chosen.filter(function (id) { return id !== build.squad[0]; }).length >= 3 && !on;
      return '<button class="cup-pick" data-go="pick" data-id="' + r.id + '"' +
             ' data-on="' + (on ? 1 : 0) + '"' + (slotFull ? " disabled" : "") + '>' +
             '<i style="background:' + (r.colour ? r.colour.a : "#888") + '"></i>' +
             "<span>" + r.name + " <em>" + (ROLE_NAME[r.role] || "") + " \u00b7 " +
             Math.round((r.stats.speed + r.stats.power + r.stats.skill + r.stats.defence) / 4) +
             "</em></span></button>";
    };

    var slots = ["gk", "1", "2", "3"].map(function (lab, i) {
      var id = build.squad[i];
      var r = id ? ROSTER[id] : null;
      var isCap = id && build.captain === id;
      return '<div class="cup-slot' + (isCap ? " cap" : "") + (r ? "" : " empty") + '">' +
             "<em>" + (i === 0 ? "GK" : ROLE_NAME[r ? r.role : "mid"] || "") + "</em>" +
             "<span>" + (r ? r.name : "\u2014 empty \u2014") + "</span>" +
             (r && i > 0 ? '<button class="cup-form" data-go="cap" data-id="' + id + '"' +
                ' data-on="' + (isCap ? 1 : 0) + '">CAPTAIN</button>' : "") +
             "</div>";
    }).join("");

    var capR = build.captain ? ROSTER[build.captain] : null;

    overlay("BUILD YOUR SQUAD", "", "", null, {
      kicker: "TEAM BUILDER", big: true,
      html: '<div class="cup-menu"><div class="cup-build">' +
        '<div class="cup-build-col"><h5>KEEPERS</h5><div class="cup-pool">' +
          keepers.map(pick).join("") + "</div>" +
          '<h5 style="margin-top:1.2cqh">OUTFIELD \u2014 PICK THREE</h5>' +
          '<div class="cup-pool">' + outfield.map(pick).join("") + "</div></div>" +

        '<div class="cup-build-col"><h5>YOUR SIDE</h5>' +
          '<div class="cup-slots">' + slots + "</div>" +
          '<div class="cup-rating"><b>' + (full ? rating : "--") + "</b> TEAM RATING</div>" +
          (full ? barsHtml(teamStats(build)) : "") +
          (capR && capR.super ?
            '<p class="cup-super"><b style="background:' + capR.super.colour + '">\u2665 ' +
            capR.super.name + "</b> \u2014 your team\u2019s super</p>" : "") +

          '<div class="cup-row"><label>NAME</label>' +
            '<input type="text" id="cup-bname" maxlength="22" value="' +
            String(build.name).replace(/"/g, "&quot;") + '"></div>' +
          '<div class="cup-row"><label>KIT</label>' +
            SWATCHES.map(function (c) {
              return '<button class="cup-swatch" data-go="kit" data-c="' + c + '"' +
                     ' data-on="' + (build.kit.shirt === c ? 1 : 0) +
                     '" style="background:' + c + '"></button>';
            }).join("") + "</div>" +
          '<div class="cup-row"><label>TRIM</label>' +
            SWATCHES.map(function (c) {
              return '<button class="cup-swatch" data-go="trim" data-c="' + c + '"' +
                     ' data-on="' + (build.kit.trim === c ? 1 : 0) +
                     '" style="background:' + c + '"></button>';
            }).join("") + "</div>" +
          '<div class="cup-row"><label>CREST</label><span class="cup-forms">' +
            CRESTS.map(function (k) {
              return '<button class="cup-form" data-go="crest" data-c="' + k + '"' +
                     ' data-on="' + (build.crest === k ? 1 : 0) + '">' + k + "</button>";
            }).join("") + "</span></div>" +
          '<div class="cup-row"><label>SHAPE</label><span class="cup-forms">' +
            cfg("FORMATIONS", []).map(function (f) {
              return '<button class="cup-form" data-go="form" data-c="' + f.id + '"' +
                     ' data-on="' + (build.formation === f.id ? 1 : 0) + '">' + f.name + "</button>";
            }).join("") + "</span></div>" +
          '<p class="cup-note">' + (formationNote(build.formation) || "") + "</p>" +
        "</div></div>" +

        '<div class="cup-btnrow">' +
        '<button class="cup-menu-b primary" data-go="save"' + (full ? "" : " disabled") +
          ">SAVE THIS SIDE</button>" +
        '<button class="cup-menu-b" data-go="rand">RANDOMISE</button>' +
        '<button class="cup-menu-b" data-go="reset">RESET</button>' +
        '<button class="cup-menu-b" data-go="back">BACK</button>' +
        "</div></div>",
    });
    animateBars();

    var nameEl = document.getElementById("cup-bname");
    if (nameEl) nameEl.addEventListener("input", function () {
      build.name = nameEl.value || "OUR SIDE";
      build.short = build.name.replace(/[^A-Za-z]/g, "").slice(0, 3).toUpperCase() || "OUR";
    });

    wireMenu({
      pick: function (b) { togglePick(b.dataset.id); drawBuilder(backTo); },
      cap: function (b) { build.captain = b.dataset.id; drawBuilder(backTo); },
      kit: function (b) {
        build.kit.shirt = b.dataset.c;
        build.kit.shirtDark = shade(b.dataset.c, 0.72);
        build.kit.socks = b.dataset.c;
        drawBuilder(backTo);
      },
      trim: function (b) { build.kit.trim = b.dataset.c; drawBuilder(backTo); },
      crest: function (b) { build.crest = b.dataset.c; drawBuilder(backTo); },
      form: function (b) { build.formation = b.dataset.c; drawBuilder(backTo); },
      rand: function () { randomiseBuild(); drawBuilder(backTo); },
      reset: function () { build = blankBuild(); drawBuilder(backTo); },
      save: function () {
        if (build.squad.filter(Boolean).length !== 4) return;
        if (!build.captain) build.captain = build.squad[1];
        var mine = loadCustom().filter(function (c) { return c.id !== build.id; });
        mine.push(JSON.parse(JSON.stringify(build)));
        saveCustom(mine);
        patchTeamLookup();
        carAt = cfg("TEAMS", []).length + mine.length - 1;
        build = null;
        teamSelect(backTo || "pick");
      },
      back: function () { teamSelect(backTo || "pick"); },
    });
  }

  function formationNote(id) {
    var f = cfg("FORMATIONS", []).filter(function (x) { return x.id === id; })[0];
    return f ? f.note : "";
  }

  function togglePick(id) {
    var r = ROSTER[id];
    if (!r) return;
    var at = build.squad.indexOf(id);
    if (at >= 0) {
      build.squad[at] = null;
      if (build.captain === id) build.captain = null;
      return;
    }
    if (r.role === "gk") { build.squad[0] = id; return; }
    for (var i = 1; i < 4; i++) if (!build.squad[i]) { build.squad[i] = id; break; }
    if (!build.captain) build.captain = id;
  }

  function randomiseBuild() {
    var roster = cfg("ROSTER", []);
    var gks = roster.filter(function (r) { return r.role === "gk"; });
    var out = roster.filter(function (r) { return r.role !== "gk"; }).slice();
    for (var i = out.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = out[i]; out[i] = out[j]; out[j] = tmp;
    }
    build.squad = [gks[Math.floor(Math.random() * gks.length)].id,
                   out[0].id, out[1].id, out[2].id];
    build.captain = out[0].id;
    build.kit.shirt = SWATCHES[Math.floor(Math.random() * SWATCHES.length)];
    build.kit.shirtDark = shade(build.kit.shirt, 0.72);
    build.kit.socks = build.kit.shirt;
    build.kit.trim = SWATCHES[Math.floor(Math.random() * SWATCHES.length)];
    build.crest = CRESTS[Math.floor(Math.random() * CRESTS.length)];
  }

  function helpCard(back) {
    overlay("HOW TO PLAY", "", "", null, {
      kicker: "CONTROLS", big: true,
      html: '<div class="cup-menu"><div class="cup-table">' +
        "<div><b>MOVE</b><span>stick, or W A S D</span><b>&nbsp;</b></div>" +
        "<div><b>TAP</b><span>pass \u00b7 or tackle when they have it</span><b>&nbsp;</b></div>" +
        "<div><b>HOLD</b><span>wind up a shot \u00b7 or sprint</span><b>&nbsp;</b></div>" +
        "<div><b>\u2665 FULL</b><span>tap to unleash the super</span><b>&nbsp;</b></div>" +
        "</div>" +
        '<p class="cup-note">You are always whoever is nearest the ball. ' +
        "It never switches away while you are carrying it.</p>" +
        '<div class="cup-btnrow"><button class="cup-menu-b primary" data-go="back">GOT IT</button></div>' +
        "</div>",
    });
    wireMenu({ back: function () { (back || titleMenu)(); } });
  }

  /* =======================================================================
     20. THE CUP

     Three rounds. Losing one does not throw the whole run away — she is
     offered the same round again, because this is a present and not a
     test, and being sent back to the group stage for losing a semi-final
     is the sort of thing that makes somebody close the tab.
     ======================================================================= */
  var run = { round: 0, won: 0 };

  function roundCard() {
    var r = CUP[run.round];
    var them = teamById(r.id);
    overlay(them.name, r.before, "KICK OFF", function () {
      hideOverlay();
      G = newMatch(run.round, run.fixture);
      applyVenue(G.venue);
      buildRigs();
      setFlag(EL["cup-h-flag"], teamById(G.ids[0]));
      setFlag(EL["cup-a-flag"], teamById(G.ids[1]));
      EL["cup-h-name"].textContent = teamById(G.ids[0]).short;
      EL["cup-a-name"].textContent = teamById(G.ids[1]).short;
      EL["cup-round"].textContent = r.round;
      resetPositions(0);
      if (EL["cup-hud"]) EL["cup-hud"].hidden = false;
      if (EL["cup-pad"]) EL["cup-pad"].hidden = false;
      if (EL["cup-pause-btn"]) EL["cup-pause-btn"].hidden = false;
      startCrowd();
    }, { kicker: r.round, big: true,
         body: venueBlock(r.venue) + bracketBlock(run.round) +
               teamsBlock(run.myTeam || "fmpm", r.id) });
  }

  /* Where the fixture is being played. Half of what makes six matches
     feel like six occasions rather than one pitch six times is simply
     being told, before each one, whose campus you are standing on. */
  function venueBlock(id) {
    var v = venueById(id);
    if (!v) return "";
    return '<div class="cup-venue"><span class="cup-venue-h">' + v.hour + "</span>" +
           "<span><b>" + v.name + "</b><i>" + (v.note || "") + "</i></span></div>";
  }

  function finishRound(won) {
    var r = CUP[run.round];
    if (EL["cup-pad"]) EL["cup-pad"].hidden = true;
    setTimeout(function () {
      if (!playing) return;
      if (won) {
        run.won++;
        if (run.round >= CUP.length - 1) return theEnd();
        overlay("FULL TIME", scoreLine(), "NEXT ROUND", function () {
          run.round++; hideOverlay(); roundCard();
        }, { kicker: "WON", note: r.won,
             body: statsBlock() + bracketBlock(run.round + 1) });
      } else {
        overlay("FULL TIME", scoreLine(), "PLAY IT AGAIN", function () {
          hideOverlay(); roundCard();
        }, { kicker: "LOST", note: r.lost, body: statsBlock(),
             alt: "LEAVE IT FOR NOW", onAlt: function () { quit(); } });
      }
    }, 1400);
  }

  /* The trophy, and what he says. Every chapter on this site ends with
     him saying something; this one has had a whole stadium shouting for
     ninety minutes, so it ends quietly. */
  function theEnd() {
    if (EL["cup-hud"]) EL["cup-hud"].hidden = true;
    stopCrowd();
    try { if (window.markCupDone) window.markCupDone(); } catch (e) {}
    overlay("THE CUP",
      "You won it. Morocco, four a side, and a bear at the back.",
      "TAKE IT HOME",
      function () { quit(); },
      { kicker: "FULL TIME",
        big: true,
        note: "I put you in a shirt and a stadium and gave you the whole " +
              "thing to win, and you still went and won it. Of course you " +
              "did. I have watched you do the harder version of this all " +
              "year with nobody in the stands at all." });
  }

  /* =======================================================================
     21. RUNNING AND STOPPING
     ======================================================================= */
  function frame(now) {
    if (!playing) return;
    raf = requestAnimationFrame(frame);
    if (!lastT) lastT = now;
    var dt = Math.min(0.05, (now - lastT) / 1000);
    lastT = now;
    /* SLOW MOTION. The goal stretches time and then lets it go. It is
       applied to the accumulator rather than to the step, so the
       physics still run at a fixed tick and nothing changes behaviour
       just because the world got slower to watch. */
    if (G) {
      G.timeScale += ((G.state === "goal" && G.stateT < 1.1 ? 0.35 : 1) - G.timeScale)
                     * Math.min(1, dt * 3.2);
      dt *= G.timeScale;
    }
    acc += dt;
    /* fixed steps, because the ball, the tackles and the goal line all
       depend on nobody passing through anything, and a 4fps frame on a
       cold phone would walk the ball straight through the net */
    var guard = 0;
    while (acc >= FIXED && guard++ < 6) { step(FIXED); acc -= FIXED; }
    if (acc > 0.4) acc = 0;
    syncRing();
    draw(dt);
    syncHud();
  }

  var wired = false;
  function wire() {
    if (wired) return;
    wired = true;

    document.addEventListener("keydown", function (e) {
      if (!playing) return;
      var k = e.key;
      if (k === "ArrowLeft" || k === "a" || k === "A") IN.keys.left = true;
      else if (k === "ArrowRight" || k === "d" || k === "D") IN.keys.right = true;
      else if (k === "ArrowUp" || k === "w" || k === "W") IN.keys.up = true;
      else if (k === "ArrowDown" || k === "s" || k === "S") IN.keys.down = true;
      else if (k === " " || k === "Spacebar" || k === "Enter") { pressButton(); }
      else if (k === "Escape") { quit(); return; }
      else return;
      e.preventDefault();
    });
    document.addEventListener("keyup", function (e) {
      if (!playing) return;
      var k = e.key;
      if (k === "ArrowLeft" || k === "a" || k === "A") IN.keys.left = false;
      else if (k === "ArrowRight" || k === "d" || k === "D") IN.keys.right = false;
      else if (k === "ArrowUp" || k === "w" || k === "W") IN.keys.up = false;
      else if (k === "ArrowDown" || k === "s" || k === "S") IN.keys.down = false;
      else if (k === " " || k === "Spacebar" || k === "Enter") releaseButton();
    });

    /* The stick appears wherever a thumb lands on the left of the
       picture rather than sitting in a fixed ring, so it is always under
       the thumb that is already there — the racer learned the same thing
       about its steering. */
    var st = EL["cup-stick"];
    if (st) {
      st.addEventListener("pointerdown", function (e) {
        if (IN.stickId !== null) return;
        IN.stickId = e.pointerId;
        var r = st.getBoundingClientRect();
        IN.stickX = e.clientX - r.left; IN.stickY = e.clientY - r.top;
        IN.curX = IN.stickX; IN.curY = IN.stickY;
        st.setPointerCapture(e.pointerId);
        st.classList.add("used");
        if (EL["cup-pad"]) EL["cup-pad"].classList.add("touch");
        showStick(true);
        e.preventDefault();
      });
      st.addEventListener("pointermove", function (e) {
        if (e.pointerId !== IN.stickId) return;
        var r = st.getBoundingClientRect();
        IN.curX = e.clientX - r.left; IN.curY = e.clientY - r.top;
        showStick(true);
      });
      var letGo = function (e) {
        if (e.pointerId !== IN.stickId) return;
        IN.stickId = null; showStick(false);
      };
      st.addEventListener("pointerup", letGo);
      st.addEventListener("pointercancel", letGo);
      st.addEventListener("pointerleave", letGo);
    }

    var bt = EL["cup-btn"];
    if (bt) {
      bt.addEventListener("pointerdown", function (e) {
        if (EL["cup-pad"]) EL["cup-pad"].classList.add("touch");
        IN.btnId = e.pointerId;
        bt.setPointerCapture(e.pointerId);
        bt.classList.add("on");
        pressButton();
        e.preventDefault();
      });
      var up = function (e) {
        if (IN.btnId !== null && e.pointerId !== IN.btnId) return;
        IN.btnId = null;
        bt.classList.remove("on");
        releaseButton();
      };
      bt.addEventListener("pointerup", up);
      bt.addEventListener("pointercancel", up);
    }

    var pb = EL["cup-pause-btn"];
    if (pb) pb.addEventListener("click", function () { pause(); });

    /* losing the window means losing every finger */
    window.addEventListener("blur", function () {
      IN.keys = {}; IN.stickId = null; IN.btnId = null;
      IN.held = false; IN.heldT = 0;
      showStick(false);
    });
  }

  function showStick(on) {
    var k = EL["cup-stick-k"];
    if (!on && EL["cup-stick"]) EL["cup-stick"].classList.remove("hold");
    if (!k) return;
    if (!on || IN.stickId === null) { k.hidden = true; return; }
    k.hidden = false;
    var dx = IN.curX - IN.stickX, dy = IN.curY - IN.stickY;
    var d = len(dx, dy);
    var cap = 34;
    if (d > cap) { dx = (dx / d) * cap; dy = (dy / d) * cap; }
    k.style.left = IN.stickX + "px";
    k.style.top = IN.stickY + "px";
    if (EL["cup-stick"]) EL["cup-stick"].classList.add("hold");
    k.style.setProperty("--kx", dx.toFixed(1) + "px");
    k.style.setProperty("--ky", dy.toFixed(1) + "px");
  }

  function pause() {
    if (!playing || !G) return;
    var was = G.state;
    G.state = "paused";
    stopCrowd();
    overlay("PAUSED", scoreLine(), "BACK TO THE MATCH", function () {
      hideOverlay();
      G.state = was === "paused" ? "play" : was;
      startCrowd();
    }, { alt: "LEAVE THE CUP", onAlt: function () { quit(); } });
  }

  /* Starting is asynchronous now, because the world has to exist before
     anything can be put in it. The card goes up first either way, so
     what she sees is the round she is about to play rather than a blank
     green rectangle while three.js arrives. */
  function start() {
    cacheEls();
    wire();
    playing = true;
    lastT = 0; acc = 0;
    run = { round: 0, won: 0 };
    if (EL["cup-hud"]) EL["cup-hud"].hidden = true;
    if (EL["cup-pad"]) EL["cup-pad"].hidden = true;
    if (EL["cup-pause-btn"]) EL["cup-pause-btn"].hidden = true;
    clearBanner();
    overlay("OUISSY&rsquo;S CUP", "getting the pitch ready\u2026", "", null,
            { kicker: "FOUR A SIDE", big: true });
    audio();

    return loadThree().then(function () {
      if (!playing) return;
      if (!scene) { buildWorld(); buildRenderer(); buildMarkers(); buildBall(); buildConfetti(); }
      sizeRenderer();
      G = newMatch(0);
      buildRigs();
      resetPositions(0);
      placeCamera(0, true);
      renderer.render(scene, camera);
      patchTeamLookup();
      titleMenu();
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(frame);
    }).catch(function (e) {
      overlay("OUISSY&rsquo;S CUP", "the pitch would not load", "BACK TO THE HUB",
              function () { quit(); }, { kicker: "SORRY" });
    });
  }

  function stop() {
    playing = false;
    if (raf) cancelAnimationFrame(raf);
    raf = null;
    stopCrowd();
    hideOverlay();
    clearBanner();
    IN.keys = {}; IN.stickId = null; IN.btnId = null; IN.held = false;
  }

  /* The way back. The site hands every chapter a door rather than
     letting it reach for pageTurn itself, so the screen flow stays in
     one file — see window.leaveCup in script.js. */
  function quit() {
    stop();
    try {
      if (window.leaveCup) window.leaveCup();
      else if (window.showScreen) window.showScreen("hub");
    } catch (e) {}
  }

  /* =======================================================================
     22. WHAT A HARNESS CAN SEE

     Read-only, except for the few that drive the game the way a thumb
     does — a test that cannot press the button cannot test what the
     button does, and the button is four different things.
     ======================================================================= */
  var hooks = {
    state: function () {
      if (!G) return null;
      return { state: G.state, half: G.half, clock: +G.clock.toFixed(2),
               score: G.score.slice(), round: run.round, over: G.over,
               golden: G.golden, controlled: G.controlled && G.controlled.name,
               owner: G.ball.owner && G.ball.owner.name,
               ballX: +G.ball.x.toFixed(1), ballY: +G.ball.y.toFixed(1),
               ballZ: +G.ball.z.toFixed(1), cam: +G.cam.y.toFixed(1),
               players: G.players.length };
    },
    step: function (n, ux, uy, held) {
      IN.keys = {};
      if (ux || uy) { IN.stickId = 0; IN.stickX = 0; IN.stickY = 0;
                      IN.curX = ux * 40; IN.curY = uy * 40; }
      else IN.stickId = null;
      IN.held = !!held;
      for (var i = 0; i < (n || 1); i++) step(FIXED);
      return hooks.state();
    },
    press: pressButton,
    release: releaseButton,
    put: function (x, y, z) {
      G.ball.x = x; G.ball.y = y; G.ball.z = z || 0;
      G.ball.vx = G.ball.vy = G.ball.vz = 0;
      G.ball.owner = null; G.ball.lock = 0;
      return hooks.state();
    },
    kick: function (vx, vy, vz) {
      G.ball.owner = null; G.ball.lock = 0;
      G.ball.vx = vx; G.ball.vy = vy; G.ball.vz = vz || 0;
    },
    setState: function (s) { G.state = s; G.stateT = 0; },
    setClock: function (c) { G.clock = c; },
    setScore: function (a, b) { G.score[0] = a; G.score[1] = b; },
    round: function () { return run.round; },
    /* the handful of read-outs tools/cupfeel.js needs to judge whether
       the football is any good, rather than whether it runs */
    reset: function (r) {
      run.round = r || 0; run.quick = false;
      G = newMatch(run.round);
      buildRigs();
      resetPositions(0);
      G.state = "play"; G.stateT = 0;
      return hooks.state();
    },
    me: function () {
      var p = G.controlled;
      return p ? { name: p.name, x: +p.x.toFixed(1), y: +p.y.toFixed(1) } : null;
    },
    attackSign: function () { return attackDir(0); },
    /* which touchline the camera is on. The stick is read in the
       camera's frame, so a harness that drives in pitch coordinates
       steers her at ninety degrees to where it meant to. */
    camSide: function () { return camSide(); },
    goalY: function () { return goalY(0); },
    charged: function () { return IN.held ? clamp(IN.heldT / TUNE.chargeTime, 0, 1) : 0; },
    shots: function () { return G.stat.shots[0] + G.stat.shots[1]; },
    shotsBy: function () { return G.stat.shots.slice(); },
    possBy: function () { return [+G.stat.poss[0].toFixed(1), +G.stat.poss[1].toFixed(1)]; },
    /* where each side's attacks die, which is the only way to tell a
       team that cannot shoot from one that never gets there */
    probe: function () {
      var d = attackDir(0);
      var inTheirHalf = (G.ball.y - PITCH.cy) * d > 0;
      return { half: inTheirHalf ? 1 : 0,
               owner: G.ball.owner ? G.ball.owner.team : -1,
               box: Math.abs(G.ball.y - goalY(0)) < PITCH.boxH &&
                    Math.abs(G.ball.x - PITCH.cx) < PITCH.boxW / 2 };
    },
    reach: function () {
      var d = attackDir(0), own = ownGoalY(0);
      return clamp(Math.abs(G.ball.y - own) / PITCH.h, 0, 1);
    },
    /* hold one player in one pose so every animation can be looked at
       instead of waited for */
    pose: function (idx, state, t) {
      var p = G.players[idx];
      p.anim = { state: state, t: t || 0, dur: 99, once: true, seed: 0.3,
                 prev: state, blend: 1 };
      return p.name;
    },
    anims: function () {
      return G.players.map(function (p) {
        return p.name + ":" + (p.anim ? p.anim.state + (p.anim.once ? "!" : "") : "-");
      }).join(" ");
    },
    celebration: function () {
      return { scorer: G.scorerP && G.scorerP.name, by: G.scoredBy,
               cel: G.celebration, state: G.state, t: +G.stateT.toFixed(2),
               timeScale: +G.timeScale.toFixed(2) };
    },
    players: function () {
      return G.players.map(function (p) {
        return { name: p.name, team: p.team, role: p.role, face: p.face,
                 x: +p.x.toFixed(1), y: +p.y.toFixed(1),
                 facing: p.facing, legs: p.legs, gk: p.gk };
      });
    },
    geometry: function () {
      return { view: VIEW, pitch: PITCH, world: WORLD_H, height: PH,
               cam: camera ? { x: +camera.position.x.toFixed(1),
                               y: +camera.position.y.toFixed(1),
                               z: +camera.position.z.toFixed(1) } : null,
               rigs: rigs.length, shadows: shadowsOn };
    },
    roster: function () { return cfg("ROSTER", []); },
    teams: function () { return cfg("TEAMS", []); },
    venues: function () { return cfg("VENUES", []); },
    venue: function (id) { applyVenue(id); },
    /* a full frame, not just a camera move: draw() is what walks the
       players out to where the simulation says they are, and without it
       every rig sits stacked on the centre spot */
    render: function () {
      if (!renderer) return;
      draw(0.016);
      placeCamera(0, true);
      renderer.render(scene, camera);
    },
    /* build one, unattached, so a harness can line the whole squad up
       and photograph it from close range */
    rig: function (spec) { return buildRig(spec); },
    /* pose a rig without the simulation owning it, so every animation
       can be photographed on its own */
    poseOnly: function (fakePlayer, rig, dt) { syncRig(fakePlayer, rig, dt); },
    /* clear the pitch, so a team photograph is not standing in the
       middle of a match that is still going on behind it */
    matchVisible: function (on) {
      rigs.forEach(function (r) { if (r && r.group) r.group.visible = !!on; });
      if (ballGroup) ballGroup.visible = !!on;
      if (ring) ring.visible = !!on;
    },
    three: function () { return { THREE: THREE, scene: scene, camera: camera, renderer: renderer }; },
    flag: flagCanvas,
    draw: draw,
    soundOff: function () { soundOn = false; },
    /* swiftshader in a container is not a graphics card: the harnesses
       turn the shadow map off so a screenshot comes back this year */
    shadows: function (on) {
      shadowsOn = !!on;
      if (renderer) renderer.shadowMap.enabled = shadowsOn;
      if (sun) sun.castShadow = shadowsOn;
      /* Turning the shadow map on after the fact is not enough: every
         material was compiled without it and keeps the program it was
         given. They have to be told to build a new one. */
      if (scene) scene.traverse(function (o) {
        if (o.material) {
          (Array.isArray(o.material) ? o.material : [o.material])
            .forEach(function (m) { m.needsUpdate = true; });
        }
      });
    },
    goto: function (r) { run.round = clamp(r, 0, CUP.length - 1); roundCard(); },
    finish: function (won) { finishRound(won); },
  };

  return { start: start, stop: stop, pause: pause, __cup: hooks };
})();

