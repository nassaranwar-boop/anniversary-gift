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

  /* THE SIZE OF THE PICTURE IS NOT A CONSTANT.

     The platformer picks its view to suit the screen: 320x180 usually,
     240x180 on a phone held upright — where it shows less world, larger —
     and up to 448 wide on a phone held sideways. This scene was written
     to 320 and drew to 320 whatever the canvas underneath it actually
     was, so on an upright phone Death stood at x=224 on a canvas 240
     wide: half of him off the edge of the world, in the scene where he is
     the thing you are supposed to be looking at.

     These follow the canvas now. fitStage() is called at the top of every
     paint, and when the size changes it moves everyone in proportion and
     throws away the frost, which is baked to the size of the frame. */
  var VW = 320, VH = 180;

  /* =======================================================================
     THE WORDS

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
    /* What he says when he picks her up. One is chosen at random each
       time, so ten deaths are not ten identical scenes. */
    rescueAlt: [
      [{ who: "anwar", text: "Up you go. I’ve got you." }],
      [{ who: "anwar", text: "That one doesn’t count. Try again, love." }],
      [{ who: "anwar", text: "You’re okay. Go again — I’m right here." }],
      [{ who: "anwar", text: "Not today. Get back up." }],
      [{ who: "anwar", text: "I’m not going anywhere. Neither are you." }],
      [{ who: "anwar", text: "Careful, love — one more try." }],
      [{ who: "anwar", text: "That’s just a stumble. Keep going." }],
      [{ who: "anwar", text: "I’ll always catch you. Now go get it." }],
      [{ who: "anwar", text: "You’ve got this. I’m just here in case." }],
      [{ who: "anwar", text: "Back on your feet. That’s my girl." }],
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
        { who: "sys", text: "Blade OVER HIS HEAD \u2014 that one comes down.   BLOCK it." },
        { who: "sys", text: "Blade BACK AT HIS HIP \u2014 that one comes across.   DODGE it." },
        { who: "sys", text: "Answer it right and he is open for a moment.   STRIKE him then." },
        { who: "anwar", text: "And listen \u2014 I can take four of those. Not five." },
        { who: "anwar", text: "So don't let him land five." },
      ],
      /* and if she cannot get him back on his feet */
      lost: [
        { who: "death", text: "..." },
        { who: "death", text: "You were always going to be here eventually." },
        { who: "anwar", text: "Not today. Not\u2014" },
        { who: "death", text: "Today." },
        { who: "ouissy", text: "It's alright. Anwar \u2014 it's alright." },
        { who: "ouissy", text: "We'll start again. We're good at that." },
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
      /* when he could not get up */
      parasLost: [
        "He went down, and he got up, and he went down again \u2014 and he would do it a hundred more times before he would let you go. I want you to know what I was thinking, standing there.",
        "I wasn't thinking. I never had to. From the first day, being with you was never a decision I made \u2014 it was just the only direction I knew how to go. So when he came for you, there was no version of me that stayed still. Not one.",
      ],
      paras: [
        "You chose to let it go, and I understand why — some things aren't meant to be fought, just lived. But before we start again, I want you to know what I was thinking, standing there.",
        "I wasn't thinking. I never had to. From the first day, being with you was never a decision I made — it was just the only direction I knew how to go. So when he came for you, there was no version of me that stayed still. Not one.",
      ],
      close: "I would've fought even Death for you, my love. I still would, every time, as many times as it takes.",
      after: "Now — let's start again. I'll be right here.",
      sign: "— Anwar",
    },
  };

  /* =======================================================================
     THE FIGHT

     It used to be six prompts with a generous clock on each, and it could
     not be lost — it said so out loud, in the tutorial. That is a fine
     thing for a cutscene and a poor thing for a fight, and what was asked
     for is a fight: something she plays, that can go wrong, and that is
     worth the two of them standing there.

     So it is an attack loop now, the same shape every good sword fight
     has: he TELLS her what is coming, she answers it, and answering it
     opens him up for one hit back.

       tell    Death winds up, and the wind-up says which attack it is.
               The blade goes over his head for a chop, or back at his
               hip for a sweep. A ghost of the path it will take is drawn
               in the air — it is the only warning, and it is never
               shortened.
       strike  the blade comes through. She has a window:
                 BLOCK  a chop — he plants and takes it on his arm
                 DODGE  a sweep — he goes over it
               The wrong answer is as bad as no answer.
       open    a good answer leaves Death off balance, and the window to
               hit him is real but short. Missing it costs nothing but the
               hit.
       rest    both of them square up again.

     Late on he chains two and three attacks together before the opening,
     which is where the fight gets frightening rather than merely fast.

     WHAT IT COSTS. He has four. Every attack that lands takes one. At
     zero he goes down — and she can get him up, once, by hammering the
     button while he is on one knee. There is no second time. If he does
     not get up, the scene resolves the way it does when she lets go: the
     letter, and the run starts again.

     WHAT IT NEVER DOES. The tell is never shortened, ever, on any band —
     everything else tightens instead. The three answers are three
     buttons on the screen and the keys she has been using all game. And
     nothing is a feint: what he tells her is what he does.
     ======================================================================= */
  /* The scene's phases have names here rather than numbers scattered
     through three functions. 0-6 are the arrival and the conversation and
     have not moved; everything above 6 is the fight, which is new. */
  var PH = {
    arrive: 0, chill: 1, enter: 2, meet: 3, swing: 4, caught: 5, choice: 6,
    tut: 7, rest: 8, tell: 9, blow: 10, beat: 11, open: 12, close: 13,
    down: 14, win: 15, warm: 16,
    lgSay: 20, lgWarm: 21, letter: 22,
  };

  var FIGHT = {
    anwarHp: 4,
    deathHp: 6,                      // how many times he has to be hit
    /* by how much of Death is left. `chain` is the most attacks he will
       run together before the opening. */
    bands: [
      { at: 6, tell: 0.70, window: 0.95, open: 1.15, rest: 0.85, chain: 1 },
      { at: 4, tell: 0.58, window: 0.82, open: 0.95, rest: 0.62, chain: 2 },
      { at: 2, tell: 0.48, window: 0.70, open: 0.82, rest: 0.46, chain: 3 },
    ],
    hitStop: 0.09,                   // the frame everything stops on an impact
    getUp: { presses: 6, time: 3.4 },
  };

  /* The two attacks, and the answer to each. The colour is the colour its
     telegraph is drawn in, so the shape and the colour say the same thing
     twice — which is what makes a fast tell readable. */
  var MOVES = {
    chop:  { need: "block", label: "BLOCK", colour: "#9fe4ff", say: "over his head" },
    sweep: { need: "dodge", label: "DODGE", colour: "#c9a0ff", say: "back at his hip" },
  };
  function band() {
    var B = FIGHT.bands, i;
    for (i = 0; i < B.length; i++) if (S.dhp > B[i].at - 2) return B[i];
    return B[B.length - 1];
  }
  /* Which attack next. A bag rather than a die, so she never gets the same
     one five times running and never has to guess — and the first two are
     always one of each, because the first two are where she learns them. */
  function nextMove() {
    if (S.moveSeen < 2) return S.moveSeen === 0 ? "chop" : "sweep";
    if (!S.moveBag || !S.moveBag.length) {
      S.moveBag = ["chop", "sweep", "chop", "sweep"];
      for (var i = S.moveBag.length - 1; i > 0; i--) {
        var j = (Math.random() * (i + 1)) | 0, t = S.moveBag[i];
        S.moveBag[i] = S.moveBag[j]; S.moveBag[j] = t;
      }
    }
    return S.moveBag.pop();
  }

  /* =======================================================================
     THE SCORE

     The scene had no music of its own. The game's own tune kept playing
     under it, which is a cheerful little march, under Death.

     This is written for the scene and nothing else, out of the same Web
     Audio context everything else here uses — no file, nothing to load.
     It is one sequencer at sixteenth notes with a handful of voices, and
     it is driven from step(), not from a timer of its own: a timer in a
     background tab is throttled to nothing and the tune would scatter.

     Five movements, and they follow the scene rather than loop under it:

       cold    a drone and a heartbeat, for the cold coming in
       meet    the same, with a bell — the conversation
       f1..f3  the fight, and each band of his health adds to it: a pulse
               and a bass, then a counter-line, then the toms. The key
               never changes. It just gets closer.
       down    everything falls away but the heartbeat, slowing
       win     the one place it goes major, and it takes its time
       letter  warm, slow, and nothing in it is afraid

     Everything obeys the site's audio rules: one shared context, on the
     register so leaving the page quietens it, and silent while away.
     ======================================================================= */
  var MUS = (function () {
    var on = false, name = "", step = 0, nextT = 0, bpm = 120, noiseBuf = null;
    var droneOsc = null, droneGain = null, master = null;

    function ctx() {
      try {
        var AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        var ac = window.__soAudio || (window.__soAudio = new AC());
        if (!MUS_REG && window.registerAudio) {
          MUS_REG = true;
          try { window.registerAudio(function () { return window.__soAudio; }); } catch (e) {}
        }
        if (window.audioAsleep && window.audioAsleep()) return null;
        if (ac.state === "suspended") ac.resume();
        return ac;
      } catch (e) { return null; }
    }
    var MUS_REG = false;

    function bus(ac) {
      if (master && master.ac === ac) return master.g;
      var g = ac.createGain();
      g.gain.value = 0.0001;
      g.connect(ac.destination);
      master = { ac: ac, g: g };
      return g;
    }
    function fade(ac, to, secs) {
      var g = bus(ac);
      g.gain.cancelScheduledValues(ac.currentTime);
      g.gain.setValueAtTime(Math.max(0.0001, g.gain.value), ac.currentTime);
      g.gain.exponentialRampToValueAtTime(Math.max(0.0001, to), ac.currentTime + (secs || 0.4));
    }

    function hz(n) { return 440 * Math.pow(2, (n - 69) / 12); }

    function tone(ac, t, note, type, dur, vol, slide) {
      var o = ac.createOscillator(), g = ac.createGain();
      o.type = type || "triangle";
      o.frequency.setValueAtTime(hz(note), t);
      if (slide !== undefined) o.frequency.exponentialRampToValueAtTime(Math.max(20, hz(slide)), t + dur);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(bus(ac));
      o.start(t); o.stop(t + dur + 0.03);
    }
    function kick(ac, t, vol) {
      var o = ac.createOscillator(), g = ac.createGain();
      o.type = "sine";
      o.frequency.setValueAtTime(150, t);
      o.frequency.exponentialRampToValueAtTime(38, t + 0.14);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + 0.006);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
      o.connect(g); g.connect(bus(ac));
      o.start(t); o.stop(t + 0.2);
    }
    function hiss(ac, t, dur, vol, freq) {
      if (!noiseBuf || noiseBuf.sampleRate !== ac.sampleRate) {
        noiseBuf = ac.createBuffer(1, ac.sampleRate * 0.5, ac.sampleRate);
        var d = noiseBuf.getChannelData(0);
        for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      }
      var src = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
      src.buffer = noiseBuf;
      f.type = "highpass"; f.frequency.value = freq || 4200;
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      src.connect(f); f.connect(g); g.connect(bus(ac));
      src.start(t); src.stop(t + dur + 0.02);
    }
    function drone(ac, note, vol) {
      stopDrone();
      var o = ac.createOscillator(), o2 = ac.createOscillator(), g = ac.createGain();
      o.type = "sine"; o.frequency.value = hz(note);
      o2.type = "sine"; o2.frequency.value = hz(note) * 1.005;   // a slow beat between them
      g.gain.setValueAtTime(0.0001, ac.currentTime);
      g.gain.exponentialRampToValueAtTime(vol, ac.currentTime + 1.2);
      o.connect(g); o2.connect(g); g.connect(bus(ac));
      o.start(); o2.start();
      droneOsc = [o, o2]; droneGain = g;
    }
    function stopDrone() {
      try {
        if (droneGain && master) {
          var ac = master.ac, t = ac.currentTime;
          droneGain.gain.cancelScheduledValues(t);
          droneGain.gain.setValueAtTime(Math.max(0.0001, droneGain.gain.value), t);
          droneGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
          var oscs = droneOsc;
          setTimeout(function () { try { oscs.forEach(function (o) { o.stop(); }); } catch (e) {} }, 900);
        }
      } catch (e) {}
      droneOsc = null; droneGain = null;
    }

    /* A natural minor on A. Everything in the scene is in it, so the
       movements can hand over to each other without a seam. */
    var A = 45;                        // A2
    var BASS = {
      f1: [A, A, A + 7, A + 5],
      f2: [A, A + 3, A + 5, A + 2],
      f3: [A, A - 2, A + 3, A + 5],
    };
    var LEAD = [A + 24, A + 27, A + 31, A + 27, A + 29, A + 27, A + 24, A + 22];

    function emit(ac, i, t) {
      var bar = (i >> 4) & 3, s16 = i & 15;
      if (name === "cold" || name === "meet") {
        /* a heart, not a drum */
        if (s16 === 0) kick(ac, t, 0.09);
        if (s16 === 3) kick(ac, t, 0.05);
        if (name === "meet" && s16 === 8 && bar % 2 === 1) tone(ac, t, A + 36, "sine", 1.6, 0.025);
        return;
      }
      if (name === "down") {
        if (s16 === 0) kick(ac, t, 0.10);
        if (s16 === 4) kick(ac, t, 0.045);
        return;
      }
      if (name === "win") {
        /* it lands on the major third and stays there */
        if (i === 0)  { tone(ac, t, A, "triangle", 2.4, 0.05); tone(ac, t, A + 16, "triangle", 2.4, 0.03); }
        if (i === 16) { tone(ac, t, A + 5, "triangle", 2.4, 0.05); tone(ac, t, A + 21, "triangle", 2.4, 0.03); }
        if (i === 32) { tone(ac, t, A + 7, "triangle", 2.6, 0.05); tone(ac, t, A + 23, "triangle", 2.6, 0.03); }
        if (i === 48) { tone(ac, t, A + 4, "triangle", 3.4, 0.055); tone(ac, t, A + 28, "sine", 3.4, 0.03); }
        return;
      }
      if (name === "letter") {
        var arp = [A + 12, A + 16, A + 19, A + 23];
        if (s16 % 4 === 0) tone(ac, t, arp[(i >> 2) % 4], "sine", 1.1, 0.028);
        if (s16 === 0 && bar % 2 === 0) tone(ac, t, A, "sine", 3.0, 0.035);
        return;
      }
      /* ---- the fight ---- */
      var lvl = name === "f3" ? 3 : name === "f2" ? 2 : 1;
      var pat = BASS[name] || BASS.f1;
      var root = pat[bar];
      if (s16 % 4 === 0) kick(ac, t, 0.11);
      if (lvl >= 2 && s16 % 4 === 2) hiss(ac, t, 0.05, 0.035, 6000);
      if (s16 % 2 === 0) tone(ac, t, root - 12, "sawtooth", 0.13, 0.036);
      if (lvl >= 2 && s16 % 2 === 1) tone(ac, t, root - 12, "sawtooth", 0.08, 0.018);
      if (lvl >= 2 && s16 % 8 === 0) tone(ac, t, LEAD[(i >> 3) % LEAD.length], "square", 0.22, 0.022);
      if (lvl >= 3) {
        if (s16 % 4 === 3) tone(ac, t, root + 12, "square", 0.09, 0.02);
        if (s16 === 14 && bar === 3) { kick(ac, t, 0.12); kick(ac, t + 0.08, 0.12); }
        if (s16 === 6) hiss(ac, t, 0.03, 0.02, 8000);
      }
    }

    return {
      play: function (which) {
        if (name === which && on) return;
        var ac = ctx();
        name = which; on = true; step = 0; nextT = 0;
        bpm = which === "cold" || which === "meet" ? 60
            : which === "down" ? 52
            : which === "win" ? 60
            : which === "letter" ? 62
            : which === "f3" ? 152 : which === "f2" ? 138 : 126;
        if (!ac) return;
        fade(ac, which.charAt(0) === "f" ? 0.9 : 0.75, 0.5);
        if (which === "cold" || which === "meet") drone(ac, A - 12, 0.05);
        else if (which === "down") drone(ac, A - 12, 0.035);
        else stopDrone();
      },
      /* scheduled a fraction ahead of the clock, and only ever forward:
         a scene that is paused simply stops asking for notes */
      tick: function () {
        if (!on) return;
        var ac = ctx(); if (!ac) return;
        var now = ac.currentTime, spb = 60 / bpm / 4;
        if (!nextT || nextT < now - 0.4) nextT = now + 0.05;
        var guard = 0;
        while (nextT < now + 0.2 && guard++ < 32) {
          emit(ac, step, nextT);
          step++; nextT += spb;
        }
      },
      stop: function () {
        if (!on) return;
        on = false; name = "";
        stopDrone();
        try { var ac = window.__soAudio; if (ac && master && master.ac === ac) fade(ac, 0.0001, 0.35); } catch (e) {}
      },
      playing: function () { return on ? name : ""; },
    };
  })();

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
    ".....KSBBBBBBBBBBBSK......",
    "......KSbbbbWWbbbbSK......",
    "........KbbbbbbbbK........",
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
    /* The beard used to have the ink colour threaded through it — K at two
       points on each row — which at this size is not a beard, it is a
       smear with holes in it. It is one shape now, and it comes in over
       two tones so it reads as growth rather than as paint: B where it
       starts along the jaw, b where it is full. */
    b: "#4a3a30", B: "#7d5c46",   // the beard, short along the jaw
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
  /* =======================================================================
     THE THREE BUTTONS

     The fight needs controls she can see. The platformer's own pad is
     under the stage and it does forward every press into this scene, but
     a d-pad and a jump button do not say BLOCK, DODGE or STRIKE, and this
     fight is played by naming the answer rather than by moving.

     It is built here rather than written into index.html on purpose: the
     markup file is the one every session edits, a block of it has been
     lost in a merge before, and this scene is the least-played part of the
     game — the one where nobody would notice for weeks. Nothing to lose,
     nothing to merge.
     ======================================================================= */
  var PAD_KEYS = [
    { k: "block",  label: "BLOCK",  hint: "\u2193" },
    { k: "dodge",  label: "DODGE",  hint: "\u2190 \u2192" },
    { k: "strike", label: "STRIKE", hint: "SPACE" },
  ];
  function fightPad() {
    var pad = $d("rs-pad");
    if (pad) return pad;
    /* NOT inside the stage. The stage is a 16:9 letterbox, and on a phone
       held upright it is a band across the middle of the screen — a pad
       laid over the bottom of it covers the two people fighting. It goes
       where the platformer's own pad goes, in the column under the stage,
       which is the one place on every shape of screen that is hers to
       touch and nobody's to look at. */
    var stage = document.querySelector("#screen-ouissy .so-frame") ||
                document.getElementById("so-stage");
    if (!stage) return null;
    pad = document.createElement("div");
    pad.id = "rs-pad";
    pad.className = "rs-pad";
    pad.hidden = true;
    var html = "";
    for (var i = 0; i < PAD_KEYS.length; i++) {
      html += '<button type="button" class="rs-key rs-key-' + PAD_KEYS[i].k + '" data-rs="' + PAD_KEYS[i].k + '">' +
                '<b>' + PAD_KEYS[i].label + '</b><i>' + PAD_KEYS[i].hint + '</i>' +
              "</button>";
    }
    html += '<button type="button" class="rs-key rs-key-up" data-rs="up"><b>GET UP</b><i>hit it</i></button>';
    pad.innerHTML = html;
    stage.appendChild(pad);
    Array.prototype.forEach.call(pad.querySelectorAll("[data-rs]"), function (b) {
      var k = b.getAttribute("data-rs");
      /* pointerdown, not click: a window of two thirds of a second cannot
         wait for a click to settle */
      b.addEventListener("pointerdown", function (e) {
        e.preventDefault(); e.stopPropagation();
        if (k === "up") getUpPress(); else action(k);
        b.blur();
      });
      b.addEventListener("contextmenu", function (e) { e.preventDefault(); });
      b.setAttribute("tabindex", "-1");
    });
    return pad;
  }
  /* "fight" shows the three, "getup" shows the one, null puts it away.
     The platformer's own pad steps aside while this one is up, so there
     is only ever one set of controls on the screen. */
  function showPad(mode) {
    var pad = fightPad();
    if (!pad) return;
    pad.hidden = !mode;
    setClass(pad, "rs-pad" + (mode ? " on rs-pad-" + mode : ""));
    var screen = document.getElementById("screen-ouissy");
    if (screen) screen.classList.toggle("so-fighting", !!mode);
    if (!mode) Array.prototype.forEach.call(pad.querySelectorAll(".rs-key"), function (b) {
      b.classList.remove("good", "bad", "want");
    });
  }
  /* the verdict, on the buttons themselves: the one she should have hit
     goes green, the one she did hit goes red */
  function padVerdict(need, got, good) {
    var pad = $d("rs-pad"); if (!pad) return;
    Array.prototype.forEach.call(pad.querySelectorAll(".rs-key"), function (b) {
      var k = b.getAttribute("data-rs");
      b.classList.remove("good", "bad", "want");
      if (good && k === need) b.classList.add("good");
      else if (!good && k === need) b.classList.add("want");
      else if (!good && k === got) b.classList.add("bad");
    });
  }
  function padClear() {
    var pad = $d("rs-pad"); if (!pad) return;
    Array.prototype.forEach.call(pad.querySelectorAll(".rs-key"), function (b) {
      b.classList.remove("good", "bad", "want");
    });
  }

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

  /* The letter arrives in three movements, each one typed out in turn:
     the body, then the line it was always going to close on, then the
     invitation to start again. */
  function letterParts() {
    var L = SCRIPT.letter;
    /* THE SAME LETTER, ONE PARAGRAPH APART. It opens by naming what just
       happened, and two things can have just happened: she let it go, or
       he could not get up. Telling someone who watched him lose that she
       chose to let it go is the letter talking about a different evening
       than the one she had. Everything after the first paragraph is the
       same, because everything after the first paragraph was always
       true. */
    var first = (S && S.lost && L.parasLost) ? L.parasLost : L.paras;
    return [first.join("\n\n"), L.close, L.after];
  }
  function letterChars() {
    return letterParts().reduce(function (n, p) { return n + p.length; }, 0);
  }
  function showLetter() {
    var box = $d("so-letter");
    if (!box) return;
    box.hidden = false;
    hideLine();                                  // the letter speaks for itself
    var t = $d("so-letter-title"); if (t) t.textContent = SCRIPT.letter.title;
    var sg = $d("so-letter-sign");
    if (sg) { sg.textContent = SCRIPT.letter.sign; sg.classList.remove("on"); }
    ["so-letter-body", "so-letter-close", "so-letter-after"].forEach(function (id) {
      var e = $d(id); if (e) { e.textContent = ""; e.classList.remove("on"); }
    });
    var ok = $d("so-letter-ok"); if (ok) ok.hidden = true;
  }
  function hideLetter() { var b = $d("so-letter"); if (b) b.hidden = true; }
  /* It writes itself out rather than appearing: she should read it at the
     pace it was meant to be said. */
  function paintLetter(shown) {
    var parts = letterParts();
    var ids = ["so-letter-body", "so-letter-close", "so-letter-after"];
    var n = Math.floor(shown);
    for (var i = 0; i < parts.length; i++) {
      var el = $d(ids[i]);
      if (!el) continue;
      var want = parts[i].slice(0, Math.max(0, Math.min(parts[i].length, n)));
      if (el.textContent !== want) el.textContent = want;
      /* each movement only fades in once it has something to say */
      var on = want.length > 0;
      if (el.classList.contains("on") !== on) el.classList.toggle("on", on);
      n -= parts[i].length;
    }
    var sg = $d("so-letter-sign");
    if (sg) sg.classList.toggle("on", Math.floor(shown) >= letterChars());
    var ok = $d("so-letter-ok");
    if (ok) ok.hidden = Math.floor(shown) < letterChars();
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
      cue.addEventListener("pointerdown", function (e) {
        e.preventDefault();
        /* In the fight the cue is a read-out, not a button: the three
           buttons are the controls, and a tap on the word STRIKE that
           also counted as a strike would make BLOCK unplayable on a
           phone. */
        if (inFight()) return;
        press("confirm");
      });
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
      /* on the site's register, or leaving the page cannot quieten it */
      if (!sfx.registered && window.registerAudio) {
        sfx.registered = true;
        try { window.registerAudio(function () { return window.__soAudio; }); } catch (e) {}
      }
      /* LEAVING THE PAGE MEANS QUIET. The site puts every context to
         sleep on the way out; this used to wake it straight back up on
         the next sound the scene made, so a scene still ticking in a
         window you had left started talking again. Away, we make
         nothing and wake nothing — the site pokes it on the way back. */
      if (window.audioAsleep && window.audioAsleep()) return;
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
        /* the fight. A wind-up you can hear coming, a block that rings,
           a dodge that is only air, a hit that lands on him and one that
           lands on her — four different noises, because four different
           things happen and she has to know which without looking. */
        windup: { type: "sawtooth", f: 120,  to: 300,  d: .34, v: .05 },
        clang:  { type: "square",   f: 1750, to: 520,  d: .34, v: .085 },
        whoosh: { type: "sawtooth", f: 480,  to: 1400, d: .16, v: .04 },
        hurt:   { type: "square",   f: 260,  to: 60,   d: .34, v: .09 },
        land:   { type: "square",   f: 190,  to: 48,   d: .30, v: .10 },
        up:     { type: "triangle", f: 300,  to: 900,  d: .30, v: .07 },
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
      /* the fight */
      ahp: 0, dhp: 0, move: null, moveSeen: 0, moveBag: null, chainLeft: 0,
      ans: null, winT: 0, winLen: 0, tellLen: 0, restLen: 0,
      openT: 0, openLen: 0, struck: false,
      act: null, actT: 0, dact: null, dactT: 0,
      freeze: 0, hurtFlash: 0, guard: 0, lost: false,
      getUpT: 0, getUpN: 0, downUsed: false, taken: 0, anwarTo: null,
    };
    if (kind === "rescue") {
      say(SCRIPT.rescueAlt[nextRescueLine()]);
    } else {
      showPad(null);
      MUS.play("cold");
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

  /* A shuffled bag rather than a die roll. Picking at random each time
     means the same line can come up twice in a row, which reads as the
     scene glitching rather than as him saying something; this deals out
     all ten in a random order, then reshuffles. */
  var rescueBag = [], rescueLast = -1;
  function nextRescueLine() {
    if (!rescueBag.length) {
      rescueBag = SCRIPT.rescueAlt.map(function (_, i) { return i; });
      for (var i = rescueBag.length - 1; i > 0; i--) {
        var j = (Math.random() * (i + 1)) | 0;
        var t = rescueBag[i]; rescueBag[i] = rescueBag[j]; rescueBag[j] = t;
      }
      /* The bag is dealt from the end, so the last card of one shuffle can
         land next to the first of the next and he says the same thing
         twice running — the one case a shuffle does not rule out. Swap it
         with its neighbour when that happens. */
      if (rescueBag.length > 1 && rescueBag[rescueBag.length - 1] === rescueLast) {
        var k = rescueBag.length - 1;
        rescueBag[k] = rescueBag[k - 1]; rescueBag[k - 1] = rescueLast;
      }
    }
    rescueLast = rescueBag.pop();
    return rescueLast;
  }

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

  /* the canvas changed shape under us: an orientation, or a resize */
  function fitStage(c) {
    var w = c && c.canvas ? c.canvas.width : VW;
    var h = c && c.canvas ? c.canvas.height : VH;
    if (!w || !h || (w === VW && h === VH)) return;
    var k = w / VW;
    VW = w; VH = h;
    FROST = null;
    if (S) {
      S.her.x *= k; S.anwar.x *= k; S.death.x *= k;
      if (S.anwarTo !== null && S.anwarTo !== undefined) S.anwarTo *= k;
    }
  }

  function paintRescue(c, t) {
    fitStage(c);
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
      if (S.pt > 3.4) { MUS.play("meet"); say(D.meet); phase(PH.meet); }

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
      if (textFinished()) { S.lines = null; S.sel = 0; phase(PH.choice); }

    } else if (S.phase === PH.choice) {           /* her decision */
      /* nothing moves; it waits for her */

    /* ---------------- the fight ---------------- */
    } else if (S.phase === PH.tut) {              /* he explains it first */
      stepText(dt);
      if (textFinished()) { S.lines = null; startFight(); }

    } else if (S.phase === PH.rest) {             /* squared up */
      S.dact = "ready";
      if (S.pt > S.restLen) armAttack();

    } else if (S.phase === PH.tell) {             /* the wind-up */
      S.dact = "windup";
      if (S.pt > S.tellLen) {
        S.dact = "swing"; S.ans = null; S.winT = 0;
        S.winLen = band().window;
        sfx("swing");
        phase(PH.blow);
      }

    } else if (S.phase === PH.blow) {             /* the blade comes through */
      S.winT += dt;
      showCue(MOVES[S.move].label, 1 - S.winT / S.winLen);
      if (S.winT > S.winLen) answer(null);

    } else if (S.phase === PH.beat) {             /* the frame after it */
      if (S.pt > 0.34) {
        hideCue();
        if (S.ahp <= 0) { goDown(); return; }
        if (S.ans === "good") {
          if (S.chainLeft > 0) { S.chainLeft--; armAttack(); }
          else {
            padClear(); S.cueResult = null;
            S.openT = 0; S.openLen = band().open; S.struck = false;
            phase(PH.open);
          }
        } else { S.restLen = band().rest; phase(PH.rest); }
      }

    } else if (S.phase === PH.open) {             /* and he is open */
      S.dact = "stagger";
      S.openT += dt;
      showCue("STRIKE", 1 - S.openT / S.openLen);
      if (S.openT > S.openLen) { hideCue(); afterOpening(); }

    } else if (S.phase === PH.close) {            /* the story beat, once */
      S.flash = Math.max(0, S.flash - dt * 2);
      stepText(dt);
      if (textFinished()) {
        S.lines = null;
        if (!S.closeAfterSaid) { S.closeAfterSaid = true; say(SCRIPT.death.closeCallAfter); return; }
        padClear(); showPad("fight");
        S.restLen = band().rest; phase(PH.rest);
      }

    } else if (S.phase === PH.down) {             /* on one knee */
      S.getUpT += dt;
      showCue("GET UP", 1 - S.getUpT / FIGHT.getUp.time);
      if (S.getUpT > FIGHT.getUp.time) {
        /* he does not get up. It ends the way it ends when she lets go —
           the run closes, and the letter is waiting. */
        hideCue(); showPad(null);
        S.lost = true; S.outcome = "letgo";
        MUS.play("down");
        say(SCRIPT.death.lost);
        phase(PH.lgSay);
      }

    } else if (S.phase === PH.win) {              /* he wins */
      stepText(dt);
      if (textFinished()) { S.lines = null; phase(PH.warm); }

    } else if (S.phase === PH.warm) {             /* the cold lets go */
      S.chill = Math.max(0, S.chill - dt * 0.7);
      S.dim = Math.max(0, S.dim - dt * 0.7);
      /* leaving, not death.k — that is a sprite frame index, and winding it
         down as if it were an opacity walks straight off the end of CAST. */
      S.leaving = Math.min(1, S.leaving + dt * 0.7);
      if (S.pt > 1.6) S.done = true;
    /* ---------------- letting it go ---------------- */
    } else if (S.phase === PH.lgSay) {            /* what they say instead */
      stepText(dt);
      if (textFinished()) { S.lines = null; phase(PH.lgWarm); }

    } else if (S.phase === PH.lgWarm) {           /* the cold lifts, then the letter */
      S.chill = Math.max(0, S.chill - dt * 0.8);
      S.dim = Math.max(0, S.dim - dt * 0.8);
      S.leaving = Math.min(1, S.leaving + dt * 0.8);
      if (S.pt > 1.4) { S.letterShown = 0; showLetter(); MUS.play("letter"); phase(PH.letter); }

    } else if (S.phase === PH.letter) {           /* the letter, writing itself */
      S.letterShown = Math.min(letterChars(), S.letterShown + dt * 72);
      paintLetter(S.letterShown);
    }
  }

  /* =======================================================================
     THE FIGHT, AS IT IS PLAYED
     ======================================================================= */
  function startFight() {
    S.ahp = FIGHT.anwarHp; S.dhp = FIGHT.deathHp;
    S.moveSeen = 0; S.moveBag = null; S.chainLeft = 0;
    S.closeCalled = false; S.downUsed = false; S.lost = false;
    S.act = null; S.actT = 0; S.dact = "ready"; S.dactT = 0;
    S.hits = 0; S.taken = 0; S.hurtFlash = 0; S.guard = 0;
    S.restLen = 0.9;
    /* he closes the distance. They were a conversation apart; a fight is
       fought at arm's length, and every swing has to look like it could
       reach him or none of them are frightening. */
    S.anwarTo = S.death.x - 52;
    MUS.play("f1");
    showPad("fight");
    phase(PH.rest);
  }
  /* The rounds themselves. The close call sits in the middle of the fight
     but it is a conversation, so it is deliberately NOT in here: inside a
     round a press is an answer, and in the close call a press is "go on". */
  var FIGHTING = [PH.rest, PH.tell, PH.blow, PH.beat, PH.open, PH.down];
  function inFight() {
    return !!S && S.kind === "death" && FIGHTING.indexOf(S.phase) >= 0;
  }

  function armAttack() {
    padClear();
    S.cueResult = null;
    S.move = nextMove(); S.moveSeen++;
    S.tellLen = band().tell;
    /* how many he will run together before the opening, decided when the
       first of them starts so the chain is a thing she can feel coming
       rather than a surprise in the middle of it */
    if (S.chainLeft <= 0) {
      var most = band().chain - 1;
      S.chainLeft = most > 0 ? (Math.random() * (most + 1)) | 0 : 0;
    }
    S.dact = "windup"; S.dactT = 0;
    sfx("windup");
    phase(PH.tell);
  }

  /* her answer, or the lack of one */
  function answer(kind) {
    if (S.phase !== PH.blow || S.ans) return;
    var need = MOVES[S.move].need;
    var good = kind === need;
    S.ans = good ? "good" : "bad";
    S.cueResult = good ? "hit" : "miss";
    showCue(MOVES[S.move].label, 0);
    padVerdict(need, kind, good);
    S.freeze = FIGHT.hitStop;

    if (good) {
      S.act = need; S.actT = 0;
      S.guard = need === "block" ? 1 : 0;
      S.dact = "stagger"; S.dactT = 0;
      S.shake = need === "block" ? 9 : 4;
      S.flash = need === "block" ? 0.5 : 0.18;
      sfx(need === "block" ? "clang" : "whoosh");
    } else {
      S.ahp--; S.taken++;
      S.act = "hurt"; S.actT = 0;
      S.dact = "through"; S.dactT = 0;
      S.shake = 14; S.hurtFlash = 1;
      sfx("hurt");
    }
    phase(PH.beat);
  }

  /* the opening: she takes it, or she does not */
  function strikeNow() {
    if (S.phase !== PH.open || S.struck) return;
    S.struck = true;
    S.dhp--; S.hits++;
    S.act = "strike"; S.actT = 0;
    S.dact = "hurt"; S.dactT = 0;
    S.shake = 12; S.flash = 0.75; S.freeze = FIGHT.hitStop * 1.4;
    sfx("land");
    hideCue();
    afterOpening(true);
  }

  function afterOpening(landed) {
    if (S.dhp <= 0) {
      showPad(null); hideCue();
      MUS.play("win");
      S.dact = "beaten"; S.dactT = 0;
      say(SCRIPT.death.win);
      phase(PH.win);
      return;
    }
    /* his health decides the music and the pace, so both of them change
       at the same moment she sees him change */
    var b = band();
    MUS.play(b === FIGHT.bands[2] ? "f3" : b === FIGHT.bands[1] ? "f2" : "f1");
    /* the close call is a story beat and lands once, when he first gets
       properly angry — never as a punishment for missing */
    if (landed && !S.closeCalled && S.dhp <= FIGHT.deathHp - 3) {
      S.closeCalled = true;
      S.shake = 12; S.flash = 1; S.dim = Math.min(1, S.dim + 0.25);
      showPad(null); hideCue();
      sfx("catch");
      say(SCRIPT.death.closeCall);
      phase(PH.close);
      return;
    }
    S.restLen = b.rest;
    phase(PH.rest);
  }

  /* he goes down, and there is exactly one way back up */
  function goDown() {
    hideCue();
    S.act = "down"; S.actT = 0;
    S.dact = "ready"; S.dactT = 0;
    S.getUpT = 0; S.getUpN = 0;
    S.shake = 16; S.hurtFlash = 1;
    MUS.play("down");
    showPad("getup");
    sfx("thumpBig");
    phase(PH.down);
  }
  function getUpPress() {
    if (S.phase !== PH.down) return;
    S.getUpN++;
    S.act = "rising"; S.actT = 0;
    sfx("pick");
    if (S.getUpN >= FIGHT.getUp.presses) {
      /* two back, not four: he is up, and he is not what he was */
      S.ahp = 2;
      S.downUsed = true;
      S.act = null; S.shake = 8; S.flash = 0.5;
      sfx("up");
      hideCue(); showPad("fight");
      var b = band();
      MUS.play(b === FIGHT.bands[2] ? "f3" : b === FIGHT.bands[1] ? "f2" : "f1");
      S.restLen = 1.1;                 /* a breath before he comes again */
      phase(PH.rest);
    }
  }

  /* =======================================================================
     DRAWING THE FIGHT

     Nothing here is a new sprite. Two pixel maps exist — him and Death —
     and a fight needs twenty poses, so the poses are made the way a
     fighting game makes most of its: with the transform, and with what is
     drawn around the figure rather than on it.

       a lunge      is a translate with an ease on the way out and a
                    slower one on the way back
       a brace      is a drop of two pixels, a lean, and a guard arc that
                    is the only warm shape on the screen
       a dodge      is an arc through the air and an afterimage left where
                    he was, which is what tells you he MOVED rather than
                    that he is somewhere else now
       a stagger    is a lean away from the blow he just took plus a pale
                    core, because the opening has to be visible from the
                    other side of the room

     And the telegraph is drawn, not implied: the path the blade is about
     to take, in the colour of the answer it wants, filling as the wind-up
     runs out. It is the whole fight in one shape.
     ======================================================================= */

  /* where the two of them are standing, before anything is done to them */
  function ease3(t) { return 1 - Math.pow(1 - clamp(t, 0, 1), 3); }
  function arc1(t) { return Math.sin(clamp(t, 0, 1) * Math.PI); }

  function anwarPose() {
    var p = { dx: 0, dy: 0, rot: 0, sy: 1, ghost: 0 };
    var k = S.act, u = S.actT;
    if (k === "block") {
      var b = arc1(u / 0.42);
      p.dy = 2 * b; p.rot = 0.05 * b; p.dx = -1 * b;
    } else if (k === "dodge") {
      var d = clamp(u / 0.40, 0, 1);
      p.dy = -13 * arc1(d); p.dx = -7 * arc1(d); p.rot = -0.22 * arc1(d);
      p.ghost = 1 - d;
    } else if (k === "strike") {
      var st = clamp(u / 0.42, 0, 1);
      p.dx = st < 0.35 ? 20 * ease3(st / 0.35) : 20 * (1 - ease3((st - 0.35) / 0.65));
      p.rot = 0.12 * (1 - st);
    } else if (k === "hurt") {
      var h = clamp(u / 0.55, 0, 1);
      p.dx = -16 * (1 - ease3(h)); p.rot = -0.30 * (1 - h); p.dy = -3 * arc1(h);
    } else if (k === "down") {
      p.dy = 9; p.sy = 0.68; p.rot = -0.18;
    } else if (k === "rising") {
      var r = clamp(u / 0.18, 0, 1);
      p.dy = 9 - 4 * arc1(r); p.sy = 0.68 + 0.10 * arc1(r); p.rot = -0.18 + 0.06 * arc1(r);
    }
    return p;
  }

  function deathPose() {
    var p = { dx: 0, dy: 0, rot: 0 };
    var k = S.dact, u = S.dactT, chop = S.move === "chop";
    if (k === "windup") {
      var w = ease3(u / Math.max(0.12, S.tellLen));
      if (chop) { p.dy = -5 * w; p.rot = -0.16 * w; p.dx = 3 * w; }
      else { p.dx = 7 * w; p.rot = 0.10 * w; }
    } else if (k === "swing") {
      var sw = ease3(u / 0.18);
      if (chop) { p.rot = -0.16 + 0.46 * sw; p.dy = -5 + 7 * sw; }
      else { p.dx = 7 - 26 * sw; p.rot = 0.10 - 0.06 * sw; }
    } else if (k === "through") {
      p.dx = chop ? 2 : -20 + 14 * ease3(u / 0.5);
      p.rot = chop ? 0.28 * (1 - ease3(u / 0.5)) : 0;
    } else if (k === "stagger") {
      var g = ease3(u / 0.5);
      p.dx = 10 * g; p.rot = -0.18 * g;
    } else if (k === "hurt") {
      var hh = clamp(u / 0.45, 0, 1);
      p.dx = 16 * (1 - ease3(hh)); p.rot = -0.26 * (1 - hh);
    }
    return p;
  }

  /* the two anchors the fight is drawn between */
  function fightGeom(groundY) {
    return {
      ax: S.anwar.x, ay: groundY, dx: S.death.x + 12, dy: groundY,
      head: groundY - 30, waist: groundY - 16,
    };
  }

  /* THE TELEGRAPH — what is about to happen, and where.

     The chop is drawn as the path the blade will actually take: an arc
     centred on his own shoulder, starting straight up where he is holding
     it and ending at the height of Anwar's head. It is not a decoration
     pointing at the answer — it is the swing, drawn a second before it
     happens, and that is why it can be read at a glance.

     The sweep is the same idea lying down: a line across the gap at the
     height it will come through. */
  function chopArc(g) {
    /* pivoted between the two of them rather than on his shoulder: at his
       shoulder the radius is the whole gap and the arc goes up out of the
       picture, which is a comet, not a scythe. Halfway across, it is a
       swing that crosses the ground they are standing on. */
    var cx = (g.dx + g.ax + 11) / 2, r = Math.max(22, (g.dx - g.ax - 11) / 2);
    return { cx: cx, cy: g.waist - 2, r: r };
  }
  function paintTell(c, g) {
    if (S.phase !== PH.tell && S.phase !== PH.blow) return;
    var M = MOVES[S.move];
    var k = S.phase === PH.tell ? clamp(S.pt / Math.max(0.12, S.tellLen), 0, 1) : 1;
    var live = S.phase === PH.blow;
    c.save();
    c.strokeStyle = M.colour;
    c.lineCap = "round";
    /* twice: a wide faint pass for the glow, a thin bright one for the
       edge. One pass at this size is a hairline nobody sees in the dark. */
    for (var pass = 0; pass < 2; pass++) {
      c.globalAlpha = (pass ? 0.95 : 0.3) * (live ? 1 : 0.35 + 0.65 * k);
      c.lineWidth = pass ? 1.4 : 4;
      c.beginPath();
      if (S.move === "chop") {
        var A = chopArc(g);
        /* straight up, round and down to his head */
        c.arc(A.cx, A.cy, A.r, -Math.PI * 0.5, -Math.PI * (0.5 + 0.5 * (live ? 1 : k)), true);
      } else {
        var x0 = g.dx - 10, x1 = g.ax - 8 + (1 - (live ? 1 : k)) * 22;
        c.moveTo(x0, g.waist); c.lineTo(x1, g.waist);
      }
      c.stroke();
    }
    /* and the blade sitting at the start of it while he winds up */
    if (!live) {
      var hx, hy;
      if (S.move === "chop") { var A2 = chopArc(g); hx = A2.cx; hy = A2.cy - A2.r; }
      else { hx = g.dx - 10; hy = g.waist; }
      c.globalAlpha = 0.5 + 0.5 * k;
      px(c, hx - 1, hy - 1, 3, 3, "#ffffff");
    }
    c.restore();
  }

  /* THE BLOW ITSELF — the same path, travelled */
  function paintBlow(c, g) {
    if (S.phase !== PH.blow && !(S.phase === PH.beat && S.pt < 0.2)) return;
    var u = S.phase === PH.blow ? clamp(S.winT / Math.max(0.1, S.winLen), 0, 1) : 1;
    c.save();
    if (S.move === "chop") {
      var A = chopArc(g);
      var a0 = -Math.PI * 0.5, a1 = -Math.PI;
      for (var i = 0; i < 6; i++) {
        var f = clamp(u - i * 0.055, 0, 1);
        var aa = a0 + (a1 - a0) * f;
        c.globalAlpha = i ? 0.75 - i * 0.1 : 1;
        px(c, A.cx + Math.cos(aa) * A.r, A.cy + Math.sin(aa) * A.r,
           i ? 2 : 4, i ? 2 : 4, i ? "#9fe4ff" : "#ffffff");
      }
    } else {
      var bx = (g.dx - 10) - u * (g.dx - g.ax - 2);
      for (var j = 0; j < 7; j++) {
        c.globalAlpha = j ? 0.7 - j * 0.08 : 1;
        px(c, bx + j * 6, g.waist - (j % 2), 6, j ? 2 : 3, j ? "#c9a0ff" : "#ffffff");
      }
    }
    c.restore();
  }

  /* the warm arc he takes it on, and the sparks off it */
  function paintGuard(c, g) {
    if (S.guard <= 0) return;
    var k = S.guard;
    c.save();
    c.globalAlpha = 0.85 * k;
    c.strokeStyle = "#ffd9a0"; c.lineWidth = 2;
    c.beginPath();
    c.arc(g.ax + 12, g.head + 4, 15 + (1 - k) * 4, -Math.PI * 0.85, Math.PI * 0.25);
    c.stroke();
    c.restore();
    for (var i = 0; i < 8; i++) {
      var an = -1.3 + i * 0.3, len = 6 + ((i * 7) % 11);
      c.save();
      c.globalAlpha = k * (0.4 + 0.6 * Math.random());
      px(c, g.ax + 14 + Math.cos(an) * len * (2 - k), g.head + 2 + Math.sin(an) * len * (2 - k), 2, 2,
         i % 2 ? "#fff3d0" : "#9fe4ff");
      c.restore();
    }
  }

  /* HIS HEALTH, AND HIS. Four warm hearts and six cold pips, because a
     number is a thing you read and a row of hearts is a thing you feel. */
  function paintHp(c) {
    if (!inFight() && S.phase !== PH.close) return;
    var i;
    for (i = 0; i < FIGHT.anwarHp; i++) {
      var hx = 8 + i * 9, hy = 8, on = i < S.ahp;
      c.save(); c.globalAlpha = on ? 1 : 0.28;
      px(c, hx + 1, hy, 2, 1, on ? "#ff7aa8" : "#4a3a4a");
      px(c, hx + 4, hy, 2, 1, on ? "#ff7aa8" : "#4a3a4a");
      px(c, hx, hy + 1, 7, 2, on ? "#ff5f95" : "#3a2c3a");
      px(c, hx + 1, hy + 3, 5, 1, on ? "#e04a7d" : "#33262f");
      px(c, hx + 2, hy + 4, 3, 1, on ? "#e04a7d" : "#33262f");
      px(c, hx + 3, hy + 5, 1, 1, on ? "#c43c68" : "#2b2028");
      if (on) px(c, hx + 1, hy + 1, 2, 1, "#ffc2d6");
      c.restore();
    }
    var bw = 5, gap = 2, total = FIGHT.deathHp * (bw + gap) - gap;
    for (i = 0; i < FIGHT.deathHp; i++) {
      var bx = VW - 8 - total + i * (bw + gap), lit = i < S.dhp;
      c.save();
      c.globalAlpha = lit ? 0.95 : 0.25;
      px(c, bx, 8, bw, 5, lit ? "#8fd8ff" : "#243046");
      if (lit) px(c, bx, 8, bw, 1, "#eaf9ff");
      c.restore();
    }
  }

  function paintDeathScene(c, t) {
    var D = SCRIPT.death;
    fitStage(c);

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
      /* the fight moves him: a wind-up, a swing, a stagger, a flinch */
      var dp = inFight() || S.phase === PH.win ? deathPose() : { dx: 0, dy: 0, rot: 0 };
      if (dp.rot) {
        var dpx = S.death.x + 14, dpy = dy + 26;
        c.translate(dpx, dpy); c.rotate(dp.rot); c.translate(-dpx, -dpy);
      }
      c.translate(dp.dx, dp.dy);
      if (S.swing !== undefined && S.phase >= 4 && S.phase <= PH.choice) {
        /* He LEANS into the strike; he does not topple. Pivot at the
           shoulder and keep the angle small — swung from the feet he read
           as a falling tree rather than a man bringing something down. */
        var pvx = S.death.x + 14, pvy = dy + 22;
        c.translate(pvx, pvy);
        c.rotate(-0.18 * (S.swing || 0));
        c.translate(-pvx, -pvy);
      }
      c.drawImage(d, Math.round(S.death.x), Math.round(dy));
      if (S.dact === "hurt" && S.dactT < 0.14) {
        c.save();
        c.globalCompositeOperation = "source-atop";
        c.globalAlpha = 0.8 * (1 - S.dactT / 0.14);
        c.fillStyle = "#ffffff";
        c.fillRect(S.death.x - 4, dy - 4, d.width + 8, d.height + 8);
        c.restore();
      }
      c.restore();

      /* THE OPENING. He is off balance and there is a pale place in the
         middle of him for a moment. It is the only time anything about
         him is bright, and it is the whole invitation. */
      if (S.phase === PH.open) {
        var ok = 1 - clamp(S.openT / Math.max(0.1, S.openLen), 0, 1);
        var ocx = S.death.x + 14 + (deathPose().dx || 0), ocy = dy + 26;
        c.save();
        c.globalAlpha = 0.30 + 0.45 * Math.abs(Math.sin(t * 12));
        var og = c.createRadialGradient(ocx, ocy, 1, ocx, ocy, 16 + 6 * ok);
        og.addColorStop(0, "rgba(255,255,255,0.95)");
        og.addColorStop(0.45, "rgba(255,214,150,0.5)");
        og.addColorStop(1, "rgba(255,176,110,0)");
        c.fillStyle = og;
        c.fillRect(ocx - 26, ocy - 26, 52, 52);
        c.restore();
      }

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
    var ap = (inFight() || S.phase === PH.close) ? anwarPose() : { dx: 0, dy: 0, rot: 0, sy: 1, ghost: 0 };
    var geo = fightGeom(groundY);
    /* the telegraph goes UNDER him, so he is never hidden by it */
    paintTell(c, geo);
    /* where he was, a moment ago — this is the part that says he moved */
    if (ap.ghost > 0) {
      c.save(); c.globalAlpha = 0.30 * ap.ghost;
      c.drawImage(a, ax, ay); c.restore();
    }
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
    c.save();
    if (ap.rot || ap.sy !== 1) {
      var apx = ax + 13, apy = ay + a.height;
      c.translate(apx, apy); c.rotate(ap.rot); c.scale(1, ap.sy); c.translate(-apx, -apy);
    }
    c.translate(ap.dx, ap.dy);
    c.drawImage(a, ax, ay);
    if (S.act === "hurt" && S.actT < 0.14) {
      c.save();
      c.globalCompositeOperation = "source-atop";
      c.globalAlpha = 0.75 * (1 - S.actT / 0.14);
      c.fillStyle = "#ff4f6f";
      c.fillRect(ax - 4, ay - 4, a.width + 8, a.height + 8);
      c.restore();
    }
    c.restore();

    /* the blade on its way, the arc he took it on, and the score */
    paintBlow(c, geo);
    paintGuard(c, geo);
    paintHp(c);
    /* one red frame across the whole scene when it is HER four that just
       went down by one */
    if (S.hurtFlash > 0) {
      c.save(); c.globalAlpha = 0.34 * S.hurtFlash;
      px(c, 0, 0, VW, VH, "#c31f3f"); c.restore();
    }

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

    if (S.phase === PH.choice) {
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
    MUS.tick();
    /* THE HIT STOP. Every fighting game does this and it is most of why
       a blow feels like it weighed something: on an impact the whole
       scene holds for a few hundredths of a second, still drawing, doing
       nothing. Take it out and the same animation reads as a slide. */
    if (S.freeze > 0) { S.freeze -= dt; if (S.shake > 0) S.shake = Math.max(0, S.shake - dt * 8); return; }
    S.t += dt;
    if (S.actT !== undefined) S.actT += dt;
    if (S.dactT !== undefined) S.dactT += dt;
    if (S.hurtFlash > 0) S.hurtFlash = Math.max(0, S.hurtFlash - dt * 2.2);
    /* THE WHITE FRAME FADES BY ITSELF. It used to be wound down inside the
       two phases that raised it, which was fine while they were the only
       two — and the moment a third raised it, the scene stayed white for
       the rest of the fight with everything behind it washed out. */
    if (S.flash > 0) S.flash = Math.max(0, S.flash - dt * 3);
    if (S.anwarTo !== null && S.anwarTo !== undefined) {
      var gap = S.anwarTo - S.anwar.x;
      if (Math.abs(gap) < 0.6) { S.anwar.x = S.anwarTo; S.anwarTo = null; }
      else S.anwar.x += gap * Math.min(1, dt * 4.5);
    }
    if (S.guard > 0) S.guard = Math.max(0, S.guard - dt * 2.4);
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
      if (S.phase === PH.choice) {               // the choice
        if (name === "left" || name === "right") {
          S.sel = S.sel ? 0 : 1;
          sfx("pick");
        } else if (confirm) {
          S.outcome = S.sel === 0 ? "fight" : "letgo";
          sfx("choose");
          hideChoice();
          /* SCRIPT.death, not D: D is a local in the step function and does
             not exist here. */
          if (S.outcome === "fight") { say(SCRIPT.death.tutorial); phase(PH.tut); }
          else { say(SCRIPT.death.letgo); phase(PH.lgSay); }
        }
        return;
      }

      /* THE FIGHT. Three answers, and the keys are the ones the platformer
         has been using all game: down is a guard, sideways is a step out
         of the way, and the jump key is the one that hits back. The three
         buttons on the screen say the same thing in words. */
      if (inFight()) {
        if (S.phase === PH.down) { getUpPress(); return; }
        if (name === "down") return action("block");
        if (name === "left" || name === "right") return action("dodge");
        if (name === "jump" || name === "confirm") return action("strike");
        return;
      }
      /* the letter closes on any press once it has finished writing itself */
      if (S.phase === PH.letter) { if (S.letterShown >= letterChars()) S.done = true; else S.letterShown = letterChars(); return; }

      if (S.lines && confirm) { pressText(); }
      return;
    }
  }

  /* One door for all three answers, so a thumb on the screen and a finger
     on the keyboard go through exactly the same code. */
  function action(kind) {
    if (!S || S.kind !== "death") return;
    if (S.phase === PH.blow) { answer(kind); return; }
    if (S.phase === PH.open) { if (kind === "strike") strikeNow(); else padVerdict("strike", kind, false); return; }
    if (S.phase === PH.down) { getUpPress(); return; }
  }

  function done() {
    var d = !S || S.done;
    if (d) { hideLine(); hideChoice(); hideCue(); hideLetter(); showPad(null); MUS.stop(); }
    return d;
  }
  function outcome() { return S ? S.outcome : null; }
  function active() { return !!S && !S.done; }

  return {
    begin: begin, step: step, paint: paint, press: press,
    done: done, outcome: outcome, active: active,
    /* for the offline harness */
    _state: function () { return S; },
    _mus: function () { return MUS.playing(); },
    _fight: function () { return FIGHT; },
    _moves: function () { return MOVES; },
    _cast: function () { bakeCast(); return CAST; },
    _script: SCRIPT,
  };
})();
