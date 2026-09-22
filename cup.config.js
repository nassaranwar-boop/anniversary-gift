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
     TEAMS             the ready-made sides, including the placeholders
     FORMATIONS        shapes, and what each does to the teammates' AI
     MEMORIES          the cards between rounds — YOUR words go here
     VICTORY           the ending card — YOUR words go here
     RULES             match length, difficulty, how fast the meter fills
     PIXEL             the retro render layer

   Anything marked PLACEHOLDER is mine and is meant to be replaced.
   Nothing in here invents anything about the two of you.
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

  /* -------------------------------------------------------------- rules */
  RULES: {
    halfSeconds: 52,        // real seconds per half; the clock shows 45'
    difficulty: "normal",   // "easy" | "normal" | "hard" — the default
    goldenGoal: 60,         // sudden death if a knockout tie is level
    heartPerPass: 6,        // what fills the Heart meter, out of 100
    heartPerTackle: 11,
    heartPerShot: 9,
    heartPerConcede: 14,    // going behind gives you something back
    superCost: 100,
    showHelpFirstTime: true,
  },

  /* ================================================================
     ANWAR — THE SECOND SPECIAL SLOT

     This one is you. Change the name, the colours and the words; the
     game will follow. He captains the side she meets in the final.
     ================================================================ */
  ANWAR: {
    name: "ANWAR",                       // <- your name
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
      skin: "#f0cfae", hair: "#4a2f1c",
      colour: { a: "#c1272d", b: "#f6efdd", c: "#e8b23c" },
      stats: { speed: 88, power: 78, skill: 95, defence: 65 },
      super: { name: "HEARTBEAT STRIKE", colour: "#ff5f8f", kind: "heart",
               note: "the ball becomes a heart and bursts into more of them" },
      emblem: "heart", armband: true,
    },
    {
      id: "anwar", name: "ANWAR", role: "st", star: true, captainable: true,
      tag: "Co-Star · Striker",
      build: { h: 1.09, w: 1.04 }, head: "anwar",
      skin: "#e0b189", hair: "#2f231b",
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
     THE TEAMS

     Morocco is hers and stays as the flagship. Germany and Brazil are
     kept as opponents. Everything below them is a PLACEHOLDER named
     after a moment or a place — rename them, recolour them, pick a
     different crest, and the game follows.

     `squad` is four ids from the ROSTER above, keeper first.
     `crest` is one of: heart star flame mountain lantern leaf note
             shield rose branch glove wave key book moon
     ================================================================ */
  TEAMS: [
    {
      id: "mar", name: "MOROCCO", short: "MAR", flag: "mar", crest: "star",
      home: true,
      kit: { shirt: "#c1272d", shirtDark: "#8f1a20", shorts: "#0e6b3c",
             shortsDark: "#08492a", socks: "#c1272d", trim: "#ffffff" },
      gkKit: { shirt: "#1f6f4a", shirtDark: "#134a31", shorts: "#12241c",
               shortsDark: "#0b1712", socks: "#1f6f4a", trim: "#ffd45e" },
      squad: ["gustav", "ouissy", "lumi", "atlas"],
      captain: "ouissy",
      formation: "diamond",
    },
    {
      id: "ger", name: "GERMANY", short: "GER", flag: "ger", crest: "shield",
      kit: { shirt: "#f2f2ef", shirtDark: "#c8c8c2", shorts: "#1c1c22",
             shortsDark: "#0e0e12", socks: "#f2f2ef", trim: "#1c1c22" },
      gkKit: { shirt: "#3a3f6b", shirtDark: "#252945", shorts: "#1c1c22",
               shortsDark: "#0e0e12", socks: "#3a3f6b", trim: "#e0c24a" },
      squad: ["marina", "comet", "sage", "boulder"],
      captain: "comet", formation: "flat",
    },
    {
      id: "bra", name: "BRAZIL", short: "BRA", flag: "bra", crest: "star",
      kit: { shirt: "#f5d020", shirtDark: "#c9a410", shorts: "#1d4fa0",
             shortsDark: "#123268", socks: "#f5f2e8", trim: "#0f7a3c" },
      gkKit: { shirt: "#1b8a4a", shirtDark: "#115c31", shorts: "#1d4fa0",
               shortsDark: "#123268", socks: "#1b8a4a", trim: "#f5d020" },
      squad: ["gustav", "ember", "echo", "willow"],
      captain: "ember", formation: "wide",
    },

    /* ---- HIS SIDE, the final. Not a country: a paper heart. ---- */
    {
      id: "anw", name: "HIS SIDE", short: "ANW", flag: "heart", crest: "heart",
      final: true,
      kit: { shirt: "#1d6b6e", shirtDark: "#12494b", shorts: "#f2e6cf",
             shortsDark: "#cdbf9f", socks: "#1d6b6e", trim: "#e8b23c" },
      gkKit: { shirt: "#2a2438", shirtDark: "#1a1626", shorts: "#12101c",
               shortsDark: "#0a0812", socks: "#2a2438", trim: "#f2b8c6" },
      squad: ["marina", "anwar", "sage", "thorn"],
      captain: "anwar", formation: "diamond",
    },

    /* ================= MEMORY LANE — PLACEHOLDERS =================
       Eight of them. Rename each `name` and `short`, pick colours and
       a crest, and choose four from the ROSTER. Nothing here knows
       anything about you yet — that is deliberate.
       ============================================================== */
    {
      id: "m1", name: "PLACEHOLDER — WHERE YOU MET", short: "MET",
      crest: "key", flag: "crest",
      kit: { shirt: "#b8556e", shirtDark: "#8a3a50", shorts: "#f6efdd",
             shortsDark: "#cdbf9f", socks: "#b8556e", trim: "#ffd9a0" },
      gkKit: { shirt: "#4a3550", shirtDark: "#2f2035", shorts: "#1c1622",
               shortsDark: "#100c14", socks: "#4a3550", trim: "#ffd9a0" },
      squad: ["gustav", "lumi", "echo", "willow"], captain: "lumi",
      formation: "diamond",
    },
    {
      id: "m2", name: "PLACEHOLDER — THE FIRST TRIP", short: "TRP",
      crest: "moon", flag: "crest",
      kit: { shirt: "#3f6ea8", shirtDark: "#2a4c76", shorts: "#f6f8fb",
             shortsDark: "#c8ced6", socks: "#3f6ea8", trim: "#ffd45e" },
      gkKit: { shirt: "#1f2b3c", shirtDark: "#141c28", shorts: "#0f151d",
               shortsDark: "#080c11", socks: "#1f2b3c", trim: "#7fd4f5" },
      squad: ["marina", "comet", "sage", "boulder"], captain: "comet",
      formation: "wide",
    },
    {
      id: "m3", name: "PLACEHOLDER — THE SONG", short: "SNG",
      crest: "note", flag: "crest",
      kit: { shirt: "#7a4fb0", shirtDark: "#553578", shorts: "#2a2438",
             shortsDark: "#1a1626", socks: "#7a4fb0", trim: "#f2b8c6" },
      gkKit: { shirt: "#2f2a3e", shirtDark: "#1e1a2a", shorts: "#14111c",
               shortsDark: "#0c0a12", socks: "#2f2a3e", trim: "#e87ab0" },
      squad: ["gustav", "echo", "lumi", "thorn"], captain: "echo",
      formation: "flat",
    },
    {
      id: "m4", name: "PLACEHOLDER — THE LONG WINTER", short: "WNT",
      crest: "lantern", flag: "crest",
      kit: { shirt: "#5a7d8c", shirtDark: "#3d5763", shorts: "#e8eef0",
             shortsDark: "#c0c8cc", socks: "#5a7d8c", trim: "#ffd9a0" },
      gkKit: { shirt: "#243038", shirtDark: "#161e24", shorts: "#101418",
               shortsDark: "#0a0d0f", socks: "#243038", trim: "#9fe8ff" },
      squad: ["marina", "sage", "willow", "boulder"], captain: "sage",
      formation: "flat",
    },
    {
      id: "m5", name: "PLACEHOLDER — THE KITCHEN", short: "KIT",
      crest: "flame", flag: "crest",
      kit: { shirt: "#e08a3c", shirtDark: "#b06428", shorts: "#3a2a1e",
             shortsDark: "#241a12", socks: "#e08a3c", trim: "#f6efdd" },
      gkKit: { shirt: "#7a3a1e", shirtDark: "#502414", shorts: "#2a1810",
               shortsDark: "#180e09", socks: "#7a3a1e", trim: "#ffd45e" },
      squad: ["gustav", "ember", "atlas", "thorn"], captain: "atlas",
      formation: "wide",
    },
    {
      id: "m6", name: "PLACEHOLDER — THE GARDEN", short: "GDN",
      crest: "leaf", flag: "crest",
      kit: { shirt: "#5f9a5c", shirtDark: "#3f6e3c", shorts: "#f4f1e6",
             shortsDark: "#cdc8b6", socks: "#5f9a5c", trim: "#e8b23c" },
      gkKit: { shirt: "#2a4a2c", shirtDark: "#1a301c", shorts: "#142016",
               shortsDark: "#0c140e", socks: "#2a4a2c", trim: "#bfe8a8" },
      squad: ["marina", "willow", "sage", "lumi"], captain: "willow",
      formation: "diamond",
    },
    {
      id: "m7", name: "PLACEHOLDER — THE SEA", short: "SEA",
      crest: "wave", flag: "crest",
      kit: { shirt: "#2f9aa8", shirtDark: "#1f6a74", shorts: "#f6f8fb",
             shortsDark: "#c8ced6", socks: "#2f9aa8", trim: "#f08a72" },
      gkKit: { shirt: "#14424a", shirtDark: "#0c2a30", shorts: "#0a1c20",
               shortsDark: "#061013", socks: "#14424a", trim: "#5fd0f0" },
      squad: ["marina", "comet", "echo", "willow"], captain: "marina",
      formation: "wide",
    },
    {
      id: "m8", name: "PLACEHOLDER — HOME", short: "HME",
      crest: "book", flag: "crest",
      kit: { shirt: "#a8543c", shirtDark: "#7a3828", shorts: "#f6efdd",
             shortsDark: "#cdbf9f", socks: "#a8543c", trim: "#e8b23c" },
      gkKit: { shirt: "#4a2a1e", shirtDark: "#301a12", shorts: "#20120c",
               shortsDark: "#140b07", socks: "#4a2a1e", trim: "#ffd9a0" },
      squad: ["gustav", "atlas", "lumi", "boulder"], captain: "lumi",
      formation: "diamond",
    },
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

     One shows after each round she wins. Write your own; `photo` is
     optional and takes any path under /assets (the same folder the
     scrapbook uses). Leave photo null for words on their own.
     ================================================================ */
  MEMORIES: [
    { title: "PLACEHOLDER — after the first round",
      line: "Write the first memory here. A place, a date, a thing one of you said.",
      photo: null },
    { title: "PLACEHOLDER — after the semi-final",
      line: "And the second one here. Something from further along the way.",
      photo: null },
  ],

  /* ================================================================
     THE ENDING — after she wins the final
     ================================================================ */
  VICTORY: {
    kicker: "FULL TIME",
    title: "YOU FOUND EACH OTHER",
    message: "PLACEHOLDER — your message goes here. This is the last " +
             "thing she reads, so it should sound like you and not like a " +
             "game. Keep it as long or as short as you like.",
    photo: null,          // e.g. "assets/photo-12.jpg"
    button: "TAKE IT HOME",
  },
};
