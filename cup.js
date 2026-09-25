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
    keepReach: 30,          // and how far the carrier can be shoved off it
                            //   — raised with the touch dribble, because
                            //   the ball is now GENUINELY out in front.
                            //   The first setting left only a couple of
                            //   units between a normal running touch and
                            //   this, so ordinary dribbling lost the ball
                            //   on 44% of possessions. A normal touch now
                            //   peaks near 18 and a heavy one near 28,
                            //   which is the gap the risk lives in.
                            //   before it counts as lost. Bigger than the
                            //   reach above on purpose: that asymmetry IS
                            //   shielding, and without it being crowded
                            //   loses you the ball for nothing
    dribblePush: 26,        // (kept for the set-piece placement code)
    /* --- the touch ---
       A dribble is a series of impulses, and these are its shape. */
    touchNear: 6.5,         // units ahead at a standstill
    touchPace: 0.13,        // and how much further per unit of pace
    touchGap: 0.13,         // the least time between two touches
    touchErr: 0.30,         // radians of wander at mid skill, before the
                            //   touch stat divides into it
    touchLoose: 0.032,      // how often a touch is half again too long —
                            //   the one that gets away, and where most
                            //   turnovers in a real match come from
    /* --- contact --- */
    bodyWidth: 9.5,         // how close two players can get before they
                            //   are touching. A shade wider than it was,
                            //   because a collision that does something
                            //   should start fractionally sooner than one
                            //   that only stopped an overlap
    bumpPush: 2.6,          // how much of the overlap goes into pace
    bumpHard: 34,           // closing speed at which contact becomes an
                            //   event rather than a nudge
    bumpStun: 0.30,         // how long the one who came off worse is off
                            //   balance, and cannot accelerate

    stretch: 6,             // extra reach for a ball arriving at you
    trapErr: 0.55,          // radians a first touch can squirt off line at
                            //   mid skill, before the touch stat divides
                            //   into it — and scaled by how hard the ball
                            //   was hit, because a driven pass is harder
                            //   to kill than a rolled one
    trapTime: 0.26,         // how long the receiving touch reads on the
                            //   sprite before they are running with it
    nickEdge: 5,            // how much nearer the ball a challenger has to
                            //   be than the carrier to steal it between
                            //   touches. At the foot nobody can be; with
                            //   the ball pushed ahead, somebody standing
                            //   in its path can
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

    /* --- hit-stop ---
       Three numbers in milliseconds, because that is how they are
       judged. Under about fifty the pause is invisible; over about a
       hundred and twenty the game feels like it is dropping frames
       rather than punctuating itself, which is the failure mode to
       avoid — the whole point is that the player never consciously
       notices a stop, only that the hit felt solid. */
    hitStopShot: 0.055,
    hitStopTackle: 0.085,
    hitStopGoal: 0.12,

    /* --- tackling --- */
    tackleReach: 13,
    /* HOW READY A DEFENDER IS TO COMMIT, per frame, once the carrier is
       inside his reach and before his defence stat and the angle are
       taken into account. It is a small number by nature — sixty of
       these go by every second — and it is the single most powerful
       dial on how the match feels. Too high and nobody can keep the
       ball for long enough to do anything with it; too low and a
       dribbler walks through the whole side. */
    /* It was found by moving it twice and measuring both times.

       At the original 0.078 a defender inside reach committed roughly
       every four hundred milliseconds: possession ran three seconds
       against fourteen and the ball spent more than half of every half
       loose, because nobody was allowed to keep it. Halved to 0.039
       that came right — nine seconds each — and took the goals with it:
       three measured halves finished 0-0, 0-0 and 0-1, because a
       carrier nobody challenges simply dribbles into an organised block
       and stops there.

       0.056 is the setting with both. Possession stays level and the
       goals come back: there are enough challenges to break a stalled
       attack open, and few enough that a side can still put three
       passes together. */
    tackleUrge: 0.056,
    tackleTime: 0.34,
    tackleCool: 0.55,
    tacklePush: 70,         // how hard the ball is knocked away

    /* --- the keeper --- */
    gkSpeed: 52,
    gkReach: 13,
    gkAnticipate: 0.34,     // how far ahead of the ball he reads
    gkHold: 1.1,            // seconds he holds it before rolling it out
    gkHoldPower: 175,       // how hard a ball he can CATCH, before his
                            //   hands and the difficulty are applied.
                            //   Above it he parries and the ball stays
                            //   live; half again above it he punches it
                            //   clear. Shots leave the boot between 130
                            //   and 260, so a placed one is held and a
                            //   struck one is not — which is the whole
                            //   reason to hit it hard

    /* --- the match ---
       These three are the config's, not this file's: RULES in
       cup.config.js is the one place a match's length is written down,
       and it used to be written here as well, which meant editing it
       there did nothing at all. */
    halfSeconds: cfg("RULES.halfSeconds", 52),   // real seconds per half;
                            //   the clock on screen runs 0' to 45' across it
    /* --- fouls --- */
    foulReach: 13,          // how close a missed tackle has to pass to a
                            //   man for it to have caught him
    foulHard: 52,           // and how fast he has to be going, from behind,
                            //   for it to be a booking rather than a foul
    freeKickBack: 26,       // how far the defending side drops off the ball

    replaySpeed: 0.62,      // how fast a replay runs. Slower than life,
                            //   because that is what a replay is for
    setPause: 1.25,         // the held moment on a corner or a goal kick,
                            //   while everybody walks to their mark. Under
                            //   a second it is a teleport; over two it is
                            //   a game that keeps stopping
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
  /* =======================================================================
     WHICH WAY ROUND THE PITCH IS DRAWN

     The renderer takes coordinates in the pitch's own frame — across
     the pitch first, along it second — and decides for itself which of
     those becomes the screen's long axis. So turning the match
     side-on, goals left and right, is one flag here and nothing at all
     in these two functions.

     What it does change, and what the flag is really for, is a handful
     of places that had the vertical answer baked into them: which way a
     sprite is facing relative to the lens, which axis the camera pans
     along, and which way round the radar is drawn. Each of those asks
     SIDE rather than assuming.
     The default is the side-on view. The camera that ships up and down
     the pitch is still here, one flag away, because it is the better
     shot for a penalty and because a decision this large should stay
     reversible — but side-on is what the match is framed for now.
     ======================================================================= */
  var SIDE = cfg("RULES.sideOn", true) !== false;

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

  /* =======================================================================
     A VENUE IS A CAMPUS; A STADIUM IS A CLUB'S GROUND ON IT

     The venue carries the place and the light — the sky, the hour, the
     fog. The team carries what THEIR ground does differently: how it is
     mown, how full it gets, what colour the concrete is, what stands
     behind the roof. Merging the second over the first means a venue
     stays a shared base and a team only writes down what it changes,
     which is the difference between six grounds and six copies of one.

     The host is whoever is at home. In the cup that is the side the
     fixture is played at, and the caller says which. */
  function groundFor(venueId, hostId) {
    var v = venueById(venueId);
    if (!v) return null;
    var t = hostId ? teamById(hostId) : null;
    if (!t || !t.stadium) return v;
    var out = {};
    Object.keys(v).forEach(function (k) { out[k] = v[k]; });
    Object.keys(t.stadium).forEach(function (k) { out[k] = t.stadium[k]; });
    /* the concrete tints the seats with it, so a ground's stand colour
       is one field rather than two that can disagree */
    if (t.stadium.stand) out.stand = t.stadium.stand;
    /* "lighting" is the readable name for what the renderer calls
       floodlit, and the one the bible's config uses */
    if (out.lighting) out.floodlit = (out.lighting === "night");
    return out;
  }

  function applyVenue(id, hostId) {
    /* WHO IS AT HOME, when nobody says.

       This defaulted to run.myTeam, which is the side she has PICKED —
       and that is not set at all until she has been through the team
       screen. Every match started any other way, a harness included,
       therefore merged no stadium block and got the bare campus: right
       colours, no mow pattern, no skyline, no fullness. The match
       itself always knows who is at home, so ask it first. */
    if (hostId === undefined) {
      hostId = (G && G.ids && G.ids[0]) || run.myTeam;
    }
    var v = groundFor(id, hostId);
    if (!v) return;
    if (G && G.lighting) {
      v = Object.keys(v).reduce(function (o, k) { o[k] = v[k]; return o; }, {});
      v.lighting = G.lighting;
      v.floodlit = (v.lighting === "night");
    }
    VEN.cur = v;
    if (window.CupPitch2D) window.CupPitch2D.venue(v);
    /* and the home side's badge, mown into the centre circle */
    if (R2 && R2.setEmblem) {
      var ht = teamById(hostId);
      R2.setEmblem(ht ? hardEdge(badgeCanvas(ht, 48, 40)) : null);
    }
    dressCrowd();
  }

  /* WHOSE GROUND IT IS.

     A stadium full of identically-coloured strangers is scenery. A
     stadium with blocks of both kits in it is an occasion, and it costs
     two colours — which the renderer already has, because they are the
     shirts the two teams are wearing. The venue has to be applied
     first, because applying one rebuilds the crowd palette from
     scratch and would throw this away. */
  function dressCrowd() {
    if (!R2 || !R2.setCrowd) return;
    var h = G && G.ids && teamById(G.ids[0]);
    var a = G && G.ids && teamById(G.ids[1]);
    R2.setCrowd(h && h.kit ? h.kit.shirt : null, a && a.kit ? a.kit.shirt : null);
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

  /* =======================================================================
     THE GROUND'S SONG

     The chant engine is its own file and its own audio graph; this is
     the one place the two meet. It is handed the context and the master
     node the rest of the chapter already uses, so there is one output
     and one volume control rather than two, and the anthem of whoever
     is at home.
     ======================================================================= */
  function startChant() {
    if (!window.CupChant || !audio() || !soundOn) return;
    window.CupChant.init(AC, master, { volume: 0.55 });
    /* =====================================================================
       WHOSE SONG PLAYS: THE ONE SHE IS PLAYING AGAINST.

       This took the anthem off G.ids[0], which is always HER side — so
       across a whole cup run she heard the same piece of music at every
       ground, and the five other songs in the config were never played
       once. Six tracks, one of which anybody would ever hear.

       Taking it off the opponent means every round of the tournament
       sounds different, which is the whole point of writing six of
       them: the draw is a new song, and by the final she has heard
       three grounds she will never hear again.
       ===================================================================== */
    var them = teamById((G && G.ids && G.ids[1])
                        || (G && G.ids && G.ids[0]) || run.myTeam);
    if (them && them.anthem) window.CupChant.setTeam(them.anthem);
    window.CupChant.mute(!soundOn);
  }
  function chantSay(kind) {
    if (window.CupChant && soundOn) window.CupChant.event(kind);
  }

  function startCrowd() {
    if (!audio() || crowdSrc || !soundOn) return;
    startChant();
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
    /* A TOUCH IS NOT A KICK. It is the softest sound in the game on
       purpose: it plays only on the heavy touch and on a ball nicked
       off somebody, which between them happen a couple of times a
       passage rather than three times a second. */
    touch:   function () { burst(0.035, 0.07, 820, 1.8);
                           tone("sine", 130, 95, 0.05, 0.05); },
    /* TWO PLAYERS MEETING. Low, short and soft — a shoulder in a shirt,
       not a collision in a racing game. It scales with how hard they
       came together, because a jostle and a proper challenge are the
       same sound at different sizes. */
    bump:    function (hard) {
      burst(0.07, 0.05 + hard * 0.10, 240 + hard * 120, 0.7);
      tone("sine", 90 + hard * 40, 55, 0.09, 0.05 + hard * 0.06);
    },
    shot:    function () { burst(0.09, 0.30, 1700, 1.0); tone("sine", 220, 60, 0.14, 0.24); },
    tackle:  function () { burst(0.13, 0.18, 380, 0.8); },
    /* =====================================================================
       A FOOT GOING INTO GRASS

       The quietest thing in the bank and the one that happens most, so
       it is built to disappear: eighteen milliseconds of noise around
       six hundred hertz with almost no resonance, which is a scuff, and
       a breath of low sine under it, which is the weight landing.

       It alternates between two pitches, because a run is left-right
       and a single repeated sample at a fixed interval is a metronome.
       The ear picks that out instantly and then cannot stop hearing it.
       ===================================================================== */
    step:    function (vol, other) {
      var f = other ? 660 : 560;
      burst(0.018, 0.030 * vol, f, 0.7);
      tone("sine", other ? 96 : 88, 54, 0.045, 0.026 * vol);
    },
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
    /* THE BOARDS ARE NOT A TACKLE. Every rebound off a touchline and
       every one off the side of a goal frame was playing the tackle
       sound — a dull scuff — so the one thing the pitch does that has
       no equivalent in real football sounded like somebody sliding in.
       A board is hollow, wooden and short. */
    board:   function () { tone("square", 210, 120, 0.09, 0.13);
                           burst(0.05, 0.10, 900, 1.6); },
    /* the ball landing on the turf: almost nothing, which is the point */
    bounce:  function (hard) { burst(0.05, 0.05 + hard * 0.07, 300, 0.9);
                               tone("sine", 120, 70, 0.07, 0.05 + hard * 0.05); },
    /* THE CAMERA CUTTING IN. It halves the virtual screen, which on
       screen is an instant doubling — a cut, not a glide — and a cut
       with no sound on it reads as a dropped frame. */
    cut:     function () { tone("sine", 90, 46, 0.16, 0.14);
                           burst(0.08, 0.07, 500, 0.7); },
    /* THE TANNOY. Two notes and a room behind them: the chime a ground
       plays before it tells you something. There is no speech here and
       there is not going to be — a synthesised voice at this fidelity
       is worse than none — so the chime does the whole job, and the
       lower third says the words. */
    pa:      function () {
      tone("sine", 784, 784, 0.34, 0.075);
      tone("sine", 523, 523, 0.46, 0.065, 0.16);
      tone("sine", 1568, 1568, 0.30, 0.022, 0.02);
    },
    /* THE REFEREE'S BOOK. Two short blasts and a flat note under them:
       the whistle says stop, the note says this is not just a free kick.
       Deliberately not the menu `card` sound, which is a card in the
       sense of a screen and has nothing to do with this one. */
    book:    function (red) {
      tone("square", 2100, 2100, 0.12, 0.10);
      tone("square", 2100, 2100, 0.16, 0.10, 0.17);
      tone("sawtooth", red ? 150 : 240, red ? 90 : 190, 0.5, 0.09, 0.05);
    },
    /* a card arriving: a short sweep up, well under the crowd */
    card:    function () { tone("triangle", 360, 660, 0.10, 0.05);
                           tone("sine", 180, 300, 0.12, 0.04, 0.02); },
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
     THE MENUS HAVE A SCORE NOW

     What was here was eight bars of warm nothing-in-particular: four
     chords, a bass under them and one note picked out on top, looping
     every twelve seconds. It was better than the silence it replaced
     and it was not in the same room as the rest of this site, where the
     walk theme is played eleven different ways by six synthesised
     instruments through a generated hall.

     The chapter has a real score now and it lives in cup.ost.js — one
     original theme, eight bars long, in nine different sets of clothes,
     with a different key and tempo for each round of the tournament so
     the bracket TIGHTENS as she goes up it. This is the switch and the
     wiring; the music is over there.

     It is handed the chapter's own context and master gain, exactly as
     the chant engine is, so there is one output and one volume control
     for everything the chapter makes.
     ======================================================================= */
  var musicOn = false, musicCue = "menu";

  function menuMusic(on, which) {
    if (!window.CupScore) return;
    if (on) {
      if (!soundOn || !audio()) return;
      window.CupScore.init(AC, master, { volume: 0.5 });
      window.CupScore.setOn(true);
      musicOn = true;
      if (which) musicCue = which;
      window.CupScore.play(musicCue);
      return;
    }
    musicOn = false;
    window.CupScore.stop();
  }

  /* MOVE THE SCORE WITHOUT RESTARTING IT. Screens call this rather than
     switching the music off and on again, because a cue change
     crossfades and a stop-then-start does not. */
  function scoreCue(name) {
    musicCue = name;
    if (musicOn && window.CupScore) window.CupScore.play(name);
    else menuMusic(true, name);
  }

  function wakeSound() {
    if (!playing || !soundOn) return;
    /* whichever of the two belongs to where she actually is */
    if (window.CupScore) window.CupScore.mute(false);
    if (G && G.state === "menu") menuMusic(true);
    else startCrowd();
  }
  function sleepSound() {
    stopCrowd(); menuMusic(false);
    if (window.CupScore) window.CupScore.mute(true);
    /* the chant goes quiet with everything else — it has its own graph,
       so it needs telling */
    if (window.CupChant) window.CupChant.mute(true);
  }

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
    gk:  { up: 0.035, across: 0.50 },
    def: { up: 0.26,  across: 0.50 },
    mid: { up: 0.50,  across: 0.22 },
    st:  { up: 0.70,  across: 0.76 },
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
      /* one to four, keeper first, stable for the whole match */
      shirtNo: def.role === "gk" ? 1 : i + 1,
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
      ids: [(opts && opts.mine) || run.myTeam || "upm",
            (opts && opts.theirs) || round.id],
      venue: (opts && opts.venue) || round.venue || "rabat",
      /* THE ROUND'S OWN LIGHT, where it has one. Sunset belongs to the
         final rather than to whichever ground the final is played at,
         so it rides on the match and overrides the stadium. */
      lighting: (opts && opts.lighting) || round.lighting || null,
      score: [0, 0], half: 1, clock: 0,
      state: "kickoff", stateT: 0, msg: "",
      players: [], ball: { x: PITCH.cx, y: PITCH.cy, z: 0, vx: 0, vy: 0, vz: 0,
                           owner: null, lastTouch: null, lock: 0, spin: 0,
                           curve: 0, struck: 0 },
      timeScale: 1, hitStop: 0, set: null, card: null, pa: null,
      scoredBy: 0, scorerP: null, celebration: "armsUp",
      cam: { y: PITCH.cy },
      controlled: null, kickoffTeam: 0, golden: false, over: false,
      shake: 0, flash: 0, flashCol: null, scorer: "",
      /* `passes` is passes COMPLETED, counted where the ball is
         received. `passTry` is passes ATTEMPTED, counted where it is
         struck — without both, a completion rate cannot be worked out
         at all, and a harness measuring owner CHANGES instead counts a
         heavy touch running loose as a misplaced pass. */
      stat: { shots: [0, 0], poss: [0, 0], passes: [0, 0], passTry: [0, 0],
              supers: [0, 0], touches: [0, 0], fouls: [0, 0] },
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
    /* nothing from before the restart belongs in the next replay, and
       no set piece survives a kick-off — a corner interrupted by a goal
       at the other end would otherwise still be waiting to be taken */
    replayBuf.length = 0; replayAcc = 0; replay = null;
    G.set = null; G.card = null;
    G.players.forEach(function (q) { q.markTo = null; });
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
  /* NOBODY DRIVING.

     Measuring the AI with a human player on the pitch measures the
     wrong thing: the player she is steering is excluded from think(),
     so in a harness that presses no keys her side plays with a statue
     at the heart of it — which was read, on the first run of the
     match harness, as "her team never shoots". It holds the ball and
     stands there. With this on, all eight are AI and what comes back
     is the football. */
  var AUTOPLAY = false;

  function pickControlled(force, dt) {
    if (AUTOPLAY) { G.controlled = null; return; }
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

    /* =====================================================================
       A DRIBBLE IS A SERIES OF TOUCHES, NOT A MAGNET

       What was here sprang the ball toward a point a fixed distance in
       front of the player, at a fixed rate, and then set the ball's
       velocity equal to the player's:

           b.x += (tx - b.x) * Math.min(1, dt * 11);
           b.vx = o.vx; b.vy = o.vy;

       The consequence is the single loudest "this is not a real
       football game" tell there is. The ball can never get away from
       anybody. It cannot be over-hit, it cannot be under-hit, it cannot
       run through to the keeper, and a defender standing directly in
       its path is simply passed through — because the ball is not
       travelling anywhere, it is being carried at a fixed offset like a
       tray. Every other thing that makes dribbling interesting is
       downstream of the ball being a free object: the heavy touch, the
       nick between touches, catching up to your own pass, shielding a
       ball that is genuinely rolling away from you.

       So the ball is now ALWAYS a free rigid body, and having
       possession means only that you are the one allowed to touch it.
       A carrier takes a touch when the ball comes back under the foot,
       and the touch is an IMPULSE: the ball runs ahead, decelerates on
       the grass, and the player runs onto it and does it again. Three
       or four times a second at pace, once every second or so at a
       walk, exactly as a person does it.

       Three numbers make it feel like a person rather than a metronome:

         HOW FAR AHEAD — grows with pace, because you push it further
         when you are running, and shrinks to almost nothing when you
         stop, which is how a player stands over a ball.

         HOW ACCURATE — a small angular error per touch, scaled by the
         touch stat, so Lumi's dribble runs straight and Boulder's
         wanders. This is the stat you can SEE without being told it
         exists.

         THE HEAVY ONE — occasionally, and more often the worse the
         player, the touch is half again as long. That is the one that
         goes beyond keepReach and puts the ball up for grabs, and it is
         where most turnovers in a real game actually come from.
       ===================================================================== */
    if (b.owner) {
      var o = b.owner;
      var mulT = (o.mul || FLAT_MUL).touch;
      var osp = len(o.vx, o.vy);
      var gap = len(b.x - o.x, b.y - o.y);
      /* where this player likes to keep it: under the foot standing,
         a stride and a half ahead at a sprint */
      var ideal = (TUNE.touchNear + osp * TUNE.touchPace) * mulT;
      o.touchT = (o.touchT || 0) - dt;
      /* A PLAYER STANDING STILL DOES NOT TAP THE BALL BACK AND FORTH.
         Without this a stationary carrier touches it, it rolls seven
         units, it stops, they touch it again — a twitch, about twice a
         second, for as long as they stand there. */
      var moving = osp > 12 || gap > ideal * 1.25;
      /* A DRIBBLER ALSO TOUCHES IT TO TURN.

         Firing the touch only when the ball has come back under the
         foot models a player running in a straight line and nothing
         else. Turn while the ball is out in front and it keeps going
         the way it was sent: the gap opens, no touch fires because the
         ball is still too far away to be "back", and the ball is simply
         lost — which measured as a quarter of all possessions ending in
         a dribble running away for no reason the eye could see.

         What a player actually does there is shift it: a short touch
         across the body that brings the ball back onto the line he is
         now running. So a touch also fires when the ball is reachable
         but sitting well off his heading, which is the same rule for
         both cases — touch it when it is not where you want it. */
      var toB = Math.atan2(b.y - o.y, b.x - o.x);
      var offLine = Math.abs(Math.atan2(Math.sin(toB - o.dir), Math.cos(toB - o.dir)));
      var reachable = gap < TUNE.keepReach * 0.72;
      if (moving && o.touchT <= 0 &&
          (gap < ideal * 0.78 || (reachable && offLine > 1.0))) {
        var heavy = Math.random() < TUNE.touchLoose * mulT ? 1.55 : 1;
        var target = ideal * heavy;
        var err = (Math.random() - 0.5) * TUNE.touchErr * mulT;
        /* the speed that carries it out to `target` and no further. It
           is a feedback term rather than a solved trajectory, which
           self-corrects when the grass or a bounce takes the ball
           somewhere the arithmetic did not expect. */
        var S = clamp(osp + (target - gap) * 2.4, osp * 0.55 + 6, 240);
        b.vx = Math.cos(o.dir + err) * S;
        b.vy = Math.sin(o.dir + err) * S;
        b.struck = Math.max(b.struck || 0, heavy > 1 ? 0.5 : 0.22);
        o.touchT = TUNE.touchGap;
        o.lastTouchHeavy = heavy > 1;
        /* counted in the simulation rather than inferred from the
           ball's speed by a harness: a shift across the body barely
           changes the speed at all and was being missed */
        G.stat.touches[o.team] = (G.stat.touches[o.team] || 0) + 1;
        /* only the heavy one is audible: a tick three times a second is
           a drum roll, and a dribble is nearly silent */
        if (heavy > 1) SFX.touch();
      }
      /* a carried ball stays on the deck */
      b.z = Math.max(0, b.z - dt * 40);
    }

    b.x += b.vx * dt; b.y += b.vy * dt;
    b.spin += len(b.vx, b.vy) * dt * 0.05;

    if (b.z > 0 || b.vz !== 0) {
      b.vz -= TUNE.gravity * dt;
      b.z += b.vz * dt;
      if (b.z <= 0) {
        b.z = 0;
        if (Math.abs(b.vz) > 22) {
          SFX.bounce(clamp(Math.abs(b.vz) / 90, 0, 1));
          b.vz = -b.vz * TUNE.bounce;
        }
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
    /* HOW FAR IT HAS ROLLED, in radians of its own circumference. The
       simulation has always known how fast the ball is going and never
       had to care which way up it was; a drawn ball does, because a
       football that slides across the grass without turning is a
       sticker being dragged. */
    b.spin = ((b.spin || 0) + len(b.vx, b.vy) * dt / BALL_R) % (Math.PI * 2);
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

    if (b.x < P.x0 + 2) { b.x = P.x0 + 2; b.vx = Math.abs(b.vx) * 0.62; SFX.board(); }
    if (b.x > P.x1 - 2) { b.x = P.x1 - 2; b.vx = -Math.abs(b.vx) * 0.62; SFX.board(); }

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
      /* =================================================================
         OVER THE GOAL LINE — WHICH IS NOW A RESTART

         Both of these used to be boards. A ball over the bar came back
         off "the stanchion" and a ball wide came back off a hoarding,
         on the stated grounds that there is no out of play here. That
         was a real decision and it bought the arcade pace, but it also
         removed the two moments that most say "football" to anybody
         watching: a corner, and a keeper restarting play.

         The TOUCHLINES keep their boards. Throw-ins are the restart
         that buys the least and interrupts the most, and a ball coming
         back off the side is what keeps this game moving. The goal
         lines do not, because what happens there is the part worth
         having.

         Which restart it is, is the oldest rule in the book: whoever
         touched it last gives it to the other side.
         ================================================================= */
      var conceded = ownGoalY(0) === gl ? 0 : 1;   // whose line this is
      var lastT = b.lastTouch ? b.lastTouch.team : 1 - conceded;
      if (lastT === conceded) {
        /* he put it behind for a corner */
        setPiece("corner", 1 - conceded, b.x < PITCH.cx ? -1 : 1, gl);
      } else {
        setPiece("goalkick", conceded, 0, gl);
      }
    });
  }

  /* =======================================================================
     A RESTART

     Three beats, and the middle one is the one that matters. The
     whistle and the ball being placed; a HELD moment while everybody
     walks to where they need to be and the camera looks at the spot;
     and the ball being played. Without the held moment a corner is a
     teleport, and the whole reason to have restarts at all is that they
     are the punctuation in a match — the places where you get to see
     the shape of what is about to happen before it happens.

     `G.set` is the whole of it. The simulation still runs during a
     restart, but every player is steering to a mark instead of playing
     football, and the ball is nailed to the spot until the taker plays
     it.
     ======================================================================= */
  /* a line for the screen reader while the match is running. `announce`
     is defined further down with the rest of the UI; this is the name
     the simulation calls it by, so the sim does not have to know that
     the mirror is a DOM node. */
  function uiSayLive(str) { announce(str); }

  function setPiece(kind, team, side, gl, spot) {
    if (G.state !== "play") return;             // never during a cinematic
    var b = G.ball;
    b.vx = b.vy = b.vz = 0; b.z = 0;
    b.owner = null; b.lock = 999;               // nobody touches it yet
    var d = attackDir(team);

    if (kind === "free") {
      b.x = clamp(spot.x, PITCH.x0 + 8, PITCH.x1 - 8);
      b.y = clamp(spot.y, PITCH.y0 + 12, PITCH.y1 - 12);
    } else if (kind === "corner") {
      b.x = side < 0 ? PITCH.x0 + 3 : PITCH.x1 - 3;
      b.y = gl + (gl === PITCH.y0 ? 3 : -3);
    } else {
      /* A GOAL KICK IS TAKEN FROM INSIDE THE PITCH.

         `d` here is the attack direction of the side TAKING it, and for
         a goal kick that side is the one defending this line — so their
         attack direction points UP the pitch, away from the goal, and
         stepping into the pitch from the line is `+ d`. Writing it as
         `- d`, which is right for a corner because a corner is taken by
         the side attacking that end, put the ball, the taker, the whole
         back line and the camera BEHIND the goal, in the car park. */
      b.x = PITCH.cx + (Math.random() - 0.5) * 20;
      b.y = gl + d * PITCH.sixH * 0.85;
    }
    G.set = { kind: kind, team: team, side: side || 0, t: 0,
              gl: gl, taker: null, x: b.x, y: b.y };
    G.state = "set"; G.stateT = 0;
    SFX.whistle();
    uiSayLive(kind === "corner" ? "Corner."
            : kind === "free" ? "Free kick." : "Goal kick.");
    setCamMode("set");
  }

  /* WHERE EVERYBODY STANDS FOR ONE.

     Marks rather than football: each player is given a place and walks
     to it. What makes it read is that the marks are the ones a
     commentator would describe — two in the box for a corner, the
     keeper on his line, the defending side goal-side of them, and for a
     goal kick a back line pushed right up and the other side dropped
     off it. */
  function setMarks() {
    var S = G.set;
    if (!S) return;
    var d = attackDir(S.team);
    var atk = [], def = [];
    G.players.forEach(function (q) {
      /* a man who has been sent off does not stand in a wall, take a
         corner, or get marked at one */
      if (q.gk || q.sentOff) return;
      (q.team === S.team ? atk : def).push(q);
    });
    /* whoever is nearest takes it */
    if (!S.taker) {
      S.taker = nearestTo({ x: S.x, y: S.y }, S.team, true);
    }

    if (S.kind === "free") {
      /* NO WALL, BECAUSE THERE ARE NOT ENOUGH PLAYERS FOR ONE.

         A wall is three or four men, and each side has three
         outfielders. Putting two of them in a wall leaves one defender
         for the rest of the pitch, which is not a defensive set-up, it
         is a hole. What the defending side does instead is what a small
         side actually does: everybody drops goal-side and the nearest
         man stands the regulation distance off the ball. */
      atk.forEach(function (q, i) {
        if (q === S.taker) { q.markTo = { x: S.x - 8, y: S.y - d * 7 }; return; }
        q.markTo = { x: PITCH.cx + (i ? 40 : -40), y: S.y + d * 34 };
      });
      def.forEach(function (q, i) {
        var back = Math.max(TUNE.freeKickBack, 0);
        q.markTo = { x: S.x + (i - 0.5) * 34, y: S.y + d * back };
      });
    } else if (S.kind === "corner") {
      var boxY = S.gl - d * PITCH.boxH * 0.46;
      var n = 0;
      atk.forEach(function (q) {
        if (q === S.taker) { q.markTo = { x: S.x - S.side * 6, y: S.y }; return; }
        /* one at the near post, one hanging at the penalty spot */
        q.markTo = n === 0
          ? { x: PITCH.cx + S.side * PITCH.sixW * 0.4, y: S.gl - d * PITCH.sixH }
          : { x: PITCH.cx - S.side * 14, y: boxY };
        n++;
      });
      def.forEach(function (q, i) {
        /* goal-side of the two of them, a stride closer to the line */
        var t = atk.filter(function (a) { return a !== S.taker; })[i % 2];
        q.markTo = t ? { x: t.x + (PITCH.cx - t.x) * 0.2, y: t.y + d * 7 }
                     : { x: PITCH.cx, y: S.gl - d * PITCH.boxH * 0.7 };
      });
    } else {
      var up = S.gl + d * PITCH.h * 0.30;
      atk.forEach(function (q, i) {
        q.markTo = { x: PITCH.x0 + PITCH.w * (0.2 + i * 0.3),
                     y: up + (i === 0 ? -d * 22 : 0) };
      });
      def.forEach(function (q, i) {
        /* dropped off, but not so far that a goal kick is uncontested */
        q.markTo = { x: PITCH.x0 + PITCH.w * (0.32 + i * 0.22),
                     y: up - d * (30 + i * 16) };
      });
    }
    /* the keepers: the defending one on his line, the other one home */
    G.players.forEach(function (q) {
      if (!q.gk) return;
      q.markTo = { x: PITCH.cx, y: ownGoalY(q.team) + attackDir(q.team) * 7 };
    });
    /* and the taker stands over it */
    if (S.kind === "goalkick") {
      var gk = null;
      G.players.forEach(function (q) { if (q.gk && q.team === S.team) gk = q; });
      /* behind the ball, not in front of it: `+ d` is up the pitch,
         which is the way he is about to kick */
      if (gk) { S.taker = gk; gk.markTo = { x: S.x - 7, y: S.y - d * 5 }; }
    }
  }

  /* the held moment, and then the ball is played */
  function setStep(dt) {
    var S = G.set;
    if (!S) { G.state = "play"; return; }
    S.t += dt;
    setMarks();
    G.ball.x = S.x; G.ball.y = S.y; G.ball.z = 0;
    G.ball.vx = G.ball.vy = G.ball.vz = 0;
    G.players.forEach(function (q) {
      if (q.sentOff) { think(q, dt); playerStep(q, dt); return; }
      var m = q.markTo;
      if (m) moveTo(q, clamp(m.x, PITCH.x0 + 6, PITCH.x1 - 6),
                       clamp(m.y, PITCH.y0 + 6, PITCH.y1 - 6), dt, 0.8);
      else { q.vx *= 0.8; q.vy *= 0.8; }
      playerStep(q, dt);
    });
    if (S.t < TUNE.setPause) return;

    /* PLAYED. A corner is whipped into the area; a goal kick is hit long
       up the pitch to whoever is furthest forward. */
    var taker = S.taker;
    G.players.forEach(function (q) { q.markTo = null; });
    G.ball.lock = 0;
    G.state = "play"; G.stateT = 0;
    if (camMode.kind === "set") setCamMode("play");
    if (!taker) { G.set = null; return; }
    var d2 = attackDir(taker.team);
    if (S.kind === "free") {
      /* CLOSE ENOUGH AND HE HITS IT. Far out and he puts it into the
         area, which for a side this size is the more dangerous of the
         two anyway. */
      var gy3 = goalY(taker.team);
      var out = Math.abs(taker.y - gy3);
      G.set = null;
      if (out < 150 && Math.abs(taker.x - PITCH.cx) < 80) {
        shoot(taker, clamp(0.6 + out / 240, 0.55, 1));
      } else {
        var into = { x: PITCH.cx + (Math.random() - 0.5) * 50,
                     y: gy3 - d2 * PITCH.sixH * 1.4 };
        var fa = Math.atan2(into.y - taker.y, into.x - taker.x);
        kickBall(taker, fa, TUNE.passSpeed * 1.1, 42, taker);
        setAnim(taker, "kick", 0.34);
        G.stat.passTry[taker.team]++;
        SFX.kick();
      }
      return;
    }
    if (S.kind === "corner") {
      var tgt = { x: PITCH.cx - S.side * 10,
                  y: S.gl - d2 * PITCH.sixH * 1.2 };
      var ang = Math.atan2(tgt.y - taker.y, tgt.x - taker.x);
      ang += (Math.random() - 0.5) * 0.18;
      G.set = null;
      kickBall(taker, ang, TUNE.passSpeed * 1.05, 40, taker);
      setAnim(taker, "kick", 0.34);
      G.stat.passTry[taker.team]++;
      SFX.shot();
      crowdSwell(0.05, 1.2);
    } else {
      var far = null, bestD = -1;
      G.players.forEach(function (q) {
        if (q.team !== taker.team || q.gk) return;
        var v = (q.y - taker.y) * d2;
        if (v > bestD) { bestD = v; far = q; }
      });
      var ang2 = far ? Math.atan2(far.y - taker.y, far.x - taker.x)
                     : Math.atan2(d2, 0);
      ang2 += (Math.random() - 0.5) * 0.24;
      G.set = null;
      kickBall(taker, ang2, TUNE.passSpeed * 1.25, 52, taker);
      setAnim(taker, "kick", 0.34);
      G.stat.passTry[taker.team]++;
      SFX.kick();
    }
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
    /* THE BALL IS STRUCK WHERE IT IS.

       This used to teleport it to six units in front of the striker
       before kicking, which was invisible when the ball was welded to
       the foot and is a jump of most of a stride now that it genuinely
       sits out in front. A player kicks the ball from where the ball is;
       the only thing this still does is refuse to let a kick come from
       somewhere absurd, which can happen when a tackle and a shot land
       on the same frame. */
    var reachOut = len(b.x - from.x, b.y - from.y);
    if (reachOut > TUNE.keepReach * 1.6 || reachOut < 0.5) {
      b.x = from.x + Math.cos(ang) * 6;
      b.y = from.y + Math.sin(ang) * 6;
    }
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
      if (away > TUNE.keepReach * (o.mul || FLAT_MUL).shield) { b.owner = null; }
      else {
        /* =================================================================
           NICKING IT BETWEEN TOUCHES

           The rule above this — that a carried ball cannot be taken by
           proximity at any distance — was written when the ball was
           welded to the foot, and it was right then: without it the ball
           changed hands seven times a second. Now that the ball
           genuinely travels out in front of the player, that rule says
           something different and wrong: that a defender standing
           directly in the path of a ball rolling towards him must let it
           go past.

           The distinction that makes both true at once is not distance
           from the ball, it is WHO IS NEARER. A challenger has to be
           clearly closer to the ball than the man dribbling it. With the
           ball at the carrier's feet that is impossible by construction,
           so the old thrash cannot come back; with the ball pushed a
           stride and a half ahead, a defender who has read it can step
           in front and take it, which is the whole risk of running with
           the ball.
           ================================================================= */
        var thief = null, td = 1e9;
        G.players.forEach(function (q) {
          if (q.team === o.team || q.tackleT > 0) return;
          var d = len(q.x - b.x, q.y - b.y);
          if (d > TUNE.dribbleReach) return;
          if (d > away - TUNE.nickEdge) return;
          if (d < td) { td = d; thief = q; }
        });
        if (thief) {
          b.owner = thief;
          b.lastTouch = thief;
          b.lock = TUNE.settle;
          thief.touchT = TUNE.touchGap;
          addHeart(thief.team, TUNE.heartTackle * 0.6);
          SFX.touch();
          G.hitStop = Math.max(G.hitStop, TUNE.hitStopShot);
        }
      }
      return;
    }

    var best = null, bd = 1e9;
    G.players.forEach(function (p) {
      if (p.sentOff) return;
      if (p.tackleT > 0 && !p.gk) return;
      var d = len(p.x - b.x, p.y - b.y);
      /* a loose ball is won on distance alone and nothing else, so that
         a scramble is never decided by a number she cannot see. The one
         exception is a keeper in his own area, whose hands are his stat. */
      var reach = p.gk && inBox(p, b)
        ? TUNE.gkReach * (p.mul || FLAT_MUL).gk * diff().gk
        : TUNE.dribbleReach;
      /* YOU CAN STRETCH FOR ONE THAT IS COMING TO YOU.

         A player reaches further for a ball arriving at him than for one
         sitting still, because he can put a foot out and the ball does
         the rest of the travelling. Without this, a free ball played
         firmly at somebody's feet can pass through the nine-unit window
         between two frames of him closing on it, and a perfectly good
         pass rolls on untouched — which reads as the receiver ignoring
         it. It applies only to a ball moving TOWARD him, so it never
         widens the window for chasing one that is running away. */
      if (!p.gk) {
        var bs = len(b.vx, b.vy);
        if (bs > 40) {
          var closing = ((p.x - b.x) * b.vx + (p.y - b.y) * b.vy) / bs;
          if (closing > 0) reach += Math.min(TUNE.stretch, bs * 0.035);
        }
      }
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
    /* THE FIRST TOUCH.

       `SFX.kick` has been in the sound bank since the chapter was
       written and nothing has ever called it: a pass had a sound, a
       shot had a sound, and the moment somebody actually TOOK the ball
       — the one touch in football that happens more than any other —
       was silent. It only plays when the ball was moving enough to be
       controlled rather than walked onto, or every jostle in a crowded
       box becomes a drum roll. */
    var arriving = len(b.vx, b.vy);
    if (!b.owner && arriving > 55) SFX.kick();
    b.owner = best;
    b.lastTouch = best;

    /* =====================================================================
       THE FIRST TOUCH

       Before the ball was freed from the foot, taking possession meant
       the ball snapped to a fixed offset and its velocity was overwritten
       with the player's — so a pass was "received" by teleporting it
       under the receiver, and how hard the pass had been hit made no
       difference to anything.

       With a free ball, simply assigning an owner is worse than nothing:
       the ball keeps its pace, sails straight past the man who is
       supposedly on it, leaves his keepReach a few frames later and
       comes loose again. Measured, that alone dropped completed passes
       from 55% to 44% — the passing had not got worse, the RECEIVING
       had stopped existing.

       So a player who takes the ball takes a touch on it: the pace is
       killed, and how much of it survives is the touch stat. A good one
       kills it dead at the feet and can turn immediately. A poor one
       lets it bounce a stride away, which is sometimes recoverable and
       sometimes an invitation — and a ball hit hard is harder to control
       than a ball rolled, for everybody.

       This is the single most legible expression of a stat in the game.
       Nobody has to be told Lumi has a better touch than Boulder; they
       watch one of them take a pass in stride and the other stub it.
       ===================================================================== */
    var mT = (best.mul || FLAT_MUL).touch;      // below 1 is a good touch
    /* how much of the pass's pace survives the control */
    var keep = clamp(0.08 * mT * (1 + arriving / 240), 0.05, 0.58);
    /* and it does not come off the boot perfectly straight */
    var skew = (Math.random() - 0.5) * TUNE.trapErr * mT * clamp(arriving / 150, 0.3, 1.6);
    var va = Math.atan2(b.vy, b.vx) + skew;
    var vs = arriving * keep;
    b.vx = Math.cos(va) * vs;
    b.vy = Math.sin(va) * vs;
    /* a ball dropping out of the air is harder again, and takes the
       bounce out of it rather than the roll */
    if (b.z > 0.5) { b.vz *= 0.25 * mT; }
    /* the ball is his now, so he does not immediately shovel it forward
       — the first touch IS his touch */
    best.touchT = TUNE.touchGap * 2.2;
    /* A KEEPER IS ABOUT TO PLAY HIS OWN ANIMATION — catch, or punch, or
       a full-length dive — and a trap played first would be overwritten
       by it a few lines later anyway. Outfielders only. */
    if (arriving > 70 && !best.gk) {
      setAnim(best, "trap", TUNE.trapTime);     // the receiving animation
      if (keep > 0.34) SFX.touch();             // a heavy one is audible
    }

    /* a settle, so the instant after a tackle is not a scramble in which
       the same two players trade it forty times */
    b.lock = TUNE.settle;
    if (best.gk && inBox(best, b)) {
      /* =================================================================
         HE DOES NOT CATCH EVERYTHING

         A keeper who gathers every shot cleanly, however hard it was
         hit, is the reason a goalmouth in this game had exactly one
         outcome: either the ball went in or the move was over. There
         was no rebound in the match anywhere, and a rebound is half of
         what a penalty area is FOR — the scramble, the follow-up, the
         ball squirming loose off a save and three people arriving at
         once.

         So how hard a ball he can hold is a number, and it is his
         hands: the gk stat. Below it he catches and the move is over.
         Above it he gets something to it and the ball goes back out
         into the area, at an angle, still live. Well above it he cannot
         catch it at all and punches it clear with both fists.

         This is also the first thing that makes a save READ as a save.
         A caught ball just stops; a parried one tells you how hard the
         shot was by how far it goes.
         ================================================================= */
      var mgk = (best.mul || FLAT_MUL).gk;
      var hold = TUNE.gkHoldPower * mgk * diff().gk;
      if (arriving > hold) {
        var punched = arriving > hold * 1.45;
        b.owner = null;
        b.lastTouch = best;
        b.lock = TUNE.controlLock;
        /* out to a side, and away from his own goal — a keeper parries
           the ball WIDE, because parrying it back where it came from is
           how you concede the rebound */
        var side = (b.x < PITCH.cx ? -1 : 1);
        var away = attackDir(best.team);
        var pa = Math.atan2(away * (punched ? 0.75 : 0.45), side * 1.0);
        var ps = arriving * (punched ? 0.62 : 0.40);
        b.vx = Math.cos(pa) * ps;
        b.vy = Math.sin(pa) * ps;
        b.vz = punched ? 34 : 12;
        b.struck = 1;
        best.diveDir = side;
        setAnim(best, punched ? "punch" : "dive", 0.5);
        best.hold = 0;
        SFX.save();
        G.hitStop = Math.max(G.hitStop, TUNE.hitStopShot);
        G.shake = Math.max(G.shake, 0.3);
        crowdSwell(0.08, 1.4);
        uiSayLive("Saved.");
        return;
      }
      /* held */
      best.hold = TUNE.gkHold;
      if (arriving > 90) {
        best.diveDir = (b.x < best.x) ? 1 : -1;
        setAnim(best, "dive", 0.55);
        crowdSwell(0.05, 1.0);
      } else {
        setAnim(best, "catch", 0.38);
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
    /* THE HELD BREATH. Everything ducks to a rising hiss for the
       wind-up, because a goal is not the loudest thing in a stadium —
       the silence before it is what makes it loud. */
    chantSay("superWind");
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
    /* and the release: quiet, then everything */
    chantSay("superHit");
    crowdPush(0.8);
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
    /* a shot is the moment a crowd comes up off its seat, whoever took
       it — the sharp intake before it is a goal or it is not */
    crowdPush(p.team === 0 ? 0.42 : 0.24);
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
    /* A GOAL IS THE ONE MOMENT THAT GETS EVERYTHING.

       Hit-stop first, so the net bulging is a held frame rather than a
       blur; then the flash, the shake, the slow motion, the confetti
       and the wave round the ground. The order matters because they are
       not simultaneous — the stop is the hit, and everything else is
       the reaction to it. */
    G.replayed = false;
    announceGoal(team);
    G.hitStop = Math.max(G.hitStop, TUNE.hitStopGoal);
    turfBurst(G.ball.x, G.ball.y, 16);
    /* THE GROUND REACTS TO WHOSE GOAL IT WAS.

       The wave and the bounce are for a goal at the right end. A goal
       at the wrong one gets the opposite: the stand stops moving. Both
       are the same two lines of code and the difference between a
       stadium and a texture. */
    if (team === 0) { crowdPush(1); chantSay("goalHome"); }
    else { crowdHush(0.9); chantSay("goalAway"); }
    if (R2 && R2.startWave) {
      if (team === 0) R2.startWave();
      if (R2.setMood) R2.setMood(team === 0 ? 1 : -0.85);
    }
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
  /* =======================================================================
     NOBODY STANDS ON A TEAM-MATE

     A formation says where everybody belongs. It does not say what to
     do when two of them want the same square metre, and the jobs —
     press, chase, cover, support — regularly ask for exactly that,
     because they are all arranged around one ball. Measured, two
     team-mates were inside a body's width of each other for an eighth
     of the time the ball was in play.

     The fix is not a rule about jobs. It is a standing instruction that
     belongs to every player at once: if a team-mate is inside your
     personal space, the place you are going shifts away from him. It
     runs in moveTo because that is the single funnel every AI movement
     goes through, so there is no job that can forget about it.

     Two details earn their keep. The player with the BALL is exempt:
     he has somewhere to be and a team-mate arriving to help should not
     shove the target off him. And a player going for a loose ball only
     half-applies it, because two people converging on a ball is
     football and holding them apart would mean neither arrives.
     ======================================================================= */
  function spaceOut(p, tx, ty) {
    if (p.gk || p.sentOff || G.ball.owner === p) return null;
    /* two players converging on a loose ball is football, so the one
       going to get it only half-keeps his distance; everybody else
       keeps all of it */
    var urgent = p.job === "chase" || p.job === "press";
    var s2 = separation(p, urgent ? 20 : 36);
    if (!s2.x && !s2.y) return null;
    /* KEEPING OFF EACH OTHER MUST NOT COST THE GOAL SIDE. The push is
       symmetric, so two defenders converging in a crowded box would
       shove each other up and down the pitch as readily as apart — and
       being shoved a stride upfield of your man is exactly the mistake
       marking exists to avoid. A man holding a mark is pushed ACROSS
       the pitch only. */
    var sy = p.job === "mark" ? s2.y * 0.2 : s2.y;
    return [clamp(tx + s2.x, PITCH.x0 + 6, PITCH.x1 - 6),
            clamp(ty + sy, PITCH.y0 + 6, PITCH.y1 - 6)];
  }

  function moveTo(p, tx, ty, dt, speedMul) {
    var room = spaceOut(p, tx, ty);
    if (room) { tx = room[0]; ty = room[1]; }
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
    /* OFF BALANCE. A player who has just been shouldered off his line
       cannot simply carry on running: for a third of a second his legs
       are doing something other than what he asked them to, which is
       what makes a collision cost something rather than being a sound
       effect. */
    var grip = (p.bumpT || 0) > 0 ? 0.16 : 1;
    p.vx += (ux * top - p.vx) * Math.min(1, TUNE.accel * grip / top * dt);
    p.vy += (uy * top - p.vy) * Math.min(1, TUNE.accel * grip / top * dt);
    if (ux || uy) {
      var want = Math.atan2(uy, ux);
      var diff = Math.atan2(Math.sin(want - p.dir), Math.cos(want - p.dir));
      p.dir += diff * Math.min(1, TUNE.turnEase * dt);
    }
  }

  /* WHETHER THIS PLAYER IS TURNING OR PULLING UP.

     Both fall straight out of numbers the simulation already has, and
     neither needs a decision from anywhere: a turn is the heading being
     a long way off the direction of travel while still moving, and a
     skid is pace being shed much faster than friction alone would shed
     it. Held for a fifth of a second each so a single frame of noise
     does not flicker the sprite, and so the animation has time to read.

     The thresholds are in the simulation's own units: 28 px/s is a jog,
     1.1 radians is about sixty degrees, and 260 px/s/s is heavier
     braking than the accel budget can produce by accident. */
  function gaitStep(p, dt) {
    var sp = len(p.vx, p.vy);
    var was = p.prevSp === undefined ? sp : p.prevSp;
    p.skidT = Math.max(0, (p.skidT || 0) - dt);
    p.turnT = Math.max(0, (p.turnT || 0) - dt);
    if (was > 38 && sp < was - 260 * dt) p.skidT = 0.20;
    else if (sp > 28) {
      var vd = Math.atan2(p.vy, p.vx);
      var off = Math.abs(Math.atan2(Math.sin(p.dir - vd), Math.cos(p.dir - vd)));
      if (off > 1.1) p.turnT = 0.18;
    }
    p.prevSp = sp;
  }

  /* CHECKING FOR THE FOUL FOR THE WHOLE LENGTH OF THE SLIDE.

     The first version asked the question on the single frame the tackle
     was launched, and the answer was almost always no — because the
     ball a tackler is lunging at now sits up to twenty units in front
     of the man who is dribbling it, so at the moment of launch the man
     himself is still well out of range. A slide takes a third of a
     second and travels; whether it caught anybody is a question about
     that whole third of a second. Measured, this is the difference
     between one foul a half and a handful. */
  function slideFoul(p, dt) {
    /* ONLY WHILE THE MATCH IS ACTUALLY RUNNING.

       playerStep runs during a restart and during a celebration too, so
       a slide still in progress when the whistle went would otherwise
       be awarded as a foul against a set piece that is already being
       taken — a free kick given for a challenge nobody made, in the
       middle of somebody else's corner. */
    if (G.state !== "play") return;
    if (!(p.tackleT > 0) || p.wonTackle || p.gk || p.sentOff) return;
    if (p.fouledSlide) return;
    var hit = null, hd = 1e9;
    for (var i = 0; i < G.players.length; i++) {
      var q = G.players[i];
      if (q.team === p.team || q.gk || q.sentOff) continue;
      var dd = dist(p, q);
      if (dd < TUNE.foulReach && dd < hd) { hd = dd; hit = q; }
    }
    if (hit) { p.fouledSlide = true; foulOn(p, hit); }
  }

  function playerStep(p, dt) {
    gaitStep(p, dt);
    slideFoul(p, dt);
    if (!(p.tackleT > 0)) p.fouledSlide = false;
    animStep(p, dt);
    p.coolT = Math.max(0, p.coolT - dt);
    p.hold = Math.max(0, p.hold - dt);
    if (p.tackleT > 0) {
      p.tackleT -= dt;
      p.vx *= 0.90; p.vy *= 0.90;
      p.legs = "slide";
      if (p.tackleT <= 0) p.coolT = TUNE.tackleCool;
    }
    var moved = len(p.vx, p.vy) * dt;
    p.x += p.vx * dt; p.y += p.vy * dt;
    p.x = clamp(p.x, PITCH.x0 - 4, PITCH.x1 + 4);
    p.y = clamp(p.y, PITCH.y0 - 10, PITCH.y1 + 10);
    footfall(p, moved);

    /* `legs` is down to two poses now. It used to name a frame of a
       four-frame pixel run cycle; the rig swings its own legs off a sine
       wave, so all the simulation still has to say is whether this
       player is on their feet or sliding. */
    if (p.tackleT <= 0) p.legs = len(p.vx, p.vy) > 6 ? "run" : "stand";
  }

  /* =======================================================================
     FOOTSTEPS, OFF THE GROUND COVERED RATHER THAN OFF A TIMER

     A step happens every stride, and a stride is a DISTANCE. Driven off
     a timer, a sprinting player and a walking one take steps at the
     same rate and the sound comes apart from the picture; driven off
     distance, sprinting speeds the steps up for free and pulling up
     slows them down, without a single line about either.

     What stops eight players turning it into a drum roll is not
     volume, it is a hearing distance. The camera is on the ball, so
     that is where the ear is: a step is loud if it is hers, audible if
     it is near the ball, and silent otherwise. On top of that there is
     one shared cooldown across the whole match, because two players in
     step with each other is a flam, and a flam is the one thing that
     makes a footstep sound like a sound effect.
     ======================================================================= */
  var STRIDE = 24;              // world units of ground per step
  var stepCool = 0;

  function footfall(p, moved) {
    if (!soundOn || p.gk || p.sentOff) return;
    if (G.state !== "play" && G.state !== "kickoff") return;
    if (moved < 0.05) { p.stride = 0; return; }
    p.stride = (p.stride || 0) + moved;
    if (p.stride < STRIDE) return;
    p.stride -= STRIDE;
    p.stepL = !p.stepL;
    if (stepCool > 0) return;
    /* how near the ear is. Hers is always heard; everybody else fades
       out over the width of a penalty area. */
    var vol;
    if (p === G.controlled) vol = 1;
    else {
      var d = dist(p, G.ball);
      if (d > 120) return;
      vol = 1 - d / 120;
      vol *= vol;
      if (vol < 0.06) return;
    }
    stepCool = 0.035;
    SFX.step(vol, p.stepL);
  }

  /* players do not stand inside each other */
  /* =======================================================================
     CONTACT

     What was here moved two overlapping players apart by teleporting
     them, in position, with no sound, no animation, no loss of pace and
     no consequence of any kind. Eight players could run through each
     other all match and the only evidence was that they never quite
     occupied the same pixel. That is the difference between a football
     match and eight sprites passing through one another on separate
     layers, and it is felt long before it is noticed.

     Three things happen when two players meet, and all three of them
     are visible:

       THE SHOVE. The push goes into VELOCITY, not just position, so
       running into somebody costs you pace and knocks you off your
       line. A position correction still happens, because two sprites
       cannot share a pixel, but it is now the small part.

       THE STUMBLE. Meet an opponent hard enough and the lighter of the
       two is off balance for a moment: he cannot accelerate, he plays
       the off-balance frames, and he has to recover. Which of the two
       stumbles is the shield stat, so Atlas and Boulder walk through
       people and Comet does not.

       THE BALL. A carrier caught side-on or front-on loses it. Caught
       from BEHIND he does not — that is what shielding is, and it is
       the reason keepReach has always been bigger than dribbleReach.
       Without this the shield stat had nothing to do in an actual
       collision; it only ever applied to a number.
     ======================================================================= */
  function separate(dt) {
    dt = dt || FIXED;
    for (var i = 0; i < G.players.length; i++) {
      for (var j = i + 1; j < G.players.length; j++) {
        var a = G.players[i], b = G.players[j];
        var dx = b.x - a.x, dy = b.y - a.y;
        var d = len(dx, dy);
        if (d > TUNE.bodyWidth || d === 0) continue;
        var overlap = TUNE.bodyWidth - d;
        dx /= d; dy /= d;

        /* how hard they came together: the closing speed along the line
           between them, which is zero for two players drifting apart */
        var closing = (a.vx - b.vx) * dx + (a.vy - b.vy) * dy;

        /* the shove — into pace, and only a little into position */
        var imp = Math.min(overlap * TUNE.bumpPush, closing > 0 ? closing * 0.5 : 6);
        if (!a.gk) { a.vx -= dx * imp; a.vy -= dy * imp; }
        if (!b.gk) { b.vx += dx * imp; b.vy += dy * imp; }
        var corr = overlap * 0.34;
        if (!a.gk) { a.x -= dx * corr; a.y -= dy * corr; }
        if (!b.gk) { b.x += dx * corr; b.y += dy * corr; }

        if (a.team === b.team || closing < TUNE.bumpHard) continue;
        if (a.gk || b.gk) continue;
        if ((a.bumpT || 0) > 0 || (b.bumpT || 0) > 0) continue;

        /* WHO COMES OFF WORSE. Strength decides it, with the closing
           speed as the stake — and a little luck, so the same two
           players do not produce the same result every time. */
        var sa = (a.mul || FLAT_MUL).shield * (0.82 + Math.random() * 0.36);
        var sb = (b.mul || FLAT_MUL).shield * (0.82 + Math.random() * 0.36);
        var loser = sa < sb ? a : b, winner = sa < sb ? b : a;
        loser.bumpT = TUNE.bumpStun;
        loser.skidT = Math.max(loser.skidT || 0, TUNE.bumpStun);
        winner.bumpT = TUNE.bumpStun * 0.4;
        SFX.bump(clamp(closing / 90, 0.3, 1));
        turfBurst((a.x + b.x) / 2, (a.y + b.y) / 2, 4);
        G.hitStop = Math.max(G.hitStop, TUNE.hitStopShot * 0.8);
        G.shake = Math.max(G.shake, 0.18);

        /* AND THE BALL, IF THE LOSER HAD IT.

           Only when the contact came from the side or the front. A
           shoulder in the back of a man shielding the ball is the one
           challenge that does not win it — which is the whole point of
           shielding, and the reason a strong player can hold the ball
           up with somebody leaning on him. */
        if (G.ball.owner === loser) {
          var toW = Math.atan2(winner.y - loser.y, winner.x - loser.x);
          var behind = Math.abs(Math.atan2(Math.sin(toW - loser.dir),
                                           Math.cos(toW - loser.dir)));
          if (behind < 2.0) {                      // not from directly behind
            G.ball.owner = null;
            G.ball.lock = TUNE.controlLock;
            G.ball.vx += dx * (sa < sb ? 1 : -1) * 34;
            G.ball.vy += dy * (sa < sb ? 1 : -1) * 34;
            SFX.touch();
          }
        }
      }
    }
    /* the stun runs down wherever it was set */
    for (var k = 0; k < G.players.length; k++) {
      var q = G.players[k];
      if (q.bumpT > 0) q.bumpT = Math.max(0, q.bumpT - dt);
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
  /* =======================================================================
     THE FOOTBALL

     What was here before worked, in the sense that a ball went in a net
     and a scoreline changed. It was not football. Three players stood
     on their formation marks; one of them — whoever happened to be
     nearest — sprinted at the ball; and the other two drifted along a
     line drawn between the ball and their own goal. Nobody marked
     anybody. Nobody covered anybody. A pass was thrown at whichever
     teammate scored best on a sum that never once asked whether there
     was an opponent standing in the way, so balls went straight THROUGH
     defenders several times a minute. Attack and defence were the same
     shape with a slightly different blend factor.

     A game of football is four things happening at once, and this is
     all four of them:

       SHAPE     — eleven (here, four) players holding relative
                   positions that slide together. The team moves as a
                   block toward the ball and up and down with it. The
                   block is the thing; individuals are offsets from it.
       PHASE     — the block is a different block when you have the ball
                   than when you do not. Attacking, it stretches: high
                   and wide, to make the pitch big. Defending, it
                   compresses: deep and narrow, to make the pitch small.
       JOBS      — out of possession exactly one player presses the ball
                   and exactly one covers behind them; everybody else
                   picks up an opponent and stays goal-side of him. In
                   possession one player carries and the others offer
                   themselves at different distances and angles.
       THE LANE  — a pass, a shot and a tackle are all a question about
                   the straight line between two points and who is
                   standing on it. Almost everything that reads as
                   "stupid" in a football game is a decision taken
                   without asking that question.

     Every number below is in the simulation's own units: the pitch is
     288 across and 404 long.
     ======================================================================= */

  /* ------------------------------------------------------- the geometry */

  /* HOW CLOSE THE NEAREST OPPONENT COMES TO A LINE.

     The one piece of arithmetic the old AI never did, and the reason it
     passed through people. Returns the perpendicular distance from the
     closest opponent to the segment a->b, but only counting opponents
     who are actually ALONGSIDE the segment — somebody standing behind
     the passer is not in the way of a ball going forwards. */
  function laneClear(team, ax, ay, bx, by, ignore) {
    var dx = bx - ax, dy = by - ay;
    var L2 = dx * dx + dy * dy;
    if (L2 < 1) return 999;
    var worst = 999;
    for (var i = 0; i < G.players.length; i++) {
      var o = G.players[i];
      if (o.team === team || o === ignore) continue;
      /* where along the segment this opponent is, 0 at a, 1 at b */
      var t = ((o.x - ax) * dx + (o.y - ay) * dy) / L2;
      if (t < 0.05 || t > 0.98) continue;
      var px = ax + dx * t, py = ay + dy * t;
      var gap = len(o.x - px, o.y - py);
      /* A DEFENDER IS WORTH MORE NEAR THE END OF THE PASS than near the
         start of it: he has longer to read it and gets there with the
         ball. The taper is what stops the AI threading everything
         through the eye of a needle at forty yards. */
      gap /= (0.55 + 0.45 * (1 - t));
      if (gap < worst) worst = gap;
    }
    return worst;
  }

  /* =======================================================================
     HOW GOOD A PLACE THIS IS TO HAVE THE BALL

     Everything an attacking side decides is a comparison between two
     positions, and for a long time the comparison here was "which one
     is nearer the opposition goal line". That single number is wrong in
     the one place it matters most. A player standing ON the byline, two
     yards from the corner flag, is nearer the goal line than a team-
     mate arriving at the penalty spot — so a cut-back, which is the
     best pass in football, scored NEGATIVELY and was never played.
     Measured: her side's carrier spent 1,098 frames of a half dribbling
     along the goal line with a shooting angle of nothing, refusing
     every pass, because every pass available to it "went backwards".

     Distance and CENTRALITY together are what make a chance. Both are
     needed, and they multiply rather than add: a yard from the line but
     out by the flag is worth almost nothing, and so is dead centre from
     sixty yards. The result is a number from 0 to 1 that the passing,
     the dribbling and the shooting all read, so all three of them agree
     about where they are trying to get the ball to.
     ======================================================================= */
  function threatAt(team, x, y) {
    var gy = goalY(team);
    var far = len(x - PITCH.cx, y - gy);
    var wide = Math.min(1, Math.abs(x - PITCH.cx) / (PITCH.w * 0.46));
    var near = clamp(1 - far / 250, 0, 1);
    return near * near * (0.30 + 0.70 * (1 - wide * wide));
  }

  /* is this player between the ball and their own goal? */
  function goalSide(p, of) {
    var d = attackDir(p.team);
    return (of.y - p.y) * d > 0;
  }

  /* WHERE THE TEAM'S BLOCK IS, as two numbers.

     `height` is how far up the pitch the whole shape has slid, as a
     fraction of its own half-to-half travel; `drift` is how far it has
     slid across toward the ball. Both come off the ball, because in
     football the ball is what everybody is positioned relative to —
     which is why a side with the ball on its own left touchline has its
     right back tucked inside, and why a team pinned in its own box has
     its striker on the edge of it. */
  /* WHOSE BALL IT IS, including while nobody is holding it.

     Used by the team shape AND by the job board, and it has to be the
     same answer in both or the two disagree: a side told it is
     attacking by one and defending by the other ends up with a striker
     holding a defensive line. */
  function ballHolder() { return G.ball.owner || G.ball.lastTouch || null; }

  function teamBlock(team) {
    var b = G.ball, d = attackDir(team), own = ownGoalY(team);
    /* how far up the pitch the ball is, from this team's point of view */
    var up = clamp((b.y - own) * d / PITCH.h, 0, 1);
    /* =====================================================================
       TRANSITION: A LOOSE BALL IS NOT THE OTHER TEAM'S

       Possession was a two-state question — either this side has the
       ball or it does not — and the whole of the team shape hangs off
       it. That was fine when the ball was welded to a foot and spent
       almost all of its time owned. With a touch dribble the ball is
       genuinely unowned for a good part of every passage, and in every
       one of those frames BOTH sides were told they were defending:
       both dropped, both held a line, nobody was attacking, and the
       marking assignments churned every time the ball came loose and
       was picked up again.

       Football's answer is that there are three phases, not two, and
       the third one is not "nobody's ball" — it is "whose ball is it
       ABOUT to be". The side that touched it last is still the side in
       possession as far as shape is concerned: they are the ones
       nearest it, facing the right way, expecting it. A tackle changes
       that instantly, because a tackle makes the tackler the last man
       to touch it — which is exactly right, and costs nothing to work
       out because the ball has carried `lastTouch` since it was
       written.
       ===================================================================== */
    var mine = !!(ballHolder() && ballHolder().team === team);
    /* IN POSSESSION THE BLOCK PUSHES UP AND STRETCHES; OUT OF IT, IT
       DROPS AND SQUEEZES. The two numbers are deliberately not
       symmetrical: a side defends deeper than it attacks high, because
       conceding is worse than not scoring. */
    var height = mine ? 0.10 + up * 0.62 : -0.06 + up * 0.44;
    /* AND IT DOES NOT SQUEEZE ITSELF SHUT.

       A side out of possession narrows, in eleven-a-side, because there
       are eight other players to cover the ground it gives up. With
       three outfielders there is nobody: narrowing takes a shape that
       was already only a third of the pitch wide and makes it a
       quarter, and three players inside a quarter of a pitch is the
       huddle she was looking at. It still narrows, by a little, because
       that is what defending is; it no longer collapses.

       `drift` is the same argument. Sliding the whole block a third of
       the way towards the ball's side, on top of a narrow shape, puts
       everybody in one corner of the pitch. */
    var width = mine ? 1.12 : 1.0;
    var drift = clamp((b.x - PITCH.cx) / (PITCH.w / 2), -1, 1) * (mine ? 0.18 : 0.24);
    /* THE DEFENSIVE LINE.

       A block whose depth comes only off the BALL sits where the ball
       is, which is not where the defending is done: with an attack
       camped on the edge of the box, the ball is deep but the runners
       are deeper, and a back line taking its cue from the ball ends up
       marking people from in front of them. Measured, markers were
       goal-side of their man a quarter of the time — worse than
       guessing, because the error is systematic.

       So the line also reads the DEEPEST OPPONENT, and never sits
       further from its own goal than he is. That one rule is what a
       defensive line is, and it is the difference between defending and
       following people about. */
    var deep = 1e9;
    G.players.forEach(function (o) {
      if (o.team === team || o.gk) return;
      var v = (o.y - own) * d;              // small = close to our goal
      if (v < deep) deep = v;
    });
    var lineUp = deep < 1e8 ? clamp((deep + 22) / PITCH.h, 0.05, 1) : 1;
    return { up: up, mine: !!mine, height: height, width: width,
             drift: drift, d: d, own: own, line: lineUp };
  }

  /* a player's place in the block: their formation slot, moved */
  function shapeTarget(p, blk) {
    var s = p.slot || SLOTS[p.role] || SLOTS.mid;
    var across = 0.5 + (s.across - 0.5) * blk.width + blk.drift * 0.5;
    var upF = clamp(s.up + blk.height, 0.02, 0.96);
    /* OUT OF POSSESSION, EVERYBODY HOLDS THE LINE.

       This used to exempt anybody whose formation slot was high up the
       pitch, on the reasoning that a striker should stay up for the
       counter. With four a side there is no such thing as a player who
       is not defending: all three outfielders are given a defensive job
       the moment the ball is lost, and the striker's slot — 0.70 in
       DIAMOND, 0.76 in WIDE — put him two hundred and eighty units from
       his own goal while he was supposedly marking somebody inside it.
       That one exemption was most of the goal-side failures, and it
       showed up as wild variation BETWEEN fixtures rather than as a
       steady error, because which formation a side happens to be
       playing decided whether it happened at all.

       The line stays permissive when it should: it is worked out from
       the deepest opponent, so while the other side is playing out from
       their own goal it is up around the halfway line and nothing is
       clamped at all. */
    /* A BLOCK HAS LAYERS. Clamping all three of them to the same line
       put them on one row of the pitch — measured at nearly nine per
       cent of frames with two team-mates inside a body's width, and it
       left the side attacking it no way through and no shots. Each
       player is held to the line PLUS a slice of his own slot depth, so
       the shape stays a back man, a middle man and a front man rather
       than a wall. */
    /* A QUARTER OF A SLOT'S DEPTH IS NOT A LAYER. At 0.26 the back man,
       the middle man and the front man were spread over a ninth of the
       pitch, which is one row with a rounding error in it. */
    if (!blk.mine) upF = Math.min(upF, blk.line + (s.up - 0.26) * 0.48);
    return {
      x: clamp(PITCH.x0 + across * PITCH.w, PITCH.x0 + 10, PITCH.x1 - 10),
      y: clamp(blk.own + blk.d * upF * PITCH.h, PITCH.y0 + 12, PITCH.y1 - 12),
    };
  }

  /* WHICH SIDE OF THE PITCH THIS PLAYER IS. Out of his own slot, so it
     does not change when the ball does. A slot in the middle has no
     side of its own, so it takes the one away from the ball — which is
     the original rule, kept for the one player it is right for. */
  function slotSide(p, ref) {
    var a = (p.slot || SLOTS[p.role] || SLOTS.mid).across;
    if (a < 0.44) return -1;
    if (a > 0.56) return 1;
    return (ref && ref.x) < PITCH.cx ? 1 : -1;
  }

  /* ------------------------------------------------------------ the jobs

     Worked out ONCE a frame for each side rather than once per player,
     because "am I the one pressing" is a question about the whole team
     and four players each answering it privately is how you get two
     pressers and no cover. */
  function assignJobs(team) {
    var b = G.ball;
    var carrier = b.owner;
    var holder = ballHolder();
    var mine = !!(holder && holder.team === team);
    var outs = [];
    G.players.forEach(function (q) {
      if (q.team !== team || q.gk || q.sentOff) return;
      q.job = null;
      outs.push(q);
    });
    if (!outs.length) return;

    if (mine) {
      /* IN POSSESSION: one short option, one wide option, one holding.

         Sorted by how far up they already are, so the runner is the one
         already highest rather than whoever the loop reached first —
         which is what stops a centre half being nominated to sprint in
         behind while the striker drops to take a square ball. */
      var d = attackDir(team);
      outs.sort(function (a, c) { return (c.y - a.y) * d; });
      /* IF IT IS LOOSE, SOMEBODY HAS TO GO AND GET IT — one somebody.
         The side in possession of a ball that is rolling free still
         holds its attacking shape; it just sends its nearest man to
         collect. Without this the shape was held by everybody and the
         ball was collected by nobody. */
      var fetch = carrier ? null : nearestTo(b, team, true);
      if (fetch === G.controlled) fetch = nearestTo(b, team, true, G.controlled);
      var n = 0;
      outs.forEach(function (q) {
        if (q === carrier) return;
        q.mark = null;
        if (q === G.controlled) { q.job = null; return; }
        if (q === fetch) { q.job = "chase"; return; }
        q.job = n === 0 ? "run" : (n === 1 ? "support" : "hold");
        n++;
      });
      return;
    }

    /* OUT OF POSSESSION: press, cover, and mark.

       The presser is the closest to the ball — but measured with a bias
       toward whoever is ALREADY goal-side of it, because a defender who
       has to run round the carrier to reach him is not closest in any
       sense that matters. */
    var target = carrier || b;
    var best = null, bs = 1e9, second = null, ss = 1e9;
    outs.forEach(function (q) {
      var c = len(q.x - target.x, q.y - target.y);
      if (!goalSide(q, target)) c += 26;
      if (q.coolT > 0) c += 30;
      if (c < bs) { second = best; ss = bs; best = q; bs = c; }
      else if (c < ss) { second = q; ss = c; }
    });
    /* HER TEAM NEVER PRESSES WITH THE PLAYER SHE IS DRIVING.

       It used to, and the effect was that the moment she took manual
       control of the nearest defender the AI kept giving that same
       defender the pressing job, so the two of them fought over the
       controls: she steered one way, the press steered the other, and
       what it felt like was a player refusing to move. */
    if (team === 0 && best === G.controlled) { best = second; second = null; }
    if (best) best.job = "press";
    outs.forEach(function (q) {
      if (q.job) return;
      /* THE ONE SHE IS DRIVING GETS NO JOB.

         She is excluded from think(), so a job given to her is a job
         nobody carries out — and worse, "mark" given to her left a
         stale man pinned to her forever, which the register that stops
         two defenders marking the same striker went on believing. */
      if (q === G.controlled) { q.job = null; q.mark = null; return; }
      q.job = q === second ? "cover" : "mark";
    });
    /* A MAN YOU ARE NO LONGER MARKING IS NOT YOUR MAN.

       `mark` was only ever written by the marking branch and never
       cleared, so a defender promoted to presser or cover carried his
       old mark around with him — and the register, which is what stops
       two defenders picking up the same striker, went on seeing that
       stale claim. Measured at 98% of defending frames with a
       duplicate in them. It is cleared where the job is decided,
       because that is the moment it stops being true. */
    var markers = [];
    outs.forEach(function (q) {
      if (q.job !== "mark") { q.mark = null; return; }
      markers.push(q);
    });
    assignMarks(team, markers);
  }

  /* WHERE A DEFENDER STANDS TO MARK A MAN: on the line between him and
     the goal being defended, a fraction of the way along it. Goal-side
     by construction, and tighter the nearer to goal he gets, because
     the line is short in the box and long at the halfway line. Both the
     job board and the defender himself have to agree on this point, or
     the assignment is optimising for somewhere nobody runs to. */
  function markSpot(team, o, along) {
    var ownGy = ownGoalY(team);
    return { x: o.x + (PITCH.cx - o.x) * along,
             y: o.y + (ownGy - o.y) * along };
  }
  var MARK_ALONG = 0.24;

  /* =======================================================================
     WHO PICKS UP WHOM IS A DECISION FOR THE WHOLE DEFENCE

     It used to be a decision each defender made for himself, twice a
     second, from a shared register of who had already been claimed —
     the most dangerous man nobody else had taken yet. That is a greedy
     algorithm whose answer depends on the order the defenders happen to
     think in, and its failure mode is not a slightly worse pairing. It
     is this:

       A's timer runs out first. He looks at the register, which does
       not yet contain B's man because B has not thought this frame, and
       takes him — he is the more dangerous of the two. B then thinks,
       finds his own man claimed, and takes A's. They have swapped. Half
       a second later they swap back.

     Measured, the mark changed hands 2.3 times a second, which with a
     half-second timer means essentially every re-pick handed the
     defender a different man. A defender who is given a new man twice a
     second never gets goal-side of any of them: he was 82 units from
     his marking position when he was on the wrong side of his man, and
     23 when he was on the right side. He was not being outrun — the
     markers were fractionally the FASTER of the two — and his aiming
     point was goal-side 100% of the time. He was simply never pointed
     at the same place for long enough to arrive.

     So the pairing is chosen for the side as a whole, once a frame, in
     the same place the pressing and covering jobs are. Four a side
     means at most three markers and three opponents, so every possible
     pairing can be tried and the cheapest taken — no greedy order to
     depend on, and the same input always gives the same answer, which
     is what actually stops the swapping.

     A marker keeps his man unless another pairing is better by a clear
     margin. That hysteresis is not a tie-break nicety: two pairings
     within a few units of each other alternate frame to frame on
     nothing but the players' own movement, and alternating is the whole
     disease.
     ======================================================================= */
  var MARK_STICK = 34;      // world units of "he is already on him"
  var MARK_NOBODY = 900;    // only when there are more markers than men

  function assignMarks(team, markers) {
    if (!markers.length) return;
    var opps = [];
    G.players.forEach(function (o) {
      if (o.team === team || o.gk || o.sentOff) return;
      opps.push(o);
    });
    if (!opps.length) { markers.forEach(function (q) { q.mark = null; }); return; }

    var own = ownGoalY(team);
    /* HOW MUCH IT COSTS TO LEAVE THIS MAN ALONE — closeness to the goal
       being defended, weighted toward the middle, because a man by the
       corner flag is not the one who scores. */
    var danger = opps.map(function (o) {
      var near = clamp(1 - Math.abs(o.y - own) / PITCH.h, 0, 1);
      var central = 1 - Math.min(1, Math.abs(o.x - PITCH.cx) / (PITCH.w * 0.5));
      return near * 150 * (0.55 + 0.45 * central);
    });
    var spot = opps.map(function (o) { return markSpot(team, o, MARK_ALONG); });
    /* what it costs THIS defender to take THAT man: how far he has to
       run to get goal-side of him, less how badly the man needs marking */
    var cost = markers.map(function (p) {
      return opps.map(function (o, j) {
        var c = len(p.x - spot[j].x, p.y - spot[j].y) - danger[j];
        if (p.mark === o) c -= MARK_STICK;
        return c;
      });
    });

    var bestPick = null, bestC = 1e18, used = [];
    var walk = function (i, acc, sum) {
      if (i === markers.length) {
        if (sum < bestC) { bestC = sum; bestPick = acc.slice(); }
        return;
      }
      for (var j = 0; j < opps.length; j++) {
        if (used[j]) continue;
        used[j] = 1; acc.push(j);
        walk(i + 1, acc, sum + cost[i][j]);
        acc.pop(); used[j] = 0;
      }
      /* more defenders than attackers: somebody has to mark space */
      if (opps.length < markers.length) {
        acc.push(-1);
        walk(i + 1, acc, sum + MARK_NOBODY);
        acc.pop();
      }
    };
    walk(0, [], 0);
    markers.forEach(function (p, i) {
      var j = bestPick ? bestPick[i] : -1;
      p.mark = j >= 0 ? opps[j] : null;
    });
  }

  /* =======================================================================
     ONE PLAYER, ONE FRAME
     ======================================================================= */
  /* A PLAYER WHO HAS BEEN SENT OFF IS NOT IN THE MATCH.

     Setting a flag is not enough on its own: he has to stop being
     counted as a team-mate to pass to, as a man to mark, as somebody
     who can take the ball, and as a candidate for the player she is
     driving. Every one of those is a separate list, which is why this
     is a function and not four scattered conditions. */
  function inPlay(q) { return !q.sentOff; }

  function think(p, dt) {
    if (p.sentOff) {
      /* he walks off the nearest touchline, and then he is scenery */
      var side = p.x < PITCH.cx ? PITCH.x0 - 14 : PITCH.x1 + 14;
      if (Math.abs(p.x - side) > 2) moveTo(p, side, p.y, dt, 0.5);
      else { p.vx *= 0.8; p.vy *= 0.8; }
      return;
    }
    /* her seven teammates play at a fixed, decent level; the opposition
       plays at the round's, scaled by the difficulty she chose */
    /* HOW WELL HER OWN TEAM-MATES PLAY.

       A flat 0.55 was below the quarter-final opponent's own rating and
       a long way below the final's, and it is read by everything an
       attacking player does: how far out they will shoot, how willing
       they are to try a ball in behind, how hard they press. She is
       driving one of four, so three quarters of her side was playing at
       a level she could not do anything about — and it showed up as her
       team taking a third of a shot a half while the other side took
       five times as many. Decent, and still short of the final's 0.80,
       which is what a final is for. */
    var skill = p.team === 0 ? 0.66 : G.skill;
    var b = G.ball;
    if (p.gk) return thinkKeeper(p, dt, skill);
    if (b.owner === p) return thinkCarrier(p, dt, skill);

    var blk = teamBlock(p.team);
    var home = shapeTarget(p, blk);

    if (blk.mine) return thinkAttack(p, dt, skill, blk, home);
    return thinkDefend(p, dt, skill, blk, home);
  }

  /* ---------------------------------------------------------- WITH IT */
  function thinkAttack(p, dt, skill, blk, home) {
    var b = G.ball, d = blk.d;
    /* WHAT THE SHAPE IS ARRANGED AROUND.

       This used to be the carrier, full stop, and dereferenced him
       without asking whether he existed — which was safe only while
       "our side is attacking" and "our side is holding the ball" were
       the same statement. They stopped being the same the moment a
       loose ball started counting as still ours, and the first match
       played after that threw on the first frame the ball came free.

       When somebody is on it, the shape is arranged around HIM. When it
       is rolling, it is arranged around the BALL — which is what a side
       breaking onto a loose ball actually does. */
    var car = b.owner || b;
    var tx = home.x, ty = home.y, urgency = 0.88;

    if (p.job === "chase") {
      /* the one sent to collect it: onto the ball, at pace, reading
         where it is going rather than where it is */
      var lead = 0.16;
      moveTo(p, clamp(b.x + b.vx * lead, PITCH.x0 + 6, PITCH.x1 - 6),
             clamp(b.y + b.vy * lead, PITCH.y0 + 6, PITCH.y1 - 6),
             dt, 1.04 * aiSprint(p, dist(p, b) > 26, dt));
      return;
    }

    if (p.job === "run") {
      /* THE RUN IN BEHIND, IN HIS OWN CHANNEL.

         This picked the channel off the CARRIER: whichever side of the
         pitch he was not on. Which sounds right and is the reason the
         team had no width at all. The carrier crosses the middle of the
         pitch several times a passage, and every time he does, the
         runner's channel flips and he sprints all the way across —
         so the player whose job is to give the side its width spends
         most of his time in the middle of it, running through.
         Measured, the striker's average position was five units from
         the centre spot when his slot asks for seventy-five.

         A footballer has a side. Taking it from his own slot makes it
         stable, gives the two of them one channel each without anybody
         having to coordinate, and means the pass into the channel is
         always to the same man rather than to whoever has just arrived. */
      var side = slotSide(p, car);
      tx = clamp(PITCH.cx + side * PITCH.w * 0.34 + blk.drift * 30,
                 PITCH.x0 + 14, PITCH.x1 - 14);
      ty = clamp(car.y + d * (54 + skill * 26), PITCH.y0 + 16, PITCH.y1 - 16);
      /* DO NOT RUN PAST THE LAST DEFENDER AND STAND THERE.

         There is no offside in this chapter — with four a side there
         could not be — but a striker who parks himself on the keeper's
         toes is both unpassable-to and, visually, a player who has
         given up. Held a few units behind the last man, he is always
         arriving rather than waiting. */
      var last = lastDefender(1 - p.team);
      if (last) {
        /* SHORT of him, not past him: `+ d * 10` put the limit ten
           units BEYOND the last defender, which is the opposite of what
           the comment above it says and the opposite of what is wanted */
        var limit = last.y - d * 10;
        if ((ty - limit) * d > 0) ty = limit;
      }
      /* a run in behind is a sprint by definition: it is an attempt to
         get somewhere before a defender does, and at jogging pace it is
         not a run in behind, it is standing in a different place */
      urgency = 1.0 * aiSprint(p, dist(p, car) > 30, dt);
    } else if (p.job === "support") {
      /* THE SHORT OPTION: level with the ball and a good way to the
         side of it, which is the pass that is always on and the reason
         a side under pressure can keep the ball at all. */
      /* SIX UNITS BEHIND HIM IS LEVEL WITH HIM. A supporting player
         standing level offers a sideways ball, which goes nowhere and
         keeps the whole side on one row of the pitch — measured, a team
         in possession occupied fifteen per cent of the pitch's length.
         An angle is the pass that is actually always on, and it is what
         gives the shape depth for free. */
      /* and the short option comes from HIS side too, half the way
         across to the ball: near enough to be a pass, far enough that
         the two of them are not in the same channel */
      var sx = (PITCH.cx + slotSide(p, car) * PITCH.w * 0.30 + car.x) / 2;
      tx = clamp(sx, PITCH.x0 + 14, PITCH.x1 - 14);
      ty = clamp(car.y - d * 26, PITCH.y0 + 16, PITCH.y1 - 16);
      urgency = 0.94;
      aiSprint(p, false, dt);
    } else {
      /* THE ONE WHO DOES NOT GO. Somebody has to be behind the ball
         when it is lost, and the whole of the counter-attack the other
         way depends on it. */
      /* Behind the ball, but not behind the keeper: a spare man on his
         own goal line is not covering anything, he is in the way. The
         depth is taken from the BALL when the ball is up the pitch and
         from the block when it is not, so the holding player drops as
         an attack goes forward and steps up when it comes back. */
      var back = clamp(car.y - d * 62, PITCH.y0 + 20, PITCH.y1 - 20);
      ty = (back + home.y) / 2;
      /* HE DOES NOT DRIFT INTO THE MIDDLE. Averaging his slot with the
         centre circle is what put the spare man on the same column as
         everybody else: the side that has just lost the ball then has
         its whole shape inside one corridor, which is a huddle with a
         tactical name on it. He keeps his own side and only leans in. */
      tx = tx * 0.78 + PITCH.cx * 0.22;
      urgency = 0.82;
      aiSprint(p, false, dt);
    }

    /* the spacing is moveTo's job now, so that no branch here and no
       branch added later can be the one that forgets it */
    moveTo(p, clamp(tx, PITCH.x0 + 8, PITCH.x1 - 8),
           clamp(ty, PITCH.y0 + 10, PITCH.y1 - 10), dt, urgency);
  }

  /* ------------------------------------------------------- WITHOUT IT */
  function thinkDefend(p, dt, skill, blk, home) {
    var b = G.ball, car = b.owner;
    var pm = p.mul || FLAT_MUL;
    var tx = home.x, ty = home.y, urgency = 0.9;

    if (p.job === "press") {
      /* CLOSING DOWN IS NOT SPRINTING AT SOMEBODY.

         A defender who runs flat out at a carrier arrives with no
         balance and gets turned; what a real one does is cover the
         ground fast and then SLOW as he arrives, staying on his feet
         and forcing play one way. The two-stage approach is also what
         makes a dribble feel like it is beating somebody rather than
         passing through them. */
      var tgt = car || b;
      var gap = dist(p, tgt);
      var lead = car ? 0.12 : TUNE.gkAnticipate * (0.8 + skill);
      var ax = tgt.x + (tgt.vx || 0) * lead;
      var ay = tgt.y + (tgt.vy || 0) * lead;
      if (car) {
        /* stand goal-side, a little off him, rather than on top of him */
        var d = attackDir(p.team);
        ay -= d * 7;
      }
      urgency = gap > 30 ? 1.06 + skill * 0.10 : 0.78;
      urgency *= aiSprint(p, gap > 46, dt);
      moveTo(p, ax, ay, dt, urgency);
      tryChallenge(p, skill, pm);
      return;
    }

    if (p.job === "cover") {
      /* BEHIND AND INSIDE THE PRESSER: the second defender's whole job
         is to be where the ball goes if the first one is beaten. */
      var ref = car || b;
      var dd = attackDir(p.team);
      /* Inside the presser, but not ON the centre spot. Covering at the
         exact middle of the pitch every time means the second defender
         has no side of his own either, and a back two that share one
         column are a back one. A third of his own shape keeps him where
         the ball is likely to be played, without taking him off the
         inside shoulder that is the whole job. */
      tx = ref.x * 0.34 + PITCH.cx * 0.34 + home.x * 0.32;
      ty = ref.y - dd * 34;
      /* never deeper than the block, or the cover becomes a spare
         defender standing on his own keeper */
      if ((ty - home.y) * dd < -46) ty = home.y - dd * 46;
      urgency = 0.96;
      /* cover does not sprint — holding a position IS the job — but its
         stamina still has to tick back up, or a player would come back
         from a spell of covering with an empty tank */
      aiSprint(p, false, dt);
    } else {
      /* MARKING: goal-side and a shoulder off him, not on top of him.
         Standing ON a striker means the first touch takes him past;
         standing between him and the goal means it does not. */
      /* WHO HE IS MARKING WAS DECIDED FOR THE WHOLE SIDE, in
         assignMarks, before anybody thought this frame. He does not get
         a say — that is the point of it; see the note there. */
      var m = p.mark && p.mark.team !== p.team && !p.mark.sentOff ? p.mark : null;
      if (m) {
        /* =============================================================
           MARKING IS A POSITION ON A LINE, NOT AN OFFSET FROM A MAN

           This nudged the defender sideways toward the middle and then
           put him a fixed number of units goal-side along y. Two things
           are wrong with a fixed offset. It is only goal-side while the
           man is running straight at the goal — turn him sideways and
           "goal-side along y" stops meaning anything at all. And it is
           the same distance whether he is on the halfway line or on the
           six-yard box, when the whole point of marking is that you get
           tighter the nearer to goal he gets.

           A defender stands ON the line between his man and the goal he
           is defending, a fraction of the way along it. That is
           goal-side BY CONSTRUCTION — no sign to get wrong, no axis to
           be turned off — and the fraction does the tightening for
           free, because the line is short in the box and long at the
           halfway line.

           Further along it when he has been got in front of, so he cuts
           back across rather than trailing a shoulder all the way to
           the area.
           ============================================================= */
        var behind = !goalSide(p, m);
        var spot = markSpot(p.team, m, behind ? 0.42 : MARK_ALONG);
        tx = spot.x;
        ty = spot.y;
        /* the block still pulls him sideways, because following a man
           into a corner should cost something — but barely along the
           axis that decides goal-side, because being dragged off his
           man's shoulder should not */
        tx = tx * 0.74 + home.x * 0.26;
        ty = ty * 0.94 + home.y * 0.06;
        /* the one moment a marker is allowed to run flat out is the one
           where he is on the wrong side of his man */
        urgency = behind ? 1.12 : 0.95;
        /* WHERE HE WANTED TO BE, kept so a harness can tell the two
           failure modes apart. A marker who is standing on his target
           and STILL the wrong side of his man has a target that is
           wrong; one who is nowhere near it cannot get there. Those
           want opposite fixes, and from the outside they look
           identical. */
        p.want = { x: tx, y: ty };
      }
      /* A LOOSE BALL IS NOT EVERYBODY'S.

         It used to be: any marker within thirty-four units of an
         unowned ball dropped his man and went for it. That was a fair
         rule when the ball was welded to a foot and "unowned" meant a
         pass in flight — a second or two a minute. Now that a dribble
         is a series of touches, the ball is genuinely unowned for a
         good part of every passage, and this rule fired constantly:
         three defenders converging on the same rolling ball, the shape
         gone, and two team-mates standing inside a body's width of each
         other for six per cent of the match.

         So a marker goes only for one that is nearly at his feet, and
         only when he is the closest man to it. The presser is already
         going; two men arriving at the same ball is one man wasted. */
      if (!car && dist(p, b) < 16 && nearestTo(b, p.team, true) === p) {
        tx = b.x + b.vx * 0.2; ty = b.y + b.vy * 0.2; urgency = 1.05;
      }
      /* A RECOVERY SPRINT WAS TRIED HERE AND MADE IT WORSE.

         The idea was obvious enough: a defender caught upfield when the
         ball turns over should sprint back behind the line rather than
         jog. Measured over six halves it moved markers from goal-side
         64% of the time to 58% — the opposite of the intent, and not by
         a little. Sprinting back overshoots the man, arrives with no
         balance, and spends the stamina that was going to be needed for
         the second run thirty seconds later, by which time he is slower
         than the striker he is supposed to be tracking. Jogging back in
         shape beats sprinting back out of it, which is also what any
         coach would have said. It is left recorded rather than deleted
         because it is the kind of change somebody will try again. */
      urgency *= aiSprint(p, !!(m && !goalSide(p, m) && dist(p, m) > 16), dt);
    }

    /* the spacing, and the marking caveat that goes with it, live in
       moveTo — see spaceOut */
    moveTo(p, clamp(tx, PITCH.x0 + 8, PITCH.x1 - 8),
           clamp(ty, PITCH.y0 + 10, PITCH.y1 - 10), dt, urgency);
    /* anybody within reach can have a go, not only the presser */
    if (car && dist(p, car) < TUNE.tackleReach * pm.tackle + 4) {
      tryChallenge(p, skill * 0.7, pm);
    }
  }

  /* the last outfielder of a side, from their own goal's point of view */
  function lastDefender(team) {
    /* THE LAST MAN IS THE ONE NEAREST HIS OWN GOAL, which the first
       version had exactly backwards: it returned whoever was furthest
       from it — the most ADVANCED player — so the runner in behind was
       being held level with the opposition's striker instead of their
       centre half, and ran straight through the back line. */
    var own = ownGoalY(team), best = null, bs = 1e9;
    G.players.forEach(function (o) {
      if (o.team !== team || o.gk) return;
      var v = Math.abs(o.y - own);
      if (v < bs) { bs = v; best = o; }
    });
    return best;
  }

  /* =======================================================================
     THE AI CAN RUN, AND IT CAN GET TIRED

     Stamina existed on every player and moved on exactly one of them:
     the one she was driving. Every other player on the pitch ran at the
     same speed for the whole match and could never go faster, which
     removes the single most dramatic thing in football — somebody
     getting back, or not getting back.

     Now the AI sprints, and only in the three places where a real
     player does: a defender who has been got in front of and has to
     recover, a presser closing a gap that is still big, and a chase for
     a ball nobody owns that the other side might reach first. Each of
     those is a moment where the alternative is losing something.

     It costs stamina at the same rate hers does, so it lasts about two
     seconds and then it is gone until they have jogged for a while.
     That is what stops it being a permanent speed increase: a side that
     presses flat out for a minute is a side with nothing left, which is
     the whole reason teams do not. */
  function aiSprint(p, want, dt) {
    if (want && p.stamina > 0.06) {
      p.stamina = Math.max(0, p.stamina - TUNE.sprintDrain * dt);
      /* HOW MUCH OF A GEAR IT ACTUALLY IS — and it is much less than
         her sprint, for a reason that only shows up in the arithmetic.

         The urgency multipliers this gets applied ON TOP OF are already
         doing most of the work: a presser closing from distance runs at
         1.16, which is 94 px/s against a carrier's 68 — already 1.4
         times the man on the ball, which is about what a recovering
         defender manages in life. Stacking her full 1.34 sprint on that
         came to 121 px/s, or 1.77 times the carrier, at which point a
         dribble cannot beat anybody and committing to a challenge costs
         nothing because you simply catch him again.

         A third of her sprint keeps the peak at about 1.4 times the
         carrier while still being a real decision: a twelve per cent
         gear for under two seconds, paid for with three and a half
         seconds of jogging. */
      return 1 + (TUNE.sprintMul - 1) * 0.35;
    }
    p.stamina = Math.min(1, p.stamina + TUNE.sprintFill * dt);
    return 1;
  }

  /* a small push away from the nearest teammate who is too close */
  function separation(p, want) {
    var sx = 0, sy = 0;
    for (var i = 0; i < G.players.length; i++) {
      var q = G.players[i];
      if (q === p || q.team !== p.team || q.gk) continue;
      var dx = p.x - q.x, dy = p.y - q.y;
      var dd = len(dx, dy);
      if (dd > want || dd < 0.01) continue;
      var f = (want - dd) / want * 32;
      sx += dx / dd * f; sy += dy / dd * f;
    }
    return { x: sx, y: sy };
  }

  /* WHETHER TO GO IN, AND WHETHER IT COMES OFF.

     A tackle is a gamble with a cooldown on it, which is what makes it
     a decision rather than a button. Going in from the side or from
     behind is harder than going in from in front, so the angle is part
     of the odds — and a defender who misses is out of the game for half
     a second, which is the punishment that makes dribbling mean
     something. */
  function tryChallenge(p, skill, pm) {
    var b = G.ball, car = b.owner;
    if (!car || car.team === p.team || p.coolT > 0 || p.tackleT > 0) return;
    var reach = TUNE.tackleReach * pm.tackle;
    var gap = dist(p, car);
    if (gap > reach + 5) return;
    /* face-on is a tackle; from behind it is a foul in a game that had
       fouls, and here it is simply much less likely to work */
    var toGoal = attackDir(car.team);
    var infront = (p.y - car.y) * toGoal > 0;
    var odds = (infront ? 0.85 : 0.45) * skill * pm.tackle;
    /* and the closer he is to being past you, the more you have to */
    if (gap < reach * 0.6) odds *= 1.4;
    /* HOW OFTEN A DEFENDER ACTUALLY GOES IN.

       At the first setting a defender inside reach committed roughly
       every four hundred milliseconds, which is not defending, it is a
       turnstile: measured over three halves the ball spent more than
       half of every one of them loose, possession ran at three seconds
       against fourteen, and no side ever strung anything together
       because nobody was allowed to keep the ball long enough to. A
       challenge is a decision with a cost — it is meant to be the thing
       that ENDS a passage of play, not the thing that happens during
       one. Halved, a carrier gets long enough to look up. */
    if (Math.random() < odds * TUNE.tackleUrge) startTackle(p);
  }

  /* ------------------------------------------------------- ON THE BALL */
  function thinkCarrier(p, dt, skill) {
    var mul = p.mul || FLAT_MUL;
    /* WHY A SIDE THAT HAS THE BALL DOES NOTHING WITH IT.

       Counted rather than guessed: a half in which her team held the
       ball for twenty-six seconds and had a third of a shot is a
       decision going wrong somewhere in this function, and there are
       only four places it can be. The counters cost a few increments a
       frame and they are the difference between fixing it and
       redecorating it. */
    var dbg = G.dbg || (G.dbg = [{}, {}]);
    var D = dbg[p.team];
    D.frames = (D.frames || 0) + 1;
    var gy = goalY(p.team), d = attackDir(p.team);
    var toGoal = Math.abs(p.y - gy);
    var press = nearestOpponent(p);
    var gap = press ? dist(press, p) : 999;
    var pressed = gap < 24;

    p.think = (p.think || 0) - dt;

    /* the super, if this side has one charged and this is the player to
       take it. Checked before the ordinary shot, because a captain in
       range with a full meter should never settle for a tap-in */
    if (aiWantsSuper(p, toGoal)) return unleash(p);

    /* ---- SHOOT.

       Three questions, in the order a footballer asks them: am I close
       enough, is the angle any good, and is there anybody in the way.
       The old version asked the first, approximated the second with a
       fixed corridor, and never asked the third — so the AI belted the
       ball into the back of a defender standing two feet in front of it
       several times a match. */
    /* HOW FAR OUT THEY WILL TRY ONE.

       Ninety-odd units was a range you could only reach by getting
       INSIDE the penalty area, and once the defending started working
       properly nobody reached it: a measured half had one side manage a
       single shot and the other none at all, with the man on the ball
       spending five hundred frames never closer than a hundred and
       thirty. A game of football with one shot in it is not a hard
       game, it is a dull one.

       Arcade football shoots from distance, and it should: a struck
       ball from thirty yards is a save, a rebound, a corner and a noise
       from the crowd, which is four things happening instead of none.
       Power is still what buys the extra range, so Atlas has a go from
       distance and Lumi carries it another ten yards first. */
    var range = (118 + skill * 62) * mul.power;
    var offCentre = Math.abs(p.x - PITCH.cx);
    /* the angle closes as you go wider AND as you get closer to the
       line, which is the real shape of a shooting chance */
    var angleOk = offCentre < 34 + toGoal * 0.42;
    if (toGoal < range) D.inRange = (D.inRange || 0) + 1;
    if (angleOk) D.angleOk = (D.angleOk || 0) + 1;
    if (toGoal < range && angleOk) {
      var lane = laneClear(p.team, p.x, p.y, PITCH.cx, gy, null);
      if (lane < 11) D.blocked = (D.blocked || 0) + 1;
      var want = 0.04 + skill * 0.10;
      if (toGoal < 74) want += 0.16;               // in the box, have a go
      else if (toGoal > 130) want *= 0.8;          // from range, a little less often
      if (lane < 11) want *= 0.12;                 // blocked: almost never
      if (pressed) want += 0.05;
      if (Math.random() < want) {
        var power = clamp(0.42 + toGoal / 190, 0.4, 1);
        D.shot = (D.shot || 0) + 1;
        return shoot(p, power);
      }
    }

    /* ---- PASS.

       Considered every frame rather than only when pressed, because a
       side that only passes when it is in trouble is a side that never
       builds anything. What stops it becoming a hot potato is that the
       pass has to actually BEAT the alternative of carrying. */
    if (p.think <= 0) {
      p.think = 0.1;
      var opt = bestPass(p, skill);
      D.look = (D.look || 0) + 1;
      if (opt) D.found = (D.found || 0) + 1;
      if (opt && opt.score > (pressed ? 8 : 30)) {
        D.pass = (D.pass || 0) + 1;
        return opt.through ? passInto(p, opt.mate, opt.tx, opt.ty)
                           : passTo(p, opt.mate);
      }
      if (opt) D.bestScore = Math.max(D.bestScore || -999, Math.round(opt.score));
    }

    /* ---- CARRY.

       Toward goal, away from the man in front, and toward the middle
       when wide — a winger cuts in, he does not run down the touchline
       into the corner flag and stop. */
    D.carry = (D.carry || 0) + 1;
    D.toGoal = Math.min(D.toGoal === undefined ? 1e9 : D.toGoal, Math.round(toGoal));

    /* =====================================================================
       A DRIBBLE IS AIMED AT A PLACE, NOT POINTED IN A DIRECTION

       "Forward, plus a nudge toward the middle" is a heading, and a
       heading has nowhere to arrive. Run it for long enough and the
       carrier reaches the goal line still going forward, at which point
       forward is into the hoardings — so he grinds sideways along the
       byline for the rest of the move. That is exactly what the
       counters caught him doing.

       Aimed instead at a POINT, the same run ends somewhere. Far out
       the point is straight up his own channel, because a winger in his
       own half should stay wide and keep the pitch big. As he gets
       closer it slides toward the near post, which is what cutting
       inside IS — and it happens by itself, out of one blend, rather
       than out of a special case for being in the box.
       ===================================================================== */
    var closeness = clamp(1 - toGoal / 165, 0, 1);
    var mouthX = PITCH.cx + clamp(p.x - PITCH.cx, -PITCH.goalW * 0.3, PITCH.goalW * 0.3);
    var aheadX = p.x, aheadY = p.y + d * 70;
    /* and never aim through the goal line: the deepest a dribble is
       ever trying to get to is the six-yard line */
    var mouthY = gy - d * PITCH.sixH * 0.7;
    var tgX = aheadX + (mouthX - aheadX) * closeness;
    var tgY = aheadY + (mouthY - aheadY) * closeness;
    tgY = clamp(tgY, PITCH.y0 + 6, PITCH.y1 - 6);

    var ux = tgX - p.x, uy = tgY - p.y;
    var ul = len(ux, uy) || 1;
    ux /= ul; uy /= ul;

    if (press && gap < 46) {
      var ax = p.x - press.x, ay = p.y - press.y;
      var ad = len(ax, ay) || 1;
      /* go PAST him rather than away from him: mostly sideways, only a
         little backwards, or every dribble ends up retreating */
      var side = ax >= 0 ? 1 : -1;
      ux += side * (1 - gap / 46) * 1.15;
      uy += (ay / ad) * 0.18 * (1 - gap / 46);
    }
    /* do not dribble into the touchline */
    if (p.x < PITCH.x0 + 26) ux += 0.6;
    if (p.x > PITCH.x1 - 26) ux -= 0.6;
    var m = len(ux, uy) || 1;
    driveP(p, ux / m, uy / m, dt, 1);
  }

  /* ---------------------------------------------------------- THE KEEPER */
  function thinkKeeper(p, dt, skill) {
    var b = G.ball, gl = ownGoalY(p.team), d = attackDir(p.team);
    var mul = p.mul || FLAT_MUL;
    if (G.ball.owner === p) {
      var kd = (G.dbg || (G.dbg = [{}, {}]))[p.team];
      kd.gkHold = (kd.gkHold || 0) + 1;
      if (p.hold <= 0) {
        var opt = bestPass(p, skill);
        var mate = (opt && opt.mate) || nearestTo(p, p.team, true);
        /* the throw, which is the animation he has never had: an
           overarm roll to a team-mate rather than the same side-foot
           pass every outfielder plays */
        setAnim(p, "throw", 0.42);
        if (mate) passTo(p, mate, true); else shoot(p, 0.6);
      }
      return;
    }

    /* NARROWING THE ANGLE.

       A keeper does not track the ball's x across his line; he stands
       on the line that bisects the angle the shooter can see, a few
       yards off his goal. Done as a straight x-follow — which is what
       was here — he is caught flat-footed by anything hit across him
       and stranded by anything from wide, because from wide the middle
       of the goal is not where the shot is going.

       So: take the line from the ball to the centre of the goal, and
       stand on it, `off` units out. That single change is most of what
       makes a keeper look like one. */
    var far = len(b.x - PITCH.cx, b.y - gl) || 1;
    var threat = Math.abs(b.y - gl) < PITCH.boxH * 1.5;
    var loose = !b.owner || b.owner.team !== p.team;
    /* how far off his line: further out as the ball gets closer, and a
       better keeper comes further (and gets back) */
    var off = clamp(5 + (1 - clamp(far / 150, 0, 1)) * 16, 5, 21) * mul.gk;
    var tx = PITCH.cx + (b.x - PITCH.cx) / far * off;
    var ty = gl + (b.y - gl) / far * off;
    /* never further across than his own post, and never off his line by
       more than the six-yard box unless he is coming to claim it */
    tx = PITCH.cx + clamp(tx - PITCH.cx, -PITCH.goalW * 0.62, PITCH.goalW * 0.62);
    /* HOW FAR OFF HIS LINE HE IS ALLOWED TO BE, measured as a distance
       OUT rather than as a range of y.

       Written as clamp(ty - gl, min(0, d*2), max(0, d*sixH)) this is
       correct for the side attacking up the pitch and nonsense for the
       other one: with d = -1 the two bounds come out as -2 and 0, so
       her keeper was clamped to within two units of his own goal line
       for the whole match. He could never come for a through ball,
       never claim a loose one in his six-yard box, and — measured over
       a half — never once ended up with the ball at his feet, while the
       keeper at the other end had it for a hundred and thirty frames.
       Signed axes are exactly where this kind of bug hides, so the
       distance out is worked out first and the sign is put back last. */
    var out = clamp((ty - gl) * d, -2, PITCH.sixH);
    ty = gl + d * out;

    /* COMING FOR IT. A loose ball inside the six-yard area is his, and
       a through ball rolling into the box with nobody on it is his too
       — that is the difference between a keeper and a cardboard cutout
       nailed to the line. */
    if (threat && loose && !b.owner) {
      var reach = Math.abs(b.y - gl) < PITCH.sixH * 1.5 &&
                  Math.abs(b.x - PITCH.cx) < PITCH.boxW * 0.5;
      var chaser = nearestTo(b, 1 - p.team, true);
      var theirs = chaser ? len(chaser.x - b.x, chaser.y - b.y) : 999;
      var mineDist = dist(p, b);
      if (reach && mineDist < theirs + 16 * mul.gk) {
        tx = b.x + b.vx * TUNE.gkAnticipate;
        ty = b.y + b.vy * TUNE.gkAnticipate;
      }
    }

    /* his legs are his defence stat and the difficulty setting, which is
       the honest way to make a keeper harder: a sharper one gets across
       his goal faster, not one who saves things he never reached */
    moveTo(p, tx, ty, dt, (TUNE.gkSpeed / TUNE.freeSpeed) * mul.gk * diff().gk);

    /* AND NO DIVE FROM HERE.

       A first pass at this had the keeper call startTackle on a shot
       inside his reach, on the grounds that the sprite sheet has a dive
       in it and nothing was playing it. Something already was: a keeper
       inside his own area is given a much longer reach than anybody
       else in resolvePossession, and when he claims a ball that was
       travelling he plays the dive and the save lands. Adding a second
       path did not add a save — it added a SLIDE TACKLE animation
       fighting the dive for the same frames, and a keeper carrying
       tackle physics away from the position he had just got himself
       into. The save belongs where possession is decided. */
  }

  function nearestTo(thing, team, outfieldOnly, except) {
    var best = null, bd = 1e9;
    G.players.forEach(function (p) {
      if (p.team !== team || p.sentOff) return;
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
      if (o.team === p.team || o.sentOff) return;
      var d = dist(o, p);
      if (d < bd) { bd = d; best = o; }
    });
    return best;
  }

  /* =======================================================================
     WHO TO GIVE IT TO

     The old version scored a teammate on three numbers: how far ahead
     of you he is, how much space he is in, and how far away. It never
     asked the only question that decides a real pass, which is whether
     anybody is standing on the line between the two of you — so the AI
     played balls straight through defenders all match, and the worst of
     them looked like cheating.

     It also only ever considered passing to a man's FEET. Half the
     passes in football are not to a man, they are into the space he is
     running into, and without that a side can never break a line.

     So each teammate is scored twice: once to his feet, once into the
     channel ahead of him. Both are checked against the lane. The best
     of the lot has to beat a threshold that depends on whether the
     carrier is actually in trouble, which is what stops a side with
     time on the ball hitting it sideways for ninety minutes.
     ======================================================================= */
  function bestPass(p, skill) {
    var d = attackDir(p.team), best = null;
    var gy = goalY(p.team);
    skill = skill === undefined ? 0.6 : skill;
    var pressed = nearestOpponent(p);
    var underIt = pressed && dist(pressed, p) < 24;

    G.players.forEach(function (m) {
      if (m === p || m.team !== p.team || m.gk || m.sentOff) return;
      var far = dist(m, p);
      if (far > 175 || far < 14) return;

      /* --- 1. to his feet */
      var lane = laneClear(p.team, p.x, p.y, m.x, m.y, m);
      var ahead = (m.y - p.y) * d;
      var mark = nearestOpponent(m);
      var space = mark ? Math.min(46, dist(mark, m)) : 46;
      /* WHAT THE PASS IS WORTH: how much better a chance the ball is in
         after it than before it. Measured on the threat map, so a
         cut-back from the byline to the penalty spot scores as the best
         ball on the pitch instead of as a backward pass. */
      var gain = (threatAt(p.team, m.x, m.y) - threatAt(p.team, p.x, p.y)) * 150;
      var feet = gain + space * 1.25 - far * 0.26
               + Math.min(lane, 40) * 1.5 - 30;
      /* a pass that has to beat somebody it cannot beat is not a pass */
      if (lane < 15) feet -= 140;
      if (ahead < -40 && gain < 4) feet -= 26;   // backwards, and no better
      if (feet > (best ? best.score : -1e9)) {
        best = { mate: m, score: feet, through: false };
      }

      /* --- 2. into the space in front of him.

         Aimed where he will be in about a second if he keeps running,
         clamped to stay on the pitch. Scored higher than his feet when
         it genuinely breaks a line, and refused when the ball would get
         there long before he does. */
      var tx = clamp(m.x + m.vx * 0.55, PITCH.x0 + 12, PITCH.x1 - 12);
      var ty = clamp(m.y + d * (30 + skill * 22), PITCH.y0 + 14, PITCH.y1 - 14);
      var tlane = laneClear(p.team, p.x, p.y, tx, ty, m);
      var trun = len(tx - m.x, ty - m.y);
      if (tlane >= 15 && trun < 64) {
        var tgain = (threatAt(p.team, tx, ty) - threatAt(p.team, p.x, p.y)) * 165;
        var thru = tgain + Math.min(tlane, 44) * 1.35
                 - len(tx - p.x, ty - p.y) * 0.22 - 24;
        /* a through ball is a skill: the worse the passer, the less
           often it is even considered */
        thru *= 0.55 + skill * 0.7;
        if (thru > (best ? best.score : -1e9)) {
          best = { mate: m, score: thru, through: true, tx: tx, ty: ty };
        }
      }
    });

    /* THE BALL BACK TO THE KEEPER. Only when there is genuinely nothing
       else, because a side that does it often is a side that looks
       frightened — but a side that never does it is a side that gives
       the ball away on its own six-yard line. */
    if ((!best || best.score < 0) && underIt) {
      var gk = null;
      G.players.forEach(function (m) { if (m.team === p.team && m.gk) gk = m; });
      if (gk && dist(gk, p) < 130 &&
          laneClear(p.team, p.x, p.y, gk.x, gk.y, gk) > 13) {
        best = { mate: gk, score: 6, through: false };
      }
    }
    return best;
  }

  /* a ball played into space rather than at a man */
  function passInto(p, mate, tx, ty) {
    var mul = p.mul || FLAT_MUL;
    var ang = Math.atan2(ty - p.y, tx - p.x);
    ang += (Math.random() - 0.5) * (TUNE.passErr / mul.aim) * 0.8;
    var far = len(tx - p.x, ty - p.y);
    /* weighted so it ARRIVES rather than running through to the keeper:
       a through ball hit at passing pace is a goal kick */
    var sp = clamp(far * 1.55, 90, TUNE.passSpeed * 1.15);
    kickBall(p, ang, sp, 0);
    setAnim(p, "pass", 0.28);
    G.stat.passTry[p.team]++;
    SFX.pass();
  }

  /* =======================================================================
     WHERE A MOVING MAN WILL BE WHEN THE BALL GETS THERE

     A fixed three tenths of a second of lead is right for exactly one
     distance and wrong for every other. A five-yard square ball arrives
     in a fifth of a second and is thrown a third of a second in front
     of its target; a forty-yard diagonal takes most of a second and is
     thrown the same third, so it lands well behind a sprinting winger.
     With the ball welded to the foot none of that mattered, because
     "arriving" meant the receiver walking into a nine-unit circle and
     the ball snapping to him. With a free ball it is the whole
     difference between a pass completed and a pass rolling into space.

     So the lead is SOLVED. Two things make that more than dividing
     distance by speed:

       the ball SLOWS DOWN. Ground friction is a constant proportion
       per second, so distance covered is v0 * (1 - drag^t) / -ln(drag)
       — which inverts to give the time exactly, and which is about a
       quarter longer than the naive answer at passing range.

       the answer MOVES THE TARGET, which changes the distance, which
       changes the answer. One refinement pass is enough at these
       speeds; a second changes the aim by less than a pixel.
     ======================================================================= */
  var DRAG_L = -Math.log(TUNE.ballDrag);       // 0.1508 for drag 0.86

  /* how long a ball struck at v0 takes to cover D on the deck, or -1 if
     it never gets there at all */
  function ballTime(D, v0) {
    var arg = 1 - D * DRAG_L / v0;
    if (arg <= 0.02) return -1;                // it stops short
    return Math.log(arg) / -DRAG_L;
  }

  /* where to aim to meet `mate`, and how hard */
  function leadPass(p, mate, mul) {
    var tx = mate.x, ty = mate.y, sp = 0, t = 0;
    for (var i = 0; i < 2; i++) {
      var D = len(tx - p.x, ty - p.y);
      sp = clamp(D * 1.9, 95, TUNE.passSpeed * 1.35);
      t = ballTime(D, sp);
      /* if it cannot reach, hit it as hard as the pass allows and take
         the time that gives — a ball that stops short is still a pass,
         it is just a poor one */
      if (t < 0) { sp = TUNE.passSpeed * 1.35; t = D / sp * 1.5; }
      tx = mate.x + mate.vx * t;
      ty = mate.y + mate.vy * t;
    }
    return { x: clamp(tx, PITCH.x0 + 4, PITCH.x1 - 4),
             y: clamp(ty, PITCH.y0 + 4, PITCH.y1 - 4), sp: sp };
  }

  function passTo(p, mate, soft) {
    var mul = p.mul || FLAT_MUL;
    var aim = leadPass(p, mate, mul);
    var tx = aim.x, ty = aim.y;
    var ang = Math.atan2(ty - p.y, tx - p.x);
    /* and it does not go exactly where it was aimed. A pass from Lumi
       arrives at a foot; a pass from Boulder arrives in the general
       area. Without this, skill 93 and skill 62 pass identically. */
    ang += (Math.random() - 0.5) * (TUNE.passErr / mul.aim);
    kickBall(p, ang, soft ? aim.sp * 0.8 : aim.sp, 0);
    /* a keeper rolling it out is already playing his own animation and
       must not have it replaced by an outfielder's side-foot */
    if (!(p.gk && p.anim && p.anim.state === "throw")) setAnim(p, "pass", 0.28);
    G.stat.passTry[p.team]++;
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
    /* AND DISTANCE IS PART OF ACCURACY.

       Long shots were made more common so that a half has some football
       in it — saves, rebounds, corners, a noise from the crowd — but a
       thirty-yarder that is as accurate as a tap-in makes every other
       kind of attack pointless. The scatter grows with the range, so
       the long ones are worth trying and mostly worth saving. */
    var toGoal = Math.abs(p.y - gy);
    var spread = (TUNE.shotSpread / mul.aim) * (1 + clamp(toGoal / 240, 0, 1) * 0.85);
    var aimX = PITCH.cx + (Math.random() - 0.5) * PITCH.goalW * spread;
    var ang = Math.atan2(gy - p.y, aimX - p.x);
    var sp = (TUNE.shotMin + (TUNE.shotMax - TUNE.shotMin) * power) * mul.power;
    kickBall(p, ang, sp, power * TUNE.shotLift * 46, p);
    setAnim(p, "kick", 0.34);
    G.stat.shots[p.team]++;
    /* a shot is the moment a crowd comes up off its seat, whoever took
       it — the sharp intake before it is a goal or it is not */
    crowdPush(p.team === 0 ? 0.42 : 0.24);
    addHeart(p.team, TUNE.heartShot);
    SFX.shot();
    crowdSwell(0.03, 0.8);
    /* a struck ball stops the world for a couple of frames and kicks up
       the turf under the standing foot. Less than a tackle: a shot is a
       connection, a tackle is a collision. */
    G.hitStop = Math.max(G.hitStop, TUNE.hitStopShot);
    G.shake = Math.max(G.shake, 0.22 + power * 0.3);
    turfBurst(p.x, p.y, 5, ang + Math.PI);
  }

  /* =======================================================================
     WHAT COMES OFF THE PITCH

     Grass. A slide tackle, a hard turn and a goalkeeper going down all
     tear the surface, and a few dozen two-pixel flecks thrown up and
     forward is the whole of it. They are the only thing in the match
     that tells you the players are standing ON something rather than
     in front of it.

     They live on the renderer's own bead list, so they sort by depth
     along with everybody else and a divot thrown up at the far post
     goes behind the players in front of it instead of over them.
     ======================================================================= */
  function turfBurst(x, y, n, ang) {
    if (!R2 || !R2.turf) return;
    /* the angle arrives in the simulation's frame, where y grows DOWN
       the pitch, and leaves in the renderer's, where it grows up */
    R2.turf(wX(x), wY(y), n, ang === undefined ? undefined : -ang);
  }

  /* =======================================================================
     A FOUL

     A sliding tackle that missed the ball and went through the player
     was free. Nothing happened: no whistle, no restart, no record of it,
     and the man who had just been taken out got up and carried on. That
     is the single largest rule of football simply absent, and its
     absence is felt as a kind of weightlessness — challenges have no
     downside, so going to ground is always correct.

     The test is the one a referee uses: did he get the ball. If the
     tackle wins it, it is a tackle however hard it was. If it misses
     and catches a man, it is a foul, and how bad a foul depends on the
     two things that decide it in life — how fast he went in, and
     whether he could see what he was doing it to.

     Cards are deliberately hard to earn. Four a side means sending
     somebody off is close to deciding the match, so it takes a genuinely
     reckless one, or a second booking.
     ======================================================================= */
  function foulOn(offender, victim) {
    if (!victim || G.state !== "play") return;
    var speed = len(offender.vx, offender.vy);
    /* from behind is worse, because he never saw it coming */
    var toO = Math.atan2(offender.y - victim.y, offender.x - victim.x);
    var behind = Math.abs(Math.atan2(Math.sin(toO - victim.dir),
                                     Math.cos(toO - victim.dir))) > 2.0;
    var bad = speed > TUNE.foulHard && behind;

    offender.fouls = (offender.fouls || 0) + 1;
    G.stat.fouls[offender.team] = (G.stat.fouls[offender.team] || 0) + 1;
    offender.coolT = Math.max(offender.coolT || 0, TUNE.tackleCool * 1.6);
    victim.bumpT = Math.max(victim.bumpT || 0, TUNE.bumpStun);
    victim.skidT = Math.max(victim.skidT || 0, TUNE.bumpStun);
    turfBurst(victim.x, victim.y, 9);
    G.hitStop = Math.max(G.hitStop, TUNE.hitStopTackle);
    G.shake = Math.max(G.shake, 0.5);
    SFX.bump(1);

    /* the card, if it has been earned */
    var card = null;
    if (bad) {
      offender.yellow = (offender.yellow || 0) + 1;
      card = offender.yellow >= 2 ? "red" : "yellow";
      if (card === "red") offender.sentOff = true;
    }
    if (card) {
      G.card = { p: offender, kind: card, t: 0 };
      uiSayLive(offender.name + ", " + (card === "red" ? "sent off." : "booked."));
      announceCard(offender, card);
      crowdSwell(0.10, 1.6);
      SFX.book(card === "red");
    }
    setPiece("free", victim.team, 0, null, { x: victim.x, y: victim.y });
  }

  function startTackle(p) {
    p.tackleT = TUNE.tackleTime;
    setAnim(p, "slide", TUNE.tackleTime + 0.12);
    var b = G.ball;
    var reach = TUNE.tackleReach * (p.mul || FLAT_MUL).tackle;
    p.wonTackle = false;
    if (dist(p, b) < reach && b.owner && b.owner.team !== p.team) {
      p.wonTackle = true;
      var ang = Math.atan2(b.y - p.y, b.x - p.x);
      b.owner = null; b.lastTouch = p; b.lock = TUNE.controlLock;
      b.vx = Math.cos(ang) * TUNE.tacklePush;
      b.vy = Math.sin(ang) * TUNE.tacklePush;
      addHeart(p.team, TUNE.heartTackle);
      SFX.tackle();
      /* the three things that make a challenge land: the world stops,
         the frame kicks, and the pitch comes up where the studs went in */
      G.hitStop = Math.max(G.hitStop, TUNE.hitStopTackle);
      G.shake = Math.max(G.shake, 0.45);
      turfBurst(p.x, p.y, 10, ang);
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
        /* bestPass RETURNS AN OPTION, NOT A PLAYER.

           It used to return the team-mate itself, and when it was
           rewritten to return { mate, score, through, tx, ty } every
           call site was updated except this one — the only one a human
           ever reaches. So her tap-to-pass has been handing passTo an
           object with no x and no vx, which arrives at Math.atan2(NaN)
           and sends the ball nowhere at all. The AI's passing was fine
           and hers was silently broken, which is exactly the shape of
           bug an AI-only harness cannot see. */
        var opt = bestPass(p);
        if (opt && opt.mate) {
          if (opt.through) passInto(p, opt.mate, opt.tx, opt.ty);
          else passTo(p, opt.mate);
        } else shoot(p, 0.4);
      } else {
        shoot(p, clamp(IN.heldT / TUNE.chargeTime, 0.25, 1));
      }
    } else if (IN.heldT < 0.22 && p.coolT <= 0 && p.tackleT <= 0) {
      startTackle(p);
    }
    IN.heldT = 0;
  }

  function controlStep(dt) {
    if (AUTOPLAY) return;
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
  /* =======================================================================
     WHAT THE CROWD IS FEELING, AS ONE NUMBER

     Nought is a ground waiting for something to happen and one is the
     ground the moment a goal goes in. Everything visible and everything
     audible hangs off it — the sway, the brightness, how far forward
     they are leaning, and which layers of the chant are playing — so
     that the two can never disagree. A stand that looks roused while it
     sounds bored is worse than one that does neither.

     It has a floor it settles back to (the ground's own `energy`, so a
     full house hums louder than an empty one before anybody has
     kicked anything), a target the match keeps pushing, and a rise that
     is faster than its fall — which is what a crowd does. They come up
     in a second and take ten to come down.
     ======================================================================= */
  var CROWD_E = { now: 0.25, target: 0.25, spike: 0, hush: 0 };

  function crowdBase() {
    var v = VEN.cur || {};
    return v.energy === undefined ? 0.26 : v.energy;
  }

  /* an event pushes it up for a moment: a shot, a tackle in the box, a
     near miss. `hush` is the opposite and is what an away goal does. */
  function crowdPush(amount) {
    CROWD_E.spike = Math.min(1, CROWD_E.spike + amount);
  }
  function crowdHush(amount) {
    CROWD_E.hush = Math.min(1, CROWD_E.hush + amount);
  }

  function crowdEnergyStep(dt) {
    /* HELD, for a harness. You cannot listen to a mixer from a test, so
       a test has to be able to put the ground at a given energy and
       read the faders — and it cannot do that while the match is
       writing over the value sixty times a second. */
    if (CROWD_E.hold) {
      if (R2 && R2.setEnergy) R2.setEnergy(CROWD_E.now);
      if (window.CupChant) window.CupChant.energy(CROWD_E.now, matchPhase());
      return;
    }
    var base = crowdBase();
    var t = base;
    if (G && G.state === "play") {
      /* HOW NEAR SOMEBODY IS TO SCORING is most of what a crowd
         responds to, and it is a question about the BALL rather than
         about possession: a ball in your box is frightening whoever
         put it there. */
      var d0 = Math.abs(G.ball.y - ownGoalY(0)) / PITCH.h;
      var d1 = Math.abs(G.ball.y - ownGoalY(1)) / PITCH.h;
      var near = 1 - Math.min(d0, d1);            // 1 at either goal
      t += Math.max(0, near - 0.55) * 1.35;
      /* and the home end lifts more when it is THEIR attack */
      var hold = ballHolder();
      if (hold && hold.team === 0 && d1 < 0.4) t += 0.12;
      /* a close game late is its own kind of noise */
      var late = G.clock / TUNE.halfSeconds;
      if (G.half === 2 && late > 0.7 && Math.abs(G.score[0] - G.score[1]) <= 1) {
        t += 0.10 + (late - 0.7) * 0.5;
      }
    } else if (G && (G.state === "goal" || G.state === "replay")) {
      t = 0.55;
    }
    CROWD_E.target = clamp(t, 0, 1);

    /* the spike and the hush both decay, and the spike decays slower
       because a roar hangs about and a hush does not */
    CROWD_E.spike = Math.max(0, CROWD_E.spike - dt * 0.55);
    CROWD_E.hush = Math.max(0, CROWD_E.hush - dt * 0.8);

    var want = clamp(CROWD_E.target + CROWD_E.spike - CROWD_E.hush, 0, 1);
    /* UP FAST, DOWN SLOW — a crowd rises in a second and takes ten to
       settle, and getting that backwards makes every reaction feel
       like a light switch */
    var k = want > CROWD_E.now ? 1 - Math.pow(0.02, dt) : 1 - Math.pow(0.55, dt);
    CROWD_E.now += (want - CROWD_E.now) * k;

    if (R2 && R2.setEnergy) R2.setEnergy(CROWD_E.now);
    if (window.CupChant) window.CupChant.energy(CROWD_E.now, matchPhase());
  }

  /* what the chant needs to know beyond the number */
  function matchPhase() {
    if (!G) return "idle";
    if (G.state === "goal" || G.state === "replay") return "goal";
    if (G.state === "kickoff") return "kickoff";
    if (G.state === "half" || G.state === "full") return "break";
    return "play";
  }

  function step(dt) {
    if (!G) return;
    G.stateT += dt;
    /* the one shared gap between any two footsteps — see footfall */
    stepCool = Math.max(0, stepCool - dt);
    /* the card runs on the MATCH clock, so it holds still through
       hit-stop and slow motion like everything else that is part of the
       moment rather than part of the interface */
    if (G.card) {
      G.card.t += dt;
      if (G.card.t > 2.4) G.card = null;
    }
    if (G.pa) {
      G.pa.t += dt;
      if (G.pa.t > 3.5) G.pa = null;
    }
    G.shake = Math.max(0, G.shake - dt * 3);
    G.flash = Math.max(0, G.flash - dt * 2.2);

    if (G.state === "kickoff") {
      if (G.stateT > TUNE.kickoffWait) {
        G.state = "play"; G.stateT = 0;
        SFX.whistle();
      }
    } else if (G.state === "goal") {
      /* THE CUT TO THE REPLAY, once the first beat of the celebration
         has been allowed to land. Cutting instantly is a game that will
         not let you enjoy anything; cutting after the whole celebration
         is a game that shows you something you have stopped caring
         about. */
      if (!G.over && !G.replayed && G.stateT > TUNE.goalCheer * 0.42) {
        G.replayed = true;
        if (replayStart()) return;
      }
      if (G.stateT > TUNE.goalCheer && !G.over) {
        setCamMode("play");
        resetPositions(G.kickoffTeam);
        G.state = "kickoff"; G.stateT = 0;
        G.superGoal = null;
        clearBanner();
      }
    } else if (G.state === "set") {
      /* a restart runs the clock: it is a stoppage in the match, not a
         stoppage in the world */
      G.clock += dt;
      setStep(dt);
      /* placeCamera, not cameraStep: cameraStep only moves the legacy
         G.cam.y and does not touch the renderer's camera at all, so a
         restart left the frame wherever the last passage of play had
         abandoned it */
      placeCamera(dt, false);
      return;
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

    if (G.state === "replay") {
      replayStep(dt);
      placeCamera(dt, false);
      return;
    }

    if (G.state === "play" || G.state === "goal") {
      if (G.state === "play") replayRecord(dt);
      if (G.state === "play") {
        controlStep(dt);
        /* THE JOBS ARE A TEAM DECISION, SO THEY ARE TAKEN ONCE.

           Who presses, who covers and who picks up whom are questions
           about the whole side; four players each answering them
           privately is how a defence ends up with two men on the ball
           and nobody in front of the goal. Taken here, before anybody
           thinks, both sides get exactly one presser, exactly one
           cover, and one man each to pick up. */
        assignJobs(0); assignJobs(1);
        G.players.forEach(function (p) { if (p !== G.controlled) think(p, dt); });
        /* A LOOSE BALL IS NOT POSSESSION, AND CERTAINLY NOT HERS.

           This read "credit the owner's team, or team 0 if there is no
           owner" — so every second the ball spent rolling loose, in the
           air, or going out for a rebound was added to HER side's
           possession. A half in which her team touched the ball for
           four seconds came out as twenty-seven seconds of possession
           on the scoreboard, which made the one statistic that could
           have shown the problem report the opposite of it. */
        if (G.ball.owner) G.stat.poss[G.ball.owner.team] += dt;
        else G.stat.loose = (G.stat.loose || 0) + dt;
      } else {
        celebrate(dt);
      }
      G.players.forEach(function (p) { playerStep(p, dt); });
      separate(dt);
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
    /* the crowd stays; the score comes up underneath it with the first
       phrase of the theme and nothing else, which is what a ground
       sounds like fifteen minutes into a break */
    scoreCue("half");
    /* the broadcast furniture goes while the card is up: a card about
       the half is not improved by the clock and the meter sitting on
       top of it */
    if (EL["cup-hud"]) EL["cup-hud"].hidden = true;
    if (EL["cup-pad"]) EL["cup-pad"].hidden = true;
    cardScreen({
      name: "half", kicker: "45'", title: "HALF TIME",
      action: "PLAY THE SECOND HALF",
      onGo: function () {
        menuMusic(false);
        G.half = 2; G.kickoffTeam = 1;
        resetPositions(G.kickoffTeam);
        G.state = "kickoff"; G.stateT = 0;
        setCamMode("play");
        uiClose();
        if (EL["cup-hud"]) EL["cup-hud"].hidden = false;
        if (EL["cup-pad"]) EL["cup-pad"].hidden = false;
      },
      body: function (bx, by, bw) {
        by = cardScore(bx, by, bw);
        return cardStats(bx, by + 4, bw);
      },
    });
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
    /* HOW FAR AHEAD OF THE BALL IT LOOKS, in seconds of the ball's own
       travel. Nearly half a second was enough that a ball struck hard
       threw the camera most of a screen ahead of the play and then
       dragged it back when the ball was cut out — the frame lurched
       twice for every clearance. */
    lead: 0.22,
    /* and however long that is, it is never worth more than this many
       SCREEN pixels. The lead is there to stop the play running into
       the edge of the frame, and once it is doing that, more of it buys
       nothing and costs composure. Clamped in screen space rather than
       world space because that is where the problem is: at zoom 2 a
       world unit is twice as many pixels and an unclamped lead throws
       the camera twice as far. */
    leadMax: 40,
    /* THE DEADZONE. The camera does not move at all while the thing it
       is watching is inside this box, in screen pixels, around where it
       is already looking. Without one, every touch of the ball moves
       the frame: a player jinking on the spot makes the whole stadium
       wobble, and a pixel game has nowhere to hide that because the
       stand and the markings are full of straight lines. */
    dead: [40, 28],
    /* how much of the remaining distance it closes each sixtieth of a
       second. Expressed per FRAME rather than per second because that
       is how it is read and tuned, and converted once, below. */
    smooth: 0.10,
    ease: 3.2,
    /* HOW FAR BEHIND THE ACTION THE CAMERA'S NEAR EDGE SITS, in the
       simulation's own units. The whole frame hangs off this one
       number, and the first guess of 26 put the player being driven at
       230 pixels down a 270-pixel screen — standing on the HUD, with
       everything behind her off the bottom of the frame. Eighty-two
       puts her two thirds of the way down, which is where a camera
       following somebody actually holds them. */
    trail: 82,
    /* HOW FAR OFF THE TOUCHLINE THE SIDE-ON CAMERA SITS.

       The one number that decides everything about the side view: how
       much of the pitch's length is in shot, how big the players are,
       and how much the near and far touchlines differ in size. Bigger
       is more pitch and smaller players.

       28 is measured rather than chosen: it is the stand-off at which
       the near touchline lands 12 per cent up from the bottom of the
       frame and the far one 41 per cent down from the top, so the
       pitch itself fills the middle half of the picture with the crowd
       above it and a band of foreground grass below. At 150 — the
       first guess — two fifths of the screen was featureless grass in
       front of the near touchline. */
    sideBack: 28,
    /* HOW FAR PAST A GOAL LINE THE SIDE-ON FRAME MAY LOOK. Enough to
       see the net and the goal-end boards, not enough to turn the
       stand behind them into a diagonal across the picture.

       It also decides how far out toward the edge the goalmouth ends
       up: the frame is about 106 units of pitch wide either side of
       the camera, so at 34 the goal sat 68 per cent of the way to the
       edge and a shot on it was half off the screen. 60 brings it to
       43 per cent — toward the side of the picture, where television
       puts it, and still comfortably inside. */
    sideOver: 60,
  };
  /* The portrait. `ndc` is where across the frame the subject stands:
     0 is dead centre, +1 is the right edge. */
  var CAMHERO = { ndc: 0.30 };
  function shadowSpan() {}          // there is no shadow map any more

  /* =======================================================================
     THE REPLAY

     A goal went in, the crowd made a noise, and the game cut straight to
     a kick-off. Every football game ever made shows it to you again,
     and the reason is not nostalgia — it is that a goal happens in
     about a fifth of a second, usually while the camera is following
     the ball rather than the finish, and you frequently do not actually
     SEE the thing that just happened to you.

     Recording it costs almost nothing. The whole of a match frame, for
     this purpose, is where nine things are and which picture each of
     them is showing: nine little records, thirty times a second, for
     three seconds. Two and a half thousand numbers.

     Playing it back costs nothing at all, because the simulation is
     already stopped during a celebration — so the buffer is written
     straight into the live players and the ordinary draw runs over the
     top of it. No second rendering path, no chance of the replay and
     the match disagreeing about how anything looks.
     ======================================================================= */
  var REPLAY_HZ = 30, REPLAY_SECS = 3.0;
  var replayBuf = [], replayAcc = 0, replay = null;

  function replayRecord(dt) {
    replayAcc += dt;
    if (replayAcc < 1 / REPLAY_HZ) return;
    replayAcc = 0;
    var b = G.ball;
    replayBuf.push({
      bx: b.x, by: b.y, bz: b.z, bs: b.spin || 0,
      ps: G.players.map(function (q, i) {
        var r = rigs[i];
        return { x: q.x, y: q.y, off: !!q.sentOff,
                 anim: r ? r.anim : "idle", frame: r ? r.frame : 0,
                 face: r ? r.face : "s", flip: r ? r.flip : false,
                 air: r ? r.air : 0 };
      }),
    });
    if (replayBuf.length > REPLAY_HZ * REPLAY_SECS) replayBuf.shift();
  }

  /* THE CUT IS THE POINT. A replay that starts three seconds before the
     goal spends two of them on nothing; one that starts at the strike
     misses the pass that made it. A second and a half is the build-up
     plus the finish, which is what a television director picks too. */
  function replayStart() {
    if (replayBuf.length < 12) return false;
    var want = Math.min(replayBuf.length, Math.round(REPLAY_HZ * 1.6));
    replay = { frames: replayBuf.slice(replayBuf.length - want), i: 0, t: 0 };
    G.state = "replay"; G.stateT = 0;
    setCamMode("replay", G.scorerP);
    return true;
  }

  function replayStep(dt) {
    if (!replay) { G.state = "goal"; G.stateT = 0; return; }
    /* slower than life, because that is what a replay is for */
    replay.t += dt * TUNE.replaySpeed;
    replay.i = Math.floor(replay.t * REPLAY_HZ);
    if (replay.i >= replay.frames.length) {
      replay = null;
      G.state = "goal"; G.stateT = TUNE.goalCheer * 0.55;
      setCamMode("goal", G.scorerP, TUNE.goalCheer);
      return;
    }
    var f = replay.frames[replay.i];
    G.ball.x = f.bx; G.ball.y = f.by; G.ball.z = f.bz; G.ball.spin = f.bs;
    G.ball.vx = G.ball.vy = G.ball.vz = 0;
    for (var i = 0; i < G.players.length && i < f.ps.length; i++) {
      var q = G.players[i], e = f.ps[i], r = rigs[i];
      q.x = e.x; q.y = e.y; q.vx = q.vy = 0;
      if (r) { r.anim = e.anim; r.frame = e.frame; r.face = e.face;
               r.flip = e.flip; r.air = e.air; }
    }
  }

  /* WHAT THE GROUND SAYS WHEN SOMEBODY SCORES */
  function announceGoal(team) {
    var t = teamById(G.ids[team]) || {};
    var who = G.scorer || (G.scorerP && G.scorerP.name) || "";
    var mins = Math.floor((G.half === 1 ? 0 : 45) +
                          (G.clock / TUNE.halfSeconds) * 45) + "\u2019";
    G.pa = { t: 0, kicker: "GOAL \u2014 " + (t.short || t.name || ""),
             line: who, right: mins,
             col: (t.kit && t.kit.shirt) || "#c1272d" };
    uiSayLive("Goal. " + who + ", " + mins + ".");
    SFX.pa();
  }

  /* and when somebody is booked */
  function announceCard(pl, kind) {
    var t = teamById(G.ids[pl.team]) || {};
    G.pa = { t: 0, kicker: kind === "red" ? "SENT OFF" : "BOOKED",
             line: pl.name, right: "",
             col: kind === "red" ? "#d8323c" : "#f0c53a" };
  }

  /* the badge, so nobody mistakes it for the match */
  function drawReplayBadge() {
    if (G.state !== "replay" || !UIX) return;
    var lab = "REPLAY";
    var w = textWidth(lab) + 14;
    var x = 6, y = Math.round(UIH * 0.40);
    box(x, y, w, 13, "#0d1412");
    box(x + 1, y + 1, w - 2, 11, "#8c1f2a");
    line(x + 1, y + 1, w - 2, 1, "#c8404c");
    /* the blinking dot a broadcast puts next to the word */
    if (Math.floor(UI.t * 3) % 2 === 0) box(x + 5, y + 5, 3, 3, "#ffffff");
    drawText(x + 11, lab, y + 3, { colour: "#ffe9a8" });
  }

  /* the receiver she is aimed at, cached between recomputations */
  var passHint = { t: 0, mate: null, tx: 0, ty: 0 };

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
    /* THE LEAD, CLAMPED WHERE IT IS MEASURED.

       How many world units a screen pixel is worth depends on the depth
       and on the zoom, so the clamp has to be applied through the lens
       rather than as a fixed number of world units — otherwise the same
       lead is gentle at zoom 1 and violent at zoom 2. */
    var lx = b.vx * CAM.lead, ly = b.vy * CAM.lead;
    var pr = R2 && R2.project ? R2.project(wX(b.x), wY(b.y)) : null;
    if (pr && pr.k > 0.001) {
      /* `k` is pixels per world unit ACROSS THE SCREEN and `ky` is
         pixels per world unit INTO it. Which of the pitch's two axes
         each of those describes is the whole of the difference between
         the two orientations — get it backwards and the lead is
         clamped by the wrong lens, which is gentle in one direction
         and violent in the other. */
      var kAcross = SIDE ? pr.ky : pr.k;
      var kAlong = SIDE ? pr.k : pr.ky;
      var maxX = CAM.leadMax / Math.max(0.001, kAcross);
      var maxY = CAM.leadMax / Math.max(0.001, kAlong);
      lx = clamp(lx, -maxX, maxX);
      ly = clamp(ly, -maxY, maxY);
    }
    pts.push({ x: b.x + lx, y: b.y + ly });
    var minX = 1e9, maxX2 = -1e9, minY = 1e9, maxY2 = -1e9;
    pts.forEach(function (p) {
      minX = Math.min(minX, p.x); maxX2 = Math.max(maxX2, p.x);
      minY = Math.min(minY, p.y); maxY2 = Math.max(maxY2, p.y);
    });
    return { x: (minX + maxX2) / 2, y: (minY + maxY2) / 2 };
  }

  /* HOW MUCH OF THE GAP THE CAMERA CLOSES THIS FRAME.

     `smooth` is written per sixtieth of a second because that is the
     unit it is legible in, but frames are not a sixtieth of a second —
     in this container they are nearer a third of one. Applied raw, the
     camera would crawl on a slow machine and snap on a fast one, which
     is the whole class of bug that makes a game feel different
     depending on what it is running on. */
  function camK(dt) { return 1 - Math.pow(1 - CAM.smooth, Math.max(0, dt) * 60); }

  /* THE DEADZONE, APPLIED IN SCREEN PIXELS.

     Returns where the camera should actually aim: unchanged while the
     subject is inside the box, and otherwise pulled along by exactly
     the amount that puts the subject back on the edge of it. That
     "exactly the amount" is the part that matters — a deadzone that
     snaps to centre the moment it is broken is worse than none at all,
     because the frame jumps instead of drifting. */
  function deadzone(wantX, wantY) {
    if (!R2 || !R2.project) return { x: wantX, y: wantY };
    var here = R2.project(wX(camNow.x), wY(camNow.y));
    var there = R2.project(wX(wantX), wY(wantY));
    var dx = there.x - here.x, dy = there.y - here.y;
    var outX = Math.abs(dx) - CAM.dead[0], outY = Math.abs(dy) - CAM.dead[1];
    var x = camNow.x, y = camNow.y;
    if (SIDE) {
      /* SIDE-ON THERE IS ONLY ONE DEADZONE THAT MATTERS.

         The camera is on a rail: it pans along the pitch and never
         moves in depth. So the horizontal break — the play running
         away down the touchline — is the one that moves it, and it
         moves the pitch's y. The sign flips because the renderer's
         long axis counts backwards from the far goal line. */
      if (outX > 0 && here.k > 0.001) y -= Math.sign(dx) * outX / here.k;
      return { x: x, y: y };
    }
    if (outX > 0 && here.k > 0.001) x += Math.sign(dx) * outX / here.k;
    if (outY > 0 && here.ky > 0.001) y += Math.sign(dy) * outY / here.ky * -1;
    return { x: x, y: y };
  }

  /* what the camera is doing this second */
  function setCamMode(kind, at, hold) {
    /* a cut in or out gets a sound on it; settling back into play does
       not, because that one happens every time anything ends */
    var closeUp = function (k) { return k === "goal" || k === "super" || k === "hero"; };
    if (closeUp(kind) && !closeUp(camMode.kind)) SFX.cut();
    camMode.kind = kind; camMode.t = 0; camMode.at = at || null;
    camMode.hold = hold || 0;
  }

  function camTo(x, y, k, zoom) {
    camNow.x += (x - camNow.x) * k;
    camNow.y += (y - camNow.y) * k;
    if (!R2) return;
    R2.zoomTo(zoom || 1);
    if (SIDE) {
      /* A CABLE CAM DOWN THE TOUCHLINE.

         The one camera in football that has never moved: it sits at a
         fixed distance from the pitch, at a fixed height, and pans. It
         does not creep toward the near touchline when the play does,
         because a real one is bolted to a rail. That fixed depth is
         also what makes the side view legible — the ground under the
         play stays where it is on screen, and only the play moves. */
      R2.cam.x = -(PITCH.w / 2) - CAM.sideBack;
      R2.cam.y = wY(camNow.y);
    } else {
      /* the renderer's near edge is the camera's y, and the thing being
         watched should sit above it rather than on it */
      R2.cam.x = wX(camNow.x);
      R2.cam.y = wY(camNow.y) - CAM.trail;
    }
    /* full size is whatever the camera is looking at, which is the ball */
    if (R2.setFocus) R2.setFocus(wX(G.ball.x), wY(G.ball.y));
  }

  var camFrozen = false;

  function placeCamera(dt, snap) {
    if (!R2 || !G) return;
    /* HOLDING THE LENS STILL, for the one harness that needs it.

       The frame loop can be stopped and the camera still will not stop
       moving, because it EASES towards a target and the target is
       recomputed every time anything is drawn. A test that wants to
       know whether the picture flickers has to be able to take two
       frames from the same place; without this it takes two frames from
       two places, four fifths of the pixels differ, and it reports a
       flickering pitch when what it measured was a moving one.

       It is the same affordance the crowd energy already has and it
       exists for the same reason. */
    if (camFrozen && !snap) return;
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
      /* WHICH FIELD SLIDES THE FRAME SIDEWAYS. The renderer's `cam`
         is in its own frame, and turned sideways it is `y` that runs
         across the screen — nudging `x` would push the camera in or
         out of the pitch instead of along the frame. */
      var sideways = SIDE ? "y" : "x";
      R2.cam[sideways] -= CAMHERO.ndc * (R2.vw / 2) / pr.k;
      /* a slow drift, so a still screen is never still */
      R2.cam[sideways] += Math.sin(camMode.t * 0.42) * 0.8;
      return;
    }

    /* =====================================================================
       A RESTART IS FRAMED ON THE BOX, NOT ON THE BALL

       Following the ball to a corner puts the camera within a few units
       of the touchline, and at that range the side stand fills half the
       frame and leans across the pitch — which looks like a rendering
       fault and is really the camera standing inside the stadium. It is
       also not what a corner looks like on television: the shot is of
       the PENALTY AREA, because the area is where the thing you are
       about to watch happens. The ball is in the corner of it.

       A goal kick is the same idea pointed the other way: frame the
       pitch the keeper is about to hit it into rather than the keeper.
       ===================================================================== */
    if (camMode.kind === "set" && G.set) {
      var S = G.set;
      var sd = attackDir(S.team);
      var fx, fy;
      if (S.kind === "corner") {
        fx = PITCH.cx + (S.x - PITCH.cx) * 0.42;
        fy = S.gl - sd * PITCH.boxH * 0.55;
      } else {
        fx = PITCH.cx;
        fy = S.gl + sd * PITCH.h * 0.17;
      }
      camTo(fx, fy, snap ? 1 : Math.min(1, 3.4 * dt), 1);
      return;
    }

    /* THE REPLAY SHOT. Tighter than the match camera and held on the
       ball rather than led by it — a replay is not trying to keep the
       play in frame, it already knows where the play went. */
    if (camMode.kind === "replay") {
      camTo(G.ball.x, G.ball.y, snap ? 1 : Math.min(1, 5 * dt), 2);
      return;
    }

    /* THE MENU SHOT. Stood off, drifting, with the line-up in the right
       of the frame and the card in the left. */
    if (camMode.kind === "menu") {
      camTo(PITCH.cx, PITCH.cy + 10 + Math.sin(camMode.t * 0.17) * 4,
            snap ? 1 : Math.min(1, 1.6 * dt), 1);
      var mp = R2.project(0, wY(PITCH.cy));
      var mside = SIDE ? "y" : "x";
      R2.cam[mside] -= 0.34 * (R2.vw / 2) / mp.k + Math.sin(camMode.t * 0.23) * 1.5;
      return;
    }

    /* PLAY. Follow the ball, ease, and never let the camera past the
       ends of the pitch — behind the goal line there is nothing to see
       but the back of a stand. */
    /* THE CAMERA IS ALLOWED TO REACH THE TOUCHLINE.

       Clamped to a fifth of the pitch either side of the middle, it
       could never get within eighty units of a touchline — and with
       about sixty units of half-view, that meant the touchline was
       ALWAYS off the side of the screen. The ball has always come back
       off the boards; she had simply never been able to see one. */
    var raw = wantFraming();
    var want = snap ? raw : deadzone(raw.x, raw.y);
    /* SIDE-ON, THE CAMERA PANS ALONG THE LENGTH AND NOTHING ELSE.

       Up and down the pitch, y is depth and has to stop short of the
       goal lines or the camera ends up behind a net. Side-on, y is
       what the camera pans ALONG, and x is depth, which the cable cam
       holds fixed — so the clamp that matters is on the PAN.

       And it is a clamp on what the FRAME sees rather than on where
       the camera is. Left to follow the ball into a goalmouth, the
       pan put the frame's edge forty units behind the goal line, and
       at that angle the stand behind the goal swings diagonally across
       a quarter of the picture — geometrically correct, and it reads
       as the camera having fallen over. Stopping the pan when the far
       edge of the frame reaches a little way past the goal line is
       what a cable cam does anyway: the goalmouth ends up toward the
       side of the shot, which is exactly where television puts it. */
    var y;
    if (SIDE) {
      var lens = R2.project(wX(PITCH.cx), wY(camNow.y));
      var halfAlong = lens.k > 0.001 ? (R2.vw / 2) / lens.k : PITCH.h / 2;
      var lo = PITCH.y0 - CAM.sideOver + halfAlong;
      var hi = PITCH.y1 + CAM.sideOver - halfAlong;
      y = lo <= hi ? clamp(want.y, lo, hi) : PITCH.cy;
    } else {
      y = clamp(want.y, PITCH.y0 + 30, PITCH.y1 + 6);
    }
    /* HOW CLOSE THE CAMERA MAY GET TO A TOUCHLINE.

       It was widened to 0.40 so that she could actually see a touchline
       — before that the boards were permanently off the side of the
       screen and she could not tell where a rebound had come from. That
       was right, but 0.40 leaves the camera under thirty units from the
       line, and at that range the SIDE STAND fills a third of the frame
       and leans across the pitch at an angle that reads as a rendering
       fault. It is not one: it is the left touchline receding correctly,
       seen from almost on top of it.

       0.32 keeps the touchline and its boards comfortably in shot and
       keeps the stand where it belongs, at the edge of the picture. */
    var x = clamp(want.x, PITCH.cx - PITCH.w * 0.32, PITCH.cx + PITCH.w * 0.32);
    camTo(x, y, snap ? 1 : camK(dt), 1);
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
    crowdEnergyStep(dt);
    R2.begin(dt, netBulge);

    /* =====================================================================
       THE PASS SHE IS ABOUT TO PLAY

       Worked out on the same call the pass itself will use, so what is
       drawn is genuinely what will happen rather than a guess that
       agrees with it most of the time. Recomputed eight times a second
       rather than sixty, because bestPass walks every team-mate against
       every opponent and the answer does not change meaningfully inside
       an eighth of a second — and because a marker that re-picks every
       frame flickers between two equally good options.

       It is only ever shown while SHE has the ball. An indicator over
       an AI player's head is telling her something she cannot act on.
       ===================================================================== */
    var driver = G.controlled;
    passHint.t -= dt;
    if (driver && G.ball.owner === driver && G.state === "play") {
      if (passHint.t <= 0) {
        passHint.t = 0.125;
        var o = bestPass(driver);
        passHint.mate = o && o.mate ? o.mate : null;
        passHint.tx = o && o.through ? o.tx : (passHint.mate ? passHint.mate.x : 0);
        passHint.ty = o && o.through ? o.ty : (passHint.mate ? passHint.mate.y : 0);
      }
      if (passHint.mate && passHint.mate.sentOff) passHint.mate = null;
      if (passHint.mate) {
        var hintCol = ringColour(driver) || "#ffe9a8";
        R2.lane(wX(driver.x), wY(driver.y), wX(passHint.tx), wY(passHint.ty),
                hintCol, UI.t);
        R2.marker(wX(passHint.mate.x), wY(passHint.mate.y), hintCol, UI.t);
      }
    } else { passHint.mate = null; }

    for (i = 0; i < G.players.length; i++) {
      var p = G.players[i], r = rigs[i];
      if (!r) continue;
      R2.player({
        at: r.atlas, anim: r.anim, face: r.face, frame: r.frame,
        flip: r.flip, air: r.air,
        wx: wX(p.x), wy: wY(p.y),
        shadow: 3.2 * ((p.build && p.build.w) || 1),
        ring: (p === G.controlled && G.state !== "goal") ? UI.t * 0.5 : null,
        /* in her side's own colour, so the marker agrees with the shirt
           it is drawn under rather than adding a third one */
        ringCol: ringColour(p),
        /* squad numbers, one to four a side, keeper first */
        num: p.shirtNo,
        numCol: shirtInk(p),
      });
    }

    var b = G.ball;
    superTrailDraw();
    /* the super makes it bigger than a football, which is the whole
       point of it: a ball you can see coming from the halfway line.

       `struck` and `spin` are what give it weight — the squash on the
       frame it is hit and the turn as it travels. Both were drawn by
       the old renderer, both were computed by the simulation all
       along, and for the whole of the 2D port neither was being read
       by anything at all. */
    R2.ball(wX(b.x), wY(b.y), b.z, b.superK ? superBallTint() : null,
            BALL_R * (b.superK ? 2.1 + Math.sin(G.stateT * 26) * 0.16 : 1),
            { struck: b.struck || 0, spin: b.spin || 0,
              vx: b.vx, vy: -b.vy, speed: len(b.vx, b.vy) });
    R2.confettiStep(dt);
    R2.turfStep(dt);
    superCardStep(dt);
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
      }, wX(t.x));
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
    /* AND THE BUFFER IS CHOSEN FROM THE CANVAS, not fixed at 480x270.
       Told nothing, the renderer blits its fixed buffer at whatever
       whole number fits and fills the rest of the frame in with the
       roof colour — 44 per cent of a 1280x720 laptop. See setViewport. */
    if (R2 && R2.setViewport) R2.setViewport(w, h);
    uiSize();
  }

  function buildRenderer() {
    R2 = window.CupPitch2D.create(cvs, worldSpec());
    R2.setSwap(SIDE);
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

  /* the accent a player's marker ring is drawn in: their kit's trim if
     it has one that reads against grass, and the shirt otherwise */
  /* THE INK A NUMBER IS PRINTED IN. White on a dark shirt and near-
     black on a light one, decided from the shirt's own brightness
     rather than from a list — which is what a kit manufacturer does
     and the only way it works for every team in the config. */
  function shirtInk(pl) {
    var t = teamById(pl.teamId) || {};
    var kit = pl.kit || (pl.gk ? t.gkKit : t.kit) || null;
    var hex = (kit && kit.shirt) || "#c1272d";
    var c = parseInt(hex.slice(1), 16);
    var lum = ((c >> 16 & 255) * 0.299 + (c >> 8 & 255) * 0.587 + (c & 255) * 0.114);
    return lum > 150 ? "#141a16" : "#f4f6f2";
  }

  function ringColour(pl) {
    var t = teamById(pl.teamId) || {};
    var kit = pl.kit || t.kit || null;
    if (!kit) return null;
    return lift(kit.trim || kit.shirt, 40);
  }

  function spriteFacing(pl) {
    /* WHICH WAY HE IS FACING IS RELATIVE TO THE LENS, NOT TO THE PITCH.

       Up and down the pitch, down the screen is toward the camera —
       which is +y — and right across the screen is +x.

       Turned side-on the camera stands off the -x touchline looking
       across, so "toward the camera" becomes -x, and because the
       renderer's across-axis runs backwards along the pitch, "right
       across the screen" becomes -y. Octant 0 is facing the lens in
       both, which is the only thing the sprite sheet cares about. */
    var down = SIDE ? -Math.cos(pl.dir) : Math.sin(pl.dir);
    var right = SIDE ? -Math.sin(pl.dir) : Math.cos(pl.dir);
    var oct = Math.round(Math.atan2(right, down) / (Math.PI / 4));
    return ((oct % 8) + 8) % 8;
  }

  /* what the simulation says this player is doing, as a sprite animation */
  function spriteAnim(pl) {
    if (pl.anim && pl.anim.once) {
      var a = pl.anim.state;
      if (a === "kick" || a === "superKick") return "kick";
      if (a === "pass") return "pass";
      if (a === "trap") return "trap";
      if (a === "catch") return "catch";
      if (a === "punch") return "punch";
      if (a === "throw") return "throw";
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
    /* THE TWO STATES A FOOTBALLER IS IN HALF THE TIME.

       Neither of these is a decision anybody makes — they are read off
       what the body is already doing, which is why they were missing:
       nothing in the simulation ever asked "is this player changing
       direction" or "is this player stopping", even though it has been
       computing both since turnCost was written. They are checked
       before run/idle because both of them ARE running, and both look
       nothing like a run cycle. */
    if (pl.skidT > 0) return "stop";
    if (pl.turnT > 0) return "turn";
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

  /* =======================================================================
     THE HUD, DRAWN

     The last CSS in the chapter, and the one that mattered most: every
     menu got rebuilt in the pixel language and this did not, so the one
     place the old look survived was the place she spends ninety minutes
     looking at. A scoreboard with a linear-gradient on it and a thumb
     button with a blurred drop shadow, over a pitch made of hard pixels.

     IT IS NOT A SCREEN. The menus are `uiOpen` screens with a widget
     table and a hit test; the HUD is up while the game is being played,
     so it paints into the same canvas without claiming the pointer —
     the canvas keeps `pointer-events: none` and the buttons underneath
     go on being buttons.

     WHICH IS ALSO WHY THE BUTTONS ARE MEASURED RATHER THAN PLACED. The
     pad is still real DOM: a real <button> with a real touch target, a
     real aria-label and a real focus ring, because reimplementing all
     of that on a canvas to win a rectangle would be a bad trade. It is
     made invisible and its rectangle is read back every frame, so the
     art lands exactly on top of the control however CSS lays it out.
     ======================================================================= */

  /* a DOM element's rectangle, in the pixel layer's own coordinates */
  function uiRectOf(el) {
    if (!el || el.hidden || !uiCvs) return null;
    var c = uiCvs.getBoundingClientRect(), r = el.getBoundingClientRect();
    if (!c.width || !c.height || !r.width) return null;
    return { x: (r.left - c.left) / c.width * UIW,
             y: (r.top - c.top) / c.height * UIH,
             w: r.width / c.width * UIW,
             h: r.height / c.height * UIH };
  }

  /* a meter: a sunken trough, a stepped fill, and a lit top edge. Every
     bar in the HUD is this, because four different bars drawn four
     different ways is four things to look at rather than one. */
  function hudBar(x2, y2, w, h, frac, col, back) {
    box(x2 - 1, y2 - 1, w + 2, h + 2, "#0d1412");
    box(x2, y2, w, h, back || "#16222a");
    var f = Math.round(clamp(frac, 0, 1) * w);
    if (f > 0) {
      box(x2, y2, f, h, col);
      line(x2, y2, f, 1, lift(col, 60));
      line(x2, y2 + h - 1, f, 1, lift(col, -50));
    }
    return f;
  }

  /* the round chip in the corner: a tab with a lit top */
  function hudChip(x2, y2, str, tone, ink) {
    var w = textWidth(str) + 10;
    box(x2, y2, w, 12, "#0d1412");
    box(x2 + 1, y2 + 1, w - 2, 10, tone);
    line(x2 + 1, y2 + 1, w - 2, 1, lift(tone, 55));
    drawText(x2 + 5, str, y2 + 3, { colour: ink || "#f4f4e8" });
    return w;
  }

  /* THE THUMB BUTTON. A hard-edged disc with a bevel and an offset
     shadow, and a ring round it that fills as she winds up a shot. The
     ring is stepped rather than swept, because a smooth arc on a pixel
     screen is the one thing that gives the whole illusion away. */
  function hudRound(r2, label, tone, ink, charge, icon) {
    if (!r2) return;
    var cx2 = Math.round(r2.x + r2.w / 2), cy2 = Math.round(r2.y + r2.h / 2);
    var rad = Math.round(Math.min(r2.w, r2.h) / 2) - 1;
    if (rad < 6) return;
    /* the drop, then the face */
    uiDisc(cx2, cy2 + 2, rad, "rgba(4,8,10,.5)");
    uiDisc(cx2, cy2, rad, "#0d1412");
    uiDisc(cx2, cy2, rad - 1, tone);
    uiDisc(cx2, cy2 - 1, rad - 3, lift(tone, 26));
    if (charge > 0) {
      /* twenty-four steps round the outside, lit clockwise from the top */
      var lit = Math.round(clamp(charge, 0, 1) * 24);
      for (var i = 0; i < lit; i++) {
        var a = -Math.PI / 2 + (i / 24) * Math.PI * 2;
        box(Math.round(cx2 + Math.cos(a) * (rad + 2)) - 1,
            Math.round(cy2 + Math.sin(a) * (rad + 2)) - 1, 2, 2,
            charge > 0.92 ? "#ffffff" : "#ffe9a8");
      }
    }
    if (icon) icon(cx2, cy2 - 4);
    drawText(cx2, fitText(label, rad * 2 - 2, 1), cy2 + 3,
             { align: "center", colour: ink || "#f4f4e8" });
  }

  /* ONE HEART, AT WHATEVER SIZE AND HOWEVER FULL.

     Drawn as a run-length shape rather than a circle-and-triangle,
     because at twenty pixels across a heart made out of maths is a
     blob. The rows are the proportions written down once; `part` is how
     much of it has filled, which fills from the BOTTOM, the way
     anything that is filling up does. */
  /* ONE HEART, AT WHATEVER SIZE AND HOWEVER FULL.

     Drawn from a table of row spans rather than from a circle and a
     triangle, because at twenty pixels across a heart made out of maths
     is a blob. The first attempt at this table described only the LEFT
     lobe — one narrow span per row — and what came out was exactly that:
     five dark lumps under the scoreboard.

     A heart is a single span per row that is WIDE at the top with a
     notch cut out of the middle of it, narrowing to a point at the
     bottom. `part` is how full it is, and it fills from the bottom,
     the way anything filling up does. */
  var HEART_ROWS = [
    [0.16, 0.84, 0.42, 0.58],
    [0.06, 0.94, 0.44, 0.56],
    [0.02, 0.98, 0.46, 0.54],
    [0.00, 1.00, 0, 0],
    [0.00, 1.00, 0, 0],
    [0.02, 0.98, 0, 0],
    [0.06, 0.94, 0, 0],
    [0.13, 0.87, 0, 0],
    [0.22, 0.78, 0, 0],
    [0.32, 0.68, 0, 0],
    [0.44, 0.56, 0, 0],
  ];
  function pixHeart(x2, y2, size, part, col) {
    var rows = HEART_ROWS.length;
    var hgt = Math.max(6, Math.round(size * 0.90));
    var fillTop = y2 + hgt - Math.round(hgt * clamp(part, 0, 1));
    /* an EMPTY heart is a socket in the super's own colour, heavily
       darkened — not a black hole. Against a stand full of people a
       near-black shape reads as a smudge, and five of them read as
       five smudges, which is what the first pass looked like. */
    var socket = lift(col, -110), rim = "#0d1412";
    for (var r = 0; r < hgt; r++) {
      var i = Math.min(rows - 1, Math.round(r / (hgt - 1) * (rows - 1)));
      var row = HEART_ROWS[i];
      var x0 = Math.round(row[0] * size), x1 = Math.round(row[1] * size);
      if (x1 <= x0) continue;
      var yy = y2 + r;
      var on = yy >= fillTop;
      box(x2 + x0, yy, x1 - x0, 1, on ? col : socket);
      /* the notch between the two lobes, top rows only */
      if (row[3] > row[2]) {
        var n0 = Math.round(row[2] * size), n1 = Math.round(row[3] * size);
        if (n1 > n0) box(x2 + n0, yy, n1 - n0, 1, rim);
      }
      /* a one-pixel keyline down each flank so a full heart has an edge
         against the board behind it */
      box(x2 + x0, yy, 1, 1, on ? lift(col, -45) : rim);
      box(x2 + x1 - 1, yy, 1, 1, on ? lift(col, -45) : rim);
    }
    /* the highlight on the upper left lobe, which is what stops it
       reading as a flat symbol */
    if (part > 0.6) {
      box(x2 + Math.round(size * 0.18), y2 + 1,
          Math.max(1, Math.round(size * 0.16)), 1, lift(col, 80));
    }
  }

  /* a filled disc on whole pixels — the canvas's own arc is a blur */
  function uiDisc(cx2, cy2, r2, col) {
    for (var y2 = -r2; y2 <= r2; y2++) {
      var w = Math.round(Math.sqrt(Math.max(0, r2 * r2 - y2 * y2)));
      if (w < 1) continue;
      box(cx2 - w, cy2 + y2, w * 2 + 1, 1, col);
    }
  }

  /* =======================================================================
     WHETHER SHE IS PLAYING WITH A THUMB OR A KEYBOARD

     The pad has carried a `touch` class since it was written, and the
     class is added on the first pointerdown on the stick. Which means
     that for the whole of the first passage of play on a phone — before
     she has touched anything, when she is reading the screen to find
     out how to play — the game told her the controls were W A S D,
     SPACE and SHIFT. The one moment the legend exists for is the one
     moment it was wrong.

     Asking first is better than waiting to be told, so a coarse pointer
     counts on its own. A key press still wins: a tablet with a
     keyboard, or a laptop with a touchscreen she is not using, should
     get the keys back the moment she uses one. */
  var COARSE = false;
  try {
    COARSE = !!(window.matchMedia && window.matchMedia("(pointer: coarse)").matches);
  } catch (e) { COARSE = false; }
  var USED_KEYS = false;

  function hudTouch() {
    if (EL["cup-pad"] && EL["cup-pad"].classList.contains("touch")) return true;
    return COARSE && !USED_KEYS;
  }

  function drawHud() {
    if (!G || !UIX) return;
    UIX.clearRect(0, 0, UIW, UIH);
    var a = teamById(G.ids[0]) || {}, b = teamById(G.ids[1]) || {};
    var aCol = (a.kit && a.kit.shirt) || "#c1272d";
    var bCol = (b.kit && b.kit.shirt) || "#6d5fa8";

    /* =====================================================================
       ONE SCORE BUG, IN A CORNER

       There used to be five separate things across the top of the
       picture: a board in the middle, a clock hanging off it, a chip
       saying which round it was, a chip saying which half it was, and a
       hundred-and-twenty-pixel heart meter with a name plate beside it.
       Measured, the top tenth of the frame was 42 per cent chrome and
       the second tenth another 19, which is a third of the sky over a
       stadium covered in furniture.

       What a match actually needs on screen is the score, the clock,
       and nothing else. The round is on the card before kick-off and on
       every card after it; the half belongs on the clock, which is
       where a clock keeps it; and the meter is hers, so it goes where
       her other instrument already is rather than in the middle of the
       shot.

       And it sits in a corner, the way a broadcast bug does, because
       the middle of the top edge is where the stand and the sponsor
       boards are and they are the things that make it look like a
       stadium.
       ===================================================================== */
    /* 48 of side block is what a four-letter short name needs at this
       size once the crest has taken its 14: FMPM came out as "FM..." at
       42, which is a bug that cannot tell her whose score is whose. */
    var bw = 140, bx = 4, by = 4, half = 48;
    box(bx, by, bw, 22, "#0d1412");
    box(bx + 1, by + 1, bw - 2, 20, "#16222a");
    line(bx + 1, by + 1, bw - 2, 1, "#2f4450");
    /* each side wears its own colour down its own end of the bug, which
       is how she knows which number is hers without reading */
    box(bx + 1, by + 1, half, 20, aCol);
    box(bx + bw - half - 1, by + 1, half, 20, bCol);
    box(bx + 1, by + 1, half, 1, lift(aCol, 60));
    box(bx + bw - half - 1, by + 1, half, 1, lift(bCol, 60));
    if (a.id) pixCrest(a, bx + 3, by + 6, 14, 11);
    if (b.id) pixCrest(b, bx + bw - 18, by + 6, 14, 11);
    drawText(bx + 19, fitText(a.short || "", 28, 1), by + 8, { colour: "#ffffff" });
    drawText(bx + bw - 19, fitText(b.short || "", 28, 1), by + 8,
             { align: "right", colour: "#ffffff" });
    drawText(bx + Math.round(bw / 2), G.score[0] + ":" + G.score[1], by + 4,
             { align: "center", scale: 2, colour: "#ffffff",
               outline: "#0d1412", outlineW: 2 });

    /* THE CLOCK CARRIES THE HALF, because that is what a clock is for
       and it is two chips fewer on the grass. */
    var mins;
    if (G.golden) mins = "90+ GOLDEN";
    else {
      var base = G.half === 1 ? 0 : 45;
      mins = Math.floor(base + (G.clock / TUNE.halfSeconds) * 45) + "\u2019"
             + (G.half === 1 ? " 1ST" : " 2ND");
    }
    var cw = textWidth(mins) + 10;
    box(bx, by + 22, cw, 10, "#0d1412");
    box(bx + 1, by + 22, cw - 2, 9, "#243640");
    drawText(bx + Math.round(cw / 2), mins, by + 24,
             { align: "center", colour: "#ffe9a8" });

    /* ---- THE HEART METER, DOWN WITH HER OTHER INSTRUMENT ---------
       It was a hundred and twenty pixels wide — a quarter of the frame
       — parked across the middle of the stand with a name plate beside
       it. It is hers, like the stamina bar under it, and the two of
       them together in the corner is one place to look instead of two.
       Small, because five pips are a count and a count does not need to
       be big to be read. */
    var sup = superOf(0);
    var hc = (sup && sup.colour) || "#ff5f8f";
    var hw = 58, hx = 6, hy = UIH - 26;
    /* the heart itself, which beats when the meter is full */
    var armed = superArmed(0);
    /* THE METER WAS DIVIDING BY A FIELD THAT DOES NOT EXIST.

       TUNE has `superCost`; this asked for `superFill`, got undefined,
       and every frame computed heart/undefined = NaN. clamp(NaN) is
       NaN, a bar drawn to NaN pixels draws nothing, and the meter has
       therefore shown EMPTY for the whole of its life however much of
       it she had actually filled — including at the moment it was full
       and the super was armed. It is the sort of bug a bar hides
       perfectly: an empty bar looks like a bar. */
    var frac = clamp((G.heart[0] || 0) / TUNE.superCost, 0, 1);
    /* THE METER IS HEARTS, NOT A BAR.

       A bar is a number. Five hearts filling one after another is a
       count she can read at a glance and without looking directly at
       it — she knows she is two away without measuring anything — and
       it is the shape the rest of the chapter is already in. The last
       one to fill beats, and when they are all full they all do. */
    var beat = armed ? 1 + (Math.floor(UI.t * 5) % 2) : 0;
    var N = 5, gap = 2, hs = Math.floor((hw - gap * (N - 1)) / N);
    for (var q2 = 0; q2 < N; q2++) {
      var lo = q2 / N, part = clamp((frac - lo) * N, 0, 1);
      var qx2 = hx + q2 * (hs + gap);
      var lift2 = armed ? beat : (part >= 1 && frac < 1 && q2 === Math.floor(frac * N) - 1 ? 1 : 0);
      pixHeart(qx2, hy - lift2, hs, part, hc);
    }
    if (armed) {
      /* a marching keyline while it is ready, so a full meter is not
         just a wider meter */
      var ph = Math.floor(UI.t * 12) % 4;
      for (var i2 = 0; i2 < hw; i2++) {
        if ((i2 + ph) % 4 < 2) {
          box(hx + i2, hy - 3, 1, 1, "#ffffff");
          box(hx + i2, hy + hs + 2, 1, 1, "#ffffff");
        }
      }
    }
    /* THE NAME, ONLY ONCE IT CAN BE FIRED.

       It used to be on a plate beside the meter for the whole match,
       which is a hundred pixels of lettering telling her the name of
       something she cannot do yet. Armed, it is the most useful thing
       on the screen; before that it is furniture. */
    if (armed) {
      var sn = fitText((sup && sup.name) || "SUPER", 92, 1);
      var snw = textWidth(sn) + 6;
      box(hx, hy - 12, snw, 9, "#0d1412");
      drawText(hx + 3, sn, hy - 11, { colour: "#ffffff" });
    }
    /* theirs, thinner and underneath, and only when they have one */
    if (EL["cup-heart-a"] && !EL["cup-heart-a"].hidden) {
      var tc = (superOf(1) && superOf(1).colour) || "#8fa8a0";
      hudBar(hx, hy + hs + 4, hw, 2, (G.heart[1] || 0) / TUNE.superCost, tc);
    }

    /* POSSESSION AND SHOTS ARE NOT LIVE INSTRUMENTS.

       They were a hundred and fifty pixel strip and a line of type
       across the bottom middle of the picture, under the play, for the
       whole match. Nobody changes what they are doing on the pitch
       because possession has moved from 54 to 56 per cent — it is a
       thing you read afterwards, and it is already on the half-time
       card and the full-time card, laid out properly, where she is
       sitting still and can actually take it in.

       Taken off the grass, that is the bottom of the frame back. */

    /* =====================================================================
       THE RADAR

       The camera sees about forty-five per cent of the pitch's width and
       three quarters of its length. Everything outside that is a player
       she cannot see, which means a pass to a team-mate in space is a
       pass she had no way of knowing was on — and a run in behind
       happens entirely off screen. Every football game ever made has a
       radar for exactly this reason, and it is a gameplay instrument
       rather than decoration: without it the passing in a game with a
       tight camera is guesswork dressed up as a decision.

       It is drawn as the pitch is drawn, which is the part that makes
       it read at forty pixels wide: the same two mowing tones, the same
       line colour, the goals at the ends, and the halfway line. Dots
       are kit colours so the two sides are told apart by the same
       information as on the grass — and the one she is driving gets the
       white ring the player wears, so the two pictures agree.

       ALWAYS THE SAME WAY ROUND. It does not rotate at half time and it
       does not flip to "your goal is always at the bottom", because
       both of those make it a second thing to learn. Her goal is the
       one with her colour behind it; that is enough.
       ===================================================================== */
    /* THE RADAR IS DRAWN THE WAY THE MATCH IS.

       Its whole job is to be the same picture as the grass, only
       smaller — so if the pitch on screen runs left to right, so does
       the pitch on the radar. A radar that stayed upright while the
       match turned would be the second thing to learn that the comment
       below spends a paragraph refusing to add.

       Both orientations foreshorten the axis going INTO the screen by
       the same 0.62, which is why the shape changes rather than simply
       rotating: up and down the pitch that axis is its length, and
       side-on it is its width. */
    var rw, rh;
    if (SIDE) { rw = 54; rh = Math.max(14, Math.round(rw * (PITCH.w / PITCH.h) * 0.62)); }
    else { rw = 54; rh = Math.round(rw * (PITCH.h / PITCH.w) * 0.62); }
    /* AND IT MOVES OUT FROM UNDER HER THUMB.

       Bottom right is the right corner for a radar on a keyboard, and
       it is exactly where the pass button sits on a phone — a hundred
       and fifty pixels of blue glass painted straight over the one
       instrument that exists to tell her about the players she cannot
       see. Two instruments in one corner is not one instrument and a
       half, it is neither.

       Moving it to the top right instead put it straight through the
       super's nameplate, which lives up there and is longer than it
       looks. So it stays in its own corner and slides inboard of the
       button — the bottom of the frame is the emptiest part of a
       side-on shot, and a radar an inch to the left is still a radar
       where she is already looking. */
    var rx = UIW - rw - 6 - (hudTouch() ? Math.round(UIW * 0.15) : 0);
    var ry = UIH - rh - 6;
    /* kept where a harness can read it: the radar is painted on a
       canvas and the thumb button is a DOM element, so "do these two
       overlap" is a question nothing else in the page can answer */
    RADAR_BOX = { x: rx, y: ry, w: rw, h: rh, ui: [UIW, UIH] };
    /* the box, with the pitch's own dark green inside it */
    box(rx - 2, ry - 2, rw + 4, rh + 4, "#0d1412");
    box(rx - 1, ry - 1, rw + 2, rh + 2, "#2a3a34");
    /* two mowing bands, so it reads as a pitch and not as a gauge */
    if (SIDE) {
      for (var mb = 0; mb < rw; mb++) {
        box(rx + mb, ry, 1, rh, (Math.floor(mb / 4) & 1) ? "#2f6b34" : "#37793c");
      }
    } else {
      for (var mb2 = 0; mb2 < rh; mb2++) {
        box(rx, ry + mb2, rw, 1, (Math.floor(mb2 / 4) & 1) ? "#2f6b34" : "#37793c");
      }
    }
    /* the markings: halfway, the circle, and a mouth at each end */
    var rcx = rx + Math.round(rw / 2), rcy = ry + Math.round(rh / 2);
    if (SIDE) box(rcx, ry, 1, rh, "#7fae86");
    else box(rx, rcy, rw, 1, "#7fae86");
    for (var ca = 0; ca < 12; ca++) {
      var aa = (ca / 12) * Math.PI * 2;
      box(rcx + Math.round(Math.cos(aa) * (SIDE ? 5 : 5)),
          rcy + Math.round(Math.sin(aa) * (SIDE ? 3 : 4)), 1, 1, "#7fae86");
    }
    /* WHICH END IS WHOSE, in the two sides' own colours — the only way
       to know which way you are kicking without a label. */
    /* `first` is the end the pitch's low y sits at: the top of an
       upright radar, the right of a side-on one, because the renderer's
       long axis counts backwards. */
    var lowYIsHers = attackDir(0) < 0;
    if (SIDE) {
      var gh = Math.round(rh * 0.42), gy = ry + Math.round((rh - gh) / 2);
      box(rx + rw - 2, gy, 2, gh, lowYIsHers ? bCol : aCol);
      box(rx, gy, 2, gh, lowYIsHers ? aCol : bCol);
    } else {
      var gw = Math.round(rw * 0.34), gx = rx + Math.round((rw - gw) / 2);
      box(gx, ry, gw, 2, lowYIsHers ? bCol : aCol);
      box(gx, ry + rh - 2, gw, 2, lowYIsHers ? aCol : bCol);
    }

    /* the players. Drawn smallest first so the one being driven and the
       man on the ball end up on top of the pile rather than under it. */
    var rpx = SIDE
      /* side-on: the length runs across, low y to the right, and the
         near touchline is at the bottom exactly as it is on the grass */
      ? function (wx, wy) {
          return { x: rx + Math.round((PITCH.y1 - wy) / PITCH.h * (rw - 1)),
                   y: ry + Math.round((PITCH.x1 - wx) / PITCH.w * (rh - 1)) };
        }
      : function (wx, wy) {
          return { x: rx + Math.round((wx - PITCH.x0) / PITCH.w * (rw - 1)),
                   y: ry + Math.round((wy - PITCH.y0) / PITCH.h * (rh - 1)) };
        };
    var plot = [];
    G.players.forEach(function (q) {
      plot.push({ p: q, rank: q === G.controlled ? 2 : (G.ball.owner === q ? 1 : 0) });
    });
    plot.sort(function (m, n) { return m.rank - n.rank; });
    plot.forEach(function (e) {
      var q = e.p, r2 = rpx(q.x, q.y);
      if (r2.x < rx || r2.x >= rx + rw || r2.y < ry || r2.y >= ry + rh) return;
      var col = q.team === 0 ? aCol : bCol;
      if (q.gk) col = lift(col, -40);
      box(r2.x - 1, r2.y - 1, 3, 3, "#0d1412");
      box(r2.x, r2.y, 2, 2, col);
      /* the one she is driving wears the same ring here as on the grass */
      if (q === G.controlled) {
        box(r2.x - 2, r2.y - 2, 5, 1, "#ffffff");
        box(r2.x - 2, r2.y + 2, 5, 1, "#ffffff");
        box(r2.x - 2, r2.y - 1, 1, 3, "#ffffff");
        box(r2.x + 2, r2.y - 1, 1, 3, "#ffffff");
      }
    });
    /* and the ball, last and brightest, because it is the one thing on
       the radar you are always looking for */
    var rb = rpx(G.ball.x, G.ball.y);
    if (rb.x >= rx && rb.x < rx + rw && rb.y >= ry && rb.y < ry + rh) {
      box(rb.x - 1, rb.y - 1, 3, 3, "#0d1412");
      box(rb.x, rb.y, 1, 1, "#ffffff");
    }

    /* WHAT THE CAMERA IS LOOKING AT, as a bracket rather than a box.

       A full rectangle drawn over a forty-pixel radar covers most of
       it; four corners say the same thing and leave the dots visible. */
    if (SIDE && R2 && R2.project) {
      /* SIDE-ON THE FRAME IS BOUNDED BY THE LENS, NOT BY THE ROWS.

         Up and down the pitch the top and bottom screen rows are
         looking at two depths, and `rowAt` reads them straight off.
         Turned sideways the frame's edges are its left and right,
         which is the across-the-screen half-width at the depth being
         watched — arithmetic on the projection rather than a lookup. */
      var bp = R2.project(wX(G.ball.x), wY(G.ball.y));
      if (bp.k > 0.001) {
        var halfW = (R2.vw / 2) / bp.k;
        var midY = PITCH.y1 - R2.cam.y;
        var e0 = clamp(midY - halfW, PITCH.y0, PITCH.y1);
        var e1 = clamp(midY + halfW, PITCH.y0, PITCH.y1);
        var vxa = Math.min(rpx(PITCH.cx, e0).x, rpx(PITCH.cx, e1).x);
        var vxb = Math.max(rpx(PITCH.cx, e0).x, rpx(PITCH.cx, e1).x);
        if (vxb - vxa > 3) {
          for (var ck = 0; ck < 2; ck++) {
            var vyr = ck ? ry + rh - 1 : ry;
            box(vxa, vyr, 3, 1, "#e8f0e8");
            box(vxb - 2, vyr, 3, 1, "#e8f0e8");
          }
        }
      }
    } else if (R2 && R2.rowAt) {
      var top = clamp(PITCH.y1 - R2.rowAt(0), PITCH.y0, PITCH.y1);
      var bot = clamp(PITCH.y1 - R2.rowAt(R2.vh - 1), PITCH.y0, PITCH.y1);
      var vy0 = rpx(PITCH.cx, Math.min(top, bot)).y;
      var vy1 = rpx(PITCH.cx, Math.max(top, bot)).y;
      if (vy1 - vy0 > 3) {
        for (var cc = 0; cc < 2; cc++) {
          var vx = cc ? rx + rw - 1 : rx;
          box(vx, vy0, 1, 3, "#e8f0e8");
          box(vx, vy1 - 2, 1, 3, "#e8f0e8");
        }
      }
    }

    /* ---- STAMINA, low on the left where her thumb already is ----- */
    var st = G.controlled ? G.controlled.stamina : 1;
    hudBar(6, UIH - 10, 58, 4, st,
           st < 0.3 ? "#e0556b" : st < 0.6 ? "#e8b23c" : "#5fd6cc");
    /* the word only while the legend it belongs to is still up. After
       that the bar is the only bar on the screen and it is sitting
       under her own meter, which is label enough. */
    if (legend > 0) {
      UIX.save(); UIX.globalAlpha = legend;
      drawText(6, "RUN", UIH - 17, { colour: "#5f8a7a" });
      UIX.restore();
    }

    /* ---- THE CONTROLS, measured off the real ones ---------------- */
    var pl = G.controlled;
    var carrying = pl && G.ball.owner === pl;
    var held = carrying && IN.held;
    var charge = held ? clamp(IN.heldT / TUNE.chargeTime, 0, 1) : 0;
    var lbl = carrying ? (held ? "SHOOT" : "PASS") : "TACKLE";
    hudRound(uiRectOf(EL["cup-btn"]), lbl,
             charge > 0.92 ? "#e8b23c" : "#2f6d8a",
             charge > 0.92 ? "#2a1c08" : "#f4f4e8", charge);
    if (EL["cup-sup-btn"] && !EL["cup-sup-btn"].hidden) {
      hudRound(uiRectOf(EL["cup-sup-btn"]),
               fitText((sup && sup.name) || "SUPER", 34, 1), hc, "#2a1010", 0,
               function (ix2, iy2) {
                 box(ix2 - 3, iy2 - 2, 2, 2, "#ffffff");
                 box(ix2 + 2, iy2 - 2, 2, 2, "#ffffff");
                 box(ix2 - 3, iy2 - 1, 7, 2, "#ffffff");
                 box(ix2 - 2, iy2 + 1, 5, 1, "#ffffff");
                 box(ix2, iy2 + 2, 1, 1, "#ffffff");
               });
    }
    /* the pause, top right */
    var pr = uiRectOf(EL["cup-pause-btn"]);
    if (pr) {
      var qx = Math.round(pr.x), qy = Math.round(pr.y);
      var qw = Math.round(pr.w), qh = Math.round(pr.h);
      box(qx, qy, qw, qh, "#0d1412");
      box(qx + 1, qy + 1, qw - 2, qh - 2, "#243640");
      line(qx + 1, qy + 1, qw - 2, 1, "#3f5866");
      box(qx + Math.round(qw / 2) - 3, qy + Math.round(qh / 2) - 4, 2, 8, "#cfe0d8");
      box(qx + Math.round(qw / 2) + 1, qy + Math.round(qh / 2) - 4, 2, 8, "#cfe0d8");
    }
    /* THE HINT AND THE KEYS, which were the last two runs of CSS text
       sitting on the grass. They are set small and dim because they are
       for the first thirty seconds of the first match and nothing
       after it. */
    /* THE LEGEND IS FOR THE FIRST MINUTE, AND THEN IT IS LITTER.

       Printed every frame of every match it is three permanent boxes
       of text sitting on a pitch, competing with the football for the
       same corner of the frame. She reads it once. So it fades out
       after the opening of her first match, and the place it lives
       from then on is the pause screen and the how-to — which is where
       somebody who has forgotten a control would actually go looking
       for it. */
    var legend = run.round === 0 && G.half === 1
      ? clamp((16 - G.clock) / 3, 0, 1) : 0;
    if (legend <= 0) { /* nothing on the grass */ }
    else if (hudTouch()) {
      UIX.save(); UIX.globalAlpha = legend;
      drawText(6, "SLIDE TO RUN", UIH - 42, { colour: "#4f7a6a" });
      UIX.restore();
    } else {
      UIX.save(); UIX.globalAlpha = legend;
      /* WHERE IT SITS, after three attempts that each landed it on
         something else: hard against the bottom-right it covered the
         thumb button, beside the meter it collided with the super's
         nameplate, and at sixty-four from the top it printed across the
         advertising hoardings and the front rows of the stand. This is
         low enough to be on grass and high enough to clear the
         possession strip. */
      /* clear of the heart meter, which now lives in this corner */
      var kz = UIH - 74;
      [["W A S D", "run"],
       ["SPACE", "tap to pass \u00b7 hold to shoot"],
       ["SHIFT", "super, when the heart is full"]].forEach(function (k2) {
        var kw = textWidth(k2[0]) + 8;
        var tw2 = textWidth(k2[1]);
        var tot = kw + tw2 + 12;
        /* DOWN THE LEFT, because the radar lives bottom-right now and a
           legend printed across a radar is two instruments you cannot
           read instead of one you can */
        var x0 = 6;
        box(x0, kz, tot, 11, "#0d1412");
        box(x0 + 1, kz + 1, tot - 2, 9, "#1b2a32");
        box(x0 + 2, kz + 2, kw, 7, "#2f4450");
        drawText(x0 + 6, k2[0], kz + 3, { colour: "#e8f0e8" });
        drawText(x0 + kw + 6, k2[1], kz + 3, { colour: "#8fa8a0" });
        kz += 13;
      });
      UIX.restore();
    }

    /* =====================================================================
       THE CARD

       Held up, not printed in a corner. A referee showing a card is one
       of the few images in football that everybody reads instantly
       without a word on it, and the whole of it is: a coloured
       rectangle, held high, still, for a beat. It rises as it appears
       and holds, because a card that slides around is a notification
       and a card that is held is a decision.
       ===================================================================== */
    if (G.card) {
      {
        var ct = G.card.t;
        var rise = ct < 0.24 ? 1 - Math.pow(1 - ct / 0.24, 3) : 1;
        var fade = ct > 2.1 ? 1 - (ct - 2.1) / 0.3 : 1;
        var cw2 = 15, ch2 = 21;
        var cX = Math.round(UIW / 2 - cw2 / 2);
        var cY = Math.round(UIH * 0.30 + (1 - rise) * 22);
        UIX.save();
        UIX.globalAlpha = clamp(fade, 0, 1);
        box(cX - 2, cY - 2, cw2 + 4, ch2 + 4, "#0d1412");
        var face = G.card.kind === "red" ? "#d8323c" : "#f0c53a";
        box(cX, cY, cw2, ch2, face);
        box(cX, cY, cw2, 1, lift(face, 60));
        box(cX, cY + ch2 - 1, cw2, 1, lift(face, -60));
        /* the name under it, so it is clear who it was */
        var who = fitText(G.card.p ? G.card.p.name : "", 96, 1);
        var ww = textWidth(who) + 8;
        box(Math.round(UIW / 2 - ww / 2), cY + ch2 + 4, ww, 9, "#0d1412");
        drawText(Math.round(UIW / 2), who, cY + ch2 + 5,
                 { align: "center", colour: "#f4f4e8" });
        UIX.restore();
      }
    }

    /* =====================================================================
       THE ANNOUNCEMENT

       A stadium tells you what just happened, in a form nobody has to
       read to understand: a lower third, the scorer's name large, the
       minute after it. It is the last piece of broadcast furniture this
       chapter was missing, and the reason it matters is that a goal in
       a four-a-side game is over in a fifth of a second and often
       nobody is sure WHO got it.

       It is deliberately not the super's nameplate. That one is an
       event announcing itself; this one is the ground reporting a fact,
       so it is flatter, wider, lower and in the scoring side's colour
       rather than in a super's.
       ===================================================================== */
    if (G.pa) {
      var pt = G.pa.t;
      var pk = pt < 0.22 ? pt / 0.22 : (pt > 3.1 ? 1 - (pt - 3.1) / 0.4 : 1);
      pk = clamp(pk, 0, 1);
      var pe = 1 - Math.pow(1 - pk, 3);
      var pw = 178, ph = 26;
      var px3 = Math.round((UIW - pw) / 2);
      var py3 = Math.round(UIH - 54 + (1 - pe) * 14);
      UIX.save();
      UIX.globalAlpha = pe;
      box(px3 + 2, py3 + 2, pw, ph, "rgba(4,8,10,.45)");
      box(px3, py3, pw, ph, "#0d1412");
      box(px3 + 1, py3 + 1, pw - 2, ph - 2, "#121b20");
      box(px3 + 1, py3 + 1, 4, ph - 2, G.pa.col);
      line(px3 + 1, py3 + 1, pw - 2, 1, lift(G.pa.col, 40));
      drawText(px3 + 10, fitText(G.pa.kicker, pw - 22, 1), py3 + 4,
               { colour: lift(G.pa.col, 55) });
      drawText(px3 + 10, fitText(G.pa.line, pw - 22, 1), py3 + 14,
               { colour: "#ffffff" });
      if (G.pa.right) {
        drawText(px3 + pw - 8, G.pa.right, py3 + 14,
                 { align: "right", colour: "#9fb0a8" });
      }
      UIX.restore();
    }

    drawReplayBadge();

    /* THE SUPER'S NAMEPLATE GOES ON LAST, over everything, because it
       is the one thing on screen that is more important than the rest
       of the screen while it is up. */
    drawSuperCard();

    /* and where her thumb actually is on the stick */
    var sk = uiRectOf(EL["cup-stick-k"]);
    if (sk && sk.w > 4) {
      var sc2 = Math.round(sk.x + sk.w / 2), sy2 = Math.round(sk.y + sk.h / 2);
      var sr = Math.round(sk.w / 2);
      for (var q = 0; q < 28; q++) {
        var qa = (q / 28) * Math.PI * 2;
        box(Math.round(sc2 + Math.cos(qa) * sr), Math.round(sy2 + Math.sin(qa) * sr),
            1, 1, "#9fe8c4");
      }
      box(sc2 - 1, sy2 - 1, 3, 3, "#ffffff");
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
  /* =======================================================================
     THE LAST PIECE OF CSS IN THE CHAPTER

     Every other card, menu, meter and number in this chapter is drawn
     — one canvas, one bitmap font, whole pixels. This one was still a
     DOM element with a stylesheet transition on it, and the reason
     given was that "at the size the pitch is rendered, painted text is
     a smudge". That was true when it was written and stopped being
     true when the font went in: the scoreboard, the fixture cards and
     the menus all carry lettering at this size and none of them
     smudges.

     Leaving it as DOM cost two real things. It animated on the
     BROWSER'S clock rather than the match's, so it kept sliding during
     hit-stop and slow motion while everything behind it held still —
     the one moment in the game where that is most obvious. And it was
     laid out in CSS pixels over a canvas scaled to whole ones, so on
     most window sizes its edges landed on half pixels and it was the
     only soft-edged thing on the screen.

     Drawn, it is on the match's clock and on the pixel grid, and the
     element it used to live in is kept for one job only: telling a
     screen reader what just happened.
     ======================================================================= */
  var superCard = null;          // { s, p, t } while it is up

  function superBanner(s, p) {
    superCard = { s: s, p: p, t: 0 };
    /* the words still go to the accessibility mirror, because a drawn
       banner is invisible to everything that is not an eye — and it has
       to be the live one, because this happens mid-match with no card
       on screen to carry it */
    announce((p ? p.name + " \u2014 " : "") + s.name + ". " +
             (superKind(s.kind).say || s.note || ""));
  }
  function clearSuperBanner() { superCard = null; }

  /* it runs on the match clock, so it holds when the match holds */
  function superCardStep(dt) {
    if (!superCard) return;
    superCard.t += dt;
    if (superCard.t > 2.6) superCard = null;
  }

  function drawSuperCard() {
    if (!superCard || !UIX) return;
    var c = superCard, sp = c.s;
    /* IN, HOLD, OUT — and the in and the out are the same curve run
       backwards, which is the cheapest way to make a thing arrive and
       leave as though it weighs something. */
    var t = c.t;
    var k = t < 0.26 ? t / 0.26 : (t > 2.3 ? 1 - (t - 2.3) / 0.3 : 1);
    k = clamp(k, 0, 1);
    var ease = 1 - Math.pow(1 - k, 3);
    var them = sp.by && sp.by.team === 1;
    var col = sp.colour || "#ff5f8f";
    var who = (c.p && c.p.name) || "";
    var note = superKind(sp.kind).say || sp.note || "";

    var w = 200, h = 40;
    /* it comes in from the side the player is on, so a super of theirs
       and a super of hers do not arrive identically */
    var x0 = Math.round((UIW - w) / 2);
    var x = Math.round(x0 + (them ? 1 : -1) * (1 - ease) * 70);
    /* LOW ENOUGH TO BE ON GRASS. At three tenths of the frame it landed
       across the advertising hoardings and the front of the stand, and
       a nameplate over a nameplate is two things you cannot read. */
    var y = Math.round(UIH * 0.44);
    UIX.save();
    UIX.globalAlpha = ease;
    /* the plate: a hard shadow, a dark body, and the super's own colour
       down the leading edge */
    box(x + 2, y + 3, w, h, "rgba(4,8,10,.45)");
    box(x, y, w, h, "#0d1412");
    box(x + 1, y + 1, w - 2, h - 2, "#141e24");
    box(x + 1, y + 1, 4, h - 2, col);
    line(x + 1, y + 1, w - 2, 1, lift(col, 30));
    line(x + 1, y + h - 2, w - 2, 1, "#000000");
    /* a sweep of light crossing it as it lands */
    if (t < 0.7) {
      var sw = Math.round(((t / 0.7) * (w + 30)) - 15);
      for (var i = 0; i < 10; i++) {
        var sx = x + sw + i;
        if (sx > x + 1 && sx < x + w - 1) {
          UIX.globalAlpha = ease * 0.16 * (1 - i / 10);
          box(sx, y + 1, 1, h - 2, "#ffffff");
        }
      }
      UIX.globalAlpha = ease;
    }
    drawText(x + 10, fitText(who, w - 20, 1), y + 5, { colour: lift(col, 50) });
    /* THE NAME AT TWO, OR AT ONE IF TWO WILL NOT FIT.

       Ellipsised at double size, "HEARTBEAT STRIKE" came out as
       "HEARTBEAT..." — which loses the word that says what it is. A
       super's name is short enough to read at single size and there is
       no version of this where three dots are better than the name, so
       it drops a size rather than dropping the words. */
    var nm = sp.name || "SUPER";
    var big = textWidth(nm, 2) <= w - 20;
    drawText(x + 10, big ? nm : fitText(nm, w - 20, 1), y + (big ? 13 : 15),
             { scale: big ? 2 : 1, colour: "#ffffff",
               outline: "#0d1412", outlineW: 1 });
    drawText(x + 10, fitText(note, w - 20, 1), y + 30, { colour: "#9fb0a8" });
    UIX.restore();
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
      e.stopPropagation(); SFX.back(); opts.onAlt();
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

  /* THE FOUR HTML BLOCKS THAT USED TO BE HERE ARE GONE.

     teamSheet, teamsBlock, bracketBlock and statsBlock built the middle
     of a DOM card out of strings. Every card is drawn now, and the
     things that replaced them — cardTeams, cardBracket, cardStats and
     cardScore — are up with cardScreen, where the rest of the card is.
     ROLE_NAME stayed because it is the one thing in here that was about
     football rather than about HTML. */

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
  /* where the radar landed this frame, in UI coordinates — see the note
     at the point it is written */
  var RADAR_BOX = null;

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

    /* THE LABEL AND ITS NOTE ARE ONE BLOCK, AND IT FITS.

       The label used to be centred as if it were alone, with the note
       hung underneath it — so on a button with a note the pair sat low
       and the note ran out through the bottom edge. And neither was
       ever measured against the button's own width, so "six faculties ·
       three rounds · one trophy" simply carried on out through both
       sides of the frame it was printed in. */
    var sc = b.scale || 1;
    var blockH = FONT_H * sc + (b.sub ? FONT_H + 2 : 0);
    var ty = y2 + oy + Math.round((h - blockH) / 2);
    var midX = x2 + Math.round(w / 2);
    drawText(midX, fitText(b.label, w - 8, sc), ty,
             { align: "center", colour: b.ink || "#ffffff",
               scale: sc, shadow: "rgba(0,0,0,.55)" });
    if (b.sub) {
      drawText(midX, fitText(b.sub, w - 10, 1), ty + FONT_H * sc + 2,
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
  var UI = { screen: null, name: "", t: 0, widgets: [], say: [], hot: null,
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
    /* THE SAME PIXEL GRID AS THE PITCH. The renderer's base frame now
       follows the screen, so a UI pinned to a constant 480x270 would be
       stretched by a different, fractional amount than the pitch beside
       it — two pixel grids in one picture, which is the one thing the
       whole retro layer exists to avoid. */
    var w = R2.baseW || window.CupPitch2D.BASE_W;
    var h = R2.baseH || window.CupPitch2D.BASE_H;
    /* WITH THE PIXEL LAYER OFF, the renderer's buffer is the full CSS
       size of the stage — a thousand pixels across. A five-by-seven
       font in that is three millimetres tall and the menus become
       unreadable, so the UI keeps its own resolution whatever the pitch
       is doing. PIXEL.on is about the GAME's look; the menus are pixel
       art either way. */
    if (!cfg("PIXEL.on", true)) {
      var aspect = w / h;
      h = clamp(Math.round(h / 1.4), 140, 300);
      w = Math.max(2, Math.round(h * aspect));
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
    UI.widgets = []; UI.say = [];
    if (uiCvs) { uiCvs.hidden = false; uiCvs.classList.add("on"); }
    UI.on = true;
    hideOverlay();                 // the DOM cards and this are never both up
  }
  /* WHETHER THE MATCH HUD SHOULD BE PAINTING, asked rather than told.

     Nine places in this file hide or show the scoreboard — half time,
     full time, the memories, the pause, quitting, the builder. Rather
     than teach all nine about a second flag that could drift out of
     step with the first, the drawn HUD simply follows the element they
     already toggle. */
  function hudWanted() {
    return !!(G && EL["cup-hud"] && !EL["cup-hud"].hidden);
  }

  function uiClose() {
    UI.screen = null; UI.name = ""; UI.widgets = []; UI.say = []; UI.on = false;
    a11yKey = "";
    if (EL["cup-ui-a11y"]) EL["cup-ui-a11y"].innerHTML = "";
    if (uiCvs) {
      uiCvs.classList.remove("on");
      /* the canvas stays up if the match is behind the menu that just
         closed — otherwise closing half time would take the scoreboard
         with it */
      uiCvs.hidden = !hudWanted();
    }
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
                      label: label, sub: opts.sub, back: !!opts.back });
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
  /* WHICH SOUND A DRAWN BUTTON MAKES.

     There has been a `back` sound in the bank since the bank was
     written and nothing has ever played it: every widget in every menu
     answered with the same rising `pick`, including the ones that take
     you backwards. Going back and going forward sounding identical is
     the kind of thing nobody points at and everybody feels, because the
     ear reads pitch direction as progress or retreat. A widget that
     undoes, cancels, leaves or goes back falls instead of rising. */
  function uiBackish(w) {
    if (!w) return false;
    if (w.back) return true;
    var id = String(w.id || "").toLowerCase();
    if (id === "back" || id === "cancel" || id.indexOf("_back") >= 0) return true;
    var lab = String(w.label || "").toUpperCase();
    return lab === "BACK" || lab === "CANCEL" ||
           lab.indexOf("LEAVE") === 0 || lab.indexOf("NOT NOW") === 0;
  }
  function uiGo(w) {
    if (!w || !w.go) return;
    if (uiBackish(w)) SFX.back(); else SFX.pick();
    w.go();
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
      if (fired && fired.go) uiGo(fired);
    };
    uiCvs.addEventListener("pointerup", release);
    uiCvs.addEventListener("pointercancel", function () { UI.down = null; });
    uiCvs.addEventListener("pointerleave", function () {
      UI.down = null; UI.hot = null;
    });
  }
  /* the keyboard, because a menu you cannot tab through is a menu half
     the people who open it cannot use */
  /* =======================================================================
     TYPING ON A CANVAS

     One field in the whole chapter takes typing: the name of a squad she
     has built herself. While the builder was DOM that was an <input> and
     the browser did all of it. It is drawn now, so this is the smallest
     thing that can honestly be called a text field — a value, a caret
     that blinks, and a key handler that understands letters, backspace
     and the two ways of saying "done".

     It deliberately does not do selection, arrow keys or a clipboard.
     A twenty-two character team name does not need them, and half an
     implementation of each would be worse than none.
     ======================================================================= */
  var edit = null;                 // { value, max, onDone } or null
  function editOpen(value, max, onDone) {
    edit = { value: String(value || ""), max: max || 22, onDone: onDone };
  }
  function editClose(commit) {
    if (!edit) return;
    var e = edit; edit = null;
    if (commit && e.onDone) e.onDone(e.value);
  }
  function editKey(k) {
    if (!edit) return false;
    if (k === "Enter") { editClose(true); return true; }
    if (k === "Escape") { editClose(false); return true; }
    if (k === "Backspace") {
      edit.value = edit.value.slice(0, -1);
      return true;
    }
    /* one printable character, and only ones the font can draw — there
       is no point accepting a letter that comes out as a blank */
    if (k.length === 1 && edit.value.length < edit.max && glyph(k.toUpperCase())) {
      edit.value += k;
      return true;
    }
    return k.length === 1;         // swallow the rest rather than navigating
  }
  /* the field itself: a sunken box, the value, and a caret on the beat */
  function textField(x2, y2, w, h, value, focused) {
    box(x2, y2, w, h, "#0d1412");
    box(x2 + 1, y2 + 1, w - 2, h - 2, focused ? "#22343c" : "#18262c");
    line(x2 + 1, y2 + 1, w - 2, 1, "#0a1014");
    line(x2 + 1, y2 + h - 2, w - 2, 1, focused ? "#3d5560" : "#2a3a42");
    var tx = x2 + 5, ty = y2 + Math.round((h - FONT_H) / 2);
    var shown = fitText(value, w - 14, 1);
    drawText(tx, shown, ty, { colour: focused ? "#ffffff" : "#cfe0d8" });
    if (focused && Math.floor(UI.t * 2.4) % 2 === 0) {
      box(tx + textWidth(shown) + 1, ty - 1, 1, FONT_H + 2, "#ffe9a8");
    }
  }

  function uiKey(k) {
    if (editKey(k)) return true;
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
      if (w && w.go) uiGo(w);
      return true;
    }
    return false;
  }

  function uiPaint() {
    if (!UI.screen || !UIX) return;
    UIX.clearRect(0, 0, UIW, UIH);
    UI.widgets = []; UI.say = [];
    UI.screen(UI.t - UI.born);
    syncA11y();
  }

  /* The mirror is rebuilt only when the set of buttons changes, not on
     every frame — sixty DOM rebuilds a second would be worse than not
     having it. */
  var a11yKey = "";
  /* WHAT THE SCREEN SAYS, FOR SOMEBODY WHO CANNOT SEE IT.

     While the cards were DOM, their words were in the page and a screen
     reader found them for nothing. They are painted pixels now, so they
     are not in the page at all — and the mirror beside the canvas only
     ever listed the BUTTONS, which for the how-to screen meant three
     paragraphs of rules came out as the single word "GOT IT".

     Any screen can push a line of its own text into `UI.say` while it
     draws, and it lands in the mirror above the buttons. */
  function uiSay(str) {
    if (str) UI.say.push(String(str));
  }

  /* SAYING SOMETHING WHILE THE MATCH IS RUNNING.

     `uiSay` only works inside a card. It pushes onto UI.say, and UI.say
     is cleared and mirrored into the DOM by uiPaint — which does
     nothing at all unless a card is open. So a line pushed during play
     is never announced, and worse, it sits in the array until the next
     card opens and then turns up at the top of THAT card's mirror.

     The drawn super nameplate is the first thing in the chapter that
     has to speak while the football is still going, so it needs a live
     region of its own: straight into the mirror beside the canvas, and
     taken down again afterwards so the mirror stays a description of
     what is on screen rather than a transcript of the match. */
  var sayTimer = null;
  function announce(str) {
    if (!str) return;
    if (UI.screen) return uiSay(str);
    var host = EL["cup-ui-a11y"];
    if (!host) return;
    /* ONE LIVE LINE AT A TIME.

       The first version kept a single timer handle and cleared it
       whenever a new line arrived — which cancels the removal of the
       PREVIOUS node without removing it, so a busy passage (a goal, a
       card and a restart inside four seconds) left a growing stack of
       paragraphs in the mirror, each one still being read out. A
       screen reader wants the latest thing that happened, not a
       transcript, so the old line goes when the new one arrives. */
    var old = host.querySelectorAll(".cup-a11y-live");
    for (var i = 0; i < old.length; i++) {
      if (old[i].parentNode) old[i].parentNode.removeChild(old[i]);
    }
    var el = document.createElement("p");
    el.className = "cup-a11y-live";
    el.textContent = String(str);
    host.appendChild(el);
    if (sayTimer) clearTimeout(sayTimer);
    sayTimer = setTimeout(function () {
      if (el.parentNode) el.parentNode.removeChild(el);
      sayTimer = null;
    }, 4200);
  }

  function syncA11y() {
    var host = EL["cup-ui-a11y"];
    if (!host) return;
    var key = UI.name + "|" + UI.say.join(" ") + "|" +
      UI.widgets.map(function (w) {
        return w.id + ":" + (w.label || "");
      }).join(",");
    if (key === a11yKey) return;
    a11yKey = key;
    host.innerHTML = "";
    UI.say.forEach(function (t) {
      var p2 = document.createElement("p");
      p2.textContent = t;
      host.appendChild(p2);
    });
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

  /* barsHtml and animateBars have gone with the DOM card they filled.
     The bars on Team Select and in the squad builder are statBar, drawn
     into the pixel layer, and they overshoot and settle in the paint
     loop rather than by handing a percentage to CSS. */

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
  /* =======================================================================
     THE TITLE MENU

     The last of the big CSS cards, and the one the whole pixel-UI brief
     was aimed at. It was a rounded panel with a serif heading, blurred
     drop shadows and six gradient pills, floating over a pixel world —
     which is the mismatch the rest of this rebuild exists to fix. Every
     mark on it is now made at the pitch's own resolution: the frame, the
     bevels, the trophy, the icons and the type.

     What it gains from being drawn rather than laid out: the line-up
     behind it is the real line-up, the buttons arrive one after another
     rather than all at once, the trophy turns, and the whole thing runs
     on the same clock as the game underneath it.
     ======================================================================= */

  /* Nine-pixel icons, drawn as runs rather than as paths. A menu of six
     identical rectangles is a list; the icon is what makes each row a
     thing rather than a line of text. */
  var MENU_ICON = {
    coupe: ["..###..", ".#####.", "#######", ".#####.", "..###..",
            "...#...", "..###.."],
    amical: [".##.##.", "#######", "#######", ".#####.", "..###..",
             "...#...", "......."],
    derby: ["...#...", "..###..", ".#####.", "#######", "..###..",
            ".#.#.#.", "#.....#"],
    teams: [".#...#.", "###.###", "..#.#..", ".#####.", "#######",
            "#.###.#", "#.#.#.#"],
    help: [".#####.", "#.....#", "....##.", "...#...", "...#...",
           ".......", "...#..."],
    quit: ["...#...", "..##...", ".######", "##.....", ".######",
           "..##...", "...#..."],
  };
  function menuIcon(kind, x2, y2, col) {
    var art = MENU_ICON[kind];
    if (!art) return;
    for (var r = 0; r < art.length; r++) {
      for (var c = 0; c < art[r].length; c++) {
        if (art[r][c] === "#") box(x2 + c, y2 + r, 1, 1, col);
      }
    }
  }

  /* the trophy, in pixels, with a gleam that travels across it */
  function pixTrophy(x2, y2, t) {
    var GOLD = "#e8b84b", LIT = "#f6d878", DK = "#8a5f18", INK = "#0d1412";
    box(x2 - 1, y2 - 1, 16, 12, INK);
    box(x2, y2, 14, 10, GOLD);
    box(x2 + 1, y2 + 1, 5, 2, LIT);
    box(x2 + 1, y2 + 8, 12, 2, DK);
    /* the handles, and the ink round them */
    box(x2 - 3, y2 + 1, 3, 6, INK); box(x2 - 2, y2 + 2, 2, 4, GOLD);
    box(x2 + 14, y2 + 1, 3, 6, INK); box(x2 + 14, y2 + 2, 2, 4, GOLD);
    /* stem and base */
    box(x2 + 5, y2 + 10, 4, 4, DK);
    box(x2 + 2, y2 + 14, 10, 3, INK);
    box(x2 + 3, y2 + 14, 8, 2, GOLD);
    /* HER HEART ON IT, because it is her cup */
    var hx = x2 + 4, hy = y2 + 3, HRT = "#ff5f8f";
    box(hx, hy, 2, 2, HRT); box(hx + 3, hy, 2, 2, HRT);
    box(hx, hy + 1, 5, 2, HRT); box(hx + 1, hy + 3, 3, 1, HRT);
    box(hx + 2, hy + 4, 1, 1, HRT);
    /* the gleam: one lit column crossing the cup on a slow cycle */
    var g = ((t * 0.5) % 2.6) / 2.6;
    if (g < 0.4) {
      var gx = x2 + Math.round(g * 34) - 1;
      if (gx >= x2 && gx < x2 + 14) box(gx, y2 + 1, 1, 8, "#fffaf0");
    }
  }

  function titleMenu() {
    lineUp(run.myTeam);
    scoreCue("menu");
    var modes = cfg("MODES", []);
    var mine = teamById(run.myTeam) || {};
    var accent = (mine.kit && mine.kit.shirt) || "#c1272d";
    var trim = (mine.kit && mine.kit.trim) || "#e8b23c";
    var cols = [accent, trim, (mine.kit && mine.kit.shorts) || "#f6efdd",
                lift(accent, -40)];

    /* the six rows, in the order she meets them */
    var rows = modes.map(function (m) {
      return { id: m.id, name: m.name, note: m.note, primary: m.primary };
    });
    rows.push({ id: "teams", name: "THE TEAMS",
                note: "pick a faculty, or build your own squad" });
    rows.push({ id: "help", name: "HOW TO PLAY", note: "one stick, two buttons" });
    rows.push({ id: "quit", name: "BACK TO THE BOOK", note: "" });

    var act = {
      coupe: function () {
        run.fixture = null; run.quick = false; run.round = 0;
        uiClose(); roundCard();
      },
      /* the derby is its own fixture: his faculty against hers, under
         the lights, and it does not need a bracket to matter */
      derby: function () {
        var hers = derbyTeam("hers"), theirs = derbyTeam("his");
        run.myTeam = hers;
        run.quick = true;
        run.fixture = { mine: hers, theirs: theirs, venue: "night",
          round: { round: "THE DERBY", skill: 0.72, venue: "night",
                   before: "Dentistry against medicine. He has been talking " +
                           "about this one for a fortnight.",
                   won: "You beat his faculty. He will hear about it all year.",
                   lost: "His faculty took it. He is being very gracious, which is worse." } };
        run.round = 0;
        uiClose(); roundCard();
      },
      amical: function () { carAt = 0; teamSelect("quick"); },
      teams: function () { carAt = 0; teamSelect("pick"); },
      help: function () { uiClose(); helpCard(titleMenu); },
      quit: function () { uiClose(); quit(); },
    };

    uiOpen("title", function (age) {
      heartsStep(1 / 60);
      /* lighter than the team screen's: this one has a whole pitch
         behind it rather than a single spotlit character, and at full
         strength the dither read as a smudge down the left-hand edge */
      vignette(0.62);
      bunting(0, cols, UI.t);

      /* ---- THE LOCKUP. A trophy, the name, and the line under it, as
         one block with its own weight rather than a heading that could
         have come off any card in the chapter. ---- */
      var tp = slideIn(age, 0, -30);
      var cxm = 126;                       // centred over the left column
      pixTrophy(cxm - 7, 16 + tp.off, UI.t);
      drawText(cxm, cfg("TITLE", "Ouissy\u2019s Cup").toUpperCase(), 38 + tp.off,
               { align: "center", scale: 2, colour: "#ffffff",
                 outline: "#0d1412", outlineW: 2,
                 shadow: accent, shadowX: 0, shadowY: 3 });
      drawText(cxm, "FOUR A SIDE", 54 + tp.off,
               { align: "center", colour: trim, outline: "#0d1412", track: 2 });

      /* ---- the rows ---- */
      var y2 = 68, H = 24, GAP = 4;
      rows.forEach(function (r, i) {
        var sl = slideIn(age, 0.05 + i * 0.045, -180);
        var b = uiButton("m_" + r.id, 12 + sl.off, y2 + i * (H + GAP), 228, H,
                         r.name,
                         { tone: r.primary ? "#c8912f" : "#2f5d72",
                           ink: r.primary ? "#2a1c08" : "#f4f4e8",
                           sub: r.note, go: act[r.id] });
        menuIcon(r.id, b.x + 6, b.y + Math.round((H - 7) / 2),
                 r.primary ? "#2a1c08" : trim);
      });

      /* ---- the foot: who she is playing as, and how hard it is. Both
         were things the game decided for her and never mentioned. ---- */
      var fp = slideIn(age, 0.34, 40);
      var fy = UIH - 26 + fp.off;
      var cw = 62;
      uiButton("m_team", 12, fy, cw, 18, mine.short || "\u2014",
               { tone: accent, ink: "#f4f4e8", go: act.teams });
      pixCrest(mine, 12 + cw - 18, fy + 3, 14, 12, UI.t);
      var dx = 12 + cw + 6;
      diffList().forEach(function (d) {
        var on = d.id === diffId;
        var w2 = Math.max(40, textWidth(d.name) + 12);
        uiButton("m_d_" + d.id, dx, fy, w2, 18, d.name,
                 { tone: on ? trim : "#24343c", ink: on ? "#2a1c08" : "#9fb0a8",
                   go: function () { setDiff(d.id); } });
        dx += w2 + 4;
      });
    });
  }

  /* whose faculty is whose, out of the config rather than by name */
  function derbyTeam(side) {
    var list = cfg("TEAMS", []);
    for (var i = 0; i < list.length; i++) if (list[i].derby === side) return list[i].id;
    return side === "hers" ? "upm" : "fmdc";
  }

  /* wireMenu has gone too: it walked a card's [data-go] attributes and
     hung a click handler on each. Nothing in the chapter is made of
     elements with attributes any more — a button is a rectangle in a
     list, and pressing one is uiHit finding it. */

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
    scoreCue("squad");

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

  /* =======================================================================
     THE SQUAD BUILDER, DRAWN

     The last screen in the chapter that was a web page. It is also the
     densest — a pool of thirteen players, four slots, an armband, a
     rating, four stat bars, two ten-colour palettes, four crests, three
     shapes and a name — which is exactly why it could not be left: a
     dense CSS form in front of a pixel pitch is the loudest possible
     version of the mismatch.

     It is laid out as two columns rather than as a card, because it is
     a screen she works on rather than one she reads. The left is who
     there is; the right is who she has picked and what they look like.
     ======================================================================= */
  function drawBuilder(backTo) {
    var roster = cfg("ROSTER", []);
    var keepers = roster.filter(function (r) { return r.role === "gk"; });
    var outfield = roster.filter(function (r) { return r.role !== "gk"; });

    var redraw = function () { drawBuilder(backTo); };
    var rate = function (r) {
      return Math.round((r.stats.speed + r.stats.power +
                         r.stats.skill + r.stats.defence) / 4);
    };

    uiOpen("builder", function (age) {
      var chosen = build.squad.filter(Boolean);
      var full = chosen.length === 4;
      var accent = build.kit.shirt || "#c1272d";
      heartsStep(1 / 60);
      vignette(0.7);

      /* TWO SURFACES TO WORK ON.

         The first version drew the whole screen straight onto the
         pitch, and a pale label on mown grass with a player running
         behind it is not a label — "OUTFIELD, PICK THREE" and half the
         row headings simply vanished. A working screen needs something
         to be printed on. */
      var deck = function (dx, dy, dw, dh) {
        box(dx, dy, dw, dh, "#0d1412");
        box(dx + 1, dy + 1, dw - 2, dh - 2, "#16222a");
        line(dx + 1, dy + 1, dw - 2, 1, "#2b3d46");
        line(dx + 1, dy + dh - 2, dw - 2, 1, "#0a1014");
      };
      /* the pool's deck hugs the pool: thirteen chips in two columns
         and nothing under them, so a deck the height of the screen is
         eighty pixels of empty board */
      deck(4, 24, 206, 148);
      deck(212, 24, UIW - 216, 216);

      var sl = slideIn(age, 0, -30);
      drawText(8 + sl.off, "BUILD YOUR SQUAD", 6,
               { scale: 2, colour: "#ffffff", outline: "#0d1412", outlineW: 2,
                 shadow: accent, shadowX: 0, shadowY: 2 });
      uiSay("Build your squad");

      /* ---- LEFT: who there is ------------------------------------- */
      var lx = 8, ly = 30, lw = 196;
      var chip = function (r, cx2, cy2, cw) {
        var on = build.squad.indexOf(r.id) >= 0;
        var isGk = r.role === "gk";
        var blocked = isGk ? (!!build.squad[0] && !on)
                           : (chosen.filter(function (id) {
                               return id !== build.squad[0];
                             }).length >= 3 && !on);
        var tone = on ? "#2c6a52" : blocked ? "#1b262c" : "#24343c";
        uiButton("p_" + r.id, cx2, cy2, cw, 16, "",
                 { tone: tone, go: blocked ? null : function () {
                     togglePick(r.id); redraw();
                   } });
        /* the label is drawn over the button rather than through it,
           because a chip is a swatch, a name and a number and the
           button painter only knows about one centred line */
        box(cx2 + 4, cy2 + 4, 6, 8, (r.colour && r.colour.a) || "#888888");
        box(cx2 + 4, cy2 + 4, 6, 1, lift((r.colour && r.colour.a) || "#888888", 60));
        drawText(cx2 + 13, fitText(r.name, cw - 46, 1), cy2 + 5,
                 { colour: blocked ? "#5f7a72" : "#f4f4e8" });
        drawText(cx2 + cw - 5, (ROLE_NAME[r.role] || "") + " " + rate(r), cy2 + 5,
                 { align: "right", colour: on ? "#9fe8c4" : "#7f9a92" });
        if (on) box(cx2 + cw - 3, cy2 + 2, 2, 12, "#9fe8c4");
      };

      drawText(lx, "KEEPERS", ly, { colour: "#7f9a92", track: 2 });
      ly += 10;
      keepers.forEach(function (r, i2) {
        chip(r, lx + i2 * (lw / 2 + 2), ly, Math.floor(lw / 2) - 2);
      });
      ly += 20;
      drawText(lx, "OUTFIELD \u2014 PICK THREE", ly, { colour: "#7f9a92", track: 2 });
      ly += 10;
      outfield.forEach(function (r, i2) {
        var col = i2 % 2, row = (i2 - col) / 2;
        chip(r, lx + col * (lw / 2 + 2), ly + row * 18, Math.floor(lw / 2) - 2);
      });

      /* ---- RIGHT: who she has picked ------------------------------ */
      var rx = 214, rw = UIW - rx - 8, ry = 30;
      drawText(rx, "YOUR SIDE", ry, { colour: "#7f9a92", track: 2 });
      ry += 10;
      for (var i3 = 0; i3 < 4; i3++) {
        var id = build.squad[i3];
        var r2 = id ? ROSTER[id] : null;
        var isCap = id && build.captain === id;
        box(rx, ry, rw, 14, "#0d1412");
        box(rx + 1, ry + 1, rw - 2, 12, r2 ? "#1d2e36" : "#161f24");
        drawText(rx + 5, i3 === 0 ? "GK" : (ROLE_NAME[r2 ? r2.role : "mid"] || ""),
                 ry + 4, { colour: "#4f7a6a" });
        drawText(rx + 26, r2 ? fitText(r2.name, rw - 90, 1) : "\u2014 empty \u2014",
                 ry + 4, { colour: r2 ? (isCap ? "#e8b23c" : "#f4f4e8") : "#4f6a62" });
        /* the armband. The one wearing it says so; the others offer it,
           which is a different thing and used to look identical */
        if (r2 && i3 > 0) {
          uiButton("cap_" + id, rx + rw - 58, ry + 1, 56, 12,
                   isCap ? "\u2605 CAPTAIN" : "CAPTAIN?",
                   { tone: isCap ? "#c8912f" : "#24343c",
                     ink: isCap ? "#2a1c08" : "#9fb0a8",
                     go: (function (pid) {
                       return function () { build.captain = pid; redraw(); };
                     })(id) });
        }
        ry += 16;
      }

      /* the rating, and what the side is actually like */
      ry += 1;
      drawText(rx, full ? String(teamRating(build)) : "--", ry,
               { scale: 2, colour: full ? "#ffe9a8" : "#4f6a62",
                 outline: "#0d1412" });
      drawText(rx + 34, "TEAM RATING", ry + 5, { colour: "#7f9a92", track: 2 });
      var capR = build.captain ? ROSTER[build.captain] : null;
      if (capR && capR.super) {
        drawText(rx + rw, fitText("\u2665 " + capR.super.name, rw - 120, 1), ry + 5,
                 { align: "right", colour: capR.super.colour || "#ff5f8f" });
      }
      ry += 16;
      if (full) {
        var st = teamStats(build);
        [["PACE", st.speed], ["POWER", st.power],
         ["SKILL", st.skill], ["GRIT", st.defence]].forEach(function (b2, i4) {
          var bx2 = rx + (i4 % 2) * Math.round(rw / 2);
          var by2 = ry + Math.floor(i4 / 2) * 10;
          drawText(bx2, b2[0], by2, { colour: "#7f9a92" });
          statBar(bx2 + 34, by2 + 1, Math.round(rw / 2) - 42, 5,
                  b2[1] / 100, accent);
        });
      }
      ry += 23;

      /* ---- the kit ------------------------------------------------ */
      var swatchRow = function (label, cur, set) {
        drawText(rx, label, ry + 2, { colour: "#7f9a92" });
        SWATCHES.forEach(function (c, i5) {
          var sx2 = rx + 34 + i5 * 13;
          var on = cur === c;
          box(sx2 - 1, ry - 1, 13, 13, on ? "#ffe9a8" : "#0d1412");
          box(sx2, ry, 11, 11, c);
          box(sx2, ry, 11, 1, lift(c, 55));
          UI.widgets.push({ id: label + "_" + i5, x: sx2 - 1, y: ry - 1,
                            w: 13, h: 13, label: label + " " + (i5 + 1),
                            go: function () { set(c); redraw(); } });
        });
        ry += 14;
      };
      swatchRow("KIT", build.kit.shirt, function (c) {
        build.kit.shirt = c;
        build.kit.shirtDark = shade(c, 0.72);
        build.kit.socks = c;
      });
      swatchRow("TRIM", build.kit.trim, function (c) { build.kit.trim = c; });

      /* ---- crest, shape, name ------------------------------------- */
      var pillRow = function (label, items, cur, set) {
        drawText(rx, label, ry + 4, { colour: "#7f9a92" });
        var px3 = rx + 34, rowY = ry;
        items.forEach(function (it) {
          var w3 = textWidth(it.name) + 10;
          /* WRAP RATHER THAN RUN OFF. Five crests laid end to end are
             wider than the column, so the last one was half a word
             hanging over the edge of the screen. */
          if (px3 + w3 > rx + rw) { px3 = rx + 34; rowY += 15; }
          uiButton("o_" + label + "_" + it.id, px3, rowY, w3, 13, it.name,
                   { tone: cur === it.id ? "#c8912f" : "#24343c",
                     ink: cur === it.id ? "#2a1c08" : "#9fb0a8",
                     go: function () { set(it.id); redraw(); } });
          px3 += w3 + 3;
        });
        ry = rowY + 16;
      };
      /* YOU PICK A CREST BY LOOKING AT IT.

         Thirteen crest NAMES as pills wrapped onto four rows and pushed
         the shape, the note and the name field off the bottom of the
         screen. Thirteen crests drawn as crests fit on one row, and
         they are also simply the right control: the thing she is
         choosing is a picture. */
      drawText(rx, "CREST", ry + 6, { colour: "#7f9a92" });
      var cw2 = Math.floor((rw - 36) / CRESTS.length);
      CRESTS.forEach(function (k, i7) {
        var cx3 = rx + 36 + i7 * cw2;
        var on = build.crest === k;
        box(cx3 - 1, ry - 1, cw2, 18, on ? "#ffe9a8" : "#0d1412");
        box(cx3, ry, cw2 - 2, 16, on ? "#3a2a10" : "#101c22");
        pixCrest({ id: "pick_" + k, crest: k,
                   kit: { shirt: build.kit.shirt, trim: build.kit.trim } },
                 cx3, ry, cw2 - 2, 16);
        UI.widgets.push({ id: "crest_" + k, x: cx3 - 1, y: ry - 1,
                          w: cw2, h: 18, label: "crest " + k,
                          go: function () { build.crest = k; redraw(); } });
      });
      ry += 22;
      pillRow("SHAPE", cfg("FORMATIONS", []), build.formation,
              function (v) { build.formation = v; });
      drawText(rx + 34, fitText(formationNote(build.formation) || "", rw - 36, 1),
               ry - 3, { colour: "#5f8a7a" });
      ry += 8;

      drawText(rx, "NAME", ry + 4, { colour: "#7f9a92" });
      textField(rx + 34, ry, rw - 34, 13,
                edit ? edit.value : build.name, !!edit);
      UI.widgets.push({ id: "name", x: rx + 34, y: ry, w: rw - 34, h: 13,
                        label: "Rename the side",
                        go: function () {
                          editOpen(build.name, 22, function (v) {
                            build.name = v.trim() || build.name;
                            build.short = build.name.replace(/[^A-Za-z]/g, "")
                                            .slice(0, 3).toUpperCase() || "OUR";
                            redraw();
                          });
                        } });

      /* ---- the actions -------------------------------------------- */
      var ay = UIH - 26;
      var bw2 = Math.floor((UIW - 16 - 18) / 4);
      var acts = [
        ["SAVE THIS SIDE", full ? "#c8912f" : "#1b262c", function () {
          if (build.squad.filter(Boolean).length !== 4) return;
          if (!build.captain) build.captain = build.squad[1];
          var mine = loadCustom().filter(function (c) { return c.id !== build.id; });
          mine.push(JSON.parse(JSON.stringify(build)));
          saveCustom(mine);
          patchTeamLookup();
          carAt = cfg("TEAMS", []).length + mine.length - 1;
          build = null;
          teamSelect(backTo || "pick");
        }],
        ["RANDOMISE", "#2f5d72", function () { randomiseBuild(); redraw(); }],
        ["RESET", "#2f5d72", function () { build = blankBuild(); redraw(); }],
        ["BACK", "#2f5d72", function () { teamSelect(backTo || "pick"); }],
      ];
      acts.forEach(function (a2, i6) {
        uiButton("b_" + i6, 8 + i6 * (bw2 + 6), ay, bw2, 20, a2[0],
                 { tone: a2[1], ink: i6 === 0 && full ? "#2a1c08" : undefined,
                   go: i6 === 0 && !full ? null : a2[2] });
      });

      /* and they walk out as she picks them, in the kit she has chosen */
      if (chosen.length) build.__dirty = true;
    });

    /* the side on the grass behind the screen is rebuilt outside the
       paint, because building it makes a match and a match is not a
       thing to make sixty times a second */
    if (build.squad.filter(Boolean).length) lineUp(build);
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
  /* THE CONTROLS, AS A BLOCK OF KEY-CAPS.

     Written once and drawn in two places: the how-to, and the pause
     screen — which is where the on-pitch legend went when it was taken
     off the grass. Returns the y it finished at, the way every other
     card body in here does. */
  function controlList(bx, by, bw) {
    var sup = superOf(0);
    var touch = hudTouch();
    var keys = touch
      ? [["MOVE", "slide anywhere on the left"],
         ["TAP", "pass — or tackle, when they have it"],
         ["HOLD", "wind up a shot — or sprint, without the ball"],
         ["♥", "when the hearts are full" + (sup ? " — " + sup.name : "")]]
      : [["W A S D", "run"],
         ["SPACE", "tap to pass — hold to shoot"],
         ["SHIFT", "your super, when the hearts are full"]];
    keys.forEach(function (k) {
      var kw = Math.max(34, textWidth(k[0]) + 12);
      box(bx, by, kw, 13, "#0d1412");
      box(bx + 1, by + 1, kw - 2, 11, "#31424c");
      line(bx + 1, by + 1, kw - 2, 1, "#5c7480");
      drawText(bx + Math.round(kw / 2), k[0], by + 3,
               { align: "center", colour: "#ffe9a8" });
      drawText(bx + kw + 8, fitText(k[1], bw - kw - 10, 1), by + 3,
               { colour: "#cfe0d8" });
      uiSay(k[0] + " — " + k[1]);
      by += 16;
    });
    return by;
  }

  function helpCard(back, first) {
    var sup = superOf(0);
    var keys = [
      ["MOVE", "slide anywhere on the left, or W A S D"],
      ["TAP", "pass \u2014 or tackle, when they have it"],
      ["HOLD", "wind up a shot \u2014 or sprint, without the ball"],
      ["\u2665", "when the meter is full" + (sup ? " \u2014 " + sup.name : "")],
    ];
    var notes = [
      "You are whoever is nearest the ball. The game swaps for you, and " +
      "it never takes a player away while you are carrying it.",
      "The meter under the score fills as you play \u2014 a pass that finds " +
      "someone, a tackle won, a shot had. Fill it and your captain gets " +
      "one shot that is not a shot.",
      "The ball never goes out. The pitch is boarded and it comes back " +
      "off the sides. There are no throw-ins and nothing stops.",
    ];
    cardScreen({
      name: "help", wide: true, top: 12,
      kicker: first ? "ONE STICK, TWO BUTTONS" : "CONTROLS",
      title: first ? "BEFORE YOU START" : "HOW TO PLAY",
      accent: "#2f5d72",
      action: first ? "LET\u2019S GO" : "GOT IT",
      onGo: function () { uiClose(); (back || titleMenu)(); },
      body: function (bx, by, bw) {
        /* the four controls, each in its own key-cap, because a list of
           four bold words is a list and a keycap is a control */
        keys.forEach(function (k) {
          var kw = Math.max(34, textWidth(k[0]) + 12);
          box(bx, by, kw, 13, "#0d1412");
          box(bx + 1, by + 1, kw - 2, 11, "#31424c");
          line(bx + 1, by + 1, kw - 2, 1, "#5c7480");
          line(bx + 1, by + 11, kw - 2, 1, "#1b262c");
          drawText(bx + Math.round(kw / 2), k[0], by + 3,
                   { align: "center", colour: "#ffe9a8" });
          drawText(bx + kw + 8, fitText(k[1], bw - kw - 10, 1), by + 3,
                   { colour: "#cfe0d8" });
          by += 17;
        });
        by += 4;
        keys.forEach(function (k) { uiSay(k[0] + " \u2014 " + k[1]); });
        notes.forEach(function (n) {
          uiSay(n);
          wrapText(n, bw, 3).forEach(function (ln) {
            drawText(bx, ln, by, { colour: "#8fa8a0" });
            by += 9;
          });
          by += 4;
        });
        return by;
      },
    });
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

  /* =======================================================================
     THE CARDS, DRAWN

     Everything between matches used to be a DOM overlay: a rounded
     panel with a serif heading and pill buttons, laid over a pixel
     world. The title screen and Team Select were rebuilt first because
     they are the two she looks at longest, but the round card comes up
     before every single match and half time comes up in the middle of
     one, so a card in the old language was the game changing its mind
     about what it was twice a fixture.

     They all go through ONE screen. A card is a kicker, a title, a
     line, a body and up to two buttons; what changes between a fixture
     card and a memory is what the body draws. That is deliberate — six
     bespoke pixel screens would drift apart by the third one, and the
     thing that makes a set of menus feel designed rather than decorated
     is that they are demonstrably the same menu.
     ======================================================================= */
  function cardScreen(spec) {
    SFX.card();
    var accent = spec.accent || "#c1272d";
    var trim = spec.trim || "#e8b23c";
    uiOpen(spec.name || "card", function (age) {
      heartsStep(1 / 60);
      vignette(spec.dim === undefined ? 0.8 : spec.dim);

      var w = spec.wide ? 400 : 286;
      var x = Math.round((UIW - w) / 2);
      var sl = slideIn(age, 0, -44);
      var top = spec.top === undefined ? 14 : spec.top;
      /* THE CARD IS AS TALL AS WHAT IS ON IT.

         Sized to the screen, the fixture card had ninety empty pixels
         between the team sheets and the button and the half-time card
         had more. The body is what knows how tall it is, and it only
         knows once it has drawn — so the height it reported LAST frame
         is used for this one. It is stable from the second frame, and
         the first is behind the entrance slide. */
      var h = spec.h || (UIH - top * 2);
      var y = Math.round((UIH - h) / 2) + sl.off;
      panel(x, y, w, h, accent, { fill: "#16222a" });

      var ix = x + 14, iw = w - 28, iy = y + 12;
      uiSay(spec.kicker);
      uiSay(spec.title);
      uiSay(spec.line);
      uiSay(spec.foot);
      if (spec.kicker) {
        drawText(x + w / 2, spec.kicker, iy,
                 { align: "center", colour: trim, track: 2 });
        iy += 11;
      }
      if (spec.title) {
        /* A TITLE IS NOT ALWAYS TWO WORDS.

           "HALF TIME" fits at double size and one of the memories is
           called "BEFORE ANY OF THIS HAD A TIMETABLE", which at double
           size is half again as wide as the card — and it was being cut
           to fit with a measurement taken at the WRONG TRACKING, so it
           did not even get cut: it ran out through both sides. An
           outlined line tracks wider than a plain one, so the width is
           measured the way it will be drawn, and if it still will not
           fit it drops a size and then wraps. */
        var ts = 2, tk = 3;
        if (textWidth(spec.title, 2, 3) > iw) { ts = 1; tk = 2; }
        wrapText(spec.title, iw, 2, ts, tk).forEach(function (tl) {
          drawText(x + w / 2, tl, iy,
                   { align: "center", scale: ts, track: tk, colour: "#ffffff",
                     outline: "#0d1412", outlineW: 2,
                     shadow: accent, shadowX: 0, shadowY: 2 });
          iy += ts > 1 ? 20 : 12;
        });
        iy += 5;
      }
      if (spec.line) {
        wrapText(spec.line, iw, spec.lineMax || 3).forEach(function (ln) {
          drawText(x + w / 2, ln, iy, { align: "center", colour: "#b8ccc4" });
          iy += 9;
        });
        iy += 5;
      }
      if (spec.body) iy = spec.body(ix, iy, iw, age) || iy;
      /* remembered for the next frame, clamped so a card can never be
         taller than the screen or too short to hold its own button */
      spec.h = clamp(Math.round(iy - y + 46), 92, UIH - 8);

      /* the buttons, along the bottom of the card rather than wherever
         the body happened to stop */
      var by = y + h - 30;
      if (spec.action) {
        var bw = spec.alt ? Math.round((iw - 8) * 0.58) : iw;
        var bp = slideIn(age, 0.18, 30);
        uiButton("card_go", ix, by + bp.off, bw, 22, spec.action,
                 { tone: "#c8912f", ink: "#2a1c08", go: spec.onGo });
        if (spec.alt) {
          /* the second button on a card is always the way out of it —
             leave, not now, go back — so it is the one that falls */
          uiButton("card_alt", ix + bw + 8, by + bp.off, iw - bw - 8, 22,
                   spec.alt, { tone: "#2f5d72", go: spec.onAlt, back: true });
        }
      }
      if (spec.foot) {
        drawText(x + w / 2, spec.foot, y + h - 42,
                 { align: "center", colour: "#5f8a7a" });
      }
    });
  }

  /* ---- what a card's body can be made of ---------------------------- */

  /* WHERE THE FIXTURE IS BEING PLAYED. Half of what makes six matches
     feel like six occasions rather than one pitch six times is simply
     being told, before each one, whose campus you are standing on. */
  function cardVenue(x2, y2, w, id) {
    var v = venueById(id);
    if (!v) return y2;
    box(x2, y2, w, 18, "#111e26");
    box(x2, y2, 2, 18, "#e8b23c");
    drawText(x2 + 7, v.hour, y2 + 6, { colour: "#e8b23c" });
    drawText(x2 + 40, fitText(v.name, w - 48, 1), y2 + 2, { colour: "#ffffff" });
    drawText(x2 + 40, fitText(v.note || "", w - 48, 1), y2 + 10,
             { colour: "#7f9a92" });
    return y2 + 24;
  }

  /* the run through the tournament: won, playing, still to come */
  function cardBracket(x2, y2, w, at) {
    var n = CUP.length;
    var cw = Math.floor((w - (n - 1) * 5) / n);
    CUP.forEach(function (r, i) {
      var bx = x2 + i * (cw + 5);
      var st = i < at ? 1 : (i === at ? 2 : 0);
      var tone = st === 2 ? "#c8912f" : st === 1 ? "#2c6a52" : "#22323a";
      box(bx, y2, cw, 21, "#0d1412");
      box(bx + 1, y2 + 1, cw - 2, 19, tone);
      line(bx + 1, y2 + 1, cw - 2, 1, lift(tone, 55));
      drawText(bx + Math.round(cw / 2), fitText(r.round, cw - 6, 1), y2 + 3,
               { align: "center", colour: st ? "#f4f4e8" : "#7f9a92" });
      drawText(bx + Math.round(cw / 2), (teamById(r.id) || {}).short || "",
               y2 + 12, { align: "center",
                          colour: st === 2 ? "#2a1c08" : "#cfe0d8" });
    });
    return y2 + 27;
  }

  /* the two team sheets, side by side, with the captain picked out */
  function cardTeams(x2, y2, w, aId, bId) {
    var cw = Math.floor((w - 18) / 2);
    [aId, bId].forEach(function (id, side) {
      var tm = teamById(id);
      if (!tm) return;
      var c0 = x2 + side * (cw + 18);
      pixCrest(tm, c0, y2, 22, 16, UI.t);
      drawText(c0 + 26, fitText(tm.short || tm.name, cw - 28, 1), y2 + 1,
               { colour: "#ffffff" });
      drawText(c0 + 26, fitText(tm.name, cw - 28, 1), y2 + 9,
               { colour: "#7f9a92" });
      squadOf(tm).slice(0, 4).forEach(function (m, i) {
        var ry = y2 + 22 + i * 9;
        drawText(c0, ROLE_NAME[m.role] || "", ry, { colour: "#4f7a6a" });
        drawText(c0 + 22, fitText(m.name, cw - 24, 1), ry,
                 { colour: (m.captain || m.star) ? "#e8b23c" : "#cfe0d8" });
      });
    });
    drawText(x2 + Math.round(w / 2), "v", y2 + 24,
             { align: "center", colour: "#7f9a92" });
    return y2 + 62;
  }

  /* HOW THE HALF ACTUALLY WENT. Possession gets a bar because a
     percentage is a number and a bar is a fact; the other two are
     counts, and a bar of two shots against one is a lie. */
  function cardStats(x2, y2, w) {
    var tot = G.stat.poss[0] + G.stat.poss[1];
    var hp = tot > 2 ? Math.round((G.stat.poss[0] / tot) * 100) : 50;
    var mineCol = "#c1272d", theirs = "#6d5fa8";
    var a = teamById(G.ids[0]), b = teamById(G.ids[1]);
    if (a && a.kit) mineCol = a.kit.shirt;
    if (b && b.kit) theirs = b.kit.shirt;
    var rows = [["POSSESSION", hp + "%", (100 - hp) + "%", hp / 100],
                ["SHOTS", G.stat.shots[0], G.stat.shots[1], null],
                ["GOALS", G.score[0], G.score[1], null]];
    rows.forEach(function (r, i) {
      var ry = y2 + i * 17;
      drawText(x2, String(r[1]), ry, { colour: "#ffffff" });
      drawText(x2 + Math.round(w / 2), r[0], ry,
               { align: "center", colour: "#7f9a92" });
      drawText(x2 + w, String(r[2]), ry, { align: "right", colour: "#ffffff" });
      if (r[3] === null) return;
      var fill = Math.round(w * r[3]);
      box(x2, ry + 9, w, 5, "#0d1412");
      box(x2, ry + 9, fill, 5, mineCol);
      box(x2 + fill, ry + 9, w - fill, 5, theirs);
    });
    return y2 + rows.length * 17 + 4;
  }

  /* the scoreline, big, with both crests */
  function cardScore(x2, y2, w) {
    var a = teamById(G.ids[0]), b = teamById(G.ids[1]);
    var mid = x2 + Math.round(w / 2);
    /* the two names sit OUTSIDE the score, not under its outline: at
       44 they were being painted over by the 2-pixel keyline around a
       double-size scoreline and came out as "FM 0 - 0 6P" */
    if (a) pixCrest(a, mid - 96, y2 + 2, 26, 18, UI.t);
    if (b) pixCrest(b, mid + 70, y2 + 2, 26, 18, UI.t);
    drawText(mid - 66, fitText((a && a.short) || "", 40, 1), y2 + 6,
             { colour: "#cfe0d8" });
    drawText(mid + 66, fitText((b && b.short) || "", 40, 1), y2 + 6,
             { align: "right", colour: "#cfe0d8" });
    drawText(mid, G.score[0] + " - " + G.score[1], y2,
             { align: "center", scale: 2, colour: "#ffffff",
               outline: "#0d1412", outlineW: 2 });
    return y2 + 24;
  }

  function roundCard() {
    var r = run.fixture && run.fixture.round ? run.fixture.round : CUP[run.round];
    var them = teamById((run.fixture && run.fixture.theirs) || r.id);
    /* her side, standing at the campus this one is being played at, so
       the fixture card is a photograph of the actual fixture */
    lineUp(run.myTeam, (run.fixture && run.fixture.venue) || r.venue);
    /* ONE PIECE OF MUSIC PER ROUND. The same theme each time, a minor
       third higher and eight beats a minute faster than the last one —
       which is the one device that makes a bracket feel like a bracket
       without a word of commentary being written. */
    scoreCue(window.CupScore ? window.CupScore.round(run.round) : "menu");
    var kick = function () {
      uiClose();
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
    };
    var mineId = run.myTeam || derbyTeam("hers");
    var mineT = teamById(mineId) || {};
    cardScreen({
      name: "round", wide: true, kicker: r.round, title: them.name,
      line: r.before, lineMax: 2,
      accent: (mineT.kit && mineT.kit.shirt) || "#c1272d",
      action: "KICK OFF", onGo: kick,
      body: function (bx, by, bw) {
        by = cardVenue(bx, by, bw, (run.fixture && run.fixture.venue) || r.venue);
        /* The bracket only belongs on a cup tie. A friendly and the
           derby used to print one anyway — and worse, the whole card
           used to be built from CUP[run.round] whatever she had
           picked, so choosing THE DERBY put up a card announcing a
           quarter-final against UM6P and then played the derby. */
        if (!run.quick) by = cardBracket(bx, by, bw, run.round);
        return cardTeams(bx, by, bw, mineId, them.id);
      },
    });
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
      /* the same seven notes either way. The loss gets them with the
         third flattened, which is not a different piece of music: it is
         the same one, heard on a worse night. */
      scoreCue(won ? "win" : "lose");
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
      var endCard = function (opts) {
        cardScreen({
          name: "full", kicker: opts.kicker, title: "FULL TIME",
          line: opts.note, lineMax: 2,
          accent: won ? "#2c6a52" : "#8a2f3c",
          action: opts.action, onGo: opts.onGo,
          alt: opts.alt, onAlt: opts.onAlt,
          body: function (bx, by, bw) {
            by = cardScore(bx, by, bw);
            by = cardStats(bx, by + 4, bw);
            return opts.bracket === undefined ? by
                 : cardBracket(bx, by, bw, opts.bracket);
          },
        });
      };

      /* A FRIENDLY IS NOT A ROUND.
         Winning one used to advance `run.round` and put up the next cup
         tie, because this only ever knew about the tournament. A one-off
         goes back to the menu it was started from. */
      if (run.quick) {
        endCard({
          kicker: won ? "WON" : "LOST", note: won ? r.won : r.lost,
          action: won ? "BACK TO THE MENU" : "PLAY IT AGAIN",
          onGo: function () {
            uiClose();
            if (won) { run.fixture = null; run.quick = false; titleMenu(); }
            else roundCard();
          },
          alt: won ? null : "LEAVE IT FOR NOW",
          onAlt: function () { run.fixture = null; run.quick = false;
                               uiClose(); titleMenu(); },
        });
        return;
      }

      if (won) {
        run.won++;
        if (run.round >= CUP.length - 1) return theEnd();
        endCard({
          kicker: "WON", note: r.won, action: "NEXT ROUND",
          bracket: run.round + 1,
          onGo: function () {
            uiClose();
            /* and between the rounds, something that is not football */
            memoryCard(run.round, function () {
              run.round++;
              roundCard();
            });
          },
        });
      } else {
        endCard({
          kicker: "LOST", note: r.lost, action: "PLAY IT AGAIN",
          onGo: function () { uiClose(); roundCard(); },
          alt: "LEAVE IT FOR NOW", onAlt: function () { quit(); },
        });
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
    scoreCue("memory");
    /* IT IS NOT A FIXTURE CARD AND IT MUST NOT LOOK LIKE ONE.

       This is the one screen in the chapter that is not about football,
       so it gets the rose frame rather than her kit's, a heart for a
       kicker, its prose set wide and quiet, and no furniture at all —
       no crests, no table, no bracket. */
    cardScreen({
      name: "memory", wide: true, top: 40, dim: 1.05,
      kicker: "\u2665", title: m.title || "", accent: "#a8283a",
      trim: "#ff8fae",
      action: "GO ON", onGo: function () { uiClose(); next(); },
      body: function (bx, by, bw) {
        uiSay(m.line || "");
        /* set quietly and with room round it: this is the one screen in
           the chapter that is not in a hurry */
        by += 6;
        wrapText(m.line || "", bw - 40, 8).forEach(function (ln) {
          drawText(bx + Math.round(bw / 2), ln, by,
                   { align: "center", colour: "#f2dfe4" });
          by += 13;
        });
        return by + 8;
      },
    });
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
    scoreCue("trophy");
    confettiBurst({ x: PITCH.cx, y: PITCH.cy }, 200, "#ffd45e");

    /* THE QUIETEST SCREEN IN THE CHAPTER.

       A stadium has been shouting for ninety minutes and this is what
       is left: the trophy, his words, and his name under them. It gets
       gold rather than a kit colour because it does not belong to
       either side any more, and the confetti is already falling behind
       it on the real pitch. */
    cardScreen({
      name: "end", wide: true, top: 20, dim: 1.05,
      kicker: V.kicker || "FULL TIME", title: V.title || "YOU WON IT",
      accent: "#c8912f", trim: "#f6d878",
      action: V.button || "TAKE IT HOME", onGo: function () { quit(); },
      foot: V.signOff || "",
      body: function (bx, by, bw) {
        pixTrophy(bx + Math.round(bw / 2) - 7, by, UI.t);
        by += 22;
        lines.forEach(function (l) {
          uiSay(l);
          /* six, not four: his middle paragraph is five lines wide and
             was coming out with an ellipsis through the middle of the
             one sentence on this screen that matters most */
          wrapText(l, bw - 24, 6).forEach(function (ln) {
            drawText(bx + Math.round(bw / 2), ln, by,
                     { align: "center", colour: "#f4ecd8" });
            by += 10;
          });
          by += 4;
        });
        return by;
      },
    });
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
      /* =================================================================
         HIT-STOP

         The oldest trick in an action game and the cheapest: when
         something connects, hold the ENTIRE WORLD still for three or
         four frames. It reads as weight. A tackle that takes the ball
         cleanly off somebody, at sixty frames a second with no pause in
         it, is over before the eye has registered that it happened —
         the ball is simply somewhere else. Eighty milliseconds of
         nothing and the same tackle lands.

         It is deliberately not slow motion. Slow motion is for a
         moment you are being shown; hit-stop is for a moment you are
         being MADE to feel, and the difference is that hit-stop stops
         dead and then resumes at full speed with no ramp at all.
         ================================================================= */
      if (G.hitStop > 0) {
        G.hitStop = Math.max(0, G.hitStop - dt);
        dt = 0;
      }
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
    /* ONE CANVAS, TWO THINGS ON IT. A menu screen and the match HUD are
       never up together: whichever is showing owns the pixel layer for
       that frame. */
    if (UI.on) uiPaint(raw);
    else if (hudWanted()) {
      if (uiCvs && uiCvs.hidden) {
        uiCvs.hidden = false;
        uiCvs.classList.remove("on");   // it shows; it does not take taps
      }
      drawHud();
    } else if (uiCvs && !uiCvs.hidden) {
      uiCvs.hidden = true;
    }
  }

  var wired = false;
  function wire() {
    if (wired) return;
    wired = true;

    document.addEventListener("keydown", function (e) {
      if (!playing) return;
      /* a real key press settles the question of what she is playing
         with, on a touchscreen laptop as much as anywhere else */
      USED_KEYS = true;
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
    cardScreen({
      name: "pause", title: "PAUSED", accent: "#2f5d72", wide: false,
      action: "BACK TO THE MATCH",
      onGo: function () {
        uiClose();
        G.state = was === "paused" ? "play" : was;
        startCrowd();
        if (EL["cup-hud"]) EL["cup-hud"].hidden = false;
        if (EL["cup-pad"]) EL["cup-pad"].hidden = false;
      },
      alt: "LEAVE THE CUP", onAlt: function () { quit(); },
      body: function (bx, by, bw) {
        var ny = cardScore(bx, by, bw);
        /* and the controls, because this is where the legend went when
           it came off the pitch */
        return controlList(bx, ny + 6, bw);
      },
    });
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
    /* EVERYTHING A HARNESS NEEDS TO JUDGE THE FOOTBALL.

       `state` says what the scoreboard says, which tells you nothing
       about whether the game is playing football — a side can lose 4-0
       while standing in a huddle and lose 4-0 while defending
       beautifully. This is the shape: where all eight of them are, what
       job each has been given, who they are marking and how fast they
       are going, so the questions that matter (is anybody covering, is
       the block compact, are two defenders on the same man) can be
       ASKED rather than eyeballed. */
    scout: function () {
      if (!G) return null;
      return {
        ball: { x: +G.ball.x.toFixed(1), y: +G.ball.y.toFixed(1) },
        owner: G.ball.owner
          ? { team: G.ball.owner.team, name: G.ball.owner.name,
              /* the INDEX, because the roster is shared and two players
                 on opposite sides can carry the same name */
              i: G.players.indexOf(G.ball.owner) } : null,
        ballV: +len(G.ball.vx, G.ball.vy).toFixed(1),
        /* A NAME IS NOT AN IDENTITY HERE.

           The roster is shared, so the same character can turn out for
           both sides — GUSTAV and ATLAS both played for team 0 AND
           team 1 in the very first fixture. A harness matching a mark
           by name therefore found whichever of the two came first in
           the list, and read a defender correctly marking the opposing
           ATLAS as a defender marking his own team-mate. Every player
           carries its index in this array instead, which is unique by
           construction. */
        players: G.players.map(function (p, i) {
          return { i: i, t: p.team, gk: !!p.gk, name: p.name, role: p.role,
                   x: +p.x.toFixed(1), y: +p.y.toFixed(1),
                   job: p.job || null,
                   mark: p.mark ? G.players.indexOf(p.mark) : -1,
                   sentOff: !!p.sentOff, yellow: p.yellow || 0,
                   sp: +len(p.vx, p.vy).toFixed(1),
                   spd: +((p.mul || FLAT_MUL).speed).toFixed(3),
                   want: p.want ? [+p.want.x.toFixed(1), +p.want.y.toFixed(1)] : null };
        }),
        stat: { shots: G.stat.shots.slice(), poss: G.stat.poss.slice(),
                passes: G.stat.passes.slice(),
                passTry: (G.stat.passTry || [0, 0]).slice(),
                touches: (G.stat.touches || [0, 0]).slice(),
                fouls: (G.stat.fouls || [0, 0]).slice() },
        score: G.score.slice(), state: G.state, dbg: G.dbg || null,
      };
    },
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
    /* PRESS A DRAWN BUTTON BY NAME.

       A harness used to reach into the DOM and click an element. The
       menus are canvas now, so there is nothing to click — it can
       either work out where the rectangle lands on the page and move a
       real mouse there, which is what the button tests do because
       that is the thing they are testing, or it can say which button it
       means, which is what everything else wants.

       It is `press` and not `fire`, because `fire` was already taken
       further down this same object by the super button — and a later
       duplicate key silently wins, so the new one existed, was a
       function, and did nothing at all. */
    press: function (id) {
      var w = UI.widgets.filter(function (v) { return v.id === id; })[0];
      if (!w || !w.go) return false;
      uiGo(w);
      return true;
    },
    /* STRAIGHT INTO A MATCH, WITH NO MENUS IN THE WAY.

       Measuring the football means playing a whole half of it a few
       times over, and walking the help card, the title menu and the
       fixture card each time costs more wall time than the football
       does. This is the same code the fixture card's kick-off button
       runs, with the cards left out. */
    /* all eight of them driven by the AI, so a harness measures the
       football rather than the statue it is not steering */
    auto: function (on) { AUTOPLAY = !!on; if (G && on) G.controlled = null; },
    quick: function (roundIdx, swapSides) {
      /* SWAPPING THE SIDES IS A DIAGNOSTIC, not a game mode: if an
         asymmetry follows the team INDEX it is a bug in the code, and
         if it follows the SQUAD it is the fixture being uneven. There
         is no other cheap way to tell those two apart. */
      var mine = run.myTeam || "upm";
      var round = CUP[roundIdx || 0] || {};
      G = swapSides
        ? newMatch(roundIdx || 0, { mine: round.id, theirs: mine })
        : newMatch(roundIdx || 0, null);
      applyVenue(G.venue);
      buildRigs();
      resetPositions(0);
      uiClose();
      /* A NEW MATCH CLEARS THE LAST ONE'S NAMEPLATE.

         The super banner runs on its own clock and nothing took it down
         when a match was replaced underneath it, so a banner raised in
         one fixture was still on screen in the next. Only a harness
         starts a match that abruptly, but leaving a clean screen behind
         is the simulation's job either way. */
      clearSuperBanner();
      /* AND A NEW MATCH IS DRIVEN BY A PERSON AGAIN.

         AUTOPLAY is a module flag, so a harness that turned it on for
         one measurement left it on for every match started afterwards
         in the same page — which silently removed the player from every
         later test, including the ones photographing things that only
         exist while somebody is driving. */
      AUTOPLAY = false;
      if (EL["cup-hud"]) EL["cup-hud"].hidden = false;
      /* the ground's song, which a real match start brings up through
         startCrowd — a quick match is still a match and should sound
         like one */
      startChant();
      return hooks.state();
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
    /* FIRE IT WITHOUT THE BUTTON.

       `fire` is the real button press and is gated on everything the
       real button is gated on — the meter, the state, and the captain
       having the ball at that instant. That is correct of it and
       useless to a harness that only wants to photograph the
       cinematic, so this is the back door: it puts the ball at the
       captain's feet, fills the meter, and unleashes. */
    /* PUT THE CAMERA WHERE IT WOULD BE.

       The simulation is stepped by hand in a harness — hundreds of
       ticks inside one JS turn — but the camera eases on the RENDER
       clock, a tenth of the remaining distance per frame. So after a
       block of hand-stepping the camera is still pointing at wherever
       the ball was several hundred ticks ago, and a screenshot comes
       back as an empty patch of grass with the play off the side of
       it. This snaps it to where it is heading, which is what every
       screenshot of the match actually wants. */
    camSnap: function () { placeCamera(0, true); return hooks.state(); },
    /* freeze the lens where it is, so two frames can be compared */
    camHold: function (on) { camFrozen = !!on; return !!camFrozen; },
    /* hold the ground at an energy, or let the match have it back */
    energy: function (v) {
      if (v === null || v === undefined) { CROWD_E.hold = false; return CROWD_E; }
      CROWD_E.hold = true; CROWD_E.now = clamp(v, 0, 1);
      return CROWD_E;
    },
    /* THE HUD'S OWN GEOMETRY, so a harness can ask whether two
       instruments are sitting on top of each other. The radar is
       painted on a canvas and the thumb button is a DOM element, so
       there is no other way to compare them, and "the pass button is
       drawn straight over the radar" is exactly the kind of thing that
       is obvious in a screenshot and invisible to every assertion. */
    hud: function () {
      return { touch: hudTouch(), coarse: COARSE, usedKeys: USED_KEYS,
               radar: RADAR_BOX };
    },
    /* TURN THE PITCH SIDEWAYS WITHOUT RELOADING.

       The orientation is a config flag, which is the right thing for
       the finished game and useless for comparing the two views: a
       reload gives a different match, and two different matches
       photographed from two different angles answer nothing. This
       turns the SAME match through ninety degrees between frames, so
       the only difference between the two pictures is the one being
       judged. */
    side: function (on, back) {
      SIDE = !!on;
      if (typeof back === "number") CAM.sideBack = back;
      if (R2) R2.setSwap(SIDE);
      placeCamera(0, true);
      return { side: SIDE, back: CAM.sideBack };
    },
    /* force a restart, for photographing one and for testing that the
       marks are where a commentator would say they are */
    /* force a booking, to photograph the card and prove the draw path
       runs — it is the one piece of the HUD a match will not reliably
       produce on demand */
    book: function (red) {
      if (!G || G.state !== "play") return false;
      var off = null, vic = null;
      G.players.forEach(function (q) {
        if (!off && q.team === 1 && !q.gk) off = q;
        if (!vic && q.team === 0 && !q.gk) vic = q;
      });
      if (!off || !vic) return false;
      off.yellow = red ? 1 : 0;
      off.vx = 80; off.vy = 0;
      vic.dir = 0;
      foulOn(off, vic);
      return hooks.state();
    },
    restart: function (kind, side) {
      if (!G || G.state !== "play") return false;
      var team = 0, gl = ownGoalY(kind === "corner" ? 1 : 0);
      if (kind === "corner") team = 0; else team = 0;
      setPiece(kind === "corner" ? "corner" : "goalkick", team,
               side || 1, gl);
      return hooks.state();
    },
    superNow: function (team) {
      team = team || 0;
      if (!G || G.state !== "play") return false;
      var cap = captainOf(team);
      if (!cap) return false;
      G.heart[team] = TUNE.superCost;
      G.superReady[team] = true;
      G.ball.x = cap.x; G.ball.y = cap.y; G.ball.z = 0;
      G.ball.vx = G.ball.vy = G.ball.vz = 0;
      G.ball.owner = cap; G.ball.lastTouch = cap; G.ball.lock = 0;
      unleash(cap);
      return true;
    },
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
    /* THE SOUND BANK ITSELF, so a harness can wrap each entry and count
       it. You cannot listen to a headless browser, but you can ask
       which sounds a real passage of football produced — and a sound
       that is defined and never fires is a sound that is not there. */
    sfx: function () { return SFX; },
    /* the renderer itself, for harnesses that need to ask the lens
       where something lands rather than looking at a screenshot */
    r2: function () { return R2; },
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
    /* DRESS THE PITCH AS A PARTICULAR TEAM'S GROUND, so two of them can
       be photographed from the same camera at the same moment with
       nothing different but whose ground it is. */
    ground: function (teamId) {
      var t = teamById(teamId);
      if (!t) return null;
      applyVenue(t.venue, t.id);
      return { team: t.id, venue: t.venue, stadium: t.stadium || null };
    },
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
    soundOff: function () {
      soundOn = false;
      if (window.CupChant) window.CupChant.mute(true);
      if (window.CupScore) window.CupScore.setOn(false);
    },
    /* the score, so a harness can ask what is playing and in what key
       rather than trying to listen to a headless browser */
    score: function () { return window.CupScore ? window.CupScore.debug() : null; },
    /* which ground's song the crowd is singing, so a harness can check
       that three rounds really are three different pieces of music */
    chant: function () {
      var d = window.CupChant ? window.CupChant.debug() : null;
      return d ? { anthem: d.anthem, layers: d.layers, bar: d.bar } : null;
    },
    scoreTo: function (n) { scoreCue(n); return window.CupScore && window.CupScore.debug(); },
    /* Kept for the harnesses and for the settings screen, and now it
       costs nothing either way: every shadow in the game is an ellipse
       drawn on the grass, so there is no map to switch off and no
       material to recompile. It was only ever here because swiftshader
       in a container is not a graphics card. */
    shadows: function (on) { shadowsOn = !!on; },
    goto: function (r) { run.round = clamp(r, 0, CUP.length - 1); roundCard(); },
    /* the two cards that only come up after a whole run, so a harness
       can photograph them without playing three matches first */
    memory: function (i) { memoryCard(i || 0, function () {}); },
    /* the side under construction, so a harness can check what the
       builder did without reading it back off a canvas */
    build: function () {
      if (!build) return null;
      var full = build.squad.filter(Boolean).length === 4;
      return { squad: build.squad.map(function (id) {
                 return id ? (ROSTER[id] || {}).name || id : "\u2014";
               }),
               captain: build.captain, name: build.name, short: build.short,
               kit: build.kit.shirt, trim: build.kit.trim,
               crest: build.crest, formation: build.formation,
               rating: full ? teamRating(build) : 0 };
    },
    ending: function () { theEnd(); },
    finish: function (won) { finishRound(won); },
  };

  return { start: start, stop: stop, pause: pause, __cup: hooks };
})();

