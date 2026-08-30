/* =========================================================================
   RESCUE.JS — the part of Super Ouissy that is a story, not a game

   Two things happen here, both on Hard only:

     1. She dies with lives left, and Anwar walks in and picks her up before
        the world does. Two seconds; then she respawns as normal.
     2. She dies to the last boss with no lives left. Anwar comes, and this
        time so does Death, and there is a decision to make.

   It lives in its own file on purpose. None of it touches the platformer's
   physics, its levels or its state — Super Ouissy hands over the canvas,
   calls step() and paint() from the loop it already runs, and takes the
   canvas back when done() says so. Nothing in here can break a jump.

   Everything is drawn at runtime like the rest of the site: Anwar and Death
   are pixel maps at the top of the file, and Ouissy is borrowed from the
   game so there is only ever one drawing of her.

   Public API used by super-ouissy.js:
     Rescue.begin(kind, opts)   "rescue" | "death"
     Rescue.step(dt)            advance
     Rescue.paint(ctx, t)       draw into the game's canvas
     Rescue.done()              true when Super Ouissy should take over
     Rescue.press(name)         an input: "confirm" | "left" | "right" | ...
     Rescue.outcome()           what the player chose, once done
   ========================================================================= */
window.Rescue = (function () {
  "use strict";

  var VW = 320, VH = 180;              // the same stage the game draws on

  /* =======================================================================
     ✏️  THE WORDS

     Every line the sequence says. Nothing here is a placeholder; edit any
     of it and the scene changes. `who` is who is speaking and decides the
     colour of the name and the box.
     ======================================================================= */
  var SCRIPT = {

    /* --- 1. she dies on Hard with lives left ------------------------- */
    rescue: [
      { who: "anwar", text: "Not today." },
    ],
    /* a different one each time, so it does not wear out */
    rescueAlt: [
      [{ who: "anwar", text: "Not today." }],
      [{ who: "anwar", text: "I've got you. Go again." }],
      [{ who: "anwar", text: "Up you get. I'm right here." }],
      [{ who: "anwar", text: "That one wasn't your fault. Again." }],
      [{ who: "anwar", text: "You're closer than you think." }],
    ],

    /* --- 2. the last boss takes her last life ------------------------ */
    death: {
      /* Anwar arrives, as he always does */
      arrive: [
        { who: "anwar", text: "I've got you." },
        { who: "anwar", text: "Stay behind me." },
      ],
      /* and then so does something else */
      meet: [
        { who: "death", text: "Step aside." },
        { who: "death", text: "She is finished. Her lives are spent. This is the part where I do my work and you do not." },
        { who: "anwar", text: "No." },
        { who: "death", text: "..." },
        { who: "death", text: "I know you." },
        { who: "death", text: "The one who would not go quietly. They still talk about you where I come from — the one I could not close my hand around." },
        { who: "death", text: "You walked away from all of that. You put it down. So put this down too, and step aside." },
        { who: "anwar", text: "I did put it down." },
        { who: "anwar", text: "This one is different." },
        { who: "death", text: "They are always different, to somebody." },
        { who: "anwar", text: "Not to somebody. To me." },
        { who: "anwar", text: "Forget it. You're not taking her." },
        { who: "death", text: "Then you are back." },
        { who: "anwar", text: "No." },
        { who: "death", text: "Then this will be quick." },
      ],
      /* the scythe comes down, and does not land */
      caught: [
        { who: "anwar", text: "You asked if I'm back." },
        { who: "anwar", text: "Hell yeah, I am." },
      ],
      /* the choice */
      choice: {
        prompt: "It is her turn to decide.",
        fight: "Fight Death as Anwar",
        letgo: "Let it go — start over",
      },

      /* --- the fight ------------------------------------------------- */
      tutorial: [
        { who: "anwar", text: "Watch his hands. He tells you what he's doing before he does it." },
        { who: "sys", text: "BLOCK  when the scythe comes down  —  press SPACE" },
        { who: "sys", text: "DODGE  when it sweeps low  —  press ← or →" },
        { who: "sys", text: "STRIKE when he is open  —  press SPACE" },
        { who: "sys", text: "Miss one and nothing is lost. Take your time." },
      ],
      /* the near-miss, partway through */
      closeCall: [
        { who: "death", text: "You are slower than the stories." },
        { who: "anwar", text: "...I'm older than the stories." },
      ],
      closeCallAfter: [
        { who: "anwar", text: "That one was close." },
        { who: "anwar", text: "Won't be another." },
      ],
      /* he wins */
      win: [
        { who: "death", text: "Enough." },
        { who: "death", text: "Keep her, then. I am patient, and I am not in a hurry with you." },
        { who: "anwar", text: "Take your time." },
        { who: "death", text: "..." },
        { who: "death", text: "Look after her." },
        { who: "anwar", text: "That was always the plan." },
      ],

      /* --- the other path -------------------------------------------- */
      letgo: [
        { who: "ouissy", text: "Anwar. Don't." },
        { who: "anwar", text: "..." },
        { who: "ouissy", text: "I don't want to be something you had to win." },
        { who: "ouissy", text: "I'd rather just start again." },
        { who: "death", text: "She is wiser than you." },
        { who: "anwar", text: "She always was." },
        { who: "death", text: "..." },
        { who: "death", text: "Then go. Both of you. It costs me nothing to wait." },
        { who: "anwar", text: "Come on. Let's take it from the top." },
      ],
    },

    /* --- the letter, on the let-it-go path --------------------------- */
    letter: {
      title: "for you",
      lines: [
        "I know you only wanted to start again, and we will.",
        "But I want you to know what I was doing, standing there.",
        "You have never once asked me to be brave about anything.",
        "You just let me be tired, and be quiet, and be myself,",
        "and somehow that made me want to be worth the trouble.",
        "So when he came for you I didn't have to think about it.",
        "I didn't feel brave. I just felt like there was no version",
        "of this where I stand still.",
      ],
      close: "I would've fought even Death for you, my love.",
      sign: "— Anwar",
    },
  };

  /* =======================================================================
     THE FIGHT

     It is fixed. He wins, because the point of the scene is not whether he
     is good enough — it is that he stood there. But a fight you cannot
     lose is only tense if it never SAYS so, so nothing here announces it:
     the cues come faster each round, a miss costs a beat and a stumble and
     an unhappy noise, and partway through the scythe gets close enough to
     take the light out of the room. What a miss cannot do is end it.

     Windows tighten from a very generous 1.5s to a tight 0.62s. The close
     call lands on round 3 whatever she does, because it is a story beat
     rather than a punishment.
     ======================================================================= */
  var FIGHT = {
    rounds: 6,
    window0: 1.5,          // how long she has on round one
    windowN: 0.62,         // and on the last
    tell: 0.55,            // the cue is up this long before the window opens
    beat: 0.85,            // the pause after a resolved round
    closeAt: 3,            // the near-miss round
  };
  /* Each round asks for one of three things. The keys are the ones the
     platformer already uses, so nothing new has to be learned. */
  var CUES = [
    { id: "block",  label: "BLOCK",  keys: ["jump", "confirm", "down"] },
    { id: "dodge",  label: "DODGE",  keys: ["left", "right"] },
    { id: "strike", label: "STRIKE", keys: ["jump", "confirm", "down"] },
  ];
  function cueFor(i) {
    /* block, dodge, strike, block, dodge, strike — learnable, not random */
    return CUES[i % CUES.length];
  }
  function windowFor(i) {
    var k = FIGHT.rounds > 1 ? i / (FIGHT.rounds - 1) : 1;
    return FIGHT.window0 + (FIGHT.windowN - FIGHT.window0) * k;
  }

  /* =======================================================================
     PIXEL HELPERS — the same primitives the rest of the site draws with,
     kept local so this file stands on its own.
     ======================================================================= */
  function px(c, x, y, w, h, col) {
    c.fillStyle = col;
    c.fillRect(x | 0, y | 0, Math.max(1, w | 0), Math.max(1, h | 0));
  }
  function spriteCanvas(w, h) {
    var c = document.createElement("canvas");
    c.width = w; c.height = h;
    var ctx = c.getContext("2d");
    ctx.imageSmoothingEnabled = false;
    return { c: c, ctx: ctx };
  }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function ease(t) { return t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }

  /* =======================================================================
     THE CAST

     Anwar is twenty-six by thirty-four and Death is forty by fifty-eight,
     against her sixteen by eighteen. That size difference is the point: he
     stands over her, and the thing on the other side of him stands over
     them both.
     ======================================================================= */
  var ANWAR_MAP = [
    ".......KKhhhihihhKK.......",
    "......KhihihhhhihihK......",
    ".....KihhhhihihhhhihK.....",
    ".....KhihihhhhihihhhhK....",
    ".....KhhhhhhhhhhhhhhhK....",
    "....KhhSSSSSSSSSSSSShhK...",
    "....KhhSKKKSSSSSKKKShhK...",
    "....KhhKGKGKSSSKGKGKhhK...",
    "....KhhKGGGKKKKKGGGKhhK...",
    ".....KSSKKKSSSSSKKKSKK....",
    ".....KSSbbKbbbbKbbbK......",
    "......KKSbbKWWKbbSK.......",
    "........KKKSSSSKKK........",
    ".KKKKKKKKKssssssKKKKKKKKK.",
    "KjjJJJJJJjkkkkkkjJJJJJJJJK",
    "KjjJJJJJJjkkkkkkjJJJJJJJJK",
    "KjjJKJJJJjkkkkkkjJJJJKJJJK",
    "KjjJKJJJJjkkkkkkjJJJJKJJJK",
    "KjjJKJJJjJkkkkkkJjJJJKJJJK",
    "KjjJKJJJjJkkkkkkJjJJJKJJJK",
    "KjjJKJJJjJkkkkkkJjJJJKJJJK",
    "KjjJKJJJJJkkkkkkJJJJJKJJJK",
    "KjjJKJJJJJkkkkkkJJJJJKJJJK",
    "KjjJKJJJJJkkkkkkJJJJJKJJJK",
    "KSSSKjjJJJJJJJJJJJJJJKSSSK",
    "KsssKKKTTTTTKKTTTTTKKKsssK",
    ".KKK..KTTTTTKKTTTTTK..KKK.",
    "......KTTTTTKKTTTTTK......",
    "......KTTTTTKKTTTTTK......",
    "......KTTTTTKKTTTTTK......",
    "......KTTTTTKKTTTTTK......",
    "......KOOOOOKKOOOOOK......",
    ".....KOOOOOOKKOOOOOOK.....",
    "....KOOOOOOOKKOOOOOOOK....",
  ];

  var DEATH_MAP = [
    "............................KSSK........",
    "...........................KssssK.......",
    "..........................KsSSsssK......",
    ".........................KssKKKSssK.....",
    ".......KKKKKKKK.........KsSK...KSssK....",
    ".....KKrrccccccKK......KsSK.....KsssK...",
    "...KKrrccccccccccKK...KhsK.......KssK...",
    "..KrrccccccccccccccK..KhhK......KssK....",
    ".KrrcccVVVVVVVVVVcccK.KhhK......KsK.....",
    ".KrrccVVVVVVVVVVVVccK.KhhK.......K......",
    ".KrrccVVgVVVVVgVVVccK.KhhK..............",
    ".KrrccVVVVVVVVVVVVccK.KhhK..............",
    "..KrrcVVVVVVVVVVVVcK..KhhK..............",
    ".KrrcccVVVVVVVVcccccK.KhhK..............",
    "KrrccccccccccccccccccKKhhKK.............",
    "rrrrrrrrcccccccccccrrrrhhrrKKK..........",
    "rrccccccccccccccccccccchhcccccK.........",
    "rrccccccccccccccccccccchhcccccK.........",
    "rrccccccccccccccccccccchhcccccK.........",
    "rrccccccccccccccccccccchhcccKK..........",
    "rrccccccccccccccccccccchhcKK............",
    "rrccccccccccccccccccccGhhGK.............",
    "rrccccccccccccccccccccGhhGK.............",
    "rrccccccccccccccccccccGhhGK.............",
    "rrccccccccccccccccccccchhK..............",
    "rrccccccccccccccccccccchhK..............",
    "rrccccccccccccccccccccchhK..............",
    "KrrcccccccccccccccccccchhK..............",
    "KrrcccccccccccccccccccchhK..............",
    "KrrcccccccccccccccccccchhK..............",
    "KrrcccccccccccccccccccchhK..............",
    "KrrcccccccccccccccccccchhK..............",
    ".KrrccccccccccccccccccGhhGK.............",
    ".KrrccccccccccccccccccGhhGK.............",
    ".KrrccccccccccccccccccGhhGK.............",
    ".KrrccccccccccccccccccchhK..............",
    ".KrrccccccccccccccccccKhhK..............",
    ".KrrccccccccccccccccccKhhK..............",
    ".KrrccccccccccccccccccKhhK..............",
    ".KrrccccccccccccccccccchhK..............",
    ".KrrccccccccccccccccccchhK..............",
    "KrrcccccccccccccccccccKhhK..............",
    "KrrcccccccccccccccccccchhK..............",
    "KrrcccccccccccccccccccchhK..............",
    "KrrcccccccccccccccccccchhK..............",
    "KrrcccccccccccccccccccchhK..............",
    "rrccccccccccccccccccccchhK..............",
    "rrccccccccccccccccccccchhK..............",
    "rrccccccccccccccccccccchhK..............",
    "rrccccccccccccccccccccchhK..............",
    "rrccccccccccccccccccccchhK..............",
    "rrccccccccccccccccccccchhcK.............",
    "rrccccccccccccccccccccchhcK.............",
    "rrccccccccccccccccccccchhccK............",
    "rrccccccccccccccccccccchhcccK...........",
    "rrccccccccccccccccccccchhcccK...........",
    "KrrcKcccccKcccKccccKKKKhhKKK............",
    "KccK.KKKKKKccK.KKKK....KK...............",
  ];

  /* one character per pixel, as in the game
       K ink   h hair   i hair shine   S skin   b stubble
       G lens  W teeth  J jacket  j jacket lit  k tee
       s skin shade  T jeans  O boot
       c cloak  r the cold rim down his lit side
       V the void under the hood   g a glint in it
       s scythe blade   S (in Death) blade shine   h (in Death) the shaft */
  /* Brown leather over a black shirt, dark jeans, dark boots. */
  /* Black leather over a black tee, dark jeans, dark boots — the version
     approved from the sprite sheet. Black on black needs help to read: the
     jacket is a shade lighter and cooler than the tee, the lapels and the
     leading edge catch the warm light, and the ink outline separates both
     from whatever dark he is standing in. */
  var ANWAR_PAL = {
    K: "#100c16",                 // ink
    h: "#241a17", i: "#4a362e",   // dark curls, and their shine
    S: "#e8bb92", s: "#c08e64",   // light-medium skin
    b: "#4a3a30",                 // the beard, short along the jaw
    G: "#cfe0ee", W: "#fff6ea",   // lenses, and a glint of teeth
    J: "#26232e",                 // the leather
    j: "#4e4859",                 // its lapels, and the edge the light finds
    k: "#0f0d13",                 // the tee under it
    T: "#232636",                 // jeans
    O: "#141119",                 // boots
  };

  var DEATH_PAL = {
    K: "#000000", c: "#141018", V: "#000000", g: "#8fd8ff",
    s: "#e8eef6", S: "#ffffff", h: "#3a2f28", G: "#c9c2b8", C: "#241d18",
  };

  function paintMap(map, pal, w) {
    var s = spriteCanvas(w, map.length), c = s.ctx;
    for (var y = 0; y < map.length; y++)
      for (var x = 0; x < w; x++) {
        var ch = map[y].charAt(x);
        if (ch === "." || ch === " ") continue;
        var col = pal[ch];
        if (col) px(c, x, y, 1, 1, col);
      }
    return s.c;
  }

  /* Anwar breathes, and his coat moves when he does */
  function paintAnwar(k) {
    var map = ANWAR_MAP.slice();
    /* he breathes: his fists close on the off frame */
    if (k) map[24] = map[24].replace("KSSS", "K SS").replace("SSSK", "SS K");
    return paintMap(map, ANWAR_PAL, 26);
  }

  /* Death does not breathe. The cloak stirs anyway. */
  function paintDeath(k) {
    var map = DEATH_MAP.slice();
    if (k === 1) {
      /* the hem stirs, one row, one pixel */
      map[map.length - 8] = map[map.length - 8].replace("ccccc", "cccc.");
    }
    return paintMap(map, DEATH_PAL, 40);
  }

  var CAST = null;
  function bakeCast() {
    if (CAST) return;
    CAST = {
      anwar: [paintAnwar(0), paintAnwar(1)],
      death: [paintDeath(0), paintDeath(1)],
    };
  }

  /* Ouissy is borrowed from the game, so there is only ever one of her. */
  function ouissy(pose, k) {
    if (window.SuperOuissy && SuperOuissy.frame) return SuperOuissy.frame(pose || "idle", k || 0);
    return null;
  }

  /* =======================================================================
     THE DIALOGUE BOX

     A taped paper note, the same idea as the one the choice adventure uses,
     so the two story scenes on this site feel like they belong together.
     Text types itself on; a press finishes the line, the next press moves on.
     ======================================================================= */
  /* Each speaker gets a panel in their own colours. Anwar is warm, Death is
     colder and darker than the frame around him, she is rose, and the
     game's own instructions are gold. */
  var SPEAKER = {
    anwar:  { name: "ANWAR",  fill: "#2c1f3c", fill2: "#1b1328",
              edge: "#c8a06a", ink: "#ffeccd", tab: "#c8a06a", tabInk: "#231428" },
    ouissy: { name: "OUISSY", fill: "#3a1c34", fill2: "#241222",
              edge: "#ff9ec4", ink: "#ffe6f0", tab: "#ff9ec4", tabInk: "#3a1030" },
    death:  { name: "",       fill: "#0e0d16", fill2: "#05050b",
              edge: "#5f7fa0", ink: "#cfe0f0", tab: "#5f7fa0", tabInk: "#08080f" },
    sys:    { name: "",       fill: "#2e2416", fill2: "#1a1410",
              edge: "#ffd166", ink: "#ffeeb8", tab: "#ffd166", tabInk: "#2a1f0c" },
  };

  /* The dialogue and the choice are DOM, not canvas. Six-pixel text drawn
     on a 320-wide canvas and then blown up five times is unreadable however
     good the panel round it is — which is exactly what the first version
     was. These sit over the stage, scale in cqw with everything else, and
     carry a real button she can tap. */
  function $d(id) { return document.getElementById(id); }

  /* Only ever WRITE a class when it changes. Reassigning className every
     frame rewrites the attribute, which restarts the CSS entry animation,
     which pins the panel at the first frame of its fade — opacity zero,
     laid out correctly, and invisible. */
  function setClass(el, cls) {
    if (el && el.className !== cls) el.className = cls;
  }

  function showLine(who, text, shown, waiting) {
    var sp = SPEAKER[who] || SPEAKER.anwar;
    var box = $d("so-dlg"), nm = $d("so-dlg-name"), tx = $d("so-dlg-text"), nx = $d("so-dlg-next");
    if (!box) return;
    setClass(box, "so-dlg on so-dlg-" + (SPEAKER[who] ? who : "anwar"));
    box.setAttribute("aria-hidden", "false");
    if (nm.textContent !== sp.name) nm.textContent = sp.name;
    var cut = String(text).slice(0, shown);
    if (tx.textContent !== cut) tx.textContent = cut;
    nx.classList.toggle("on", !!waiting);
  }

  function hideLine() {
    var box = $d("so-dlg");
    if (!box) return;
    setClass(box, "so-dlg");
    box.setAttribute("aria-hidden", "true");
    $d("so-dlg-next").classList.remove("on");
  }

  function showChoice(opts, sel, prompt) {
    var box = $d("so-choice");
    if (!box) return;
    setClass(box, "so-choice on");
    box.setAttribute("aria-hidden", "false");
    $d("so-choice-prompt").textContent = prompt;
    for (var i = 0; i < 2; i++) {
      var b = $d("so-choice-" + i);
      if (b.textContent !== opts[i]) b.textContent = opts[i];
      b.classList.toggle("sel", i === sel);
    }
  }

  function hideChoice() {
    var box = $d("so-choice");
    if (!box) return;
    setClass(box, "so-choice");
    box.setAttribute("aria-hidden", "true");
  }

  /* the arrow, and the two options, are really tappable */
  var wired = false;
  /* ---- the cue, and the letter ---- */
  function showCue(label, k) {
    var box = $d("so-cue"), word = $d("so-cue-word"), fill = $d("so-cue-fill");
    if (!box) return;
    box.hidden = false;
    setClass(box, "so-cue so-cue-" + (S.cueResult || "live"));
    if (word && word.textContent !== label) word.textContent = label;
    if (fill) fill.style.width = Math.max(0, Math.min(1, k)) * 100 + "%";
  }
  function hideCue() { var b = $d("so-cue"); if (b) b.hidden = true; }

  function letterChars() {
    var L = SCRIPT.letter;
    return L.lines.join(" ").length + L.close.length;
  }
  function showLetter() {
    var box = $d("so-letter");
    if (!box) return;
    box.hidden = false;
    hideLine();                                  // the letter speaks for itself
    var t = $d("so-letter-title"); if (t) t.textContent = SCRIPT.letter.title;
    var sg = $d("so-letter-sign"); if (sg) sg.textContent = SCRIPT.letter.sign;
    var ok = $d("so-letter-ok"); if (ok) ok.hidden = true;
  }
  function hideLetter() { var b = $d("so-letter"); if (b) b.hidden = true; }
  /* It writes itself out rather than appearing: she should read it at the
     pace it was meant to be said. */
  function paintLetter(shown) {
    var L = SCRIPT.letter, body = $d("so-letter-body"), close = $d("so-letter-close");
    var whole = L.lines.join(" ");
    var n = Math.floor(shown);
    if (body) {
      var want = whole.slice(0, n);
      if (body.textContent !== want) body.textContent = want;
    }
    if (close) {
      var want2 = n > whole.length ? L.close.slice(0, n - whole.length) : "";
      if (close.textContent !== want2) close.textContent = want2;
    }
    var ok = $d("so-letter-ok");
    if (ok) ok.hidden = n < letterChars();
  }

  function wireDom() {
    var lok = $d("so-letter-ok");
    if (lok && !lok.dataset.wired) {
      lok.dataset.wired = "1";
      lok.addEventListener("click", function () { press("confirm"); });
    }
    var cue = $d("so-cue");
    if (cue && !cue.dataset.wired) {
      cue.dataset.wired = "1";
      /* the cue itself is the button on a phone — pointerdown, not click,
         because a window this tight cannot wait for the click to settle */
      cue.addEventListener("pointerdown", function (e) { e.preventDefault(); press("confirm"); });
    }
    if (wired) return;
    wired = true;
    var nx = $d("so-dlg-next");
    if (nx) nx.addEventListener("click", function (e) {
      e.preventDefault(); e.stopPropagation();
      press("confirm");
      nx.blur();
    });
    for (var i = 0; i < 2; i++) {
      (function (idx) {
        var b = $d("so-choice-" + idx);
        if (!b) return;
        b.addEventListener("click", function (e) {
          e.preventDefault(); e.stopPropagation();
          if (S) { S.sel = idx; press("confirm"); }
          b.blur();
        });
      })(i);
    }
  }

  /* =======================================================================
     THE SCENE RUNNER

     One state object. `phase` is where in the scene we are, `pt` is how
     long we have been in it. Scenes advance by their own rules; the only
     thing Super Ouissy knows is step / paint / done.
     ======================================================================= */
  /* Sound, through the same Web Audio context the game already owns, so
     nothing here adds a file either. */
  function sfx(kind) {
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      var ac = window.__soAudio || (window.__soAudio = new AC());
      if (ac.state === "suspended") ac.resume();
      var spec = ({
        chill:  { type: "sine",     f: 240,  to: 55,   d: 2.2, v: .06 },
        thump:  { type: "sine",     f: 90,   to: 34,   d: .40, v: .09 },
        thumpBig:{type: "sine",    f: 70,   to: 26,   d: .75, v: .12 },
        swing:  { type: "sawtooth", f: 900,  to: 180,  d: .22, v: .07 },
        catch:  { type: "square",   f: 1400, to: 260,  d: .30, v: .08 },
        pick:   { type: "square",   f: 520,  to: 700,  d: .07, v: .04 },
        choose: { type: "triangle", f: 620,  to: 1240, d: .26, v: .07 },
        hit:    { type: "square",   f: 320,  to: 90,   d: .18, v: .07 },
        block:  { type: "square",   f: 700,  to: 300,  d: .14, v: .06 },
      })[kind];
      if (!spec) return;
      var t = ac.currentTime, o = ac.createOscillator(), g = ac.createGain();
      o.type = spec.type;
      o.frequency.setValueAtTime(spec.f, t);
      o.frequency.exponentialRampToValueAtTime(Math.max(20, spec.to), t + spec.d);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(spec.v, t + .012);
      g.gain.exponentialRampToValueAtTime(0.0001, t + spec.d);
      o.connect(g); g.connect(ac.destination);
      o.start(t); o.stop(t + spec.d + .02);
    } catch (e) {}
  }

  var S = null;
  var TYPE_RATE = 42;             // characters a second

  function begin(kind, opts) {
    bakeCast();
    wireDom();
    hideLine(); hideChoice();
    opts = opts || {};
    S = {
      kind: kind, t: 0, phase: 0, pt: 0,
      lines: null, li: 0, shown: 0, waiting: false,
      done: false, outcome: null,
      dim: 0, chill: 0, shake: 0,
      her: { x: opts.herX === undefined ? 120 : opts.herX, y: opts.herY === undefined ? 120 : opts.herY,
             pose: "hurt", flinch: 0 },
      anwar: { x: VW + 30, y: 0, k: 0 },
      death: { x: VW + 60, y: 0, k: 0, arrive: 0 },
      round: 0, cue: null, cueT: 0, hits: 0, closeCalled: false, leaving: 0,
      swing: undefined, flash: 0, boxIn: 0, chillSfx: false, swungSfx: false, caughtSfx: false,
      thump: 0, landed: false,
      sel: 0, particles: [],
    };
    if (kind === "rescue") {
      var alts = SCRIPT.rescueAlt;
      say(alts[(Math.random() * alts.length) | 0]);
    }
    return S;
  }

  function say(lines) { S.lines = lines; S.li = 0; S.shown = 0; S.waiting = false; S.boxIn = 0; }
  function line() { return S.lines && S.lines[S.li]; }

  function stepText(dt) {
    var ln = line();
    if (!ln) return "done";
    /* the panel slides open before the words start */
    S.boxIn = Math.min(1, (S.boxIn || 0) + dt * 6);
    if (S.boxIn < 0.85) return null;
    var full = ln.text.length;
    if (S.shown < full) {
      S.shown = Math.min(full, S.shown + TYPE_RATE * dt);
      if (S.shown >= full) S.waiting = true;
    }
    return null;
  }

  /* a press either finishes the line or moves to the next one */
  function pressText() {
    var ln = line();
    if (!ln) return false;
    if (S.boxIn < 0.85) { S.boxIn = 1; return true; }
    if (S.shown < ln.text.length) { S.shown = ln.text.length; S.waiting = true; return true; }
    S.li++; S.shown = 0; S.waiting = false;
    return S.li < S.lines.length;
  }
  function textFinished() { return S.lines && S.li >= S.lines.length; }

  function phase(n) { S.phase = n; S.pt = 0; }

  /* =======================================================================
     SCENE 1 — SHE DIES ON HARD WITH LIVES LEFT

     Two and a bit seconds. He walks in, picks her up, says one thing, and
     the game carries on. It must never outstay its welcome: she is going to
     see it a lot, so it is short, it is skippable, and the line is
     different each time.
     ======================================================================= */
  function stepRescue(dt) {
    S.pt += dt;
    if (S.phase === 0) {                        // the world dims
      S.dim = Math.min(1, S.pt / 0.35);
      if (S.pt > 0.35) phase(1);
    } else if (S.phase === 1) {                 // he crosses to her
      var k = ease(clamp(S.pt / 0.75, 0, 1));
      S.anwar.x = VW + 30 + (S.her.x + 16 - (VW + 30)) * k;
      S.anwar.k = (S.pt * 7 | 0) % 2;
      if (S.pt > 0.75) { S.anwar.x = S.her.x + 16; phase(2); }
    } else if (S.phase === 2) {                 // he says his one line
      stepText(dt);
      S.her.y -= dt * 8;                        // he has her up off the ground
      /* It holds. She gets four seconds to read one short line, or she taps
         the arrow and moves on — a line that vanished a second and a half
         after appearing was gone before it had been read. */
      if (S.pt > 4.2) phase(3);
    } else if (S.phase === 3) {                 // and out
      S.dim = Math.max(0, 1 - S.pt / 0.4);
      if (S.pt > 0.4) S.done = true;
    }
  }

  function paintRescue(c, t) {
    /* the game is still behind this; we only add to it */
    if (S.dim > 0) {
      /* light, not paint: the spotlight below does most of the darkening,
         so this only takes the edge off the world behind it */
      c.save(); c.globalAlpha = 0.34 * S.dim;
      px(c, 0, 0, VW, VH, "#100a18"); c.restore();
    }
    var a = CAST.anwar[S.anwar.k];
    var her = ouissy(S.phase >= 2 ? "hurt" : "hurt", 0);

    /* she is in his arms from phase 2 on */
    if (her) {
      var hx = S.phase >= 2 ? S.anwar.x - 14 : S.her.x;
      var hy = S.phase >= 2 ? S.her.y - 6 : S.her.y;
      c.save();
      if (S.phase >= 2) { c.translate(hx + 8, hy + 9); c.rotate(-0.25); c.translate(-8, -9); c.drawImage(her, 0, 0); }
      else c.drawImage(her, Math.round(hx), Math.round(hy));
      c.restore();
    }
    c.drawImage(a, Math.round(S.anwar.x), Math.round(S.her.y + 18 - a.height));

    /* THE SPOTLIGHT.
       Not a pale disc laid over the scene — that read as a smudge. It is a
       light: a shaft coming down from above, a bright pool where it lands,
       and the rest of the frame pushed down into the dark around it. */
    spotlight(c, S.anwar.x + 2, S.her.y + 16, 1, t);

    if (S.phase === 2) {
      var ln = line();
      if (ln) showLine(ln.who, ln.text, Math.floor(S.shown), S.waiting);
    } else hideLine();
  }

  /* A dramatic spotlight, in three parts: the shaft coming down, the pool
     it makes on the floor, and a vignette darkening everything it is not
     falling on. The falloff is deliberately steep — a gentle one is what
     makes a spotlight look like a flat grey circle. */
  function spotlight(c, cx, cy, power, t) {
    var flicker = 0.94 + 0.06 * Math.sin(t * 7.3) * Math.sin(t * 2.1);
    var p = power * flicker;

    c.save();
    c.globalCompositeOperation = "multiply";
    var vig = c.createRadialGradient(cx, cy - 10, 8, cx, cy - 6, 74);
    vig.addColorStop(0, "rgba(255,255,255,1)");
    vig.addColorStop(0.42, "rgba(210,205,225,1)");
    vig.addColorStop(1, "rgba(108,102,136,1)");
    c.globalAlpha = 0.78 * p;
    c.fillStyle = vig;
    c.fillRect(0, 0, VW, VH);
    c.restore();

    c.save();
    c.globalCompositeOperation = "lighter";
    var beam = c.createLinearGradient(0, cy - 90, 0, cy + 6);
    beam.addColorStop(0, "rgba(255,236,196,0)");
    beam.addColorStop(0.45, "rgba(255,230,186,0.10)");
    beam.addColorStop(1, "rgba(255,224,170,0.22)");
    c.globalAlpha = p;
    c.fillStyle = beam;
    c.beginPath();
    c.moveTo(cx - 9, cy - 90);
    c.lineTo(cx + 9, cy - 90);
    c.lineTo(cx + 34, cy + 6);
    c.lineTo(cx - 34, cy + 6);
    c.closePath();
    c.fill();

    var pool = c.createRadialGradient(cx, cy - 6, 2, cx, cy - 4, 40);
    pool.addColorStop(0, "rgba(255,240,206,0.34)");
    pool.addColorStop(0.34, "rgba(255,224,170,0.24)");
    pool.addColorStop(0.72, "rgba(255,210,150,0.07)");
    pool.addColorStop(1, "rgba(255,210,150,0)");
    c.globalAlpha = p;
    c.fillStyle = pool;
    c.fillRect(cx - 46, cy - 50, 92, 60);

    var floor = c.createRadialGradient(cx, cy + 2, 1, cx, cy + 2, 30);
    floor.addColorStop(0, "rgba(255,244,214,0.26)");
    floor.addColorStop(1, "rgba(255,226,170,0)");
    c.fillStyle = floor;
    c.beginPath();
    c.ellipse(cx, cy + 2, 30, 7, 0, 0, 6.283);
    c.fill();
    c.restore();

    /* dust turning over in the beam */
    for (var i = 0; i < 12; i++) {
      var dx = cx + Math.sin(t * 0.5 + i * 2.1) * (7 + (i % 4) * 6);
      var dy = cy - 4 - ((t * (6 + i % 5) + i * 9) % 74);
      c.save();
      c.globalAlpha = 0.36 * p * (1 - (cy - dy) / 80);
      px(c, dx, dy, 1, 1, "#fff0c8");
      c.restore();
    }
  }

  /* =======================================================================
     SCENE 2 — THE LAST BOSS TAKES HER LAST LIFE

     The long one. It goes:

       arrive   he comes, as he always does
       chill    and then the temperature drops. The colour goes out of the
                world, frost takes the edges of the screen, and she backs
                away — this beat exists purely so the next one lands
       enter    Death crosses in, slowly, taking up a third of the screen
       meet     the conversation
       swing    the scythe comes down and does not land
       caught   what he says with it stopped in his hand
       choice   and then it is hers to decide
     ======================================================================= */

  var FROST = null;
  function frostMask() {
    if (FROST) return FROST;
    var s = spriteCanvas(VW, VH), c = s.ctx;
    /* Crystals crowding in from the edges and leaving the middle alone —
       it is a frame round the scene, not a curtain over it. The falloff is
       steep on purpose: at a gentler one it covered the people talking. */
    for (var i = 0; i < 1500; i++) {
      var x = Math.random() * VW, y = Math.random() * VH;
      var ex = Math.min(x, VW - x) / (VW / 2);
      var ey = Math.min(y, VH - y) / (VH / 2);
      var edge = 1 - Math.min(ex, ey);
      if (edge < 0.42) continue;
      if (Math.random() > Math.pow(edge, 3) * 1.5) continue;
      var tone = Math.random();
      px(c, x, y, 1, 1, tone > .82 ? "#ffffff" : tone > .5 ? "#d8ecff" : "#a8cbe8");
      if (Math.random() > .74) {                    // a little spur off it
        px(c, x + 1, y, 1, 1, "#c8e2f8");
        px(c, x, y + 1, 1, 1, "#c8e2f8");
      }
    }
    FROST = s.c;
    return FROST;
  }

  function stepDeathScene(dt) {
    S.pt += dt;
    var D = SCRIPT.death;

    if (S.phase === 0) {                          /* he arrives */
      S.dim = Math.min(1, S.pt / 0.4);
      var k = ease(clamp(S.pt / 0.9, 0, 1));
      S.anwar.x = VW + 30 + (S.her.x + 20 - (VW + 30)) * k;
      S.anwar.k = (S.pt * 7 | 0) % 2;
      if (S.pt > 1.0 && !S.lines) say(D.arrive);
      if (S.lines) { stepText(dt); if (textFinished()) phase(1); }

    } else if (S.phase === 1) {                   /* the temperature drops */
      S.chill = Math.min(1, S.pt / 2.0);
      S.dim = Math.min(1, 1 + S.pt * 0.35);
      S.her.flinch = Math.min(12, S.pt * 8);      // she backs away from it
      /* three thumps as something very large gets closer, each one shaking
         the frame harder than the last */
      var thumps = [0.45, 1.35, 2.25];
      for (var i = 0; i < thumps.length; i++)
        if (S.pt >= thumps[i] && S.thump <= i) {
          S.thump = i + 1;
          S.shake = 3 + i * 3;
          sfx(i === 2 ? "thumpBig" : "thump");
        }
      if (S.pt > 0.3 && !S.chillSfx) { S.chillSfx = true; sfx("chill"); }
      if (S.pt > 3.0) { S.lines = null; phase(2); }

    } else if (S.phase === 2) {                   /* and it walks in */
      /* he does not slide on: he comes out of the dark. The fade runs
         ahead of the walk so he is half there before he is anywhere. */
      var k2 = ease(clamp(S.pt / 3.0, 0, 1));
      S.death.x = VW + 26 + (VW - 96 - (VW + 26)) * k2;
      S.death.k = (S.pt * 2 | 0) % 2;
      S.death.arrive = clamp(S.pt / 1.6, 0, 1);
      if (S.pt > 3.0 && !S.landed) {
        S.landed = true; S.shake = 10; sfx("thumpBig");
      }
      if (S.pt > 3.4) { say(D.meet); phase(3); }

    } else if (S.phase === 3) {                   /* the conversation */
      stepText(dt);
      S.death.k = (S.t * 1.4 | 0) % 2;
      if (textFinished()) { S.lines = null; phase(4); }

    } else if (S.phase === 4) {                   /* the scythe comes down */
      if (S.pt < 0.45) {
        S.swing = ease(S.pt / 0.45);              // he raises it
      } else if (S.pt < 0.62) {
        S.swing = 1 - (S.pt - 0.45) / 0.17 * 1.8; // and brings it through
        if (!S.swungSfx) { S.swungSfx = true; sfx("swing"); }
      } else {
        if (!S.caughtSfx) {
          S.caughtSfx = true; S.shake = 9; S.flash = 1;
          sfx("catch");
        }
        S.swing = -0.8;                            // stopped, mid-air
        S.flash = Math.max(0, S.flash - dt * 3);
        if (S.pt > 1.1) { say(D.caught); phase(5); }
      }

    } else if (S.phase === 5) {                   /* what he says about it */
      stepText(dt);
      if (textFinished()) { S.lines = null; S.sel = 0; phase(6); }

    } else if (S.phase === 6) {                   /* her decision */
      /* nothing moves; it waits for her */

    /* ---------------- the fight ---------------- */
    } else if (S.phase === 7) {                   /* he explains it first */
      stepText(dt);
      if (textFinished()) { S.lines = null; S.round = 0; S.hits = 0; phase(8); }

    } else if (S.phase === 8) {                   /* the tell, before each cue */
      S.anwar.k = 1;
      if (S.pt > FIGHT.tell) {
        S.cue = cueFor(S.round);
        S.cueT = 0;
        S.cueWindow = windowFor(S.round);
        S.cueResult = null;
        sfx("swing");
        phase(9);
      }

    } else if (S.phase === 9) {                   /* the window itself */
      S.cueT += dt;
      showCue(S.cue.label, 1 - S.cueT / S.cueWindow);
      if (S.cueT > S.cueWindow) { resolveCue(false); }

    } else if (S.phase === 10) {                  /* the beat after a round */
      showCue(S.cue ? S.cue.label : "", 0);       // it holds, showing the verdict
      S.flash = Math.max(0, S.flash - dt * 3);
      if (S.pt > FIGHT.beat) {
        S.round++;
        S.cue = null; hideCue();
        if (S.round >= FIGHT.rounds) { say(D.win); phase(12); }
        else phase(8);
      }

    } else if (S.phase === 11) {                  /* what they say about it */
      S.flash = Math.max(0, S.flash - dt * 2);
      stepText(dt);
      if (textFinished()) {
        S.lines = null;
        if (!S.closeAfterSaid) { S.closeAfterSaid = true; say(SCRIPT.death.closeCallAfter); return; }
        S.cue = null; S.round++; phase(8);
      }

    } else if (S.phase === 12) {                  /* he wins */
      stepText(dt);
      if (textFinished()) { S.lines = null; phase(13); }

    } else if (S.phase === 13) {                  /* the cold lets go */
      S.chill = Math.max(0, S.chill - dt * 0.7);
      S.dim = Math.max(0, S.dim - dt * 0.7);
      /* leaving, not death.k — that is a sprite frame index, and winding it
         down as if it were an opacity walks straight off the end of CAST. */
      S.leaving = Math.min(1, S.leaving + dt * 0.7);
      if (S.pt > 1.6) S.done = true;

    /* ---------------- letting it go ---------------- */
    } else if (S.phase === 20) {                  /* what they say instead */
      stepText(dt);
      if (textFinished()) { S.lines = null; phase(21); }

    } else if (S.phase === 21) {                  /* the cold lifts, then the letter */
      S.chill = Math.max(0, S.chill - dt * 0.8);
      S.dim = Math.max(0, S.dim - dt * 0.8);
      S.leaving = Math.min(1, S.leaving + dt * 0.8);
      if (S.pt > 1.4) { S.letterShown = 0; showLetter(); phase(22); }

    } else if (S.phase === 22) {                  /* the letter, writing itself */
      S.letterShown = Math.min(letterChars(), S.letterShown + dt * 58);
      paintLetter(S.letterShown);
    }
  }

  /* she answered — or she did not */
  function answerCue(name) {
    if (S.phase !== 9 || !S.cue || S.cueResult) return;
    var right = S.cue.keys.indexOf(name) >= 0;
    resolveCue(right);
  }

  function resolveCue(hit) {
    S.cueResult = hit ? "hit" : "miss";

    /* The close call is a story beat, not a punishment, so it lands on its
       round whatever she did — including answering instantly, which is how
       it used to be skipped entirely: it was gated on the window running
       most of the way down, and a quick player never got there. */
    if (S.round === FIGHT.closeAt - 1 && !S.closeCalled) {
      S.closeCalled = true;
      S.shake = 12; S.flash = 1; S.dim = Math.min(1, S.dim + 0.25);
      hideCue();
      sfx("catch");
      say(SCRIPT.death.closeCall);
      phase(11);
      return;
    }

    if (hit) {
      S.hits++;
      S.flash = 0.6; S.shake = 5;
      sfx(S.cue.id === "strike" ? "hit" : "block");
    } else {
      /* A miss costs a beat and a stumble and an ugly noise. It does not
         cost the fight — but nothing on screen says so. */
      S.shake = 7;
      S.anwar.stumble = 0.5;
      sfx("thump");
    }
    phase(10);
  }

  function paintDeathScene(c, t) {
    var D = SCRIPT.death;

    /* the world goes out */
    if (S.dim > 0) {
      c.save(); c.globalAlpha = Math.min(0.92, 0.62 * S.dim);
      px(c, 0, 0, VW, VH, "#07050c"); c.restore();
    }
    /* THE COLD.
       Five things arriving together, which is what makes it read as a
       change in the weather rather than as a filter: the colour drains to
       blue, fog rolls across the floor, ice falls, frost takes the edges,
       and a cold vignette closes in from the corners. */
    if (S.chill > 0) {
      var ch = S.chill;
      c.save();

      /* 1. the colour goes */
      c.globalAlpha = 0.34 * ch;
      px(c, 0, 0, VW, VH, "#1b3358");

      /* 2. fog, rolling across the floor. Drawn as soft puffs rather than
         as bands — a rectangle of flat grey reads as a UI panel lying on
         the floor, which is exactly what the first attempt looked like. */
      for (var f = 0; f < 7; f++) {
        var fy = 100 + (f % 4) * 15;
        var fw = 70 + (f % 3) * 34;
        var fx = ((t * (6 + f * 3) + f * 74) % (VW + fw * 2)) - fw;
        var g2 = c.createRadialGradient(fx, fy, 0, fx, fy, fw);
        var al = (0.20 - (f % 4) * 0.03) * ch;
        g2.addColorStop(0, "rgba(196,220,244," + al.toFixed(3) + ")");
        g2.addColorStop(0.55, "rgba(168,200,232," + (al * 0.55).toFixed(3) + ")");
        g2.addColorStop(1, "rgba(168,200,232,0)");
        c.globalAlpha = 1;
        c.fillStyle = g2;
        c.beginPath();
        c.ellipse(fx, fy, fw, 9 + (f % 3) * 3, 0, 0, 6.283);
        c.fill();
      }

      /* 3. ice, falling and drifting */
      for (var i = 0; i < 46; i++) {
        var ix = (i * 29 + Math.sin(t * 0.6 + i * 1.7) * 14 + VW) % VW;
        var iy = (i * 17 + t * (11 + (i % 5) * 4)) % VH;
        c.globalAlpha = (0.35 + 0.4 * ((i % 3) / 2)) * ch;
        var sz = i % 7 === 0 ? 2 : 1;
        px(c, ix, iy, sz, sz, i % 4 ? "#dff0ff" : "#ffffff");
      }

      /* 4. frost creeping in from the edges */
      c.globalAlpha = 0.72 * ch;
      c.drawImage(frostMask(), 0, 0);

      /* 5. and the corners closing in */
      c.globalAlpha = 0.85 * ch;
      var vig = c.createRadialGradient(VW / 2, VH / 2, VH * 0.18,
                                       VW / 2, VH / 2, VH * 0.78);
      vig.addColorStop(0, "rgba(10,20,40,0)");
      vig.addColorStop(0.62, "rgba(8,16,34,0.42)");
      vig.addColorStop(1, "rgba(4,8,20,0.92)");
      c.fillStyle = vig;
      c.fillRect(0, 0, VW, VH);
      c.restore();
    }

    var groundY = S.her.y + 18;

    /* Death, drawn before them so they read as standing against him */
    if (S.phase >= 2 && S.leaving < 1) {
      var d = CAST.death[S.death.k] || CAST.death[CAST.death.length - 1];
      var dy = groundY - d.height + 4;
      c.save();
      if (S.leaving > 0) c.globalAlpha *= 1 - S.leaving;   // he goes, he does not vanish
      if (S.swing !== undefined && S.phase >= 4) {
        /* He LEANS into the strike; he does not topple. Pivot at the
           shoulder and keep the angle small — swung from the feet he read
           as a falling tree rather than a man bringing something down. */
        var pvx = S.death.x + 14, pvy = dy + 22;
        c.translate(pvx, pvy);
        c.rotate(-0.18 * (S.swing || 0));
        c.translate(-pvx, -pvy);
      }
      c.drawImage(d, Math.round(S.death.x), Math.round(dy));
      c.restore();

      var dcx = S.death.x + 12, dcy = dy + 30, ar = S.death.arrive;

      /* THE AURA. Not a light: a hole. A dark pulse that takes the colour
         out of everything behind him, so he reads as something the scene
         is being drained into rather than something standing in it. */
      var pulse = 0.5 + 0.5 * Math.sin(t * 1.9);
      c.save();
      c.globalCompositeOperation = "multiply";
      var dark = c.createRadialGradient(dcx, dcy, 4, dcx, dcy, 44 + pulse * 8);
      dark.addColorStop(0, "rgba(30,20,50,1)");
      dark.addColorStop(0.5, "rgba(70,60,100,1)");
      dark.addColorStop(1, "rgba(255,255,255,1)");
      c.globalAlpha = 0.55 * ar;
      c.fillStyle = dark;
      c.fillRect(dcx - 60, dcy - 60, 120, 120);
      c.restore();

      /* and a cold ring just off him, so the hole has an edge */
      c.save();
      c.globalAlpha = (0.13 + 0.07 * pulse) * ar;
      var ring = c.createRadialGradient(dcx, dcy, 12, dcx, dcy, 40);
      ring.addColorStop(0, "rgba(80,190,230,0)");
      ring.addColorStop(0.78, "rgba(80,190,230,0.55)");
      ring.addColorStop(1, "rgba(80,190,230,0)");
      c.fillStyle = ring;
      c.fillRect(dcx - 44, dcy - 44, 88, 88);
      c.restore();

      /* wisps coming off him and going up */
      for (var w = 0; w < 14; w++) {
        var wph = w * 1.7;
        var wt = (t * 0.42 + w / 14) % 1;
        var wx = dcx + Math.sin(wph + t * 0.8) * (5 + (w % 5) * 3) + ((w % 3) - 1) * 7;
        var wy = dy + 46 - wt * 52;
        c.save();
        c.globalAlpha = (1 - wt) * 0.55 * ar;
        px(c, wx, wy, wt > 0.6 ? 1 : 2, wt > 0.6 ? 1 : 2,
           w % 3 === 0 ? "#8fd8ff" : "#3a3352");
        c.restore();
      }

      /* HIS EYES. They are the only warm thing about him and they are not
         warm: two cold points that flare and gutter like something with a
         draught behind it. */
      var ex = S.death.x + 8, ey = dy + 10;
      var flick = 0.55 + 0.45 * Math.sin(t * 11 + Math.sin(t * 3.7) * 2.4);
      for (var e = 0; e < 2; e++) {
        var epx = ex + e * 6;
        c.save();
        c.globalAlpha = (0.30 + 0.5 * flick) * ar;
        var eg = c.createRadialGradient(epx + 1, ey + 1, 0, epx + 1, ey + 1, 7);
        eg.addColorStop(0, "rgba(190,240,255,0.95)");
        eg.addColorStop(0.4, "rgba(110,210,255,0.55)");
        eg.addColorStop(1, "rgba(110,210,255,0)");
        c.fillStyle = eg;
        c.fillRect(epx - 6, ey - 6, 15, 15);
        c.restore();
        px(c, epx, ey, 2, 2, flick > 0.5 ? "#eaf9ff" : "#8fd8ff");
      }

      /* a shadow, so something that big is standing on the floor rather
         than hanging in front of it */
      c.save();
      c.globalAlpha = 0.55 * ar;
      c.fillStyle = "#05040a";
      c.beginPath();
      c.ellipse(dcx, groundY + 2, 24, 4.5, 0, 0, 6.283);
      c.fill();
      c.restore();
    }

    /* her, backing away */
    var her = ouissy(S.phase >= 1 ? "hurt" : "hurt", 0);
    if (her) c.drawImage(her, Math.round(S.her.x - S.her.flinch), Math.round(S.her.y));

    /* him, between the two of them, with a warm light of his own — the
       whole point of it is that it is the opposite colour to Death's */
    var a = CAST.anwar[S.anwar.k];
    var ax = Math.round(S.anwar.x), ay = Math.round(groundY - a.height);
    if (S.phase >= 1) {
      var warm = 0.5 + 0.5 * Math.sin(t * 1.5);
      c.save();
      c.globalAlpha = 0.20 + 0.09 * warm;
      var wg = c.createRadialGradient(ax + 11, ay + 16, 3, ax + 11, ay + 16, 30);
      wg.addColorStop(0, "rgba(255,214,150,0.85)");
      wg.addColorStop(0.55, "rgba(255,176,110,0.30)");
      wg.addColorStop(1, "rgba(255,176,110,0)");
      c.fillStyle = wg;
      c.fillRect(ax - 20, ay - 14, 62, 62);
      c.restore();
    }
    c.drawImage(a, ax, ay);

    /* THE CATCH. The blade stops in his hand, and everything about the
       frame says so: a white flash, sparks off the contact, and a hard
       line where the edge came to rest. */
    if (S.phase >= 4 && S.caughtSfx && S.phase < 6) {
      var cx = S.anwar.x + 22, cy = groundY - 30;
      for (var i = 0; i < 9; i++) {
        var ang = -0.9 + i * 0.22, len = 5 + (i % 3) * 5;
        px(c, cx + Math.cos(ang) * len, cy + Math.sin(ang) * len, 2, 2,
           i % 2 ? "#ffffff" : "#8fd8ff");
      }
      px(c, cx - 1, cy - 8, 3, 16, "rgba(255,255,255,.55)");
      /* his arm, up and holding it there */
      px(c, S.anwar.x + 14, cy + 2, 9, 3, ANWAR_PAL.S);
      px(c, S.anwar.x + 14, cy + 2, 9, 1, "#f4d0aa");
    }
    if (S.flash > 0) {
      c.save(); c.globalAlpha = S.flash * 0.85;
      px(c, 0, 0, VW, VH, "#ffffff"); c.restore();
    }

    if (S.phase === 6) {
      hideLine();
      showChoice([D.choice.fight, D.choice.letgo], S.sel, D.choice.prompt);
    } else {
      hideChoice();
      var ln = line();
      /* The else was missing here, though the rescue scene has always had
         it: a finished line left its panel on screen for the rest of the
         act, so the fight's cue came up over the top of whatever Anwar had
         last said. */
      if (ln) showLine(ln.who, ln.text, Math.floor(S.shown), S.waiting);
      else hideLine();
    }
  }

  /* =======================================================================
     WHAT SUPER OUISSY CALLS
     ======================================================================= */
  function step(dt) {
    if (!S || S.done) return;
    S.t += dt;
    if (S.shake > 0) S.shake = Math.max(0, S.shake - dt * 20);
    if (S.kind === "rescue") stepRescue(dt);
    else if (S.kind === "death") stepDeathScene(dt);
  }

  function paint(c, t) {
    if (!S) return;
    c.save();
    if (S.shake > 0) c.translate((Math.random() - .5) * S.shake, (Math.random() - .5) * S.shake);
    if (S.kind === "rescue") paintRescue(c, t);
    else if (S.kind === "death") paintDeathScene(c, t);
    c.restore();
  }

  /* Super Ouissy passes its own key names through; a story scene only cares
     about "get on with it" and "which one". */
  function press(name) {
    if (!S || S.done) return;
    var confirm = name === "jump" || name === "confirm" || name === "down";

    if (S.kind === "rescue") {
      if (S.phase !== 2) return;
      /* first press finishes the line, second one moves on */
      var ln = line();
      if (ln && S.shown < ln.text.length) { S.shown = ln.text.length; S.waiting = true; }
      else phase(3);
      return;
    }

    if (S.kind === "death") {
      if (S.phase === 6) {                       // the choice
        if (name === "left" || name === "right") {
          S.sel = S.sel ? 0 : 1;
          sfx("pick");
        } else if (confirm) {
          S.outcome = S.sel === 0 ? "fight" : "letgo";
          sfx("choose");
          hideChoice();
          /* SCRIPT.death, not D: D is a local in the step function and does
             not exist here. */
          if (S.outcome === "fight") { say(SCRIPT.death.tutorial); phase(7); }
          else { say(SCRIPT.death.letgo); phase(20); }
        }
        return;
      }

      /* the fight: one press, and only inside the window */
      if (S.phase === 9) { answerCue(name); return; }
      /* the letter closes on any press once it has finished writing itself */
      if (S.phase === 22) { if (S.letterShown >= letterChars()) S.done = true; else S.letterShown = letterChars(); return; }

      if (S.lines && confirm) { pressText(); }
      return;
    }
  }

  function done() {
    var d = !S || S.done;
    if (d) { hideLine(); hideChoice(); hideCue(); hideLetter(); }
    return d;
  }
  function outcome() { return S ? S.outcome : null; }
  function active() { return !!S && !S.done; }

  return {
    begin: begin, step: step, paint: paint, press: press,
    done: done, outcome: outcome, active: active,
    /* for the offline harness */
    _state: function () { return S; },
    _cast: function () { bakeCast(); return CAST; },
    _script: SCRIPT,
  };
})();
