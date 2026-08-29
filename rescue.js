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

     Anwar is twenty by twenty-six and Death is thirty-four by forty-six,
     against her sixteen by eighteen. That size difference is the point: he
     stands over her, and the thing on the other side of him stands over
     them both.
     ======================================================================= */
  var ANWAR_MAP = [
    "......KKKKKKKK......",
    "....KKhihhhihhiKK...",
    "...KhihhhihhihhhihK.",
    "...KhhihhhihhhihhhK.",
    "..KhihhhhihhhihhhihK",
    "..KhhSSSSSSSSSSSShhK",
    "..KhSSKKSSSSKKSSSShK",
    "..KhSKKKKSSKKKKSSShK",
    "..KhSKGKKSSKKGKSSShK",
    "..KhSKKKKSSKKKKSSShK",
    "..KhSSSSSSSSSSSSSShK",
    "...KSSbbbbbbbbbbSSK.",
    "...KSbbbbKKKKbbbbSK.",
    "....KSbbbbbbbbbbSK..",
    ".....KKSSSSSSSSKK...",
    "....KCCCwwwwCCCCK...",
    "...KCCCCCwwCCCCCCK..",
    "..KhCCCCCwwCCCCCCCK.",
    "..KSCCCCCwwCCCCCCSK.",
    "..KSCCCCCwwCCCCCCSK.",
    "...KCCCCCCCCCCCCCK..",
    "...KCCCCCCCCCCCCCK..",
    "...KCCCCK..KCCCCK...",
    "...KTTTTK..KTTTTK...",
    "...KTTTTK..KTTTTK...",
    "..KOOOOOK..KOOOOOK..",
  ];

  var DEATH_MAP = [
    "............................KSSK........",
    "...........................KssssK.......",
    "..........................KsSSsssK......",
    ".........................KssKKKSssK.....",
    ".......KKKKKKKK.........KsSK...KSssK....",
    ".....KKccccccccKK......KsSK.....KsssK...",
    "...KKccccccccccccKK...KhsK.......KssK...",
    "..KccccccccccccccccK..KhhK......KssK....",
    ".KcccccVVVVVVVVVVcccK.KhhK......KsK.....",
    ".KccccVVVVVVVVVVVVccK.KhhK.......K......",
    ".KccccVVgVVVVVgVVVccK.KhhK..............",
    ".KccccVVVVVVVVVVVVccK.KhhK..............",
    "..KcccVVVVVVVVVVVVcK..KhhK..............",
    "..KccccVVVVVVVVVVccK..KhhK..............",
    "...KccccccccccccccK...KhhK..............",
    "..KKcccccccccccccccKKKKhhK..............",
    "KKccccccccccccccccccccchhK..............",
    "ccccccccccccccccccccccGhhGK.............",
    "ccccccccccccccccccccccGhhGK.............",
    "ccccccccccccccccccccccGhhGK.............",
    "ccccccccccccccccccccccchhK..............",
    "ccccccccccccccccccccccKhhK..............",
    "ccccccccccccccccccccccKhhK..............",
    "ccccccccccccccccccccccKhhK..............",
    "KcccccccccccccccccccccchhK..............",
    "KcccccccccccccccccccccGhhGK.............",
    "KcccccccccccccccccccccGhhGK.............",
    "ccccccccccccccccccccccGhhGK.............",
    "ccccccccccccccccccccccchhK..............",
    "ccccccccccccccccccccccKhhK..............",
    "KcccccccccccccccccccccKhhK..............",
    "KcccccccccccccccccccccKhhK..............",
    "ccccccccccccccccccccccKhhK..............",
    "ccccccccccccccccccccccKhhK..............",
    "KcccccccccccccccccccccKhhK..............",
    "KcccccccccccccccccccccKhhK..............",
    ".KcccccccccccccccccccKKhhK..............",
    ".KcccccccccccccccccccKKhhK..............",
    "..KcccccccccccccccccK.KhhK..............",
    "..KcccccccccccccccccK.KhhK..............",
    "...KcccccccccccccccK..KhhK..............",
    "....KcccccccccccccK...KhhK..............",
    ".....KcccccccccccK....KhhK..............",
    "......KccccccccKK.....KhhK..............",
    ".......KKcccccK.......KhhK..............",
    ".........KKKKK.........KK...............",
  ];

  /* one character per pixel, as in the game
       K ink   h hair   i hair shine   S skin   b stubble
       G glass  C coat   w shirt       T trousers  O shoe
       c cloak  V the void under the hood   g a glint in it
       s scythe blade   S (in Death) blade shine   h (in Death) the shaft */
  var ANWAR_PAL = {
    K: "#241a26", h: "#2f2320", i: "#5a4238",
    S: "#e0b189", b: "#4a3a30",
    G: "#cfe0ee", C: "#3d5a8a", w: "#eef2f8",
    T: "#2b3550", O: "#1f1a22",
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
    if (k) {
      /* one frame of weight shift: the coat hem swings a pixel */
      map[22] = "..KCCCCK....KCCCCK..";
      map[23] = "..KTTTTK....KTTTTK..";
    }
    return paintMap(map, ANWAR_PAL, 20);
  }

  /* Death does not breathe. The cloak stirs anyway. */
  function paintDeath(k) {
    var map = DEATH_MAP.slice();
    if (k === 1) {
      /* the hem stirs, one row, one pixel */
      map[41] = map[41].replace("ccccc", "cccc.");
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
  var SPEAKER = {
    anwar:  { name: "Anwar",  ink: "#2b3550", tape: "#a8c0e8" },
    ouissy: { name: "Ouissy", ink: "#8c3a60", tape: "#ffb0cd" },
    death:  { name: "",       ink: "#d8d2e8", tape: "#4a4458", dark: true },
    sys:    { name: "",       ink: "#7a5a2a", tape: "#ffd166", flat: true },
  };

  function drawBox(c, who, text, shown, hint) {
    var sp = SPEAKER[who] || SPEAKER.anwar;
    var x = 14, w = VW - 28, y = VH - 40, h = 34;

    /* the paper */
    px(c, x + 1, y + 1, w - 2, h - 2, sp.dark ? "#181420" : "#fffdf5");
    px(c, x, y, w, 1, sp.dark ? "#2c2636" : "#e8dfc8");
    px(c, x, y + h - 1, w, 1, sp.dark ? "#0c0a12" : "#d8cfb4");
    px(c, x, y, 1, h, sp.dark ? "#2c2636" : "#e8dfc8");
    px(c, x + w - 1, y, 1, h, sp.dark ? "#0c0a12" : "#d8cfb4");
    /* two bits of tape holding it up */
    px(c, x - 3, y - 3, 16, 6, sp.tape);
    px(c, x + w - 13, y - 3, 16, 6, sp.tape);

    /* who is speaking */
    var ty = y + 7;
    if (sp.name) {
      c.font = "6px monospace";
      c.textAlign = "left";
      c.fillStyle = sp.ink;
      c.fillText(sp.name, x + 6, ty);
      ty += 9;
    } else ty += 3;

    /* the line, wrapped and typed on */
    c.font = (sp.flat ? "5px" : "6px") + " monospace";
    c.textAlign = "left";
    c.fillStyle = sp.ink;
    var words = String(text).slice(0, shown).split(" ");
    var line = "", lines = [];
    for (var i = 0; i < words.length; i++) {
      var test = line ? line + " " + words[i] : words[i];
      if (c.measureText(test).width > w - 14 && line) { lines.push(line); line = words[i]; }
      else line = test;
    }
    if (line) lines.push(line);
    for (var j = 0; j < lines.length && j < 3; j++) c.fillText(lines[j], x + 6, ty + j * 8);

    /* the little arrow that says "press" */
    if (hint) {
      var b = Math.sin(Date.now() / 200) > 0 ? 0 : 1;
      px(c, x + w - 10, y + h - 9 + b, 4, 1, sp.ink);
      px(c, x + w - 9, y + h - 8 + b, 2, 1, sp.ink);
    }
  }

  /* a full-width choice menu, two options, keyboard or tap */
  function drawChoice(c, opts, sel, prompt) {
    var w = VW - 40, x = 20, y = 62;
    px(c, x - 2, y - 14, w + 4, 12, "rgba(12,8,18,.8)");
    c.font = "5px monospace"; c.textAlign = "center";
    c.fillStyle = "#d8d2e8";
    c.fillText(prompt, VW / 2, y - 5);
    for (var i = 0; i < opts.length; i++) {
      var oy = y + i * 22, on = i === sel;
      px(c, x, oy, w, 18, on ? "#3a2448" : "#181420");
      px(c, x, oy, w, 1, on ? "#ffd166" : "#3a3448");
      px(c, x, oy + 17, w, 1, on ? "#a9741f" : "#0c0a12");
      px(c, x, oy, 1, 18, on ? "#ffd166" : "#3a3448");
      px(c, x + w - 1, oy, 1, 18, on ? "#a9741f" : "#0c0a12");
      c.font = "6px monospace"; c.textAlign = "center";
      c.fillStyle = on ? "#fff0b0" : "#9a92aa";
      c.fillText(opts[i], VW / 2, oy + 12);
      if (on) { px(c, x + 6, oy + 8, 3, 3, "#ffd166"); px(c, x + w - 9, oy + 8, 3, 3, "#ffd166"); }
    }
  }

  /* =======================================================================
     THE SCENE RUNNER

     One state object. `phase` is where in the scene we are, `pt` is how
     long we have been in it. Scenes advance by their own rules; the only
     thing Super Ouissy knows is step / paint / done.
     ======================================================================= */
  var S = null;
  var TYPE_RATE = 42;             // characters a second

  function begin(kind, opts) {
    bakeCast();
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
      round: 0, cue: null, cueT: 0, hits: 0, closeCalled: false,
      sel: 0, particles: [],
    };
    if (kind === "rescue") {
      var alts = SCRIPT.rescueAlt;
      say(alts[(Math.random() * alts.length) | 0]);
    }
    return S;
  }

  function say(lines) { S.lines = lines; S.li = 0; S.shown = 0; S.waiting = false; }
  function line() { return S.lines && S.lines[S.li]; }

  function stepText(dt) {
    var ln = line();
    if (!ln) return "done";
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
      if (S.pt > 1.5) phase(3);
    } else if (S.phase === 3) {                 // and out
      S.dim = Math.max(0, 1 - S.pt / 0.4);
      if (S.pt > 0.4) S.done = true;
    }
  }

  function paintRescue(c, t) {
    /* the game is still behind this; we only add to it */
    if (S.dim > 0) {
      c.save(); c.globalAlpha = 0.62 * S.dim;
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

    /* a soft light around the two of them, so the eye goes there */
    c.save();
    c.globalAlpha = 0.10 + 0.04 * Math.sin(t * 4);
    c.fillStyle = "#ffe6c0";
    c.beginPath();
    c.arc(S.anwar.x + 4, S.her.y + 4, 34, 0, 6.283);
    c.fill();
    c.restore();

    if (S.phase === 2) {
      var ln = line();
      if (ln) drawBox(c, ln.who, ln.text, Math.floor(S.shown), false);
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
  }

  function paint(c, t) {
    if (!S) return;
    c.save();
    if (S.shake > 0) c.translate((Math.random() - .5) * S.shake, (Math.random() - .5) * S.shake);
    if (S.kind === "rescue") paintRescue(c, t);
    c.restore();
  }

  function press(name) {
    if (!S || S.done) return;
    if (S.kind === "rescue") { if (S.phase === 2) phase(3); return; }
  }

  function done() { return !S || S.done; }
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
