/* =========================================================================
   OUISSY'S CUP — THE SCORE

   Nothing in this file is a recording. There is not an audio asset
   anywhere in this repository and this chapter is not about to be the
   first: every note below is oscillators and one buffer of noise, made
   at load and thrown away after it has sounded.

   ---------------------------------------------------------------------
   WHY THIS EXISTS

   The chapter had four chords under its menus. Four chords, a bass note
   and one note picked out on top, looping every twelve seconds — which
   was better than the silence it replaced and nowhere near the rest of
   the site, where the walk theme is played eleven different ways by six
   synthesised instruments through a generated room. A tournament she is
   supposed to want to win cannot be scored by wallpaper.

   ---------------------------------------------------------------------
   THE TUNE

   One theme, eight bars, and it is shaped like a crowd:

        (5) 8  7  8  |  6   5   |  3  5  6  |  (5) 8  9  10 | 9  8 | 5  1

   It starts on an UPBEAT — the fifth, on the last beat of the bar
   before — and leaps a fourth onto the octave, which is how almost
   every anthem anyone has ever sung in a stadium begins, because a
   crowd needs a run-up. It climbs, falls back, and then does the whole
   thing again a third higher before dropping a fourth onto the tonic
   and stopping. The second half is the first half louder, which is what
   a terrace does to a song it knows.

   That shape is the only melody in the chapter. Everything else here is
   a different set of clothes for it:

     the menu       one voice, an organ, unhurried — the door
     the squad      the same tune under a ticking pluck; she is working
     the draw       withheld. A pulse, no melody: you do not know who
                    you have got yet
     the three      one cue per round, each a key higher and a little
     fixtures       faster than the last, so the tournament TIGHTENS.
                    The quarter-final is warm and in no hurry; the final
                    is a minor third up, at a tempo you cannot stroll to
     half-time      the first phrase only, low, alone
     the win        everything, in the major, with the drum
     the loss       the same notes with the third flattened. Same tune.
                    Completely different evening
     the trophy     the only place it is played in full by all of it at
                    once, because it is the only place the question gets
                    answered

   Raising the key a minor third across three fixtures is not decoration.
   It is the one musical device that makes a bracket feel like a bracket
   without a word of commentary, and it costs one number per cue.

   ---------------------------------------------------------------------
   HOW IT IS MADE

   - Six voices: a reed organ (the terrace), brass (the anthem), a
     pluck, strings, a bass, and two drums — a floor tom you feel and a
     clap you hear. All oscillators.
   - One convolution reverb whose impulse response is generated at load.
     It is shorter and brighter than the one in ost.js on purpose: a
     concrete bowl with a roof on it, not a wood.
   - A lookahead scheduler. setInterval cannot keep musical time, so it
     only ever wakes up to post the next half second of notes onto the
     audio clock, which can.
   - Cues crossfade. Walking from the menu into the team screen moves
     the music; it does not cut it off and start another one.

   It shares the chapter's audio context and its master gain, so there
   is one output, one volume control, and one thing to wake up.
   ========================================================================= */

