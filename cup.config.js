/* =========================================================================
   OUISSY'S CUP — THE ONE FILE YOU EDIT

   Everything personal about this chapter lives here and nowhere else.
   Rename the teams, rewrite the memories, swap the victory message,
   change the difficulty — none of it needs the game code opened.

   It is a plain script that hangs one object off `window`, like every
   other file on this site. No build step, no import, no JSON fetch: it
   is loaded before cup.js and read once when the chapter starts.

   ---------------------------------------------------------------------
   WHERE TO FIND THINGS

     TITLE / TAGLINE   the hub card's words
     ANWAR             the second special slot — the one that is you
     ROSTER            the fourteen players, their stats and their supers
     TEAMS             the six faculties, their kits and their squads
     VENUES            the campuses, and the light at each of them
     MODES             the cup, the friendly and the derby
     FORMATIONS        shapes, and what each does to the teammates' AI
     MEMORIES          the cards between rounds — YOUR words go here
     VICTORY           the ending card — YOUR words go here
     RULES             match length, the Heart meter, the Super Shot
     DIFFICULTIES      the three settings and what each one moves
     PIXEL             the retro render layer

   Nothing in here invents anything about the two of you: the memories
   and the ending are written out of what this site already knows —
   medicine, dentistry, a hard year — and they are meant to be replaced
   with the real ones. The `photo` fields are empty on purpose.
   ========================================================================= */

