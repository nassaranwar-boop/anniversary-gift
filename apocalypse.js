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
      grade: [225, 185, 110, 0.15], haze: [145, 160, 185, 0.26],
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
      grade: [220, 180, 100, 0.15], haze: [140, 155, 180, 0.30],
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
    /* interior wall: painted plaster that has been there a while */
    plaster: function (x, s) {
      x.fillStyle = "#b9b3ad"; x.fillRect(0, 0, s, s);
      splotch(x, s, 26, "150,140,130", s * 0.05, s * 0.22, 0.30);
      splotch(x, s, 10, "90,80,70", s * 0.02, s * 0.09, 0.35);
      grain(x, s, 0.10, 1);
      /* a skirting shadow at the bottom edge reads as a real wall */
      var g = x.createLinearGradient(0, s * 0.82, 0, s);
      g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(1, "rgba(0,0,0,.42)");
      x.fillStyle = g; x.fillRect(0, s * 0.82, s, s * 0.18);
    },
    /* floorboards */
    boards: function (x, s) {
      x.fillStyle = "#9a7042"; x.fillRect(0, 0, s, s);
      var rows = 6, h = s / rows;
      for (var r = 0; r < rows; r++) {
        var t = hash2(r, 7);
        x.fillStyle = "rgba(" + Math.floor(120 + t * 60) + "," +
                      Math.floor(84 + t * 40) + "," + Math.floor(48 + t * 26) + ",1)";
        x.fillRect(0, r * h, s, h - 1);
        /* the gap between boards */
        x.fillStyle = "rgba(40,26,14,.85)";
        x.fillRect(0, r * h + h - 1.5, s, 1.5);
        /* grain lines along it */
        x.strokeStyle = "rgba(60,40,20,.22)"; x.lineWidth = 1;
        for (var k = 0; k < 5; k++) {
          var yy = r * h + 3 + hash2(r, k) * (h - 6);
          x.beginPath(); x.moveTo(0, yy);
          x.bezierCurveTo(s * 0.3, yy + 2, s * 0.6, yy - 2, s, yy + 1);
          x.stroke();
        }
        /* the end joint */
        var jx = hash2(r, 3) * s;
        x.fillStyle = "rgba(40,26,14,.7)"; x.fillRect(jx, r * h, 1.5, h - 1.5);
      }
      grain(x, s, 0.06, 1);
    },
    carpet: function (x, s) {
      x.fillStyle = "#7a3a44"; x.fillRect(0, 0, s, s);
      splotch(x, s, 40, "120,60,70", s * 0.03, s * 0.13, 0.30);
      grain(x, s, 0.16, 2);
    },
    /* hospital vinyl — big pale squares with a lot of scuff */
    clinic: function (x, s) {
      x.fillStyle = "#c9d4d6"; x.fillRect(0, 0, s, s);
      var n = 4, g = s / n;
      for (var i = 0; i < n; i++) for (var j = 0; j < n; j++) {
        var t = hash2(i, j) * 16 - 8;
        x.fillStyle = "rgb(" + (198 + t) + "," + (210 + t) + "," + (212 + t) + ")";
        x.fillRect(i * g + 1, j * g + 1, g - 2, g - 2);
      }
      x.strokeStyle = "rgba(120,140,145,.55)"; x.lineWidth = 1.5;
      for (var k = 0; k <= n; k++) {
        x.beginPath(); x.moveTo(k * g, 0); x.lineTo(k * g, s); x.stroke();
        x.beginPath(); x.moveTo(0, k * g); x.lineTo(s, k * g); x.stroke();
      }
      splotch(x, s, 14, "90,110,110", s * 0.04, s * 0.18, 0.22);
      splotch(x, s, 5, "70,30,26", s * 0.02, s * 0.07, 0.30);
      grain(x, s, 0.05, 1);
    },
    /* road: asphalt with aggregate and cracks */
    asphalt: function (x, s) {
      x.fillStyle = "#2b2f36"; x.fillRect(0, 0, s, s);
      splotch(x, s, 22, "58,62,70", s * 0.06, s * 0.2, 0.28);
      for (var i = 0; i < 420; i++) {
        var v = 44 + Math.random() * 56;
        x.fillStyle = "rgba(" + v + "," + (v + 4) + "," + (v + 8) + ",.5)";
        var r0 = rnd(2.2, 5.5);
        x.beginPath(); x.ellipse(Math.random() * s, Math.random() * s, r0, r0 * rnd(0.5, 1), Math.random() * 3, 0, 6.2832);
        x.fill();
      }
      x.strokeStyle = "rgba(16,16,20,.85)"; x.lineWidth = 1.6;
      for (var c = 0; c < 4; c++) {
        var cx = Math.random() * s, cy = Math.random() * s;
        x.beginPath(); x.moveTo(cx, cy);
        for (var k = 0; k < 5; k++) { cx += rnd(-24, 24); cy += rnd(-24, 24); x.lineTo(cx, cy); }
        x.stroke();
      }
      splotch(x, s, 8, "20,22,26", s * 0.05, s * 0.2, 0.4);
    },
    /* pavement slabs */
    pave: function (x, s) {
      x.fillStyle = "#6c7681"; x.fillRect(0, 0, s, s);
      var n = 2, g = s / n;
      for (var i = 0; i < n; i++) for (var j = 0; j < n; j++) {
        var t = hash2(i * 3, j * 5) * 20 - 10;
        x.fillStyle = "rgb(" + (104 + t) + "," + (114 + t) + "," + (124 + t) + ")";
        x.fillRect(i * g + 2, j * g + 2, g - 4, g - 4);
      }
      splotch(x, s, 18, "60,68,76", s * 0.04, s * 0.16, 0.3);
      grain(x, s, 0.08, 1);
    },
    grass: function (x, s) {
      x.fillStyle = "#43592c"; x.fillRect(0, 0, s, s);
      splotch(x, s, 16, "58,78,40", s * 0.06, s * 0.22, 0.3);
      for (var i = 0; i < 1100; i++) {
        var gx = Math.random() * s, gy = Math.random() * s, l = rnd(5, 13);
        var v = Math.random();
        x.strokeStyle = "rgba(" + Math.floor(60 + v * 50) + "," +
                        Math.floor(88 + v * 62) + "," + Math.floor(38 + v * 30) + ",.75)";
        x.lineWidth = rnd(1.2, 2.4);
        x.beginPath(); x.moveTo(gx, gy);
        x.quadraticCurveTo(gx + rnd(-2, 2), gy - l * 0.6, gx + rnd(-3.5, 3.5), gy - l);
        x.stroke();
      }
      splotch(x, s, 12, "40,52,26", s * 0.06, s * 0.24, 0.3);
    },
    dirt: function (x, s) {
      x.fillStyle = "#7a6748"; x.fillRect(0, 0, s, s);
      splotch(x, s, 34, "96,80,56", s * 0.04, s * 0.2, 0.4);
      splotch(x, s, 20, "56,46,32", s * 0.02, s * 0.1, 0.45);
      for (var i = 0; i < 500; i++) {
        var v = 60 + Math.random() * 70;
        x.fillStyle = "rgba(" + v + "," + (v - 12) + "," + (v - 30) + ",.5)";
        x.fillRect(Math.random() * s, Math.random() * s, rnd(1, 3), rnd(1, 3));
      }
    },
    brick: function (x, s) {
      x.fillStyle = "#3a2a26"; x.fillRect(0, 0, s, s);
      var rows = 8, h = s / rows, w = s / 4;
      for (var r = 0; r < rows; r++) {
        var off = (r % 2) * w * 0.5;
        for (var c = -1; c < 5; c++) {
          var t = hash2(r, c);
          x.fillStyle = "rgb(" + Math.floor(88 + t * 46) + "," +
                        Math.floor(52 + t * 24) + "," + Math.floor(44 + t * 20) + ")";
          x.fillRect(c * w + off + 1.5, r * h + 1.5, w - 3, h - 3);
        }
      }
      splotch(x, s, 14, "40,34,30", s * 0.05, s * 0.2, 0.34);
      grain(x, s, 0.07, 1);
    },
    /* painted breeze block — the outside of the hospital and the compound */
    block: function (x, s) {
      x.fillStyle = "#8d9099"; x.fillRect(0, 0, s, s);
      var rows = 4, h = s / rows, w = s / 2;
      for (var r = 0; r < rows; r++) for (var c = 0; c < 2; c++) {
        var t = hash2(r * 7, c * 11) * 18 - 9;
        x.fillStyle = "rgb(" + (136 + t) + "," + (139 + t) + "," + (148 + t) + ")";
        x.fillRect(c * w + 2, r * h + 2, w - 4, h - 4);
      }
      splotch(x, s, 16, "70,74,82", s * 0.04, s * 0.18, 0.32);
      grain(x, s, 0.07, 1);
    },
    /* felt-and-batten flat roof, seen from directly above */
    roof: function (x, s) {
      x.fillStyle = "#2e3138"; x.fillRect(0, 0, s, s);
      for (var i = 0; i < 900; i++) {
        var v = 34 + Math.random() * 34;
        x.fillStyle = "rgba(" + v + "," + (v + 2) + "," + (v + 6) + ",.5)";
        x.fillRect(Math.random() * s, Math.random() * s, rnd(1, 3), rnd(1, 3));
      }
      x.strokeStyle = "rgba(16,18,22,.7)"; x.lineWidth = 2;
      for (var r = 0; r < 5; r++) {
        var y = r * s / 5 + 4;
        x.beginPath(); x.moveTo(0, y); x.lineTo(s, y + rnd(-1, 1)); x.stroke();
      }
      splotch(x, s, 10, "60,66,76", s * 0.05, s * 0.22, 0.3);
      splotch(x, s, 6, "24,26,30", s * 0.04, s * 0.16, 0.4);
      splotch(x, s, 3, "70,86,100", s * 0.06, s * 0.18, 0.22);
    },
    metal: function (x, s) {
      x.fillStyle = "#5b6068"; x.fillRect(0, 0, s, s);
      for (var i = 0; i < 260; i++) {
        x.strokeStyle = "rgba(" + irnd(70, 130) + "," + irnd(74, 134) + "," + irnd(82, 142) + ",.3)";
        x.lineWidth = rnd(0.5, 1.6);
        var y = Math.random() * s;
        x.beginPath(); x.moveTo(0, y); x.lineTo(s, y + rnd(-2, 2)); x.stroke();
      }
      splotch(x, s, 8, "110,60,30", s * 0.03, s * 0.12, 0.28);
    },
    bark: function (x, s) {
      x.fillStyle = "#43331f"; x.fillRect(0, 0, s, s);
      for (var i = 0; i < 90; i++) {
        var cx = Math.random() * s;
        x.strokeStyle = "rgba(" + irnd(28, 92) + "," + irnd(22, 66) + "," + irnd(14, 40) + ",.8)";
        x.lineWidth = rnd(1, 4);
        x.beginPath(); x.moveTo(cx, 0);
        for (var y = 0; y < s; y += 12) x.lineTo(cx + rnd(-3, 3), y);
        x.stroke();
      }
      grain(x, s, 0.12, 1);
    },
    leaves: function (x, s) {
      x.fillStyle = "#2c4a24"; x.fillRect(0, 0, s, s);
      for (var i = 0; i < 700; i++) {
        var v = Math.random();
        x.fillStyle = "rgba(" + Math.floor(34 + v * 60) + "," +
                      Math.floor(62 + v * 74) + "," + Math.floor(26 + v * 40) + ",.85)";
        var cx = Math.random() * s, cy = Math.random() * s;
        x.beginPath(); x.ellipse(cx, cy, rnd(3, 8), rnd(2, 5), Math.random() * 3.14, 0, 6.2832); x.fill();
      }
    },
    /* clothing and skin, painted flat then dirtied */
    cloth: function (x, s) {
      x.fillStyle = "#cccccc"; x.fillRect(0, 0, s, s);
      for (var i = 0; i < 800; i++) {
        var v = irnd(-14, 14) + 200;
        x.fillStyle = "rgba(" + v + "," + v + "," + v + ",.35)";
        x.fillRect(Math.random() * s, Math.random() * s, rnd(1, 3), rnd(1, 3));
      }
      grain(x, s, 0.08, 1);
    },
    rot: function (x, s) {
      x.fillStyle = "#9aa88c"; x.fillRect(0, 0, s, s);
      splotch(x, s, 30, "90,104,76", s * 0.04, s * 0.2, 0.5);
      splotch(x, s, 16, "70,44,42", s * 0.02, s * 0.09, 0.5);
      splotch(x, s, 10, "40,50,40", s * 0.03, s * 0.13, 0.4);
      grain(x, s, 0.12, 1);
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

  function surface(name, opts) {
    opts = opts || {};
    var m = new THREE.MeshStandardMaterial({
      map: tex(name, opts.size || 256, opts.repeat || 1),
      bumpMap: opts.bump === false ? null : bump(name, opts.size || 256, opts.repeat || 1),
      bumpScale: opts.bumpScale == null ? 0.14 : opts.bumpScale,
      roughness: opts.rough == null ? 0.92 : opts.rough,
      metalness: opts.metal == null ? 0.02 : opts.metal,
      color: opts.tint == null ? 0xffffff : opts.tint
    });
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
     colour grade, the haze, the vignette, the grain, a touch of
     lens fringing, and the red pulse when something has hold of
     her. One pass, so it costs one full-screen draw.
     ========================================================= */
  var GRADE_FRAG = [
    "uniform sampler2D tDiffuse;",
    "uniform vec3 gradeCol; uniform float gradeAmt;",
    "uniform vec3 hazeCol;  uniform float hazeAmt;",
    "uniform float vig; uniform float grain; uniform float time;",
    "uniform float fringe; uniform float redPulse; uniform float flash;",
    "uniform float fade; uniform float sat; uniform float exposure;",
    "varying vec2 vUv;",
    "float h21(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }",
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
    /* vignette */
    "  col *= 1.0 - vig * smoothstep(0.16, 0.82, r2);",
    /* grain, animated */
    "  float n = h21(uv * vec2(1024.0, 768.0) + fract(time) * 91.7);",
    "  col += (n - 0.5) * grain;",
    "  col *= fade;",
    "  gl_FragColor = vec4(col, 1.0);",
    "}"
  ].join("\n");

  var GRADE_VERT = [
    "varying vec2 vUv;",
    "void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }"
  ].join("\n");

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
        canvas: canvas, antialias: false, powerPreference: "high-performance",
        stencil: false, alpha: false
      });
    },

    finish: function (canvas, r) {
      r.setClearColor(0x000000, 1);
      r.shadowMap.enabled = true;
      r.shadowMap.type = THREE.PCFSoftShadowMap;
      r.toneMapping = THREE.ACESFilmicToneMapping;
      r.toneMappingExposure = 1.08;
      r.outputColorSpace = THREE.SRGBColorSpace;
      Stage.renderer = r;

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
      var comp = new C(Stage.renderer);
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
          grain:     { value: 0.055 },
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
      Stage.composer = comp;
    },

    resize: function (force) {
      var canvas = Stage.renderer && Stage.renderer.domElement;
      if (!canvas) return;
      var host = canvas.parentElement || canvas;
      var cw = Math.max(160, host.clientWidth || 640);
      var ch = Math.max(90, host.clientHeight || 360);
      var scale = [1, 0.78, 0.6][Stage.quality] || 1;
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
    this.pos = new THREE.Vector3();
    this.look = new THREE.Vector3();
    this.want = new THREE.Vector3();
    this.wantLook = new THREE.Vector3();
    this.shake = 0;
    this.dist = 8.6;
    this.height = 10.4;
    this.fov = 46;
    this.fovWant = 46;
    this.snapped = false;
  }
  CamRig.prototype.frame = function (tx, ty, facing, mode, dt) {
    var lead = 1.9;
    var lx = tx + Math.cos(facing) * lead;
    var lz = ty + Math.sin(facing) * lead;

    var d = this.dist, h = this.height;
    if (mode === "creep") { d = 7.4;  h = 9.0;  this.fovWant = 43; }
    else if (mode === "chase") { d = 9.8; h = 11.6; this.fovWant = 51; }
    else { d = 8.6; h = 10.4; this.fovWant = 46; }

    this.want.set(lx, h, lz + d);
    this.wantLook.set(lx, 1.0, lz);

    var k = this.snapped ? 1 - Math.pow(1 - TUNE.camLerp, dt * 60) : 1;
    this.pos.lerp(this.want, k);
    this.look.lerp(this.wantLook, k);
    this.snapped = true;

    this.fov = lerp(this.fov, this.fovWant, 1 - Math.pow(0.9, dt * 60));

    var sx = 0, sy = 0;
    if (this.shake > 0.001) {
      sx = (Math.random() - 0.5) * this.shake;
      sy = (Math.random() - 0.5) * this.shake;
      this.shake *= Math.pow(0.06, dt);
    }
    this.cam.position.set(this.pos.x + sx, this.pos.y + sy, this.pos.z);
    this.cam.lookAt(this.look.x, this.look.y, this.look.z);
    if (Math.abs(this.cam.fov - this.fov) > 0.01) {
      this.cam.fov = this.fov; this.cam.updateProjectionMatrix();
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

  function skinMat(hex) {
    return new THREE.MeshStandardMaterial({
      color: hex, roughness: 0.72, metalness: 0.0,
      map: tex("cloth", 128, 1), bumpMap: bump("cloth", 128, 1), bumpScale: 0.06
    });
  }
  function clothMat(hex, rough) {
    return new THREE.MeshStandardMaterial({
      color: hex, roughness: rough == null ? 0.95 : rough, metalness: 0.0,
      map: tex("cloth", 128, 2), bumpMap: bump("cloth", 128, 2), bumpScale: 0.18
    });
  }
  function rotMat(hex) {
    return new THREE.MeshStandardMaterial({
      color: hex, roughness: 0.98, metalness: 0.0,
      map: tex("rot", 128, 1), bumpMap: bump("rot", 128, 1), bumpScale: 0.22
    });
  }

  /* ---- the humanoid ---- */
  function buildHuman(spec) {
    var S = spec.scale || 1;
    var skin  = skinMat(spec.skin);
    var top   = clothMat(spec.top);
    var legs  = clothMat(spec.trousers);
    var hairM = new THREE.MeshStandardMaterial({ color: spec.hair, roughness: 0.68, metalness: 0.02 });
    var shoe  = new THREE.MeshStandardMaterial({ color: spec.shoe || 0x241d18, roughness: 0.7 });

    var root = new THREE.Group();          /* on the floor, facing +x at 0 rad */
    var body = new THREE.Group();          /* everything that bobs */
    root.add(body);

    var hipY = 0.90 * S;
    var pelvis = new THREE.Group();
    pelvis.position.y = hipY;
    body.add(pelvis);

    /* --- spine and chest --- */
    var spine = new THREE.Group();
    pelvis.add(spine);
    var chestLen = 0.50 * S;
    var chest = new THREE.Mesh(
      (function () {
        var g = new THREE.CylinderGeometry(0.20 * S, 0.155 * S, chestLen, 9, 1);
        g.translate(0, chestLen / 2, 0);
        g.scale(1.0, 1.0, spec.depth || 0.72);
        return g;
      })(), top);
    chest.castShadow = true;
    spine.add(chest);

    /* hips, so the join is not a step */
    var hips = new THREE.Mesh(
      (function () {
        var g = new THREE.SphereGeometry(0.17 * S, 10, 7);
        g.scale(1.05, 0.8, spec.depth || 0.72); return g;
      })(), legs);
    hips.castShadow = true;
    pelvis.add(hips);

    /* --- neck and head --- */
    var neck = new THREE.Group();
    neck.position.y = chestLen;
    spine.add(neck);
    var neckMesh = new THREE.Mesh(tapered(0.09 * S, 0.055 * S, 0.062 * S, 7), skin);
    neckMesh.position.y = 0.09 * S;
    neck.add(neckMesh);

    var head = new THREE.Group();
    head.position.y = 0.075 * S;
    neck.add(head);
    var skull = new THREE.Mesh(
      (function () { var g = new THREE.SphereGeometry(0.115 * S, 14, 12); g.scale(0.92, 1.06, 0.94); return g; })(),
      skin);
    skull.position.y = 0.105 * S;
    skull.castShadow = true;
    head.add(skull);
    /* a jaw, so the profile is not a ball on a stick */
    var jaw = new THREE.Mesh(
      (function () { var g = new THREE.SphereGeometry(0.082 * S, 10, 8); g.scale(0.9, 0.7, 1.0); return g; })(),
      skin);
    jaw.position.set(0.026 * S, 0.055 * S, 0);
    head.add(jaw);

    /* --- hair --- */
    if (spec.hairStyle === "long") {
      var cap = new THREE.Mesh(
        (function () { var g = new THREE.SphereGeometry(0.125 * S, 14, 12, 0, 6.2832, 0, 1.45); g.scale(0.96, 1.02, 1.0); return g; })(),
        hairM);
      cap.position.y = 0.112 * S; cap.castShadow = true;
      head.add(cap);
      /* the fall down her back, tapering */
      var fall = new THREE.Mesh(
        (function () {
          var g = new THREE.CylinderGeometry(0.115 * S, 0.075 * S, 0.42 * S, 10, 1, true);
          g.translate(0, -0.21 * S, 0); g.scale(1, 1, 0.66); return g;
        })(), hairM);
      fall.position.set(-0.035 * S, 0.11 * S, 0);
      fall.rotation.z = -0.10;
      fall.castShadow = true;
      head.add(fall);
      var tip = new THREE.Mesh(
        (function () { var g = new THREE.SphereGeometry(0.075 * S, 10, 8); g.scale(1, 0.7, 0.66); return g; })(),
        hairM);
      tip.position.set(-0.075 * S, -0.30 * S, 0);
      head.add(tip);
    } else {
      var crop = new THREE.Mesh(
        (function () { var g = new THREE.SphereGeometry(0.121 * S, 13, 11, 0, 6.2832, 0, 1.24); g.scale(0.95, 1.0, 0.98); return g; })(),
        hairM);
      crop.position.y = 0.114 * S; crop.castShadow = true;
      head.add(crop);
    }

    /* --- arms --- */
    function arm(side) {
      var sh = new THREE.Group();
      sh.position.set(0, chestLen - 0.045 * S, side * 0.20 * S);
      spine.add(sh);
      var upper = joint(0.30 * S, 0.058 * S, 0.048 * S, spec.sleeves === false ? skin : top);
      sh.add(upper);
      var elbow = new THREE.Group();
      elbow.position.y = -0.30 * S;
      upper.add(elbow);
      var lower = joint(0.28 * S, 0.046 * S, 0.038 * S, spec.sleeves === "short" ? skin : (spec.sleeves === false ? skin : top));
      elbow.add(lower);
      var hand = new THREE.Mesh(
        (function () { var g = new THREE.SphereGeometry(0.05 * S, 8, 6); g.scale(1, 1.2, 0.7); return g; })(), skin);
      hand.position.y = -0.30 * S;
      elbow.add(hand);
      return { shoulder: sh, upper: upper, elbow: elbow, lower: lower };
    }
    var armL = arm(1), armR = arm(-1);

    /* --- legs --- */
    function leg(side) {
      var hip = new THREE.Group();
      hip.position.set(0, -0.03 * S, side * 0.105 * S);
      pelvis.add(hip);
      var upper = joint(0.44 * S, 0.085 * S, 0.068 * S, legs);
      hip.add(upper);
      var knee = new THREE.Group();
      knee.position.y = -0.44 * S;
      upper.add(knee);
      var lower = joint(0.42 * S, 0.062 * S, 0.048 * S, legs);
      knee.add(lower);
      var foot = new THREE.Mesh(new THREE.BoxGeometry(0.20 * S, 0.07 * S, 0.10 * S), shoe);
      foot.position.set(0.035 * S, -0.44 * S, 0);
      foot.castShadow = true;
      knee.add(foot);
      return { hip: hip, upper: upper, knee: knee, lower: lower, foot: foot };
    }
    var legL = leg(1), legR = leg(-1);

    root.traverse(function (o) { if (o.isMesh) { o.castShadow = true; o.receiveShadow = false; } });
    var contact = contactShadow(1.15 * S);
    root.add(contact);

    return {
      root: root, contact: contact,
      body: body, pelvis: pelvis, spine: spine, neck: neck, head: head,
      armL: armL, armR: armR, legL: legL, legR: legR,
      hipY: hipY, S: S, spec: spec, phase: Math.random() * 6.28,
      blink: 0
    };
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

  /* ---- the four people in the game ---- */
  function makeOuissy() {
    var r = buildHuman({
      scale: 1.0, skin: 0xd8a882, hair: 0x8a5a2c, hairStyle: "long",
      top: 0x9c3f5c, trousers: 0x2f3a52, shoe: 0x201a18, depth: 0.68,
      sleeves: true
    });
    r.name = "ouissy";
    return r;
  }
  function makeAnwar() {
    var r = buildHuman({
      scale: 1.06, skin: 0xb9835c, hair: 0x201814, hairStyle: "short",
      top: 0xd8dce4, trousers: 0x3a4050, shoe: 0x1c1816, depth: 0.82,
      sleeves: "short"
    });
    r.name = "anwar";
    return r;
  }
  function makeZombie(seed) {
    var skins = [0x8fa08a, 0x9aa894, 0x84947e, 0xa2a894];
    var tops  = [0x5a5f52, 0x4a4a54, 0x6a5a4a, 0x3f4a52, 0x6a4a4a];
    var r = buildHuman({
      scale: rnd(0.94, 1.10), skin: skins[seed % skins.length], hair: 0x2a2420,
      hairStyle: seed % 3 === 0 ? "long" : "short",
      top: tops[seed % tops.length], trousers: 0x2e3038, shoe: 0x191614,
      depth: 0.76, sleeves: seed % 2 ? "short" : true
    });
    /* what is left of them: skin gone wrong, clothes torn open */
    r.root.traverse(function (o) {
      if (!o.isMesh || o === r.contact) return;
      if (o.material && o.material.color) {
        o.material = o.material.clone();
        o.material.map = tex("rot", 128, 1);
        o.material.bumpMap = bump("rot", 128, 1);
        o.material.bumpScale = 0.3;
        o.material.roughness = 0.99;
        o.material.color.multiplyScalar(0.86);
      }
    });
    r.name = "zombie";
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
    var matFloor  = surface(indoorFloorTex, { repeat: 1, rough: 0.88, bumpScale: 0.10 });
    /* what the comma means is a property of the place, not of the theme:
       it is the drive outside the garage, the road, the hospital car park,
       the fields and the clearing, in that order */
    var groundTex = def.groundTex || (def.theme === "street" ? "asphalt" : "grass");
    var matGround = groundTex === "asphalt"
      ? surface("asphalt", { repeat: 1, rough: 0.34, metal: 0.16, bumpScale: 0.10 })
      : surface(groundTex, { repeat: 1, rough: 0.97, bumpScale: 0.16 });
    var matWall   = surface(def.theme === "street" ? "brick"
                          : def.theme === "hospital" ? "block" : "plaster",
                            { repeat: 1, rough: 0.95, bumpScale: 0.18 });
    var outdoorLevel = def.base === ",";
    var matCap    = outdoorLevel
                  ? surface("roof", { repeat: 1, rough: 0.98, bumpScale: 0.22 })
                  : surface(def.theme === "hospital" ? "block" : "plaster",
                            { repeat: 1, rough: 0.9, bumpScale: 0.12 });
    var matWood   = surface("boards", { repeat: 1, rough: 0.8, bumpScale: 0.2 });
    var matMetal  = surface("metal",  { repeat: 1, rough: 0.42, metal: 0.72, bumpScale: 0.2 });
    var matLeaf   = surface("leaves", { repeat: 1, rough: 0.95, bumpScale: 0.24 });
    var matBark   = surface("bark",   { repeat: 1, rough: 0.98, bumpScale: 0.30 });
    var matCloth  = surface("cloth",  { repeat: 1, rough: 0.98, bumpScale: 0.1 });
    world.mats = { floor: matFloor, ground: matGround, wall: matWall };

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
                surface("block", { repeat: 1, rough: 0.9, bumpScale: 0.1, tint: 0xb8bcc0 }), true, true)
    };
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
    var litWinMat = new THREE.MeshBasicMaterial({ color: 0xe8b06a, toneMapped: false });
    var darkWinMat = new THREE.MeshStandardMaterial({
      color: 0x0b1017, roughness: 0.62, metalness: 0.0,
      emissive: new THREE.Color(0x16283a), emissiveIntensity: 0.7 });
    var winFrameMat = surface("metal", { repeat: 1, rough: 0.7, metal: 0.2, tint: 0x5a5348 });
    var glassMat = new THREE.MeshStandardMaterial({
      color: 0x2a3a4a, roughness: 0.16, metalness: 0.1,
      emissive: new THREE.Color(0x27405c), emissiveIntensity: 0.9,
      transparent: true, opacity: 0.92
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
        var edge = false, nb = [[1, 0, Math.PI / 2], [-1, 0, -Math.PI / 2], [0, 1, 0], [0, -1, Math.PI]];
        for (var e = 0; e < 4; e++) {
          var ec = at(x + nb[e][0], y + nb[e][1]);
          if (ec !== "#" && ec !== "v" && ec !== " ") edge = true;
        }
        /* a parapet along the roof edge, so the top is a roof and not a lid */
        if (edge && hgt > 1.05) {
          B.roofedge.add(cx(x), top + 0.48, cz(y), TILE * 1.16, 0.34, TILE * 1.16, 0,
                         shade(0xffffff, 0.72 + t * 0.3));
        }
        /* and, in the middle of a big roof, the things that live up there */
        if (!edge && t > 0.72) {
          var kind = hash2(y * 3, x * 5);
          if (kind > 0.55) {
            B.roofbits.add(cx(x) + (t - 0.5) * 0.7, top + 0.9, cz(y) + (kind - 0.5) * 0.7,
                           0.62, 1.5, 0.62, t * 3, shade(0xffffff, 0.62 + t * 0.3));
          } else {
            B.roofbits.add(cx(x), top + 0.5, cz(y), 1.5, 0.7, 1.1, kind * 3, shade(0xffffff, 0.8));
          }
        }
        /* windows in the face, a few of them still on */
        if (edge && hgt > 1.05) {
          for (var di = 0; di < 4; di++) {
            var d = nb[di];
            var cc2 = at(x + d[0], y + d[1]);
            if (cc2 === "#" || cc2 === "v" || cc2 === " ") continue;
            var storeys = Math.max(1, Math.round(hgt * 1.6));
            for (var f = 0; f < storeys; f++) {
              var seed = hash2(x * 31 + di * 7 + f * 13, y * 17 + f * 5);
              if (seed < 0.42) continue;
              var wy = 1.15 + f * (TUNE.wallH * hgt - 1.0) / storeys;
              if (wy > top - 0.6) continue;
              var pane = new THREE.Mesh(
                geo("winP", function () { return new THREE.PlaneGeometry(TILE * 0.5, 0.8); }),
                seed > 0.86 ? litWinMat : darkWinMat);
              pane.position.set(cx(x) + d[0] * (TILE / 2 + 0.03), wy, cz(y) + d[1] * (TILE / 2 + 0.03));
              pane.rotation.y = d[2];
              G.add(pane);
              /* frame and one mullion, which is what makes a lit rectangle
                 read as a window rather than a light left on */
              var fr = new THREE.Mesh(
                geo("winFrame", function () {
                  var gg = [];
                  var b1 = new THREE.BoxGeometry(TILE * 0.56, 0.07, 0.09); b1.translate(0, 0.42, 0);
                  var b2 = new THREE.BoxGeometry(TILE * 0.56, 0.07, 0.09); b2.translate(0, -0.42, 0);
                  var b3 = new THREE.BoxGeometry(0.07, 0.9, 0.09); b3.translate(-TILE * 0.25, 0, 0);
                  var b4 = new THREE.BoxGeometry(0.07, 0.9, 0.09); b4.translate(TILE * 0.25, 0, 0);
                  var b5 = new THREE.BoxGeometry(0.05, 0.86, 0.08);
                  return mergeGeoms([b1, b2, b3, b4, b5]);
                }), winFrameMat);
              fr.position.set(pane.position.x + d[0] * 0.04, wy, pane.position.z + d[1] * 0.04);
              fr.rotation.y = d[2];
              G.add(fr);
              var sill = new THREE.Mesh(
                geo("sillB", function () { return new THREE.BoxGeometry(TILE * 0.66, 0.10, 0.22); }),
                matCap);
              sill.position.set(pane.position.x + d[0] * 0.07, wy - 0.50, pane.position.z + d[1] * 0.07);
              sill.rotation.y = d[2];
              G.add(sill);
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
      G.add(g);
      world.lamps.push({ x: cx(x) + 0.85, y: 4.1, z: cz(y), colour: 0xffcf90,
                         power: 2.6, range: 12, kind: "post", bulb: bulb, halo: halo,
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
      (def.dark > 0.6 ? 0.80 : def.dark > 0.45 ? 1.25 : 2.1) * bal * (def.base === "," ? 1.5 : 1));
    G.add(amb);
    world.hemi = amb;
    /* the last few percent, so an unlit corner is still a corner and not
       a hole cut in the picture */
    /* outdoors there is always something in the sky — cloud lit from
       underneath by a city that has not entirely gone out */
    var fillAmt = (def.dark > 0.6 ? 0.16 : 0.24) * bal * (def.base === "," ? 2.2 : 1);
    var floorFill = new THREE.AmbientLight(shade(pal.sky, 1.9), fillAmt);
    G.add(floorFill);

    /* the one big directional light: moonlight, or the sun at the gates.
       Only the outdoor levels get a shadow out of it — indoors the
       torch does that job and two shadow maps is one too many. */
    var key = new THREE.DirectionalLight(pal.key,
      (def.dark > 0.6 ? 0.48 : def.dark > 0.4 ? 1.0 : 2.1) * bal);
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

    var spot = new THREE.SpotLight(0xfff0d0, 46, 28, 0.72, 0.5, 1.1);
    spot.castShadow = true;
    spot.shadow.mapSize.set(1024, 1024);
    spot.shadow.camera.near = 0.4;
    spot.shadow.camera.far = 24;
    spot.shadow.bias = -0.0022;
    spot.shadow.normalBias = 0.035;
    spot.position.set(0, 1.35, 0);
    g.add(spot);
    g.add(spot.target);
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
        "float h(vec2 p){ return fract(sin(dot(p,vec2(41.3,289.1)))*43758.5); }",
        "void main(){",
        /* fade along the beam and off at the rim */
        "  float along = clamp(vP.x/9.0, 0.0, 1.0);",
        "  float a = (1.0-along)*(1.0-along) * 0.55;",
        "  a *= smoothstep(0.0, 0.16, along);",
        "  float rim = abs(sin(vUv.x*3.14159));",
        "  a *= 0.35 + rim*0.65;",
        /* dust drifting through it */
        "  a *= 0.82 + 0.18*sin(vUv.x*22.0 + time*1.4) * sin(along*17.0 - time*2.1);",
        "  gl_FragColor = vec4(tint, a*amt);",
        "}"
      ].join("\n")
    });
    var cone = new THREE.Mesh(coneGeo, coneMat);
    cone.position.set(0, 1.32, 0);
    cone.frustumCulled = false;
    cone.renderOrder = 20;
    g.add(cone);

    /* the pool she stands in */
    var pool = new THREE.PointLight(0xffd9a8, 2.2, 7.4, 1.9);
    pool.position.set(0, 1.55, 0);
    g.add(pool);

    g.userData = { spot: spot, cone: cone, coneMat: coneMat, pool: pool };
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
      creeping: false, hidden: false, rig: rig, torch: torch,
      stepPhase: 0, gait: 0, safe: { x: px, z: pz }, alive: true
    };

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
    Stage.grade({
      gradeCol: (def.grade[0] << 16) | (def.grade[1] << 8) | def.grade[2],
      gradeAmt: def.grade[3],
      hazeCol: (def.haze[0] << 16) | (def.haze[1] << 8) | def.haze[2],
      hazeAmt: def.haze[3],
      vig: def.dark > 0.55 ? 0.68 : 0.52,
      grain: def.dark > 0.55 ? 0.034 : 0.024,
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
    p.gait = lerp(p.gait, clamp(speed / TUNE.walk, 0, 1), 1 - Math.pow(0.001, dt));

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
    p.groundY = lerp(p.groundY || 0, groundAt(w, p.x, p.z), 1 - Math.pow(0.0001, dt));
    p.rig.root.position.set(p.x, p.groundY, p.z);
    var want = p.facing;
    var cur = p.rig.root.rotation.y;
    var diff = Math.atan2(Math.sin(-want - cur), Math.cos(-want - cur));
    p.rig.root.rotation.y = cur + diff * (1 - Math.pow(0.0005, dt));
    poseHuman(p.rig, G.time, p.gait, null, { crouch: p.creeping ? 1 : 0 });

    /* the torch follows her head, not her feet */
    var td = p.torch.userData;
    td.spot.target.position.set(Math.cos(0) * 6, -1.2, 0);
    var reach = p.creeping ? TUNE.torchCreep : TUNE.torch;
    td.spot.distance = reach * 2.6;
    td.spot.angle = p.creeping ? 0.62 : 0.76;
    var bal = G.world.balance == null ? 1 : G.world.balance;
    /* by the time she gets to the gates it is morning, and a torch in
       daylight is just something in her hand */
    var night = clamp((G.def.dark - 0.30) / 0.28, 0, 1);
    td.spot.intensity = lerp(td.spot.intensity, (p.creeping ? 32 : 48) * bal * night,
                             1 - Math.pow(0.02, dt));
    td.coneMat.uniforms.time.value = G.time;
    td.coneMat.uniforms.amt.value = (p.creeping ? 0.30 : 0.46) * night;
    td.cone.scale.set(reach / 8.0, reach / 8.0, reach / 8.0);
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
      z.gait = lerp(z.gait, speed > 0 ? 1 : 0, 1 - Math.pow(0.004, dt));

      z.groundY = lerp(z.groundY || 0, groundAt(w, z.x, z.z), 1 - Math.pow(0.0001, dt));
      z.rig.root.position.set(z.x, z.groundY, z.z);
      var cur = z.rig.root.rotation.y, want = -z.facing;
      var diff = Math.atan2(Math.sin(want - cur), Math.cos(want - cur));
      z.rig.root.rotation.y = cur + diff * (1 - Math.pow(0.004, dt));
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
      var f = L2.flicker ? (0.8 + Math.sin(G.time * 21 + k) * 0.12 + Math.sin(G.time * 6.3) * 0.08) : 1;
      pl.intensity = L2.power * f * 4.0 * (w.balance == null ? 1 : w.balance);
    }
  }

  function updateDoors(dt) {
    var ds = G.world.doors;
    for (var i = 0; i < ds.length; i++) {
      var d = ds[i];
      if (Math.abs(d.open - d.want) < 0.002) continue;
      d.open = lerp(d.open, d.want, 1 - Math.pow(0.004, dt));
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
    var k = 1 - Math.pow(0.004, dt);
    G.fade = lerp(G.fade, G.fadeTo, k);
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
               vig: 0.8, grain: 0.05, sat: 1.0, fringe: 0.002, redPulse: 0, exposure: 1.0 },
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
               vig: 0.6, grain: 0.036, sat: 1.1, fringe: 0.0015, redPulse: 0, exposure: 1.04 },
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
               vig: 0.82, grain: 0.05, sat: 1.06, fringe: 0.0016, redPulse: 0, exposure: 1.0 },
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
               vig: 0.46, grain: 0.026, sat: 1.22, fringe: 0.0012, redPulse: 0, exposure: 1.0 },
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
               vig: 0.72, grain: 0.038, sat: 1.06, fringe: 0.0014, redPulse: 0, exposure: 1.02 },
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
      var cur = a.rig.root.rotation.y;
      var diff = Math.atan2(Math.sin(-face - cur), Math.cos(-face - cur));
      a.rig.root.rotation.y = cur + diff * (1 - Math.pow(0.002, dt));
    }
    a.groundY = lerp(a.groundY || 0, groundAt(G.world, a.x, a.z), 1 - Math.pow(0.0001, dt));
    a.rig.root.position.set(a.x, a.groundY, a.z);
    a.gait = lerp(a.gait || 0, gait, 1 - Math.pow(0.002, dt));
    poseHuman(a.rig, G.time + 0.8, a.gait, null, { crouch: p.creeping ? 0.8 : 0 });
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
      G.redPulse = lerp(G.redPulse, G.chasing ? 0.14 : 0, 1 - Math.pow(0.02, dt));
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
    G.flash = lerp(G.flash, 0, 1 - Math.pow(0.001, dt));
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
    window.__apKey = function (k, v) { if (k in KEY) { KEY[k] = v ? 1 : 0; if (k === "use" && v) usePressed = true; } };
  }

  window.Apocalypse = Api;
})();