(function () {
  "use strict";

  /* ---------------------------------------------------------------
     1. NOTES

     Degrees rather than note names, so one theme can be played in any
     key and either mode without being written out twice. Degree 1 is
     the tonic, 8 the octave above it; anything above that keeps
     counting, so a tune can walk past the octave without a special
     case for it.
     --------------------------------------------------------------- */

  var MAJOR = [0, 2, 4, 5, 7, 9, 11];
  var MINOR = [0, 2, 3, 5, 7, 8, 10];

  function deg(n, minor) {
    var sc = minor ? MINOR : MAJOR;
    var oct = Math.floor((n - 1) / 7);
    var i = (((n - 1) % 7) + 7) % 7;
    return sc[i] + oct * 12;
  }
  function midi(m) { return 440 * Math.pow(2, (m - 69) / 12); }

  /* ---------------------------------------------------------------
     2. THE THEME
     [bar, beat, degree, length in beats]. Bars are four beats.
     --------------------------------------------------------------- */

  var THEME = [
    [0, 3, 5, 1],                                   // the run-up
    [1, 0, 8, 1.5], [1, 1.5, 7, 0.5], [1, 2, 8, 2],
    [2, 0, 6, 2],   [2, 2, 5, 2],
    [3, 0, 3, 1],   [3, 1, 5, 1],   [3, 2, 6, 2],
    [4, 3, 5, 1],                                   // and again, higher
    [5, 0, 8, 1.5], [5, 1.5, 9, 0.5], [5, 2, 10, 2],
    [6, 0, 9, 2],   [6, 2, 8, 2],
    [7, 0, 5, 2],   [7, 2, 1, 2],                   // home
  ];

  /* the first phrase on its own, for the places that are not allowed
     to finish the sentence */
  var THEME_FRAG = THEME.filter(function (n) { return n[0] <= 3; });

  /* ---------------------------------------------------------------
     3. THE CUES

     Deliberately thin: a key, a mode, a tempo, a chord loop, and which
     clothes the theme is wearing. Everything else is generated, so the
     whole score stays one tune.

     `key` is semitones above C. The three fixtures are 0, 3 and 6 —
     a minor third at a time, each one brighter and more urgent than
     the last.
     --------------------------------------------------------------- */

  var CUES = {
    /* THE DOOR. One voice on an organ over a slow four. Nothing is at
       stake yet and the music should not pretend otherwise. */
    menu: {
      key: 0, minor: false, bpm: 84, bars: 8,
      chords: [1, 5, 6, 4, 1, 5, 4, 5],
      theme: "full", themeInst: "organ",
      pad: "strings", padGain: 0.16, bass: true,
      ost: "none", drum: null, gain: 0.60,
    },

    /* PICKING THE TEAM. She is doing something, so something is moving
       underneath — but the tune only gets its first phrase, because
       nothing has happened yet. */
    squad: {
      key: 0, minor: false, bpm: 92, bars: 8,
      chords: [1, 5, 6, 4, 1, 5, 4, 5],
      theme: "frag", themeInst: "pluck",
      pad: "organ", padGain: 0.14, bass: true,
      ost: "eighths", ostInst: "pluck", drum: "soft", gain: 0.58,
    },

    /* THE DRAW. The theme is withheld entirely: you do not know who you
       have got. What is there instead is a tick. */
    draw: {
      key: 0, minor: true, bpm: 96, bars: 4,
      chords: [1, 1, 6, 5],
      theme: null,
      pad: "strings", padGain: 0.20, bass: true,
      ost: "pulse", ostInst: "pluck", drum: "soft", gain: 0.56,
    },

    /* THE THREE FIXTURES. Same tune, a minor third apart each time, and
       eight beats a minute faster. */
    tieA: {
      key: 0, minor: false, bpm: 96, bars: 8,
      chords: [1, 5, 6, 4, 1, 5, 4, 5],
      theme: "full", themeInst: "organ",
      pad: "strings", padGain: 0.20, bass: true,
      ost: "eighths", ostInst: "pluck", drum: "soft", gain: 0.64,
    },
    tieB: {
      key: 3, minor: false, bpm: 104, bars: 8,
      chords: [1, 6, 4, 5, 1, 6, 4, 5],
      theme: "full", themeInst: "brass",
      pad: "organ", padGain: 0.22, bass: true,
      ost: "drive", ostInst: "pluck", drum: "march", gain: 0.68,
    },
    /* THE FINAL. A tritone up from where the tournament started, the
       fastest thing in the chapter, and the brass has the tune. */
    tieC: {
      key: 6, minor: false, bpm: 112, bars: 8,
      chords: [1, 5, 6, 4, 1, 4, 5, 5],
      theme: "full", themeInst: "brass",
      pad: "strings", padGain: 0.26, bass: true,
      ost: "drive", ostInst: "pluck", drum: "march", double: true, gain: 0.72,
    },

    /* HALF-TIME. The first phrase, low, with nothing under it. */
    half: {
      key: 0, minor: false, bpm: 76, bars: 4,
      chords: [1, 6, 4, 5],
      theme: "frag", themeInst: "organ",
      pad: "strings", padGain: 0.18, bass: true,
      ost: "none", drum: null, gain: 0.50,
    },

    /* THE MEMORY CARD between rounds. Not football at all: the theme an
       octave up on a pluck, and as little else as will still count as
       music. */
    memory: {
      key: 5, minor: false, bpm: 64, bars: 8,
      chords: [1, 5, 6, 4, 1, 5, 4, 1],
      theme: "high", themeInst: "pluck",
      pad: "strings", padGain: 0.20, bass: true,
      ost: "none", drum: null, gain: 0.52,
    },

    /* WON IT. Everything, with the drum. */
    win: {
      key: 5, minor: false, bpm: 108, bars: 8,
      chords: [1, 5, 6, 4, 1, 4, 5, 1],
      theme: "full", themeInst: "brass",
      pad: "organ", padGain: 0.26, bass: true,
      ost: "drive", ostInst: "pluck", drum: "march", double: true, gain: 0.74,
    },

    /* LOST IT. THE SAME SEVEN NOTES with the third flattened. Not a
       different piece of music — the same one, heard on a worse night. */
    lose: {
      key: 5, minor: true, bpm: 72, bars: 8,
      chords: [1, 6, 4, 5, 1, 6, 4, 5],
      theme: "frag", themeInst: "organ",
      pad: "strings", padGain: 0.24, bass: true,
      ost: "none", drum: null, gain: 0.54,
    },

    /* THE TROPHY. The only place the whole thing is played by all of it
       at once, because it is the only place the question gets an
       answer. */
    trophy: {
      key: 5, minor: false, bpm: 100, bars: 8,
      chords: [1, 5, 6, 4, 1, 4, 5, 1],
      theme: "full", themeInst: "brass",
      pad: "strings", padGain: 0.30, bass: true,
      ost: "drive", ostInst: "organ", drum: "march", double: true,
      choirIn: true, gain: 0.80,
    },
  };

  /* which cue a round's fixture gets */
  var ROUND_CUE = ["tieA", "tieB", "tieC"];

  /* ---------------------------------------------------------------
     4. THE ROOM
     --------------------------------------------------------------- */

  var ctx = null, master = null, dry = null, wet = null, verb = null;
  var noiseBuf = null, built = false, on = true, volume = 0.5;

  function build(context, outNode, opt) {
    if (built) return true;
    if (!context) return false;
    ctx = context;
    if (opt && typeof opt.volume === "number") volume = opt.volume;

    master = ctx.createGain();
    master.gain.value = 0.0001;
    master.connect(outNode || ctx.destination);

    dry = ctx.createGain(); dry.gain.value = 0.84; dry.connect(master);
    wet = ctx.createGain(); wet.gain.value = 0.42;

    /* A CONCRETE BOWL WITH A ROOF ON IT. Shorter than a room built for
       a forest and with less high end taken off it, because that is
       what a stand sounds like: a fast, hard, slightly unpleasant
       reflection rather than a long tail. */
    verb = ctx.createConvolver();
    var n = Math.floor(ctx.sampleRate * 1.6);
    var ir = ctx.createBuffer(2, n, ctx.sampleRate);
    for (var ch = 0; ch < 2; ch++) {
      var d = ir.getChannelData(ch);
      var pre = Math.floor(ctx.sampleRate * 0.008);
      for (var i = 0; i < n; i++) {
        if (i < pre) { d[i] = 0; continue; }
        var t = (i - pre) / (n - pre);
        d[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, 2.1);
      }
    }
    verb.buffer = ir;
    verb.connect(wet); wet.connect(master);

    noiseBuf = ctx.createBuffer(1, Math.floor(ctx.sampleRate), ctx.sampleRate);
    var nd = noiseBuf.getChannelData(0);
    for (var k = 0; k < nd.length; k++) nd[k] = Math.random() * 2 - 1;

    built = true;
    return true;
  }

  /* every voice goes through here, so the balance between the room and
     the instrument is decided in exactly one place */
  function out(node, send) {
    node.connect(dry);
    var s = ctx.createGain();
    s.gain.value = send === undefined ? 0.4 : send;
    node.connect(s); s.connect(verb);
  }

  /* ---------------------------------------------------------------
     5. THE VOICES
     Each schedules one note at an absolute time on the audio clock and
     then forgets about it. Nothing is reused between notes, which is
     wasteful and entirely fine at a dozen notes a second.
     --------------------------------------------------------------- */

  /* THE TERRACE ORGAN. Square waves an octave apart with a third
     sitting quietly on top of them, through a mild lowpass — a reed
     organ, which is the instrument every football ground in the world
     had before it had a public address system. The slight detune is
     what stops it sounding like a chiptune. */
  function organ(t, m, dur, vel) {
    var f = midi(m);
    var lp = ctx.createBiquadFilter();
    lp.type = "lowpass"; lp.Q.value = 0.7;
    lp.frequency.value = Math.max(900, f * 4.5);
    var g = ctx.createGain();
    var parts = [[1, 0.5, -4], [2, 0.22, 5], [3, 0.10, 0]];
    for (var i = 0; i < parts.length; i++) {
      var o = ctx.createOscillator();
      o.type = i === 2 ? "triangle" : "square";
      o.frequency.value = f * parts[i][0];
      o.detune.value = parts[i][2];
      var pg = ctx.createGain(); pg.gain.value = parts[i][1];
      o.connect(pg); pg.connect(lp);
      o.start(t); o.stop(t + dur + 0.2);
    }
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vel * 0.26, t + 0.03);
    g.gain.setValueAtTime(vel * 0.26, t + Math.max(0.05, dur - 0.08));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.14);
    lp.connect(g); out(g, 0.36);
  }

  /* THE ANTHEM INSTRUMENT. Two saws through a soft clip with the filter
     opening hard at the front, which is the whole of what makes a
     sawtooth read as brass rather than as a sawtooth. */
  function brass(t, m, dur, vel) {
    var f = midi(m);
    var sh = ctx.createWaveShaper();
    var curve = new Float32Array(1024);
    for (var i = 0; i < 1024; i++) curve[i] = Math.tanh(((i / 512) - 1) * 2.4);
    sh.curve = curve;
    var lp = ctx.createBiquadFilter();
    lp.type = "lowpass"; lp.Q.value = 1.2;
    lp.frequency.setValueAtTime(f * 1.1, t);
    lp.frequency.exponentialRampToValueAtTime(Math.max(1400, f * 7), t + 0.11);
    lp.frequency.exponentialRampToValueAtTime(Math.max(800, f * 3.2), t + dur);
    for (var k = 0; k < 2; k++) {
      var o = ctx.createOscillator();
      o.type = "sawtooth"; o.frequency.value = f; o.detune.value = k ? 9 : -9;
      o.connect(sh);
      o.start(t); o.stop(t + dur + 0.3);
    }
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vel * 0.22, t + 0.07);
    g.gain.setValueAtTime(vel * 0.22, t + Math.max(0.1, dur - 0.16));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.26);
    sh.connect(lp); lp.connect(g); out(g, 0.5);
  }

  function strings(t, m, dur, vel) {
    var f = midi(m);
    var lp = ctx.createBiquadFilter();
    lp.type = "lowpass"; lp.Q.value = 0.6;
    lp.frequency.setValueAtTime(Math.max(420, f * 2), t);
    lp.frequency.linearRampToValueAtTime(Math.max(950, f * 5), t + dur * 0.5);
    var det = [-6, 0, 7];
    for (var i = 0; i < 3; i++) {
      var o = ctx.createOscillator();
      o.type = "sawtooth"; o.frequency.value = f; o.detune.value = det[i];
      var vib = ctx.createOscillator(); vib.type = "sine";
      vib.frequency.value = 4.7 + i * 0.3;
      var vg = ctx.createGain(); vg.gain.value = 3.2;
      vib.connect(vg); vg.connect(o.detune);
      o.connect(lp);
      o.start(t); o.stop(t + dur + 0.4);
      vib.start(t); vib.stop(t + dur + 0.4);
    }
    var atk = Math.min(0.3, dur * 0.3);
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vel * 0.3, t + atk);
    g.gain.setValueAtTime(vel * 0.3, t + Math.max(atk, dur - 0.3));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.34);
    lp.connect(g); out(g, 0.62);
  }

  function pluck(t, m, dur, vel) {
    var f = midi(m);
    var o = ctx.createOscillator(); o.type = "triangle"; o.frequency.value = f;
    var lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.setValueAtTime(f * 6, t);
    lp.frequency.exponentialRampToValueAtTime(f * 1.5, t + 0.2);
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vel * 0.36, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + Math.min(0.9, dur));
    o.connect(lp); lp.connect(g); out(g, 0.46);
    o.start(t); o.stop(t + Math.min(1, dur) + 0.1);
  }

  function bassNote(t, m, dur, vel) {
    var f = midi(m);
    var o = ctx.createOscillator(); o.type = "sine"; o.frequency.value = f;
    var o2 = ctx.createOscillator(); o2.type = "triangle"; o2.frequency.value = f * 2;
    var g2 = ctx.createGain(); g2.gain.value = 0.18;
    o2.connect(g2);
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vel * 0.5, t + 0.04);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.24);
    o.connect(g); g2.connect(g); out(g, 0.18);
    o.start(t); o2.start(t);
    o.stop(t + dur + 0.34); o2.stop(t + dur + 0.34);
  }

  /* THE DRUM ON THE TERRACE. A sine dropping two octaves in a tenth of
     a second, which is a kick, and a breath of noise on the front,
     which is the skin. It is the sound a stand makes when it has
     decided to help. */
  function tom(t, vel) {
    var o = ctx.createOscillator(); o.type = "sine";
    o.frequency.setValueAtTime(128, t);
    o.frequency.exponentialRampToValueAtTime(42, t + 0.1);
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vel, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
    o.connect(g); out(g, 0.2);
    o.start(t); o.stop(t + 0.34);

    var s = ctx.createBufferSource(); s.buffer = noiseBuf;
    var bp = ctx.createBiquadFilter();
    bp.type = "bandpass"; bp.frequency.value = 220; bp.Q.value = 0.9;
    var ng = ctx.createGain();
    ng.gain.setValueAtTime(vel * 0.3, t);
    ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    s.connect(bp); bp.connect(ng); out(ng, 0.3);
    s.start(t); s.stop(t + 0.08);
  }

  /* and the hands. Two noise bursts a few milliseconds apart, because
     one is a snare and two is a crowd. */
  function clap(t, vel) {
    for (var i = 0; i < 2; i++) {
      var s = ctx.createBufferSource(); s.buffer = noiseBuf;
      var bp = ctx.createBiquadFilter();
      bp.type = "bandpass"; bp.frequency.value = 1500 + i * 260; bp.Q.value = 1.1;
      var g = ctx.createGain();
      var at = t + i * 0.012;
      g.gain.setValueAtTime(vel * (i ? 0.7 : 1), at);
      g.gain.exponentialRampToValueAtTime(0.0001, at + 0.07);
      s.connect(bp); bp.connect(g); out(g, 0.55);
      s.start(at); s.stop(at + 0.1);
    }
  }

  var INST = { organ: organ, brass: brass, strings: strings, pluck: pluck };

  /* ---------------------------------------------------------------
     6. THE SCHEDULER

     setInterval drifts and stalls behind a busy frame, so it is never
     asked to keep time. It only wakes up often enough to post the next
     half second of notes onto the audio clock, and the clock does the
     timing.
     --------------------------------------------------------------- */

  var cue = null, cueName = null, bar = 0, nextBarAt = 0, timer = null;
  var duckUntil = 0, duckAmt = 1, muted = false;

  function beatLen() { return 60 / cue.bpm; }

  function scheduleBar(at) {
    var b = bar % cue.bars;
    var chord = cue.chords[b % cue.chords.length];
    var minor = cue.minor;
    var root = 48 + cue.key + deg(chord, minor);
    /* the triad, spelled out of the scale rather than by stacking fixed
       intervals — so a chord on the sixth degree comes out minor in a
       major key without anybody writing that down, and the whole
       progression stays inside the mode */
    var voiced = [0, 2, 4].map(function (add) {
      return 60 + cue.key + deg(chord + add, minor);
    });
    var bl = beatLen(), barLen = bl * 4;

    if (cue.pad && INST[cue.pad]) {
      voiced.forEach(function (m, i) {
        INST[cue.pad](at, m, barLen * 0.97, (cue.padGain || 0.2) * (i ? 0.78 : 1));
      });
    }
    if (cue.bass) {
      bassNote(at, root - 12, barLen * 0.55, 0.5);
      if (cue.drum === "march") bassNote(at + bl * 2, root - 12, bl * 1.2, 0.34);
    }

    var oi = INST[cue.ostInst] || pluck;
    if (cue.ost === "eighths") {
      for (var e = 0; e < 8; e++) oi(at + e * bl * 0.5, voiced[e % 3], bl * 0.42, 0.12);
    } else if (cue.ost === "pulse") {
      for (var q = 0; q < 4; q++) oi(at + q * bl, voiced[0] - 12, bl * 0.28, 0.18);
    } else if (cue.ost === "drive") {
      /* offbeats. The thing that makes a piece of music feel like it is
         being played AT something rather than in a room. */
      for (var d = 0; d < 4; d++) {
        oi(at + d * bl + bl * 0.5, voiced[(d + 1) % 3] + 12, bl * 0.3, 0.13);
      }
    }

    /* THE DRUM. Two patterns and no third: a heartbeat under the quiet
       cues and a march under the loud ones. */
    if (cue.drum === "soft") {
      tom(at, 0.22);
      tom(at + bl * 2, 0.16);
    } else if (cue.drum === "march") {
      for (var k = 0; k < 4; k++) tom(at + k * bl, k % 2 ? 0.18 : 0.30);
      clap(at + bl, 0.16); clap(at + bl * 3, 0.16);
    }

    if (cue.theme) {
      var notes = cue.theme === "frag" ? THEME_FRAG : THEME;
      var lift = cue.theme === "high" ? 12 : 0;
      var ti = INST[cue.themeInst] || organ;
      notes.forEach(function (nt) {
        if (nt[0] !== b) return;
        var m = 72 + cue.key + deg(nt[2], minor) + lift;
        ti(at + nt[1] * bl, m, nt[3] * bl, 0.38);
        /* THE OCTAVE UNDERNEATH. A tune doubled an octave down is the
           cheapest way to make a small sound big, and it is what a
           stand full of people does to a song by accident: the men sing
           it where they can reach it. */
        if (cue.double) organ(at + nt[1] * bl, m - 12, nt[3] * bl, 0.20);
      });
    }

    /* the rise under the trophy, once every eight bars */
    if (cue.choirIn && b === 0) {
      var s = ctx.createBufferSource();
      s.buffer = noiseBuf; s.loop = true;
      var bp = ctx.createBiquadFilter();
      bp.type = "bandpass"; bp.Q.value = 1.6;
      bp.frequency.setValueAtTime(220, at);
      bp.frequency.exponentialRampToValueAtTime(2600, at + barLen * 3);
      var g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, at);
      g.gain.exponentialRampToValueAtTime(0.04, at + barLen * 2.6);
      g.gain.exponentialRampToValueAtTime(0.0001, at + barLen * 3.4);
      s.connect(bp); bp.connect(g); out(g, 0.8);
      s.start(at); s.stop(at + barLen * 3.6);
    }

    bar++;
  }

  function tick() {
    if (!cue || !on || !ctx) return;
    var now = ctx.currentTime;
    var target = muted ? 0.0001
      : (now < duckUntil ? duckAmt : 1) * (cue.gain || 0.6) * volume;
    master.gain.setTargetAtTime(Math.max(0.0001, target), now, 0.22);
    while (nextBarAt < now + 0.6) {
      if (nextBarAt < now) nextBarAt = now + 0.06;   // recover from a stall
      scheduleBar(nextBarAt);
      nextBarAt += beatLen() * 4;
    }
  }

  /* ---------------------------------------------------------------
     7. WHAT THE CHAPTER CALLS
     --------------------------------------------------------------- */

  window.CupScore = {
    /* handed the chapter's own context and master node, so there is one
       output, one volume and one thing to wake up */
    init: function (context, outNode, opt) {
      if (!build(context, outNode, opt)) return false;
      if (!timer) timer = setInterval(tick, 120);
      return true;
    },

    /* Start, or move to, a cue. Moving between two of them fades the
       old one under the new rather than cutting: the bar the music is
       in finishes even though the piece has changed, which is what
       stops every screen transition sounding like a mistake. */
    play: function (name) {
      if (!built || !on) return;
      /* a round number instead of a name, for the three fixtures */
      if (typeof name === "number") name = ROUND_CUE[name] || ROUND_CUE[0];
      if (!CUES[name] || name === cueName) return;
      var fresh = !cue;
      cue = CUES[name];
      cueName = name;
      bar = 0;
      muted = false;
      var now = ctx.currentTime;
      if (fresh) {
        nextBarAt = now + 0.1;
        master.gain.cancelScheduledValues(now);
        master.gain.setValueAtTime(0.0001, now);
      } else {
        /* LET THE OLD ONE RING OUT, BUT NOT FOR A WHOLE BAR.

           Waiting for the next scheduled downbeat is the musical thing
           to do and, at ninety-six beats a minute, means up to two and
           a half seconds of the previous screen's music playing over
           the new screen. That is not a crossfade, it is a lag. The new
           cue comes in on the next BEAT instead: late enough that the
           notes already posted to the clock finish speaking, soon
           enough that it belongs to the screen she is looking at. */
        nextBarAt = Math.max(now + 0.08, Math.min(nextBarAt, now + beatLen()));
      }
      tick();
    },

    stop: function () {
      if (!built) return;
      cue = null; cueName = null;
      var now = ctx.currentTime;
      master.gain.cancelScheduledValues(now);
      master.gain.setValueAtTime(Math.max(0.0001, master.gain.value), now);
      master.gain.exponentialRampToValueAtTime(0.0001, now + 0.6);
    },

    /* the whole score pulled back for a moment — used when something
       in the game wants to be heard over it */
    duck: function (amt, secs) {
      if (!built || !ctx) return;
      duckAmt = amt === undefined ? 0.25 : amt;
      duckUntil = ctx.currentTime + (secs || 0.6);
    },

    mute: function (m) {
      muted = !!m;
      if (built) tick();
    },

    setOn: function (v) {
      on = !!v;
      if (!on) this.stop();
    },

    cue: function () { return cueName; },
    cues: CUES,
    round: function (n) { return ROUND_CUE[n] || ROUND_CUE[0]; },

    /* =====================================================================
       RENDER IT OFFLINE, SO IT CAN BE LISTENED TO

       The failure this exists for: a synth score that throws inside the
       note scheduler fails SILENTLY. Every oscillator after the throw
       simply never starts, the page reports nothing because the throw
       is inside a callback nobody is watching, and the chapter plays in
       total silence while every assertion about the music being on goes
       on passing.

       Handed an OfflineAudioContext, this lays the whole piece down at
       once rather than a bar ahead, because offline there is no "ahead"
       — the clock runs as fast as the samples can be computed.
       ===================================================================== */
    __render: function (name, seconds) {
      if (!built) return 0;
      if (typeof name === "number") name = ROUND_CUE[name] || ROUND_CUE[0];
      cue = CUES[name] || CUES.menu;
      cueName = name; bar = 0; muted = false;
      master.gain.cancelScheduledValues(0);
      master.gain.setValueAtTime((cue.gain || 0.6) * volume, 0);
      var at = 0.05, n = 0;
      while (at < seconds) { scheduleBar(at); at += beatLen() * 4; n++; }
      return n;
    },

    /* for a harness: what is playing, in what key, at what tempo, and
       whether the tune is actually being scheduled */
    debug: function () {
      if (!cue) return { cue: null, built: built, on: on };
      return {
        cue: cueName, built: built, on: on, muted: muted,
        key: cue.key, minor: !!cue.minor, bpm: cue.bpm,
        theme: cue.theme, themeInst: cue.themeInst,
        drum: cue.drum, bar: bar,
        gain: master ? +master.gain.value.toFixed(4) : 0,
        notes: THEME.length,
      };
    },
  };
})();