window.CUP_CONFIG = {

  /* ---------------------------------------------------------------- name */
  TITLE: "Ouissy’s Cup",
  /* the line under the card on "Choose your adventure" */
  TAGLINE: "Win the cup and find your way back to me",

  /* ------------------------------------------------------------ the look
     The chapter is built in 3D and then rendered through a small buffer
     and blown up with hard edges, so it reads as pixel art like the rest
     of the site while keeping the depth and the camera.

     `height` is the height of that buffer in pixels — the width follows
     the shape of the screen. 270 is about four times the 320x180 the
     other chapters use, which is small enough to read as pixels and big
     enough that a face still has a face on it. Drop it to 180 for a
     chunkier look; set `on` to false to see it smooth. */
  PIXEL: { on: true, height: 270, snap: true },

  /* -------------------------------------------------------------- rules
     Every one of these is read by the game. Change a number here and the
     match changes; nothing below is decoration. */
  RULES: {
    halfSeconds: 52,        // real seconds per half; the clock shows 45'
    difficulty: "normal",   // "easy" | "normal" | "hard" — the starting one
    goldenGoal: 60,         // sudden death if a knockout tie is level

    /* ---- the Heart meter ----------------------------------------------
       What fills it, out of `superCost`. These are balanced so that a
       half of decent football gets her one Super Shot and a very good
       half gets her two: often enough to be the thing she plays FOR,
       rare enough that it still stops the room when it happens. */
    heartPerPass: 9,        // a pass that actually finds a teammate
    heartPerTackle: 14,     // winning it back
    heartPerShot: 11,       // having a go
    heartPerConcede: 18,    // going behind hands you something back
    superCost: 100,
    superKeepOnHalf: true,  // a charged meter survives half time
    aiSupersFrom: 0.62,     // opponents only get supers at this skill and
                            //   above — so the quarter-final never has one
                            //   fired at her before she knows what they are
    showHelpFirstTime: true,
  },

  /* The three difficulties. `skill` multiplies every opponent's one dial
     (how tightly they close down, how far they read a pass, how willing
     they are to shoot). `heart` multiplies how fast her meter fills, so
     Easy is not merely a slower opponent — it is more supers for her. */
  DIFFICULTIES: [
    { id: "easy",   name: "RELAXED", note: "they give you room · the meter fills fast",
      skill: 0.74, heart: 1.35, gk: 0.90 },
    { id: "normal", name: "NORMAL", note: "a real match",
      skill: 1.00, heart: 1.00, gk: 1.00 },
    { id: "hard",   name: "SERIOUS", note: "they press, and their keeper is awake",
      skill: 1.22, heart: 0.80, gk: 1.10 },
  ],

  /* ================================================================
     ANWAR — THE SECOND SPECIAL SLOT

     This one is you. Change the name, the colours and the words; the
     game will follow. He captains the side she meets in the final.
     ================================================================ */
  ANWAR: {
    name: "ANWAR",                       // <- your name
    /* The same colouring he has everywhere else on this site — the
       apocalypse builds him at exactly these two values, so the man in
       the dental faculty's shirt is the same man who walks out of the
       bad world at the end of that chapter. Change them here and the
       roster entry below follows; nothing else needs touching. */
    skin: "#c2905f", hair: "#2e2018",
    beard: true, glasses: true, curly: true,
    shirt: "#1d6b6e", shirtDark: "#12494b",
    shorts: "#f2e6cf", shortsDark: "#cdbf9f",
    socks: "#1d6b6e", trim: "#e8b23c",
    celebrationWith: "ouissy",           // the paired high-five
  },

  /* ================================================================
     THE ROSTER — fourteen originals

     All invented for this game. Every one is meant to be identifiable
     by silhouette alone, so each has its own `build` (how tall and how
     wide), its own `head` (hair or headwear) and its own colour family.

       build.h   height, 1.0 is average
       build.w   width
       head      which head the rig builds — see HEADS in cup.js
       stats     speed / power / skill / defence, 0-100, and they drive
                 the game: speed is top pace, power is shot strength,
                 skill is first touch and curve, defence is tackling
       super     the signature shot, its name, and the colour it burns
     ================================================================ */
  ROSTER: [
    /* ---- the two stars ---- */
    {
      id: "ouissy", name: "OUISSY", role: "st", star: true, captainable: true,
      tag: "Star Captain · Playmaker",
      build: { h: 1.00, w: 1.00 }, head: "ouissy",
      /* HER OWN COLOURS, the ones she has in every other chapter on this
         site: super-ouissy.js builds her at exactly these, long blonde
         hair and all, and a version of her with brown hair in one game
         is a different person. `eye` is the site's ink purple rather
         than black, which is what keeps her readable against a pale
         sky. */
      skin: "#ffe6d4", hair: "#e0b34e", eye: "#3d2340", blush: true,
      colour: { a: "#c1272d", b: "#f6efdd", c: "#e8b23c" },
      stats: { speed: 88, power: 78, skill: 95, defence: 65 },
      super: { name: "HEARTBEAT STRIKE", colour: "#ff5f8f", kind: "heart",
               note: "the ball becomes a heart and bursts into more of them" },
      emblem: "heart", armband: true,
    },
    {
      id: "anwar", name: "ANWAR", role: "st", star: true, captainable: true,
      tag: "Co-Star · Striker",
      /* his skin and hair are not really set here: ANWAR above wins, and
         cup.js copies them down over this entry as it loads. They are
         written out anyway so this table reads true on its own. */
      build: { h: 1.09, w: 1.04 }, head: "anwar",
      skin: "#c2905f", hair: "#2e2018",
      colour: { a: "#1d6b6e", b: "#e8b23c", c: "#f6f2ea" },
      stats: { speed: 82, power: 90, skill: 84, defence: 70 },
      super: { name: "HOMECOMING", colour: "#ffc63c", kind: "rocket",
               note: "a straight golden rocket, and a high-five afterwards" },
      emblem: "heart", armband: true,
    },

    /* ---- strikers ---- */
    {
      id: "ember", name: "EMBER", role: "st", captainable: true,
      tag: "Striker · quick and hot-headed",
      build: { h: 0.87, w: 0.92 }, head: "flame",
      skin: "#f2c79c", hair: "#e8642a",
      colour: { a: "#f0762a", b: "#c72d1e", c: "#2e2a2c" },
      stats: { speed: 92, power: 74, skill: 80, defence: 48 },
      super: { name: "FIREBRAND", colour: "#ff7a2a", kind: "flame",
               note: "low and curling, and it scorches the grass" },
      emblem: "flame", trail: "spark",
    },
    {
      id: "atlas", name: "ATLAS", role: "st", captainable: true,
      tag: "Striker · built like the mountain",
      build: { h: 1.14, w: 1.26 }, head: "crop",
      skin: "#c9925e", hair: "#241a12",
      colour: { a: "#57c79a", b: "#c1272d", c: "#e6d3a8" },
      stats: { speed: 66, power: 96, skill: 70, defence: 78 },
      super: { name: "AVALANCHE", colour: "#c02a22", kind: "quake",
               note: "the screen shakes and the keeper goes backwards with it" },
      emblem: "mountain",
    },
    {
      id: "comet", name: "COMET", role: "st", captainable: true,
      tag: "Striker · gone before you look up",
      build: { h: 1.02, w: 0.90 }, head: "goggles",
      skin: "#e8c2a0", hair: "#3a4a63",
      colour: { a: "#2f8fe0", b: "#f6f8fb", c: "#b9c6d4" },
      stats: { speed: 95, power: 70, skill: 82, defence: 50 },
      super: { name: "SHOOTING STAR", colour: "#9fe8ff", kind: "arc",
               note: "up, over, and down into the corner on a trail of stars" },
      emblem: "star", trail: "star",
    },

    /* ---- playmakers ---- */
    {
      id: "lumi", name: "LUMI", role: "mid", captainable: true,
      tag: "Playmaker · sees the pass before it exists",
      build: { h: 0.90, w: 0.96 }, head: "bun",
      skin: "#f6dcc0", hair: "#b07a3c",
      colour: { a: "#e8a63c", b: "#f6efdd", c: "#8a6134" },
      stats: { speed: 78, power: 66, skill: 93, defence: 68 },
      super: { name: "LANTERN", colour: "#ffc266", kind: "curl",
               note: "it glows, and it bends around whoever is in the way" },
      emblem: "lantern", charm: true,
    },
    {
      id: "sage", name: "SAGE", role: "mid", captainable: true,
      tag: "Playmaker · never looks like they are trying",
      build: { h: 1.10, w: 0.86 }, head: "sprig",
      skin: "#e2c4a2", hair: "#6a5a3e",
      colour: { a: "#8fb87a", b: "#f4f1e6", c: "#6a5238" },
      stats: { speed: 74, power: 68, skill: 90, defence: 72 },
      super: { name: "WIND-UP", colour: "#bfe8a8", kind: "finesse",
               note: "finds the far corner every single time" },
      emblem: "leaf",
    },
    {
      id: "echo", name: "ECHO", role: "mid", captainable: true,
      tag: "Playmaker · cannot stand still",
      build: { h: 0.92, w: 0.90 }, head: "phones",
      skin: "#d9a882", hair: "#6b3f8a",
      colour: { a: "#8a52c6", b: "#e87ab0", c: "#4a4f5e",
      },
      stats: { speed: 85, power: 64, skill: 88, defence: 60 },
      super: { name: "REWIND", colour: "#b07aff", kind: "feint",
               note: "leaves as a pass and arrives as a shot" },
      emblem: "note",
    },

    /* ---- defenders ---- */
    {
      id: "boulder", name: "BOULDER", role: "def", captainable: true,
      tag: "Defender · does not move for anybody",
      build: { h: 0.94, w: 1.38 }, head: "flat",
      skin: "#c79a72", hair: "#3e4248",
      colour: { a: "#7d838c", b: "#25314a", c: "#e8a63c" },
      stats: { speed: 58, power: 88, skill: 62, defence: 95 },
      super: { name: "GROUND SHAKER", colour: "#d8a24a", kind: "quake",
               note: "a clearance that keeps going until it is a goal" },
      emblem: "shield",
    },
    {
      id: "thorn", name: "THORN", role: "def", captainable: true,
      tag: "Defender · waiting for you to take a touch too many",
      build: { h: 1.04, w: 0.94 }, head: "pads",
      skin: "#d6a078", hair: "#241418",
      colour: { a: "#8f1f2c", b: "#191519", c: "#c6ccd4" },
      stats: { speed: 76, power: 80, skill: 66, defence: 90 },
      super: { name: "COUNTER-STRIKE", colour: "#d0344a", kind: "counter",
               note: "wins it and hits it in the same movement" },
      emblem: "rose",
    },
    {
      id: "willow", name: "WILLOW", role: "def", captainable: true,
      tag: "Defender · ends up in their box somehow",
      build: { h: 1.16, w: 0.88 }, head: "willow",
      skin: "#eccfb4", hair: "#4a7a72",
      colour: { a: "#3f9a96", b: "#c2a6e0", c: "#f6efdd" },
      stats: { speed: 80, power: 70, skill: 78, defence: 86 },
      super: { name: "OVERLAP", colour: "#5fd6cc", kind: "surge",
               note: "comes from her own half on a teal ribbon and finishes" },
      emblem: "branch",
    },

    /* ---- keepers ---- */
    {
      id: "gustav", name: "GUSTAV", role: "gk",
      tag: "Keeper · has seen all of this before",
      build: { h: 1.06, w: 1.18 }, head: "cap",
      skin: "#e8c9a8", hair: "#6a5232",
      colour: { a: "#d8a62a", b: "#2f6b3c", c: "#6a4a2a" },
      stats: { speed: 62, power: 74, skill: 60, defence: 92 },
      super: { name: "WALL UP", colour: "#ffd45e", kind: "wall",
               note: "gets bigger, and glows, and you do not beat him" },
      emblem: "glove",
    },
    {
      id: "marina", name: "MARINA", role: "gk",
      tag: "Keeper · airborne before the ball is",
      build: { h: 1.02, w: 0.92 }, head: "pony",
      skin: "#f0d2b8", hair: "#2f4a6b",
      colour: { a: "#2f7fc4", b: "#f6f8fb", c: "#f08a72" },
      stats: { speed: 84, power: 64, skill: 72, defence: 88 },
      super: { name: "TIDAL SAVE", colour: "#5fd0f0", kind: "wall",
               note: "full stretch, and it can tip out even a super" },
      emblem: "wave",
    },
  ],

  /* ================================================================
     THE FACULTIES

     Six Moroccan health-sciences schools. The names and abbreviations
     are the real ones; the crests, the colours and the squads are
     invented for this game — no real logo, badge or mark is copied or
     imitated anywhere in this chapter.

     FMDC is his (dentistry). FMPM is hers (medicine). The cup is drawn
     so that those two meet in the final, which is the whole point of
     it, and `derby` marks them so the game knows.

     `venue` is the campus a side plays its home games at — see VENUES.
     `squad` is four ids from the ROSTER, keeper first.
     ================================================================ */
  TEAMS: [
    {
      id: "fmdc", name: "FMDC CASABLANCA", short: "FMDC",
      sub: "Faculty of Dental Medicine",
      crest: "tooth", flag: "crest", derby: "his", venue: "casa",
      kit: { shirt: "#1d6b6e", shirtDark: "#12494b", shorts: "#f2e6cf",
             shortsDark: "#cdbf9f", socks: "#1d6b6e", trim: "#e8b23c" },
      gkKit: { shirt: "#2a2438", shirtDark: "#1a1626", shorts: "#12101c",
               shortsDark: "#0a0812", socks: "#2a2438", trim: "#f2b8c6" },
      squad: ["marina", "anwar", "sage", "thorn"], captain: "anwar",
      formation: "diamond",
    },
    {
      id: "fmpm", name: "FMPM MARRAKECH", short: "FMPM",
      sub: "Medicine and Pharmacy",
      crest: "caduceus", flag: "crest", venue: "marrakech",
      kit: { shirt: "#c1272d", shirtDark: "#8f1a20", shorts: "#f6efdd",
             shortsDark: "#cdbf9f", socks: "#c1272d", trim: "#e8b23c" },
      gkKit: { shirt: "#1f6f4a", shirtDark: "#134a31", shorts: "#12241c",
               shortsDark: "#0b1712", socks: "#1f6f4a", trim: "#ffd45e" },
      squad: ["gustav", "ember", "lumi", "atlas"], captain: "lumi",
      formation: "diamond",
    },
    {
      id: "uir", name: "UIR RABAT", short: "UIR",
      sub: "International University of Rabat",
      crest: "shield", flag: "crest", venue: "rabat",
      kit: { shirt: "#2f5fa8", shirtDark: "#1f4076", shorts: "#f6f8fb",
             shortsDark: "#c8ced6", socks: "#2f5fa8", trim: "#ffd45e" },
      gkKit: { shirt: "#1f2b3c", shirtDark: "#141c28", shorts: "#0f151d",
               shortsDark: "#080c11", socks: "#1f2b3c", trim: "#7fd4f5" },
      squad: ["marina", "comet", "sage", "boulder"], captain: "comet",
      formation: "wide",
    },
    {
      id: "upm", name: "UPM MARRAKECH", short: "UPM",
      sub: "Private University of Marrakech",
      crest: "mortar", flag: "crest", derby: "hers", home: true, venue: "marrakech",
      kit: { shirt: "#e08a3c", shirtDark: "#b06428", shorts: "#3a2a1e",
             shortsDark: "#241a12", socks: "#e08a3c", trim: "#f6efdd" },
      gkKit: { shirt: "#7a3a1e", shirtDark: "#502414", shorts: "#2a1810",
               shortsDark: "#180e09", socks: "#7a3a1e", trim: "#ffd45e" },
      squad: ["gustav", "ouissy", "echo", "willow"], captain: "ouissy",
      formation: "wide",
    },
    {
      id: "um6ss", name: "UM6SS CASABLANCA", short: "UM6SS",
      sub: "Health Sciences",
      crest: "molecule", flag: "crest", venue: "casa",
      kit: { shirt: "#5f9a5c", shirtDark: "#3f6e3c", shorts: "#f4f1e6",
             shortsDark: "#cdc8b6", socks: "#5f9a5c", trim: "#e8b23c" },
      gkKit: { shirt: "#2a4a2c", shirtDark: "#1a301c", shorts: "#142016",
               shortsDark: "#0c140e", socks: "#2a4a2c", trim: "#bfe8a8" },
      squad: ["marina", "willow", "lumi", "boulder"], captain: "willow",
      formation: "flat",
    },
    {
      id: "um6p", name: "UM6P BEN GUERIR", short: "UM6P",
      sub: "Mohammed VI Polytechnic",
      crest: "atom", flag: "crest", venue: "benguerir",
      kit: { shirt: "#7a4fb0", shirtDark: "#553578", shorts: "#2a2438",
             shortsDark: "#1a1626", socks: "#7a4fb0", trim: "#f2b8c6" },
      gkKit: { shirt: "#2f2a3e", shirtDark: "#1e1a2a", shorts: "#14111c",
               shortsDark: "#0c0a12", socks: "#2f2a3e", trim: "#e87ab0" },
      squad: ["gustav", "echo", "atlas", "thorn"], captain: "atlas",
      formation: "flat",
    },
  ],

  /* ================================================================
     THE VENUES

     Every match is hosted somewhere, and the somewhere is a campus.
     Each one has its own hour of the day and its own light, which is
     the cheapest way to make six matches feel like six different
     occasions rather than one pitch reskinned.

       sky / horizon   the two colours the sky runs between
       sun             the key light, and how strong it is
       ambient         the bounce, which decides how dark a shaded face
                       goes — a night match needs far more of it than
                       you would expect or everybody turns to silhouette
       grass / stripe  the turf, and the mown band over it
       stand / seats   the concrete and the crowd
       hour            shown on the fixture card
     ================================================================ */
  VENUES: [
    { id: "rabat", name: "RABAT CAMPUS", city: "Rabat", hour: "16:00",
      note: "wind off the river, and the whole faculty on the far side",
      sky: "#3e8fd0", horizon: "#cfe8f4", sun: "#fff6e0", sunStrength: 2.1,
      ambient: 0.36, grass: "#4bab52", stripe: "#3f9b46",
      stand: "#5b6570", seats: "cool", fog: [420, 820] },

    { id: "marrakech", name: "MARRAKECH CAMPUS", city: "Marrakech", hour: "18:30",
      note: "the light goes orange about twenty minutes in",
      sky: "#e86a3c", horizon: "#ffd9a0", sun: "#ffd08a", sunStrength: 2.4,
      ambient: 0.42, grass: "#4f9e4a", stripe: "#428a3f",
      stand: "#8a5a3c", seats: "warm", fog: [360, 720] },

    { id: "casa", name: "CASABLANCA CAMPUS", city: "Casablanca", hour: "11:00",
      note: "sea fog that never quite burns off",
      sky: "#8fb8cc", horizon: "#e8f0f2", sun: "#f4f2e8", sunStrength: 1.7,
      ambient: 0.52, grass: "#46a04e", stripe: "#3c9044",
      stand: "#7c858e", seats: "cool", fog: [300, 640] },

    { id: "benguerir", name: "BEN GUERIR CAMPUS", city: "Ben Guerir", hour: "14:00",
      note: "no shade anywhere and the ball runs fast",
      sky: "#4aa8e0", horizon: "#f2e0bc", sun: "#fffaf0", sunStrength: 2.6,
      ambient: 0.40, grass: "#5aa84c", stripe: "#4d963f",
      stand: "#b09a74", seats: "warm", fog: [460, 900] },

    /* the final, and the derby: under the lights */
    { id: "night", name: "THE DERBY \u00b7 UNDER THE LIGHTS", city: "Casablanca",
      hour: "21:00", note: "floodlights, and nobody has gone home",
      sky: "#101a2e", horizon: "#2a3a58", sun: "#cfe0ff", sunStrength: 1.5,
      ambient: 0.58, grass: "#4a9d4e", stripe: "#3f8a44",
      stand: "#3a424e", seats: "bright", fog: [280, 620], floodlit: true },
  ],

  /* ================================================================
     THE MODES

     AMICAL      a friendly. Any two faculties, any campus.
     COUPE       the tournament: six faculties, quarter, semi, final —
                 and the draw is fixed so that the final is the derby.
     DERBY       his faculty against hers, under the lights, on its own.
     ================================================================ */
  MODES: [
    { id: "coupe", name: "THE INTER-FACULTY CUP",
      note: "six faculties \u00b7 three rounds \u00b7 one trophy",
      primary: true },
    { id: "amical", name: "FRIENDLY MATCH",
      note: "one game, any two sides, any campus" },
    { id: "derby", name: "THE DERBY",
      note: "dentistry against Marrakech \u00b7 under the lights" },
  ],

  /* The cup's three rounds. `id` is who she meets; the final is fixed
     to his faculty because that is the story the chapter is telling. */
  ROUNDS: [
    { id: "um6p",  round: "QUARTER-FINAL", venue: "benguerir", skill: 0.44,
      before: "UM6P first. They have a pitch nobody likes playing on.",
      won: "Through. Somebody from the faculty is already posting about it.",
      lost: "UM6P, then. It happens to better sides than us." },
    { id: "uir",   round: "SEMI-FINAL", venue: "rabat", skill: 0.64,
      before: "Rabat in the semi. Nobody had you getting this far.",
      won: "Into the final. The whole faculty is standing up.",
      lost: "Rabat were better. Nobody who watched it will say otherwise." },
    { id: "fmdc",  round: "THE FINAL", venue: "night", skill: 0.80, derby: true,
      before: "And the final is against his faculty. Of course it is.",
      won: "You beat him. In front of everybody.",
      lost: "He beat you, and he has the decency to look sorry about it." },
  ],

  /* ================================================================
     FORMATIONS

     `up` is how far up the pitch that slot sits, 0 at its own goal and
     1 at the one it is attacking; `across` is 0 at the left touchline
     and 1 at the right. The teammates' AI reads these directly, so a
     shape is not decoration: a flat back three really does sit deeper.
     ================================================================ */
  FORMATIONS: [
    { id: "diamond", name: "DIAMOND", note: "balanced — one up, one back, one wide",
      slots: { gk: { up: 0.035, across: 0.50 }, def: { up: 0.26, across: 0.50 },
               mid: { up: 0.50, across: 0.34 }, st:  { up: 0.70, across: 0.62 } } },
    { id: "wide", name: "WIDE", note: "stretched — good for running at them",
      slots: { gk: { up: 0.035, across: 0.50 }, def: { up: 0.22, across: 0.34 },
               mid: { up: 0.52, across: 0.76 }, st:  { up: 0.76, across: 0.44 } } },
    { id: "flat", name: "FLAT", note: "deep — hard to get through, slow to break",
      slots: { gk: { up: 0.035, across: 0.50 }, def: { up: 0.18, across: 0.42 },
               mid: { up: 0.38, across: 0.60 }, st:  { up: 0.66, across: 0.50 } } },
  ],

  /* ================================================================
     THE MEMORIES — between the rounds

     One comes up after each round she wins, before the next fixture is
     drawn: the tournament stops for a moment and says something that is
     not about football. They are indexed by round, so MEMORIES[0] shows
     after the quarter-final and MEMORIES[1] after the semi.

     These are written to be replaced. They deliberately contain nothing
     invented about the two of you — no dates, no places, no borrowed
     anecdotes — only the things that are already true of this site: two
     people studying medicine and dentistry, a hard year, and him making
     games about it. Put the real ones in and they will be better.

       title   the small line above, in caps
       line    the memory itself
       photo   optional, any path under /assets, same as the scrapbook.
               Leave it null for words on their own.
     ================================================================ */
  MEMORIES: [
    { title: "BEFORE ANY OF THIS HAD A TIMETABLE",
      line: "There was a version of me that had not met you yet, and he was " +
            "fine, and he had no idea. I think about him sometimes. He is " +
            "about to have a very good year and he does not know it.",
      photo: null },

    { title: "SAME BUILDING, DIFFERENT FLOOR",
      line: "You are learning how to keep people alive. I am learning how to " +
            "stop them hurting. It is the same job from two directions, which " +
            "is more or less the story of us. The final is your faculty " +
            "against mine and I would like to state for the record that I am " +
            "hoping you win it.",
      photo: null },

    { title: "THE YEAR YOU NEVER COMPLAINED",
      line: "Not enough sleep, a phone propped against a textbook, and you " +
            "never once made any of it my problem. I noticed. I notice all of " +
            "it. That is most of the reason this exists.",
      photo: null },
  ],

  /* ================================================================
     THE ENDING — after she wins the final

     The last thing she reads. Every chapter on this site ends with him
     saying something; this one has had a stadium shouting for ninety
     minutes, so it ends quietly.

     `lines` is a list, shown one under the other. Replace the lot.
     ================================================================ */
  VICTORY: {
    kicker: "FULL TIME",
    title: "YOU WON IT",
    lines: [
      "You have just beaten my faculty in front of everybody, which is " +
      "roughly what you have been doing to me since the day we met.",

      "The other games I made you were all about getting somewhere — up " +
      "the valley, through the night shift, out of a bad world. This one " +
      "is not. This one is ninety minutes of you being good at something " +
      "with a whole stand shouting your name, because you do the hard " +
      "version of that every day with nobody watching at all.",

      "You are going to be a doctor. I am the one in the stands who " +
      "already knew.",
    ],
    signOff: "— Anwar",
    photo: null,          // e.g. "assets/photo-12.jpg"
    button: "TAKE IT HOME",
  },
};
