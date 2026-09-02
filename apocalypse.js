/* =====================================================================
   OUISSY AT THE APOCALYPSE
   "the world ends. you come and find me anyway."

   A third-person 3D stealth game. Real geometry, real lights, real
   shadows — built on vendor/three.bundle.js, which index.html already
   loads for the book intro. If it ever stops loading it there, this
   fetches it itself the first time somebody opens the chapter.

   Public API:
     Apocalypse.start()   title card, then Level 1
     Apocalypse.stop()    tears the loop down and silences it

   There are no image files and no audio files in this chapter. Every
   surface is a procedural texture painted into an offscreen canvas,
   every sound is an oscillator, and every character is a rig built out
   of primitives at load time.
   ===================================================================== */
(function () {
  "use strict";

  /* =========================================================
     0 — TUNING
     Everything the game feels like, in one place. The distances
     are still quoted in the original pixel units (16 px to a
     tile) so the stealth reads the way it was designed; PX turns
     them into world units at the top of the file and nothing
     below has to think about it again.
     ========================================================= */
  var T      = 16;          /* the old pixel tile, kept as the unit of design */
  var TILE   = 2.0;         /* world units per tile — a 2 m room grid */
  var PX     = TILE / T;    /* one design pixel, in world units */

  var TUNE = {
    walk:        52 * PX,
    creep:       26 * PX,
    accel:      420 * PX,
    friction:   520 * PX,

    torch:       64 * PX,
    torchCreep:  54 * PX,

    noiseWalk:   60 * PX,
    noiseCreep:   0,
    noiseDoor:  110 * PX,
    noiseSpark: 130 * PX,

    zSpeed:      26 * PX,
    zChase:      58 * PX,
    zReact:      0.5,
    zSight:      84 * PX,
    zCone:       0.62,
    zNear:       20 * PX,
    zLose:       2.0,
    zInvestigate: 4.0,

    caughtHold:  1.5,
    grabWindow:  1.6,
    camLerp:     0.12,

    playerR:     0.34 * TILE,   /* collision radius */
    zombieR:     0.34 * TILE,
    wallH:       3.4,
    lowH:        0.85,
    tallH:       2.6,
    eye:         1.52
  };

  /* =========================================================
     1 — THE MAPS
     The grids are the level design. Nothing here is generated.

       space  outside the map          l  floor lamp (walkable)
       .      floor                    L  lamp post (solid)
       ,      outdoor ground           G  gate
       #      wall                     Q  quarantine desk
       o      tall — blocks sight      v  window
       =      low — sight passes over  B  bed
       h      hiding place             F  sofa
       d      door                     K  counter
       D      coded door               n  nightstand
       P      dead door (no power)     u  chair
       W      wire panel               q  small item
       N      the note                 r  rug
       T      television / radio       f  fridge
       C      the car that starts      i  item
       A      Anwar                    c  parked car / crate
       H      the horse                y  medical debris
       S      start                    Y  large medical unit
       X      the way out              j  storage
       z      one of them              w  woodpile
       x      one of them (alt)        b  bedroll
       *      fire pit                 g  gathering point
       ~      stream
     ========================================================= */

  var MAPS = {};

  MAPS.home = [
    "####vv####################v#######",
    "v.h..BB....#..=.....#.=nn.......o#",
    "#....BB....#........#....BB......#",
    "#...S......#....h...#..i........h#",
    "#..=...n...#........#............#",
    "#..........#...=....#.o..=......o#",
    "#####d###########d#########d######",
    "#................................#",
    "#..=.........................o...#",
    "#................................#",
    "#######d########d#########d#######",
    "#.nn......FFF..#fKKK.h...#.o....o#",
    "#.uT......FFF..#....K....#...W...#",
    "v.......rr=r...#....K....#.......#",
    "v.q.==..rrrr...#....K....#o.....o#",
    "#...==....o....#...i.....#.......#",
    "#qh............#KKKKKKK..#.......#",
    "#..............#.........#.......#",
    "#############################P####",
    "#,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,#",
    "#,,,,,,,,,,,,,,,,,,,,,,,,,,,,X,,,#"
  ];

  MAPS.streets = [
    "                                                ",
    "                                                ",
    "                                                ",
    "################################################",
    "####,S,.############.,,.################.,,.####",
    "####,,,.############.,,.################.,,.####",
    "####,,,.############.,,.################.,,.####",
    "#....,,L...........c.,,L.................,,L...#",
    "#,,,.,,.,,z,,,,,,,,,.,,.,,,,,,,,,,,,,,,,.,,.,,,#",
    "#,,,.,,.h,,,,.,,,,,,.,,.,,,,z,,,,,,,,,,,.,,.,,,#",
    "#....,,.h...........h,,................c.,,....#",
    "####.,,.#####.######h,,.################.,,.####",
    "####.,,.#####.######.,,...i..............,,.####",
    "####.,,.#####x######.,,.################.,,.####",
    "####.,,.#####.######.,,.################.,h.####",
    "####h,,.#####.######.,,c################.,h.####",
    "#...h,,..............,,c.................,,....#",
    "#,,,.,,.,,,,,,,,,z,,.,,.,,,,,,,,,,z,,,,,.,,.,,,#",
    "#,,,.,,.,,,,,,,,,,,,.,,.,,,,,,,,,,,,,,,,.,,.i,,#",
    "#....,,.....L....hh..,,.......h..........,,....#",
    "####.,,.##d#########.,,.#######.########.,,.####",
    "####.,,......#######.,,.#######.#....hh#.,,.####",
    "####.,,......#######.,,.#######x#..c...#.,,.####",
    "####.,,cKK...#######.,,.#######.D..c...#.,,.####",
    "####.,,c...N.#######.,,.#######.#....c.#.,,.####",
    "####.,,.h....#######.,,.#######.#......#.,,.####",
    "####.,,.#.##########.,,.###########.####.z,.####",
    "#....,,L......hh.....,,L.........##.####.,,.####",
    "#,,,.,,.,,,,,,,,,,,,.,,.z,,,,i,,,##.#####,,#####",
    "#,,,.,,.,,,,,,,,,,,,.,,.,,,,..x...L.......L..h.#",
    "#....,,.....hh.....c.,,....hh.........c.z..cc.h#",
    "####.,,.#########################...........X..#",
    "################################################"
  ];

  MAPS.hospital = [
    "########################################",
    "##################..####################",
    "##oo............##..##..Bh.Bh.Bh.Bh.B.##",
    "##......=====...##.l##..B..B.lB..B..B.##",
    "##...W.o........##..##................##",
    "##.....o.............P........A.......##",
    "##....x..............P................##",
    "##.l............##..##................##",
    "##......=====...##.z##..B..B..B..B..B.##",
    "##..h.........h.##.l##..BhlBh.Bh.Bh.B.##",
    "##..............##..##................##",
    "##################..####################",
    "#....lyy...x..l.y.......l.....i..yl....#",
    "#..y....x..Yy.............yy.......Y...#",
    "#########.########..####################",
    "##.......j##.....#....................##",
    "##.X......##.ooo.#...KKKKKK.....=====.##",
    "##........##.ooo.#.l...z....hhY....x..##",
    "##........##h....#...............h....##",
    "#########.####.###..####.###############",
    "########......i.......Y........#########",
    "########..KKKKKK...l..======y..#########",
    "########....l...............l..#########",
    "########...h....BB..yy....h....#########",
    "########...........S......x....#########",
    "########################################"
  ];

  MAPS.escape = [
    "####################################",
    "####################################",
    "##......#.##########....l........###",
    "##..S...d.##########..=.=.=.=.=..###",
    "##.B..h.#.##########...h.....h...###",
    "##......#l##########..=...=...=..###",
    "#########.##########d............###",
    "#########x##########.###############",
    "##.........x.zl...i...x.l.x....l..##",
    "##.............................z..##",
    "#########.##########################",
    "##......#.###........###.....i...###",
    "##.h..h.#l###..h.xh..###.o..o..o.###",
    "##...x..#.......l...........l.B..###",
    "##......#.###.B....B.###...z.....###",
    "##.h....#i###..hx.h..###.o..o..o.###",
    "##......#.###......x.###....d....###",
    "##,z,,,,,,,,,,,,,,,,,,,,,,.....#####",
    "##,,cc,,cc,,,i,,cc,,cc,,,,,....#####",
    "##,,,,l,,,,,C,,,,,,l,,,x,,.....#####",
    "##,,,,,,,,,,,,,,,,,,,,,,,,##########",
    "####################################"
  ];

  MAPS.roadside = [
    "                                                ",
    "                                                ",
    "                                                ",
    "################################################",
    "#,o,,,,,o,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,#",
    "#,o.....o,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,#",
    "#,o.....o,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,#",
    "#,o.CS..o,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,#",
    "#,o.....o,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,#",
    "#,o.....o,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,#",
    "#,o.....o,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,#",
    "#,o..l..o,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,#",
    "#,o.....o,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,#",
    "#,o..h..o,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,#",
    "#,o.....oooooooooo..ooooooooooooooooooooo,,,,,,#",
    "#,o.......l.h............z..h......l.....,,,,,,#",
    "#,o............z....h.l...........h......,,,,,,#",
    "#,o.....ooooooooooooooooooooo..oooooooo..,,,,,,#",
    "#,o.....o,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,..,,,,,,#",
    "#,o...z.o,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,..,,,,,,#",
    "#,o.....o,,,,,,,,,,,,,,,,,,,..................,#",
    "#,o..h..o,,,,,,,,,,,,,,,,,,,...l.........z..h.,#",
    "#,o.....o,,,,,,,,,,,,,,,,,,,......####d####...,#",
    "#,o.....o,,,,,,,,,,,,,,,,,,,...h..#.......#...,#",
    "#,o..l..o,,,,,,,,,,,,,,,,,,,......#.==..=.#...,#",
    "#,o.....o,,,,,,,,,,,,,,,,,,,......#...H...#h..,#",
    "#,o..z..o,,,,,,,,,,,,,,,,,,,......#.......#...,#",
    "#,o.....o,,,,,,,,,,,,,,,,,,,......#########...,#",
    "#,o.....o,,,,,,,,,,,,,,,,,,,..h..z.........l..,#",
    "#,o,,,,,o,,,,,,,,,,,,,,,,,,,..................,#",
    "################################################"
  ];

  MAPS.campsite = [
    "                             ",
    "                             ",
    "                             ",
    ",,,,,,,,,,,,,,,,,,,,,,,,,,,,,",
    ",,,,,,,,,o,,,,,,,,,,,,,,,,,,,",
    ",,,,,,,,,,,,,,,,,,,,o,,,,,,,,",
    ",,,o,,,,,,,,,,,~,,,,,,,,,,,,,",
    ",,,,,,w,,,,,,,,~,,,,,,,,,,,,,",
    ",,,,,,,,,,,,,,,~,,,,,,,,o,,,,",
    ",,,,,,,,,,g,,,,~,,,,,,,,,,,,,",
    ",,,,,,,,,,,,,,,~,,,,b,,,,,,,,",
    ",,,,,,,,,,g,,,,,,,,,,,,,,,,,,",
    ",,,,,S,,,,,,,,,,,,,,b,,,,,,,,",
    ",,,,,,,,,,,,,,,,,w,,,,,,o,,,,",
    ",,o,,,,,,,,,,,,,,,,,,,,,,,,,o",
    ",,,,,,,,,,,,w,,,,,,,,,,,,,,,,",
    ",,,,,,,,,,,,,,,,,,,,,,,,,,,,,",
    ",,,,o,,,,,,,,,,,,,,,,,,,,,,,,",
    ",,,,,,,,,,,,,,,,,,,,,o,,,,,,,"
  ];

  MAPS.gates = [
    "                                    ",
    "                                    ",
    "                                    ",
    "####################################",
    "#,,,,,,,,,,,,,#,,,,,,,,,,#,,,,,,,,,#",
    "#,,,,,,,,,,,,,#,,,,,,,,,,#,,,,,,,,,#",
    "#,,,,,,,,,,,,,#,,,,,,,,,,#,,,,,,,,,#",
    "#,,,,,,,,,,,,,#,,,,,,,,,,#,,,,,,,,,#",
    "#,,,,,,,,,,,,,#..........#....L....#",
    "#,,,,,,,,,,,,,#.L......L.#.L####.L.#",
    "#,,,,,,,,,,,,,#....===...#..####...#",
    "#,,,h,,,,,,,,,#.....Q....#.........#",
    "#.............#.L........#.........#",
    "#S............G..........G......X..#",
    "#.............#........L.#.........#",
    "#,,,,,h,,h,,,,#..........#.........#",
    "#,,,,,,,,,,,,,#..======..#..####...#",
    "#,,,,,,,,,,,,,#.L......L.#.L####.L.#",
    "#,,,,,,,,,,,,,#..........#.........#",
    "#,,,,,,,,,,,,,#,,,,,,,,,,#,,,,,,,,,#",
    "#,,,,,,,,,,,,,#,,,,,,,,,,#,,,,,,,,,#",
    "#,,,,,,,,,,,,,#,,,,,,,,,,#,,,,,,,,,#",
    "####################################"
  ];

  /* =========================================================
     2 — PALETTES AND LEVEL DEFINITIONS
     Every location gets its own light, its own materials and its
     own grade. The palette is read by the world builder, the
     lighting and the post chain, so changing one line here
     changes the whole look of a place.
     ========================================================= */

  var PAL = {
    house: {
      floor:   0x7a5e3e, floor2: 0x604a30,
      wall:    0x4a4260, wallTop: 0x6a6088,
      cover:   0x9a7650, tall:   0x50402c,
      ambient: 0x0a0c18, fogNear: 0x0b0e1c,
      key:     0xffd9a8, sky:    0x0a0c1c,
      accent:  0xc08a52
    },
    street: {
      floor:   0x586878, floor2: 0x46545f,
      wall:    0x384454, wallTop: 0x53637a,
      cover:   0x5a3e36, tall:   0x384e44,
      ambient: 0x080c18, fogNear: 0x0a0f1e,
      key:     0xffcf90, sky:    0x0a1024,
      accent:  0x6e8296
    },
    hospital: {
      floor:   0x9aacb2, floor2: 0x8496a0,
      wall:    0x647880, wallTop: 0x8ea2aa,
      cover:   0xa0b4ba, tall:   0x54666e,
      ambient: 0x0c1820, fogNear: 0x0d1a24,
      key:     0xd8f2ec, sky:    0x08141c,
      accent:  0x68a89c
    },
    road: {
      floor:   0x7a6a4e, floor2: 0x655743,
      wall:    0x584e40, wallTop: 0x7d7060,
      cover:   0x6a5b45, tall:   0x4e7050,
      ambient: 0x141428, fogNear: 0x2a2c44,
      key:     0xffd9a0, sky:    0x2a2b52,
      accent:  0x4a6838
    },
    campsite: {
      floor:   0x685c42, floor2: 0x54492f,
      wall:    0x4a3820, wallTop: 0x6a5434,
      cover:   0x5a4a30, tall:   0x3a6438,
      ambient: 0x0e0e20, fogNear: 0x141630,
      key:     0xffb86a, sky:    0x141838,
      accent:  0x3a5e30
    }
  };

  /* the five levels, in order, plus the two submaps that hang off
     Level 4. `base` is what a space in the grid means outdoors. */
  var LEVELS = [
    {
      id: "home", name: "HOME", card: "Level 1: HOME",
      blurb: "Your parents are away. The news is still on.",
      map: MAPS.home, theme: "house", base: ".", dark: 0.68, groundTex: "asphalt",
      grade: [180, 115, 55, 0.16], haze: [30, 38, 60, 0.28],
      steps: [
        { task: "The TV is still on downstairs. Go and see.", clears: "tv" },
        { task: "Get out. The garage door has no power.",     clears: "panel" },
        { task: "The garage door is open. Go.",               clears: "exit" }
      ]
    },
    {
      id: "streets", name: "THE STREETS", card: "Level 2: THE STREETS",
      blurb: "He's asleep at the hospital. That's where you're going.",
      map: MAPS.streets, theme: "street", base: ",", dark: 0.62,
      grade: [60, 90, 180, 0.18], haze: [35, 48, 80, 0.36],
      steps: [
        { task: "Cross town to the hospital — south, then east.", clears: "exit" }
      ]
    },
    {
      id: "hospital", name: "THE HOSPITAL", card: "Level 3: THE HOSPITAL",
      blurb: "Find him before the corridors fill up.",
      map: MAPS.hospital, theme: "hospital", base: ".", dark: 0.63,
      grade: [104, 176, 168, 0.13], haze: [58, 84, 92, 0.34],
      dead: [20, 1, 39, 10],
      pressure: 21,
      steps: [
        { task: "Ward C has no power on the doors. Find the plant room.", clears: "panel" },
        { task: "Ward C is open. He's in there somewhere.",               clears: "anwar" },
        { task: "Get off the corridor. Anywhere with a door that shuts.", clears: "exit" }
      ]
    },
    {
      id: "escape", name: "THE ROAD", card: "Level 4: THE ROAD",
      blurb: "Out of the city, any way you can.",
      map: MAPS.escape, theme: "hospital", base: ".", dark: 0.68, groundTex: "asphalt",
      grade: [96, 150, 170, 0.12], haze: [46, 62, 76, 0.32],
      steps: [
        { task: "Out of the building. Then find anything with four wheels.", clears: "car" }
      ]
    },
    {
      id: "gates", name: "THE GATES", card: "Level 5: THE GATES",
      blurb: "They only take you if you're clean.",
      map: MAPS.gates, theme: "road", base: ",", dark: 0.28, floorTex: "pave",
      people: [
        /* the two on the outer gate, watching the road she comes up */
        { kind: "guard", x: 15, y: 12, face: Math.PI },
        { kind: "guard", x: 15, y: 14, face: Math.PI },
        /* the one at the table, who will look at both of them */
        { kind: "guard", x: 20, y: 12, face: Math.PI / 2 },
        /* and the one on the inner gate, who opens it */
        { kind: "guard", x: 24, y: 14, face: Math.PI },
        /* everybody who got here first */
        { kind: "civil", x: 17, y: 16, face: 0.6, pace: 1 },
        { kind: "civil", x: 18, y: 17, face: -0.4 },
        { kind: "civil", x: 22, y: 16, face: 2.4 },
        { kind: "civil", x: 21, y: 9, face: 1.9, pace: 1 },
        { kind: "civil", x: 17, y: 9, face: 0.2 },
        { kind: "civil", x: 23, y: 10, face: 3.0 },
        { kind: "civil", x: 28, y: 12, face: Math.PI },
        { kind: "civil", x: 30, y: 15, face: 2.0, pace: 1 }
      ],
      grade: [255, 214, 150, 0.17], haze: [178, 186, 196, 0.14],
      steps: [
        { task: "Go up to the gate. Do what they tell you.",             clears: "hail" },
        { task: "Wait at the table. They have to look at both of you.",  clears: "check" },
        { task: "They're opening the inner gate. Go in.",                clears: "exit" }
      ]
    }
  ];

  var SUB = {
    roadside: {
      id: "roadside", name: "THE ROAD", map: MAPS.roadside, theme: "road",
      base: ",", dark: 0.42,
      grade: [246, 200, 128, 0.16], haze: [162, 168, 186, 0.18],
      steps: [
        { task: "The tank is dry. Find something else that can carry two.", clears: "horse" }
      ]
    },
    campsite: {
      id: "campsite", name: "THE CLEARING", map: MAPS.campsite, theme: "campsite",
      base: ",", dark: 0.40, safe: true,
      grade: [190, 150, 85, 0.14], haze: [70, 64, 46, 0.22],
      steps: [
        { task: "Make camp.",                clears: "arrival" },
        { task: "Find some wood for a fire.", clears: "wood" },
        { task: "Light the fire.",            clears: "fire" }
      ]
    }
  };

  /* =========================================================
     3 — EVERY WORD IN THE GAME
     A line is [speaker, text]. No speaker and no text is a beat
     of silence, and it is held on screen exactly as long as a
     line with words in it. No speaker but text is narration.
     Nothing in here is paraphrased.
     ========================================================= */

  var N = null, SIL = [null, null];

  var TALK = {};

  TALK.wake = [
    [N, "He is on his side with one arm out of the blanket. She says his name twice before anything happens."],
    ["ANWAR", "...Ouissy?"],
    ["ANWAR", "What time is it."],
    ["OUISSY", "We have to go."],
    ["ANWAR", "Okay."],
    [N, "He doesn't ask why. That tells her he has already heard something."]
  ];

  TALK.hide = [
    [N, "The door goes shut behind them. There is a bolt on it, and the bolt works."],
    SIL,
    ["ANWAR", "You walked here."],
    ["OUISSY", "Yeah."],
    ["ANWAR", "From the house."],
    ["OUISSY", "Yeah."],
    SIL,
    ["ANWAR", "You're insane."],
    ["OUISSY", "I know."],
    [N, "He laughs, once, and it comes out wrong, and then he stops."],
    ["ANWAR", "...Come here."],
    [N, "They stay like that for a while. Neither of them says anything for a while."],
    ["ANWAR", "I kept thinking, if this is real, she's on her own in that house."],
    ["OUISSY", "I'm not on my own."],
    ["ANWAR", "No."],
    SIL,
    ["OUISSY", "So what do we do."],
    ["ANWAR", "I don't know yet."],
    ["ANWAR", "Give me a minute and we'll work it out."],
    ["OUISSY", "Okay."],
    SIL,
    [N, "There has been a radio talking on the shelf behind them for the whole of that, too quiet to be words."],
    ["OUISSY", "...How long has that been on?"]
  ];

  TALK.horse = [
    [N, "There is a field gate at the end of the lane with a name painted on it by hand, a long time ago, by somebody who was not in a hurry."],
    [N, "They hear her before they see her: a shift of weight, and then hooves on a concrete floor."],
    [N, "There is one animal left in the barn and she has heard them coming from the yard."],
    [N, "She puts her whole head over the door before Ouissy has got near it."],
    ["OUISSY", "Oh — hello. Hello."],
    ["ANWAR", "She's enormous."],
    ["OUISSY", "She's lovely. Look at her."],
    [N, "There is a headcollar on the hook and somebody's name painted over the stall. She is not going to be collected."],
    ["ANWAR", "Can you actually ride?"],
    ["OUISSY", "No."],
    ["ANWAR", "Right."],
    ["OUISSY", "Get on."]
  ];

  TALK.arrival = [
    [N, "The clearing is just off the lane, behind a wall that was a house once. The grass is flat enough and the trees cut the wind."],
    [N, "She lets the horse stop on its own. It dips its head and doesn't move again."],
    ["ANWAR", "...Here?"],
    ["OUISSY", "Hang on."],
    [N, "She stands still and listens. Wind in the branches. The stream somewhere below them. Nothing else."],
    ["OUISSY", "Yeah. Here."],
    ["ANWAR", "You're sure? There's nothing — no walls, no—"],
    ["OUISSY", "That's why here. Nothing to hide behind, nothing to come out of. If anything moves we'll see it a mile off."],
    [N, "He looks at the treeline and the open grass and the sky, which is starting to turn. He nods."],
    ["ANWAR", "Okay. What do we need?"],
    ["OUISSY", "Wood, before it gets dark. There should be enough around — dead branches, anything dry."],
    ["ANWAR", "I can help—"],
    ["OUISSY", "You can sit down is what you can do. You've been on a horse for four hours and you were in bed for a week before that."],
    ["ANWAR", "I'm fine."],
    ["OUISSY", "You're grey. Sit."],
    [N, "He sits. She doesn't say anything about the fact that he sits down immediately, which is as close to kindness as she can manage right now."]
  ];

  TALK.wood = [
    [
      [N, "She snaps a branch off a dead elm. It is dry enough that it comes away clean."],
      [N, "Across the clearing, he is on his knees pulling grass out of the dirt with both hands, making a bare circle in the ground."]
    ],
    [
      [N, "She finds another piece wedged in a low fork — birch, pale and papery. Good kindling."],
      ["OUISSY", "How's it going over there?"],
      ["ANWAR", "I found some stones. Flat ones, for a ring."],
      ["OUISSY", "You don't have to—"],
      ["ANWAR", "I want to do something. Let me do something."]
    ],
    [
      ["OUISSY", "Right. That's plenty."],
      [N, "She carries the last armful back and stops. He has built a proper fire pit — a circle of flat stones on bare earth, with a gap on one side for air."],
      ["OUISSY", "...That's actually good."],
      ["ANWAR", "Don't sound so surprised."]
    ]
  ];

  TALK.fire = [
    [N, "She kneels by the pit he made and starts stacking the wood: a loose cone with the driest pieces in the centre and the bark facing in, the way her mother showed her years ago in somebody's garden."],
    ["ANWAR", "Where did you learn that?"],
    ["OUISSY", "Mum. Bonfire night. I was about seven."],
    [N, "He crouches on the other side of the pit and holds the cone steady while she wedges the last piece in. The birch bark curls inward and the whole thing looks like it might actually work."],
    ["OUISSY", "Right. Lighter?"],
    ["ANWAR", "Still in my pocket, somehow."],
    [N, "The first spark catches nothing. She cups her hand around it and tries again — the flame licks sideways, finds air instead of bark, and goes out."],
    ["OUISSY", "...Come on."],
    ["ANWAR", "Try the other side. The wind's coming from—"],
    ["OUISSY", "I know where the wind's coming from."],
    [N, "She moves around. He strips a curl of bark off one of the birch pieces and tucks it into the base where the gap in the stones lets air through."],
    ["OUISSY", "That's good. Hold it there."],
    [N, "Third try. The spark catches the curl. A thin thread of smoke, and then a crackle, and then the whole thing talks back at once — a low, steady roar that neither of them has heard for days."]
  ];

  TALK.lit = [
    ["ANWAR", "...Oh, that's good."],
    [N, "He sits back on his heels and the firelight catches his face and he looks exhausted and relieved and something else she doesn't have a word for."],
    ["OUISSY", "Sit down properly. You look awful."],
    ["ANWAR", "I've looked awful for a week. You just couldn't see it in the dark."],
    SIL,
    [N, "He moves to the log on the far side of the fire and lowers himself onto it carefully, the way people do when everything hurts. She sits on the other log, closer than she needs to, and pulls her knees up."],
    [N, "For a while neither of them says anything. The fire crackles. The stream moves. The sky is turning the colour it turns when there is nothing left of the day."],
    [N, "It is the first time since the television came on that there is nothing she has to do next."]
  ];

  TALK.campfire = [
    ["ANWAR", "How did you know where I was?"],
    ["OUISSY", "You were in hospital. Where else were you going to be?"],
    ["ANWAR", "That's not what I mean. The ward — it was locked. The whole floor was dark. How did you find the right room?"],
    ["OUISSY", "I tried every door."],
    ["ANWAR", "...There are a lot of doors in that building."],
    ["OUISSY", "Yes."],
    SIL,
    [N, "He doesn't push it. The fire pops, and something in the wood shifts, and neither of them says anything for a while."],
    SIL,
    ["ANWAR", "Were you frightened?"],
    ["OUISSY", "The whole time."],
    ["ANWAR", "Of the—"],
    ["OUISSY", "Of everything. Of the noise, and the dark, and not knowing if you were—"],
    ["OUISSY", "Yes. I was frightened the whole time."],
    ["ANWAR", "I woke up and the power was out and nobody was on the ward. I didn't know what had happened. I thought—"],
    ["ANWAR", "I thought maybe everyone just left."],
    ["OUISSY", "I didn't leave."],
    ["ANWAR", "No. You came and got me."],
    SIL,
    [N, "A long time passes. The stream sounds different in the dark — closer, as though the water has risen. It hasn't. There is just nothing else to hear."],
    SIL,
    ["OUISSY", "Anwar."],
    ["ANWAR", "Mm."],
    ["OUISSY", "I need to tell you something and I need you not to make it into a thing."],
    ["ANWAR", "...Okay."],
    ["OUISSY", "When I got to the car park and the car actually started — that was the first time I thought I might actually get to you."],
    ["OUISSY", "Not before that. Not in the house, not on the street, not in the hospital. I was just doing the next thing because I didn't know how to stop."],
    ["OUISSY", "I wasn't being brave. I didn't have a plan. I was just — moving."],
    ["ANWAR", "That is brave."],
    ["OUISSY", "It isn't. It's just not stopping."],
    ["ANWAR", "Same thing."],
    SIL,
    [N, "She pulls a twig apart and drops the pieces into the fire one at a time."],
    SIL,
    ["OUISSY", "I'm going to say something and I don't want you to say anything back. I just want you to hear it."],
    ["ANWAR", "All right."],
    ["OUISSY", "I would do it again."],
    ["OUISSY", "All of it. The house, the streets, the hospital. Every door and every dark corridor and every time I thought something was right behind me."],
    ["OUISSY", "I would do every single second of it again."],
    SIL,
    [N, "He doesn't say anything. He said he wouldn't."],
    SIL,
    ["ANWAR", "Can I say something now?"],
    ["OUISSY", "No."],
    ["ANWAR", "Okay."],
    ["OUISSY", "...Fine. What."],
    ["ANWAR", "I know."],
    SIL,
    [N, "The fire burns low. Above the clearing the stars are out, which neither of them has seen in a city for a long time, and which neither of them mentions because it would break something."],
    SIL,
    ["OUISSY", "We should sleep. The gates can't be far."],
    ["ANWAR", "How far?"],
    ["OUISSY", "The radio said north road, past the reservoir. An hour, maybe, on the horse."],
    ["ANWAR", "You should sleep first. I'll watch the fire."],
    ["OUISSY", "You were in a hospital bed for a week."],
    ["ANWAR", "And you carried me out of it. Sleep."],
    SIL,
    [N, "She doesn't argue. She doesn't move either."],
    SIL,
    [N, "Her head finds his shoulder, and stays there."],
    [N, "He doesn't move. He barely breathes."],
    SIL,
    [N, "She is asleep before he has counted to ten."],
    [N, "He sits by the fire and watches the dark, which is what it looks like when somebody loves you back."]
  ];

  TALK.roof = [
    [N, "The roof is flat and wide and the air up here is clean."],
    [N, "The whole of the valley is underneath them, and whatever is burning in it is a long way off."],
    SIL,
    ["ANWAR", "I can't believe we're here."],
    ["OUISSY", "I know."],
    SIL,
    ["ANWAR", "I didn't think we'd make it past the ring road."],
    ["OUISSY", "I didn't think past the hospital."],
    [N, "He laughs, short and real, and it is the first time in days it has sounded like him."],
    SIL,
    ["ANWAR", "Have you tried the phone again?"],
    ["OUISSY", "There's no signal. There's been nothing since the second day."],
    ["ANWAR", "Mine too. Network's gone."],
    SIL,
    ["OUISSY", "My mum would've gone to Aunt Sara's. That's what they always said — if anything happened, go to Sara's."],
    ["ANWAR", "My parents would've gone to the mosque. Or to Nana's."],
    ["OUISSY", "Then that's where we look. When things calm down, that's where we go first."],
    ["ANWAR", "Both places. Yours and mine."],
    ["OUISSY", "Both places."],
    SIL,
    [N, "They are quiet for a while. A light goes on and off in a window three streets away, and then it stays off."],
    SIL,
    ["ANWAR", "You know the worst part?"],
    ["OUISSY", "What."],
    ["ANWAR", "I wasn't scared for me. I was scared because I didn't know where you were."],
    SIL,
    ["OUISSY", "I was scared for you too."],
    ["OUISSY", "That's why I walked."],
    SIL,
    [N, "He reaches over and takes her hand, and neither of them lets go."],
    SIL,
    ["ANWAR", "What do we do now?"],
    ["OUISSY", "We wait until it's safe. Then we find our families."],
    ["ANWAR", "And if it doesn't get safe?"],
    ["OUISSY", "Then we work it out. Like we worked out everything else."],
    SIL,
    ["ANWAR", "Together."],
    ["OUISSY", "Obviously together. That's the whole point."],
    [N, "He turns and looks at her, properly looks, for the first time since the hospital."],
    SIL,
    ["ANWAR", "Come here."],
    [N, "She leans into him, and he puts his arm around her, and the city below them is the quietest it has ever been."],
    SIL,
    [N, "They stay like that for a long time. There is nowhere else to be."],
    [N, "The moon is up and the smoke has cleared enough to see the stars."],
    SIL,
    ["OUISSY", "Hey."],
    ["ANWAR", "Yeah?"],
    ["OUISSY", "We made it."],
    SIL,
    ["ANWAR", "Yeah. We did."]
  ];

  var RADIO_LINES = [
    "— stay off the roads at night. Do not attempt to reach us after dark —",
    "— Ashcombe reception is open. We are accepting anyone who is not bitten —",
    "— you will be checked at the gate and you will be given the serum. Both are required —",
    "— that is Ashcombe. North road, past the reservoir. We are still here —"
  ];

  var TV_LINES = [
    "STAY INSIDE. LOCK WHAT YOU CAN LOCK.",
    "DO NOT APPROACH ANYONE WHO SEEMS UNWELL.",
    "DO NOT ATTEMPT TO HELP THEM.",
    "HOSPITALS IN THESE DISTRICTS ARE NO LONGER TAKING CALLS."
  ];

  var TV_TICKER = "EMERGENCY BROADCAST • THIS IS NOT A TEST • REMAIN INDOORS • " +
                  "DO NOT TRAVEL • KEEP THIS CHANNEL OPEN • ";

  var GATE_CODE = "4180";

  var CLOSE_LINES = [
    "It had you for a second.",
    "You get your arm back and you run.",
    "Not this time.",
    "You come out of it further back than you were.",
    "It doesn't hold on. This time."
  ];

  /* =========================================================
     4 — SMALL THINGS
     ========================================================= */
  function $(id) { return document.getElementById(id); }

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }

  /* Everything that follows something else in this game follows it through
     one of these. `damp` is an exponential ease whose rate is expressed as
     the time to close most of the gap, so it behaves identically at 30 fps
     and at 144; `spring` is critically damped, which means it eases in as
     well as out and never overshoots, and it is what the camera uses. */
  function damp(current, target, smoothTime, dt) {
    if (smoothTime <= 0) return target;
    return target + (current - target) * Math.exp(-dt / (smoothTime * 0.4));
  }

  function dampAngle(current, target, smoothTime, dt) {
    var d = Math.atan2(Math.sin(target - current), Math.cos(target - current));
    return current + d * (1 - Math.exp(-dt / (smoothTime * 0.4)));
  }

  function Spring1(value, smoothTime) {
    this.v = value; this.vel = 0; this.t = smoothTime;
  }
  Spring1.prototype.step = function (target, dt) {
    /* the standard critically damped approximation: stable at any dt */
    var omega = 2 / Math.max(0.0001, this.t);
    var x = omega * Math.min(dt, 0.1);
    var exp = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
    var change = this.v - target;
    var temp = (this.vel + omega * change) * Math.min(dt, 0.1);
    this.vel = (this.vel - omega * temp) * exp;
    this.v = target + (change + temp) * exp;
    return this.v;
  };
  Spring1.prototype.set = function (v) { this.v = v; this.vel = 0; return v; };
  function rnd(a, b) { return a + Math.random() * (b - a); }
  function irnd(a, b) { return Math.floor(rnd(a, b + 1)); }
  function pick(a) { return a[Math.floor(Math.random() * a.length)]; }

  /* a small deterministic hash, so a given tile always looks the same
     rather than shimmering every time the level is rebuilt */
  function hash2(x, y) {
    var h = x * 374761393 + y * 668265263;
    h = (h ^ (h >> 13)) * 1274126177;
    return ((h ^ (h >> 16)) >>> 0) / 4294967296;
  }

  /* =========================================================
     5 — SOUND
     No files. An oscillator bank, a noise buffer, a convolver
     built out of decaying noise for the corridors, and one
     ambient bed per location that the rest is mixed over.
     ========================================================= */
  var Audio_ = (function () {
    var ctx = null, master = null, busVerb = null, verb = null, busDry = null;
    var noiseBuf = null, ambient = null, on = false, pendingBed = null;

    function ac() {
      if (ctx) return ctx;
      var C = window.AudioContext || window.webkitAudioContext;
      if (!C) return null;
      ctx = new C();
      master = ctx.createGain();
      master.gain.value = 0.0;
      master.connect(ctx.destination);

      busDry = ctx.createGain(); busDry.connect(master);
      verb = ctx.createConvolver();
      verb.buffer = impulse(1.9, 2.6);
      busVerb = ctx.createGain(); busVerb.gain.value = 0.34;
      busVerb.connect(verb); verb.connect(master);

      noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      var d = noiseBuf.getChannelData(0);
      for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      return ctx;
    }

    /* a room, made out of noise that runs out */
    function impulse(sec, decay) {
      var len = Math.floor(ctx.sampleRate * sec);
      var buf = ctx.createBuffer(2, len, ctx.sampleRate);
      for (var c = 0; c < 2; c++) {
        var d = buf.getChannelData(c);
        for (var i = 0; i < len; i++) {
          d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
        }
      }
      return buf;
    }

    /* A context that is not running never fires the stop() we schedule, so
       every node we build into it stays alive. Twenty minutes of footsteps
       into a suspended context is tens of thousands of oscillators and a
       page that stops responding — so nothing is built until it is running. */
    function live() { return ctx && ctx.state === "running"; }

    function noise(dur, gain, filt, q, type) {
      if (!ac() || !live()) return null;
      var s = ctx.createBufferSource();
      s.buffer = noiseBuf; s.loop = true;
      var f = ctx.createBiquadFilter();
      f.type = type || "bandpass";
      f.frequency.value = filt; f.Q.value = q || 1;
      var g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), ctx.currentTime + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
      s.connect(f); f.connect(g); g.connect(busDry); g.connect(busVerb);
      s.start(); s.stop(ctx.currentTime + dur + 0.05);
      return { src: s, gain: g, filt: f };
    }

    function tone(freq, dur, gain, type, slideTo, delay) {
      if (!ac() || !live()) return null;
      var t0 = ctx.currentTime + (delay || 0);
      var o = ctx.createOscillator();
      o.type = type || "sine";
      o.frequency.setValueAtTime(freq, t0);
      if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), t0 + dur);
      var g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t0 + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(g); g.connect(busDry); g.connect(busVerb);
      o.start(t0); o.stop(t0 + dur + 0.05);
      return { osc: o, gain: g };
    }

    var API = {
      begin: function () {
        if (!ac()) return;
        if (ctx.state === "suspended") ctx.resume().then(function () {
          if (pendingBed) { var k = pendingBed; pendingBed = null; API.bed(k); }
        });
        on = true;
        master.gain.cancelScheduledValues(ctx.currentTime);
        master.gain.setTargetAtTime(0.55, ctx.currentTime, 0.4);
      },
      end: function () {
        if (!ctx) return;
        on = false;
        API.bed(null);
        master.gain.cancelScheduledValues(ctx.currentTime);
        master.gain.setTargetAtTime(0.0, ctx.currentTime, 0.25);
      },
      resume: function () {
        if (!ctx || ctx.state !== "suspended") return;
        ctx.resume().then(function () {
          if (pendingBed) { var k = pendingBed; pendingBed = null; API.bed(k); }
        });
      },

      /* --- the ambient bed: one per place, crossfaded --- */
      bed: function (kind) {
        if (!ac()) return;
        if (!live() && kind) { pendingBed = kind; return; }
        if (ambient) {
          var old = ambient; ambient = null;
          try {
            old.g.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.5);
            setTimeout(function () { old.nodes.forEach(function (n) { try { n.stop(); } catch (e) {} }); }, 1600);
          } catch (e) {}
        }
        if (!kind) return;

        var g = ctx.createGain();
        g.gain.value = 0.0001;
        g.connect(master);
        var nodes = [];

        var spec = {
          house:    { drone: 42,  air: 260,  airQ: 0.7, vol: 0.10 },
          street:   { drone: 33,  air: 180,  airQ: 0.5, vol: 0.13 },
          hospital: { drone: 55,  air: 900,  airQ: 1.4, vol: 0.11 },
          road:     { drone: 38,  air: 420,  airQ: 0.6, vol: 0.09 },
          campsite: { drone: 46,  air: 620,  airQ: 0.8, vol: 0.08 }
        }[kind] || { drone: 40, air: 300, airQ: 0.7, vol: 0.09 };

        /* two detuned low oscillators — the room, not a note */
        [0, 1].forEach(function (i) {
          var o = ctx.createOscillator();
          o.type = "sine";
          o.frequency.value = spec.drone * (i ? 1.0075 : 1);
          var og = ctx.createGain(); og.gain.value = 0.45;
          o.connect(og); og.connect(g); o.start(); nodes.push(o);
        });
        /* filtered noise — air moving in a building with no people in it */
        var s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
        var f = ctx.createBiquadFilter();
        f.type = "bandpass"; f.frequency.value = spec.air; f.Q.value = spec.airQ;
        var ng = ctx.createGain(); ng.gain.value = 0.30;
        s.connect(f); f.connect(ng); ng.connect(g); s.start(); nodes.push(s);

        /* a slow wobble on the filter so it is never quite still */
        var lfo = ctx.createOscillator(); lfo.frequency.value = 0.07;
        var lg = ctx.createGain(); lg.gain.value = spec.air * 0.25;
        lfo.connect(lg); lg.connect(f.frequency); lfo.start(); nodes.push(lfo);

        g.gain.setTargetAtTime(spec.vol, ctx.currentTime, 1.2);
        ambient = { g: g, nodes: nodes, base: spec.vol };
      },

      /* the bed climbs as the hospital fills up */
      pressure: function (v) {
        if (!ambient || !ctx) return;
        ambient.g.gain.setTargetAtTime(ambient.base * (1 + v * 1.8), ctx.currentTime, 1.5);
      },

      step: function (creeping, outdoors) {
        if (!on) return;
        var f = outdoors ? 300 : 170;
        noise(creeping ? 0.05 : 0.09, creeping ? 0.02 : 0.075,
              f * rnd(0.85, 1.2), creeping ? 5 : 2.2);
      },
      door: function () {
        if (!on) return;
        noise(0.5, 0.06, 420, 4);
        tone(120, 0.45, 0.05, "sawtooth", 70);
        tone(70, 0.3, 0.04, "square", 55, 0.35);
      },
      spark: function () {
        if (!on) return;
        noise(0.14, 0.22, 3600, 0.6, "highpass");
        tone(1800, 0.09, 0.09, "square", 300);
      },
      shuffle: function (dist) {
        if (!on) return;
        var g = clamp(0.06 * (1 - dist / 14), 0.004, 0.06);
        noise(0.22, g, 180 * rnd(0.8, 1.3), 1.6);
      },
      alert: function () {
        if (!on) return;
        noise(0.4, 0.13, 700, 1.1);
        tone(190, 0.55, 0.10, "sawtooth", 88);
        tone(95, 0.7, 0.07, "square", 60);
      },
      caught: function () {
        if (!on) return;
        tone(58, 1.2, 0.20, "sine", 34);
        noise(0.9, 0.16, 240, 0.8);
        API.heart(3);
      },
      heart: function (n) {
        if (!on) return;
        for (var i = 0; i < (n || 1); i++) {
          tone(48, 0.16, 0.16, "sine", 30, i * 0.62);
          tone(44, 0.13, 0.11, "sine", 28, i * 0.62 + 0.20);
        }
      },
      found: function () {
        if (!on) return;
        tone(660, 0.16, 0.07, "triangle");
        tone(990, 0.30, 0.05, "triangle", 1320, 0.09);
      },
      keyOk: function () { if (on) { tone(520, 0.1, 0.06, "square"); tone(780, 0.22, 0.05, "square", 900, 0.08); } },
      keyBad: function () { if (on) { tone(150, 0.3, 0.09, "sawtooth", 70); } },
      beep: function () { if (on) tone(1200, 0.045, 0.035, "square"); },
      static: function (dur, g) { if (on) noise(dur || 0.4, g || 0.05, 2600, 0.4, "highpass"); },
      tune: function () {
        if (!on) return;
        noise(0.7, 0.05, 1400, 0.6);
        tone(1400, 0.6, 0.03, "sine", 320);
      },
      fire: function () {
        if (!on) return;
        noise(rnd(0.05, 0.16), rnd(0.02, 0.06), rnd(500, 2600), rnd(0.6, 2.4));
      },
      engine: function (state) {
        if (!ac()) return null;
        if (state === "start") {
          for (var i = 0; i < 4; i++) tone(70 + i * 4, 0.14, 0.07, "sawtooth", 50, i * 0.16);
          tone(90, 1.1, 0.10, "sawtooth", 130, 0.66);
          return null;
        }
        return null;
      },
      hoof: function () {
        if (!on) return;
        noise(0.07, 0.06, 150, 3);
        tone(90, 0.06, 0.045, "sine", 55);
      },
      bird: function () {
        if (!on) return;
        var f = rnd(1900, 3400);
        tone(f, 0.09, 0.035, "sine", f * rnd(1.2, 1.8));
        tone(f * 1.2, 0.07, 0.025, "sine", f * 0.8, 0.11);
      },
      wind: function () { if (on) noise(rnd(1.4, 2.6), 0.03, rnd(300, 700), 0.5); },
      thump: function (g) { if (on) tone(52, 0.5, g || 0.09, "sine", 30); }
    };
    return API;
  })();

  /* =========================================================
     6 — LOADING THREE
     index.html loads the bundle for the book intro, so by the
     time anybody reaches the hub it is already here and this
     resolves immediately. It is written as a loader anyway so
     that the chapter keeps working if that tag ever moves.
     ========================================================= */
  var THREE = null;
  var threePromise = null;

  function scriptBase() {
    var s = document.currentScript;
    if (!s) {
      var all = document.getElementsByTagName("script");
      for (var i = all.length - 1; i >= 0; i--) {
        if (/apocalypse\.js/.test(all[i].src)) { s = all[i]; break; }
      }
    }
    if (!s || !s.src) return "";
    return s.src.replace(/[^/]*$/, "");
  }
  var BASE = scriptBase();

  function loadThree() {
    if (window.THREE) { THREE = window.THREE; return Promise.resolve(THREE); }
    if (threePromise) return threePromise;
    threePromise = new Promise(function (res, rej) {
      var s = document.createElement("script");
      s.src = BASE + "vendor/three.bundle.js";
      s.async = true;
      s.onload = function () {
        THREE = window.THREE;
        THREE ? res(THREE) : rej(new Error("three loaded but did not attach"));
      };
      s.onerror = function () { rej(new Error("could not load vendor/three.bundle.js")); };
      document.head.appendChild(s);
    });
    return threePromise;
  }

  /* =========================================================
     7 — SURFACES
     Nothing in this game samples an image file, so every
     material's colour, bump and roughness come out of a canvas
     painted once at load and cached by name. Painting a plank
     and letting the light do the rest looks far better than
     tinting a flat box, and costs one texture.
     ========================================================= */
  var TEX = {};

  function canvas2d(size) {
    var c = document.createElement("canvas");
    c.width = c.height = size;
    return { c: c, x: c.getContext("2d") };
  }

  /* ---- the noise every surface in the game is built out of ----
     Smooth value noise with bilinear interpolation, summed over octaves.
     Painting with this instead of with per-pixel randomness is the whole
     difference between a texture and a screenful of static: noise at the
     scale of a stain looks like a stain, noise at the scale of a pixel
     looks like a fault. */
  function valueNoise(size, cells, seed) {
    var g = new Float32Array((cells + 1) * (cells + 1));
    for (var j = 0; j <= cells; j++) {
      for (var i = 0; i <= cells; i++) {
        g[j * (cells + 1) + (i % cells)] = hash2(i % cells + seed * 131, j % cells + seed * 977);
      }
      g[j * (cells + 1) + cells] = g[j * (cells + 1)];
    }
    for (var i2 = 0; i2 <= cells; i2++) g[cells * (cells + 1) + i2] = g[i2];

    var out = new Float32Array(size * size);
    var step = cells / size;
    for (var y = 0; y < size; y++) {
      var fy = y * step, y0 = Math.floor(fy), ty = fy - y0;
      ty = ty * ty * (3 - 2 * ty);
      for (var x = 0; x < size; x++) {
        var fx = x * step, x0 = Math.floor(fx), tx = fx - x0;
        tx = tx * tx * (3 - 2 * tx);
        var a = g[y0 * (cells + 1) + x0],       b = g[y0 * (cells + 1) + x0 + 1];
        var c = g[(y0 + 1) * (cells + 1) + x0], d = g[(y0 + 1) * (cells + 1) + x0 + 1];
        out[y * size + x] = (a + (b - a) * tx) + ((c + (d - c) * tx) - (a + (b - a) * tx)) * ty;
      }
    }
    return out;
  }

  function fbm(size, cells, octaves, seed) {
    var out = new Float32Array(size * size);
    var amp = 1, total = 0, c = cells;
    for (var o = 0; o < octaves; o++) {
      var layer = valueNoise(size, Math.max(2, Math.round(c)), seed + o * 17);
      for (var i = 0; i < out.length; i++) out[i] += layer[i] * amp;
      total += amp; amp *= 0.5; c *= 2;
    }
    for (var k = 0; k < out.length; k++) out[k] /= total;
    return out;
  }

  /* lay a noise field over whatever is on the canvas, as light and shade */
  function shadeWith(x, size, field, strength, bias) {
    var img = x.getImageData(0, 0, size, size), d = img.data;
    for (var i = 0, p = 0; i < field.length; i++, p += 4) {
      var v = (field[i] - (bias == null ? 0.5 : bias)) * strength * 255;
      d[p] = clamp(d[p] + v, 0, 255);
      d[p + 1] = clamp(d[p + 1] + v, 0, 255);
      d[p + 2] = clamp(d[p + 2] + v, 0, 255);
    }
    x.putImageData(img, 0, 0);
  }

  /* a wandering line: cracks, mortar breaks, tyre marks, kerb chips */
  function crack(x, x0, y0, len, seg, wobble, width, colour) {
    x.strokeStyle = colour; x.lineWidth = width; x.lineCap = "round";
    x.beginPath(); x.moveTo(x0, y0);
    var a = Math.random() * 6.2832;
    for (var i = 0; i < seg; i++) {
      a += rnd(-wobble, wobble);
      x0 += Math.cos(a) * len; y0 += Math.sin(a) * len;
      x.lineTo(x0, y0);
    }
    x.stroke();
    return { x: x0, y: y0 };
  }

  /* value noise over a canvas, in place, multiplied into what is there */
  function grain(x, size, amount, cell) {
    var img = x.getImageData(0, 0, size, size), d = img.data;
    var n = size / (cell || 1);
    for (var y = 0; y < size; y++) {
      for (var i = 0; i < size; i++) {
        var v = (hash2(Math.floor(i / (cell || 1)), Math.floor(y / (cell || 1))) - 0.5) * amount * 255;
        var p = (y * size + i) * 4;
        d[p] = clamp(d[p] + v, 0, 255);
        d[p + 1] = clamp(d[p + 1] + v, 0, 255);
        d[p + 2] = clamp(d[p + 2] + v, 0, 255);
      }
    }
    x.putImageData(img, 0, 0);
  }

  function splotch(x, size, n, colour, rmin, rmax, alpha) {
    for (var i = 0; i < n; i++) {
      var cx = Math.random() * size, cy = Math.random() * size,
          r = rnd(rmin, rmax);
      var g = x.createRadialGradient(cx, cy, 0, cx, cy, r);
      g.addColorStop(0, "rgba(" + colour + "," + alpha + ")");
      g.addColorStop(1, "rgba(" + colour + ",0)");
      x.fillStyle = g;
      x.beginPath(); x.arc(cx, cy, r, 0, 6.2832); x.fill();
    }
  }

  var PAINT = {
    /* ---- interior wall: painted plaster with a life behind it ---- */
    plaster: function (x, s) {
      x.fillStyle = "#c3bdb6"; x.fillRect(0, 0, s, s);
      shadeWith(x, s, fbm(s, 3, 4, 11), 0.20);
      /* the wide, soft discolouration of a room nobody has repainted */
      splotch(x, s, 14, "150,140,128", s * 0.10, s * 0.34, 0.22);
      splotch(x, s, 8, "104,96,86", s * 0.04, s * 0.14, 0.20);
      /* hairline cracks out of the corners */
      for (var i = 0; i < 3; i++) {
        crack(x, Math.random() * s, Math.random() * s, s * 0.05, 7, 0.7, 1, "rgba(120,110,100,.45)");
      }
      /* a skirting shadow, so a wall has a bottom */
      var g = x.createLinearGradient(0, s * 0.80, 0, s);
      g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(1, "rgba(40,34,30,.40)");
      x.fillStyle = g; x.fillRect(0, s * 0.80, s, s * 0.20);
      grain(x, s, 0.025, 2);
    },

    /* ---- floorboards ---- */
    boards: function (x, s) {
      x.fillStyle = "#9a7042"; x.fillRect(0, 0, s, s);
      var rows = 7, h = s / rows;
      for (var r = 0; r < rows; r++) {
        var t = hash2(r, 7), t2 = hash2(r, 19);
        x.fillStyle = "rgb(" + Math.floor(112 + t * 62) + "," +
                      Math.floor(78 + t * 42) + "," + Math.floor(44 + t * 28) + ")";
        x.fillRect(0, r * h, s, h - 1);
        /* the grain of the timber, running along it */
        x.save();
        x.beginPath(); x.rect(0, r * h, s, h - 1.5); x.clip();
        for (var k = 0; k < 9; k++) {
          var yy = r * h + 2 + hash2(r, k * 3) * (h - 4);
          x.strokeStyle = "rgba(" + Math.floor(58 + t2 * 30) + ",38,18," + (0.10 + hash2(k, r) * 0.16) + ")";
          x.lineWidth = 0.6 + hash2(k, r + 4) * 1.5;
          x.beginPath(); x.moveTo(-4, yy);
          x.bezierCurveTo(s * 0.3, yy + rnd(-2.5, 2.5), s * 0.66, yy + rnd(-2.5, 2.5), s + 4, yy + rnd(-1.5, 1.5));
          x.stroke();
        }
        /* a knot every few boards */
        if (t > 0.62) {
          var kx = hash2(r, 5) * s, ky = r * h + h * 0.5;
          for (var q = 4; q > 0; q--) {
            x.strokeStyle = "rgba(52,32,14,.32)"; x.lineWidth = 1.2;
            x.beginPath(); x.ellipse(kx, ky, q * 2.4, q * 1.5, 0.4, 0, 6.2832); x.stroke();
          }
        }
        x.restore();
        /* the gap between boards, with the light catching the near edge */
        x.fillStyle = "rgba(34,20,10,.85)"; x.fillRect(0, r * h + h - 2, s, 2);
        x.fillStyle = "rgba(255,230,190,.10)"; x.fillRect(0, r * h, s, 1);
        /* the end joint */
        var jx = hash2(r, 3) * s;
        x.fillStyle = "rgba(34,20,10,.6)"; x.fillRect(jx, r * h, 1.5, h - 2);
      }
      shadeWith(x, s, fbm(s, 2, 3, 5), 0.10);
    },

    carpet: function (x, s) {
      x.fillStyle = "#7a3a44"; x.fillRect(0, 0, s, s);
      shadeWith(x, s, fbm(s, 8, 3, 21), 0.16);
      splotch(x, s, 20, "120,60,70", s * 0.05, s * 0.18, 0.24);
      grain(x, s, 0.07, 2);
    },

    /* ---- hospital vinyl: pale, scuffed, and walked on for years ---- */
    clinic: function (x, s) {
      x.fillStyle = "#ccd6d8"; x.fillRect(0, 0, s, s);
      var n = 4, g = s / n;
      for (var i = 0; i < n; i++) for (var j = 0; j < n; j++) {
        var t = hash2(i, j) * 14 - 7;
        x.fillStyle = "rgb(" + (200 + t) + "," + (212 + t) + "," + (214 + t) + ")";
        x.fillRect(i * g + 1, j * g + 1, g - 2, g - 2);
      }
      /* the joints, dark with a lit edge */
      for (var k = 0; k <= n; k++) {
        x.fillStyle = "rgba(126,142,146,.55)"; x.fillRect(k * g - 1, 0, 2, s); x.fillRect(0, k * g - 1, s, 2);
        x.fillStyle = "rgba(255,255,255,.22)"; x.fillRect(k * g + 1, 0, 1, s); x.fillRect(0, k * g + 1, s, 1);
      }
      /* the arcs a trolley wheel leaves, and the traffic down the middle */
      x.strokeStyle = "rgba(120,132,136,.22)";
      for (var a = 0; a < 7; a++) {
        x.lineWidth = rnd(1, 3);
        x.beginPath();
        x.arc(rnd(-s * 0.2, s * 1.2), rnd(-s * 0.2, s * 1.2), rnd(s * 0.2, s * 0.7),
              rnd(0, 3), rnd(3, 6.2));
        x.stroke();
      }
      shadeWith(x, s, fbm(s, 3, 4, 33), 0.12);
      splotch(x, s, 6, "86,74,58", s * 0.03, s * 0.09, 0.22);
      grain(x, s, 0.02, 2);
    },

    /* ---- asphalt: aggregate, patches, cracks, and standing water ---- */
    asphalt: function (x, s) {
      x.fillStyle = "#2a2e34"; x.fillRect(0, 0, s, s);
      /* the big tonal patching that makes a road look resurfaced */
      shadeWith(x, s, fbm(s, 3, 4, 7), 0.26);
      /* aggregate */
      for (var i = 0; i < 900; i++) {
        var v = 44 + Math.random() * 62;
        x.fillStyle = "rgba(" + v + "," + (v + 3) + "," + (v + 8) + ",.45)";
        var r0 = rnd(1.6, 4.6);
        x.beginPath();
        x.ellipse(Math.random() * s, Math.random() * s, r0, r0 * rnd(0.55, 1), Math.random() * 3, 0, 6.2832);
        x.fill();
      }
      /* cracking, with the tar somebody poured into it */
      for (var c = 0; c < 5; c++) {
        var sx = Math.random() * s, sy = Math.random() * s;
        crack(x, sx, sy, s * 0.055, 9, 0.8, rnd(2, 4), "rgba(14,15,18,.8)");
        crack(x, sx, sy, s * 0.045, 6, 1.1, rnd(1, 2), "rgba(20,21,25,.6)");
      }
      /* a repair patch */
      x.fillStyle = "rgba(26,28,33,.75)";
      x.beginPath();
      x.ellipse(s * rnd(0.2, 0.8), s * rnd(0.2, 0.8), s * rnd(0.10, 0.20), s * rnd(0.07, 0.16),
                Math.random() * 3, 0, 6.2832);
      x.fill();
      /* and the water that has not drained off it */
      var wet = fbm(s, 4, 3, 91);
      var img = x.getImageData(0, 0, s, s), d = img.data;
      for (var q = 0, pp = 0; q < wet.length; q++, pp += 4) {
        if (wet[q] < 0.42) {
          var k = (0.42 - wet[q]) * 2.4;
          d[pp] *= 1 - k * 0.5; d[pp + 1] *= 1 - k * 0.46; d[pp + 2] *= 1 - k * 0.36;
        }
      }
      x.putImageData(img, 0, 0);
    },

    /* the roughness of that same road: the puddles are the smooth parts */
    asphaltR: function (x, s) {
      x.fillStyle = "#d8d8d8"; x.fillRect(0, 0, s, s);
      var wet = fbm(s, 4, 3, 91);
      var fine = fbm(s, 24, 2, 3);
      var img = x.getImageData(0, 0, s, s), d = img.data;
      for (var q = 0, pp = 0; q < wet.length; q++, pp += 4) {
        var v = 190 + fine[q] * 50;
        if (wet[q] < 0.42) v = 18 + (wet[q] / 0.42) * 90;      /* standing water */
        else if (wet[q] < 0.52) v = 90 + ((wet[q] - 0.42) / 0.10) * 110;  /* damp */
        d[pp] = d[pp + 1] = d[pp + 2] = v;
      }
      x.putImageData(img, 0, 0);
    },

    /* ---- pavement: slabs, chipped, stained, weeds in the joints ---- */
    pave: function (x, s) {
      x.fillStyle = "#77808a"; x.fillRect(0, 0, s, s);
      var n = 2, g = s / n;
      for (var i = 0; i < n; i++) for (var j = 0; j < n; j++) {
        var t = hash2(i * 3, j * 5) * 22 - 11;
        x.fillStyle = "rgb(" + (116 + t) + "," + (124 + t) + "," + (134 + t) + ")";
        x.beginPath();
        x.rect(i * g + 3, j * g + 3, g - 6, g - 6);
        x.fill();
        /* a lit top edge and a shadowed bottom, so a slab has thickness */
        x.fillStyle = "rgba(255,255,255,.14)"; x.fillRect(i * g + 3, j * g + 3, g - 6, 2);
        x.fillStyle = "rgba(0,0,0,.24)"; x.fillRect(i * g + 3, j * g + g - 5, g - 6, 2);
        /* chipped corners */
        for (var c = 0; c < 3; c++) {
          x.fillStyle = "rgba(56,62,70,.5)";
          x.beginPath();
          x.arc(i * g + 3 + Math.random() * (g - 6), j * g + 3 + Math.random() * (g - 6),
                rnd(1.5, 4), 0, 6.2832);
          x.fill();
        }
      }
      /* what grows in the joints */
      x.strokeStyle = "rgba(72,92,48,.5)";
      for (var w = 0; w < 22; w++) {
        var jx = (Math.random() < 0.5 ? g : 0) + rnd(-2, 2);
        var jy = Math.random() * s;
        x.lineWidth = 1;
        x.beginPath(); x.moveTo(jx, jy); x.lineTo(jx + rnd(-3, 3), jy - rnd(3, 9)); x.stroke();
      }
      shadeWith(x, s, fbm(s, 3, 4, 13), 0.16);
      splotch(x, s, 10, "48,52,58", s * 0.04, s * 0.16, 0.22);
      grain(x, s, 0.02, 2);
    },

    grass: function (x, s) {
      x.fillStyle = "#43592c"; x.fillRect(0, 0, s, s);
      shadeWith(x, s, fbm(s, 4, 4, 3), 0.28);
      splotch(x, s, 10, "92,80,48", s * 0.05, s * 0.18, 0.26);   /* worn patches */
      for (var i = 0; i < 1300; i++) {
        var gx = Math.random() * s, gy = Math.random() * s, l = rnd(5, 14);
        var v = Math.random();
        x.strokeStyle = "rgba(" + Math.floor(56 + v * 54) + "," +
                        Math.floor(84 + v * 66) + "," + Math.floor(34 + v * 34) + ",.7)";
        x.lineWidth = rnd(1.1, 2.3);
        x.beginPath(); x.moveTo(gx, gy);
        x.quadraticCurveTo(gx + rnd(-2, 2), gy - l * 0.6, gx + rnd(-4, 4), gy - l);
        x.stroke();
      }
    },

    dirt: function (x, s) {
      x.fillStyle = "#7a6748"; x.fillRect(0, 0, s, s);
      shadeWith(x, s, fbm(s, 4, 4, 29), 0.26);
      splotch(x, s, 22, "96,80,56", s * 0.05, s * 0.2, 0.3);
      splotch(x, s, 14, "52,42,30", s * 0.02, s * 0.09, 0.34);
      for (var i = 0; i < 420; i++) {
        var v = 62 + Math.random() * 66;
        x.fillStyle = "rgba(" + v + "," + (v - 14) + "," + (v - 34) + ",.42)";
        x.beginPath();
        x.arc(Math.random() * s, Math.random() * s, rnd(1, 3.4), 0, 6.2832);
        x.fill();
      }
      /* a rut, and what has washed into it */
      crack(x, 0, Math.random() * s, s * 0.08, 14, 0.35, 5, "rgba(64,52,36,.4)");
    },

    /* ---- brick: real bond, real mortar, and a century of weather ---- */
    brick: function (x, s) {
      x.fillStyle = "#8d8378"; x.fillRect(0, 0, s, s);        /* the mortar */
      shadeWith(x, s, fbm(s, 6, 3, 61), 0.18);
      var rows = 9, h = s / rows, w = s / 4;
      for (var r = 0; r < rows; r++) {
        var off = (r % 2) * w * 0.5;
        for (var c = -1; c < 5; c++) {
          var t = hash2(r * 7, c * 5), t2 = hash2(c * 11, r * 3);
          var bx = c * w + off + 2, by = r * h + 2, bw = w - 4, bh = h - 4;
          /* the brick */
          x.fillStyle = "rgb(" + Math.floor(96 + t * 62) + "," +
                        Math.floor(54 + t * 30) + "," + Math.floor(44 + t2 * 26) + ")";
          x.fillRect(bx, by, bw, bh);
          /* face texture and the odd spalled one */
          x.save(); x.beginPath(); x.rect(bx, by, bw, bh); x.clip();
          for (var f = 0; f < 5; f++) {
            x.fillStyle = "rgba(" + Math.floor(60 + t * 50) + ",34,28,.16)";
            x.beginPath();
            x.arc(bx + Math.random() * bw, by + Math.random() * bh, rnd(1, 4), 0, 6.2832);
            x.fill();
          }
          if (t2 > 0.88) {
            x.fillStyle = "rgba(150,140,128,.5)";
            x.beginPath();
            x.arc(bx + Math.random() * bw, by + Math.random() * bh, rnd(3, 7), 0, 6.2832);
            x.fill();
          }
          x.restore();
          /* lit top edge, shadowed bottom: brick has depth in it */
          x.fillStyle = "rgba(255,225,200,.13)"; x.fillRect(bx, by, bw, 1.5);
          x.fillStyle = "rgba(0,0,0,.30)"; x.fillRect(bx, by + bh - 1.5, bw, 1.5);
          x.fillStyle = "rgba(0,0,0,.18)"; x.fillRect(bx + bw - 1.5, by, 1.5, bh);
        }
      }
      /* soot, damp and the stain under a broken gutter */
      splotch(x, s, 7, "38,32,28", s * 0.06, s * 0.24, 0.26);
      var gx = Math.random() * s;
      var gg = x.createLinearGradient(gx, 0, gx, s);
      gg.addColorStop(0, "rgba(30,26,22,.34)"); gg.addColorStop(1, "rgba(30,26,22,0)");
      x.fillStyle = gg; x.fillRect(gx - s * 0.05, 0, s * 0.1, s);
      grain(x, s, 0.02, 2);
    },

    /* ---- concrete panel: cast, tied, stained, rust-streaked ---- */
    block: function (x, s) {
      x.fillStyle = "#9aa0a8"; x.fillRect(0, 0, s, s);
      shadeWith(x, s, fbm(s, 3, 4, 41), 0.16);
      shadeWith(x, s, fbm(s, 14, 2, 7), 0.07);
      /* the marks the shuttering left */
      var panels = 2, pw = s / panels;
      for (var i = 0; i <= panels; i++) {
        x.fillStyle = "rgba(70,76,84,.45)"; x.fillRect(i * pw - 1, 0, 2, s);
        x.fillStyle = "rgba(255,255,255,.10)"; x.fillRect(i * pw + 1, 0, 1, s);
      }
      /* form-tie holes, and the rust running out of them */
      for (var t = 0; t < 6; t++) {
        var hx = rnd(0.1, 0.9) * s, hy = rnd(0.1, 0.9) * s;
        x.fillStyle = "rgba(64,68,74,.75)";
        x.beginPath(); x.arc(hx, hy, 2.6, 0, 6.2832); x.fill();
        var rg = x.createLinearGradient(hx, hy, hx, hy + s * 0.22);
        rg.addColorStop(0, "rgba(126,76,42,.40)"); rg.addColorStop(1, "rgba(126,76,42,0)");
        x.fillStyle = rg; x.fillRect(hx - 3, hy, 6, s * 0.22);
      }
      /* water staining down the face */
      for (var w = 0; w < 4; w++) {
        var wx = Math.random() * s;
        var wg = x.createLinearGradient(wx, 0, wx, s);
        wg.addColorStop(0, "rgba(58,62,66,.30)"); wg.addColorStop(1, "rgba(58,62,66,0)");
        x.fillStyle = wg; x.fillRect(wx - rnd(2, 9), 0, rnd(6, 20), s);
      }
      crack(x, Math.random() * s, 0, s * 0.07, 8, 0.5, 1.4, "rgba(74,78,84,.6)");
      splotch(x, s, 6, "60,64,70", s * 0.05, s * 0.18, 0.2);
      grain(x, s, 0.02, 2);
    },

    metal: function (x, s) {
      x.fillStyle = "#5b6068"; x.fillRect(0, 0, s, s);
      shadeWith(x, s, fbm(s, 5, 3, 71), 0.14);
      /* brushed, along one axis */
      for (var i = 0; i < 320; i++) {
        x.strokeStyle = "rgba(" + irnd(74, 138) + "," + irnd(78, 142) + "," + irnd(86, 150) + ",.22)";
        x.lineWidth = rnd(0.5, 1.8);
        var y = Math.random() * s;
        x.beginPath(); x.moveTo(0, y); x.lineTo(s, y + rnd(-1.5, 1.5)); x.stroke();
      }
      /* rust where the coating has gone */
      splotch(x, s, 7, "122,68,34", s * 0.02, s * 0.11, 0.34);
      splotch(x, s, 3, "86,44,20", s * 0.01, s * 0.05, 0.4);
      grain(x, s, 0.02, 2);
    },

    /* ---- glass: not clear, but dirty, cracked and reflecting ---- */
    glass: function (x, s) {
      x.fillStyle = "#20303e"; x.fillRect(0, 0, s, s);
      var g = x.createLinearGradient(0, 0, s, s);
      g.addColorStop(0, "rgba(150,190,225,.42)");
      g.addColorStop(0.45, "rgba(70,100,130,.12)");
      g.addColorStop(1, "rgba(30,46,62,.30)");
      x.fillStyle = g; x.fillRect(0, 0, s, s);
      shadeWith(x, s, fbm(s, 4, 3, 53), 0.10);
      /* grime at the edges */
      x.fillStyle = "rgba(40,44,42,.35)";
      x.fillRect(0, 0, s, s * 0.08); x.fillRect(0, s * 0.92, s, s * 0.08);
      x.fillRect(0, 0, s * 0.06, s); x.fillRect(s * 0.94, 0, s * 0.06, s);
      /* and a star crack, because it is that kind of week */
      if (Math.random() < 0.55) {
        var cx = rnd(0.3, 0.7) * s, cy = rnd(0.3, 0.7) * s;
        for (var i2 = 0; i2 < 7; i2++) {
          var a = i2 / 7 * 6.2832 + rnd(-0.2, 0.2);
          x.strokeStyle = "rgba(225,240,255,.5)"; x.lineWidth = rnd(0.8, 1.8);
          x.beginPath(); x.moveTo(cx, cy);
          x.lineTo(cx + Math.cos(a) * rnd(s * 0.1, s * 0.4), cy + Math.sin(a) * rnd(s * 0.1, s * 0.4));
          x.stroke();
        }
      }
    },

    bark: function (x, s) {
      x.fillStyle = "#43331f"; x.fillRect(0, 0, s, s);
      shadeWith(x, s, fbm(s, 3, 3, 83), 0.2);
      for (var i = 0; i < 110; i++) {
        var cx = Math.random() * s;
        x.strokeStyle = "rgba(" + irnd(26, 96) + "," + irnd(20, 70) + "," + irnd(12, 42) + ",.72)";
        x.lineWidth = rnd(1, 4.5);
        x.beginPath(); x.moveTo(cx, -4);
        for (var y = 0; y < s + 8; y += 10) x.lineTo(cx + rnd(-3, 3), y);
        x.stroke();
      }
      splotch(x, s, 8, "94,108,72", s * 0.02, s * 0.08, 0.22);   /* moss */
      grain(x, s, 0.03, 2);
    },

    leaves: function (x, s) {
      x.fillStyle = "#2c4a24"; x.fillRect(0, 0, s, s);
      shadeWith(x, s, fbm(s, 5, 3, 97), 0.24);
      for (var i = 0; i < 620; i++) {
        var v = Math.random();
        x.fillStyle = "rgba(" + Math.floor(32 + v * 62) + "," +
                      Math.floor(60 + v * 78) + "," + Math.floor(24 + v * 42) + ",.8)";
        var cx = Math.random() * s, cy = Math.random() * s;
        x.beginPath(); x.ellipse(cx, cy, rnd(3, 9), rnd(2, 5), Math.random() * 3.14, 0, 6.2832); x.fill();
      }
    },

    /* ---- cloth: a weave, and the way it creases ---- */
    cloth: function (x, s) {
      x.fillStyle = "#cccccc"; x.fillRect(0, 0, s, s);
      /* the weave */
      for (var i = 0; i < s; i += 3) {
        x.fillStyle = "rgba(255,255,255,.055)"; x.fillRect(i, 0, 1.5, s);
        x.fillStyle = "rgba(0,0,0,.045)"; x.fillRect(0, i, s, 1.5);
      }
      /* soft folds */
      shadeWith(x, s, fbm(s, 4, 3, 23), 0.13);
      shadeWith(x, s, fbm(s, 11, 2, 47), 0.05);
      grain(x, s, 0.02, 2);
    },

    /* the same, as height, so a jacket creases under the light */
    clothR: function (x, s) {
      x.fillStyle = "#bdbdbd"; x.fillRect(0, 0, s, s);
      shadeWith(x, s, fbm(s, 4, 3, 23), 0.5);
      shadeWith(x, s, fbm(s, 16, 2, 5), 0.12);
    },

    denim: function (x, s) {
      x.fillStyle = "#b9c2cf"; x.fillRect(0, 0, s, s);
      for (var i = 0; i < s; i += 2) {
        x.fillStyle = "rgba(255,255,255,.10)"; x.fillRect(i, 0, 1, s);
        x.fillStyle = "rgba(0,0,0,.09)"; x.fillRect(0, i + 1, s, 1);
      }
      shadeWith(x, s, fbm(s, 5, 3, 31), 0.14);
      /* the pale wear along a seam */
      splotch(x, s, 5, "255,255,255", s * 0.03, s * 0.14, 0.16);
      grain(x, s, 0.02, 2);
    },

    /* ---- skin: not one colour ---- */
    skin: function (x, s) {
      x.fillStyle = "#e6c6ad"; x.fillRect(0, 0, s, s);
      shadeWith(x, s, fbm(s, 6, 3, 67), 0.055);
      splotch(x, s, 12, "216,168,148", s * 0.05, s * 0.16, 0.18);
      splotch(x, s, 6, "246,226,212", s * 0.04, s * 0.12, 0.16);
      grain(x, s, 0.012, 2);
    },

    /* ---- what is left of them ---- */
    rot: function (x, s) {
      x.fillStyle = "#9aa88c"; x.fillRect(0, 0, s, s);
      shadeWith(x, s, fbm(s, 5, 4, 43), 0.20);
      splotch(x, s, 22, "88,102,74", s * 0.04, s * 0.2, 0.4);
      splotch(x, s, 10, "116,82,74", s * 0.02, s * 0.08, 0.34);
      splotch(x, s, 8, "56,64,52", s * 0.03, s * 0.12, 0.34);
      /* the veining under it */
      for (var i = 0; i < 12; i++) {
        crack(x, Math.random() * s, Math.random() * s, s * 0.035, 6, 1.0, 1, "rgba(70,58,64,.34)");
      }
      grain(x, s, 0.03, 2);
    },

    hair: function (x, s) {
      x.fillStyle = "#cfcfcf"; x.fillRect(0, 0, s, s);
      for (var i = 0; i < 900; i++) {
        var v = Math.random();
        var g0 = Math.floor(150 + v * 105);
        x.strokeStyle = "rgba(" + g0 + "," + g0 + "," + g0 + ",.5)";
        x.lineWidth = rnd(0.7, 2.1);
        var hx = Math.random() * s, hy = Math.random() * s;
        x.beginPath(); x.moveTo(hx, hy);
        x.quadraticCurveTo(hx + rnd(-4, 4), hy + s * 0.12, hx + rnd(-8, 8), hy + s * 0.26);
        x.stroke();
      }
      shadeWith(x, s, fbm(s, 7, 3, 19), 0.22);
    },

    /* ---- felt-and-batten flat roof, seen from above ---- */
    roof: function (x, s) {
      x.fillStyle = "#2e3138"; x.fillRect(0, 0, s, s);
      shadeWith(x, s, fbm(s, 4, 4, 59), 0.20);
      for (var i = 0; i < 700; i++) {
        var v = 36 + Math.random() * 36;
        x.fillStyle = "rgba(" + v + "," + (v + 2) + "," + (v + 6) + ",.42)";
        x.fillRect(Math.random() * s, Math.random() * s, rnd(1, 3), rnd(1, 3));
      }
      /* the laps, and the bitumen squeezed out of them */
      for (var r = 0; r < 5; r++) {
        var y = r * s / 5 + 4;
        x.strokeStyle = "rgba(15,17,20,.7)"; x.lineWidth = 2.4;
        x.beginPath(); x.moveTo(0, y); x.lineTo(s, y + rnd(-1, 1)); x.stroke();
        x.strokeStyle = "rgba(96,100,108,.16)"; x.lineWidth = 1;
        x.beginPath(); x.moveTo(0, y - 2); x.lineTo(s, y - 2 + rnd(-1, 1)); x.stroke();
      }
      splotch(x, s, 6, "26,28,32", s * 0.05, s * 0.2, 0.34);
      splotch(x, s, 3, "78,94,106", s * 0.06, s * 0.18, 0.20);   /* ponding */
      crack(x, Math.random() * s, Math.random() * s, s * 0.05, 7, 0.8, 2, "rgba(18,19,22,.6)");
    }
  };

  function tex(name, size, repeat) {
    var key = name + "|" + (repeat || 1);
    if (TEX[key]) return TEX[key];
    var s = size || 256, cc = canvas2d(s);
    (PAINT[name] || PAINT.plaster)(cc.x, s);
    var t = new THREE.CanvasTexture(cc.c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    if (repeat) t.repeat.set(repeat, repeat);
    t.anisotropy = 4;
    t.colorSpace = THREE.SRGBColorSpace;
    TEX[key] = t;
    return t;
  }

  /* the same canvas again, but read as height — cheap relief without
     ever computing a normal map */
  function bump(name, size, repeat) {
    var key = "B" + name + "|" + (repeat || 1);
    if (TEX[key]) return TEX[key];
    var s = size || 256, cc = canvas2d(s);
    (PAINT[name] || PAINT.plaster)(cc.x, s);
    var t = new THREE.CanvasTexture(cc.c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    if (repeat) t.repeat.set(repeat, repeat);
    TEX[key] = t;
    return t;
  }

  /* The roughness channel, painted by its own painter, so one surface can
     be wet in one place and dry in another — which is most of what makes a
     night street look like a night street rather than a grey plane. */
  function roughTex(name, size, repeat) {
    var key = "R" + name + "|" + (repeat || 1);
    if (TEX[key]) return TEX[key];
    var s2 = size || 256, cc = canvas2d(s2);
    (PAINT[name] || PAINT.plaster)(cc.x, s2);
    var t = new THREE.CanvasTexture(cc.c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    if (repeat) t.repeat.set(repeat, repeat);
    t.anisotropy = 8;
    TEX[key] = t;
    return t;
  }

  function surface(name, opts) {
    opts = opts || {};
    var size = opts.size || 256, rep2 = opts.repeat || 1;
    var m = new THREE.MeshStandardMaterial({
      map: tex(name, size, rep2),
      bumpMap: opts.bump === false ? null : bump(name, size, rep2),
      bumpScale: opts.bumpScale == null ? 0.14 : opts.bumpScale,
      roughness: opts.rough == null ? 0.92 : opts.rough,
      metalness: opts.metal == null ? 0.02 : opts.metal,
      color: opts.tint == null ? 0xffffff : opts.tint,
      envMapIntensity: opts.envInt == null ? 1 : opts.envInt
    });
    if (opts.roughMap) {
      /* the map multiplies the scalar, so the scalar becomes the ceiling */
      m.roughnessMap = roughTex(opts.roughMap, size, rep2);
      m.roughness = opts.rough == null ? 1 : opts.rough;
    }
    if (opts.emissive) { m.emissive = new THREE.Color(opts.emissive); m.emissiveIntensity = opts.emissiveIntensity || 1; }
    return m;
  }

  /* =========================================================
     8 — SKY
     A back-side sphere with a gradient painted in the fragment
     shader, so dawn can be swept from indigo to gold in one
     uniform, plus a field of stars that twinkle at different
     rates and a moon that is a real object rather than a decal.
     ========================================================= */
  var SKY_VERT = [
    "varying vec3 vDir;",
    "void main(){",
    "  vDir = normalize(position);",
    "  gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);",
    "}"
  ].join("\n");

  var SKY_FRAG = [
    "varying vec3 vDir;",
    "uniform vec3 cLow; uniform vec3 cMid; uniform vec3 cHigh;",
    "uniform vec3 sunDir; uniform vec3 sunCol; uniform float sunAmt;",
    "uniform float time;",
    "float h21(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }",
    "void main(){",
    "  float y = clamp(vDir.y*0.5+0.5, 0.0, 1.0);",
    "  vec3 col = mix(cLow, cMid, smoothstep(0.42, 0.56, y));",
    "  col = mix(col, cHigh, smoothstep(0.55, 0.92, y));",
    /* the sun or the moon's own glow, smeared along the horizon */
    "  float d = max(dot(normalize(vDir), normalize(sunDir)), 0.0);",
    "  col += sunCol * pow(d, 42.0) * sunAmt * 2.2;",
    "  col += sunCol * pow(d, 4.0) * sunAmt * 0.30;",
    /* a little banding break so the gradient never posterises */
    "  col += (h21(gl_FragCoord.xy + time) - 0.5) * 0.012;",
    "  gl_FragColor = vec4(col, 1.0);",
    "}"
  ].join("\n");

  function makeSky() {
    var u = {
      cLow:   { value: new THREE.Color(0x0a1024) },
      cMid:   { value: new THREE.Color(0x0d1430) },
      cHigh:  { value: new THREE.Color(0x05070f) },
      sunDir: { value: new THREE.Vector3(0.4, 0.15, -1).normalize() },
      sunCol: { value: new THREE.Color(0xffd9a0) },
      sunAmt: { value: 0.0 },
      time:   { value: 0 }
    };
    var mesh = new THREE.Mesh(
      new THREE.SphereGeometry(420, 32, 20),
      new THREE.ShaderMaterial({
        vertexShader: SKY_VERT, fragmentShader: SKY_FRAG,
        uniforms: u, side: THREE.BackSide, depthWrite: false, fog: false
      })
    );
    mesh.renderOrder = -1000;
    mesh.frustumCulled = false;
    return { mesh: mesh, u: u };
  }

  function makeStars(count, radius) {
    var g = new THREE.BufferGeometry();
    var pos = new Float32Array(count * 3), siz = new Float32Array(count),
        pha = new Float32Array(count), bri = new Float32Array(count);
    for (var i = 0; i < count; i++) {
      var th = Math.random() * 6.2832;
      var ph = Math.acos(clamp(Math.random() * 0.92 + 0.06, -1, 1));  /* upper hemisphere */
      var r = radius;
      pos[i * 3]     = r * Math.sin(ph) * Math.cos(th);
      pos[i * 3 + 1] = r * Math.cos(ph);
      pos[i * 3 + 2] = r * Math.sin(ph) * Math.sin(th);
      siz[i] = rnd(0.8, 3.2);
      pha[i] = Math.random() * 6.2832;
      bri[i] = rnd(0.3, 1.0);
    }
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("aSize", new THREE.BufferAttribute(siz, 1));
    g.setAttribute("aPhase", new THREE.BufferAttribute(pha, 1));
    g.setAttribute("aBright", new THREE.BufferAttribute(bri, 1));
    var u = { time: { value: 0 }, amt: { value: 1.0 }, pxScale: { value: 1.0 } };
    var m = new THREE.ShaderMaterial({
      uniforms: u, transparent: true, depthWrite: false, fog: false,
      blending: THREE.AdditiveBlending,
      vertexShader: [
        "attribute float aSize; attribute float aPhase; attribute float aBright;",
        "uniform float time; uniform float pxScale;",
        "varying float vB;",
        "void main(){",
        "  vec4 mv = modelViewMatrix * vec4(position,1.0);",
        "  float tw = 0.62 + 0.38*sin(time*(0.7+aPhase*0.21) + aPhase*7.0);",
        "  vB = aBright * tw;",
        "  gl_PointSize = aSize * pxScale;",
        "  gl_Position = projectionMatrix * mv;",
        "}"
      ].join("\n"),
      fragmentShader: [
        "uniform float amt; varying float vB;",
        "void main(){",
        "  vec2 d = gl_PointCoord - 0.5;",
        "  float a = smoothstep(0.5, 0.06, length(d));",
        "  gl_FragColor = vec4(vec3(0.86,0.90,1.0) * vB, a * vB * amt);",
        "}"
      ].join("\n")
    });
    var p = new THREE.Points(g, m);
    p.frustumCulled = false;
    p.renderOrder = -900;
    return { points: p, u: u };
  }

  function makeMoon(size) {
    var g = new THREE.Group();
    var body = new THREE.Mesh(
      new THREE.SphereGeometry(size, 28, 20),
      new THREE.MeshBasicMaterial({ color: 0xf3f0e4, fog: false })
    );
    /* craters, as slightly darker dimples pressed into the surface */
    for (var i = 0; i < 9; i++) {
      var r = size * rnd(0.08, 0.22);
      var c = new THREE.Mesh(
        new THREE.CircleGeometry(r, 12),
        new THREE.MeshBasicMaterial({ color: 0xd6d2c2, fog: false, transparent: true, opacity: 0.75 })
      );
      var th = rnd(0, 6.28), ph = rnd(0.4, 2.6);
      c.position.set(
        size * 1.002 * Math.sin(ph) * Math.cos(th),
        size * 1.002 * Math.cos(ph),
        size * 1.002 * Math.sin(ph) * Math.sin(th)
      );
      c.lookAt(0, 0, 0); c.rotateY(Math.PI);
      body.add(c);
    }
    g.add(body);
    /* the halo — a billboard that always faces us */
    var halo = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTexture(), color: 0xdfe6ff, transparent: true,
      blending: THREE.AdditiveBlending, depthWrite: false, fog: false, opacity: 0.55
    }));
    halo.scale.set(size * 9, size * 9, 1);
    g.add(halo);
    g.renderOrder = -880;
    return g;
  }

  /* one radial-gradient sprite, reused by every glow in the game */
  var _glowTex = null;
  function glowTexture() {
    if (_glowTex) return _glowTex;
    var cc = canvas2d(128), x = cc.x;
    var g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0.0, "rgba(255,255,255,1)");
    g.addColorStop(0.22, "rgba(255,255,255,.55)");
    g.addColorStop(0.55, "rgba(255,255,255,.14)");
    g.addColorStop(1.0, "rgba(255,255,255,0)");
    x.fillStyle = g; x.fillRect(0, 0, 128, 128);
    _glowTex = new THREE.CanvasTexture(cc.c);
    return _glowTex;
  }

  /* The torch is a light at her own eye line, so the shadow it casts of
     her goes straight out behind her and you never see it. Without this
     she reads as a cut-out standing in front of the floor rather than on
     it. Everything that walks gets one. */
  var _contactTex = null;
  function contactTexture() {
    if (_contactTex) return _contactTex;
    var cc = canvas2d(64), x = cc.x;
    var g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0.0, "rgba(0,0,0,.85)");
    g.addColorStop(0.45, "rgba(0,0,0,.5)");
    g.addColorStop(1.0, "rgba(0,0,0,0)");
    x.fillStyle = g; x.fillRect(0, 0, 64, 64);
    _contactTex = new THREE.CanvasTexture(cc.c);
    return _contactTex;
  }

  function contactShadow(scale) {
    var m = new THREE.Mesh(
      geo("contactP", function () { return new THREE.PlaneGeometry(1, 1); }),
      new THREE.MeshBasicMaterial({ map: contactTexture(), transparent: true,
        depthWrite: false, opacity: 0.55, fog: true, toneMapped: false }));
    m.rotation.x = -Math.PI / 2;
    m.position.y = 0.02;
    m.scale.setScalar(scale || 1.05);
    m.renderOrder = 2;
    return m;
  }

  /* a soft round blob used for dust, embers and fireflies */
  var _dotTex = null;
  function dotTexture() {
    if (_dotTex) return _dotTex;
    var cc = canvas2d(64), x = cc.x;
    var g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(0.4, "rgba(255,255,255,.5)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    x.fillStyle = g; x.fillRect(0, 0, 64, 64);
    _dotTex = new THREE.CanvasTexture(cc.c);
    return _dotTex;
  }

  /* =========================================================
     9 — THE POST CHAIN
     Bloom for anything that emits, then one pass that does the
     colour grade, the haze, the vignette, a touch of lens
     fringing, and the red pulse when something has hold of her.
     One pass, so it costs one full-screen draw.

     There is deliberately no film grain and no dither in here.
     Grain is a way of hiding a render; this one does not need
     hiding, and at any resolution above a phone it reads as
     dirt on the screen rather than as atmosphere. The banding
     it used to cover is handled by rendering to a half-float
     target instead.
     ========================================================= */
  var GRADE_FRAG = [
    "uniform sampler2D tDiffuse;",
    "uniform vec3 gradeCol; uniform float gradeAmt;",
    "uniform vec3 hazeCol;  uniform float hazeAmt;",
    "uniform float vig; uniform float time;",
    "uniform float fringe; uniform float redPulse; uniform float flash;",
    "uniform float fade; uniform float sat; uniform float exposure;",
    "varying vec2 vUv;",
    "void main(){",
    "  vec2 uv = vUv;",
    "  vec2 c = uv - 0.5;",
    "  float r2 = dot(c,c);",
    /* lens fringing — the channels do not quite line up at the edges */
    "  vec3 col;",
    "  if (fringe > 0.0001) {",
    "    vec2 off = c * fringe * (0.4 + r2);",
    "    col.r = texture2D(tDiffuse, uv + off).r;",
    "    col.g = texture2D(tDiffuse, uv).g;",
    "    col.b = texture2D(tDiffuse, uv - off).b;",
    "  } else { col = texture2D(tDiffuse, uv).rgb; }",
    "  col *= exposure;",
    /* the location's grade, laid over as a soft-light-ish tint */
    "  vec3 g = mix(col, gradeCol * (0.5 + col), 0.5);",
    "  col = mix(col, g, gradeAmt);",
    /* haze thins the top of the frame and sits in the distance */
    "  col = mix(col, hazeCol, hazeAmt * smoothstep(0.0, 0.75, 1.0 - uv.y) * 0.55);",
    /* saturation */
    "  float l = dot(col, vec3(0.2126,0.7152,0.0722));",
    "  col = mix(vec3(l), col, sat);",
    /* something has hold of her */
    "  col = mix(col, vec3(l*0.85, l*0.10, l*0.14) + vec3(0.22,0.0,0.02), redPulse);",
    "  col += flash;",
    /* vignette: a wide, soft falloff, not a black ring */
    "  col *= 1.0 - vig * smoothstep(0.10, 0.95, r2) * (0.55 + 0.45*r2);",
    "  col *= fade;",
    "  gl_FragColor = vec4(col, 1.0);",
    "}"
  ].join("\n");

  var GRADE_VERT = [
    "varying vec2 vUv;",
    "void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }"
  ].join("\n");

  /* =========================================================
     9b — THE ENVIRONMENT
     A physically based material with nothing to reflect is a
     flat colour with a highlight on it. This renders the level's
     own sky and ground into a cube once, runs it through PMREM,
     and hands it to the scene — so glass has a sky in it, wet
     tarmac has the streetlights in it, and metal stops looking
     like plastic. It costs one render at load and nothing after.
     ========================================================= */
  function buildEnvironment(renderer, sky, pal, dark) {
    var pm = new THREE.PMREMGenerator(renderer);
    pm.compileEquirectangularShader();

    var envScene = new THREE.Scene();
    /* the same gradient the sky dome is using, so reflections agree with
       what is actually overhead */
    var dome = new THREE.Mesh(
      new THREE.SphereGeometry(60, 24, 16),
      new THREE.ShaderMaterial({
        vertexShader: SKY_VERT, fragmentShader: SKY_FRAG,
        uniforms: {
          cLow: { value: sky.u.cLow.value.clone() },
          cMid: { value: sky.u.cMid.value.clone() },
          cHigh: { value: sky.u.cHigh.value.clone() },
          sunDir: { value: sky.u.sunDir.value.clone() },
          sunCol: { value: sky.u.sunCol.value.clone() },
          sunAmt: { value: sky.u.sunAmt.value },
          time: { value: 0 }
        },
        side: THREE.BackSide, depthWrite: false, fog: false
      }));
    envScene.add(dome);

    /* a ground half, or everything shiny reflects sky from underneath too
       and reads as floating */
    var ground = new THREE.Mesh(
      new THREE.SphereGeometry(59, 20, 12, 0, 6.2832, Math.PI / 2, Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: shade(pal.ambient, 2.2), side: THREE.BackSide, fog: false }));
    envScene.add(ground);

    /* one soft source so there is something for a highlight to be */
    var glow = new THREE.Mesh(
      new THREE.SphereGeometry(7, 12, 8),
      new THREE.MeshBasicMaterial({ color: shade(pal.key, dark > 0.5 ? 0.55 : 1.4), fog: false }));
    glow.position.set(-26, 22, -30);
    envScene.add(glow);

    var rt = pm.fromScene(envScene, 0.04, 0.1, 120);
    dome.geometry.dispose(); dome.material.dispose();
    ground.geometry.dispose(); ground.material.dispose();
    glow.geometry.dispose(); glow.material.dispose();
    pm.dispose();
    return rt.texture;
  }

  /* =========================================================
     10 — THE STAGE
     Renderer, camera, composer, and the one place that knows
     how big the canvas actually is.
     ========================================================= */
  var Stage = {
    renderer: null, camera: null, composer: null, gradePass: null,
    bloom: null, w: 0, h: 0, dpr: 1, quality: 1, ready: false,

    init: function (canvas) {
      if (Stage.ready) return;
      var r;
      try {
        r = Stage.build(canvas);
      } catch (e) {
        Stage.renderer = null;
        return;
      }
      Stage.finish(canvas, r);
    },

    build: function (canvas) {
      return new THREE.WebGLRenderer({
        canvas: canvas, antialias: true, powerPreference: "high-performance",
        stencil: false, alpha: false
      });
    },

    finish: function (canvas, r) {
      r.setClearColor(0x000000, 1);
      r.shadowMap.enabled = true;
      r.shadowMap.type = THREE.PCFSoftShadowMap;
      r.shadowMap.autoUpdate = true;
      r.toneMapping = THREE.ACESFilmicToneMapping;
      r.toneMappingExposure = 1.08;
      r.outputColorSpace = THREE.SRGBColorSpace;
      Stage.renderer = r;
      Stage.maxSamples = 4;
      try {
        var gl = r.getContext();
        if (gl && gl.getParameter && gl.MAX_SAMPLES) {
          Stage.maxSamples = Math.min(8, gl.getParameter(gl.MAX_SAMPLES) || 4);
        }
      } catch (e) {}

      /* the canvas is authored at 320x180 in the markup for the old
         chapter; from here it is a real framebuffer, so the pixelation
         that used to be the point has to come off */
      canvas.style.imageRendering = "auto";

      Stage.camera = new THREE.PerspectiveCamera(46, 16 / 9, 0.4, 400);
      Stage.dpr = Math.min(window.devicePixelRatio || 1, 2);
      /* A phone is a small screen with a big pixel ratio and a thermal
         budget, so it starts one rung down and climbs nothing. The
         watchdog can still take it lower. */
      var coarse = window.matchMedia && window.matchMedia("(pointer: coarse)").matches;
      if (coarse || Math.min(screen.width, screen.height) < 820) Stage.quality = 1;
      Stage.resize(true);
      Stage.ready = true;
    },

    /* the composer is rebuilt whenever the scene it renders changes */
    attach: function (scene, camera) {
      var C = THREE.EffectComposer, RP = THREE.RenderPass,
          SP = THREE.ShaderPass, UB = THREE.UnrealBloomPass, OP = THREE.OutputPass;
      if (!C) { Stage.composer = null; return; }
      /* the chapter attaches a new scene eight times over; without this
         every one of them leaves its render targets on the card */
      if (Stage.composer) {
        try {
          Stage.composer.passes.forEach(function (ps) { if (ps.dispose) ps.dispose(); });
          Stage.composer.dispose();
        } catch (e) {}
      }
      /* The composer's own target is where every edge in the game gets
         resolved, so it is multisampled — the renderer's `antialias` flag
         does nothing once you are drawing through a composer — and it is
         half-float, which is what removes the banding that film grain used
         to be covering up. */
      var samples = Stage.quality === 0 ? Stage.maxSamples : Stage.quality === 1 ? 4 : 0;
      var target = new THREE.WebGLRenderTarget(Stage.w, Stage.h, {
        type: THREE.HalfFloatType,
        colorSpace: THREE.LinearSRGBColorSpace,
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter,
        depthBuffer: true,
        stencilBuffer: false,
        samples: samples
      });
      var comp = new C(Stage.renderer, target);
      comp.setSize(Stage.w, Stage.h);
      comp.addPass(new RP(scene, camera));

      if (UB && Stage.quality > 0) {
        var b = new UB(new THREE.Vector2(Stage.w, Stage.h), 0.34, 0.70, 0.88);
        comp.addPass(b);
        Stage.bloom = b;
      } else Stage.bloom = null;

      var grade = new SP({
        uniforms: {
          tDiffuse:  { value: null },
          gradeCol:  { value: new THREE.Color(0xb47337) },
          gradeAmt:  { value: 0.16 },
          hazeCol:   { value: new THREE.Color(0x1e263c) },
          hazeAmt:   { value: 0.28 },
          vig:       { value: 0.78 },
          time:      { value: 0 },
          fringe:    { value: 0.0016 },
          redPulse:  { value: 0.0 },
          flash:     { value: 0.0 },
          fade:      { value: 1.0 },
          sat:       { value: 1.04 },
          exposure:  { value: 1.0 }
        },
        vertexShader: GRADE_VERT,
        fragmentShader: GRADE_FRAG
      });
      comp.addPass(grade);
      Stage.gradePass = grade;
      if (OP) comp.addPass(new OP());
      /* and a last analytic pass over the tone-mapped image, which catches
         the stair-stepping MSAA cannot see: the edges post has created */
      if (THREE.SMAAPass && Stage.quality === 0) {
        comp.addPass(new THREE.SMAAPass(Stage.w, Stage.h));
      }
      Stage.composer = comp;
    },

    resize: function (force) {
      var canvas = Stage.renderer && Stage.renderer.domElement;
      if (!canvas) return;
      var host = canvas.parentElement || canvas;
      var cw = Math.max(160, host.clientWidth || 640);
      var ch = Math.max(90, host.clientHeight || 360);
      var scale = [1, 0.82, 0.62][Stage.quality] || 1;
      var w = Math.round(cw * Stage.dpr * scale);
      var h = Math.round(ch * Stage.dpr * scale);
      if (!force && w === Stage.w && h === Stage.h) return;
      Stage.w = w; Stage.h = h;
      Stage.renderer.setPixelRatio(1);
      Stage.renderer.setSize(w, h, false);
      canvas.style.width = "100%"; canvas.style.height = "100%";
      Stage.camera.aspect = cw / ch;
      Stage.camera.updateProjectionMatrix();
      if (Stage.composer) Stage.composer.setSize(w, h);
      if (Stage.bloom) Stage.bloom.setSize(w, h);
    },

    grade: function (o) {
      var u = Stage.gradePass && Stage.gradePass.uniforms;
      if (!u) return;
      for (var k in o) if (u[k]) {
        if (u[k].value && u[k].value.isColor) u[k].value.set(o[k]);
        else u[k].value = o[k];
      }
    },

    render: function (scene, camera) {
      if (Stage.composer) Stage.composer.render();
      else Stage.renderer.render(scene, camera);
    },

    /* one knob for how hard this is on the machine it is running on.
       0 is everything, 2 is a phone from a few years ago. */
    setQuality: function (q, scene, camera) {
      q = clamp(q | 0, 0, 2);
      if (q === Stage.quality) return;
      Stage.quality = q;
      Stage.resize(true);
      if (scene) Stage.attach(scene, camera || Stage.camera);
    },

    /* Leaving the chapter drops everything the last scene was holding but
       keeps the renderer: a canvas hands out one WebGL context for its
       lifetime, so building a second one on the way back in gets a dead
       one. Coming back reuses this. */
    release: function () {
      if (Stage.composer) {
        try {
          Stage.composer.passes.forEach(function (ps) { if (ps.dispose) ps.dispose(); });
          Stage.composer.dispose();
        } catch (e) {}
      }
      Stage.composer = null; Stage.bloom = null; Stage.gradePass = null;
      if (Stage.renderer) { try { Stage.renderer.renderLists.dispose(); } catch (e) {} }
    }
  };

  /* =========================================================
     11 — THE CAMERA RIG
     Third person, over her shoulder and up, tilted down far
     enough that you can read a corridor before you walk into
     it. It leads her slightly in the direction she is facing,
     pulls in when she creeps, kicks out when something is
     chasing her, and shakes when she is grabbed.
     ========================================================= */
  function CamRig(camera) {
    this.cam = camera;
    /* Six springs: three for where the camera is, two for where it is
       looking, one for the lens. Nothing here lerps by a fixed fraction
       per frame, so nothing steps when the frame rate does. */
    this.px = new Spring1(0, 0.38); this.py = new Spring1(0, 0.30); this.pz = new Spring1(0, 0.38);
    this.lx = new Spring1(0, 0.30); this.lz = new Spring1(0, 0.30);
    this.ly = new Spring1(1.0, 0.35);
    this.sDist = new Spring1(8.6, 0.55);
    this.sHeight = new Spring1(10.4, 0.55);
    this.sFov = new Spring1(46, 0.55);
    this.shake = 0;
    this.shakeX = new Spring1(0, 0.06); this.shakeY = new Spring1(0, 0.06);
    this.snapped = false;
    this.lead = new THREE.Vector2(0, 0);
  }

  CamRig.prototype.frame = function (tx, ty, facing, mode, dt) {
    /* the lead itself is eased, so turning on the spot swings the frame
       round rather than flicking it */
    var lead = mode === "chase" ? 2.4 : 1.9;
    this.lead.x = damp(this.lead.x, Math.cos(facing) * lead, 0.42, dt);
    this.lead.y = damp(this.lead.y, Math.sin(facing) * lead, 0.42, dt);
    var lx = tx + this.lead.x, lz = ty + this.lead.y;

    var wantD = mode === "creep" ? 8.2 : mode === "chase" ? 10.6 : 9.4;
    var wantH = mode === "creep" ? 9.8 : mode === "chase" ? 12.4 : 11.2;
    var wantF = mode === "creep" ? 43 : mode === "chase" ? 51 : 46;

    if (!this.snapped) {
      this.sDist.set(wantD); this.sHeight.set(wantH); this.sFov.set(wantF);
      this.px.set(lx); this.py.set(wantH); this.pz.set(lz + wantD);
      this.lx.set(lx); this.ly.set(1.0); this.lz.set(lz);
      this.lead.set(Math.cos(facing) * lead, Math.sin(facing) * lead);
      this.snapped = true;
    }

    var d = this.sDist.step(wantD, dt);
    var h = this.sHeight.step(wantH, dt);
    var f = this.sFov.step(wantF, dt);

    var cx = this.px.step(lx, dt);
    var cy = this.py.step(h, dt);
    var cz = this.pz.step(lz + d, dt);
    var ax = this.lx.step(lx, dt);
    var ay = this.ly.step(1.0, dt);
    var az = this.lz.step(lz, dt);

    /* the shake is sprung too, so a scare is a lurch and not a jitter */
    var target = this.shake;
    this.shake *= Math.exp(-dt / 0.13);
    if (this.shake < 0.0005) this.shake = 0;
    var sx = this.shakeX.step((Math.random() - 0.5) * target, dt);
    var sy = this.shakeY.step((Math.random() - 0.5) * target, dt);

    this.cam.position.set(cx + sx, cy + sy, cz);
    this.cam.lookAt(ax, ay, az);
    if (Math.abs(this.cam.fov - f) > 0.004) {
      this.cam.fov = f; this.cam.updateProjectionMatrix();
    }
  };
  CamRig.prototype.snap = function () { this.snapped = false; };
  CamRig.prototype.kick = function (a) { this.shake = Math.max(this.shake, a); };

  /* =========================================================
     12 — BODIES
     Every character is a rig built out of primitives at load
     time: a pelvis, a spine, two arms with elbows, two legs
     with knees, a head, and hair. Nothing is skinned — the
     joints are groups and the animation rotates them, which is
     all a walk cycle has ever needed.
     ========================================================= */
  var GEO = {};
  function geo(key, make) { return GEO[key] || (GEO[key] = make()); }

  /* the bundle does not expose BufferGeometryUtils, and all that is
     needed here is concatenating a few boxes that share a material */
  function mergeGeoms(list) {
    var pos = [], norm = [], uv = [], idx = [], off = 0;
    list.forEach(function (g) {
      var gp = g.attributes.position.array, gn = g.attributes.normal.array,
          gu = g.attributes.uv.array, gi = g.index ? g.index.array : null;
      for (var i = 0; i < gp.length; i++) pos.push(gp[i]);
      for (var j = 0; j < gn.length; j++) norm.push(gn[j]);
      for (var k = 0; k < gu.length; k++) uv.push(gu[k]);
      if (gi) for (var m = 0; m < gi.length; m++) idx.push(gi[m] + off);
      off += gp.length / 3;
      g.dispose();
    });
    var out = new THREE.BufferGeometry();
    out.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    out.setAttribute("normal", new THREE.Float32BufferAttribute(norm, 3));
    out.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    if (idx.length) out.setIndex(idx);
    return out;
  }

  /* ---- a tapered sweep along a curve ----
     Hair, cables, a fringe, a strap: anything that is a tube whose radius
     changes along its length. three has TubeGeometry, but its radius is
     constant, and a lock of hair that does not taper reads as a sausage. */
  function sweep(points, r0, r1, radial, twist) {
    var curve = new THREE.CatmullRomCurve3(points);
    var seg = Math.max(8, points.length * 5);
    var pos = [], nor = [], uv = [], idx = [];
    var up = new THREE.Vector3(0, 1, 0);
    var prevN = null;
    for (var i = 0; i <= seg; i++) {
      var t = i / seg;
      var p = curve.getPointAt(t);
      var tan = curve.getTangentAt(t).normalize();
      var n = prevN ? prevN.clone() : (Math.abs(tan.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : up.clone());
      n.sub(tan.clone().multiplyScalar(n.dot(tan))).normalize();
      prevN = n.clone();
      var b = new THREE.Vector3().crossVectors(tan, n).normalize();
      var r = r0 + (r1 - r0) * t;
      for (var j = 0; j <= radial; j++) {
        var a = j / radial * 6.2832 + (twist || 0) * t;
        var c = Math.cos(a), sn = Math.sin(a);
        var nx = n.x * c + b.x * sn, ny = n.y * c + b.y * sn, nz = n.z * c + b.z * sn;
        pos.push(p.x + nx * r, p.y + ny * r, p.z + nz * r);
        nor.push(nx, ny, nz);
        uv.push(j / radial, t);
      }
    }
    for (var i2 = 0; i2 < seg; i2++) {
      for (var j2 = 0; j2 < radial; j2++) {
        var a2 = i2 * (radial + 1) + j2, b2 = a2 + radial + 1;
        idx.push(a2, b2, a2 + 1, b2, b2 + 1, a2 + 1);
      }
    }
    var g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    return g;
  }

  /* a rounded box, for anything with a soft edge — a jacket, a boot, a
     bench. Sharp corners are the fastest way to look untextured. */
  function roundBox(w, h, d, r, seg) {
    var g = new THREE.BoxGeometry(w, h, d, seg || 3, seg || 3, seg || 3);
    var pos = g.attributes.position;
    var hw = w / 2 - r, hh = h / 2 - r, hd = d / 2 - r;
    var v = new THREE.Vector3(), c = new THREE.Vector3();
    for (var i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      c.set(clamp(v.x, -hw, hw), clamp(v.y, -hh, hh), clamp(v.z, -hd, hd));
      var d2 = v.clone().sub(c);
      if (d2.lengthSq() > 1e-9) d2.normalize().multiplyScalar(r);
      pos.setXYZ(i, c.x + d2.x, c.y + d2.y, c.z + d2.z);
    }
    g.computeVertexNormals();
    return g;
  }

  function tapered(len, rTop, rBot, seg) {
    /* a limb segment whose pivot is its top, so rotating the group
       swings it from the joint the way a real one does */
    var g = new THREE.CylinderGeometry(rTop, rBot, len, seg || 7, 1, false);
    g.translate(0, -len / 2, 0);
    return g;
  }

  function joint(len, rTop, rBot, mat, seg) {
    var grp = new THREE.Group();
    var m = new THREE.Mesh(tapered(len, rTop, rBot, seg), mat);
    m.castShadow = true;
    grp.add(m);
    grp.userData.len = len;
    return grp;
  }

  function skinMat(hex, rough) {
    return new THREE.MeshStandardMaterial({
      color: hex, roughness: rough == null ? 0.62 : rough, metalness: 0.0,
      map: tex("skin", 256, 1), bumpMap: bump("skin", 256, 1), bumpScale: 0.03,
      envMapIntensity: 0.5
    });
  }
  function clothMat(hex, rough, weave) {
    var name = weave || "cloth";
    return new THREE.MeshStandardMaterial({
      color: hex, roughness: rough == null ? 0.88 : rough, metalness: 0.0,
      map: tex(name, 256, 2), bumpMap: bump(name, 256, 2), bumpScale: 0.09,
      roughnessMap: roughTex("clothR", 256, 2),
      envMapIntensity: 0.35
    });
  }
  function leatherMat(hex) {
    return new THREE.MeshStandardMaterial({
      color: hex, roughness: 0.44, metalness: 0.05,
      map: tex("cloth", 256, 3), bumpMap: bump("cloth", 256, 3), bumpScale: 0.05,
      envMapIntensity: 1.0
    });
  }
  function rotMat(hex) {
    return new THREE.MeshStandardMaterial({
      color: hex, roughness: 0.78, metalness: 0.0,
      map: tex("rot", 256, 1), bumpMap: bump("rot", 256, 1), bumpScale: 0.10,
      envMapIntensity: 0.4
    });
  }
  function hairMat(hex, rough) {
    return new THREE.MeshStandardMaterial({
      color: hex, roughness: rough == null ? 0.42 : rough, metalness: 0.0,
      map: tex("hair", 256, 1), bumpMap: bump("hair", 256, 1), bumpScale: 0.06,
      envMapIntensity: 0.9
    });
  }

  /* =========================================================
     THE FIGURE
     One builder, driven by a spec, and everything in the game
     that walks on two legs comes out of it: her, him, the ones
     that used to be people, and the two at the gate. The joints
     are the same set every time, so one pose function drives
     all of them.
     ========================================================= */
  var BUILD = {
    slim:    { chest: 0.90, waist: 0.86, arm: 0.88, leg: 0.92, shoulder: 0.92 },
    average: { chest: 1.00, waist: 1.00, arm: 1.00, leg: 1.00, shoulder: 1.00 },
    broad:   { chest: 1.16, waist: 1.06, arm: 1.14, leg: 1.06, shoulder: 1.18 },
    heavy:   { chest: 1.22, waist: 1.30, arm: 1.16, leg: 1.10, shoulder: 1.10 }
  };

  function buildHuman(spec) {
    var S = spec.scale || 1;
    var B = BUILD[spec.build || "average"];
    var depth = spec.depth || 0.74;

    var skin  = spec.skinMat || skinMat(spec.skin);
    var top   = spec.topMat || clothMat(spec.top, 0.9, spec.weave);
    var legsM = spec.legMat || clothMat(spec.trousers, 0.92, spec.legWeave || "denim");
    var hairM = hairMat(spec.hair, spec.hairRough);
    var shoe  = spec.shoeMat || leatherMat(spec.shoe || 0x241d18);
    var trim  = spec.trimMat || leatherMat(spec.trim || 0x2a2320);

    var root = new THREE.Group();          /* on the floor, facing +x at 0 rad */
    var body = new THREE.Group();          /* everything that bobs */
    root.add(body);

    var hipY = 0.90 * S;
    var pelvis = new THREE.Group();
    pelvis.position.y = hipY;
    body.add(pelvis);

    /* ---------------- spine, chest, jacket ---------------- */
    var spine = new THREE.Group();
    pelvis.add(spine);
    var chestLen = 0.50 * S;

    var torso = new THREE.Mesh(
      (function () {
        /* a lathe, so the silhouette has a waist and a ribcage in it
           instead of being a cylinder with clothes painted on */
        var pts = [];
        var prof = [[0.19, 0.00], [0.205, 0.10], [0.196, 0.26], [0.178, 0.44],
                    [0.196, 0.62], [0.212, 0.80], [0.196, 0.94], [0.10, 1.00]];
        prof.forEach(function (q) {
          var w = q[0] * (q[1] < 0.45 ? B.waist : B.chest);
          pts.push(new THREE.Vector2(w * S, q[1] * chestLen));
        });
        var g = new THREE.LatheGeometry(pts, 16);
        g.scale(depth, 1, 1);          /* thin front-to-back, not side-to-side */
        return g;
      })(), top);
    torso.castShadow = true;
    spine.add(torso);

    /* the hips, so the join is not a step */
    var hips = new THREE.Mesh(
      (function () {
        var g = new THREE.SphereGeometry(0.175 * S * B.waist, 14, 10);
        g.scale(depth * 1.02, 0.82, 1.04); return g;
      })(), legsM);
    hips.castShadow = true;
    pelvis.add(hips);

    /* an outer shell — a jacket, a coat, a hi-vis — over the top of it */
    if (spec.jacket) {
      var jm = spec.jacketMat || clothMat(spec.jacket, 0.82, spec.jacketWeave);
      var shell = new THREE.Mesh(
        (function () {
          var pts = [];
          [[0.216, -0.06], [0.230, 0.10], [0.222, 0.30], [0.208, 0.48],
           [0.224, 0.66], [0.238, 0.84], [0.214, 0.96]].forEach(function (q) {
            pts.push(new THREE.Vector2(q[0] * S * B.chest, q[1] * chestLen));
          });
          var g = new THREE.LatheGeometry(pts, 16);
          g.scale(depth * 1.05, 1, 1);
          return g;
        })(), jm);
      shell.castShadow = true;
      spine.add(shell);
      /* the opening down the front, and a collar standing up at the neck */
      var gap = new THREE.Mesh(new THREE.BoxGeometry(0.06 * S, chestLen * 0.9, 0.09 * S), top);
      gap.position.set(0.205 * S * B.chest * depth, chestLen * 0.46, 0);
      spine.add(gap);
      var collar = new THREE.Mesh(
        (function () {
          var g = new THREE.CylinderGeometry(0.135 * S, 0.115 * S, 0.11 * S, 16, 1, true);
          g.scale(depth * 1.1, 1, 1); return g;
        })(), jm);
      collar.position.y = chestLen * 0.99;
      collar.castShadow = true;
      spine.add(collar);
    }

    if (spec.belt) {
      var belt = new THREE.Mesh(
        (function () {
          var g = new THREE.CylinderGeometry(0.198 * S * B.waist, 0.198 * S * B.waist, 0.055 * S, 18, 1, true);
          g.scale(depth * 1.02, 1, 1); return g;
        })(), trim);
      belt.position.y = chestLen * 0.04;
      spine.add(belt);
      var buckle = new THREE.Mesh(new THREE.BoxGeometry(0.055 * S, 0.05 * S, 0.02 * S),
        new THREE.MeshStandardMaterial({ color: 0xb8a068, roughness: 0.3, metalness: 0.9, envMapIntensity: 1.6 }));
      buckle.position.set(0.196 * S * depth * B.waist, chestLen * 0.04, 0);
      spine.add(buckle);
    }

    /* ---------------- neck and head ---------------- */
    var neck = new THREE.Group();
    neck.position.y = chestLen;
    spine.add(neck);
    var neckMesh = new THREE.Mesh(tapered(0.115 * S, 0.056 * S, 0.068 * S, 12), skin);
    neckMesh.position.y = 0.115 * S;
    neck.add(neckMesh);

    var head = new THREE.Group();
    head.position.y = 0.098 * S;
    neck.add(head);

    var skull = new THREE.Mesh(
      (function () {
        /* A smooth falloff rather than a threshold: the previous version
           tested a vertex's position and moved it, which tore a step into
           the mesh wherever the test flipped. */
        var g = new THREE.SphereGeometry(0.107 * S, 22, 16);
        g.scale(1.02, 1.06, 0.90);
        var pos = g.attributes.position;
        for (var i = 0; i < pos.count; i++) {
          var vx = pos.getX(i), vy = pos.getY(i), vz = pos.getZ(i);
          var up = clamp(vy / (0.11 * S), -1, 1);
          pos.setZ(i, vz * (1 - Math.max(0, up) * 0.10));
          pos.setX(i, vx * (vx < 0 ? 0.94 : 1.0) + (1 - clamp(up + 0.4, 0, 1)) * 0.010 * S);
        }
        g.computeVertexNormals();
        return g;
      })(), skin);
    skull.position.y = 0.104 * S;
    skull.castShadow = true;
    head.add(skull);

    /* jaw, brow, nose and ears: four small solids that turn a sphere into
       a face at the distance this camera keeps */
    var jaw = new THREE.Mesh(
      (function () { var g = new THREE.SphereGeometry(0.082 * S, 13, 10); g.scale(1.0, 0.74, 0.88); return g; })(), skin);
    jaw.position.set(0.022 * S, 0.052 * S, 0);
    head.add(jaw);
    var brow = new THREE.Mesh(
      (function () { var g = new THREE.SphereGeometry(0.052 * S, 12, 8); g.scale(0.50, 0.34, 1.45); return g; })(), skin);
    brow.position.set(0.062 * S, 0.140 * S, 0);
    head.add(brow);
    var nose = new THREE.Mesh(
      (function () {
        var g = new THREE.SphereGeometry(0.019 * S, 10, 8);
        g.scale(1.6, 1.0, 0.78); return g;
      })(), skin);
    nose.position.set(0.100 * S, 0.092 * S, 0);
    head.add(nose);
    [1, -1].forEach(function (sd) {
      var ear = new THREE.Mesh(
        (function () { var g = new THREE.SphereGeometry(0.030 * S, 8, 6); g.scale(0.4, 1.1, 0.8); return g; })(), skin);
      ear.position.set(-0.008 * S, 0.104 * S, sd * 0.092 * S);
      head.add(ear);
    });
    /* Eyes and brows. A sphere sitting on a sphere reads as a lens, so the
       eye is small, set into a socket, has a lid closing the top third of
       it and a brow above that — which is most of what makes a face read
       at any distance at all. */
    var eyeM = new THREE.MeshStandardMaterial({
      color: 0xefebe4, roughness: 0.22, metalness: 0, envMapIntensity: 1.0 });
    var irisM = new THREE.MeshStandardMaterial({
      color: spec.eyes || 0x2b1d14, roughness: 0.16, metalness: 0, envMapIntensity: 1.6 });
    var browM = new THREE.MeshStandardMaterial({
      color: spec.browColour || spec.hair, roughness: 0.62, metalness: 0 });
    [1, -1].forEach(function (sd) {
      var socket = new THREE.Group();
      socket.position.set(0.083 * S, 0.114 * S, sd * 0.040 * S);
      head.add(socket);
      var ball = new THREE.Mesh(new THREE.SphereGeometry(0.0152 * S, 10, 8), eyeM);
      socket.add(ball);
      var iris = new THREE.Mesh(new THREE.SphereGeometry(0.0080 * S, 8, 6), irisM);
      iris.position.set(0.0104 * S, 0, 0);
      socket.add(iris);
      var lid = new THREE.Mesh(
        (function () { var g = new THREE.SphereGeometry(0.0176 * S, 10, 8, 0, 6.2832, 0, 0.92); return g; })(), skin);
      lid.rotation.z = -0.52;
      socket.add(lid);
      var brow2 = new THREE.Mesh(
        (function () { var gb = new THREE.SphereGeometry(0.0155 * S, 10, 6); gb.scale(0.34, 0.20, 1.30); return gb; })(),
        browM);
      brow2.position.set(0.008 * S, 0.0255 * S, 0);
      brow2.rotation.x = sd * 0.22;
      socket.add(brow2);
      if (sd === 1) {
        var mouth = new THREE.Mesh(
          new THREE.BoxGeometry(0.008 * S, 0.0055 * S, 0.032 * S),
          new THREE.MeshStandardMaterial({ color: 0x8f5c53, roughness: 0.55 }));
        mouth.position.set(0.089 * S, 0.056 * S, 0);
        head.add(mouth);
      }
    });

    /* ---------------- hair ---------------- */
    var hairGroup = new THREE.Group();
    head.add(hairGroup);
    buildHair(hairGroup, spec.hairStyle, hairM, S, spec);

    if (spec.helmet) {
      var hel = new THREE.Mesh(
        (function () { var g = new THREE.SphereGeometry(0.132 * S, 16, 12, 0, 6.2832, 0, 1.34); g.scale(1, 0.94, 1); return g; })(),
        new THREE.MeshStandardMaterial({ color: spec.helmet, roughness: 0.34, metalness: 0.15, envMapIntensity: 1.4 }));
      hel.position.y = 0.112 * S; hel.castShadow = true;
      head.add(hel);
      var peak = new THREE.Mesh(
        (function () { var g = new THREE.CylinderGeometry(0.135 * S, 0.135 * S, 0.02 * S, 16, 1, false, 0, 2.2); g.rotateY(-1.1); return g; })(),
        new THREE.MeshStandardMaterial({ color: spec.helmet, roughness: 0.34, metalness: 0.15 }));
      peak.position.set(0.02 * S, 0.086 * S, 0);
      head.add(peak);
    }
    if (spec.mask) {
      var mask = new THREE.Mesh(
        (function () { var g = new THREE.SphereGeometry(0.086 * S, 12, 9, 0, 3.2, 0.6, 1.5); g.rotateY(-1.6); return g; })(),
        new THREE.MeshStandardMaterial({ color: spec.mask, roughness: 0.85, metalness: 0 }));
      mask.position.set(0.028 * S, 0.072 * S, 0);
      head.add(mask);
    }

    /* ---------------- arms ---------------- */
    function arm(side) {
      var sleeveM = spec.sleeves === false ? skin
                  : spec.jacket ? (spec.jacketMat || clothMat(spec.jacket, 0.82, spec.jacketWeave))
                  : top;
      var lowerM = spec.sleeves === "short" ? skin : sleeveM;

      var sh = new THREE.Group();
      sh.position.set(0, chestLen - 0.056 * S, side * 0.201 * S * B.shoulder);
      spine.add(sh);
      /* the deltoid, sunk into the chest so the two read as one shape */
      var delt = new THREE.Mesh(
        (function () { var g = new THREE.SphereGeometry(0.058 * S * B.arm, 12, 9); g.scale(0.88, 1.05, 1.0); return g; })(),
        sleeveM);
      delt.position.set(0, -0.012 * S, -side * 0.010 * S);
      delt.castShadow = true;
      sh.add(delt);

      var upper = joint(0.30 * S, 0.058 * S * B.arm, 0.048 * S * B.arm, sleeveM, 10);
      sh.add(upper);
      var elbow = new THREE.Group();
      elbow.position.y = -0.30 * S;
      upper.add(elbow);
      if (spec.sleeves === "short") {
        var cuff = new THREE.Mesh(
          new THREE.CylinderGeometry(0.052 * S * B.arm, 0.050 * S * B.arm, 0.03 * S, 10), sleeveM);
        cuff.position.y = -0.005 * S;
        elbow.add(cuff);
      }
      var lower = joint(0.28 * S, 0.046 * S * B.arm, 0.037 * S * B.arm, lowerM, 9);
      elbow.add(lower);
      var hand = new THREE.Mesh(
        (function () { var g = new THREE.SphereGeometry(0.049 * S, 9, 7); g.scale(1, 1.28, 0.66); return g; })(), skin);
      hand.position.y = -0.302 * S;
      hand.castShadow = true;
      elbow.add(hand);
      return { shoulder: sh, upper: upper, elbow: elbow, lower: lower, hand: hand };
    }
    var armL = arm(1), armR = arm(-1);

    /* ---------------- legs ---------------- */
    function leg(side) {
      var hip = new THREE.Group();
      hip.position.set(0, -0.036 * S, side * 0.102 * S);
      pelvis.add(hip);
      var upper = joint(0.44 * S, 0.088 * S * B.leg, 0.066 * S * B.leg, legsM, 10);
      hip.add(upper);
      var knee = new THREE.Group();
      knee.position.y = -0.44 * S;
      upper.add(knee);
      var lower = joint(0.42 * S, 0.062 * S * B.leg, 0.046 * S * B.leg, legsM, 9);
      knee.add(lower);
      /* the boot: a sole, an upper, and a heel */
      var boot = new THREE.Group();
      boot.position.y = -0.42 * S;
      knee.add(boot);
      var bootUp = new THREE.Mesh(roundBox(0.115 * S, 0.11 * S, 0.098 * S, 0.03 * S, 2), shoe);
      bootUp.position.set(0.006 * S, -0.032 * S, 0);
      bootUp.castShadow = true;
      boot.add(bootUp);
      var sole = new THREE.Mesh(roundBox(0.205 * S, 0.036 * S, 0.098 * S, 0.014 * S, 2), shoe);
      sole.position.set(0.030 * S, -0.078 * S, 0);
      sole.castShadow = true;
      boot.add(sole);
      if (spec.boots) {
        var shaft = new THREE.Mesh(
          new THREE.CylinderGeometry(0.062 * S, 0.058 * S, 0.13 * S, 10), shoe);
        shaft.position.y = 0.04 * S;
        boot.add(shaft);
      }
      return { hip: hip, upper: upper, knee: knee, lower: lower, foot: boot };
    }
    var legL = leg(1), legR = leg(-1);

    root.traverse(function (o) { if (o.isMesh) { o.castShadow = true; o.receiveShadow = false; } });
    var contact = contactShadow(1.15 * S);
    root.add(contact);

    return {
      root: root, contact: contact,
      body: body, pelvis: pelvis, spine: spine, neck: neck, head: head,
      hair: hairGroup,
      armL: armL, armR: armR, legL: legL, legR: legR,
      hipY: hipY, S: S, spec: spec, phase: Math.random() * 6.28,
      blink: 0
    };
  }

  /* ---- hair, per style ---- */
  function buildHair(g, style, mat, S, spec) {
    if (style === "bald") return;

    if (style === "longWavy") {
      /* A cap over the crown, a fringe swept to one side, and a mane of
         locks down the back and over both shoulders — each waved on its
         own phase so no two fall the same way. The cap is a clean sphere
         segment tilted back off the forehead rather than a sphere with
         its vertices shoved about, which is what was tearing a notch in
         the top of her head. */
      var cap = new THREE.Mesh(
        (function () {
          /* A sphere segment covers all the way round at a given angle, so
             a cap low enough to reach the nape also comes down over the
             face. The front of it is lifted back to a hairline by a smooth
             function of how far forward each vertex is — smooth, because
             a threshold tears a step across the forehead. */
          var gg = new THREE.SphereGeometry(0.118 * S, 24, 18, 0, 6.2832, 0, 2.05);
          gg.scale(1.02, 1.08, 1.03);
          var pos = gg.attributes.position, r = 0.118 * S;
          for (var i = 0; i < pos.count; i++) {
            var vx = pos.getX(i), vy = pos.getY(i), vz = pos.getZ(i);
            var front = clamp(vx / r, 0, 1);
            var lift = front * front * 0.100 * S;
            pos.setY(i, vy + lift);
            /* and pull it in slightly at the temples so it sits on a head */
            pos.setZ(i, vz * (1 - front * 0.10));
          }
          gg.computeVertexNormals();
          return gg;
        })(), mat);
      cap.position.set(-0.008 * S, 0.098 * S, 0);
      cap.castShadow = true;
      g.add(cap);

      /* the volume at the back of the head that long hair actually has */
      var mass = new THREE.Mesh(
        (function () { var gg = new THREE.SphereGeometry(0.112 * S, 18, 14); gg.scale(0.94, 1.02, 1.0); return gg; })(), mat);
      mass.position.set(-0.046 * S, 0.070 * S, 0);
      mass.castShadow = true;
      g.add(mass);

      /* The fringe sweeps sideways across the forehead from a parting and
         tucks behind the ear. It stops above the brow — hair over the eyes
         reads as a mask, not as a hairstyle. */
      for (var f = 0; f < 3; f++) {
        var fu0 = f / 3;
        var fp = [];
        for (var fk = 0; fk <= 5; fk++) {
          var fu = fk / 5;
          fp.push(new THREE.Vector3(
            (0.048 + fu0 * 0.012) * S - fu * fu * 0.052 * S,
            (0.196 - fu * 0.052 - fu0 * 0.010) * S,
            (-0.020 + fu * 0.120) * S));
        }
        var fr = new THREE.Mesh(sweep(fp, 0.022 * S, 0.012 * S, 8, 0.2), mat);
        fr.castShadow = true;
        g.add(fr);
      }

      var locks = 14;
      for (var i2 = 0; i2 < locks; i2++) {
        var t = i2 / (locks - 1);
        var ang = -1.35 + t * 2.70;                   /* round the back of the head */
        var side = Math.sin(ang);
        var back = -Math.cos(ang);
        var len = 0.46 + hash2(i2, 3) * 0.22;
        var ph = hash2(i2 * 7, 5) * 6.28;
        var wave = 0.026 + hash2(i2, 11) * 0.024;
        var pts = [];
        var n = 7;
        for (var k = 0; k <= n; k++) {
          var u = k / n;
          var ease = u * u * (3 - 2 * u);
          /* it leaves the scalp under the cap, hugs the head, then hangs */
          var r = (0.086 + ease * 0.030) * S;
          pts.push(new THREE.Vector3(
            back * r * 0.86 - ease * 0.030 * S + Math.sin(u * 4.2 + ph) * wave * S * 0.55,
            0.118 * S - u * len * S,
            side * r + Math.sin(u * 3.4 + ph) * wave * S));
        }
        var strand = new THREE.Mesh(
          sweep(pts, 0.030 * S, 0.010 * S, 8, 0.5), mat);
        strand.castShadow = true;
        g.add(strand);
      }
      return;
    }

    if (style === "bun") {
      var cap2 = new THREE.Mesh(
        (function () { var gg = new THREE.SphereGeometry(0.121 * S, 14, 11, 0, 6.2832, 0, 1.5); return gg; })(), mat);
      cap2.position.y = 0.112 * S; cap2.castShadow = true; g.add(cap2);
      var bun = new THREE.Mesh(new THREE.SphereGeometry(0.056 * S, 12, 9), mat);
      bun.position.set(-0.098 * S, 0.148 * S, 0); bun.castShadow = true; g.add(bun);
      return;
    }

    if (style === "long") {
      var cap3 = new THREE.Mesh(
        (function () { var gg = new THREE.SphereGeometry(0.124 * S, 14, 11, 0, 6.2832, 0, 1.5); return gg; })(), mat);
      cap3.position.y = 0.110 * S; cap3.castShadow = true; g.add(cap3);
      for (var i3 = 0; i3 < 7; i3++) {
        var t3 = i3 / 6, side3 = Math.cos(t3 * Math.PI);
        var pts3 = [];
        for (var k3 = 0; k3 <= 4; k3++) {
          var u3 = k3 / 4;
          pts3.push(new THREE.Vector3(
            -0.05 * S - u3 * u3 * 0.05 * S,
            0.112 * S - u3 * 0.36 * S,
            (0.09 + u3 * 0.02) * S * side3));
        }
        var st3 = new THREE.Mesh(sweep(pts3, 0.036 * S, 0.020 * S, 5, 0), mat);
        st3.castShadow = true; g.add(st3);
      }
      return;
    }

    /* short: a crop that follows the skull, with a hairline */
    var crop = new THREE.Mesh(
      (function () {
        var gg = new THREE.SphereGeometry(0.120 * S, 16, 12, 0, 6.2832, 0, 1.30);
        gg.scale(0.96, 1.0, 0.99);
        var pos = gg.attributes.position;
        for (var i = 0; i < pos.count; i++) {
          var vx = pos.getX(i), vy = pos.getY(i);
          if (vx > 0.06 * S && vy < 0.02 * S) pos.setY(i, vy + 0.03 * S);
        }
        gg.computeVertexNormals();
        return gg;
      })(), mat);
    crop.position.y = 0.113 * S;
    crop.castShadow = true;
    g.add(crop);
    if (spec && spec.beard) {
      var beard = new THREE.Mesh(
        (function () { var gg = new THREE.SphereGeometry(0.086 * S, 12, 9); gg.scale(0.92, 0.66, 0.98); return gg; })(), mat);
      beard.position.set(0.030 * S, 0.044 * S, 0);
      g.add(beard);
    }
  }

  /* the walk cycle. `gait` is 0 for standing, 1 for walking, and
     `style` swaps in the wrongness for the ones that are not people
     any more. */
  function poseHuman(rig, t, gait, style, extra) {
    var S = rig.S, p = rig.phase;
    var w = t * (style === "z" ? 4.4 : 8.2) + p;
    var g = clamp(gait, 0, 1);
    var swing = (style === "z" ? 0.42 : 0.62) * g;
    var e = extra || {};

    /* the jerk: they do not move continuously, they arrive at poses */
    var jt = style === "z" ? Math.floor(w * 3.0) / 3.0 + Math.sin(w * 11.0) * 0.03 : w;
    var s1 = Math.sin(jt), c1 = Math.cos(jt), s2 = Math.sin(jt * 2);

    rig.legL.upper.rotation.z =  s1 * swing;
    rig.legR.upper.rotation.z = -s1 * swing;
    rig.legL.knee.rotation.z  = Math.max(0, -c1) * 0.9 * g + 0.05;
    rig.legR.knee.rotation.z  = Math.max(0,  c1) * 0.9 * g + 0.05;

    if (style === "z") {
      /* one side drags: the near leg barely leaves the floor */
      rig.legR.upper.rotation.z *= 0.35;
      rig.legR.knee.rotation.z = 0.32;
      rig.legR.upper.rotation.x = 0.16;
      /* arms up and out in front, hands loose */
      rig.armL.upper.rotation.z = -1.05 + s1 * 0.18;
      rig.armR.upper.rotation.z = -0.86 - s1 * 0.14;
      rig.armL.upper.rotation.x = -0.30;
      rig.armR.upper.rotation.x =  0.36;
      rig.armL.elbow.rotation.z = -0.75;
      rig.armR.elbow.rotation.z = -0.95;
      /* hunched, head hanging to one side */
      rig.spine.rotation.z = 0.34 + s2 * 0.04;
      rig.spine.rotation.x = 0.10;
      rig.neck.rotation.z = -0.42;
      rig.neck.rotation.x = 0.26 + Math.sin(w * 0.7) * 0.08;
      rig.body.position.y = Math.abs(s1) * 0.030 * S * g - 0.045 * S;
    } else {
      var crouch = e.crouch || 0;
      rig.armL.upper.rotation.z = -s1 * swing * 0.72 - crouch * 0.30;
      rig.armR.upper.rotation.z =  s1 * swing * 0.72 - crouch * 0.30;
      rig.armL.upper.rotation.x = 0.06 + crouch * 0.22;
      rig.armR.upper.rotation.x = -0.06 - crouch * 0.22;
      rig.armL.elbow.rotation.z = -0.22 - Math.max(0, s1) * 0.32 * g - crouch * 0.85;
      rig.armR.elbow.rotation.z = -0.22 - Math.max(0, -s1) * 0.32 * g - crouch * 0.85;
      rig.spine.rotation.z = 0.05 * g + crouch * 0.32 + (e.lean || 0);
      rig.spine.rotation.x = -s2 * 0.03 * g;
      rig.neck.rotation.z = -0.04 - crouch * 0.16 + (e.headZ || 0);
      rig.neck.rotation.x = e.headX || 0;
      /* the bob, and the breath when she is standing still */
      rig.body.position.y = Math.abs(s1) * 0.035 * S * g
                          + (1 - g) * Math.sin(t * 1.5 + p) * 0.008 * S
                          - crouch * 0.20 * S;
    }
  }

  /* Sitting on a horse is not standing on one. The thigh comes forward
     and out around the barrel, the knee drops, and the hands go to the
     mane; without this they ride like two ironing boards. */
  function poseRide(rig, t, bounce, front) {
    var s1 = Math.sin(t * 6.4 + (front ? 0 : 0.5));
    [[rig.legL, 1], [rig.legR, -1]].forEach(function (pair) {
      var L = pair[0], side = pair[1];
      L.hip.rotation.x = side * 0.46;
      L.upper.rotation.z = 1.16 + s1 * 0.03;
      L.upper.rotation.x = 0;
      L.knee.rotation.z = -0.62;
    });
    rig.spine.rotation.z = (front ? 0.14 : 0.26) + s1 * 0.035;
    rig.spine.rotation.x = 0;
    rig.neck.rotation.z = -0.06;
    rig.neck.rotation.x = 0;
    if (front) {
      /* both hands down on the neck */
      rig.armL.upper.rotation.z = -0.62; rig.armR.upper.rotation.z = -0.62;
      rig.armL.upper.rotation.x = 0.18;  rig.armR.upper.rotation.x = -0.18;
      rig.armL.elbow.rotation.z = -0.34; rig.armR.elbow.rotation.z = -0.34;
    } else {
      /* he is holding on to her */
      rig.armL.upper.rotation.z = -1.02; rig.armR.upper.rotation.z = -1.02;
      rig.armL.upper.rotation.x = 0.34;  rig.armR.upper.rotation.x = -0.34;
      rig.armL.elbow.rotation.z = -0.86; rig.armR.elbow.rotation.z = -0.86;
    }
    rig.body.position.y = bounce;
  }

  /* ---- the people in the game ---- */

  function makeOuissy() {
    var r = buildHuman({
      scale: 1.0, build: "slim", depth: 0.70,
      skin: 0xf0d3bc,                       /* fair */
      skinMat: skinMat(0xf2d6c0, 0.58),
      eyes: 0x35526a,
      hair: 0xe0c894, hairStyle: "longWavy", hairRough: 0.36,
      top: 0x8e2f4c,                        /* a dark red top under it */
      jacket: 0x2f3a4e,                     /* a canvas jacket, collar up */
      jacketWeave: "cloth",
      trousers: 0x39506b, legWeave: "denim",
      shoe: 0x2a211c, boots: true, belt: true, trim: 0x33261f,
      sleeves: true
    });
    r.name = "ouissy";
    /* a strap across her, because she left the house with something */
    var strap = new THREE.Mesh(roundBox(0.10, 0.42, 0.036, 0.014, 2), leatherMat(0x4a3a2a));
    strap.position.set(0.128, 0.30, 0.058);
    strap.rotation.set(0, 0, -0.34);
    strap.castShadow = true;
    r.spine.add(strap);
    return r;
  }

  function makeAnwar() {
    var r = buildHuman({
      scale: 1.06, build: "broad", depth: 0.84,
      skin: 0xc08a60, eyes: 0x2a1c14,
      hair: 0x231a15, hairStyle: "short", beard: true,
      top: 0xd9dde5,                        /* what they gave him on the ward */
      trousers: 0x39404e, legWeave: "cloth",
      shoe: 0x1e1a17,
      sleeves: "short"
    });
    r.name = "anwar";
    return r;
  }

  /* ---------------------------------------------------------------
     THEM
     Nine bodies, six wardrobes, four builds and a set of things that
     can have gone wrong, combined off the seed — so a corridor with
     eight in it has eight different people in it, and none of them
     is the one you just walked past.
     --------------------------------------------------------------- */
  var Z_SKIN = [0xa8b09c, 0x9aa890, 0xb2b4a2, 0x8e9c88, 0xa6a292, 0x94a496, 0xb0a898, 0x9c9a8c, 0xa4b2a4];
  var Z_HAIR = [0x2a2420, 0x3a3028, 0x1c1814, 0x584a3a, 0x6a5a4a, 0x241c18];
  var Z_KIT = [
    { top: 0x7fa8b4, trousers: 0x7fa8b4, name: "scrubs", weave: "cloth", legWeave: "cloth" },
    { top: 0xb8a642, trousers: 0x2f3540, name: "hivis", weave: "cloth", legWeave: "denim", vest: 0xc8b83a },
    { top: 0xd8d4cc, trousers: 0x2a2e38, name: "shirt", weave: "cloth", legWeave: "cloth", jacket: 0x30343e },
    { top: 0x5a4a52, trousers: 0x3a4250, name: "hoodie", weave: "cloth", legWeave: "denim", hood: true },
    { top: 0x6a6250, trousers: 0x4a4438, name: "work", weave: "cloth", legWeave: "denim" },
    { top: 0x9a4a4a, trousers: 0x33384a, name: "tee", weave: "cloth", legWeave: "denim", sleeves: "short" }
  ];
  var Z_BUILD = ["slim", "average", "broad", "heavy"];

  function makeZombie(seed) {
    var h = function (a, b) { return hash2(seed * 37 + a, seed * 91 + b); };
    var kit = Z_KIT[Math.floor(h(1, 2) * Z_KIT.length) % Z_KIT.length];
    var build = Z_BUILD[Math.floor(h(3, 4) * Z_BUILD.length) % Z_BUILD.length];
    var skinHex = Z_SKIN[Math.floor(h(5, 6) * Z_SKIN.length) % Z_SKIN.length];

    var spec = {
      scale: 0.92 + h(7, 8) * 0.20,
      build: build,
      depth: 0.74 + h(9, 1) * 0.12,
      skin: skinHex,
      skinMat: rotMat(skinHex),
      eyes: 0xc8c4b0,                       /* gone milky */
      hair: Z_HAIR[Math.floor(h(2, 9) * Z_HAIR.length) % Z_HAIR.length],
      hairStyle: h(4, 5) < 0.18 ? "bald" : h(4, 5) < 0.42 ? "long" : h(4, 5) < 0.6 ? "bun" : "short",
      beard: h(6, 7) > 0.66,
      top: kit.top, weave: kit.weave,
      trousers: kit.trousers, legWeave: kit.legWeave,
      jacket: kit.jacket, jacketWeave: "cloth",
      shoe: 0x191614,
      sleeves: kit.sleeves || (h(8, 3) > 0.5 ? "short" : true)
    };

    var r = buildHuman(spec);

    /* the clothes have been through it: everything they are wearing gets
       the same rot pass, but only the fabric — not the eyes, not the
       shadow under them */
    var keep = [r.contact];
    r.root.traverse(function (o) {
      if (!o.isMesh || keep.indexOf(o) >= 0) return;
      if (!o.material || !o.material.color) return;
      if (o.material.map === tex("rot", 256, 1)) return;
      o.material = o.material.clone();
      o.material.map = tex("rot", 256, 1);
      o.material.bumpMap = bump("rot", 256, 1);
      o.material.bumpScale = 0.12;
      o.material.roughness = 0.93;
      o.material.envMapIntensity = 0.25;
      o.material.color.multiplyScalar(0.80);
    });

    if (kit.vest) {
      var vest = new THREE.Mesh(
        (function () {
          var g = new THREE.CylinderGeometry(0.238 * spec.scale, 0.226 * spec.scale, 0.34 * spec.scale, 16, 1, true);
          g.scale(spec.depth * 1.04, 1, 1);
          return g;
        })(),
        new THREE.MeshStandardMaterial({ color: kit.vest, roughness: 0.72, metalness: 0.02,
          map: tex("rot", 256, 1), bumpMap: bump("rot", 256, 1), bumpScale: 0.08, envMapIntensity: 0.6 }));
      vest.position.y = 0.30 * spec.scale;
      vest.castShadow = true;
      r.spine.add(vest);
      [0.20, 0.30].forEach(function (yy) {
        var band = new THREE.Mesh(
          (function () {
            var g = new THREE.CylinderGeometry(0.243 * spec.scale, 0.243 * spec.scale, 0.035 * spec.scale, 16, 1, true);
            g.scale(spec.depth * 1.04, 1, 1); return g;
          })(),
          new THREE.MeshStandardMaterial({ color: 0xd8dce4, roughness: 0.28, metalness: 0.1, envMapIntensity: 1.8 }));
        band.position.y = yy * spec.scale;
        r.spine.add(band);
      });
    }

    if (kit.hood) {
      var hood = new THREE.Mesh(
        (function () { var g = new THREE.SphereGeometry(0.15 * spec.scale, 12, 9, 0, 6.2832, 0, 1.8); g.scale(1, 0.9, 1.02); return g; })(),
        new THREE.MeshStandardMaterial({ color: kit.top, roughness: 0.95,
          map: tex("rot", 256, 1), bumpMap: bump("rot", 256, 1), bumpScale: 0.12, envMapIntensity: 0.25 }));
      hood.position.set(-0.045 * spec.scale, 0.02 * spec.scale, 0);
      hood.castShadow = true;
      r.neck.add(hood);
    }

    /* what has happened to them. Nothing gratuitous — a torn sleeve, an
       arm that hangs, a shoulder that does not sit level. */
    var dmg = h(11, 13);
    r.damage = {};
    if (dmg > 0.80) {
      /* one forearm gone: the sleeve ends at the elbow and so does the arm */
      r.armR.lower.visible = false;
      if (r.armR.hand) r.armR.hand.visible = false;
      var stump = new THREE.Mesh(
        new THREE.SphereGeometry(0.045 * spec.scale, 8, 6), rotMat(0x8a6a62));
      stump.position.y = -0.02 * spec.scale;
      r.armR.elbow.add(stump);
      r.damage.arm = true;
    } else if (dmg > 0.62) {
      r.damage.limp = true;                 /* one leg drags harder */
    } else if (dmg > 0.44) {
      r.damage.tilt = (h(3, 17) - 0.5) * 0.5;   /* a shoulder out of line */
      r.spine.rotation.x = r.damage.tilt;
    }
    if (h(19, 2) > 0.5) {
      /* something dark down the front, which is as far as this goes */
      var stain = new THREE.Mesh(
        (function () { var g = new THREE.SphereGeometry(0.15 * spec.scale, 10, 8, 0, 2.0, 0.7, 1.2); g.rotateY(-1.0); return g; })(),
        new THREE.MeshStandardMaterial({ color: 0x4a1e1c, roughness: 0.7, transparent: true, opacity: 0.7,
          map: tex("rot", 256, 1) }));
      stain.position.set(0.02 * spec.scale, 0.26 * spec.scale, 0);
      stain.scale.set(spec.depth, 1, 1);
      r.spine.add(stain);
    }

    r.name = "zombie";
    return r;
  }

  /* ---------------------------------------------------------------
     THE ONES WHO ARE STILL PEOPLE
     Ashcombe has staff on the gate and people waiting inside it, and
     they should not look like the same man four times.
     --------------------------------------------------------------- */
  var CIVIL_SKIN = [0xe8c8a8, 0xc79a6c, 0x8d6242, 0xf0d6bd, 0xa87a52, 0x6b4a33];
  var CIVIL_HAIR = [0x2a2018, 0x6a4a26, 0x3a2a1e, 0x8a7a5a, 0x141210, 0xa89060];

  function makeGuard(seed) {
    var h = function (a, b) { return hash2(seed * 53 + a, seed * 29 + b); };
    var r = buildHuman({
      scale: 1.02 + h(1, 1) * 0.10,
      build: h(2, 2) > 0.5 ? "broad" : "average",
      depth: 0.82,
      skin: CIVIL_SKIN[Math.floor(h(3, 3) * CIVIL_SKIN.length) % CIVIL_SKIN.length],
      eyes: 0x2e2218,
      hair: CIVIL_HAIR[Math.floor(h(4, 4) * CIVIL_HAIR.length) % CIVIL_HAIR.length],
      hairStyle: h(5, 5) > 0.6 ? "bun" : "short",
      beard: h(6, 6) > 0.5,
      top: 0x2b3038, trousers: 0x262b33, legWeave: "cloth",
      jacket: 0x333a44, jacketWeave: "cloth",
      shoe: 0x171513, boots: true, belt: true,
      helmet: h(7, 7) > 0.35 ? 0x3c4652 : null,
      mask: h(8, 8) > 0.55 ? 0x3a4048 : null,
      sleeves: true
    });
    /* the hi-vis over the top, which is the whole uniform really */
    var S = r.S;
    var vest = new THREE.Mesh(
      (function () {
        var g = new THREE.CylinderGeometry(0.245 * S, 0.232 * S, 0.36 * S, 16, 1, true);
        g.scale(0.86, 1, 1); return g;
      })(),
      new THREE.MeshStandardMaterial({ color: 0xe8e21c, roughness: 0.58, metalness: 0.02,
        emissive: new THREE.Color(0x3a3a06), emissiveIntensity: 1.0,
        map: tex("cloth", 256, 2), bumpMap: bump("cloth", 256, 2), bumpScale: 0.07, envMapIntensity: 0.8 }));
    vest.position.y = 0.30 * S; vest.castShadow = true;
    r.spine.add(vest);
    [0.20, 0.31].forEach(function (yy) {
      var band = new THREE.Mesh(
        (function () {
          var g = new THREE.CylinderGeometry(0.251 * S, 0.251 * S, 0.038 * S, 16, 1, true);
          g.scale(0.86, 1, 1); return g;
        })(),
        new THREE.MeshStandardMaterial({ color: 0xe8ecf4, roughness: 0.2, metalness: 0.2, envMapIntensity: 2.4 }));
      band.position.y = yy * S;
      r.spine.add(band);
    });
    /* a rifle on a sling, held across, muzzle down */
    if (h(9, 9) > 0.25) {
      var gun = new THREE.Group();
      var gm = new THREE.MeshStandardMaterial({ color: 0x2a2c30, roughness: 0.42, metalness: 0.55, envMapIntensity: 1.2 });
      var barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.014 * S, 0.016 * S, 0.34 * S, 8), gm);
      barrel.rotation.z = Math.PI / 2; barrel.position.set(0.10 * S, 0, 0);
      gun.add(barrel);
      var recv = new THREE.Mesh(roundBox(0.20 * S, 0.062 * S, 0.036 * S, 0.012 * S, 2), gm);
      gun.add(recv);
      var mag = new THREE.Mesh(roundBox(0.05 * S, 0.10 * S, 0.03 * S, 0.01 * S, 2), gm);
      mag.position.set(-0.01 * S, -0.07 * S, 0); mag.rotation.z = 0.16;
      gun.add(mag);
      var stock = new THREE.Mesh(roundBox(0.13 * S, 0.055 * S, 0.032 * S, 0.012 * S, 2), gm);
      stock.position.set(-0.155 * S, -0.012 * S, 0);
      gun.add(stock);
      gun.position.set(0.16 * S, 0.30 * S, -0.10 * S);
      gun.rotation.set(0, 0.4, -0.5);
      gun.traverse(function (o) { if (o.isMesh) o.castShadow = true; });
      r.spine.add(gun);
      var sling = new THREE.Mesh(new THREE.BoxGeometry(0.022 * S, 0.46 * S, 0.06 * S), leatherMat(0x2e2a26));
      sling.position.set(0.11 * S, 0.30 * S, -0.02 * S);
      sling.rotation.z = 0.42;
      r.spine.add(sling);
    }
    r.name = "guard";
    return r;
  }

  function makeCivilian(seed) {
    var h = function (a, b) { return hash2(seed * 71 + a, seed * 13 + b); };
    var coats = [0x4a5560, 0x6a4a3a, 0x3a4a3e, 0x5a4a5e, 0x7a6a52, 0x2f4450];
    var tops  = [0xc8ccd4, 0x9a5a62, 0x5a7a6a, 0xd8c8a8, 0x6a6a7a];
    var legs  = [0x39506b, 0x2f3540, 0x4a4438, 0x565a64];
    var styles = ["short", "long", "bun", "longWavy", "bald"];
    var r = buildHuman({
      scale: 0.94 + h(1, 1) * 0.16,
      build: Z_BUILD[Math.floor(h(2, 2) * 4) % 4],
      depth: 0.74 + h(3, 3) * 0.12,
      skin: CIVIL_SKIN[Math.floor(h(4, 4) * CIVIL_SKIN.length) % CIVIL_SKIN.length],
      eyes: h(5, 5) > 0.7 ? 0x3a5a4a : 0x2e2218,
      hair: CIVIL_HAIR[Math.floor(h(6, 6) * CIVIL_HAIR.length) % CIVIL_HAIR.length],
      hairStyle: styles[Math.floor(h(7, 7) * styles.length) % styles.length],
      beard: h(8, 8) > 0.66,
      top: tops[Math.floor(h(9, 9) * tops.length) % tops.length],
      jacket: h(10, 10) > 0.35 ? coats[Math.floor(h(11, 11) * coats.length) % coats.length] : null,
      jacketWeave: "cloth",
      trousers: legs[Math.floor(h(12, 12) * legs.length) % legs.length],
      legWeave: h(13, 13) > 0.5 ? "denim" : "cloth",
      shoe: 0x231e1a, belt: h(14, 14) > 0.5,
      sleeves: h(15, 15) > 0.7 ? "short" : true
    });
    /* a bag, because everybody who got here brought something */
    if (h(16, 16) > 0.4) {
      var S = r.S;
      var bag = new THREE.Mesh(roundBox(0.16 * S, 0.22 * S, 0.12 * S, 0.04 * S, 2),
        clothMat(0x4a4238, 0.95));
      bag.position.set(-0.20 * S, 0.20 * S, 0.16 * S);
      bag.castShadow = true;
      r.spine.add(bag);
      var strap = new THREE.Mesh(new THREE.BoxGeometry(0.028 * S, 0.42 * S, 0.09 * S), leatherMat(0x3a332c));
      strap.position.set(-0.02 * S, 0.30 * S, 0.10 * S);
      strap.rotation.z = 0.30;
      r.spine.add(strap);
    }
    r.name = "civilian";
    return r;
  }

  /* ---- the horse ---- */
  function buildHorse() {
    var hide = new THREE.MeshStandardMaterial({
      color: 0x6b4a30, roughness: 0.85, metalness: 0.0,
      map: tex("cloth", 128, 2), bumpMap: bump("cloth", 128, 2), bumpScale: 0.1
    });
    var mane = new THREE.MeshStandardMaterial({ color: 0x241a12, roughness: 0.8 });

    var root = new THREE.Group();
    var body = new THREE.Group();
    body.position.y = 1.34;
    root.add(body);

    var barrel = new THREE.Mesh(
      (function () { var g = new THREE.SphereGeometry(0.60, 16, 12); g.scale(1.55, 0.86, 0.78); return g; })(),
      hide);
    barrel.castShadow = true;
    body.add(barrel);

    /* neck and head, angled forward and down */
    var neck = new THREE.Group();
    neck.position.set(0.80, 0.20, 0);
    neck.rotation.z = -0.62;
    body.add(neck);
    var neckM = new THREE.Mesh(tapered(0.72, 0.15, 0.24, 10), hide);
    neckM.rotation.z = Math.PI;   /* point it up out of the shoulder */
    neckM.castShadow = true;
    neck.add(neckM);
    var headG = new THREE.Group();
    headG.position.set(0, 0.72, 0);
    neck.add(headG);
    var head = new THREE.Mesh(
      (function () { var g = new THREE.SphereGeometry(0.16, 12, 10); g.scale(1.7, 0.85, 0.8); return g; })(),
      hide);
    head.rotation.z = 0.9;
    head.castShadow = true;
    headG.add(head);
    [1, -1].forEach(function (s) {
      var ear = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.14, 6), hide);
      ear.position.set(-0.06, 0.13, s * 0.07);
      headG.add(ear);
    });
    var maneM = new THREE.Mesh(
      (function () { var g = new THREE.BoxGeometry(0.10, 0.80, 0.05); g.translate(0, 0.38, 0); return g; })(), mane);
    maneM.position.set(-0.12, 0, 0);
    neck.add(maneM);

    /* tail */
    var tail = new THREE.Group();
    tail.position.set(-0.90, 0.16, 0);
    body.add(tail);
    var tailM = new THREE.Mesh(tapered(0.66, 0.07, 0.03, 6), mane);
    tailM.rotation.z = -0.4;
    tail.add(tailM);

    /* four legs */
    function hleg(fx, side) {
      var hip = new THREE.Group();
      hip.position.set(fx, -0.28, side * 0.30);
      body.add(hip);
      var upper = joint(0.56, 0.11, 0.07, hide, 7);
      hip.add(upper);
      var knee = new THREE.Group(); knee.position.y = -0.56; upper.add(knee);
      var lower = joint(0.50, 0.055, 0.045, hide, 6);
      knee.add(lower);
      var hoof = new THREE.Mesh(new THREE.CylinderGeometry(0.062, 0.07, 0.10, 7), mane);
      hoof.position.y = -0.52; knee.add(hoof);
      return { hip: hip, upper: upper, knee: knee };
    }
    var lfl = hleg(0.62, 1), lfr = hleg(0.62, -1),
        lbl = hleg(-0.62, 1), lbr = hleg(-0.62, -1);

    root.traverse(function (o) { if (o.isMesh) o.castShadow = true; });
    var hcontact = contactShadow(1);
    hcontact.scale.set(3.2, 1.9, 1);
    root.add(hcontact);
    return { root: root, body: body, neck: neck, head: headG, tail: tail,
             legs: [lfl, lfr, lbl, lbr], phase: 0 };
  }

  function poseHorse(h, t, gait) {
    var g = clamp(gait, 0, 1);
    var w = t * 6.4;
    h.legs.forEach(function (L, i) {
      var off = [0, Math.PI, Math.PI * 0.55, Math.PI * 1.55][i];
      var s = Math.sin(w + off);
      L.upper.rotation.z = s * 0.52 * g;
      L.knee.rotation.z = Math.max(0, -Math.cos(w + off)) * 0.7 * g + 0.08;
    });
    h.body.position.y = 1.34 + Math.abs(Math.sin(w)) * 0.045 * g;
    h.neck.rotation.z = -0.62 + Math.sin(w) * 0.05 * g;
    h.head.rotation.z = Math.sin(t * 1.1) * 0.06;
    h.tail.rotation.z = Math.sin(t * 2.2) * 0.14;
  }

  /* =========================================================
     13 — WHAT EACH CHARACTER IN THE GRID MEANS
     ========================================================= */
  var SOLID  = "#ovLKcYfB=FnuQwG~T C H W D d P".replace(/ /g, "");
  var OPAQUE = "#ovLcYfGH~";                 /* stops sight as well as feet */
  var HIDE   = "hj";
  var WALK   = ".,hlqriSXzxbg*NA";

  function isSolidChar(ch) { return SOLID.indexOf(ch) >= 0; }
  function isOpaqueChar(ch) { return OPAQUE.indexOf(ch) >= 0; }

  /* =========================================================
     14 — THE WORLD
     A grid goes in; a scene with floors, walls, furniture,
     trees, cars, lamps and doors comes out. Anything that
     repeats is an InstancedMesh, so a forty-eight by thirty-
     three street is still a handful of draw calls.
     ========================================================= */

  function Batch(geometry, material, castShadow, receiveShadow) {
    this.g = geometry; this.m = material;
    this.items = [];
    this.cast = castShadow !== false;
    this.recv = !!receiveShadow;
  }
  Batch.prototype.add = function (x, y, z, sx, sy, sz, ry, colour) {
    this.items.push([x, y, z, sx, sy, sz, ry || 0, colour == null ? 0xffffff : colour]);
  };
  Batch.prototype.build = function (parent) {
    if (!this.items.length) return null;
    var im = new THREE.InstancedMesh(this.g, this.m, this.items.length);
    im.castShadow = this.cast; im.receiveShadow = this.recv;
    var d = new THREE.Object3D(), c = new THREE.Color();
    for (var i = 0; i < this.items.length; i++) {
      var it = this.items[i];
      d.position.set(it[0], it[1], it[2]);
      d.scale.set(it[3], it[4], it[5]);
      d.rotation.set(0, it[6], 0);
      d.updateMatrix();
      im.setMatrixAt(i, d.matrix);
      im.setColorAt(i, c.setHex(it[7]));
    }
    im.instanceMatrix.needsUpdate = true;
    if (im.instanceColor) im.instanceColor.needsUpdate = true;
    im.frustumCulled = false;
    parent.add(im);
    return im;
  };

  function luma(hex) {
    return (0.2126 * ((hex >> 16) & 255) + 0.7152 * ((hex >> 8) & 255) + 0.0722 * (hex & 255)) / 255;
  }

  /* Two locations lit identically do not look identically lit: the
     hospital's pale vinyl throws back nearly twice what the house's
     floorboards do, and blows out. Every light in a level is scaled by
     how bright the place's own materials are, so "dark" means the same
     thing in all five of them. */
  function lightBalance(pal) {
    return clamp(0.40 / Math.max(0.15, luma(pal.floor)), 0.45, 1.5);
  }

  function shade(hex, f) {
    var r = clamp(((hex >> 16) & 255) * f, 0, 255) | 0;
    var g = clamp(((hex >> 8) & 255) * f, 0, 255) | 0;
    var b = clamp((hex & 255) * f, 0, 255) | 0;
    return (r << 16) | (g << 8) | b;
  }

  function buildWorld(def) {
    var pal = PAL[def.theme] || PAL.house;
    var rows = def.map;
    var H = rows.length, W = 0;
    for (var i = 0; i < H; i++) W = Math.max(W, rows[i].length);

    var cells = [];
    for (var y = 0; y < H; y++) {
      var line = rows[y];
      var r = new Array(W);
      for (var x = 0; x < W; x++) {
        var ch = x < line.length ? line[x] : " ";
        if (ch === " ") ch = " ";
        r[x] = ch;
      }
      cells.push(r);
    }

    var world = {
      def: def, pal: pal, cells: cells, w: W, h: H,
      group: new THREE.Group(),
      doors: [], lamps: [], props: [], things: [], anim: [],
      spawn: null, exit: null, anwarAt: null, horseAt: null, carAt: null,
      opened: {}, powered: !def.dead, deadZone: def.dead || null,
      outdoor: def.base === ","
    };
    var G = world.group;

    function cx(x) { return (x + 0.5) * TILE; }
    function cz(y) { return (y + 0.5) * TILE; }
    function at(x, y) {
      if (x < 0 || y < 0 || x >= W || y >= H) return "#";
      return cells[y][x];
    }
    world.at = at;
    world.cx = cx; world.cz = cz;

    /* ---------- materials ---------- */
    var indoorFloorTex = def.floorTex ||
                        (def.theme === "hospital" ? "clinic"
                       : def.theme === "house" ? "boards"
                       : def.theme === "street" ? "pave"
                       : "dirt");
    var matFloor  = surface(indoorFloorTex, {
      size: 512, rough: indoorFloorTex === "clinic" ? 0.40 : 0.72,
      bumpScale: 0.10, envInt: indoorFloorTex === "clinic" ? 1.0 : 0.5 });
    /* what the comma means is a property of the place, not of the theme:
       it is the drive outside the garage, the road, the hospital car park,
       the fields and the clearing, in that order */
    var groundTex = def.groundTex || (def.theme === "street" ? "asphalt" : "grass");
    /* The road is wet. Its roughness comes out of a map, so the standing
       water is mirror-smooth and takes the streetlights while the dry
       aggregate around it stays matt — one material, two surfaces. */
    var matGround = groundTex === "asphalt"
      ? surface("asphalt", { size: 512, roughMap: "asphaltR", rough: 1.0,
                             metal: 0.05, bumpScale: 0.06, envInt: 1.6 })
      : surface(groundTex, { size: 512, rough: 0.97, bumpScale: 0.16, envInt: 0.5 });
    var matWall   = surface(def.theme === "street" ? "brick"
                          : def.theme === "hospital" ? "block" : "plaster",
                            { size: 512, rough: 0.9, bumpScale: 0.26, envInt: 0.35 });
    var outdoorLevel = def.base === ",";
    var matCap    = outdoorLevel
                  ? surface("roof", { repeat: 1, rough: 0.98, bumpScale: 0.22 })
                  : surface(def.theme === "hospital" ? "block" : "plaster",
                            { repeat: 1, rough: 0.9, bumpScale: 0.12 });
    var matWood   = surface("boards", { repeat: 1, rough: 0.8, bumpScale: 0.2 });
    var matMetal  = surface("metal",  { size: 512, rough: 0.38, metal: 0.85, bumpScale: 0.16, envInt: 1.4 });
    var matLeaf   = surface("leaves", { repeat: 1, rough: 0.95, bumpScale: 0.24 });
    var matBark   = surface("bark",   { size: 512, rough: 0.96, bumpScale: 0.34, envInt: 0.3 });
    var matCloth  = surface("cloth",  { repeat: 1, rough: 0.98, bumpScale: 0.1 });
    world.mats = { floor: matFloor, ground: matGround, wall: matWall };

    /* Dark glass is not a dark rectangle: it is a mirror with almost
       nothing behind it. Given the environment it picks up the sky, the
       streetlights and the building opposite, which is what makes a row of
       windows at night read as windows. */
    var darkWinMat = new THREE.MeshStandardMaterial({
      map: tex("glass", 256, 1),
      color: 0xdbe6f2, roughness: 0.05, metalness: 0.0,
      emissive: new THREE.Color(0x0d1620), emissiveIntensity: 0.5,
      envMapIntensity: 2.6 });
    var litWinMat = new THREE.MeshStandardMaterial({
      color: 0xffd8a0, roughness: 0.4, metalness: 0,
      emissive: new THREE.Color(0xffb867), emissiveIntensity: 1.5, toneMapped: true });
    var winFrameMat = surface("metal", { size: 256, rough: 0.6, metal: 0.5, tint: 0x59524a, envInt: 1.0 });

    /* a soot plume, painted once */
    function sootTexture() {
      if (TEX.__soot) return TEX.__soot;
      var cc = canvas2d(128), sx = cc.x;
      var g2 = sx.createLinearGradient(0, 128, 0, 0);
      g2.addColorStop(0, "rgba(0,0,0,.95)");
      g2.addColorStop(0.5, "rgba(0,0,0,.45)");
      g2.addColorStop(1, "rgba(0,0,0,0)");
      sx.fillStyle = g2; sx.fillRect(0, 0, 128, 128);
      var f2 = fbm(128, 5, 3, 77);
      var img = sx.getImageData(0, 0, 128, 128), dd = img.data;
      for (var i = 0, p2 = 3; i < f2.length; i++, p2 += 4) {
        dd[p2] = clamp(dd[p2] * (0.35 + f2[i] * 1.3), 0, 255);
        /* pinch it in at the sides so it reads as a plume, not a panel */
        var cxp = (i % 128) / 128 - 0.5;
        dd[p2] = clamp(dd[p2] * (1 - Math.abs(cxp) * 1.7), 0, 255);
      }
      sx.putImageData(img, 0, 0);
      TEX.__soot = new THREE.CanvasTexture(cc.c);
      return TEX.__soot;
    }

    /* ---------- batches ---------- */
    var B = {
      floor:  new Batch(geo("tileF", function () { return new THREE.BoxGeometry(TILE, 0.30, TILE); }), matFloor, false, true),
      ground: new Batch(geo("tileG", function () { return new THREE.BoxGeometry(TILE, 0.30, TILE); }), matGround, false, true),
      wall:   new Batch(geo("wallB", function () { return new THREE.BoxGeometry(TILE, TUNE.wallH, TILE); }), matWall, true, true),
      cap:    new Batch(geo(outdoorLevel ? "capO" : "capB", function () {
                return new THREE.BoxGeometry(TILE * (outdoorLevel ? 1.16 : 1.04),
                                             outdoorLevel ? 0.34 : 0.16,
                                             TILE * (outdoorLevel ? 1.16 : 1.04)); }), matCap, true, true),
      /* the parapet is part of the roof and the chimney is part of the
         house, so they are not the same material */
      roofedge: new Batch(geo("roofB", function () { return new THREE.BoxGeometry(1, 1, 1); }),
                outdoorLevel ? surface("roof", { repeat: 1, rough: 0.97, bumpScale: 0.2, tint: 0xc0c4cc })
                             : matCap, true, true),
      roofbits: new Batch(geo("roofB2", function () { return new THREE.BoxGeometry(1, 1, 1); }),
                surface("brick", { repeat: 1, rough: 0.98, bumpScale: 0.2 }), true, true),
      low:    new Batch(geo("lowB",  function () { return new THREE.BoxGeometry(TILE * 0.9, TUNE.lowH, TILE * 0.9); }), matWood, true, true),
      tall:   new Batch(geo("tallB", function () { return new THREE.BoxGeometry(TILE * 0.88, TUNE.tallH, TILE * 0.88); }), matWood, true, true),
      hedge:  new Batch(geo("hedgeB",function () { return new THREE.BoxGeometry(TILE * 0.98, 2.1, TILE * 0.98); }), matLeaf, true, true),
      trunk:  new Batch(geo("trunkC",function () { var g = new THREE.CylinderGeometry(0.17, 0.26, 1, 8); g.translate(0, 0.5, 0); return g; }), matBark, true, true),
      canopy: new Batch(geo("canopyI",function () { return new THREE.IcosahedronGeometry(1, 1); }), matLeaf, true, false),
      cloth:  new Batch(geo("clothB", function () { return new THREE.BoxGeometry(1, 1, 1); }), matCloth, true, true),
      metal:  new Batch(geo("metalB", function () { return new THREE.BoxGeometry(1, 1, 1); }), matMetal, true, true),
      wood:   new Batch(geo("woodB",  function () { return new THREE.BoxGeometry(1, 1, 1); }), matWood, true, true),
      kerb:   new Batch(geo("kerbB",  function () { return new THREE.BoxGeometry(TILE, 0.30, 0.16); }),
                surface("block", { size: 512, rough: 0.86, bumpScale: 0.12, tint: 0xb8bcc0 }), true, true),

      /* ---- the pieces a facade is made of ----
         Each is one instanced batch across the whole level, so a street of
         forty buildings with two hundred windows in it is still a dozen
         draw calls. */
      coping:  new Batch(geo("copingB", function () { return new THREE.BoxGeometry(TILE * 1.22, 0.14, TILE * 1.22); }),
                surface("block", { size: 512, rough: 0.84, bumpScale: 0.14, tint: 0xa8aeb6 }), true, true),
      plinth:  new Batch(geo("plinthB", function () { return new THREE.BoxGeometry(TILE * 1.06, 0.60, 0.24); }),
                surface("block", { size: 512, rough: 0.88, bumpScale: 0.16, tint: 0x9aa0a8 }), true, true),
      band:    new Batch(geo("bandB", function () { return new THREE.BoxGeometry(1, 1, 1); }),
                surface("block", { size: 512, rough: 0.86, bumpScale: 0.12, tint: 0xa4aab2 }), true, true),
      sill:    new Batch(geo("sillB2", function () { return new THREE.BoxGeometry(TILE * 0.72, 0.11, 0.26); }),
                surface("block", { size: 512, rough: 0.82, bumpScale: 0.1, tint: 0xb0b6be }), true, true),
      reveal:  new Batch(geo("revealB", function () { return new THREE.BoxGeometry(1, 1, 1); }),
                new THREE.MeshStandardMaterial({ color: 0x14181e, roughness: 0.95, metalness: 0 }), false, true),
      winDark: new Batch(geo("winB", function () { return new THREE.BoxGeometry(TILE * 0.56, 0.92, 0.06); }),
                null, false, false),
      winLit:  new Batch(geo("winB2", function () { return new THREE.BoxGeometry(TILE * 0.56, 0.92, 0.06); }),
                null, false, false),
      winFrame: new Batch(geo("winFrameB", function () {
                  /* a frame with a transom and a mullion in it */
                  var a = new THREE.BoxGeometry(TILE * 0.62, 0.07, 0.10); a.translate(0, 0.49, 0);
                  var b = new THREE.BoxGeometry(TILE * 0.62, 0.07, 0.10); b.translate(0, -0.49, 0);
                  var c = new THREE.BoxGeometry(0.07, 1.05, 0.10); c.translate(-TILE * 0.29, 0, 0);
                  var d = new THREE.BoxGeometry(0.07, 1.05, 0.10); d.translate(TILE * 0.29, 0, 0);
                  var e = new THREE.BoxGeometry(0.05, 0.98, 0.09);
                  var f = new THREE.BoxGeometry(TILE * 0.58, 0.045, 0.09); f.translate(0, 0.16, 0);
                  return mergeGeoms([a, b, c, d, e, f]);
                }), null, true, false),
      board:   new Batch(geo("boardB", function () { return new THREE.BoxGeometry(1, 1, 1); }),
                surface("boards", { size: 256, rough: 0.95, bumpScale: 0.2, tint: 0x9a8464 }), true, false),
      shutter: new Batch(geo("shutB", function () { return new THREE.BoxGeometry(1, 1, 1); }),
                surface("metal", { size: 256, rough: 0.55, metal: 0.7, tint: 0x8a8f96, envInt: 1.1 }), true, false),
      soot:    new Batch(geo("sootB", function () { return new THREE.PlaneGeometry(1, 1); }),
                new THREE.MeshBasicMaterial({ map: sootTexture(), transparent: true, opacity: 0.72,
                  depthWrite: false, color: 0x0a0a0c }), false, false),
      tank:    new Batch(geo("tankB", function () { return new THREE.CylinderGeometry(0.62, 0.62, 1.1, 14); }),
                surface("metal", { size: 256, rough: 0.7, metal: 0.6, tint: 0x6a6258, envInt: 1.0 }), true, true),
      thin:    new Batch(geo("thinB", function () { return new THREE.BoxGeometry(1, 1, 1); }),
                surface("metal", { size: 256, rough: 0.5, metal: 0.75, tint: 0x585c62, envInt: 1.2 }), true, true),
      rubble:  new Batch(geo("rubbleB", function () { return new THREE.DodecahedronGeometry(1, 0); }),
                surface("block", { size: 256, rough: 0.96, bumpScale: 0.3, tint: 0x8a8278 }), true, true),
      litter:  new Batch(geo("litterB", function () {
                  var g = new THREE.PlaneGeometry(1, 1);
                  g.rotateX(-Math.PI / 2);
                  return g;
                }),
                new THREE.MeshStandardMaterial({ color: 0xb0aca0, roughness: 0.95,
                  side: THREE.DoubleSide }), false, true)
    };
    /* the glass and the frames are declared with the batches but built
       from the materials below them, so they are filled in here */
    B.winDark.m = darkWinMat;
    B.winLit.m = litWinMat;
    B.winFrame.m = winFrameMat;
    world.B = B;

    /* ---------- how tall is each building? ----------
       Outdoors, a run of wall is a building, and buildings are not all the
       same height. Flooding the mass and giving each one its own storey
       count is the single thing that stops a street looking like a maze
       drawn flat on the floor. */
    var region = [], regionH = [];
    (function () {
      for (var y = 0; y < H; y++) { var row = new Array(W); for (var i = 0; i < W; i++) row[i] = -1; region.push(row); }
      if (!outdoorLevel) return;
      var next = 0;
      for (var yy = 0; yy < H; yy++) for (var xx = 0; xx < W; xx++) {
        var c0 = cells[yy][xx];
        if ((c0 !== "#" && c0 !== "v") || region[yy][xx] >= 0) continue;
        var id = next++, stack = [[xx, yy]], n = 0;
        region[yy][xx] = id;
        while (stack.length) {
          var q = stack.pop(); n++;
          var nb = [[1, 0], [-1, 0], [0, 1], [0, -1]];
          for (var k = 0; k < 4; k++) {
            var ax = q[0] + nb[k][0], ay = q[1] + nb[k][1];
            if (ax < 0 || ay < 0 || ax >= W || ay >= H) continue;
            var cc = cells[ay][ax];
            if ((cc !== "#" && cc !== "v") || region[ay][ax] >= 0) continue;
            region[ay][ax] = id; stack.push([ax, ay]);
          }
        }
        /* a long boundary wall stays a wall; a block of them is a building */
        var t = hash2(id * 13 + 7, id * 29 + 3);
        regionH[id] = n < 7 ? 1.0 : 1.15 + Math.floor(t * 4) * 0.42;
      }
    })();

    /* ---------- the floor under everything ----------
       Outdoors, "not a comma" is not the same as "a made surface": the
       gathering points, the woodpiles, the bedrolls and the spot she
       starts on are all standing in grass. Anything architectural gets a
       floor, anything obviously ground keeps the ground, and the handful
       of characters that could be either take the surface most of their
       neighbours have. */
    /* h, o and c are a wardrobe indoors and a bush, a hedge and a parked
       car outdoors, so they take whatever their neighbours are standing on
       rather than dragging a slab of pavement into a field */
    var ARCH = ".lLGQ=#vKBFnufYyjdDPWNT";
    function isOutdoorTile(ch) { return ch === "," || ch === "~"; }
    function surfaceOf(ch) {
      if (ch === "," || ch === "~" || ch === " ") return 0;   /* ground */
      if (ARCH.indexOf(ch) >= 0) return 1;                    /* made */
      return -1;                                              /* could be either */
    }
    function madeSurface(x, y) {
      var v = surfaceOf(at(x, y));
      if (v >= 0) return v === 1;
      var made = 0, open = 0;
      for (var j = -1; j <= 1; j++) for (var i = -1; i <= 1; i++) {
        if (!i && !j) continue;
        var n = surfaceOf(at(x + i, y + j));
        if (n === 1) made++; else if (n === 0) open++;
      }
      return made > open;
    }

    /* On the streets the comma is the carriageway and the full stop is the
       footway, and there is a kerb between them: that single 10 cm step is
       what turns a flat grey grid into a street. A farm lane has no kerb —
       it just runs out into the grass. */
    var kerbRise = def.theme === "street" ? 0.11 : 0;
    world.kerb = kerbRise;
    world.made = madeSurface;
    for (var yy = 0; yy < H; yy++) {
      for (var xx = 0; xx < W; xx++) {
        var ch = at(xx, yy);
        if (ch === " ") continue;
        var t = hash2(xx, yy);
        var yTop = -0.15;
        if (!madeSurface(xx, yy)) {
          B.ground.add(cx(xx), yTop - t * 0.02, cz(yy), 1, 1, 1, 0, shade(0xffffff, 0.94 + t * 0.12));
        } else {
          B.floor.add(cx(xx), yTop + kerbRise - t * 0.015, cz(yy), 1, 1, 1,
                      (Math.floor(t * 4) % 2) * Math.PI / 2, shade(0xffffff, 0.92 + t * 0.16));
          /* the kerb face, wherever a footway meets a road */
          if (kerbRise > 0) {
            var nbk = [[1, 0, Math.PI / 2], [-1, 0, -Math.PI / 2], [0, 1, 0], [0, -1, Math.PI]];
            for (var kk = 0; kk < 4; kk++) {
              if (madeSurface(xx + nbk[kk][0], yy + nbk[kk][1])) continue;
              if (at(xx + nbk[kk][0], yy + nbk[kk][1]) === " ") continue;
              B.kerb.add(cx(xx) + nbk[kk][0] * TILE * 0.5,
                         yTop + kerbRise * 0.5,
                         cz(yy) + nbk[kk][1] * TILE * 0.5,
                         1, 1, 1, nbk[kk][2], shade(0xffffff, 1.25));
            }
          }
        }
      }
    }

    /* ---------- walls ---------- */
    var glassGeo = geo("glassP", function () { return new THREE.PlaneGeometry(TILE * 0.62, 1.15); });
    var glassMat = new THREE.MeshStandardMaterial({
      map: tex("glass", 256, 1),
      color: 0xffffff, roughness: 0.06, metalness: 0.0,
      emissive: new THREE.Color(0x18283a), emissiveIntensity: 0.5,
      envMapIntensity: 2.2,
      transparent: true, opacity: 0.86, side: THREE.DoubleSide
    });
    world.glassMat = glassMat;

    function placeWall(x, y, isWindow) {
      var t = hash2(x * 3, y * 7);
      var rid = region[y] ? region[y][x] : -1;
      var hgt = (rid >= 0 && regionH[rid] ? regionH[rid] : 1) + (t - 0.5) * 0.02;
      var top = TUNE.wallH * hgt - 0.15;
      B.wall.add(cx(x), top / 2 - 0.075, cz(y), 1, hgt, 1, 0, shade(0xffffff, 0.62 + t * 0.30));
      B.cap.add(cx(x), top + (outdoorLevel ? 0.17 : 0.08), cz(y), 1, 1, 1, 0,
                shade(0xffffff, (outdoorLevel ? 0.88 : 1.22) + t * 0.2));

      if (outdoorLevel) {
        var nb = [[1, 0, Math.PI / 2], [-1, 0, -Math.PI / 2], [0, 1, 0], [0, -1, Math.PI]];
        var edge = false;
        for (var e = 0; e < 4; e++) {
          var ec = at(x + nb[e][0], y + nb[e][1]);
          if (ec !== "#" && ec !== "v" && ec !== " ") edge = true;
        }

        /* ---------------- the roofline ----------------
           A parapet with a coping on it, and then the things that actually
           live on a roof: a stair head, a tank, plant, an aerial. Flat
           lids are what made these read as boxes. */
        if (edge && hgt > 1.02) {
          B.roofedge.add(cx(x), top + 0.44, cz(y), TILE * 1.16, 0.42, TILE * 1.16, 0,
                         shade(0xffffff, 0.72 + t * 0.3));
          B.coping.add(cx(x), top + 0.68, cz(y), 1, 1, 1, 0, shade(0xffffff, 1.25 + t * 0.2));
        }
        if (!edge && hgt > 1.02) {
          var kind = hash2(y * 3, x * 5);
          if (t > 0.86) {
            /* the stair head, the only thing on a roof with a door in it */
            B.roofbits.add(cx(x), top + 1.05, cz(y), TILE * 0.86, 2.1, TILE * 0.78, 0,
                           shade(0xffffff, 0.66 + t * 0.3));
            B.coping.add(cx(x), top + 2.13, cz(y), 0.9, 1, 0.82, 0, shade(0xffffff, 1.2));
          } else if (t > 0.74) {
            /* a water tank on legs */
            var tankY = top + 1.55;
            B.tank.add(cx(x), tankY, cz(y), 1, 1, 1, kind * 3, shade(0xffffff, 0.8 + t * 0.3));
            for (var lg = 0; lg < 4; lg++) {
              var la = lg / 4 * 6.2832 + 0.78;
              B.thin.add(cx(x) + Math.cos(la) * 0.55, top + 0.75, cz(y) + Math.sin(la) * 0.55,
                         0.10, 1.6, 0.10, 0, shade(0xffffff, 0.7));
            }
          } else if (t > 0.56) {
            /* plant: two boxes and a cowl */
            B.roofbits.add(cx(x) - 0.3, top + 0.42, cz(y), 1.3, 0.85, 1.0, kind * 0.4,
                           shade(0xffffff, 0.86));
            B.thin.add(cx(x) + 0.55, top + 0.72, cz(y) + 0.3, 0.42, 1.45, 0.42, 0,
                       shade(0xffffff, 0.75));
          } else if (t > 0.44) {
            /* an aerial */
            B.thin.add(cx(x), top + 1.5, cz(y), 0.07, 3.0, 0.07, 0, shade(0xffffff, 0.6));
            B.thin.add(cx(x), top + 2.5, cz(y), 0.9, 0.05, 0.05, kind * 3, shade(0xffffff, 0.6));
            B.thin.add(cx(x), top + 2.2, cz(y), 0.7, 0.05, 0.05, kind * 3 + 0.3, shade(0xffffff, 0.6));
          }
        }

        /* ---------------- the facade ----------------
           A plinth at the pavement, a band at every floor, windows set
           into a reveal with a sill and a lintel, a shopfront at street
           level, and the odd one boarded, broken or burnt out. */
        if (edge) {
          var storeys = Math.max(1, Math.round(hgt * 1.55));
          var floorH = (TUNE.wallH * hgt - 0.55) / storeys;

          for (var di = 0; di < 4; di++) {
            var d = nb[di];
            var cc2 = at(x + d[0], y + d[1]);
            if (cc2 === "#" || cc2 === "v" || cc2 === " ") continue;

            var ox = cx(x) + d[0] * (TILE / 2), oz = cz(y) + d[1] * (TILE / 2);
            var face = d[2];
            var fseed = hash2(x * 31 + di * 7, y * 17 + di * 3);

            /* the plinth: a course of stone the building stands on */
            B.plinth.add(ox + d[0] * 0.05, 0.30, oz + d[1] * 0.05, 1, 1, 1, face,
                         shade(0xffffff, 1.1 + t * 0.2));
            /* the cornice under the parapet */
            B.band.add(ox + d[0] * 0.07, top - 0.16, oz + d[1] * 0.07, TILE * 1.02, 0.26, 0.20, face,
                       shade(0xffffff, 1.15));

            for (var f = 0; f < storeys; f++) {
              var wy = 0.62 + f * floorH + floorH * 0.5;
              if (wy > top - 0.75) continue;
              var seed = hash2(x * 31 + di * 7 + f * 13, y * 17 + f * 5);

              /* a string course between floors */
              if (f > 0) {
                B.band.add(ox + d[0] * 0.045, 0.62 + f * floorH, oz + d[1] * 0.045,
                           TILE * 1.0, 0.12, 0.13, face, shade(0xffffff, 1.08));
              }

              var ground = (f === 0);
              var shopfront = ground && fseed > 0.55 && hgt > 1.2;

              if (shopfront) {
                /* a wide glazed opening, a stall riser under it, a fascia
                   over it, and a security shutter half down on some */
                B.reveal.add(ox + d[0] * 0.02, wy + 0.05, oz + d[1] * 0.02,
                             TILE * 0.90, floorH * 0.80, 0.12, face, shade(0xffffff, 0.5));
                var shutter = seed > 0.72;
                if (shutter) {
                  B.shutter.add(ox + d[0] * 0.08, wy + 0.05, oz + d[1] * 0.08,
                                TILE * 0.86, floorH * 0.74, 0.06, face, shade(0xffffff, 0.9 + seed * 0.3));
                } else {
                  B.winDark.add(ox + d[0] * 0.075, wy + 0.05, oz + d[1] * 0.075,
                                TILE * 0.86 / (TILE * 0.5), floorH * 0.74 / 0.8, 1, face,
                                shade(0xffffff, 0.9));
                }
                B.band.add(ox + d[0] * 0.09, wy + floorH * 0.46, oz + d[1] * 0.09,
                           TILE * 1.04, 0.34, 0.16, face, shade(0xffffff, 0.55 + seed * 0.3));
                B.plinth.add(ox + d[0] * 0.06, wy - floorH * 0.40, oz + d[1] * 0.06, 1, 0.6, 1, face,
                             shade(0xffffff, 0.95));
                continue;
              }

              if (seed < 0.30) continue;      /* solid wall: not every bay has a window */

              var brokenIn = seed > 0.93;
              var boarded  = seed > 0.86 && seed <= 0.93;

              /* the reveal: a dark recess, so the window has depth */
              B.reveal.add(ox + d[0] * 0.02, wy, oz + d[1] * 0.02,
                           TILE * 0.60, 0.98, 0.14, face, shade(0xffffff, 0.42));
              /* the sill, projecting, with the stain it drips down the wall */
              B.sill.add(ox + d[0] * 0.085, wy - 0.53, oz + d[1] * 0.085, 1, 1, 1, face,
                         shade(0xffffff, 1.2));
              /* the lintel over it */
              B.band.add(ox + d[0] * 0.06, wy + 0.55, oz + d[1] * 0.06,
                         TILE * 0.70, 0.14, 0.16, face, shade(0xffffff, 1.12));

              if (boarded) {
                for (var bd = 0; bd < 3; bd++) {
                  B.board.add(ox + d[0] * 0.075, wy - 0.30 + bd * 0.30, oz + d[1] * 0.075,
                              TILE * 0.60, 0.22, 0.05, face + (hash2(bd, f) - 0.5) * 0.10,
                              shade(0xffffff, 0.8 + hash2(bd, seed * 10) * 0.4));
                }
              } else if (brokenIn) {
                /* the frame is still there; the glass is not */
                B.winFrame.add(ox + d[0] * 0.065, wy, oz + d[1] * 0.065, 1, 1, 1, face, 0xffffff);
                if (seed > 0.965) {
                  /* and it has burned: soot up the wall above it */
                  B.soot.add(ox + d[0] * 0.03, wy + 0.95, oz + d[1] * 0.03,
                             TILE * 0.8, 1.5, 0.02, face, 0xffffff);
                }
              } else {
                var lit = seed > 0.80;
                (lit ? B.winLit : B.winDark).add(
                  ox + d[0] * 0.068, wy, oz + d[1] * 0.068, 1, 1, 1, face,
                  lit ? shade(0xffffff, 0.7 + seed) : shade(0xffffff, 0.85 + seed * 0.3));
                B.winFrame.add(ox + d[0] * 0.062, wy, oz + d[1] * 0.062, 1, 1, 1, face, 0xffffff);
              }
            }
          }
        }
      }
      if (isWindow) {
        /* glass on whichever faces are open to a room */
        [[1, 0, 0], [-1, 0, Math.PI], [0, 1, Math.PI / 2], [0, -1, -Math.PI / 2]].forEach(function (d) {
          if (isSolidChar(at(x + d[0], y + d[1]))) return;
          var p = new THREE.Mesh(glassGeo, glassMat);
          p.position.set(cx(x) + d[0] * (TILE / 2 + 0.02), 1.35, cz(y) + d[1] * (TILE / 2 + 0.02));
          p.rotation.y = d[2] + Math.PI / 2;
          G.add(p);
          /* a frame around it */
          var fr = new THREE.Mesh(
            geo("frameP", function () { return new THREE.BoxGeometry(TILE * 0.72, 1.3, 0.08); }),
            matWood);
          fr.position.copy(p.position); fr.rotation.y = p.rotation.y;
          fr.position.y = 1.35;
          fr.scale.z = 1;
          G.add(fr);
          p.position.add(new THREE.Vector3(d[0] * 0.05, 0, d[1] * 0.05));
        });
      }
    }

    /* Which way should a thing standing against a wall face? Whichever
       side of it has the most room, measured three tiles out — not
       whichever open direction the loop happened to finish on, which is
       how the television ended up facing the wall behind it. */
    var FACES = [[0, 1, 0], [0, -1, Math.PI], [1, 0, Math.PI / 2], [-1, 0, -Math.PI / 2]];
    function faceOpen(x, y) {
      var best = 0, bestN = -1;
      for (var i = 0; i < 4; i++) {
        var d = FACES[i], n = 0;
        for (var k = 1; k <= 3; k++) {
          var c = at(x + d[0] * k, y + d[1] * k);
          if (c === " " || isSolidChar(c)) break;
          n++;
        }
        if (n > bestN) { bestN = n; best = d[2]; }
      }
      return best;
    }

    /* ---------- props ---------- */
    function lampPost(x, y) {
      var g = new THREE.Group();
      g.position.set(cx(x), 0, cz(y));
      var pole = new THREE.Mesh(
        geo("postC", function () { var gg = new THREE.CylinderGeometry(0.075, 0.11, 4.4, 8); gg.translate(0, 2.2, 0); return gg; }),
        matMetal);
      pole.castShadow = true; g.add(pole);
      var arm = new THREE.Mesh(
        geo("armC", function () { var gg = new THREE.CylinderGeometry(0.055, 0.055, 0.9, 6); gg.rotateZ(Math.PI / 2); return gg; }),
        matMetal);
      arm.position.set(0.42, 4.3, 0); arm.castShadow = true; g.add(arm);
      var headM = new THREE.Mesh(
        geo("lhead", function () { var gg = new THREE.SphereGeometry(0.3, 10, 7, 0, 6.2832, 1.6, 1.55); return gg; }),
        matMetal);
      headM.position.set(0.85, 4.28, 0); g.add(headM);
      var bulb = new THREE.Mesh(
        geo("bulbS", function () { return new THREE.SphereGeometry(0.14, 10, 8); }),
        new THREE.MeshBasicMaterial({ color: 0xf6d8a4, toneMapped: false }));
      bulb.position.set(0.85, 4.16, 0); g.add(bulb);
      var halo = new THREE.Sprite(new THREE.SpriteMaterial({
        map: glowTexture(), color: 0xffd9a0, blending: THREE.AdditiveBlending,
        transparent: true, depthWrite: false, opacity: 0.30 }));
      halo.scale.set(2.6, 2.6, 1); halo.position.set(0.85, 4.16, 0); g.add(halo);

      /* the shaft of it, hanging in the air under the lamp — the same
         trick as the torch, and the reason a wet street reads as weather
         rather than as a shiny floor */
      var shaft = new THREE.Mesh(
        geo("lampCone", function () {
          var gg = new THREE.CylinderGeometry(0.30, 2.30, 4.10, 20, 4, true);
          gg.translate(0, -2.05, 0);
          return gg;
        }),
        new THREE.ShaderMaterial({
          transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
          side: THREE.DoubleSide, fog: false,
          uniforms: { amt: { value: 0.16 }, tint: { value: new THREE.Color(0xffd7a2) } },
          vertexShader: [
            "varying vec2 vUv; varying float vY;",
            "void main(){ vUv = uv; vY = position.y;",
            " gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }"
          ].join("\n"),
          fragmentShader: [
            "uniform float amt; uniform vec3 tint;",
            "varying vec2 vUv; varying float vY;",
            "void main(){",
            "  float down = clamp(-vY/4.1, 0.0, 1.0);",
            "  float a = (1.0 - down) * (1.0 - down);",
            "  a *= smoothstep(0.0, 0.22, down);",
            "  float across = abs(vUv.x*2.0 - 1.0);",
            "  a *= pow(1.0 - across*across, 1.5);",
            "  gl_FragColor = vec4(tint, a*amt);",
            "}"
          ].join("\n")
        }));
      shaft.position.set(0.85, 4.14, 0);
      shaft.renderOrder = 18;
      shaft.frustumCulled = false;
      g.add(shaft);

      G.add(g);
      /* one lamp in six has had it, and is on its way out */
      var failing = hash2(x * 71 + 3, y * 29 + 7) > 0.82;
      world.lamps.push({ x: cx(x) + 0.85, y: 4.1, z: cz(y), colour: 0xffcf90,
                         power: 2.6, range: 12, kind: "post", bulb: bulb, halo: halo,
                         shaft: shaft, flicker: failing ? 1 : 0,
                         tx: x, ty: y });
      return g;
    }

    function floorLamp(x, y) {
      var g = new THREE.Group();
      g.position.set(cx(x), 0, cz(y));
      var indoor = def.theme !== "road" && def.theme !== "campsite";
      var pole = new THREE.Mesh(
        geo("flpole", function () { var gg = new THREE.CylinderGeometry(0.035, 0.09, 1.5, 7); gg.translate(0, 0.75, 0); return gg; }),
        matMetal);
      pole.castShadow = true; g.add(pole);
      var shadeM = new THREE.Mesh(
        geo("flshade", function () { return new THREE.CylinderGeometry(0.30, 0.38, 0.40, 12, 1, true); }),
        new THREE.MeshStandardMaterial({ color: 0xe8d6b4, roughness: 0.9, side: THREE.DoubleSide,
                                         emissive: new THREE.Color(0x6a4c22), emissiveIntensity: 0.8 }));
      shadeM.position.y = 1.62; g.add(shadeM);
      var bulb = new THREE.Mesh(
        geo("bulbS2", function () { return new THREE.SphereGeometry(0.10, 9, 7); }),
        new THREE.MeshBasicMaterial({ color: 0xf4e0bc, toneMapped: false }));
      bulb.position.y = 1.58; g.add(bulb);
      var halo = new THREE.Sprite(new THREE.SpriteMaterial({
        map: glowTexture(), color: 0xffd9a0, blending: THREE.AdditiveBlending,
        transparent: true, depthWrite: false, opacity: 0.26 }));
      halo.scale.set(2.0, 2.0, 1); halo.position.y = 1.58; g.add(halo);
      G.add(g);
      world.lamps.push({ x: cx(x), y: 1.7, z: cz(y), colour: indoor ? 0xffd9a8 : 0xffca88,
                         power: 2.0, range: 9.5, kind: "floor", bulb: bulb, halo: halo,
                         tx: x, ty: y });
      return g;
    }

    /* a tree with a trunk that leans and a canopy with three lobes,
       so no two of them are the same shape */
    function tree(x, y, big) {
      var t = hash2(x * 11, y * 13), t2 = hash2(y * 5, x * 3);
      var hgt = (big ? 4.6 : 3.4) + t * 1.8;
      var lean = (t2 - 0.5) * 0.14;
      B.trunk.add(cx(x) + lean, -0.14, cz(y) + lean * 0.6,
                  0.9 + t * 0.3, hgt, 0.9 + t * 0.3, t * 6.28, shade(0xffffff, 0.8 + t * 0.4));
      var lobes = 3;
      for (var i = 0; i < lobes; i++) {
        var a = t * 6.28 + i * 2.09;
        var r = (big ? 1.25 : 0.95) + hash2(x + i, y) * 0.5;
        B.canopy.add(
          cx(x) + Math.cos(a) * r * 0.55 + lean * 2,
          hgt * 0.86 + hash2(x, y + i) * 0.7,
          cz(y) + Math.sin(a) * r * 0.55,
          r, r * 0.82, r, a, shade(0xffffff, 0.72 + hash2(i, x + y) * 0.5));
      }
    }

    function hedge(x, y) {
      var t = hash2(x * 7, y * 3);
      B.hedge.add(cx(x), 1.05 - 0.15 + t * 0.12, cz(y),
                  1, 0.86 + t * 0.3, 1, t * 0.4, shade(0xffffff, 0.74 + t * 0.44));
      /* a few loose sprigs breaking the top line */
      for (var i = 0; i < 3; i++) {
        var s = 0.30 + hash2(x + i, y) * 0.28;
        B.canopy.add(cx(x) + (hash2(x, y + i) - 0.5) * TILE * 0.8,
                     1.9 + hash2(i, y) * 0.3,
                     cz(y) + (hash2(x + i * 3, y) - 0.5) * TILE * 0.8,
                     s, s * 0.8, s, i, shade(0xffffff, 0.7 + hash2(i, x) * 0.5));
      }
    }

    /* a car: body, cabin, glass, wheels, lights. Used parked, used
       as the one that starts, and used in the drive cinematic. */
    function makeCar(colour, dead) {
      var g = new THREE.Group();
      var paint = new THREE.MeshStandardMaterial({
        color: colour, roughness: dead ? 0.82 : 0.42, metalness: 0.55,
        map: tex("metal", 128, 1), bumpMap: bump("metal", 128, 1), bumpScale: 0.05
      });
      var glass = new THREE.MeshStandardMaterial({
        color: 0x1a2430, roughness: 0.08, metalness: 0.3, transparent: true, opacity: 0.72
      });
      var rubber = new THREE.MeshStandardMaterial({ color: 0x14161a, roughness: 0.95 });

      var body = new THREE.Mesh(new THREE.BoxGeometry(3.5, 0.62, 1.62), paint);
      body.position.y = 0.62; body.castShadow = true; g.add(body);
      var lowr = new THREE.Mesh(new THREE.BoxGeometry(3.3, 0.34, 1.5), paint);
      lowr.position.y = 0.34; lowr.castShadow = true; g.add(lowr);
      /* the cabin, set back and narrower — a real roofline */
      var cabin = new THREE.Mesh(new THREE.BoxGeometry(1.72, 0.56, 1.44), paint);
      cabin.position.set(-0.18, 1.20, 0); cabin.castShadow = true; g.add(cabin);
      var wind = new THREE.Mesh(new THREE.BoxGeometry(1.78, 0.42, 1.48), glass);
      wind.position.set(-0.18, 1.05, 0); g.add(wind);
      /* bonnet slope */
      var bon = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.2, 1.55), paint);
      bon.position.set(1.16, 0.94, 0); bon.rotation.z = -0.10; g.add(bon);

      [[1.28, 0.85], [-1.28, 0.85], [1.28, -0.85], [-1.28, -0.85]].forEach(function (p) {
        var w = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.26, 12), rubber);
        w.rotation.x = Math.PI / 2;
        w.position.set(p[0], 0.36, p[1]);
        w.castShadow = true;
        g.add(w);
      });
      g.userData.wheels = g.children.filter(function (c) { return c.geometry && c.geometry.type === "CylinderGeometry"; });

      if (!dead) {
        [0.7, -0.7].forEach(function (s) {
          var l = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6),
            new THREE.MeshBasicMaterial({ color: 0xfff0cc }));
          l.position.set(1.78, 0.72, s); g.add(l);
          var t = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.18, 0.34),
            new THREE.MeshBasicMaterial({ color: 0x992222 }));
          t.position.set(-1.78, 0.78, s); g.add(t);
        });
      }
      return g;
    }
    world.makeCar = makeCar;

    function parkedCar(x, y) {
      var t = hash2(x * 17, y * 5);
      var colours = [0x6a2a30, 0x2a3a52, 0x4a4a4a, 0x6a6255, 0x2f4a3a, 0x7a7a80];
      var c = makeCar(colours[Math.floor(t * colours.length)], true);
      c.position.set(cx(x), 0, cz(y));
      c.rotation.y = (t > 0.5 ? 0 : Math.PI) + (t - 0.5) * 0.24;
      if (hash2(y, x) > 0.72) c.rotation.y += Math.PI / 2;
      c.scale.setScalar(0.92);
      G.add(c);
      return c;
    }

    /* a door in a frame, that swings */
    function door(x, y, kind) {
      var g = new THREE.Group();
      g.position.set(cx(x), 0, cz(y));
      /* which way is the wall running? */
      var horiz = isSolidChar(at(x - 1, y)) && isSolidChar(at(x + 1, y));
      if (!horiz) g.rotation.y = Math.PI / 2;

      var frameMat = kind === "P" ? matMetal : matWood;
      [-1, 1].forEach(function (s) {
        var j = new THREE.Mesh(new THREE.BoxGeometry(0.20, 2.7, 0.34), frameMat);
        j.position.set(s * (TILE / 2 - 0.10), 1.35 - 0.15, 0);
        j.castShadow = true; g.add(j);
      });
      var lintel = new THREE.Mesh(new THREE.BoxGeometry(TILE, 0.34, 0.36), frameMat);
      lintel.position.y = 2.62; lintel.castShadow = true; g.add(lintel);
      /* the wall above the frame, so a doorway is a hole in something */
      var over = new THREE.Mesh(new THREE.BoxGeometry(TILE, TUNE.wallH - 2.62 - 0.15 + 0.3, TILE * 0.9), matWall);
      over.position.y = 2.62 + (TUNE.wallH - 2.62 - 0.15 + 0.3) / 2;
      over.castShadow = true; over.receiveShadow = true; g.add(over);

      var hinge = new THREE.Group();
      hinge.position.set(-(TILE / 2 - 0.16), 0, 0);
      g.add(hinge);
      var leafMat = kind === "P" ? matMetal
                  : kind === "D" ? surface("metal", { repeat: 1, rough: 0.5, metal: 0.6, tint: 0x8a6a3a })
                  : matWood;
      var leaf = new THREE.Mesh(new THREE.BoxGeometry(TILE - 0.34, 2.44, 0.10), leafMat);
      leaf.position.set((TILE - 0.34) / 2, 1.22 - 0.15, 0);
      leaf.castShadow = true; leaf.receiveShadow = true;
      hinge.add(leaf);
      var knob = new THREE.Mesh(new THREE.SphereGeometry(0.075, 8, 6),
        new THREE.MeshStandardMaterial({ color: 0xb59a5c, roughness: 0.3, metalness: 0.8 }));
      knob.position.set(TILE - 0.56, 1.16, 0.10);
      hinge.add(knob);

      if (kind === "D") {
        /* the keypad, screwed on at eye height */
        var kp = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.36, 0.07),
          new THREE.MeshStandardMaterial({ color: 0x30343c, roughness: 0.5, metalness: 0.4,
            emissive: new THREE.Color(0x223322), emissiveIntensity: 0.6 }));
        kp.position.set(TILE / 2 - 0.42, 1.42, 0.2);
        g.add(kp);
      }
      if (kind === "P") {
        var led = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 5),
          new THREE.MeshBasicMaterial({ color: 0xcc3322 }));
        led.position.set(TILE / 2 - 0.42, 1.5, 0.2);
        g.add(led);
        g.userData.led = led;
      }
      G.add(g);
      var d = { x: x, y: y, kind: kind, group: g, hinge: hinge, open: 0, want: 0, locked: kind !== "d" };
      world.doors.push(d);
      return d;
    }

    /* ---------- the furniture ---------- */
    function bed(x, y) {
      var t = hash2(x, y);
      var g = new THREE.Group();
      g.position.set(cx(x), 0, cz(y));
      g.rotation.y = isSolidChar(at(x, y - 1)) || isSolidChar(at(x, y + 1)) ? 0 : Math.PI / 2;
      var frame = new THREE.Mesh(new THREE.BoxGeometry(TILE * 0.82, 0.34, TILE * 0.94),
        def.theme === "hospital" ? matMetal : matWood);
      frame.position.y = 0.20; frame.castShadow = true; g.add(frame);
      var mat = new THREE.Mesh(new THREE.BoxGeometry(TILE * 0.74, 0.22, TILE * 0.86),
        new THREE.MeshStandardMaterial({
          color: def.theme === "hospital" ? 0xd6dee2 : 0xc9c2d4, roughness: 0.98,
          map: tex("cloth", 128, 1), bumpMap: bump("cloth", 128, 1), bumpScale: 0.2 }));
      mat.position.y = 0.46; mat.castShadow = true; g.add(mat);
      /* the blanket, thrown back on one side */
      var bl = new THREE.Mesh(new THREE.BoxGeometry(TILE * 0.76, 0.12, TILE * 0.54),
        new THREE.MeshStandardMaterial({
          color: def.theme === "hospital" ? 0x9aa8b0 : 0x53406a, roughness: 0.99,
          map: tex("cloth", 128, 2), bumpMap: bump("cloth", 128, 2), bumpScale: 0.4 }));
      bl.position.set(0, 0.60, TILE * 0.16 * (t > 0.5 ? 1 : -1));
      bl.rotation.y = (t - 0.5) * 0.1;
      bl.castShadow = true; g.add(bl);
      var pil = new THREE.Mesh(new THREE.BoxGeometry(TILE * 0.42, 0.14, TILE * 0.24),
        new THREE.MeshStandardMaterial({ color: 0xe6e2dc, roughness: 0.99 }));
      pil.position.set(0, 0.62, -TILE * 0.30);
      g.add(pil);
      /* the headboard, or the hospital's rails */
      if (def.theme === "hospital") {
        [-1, 1].forEach(function (s) {
          var r = new THREE.Mesh(new THREE.BoxGeometry(TILE * 0.7, 0.05, 0.05), matMetal);
          r.position.set(0, 0.72, s * TILE * 0.36); g.add(r);
          [-0.3, 0.3].forEach(function (o) {
            var v = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.3, 0.05), matMetal);
            v.position.set(o * TILE, 0.58, s * TILE * 0.36); g.add(v);
          });
        });
      } else {
        var hb = new THREE.Mesh(new THREE.BoxGeometry(TILE * 0.82, 0.7, 0.12), matWood);
        hb.position.set(0, 0.55, -TILE * 0.46); hb.castShadow = true; g.add(hb);
      }
      G.add(g);
      return g;
    }
    world.makeBed = bed;

    function sofa(x, y) {
      var g = new THREE.Group();
      g.position.set(cx(x), 0, cz(y));
      var uph = new THREE.MeshStandardMaterial({ color: 0x4a3c52, roughness: 0.99,
        map: tex("cloth", 128, 2), bumpMap: bump("cloth", 128, 2), bumpScale: 0.3 });
      var seat = new THREE.Mesh(new THREE.BoxGeometry(TILE * 0.94, 0.44, TILE * 0.8), uph);
      seat.position.y = 0.34; seat.castShadow = true; g.add(seat);
      var back = new THREE.Mesh(new THREE.BoxGeometry(TILE * 0.94, 0.56, 0.28), uph);
      back.position.set(0, 0.72, -TILE * 0.32); back.castShadow = true; g.add(back);
      G.add(g);
      return g;
    }

    function counter(x, y, tall) {
      var t = hash2(x * 3, y);
      var body = new THREE.Mesh(new THREE.BoxGeometry(TILE * 0.96, tall ? 1.5 : 0.86, TILE * 0.96),
        def.theme === "hospital" ? surface("block", { repeat: 1, tint: 0xbcc4c8 }) : matWood);
      body.position.set(cx(x), (tall ? 1.5 : 0.86) / 2 - 0.15, cz(y));
      body.castShadow = true; body.receiveShadow = true;
      G.add(body);
      if (!tall) {
        var top = new THREE.Mesh(new THREE.BoxGeometry(TILE * 1.0, 0.08, TILE * 1.0),
          surface("metal", { repeat: 1, rough: 0.35, metal: 0.5, tint: 0x9aa0a8 }));
        top.position.set(cx(x), 0.78, cz(y)); top.castShadow = true; G.add(top);
      }
      return body;
    }

    function wardrobe(x, y) {
      var g = new THREE.Group();
      g.position.set(cx(x), 0, cz(y));
      var box = new THREE.Mesh(new THREE.BoxGeometry(TILE * 0.9, 2.35, TILE * 0.72), matWood);
      box.position.y = 2.35 / 2 - 0.15; box.castShadow = true; box.receiveShadow = true;
      g.add(box);
      /* two doors with a gap, and handles */
      [-1, 1].forEach(function (s) {
        var d = new THREE.Mesh(new THREE.BoxGeometry(TILE * 0.42, 2.1, 0.05),
          surface("boards", { repeat: 1, tint: 0xd8c4a4 }));
        d.position.set(s * TILE * 0.22, 1.05, TILE * 0.37);
        g.add(d);
        var h = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.16, 6),
          new THREE.MeshStandardMaterial({ color: 0xb59a5c, metalness: 0.8, roughness: 0.3 }));
        h.position.set(s * TILE * 0.06, 1.1, TILE * 0.41);
        g.add(h);
      });
      G.add(g);
      return g;
    }

    /* the one she can get inside: back, sides and a top, and the doors
       standing open, so the player can still see where she is */
    function openWardrobe(x, y) {
      var g = new THREE.Group();
      g.position.set(cx(x), 0, cz(y));
      g.rotation.y = faceOpen(x, y);      /* the opening looks into the room */
      var carc = surface("boards", { repeat: 1, tint: 0xb59470 });
      var back = new THREE.Mesh(new THREE.BoxGeometry(TILE * 0.9, 2.35, 0.1), carc);
      back.position.set(0, 1.02, -TILE * 0.4); back.castShadow = true; g.add(back);
      [-1, 1].forEach(function (sd) {
        var side = new THREE.Mesh(new THREE.BoxGeometry(0.1, 2.35, TILE * 0.8), carc);
        side.position.set(sd * TILE * 0.44, 1.02, 0); side.castShadow = true; g.add(side);
        /* the door, standing open against the side */
        var dr = new THREE.Mesh(new THREE.BoxGeometry(0.06, 2.1, TILE * 0.4), carc);
        dr.position.set(sd * TILE * 0.60, 1.02, TILE * 0.22);
        dr.rotation.y = sd * 0.5;
        dr.castShadow = true; g.add(dr);
      });
      var top = new THREE.Mesh(new THREE.BoxGeometry(TILE * 0.98, 0.12, TILE * 0.86), carc);
      top.position.set(0, 2.22, 0); top.castShadow = true; g.add(top);
      var rail = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, TILE * 0.8, 6),
        new THREE.MeshStandardMaterial({ color: 0x9a9088, metalness: 0.7, roughness: 0.35 }));
      rail.rotation.z = Math.PI / 2; rail.position.set(0, 1.9, -0.1); g.add(rail);
      /* a couple of coats still on it */
      for (var i = 0; i < 3; i++) {
        var coat = new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.0, TILE * 0.5),
          new THREE.MeshStandardMaterial({ color: [0x3a4258, 0x5a3a42, 0x2e3830][i], roughness: 0.99,
            map: tex("cloth", 128, 2), bumpMap: bump("cloth", 128, 2), bumpScale: 0.3 }));
        coat.position.set(-TILE * 0.28 + i * 0.22, 1.3, -0.14);
        coat.castShadow = true; g.add(coat);
      }
      G.add(g);
      return g;
    }

    function bush(x, y) {
      var g = new THREE.Group();
      g.position.set(cx(x), 0, cz(y));
      for (var i = 0; i < 5; i++) {
        var t = hash2(x + i * 3, y + i);
        var r = 0.42 + t * 0.4;
        var m = new THREE.Mesh(geo("canopyI", function () { return new THREE.IcosahedronGeometry(1, 1); }), matLeaf);
        m.position.set((hash2(x, y + i) - 0.5) * TILE * 0.8, 0.3 + t * 0.55,
                       (hash2(x + i, y * 2) - 0.5) * TILE * 0.8);
        m.scale.set(r, r * 0.85, r);
        m.rotation.set(t * 3, t * 6, t * 2);
        m.castShadow = true;
        g.add(m);
      }
      G.add(g);
      return g;
    }

    function medical(x, y, big) {
      var g = new THREE.Group();
      g.position.set(cx(x), 0, cz(y));
      var greyM = surface("metal", { repeat: 1, rough: 0.45, metal: 0.55, tint: 0xb0b8bc });
      if (big) {
        var col = new THREE.Mesh(new THREE.BoxGeometry(TILE * 0.6, 1.5, TILE * 0.6), greyM);
        col.position.y = 0.6; col.castShadow = true; g.add(col);
        var scr = new THREE.Mesh(new THREE.BoxGeometry(TILE * 0.5, 0.42, 0.14),
          new THREE.MeshStandardMaterial({ color: 0x0d1416, roughness: 0.2,
            emissive: new THREE.Color(0x1c4a3c), emissiveIntensity: 1.2 }));
        scr.position.set(0, 1.55, TILE * 0.3); g.add(scr);
        var pole = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 1.9, 6), greyM);
        pole.position.set(TILE * 0.3, 0.9, 0); g.add(pole);
        var bag = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.3, 0.1),
          new THREE.MeshStandardMaterial({ color: 0xc8d8c8, transparent: true, opacity: 0.7, roughness: 0.3 }));
        bag.position.set(TILE * 0.3, 1.7, 0); g.add(bag);
      } else {
        /* a trolley on its side, a dropped tray, a chair — debris */
        var t = hash2(x * 5, y * 9);
        var b = new THREE.Mesh(new THREE.BoxGeometry(TILE * 0.55, 0.5, TILE * 0.4), greyM);
        b.position.set((t - 0.5) * 0.5, 0.16, (hash2(y, x) - 0.5) * 0.5);
        b.rotation.set(t * 1.2, t * 3, (hash2(x, y * 3) - 0.5) * 1.6);
        b.castShadow = true; g.add(b);
        for (var i = 0; i < 3; i++) {
          var s = 0.12 + hash2(x + i, y) * 0.1;
          var p = new THREE.Mesh(new THREE.BoxGeometry(s, s * 0.4, s), greyM);
          p.position.set((hash2(x + i, y) - 0.5) * TILE * 0.8, 0.05,
                         (hash2(x, y + i) - 0.5) * TILE * 0.8);
          p.rotation.y = hash2(i, x) * 6;
          g.add(p);
        }
      }
      G.add(g);
      return g;
    }

    function smallProp(x, y, kind) {
      var g = new THREE.Group();
      g.position.set(cx(x), 0, cz(y));
      var t = hash2(x * 13, y * 7);
      if (kind === "n") {
        var b = new THREE.Mesh(new THREE.BoxGeometry(TILE * 0.5, 0.62, TILE * 0.5), matWood);
        b.position.y = 0.16; b.castShadow = true; g.add(b);
      } else if (kind === "u") {
        var seat = new THREE.Mesh(new THREE.BoxGeometry(TILE * 0.42, 0.08, TILE * 0.42), matWood);
        seat.position.y = 0.42; seat.castShadow = true; g.add(seat);
        var bk = new THREE.Mesh(new THREE.BoxGeometry(TILE * 0.42, 0.6, 0.07), matWood);
        bk.position.set(0, 0.72, -TILE * 0.18); g.add(bk);
        [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function (p) {
          var l = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.42, 0.07), matWood);
          l.position.set(p[0] * TILE * 0.16, 0.06, p[1] * TILE * 0.16); g.add(l);
        });
      } else if (kind === "q" || kind === "i") {
        var box = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.28, 0.3),
          surface("cloth", { repeat: 1, tint: 0x9a8a6a }));
        box.position.set((t - 0.5) * 0.6, 0.0, (hash2(y, x) - 0.5) * 0.6);
        box.rotation.y = t * 6; box.castShadow = true; g.add(box);
      } else if (kind === "r") {
        var rug = new THREE.Mesh(new THREE.BoxGeometry(TILE, 0.04, TILE),
          new THREE.MeshStandardMaterial({ color: 0x7a3a44, roughness: 0.99,
            map: tex("carpet", 128, 1), bumpMap: bump("carpet", 128, 1), bumpScale: 0.3 }));
        rug.position.y = 0.015; rug.receiveShadow = true; g.add(rug);
      } else if (kind === "f") {
        var fr = new THREE.Mesh(new THREE.BoxGeometry(TILE * 0.8, 1.9, TILE * 0.72),
          surface("metal", { repeat: 1, rough: 0.3, metal: 0.6, tint: 0xd0d4d8 }));
        fr.position.y = 0.8; fr.castShadow = true; g.add(fr);
        var hd = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.6, 0.05),
          new THREE.MeshStandardMaterial({ color: 0x8a8f96, metalness: 0.8, roughness: 0.3 }));
        hd.position.set(TILE * 0.28, 1.0, TILE * 0.38); g.add(hd);
      } else if (kind === "y") {
        return medical(x, y, false);
      }
      G.add(g);
      return g;
    }

    /* ---------- the things the story happens at ---------- */

    /* the broadcast is painted into one canvas and used twice: as the
       glass of the set in the world, and full-frame in the overlay */
    var tvCanvas = null;
    function tvSurface() {
      if (!tvCanvas) { tvCanvas = document.createElement("canvas"); tvCanvas.width = 256; tvCanvas.height = 168; }
      return tvCanvas;
    }
    world.tvCanvas = tvSurface();

    function television(x, y) {
      var g = new THREE.Group();
      g.position.set(cx(x), 0, cz(y));
      /* face it into the room */
      var openDir = faceOpen(x, y);
      g.rotation.y = openDir;

      var shell = new THREE.Mesh(new THREE.BoxGeometry(1.35, 1.0, 0.72),
        surface("cloth", { repeat: 1, tint: 0x4a4238, rough: 0.7 }));
      shell.position.y = 0.85; shell.castShadow = true; g.add(shell);
      var stand = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.36, 0.6), matWood);
      stand.position.y = 0.18; stand.castShadow = true; g.add(stand);

      var t = new THREE.CanvasTexture(tvSurface());
      t.colorSpace = THREE.SRGBColorSpace;
      world.tvTexture = t;
      var screen = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.72),
        new THREE.MeshBasicMaterial({ map: t, toneMapped: false }));
      screen.position.set(0, 0.90, 0.365); g.add(screen);

      var glow = new THREE.Sprite(new THREE.SpriteMaterial({
        map: glowTexture(), color: 0x8fd0ff, blending: THREE.AdditiveBlending,
        transparent: true, depthWrite: false, opacity: 0.5 }));
      glow.scale.set(4.4, 3.4, 1); glow.position.set(0, 0.95, 0.7); g.add(glow);
      world.tvGlow = glow;

      G.add(g);
      world.lamps.push({ x: cx(x) + Math.sin(openDir) * 0.9, y: 1.1, z: cz(y) + Math.cos(openDir) * 0.9,
                         colour: 0x7ec0ff, power: 1.9, range: 8, kind: "tv", tx: x, ty: y, flicker: 0.5 });
      world.things.push({ kind: "tv", x: x, y: y, group: g });
      return g;
    }

    function wirePanel(x, y) {
      var g = new THREE.Group();
      g.position.set(cx(x), 0, cz(y));
      g.rotation.y = faceOpen(x, y);
      var box = new THREE.Mesh(new THREE.BoxGeometry(1.3, 1.5, 0.42),
        surface("metal", { repeat: 1, rough: 0.5, metal: 0.6, tint: 0x8a8f96 }));
      box.position.y = 1.45; box.castShadow = true; g.add(box);
      var doorP = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.4, 0.06),
        surface("metal", { repeat: 1, rough: 0.4, metal: 0.7, tint: 0x6a707a }));
      doorP.position.set(0.55, 1.45, 0.30); doorP.rotation.y = -1.1; g.add(doorP);
      /* the guts: sockets that glow */
      for (var i = 0; i < 4; i++) {
        var s = new THREE.Mesh(new THREE.SphereGeometry(0.06, 7, 6),
          new THREE.MeshBasicMaterial({ color: [0xff5a5a, 0x5aff8a, 0x5aa0ff, 0xffd75a][i] }));
        s.position.set(-0.36 + i * 0.24, 1.72, 0.22); g.add(s);
      }
      var warn = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.5),
        new THREE.MeshBasicMaterial({ color: 0xd8c040, toneMapped: false }));
      warn.position.set(0, 0.95, 0.215); g.add(warn);
      G.add(g);
      world.things.push({ kind: "panel", x: x, y: y, group: g });
      return g;
    }

    function noteProp(x, y) {
      var g = new THREE.Group();
      g.position.set(cx(x), 0, cz(y));
      var p = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.66),
        new THREE.MeshStandardMaterial({ color: 0xe8dcc0, roughness: 0.95, side: THREE.DoubleSide }));
      p.rotation.x = -Math.PI / 2;
      p.rotation.z = hash2(x, y) * 1.4;
      p.position.y = 0.02;
      g.add(p);
      var glow = new THREE.Sprite(new THREE.SpriteMaterial({
        map: glowTexture(), color: 0xffe8b0, blending: THREE.AdditiveBlending,
        transparent: true, depthWrite: false, opacity: 0.42 }));
      glow.scale.set(1.5, 1.5, 1); glow.position.y = 0.3; g.add(glow);
      world.anim.push(function (t) { glow.material.opacity = 0.28 + Math.sin(t * 2.4) * 0.14; });
      G.add(g);
      world.things.push({ kind: "note", x: x, y: y, group: g });
      return g;
    }

    function itemProp(x, y) {
      var g = smallProp(x, y, "i");
      var glow = new THREE.Sprite(new THREE.SpriteMaterial({
        map: glowTexture(), color: 0xa8d8ff, blending: THREE.AdditiveBlending,
        transparent: true, depthWrite: false, opacity: 0.3 }));
      glow.scale.set(1.2, 1.2, 1); glow.position.y = 0.4; g.add(glow);
      world.anim.push(function (t) { glow.material.opacity = 0.18 + Math.sin(t * 2 + x) * 0.1; });
      world.things.push({ kind: "item", x: x, y: y, group: g });
      return g;
    }

    /* ---------- the campsite ---------- */
    function firePit(x, y) {
      var g = new THREE.Group();
      g.position.set(cx(x), 0, cz(y));
      var stoneM = surface("block", { repeat: 1, tint: 0x8a8478, rough: 0.98 });
      for (var i = 0; i < 11; i++) {
        var a = i / 11 * 6.2832;
        var s = new THREE.Mesh(new THREE.DodecahedronGeometry(0.19 + hash2(x + i, y) * 0.08, 0), stoneM);
        s.position.set(Math.cos(a) * 0.78, -0.06, Math.sin(a) * 0.78);
        s.rotation.set(hash2(i, x) * 3, hash2(i, y) * 3, hash2(x, i) * 3);
        s.castShadow = true; g.add(s);
      }
      /* the cone of wood */
      var logs = new THREE.Group();
      for (var k = 0; k < 7; k++) {
        var aa = k / 7 * 6.2832;
        var l = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.075, 0.9, 6), matBark);
        l.position.set(Math.cos(aa) * 0.16, 0.28, Math.sin(aa) * 0.16);
        l.rotation.set(Math.sin(aa) * 0.42, 0, -Math.cos(aa) * 0.42);
        l.castShadow = true; logs.add(l);
      }
      g.add(logs);
      G.add(g);
      var fire = makeFire();
      fire.position.set(cx(x), 0.1, cz(y));
      fire.visible = false;
      G.add(fire);
      world.fire = fire;
      world.firePitAt = { x: x, y: y };
      world.things.push({ kind: "pit", x: x, y: y, group: g });
      return g;
    }

    function woodpile(x, y) {
      var g = new THREE.Group();
      g.position.set(cx(x), 0, cz(y));
      for (var i = 0; i < 6; i++) {
        var t = hash2(x + i, y * 3);
        var l = new THREE.Mesh(new THREE.CylinderGeometry(0.06 + t * 0.03, 0.07 + t * 0.03, 0.7 + t * 0.5, 6), matBark);
        l.position.set((t - 0.5) * 0.9, -0.06 + (i % 3) * 0.12, (hash2(i, x) - 0.5) * 0.9);
        l.rotation.set(Math.PI / 2, hash2(i, y) * 3.14, 0);
        l.castShadow = true; g.add(l);
      }
      G.add(g);
      world.things.push({ kind: "wood", x: x, y: y, group: g });
      return g;
    }

    function bedroll(x, y) {
      var g = new THREE.Group();
      g.position.set(cx(x), 0, cz(y));
      var r = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 1.7, 10),
        new THREE.MeshStandardMaterial({ color: 0x4a5a48, roughness: 0.99,
          map: tex("cloth", 128, 2), bumpMap: bump("cloth", 128, 2), bumpScale: 0.3 }));
      r.rotation.z = Math.PI / 2; r.position.y = 0.15; r.castShadow = true;
      g.add(r);
      G.add(g);
      return g;
    }

    function stream(x, y) {
      /* something dark under the water, or it is a blue pane on grass */
      var bed = new THREE.Mesh(
        geo("streamBed", function () { return new THREE.BoxGeometry(TILE, 0.16, TILE); }),
        surface("dirt", { repeat: 1, tint: 0x3a3428, rough: 0.99 }));
      bed.position.set(cx(x), -0.04, cz(y));
      G.add(bed);
      var m = new THREE.MeshStandardMaterial({
        color: 0x2c5e78, roughness: 0.16, metalness: 0.12,
        emissive: new THREE.Color(0x14384c), emissiveIntensity: 1.0,
        transparent: true, opacity: 0.9
      });
      var p = new THREE.Mesh(new THREE.PlaneGeometry(TILE, TILE, 4, 4), m);
      p.rotation.x = -Math.PI / 2;
      p.position.set(cx(x), 0.015, cz(y));
      p.receiveShadow = true;
      var base = p.geometry.attributes.position.array.slice();
      world.anim.push(function (t) {
        var a = p.geometry.attributes.position.array;
        for (var i = 0; i < a.length; i += 3) {
          a[i + 2] = Math.sin(t * 2.2 + base[i] * 2 + base[i + 1] * 3 + x) * 0.045;
        }
        p.geometry.attributes.position.needsUpdate = true;
        p.geometry.computeVertexNormals();
      });
      G.add(p);
      /* wet stones along the bank */
      for (var i = 0; i < 3; i++) {
        var s = new THREE.Mesh(new THREE.DodecahedronGeometry(0.12 + hash2(x + i, y) * 0.1, 0),
          surface("block", { repeat: 1, tint: 0x6a6a68, rough: 0.4 }));
        s.position.set(cx(x) + (hash2(x, y + i) - 0.5) * TILE, 0.03, cz(y) + (hash2(i, y) - 0.5) * TILE);
        G.add(s);
      }
      return p;
    }

    /* ---------- what a week of this leaves lying about ---------- */
    function wheelieBin(wx, wz, rot, tipped) {
      var g = new THREE.Group();
      g.position.set(wx, 0, wz);
      g.rotation.y = rot;
      var body = new THREE.Mesh(roundBox(0.62, 0.98, 0.52, 0.06, 2),
        surface("cloth", { size: 256, rough: 0.62, tint: 0x33403a, envInt: 0.6 }));
      body.position.y = 0.50;
      var lid = new THREE.Mesh(roundBox(0.66, 0.09, 0.56, 0.03, 2),
        surface("cloth", { size: 256, rough: 0.62, tint: 0x2a352f, envInt: 0.6 }));
      lid.position.y = 1.02;
      g.add(body); g.add(lid);
      [-1, 1].forEach(function (sd) {
        var wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.06, 10),
          new THREE.MeshStandardMaterial({ color: 0x1a1a1c, roughness: 0.9 }));
        wheel.rotation.z = Math.PI / 2;
        wheel.position.set(-0.24, 0.09, sd * 0.20);
        g.add(wheel);
      });
      if (tipped) { g.rotation.z = Math.PI / 2 * 0.92; g.position.y = 0.30; }
      g.traverse(function (o) { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
      G.add(g);
      return g;
    }

    function trafficCone(wx, wz) {
      var g = new THREE.Group();
      g.position.set(wx, 0, wz);
      var cone = new THREE.Mesh(new THREE.ConeGeometry(0.19, 0.52, 12),
        new THREE.MeshStandardMaterial({ color: 0xd85a1e, roughness: 0.66, envMapIntensity: 0.8 }));
      cone.position.y = 0.28;
      var band = new THREE.Mesh(new THREE.CylinderGeometry(0.135, 0.155, 0.09, 12),
        new THREE.MeshStandardMaterial({ color: 0xe8ecf0, roughness: 0.3, metalness: 0.1, envMapIntensity: 2.0 }));
      band.position.y = 0.30;
      var base = new THREE.Mesh(roundBox(0.34, 0.05, 0.34, 0.02, 2),
        new THREE.MeshStandardMaterial({ color: 0x1e1c1a, roughness: 0.9 }));
      base.position.y = 0.025;
      g.add(cone); g.add(band); g.add(base);
      if (hash2(wx * 3, wz * 7) > 0.7) { g.rotation.z = 1.4; g.position.y = 0.16; }
      g.traverse(function (o) { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
      G.add(g);
      return g;
    }

    /* ---------- the gates ---------- */
    function gate(x, y) {
      var g = new THREE.Group();
      g.position.set(cx(x), 0, cz(y));
      var horiz = isSolidChar(at(x - 1, y)) && isSolidChar(at(x + 1, y));
      if (!horiz) g.rotation.y = Math.PI / 2;
      var frameM = surface("metal", { repeat: 1, rough: 0.55, metal: 0.7, tint: 0x7a8088 });
      [-1, 1].forEach(function (s) {
        var p = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, 3.2, 8), frameM);
        p.position.set(s * (TILE / 2 - 0.08), 1.45, 0); p.castShadow = true; g.add(p);
      });
      var slide = new THREE.Group();
      g.add(slide);
      /* chain-link: a grid of thin bars reads as mesh at this distance */
      for (var i = 0; i < 9; i++) {
        var b = new THREE.Mesh(new THREE.BoxGeometry(0.045, 2.7, 0.045), frameM);
        b.position.set(-TILE / 2 + 0.2 + i * (TILE - 0.4) / 8, 1.35, 0);
        slide.add(b);
      }
      for (var j = 0; j < 5; j++) {
        var h = new THREE.Mesh(new THREE.BoxGeometry(TILE - 0.3, 0.045, 0.045), frameM);
        h.position.set(0, 0.3 + j * 0.62, 0);
        slide.add(h);
      }
      var razor = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.02, 5, 12), frameM);
      razor.position.set(0, 3.0, 0); razor.rotation.y = 0.4; g.add(razor);
      G.add(g);
      var d = { x: x, y: y, kind: "G", group: g, slide: slide, open: 0, want: 0, locked: true };
      world.doors.push(d);
      return d;
    }

    function desk(x, y) {
      var g = new THREE.Group();
      g.position.set(cx(x), 0, cz(y));
      var top = new THREE.Mesh(new THREE.BoxGeometry(TILE * 1.1, 0.1, TILE * 0.7), matWood);
      top.position.y = 0.78; top.castShadow = true; g.add(top);
      [-1, 1].forEach(function (s) {
        var l = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.9, TILE * 0.6), matWood);
        l.position.set(s * TILE * 0.46, 0.3, 0); g.add(l);
      });
      var lamp = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6),
        new THREE.MeshBasicMaterial({ color: 0xfff0c0 }));
      lamp.position.set(TILE * 0.3, 0.95, 0); g.add(lamp);
      G.add(g);
      world.lamps.push({ x: cx(x), y: 1.1, z: cz(y), colour: 0xffe0b0, power: 1.4, range: 6,
                         kind: "desk", tx: x, ty: y });
      world.things.push({ kind: "desk", x: x, y: y, group: g });
      return g;
    }

    /* the way out, marked so it can be found in the dark */
    function exitMark(x, y) {
      var g = new THREE.Group();
      g.position.set(cx(x), 0, cz(y));
      var ring = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.78, 24),
        new THREE.MeshBasicMaterial({ color: 0x8affc8, transparent: true, opacity: 0.42,
          side: THREE.DoubleSide, toneMapped: false }));
      ring.rotation.x = -Math.PI / 2; ring.position.y = 0.045; g.add(ring);
      var beam = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.72, 5.0, 14, 1, true),
        new THREE.MeshBasicMaterial({ color: 0x7affc0, transparent: true, opacity: 0.09,
          side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
      beam.position.y = 2.4; g.add(beam);
      world.anim.push(function (t) {
        ring.material.opacity = 0.3 + Math.sin(t * 2.2) * 0.16;
        beam.material.opacity = 0.06 + Math.sin(t * 2.2 + 1) * 0.035;
        ring.scale.setScalar(1 + Math.sin(t * 2.2) * 0.06);
      });
      G.add(g);
      return g;
    }

    /* ---------- lay the place out ---------- */
    var treeChance = def.theme === "campsite" ? 1.0 : def.theme === "road" ? 0.34 : 0.16;
    for (var y2 = 0; y2 < H; y2++) {
      for (var x2 = 0; x2 < W; x2++) {
        var c = at(x2, y2);
        if (c === " ") continue;
        switch (c) {
          case "#": placeWall(x2, y2, false); break;
          case "v": placeWall(x2, y2, true); break;
          case "o":
            if (world.outdoor || def.theme === "campsite" || def.theme === "road") {
              if (def.theme === "campsite" || hash2(x2 * 31, y2 * 17) < treeChance) tree(x2, y2, def.theme === "campsite");
              else hedge(x2, y2);
            } else if (def.theme === "hospital") {
              counter(x2, y2, true);
            } else {
              wardrobe(x2, y2);
            }
            break;
          case "=":
            if (def.theme === "hospital") medical(x2, y2, false);
            else {
              var t2 = hash2(x2, y2);
              B.low.add(cx(x2), TUNE.lowH / 2 - 0.15, cz(y2), 1, 0.85 + t2 * 0.4, 1,
                        (t2 - 0.5) * 0.1, shade(0xffffff, 0.8 + t2 * 0.36));
            }
            break;
          case "B": bed(x2, y2); break;
          case "F": sofa(x2, y2); break;
          case "K": counter(x2, y2, false); break;
          case "Q": desk(x2, y2); break;
          case "n": case "u": case "q": case "r": case "f": case "y":
            smallProp(x2, y2, c); break;
          case "Y": medical(x2, y2, true); break;
          case "c": parkedCar(x2, y2); break;
          case "C":
            world.carAt = { x: x2, y: y2 };
            world.carMesh = (function () {
              var m = makeCar(0x8a3a44, false);
              m.position.set(cx(x2), 0, cz(y2));
              m.rotation.y = -0.2;
              G.add(m); return m;
            })();
            break;
          case "h":
            if (def.theme === "street" || def.theme === "road" || def.theme === "campsite") bush(x2, y2);
            else if (def.theme === "hospital") {
              /* a curtain on a rail — the hospital's only privacy */
              var cur = new THREE.Mesh(new THREE.BoxGeometry(TILE * 0.9, 2.0, 0.1),
                new THREE.MeshStandardMaterial({ color: 0x7a9aa8, roughness: 0.99,
                  map: tex("cloth", 128, 3), bumpMap: bump("cloth", 128, 3), bumpScale: 0.5 }));
              cur.position.set(cx(x2), 1.0, cz(y2) - TILE * 0.42);
              cur.castShadow = true; G.add(cur);
            } else {
              openWardrobe(x2, y2);
            }
            break;
          case "j": openWardrobe(x2, y2); break;
          case "l": floorLamp(x2, y2); break;
          case "L": lampPost(x2, y2); break;
          case "d": case "D": case "P": door(x2, y2, c); break;
          case "G": gate(x2, y2); break;
          case "W": wirePanel(x2, y2); break;
          case "T": television(x2, y2); break;
          case "N": noteProp(x2, y2); break;
          case "i": itemProp(x2, y2); break;
          case "w": woodpile(x2, y2); break;
          case "b": bedroll(x2, y2); break;
          case "g": world.things.push({ kind: "gather", x: x2, y: y2 }); break;
          case "~": stream(x2, y2); break;
          case "S": world.spawn = { x: x2, y: y2 }; break;
          case "X": world.exit = { x: x2, y: y2 }; exitMark(x2, y2); break;
          case "A": world.anwarAt = { x: x2, y: y2 }; break;
          case "H": world.horseAt = { x: x2, y: y2 }; break;
        }
      }
    }
    /* Rubble against the walls, litter blowing about, a bin somebody put
       out and nobody collected, cones round a hole nobody came back to
       fix. All of it instanced or counted, so it costs almost nothing. */
    if (world.outdoor && def.theme !== "campsite") {
      var bins = 0, cones = 0;
      for (var dy = 0; dy < H; dy++) {
        for (var dx = 0; dx < W; dx++) {
          var dc = at(dx, dy);
          if (dc === " " || isSolidChar(dc)) continue;
          var r0 = hash2(dx * 91 + 5, dy * 47 + 11);

          var wallDir = null;
          var nbs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
          for (var wq = 0; wq < 4; wq++) {
            var nc = at(dx + nbs[wq][0], dy + nbs[wq][1]);
            if (nc === "#" || nc === "v") wallDir = nbs[wq];
          }
          /* rubble piles up where a wall meets the ground */
          if (wallDir && r0 > 0.55) {
            var n0 = 3 + Math.floor(r0 * 5);
            for (var q = 0; q < n0; q++) {
              var rr = 0.10 + hash2(dx + q, dy * 3) * 0.20;
              B.rubble.add(
                cx(dx) + wallDir[0] * (TILE * 0.34) + (hash2(q, dx) - 0.5) * TILE * 0.7,
                rr * 0.5,
                cz(dy) + wallDir[1] * (TILE * 0.34) + (hash2(dy, q) - 0.5) * TILE * 0.7,
                rr, rr * 0.72, rr, hash2(q, dy) * 6.28,
                shade(0xffffff, 0.7 + hash2(q, dx + dy) * 0.5));
            }
          }
          /* litter, flat on the ground */
          if (r0 > 0.72) {
            var ln = 2 + Math.floor(hash2(dy, dx) * 4);
            for (var l = 0; l < ln; l++) {
              var ls = 0.10 + hash2(l, dx) * 0.16;
              B.litter.add(cx(dx) + (hash2(l * 3, dy) - 0.5) * TILE * 0.85,
                           0.045,
                           cz(dy) + (hash2(dx, l * 5) - 0.5) * TILE * 0.85,
                           ls, ls * (0.5 + hash2(l, dy) * 0.8), 1,
                           hash2(l, dy) * 6.28,
                           shade(0xffffff, 0.55 + hash2(l, dx) * 0.6));
            }
          }
          if (r0 > 0.955 && bins < 9) {
            bins++;
            wheelieBin(cx(dx) + (r0 - 0.5) * 0.6, cz(dy), hash2(dx, dy) * 6.28,
                       hash2(dy * 7, dx * 5) > 0.55);
          } else if (r0 > 0.93 && cones < 12) {
            cones++;
            trafficCone(cx(dx) + (hash2(dx, dy) - 0.5) * TILE * 0.6,
                        cz(dy) + (hash2(dy, dx) - 0.5) * TILE * 0.6);
          }
        }
      }
    }

    /* the campsite's fire pit is not in the grid — it goes in the middle
       of the flat ground, where she would actually build one */
    if (def.theme === "campsite") firePit(14, 12);

    Object.keys(B).forEach(function (k) { world[k + "Mesh"] = B[k].build(G); });

    /* ---------- a little life in the air ---------- */
    world.motes = makeMotes(def.theme === "campsite" ? 0xffcf90 : 0xbfd0ff,
                            def.theme === "campsite" ? 260 : 200,
                            W * TILE, H * TILE);
    G.add(world.motes.points);

    /* =========== the lights =========== */
    /* The night levels are lit by one thing she cannot turn off: the sky.
       It has to be strong enough that a wall reads as a wall from above —
       lit along the top, dark down the side — or the whole floor plan
       disappears and the torch is drawing on black. */
    var bal = lightBalance(pal);
    world.balance = bal;
    var amb = new THREE.HemisphereLight(
      shade(pal.sky, 2.8), shade(pal.ambient, 1.6),
      (def.dark > 0.6 ? 1.05 : def.dark > 0.45 ? 1.5 : 2.3) * bal * (def.base === "," ? 1.6 : 1));
    G.add(amb);
    world.hemi = amb;
    /* the last few percent, so an unlit corner is still a corner and not
       a hole cut in the picture */
    /* outdoors there is always something in the sky — cloud lit from
       underneath by a city that has not entirely gone out */
    var fillAmt = (def.dark > 0.6 ? 0.22 : 0.30) * bal * (def.base === "," ? 2.4 : 1);
    var floorFill = new THREE.AmbientLight(shade(pal.sky, 1.9), fillAmt);
    G.add(floorFill);

    /* the one big directional light: moonlight, or the sun at the gates.
       Only the outdoor levels get a shadow out of it — indoors the
       torch does that job and two shadow maps is one too many. */
    var key = new THREE.DirectionalLight(pal.key,
      (def.dark > 0.6 ? 0.62 : def.dark > 0.4 ? 1.15 : 2.2) * bal);
    key.position.set(W * TILE * 0.3, 46, -H * TILE * 0.25);
    key.target.position.set(W * TILE * 0.5, 0, H * TILE * 0.5);
    G.add(key); G.add(key.target);
    if (def.dark <= 0.45) {
      key.castShadow = true;
      key.shadow.mapSize.set(1024, 1024);
      var span = Math.max(W, H) * TILE * 0.6;
      key.shadow.camera.left = -span; key.shadow.camera.right = span;
      key.shadow.camera.top = span; key.shadow.camera.bottom = -span;
      key.shadow.camera.far = 140;
      key.shadow.bias = -0.0016;
      key.shadow.normalBias = 0.04;
    }
    world.key = key;

    /* a pool of point lights, moved to whichever lamps are nearest her.
       Eight is plenty — she can only ever see a handful at once. */
    world.pool = [];
    for (var pi = 0; pi < 8; pi++) {
      var pl = new THREE.PointLight(0xffffff, 0, 12, 1.8);
      pl.visible = false;
      G.add(pl);
      world.pool.push(pl);
    }

    return world;
  }

  /* dust hanging in the air. It is a point cloud that drifts and
     twinkles; in a torch beam it is the thing that sells the beam. */
  function makeMotes(colour, count, spanX, spanZ) {
    var g = new THREE.BufferGeometry();
    var pos = new Float32Array(count * 3), pha = new Float32Array(count), siz = new Float32Array(count);
    for (var i = 0; i < count; i++) {
      pos[i * 3] = Math.random() * spanX;
      pos[i * 3 + 1] = rnd(0.2, 3.6);
      pos[i * 3 + 2] = Math.random() * spanZ;
      pha[i] = Math.random() * 6.2832;
      siz[i] = rnd(1.5, 5.5);
    }
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("aPhase", new THREE.BufferAttribute(pha, 1));
    g.setAttribute("aSize", new THREE.BufferAttribute(siz, 1));
    var u = {
      time: { value: 0 }, near: { value: new THREE.Vector3() },
      tint: { value: new THREE.Color(colour) }, amt: { value: 1 }
    };
    var m = new THREE.ShaderMaterial({
      uniforms: u, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: [
        "attribute float aPhase; attribute float aSize;",
        "uniform float time; uniform vec3 near;",
        "varying float vF;",
        "void main(){",
        "  vec3 p = position;",
        "  p.x += sin(time*0.35 + aPhase)*0.5;",
        "  p.y += sin(time*0.22 + aPhase*1.7)*0.35;",
        "  p.z += cos(time*0.30 + aPhase*0.8)*0.5;",
        /* only the ones near her are worth drawing */
        "  float d = distance(p, near);",
        "  vF = 1.0 - smoothstep(3.0, 11.0, d);",
        "  vec4 mv = modelViewMatrix * vec4(p,1.0);",
        "  gl_PointSize = min(aSize * (18.0 / max(1.0,-mv.z)), 9.0);",
        "  gl_Position = projectionMatrix * mv;",
        "}"
      ].join("\n"),
      fragmentShader: [
        "uniform vec3 tint; uniform float amt; varying float vF;",
        "void main(){",
        "  float a = smoothstep(0.5, 0.05, length(gl_PointCoord-0.5));",
        "  gl_FragColor = vec4(tint, a*vF*0.34*amt);",
        "}"
      ].join("\n")
    });
    var p = new THREE.Points(g, m);
    p.frustumCulled = false;
    return { points: p, u: u };
  }

  /* =========================================================
     15 — FIRE
     Two hundred points climbing and cooling, a light that
     flickers on a noise curve rather than a random number so it
     breathes instead of strobing, and smoke above it.
     ========================================================= */
  function makeFire() {
    var g = new THREE.Group();
    var COUNT = 220;
    var geoF = new THREE.BufferGeometry();
    var pos = new Float32Array(COUNT * 3), life = new Float32Array(COUNT),
        spd = new Float32Array(COUNT), sway = new Float32Array(COUNT), siz = new Float32Array(COUNT);
    for (var i = 0; i < COUNT; i++) {
      pos[i * 3] = rnd(-0.3, 0.3); pos[i * 3 + 1] = rnd(0, 1.2); pos[i * 3 + 2] = rnd(-0.3, 0.3);
      life[i] = Math.random(); spd[i] = rnd(0.9, 2.1); sway[i] = Math.random() * 6.28; siz[i] = rnd(3, 10);
    }
    geoF.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geoF.setAttribute("aLife", new THREE.BufferAttribute(life, 1));
    geoF.setAttribute("aSpeed", new THREE.BufferAttribute(spd, 1));
    geoF.setAttribute("aSway", new THREE.BufferAttribute(sway, 1));
    geoF.setAttribute("aSize", new THREE.BufferAttribute(siz, 1));
    var u = { time: { value: 0 }, scale: { value: 1 } };
    var mat = new THREE.ShaderMaterial({
      uniforms: u, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: [
        "attribute float aLife; attribute float aSpeed; attribute float aSway; attribute float aSize;",
        "uniform float time; uniform float scale;",
        "varying float vL;",
        "void main(){",
        "  float l = fract(aLife + time*aSpeed*0.32);",
        "  vL = l;",
        "  vec3 p = position;",
        "  p.y = l * 1.9 * scale;",
        "  float pinch = 1.0 - l*0.75;",
        "  p.x = p.x*pinch + sin(time*2.6 + aSway + l*5.0)*0.16*l;",
        "  p.z = p.z*pinch + cos(time*2.2 + aSway*1.3 + l*4.0)*0.16*l;",
        "  vec4 mv = modelViewMatrix * vec4(p,1.0);",
        "  gl_PointSize = min(aSize * (1.0-l*0.55) * scale * (16.0/max(1.0,-mv.z)), 46.0);",
        "  gl_Position = projectionMatrix * mv;",
        "}"
      ].join("\n"),
      fragmentShader: [
        "varying float vL;",
        "void main(){",
        "  float a = smoothstep(0.5, 0.02, length(gl_PointCoord-0.5));",
        /* white at the base, orange in the middle, red and gone at the top */
        "  vec3 c = mix(vec3(1.0,0.78,0.36), vec3(1.0,0.42,0.10), smoothstep(0.0,0.40,vL));",
        "  c = mix(c, vec3(0.45,0.10,0.03), smoothstep(0.45,1.0,vL));",
        "  gl_FragColor = vec4(c, a*(1.0-vL)*0.30);",
        "}"
      ].join("\n")
    });
    var pts = new THREE.Points(geoF, mat);
    pts.frustumCulled = false;
    g.add(pts);

    /* embers, going higher and slower */
    var EC = 60;
    var eg = new THREE.BufferGeometry();
    var ep = new Float32Array(EC * 3), el = new Float32Array(EC), es = new Float32Array(EC);
    for (var k = 0; k < EC; k++) {
      ep[k * 3] = rnd(-0.4, 0.4); ep[k * 3 + 1] = 0; ep[k * 3 + 2] = rnd(-0.4, 0.4);
      el[k] = Math.random(); es[k] = rnd(0.16, 0.5);
    }
    eg.setAttribute("position", new THREE.BufferAttribute(ep, 3));
    eg.setAttribute("aLife", new THREE.BufferAttribute(el, 1));
    eg.setAttribute("aSpeed", new THREE.BufferAttribute(es, 1));
    var eu = { time: { value: 0 } };
    var emb = new THREE.Points(eg, new THREE.ShaderMaterial({
      uniforms: eu, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: [
        "attribute float aLife; attribute float aSpeed; uniform float time; varying float vL;",
        "void main(){",
        "  float l = fract(aLife + time*aSpeed*0.24); vL=l;",
        "  vec3 p = position;",
        "  p.y = 0.4 + l*5.5;",
        "  p.x += sin(time*0.9 + aLife*30.0)*l*1.4;",
        "  p.z += cos(time*0.7 + aLife*22.0)*l*1.4;",
        "  vec4 mv = modelViewMatrix * vec4(p,1.0);",
        "  gl_PointSize = min(2.2*(1.0-l*0.6)*(16.0/max(1.0,-mv.z)), 14.0);",
        "  gl_Position = projectionMatrix * mv;",
        "}"
      ].join("\n"),
      fragmentShader: [
        "varying float vL;",
        "void main(){",
        "  float a = smoothstep(0.5,0.05,length(gl_PointCoord-0.5));",
        "  gl_FragColor = vec4(1.0,0.55,0.18, a*(1.0-vL)*0.9);",
        "}"
      ].join("\n")
    }));
    emb.frustumCulled = false;
    g.add(emb);

    /* smoke, only visible against the sky */
    var sm = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 1.4, 6.5, 10, 1, true),
      new THREE.MeshBasicMaterial({ color: 0x5a5450, transparent: true, opacity: 0.055,
        depthWrite: false, side: THREE.DoubleSide }));
    sm.position.y = 4.2;
    g.add(sm);

    var light = new THREE.PointLight(0xff9a44, 0, 22, 1.35);
    light.position.y = 0.9;
    light.castShadow = false;
    g.add(light);

    g.userData.update = function (t, dt) {
      u.time.value = t; eu.time.value = t;
      /* three sines that do not share a period: it never repeats */
      var f = 0.72 + Math.sin(t * 7.3) * 0.11 + Math.sin(t * 3.1) * 0.09 + Math.sin(t * 17.7) * 0.05;
      light.intensity = 12.0 * f * (g.userData.strength == null ? 1 : g.userData.strength);
      light.position.x = Math.sin(t * 2.1) * 0.10;
      light.position.z = Math.cos(t * 1.7) * 0.10;
      u.scale.value = g.userData.strength == null ? 1 : 0.5 + g.userData.strength * 0.5;
      sm.rotation.y = t * 0.12;
    };
    g.userData.light = light;
    return g;
  }

  /* =========================================================
     16 — THE TORCH
     A spotlight that casts the only shadow indoors, a cone of
     additive geometry so the beam itself is visible in the
     dust, and a small warm pool at her feet so she is never a
     silhouette on black.
     ========================================================= */
  function makeTorch() {
    var g = new THREE.Group();
    /* an inner group the beam lives in, so it can swing behind her turn
       without dragging her shoulders round with it */
    var arm = new THREE.Group();
    g.add(arm);

    var spot = new THREE.SpotLight(0xfff0d0, 46, 28, 0.72, 0.86, 1.1);
    spot.castShadow = true;
    spot.shadow.mapSize.set(2048, 2048);
    spot.shadow.camera.near = 0.5;
    spot.shadow.camera.far = 26;
    spot.shadow.bias = -0.0011;
    spot.shadow.normalBias = 0.028;
    spot.shadow.radius = 3;
    spot.position.set(0, 1.35, 0);
    arm.add(spot);
    arm.add(spot.target);
    spot.target.position.set(3, 0.6, 0);

    /* the visible beam: a cone, faded at both ends, drawn additively.
       It is what makes the dark feel like it has depth in it. */
    var coneGeo = new THREE.CylinderGeometry(0.06, 3.1, 9.0, 20, 6, true);
    coneGeo.translate(0, -4.5, 0);
    coneGeo.rotateZ(-Math.PI / 2);
    var coneMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      uniforms: { time: { value: 0 }, amt: { value: 0.5 }, tint: { value: new THREE.Color(0xffe6bc) } },
      vertexShader: [
        "varying vec2 vUv; varying vec3 vP;",
        "void main(){ vUv=uv; vP=position;",
        " gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }"
      ].join("\n"),
      fragmentShader: [
        "uniform float time; uniform float amt; uniform vec3 tint;",
        "varying vec2 vUv; varying vec3 vP;",
        "void main(){",
        /* Along the beam: an exponential falloff rather than a quadratic
           one, so the far end dissolves instead of stopping, with a soft
           shoulder where it leaves the lens. */
        "  float along = clamp(vP.x/9.0, 0.0, 1.0);",
        "  float a = exp(-along*3.1) * 0.62;",
        "  a *= smoothstep(0.0, 0.30, along);",
        /* Across it: a smooth radial gradient to nothing at the rim, which
           is what stops the cone reading as a solid wedge of colour. */
        "  float across = abs(vUv.x*2.0 - 1.0);",
        "  a *= pow(1.0 - across*across, 1.6);",
        /* the faintest breathing, well under the level where it reads as
           noise, so the beam is alive without shimmering */
        "  a *= 0.93 + 0.07*sin(along*9.0 - time*1.7);",
        "  gl_FragColor = vec4(tint, a*amt);",
        "}"
      ].join("\n")
    });
    var cone = new THREE.Mesh(coneGeo, coneMat);
    cone.position.set(0, 1.32, 0);
    cone.frustumCulled = false;
    cone.renderOrder = 20;
    arm.add(cone);

    /* the pool she stands in */
    var pool = new THREE.PointLight(0xffd9a8, 2.2, 7.4, 1.9);
    pool.position.set(0, 1.55, 0);
    g.add(pool);

    g.userData = { rig: arm, spot: spot, cone: cone, coneMat: coneMat, pool: pool };
    return g;
  }

  /* =========================================================
     17 — THE GAME
     One object holds the run. Everything below reads and writes
     it; nothing keeps its own copy of anything.
     ========================================================= */
  var G = null;
  var raf = 0, lastT = 0, running = false;

  /* --- input --- */
  var KEY = { up: 0, down: 0, left: 0, right: 0, use: 0, sneak: 0 };
  var keyMap = {
    ArrowUp: "up", KeyW: "up", ArrowDown: "down", KeyS: "down",
    ArrowLeft: "left", KeyA: "left", ArrowRight: "right", KeyD: "right",
    Space: "use", KeyE: "use", ShiftLeft: "sneak", ShiftRight: "sneak"
  };
  var usePressed = false, anyPressed = 0;

  function onKeyDown(e) {
    if (!running) return;
    if (e.code === "Escape") { togglePause(); e.preventDefault(); return; }
    anyPressed++;
    var k = keyMap[e.code];
    if (!k) return;
    if (k === "use" && !KEY.use) usePressed = true;
    KEY[k] = 1;
    if (e.code === "Space" || e.code.indexOf("Arrow") === 0) e.preventDefault();
    Audio_.resume();
  }
  function onKeyUp(e) {
    var k = keyMap[e.code];
    if (k) KEY[k] = 0;
  }

  function bindPad() {
    var pad = $("ap-pad");
    if (!pad) return;
    pad.setAttribute("aria-hidden", "false");
    pad.querySelectorAll("[data-ap-key]").forEach(function (b) {
      var k = b.getAttribute("data-ap-key");
      function down(e) {
        e.preventDefault();
        anyPressed++;
        if (k === "use" && !KEY.use) usePressed = true;
        KEY[k] = 1; b.classList.add("on");
        Audio_.resume();
      }
      function up(e) { e.preventDefault(); KEY[k] = 0; b.classList.remove("on"); }
      b.addEventListener("touchstart", down, { passive: false });
      b.addEventListener("touchend", up, { passive: false });
      b.addEventListener("touchcancel", up, { passive: false });
      b.addEventListener("mousedown", down);
      b.addEventListener("mouseup", up);
      b.addEventListener("mouseleave", up);
      b.__bound = true;
    });
  }

  /* =========================================================
     18 — SPACE
     Gameplay happens in world units. These are the only four
     functions that know the grid is a grid.
     ========================================================= */
  function tileAt(w, wx, wz) {
    return w.at(Math.floor(wx / TILE), Math.floor(wz / TILE));
  }
  function doorAtTile(w, tx, ty) {
    for (var i = 0; i < w.doors.length; i++) {
      if (w.doors[i].x === tx && w.doors[i].y === ty) return w.doors[i];
    }
    return null;
  }
  function blocked(w, wx, wz) {
    var tx = Math.floor(wx / TILE), ty = Math.floor(wz / TILE);
    var c = w.at(tx, ty);
    if (c === " ") return true;
    if ("dDPG".indexOf(c) >= 0) {
      var d = doorAtTile(w, tx, ty);
      return !(d && d.open > 0.6);
    }
    return isSolidChar(c);
  }
  function opaqueAtTile(w, tx, ty) {
    var c = w.at(tx, ty);
    if (c === " ") return true;
    if ("dDPG".indexOf(c) >= 0) {
      var d = doorAtTile(w, tx, ty);
      return !(d && d.open > 0.6);
    }
    return isOpaqueChar(c);
  }

  /* the footway is a hand's width above the road; anything standing on it
     has to come up with it or it walks around shin-deep in concrete */
  function groundAt(w, wx, wz) {
    if (!w.kerb || !w.made) return 0;
    return w.made(Math.floor(wx / TILE), Math.floor(wz / TILE)) ? w.kerb : 0;
  }

  /* a line between two points, in tiles, stopped by anything opaque */
  function canSee(w, ax, az, bx, bz) {
    var x0 = ax / TILE, y0 = az / TILE, x1 = bx / TILE, y1 = bz / TILE;
    var dx = x1 - x0, dy = y1 - y0;
    var n = Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) * 2.2);
    if (n <= 0) return true;
    for (var i = 1; i < n; i++) {
      var t = i / n;
      var tx = Math.floor(x0 + dx * t), ty = Math.floor(y0 + dy * t);
      if (opaqueAtTile(w, tx, ty)) return false;
    }
    return true;
  }

  /* slide along whatever she has walked into, rather than sticking */
  function moveWithCollision(w, ent, dx, dz, r) {
    var nx = ent.x + dx;
    if (!blocked(w, nx + Math.sign(dx) * r, ent.z + r * 0.6) &&
        !blocked(w, nx + Math.sign(dx) * r, ent.z - r * 0.6) &&
        !blocked(w, nx + Math.sign(dx) * r, ent.z)) ent.x = nx;
    var nz = ent.z + dz;
    if (!blocked(w, ent.x + r * 0.6, nz + Math.sign(dz) * r) &&
        !blocked(w, ent.x - r * 0.6, nz + Math.sign(dz) * r) &&
        !blocked(w, ent.x, nz + Math.sign(dz) * r)) ent.z = nz;
  }

  function nearestFree(w, tx, ty) {
    for (var r = 0; r < 14; r++) {
      for (var j = -r; j <= r; j++) for (var i = -r; i <= r; i++) {
        if (Math.max(Math.abs(i), Math.abs(j)) !== r) continue;
        var c = w.at(tx + i, ty + j);
        if (c !== " " && !isSolidChar(c)) return { x: tx + i, y: ty + j };
      }
    }
    return { x: tx, y: ty };
  }

  /* =========================================================
     19 — BUILDING A PLACE TO PLAY IN
     ========================================================= */
  function makeScene(def) {
    var pal = PAL[def.theme] || PAL.house;
    var scene = new THREE.Scene();

    /* fog: the thing that makes the dark feel like it has weight */
    var fogCol = new THREE.Color(pal.fogNear);
    scene.fog = new THREE.FogExp2(fogCol.getHex(), def.dark > 0.6 ? 0.020 : def.dark > 0.4 ? 0.013 : 0.0075);
    scene.background = new THREE.Color(pal.sky);

    var sky = makeSky();
    var night = def.dark > 0.45;
    if (def.id === "gates") {
      sky.u.cLow.value.set(0xffbe86); sky.u.cMid.value.set(0x87a8d8); sky.u.cHigh.value.set(0x2f5c9e);
      sky.u.sunCol.value.set(0xffe0a0); sky.u.sunAmt.value = 0.85;
      sky.u.sunDir.value.set(-0.5, 0.16, 0.8).normalize();
    } else if (def.id === "roadside" || def.id === "campsite") {
      sky.u.cLow.value.set(0xd8834e); sky.u.cMid.value.set(0x6a5a92); sky.u.cHigh.value.set(0x141c40);
      sky.u.sunCol.value.set(0xffb070); sky.u.sunAmt.value = 0.62;
      sky.u.sunDir.value.set(0.7, 0.10, 0.6).normalize();
    } else {
      sky.u.cLow.value.set(pal.fogNear); sky.u.cMid.value.set(pal.sky);
      sky.u.cHigh.value.set(shade(pal.sky, 0.45));
      sky.u.sunCol.value.set(0xbcd0ff); sky.u.sunAmt.value = 0.18;
      sky.u.sunDir.value.set(-0.4, 0.35, -0.7).normalize();
    }
    scene.add(sky.mesh);

    var stars = null, moon = null;
    if (night) {
      stars = makeStars(700, 380);
      stars.u.amt.value = def.dark > 0.6 ? 1.0 : 0.55;
      scene.add(stars.points);
      moon = makeMoon(9);
      moon.position.set(-150, 130, -250);
      scene.add(moon);
    }

    /* one cube, built from this level's own sky, so every material in it
       has something real to reflect */
    if (Stage.renderer) {
      try {
        var env = buildEnvironment(Stage.renderer, sky, pal, def.dark);
        scene.environment = env;
        scene.environmentIntensity = def.dark > 0.55 ? 0.42 : def.dark > 0.4 ? 0.7 : 1.0;
      } catch (e) { /* an old card without float textures: no reflections, still plays */ }
    }

    return { scene: scene, sky: sky, stars: stars, moon: moon };
  }

  function enterLevel(def, opts) {
    opts = opts || {};
    closeOverlay();
    var built = makeScene(def);
    var world = buildWorld(def);
    built.scene.add(world.group);

    var spawn = world.spawn || { x: 2, y: 2 };
    var px = world.cx(spawn.x), pz = world.cz(spawn.y);

    /* --- her --- */
    var rig = makeOuissy();
    built.scene.add(rig.root);
    var torch = makeTorch();
    rig.root.add(torch);

    var player = {
      x: px, z: pz, vx: 0, vz: 0, facing: -Math.PI / 2,
      turn: Math.PI / 2, beam: Math.PI / 2, crouch: 0, groundY: 0,
      creeping: false, hidden: false, rig: rig, torch: torch,
      stepPhase: 0, gait: 0, safe: { x: px, z: pz }, alive: true
    };
    rig.root.rotation.y = player.turn;

    /* --- them --- */
    var zombies = [];
    for (var y = 0; y < world.h; y++) {
      for (var x = 0; x < world.w; x++) {
        var c = world.at(x, y);
        if (c !== "z" && c !== "x") continue;
        zombies.push(makeZ(world, built.scene, x, y, zombies.length, c === "x" ? "drawn" : null));
      }
    }

    /* --- him --- */
    /* From the ward onwards he is with her, and the grids after the
       hospital have no A in them because he is not furniture any more —
       he is wherever she left him standing. */
    var anwar = null;
    var carriedOver = !!(G && G.withAnwar);
    if (!world.anwarAt && carriedOver) {
      var cr = makeAnwar();
      built.scene.add(cr.root);
      var behind = nearestFree(world, spawn.x, spawn.y + 1);
      cr.root.position.set(world.cx(behind.x), 0, world.cz(behind.y));
      anwar = { rig: cr, x: world.cx(behind.x), z: world.cz(behind.y),
                found: true, following: true, asleep: false };
    }
    if (world.anwarAt) {
      var ar = makeAnwar();
      built.scene.add(ar.root);
      var ax = world.cx(world.anwarAt.x), az = world.cz(world.anwarAt.y);
      /* "He is on his side with one arm out of the blanket" — so there has
         to be a bed under him, and the far bay of Ward C does not have one
         in the grid. Lay one down and put him on it. */
      if (world.makeBed) world.makeBed(world.anwarAt.x, world.anwarAt.y);
      ar.root.position.set(ax, 0.86, az);
      ar.root.rotation.set(-Math.PI / 2, 0, 0);   /* on his side, along -z */
      ar.contact.visible = false;
      poseHuman(ar, 0, 0, null, { crouch: 0.25 });
      anwar = { rig: ar, x: ax, z: az, found: false, following: false, asleep: true,
                bedAt: { x: world.anwarAt.x, y: world.anwarAt.y } };
    }

    /* --- the people who are still people ---
       Ashcombe is not an empty car park with a fence round it: there are
       two on the gate, one at the table, and a dozen waiting inside who
       got here before she did. */
    var people = [];
    if (def.people) {
      def.people.forEach(function (p2, i) {
        var rig = p2.kind === "guard" ? makeGuard(i + 1) : makeCivilian(i + 3);
        built.scene.add(rig.root);
        rig.root.position.set(world.cx(p2.x), 0, world.cz(p2.y));
        rig.root.rotation.y = -(p2.face == null ? Math.PI : p2.face);
        people.push({
          rig: rig, x: world.cx(p2.x), z: world.cz(p2.y),
          face: p2.face == null ? Math.PI : p2.face,
          kind: p2.kind, phase: hash2(i * 13, 7) * 6.28,
          sit: !!p2.sit, pace: p2.pace || 0
        });
      });
    }

    /* --- the horse --- */
    var horse = null;
    if (world.horseAt) {
      var h = buildHorse();
      built.scene.add(h.root);
      h.root.position.set(world.cx(world.horseAt.x), 0, world.cz(world.horseAt.y));
      h.root.rotation.y = -Math.PI / 2;
      horse = { rig: h, x: world.cx(world.horseAt.x), z: world.cz(world.horseAt.y) };
    }

    if (G) teardownLevel();

    G = G || {};
    G.def = def;
    G.scene = built.scene;
    G.sky = built.sky; G.stars = built.stars; G.moon = built.moon;
    G.world = world;
    G.player = player;
    G.zombies = zombies;
    G.anwar = anwar;
    G.people = people;
    G.horse = horse;
    G.time = 0;
    G.state = "play";
    G.stepIndex = 0;
    G.cleared = {};
    G.noises = [];
    G.pressure = 0;
    G.pressureT = 0;
    G.caught = 0;
    G.closeCalls = G.closeCalls || 0;
    G.code = G.code || null;
    G.dlg = null;
    G.camRig = G.camRig || new CamRig(Stage.camera);
    G.camRig.snap();
    G.flash = 0;
    G.redPulse = 0;
    G.fade = opts.fade === false ? 1 : 0;
    G.fadeTo = 1;
    G.fadeThen = null;
    G.grab = null;
    G.cine = null;

    Stage.attach(built.scene, Stage.camera);
    /* Compile every program this scene needs before the first frame is
       asked for. Otherwise the first second of a level is a series of
       long frames as each new material reaches the card, which is exactly
       where a player notices stutter. */
    try { Stage.renderer.compile(built.scene, Stage.camera); } catch (e) {}
    Stage.grade({
      gradeCol: (def.grade[0] << 16) | (def.grade[1] << 8) | def.grade[2],
      gradeAmt: def.grade[3],
      hazeCol: (def.haze[0] << 16) | (def.haze[1] << 8) | def.haze[2],
      hazeAmt: def.haze[3],
      vig: def.dark > 0.55 ? 0.68 : 0.52,
      sat: 1.06, exposure: 1.05, fringe: 0.0015,
      /* attach() builds a fresh grade pass whose fade defaults to open, so
         without this the first frame of a new level flashes at full
         brightness before the fade-in starts */
      fade: G.fade, redPulse: 0, flash: 0
    });

    Audio_.bed(def.theme);
    setStep();
    setHud();
    return G;
  }

  /* Shared geometry lives in GEO and is reused by the next level, so only
     the one-off geometry a level built for itself is disposed. */
  function teardownLevel() {
    if (!G || !G.scene) return;
    ringPool.forEach(function (q) { q.live = false; q.mesh.visible = false; });
    disposeScene(G.scene);
    G.scene = null;
  }

  function makeZ(world, scene, tx, ty, seed, forceKind) {
    var kinds = ["idle", "patrol", "patrol", "drawn"];
    var kind = forceKind || kinds[seed % kinds.length];
    var rig = makeZombie(seed);
    scene.add(rig.root);
    var x = world.cx(tx), z = world.cz(ty);
    rig.root.position.set(x, 0, z);
    var dir = [0, Math.PI / 2, Math.PI, -Math.PI / 2][seed % 4];

    /* a patrol walks the longest clear run it can find from where it stands */
    var route = null;
    if (kind === "patrol") {
      var best = null;
      [[1, 0], [0, 1], [-1, 0], [0, -1]].forEach(function (d) {
        var n = 0;
        while (n < 9) {
          var c = world.at(tx + d[0] * (n + 1), ty + d[1] * (n + 1));
          if (c === " " || isSolidChar(c)) break;
          n++;
        }
        if (!best || n > best.n) best = { n: n, d: d };
      });
      if (best && best.n >= 2) {
        route = { ax: x, az: z,
                  bx: world.cx(tx + best.d[0] * best.n),
                  bz: world.cz(ty + best.d[1] * best.n), to: 1 };
        dir = Math.atan2(best.d[1], best.d[0]);
      } else kind = "idle";
    }

    return {
      x: x, z: z, rig: rig, kind: kind, facing: dir, home: { x: x, z: z },
      state: "calm", timer: rnd(0, 3), react: 0, lose: 0, look: null,
      route: route, gait: 0, seed: seed, sound: rnd(0, 4)
    };
  }

  /* =========================================================
     20 — THE TICK
     ========================================================= */
  function step() { return G.def.steps ? G.def.steps[G.stepIndex] : null; }

  function setStep() {
    var s = step();
    setHud();
    if (!s) return;
  }

  function clearStep(name) {
    var s = step();
    if (!s || s.clears !== name) return false;
    G.stepIndex++;
    Audio_.found();
    setHud();
    if (G.stepIndex >= G.def.steps.length) onLevelDone();
    return true;
  }

  var ringPool = [];
  function noiseRing(x, z, r) {
    if (!G.scene) return;
    var ring = null;
    for (var i = 0; i < ringPool.length; i++) if (!ringPool[i].live) ring = ringPool[i];
    if (!ring) {
      var m = new THREE.Mesh(
        geo("noiseRing", function () { return new THREE.RingGeometry(0.86, 1.0, 40); }),
        new THREE.MeshBasicMaterial({ color: 0xbcd4ff, transparent: true, opacity: 0,
          side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending,
          toneMapped: false, fog: false }));
      m.rotation.x = -Math.PI / 2;
      m.renderOrder = 8;
      ring = { mesh: m, live: false, t: 0, r: 1 };
      ringPool.push(ring);
    }
    if (ring.mesh.parent !== G.scene) G.scene.add(ring.mesh);
    ring.mesh.position.set(x, 0.05, z);
    ring.mesh.visible = true;
    ring.live = true; ring.t = 0; ring.r = r;
  }

  function updateRings(dt) {
    for (var i = 0; i < ringPool.length; i++) {
      var q = ringPool[i];
      if (!q.live) continue;
      q.t += dt / 0.85;
      if (q.t >= 1) { q.live = false; q.mesh.visible = false; continue; }
      var e = 1 - Math.pow(1 - q.t, 3);
      q.mesh.scale.setScalar(0.2 + e * q.r);
      q.mesh.material.opacity = 0.36 * (1 - q.t) * (1 - q.t);
    }
  }

  function noise(x, z, r) {
    if (r <= 0) return;
    noiseRing(x, z, r);
    G.noises.push({ x: x, z: z, r: r, t: G.time });
    if (G.noises.length > 24) G.noises.splice(0, G.noises.length - 24);
    for (var i = 0; i < G.zombies.length; i++) {
      var zz = G.zombies[i];
      if (zz.state === "chase") continue;
      var hearing = r * (zz.kind === "drawn" ? 2 : 1);
      var d = Math.hypot(zz.x - x, zz.z - z);
      if (d < hearing) {
        zz.look = { x: x, z: z };
        zz.state = "look";
        zz.timer = TUNE.zInvestigate;
      }
    }
    showAlarm(r);
  }

  function updatePlayer(dt) {
    var p = G.player, w = G.world;
    var ix = (KEY.right ? 1 : 0) - (KEY.left ? 1 : 0);
    var iz = (KEY.down ? 1 : 0) - (KEY.up ? 1 : 0);
    var mag = Math.hypot(ix, iz);
    if (mag > 0) { ix /= mag; iz /= mag; }

    p.creeping = !!KEY.sneak;
    var maxS = p.creeping ? TUNE.creep : TUNE.walk;

    if (mag > 0) {
      p.vx += ix * TUNE.accel * dt;
      p.vz += iz * TUNE.accel * dt;
      var sp = Math.hypot(p.vx, p.vz);
      if (sp > maxS) { p.vx = p.vx / sp * maxS; p.vz = p.vz / sp * maxS; }
      p.facing = Math.atan2(iz, ix);
    } else {
      var s2 = Math.hypot(p.vx, p.vz);
      var drop = TUNE.friction * dt;
      if (s2 <= drop) { p.vx = p.vz = 0; }
      else { p.vx -= p.vx / s2 * drop; p.vz -= p.vz / s2 * drop; }
    }

    moveWithCollision(w, p, p.vx * dt, p.vz * dt, TUNE.playerR);

    var speed = Math.hypot(p.vx, p.vz);
    p.gait = damp(p.gait, clamp(speed / TUNE.walk, 0, 1), 0.12, dt);

    /* footfalls, and the noise they make */
    if (speed > 0.4) {
      p.stepPhase += speed * dt * (p.creeping ? 1.6 : 2.2);
      if (p.stepPhase > 1) {
        p.stepPhase -= 1;
        Audio_.step(p.creeping, G.world.outdoor);
        noise(p.x, p.z, p.creeping ? TUNE.noiseCreep : TUNE.noiseWalk);
      }
    }

    /* hiding */
    var tx = Math.floor(p.x / TILE), ty = Math.floor(p.z / TILE);
    var here = w.at(tx, ty);
    p.hidden = HIDE.indexOf(here) >= 0;

    /* somewhere to be put back to: the last place nothing could see her */
    var anyChase = false;
    for (var i = 0; i < G.zombies.length; i++) if (G.zombies[i].state === "chase") anyChase = true;
    if (!anyChase && speed < 0.2 && !isSolidChar(here)) { p.safe.x = p.x; p.safe.z = p.z; }

    /* pose */
    p.groundY = damp(p.groundY || 0, groundAt(w, p.x, p.z), 0.16, dt);
    p.rig.root.position.set(p.x, p.groundY, p.z);
    p.turn = dampAngle(p.turn == null ? -p.facing : p.turn, -p.facing, 0.11, dt);
    p.rig.root.rotation.y = p.turn;
    p.crouch = damp(p.crouch || 0, p.creeping ? 1 : 0, 0.20, dt);
    poseHuman(p.rig, G.time, p.gait, null, { crouch: p.crouch });

    /* The torch is in her hand, not welded to her shoulders: it arrives
       where she is pointing about a tenth of a second after she does,
       which is the single thing that stops the beam looking like a
       spotlight bolted to a turret. */
    var td = p.torch.userData;
    p.beam = dampAngle(p.beam == null ? -p.facing : p.beam, -p.facing, 0.15, dt);
    var swing = Math.atan2(Math.sin(p.beam - p.turn), Math.cos(p.beam - p.turn));
    td.rig.rotation.y = swing;
    td.rig.position.y = Math.sin(G.time * 2.1) * 0.012 + p.gait * Math.sin(G.time * 8.2) * 0.02;
    td.spot.target.position.set(6, -1.2, 0);
    var reach = p.creeping ? TUNE.torchCreep : TUNE.torch;
    td.spot.distance = damp(td.spot.distance, reach * 2.6, 0.35, dt);
    td.spot.angle = damp(td.spot.angle, p.creeping ? 0.62 : 0.76, 0.35, dt);
    var bal = G.world.balance == null ? 1 : G.world.balance;
    /* by the time she gets to the gates it is morning, and a torch in
       daylight is just something in her hand */
    var night = clamp((G.def.dark - 0.30) / 0.28, 0, 1);
    td.spot.intensity = damp(td.spot.intensity, (p.creeping ? 32 : 48) * bal * night, 0.24, dt);
    td.coneMat.uniforms.time.value = G.time;
    td.coneMat.uniforms.amt.value = (p.creeping ? 0.30 : 0.46) * night;
    td.coneScale = damp(td.coneScale == null ? reach / 8 : td.coneScale, reach / 8.0, 0.35, dt);
    td.cone.scale.setScalar(td.coneScale);
    td.pool.intensity = (p.creeping ? 1.5 : 2.2) * bal * (0.35 + night * 0.65);
  }

  function updateZombies(dt) {
    var p = G.player, w = G.world;
    var chasing = 0, looking = 0;

    for (var i = 0; i < G.zombies.length; i++) {
      var z = G.zombies[i];
      var dx = p.x - z.x, dz = p.z - z.z;
      var dist = Math.hypot(dx, dz);
      var toP = Math.atan2(dz, dx);

      /* can it see her right now? */
      var sees = false;
      if (!p.hidden && G.state === "play" && dist < TUNE.zSight) {
        var da = Math.abs(Math.atan2(Math.sin(toP - z.facing), Math.cos(toP - z.facing)));
        if ((da < TUNE.zCone || dist < TUNE.zNear) && canSee(w, z.x, z.z, p.x, p.z)) sees = true;
      }

      if (sees && z.state !== "chase" && z.state !== "react") {
        z.state = "react"; z.react = TUNE.zReact;
        Audio_.alert();
        G.camRig.kick(0.10);
      }

      var speed = 0;
      switch (z.state) {
        case "react":
          z.react -= dt;
          z.facing = toP;
          /* it rears up: the window she has to get out of sight */
          if (z.react <= 0) { z.state = sees ? "chase" : "look"; z.look = { x: p.x, z: p.z }; z.timer = TUNE.zInvestigate; }
          break;

        case "chase":
          chasing++;
          if (sees) { z.lose = 0; z.look = { x: p.x, z: p.z }; }
          else {
            z.lose += dt;
            if (z.lose > TUNE.zLose) { z.state = "look"; z.timer = TUNE.zInvestigate; }
          }
          var tgt = sees ? p : z.look;
          if (tgt) {
            var a = Math.atan2(tgt.z - z.z, tgt.x - z.x);
            z.facing = a;
            speed = TUNE.zChase;
          }
          if (dist < TUNE.playerR + TUNE.zombieR + 0.15 && !p.hidden && G.state === "play") {
            beginGrab(z);
          }
          break;

        case "look":
          looking++;
          z.timer -= dt;
          if (z.look) {
            var dl = Math.hypot(z.look.x - z.x, z.look.z - z.z);
            if (dl > TILE * 0.6) {
              z.facing = Math.atan2(z.look.z - z.z, z.look.x - z.x);
              speed = TUNE.zSpeed * 1.25;
            } else {
              /* stood over the sound, turning its head */
              z.facing += Math.sin(G.time * 1.4 + z.seed) * dt * 1.5;
            }
          }
          if (z.timer <= 0) { z.state = "calm"; z.look = null; }
          break;

        default: /* calm */
          if (z.kind === "patrol" && z.route) {
            var t = z.route.to ? { x: z.route.bx, z: z.route.bz } : { x: z.route.ax, z: z.route.az };
            var d2 = Math.hypot(t.x - z.x, t.z - z.z);
            if (d2 < TILE * 0.4) { z.route.to = z.route.to ? 0 : 1; z.timer = rnd(0.6, 2.2); }
            else if (z.timer <= 0) {
              z.facing = Math.atan2(t.z - z.z, t.x - z.x);
              speed = TUNE.zSpeed;
            }
            z.timer -= dt;
          } else if (z.kind === "drawn") {
            /* restless: never quite still, drifts around where it stands */
            z.timer -= dt;
            if (z.timer <= 0) { z.timer = rnd(1.4, 3.4); z.facing = rnd(0, 6.28); }
            speed = TUNE.zSpeed * 0.45;
            var hd = Math.hypot(z.x - z.home.x, z.z - z.home.z);
            if (hd > TILE * 2.2) z.facing = Math.atan2(z.home.z - z.z, z.home.x - z.x);
          } else {
            z.timer -= dt;
            if (z.timer <= 0) { z.timer = rnd(2.5, 6); z.facing += rnd(-1.2, 1.2); }
          }
          break;
      }

      if (speed > 0) {
        var mvx = Math.cos(z.facing) * speed * dt;
        var mvz = Math.sin(z.facing) * speed * dt;
        var before = z.x + z.z;
        moveWithCollision(w, z, mvx, mvz, TUNE.zombieR);
        /* walked into a wall: turn away rather than grinding along it */
        if (Math.abs((z.x + z.z) - before) < 0.0004 && z.state === "calm") z.facing += 1.9;
      }
      z.gait = damp(z.gait, speed > 0 ? 1 : 0, 0.22, dt);

      z.groundY = damp(z.groundY || 0, groundAt(w, z.x, z.z), 0.16, dt);
      z.rig.root.position.set(z.x, z.groundY, z.z);
      /* they turn slower than she does, which is half of why she can get
         round behind one */
      z.rig.root.rotation.y = dampAngle(z.rig.root.rotation.y, -z.facing, 0.30, dt);
      poseHuman(z.rig, G.time + z.seed, z.gait, "z");

      /* it is only worth drawing what she could plausibly perceive */
      var vis = dist < 34;
      if (z.rig.root.visible !== vis) z.rig.root.visible = vis;

      /* the sound of it dragging itself along */
      z.sound -= dt * (z.state === "chase" ? 2.4 : 1);
      if (z.sound <= 0 && dist < 16) { z.sound = rnd(1.4, 3.6); Audio_.shuffle(dist); }
    }

    G.chasing = chasing;
    G.looking = looking;
  }

  /* --- the lights that are not hers --- */
  function updateLights(dt) {
    var w = G.world, p = G.player;
    if (!w.lamps.length) return;
    var dead = w.deadZone;
    var live = [];
    for (var i = 0; i < w.lamps.length; i++) {
      var L = w.lamps[i];
      var off = false;
      if (dead && !w.powered &&
          L.tx >= dead[0] && L.tx <= dead[2] && L.ty >= dead[1] && L.ty <= dead[3]) off = true;
      if (L.bulb) L.bulb.visible = !off;
      if (L.halo) L.halo.visible = !off;
      if (off) continue;
      L.d = (L.x - p.x) * (L.x - p.x) + (L.z - p.z) * (L.z - p.z);
      live.push(L);
    }
    live.sort(function (a, b) { return a.d - b.d; });
    for (var k = 0; k < w.pool.length; k++) {
      var pl = w.pool[k], L2 = live[k];
      if (!L2 || L2.d > 34 * 34) { pl.visible = false; continue; }
      pl.visible = true;
      pl.position.set(L2.x, L2.y, L2.z);
      pl.color.setHex(L2.colour);
      pl.distance = L2.range;
      /* A failing tube does not strobe evenly: it holds, drops out, comes
         back hard, and buzzes. Three sines that do not share a period and
         one hard cut-out get most of the way there. */
      var f = 1;
      if (L2.flicker) {
        var tt = G.time * (L2.kind === "tv" ? 1 : 0.65) + L2.tx * 3.1 + L2.ty * 1.7;
        f = 0.72 + Math.sin(tt * 21) * 0.10 + Math.sin(tt * 6.3) * 0.09 + Math.sin(tt * 2.1) * 0.09;
        if (L2.kind !== "tv") {
          var out = Math.sin(tt * 0.9) * Math.sin(tt * 3.7);
          if (out > 0.86) f *= 0.12;
        }
      }
      pl.intensity = L2.power * f * 4.0 * (w.balance == null ? 1 : w.balance);
      if (L2.bulb) L2.bulb.material.color.setScalar(clamp(f, 0.05, 1.4));
      if (L2.halo) L2.halo.material.opacity = 0.30 * clamp(f, 0.05, 1.3);
      if (L2.shaft) L2.shaft.material.uniforms.amt.value = 0.16 * clamp(f, 0.02, 1.3);
    }
  }

  function updateDoors(dt) {
    var ds = G.world.doors;
    for (var i = 0; i < ds.length; i++) {
      var d = ds[i];
      if (Math.abs(d.open - d.want) < 0.002) continue;
      d.open = damp(d.open, d.want, 0.28, dt);
      if (d.hinge) d.hinge.rotation.y = -d.open * 1.75;
      if (d.slide) d.slide.position.x = d.open * (TILE - 0.3);
    }
  }

  /* =========================================================
     21 — THE SCREEN FURNITURE
     The 3D canvas draws the world; everything with words on it
     is DOM, because six-point type blown up is not readable and
     never has been. The plates, bolts, keypads and torn paper
     are all styled in style.css already.
     ========================================================= */
  function overlay() { return $("ap-overlay"); }

  function openOverlay(node, cls) {
    if (G && G.__overlayCleanup) { try { G.__overlayCleanup(); } catch (e) {} G.__overlayCleanup = null; }
    var o = overlay();
    o.innerHTML = "";
    o.className = "ap-overlay" + (cls ? " " + cls : "");
    o.appendChild(node);
    o.setAttribute("aria-hidden", "false");
    if (G) G.state = "overlay";
  }

  function closeOverlay() {
    var o = $("ap-overlay");
    if (!o) return;
    o.setAttribute("aria-hidden", "true");
    o.innerHTML = "";
    o.className = "ap-overlay";
    o.style.background = "";
    o.style.alignItems = "";
    o.style.justifyContent = "";
    o.style.paddingBottom = "";
    o.style.pointerEvents = "";
    if (G) {
      if (G.__overlayCleanup) { try { G.__overlayCleanup(); } catch (e) {} G.__overlayCleanup = null; }
      G.__panel = null; G.__keypad = null; G.__check = null; G.__serum = null; G.__tv = null;
    }
  }

  function setHud() {
    if (!G || !G.def) return;
    var place = $("ap-place"), task = $("ap-task");
    if (place) place.textContent = G.def.name;
    if (task) task.textContent = step() ? step().task : "";
    var carry = [];
    if (G.code) carry.push("CODE " + G.code);
    if (G.wood) carry.push("wood: " + G.wood + "/3");
    if (G.closeCalls) carry.push("close calls: " + G.closeCalls);
    var c = $("ap-carry");
    if (c) c.textContent = carry.join("   ");
    var st = $("ap-state");
    if (st) {
      var seen = G.chasing > 0, looking = G.looking > 0;
      st.className = "ap-state" + (seen ? " seen" : G.player && G.player.hidden ? " hidden-ok" : "");
      st.textContent = seen ? "SEEN" : looking ? "SOMETHING HEARD YOU" : (G.player && G.player.hidden) ? "HIDDEN" : "";
    }
    var stage = $("ap-stage");
    if (stage) stage.classList.toggle("ap-hiding", !!(G.player && G.player.hidden));
  }

  /* how close the nearest one is, when she cannot see it yet */
  function updateInstinct() {
    var n = $("ap-instinct");
    if (!n || !G || !G.player) return;
    var best = 1e9;
    for (var i = 0; i < G.zombies.length; i++) {
      var z = G.zombies[i];
      var d = Math.hypot(z.x - G.player.x, z.z - G.player.z);
      if (d < best) best = d;
    }
    var v = clamp(1 - best / (10 * TILE), 0, 1);
    n.setAttribute("aria-hidden", v < 0.06 ? "true" : "false");
    n.style.setProperty("--near", String(v * 0.9));
  }

  var alarmT = 0;
  function showAlarm(r) {
    var a = $("ap-alarm");
    if (!a || r <= 0) return;
    alarmT = 0.45;
    a.setAttribute("aria-hidden", "false");
    a.style.opacity = "1";
  }
  function updateAlarm(dt) {
    if (alarmT <= 0) return;
    alarmT -= dt;
    var a = $("ap-alarm");
    if (!a) return;
    a.style.opacity = String(clamp(alarmT / 0.45, 0, 1));
    if (alarmT <= 0) a.setAttribute("aria-hidden", "true");
  }

  /* ---- a plate with words on it ---- */
  function card(kicker, title, rows, buttonText, onGo, quitText, onQuit) {
    var c = el("div", "ap-card");
    c.appendChild(el("p", "ap-card-kicker", kicker));
    c.appendChild(el("h3", "ap-card-title", title));
    if (rows && rows.length) {
      var list = el("div", "ap-card-rows");
      rows.forEach(function (r) {
        var row = el("div", "ap-card-row");
        row.appendChild(el("b", null, r[0]));
        row.appendChild(el("span", null, r[1]));
        list.appendChild(row);
      });
      c.appendChild(list);
    }
    if (buttonText) {
      var b = el("button", "ap-card-go", buttonText);
      b.addEventListener("click", onGo);
      c.appendChild(b);
    }
    if (quitText) {
      var q = el("button", "ap-card-quit", quitText);
      q.addEventListener("click", onQuit);
      c.appendChild(q);
    }
    return c;
  }

  /* ---- dialogue ---- */
  function say(lines, done) {
    G.dlg = { lines: lines.slice(), i: 0, done: done };
    G.state = "dialogue";
    nextLine();
  }

  function nextLine() {
    var d = G.dlg;
    var box = $("ap-dlg");
    if (!d || d.i >= d.lines.length) {
      if (box) box.setAttribute("aria-hidden", "true");
      G.dlg = null;
      if (G.state === "dialogue") G.state = "play";
      if (d && d.done) d.done();
      return;
    }
    var line = d.lines[d.i++];
    var speaker = line[0], text = line[1];
    var quiet = !speaker && !text;
    if (box) {
      $("ap-dlg-name").textContent = speaker || "";
      $("ap-dlg-text").textContent = quiet ? "…" : (text || "");
      box.classList.toggle("quiet", quiet);
      box.classList.toggle("narration", !speaker && !quiet);
      box.setAttribute("aria-hidden", "false");
    }
    if (!quiet && speaker) Audio_.beep();
  }

  /* ---- the close call ---- */
  function showCloseCall() {
    var c = el("div", "ap-close");
    c.appendChild(el("p", "ap-close-line", pick(CLOSE_LINES)));
    c.appendChild(el("p", "ap-close-sub", "you're all right. keep going."));
    openOverlay(c, "thin");
  }

  /* ---- the emergency broadcast ---- */
  function paintBroadcast(cv, t) {
    var x = cv.getContext("2d"), W = cv.width, H = cv.height;
    var drop = Math.max(0, Math.sin(t * 0.7) * Math.sin(t * 2.3) - 0.72) * 3.4;   /* the signal going */

    /* the studio, most of its lights off */
    var g = x.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#101a26"); g.addColorStop(0.62, "#16222f"); g.addColorStop(1, "#0a0f16");
    x.fillStyle = g; x.fillRect(0, 0, W, H);
    /* a pool of light on the back wall, and the one that is still working */
    var lg = x.createRadialGradient(W * 0.30, H * 0.30, 2, W * 0.30, H * 0.30, W * 0.42);
    lg.addColorStop(0, "rgba(120,150,190,.30)"); lg.addColorStop(1, "rgba(120,150,190,0)");
    x.fillStyle = lg; x.fillRect(0, 0, W, H);

    /* the emergency triangle on the wall behind them */
    x.save();
    x.translate(W * 0.70, H * 0.32);
    x.globalAlpha = 0.9;
    x.beginPath(); x.moveTo(0, -20); x.lineTo(20, 16); x.lineTo(-20, 16); x.closePath();
    x.fillStyle = "#c8a832"; x.fill();
    x.fillStyle = "#141414"; x.fillRect(-2.4, -10, 4.8, 16); x.fillRect(-2.4, 9, 4.8, 4.4);
    x.restore();

    /* somebody still sitting at the desk who should have gone home */
    var cx0 = W * 0.34, base = H * 0.74;
    x.fillStyle = "#1d2a38";
    x.beginPath();
    x.moveTo(cx0 - 30, base); x.lineTo(cx0 - 20, base - 40);
    x.quadraticCurveTo(cx0, base - 52, cx0 + 20, base - 40);
    x.lineTo(cx0 + 30, base); x.closePath(); x.fill();
    x.fillStyle = "#8a6a52";
    x.beginPath(); x.ellipse(cx0, base - 52, 11, 13, 0, 0, 6.2832); x.fill();
    x.fillStyle = "#2b1f18";
    x.beginPath(); x.ellipse(cx0, base - 58, 11.5, 8, 0, Math.PI, 0); x.fill();
    /* the desk */
    x.fillStyle = "#0d1620"; x.fillRect(0, base + 2, W, H - base);
    x.fillStyle = "#16222e"; x.fillRect(0, base, W, 4);

    /* the chyron */
    var barY = H - 34;
    x.fillStyle = "rgba(6,10,16,.86)"; x.fillRect(0, barY, W, 34);
    x.fillStyle = "#b8342f"; x.fillRect(0, barY, W, 3);
    var line = TV_LINES[Math.floor(t / 3.4) % TV_LINES.length];
    x.fillStyle = "#e8eef8";
    x.font = "bold 10px monospace";
    x.textAlign = "left";
    x.fillText(line.slice(0, 44), 7, barY + 15);
    /* the ticker under it, going round */
    x.fillStyle = "#0a0f16"; x.fillRect(0, barY + 20, W, 14);
    x.fillStyle = "#f0c05a"; x.font = "9px monospace";
    var tick = TV_TICKER + TV_TICKER + TV_TICKER;
    var off = (t * 46) % (TV_TICKER.length * 5.42);
    x.save(); x.beginPath(); x.rect(0, barY + 20, W, 14); x.clip();
    x.fillText(tick, 6 - off, barY + 30);
    x.restore();

    /* scanlines, and the tear when the signal drops */
    x.globalAlpha = 0.16; x.fillStyle = "#000";
    for (var yy = 0; yy < H; yy += 3) x.fillRect(0, yy, W, 1);
    x.globalAlpha = 1;
    if (drop > 0.02) {
      var sh = Math.floor(drop * 12);
      var band = x.getImageData(0, Math.floor(H * 0.3), W, 26);
      x.putImageData(band, sh, Math.floor(H * 0.3));
      x.fillStyle = "rgba(200,220,255,.14)";
      x.fillRect(0, Math.floor(H * 0.3) - 3, W, 3);
    }
    /* static over all of it, heavier as the signal goes */
    var amount = 0.05 + drop * 0.10;
    var img = x.getImageData(0, 0, W, H), d = img.data;
    for (var i = 0; i < d.length; i += 4) {
      if (Math.random() > amount) continue;
      var v = Math.random() * 255;
      d[i] = v; d[i + 1] = v; d[i + 2] = v;
    }
    x.putImageData(img, 0, 0);
    /* the glass */
    var vg = x.createRadialGradient(W / 2, H / 2, H * 0.25, W / 2, H / 2, W * 0.72);
    vg.addColorStop(0, "rgba(0,0,0,0)"); vg.addColorStop(1, "rgba(0,0,0,.55)");
    x.fillStyle = vg; x.fillRect(0, 0, W, H);
  }

  function showTV() {
    var wrap = el("div", "ap-tv");
    var set = el("div", "ap-tv-set");
    var screen = el("div", "ap-tv-screen");
    var cv = document.createElement("canvas");
    cv.className = "ap-tv-canvas"; cv.width = 256; cv.height = 168;
    screen.appendChild(cv);
    screen.appendChild(el("span", "ap-tv-scan"));
    screen.appendChild(el("span", "ap-tv-glass"));
    var side = el("div", "ap-tv-side");
    side.appendChild(el("span", "ap-tv-dial"));
    side.appendChild(el("span", "ap-tv-dial small"));
    side.appendChild(el("span", "ap-tv-grille"));
    set.appendChild(screen); set.appendChild(side);
    wrap.appendChild(set);
    wrap.appendChild(el("span", "ap-tv-feet"));
    wrap.appendChild(el("p", "ap-tv-cap", "It has been saying the same four things since this morning."));
    var b = el("button", "ap-card-go", "TURN IT OFF");
    b.addEventListener("click", function () {
      G.__tv = null;
      closeOverlay();
      G.state = "play";
      clearStep("tv");
      Audio_.static(0.3, 0.07);
    });
    wrap.appendChild(b);
    openOverlay(wrap);
    G.__tv = cv;
    Audio_.static(1.4, 0.05);
  }

  /* ---- the radio ---- */
  function showRadio(done) {
    var wrap = el("div", "ap-radio");
    var set = el("div", "ap-radio-set");
    var grille = el("div", "ap-radio-grille");
    var dial = el("div", "ap-radio-dial");
    var needle = el("span", "ap-radio-needle");
    dial.appendChild(needle);
    var knob = el("span", "ap-radio-knob");
    set.appendChild(grille); set.appendChild(dial); set.appendChild(knob);
    wrap.appendChild(set);
    var line = el("p", "ap-radio-line", RADIO_LINES[0]);
    wrap.appendChild(line);
    wrap.appendChild(el("p", "ap-radio-cap", "It has been on the whole time."));
    var i = 0;
    var b = el("button", "ap-card-go", "LISTEN");
    b.addEventListener("click", function () {
      i++;
      Audio_.tune();
      if (i >= RADIO_LINES.length) { closeOverlay(); G.state = "play"; if (done) done(); return; }
      line.textContent = RADIO_LINES[i];
      if (i === RADIO_LINES.length - 1) b.textContent = "ASHCOMBE";
    });
    wrap.appendChild(b);
    openOverlay(wrap);
    Audio_.tune();
  }

  /* ---- the note with the code on it ---- */
  function showNote() {
    var wrap = el("div", "ap-note");
    wrap.appendChild(el("span", "ap-note-tape"));
    wrap.appendChild(el("p", "ap-note-body", "staff gate — back of the parade"));
    wrap.appendChild(el("p", "ap-note-code", GATE_CODE));
    wrap.appendChild(el("p", "ap-note-after", "somebody biroed it on the back of a rota so they would stop being called out at night."));
    var b = el("button", "ap-note-ok", "TAKE IT");
    b.addEventListener("click", function () {
      G.code = GATE_CODE;
      closeOverlay();
      G.state = "play";
      Audio_.found();
      setHud();
    });
    wrap.appendChild(b);
    openOverlay(wrap);
  }

  /* ---- the keypad on the staff gate ---- */
  function showKeypad(door) {
    var wrap = el("div", "ap-keypad");
    wrap.appendChild(el("p", "ap-keypad-title", "STAFF ONLY"));
    var glass = el("div", "ap-keypad-glass");
    var disp = el("p", "ap-keypad-disp", "____");
    glass.appendChild(disp);
    glass.appendChild(el("span", "ap-keypad-scan"));
    wrap.appendChild(glass);
    var pad = el("div", "ap-keypad-pad");
    var entry = "";
    function draw() { disp.textContent = (entry + "____").slice(0, 4); }
    ["1","2","3","4","5","6","7","8","9","CLR","0","GO"].forEach(function (k) {
      var b = el("button", "ap-key-btn" + (k === "GO" ? " go" : k === "CLR" ? " clr" : ""), k);
      b.addEventListener("click", function () {
        if (k === "CLR") { entry = ""; Audio_.keyBad(); draw(); return; }
        if (k === "GO") {
          if (entry === GATE_CODE) {
            Audio_.keyOk();
            door.locked = false; door.want = 1;
            noise(G.world.cx(door.x), G.world.cz(door.y), TUNE.noiseDoor);
            closeOverlay(); G.state = "play";
          } else { Audio_.keyBad(); entry = ""; draw(); wrap.classList.add("bad");
                   setTimeout(function () { wrap.classList.remove("bad"); }, 300); }
          return;
        }
        if (entry.length < 4) { entry += k; Audio_.beep(); draw(); }
      });
      pad.appendChild(b);
    });
    wrap.appendChild(pad);
    var leave = el("button", "ap-panel-leave", "step back");
    leave.addEventListener("click", function () { closeOverlay(); G.state = "play"; });
    wrap.appendChild(leave);
    openOverlay(wrap);
    G.__keypad = { enter: function (s) { entry = s; draw(); },
                   go: function () { pad.lastChild.click(); } };
    draw();
  }

  /* ---- the wire panel ----
     A salvaged board with the cover off. Four cores hanging out of the
     loom on the left, four terminals on the right, and no labels — the
     colours are the only thing telling you what goes where. Getting it
     wrong arcs, and an arc is the loudest thing she can do. */
  function showPanel(onDone) {
    var COLOURS = [
      { name: "red",    hex: "#d8484a", core: "#8a2a2c" },
      { name: "green",  hex: "#4ec46e", core: "#2a7a40" },
      { name: "blue",   hex: "#4a90d8", core: "#2a5a8a" },
      { name: "yellow", hex: "#e8c44a", core: "#8a7420" }
    ];
    var order = [0, 1, 2, 3].sort(function () { return Math.random() - 0.5; });

    var wrap = el("div", "ap-panel");
    wrap.appendChild(el("p", "ap-panel-title", "DISTRIBUTION BOARD — SUB 3"));
    var cv = document.createElement("canvas");
    cv.className = "ap-panel-canvas";
    cv.width = 420; cv.height = 260;
    wrap.appendChild(cv);
    var hint = el("p", "ap-panel-hint", "drag each core across to the terminal of the same colour. it will arc if you get it wrong, and everything nearby will hear that.");
    wrap.appendChild(hint);
    var leave = el("button", "ap-panel-leave", "step back");
    leave.addEventListener("click", function () { closeOverlay(); G.state = "play"; });
    wrap.appendChild(leave);
    openOverlay(wrap);

    var x = cv.getContext("2d");
    var done = [false, false, false, false];
    var drag = null, sparkT = 0, sparkAt = null, t0 = performance.now();

    function wireY(i) { return 52 + i * 56; }
    function sockY(i) { return 52 + i * 56; }
    var WX = 96, SX = 324;

    function draw() {
      var t = (performance.now() - t0) / 1000;
      /* the board itself */
      x.fillStyle = "#2a2c30"; x.fillRect(0, 0, cv.width, cv.height);
      var g = x.createLinearGradient(0, 0, 0, cv.height);
      g.addColorStop(0, "rgba(255,255,255,.07)"); g.addColorStop(1, "rgba(0,0,0,.35)");
      x.fillStyle = g; x.fillRect(0, 0, cv.width, cv.height);
      for (var i = 0; i < 900; i++) {
        x.fillStyle = "rgba(0,0,0,.05)";
        x.fillRect(Math.random() * cv.width, Math.random() * cv.height, 1, 1);
      }
      /* four screws */
      [[12, 12], [cv.width - 12, 12], [12, cv.height - 12], [cv.width - 12, cv.height - 12]].forEach(function (p) {
        x.fillStyle = "#6a6f78"; x.beginPath(); x.arc(p[0], p[1], 5, 0, 6.2832); x.fill();
        x.strokeStyle = "#23262b"; x.lineWidth = 1.6;
        x.beginPath(); x.moveTo(p[0] - 3, p[1] - 3); x.lineTo(p[0] + 3, p[1] + 3); x.stroke();
      });
      /* the loom the cores come out of */
      x.fillStyle = "#17191d"; x.fillRect(30, 26, 46, 200);
      x.fillStyle = "#3a3e46"; x.fillRect(30, 26, 46, 8);

      /* terminals */
      for (var s = 0; s < 4; s++) {
        var c = COLOURS[order[s]];
        var sy = sockY(s);
        x.fillStyle = "#15171b"; x.fillRect(SX - 6, sy - 16, 62, 32);
        x.fillStyle = "#4a4f58"; x.fillRect(SX - 2, sy - 12, 54, 24);
        x.fillStyle = c.hex; x.globalAlpha = done.indexOf(order[s]) >= 0 ? 1 : 0.55;
        x.beginPath(); x.arc(SX + 10, sy, 9, 0, 6.2832); x.fill();
        x.globalAlpha = 1;
        x.strokeStyle = "#0d0e11"; x.lineWidth = 2;
        x.beginPath(); x.arc(SX + 10, sy, 9, 0, 6.2832); x.stroke();
        /* the screw that clamps it */
        x.fillStyle = "#8a9098"; x.beginPath(); x.arc(SX + 36, sy, 5, 0, 6.2832); x.fill();
      }

      /* the cores, and anything already landed */
      for (var w = 0; w < 4; w++) {
        var col = COLOURS[w], wy = wireY(w);
        var landedIdx = -1;
        for (var k = 0; k < 4; k++) if (order[k] === w) landedIdx = k;
        var isDone = done[w];
        var ex = isDone ? SX + 10 : WX, ey = isDone ? sockY(landedIdx) : wy;
        if (drag && drag.wire === w) { ex = drag.x; ey = drag.y; }

        x.strokeStyle = col.core; x.lineWidth = 8; x.lineCap = "round";
        x.beginPath();
        x.moveTo(70, wy);
        var sag = isDone ? 26 : 16;
        x.bezierCurveTo(70 + (ex - 70) * 0.35, wy + sag, 70 + (ex - 70) * 0.7, ey + sag, ex, ey);
        x.stroke();
        x.strokeStyle = col.hex; x.lineWidth = 5;
        x.beginPath();
        x.moveTo(70, wy);
        x.bezierCurveTo(70 + (ex - 70) * 0.35, wy + sag, 70 + (ex - 70) * 0.7, ey + sag, ex, ey);
        x.stroke();
        /* the stripped end */
        x.fillStyle = isDone ? "#d8dde4" : "#b8bec8";
        x.beginPath(); x.arc(ex, ey, 7, 0, 6.2832); x.fill();
        if (isDone) {
          x.fillStyle = "rgba(120,255,180,.5)";
          x.beginPath(); x.arc(ex, ey, 12 + Math.sin(t * 4 + w) * 2, 0, 6.2832); x.fill();
        }
      }

      /* the arc */
      if (sparkT > 0 && sparkAt) {
        x.strokeStyle = "rgba(200,235,255," + clamp(sparkT * 3, 0, 1) + ")";
        x.lineWidth = 2;
        for (var b = 0; b < 6; b++) {
          x.beginPath();
          var px = sparkAt.x, py = sparkAt.y;
          x.moveTo(px, py);
          for (var seg = 0; seg < 5; seg++) {
            px += rnd(-16, 16); py += rnd(-16, 16);
            x.lineTo(px, py);
          }
          x.stroke();
        }
        x.fillStyle = "rgba(255,255,255," + clamp(sparkT * 2, 0, 0.5) + ")";
        x.fillRect(0, 0, cv.width, cv.height);
      }

      /* how many left */
      var left = done.filter(function (d) { return !d; }).length;
      x.fillStyle = "#9fb0d8"; x.font = "12px monospace"; x.textAlign = "right";
      x.fillText(left ? left + " CORE" + (left > 1 ? "S" : "") + " LOOSE" : "SUPPLY RESTORED", cv.width - 24, cv.height - 16);
    }

    function pos(e) {
      var r = cv.getBoundingClientRect();
      var p = e.touches ? e.touches[0] : e;
      return { x: (p.clientX - r.left) / r.width * cv.width,
               y: (p.clientY - r.top) / r.height * cv.height };
    }
    function down(e) {
      e.preventDefault();
      var p = pos(e);
      for (var w = 0; w < 4; w++) {
        if (done[w]) continue;
        if (Math.hypot(p.x - WX, p.y - wireY(w)) < 24) { drag = { wire: w, x: p.x, y: p.y }; return; }
      }
    }
    function move(e) {
      if (!drag) return;
      e.preventDefault();
      var p = pos(e); drag.x = p.x; drag.y = p.y;
    }
    function up(e) {
      if (!drag) return;
      e.preventDefault();
      var p = pos(e), hit = -1;
      for (var s = 0; s < 4; s++) if (Math.hypot(p.x - (SX + 10), p.y - sockY(s)) < 30) hit = s;
      if (hit >= 0) {
        if (order[hit] === drag.wire) {
          done[drag.wire] = true;
          Audio_.keyOk();
          if (done.every(Boolean)) {
            setTimeout(function () {
              closeOverlay();
              G.state = "play";
              if (onDone) onDone();
            }, 620);
          }
        } else {
          sparkT = 0.45; sparkAt = { x: SX + 10, y: sockY(hit) };
          Audio_.spark();
          noise(G.player.x, G.player.z, TUNE.noiseSpark);
          G.camRig.kick(0.14);
        }
      }
      drag = null;
    }
    cv.addEventListener("mousedown", down); cv.addEventListener("touchstart", down, { passive: false });
    window.addEventListener("mousemove", move); cv.addEventListener("touchmove", move, { passive: false });
    window.addEventListener("mouseup", up); cv.addEventListener("touchend", up, { passive: false });
    /* the panel is opened twice a chapter, and a drag needs the whole
       window to follow the pointer off the canvas — so both of those come
       back off when it closes */
    G.__overlayCleanup = function () {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };

    G.__panel = {
      canvas: cv,
      tick: function (dt) { if (sparkT > 0) sparkT -= dt; draw(); },
      solve: function () {
        done = [true, true, true, true];
        draw();
        setTimeout(function () { closeOverlay(); G.state = "play"; if (onDone) onDone(); }, 200);
      }
    };
    draw();
  }

  /* ---- the checkpoint at the gates ---- */
  function showCheck(onDone) {
    var wrap = el("div", "ap-check");
    wrap.appendChild(el("p", "ap-check-title", "ASHCOMBE RECEPTION — INTAKE"));
    wrap.appendChild(el("p", "ap-check-sub", "Both of you. They will not open the inner gate until every line is ticked."));
    var list = el("div", "ap-check-list");
    var rows = [
      ["Skin checked — arms, neck, hands", "OUISSY"],
      ["Skin checked — arms, neck, hands", "ANWAR"],
      ["Temperature taken", "both"],
      ["Serum administered", "both"]
    ];
    var state = rows.map(function () { return false; });
    var okBtn;
    rows.forEach(function (r, i) {
      var row = el("button", "ap-check-row");
      row.appendChild(el("span", "ap-check-box"));
      var tx = el("span", "ap-check-tx");
      tx.appendChild(el("b", null, r[0]));
      tx.appendChild(el("i", null, r[1]));
      row.appendChild(tx);
      row.addEventListener("click", function () {
        state[i] = !state[i];
        row.classList.toggle("on", state[i]);
        Audio_.keyOk();
        okBtn.disabled = !state.every(Boolean);
      });
      list.appendChild(row);
    });
    wrap.appendChild(list);
    wrap.appendChild(el("p", "ap-check-stamp", "NOT BITTEN"));
    okBtn = el("button", "ap-note-ok", "CLEARED");
    okBtn.disabled = true;
    okBtn.addEventListener("click", function () {
      closeOverlay(); G.state = "play"; Audio_.found();
      if (onDone) onDone();
    });
    wrap.appendChild(okBtn);
    openOverlay(wrap);
    G.__check = { all: function () { list.querySelectorAll(".ap-check-row").forEach(function (r) { r.click(); }); okBtn.click(); } };
  }

  /* ---- the serum ----
     The radio said both are required, so both happen. A barrel, a plunger
     that goes down when she presses it, and a needle. It is over in four
     seconds and nobody makes anything of it, which is the point. */
  function showSerum(onDone) {
    var wrap = el("div", "ap-serum");
    wrap.appendChild(el("p", "ap-check-title", "ASHCOMBE RECEPTION — INOCULATION"));
    var cv = document.createElement("canvas");
    cv.className = "ap-serum-canvas";
    cv.width = 320; cv.height = 150;
    wrap.appendChild(cv);
    var line = el("p", "ap-serum-line", "\u201cSleeve up. Small scratch. Don't watch it if you don't want to.\u201d");
    wrap.appendChild(line);
    var b = el("button", "ap-note-ok", "SLEEVE UP");
    wrap.appendChild(b);
    openOverlay(wrap);

    /* three states, not a boolean: ready, going in, and done. A single
       "done" flag both ended the animation and swallowed the press that
       was supposed to close the screen, which left her holding her sleeve
       up at Ashcombe forever. */
    var x = cv.getContext("2d"), given = 0, phase = 0, killed = false;
    G.__overlayCleanup = function () { killed = true; };
    function draw() {
      var W = cv.width, H = cv.height;
      var g = x.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, "#1b2130"); g.addColorStop(1, "#0d1119");
      x.fillStyle = g; x.fillRect(0, 0, W, H);
      /* the tray it came off */
      x.fillStyle = "#232a38"; x.fillRect(20, 108, W - 40, 22);
      x.fillStyle = "#2c3446"; x.fillRect(20, 108, W - 40, 4);

      var bx = 56, by = 62, bw = 150, bh = 26;
      /* barrel */
      x.fillStyle = "rgba(206,222,238,.22)";
      x.fillRect(bx, by, bw, bh);
      /* what is in it */
      var fill = bw * (1 - given);
      x.fillStyle = "#8fd8c4";
      x.fillRect(bx + (bw - fill), by + 3, fill, bh - 6);
      /* graduations */
      x.strokeStyle = "rgba(220,235,245,.5)"; x.lineWidth = 1;
      for (var i = 1; i < 6; i++) {
        x.beginPath(); x.moveTo(bx + i * bw / 6, by); x.lineTo(bx + i * bw / 6, by + 7); x.stroke();
      }
      x.strokeStyle = "rgba(220,235,245,.75)"; x.lineWidth = 2;
      x.strokeRect(bx, by, bw, bh);
      /* plunger, going in */
      var px0 = bx - 26 + given * (bw - 8);
      x.fillStyle = "#c8d4e2"; x.fillRect(px0, by + 4, 26, bh - 8);
      x.fillRect(px0 - 12, by - 6, 12, bh + 12);
      /* needle */
      x.fillStyle = "#aeb8c4"; x.fillRect(bx + bw, by + bh / 2 - 3, 16, 6);
      x.fillStyle = "#dde6ef"; x.fillRect(bx + bw + 16, by + bh / 2 - 1, 46, 2);
      /* a bead at the tip once it has gone in */
      if (given > 0.15) {
        x.fillStyle = "rgba(143,216,196," + (0.9 - given * 0.6) + ")";
        x.beginPath(); x.arc(bx + bw + 62, by + bh / 2, 2 + given * 2, 0, 6.2832); x.fill();
      }
      x.fillStyle = "#7f8bb0"; x.font = "10px monospace"; x.textAlign = "left";
      x.fillText(given >= 1 ? "DOSE GIVEN  x2" : "READY", 24, 124);
    }
    draw();

    function finished() {
      phase = 2;
      given = 1;
      draw();
      b.disabled = false;
      b.textContent = "THAT'S IT";
      line.textContent = "\u201cRight. Both of you are clean. Sit there till the gate goes.\u201d";
      Audio_.found();
    }

    b.addEventListener("click", function () {
      if (phase === 1) return;                       /* it is going in */
      if (phase === 0) {
        phase = 1;
        b.disabled = true;
        Audio_.beep();
        var t0 = performance.now();
        (function step() {
          if (killed) return;
          given = clamp((performance.now() - t0) / 1400, 0, 1);
          draw();
          if (given < 1) requestAnimationFrame(step);
          else finished();
        })();
        return;
      }
      closeOverlay();
      G.state = "play";
      if (onDone) onDone();
    });

    G.__serum = {
      give: function () { b.click(); },
      finish: function () { if (phase !== 2) finished(); b.click(); }
    };
  }

  /* ---- pause ---- */
  function togglePause() {
    if (!G) return;
    if (G.state === "paused") { closeOverlay(); G.state = G.__wasState || "play"; return; }
    if (G.state === "overlay" || G.state === "cine") return;
    G.__wasState = G.state;
    G.state = "paused";
    openOverlay(card("PAUSED", G.def ? G.def.name : "", [
      ["MOVE", "arrows or WASD"],
      ["CREEP", "hold shift — slower, almost silent"],
      ["USE", "E or space"],
      ["THE DARK", "you only see as far as your torch"]
    ], "BACK TO IT", function () { closeOverlay(); G.state = G.__wasState || "play"; },
       "LEAVE THE CHAPTER", function () {
         closeOverlay();
         if (window.leaveApocalypse) window.leaveApocalypse();
         else Api.stop();
       }));
    G.state = "paused";
  }

  /* =========================================================
     22 — USING THINGS
     ========================================================= */
  function nearThings(range) {
    var p = G.player, w = G.world, out = [];
    var ptx = Math.floor(p.x / TILE), pty = Math.floor(p.z / TILE);
    var r = range || 1;
    for (var j = -r; j <= r; j++) for (var i = -r; i <= r; i++) {
      var tx = ptx + i, ty = pty + j;
      var c = w.at(tx, ty);
      if (c === " ") continue;
      var d = Math.hypot(w.cx(tx) - p.x, w.cz(ty) - p.z);
      if (d > TILE * 1.5) continue;
      out.push({ c: c, tx: tx, ty: ty, d: d });
    }
    /* Standing between the car and a dropped bottle, she reaches for the
       car. Sorting on distance alone let a piece of scenery an identical
       distance away win the tie and eat the press. */
    var RANK = { C: 0, H: 0, A: 0, W: 0, T: 0, N: 0, Q: 0, G: 0, w: 0, g: 0,
                 d: 1, D: 1, P: 1, i: 3, q: 3 };
    out.sort(function (a, b) {
      var ra = RANK[a.c] == null ? 2 : RANK[a.c];
      var rb = RANK[b.c] == null ? 2 : RANK[b.c];
      if (ra !== rb) return ra - rb;
      return a.d - b.d;
    });
    return out;
  }

  function tryUse() {
    if (!G || G.state !== "play") return;
    var w = G.world, p = G.player;
    var list = nearThings(1);

    /* him first — she is not going to walk past him to open a door */
    if (G.anwar && !G.anwar.found) {
      var da = Math.hypot(G.anwar.x - p.x, G.anwar.z - p.z);
      if (da < TILE * 1.8) { wakeAnwar(); return; }
    }
    if (G.horse) {
      var dh = Math.hypot(G.horse.x - p.x, G.horse.z - p.z);
      if (dh < TILE * 2.2) { meetHorse(); return; }
    }

    for (var i = 0; i < list.length; i++) {
      var it = list[i], c = it.c;

      if (c === "T") { showTV(); return; }
      if (c === "W") {
        showPanel(function () {
          w.powered = true;
          /* every dead door in the building lets go at once */
          w.doors.forEach(function (d) { if (d.kind === "P") { d.locked = false; d.want = 1; } });
          noise(p.x, p.z, TUNE.noiseDoor);
          Audio_.found();
          clearStep("panel");
        });
        return;
      }
      if (c === "N") { showNote(); return; }
      if (c === "i") { pickUp(it); return; }
      if (c === "C") { takeTheCar(); return; }
      if (c === "w" || c === "g") { gatherWood(it); return; }
      if (c === "Q") { atTheDesk(); return; }

      if ("dDPG".indexOf(c) >= 0) {
        var d = doorAtTile(w, it.tx, it.ty);
        if (!d) continue;
        if (d.open > 0.5) { d.want = 0; Audio_.door(); return; }
        if (d.kind === "D" && d.locked) {
          if (!G.code) { say([[null, "There is a keypad on it. She does not have the number."]]); return; }
          showKeypad(d); return;
        }
        if (d.kind === "P" && d.locked) {
          say([[null, "Dead. Whatever runs this door is not running."]]);
          return;
        }
        if (d.kind === "G" && d.locked) { hailTheGate(); return; }
        d.want = 1;
        Audio_.door();
        noise(w.cx(it.tx), w.cz(it.ty), TUNE.noiseDoor);
        return;
      }
    }

    /* the fire pit, once she has the wood */
    if (w.firePitAt) {
      var dp = Math.hypot(w.cx(w.firePitAt.x) - p.x, w.cz(w.firePitAt.y) - p.z);
      if (dp < TILE * 2.2 && step() && step().clears === "fire") { lightTheFire(); return; }
    }
    say([[null, "Nothing here."]]);
  }

  function pickUp(it) {
    /* the small finds: a torch battery, a bottle of water, somebody's
       keys. They are not inventory — they are a reason to look around. */
    var lines = [
      "A bottle of water, still cold. She drinks half of it and puts the rest in her coat.",
      "Somebody's keys. She puts them down again.",
      "Batteries. She swaps them into the torch and the beam comes back up.",
      "A phone with no signal and eleven percent left. She takes it anyway.",
      "A packet of biscuits. She eats two of them standing up."
    ];
    say([[null, pick(lines)]]);
    Audio_.found();
    /* take it out of the world */
    for (var i = 0; i < G.world.things.length; i++) {
      var t = G.world.things[i];
      if (t.kind === "item" && t.x === it.tx && t.y === it.ty && t.group) {
        t.group.visible = false;
        G.world.cells[it.ty][it.tx] = G.def.base || ".";
      }
    }
  }

  /* =========================================================
     23 — BEING CAUGHT
     Not a death. A hand on her arm, a second of answering it,
     and then she is somewhere further back than she was.
     ========================================================= */
  function beginGrab(z) {
    if (G.state !== "play") return;
    G.state = "grab";
    G.grab = { z: z, t: TUNE.grabWindow, presses: 0, start: anyPressed };
    Audio_.caught();
    G.camRig.kick(0.5);
    var box = $("ap-grab");
    if (box) {
      box.setAttribute("aria-hidden", "false");
      var bar = box.querySelector(".ap-grab-bar i");
      if (bar) bar.style.width = "100%";
    }
  }

  function updateGrab(dt) {
    var g = G.grab;
    if (!g) return;
    g.t -= dt;
    g.presses = anyPressed - g.start;
    G.redPulse = 0.35 + Math.sin(G.time * 22) * 0.14;
    var box = $("ap-grab");
    if (box) {
      var bar = box.querySelector(".ap-grab-bar i");
      if (bar) bar.style.width = clamp(g.t / TUNE.grabWindow, 0, 1) * 100 + "%";
    }
    /* she pulls the arm back and it lets go */
    if (g.presses >= 2) { endGrab(true); return; }
    if (g.t <= 0) endGrab(false);
  }

  function endGrab(broke) {
    var g = G.grab;
    G.grab = null;
    var box = $("ap-grab");
    if (box) box.setAttribute("aria-hidden", "true");
    if (broke) {
      /* she gets away with it: it staggers back and loses her */
      G.state = "play";
      G.redPulse = 0;
      if (g && g.z) {
        g.z.state = "look"; g.z.timer = 1.2;
        g.z.x -= Math.cos(g.z.facing) * TILE * 0.8;
        g.z.z -= Math.sin(g.z.facing) * TILE * 0.8;
      }
      Audio_.thump(0.14);
      G.camRig.kick(0.22);
      return;
    }
    closeCall();
  }

  function closeCall() {
    G.closeT = TUNE.caughtHold;
    G.closeCalls++;
    G.redPulse = 0.5;
    Audio_.heart(2);
    /* the beat is put up first: openOverlay claims the state for itself,
       and claiming it after would leave the hold running forever */
    showCloseCall();
    G.state = "close";
    setHud();
  }

  function endCloseCall() {
    var p = G.player;
    p.x = p.safe.x; p.z = p.safe.z;
    p.vx = p.vz = 0;
    G.camRig.snap();
    G.redPulse = 0;
    /* everything that was after her forgets where she went */
    G.zombies.forEach(function (z) {
      z.state = "calm"; z.look = null; z.lose = 0; z.timer = rnd(1, 3);
      var d = Math.hypot(z.x - p.x, z.z - p.z);
      if (d < 5 * TILE) {
        var a = Math.atan2(z.z - p.z, z.x - p.x);
        z.x += Math.cos(a) * TILE * 2.5;
        z.z += Math.sin(a) * TILE * 2.5;
      }
    });
    closeOverlay();
    G.state = "play";
  }

  /* =========================================================
     24 — THE HOSPITAL FILLS UP
     Nobody tells her this is happening.
     ========================================================= */
  function updatePressure(dt) {
    if (!G.def.pressure) return;
    G.pressureT += dt;
    G.pressure = clamp(G.zombies.length / 22, 0, 1);
    Audio_.pressure(G.pressure);
    if (G.pressureT >= G.def.pressure && G.zombies.length < 24) {
      G.pressureT = 0;
      var w = G.world;
      /* they come in the front, which is the bottom of the map */
      var entry = nearestFree(w, Math.floor(w.w / 2), w.h - 3);
      var z = makeZ(w, G.scene, entry.x, entry.y, G.zombies.length + 7, "drawn");
      z.state = "look";
      z.look = { x: G.player.x, z: G.player.z };
      z.timer = TUNE.zInvestigate * 2;
      G.zombies.push(z);
      Audio_.thump(0.06);
    }
  }

  /* =========================================================
     25 — THE BEATS
     ========================================================= */
  function wakeAnwar() {
    var a = G.anwar;
    if (!a || a.found) return;
    a.found = true;
    G.state = "dialogue";
    /* he gets up: off his side, off the bed, onto his feet beside it */
    var spot = a.bedAt ? nearestFree(G.world, a.bedAt.x, a.bedAt.y + 1) : null;
    var toX = spot ? G.world.cx(spot.x) : a.x;
    var toZ = spot ? G.world.cz(spot.y) : a.z;
    var fromX = a.x, fromZ = a.z, t0 = 0;
    G.anim = function (dt) {
      t0 += dt;
      var k = clamp(t0 / 1.4, 0, 1);
      var e = k * k * (3 - 2 * k);
      a.rig.root.rotation.x = -Math.PI / 2 * (1 - e);
      a.x = lerp(fromX, toX, e);
      a.z = lerp(fromZ, toZ, e);
      a.rig.root.position.set(a.x, 0.86 * (1 - e), a.z);
      poseHuman(a.rig, G.time, 0, null, { crouch: 0.6 * (1 - e) });
      if (k >= 1) {
        a.rig.contact.visible = true;
        G.anim = null;
      }
    };
    say(TALK.wake, function () {
      a.following = true;
      a.asleep = false;
      G.withAnwar = true;
      clearStep("anwar");
    });
  }

  function meetHorse() {
    if (!G.horse || G.horse.met) return;
    G.horse.met = true;
    Audio_.hoof();
    say(TALK.horse, function () {
      clearStep("horse");
    });
  }

  function takeTheCar() {
    if (G.__carTaken) return;
    G.__carTaken = true;
    Audio_.engine("start");
    say([
      [null, "The key is in it. Somebody meant to come back."],
      [null, "It turns over twice, and catches."]
    ], function () {
      clearStep("car");
    });
  }

  function gatherWood(it) {
    if (G.__gathering) return;
    G.wood = G.wood || 0;
    if (G.wood >= 3) return;
    G.__gathering = true;
    var idx = G.wood;
    G.wood++;
    setHud();
    Audio_.found();
    /* take that pile out of the world so she cannot farm it */
    for (var i = 0; i < G.world.things.length; i++) {
      var t = G.world.things[i];
      if ((t.kind === "wood" || t.kind === "gather") && t.x === it.tx && t.y === it.ty) {
        if (t.group) t.group.visible = false;
        G.world.cells[it.ty][it.tx] = ",";
      }
    }
    say(TALK.wood[idx], function () {
      G.__gathering = false;
      if (G.wood >= 3) clearStep("wood");
    });
  }

  function lightTheFire() {
    if (G.__lighting) return;
    G.__lighting = true;
    say(TALK.fire, function () {
      var f = G.world.fire;
      if (f) {
        f.visible = true;
        f.userData.strength = 0;
        var t0 = 0;
        G.anim = function (dt) {
          t0 += dt;
          f.userData.strength = clamp(t0 / 2.2, 0, 1);
          if (t0 > 2.4) G.anim = null;
        };
      }
      Audio_.fire();
      clearStep("fire");
    });
  }

  function atTheDesk() {
    if (!step() || step().clears !== "check") { say([[null, "There is nobody at the table yet."]]); return; }
    showCheck(function () {
      showSerum(function () { clearStep("check"); openGates(); });
    });
  }

  function hailTheGate() {
    if (step() && step().clears === "hail") {
      say([
        [null, "There is somebody in a high-vis on the other side of the wire, and they have seen her coming for about a mile."],
        [null, "“Stop there. Both of you. Hands where I can see them.”"],
        [null, "“Right. Through, and sit at the table. Don't touch anything.”"]
      ], function () {
        clearStep("hail");
        /* the outer gate rolls back */
        G.world.doors.forEach(function (d) {
          if (d.kind === "G" && d.x < G.world.w / 2) { d.locked = false; d.want = 1; }
        });
        Audio_.door();
      });
      return;
    }
    say([[null, "It is not open yet."]]);
  }

  function openGates() {
    G.world.doors.forEach(function (d) { if (d.kind === "G") { d.locked = false; d.want = 1; } });
    Audio_.door();
  }

  /* =========================================================
     26 — WHERE EACH LEVEL GOES NEXT
     ========================================================= */
  function onLevelDone() {
    var id = G.def.id;
    if (id === "home")      { fadeTo(function () { levelCard(1); }); return; }
    if (id === "streets")   { fadeTo(function () { levelCard(2); }); return; }
    if (id === "hospital")  { afterHospital(); return; }
    if (id === "escape")    { fadeTo(function () { playDrive(); }); return; }
    if (id === "roadside")  { fadeTo(function () { playRide(); }); return; }
    if (id === "campsite")  { afterFire(); return; }
    if (id === "gates")     { fadeTo(function () { playRooftop(); }); return; }
  }

  function afterHospital() {
    /* the room with the bolt on the door */
    G.state = "dialogue";
    say(TALK.hide, function () {
      showRadio(function () {
        fadeTo(function () { levelCard(3); });
      });
    });
  }

  function afterFire() {
    say(TALK.lit, function () {
      say(TALK.campfire, function () {
        fadeTo(function () { playCampfire(); });
      });
    });
  }

  /* =========================================================
     27 — FADES
     ========================================================= */
  function fadeTo(then) {
    if (!G) { then(); return; }
    G.fadeTo = 0;
    G.fadeThen = then;
  }

  function updateFade(dt) {
    if (G.fade === G.fadeTo) {
      if (G.fadeThen && G.fade <= 0.001) { var f = G.fadeThen; G.fadeThen = null; f(); }
      return;
    }
    G.fade = damp(G.fade, G.fadeTo, 0.22, dt);
    if (Math.abs(G.fade - G.fadeTo) < 0.008) {
      G.fade = G.fadeTo;
      if (G.fadeThen && G.fade <= 0.001) { var g = G.fadeThen; G.fadeThen = null; g(); }
    }
    Stage.grade({ fade: G.fade });
  }

  /* =========================================================
     28 — THE CUTS
     Each of these is a scene of its own with its own camera. The
     game's scene is left alone underneath and picked up again
     afterwards, or thrown away if the story has moved on.
     ========================================================= */
  function caption(text) {
    var o = overlay();
    o.innerHTML = "";
    o.className = "ap-overlay cut";
    o.style.background = "transparent";
    o.style.alignItems = "flex-end";
    o.style.justifyContent = "center";
    o.style.paddingBottom = "5%";
    o.style.pointerEvents = "none";
    if (text) o.appendChild(el("p", "ap-cut-cap", text));
    o.setAttribute("aria-hidden", "false");
  }

  /* the cuts build their own skies, so they get their own cube */
  function cineEnvironment(scene, sky, palName, dark) {
    if (!Stage.renderer) return;
    try {
      scene.environment = buildEnvironment(Stage.renderer, sky, PAL[palName] || PAL.street, dark);
      scene.environmentIntensity = dark > 0.55 ? 0.5 : 0.95;
    } catch (e) {}
  }

  function runCine(c) {
    G.state = "cine";
    G.dlg = null;
    var box = $("ap-dlg");
    if (box) box.setAttribute("aria-hidden", "true");
    G.cine = c;
    G.cine.t = 0;
    var hud = $("ap-hud");
    if (hud) hud.classList.add("gone");
    Stage.attach(c.scene, c.camera);
    try { Stage.renderer.compile(c.scene, c.camera); } catch (e) {}
    Stage.grade(c.grade || {});
    Stage.grade({ fade: 1 });
    G.fade = 1; G.fadeTo = 1;
    caption(c.caption || "");
  }

  function disposeScene(scene) {
    if (!scene) return;
    var shared = [];
    for (var k in GEO) shared.push(GEO[k]);
    scene.traverse(function (o) {
      if (o.geometry && shared.indexOf(o.geometry) < 0 && o.geometry.dispose) o.geometry.dispose();
      if (o.isInstancedMesh && o.dispose) o.dispose();
    });
  }

  function endCine(then) {
    if (G.cine) disposeScene(G.cine.scene);
    G.cine = null;
    var hud = $("ap-hud");
    if (hud) hud.classList.remove("gone");
    closeOverlay();
    if (then) then();
  }

  /* ---- rolling country, used by the drive and the ride ---- */
  function landscape(scene, opts) {
    var far = opts.far || 0x1a2038, mid = opts.mid || 0x232a44, near = opts.near || 0x2c3450;
    var lengths = [1400, 1100, 900];
    [[ -160, far, 46, 0.9 ], [ -105, mid, 34, 1.0 ], [ -62, near, 24, 1.1 ]].forEach(function (L, li) {
      var z = L[0], colour = L[1], amp = L[2], sc = L[3];
      var pts = [];
      var span = lengths[li];
      for (var i = 0; i <= 90; i++) {
        var x = -span / 2 + (i / 90) * span * 2;
        var y = Math.sin(i * 0.31 + li * 2) * amp * 0.5 +
                Math.sin(i * 0.13 + li) * amp * 0.5 +
                Math.sin(i * 0.7 + li * 3) * amp * 0.12;
        pts.push(new THREE.Vector2(x, y - 4));
      }
      var shape = new THREE.Shape();
      shape.moveTo(pts[0].x, -200);
      pts.forEach(function (p) { shape.lineTo(p.x, p.y); });
      shape.lineTo(pts[pts.length - 1].x, -200);
      shape.closePath();
      var m = new THREE.Mesh(new THREE.ShapeGeometry(shape),
        new THREE.MeshBasicMaterial({ color: colour, fog: false }));
      m.position.z = z;
      m.scale.setScalar(sc);
      m.renderOrder = -500 + li;
      scene.add(m);
    });
    /* trees on the near ridge, as silhouettes */
    var tg = new THREE.ConeGeometry(2.4, 9, 6);
    var tm = new THREE.MeshBasicMaterial({ color: opts.tree || 0x141a2c, fog: false });
    var im = new THREE.InstancedMesh(tg, tm, 60);
    var d = new THREE.Object3D();
    for (var i = 0; i < 60; i++) {
      d.position.set(-420 + Math.random() * 1400, rnd(-6, 8), -58 + rnd(-6, 6));
      d.scale.setScalar(rnd(0.6, 1.8));
      d.rotation.set(0, Math.random() * 3, 0);
      d.updateMatrix(); im.setMatrixAt(i, d.matrix);
    }
    im.renderOrder = -496;
    scene.add(im);
    return im;
  }

  function roadStrip(scene, opts) {
    var g = new THREE.Group();
    var road = new THREE.Mesh(new THREE.PlaneGeometry(2000, 16, 200, 1),
      surface("asphalt", { repeat: 1, rough: 0.95, bumpScale: 0.5 }));
    road.material = road.material.clone();
    road.material.map = tex("asphalt", 256, 1);
    road.material.map.repeat.set(200, 2);
    road.material.bumpMap = bump("asphalt", 256, 1);
    road.rotation.x = -Math.PI / 2;
    road.receiveShadow = true;
    g.add(road);
    /* the dashes down the middle */
    var dash = new THREE.InstancedMesh(new THREE.PlaneGeometry(3.4, 0.34),
      new THREE.MeshBasicMaterial({ color: 0xd8d4c0 }), 200);
    var d = new THREE.Object3D();
    for (var i = 0; i < 200; i++) {
      d.position.set(-900 + i * 9, 0.03, 0);
      d.rotation.x = -Math.PI / 2;
      d.updateMatrix(); dash.setMatrixAt(i, d.matrix);
    }
    g.add(dash);
    /* the verge */
    [-1, 1].forEach(function (s) {
      var edge = new THREE.Mesh(new THREE.PlaneGeometry(2000, 0.28),
        new THREE.MeshBasicMaterial({ color: 0xb8b4a4 }));
      edge.rotation.x = -Math.PI / 2;
      edge.position.set(0, 0.03, s * 7);
      g.add(edge);
      var verge = new THREE.Mesh(new THREE.PlaneGeometry(2000, 26),
        surface("grass", { repeat: 1 }));
      verge.material = verge.material.clone();
      verge.material.map = tex("grass", 256, 1);
      verge.material.map.repeat.set(200, 3);
      verge.rotation.x = -Math.PI / 2;
      verge.position.set(0, -0.02, s * 21);
      verge.receiveShadow = true;
      g.add(verge);
    });
    /* telegraph poles and fence posts running away down the road */
    var poleG = new THREE.CylinderGeometry(0.16, 0.22, 9, 6); poleG.translate(0, 4.5, 0);
    var poleM = new THREE.MeshStandardMaterial({ color: 0x3a2e22, roughness: 0.95 });
    var poles = new THREE.InstancedMesh(poleG, poleM, 46);
    var arms = new THREE.InstancedMesh(new THREE.BoxGeometry(0.14, 0.14, 2.2), poleM, 46);
    for (var k = 0; k < 46; k++) {
      d.position.set(-600 + k * 34, 0, 13.5); d.rotation.set(0, 0, 0); d.scale.setScalar(1);
      d.updateMatrix(); poles.setMatrixAt(k, d.matrix);
      d.position.y = 8.2; d.updateMatrix(); arms.setMatrixAt(k, d.matrix);
    }
    poles.castShadow = true;
    g.add(poles); g.add(arms);

    var fenceG = new THREE.BoxGeometry(0.12, 1.2, 0.12); fenceG.translate(0, 0.6, 0);
    var fence = new THREE.InstancedMesh(fenceG, poleM, 240);
    for (var f = 0; f < 240; f++) {
      d.position.set(-700 + f * 6, 0, -13.5 + (f % 2 ? 0 : 0)); d.scale.setScalar(1);
      d.updateMatrix(); fence.setMatrixAt(f, d.matrix);
    }
    g.add(fence);
    scene.add(g);
    return g;
  }

  /* ---- THE DRIVE ---- */
  function playDrive() {
    var scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x0c1024, 0.0055);
    var cam = new THREE.PerspectiveCamera(38, Stage.camera.aspect, 0.4, 900);

    var sky = makeSky();
    sky.u.cLow.value.set(0x1a2244); sky.u.cMid.value.set(0x0d1230); sky.u.cHigh.value.set(0x05070f);
    sky.u.sunCol.value.set(0x8fa8d8); sky.u.sunAmt.value = 0.25;
    sky.u.sunDir.value.set(-0.9, 0.12, 0.2).normalize();
    scene.add(sky.mesh);
    var stars = makeStars(600, 400);
    scene.add(stars.points);
    var moon = makeMoon(7); moon.position.set(-260, 120, -180); scene.add(moon);

    cineEnvironment(scene, sky, "street", 0.7);
    landscape(scene, { far: 0x121834, mid: 0x171d3a, near: 0x1c2340, tree: 0x0d1226 });
    roadStrip(scene, {});

    scene.add(new THREE.HemisphereLight(0x33436e, 0x0d1220, 1.05));
    var moonLight = new THREE.DirectionalLight(0xa8c0ff, 0.85);
    moonLight.position.set(-60, 40, -40);
    scene.add(moonLight);
    scene.add(new THREE.AmbientLight(0x1c2440, 0.6));

    /* the car */
    var car = (function () {
      var w = { }; /* makeCar lives on a world; rebuild it standalone */
      return buildStandaloneCar();
    })();
    scene.add(car.group);
    car.group.position.set(0, 0, 0);

    /* two of them in it, just visible through the glass */
    var her = makeOuissy(); her.root.scale.setScalar(0.82);
    her.root.position.set(-0.1, 0.52, 0.42); her.root.rotation.y = -Math.PI / 2;
    poseHuman(her, 0, 0, null, { crouch: 1 });
    her.contact.visible = false;
    car.group.add(her.root);
    var him = makeAnwar(); him.root.scale.setScalar(0.82);
    him.root.position.set(-0.1, 0.52, -0.42); him.root.rotation.y = -Math.PI / 2;
    poseHuman(him, 0, 0, null, { crouch: 1 });
    him.contact.visible = false;
    car.group.add(him.root);

    /* headlights: two spots, and the beams you can see in the mist */
    var beams = [];
    [0.62, -0.62].forEach(function (s) {
      var sp = new THREE.SpotLight(0xfff2d4, 220, 120, 0.34, 0.5, 1.0);
      sp.position.set(1.9, 0.78, s);
      sp.target.position.set(34, -1.4, s * 2.6);
      car.group.add(sp); car.group.add(sp.target);
      var cg = new THREE.CylinderGeometry(0.26, 5.0, 40, 16, 1, true);
      cg.translate(0, -20, 0); cg.rotateZ(-Math.PI / 2);
      var cm = new THREE.MeshBasicMaterial({
        color: 0xffe8c0, transparent: true, opacity: 0.11,
        blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false });
      var beam = new THREE.Mesh(cg, cm);
      beam.position.set(1.9, 0.78, s);
      beam.rotation.z = -0.035;
      car.group.add(beam);
      beams.push({ spot: sp, beam: beam });
    });
    var tail = new THREE.PointLight(0xff3322, 6, 9);
    tail.position.set(-2.3, 0.8, 0);
    car.group.add(tail);
    /* a soft top light so the car is a shape and not a hole in the road */
    var carFill = new THREE.PointLight(0x94aee0, 3.2, 7, 1.6);
    carFill.position.set(-1.2, 3.0, 0);
    car.group.add(carFill);

    /* mist drifting through the beams */
    var mist = makeMotes(0xbfd0ff, 300, 260, 40);
    mist.points.position.set(-40, 0, -20);
    scene.add(mist.points);

    /* a few of them at the edge of the light, which is the whole point
       of driving at night in this */
    var standing = [];
    for (var i = 0; i < 7; i++) {
      var z = makeZombie(i + 3);
      z.root.position.set(120 + i * 46 + rnd(-14, 14), 0, rnd(-6, 6));
      z.root.rotation.y = rnd(0, 6.28);
      scene.add(z.root);
      standing.push(z);
    }

    var speed = 30, dead = false, steam = null;
    Audio_.engine("start");

    runCine({
      scene: scene, camera: cam,
      caption: "Out past the ring road, and then twenty miles of nobody.",
      grade: { gradeCol: 0x4a6ab4, gradeAmt: 0.16, hazeCol: 0x141c34, hazeAmt: 0.34,
               vig: 0.8, sat: 1.0, fringe: 0.002, redPulse: 0, exposure: 1.0 },
      update: function (dt, t) {
        /* the tank going */
        if (t > 8.5 && !dead) { dead = true; }
        if (dead) speed = Math.max(0, speed - dt * 5.4);
        else speed = Math.min(34, speed + dt * 4);

        car.group.position.x += speed * dt;
        car.spin(speed * dt);
        car.group.position.y = Math.sin(t * 9) * 0.012 * (speed / 30);
        car.group.rotation.z = Math.sin(t * 3.1) * 0.006;

        /* the camera runs alongside and slightly behind */
        var cx0 = car.group.position.x;
        cam.position.set(cx0 - 8.8 + Math.sin(t * 0.35) * 0.7, 2.85 + Math.sin(t * 0.5) * 0.12, 0.9);
        cam.lookAt(cx0 + 13, 1.35, 0.15);

        stars.u.time.value = t;
        sky.u.time.value = t;
        mist.u.time.value = t;
        mist.u.near.value.set(cx0 + 10, 1, 0);
        mist.points.position.x = cx0 - 60;

        beams.forEach(function (b) {
          b.beam.material.opacity = 0.10 + 0.025 * Math.sin(t * 4);
          b.spot.intensity = dead ? Math.max(30, 220 - (t - 8.5) * 70) : 220;
        });
        tail.intensity = 2.4 + Math.sin(t * 6) * 0.4;

        standing.forEach(function (z, i) {
          poseHuman(z, t + i, 0.2, "z");
          z.root.rotation.y += dt * 0.2;
        });

        if (dead && !steam && t > 9.4) {
          steam = makeFire();
          steam.userData.strength = 0.22;
          steam.scale.set(0.5, 0.5, 0.5);
          steam.position.set(1.5, 1.0, 0);
          car.group.add(steam);
          Audio_.static(1.2, 0.05);
        }
        if (steam) steam.userData.update(t, dt);

        if (t > 6.2 && t < 6.4) caption("The tank has been on the light for an hour.");
        if (t > 10.5 && t < 10.7) caption("It coughs twice and stops, and neither of them says anything.");
      },
      duration: 13.6,
      done: function () {
        endCine(function () {
          enterSub("roadside");
        });
      }
    });
  }

  /* the drive and the ride both need a car that is not attached to a
     level, so the builder is lifted out here */
  function buildStandaloneCar() {
    var paint = new THREE.MeshStandardMaterial({
      color: 0x8a3a44, roughness: 0.42, metalness: 0.55,
      map: tex("metal", 128, 1), bumpMap: bump("metal", 128, 1), bumpScale: 0.05 });
    var glass = new THREE.MeshStandardMaterial({ color: 0x1a2430, roughness: 0.08, metalness: 0.3,
      transparent: true, opacity: 0.5 });
    var rubber = new THREE.MeshStandardMaterial({ color: 0x14161a, roughness: 0.95 });
    var g = new THREE.Group();
    var body = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.66, 1.8), paint);
    body.position.y = 0.70; body.castShadow = true; g.add(body);
    var lower = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.38, 1.68), paint);
    lower.position.y = 0.36; g.add(lower);
    var cabin = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.62, 1.6), paint);
    cabin.position.set(-0.25, 1.32, 0); cabin.castShadow = true; g.add(cabin);
    var glassM = new THREE.Mesh(new THREE.BoxGeometry(2.16, 0.5, 1.64), glass);
    glassM.position.set(-0.25, 1.14, 0); g.add(glassM);
    var bonnet = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.22, 1.72), paint);
    bonnet.position.set(1.34, 1.02, 0); bonnet.rotation.z = -0.09; g.add(bonnet);
    var wheels = [];
    [[1.5, 0.94], [-1.5, 0.94], [1.5, -0.94], [-1.5, -0.94]].forEach(function (p) {
      var w = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.28, 14), rubber);
      w.rotation.x = Math.PI / 2;
      w.position.set(p[0], 0.42, p[1]);
      w.castShadow = true;
      g.add(w); wheels.push(w);
    });
    return {
      group: g,
      spin: function (d) { wheels.forEach(function (w) { w.rotation.y -= d / 0.42; }); }
    };
  }

  /* ---- THE RIDE ---- */
  function playRide() {
    var scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x3a3050, 0.0042);
    var cam = new THREE.PerspectiveCamera(38, Stage.camera.aspect, 0.4, 900);

    var sky = makeSky();
    sky.u.cLow.value.set(0xe89a58); sky.u.cMid.value.set(0x8a6a9a); sky.u.cHigh.value.set(0x1e2a58);
    sky.u.sunCol.value.set(0xffc27a); sky.u.sunAmt.value = 0.9;
    sky.u.sunDir.value.set(1.0, 0.09, 0.25).normalize();
    scene.add(sky.mesh);
    var stars = makeStars(300, 400); stars.u.amt.value = 0.35; scene.add(stars.points);

    /* the sun itself, coming up at the end of the road */
    var sun = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTexture(), color: 0xffd08a, blending: THREE.AdditiveBlending,
      transparent: true, depthWrite: false, fog: false, opacity: 0.95 }));
    sun.scale.set(160, 160, 1);
    sun.position.set(340, 12, 90);
    scene.add(sun);

    cineEnvironment(scene, sky, "road", 0.42);
    landscape(scene, { far: 0x6a5a80, mid: 0x4e4468, near: 0x33304e, tree: 0x241f38 });
    roadStrip(scene, {});

    scene.add(new THREE.HemisphereLight(0xffc890, 0x30283a, 1.0));
    var sunLight = new THREE.DirectionalLight(0xffc07a, 1.6);
    sunLight.position.set(90, 22, 40);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.set(1024, 1024);
    sunLight.shadow.camera.left = -30; sunLight.shadow.camera.right = 30;
    sunLight.shadow.camera.top = 30; sunLight.shadow.camera.bottom = -30;
    sunLight.shadow.bias = -0.002;
    scene.add(sunLight);

    var horse = buildHorse();
    scene.add(horse.root);
    horse.root.position.set(0, 0, 0);

    /* the two of them on it — she in front with the reins, him behind */
    var her = makeOuissy(); her.root.scale.setScalar(0.92);
    her.root.position.set(0.24, 1.02, 0);
    her.root.rotation.y = -Math.PI / 2;
    horse.root.add(her.root);
    var him = makeAnwar(); him.root.scale.setScalar(0.92);
    him.root.position.set(-0.62, 1.00, 0);
    him.root.rotation.y = -Math.PI / 2;
    horse.root.add(him.root);
    her.contact.visible = false; him.contact.visible = false;

    var motes = makeMotes(0xffd0a0, 220, 200, 40);
    motes.points.position.set(-40, 0, -10);
    scene.add(motes.points);

    var hoofT = 0;
    runCine({
      scene: scene, camera: cam,
      caption: "It takes most of the morning, and neither of them minds.",
      grade: { gradeCol: 0xd8a860, gradeAmt: 0.18, hazeCol: 0x8a7a96, hazeAmt: 0.26,
               vig: 0.6, sat: 1.1, fringe: 0.0015, redPulse: 0, exposure: 1.04 },
      update: function (dt, t) {
        var speed = 7.2;
        horse.root.position.x += speed * dt;
        poseHorse(horse, t, 1);
        /* both of them move with it, a beat apart */
        poseRide(her, t, Math.abs(Math.sin(t * 6.4)) * 0.05, true);
        poseRide(him, t, Math.abs(Math.sin(t * 6.4 + 0.4)) * 0.05, false);

        var hx = horse.root.position.x;
        cam.position.set(hx - 3.2 + Math.sin(t * 0.25) * 1.4, 2.85, 7.6);
        cam.lookAt(hx + 0.3, 1.75, 0);
        sun.position.x = hx + 340;
        sun.position.y = 10 + t * 0.8;
        sunLight.position.set(hx + 90, 22 + t, 40);

        stars.u.time.value = t;
        stars.u.amt.value = Math.max(0, 0.35 - t * 0.03);
        sky.u.cLow.value.lerp(new THREE.Color(0xffc890), dt * 0.06);
        motes.u.time.value = t;
        motes.u.near.value.set(hx, 1.5, 0);
        motes.points.position.x = hx - 50;

        hoofT -= dt;
        if (hoofT <= 0) { hoofT = 0.30; Audio_.hoof(); }
        if (t > 5.4 && t < 5.6) caption("Twenty miles of hedges, and a lane that keeps going.");
        if (t > 9.6 && t < 9.8) caption("She has one hand in the mane and one arm holding him on.");
      },
      duration: 12.8,
      done: function () { endCine(function () { enterSub("campsite"); }); }
    });
  }

  /* ---- THE CAMPFIRE ---- */
  function playCampfire() {
    var scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x0a0c1e, 0.016);
    var cam = new THREE.PerspectiveCamera(40, Stage.camera.aspect, 0.3, 400);

    var sky = makeSky();
    sky.u.cLow.value.set(0x101838); sky.u.cMid.value.set(0x0a0f26); sky.u.cHigh.value.set(0x04060f);
    sky.u.sunAmt.value = 0.05;
    scene.add(sky.mesh);
    var stars = makeStars(900, 300); scene.add(stars.points);
    var moon = makeMoon(6); moon.position.set(-90, 110, -180); scene.add(moon);

    cineEnvironment(scene, sky, "campsite", 0.7);

    /* the ground */
    var ground = new THREE.Mesh(new THREE.CircleGeometry(70, 40),
      surface("grass", { repeat: 1 }));
    ground.material = ground.material.clone();
    ground.material.map = tex("grass", 256, 1);
    ground.material.map.repeat.set(24, 24);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    /* the treeline all the way round */
    var treeG = new THREE.ConeGeometry(1.6, 8, 7);
    var treeM = new THREE.MeshStandardMaterial({ color: 0x14201c, roughness: 1 });
    var trees = new THREE.InstancedMesh(treeG, treeM, 90);
    var d = new THREE.Object3D();
    for (var i = 0; i < 90; i++) {
      var a = (i / 90) * 6.2832 + rnd(-0.03, 0.03);
      var r = rnd(24, 40);
      d.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
      d.scale.set(rnd(0.7, 1.9), rnd(0.8, 2.1), rnd(0.7, 1.9));
      d.rotation.set(0, Math.random() * 3, 0);
      d.updateMatrix(); trees.setMatrixAt(i, d.matrix);
    }
    trees.castShadow = true;
    scene.add(trees);

    scene.add(new THREE.HemisphereLight(0x22305c, 0x0c0e18, 0.55));
    scene.add(new THREE.AmbientLight(0x1a2038, 0.35));

    /* the fire, and the ring of stones somebody made */
    var fire = makeFire();
    fire.position.set(0, 0.1, 0);
    fire.userData.strength = 1;
    fire.userData.light.castShadow = true;
    fire.userData.light.shadow.mapSize.set(512, 512);
    fire.userData.light.shadow.bias = -0.004;
    scene.add(fire);
    var stoneM = new THREE.MeshStandardMaterial({ color: 0x6a6458, roughness: 0.98 });
    for (var k = 0; k < 12; k++) {
      var aa = k / 12 * 6.2832;
      var s = new THREE.Mesh(new THREE.DodecahedronGeometry(0.24, 0), stoneM);
      s.position.set(Math.cos(aa) * 0.95, 0.02, Math.sin(aa) * 0.95);
      s.rotation.set(aa, aa * 2, aa * 3);
      s.castShadow = true; s.receiveShadow = true;
      scene.add(s);
    }

    /* two logs to sit on */
    var logM = new THREE.MeshStandardMaterial({ color: 0x4a3a26, roughness: 0.98,
      map: tex("bark", 128, 2), bumpMap: bump("bark", 128, 2), bumpScale: 0.4 });
    [1.95, -1.95].forEach(function (zz) {
      var l = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.38, 3.0, 12), logM);
      l.rotation.z = Math.PI / 2;
      l.position.set(0, 0.36, zz);
      l.castShadow = true; l.receiveShadow = true;
      scene.add(l);
      [-1.0, 1.0].forEach(function (o) {
        var st = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 0.36, 8), logM);
        st.position.set(o, 0.18, zz + 0.2);
        scene.add(st);
      });
    });

    /* the two of them, sitting */
    var her = makeOuissy();
    her.root.position.set(0.28, -0.10, 1.92);
    her.root.rotation.y = Math.PI / 2;      /* facing the fire, which is at -z from her */
    scene.add(her.root);
    var him = makeAnwar();
    him.root.position.set(-0.24, -0.14, -1.92);
    him.root.rotation.y = -Math.PI / 2;     /* facing it from the other side */
    scene.add(him.root);

    function sit(rig, fold) {
      rig.legL.hip.rotation.x = 0.16; rig.legR.hip.rotation.x = -0.16;
      rig.legL.upper.rotation.z = 1.44; rig.legR.upper.rotation.z = 1.44;
      rig.legL.knee.rotation.z = -1.72; rig.legR.knee.rotation.z = -1.72;
      rig.armL.upper.rotation.z = -0.28; rig.armR.upper.rotation.z = -0.28;
      rig.armL.upper.rotation.x = 0.2;  rig.armR.upper.rotation.x = -0.2;
      rig.armL.elbow.rotation.z = -1.05; rig.armR.elbow.rotation.z = -1.05;
      rig.spine.rotation.z = fold ? 0.26 : 0.12;
      rig.spine.rotation.x = 0;
    }
    sit(her, true); sit(him, false);
    her.contact.visible = false; him.contact.visible = false;

    var leaning = 0;
    runCine({
      scene: scene, camera: cam,
      caption: "",
      grade: { gradeCol: 0xd08a40, gradeAmt: 0.18, hazeCol: 0x2a2038, hazeAmt: 0.2,
               vig: 0.82, sat: 1.06, fringe: 0.0016, redPulse: 0, exposure: 1.0 },
      update: function (dt, t) {
        fire.userData.update(t, dt);
        stars.u.time.value = t;
        if (Math.random() < dt * 5) Audio_.fire();

        /* the camera comes in slowly, all the way through */
        var k = clamp(t / 16, 0, 1);
        var ease = k * k * (3 - 2 * k);
        var r = lerp(8.4, 5.0, ease);
        var a = -1.15 + ease * 0.5;
        cam.position.set(Math.sin(a) * r, lerp(2.5, 1.7, ease), Math.cos(a) * r);
        cam.lookAt(0, lerp(0.95, 1.15, ease), 0);

        /* breathing, and the fire moving on them */
        poseHuman(her, t * 0.5, 0, null, { crouch: 0 });
        poseHuman(him, t * 0.5 + 1.3, 0, null, { crouch: 0 });
        sit(her, true); sit(him, false);

        /* she leans over, and her head finds his shoulder */
        if (t > 9.5) {
          leaning = clamp(leaning + dt / 2.4, 0, 1);
          var e2 = leaning * leaning * (3 - 2 * leaning);
          her.root.position.z = lerp(1.92, -1.05, e2);
          her.root.rotation.y = lerp(Math.PI / 2, Math.PI * 0.34, e2);
          her.spine.rotation.x = lerp(0, -0.42, e2);
          her.neck.rotation.x = lerp(0, -0.5, e2);
          him.armR.upper.rotation.z = lerp(-0.32, -0.95, e2);
          him.armR.upper.rotation.x = lerp(0, 0.7, e2);
        }
        if (t > 12.4 && t < 12.6) caption("She is asleep before he has counted to ten.");
      },
      duration: 17.5,
      done: function () { endCine(function () { playSunrise(); }); }
    });
  }

  /* ---- THE SUNRISE ---- */
  function playSunrise() {
    var scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x2a2440, 0.010);
    var cam = new THREE.PerspectiveCamera(46, Stage.camera.aspect, 0.3, 700);

    var sky = makeSky();
    sky.u.cLow.value.set(0x2a2450); sky.u.cMid.value.set(0x161a3c); sky.u.cHigh.value.set(0x080c20);
    sky.u.sunCol.value.set(0xffb070); sky.u.sunAmt.value = 0.3;
    sky.u.sunDir.value.set(0.15, -0.05, -1).normalize();
    scene.add(sky.mesh);
    var stars = makeStars(700, 340); scene.add(stars.points);

    cineEnvironment(scene, sky, "road", 0.3);
    var groundMat = surface("grass", { repeat: 1, rough: 0.99, bumpScale: 0.2 });
    groundMat.map = tex("grass", 256, 1); groundMat.map.repeat.set(60, 60);
    var ground = new THREE.Mesh(new THREE.PlaneGeometry(600, 600), groundMat);
    ground.rotation.x = -Math.PI / 2; ground.position.y = -0.4;
    ground.receiveShadow = true;
    scene.add(ground);

    /* the treeline the sun comes up behind */
    var treeG = new THREE.ConeGeometry(2.2, 11, 7);
    var treeM = new THREE.MeshBasicMaterial({ color: 0x0e1418, fog: false });
    var trees = new THREE.InstancedMesh(treeG, treeM, 120);
    var d = new THREE.Object3D();
    for (var i = 0; i < 120; i++) {
      d.position.set(-260 + Math.random() * 520, rnd(-2, 2), -168 + rnd(-30, 12));
      d.scale.set(rnd(1.5, 3.4), rnd(1.8, 4.4), 1);
      d.rotation.set(0, Math.random() * 3, 0);
      d.updateMatrix(); trees.setMatrixAt(i, d.matrix);
    }
    scene.add(trees);

    var sun = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTexture(), color: 0xffb060, blending: THREE.AdditiveBlending,
      transparent: true, depthWrite: false, fog: false, opacity: 0 }));
    sun.scale.set(120, 120, 1);
    sun.position.set(10, -20, -132);
    scene.add(sun);
    var disc = new THREE.Mesh(new THREE.CircleGeometry(11, 40),
      new THREE.MeshBasicMaterial({ color: 0xffd9a0, fog: false, transparent: true }));
    disc.position.set(10, -20, -131);
    scene.add(disc);

    var hemi = new THREE.HemisphereLight(0x2a2450, 0x0a0c14, 0.25);
    scene.add(hemi);

    /* the fire, down to embers */
    var fire = makeFire();
    fire.userData.strength = 0.28;
    fire.position.set(-3.5, 0, 8);
    scene.add(fire);

    /* birds */
    var birdG = new THREE.BufferGeometry();
    var BN = 26, bp = new Float32Array(BN * 3);
    for (var b = 0; b < BN; b++) {
      bp[b * 3] = rnd(-90, 90); bp[b * 3 + 1] = rnd(24, 60); bp[b * 3 + 2] = rnd(-120, -40);
    }
    birdG.setAttribute("position", new THREE.BufferAttribute(bp, 3));
    var birds = new THREE.Points(birdG, new THREE.PointsMaterial({
      color: 0x14161c, size: 1.8, sizeAttenuation: true, fog: false }));
    scene.add(birds);
    var birdT = 1.2;

    runCine({
      scene: scene, camera: cam,
      caption: "She wakes to birdsong, and the fire is still warm, and he is still there.",
      grade: { gradeCol: 0xffb070, gradeAmt: 0.12, hazeCol: 0x8a6a72, hazeAmt: 0.16,
               vig: 0.46, sat: 1.22, fringe: 0.0012, redPulse: 0, exposure: 1.0 },
      update: function (dt, t) {
        var k = clamp(t / 7, 0, 1);
        var e = k * k * (3 - 2 * k);
        /* indigo, through rose and gold, to a pale morning blue */
        sky.u.cLow.value.setRGB(
          lerp(0.16, 1.00, e), lerp(0.14, 0.76, e), lerp(0.31, 0.48, e));
        sky.u.cMid.value.setRGB(
          lerp(0.09, 0.62, e), lerp(0.10, 0.66, e), lerp(0.24, 0.86, e));
        sky.u.cHigh.value.setRGB(
          lerp(0.03, 0.28, e), lerp(0.05, 0.48, e), lerp(0.13, 0.80, e));
        sky.u.sunAmt.value = 0.3 + e * 0.7;
        stars.u.amt.value = Math.max(0, 1 - e * 1.6);
        stars.u.time.value = t;
        hemi.intensity = 0.25 + e * 1.5;
        hemi.color.setRGB(lerp(0.16, 1.0, e), lerp(0.14, 0.86, e), lerp(0.31, 0.72, e));

        sun.material.opacity = 0.25 + e * 0.42;
        sun.position.y = lerp(-18, 16, e);
        disc.position.y = sun.position.y;
        disc.material.color.setRGB(1, lerp(0.62, 0.92, e), lerp(0.36, 0.78, e));
        sun.scale.setScalar(lerp(120, 78, e));

        fire.userData.update(t, dt);
        fire.userData.strength = Math.max(0.05, 0.28 - t * 0.02);

        cam.position.set(Math.sin(t * 0.06) * 6, 4.2 + e * 1.4, 22);
        cam.lookAt(8, 9 + e * 5, -110);

        birds.rotation.y = t * 0.008;
        var arr = birdG.attributes.position.array;
        for (var i = 0; i < BN; i++) {
          arr[i * 3] += dt * (7 + (i % 5));
          arr[i * 3 + 1] += Math.sin(t * 3 + i) * dt * 1.2;
          if (arr[i * 3] > 110) arr[i * 3] = -110;
        }
        birdG.attributes.position.needsUpdate = true;

        birdT -= dt;
        if (birdT <= 0 && t > 2.4) { birdT = rnd(0.5, 1.5); Audio_.bird(); }
      },
      duration: 10.5,
      done: function () { endCine(function () { levelCard(4); }); }
    });
  }

  /* ---- THE ROOFTOP ---- */
  function playRooftop() {
    var scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x0a0e1c, 0.0055);
    var cam = new THREE.PerspectiveCamera(44, Stage.camera.aspect, 0.3, 900);

    var sky = makeSky();
    sky.u.cLow.value.set(0x14203c); sky.u.cMid.value.set(0x0a1026); sky.u.cHigh.value.set(0x04060f);
    sky.u.sunCol.value.set(0xbcd0ff); sky.u.sunAmt.value = 0.12;
    sky.u.sunDir.value.set(-0.6, 0.3, -0.7).normalize();
    scene.add(sky.mesh);
    var stars = makeStars(1100, 380); scene.add(stars.points);
    var moon = makeMoon(11);
    moon.position.set(-96, 66, -178);
    scene.add(moon);

    /* clouds, drifting */
    var clouds = [];
    for (var ci = 0; ci < 7; ci++) {
      var c = new THREE.Sprite(new THREE.SpriteMaterial({
        map: glowTexture(), color: 0x2a3450, transparent: true, opacity: 0.30,
        depthWrite: false, fog: false }));
      c.scale.set(rnd(90, 200), rnd(24, 46), 1);
      c.position.set(rnd(-260, 260), rnd(60, 130), -300);
      scene.add(c);
      clouds.push({ s: c, v: rnd(0.6, 1.9) });
    }

    cineEnvironment(scene, sky, "street", 0.62);

    /* the roof she is standing on */
    var roofM = surface("block", { repeat: 1, rough: 0.96, tint: 0x6a6a70 });
    roofM.map = tex("block", 256, 1); roofM.map.repeat.set(6, 6);
    var roof = new THREE.Mesh(new THREE.BoxGeometry(30, 1.2, 22), roofM);
    roof.position.y = -0.6; roof.receiveShadow = true;
    scene.add(roof);
    /* the parapet */
    [[0, -11, 30, 1.2], [0, 11, 30, 1.2], [-15, 0, 1.2, 22], [15, 0, 1.2, 22]].forEach(function (p) {
      var w = new THREE.Mesh(new THREE.BoxGeometry(p[2], 1.0, p[3]), roofM);
      w.position.set(p[0], 0.5, p[1]);
      w.castShadow = true; w.receiveShadow = true;
      scene.add(w);
    });
    /* the water tower and the aerial */
    var tank = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 1.7, 2.6, 12),
      surface("metal", { repeat: 1, rough: 0.8, metal: 0.5, tint: 0x4a4238 }));
    tank.position.set(-10, 4.6, -7); tank.castShadow = true; scene.add(tank);
    for (var li = 0; li < 4; li++) {
      var a = li / 4 * 6.2832 + 0.7;
      var leg = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 3.4, 6),
        new THREE.MeshStandardMaterial({ color: 0x30302e, roughness: 0.9 }));
      leg.position.set(-10 + Math.cos(a) * 1.4, 1.7, -7 + Math.sin(a) * 1.4);
      scene.add(leg);
    }
    var mast = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.10, 7, 6),
      new THREE.MeshStandardMaterial({ color: 0x2a2a30, roughness: 0.9 }));
    mast.position.set(11.5, 3.5, -8); scene.add(mast);
    var mastLight = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6),
      new THREE.MeshBasicMaterial({ color: 0xff4433 }));
    mastLight.position.set(11.5, 7.1, -8); scene.add(mastLight);

    /* the city — thirty-two blocks of it, with windows that are on */
    var cityG = new THREE.BoxGeometry(1, 1, 1);
    var cityM = new THREE.MeshStandardMaterial({ color: 0x161c2a, roughness: 1 });
    var city = new THREE.InstancedMesh(cityG, cityM, 96);
    var d = new THREE.Object3D(), col = new THREE.Color();
    var winGeo = new THREE.PlaneGeometry(0.5, 0.7);
    var winMat = new THREE.MeshBasicMaterial({ color: 0xffcf88, fog: false });
    var windows = new THREE.InstancedMesh(winGeo, winMat, 420);
    var winPhase = [];
    var wi = 0;
    for (var i = 0; i < 96; i++) {
      var ang = rnd(0, 6.2832), rad = rnd(24, 190);
      var bx = Math.cos(ang) * rad, bz = Math.sin(ang) * rad - 40;
      var bh = rnd(8, 52) * (1 - rad / 320);
      var bw = rnd(7, 20);
      d.position.set(bx, bh / 2 - 22, bz);
      d.scale.set(bw, bh, bw * rnd(0.7, 1.3));
      d.rotation.set(0, rnd(0, 1.5), 0);
      d.updateMatrix(); city.setMatrixAt(i, d.matrix);
      city.setColorAt(i, col.setHex(shade(0x1a2130, 0.6 + Math.random() * 0.8)));
      /* a handful of windows still on, facing us */
      var n = irnd(0, 6);
      for (var k = 0; k < n && wi < 420; k++) {
        d.position.set(bx + rnd(-bw * 0.4, bw * 0.4), rnd(-18, bh - 24),
                       bz + d.scale.z / 2 + 0.3);
        d.scale.setScalar(rnd(0.7, 1.5));
        d.rotation.set(0, 0, 0);
        d.updateMatrix(); windows.setMatrixAt(wi, d.matrix);
        winPhase.push({ i: wi, p: Math.random() * 6.28, r: rnd(0.05, 0.5) });
        wi++;
      }
    }
    for (; wi < 420; wi++) { d.position.set(0, -900, 0); d.updateMatrix(); windows.setMatrixAt(wi, d.matrix); }
    city.instanceMatrix.needsUpdate = true;
    if (city.instanceColor) city.instanceColor.needsUpdate = true;
    windows.instanceMatrix.needsUpdate = true;
    scene.add(city); scene.add(windows);

    /* three of them burning, a long way off */
    var fires = [];
    for (var f = 0; f < 3; f++) {
      var ff = makeFire();
      ff.scale.setScalar(rnd(4, 8));
      ff.position.set(rnd(-140, 140), rnd(-14, 6), rnd(-190, -90));
      ff.userData.strength = 0.5;
      ff.userData.light.intensity = 0;
      scene.add(ff);
      fires.push(ff);
    }

    scene.add(new THREE.HemisphereLight(0x2c3c66, 0x0c1018, 1.0));
    scene.add(new THREE.AmbientLight(0x1a2440, 0.5));
    var rim = new THREE.DirectionalLight(0xa8c0ff, 0.8);
    rim.position.set(-20, 22, -18);
    rim.castShadow = true;
    rim.shadow.mapSize.set(1024, 1024);
    rim.shadow.camera.left = -20; rim.shadow.camera.right = 20;
    rim.shadow.camera.top = 20; rim.shadow.camera.bottom = -20;
    rim.shadow.bias = -0.002;
    scene.add(rim);
    /* a couple of lights along the roof edge */
    [[-4.6, 8.4], [5.4, 8.4]].forEach(function (p) {
      var b = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6),
        new THREE.MeshBasicMaterial({ color: 0xffd9a0 }));
      b.position.set(p[0], 1.4, p[1]); scene.add(b);
      var pl = new THREE.PointLight(0xffc088, 26, 20, 1.15);
      pl.position.set(p[0], 2.1, p[1]); scene.add(pl);
    });

    /* the two of them, sitting on the parapet with their backs to us */
    var her = makeOuissy();
    her.root.position.set(0.62, 0.12, 10.9);
    her.root.rotation.y = Math.PI / 2;      /* backs to us, looking out over it */
    scene.add(her.root);
    var him = makeAnwar();
    him.root.position.set(-0.62, 0.10, 10.9);
    him.root.rotation.y = Math.PI / 2;
    scene.add(him.root);
    /* they are sitting on the parapet with their legs over the far side,
       so the feet hang out of shot and only the knee break shows */
    function sitEdge(rig) {
      rig.legL.hip.rotation.x = 0.12; rig.legR.hip.rotation.x = -0.12;
      rig.legL.upper.rotation.z = 1.46; rig.legR.upper.rotation.z = 1.46;
      rig.legL.knee.rotation.z = -1.30; rig.legR.knee.rotation.z = -1.30;
      rig.armL.upper.rotation.z = -0.14; rig.armR.upper.rotation.z = -0.14;
      rig.armL.upper.rotation.x = 0.16;  rig.armR.upper.rotation.x = -0.16;
      rig.armL.elbow.rotation.z = -0.42; rig.armR.elbow.rotation.z = -0.42;
      rig.spine.rotation.z = 0.06;
    }
    sitEdge(her); sitEdge(him);
    her.contact.visible = false; him.contact.visible = false;

    /* embers coming up off the city below */
    var motes = makeMotes(0xffc890, 160, 60, 40);
    motes.points.position.set(-30, -6, -14);
    scene.add(motes.points);

    var lean = 0, together = false;
    runCine({
      scene: scene, camera: cam,
      caption: "",
      duration: Infinity,
      grade: { gradeCol: 0x6a90d8, gradeAmt: 0.14, hazeCol: 0x141c34, hazeAmt: 0.24,
               vig: 0.72, sat: 1.06, fringe: 0.0014, redPulse: 0, exposure: 1.02 },
      update: function (dt, t) {
        stars.u.time.value = t;
        motes.u.time.value = t;
        motes.u.near.value.set(0, 2, 6);
        fires.forEach(function (ff) { ff.userData.update(t, dt); });
        clouds.forEach(function (c) {
          c.s.position.x += c.v * dt;
          if (c.s.position.x > 300) c.s.position.x = -300;
        });
        mastLight.material.color.setScalar(0.6 + Math.sin(t * 2.4) * 0.4);
        mastLight.material.color.multiplyScalar(1);
        mastLight.material.color.setRGB(1, 0.2 + Math.sin(t * 2.4) * 0.15, 0.15);

        /* windows going on and off, three streets away */
        winPhase.forEach(function (w) {
          if (Math.random() < dt * w.r * 0.4) {
            d.position.set(0, -900, 0); d.scale.setScalar(1); d.rotation.set(0, 0, 0);
          }
        });

        poseHuman(her, t * 0.5, 0, null, {});
        poseHuman(him, t * 0.5 + 0.9, 0, null, {});
        sitEdge(her); sitEdge(him);

        /* he puts his arm round her, when the line arrives */
        if (together) {
          lean = clamp(lean + dt / 2.2, 0, 1);
          var e = lean * lean * (3 - 2 * lean);
          her.root.position.x = lerp(0.62, 0.18, e);
          her.spine.rotation.x = lerp(0, 0.34, e);
          her.neck.rotation.x = lerp(0, 0.22, e);
          him.armL.upper.rotation.z = lerp(-0.1, -1.15, e);
          him.armL.upper.rotation.x = lerp(0, -0.8, e);
          him.armL.elbow.rotation.z = lerp(-0.3, -1.0, e);
        }

        /* the camera pulls back and up over the whole scene */
        var k = clamp(t / 52, 0, 1);
        var e2 = k * k * (3 - 2 * k);
        cam.position.set(lerp(1.5, -0.9, e2), lerp(2.15, 4.8, e2), lerp(15.4, 24.0, e2));
        cam.lookAt(lerp(0.1, 0, e2), lerp(2.05, 4.8, e2), lerp(2.0, -30, e2));
      },
      done: null
    });

    /* the words go over the top of it */
    G.state = "dialogue";
    var lines = TALK.roof.slice();
    say(lines, function () { endingCard(); });
    /* the moment he says "Come here" */
    var watch = setInterval(function () {
      if (!G || !G.dlg) { clearInterval(watch); return; }
      var idx = G.dlg.i;
      if (idx > 0 && G.dlg.lines[idx - 1] && G.dlg.lines[idx - 1][1] === "Come here.") {
        together = true;
        clearInterval(watch);
      }
    }, 120);
  }

  /* =========================================================
     29 — CARDS
     ========================================================= */
  function titleCard() {
    var c = el("div", "ap-card");
    c.appendChild(el("p", "ap-card-kicker", "OUISSY AT THE APOCALYPSE"));
    c.appendChild(el("h3", "ap-card-title", "the world ends. you come and find me anyway."));
    var b = el("button", "ap-card-go", "BEGIN");
    var used = false;
    b.addEventListener("click", function () {
      if (used) return; used = true;
      Audio_.begin(); howToCard();
    });
    c.appendChild(b);
    var q = el("button", "ap-card-quit", "NOT TONIGHT");
    q.addEventListener("click", function () {
      if (window.leaveApocalypse) window.leaveApocalypse(); else Api.stop();
    });
    c.appendChild(q);
    openOverlay(c);
  }

  function howToCard() {
    var rows = [
      ["MOVE", "arrow keys, or WASD"],
      ["CREEP", "hold SHIFT — slower, but almost silent"],
      ["USE", "E or SPACE — whatever you're standing at"],
      ["PAUSE", "ESC"],
      ["ON A PHONE", "the pad and the two buttons do all of it"],
      ["THE DARK", "you only see as far as your torch. Lit rooms show more"],
      ["COVER", "step into a wardrobe, a bush, or behind a car and they lose you"],
      ["NOISE", "running is loud. They come and look at where the sound was"],
      ["GETTING CAUGHT", "you get pulled back to somewhere safe. That's all. Try again"],
      ["A CUT SCENE", "USE runs it to the end, if you have seen it before"]
    ];
    var used = false;
    openOverlay(card("HOW THIS GOES", "Everything you need, once.", rows, "GO",
      function () { if (used) return; used = true; levelCard(0); }));
  }

  function levelCard(i) {
    var def = LEVELS[i];
    G = G || {};
    G.levelIndex = i;
    var used = false;
    openOverlay(card(def.card, def.blurb, null, "GO", function () {
      if (used) return;
      used = true;
      closeOverlay();
      enterLevel(def);
      G.levelIndex = i;
    }));
  }

  function enterSub(name) {
    var def = SUB[name];
    enterLevel(def);
    if (name === "campsite") setUpCampsite();
  }

  function setUpCampsite() {
    var w = G.world;
    /* he stops following here: this is the one place they are staying put */
    if (!G.anwar) {
      var ar = makeAnwar();
      G.scene.add(ar.root);
      G.anwar = { rig: ar, x: w.cx(9), z: w.cz(12), found: true, following: false, sitting: false };
    }
    G.anwar.following = false;
    G.anwar.x = w.cx(9); G.anwar.z = w.cz(12);
    G.anwar.rig.root.position.set(G.anwar.x, 0, G.anwar.z);
    G.anwar.rig.root.rotation.y = -Math.PI / 2;
    var h = buildHorse();
    G.scene.add(h.root);
    h.root.position.set(w.cx(20), 0, w.cz(6));
    h.root.rotation.y = 2.2;
    G.horseRig = h;
    G.wood = 0;
    G.state = "dialogue";
    say(TALK.arrival, function () {
      clearStep("arrival");
      G.anwar.sitting = true;
    });
  }

  function endingCard() {
    var c = el("div", "ap-card");
    c.appendChild(el("p", "ap-card-kicker", "TO BE CONTINUED…"));
    c.appendChild(el("h3", "ap-card-title", "the world ended. you came and found me anyway."));
    var b = el("button", "ap-card-go", "CLOSE THE BOOK");
    b.addEventListener("click", function () {
      if (window.markApocalypseDone) window.markApocalypseDone();
      if (window.startApocalypseEnding) window.startApocalypseEnding();
      else if (window.leaveApocalypse) window.leaveApocalypse();
      else Api.stop();
    });
    c.appendChild(b);
    openOverlay(c);
    if (window.markApocalypseDone) window.markApocalypseDone();
  }

  /* =========================================================
     30 — WHAT THEY CAN SEE
     A flat fan on the floor in front of each of them. It is the
     only piece of interface drawn in the world, and it is there
     because a stealth game that hides its rules is not tense,
     it is unfair.
     ========================================================= */
  function ensureCone(z) {
    if (z.cone) return z.cone;
    var seg = 18, a0 = -TUNE.zCone, a1 = TUNE.zCone;
    var g = new THREE.BufferGeometry();
    var pos = [0, 0, 0], idx = [];
    for (var i = 0; i <= seg; i++) {
      var a = lerp(a0, a1, i / seg);
      pos.push(Math.cos(a) * TUNE.zSight, 0, Math.sin(a) * TUNE.zSight);
      if (i > 0) idx.push(0, i, i + 1);
    }
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx.slice(0, idx.length - 3));
    var m = new THREE.MeshBasicMaterial({
      color: 0xffd0a0, transparent: true, opacity: 0.055, depthWrite: false,
      blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false
    });
    var mesh = new THREE.Mesh(g, m);
    /* The floor tiles are 0.30 boxes sitting at -0.15, so the surface a
       player is looking at is y = 0. Anything meant to lie on it has to
       be just above that, or it is inside the floor and invisible. */
    mesh.position.y = 0.035;
    mesh.renderOrder = 5;
    z.rig.root.add(mesh);
    /* the rig is rotated by -facing, so undo it on the cone */
    z.cone = mesh;
    return mesh;
  }

  function updateCones() {
    for (var i = 0; i < G.zombies.length; i++) {
      var z = G.zombies[i];
      var c = ensureCone(z);
      var chase = z.state === "chase" || z.state === "react";
      var d = Math.hypot(z.x - G.player.x, z.z - G.player.z);
      /* A cone is five tiles of additive colour. One is a warning; four
         overlapping is a red screen — so only the ones near enough to
         matter are drawn, and they tint rather than glow. */
      c.visible = z.rig.root.visible && d < 22;
      if (!c.visible) continue;
      c.material.color.setHex(chase ? 0xd8564a : z.state === "look" ? 0xd8a054 : 0x8aa4c4);
      c.material.opacity = (chase ? 0.105 : z.state === "look" ? 0.075 : 0.05)
                         * (1 - clamp(d / 22, 0, 1) * 0.55);
    }
  }

  /* =========================================================
     31 — HIM, BEHIND HER
     Once she has him, he comes. He is not a second player: he
     keeps a couple of paces back, he cuts corners badly, and he
     stops when she stops.
     ========================================================= */
  function updateAnwar(dt) {
    var a = G.anwar;
    if (!a) return;
    if (!a.following) {
      /* he is still breathing when he is not walking, and if he is asleep
         the wake animation owns him */
      if (!a.asleep && !G.anim) poseHuman(a.rig, G.time + 0.8, 0, null, {});
      return;
    }
    var p = G.player;
    var dx = p.x - a.x, dz = p.z - a.z;
    var d = Math.hypot(dx, dz);
    var want = TILE * 1.35;
    var gait = 0;
    if (d > want) {
      var sp = Math.min(TUNE.walk * 1.06, (d - want) * 3.4);
      var ax = dx / d * sp * dt, az = dz / d * sp * dt;
      var ent = { x: a.x, z: a.z };
      moveWithCollision(G.world, ent, ax, az, TUNE.playerR * 0.9);
      a.x = ent.x; a.z = ent.z;
      gait = clamp(sp / TUNE.walk, 0, 1);
      var face = Math.atan2(dz, dx);
      a.rig.root.rotation.y = dampAngle(a.rig.root.rotation.y, -face, 0.16, dt);
    }
    a.groundY = damp(a.groundY || 0, groundAt(G.world, a.x, a.z), 0.16, dt);
    a.rig.root.position.set(a.x, a.groundY, a.z);
    a.gait = damp(a.gait || 0, gait, 0.16, dt);
    a.crouch = damp(a.crouch || 0, p.creeping ? 0.8 : 0, 0.24, dt);
    poseHuman(a.rig, G.time + 0.8, a.gait, null, { crouch: a.crouch });
  }

  /* Nobody at Ashcombe is doing anything, and that is the point — but
     standing perfectly still is what makes a crowd read as a shop window.
     They breathe, they shift their weight, and one or two of them are
     walking a short line and back. */
  function updatePeople(dt) {
    var list = G.people;
    if (!list || !list.length) return;
    for (var i = 0; i < list.length; i++) {
      var p = list[i];
      var sway = Math.sin(G.time * 0.7 + p.phase) * 0.05;
      var gait = 0;
      if (p.pace) {
        var t = Math.sin(G.time * 0.32 + p.phase);
        var along = t * 1.8;
        p.rig.root.position.set(p.x + Math.cos(p.face) * along, 0,
                                p.z + Math.sin(p.face) * along);
        gait = clamp(Math.abs(Math.cos(G.time * 0.32 + p.phase)) * 0.7, 0, 1);
        var dir = Math.cos(G.time * 0.32 + p.phase) > 0 ? p.face : p.face + Math.PI;
        p.rig.root.rotation.y = dampAngle(p.rig.root.rotation.y, -dir, 0.5, dt);
      } else {
        p.rig.root.rotation.y = dampAngle(p.rig.root.rotation.y, -(p.face + sway * 0.5), 0.9, dt);
      }
      poseHuman(p.rig, G.time * 0.55 + p.phase, gait, null,
                { lean: sway * 0.4, headZ: Math.sin(G.time * 0.41 + p.phase * 2) * 0.12 });
    }
  }

  /* =========================================================
     32 — THE LOOP
     ========================================================= */
  function tick(dt) {
    if (!G) return;
    G.time += dt;

    /* the cut, if there is one, runs whatever the game's state is */
    if (G.cine) {
      G.cine.t += dt;
      /* Nobody should have to sit through the drive twice. After a couple
         of seconds — long enough that the press that started it cannot
         end it — USE runs the cut to its end. The roof has no end to run
         to; there the same key turns the page of the conversation. */
      if (usePressed && isFinite(G.cine.duration) && G.cine.t > 2.0) {
        usePressed = false;
        G.cine.t = G.cine.duration;
        if (G.cine.update) G.cine.update(0, G.cine.t);
      }
      if (usePressed && !isFinite(G.cine.duration)) usePressed = false;
      if (G.cine.update) G.cine.update(dt, G.cine.t);
      if (isFinite(G.cine.duration) && G.cine.t >= G.cine.duration) {
        var done = G.cine.done;
        G.cine = null;
        if (done) done();
      }
      updateFade(dt);
      Stage.grade({ time: G.time });
      return;
    }

    if (G.anim) G.anim(dt);

    if (G.state === "grab") updateGrab(dt);
    else if (G.state === "close") {
      G.closeT -= dt;
      G.redPulse = clamp(G.closeT / TUNE.caughtHold, 0, 1) * 0.42;
      if (G.closeT <= 0) endCloseCall();
    } else if (G.state === "play") {
      if (usePressed) { usePressed = false; tryUse(); }
      updatePlayer(dt);
      updateZombies(dt);
      updatePressure(dt);
      checkExit();
      G.redPulse = damp(G.redPulse, G.chasing ? 0.14 : 0, 0.28, dt);
      if (G.chasing && Math.random() < dt * 1.2) Audio_.heart(1);
    } else {
      /* dialogue, overlays and pause: the world holds still but the
         lights, the fire and the dust keep going */
      usePressed = false;
      if (G.player) poseHuman(G.player.rig, G.time, 0, null, { crouch: G.player.creeping ? 1 : 0 });
      for (var i = 0; G.zombies && i < G.zombies.length; i++) {
        poseHuman(G.zombies[i].rig, G.time + G.zombies[i].seed, 0, "z");
      }
    }

    if (G.world) {
      updateDoors(dt);
      updateLights(dt);
      updateRings(dt);
      updateAnwar(dt);
      updatePeople(dt);
      if (G.zombies && G.player) updateCones();
      for (var k = 0; k < G.world.anim.length; k++) G.world.anim[k](G.time);
      if (G.world.motes) {
        G.world.motes.u.time.value = G.time;
        if (G.player) G.world.motes.u.near.value.set(G.player.x, 1.4, G.player.z);
      }
      if (G.world.fire && G.world.fire.visible) G.world.fire.userData.update(G.time, dt);
      if (G.world.tvTexture) {
        /* the set is a texture on a box a few metres away — repainting it
           sixty times a second is forty thousand random pixels nobody can
           see. Twelve is more than enough to read as a live picture. */
        G.__tvT = (G.__tvT || 0) - dt;
        if (G.__tvT <= 0) {
          G.__tvT = 1 / 12;
          paintBroadcast(G.world.tvCanvas, G.time);
          G.world.tvTexture.needsUpdate = true;
        }
        if (G.world.tvGlow) G.world.tvGlow.material.opacity = 0.34 + Math.sin(G.time * 13) * 0.14;
      }
      if (G.horseRig) poseHorse(G.horseRig, G.time, 0);
    }

    if (G.stars) G.stars.u.time.value = G.time;
    if (G.sky) G.sky.u.time.value = G.time;

    if (G.__tv) {
      G.__tvOverT = (G.__tvOverT || 0) - dt;
      if (G.__tvOverT <= 0) { G.__tvOverT = 1 / 18; paintBroadcast(G.__tv, G.time); }
    }
    if (G.__panel) G.__panel.tick(dt);

    if (G.player && G.camRig) {
      var mode = G.chasing ? "chase" : G.player.creeping ? "creep" : "walk";
      G.camRig.frame(G.player.x, G.player.z, G.player.facing, mode, dt);
    }

    updateFade(dt);
    updateAlarm(dt);
    /* the HUD is DOM: writing to it every frame is layout work for text
       that changes twice a level */
    G.__hudT = (G.__hudT || 0) - dt;
    if (G.__hudT <= 0) { G.__hudT = 0.1; updateInstinct(); setHud(); }
    Stage.grade({ time: G.time, redPulse: G.redPulse, flash: G.flash });
    G.flash = damp(G.flash, 0, 0.10, dt);
  }

  function checkExit() {
    var s = step();
    if (!s || s.clears !== "exit" || !G.world.exit) return;
    var p = G.player, w = G.world;
    var d = Math.hypot(w.cx(w.exit.x) - p.x, w.cz(w.exit.y) - p.z);
    if (d < TILE * 0.9) clearStep("exit");
  }

  function paint() {
    if (!Stage.ready || !G) return;
    var scene = G.cine ? G.cine.scene : G.scene;
    var cam = G.cine ? G.cine.camera : Stage.camera;
    if (!scene) return;
    Stage.render(scene, cam);
  }

  /* If the machine cannot hold a frame rate, take the render scale down
     rather than let the game turn into a slideshow. It is measured over a
     second and a half so a single long frame — a level building, a shader
     compiling — never triggers it. */
  var perfAcc = 0, perfN = 0, perfLock = 0;
  function watchPerformance(dt) {
    if (perfLock > 0) { perfLock -= dt; return; }
    perfAcc += dt; perfN++;
    if (perfAcc < 1.5) return;
    var avg = perfAcc / perfN;
    perfAcc = 0; perfN = 0;
    if (avg > 0.040 && Stage.quality < 2) {
      perfLock = 3;
      var scene = G && (G.cine ? G.cine.scene : G.scene);
      var cam = G && G.cine ? G.cine.camera : Stage.camera;
      Stage.setQuality(Stage.quality + 1, scene, cam);
    }
  }

  function frame(now) {
    if (!running) return;
    raf = requestAnimationFrame(frame);
    var dt = clamp((now - lastT) / 1000, 0, 0.05);
    lastT = now;
    if (!loopFrozen) { tick(dt); paint(); }
    watchPerformance(dt);
  }

  /* the offline harness drives frames itself, so it freezes this one */
  var loopFrozen = false;

  /* =========================================================
     33 — IN AND OUT
     ========================================================= */
  var resizeObs = null;

  function bindOnce() {
    if (bindOnce.done) return;
    bindOnce.done = true;
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("resize", function () { if (Stage.ready) Stage.resize(); });
    var next = $("ap-dlg-next");
    if (next) next.addEventListener("click", function () { if (G && G.dlg) nextLine(); });
    var dlg = $("ap-dlg");
    if (dlg) dlg.addEventListener("click", function () { if (G && G.dlg) nextLine(); });
    var pb = $("ap-pause-btn");
    if (pb) pb.addEventListener("click", togglePause);
    /* advancing dialogue with the same key that uses things */
    window.addEventListener("keydown", function (e) {
      if (!G || !G.dlg) return;
      if (e.code === "Space" || e.code === "KeyE" || e.code === "Enter") { nextLine(); e.preventDefault(); }
    });
    bindPad();
  }

  var Api = {
    start: function () {
      if (running) return;
      var canvas = $("ap-canvas");
      if (!canvas) return;
      bindOnce();
      running = true;
      canvas.style.opacity = "0.001";
      loadThree().then(function () {
        if (!running) return;
        Stage.init(canvas);
        if (!Stage.renderer) throw new Error("this browser cannot open a 3D canvas");
        canvas.style.opacity = "1";
        var stage = $("ap-stage");
        if (stage && window.ResizeObserver && !resizeObs) {
          resizeObs = new ResizeObserver(function () { if (Stage.ready) Stage.resize(); });
          resizeObs.observe(stage);
        }
        G = { time: 0, state: "overlay", closeCalls: 0, camRig: new CamRig(Stage.camera),
              zombies: [], fade: 1, fadeTo: 1, redPulse: 0, flash: 0 };
        var f = $("ap-stage");
        if (f) f.style.setProperty("--ap-arn", "1.7778");
        lastT = performance.now();
        raf = requestAnimationFrame(frame);
        titleCard();
        installHooks();
      }).catch(function (err) {
        running = false;
        var o = $("ap-overlay");
        if (o) {
          o.className = "ap-overlay";
          o.innerHTML = "";
          o.appendChild(card("SOMETHING IS MISSING", String(err && err.message || err), null,
            "BACK", function () { if (window.leaveApocalypse) window.leaveApocalypse(); }));
          o.setAttribute("aria-hidden", "false");
        }
      });
    },

    stop: function () {
      running = false;
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      Audio_.end();
      closeOverlay();
      var box = $("ap-dlg");
      if (box) box.setAttribute("aria-hidden", "true");
      var grab = $("ap-grab");
      if (grab) grab.setAttribute("aria-hidden", "true");
      var hud = $("ap-hud");
      if (hud) hud.classList.remove("gone");
      if (resizeObs) { try { resizeObs.disconnect(); } catch (e) {} resizeObs = null; }
      if (G && G.cine) { disposeScene(G.cine.scene); G.cine = null; }
      teardownLevel();
      Stage.release();
      G = null;
      for (var k in KEY) KEY[k] = 0;
    },

    /* the offline harness drives these */
    get game() { return G; }
  };

  /* =========================================================
     34 — TEST HOOKS
     ========================================================= */
  function installHooks() {
    window.__apEnter = function (i) {
      closeOverlay();
      var defs = LEVELS;
      enterLevel(defs[clamp(i, 0, defs.length - 1)]);
      G.levelIndex = i;
      return G;
    };
    window.__apPump = function (dt, times) {
      var n = times || 1;
      for (var i = 0; i < n; i++) tick(dt == null ? 1 / 60 : dt);
      return G && G.state;
    };
    window.__apPaint = function () { paint(); return true; };
    window.__apTeleport = function (tx, ty) {
      if (!G || !G.player) return false;
      G.player.x = G.world.cx(tx);
      G.player.z = G.world.cz(ty);
      G.player.vx = G.player.vz = 0;
      G.player.safe.x = G.player.x; G.player.safe.z = G.player.z;
      G.camRig.snap();
      return true;
    };
    window.__apCampsite = function () { closeOverlay(); enterSub("campsite"); return G; };
    window.__apRoadside = function () { closeOverlay(); enterSub("roadside"); return G; };
    window.__apDrive = function () { playDrive(); return G; };
    window.__apRide = function () { playRide(); return G; };
    window.__apCampfire = function () { playCampfire(); return G; };
    window.__apSunrise = function () { playSunrise(); return G; };
    window.__apRoof = function () { playRooftop(); return G; };
    window.__apUse = function () { tryUse(); return G && G.state; };
    window.__apSay = function () { if (G && G.dlg) { nextLine(); return true; } return false; };
    window.__apSkipDialogue = function () {
      var n = 0;
      while (G && G.dlg && n < 400) { nextLine(); n++; }
      return n;
    };
    window.__apSolvePanel = function () { if (G && G.__panel) { G.__panel.solve(); return true; } return false; };
    window.__apKeypad = function () {
      if (G && G.__keypad) { G.__keypad.enter(GATE_CODE); G.__keypad.go(); return true; }
      return false;
    };
    window.__apCheck = function () { if (G && G.__check) { G.__check.all(); return true; } return false; };
    window.__apSerum = function () { if (G && G.__serum) { G.__serum.finish(); return true; } return false; };
    window.__apState = function () {
      if (!G) return null;
      return {
        state: G.state, level: G.def && G.def.id, step: step() && step().clears,
        stepIndex: G.stepIndex, closeCalls: G.closeCalls, code: G.code,
        zombies: G.zombies ? G.zombies.length : 0,
        player: G.player ? { x: G.player.x, z: G.player.z, hidden: G.player.hidden,
                             tx: Math.floor(G.player.x / TILE), ty: Math.floor(G.player.z / TILE) } : null,
        cine: !!G.cine, dialogue: !!G.dlg,
        presses: anyPressed, grab: G.grab ? { t: G.grab.t, presses: G.grab.presses } : null
      };
    };
    /* put the game back into plain play: no card up, nobody talking.
       The harness uses it between assertions so one failure cannot
       cascade into the next one. */
    window.__apClear = function () {
      if (!G) return null;
      G.dlg = null;
      var box = $("ap-dlg");
      if (box) box.setAttribute("aria-hidden", "true");
      closeOverlay();
      G.grab = null;
      var grab = $("ap-grab");
      if (grab) grab.setAttribute("aria-hidden", "true");
      usePressed = false;
      G.state = "play";
      return G.state;
    };
    window.__apLoop = function (on) { loopFrozen = !on; return !loopFrozen; };
    window.__apQuality = function (q) {
      var scene = G && (G.cine ? G.cine.scene : G.scene);
      var cam = G && G.cine ? G.cine.camera : Stage.camera;
      Stage.setQuality(q, scene, cam);
      return Stage.quality;
    };
    /* A lit turntable with one figure on it. There is no way to judge a
       character model from a torch-lit shot of the back of its head at
       twenty metres, and this is the only thing in the file that exists
       purely so somebody can look at the work. */
    window.__apPortrait = function (who, seed) {
      var scene = new THREE.Scene();
      scene.background = new THREE.Color(0x1a1e26);
      var cam = new THREE.PerspectiveCamera(34, Stage.camera.aspect, 0.1, 60);

      var sky = makeSky();
      sky.u.cLow.value.set(0x50607a); sky.u.cMid.value.set(0x38445a);
      sky.u.cHigh.value.set(0x1c2430); sky.u.sunAmt.value = 0.5;
      sky.mesh.visible = false;
      try {
        scene.environment = buildEnvironment(Stage.renderer, sky, PAL.street, 0.2);
        scene.environmentIntensity = 1.0;
      } catch (e) {}

      var rig = who === "anwar" ? makeAnwar()
              : who === "zombie" ? makeZombie(seed == null ? 3 : seed)
              : who === "guard" ? makeGuard(seed == null ? 1 : seed)
              : who === "civilian" ? makeCivilian(seed == null ? 1 : seed)
              : makeOuissy();
      scene.add(rig.root);
      rig.root.rotation.y = -0.95;
      poseHuman(rig, 0.6, 0.35, who === "zombie" ? "z" : null, {});

      var floor = new THREE.Mesh(new THREE.CircleGeometry(3, 40),
        new THREE.MeshStandardMaterial({ color: 0x2a2f38, roughness: 0.55, metalness: 0.1 }));
      floor.rotation.x = -Math.PI / 2;
      floor.receiveShadow = true;
      scene.add(floor);

      scene.add(new THREE.HemisphereLight(0x8098c0, 0x2a2620, 1.1));
      var key = new THREE.DirectionalLight(0xfff0dc, 3.2);
      key.position.set(2.4, 3.4, 2.6);
      key.castShadow = true;
      key.shadow.mapSize.set(2048, 2048);
      key.shadow.camera.left = -2; key.shadow.camera.right = 2;
      key.shadow.camera.top = 3; key.shadow.camera.bottom = -1;
      key.shadow.bias = -0.0008; key.shadow.normalBias = 0.02;
      scene.add(key);
      var fill = new THREE.DirectionalLight(0x90b0e0, 2.0);
      fill.position.set(-3, 2, 1.4); scene.add(fill);
      var back = new THREE.DirectionalLight(0xbfd0ea, 1.2);
      back.position.set(-2, 1.2, 2.4); scene.add(back);
      var rim = new THREE.DirectionalLight(0xffd0a0, 2.2);
      rim.position.set(-1.6, 2.2, -3); scene.add(rim);

      cam.position.set(1.85, 1.30, 2.75);
      cam.lookAt(0, 0.92, 0);

      G.cine = { scene: scene, camera: cam, t: 0, duration: Infinity,
                 update: function () {} };
      G.state = "cine";
      var hud = $("ap-hud"); if (hud) hud.classList.add("gone");
      Stage.attach(scene, cam);
      Stage.grade({ gradeAmt: 0.04, hazeAmt: 0.0, vig: 0.28, sat: 1.05,
                    exposure: 1.0, fringe: 0, redPulse: 0, flash: 0, fade: 1 });
      return true;
    };
    window.__apPortraitHead = function () {
      if (!G || !G.cine) return false;
      G.cine.camera.position.set(0.60, 1.58, 0.84);
      G.cine.camera.lookAt(0.02, 1.47, 0.02);
      return true;
    };

    /* what the card was actually asked to do on the last frame */
    window.__apRenderStats = function () {
      var scene = G && (G.cine ? G.cine.scene : G.scene);
      var cam = G && G.cine ? G.cine.camera : Stage.camera;
      if (!scene) return null;
      Stage.renderer.info.reset();
      Stage.render(scene, cam);
      var info = Stage.renderer.info;
      var lights = 0;
      scene.traverse(function (o) { if (o.isLight && o.visible && o.intensity > 0) lights++; });
      return {
        calls: info.render.calls, triangles: info.render.triangles,
        lines: info.render.lines, points: info.render.points,
        geometries: info.memory.geometries, textures: info.memory.textures,
        lights: lights
      };
    };
    window.__apKey = function (k, v) { if (k in KEY) { KEY[k] = v ? 1 : 0; if (k === "use" && v) usePressed = true; } };
  }

  window.Apocalypse = Api;
})();
