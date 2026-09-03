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
    zChase:      54 * PX,
    zReact:      0.55,
    /* They used to sweep a 71-degree cone five and a bit tiles deep,
       which meant crossing a room in front of one was not a decision, it
       was a dice roll. Three and a half tiles, 52 degrees, and it has to
       be very close indeed to notice her behind it. */
    zSight:      56 * PX,
    zCone:       0.46,
    zNear:       12 * PX,
    zLose:       1.7,
    zInvestigate: 3.4,

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
    "vkh.nBBn.p.#Z.m..RR.#j.nBBn..k.p.#",
    "#..a....a..#..a.....#..a......a..#",
    "#V..S..rr..#...r....#......rr.h..#",
    "#E.....rr.l#........#......rr...l#",
    "#..p.......#........#E...........#",
    "#####d###########d#########d######",
    "#.a.....l......p........l.....a..#",
    "#..rrr......................rrr..#",
    "#................................#",
    "#######d########d#########d#######",
    "#kk..p........a#.fOKsK..p#.JJ...M#",
    "#uTU......FFF..#....K....#..II.WM#",
    "v.......rrtrr..#..e.K....#..II..M#",
    "v.q.....rrrrr.p#.ett.i...#o.II..o#",
    "#..............#..e......#..II..J#",
    "#qh...a........#.....p...#l.....a#",
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
    "#,,,.,,.,,,,,,,,,,,,.,,.,,,,,,,,,,,,,,,,.,,.,,,#",
    "#,,,.,,.h,,,,.,,,,,,.,,.,,,,z,,,,,,,,,,,.,,.,,,#",
    "#....,,.h...........h,,................c.,,....#",
    "####.,,.#####.######h,,.################.,,.####",
    "####.,,.#####.######.,,...i..............,,.####",
    "####.,,.#####x######.,,.################.,,.####",
    "####.,,.#####.######.,,.################.,h.####",
    "####h,,.#####.######.,,c################.,h.####",
    "#...h,,..............,,c.................,,....#",
    "#,,,.,,.,,,,,,,,,,,,.,,.,,,,,,,,,,z,,,,,.,,.,,,#",
    "#,,,.,,.,,,,,,,,,,,,.,,.,,,,,,,,,,,,,,,,.,,.i,,#",
    "#....,,.....L....hh..,,.......h..........,,....#",
    "####.,,.##d#########.,,.#######.########.,,.####",
    "####.,,......#######.,,.#######.#....hh#.,,.####",
    "####.,,......#######.,,.#######x#..c...#.,,.####",
    "####.,,cKK...#######.,,.#######.D..c...#.,,.####",
    "####.,,c...N.#######.,,.#######.#....c.#.,,.####",
    "####.,,.h....#######.,,.#######.#......#.,,.####",
    "####.,,.#.##########.,,.###########.####.,,.####",
    "#....,,L......hh.....,,L.........##.####.,,.####",
    "#,,,.,,.,,,,,,,,,,,,.,,.,,,,,i,,,##.#####,,#####",
    "#,,,.,,.,,,,,,,,,,,,.,,.,,,,..x...L.......L..h.#",
    "#....,,.....hh.....c.,,....hh.........c....cc.h#",
    "####.,,.#########################...........X..#",
    "################################################"
  ];

  MAPS.hospital = [
    "########################################",
    "##################..####################",
    "##oo............##..##..Bh.Bh.#..j..A.##",
    "##......=====...##.l##..B..B.l#.h....n##",
    "##...W.o........##..##........#.y...X.##",
    "##.....o.............P.........###d#####",
    "##...................P................##",
    "##.l............##..##................##",
    "##......=====...##.z##..B..B..B..B..B.##",
    "##..h.........h.##.l##..BhlBh.Bh.Bh.B.##",
    "##..............##..##................##",
    "##################..####################",
    "#....lyy......l.y.......l.....i..yl....#",
    "#..y....x..Yy.............yy.......Y...#",
    "#########.########..####################",
    "##.......j##.....#....................##",
    "##........##.ooo.#...KKKKKK.....=====.##",
    "##........##.ooo.#.l...z....hhY.......##",
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
      blurb: "Tuesday they flew to Portugal. It is Friday and the news is still on.",
      map: MAPS.home, theme: "house", base: ".", dark: 0.68, groundTex: "asphalt",
      /* [x0, y0, x1, y1, texture, tint] — the bathroom and the kitchen are
         tiled and the garage is a slab; the rest of it is boards */
      floors: [
        [12, 1, 19, 5, "clinic", 0xd8dcd8],
        [16, 11, 24, 17, "pave", 0xcfcabe],
        [26, 11, 32, 17, "block", 0x8e8f8c]
      ],
      /* the string of lights along the wall over her bed */
      fairy: [[1, 1, 10, 1, 2.55]],
      grade: [180, 115, 55, 0.16], haze: [30, 38, 60, 0.28],
      steps: [
        { task: "Downstairs. The television is still on — stand at it and press USE.", clears: "tv" },
        { task: "Anwar is at Mercy General. Take the car — the garage is the far room downstairs.", clears: "panel" },
        { task: "The shutter is up. Walk out through it, onto the drive.", clears: "exit" }
      ]
    },
    {
      id: "streets", name: "THE STREETS", card: "Level 2: THE STREETS",
      blurb: "Four miles. South to the river, then east along it.",
      map: MAPS.streets, theme: "street", base: ",", dark: 0.62,
      grade: [60, 90, 180, 0.18], haze: [35, 48, 80, 0.36],
      steps: [
        { task: "Cross town on foot. South first, then east — the compass points the way, M opens the map.", clears: "exit" }
      ]
    },
    {
      id: "hospital", name: "THE HOSPITAL", card: "Level 3: THE HOSPITAL",
      blurb: "It was the first place it got into. Ward C, east wing.",
      map: MAPS.hospital, theme: "hospital", base: ".", dark: 0.63,
      grade: [104, 176, 168, 0.13], haze: [58, 84, 92, 0.34],
      dead: [20, 1, 39, 10],
      pressure: 26, pressureMax: 5, blood: true,
      steps: [
        { task: "Ward C has no power on its doors. The plant room is west — find the panel and use it.", clears: "panel" },
        { task: "The ward doors are open. He is east, off the ward — look for the room with a door on it.", clears: "anwar" },
        { task: "Get to the fire door in this room. It is the green light.", clears: "exit" }
      ]
    },
    {
      id: "escape", name: "THE ROAD", card: "Level 4: THE ROAD",
      blurb: "Ashcombe. North road, past the reservoir. Forty miles.",
      map: MAPS.escape, theme: "hospital", base: ".", dark: 0.68, groundTex: "asphalt", blood: true,
      grade: [96, 150, 170, 0.12], haze: [46, 62, 76, 0.32],
      steps: [
        { task: "Out of the building, then find a car and use it. The compass is pointing at one.", clears: "car" }
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
        { task: "Walk up to the gate and use it. They will speak first.", clears: "hail" },
        { task: "The table by the fence. Stand at it and use it — both of you have to be seen.", clears: "check" },
        { task: "The inner gate is open. Walk through it.",               clears: "exit" }
      ]
    }
  ];

  var SUB = {
    roadside: {
      id: "roadside", name: "THE ROAD", map: MAPS.roadside, theme: "road",
      base: ",", dark: 0.42, horizon: true,
      grade: [246, 200, 128, 0.16], haze: [162, 168, 186, 0.18],
      steps: [
        { task: "The tank is dry. There is a barn up the lane — the compass knows where.", clears: "horse" }
      ]
    },
    campsite: {
      id: "campsite", name: "THE CLEARING", map: MAPS.campsite, theme: "campsite",
      base: ",", dark: 0.40, safe: true, horizon: true,
      grade: [190, 150, 85, 0.14], haze: [70, 64, 46, 0.22],
      steps: [
        { task: "Make camp. Talk to him first.",                         clears: "arrival" },
        { task: "Three pieces of dry wood. Walk onto one and press USE.", clears: "wood" },
        { task: "Take the wood to the ring of stones and light it.",      clears: "fire" }
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

  TALK.tv = [
    [N, "The set has been on since before she woke up. Nobody in the studio is reading anything; the man at the desk is just sitting there while the captions run themselves."],
    [N, "Day three. She has been counting two."],
    ["OUISSY", "...Mercy General."],
    [N, "She has the phone out before she has decided to. It rings. It rings for a long time and then it stops ringing, the way it has all morning."],
    ["OUISSY", "Come on. Come on, pick up—"],
    [N, "Ward C, third floor, east side. Bed by the window. She was there on Sunday and he was complaining about the food."],
    [N, "Eight days post-op. He is not walking anywhere on his own."],
    ["OUISSY", "Okay."],
    ["OUISSY", "Okay. I'm coming to get you."],
    [N, "She turns the television off. The house is very quiet after that."]
  ];

  TALK.garage = [
    [N, "The space where the car goes is empty. There is a clean rectangle on the concrete where it has been sitting all winter, and nothing on it."],
    [N, "Portugal. They drove to the airport on Tuesday and left it in long stay, and she stood on the step and waved them off."],
    ["OUISSY", "...Right."],
    [N, "Mercy General is four miles. She has done it on a bike in twenty minutes and she is not going to do it on a bike today."],
    [N, "There is a road atlas in the door pocket of a car that is in Portugal. There is one on the shelf by the door as well, from before anyone had a phone."],
    ["OUISSY", "South to the river, then east along it. Four miles."],
    [N, "She takes it. It goes in the bag with the torch."]
  ];

  TALK.lobby = [
    [N, "The doors are open because somebody put a wheelchair through them from the inside."],
    [N, "Reception is dark. The board above it is not: it is on the emergency circuit, and it still knows where everybody is."],
    [N, "WARDS A–B — GROUND. WARD C — EAST WING, THIRD. THEATRES — SECOND. MORTUARY — LOWER GROUND."],
    [N, "Under it somebody has written on the desk in marker, in capitals, DOORS ARE ON THE PLANT ROOM. WEST SIDE. And then, smaller, underneath, SORRY."],
    ["OUISSY", "West side. Plant room. Then east."],
    [N, "The floor between here and there has been walked through by a lot of people who were bleeding."]
  ];

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
    "DAY THREE. THIS IS THE LAST SCHEDULED BULLETIN.",
    "STAY INSIDE. LOCK WHAT YOU CAN LOCK.",
    "DO NOT APPROACH ANYONE WHO SEEMS UNWELL.",
    "DO NOT ATTEMPT TO HELP THEM. THEY CANNOT BE HELPED.",
    "ALL CITY HOSPITALS ARE CLOSED TO THE PUBLIC.",
    "MERCY GENERAL. ST BRIDE'S. THE ROYAL. ALL CLOSED.",
    "THEY WERE THE FIRST PLACES IT GOT INTO.",
    "IF YOU CAN TRAVEL, GO NORTH.",
    "ASHCOMBE IS OPEN. NORTH ROAD, PAST THE RESERVOIR.",
    "YOU WILL BE CHECKED AT THE GATE AND GIVEN THE SERUM.",
    "BOTH ARE REQUIRED. THERE ARE NO EXCEPTIONS."
  ];

  var TV_TICKER = "EMERGENCY BROADCAST • DAY 3 • THIS IS NOT A TEST • " +
                  "ALL CITY HOSPITALS CLOSED • ASHCOMBE OPEN: NORTH ROAD PAST THE RESERVOIR • " +
                  "CHECKPOINT AND SERUM REQUIRED • NO FURTHER BULLETINS ARE SCHEDULED • ";

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
  /* Every scrap of variety in this game comes out of here: which way a
     bed faces, which shirt one of them is wearing, whether a window is
     lit, whether a roof has a tank on it.

     It was returning nothing above 0.5. The multiply produced a number
     past 2^53, so the low bits were rounded away before the shift ever
     saw them, and the top bit of the result could never be set. Which
     meant every threshold above a half in the whole file was dead code —
     no lit windows, no boarded ones, no shutters, no soot, no roof stair
     heads, no graffiti — and every table indexed by hash * length only
     ever reached its first half, so half the hairstyles, half the kits and
     half the skin tones had never been seen.

     Math.imul keeps it in 32 bits, and the shifts are unsigned. */
  function hash2(x, y) {
    var h = (x | 0) * 374761393 + (y | 0) * 668265263;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
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
      /* This used to be a sawtooth-and-square sting with a noise burst on
         top, which is the sound of a menu error, not of something turning
         round. What you hear now is the thing itself — a breath catching
         and a low note under the floor — and it gets quieter the further
         away it is. */
      alert: function (dist) {
        if (!on) return;
        var near = clamp(1 - (dist || 0) / 12, 0.25, 1);
        noise(0.34, 0.055 * near, 340, 0.8);
        noise(0.5, 0.030 * near, 900, 2.4);
        tone(104, 1.05, 0.055 * near, "sine", 88);
        tone(156, 0.85, 0.022 * near, "triangle", 148, 0.05);
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

    /* a tag: fat overlapping strokes in one colour with a highlight,
       which is what a piece looks like from across a road at night */
    graffiti: function (x, s) {
      x.clearRect(0, 0, s, s);
      var hue = [0x6ad0e8, 0xe8d24a, 0xe0603a, 0x8ae05a, 0xd05ad0][Math.floor(Math.random() * 5)];
      var col = function (a) {
        return "rgba(" + ((hue >> 16) & 255) + "," + ((hue >> 8) & 255) + "," + (hue & 255) + "," + a + ")";
      };
      x.lineCap = "round"; x.lineJoin = "round";
      for (var pass2 = 0; pass2 < 2; pass2++) {
        x.strokeStyle = pass2 ? col(0.95) : "rgba(12,10,14,.85)";
        x.lineWidth = pass2 ? s * 0.055 : s * 0.085;
        for (var i = 0; i < 4; i++) {
          var y0 = s * (0.34 + Math.random() * 0.30);
          x.beginPath();
          x.moveTo(s * (0.08 + i * 0.21), y0);
          for (var k = 1; k <= 3; k++) {
            x.quadraticCurveTo(
              s * (0.08 + i * 0.21 + k * 0.05), y0 + (Math.random() - 0.5) * s * 0.34,
              s * (0.08 + i * 0.21 + k * 0.06), y0 + (Math.random() - 0.5) * s * 0.26);
          }
          x.stroke();
        }
      }
      /* the drips */
      x.strokeStyle = col(0.7); x.lineWidth = s * 0.012;
      for (var d = 0; d < 7; d++) {
        var dx = s * Math.random(), dy = s * (0.5 + Math.random() * 0.14);
        x.beginPath(); x.moveTo(dx, dy); x.lineTo(dx, dy + s * (0.05 + Math.random() * 0.16)); x.stroke();
      }
    },

    /* heavy cotton duck: a coarse, flat basket weave */
    canvas: function (x, s) {
      x.fillStyle = "#c9c4b8"; x.fillRect(0, 0, s, s);
      var p = s / 40;
      for (var i = 0; i < s; i += p) {
        for (var j = 0; j < s; j += p) {
          var v = ((i / p + j / p) % 2) ? 12 : -12;
          x.fillStyle = "rgba(" + (150 + v) + "," + (146 + v) + "," + (136 + v) + ",.55)";
          x.fillRect(i, j, p, p);
        }
      }
      shadeWith(x, s, fbm(s, 6, 3, 41), 0.20);
      grain(x, s, 0.05);
    },
    /* wool: no weave to speak of, just a fibrous fuzz */
    wool: function (x, s) {
      x.fillStyle = "#bdbcb8"; x.fillRect(0, 0, s, s);
      for (var i = 0; i < 2600; i++) {
        var v = Math.floor(150 + Math.random() * 70);
        x.strokeStyle = "rgba(" + v + "," + v + "," + (v - 4) + ",.30)";
        x.lineWidth = rnd(0.6, 1.6);
        var hx = Math.random() * s, hy = Math.random() * s, a = Math.random() * 6.28;
        x.beginPath(); x.moveTo(hx, hy);
        x.lineTo(hx + Math.cos(a) * rnd(2, 7), hy + Math.sin(a) * rnd(2, 7));
        x.stroke();
      }
      shadeWith(x, s, fbm(s, 5, 4, 67), 0.24);
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
    /* everything solid a level is made of can stand between the camera and
       her, so everything solid a level is made of can be seen through */
    if (opts.cut !== false) occlude(m);
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
  /* Every one of these renders a cube and hands back its texture. The
     render target behind that texture was never released, so a playthrough
     left one alive per level and per cut — and they do not merely waste
     memory, they make the next one slower: 42ms, then 731, then 2310, and
     by the time the drive starts after five levels, thirty seconds. The
     scene that asked for it owns it now, and gives it back when it is
     torn down, so only ever one or two are alive. */
  /* Four cubes for the whole chapter, built while the first loading card
     is up and kept. Building one costs forty milliseconds with the stage
     quiet and thirty seconds in the middle of a scene change, so the only
     sane time to do it is once, at the start, under cover. */
  var CUBES = {};
  function cubeFor(key, sky, pal, dark) {
    if (CUBES[key]) return CUBES[key].texture;
    var rt = buildEnvironment(Stage.renderer, sky, pal, dark);
    CUBES[key] = rt;
    return rt.texture;
  }
  function warmCubes() {
    if (!Stage.renderer || warmCubes.done) return;
    warmCubes.done = true;
    [{ id: "gates", theme: "road", dark: 0.28 },
     { id: "roadside", theme: "road", dark: 0.34 },
     { id: "home", theme: "house", dark: 0.68 },
     { id: "streets", theme: "street", dark: 0.62 },
     { id: "hospital", theme: "hospital", dark: 0.63 }].forEach(function (d) {
      try {
        var m = skyFor(d);
        cubeFor(m.key, m.sky, PAL[d.theme] || PAL.house, d.dark);
      } catch (e) {}
    });
  }
  function disposeCubes() {
    for (var k in CUBES) { try { CUBES[k].dispose(); } catch (e) {} }
    CUBES = {};
    warmCubes.done = false;
  }

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
    return rt;
  }

  /* =========================================================
     10 — THE STAGE
     Renderer, camera, composer, and the one place that knows
     how big the canvas actually is.
     ========================================================= */
  /* the rungs of the resolution ladder, from the screen's own pixels
     down to a little over half of them */
  var RUNGS = [1.00, 0.90, 0.80, 0.72, 0.64, 0.56];

  var Stage = {
    renderer: null, camera: null, composer: null, gradePass: null,
    bloom: null, w: 0, h: 0, dpr: 1, quality: 0, ready: false,
    /* the rung of the resolution ladder we are currently standing on */
    scale: 1, rung: 0,

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
      /* A game rendered at 1.35x a 1440-wide stage is already past the
         point where anybody can see the difference; rendering it at 2x
         costs twice the pixels for nothing. */
      /* Render at the screen's own pixels. Capping this at 1.35 made a
         retina display permanently soft to buy headroom the machine might
         not have needed. The cap is the real ratio now, and where it sits
         on the ladder is decided by what the machine can actually hold.

         A phone at three times density starts two rungs down rather than
         at the top — a nine-times-the-pixels first second on a device that
         cannot take it is a worse first impression than a resolution that
         climbs — and the ladder walks it back up within a few seconds if
         there is room. Even two rungs down is sharper than the old cap. */
      Stage.dpr = Math.min(window.devicePixelRatio || 1, 2);
      Stage.rung = Stage.dpr >= 1.9 ? 2 : Stage.dpr >= 1.4 ? 1 : 0;
      Stage.scale = RUNGS[Stage.rung];
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
      /* 4x is where multisampling stops being visible on a moving image;
         8x is bandwidth spent on nothing. */
      var samples = Stage.quality === 0 ? Math.min(4, Stage.maxSamples) : 0;
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

      /* Bloom is a mip chain of blurs — five render targets and ten passes.
         It runs at half resolution, which is invisible on a glow and half
         the cost, and it comes off entirely at the bottom quality rung. */
      if (UB && Stage.quality < 2) {
        var b = new UB(new THREE.Vector2(Math.round(Stage.w / 2), Math.round(Stage.h / 2)),
                       0.34, 0.70, 0.88);
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

    resizeBloom: function () {
      if (Stage.bloom) Stage.bloom.setSize(Math.round(Stage.w / 2), Math.round(Stage.h / 2));
    },

    resize: function (force) {
      var canvas = Stage.renderer && Stage.renderer.domElement;
      if (!canvas) return;
      var host = canvas.parentElement || canvas;
      var cw = Math.max(160, host.clientWidth || 640);
      var ch = Math.max(90, host.clientHeight || 360);
      var scale = ([1, 0.82, 0.62][Stage.quality] || 1) * Stage.scale;
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
      Stage.resizeBloom();
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
      disposeCubes();
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
    /* a face is one mesh whose eyes, irises and brows are vertex colours,
       so the merge has to carry colour when any part of it has one */
    var wantColour = false;
    list.forEach(function (g) { if (g.attributes.color) wantColour = true; });
    var col = wantColour ? [] : null;
    list.forEach(function (g) {
      var gp = g.attributes.position.array, gn = g.attributes.normal.array,
          gu = g.attributes.uv ? g.attributes.uv.array : null,
          gi = g.index ? g.index.array : null;
      var n = gp.length / 3;
      for (var i = 0; i < gp.length; i++) pos.push(gp[i]);
      for (var j = 0; j < gn.length; j++) norm.push(gn[j]);
      if (gu) { for (var k = 0; k < gu.length; k++) uv.push(gu[k]); }
      else { for (var k2 = 0; k2 < n * 2; k2++) uv.push(0); }
      if (col) {
        var gc = g.attributes.color;
        for (var c = 0; c < n; c++) {
          if (gc) col.push(gc.getX(c), gc.getY(c), gc.getZ(c));
          else col.push(1, 1, 1);
        }
      }
      if (gi) for (var m = 0; m < gi.length; m++) idx.push(gi[m] + off);
      off += n;
      g.dispose();
    });
    var out = new THREE.BufferGeometry();
    out.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    out.setAttribute("normal", new THREE.Float32BufferAttribute(norm, 3));
    out.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    if (col) out.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
    if (idx.length) out.setIndex(idx);
    return out;
  }

  /* ---- a plain loft ----
     skinnedTube with the weights thrown away: a shell built in figure
     space and hung off one bone, which is what a vest or a satchel is. */
  function rigidLoft(rings, radial, capStart, capEnd, opts) {
    rings.forEach(function (r) { if (!r.w) r.w = [[0, 1]]; });
    var g = skinnedTube(rings, radial, capStart, capEnd, opts);
    g.deleteAttribute("skinIndex");
    g.deleteAttribute("skinWeight");
    return g;
  }

  /* ---- a tapered sweep along a curve ----
     Hair, cables, a fringe, a strap: anything that is a tube whose radius
     changes along its length. three has TubeGeometry, but its radius is
     constant, and a lock of hair that does not taper reads as a sausage. */
  function sweep(points, r0, r1, radial, twist, segs) {
    var curve = new THREE.CatmullRomCurve3(points);
    /* five rings per control point is a cable, not a lock of hair: at
       three it is the same silhouette for forty per cent of the triangles,
       and there are two hundred of these on a head */
    var seg = segs || Math.max(6, points.length * 3);
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

  /* =========================================================
     THE CAST
     Everything on two legs in this game is a skinned mesh on a
     real skeleton. It used to be about twenty-five separate
     primitives parented to each other, which is why it read as
     a shop mannequin: every joint was a visible cut, nothing
     deformed, and the whole thing cost twenty-five draw calls.

     Now there is one continuous body surface, garments as their
     own shells over it, and bones underneath. An elbow bends
     instead of hinging, a shoulder is a shoulder rather than a
     ball sitting on a tube, and a figure costs seven calls.
     ========================================================= */

  /* ---- materials ---- */
  function skinMat(hex, rough) {
    return new THREE.MeshStandardMaterial({
      color: hex, roughness: rough == null ? 0.66 : rough, metalness: 0.0,
      map: tex("skin", 256, 5), bumpMap: bump("skin", 256, 5), bumpScale: 0.015,
      envMapIntensity: 0.55
    });
  }
  /* denim is stiff and matte with a coarse twill; jersey is soft and
     slightly sheenier; canvas sits between them. They should not all be
     the same surface in different colours. */
  var WEAVE = {
    denim:  { rough: 0.96, bump: 0.088, rep: 11, env: 0.16 },
    cloth:  { rough: 0.86, bump: 0.042, rep: 9,  env: 0.38 },
    canvas: { rough: 0.93, bump: 0.070, rep: 8,  env: 0.22 },
    wool:   { rough: 0.98, bump: 0.095, rep: 7,  env: 0.12 }
  };
  function clothMat(hex, rough, weave) {
    var name = weave || "cloth";
    var w = WEAVE[name] || WEAVE.cloth;
    return new THREE.MeshStandardMaterial({
      color: hex, roughness: rough == null ? w.rough : rough, metalness: 0.0,
      map: tex(name, 256, w.rep), bumpMap: bump(name, 256, w.rep),
      bumpScale: w.bump,
      roughnessMap: roughTex("clothR", 256, 5),
      envMapIntensity: w.env
    });
  }
  function leatherMat(hex) {
    return new THREE.MeshStandardMaterial({
      color: hex, roughness: 0.38, metalness: 0.08,
      map: tex("cloth", 256, 10), bumpMap: bump("cloth", 256, 10), bumpScale: 0.026,
      envMapIntensity: 1.0
    });
  }
  function rotMat(hex) {
    return new THREE.MeshStandardMaterial({
      color: hex, roughness: 0.80, metalness: 0.0,
      map: tex("rot", 256, 6), bumpMap: bump("rot", 256, 6), bumpScale: 0.06,
      envMapIntensity: 0.4
    });
  }
  function hairMat(hex, rough) {
    return new THREE.MeshStandardMaterial({
      color: hex, roughness: rough == null ? 0.44 : rough, metalness: 0.0,
      map: tex("hair", 256, 6), bumpMap: bump("hair", 256, 6), bumpScale: 0.05,
      envMapIntensity: 0.30, side: THREE.DoubleSide
    });
  }

  /* ---- the skeleton ----
     Twenty bones. The two extra ones — a clavicle either side and a hip
     pivot either leg — exist so that swinging a limb and splaying it are
     separate rotations rather than fighting over the same joint. */
  var BONES = [
    ["root",   null,     0,      0,      0],
    ["hips",   "root",   0,      0.880,  0],
    ["spine",  "hips",   0,      0.130,  0],
    ["chest",  "spine",  0,      0.170,  0],
    ["neck",   "chest",  0,      0.250,  0],
    ["head",   "neck",   0,      0.100,  0],
    ["clavL",  "chest",  0,      0.150,  0.055],
    ["armL",   "clavL",  0,      0,      0.125],
    ["foreL",  "armL",   0,     -0.290,  0],
    ["handL",  "foreL",  0,     -0.270,  0],
    ["clavR",  "chest",  0,      0.150, -0.055],
    ["armR",   "clavR",  0,      0,     -0.125],
    ["foreR",  "armR",   0,     -0.290,  0],
    ["handR",  "foreR",  0,     -0.270,  0],
    ["hipL",   "hips",   0,     -0.020,  0.095],
    ["thighL", "hipL",   0,      0,      0],
    ["shinL",  "thighL", 0,     -0.420,  0],
    ["footL",  "shinL",  0,     -0.380,  0],
    ["hipR",   "hips",   0,     -0.020, -0.095],
    ["thighR", "hipR",   0,      0,      0],
    ["shinR",  "thighR", 0,     -0.420,  0],
    ["footR",  "shinR",  0,     -0.380,  0]
  ];
  var BONE_INDEX = (function () {
    var m = {};
    for (var i = 0; i < BONES.length; i++) m[BONES[i][0]] = i;
    return m;
  })();

  function makeSkeleton(S, legLen, armLen) {
    var list = [], byName = {};
    for (var i = 0; i < BONES.length; i++) {
      var d = BONES[i];
      var b = new THREE.Bone();
      b.name = d[0];
      var y = d[3], z = d[4];
      /* long-limbed or short-limbed people are a bone length, not a scale */
      if (d[0] === "shinL" || d[0] === "shinR" || d[0] === "footL" || d[0] === "footR") y *= legLen;
      if (d[0] === "foreL" || d[0] === "foreR" || d[0] === "handL" || d[0] === "handR") y *= armLen;
      b.position.set(d[2] * S, y * S, z * S);
      list.push(b); byName[d[0]] = b;
      if (d[1]) byName[d[1]].add(b);
    }
    /* the skeleton itself is built later, once these are in a scene graph
       and their world matrices mean something */
    return { list: list, byName: byName, root: list[0] };
  }

  /* where the joints actually end up, so the geometry can be authored to
     land on them rather than near them */
  function jointHeights(B) {
    var chest = 0.880 + 0.130 + 0.170;
    var elbow = chest + 0.150 - 0.290 * B.armLen;
    return {
      chest: chest,
      shoulder: chest + 0.150,
      elbow: elbow,
      wrist: elbow - 0.270 * B.armLen,
      knee: 0.860 - 0.420 * B.legLen,
      ankle: 0.860 - 0.800 * B.legLen
    };
  }

  /* ---- a swept, skinned tube ----
     Every limb, every torso and every garment in the game is a stack of
     rings with bone weights on them. One builder, so an arm and a sleeve
     are the same kind of object and deform together. */
  function skinnedTube(rings, radial, capStart, capEnd, opts) {
    var pos = [], uv = [], si = [], sw = [], idx = [];
    var n = rings.length, ringVerts = radial + 1;
    opts = opts || {};
    var folds = opts.folds || 0, foldN = opts.foldN || 7, uvScale = opts.uvScale || 1;

    /* ---- arc-length UVs ----
       Indexing a UV by ring number stretches the texture wherever the rings
       are unevenly spaced, and indexing it by the fraction round a ring
       stretches it wherever the ring is wide. Both were happening, which is
       what made the cloth read as shrink-wrapped panels with the weave
       smeared along the limbs. Both axes are measured in real distance now,
       so a centimetre of surface is a centimetre of texture anywhere on the
       model. */
    var along = [0];
    for (var q = 1; q < n; q++) {
      var a0 = rings[q - 1].c, a1 = rings[q].c;
      along.push(along[q - 1] + Math.hypot(a1[0] - a0[0], a1[1] - a0[1], a1[2] - a0[2]));
    }

    for (var r = 0; r < n; r++) {
      var ring = rings[r];
      var c = ring.c;
      var ux = ring.u ? ring.u[0] : 1, uy = ring.u ? ring.u[1] : 0, uz = ring.u ? ring.u[2] : 0;
      var vx = ring.v ? ring.v[0] : 0, vy = ring.v ? ring.v[1] : 0, vz = ring.v ? ring.v[2] : 1;
      var w = ring.w;
      /* Ramanujan's approximation, which is close enough for cloth */
      var circ = Math.PI * (3 * (ring.ru + ring.rv)
                 - Math.sqrt((3 * ring.ru + ring.rv) * (ring.ru + 3 * ring.rv)));
      for (var j = 0; j <= radial; j++) {
        var a = j / radial * 6.2831853;
        /* cloth does not lie flat on a body: it gathers into soft folds
           running with the limb, which is what catches the light */
        var fAmt = typeof folds === "function" ? folds(ring.c[1]) : folds;
      var f = fAmt ? (1 + Math.sin(a * foldN + r * 0.35) * fAmt
                        + Math.sin(a * (foldN * 2.4) + r * 0.9) * fAmt * 0.42) : 1;
        var ca = Math.cos(a) * ring.ru * f, sa = Math.sin(a) * ring.rv * f;
        pos.push(c[0] + ux * ca + vx * sa,
                 c[1] + uy * ca + vy * sa,
                 c[2] + uz * ca + vz * sa);
        uv.push((j / radial) * circ * uvScale, along[r] * uvScale);
        si.push(w[0] ? w[0][0] : 0, w[1] ? w[1][0] : 0, w[2] ? w[2][0] : 0, 0);
        sw.push(w[0] ? w[0][1] : 1, w[1] ? w[1][1] : 0, w[2] ? w[2][1] : 0, 0);
      }
    }
    /* Which way round a tube's triangles wind depends on whether its rings
       run along its frame or against it. A stack authored top-down is the
       mirror of one authored bottom-up, and gets built inside out — every
       face pointing into the model, every one of them culled. */
    var r0 = rings[0].c, rN = rings[n - 1].c;
    var dir = [rN[0] - r0[0], rN[1] - r0[1], rN[2] - r0[2]];
    var u0 = rings[0].u || [1, 0, 0], v0 = rings[0].v || [0, 0, 1];
    var cr = [u0[1] * v0[2] - u0[2] * v0[1],
              u0[2] * v0[0] - u0[0] * v0[2],
              u0[0] * v0[1] - u0[1] * v0[0]];
    var flipWind = (dir[0] * cr[0] + dir[1] * cr[1] + dir[2] * cr[2]) > 0;

    for (var r2 = 0; r2 < n - 1; r2++) {
      for (var j2 = 0; j2 < radial; j2++) {
        var a2 = r2 * ringVerts + j2, b2 = a2 + ringVerts;
        if (flipWind) idx.push(a2, a2 + 1, b2, b2, a2 + 1, b2 + 1);
        else idx.push(a2, b2, a2 + 1, b2, b2 + 1, a2 + 1);
      }
    }
    /* caps, as a fan to a centre vertex that carries the ring's weights */
    function cap(ringIdx, flip) {
      var ring = rings[ringIdx];
      var base = pos.length / 3;
      pos.push(ring.c[0], ring.c[1], ring.c[2]);
      uv.push(0, along[ringIdx] * uvScale);
      var w2 = ring.w;
      si.push(w2[0] ? w2[0][0] : 0, w2[1] ? w2[1][0] : 0, w2[2] ? w2[2][0] : 0, 0);
      sw.push(w2[0] ? w2[0][1] : 1, w2[1] ? w2[1][1] : 0, w2[2] ? w2[2][1] : 0, 0);
      var off = ringIdx * ringVerts;
      var f2 = flipWind ? !flip : flip;
      for (var j3 = 0; j3 < radial; j3++) {
        if (f2) idx.push(base, off + j3, off + j3 + 1);
        else idx.push(base, off + j3 + 1, off + j3);
      }
    }
    if (capStart) cap(0, true);
    if (capEnd) cap(n - 1, false);

    var g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    g.setAttribute("skinIndex", new THREE.Uint16BufferAttribute(si, 4));
    g.setAttribute("skinWeight", new THREE.Float32BufferAttribute(sw, 4));
    g.setIndex(idx);
    g.computeVertexNormals();
    /* the seam column is the same ring of points twice over; without this
       there is a visible crease straight up the model */
    var nor = g.attributes.normal;
    for (var r3 = 0; r3 < n; r3++) {
      var i0 = r3 * ringVerts, i1 = i0 + radial;
      var nx = (nor.getX(i0) + nor.getX(i1)) * 0.5;
      var ny = (nor.getY(i0) + nor.getY(i1)) * 0.5;
      var nz = (nor.getZ(i0) + nor.getZ(i1)) * 0.5;
      var l = Math.hypot(nx, ny, nz) || 1;
      nor.setXYZ(i0, nx / l, ny / l, nz / l);
      nor.setXYZ(i1, nx / l, ny / l, nz / l);
    }
    nor.needsUpdate = true;
    return g;
  }

  /* give an ordinary geometry the weights to ride one bone */
  function rigidSkin(g, boneIdx) {
    var count = g.attributes.position.count;
    var si = new Uint16Array(count * 4), sw = new Float32Array(count * 4);
    for (var i = 0; i < count; i++) { si[i * 4] = boneIdx; sw[i * 4] = 1; }
    g.setAttribute("skinIndex", new THREE.Uint16BufferAttribute(si, 4));
    g.setAttribute("skinWeight", new THREE.Float32BufferAttribute(sw, 4));
    if (!g.attributes.uv) {
      var uv = new Float32Array(count * 2);
      g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    }
    return g;
  }

  /* merge geometries that carry skin weights */
  function mergeSkinned(list) {
    var pos = [], nor = [], uv = [], si = [], sw = [], col = null, idx = [], off = 0;
    var wantColour = list.some(function (g) { return !!g.attributes.color; });
    if (wantColour) col = [];
    list.forEach(function (g) {
      var gp = g.attributes.position.array, gn = g.attributes.normal.array,
          gu = g.attributes.uv.array, gs = g.attributes.skinIndex.array,
          gw = g.attributes.skinWeight.array, gi = g.index ? g.index.array : null;
      for (var i = 0; i < gp.length; i++) pos.push(gp[i]);
      for (var j = 0; j < gn.length; j++) nor.push(gn[j]);
      for (var k = 0; k < gu.length; k++) uv.push(gu[k]);
      for (var m = 0; m < gs.length; m++) si.push(gs[m]);
      for (var q = 0; q < gw.length; q++) sw.push(gw[q]);
      if (col) {
        var gc = g.attributes.color;
        for (var c = 0; c < gp.length / 3; c++) {
          if (gc) col.push(gc.getX(c), gc.getY(c), gc.getZ(c));
          else col.push(1, 1, 1);
        }
      }
      if (gi) for (var t = 0; t < gi.length; t++) idx.push(gi[t] + off);
      off += gp.length / 3;
      g.dispose();
    });
    var out = new THREE.BufferGeometry();
    out.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    out.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
    out.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    out.setAttribute("skinIndex", new THREE.Uint16BufferAttribute(si, 4));
    out.setAttribute("skinWeight", new THREE.Float32BufferAttribute(sw, 4));
    if (col) out.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
    if (idx.length) out.setIndex(idx);
    return out;
  }

  function colourGeom(g, hex) {
    var c = new THREE.Color(hex), n = g.attributes.position.count;
    var arr = new Float32Array(n * 3);
    for (var i = 0; i < n; i++) { arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b; }
    g.setAttribute("color", new THREE.Float32BufferAttribute(arr, 3));
    return g;
  }

  /* ---- the shape of a person ----
     Widths in figure units, where the figure is about 1.72 tall. `build`
     scales the parts of it that differ between people rather than scaling
     the whole silhouette, which is what stops four builds from reading as
     one build at four sizes. */
  var BUILD = {
    slim:    { chest: 0.92, waist: 0.86, hip: 0.96, arm: 0.90, leg: 0.94, shoulder: 0.94, legLen: 1.02, armLen: 1.00 },
    average: { chest: 1.00, waist: 1.00, hip: 1.00, arm: 1.00, leg: 1.00, shoulder: 1.00, legLen: 1.00, armLen: 1.00 },
    broad:   { chest: 1.14, waist: 1.06, hip: 1.06, arm: 1.16, leg: 1.08, shoulder: 1.16, legLen: 0.99, armLen: 1.02 },
    heavy:   { chest: 1.20, waist: 1.30, hip: 1.24, arm: 1.18, leg: 1.14, shoulder: 1.08, legLen: 0.96, armLen: 0.98 }
  };

  var BI = BONE_INDEX;

  /* ---- sculpting a face ----
     A head made of a ball with a nose stuck on it and two beads for eyes
     reads as blurred and blank however good the texture is, because none
     of the shapes a face is actually made of are there. This displaces one
     smooth sphere by a list of features — a brow with a dip at the bridge,
     two sockets the eyes sit inside, a nose with a bridge and a tip, lips
     with a line between them, cheekbones, a jaw and a chin. Every feature
     is a smooth falloff, so the surface stays continuous and there is
     never a seam to catch the light. */
  /* the dials that make one person's head a different head from the next:
     a wider or narrower skull, a heavier jaw, deeper or shallower sockets,
     a brow that sits high or low. Everything defaults to the middle. */
  function faceDial(f) {
    f = f || {};
    var d = { wide: 1, long: 1, jaw: 1, chin: 1, cheek: 1, brow: 1, browY: 0,
              socket: 1, eyeZ: 0, eyeY: 0, noseL: 1, noseW: 1, mouthW: 1,
              mouthY: 0, lip: 1, gaunt: 0 };
    for (var k in d) if (f[k] != null) d[k] = f[k];
    return d;
  }

  function sculptHead(g, S, face) {
    var D = faceDial(face);
    var pos = g.attributes.position;
    var v = new THREE.Vector3();

    /* ---- pass one: the shape of the skull ----
       A head is not a ball. The face is close to a plane that the nose and
       the lips stand out from; the jaw narrows to a chin; the back of the
       skull is flatter than a sphere and the crown comes in. Doing this
       before the features means they are laid on a head rather than on a
       balloon — which is what made every one of them read as a lump. */
    for (var p = 0; p < pos.count; p++) {
      var x = pos.getX(p), y = pos.getY(p), z = pos.getZ(p);
      var az = Math.abs(z);
      /* the midface flattens, hardest at the centre line and at nose
         height, and not at all past the cheekbone */
      var fz = 1 - clamp(az / (0.070 * S), 0, 1);
      var dy = (y + 0.015 * S) / (0.070 * S);
      var fy = Math.exp(-dy * dy);
      if (x > 0) x -= fy * fz * fz * 0.013 * S;
      /* the flesh a body loses when it stops eating */
      if (D.gaunt) {
        var hollow = Math.exp(-Math.pow((y + 0.030 * S) / (0.042 * S), 2))
                   * clamp((az - 0.026 * S) / (0.036 * S), 0, 1);
        if (x > 0) x -= hollow * D.gaunt * 0.016 * S;
        var tmp = Math.exp(-Math.pow((y - 0.050 * S) / (0.034 * S), 2))
                * clamp((az - 0.040 * S) / (0.030 * S), 0, 1);
        x -= tmp * D.gaunt * 0.010 * S * (x > 0 ? 1 : -1);
      }
      /* the jaw: below the mouth the head draws in to a chin instead of
         falling away like the bottom of a sphere */
      var jt = clamp((-0.026 * S - y) / (0.074 * S), 0, 1);
      z *= 1 - jt * jt * (0.20 - 0.07 * D.jaw);
      if (x > 0) x += jt * jt * 0.013 * S * D.chin * (1 - clamp(az / (0.066 * S), 0, 1));
      /* a flatter back to the skull, and a crown that narrows */
      if (x < 0) x -= x * clamp(-x / (0.100 * S), 0, 1) * 0.12;
      if (y < 0) y *= 0.94;              /* the lower face is not that long */
      var ct = clamp((y - 0.045 * S) / (0.071 * S), 0, 1);
      x *= 1 - ct * 0.05; z *= 1 - ct * 0.09;
      pos.setXYZ(p, x, y, z);
    }
    g.computeVertexNormals();

    /* ---- pass two: the features ----
       [x, y, z, radiusX, radiusY, radiusZ, amount] in head-local units,
       amount positive pushes the surface out along its own normal. A
       feature with a non-zero z is mirrored. Radii are deliberately small:
       a brow ridge is two centimetres of bone, not a hemisphere. */
    var eZ = 0.032 + D.eyeZ, eY = 0.012 + D.eyeY, mY = D.mouthY;
    var F = [
      /* brow ridge, and the dip between the brows */
      [ 0.066,  0.046 + D.browY, 0.030, 0.032, 0.014, 0.030,  0.008 * D.brow],
      [ 0.078,  0.036 + D.browY, 0.000, 0.016, 0.014, 0.010, -0.004],
      /* the sockets the eyes sit in */
      [ 0.082,  eY, eZ, 0.026, 0.022, 0.024, -0.017 * D.socket - D.gaunt * 0.010],
      /* cheekbones, the hollow under them, and the fold beside the nose */
      [ 0.056, -0.004, 0.052, 0.032, 0.022, 0.026,  0.008 * D.cheek + D.gaunt * 0.005],
      [ 0.052, -0.040, 0.048, 0.030, 0.024, 0.026, -0.007 - D.gaunt * 0.007],
      [ 0.070, -0.048, 0.022, 0.018, 0.018, 0.012, -0.005],
      /* the philtrum, the crease under the lower lip, and the chin */
      [ 0.080, -0.048 + mY, 0.000, 0.010, 0.010, 0.005, -0.003],
      [ 0.066, -0.082 + mY, 0.000, 0.024, 0.010, 0.020, -0.005],
      [ 0.066, -0.096, 0.000, 0.026, 0.020, 0.022,  0.011 * D.chin],
      /* the jawline, running back from the chin to under the ear */
      [ 0.044, -0.088, 0.048, 0.038, 0.022, 0.028,  0.012 * D.jaw],
      [ 0.004, -0.076, 0.070, 0.042, 0.026, 0.026,  0.011 * D.jaw],
      [-0.030, -0.050, 0.076, 0.036, 0.030, 0.024,  0.008 * D.jaw],
      /* temples in a shade, and the hollow at the base of the skull */
      [ 0.036,  0.062, 0.060, 0.030, 0.032, 0.022, -0.005],
      [-0.080, -0.055, 0.000, 0.045, 0.032, 0.050, -0.007]
    ];

    for (var i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      var n = v.clone().normalize();
      var d = 0;
      for (var f = 0; f < F.length; f++) {
        var a = F[f];
        var zs = a[2] === 0 ? [0] : [a[2], -a[2]];
        for (var s = 0; s < zs.length; s++) {
          var qx = (v.x - a[0] * S) / (a[3] * S);
          var qy = (v.y - a[1] * S) / (a[4] * S);
          var qz = (v.z - zs[s] * S) / (a[5] * S);
          d += a[6] * S * Math.exp(-(qx * qx + qy * qy + qz * qz));
        }
      }
      pos.setXYZ(i, v.x + n.x * d, v.y + n.y * d, v.z + n.z * d);
    }
    g.computeVertexNormals();
    return g;
  }

  /* ---- the nose ----
     Built rather than sculpted. A nose is the one feature that projects
     clear of the face, and a gaussian pushed into a sphere can only ever
     make a mound where it should be. */
  function buildNose(S, face) {
    var D = faceDial(face), L = D.noseL, W = D.noseW;
    var ridge = sweep([
      new THREE.Vector3(0.076 * S,  0.038 * S, 0),
      new THREE.Vector3(0.085 * S,  0.020 * S * L, 0),
      new THREE.Vector3(0.093 * S,  0.002 * S * L, 0),
      new THREE.Vector3(0.098 * S, -0.018 * S * L, 0)
    ], 0.0104 * S * W, 0.0150 * S * W, 16, 0);
    ridge.scale(1, 1, 1.10);                      /* wider than it is deep */
    var tip = new THREE.SphereGeometry(0.0142 * S, 20, 15);
    tip.scale(0.90, 0.80, 0.92 * W);
    tip.translate(0.0965 * S, -0.0248 * S * L, 0);
    var parts = [ridge, tip];
    [1, -1].forEach(function (sd) {
      var w = new THREE.SphereGeometry(0.0122 * S, 16, 12);
      w.scale(0.72, 0.66, 0.74);
      w.translate(0.0902 * S, -0.0288 * S * L, sd * 0.0128 * S * W);
      parts.push(w);
    });
    return mergeGeoms(parts);
  }

  /* ---------------- the body ---------------- */
  function buildBody(S, B, depth, spec) {
    var parts = [];
    var D = faceDial(spec && spec.face);
    var lod = !!(spec && spec.lod);
    var W = function (a, wa, b, wb) {
      return b ? [[BI[a], wa], [BI[b], wb]] : [[BI[a], 1]];
    };

    /* torso: hips through the ribcage to the base of the neck */
    var torso = [
      { c: [0, 0.700 * S, 0], ru: 0.100 * S * depth * B.hip,  rv: 0.132 * S * B.hip,   w: W("hips", 1) },
      { c: [0, 0.800 * S, 0], ru: 0.113 * S * depth * B.hip,  rv: 0.150 * S * B.hip,   w: W("hips", 1) },
      { c: [0, 0.880 * S, 0], ru: 0.112 * S * depth * B.hip,  rv: 0.152 * S * B.hip,   w: W("hips", 1) },
      { c: [0, 0.950 * S, 0], ru: 0.100 * S * depth * B.waist, rv: 0.134 * S * B.waist, w: W("hips", 0.55, "spine", 0.45) },
      { c: [0, 1.010 * S, 0], ru: 0.094 * S * depth * B.waist, rv: 0.126 * S * B.waist, w: W("spine", 1) },
      { c: [0, 1.090 * S, 0], ru: 0.102 * S * depth * B.chest, rv: 0.144 * S * B.chest, w: W("spine", 0.55, "chest", 0.45) },
      { c: [0, 1.180 * S, 0], ru: 0.110 * S * depth * B.chest, rv: 0.164 * S * B.chest, w: W("chest", 1) },
      { c: [0, 1.270 * S, 0], ru: 0.108 * S * depth * B.chest, rv: 0.172 * S * B.shoulder, w: W("chest", 1) },
      { c: [0, 1.330 * S, 0], ru: 0.098 * S * depth * B.chest, rv: 0.172 * S * B.shoulder, w: W("chest", 1) },
      { c: [0, 1.362 * S, 0], ru: 0.082 * S * depth * B.chest, rv: 0.132 * S * B.shoulder, w: W("chest", 1) },
      { c: [0, 1.396 * S, 0], ru: 0.060 * S, rv: 0.074 * S, w: W("chest", 0.5, "neck", 0.5) },
      { c: [0, 1.440 * S, 0], ru: 0.050 * S, rv: 0.055 * S, w: W("neck", 1) },
      { c: [0, 1.500 * S, 0], ru: 0.050 * S, rv: 0.055 * S, w: W("neck", 0.45, "head", 0.55) }
    ];
    parts.push(skinnedTube(torso, lod ? 14 : 22, true, false));

    /* arms, with a hand on the end of each rather than a ball */
    var J = jointHeights(B);
    [["L", 1], ["R", -1]].forEach(function (sd) {
      var s = sd[0], sign = sd[1], z = sign * 0.180 * S * B.shoulder;
      var sh = J.shoulder, el = J.elbow, wr = J.wrist;
      var arm = [
        { c: [0, sh * S,            z], ru: 0.055 * S * B.arm, rv: 0.056 * S * B.arm, w: W("arm" + s, 1) },
        { c: [0, (sh - 0.038) * S,  z], ru: 0.065 * S * B.arm, rv: 0.066 * S * B.arm, w: W("arm" + s, 1) },
        { c: [0, (sh - 0.095) * S,  z], ru: 0.055 * S * B.arm, rv: 0.057 * S * B.arm, w: W("arm" + s, 1) },
        { c: [0, (el + 0.115) * S,  z], ru: 0.048 * S * B.arm, rv: 0.050 * S * B.arm, w: W("arm" + s, 1) },
        { c: [0, (el + 0.040) * S,  z], ru: 0.044 * S * B.arm, rv: 0.046 * S * B.arm, w: W("arm" + s, 0.70, "fore" + s, 0.30) },
        { c: [0, el * S,            z], ru: 0.043 * S * B.arm, rv: 0.045 * S * B.arm, w: W("arm" + s, 0.35, "fore" + s, 0.65) },
        { c: [0, (el - 0.075) * S,  z], ru: 0.042 * S * B.arm, rv: 0.043 * S * B.arm, w: W("fore" + s, 1) },
        { c: [0, (wr + 0.075) * S,  z], ru: 0.036 * S * B.arm, rv: 0.037 * S * B.arm, w: W("fore" + s, 1) },
        { c: [0, (wr + 0.018) * S,  z], ru: 0.031 * S * B.arm, rv: 0.032 * S * B.arm, w: W("fore" + s, 0.45, "hand" + s, 0.55) },
        /* the hand: wide front-to-back, thin across, tapering to fingers */
        { c: [0, (wr - 0.012) * S,  z], ru: 0.042 * S, rv: 0.024 * S, w: W("hand" + s, 1) },
        { c: [0, (wr - 0.048) * S,  z], ru: 0.046 * S, rv: 0.025 * S, w: W("hand" + s, 1) },
        { c: [0, (wr - 0.082) * S,  z], ru: 0.044 * S, rv: 0.023 * S, w: W("hand" + s, 1) },
        { c: [0, (wr - 0.098) * S,  z], ru: 0.040 * S, rv: 0.021 * S, w: W("hand" + s, 1) }
      ];
      if (lod) {                                   /* a mitt, at a distance */
        arm.push({ c: [0, (wr - 0.140) * S, z], ru: 0.036 * S, rv: 0.019 * S, w: W("hand" + s, 1) });
        arm.push({ c: [0, (wr - 0.166) * S, z], ru: 0.016 * S, rv: 0.010 * S, w: W("hand" + s, 1) });
      }
      parts.push(skinnedTube(arm, lod ? 10 : 18, true, true));

      /* four fingers, because a hand that ends in a paddle is the first
         thing the eye picks out as wrong */
      var FING = lod ? [] : [[ 0.031, 0.074, 0.004], [ 0.007, 0.082, 0.000],
                  [-0.017, 0.076, -0.003], [-0.040, 0.060, -0.007]];
      FING.forEach(function (fg) {
        var fx = fg[0] * S, fl = fg[1] * S, spl = fg[2] * S, ring = [];
        for (var q = 0; q <= 5; q++) {
          var t = q / 5, curl = t * t * 0.019 * S;
          /* a knuckle, then a taper: a finger is not a cone */
          var rr = (0.0078 - t * 0.0018 + (t > 0.02 && t < 0.30 ? 0.0009 : 0)) * S;
          ring.push({ c: [fx + curl, (wr - 0.092) * S - t * fl, z + spl * t],
                      ru: rr, rv: rr * 0.92, w: W("hand" + s, 1) });
        }
        parts.push(skinnedTube(ring, 9, true, true));
      });

      /* the thumb, which is most of what makes a hand a hand */
      var tz = z - sign * 0.028 * S;
      var thumb = [
        { c: [0.012 * S, (wr - 0.024) * S, tz], ru: 0.015 * S, rv: 0.013 * S, w: W("hand" + s, 1) },
        { c: [0.024 * S, (wr - 0.056) * S, tz - sign * 0.006 * S], ru: 0.014 * S, rv: 0.012 * S, w: W("hand" + s, 1) },
        { c: [0.028 * S, (wr - 0.084) * S, tz - sign * 0.009 * S], ru: 0.010 * S, rv: 0.009 * S, w: W("hand" + s, 1) }
      ];
      parts.push(skinnedTube(thumb, 10, true, true));
    });

    /* legs */
    [["L", 1], ["R", -1]].forEach(function (sd) {
      var s = sd[0], sign = sd[1], z = sign * 0.095 * S * B.hip;
      var yk = J.knee, ya = J.ankle;
      var leg = [
        { c: [0, 0.905 * S, z], ru: 0.088 * S * B.leg, rv: 0.090 * S * B.leg, w: W("thigh" + s, 1) },
        { c: [0, 0.800 * S, z], ru: 0.090 * S * B.leg, rv: 0.092 * S * B.leg, w: W("thigh" + s, 1) },
        { c: [0, 0.660 * S, z], ru: 0.079 * S * B.leg, rv: 0.081 * S * B.leg, w: W("thigh" + s, 1) },
        { c: [0, (yk + 0.055) * S, z], ru: 0.068 * S * B.leg, rv: 0.070 * S * B.leg, w: W("thigh" + s, 0.72, "shin" + s, 0.28) },
        { c: [0, yk * S, z], ru: 0.066 * S * B.leg, rv: 0.068 * S * B.leg, w: W("thigh" + s, 0.35, "shin" + s, 0.65) },
        { c: [0, (yk - 0.070) * S, z], ru: 0.066 * S * B.leg, rv: 0.068 * S * B.leg, w: W("shin" + s, 1) },
        { c: [0, (yk - 0.180) * S, z], ru: 0.055 * S * B.leg, rv: 0.057 * S * B.leg, w: W("shin" + s, 1) },
        { c: [0, (ya + 0.085) * S, z], ru: 0.042 * S * B.leg, rv: 0.044 * S * B.leg, w: W("shin" + s, 1) },
        { c: [0, (ya + 0.015) * S, z], ru: 0.038 * S, rv: 0.042 * S, w: W("shin" + s, 0.45, "foot" + s, 0.55) }
      ];
      parts.push(skinnedTube(leg, lod ? 12 : 18, true, true));
    });

    /* ---- the head ----
       Built as geometry, weighted whole to the head bone and merged into
       the body, so the neck runs into the jaw without a joint in it. */
    var HEAD = BI.head;
    var hy = 1.600 * S;
    var headParts = [];
    (function () {
      /* one sphere, then sculpted — dense enough that a lip or an eye
         socket has vertices to be made out of */
      var g = new THREE.SphereGeometry(0.100 * S, lod ? 18 : 52, lod ? 13 : 40);
      g.scale(1.00, 1.15 * D.long, 0.86 * D.wide);
      (function () {                                /* UVs in metres, as the body's are */
        var uvA = g.attributes.uv;
        for (var i = 0; i < uvA.count; i++)
          uvA.setXY(i, uvA.getX(i) * 0.60 * S, uvA.getY(i) * 0.23 * S);
      })();
      sculptHead(g, S, spec && spec.face);
      g.translate(0, hy, 0);
      headParts.push(g);
      var nose = buildNose(S, spec && spec.face);   /* cheap enough to keep */
      nose.translate(0, hy, 0);
      headParts.push(nose);
    })();
    [1, -1].forEach(function (sd) {                   /* ears */
      var g = new THREE.SphereGeometry(0.028 * S, lod ? 9 : 16, lod ? 7 : 12);
      g.scale(0.36, 1.14, 0.70);
      var ep = g.attributes.position;
      for (var i = 0; i < ep.count; i++) {           /* a fold round the rim */
        var ez = ep.getZ(i);
        if (ez * sd > 0) ep.setZ(i, ez * 0.46);
      }
      g.computeVertexNormals();
      g.rotateY(sd * 0.20);
      g.translate(-0.010 * S, hy + 0.002 * S, sd * 0.079 * S * D.wide);
      headParts.push(g);
    });
    [1, -1].forEach(function (sd) {                   /* eyelids */
      /* the eyeball sits at x 0.0625 with a radius of 0.0135; the lids are
         shells a shade larger, so they close over it rather than clip it */
      var EZ = sd * (0.032 + D.eyeZ) * S, EY = hy + (0.012 + D.eyeY) * S;
      var g = new THREE.SphereGeometry(0.0152 * S, lod ? 10 : 20, lod ? 7 : 15, 0, 6.2832, 0, 0.52);
      g.rotateZ(-0.42);
      g.translate(0.0658 * S, EY + 0.0005 * S, EZ);
      headParts.push(g);
      /* the lower lid, which is what gives an eye a shape rather than a hole */
      var g2 = new THREE.SphereGeometry(0.0149 * S, lod ? 10 : 20, lod ? 7 : 15, 0, 6.2832, 0, 0.40);
      g2.rotateZ(-2.84);
      g2.translate(0.0658 * S, EY + 0.0002 * S, EZ);
      headParts.push(g2);
      /* the fold above the lid, which is what stops an eye looking painted on */
      if (!lod) {
        var g3 = new THREE.TorusGeometry(0.0168 * S, 0.0026 * S, 6, 18, 2.2);
        g3.rotateY(Math.PI / 2); g3.rotateX(-0.30);
        g3.translate(0.0592 * S, EY + 0.0088 * S, EZ);
        headParts.push(g3);
      }
    });
    headParts.forEach(function (g) {
      g.translate(0, -hy, 0); faceTone(g, S); g.translate(0, hy, 0);
      parts.push(rigidSkin(g, HEAD));
    });

    var body = mergeSkinned(parts);
    body.userData.headY = hy;
    return body;
  }

  /* ---- the face, as one mesh with vertex colours ----
     Eyes, irises, brows and a mouth are four different colours and used to
     be four draw calls; they are one now. */
  function buildFaceBits(S, hy, spec) {
    var g = [];
    var D = faceDial(spec.face);
    [1, -1].forEach(function (sd) {
      var ez = sd * (0.032 + D.eyeZ) * S;             /* 64mm between pupils */
      var ey = (0.012 + D.eyeY) * S;
      /* the eyeball, set into the socket the skull was sculpted with */
      var e = new THREE.SphereGeometry(0.0135 * S, 18, 14);
      e.translate(0.0658 * S, hy + ey, ez);
      g.push(colourGeom(e, 0xf6f2ea));
      /* the iris as a shallow dome on the front of it, so it reads as
         looking at something rather than as a bead in a socket */
      var ir = new THREE.SphereGeometry(0.0076 * S, 18, 13);
      ir.scale(0.50, 1, 1);
      ir.translate(0.0768 * S, hy + ey, ez);
      g.push(colourGeom(ir, spec.eyes || 0x2b1d14));
      var pu = new THREE.SphereGeometry(0.0042 * S, 12, 9);
      pu.scale(0.44, 1, 1);
      pu.translate(0.0790 * S, hy + ey, ez);
      g.push(colourGeom(pu, 0x120f12));
      /* the lash line along the upper lid, which is most of what makes an
         eye legible from across a room */
      var la = new THREE.TorusGeometry(0.0148 * S, 0.0026 * S, 6, 22, 2.6);
      la.rotateY(Math.PI / 2);
      la.rotateX(-0.42);
      la.translate(0.0681 * S, hy + ey + 0.0016 * S, ez);
      g.push(colourGeom(la, 0x35262a));
      /* and a brow, sitting on the ridge rather than floating over it */
      var br = new THREE.SphereGeometry(0.0150 * S, 16, 10);
      br.scale(0.17, 0.15, 1.34);
      br.rotateX(sd * 0.16);
      br.rotateZ(-0.16);
      br.translate(0.0872 * S, hy + (0.0442 + D.browY) * S, sd * (0.0328 + D.eyeZ) * S);
      g.push(colourGeom(br, spec.browColour || spec.hair));
      [[0.0128, -0.44], [-0.0140, 0.30]].forEach(function (cn) {
        var c = new THREE.SphereGeometry(0.0034 * S, 8, 6);
        c.scale(0.5, 0.7, 1);
        c.translate(0.0700 * S, hy + ey + cn[1] * 0.010 * S, ez + sd * cn[0] * S);
        g.push(colourGeom(c, 0x8a5f57));
      });
    });
    /* the mouth: an upper lip with a bow in it, a fuller lower lip, and a
       line between the two */
    var lipT = new THREE.SphereGeometry(0.0200 * S, 22, 12);
    lipT.scale(0.22, 0.17 * D.lip, 1.22 * D.mouthW);
    lipT.translate(0.0790 * S, hy + (-0.0592 + D.mouthY) * S, 0);
    (function () {
      var lp = lipT.attributes.position;
      for (var i = 0; i < lp.count; i++) {            /* the cupid's bow */
        var lz = lp.getZ(i);
        lp.setY(i, lp.getY(i) + Math.cos(lz / (0.020 * S) * 3.1) * 0.0016 * S);
      }
      lipT.computeVertexNormals();
    })();
    g.push(colourGeom(lipT, spec.lips || 0x9a6058));
    var lipB = new THREE.SphereGeometry(0.0206 * S, 22, 12);
    lipB.scale(0.25, 0.22 * D.lip, 1.12 * D.mouthW);
    lipB.translate(0.0786 * S, hy + (-0.0742 + D.mouthY) * S, 0);
    g.push(colourGeom(lipB, spec.lips || 0x9a6058));
    var line = new THREE.SphereGeometry(0.0192 * S, 22, 8);
    line.scale(0.15, 0.045, 1.20 * D.mouthW);
    line.translate(0.0808 * S, hy + (-0.0664 + D.mouthY) * S, 0);
    g.push(colourGeom(line, 0x6a4038));
    return mergeGeoms(g);
  }

  /* ---------------- garments ----------------
     A shirt is not the body tinted a different colour: it is a shell that
     stands off the body, hangs below the waist, and ends in a cuff. */
  function buildTop(S, B, depth, kind, lod) {
    var W = function (a, wa, b, wb) {
      return b ? [[BI[a], wa], [BI[b], wb]] : [[BI[a], 1]];
    };
    var parts = [];
    var loose = kind === "tee" ? 0.020 : kind === "jacket" ? 0.030 : 0.024;
    var hem = kind === "tee" ? 0.930 : kind === "jacket" ? 0.880 : 0.905;

    var body = [
      { c: [0, hem * S, 0], ru: (0.116 + loose) * S * depth * B.hip, rv: (0.156 + loose) * S * B.hip, w: W("hips", 0.7, "spine", 0.3) },
      { c: [0, (hem + 0.035) * S, 0], ru: (0.112 + loose) * S * depth * B.hip, rv: (0.152 + loose) * S * B.hip, w: W("hips", 0.5, "spine", 0.5) },
      { c: [0, 0.995 * S, 0], ru: (0.100 + loose) * S * depth * B.waist, rv: (0.136 + loose) * S * B.waist, w: W("spine", 1) },
      { c: [0, 1.090 * S, 0], ru: (0.106 + loose) * S * depth * B.chest, rv: (0.150 + loose) * S * B.chest, w: W("spine", 0.5, "chest", 0.5) },
      { c: [0, 1.180 * S, 0], ru: (0.114 + loose) * S * depth * B.chest, rv: (0.170 + loose) * S * B.chest, w: W("chest", 1) },
      { c: [0, 1.275 * S, 0], ru: (0.112 + loose) * S * depth * B.chest, rv: (0.178 + loose) * S * B.shoulder, w: W("chest", 1) },
      { c: [0, 1.330 * S, 0], ru: (0.104 + loose) * S * depth * B.chest, rv: (0.176 + loose) * S * B.shoulder, w: W("chest", 1) },
      { c: [0, 1.372 * S, 0], ru: (0.090 + loose) * S * depth * B.chest, rv: (0.140 + loose) * S * B.shoulder, w: W("chest", 1) },
      { c: [0, 1.412 * S, 0], ru: 0.068 * S, rv: 0.082 * S, w: W("chest", 0.5, "neck", 0.5) },
      { c: [0, 1.446 * S, 0], ru: 0.056 * S, rv: 0.061 * S, w: W("neck", 1) }
    ];
    /* cloth gathers at a hem and at a waist, and hangs smooth over a chest */
    parts.push(skinnedTube(body, lod ? 14 : 26, true, true, {
      foldN: 9,
      folds: function (y) {
        var yy = y / S;
        return 0.010 + 0.030 * Math.exp(-Math.pow((yy - hem) / 0.075, 2))
                     + 0.016 * Math.exp(-Math.pow((yy - 1.00) / 0.070, 2));
      } }));

    /* sleeves. A short sleeve is a tube that ends in mid-air, and the ring
       it ends on is wider than the arm inside it — that gap is the whole
       reason a t-shirt reads as cloth. */
    var short = kind === "tee" || kind === "shirtShort";
    [["L", 1], ["R", -1]].forEach(function (sd) {
      var s = sd[0], sign = sd[1], z = sign * 0.180 * S * B.shoulder;
      var sleeve = [
        { c: [0, 1.362 * S, z * 0.60], ru: 0.046 * S * B.arm, rv: 0.048 * S * B.arm, w: W("arm" + s, 1) },
        { c: [0, 1.326 * S, z * 0.92], ru: 0.084 * S * B.arm, rv: 0.086 * S * B.arm, w: W("arm" + s, 1) },
        { c: [0, 1.275 * S, z], ru: 0.079 * S * B.arm, rv: 0.081 * S * B.arm, w: W("arm" + s, 1) }
      ];
      if (short) {
        sleeve.push({ c: [0, 1.190 * S, z], ru: 0.073 * S * B.arm, rv: 0.075 * S * B.arm, w: W("arm" + s, 1) });
        sleeve.push({ c: [0, 1.168 * S, z], ru: 0.075 * S * B.arm, rv: 0.077 * S * B.arm, w: W("arm" + s, 1) });
      } else {
        sleeve.push({ c: [0, 1.160 * S, z], ru: 0.066 * S * B.arm, rv: 0.068 * S * B.arm, w: W("arm" + s, 1) });
        sleeve.push({ c: [0, 1.075 * S, z], ru: 0.058 * S * B.arm, rv: 0.060 * S * B.arm, w: W("arm" + s, 0.55, "fore" + s, 0.45) });
        sleeve.push({ c: [0, 0.960 * S, z], ru: 0.054 * S * B.arm, rv: 0.056 * S * B.arm, w: W("fore" + s, 1) });
        sleeve.push({ c: [0, 0.862 * S, z], ru: 0.048 * S * B.arm, rv: 0.050 * S * B.arm, w: W("fore" + s, 1) });
        sleeve.push({ c: [0, 0.845 * S, z], ru: 0.050 * S * B.arm, rv: 0.052 * S * B.arm, w: W("fore" + s, 1) });
      }
      parts.push(skinnedTube(sleeve, lod ? 10 : 18, true, false, {
        foldN: 7,
        folds: function (y) {
          var yy = y / S;
          return 0.012 + 0.030 * Math.exp(-Math.pow((yy - 1.16) / 0.060, 2))
                       + 0.026 * Math.exp(-Math.pow((yy - 1.07) / 0.070, 2));
        } }));
    });
    return mergeSkinned(parts);
  }

  function buildTrousers(S, B, depth, kind, lod) {
    var W = function (a, wa, b, wb, c, wc) {
      if (c) return [[BI[a], wa], [BI[b], wb], [BI[c], wc]];
      return b ? [[BI[a], wa], [BI[b], wb]] : [[BI[a], 1]];
    };
    var parts = [];
    var loose = kind === "joggers" ? 0.015 : kind === "cargo" ? 0.016 : 0.010;
    var cuff = kind === "joggers";

    /* the seat: one shell over both hips */
    var seat = [
      { c: [0, 1.000 * S, 0], ru: (0.100 + loose) * S * depth * B.waist, rv: (0.138 + loose) * S * B.waist, w: W("hips", 1) },
      { c: [0, 0.940 * S, 0], ru: (0.116 + loose) * S * depth * B.hip, rv: (0.164 + loose) * S * B.hip, w: W("hips", 1) },
      { c: [0, 0.880 * S, 0], ru: (0.122 + loose) * S * depth * B.hip, rv: (0.176 + loose) * S * B.hip, w: W("hips", 1) },
      { c: [0, 0.850 * S, 0], ru: (0.120 + loose) * S * depth * B.hip, rv: (0.176 + loose) * S * B.hip, w: W("hips", 1) },
      { c: [0, 0.790 * S, 0], ru: (0.112 + loose) * S * depth * B.hip, rv: (0.172 + loose) * S * B.hip, w: W("hips", 0.6, "thighL", 0.2, "thighR", 0.2) },
      { c: [0, 0.755 * S, 0], ru: (0.100 + loose) * S * depth * B.hip, rv: (0.166 + loose) * S * B.hip, w: W("hips", 0.5, "thighL", 0.25, "thighR", 0.25) }
    ];
    parts.push(skinnedTube(seat, lod ? 14 : 24, true, true, { folds: 0.016, foldN: 9 }));

    [["L", 1], ["R", -1]].forEach(function (sd) {
      var s = sd[0], sign = sd[1], z = sign * 0.095 * S * B.hip;
      var J = jointHeights(B), yk = J.knee, ya = J.ankle;
      var leg = [
        { c: [0, 0.912 * S, z], ru: (0.094 + loose) * S * B.leg, rv: (0.096 + loose) * S * B.leg, w: W("thigh" + s, 1) },
        { c: [0, 0.840 * S, z], ru: (0.093 + loose) * S * B.leg, rv: (0.095 + loose) * S * B.leg, w: W("thigh" + s, 1) },
        { c: [0, 0.760 * S, z], ru: (0.088 + loose) * S * B.leg, rv: (0.090 + loose) * S * B.leg, w: W("thigh" + s, 1) },
        { c: [0, 0.640 * S, z], ru: (0.079 + loose) * S * B.leg, rv: (0.081 + loose) * S * B.leg, w: W("thigh" + s, 1) },
        { c: [0, (yk + 0.050) * S, z], ru: (0.073 + loose) * S * B.leg, rv: (0.075 + loose) * S * B.leg, w: W("thigh" + s, 0.7, "shin" + s, 0.3) },
        { c: [0, yk * S, z], ru: (0.071 + loose) * S * B.leg, rv: (0.073 + loose) * S * B.leg, w: W("thigh" + s, 0.3, "shin" + s, 0.7) },
        { c: [0, (yk - 0.110) * S, z], ru: (0.068 + loose) * S * B.leg, rv: (0.070 + loose) * S * B.leg, w: W("shin" + s, 1) },
        { c: [0, (ya + 0.140) * S, z], ru: (0.059 + loose) * S * B.leg, rv: (0.061 + loose) * S * B.leg, w: W("shin" + s, 1) }
      ];
      if (cuff) {
        /* the elastic: the leg gathers in, then a short straight band */
        leg.push({ c: [0, (ya + 0.095) * S, z], ru: 0.057 * S * B.leg, rv: 0.059 * S * B.leg, w: W("shin" + s, 1) });
        leg.push({ c: [0, (ya + 0.070) * S, z], ru: 0.046 * S * B.leg, rv: 0.048 * S * B.leg, w: W("shin" + s, 1) });
        leg.push({ c: [0, (ya + 0.020) * S, z], ru: 0.045 * S * B.leg, rv: 0.047 * S * B.leg, w: W("shin" + s, 0.6, "foot" + s, 0.4) });
      } else {
        leg.push({ c: [0, (ya + 0.055) * S, z], ru: (0.058 + loose) * S * B.leg, rv: (0.060 + loose) * S * B.leg, w: W("shin" + s, 1) });
        leg.push({ c: [0, (ya + 0.010) * S, z], ru: (0.056 + loose) * S * B.leg, rv: (0.058 + loose) * S * B.leg, w: W("shin" + s, 0.7, "foot" + s, 0.3) });
      }
      parts.push(skinnedTube(leg, lod ? 12 : 20, true, false, {
        foldN: 8,
        folds: function (y) {
          var yy = y / S;
          /* it bunches behind the knee and again on the cuff */
          return 0.010 + 0.026 * Math.exp(-Math.pow((yy - yk) / 0.075, 2))
                       + 0.030 * Math.exp(-Math.pow((yy - (ya + 0.10)) / 0.085, 2));
        } }));
    });
    return mergeSkinned(parts);
  }

  /* ---- shoes ----
     A sole, a toe box and an ankle collar, swept along the foot rather than
     stacked as boxes. Rigid to the foot bone, so it is one mesh a side. */
  function buildShoe(S, B, kind) {
    var ankle = jointHeights(B).ankle;
    var rings = [], base = [
      [-0.075, 0.048, 0.036, 0.052],
      [-0.045, 0.062, 0.042, 0.056],
      [ 0.000, 0.068, 0.045, 0.058],
      [ 0.055, 0.062, 0.045, 0.056],
      [ 0.110, 0.052, 0.043, 0.050],
      [ 0.155, 0.040, 0.038, 0.042],
      [ 0.185, 0.024, 0.028, 0.030],
      [ 0.198, 0.010, 0.016, 0.016]
    ];
    base.forEach(function (b) {
      rings.push({
        c: [b[0] * S, (0.044 + b[1] * 0.0) * S, 0],
        u: [0, 1, 0], v: [0, 0, 1],
        ru: b[2] * S, rv: b[3] * S,
        w: [[0, 1]]
      });
    });
    var g1 = skinnedTube(rings, 14, true, true);
    /* the sole: a flat slab under it, which is what gives a shoe its line */
    var sole = roundBox(0.30 * S, 0.030 * S, 0.108 * S, 0.012 * S, 2);
    sole.translate(0.055 * S, 0.016 * S, 0);
    /* the collar round the ankle */
    var collar = new THREE.CylinderGeometry(0.052 * S, 0.056 * S, 0.05 * S, 14);
    collar.translate(-0.010 * S, 0.086 * S, 0);
    var parts = [g1, rigidSkin(sole, 0), rigidSkin(collar, 0)];
    if (kind === "boot") {
      var shaft = new THREE.CylinderGeometry(0.056 * S, 0.058 * S, 0.14 * S, 14);
      shaft.translate(-0.010 * S, 0.145 * S, 0);
      parts.push(rigidSkin(shaft, 0));
    }
    var g = mergeSkinned(parts);
    /* authored with the sole on the floor, then dropped so it hangs off
       the ankle joint rather than floating near it */
    g.translate(0, -ankle * S, 0);
    return g;
  }

  /* ---------------- hair ----------------
     Rigid to the head bone, so it is one mesh however many locks are in it. */
  function buildHairGeom(style, S, spec) {
    var g = [], hy = 1.600 * S, lod = !!(spec && spec.lod);
    if (style === "bald") return null;

    /* ---- the scalp ----
       Every style starts from the same thing: a shell lofted over the
       skull down to an explicit hairline, so the hair stops where hair
       stops rather than wherever a sphere happened to be cut. rimFn gives
       the height of that hairline for an angle round the head, 0 being
       straight ahead. */
    function scalp(Rx, Ry, Rz, AX, rimFn, dip, dipAt) {
      var CA = lod ? 18 : 48, CJ = lod ? 6 : 16, pos = [], uv = [], idx = [];
      for (var j = 0; j <= CJ; j++) {
        for (var i = 0; i <= CA; i++) {
          var a = i / CA * 6.2832, v = j / CJ;
          var th = v * Math.acos(clamp(rimFn(a) / Ry, -1, 1));
          var sw = 1 + Math.sin(a * 5 + 0.6) * 0.022 + Math.sin(a * 2) * 0.014;
          var st = Math.sin(th), y = Ry * Math.cos(th);
          if (dip) {
            var d1 = (a - dipAt) / 0.26, d2 = (a - dipAt + 6.2832) / 0.26;
            var d = Math.min(Math.abs(d1), Math.abs(d2));
            y -= Math.exp(-d * d) * Math.sin(Math.PI * Math.min(1, v * 1.15)) * dip;
          }
          pos.push(AX + Rx * st * Math.cos(a) * sw, y, Rz * st * Math.sin(a) * sw);
          uv.push(i / CA * 3.4, v * 1.5);
        }
      }
      for (var j2 = 0; j2 < CJ; j2++) {
        for (var i2 = 0; i2 < CA; i2++) {
          var p0 = j2 * (CA + 1) + i2, p1 = p0 + CA + 1;
          idx.push(p0, p0 + 1, p1, p1, p0 + 1, p1 + 1);
        }
      }
      var gg = new THREE.BufferGeometry();
      gg.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
      gg.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
      gg.setIndex(idx);
      gg.computeVertexNormals();
      gg.translate(0, hy, 0);
      return gg;
    }
    /* a plain crop, used by every style that is not the long wavy one */
    function cap(lift, drop) {
      return scalp(0.108 * S, 0.124 * S, 0.098 * S, -0.008 * S,
        function (a) { return (drop + lift * Math.cos(a)) * S; }, 0.008 * S, 0.30);
    }

    if (style === "longWavy") {
      /* ---- long, wavy, blonde ----
         Built as one continuous surface rather than a pile of spheres:
         a scalp lofted down to an explicit hairline, and a curtain that
         hangs from that same hairline with real thickness, flare and
         wave. Because the curtain's top ring IS the scalp's rim ring
         there is no seam between them, and because the curtain is a
         shell — an outer face, an inner face, and edges stitching the
         two — it has depth from behind and at the parting instead of
         reading as a decal. Locks are laid over the top to break the
         silhouette and give the strands a direction to run in. */
      var Rx = 0.111 * S, Ry = 0.127 * S, Rz = 0.101 * S;
      var AX = -0.008 * S;              /* the axis the mass hangs around */
      var PART = 0.34;                  /* the parting, off centre */

      /* where the hair stops on the skull: high over the brow, level
         with the top of the ear at the sides, low at the nape */
      function rimY(a) { return (0.012 + 0.068 * Math.cos(a)) * S; }
      function rimTheta(a) { return Math.acos(clamp(rimY(a) / Ry, -1, 1)); }
      /* the scalp lifts either side of the parting and dips along it */

      g.push(scalp(Rx, Ry, Rz, AX, rimY, 0.010 * S, PART));

      /* ---- the length: overlapping tresses, not one curtain ----
             A single sheet reads as cardboard however it is waved, because
             its edges are straight lines. Fourteen tresses, each with its
             own span, length, wave and stand-off, overlap into a mass
             whose edge is never a clean curve — and each one pinches to
             nothing at its sides and its tip, so no tress shows a seam. */
      var A0 = 1.30, A1 = 6.2832 - 1.30;
      function fall(a, u, len, amp, ph, lift) {
        var th = rimTheta(a);
        var sw = 1 + Math.sin(a * 5 + 0.6) * 0.022 + Math.sin(a * 2) * 0.014;
        var r0 = Math.hypot(Rx * Math.cos(a), Rz * Math.sin(a)) * Math.sin(th) * sw;
        /* it swells below the ear, then gathers back in at the tips */
        var rad = r0 * (1 + 0.40 * Math.sin(Math.PI * u * 0.82)) * (1 - 0.34 * u * u * u);
        rad += amp * Math.sin(u * 8.2 + ph)
             + amp * 0.55 * Math.sin(u * 3.4 + ph * 1.7)
             + amp * 0.40 * Math.sin(a * 9.0 + u * 5.0 + ph);
        rad *= 1 + (lift - 1) * Math.min(1, u * 3.2);
        var y = rimY(a) - u * len + Math.sin(u * 3.1 + ph) * 0.009 * S;
        var dx = Math.cos(a), dz = Math.sin(a);
        var drift = u * u * u * 0.045 * S * Math.sin(ph * 2.3);
        /* below the neck the back of it comes forward to lie on her rather
           than hang in the air behind her */
        var lean = Math.max(0, -dx) * rad * 0.36 * u * u;
        return [AX + dx * rad + lean, y,
                dz * rad + drift * Math.sign(dz || 1), dx, dz];
      }
      (function () {
        var N = lod ? 7 : 20, CA = lod ? 5 : 11, CJ = lod ? 7 : 20;
        for (var k = 0; k < N; k++) {
          var ac = A0 + (A1 - A0) * ((k + 0.5) / N) + (hash2(k, 2) - 0.5) * 0.14;
          var hw = 0.20 + hash2(k, 5) * 0.13;
          var len = (0.42 + hash2(k, 7) * 0.44) * S;
          var amp = (0.011 + hash2(k, 11) * 0.015) * S;
          var ph = hash2(k, 13) * 6.2832;
          var lift = 1 + (k % 3) * 0.040 + hash2(k, 17) * 0.020;
          var wide = (0.017 + hash2(k, 19) * 0.009) * S;
          var pos = [], uv = [], idx = [];
          var stride = (CA + 1) * (CJ + 1);
          for (var side = 0; side < 2; side++) {
            var sgn = side ? -1 : 1;
            for (var j = 0; j <= CJ; j++) {
              for (var i = 0; i <= CA; i++) {
                var e = Math.sin(Math.PI * (i / CA));
                var u = j / CJ;
                var a = ac + (i / CA - 0.5) * 2 * hw * (1 - 0.42 * u * u);
                var f = fall(a, u, len, amp, ph, lift);
                var ht = wide * (0.30 + 0.70 * Math.pow(e, 0.55)) * (1 - 0.72 * u * u);
                pos.push(f[0] + f[3] * ht * sgn, f[1], f[2] + f[4] * ht * sgn);
                uv.push(i / CA * 0.34, u * 4.6);
              }
            }
          }
          for (var s2 = 0; s2 < 2; s2++) {
            var base = s2 * stride;
            for (var j3 = 0; j3 < CJ; j3++) {
              for (var i3 = 0; i3 < CA; i3++) {
                var q0 = base + j3 * (CA + 1) + i3, q1 = q0 + CA + 1;
                if (s2 === 0) idx.push(q0, q0 + 1, q1, q1, q0 + 1, q1 + 1);
                else idx.push(q0, q1, q0 + 1, q1, q1 + 1, q0 + 1);
              }
            }
          }
          /* close the tress along its two sides and across its tip */
          for (var j4 = 0; j4 < CJ; j4++) {
            var oa = j4 * (CA + 1), ob = oa + CA + 1;
            idx.push(oa, stride + oa, ob, ob, stride + oa, stride + ob);
            var pa = oa + CA, pb = ob + CA;
            idx.push(pa, pb, stride + pa, pb, stride + pb, stride + pa);
          }
          for (var i5 = 0; i5 < CA; i5++) {
            var t0 = CJ * (CA + 1) + i5;
            idx.push(t0, t0 + 1, stride + t0, t0 + 1, stride + t0 + 1, stride + t0);
          }
          var gg = new THREE.BufferGeometry();
          gg.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
          gg.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
          gg.setIndex(idx);
          gg.computeVertexNormals();
          gg.translate(0, hy, 0);
          g.push(gg);
        }
      })();

      /* ---- locks laid over the tresses, to catch the light along their
             length and keep the outer edge broken ---- */
      var NL = lod ? 5 : 22;
      for (var L = 0; L < NL; L++) {
        var la = A0 + (A1 - A0) * ((L + 0.5) / NL) + (hash2(L, 3) - 0.5) * 0.12;
        var llen = (0.44 + hash2(L, 23) * 0.34) * S;
        var lamp = (0.012 + hash2(L, 29) * 0.014) * S;
        var lph = hash2(L, 31) * 6.2832;
        var pts = [];
        for (var kk = 0; kk <= 6; kk++) {
          var f2 = fall(la, kk / 6, llen, lamp, lph, 1.075);
          pts.push(new THREE.Vector3(f2[0], hy + f2[1], f2[2]));
        }
        var th2 = (0.016 + hash2(L, 13) * 0.011) * S;
        g.push(sweep(pts, th2, th2 * 0.25, lod ? 5 : 7, 0.4, lod ? 8 : 0));
      }

      /* ---- the fringe: sweeps out of the parting across the forehead ---- */
      for (var f3 = 0; f3 < (lod ? 4 : 9); f3++) {
        var fs = f3 < 5 ? 1 : -1;               /* the long side and the short */
        var fp = [];
        for (var fk = 0; fk <= 7; fk++) {
          var fu = fk / 7, ea = fu * fu * (3 - 2 * fu);
          var fa = PART * fs + fs * ea * (fs > 0 ? 1.24 : 0.84)
                   + (f3 % 5) * 0.05 * fs;
          var th3 = rimTheta(Math.abs(fa)) * (0.80 + ea * 0.26 + (f3 % 5) * 0.045);
          var st3 = Math.sin(th3);
          /* it sat proud of the scalp and crossed it with a visible seam;
             laid on it, it is a fringe rather than a bar */
          fp.push(new THREE.Vector3(
            AX + Rx * st3 * Math.cos(fa) * 1.004,
            hy + Ry * Math.cos(th3) - ea * 0.026 * S,
            Rz * st3 * Math.sin(fa) * 1.004));
        }
        g.push(sweep(fp, 0.017 * S, 0.009 * S, lod ? 5 : 9, 0.25, lod ? 8 : 0));
      }
    } else if (style === "afro") {
      /* it was a whole sphere centred on the head, which meant it covered
         the face. It is a scalp like every other style, just a much
         bigger one, clumped so it is hair and not a ball. */
      var af = scalp(0.148 * S, 0.156 * S, 0.138 * S, -0.014 * S,
        function (a) { return (0.008 + 0.064 * Math.cos(a)) * S; }, 0, 0);
      var pa = af.attributes.position;
      for (var q = 0; q < pa.count; q++) {
        var qx = pa.getX(q), qy = pa.getY(q) - hy, qz = pa.getZ(q);
        var b2 = 1 + Math.sin(qx * 52) * Math.sin(qy * 47) * Math.sin(qz * 49) * 0.105;
        pa.setXYZ(q, qx * b2, hy + qy * b2, qz * b2);
      }
      af.computeVertexNormals();
      g.push(af);
    } else if (style === "bun") {
      g.push(cap(0.058, 0.022));
      var bun = new THREE.SphereGeometry(0.052 * S, 18, 14);
      bun.scale(1.0, 0.92, 1.0);
      bun.translate(-0.106 * S, hy + 0.040 * S, 0);
      g.push(bun);
    } else if (style === "long") {
      g.push(cap(0.058, 0.022));
      var N3 = lod ? 7 : 24;
      for (var i3 = 0; i3 < N3; i3++) {
        var a3 = 1.46 + (6.2832 - 2.92) * (i3 + 0.5) / N3;
        var pts3 = [], ln3 = (0.24 + hash2(i3, 3) * 0.14) * S;
        for (var k3 = 0; k3 <= 6; k3++) {
          var u3 = k3 / 6;
          pts3.push(new THREE.Vector3(
            -0.008 * S + Math.cos(a3) * (0.100 + u3 * 0.016) * S - u3 * u3 * 0.020 * S,
            hy + (0.022 + 0.058 * Math.cos(a3)) * S - u3 * ln3,
            Math.sin(a3) * (0.094 + u3 * 0.016) * S));
        }
        var w3 = (0.014 + hash2(i3, 7) * 0.009) * S;
        g.push(sweep(pts3, w3, w3 * 0.45, lod ? 5 : 8, 0.2, lod ? 8 : 0));
      }
    } else {
      /* short: a crop that follows the skull with a hairline at the front */
      g.push(cap(0.058, 0.020));
    }
    if (spec && spec.beard) g.push(buildBeard(S, hy, spec));
    return mergeGeoms(g);
  }

  /* ---- skin tone ----
     One flat colour over a whole body is the thing that reads as plastic.
     Real skin is warmer where it is thin and blood is close — the cheeks,
     the nose, the ears — cooler across the forehead, and darker in the eye
     sockets and under the jaw. A few gaussians of vertex colour, costing
     one attribute and no draw calls. */
  function faceTone(g, S) {
    var pos = g.attributes.position, n = pos.count;
    var col = new Float32Array(n * 3);
    /* [x, y, z, rx, ry, rz, r, g, b] — z non-zero is mirrored */
    var T = [
      [ 0.050, -0.014, 0.052, 0.040, 0.034, 0.030,  0.055, -0.022, -0.030],
      [ 0.096, -0.026, 0.000, 0.026, 0.024, 0.020,  0.050, -0.020, -0.026],
      [-0.010,  0.002, 0.078, 0.026, 0.036, 0.026,  0.060, -0.026, -0.030],
      [ 0.060,  0.070, 0.000, 0.060, 0.036, 0.060, -0.014,  0.000,  0.016],
      [ 0.074,  0.012, 0.032, 0.030, 0.024, 0.026, -0.070, -0.062, -0.052],
      [ 0.040, -0.096, 0.020, 0.048, 0.024, 0.040, -0.048, -0.044, -0.040],
      [-0.020, -0.100, 0.000, 0.070, 0.030, 0.060, -0.070, -0.064, -0.058]
    ];
    for (var i = 0; i < n; i++) {
      var x = pos.getX(i) / S, y = pos.getY(i) / S, z = pos.getZ(i) / S;
      var r = 1, gg = 1, b = 1;
      for (var t = 0; t < T.length; t++) {
        var a = T[t], zs = a[2] === 0 ? [0] : [a[2], -a[2]];
        for (var s = 0; s < zs.length; s++) {
          var qx = (x - a[0]) / a[3], qy = (y - a[1]) / a[4], qz = (z - zs[s]) / a[5];
          var w = Math.exp(-(qx * qx + qy * qy + qz * qz));
          r += a[6] * w; gg += a[7] * w; b += a[8] * w;
        }
      }
      col[i * 3] = r; col[i * 3 + 1] = gg; col[i * 3 + 2] = b;
    }
    g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
    return g;
  }

  /* ---- a beard ----
     Taking the skull's own surface, keeping the triangles that fall in the
     jaw and the moustache, and pushing them out a few millimetres. A beard
     built any other way sits on the face like a mask, because it is not
     the shape of that face. */
  function buildBeard(S, hy, spec) {
    var g = new THREE.SphereGeometry(0.100 * S, 40, 30);
    g.scale(1.00, 1.15, 0.86);
    sculptHead(g, S, spec && spec.face);
    var pos = g.attributes.position, nor = g.attributes.normal;
    var keep = [], full = (spec && spec.fullBeard) ? 0.014 : 0;
    for (var i = 0; i < pos.count; i++) {
      var x = pos.getX(i) / S, y = pos.getY(i) / S, z = pos.getZ(i) / S;
      /* the line it grows to: high by the ear, low under the lip */
      var line = -0.008 - 0.062 * clamp(x / 0.090, 0, 1) + full;
      var jaw = x > -0.034 && y < line;
      /* and the moustache, which stops clear of the mouth */
      var tache = x > 0.058 && y < -0.032 && y > -0.052 && Math.abs(z) < 0.030;
      keep.push(jaw || tache);
    }
    var src = g.index.array, idx = [];
    for (var t = 0; t < src.length; t += 3) {
      if (keep[src[t]] && keep[src[t + 1]] && keep[src[t + 2]])
        idx.push(src[t], src[t + 1], src[t + 2]);
    }
    for (var v = 0; v < pos.count; v++) {
      if (!keep[v]) continue;
      var d = 0.0065 * S;
      pos.setXYZ(v, pos.getX(v) + nor.getX(v) * d,
                    pos.getY(v) + nor.getY(v) * d,
                    pos.getZ(v) + nor.getZ(v) * d);
    }
    g.setIndex(idx);
    g.computeVertexNormals();
    g.translate(0, hy, 0);
    return g;
  }

  /* ---- wear and tear ----
     Two things clothes do when nobody has washed or mended them for weeks:
     they tear, and they stain. Both are done to the geometry after the
     fact so that the same shirt can be worn by a living person and by
     something that used to be one. */
  function tatter(g, seed, holes) {
    if (!g.index) return g;
    var pos = g.attributes.position, src = g.index.array, keep = [];
    /* seeded from real vertices: a hole in the middle of the body volume
       removes nothing, because there is nothing in there */
    var sp = [];
    for (var k = 0; k < holes; k++) {
      var vi = Math.floor(hash2(seed * 13 + k, 7) * pos.count) % pos.count;
      sp.push([pos.getX(vi), pos.getY(vi), pos.getZ(vi),
               (0.026 + hash2(seed + k, 17) * 0.040)]);
    }
    for (var i = 0; i < src.length; i += 3) {
      var cx = 0, cy = 0, cz = 0;
      for (var v = 0; v < 3; v++) {
        cx += pos.getX(src[i + v]); cy += pos.getY(src[i + v]); cz += pos.getZ(src[i + v]);
      }
      cx /= 3; cy /= 3; cz /= 3;
      var gone = false;
      for (var h2 = 0; h2 < sp.length; h2++) {
        var s2 = sp[h2];
        if (Math.hypot(cx - s2[0], cy - s2[1], cz - s2[2]) < s2[3]) { gone = true; break; }
      }
      if (!gone) keep.push(src[i], src[i + 1], src[i + 2]);
    }
    g.setIndex(keep);
    return g;
  }

  /* patches of grime and worse, as vertex colours */
  function soil(g, seed, blobs, tints, size) {
    var pos = g.attributes.position, n = pos.count;
    var col = new Float32Array(n * 3);
    var sp = [];
    for (var k = 0; k < blobs; k++) {
      var tint = tints[Math.floor(hash2(seed + k, 23) * tints.length) % tints.length];
      var vi = Math.floor(hash2(seed * 7 + k, 5) * n) % n;
      sp.push([pos.getX(vi), pos.getY(vi), pos.getZ(vi),
               (size || 0.09) * (0.5 + hash2(seed + k, 29)),
               new THREE.Color(tint)]);
    }
    var c = new THREE.Color();
    for (var i = 0; i < n; i++) {
      c.setRGB(1, 1, 1);
      var x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      for (var b = 0; b < sp.length; b++) {
        var s2 = sp[b];
        var d = Math.hypot(x - s2[0], y - s2[1], z - s2[2]) / s2[3];
        if (d < 2.4) c.lerp(s2[4], Math.exp(-d * d) * 0.70);
      }
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    }
    g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
    return g;
  }

  /* ---------------- assembly ---------------- */
  function buildHuman(spec) {
    var S = spec.scale || 1;
    var B = BUILD[spec.build || "average"];
    var depth = spec.depth || 0.74;

    var sk = makeSkeleton(S, B.legLen, B.armLen);
    var bn = sk.byName;

    var root = new THREE.Group();
    var body = new THREE.Group();          /* everything that bobs */
    root.add(body);
    body.add(sk.root);

    /* the rest pose has to be real before the skeleton is made from it */
    root.updateMatrixWorld(true);
    var skeleton = new THREE.Skeleton(sk.list);

    var meshes = [];
    function add(geom, mat) {
      var m = new THREE.SkinnedMesh(geom, mat);
      m.castShadow = true;
      m.receiveShadow = false;
      m.frustumCulled = false;
      body.add(m);
      m.updateMatrixWorld(true);
      m.bind(skeleton, m.matrixWorld);
      meshes.push(m);
      return m;
    }

    var skin = spec.skinMat || skinMat(spec.skin);
    skin.vertexColors = true;              /* the head carries its own tone */
    add(buildBody(S, B, depth, spec), skin);

    var topKind = spec.topKind || "tee";
    var topMat = spec.topMat || clothMat(spec.top, 0.90, spec.weave);
    add(buildTop(S, B, depth, topKind, spec.lod), topMat);

    if (spec.jacket) {
      var jm = spec.jacketMat || clothMat(spec.jacket, 0.84, spec.jacketWeave);
      add(buildTop(S, B, depth, "jacket", spec.lod), jm);
    }

    var legKind = spec.legKind || "jeans";
    var legMat = spec.legMat || clothMat(spec.trousers, 0.92, spec.legWeave || "denim");
    add(buildTrousers(S, B, depth, legKind, spec.lod), legMat);

    /* The face and the hair are authored in figure space, around the skull
       at y = 1.6, but they hang off the head bone — and that bone sits at
       the top of the neck, a good 7cm lower. Subtracting a hard-coded 1.6
       put both of them down on the jaw. Walk the chain and subtract where
       the bone actually is. */
    var headY = (function () {
      var y = 0, b = bn.head;
      while (b && b.isBone) { y += b.position.y; b = b.parent; }
      return y;
    })();

    /* the face, one mesh with the colours baked into the vertices */
    var faceMat = new THREE.MeshStandardMaterial({
      vertexColors: true, roughness: 0.42, metalness: 0.0, envMapIntensity: 0.9 });
    var face = new THREE.Mesh(buildFaceBits(S, 1.600 * S, spec), faceMat);
    face.position.y = -headY;
    bn.head.add(face);

    /* hair rides the head bone */
    var hairGeom = buildHairGeom(spec.hairStyle, S, spec);
    if (hairGeom) {
      var hair = new THREE.Mesh(hairGeom, hairMat(spec.hair, spec.hairRough));
      hair.position.y = -headY;
      hair.castShadow = true;
      bn.head.add(hair);
    }

    /* shoes ride the foot bones */
    var shoeMat = spec.shoeMat || leatherMat(spec.shoe || 0x241d18);
    var shoeGeom = buildShoe(S, B, spec.boots ? "boot" : "shoe");
    [["L", 1], ["R", -1]].forEach(function (sd) {
      var m = new THREE.Mesh(shoeGeom.clone(), shoeMat);
      m.castShadow = true;
      bn["foot" + sd[0]].add(m);
    });

    if (spec.helmet) {
      var hel = new THREE.Mesh(
        (function () {
          var g = new THREE.SphereGeometry(0.136 * S, 20, 15, 0, 6.2832, 0, 1.36);
          g.scale(1, 0.94, 1); return g;
        })(),
        new THREE.MeshStandardMaterial({ color: spec.helmet, roughness: 0.36, metalness: 0.18, envMapIntensity: 1.4 }));
      hel.position.y = 0.012 * S; hel.castShadow = true;
      bn.head.add(hel);
      var peak = new THREE.Mesh(roundBox(0.11 * S, 0.018 * S, 0.19 * S, 0.008 * S, 2),
        new THREE.MeshStandardMaterial({ color: spec.helmet, roughness: 0.36, metalness: 0.18 }));
      peak.position.set(0.108 * S, -0.024 * S, 0);
      peak.rotation.z = 0.10;
      bn.head.add(peak);
    }
    if (spec.mask) {
      var mask = new THREE.Mesh(
        (function () { var g = new THREE.SphereGeometry(0.088 * S, 14, 11, 0, 3.2, 0.6, 1.5); g.rotateY(-1.6); return g; })(),
        new THREE.MeshStandardMaterial({ color: spec.mask, roughness: 0.86, metalness: 0 }));
      mask.position.set(0.024 * S, -0.030 * S, 0);
      bn.head.add(mask);
    }
    if (spec.glasses) {
      var gm = new THREE.MeshStandardMaterial({ color: 0x2a2a2e, roughness: 0.3, metalness: 0.5, envMapIntensity: 1.6 });
      [1, -1].forEach(function (sd) {
        var rim = new THREE.Mesh(new THREE.TorusGeometry(0.028 * S, 0.0045 * S, 6, 16), gm);
        rim.position.set(0.092 * S, 0.010 * S, sd * 0.040 * S);
        rim.rotation.y = Math.PI / 2;
        bn.head.add(rim);
        var arm2 = new THREE.Mesh(new THREE.BoxGeometry(0.09 * S, 0.005 * S, 0.005 * S), gm);
        arm2.position.set(0.046 * S, 0.014 * S, sd * 0.062 * S);
        bn.head.add(arm2);
      });
      var bridge = new THREE.Mesh(new THREE.BoxGeometry(0.005 * S, 0.005 * S, 0.028 * S), gm);
      bridge.position.set(0.096 * S, 0.014 * S, 0);
      bn.head.add(bridge);
    }

    var contact = contactShadow(1.15 * S);
    root.add(contact);

    /* The old rig exposed groups by these names and the whole game poses
       through them, so the bones answer to the same ones. */
    var rig = {
      root: root, body: body, contact: contact,
      bones: bn, skeleton: skeleton, meshes: meshes,
      pelvis: bn.hips, spine: bn.spine, chest: bn.chest, neck: bn.neck, head: bn.head,
      armL: { shoulder: bn.clavL, upper: bn.armL, elbow: bn.foreL, lower: bn.foreL, hand: bn.handL },
      armR: { shoulder: bn.clavR, upper: bn.armR, elbow: bn.foreR, lower: bn.foreR, hand: bn.handR },
      legL: { hip: bn.hipL, upper: bn.thighL, knee: bn.shinL, lower: bn.shinL, foot: bn.footL },
      legR: { hip: bn.hipR, upper: bn.thighR, knee: bn.shinR, lower: bn.shinR, foot: bn.footR },
      hipY: 0.88 * S, S: S, spec: spec, phase: Math.random() * 6.28, blink: 0
    };
    /* Everything a body is made of gets drawn again from every light that
       casts a shadow. Across a car park that shadow is four pixels wide,
       so past a certain distance it stops paying for itself. */
    var casters = [];
    root.traverse(function (o) { if (o.isMesh || o.isSkinnedMesh) casters.push(o); });
    rig.shadowOn = true;
    rig.setShadow = function (on) {
      if (on === rig.shadowOn) return;
      rig.shadowOn = on;
      for (var ci = 0; ci < casters.length; ci++) casters[ci].castShadow = on;
    };

    /* a skinned mesh's bounds do not follow its pose, so give it one that
       covers anything the animation can do */
    var sphere = new THREE.Sphere(new THREE.Vector3(0, 0.9 * S, 0), 1.5 * S);
    meshes.forEach(function (m) { m.geometry.boundingSphere = sphere.clone(); });
    return rig;
  }

  /* ---------------- the walk ----------------
     The same joints as before, driving bones now, so a knee bends the mesh
     around it instead of sliding one cylinder past another. */
  var EMPTY = {};
  function poseHuman(rig, t, gait, style, extra) {
    var S = rig.S, p = rig.phase, b = rig.bones;
    var w = t * (style === "z" ? 4.4 : 8.2) + p;
    var g = clamp(gait, 0, 1);
    var swing = (style === "z" ? 0.42 : 0.66) * g;
    var e = extra || {};

    /* the jerk: they do not move continuously, they arrive at poses */
    var jt = style === "z" ? Math.floor(w * 3.0) / 3.0 + Math.sin(w * 11.0) * 0.03 : w;
    var s1 = Math.sin(jt), c1 = Math.cos(jt), s2 = Math.sin(jt * 2);

    b.hipL.rotation.set(0, 0, 0);
    b.hipR.rotation.set(0, 0, 0);
    b.thighL.rotation.set(0, 0,  s1 * swing);
    b.thighR.rotation.set(0, 0, -s1 * swing);
    b.shinL.rotation.z = -(Math.max(0, -c1) * 0.95 * g + 0.04);
    b.shinR.rotation.z = -(Math.max(0,  c1) * 0.95 * g + 0.04);
    /* the ankle keeps the foot flat instead of pointing it at the floor */
    b.footL.rotation.z = -b.thighL.rotation.z - b.shinL.rotation.z * 0.55;
    b.footR.rotation.z = -b.thighR.rotation.z - b.shinR.rotation.z * 0.55;

    if (style === "z") {
      b.thighR.rotation.z *= 0.35;
      b.shinR.rotation.z = -0.34;
      b.hipR.rotation.x = 0.16;
      b.armL.rotation.set(-0.30, 0, -1.05 + s1 * 0.18);
      b.armR.rotation.set( 0.36, 0, -0.86 - s1 * 0.14);
      b.foreL.rotation.z = -0.78;
      b.foreR.rotation.z = -0.98;
      b.clavL.rotation.z = -0.10;
      b.clavR.rotation.z = -0.06;
      var T = rig.tilt || EMPTY;
      b.spine.rotation.set(0.10 + (T.sx || 0), 0, 0.30 + s2 * 0.04 + (T.sz || 0));
      b.chest.rotation.set(0, 0, 0.10);
      b.neck.rotation.set(0.26 + Math.sin(w * 0.7) * 0.08, 0, -0.44 + (T.nz || 0));
      b.head.rotation.set(T.hx || 0, Math.sin(w * 0.5) * 0.12, -0.10 + (T.hz || 0));
      rig.body.position.y = Math.abs(s1) * 0.030 * S * g - 0.045 * S;
      return;
    }

    var crouch = e.crouch || 0;
    b.armL.rotation.set( 0.06 + crouch * 0.20, 0, -s1 * swing * 0.68 - crouch * 0.28);
    b.armR.rotation.set(-0.06 - crouch * 0.20, 0,  s1 * swing * 0.68 - crouch * 0.28);
    b.foreL.rotation.z = -0.20 - Math.max(0,  s1) * 0.36 * g - crouch * 0.85;
    b.foreR.rotation.z = -0.20 - Math.max(0, -s1) * 0.36 * g - crouch * 0.85;
    /* the arm hangs a little away from the body, or it clips the ribs */
    b.clavL.rotation.x = -0.10 - crouch * 0.06;
    b.clavR.rotation.x =  0.10 + crouch * 0.06;
    b.clavL.rotation.z = b.clavR.rotation.z = 0;

    b.spine.rotation.set(-s2 * 0.026 * g, s1 * 0.055 * g, 0.045 * g + crouch * 0.20 + (e.lean || 0));
    b.chest.rotation.set(0, -s1 * 0.075 * g, crouch * 0.12);
    b.neck.rotation.set(e.headX || 0, 0, -0.03 - crouch * 0.14 + (e.headZ || 0));
    b.head.rotation.set(0, 0, 0);

    b.hips.rotation.set(0, -s1 * 0.075 * g, 0);

    rig.body.position.y = Math.abs(s1) * 0.032 * S * g
                        + (1 - g) * Math.sin(t * 1.5 + p) * 0.007 * S
                        - crouch * 0.19 * S;
  }

  /* sitting astride something */
  function poseRide(rig, t, bounce, front) {
    var b = rig.bones;
    var s1 = Math.sin(t * 6.4 + (front ? 0 : 0.5));
    /* thigh forward and out over the barrel, knee bent back so the calf
       hangs down its side, heel down: a seat, not a chair */
    [["L", 1], ["R", -1]].forEach(function (sd) {
      var s = sd[0], side = sd[1];
      b["hip" + s].rotation.x = side * 0.62;
      b["thigh" + s].rotation.set(0, 0, 0.78 + s1 * 0.03);
      b["shin" + s].rotation.z = -1.24;
      b["foot" + s].rotation.z = -0.10;
    });
    b.spine.rotation.set(0, 0, (front ? 0.14 : 0.26) + s1 * 0.035);
    b.chest.rotation.set(0, 0, 0);
    b.neck.rotation.set(0, 0, -0.06);
    if (front) {
      b.armL.rotation.set( 0.18, 0, -0.62); b.armR.rotation.set(-0.18, 0, -0.62);
      b.foreL.rotation.z = -0.34; b.foreR.rotation.z = -0.34;
    } else {
      /* he has both hands on the strap in front of him, which is what you
         do when you have never been on one of these before */
      b.armL.rotation.set( 0.26, 0, -0.12); b.armR.rotation.set(-0.26, 0, -0.12);
      b.foreL.rotation.z = -1.62; b.foreR.rotation.z = -1.62;
    }
    rig.body.position.y = bounce;
  }

  /* ---------------- the cast ---------------- */

  function makeOuissy() {
    var r = buildHuman({
      scale: 1.0, build: "slim", depth: 0.72,
      skin: 0xf2d8c2, skinMat: skinMat(0xf3dac6, 0.66),
      eyes: 0x4a6a86, lips: 0xb47a72,
      face: { wide: 0.94, long: 1.00, jaw: 0.74, chin: 0.86, cheek: 1.10,
              brow: 0.72, socket: 0.92, noseL: 0.88, noseW: 0.86,
              mouthW: 1.06, lip: 1.12 },
      hair: 0xd0a55f, hairStyle: "longWavy", hairRough: 0.56,
      browColour: 0xa88a5c,
      top: 0x9a9fa6, topKind: "tee", weave: "cloth",
      trousers: 0x93aac6, legKind: "joggers", legWeave: "denim",
      shoe: 0x2b2320, boots: true
    });
    r.name = "ouissy";
    /* the strap of whatever she left the house with — swept over the
       shoulder and down across the chest, so it lies on her */
    var strapMat = leatherMat(0x54402c);
    var strap = new THREE.Mesh(sweep([
      new THREE.Vector3(-0.040, 1.330, 0.128),
      new THREE.Vector3( 0.028, 1.376, 0.118),
      new THREE.Vector3( 0.086, 1.300, 0.086),
      new THREE.Vector3( 0.104, 1.180, 0.010),
      new THREE.Vector3( 0.092, 1.060, -0.060),
      new THREE.Vector3( 0.048, 0.992, -0.104)
    ], 0.016, 0.014, 9, 0), strapMat);
    strap.position.y = -1.180;                     /* chest-bone local */
    strap.castShadow = true;
    r.chest.add(strap);
    var satchel = new THREE.Mesh(roundBox(0.090, 0.150, 0.115, 0.028, 2), strapMat);
    satchel.position.set(0.024, -0.245, -0.118);
    satchel.rotation.set(0, 0, 0.14);
    satchel.castShadow = true;
    r.chest.add(satchel);
    return r;
  }

  function makeAnwar() {
    var r = buildHuman({
      scale: 1.05, build: "broad", depth: 0.82,
      skin: 0xc2905f, eyes: 0x33241a, lips: 0x8a5a4a,
      hair: 0x241a14, hairStyle: "short", beard: true, browColour: 0x241a14,
      top: 0xdfe3ea, topKind: "tee", weave: "cloth",
      trousers: 0x3b424f, legKind: "joggers", legWeave: "cloth",
      shoe: 0x1f1a17
    });
    r.name = "anwar";
    return r;
  }

  /* ---------------------------------------------------------------
     THEM
     Nine bodies, six wardrobes, four builds and a set of things that
     can have gone wrong, combined off the seed — so a corridor with
     eight in it has eight different people in it.
     --------------------------------------------------------------- */
  var Z_SKIN = [0x9fae96, 0x93a58c, 0xacb2a0, 0x8a9a86, 0xa2a08e, 0x90a292, 0xaca694, 0x9a9a8a, 0xa0b0a0];
  var Z_HAIR = [0x2a2420, 0x3a3028, 0x1c1814, 0x584a3a, 0x6a5a4a, 0x241c18];
  var Z_KIT = [
    { top: 0x6f97a4, trousers: 0x6f97a4, weave: "cloth", legWeave: "cloth", legKind: "joggers", topKind: "tee" },
    { top: 0xa89a3e, trousers: 0x2f3540, weave: "cloth", legWeave: "denim", legKind: "cargo", vest: 0xb8aa34, topKind: "shirtShort" },
    { top: 0xc8c4bc, trousers: 0x2a2e38, weave: "cloth", legWeave: "cloth", legKind: "jeans", jacket: 0x2e323c, topKind: "shirt" },
    { top: 0x53454c, trousers: 0x3a4250, weave: "cloth", legWeave: "denim", legKind: "joggers", hood: true, topKind: "tee" },
    { top: 0x635c4b, trousers: 0x4a4438, weave: "cloth", legWeave: "denim", legKind: "cargo", topKind: "shirt" },
    { top: 0x8e4646, trousers: 0x33384a, weave: "cloth", legWeave: "denim", legKind: "jeans", topKind: "tee" }
  ];
  var Z_BUILD = ["slim", "average", "broad", "heavy"];
  var Z_HAIRSTYLE = ["short", "afro", "long", "bun", "bald", "short"];

  function makeZombie(seed) {
    var h = function (a, b2) { return hash2(seed * 37 + a, seed * 91 + b2); };
    var kit = Z_KIT[Math.floor(h(1, 2) * Z_KIT.length) % Z_KIT.length];
    var build = Z_BUILD[Math.floor(h(3, 4) * Z_BUILD.length) % Z_BUILD.length];
    var skinHex = Z_SKIN[Math.floor(h(5, 6) * Z_SKIN.length) % Z_SKIN.length];

    var spec = {
      scale: 0.94 + h(7, 8) * 0.18,
      build: build,
      depth: 0.74 + h(9, 1) * 0.10,
      skin: skinHex, skinMat: rotMat(skinHex),
      eyes: 0xcfcbb6, lips: 0x6a4a48,
      face: { gaunt: 0.7 + h(30, 1) * 0.5,
              wide: 0.92 + h(31, 2) * 0.16, long: 0.96 + h(32, 3) * 0.10,
              jaw: 0.8 + h(33, 4) * 0.5, chin: 0.8 + h(34, 5) * 0.5,
              cheek: 0.7 + h(35, 6) * 0.5, brow: 0.8 + h(36, 7) * 0.6,
              browY: (h(37, 8) - 0.5) * 0.008,
              socket: 1.1 + h(38, 9) * 0.4,
              eyeZ: (h(39, 1) - 0.5) * 0.006, eyeY: (h(40, 2) - 0.5) * 0.005,
              noseL: 0.85 + h(41, 3) * 0.35, noseW: 0.85 + h(42, 4) * 0.35,
              mouthW: 0.88 + h(43, 5) * 0.28, mouthY: (h(44, 6) - 0.5) * 0.006,
              lip: 0.6 + h(45, 7) * 0.3 },
      hair: Z_HAIR[Math.floor(h(2, 9) * Z_HAIR.length) % Z_HAIR.length],
      hairStyle: Z_HAIRSTYLE[Math.floor(h(4, 5) * Z_HAIRSTYLE.length) % Z_HAIRSTYLE.length],
      beard: h(6, 7) > 0.66,
      glasses: h(12, 4) > 0.72,
      top: kit.top, weave: kit.weave, topKind: kit.topKind,
      trousers: kit.trousers, legWeave: kit.legWeave, legKind: kit.legKind,
      jacket: kit.jacket, jacketWeave: "cloth",
      shoe: 0x2a221c, boots: h(14, 6) > 0.5
    };

    var r = buildHuman(spec);

    /* The clothes have been through it: torn, stained, and with the light
       taken out of them. The weave is left alone — it is still a shirt. */
    var GRIME = [0x6a5f4e, 0x4a4038, 0x53483c, 0x5a4a3e];
    var BLOOD = [0x4a1c18, 0x3a1512, 0x5a2420];
    r.meshes.forEach(function (m, mi) {
      if (m.material === spec.skinMat) {
        /* bruising, lividity and the odd bite, on the skin itself */
        soil(m.geometry, seed * 5 + mi, 7,
             [0xa08078, 0x8a6a62, 0x9a7a6a, 0x7a5a52], 0.048);
        return;
      }
      tatter(m.geometry, seed * 3 + mi, 2 + Math.floor(h(mi + 1, 3) * 4));
      soil(m.geometry, seed * 11 + mi, 5, h(mi, 5) > 0.55 ? BLOOD.concat(GRIME) : GRIME, 0.072);
      m.material = m.material.clone();
      m.material.vertexColors = true;
      m.material.side = THREE.DoubleSide;          /* the tears have two sides */
      m.material.roughness = Math.min(1, (m.material.roughness || 0.9) + 0.07);
      m.material.envMapIntensity = 0.18;
      m.material.color.multiplyScalar(0.82);
      m.material.color.lerp(new THREE.Color(0x6a685e), 0.20);
    });
    /* the hair has not been washed either */
    r.root.traverse(function (o) {
      if (o.isMesh && !o.isSkinnedMesh && o.material && o.material.map &&
          o.material !== spec.skinMat && o.parent && o.parent.isBone) {
        o.material = o.material.clone();
        o.material.color.multiplyScalar(0.74);
        o.material.color.lerp(new THREE.Color(0x50483c), 0.24);
        o.material.roughness = Math.min(1, (o.material.roughness || 0.5) + 0.22);
        o.material.envMapIntensity = 0.12;
      }
    });
    spec.skinMat.vertexColors = true;
    /* it does not stand straight any more, and the pose function has to
       know that or it straightens it out again every frame */
    r.tilt = { sz: (h(21, 4) - 0.5) * 0.20, sx: (h(22, 6) - 0.5) * 0.16,
               nz: (h(23, 8) - 0.5) * 0.34, hx: (h(24, 2) - 0.5) * 0.28,
               hz: (h(25, 3) - 0.5) * 0.22 };

    var S = spec.scale;
    if (kit.vest) {
      var vest = new THREE.Mesh(
        (function () {
          var g = new THREE.CylinderGeometry(0.196 * S, 0.186 * S, 0.34 * S, 18, 1, true);
          g.scale(spec.depth * 1.04, 1, 1); return g;
        })(),
        new THREE.MeshStandardMaterial({ color: kit.vest, roughness: 0.74, metalness: 0.02,
          map: tex("rot", 256, 1), bumpMap: bump("rot", 256, 1), bumpScale: 0.07,
          envMapIntensity: 0.5, side: THREE.DoubleSide }));
      vest.position.y = -0.02 * S;
      vest.castShadow = true;
      r.chest.add(vest);
    }
    if (kit.hood) {
      var hood = new THREE.Mesh(
        (function () { var g = new THREE.SphereGeometry(0.150 * S, 14, 11, 0, 6.2832, 0, 1.8); g.scale(1, 0.9, 1.02); return g; })(),
        new THREE.MeshStandardMaterial({ color: kit.top, roughness: 0.95,
          map: tex("rot", 256, 1), bumpMap: bump("rot", 256, 1), bumpScale: 0.1, envMapIntensity: 0.22 }));
      hood.position.set(-0.050 * S, 0.010 * S, 0);
      hood.castShadow = true;
      r.neck.add(hood);
    }

    /* what has happened to them. A torn sleeve, an arm that hangs, a
       shoulder out of line — nothing gratuitous. */
    var dmg = h(11, 13);
    r.damage = {};
    if (dmg > 0.84) {
      /* one forearm gone: collapsing the bone takes the mesh with it */
      r.bones.foreR.scale.setScalar(0.001);
      r.damage.arm = true;
    } else if (dmg > 0.64) {
      r.damage.limp = true;
    } else if (dmg > 0.46) {
      r.damage.tilt = (h(3, 17) - 0.5) * 0.5;
    }
    r.name = "zombie";
    return r;
  }

  /* ---------------------------------------------------------------
     THE ONES WHO ARE STILL PEOPLE
     --------------------------------------------------------------- */
  var CIVIL_SKIN = [0xecd0b2, 0xc99d70, 0x8f6444, 0xf2dac2, 0xaa7c54, 0x6d4c35];
  var CIVIL_HAIR = [0x2a2018, 0x6a4a26, 0x3a2a1e, 0x8a7a5a, 0x141210, 0xa89060];

  function makeGuard(seed, lod) {
    var h = function (a, b2) { return hash2(seed * 53 + a, seed * 29 + b2); };
    var S = 1.02 + h(1, 1) * 0.08;
    var r = buildHuman({
      scale: S, lod: lod,
      build: h(2, 2) > 0.5 ? "broad" : "average",
      depth: 0.80,
      skin: CIVIL_SKIN[Math.floor(h(3, 3) * CIVIL_SKIN.length) % CIVIL_SKIN.length],
      eyes: 0x33261c, lips: 0x9a6a5e,
      face: { wide: 0.96 + h(21, 1) * 0.18, long: 0.96 + h(22, 2) * 0.10,
              jaw: 0.9 + h(23, 3) * 0.6, chin: 0.9 + h(24, 4) * 0.5,
              cheek: 0.8 + h(25, 5) * 0.5, brow: 0.9 + h(26, 6) * 0.7,
              browY: (h(27, 7) - 0.5) * 0.008,
              socket: 0.9 + h(28, 8) * 0.4,
              eyeZ: (h(29, 9) - 0.5) * 0.006,
              noseL: 0.9 + h(31, 2) * 0.32, noseW: 0.9 + h(32, 3) * 0.34,
              mouthW: 0.9 + h(33, 4) * 0.24, lip: 0.8 + h(35, 6) * 0.4 },
      hair: CIVIL_HAIR[Math.floor(h(4, 4) * CIVIL_HAIR.length) % CIVIL_HAIR.length],
      hairStyle: h(5, 5) > 0.6 ? "bun" : "short",
      beard: h(6, 6) > 0.5,
      top: 0x39414d, topKind: "shirtShort", weave: "cloth",
      trousers: 0x272c34, legKind: "cargo", legWeave: "canvas",
      shoe: 0x191614, boots: true,
      helmet: h(7, 7) > 0.35 ? 0x3c4652 : null,
      mask: h(8, 8) > 0.55 ? 0x3a4048 : null
    });
    /* the hi-vis, which is the whole uniform really. Cut to the man: a
       yoke that closes over the shoulders, a chest that follows the ribs,
       a waist that comes in and a hem that does not. */
    var GB = BUILD[h(2, 2) > 0.5 ? "broad" : "average"], GD = 0.80;
    function vestRing(y, ru, rv, b) {
      return { c: [0, y * S, 0], ru: ru * S * GD * b, rv: rv * S * b };
    }
    function vestProfile(out) {
      return [
        vestRing(1.372, 0.052 / GD, 0.058, 1),
        vestRing(1.336, 0.152 + out, 0.156 + out, GB.shoulder),
        vestRing(1.270, 0.164 + out, 0.176 + out, GB.chest),
        vestRing(1.170, 0.166 + out, 0.178 + out, GB.chest),
        vestRing(1.060, 0.158 + out, 0.168 + out, GB.chest),
        vestRing(0.985, 0.150 + out, 0.158 + out, GB.waist),
        vestRing(0.948, 0.152 + out, 0.160 + out, GB.waist)
      ];
    }
    var vest = new THREE.Mesh(
      rigidLoft(vestProfile(0), 24, true, false, { folds: 0.014, foldN: 8 }),
      new THREE.MeshStandardMaterial({ color: 0xe4de20, roughness: 0.62, metalness: 0.02,
        emissive: new THREE.Color(0x2e2e08), emissiveIntensity: 1.0,
        map: tex("cloth", 256, 8), bumpMap: bump("cloth", 256, 8), bumpScale: 0.05,
        envMapIntensity: 0.8, side: THREE.DoubleSide }));
    vest.position.y = -1.180 * S;                  /* chest-bone local */
    vest.castShadow = true;
    r.chest.add(vest);
    /* the reflective bands, cut from the same profile so they lie on it */
    var bandMat = new THREE.MeshStandardMaterial({ color: 0xe8ecf4, roughness: 0.18,
      metalness: 0.24, envMapIntensity: 3.0, side: THREE.DoubleSide });
    [[1.230, 1.192], [1.106, 1.068]].forEach(function (yy) {
      var pf = vestProfile(0.006), band = [];
      for (var i = 0; i < pf.length - 1; i++) {
        var a = pf[i], b = pf[i + 1];
        [yy[0], yy[1]].forEach(function (ty) {
          var y = ty * S;
          if (y > b.c[1] && y <= a.c[1]) {
            var t = (y - b.c[1]) / (a.c[1] - b.c[1]);
            band.push({ c: [0, y, 0], ru: b.ru + (a.ru - b.ru) * t,
                        rv: b.rv + (a.rv - b.rv) * t });
          }
        });
      }
      if (band.length === 2) {
        var m = new THREE.Mesh(rigidLoft(band, 24, false, false), bandMat);
        m.position.y = -1.180 * S;
        r.chest.add(m);
      }
    });
    if (h(9, 9) > 0.25) {
      var gun = new THREE.Group();
      var gm = new THREE.MeshStandardMaterial({ color: 0x2a2c30, roughness: 0.42, metalness: 0.55, envMapIntensity: 1.2 });
      var barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.013 * S, 0.015 * S, 0.32 * S, 10), gm);
      barrel.rotation.z = Math.PI / 2; barrel.position.set(0.10 * S, 0, 0);
      gun.add(barrel);
      gun.add(new THREE.Mesh(roundBox(0.19 * S, 0.058 * S, 0.034 * S, 0.010 * S, 2), gm));
      var mag = new THREE.Mesh(roundBox(0.046 * S, 0.095 * S, 0.028 * S, 0.008 * S, 2), gm);
      mag.position.set(-0.01 * S, -0.066 * S, 0); mag.rotation.z = 0.16;
      gun.add(mag);
      var stock = new THREE.Mesh(roundBox(0.125 * S, 0.052 * S, 0.030 * S, 0.010 * S, 2), gm);
      stock.position.set(-0.148 * S, -0.012 * S, 0);
      gun.add(stock);
      gun.position.set(0.13 * S, -0.02 * S, -0.10 * S);
      gun.rotation.set(0, 0.4, -0.5);
      gun.traverse(function (o) { if (o.isMesh) o.castShadow = true; });
      r.chest.add(gun);
      var sling = new THREE.Mesh(roundBox(0.075 * S, 0.42 * S, 0.022 * S, 0.008 * S, 2), leatherMat(0x2e2a26));
      sling.position.set(0.085 * S, -0.02 * S, -0.02 * S);
      sling.rotation.z = 0.42;
      r.chest.add(sling);
    }
    r.name = "guard";
    return r;
  }

  function makeCivilian(seed, lod) {
    var h = function (a, b2) { return hash2(seed * 71 + a, seed * 13 + b2); };
    var coats = [0x4a5560, 0x6a4a3a, 0x3a4a3e, 0x5a4a5e, 0x7a6a52, 0x2f4450];
    var tops  = [0x4a7ab4, 0xc8ccd4, 0x9a5a62, 0x5a7a6a, 0xd8c8a8, 0x6a6a7a];
    var legs  = [0x39506b, 0x2f3540, 0x4a4438, 0x565a64];
    var styles = ["short", "long", "bun", "longWavy", "afro", "bald"];
    var kinds = ["tee", "shirt", "shirtShort"];
    var lk = ["jeans", "joggers", "cargo"];
    var S = 0.94 + h(1, 1) * 0.16;
    var r = buildHuman({
      scale: S, lod: lod,
      build: Z_BUILD[Math.floor(h(2, 2) * 4) % 4],
      depth: 0.74 + h(3, 3) * 0.10,
      skin: CIVIL_SKIN[Math.floor(h(4, 4) * CIVIL_SKIN.length) % CIVIL_SKIN.length],
      eyes: h(5, 5) > 0.7 ? 0x3f6350 : 0x33261c,
      lips: 0x9a6a5e,
      face: { wide: 0.90 + h(21, 1) * 0.22, long: 0.94 + h(22, 2) * 0.14,
              jaw: 0.7 + h(23, 3) * 0.7, chin: 0.7 + h(24, 4) * 0.7,
              cheek: 0.7 + h(25, 5) * 0.7, brow: 0.6 + h(26, 6) * 0.9,
              browY: (h(27, 7) - 0.5) * 0.010,
              socket: 0.8 + h(28, 8) * 0.5,
              eyeZ: (h(29, 9) - 0.5) * 0.007, eyeY: (h(30, 1) - 0.5) * 0.006,
              noseL: 0.82 + h(31, 2) * 0.42, noseW: 0.82 + h(32, 3) * 0.42,
              mouthW: 0.86 + h(33, 4) * 0.32, mouthY: (h(34, 5) - 0.5) * 0.007,
              lip: 0.8 + h(35, 6) * 0.5 },
      hair: CIVIL_HAIR[Math.floor(h(6, 6) * CIVIL_HAIR.length) % CIVIL_HAIR.length],
      hairStyle: styles[Math.floor(h(7, 7) * styles.length) % styles.length],
      beard: h(8, 8) > 0.66,
      glasses: h(17, 3) > 0.66,
      top: tops[Math.floor(h(9, 9) * tops.length) % tops.length],
      topKind: kinds[Math.floor(h(18, 5) * kinds.length) % kinds.length],
      jacket: h(10, 10) > 0.45 ? coats[Math.floor(h(11, 11) * coats.length) % coats.length] : null,
      jacketWeave: h(14, 14) > 0.5 ? "wool" : "canvas",
      trousers: legs[Math.floor(h(12, 12) * legs.length) % legs.length],
      legKind: lk[Math.floor(h(19, 7) * lk.length) % lk.length],
      legWeave: h(13, 13) > 0.5 ? "denim" : "cloth",
      shoe: 0x241f1a, boots: h(20, 2) > 0.6
    });
    if (h(16, 16) > 0.4) {
      var bag = new THREE.Mesh(roundBox(0.15 * S, 0.21 * S, 0.115 * S, 0.035 * S, 2),
        clothMat(0x4a4238, 0.95));
      bag.position.set(-0.17 * S, -0.04 * S, 0.15 * S);
      bag.castShadow = true;
      r.chest.add(bag);
      var strap = new THREE.Mesh(roundBox(0.075 * S, 0.40 * S, 0.024 * S, 0.008 * S, 2), leatherMat(0x3a332c));
      strap.position.set(-0.02 * S, -0.02 * S, 0.095 * S);
      strap.rotation.z = 0.30;
      r.chest.add(strap);
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
      (function () { var g = new THREE.SphereGeometry(0.60, 20, 14); g.scale(1.72, 0.82, 0.74); return g; })(),
      hide);
    barrel.castShadow = true;
    body.add(barrel);
    /* the chest and the quarters, which is what stops it being an egg */
    var chestM = new THREE.Mesh(
      (function () { var g = new THREE.SphereGeometry(0.42, 16, 12); g.scale(0.98, 0.96, 0.86); return g; })(),
      hide);
    chestM.position.set(0.66, 0.00, 0); chestM.castShadow = true; body.add(chestM);
    var rumpM = new THREE.Mesh(
      (function () { var g = new THREE.SphereGeometry(0.45, 16, 12); g.scale(0.94, 1.00, 0.90); return g; })(),
      hide);
    rumpM.position.set(-0.70, 0.04, 0); rumpM.castShadow = true; body.add(rumpM);
    /* somebody's saddle blanket, still on her */
    var blanket = new THREE.Mesh(
      (function () { var g = new THREE.SphereGeometry(0.60, 18, 12, 0, 6.2832, 0, 1.15);
                     g.scale(0.92, 0.86, 0.86); return g; })(),
      new THREE.MeshStandardMaterial({ color: 0x6a4450, roughness: 0.96,
        map: tex("cloth", 128, 3), bumpMap: bump("cloth", 128, 3), bumpScale: 0.3 }));
    blanket.position.set(-0.05, 0.10, 0); blanket.castShadow = true; body.add(blanket);

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
    /* the skull, then the long bone of the face, then a muzzle: a horse's
       head is three shapes and it was one */
    headG.rotation.z = 0.86;
    var head = new THREE.Mesh(
      (function () { var g = new THREE.SphereGeometry(0.17, 14, 11); g.scale(1.05, 1.0, 0.92); return g; })(),
      hide);
    head.castShadow = true; headG.add(head);
    var face = new THREE.Mesh(
      (function () { var g = new THREE.SphereGeometry(0.13, 14, 11); g.scale(1.9, 0.86, 0.84); return g; })(),
      hide);
    face.position.set(0.22, -0.05, 0); face.castShadow = true; headG.add(face);
    var muzzle = new THREE.Mesh(
      (function () { var g = new THREE.SphereGeometry(0.115, 12, 10); g.scale(0.92, 0.90, 0.92); return g; })(),
      hide);
    muzzle.position.set(0.44, -0.09, 0); muzzle.castShadow = true; headG.add(muzzle);
    [1, -1].forEach(function (s) {
      var eye = new THREE.Mesh(new THREE.SphereGeometry(0.030, 8, 6),
        new THREE.MeshStandardMaterial({ color: 0x140f0c, roughness: 0.25, envMapIntensity: 2 }));
      eye.position.set(0.06, 0.05, s * 0.135); headG.add(eye);
      var nos = new THREE.Mesh(new THREE.SphereGeometry(0.022, 8, 6),
        new THREE.MeshStandardMaterial({ color: 0x241812, roughness: 0.6 }));
      nos.position.set(0.52, -0.07, s * 0.055); headG.add(nos);
    });
    /* the headcollar on the hook by the stall, which she is still wearing */
    var strapM = new THREE.MeshStandardMaterial({ color: 0x3a2c22, roughness: 0.8 });
    var noseband = new THREE.Mesh(new THREE.TorusGeometry(0.115, 0.017, 6, 16), strapM);
    noseband.rotation.y = Math.PI / 2; noseband.position.set(0.30, -0.06, 0);
    headG.add(noseband);
    var cheekS = new THREE.Mesh(new THREE.TorusGeometry(0.155, 0.016, 6, 16), strapM);
    cheekS.rotation.y = Math.PI / 2; cheekS.position.set(0.02, 0.00, 0);
    headG.add(cheekS);
    [1, -1].forEach(function (s) {
      var ear = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.14, 6), hide);
      ear.position.set(-0.06, 0.13, s * 0.07);
      headG.add(ear);
    });
    var maneM = new THREE.Mesh(
      (function () { var g = new THREE.BoxGeometry(0.09, 0.92, 0.16); g.translate(0, 0.40, 0); return g; })(), mane);
    maneM.position.set(-0.13, 0, 0);
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

  /* A walk is a four-beat gait: near hind, near fore, off hind, off fore,
     a quarter of a stride apart, so there are always three feet down. It
     was two pairs half a stride apart, which is a trot, and it read as a
     rocking horse. The head nods with it, because a walking horse uses its
     neck for balance and a still head is the thing that makes a model of
     one look like a model. */
  function poseHorse(h, t, gait) {
    var g = clamp(gait, 0, 1);
    var w = t * 4.4;
    /* legs come in as [front-left, front-right, back-left, back-right] */
    var PH = [Math.PI * 0.5, Math.PI * 1.5, 0, Math.PI];
    h.legs.forEach(function (L, i) {
      var a = w + PH[i];
      var s = Math.sin(a);
      /* the swing forward is quick and the stance is long, which is what
         makes a walk read as weight-bearing */
      var swing = Math.max(0, s);
      L.upper.rotation.z = (s * 0.30 - swing * swing * 0.16) * g;
      L.knee.rotation.z = Math.pow(Math.max(0, Math.sin(a - 0.5)), 2) * 0.92 * g + 0.06;
    });
    /* the body rises twice a stride and rolls a little side to side */
    h.body.position.y = 1.34 + Math.abs(Math.sin(w * 2)) * 0.028 * g;
    h.body.rotation.x = Math.sin(w) * 0.030 * g;
    h.neck.rotation.z = -0.62 + Math.sin(w * 2 + 0.6) * 0.075 * g;
    h.head.rotation.z = Math.sin(w * 2 + 1.1) * 0.07 * g + Math.sin(t * 0.9) * 0.03;
    h.head.rotation.y = Math.sin(t * 0.43) * 0.10;
    h.tail.rotation.z = -0.4 + Math.sin(t * 1.7) * 0.16;
    h.tail.rotation.x = Math.sin(t * 1.1) * 0.12;
  }

  /* =========================================================
     13 — WHAT EACH CHARACTER IN THE GRID MEANS
     ========================================================= */
  var SOLID  = "#ovLKcYfB=FnuQwG~T C H W D d P V k E t e O s R Z m M J U p".replace(/ /g, "");
  var OPAQUE = "#ovLcYfGH~kJMU";             /* stops sight as well as feet */
  var HIDE   = "hj";

  function isSolidChar(ch) { return SOLID.indexOf(ch) >= 0; }
  function isOpaqueChar(ch) { return OPAQUE.indexOf(ch) >= 0; }

  /* =========================================================
     14 — THE WORLD
     A grid goes in; a scene with floors, walls, furniture,
     trees, cars, lamps and doors comes out. Anything that
     repeats is an InstancedMesh, so a forty-eight by thirty-
     three street is still a handful of draw calls.
     ========================================================= */

  /* ---- seeing through what is in the way ----
     The camera looks down the street from above and behind her, so any
     wall on the near side of her stands between the two and she vanishes
     behind it. Every solid material in a level gets this: anything drawn
     nearer to the camera than she is, and within a circle around where she
     is on the screen, is cut away — solidly in the middle, on an ordered
     4x4 dither at the edge so the hole has a soft rim rather than a
     stencilled outline. It is a fragment test, so it works on instanced
     geometry, which is what a wall is.

     Ordered, not random: a noise dither is the grain this game spent a
     week getting rid of. */
  /* three is fetched at run time, so nothing here may build a Vector until
     it has arrived */
  var CUT = { at: { value: null }, rad: { value: 96 } };
  function cutReady() {
    if (!CUT.at.value && window.THREE) CUT.at.value = new THREE.Vector4(0, 0, 0, 0);
    return !!CUT.at.value;
  }
  var CUT_VERT_HEAD = "varying float vCutDepth;\nvarying float vCutY;\n";
  /* the world height as well as the depth: the floor in front of her is
     nearer to the camera than she is, and punching a hole in that would
     drop her through it */
  var CUT_VERT_BODY = [
    "",
    "vCutDepth = -mvPosition.z;",
    "vec4 apWp = vec4(transformed, 1.0);",
    "#ifdef USE_INSTANCING",
    "  apWp = instanceMatrix * apWp;",
    "#endif",
    "vCutY = (modelMatrix * apWp).y;"
  ].join("\n");
  var CUT_FRAG_HEAD = [
    "varying float vCutDepth;",
    "varying float vCutY;",
    "uniform vec4 uCutAt;",
    "uniform float uCutRad;",
    "float apBayer2(vec2 a){ a = floor(a); return fract(a.x * 0.5 + a.y * a.y * 0.75); }",
    ""
  ].join("\n");
  var CUT_FRAG_BODY = [
    "if (uCutAt.w > 0.5 && vCutY > 0.34 && vCutDepth < uCutAt.z - 0.65) {",
    "  float dCut = length(gl_FragCoord.xy - uCutAt.xy);",
    "  if (dCut < uCutRad) {",
    "    float band = smoothstep(uCutRad * 0.52, uCutRad, dCut);",
    "    float thr = apBayer2(gl_FragCoord.xy * 0.5) * 0.25 + apBayer2(gl_FragCoord.xy);",
    "    if (band < thr) discard;",
    "  }",
    "}"
  ].join("\n");

  function occlude(mat) {
    if (!mat || mat.__cut) return mat;
    cutReady();
    mat.__cut = true;
    mat.onBeforeCompile = function (sh) {
      sh.uniforms.uCutAt = CUT.at;
      sh.uniforms.uCutRad = CUT.rad;
      sh.vertexShader = sh.vertexShader
        .replace("#include <common>", "#include <common>\n" + CUT_VERT_HEAD)
        .replace("#include <project_vertex>", "#include <project_vertex>" + CUT_VERT_BODY);
      sh.fragmentShader = sh.fragmentShader
        .replace("#include <common>", "#include <common>\n" + CUT_FRAG_HEAD)
        .replace("#include <clipping_planes_fragment>",
                 "#include <clipping_planes_fragment>\n" + CUT_FRAG_BODY);
    };
    mat.customProgramCacheKey = function () { return "apCut"; };
    return mat;
  }

  /* where she is on the screen, and how far away, for the cut above */
  var _cutV = null, _cutW = null, _cutS = null;
  function updateCut() {
    if (!cutReady()) return;
    var on = G && G.player && G.state !== "cine" && !G.cine && Stage.renderer;
    if (!on) { CUT.at.value.w = 0; return; }
    if (!_cutV) { _cutV = new THREE.Vector3(); _cutW = new THREE.Vector3(); _cutS = new THREE.Vector2(); }
    var cam = Stage.camera;
    _cutW.set(G.player.x, 1.05, G.player.z);
    _cutV.copy(_cutW).applyMatrix4(cam.matrixWorldInverse);
    var depth = -_cutV.z;
    _cutW.project(cam);
    Stage.renderer.getDrawingBufferSize(_cutS);
    CUT.at.value.set((_cutW.x * 0.5 + 0.5) * _cutS.x,
                     (_cutW.y * 0.5 + 0.5) * _cutS.y, depth, 1);
    CUT.rad.value = Math.max(70, _cutS.y * 0.135);
  }

  function Batch(geometry, material, castShadow, receiveShadow) {
    this.g = geometry; this.m = material;
    this.items = [];
    this.cast = castShadow !== false;
    this.recv = !!receiveShadow;
  }
  Batch.prototype.add = function (x, y, z, sx, sy, sz, ry, colour) {
    this.items.push([x, y, z, sx, sy, sz, ry || 0, colour == null ? 0xffffff : colour]);
  };
  /* One batch per level meant one InstancedMesh whose bounding sphere
     covered the whole level, so frustum culling could never reject it: a
     street of forty buildings drew all forty however few were on the
     screen, twice over, because the shadow pass draws it again. The
     instances are sorted into squares of the map first, and each square
     becomes its own mesh with its own bounds. Standing in one street then
     costs the streets you can see and nothing else. */
  var CHUNK = 26;                                  /* world units a side */
  Batch.prototype.build = function (parent) {
    if (!this.items.length) return null;
    var self = this;
    var buckets = {}, order = [];
    /* below a certain size the split costs more in draw calls than it
       saves in triangles */
    var split = this.items.length >= 48;
    for (var i = 0; i < this.items.length; i++) {
      var it = this.items[i];
      var key = split
        ? (Math.floor(it[0] / CHUNK) + "," + Math.floor(it[2] / CHUNK))
        : "all";
      if (!buckets[key]) { buckets[key] = []; order.push(key); }
      buckets[key].push(it);
    }
    var d = new THREE.Object3D(), c = new THREE.Color(), first = null;
    for (var b = 0; b < order.length; b++) {
      var list = buckets[order[b]];
      var im = new THREE.InstancedMesh(this.g, this.m, list.length);
      im.castShadow = self.cast; im.receiveShadow = self.recv;
      for (var j = 0; j < list.length; j++) {
        var q = list[j];
        d.position.set(q[0], q[1], q[2]);
        d.scale.set(q[3], q[4], q[5]);
        d.rotation.set(0, q[6], 0);
        d.updateMatrix();
        im.setMatrixAt(j, d.matrix);
        im.setColorAt(j, c.setHex(q[7]));
      }
      im.instanceMatrix.needsUpdate = true;
      if (im.instanceColor) im.instanceColor.needsUpdate = true;
      im.computeBoundingSphere();
      im.frustumCulled = true;
      parent.add(im);
      if (!first) first = im;
    }
    return first;
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
      panelAt: null, tvAt: null, seen: null,
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
    world.tx = function (v) { return v / TILE - 0.5; };
    world.ty = function (v) { return v / TILE - 0.5; };

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

    /* ---- what is on the floor of a hospital that stopped coping ----
       Every one of them was a patient or somebody working the ward before
       it happened, and that happened in these corridors. Two shapes: a
       pool that spread and dried at the edges, and a drag, which is what
       it looks like when something was pulled somewhere. */
    function bloodTexture(kind) {
      var key = "__blood" + kind;
      if (TEX[key]) return TEX[key];
      var S2 = 128, cc = canvas2d(S2), sx = cc.x;
      sx.clearRect(0, 0, S2, S2);
      function blob(cx2, cy2, rx, ry, a, alpha) {
        sx.save();
        sx.translate(cx2, cy2); sx.rotate(a); sx.scale(rx, ry);
        var gr = sx.createRadialGradient(0, 0, 0.05, 0, 0, 1);
        gr.addColorStop(0, "rgba(74,10,10," + alpha + ")");
        gr.addColorStop(0.62, "rgba(58,8,9," + (alpha * 0.94) + ")");
        gr.addColorStop(0.88, "rgba(40,8,10," + (alpha * 0.55) + ")");
        gr.addColorStop(1, "rgba(34,8,10,0)");
        sx.fillStyle = gr;
        sx.beginPath(); sx.arc(0, 0, 1, 0, 6.2832); sx.fill();
        sx.restore();
      }
      if (kind === "drag") {
        for (var d = 0; d < 22; d++) {
          var t = d / 21;
          blob(S2 * 0.5 + Math.sin(t * 3.1) * S2 * 0.05, S2 * (0.06 + t * 0.88),
               S2 * (0.20 - t * 0.13), S2 * 0.10, 0, 0.72 - t * 0.42);
        }
      } else {
        blob(S2 * 0.5, S2 * 0.5, S2 * 0.40, S2 * 0.34, 0.3, 0.90);
        for (var b2 = 0; b2 < 9; b2++) {
          var a2 = hash2(b2 * 7 + (kind === "spatter" ? 31 : 3), 5) * 6.2832;
          var rr = (kind === "spatter" ? 0.46 : 0.30) * hash2(b2, 11);
          blob(S2 * (0.5 + Math.cos(a2) * rr), S2 * (0.5 + Math.sin(a2) * rr),
               S2 * (0.05 + hash2(b2, 13) * 0.13), S2 * (0.04 + hash2(b2, 17) * 0.11),
               a2, 0.30 + hash2(b2, 19) * 0.45);
        }
      }
      /* break the edge up so it is not a soft airbrushed circle */
      var f3 = fbm(S2, 5, 3, kind === "drag" ? 23 : 91);
      var im = sx.getImageData(0, 0, S2, S2), dd2 = im.data;
      for (var i2 = 0, p3 = 3; i2 < f3.length; i2++, p3 += 4) {
        dd2[p3] = clamp(dd2[p3] * (0.45 + f3[i2] * 1.5), 0, 255);
      }
      sx.putImageData(im, 0, 0);
      var t2 = new THREE.CanvasTexture(cc.c);
      t2.colorSpace = THREE.SRGBColorSpace;
      TEX[key] = t2;
      return t2;
    }

    /* ---------- batches ---------- */
    var B = {
      floor:  new Batch(geo("tileF", function () { return new THREE.BoxGeometry(TILE, 0.30, TILE); }), matFloor, false, true),
      ground: new Batch(geo("tileG", function () { return new THREE.BoxGeometry(TILE, 0.30, TILE); }), matGround, false, true),
      wall:   new Batch(geo("wallB", function () { return new THREE.BoxGeometry(TILE, TUNE.wallH, TILE); }), matWall, true, true),
      /* `false` in the third slot means "does not cast": everything small
         enough that its shadow is invisible stays out of the shadow pass,
         which is a full re-render of the scene from the torch every frame. */
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
                surface("block", { size: 512, rough: 0.86, bumpScale: 0.12, tint: 0xb8bcc0 }), false, true),

      /* ---- the pieces a facade is made of ----
         Each is one instanced batch across the whole level, so a street of
         forty buildings with two hundred windows in it is still a dozen
         draw calls. */
      coping:  new Batch(geo("copingB", function () { return new THREE.BoxGeometry(TILE * 1.22, 0.14, TILE * 1.22); }),
                surface("block", { size: 512, rough: 0.84, bumpScale: 0.14, tint: 0xa8aeb6 }), true, true),
      plinth:  new Batch(geo("plinthB", function () { return new THREE.BoxGeometry(TILE * 1.06, 0.60, 0.24); }),
                surface("block", { size: 512, rough: 0.88, bumpScale: 0.16, tint: 0x9aa0a8 }), false, true),
      band:    new Batch(geo("bandB", function () { return new THREE.BoxGeometry(1, 1, 1); }),
                surface("block", { size: 512, rough: 0.86, bumpScale: 0.12, tint: 0xa4aab2 }), false, true),
      sill:    new Batch(geo("sillB2", function () { return new THREE.BoxGeometry(TILE * 0.72, 0.11, 0.26); }),
                surface("block", { size: 512, rough: 0.82, bumpScale: 0.1, tint: 0xb0b6be }), false, true),
      reveal:  new Batch(geo("revealB", function () { return new THREE.BoxGeometry(1, 1, 1); }),
                new THREE.MeshStandardMaterial({ color: 0x14181e, roughness: 0.95, metalness: 0 }), false, true),
      winDark: new Batch(geo("winB", function () { return new THREE.BoxGeometry(TILE * 0.56, 0.92, 0.06); }),
                null, false, false),
      winLit:  new Batch(geo("winB2", function () { return new THREE.BoxGeometry(TILE * 0.56, 0.92, 0.06); }),
                null, false, false),
      /* a window frame casting a shadow into a room nobody can see into */
      winFrame: new Batch(geo("winFrameB", function () {
                  /* a frame with a transom and a mullion in it */
                  var a = new THREE.BoxGeometry(TILE * 0.62, 0.07, 0.10); a.translate(0, 0.49, 0);
                  var b = new THREE.BoxGeometry(TILE * 0.62, 0.07, 0.10); b.translate(0, -0.49, 0);
                  var c = new THREE.BoxGeometry(0.07, 1.05, 0.10); c.translate(-TILE * 0.29, 0, 0);
                  var d = new THREE.BoxGeometry(0.07, 1.05, 0.10); d.translate(TILE * 0.29, 0, 0);
                  var e = new THREE.BoxGeometry(0.05, 0.98, 0.09);
                  var f = new THREE.BoxGeometry(TILE * 0.58, 0.045, 0.09); f.translate(0, 0.16, 0);
                  return mergeGeoms([a, b, c, d, e, f]);
                }), null, false, false),
      board:   new Batch(geo("boardB", function () { return new THREE.BoxGeometry(1, 1, 1); }),
                surface("boards", { size: 256, rough: 0.95, bumpScale: 0.2, tint: 0x9a8464 }), false, false),
      shutter: new Batch(geo("shutB", function () { return new THREE.BoxGeometry(1, 1, 1); }),
                surface("metal", { size: 256, rough: 0.55, metal: 0.7, tint: 0x8a8f96, envInt: 1.1 }), true, false),
      soot:    new Batch(geo("sootB", function () { return new THREE.PlaneGeometry(1, 1); }),
                new THREE.MeshBasicMaterial({ map: sootTexture(), transparent: true, opacity: 0.72,
                  depthWrite: false, color: 0x0a0a0c }), false, false),
      /* what forty years of rain does under a sill, and what somebody with
         a can did to the shutter */
      damp:    new Batch(geo("dampB", function () { return new THREE.PlaneGeometry(1, 1); }),
                new THREE.MeshBasicMaterial({ map: sootTexture(), transparent: true, opacity: 0.34,
                  depthWrite: false, color: 0x39423a }), false, false),
      tag:     new Batch(geo("tagB", function () { return new THREE.PlaneGeometry(1, 1); }),
                new THREE.MeshBasicMaterial({ map: tex("graffiti", 256, 1), transparent: true,
                  opacity: 0.9, depthWrite: false, toneMapped: true }), false, false),
      /* the spill of a lit window onto the wall it is set into, so a light
         on the fourth floor reads from the pavement */
      winGlow: new Batch(geo("winGlowB", function () { return new THREE.PlaneGeometry(1, 1); }),
                new THREE.MeshBasicMaterial({ map: glowTexture(), transparent: true,
                  blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.42,
                  toneMapped: false }), false, false),
      /* road markings, and the drains they run into */
      paint:   new Batch(geo("paintB", function () {
                  var g = new THREE.PlaneGeometry(1, 1); g.rotateX(-Math.PI / 2); return g;
                }),
                new THREE.MeshStandardMaterial({ color: 0xd8d2be, roughness: 0.86,
                  transparent: true, opacity: 0.62, depthWrite: false,
                  polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }), false, false),
      drain:   new Batch(geo("drainB", function () { return new THREE.BoxGeometry(0.62, 0.06, 0.44); }),
                surface("metal", { size: 256, rough: 0.72, metal: 0.6, tint: 0x4a4c50, envInt: 0.9 }),
                false, true),
      tank:    new Batch(geo("tankB", function () { return new THREE.CylinderGeometry(0.62, 0.62, 1.1, 14); }),
                surface("metal", { size: 256, rough: 0.7, metal: 0.6, tint: 0x6a6258, envInt: 1.0 }), true, true),
      thin:    new Batch(geo("thinB", function () { return new THREE.BoxGeometry(1, 1, 1); }),
                surface("metal", { size: 256, rough: 0.5, metal: 0.75, tint: 0x585c62, envInt: 1.2 }), false, true),
      rubble:  new Batch(geo("rubbleB", function () { return new THREE.DodecahedronGeometry(1, 0); }),
                surface("block", { size: 256, rough: 0.96, bumpScale: 0.3, tint: 0x8a8278 }), false, true),
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
    /* ---- the world past the edge of the map ----
       A grid ends, and where it ended you could see the sky through the
       floor — a green polygon sitting in an orange void, which is what a
       clearing in the middle of a wood should least look like. The ground
       carries on for another sixteen tiles in every direction, and past
       that there is a treeline. She still cannot walk out there: anything
       off the grid reads as wall to her feet. It is scenery, and scenery
       is what was missing. */
    if (def.horizon) {
      var MARG = 16;
      for (var ay = -MARG; ay < H + MARG; ay++) {
        for (var ax = -MARG; ax < W + MARG; ax++) {
          if (ax >= 0 && ay >= 0 && ax < W && ay < H && at(ax, ay) !== " ") continue;
          var at2 = hash2(ax * 7 + 3, ay * 11 + 5);
          /* unbroken, or the sky shows through the floor; it darkens and
             falls away instead, which is what distance does */
          var edge = Math.max(0, Math.max(-ax, ax - W, -ay, ay - H)) / MARG;
          B.ground.add(cx(ax), -0.15 - at2 * 0.05 - edge * edge * 0.9, cz(ay), 1, 1, 1, 0,
                       shade(0xffffff, (0.82 + at2 * 0.12) * (1 - edge * 0.34)));
        }
      }
      /* and a treeline round the whole of it */
      var ringR = Math.max(W, H) * 0.5 + MARG * 0.72;
      var ringN = Math.round(ringR * 2.6);
      for (var ri = 0; ri < ringN; ri++) {
        var ra = ri / ringN * 6.2832;
        var rr = ringR + hash2(ri, 7) * 5.5;
        var rx = W / 2 + Math.cos(ra) * rr, rz = H / 2 + Math.sin(ra) * rr;
        var rs = 1.5 + hash2(ri, 13) * 1.9;
        B.trunk.add(cx(rx), -0.1, cz(rz), 1, 2.0 + hash2(ri, 3) * 1.6, 1, 0,
                    shade(0xffffff, 0.5 + hash2(ri, 5) * 0.2));
        for (var rl = 0; rl < 3; rl++) {
          B.canopy.add(cx(rx) + (hash2(ri, rl) - 0.5) * 1.5,
                       2.4 + rl * 0.8 + hash2(ri, rl * 3) * 0.6,
                       cz(rz) + (hash2(rl, ri) - 0.5) * 1.5,
                       rs, rs * 0.86, rs, hash2(ri, rl) * 3,
                       shade(0xffffff, 0.34 + hash2(ri, rl + 9) * 0.22));
        }
      }
    }

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
            /* somebody got at the bottom of this one with a can */
            if (fseed > 0.74) {
              B.tag.add(ox + d[0] * 0.035, 1.10 + fseed * 0.5, oz + d[1] * 0.035,
                        TILE * (0.9 + fseed * 0.5), 1.1 + fseed * 0.4, 0.02, face, 0xffffff);
            }
            /* and the damp that comes up out of the pavement into it */
            if (fseed < 0.30) {
              B.damp.add(ox + d[0] * 0.03, 1.05, oz + d[1] * 0.03,
                         TILE * 1.0, 2.1, 0.02, face, 0xffffff);
            }
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
              /* forty years of rain coming off the end of that sill */
              if (seed > 0.42) {
                B.damp.add(ox + d[0] * 0.03, wy - 1.05, oz + d[1] * 0.03,
                           TILE * 0.5, 1.0, 0.02, face, 0xffffff);
              }
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
                /* A fifth of the windows being lit is a town that has been
                   evacuated. A third of them, in three or four different
                   colours, is a town people are still hiding in — which is
                   the one she is walking through. */
                var lit = seed > 0.66;
                if (lit) {
                  var wc = seed > 0.955 ? 0x7fa8d8      /* a television */
                         : seed > 0.90  ? 0xffb060      /* a lamp */
                         : seed > 0.80  ? 0xffd8a0      /* a ceiling light */
                         :                0xffe6c0;     /* a bare bulb */
                  B.winLit.add(ox + d[0] * 0.068, wy, oz + d[1] * 0.068, 1, 1, 1, face,
                               shade(wc, 0.80 + seed * 0.5));
                  /* the light it throws on the wall around it */
                  B.winGlow.add(ox + d[0] * 0.105, wy, oz + d[1] * 0.105,
                                TILE * 2.0, 2.4, 1, face, shade(wc, 0.55 + seed * 0.4));
                } else {
                  B.winDark.add(ox + d[0] * 0.068, wy, oz + d[1] * 0.068, 1, 1, 1, face,
                                shade(0xffffff, 0.85 + seed * 0.3));
                }
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
      /* Not every light on a street works, and a street where they all do
         is a street nothing has happened to. One in six is out; one in
         five of the rest is on its way out. */
      var lampT = hash2(x * 17 + 3, y * 29 + 7);
      var lampDead = lampT < 0.11;
      var lampBad = !lampDead && lampT > 0.80;
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
      if (lampDead) {
        /* dark, and the glass gone out of the head of it */
        bulb.visible = false; halo.visible = false; shaft.visible = false;
        return g;
      }
      world.lamps.push({ x: cx(x) + 0.85, y: 4.1, z: cz(y),
                         colour: lampBad ? 0xe6e2d4 : 0xffcf90,
                         power: lampBad ? 2.2 : 2.6, range: 12, kind: "post",
                         bulb: bulb, halo: halo,
                         shaft: shaft, flicker: lampBad ? 1 : 0,
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
        /* a rug is the warmest thing in a room; it was a black rectangle */
        var RUGS = [0xb08a86, 0xa8968a, 0x9a8ea6, 0xb0a288, 0x8e9aa4];
        var rug = new THREE.Mesh(new THREE.BoxGeometry(TILE, 0.04, TILE),
          new THREE.MeshStandardMaterial({
            color: RUGS[Math.floor(hash2(x * 3, y * 5) * RUGS.length) % RUGS.length],
            roughness: 0.99,
            map: tex("carpet", 128, 1), bumpMap: bump("carpet", 128, 1), bumpScale: 0.3 }));
        rug.position.y = 0.016; rug.receiveShadow = true; g.add(rug);
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

    /* ---------------------------------------------------------------
       The rooms of the house. Every one of these faces the nearest wall
       it can find, so a wardrobe never stands in the middle of a floor
       with its back to you.
       --------------------------------------------------------------- */
    function facingAway(x, y) {
      /* the direction pointing out of the nearest wall */
      if (isSolidChar(at(x, y - 1))) return 0;
      if (isSolidChar(at(x + 1, y))) return -Math.PI / 2;
      if (isSolidChar(at(x, y + 1))) return Math.PI;
      if (isSolidChar(at(x - 1, y))) return Math.PI / 2;
      return 0;
    }
    function propGroup(x, y, faceWall) {
      var g = new THREE.Group();
      g.position.set(cx(x), 0, cz(y));
      if (faceWall !== false) g.rotation.y = facingAway(x, y);
      G.add(g);
      return g;
    }
    function box(w, h, d, mat, px, py, pz, g) {
      var m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      m.position.set(px || 0, py || 0, pz || 0);
      m.castShadow = true; m.receiveShadow = true;
      if (g) g.add(m);
      return m;
    }

    var matPine  = surface("boards", { repeat: 1, rough: 0.78, tint: 0xd9c39a, bumpScale: 0.16 });
    var matWhite = surface("plaster", { repeat: 1, rough: 0.62, tint: 0xe8e6e0 });
    var matTile  = surface("clinic", { repeat: 2, rough: 0.30, tint: 0xdfe6e6, envInt: 1.2 });
    var matChrome = new THREE.MeshStandardMaterial({ color: 0xcfd6dc, roughness: 0.18, metalness: 0.92, envMapIntensity: 1.6 });
    var matGlassM = new THREE.MeshStandardMaterial({ color: 0xdfe8f2, roughness: 0.05, metalness: 0.6,
                                                     envMapIntensity: 2.2, transparent: true, opacity: 0.55 });

    /* her vanity: a table with drawers, a round mirror on it, and the
       clutter of somebody who actually uses it */
    function vanity(x, y) {
      var g = propGroup(x, y);
      box(TILE * 0.88, 0.06, TILE * 0.52, matPine, 0, 0.76, 0, g);
      [-1, 1].forEach(function (s) {
        box(0.07, 0.76, 0.07, matPine, s * TILE * 0.40, 0.38, TILE * 0.22, g);
        box(0.07, 0.76, 0.07, matPine, s * TILE * 0.40, 0.38, -TILE * 0.22, g);
      });
      var dr = box(TILE * 0.52, 0.26, TILE * 0.44, matPine, 0, 0.58, 0.02, g);
      dr.material = matPine;
      [-1, 1].forEach(function (s) {
        box(0.14, 0.03, 0.03, matChrome, s * 0.20, 0.58, TILE * 0.23, g);
      });
      /* the mirror, on a stand, angled the way a mirror ends up */
      var ring = new THREE.Mesh(new THREE.TorusGeometry(0.30, 0.028, 8, 26), matPine);
      ring.position.set(0, 1.16, -TILE * 0.14); ring.rotation.x = 0.10; g.add(ring);
      var glass = new THREE.Mesh(new THREE.CircleGeometry(0.29, 26), matGlassM);
      glass.position.set(0, 1.16, -TILE * 0.13); glass.rotation.x = 0.10; g.add(glass);
      box(0.05, 0.30, 0.05, matPine, 0, 0.92, -TILE * 0.16, g);
      /* bottles and pots */
      for (var i = 0; i < 6; i++) {
        var t = hash2(x * 7 + i, y * 3);
        var h2 = 0.06 + t * 0.10;
        var b = new THREE.Mesh(new THREE.CylinderGeometry(0.026 + t * 0.014, 0.030 + t * 0.014, h2, 8),
          new THREE.MeshStandardMaterial({
            color: [0xd8a0b4, 0xe4d2b8, 0xb8c8d8, 0xd6b48a, 0xc0a8c8, 0xe8dcc0][i],
            roughness: 0.42, metalness: 0.1, envMapIntensity: 1.2 }));
        b.position.set(-0.30 + i * 0.12 + (t - 0.5) * 0.04, 0.79 + h2 / 2, 0.10 + (t - 0.5) * 0.14);
        b.castShadow = true; g.add(b);
      }
      return g;
    }

    /* a bookcase with actual books in it: spines of different heights,
       depths and colours, a few leaning, one shelf used for other things */
    function bookshelf(x, y) {
      var g = propGroup(x, y);
      var W2 = TILE * 0.86, D2 = TILE * 0.34, H2 = 2.05;
      box(W2, H2, D2, matPine, 0, H2 / 2 - 0.15, -TILE * 0.30, g);
      var shelves = 5;
      for (var s = 1; s < shelves; s++) {
        var sy = -0.15 + (H2 / shelves) * s;
        box(W2 - 0.06, 0.035, D2 - 0.04, matPine, 0, sy, -TILE * 0.30, g);
        /* the books on it */
        var n = 0, bx = -W2 / 2 + 0.06;
        while (bx < W2 / 2 - 0.10 && n < 18) {
          var t = hash2(x * 13 + s * 7 + n, y * 5 + n);
          if (t > 0.90) { bx += 0.05; n++; continue; }      /* a gap */
          var bw = 0.026 + t * 0.030, bh = 0.20 + t * 0.10;
          var bk = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, D2 * (0.55 + t * 0.3)),
            new THREE.MeshStandardMaterial({
              color: [0x7a3a3a, 0x2f4a5e, 0x4a5a3a, 0x6a5a3a, 0x3a3a4e, 0x8a6a4a,
                      0x5e3a52, 0x2e4a44][n % 8],
              roughness: 0.86 }));
          bk.position.set(bx + bw / 2, sy + bh / 2 + 0.018, -TILE * 0.30 + 0.02);
          if (t > 0.82) { bk.rotation.z = 0.24; bk.position.x += 0.03; }
          bk.castShadow = true; g.add(bk);
          bx += bw + 0.004; n++;
        }
      }
      return g;
    }

    /* a desk with a laptop open on it, the screen still on */
    function deskProp(x, y) {
      var g = propGroup(x, y);
      box(TILE * 0.92, 0.06, TILE * 0.56, matPine, 0, 0.74, 0, g);
      [-1, 1].forEach(function (s) {
        box(0.06, 0.74, TILE * 0.5, matPine, s * TILE * 0.42, 0.37, 0, g);
      });
      var base = box(0.34, 0.018, 0.24, matChrome, 0.02, 0.786, 0.06, g);
      base.material = new THREE.MeshStandardMaterial({ color: 0x9aa2ac, roughness: 0.34, metalness: 0.7 });
      var lid = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.22, 0.014),
        new THREE.MeshStandardMaterial({ color: 0x8e969f, roughness: 0.34, metalness: 0.7 }));
      lid.position.set(0.02, 0.895, -0.05); lid.rotation.x = -0.28; g.add(lid);
      var scr = new THREE.Mesh(new THREE.PlaneGeometry(0.30, 0.18),
        new THREE.MeshBasicMaterial({ color: 0x6a86b8, toneMapped: false }));
      scr.position.set(0.02, 0.895, -0.042); scr.rotation.x = -0.28; g.add(scr);
      world.lamps.push({ x: cx(x), y: 0.95, z: cz(y), colour: 0x7ea0d8, power: 0.30,
                         range: 2.4, kind: "static", tx: x, ty: y });
      /* a mug and a stack of paper */
      var mug = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.040, 0.10, 10),
        new THREE.MeshStandardMaterial({ color: 0xe0dcd4, roughness: 0.5 }));
      mug.position.set(-0.30, 0.83, 0.10); mug.castShadow = true; g.add(mug);
      box(0.22, 0.03, 0.30, matWhite, 0.30, 0.79, -0.02, g);
      return g;
    }

    /* something alive, which is most of what a room needs */
    function plantProp(x, y) {
      var g = propGroup(x, y, false);
      var t = hash2(x * 3, y * 7);
      var pot = new THREE.Mesh(new THREE.CylinderGeometry(0.20, 0.15, 0.28, 12),
        surface("brick", { repeat: 1, rough: 0.9, tint: t > 0.5 ? 0xb08060 : 0xd8d2c6 }));
      pot.position.y = -0.01; pot.castShadow = true; g.add(pot);
      var soil = new THREE.Mesh(new THREE.CylinderGeometry(0.185, 0.185, 0.03, 12),
        new THREE.MeshStandardMaterial({ color: 0x3a2e22, roughness: 1 }));
      soil.position.y = 0.13; g.add(soil);
      var leafM = new THREE.MeshStandardMaterial({ color: t > 0.5 ? 0x3f6a3a : 0x4a7a44,
        roughness: 0.72, side: THREE.DoubleSide });
      for (var i = 0; i < 9; i++) {
        var a = hash2(x + i, y * 3) * 6.2832, lean = 0.4 + hash2(i, x) * 0.7;
        var len = 0.34 + hash2(i * 3, y) * 0.42;
        var leaf = new THREE.Mesh(new THREE.PlaneGeometry(0.16, len, 1, 3), leafM);
        var pos = leaf.geometry.attributes.position;
        for (var v = 0; v < pos.count; v++) {
          var ly = pos.getY(v) / len + 0.5;
          pos.setX(v, pos.getX(v) * (0.35 + Math.sin(ly * 3.14) * 0.9));
          pos.setZ(v, -Math.pow(ly, 2) * len * 0.5);
        }
        leaf.geometry.computeVertexNormals();
        leaf.position.set(Math.cos(a) * 0.05, 0.14 + len * 0.42, Math.sin(a) * 0.05);
        leaf.rotation.set(-lean, a, 0);
        leaf.castShadow = true;
        g.add(leaf);
      }
      return g;
    }

    /* the two of them, framed, on whichever wall is nearest */
    function wallArt(x, y) {
      var g = propGroup(x, y);
      /* propGroup turned it to face out of the wall; the frames go back
         onto it */
      var n = 1 + Math.floor(hash2(x * 5, y * 11) * 3);
      for (var i = 0; i < n; i++) {
        var t = hash2(x + i * 3, y + i);
        var w2 = 0.34 + t * 0.26, h2 = 0.28 + hash2(i, x) * 0.30;
        var fg = new THREE.Group();
        fg.position.set((i - (n - 1) / 2) * 0.72, 1.55 + (t - 0.5) * 0.24, -TILE * 0.47);
        box(w2 + 0.05, h2 + 0.05, 0.04, matPine, 0, 0, 0, fg);
        var pic = new THREE.Mesh(new THREE.PlaneGeometry(w2, h2),
          new THREE.MeshStandardMaterial({
            color: [0x6a7a94, 0x8a7a6a, 0x7a8a7a, 0x94867a][i % 4],
            roughness: 0.5, map: tex("cloth", 64, 1) }));
        pic.position.z = 0.026; fg.add(pic);
        g.add(fg);
      }
      return g;
    }

    /* a table: dining height if there are chairs round it, coffee height
       if it is sitting on a rug */
    function tableProp(x, y) {
      var chairs = "eu".indexOf(at(x - 1, y)) >= 0 || "eu".indexOf(at(x + 1, y)) >= 0 ||
                   "eu".indexOf(at(x, y - 1)) >= 0 || "eu".indexOf(at(x, y + 1)) >= 0;
      var g = propGroup(x, y, false);
      var h2 = chairs ? 0.74 : 0.40;
      box(TILE * 0.94, 0.07, TILE * 0.94, matPine, 0, h2, 0, g);
      [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function (c) {
        box(0.08, h2, 0.08, matPine, c[0] * TILE * 0.38, h2 / 2, c[1] * TILE * 0.38, g);
      });
      if (chairs) {
        /* laid, because somebody was going to eat */
        for (var i = 0; i < 2; i++) {
          var pl = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.12, 0.02, 16),
            new THREE.MeshStandardMaterial({ color: 0xe8e4dc, roughness: 0.34, envMapIntensity: 1.4 }));
          pl.position.set((i ? 0.34 : -0.34), h2 + 0.045, 0);
          pl.castShadow = true; g.add(pl);
        }
      } else {
        var mug2 = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.04, 0.10, 10),
          new THREE.MeshStandardMaterial({ color: 0xd8cfc0, roughness: 0.5 }));
        mug2.position.set(0.16, h2 + 0.085, 0.10); g.add(mug2);
        box(0.30, 0.03, 0.22, matWhite, -0.14, h2 + 0.05, -0.06, g);
      }
      return g;
    }

    function chairProp(x, y) {
      var g = propGroup(x, y);
      box(TILE * 0.46, 0.06, TILE * 0.46, matPine, 0, 0.46, 0, g);
      [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function (c) {
        box(0.06, 0.46, 0.06, matPine, c[0] * TILE * 0.18, 0.23, c[1] * TILE * 0.18, g);
      });
      box(TILE * 0.46, 0.52, 0.06, matPine, 0, 0.74, -TILE * 0.20, g);
      return g;
    }

    /* the cooker, with a hob and a door you can see the racks through */
    function ovenProp(x, y) {
      var g = propGroup(x, y);
      var body = box(TILE * 0.94, 0.90, TILE * 0.86, matWhite, 0, 0.30, 0, g);
      body.material = surface("metal", { repeat: 1, rough: 0.42, metal: 0.55, tint: 0xb8bcc0, envInt: 1.4 });
      box(TILE * 0.98, 0.05, TILE * 0.90, matChrome, 0, 0.775, 0, g);
      [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function (c) {
        var ring = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.018, 6, 18),
          new THREE.MeshStandardMaterial({ color: 0x2a2c30, roughness: 0.5 }));
        ring.rotation.x = -Math.PI / 2;
        ring.position.set(c[0] * TILE * 0.22, 0.805, c[1] * TILE * 0.20);
        g.add(ring);
      });
      var glass = new THREE.Mesh(new THREE.PlaneGeometry(TILE * 0.66, 0.40),
        new THREE.MeshStandardMaterial({ color: 0x14171c, roughness: 0.16, metalness: 0.4,
                                         envMapIntensity: 1.8 }));
      glass.position.set(0, 0.34, TILE * 0.435); g.add(glass);
      box(TILE * 0.72, 0.045, 0.045, matChrome, 0, 0.60, TILE * 0.46, g);
      return g;
    }

    /* a run of counter with a basin sunk into it and a tap */
    function sinkUnit(x, y) {
      var g = propGroup(x, y);
      box(TILE * 0.96, 0.86, TILE * 0.94, matPine, 0, 0.28, 0, g);
      box(TILE * 1.0, 0.08, TILE * 0.98, matTile, 0, 0.75, 0, g);
      var basin = new THREE.Mesh(new THREE.CylinderGeometry(0.30, 0.26, 0.20, 18, 1, true),
        new THREE.MeshStandardMaterial({ color: 0xc8ced4, roughness: 0.18, metalness: 0.85,
                                         side: THREE.DoubleSide, envMapIntensity: 1.8 }));
      basin.position.set(0, 0.70, 0); g.add(basin);
      var tap = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.30, 8), matChrome);
      tap.position.set(0, 0.94, -TILE * 0.30); g.add(tap);
      var spout = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.22, 8), matChrome);
      spout.rotation.x = Math.PI / 2; spout.position.set(0, 1.07, -TILE * 0.22); g.add(spout);
      /* what nobody washed up */
      for (var i = 0; i < 3; i++) {
        var pl = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.11, 0.018, 14),
          new THREE.MeshStandardMaterial({ color: 0xdedad2, roughness: 0.4 }));
        pl.position.set(0.02 + i * 0.01, 0.62 + i * 0.02, 0.02);
        pl.rotation.z = 0.06 * i; g.add(pl);
      }
      return g;
    }

    function bathProp(x, y) {
      /* A tub is two tiles long, and building one per tile made two tubs
         end to end. The first tile of a run builds the whole thing and the
         rest of the run builds nothing. */
      if (at(x - 1, y) === "R") return null;
      var runN = 1;
      while (at(x + runN, y) === "R") runN++;
      var g = propGroup(x, y, false);
      g.position.x += (runN - 1) * TILE * 0.5;
      g.scale.x = runN;
      var shell = box(TILE * 0.94, 0.56, TILE * 0.92, matWhite, 0, 0.13, 0, g);
      shell.material = new THREE.MeshStandardMaterial({ color: 0xeceae4, roughness: 0.14,
                                                        metalness: 0.05, envMapIntensity: 1.6 });
      var inner = new THREE.Mesh(new THREE.BoxGeometry(TILE * 0.78, 0.40, TILE * 0.76),
        new THREE.MeshStandardMaterial({ color: 0xd2d6d8, roughness: 0.2, side: THREE.BackSide }));
      inner.position.y = 0.26; g.add(inner);
      /* the screen, only on the end that has a wall behind it */
      if (isSolidChar(at(x - 1, y)) || isSolidChar(at(x + 1, y))) {
        var sd = isSolidChar(at(x - 1, y)) ? -1 : 1;
        var scr = new THREE.Mesh(new THREE.PlaneGeometry(TILE * 0.88, 1.5), matGlassM);
        scr.position.set(sd * TILE * 0.44, 1.15, 0);
        scr.rotation.y = Math.PI / 2; g.add(scr);
        var head = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.05, 10), matChrome);
        head.position.set(sd * TILE * 0.40, 1.85, 0);
        head.rotation.z = sd * 0.5; g.add(head);
      }
      var rail = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, TILE * 0.6, 8), matChrome);
      rail.rotation.z = Math.PI / 2; rail.position.set(0, 0.92, -TILE * 0.44); g.add(rail);
      var towel = box(0.34, 0.46, 0.05,
        new THREE.MeshStandardMaterial({ color: 0xc8d4d0, roughness: 0.98,
          map: tex("cloth", 64, 1), bumpMap: bump("cloth", 64, 1), bumpScale: 0.3 }),
        0.16, 0.70, -TILE * 0.42, g);
      towel.rotation.z = 0.04;
      return g;
    }

    function toiletProp(x, y) {
      var g = propGroup(x, y);
      var white = new THREE.MeshStandardMaterial({ color: 0xeeece6, roughness: 0.16,
                                                   envMapIntensity: 1.5 });
      var pan = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.15, 0.40, 14), white);
      pan.position.set(0, 0.05, 0.06); pan.castShadow = true; g.add(pan);
      var seat = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.045, 8, 20), white);
      seat.rotation.x = -Math.PI / 2; seat.position.set(0, 0.27, 0.06); g.add(seat);
      box(0.40, 0.52, 0.20, white, 0, 0.11, -TILE * 0.28, g).material = white;
      box(0.34, 0.03, 0.03, matChrome, 0.10, 0.40, -TILE * 0.18, g);
      return g;
    }

    /* the basin with the mirror over it, which is where a bathroom reads */
    function basinProp(x, y) {
      var g = propGroup(x, y);
      var white = new THREE.MeshStandardMaterial({ color: 0xeeece6, roughness: 0.14,
                                                   envMapIntensity: 1.6 });
      var ped = new THREE.Mesh(new THREE.CylinderGeometry(0.10, 0.14, 0.62, 12), white);
      ped.position.set(0, 0.16, -TILE * 0.14); g.add(ped);
      var bowl = new THREE.Mesh(new THREE.SphereGeometry(0.26, 18, 12, 0, 6.2832, 0, 1.5), white);
      bowl.scale.set(1, 0.5, 0.8);
      bowl.rotation.x = Math.PI; bowl.position.set(0, 0.72, -TILE * 0.14);
      bowl.castShadow = true; g.add(bowl);
      var tap = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.22, 8), matChrome);
      tap.position.set(0, 0.84, -TILE * 0.30); g.add(tap);
      /* the mirror and the light over it */
      var fr = box(0.78, 0.92, 0.05, matPine, 0, 1.52, -TILE * 0.46, g);
      fr.material = matPine;
      var gl = new THREE.Mesh(new THREE.PlaneGeometry(0.70, 0.84), matGlassM);
      gl.position.set(0, 1.52, -TILE * 0.43); g.add(gl);
      var strip = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.05, 0.06),
        new THREE.MeshBasicMaterial({ color: 0xdfe8f4, toneMapped: false }));
      strip.position.set(0, 2.04, -TILE * 0.42); g.add(strip);
      world.lamps.push({ x: cx(x), y: 2.0, z: cz(y), colour: 0xcfe0f4, power: 1.1,
                         range: 5.0, kind: "static", tx: x, ty: y });
      return g;
    }

    /* the garage: a bench with a pegboard over it, and a rack of boxes */
    function workbench(x, y) {
      var g = propGroup(x, y);
      box(TILE * 0.96, 0.09, TILE * 0.62, matPine, 0, 0.86, 0, g);
      [-1, 1].forEach(function (s) {
        box(0.09, 0.90, 0.09, matPine, s * TILE * 0.42, 0.45, TILE * 0.24, g);
        box(0.09, 0.90, 0.09, matPine, s * TILE * 0.42, 0.45, -TILE * 0.24, g);
      });
      box(TILE * 0.90, 0.05, TILE * 0.50, matPine, 0, 0.36, 0, g);
      /* the pegboard */
      var pb = box(TILE * 0.96, 1.10, 0.05,
        surface("boards", { repeat: 1, rough: 0.9, tint: 0xc8a878 }), 0, 1.58, -TILE * 0.40, g);
      pb.material = surface("boards", { repeat: 1, rough: 0.9, tint: 0xc8a878 });
      for (var i = 0; i < 7; i++) {
        var t = hash2(x * 3 + i, y * 5);
        var tool = new THREE.Mesh(
          new THREE.BoxGeometry(0.035 + t * 0.03, 0.18 + t * 0.16, 0.03),
          new THREE.MeshStandardMaterial({ color: t > 0.5 ? 0x9aa0a8 : 0x6a4a30,
                                           roughness: 0.5, metalness: t > 0.5 ? 0.7 : 0.1 }));
        tool.position.set(-TILE * 0.38 + i * (TILE * 0.76 / 6), 1.58 + (t - 0.5) * 0.34, -TILE * 0.36);
        tool.castShadow = true; g.add(tool);
      }
      /* a vice on the end */
      var vice = box(0.20, 0.16, 0.14, matChrome, TILE * 0.30, 0.98, 0.02, g);
      vice.material = new THREE.MeshStandardMaterial({ color: 0x4a5058, roughness: 0.5, metalness: 0.6 });
      return g;
    }

    function shelving(x, y) {
      var g = propGroup(x, y);
      var W2 = TILE * 0.90, D2 = TILE * 0.40, H2 = 2.1;
      [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function (c) {
        box(0.06, H2, 0.06, matMetal, c[0] * W2 / 2, H2 / 2 - 0.15, -TILE * 0.28 + c[1] * D2 / 2, g);
      });
      for (var s = 0; s < 4; s++) {
        var sy = 0.10 + s * 0.60;
        box(W2, 0.04, D2, matMetal, 0, sy, -TILE * 0.28, g);
        var n = 1 + Math.floor(hash2(x + s, y * 3) * 3);
        for (var i = 0; i < n; i++) {
          var t = hash2(x * 7 + s * 3 + i, y);
          var bw = 0.24 + t * 0.22, bh = 0.20 + t * 0.20;
          var bx2 = box(bw, bh, D2 * 0.7,
            surface("cloth", { repeat: 1, rough: 0.95, tint: t > 0.5 ? 0xa8895e : 0x8a7a62 }),
            -W2 / 2 + 0.14 + i * (W2 - 0.28) / Math.max(1, n - 0.0001) * 0.9,
            sy + bh / 2 + 0.02, -TILE * 0.28, g);
          bx2.rotation.y = (t - 0.5) * 0.2;
        }
      }
      return g;
    }

    /* the console the television stands on */
    function mediaUnit(x, y) {
      var g = propGroup(x, y);
      box(TILE * 0.96, 0.52, TILE * 0.44, matPine, 0, 0.11, 0, g);
      box(TILE * 1.0, 0.05, TILE * 0.48, matPine, 0, 0.40, 0, g);
      [-1, 1].forEach(function (s) {
        box(TILE * 0.40, 0.30, 0.04, surface("boards", { repeat: 1, tint: 0xb89a72 }),
            s * TILE * 0.24, 0.10, TILE * 0.22, g);
        box(0.16, 0.025, 0.025, matChrome, s * TILE * 0.24, 0.10, TILE * 0.245, g);
      });
      /* a soundbar and a stack of cases */
      box(TILE * 0.70, 0.08, 0.10,
          new THREE.MeshStandardMaterial({ color: 0x2a2e34, roughness: 0.7 }), 0, 0.465, 0, g);
      for (var i = 0; i < 4; i++) {
        box(0.14, 0.02, 0.19,
            new THREE.MeshStandardMaterial({ color: [0x8a3a3a, 0x2f4a5e, 0x4a5a3a, 0x6a5a3a][i],
                                             roughness: 0.6 }),
            TILE * 0.34, 0.44 + i * 0.022, -0.02, g);
      }
      return g;
    }

    /* the empty bay: a painted outline and the stain of a car that stood
       on it for eleven years */
    function bayMark(x, y) {
      var g = new THREE.Group();
      g.position.set(cx(x), 0, cz(y));
      var paint = new THREE.MeshBasicMaterial({ color: 0xd8cc9a, transparent: true, opacity: 0.30 });
      [[0, -TILE * 0.46, TILE * 0.9, 0.08], [0, TILE * 0.46, TILE * 0.9, 0.08]].forEach(function (b) {
        if (at(x, y + (b[1] > 0 ? 1 : -1)) === "I") return;
        var m = new THREE.Mesh(new THREE.PlaneGeometry(b[2], b[3]), paint);
        m.rotation.x = -Math.PI / 2; m.position.set(b[0], 0.018, b[1]); g.add(m);
      });
      [-1, 1].forEach(function (s) {
        if (at(x + s, y) === "I") return;
        var m = new THREE.Mesh(new THREE.PlaneGeometry(0.08, TILE * 0.96), paint);
        m.rotation.x = -Math.PI / 2; m.position.set(s * TILE * 0.46, 0.018, 0); g.add(m);
      });
      var stain = new THREE.Mesh(new THREE.PlaneGeometry(TILE * 0.7, TILE * 0.7),
        new THREE.MeshBasicMaterial({ map: bloodTexture("pool"), color: 0x1a1a18,
          transparent: true, opacity: 0.55, depthWrite: false }));
      stain.rotation.x = -Math.PI / 2;
      stain.position.set((hash2(x, y) - 0.5) * 0.5, 0.019, (hash2(y, x) - 0.5) * 0.5);
      g.add(stain);
      G.add(g);
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
          case "V": vanity(x2, y2); break;
          case "k": bookshelf(x2, y2); break;
          case "E": deskProp(x2, y2); break;
          case "p": plantProp(x2, y2); break;
          case "a": wallArt(x2, y2); break;
          case "t": tableProp(x2, y2); break;
          case "e": chairProp(x2, y2); break;
          case "O": ovenProp(x2, y2); break;
          case "s": sinkUnit(x2, y2); break;
          case "R": bathProp(x2, y2); break;
          case "Z": toiletProp(x2, y2); break;
          case "m": basinProp(x2, y2); break;
          case "M": workbench(x2, y2); break;
          case "J": shelving(x2, y2); break;
          case "U": mediaUnit(x2, y2); break;
          case "I": bayMark(x2, y2); break;
          case "l": floorLamp(x2, y2); break;
          case "L": lampPost(x2, y2); break;
          case "d": case "D": case "P": door(x2, y2, c); break;
          case "G": gate(x2, y2); break;
          case "W": world.panelAt = { x: x2, y: y2 }; wirePanel(x2, y2); break;
          case "T": world.tvAt = { x: x2, y: y2 }; television(x2, y2); break;
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
    /* ---- the road itself ----
       A carriageway is a run of open ground two or more tiles wide. Down
       the middle of one goes a broken white line, along the edges of it a
       solid one, and where the camber takes the water there is a gully and
       a drain. Without them a road is a grey rectangle you happen to walk
       on. */
    if (outdoorLevel && (def.theme === "street" || def.theme === "road")) {
      var isRoad = function (x, y) { return at(x, y) === ","; };
      for (var ry = 1; ry < H - 1; ry++) {
        for (var rx = 1; rx < W - 1; rx++) {
          if (!isRoad(rx, ry)) continue;
          var vert = isRoad(rx, ry - 1) && isRoad(rx, ry + 1);
          var horz = isRoad(rx - 1, ry) && isRoad(rx + 1, ry);
          /* the centre line: down the middle of a run, dashed */
          if (vert && !horz) {
            var midV = !isRoad(rx - 1, ry) || !isRoad(rx + 1, ry);
            if (!midV && (ry % 2 === 0) && isRoad(rx - 1, ry) !== isRoad(rx + 1, ry)) { /* keep */ }
            if (isRoad(rx - 1, ry) && !isRoad(rx - 2, ry) && ry % 2 === 0) {
              B.paint.add(cx(rx) - TILE * 0.5, 0.016, cz(ry), 0.16, 1, TILE * 0.52, 0, 0xffffff);
            }
          }
          if (horz && !vert) {
            if (isRoad(rx, ry - 1) && !isRoad(rx, ry - 2) && rx % 2 === 0) {
              B.paint.add(cx(rx), 0.016, cz(ry) - TILE * 0.5, TILE * 0.52, 1, 0.16, 0, 0xffffff);
            }
          }
          /* the gutter line where the road meets the kerb */
          [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (d) {
            if (isRoad(rx + d[0], ry + d[1])) return;
            if (at(rx + d[0], ry + d[1]) === " ") return;
            B.paint.add(cx(rx) + d[0] * (TILE * 0.42), 0.016, cz(ry) + d[1] * (TILE * 0.42),
                        d[0] ? 0.10 : TILE * 0.96, 1, d[1] ? 0.10 : TILE * 0.96, 0,
                        shade(0xffffff, 0.72));
            /* and a drain in it every so often */
            if (hash2(rx * 13 + d[0], ry * 7 + d[1]) > 0.90) {
              B.drain.add(cx(rx) + d[0] * (TILE * 0.34), 0.02, cz(ry) + d[1] * (TILE * 0.34),
                          1, 1, 1, d[0] ? Math.PI / 2 : 0, 0xffffff);
            }
          });
        }
      }
    }

    /* Not every floor in a house is the same floor: the bathroom is
       tiled, the kitchen is tiled, the garage is a concrete slab. Laid
       over the boards rather than replacing them, which costs one plane
       a room. */
    if (def.floors) {
      def.floors.forEach(function (f) {
        var pl = new THREE.Mesh(
          new THREE.PlaneGeometry((f[2] - f[0] + 1) * TILE, (f[3] - f[1] + 1) * TILE),
          surface(f[4], { size: 512, repeat: Math.max(2, (f[2] - f[0] + 1) * 0.7),
                          rough: f[4] === "block" ? 0.94 : 0.36, tint: f[5],
                          envInt: f[4] === "block" ? 0.3 : 1.1 }));
        pl.rotation.x = -Math.PI / 2;
        pl.position.set((cx(f[0]) + cx(f[2])) / 2, 0.012, (cz(f[1]) + cz(f[3])) / 2);
        pl.receiveShadow = true;
        G.add(pl);
      });
    }

    /* ---- the state of the place ----
       Pools where somebody went down, drags where something was pulled
       along a corridor, spatter up the wall by the doors. Heaviest in the
       wards and at the doors, because that is where people were when it
       started. Three instanced meshes for the whole building. */
    if (def.fairy) {
      def.fairy.forEach(function (f) {
        var g2 = new THREE.Group();
        var n = Math.max(2, Math.round(Math.hypot(f[2] - f[0], f[3] - f[1])) * 3);
        var bulbGeo = new THREE.SphereGeometry(0.035, 6, 5);
        for (var i = 0; i <= n; i++) {
          var t = i / n;
          var sag = Math.sin(t * Math.PI) * 0.16;
          var b = new THREE.Mesh(bulbGeo, new THREE.MeshBasicMaterial({
            color: i % 3 === 0 ? 0xffd6a0 : i % 3 === 1 ? 0xffeccc : 0xffc888,
            toneMapped: false }));
          b.position.set(cx(f[0]) + (cx(f[2]) - cx(f[0])) * t, f[4] - sag,
                         cz(f[1]) + (cz(f[3]) - cz(f[1])) * t);
          g2.add(b);
        }
        G.add(g2);
        world.lamps.push({ x: (cx(f[0]) + cx(f[2])) / 2, y: f[4],
                           z: (cz(f[1]) + cz(f[3])) / 2, colour: 0xffcf9a,
                           power: 0.55, range: 6.0, kind: "static",
                           tx: f[0], ty: f[1] });
      });
    }

    if (def.blood) {
      var pools = [], drags = [], spats = [];
      for (var by = 1; by < H - 1; by++) {
        for (var bx = 1; bx < W - 1; bx++) {
          var bc = at(bx, by);
          if (bc === " " || isSolidChar(bc)) continue;
          /* how likely this tile is to have something on it */
          var near = 0;
          for (var ny = -1; ny <= 1; ny++) {
            for (var nx = -1; nx <= 1; nx++) {
              var nc = at(bx + nx, by + ny);
              if (nc === "B") near += 1.0;         /* a bed */
              else if (nc === "y" || nc === "Y") near += 0.7;
              else if (nc === "d" || nc === "P" || nc === "D") near += 0.9;
              else if (nc === "h") near += 0.35;
            }
          }
          var r1 = hash2(bx * 131 + 7, by * 57 + 3);
          var chance = 0.045 + near * 0.10;
          if (r1 > chance) continue;
          var jx = (hash2(bx, by * 3) - 0.5) * TILE * 0.55;
          var jz = (hash2(bx * 5, by) - 0.5) * TILE * 0.55;
          var rot = hash2(bx * 3, by * 7) * 6.2832;
          var sc = 0.7 + hash2(bx * 11, by * 13) * 1.5;
          var dark = 0.55 + hash2(bx * 17, by * 19) * 0.45;
          var pick = hash2(bx * 23, by * 29);
          var slot = pick < 0.24 ? drags : (pick < 0.40 ? spats : pools);
          slot.push([cx(bx) + jx, cz(by) + jz, rot, sc, dark]);
        }
      }
      [["pool", pools, 0.020], ["drag", drags, 0.021], ["spatter", spats, 0.022]]
        .forEach(function (set) {
          if (!set[1].length) return;
          var mesh = new THREE.InstancedMesh(
            new THREE.PlaneGeometry(TILE * 0.95, TILE * 0.95),
            new THREE.MeshBasicMaterial({
              map: bloodTexture(set[0]), transparent: true, depthWrite: false,
              opacity: 0.92, toneMapped: true, polygonOffset: true,
              polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
            set[1].length);
          var mm = new THREE.Matrix4(), qq = new THREE.Quaternion(),
              ee = new THREE.Euler(), vv = new THREE.Vector3(), sv = new THREE.Vector3();
          var cl = new THREE.Color();
          set[1].forEach(function (d3, i3) {
            ee.set(-Math.PI / 2, 0, d3[2]);
            qq.setFromEuler(ee);
            vv.set(d3[0], set[2], d3[1]);
            sv.set(d3[3], set[0] === "drag" ? d3[3] * 1.9 : d3[3], 1);
            mm.compose(vv, qq, sv);
            mesh.setMatrixAt(i3, mm);
            cl.setRGB(d3[4], d3[4] * 0.94, d3[4] * 0.94);
            mesh.setColorAt(i3, cl);
          });
          mesh.instanceMatrix.needsUpdate = true;
          if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
          mesh.renderOrder = 2;
          mesh.frustumCulled = true;
          mesh.computeBoundingSphere();
          G.add(mesh);
        });
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
          if (r0 > 0.86) {
            var ln = 1 + Math.floor(hash2(dy, dx) * 3);
            for (var l = 0; l < ln; l++) {
              var ls = 0.07 + hash2(l, dx) * 0.11;
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

    /* the batches that were handed a material rather than making one */
    Object.keys(B).forEach(function (k) {
      if (B[k].m && B[k].m.isMeshStandardMaterial) occlude(B[k].m);
    });
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
    spot.shadow.mapSize.set(1024, 1024);
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
    if (e.code === "KeyM" || e.code === "Tab") {
      e.preventDefault();
      if (G && G.state === "map") { closeOverlay(); G.state = "play"; }
      else showMap();
      return;
    }
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
  /* The chapter has four skies: dawn at the gates, dusk on the road out,
     and night everywhere else in each place's own colours. Naming them
     means the reflection cube for each can be built once. */
  function skyFor(def) {
    var sky = makeSky();
    if (def.id === "gates") {
      sky.u.cLow.value.set(0xffbe86); sky.u.cMid.value.set(0x87a8d8); sky.u.cHigh.value.set(0x2f5c9e);
      sky.u.sunCol.value.set(0xffe0a0); sky.u.sunAmt.value = 0.85;
      sky.u.sunDir.value.set(-0.5, 0.16, 0.8).normalize();
      return { sky: sky, key: "dawn" };
    }
    if (def.id === "roadside" || def.id === "campsite") {
      sky.u.cLow.value.set(0xd8834e); sky.u.cMid.value.set(0x6a5a92); sky.u.cHigh.value.set(0x141c40);
      sky.u.sunCol.value.set(0xffb070); sky.u.sunAmt.value = 0.62;
      sky.u.sunDir.value.set(0.7, 0.10, 0.6).normalize();
      return { sky: sky, key: "dusk" };
    }
    var pal = PAL[def.theme] || PAL.house;
    sky.u.cLow.value.set(pal.fogNear); sky.u.cMid.value.set(pal.sky);
    sky.u.cHigh.value.set(shade(pal.sky, 0.45));
    sky.u.sunCol.value.set(0xbcd0ff); sky.u.sunAmt.value = 0.18;
    sky.u.sunDir.value.set(-0.4, 0.35, -0.7).normalize();
    return { sky: sky, key: "night:" + (def.theme || "house") };
  }

  function makeScene(def) {
    var pal = PAL[def.theme] || PAL.house;
    var scene = new THREE.Scene();

    /* fog: the thing that makes the dark feel like it has weight */
    var fogCol = new THREE.Color(pal.fogNear);
    scene.fog = new THREE.FogExp2(fogCol.getHex(), def.dark > 0.6 ? 0.020 : def.dark > 0.4 ? 0.013 : 0.0075);
    scene.background = new THREE.Color(pal.sky);

    var made = skyFor(def), sky = made.sky;
    var night = def.dark > 0.45;
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
        scene.environment = cubeFor(made.key, sky, pal, def.dark);
        scene.environmentIntensity = def.dark > 0.55 ? 0.42 : def.dark > 0.4 ? 0.7 : 1.0;
      } catch (e) { /* an old card without float textures: no reflections, still plays */ }
    }

    return { scene: scene, sky: sky, stars: stars, moon: moon };
  }

  function enterLevel(def, opts) {
    opts = opts || {};
    closeOverlay();
    /* Let the old level go before building the new one. Building first and
       tearing down after meant both were resident at once, which doubles
       the peak and makes rendering the new reflection cube far slower than
       it is with the old scene already gone. */
    if (G && G.scene) teardownLevel();
    /* a line left on the screen from the last place is not narration, it
       is a leak */
    if (G) G.dlg = null;
    var dbox = $("ap-dlg");
    if (dbox) dbox.setAttribute("aria-hidden", "true");
    warmCubes();
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

    /* the ones the hospital will let in later, built now while there is a
       loading card on the screen to hide it */
    var spare = [];
    if (def.pressure) {
      for (var sp = 0; sp < (def.pressureMax || 5); sp++) {
        var sr = makeZombie(200 + sp * 7);
        sr.root.visible = false;
        built.scene.add(sr.root);
        spare.push(sr);
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
        /* the two on the gate are spoken to; the rest are scenery */
        var far = !(p2.kind === "guard" && i < 2);
        var rig = p2.kind === "guard" ? makeGuard(i + 1, far) : makeCivilian(i + 3, far);
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

    G = G || {};
    G.def = def;
    G.scene = built.scene;
    G.sky = built.sky; G.stars = built.stars; G.moon = built.moon;
    G.world = world;
    G.player = player;
    G.zombies = zombies;
    G.spare = spare;
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
    G.hasMap = G.hasMap || def.id !== "home";
    G.__lobby = false;
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
    /* the broadcast is painted into a canvas of its own, one per house */
    if (G.world && G.world.tvTexture) {
      try { G.world.tvTexture.dispose(); } catch (e) {}
      G.world.tvTexture = null;
    }
    disposeScene(G.scene);
    G.scene = null;
  }

  /* Building one of these is 30,000 triangles of sculpting, skinning and
     rot — a tenth of a second, easily. Doing it inside a frame is what was
     locking the game up for a beat every time the hospital filled. Nothing
     calls makeZombie during play any more: the level builds every body it
     will ever need up front and this hands them out. */
  function makeZ(world, scene, tx, ty, seed, forceKind, prebuilt) {
    var kinds = ["idle", "patrol", "patrol", "drawn"];
    var kind = forceKind || kinds[seed % kinds.length];
    var rig = prebuilt || makeZombie(seed);
    if (!prebuilt) scene.add(rig.root);
    rig.root.visible = true;
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
  /* a band that fades to nothing at both of its edges */
  function ringTexture() {
    if (TEX.__ring) return TEX.__ring;
    var s = 64, cc = canvas2d(s), x = cc.x;
    var g = x.createLinearGradient(0, 0, 0, s);
    g.addColorStop(0.00, "rgba(255,255,255,0)");
    g.addColorStop(0.34, "rgba(255,255,255,0.10)");
    g.addColorStop(0.72, "rgba(255,255,255,0.85)");
    g.addColorStop(0.90, "rgba(255,255,255,0.30)");
    g.addColorStop(1.00, "rgba(255,255,255,0)");
    x.fillStyle = g; x.fillRect(0, 0, s, s);
    var t = new THREE.CanvasTexture(cc.c);
    t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
    TEX.__ring = t;
    return t;
  }

  function noiseRing(x, z, r) {
    if (!G.scene) return;
    var ring = null;
    for (var i = 0; i < ringPool.length; i++) if (!ringPool[i].live) ring = ringPool[i];
    if (!ring) {
      /* It was a hard-edged wire circle, forty segments of it, drawn in
         additive white — a debug overlay somebody forgot to take out. It
         is a soft band now, wide and faint, on a gradient that has no edge
         to catch the eye. */
      var m = new THREE.Mesh(
        geo("noiseRing", function () { return new THREE.RingGeometry(0.40, 1.0, 64); }),
        new THREE.MeshBasicMaterial({ map: ringTexture(), color: 0x9ec4ff,
          transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false,
          blending: THREE.AdditiveBlending, toneMapped: false, fog: false }));
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
    updateWind(dt);
    for (var i = 0; i < ringPool.length; i++) {
      var q = ringPool[i];
      if (!q.live) continue;
      q.t += dt / 0.85;
      if (q.t >= 1) { q.live = false; q.mesh.visible = false; continue; }
      var e = 1 - Math.pow(1 - q.t, 3);
      q.mesh.scale.setScalar(0.2 + e * q.r);
      q.mesh.material.opacity = 0.20 * (1 - q.t) * (1 - q.t);
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
    G.alertT = (G.alertT || 0) - dt;

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
        /* when three of them turn round together you should hear one
           thing happen, not three stings on top of each other */
        if (G.alertT <= 0) {
          G.alertT = 1.8;
          Audio_.alert(dist);
          G.camRig.kick(0.05);
        }
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

      /* it is only worth drawing what she could plausibly perceive, and
         only worth shadowing what is close enough for the shadow to be
         more than a smudge */
      var vis = dist < 34;
      if (z.rig.root.visible !== vis) z.rig.root.visible = vis;
      /* hysteresis, or one walking back and forth across the boundary
         rebuilds the shadow map every other frame */
      if (z.rig.setShadow) z.rig.setShadow(z.rig.shadowOn ? dist < 19 : dist < 16);

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
    /* a caption leaves the overlay click-through and bottom-aligned; if one
       was up when this opened, the buttons on it would be unpressable */
    o.style.background = "";
    o.style.alignItems = "";
    o.style.justifyContent = "";
    o.style.paddingBottom = "";
    o.style.pointerEvents = "";
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

  /* ---- the compass ----
     "South to the river, then east along it" is only an instruction if
     south and east mean something on the screen. The camera never turns,
     so the card does not either: north is up the screen and east is to the
     right, always, and this says so. The needle points at whatever the
     current step is asking for, and the number under it is how far. */
  var COMPASS_LAST = "";
  function updateCompass() {
    var el2 = $("ap-compass");
    if (!el2) return;
    var show = G && G.player && G.world && G.state === "play" && G.hasMap && !G.cine;
    el2.setAttribute("aria-hidden", show ? "false" : "true");
    if (!show) return;
    var tgt = objectiveTile();
    var needle = $("ap-compass-needle"), lab = $("ap-compass-dist");
    if (!tgt) {
      if (needle) needle.style.opacity = "0";
      if (lab) lab.textContent = "";
      return;
    }
    var w = G.world;
    var dx = w.cx(tgt.x) - G.player.x, dz = w.cz(tgt.y) - G.player.z;
    /* screen up is -z and screen right is +x, so a bearing measured from
       north clockwise is atan2(east, -south) */
    var deg = Math.atan2(dx, -dz) * 180 / Math.PI;
    if (needle) {
      needle.style.opacity = "1";
      needle.style.transform = "rotate(" + deg.toFixed(1) + "deg)";
    }
    var m = Math.round(Math.hypot(dx, dz));
    var word = Math.abs(deg) < 22.5 ? "N" : Math.abs(deg) > 157.5 ? "S"
             : deg > 0 ? (deg < 67.5 ? "NE" : deg < 112.5 ? "E" : "SE")
             : (deg > -67.5 ? "NW" : deg > -112.5 ? "W" : "SW");
    var txt = word + " " + m + "m";
    if (lab && txt !== COMPASS_LAST) { lab.textContent = txt; COMPASS_LAST = txt; }
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
    var mb2 = $("ap-map-btn");
    if (mb2) mb2.style.display = G.hasMap ? "" : "none";
    var stage = $("ap-stage");
    if (stage) stage.classList.toggle("ap-hiding", !!(G.player && G.player.hidden));
  }

  /* how close the nearest one is, when she cannot see it yet */
  /* Wind, which was written into the sound bank a long time ago and wired
     to nothing. Outdoors only, in gusts rather than on a metronome. */
  var gustAt = 0;
  function updateWind(dt) {
    if (!G || !G.world || !G.world.outdoor || G.state !== "play") return;
    gustAt -= dt;
    if (gustAt > 0) return;
    gustAt = rnd(5.5, 13.0);
    Audio_.wind();
  }

  function updateInstinct() {
    updateCut();
    updateCompass();
    if (G && G.world && G.state === "play") markSeen();
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

  /* one line per press, whatever pressed it */
  var lastAdvance = 0;
  function advanceLine() {
    if (!G || !G.dlg) return;
    var now = (window.performance && performance.now) ? performance.now() : Date.now();
    if (now - lastAdvance < 180) return;
    lastAdvance = now;
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
      /* The narrator and the people in the room are not the same voice and
         should not arrive in the same box: narration is a line of prose
         across the foot of the screen, and somebody speaking is a plate
         with their name on it, on their own side. */
      box.className = "ap-dlg" +
        (quiet ? " quiet" : speaker ? " speech" : " narration") +
        (speaker === "OUISSY" ? " her" : speaker ? " them" : "");
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

  /* =========================================================
     THE MAP
     She took a road atlas off the shelf on the way out of the
     garage, and after that she has one. It draws the level she
     is standing in from the same grid the world was built from,
     greys out everything she has not walked past yet, and puts
     an arrow on the thing the current step is asking for. Above
     it, the four places of the chapter and which one she is in,
     because "south, then east" means nothing without them.
     ========================================================= */
  var CHAPTER_MAP = [
    { id: "home",     name: "HOME",           note: "Tuesday. Portugal." },
    { id: "streets",  name: "THE CITY",       note: "South to the river, east along it." },
    { id: "hospital", name: "MERCY GENERAL",  note: "Ward C, east wing." },
    { id: "escape",   name: "THE ROAD",       note: "Out through the ambulance bay." },
    { id: "gates",    name: "ASHCOMBE",       note: "North road, past the reservoir." }
  ];

  /* which tiles she has been near enough to have seen */
  function markSeen() {
    var w = G.world;
    if (!w) return;
    if (!w.seen) w.seen = new Uint8Array(w.w * w.h);
    var px = Math.round((G.player.x / TILE) - 0.5 + w.w / 2);
    var py = Math.round((G.player.z / TILE) - 0.5 + w.h / 2);
    px = Math.round(w.tx ? w.tx(G.player.x) : px);
    py = Math.round(w.ty ? w.ty(G.player.z) : py);
    var R = 5;
    for (var dy = -R; dy <= R; dy++) {
      for (var dx = -R; dx <= R; dx++) {
        if (dx * dx + dy * dy > R * R) continue;
        var x = px + dx, y = py + dy;
        if (x < 0 || y < 0 || x >= w.w || y >= w.h) continue;
        w.seen[y * w.w + x] = 1;
      }
    }
  }

  /* where the current step wants her to go */
  function objectiveTile() {
    var w = G.world, s = step();
    if (!w || !s) return null;
    if (s.clears === "car") return w.carAt || w.exit;
    if (s.clears === "horse") return w.horseAt || w.exit;
    if (s.clears === "exit") return w.exit;
    if (s.clears === "anwar") return w.anwarAt;
    if (s.clears === "panel") return w.panelAt;
    if (s.clears === "tv") return w.tvAt;
    return w.exit;
  }

  function showMap() {
    if (!G || !G.world || !G.hasMap) return;
    if (G.state !== "play") return;
    var w = G.world;
    var wrap = el("div", "ap-map");
    wrap.appendChild(el("p", "ap-map-title", "THE ROUTE"));

    /* the chapter, as five stops on a line */
    var chain = el("div", "ap-map-chain");
    var hereIdx = 0;
    CHAPTER_MAP.forEach(function (c, i) { if (c.id === G.def.id) hereIdx = i; });
    CHAPTER_MAP.forEach(function (c, i) {
      var s2 = el("span", "ap-map-stop" + (i === hereIdx ? " here" : i < hereIdx ? " past" : ""));
      s2.appendChild(el("b", "", c.name));
      s2.appendChild(el("i", "", i === hereIdx ? c.note : ""));
      chain.appendChild(s2);
    });
    wrap.appendChild(chain);

    /* and the floor she is standing on */
    var cv = document.createElement("canvas");
    var cell = clamp(Math.floor(560 / w.w), 4, 13);
    cv.className = "ap-map-canvas";
    cv.width = w.w * cell; cv.height = w.h * cell;
    var x2 = cv.getContext("2d");
    x2.fillStyle = "#0b0f16"; x2.fillRect(0, 0, cv.width, cv.height);
    for (var y = 0; y < w.h; y++) {
      for (var x = 0; x < w.w; x++) {
        var c = w.at(x, y);
        if (c === " ") continue;
        var seen = w.seen && w.seen[y * w.w + x];
        var solid = isSolidChar(c);
        var col;
        if (!seen) col = solid ? "#161b24" : "#11161e";
        else if (solid) col = "#3c4757";
        else if (c === "h") col = "#2b4a52";
        else if (c === "d" || c === "P" || c === "D" || c === "G") col = "#6a5a2e";
        else col = "#233040";
        x2.fillStyle = col;
        x2.fillRect(x * cell, y * cell, cell - 1, cell - 1);
      }
    }
    /* the thing she is looking for, and her */
    var tgt = objectiveTile();
    if (tgt) {
      x2.fillStyle = "#8affc8";
      x2.fillRect(tgt.x * cell - 1, tgt.y * cell - 1, cell + 1, cell + 1);
      x2.strokeStyle = "rgba(138,255,200,.55)";
      x2.lineWidth = 2;
      x2.beginPath();
      x2.arc(tgt.x * cell + cell / 2, tgt.y * cell + cell / 2, cell * 1.9, 0, 6.2832);
      x2.stroke();
    }
    var hx = Math.round(w.tx(G.player.x)), hy = Math.round(w.ty(G.player.z));
    x2.fillStyle = "#ffd88a";
    x2.beginPath();
    x2.arc(hx * cell + cell / 2, hy * cell + cell / 2, Math.max(2.5, cell * 0.46), 0, 6.2832);
    x2.fill();
    if (tgt) {
      /* the way to it, in words, because an arrow on its own is not a hint */
      var ddx = tgt.x - hx, ddy = tgt.y - hy;
      var bits = [];
      if (Math.abs(ddy) > 2) bits.push(ddy > 0 ? "south" : "north");
      if (Math.abs(ddx) > 2) bits.push(ddx > 0 ? "east" : "west");
      wrap.appendChild(el("p", "ap-map-dir",
        bits.length ? "From here: " + bits.join(", then ") + "." : "You are on top of it."));
      /* and the arrow */
      var a3 = Math.atan2(ddy, ddx);
      x2.strokeStyle = "rgba(255,216,138,.7)"; x2.lineWidth = 2;
      x2.beginPath();
      x2.moveTo(hx * cell + cell / 2, hy * cell + cell / 2);
      x2.lineTo(hx * cell + cell / 2 + Math.cos(a3) * cell * 3.2,
                hy * cell + cell / 2 + Math.sin(a3) * cell * 3.2);
      x2.stroke();
    }
    wrap.appendChild(cv);
    var b = el("button", "ap-card-go", "CLOSE");
    b.addEventListener("click", function () { closeOverlay(); G.state = "play"; });
    wrap.appendChild(b);
    openOverlay(wrap);
    G.state = "map";
    Audio_.tune();
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
    wrap.appendChild(el("p", "ap-tv-cap", "It has been saying the same things since before she woke up."));
    var b = el("button", "ap-card-go", "TURN IT OFF");
    b.addEventListener("click", function () {
      G.__tv = null;
      closeOverlay();
      Audio_.static(0.3, 0.07);
      say(TALK.tv, function () { clearStep("tv"); });
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
          /* the shutter goes up on an empty bay, which is the moment the
             rest of this chapter becomes a walk */
          if (G.def.id === "home") emptyGarage();
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
    G.pressure = clamp(G.zombies.length / 14, 0, 1);
    Audio_.pressure(G.pressure);
    if (G.pressureT >= G.def.pressure && G.spare && G.spare.length) {
      G.pressureT = 0;
      var w = G.world;
      /* they come in the front, which is the bottom of the map, and they
         come in a long way from wherever she is standing */
      var entry = nearestFree(w, Math.floor(w.w / 2), w.h - 3);
      var ex = w.cx(entry.x), ez = w.cz(entry.y);
      if (Math.hypot(ex - G.player.x, ez - G.player.z) < TILE * 7) return;
      var z = makeZ(w, G.scene, entry.x, entry.y, G.zombies.length + 7, "drawn",
                    G.spare.pop());
      z.state = "calm";
      z.timer = rnd(1.4, 3.4);
      G.zombies.push(z);
      Audio_.thump(0.045);
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

  /* The empty garage. She goes down there for the car and it is in long
     stay at the airport, which is the reason the whole chapter is on foot
     — and the reason he says "you walked here" when she finds him. */
  function emptyGarage() {
    if (G.__garage) return;
    G.__garage = true;
    say(TALK.garage, function () { G.hasMap = true; setHud(); });
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
  /* A cut is built while the level it is cutting away from is still
     resident, and rendering a fresh reflection cube in that state costs
     thirty seconds — where the same call inside a level build, with the
     old scene already gone, costs forty milliseconds. So a cut borrows
     the level's cube. Two night skies reflect close enough alike that
     nothing in a driving shot can tell, and it does not own what it
     borrows, so tearing the cut down leaves the level's intact. */
  function cineEnvironment(scene, sky, palName, dark) {
    if (!Stage.renderer) return;
    try {
      if (G && G.scene && G.scene.environment) {
        scene.environment = G.scene.environment;
        scene.environmentIntensity = dark > 0.55 ? 0.5 : 0.95;
        return;
      }
      scene.environment = cubeFor("night:" + palName, sky, PAL[palName] || PAL.street, dark);
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
    var cmp = $("ap-compass");
    if (cmp) cmp.setAttribute("aria-hidden", "true");
    Stage.attach(c.scene, c.camera);
    try { Stage.renderer.compile(c.scene, c.camera); } catch (e) {}
    Stage.grade(c.grade || {});
    Stage.grade({ fade: 1 });
    G.fade = 1; G.fadeTo = 1;
    /* `lines` is [seconds, speaker, text] — a scene can talk over itself
       instead of holding one caption for its whole length */
    c.__line = -1;
    caption(c.caption || "");
  }

  function cineCaption(c) {
    if (!c.lines) return;
    var i = -1;
    for (var k = 0; k < c.lines.length; k++) if (c.t >= c.lines[k][0]) i = k;
    if (i === c.__line) return;
    c.__line = i;
    if (i < 0) { caption(c.caption || ""); return; }
    var L = c.lines[i];
    caption(L[1] ? L[1] + "  —  " + L[2] : L[2]);
  }

  function disposeScene(scene) {
    if (!scene) return;
    scene.environment = null;          /* shared between scenes: not ours */
    var shared = [];
    for (var k in GEO) shared.push(GEO[k]);
    scene.traverse(function (o) {
      if (o.geometry && shared.indexOf(o.geometry) < 0 && o.geometry.dispose) o.geometry.dispose();
      if (o.isInstancedMesh && o.dispose) o.dispose();
      /* A light that casts owns a depth texture, and nothing was giving
         those back: two or three per level, for the length of a session.
         Geometry was already being freed — this was the whole of it. */
      if (o.isLight && o.shadow && o.shadow.map) {
        try { o.shadow.map.dispose(); } catch (e) {}
        o.shadow.map = null;
      }
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
  /* ---- the country they are driving through ----
     This was three flat shapes in three flat colours, unlit and unhazed —
     cardboard cut-outs standing behind the road, which is exactly what it
     looked like. Distance is not a darker colour, it is less contrast and
     more sky: the further a ridge is, the more of the sky's own colour is
     mixed into it, and the more of that mix happens at the top of the
     ridge rather than the bottom. Six layers of it, each with its own kind
     of country on it, and the whole thing washed with the sky it stands
     against. */
  function landscape(scene, opts) {
    var skyC = new THREE.Color(opts.sky == null ? 0x2a3350 : opts.sky);
    var groundC = new THREE.Color(opts.near == null ? 0x2c3450 : opts.near);
    var farC = new THREE.Color(opts.far == null ? 0x1a2038 : opts.far);
    var treeC = new THREE.Color(opts.tree == null ? 0x141a2c : opts.tree);

    /* z, ridge height, roughness, how far it has faded into the sky, how
       many trees stand on it, how big they are */
    var LAYERS = [
      { z: -290, amp: 78, rough: 0.20, haze: 0.80, trees:  0, ts: 0 },
      { z: -226, amp: 62, rough: 0.34, haze: 0.66, trees: 34, ts: 0.7 },
      { z: -172, amp: 48, rough: 0.52, haze: 0.52, trees: 44, ts: 0.9 },
      { z: -124, amp: 36, rough: 0.72, haze: 0.38, trees: 52, ts: 1.1 },
      { z:  -84, amp: 26, rough: 0.92, haze: 0.24, trees: 54, ts: 1.4 },
      { z:  -52, amp: 17, rough: 1.10, haze: 0.11, trees: 44, ts: 1.8 }
    ];

    var built = null;
    LAYERS.forEach(function (L, li) {
      var span = 2600, N = 200;
      var seed = li * 37.1;
      var pts = [];
      for (var i = 0; i <= N; i++) {
        var u = i / N, x = -span / 2 + u * span;
        /* four octaves: the shape of the land, then the shape of what is
           on it */
        var y = Math.sin(u * 3.1 + seed) * L.amp * 0.52
              + Math.sin(u * 7.7 + seed * 1.7) * L.amp * 0.26
              + Math.sin(u * 17.3 + seed * 2.3) * L.amp * 0.13 * L.rough
              + Math.sin(u * 41.0 + seed * 3.1) * L.amp * 0.06 * L.rough;
        pts.push(new THREE.Vector2(x, y - 6));
      }

      var shape = new THREE.Shape();
      shape.moveTo(pts[0].x, -260);
      pts.forEach(function (p) { shape.lineTo(p.x, p.y); });
      shape.lineTo(pts[N].x, -260);
      shape.closePath();
      var geom = new THREE.ShapeGeometry(shape);

      /* the wash: sky at the skyline, the land's own colour underneath it,
         so a ridge has a lit edge and a body rather than being one flat
         fill */
      var base = farC.clone().lerp(groundC, 1 - L.haze);
      var top = base.clone().lerp(skyC, Math.min(0.94, L.haze + 0.14));
      var bot = base.clone().lerp(skyC, Math.max(0, L.haze - 0.16))
                    .multiplyScalar(0.72 + L.haze * 0.3);
      var pos = geom.attributes.position;
      var col = new Float32Array(pos.count * 3), c = new THREE.Color();
      /* how high this vertex is inside its own ridge */
      var hi = -1e9, lo = 1e9;
      for (var v = 0; v < pos.count; v++) {
        var yy = pos.getY(v);
        if (yy > -200) { if (yy > hi) hi = yy; if (yy < lo) lo = yy; }
      }
      for (var v2 = 0; v2 < pos.count; v2++) {
        var y2 = pos.getY(v2);
        var t = clamp((y2 - (lo - 40)) / Math.max(1, (hi - lo) + 40), 0, 1);
        c.copy(bot).lerp(top, t * t);
        col[v2 * 3] = c.r; col[v2 * 3 + 1] = c.g; col[v2 * 3 + 2] = c.b;
      }
      geom.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));

      var m = new THREE.Mesh(geom, new THREE.MeshBasicMaterial({
        vertexColors: true, fog: false }));
      m.position.z = L.z;
      m.renderOrder = -600 + li;
      scene.add(m);

      /* what grows on it, at the scale that layer is at, in that layer's
         haze — a treeline four hundred metres off is not the same black as
         one at fifty */
      if (!L.trees) return;
      var tc = treeC.clone().lerp(skyC, Math.min(0.9, L.haze + 0.06));
      var tg = new THREE.ConeGeometry(2.2, 8.4, 6);
      var im = new THREE.InstancedMesh(tg, new THREE.MeshBasicMaterial({
        color: tc, fog: false }), L.trees);
      var d = new THREE.Object3D();
      for (var t2 = 0; t2 < L.trees; t2++) {
        var ux = t2 / L.trees + (Math.random() - 0.5) * 0.02;
        var rx = -span / 2 + ux * span;
        /* stand them on the ridge rather than through it */
        var ry = Math.sin(ux * 3.1 + seed) * L.amp * 0.52
               + Math.sin(ux * 7.7 + seed * 1.7) * L.amp * 0.26
               + Math.sin(ux * 17.3 + seed * 2.3) * L.amp * 0.13 * L.rough - 6;
        var s2 = L.ts * rnd(0.62, 1.5);
        d.position.set(rx, ry + 8.4 * s2 * 0.42, L.z + rnd(-5, 5));
        d.scale.set(s2 * rnd(0.8, 1.3), s2, s2);
        d.rotation.set(0, Math.random() * 3, 0);
        d.updateMatrix(); im.setMatrixAt(t2, d.matrix);
      }
      im.renderOrder = -600 + li;
      im.frustumCulled = false;
      scene.add(im);
      built = im;
    });

    /* one thing on the skyline that is not a hill: a mast, because empty
       country with nothing built in it reads as a backdrop */
    var mastC = farC.clone().lerp(skyC, 0.55);
    var mast = new THREE.Group();
    [[0, 0], [0.9, 5.5], [-0.9, 5.5]].forEach(function (p, k) {
      var b2 = new THREE.Mesh(new THREE.BoxGeometry(k ? 0.5 : 0.9, k ? 22 : 34, 0.5),
        new THREE.MeshBasicMaterial({ color: mastC, fog: false }));
      b2.position.set(p[0] * 3, p[1] + (k ? 11 : 17), 0);
      mast.add(b2);
    });
    /* standing on the far ridge, not floating over it */
    mast.position.set(rnd(-260, 320), -26, -196);
    mast.renderOrder = -594;
    scene.add(mast);

    /* and cloud, in bands, because a gradient with nothing in it is a wall
       of paint however well graded it is */
    var cloudTex = (function () {
      if (TEX.__cloud) return TEX.__cloud;
      var s = 256, cc = canvas2d(s), x = cc.x;
      x.clearRect(0, 0, s, s);
      for (var i = 0; i < 34; i++) {
        var cx2 = s * (0.1 + Math.random() * 0.8), cy2 = s * (0.34 + Math.random() * 0.32);
        var r = s * (0.06 + Math.random() * 0.16);
        var gr = x.createRadialGradient(cx2, cy2, 0, cx2, cy2, r);
        gr.addColorStop(0, "rgba(255,255,255,.55)");
        gr.addColorStop(0.55, "rgba(255,255,255,.24)");
        gr.addColorStop(1, "rgba(255,255,255,0)");
        x.fillStyle = gr; x.beginPath(); x.arc(cx2, cy2, r, 0, 6.2832); x.fill();
      }
      var f = fbm(s, 5, 3, 13);
      var im2 = x.getImageData(0, 0, s, s), dd = im2.data;
      for (var q = 0, pp = 3; q < f.length; q++, pp += 4) dd[pp] = clamp(dd[pp] * (0.3 + f[q] * 1.5), 0, 255);
      x.putImageData(im2, 0, 0);
      var t3 = new THREE.CanvasTexture(cc.c);
      t3.wrapS = THREE.RepeatWrapping;
      TEX.__cloud = t3;
      return t3;
    })();
    var clouds = [];
    /* Low, wide and barely there. Bright cloud on a night sky is a smear;
       what you actually see at night is a slightly paler band with the
       stars going out behind it. */
    [[-340, 66, 0.16, 0.30, 5], [-268, 48, 0.24, 0.22, 4], [-206, 34, 0.34, 0.15, 3]]
      .forEach(function (C, ci) {
        var cm = new THREE.Mesh(new THREE.PlaneGeometry(2400, 96),
          new THREE.MeshBasicMaterial({
            map: cloudTex.clone(), transparent: true, depthWrite: false, fog: false,
            color: skyC.clone().lerp(new THREE.Color(0xffffff), C[2]),
            opacity: C[3] }));
        cm.material.map.wrapS = cm.material.map.wrapT = THREE.RepeatWrapping;
        cm.material.map.repeat.set(C[4], 1);
        cm.material.map.offset.x = ci * 0.37;
        cm.position.set(0, C[1], C[0]);
        cm.renderOrder = -612;
        scene.add(cm);
        clouds.push({ mesh: cm, drift: 0.004 + ci * 0.003 });
      });
    scene.userData.clouds = clouds;
    return built;
  }

  /* ---- what sits between the hills and the road ----
     Layers of ridge alone still read as flat, because in real country the
     air between you and them is doing something. Bands of mist lying in
     the dips, lit by whatever the sky is doing, and each one a little
     brighter and lower than the one behind it. This is the thing that
     turns a row of cut-outs into distance. */
  function groundMist(scene, opts) {
    var col = new THREE.Color(opts.colour == null ? 0x8fa0c0 : opts.colour);
    var tex2 = (function () {
      if (TEX.__mistband) return TEX.__mistband;
      var s = 256, cc = canvas2d(s), x = cc.x;
      x.clearRect(0, 0, s, s);
      var g = x.createLinearGradient(0, 0, 0, s);
      g.addColorStop(0.00, "rgba(255,255,255,0)");
      g.addColorStop(0.45, "rgba(255,255,255,.85)");
      g.addColorStop(0.72, "rgba(255,255,255,.55)");
      g.addColorStop(1.00, "rgba(255,255,255,0)");
      x.fillStyle = g; x.fillRect(0, 0, s, s);
      var f = fbm(s, 6, 3, 29);
      var im = x.getImageData(0, 0, s, s), d = im.data;
      for (var i = 0, p = 3; i < f.length; i++, p += 4) {
        d[p] = clamp(d[p] * (0.18 + f[i] * 1.9), 0, 255);
      }
      x.putImageData(im, 0, 0);
      var t = new THREE.CanvasTexture(cc.c);
      t.wrapS = THREE.RepeatWrapping;
      TEX.__mistband = t;
      return t;
    })();
    var bands = [];
    /* a scene whose own trees stand at sixty metres wants its mist to
       start beyond them, or the nearest band hangs in front of them as a
       pale panel */
    var skip = opts.skipNear || 0;
    [[-250, 16, 0.30, 6], [-190, 11, 0.38, 5], [-140, 7.5, 0.44, 4],
     [-96, 5.0, 0.46, 3], [-62, 3.2, 0.42, 3]].slice(0, 5 - skip).forEach(function (B, bi) {
      var m = new THREE.Mesh(new THREE.PlaneGeometry(2400, B[1] * 3.4),
        new THREE.MeshBasicMaterial({
          map: tex2.clone(), transparent: true, depthWrite: false, fog: false,
          color: col.clone().lerp(new THREE.Color(0xffffff), bi * 0.06),
          opacity: B[2] * (opts.amount == null ? 1 : opts.amount) }));
      m.material.map.wrapS = THREE.RepeatWrapping;
      m.material.map.repeat.set(B[3], 1);
      m.material.map.offset.x = bi * 0.31;
      m.position.set(0, B[1] * 0.42 - 3, B[0]);
      m.renderOrder = -590 + bi;
      scene.add(m);
      bands.push({ mesh: m, drift: 0.002 + bi * 0.0016 });
    });
    scene.userData.mist = bands;
    return bands;
  }

  /* a flock, because an empty dawn sky is a wall of paint. Not called
     `birds`: the sunrise already has a local of that name and it wins the
     hoist. */
  function flock(scene, opts) {
    var n = opts.count || 14;
    var g = new THREE.Group();
    var m = new THREE.MeshBasicMaterial({ color: opts.colour == null ? 0x2a2434 : opts.colour,
                                          fog: false, side: THREE.DoubleSide });
    var wings = [];
    for (var i = 0; i < n; i++) {
      var b = new THREE.Group();
      [1, -1].forEach(function (s) {
        var w = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.16), m);
        w.position.set(s * 0.75, 0, 0);
        w.rotation.y = s * 0.2;
        b.add(w);
      });
      b.position.set(rnd(-160, 160), rnd(26, 52), rnd(-150, -70));
      b.scale.setScalar(rnd(0.7, 1.5));
      b.userData.ph = Math.random() * 6.28;
      b.userData.sp = rnd(2.2, 4.4);
      g.add(b);
      wings.push(b);
    }
    g.renderOrder = -585;
    scene.add(g);
    scene.userData.birds = wings;
    return g;
  }

  function roadStrip(scene, opts) {
    var g = new THREE.Group();
    /* Poles, fencing and marker posts down both verges. Nothing sells the
       speed of a shot like something close going past, and a road with a
       verge and nothing standing in it reads as a treadmill. */
    (function () {
      var poleC = opts.pole || 0x2a2620;
      var poleM = new THREE.MeshStandardMaterial({ color: poleC, roughness: 0.9 });
      var wireM = new THREE.LineBasicMaterial({ color: 0x141414, fog: false });
      var poles = new THREE.InstancedMesh(
        (function () { var q = new THREE.CylinderGeometry(0.11, 0.16, 8.4, 6); q.translate(0, 4.2, 0); return q; })(),
        poleM, 46);
      var arms = new THREE.InstancedMesh(new THREE.BoxGeometry(1.9, 0.10, 0.10), poleM, 46);
      var d2 = new THREE.Object3D();
      var wirePts = [];
      for (var i = 0; i < 46; i++) {
        var px = -900 + i * 40 + rnd(-2, 2), pz = 11.5 + rnd(-0.6, 0.6);
        d2.position.set(px, 0, pz); d2.rotation.set(0, rnd(-0.05, 0.05), rnd(-0.03, 0.03));
        d2.scale.setScalar(rnd(0.94, 1.06));
        d2.updateMatrix(); poles.setMatrixAt(i, d2.matrix);
        d2.position.set(px, 7.7, pz); d2.rotation.set(0, 0, 0); d2.scale.setScalar(1);
        d2.updateMatrix(); arms.setMatrixAt(i, d2.matrix);
        /* the wire between them, sagging */
        if (i) {
          var ax = -900 + (i - 1) * 40, bx = px;
          for (var s3 = 0; s3 <= 6; s3++) {
            var u2 = s3 / 6;
            wirePts.push(new THREE.Vector3(ax + (bx - ax) * u2,
              7.6 - Math.sin(u2 * Math.PI) * 0.9, pz));
          }
        }
      }
      poles.castShadow = true;
      g.add(poles); g.add(arms);
      var wireG = new THREE.BufferGeometry().setFromPoints(wirePts);
      g.add(new THREE.Line(wireG, wireM));

      /* post-and-rail down the other side */
      var fp = new THREE.InstancedMesh(
        (function () { var q = new THREE.BoxGeometry(0.12, 1.15, 0.12); q.translate(0, 0.575, 0); return q; })(),
        new THREE.MeshStandardMaterial({ color: 0x3a3228, roughness: 0.95 }), 200);
      for (var f2 = 0; f2 < 200; f2++) {
        d2.position.set(-900 + f2 * 9, 0, -11.2 + rnd(-0.3, 0.3));
        d2.rotation.set(0, 0, rnd(-0.06, 0.06)); d2.scale.setScalar(rnd(0.9, 1.1));
        d2.updateMatrix(); fp.setMatrixAt(f2, d2.matrix);
      }
      g.add(fp);
      [0, 1].forEach(function (r2) {
        var rail = new THREE.Mesh(new THREE.BoxGeometry(1800, 0.09, 0.06),
          new THREE.MeshStandardMaterial({ color: 0x3a3228, roughness: 0.95 }));
        rail.position.set(0, 0.55 + r2 * 0.42, -11.2);
        g.add(rail);
      });

      /* marker posts at the edge of the carriageway, with a reflector on
         each one that catches the headlights */
      var mk = new THREE.InstancedMesh(
        (function () { var q = new THREE.BoxGeometry(0.10, 0.95, 0.06); q.translate(0, 0.48, 0); return q; })(),
        new THREE.MeshStandardMaterial({ color: 0xd8d4c8, roughness: 0.7 }), 90);
      var rf = new THREE.InstancedMesh(new THREE.BoxGeometry(0.09, 0.13, 0.02),
        new THREE.MeshStandardMaterial({ color: 0xff5a3a, roughness: 0.25, metalness: 0.1,
          emissive: new THREE.Color(0x501008), emissiveIntensity: 1 }), 90);
      for (var k2 = 0; k2 < 90; k2++) {
        var mx = -900 + k2 * 20, mz = 8.4;
        d2.position.set(mx, 0, mz); d2.rotation.set(0, 0, 0); d2.scale.setScalar(1);
        d2.updateMatrix(); mk.setMatrixAt(k2, d2.matrix);
        d2.position.set(mx, 0.74, mz - 0.05);
        d2.updateMatrix(); rf.setMatrixAt(k2, d2.matrix);
      }
      g.add(mk); g.add(rf);
    })();
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
    landscape(scene, { far: 0x121834, mid: 0x171d3a, near: 0x1c2340, tree: 0x0d1226,
                       sky: 0x141a34 });
    groundMist(scene, { colour: 0x2e3a5c, amount: 0.46 });
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
      /* Forty metres long and ten across reads as a beam from behind the
         car and as a grey wedge across half the picture from beside it,
         which is where the camera now is. Shorter, narrower, fainter, and
         it fades out along its length so it has an end. */
      var cg = new THREE.CylinderGeometry(0.22, 2.6, 24, 16, 4, true);
      cg.translate(0, -12, 0); cg.rotateZ(-Math.PI / 2);
      (function () {
        var pa = cg.attributes.position, cl = new Float32Array(pa.count * 3);
        for (var q = 0; q < pa.count; q++) {
          var f = clamp(1 - Math.abs(pa.getX(q)) / 24, 0, 1);
          f = f * f;
          cl[q * 3] = f; cl[q * 3 + 1] = f; cl[q * 3 + 2] = f;
        }
        cg.setAttribute("color", new THREE.Float32BufferAttribute(cl, 3));
      })();
      var cm = new THREE.MeshBasicMaterial({
        color: 0xffe8c0, transparent: true, opacity: 0.075, vertexColors: true,
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
      lines: [
        [0.0,  null,     "Out past the ring road, and then twenty miles of nobody."],
        [3.4,  "ANWAR",  "You didn't tell anybody you were coming."],
        [5.8,  "OUISSY", "There wasn't anybody to tell."],
        [8.0,  "ANWAR",  "Your mum and dad—"],
        [9.8,  "OUISSY", "Portugal. Since Tuesday. The line rings and then it stops ringing."],
        [13.0, "ANWAR",  "How bad was the walk."],
        [15.0, "OUISSY", "It was fine."],
        [16.6, "ANWAR",  "Ouissy."],
        [18.0, "OUISSY", "...Nine hours. I went round the park because the high street was—"],
        [21.4, "OUISSY", "It was fine. I'm here."],
        [23.4, null,     "He puts his hand flat on her arm and leaves it there. The needle has been under the line for an hour."],
        [26.6, null,     "It coughs twice and stops, and neither of them says anything."],
        [29.4, "ANWAR",  "Ashcombe's forty miles."],
        [31.0, "OUISSY", "Then we're walking again."]
      ],
      grade: { gradeCol: 0x4a6ab4, gradeAmt: 0.16, hazeCol: 0x141c34, hazeAmt: 0.34,
               vig: 0.8, sat: 1.0, fringe: 0.002, redPulse: 0, exposure: 1.0 },
      update: function (dt, t) {
        /* the tank going */
        if (t > 24.0 && !dead) { dead = true; }
        if (dead) speed = Math.max(0, speed - dt * 5.4);
        else speed = Math.min(34, speed + dt * 4);

        car.group.position.x += speed * dt;
        car.spin(speed * dt);
        car.group.position.y = Math.sin(t * 9) * 0.012 * (speed / 30);
        car.group.rotation.z = Math.sin(t * 3.1) * 0.006;

        /* The camera runs alongside and slightly behind, but it is being
           held rather than bolted on: a slow drift in and out, a little
           roll, and a shiver on the bad surface. It also settles lower and
           closer once the engine dies, because the shot changes meaning
           at that point and the framing should say so. */
        /* It sat almost directly behind the car, so the shot was the back
           of a boot with a road behind it. It travels beside them now,
           out on the verge and a little back — you see the flank of the
           car, both of them through the glass, the road running away in
           front, and the poles going past close to the lens, which is what
           makes thirty miles an hour look like thirty miles an hour.
           When the engine dies it drifts back and settles. */
        var cx0 = car.group.position.x;
        var settle = dead ? clamp((t - 24) / 6, 0, 1) : 0;
        var hold = Math.sin(t * 0.31) * 0.45 + Math.sin(t * 0.11 + 1.3) * 0.30;
        var jitter = (speed / 34) * 0.030;
        cam.position.set(
          cx0 - 3.2 + hold - settle * 4.5,
          2.55 + Math.sin(t * 0.5) * 0.10 + Math.sin(t * 19) * jitter + settle * 0.30,
          9.4 + Math.sin(t * 0.19) * 0.30 - settle * 1.6);
        cam.up.set(Math.sin(t * 0.23) * 0.010, 1, 0);
        cam.lookAt(cx0 + 1.2 + settle * 3.5, 1.15, settle * 0.6);

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

        if (dead && !steam && t > 25.4) {
          steam = makeFire();
          steam.userData.strength = 0.22;
          steam.scale.set(0.5, 0.5, 0.5);
          steam.position.set(1.5, 1.0, 0);
          car.group.add(steam);
          Audio_.static(1.2, 0.05);
        }
        if (steam) steam.userData.update(t, dt);

      },
      duration: 33.0,
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
    landscape(scene, { far: 0x6a5a80, mid: 0x4e4468, near: 0x33304e, tree: 0x241f38,
                       sky: 0x8a6a90 });
    groundMist(scene, { colour: 0xc0a0b4, amount: 0.82 });
    flock(scene, { count: 16, colour: 0x3a2c40 });
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
    /* The figures face +x and so does the horse, so turning them a quarter
       turn sat them side-saddle facing the verge — which is most of why
       this looked wrong. They face the way it is going now. */
    var her = makeOuissy(); her.root.scale.setScalar(0.92);
    her.root.position.set(0.34, 0.96, 0);
    horse.root.add(her.root);
    var him = makeAnwar(); him.root.scale.setScalar(0.92);
    him.root.position.set(-0.34, 0.95, 0);
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
    /* the country the clearing is in, rather than a black wall behind it */
    landscape(scene, { far: 0x111834, mid: 0x141c34, near: 0x18202e, tree: 0x0a0e18,
                       sky: 0x0c1226 });
    groundMist(scene, { colour: 0x24304e, amount: 0.62, skipNear: 2 });

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
    /* country behind the treeline, and the mist that is in it at that hour */
    landscape(scene, { far: 0x4a3f5e, mid: 0x3a3450, near: 0x2a2a42, tree: 0x171827,
                       sky: 0x3a3358 });
    groundMist(scene, { colour: 0xa88ea0, amount: 0.95, skipNear: 1 });
    flock(scene, { count: 18, colour: 0x241d2e });
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

    /* These were twenty-six points with no map on them, which a card draws
       as hard black squares — a scatter of dead pixels across a sunrise.
       The flock above has wings and beats them; this is gone. */
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

        /* the flock flies itself, from the cut's own tick */
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
    /* the crowd inside the fence: same rule */
    if (G.people && G.player) {
      for (var pi = 0; pi < G.people.length; pi++) {
        var pp = G.people[pi];
        if (!pp.rig.setShadow) continue;
        var pd = Math.hypot(pp.x - G.player.x, pp.z - G.player.z);
        pp.rig.setShadow(pp.rig.shadowOn ? pd < 19 : pd < 16);
        var pv = pd < 42;
        if (pp.rig.root.visible !== pv) pp.rig.root.visible = pv;
      }
    }
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

    /* the board over reception, read once, a beat after the card clears —
       hung off game time rather than a timer so it lands in the same place
       every run */
    if (!G.__lobby && G.def && G.def.id === "hospital" &&
        G.state === "play" && G.time > 0.9) {
      G.__lobby = true;
      say(TALK.lobby);
      return;
    }

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
      /* the sky is not a painting: the cloud bands crawl */
      var ud = G.cine.scene && G.cine.scene.userData;
      var cl = ud && ud.clouds;
      if (cl) for (var ci2 = 0; ci2 < cl.length; ci2++) {
        cl[ci2].mesh.material.map.offset.x += cl[ci2].drift * dt;
      }
      var mb = ud && ud.mist;
      if (mb) for (var mi = 0; mi < mb.length; mi++) {
        mb[mi].mesh.material.map.offset.x += mb[mi].drift * dt;
      }
      var bd = ud && ud.birds;
      if (bd) for (var bi2 = 0; bi2 < bd.length; bi2++) {
        var B2 = bd[bi2];
        B2.position.x += B2.userData.sp * dt;
        if (B2.position.x > 180) B2.position.x = -180;
        B2.children[0].rotation.z = Math.sin(G.cine.t * 7 + B2.userData.ph) * 0.6;
        B2.children[1].rotation.z = -Math.sin(G.cine.t * 7 + B2.userData.ph) * 0.6;
      }
      cineCaption(G.cine);
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
  /* =========================================================
     KEEPING SIXTY
     Render at the screen's own pixel ratio, and only give that
     up if the machine says it cannot hold the frame. Six rungs
     between full resolution and just over half; one step at a
     time, with a long wait after each so a spike cannot start
     an avalanche, and it climbs back up when there is room.

     It measures the median of the last two seconds rather than
     the mean, because one 40ms frame while a door opens is not
     the same problem as forty 20ms frames in a row.
     ========================================================= */
  var perfBuf = [], perfHold = 0, perfSince = 0;

  function watchPerformance(dt) {
    if (!Stage.ready || !Stage.renderer) return;
    perfHold -= dt;
    perfSince += dt;
    perfBuf.push(dt);
    if (perfBuf.length > 120) perfBuf.shift();
    /* Twenty-four frames is under two seconds at any rate worth calling
       playable. But a machine in real trouble may not manage twenty-four
       frames for half a minute, and waiting for them is exactly the wrong
       thing to do to it — so after three seconds it will act on whatever
       it has. */
    if (perfSince < 1.4) return;
    if (perfBuf.length < 6) return;
    if (perfBuf.length < 24 && perfSince < 3.0) return;
    perfSince = 0;

    var sorted = perfBuf.slice().sort(function (a, b) { return a - b; });
    var med = sorted[sorted.length >> 1];
    var p90 = sorted[Math.floor(sorted.length * 0.9)];
    if (perfHold > 0) return;

    /* 16.7ms is the budget; leave a little room either side of it so it
       does not sit on the boundary flipping between two rungs */
    if ((med > 0.0198 || p90 > 0.0290) && Stage.rung < RUNGS.length - 1) {
      perfStep(Stage.rung + 1, 4.5);
    } else if (med < 0.0140 && p90 < 0.0190 && Stage.rung > 0) {
      perfStep(Stage.rung - 1, 7.0);  /* slower to climb than to fall */
    }
  }

  function perfStep(rung, hold) {
    Stage.rung = rung;
    Stage.scale = RUNGS[rung];
    /* Near the bottom of the ladder, resolution alone is not enough: the
       heavier settings — the multisampling and the size of the bloom —
       come off too. Both cost a rebuild, so they ride along with a resize
       that was going to happen anyway. */
    var want = rung >= 5 ? 2 : rung >= 3 ? 1 : 0;
    if (want !== Stage.quality) {
      var scene = G && (G.cine ? G.cine.scene : G.scene);
      var cam = G && G.cine ? G.cine.camera : Stage.camera;
      Stage.setQuality(want, scene, cam);      /* resizes on its own */
    } else {
      Stage.resize(true);
    }
    perfHold = hold;
    perfBuf.length = 0;
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
    /* The Continue button is inside the box, and both of them had a click
       handler on them, so one press on the button ran nextLine twice and
       every second line of the conversation went past unseen — which is
       most of what she says, because she mostly answers. One handler, on
       the box, and one guard against two advances landing in the same
       moment however they arrive. */
    var dlg = $("ap-dlg");
    if (dlg) dlg.addEventListener("click", function () { advanceLine(); });
    var pb = $("ap-pause-btn");
    if (pb) pb.addEventListener("click", togglePause);
    var mb = $("ap-map-btn");
    if (mb) mb.addEventListener("click", function () {
      if (G && G.state === "map") { closeOverlay(); G.state = "play"; }
      else showMap();
    });
    /* advancing dialogue with the same key that uses things */
    window.addEventListener("keydown", function (e) {
      if (!G || !G.dlg) return;
      if (e.code === "Space" || e.code === "KeyE" || e.code === "Enter") { advanceLine(); e.preventDefault(); }
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
              zombies: [], spare: [], fade: 1, fadeTo: 1, redPulse: 0, flash: 0 };
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
    window.__apAdvance = function () { advanceLine(); return G && !!G.dlg; };
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
    window.__apMap = function () { showMap(); return G && G.state; };
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
        scene.environment = cubeFor("night:street", sky, PAL.street, 0.2);
        scene.environmentIntensity = 1.0;
      } catch (e) {}

      var rig = who === "anwar" ? makeAnwar()
              : who === "zombie" ? makeZombie(seed == null ? 3 : seed)
              : who === "guard" ? makeGuard(seed == null ? 1 : seed)
              : who === "civilian" ? makeCivilian(seed == null ? 1 : seed)
              : makeOuissy();
      scene.add(rig.root);
      rig.root.rotation.y = -0.72;
      poseHuman(rig, 0.42, 0.55, who === "zombie" ? "z" : null, {});

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

      cam.position.set(1.62, 1.62, 2.45);
      cam.lookAt(0.0, 0.98, 0.0);

      G.cine = { scene: scene, camera: cam, t: 0, duration: Infinity,
                 figure: rig, update: function () {} };
      G.state = "cine";
      var hud = $("ap-hud"); if (hud) hud.classList.add("gone");
      Stage.attach(scene, cam);
      Stage.grade({ gradeAmt: 0.04, hazeAmt: 0.0, vig: 0.28, sat: 1.05,
                    exposure: 1.0, fringe: 0, redPulse: 0, flash: 0, fade: 1 });
      return true;
    };
    window.__apPortraitHead = function () {
      if (!G || !G.cine) return false;
      G.cine.camera.fov = 30;
      G.cine.camera.updateProjectionMatrix();
      G.cine.camera.position.set(0.74, 1.65, 0.30);
      G.cine.camera.lookAt(0.02, 1.598, 0.0);
      return true;
    };
    /* turn the figure on the stand: 0 is facing you, PI is the back of it */
    window.__apPortraitTurn = function (a) {
      if (!G || !G.cine || !G.cine.figure) return false;
      G.cine.figure.root.rotation.y = -0.72 + a;
      return true;
    };

    /* what the card was actually asked to do on the last frame */
    window.__apEndCine = function () { if (G && G.cine) endCine(); return true; };
    window.__apReattach = function () {
      var s = G && (G.cine ? G.cine.scene : G.scene);
      var c = G && G.cine ? G.cine.camera : Stage.camera;
      if (s) Stage.attach(s, c);
      return true;
    };
    window.__apScale = function () { return { dpr: Stage.dpr, scale: Stage.scale, rung: Stage.rung, w: Stage.w, h: Stage.h }; };
    window.__apShadows = function (on) {
      if (Stage.renderer) { Stage.renderer.shadowMap.enabled = !!on; Stage.renderer.shadowMap.needsUpdate = true; }
      return !!on;
    };
    window.__apGpu = function () {
      var r = Stage.renderer;
      if (!r) return null;
      return { geo: r.info.memory.geometries, tex: r.info.memory.textures,
               prog: r.info.programs ? r.info.programs.length : -1 };
    };
    window.__apRenderStats = function () {
      var scene = G && (G.cine ? G.cine.scene : G.scene);
      var cam = G && G.cine ? G.cine.camera : Stage.camera;
      if (!scene) return null;
      /* the composer runs several passes and each one resets the counters,
         so they have to be held open across the whole frame */
      Stage.renderer.info.autoReset = false;
      Stage.renderer.info.reset();
      Stage.render(scene, cam);
      var info = Stage.renderer.info;
      Stage.renderer.info.autoReset = true;
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
