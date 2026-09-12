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
      /* WHAT THEY SAY WHILE IT IS HAPPENING. Four words, over their
         heads, gone before she has finished reading them — this is where
         the scene's temper lives, and none of it stops the fight. Each
         one lands once. */
      barks: {
        parried:  ["Still fast.", "...hm.", "You remember this."],
        landed:   ["Stay down.", "You are slower.", "It is only time."],
        nearly:   ["Anwar—", "Please—", "Get UP!"],
        lastband: ["Enough of this.", "No more talking.", "Then I stop being careful."],
        grabbed:  ["ANWAR!", "No—", "Let him GO!"],
        down:     ["ANWAR!!", "No no no—", "Get up. Get UP."],
        up:       ["Not yet.", "I'm not done.", "Still here."],
      },
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
    down: 14, win: 15, warm: 16, held: 17, final: 18,
    lgSay: 20, lgWarm: 21, letter: 22,
  };

  var FIGHT = {
    anwarHp: 4,
    deathHp: 8,                      // how many times he has to be hit
    parry: 0.20,                     // answering inside this is a parry
    resolve: 3,                      // clean answers in a row for a big one
    /* by how much of him is left. `chain` is the most attacks he will run
       together before the opening, `grab` how often he reaches instead. */
    bands: [
      { above: 6, tell: 0.70, window: 0.95, open: 1.15, rest: 0.85, chain: 1, grab: 0 },
      { above: 3, tell: 0.58, window: 0.82, open: 0.95, rest: 0.62, chain: 2, grab: 0.22 },
      { above: 0, tell: 0.48, window: 0.70, open: 0.82, rest: 0.46, chain: 3, grab: 0.30 },
    ],
    hitStop: 0.09,                   // the frame everything stops on an impact
    getUp: { presses: 6, time: 3.4 },
    grab:  { presses: 7, time: 2.6 },
  };

  /* The three attacks, and the answer to each. The colour is the colour
     its telegraph is drawn in, so the shape and the colour say the same
     thing twice — which is what makes a fast tell readable.

     The grab is red and it cannot be blocked. That is the only rule in
     the fight with an exception in it, and it earns the exception: two
     attacks is a fight learned in twenty seconds, and a third that
     punishes the safe answer is what stops BLOCK being a shrug. */
  var MOVES = {
    chop:  { need: "block", label: "BLOCK", colour: "#9fe4ff", say: "over his head" },
    sweep: { need: "dodge", label: "DODGE", colour: "#c9a0ff", say: "back at his hip" },
    grab:  { need: "dodge", label: "DODGE!", colour: "#ff6b6b", unblockable: true, say: "both hands open" },
  };
  function band() {
    var B = FIGHT.bands, i;
    for (i = 0; i < B.length; i++) if (S.dhp > B[i].above) return B[i];
    return B[B.length - 1];
  }
  /* Which attack next. A bag rather than a die, so she never gets the same
     one five times running and never has to guess — and the first two are
     always one of each, because the first two are where she learns them. */
  function nextMove() {
    if (S.moveSeen < 2) return S.moveSeen === 0 ? "chop" : "sweep";
    /* the grab only once she has met both of the others, and only from
       the band where he stops being careful */
    if (S.moveSeen >= 4 && Math.random() < (band().grab || 0)) return "grab";
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

     Written for this scene and nothing else, out of the same Web Audio
     context the rest of the site uses: no file, nothing to load, nothing
     to wait for.

     WHAT IT IS TRYING TO SOUND LIKE. Two things at once. The shape is the
     big cinematic one — an ostinato that will not stop, low brass that
     arrives like weather, taiko under the turns, a clock ticking through
     the talking. And the voice on top of it is still this game's: the
     same square-wave lead that has been playing since the first world.

     AND THE THEME IS HERS. The game's own tune opens on a major arpeggio
     — root, third, fifth. The fight plays that exact figure with the
     third flattened, which is the same melody with the light taken out of
     it, and nobody has to be told that to feel it. When he gets up off
     the floor it comes back with the third put back, and that is the
     whole score in one move.

     HOW IT RUNS. One sequencer at sixteenths, driven from step() rather
     than a timer of its own — a timer in a background tab is throttled to
     nothing and the tune would scatter. Notes are scheduled a fifth of a
     second ahead of the clock and never behind it. Thirteen movements,
     and the scene changes them; none of them loops under a beat it has
     already finished.
     ======================================================================= */
  var MUS = (function () {
    var on = false, name = "", step = 0, nextT = 0, bpm = 120, noiseBuf = null;
    var droneOsc = null, droneGain = null, master = null, REG = false;

    function ctx() {
      try {
        var AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        var ac = window.__soAudio || (window.__soAudio = new AC());
        if (!REG && window.registerAudio) {
          REG = true;
          try { window.registerAudio(function () { return window.__soAudio; }); } catch (e) {}
        }
        if (window.audioAsleep && window.audioAsleep()) return null;
        if (ac.state === "suspended") ac.resume();
        return ac;
      } catch (e) { return null; }
    }
    function bus(ac) {
      if (master && master.ac === ac) return master.g;
      var g = ac.createGain();
      g.gain.value = 0.0001;
      g.connect(ac.destination);
      master = { ac: ac, g: g };
      return g;
    }
    function fade(ac, to, secs) {
      var g = bus(ac), t = ac.currentTime;
      g.gain.cancelScheduledValues(t);
      g.gain.setValueAtTime(Math.max(0.0001, g.gain.value), t);
      g.gain.exponentialRampToValueAtTime(Math.max(0.0001, to), t + (secs || 0.4));
    }
    function hz(n) { return 440 * Math.pow(2, (n - 69) / 12); }
    function noise(ac) {
      if (!noiseBuf || noiseBuf.sampleRate !== ac.sampleRate) {
        noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
        var d = noiseBuf.getChannelData(0);
        for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      }
      return noiseBuf;
    }

    /* ---- the instruments -------------------------------------------- */

    /* the floor of the whole thing: a sine low enough to be felt rather
       than heard, which is what every one of these scores is built on */
    function sub(ac, t, note, dur, vol) {
      var o = ac.createOscillator(), g = ac.createGain();
      o.type = "sine"; o.frequency.setValueAtTime(hz(note), t);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + 0.03);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(bus(ac));
      o.start(t); o.stop(t + dur + 0.05);
    }
    /* BRASS. Three saws a hair apart through a filter that opens as the
       note lands — the swell is the filter, not the volume, which is why
       it reads as brass rather than as a synth getting louder. */
    function brass(ac, t, note, dur, vol, bite) {
      var f = ac.createBiquadFilter(), g = ac.createGain(), i, o;
      f.type = "lowpass";
      f.frequency.setValueAtTime(180, t);
      f.frequency.linearRampToValueAtTime(hz(note) * (bite || 6), t + Math.min(0.5, dur * 0.5));
      f.frequency.linearRampToValueAtTime(240, t + dur);
      f.Q.value = 3;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + 0.06);
      g.gain.setValueAtTime(vol, t + dur * 0.6);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      for (i = 0; i < 3; i++) {
        o = ac.createOscillator();
        o.type = "sawtooth";
        o.frequency.value = hz(note) * (1 + (i - 1) * 0.006);
        o.connect(f);
        o.start(t); o.stop(t + dur + 0.05);
      }
      f.connect(g); g.connect(bus(ac));
    }
    /* CHOIR. Detuned triangles, slow on, slow off, with a little movement
       in them so they are not a pad sitting still. */
    function choir(ac, t, note, dur, vol) {
      var g = ac.createGain(), lfo = ac.createOscillator(), lg = ac.createGain(), i, o;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + Math.min(0.7, dur * 0.4));
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      lfo.type = "sine"; lfo.frequency.value = 4.6;
      lg.gain.value = 1.6;
      lfo.connect(lg);
      for (i = 0; i < 2; i++) {
        o = ac.createOscillator();
        o.type = "triangle";
        o.frequency.value = hz(note) * (i ? 1.004 : 0.997);
        lg.connect(o.frequency);
        o.connect(g);
        o.start(t); o.stop(t + dur + 0.06);
      }
      lfo.start(t); lfo.stop(t + dur + 0.06);
      g.connect(bus(ac));
    }
    /* TAIKO. A pitched thump with a skin on it: sine for the body, a
       short burst of noise for the stick. */
    function taiko(ac, t, vol, big) {
      var o = ac.createOscillator(), g = ac.createGain();
      o.type = "sine";
      o.frequency.setValueAtTime(big ? 132 : 104, t);
      o.frequency.exponentialRampToValueAtTime(big ? 30 : 42, t + (big ? 0.34 : 0.18));
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0001, t + (big ? 0.5 : 0.24));
      o.connect(g); g.connect(bus(ac));
      o.start(t); o.stop(t + (big ? 0.55 : 0.3));
      var s = ac.createBufferSource(), bf = ac.createBiquadFilter(), ng = ac.createGain();
      s.buffer = noise(ac);
      bf.type = "bandpass"; bf.frequency.value = big ? 900 : 1500; bf.Q.value = 0.8;
      ng.gain.setValueAtTime(vol * 0.5, t);
      ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
      s.connect(bf); bf.connect(ng); ng.connect(bus(ac));
      s.start(t); s.stop(t + 0.1);
    }
    /* A HEART. The taiko with the stick taken off it: the body of the
       drum and none of the snap, which is the difference between
       something being struck and something beating. */
    function heart(ac, t, vol) {
      var o = ac.createOscillator(), g = ac.createGain(), f = ac.createBiquadFilter();
      o.type = "sine";
      o.frequency.setValueAtTime(88, t);
      o.frequency.exponentialRampToValueAtTime(34, t + 0.3);
      f.type = "lowpass"; f.frequency.value = 220;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + 0.05);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.42);
      o.connect(f); f.connect(g); g.connect(bus(ac));
      o.start(t); o.stop(t + 0.5);
    }

    /* the clock: a click with no pitch to speak of */
    function tick(ac, t, vol, hi) {
      var s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
      s.buffer = noise(ac);
      f.type = "highpass"; f.frequency.value = hi ? 7000 : 3400;
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.035);
      s.connect(f); f.connect(g); g.connect(bus(ac));
      s.start(t); s.stop(t + 0.05);
    }
    /* THE GAME'S OWN VOICE. Square, plain, no filter — this is the sound
       the first world was written in and it is the reason the scene still
       belongs to the same game. */
    function lead(ac, t, note, dur, vol, type) {
      var o = ac.createOscillator(), g = ac.createGain();
      o.type = type || "square"; o.frequency.setValueAtTime(hz(note), t);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(bus(ac));
      o.start(t); o.stop(t + dur + 0.03);
    }
    /* a riser: noise through a filter climbing, which is the oldest
       tension trick there is and still the best one */
    function riser(ac, t, dur, vol) {
      var s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
      s.buffer = noise(ac);
      f.type = "bandpass"; f.Q.value = 6;
      f.frequency.setValueAtTime(300, t);
      f.frequency.exponentialRampToValueAtTime(5200, t + dur);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + dur * 0.85);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.12);
      s.connect(f); f.connect(g); g.connect(bus(ac));
      s.start(t); s.stop(t + dur + 0.2);
    }
    function drone(ac, note, vol) {
      stopDrone();
      var o = ac.createOscillator(), o2 = ac.createOscillator(), g = ac.createGain();
      o.type = "sine"; o.frequency.value = hz(note);
      o2.type = "sine"; o2.frequency.value = hz(note) * 1.004;
      g.gain.setValueAtTime(0.0001, ac.currentTime);
      g.gain.exponentialRampToValueAtTime(vol, ac.currentTime + 1.4);
      o.connect(g); o2.connect(g); g.connect(bus(ac));
      o.start(); o2.start();
      droneOsc = [o, o2]; droneGain = g;
    }
    function stopDrone() {
      try {
        if (droneGain && master) {
          var ac = master.ac, t = ac.currentTime, oscs = droneOsc;
          droneGain.gain.cancelScheduledValues(t);
          droneGain.gain.setValueAtTime(Math.max(0.0001, droneGain.gain.value), t);
          droneGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
          setTimeout(function () { try { oscs.forEach(function (o) { o.stop(); }); } catch (e) {} }, 1000);
        }
      } catch (e) {}
      droneOsc = null; droneGain = null;
    }

    /* ---- the themes -------------------------------------------------
       A is the root of everything here. HERS is the game's own opening
       figure — root, third, fifth, third — and HIS is the same four notes
       with the third flattened. They are the same melody. That is the
       point of them. */
    var A = 45;                                   // A2
    var HERS = [12, 16, 19, 16, 12, 19, 24, 19];  // major
    var HIS  = [12, 15, 19, 15, 12, 19, 22, 19];  // and the light taken out
    /* what the bass walks under it, by bar */
    var WALK = [0, 0, 5, 7, 0, 3, 5, 7];
    /* three notes falling, low and slow: the thing that arrives */
    var DEATHMOTIF = [0, -1, -6];

    function chordOf(bar) {
      var roots = [0, 5, 7, 3];
      return roots[bar % roots.length];
    }

    /* ---- the movements ---------------------------------------------- */
    var SECT = {
      /* THE TEMPERATURE DROPS. A heart, and nothing else — and it is a
         heart rather than a drum: low, soft, two beats and a long gap,
         with no click on it at all. The tick was taken out of here on
         purpose; a clock belongs to a room where somebody is waiting,
         not to one where something is arriving. */
      cold: { bpm: 56, drone: A - 12, droneVol: 0.05, vol: 0.75, emit: function (ac, i, t) {
        var s = i & 15, bar = (i >> 4) & 3;
        if (s === 0) heart(ac, t, 0.075);
        if (s === 3) heart(ac, t, 0.042);
        if (bar === 1 && s === 8) choir(ac, t, A + 12, 3.2, 0.018);
        if (bar === 3 && s === 12) riser(ac, t, 1.6, 0.04);
      } },
      /* and it walks in */
      enter: { bpm: 56, drone: A - 24, droneVol: 0.06, vol: 0.95, emit: function (ac, i, t) {
        if (i === 0 || i === 12) taiko(ac, t, 0.16, true);
        if (i === 24) { taiko(ac, t, 0.2, true); brass(ac, t, A - 12 + DEATHMOTIF[0], 2.6, 0.075, 5); }
        if (i === 32) brass(ac, t, A - 12 + DEATHMOTIF[1], 2.2, 0.06, 4);
        if (i === 44) brass(ac, t, A - 24 + DEATHMOTIF[2], 3.4, 0.08, 3);
        if (i % 16 === 0 && i > 44) sub(ac, t, A - 24, 1.8, 0.05);
      } },
      /* THE CONVERSATION.

         There is no percussion in this movement at all. It had a clock in
         it and a drum under the clock, and the two of them together are
         the sound of a menu rather than the sound of two people deciding
         what happens to her: it ticked along politely while Death was
         explaining that he had come to take her.

         What is here instead is weather. A chord that changes under the
         talking and takes four bars to do it, a breath of choir over the
         top of it, one low brass note at the head of every phrase, and a
         single cold bell at the end of it — five voices, none of them
         hit, none of them in a hurry. It is the same key the fight is in,
         so when the fight starts it is the room getting louder rather
         than a different piece of music beginning. */
      meet: { bpm: 60, drone: A - 12, droneVol: 0.04, vol: 0.85, emit: function (ac, i, t) {
        var s = i & 15, bar = (i >> 4) & 7, ch = chordOf(bar >> 1);
        /* the chord, changing every two bars and swelling as it comes */
        if (s === 0 && bar % 2 === 0) {
          choir(ac, t, A + 12 + ch, 6.2, 0.03);
          choir(ac, t, A + 12 + ch + (ch === 0 || ch === 5 ? 3 : 4), 6.2, 0.018);
          sub(ac, t, A - 12 + ch, 5.6, 0.05);
        }
        /* one low brass note at the head of each phrase — a long way off */
        if (s === 0 && bar % 4 === 0) brass(ac, t, A - 24 + ch, 4.2, 0.035, 2.2);
        /* and a bell at the end of it, cold and alone */
        if (bar === 3 && s === 8) lead(ac, t, A + 36, 2.4, 0.012, "triangle");
        if (bar === 7 && s === 8) lead(ac, t, A + 31, 2.8, 0.012, "triangle");
      } },
      /* the fight, and it grows a layer with every band of his health */
      f1: { bpm: 122, vol: 0.95, emit: function (ac, i, t) {
        var s = i & 15, bar = (i >> 4) & 7, root = A + WALK[bar];
        if (s % 4 === 0) taiko(ac, t, s === 0 ? 0.12 : 0.075);
        if (s % 2 === 0) sub(ac, t, root - 12, 0.16, 0.05);
        if (s % 4 === 2) tick(ac, t, 0.016, true);
        if (bar % 2 === 1 && s % 2 === 0) lead(ac, t, A + HIS[(s >> 1) & 7], 0.18, 0.018);
      } },
      f2: { bpm: 136, vol: 1, emit: function (ac, i, t) {
        var s = i & 15, bar = (i >> 4) & 7, root = A + WALK[bar];
        if (s % 4 === 0) taiko(ac, t, s === 0 ? 0.13 : 0.085);
        if (s % 2 === 0) sub(ac, t, root - 12, 0.15, 0.055);
        if (s % 2 === 1) tick(ac, t, 0.013, true);
        if (s === 6 || s === 14) brass(ac, t, root - 12, 0.3, 0.045, 5);
        if (s % 2 === 0) lead(ac, t, A + HIS[(s >> 1) & 7], 0.16, 0.02);
        if (bar % 4 === 3 && s === 14) riser(ac, t, 0.7, 0.04);
      } },
      f3: { bpm: 150, vol: 1.05, emit: function (ac, i, t) {
        var s = i & 15, bar = (i >> 4) & 7, root = A + WALK[bar];
        if (s % 2 === 0) taiko(ac, t, s === 0 ? 0.14 : 0.08, s === 0);
        if (s % 2 === 0) sub(ac, t, root - 12, 0.13, 0.06);
        tick(ac, t, 0.01, true);
        if (s % 4 === 0) brass(ac, t, root - 12, 0.26, 0.05, 6);
        if (s % 2 === 0) lead(ac, t, A + HIS[(s >> 1) & 7], 0.15, 0.024);
        if (s === 0 && bar % 2 === 0) choir(ac, t, A + 12 + HIS[bar & 7], 1.4, 0.026);
        if (s === 13) riser(ac, t, 0.4, 0.03);
      } },
      /* held. No downbeat at all — nothing to hold on to, which is the
         point of it. */
      grabbed: { bpm: 168, vol: 1, emit: function (ac, i, t) {
        var s = i & 15;
        tick(ac, t, 0.02, true);
        if (s % 2 === 0) brass(ac, t, A - 12 + (s % 4 ? 1 : 0), 0.12, 0.04, 7);
        if (s % 8 === 0) sub(ac, t, A - 24, 0.5, 0.07);
      } },
      /* on one knee, and everything else gone */
      down: { bpm: 50, drone: A - 24, droneVol: 0.03, vol: 0.85, emit: function (ac, i, t) {
        var s = i & 15, bar = (i >> 4) & 3;
        if (s === 0) heart(ac, t, 0.10);
        if (s === 4) heart(ac, t, 0.05);
        /* her tune, alone, played slowly by the little square wave that
           has been with her since the first world */
        if (s % 8 === 0) lead(ac, t, A + 12 + HERS[((i >> 3) + bar) & 7], 0.7, 0.02, "triangle");
      } },
      /* he gets up. The third goes back in. */
      rise: { bpm: 132, vol: 1.1, emit: function (ac, i, t) {
        var s = i & 15, bar = (i >> 4) & 3;
        if (i < 8) { taiko(ac, t, 0.06 + i * 0.012, false); return; }   // the roll in
        if (s % 4 === 0) taiko(ac, t, s === 0 ? 0.15 : 0.09, s === 0);
        if (s % 2 === 0) sub(ac, t, A - 12, 0.16, 0.06);
        if (s % 2 === 0) lead(ac, t, A + 12 + HERS[(s >> 1) & 7], 0.18, 0.028);
        if (s === 0) { brass(ac, t, A - 12 + chordOf(bar), 1.1, 0.07, 6); choir(ac, t, A + 12 + chordOf(bar), 1.6, 0.03); }
      } },
      /* the last blow: one enormous thing, and then the room */
      final: { bpm: 60, vol: 1.15, emit: function (ac, i, t) {
        if (i === 0) { taiko(ac, t, 0.24, true); brass(ac, t, A - 24, 3.2, 0.09, 3); sub(ac, t, A - 24, 3.4, 0.08); }
        if (i === 8) choir(ac, t, A + 12, 3.0, 0.03);
      } },
      /* he wins, and it is allowed to be warm */
      win: { bpm: 66, vol: 0.9, emit: function (ac, i, t) {
        var s = i & 15, bar = (i >> 4) & 3;
        if (s === 0) { choir(ac, t, A + chordOf(bar), 2.6, 0.03); sub(ac, t, A - 12 + chordOf(bar), 2.2, 0.05); }
        if (s === 0) brass(ac, t, A + 12 + chordOf(bar), 1.6, 0.035, 4);
        if (s % 4 === 0) lead(ac, t, A + 24 + HERS[((i >> 2) + bar) & 7], 0.5, 0.022, "triangle");
      } },
      /* and if he does not */
      lost: { bpm: 52, drone: A - 24, droneVol: 0.035, vol: 0.8, emit: function (ac, i, t) {
        var s = i & 15, bar = (i >> 4) & 3;
        if (s === 0) brass(ac, t, A - 12 - bar, 2.6, 0.045, 3);
        if (s === 8) tick(ac, t, 0.015);
        if (s === 0 && bar === 3) choir(ac, t, A + 3, 3.0, 0.022);
      } },
      /* the letter */
      letter: { bpm: 62, vol: 0.8, emit: function (ac, i, t) {
        var s = i & 15, bar = (i >> 4) & 3;
        if (s === 0) choir(ac, t, A + 12 + chordOf(bar), 3.0, 0.026);
        if (s % 4 === 0) lead(ac, t, A + 24 + HERS[(i >> 2) & 7], 0.6, 0.016, "triangle");
        if (s === 0) sub(ac, t, A - 12 + chordOf(bar), 2.4, 0.04);
      } },
    };

    /* one-off accents the fight fires by hand, over whatever is playing */
    var STING = {
      parry: function (ac, t) {
        lead(ac, t, A + 36, 0.09, 0.05, "square");
        lead(ac, t + 0.06, A + 40, 0.12, 0.045, "square");
        tick(ac, t, 0.05, true);
      },
      hit: function (ac, t) { taiko(ac, t, 0.16, true); brass(ac, t, A - 24, 0.5, 0.05, 4); },
      taken: function (ac, t) { taiko(ac, t, 0.14, true); brass(ac, t, A - 25, 0.7, 0.055, 2); },
      full: function (ac, t) {
        lead(ac, t, A + 24, 0.1, 0.04); lead(ac, t + 0.07, A + 28, 0.1, 0.04);
        lead(ac, t + 0.14, A + 31, 0.22, 0.045);
      },
    };

    return {
      play: function (which) {
        if (name === which && on) return;
        var S2 = SECT[which]; if (!S2) return;
        var ac = ctx();
        name = which; on = true; step = 0; nextT = 0; bpm = S2.bpm;
        if (!ac) return;
        fade(ac, S2.vol || 0.9, 0.45);
        if (S2.drone) drone(ac, S2.drone, S2.droneVol || 0.04);
        else stopDrone();
      },
      /* an accent, now, without disturbing the movement underneath */
      sting: function (which) {
        var f = STING[which]; if (!f) return;
        var ac = ctx(); if (!ac) return;
        try { f(ac, ac.currentTime + 0.01); } catch (e) {}
      },
      tick: function () {
        if (!on) return;
        var S2 = SECT[name]; if (!S2) return;
        var ac = ctx(); if (!ac) return;
        var now = ac.currentTime, spb = 60 / bpm / 4, guard = 0;
        if (!nextT || nextT < now - 0.4) nextT = now + 0.05;
        while (nextT < now + 0.2 && guard++ < 40) {
          try { S2.emit(ac, step, nextT); } catch (e) {}
          step++; nextT += spb;
        }
      },
      stop: function () {
        if (!on) return;
        on = false; name = "";
        stopDrone();
        try { var ac = window.__soAudio; if (ac && master && master.ac === ac) fade(ac, 0.0001, 0.4); } catch (e) {}
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
  function paintDeath(k, noBlade) {
    var map = DEATH_MAP.slice();
    if (k === 1) {
      /* the hem stirs, one row, one pixel */
      map[map.length - 8] = map[map.length - 8].replace("ccccc", "cccc.");
    }
    /* WITHOUT IT. On the last blow the scythe leaves his hands and is
       drawn flying — and he was still holding one while it did, because
       the blade is part of his sprite. This is the same sprite with the
       shaft and the edge taken out of it. */
    if (noBlade) map = map.map(function (row) { return row.replace(/[sSh]/g, "."); });
    return paintMap(map, DEATH_PAL, 40);
  }

  var CAST = null;
  function bakeCast() {
    if (CAST) return;
    CAST = {
      anwar: [paintAnwar(0), paintAnwar(1)],
      death: [paintDeath(0), paintDeath(1)],
      deathBare: [paintDeath(0, true), paintDeath(1, true)],
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
    html += '<button type="button" class="rs-key rs-key-break" data-rs="break"><b>BREAK FREE</b><i>hit it</i></button>';
    pad.innerHTML = html;
    stage.appendChild(pad);
    Array.prototype.forEach.call(pad.querySelectorAll("[data-rs]"), function (b) {
      var k = b.getAttribute("data-rs");
      /* pointerdown, not click: a window of two thirds of a second cannot
         wait for a click to settle */
      b.addEventListener("pointerdown", function (e) {
        e.preventDefault(); e.stopPropagation();
        if (k === "up") getUpPress();
        else if (k === "break") breakPress();
        else action(k);
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
    if (!mode) padClear();
  }

  /* THE PLATFORMER'S PAD IS GONE FOR THE WHOLE SCENE, not only for the
     fight. It used to stand down when the three buttons came up, which
     left a d-pad and a jump button sitting under the conversation —
     controls for a game that is not running, in a scene where the only
     thing to press is the arrow on the dialogue panel itself. */
  function hideGamePad(on) {
    var screen = document.getElementById("screen-ouissy");
    if (screen) screen.classList.toggle("so-fighting", !!on);
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

  /* A BARK is not a line of dialogue and must never be built like one: it
     does not wait, it cannot be answered, and it is over before she has
     finished reading it. Its own small panel, in the speaker's colour,
     which fades itself out. */
  function barkBox() {
    var el = $d("rs-bark");
    if (el) return el;
    var stage = document.getElementById("so-stage");
    if (!stage) return null;
    el = document.createElement("div");
    el.id = "rs-bark"; el.className = "rs-bark"; el.hidden = true;
    stage.appendChild(el);
    return el;
  }
  function showBark(who, text) {
    var el = barkBox(); if (!el) return;
    el.hidden = false;
    el.textContent = text;
    /* restart the fade: a class alone would not, because the class is
       already on it */
    el.className = "rs-bark";
    void el.offsetWidth;
    el.className = "rs-bark on rs-bark-" + (SPEAKER[who] ? who : "anwar");
    clearTimeout(showBark.t);
    showBark.t = setTimeout(function () { hideBark(); }, 1700);
  }
  function hideBark() {
    var el = $d("rs-bark"); if (!el) return;
    el.className = "rs-bark"; el.hidden = true;
    clearTimeout(showBark.t);
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
        /* the three wind-ups, so the attack can be answered by ear: a
           scrape up for the one that comes down, a drag along the floor
           for the one that comes across, and a held breath for the one
           that cannot be blocked */
        windHigh:{type: "sawtooth", f: 300,  to: 1100, d: .30, v: .045 },
        windLow: {type: "sawtooth", f: 260,  to: 90,   d: .34, v: .05 },
        windGrab:{type: "sine",     f: 70,   to: 190,  d: .40, v: .07 },
        parry:  { type: "square",   f: 2400, to: 900,  d: .26, v: .09 },
        grab:   { type: "sawtooth", f: 160,  to: 40,   d: .40, v: .09 },
        final:  { type: "square",   f: 160,  to: 34,   d: .9,  v: .11 },
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
      heldT: 0, heldN: 0, resolve: 0, parries: 0, parried: false, said: {},
      slow: 0, finT: 0, realDt: 0, camPunch: 0, camZ: 1, camX: 0, riseT: null,
      bladeFly: null,
    };
    if (kind === "rescue") {
      say(SCRIPT.rescueAlt[nextRescueLine()]);
    } else {
      showPad(null);
      MUS.play("cold");
    }
    hideGamePad(true);
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
      /* HE DOES NOT WAIT POLITELY. He drifts in and sways while she gets
         her breath — dead air between attacks is where a fight stops
         being one. */
      if (S.anwarTo === null || S.anwarTo === undefined)
        S.death.x -= dt * 3 * (S.death.x - (S.anwar.x + 46) > 0 ? 1 : -1);
      /* and when he has just been stood back up, her tune plays over the
         top of the fight for as long as the moment lasts */
      if (S.riseT !== undefined && S.riseT !== null) {
        S.riseT += dt;
        if (S.riseT > 7.2) { S.riseT = null; MUS.play(fightTune()); }
      }
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

    } else if (S.phase === PH.held) {             /* in his hand */
      S.heldT += dt;
      showCue("BREAK FREE", 1 - S.heldT / FIGHT.grab.time);
      if (S.heldT > FIGHT.grab.time) {
        /* he does not get loose. Thrown, and it costs the same as any
           other blow that lands — but it is the one that looks like it
           cost something. */
        hideCue(); showPad("fight");
        MUS.play(fightTune());
        S.dact = "throw"; S.dactT = 0;
        hurtAnwar();
        S.shake = 20; S.camPunch = -1.3;
        if (S.ahp <= 0) { goDown(); return; }
        S.restLen = band().rest; phase(PH.rest);
      }

    } else if (S.phase === PH.final) {            /* the last blow */
      /* real seconds, not slowed ones: the slow motion is what this beat
         IS, so a clock made of slowed time would never reach the end of
         it */
      S.finT += (S.realDt || dt);
      S.slow = Math.max(0, 1 - S.finT / 2.6);
      if (S.bladeFly) {
        var bf = S.bladeFly;
        bf.x += bf.vx * dt; bf.y += bf.vy * dt; bf.vy += 240 * dt; bf.r += dt * 7;
        if (bf.y > S.her.y + 16) { bf.y = S.her.y + 16; bf.vy = 0; bf.vx = 0; bf.stuck = 1; }
      }
      S.chill = Math.max(0, S.chill - dt * 0.3);
      if (S.finT > 3.4) {
        S.slow = 0;
        MUS.play("win");
        say(SCRIPT.death.win);
        phase(PH.win);
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
    S.resolve = 0; S.parries = 0; S.said = {};
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
  var FIGHTING = [PH.rest, PH.tell, PH.blow, PH.beat, PH.open, PH.down, PH.held];
  function inFight() {
    return !!S && S.kind === "death" && FIGHTING.indexOf(S.phase) >= 0;
  }
  /* which movement of the score belongs to the state he is in */
  function fightTune() {
    var b = band();
    return b === FIGHT.bands[2] ? "f3" : b === FIGHT.bands[1] ? "f2" : "f1";
  }

  /* A BARK. Four words over somebody's head, gone in a second and a half,
     and it never stops the fight to be read — which is the whole
     difference between a bark and a line of dialogue. They land on the
     beats that earn them and each one is said once. */
  function bark(who, key) {
    var pool = SCRIPT.death.barks[key];
    if (!pool || S.said[key]) return;
    S.said[key] = true;
    showBark(who, pool[(Math.random() * pool.length) | 0]);
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
    /* EACH ATTACK SOUNDS LIKE ITSELF. A scrape up for the one that comes
       down, a drag along the floor for the one that comes across, and a
       held breath for the one that cannot be blocked at all — so it can
       be answered by ear, which is how a real fight is answered. */
    sfx(S.move === "chop" ? "windHigh" : S.move === "sweep" ? "windLow" : "windGrab");
    phase(PH.tell);
  }

  /* her answer, or the lack of one */
  function answer(kind) {
    if (S.phase !== PH.blow || S.ans) return;
    var M = MOVES[S.move], need = M.need;
    var good = kind === need;
    /* THE PARRY. The same answer, given inside the first fifth of a
       second of the blade actually moving. Every fighting game worth
       playing pays for the late nerve rather than the early guess, and
       this is that: it is not a different button, it is the same button
       held until the last moment. */
    var parried = good && S.winT <= FIGHT.parry && !M.unblockable;
    S.ans = good ? "good" : "bad";
    S.parried = parried;
    S.cueResult = good ? "hit" : "miss";
    showCue(parried ? "PARRY!" : M.label, 0);
    padVerdict(need, kind, good);
    S.freeze = parried ? FIGHT.hitStop * 2 : FIGHT.hitStop;

    if (parried) {
      S.parries++;
      S.resolve = Math.min(FIGHT.resolve, S.resolve + 2);
      S.act = need; S.actT = 0;
      S.guard = 1.4;
      S.dact = "reel"; S.dactT = 0;         /* knocked wide, not just off balance */
      S.shake = 13; S.flash = 0.85;
      S.camPunch = 1;
      sfx("parry"); MUS.sting("parry");
      bark("death", "parried");
    } else if (good) {
      S.resolve = Math.min(FIGHT.resolve, S.resolve + 1);
      S.act = need; S.actT = 0;
      S.guard = need === "block" ? 1 : 0;
      S.dact = "stagger"; S.dactT = 0;
      S.shake = need === "block" ? 9 : 4;
      /* a SMALL white frame on a block. The flash does not decay during
         the hit stop — that is the whole point of a hit stop — so a big
         one here sat at full strength over the arm, the shield and the
         star for a tenth of a second and washed out the very thing it was
         meant to punctuate. The parry keeps its big one: there is nothing
         to read on a parry except that it was magnificent. */
      S.flash = need === "block" ? 0.26 : 0.14;
      S.camPunch = 0.5;
      sfx(need === "block" ? "clang" : "whoosh");
    } else if (M.unblockable) {
      /* THE GRAB. It does not take a heart. It takes HIM — and the only
         way out is her, hammering it until he is loose. */
      goHeld();
      return;
    } else {
      hurtAnwar();
    }
    phase(PH.beat);
  }

  function hurtAnwar() {
    S.ahp--; S.taken++;
    S.resolve = 0;
    S.act = "hurt"; S.actT = 0;
    S.dact = "through"; S.dactT = 0;
    S.shake = 16; S.hurtFlash = 1; S.camPunch = -1;
    S.her.flinch = 14;
    sfx("hurt"); MUS.sting("taken");
    bark(S.ahp <= 1 ? "ouissy" : "death", S.ahp <= 1 ? "nearly" : "landed");
  }

  /* held: the one place the fight stops being about timing */
  function goHeld() {
    S.act = "held"; S.actT = 0;
    S.dact = "holding"; S.dactT = 0;
    S.heldT = 0; S.heldN = 0;
    S.shake = 10; S.camPunch = 0.7;
    S.resolve = 0;
    hideCue(); showPad("break");
    sfx("grab"); MUS.play("grabbed");
    bark("ouissy", "grabbed");
    phase(PH.held);
  }
  function breakPress() {
    if (S.phase !== PH.held) return;
    S.heldN++;
    S.actT = 0;
    sfx("pick");
    if (S.heldN >= FIGHT.grab.presses) {
      S.act = "strike"; S.actT = 0;
      S.dact = "reel"; S.dactT = 0;
      S.shake = 12; S.flash = 0.6; S.camPunch = 1;
      sfx("clang"); MUS.sting("parry");
      MUS.play(fightTune());
      showPad("fight"); hideCue();
      /* out of his hands and straight into the opening — she earned it */
      padClear(); S.cueResult = null;
      S.openT = 0; S.openLen = band().open * 1.2; S.struck = false;
      phase(PH.open);
    }
  }

  /* the opening: she takes it, or she does not */
  function strikeNow() {
    if (S.phase !== PH.open || S.struck) return;
    S.struck = true;
    /* A FULL METER IS A BIGGER BLOW. Three clean answers in a row and the
       next one lands for two — which is why holding the streak is worth
       something, and why a single hit taken costs more than a heart. */
    var big = S.resolve >= FIGHT.resolve;
    S.dhp -= big ? 2 : 1;
    if (S.dhp < 0) S.dhp = 0;
    S.hits++;
    if (big) { S.resolve = 0; MUS.sting("full"); }
    S.act = "strike"; S.actT = 0;
    S.dact = "hurt"; S.dactT = 0;
    S.shake = big ? 18 : 12;
    S.flash = big ? 1 : 0.75;
    S.freeze = FIGHT.hitStop * (big ? 2.2 : 1.4);
    S.camPunch = big ? 1.4 : 0.9;
    sfx("land"); MUS.sting("hit");
    hideCue();
    afterOpening(true);
  }

  function afterOpening(landed) {
    if (S.dhp <= 0) { finishHim(); return; }
    /* his health decides the music and the pace, so both of them change
       at the same moment she sees him change */
    var b = band();
    MUS.play(fightTune());
    if (b === FIGHT.bands[2]) bark("death", "lastband");
    /* the close call is a story beat and lands once, when he first gets
       properly angry — never as a punishment for missing */
    if (landed && !S.closeCalled && S.dhp <= FIGHT.deathHp - 4) {
      S.closeCalled = true;
      S.shake = 12; S.flash = 1; S.dim = Math.min(1, S.dim + 0.25);
      showPad(null); hideCue(); hideBark();
      sfx("catch");
      say(SCRIPT.death.closeCall);
      phase(PH.close);
      return;
    }
    S.restLen = b.rest;
    phase(PH.rest);
  }

  /* THE LAST BLOW. It is not another hit with a smaller number after it:
     the world slows almost to a stop, the colour goes out of everything,
     the blade leaves his hands, and nothing is asked of her for three
     seconds. Then he speaks. */
  function finishHim() {
    showPad(null); hideCue(); hideBark();
    S.dact = "beaten"; S.dactT = 0;
    S.slow = 1;
    S.finT = 0;
    S.shake = 22; S.flash = 0.8; S.freeze = 0.22; S.camPunch = 2;
    S.bladeFly = { x: S.death.x + 14, y: S.her.y - 14, vx: -150, vy: -170, r: 0 };
    sfx("final"); MUS.play("final");
    phase(PH.final);
  }

  /* he goes down, and there is exactly one way back up */
  function goDown() {
    hideCue(); hideBark();
    S.act = "down"; S.actT = 0;
    S.dact = "ready"; S.dactT = 0;
    S.getUpT = 0; S.getUpN = 0;
    S.shake = 16; S.hurtFlash = 1; S.camPunch = -1.4;
    S.resolve = 0;
    MUS.play("down");
    showPad("getup");
    sfx("thumpBig");
    bark("ouissy", "down");
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
      S.act = null; S.shake = 8; S.flash = 0.5; S.camPunch = 1;
      sfx("up");
      hideCue(); showPad("fight");
      /* THE TURN. The tune that has been the fight's, with the third put
         back in it — her theme, in the major, at full height. It plays
         over the top of the band he is in for as long as it takes him to
         stand up, and then the fight takes its music back. */
      MUS.play("rise");
      S.riseT = 0;
      bark("anwar", "up");
      S.restLen = 1.4;                 /* a breath before he comes again */
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
      /* he PLANTS: down into his knees, turned side-on, and shoved back
         by what he has just taken on his arm. Two pixels of nod was not a
         man stopping a scythe. */
      var b = arc1(u / 0.5);
      p.dy = 4 * b; p.rot = 0.12 * b; p.dx = -4 * b; p.sy = 1 - 0.06 * b;
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
    } else if (k === "held") {
      /* off the floor, and shaking harder the longer it goes on */
      var hk = clamp(S.heldT / FIGHT.grab.time, 0, 1);
      p.dy = -9 - 2 * hk;
      p.rot = 0.14 + Math.sin(S.t * 26) * 0.05 * (0.4 + hk);
      p.dx = 4;
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
    } else if (k === "reel") {
      /* a parry does not nudge him. It throws his arm wide and turns him
         half away, and that is why the opening after it is worth more. */
      var rr = clamp(u / 0.8, 0, 1);
      p.dx = 22 * (1 - ease3(rr)); p.rot = -0.34 * (1 - rr) * (1 - rr * 0.4);
    } else if (k === "holding") {
      p.dx = -8; p.rot = 0.06 + Math.sin(S.t * 9) * 0.02;
    } else if (k === "throw") {
      var tw = clamp(u / 0.45, 0, 1);
      p.dx = -14 * (1 - tw); p.rot = 0.16 * (1 - tw);
    } else if (k === "beaten") {
      /* he does not fall over. He gives way — half a step back, leaning,
         and lower than he was. */
      var bw = clamp(u / 1.6, 0, 1);
      p.dx = 12 * ease3(bw); p.dy = 5 * ease3(bw); p.rot = -0.14 * ease3(bw);
    }
    return p;
  }

  /* WHERE THE CAMERA IS. It lives between the two of them, it leans
     toward whoever is about to do something, and it is pushed by exactly
     one number — see step(). Nothing here is animated on its own: every
     move it makes is something that happened in the fight. */
  function camApply(c, groundY) {
    if (!S || S.kind !== "death") return;
    var z = 1, fx = (S.anwar.x + S.death.x + 20) / 2, fy = groundY - 14;
    if (S.phase === PH.tell) z += 0.06 * clamp(S.pt / Math.max(0.12, S.tellLen), 0, 1);
    if (S.phase === PH.blow) z += 0.06;
    if (S.phase === PH.held) z += 0.10;
    if (S.phase === PH.down) z += 0.05;
    if (S.phase === PH.final) z += 0.26 * S.slow;
    z += (S.camPunch > 0 ? 0.10 : 0.05) * S.camPunch;
    if (z < 0.94) z = 0.94;
    c.translate(fx, fy);
    c.scale(z, z);
    c.translate(-fx, -fy);
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
      } else if (S.move === "grab") {
        /* NOT AN ARC. Two hands, straight at him, closing — the shape
           says "this is not a swing" before the colour says "and you
           cannot block it". */
        var gy = g.head + 6, gx0 = g.dx - 6, gx1 = g.ax + 14 + (1 - (live ? 1 : k)) * 18;
        c.moveTo(gx0, gy - 5); c.lineTo(gx1, gy - 2);
        c.moveTo(gx0, gy + 5); c.lineTo(gx1, gy + 2);
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

  /* THE BLOW ITSELF — the same path, travelled.

     And it STOPS when it is stopped. It used to complete its arc whatever
     she did, so a blocked chop and a chop that took a heart drew the same
     picture and the only difference between them was a number in the
     corner. The blade now arrives at the guard and comes off it. */
  function paintBlow(c, g) {
    var beat = S.phase === PH.beat;
    if (S.phase !== PH.blow && !(beat && S.pt < 0.34)) return;
    var stopped = beat && S.ans === "good";
    var u;
    if (S.phase === PH.blow) u = clamp(S.winT / Math.max(0.1, S.winLen), 0, 1);
    else if (stopped) u = 0.78 - Math.min(0.12, S.pt * 0.5);   /* on the guard, and off it */
    else u = 1;
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
      var reach = stopped ? 0.72 : u;
      var bx = (g.dx - 10) - reach * (g.dx - g.ax - 2);
      for (var j = 0; j < 7; j++) {
        c.globalAlpha = j ? 0.7 - j * 0.08 : 1;
        px(c, bx + j * 6, g.waist - (j % 2), 6, j ? 2 : 3,
           j ? (S.move === "grab" ? "#ff6b6b" : "#c9a0ff") : "#ffffff");
      }
    }
    c.restore();
  }

  /* HELD. He is off the floor in one of Death's hands, and the only thing
     on the screen that is moving is him trying to get out of it. */
  function paintHeld(c, g, groundY) {
    if (S.phase !== PH.held) return;
    var k = clamp(S.heldT / FIGHT.grab.time, 0, 1);
    /* the arm, from Death to him */
    c.save();
    c.globalAlpha = 0.9;
    px(c, g.ax + 14, g.head + 2, Math.max(4, g.dx - g.ax - 14), 4, "#1b1622");
    px(c, g.ax + 14, g.head + 2, Math.max(4, g.dx - g.ax - 14), 1, "#3a3352");
    c.restore();
    /* the grip tightening, drawn as a ring closing on him */
    c.save();
    c.globalAlpha = 0.55 + 0.35 * Math.abs(Math.sin(S.t * 14));
    c.strokeStyle = "#ff6b6b"; c.lineWidth = 1.4;
    c.beginPath();
    c.arc(g.ax + 12, g.head + 4, 13 - k * 5, 0, 6.283);
    c.stroke();
    c.restore();
  }

  /* THE BLADE, WHEN IT IS NOT HIS ANY MORE. It leaves his hands on the
     last hit, turns over twice in the air, and sticks in the ground. */
  function paintBlade(c, groundY) {
    var bf = S.bladeFly; if (!bf) return;
    c.save();
    c.translate(bf.x, bf.y);
    c.rotate(bf.stuck ? -0.35 : bf.r);
    c.globalAlpha = 0.95;
    px(c, -1, -14, 2, 20, "#3a2f28");            // the shaft
    px(c, -1, -16, 9, 2, "#e8eef6");             // the blade
    px(c, 5, -15, 3, 4, "#e8eef6");
    px(c, -1, -16, 9, 1, "#ffffff");
    c.restore();
    if (bf.stuck) {
      c.save(); c.globalAlpha = 0.5;
      px(c, bf.x - 5, bf.y + 5, 11, 1, "#05040a");
      c.restore();
    }
  }

  /* HE PUTS HIS ARM IN THE WAY, and that is the whole picture: an arm,
     the blade stopped on it, and the light of the two of them meeting.

     This was a thin white curve and a scatter of dots before, which reads
     as "something happened here" and not as "he blocked it". A block has
     to be legible at a glance, from the other side of a room, to somebody
     who has never played it — so it is now four things drawn in order:
     the arm, the shield the arm makes, the star where the edge lands, and
     a ring going out from the contact.

     A parry is the same picture, larger and gold, because it is the same
     move done better and it should look like the same move done better. */
  function paintGuard(c, g, ap, ax, ay, ah) {
    if (S.guard <= 0) return;
    /* THROUGH HIS POSE. The arm belongs to him, so it has to lean when he
       leans — drawn in the frame he is standing in rather than in the one
       he would be standing in if he had not braced. (This is the same
       mistake that left Death's eyes hanging beside his hood.) */
    c.save();
    if (ap) {
      var apx = ax + 13, apy = ay + ah;
      if (ap.rot || ap.sy !== 1) {
        c.translate(apx, apy); c.rotate(ap.rot); c.scale(1, ap.sy); c.translate(-apx, -apy);
      }
      c.translate(ap.dx, ap.dy);
    }
    var parry = S.parried;
    var k = clamp(S.guard / (parry ? 1.4 : 1), 0, 1);   /* 1 -> 0 */
    var out = 1 - k;                                     /* 0 -> 1 */
    var cx = g.ax + 20, cy = g.head + 6;
    var warm = parry ? "#fff3c0" : "#ffd9a0";

    /* 1. THE ARM. Up, across his face, ink-edged so it reads against him. */
    c.save();
    c.globalAlpha = Math.min(1, 0.35 + k);
    px(c, g.ax + 13, g.head + 12, 8, 5, ANWAR_PAL.J);
    px(c, g.ax + 13, g.head + 12, 8, 1, ANWAR_PAL.j);
    px(c, g.ax + 18, g.head + 3, 5, 11, ANWAR_PAL.J);
    px(c, g.ax + 18, g.head + 3, 1, 11, ANWAR_PAL.j);
    px(c, g.ax + 17, g.head + 1, 7, 5, ANWAR_PAL.S);      /* the fist */
    px(c, g.ax + 17, g.head + 1, 7, 1, "#f4d0aa");
    px(c, g.ax + 16, g.head, 9, 1, ANWAR_PAL.K);
    px(c, g.ax + 16, g.head + 6, 9, 1, ANWAR_PAL.K);
    c.restore();

    /* 2. THE SHIELD the arm makes: a thick bright arc, and a soft one
       behind it so it has weight in the dark. */
    c.save();
    c.lineCap = "round";
    for (var p = 0; p < 2; p++) {
      c.globalAlpha = (p ? 0.95 : 0.32) * (0.45 + 0.55 * k);
      c.strokeStyle = p ? "#fff6e0" : warm;
      c.lineWidth = p ? 2 : (parry ? 7 : 5);
      c.beginPath();
      c.arc(cx, cy, (parry ? 16 : 13) + out * 2, -Math.PI * 0.78, Math.PI * 0.42);
      c.stroke();
    }
    c.restore();

    /* 3. THE STAR where the edge lands on it. */
    var sx = cx + 2, sy = cy - (parry ? 9 : 7);
    c.save();
    c.globalAlpha = k;
    px(c, sx - 1, sy - 7, 3, 15, "#ffffff");
    px(c, sx - 7, sy - 1, 15, 3, "#ffffff");
    px(c, sx - 4, sy - 4, 9, 9, parry ? "#fff3c0" : "#ffe9c0");
    px(c, sx - 2, sy - 2, 5, 5, "#ffffff");
    c.restore();

    /* 4. THE RING going out from it, which is the part the eye follows. */
    c.save();
    c.globalAlpha = k * 0.8;
    c.strokeStyle = warm;
    c.lineWidth = parry ? 2 : 1.4;
    c.beginPath();
    c.arc(sx, sy, 4 + out * (parry ? 26 : 18), 0, 6.283);
    c.stroke();
    c.restore();

    /* and the sparks off the contact, thrown along the edge */
    for (var i = 0; i < (parry ? 12 : 8); i++) {
      var an = -1.5 + i * (parry ? 0.26 : 0.32), len = (6 + ((i * 7) % 11)) * (0.5 + out * 1.6);
      c.save();
      c.globalAlpha = k * (0.45 + 0.55 * ((i * 13) % 7) / 7);
      px(c, sx + Math.cos(an) * len, sy + Math.sin(an) * len, 2, 2,
         i % 2 ? "#fff3d0" : (parry ? "#ffd166" : "#9fe4ff"));
      c.restore();
    }
    c.restore();                       /* and out of his pose */
  }

  /* HIS HEALTH, AND HIS. Four warm hearts and six cold pips, because a
     number is a thing you read and a row of hearts is a thing you feel. */
  function paintHp(c) {
    if (!inFight() && S.phase !== PH.close && S.phase !== PH.final) return;
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
    /* RESOLVE. Three clean answers in a row and the next blow lands for
       two. It is drawn as three notches under her hearts and it fills
       with every answer she gets right, which is what makes a run of them
       worth holding on to. */
    for (i = 0; i < FIGHT.resolve; i++) {
      var rx = 8 + i * 7, ry = 16, got = i < S.resolve;
      c.save();
      c.globalAlpha = got ? 1 : 0.3;
      px(c, rx, ry, 5, 2, got ? "#ffd166" : "#3a3040");
      if (got && S.resolve >= FIGHT.resolve) px(c, rx, ry, 5, 1, "#fff6d8");
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

    /* THE CAMERA.

       Everything from here to the end of the fighters is drawn through
       it: a slow push in while he winds up, a punch on every blow, a
       shove back on one she takes, and on the last hit it comes all the
       way in and stays. The screen-space things — the cold, the vignette,
       her health, the white frame — are drawn outside it on purpose. A
       vignette that zooms is not a vignette, it is a hole. */
    c.save();
    camApply(c, groundY);

    /* Death, drawn before them so they read as standing against him */
    if (S.phase >= 2 && S.leaving < 1) {
      var cast = S.bladeFly ? CAST.deathBare : CAST.death;
      var d = cast[S.death.k] || cast[cast.length - 1];
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
      /* HE COMES APART. In the last band the cloak is torn through in
         four places and the hem is bitten out — at six health and at one
         he used to be the same drawing, which is the whole fight saying
         nothing about how it is going. */
      if (inFight() && S.dhp <= 3) {
        var tear = [[6, 26, 3, 5], [22, 34, 4, 3], [11, 44, 5, 4], [26, 18, 2, 6]];
        c.save();
        c.globalAlpha = 0.92;
        for (var tt = 0; tt < tear.length; tt++)
          px(c, S.death.x + tear[tt][0], dy + tear[tt][1], tear[tt][2], tear[tt][3], "#07060d");
        for (var hb = 0; hb < 5; hb++)
          px(c, S.death.x + 4 + hb * 7, dy + d.height - 2 - (hb % 2) * 2, 4, 4, "#07060d");
        c.restore();
      }
      if (S.dact === "hurt" && S.dactT < 0.14) {
        c.save();
        c.globalCompositeOperation = "source-atop";
        c.globalAlpha = 0.8 * (1 - S.dactT / 0.14);
        c.fillStyle = "#ffffff";
        c.fillRect(S.death.x - 4, dy - 4, d.width + 8, d.height + 8);
        c.restore();
      }
      /* NOT RESTORED YET, and that is the fix: his eyes, his aura and the
         wisps coming off him are drawn inside the same transform as the
         rest of him. They used to be drawn after it, in the place he
         would have been standing if he had not moved — so the moment he
         leaned into a swing, his eyes stayed behind, hanging in the air
         beside his hood. */

      /* THE OPENING. He is off balance and there is a pale place in the
         middle of him for a moment. It is the only time anything about
         him is bright, and it is the whole invitation. */
      if (S.phase === PH.open) {
        var ok = 1 - clamp(S.openT / Math.max(0.1, S.openLen), 0, 1);
        var ocx = S.death.x + 14, ocy = dy + 26;
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
        /* the left one goes out first, and stays out */
        var dim = inFight() && S.dhp <= 3 && e === 0 ? 0.28 : 1;
        c.save();
        c.globalAlpha = (0.30 + 0.5 * flick) * ar * dim;
        var eg = c.createRadialGradient(epx + 1, ey + 1, 0, epx + 1, ey + 1, 7);
        eg.addColorStop(0, "rgba(190,240,255,0.95)");
        eg.addColorStop(0.4, "rgba(110,210,255,0.55)");
        eg.addColorStop(1, "rgba(110,210,255,0)");
        c.fillStyle = eg;
        c.fillRect(epx - 6, ey - 6, 15, 15);
        c.restore();
        px(c, epx, ey, 2, 2, dim < 1 ? "#2a4a5a" : (flick > 0.5 ? "#eaf9ff" : "#8fd8ff"));
      }

      c.restore();                     /* and out of HIS transform */

      /* the shadow is the one thing that does not move with him: it lies
         on the floor, it does not lean, and it only slides when he does */
      c.save();
      c.globalAlpha = 0.55 * ar;
      c.fillStyle = "#05040a";
      c.beginPath();
      c.ellipse(dcx + dp.dx, groundY + 2, 24, 4.5, 0, 0, 6.283);
      c.fill();
      c.restore();
    }

    /* HER. She backs away from the cold, she flinches every time he takes
       one, and when he goes down she comes forward — which is the only
       thing she can do from where she is standing, and she does it. */
    var her = ouissy("hurt", 0);
    if (S.her.flinch > 0) S.her.flinch = Math.max(0, S.her.flinch - 0.35);
    var herX = S.her.x - S.her.flinch;
    if (S.phase === PH.down || S.phase === PH.held) herX += 10 + Math.sin(S.t * 6) * 1.5;
    if (her) c.drawImage(her, Math.round(herX), Math.round(S.her.y));

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
    paintGuard(c, geo, ap, ax, ay, a.height);
    paintHeld(c, geo, groundY);
    paintBlade(c, groundY);

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

    c.restore();                       /* and out of the camera */

    /* THE COLOUR GOING OUT. Only the last blow does this, and it does it
       all the way: the picture is drained to grey and let back in over
       three seconds. */
    if (S.slow > 0) {
      c.save();
      c.globalCompositeOperation = "saturation";
      c.globalAlpha = S.slow * 0.85;
      px(c, 0, 0, VW, VH, "#808080");
      c.restore();
      /* and the light with it. Colour alone came out as fog — the frost
         and the mist in this scene are pale, and a pale picture with the
         colour taken out is a white sheet. It has to go DOWN as well as
         grey, or the last blow lands in a snowstorm. */
      c.save();
      c.globalAlpha = S.slow * 0.42;
      px(c, 0, 0, VW, VH, "#05040a");
      c.restore();
      c.save();
      c.globalAlpha = S.slow * 0.5;
      var fv = c.createRadialGradient(VW * 0.5, VH * 0.55, VH * 0.2, VW * 0.5, VH * 0.55, VH * 0.75);
      fv.addColorStop(0, "rgba(0,0,0,0)");
      fv.addColorStop(1, "rgba(0,0,0,0.95)");
      c.fillStyle = fv;
      c.fillRect(0, 0, VW, VH);
      c.restore();
    }

    paintHp(c);
    /* one red frame across the whole scene when it is HER four that just
       went down by one */
    if (S.hurtFlash > 0) {
      c.save(); c.globalAlpha = 0.34 * S.hurtFlash;
      px(c, 0, 0, VW, VH, "#c31f3f"); c.restore();
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
    S.realDt = dt;
    /* SLOW MOTION. Only the last blow uses it, and it uses it all the way
       down to a fifth of the speed — which is the difference between a
       sixth hit and an ending. */
    if (S.slow > 0) dt *= 1 - 0.8 * S.slow;
    /* THE CAMERA. One number: a punch, positive for a blow she landed and
       negative for one she took, easing back to nothing. Everything the
       scene draws is scaled around the two of them by it. */
    if (S.camPunch) {
      S.camPunch -= S.camPunch * Math.min(1, dt * 6);
      if (Math.abs(S.camPunch) < 0.01) S.camPunch = 0;
    }
    S.t += dt;
    if (S.actT !== undefined) S.actT += dt;
    if (S.dactT !== undefined) S.dactT += dt;
    /* THE WHITE FRAME FADES BY ITSELF, and it fades in REAL seconds.
       It used to be wound down inside the two phases that raised it,
       which was fine while they were the only two — the moment a third
       raised it, the scene stayed white for the rest of the fight. And
       once slow motion existed, a flash fading on slowed time took five
       times as long to go: the last blow, which sets the brightest one in
       the scene AND the slowest time in it, landed in a white-out. */
    var rdt = S.realDt || dt;
    if (S.hurtFlash > 0) S.hurtFlash = Math.max(0, S.hurtFlash - rdt * 2.2);
    if (S.flash > 0) S.flash = Math.max(0, S.flash - rdt * 3);
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
        if (S.phase === PH.held) { breakPress(); return; }
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
    if (S.phase === PH.held) { breakPress(); return; }
  }

  function done() {
    var d = !S || S.done;
    if (d) { hideLine(); hideChoice(); hideCue(); hideLetter(); hideBark();
             showPad(null); hideGamePad(false); MUS.stop(); }
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
