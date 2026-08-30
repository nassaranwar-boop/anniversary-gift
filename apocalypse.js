/* =========================================================================
   APOCALYPSE.JS — "Ouissy at the Apocalypse"

   A top-down stealth game in five levels. Ouissy is home alone when the
   outbreak starts; the game is her getting to Anwar, and then the two of
   them getting somewhere safe.

   It follows the same rules as everything else on this site: not one image
   file and not one audio file. Every tile, every sprite, every backdrop is
   drawn pixel by pixel onto a 320x180 canvas when the level loads, and
   every sound is synthesised. The canvas is blown up with
   image-rendering:pixelated so the grid stays honest.

   Read it in this order:

     1. CUSTOMISE ME    the words — titles, briefings, every line spoken
     2. TUNING          how she moves, how far a zombie sees, how loud she is
     3. LEVELS          the maps, as grids of characters, legend above them
     4. PALETTES        one per place
     5. PIXEL HELPERS   px, blob, dither, rnd — the same primitives as the site
     6. SPRITES         Ouissy, Anwar, the zombies, the horse, the cats
     7. TILE ART        an atlas per theme, baked once when a level loads
     8. THE LEVEL       parsing a grid into solids, cover, entities, triggers
     9. LIGHT           the torch, the lamps, and the dark between them
    10. THE PLAYER      input, collision, noise
    11. THE ZOMBIES     patrol, sight, hearing, the close call
    12. WIRE PANEL      the salvaged-panel mini-game
    13. KEYPAD + NOTE   the code she finds and the door it opens
    14. STORY           briefings, dialogue, the beats between levels
    15. THE GAME LOOP   input -> step -> camera -> paint
    16. SOUND           Web Audio only
    17. PUBLIC API      Apocalypse.start() / .stop()

   Public API used by script.js:
     Apocalypse.start()   title card, then Level 1
     Apocalypse.stop()    tear the loop down and silence it
   ========================================================================= */
