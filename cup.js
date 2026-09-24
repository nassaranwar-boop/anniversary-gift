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
     crowd, the players, the ball, the net, the crests, the trophy and
     every sound are made at runtime. The whole chapter adds two scripts
     and nothing else to the site.
   - It is modelled in 3D and then rendered through a buffer a couple of
     hundred pixels tall and blown up with image-rendering: pixelated,
     so it reads as pixel art like the rest of the site while keeping a
     camera that can move. No shader, no post pass: the canvas backing
     store is simply made small.
   - Everything with words in it is DOM over the top, because pixel text
     painted into that buffer and blown up cannot be read — which the
     racer and the platformer both found out before this did.

   ---------------------------------------------------------------------
   WHO IS IN IT

   Six Moroccan health-sciences faculties, and fourteen original
   characters who play for them. Her side is FMPM Marrakech and she is
   the captain; his is FMDC Casablanca. The draw is fixed so that those
   two meet in the final, because that is the story the chapter is
   telling and a random bracket would tell a different one.

   Every one of them — the names, the kits, the squads, the stats, the
   supers, the campuses, the words between the rounds and the words at
   the end — is in cup.config.js. There is nothing personal in this
   file.

   ---------------------------------------------------------------------
   WHERE TO EDIT

   cup.config.js   everything above: who, where, what is said
   TUNE            how it FEELS to play: speeds, drag, how hard a shot
                   is, how far a challenge reaches, what a stat is worth
   SUPER_KIND      how each of the eleven Super Shots flies
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

  /* HIM.
     The ANWAR block in the config is the one place his name and his
     colouring are written down, and it is copied over the roster entry
     here rather than kept in two places that can disagree. The values it
     ships with are the ones the apocalypse builds him with, so the man in
     the dental faculty's shirt is the same man throughout the site. */
  (function applyAnwar() {
    var A = cfg("ANWAR", null), r = ROSTER.anwar;
    if (!A || !r) return;
    if (A.name) r.name = A.name;
    if (A.skin) r.skin = A.skin;
    if (A.hair) r.hair = A.hair;
    ["beard", "glasses", "curly"].forEach(function (k) {
      if (A[k] !== undefined) r[k] = A[k];
    });
    if (A.celebrationWith) r.pairWith = A.celebrationWith;
  })();

  /* ---------------------------------------------------------- difficulty
     Three settings, and each moves three different things rather than
     one: how good the opponents are, how fast her Heart meter fills, and
     how sharp the keepers are. A difficulty that only makes the other
     side slower is a difficulty you can feel being condescending. */
  var DIFF_KEY = "cup_diff_v1";
  var diffId = (function () {
    var d = null;
    try { d = localStorage.getItem(DIFF_KEY); } catch (e) {}
    return d || cfg("RULES.difficulty", "normal");
  })();
  function diffList() {
    return cfg("DIFFICULTIES", [{ id: "normal", name: "NORMAL", skill: 1, heart: 1, gk: 1 }]);
  }
  function diff() {
    var list = diffList();
    for (var i = 0; i < list.length; i++) if (list[i].id === diffId) return list[i];
    return list[Math.min(1, list.length - 1)] || list[0];
  }
  function setDiff(id) {
    diffId = id;
    try { localStorage.setItem(DIFF_KEY, id); } catch (e) {}
  }

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
    /* the empty slots of a squad still being picked are dropped rather
       than filled with a nameless stand-in: the Team Builder shows the
       side on the grass as she assembles it, and three of the four
       walking out as PLAYER is worse than three of them walking out */
    var ids = ((team && team.squad) || []).filter(Boolean);
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
    passErr: 0.24,          // radians of scatter on a pass at mid skill —
                            //   divided by the passer's accuracy, so the
                            //   good ones find a foot and the rest find
                            //   the area
    shotSpread: 0.80,       // how much of the goal mouth a shot can land
                            //   across at mid skill. Above 1 the ball can
                            //   drag past a post, which is where a weak
                            //   finisher ends up
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

    /* --- the match ---
       These three are the config's, not this file's: RULES in
       cup.config.js is the one place a match's length is written down,
       and it used to be written here as well, which meant editing it
       there did nothing at all. */
    halfSeconds: cfg("RULES.halfSeconds", 52),   // real seconds per half;
                            //   the clock on screen runs 0' to 45' across it
    kickoffWait: 1.5,
    goalCheer: 3.2,
    goldenGoal: cfg("RULES.goldenGoal", 60),     // sudden death if level

    /* --- how much a stat is worth ---------------------------------------
       A stat of 76 is the middle of the roster and moves nothing. Every
       point either side of it moves the thing it names by this much, so
       the whole table is a spread of about a quarter between Comet's legs
       and Boulder's.

       They are deliberately modest. A roster where the fast one is twice
       as fast as the slow one is a roster with three usable players in
       it; what makes stats worth having is that they change how a side
       FEELS to play, not which side wins. */
    statMid: 76,
    wSpeed: 0.0038,         // top pace, per point
    wPower: 0.0052,         // how hard a shot leaves the boot
    wTouch: 0.0030,         // how tightly the ball stays under the foot
    wAim: 0.0075,           // how straight a pass goes
    wTackle: 0.0042,        // how far a challenge reaches
    wShield: 0.0026,        // how hard it is to shove off the ball
    wGk: 0.0060,            // a keeper's reach and reactions

    /* --- the Heart meter and the Super Shot ------------------------- */
    superCost: cfg("RULES.superCost", 100),
    heartPass: cfg("RULES.heartPerPass", 9),
    heartTackle: cfg("RULES.heartPerTackle", 14),
    heartShot: cfg("RULES.heartPerShot", 11),
    heartConcede: cfg("RULES.heartPerConcede", 18),
    superWind: 0.85,        // seconds of wind-up before the ball is struck
    superFly: 1.05,         // and roughly how long the flight lasts
    superSpeed: 400,        // the base pace of one, before the kind
    superSaveMax: 0.22,     // the very best a keeper can do against one

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

     THIS CHAPTER WENT 3D AND CAME BACK.

     It was pixel first — flat top-down sprites on a painted pitch, the
     same as every other chapter here. That was thrown away for three.js
     because the reference is a cartoon played on a real pitch with a
     camera behind the play, and a top-down sprite cannot be that.

     The three.js version was right about the camera and wrong about
     everything the camera was pointing at. Pixel characters standing in
     a lit 3D world are lit by that world: the shading the compositor
     drew gets multiplied by a light it knows nothing about, the outline
     it drew one pixel wide gets resampled by the projection, and the two
     never agree. Either the art decides how it is lit or the renderer
     does, and on a site made entirely of pixel art the answer cannot be
     the renderer.

     So: a real perspective projection of the ground plane, done in a 2D
     canvas, in cup.pitch2d.js. The camera is still behind the play and
     still looking up the pitch. The grass, the markings, the goals and
     the stand are all in perspective. The CHARACTERS are drawn at 1:1
     and never scaled, which is the one compromise and the one arcade
     football has always made.

     WHAT SURVIVED BOTH CHANGES, AND WHY THAT MATTERS: all of it except
     the drawing. The ball physics, possession, the tackling, the four AI
     brains, the keeper, the match clock, the cup — none of that ever
     knew what it looked like. It works in (x, y) with a height, and it
     has now been rendered three different ways without one line of it
     being touched. A renderer is a renderer.

     A character is a look, not a model: a skin, a hair colour, a head
     shape and whatever that particular one brings with it. It is
     resolved out of ROSTER in cup.config.js and drawn by
     cup.sprites.js, which is the only place a character is defined.
     ======================================================================= */

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
  /* =======================================================================
     THE WORLD IS TWO-DIMENSIONAL NOW

     This chapter used to build a three.js scene: a sky dome, a lit
     ground plane with a baked turf texture on it, goal frames, stands
     wrapped in a crowd texture, corner flags, a key light with a shadow
     map that followed the ball, and a rig per player. All of it is gone.

     The character bible's Part 8 asks for the game to commit to 2D, and
     the reason is not nostalgia. A pixel character standing in a lit 3D
     world is lit by that world: the shading the compositor drew is
     multiplied by a light it knows nothing about, the outline it drew
     one pixel wide is resampled by the projection, and the two never
     agree. Either the art decides how it is lit or the renderer does.
     Here it is the art.

     What is left of the world in this file is what the simulation
     actually needs: which venue is on, and the numbers that describe the
     pitch. Everything visible is cup.pitch2d.js's job.
     ======================================================================= */
  var R2 = null;                 // the 2D renderer
  var rigs = [];                 // one small animation state per player
  var shadowsOn = true;          // kept: the settings screen still offers it
  var netBulge = [0, 0];         // how hard each net was hit, 1 down to 0
  var VEN = { cur: null };

  /* the pitch in the renderer's terms. It takes the simulation's own
     numbers and works its scale out from them, so nothing in here has to
     remember a conversion factor. */
  function worldSpec() {
    return {
      halfW: PITCH.w / 2, len: PITCH.h,
      goalHalf: PITCH.goalW / 2, goalDepth: PITCH.goalDepth,
      boxHalf: PITCH.boxW / 2, boxDepth: PITCH.boxH,
      sixHalf: PITCH.sixW / 2, sixDepth: PITCH.sixH,
      circleR: PITCH.circleR, spot: PITCH.spot,
    };
  }

  /* THE ONE PLACE THE TWO IDEAS MEET.

     The simulation thinks in (x across the pitch, y up it), with y0 at
     their goal line and y1 at hers. The camera stands behind HER goal
     and looks up the pitch, so on screen:

         world X  =  x - centre       across, left to right
         world Y  =  y1 - y           away from the camera

     Every draw call goes through these two. Nothing else in the file
     holds both ideas at once. */
  function wX(x) { return x - PITCH.cx; }
  function wY(y) { return PITCH.y1 - y; }

  /* kept so the chapter still loads the same way; there is nothing left
     to fetch, and the promise is what start() waits on */
  function loadThree() { return Promise.resolve(true); }

  function mkCanvas(w, h) {
    var c = document.createElement("canvas");
    c.width = w; c.height = h;
    return { c: c, x: c.getContext("2d") };
  }

  var CROWD_COLS = ["#e0607f", "#f5d020", "#5fb0d6", "#f2f2ef", "#b46fd0",
                    "#7fd6a0", "#f09050", "#c8d0e0"];

  function mixHex(a, b, t) {
    var ca = parseInt(String(a).slice(1), 16), cb = parseInt(String(b).slice(1), 16);
    var f = function (sft) {
      return Math.round((((ca >> sft) & 255) * (1 - t)) + (((cb >> sft) & 255) * t));
    };
    return "#" + ((1 << 24) + (f(16) << 16) + (f(8) << 8) + f(0)).toString(16).slice(1);
  }

  /* =======================================================================
     THE VENUE

     Five campuses, and each one is now a PALETTE rather than a lighting
     rig. There is no sun to colour and no fog to pull in; a venue is the
     grass it is played on, the stand around it and the sky behind it,
     and cup.pitch2d.js derives every other tone it draws from those.
     ======================================================================= */
  function venueById(id) {
    var list = cfg("VENUES", []);
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return list[0] || null;
  }

  function applyVenue(id) {
    var v = venueById(id);
    if (!v) return;
    VEN.cur = v;
    if (window.CupPitch2D) window.CupPitch2D.venue(v);
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
    move:    function () { tone("square", 480, 620, 0.05, 0.05); },
    back:    function () { tone("square", 620, 400, 0.07, 0.05); },

    /* ---- the Heart and the Super ------------------------------------
       Three sounds that have to be tellable from each other with the
       game shouting over them: a rising two-note ping when the meter
       fills, a long swelling drone under the wind-up, and a sweep down
       through an octave on the strike. */
    superReady: function () {
      [0, 0.10].forEach(function (d, i) {
        tone("triangle", [784, 1175][i], [784, 1175][i], 0.22, 0.10, d);
      });
      tone("sine", 392, 588, 0.34, 0.07, 0.04);
    },
    superCharge: function () {
      /* the room going quiet and then not: a slow rise under the
         wind-up, in two voices a fifth apart so it sits under a crowd */
      tone("sawtooth", 110, 330, 0.85, 0.08);
      tone("sine", 165, 495, 0.85, 0.06, 0.02);
      burst(0.85, 0.05, 240, 0.5);
    },
    superFire: function (kind) {
      /* the strike itself, coloured a little by which super it is:
         the heavy ones land lower, the placed ones land higher */
      var low = kind === "quake" || kind === "rocket" ? 0.6
              : kind === "finesse" || kind === "curl" ? 1.3 : 1;
      burst(0.20, 0.34, 1500 * low, 0.9);
      tone("square", 880 * low, 110 * low, 0.32, 0.20);
      tone("sine", 320 * low, 60 * low, 0.42, 0.16, 0.01);
      tone("triangle", 1760 * low, 440 * low, 0.24, 0.08, 0.02);
    },
    superSave: function () {
      burst(0.16, 0.30, 620, 0.8);
      tone("square", 300, 180, 0.28, 0.12);
    },
    /* the memory cards between rounds, and the trophy at the end */
    memory:  function () { tone("sine", 660, 660, 0.7, 0.07); tone("sine", 990, 990, 0.9, 0.04, 0.08); },
    trophy:  function () {
      [523, 659, 784, 1046, 1318].forEach(function (f, i) {
        tone("triangle", f, f, 0.55, 0.08, i * 0.11);
      });
      crowdSwell(0.22, 4.0);
    },
  };

  /* =======================================================================
     THE MENUS HAVE A TUNE NOW

     There was nothing under the menus at all: she opened the chapter
     into total silence and the first sound in it was a whistle. This is
     eight bars of warm nothing-in-particular — four chords, a soft bass
     under them and one note picked out on top — made the same way as
     everything else in here, which is to say out of oscillators, because
     there is not an audio file anywhere in this repository.

     It schedules one bar at a time, a bar ahead, rather than laying the
     whole loop down at once: a tab left in the background for ten
     minutes would otherwise come back with ten minutes of chords queued
     up inside it, all of which would then play.
     ======================================================================= */
  var musicOn = false, musicTimer = null, musicGain = null, musicBar = 0;
  /* Four chords that do not resolve, so the loop has no seam in it. A
     progression that lands home every eight bars announces itself every
     eight bars, and a menu she might sit on for two minutes reading a
     squad list should not keep arriving anywhere. */
  var MENU_BARS = [
    { root: 196.00, notes: [196.00, 293.66, 392.00, 587.33] },   // G
    { root: 220.00, notes: [220.00, 329.63, 440.00, 659.25] },   // Am
    { root: 164.81, notes: [164.81, 246.94, 329.63, 493.88] },   // Em
    { root: 174.61, notes: [174.61, 261.63, 349.23, 523.25] },   // F
  ];
  var BAR = 3.1;

  function menuMusic(on) {
    if (on) {
      if (musicOn || !soundOn || !audio()) return;
      musicOn = true;
      musicBar = 0;
      musicGain = AC.createGain();
      musicGain.gain.setValueAtTime(0.0001, AC.currentTime);
      musicGain.gain.exponentialRampToValueAtTime(0.05, AC.currentTime + 1.4);
      musicGain.connect(master);
      musicTick();
      return;
    }
    if (!musicOn) return;
    musicOn = false;
    if (musicTimer) { clearTimeout(musicTimer); musicTimer = null; }
    if (musicGain && AC) {
      /* taken down over a beat rather than cut, because a chord that
         stops dead is a bug however deliberate it was */
      var g = musicGain, t = AC.currentTime;
      try {
        g.gain.cancelScheduledValues(t);
        g.gain.setValueAtTime(Math.max(0.0001, g.gain.value), t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.7);
        setTimeout(function () { try { g.disconnect(); } catch (e) {} }, 1100);
      } catch (e) {}
    }
    musicGain = null;
  }

  function musicTick() {
    if (!musicOn || !AC || !musicGain) return;
    var bar = MENU_BARS[musicBar % MENU_BARS.length];
    var t0 = AC.currentTime + 0.05;

    var voice = function (f, at, dur, vol, type, glide) {
      var o = AC.createOscillator(), g = AC.createGain();
      o.type = type || "triangle";
      o.frequency.setValueAtTime(f, t0 + at);
      if (glide) o.frequency.linearRampToValueAtTime(glide, t0 + at + dur);
      g.gain.setValueAtTime(0.0001, t0 + at);
      g.gain.exponentialRampToValueAtTime(vol, t0 + at + Math.min(0.5, dur * 0.3));
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + at + dur);
      o.connect(g); g.connect(musicGain);
      o.start(t0 + at); o.stop(t0 + at + dur + 0.05);
    };

    /* the bass, held under the whole bar */
    voice(bar.root / 2, 0, BAR * 0.96, 0.30, "sine");
    /* the chord, the three of them coming in a fraction apart so it is
       strummed rather than stamped */
    bar.notes.slice(0, 3).forEach(function (f, i) {
      voice(f, 0.04 + i * 0.05, BAR * 0.88, 0.16, "triangle");
    });
    /* and one note on top, in a different place each bar */
    var top = bar.notes[3];
    voice(top, BAR * 0.34, BAR * 0.5, 0.09, "sine");
    if (musicBar % 2 === 1) voice(top * 1.5, BAR * 0.66, BAR * 0.3, 0.05, "sine");

    musicBar++;
    musicTimer = setTimeout(musicTick, BAR * 1000);
  }

  function wakeSound() {
    if (!playing || !soundOn) return;
    /* whichever of the two belongs to where she actually is */
    if (G && G.state === "menu") menuMusic(true);
    else startCrowd();
  }
  function sleepSound() { stopCrowd(); menuMusic(false); }

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

  /* WHICH SHAPE A SIDE IS PLAYING.

     The four numbers above used to be the only formation in the game.
     FORMATIONS in the config was read by the builder, printed on a
     button, saved with the squad — and then thrown away, because the
     thing that positions a player never looked at it. A side set to FLAT
     defended exactly as high as a side set to WIDE. It is read now, and
     it is read where it matters: `slot` is resolved once per match, per
     player, and the AI steers to it every frame. */
  function formationOf(teamId) {
    var t = teamById(teamId);
    var want = (t && t.formation) || "diamond";
    var list = cfg("FORMATIONS", []);
    for (var i = 0; i < list.length; i++) if (list[i].id === want) return list[i];
    return list[0] || { id: "diamond", name: "DIAMOND", slots: SLOTS };
  }
  /* A squad is four players picked by name, so two of them can easily
     share a role — she can put three strikers out if she wants, and the
     Team Builder lets her. Three players standing on the same coordinate
     is not a formation, so the second of a role mirrors across the pitch
     and any after that pull towards the middle. */
  function assignSlots(g) {
    [0, 1].forEach(function (t) {
      var f = formationOf(g.ids[t]);
      var seen = {};
      g.players.forEach(function (p) {
        if (p.team !== t) return;
        var s = (f.slots && (f.slots[p.role] || f.slots.mid)) || SLOTS[p.role] || SLOTS.mid;
        var n = seen[p.role] = (seen[p.role] || 0) + 1;
        var across = s.across;
        if (n === 2) across = 1 - s.across;
        else if (n > 2) across = 0.5 + (across - 0.5) * 0.35;
        p.slot = { up: s.up, across: across };
        p.formation = f.id;
      });
    });
  }
  function slotPos(pl) {
    var s = pl.slot || SLOTS[pl.role] || SLOTS.mid;
    var d = attackDir(pl.team);
    var own = ownGoalY(pl.team);
    return {
      x: PITCH.x0 + s.across * PITCH.w,
      y: own + d * s.up * PITCH.h,
    };
  }

  /* WHAT A STAT ACTUALLY DOES.

     For a long time the answer was: nothing. speed/power/skill/defence
     were read in exactly two places — the team-rating number on the card
     and the animated bars under it — and the match never looked at them.
     Ouissy at 95 skill and Boulder at 62 ran at the same pace, struck
     the ball at the same speed and passed with the same accuracy, which
     makes a fourteen-player roster a fourteen-colour palette.

     Each stat is turned into a multiplier once, when the player is made,
     and the multiplier is what the simulation reads. 76 is the middle of
     the roster and moves nothing either way.

       speed    top pace, running and chasing
       power    how hard a shot leaves the boot, how far out they will
                try one from, and how well they shield the ball
       skill    first touch (how tight the ball sits), passing accuracy,
                shooting accuracy, and how cheaply they can turn
       defence  how far a challenge reaches — and, for a keeper, his
                reach, his pace across the line and his hands */
  function statMuls(st) {
    st = st || FALLBACK_LOOK.stats;
    var m = TUNE.statMid;
    var f = function (v, w) { return 1 + ((v === undefined ? m : v) - m) * w; };
    return {
      speed:  f(st.speed, TUNE.wSpeed),
      power:  f(st.power, TUNE.wPower),
      aim:    f(st.skill, TUNE.wAim),
      agil:   f(st.skill, TUNE.wTouch),
      touch:  1 / f(st.skill, TUNE.wTouch),     // more skill, tighter touch
      shield: f(st.power, TUNE.wShield),
      tackle: f(st.defence, TUNE.wTackle),
      gk:     f(st.defence, TUNE.wGk),
    };
  }
  var FLAT_MUL = { speed: 1, power: 1, aim: 1, agil: 1, touch: 1,
                   shield: 1, tackle: 1, gk: 1 };

  function makePlayer(teamIdx, teamId, def, i) {
    return {
      team: teamIdx, teamId: teamId, def: def, name: def.name,
      face: def.face, role: def.role, gk: def.role === "gk", star: !!def.star,
      stats: def.stats || FALLBACK_LOOK.stats,
      mul: statMuls(def.stats),
      captain: !!def.captain,
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
      shake: 0, flash: 0, flashCol: null, scorer: "",
      stat: { shots: [0, 0], poss: [0, 0], passes: [0, 0], supers: [0, 0] },
      /* THE HEART. One meter per side, out of TUNE.superCost, filled by
         playing football rather than by waiting. `sup` is the shot in
         flight and everything the cinematic needs to draw it. */
      heart: [0, 0], superReady: [false, false], sup: null,
    };
    g.ids.forEach(function (id, t) {
      squadOf(teamById(id)).forEach(function (def, i) {
        g.players.push(makePlayer(t, id, def, i));
      });
    });
    assignSlots(g);
    heartSuper = null;             // whose super the meter is wearing
    /* the one dial the opponents get, through the difficulty she chose */
    g.skill = clamp((round.skill === undefined ? 0.5 : round.skill) * diff().skill, 0.15, 0.98);
    return g;
  }

  /* Whoever wears the armband, since the team's super is theirs. Falls
     back to the star, then to anybody outfield, so a side assembled by a
     harness or an old save still has one. */
  function captainOf(team) {
    var cap = null, star = null, any = null;
    G.players.forEach(function (p) {
      if (p.team !== team || p.gk) return;
      if (p.captain) cap = p;
      if (p.star && !star) star = p;
      if (!any) any = p;
    });
    return cap || star || any;
  }
  /* The super a side fires: the captain's, out of the roster. */
  function superOf(team) {
    var cap = captainOf(team);
    var look = cap && (ROSTER[cap.face] || ROSTER[cap.id]);
    var s = look && look.super;
    return s ? { name: s.name, colour: s.colour || "#ff5f8f", kind: s.kind || "rocket",
                 note: s.note || "", by: cap } : null;
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
      /* and how far in front is skill: a good first touch keeps it under
         the foot at pace, a poor one runs it two yards away and invites
         the tackle. This is the stat you can see without being told. */
      var push = TUNE.dribblePush * (0.20 + Math.min(0.42, osp * 0.0062)) *
                 (o.mul || FLAT_MUL).touch;
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
      /* a strong player holds it off for longer, which is what Atlas and
         Boulder are for */
      if (away > TUNE.keepReach * (o.mul || FLAT_MUL).shield) b.owner = null;
      return;
    }

    var best = null, bd = 1e9;
    G.players.forEach(function (p) {
      if (p.tackleT > 0 && !p.gk) return;
      var d = len(p.x - b.x, p.y - b.y);
      /* a loose ball is won on distance alone and nothing else, so that
         a scramble is never decided by a number she cannot see. The one
         exception is a keeper in his own area, whose hands are his stat. */
      var reach = p.gk && inBox(p, b)
        ? TUNE.gkReach * (p.mul || FLAT_MUL).gk * diff().gk
        : TUNE.dribbleReach;
      if (d < reach && d < bd) { bd = d; best = p; }
    });
    if (!best) return;
    /* a pass that found somebody. Worth something to the meter, and
       worth counting, because "passes completed" is the one statistic
       that says whether a side is playing football or chasing it. */
    if (b.lastTouch && b.lastTouch !== best && b.lastTouch.team === best.team) {
      G.stat.passes[best.team]++;
      addHeart(best.team, TUNE.heartPass);
    }
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
     11b. THE HEART, AND THE SUPER SHOT

     The one thing in this chapter that is not football.

     Every side has a meter. It fills by PLAYING — a pass that finds
     somebody, a tackle won, a shot had — and it fills a little when you
     go behind, because a game that punishes you twice for conceding is a
     game people put down. Fill it and the captain can hit one shot that
     is not a shot: their own, named in the config, in their own colour,
     with the clock slowed and the camera down on the grass for it.

     WHY IT IS BUILT THE WAY IT IS

       - It is a STATE, not an effect. `G.state` goes to "super" and the
         normal match loop stops dead, exactly the way it does for a
         goal. Nothing has to know to get out of the way.
       - It is the CAPTAIN'S, always. The armband is already drawn in the
         captain's super colour, the Team Builder already says whose
         super a side is carrying, and the match now honours both.
       - It can be SAVED, but only just. A keeper's defence buys him a
         small chance and nothing else does, so a super is not a cutscene
         that ends in a goal — it is a shot she has earned that will
         almost certainly go in, which is a different and better feeling.
       - The opponents get one too, from the semi-final onwards. Meeting
         one before she has fired one herself is how a mechanic becomes
         something done TO you.
     ======================================================================= */

  /* Every super flies differently. `kind` comes out of the roster, and
     each one is a handful of numbers rather than a special case in the
     physics: the ball is struck the same way and then told what sort of
     thing it is. `lift` is how much of it goes upwards, `bend` how hard
     it curls, `accel` whether it is still gathering pace after it has
     gone, and `shake` what it does to the camera. */
  /* A NOTE ON `bend`, BECAUSE THE FIRST SET OF NUMBERS WAS WRONG.

     These were originally written on the same scale as an ordinary
     shot's curve, where 74 is a heavy one. Measured, LANTERN — the super
     whose whole description is "it bends around whoever is in the way" —
     deviated 2.8 units from its own launch line over the entire flight,
     which is under two pixels on screen. The reason is that a super is
     over in about a quarter of a second: bend is an ACCELERATION, and
     acceleration needs time it does not have. At this speed the numbers
     have to be an order of magnitude larger to be seen at all, and the
     strike is now aimed to allow for them (see fireSuper). */
  var SUPER_KIND = {
    rocket:  { speed: 1.22, lift: 0.00, bend: 0,    accel: 1.30, shake: 0.55,
               trail: 9,  wind: 0.80, say: "straight, and it does not drop" },
    heart:   { speed: 1.02, lift: 0.22, bend: 380,  accel: 1.12, shake: 0.40,
               trail: 13, wind: 0.95, say: "it stops being a football" },
    flame:   { speed: 1.12, lift: 0.02, bend: 620,  accel: 1.18, shake: 0.45,
               trail: 12, wind: 0.80, say: "low, and it curls, and it scorches" },
    /* THE LOB, WHICH NEEDS TIME TO COME BACK DOWN.

       `lift` as a flat fraction does not work for this one and measuring
       it said so: SHOOTING STAR scored once in eight and was twenty-six
       units in the air at the moment it crossed the line — over the bar
       every time, because at four hundred pixels a second a shot from
       the edge of the box is over in a quarter of a second and there is
       no quarter-second lob in physics. So `lob` computes the launch
       from the distance instead, and the whole thing is slowed right
       down: a lob that arrives as fast as a rocket is not a lob, it is a
       rocket that went up a bit on the way. */
    arc:     { speed: 0.62, lift: 0.86, lob: true, bend: 120, accel: 1.02,
               shake: 0.30, trail: 11, wind: 0.90,
               say: "up, over, and down behind him" },
    curl:    { speed: 0.98, lift: 0.18, bend: 1000, accel: 1.06, shake: 0.30,
               trail: 10, wind: 0.95, say: "round everything in the way" },
    finesse: { speed: 0.94, lift: 0.10, bend: 160,  accel: 1.02, shake: 0.26,
               trail: 8,  wind: 1.05, say: "placed, not hit" },
    feint:   { speed: 0.70, lift: 0.04, bend: 500,  accel: 2.05, shake: 0.40,
               trail: 10, wind: 0.75, say: "it leaves as a pass" },
    quake:   { speed: 1.16, lift: 0.04, bend: 0,    accel: 1.22, shake: 1.00,
               trail: 10, wind: 1.00, say: "the whole ground feels it" },
    counter: { speed: 1.18, lift: 0.06, bend: 350,  accel: 1.24, shake: 0.50,
               trail: 9,  wind: 0.55, say: "won and hit in one movement" },
    surge:   { speed: 1.06, lift: 0.08, bend: 280,  accel: 1.16, shake: 0.42,
               trail: 14, wind: 1.00, say: "she arrives with it" },
    /* a keeper's. It is never a team super — the builder only lets an
       outfielder wear the armband — so it lives here as the defensive
       half of the same idea: see superSaveChance below. */
    wall:    { speed: 1.00, lift: 0.10, bend: 0,    accel: 1.00, shake: 0.40,
               trail: 8,  wind: 0.90, say: "nobody goes past him" },
  };
  function superKind(k) { return SUPER_KIND[k] || SUPER_KIND.rocket; }

  function addHeart(team, amount) {
    if (!G || G.state !== "play" || G.sup) return;   // not mid-cinematic
    addHeartAlways(team, amount);
  }
  /* the same, without the state gate: conceding fills the meter, and by
     the time a goal is known about the state has already left "play" */
  function addHeartAlways(team, amount) {
    if (!G || !amount) return;
    /* hers fills at the difficulty's rate; theirs never does, so Easy is
       more supers for her rather than more supers all round */
    var gain = team === 0 ? amount * diff().heart : amount;
    if (team === 1 && G.skill < cfg("RULES.aiSupersFrom", 0.62)) return;
    var was = G.heart[team];
    G.heart[team] = clamp(was + gain, 0, TUNE.superCost);
    if (G.heart[team] >= TUNE.superCost && was < TUNE.superCost) {
      G.superReady[team] = true;
      if (team === 0) {
        var s = superOf(0);
        banner((s ? s.name : "SUPER") + " READY", "super");
        SFX.superReady();
        crowdSwell(0.06, 1.6);
      }
    }
  }

  /* Can this side fire one at this instant? Charged, playing, nothing
     already in flight, and the ball at the captain's feet. */
  function superArmed(team) {
    if (!G || G.state !== "play" || G.sup) return false;
    if (G.heart[team] < TUNE.superCost) return false;
    var cap = captainOf(team);
    return !!(cap && G.ball.owner === cap);
  }
  /* And separately: is it charged at all? The button lights up on this,
     not on the above, so she can see it is ready while she is still
     running towards the ball. */
  function superCharged(team) {
    return !!G && G.heart[team] >= TUNE.superCost && !G.sup;
  }

  function aiWantsSuper(p, toGoal) {
    if (p.team === 0) return false;              // hers is hers to fire
    if (!superArmed(1) || captainOf(1) !== p) return false;
    /* and only from somewhere it makes sense, so it is a moment rather
       than a thing that happens on the halfway line */
    return toGoal < 150 && Math.abs(p.x - PITCH.cx) < 96;
  }

  /* THE UNLEASH.

     Three beats, and the state machine in step() runs them: WIND (the
     player pulls back, the world slows, the name comes up), STRIKE (the
     ball goes, the trail lights, the camera drops), FLIGHT (it travels
     until it is a goal or it is not). */
  function unleash(p) {
    var s = superOf(p.team);
    if (!s) return;
    var K = superKind(s.kind);
    var gy = goalY(p.team);
    /* aimed at a corner rather than at a random point: a super that
       goes down the middle is a super the keeper is already standing in
       front of */
    var side = p.x < PITCH.cx ? 1 : -1;
    if (Math.abs(p.x - PITCH.cx) < 12) side = Math.random() < 0.5 ? 1 : -1;
    var aimX = PITCH.cx + side * PITCH.goalW * 0.36;

    G.state = "super"; G.stateT = 0;
    /* The meter is NOT spent here. It is spent on contact, in
       fireSuper — so through the whole wind-up it is still sitting
       there full, which is the point of the wind-up. Emptying it on the
       button press means the thing she spent a half earning vanishes
       from the screen before the shot she earned it for has happened. */
    G.superReady[p.team] = false;
    G.stat.supers[p.team]++;
    G.sup = {
      by: p, team: p.team, def: s, kind: K, phase: "wind", t: 0,
      aimX: aimX, gy: gy, fired: false,
      saved: false,
      chance: G.saveOverride === undefined ? superSaveChance(p.team) : G.saveOverride,
      wind: TUNE.superWind * K.wind,
    };
    setAnim(p, "superWind", G.sup.wind + 0.5);
    setCamMode("super", p, 3.2);
    G.timeScale = 0.3;
    superBanner(s, p);
    SFX.superCharge();
    crowdSwell(0.10, 2.2);
  }

  /* HOW GOOD THE KEEPER FACING IT IS.

     Small, and deliberately: a super she has spent a half earning should
     go in about four times in five, so that it is a moment rather than a
     coin. The numbers here are the second set. The first read
     `(d - 62) / 160`, doubled for a keeper whose own super is a WALL —
     and measured, a third of all supers were being saved, which is not a
     reward, it is a tax.

     Two things were wrong. The scale was too generous, and BOTH keepers
     in the roster have a wall super, so the bonus that was meant to make
     one of them special was being handed to every keeper in the game and
     pinning all of them at the cap. The multiplier is kept, because it
     is honest about the intent and it will mean something the moment a
     keeper without one is added; the base is set so that having it still
     lands under the ceiling. */
  function superSaveChance(team) {
    var gk = null;
    G.players.forEach(function (p) { if (p.team !== team && p.gk) gk = p; });
    if (!gk) return 0;
    var look = ROSTER[gk.face] || ROSTER[gk.id];
    var wall = look && look.super && look.super.kind === "wall" ? 1.6 : 1;
    var d = (gk.stats && gk.stats.defence) || 75;
    return clamp(((d - 62) / 240) * wall * diff().gk, 0, TUNE.superSaveMax);
  }

  function superStep(dt) {
    var s = G.sup;
    if (!s) return;
    s.t += dt;
    var b = G.ball;

    if (s.phase === "wind") {
      /* everybody else stops and looks, which is the cheapest way to say
         that what is about to happen is not a normal shot */
      G.players.forEach(function (p) {
        if (p === s.by) { p.vx *= 0.82; p.vy *= 0.82; return; }
        p.vx *= 0.88; p.vy *= 0.88;
        if (!p.gk) setAnim(p, "watch", 0.4);
      });
      /* the ball stays at his feet through the wind-up */
      b.owner = s.by;
      if (s.t >= s.wind) {
        s.phase = "flight"; s.t = 0;
        fireSuper(s);
      }
      return;
    }

    /* in flight. The ball is a normal free body with three things done
       to it every tick: it gathers pace instead of losing it, it bends,
       and it leaves a trail. */
    var K = s.kind;
    var sp = len(b.vx, b.vy);
    if (sp > 1 && s.t < TUNE.superFly) {
      var g2 = Math.pow(K.accel, dt);
      b.vx *= g2; b.vy *= g2;
    }
    if (!s.saved) superSteer(b, s, dt);
    superTrail(b, s, dt);
    G.shake = Math.max(G.shake, K.shake * 0.5);

    /* the keeper's one chance, taken at the moment it reaches him */
    if (!s.resolved && !s.saved) {
      var gk = null;
      G.players.forEach(function (p) { if (p.team !== s.team && p.gk) gk = p; });
      if (gk && Math.abs(b.y - s.gy) < 22 && b.z < 9) {
        s.resolved = true;
        if (Math.random() < s.chance) {
          s.saved = true;
          gk.diveDir = (b.x < gk.x) ? 1 : -1;
          setAnim(gk, "dive", 0.8);
          b.vx = -b.vx * 0.35 + (Math.random() - 0.5) * 90;
          b.vy = -b.vy * 0.45;
          b.vz = 70;
          b.lock = 0.4;
          banner("SAVED!", "bad");
          SFX.superSave();
          crowdSwell(0.14, 2.0);
        }
      }
    }

    /* and it is over when it is a goal, when it has stopped, or when it
       has been in the air long enough that something has gone wrong */
    if (G.state !== "super") { endSuper(); return; }
    if (s.t > 3.4 || (s.t > 0.5 && len(b.vx, b.vy) < 16)) {
      endSuper();
      G.state = "play"; G.stateT = 0;
    }
  }

  /* THE CURL, STEERED.

     A super bends towards the corner it was called on rather than along
     a fixed arc, and `bend` is the most sideways acceleration this kind
     is allowed to use doing it. That one change fixes three things at
     once: a heavy curl always arrives (so LANTERN is a curl and not a
     throw-in), the shape still differs per kind (a big number swings
     late and hard, a small one barely leans), and none of it cares what
     the ball's pace is doing — which is what broke the open-loop version
     on the two kinds that change speed in flight.

     It stops steering once a keeper has got a hand to it, because a
     saved shot that still homes at the goal is not a save. */
  function superSteer(b, s, dt) {
    var K = s.kind;
    if (!K.bend) return;
    var sp = len(b.vx, b.vy);
    if (sp < 40) return;
    var wantA = Math.atan2(s.gy - b.y, s.aimX - b.x);
    var nowA = Math.atan2(b.vy, b.vx);
    var off = Math.atan2(Math.sin(wantA - nowA), Math.cos(wantA - nowA));
    var a = clamp(off * K.bend * 2.6, -K.bend, K.bend);
    /* Velocity turned a quarter turn: adding acceleration along this
       raises the heading angle, which is the direction `off` measures.
       Both components are read BEFORE either is written — updating vx
       first and then deriving vy from it is not a rotation, it is a
       shear, and it slowly winds the ball's speed up out of nothing. */
    var px = -b.vy / sp, py = b.vx / sp;
    b.vx += px * a * dt;
    b.vy += py * a * dt;
  }

  function fireSuper(s) {
    var p = s.by, b = G.ball, K = s.kind;
    var mul = (p.mul || FLAT_MUL).power;
    var speed = TUNE.superSpeed * K.speed * mul;
    var side = s.aimX > PITCH.cx ? 1 : -1;

    /* WHERE IT IS ACTUALLY STRUCK.

       Not at the corner. A shot aimed at the corner that then bends
       further is a shot that goes out for a throw-in, so a bending super
       leaves the boot pointing at the middle of the goal — or, for the
       heaviest of them, slightly the WRONG side of it — and the curl
       brings it back. Which is, as it happens, exactly what bending a
       ball round a wall looks like from behind the goal.

       How far back it is aimed is simply how bendy this kind is: a
       rocket is launched straight at the corner because a rocket has no
       curl to allow for. */
    var bendFrac = Math.min(1, K.bend / 1000);
    var launchX = s.aimX - side * PITCH.goalW * 0.48 * bendFrac;
    var ang = Math.atan2(s.gy - p.y, launchX - p.x);

    b.owner = null;
    b.lastTouch = p;
    b.lock = TUNE.controlLock;
    b.vx = Math.cos(ang) * speed;
    b.vy = Math.sin(ang) * speed;
    /* A LOB IS AIMED AT A TIME, NOT AT AN ANGLE.

       Everything else takes its height straight off `lift`. A lob has to
       be under the bar at the moment it arrives, which means solving for
       it: over a flight of T seconds, leaving at vz and falling at g, it
       is back down to height h when vz = (h + ½gT²) / T. Aim it at three
       units, which is under the four-and-a-bit the bar sits at, and it
       drops in off the underside of it. */
    if (K.lob) {
      var away2 = Math.abs(s.gy - p.y);
      var T = clamp(away2 / Math.max(60, speed), 0.25, 1.1);
      b.vz = clamp((3 + 0.5 * TUNE.gravity * T * T) / T, 50, 240);
    } else {
      b.vz = K.lift * 150;
    }
    /* The ordinary shot curve is switched OFF for a super. It is
       open-loop — a fixed sideways acceleration that decays — and open
       loop cannot work here: the kinds change their own pace mid-flight
       (a FEINT more than doubles it, an arc loses most of it), so the
       same number produced a shot that curled a yard and one that curled
       a hundred and sixty. It is steered instead, in superSteer. */
    b.curve = 0;
    b.struck = 1;
    b.x = p.x + Math.cos(ang) * 6;
    b.y = p.y + Math.sin(ang) * 6;
    b.superK = s;
    s.fired = true;
    G.heart[p.team] = 0;                 // spent on contact, not on press
    setAnim(p, "superKick", 0.6);
    G.stat.shots[p.team]++;
    G.shake = 1;
    G.flash = 1;
    G.flashCol = s.def.colour;
    setCamMode("superFly", p, 2.6);
    SFX.superFire(s.def.kind);
    crowdSwell(0.18, 2.4);
    superGlow(true, s.def.colour);
  }

  function endSuper() {
    if (!G) return;
    superGlow(false);
    if (G.ball) G.ball.superK = null;
    G.sup = null;
    G.timeScale = 1;
    clearBanner();
    if (G.state === "super") setCamMode("play");
  }

  /* =======================================================================
     12. A GOAL
     ======================================================================= */
  function scored(team) {
    if (G.state !== "play" && G.state !== "super") return;
    /* a super that goes in is still a goal, and everything below has to
       run — but the cinematic has to be taken down first or the camera
       stays on the grass through the celebration */
    var wasSuper = G.sup && G.sup.fired && G.sup.team === team ? G.sup : null;
    if (G.sup) endSuper();
    G.score[team]++;
    G.state = "goal"; G.stateT = 0;
    var by = G.ball.lastTouch && G.ball.lastTouch.team === team ? G.ball.lastTouch : null;
    G.scorer = by ? by.name : "";
    G.scoredBy = team;
    G.scorerP = by || nearestTo(G.ball, team, true);
    G.superGoal = wasSuper ? wasSuper.def : null;
    /* going behind hands the other side something back, which is the one
       rule in here that exists purely so that losing stays playable */
    addHeartAlways(1 - team, TUNE.heartConcede);
    G.celebration = G.scorerP && G.scorerP.face === "ouissy"
      ? "heart"                                  // hers is her own
      : CELEBRATIONS[Math.floor(Math.random() * CELEBRATIONS.length)];
    if (G.scorerP) setAnim(G.scorerP, G.celebration, TUNE.goalCheer);
    /* the moment stretches, then lets go. Half a second of slow motion
       is the difference between a number changing and something
       happening. */
    G.timeScale = 0.35;
    setCamMode("goal", G.scorerP, TUNE.goalCheer);
    confettiBurst(G.scorerP || G.ball, team === 0 ? 150 : 40,
                  G.superGoal ? G.superGoal.colour : null);
    G.kickoffTeam = 1 - team;
    G.flash = 1; G.shake = 1;
    G.ball.vx = G.ball.vy = G.ball.vz = 0; G.ball.owner = null;
    /* WHICH NET JUST BULGED. The renderer's two goals are the near one
       (her line, y1) and the far one (theirs, y0), and which of those
       the ball went into depends on which way round the sides are
       playing — so it is worked out from the goal she is defending
       rather than hard-coded, and it survives the half-time swap. */
    var scoredAtY0 = (ownGoalY(0) === PITCH.y0) ? (team === 0) : (team !== 0);
    netBulge[scoredAtY0 ? 1 : 0] = 1;
    SFX.net();
    if (team === 0) SFX.goal(); else SFX.concede();
    /* a super that goes in is announced by its own name, not by the
       scorer's — it is the thing she just spent a half earning */
    if (G.superGoal) {
      banner(G.superGoal.name + "!", team === 0 ? "super" : "bad");
      G.flash = 1; G.flashCol = G.superGoal.colour;
      G.shake = 1.4;
    } else {
      banner(team === 0
        ? (G.scorer ? G.scorer + "!" : "GOAL!")
        : "THEY SCORE", team === 0 ? "good" : "bad");
    }
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
    var mul = p.mul || FLAT_MUL;
    /* the legs, out of the roster. Comet covers about fifteen per cent
       more ground a second than Boulder does, which is the difference
       between getting to a through ball and watching it. */
    var top = base * (speedMul || 1) * mul.speed;
    /* TURNING COSTS SOMETHING. Steering used to be free: full speed in
       one direction became full speed in the opposite one inside a
       frame, and what that feels like is a cursor rather than a person.
       A hard turn now sheds pace, which is also what makes a defender
       committing to a tackle a mistake she can punish. */
    var sp0 = len(p.vx, p.vy);
    if (sp0 > 12) {
      var dot = (p.vx * ux + p.vy * uy) / sp0;
      if (dot < 0.5) {
        /* and skill is what buys the turn back: a good one sheds less
           pace changing direction, which is most of what "he can turn"
           means when anybody says it about a footballer */
        var bite = (0.5 - dot) * (TUNE.turnCost / mul.agil) * dt;
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
    /* her seven teammates play at a fixed, decent level; the opposition
       plays at the round's, scaled by the difficulty she chose */
    var skill = p.team === 0 ? 0.55 : G.skill;
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
      /* a tackle, when it is worth one — and a defender goes in from
         further out and comes away with it more often, which is what
         the defence stat is */
      var pm = p.mul || FLAT_MUL;
      if (b.owner && b.owner.team !== p.team && p.coolT <= 0 &&
          dist(p, b) < TUNE.tackleReach * pm.tackle + 3 &&
          Math.random() < 0.6 * skill * pm.tackle) {
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
    var mul = p.mul || FLAT_MUL;
    var gy = goalY(p.team), d = attackDir(p.team);
    var toGoal = Math.abs(p.y - gy);
    var press = nearestOpponent(p);
    var pressed = press && dist(press, p) < 22;

    /* the super, if this side has one charged and this is the player to
       take it. Checked before the ordinary shot, because a captain in
       range with a full meter should never settle for a tap-in */
    if (aiWantsSuper(p, toGoal)) return unleash(p);

    /* shoot — and how far out they will try one from is power. Atlas
       has a go from thirty yards; Lumi carries it another ten first. */
    if (toGoal < (95 + skill * 45) * mul.power && Math.abs(p.x - PITCH.cx) < 70) {
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
    /* his legs are his defence stat and the difficulty setting, which is
       the honest way to make a keeper harder: a sharper one gets across
       his goal faster, not one who saves things he never reached */
    moveTo(p, tx, ty, dt,
           (TUNE.gkSpeed / TUNE.freeSpeed) * (p.mul || FLAT_MUL).gk * diff().gk);
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
    var mul = p.mul || FLAT_MUL;
    var lead = TUNE.passLead;
    var tx = mate.x + mate.vx * lead, ty = mate.y + mate.vy * lead;
    var ang = Math.atan2(ty - p.y, tx - p.x);
    /* and it does not go exactly where it was aimed. A pass from Lumi
       arrives at a foot; a pass from Boulder arrives in the general
       area. Without this, skill 93 and skill 62 pass identically. */
    ang += (Math.random() - 0.5) * (TUNE.passErr / mul.aim);
    var far = len(tx - p.x, ty - p.y);
    var sp = clamp(far * 1.9, 95, TUNE.passSpeed * 1.35);
    kickBall(p, ang, soft ? sp * 0.8 : sp, 0);
    setAnim(p, "kick", 0.34);
    SFX.pass();
  }

  function shoot(p, power) {
    var mul = p.mul || FLAT_MUL;
    var gy = goalY(p.team);
    /* Aimed at a point inside the mouth rather than at the middle, which
       is what stops every shot in the game being the same shot — and how
       WIDE that scatter is, is skill. At the top of the roster it is
       comfortably inside the posts; at the bottom of it a shot can drag
       past one, which is the only honest way to make accuracy a stat. */
    var spread = TUNE.shotSpread / mul.aim;
    var aimX = PITCH.cx + (Math.random() - 0.5) * PITCH.goalW * spread;
    var ang = Math.atan2(gy - p.y, aimX - p.x);
    var sp = (TUNE.shotMin + (TUNE.shotMax - TUNE.shotMin) * power) * mul.power;
    kickBall(p, ang, sp, power * TUNE.shotLift * 46, p);
    setAnim(p, "kick", 0.34);
    G.stat.shots[p.team]++;
    addHeart(p.team, TUNE.heartShot);
    SFX.shot();
    crowdSwell(0.03, 0.8);
  }

  function startTackle(p) {
    p.tackleT = TUNE.tackleTime;
    setAnim(p, "slide", TUNE.tackleTime + 0.12);
    var b = G.ball;
    var reach = TUNE.tackleReach * (p.mul || FLAT_MUL).tackle;
    if (dist(p, b) < reach && b.owner && b.owner.team !== p.team) {
      var ang = Math.atan2(b.y - p.y, b.x - p.x);
      b.owner = null; b.lastTouch = p; b.lock = TUNE.controlLock;
      b.vx = Math.cos(ang) * TUNE.tacklePush;
      b.vy = Math.sin(ang) * TUNE.tacklePush;
      addHeart(p.team, TUNE.heartTackle);
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

  /* THE SECOND BUTTON.

     The super gets one of its own rather than being another meaning
     hung off the first. The first button already means four things
     depending on context, and a fifth that only exists sometimes is how
     you end up firing the thing she saved for two minutes by accident
     while trying to pass.

     It only appears when the meter is full, and it only fires when the
     captain actually has the ball — which the label says, so a tap on a
     lit button that does nothing has already explained itself. */
  function pressSuper() {
    if (!G || G.state !== "play") { skipState(); return; }
    if (!superArmed(0)) {
      /* charged but not at her feet: say so rather than doing nothing */
      if (superCharged(0)) {
        var cap = captainOf(0);
        banner("GET IT TO " + (cap ? cap.name : "YOUR CAPTAIN"), "super");
      }
      return;
    }
    unleash(captainOf(0));
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
        G.superGoal = null;
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

    /* THE SUPER runs its own loop. The clock does not advance, the
       teammates do not think, and nothing can take the ball — it is the
       one moment in the match where the game is watching itself. */
    if (G.state === "super") {
      superStep(dt);
      G.players.forEach(function (p) { playerStep(p, dt); });
      if (G.sup && G.sup.phase === "flight") { ballStep(dt); }
      cameraStep(dt);
      return;
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
    endSuper();
    /* a meter she filled in the first half is hers to take into the
       second, unless the config says otherwise. Wiping it at the break
       punishes her for the clock rather than for anything she did. */
    if (!cfg("RULES.superKeepOnHalf", true)) {
      G.heart = [0, 0]; G.superReady = [false, false];
    }
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
  /* THE POSE MACHINE IS THE SPRITE SHEET NOW.

     Twenty poses used to live here as bone rotations — an arm lifted to
     2.55 radians, a knee bent, a spine leaned — applied to the meshes of
     a rig. There are no meshes and no bones. What a player is doing is
     an animation NAME, `setAnim` sets it, `spriteAnim` reads it, and how
     that looks is drawn once in cup.sprites.js and shared by every
     character rather than re-derived per limb per frame.

     `setAnim`, `animStep` and `baseAnim` above are what survived, and
     they are the useful half: which state, how long for, and what to
     fall back to. */

  function syncBall() {}

  /* =======================================================================
     THE CAMERA

     In three dimensions this had a position, a target, a height and a
     distance, and every shot was a little flight path through all four.
     In two it has exactly two numbers — where on the pitch it is looking
     — and one more that is not really a camera setting at all.

     THAT THIRD NUMBER IS THE INTERESTING ONE. A celebration wants to
     come in close. Scaling a pixel scene by 1.6 is precisely the thing
     this whole rebuild exists to stop, so it does not scale: it halves
     the virtual screen and blows it up twice as far. Same world, half as
     much of it, at twice the size, every pixel still square. The move
     between the two is a cut rather than a glide, which is what a
     broadcast does anyway and what a game from this era could do.

     Everything the 3D version could say, this can still say: follow the
     play, cut in on a scorer, hold still while a shot flies away from
     you, stand off for a menu. What it cannot say is "orbit", and an
     orbit was never worth a renderer.
     ======================================================================= */
  var CAM = {
    lead: 0.42,         // how far ahead of the ball it looks, in seconds
    ease: 3.2,
    /* HOW FAR BEHIND THE ACTION THE CAMERA'S NEAR EDGE SITS, in the
       simulation's own units. The whole frame hangs off this one
       number, and the first guess of 26 put the player being driven at
       230 pixels down a 270-pixel screen — standing on the HUD, with
       everything behind her off the bottom of the frame. Eighty-two
       puts her two thirds of the way down, which is where a camera
       following somebody actually holds them. */
    trail: 82,
  };
  /* The portrait. `ndc` is where across the frame the subject stands:
     0 is dead centre, +1 is the right edge. */
  var CAMHERO = { ndc: 0.30 };
  function shadowSpan() {}          // there is no shadow map any more

  var camNow = { x: 0, y: 0 };
  var camMode = { kind: "play", t: 0, at: null, hold: 0 };

  /* which way round she is playing. Kept because the match still asks. */
  function camSide() { return attackDir(0) > 0 ? 1 : -1; }

  /* where the camera wants to be: between the ball, the player being
     driven, and where the ball is about to be */
  function wantFraming() {
    var b = G.ball;
    var pts = [{ x: b.x, y: b.y }];
    if (G.controlled) pts.push({ x: G.controlled.x, y: G.controlled.y });
    pts.push({ x: b.x + b.vx * CAM.lead, y: b.y + b.vy * CAM.lead });
    var minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9;
    pts.forEach(function (p) {
      minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
    });
    return { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };
  }

  /* what the camera is doing this second */
  function setCamMode(kind, at, hold) {
    camMode.kind = kind; camMode.t = 0; camMode.at = at || null;
    camMode.hold = hold || 0;
  }

  function camTo(x, y, k, zoom) {
    camNow.x += (x - camNow.x) * k;
    camNow.y += (y - camNow.y) * k;
    if (!R2) return;
    R2.zoomTo(zoom || 1);
    /* the renderer's near edge is the camera's y, and the thing being
       watched should sit above it rather than on it */
    R2.cam.x = wX(camNow.x);
    R2.cam.y = wY(camNow.y) - CAM.trail;
  }

  function placeCamera(dt, snap) {
    if (!R2 || !G) return;
    camMode.t += dt;
    var k = snap ? 1 : Math.min(1, CAM.ease * dt);

    /* THE CELEBRATION. Cut in to twice the size, on the scorer, and let
       them run — the push-in IS the celebration. */
    if (camMode.kind === "goal" && camMode.at) {
      camTo(camMode.at.x, camMode.at.y, snap ? 1 : Math.min(1, 4 * dt), 2);
      return;
    }

    /* THE SUPER, IN TWO SHOTS.

       A wind-up, close on the striker while they pull back; and then a
       flight shot that does NOT follow the ball. It holds where the ball
       was struck from and lets it go away down the pitch, which is the
       shot that makes a hundred units look like sixty yards. A camera
       that chases a fast ball keeps it the same size and the speed
       disappears. */
    if (camMode.kind === "super" && camMode.at) {
      camTo(camMode.at.x, camMode.at.y, snap ? 1 : Math.min(1, 5 * dt), 2);
      return;
    }
    if (camMode.kind === "superFly") {
      camTo(camNow.x, camNow.y, 1, 1);
      return;
    }

    /* THE PORTRAIT. One character, twice the size, standing off to one
       side of the frame so the panel has the other side. `ndc` is a
       fraction of the half-width, and the half-width in world units is
       whatever the lens gives at this depth — so this is arithmetic and
       not taste. */
    if (camMode.kind === "hero" && camMode.at) {
      var hp = camMode.at;
      camTo(hp.x, hp.y + 4, snap ? 1 : Math.min(1, 3.2 * dt), 3);
      /* WHERE ACROSS THE FRAME THEY STAND is a screen measurement, not
         a world one, so it is taken from the lens at their own depth
         rather than from a fraction of the pitch. Guessed as a fraction
         of the pitch width it put the captain a whole frame off the
         left-hand edge, because a third of a pitch is nothing like a
         third of a frame once the camera has cut in. */
      var pr = R2.project(wX(hp.x), wY(hp.y));
      R2.cam.x -= CAMHERO.ndc * (R2.vw / 2) / pr.k;
      /* a slow drift, so a still screen is never still */
      R2.cam.x += Math.sin(camMode.t * 0.42) * 0.8;
      return;
    }

    /* THE MENU SHOT. Stood off, drifting, with the line-up in the right
       of the frame and the card in the left. */
    if (camMode.kind === "menu") {
      camTo(PITCH.cx, PITCH.cy + 10 + Math.sin(camMode.t * 0.17) * 4,
            snap ? 1 : Math.min(1, 1.6 * dt), 1);
      var mp = R2.project(0, wY(PITCH.cy));
      R2.cam.x -= 0.34 * (R2.vw / 2) / mp.k + Math.sin(camMode.t * 0.23) * 1.5;
      return;
    }

    /* PLAY. Follow the ball, ease, and never let the camera past the
       ends of the pitch — behind the goal line there is nothing to see
       but the back of a stand. */
    var want = wantFraming();
    var y = clamp(want.y, PITCH.y0 + 30, PITCH.y1 + 6);
    var x = clamp(want.x, PITCH.cx - PITCH.w * 0.22, PITCH.cx + PITCH.w * 0.22);
    camTo(x, y, k, 1);
  }

  /* =======================================================================
     THE FRAME

     Background, then everything that stands on the grass in one
     depth-sorted pass, then the vignette. The sort is the whole of depth
     in a 2D scene: get it wrong and a defender stands in front of the
     striker they are behind.
     ======================================================================= */
  function draw(dt) {
    if (!R2 || !G) return;
    dt = dt || 0;
    for (var i = 0; i < G.players.length; i++) {
      if (rigs[i]) syncBillboard(G.players[i], rigs[i], dt);
    }
    /* the net settling back after it has been hit */
    netBulge[0] = Math.max(0, netBulge[0] - dt * 2.4);
    netBulge[1] = Math.max(0, netBulge[1] - dt * 2.4);

    placeCamera(dt, false);
    R2.tick(dt);
    R2.begin(dt, netBulge);

    for (i = 0; i < G.players.length; i++) {
      var p = G.players[i], r = rigs[i];
      if (!r) continue;
      R2.player({
        at: r.atlas, anim: r.anim, face: r.face, frame: r.frame,
        flip: r.flip, air: r.air,
        wx: wX(p.x), wy: wY(p.y),
        shadow: 3.2 * ((p.build && p.build.w) || 1),
        ring: (p === G.controlled && G.state !== "goal") ? UI.t * 0.5 : null,
      });
    }

    var b = G.ball;
    superTrailDraw();
    /* the super makes it bigger than a football, which is the whole
       point of it: a ball you can see coming from the halfway line */
    R2.ball(wX(b.x), wY(b.y), b.z, b.superK ? superBallTint() : null,
            BALL_R * (b.superK ? 2.1 + Math.sin(G.stateT * 26) * 0.16 : 1));
    R2.confettiStep(dt);
    R2.flush();
    R2.finish();
    R2.present();
  }

  function crowdSway() {}

  /* =======================================================================
     CONFETTI

     It falls out of the stand when somebody scores, in world
     coordinates, so it goes past the players rather than over the top of
     everything. The renderer owns the particles; this is the two calls
     the match makes.
     ======================================================================= */
  function buildConfetti() {}
  function hideConfetti() { if (R2) R2.conf.length = 0; }
  /* `colour` overrides the stand's colours for the particles this burst
     uses, so a super goal throws its own colour into the air rather than
     the same crowd confetti every other goal gets. */
  function confettiBurst(at, n, colour) {
    if (!R2) return;
    var cols = colour
      ? [colour, window.CupPitch2D.mix(colour, "#ffffff", 0.35),
         window.CupPitch2D.mix(colour, "#000000", 0.25)]
      : CROWD_COLS;
    R2.burst(wX(at.x), wY(at.y), n, cols);
  }
  function confettiStep() {}

  /* =======================================================================
     THE SUPER'S TRAIL

     Beads of the shot's own colour, laid down where the ball has been
     and going dark behind it. They are drawn before the ball and after
     the grass, which is the only ordering that reads as a trail rather
     than as a string of beads lying on the pitch.
     ======================================================================= */
  var trailParts = [];
  var TRAIL_N = 90;
  function buildTrail() {}
  function hideTrail() { trailParts.length = 0; }
  function superTrail(b, s, dt) {
    if (!s) return;
    trailParts.push({ x: b.x, y: b.y, z: b.z, life: 0.5, col: s.colour || "#ff5f8f" });
    if (trailParts.length > TRAIL_N) trailParts.shift();
  }
  function trailStep(dt) {
    for (var i = trailParts.length - 1; i >= 0; i--) {
      trailParts[i].life -= dt;
      if (trailParts[i].life <= 0) trailParts.splice(i, 1);
    }
  }
  function superTrailDraw() {
    if (!R2 || !trailParts.length) return;
    var dark = window.CupPitch2D.mix;
    trailParts.forEach(function (t) {
      var f = Math.max(0, t.life / 0.5);
      R2.add(wY(t.y), function () {
        R2.bead(wX(t.x), wY(t.y), t.z,
                Math.max(1, Math.round(1 + f * 2.2)),
                dark(t.col, "#1a1020", 1 - f));
      });
    });
  }

  /* the ball's own colour while a super is on it, and the flash that
     goes with the strike */
  var superTint = null;
  function buildHeartBall() {}
  function superGlow(on, colour) {
    superTint = on ? (colour || "#ff5f8f") : null;
  }
  function superBallTint() { return superTint; }

  /* =======================================================================
     THE RING UNDER THE PLAYER SHE IS DRIVING

     It used to be a painted texture on a ring of geometry that had to be
     rebuilt whenever its colour changed. It is now a projected annulus
     with two rotating gaps, drawn straight onto the pitch with the
     player it belongs to, which is also what fixed it sliding out from
     under them on a fast break: it is one of that player's draw calls
     rather than a separate object chasing their position.
     ======================================================================= */
  function ringCanvas() { return null; }
  function paintRing() {}
  function buildMarkers() {}
  function syncRing() {}

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
  /* =======================================================================
     THE TROPHY

     The thing the chapter is named after, and it did not exist in any
     form: the cup she was playing for was a word on a card. It is drawn
     rather than modelled because it is only ever wanted flat, on a menu
     or on the ending, at a size where a mesh would cost a camera and a
     light for no gain.

     Gold is three tones and a highlight, never one flat yellow: a single
     colour reads as a yellow shape, and the thing that makes metal look
     like metal is that one side of it is lit and the other is not.
     ======================================================================= */
  var GOLD = { lo: "#8a6218", mid: "#d8a32c", hi: "#ffe27a", lip: "#fff6cf" };
  function trophyCanvas(w, h) {
    var f = mkCanvas(w, h);
    var x = f.x, cx = w / 2, u = Math.min(w, h) / 2;
    var ink = "rgba(28,18,4,.55)";

    var grad = x.createLinearGradient(cx - u * 0.7, 0, cx + u * 0.7, 0);
    grad.addColorStop(0, GOLD.lo);
    grad.addColorStop(0.32, GOLD.mid);
    grad.addColorStop(0.52, GOLD.hi);
    grad.addColorStop(0.74, GOLD.mid);
    grad.addColorStop(1, GOLD.lo);

    x.lineJoin = "round"; x.lineCap = "round";
    x.lineWidth = Math.max(1, u * 0.09);
    x.strokeStyle = ink;

    /* the base: two steps, because one is a block and two is a plinth */
    x.fillStyle = grad;
    x.beginPath(); x.rect(cx - u * 0.62, h * 0.86, u * 1.24, h * 0.10); x.fill(); x.stroke();
    x.beginPath(); x.rect(cx - u * 0.44, h * 0.76, u * 0.88, h * 0.11); x.fill(); x.stroke();
    /* the stem */
    x.beginPath(); x.rect(cx - u * 0.13, h * 0.58, u * 0.26, h * 0.19); x.fill(); x.stroke();

    /* the bowl */
    x.beginPath();
    x.moveTo(cx - u * 0.60, h * 0.20);
    x.lineTo(cx + u * 0.60, h * 0.20);
    x.quadraticCurveTo(cx + u * 0.56, h * 0.55, cx, h * 0.60);
    x.quadraticCurveTo(cx - u * 0.56, h * 0.55, cx - u * 0.60, h * 0.20);
    x.closePath(); x.fill(); x.stroke();

    /* the handles, one each side */
    [-1, 1].forEach(function (s) {
      x.beginPath();
      x.moveTo(cx + s * u * 0.58, h * 0.24);
      x.quadraticCurveTo(cx + s * u * 1.02, h * 0.28, cx + s * u * 0.92, h * 0.40);
      x.quadraticCurveTo(cx + s * u * 0.84, h * 0.50, cx + s * u * 0.50, h * 0.47);
      x.lineWidth = Math.max(2, u * 0.16);
      x.strokeStyle = GOLD.mid; x.stroke();
      x.lineWidth = Math.max(1, u * 0.07);
      x.strokeStyle = ink; x.stroke();
    });

    /* the lip, and the shine down one side of the bowl */
    x.fillStyle = GOLD.lip;
    x.beginPath(); x.rect(cx - u * 0.66, h * 0.16, u * 1.32, h * 0.06); x.fill();
    x.strokeStyle = ink; x.lineWidth = Math.max(1, u * 0.08); x.stroke();
    x.fillStyle = "rgba(255,255,255,.34)";
    x.beginPath();
    x.moveTo(cx - u * 0.40, h * 0.24);
    x.lineTo(cx - u * 0.24, h * 0.24);
    x.quadraticCurveTo(cx - u * 0.20, h * 0.44, cx - u * 0.30, h * 0.52);
    x.quadraticCurveTo(cx - u * 0.40, h * 0.42, cx - u * 0.40, h * 0.24);
    x.closePath(); x.fill();

    /* a heart on the front of it, because of whose cup it is */
    var s2 = u * 0.24;
    x.fillStyle = "#e0476f";
    x.beginPath();
    x.arc(cx - s2 * 0.46, h * 0.33, s2 * 0.5, 0, Math.PI * 2);
    x.arc(cx + s2 * 0.46, h * 0.33, s2 * 0.5, 0, Math.PI * 2);
    x.fill();
    x.beginPath();
    x.moveTo(cx - s2 * 0.95, h * 0.345);
    x.lineTo(cx, h * 0.33 + s2 * 1.05);
    x.lineTo(cx + s2 * 0.95, h * 0.345);
    x.closePath(); x.fill();
    return f.c;
  }
  /* the canvases go in after the card is in the DOM, same as the flags */
  function paintTrophies() {
    var el = EL["cup-overlay"];
    if (!el) return;
    Array.prototype.forEach.call(el.querySelectorAll("[data-cup]"), function (n) {
      n.innerHTML = "";
      n.appendChild(trophyCanvas(84, 112));
    });
  }

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
     "cup-shot-h", "cup-shot-a", "cup-keys", "cup-stats",
     "cup-heart", "cup-heart-f", "cup-heart-n", "cup-heart-a",
     "cup-sup-btn", "cup-sup-lab", "cup-super-card", "cup-flash", "cup-ui",
     "cup-ui-a11y"]
      .forEach(function (id) { EL[id] = $(id); });
    stage = EL["cup-stage"];
    cvs = EL["cup-canvas"];
    uiCvs = EL["cup-ui"];
    if (uiCvs) { UIX = uiCvs.getContext("2d"); UIX.imageSmoothingEnabled = false; }
    wireUI();
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
  /* =======================================================================
     THE SCREEN

     One canvas with a 2D context on it. cup.pitch2d.js renders into a
     small virtual screen and blows that up by a whole number of pixels,
     so all this has to do is make sure the canvas is a sensible size and
     the UI's backing store matches it exactly.
     ======================================================================= */
  function sizeRenderer() {
    if (!cvs || !stage) return;
    var r = stage.getBoundingClientRect();
    var w = Math.max(2, Math.round(r.width)), h = Math.max(2, Math.round(r.height));
    /* The canvas is the size of the element, in CSS pixels, and never
       larger. The renderer draws 480x270 into it at a whole-number
       scale; asking for a device-pixel-ratio backing store would just
       mean multiplying that scale by two and blowing the same pixels up
       further, which is the same picture for four times the fill. */
    if (cvs.width !== w || cvs.height !== h) { cvs.width = w; cvs.height = h; }
    if (cvs) cvs.classList.add("px");
    uiSize();
  }

  function buildRenderer() {
    R2 = window.CupPitch2D.create(cvs, worldSpec());
    applyVenue(MENU_VENUE);
    sizeRenderer();
    window.addEventListener("resize", sizeRenderer);
  }

  /* =======================================================================
     THE PLAYERS ARE SPRITES, AND NOTHING ELSE

     They were figures built out of capsules and spheres, then pixel
     sprites on camera-facing billboards inside the 3D scene, and now
     they are simply drawn. A player costs one atlas lookup and one
     drawImage of a 64-pixel cell onto whole coordinates.

     Which of the eight facings to use is the one piece of real thinking
     in here, and it was the piece the billboard build got wrong twice:
     it is the player's heading relative to THE CAMERA, not in the world.
     The camera stands behind her goal, so "towards the camera" is
     towards increasing pitch y — and using the world heading is what
     had everybody running backwards after half time.
     ======================================================================= */
  var atlasCache = {};
  function atlasFor(pl) {
    var look = ROSTER[pl.face] || ROSTER[pl.id] || FALLBACK_LOOK;
    var team = teamById(pl.teamId) || {};
    var kit = pl.kit || (pl.gk ? team.gkKit : team.kit) || null;
    var key = (look.id || pl.face) + "|" + (kit ? kit.shirt + kit.shorts + kit.socks : "-");
    if (!atlasCache[key]) atlasCache[key] = window.CupSprites.bake(look, kit);
    return atlasCache[key];
  }

  function spriteFacing(pl) {
    /* down the screen is towards the camera, which is +y on the pitch;
       right across the screen is +x. Octant 0 is facing the lens. */
    var oct = Math.round(Math.atan2(Math.cos(pl.dir), Math.sin(pl.dir)) / (Math.PI / 4));
    return ((oct % 8) + 8) % 8;
  }

  /* what the simulation says this player is doing, as a sprite animation */
  function spriteAnim(pl) {
    if (pl.anim && pl.anim.once) {
      var a = pl.anim.state;
      if (a === "kick" || a === "superKick") return "kick";
      if (a === "slide") return "tackle";
      if (a === "dive") return "dive";
      if (a === "cheer" || a === "armsUp" || a === "knee" ||
          a === "planeRun" || a === "heart") return "cheer";
      if (a === "dejected") return "sad";
      if (a === "superWind") return "ready";
      if (a === "watch" || a === "ready") return "ready";
    }
    if (pl.tackleT > 0) return "tackle";
    if (G.state === "goal") return pl.team === G.scoredBy ? "cheer" : "sad";
    if (pl.gk && ballNear(pl)) return "ready";
    return len(pl.vx, pl.vy) > 5 ? "run" : "idle";
  }

  /* advance one player's animation clock and hand the renderer what it
     needs. No scene graph, no matrices, no texture offsets. */
  function syncBillboard(pl, r, dt) {
    var at = r.atlas;
    var want = spriteAnim(pl);
    if (want !== r.anim) { r.anim = want; r.t = 0; }
    /* the run cycle keeps pace with the legs rather than the clock, so a
       player jogging does not scrabble and a sprinting one does not
       moonwalk */
    var rate = want === "run" ? 5 + len(pl.vx, pl.vy) * 0.14
             : want === "idle" ? 3.2 : 9;
    r.t += (dt || 0) * rate;
    var n = at.anims[want] || 1;
    var once = want === "kick" || want === "tackle" || want === "dive";
    r.frame = once ? Math.min(n - 1, Math.floor(r.t)) : Math.floor(r.t) % n;
    var fc = at.facing(spriteFacing(pl));
    r.face = fc.id; r.flip = fc.flip;
    /* how far off the ground this particular frame drew her, in sprite
       pixels — the compositor is the only thing that knows */
    r.air = at.airOf(want, fc.id, r.frame);
  }

  function buildRigs() {
    rigs = G.players.map(function (p) {
      return { atlas: atlasFor(p), anim: "idle", t: 0, frame: 0,
               face: "s", flip: false, air: 0 };
    });
  }

  /* nothing to build: the ball is six rectangles and it is drawn where
     the simulation says it is */
  function buildBall() {}

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
    syncHeart();
    var p = G.controlled;
    var carrying = p && G.ball.owner === p;
    setBtn(carrying ? (IN.held ? "shoot" : "pass") : "tackle");
    if (EL["cup-btn-ring"]) {
      var f = (carrying && IN.held) ? clamp(IN.heldT / TUNE.chargeTime, 0, 1) : 0;
      EL["cup-btn-ring"].style.setProperty("--f", f.toFixed(3));
      EL["cup-btn"].dataset.f = f > 0.92 ? "1" : "0";
    }
  }

  /* THE METER.

     Under the score, in the captain's own super colour, with their
     super's name written along it — so the first time it fills she does
     not have to be told what she has got, she has been reading it fill
     for two minutes. Their meter is the thin one on the other side, and
     it is only there at all once they can actually use it.  */
  var heartSuper = null;
  function syncHeart() {
    var el = EL["cup-heart-f"];
    if (!el) return;
    var mine = G.heart[0] / TUNE.superCost;
    el.style.width = (clamp(mine, 0, 1) * 100).toFixed(1) + "%";
    var ready = superCharged(0);
    if (EL["cup-heart"]) {
      EL["cup-heart"].dataset.ready = ready ? "1" : "0";
      /* the colour is the captain's, resolved once a match rather than
         every frame — it cannot change while a match is being played */
      if (heartSuper === null) {
        heartSuper = superOf(0) || false;
        if (heartSuper) {
          EL["cup-heart"].style.setProperty("--hc", heartSuper.colour);
          if (EL["cup-heart-n"]) EL["cup-heart-n"].textContent = heartSuper.name;
        }
      }
    }
    /* theirs */
    if (EL["cup-heart-a"]) {
      var them = cfg("RULES.aiSupersFrom", 0.62) <= G.skill;
      EL["cup-heart-a"].hidden = !them;
      if (them) {
        EL["cup-heart-a"].style.setProperty("--f",
          clamp(G.heart[1] / TUNE.superCost, 0, 1).toFixed(3));
      }
    }
    /* the button, which only exists while it can be pressed */
    var btn = EL["cup-sup-btn"];
    if (btn) {
      var armed = superArmed(0);
      btn.hidden = !ready;
      btn.dataset.armed = armed ? "1" : "0";
      if (ready && heartSuper) {
        btn.style.setProperty("--sc", heartSuper.colour);
        /* SHORT WORDS ON A ROUND BUTTON.
           It used to print the super's full name here, which on a circle
           eleven units across came out as "HEARTBEAT ST…" — and a
           truncated name is worse than no name. The name is already in
           two other places at this moment: written along the meter
           directly above, and flashed across the screen when the meter
           filled. The button only has to say what pressing it does. */
        if (EL["cup-sup-lab"]) EL["cup-sup-lab"].textContent =
          armed ? "SUPER" : "GET IT";
        btn.title = armed ? heartSuper.name
                          : "get the ball to " + (captainOf(0) || {}).name;
      }
    }
    /* THE FLASH IS IN THE PITCH NOW, not over it.

       It used to be a CSS div with an opacity on it, laid across the
       whole screen — which meant a goal washed the scoreboard, the
       Heart meter and the buttons in pink along with the grass, and did
       it with a smoothly interpolated alpha over a scene that has no
       smooth anything else in it. The renderer draws it into the
       virtual screen instead: it stops at the edge of the pitch, and it
       is made of the same pixels as everything it is flashing. */
    var fl = EL["cup-flash"];
    if (fl && !fl.hidden) fl.hidden = true;
    if (R2) {
      R2.flash = Math.max(R2.flash, (G.flash || 0) * 0.55);
      if (G.flash > 0.01) R2.flashCol = G.flashCol || "#ffffff";
      R2.shake = Math.max(R2.shake, (G.shake || 0) * 4);
    }
  }

  /* The scoreboard's furniture: the two badges, the two short names and
     the round. It lived inside the kick-off button's handler, which
     meant it was only ever right if a match had been started through the
     fixture card — anything else showed whatever was in the HTML. */
  function dressBoard(roundName) {
    if (!G || !EL["cup-h-name"]) return;
    var a = teamById(G.ids[0]), b = teamById(G.ids[1]);
    setFlag(EL["cup-h-flag"], a);
    setFlag(EL["cup-a-flag"], b);
    EL["cup-h-name"].textContent = (a && a.short) || "—";
    EL["cup-a-name"].textContent = (b && b.short) || "—";
    /* the possession strip wears the two sides' own kits rather than the
       same red and grey whoever is playing */
    if (EL["cup-stats"]) {
      EL["cup-stats"].style.setProperty("--hc", (a && a.kit && a.kit.shirt) || "#c1272d");
      EL["cup-stats"].style.setProperty("--ac", (b && b.kit && b.kit.shirt) || "#5a6b86");
    }
    if (EL["cup-round"]) {
      EL["cup-round"].textContent = roundName ||
        (G.round && G.round.round) || "MATCH";
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

  /* THE NAMEPLATE.

     The super's own name, in its own colour, with whose it is under it.
     It is DOM rather than something drawn in the world for the same
     reason every other word in this chapter is: at the size the pitch
     is rendered, painted text is a smudge. It is also the only piece of
     the cinematic that tells her WHAT just happened, so it goes up
     before the strike rather than after it. */
  var superT = null;
  function superBanner(s, p) {
    var el = EL["cup-super-card"];
    if (!el) return;
    el.style.setProperty("--sc", s.colour);
    el.innerHTML =
      '<span class="cup-sup-who">' + (p ? p.name : "") + "</span>" +
      '<b class="cup-sup-name">' + s.name + "</b>" +
      '<i class="cup-sup-note">' + (superKind(s.kind).say || s.note || "") + "</i>";
    el.hidden = false;
    el.dataset.side = s.by && s.by.team === 1 ? "them" : "us";
    /* restarted rather than merely re-shown, so a second super inside
       one card's lifetime plays its entrance again */
    el.classList.remove("in");
    void el.offsetWidth;
    el.classList.add("in");
    if (superT) clearTimeout(superT);
    superT = setTimeout(clearSuperBanner, 2600);
  }
  function clearSuperBanner() {
    if (superT) { clearTimeout(superT); superT = null; }
    var el = EL["cup-super-card"];
    if (el) { el.hidden = true; el.classList.remove("in"); }
  }

  var overlayGo = null;
  function overlay(title, line, action, onGo, opts) {
    var el = EL["cup-overlay"];
    if (!el) return;
    /* the pixel UI and the DOM cards are never both up: whichever is
       asked for last is the one on screen */
    uiClose();
    opts = opts || {};
    el.innerHTML =
      '<div class="cup-card' + (opts.big ? " cup-card-big" : "") +
      (opts.memory ? " cup-card-mem" : "") +
      (opts.tone ? " cup-card-" + opts.tone : "") + '">' +
      (opts.kicker ? '<p class="cup-card-k">' + opts.kicker + "</p>" : "") +
      /* a card with no heading gets no empty heading: the title screen
         carries its name inside its own lockup, and an h3 with nothing
         in it is a gap above it that nothing explains */
      (title ? "<h3>" + title + "</h3>" : "") +
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
      /* the badge is drawn at the size the slot asks for. One size for
         every crest in the chapter meant the little one on the title
         chip was a 96-wide canvas squeezed into twenty pixels, which on
         a pixel-art badge is the one thing that ruins it. */
      var w = +n.dataset.w || 96, h = +n.dataset.h || 64;
      n.appendChild(badgeCanvas(t, w, h));
    });
  }

  /* =======================================================================
     THE PIXEL UI

     WHAT WAS WRONG, AND IT WAS NOT THE BUTTONS

     The menus were built out of CSS: rounded cards, blurred box-shadows,
     a serif title, flat pill buttons, smooth gradients. All of it laid
     over a game rendered through a 270-pixel buffer with hard edges. So
     the chapter had two visual languages in it at once, and every menu
     announced that it was a web page sitting in front of a video game
     rather than part of one. No amount of choosing better beige fixes
     that, because the problem is the RESOLUTION, not the palette.

     So the UI is not CSS any more. It is drawn, pixel by pixel, into a
     canvas whose backing store is exactly the size of the one the pitch
     is rendered into, and stretched over the top with nearest-neighbour.
     A button is a hard bevel and a one-pixel offset shadow. A panel is a
     nine-slice frame with a drawn border and corner details. A letter is
     a bitmap. There is not a border-radius or a blur anywhere in it,
     because at this resolution neither of those things exists.

     This is also the repository's own rule, which this chapter had been
     quietly exempting its menus from: sprites here are PIXEL MAPS, one
     character per pixel. So is the font.
     ======================================================================= */

  /* ---------------------------------------------------------------- font
     Five by seven, proportional — each glyph is as wide as it needs to
     be, which is what stops pixel text reading like a ransom note. Rows
     are separated by slashes, '#' is ink and '.' is not, exactly the way
     every other sprite on this site is written down.

     Accented capitals are not glyphs. É is an E with an acute drawn two
     pixels above it and Ç is a C with a cedilla below, because carrying
     a second copy of a letter just to put a mark over it is how a font
     gets to four hundred lines. */
  var GLYPH = {
    A: ".###./#...#/#...#/#####/#...#/#...#/#...#",
    B: "####./#...#/#...#/####./#...#/#...#/####.",
    C: ".###./#...#/#..../#..../#..../#...#/.###.",
    D: "####./#...#/#...#/#...#/#...#/#...#/####.",
    E: "#####/#..../#..../####./#..../#..../#####",
    F: "#####/#..../#..../####./#..../#..../#....",
    G: ".###./#...#/#..../#.###/#...#/#...#/.####",
    H: "#...#/#...#/#...#/#####/#...#/#...#/#...#",
    I: "###/.#./.#./.#./.#./.#./###",
    J: "..###/....#/....#/....#/#...#/#...#/.###.",
    K: "#...#/#..#./#.#../##.../#.#../#..#./#...#",
    L: "#..../#..../#..../#..../#..../#..../#####",
    M: "#...#/##.##/#.#.#/#.#.#/#...#/#...#/#...#",
    N: "#...#/##..#/#.#.#/#.#.#/#..##/#...#/#...#",
    O: ".###./#...#/#...#/#...#/#...#/#...#/.###.",
    P: "####./#...#/#...#/####./#..../#..../#....",
    Q: ".###./#...#/#...#/#...#/#.#.#/#..#./.##.#",
    R: "####./#...#/#...#/####./#.#../#..#./#...#",
    S: ".####/#..../#..../.###./....#/....#/####.",
    T: "#####/..#../..#../..#../..#../..#../..#..",
    U: "#...#/#...#/#...#/#...#/#...#/#...#/.###.",
    V: "#...#/#...#/#...#/#...#/#...#/.#.#./..#..",
    W: "#...#/#...#/#...#/#.#.#/#.#.#/##.##/#...#",
    X: "#...#/#...#/.#.#./..#../.#.#./#...#/#...#",
    Y: "#...#/#...#/.#.#./..#../..#../..#../..#..",
    Z: "#####/....#/...#./..#../.#.../#..../#####",

    a: "...../...../.###./....#/.####/#...#/.####",
    b: "#..../#..../####./#...#/#...#/#...#/####.",
    c: "...../...../.###./#..../#..../#...#/.###.",
    d: "....#/....#/.####/#...#/#...#/#...#/.####",
    e: "...../...../.###./#...#/#####/#..../.###.",
    f: "..##/.#../.#../###./.#../.#../.#..",
    g: "...../...../.####/#...#/.####/....#/.###.",
    h: "#..../#..../####./#...#/#...#/#...#/#...#",
    i: ".#/../.#/.#/.#/.#/.#",
    j: "..#/.../..#/..#/..#/#.#/.#.",
    k: "#..../#..../#..#./#.#../##.../#.#../#..#.",
    l: "##/.#/.#/.#/.#/.#/.#",
    m: "...../...../##.#./#.#.#/#.#.#/#.#.#/#.#.#",
    n: "...../...../####./#...#/#...#/#...#/#...#",
    o: "...../...../.###./#...#/#...#/#...#/.###.",
    p: "...../...../####./#...#/####./#..../#....",
    q: "...../...../.####/#...#/.####/....#/....#",
    r: "..../..../#.##/##../#.../#.../#...",
    s: "...../...../.####/#..../.###./....#/####.",
    t: ".#../.#../###./.#../.#../.#.#/..##",
    u: "...../...../#...#/#...#/#...#/#..##/.##.#",
    v: "...../...../#...#/#...#/#...#/.#.#./..#..",
    w: "...../...../#...#/#.#.#/#.#.#/#.#.#/.#.#.",
    x: "...../...../#...#/.#.#./..#../.#.#./#...#",
    y: "...../...../#...#/#...#/.####/....#/.###.",
    z: "...../...../#####/...#./..#../.#.../#####",

    0: ".###./#...#/#..##/#.#.#/##..#/#...#/.###.",
    1: "..#../.##../..#../..#../..#../..#../.###.",
    2: ".###./#...#/....#/...#./..#../.#.../#####",
    3: "####./....#/....#/.###./....#/....#/####.",
    4: "...#./..##./.#.#./#..#./#####/...#./...#.",
    5: "#####/#..../####./....#/....#/#...#/.###.",
    6: "..##./.#.../#..../####./#...#/#...#/.###.",
    7: "#####/....#/...#./..#../.#.../.#.../.#...",
    8: ".###./#...#/#...#/.###./#...#/#...#/.###.",
    9: ".###./#...#/#...#/.####/....#/...#./.##..",
    "’": "##/##/#./#./../../..",                            // curly apostrophe
    "—": "....../....../....../######/....../....../......", // em dash

    " ": "../../../../../../..",
    ".": "../../../../../../#.",
    ",": "../../../../../.#/#.",
    ":": "../../.#/../../.#/..",
    ";": "../../.#/../../.#/#.",
    "!": "#/#/#/#/#/./#",
    "?": ".###./#...#/....#/..##./..#../...../..#..",
    "'": "#/#/./././././",
    "-": "..../..../..../####/..../..../....",
    "–": "...../...../...../#####/...../...../.....",
    "/": "....#/....#/...#./..#../.#.../#..../#....",
    "(": ".#/#./#./#./#./#./.#",
    ")": "#./.#/.#/.#/.#/.#/#.",
    "%": "##..#/##..#/...#./..#../.#.../#..##/#..##",
    "+": "...../..#../..#../#####/..#../..#../.....",
    "·": "../../../.#/../../..",
    "°": "##/##/../../../../..",
    "★": "..#../..#../#####/.###./.#.#./#...#/.....",     // star
    "♥": ".#.#./#####/#####/#####/.###./..#../.....",     // heart
    "▸": "#../##./###/##./#../.../...",                   // right arrow
    "◂": "..#/.##/###/.##/..#/.../...",                   // left arrow
    "×": "...../#...#/.#.#./..#../.#.#./#...#/.....",
    /* Not needed by anything today. Each is two minutes of work
       against a question mark turning up on screen the first time
       somebody names a squad with one of them in it. */
    "#": ".#.#./#####/.#.#./.#.#./#####/.#.#./.....",
    "&": ".##../#..#./.##../##.#./#..##/#..#./.##.#",
    "*": "...../#.#.#/.###./#####/.###./#.#.#/.....",
    "\"": "#.#/#.#/.../.../.../.../...",
  };
  /* what goes over (or under) a letter to make it an accented one */
  var ACCENTED = {
    "É": ["E", "acute"], "È": ["E", "grave"], "Ê": ["E", "hat"],
    "é": ["e", "acute"], "è": ["e", "grave"], "ê": ["e", "hat"],
    "À": ["A", "grave"], "à": ["a", "grave"],
    "Û": ["U", "hat"],   "û": ["u", "hat"],
    "Ç": ["C", "cedilla"], "ç": ["c", "cedilla"],
    "Î": ["I", "hat"],   "î": ["i", "hat"],
  };
  var ACCENT_ART = {
    acute:   "..##/.##./....",
    grave:   "##../.##./....",
    hat:     ".##./##.#/....",
    cedilla: "..../.##./##..",
  };

  /* Each glyph compiled once into a list of [x, y] pixels, because a
     menu redraws sixty times a second and splitting the same strings on
     every frame is the kind of thing that turns a still screen into a
     warm phone. */
  var glyphCache = {};
  function glyph(ch) {
    if (glyphCache[ch]) return glyphCache[ch];
    var art = GLYPH[ch];
    if (art === undefined) {
      var acc = ACCENTED[ch];
      if (acc) {
        var base = glyph(acc[0]);
        var g2 = { w: base.w, px: base.px.slice(), accent: acc[1], top: base.top };
        return (glyphCache[ch] = g2);
      }
      art = GLYPH["?"];
    }
    var rows = art.split("/");
    var px = [];
    for (var y = 0; y < rows.length; y++) {
      for (var x = 0; x < rows[y].length; x++) {
        if (rows[y][x] === "#") px.push([x, y]);
      }
    }
    /* the first row that has ink in it. An accent has to sit above the
       LETTER, and a lowercase letter's letter starts two rows down —
       hanging every accent off the cap line put the acute on "é" up
       among the descenders of the line above, which is where the é in
       "Médecine" went. */
    var top = px.length ? Math.min.apply(null, px.map(function (q) { return q[1]; })) : 0;
    return (glyphCache[ch] = { w: rows[0].length, px: px, accent: null, top: top });
  }

  var FONT_H = 7;
  /* Cut a line to a width, on a word boundary, and say so with an
     ellipsis. Text that overflows a pixel panel does not wrap or clip
     politely — it simply carries on off the side of the screen. */
  function fitText(str, maxW, scale, track) {
    if (textWidth(str, scale, track) <= maxW) return str;
    var cut = str;
    while (cut.length > 1 && textWidth(cut + "...", scale, track) > maxW) {
      var sp = cut.lastIndexOf(" ");
      cut = sp > 0 ? cut.slice(0, sp) : cut.slice(0, -1);
    }
    return cut + "...";
  }
  /* Break a line into as many as `maxLines` that each fit `maxW`, and
     put an ellipsis on the last one if there is more text than that.
     Cutting a sentence short when there is a whole empty line under it
     is just as wrong as letting it run off the edge. */
  function wrapText(str, maxW, maxLines, scale, track) {
    var words = String(str).split(" ");
    var lines = [], cur = "";
    for (var i = 0; i < words.length; i++) {
      var trial = cur ? cur + " " + words[i] : words[i];
      if (textWidth(trial, scale, track) <= maxW) { cur = trial; continue; }
      if (cur) lines.push(cur);
      cur = words[i];
      if (lines.length === maxLines - 1) break;
    }
    if (lines.length < maxLines) {
      var rest = cur;
      for (var j = words.indexOf(cur) + 1; j < words.length; j++) {
        if (lines.length < maxLines - 1) break;
        rest += " " + words[j];
      }
      lines.push(lines.length === maxLines - 1
                 ? fitText(rest, maxW, scale, track) : rest);
    }
    return lines;
  }
  function textWidth(str, scale, track) {
    scale = scale || 1; track = track === undefined ? 1 : track;
    var w = 0;
    for (var i = 0; i < str.length; i++) {
      w += (glyph(str[i]).w + track) * scale;
    }
    return w - track * scale;
  }

  /* DRAWING A WORD.

     One fillRect per lit pixel, scaled. It sounds extravagant and it is
     not: a line of twenty characters is about four hundred rectangles,
     and the whole screen redraws in well under a millisecond. Doing it
     this way is what makes the text genuinely part of the picture —
     canvas fillText cannot be turned off antialiasing, so real text at
     this size arrives grey and soft and gives the whole game away. */
  function drawText(x2, str, y2, opts) {
    opts = opts || {};
    var scale = opts.scale || 1;
    var col = opts.colour || "#ffffff";
    /* AN OUTLINE IS NOT FREE, TWICE OVER.

       It eats a pixel into the gap between letters, so tracking has to
       grow with it or the outlines of adjacent letters meet and the
       word becomes one shape — which is what "LES EQUIPES" was doing at
       double size, with the Q and the U welded together.

       And at scale 1 an outline is wider than the strokes it is
       outlining, so it closes the counters — the holes — inside the
       letters. A 6 fills in and becomes an 8, which a screenshot of the
       carousel caught reading "2/8" when there are six faculties. So
       small text is never outlined: it gets a hard one-pixel shadow
       instead, which lifts it off a busy background without touching
       the shapes. */
    var outline = scale > 1 ? opts.outline : null;
    var outlineW = opts.outlineW || Math.max(1, scale - 1);
    var track = opts.track === undefined ? (outline ? 1 + outlineW : 1) : opts.track;
    if (!outline && opts.outline && !opts.shadow) {
      opts = Object.create(opts);
      opts.shadow = opts.outline;
    }
    var cx2 = x2;
    if (opts.align === "center") cx2 = x2 - Math.round(textWidth(str, scale, track) / 2);
    else if (opts.align === "right") cx2 = x2 - textWidth(str, scale, track);
    cx2 = Math.round(cx2); y2 = Math.round(y2);

    /* the outline first, as eight offset copies — at one pixel it is a
       keyline and it is what lets a caption sit on top of a crowd */
    if (outline) {
      var o = outlineW;
      UIX.fillStyle = outline;
      for (var dy = -o; dy <= o; dy += o) {
        for (var dx = -o; dx <= o; dx += o) {
          if (!dx && !dy) continue;
          blitText(cx2 + dx, y2 + dy, str, scale, track);
        }
      }
    }
    /* a hard drop shadow under it, never a blur */
    if (opts.shadow) {
      UIX.fillStyle = opts.shadow;
      blitText(cx2 + (opts.shadowX || scale), y2 + (opts.shadowY || scale), str, scale, track);
    }
    UIX.fillStyle = col;
    blitText(cx2, y2, str, scale, track);
    if (wordWatch) wordWatch[str] = 1;
    return textWidth(str, scale, track);
  }
  /* When a harness turns this on, every string that actually reaches
     the screen is recorded — which is a better list of "what the font
     has to be able to draw" than any guess at it, because it includes
     the ones this file builds at runtime rather than storing. */
  var wordWatch = null;
  function blitText(x2, y2, str, scale, track) {
    var pen = x2;
    for (var i = 0; i < str.length; i++) {
      var g = glyph(str[i]);
      for (var k = 0; k < g.px.length; k++) {
        UIX.fillRect(pen + g.px[k][0] * scale, y2 + g.px[k][1] * scale, scale, scale);
      }
      if (g.accent) {
        var ar = ACCENT_ART[g.accent].split("/");
        /* above this letter's own ink, not above the cap line */
        var ay = g.accent === "cedilla" ? FONT_H * scale : (g.top - 3) * scale;
        var ax = pen + Math.round((g.w - 4) / 2) * scale;
        for (var ry = 0; ry < ar.length; ry++) {
          for (var rx = 0; rx < ar[ry].length; rx++) {
            if (ar[ry][rx] === "#") {
              UIX.fillRect(ax + rx * scale, y2 + ay + ry * scale, scale, scale);
            }
          }
        }
      }
      pen += (g.w + track) * scale;
    }
  }

  /* =======================================================================
     THE PIXEL UI — PANELS, BEVELS, BUTTONS

     Depth in a pixel interface is not a shadow, it is an EDGE: one line
     of a lighter colour along the top and left, one of a darker colour
     along the bottom and right, and a hard offset block underneath. That
     is the whole trick, it is forty years old, and it is the only way a
     button at this resolution reads as something you can press.
     ======================================================================= */
  var uiCvs = null, UIX = null, UIW = 0, UIH = 0;

  /* A colour, lightened or darkened by a fixed step rather than by a
     percentage — at eight bits a proportional shade of a dark colour is
     no change at all. */
  function lift(hex, amt) {
    var n = parseInt(hex.slice(1), 16);
    var r = clamp(((n >> 16) & 255) + amt, 0, 255);
    var g = clamp(((n >> 8) & 255) + amt, 0, 255);
    var b2 = clamp((n & 255) + amt, 0, 255);
    return "#" + ((1 << 24) + (r << 16) + (g << 8) + b2).toString(16).slice(1);
  }
  function box(x2, y2, w, h, col) {
    UIX.fillStyle = col;
    UIX.fillRect(Math.round(x2), Math.round(y2), Math.round(w), Math.round(h));
  }
  /* a one-pixel rule, so a border is four rules and not a stroke */
  function line(x2, y2, w, h, col) { box(x2, y2, w, h, col); }

  /* THE PANEL. A nine-slice frame built out of rules and corner blocks:
     an outer ink border, a bright bevel inside it on the top and left, a
     dark one on the bottom and right, the fill, and a stud in each
     corner. `tone` is the team's own colour, so the same frame is a
     different object on every screen. */
  function panel(x2, y2, w, h, tone, opts) {
    opts = opts || {};
    x2 = Math.round(x2); y2 = Math.round(y2); w = Math.round(w); h = Math.round(h);
    var ink = opts.ink || "#0d1412";
    var fill = opts.fill || "#1b2a34";
    var hi = opts.hi || lift(tone, 60);
    var lo = opts.lo || lift(tone, -55);

    /* the hard offset shadow — a block, not a blur */
    if (opts.drop !== false) box(x2 + 3, y2 + 3, w, h, "rgba(4,8,10,.55)");
    box(x2, y2, w, h, ink);                       // the outer keyline
    box(x2 + 1, y2 + 1, w - 2, h - 2, tone);      // the frame itself
    line(x2 + 1, y2 + 1, w - 2, 1, hi);           // lit along the top
    line(x2 + 1, y2 + 1, 1, h - 2, hi);           // and down the left
    line(x2 + 1, y2 + h - 2, w - 2, 1, lo);       // dark underneath
    line(x2 + w - 2, y2 + 1, 1, h - 2, lo);       // and down the right
    box(x2 + 3, y2 + 3, w - 6, h - 6, ink);       // the inner keyline
    box(x2 + 4, y2 + 4, w - 8, h - 8, fill);      // and the paper

    /* corner studs, which is the detail that stops it being a rectangle */
    [[x2 + 2, y2 + 2], [x2 + w - 4, y2 + 2],
     [x2 + 2, y2 + h - 4], [x2 + w - 4, y2 + h - 4]].forEach(function (c) {
      box(c[0], c[1], 2, 2, hi);
      box(c[0], c[1], 1, 1, lift(tone, 110));
    });
    /* and a title tab across the top, if the panel is announcing itself */
    if (opts.title) {
      /* ABOVE the panel, not astride it. At y-5 with a height of 11 the
         tab straddled the frame's own top edge, so the bottom row of
         its letters was painted over by the border drawn after it and
         the name came out with its feet cut off. */
      var tw = textWidth(opts.title, 1, 1) + 12;
      var tx = x2 + Math.round((w - tw) / 2);
      box(tx, y2 - 12, tw, 14, ink);
      box(tx + 1, y2 - 11, tw - 2, 12, tone);
      line(tx + 1, y2 - 11, tw - 2, 1, hi);
      line(tx + 1, y2 - 11, 1, 11, hi);
      line(tx + tw - 2, y2 - 11, 1, 11, lo);
      drawText(tx + Math.round(tw / 2), opts.title, y2 - 9,
               { align: "center", colour: opts.titleInk || "#0d1412" });
    }
  }

  /* THE BUTTON. Three states and they are three different SHAPES, not
     three different colours: at rest it stands two pixels proud of its
     own shadow, hovered it lifts and brightens, pressed it drops onto
     the shadow and the shadow disappears. That collapse is the whole
     feeling of pressing something. */
  function button(b, t) {
    var x2 = Math.round(b.x), y2 = Math.round(b.y);
    var w = Math.round(b.w), h = Math.round(b.h);
    var tone = b.tone || "#3a5a6a";
    var ink = "#0d1412";
    var lifted = b.hover && !b.down;
    var drop = b.down ? 0 : 3;
    var oy = b.down ? 3 : (lifted ? -1 : 0);

    if (!b.down) box(x2 + 2, y2 + drop + oy, w, h, "rgba(4,8,10,.5)");
    var face = lifted ? lift(tone, 26) : tone;
    if (b.on) face = lift(tone, 16);
    box(x2, y2 + oy, w, h, ink);
    box(x2 + 1, y2 + oy + 1, w - 2, h - 2, face);
    line(x2 + 1, y2 + oy + 1, w - 2, 1, lift(face, 70));
    line(x2 + 1, y2 + oy + 1, 1, h - 2, lift(face, 45));
    line(x2 + 1, y2 + oy + h - 2, w - 2, 1, lift(face, -60));
    line(x2 + w - 2, y2 + oy + 1, 1, h - 2, lift(face, -45));

    /* the selected one wears a marching keyline, so which button is
       about to fire is never a matter of a slightly different beige */
    if (b.on) {
      var ph = Math.floor(t * 14) % 4;
      /* IT HAS TO CONTRAST WITH WHAT IT IS AROUND.
         A fixed pale yellow keyline round a gold button is a pale
         yellow line on a gold field — which is what the primary action
         had, so the one marker saying "this is the button" was the one
         you could not see. It picks white or ink depending on how light
         the button it is marking is. */
      var f = parseInt(face.slice(1), 16);
      var lum = (((f >> 16) & 255) * 0.30 + ((f >> 8) & 255) * 0.59 + (f & 255) * 0.11);
      UIX.fillStyle = lum > 140 ? "#1a1208" : "#ffffff";
      for (var i = 0; i < w - 2; i++) {
        if ((i + ph) % 4 < 2) {
          UIX.fillRect(x2 + 1 + i, y2 + oy - 1, 1, 1);
          UIX.fillRect(x2 + 1 + i, y2 + oy + h, 1, 1);
        }
      }
      for (var j = 0; j < h; j++) {
        if ((j + ph) % 4 < 2) {
          UIX.fillRect(x2 - 1, y2 + oy + j, 1, 1);
          UIX.fillRect(x2 + w, y2 + oy + j, 1, 1);
        }
      }
    }

    var ty = y2 + oy + Math.round((h - FONT_H * (b.scale || 1)) / 2);
    drawText(x2 + Math.round(w / 2), b.label, ty,
             { align: "center", colour: b.ink || "#ffffff",
               scale: b.scale || 1, shadow: "rgba(0,0,0,.55)" });
    if (b.sub) {
      drawText(x2 + Math.round(w / 2), b.sub, ty + FONT_H * (b.scale || 1) + 2,
               { align: "center", colour: b.subInk || lift(tone, 90) });
    }
  }

  /* A STAT BAR. Stepped blocks rather than a smooth fill, because a
     smooth fill is a progress bar and blocks are a meter — and blocks
     are the thing that can overshoot and settle, which is where the
     whole feeling of a stat landing comes from. */
  function statBar(x2, y2, w, h, frac, tone, label, value) {
    var ink = "#0d1412";
    box(x2 - 1, y2 - 1, w + 2, h + 2, ink);
    box(x2, y2, w, h, "#121c22");
    var cells = Math.floor(w / 4);
    var lit = Math.round(clamp(frac, 0, 1.08) * cells);
    for (var i = 0; i < cells; i++) {
      if (i >= lit) break;
      var bx = x2 + i * 4;
      var over = i >= cells;
      box(bx, y2, 3, h, over ? "#ffffff" : tone);
      line(bx, y2, 3, 1, lift(tone, 55));
      line(bx, y2 + h - 1, 3, 1, lift(tone, -50));
    }
    if (label) drawText(x2 - 4, label, y2 + Math.round((h - FONT_H) / 2),
                        { align: "right", colour: "#9fb4c2" });
    if (value !== undefined) {
      drawText(x2 + w + 5, String(value), y2 + Math.round((h - FONT_H) / 2),
               { colour: "#ffffff", shadow: "rgba(0,0,0,.6)" });
    }
  }

  /* =======================================================================
     THE UI RUNTIME

     Immediate mode: a screen is a function that draws itself every
     frame, and the widgets it draws register their own rectangles as it
     goes. There is no retained tree and nothing to keep in step — which
     matters here because almost everything on these screens is moving,
     so a retained tree would be rebuilt every frame anyway.
     ======================================================================= */
  var UI = { screen: null, name: "", t: 0, widgets: [], hot: null,
             down: null, focus: 0, born: 0, hearts: [], on: false };

  /* How far past its drawn edge a widget still counts as pressed. A
     button is 26 units tall, which on a phone is about forty CSS
     pixels — under the size a thumb reliably hits — and making it
     bigger on screen would mean a second layout. Growing the hit area
     instead costs nothing visually and is what everything else does. */
  var HIT_PAD = 4;

  function uiSize() {
    if (!uiCvs || !R2) return;
    /* THE UI IS THE PITCH'S OWN RESOLUTION, which is the one thing that
       makes it the same pixels rather than a layer floating on top. The
       renderer halves that when it cuts in close, and the UI must not
       follow it there: a menu that doubled in size every time the camera
       pushed in would be a different menu. It tracks the BASE screen. */
    var w = window.CupPitch2D.BASE_W, h = window.CupPitch2D.BASE_H;
    /* WITH THE PIXEL LAYER OFF, the renderer's buffer is the full CSS
       size of the stage — a thousand pixels across. A five-by-seven
       font in that is three millimetres tall and the menus become
       unreadable, so the UI keeps its own resolution whatever the pitch
       is doing. PIXEL.on is about the GAME's look; the menus are pixel
       art either way. */
    if (!cfg("PIXEL.on", true)) {
      h = clamp(Math.round(h / 1.4), 140, 300);
      w = Math.max(2, Math.round(h * (window.CupPitch2D.BASE_W /
                                      window.CupPitch2D.BASE_H)));
    }
    if (w === UIW && h === UIH) return;
    UIW = uiCvs.width = w;
    UIH = uiCvs.height = h;
    UIX = uiCvs.getContext("2d");
    UIX.imageSmoothingEnabled = false;
  }

  /* Open a screen. Everything is staggered off `UI.born`, so a screen
     does not appear, it arrives — each panel a couple of frames after
     the one before it. */
  function uiOpen(name, drawFn) {
    uiSize();
    UI.screen = drawFn; UI.name = name;
    UI.born = UI.t; UI.focus = 0; UI.hot = null; UI.down = null;
    UI.widgets = [];
    if (uiCvs) { uiCvs.hidden = false; uiCvs.classList.add("on"); }
    UI.on = true;
    hideOverlay();                 // the DOM cards and this are never both up
  }
  function uiClose() {
    UI.screen = null; UI.name = ""; UI.widgets = []; UI.on = false;
    a11yKey = "";
    if (EL["cup-ui-a11y"]) EL["cup-ui-a11y"].innerHTML = "";
    if (uiCvs) { uiCvs.hidden = true; uiCvs.classList.remove("on"); }
  }

  /* the ease everything arrives on: overshoots a little, then settles */
  function pop(age, delay, len) {
    var u = clamp((age - (delay || 0)) / (len || 0.26), 0, 1);
    if (u <= 0) return 0;
    return 1 + 2.2 * Math.pow(1 - u, 3) * Math.sin(u * 7.2) * (1 - u);
  }
  function slideIn(age, delay, dist) {
    var u = clamp((age - (delay || 0)) / 0.3, 0, 1);
    var e = 1 - Math.pow(1 - u, 3);
    return { off: Math.round((1 - e) * (dist || 40)), a: u };
  }

  /* A widget registers where it is and what it does, and draws itself.
     Returns true on the frame it fires. */
  function uiButton(id, x2, y2, w, h, label, opts) {
    opts = opts || {};
    var b = { id: id, x: x2, y: y2, w: w, h: h, label: label,
              tone: opts.tone || "#2f5d72", ink: opts.ink, sub: opts.sub,
              scale: opts.scale, subInk: opts.subInk,
              hover: UI.hot === id, down: UI.down === id,
              on: opts.on || UI.widgets.length === UI.focus && UI.kb };
    UI.widgets.push({ id: id, x: x2, y: y2, w: w, h: h, go: opts.go,
                      label: label, sub: opts.sub });
    button(b, UI.t);
    return b;
  }

  /* where a pointer is, in the game's own pixels */
  function uiPoint(e) {
    if (!uiCvs) return null;
    var r = uiCvs.getBoundingClientRect();
    if (!r.width || !r.height) return null;
    return { x: (e.clientX - r.left) / r.width * UIW,
             y: (e.clientY - r.top) / r.height * UIH };
  }
  function uiHit(p) {
    if (!p) return null;
    for (var i = UI.widgets.length - 1; i >= 0; i--) {
      var w = UI.widgets[i];
      if (p.x >= w.x - HIT_PAD && p.x <= w.x + w.w + HIT_PAD &&
          p.y >= w.y - HIT_PAD && p.y <= w.y + w.h + HIT_PAD) return w;
    }
    return null;
  }
  var uiWired = false;
  function wireUI() {
    if (uiWired || !uiCvs) return;
    uiWired = true;
    uiCvs.addEventListener("pointermove", function (e) {
      if (!UI.screen) return;
      var w = uiHit(uiPoint(e));
      var id = w && w.id;
      if (id !== UI.hot) { if (id) SFX.move(); UI.hot = id; UI.kb = false; }
    });
    uiCvs.addEventListener("pointerdown", function (e) {
      if (!UI.screen) return;
      var w = uiHit(uiPoint(e));
      if (!w) return;
      UI.down = w.id; UI.hot = w.id; UI.kb = false;
      try { uiCvs.setPointerCapture(e.pointerId); } catch (err) {}
      e.preventDefault();
    });
    var release = function (e) {
      if (!UI.screen || !UI.down) { UI.down = null; return; }
      var w = uiHit(uiPoint(e));
      var fired = w && w.id === UI.down ? w : null;
      UI.down = null;
      if (fired && fired.go) { SFX.pick(); fired.go(); }
    };
    uiCvs.addEventListener("pointerup", release);
    uiCvs.addEventListener("pointercancel", function () { UI.down = null; });
    uiCvs.addEventListener("pointerleave", function () {
      UI.down = null; UI.hot = null;
    });
  }
  /* the keyboard, because a menu you cannot tab through is a menu half
     the people who open it cannot use */
  function uiKey(k) {
    if (!UI.screen || !UI.widgets.length) return false;
    if (k === "ArrowDown" || k === "ArrowRight" || k === "Tab") {
      UI.focus = (UI.focus + 1) % UI.widgets.length; UI.kb = true; SFX.move(); return true;
    }
    if (k === "ArrowUp" || k === "ArrowLeft") {
      UI.focus = (UI.focus - 1 + UI.widgets.length) % UI.widgets.length;
      UI.kb = true; SFX.move(); return true;
    }
    if (k === "Enter" || k === " " || k === "Spacebar") {
      var w = UI.widgets[UI.focus];
      if (w && w.go) { SFX.pick(); w.go(); }
      return true;
    }
    return false;
  }

  function uiPaint() {
    if (!UI.screen || !UIX) return;
    UIX.clearRect(0, 0, UIW, UIH);
    UI.widgets = [];
    UI.screen(UI.t - UI.born);
    syncA11y();
  }

  /* The mirror is rebuilt only when the set of buttons changes, not on
     every frame — sixty DOM rebuilds a second would be worse than not
     having it. */
  var a11yKey = "";
  function syncA11y() {
    var host = EL["cup-ui-a11y"];
    if (!host) return;
    var key = UI.name + "|" + UI.widgets.map(function (w) {
      return w.id + ":" + (w.label || "");
    }).join(",");
    if (key === a11yKey) return;
    a11yKey = key;
    host.innerHTML = "";
    UI.widgets.forEach(function (w) {
      if (!w.go) return;
      var b = document.createElement("button");
      b.type = "button";
      b.textContent = (w.label || w.id) + (w.sub ? " — " + w.sub : "");
      b.addEventListener("click", function () { SFX.pick(); w.go(); });
      host.appendChild(b);
    });
    if (uiCvs) uiCvs.setAttribute("aria-label", UI.name || "menu");
  }

  /* ------------------------------------------------------- the trimmings */

  /* A DITHERED VIGNETTE, which is how a pixel screen does a spotlight.
     A radial gradient would be a blur and a blur is the one thing this
     whole rebuild is about not having: this is a checkerboard that gets
     denser towards the edges, which is exactly how the machines that
     invented this look faked a gradient out of two colours. */
  var vigCanvas = null, vigKey = "";
  function vignette(strength) {
    var key = UIW + "x" + UIH + ":" + (strength || 1);
    if (vigKey !== key) {
      /* IT IS THE SAME PICTURE EVERY FRAME.

         Thirty-two thousand cells, each with a square root in it, were
         being recomputed sixty times a second to draw something that
         cannot change unless the window is resized. It is baked into an
         offscreen canvas once and blitted from then on. */
      vigKey = key;
      var m = mkCanvas(UIW, UIH);
      var g = m.x;
      g.fillStyle = "rgba(6,10,14," + (0.42 * (strength || 1)).toFixed(2) + ")";
      for (var y2 = 0; y2 < UIH; y2 += 2) {
        for (var x2 = 0; x2 < UIW; x2 += 2) {
          var dx = (x2 - UIW / 2) / (UIW / 2), dy = (y2 - UIH / 2) / (UIH / 2);
          var d = Math.sqrt(dx * dx + dy * dy * 0.8);
          if (d < 0.78) continue;
          var lvl = Math.min(3, Math.floor((d - 0.78) * 5.5));
          /* four dither densities: a quarter of the cells, then half,
             then three quarters, then solid */
          var cell = ((x2 >> 1) & 1) + (((y2 >> 1) & 1) << 1);
          if (lvl === 0 && cell !== 0) continue;
          if (lvl === 1 && (cell & 1)) continue;
          if (lvl === 2 && cell === 3) continue;
          g.fillRect(x2, y2, 2, 2);
        }
      }
      vigCanvas = m.c;
    }
    if (vigCanvas) UIX.drawImage(vigCanvas, 0, 0);
  }

  /* Hearts drifting up the screen. Eight of them, wrapping, at three
     different speeds so there is a foreground and a background to them. */
  function heartsStep(dt) {
    if (!UI.hearts.length) {
      for (var i = 0; i < 9; i++) {
        UI.hearts.push({ x: Math.random() * UIW, y: Math.random() * UIH,
                         v: 8 + Math.random() * 16, s: 1 + (i % 3),
                         w: Math.random() * 6.28 });
      }
    }
    UI.hearts.forEach(function (h) {
      h.y -= h.v * dt;
      h.w += dt * 1.4;
      if (h.y < -10) { h.y = UIH + 6; h.x = Math.random() * UIW; }
      var g = glyph("♥");
      UIX.fillStyle = h.s === 1 ? "rgba(255,120,166,.30)"
                    : h.s === 2 ? "rgba(255,150,186,.42)" : "rgba(255,190,210,.55)";
      var hx = Math.round(h.x + Math.sin(h.w) * 5), hy = Math.round(h.y);
      for (var k = 0; k < g.px.length; k++) {
        UIX.fillRect(hx + g.px[k][0] * h.s, hy + g.px[k][1] * h.s, h.s, h.s);
      }
    });
  }

  /* The banner strip along the top: pennants on a string, waving. All
     four of a team's colours, so the strip is that team's strip. */
  function bunting(y2, cols, t) {
    var n = Math.ceil(UIW / 14) + 1;
    line(0, y2, UIW, 1, "#0d1412");
    for (var i = 0; i < n; i++) {
      var x2 = i * 14;
      var sag = Math.round(Math.sin(t * 1.6 + i * 0.7) * 1.6);
      var col = cols[i % cols.length];
      for (var r = 0; r < 8; r++) {
        var w = 11 - r * 1.3;
        if (w <= 0) break;
        box(x2 + Math.round((11 - w) / 2), y2 + 1 + r + sag, w, 1,
            r === 0 ? lift(col, 50) : col);
      }
      box(x2 + 5, y2 + 9 + sag, 1, 1, "#0d1412");
    }
  }

  /* A crest, drawn into the pixel layer rather than composited as a
     smooth canvas: crestCanvas already draws one at any size, so it is
     rendered small and blitted with smoothing off. */
  /* A CREST IS VECTOR ART UNTIL IT IS NOT.

     crestCanvas draws with curves and the browser antialiases them, so
     blitting one into the pixel layer drops a little cloud of blended
     half-pixels into a screen that has none anywhere else — the one
     smooth object left on the page. Every badge is passed through a
     threshold once, when it is first asked for: anything more than half
     opaque becomes solid, anything less disappears. Hard edges, same
     artwork, and it costs nothing after the first frame. */
  var crestCache = {};
  function hardEdge(cv) {
    var x = cv.getContext("2d");
    var d = x.getImageData(0, 0, cv.width, cv.height);
    var p2 = d.data;
    for (var i = 0; i < p2.length; i += 4) {
      p2[i + 3] = p2[i + 3] > 128 ? 255 : 0;
    }
    x.putImageData(d, 0, 0);
    return cv;
  }
  function pixCrest(team, x2, y2, w, h, t) {
    var key = team.id + ":" + w + "x" + h;
    if (!crestCache[key]) crestCache[key] = hardEdge(badgeCanvas(team, w, h));
    UIX.imageSmoothingEnabled = false;
    x2 = Math.round(x2); y2 = Math.round(y2);
    UIX.drawImage(crestCache[key], x2, y2, w, h);

    /* THE SHIMMER. A bright diagonal band travelling across the badge
       every few seconds — three pixels wide, hard edges, clipped to the
       crest. It is the one thing that stops a badge being a sticker,
       and it is the pixel version of the sweep a polished surface makes
       rather than a CSS gradient pretending to be one. */
    if (t === undefined) return;
    var cyc = (t * 0.42) % 3;
    if (cyc > 1) return;
    var sweep = -h + cyc * (w + h * 2);
    UIX.save();
    UIX.beginPath();
    UIX.rect(x2, y2, w, h);
    UIX.clip();
    UIX.fillStyle = "rgba(255,255,255,.42)";
    for (var r = 0; r < h; r++) {
      var sx = x2 + Math.round(sweep + r);
      UIX.fillRect(sx, y2 + r, 2, 1);
      UIX.fillRect(sx + 4, y2 + r, 1, 1);
    }
    UIX.restore();
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
  /* A side that exists only while it is being built. The builder can now
     put the squad she is assembling on the grass behind the card as she
     picks it, and the pitch does not care where a team came from — but
     teamById does, so this is the one place that knows about it. */
  var previewSide = null;

  var customPatched = false;
  function patchTeamLookup() {
    if (customPatched) return;
    customPatched = true;
    var base = teamById;
    teamById = function (id) {
      if (previewSide && previewSide.id === id) return previewSide;
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

  /* =======================================================================
     THE MENU IS PLAYED ON THE PITCH

     What was wrong with the menus was not the buttons. It was that they
     were a cream rectangle in front of an empty dark field: the chapter
     spent all that effort building a stadium and then covered it with a
     settings dialog and turned the lights off.

     So the world stays on behind them. The side she is looking at walks
     out and stands in a line facing the camera, in their own kit, at a
     campus with the good light on it, and the camera drifts slowly
     across them the way a broadcast does before kick-off. Pressing the
     arrow on the carousel does not change a picture of a team — it
     changes the team standing on the grass.

     It costs almost nothing: the rigs, the pitch and the camera all
     exist already, and this only tells them where to stand.
     ======================================================================= */
  var MENU_VENUE = "marrakech";       // the best light of the five
  function lineUp(teamId, venueId) {
    if (!R2) return;                  // the renderer is not up yet
    var ven = venueId || MENU_VENUE;
    var sideId = teamId || run.myTeam || derbyTeam("hers");
    /* a side under construction is not saved anywhere yet, so it is
       remembered here for exactly as long as the card is up */
    if (teamId && typeof teamId === "object") {
      previewSide = teamId;
      sideId = teamId.id;
      patchTeamLookup();
    } else {
      previewSide = null;
      run.myTeam = sideId;
    }
    G = newMatch(0, { mine: sideId, theirs: derbyTeam("his"), venue: ven });
    G.venue = ven;
    applyVenue(ven);
    hideTrail();                  // no beads left over from a last shot
    buildRigs();
    G.state = "menu";

    /* The line runs along the pitch's y, because that is the axis the
       camera sees across — it stands on a touchline, so a row spread
       along x would be a queue pointing away from it. */
    var mine = G.players.filter(function (p) { return p.team === 0; });
    /* LOOKING AT THE CAMERA, which is now a single number rather than a
       deduction. The camera stands behind her goal line and looks up the
       pitch, so the heading that points a player straight at the lens is
       the one with the whole of itself in +y. Nothing about this depends
       on which end she is attacking, which is what it used to and what
       used to line four of them up with their backs to her. */
    var face = Math.PI / 2;
    mine.forEach(function (p, i) {
      /* MEASURED, NOT GUESSED, TWICE.

         At 27 apart and a camera 74 out on a 52° lens, the four of them
         spanned eighty units in a frame that holds seventy-two, so the
         ends were off the sides and only one was ever in shot. Then
         with the camera pulled back they fitted — and three of them
         were behind the card, which is centred.

         So they are staged like a team photograph instead of a police
         line-up: closer together, and STEPPED AWAY from the camera, so
         they overlap and read as a group rather than as four separate
         people who each need their own column. The card sits to the
         left of them (see .cup-card-title) and the camera is aimed to
         put them in the right of the frame. */
      /* THE LINE RUNS ACROSS THE SCREEN, WHICH IS THE PITCH'S X.

         It used to run along y, because the old camera stood on a
         touchline and saw the length of the pitch left to right. This
         one stands behind her goal, so y runs INTO the screen — and a
         row spread along it put two of them inside the far goal and
         one behind the crowd. Across, stepped slightly back, so they
         overlap and read as a team photograph rather than four people
         queueing away from the lens. */
      p.x = PITCH.cx - 34 + i * 26;
      p.y = PITCH.cy + 26 - (i % 2) * 16;
      p.vx = p.vy = 0;
      p.dir = face;
      p.anim = null;
    });
    /* and the other side is not in this shot at all */
    G.players.filter(function (p) { return p.team === 1; })
      .forEach(function (p, i) {
        /* right off the side of the world. Parked behind the far goal
           they stood IN it, four of them in the mouth, which is not a
           team that is "not in this shot" — it is a team in this shot */
        p.x = PITCH.cx - 900;
        p.y = PITCH.cy + i * 20;
        p.vx = p.vy = 0;
      });
    G.ball.x = PITCH.cx + 44;
    G.ball.y = PITCH.cy + 34;
    G.ball.z = 0; G.ball.vx = G.ball.vy = G.ball.vz = 0;
    G.ball.owner = null;
    setCamMode("menu");
    placeCamera(0, true);
    if (EL["cup-hud"]) EL["cup-hud"].hidden = true;
    if (EL["cup-pad"]) EL["cup-pad"].hidden = true;
    if (EL["cup-pause-btn"]) EL["cup-pause-btn"].hidden = true;
  }

  /* ---------------------------------------------------------------- title */
  function titleMenu() {
    lineUp(run.myTeam);
    menuMusic(true);
    var modes = cfg("MODES", []);
    var mine = teamById(run.myTeam) || {};
    /* an icon per mode, drawn in the button rather than lettered: a
       menu of six identical beige rectangles is a list, and a list is
       what this looked like */
    var ICON = {
      coupe:  '<svg viewBox="0 0 24 24"><path d="M7 4h10v5a5 5 0 01-10 0zM5 5h2v3a2.5 2.5 0 01-2-2.4zM19 5h-2v3a2.5 2.5 0 002-2.4zM10 14h4l.6 4H9.4zM7 20h10v1.6H7z"/></svg>',
      amical: '<svg viewBox="0 0 24 24"><path d="M6 11l3-3 3 2 3-2 3 3-3.2 4.5a2 2 0 01-3 .3L12 15l-.8.8a2 2 0 01-3-.3z"/><path d="M3 10.4l3-3 1.4 1.4-3 3zM21 10.4l-3-3L16.6 8.8l3 3z"/></svg>',
      derby:  '<svg viewBox="0 0 24 24"><path d="M12 3.2l2.3 2.3 3.2-.6-.6 3.2L19.2 10l-2.3 2.3.6 3.2-3.2-.6L12 17.2 9.7 14.9l-3.2.6.6-3.2L4.8 10l2.3-2.3-.6-3.2 3.2.6zM8.6 18.2l-1.4 3.4 3-1 2.2 1.2V18zM15.4 18.2l1.4 3.4-3-1-1 .5V18z"/></svg>',
      teams:  '<svg viewBox="0 0 24 24"><path d="M9 4a3 3 0 110 6 3 3 0 010-6zM3.5 19c0-3 2.5-5.2 5.5-5.2s5.5 2.2 5.5 5.2zM17 6.5a2.5 2.5 0 110 5 2.5 2.5 0 010-5zM16.2 13.4c2.4.3 4.3 2.2 4.3 4.6h-4a7 7 0 00-1.4-4.2z"/></svg>',
      help:   '<svg viewBox="0 0 24 24"><path d="M12 2.6A9.4 9.4 0 1012 21.4 9.4 9.4 0 0012 2.6zm.1 14.9a1.2 1.2 0 110 2.4 1.2 1.2 0 010-2.4zm1.3-3.1v.9h-2.5v-2c0-1.4 2.4-1.6 2.4-3.2A1.4 1.4 0 0010.7 10H8.4a3.7 3.7 0 017.3.6c0 2.2-2.3 2.6-2.3 3.8z"/></svg>',
      quit:   '<svg viewBox="0 0 24 24"><path d="M10.6 5.4L9.2 4 4.4 8.8a1.7 1.7 0 000 2.4L9.2 16l1.4-1.4-2.8-2.8H20V9.8H7.8z"/><path d="M14 3.4h5.6A1.8 1.8 0 0121.4 5v14a1.8 1.8 0 01-1.8 1.8H14V19h5.4V5.2H14z"/></svg>',
    };
    var btn = function (id, name, note, primary) {
      return '<button class="cup-menu-b' + (primary ? " primary" : "") +
             '" data-go="' + id + '" data-ico="' + id + '">' +
             '<span class="cup-menu-ico">' + (ICON[id] || "") + "</span>" +
             '<span class="cup-menu-t">' + name +
             (note ? "<small>" + note + "</small>" : "") + "</span>" +
             '<span class="cup-menu-go" aria-hidden="true">\u25b8</span></button>';
    };

    overlay("", "", "", null, {
      kicker: "", tone: "title",
      html: '<div class="cup-menu cup-title">' +
        /* THE LOCKUP. A trophy, the name under it, and the line under
           that \u2014 one block with its own weight, instead of a heading
           that could have come off any card in the chapter. */
        '<div class="cup-lock">' +
          '<span class="cup-cupart" data-cup="1"></span>' +
          '<h2 class="cup-lock-t">' + cfg("TITLE", "Ouissy\u2019s Cup") + "</h2>" +
          '<p class="cup-lock-k">FOUR A SIDE</p>' +
          '<p class="cup-menu-sub">' + cfg("TAGLINE", "") + "</p>" +
        "</div>" +

        '<div class="cup-menu-list">' +
        modes.map(function (m) { return btn(m.id, m.name, m.note, m.primary); }).join("") +
        btn("teams", "THE TEAMS", "pick a faculty, or build your own squad") +
        btn("help", "HOW TO PLAY", "one stick, two buttons") +
        btn("quit", "BACK TO THE BOOK", "") +
        "</div>" +

        /* who she is playing as, and how hard it is. Both were things
           the game decided for her and never mentioned. */
        '<div class="cup-title-foot">' +
          '<button class="cup-chip cup-chip-team" data-go="teams">' +
            '<i data-team="' + (mine.id || "") + '" data-w="36" data-h="24"></i>' +
            "<span>" + (mine.short || "\u2014") + "</span></button>" +
          '<span class="cup-diffs">' +
            diffList().map(function (d) {
              return '<button class="cup-chip" data-go="diff" data-c="' + d.id + '"' +
                     ' data-on="' + (d.id === diffId ? 1 : 0) + '" title="' +
                     (d.note || "") + '">' + d.name + "</button>";
            }).join("") +
          "</span>" +
        "</div></div>",
    });
    paintTrophies();
    paintCardFlags();
    wireMenu({
      diff: function (b) {
        setDiff(b.dataset.c);
        titleMenu();
      },
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
          round: { round: "THE DERBY", skill: 0.72, venue: "night",
                   before: "Dentistry against medicine. He has been talking " +
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

  /* =======================================================================
     THE HERO

     One character, big, lit, and doing something. The old team select
     put four of them eighty units away in the background behind a card,
     which is a team photograph seen from the car park. This is a poster:
     the captain front and centre, the other three arranged behind them
     and much further off, and nobody standing still.
     ======================================================================= */
  var hero = { p: null, next: 0, idle: 0 };
  /* what a character does while she reads about them. Weighted towards
     doing nothing, because a hero who celebrates every two seconds is a
     hero who looks broken. */
  var FLOURISH = [
    { a: "armsUp", t: 1.5 }, { a: "heart", t: 1.6 }, { a: "knee", t: 1.7 },
    { a: "kick", t: 0.34 }, { a: "planeRun", t: 1.4 }, { a: "ready", t: 1.2 },
  ];

  function heroStage(teamId, ndc) {
    if (!R2) return null;
    lineUp(teamId, MENU_VENUE);
    CAMHERO.ndc = ndc === undefined ? 0.30 : ndc;
    var mine = G.players.filter(function (p) { return p.team === 0; });
    if (!mine.length) return null;
    var cap = mine.filter(function (p) { return p.captain; })[0] ||
              mine.filter(function (p) { return !p.gk; })[0] || mine[0];
    var face = Math.PI / 2;

    /* the captain, on the spot, facing the camera */
    cap.x = PITCH.cx; cap.y = PITCH.cy;
    cap.dir = face; cap.vx = cap.vy = 0; cap.anim = null;

    /* and the rest, well behind and spread, so they read as depth
       rather than as four people queueing */
    var others = mine.filter(function (p) { return p !== cap; });
    others.forEach(function (p, i) {
      /* behind and to the sides, across the screen rather than away up
         the pitch — the same axis mistake as the line-up above */
      p.x = PITCH.cx - 40 + i * 26;
      p.y = PITCH.cy + 34 + (i % 2) * 12;
      p.dir = face; p.vx = p.vy = 0; p.anim = null;
    });
    /* the ball at the captain's feet, because a footballer without one
       is a person standing on some grass */
    G.ball.x = cap.x + 5; G.ball.y = cap.y + 7; G.ball.z = 0;
    G.ball.vx = G.ball.vy = G.ball.vz = 0; G.ball.owner = null;

    hero.p = cap; hero.next = 2.2 + Math.random() * 2;
    setCamMode("hero", cap, 0);
    placeCamera(0, true);
    return cap;
  }

  /* The performance. It runs off the same pose machine the match uses,
     so a celebration on a menu is the celebration, not a second copy of
     one that can drift out of step with it. */
  function heroStep(dt) {
    if (!hero.p || !G) return;
    var p = hero.p;
    animStep(p, dt);
    G.players.forEach(function (q) { if (q !== p) animStep(q, dt); });
    hero.next -= dt;
    if (hero.next <= 0) {
      var f = FLOURISH[Math.floor(Math.random() * FLOURISH.length)];
      setAnim(p, f.a, f.t);
      if (f.a === "kick") {
        /* and if they kick it, the ball goes — then comes back, because
           a menu cannot afford to lose it */
        G.ball.vx = (Math.random() - 0.5) * 40;
        G.ball.vy = -70;
        G.ball.vz = 44;
        setTimeout(function () {
          if (!G || !hero.p) return;
          G.ball.x = hero.p.x + 5; G.ball.y = hero.p.y + 7; G.ball.z = 0;
          G.ball.vx = G.ball.vy = G.ball.vz = 0;
        }, 900);
      }
      hero.next = 3.4 + Math.random() * 3.2;
    }
    /* the ball is a free body even here, so it falls and settles */
    if (G.ball.vz || G.ball.z > 0) {
      G.ball.vz -= TUNE.gravity * dt;
      G.ball.z = Math.max(0, G.ball.z + G.ball.vz * dt);
      if (G.ball.z <= 0) G.ball.vz = 0;
    }
    G.ball.x += G.ball.vx * dt; G.ball.y += G.ball.vy * dt;
    G.ball.vx *= Math.pow(0.4, dt); G.ball.vy *= Math.pow(0.4, dt);
  }

  /* =======================================================================
     TEAM SELECT, REBUILT

     The first screen done in the new language, and the one the rest are
     measured against. Everything on it is drawn at the pitch's own
     resolution: the frame, the bevels, the bars, the crest, the arrows
     and every letter.
     ======================================================================= */
  var selAnim = { team: null, at: 0, rating: 0, bars: [0, 0, 0, 0] };

  function teamSelect(mode) {
    var list = allTeams();
    if (!list.length) return titleMenu();
    carAt = ((carAt % list.length) + list.length) % list.length;
    var t = list[carAt];
    if (selAnim.team !== t.id) {
      selAnim.team = t.id; selAnim.at = UI.t;
      selAnim.rating = 0; selAnim.bars = [0, 0, 0, 0];
    }
    patchTeamLookup();
    heroStage(t.id, 0.32);
    menuMusic(true);

    var accent = (t.kit && t.kit.shirt) || "#c1272d";
    var trim = (t.kit && t.kit.trim) || "#e8b23c";
    var cols = [accent, trim, (t.kit && t.kit.shorts) || "#f6efdd", lift(accent, -40)];

    uiOpen("teams", function (age) {
      var st = teamStats(t);
      var sq = squadOf(t);
      var cap = sq.filter(function (m) { return m.captain; })[0] || sq[1] || sq[0];
      var capR = cap ? ROSTER[cap.id] : null;
      var dt = 1 / 60;

      heartsStep(dt);
      vignette(0.95);
      bunting(0, cols, UI.t);

      /* ---- the title, as a logo rather than as a heading ---- */
      var tp = slideIn(age, 0, -26);
      var head = mode === "quick" ? "YOUR FACULTY"
               : mode === "opp" ? "WHO ARE YOU PLAYING?" : "THE TEAMS";
      drawText(Math.round(UIW / 2), head, 14 + tp.off,
               { align: "center", scale: 2, colour: "#ffffff",
                 outline: "#0d1412", outlineW: 2,
                 shadow: accent, shadowX: 0, shadowY: 4 });
      drawText(Math.round(UIW / 2), (carAt + 1) + " / " + list.length, 32 + tp.off,
               { align: "center", colour: trim, outline: "#0d1412" });

      /* ---- the panel: who they are, what they are, who plays ---- */
      var pn = slideIn(age, 0.06, -70);
      /* The panel runs down to just above the action row. At the old
         height the last man in the squad had his feet cut off by the
         frame; the space under it was empty, so the frame grew
         rather than the type shrinking. */
      var px2 = 10 - pn.off, py = 44, pw = 168, ph2 = UIH - 44 - 48;
      panel(px2, py, pw, ph2, accent,
            { fill: "#16222a", title: t.short || "TEAM", titleInk: "#0d1412" });

      var ix = px2 + 10, iy = py + 12;
      pixCrest(t, ix, iy, 34, 23, UI.t);
      /* CUT TO THE PANEL, NOT TO THE SCREEN. Neither of these had a
         width limit, so "Faculty of Dental Medicine" simply carried on
         out through the right-hand side of the frame it is printed in.
         A squad she names herself can be twenty-two characters, so the
         name needs the same treatment. */
      var textW = pw - 20 - 40;
      drawText(ix + 40, fitText(t.name, textW), iy + 1, { colour: "#ffffff" });
      /* WRAPPED, NOT CUT. Clipping it to the panel stopped it running
         off the screen and immediately introduced the opposite fault:
         "Faculty of Dental Medicine" became "Faculty of Dental..." with
         an empty line sitting underneath it. There is room for two. */
      wrapText(t.sub || (t.custom ? "your own squad" : ""), textW, 2)
        .forEach(function (ln, i) {
          drawText(ix + 40, ln, iy + 11 + i * 9, { colour: "#8fa6b4" });
        });

      /* The rating counts up rather than appearing — off the screen's
         own age, not off a per-frame lerp. A lerp is frame-rate
         dependent: the same count takes a third of a second at sixty
         frames and four seconds at six, so on a cold phone the number
         crawls up while she is already reading the rest of the card,
         and it never quite lands on the real value at all. */
      var want = teamRating(t);
      var ru = clamp((age - 0.18) / 0.65, 0, 1);
      selAnim.rating = want * (1 - Math.pow(1 - ru, 3));
      if (ru >= 1) selAnim.rating = want;
      /* The number is drawn at three times size, so the label cannot sit
         at a guessed offset from it — two digits is 33 pixels and three
         is 51, and the label was parked at 30 and printed straight
         through the middle of it. Measure the number and put the words
         after it. */
      var rtxt = String(Math.round(selAnim.rating));
      drawText(ix, rtxt, iy + 31,
               { scale: 3, colour: trim, outline: "#0d1412", outlineW: 1 });
      var rw = textWidth(rtxt, 3, 1) + 7;
      drawText(ix + rw, "TEAM", iy + 33, { colour: "#8fa6b4" });
      drawText(ix + rw, "RATING", iy + 43, { colour: "#8fa6b4" });

      /* ---- the bars: they sweep, and they overshoot ---- */
      var rows = [["SPEED", st.speed, "#5fd6cc"], ["POWER", st.power, "#e8764a"],
                  ["SKILL", st.skill, "#e8a63c"], ["DEF", st.defence, "#7f9ad6"]];
      var by = iy + 57;
      rows.forEach(function (r, i) {
        var target = r[1] / 100;
        var d2 = clamp((age - 0.24 - i * 0.07) / 0.42, 0, 1);
        var e = d2 >= 1 ? 1 : 1 - Math.pow(1 - d2, 3);
        /* the overshoot: it goes past and settles back, which is the
           difference between a bar arriving and a bar being set */
        var over = d2 < 1 ? Math.sin(d2 * Math.PI) * 0.06 : 0;
        selAnim.bars[i] = target * e + over;
        statBar(ix + 34, by + i * 11, 96, 7, selAnim.bars[i], r[2], r[0],
                d2 > 0.9 ? r[1] : "");
      });

      /* ---- the squad, secondary and small ---- */
      var sy = by + 4 * 11 + 8;
      line(ix, sy - 3, pw - 20, 1, "#0d1412");
      sq.forEach(function (m, i) {
        var s2 = slideIn(age, 0.3 + i * 0.05, -20);
        var isCap = !!m.captain;
        drawText(ix - s2.off, ROLE_NAME[m.role] || "", sy + 2 + i * 10,
                 { colour: "#6e8694" });
        drawText(ix + 24 - s2.off, m.name, sy + 2 + i * 10,
                 { colour: isCap ? trim : "#d6e2ea" });
        if (isCap) drawText(ix + 24 + textWidth(m.name, 1, 1) + 4 - s2.off,
                            "★", sy + 2 + i * 10, { colour: trim });
      });

      /* ---- the arrows: big, and they are the whole side of the screen ---- */
      var ay = Math.round(UIH / 2) - 16;
      uiButton("prev", 188, ay, 24, 32, "◂",
               { tone: lift(accent, -30), scale: 2,
                 go: function () { carAt--; teamSelect(mode); } });
      uiButton("next", UIW - 36, ay, 24, 32, "▸",
               { tone: lift(accent, -30), scale: 2,
                 go: function () { carAt++; teamSelect(mode); } });

      /* ---- the captain's super, on a plate of its own ---- */
      if (capR && capR.super) {
        var sp = slideIn(age, 0.36, 40);
        var spw = UIW - 206;
        var spy = UIH - 82 + sp.off;
        /* TWO LINES, AND THE SECOND ONE IS CUT TO FIT.

           On one line the name and the description came to more than
           the plate is wide, so the sentence simply ran off the right
           edge of the screen mid-word. The name gets its own line and
           the note gets the one under it, trimmed on a word boundary
           with an ellipsis if the character's description is a long
           one — nothing is allowed to leave the plate. */
        panel(196, spy, spw, 40, capR.super.colour, { fill: "#141c22" });
        drawText(206, "♥", spy + 6, { colour: capR.super.colour });
        drawText(216, capR.super.name, spy + 6,
                 { colour: "#ffffff", shadow: "rgba(0,0,0,.6)" });
        /* wrapped over two lines rather than cut on one. There was a
           whole empty line underneath the ellipsis. */
        wrapText(capR.super.note || "", spw - 22, 2).forEach(function (ln, i) {
          drawText(206, ln, spy + 17 + i * 9, { colour: "#93a8b6" });
        });
      }

      /* ---- the actions. The primary one is gold and nothing else is ---- */
      var bp = slideIn(age, 0.42, 46);
      var byy = UIH - 40 + bp.off;
      /* ONE TYPE SIZE ACROSS THE ROW.

         The primary was set at double size and its two neighbours at
         single, which is two different pieces of furniture standing
         next to each other. They are all one size now, and the primary
         is told apart the way it should be: it is gold, it is wider,
         and it is the only one wearing the keyline. */
      var actions = [
        { id: "use", w: 128, tone: "#e0a81e", ink: "#2a1c06", on: true,
          label: mode === "quick" ? "PLAY AS THEM"
               : mode === "opp" ? "PLAY AGAINST THEM" : "CHOOSE",
          go: function () { chooseTeam(mode, t, list); } },
        { id: "build", w: 112, tone: "#2f5d72", label: "BUILD A SQUAD",
          go: function () { uiClose(); openBuilder(mode); } },
      ];
      if (t.custom) {
        actions.push({ id: "del", w: 64, tone: "#7a2b34", label: "DELETE",
          go: function () {
            saveCustom(loadCustom().filter(function (c) { return c.id !== t.id; }));
            carAt = 0; teamSelect(mode);
          } });
      }
      actions.push({ id: "back", w: 64, tone: "#3b4a54", label: "BACK",
        go: function () { uiClose(); titleMenu(); } });

      var bx = 16;
      actions.forEach(function (a2) {
        uiButton(a2.id, bx, byy, a2.w, 24, a2.label,
                 { tone: a2.tone, ink: a2.ink, on: a2.on, go: a2.go });
        bx += a2.w + 8;                     // one gap, on the eights
      });
    });
  }

  /* what CHOOSE does, which depends on why she is looking at teams */
  function chooseTeam(mode, t, list) {
    patchTeamLookup();
    if (mode === "quick") {
      run.myTeam = t.id;
      carAt = (carAt + 1) % list.length;
      return teamSelect("opp");
    }
    if (mode === "opp") {
      run.quick = true;
      run.fixture = { mine: run.myTeam, theirs: t.id,
        venue: t.venue || "rabat",
        round: { round: "FRIENDLY", skill: 0.58, venue: t.venue || "rabat",
                 before: "A friendly, on their grass.",
                 won: "Won it. It counts for nothing and it counts for everything.",
                 lost: "Lost a friendly. It is called a friendly for a reason." } };
      run.round = 0;
      uiClose(); roundCard();
      return;
    }
    run.myTeam = t.id;
    uiClose(); titleMenu();
  }

  /* The DOM carousel that used to live here has gone. It was a cream
     card with the four players eighty units away behind it; what
     replaced it is above, and it is drawn at the pitch's own resolution
     with the captain front and centre. Nothing referenced it but the
     button that opened it. */

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
             /* the armband. The one wearing it says so; the others offer
                it, which is a different thing and used to look identical */
             (r && i > 0 ? '<button class="cup-form cup-cap" data-go="cap" data-id="' + id + '"' +
                ' data-on="' + (isCap ? 1 : 0) + '" title="' +
                (isCap ? "wears the armband" : "make " + r.name + " captain") + '">' +
                (isCap ? "★ CAPTAIN" : "CAPTAIN?") + "</button>" : "") +
             "</div>";
    }).join("");

    var capR = build.captain ? ROSTER[build.captain] : null;
    /* and they walk out as she picks them, in the kit she has chosen */
    if (chosen.length) lineUp(build);

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
          /* The swatches go inside a group of their own. Loose in the
             row they are ten flex children beside the label, so the
             tenth wraps onto a line by itself underneath it and the
             palette reads as nine colours and an orphan. */
          '<div class="cup-row"><label>KIT</label><span class="cup-swatches">' +
            SWATCHES.map(function (c) {
              return '<button class="cup-swatch" data-go="kit" data-c="' + c + '"' +
                     ' data-on="' + (build.kit.shirt === c ? 1 : 0) +
                     '" style="background:' + c + '" aria-label="kit colour"></button>';
            }).join("") + "</span></div>" +
          '<div class="cup-row"><label>TRIM</label><span class="cup-swatches">' +
            SWATCHES.map(function (c) {
              return '<button class="cup-swatch" data-go="trim" data-c="' + c + '"' +
                     ' data-on="' + (build.kit.trim === c ? 1 : 0) +
                     '" style="background:' + c + '" aria-label="trim colour"></button>';
            }).join("") + "</span></div>" +
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

  /* HOW TO PLAY.

     Written for somebody who has never played a football game, because
     she has not. Four rows for the controls and three for the things
     the game does on its own that would otherwise look like bugs \u2014 the
     player swapping under her, the ball never going out, and a meter
     filling up in the corner for no stated reason.

     `first` is the version that comes up on its own the first time she
     opens the chapter; it says so, and it has a different button. */
  var HELP_KEY = "cup_helped_v1";
  function helpCard(back, first) {
    var s = superOf(0);
    overlay(first ? "BEFORE YOU START" : "HOW TO PLAY", "", "", null, {
      kicker: first ? "ONE STICK, TWO BUTTONS" : "CONTROLS", big: true,
      html: '<div class="cup-menu"><div class="cup-table cup-help">' +
        "<div><b>MOVE</b><span>slide anywhere on the left \u00b7 or W A S D</span><b>&nbsp;</b></div>" +
        "<div><b>TAP \u25cf</b><span>pass \u2014 or tackle, when they have it</span><b>&nbsp;</b></div>" +
        "<div><b>HOLD \u25cf</b><span>wind up a shot \u2014 or sprint, without the ball</span><b>&nbsp;</b></div>" +
        '<div><b class="cup-help-h">\u2665</b><span>the heart button, when the meter is full' +
          (s ? " \u2014 " + s.name : "") + "</span><b>&nbsp;</b></div>" +
        "</div>" +
        '<div class="cup-help-notes">' +
        "<p><b>You are whoever is nearest the ball.</b> The game swaps for " +
        "you, and it never takes a player away while you are carrying it.</p>" +
        "<p><b>The meter under the score fills as you play</b> \u2014 a pass that " +
        "finds someone, a tackle won, a shot had. Fill it and your captain " +
        "gets one shot that is not a shot.</p>" +
        "<p><b>The ball never goes out.</b> The pitch is boarded; it comes " +
        "back off the sides. There are no throw-ins and nothing stops.</p>" +
        "</div>" +
        '<div class="cup-btnrow"><button class="cup-menu-b primary" data-go="back">' +
        (first ? "LET\u2019S GO" : "GOT IT") + "</button></div>" +
        "</div>",
    });
    wireMenu({ back: function () { (back || titleMenu)(); } });
  }
  /* shown once, ever, and only if the config asks for it */
  function helpIfFirstTime(then) {
    if (!cfg("RULES.showHelpFirstTime", true)) return then();
    var seen = false;
    try { seen = !!localStorage.getItem(HELP_KEY); } catch (e) {}
    if (seen) return then();
    try { localStorage.setItem(HELP_KEY, "1"); } catch (e) {}
    helpCard(then, true);
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
    var r = run.fixture && run.fixture.round ? run.fixture.round : CUP[run.round];
    var them = teamById((run.fixture && run.fixture.theirs) || r.id);
    /* her side, standing at the campus this one is being played at, so
       the fixture card is a photograph of the actual fixture */
    lineUp(run.myTeam, (run.fixture && run.fixture.venue) || r.venue);
    menuMusic(true);
    overlay(them.name, r.before, "KICK OFF", function () {
      hideOverlay();
      menuMusic(false);
      G = newMatch(run.round, run.fixture);
      applyVenue(G.venue);
      buildRigs();
      dressBoard(r.round);
      resetPositions(0);
      if (EL["cup-hud"]) EL["cup-hud"].hidden = false;
      if (EL["cup-pad"]) EL["cup-pad"].hidden = false;
      if (EL["cup-pause-btn"]) EL["cup-pause-btn"].hidden = false;
      startCrowd();
    }, { kicker: r.round, big: true,
         /* The bracket only belongs on a cup tie. A friendly and the
            derby used to print one anyway — and worse, the whole card
            used to be built from CUP[run.round] whatever she had
            picked, so choosing LE DERBY put up a card announcing a
            quarter-final against UM6P and then played the derby. */
         body: venueBlock((run.fixture && run.fixture.venue) || r.venue) +
               (run.quick ? "" : bracketBlock(run.round)) +
               teamsBlock(run.myTeam || derbyTeam("hers"), them.id) });
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
    /* the same fixture the card was drawn from, so a friendly is told
       it was a friendly rather than being congratulated on a semi-final */
    var r = run.fixture && run.fixture.round ? run.fixture.round : CUP[run.round];
    if (EL["cup-pad"]) EL["cup-pad"].hidden = true;
    if (EL["cup-sup-btn"]) EL["cup-sup-btn"].hidden = true;
    setTimeout(function () {
      if (!playing) return;
      stopCrowd();
      menuMusic(true);
      /* THE MATCH IS OVER, SO THE BROADCAST FURNITURE GOES.
         The pad was being hidden and the scoreboard was not, so the
         memory card between the rounds came up with the score, the
         clock, the Heart meter and the possession bar still sitting
         over it — a card that is deliberately not about football,
         framed by every number in the match she just played. */
      if (EL["cup-hud"]) EL["cup-hud"].hidden = true;

      /* A FRIENDLY IS NOT A ROUND.
         Winning one used to advance `run.round` and put up the next cup
         tie, because this only ever knew about the tournament. A one-off
         goes back to the menu it was started from. */
      if (run.quick) {
        overlay("FULL TIME", scoreLine(), won ? "BACK TO THE MENU" : "PLAY IT AGAIN",
          function () {
            hideOverlay();
            if (won) { run.fixture = null; run.quick = false; titleMenu(); }
            else roundCard();
          },
          { kicker: won ? "WON" : "LOST", note: won ? r.won : r.lost,
            body: statsBlock(),
            alt: won ? null : "LEAVE IT FOR NOW",
            onAlt: function () { run.fixture = null; run.quick = false;
                                 hideOverlay(); titleMenu(); } });
        return;
      }

      if (won) {
        run.won++;
        if (run.round >= CUP.length - 1) return theEnd();
        overlay("FULL TIME", scoreLine(), "NEXT ROUND", function () {
          hideOverlay();
          /* and between the rounds, something that is not football */
          memoryCard(run.round, function () {
            run.round++;
            roundCard();
          });
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

  /* =======================================================================
     THE MEMORIES

     The tournament stops for a moment between the rounds and says
     something that has nothing to do with football. They come out of
     MEMORIES in the config, they are indexed by the round just won, and
     if there is no card written for a round the tournament simply
     carries on — so adding or removing one is editing a list, not
     editing a state machine.
     ======================================================================= */
  function memoryCard(i, next) {
    var list = cfg("MEMORIES", []) || [];
    var m = list[i];
    if (!m || (!m.line && !m.title)) { next(); return; }
    /* a clean pitch behind it rather than the wreckage of the match she
       has just finished, with eight people standing where the whistle
       left them */
    lineUp(run.myTeam);
    SFX.memory();
    overlay(m.title || "", "", "GO ON", function () { hideOverlay(); next(); },
      { kicker: "♥", big: true, memory: true,
        html: '<div class="cup-mem">' +
              (m.photo ? '<span class="cup-mem-ph"><img src="' + m.photo +
                         '" alt="" loading="lazy"></span>' : "") +
              '<p class="cup-mem-l">' + (m.line || "") + "</p></div>" });
  }

  /* The trophy, and what he says. Every chapter on this site ends with
     him saying something; this one has had a whole stadium shouting for
     ninety minutes, so it ends quietly. */
  /* THE TROPHY, AND WHAT HE SAYS.

     Every chapter on this site ends with him saying something. This one
     has had a stadium shouting for ninety minutes, so it ends quietly —
     and it ends with HIS words rather than mine: the whole card is
     VICTORY in cup.config.js, which is a block he can rewrite without
     opening this file. It used to be hard-coded here, and it was still
     congratulating her on winning with Morocco and a bear at the back
     three renames after either of those existed. */
  function theEnd() {
    if (EL["cup-hud"]) EL["cup-hud"].hidden = true;
    if (EL["cup-pad"]) EL["cup-pad"].hidden = true;
    if (EL["cup-pause-btn"]) EL["cup-pause-btn"].hidden = true;
    stopCrowd();
    try { if (window.markCupDone) window.markCupDone(); } catch (e) {}

    var V = cfg("VICTORY", {}) || {};
    var lines = V.lines || (V.message ? [V.message] : []);
    /* her side, on the grass, under the floodlights, while she reads it */
    lineUp(run.myTeam, "night");
    SFX.trophy();
    menuMusic(true);
    confettiBurst({ x: PITCH.cx, y: PITCH.cy }, 200, "#ffd45e");

    overlay(V.title || "YOU WON IT", "", V.button || "TAKE IT HOME",
      function () { quit(); },
      { kicker: V.kicker || "FULL TIME", big: true, tone: "win",
        html: '<div class="cup-end">' +
              '<span class="cup-cupart" data-cup="1"></span>' +
              (V.photo ? '<span class="cup-mem-ph"><img src="' + V.photo +
                         '" alt="" loading="lazy"></span>' : "") +
              '<div class="cup-end-lines">' +
              lines.map(function (l) { return "<p>" + l + "</p>"; }).join("") +
              "</div>" +
              (V.signOff ? '<p class="cup-end-sign">' + V.signOff + "</p>" : "") +
              "</div>" });
    paintTrophies();
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
    /* The menus run on real time, not on the match's. `dt` below gets
       scaled by the slow-motion, and a UI that slowed down with a goal
       replay would be a UI with a bug in it. */
    var raw = dt;
    /* The UI clock runs whether a menu is up or not, because the crowd
       sways off it during a match as well. */
    UI.t += raw;
    /* SLOW MOTION. The goal stretches time and then lets it go. It is
       applied to the accumulator rather than to the step, so the
       physics still run at a fixed tick and nothing changes behaviour
       just because the world got slower to watch. */
    if (G) {
      /* What speed the world is running at. A goal stretches for about a
         second; a super stretches harder and for longer, and then snaps
         back to full on the strike so the shot itself is not in slow
         motion — the wind-up is the slow part and the ball is the fast
         one, which is the whole shape of the moment. */
      var want2 = 1;
      if (G.state === "goal" && G.stateT < 1.1) want2 = 0.35;
      else if (G.state === "super" && G.sup) {
        want2 = G.sup.phase === "wind" ? 0.34 : (G.sup.t < 0.18 ? 0.5 : 1);
      }
      G.timeScale += (want2 - G.timeScale) * Math.min(1, dt * (G.state === "super" ? 7 : 3.2));
      dt *= G.timeScale;
    }
    acc += dt;
    /* fixed steps, because the ball, the tackles and the goal line all
       depend on nobody passing through anything, and a 4fps frame on a
       cold phone would walk the ball straight through the net */
    var guard = 0;
    while (acc >= FIXED && guard++ < 6) { step(FIXED); acc -= FIXED; }
    if (acc > 0.4) acc = 0;
    /* a menu is not a still picture: the hero performs, and the UI is
       repainted every frame because almost everything on it is moving */
    if (UI.on) heroStep(raw);
    syncRing();
    draw(dt);
    syncHud();
    if (UI.on) uiPaint(raw);
  }

  var wired = false;
  function wire() {
    if (wired) return;
    wired = true;

    document.addEventListener("keydown", function (e) {
      if (!playing) return;
      var k = e.key;
      /* a menu takes the keyboard while it is up */
      if (UI.on) {
        if (k === "Escape") { uiClose(); titleMenu(); e.preventDefault(); return; }
        if (uiKey(k)) { e.preventDefault(); return; }
        return;
      }
      if (k === "ArrowLeft" || k === "a" || k === "A") IN.keys.left = true;
      else if (k === "ArrowRight" || k === "d" || k === "D") IN.keys.right = true;
      else if (k === "ArrowUp" || k === "w" || k === "W") IN.keys.up = true;
      else if (k === "ArrowDown" || k === "s" || k === "S") IN.keys.down = true;
      else if (k === " " || k === "Spacebar" || k === "Enter") { pressButton(); }
      /* the super, on its own key. Shift because it is under the little
         finger of the hand that is not on the arrows, and E because
         somebody playing WASD has no little finger to spare. */
      else if (k === "Shift" || k === "e" || k === "E") { pressSuper(); }
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

    var sb = EL["cup-sup-btn"];
    if (sb) {
      sb.addEventListener("pointerdown", function (e) {
        e.preventDefault();
        e.stopPropagation();
        if (EL["cup-pad"]) EL["cup-pad"].classList.add("touch");
        sb.classList.add("on");
        pressSuper();
      });
      var supUp = function () { sb.classList.remove("on"); };
      sb.addEventListener("pointerup", supUp);
      sb.addEventListener("pointercancel", supUp);
      sb.addEventListener("pointerleave", supUp);
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
      if (!R2) buildRenderer();
      sizeRenderer();
      G = newMatch(0);
      buildRigs();
      resetPositions(0);
      placeCamera(0, true);
      draw(0);
      patchTeamLookup();
      /* the first time she ever opens it, the controls come up on their
         own — helpCard has existed since the chapter did and nothing
         ever showed it unless she went looking for it in the menu */
      helpIfFirstTime(titleMenu);
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
    menuMusic(false);
    clearSuperBanner();
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
    /* the pixel UI, so a harness can see what it registered and which
       widget is lit rather than having to guess from a photograph */
    ui: function () {
      return { on: UI.on, name: UI.name, hot: UI.hot, down: UI.down,
               carAt: carAt, t: +UI.t.toFixed(2),
               /* how far into its own entrance the screen is. Wall time
                  is no guide: the frame loop clamps dt at 50ms, so a
                  machine rendering at six frames a second advances this
                  at a tenth of real time and a harness that sleeps for
                  a second and a half photographs the animation. */
               age: +(UI.t - UI.born).toFixed(2),
               size: [UIW, UIH],
               widgets: UI.widgets.map(function (w) {
                 return { id: w.id, x: w.x, y: w.y, w: w.w, h: w.h };
               }) };
    },
    teamStats: function (id) {
      var t = teamById(id);
      return t ? { stats: teamStats(t), rating: teamRating(t),
                   squad: squadOf(t).map(function (m) { return m.name; }) } : null;
    },
    selAnim: function () { return JSON.parse(JSON.stringify(selAnim)); },
    /* WHICH CHARACTERS THE FONT CANNOT DRAW.

       A bitmap font has exactly the glyphs somebody sat down and drew,
       so a curly apostrophe or an em dash in the config is not a
       styling difference — it is a question mark on the screen. This
       walks every string the chapter can say and reports anything the
       font would have to fall back on. */
    fontMissing: function () {
      var bad = {}, seen = 0;
      var visit = function (v) {
        if (typeof v === "string") {
          /* A hex colour is not a word. The config is full of them
             and none is ever drawn, so scanning every string
             indiscriminately reported the # of "#ff5f8f" as a
             missing glyph a hundred and eighty-eight times and
             buried anything real underneath it. */
          if (/^#[0-9a-fA-F]{3,8}$/.test(v)) return;
          seen++;
          for (var i = 0; i < v.length; i++) {
            var ch = v[i];
            if (GLYPH[ch] === undefined && !ACCENTED[ch]) {
              bad[ch] = (bad[ch] || 0) + 1;
            }
          }
          return;
        }
        if (v && typeof v === "object") Object.keys(v).forEach(function (k) { visit(v[k]); });
      };
      visit(window.CUP_CONFIG);
      if (wordWatch) Object.keys(wordWatch).forEach(visit);
      return { scanned: seen, missing: Object.keys(bad).map(function (c) {
        return { ch: c, code: "U+" + c.charCodeAt(0).toString(16).toUpperCase(), n: bad[c] };
      }) };
    },
    /* start recording every string the UI paints */
    watchWords: function (on) {
      wordWatch = on ? (wordWatch || {}) : null;
      return wordWatch ? Object.keys(wordWatch).length : 0;
    },
    hero: function () {
      return hero.p ? { name: hero.p.name, x: hero.p.x, y: hero.p.y,
                        anim: hero.p.anim && hero.p.anim.state } : null;
    },

    /* ---- the Heart and the Super ------------------------------------
       A super needs three things lined up that never line up on demand:
       a full meter, the ball, and the captain's boot on it. `arm` puts
       all three together so the cinematic can be fired, watched and
       photographed without playing half a match first. */
    heart: function (t, v) {
      if (v !== undefined) {
        G.heart[t] = v;
        G.superReady[t] = v >= TUNE.superCost;
      }
      return { heart: G.heart.slice(), cost: TUNE.superCost,
               ready: G.superReady.slice(), charged: superCharged(0),
               armed: superArmed(0) };
    },
    arm: function (team) {
      team = team || 0;
      var cap = captainOf(team);
      if (!cap) return null;
      G.ball.owner = cap; G.ball.lock = 0;
      G.ball.x = cap.x; G.ball.y = cap.y; G.ball.z = 0;
      G.ball.vx = G.ball.vy = G.ball.vz = 0;
      G.heart[team] = TUNE.superCost;
      G.superReady[team] = true;
      if (team === 0) G.controlled = cap;
      var s = superOf(team);
      return { captain: cap.name, name: s && s.name, kind: s && s.kind,
               colour: s && s.colour };
    },
    /* put the captain a sensible distance from goal first, so a super is
       fired from where one would actually be fired from */
    armAt: function (team, fromGoal) {
      var cap = captainOf(team || 0);
      if (!cap) return null;
      var d = attackDir(cap.team);
      cap.x = PITCH.cx + 18;
      cap.y = goalY(cap.team) - d * (fromGoal === undefined ? 110 : fromGoal);
      cap.vx = cap.vy = 0;
      return hooks.arm(team);
    },
    fire: pressSuper,
    /* Take the keeper out of it, or put him back (undefined). Whether a
       super is ON TARGET and whether it is SAVED are two different
       questions, and measuring them together means every reading is a
       coin toss wearing a flight path. */
    saveChance: function (v) { G.saveOverride = v; return v; },
    /* Swap the captain's super for another kind, so all eleven flights
       can be looked at without assembling eleven squads. It writes to
       the roster and does not put it back, which is fine in a harness
       and would not be anywhere else. */
    setKind: function (k) {
      var cap = captainOf(0);
      var look = cap && (ROSTER[cap.face] || ROSTER[cap.id]);
      if (look && look.super) look.super.kind = k;
      return k;
    },
    superState: function () {
      var s = G.sup;
      if (!s) return null;
      return { phase: s.phase, t: +s.t.toFixed(2), name: s.def.name,
               kind: s.def.kind, colour: s.def.colour, by: s.by.name,
               fired: !!s.fired, saved: !!s.saved,
               chance: +s.chance.toFixed(3),
               ballSpeed: +len(G.ball.vx, G.ball.vy).toFixed(1),
               /* the velocity, not just its size: a harness cannot tell
                  a curl from an aimed diagonal without the direction the
                  ball actually left in */
               vx: +G.ball.vx.toFixed(1), vy: +G.ball.vy.toFixed(1),
               curve: +(G.ball.curve || 0).toFixed(1) };
    },
    trail: function () {
      var live = 0;
      trailParts.forEach(function (p) { if (p.life > 0) live++; });
      return { live: live, of: TRAIL_N,
               colour: trailParts.length ? trailParts[trailParts.length - 1].col : null,
               heart: !!superTint };
    },
    tally: function () {
      return { shots: G.stat.shots.slice(), passes: G.stat.passes.slice(),
               supers: G.stat.supers.slice(), heart: G.heart.slice(),
               score: G.score.slice() };
    },

    /* ---- the two things that used to be decoration ------------------ */
    difficulty: function (id) { if (id) setDiff(id); return { id: diffId, now: diff() }; },
    slots: function () {
      return G.players.map(function (p) {
        return { name: p.name, team: p.team, role: p.role,
                 formation: p.formation, slot: p.slot,
                 at: { x: +slotPos(p).x.toFixed(1), y: +slotPos(p).y.toFixed(1) } };
      });
    },
    muls: function () {
      return G.players.map(function (p) {
        var m = p.mul || FLAT_MUL;
        return { name: p.name, speed: +m.speed.toFixed(3), power: +m.power.toFixed(3),
                 aim: +m.aim.toFixed(3), touch: +m.touch.toFixed(3),
                 tackle: +m.tackle.toFixed(3), gk: +m.gk.toFixed(3) };
      });
    },
    /* the handful of read-outs tools/cupfeel.js needs to judge whether
       the football is any good, rather than whether it runs */
    reset: function (r) {
      run.round = r || 0; run.quick = false; run.fixture = null;
      G = newMatch(run.round);
      applyVenue(G.venue);
      buildRigs();
      resetPositions(0);
      G.state = "play"; G.stateT = 0;
      /* and it clears the screen. A reset used to leave whatever card
         was up still up — so a harness that ran a half, reset, and then
         photographed the result came back with a picture of the
         half-time card sitting over a match in progress. */
      hideOverlay();
      clearBanner();
      clearSuperBanner();
      /* Beads from a previous shot are still alive until they decay,
         and they only decay inside draw() — which a harness that has
         stopped the frame loop never calls. A new match starts with a
         clean sky. */
      hideTrail();
      superGlow(false);
      menuMusic(false);
      /* and it dresses the scoreboard, which only roundCard used to do —
         so a harness that reset straight into a match photographed the
         two placeholder names sitting in index.html */
      dressBoard();
      if (EL["cup-hud"]) EL["cup-hud"].hidden = false;
      if (EL["cup-pad"]) EL["cup-pad"].hidden = false;
      syncHud();
      return hooks.state();
    },
    /* put a named player somewhere and hand her the stick — the two
       things a hero shot needs that a match will not give on demand */
    place: function (idx, x, y) {
      var q = G.players[idx];
      if (!q) return null;
      q.x = x; q.y = y; q.vx = q.vy = 0;
      return q.name;
    },
    control: function (idx) {
      var q = G.players[idx];
      if (!q) return null;
      G.controlled = q;
      G.ball.owner = q; G.ball.lock = 0;
      G.ball.x = q.x + 4; G.ball.y = q.y - 5; G.ball.z = 0;
      return q.name;
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
               cam: R2 ? { x: +camNow.x.toFixed(1), y: +camNow.y.toFixed(1),
                           zoom: R2.zoom, mode: camMode.kind } : null,
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
      if (!R2) return;
      placeCamera(0, true);
      draw(0.016);
      /* the HUD too. frame() is what normally keeps the scoreboard, the
         Heart meter and the button label in step with the simulation,
         and a harness has stopped frame() — so without this every
         photograph shows the numbers the page loaded with. */
      syncHud();
    },
    /* the renderer itself, so a harness can ask where on the screen a
       thing at a given place on the pitch ended up — which is what
       replaces reaching into a scene graph and projecting a vector */
    view2d: function () {
      if (!R2) return null;
      return { zoom: R2.zoom, vw: R2.vw, vh: R2.vh,
               project: function (x, y) { return R2.project(wX(x), wY(y)); } };
    },
    atlas: function (id) {
      var look = ROSTER[id] || FALLBACK_LOOK;
      return window.CupSprites.bake(look, null);
    },
    flag: flagCanvas,
    draw: draw,
    soundOff: function () { soundOn = false; },
    /* Kept for the harnesses and for the settings screen, and now it
       costs nothing either way: every shadow in the game is an ellipse
       drawn on the grass, so there is no map to switch off and no
       material to recompile. It was only ever here because swiftshader
       in a container is not a graphics card. */
    shadows: function (on) { shadowsOn = !!on; },
    goto: function (r) { run.round = clamp(r, 0, CUP.length - 1); roundCard(); },
    finish: function (won) { finishRound(won); },
  };

  return { start: start, stop: stop, pause: pause, __cup: hooks };
})();