window.Apocalypse = (function () {
  "use strict";

  /* =======================================================================
     1. ✏️  CUSTOMISE ME — the words. Nothing outside this block is text.
     ======================================================================= */
  var AP = {
    title: "OUISSY AT THE APOCALYPSE",
    tagline: "the world ends. you come and find me anyway.",

    /* The card before each level: where she is and what she is doing. */
    levels: [
      { name: "HOME",          card: "Level 1", sub: "Your parents are away. The news is still on." },
      { name: "THE STREETS",   card: "Level 2", sub: "He's asleep at the hospital. That's where you're going." },
      { name: "THE HOSPITAL",  card: "Level 3", sub: "Find him before the corridors fill up." },
      { name: "THE ROAD",      card: "Level 4", sub: "Out of the city, any way you can." },
      { name: "THE GATES",     card: "Level 5", sub: "They only take you if you're clean." },
    ],

    /* ✏️  THE REUNION — Level 3.

       Written to be underplayed. Neither of them makes a speech; they are
       both still working out that the other one is really there. A line
       with no words at all is a beat of silence, and it is held on screen
       like any other line — those are doing as much work here as the
       spoken ones, so please keep them if you rewrite around them.

       ["ANWAR", "..."]  he says it   ["OUISSY", "..."]  she says it
       ["", "..."]       narration    ["", ""]           a silence  */
    reunion: {
      waking: [
        ["", "He is on his side with one arm out of the blanket. She says his name twice before anything happens."],
        ["ANWAR", "...Ouissy?"],
        ["ANWAR", "What time is it."],
        ["OUISSY", "We have to go."],
        ["ANWAR", "Okay."],
        ["", "He doesn't ask why. That tells her he has already heard something."],
      ],
      hiding: [
        ["", "The door goes shut behind them. There is a bolt on it, and the bolt works."],
        ["", ""],
        ["ANWAR", "You walked here."],
        ["OUISSY", "Yeah."],
        ["ANWAR", "From the house."],
        ["OUISSY", "Yeah."],
        ["", ""],
        ["ANWAR", "You're insane."],
        ["OUISSY", "I know."],
        ["", "He laughs, once, and it comes out wrong, and then he stops."],
        ["ANWAR", "...Come here."],
        ["", "They stay like that for a while. Neither of them says anything for a while."],
        ["ANWAR", "I kept thinking, if this is real, she's on her own in that house."],
        ["OUISSY", "I'm not on my own."],
        ["ANWAR", "No."],
        ["", ""],
        ["OUISSY", "So what do we do."],
        ["ANWAR", "I don't know yet."],
        ["ANWAR", "Give me a minute and we'll work it out."],
        ["OUISSY", "Okay."],
      ],
    },

    /* ✏️  The code on the scrap of paper in the corner shop in Level 2,
       and therefore the code on the staff gate. Four digits. Change it to
       something that means something and it changes in both places. */
    gateCode: "4180",

    /* The how-to card, shown once before Level 1. */
    howTo: [
      ["← ↑ ↓ →", "move (or WASD)"],
      ["SHIFT", "hold to creep — slower, but almost silent"],
      ["E or SPACE", "use whatever you're standing at"],
      ["ESC", "pause"],
      ["on a phone", "the pad and the two buttons do all of it"],
      ["", ""],
      ["the dark", "you only see as far as your torch. Lit rooms show more"],
      ["cover", "step into a wardrobe, a bush, or behind a car and they lose you"],
      ["noise", "running is loud. They come and look at where the sound was"],
      ["getting caught", "you get pulled back to somewhere safe. That's all. Try again"],
    ],
  };

  /* =======================================================================
     2. TUNING — almost every complaint about how this plays is one of these
     ======================================================================= */
  var TUNE = {
    tile: 16,                 // world units per tile
    walk: 52,                 // px/sec
    creep: 26,                // px/sec while SHIFT is held
    accel: 420,
    friction: 520,

    torch: 64,                // how far she sees, in px
    torchCreep: 54,           // a smaller pool while creeping — she is careful
    lampFall: 1.0,

    noiseWalk: 60,            // how far walking carries, in px
    noiseCreep: 0,            // creeping makes none
    noiseDoor: 110,           // opening a door is loud
    noiseSpark: 130,          // so is a wire going wrong

    zSpeed: 26,               // a zombie's shuffle
    zChase: 58,               // and what it does when it has seen her: faster
                              // than she walks, on purpose. Being seen has
                              // to mean breaking its line of sight, not
                              // simply jogging away from it.
    zReact: 0.5,              // but it rears up first, and that is her moment
    zSight: 84,               // how far it sees down its own facing
    zCone: 0.62,              // half-angle of that, in radians (~35 degrees)
    zNear: 20,                // it notices anything this close whatever way it faces
    zLose: 2.0,               // seconds out of sight before it gives up
    zInvestigate: 4.0,        // seconds it will stand and look at a noise

    caughtHold: 1.5,          // how long the close-call beat holds
    camLerp: 0.12,
  };

  /* =======================================================================
     3. LEVELS — grids of characters, one per 16px tile.

        LEGEND
          space  nothing (outside the map)
          .      floor, walkable
          ,      outdoor ground
          #      wall — blocks her and blocks sight
          o      tall furniture / hedge / car — blocks her and blocks sight
          =      low furniture — blocks her, sight passes over it
          h      a hiding place: walkable, and while she is in it nothing
                 can see her (wardrobe, bush, behind the counter, a curtain)
          d      a door she can just open
          D      a door locked with a code — needs the note
          P      a door with no power — needs the wire panel
          W      the wire panel itself
          N      the note with the code on it
          T      the television / a radio — a story beat
          C      a car, in Level 4: the one she gets running
          A      Anwar
          H      the horse
          S      where she starts
          X      the way out — reaching it ends the level
          z      a zombie
          l      a lamp: lights the room around it, walkable
          L      a lamp on a post: lights the street, solid
     ======================================================================= */
  var LEVELS = [];

  /* ---- LEVEL 1 — HOME -------------------------------------------------
     A house at night with the power out: her room and the landing above,
     the living room, the kitchen and the garage below. The television is
     still on in the living room, which is where the news is. The only way
     out is the garage door, and the garage door has no power.
     --------------------------------------------------------------------- */
  LEVELS[0] = {
    theme: "house",
    name: "HOME",
    dark: 0.74,                 // how black the unlit parts of the map go
    grid: [
      "####vv####################v#######",
      "v.h..BB....#..=.....#.=..BB.....o#",
      "#....BB....#........#....BB......#",
      "#...S......#....h...#..z........h#",
      "#..=.......#........#............#",
      "#..........#...=....#.o..=......o#",
      "#####d###########d#########d######",
      "#................................#",
      "#..=.........................o...#",
      "#................................#",
      "#######d########d#########d#######",
      "#..h......FFF..#KKKK.h...#o.....o#",
      "#..T......FFF..#....K....#...W...#",
      "v.......rr=r...#....K....#.......#",
      "v...==..rrrr...#....K....#o.....o#",
      "#...==....o....#...z.....#.......#",
      "#.h............#KKKKKKK..#.......#",
      "#..............#.........#.......#",
      "#############################P####",
      "#,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,#",
      "#,,,,,,,,,,,,,,,,,,,,,,,,,,,,X,,,#",
    ],
    /* The objectives, in order. Each one names the thing that clears it. */
    steps: [
      { task: "The TV is still on downstairs. Go and see.", clears: "tv" },
      { task: "Get out. The garage door has no power.", clears: "panel" },
      { task: "The garage door is open. Go.", clears: "exit" },
    ],
  };


  /* ---- LEVEL 2 — THE STREETS ------------------------------------------
     Three roads across, three roads down, and the blocks between them. It
     is deliberately bigger and more open than the house: there is no one
     way through it, and every route is a trade. The main road east is the
     short one and the worst one. The alleys are slow and dark and safe.
     And behind the shops there is a staff gate with a code on it, which is
     written on a scrap of paper somebody dropped in the corner shop —
     find that and the walk gets a great deal shorter.
     --------------------------------------------------------------------- */
  LEVELS[1] = {
    theme: "street",
    name: "THE STREETS",
    base: ",",
    dark: 0.68,
    grid: [
      "################################################",
      "####,S,.############.,,.################.,,.####",
      "####,,,.############.,,.################.,,.####",
      "####,,,.############.,,.################.,,.####",
      "#....,,L...........c.,,L.................,,L...#",
      "#,,,.,,.,,z,,,,,,,,,.,,.,,,,,,,,,,,,,,,,.,,.,,,#",
      "#,,,.,,.h,,,,.,,,,,,.,,.,,,,z,,,,,,,,,,,.,,.,,,#",
      "#....,,.h...........h,,................c.,,....#",
      "####.,,.#####.######h,,.################.,,.####",
      "####.,,.#####.######.,,...z..............,,.####",
      "####.,,.#####z######.,,.################.,,.####",
      "####.,,.#####.######.,,.################.,h.####",
      "####h,,.#####.######.,,c################.,h.####",
      "#...h,,..............,,c.................,,....#",
      "#,,,.,,.,,,,,,,,,z,,.,,.,,,,,,,,,,z,,,,,.,,.,,,#",
      "#,,,.,,.,,,,,,,,,,,,.,,.,,,,,,,,,,,,,,,,.,,.z,,#",
      "#....,,.....L....hh..,,.......h..........,,....#",
      "####.,,.##d#########.,,.#######.########.,,.####",
      "####.,,......#######.,,.#######.#....hh#.,,.####",
      "####.,,......#######.,,.#######z#..c...#.,,.####",
      "####.,,cKK...#######.,,.#######.D..c...#.,,.####",
      "####.,,c...N.#######.,,.#######.#....c.#.,,.####",
      "####.,,.h....#######.,,.#######.#......#.,,.####",
      "####.,,.#.##########.,,.###########.####.z,.####",
      "#....,,L......hh.....,,L.........##.####.,,.####",
      "#,,,.,,.,,,,,,,,,,,,.,,.z,,,,z,,,##.#####,,#####",
      "#,,,.,,.,,,,,,,,,,,,.,,.,,,,..z...L.......L..h.#",
      "#....,,.....hh.....c.,,....hh.........c.z..cc.h#",
      "####.,,.#########################...........X..#",
      "################################################",
    ],
    steps: [
      { task: "Cross town to the hospital — south, then east.", clears: "exit" },
    ],
  };


  /* ---- LEVEL 3 — THE HOSPITAL -----------------------------------------
     Entrance hall, one corridor east to west and one crossing it, the west
     wing with the plant room in it, and Ward C behind a set of doors with
     no power. He is in the far bay of Ward C.

     There is no clock on the screen. What there is instead: the room tone
     climbs the whole time she is in here, and every twenty seconds or so
     one more of them finds its way in through the front. Nothing about
     that is announced. She is just meant to notice that it is getting
     worse and stop dawdling.
     --------------------------------------------------------------------- */
  LEVELS[2] = {
    theme: "hospital",
    name: "THE HOSPITAL",
    dark: 0.71,
    pressure: true,
    grid: [
      "########################################",
      "##################..####################",
      "##oo............##..##..Bh.Bh.Bh.Bh.B.##",
      "##......=====...##.l##..B..B.lB..B..B.##",
      "##...W.o........##..##................##",
      "##.....o.............P........A.......##",
      "##....z..............P................##",
      "##.l............##..##................##",
      "##......=====...##.z##..B..B..B..B..B.##",
      "##..h.........h.##.l##..BhlBh.Bh.Bh.B.##",
      "##..............##..##................##",
      "##################..####################",
      "#....l.....z..l.........l.....z...l....#",
      "#.......z..............................#",
      "#########.########..####################",
      "##.......d##.....#....................##",
      "##.X......##.ooo.#...KKKKKK.....=====.##",
      "##........##.ooo.#.l...z....hh.....z..##",
      "##........##h....#...............h....##",
      "#########.####.###..####.###############",
      "########......z................#########",
      "########..KKKKKK...l..======...#########",
      "########....l...............l..#########",
      "########...h....BB........h....#########",
      "########...........S......z....#########",
      "########################################",
    ],
    steps: [
      { task: "Ward C has no power on the doors. Find the plant room.", clears: "panel" },
      { task: "Ward C is open. He's in there somewhere.", clears: "anwar" },
      { task: "Get off the corridor. Anywhere with a door that shuts.", clears: "exit" },
    ],
  };


  /* ---- LEVEL 4 — THE ROAD ---------------------------------------------
     Two places, one journey. First the hospital again, which is a great
     deal worse than it was last night, and a car park with something in it
     that might start. Then a lane twenty miles out of town, where the tank
     runs dry and the rest of the way is somebody's horse.

     The swap between the two is the drive itself, which is not a thing she
     plays — it is a thing that happens, painted over the whole canvas.
     --------------------------------------------------------------------- */
  LEVELS[3] = {
    theme: "hospital",
    key: "escape",
    name: "GETTING OUT",
    dark: 0.76,
    grid: [
      "####################################",
      "####################################",
      "##......#.##########....l........###",
      "##..S...d.##########..=.=.=.=.=..###",
      "##.B..h.#.##########...h.....h...###",
      "##......#l##########..=...=...=..###",
      "#########.##########d............###",
      "#########z##########.###############",
      "##.........z.zl...z...z.l.z....l..##",
      "##.............................z..##",
      "#########.##########################",
      "##......#.###........###.....z...###",
      "##.h..h.#l###..h.zh..###.o..o..o.###",
      "##...z..#.......l...........l.B..###",
      "##......#.###.B....B.###...z.....###",
      "##.h....#z###..hz.h..###.o..o..o.###",
      "##......#.###......z.###....d....###",
      "##,z,,,,,,,,,,,,,,,,,,,,,,.....#####",
      "##,,cc,,cc,,,z,,cc,,cc,,,,,....#####",
      "##,,,,l,,,,,C,,,,,,l,,,z,,.....#####",
      "##,,,,,,,,,,,,,,,,,,,,,,,,##########",
      "####################################",
    ],
    steps: [
      { task: "Out of the building. Then find anything with four wheels.", clears: "car" },
      { task: "The tank is dry. Find something else that can carry two.", clears: "horse" },
    ],
  };

  /* The second half of Level 4. It is not in LEVELS because it is not its
     own level — she does not get a card for it, she is already going. */
  var SUBMAPS = {
    roadside: {
      theme: "road",
      key: "roadside",
      name: "THE ROAD",
      base: ",",
      dark: 0.44,                 // dawn: the first level she can actually see in
      grid: [
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
      "################################################",
      ],
    },
  };


  /* ---- LEVEL 5 — THE GATES --------------------------------------------
     Almost no game in this one, on purpose. The road up to the fence, a
     holding pen with a bench and a table in it, and the compound on the
     other side. What happens here is the protocol: they are looked at,
     they are given the serum, and then somebody opens a gate for them.

     It is the quiet after four levels of not being able to stop, and it
     should feel like being allowed to sit down.
     --------------------------------------------------------------------- */
  LEVELS[4] = {
    theme: "road",
    key: "gates",
    name: "THE GATES",
    base: ",",
    dark: 0.30,                   // full morning. Nothing is hiding out here
    grid: [
      "####################################",
      "#,,,,,,,,,,,,,#,,,,,,,,,,#,,,,,,,,,#",
      "#,,,,,,,,,,,,,#,,,,,,,,,,#,,,,,,,,,#",
      "#,,,,,,,,,,,,,#,,,,,,,,,,#,,,,,,,,,#",
      "#,,,,,,,,,,,,,#,,,,,,,,,,#,,,,,,,,,#",
      "#,,,,,,,,,,,,,#..........#....L....#",
      "#,,,,,,,,,,,,,#.L......L.#.L####.L.#",
      "#,,,,,,,,,,,,,#....===...#..####...#",
      "#,,,h,,,,,,,,,#.....Q....#.........#",
      "#.............#..........#.........#",
      "#S............GL........LG......X..#",
      "#.............#..........#.........#",
      "#,,,,,h,,h,,,,#..........#.........#",
      "#,,,,,,,,,,,,,#..======..#..####...#",
      "#,,,,,,,,,,,,,#.L......L.#.L####.L.#",
      "#,,,,,,,,,,,,,#..........#.........#",
      "#,,,,,,,,,,,,,#,,,,,,,,,,#,,,,,,,,,#",
      "#,,,,,,,,,,,,,#,,,,,,,,,,#,,,,,,,,,#",
      "#,,,,,,,,,,,,,#,,,,,,,,,,#,,,,,,,,,#",
      "####################################",
    ],
    steps: [
      { task: "Go up to the gate. Do what they tell you.", clears: "hail" },
      { task: "Wait at the table. They have to look at both of you.", clears: "check" },
      { task: "They're opening the inner gate. Go in.", clears: "exit" },
    ],
  };

  /* =======================================================================
     4. PALETTES — one per place. Everything drawn for a level pulls its
        colours from here, so a whole location can be re-lit in one block.
     ======================================================================= */
  var PAL = {
    house: {
      floor: ["#6b4f34", "#5e442c", "#523a25", "#7a5b3d"],
      wall:  ["#3b3750", "#2e2b40", "#232032", "#4b4767"],
      trim:  "#6b5f48",
      cover: ["#8a6642", "#6e4f33", "#523a25"],
      tall:  ["#4a3a2e", "#3a2d24", "#2b211a"],
      hide:  ["#3d3348", "#2f2739", "#221c2a"],
      ground:["#3a3a42", "#33333b", "#2c2c33"],
      amb:   "#0f1120",
    },
    street: {
      floor: ["#4c505c", "#444754", "#3b3e49", "#5b606e"],   // pavement, catching the sky
      wall:  ["#2b2f3b", "#232733", "#1a1d27", "#363b4a"],   // the buildings behind it
      trim:  "#6a7082",
      cover: ["#4a3f52", "#3c3243", "#2e2634"],
      tall:  ["#2a3a34", "#213028", "#19241f"],
      hide:  ["#26402f", "#1d3325", "#15261b"],
      ground:["#26282f", "#202229", "#1a1c22"],              // tarmac, much darker
      amb:   "#0e1020",
    },
    hospital: {
      floor: ["#93a3a8", "#82929a", "#6f7f88", "#a5b4b8"],
      wall:  ["#5b6d76", "#4c5d66", "#3d4c55", "#6c7e88"],
      trim:  "#9fb0b6",
      cover: ["#7a8a92", "#68787f", "#56656c"],
      tall:  ["#4a5a62", "#3c4a52", "#2e3a42", "#5a6a72"],
      hide:  ["#3f5560", "#33454f", "#26343c"],
      ground:["#5b6d76", "#4c5d66", "#3d4c55"],
      amb:   "#101c26",
    },
    road: {
      floor: ["#6a5a3e", "#5c4d34", "#4e412b", "#7a6a4c"],   // the lane: dirt and gravel
      wall:  ["#4a4034", "#3c342a", "#2e2820", "#5a5042"],   // barns and field walls
      trim:  "#7e6f52",
      cover: ["#5a4a3a", "#4a3c2e", "#3a2f24"],
      tall:  ["#3d5236", "#31432c", "#253422"],
      hide:  ["#35492e", "#2a3a25", "#1f2b1c"],
      ground:["#3f5236", "#36462d", "#2c3a26"],              // and grass either side
      amb:   "#1a1a2c",
    },
  };

  /* =======================================================================
     5. PIXEL HELPERS — the same primitives the rest of the site draws with
     ======================================================================= */
  var BAYER4 = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];

  function px(c, x, y, w, h, col) {
    c.fillStyle = col;
    c.fillRect(x | 0, y | 0, Math.max(1, w | 0), Math.max(1, h | 0));
  }

  /* a deterministic little generator, so a level looks the same every time
     she plays it — nothing here is allowed to shuffle between visits */
  function rnd(seed) {
    var s = seed | 0;
    return function () {
      s = (s * 1103515245 + 12345) & 0x7fffffff;
      return s / 0x7fffffff;
    };
  }

  function ditherFill(c, x0, y0, w, h, stops) {
    for (var y = 0; y < h; y++) {
      var t = y / (h - 1 || 1), i = 0;
      while (i < stops.length - 2 && t > stops[i + 1].p) i++;
      var a = stops[i], b = stops[i + 1];
      var lt = (t - a.p) / ((b.p - a.p) || 1);
      for (var x = 0; x < w; x++) {
        c.fillStyle = lt > (BAYER4[y & 3][x & 3] + 0.5) / 16 ? b.c : a.c;
        c.fillRect(x0 + x, y0 + y, 1, 1);
      }
    }
  }

  function blob(c, cx, cy, rx, ry, tones, lx, ly) {
    lx = lx === undefined ? -0.5 : lx;
    ly = ly === undefined ? -0.6 : ly;
    for (var y = -ry; y <= ry; y++) {
      for (var x = -rx; x <= rx; x++) {
        if ((x * x) / (rx * rx) + (y * y) / (ry * ry) > 1) continue;
        var lit = (x / rx) * lx + (y / ry) * ly;
        var i = lit > 0.34 ? 0 : lit > -0.05 ? 1 : lit > -0.5 ? 2 : 3;
        c.fillStyle = tones[Math.min(i, tones.length - 1)];
        c.fillRect((cx + x) | 0, (cy + y) | 0, 1, 1);
      }
    }
  }

  function mkCanvas(w, h) {
    var c = document.createElement("canvas");
    c.width = w; c.height = h;
    var x = c.getContext("2d");
    x.imageSmoothingEnabled = false;
    return c;
  }

  /* Turn a list of equal-length strings and a palette into a canvas.
     One character per pixel; "." is transparent. Every sprite in this file
     is written this way, because at this size a shaded blob turns to mush —
     the same lesson Super Ouissy learned about Ouissy's face. */
  function sprite(rows, pal) {
    var w = rows[0].length, h = rows.length;
    var c = mkCanvas(w, h), x = c.getContext("2d");
    for (var y = 0; y < h; y++) {
      if (rows[y].length !== w) throw new Error("sprite row " + y + " is " + rows[y].length + ", expected " + w);
      for (var i = 0; i < w; i++) {
        var col = pal[rows[y][i]];
        if (!col) continue;
        x.fillStyle = col;
        x.fillRect(i, y, 1, 1);
      }
    }
    return c;
  }

  /* mirror a sprite canvas, so left and right are one drawing */
  function flip(src) {
    var c = mkCanvas(src.width, src.height), x = c.getContext("2d");
    x.translate(src.width, 0);
    x.scale(-1, 1);
    x.drawImage(src, 0, 0);
    return c;
  }

  /* =======================================================================
     6. SPRITES

        Every character is a torso and a pair of legs, drawn as two pixel
        maps and stacked. That is what lets one walk cycle serve four
        facings without four times the drawing — and it is why her hair and
        her jacket only have to be got right once.

        One character per pixel. The palette is written beside each set.
        Nothing here is a shaded blob: at twelve pixels wide a blob has no
        face at all, which is the lesson Super Ouissy already paid for.
     ======================================================================= */
  var OUI_TORSO = {
    down: ["....hhhh....", "..hhhhhhhh..", ".hhhhhhhhhh.", ".hhssssssHh.", ".hsseseshHh.", ".hssssssshh.", ".hhssmmsshh.", "..hsssssshh.", "...ssssss...", "..cccccccc..", ".sccccccccs.", ".sccccccccs.", ".sccccccccs.", ".SccccccccS.", "..cccccccc.."],
    up: ["....hhhh....", "..hhhhhhhh..", ".hhhhhhhhhh.", ".hhhhhhhhhh.", ".hhhhhhhhhh.", ".hhhhhhhhhh.", ".hhhhhhhhhh.", "..hhhhhhhh..", "...ssssss...", "..cccccccc..", ".sccccccccs.", ".sccccccccs.", ".sccccccccs.", ".SccccccccS.", "..cccccccc.."],
    side: ["....hhhh....", "...hhhhhhh..", "..hhhhhhhh..", "..hhsssssh..", "..hhssessh..", "..hhsssssm..", "..hhssssss..", "...hssssss..", "...ssssss...", "...cccccc...", "..sccccccc..", "..Sccccccc..", "...ccccccs..", "...ccccccS..", "...cccccc..."]
  };

  var OUI_LEGS = {
    stand: ["..jjjjjjjj..", "..jjj..jjj..", "..bbb..bbb.."],
    stepA: ["..jjjjjjjj..", ".jjj....jjj.", ".bbb....bbb."],
    stepB: ["..jjjjjjjj..", "..jjjjjjjj..", "..bbbbbbbb.."]
  };

  var OUI_LEGS_SIDE = {
    stand: ["...jjjjj....", "...jjj.jj...", "...bbb.bb..."],
    stepA: ["...jjjjj....", "..jjj...jj..", "..bbb...bb.."],
    stepB: ["...jjjjj....", "...jjjjj....", "...bbbbb...."]
  };

  var ZOM_TORSO = {
    down: ["....hhhh....", "...hhhhhh...", "..hgggggh...", "..hgeggeg...", "..gggggggg..", "..Ggggkggg..", "...gggggg...", "....gggg....", "..rrrrrrrr..", ".grrrrrrrrg.", ".grrrrrrrrg.", ".Grrrrrrrr..", "..RrrrrrrR..", "..rrrrrrrr..", "..RRrrrrRR.."],
    up: ["....hhhh....", "...hhhhhh...", "..hhhhhhh...", "..hhhhhhh...", "..hhhhhhhh..", "..hhhhhhhh..", "...gggggg...", "....gggg....", "..rrrrrrrr..", ".grrrrrrrrg.", ".grrrrrrrrg.", "..rrrrrrrrG.", "..RrrrrrrR..", "..rrrrrrrr..", "..RRrrrrRR.."],
    side: ["....hhhh....", "...hhhhhh...", "..hhgggggh..", "..hhggeggg..", "..hgggggkg..", "..hgggggg...", "...ggggg....", "....ggg.....", "...rrrrrr...", "..grrrrrrg..", "..Grrrrrrg..", "...rrrrrrg..", "...rrrrrrG..", "...RrrrrR...", "...rrrrrr..."]
  };

  var ZOM_LEGS = {
    stand: ["..kkkkkkkk..", "..kkk..kkk..", "..kk....kk.."],
    stepA: ["..kkkkkkkk..", ".kkk....kkk.", ".kk......kk."],
    stepB: ["..kkkkkkkk..", "..kkkkkkkk..", "..kk..kkkk.."]
  };

  var ZOM_LEGS_SIDE = {
    stand: ["...kkkkk....", "...kkk.kk...", "...kk..kk..."],
    stepA: ["...kkkkk....", "..kkk...kk..", "..kk....kk.."],
    stepB: ["...kkkkk....", "...kkkkk....", "...kkkkk...."]
  };

  var ANW_TORSO = {
    down: ["...hhhhhh...", "..hhhhhhhh..", "..hhhhhhhh..", "..hssssssh..", "..hseseesh..", "..hssssssh..", "...ssmmss...", "...ssssss...", "...ssssss...", "..wwwwwwww..", ".swwwwwwwws.", ".swwwwwwwws.", ".swwwwwwwws.", ".SwwwwwwwwS.", "..wwwwwwww.."]
  };

  var ANW_LEGS = ["..pppppppp..", "..ppp..ppp..", "..bbb..bbb.."];

  /* Anwar asleep, seen from above: head on the pillow, one arm out of the
     blanket, the blanket to his chin. Twelve wide like everyone else so it
     lands on the grid the same way. */
  var ANW_SLEEP = [
    "....hhhh....",
    "...hhhhhh...",
    "..hhssssh...",
    "..hssssssh..",
    "..hs.ss.sh..",
    "..hssmmssh..",
    "...ssssss...",
    "..wwwwwwww..",
    ".wwwwwwwwww.",
    ".wwwwwwwwws.",
    ".wwwwwwwwwS.",
    ".WwwwwwwwwW.",
    ".wwwwwwwwww.",
    ".WWwwwwwwWW.",
    "..wwwwwwww..",
  ];

  /* The horse, side on.

     Drawn rather than written out pixel by pixel, because a horse is all
     curves and a hand-typed pixel map of one comes out as a brown slab with
     a box for a head — which is exactly what the first attempt was. Body,
     chest and rump are three overlapping masses, the neck is a taper
     between two of them, and the legs bend at the knee. Everything is
     placed from the ground she is standing on, so the same routine draws
     her at any size: small enough to stand in a barn, and big enough to
     carry the two of them across a field at dawn.

     She is a big warm animal who has been shut in on her own for two days
     and is very pleased to see anybody at all. That is the scene. */
  var HORSE_TONES = ["#8a6141", "#6f4c31", "#573a25", "#41291a"];
  var HORSE_DARK = ["#2f2015", "#241811", "#1b120c", "#140d08"];

  function limb(c, x0, y0, x1, y1, w0, w1, tones) {
    var n = Math.max(2, Math.hypot(x1 - x0, y1 - y0) | 0);
    for (var i = 0; i <= n; i++) {
      var t = i / n;
      var w = (w0 + (w1 - w0) * t) / 2;
      blob(c, x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, Math.max(1, w), Math.max(1, w), tones, -0.7, -0.3);
    }
  }

  /* x,y is the ground under her front feet; s scales the whole animal */
  function drawHorse(c, x, y, s, gait, flip) {
    var f = flip ? -1 : 1;
    function X(v) { return x + v * s * f; }
    function Y(v) { return y + v * s; }
    function B(vx, vy, rx, ry, tones) { blob(c, X(vx), Y(vy), Math.max(1, rx * s), Math.max(1, ry * s), tones); }

    var sw = Math.sin(gait) * 5, sw2 = Math.sin(gait + 3.14) * 5;

    /* the far pair first, in shadow, so the near pair reads in front */
    limb(c, X(13), Y(-16), X(11 + sw2), Y(-1), 5 * s, 3 * s, HORSE_DARK);
    limb(c, X(-11), Y(-16), X(-13 + sw), Y(-1), 6 * s, 3 * s, HORSE_DARK);

    B(-25, -27, 4, 3, HORSE_DARK);                                    // the dock of the tail
    limb(c, X(-26), Y(-28), X(-30), Y(-9), 7 * s, 4 * s, HORSE_DARK); // and the tail itself

    B(0, -22, 21, 8, HORSE_TONES);                                    // barrel
    B(-15, -23, 11, 9, HORSE_TONES);                                  // rump
    B(14, -23, 10, 9, HORSE_TONES);                                   // chest and shoulder

    limb(c, X(19), Y(-27), X(27), Y(-40), 9 * s, 6 * s, HORSE_TONES); // neck
    B(30, -43, 7, 4, HORSE_TONES);                                    // head
    B(36, -41, 4, 3, HORSE_TONES);                                    // muzzle
    px(c, X(38), Y(-41), Math.max(1, s), Math.max(1, s), "#2a1a12");  // nostril
    px(c, X(31), Y(-45), Math.max(1, 1.6 * s), Math.max(1, 1.6 * s), "#160e08");   // eye
    px(c, X(31.5), Y(-45.5), Math.max(1, 0.7 * s), Math.max(1, 0.7 * s), "#c9b48a");
    limb(c, X(26), Y(-47), X(25), Y(-51), 2.6 * s, 1 * s, HORSE_TONES);            // ears
    limb(c, X(29), Y(-47), X(29), Y(-51), 2.6 * s, 1 * s, HORSE_TONES);

    limb(c, X(20), Y(-40), X(24), Y(-30), 5 * s, 6 * s, HORSE_DARK);  // mane down the crest
    B(17, -29, 4, 3, HORSE_DARK);

    /* the near pair, and the white on the off fore */
    limb(c, X(16), Y(-16), X(18 + sw), Y(-1), 6 * s, 3 * s, HORSE_TONES);
    limb(c, X(-9), Y(-16), X(-7 + sw2), Y(-1), 7 * s, 3 * s, HORSE_TONES);
    px(c, X(17 + sw) - 2 * s, Y(-4), 4 * s, 3 * s, "#c9bda4");        // one white sock
    [[18 + sw, 0], [-7 + sw2, 0], [11 + sw2, 0], [-13 + sw, 0]].forEach(function (h) {
      px(c, X(h[0]) - 2 * s, Y(-1.5), 4 * s, 2.5 * s, "#1d130c");     // hooves
    });
  }

  /* and one baked into a canvas, for the one standing in the barn */
  function horseSprite() {
    var s = 0.42, cv = mkCanvas(34, 28), c = cv.getContext("2d");
    c.imageSmoothingEnabled = false;
    drawHorse(c, 20, 26, s, 0, true);
    return cv;
  }

  var OUI_PAL = {
    h: "#3a2418", H: "#553520", s: "#e8b78f", S: "#c9946c",
    e: "#20140d", m: "#a75b5c", c: "#e2647f", C: "#b84c64",
    j: "#3f4f72", J: "#2e3a55", b: "#2a2028",
  };
  var ZOM_PAL = {
    h: "#2e2a24", g: "#93a487", G: "#71805f", k: "#39412f",
    e: "#b8523a", r: "#5d564b", R: "#443e36",
  };
  var ANW_PAL = {
    h: "#231a14", s: "#d8a273", S: "#b8845a", e: "#1b120c", m: "#96524f",
    w: "#c9d6dd", W: "#a6b5be", p: "#4a5566", b: "#2a2028",
  };

  /* built once, on first use, and kept */
  var ART = null;

  function buildArt() {
    if (ART) return ART;

    function person(torso, legsSet, tPal, lPal, sideLegs) {
      var out = {};
      ["down", "up", "side"].forEach(function (face) {
        var t = torso[face] || torso.down;
        var set = face === "side" ? sideLegs : legsSet;
        out[face] = ["stand", "stepA", "stepB"].map(function (pose) {
          return sprite(t.concat(set[pose]), Object.assign({}, tPal, lPal));
        });
      });
      out.left = out.side.map(flip);
      out.right = out.side;
      return out;
    }

    ANW_TORSO.up = ANW_TORSO.up || ANW_TORSO.down;
    ANW_TORSO.side = ANW_TORSO.side || ANW_TORSO.down;
    ART = {
      ouissy: person(OUI_TORSO, OUI_LEGS, OUI_PAL, OUI_PAL, OUI_LEGS_SIDE),
      zombie: person(ZOM_TORSO, ZOM_LEGS, ZOM_PAL, ZOM_PAL, ZOM_LEGS_SIDE),
      anwar: person(ANW_TORSO, OUI_LEGS, ANW_PAL, ANW_PAL, OUI_LEGS_SIDE),
      anwarAsleep: sprite(ANW_SLEEP, ANW_PAL),
      horse: horseSprite(),
    };
    return ART;
  }

  /* =======================================================================
     7. TILE ART

        A 16x16 canvas per tile character per theme, with four variants of
        the plain ones so a floor does not read as graph paper. The whole
        map is then baked into one big canvas when the level loads, and the
        frame only blits the camera's window out of it — so the cost of all
        this drawing is paid once, not sixty times a second.
     ======================================================================= */
  var T = TUNE.tile;

  function shade(hex, k) {
    var n = parseInt(hex.slice(1), 16);
    var r = Math.max(0, Math.min(255, ((n >> 16) & 255) + k));
    var g = Math.max(0, Math.min(255, ((n >> 8) & 255) + k));
    var b = Math.max(0, Math.min(255, (n & 255) + k));
    return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
  }

  /* --- the plain grounds ------------------------------------------------ */
  function paintFloor(c, P, theme, r) {
    px(c, 0, 0, T, T, P.floor[1]);
    if (theme === "house") {                       // boards, running across
      for (var y = 0; y < T; y += 4) {
        px(c, 0, y, T, 3, y % 8 === 0 ? P.floor[0] : P.floor[1]);
        px(c, 0, y + 3, T, 1, P.floor[2]);
        for (var g = 0; g < 3; g++) px(c, (r() * T) | 0, y + ((r() * 3) | 0), 2, 1, P.floor[2]);
      }
      if (r() > 0.8) px(c, (r() * 12) | 0, (r() * 12) | 0, 3, 2, P.floor[3]);
    } else if (theme === "hospital") {             // lino squares with a seam
      px(c, 0, 0, T, T, r() > 0.5 ? P.floor[0] : P.floor[1]);
      px(c, 0, 0, T, 1, P.floor[3]); px(c, 0, 0, 1, T, P.floor[3]);
      for (var i = 0; i < 5; i++) px(c, (r() * T) | 0, (r() * T) | 0, 1, 1, P.floor[2]);
    } else if (theme === "street") {               // paving slabs, and their joints
      px(c, 0, 0, T, T, P.floor[1]);
      for (var k = 0; k < 26; k++) px(c, (r() * T) | 0, (r() * T) | 0, 1 + ((r() * 2) | 0), 1, P.floor[(r() * 4) | 0]);
      px(c, 0, 0, T, 1, P.floor[3]); px(c, 0, 0, 1, T, P.floor[3]);
      px(c, 0, T - 1, T, 1, P.floor[2]);
      if (r() > 0.82) for (k = 0; k < 4; k++) px(c, (r() * T) | 0, (r() * T) | 0, 2, 1, "#3d4a38");  // weeds in the joints
    } else {                                        // dirt, speckled
      for (var k2 = 0; k2 < 34; k2++) {
        px(c, (r() * T) | 0, (r() * T) | 0, 1 + ((r() * 2) | 0), 1, P.floor[(r() * 4) | 0]);
      }
    }
  }

  function paintGround(c, P, theme, r, E) {
    px(c, 0, 0, T, T, P.ground[1]);
    for (var k = 0; k < 22; k++) px(c, (r() * T) | 0, (r() * T) | 0, 1, 1, P.ground[(r() * 3) | 0]);
    E = E || {};
    if (theme === "street") {                                  // tarmac: cracks, patches, litter
      if (r() > 0.7) px(c, 0, (r() * T) | 0, T, 1, P.ground[2]);
      if (r() > 0.86) blob(c, (r() * T) | 0, (r() * T) | 0, 3, 2, [P.ground[0], P.ground[0], P.ground[2], P.ground[2]]);
      if (r() > 0.93) px(c, (r() * T) | 0, (r() * T) | 0, 2, 2, "#8a8474");
    }
    if (theme === "road") {                                   // grass, growing every way
      for (var g = 0; g < 26; g++) {
        px(c, (r() * T) | 0, (r() * T) | 0, 1, 1 + ((r() * 3) | 0),
           r() > 0.6 ? "#4b6040" : r() > 0.3 ? "#3a4c30" : "#566b45");
      }
      if (r() > 0.9) { var fx = (r() * T) | 0, fy = (r() * T) | 0;   // a wildflower
        px(c, fx, fy - 2, 1, 2, "#4b6040"); px(c, fx - 1, fy - 3, 3, 2, r() > 0.5 ? "#d8c86a" : "#c9a0c0"); }
    }
    /* Where the tarmac stops, a kerb and a worn white line. Two pixels of
       paint is the whole difference between "a grey field" and "a road". */
    if (theme === "street") {
      if (E.n) { px(c, 0, 0, T, 1, "#5e6472"); px(c, 0, 2, T, 1, "#b9bcc4"); }
      if (E.s) { px(c, 0, T - 1, T, 1, "#5e6472"); px(c, 0, T - 3, T, 1, "#b9bcc4"); }
      if (E.w) { px(c, 0, 0, 1, T, "#5e6472"); px(c, 2, 0, 1, T, "#b9bcc4"); }
      if (E.e) { px(c, T - 1, 0, 1, T, "#5e6472"); px(c, T - 3, 0, 1, T, "#b9bcc4"); }
      /* and the paint is old: break it up rather than laying a perfect line */
      for (var w = 0; w < 5; w++) px(c, (r() * T) | 0, (r() * T) | 0, 2 + ((r() * 3) | 0), 1, P.ground[0]);
    }
  }

  /* --- the things that stop her ---------------------------------------- */
  function paintWall(c, P, theme, r, E) {
    E = E || {};
    px(c, 0, 0, T, T, P.wall[1]);
    if (theme === "house") {                       // papered wall: a quiet stripe
      for (var x = 2; x < T; x += 6) px(c, x, 0, 1, T, shade(P.wall[1], 9));
      for (var i = 0; i < 5; i++) px(c, (r() * T) | 0, (r() * T) | 0, 2, 2, shade(P.wall[1], -7));
      for (i = 0; i < 10; i++) px(c, (r() * T) | 0, (r() * T) | 0, 1, 1, shade(P.wall[1], r() > 0.5 ? 13 : -11));
    } else if (theme === "hospital") {             // glazed tile
      for (var y = 0; y < T; y += 8) {
        for (var x2 = (y % 16 ? 4 : 0); x2 < T; x2 += 8) {
          px(c, x2, y, 7, 7, r() > 0.5 ? P.wall[0] : P.wall[1]);
        }
      }
    } else {                                        // brick and render
      for (var yy = 0; yy < T; yy += 5) {
        for (var xx = (yy % 10 ? 4 : 0) - 4; xx < T; xx += 8) {
          px(c, xx, yy, 7, 4, r() > 0.55 ? P.wall[0] : P.wall[1]);
        }
      }
      /* A window, but only in a wall that actually faces the street, and
         only on the side that faces it. A window in the middle of a block
         is a window into next door's bathroom. Some of them are still lit:
         the city is empty, it is not switched off. */
      var facade = E.n || E.s || E.w || E.e;
      if (theme === "street" && facade && r() > 0.62) {
        var wx = E.w ? 2 : E.e ? T - 8 : 4 + ((r() * 4) | 0);
        var wy = E.n ? 2 : E.s ? T - 8 : 4 + ((r() * 4) | 0);
        px(c, wx - 1, wy - 1, 8, 8, "#12151c");
        var lit = r();
        px(c, wx, wy, 6, 6, lit > 0.76 ? "#c9a05a" : lit > 0.5 ? "#39445a" : "#0d1016");
        if (lit > 0.76) {                                   // a curtain across half of it
          px(c, wx, wy, 6, 2, "#8d6f3d");
          px(c, wx + 4, wy, 2, 6, "#8d6f3d");
        }
        px(c, wx + 3, wy, 1, 6, "#12151c");                 // the glazing bars
        px(c, wx, wy + 3, 6, 1, "#12151c");
        px(c, wx - 1, wy + 6, 8, 1, shade(P.wall[3], 10));  // the sill
      }
    }
    px(c, 0, 0, T, 2, P.wall[3]);                  // the lit top edge
    px(c, 0, 2, T, 1, shade(P.wall[3], -18));
    px(c, 0, T - 3, T, 2, P.trim);                 // the skirting board along its foot
    px(c, 0, T - 1, T, 1, shade(P.wall[2], -22));  // and the shadow it throws on the floor
  }

  function paintTall(c, P, theme, r) {              // wardrobe, hedge, parked car
    paintFloor(c, P, theme, r);
    if (theme === "street" || theme === "road") {   // a hedge: clumped foliage
      for (var i = 0; i < 30; i++) {
        var x = (r() * T) | 0, y = (r() * T) | 0;
        blob(c, x, y, 2 + ((r() * 2) | 0), 2, [P.tall[0], P.tall[0], P.tall[1], P.tall[2]]);
      }
    } else {                                        // a cabinet, seen from above
      px(c, 1, 1, T - 2, T - 2, P.tall[1]);
      px(c, 1, 1, T - 2, 2, P.tall[0]);
      px(c, 1, T - 3, T - 2, 2, P.tall[2]);
      px(c, T / 2 | 0, 3, 1, T - 7, P.tall[2]);     // the split between the doors
      px(c, (T / 2 | 0) - 2, 8, 1, 2, P.trim);      // handles
      px(c, (T / 2 | 0) + 2, 8, 1, 2, P.trim);
    }
  }

  /* A table, a bench, a low wall — the catch-all. Sight passes over all of
     these; they stop her, they do not hide her. */
  function paintCover(c, P, theme, r) {
    paintFloor(c, P, theme, r);
    px(c, 0, 2, T, T - 4, P.cover[2]);              // the shadow under it
    px(c, 0, 1, T, T - 5, P.cover[1]);              // the top
    px(c, 0, 1, T, 2, P.cover[0]);                  // the lit near edge
    px(c, 0, T - 3, T, 1, shade(P.cover[2], -16));
    for (var i = 0; i < 5; i++) px(c, (r() * T) | 0, 3 + ((r() * 7) | 0), 3, 1, shade(P.cover[1], 8));
  }

  /* A bed: pillow at the head, a turned-down duvet, the frame under it.

     From here on the furniture painters take E — which of the tile's four
     sides face something that is not the same piece of furniture. That is
     what lets a bed two tiles long be one bed with one pillow and one foot
     instead of two small beds side by side, without a tile being drawn by
     hand for every combination. */
  function paintBed(c, P, theme, r, E) {
    paintFloor(c, P, theme, r);
    var ward = theme === "hospital";
    var frame = ward ? "#8a949c" : "#4a3a30";
    var cover = ward ? "#9fb4c4" : "#8a5a68";
    var coverLit = ward ? "#b8c9d6" : "#a06e7c";
    var coverDark = ward ? "#7e909e" : "#7a4c5c";
    var x0 = E.w ? 1 : 0, x1 = E.e ? T - 1 : T;
    px(c, x0, 0, x1 - x0, T, frame);                          // the frame
    if (ward) {                                                // and its rails
      px(c, x0, 0, 1, T, "#b0bcc4"); px(c, x1 - 1, 0, 1, T, "#6e7880");
    }
    if (E.n) {
      px(c, x0 + 1, 1, x1 - x0 - 2, 5, "#eef2f4");            // the pillow
      px(c, x0 + 1, 2, x1 - x0 - 2, 1, "#fbfdfe");
      if (ward) px(c, x0 + 1, 6, x1 - x0 - 2, 2, "#e8eef2");  // the sheet folded over it
      px(c, x0 + 1, ward ? 8 : 6, x1 - x0 - 2, T - (ward ? 9 : 7), cover);
      px(c, x0 + 1, ward ? 8 : 6, x1 - x0 - 2, 2, coverLit);
    } else {
      px(c, x0 + 1, 0, x1 - x0 - 2, T - 1, cover);
      for (var i = 0; i < 3; i++) px(c, x0 + 2 + i * 4, 2, 1, T - 5, coverDark);
    }
    if (E.s) px(c, x0 + 1, T - 2, x1 - x0 - 2, 1, coverDark);
  }

  /* A sofa from above: the back along whichever side faces the wall, an arm
     at each end, cushions between. */
  var SOFA = ["#8a5560", "#6d414c", "#523039"];
  function paintSofa(c, P, theme, r, E) {
    paintFloor(c, P, theme, r);
    P = { cover: theme === "house" ? SOFA : P.cover };
    px(c, 0, 1, T, T - 2, P.cover[2]);
    var top = 0;
    if (E.n) { px(c, 0, 0, T, 5, P.cover[1]); px(c, 0, 0, T, 1, P.cover[0]); top = 5; }
    if (E.w) px(c, 0, top, 3, T - top - 1, P.cover[1]);
    if (E.e) px(c, T - 3, top, 3, T - top - 1, P.cover[1]);
    var cx0 = E.w ? 3 : 0, cx1 = E.e ? T - 3 : T;
    px(c, cx0, top + 1, cx1 - cx0, T - top - 3, shade(P.cover[0], -8));
    px(c, cx0, top + 1, cx1 - cx0, 1, P.cover[0]);
    if (!E.w) px(c, cx0, top + 1, 1, T - top - 3, shade(P.cover[0], -16));   // the seam
    if (E.s) px(c, 0, T - 2, T, 1, shade(P.cover[2], -18));
  }

  /* A run of kitchen units: the worktop catches the light, the doors and
     their handles face the room. */
  function paintCounter(c, P, theme, r, E) {
    paintFloor(c, P, theme, r);
    px(c, 0, 0, T, T - 2, "#5a4a3c");
    px(c, 0, 0, T, 3, "#8a7a62");
    px(c, 0, 3, T, 1, "#463a2e");
    if (E.s) {
      px(c, 0, T - 3, T, 3, "#39301f");
      px(c, T / 2 | 0, 4, 1, T - 8, "#463a2e");
      px(c, 3, 7, 3, 1, "#b0a48a");
      px(c, 10, 7, 3, 1, "#b0a48a");
    }
    if (E.w) px(c, 0, 0, 1, T - 2, "#6a5a48");
    if (E.e) px(c, T - 1, 0, 1, T - 2, "#3d3226");
    for (var i = 0; i < 4; i++) px(c, (r() * T) | 0, 1, 2, 1, "#9a8a70");
  }

  /* --- the places she can disappear into -------------------------------- */
  function paintHide(c, P, theme, r) {
    paintFloor(c, P, theme, r);
    if (theme === "street" || theme === "road") {   // a bush, gappy enough to sit in
      for (var i = 0; i < 26; i++) {
        blob(c, (r() * T) | 0, (r() * T) | 0, 2 + ((r() * 2) | 0), 2, [P.hide[0], P.hide[0], P.hide[1], P.hide[2]]);
      }
      px(c, 6, 9, 4, 5, shade(P.hide[2], -14));     // the gap she gets into
    } else if (theme === "hospital") {              // a curtain, half pulled round
      px(c, 0, 1, T, 2, "#9aa6ac");                  // the rail
      px(c, 0, 1, T, 1, "#c2ccd2");
      for (var k = 1; k < T; k += 3) px(c, k, 2, 1, 1, "#6e787e");   // the hooks
      px(c, 0, 3, T, T - 3, "#6f8f88");              // the curtain itself
      for (var fd = 0; fd < T; fd += 3) {
        px(c, fd, 3, 1, T - 3, "#83a49c");
        px(c, fd + 2, 3, 1, T - 3, "#5b7872");
      }
      px(c, 0, T - 2, T, 1, "#4e6862");              // its hem
      px(c, 5, 5, 5, T - 8, "#33443f");              // and the gap she gets behind
    } else {                                        // a wardrobe, door ajar
      px(c, 1, 1, T - 2, T - 2, P.hide[1]);
      px(c, 1, 1, T - 2, 2, P.hide[0]);
      px(c, 4, 3, 8, T - 6, shade(P.hide[2], -18));  // the dark of the inside
      px(c, 3, 3, 1, T - 6, P.hide[0]);
      px(c, 12, 3, 1, T - 6, P.hide[0]);
      for (var f = 4; f < 12; f += 3) px(c, f, 3, 1, T - 6, shade(P.hide[2], 8)); // folds
    }
  }

  /* --- the things she uses ---------------------------------------------- */
  function paintDoor(c, P, theme, r, kind) {
    paintFloor(c, P, theme, r);
    px(c, 0, 0, T, T, shade(P.wall[2], -6));
    px(c, 2, 1, T - 4, T - 2, P.trim);
    px(c, 3, 2, T - 6, T - 4, shade(P.trim, -26));
    if (kind === "locked") {                        // a keypad screwed to it
      px(c, 5, 5, 6, 7, "#20242e");
      px(c, 6, 6, 4, 2, "#7fe0b0");
      for (var y = 9; y < 12; y++) for (var x = 6; x < 10; x += 2) px(c, x, y, 1, 1, "#5a6070");
    } else if (kind === "power") {                  // a roller door, dead
      for (var s = 1; s < T - 1; s += 3) px(c, 1, s, T - 2, 2, s % 6 ? P.trim : shade(P.trim, -20));
      px(c, 12, 12, 2, 2, "#a83a3a");
    } else {
      px(c, T - 5, T / 2 | 0, 2, 2, "#d8c48a");     // handle
    }
  }

  function paintPanel(c, P, theme, r) {             // the wire panel, closed
    paintWall(c, P, theme, r, {});
    px(c, 2, 3, T - 4, T - 6, "#2a2d34");
    px(c, 2, 3, T - 4, 1, "#4a4f5a");
    px(c, 3, 5, T - 6, T - 9, "#1a1d22");
    for (var i = 0; i < 4; i++) px(c, 4, 6 + i * 2, T - 8, 1, ["#c08a2e", "#a8402e", "#3f6a9a", "#4a7a4a"][i]);
    px(c, T - 5, T - 6, 2, 2, "#a83a3a");
  }

  function paintTv(c, P, theme, r) {
    paintFloor(c, P, theme, r);
    px(c, 1, 4, T - 2, T - 7, "#1b1d22");
    px(c, 2, 5, T - 4, T - 10, "#8fa8c8");          // the screen, lit
    for (var y = 5; y < T - 5; y += 2) px(c, 2, y, T - 4, 1, "#b9cde6");
    px(c, 5, T - 3, 6, 2, "#2a2d34");               // the stand
  }

  /* A lamp stands on whatever the ground round it is, which sounds obvious
     and was not: painted on its own it always drew the level's outdoor
     ground, so a lamp post inside a concrete yard came with its own square
     of grass round it. `under` is the character of the ground it is
     actually standing on, worked out from its neighbours when the map is
     baked. */
  function paintLamp(c, P, theme, r, solid, under) {
    if (under === ".") paintFloor(c, P, theme, r);
    else if (under === ",") paintGround(c, P, theme, r, {});
    if (solid) {                                     // a lamp on a post, in the street
      if (!under) paintGround(c, P, theme, r, {});
      px(c, 7, 2, 2, T - 3, "#3a3f4a");
      px(c, 4, 1, 8, 3, "#4a505c");
      px(c, 5, 2, 6, 2, "#ffe0a0");
    } else if (theme === "hospital") {               // a strip light, overhead
      if (!under) paintFloor(c, P, theme, r);
      px(c, 1, 6, T - 2, 4, "#8c979e");
      px(c, 2, 7, T - 4, 2, r() > 0.42 ? "#f2f8ff" : "#5c666c");  // a good few are out
      px(c, 1, 10, T - 2, 1, "#5c666c");
    } else {                                         // a lamp standing in a room
      if (!under) paintFloor(c, P, theme, r);
      px(c, 7, 6, 2, 8, "#3a3f4a");
      px(c, 4, 3, 8, 4, "#e8c98a");
      px(c, 5, 4, 6, 2, "#fff0c0");
    }
  }

  /* A car, left where it stopped. Roof, windscreen, bonnet and both wings,
     seen from above. She can get behind one; nothing sees through one. */
  var CAR_COLS = [
    ["#7a2f34", "#5c2226", "#3f181b"],
    ["#2f4a6a", "#22374f", "#17263a"],
    ["#6a6660", "#4e4b46", "#35332f"],
    ["#3f5a44", "#2e4232", "#1f2d22"],
  ];
  function paintCar(c, P, theme, r, E) {
    paintGround(c, P, theme, r);
    var col = CAR_COLS[(r() * CAR_COLS.length) | 0];
    px(c, 2, 0, T - 4, T, col[1]);                    // the body, nose to tail
    px(c, 1, 2, 1, T - 4, col[2]);                    // the wings
    px(c, T - 2, 2, 1, T - 4, col[2]);
    px(c, 2, 0, T - 4, 1, col[0]);
    if (E.n) {                                         // this end is the bonnet
      px(c, 3, 1, T - 6, 4, col[0]);
      px(c, 3, 5, T - 6, 4, "#1b2630");                // the windscreen
      px(c, 3, 5, T - 6, 1, "#3d5468");
      px(c, 2, 1, 2, 1, "#e8dcb0"); px(c, T - 4, 1, 2, 1, "#e8dcb0");   // lamps
    } else if (E.s) {                                  // and this one the boot
      px(c, 3, T - 5, T - 6, 4, col[0]);
      px(c, 3, T - 9, T - 6, 4, "#1b2630");
      px(c, 2, T - 2, 2, 1, "#7a2a26"); px(c, T - 4, T - 2, 2, 1, "#7a2a26");
    } else {
      px(c, 3, 2, T - 6, T - 4, "#20303c");            // the roof between them
      px(c, 3, 2, T - 6, 1, "#3d5468");
    }
    px(c, 0, 3, 2, 3, "#16181c"); px(c, 0, T - 6, 2, 3, "#16181c");     // wheels
    px(c, T - 2, 3, 2, 3, "#16181c"); px(c, T - 2, T - 6, 2, 3, "#16181c");
    for (var i = 0; i < 5; i++) px(c, (r() * T) | 0, (r() * T) | 0, 1, 1, shade(col[2], 12));
  }

  /* A window. It is in a wall, so it stops her and stops sight — but the
     night comes through it, which is the whole point: a room with a window
     is a room she can read without the torch. */
  function paintWindow(c, P, theme, r) {
    paintWall(c, P, theme, r, {});
    px(c, 2, 2, T - 4, T - 5, "#2a3550");
    px(c, 3, 3, T - 6, T - 7, "#4a6a96");
    px(c, 3, 3, T - 6, 3, "#6d90bd");                 // the sky in the top pane
    px(c, T / 2 | 0, 2, 1, T - 5, P.trim);            // the glazing bars
    px(c, 2, 8, T - 4, 1, P.trim);
    px(c, 1, 1, T - 2, 1, shade(P.trim, 20));         // the frame
    px(c, 1, T - 4, T - 2, 2, P.trim);
    for (var i = 0; i < 3; i++) px(c, 4 + ((r() * 8) | 0), 4 + ((r() * 8) | 0), 1, 1, "#93b4dd");
  }

  /* A rug. Nothing mechanical at all — it is here because a room with one
     reads as somebody's room and a room without one reads as a grid. */
  function paintRug(c, P, theme, r, E) {
    paintFloor(c, P, theme, r);
    px(c, 0, 0, T, T, "#5a3b34");                     // a worn red, not a pink slab
    for (var y = 0; y < T; y += 3) px(c, 0, y, T, 1, "#513430");
    for (var i = 0; i < 7; i++) px(c, (r() * T) | 0, (r() * T) | 0, 2, 1, "#6b4740");
    for (i = 0; i < 4; i++) px(c, 2 + ((r() * 11) | 0), 2 + ((r() * 11) | 0), 2, 2, "#7d5a45");
    if (E.n) { px(c, 0, 0, T, 2, "#3e2823"); px(c, 0, 2, T, 1, "#7a544a"); }
    if (E.s) { px(c, 0, T - 2, T, 2, "#3e2823"); }
    if (E.w) { px(c, 0, 0, 2, T, "#3e2823"); px(c, 2, 0, 1, T, "#7a544a"); }
    if (E.e) { px(c, T - 2, 0, 2, T, "#3e2823"); }
  }

  /* A gate in a chain-link fence, with a sheet of road sign welded across
     the middle of it because whoever built this had a road sign and no
     steel plate. */
  function paintGate(c, P, theme, r) {
    paintGround(c, P, theme, r, {});
    px(c, 1, 0, T - 2, T, "#4e545c");
    px(c, 2, 1, T - 4, T - 2, "#2b2f36");
    for (var y = 1; y < T - 1; y += 3) {                    // the mesh
      for (var x = 2; x < T - 2; x += 3) px(c, x, y, 1, 1, "#6a7079");
    }
    px(c, 2, 5, T - 4, 7, "#7a8a6a");                       // the sign, bolted on
    px(c, 2, 5, T - 4, 1, "#96a684");
    px(c, 4, 7, T - 8, 3, "#e8ecd8");
    px(c, 1, 0, 2, T, "#5c636c");                           // the frame
    px(c, T - 3, 0, 2, T, "#3d434a");
    px(c, 6, T - 5, 4, 3, "#c9a05a");                       // the bolt
  }

  function paintExit(c, P, theme, r) {
    paintGround(c, P, theme, r);
    for (var y = 2; y < T - 1; y += 4) px(c, 3, y, T - 6, 2, "#e8d48a");
    px(c, 2, 1, 1, T - 2, "#c9b06a");
    px(c, T - 3, 1, 1, T - 2, "#c9b06a");
  }

  /* --- the atlas -------------------------------------------------------
     Tiles are cached by character, by which of their sides are outside
     edges, and by which of four variants they drew — so a floor is not
     graph paper and a sofa is not four sofas.
     --------------------------------------------------------------------- */
  var VARIANTS = 4;
  var EDGED = "BFK=rc,#";             // the pieces that care about their neighbours

  function tileFor(cache, theme, ch, mask, v, under) {
    var key = ch + "|" + mask + "|" + v + "|" + (under || "");
    if (cache[key]) return cache[key];
    var P = PAL[theme];
    var cv = mkCanvas(T, T), c = cv.getContext("2d");
    var r = rnd(1000 + ch.charCodeAt(0) * 97 + v * 13 + mask * 7);
    var E = { n: !!(mask & 1), s: !!(mask & 2), w: !!(mask & 4), e: !!(mask & 8) };
    if (ch === ".") paintFloor(c, P, theme, r);
    else if (ch === ",") paintGround(c, P, theme, r, E);
    else if (ch === "#") paintWall(c, P, theme, r, E);
    else if (ch === "o") paintTall(c, P, theme, r);
    else if (ch === "=") paintCover(c, P, theme, r);
    else if (ch === "B") paintBed(c, P, theme, r, E);
    else if (ch === "F") paintSofa(c, P, theme, r, E);
    else if (ch === "K") paintCounter(c, P, theme, r, E);
    else if (ch === "c") paintCar(c, P, theme, r, E);
    else if (ch === "v") paintWindow(c, P, theme, r);
    else if (ch === "r") paintRug(c, P, theme, r, E);
    else if (ch === "h") paintHide(c, P, theme, r);
    else if (ch === "d") paintDoor(c, P, theme, r, "plain");
    else if (ch === "D") paintDoor(c, P, theme, r, "locked");
    else if (ch === "P") paintDoor(c, P, theme, r, "power");
    else if (ch === "W") paintPanel(c, P, theme, r);
    else if (ch === "T") paintTv(c, P, theme, r);
    else if (ch === "G") paintGate(c, P, theme, r);
    else if (ch === "X") paintExit(c, P, theme, r);
    else if (ch === "l") paintLamp(c, P, theme, r, false, under);
    else if (ch === "L") paintLamp(c, P, theme, r, true, under);
    else paintFloor(c, P, theme, r);
    cache[key] = cv;
    return cv;
  }

  /* =======================================================================
     8. THE LEVEL

        Turning a grid of characters into: what stops her, what stops sight,
        where she can disappear, what she can use, and who else is walking
        about. The map art is baked into one canvas here too.
     ======================================================================= */
  var SOLID = "#vco=BFKWTLCA";     // she cannot walk through these (G is a door)
  var OPAQUE = "#vcoh";            // and sight cannot pass these
  var ENTITY = "SzAHN";            // drawn as bare floor; something stands on it

  function buildLevel(def) {
    var g = def.grid, h = g.length, w = g[0].length;
    var base = def.base || ".";
    var L = {
      def: def, w: w, h: h, theme: def.theme,
      cells: [], doors: {}, zombies: [], things: [], start: null, exit: null,
      anwar: null, horse: null, lights: [],
    };

    for (var y = 0; y < h; y++) {
      if (g[y].length !== w) throw new Error("level row " + y + " is " + g[y].length + " wide, expected " + w);
      var row = [];
      for (var x = 0; x < w; x++) {
        var ch = g[y][x];
        var draw = ch;
        if (ENTITY.indexOf(ch) >= 0) draw = base;
        if (ch === "S") L.start = { x: x * T + T / 2, y: y * T + T / 2 };
        if (ch === "X") L.exit = { x: x, y: y };
        if (ch === "z") L.zombies.push(mkZombie(x * T + T / 2, y * T + T / 2));
        if (ch === "A") { L.anwar = { x: x * T + T / 2, y: y * T + T / 2, awake: false }; draw = "B"; }
        if (ch === "H") { L.horse = { x: x * T + T / 2, y: y * T + T / 2 }; L.things.push({ kind: "horse", x: x, y: y, done: false }); }
        if (ch === "N") L.things.push({ kind: "note", x: x, y: y, done: false });
        if (ch === "T") L.things.push({ kind: "tv", x: x, y: y, done: false });
        if (ch === "W") L.things.push({ kind: "panel", x: x, y: y, done: false });
        if (ch === "Q") L.things.push({ kind: "check", x: x, y: y, done: false });
        if (ch === "C") L.things.push({ kind: "car", x: x, y: y, done: false });
        if (ch === "G") L.doors[x + "," + y] = { open: false, kind: "story" };
        if (ch === "d") L.doors[x + "," + y] = { open: false, kind: "plain" };
        if (ch === "D") L.doors[x + "," + y] = { open: false, kind: "locked" };
        if (ch === "P") L.doors[x + "," + y] = { open: false, kind: "power" };
        if (ch === "v") L.lights.push({ x: x * T + T / 2, y: y * T + T + 6, r: 58, warm: -0.9 });
        if (ch === "l") L.lights.push({ x: x * T + T / 2, y: y * T + T / 2, r: def.theme === "hospital" ? 60 : 62,
                                        warm: def.theme === "hospital" ? -0.5 : 1,
                                        flicker: def.theme === "hospital" && ((x + y) % 3 === 0) });
        if (ch === "L") L.lights.push({ x: x * T + T / 2, y: y * T + T / 2, r: 74, warm: 1 });
        if (ch === "T") L.lights.push({ x: x * T + T / 2, y: y * T + T / 2, r: 44, warm: 0.35, tv: true });
        row.push({ ch: ch, draw: draw });
      }
      L.cells.push(row);
    }
    if (!L.start) throw new Error("level has no S");

    /* bake the map: one canvas, drawn once, blitted from ever after */
    var cache = {};
    L.map = mkCanvas(w * T, h * T);
    var mc = L.map.getContext("2d");
    function sameAs(d, xx, yy) {
      return yy >= 0 && yy < h && xx >= 0 && xx < w && L.cells[yy][xx].draw === d;
    }
    for (y = 0; y < h; y++) {
      for (x = 0; x < w; x++) {
        var d = L.cells[y][x].draw;
        if (d === " ") continue;
        var mask = 0;
        if (EDGED.indexOf(d) >= 0) {
          if (!sameAs(d, x, y - 1)) mask |= 1;
          if (!sameAs(d, x, y + 1)) mask |= 2;
          if (!sameAs(d, x - 1, y)) mask |= 4;
          if (!sameAs(d, x + 1, y)) mask |= 8;
        }
        var under = null;
        if (d === "l" || d === "L") {                 // what is this lamp standing on?
          [[0, -1], [0, 1], [-1, 0], [1, 0]].some(function (n) {
            var nb = (L.cells[y + n[1]] || [])[x + n[0]];
            if (nb && (nb.draw === "." || nb.draw === ",")) { under = nb.draw; return true; }
            return false;
          });
        }
        mc.drawImage(tileFor(cache, def.theme, d, mask, (x * 7 + y * 13) % VARIANTS, under), x * T, y * T);
      }
    }
    return L;
  }

  function at(L, tx, ty) {
    if (tx < 0 || ty < 0 || ty >= L.h || tx >= L.w) return "#";
    return L.cells[ty][tx].ch;
  }

  function isSolid(L, tx, ty) {
    var ch = at(L, tx, ty);
    if (ch === " ") return true;
    var door = L.doors[tx + "," + ty];
    if (door) return !door.open;
    return SOLID.indexOf(ch) >= 0;
  }

  function isOpaque(L, tx, ty) {
    var ch = at(L, tx, ty);
    if (ch === " ") return true;
    var door = L.doors[tx + "," + ty];
    if (door) return !door.open;
    return OPAQUE.indexOf(ch) >= 0;
  }

  function isHide(L, tx, ty) { return at(L, tx, ty) === "h"; }

  /* a straight line between two points, stopped by anything opaque */
  function canSee(L, x0, y0, x1, y1) {
    var dx = x1 - x0, dy = y1 - y0;
    var steps = Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / 4);
    for (var i = 1; i < steps; i++) {
      var t = i / steps;
      if (isOpaque(L, ((x0 + dx * t) / T) | 0, ((y0 + dy * t) / T) | 0)) return false;
    }
    return true;
  }

  /* =======================================================================
     9. LIGHT

        A half-resolution light map: black where the dark is, white where
        something is lit, multiplied over the finished frame. Half res on
        purpose — at full resolution the falloff is a smooth photographic
        vignette, which does not belong on a canvas where everything else
        is a 16-pixel tile.
     ======================================================================= */
  var LW = 160, LH = 90;
  var lightCv = null, lightCx = null;

  function ensureLight() {
    if (lightCv) return;
    lightCv = mkCanvas(LW, LH);
    lightCx = lightCv.getContext("2d");
  }

  function paintLight(G) {
    ensureLight();
    var L = G.level, c = lightCx, dark = L.def.dark;
    /* The unlit value, and the colour of it.

       These have to be two separate things. The tint used to be baked into
       the value — the base colour was v times a fixed cold multiplier —
       which meant that even a level with dark set to zero came out
       multiplied by about a half and tinted blue, so the one daylight level
       in the chapter rendered as another night. The tint now fades out with
       the dark: at dark 0 this is white and the map is painted exactly as
       it was drawn; at dark 0.75 it is the cold blue the night levels want. */
    var v = 255 * (1 - dark);
    var R = Math.round(Math.max(0, Math.min(255, v * (1 - 0.38 * dark))));
    var Gc = Math.round(Math.max(0, Math.min(255, v * (1 - 0.26 * dark))));
    var B = Math.round(Math.max(0, Math.min(255, v * (1 + 0.30 * dark))));
    c.globalCompositeOperation = "source-over";
    c.fillStyle = "rgb(" + R + "," + Gc + "," + B + ")";
    c.fillRect(0, 0, LW, LH);
    c.globalCompositeOperation = "lighter";

    function pool(wx, wy, radius, warm, strength) {
      var sx = (wx - G.cam.x) / 2, sy = (wy - G.cam.y) / 2, sr = radius / 2;
      if (sx < -sr || sy < -sr || sx > LW + sr || sy > LH + sr) return;
      var grd = c.createRadialGradient(sx, sy, 0, sx, sy, sr);
      var a = strength === undefined ? 1 : strength;
      grd.addColorStop(0, "rgba(255," + (238 - warm * 30) + "," + (215 - warm * 70) + "," + a + ")");
      grd.addColorStop(0.55, "rgba(" + (210 - warm * 20) + "," + (196 - warm * 40) + "," + (172 - warm * 60) + "," + (a * 0.45) + ")");
      grd.addColorStop(1, "rgba(0,0,0,0)");
      c.fillStyle = grd;
      c.fillRect(sx - sr, sy - sr, sr * 2, sr * 2);
    }

    for (var i = 0; i < L.lights.length; i++) {
      var li = L.lights[i];
      var s = 1;
      if (li.tv) s = 0.75 + 0.25 * Math.sin(G.t * 9 + i);       // the set flickers
      if (li.flicker) s = 0.55 + 0.45 * (Math.sin(G.t * 3.1 + i) > -0.4 ? 1 : 0.2);
      pool(li.x, li.y, li.r, li.warm, s);
    }
    /* her torch, thrown a little way ahead of her */
    var p = G.player;
    var tr = (p.creeping ? TUNE.torchCreep : TUNE.torch) * (1 + 0.02 * Math.sin(G.t * 5));
    pool(p.x + p.fx * 9, p.y + p.fy * 9 - 2, tr * 2, 0.5, 1);
    pool(p.x, p.y - 2, tr, 0.4, 0.9);

    c.globalCompositeOperation = "source-over";
  }

  /* =======================================================================
     10. THE PLAYER
     ======================================================================= */
  function mkPlayer(x, y) {
    return {
      x: x, y: y, vx: 0, vy: 0,
      face: "down", fx: 0, fy: 1,       // fx/fy is the facing as a vector
      anim: 0, frame: 0,
      creeping: false, hidden: false, seen: 0,
      noiseT: 0,
    };
  }

  /* she is a small box at her feet, not the whole 12x18 drawing — walking
     behind a sofa should not be blocked by her hair */
  var PW = 9, PH = 7;

  function freeAt(L, x, y) {
    var x0 = ((x - PW / 2) / T) | 0, x1 = ((x + PW / 2 - 0.01) / T) | 0;
    var y0 = ((y - PH / 2) / T) | 0, y1 = ((y + PH / 2 - 0.01) / T) | 0;
    for (var ty = y0; ty <= y1; ty++) {
      for (var tx = x0; tx <= x1; tx++) if (isSolid(L, tx, ty)) return false;
    }
    return true;
  }

  function stepPlayer(G, dt) {
    var p = G.player, L = G.level, k = G.keys;
    var ax = (k.right ? 1 : 0) - (k.left ? 1 : 0);
    var ay = (k.down ? 1 : 0) - (k.up ? 1 : 0);
    var len = Math.hypot(ax, ay) || 1;
    ax /= len; ay /= len;

    p.creeping = !!k.sneak;
    var top = p.creeping ? TUNE.creep : TUNE.walk;

    if (ax || ay) {
      p.vx += ax * TUNE.accel * dt;
      p.vy += ay * TUNE.accel * dt;
      p.fx = ax; p.fy = ay;
      p.face = Math.abs(ax) > Math.abs(ay) ? (ax > 0 ? "right" : "left") : (ay > 0 ? "down" : "up");
    } else {
      var f = TUNE.friction * dt;
      var sp = Math.hypot(p.vx, p.vy);
      if (sp <= f) { p.vx = 0; p.vy = 0; }
      else { p.vx -= (p.vx / sp) * f; p.vy -= (p.vy / sp) * f; }
    }
    var s = Math.hypot(p.vx, p.vy);
    if (s > top) { p.vx = (p.vx / s) * top; p.vy = (p.vy / s) * top; }

    /* the two axes are resolved separately, so a shoulder catching a door
       frame slides her along it instead of stopping her dead */
    var nx = p.x + p.vx * dt;
    if (freeAt(L, nx, p.y)) p.x = nx; else p.vx = 0;
    var ny = p.y + p.vy * dt;
    if (freeAt(L, p.x, ny)) p.y = ny; else p.vy = 0;

    /* plain doors open by being walked into; that is loud */
    var tx = (p.x / T) | 0, ty = (p.y / T) | 0;
    [[tx + (p.fx > 0 ? 1 : p.fx < 0 ? -1 : 0), ty], [tx, ty + (p.fy > 0 ? 1 : p.fy < 0 ? -1 : 0)]].forEach(function (c) {
      var d = L.doors[c[0] + "," + c[1]];
      if (d && !d.open && d.kind === "plain" && Math.hypot(c[0] * T + T / 2 - p.x, c[1] * T + T / 2 - p.y) < 20) {
        d.open = true;
        makeNoise(G, c[0] * T + T / 2, c[1] * T + T / 2, TUNE.noiseDoor);
        sfx("door");
        G.doorFx.push({ x: c[0] * T + T / 2, y: c[1] * T + T / 2, t: 0 });
      }
    });

    p.hidden = isHide(L, tx, ty);

    /* animation, and the sound of her own feet */
    var moving = s > 4;
    if (moving) {
      p.anim += dt * (p.creeping ? 4 : 7.5);
      p.frame = 1 + (((p.anim | 0) % 2));
      p.noiseT -= dt;
      if (p.noiseT <= 0) {
        p.noiseT = p.creeping ? 0.9 : 0.45;
        if (!p.creeping) makeNoise(G, p.x, p.y, TUNE.noiseWalk);
        sfx(p.creeping ? "creep" : "step");
      }
    } else {
      p.frame = 0; p.anim = 0;
    }
  }

  /* =======================================================================
     11. THE ZOMBIES

        They patrol, they see down a cone in front of them, they hear, and
        when they catch her the game does not punish her: the screen goes
        quiet, she gets pulled back to the last place she was safe, and she
        tries again. That is the whole penalty, on purpose. This is still a
        love letter — it is just set in a bad week.
     ======================================================================= */
  var DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

  function mkZombie(x, y) {
    return {
      x: x, y: y, hx: x, hy: y,        // hx/hy is the spot it started from
      fx: 0, fy: 1, state: "patrol", timer: 1 + Math.random() * 2,
      tx: 0, ty: 0, anim: Math.random() * 4, frame: 0, lost: 0, alert: 0, react: 0,
    };
  }

  function zFreeAt(L, x, y) {
    var r = 4;
    return !isSolid(L, ((x - r) / T) | 0, ((y - r) / T) | 0) &&
           !isSolid(L, ((x + r) / T) | 0, ((y - r) / T) | 0) &&
           !isSolid(L, ((x - r) / T) | 0, ((y + r) / T) | 0) &&
           !isSolid(L, ((x + r) / T) | 0, ((y + r) / T) | 0);
  }

  function zSees(G, z) {
    var p = G.player;
    if (p.hidden) return false;
    var dx = p.x - z.x, dy = p.y - z.y;
    var d = Math.hypot(dx, dy);
    /* crouched and moving slowly, she is a shape rather than a person —
       so SHIFT is worth holding for more than the quiet */
    if (d > TUNE.zSight * (p.creeping ? 0.68 : 1)) return false;
    if (!canSee(G.level, z.x, z.y, p.x, p.y)) return false;
    if (d < TUNE.zNear) return true;
    var fl = Math.hypot(z.fx, z.fy) || 1;
    var dot = (dx * z.fx + dy * z.fy) / (d * fl);
    return dot > Math.cos(TUNE.zCone);
  }

  function stepZombie(G, z, dt) {
    var L = G.level, sp = TUNE.zSpeed;

    if (zSees(G, z)) {
      if (z.state !== "chase") {
        /* the moment it notices her. It stops dead, straightens up, and
           makes a sound — which is both her half-second to get behind
           something and the reason everything else nearby starts walking
           this way. */
        z.react = TUNE.zReact;
        sfx("spot");
        makeNoise(G, z.x, z.y, 120);
      }
      z.state = "chase";
      z.lost = 0;
      z.tx = G.player.x; z.ty = G.player.y;
      z.alert = Math.min(1, z.alert + dt * 3);
    } else if (z.state === "chase") {
      z.lost += dt;
      if (z.lost > TUNE.zLose) { z.state = "look"; z.timer = TUNE.zInvestigate; }
    }

    if (z.state === "chase") {
      var dx = z.tx - z.x, dy = z.ty - z.y, d = Math.hypot(dx, dy) || 1;
      z.fx = dx / d; z.fy = dy / d;
      if (z.react > 0) { z.react -= dt; sp = 0; }
      else sp = TUNE.zChase;
    } else if (z.state === "look") {
      z.alert = Math.max(0, z.alert - dt * 0.5);
      var lx = z.tx - z.x, ly = z.ty - z.y, ld = Math.hypot(lx, ly);
      if (ld > 8) { z.fx = lx / ld; z.fy = ly / ld; sp = TUNE.zSpeed * 1.15; }
      else {
        z.timer -= dt;
        z.fx = Math.cos(G.t * 1.4 + z.hx); z.fy = Math.sin(G.t * 1.4 + z.hx);
        sp = 0;
        if (z.timer <= 0) z.state = "patrol";
      }
    } else {
      z.alert = Math.max(0, z.alert - dt * 0.7);
      z.timer -= dt;
      if (z.timer <= 0) {
        z.timer = 1.4 + Math.random() * 2.6;
        var d2 = DIRS[(Math.random() * 4) | 0];
        z.fx = d2[0]; z.fy = d2[1];
      }
      if (Math.random() < dt * 0.35) sp = 0;      // they stop and sway
    }

    if (sp > 0) {
      var nx = z.x + z.fx * sp * dt, ny = z.y + z.fy * sp * dt;
      var movedX = zFreeAt(L, nx, z.y), movedY = zFreeAt(L, z.x, ny);
      if (movedX) z.x = nx;
      if (movedY) z.y = ny;
      if (!movedX && !movedY) {                    // walked into something: turn
        var d3 = DIRS[(Math.random() * 4) | 0];
        z.fx = d3[0]; z.fy = d3[1];
        z.timer = 0.8 + Math.random();
      }
      z.anim += dt * (z.state === "chase" ? 6 : 3);
      z.frame = 1 + ((z.anim | 0) % 2);
    } else {
      z.frame = 0;
    }

    z.face = Math.abs(z.fx) > Math.abs(z.fy) ? (z.fx > 0 ? "right" : "left") : (z.fy > 0 ? "down" : "up");

    if (!G.player.hidden && Math.hypot(z.x - G.player.x, z.y - G.player.y) < 9) caught(G);
  }

  /* =======================================================================
     THE PRESSURE

        Level 3 has no clock on it, because a clock would turn finding him
        into an exam. What it has instead is weather: the room tone climbs,
        the light gets a little worse, and every so often one more of them
        finds the way in through the front doors and starts walking. None
        of that is announced. She is only meant to notice, somewhere around
        the third or fourth one, that this is going the wrong way and she
        should stop reading every sign.
     ======================================================================= */
  var PRESSURE_FULL = 165;          // seconds to the worst it gets
  var PRESSURE_EVERY = 21;          // and one more of them, this often

  function stepPressure(G, dt) {
    if (!G.level.def.pressure) return;
    G.pressure = Math.min(1, (G.pressure || 0) + dt / PRESSURE_FULL);
    G.pressureT = (G.pressureT || 0) - dt;
    if (G.pressureT > 0) return;
    G.pressureT = PRESSURE_EVERY;
    if (G.level.zombies.length > 22) return;

    /* it comes in at the front and it comes in a long way from her, so the
       level gets heavier without anything ever appearing on top of her */
    var L = G.level, best = null, bd = -1;
    for (var i = 0; i < 60; i++) {
      var tx = 1 + ((Math.random() * (L.w - 2)) | 0);
      var ty = 1 + ((Math.random() * (L.h - 2)) | 0);
      if (isSolid(L, tx, ty) || isHide(L, tx, ty)) continue;
      var d = Math.hypot(tx * T - G.player.x, ty * T - G.player.y);
      if (d > bd) { bd = d; best = { x: tx, y: ty }; }
    }
    if (best && bd > 110) {
      L.zombies.push(mkZombie(best.x * T + T / 2, best.y * T + T / 2));
      sfx("arrive");
    }
  }

  function makeNoise(G, x, y, radius) {
    if (radius <= 0) return;
    G.noises.push({ x: x, y: y, r: radius, t: 0 });
    for (var i = 0; i < G.level.zombies.length; i++) {
      var z = G.level.zombies[i];
      if (z.state === "chase") continue;
      if (Math.hypot(z.x - x, z.y - y) < radius) {
        z.state = "look"; z.tx = x; z.ty = y; z.timer = TUNE.zInvestigate;
        z.alert = Math.max(z.alert, 0.5);
      }
    }
  }

  /* =======================================================================
     12. PAINTING A FRAME

        Order matters and it is always the same: the baked map, then the
        things standing on it sorted back to front, then the light map
        multiplied over all of it, then the vision cones and the HUD marks
        on top — because a cone you cannot see in the dark is not a warning.
     ======================================================================= */
  var VW = 320, VH = 180;

  function drawShadow(c, x, y) {
    c.globalAlpha = 0.35;
    px(c, x - 5, y - 1, 10, 2, "#05060c");
    px(c, x - 3, y + 1, 6, 1, "#05060c");
    c.globalAlpha = 1;
  }

  function paint(G) {
    var c = G.ctx, L = G.level;
    c.clearRect(0, 0, VW, VH);

    /* a cutscene owns the whole canvas; nothing of the level is painted */
    if (G.state === "cut" && G.cut) {
      G.cut.paint(G, c, G.cut.t);
      if (G.cut.t < 0.6) {                         // fade in from the level
        c.fillStyle = "rgba(4,5,10," + (1 - G.cut.t / 0.6) + ")";
        c.fillRect(0, 0, VW, VH);
      }
      if (G.cut.t > G.cut.dur - 0.6) {             // and out again
        c.fillStyle = "rgba(4,5,10," + (1 - (G.cut.dur - G.cut.t) / 0.6) + ")";
        c.fillRect(0, 0, VW, VH);
      }
      return;
    }

    c.fillStyle = PAL[L.theme].amb;
    c.fillRect(0, 0, VW, VH);

    var cx = Math.round(G.cam.x), cy = Math.round(G.cam.y);
    c.drawImage(L.map, cx, cy, VW, VH, 0, 0, VW, VH);

    /* everything that stands up, painted in y order so she can walk behind
       a wardrobe and be behind it */
    var actors = [];
    actors.push({ y: G.player.y, draw: function () { drawActor(G, c, ART.ouissy, G.player, cx, cy); } });
    L.zombies.forEach(function (z) {
      actors.push({ y: z.y, draw: function () { drawActor(G, c, ART.zombie, z, cx, cy, z.alert); } });
    });
    if (L.horse) {
      var hh = L.horse;
      actors.push({ y: hh.y, draw: function () {
        var x = Math.round(hh.x - cx), y = Math.round(hh.y - cy);
        drawShadow(c, x + 2, y + 2);
        c.drawImage(ART.horse, x - 20, y - 24);
      } });
    }
    if (L.anwar) {
      var a = L.anwar;
      actors.push({ y: a.y + (a.awake ? 0 : 4), draw: function () {
        if (a.awake) drawActor(G, c, ART.anwar, a, cx, cy);
        else {
          var x = Math.round(a.x - cx), y = Math.round(a.y - cy);
          c.drawImage(ART.anwarAsleep, x - 6, y - 9);
        }
      } });
    }
    actors.sort(function (a, b) { return a.y - b.y; });
    actors.forEach(function (a) { a.draw(); });

    /* the marks that say "there is something here" */
    L.things.forEach(function (t) {
      if (t.done) return;
      var wx = t.x * T + T / 2 - cx, wy = t.y * T + T / 2 - cy;
      if (wx < -20 || wx > VW + 20) return;
      var near = Math.hypot(t.x * T + T / 2 - G.player.x, t.y * T + T / 2 - G.player.y) < 22;
      var bob = Math.sin(G.t * 3 + t.x) * 1.5;
      if (t.kind === "note") {                       // a torn scrap on the floor
        px(c, wx - 3, wy - 2 + bob, 7, 5, "#e6d9b4");
        px(c, wx - 3, wy - 2 + bob, 7, 1, "#f4ead0");
        px(c, wx - 1, wy + bob, 3, 1, "#8a7a56");
      }
      if (near) {                                    // the prompt
        px(c, wx - 1, wy - 13 + bob, 2, 6, "#ffe9a8");
        px(c, wx - 1, wy - 5 + bob, 2, 2, "#ffe9a8");
      }
    });

    /* the light map, blown up over the frame */
    paintLight(G);
    c.globalCompositeOperation = "multiply";
    c.drawImage(lightCv, 0, 0, LW, LH, 0, 0, VW, VH);
    c.globalCompositeOperation = "source-over";

    /* vision cones, over the dark, because they are the warning */
    L.zombies.forEach(function (z) { drawCone(c, G, z, cx, cy); });

    /* the ring a noise made, fading */
    G.noises.forEach(function (n) {
      var a = 1 - n.t / 0.8;
      if (a <= 0) return;
      /* loud enough to be worth watching, faint enough not to be a
         searchlight — a footstep should whisper, a door should not */
      var weight = Math.min(1, n.r / TUNE.noiseDoor);
      c.strokeStyle = "rgba(255,214,150," + (a * a * 0.16 * (0.4 + weight)) + ")";
      c.lineWidth = 1;
      c.beginPath();
      c.arc(n.x - cx, n.y - cy, n.r * (0.35 + 0.65 * (n.t / 0.8)), 0, 6.2832);
      c.stroke();
    });

    /* a door swinging open */
    G.doorFx.forEach(function (d) {
      var a = 1 - d.t / 0.5;
      if (a <= 0) return;
      c.strokeStyle = "rgba(220,200,160," + (a * 0.6) + ")";
      c.strokeRect(d.x - cx - 8, d.y - cy - 8, 16, 16);
    });

    /* the pressure, as weather rather than as a number */
    if (G.pressure > 0.02) {
      var pg = c.createRadialGradient(VW / 2, VH / 2, VH * 0.34, VW / 2, VH / 2, VH * 0.95);
      pg.addColorStop(0, "rgba(90,10,18,0)");
      pg.addColorStop(1, "rgba(90,10,18," + (0.34 * G.pressure) + ")");
      c.fillStyle = pg;
      c.fillRect(0, 0, VW, VH);
    }

    if (G.state === "caught") paintCaught(G, c);
    if (G.flash > 0) {
      c.fillStyle = "rgba(255,255,255," + Math.min(0.8, G.flash) + ")";
      c.fillRect(0, 0, VW, VH);
    }
  }

  function drawActor(G, c, set, a, cx, cy, alert) {
    var img = (set[a.face] || set.down)[a.frame || 0];
    var x = Math.round(a.x - cx), y = Math.round(a.y - cy);
    if (x < -20 || x > VW + 20 || y < -30 || y > VH + 30) return;
    drawShadow(c, x, y + 2);
    var alpha = 1;
    if (a === G.player && a.hidden) alpha = 0.45;    // she is inside something
    c.globalAlpha = alpha;
    c.drawImage(img, x - 6, y - 15);
    c.globalAlpha = 1;
    if (alert > 0.15) {                              // the mark over an alerted one
      var yy = y - 22 - Math.sin(G.t * 8) * 1;
      var col = alert > 0.8 ? "#ff5a4a" : "#ffc24a";
      px(c, x - 1, yy, 2, 5, col);
      px(c, x - 1, yy + 6, 2, 2, col);
      if (a.react > 0) {                             // and the half-second it rears up
        var k = a.react / TUNE.zReact;
        c.strokeStyle = "rgba(255,90,74," + (0.7 * k) + ")";
        c.lineWidth = 1;
        c.beginPath();
        c.arc(x, y - 6, 10 + (1 - k) * 12, 0, 6.2832);
        c.stroke();
      }
    }
  }

  function drawCone(c, G, z, cx, cy) {
    if (z.state === "chase") c.fillStyle = "rgba(255,80,64,.16)";
    else if (z.state === "look") c.fillStyle = "rgba(255,190,90,.12)";
    else c.fillStyle = "rgba(190,210,255,.075)";
    var a = Math.atan2(z.fy, z.fx);
    var x = z.x - cx, y = z.y - cy;
    var steps = 16, r = TUNE.zSight;
    c.beginPath();
    c.moveTo(x, y);
    for (var i = 0; i <= steps; i++) {
      var ang = a - TUNE.zCone + (2 * TUNE.zCone * i) / steps;
      var dx = Math.cos(ang), dy = Math.sin(ang), hit = r;
      for (var d = 6; d < r; d += 5) {               // stop the cone at a wall
        if (isOpaque(G.level, ((z.x + dx * d) / T) | 0, ((z.y + dy * d) / T) | 0)) { hit = d; break; }
      }
      c.lineTo(x + dx * hit, y + dy * hit);
    }
    c.closePath();
    c.fill();
  }

  function paintCaught(G, c) {
    var k = Math.min(1, G.caughtT / 0.35);
    c.fillStyle = "rgba(6,4,10," + (0.82 * k) + ")";
    c.fillRect(0, 0, VW, VH);
  }

  /* =======================================================================
     13. THE CLOSE CALL

        Not a death. She is grabbed at, she gets away, and she comes back to
        the last place she was safe. The screen holds still for a moment and
        says something short, and then she is playing again.
     ======================================================================= */
  var CLOSE_CALLS = [
    "Too close. You pull free and don't look back.",
    "A hand catches your sleeve. You leave the sleeve.",
    "You get out of there before it can turn round.",
    "You back away. It loses you in the dark.",
    "You run. It doesn't follow far.",
  ];

  function caught(G) {
    if (G.state !== "play") return;
    G.state = "caught";
    G.caughtT = 0;
    G.caughtLine = CLOSE_CALLS[(Math.random() * CLOSE_CALLS.length) | 0];
    G.closeCalls++;
    sfx("caught");
    setHud(G);
  }

  function recover(G) {
    var p = G.player, s = G.safe;
    p.x = s.x; p.y = s.y; p.vx = 0; p.vy = 0;
    G.level.zombies.forEach(function (z) {
      z.state = "patrol"; z.alert = 0; z.timer = 2 + Math.random() * 2;
      /* and they wander off, so she is not dropped straight back into it */
      if (Math.hypot(z.x - s.x, z.y - s.y) < 70) { z.x = z.hx; z.y = z.hy; }
    });
    G.noises.length = 0;
    G.state = "play";
    G.flash = 0.5;
    snapCam(G);
  }

  /* The last place she was safe, which is where a close call puts her back.

     Being inside something always counts, however close the thing outside
     it is — that is what a hiding place is for, and it means the wardrobes
     and the bushes double as checkpoints. Otherwise it wants a bit of quiet:
     nothing chasing, and nothing within four tiles. Generous on purpose. A
     close call that sends her back across half the level is a punishment,
     and this chapter does not have those. */
  function updateSafe(G, dt) {
    var p = G.player;
    G.safeT -= dt;
    if (G.safeT > 0) return;
    G.safeT = 0.4;
    if (!freeAt(G.level, p.x, p.y)) return;
    if (p.hidden) { G.safe = { x: p.x, y: p.y }; return; }
    var near = false;
    G.level.zombies.forEach(function (z) {
      if (z.state === "chase" || Math.hypot(z.x - p.x, z.y - p.y) < 60) near = true;
    });
    if (!near) G.safe = { x: p.x, y: p.y };
  }

  /* =======================================================================
     14. THE CAMERA
     ======================================================================= */
  function clampCam(G) {
    var L = G.level;
    G.cam.x = Math.max(0, Math.min(L.w * T - VW, G.cam.x));
    G.cam.y = Math.max(0, Math.min(L.h * T - VH, G.cam.y));
    if (L.w * T < VW) G.cam.x = (L.w * T - VW) / 2;
    if (L.h * T < VH) G.cam.y = (L.h * T - VH) / 2;
  }
  function snapCam(G) {
    G.cam.x = G.player.x - VW / 2;
    G.cam.y = G.player.y - VH / 2;
    clampCam(G);
  }
  function stepCam(G) {
    var tx = G.player.x - VW / 2, ty = G.player.y - VH / 2;
    G.cam.x += (tx - G.cam.x) * TUNE.camLerp;
    G.cam.y += (ty - G.cam.y) * TUNE.camLerp;
    clampCam(G);
  }

  /* =======================================================================
     15. THE SCREEN FURNITURE

        Cards, prompts and the close-call line are DOM, not canvas, for the
        same reason Super Ouissy's are: six-pixel text blown up five times
        cannot be read, however good the panel behind it looks.
     ======================================================================= */
  function $(id) { return document.getElementById(id); }

  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html !== undefined) e.innerHTML = html;
    return e;
  }

  function overlay() { return $("ap-overlay"); }

  function openOverlay(node, cls) {
    var o = overlay();
    o.innerHTML = "";
    o.className = "ap-overlay" + (cls ? " " + cls : "");
    o.appendChild(node);
    o.setAttribute("aria-hidden", "false");
  }

  function closeOverlay() {
    var o = overlay();
    o.setAttribute("aria-hidden", "true");
    o.innerHTML = "";
    o.className = "ap-overlay";
    /* Drop the handles the overlay left behind. They are only read by the
       offline harness, but a stale one is worse than none: reaching for
       "the panel" a level later found the previous level's, solved it a
       second time, and powered a door in a building she had left. */
    if (G) { G.__panel = null; G.__keypad = null; }
  }

  function setHud(G) {
    if (!G.level) return;
    $("ap-place").textContent = G.level.def.name;
    $("ap-task").textContent = G.step ? G.step.task : "";
    var carry = [];
    if (G.code) carry.push("CODE " + G.code);
    if (G.closeCalls) carry.push("close calls: " + G.closeCalls);
    $("ap-carry").textContent = carry.join("   ");
    var st = $("ap-state");
    var seen = G.level.zombies.some(function (z) { return z.state === "chase"; });
    var looking = G.level.zombies.some(function (z) { return z.state === "look"; });
    st.className = "ap-state" + (seen ? " seen" : G.player.hidden ? " hidden-ok" : "");
    st.textContent = seen ? "SEEN" : looking ? "SOMETHING HEARD YOU" : G.player.hidden ? "HIDDEN" : "";
  }

  /* ---- a plain card, used for the level briefings and the how-to ---- */
  function card(title, sub, rows, buttonText, onGo) {
    var c = el("div", "ap-card");
    c.appendChild(el("p", "ap-card-kicker", title));
    c.appendChild(el("h3", "ap-card-title", sub));
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
    var b = el("button", "ap-card-go", buttonText);
    b.addEventListener("click", onGo);
    c.appendChild(b);
    return c;
  }

  /* ---- the close-call beat ---- */
  function showCloseCall(G) {
    var c = el("div", "ap-close");
    c.appendChild(el("p", "ap-close-line", G.caughtLine));
    c.appendChild(el("p", "ap-close-sub", "you're all right. keep going."));
    openOverlay(c, "thin");
  }

  /* ---- dialogue ---- */
  function say(G, lines, done) {
    G.dlg = { lines: lines.slice(), i: 0, done: done };
    G.state = "dialogue";
    nextLine(G);
  }

  function nextLine(G) {
    var d = G.dlg;
    if (!d || d.i >= d.lines.length) {
      $("ap-dlg").setAttribute("aria-hidden", "true");
      G.dlg = null;
      G.state = "play";
      if (d && d.done) d.done();
      return;
    }
    var line = d.lines[d.i++];
    var quiet = !line[1];
    $("ap-dlg-name").textContent = line[0] || "";
    $("ap-dlg-text").textContent = quiet ? "\u2026" : line[1];
    $("ap-dlg").classList.toggle("quiet", quiet);
    $("ap-dlg").classList.toggle("narration", !line[0] && !quiet);
    $("ap-dlg").setAttribute("aria-hidden", "false");
    if (!quiet) sfx("blip");
  }

  /* =======================================================================
     16. SOUND — Web Audio, no files. Quiet by design: this chapter is
         mostly the sound of her own feet and a room tone that will not let
         you relax.
     ======================================================================= */
  var actx = null, master = null, room = null;

  function audio() {
    if (actx) return actx;
    try {
      actx = new (window.AudioContext || window.webkitAudioContext)();
      master = actx.createGain();
      master.gain.value = 0.5;
      master.connect(actx.destination);
    } catch (e) { actx = null; }
    return actx;
  }

  function tone(freq, dur, type, vol, slideTo) {
    var a = audio(); if (!a) return;
    var o = a.createOscillator(), g = a.createGain();
    o.type = type || "square";
    o.frequency.setValueAtTime(freq, a.currentTime);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), a.currentTime + dur);
    g.gain.setValueAtTime(0.0001, a.currentTime);
    g.gain.exponentialRampToValueAtTime(vol || 0.08, a.currentTime + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + dur);
    o.connect(g); g.connect(master);
    o.start(); o.stop(a.currentTime + dur + 0.02);
  }

  function noiseBurst(dur, vol, filterHz) {
    var a = audio(); if (!a) return;
    var n = a.sampleRate * dur;
    var buf = a.createBuffer(1, n, a.sampleRate);
    var d = buf.getChannelData(0);
    for (var i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    var s = a.createBufferSource(); s.buffer = buf;
    var f = a.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = filterHz || 1200;
    var g = a.createGain(); g.gain.value = vol || 0.06;
    s.connect(f); f.connect(g); g.connect(master);
    s.start();
  }

  function sfx(kind) {
    if (!audio()) return;
    switch (kind) {
      case "step":    noiseBurst(0.06, 0.045, 700); break;
      case "creep":   noiseBurst(0.05, 0.016, 380); break;
      case "door":    noiseBurst(0.3, 0.06, 900); tone(120, 0.25, "sawtooth", 0.035, 80); break;
      case "blip":    tone(880, 0.05, "square", 0.03); break;
      case "connect": tone(520, 0.08, "square", 0.05); tone(780, 0.12, "square", 0.04); break;
      case "spark":   noiseBurst(0.12, 0.07, 4200); tone(210, 0.1, "sawtooth", 0.04, 90); break;
      case "power":   tone(160, 0.5, "sawtooth", 0.05, 320); tone(240, 0.7, "sine", 0.04, 480); break;
      case "caught":  tone(200, 0.5, "sawtooth", 0.09, 60); noiseBurst(0.4, 0.09, 600); break;
      case "found":   tone(660, 0.1, "sine", 0.05); tone(880, 0.18, "sine", 0.045); break;
      case "spot":    tone(320, 0.35, "sawtooth", 0.07, 130); noiseBurst(0.35, 0.06, 900); break;
      case "arrive":  tone(78, 0.9, "sine", 0.045, 52); noiseBurst(0.5, 0.03, 340); break;
      case "deny":    tone(150, 0.18, "square", 0.05, 110); break;
    }
  }

  /* a low room tone that runs under the whole chapter */
  function startRoom() {
    var a = audio(); if (!a || room) return;
    var o = a.createOscillator(), o2 = a.createOscillator(), g = a.createGain(), f = a.createBiquadFilter();
    o.type = "sine"; o.frequency.value = 54;
    o2.type = "sine"; o2.frequency.value = 81.5;
    f.type = "lowpass"; f.frequency.value = 320;
    g.gain.value = 0.05;
    o.connect(f); o2.connect(f); f.connect(g); g.connect(master);
    o.start(); o2.start();
    room = { o: o, o2: o2, g: g };
  }
  function stopRoom() {
    if (!room) return;
    try { room.o.stop(); room.o2.stop(); } catch (e) {}
    room = null;
  }

  /* =======================================================================
     17. THE GAME LOOP

        A fixed timestep, so how she feels to control does not depend on
        what the device can manage. Order: input has already landed, then
        step the world, then the camera, then paint.
     ======================================================================= */
  var G = null, raf = null, lastT = 0, acc = 0, booted = false;
  var STEP = 1 / 60;

  function onScreen() {
    var s = $("screen-apoc");
    return s && s.classList.contains("active");
  }

  function step(G, dt) {
    LAST_DT = dt;
    G.t += dt;
    G.flash = Math.max(0, G.flash - dt * 2);

    for (var i = G.noises.length - 1; i >= 0; i--) {
      G.noises[i].t += dt;
      if (G.noises[i].t > 0.8) G.noises.splice(i, 1);
    }
    for (i = G.doorFx.length - 1; i >= 0; i--) {
      G.doorFx[i].t += dt;
      if (G.doorFx[i].t > 0.5) G.doorFx.splice(i, 1);
    }

    if (G.state === "caught") {
      G.caughtT += dt;
      if (G.caughtT > 0.35 && !G.caughtShown) { G.caughtShown = true; showCloseCall(G); }
      if (G.caughtT > TUNE.caughtHold + 0.6) {
        G.caughtShown = false;
        closeOverlay();
        recover(G);
      }
      return;
    }

    if (G.state === "cut") { stepCut(G, dt); return; }
    if (G.state !== "play") return;

    stepPlayer(G, dt);
    stepPressure(G, dt);
    for (i = 0; i < G.level.zombies.length; i++) stepZombie(G, G.level.zombies[i], dt);
    updateSafe(G, dt);
    checkTriggers(G);
    G.hudT -= dt;
    if (G.hudT <= 0) {
      G.hudT = 0.15;
      setHud(G);
      if (room && room.g) {
        var lean = G.level.def.pressure ? (G.pressure || 0) : 0;
        room.g.gain.value = 0.05 + lean * 0.07;
        room.o2.frequency.value = 81.5 + lean * 9;
      }
    }
  }

  function frame(now) {
    raf = requestAnimationFrame(frame);
    if (!G || !onScreen()) return;
    if (window.__apTestDrive) { if (G.level) { stepCam(G); paint(G); } return; }
    if (!lastT) lastT = now;
    var dt = Math.min(0.1, (now - lastT) / 1000);
    lastT = now;
    acc += dt;
    var guard = 0;
    while (acc >= STEP && guard++ < 6) { step(G, STEP); acc -= STEP; }
    if (G.level) { stepCam(G); paint(G); }
  }

  /* =======================================================================
     18. INPUT
     ======================================================================= */
  var KEYMAP = {
    ArrowLeft: "left", a: "left", A: "left", q: "left", Q: "left",
    ArrowRight: "right", d: "right", D: "right",
    ArrowUp: "up", w: "up", W: "up", z: "up", Z: "up",
    ArrowDown: "down", s: "down", S: "down",
    Shift: "sneak",
    e: "use", E: "use", " ": "use", Enter: "use",
  };

  function freshKeys() {
    return { left: false, right: false, up: false, down: false, sneak: false, use: false };
  }

  function bindInput() {
    document.addEventListener("keydown", function (e) {
      if (!onScreen() || !G) return;
      if (e.key === "Escape") { e.preventDefault(); togglePause(); return; }
      if (G.state === "dialogue") {
        if (e.key === " " || e.key === "Enter" || e.key === "e" || e.key === "E") { e.preventDefault(); nextLine(G); }
        return;
      }
      var k = KEYMAP[e.key];
      if (!k) return;
      e.preventDefault();
      if (k === "use" && !G.keys.use) doUse(G);
      G.keys[k] = true;
    }, { passive: false });

    document.addEventListener("keyup", function (e) {
      if (!onScreen() || !G) return;
      var k = KEYMAP[e.key];
      if (!k) return;
      G.keys[k] = false;
    });

    /* the phone pad */
    document.querySelectorAll("[data-ap-key]").forEach(function (b) {
      var k = b.getAttribute("data-ap-key");
      function down(ev) {
        ev.preventDefault();
        if (!G) return;
        if (k === "use") { if (G.state === "dialogue") nextLine(G); else doUse(G); return; }
        G.keys[k] = true;
      }
      function up(ev) { ev.preventDefault(); if (G) G.keys[k] = false; }
      b.addEventListener("pointerdown", down);
      b.addEventListener("pointerup", up);
      b.addEventListener("pointercancel", up);
      b.addEventListener("pointerleave", up);
    });

    $("ap-dlg-next").addEventListener("click", function () { if (G) nextLine(G); });
    $("ap-pause-btn").addEventListener("click", togglePause);
  }

  function togglePause() {
    if (!G) return;
    if (G.state === "paused") { closeOverlay(); G.state = G.prevState || "play"; return; }
    if (G.state !== "play") return;
    G.prevState = G.state;
    G.state = "paused";
    G.keys = freshKeys();
    var c = card("PAUSED", AP.levels[G.levelIndex].name, [], "Back to it", function () {
      closeOverlay(); G.state = "play";
    });
    var quit = el("button", "ap-card-quit", "Leave the chapter");
    quit.addEventListener("click", function () {
      closeOverlay();
      if (window.leaveApocalypse) window.leaveApocalypse();
    });
    c.appendChild(quit);
    openOverlay(c);
  }

  /* =======================================================================
     19. USING THINGS — one button, and it does whatever she is standing at
     ======================================================================= */
  function thingNear(G) {
    var p = G.player, best = null, bd = 26;
    G.level.things.forEach(function (t) {
      if (t.done) return;
      var d = Math.hypot(t.x * T + T / 2 - p.x, t.y * T + T / 2 - p.y);
      if (d < bd) { bd = d; best = t; }
    });
    return best;
  }

  function doorNear(G) {
    var p = G.player, best = null, bd = 26;
    Object.keys(G.level.doors).forEach(function (key) {
      var d = G.level.doors[key];
      if (d.open || d.kind === "plain") return;
      var xy = key.split(",");
      var dist = Math.hypot(xy[0] * T + T / 2 - p.x, xy[1] * T + T / 2 - p.y);
      if (dist < bd) { bd = dist; best = { key: key, door: d, x: +xy[0], y: +xy[1] }; }
    });
    return best;
  }

  function doUse(G) {
    if (G.state !== "play") return;
    var t = thingNear(G);
    if (t) { useThing(G, t); return; }
    var d = doorNear(G);
    if (d) { useDoor(G, d); return; }
  }

  /* =======================================================================
     20. PUBLIC API
     ======================================================================= */
  function start() {
    buildArt();
    G = {
      t: 0, state: "card", levelIndex: 0, level: null, step: null, stepIndex: 0,
      player: mkPlayer(0, 0), keys: freshKeys(), cam: { x: 0, y: 0 },
      noises: [], doorFx: [], safe: { x: 0, y: 0 }, safeT: 0,
      caughtT: 0, caughtShown: false, caughtLine: "", closeCalls: 0,
      flash: 0, hudT: 0, code: null, dlg: null, pressure: 0, pressureT: 0, steps: [],
      canvas: $("ap-canvas"), ctx: $("ap-canvas").getContext("2d"),
    };
    G.ctx.imageSmoothingEnabled = false;
    if (!booted) { bindInput(); booted = true; }
    if (window.duckAmbient) window.duckAmbient(true);
    lastT = 0; acc = 0;
    if (!raf) raf = requestAnimationFrame(frame);
    startRoom();
    showHowTo();
  }

  function stop() {
    if (raf) cancelAnimationFrame(raf);
    raf = null;
    stopRoom();
    closeOverlay();
    $("ap-dlg").setAttribute("aria-hidden", "true");
    if (window.duckAmbient) window.duckAmbient(false);
    if (G) { G.state = "card"; G.keys = freshKeys(); }
  }

  function showHowTo() {
    openOverlay(card(AP.title, AP.tagline, AP.howTo, "Begin", function () {
      closeOverlay();
      startLevel(0);
    }));
  }

  function showLevelCard(i, go) {
    var d = AP.levels[i];
    openOverlay(card(d.card + " — " + d.name, d.sub, [], "Go", function () {
      closeOverlay();
      go();
    }));
  }

  function startLevel(i) {
    G.levelIndex = i;
    showLevelCard(i, function () {
      G.level = buildLevel(LEVELS[i]);
      G.player = mkPlayer(G.level.start.x, G.level.start.y);
      G.safe = { x: G.level.start.x, y: G.level.start.y };
      G.stepIndex = 0;
      G.steps = G.level.def.steps || [];
      G.step = G.steps[0];
      G.state = "play";
      G.keys = freshKeys();
      G.pressure = 0;
      G.pressureT = PRESSURE_EVERY;
      snapCam(G);
      setHud(G);
      if (LEVEL_INTRO[i]) LEVEL_INTRO[i](G);
    });
  }

  /* Some levels are two places. Level 4 is the hospital and then a lane
     twenty miles out of town, and it would be silly to make her sit through
     a level card in between — she is on the same journey. This swaps the map
     under her and keeps everything else: the step she is on, the code in her
     pocket, how many close calls she has had, and him. */
  function enterSubmap(G, def, startAt) {
    var hadAnwar = G.level && G.level.anwar && G.level.anwar.awake;
    G.level = buildLevel(def);
    var st = startAt ? { x: startAt[0] * T + T / 2, y: startAt[1] * T + T / 2 } : G.level.start;
    G.player.x = st.x; G.player.y = st.y;
    G.player.vx = 0; G.player.vy = 0;
    G.safe = { x: st.x, y: st.y };
    G.noises.length = 0;
    G.doorFx.length = 0;
    if (hadAnwar && G.level.anwar) {
      G.level.anwar.awake = true;            // he is not going to be asleep again
      G.level.anwar.trail = [];
      G.level.anwar.x = st.x - 12;
      G.level.anwar.y = st.y;
    }
    G.state = "play";
    G.keys = freshKeys();
    snapCam(G);
    setHud(G);
  }

  /* =======================================================================
     CUTSCENES

        Two moments in Level 4 are not a thing she plays, they are a thing
        that happens: the drive out of town, and the ride the rest of the
        way. Both are painted straight onto the game canvas in the same
        pixel language as everything else, with a line of text under them.
     ======================================================================= */
  function cutscene(G, opts) {
    $("ap-hud").classList.add("gone");
    G.state = "cut";
    G.keys = freshKeys();
    G.cut = { t: 0, dur: opts.dur, paint: opts.paint, done: opts.onDone, caption: opts.caption };
    var cap = el("p", "ap-cut-cap", opts.caption);
    openOverlay(cap, "thin cut");
  }

  function stepCut(G, dt) {
    var cu = G.cut;
    if (!cu) { G.state = "play"; return; }
    cu.t += dt;
    if (cu.t >= cu.dur) {
      G.cut = null;
      closeOverlay();
      $("ap-hud").classList.remove("gone");
      G.state = "play";
      if (cu.done) cu.done();
    }
  }

  /* ---- the drive: a road going past, and then not going past ---------- */
  function paintDrive(G, c, t) {
    var dur = G.cut.dur, k = t / dur;
    var speed = k < 0.62 ? 1 : Math.max(0, 1 - (k - 0.62) / 0.30);   // it coughs and dies
    var travelled = G.cut.travel = (G.cut.travel || 0) + speed * 190 * (1 / 60);

    ditherFill(c, 0, 0, VW, 96, [
      { p: 0, c: "#14162c" }, { p: 0.45, c: "#232a48" },
      { p: 0.72, c: "#3d3a56" }, { p: 1, c: "#6a4a52" },
    ]);
    var rr = rnd(4001);
    for (var i = 0; i < 40; i++) {                                   // stars, going out
      px(c, (rr() * VW) | 0, (rr() * 60) | 0, 1, 1, "#c9cbe8");
    }
    /* three depths of country, each going past at its own rate */
    [[0.16, 96, "#1b2032"], [0.36, 104, "#232a3d"], [0.7, 112, "#2d3548"]].forEach(function (L, d) {
      var off = (travelled * L[0]) % 64;
      for (var x = -64; x < VW + 64; x += 64) {
        var hx = x - off;
        blob(c, hx + 16, L[1] + 8, 30, 12 + d * 3, [L[2], L[2], shade(L[2], -6), shade(L[2], -10)]);
        blob(c, hx + 48, L[1] + 10, 20, 9 + d * 2, [L[2], L[2], shade(L[2], -6), shade(L[2], -10)]);
        if (d === 2 && ((hx / 64) | 0) % 2 === 0) {                  // a telegraph pole
          px(c, hx + 30, L[1] - 22, 2, 30, "#20242f");
          px(c, hx + 25, L[1] - 20, 12, 2, "#20242f");
        }
      }
    });
    px(c, 0, 118, VW, VH - 118, "#22242c");                          // the road
    px(c, 0, 118, VW, 2, "#3a3d47");
    for (var m = -40; m < VW + 40; m += 40) {                        // and its markings
      px(c, m - ((travelled * 2.4) % 40), 152, 22, 3, "#b9bcc4");
      px(c, m - ((travelled * 1.5) % 40) + 12, 132, 13, 2, "#7d818c");   // and the row behind
    }
    /* the car, from behind: two lamps and a dark shape */
    var bob = Math.sin(t * (6 + speed * 10)) * (speed > 0.2 ? 1 : 0);
    var cx = 128, cy = 132 + bob;
    px(c, cx, cy - 22, 64, 24, "#20242e");
    px(c, cx + 4, cy - 30, 56, 10, "#171b24");
    px(c, cx + 8, cy - 28, 48, 6, "#2f3a4a");
    /* the two of them through the back window, which is the only reason
       this shot is worth painting at all */
    blob(c, cx + 22, cy - 25, 4, 3, ["#161a22", "#161a22", "#101319", "#0c0e13"]);
    blob(c, cx + 38, cy - 25, 4, 3, ["#161a22", "#161a22", "#101319", "#0c0e13"]);
    px(c, cx + 19, cy - 23, 7, 3, "#12161d");
    px(c, cx + 35, cy - 23, 7, 3, "#12161d");
    px(c, cx, cy - 22, 64, 2, "#2f3542");
    px(c, cx + 2, cy - 4, 10, 5, "#12141a"); px(c, cx + 52, cy - 4, 10, 5, "#12141a");
    px(c, cx + 4, cy - 12, 8, 4, speed > 0.2 ? "#c94a3a" : "#5a2a26");
    px(c, cx + 52, cy - 12, 8, 4, speed > 0.2 ? "#c94a3a" : "#5a2a26");
    /* the headlights it throws forward, off the front of the picture */
    if (speed > 0.15) {
      var g = c.createRadialGradient(cx + 32, cy - 10, 4, cx + 32, cy - 10, 130);
      g.addColorStop(0, "rgba(255,240,200,.14)");
      g.addColorStop(1, "rgba(255,240,200,0)");
      c.fillStyle = g; c.fillRect(0, 60, VW, VH - 60);
    }
    if (speed <= 0.15) {                                             // and the last of it
      for (var p2 = 0; p2 < 6; p2++) {
        px(c, cx + 26 + ((Math.random() * 12) | 0), cy - 36 - ((Math.random() * 20) | 0), 1, 1, "#5a5f6e");
      }
    }
  }

  /* ---- the ride: slower, warmer, and the sun coming up --------------- */
  function paintRide(G, c, t) {
    var travelled = G.cut.travel = (G.cut.travel || 0) + 46 * (1 / 60);
    ditherFill(c, 0, 0, VW, 100, [
      { p: 0, c: "#2b3358" }, { p: 0.38, c: "#4c4a6a" },
      { p: 0.66, c: "#8a5f66" }, { p: 0.86, c: "#c98a68" }, { p: 1, c: "#e8b57e" },
    ]);
    blob(c, 238, 92, 12, 12, ["#fff0c8", "#ffe0a0", "#f0c078", "#d89a58"]);  // the sun
    [[0.18, 92, "#2f3550"], [0.42, 100, "#3b3f58"]].forEach(function (L) {
      var off = (travelled * L[0]) % 80;
      for (var x = -80; x < VW + 80; x += 80) {
        blob(c, x - off + 20, L[1] + 6, 36, 11, [L[2], L[2], shade(L[2], -5), shade(L[2], -9)]);
        blob(c, x - off + 58, L[1] + 8, 24, 8, [L[2], L[2], shade(L[2], -5), shade(L[2], -9)]);
      }
    });
    px(c, 0, 112, VW, VH - 112, "#35462c");                          // the field
    for (var i = 0; i < 260; i++) {
      var gx = (((i * 37) - travelled * 1.6) % (VW + 40) + VW + 40) % (VW + 40) - 20;
      var gy = 114 + ((i * 13) % (VH - 114));
      px(c, gx, gy, 1, 2, i % 3 ? "#405433" : "#4c6440");
    }
    /* the two of them on her, seen from the side */
    var bob = Math.sin(t * 5.2) * 1.6;
    var hx = 156, hy = 150 + bob;
    drawHorse(c, hx, hy, 1, t * 6.4, false);
    /* the sprites' feet are at the bottom of a twelve-by-eighteen frame, so
       they are hung forty-six pixels above the ground she is standing on —
       which puts them on her back rather than in the sky above it */
    c.drawImage(ART.anwar.down[0], hx - 17, hy - 46);
    c.drawImage(ART.ouissy.down[0], hx - 3, hy - 48);

    var g2 = c.createLinearGradient(0, 0, VW, VH);                    // the low sun over it
    g2.addColorStop(0, "rgba(255,190,120,0)");
    g2.addColorStop(1, "rgba(255,190,120,.12)");
    c.fillStyle = g2; c.fillRect(0, 0, VW, VH);
  }

  function advanceStep(G, clears) {
    /* G.steps, not G.level.def.steps: Level 4 swaps the map under her
       halfway through and the second map is not a level, so it has no list
       of its own. The objectives belong to the journey. */
    var steps = G.steps || [];
    if (G.step && G.step.clears === clears && G.stepIndex < steps.length - 1) {
      G.stepIndex++;
      G.step = steps[G.stepIndex];
      setHud(G);
    }
  }


  /* =======================================================================
     21. THE WIRE PANEL

        A salvaged control panel, not a factory one: a scratched metal plate
        screwed to whatever was behind it, one bulb on a cord over it, and
        five wires somebody has already had their hands in.

        The puzzle is a tracing puzzle, not a matching one. Every wire is
        already fixed at its plug on the left rail, and every wire is then
        routed through the middle in a tangle that crosses the others, so
        the free end nearest a socket is almost never the one that belongs
        in it. She has to follow the run with her eyes.

        Getting one wrong costs nothing at all. It sparks, the wire drops
        back where it was, and she tries again. This is a game about
        getting to somebody, not about being punished.

        Used by: the garage door (L1), the ward lift (L3), the car (L4).
     ======================================================================= */
  var WIRE_KIT = {
    /* colour, the name of its plug shape, and the shade under it */
    wires: [
      { key: "gold",  col: "#c9932f", dark: "#8a6420", shape: "spade" },
      { key: "red",   col: "#a83a34", dark: "#722520", shape: "ring" },
      { key: "blue",  col: "#4a6f96", dark: "#31506f", shape: "fork" },
      { key: "green", col: "#5c7a4a", dark: "#3d5531", shape: "bullet" },
      { key: "bone",  col: "#a89b84", dark: "#736a58", shape: "hook" },
    ],
  };

  var PW_W = 192, PW_H = 124;          // the panel's own pixel grid

  function shuffled(n, seed) {
    var r = rnd(seed), a = [];
    for (var i = 0; i < n; i++) a.push(i);
    for (i = n - 1; i > 0; i--) {
      var j = (r() * (i + 1)) | 0;
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  /* The five plug shapes. They are bigger than they strictly need to be
     because shape is half the puzzle: if she cannot tell a spade from a
     fork at a glance, all she has left is colour, and colour under one
     bulb is not enough to be fair. */
  function drawPlug(c, x, y, shape, col, dark) {
    px(c, x - 4, y - 2, 5, 5, "#3a3f47");                     // the crimp behind it
    px(c, x - 4, y - 2, 5, 1, "#4e545e");
    if (shape === "spade") {                                   // a flat blade
      px(c, x + 1, y - 1, 8, 3, col);
      px(c, x + 4, y - 4, 4, 9, col);
      px(c, x + 4, y - 4, 4, 1, shade(col, 26));
    } else if (shape === "ring") {                             // an eyelet
      px(c, x + 1, y - 1, 4, 3, col);
      px(c, x + 4, y - 5, 7, 2, col); px(c, x + 4, y + 3, 7, 2, col);
      px(c, x + 4, y - 4, 2, 7, col); px(c, x + 9, y - 4, 2, 7, col);
    } else if (shape === "fork") {                             // two prongs
      px(c, x + 1, y - 1, 4, 3, col);
      px(c, x + 4, y - 5, 7, 3, col); px(c, x + 4, y + 2, 7, 3, col);
      px(c, x + 4, y - 2, 2, 4, col);
    } else if (shape === "bullet") {                           // a round pin
      px(c, x + 1, y - 1, 3, 3, col);
      px(c, x + 3, y - 4, 5, 9, col);
      px(c, x + 8, y - 2, 3, 5, col);
      px(c, x + 3, y - 4, 5, 1, shade(col, 26));
    } else {                                                    // a hook
      px(c, x + 1, y - 1, 4, 3, col);
      px(c, x + 4, y - 5, 7, 2, col);
      px(c, x + 9, y - 5, 2, 7, col);
      px(c, x + 5, y + 2, 5, 2, col);
    }
    px(c, x - 5, y + 3, 12, 1, "rgba(0,0,0,.45)");             // it sits on the plate
  }

  /* the socket it belongs in: a recess with the same shape cut into it */
  function drawSocket(c, x, y, shape, col, dark, lit) {
    px(c, x - 8, y - 9, 19, 19, "#23262c");
    px(c, x - 8, y - 9, 19, 1, "#454b56");
    px(c, x - 8, y + 9, 19, 1, "#101216");
    px(c, x - 6, y - 7, 15, 15, "#0e1014");                    // the hole
    px(c, x - 7, y - 8, 17, 1, dark);                          // the colour band
    px(c, x - 7, y + 8, 17, 1, dark);
    px(c, x - 8, y - 8, 1, 17, dark); px(c, x + 10, y - 8, 1, 17, dark);
    var cc = lit ? col : shade(dark, -16);
    if (shape === "spade") { px(c, x - 1, y - 5, 4, 11, cc); }
    else if (shape === "ring") {
      px(c, x - 4, y - 5, 10, 2, cc); px(c, x - 4, y + 4, 10, 2, cc);
      px(c, x - 4, y - 4, 2, 9, cc); px(c, x + 4, y - 4, 2, 9, cc);
    }
    else if (shape === "fork") { px(c, x - 4, y - 5, 10, 3, cc); px(c, x - 4, y + 3, 10, 3, cc); }
    else if (shape === "bullet") { px(c, x - 3, y - 4, 8, 8, cc); }
    else { px(c, x - 4, y - 5, 10, 2, cc); px(c, x + 4, y - 5, 2, 9, cc); px(c, x - 3, y + 3, 8, 2, cc); }
    if (lit) {
      px(c, x + 12, y - 2, 3, 3, "#8fe8b0");                   // it took
      px(c, x + 12, y - 2, 3, 1, "#d8fce8");
    }
  }

  /* a wire run: plug -> two waypoints -> free end. Sampled as a curve so it
     hangs like a cable rather than turning corners like a circuit diagram. */
  function wirePoints(w, endX, endY) {
    var p = [];
    var a = { x: w.px + 5, y: w.py }, b = w.m1, cpt = w.m2, d = { x: endX, y: endY };
    for (var i = 0; i <= 22; i++) {
      var t = i / 22, mt = 1 - t;
      p.push({
        x: mt * mt * mt * a.x + 3 * mt * mt * t * b.x + 3 * mt * t * t * cpt.x + t * t * t * d.x,
        y: mt * mt * mt * a.y + 3 * mt * mt * t * b.y + 3 * mt * t * t * cpt.y + t * t * t * d.y,
      });
    }
    return p;
  }

  function strokeWire(c, pts, col, dark, thick) {
    var i;
    c.lineJoin = "round"; c.lineCap = "round";
    c.strokeStyle = "rgba(0,0,0,.55)";              // the shadow it casts on the plate
    c.lineWidth = thick + 2;
    c.beginPath(); c.moveTo(pts[0].x, pts[0].y + 1);
    for (i = 1; i < pts.length; i++) c.lineTo(pts[i].x, pts[i].y + 1);
    c.stroke();
    c.strokeStyle = dark;                            // the underside of the insulation
    c.lineWidth = thick;
    c.beginPath(); c.moveTo(pts[0].x, pts[0].y);
    for (i = 1; i < pts.length; i++) c.lineTo(pts[i].x, pts[i].y);
    c.stroke();
    c.strokeStyle = col;                             // and the lit top of it
    c.lineWidth = Math.max(1, thick - 1.5);
    c.beginPath(); c.moveTo(pts[0].x, pts[0].y - 0.5);
    for (i = 1; i < pts.length; i++) c.lineTo(pts[i].x, pts[i].y - 0.5);
    c.stroke();
  }

  function makeWirePuzzle(G, opts) {
    var count = opts.count || 5;
    var seed = opts.seed || 7;
    var kit = WIRE_KIT.wires.slice(0, count);
    var socketOrder = shuffled(count, seed);          // sockets in a different order
    var endOrder = shuffled(count, seed + 41);        // and the loose ends in another
    var midOrder = shuffled(count, seed + 97);

    var top = 16, gap = (PW_H - 32) / (count - 1);
    var stage = shuffled(count, seed + 17);
    var W = kit.map(function (k, i) {
      /* Three different shuffles decide where a wire's two waypoints and
         its loose end sit. That is what makes them cross: the wire bolted
         at the top of the rail is very rarely the one whose end is nearest
         the top socket, and there is no way to know which is which without
         following the run. */
      return {
        key: k.key, col: k.col, dark: k.dark, shape: k.shape,
        px: 16, py: top + i * gap,                   // where it is bolted down
        m1: { x: 54 + midOrder[i] * 5, y: top - 6 + endOrder[i] * gap * 1.12 },
        m2: { x: 96 + endOrder[i] * 4, y: top - 4 + midOrder[i] * gap * 1.16 },
        ex: 116 + stage[i] * 5,                      // its loose end, before she moves it
        ey: top + stage[i] * gap,
        placed: false, spark: 0,
      };
    });
    var S = kit.map(function (k, i) {
      return { key: kit[socketOrder[i]].key, col: kit[socketOrder[i]].col,
               dark: kit[socketOrder[i]].dark, shape: kit[socketOrder[i]].shape,
               x: PW_W - 22, y: top + i * gap, filled: false };
    });

    return {
      wires: W, sockets: S, drag: null, done: 0, count: count,
      power: 0, bulb: 0.55, buzz: 0, title: opts.title, hint: opts.hint,
      onDone: opts.onDone,
    };
  }

  function paintWirePanel(P, c, t) {
    var i, r = rnd(31);

    /* --- the plate. Not a product: a sheet of steel somebody cut to fit,
       screwed over an older wooden back board, and then worked on with
       dirty hands for years. --------------------------------------------- */
    px(c, 0, 0, PW_W, PW_H, "#4a3a2a");                        // the board behind it
    for (i = 0; i < PW_H; i += 4) px(c, 0, i, PW_W, 2, "#402f22");
    px(c, 3, 3, PW_W - 6, PW_H - 6, "#2b2f36");                // the steel over it
    for (i = 0; i < 300; i++) {                                 // rolled-steel tooth
      var x = 3 + ((r() * (PW_W - 6)) | 0), y = 3 + ((r() * (PW_H - 6)) | 0);
      px(c, x, y, 1 + ((r() * 3) | 0), 1, r() > 0.66 ? "#353a43" : "#25282e");
    }
    for (i = 0; i < 22; i++) {                                  // scratches, all one way
      var sx = 3 + ((r() * (PW_W - 20)) | 0), sy = 3 + ((r() * (PW_H - 8)) | 0);
      var ln = 5 + ((r() * 22) | 0);
      for (var k = 0; k < ln; k++) px(c, sx + k, sy + ((k * 0.35) | 0), 1, 1, "#454b55");
    }
    for (i = 0; i < 16; i++) {                                  // rust, crept in at the edges
      var rx = (r() * PW_W) | 0, ry = (r() * PW_H) | 0;
      var edge = Math.min(rx, ry, PW_W - rx, PW_H - ry);
      if (edge > 22 && r() > 0.35) continue;
      blob(c, rx, ry, 2 + ((r() * 4) | 0), 2 + ((r() * 2) | 0),
           ["#7a5334", "#63432a", "#4c3421", "#3a2819"]);
    }
    px(c, 3, 3, PW_W - 6, 1, "#5a616d");                        // the lit lip of the cut
    px(c, 3, PW_H - 4, PW_W - 6, 1, "#1a1d22");
    [[8, 8], [PW_W - 9, 8], [8, PW_H - 9], [PW_W - 9, PW_H - 9]].forEach(function (sc) {
      px(c, sc[0] - 3, sc[1] - 3, 6, 6, "#4a5058");             // the screws holding it on
      px(c, sc[0] - 2, sc[1] - 2, 4, 4, "#5c636d");
      px(c, sc[0] - 2, sc[1], 4, 1, "#23262b");
      px(c, sc[0] - 2, sc[1] + 1, 4, 1, "#6a717c");
    });

    /* the two rails the plugs and the sockets are bolted to */
    px(c, 10, 10, 4, PW_H - 20, "#20242a");
    px(c, 10, 10, 1, PW_H - 20, "#3d434d");
    px(c, PW_W - 34, 10, 4, PW_H - 20, "#20242a");
    px(c, PW_W - 34, 10, 1, PW_H - 20, "#3d434d");
    /* a strip of tape with something written on it, gone illegible */
    px(c, 40, 6, 30, 6, "#b0a486");
    for (i = 0; i < 7; i++) px(c, 43 + i * 4, 8, 2, 2, "#4a4232");

    /* --- the bulb, and everything it does not reach --------------------- */
    var glow = P.bulb * (0.88 + 0.12 * Math.sin(t * 2.3)) + P.power * 0.45;
    px(c, PW_W / 2, 0, 1, 8, "#15171b");                        // the flex
    px(c, PW_W / 2 - 2, 7, 5, 3, "#3a3f47");                    // the cap
    blob(c, PW_W / 2, 13, 5, 5, ["#fffbe8", "#ffe9b0", "#e0bd78", "#a8874c"]);
    px(c, PW_W / 2 - 1, 11, 2, 3, "#fffdf2");                   // the filament

    /* --- the wires ------------------------------------------------------ */
    P.wires.forEach(function (w) {
      var ex = w.placed ? w.placed.x - 10 : (P.drag === w ? P.dragX : w.ex);
      var ey = w.placed ? w.placed.y : (P.drag === w ? P.dragY : w.ey);
      strokeWire(c, wirePoints(w, ex, ey), w.col, w.dark, 3.4);
      if (!w.placed) {                                          // the bare copper end
        px(c, ex - 3, ey - 2, 6, 4, "#8d7346");
        px(c, ex - 3, ey - 2, 6, 1, "#c9a86a");
        px(c, ex + 2, ey - 1, 3, 2, "#d8c8a0");
      }
    });
    P.wires.forEach(function (w) { drawPlug(c, w.px, w.py, w.shape, w.col, w.dark); });
    P.sockets.forEach(function (s) { drawSocket(c, s.x, s.y, s.shape, s.col, s.dark, s.filled); });

    /* sparks, over everything */
    P.wires.forEach(function (w) {
      if (w.spark <= 0) return;
      var ex = w.placed ? w.placed.x - 10 : w.ex, ey = w.placed ? w.placed.y : w.ey;
      for (var k = 0; k < 9; k++) {
        var a = Math.random() * 6.28, d = Math.random() * 9 * w.spark;
        px(c, ex + Math.cos(a) * d, ey + Math.sin(a) * d, 1, 1, k % 2 ? "#fff3cf" : "#ffd166");
      }
    });

    /* --- the light. One bulb over a panel in a dark garage: a pool at the
       top, and everything at the corners falling away into nothing. ------- */
    var g = c.createRadialGradient(PW_W / 2, 14, 4, PW_W / 2, 30, PW_W * 0.66);
    g.addColorStop(0, "rgba(255,236,190," + (0.20 * glow) + ")");
    g.addColorStop(0.30, "rgba(255,226,168,0)");
    g.addColorStop(0.62, "rgba(8,7,10," + (0.34 - glow * 0.10) + ")");
    g.addColorStop(1, "rgba(4,4,7," + (0.86 - glow * 0.18) + ")");
    c.fillStyle = g;
    c.fillRect(0, 0, PW_W, PW_H);
    var g2 = c.createLinearGradient(0, 0, 0, PW_H);             // and the floor of it
    g2.addColorStop(0, "rgba(0,0,0,0)");
    g2.addColorStop(1, "rgba(3,3,6,.42)");
    c.fillStyle = g2;
    c.fillRect(0, 0, PW_W, PW_H);

    if (P.power > 0) {                                          // it comes up in stutters
      var f = P.power > 0.7 ? 1 : (Math.sin(t * 26) > 0 ? 1 : 0.22);
      c.fillStyle = "rgba(190,232,255," + (0.16 * P.power * f) + ")";
      c.fillRect(0, 0, PW_W, PW_H);
    }
    if (P.buzz > 0) {
      c.fillStyle = "rgba(255,90,70," + (0.18 * P.buzz) + ")";
      c.fillRect(0, 0, PW_W, PW_H);
    }
  }

  function openWirePanel(G, opts) {
    var P = makeWirePuzzle(G, opts);
    G.state = "panel";
    G.keys = freshKeys();

    var wrap = el("div", "ap-panel");
    wrap.appendChild(el("p", "ap-panel-title", opts.title));
    var cv = mkCanvas(PW_W, PW_H);
    cv.className = "ap-panel-canvas";
    wrap.appendChild(cv);
    wrap.appendChild(el("p", "ap-panel-hint", opts.hint));
    var out = el("button", "ap-panel-leave", "Step back");
    out.addEventListener("click", function () { closeOverlay(); G.state = "play"; });
    wrap.appendChild(out);
    openOverlay(wrap, "thin");

    var c = cv.getContext("2d");
    c.imageSmoothingEnabled = false;

    function toPanel(ev) {
      var b = cv.getBoundingClientRect();
      return { x: ((ev.clientX - b.left) / b.width) * PW_W, y: ((ev.clientY - b.top) / b.height) * PW_H };
    }
    cv.addEventListener("pointerdown", function (ev) {
      ev.preventDefault();
      var p = toPanel(ev), best = null, bd = 11;
      P.wires.forEach(function (w) {
        if (w.placed) return;
        var d = Math.hypot(w.ex - p.x, w.ey - p.y);
        if (d < bd) { bd = d; best = w; }
      });
      if (best) { P.drag = best; P.dragX = p.x; P.dragY = p.y; cv.setPointerCapture(ev.pointerId); }
    });
    cv.addEventListener("pointermove", function (ev) {
      if (!P.drag) return;
      var p = toPanel(ev);
      P.dragX = p.x; P.dragY = p.y;
    });
    function release(ev) {
      if (!P.drag) return;
      var w = P.drag, p = toPanel(ev), hit = null, bd = 15;
      P.sockets.forEach(function (s) {
        if (s.filled) return;
        var d = Math.hypot(s.x - p.x, s.y - p.y);
        if (d < bd) { bd = d; hit = s; }
      });
      P.drag = null;
      if (!hit) return;
      if (hit.key === w.key) {
        w.placed = hit; hit.filled = true; w.spark = 1; P.done++;
        sfx("connect");
        if (P.done >= P.count) finish();
      } else {
        w.spark = 1; P.buzz = 1;
        sfx("spark");
        makeNoise(G, G.player.x, G.player.y, TUNE.noiseSpark);
      }
    }
    cv.addEventListener("pointerup", release);
    cv.addEventListener("pointercancel", function () { P.drag = null; });

    var t0 = performance.now(), done = false, panelRaf = null;
    function tick(now) {
      panelRaf = requestAnimationFrame(tick);
      var t = (now - t0) / 1000;
      P.wires.forEach(function (w) { w.spark = Math.max(0, w.spark - 0.045); });
      P.buzz = Math.max(0, P.buzz - 0.03);
      if (done) P.power = Math.min(1, P.power + 0.012);
      paintWirePanel(P, c, t);
      if (!overlay().contains(cv)) cancelAnimationFrame(panelRaf);
    }
    panelRaf = requestAnimationFrame(tick);

    function finish() {
      done = true;
      sfx("power");
      setTimeout(function () {
        cancelAnimationFrame(panelRaf);
        closeOverlay();
        G.state = "play";
        if (opts.onDone) opts.onDone();
      }, 1500);
    }

    /* the harness drives it through this rather than the pointer */
    G.__panel = { P: P, solve: function () { 
      P.wires.forEach(function (w) {
        var s = P.sockets.filter(function (s) { return s.key === w.key; })[0];
        if (s && !s.filled) { w.placed = s; s.filled = true; P.done++; }
      });
      finish();
    } };
  }

  /* =======================================================================
     22. THE NOTE, AND THE DOOR IT OPENS

        The same idea as the passcode on the way into the site — a number
        somebody wrote down, found somewhere else entirely, and typed in on
        a keypad — but the paper is torn out of a notebook and the keypad is
        screwed to a fire door.
     ======================================================================= */
  function showNote(G, thing, text, code, after, then) {
    G.state = "note";
    G.keys = freshKeys();
    G.code = code;
    var wrap = el("div", "ap-note");
    wrap.appendChild(el("span", "ap-note-tape"));
    wrap.appendChild(el("p", "ap-note-body", text));
    wrap.appendChild(el("p", "ap-note-code", code));
    if (after) wrap.appendChild(el("p", "ap-note-after", after));
    var b = el("button", "ap-note-ok", "Pocket it");
    b.addEventListener("click", function () {
      closeOverlay();
      G.state = "play";
      thing.done = true;
      setHud(G);
      advanceStep(G, "note");
      if (then) say(G, then);
    });
    wrap.appendChild(b);
    openOverlay(wrap, "thin");
    sfx("found");
  }

  function openKeypad(G, door, code, onOpen) {
    G.state = "keypad";
    G.keys = freshKeys();
    var entered = "";
    var wrap = el("div", "ap-keypad");
    ["tl", "tr", "bl", "br"].forEach(function (c) { wrap.appendChild(el("span", "ap-screw " + c)); });
    wrap.appendChild(el("p", "ap-keypad-title", "FIRE DOOR — KEEP LOCKED"));
    var dwrap = el("div", "ap-keypad-glass");
    var disp = el("p", "ap-keypad-disp", "————");
    dwrap.appendChild(disp);
    dwrap.appendChild(el("span", "ap-keypad-scan"));
    wrap.appendChild(dwrap);
    var pad = el("div", "ap-keypad-pad");
    function paint() { disp.textContent = (entered + "————").slice(0, 4).replace(/\d/g, "•").padEnd(4, "—"); }
    "123456789".split("").concat(["c", "0", "k"]).forEach(function (d) {
      var b = el("button", "ap-key-btn" + (d === "k" ? " go" : d === "c" ? " clr" : ""), d === "k" ? "ENTER" : d === "c" ? "CLR" : d);
      b.addEventListener("click", function () {
        if (d === "c") { entered = ""; sfx("blip"); paint(); return; }
        if (d === "k") {
          if (entered === code) {
            sfx("power");
            door.open = true;
            closeOverlay();
            G.state = "play";
            if (onOpen) onOpen();
          } else {
            sfx("deny");
            wrap.classList.add("shake");
            setTimeout(function () { wrap.classList.remove("shake"); }, 400);
            entered = ""; paint();
          }
          return;
        }
        if (entered.length < 4) { entered += d; sfx("blip"); paint(); }
      });
      pad.appendChild(b);
    });
    wrap.appendChild(pad);
    var out = el("button", "ap-panel-leave", "Step back");
    out.addEventListener("click", function () { closeOverlay(); G.state = "play"; });
    wrap.appendChild(out);
    openOverlay(wrap, "thin");
    paint();
    G.__keypad = { enter: function (v) { entered = v; paint(); }, ok: function () {
      if (entered === code) { door.open = true; closeOverlay(); G.state = "play"; if (onOpen) onOpen(); }
    } };
  }


  /* =======================================================================
     23. TRIGGERS AND STORY

        Each level is a short list of steps, and each step is cleared by one
        thing happening. This is where a thing happening turns into the next
        line of the story.
     ======================================================================= */
  function useThing(G, t) {
    if (t.kind === "tv") { showBroadcast(G, t); return; }
    if (t.kind === "note") {
      var n = NOTES[G.levelIndex];
      showNote(G, t, n.text, n.code, n.after, n.then);
      return;
    }
    if (t.kind === "panel") {
      openWirePanel(G, {
        title: PANELS[G.levelIndex].title,
        hint: PANELS[G.levelIndex].hint,
        seed: 7 + G.levelIndex * 13,
        count: 5,
        onDone: function () {
          t.done = true;
          PANELS[G.levelIndex].onDone(G);
        },
      });
      return;
    }
    if (t.kind === "car") { CAR_USE(G, t); return; }
    if (t.kind === "horse") { HORSE_USE(G, t); return; }
    if (t.kind === "check") { openCheck(G, t); return; }
  }

  function useDoor(G, d) {
    if (d.door.kind === "locked") {
      if (!G.code) {
        say(G, [["", "Locked, and it wants four numbers. Somebody must have written them down somewhere."]]);
        return;
      }
      openKeypad(G, d.door, G.code, function () {
        makeNoise(G, d.x * T + T / 2, d.y * T + T / 2, TUNE.noiseDoor);
        advanceStep(G, "gate");
      });
      return;
    }
    if (d.door.kind === "power") {
      say(G, [["", "Dead. No power to it at all — there'll be a panel for this somewhere."]]);
      return;
    }
    if (d.door.kind === "story") {
      if (GATE_USE[G.levelIndex]) GATE_USE[G.levelIndex](G, d);
    }
  }

  function checkTriggers(G) {
    var L = G.level, p = G.player;

    /* him: asleep until she is standing over him, then following her */
    if (L.anwar) {
      if (!L.anwar.awake) {
        if (Math.hypot(L.anwar.x - p.x, L.anwar.y - p.y) < 22 && G.state === "play") {
          L.anwar.awake = true;
          L.anwar.trail = [];
          sfx("found");
          advanceStep(G, "anwar");
          say(G, AP.reunion.waking);
        }
      } else {
        followHer(G, L.anwar, dtOf(G));
      }
    }
    if (L.exit) {
      var ex = L.exit.x * T + T / 2, ey = L.exit.y * T + T / 2;
      if (Math.hypot(ex - p.x, ey - p.y) < 12) finishLevel(G);
    }
    if (L.onStep) L.onStep(G);
  }

  /* He walks where she walked, a little way back, rather than steering at
     her — a follower that pathfinds is a follower that gets stuck on a
     door frame, and there is nothing romantic about that. */
  function followHer(G, a, dt) {
    var p = G.player;
    a.trail = a.trail || [];
    var last = a.trail[a.trail.length - 1];
    if (!last || Math.hypot(last.x - p.x, last.y - p.y) > 3) a.trail.push({ x: p.x, y: p.y });
    if (a.trail.length > 26) a.trail.shift();
    var want = a.trail[0];
    if (!want) return;
    var dx = want.x - a.x, dy = want.y - a.y, d = Math.hypot(dx, dy);
    if (d < 3) { a.frame = 0; return; }
    var sp = Math.min(TUNE.walk * 1.15, d * 4);
    a.x += (dx / d) * sp * dt;
    a.y += (dy / d) * sp * dt;
    a.face = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : (dy > 0 ? "down" : "up");
    a.anim = (a.anim || 0) + dt * 7;
    a.frame = 1 + ((a.anim | 0) % 2);
  }

  var LAST_DT = 1 / 60;
  function dtOf() { return LAST_DT; }

  function finishLevel(G) {
    if (G.state !== "play") return;
    G.state = "outro";
    G.keys = freshKeys();
    var lines = OUTRO[G.levelIndex] || [["", "..."]];
    say(G, lines, function () {
      G.state = "outro";
      if (G.levelIndex + 1 < LEVELS.length) startLevel(G.levelIndex + 1);
      else finishChapter(G);
    });
  }

  function finishChapter(G) {
    if (window.markApocalypseDone) window.markApocalypseDone();
    openOverlay(card("THE END OF THE WORLD", "and you still came and found me",
      [], "Go on", function () {
        closeOverlay();
        stop();
        if (window.startApocalypseEnding) window.startApocalypseEnding();
        else if (window.leaveApocalypse) window.leaveApocalypse();
      }));
  }

  /* ---- the news, on a television nobody turned off -------------------- */
  var BROADCAST = [
    "— and we are being told again: stay inside, lock what you can lock —",
    "— do not approach anyone who seems unwell. Do not try to help them —",
    "— hospitals in the following districts are no longer taking calls —",
  ];

  function showBroadcast(G, thing) {
    G.state = "note";
    G.keys = freshKeys();
    var wrap = el("div", "ap-tv");
    var set = el("div", "ap-tv-set");
    var scr = el("div", "ap-tv-screen");
    var line = el("p", "ap-tv-line", "");
    scr.appendChild(el("span", "ap-tv-scan"));
    scr.appendChild(el("span", "ap-tv-glass"));
    scr.appendChild(line);
    set.appendChild(scr);
    var side = el("div", "ap-tv-side");
    side.appendChild(el("span", "ap-tv-dial"));
    side.appendChild(el("span", "ap-tv-dial small"));
    side.appendChild(el("span", "ap-tv-grille"));
    set.appendChild(side);
    wrap.appendChild(set);
    wrap.appendChild(el("span", "ap-tv-feet"));
    wrap.appendChild(el("p", "ap-tv-cap", "the six o'clock news, still running"));
    var b = el("button", "ap-note-ok", "Turn it off");
    b.addEventListener("click", function () {
      clearInterval(iv);
      closeOverlay();
      G.state = "play";
      thing.done = true;
      var i = G.level.lights.findIndex(function (l) { return l.tv; });
      if (i >= 0) G.level.lights.splice(i, 1);
      advanceStep(G, "tv");
      say(G, [
        ["OUISSY", "Mum and Dad are four hours away."],
        ["", "The front door won't budge and the garage has no power. There'll be a panel for it somewhere."],
      ]);
    });
    wrap.appendChild(b);
    openOverlay(wrap, "thin");

    var n = 0;
    line.textContent = BROADCAST[0];
    var iv = setInterval(function () {
      n = (n + 1) % BROADCAST.length;
      line.textContent = BROADCAST[n];
      sfx("blip");
    }, 3200);
  }

  /* ---- what each level's panel is wired to ---------------------------- */
  /* Opening whatever the panel was wired to. Every level's panel does the
     same physical thing — the doors that had no power now have power — so
     the difference between them is only what she is standing in front of
     and what gets said about it. */
  function powerUp(G, line) {
    var L = G.level;
    Object.keys(L.doors).forEach(function (k) {
      if (L.doors[k].kind === "power") L.doors[k].open = true;
    });
    advanceStep(G, "panel");
    if (line) say(G, [["", line]]);
  }

  var PANELS = {
    0: {
      title: "GARAGE — DOOR MOTOR",
      hint: "follow each wire back to its plug, then put it in the socket that matches",
      onDone: function (G) {
        G.level.lights.push({ x: G.level.exit.x * T + T / 2, y: G.level.exit.y * T + T / 2 - 20,
                              r: 70, warm: 0.4, flicker: true });
        powerUp(G, "Something under the floor kicks in, and the garage door starts to lift.");
      },
    },
    2: {
      title: "WARD C — DOOR GEAR",
      hint: "same as the garage. Follow the run, not the nearest end",
      onDone: function (G) {
        powerUp(G, "Down the corridor, two heavy doors give up and roll apart.");
      },
    },
  };

  var NOTES = {
    1: {
      code: AP.gateCode,
      text: "Torn off a staff rota and dropped behind the counter. Somebody has written on the back of it:",
      after: "and underneath, in a different pen — don't write this down",
      then: [["OUISSY", "There's a staff gate off the alley behind these shops. That comes out right by the hospital."]],
    },
  };
  var OUTRO = {
    4: [
      ["", "There is a bed each and there is tea, and there is a whole day of being asked their names by kind people with clipboards."],
      ["", "Somebody tells them there is a way up onto the roof, and that it is worth it in the evening."],
    ],
    3: [
      ["", "The gates are steel and somebody has welded a sheet of road sign across them. There is a light on above."],
      ["", "A voice comes down from somewhere above the light, and it sounds tired rather than frightened."],
      ["", "\u201cTwo of you? Stay where you are. Don't come any closer until I say.\u201d"],
    ],
    2: null,        // filled in below from AP.reunion, so the words stay in one place
    1: [
      ["", "The hospital sign is still lit. Of everything on this street, that is the thing still lit."],
      ["OUISSY", "Please be asleep. Please still be asleep."],
    ],
    0: [
      ["", "The door gets about waist high and stops. It's enough."],
      ["OUISSY", "Okay. Okay. Hospital."],
    ],
  };

  OUTRO[2] = AP.reunion.hiding;

  var LEVEL_INTRO = {
    4: function (G) {
      say(G, [
        ["", "It is properly morning by the time the fence comes up out of the fields. Somebody has been mowing."],
        ["", "There is a light on over the gate, in daylight, because nobody has been up there to switch it off."],
        ["OUISSY", "Do we just... walk up to it?"],
        ["ANWAR", "I think we just walk up to it."],
      ]);
    },
    3: function (G) {
      say(G, [
        ["", "There is a radio on the shelf in here, and it has been saying the same thing since before either of them woke up."],
      ], function () {
        showRadio(G, function () {
          say(G, [
            ["ANWAR", "Ashcombe. That's — what, forty miles?"],
            ["OUISSY", "Are we walking forty miles?"],
            ["ANWAR", "There's a staff car park under the east block."],
            ["OUISSY", "Then we're not walking forty miles."],
          ]);
        });
      });
    },
    2: function (G) {
      say(G, [
        ["", "The doors are open and nobody is on the desk. The lights are on the emergency circuit — half of them, and not steadily."],
        ["", "It is not quiet in here. It is getting less quiet."],
      ]);
    },
    1: function (G) {
      say(G, [
        ["", "Outside is worse. Not louder — quieter. No cars. No music. Nobody's television but hers."],
        ["OUISSY", "Okay. Think. Where do I even—"],
        ["OUISSY", "...Anwar."],
        ["OUISSY", "He's on a ward with his phone in a drawer. He doesn't know any of this. He's asleep."],
        ["", "The hospital is south and east of here. Twenty minutes, if she doesn't have to stop."],
      ]);
    },
    0: function (G) {
      say(G, [
        ["", "The power went about ten minutes ago. The television didn't."],
        ["OUISSY", "...why is it still on?"],
      ]);
    },
  };

  /* The car. In the hospital car park it is a thing to get running; on the
     verge outside town it is a thing that has already stopped. */
  /* =======================================================================
     THE PROTOCOL — Level 5

        Two small pieces of ceremony, and neither of them can be failed.
        Ashcombe is not a place that turns her away; the point of doing it
        at all is that it is done properly, with somebody's hands on her
        arms and somebody's pen going down a list, because that is what
        being taken in looks like.
     ======================================================================= */
  var CHECK_ROWS = [
    ["both arms", "sleeves up, wrists to elbows"],
    ["neck and collar", "she has to lift her hair for it"],
    ["hands", "front and back, between the fingers"],
    ["ankles", "socks down. He does his first, to be helpful"],
  ];

  function openCheck(G, thing) {
    G.state = "note";
    G.keys = freshKeys();
    var wrap = el("div", "ap-check");
    wrap.appendChild(el("p", "ap-check-title", "ASHCOMBE — ARRIVALS"));
    wrap.appendChild(el("p", "ap-check-sub", "\u201cNothing personal. I do this to everyone, including me.\u201d"));
    var list = el("div", "ap-check-list");
    var left = CHECK_ROWS.length;
    CHECK_ROWS.forEach(function (row) {
      var b = el("button", "ap-check-row");
      b.appendChild(el("span", "ap-check-box", ""));
      var tx = el("span", "ap-check-tx");
      tx.appendChild(el("b", null, row[0]));
      tx.appendChild(el("i", null, row[1]));
      b.appendChild(tx);
      b.addEventListener("click", function () {
        if (b.classList.contains("on")) return;
        b.classList.add("on");
        sfx("blip");
        if (--left === 0) {
          wrap.classList.add("clear");
          stamp.hidden = false;
          go.disabled = false;
          sfx("found");
        }
      });
      list.appendChild(b);
    });
    wrap.appendChild(list);
    var stamp = el("p", "ap-check-stamp", "CLEAR");
    stamp.hidden = true;
    wrap.appendChild(stamp);
    var go = el("button", "ap-note-ok", "Both of you, then");
    go.disabled = true;
    go.addEventListener("click", function () {
      closeOverlay();
      thing.done = true;
      openSerum(G);
    });
    wrap.appendChild(go);
    openOverlay(wrap, "thin");
  }

  /* the vial and the syringe, drawn rather than described */
  function paintSerum(c, k) {
    var w = 96, h = 56;
    px(c, 0, 0, w, h, "#12151d");
    for (var i = 0; i < 90; i++) px(c, (Math.random() * w) | 0, (Math.random() * h) | 0, 1, 1, "#171b25");
    /* the vial, on the left */
    px(c, 12, 14, 12, 30, "#2a3440");
    px(c, 13, 15, 10, 28, "#3d4f5e");
    px(c, 13, 15 + 28 - Math.round(28 * (1 - k)), 10, Math.round(28 * (1 - k)), "#8fd8b0");
    px(c, 13, 15, 10, 2, "#5d7180");
    px(c, 14, 10, 8, 5, "#8a9098");
    px(c, 15, 8, 6, 3, "#b9c0c8");
    px(c, 13, 20, 2, 12, "#5f7a8a");
    /* the syringe, filling */
    var bx = 34, by = 24;
    px(c, bx, by, 44, 9, "#c9d2da");
    px(c, bx, by, 44, 2, "#eef3f8");
    px(c, bx + 2, by + 2, Math.round(40 * k), 5, "#8fd8b0");
    px(c, bx + 44, by + 3, 12, 3, "#9aa4ae");
    px(c, bx + 56, by + 4, 10, 1, "#dfe6ec");
    px(c, bx - 8, by - 2, 8, 13, "#aab4be");
    px(c, bx - 12, by + 1, 4, 7, "#8a949e");
    if (k > 0.98) {
      px(c, bx + 64, by + 2, 3, 3, "#8fd8b0");
      px(c, bx + 66, by, 2, 2, "#bff0d4");
    }
  }

  function openSerum(G) {
    G.state = "note";
    var wrap = el("div", "ap-serum");
    wrap.appendChild(el("p", "ap-check-title", "THE SERUM"));
    var cv = mkCanvas(96, 56);
    cv.className = "ap-serum-canvas";
    wrap.appendChild(cv);
    var line = el("p", "ap-serum-line",
      "\u201cIt is not a cure and I am not going to tell you it is. It buys you about a minute, and a minute is the whole of it.\u201d");
    wrap.appendChild(line);
    var go = el("button", "ap-note-ok", "Hold still");
    wrap.appendChild(go);
    openOverlay(wrap, "thin");
    var c = cv.getContext("2d");
    c.imageSmoothingEnabled = false;
    var k = 0, filling = false, raf2 = null;
    function tick() {
      raf2 = requestAnimationFrame(tick);
      if (filling && k < 1) k = Math.min(1, k + 0.012);
      paintSerum(c, k);
      if (!overlay().contains(cv)) cancelAnimationFrame(raf2);
    }
    tick();
    go.addEventListener("click", function () {
      if (!filling) {
        filling = true;
        go.textContent = "\u2026";
        go.disabled = true;
        sfx("power");
        setTimeout(function () {
          go.disabled = false;
          go.textContent = "Done";
          line.textContent = "It goes in the top of the arm and it stings for longer than it should. He does not let go of her hand for any of it.";
        }, 2200);
        return;
      }
      cancelAnimationFrame(raf2);
      closeOverlay();
      G.state = "play";
      advanceStep(G, "check");
      /* they open the inner gate */
      Object.keys(G.level.doors).forEach(function (key) {
        var d = G.level.doors[key];
        if (d.kind === "story") d.open = true;
      });
      say(G, [
        ["", "Somebody unbolts the inner gate and walks off without waiting to be thanked."],
        ["ANWAR", "That's it?"],
        ["", "\u201cThat's it. There's tea in the second hut and there's a bed each. Go on.\u201d"],
      ]);
    });
  }

  /* what the gates do when she walks up to them */
  var GATE_USE = {
    4: function (G, d) {
      if (G.stepIndex === 0) {
        advanceStep(G, "hail");
        d.door.open = true;
        sfx("door");
        say(G, [
          ["", "\u201cStop there. Both of you turn round slowly, and then come to the table. Don't touch anything on the way.\u201d"],
          ["", "The gate goes back about a foot and a half, which is exactly enough."],
          ["ANWAR", "They're being careful."],
          ["OUISSY", "Good."],
        ]);
      } else {
        say(G, [["", "\u201cTable first. I'm not opening that until somebody's looked at the pair of you.\u201d"]]);
      }
    },
  };

  function CAR_USE(G, t) {
    if (G.level.def.key === "roadside") {
      say(G, [["", "Nothing. It is not the battery this time — the needle has been on the pin since the ring road."]]);
      return;
    }
    openWirePanel(G, {
      title: "UNDER THE BONNET",
      hint: "same puzzle, worse light. Follow the run, not the nearest end",
      seed: 7 + G.levelIndex * 13,
      count: 5,
      onDone: function () {
        t.done = true;
        sfx("power");
        cutscene(G, {
          dur: 9.5,
          caption: "Out past the ring road, and then twenty miles of nobody.",
          paint: paintDrive,
          onDone: function () {
            enterSubmap(G, SUBMAPS.roadside, [5, 4]);
            advanceStep(G, "car");
            say(G, [
              ["", "It coughs twice on the hill and then it is only the two of them and the noise the wind makes."],
              ["ANWAR", "How much was in it?"],
              ["OUISSY", "It was somebody else's car, Anwar."],
              ["ANWAR", "Fair."],
            ]);
          },
        });
      },
    });
  }

  /* The horse. Nothing about this is a puzzle. She has been shut in for two
     days and she is delighted, and that is the point of the scene. */
  function HORSE_USE(G, t) {
    t.done = true;
    sfx("found");
    say(G, [
      ["", "There is one animal left in the barn and she has heard them coming from the yard."],
      ["", "She puts her whole head over the door before Ouissy has got near it."],
      ["OUISSY", "Oh — hello. Hello."],
      ["ANWAR", "She's enormous."],
      ["OUISSY", "She's lovely. Look at her."],
      ["", "There is a headcollar on the hook and somebody's name painted over the stall. She is not going to be collected."],
      ["ANWAR", "Can you actually ride?"],
      ["OUISSY", "No."],
      ["ANWAR", "Right."],
      ["OUISSY", "Get on."],
    ], function () {
      cutscene(G, {
        dur: 9,
        caption: "It takes most of the morning, and neither of them minds.",
        paint: paintRide,
        onDone: function () { finishLevel(G); },
      });
    });
  }

  /* The radio. It is on a shelf in the day room and it has been repeating
     the same forty seconds since before either of them woke up. */
  var RADIO = [
    "— stay off the roads at night. Do not attempt to reach us after dark —",
    "— Ashcombe reception is open. We are accepting anyone who is not bitten —",
    "— you will be checked at the gate and you will be given the serum. Both are required —",
    "— that is Ashcombe. North road, past the reservoir. We are still here —",
  ];

  function showRadio(G, onDone) {
    G.state = "note";
    G.keys = freshKeys();
    var wrap = el("div", "ap-radio");
    var set = el("div", "ap-radio-set");
    set.appendChild(el("span", "ap-radio-grille"));
    var dial = el("div", "ap-radio-dial");
    dial.appendChild(el("span", "ap-radio-needle"));
    set.appendChild(dial);
    set.appendChild(el("span", "ap-radio-knob"));
    wrap.appendChild(set);
    var line = el("p", "ap-radio-line", RADIO[0]);
    wrap.appendChild(line);
    wrap.appendChild(el("p", "ap-radio-cap", "somebody is still broadcasting"));
    var b = el("button", "ap-note-ok", "Listen to it again, then go");
    b.addEventListener("click", function () {
      clearInterval(iv);
      closeOverlay();
      G.state = "play";
      if (onDone) onDone();
    });
    wrap.appendChild(b);
    openOverlay(wrap, "thin");
    var n = 0;
    var iv = setInterval(function () {
      n = (n + 1) % RADIO.length;
      line.textContent = RADIO[n];
      sfx("blip");
    }, 3400);
  }

  /* =======================================================================
     24. OFFLINE TEST HOOKS

        None of this runs while she plays and nothing in the game calls any
        of it. It exists so the chapter can be driven from a headless
        browser, which is the only way to actually see what it looks like.

        requestAnimationFrame runs at about three frames a second in that
        container, so anything that waits on the clock runs in slow motion
        and proves nothing. __apPump steps the fixed timestep by hand
        instead — the same lesson super-ouissy.js writes up at its foot.
     ======================================================================= */
  window.__apEnter = function (i, withIntro) {
    closeOverlay();
    G.levelIndex = i;
    G.level = buildLevel(LEVELS[i]);
    G.player = mkPlayer(G.level.start.x, G.level.start.y);
    G.safe = { x: G.level.start.x, y: G.level.start.y };
    G.stepIndex = 0;
    G.steps = G.level.def.steps || [];
    G.step = G.steps[0];
    G.state = "play";
    G.keys = freshKeys();
    G.pressure = 0;
    G.pressureT = PRESSURE_EVERY;
    snapCam(G);
    setHud(G);
    if (withIntro && LEVEL_INTRO[i]) LEVEL_INTRO[i](G);
    return { w: G.level.w, h: G.level.h, zombies: G.level.zombies.length,
             things: G.level.things.map(function (t) { return t.kind; }) };
  };

  window.__apPump = function (secs, keys) {
    var was = G.keys;
    G.keys = Object.assign(freshKeys(), keys || {});
    for (var i = 0; i < Math.round(secs * 60); i++) step(G, STEP);
    G.keys = was;
    stepCam(G);
    return { x: Math.round(G.player.x), y: Math.round(G.player.y), state: G.state,
             hidden: G.player.hidden, closeCalls: G.closeCalls, step: G.step && G.step.clears };
  };

  window.__apPaint = function () { if (G && G.level) { stepCam(G); paint(G); } };

  window.__apTeleport = function (tx, ty) {
    G.player.x = tx * T + T / 2; G.player.y = ty * T + T / 2;
    G.player.vx = 0; G.player.vy = 0;
    snapCam(G);
    return { x: G.player.x, y: G.player.y };
  };

  /* open one of the overlays directly, for looking at it */
  window.__apOpen = function (what) {
    if (what === "panel") {
      var t = G.level.things.filter(function (t) { return t.kind === "panel"; })[0] || { done: false };
      useThing(G, t);
    } else if (what === "note") {
      var n = G.level.things.filter(function (t) { return t.kind === "note"; })[0];
      if (n) useThing(G, n); else showNote(G, { done: false }, NOTES[0] ? NOTES[0].text : "test", "1408");
    } else if (what === "tv") {
      var v = G.level.things.filter(function (t) { return t.kind === "tv"; })[0];
      if (v) useThing(G, v);
    } else if (what === "keypad") {
      openKeypad(G, { open: false, kind: "locked" }, "1408", function () {});
    } else if (what === "caught") {
      caught(G); G.caughtT = 0.4; G.caughtShown = true; showCloseCall(G);
    } else if (what === "card") {
      showLevelCard(G.levelIndex, function () {});
    } else if (what === "howto") {
      showHowTo();
    }
  };

  window.__apUse = function () { doUse(G); };
  window.__apPanelState = function () {
    if (!G.__panel) return null;
    var P = G.__panel.P;
    return { w: PW_W, h: PW_H, done: P.done, count: P.count,
             wires: P.wires.map(function (w) { return { key: w.key, ex: w.ex, ey: w.ey, placed: !!w.placed }; }),
             sockets: P.sockets.map(function (s) { return { key: s.key, x: s.x, y: s.y, filled: s.filled }; }) };
  };
  window.__apDrive = function () {
    cutscene(G, { dur: 9.5, caption: "Out past the ring road, and then twenty miles of nobody.",
      paint: paintDrive, onDone: function () { enterSubmap(G, SUBMAPS.roadside, [5, 4]); } });
  };
  window.__apRide = function () {
    cutscene(G, { dur: 9, caption: "It takes most of the morning, and neither of them minds.",
      paint: paintRide, onDone: function () {} });
  };
  window.__apKeypadType = function (code) {
    if (!G.__keypad) return false;
    G.__keypad.enter(code);
    G.__keypad.ok();
    return true;
  };
  window.__apKeys = function () { return G.keys; };
  window.__apMapKey = function () { return G.level.def.key || G.level.def.name; };
  window.__apZombies = function () {
    return G.level.zombies.map(function (z) { return { x: z.x, y: z.y, state: z.state }; });
  };
  window.__apMoveZombie = function (i, tx, ty) {
    var z = G.level.zombies[i];
    z.x = tx * T + T / 2; z.y = ty * T + T / 2;
    return { x: z.x, y: z.y };
  };
  window.__apSolvePanel = function () { if (G.__panel) G.__panel.solve(); };
  window.__apState = function () {
    return { state: G.state, level: G.levelIndex, step: G.step && G.step.clears,
             closeCalls: G.closeCalls, code: G.code, pressure: G.pressure,
             anwar: G.level.anwar ? { awake: G.level.anwar.awake, x: Math.round(G.level.anwar.x), y: Math.round(G.level.anwar.y) } : null,
             zombies: G.level.zombies.length,
             doors: Object.keys(G.level.doors).map(function (k) {
               return k + ":" + G.level.doors[k].kind + (G.level.doors[k].open ? "(open)" : ""); }) };
  };
  return {
    start: start,
    stop: stop,
    pause: function () { togglePause(); },
  };
})();
