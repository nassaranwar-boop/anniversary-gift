/* =========================================================================
   THE LONG WAY ROUND — THE SCORE

   Every chapter on this site synthesises its own sound and carries no
   audio files, and this one is no exception: there is not a sample in
   here. What there is, is a piece of music.

   ---------------------------------------------------------------------
   THE ARGUMENT

   One tune. It is called the walk theme and it is eight notes long:

        5  6  8  7  |  5  4  3  2  |  1

   It goes up to the octave, leans on the seventh, and then walks all the
   way back down to where it started. That is the title of the chapter,
   written as a melody, and it is the only melody in the game.

   Every place she goes plays it in different clothes. The blossom gets
   it on a piano, alone, in C major. The high meadow gets it on strings,
   in F, wide open. The stream turns it into water — the same notes,
   arpeggiated, high. The ridge holds it back for a full minute and then
   gives it to a choir when she reaches the top. The bridge will not play
   it at all: it plays an ostinato that ticks, and it hands her back one
   note of the theme for every plank she crosses, so that getting over
   the gorge IS the tune assembling itself under her feet.

   And then the trick the whole score is built on:

     **the lantern path is the blossom park in the relative minor.**

   Same seven notes, same theme, a different note called home. "Same
   place. Completely different light" is a line already in the writing,
   and A minor is what that line sounds like. The way there and the way
   back are not two pieces of music. They are one piece heard from two
   different years.

   The endings are the only places the theme is played in full, loud, by
   everything at once — because it is the only place in the story where
   the question gets answered.

   ---------------------------------------------------------------------
   HOW IT IS MADE

   - Six instruments, all built out of oscillators and one noise buffer:
     a piano (FM, two operators), strings (three detuned saws through a
     lowpass with a slow bow), a choir (triangles with vibrato through a
     formant band), brass (a saw stack with a filter envelope and a
     little drive), a bass, and a pluck.
   - One convolution reverb, whose impulse response is generated at load:
     noise under an exponential decay. This is the single thing that
     makes it sound like a room and not like a phone.
   - A lookahead scheduler. setInterval is far too jittery to play music
     with, so it only ever wakes up and posts notes onto the audio
     clock a quarter of a second early; the clock does the timing.
   - Cues crossfade. Walking from the meadow into the forest does not cut
     the music off, it moves the room.

   Everything is one file, adds nothing to the repo but this script, and
   turns off with the same switch as the rest of the chapter's sound.
   ========================================================================= */

(function () {
  "use strict";

  /* ---------------------------------------------------------------
     1. THE NOTES
     Degrees rather than note names, so one theme can be played in any
     key and either mode without being written out twice.
     --------------------------------------------------------------- */

  var MAJOR = [0, 2, 4, 5, 7, 9, 11];
  var MINOR = [0, 2, 3, 5, 7, 8, 10];

  /* degree 1 is the tonic, 8 is the octave above it, 0 is the seventh
     below — so a melody can lean under the tonic without special cases */
  function deg(n, minor) {
    var sc = minor ? MINOR : MAJOR;
    var oct = Math.floor((n - 1) / 7);
    var i = (((n - 1) % 7) + 7) % 7;
    return sc[i] + oct * 12;
  }

  function midi(m) { return 440 * Math.pow(2, (m - 69) / 12); }

  /* a triad on a scale degree, built by stacking scale thirds, so the
     chord quality falls out of the mode instead of being spelled */
  function triad(root, minor) {
    return [deg(root, minor), deg(root + 2, minor), deg(root + 4, minor)];
  }

  /* ---------------------------------------------------------------
     2. THE WALK THEME
     Bar, beat, degree, length in beats. Five bars of tune and three of
     air, because the air is what makes it feel like walking and not
     like a ringtone.
     --------------------------------------------------------------- */
  var THEME = [
    [0, 0, 5, 2], [0, 2, 6, 2],
    [1, 0, 8, 2], [1, 2, 7, 2],
    [2, 0, 5, 2], [2, 2, 4, 2],
    [3, 0, 3, 2], [3, 2, 2, 2],
    [4, 0, 1, 4],
  ];
  /* the first four notes only — used where she does not know yet how
     the phrase ends, which is most of the way there */
  var THEME_FRAG = THEME.slice(0, 4);

  /* ---------------------------------------------------------------
     3. THE CUES
     One per place. They are deliberately thin: a key, a mode, a tempo,
     a chord loop and which dress the theme is wearing. Everything else
     is generated, so the whole score stays one tune.
     --------------------------------------------------------------- */
  var CUES = {
    /* the blossom park, C major. The theme, once, on a piano, alone. */
    title: {
      key: 0, minor: false, bpm: 58, bars: 8,
      chords: [1, 6, 4, 5, 1, 6, 4, 5],
      theme: "full", themeInst: "piano",
      pad: "strings", padGain: 0.18, bass: true, ost: "none", gain: 0.62,
    },
    sakura: {
      key: 0, minor: false, bpm: 60, bars: 8,
      chords: [1, 6, 4, 5, 1, 6, 4, 5],
      theme: "full", themeInst: "piano",
      pad: "strings", padGain: 0.26, bass: true, ost: "arp", ostInst: "pluck", gain: 0.66,
    },

    /* the high meadow, F major — a fourth up and the widest thing in
       the score. Strings carry it; you can see the whole valley. */
    meadow: {
      key: 5, minor: false, bpm: 56, bars: 8,
      chords: [1, 5, 6, 4, 1, 5, 4, 1],
      theme: "full", themeInst: "strings",
      pad: "strings", padGain: 0.3, bass: true, ost: "eighths", ostInst: "piano", gain: 0.7,
    },

    /* the wood. She does not know what is in the trees, so the theme
       does not finish: four notes on plucks and then nothing. */
    forest: {
      key: 9, minor: true, bpm: 64, bars: 8,
      chords: [1, 1, 6, 6, 4, 4, 5, 5],
      theme: "frag", themeInst: "pluck",
      pad: "strings", padGain: 0.2, bass: true, ost: "arp", ostInst: "pluck", gain: 0.6,
    },
    hollow: {
      key: 9, minor: true, bpm: 62, bars: 8,
      chords: [1, 6, 4, 5, 1, 6, 4, 5],
      theme: "frag", themeInst: "piano",
      pad: "choir", padGain: 0.2, bass: true, ost: "none", gain: 0.58,
    },

    /* the stream. The theme becomes the water: same notes, high, and
       an arpeggio underneath that never stops moving. */
    stream: {
      key: 7, minor: false, bpm: 68, bars: 8,
      chords: [1, 5, 6, 4, 1, 5, 6, 4],
      theme: "high", themeInst: "piano",
      pad: "strings", padGain: 0.22, bass: true, ost: "arp", ostInst: "piano", gain: 0.66,
    },

    /* the lantern path. THE SAME SEVEN NOTES AS THE BLOSSOM PARK, with
       A called home instead of C. Same place, completely different
       light — that line is the whole score in one sentence. */
    lantern: {
      key: 9, minor: true, bpm: 52, bars: 8,
      chords: [1, 6, 3, 7, 1, 6, 4, 5],
      theme: "full", themeInst: "piano",
      pad: "choir", padGain: 0.3, bass: true, ost: "none", gain: 0.66,
    },

    /* the ridge. An hour of climbing: a held chord, a bass that moves
       once a bar, and no tune at all until the top. */
    ridge: {
      key: 2, minor: true, bpm: 48, bars: 8,
      chords: [1, 1, 6, 6, 4, 4, 5, 5],
      theme: null,
      pad: "choir", padGain: 0.4, bass: true, ost: "none", gain: 0.68, swellIn: true,
    },

    /* the bridge. It ticks. The theme is withheld entirely and handed
       back one note at a time, by her, as she crosses. */
    bridge: {
      key: 2, minor: true, bpm: 76, bars: 4,
      chords: [1, 1, 7, 7],
      theme: null,
      pad: "strings", padGain: 0.24, bass: true, ost: "pulse", ostInst: "pluck", gain: 0.6,
    },

    /* the orchard. Low, close, held breath. Nothing above middle C. */
    orchard: {
      key: 4, minor: true, bpm: 54, bars: 4,
      chords: [1, 1, 6, 6],
      theme: null,
      pad: "strings", padGain: 0.22, bass: true, ost: "pulse", ostInst: "pluck", gain: 0.56,
    },

    /* the sunset, and the first of the two endings. Everything, at
       last: the theme on strings with the choir under it. */
    sunset: {
      key: 0, minor: false, bpm: 54, bars: 8,
      chords: [1, 5, 6, 4, 1, 5, 4, 5],
      theme: "full", themeInst: "strings",
      pad: "choir", padGain: 0.34, bass: true, ost: "arp", ostInst: "piano",
      brass: true, gain: 0.78,
    },

    /* the door. The slowest statement in the score, and the only one
       that ends on the tonic with nothing else moving. */
    home: {
      key: 0, minor: false, bpm: 46, bars: 8,
      chords: [1, 5, 6, 4, 1, 4, 5, 1],
      theme: "full", themeInst: "piano",
      pad: "choir", padGain: 0.36, bass: true, ost: "none",
      brass: true, gain: 0.76,
    },
  };

  /* which cue a scene gets. Scenes without one keep the last. */
  var SCENE_CUE = {
    sakura: "sakura", forest: "forest", hollow: "hollow", meadow: "meadow",
    stream: "stream", sunset: "sunset", lantern: "lantern", ridge: "ridge",
    orchard: "orchard", bridge: "bridge", home: "home",
  };

  /* ---------------------------------------------------------------
     4. THE ROOM
     --------------------------------------------------------------- */

  var ctx = null, master = null, dry = null, wet = null, verb = null;
  var noiseBuf = null;
  var on = true, built = false;

  function audio() {
    if (ctx) return ctx;
    /* share the page's one context if script.js has offered it, so the
       ambience bed, the effects and the score all live in the same
       clock and one wake-up serves all three */
    if (typeof window.hvSharedCtx === "function") {
      try { ctx = window.hvSharedCtx(); } catch (e) { ctx = null; }
    }
    if (!ctx) {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    return ctx;
  }

  function build() {
    if (built) return true;
    var c = audio();
    if (!c) return false;

    master = c.createGain();
    master.gain.value = 0.0001;
    master.connect(c.destination);

    dry = c.createGain(); dry.gain.value = 0.82; dry.connect(master);
    wet = c.createGain(); wet.gain.value = 0.62;

    /* the impulse response: two channels of noise under an exponential
       decay, with the first few milliseconds left quiet so there is a
       gap between the note and the room answering it */
    verb = c.createConvolver();
    var len = Math.floor(c.sampleRate * 2.9);
    var ir = c.createBuffer(2, len, c.sampleRate);
    for (var ch = 0; ch < 2; ch++) {
      var d = ir.getChannelData(ch);
      var pre = Math.floor(c.sampleRate * 0.012);
      for (var i = 0; i < len; i++) {
        if (i < pre) { d[i] = 0; continue; }
        var t = (i - pre) / (len - pre);
        d[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, 2.6);
      }
    }
    verb.buffer = ir;
    verb.connect(wet); wet.connect(master);

    /* one second of noise, reused by every percussive thing here */
    noiseBuf = c.createBuffer(1, Math.floor(c.sampleRate), c.sampleRate);
    var nd = noiseBuf.getChannelData(0);
    for (var n = 0; n < nd.length; n++) nd[n] = Math.random() * 2 - 1;

    built = true;
    return true;
  }

  /* every voice goes through here, so the balance between the room and
     the instrument is set in exactly one place */
  function out(node, send) {
    node.connect(dry);
    var s = ctx.createGain();
    s.gain.value = send === undefined ? 0.5 : send;
    node.connect(s); s.connect(verb);
  }

  /* ---------------------------------------------------------------
     5. THE INSTRUMENTS
     Each schedules one note at an absolute time on the audio clock and
     then forgets about it. Nothing here is reused between notes, which
     is wasteful and completely fine at ten notes a second.
     --------------------------------------------------------------- */

  /* Two-operator FM. The modulator decays much faster than the carrier,
     which is the whole reason it reads as a struck string rather than a
     sine with an envelope on it. */
  function piano(t, m, dur, vel) {
    var f = midi(m);
    var car = ctx.createOscillator(); car.type = "sine"; car.frequency.value = f;
    var mod = ctx.createOscillator(); mod.type = "sine"; mod.frequency.value = f * 2.01;
    var mg = ctx.createGain();
    mg.gain.setValueAtTime(f * 1.9, t);
    mg.gain.exponentialRampToValueAtTime(f * 0.04, t + 0.42);
    mod.connect(mg); mg.connect(car.frequency);

    var g = ctx.createGain();
    var a = 0.006, rel = Math.max(0.7, dur * 0.9);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vel, t + a);
    g.gain.exponentialRampToValueAtTime(vel * 0.24, t + 0.5);
    g.gain.exponentialRampToValueAtTime(0.0001, t + rel);
    car.connect(g); out(g, 0.52);
    car.start(t); mod.start(t);
    car.stop(t + rel + 0.1); mod.stop(t + rel + 0.1);
  }

  /* Three saws a few cents apart through a lowpass that opens as the
     bow takes hold. The detune is the section; the slow attack is the
     bow. */
  function strings(t, m, dur, vel) {
    var f = midi(m);
    var g = ctx.createGain();
    var lp = ctx.createBiquadFilter();
    lp.type = "lowpass"; lp.Q.value = 0.6;
    lp.frequency.setValueAtTime(Math.max(400, f * 2), t);
    lp.frequency.linearRampToValueAtTime(Math.max(900, f * 5), t + dur * 0.5);

    var det = [-7, 0, 6];
    for (var i = 0; i < 3; i++) {
      var o = ctx.createOscillator();
      o.type = "sawtooth"; o.frequency.value = f; o.detune.value = det[i];
      var vib = ctx.createOscillator(); vib.type = "sine";
      vib.frequency.value = 4.6 + i * 0.3;
      var vg = ctx.createGain(); vg.gain.value = 3.5;
      vib.connect(vg); vg.connect(o.detune);
      o.connect(lp);
      o.start(t); o.stop(t + dur + 0.5);
      vib.start(t); vib.stop(t + dur + 0.5);
    }
    var atk = Math.min(0.42, dur * 0.35);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vel * 0.34, t + atk);
    g.gain.setValueAtTime(vel * 0.34, t + Math.max(atk, dur - 0.35));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.4);
    lp.connect(g); out(g, 0.72);
  }

  /* Triangles rather than saws, through a wide band around the vowel,
     with enough vibrato to be several people and not one. */
  function choir(t, m, dur, vel) {
    var f = midi(m);
    var bp = ctx.createBiquadFilter();
    bp.type = "bandpass"; bp.frequency.value = 780; bp.Q.value = 0.75;
    var g = ctx.createGain();

    for (var i = 0; i < 3; i++) {
      var o = ctx.createOscillator();
      o.type = i === 1 ? "sine" : "triangle";
      o.frequency.value = f; o.detune.value = (i - 1) * 9;
      var vib = ctx.createOscillator(); vib.type = "sine";
      vib.frequency.value = 5.1 + i * 0.42;
      var vg = ctx.createGain(); vg.gain.value = 6;
      vib.connect(vg); vg.connect(o.detune);
      o.connect(bp);
      o.start(t); o.stop(t + dur + 0.6);
      vib.start(t); vib.stop(t + dur + 0.6);
    }
    var atk = Math.min(0.75, dur * 0.45);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vel * 0.3, t + atk);
    g.gain.setValueAtTime(vel * 0.3, t + Math.max(atk, dur - 0.5));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.6);
    bp.connect(g); out(g, 0.95);
  }

  /* A saw stack pushed through a gentle curve, with the filter opening
     hard at the front. Used sparingly and only at the endings. */
  function brass(t, m, dur, vel) {
    var f = midi(m);
    var sh = ctx.createWaveShaper();
    var curve = new Float32Array(1024);
    for (var i = 0; i < 1024; i++) {
      var x = (i / 512) - 1;
      curve[i] = Math.tanh(x * 2.2);
    }
    sh.curve = curve;
    var lp = ctx.createBiquadFilter();
    lp.type = "lowpass"; lp.Q.value = 1.1;
    lp.frequency.setValueAtTime(f * 1.2, t);
    lp.frequency.exponentialRampToValueAtTime(Math.max(1200, f * 6), t + 0.22);
    lp.frequency.exponentialRampToValueAtTime(Math.max(700, f * 3), t + dur);

    for (var k = 0; k < 2; k++) {
      var o = ctx.createOscillator();
      o.type = "sawtooth"; o.frequency.value = f; o.detune.value = k ? 8 : -8;
      o.connect(sh);
      o.start(t); o.stop(t + dur + 0.4);
    }
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vel * 0.2, t + 0.14);
    g.gain.setValueAtTime(vel * 0.2, t + Math.max(0.2, dur - 0.3));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.35);
    sh.connect(lp); lp.connect(g); out(g, 0.6);
  }

  function bassNote(t, m, dur, vel) {
    var f = midi(m);
    var o = ctx.createOscillator(); o.type = "sine"; o.frequency.value = f;
    var o2 = ctx.createOscillator(); o2.type = "triangle"; o2.frequency.value = f * 2;
    var g2 = ctx.createGain(); g2.gain.value = 0.16;
    o2.connect(g2);
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vel * 0.55, t + 0.05);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.3);
    o.connect(g); g2.connect(g); out(g, 0.24);
    o.start(t); o2.start(t);
    o.stop(t + dur + 0.4); o2.stop(t + dur + 0.4);
  }

  function pluck(t, m, dur, vel) {
    var f = midi(m);
    var o = ctx.createOscillator(); o.type = "triangle"; o.frequency.value = f;
    var lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.setValueAtTime(f * 5, t);
    lp.frequency.exponentialRampToValueAtTime(f * 1.4, t + 0.25);
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vel * 0.4, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + Math.min(1.1, dur));
    o.connect(lp); lp.connect(g); out(g, 0.55);
    o.start(t); o.stop(t + Math.min(1.2, dur) + 0.1);
  }

  var INST = { piano: piano, strings: strings, choir: choir, brass: brass, pluck: pluck };

  /* the slow rise under the ridge, and the one under the endings */
  function swell(t, dur, vel) {
    var src = ctx.createBufferSource();
    src.buffer = noiseBuf; src.loop = true;
    var bp = ctx.createBiquadFilter();
    bp.type = "bandpass"; bp.Q.value = 1.8;
    bp.frequency.setValueAtTime(160, t);
    bp.frequency.exponentialRampToValueAtTime(2400, t + dur);
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vel, t + dur * 0.85);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.7);
    src.connect(bp); bp.connect(g); out(g, 0.9);
    src.start(t); src.stop(t + dur + 0.8);
  }

  /* what the orchard turns into when the bear looks up */
  function heartbeat(t, vel) {
    [0, 0.34].forEach(function (o, i) {
      var osc = ctx.createOscillator(); osc.type = "sine";
      osc.frequency.setValueAtTime(74, t + o);
      osc.frequency.exponentialRampToValueAtTime(42, t + o + 0.16);
      var g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t + o);
      g.gain.exponentialRampToValueAtTime(vel * (i ? 0.6 : 1), t + o + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + o + 0.3);
      osc.connect(g); out(g, 0.3);
      osc.start(t + o); osc.stop(t + o + 0.35);
    });
  }

  /* ---------------------------------------------------------------
     6. THE SCHEDULER
     setInterval cannot keep musical time — it drifts and it stalls
     behind a busy frame. It is only used to wake up often enough to
     post the next quarter of a second of notes onto the audio clock,
     which is the thing that actually keeps time.
     --------------------------------------------------------------- */

  var cue = null, cueName = null;
  var bar = 0, nextBarAt = 0, timer = null;
  var themeCursor = 0;          // for the bridge, which is handed the theme note by note
  var duckUntil = 0, duckAmt = 1;

  /* THE TEMPO IS EASED, NOT SNAPPED.

     Walking from the meadow (58) into the ridge (76) used to change the
     beat between one bar and the next, which is a cut however softly the
     gain behind it fades. `bpmNow` walks toward the new cue's tempo a
     bar at a time, so the pulse bends into the new place instead of
     jumping to it. */
  var bpmNow = 0;
  function beatLen() {
    if (!bpmNow) bpmNow = cue.bpm;
    return 60 / bpmNow;
  }
  function easeBpm() {
    if (!cue) return;
    if (!bpmNow) { bpmNow = cue.bpm; return; }
    bpmNow += (cue.bpm - bpmNow) * 0.34;
    if (Math.abs(cue.bpm - bpmNow) < 0.4) bpmNow = cue.bpm;
  }

  var soloTheme = false;      // set by the offline renderer, for checking the tune

  function scheduleBar(at) {
    var b = bar % cue.bars;
    var chord = cue.chords[b % cue.chords.length];
    var minor = cue.minor;
    var root = 48 + cue.key + deg(chord, minor);     // C3 as the floor
    /* The triad, voiced around middle C and spelled out of the scale
       rather than by stacking fixed intervals — so a chord on the sixth
       degree comes out minor in a major key without anyone writing that
       down, and the whole progression stays inside the mode. */
    var voiced = [0, 2, 4].map(function (add) {
      return 60 + cue.key + deg(chord + add, minor);
    });

    var bl = beatLen(), barLen = bl * 4;

    /* the pad holds the chord for the whole bar */
    if (!soloTheme && cue.pad && INST[cue.pad]) {
      voiced.forEach(function (m, i) {
        INST[cue.pad](at, m + (i === 0 ? 0 : 0), barLen * 0.98, (cue.padGain || 0.25) * (i ? 0.8 : 1));
      });
    }

    if (cue.bass && !soloTheme) {
      bassNote(at, root - 12, barLen * 0.6, 0.5);
      if (cue.ost === "pulse") bassNote(at + bl * 2, root - 12, bl * 1.4, 0.34);
    }

    /* the moving part underneath */
    var oi = INST[cue.ostInst] || pluck;
    if (soloTheme) { /* nothing under the tune */ }
    else if (cue.ost === "arp") {
      for (var i = 0; i < 8; i++) {
        var m = voiced[i % 3] + (i >= 4 ? 12 : 0);
        oi(at + i * bl * 0.5, m, bl * 0.5, 0.16);
      }
    } else if (cue.ost === "eighths") {
      for (var e = 0; e < 4; e++) oi(at + e * bl, voiced[e % 3], bl * 0.8, 0.13);
    } else if (cue.ost === "pulse") {
      /* the tick. Four to the bar, dead even, no melody — the sound of
         something that will not wait for you. */
      for (var p = 0; p < 4; p++) oi(at + p * bl, voiced[0] - 12, bl * 0.3, 0.2);
    }

    /* the theme, if this place is playing it */
    if (cue.theme) {
      var notes = cue.theme === "frag" ? THEME_FRAG : THEME;
      var lift = cue.theme === "high" ? 12 : 0;
      var ti = INST[cue.themeInst] || piano;
      notes.forEach(function (nt) {
        if (nt[0] !== b) return;
        ti(at + nt[1] * bl, 72 + cue.key + deg(nt[2], minor) + lift, nt[3] * bl, 0.34);
      });
      /* the brass doubles the last resolve, an octave down, at the
         endings only */
      if (cue.brass) {
        THEME.forEach(function (nt) {
          if (nt[0] !== b || nt[2] !== 1) return;
          brass(at + nt[1] * bl, 48 + cue.key + deg(1, minor), nt[3] * bl, 0.5);
        });
      }
    }

    if (cue.swellIn && b === 0 && !soloTheme) swell(at, barLen * 3.4, 0.05);

    bar++;
  }

  function tick() {
    if (!cue || !on) return;
    var now = ctx.currentTime;
    /* ducking: the orchard pulls the whole score back to almost nothing
       while the bear has its head up */
    var target = now < duckUntil ? duckAmt : 1;
    master.gain.setTargetAtTime((cue.gain || 0.7) * 0.36 * target, now, 0.25);

    while (nextBarAt < now + 0.6) {
      if (nextBarAt < now) nextBarAt = now + 0.06;   // recover from a stall
      scheduleBar(nextBarAt);
      easeBpm();
      nextBarAt += beatLen() * 4;
    }
  }

  /* ---------------------------------------------------------------
     7. WHAT THE GAME CALLS
     --------------------------------------------------------------- */

  var OST = {
    /* Start, or move to, the cue for a scene. Moving between two cues
       fades the old one out under the new one rather than cutting. */
    /* Takes a scene name, or a cue name directly for the few moments
       that are not simply "wherever she is standing". */
    play: function (scene) {
      if (!on) return;
      var name = SCENE_CUE[scene] || (CUES[scene] ? scene : null);
      if (!name || name === cueName) return;
      if (!build()) return;
      try {
        if (ctx.state !== "running") {
          if (window.wakeAudio) window.wakeAudio(ctx); else ctx.resume();
        }
        var fresh = !cue;
        var prevBar = bar;
        cue = CUES[name];
        cueName = name;
        /* KEEP THE PLACE IN THE PHRASE.

           This used to set `bar = 0` and start the next bar 50ms later,
           so a scene change chopped the current bar in half and dropped
           the new key in on the off-beat — which is the jump. The bar
           already scheduled is allowed to finish, and the new cue picks
           up at the same point in its own eight, so the harmony turns
           over on the bar line the way a modulation does. */
        bar = fresh ? 0 : (prevBar % (cue.bars || 8));
        themeCursor = 0;
        if (fresh) {
          bpmNow = cue.bpm;
          nextBarAt = ctx.currentTime + 0.25;
          master.gain.setValueAtTime(0.0001, ctx.currentTime);
          master.gain.setTargetAtTime((cue.gain || 0.7) * 0.36, ctx.currentTime, 1.6);
        } else {
          /* leave nextBarAt where it is: the change lands on the next bar */
          if (nextBarAt < ctx.currentTime) nextBarAt = ctx.currentTime + 0.06;
          /* and dip through the turn, so the new key arrives under a
             breath rather than in the open */
          var g = (cue.gain || 0.7) * 0.36, t0 = ctx.currentTime;
          master.gain.cancelScheduledValues(t0);
          master.gain.setValueAtTime(master.gain.value, t0);
          master.gain.linearRampToValueAtTime(g * 0.45, t0 + 0.28);
          master.gain.linearRampToValueAtTime(g, t0 + 1.5);
        }
        if (!timer) timer = setInterval(tick, 60);
        tick();
      } catch (e) { /* the score is a bonus, never a blocker */ }
    },

    /* LEAVING THE PAGE, AND COMING BACK TO IT.

       Suspending the AudioContext is not enough on its own. The
       scheduler is a setInterval, and setInterval keeps running in a
       hidden tab: it would go on posting bars onto a clock that has
       stopped, and then hand the whole backlog to the speakers at once
       the moment you came back. So the interval stops too, and the bar
       clock is re-anchored to whatever the audio clock says on return
       rather than to where it was when you left. */
    hush: function () {
      if (timer) { clearInterval(timer); timer = null; }
      if (master && ctx) {
        try { master.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.08); } catch (e) {}
      }
    },

    /* The site calls this once it has seen the clock running again, so
       there is no waiting for a resume to land here and no scheduling
       onto a frozen clock.

       There used to be a `wasPlaying` flag, set on the way out and
       required on the way back, which is a memory of a fact that is
       already written down: a cue is set by play() and cleared by
       stop(), so "there is a cue" IS "it was playing". The flag could
       only ever disagree with it, and a flag that disagrees with the
       truth in the direction of false is a score that never comes back.

       And the re-anchoring only happens if the scheduler really is
       stopped. Coming back fires more than once — the tab, then the
       window, then the first touch — and rewinding the bar clock under
       bars an earlier call had already posted made the music stumble on
       the way in. */
    resume: function () {
      if (!on || !cue || !built) return;
      try {
        if (ctx.state !== "running") {
          if (window.wakeAudio) window.wakeAudio(ctx); else ctx.resume();
        }
        master.gain.setTargetAtTime((cue.gain || 0.7) * 0.36, ctx.currentTime, 0.5);
        if (!timer) {
          bar = 0;                     // start the loop again from its top
          nextBarAt = ctx.currentTime + 0.15;
          timer = setInterval(tick, 60);
          tick();
        }
      } catch (e) {}
    },

    stop: function () {
      if (timer) { clearInterval(timer); timer = null; }
      cue = null; cueName = null;
      if (master && ctx) {
        try { master.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.4); } catch (e) {}
      }
    },

    /* pull the music back for a moment — the bear looking up, mostly */
    duck: function (amount, seconds) {
      if (!ctx) return;
      duckAmt = amount;
      duckUntil = ctx.currentTime + (seconds || 0.6);
    },

    /* One-off gestures the game fires at moments. `step` is the
       important one: crossing the bridge hands her the walk theme a
       note at a time, so the tune assembles under her feet. */
    hit: function (what, n) {
      if (!on || !built || !cue) return;
      try {
        var t = ctx.currentTime + 0.01, minor = cue.minor;
        if (what === "step") {
          var nt = THEME[themeCursor % THEME.length];
          themeCursor++;
          piano(t, 72 + cue.key + deg(nt[2], minor), 1.1, 0.4);
          strings(t, 60 + cue.key + deg(nt[2], minor), 1.4, 0.22);
        } else if (what === "stone") {
          /* seven stones, seven steps up the scale */
          piano(t, 72 + cue.key + deg(1 + (n || 0), minor), 0.7, 0.32);
        } else if (what === "slip") {
          piano(t, 72 + cue.key + deg(2, minor) - 1, 0.5, 0.26);
        } else if (what === "seen") {
          OST.duck(0.25, 2.2);
          heartbeat(t, 0.5);
          heartbeat(t + 0.9, 0.4);
        } else if (what === "heart") {
          heartbeat(t, 0.34);
        } else if (what === "swell") {
          swell(t, 2.6, 0.07);
        } else if (what === "yes") {
          /* the only fortissimo in the game */
          swell(t, 1.4, 0.09);
          [1, 3, 5, 8].forEach(function (d, i) {
            brass(t + 0.35, 48 + cue.key + deg(d, minor), 3.4, 0.5 - i * 0.05);
            choir(t + 0.35, 72 + cue.key + deg(d, minor), 3.6, 0.4);
          });
        }
      } catch (e) {}
    },

    /* Offline rendering. An OfflineAudioContext has no wall clock, so
       the setInterval scheduler is useless to it — this schedules a
       whole stretch of a cue at absolute times in one go, through the
       same generator the live game uses, so what gets written to a file
       is the real music and not a reimplementation of it. */
    __render: function (name, seconds, solo) {
      if (!build()) return 0;
      soloTheme = !!solo;
      cue = CUES[SCENE_CUE[name] || name] || CUES.sakura;
      cueName = name;
      bar = 0; themeCursor = 0;
      master.gain.value = (cue.gain || 0.7) * 0.36;
      var at = 0.05, n = 0;
      while (at < seconds) { scheduleBar(at); at += beatLen() * 4; n++; }
      soloTheme = false;
      return n;
    },

    setOn: function (v) {
      on = !!v;
      if (!on) OST.stop();
    },
    isOn: function () { return on; },
    /* for the tools: what is playing, and is it actually making notes */
    debug: function () {
      return { cue: cueName, bar: bar, running: !!timer, built: built,
               state: ctx ? ctx.state : "none" };
    },
    /* what the theme should come out as, in MIDI, for a given cue —
       so a test can check the tune rather than just the noise level */
    __expect: function (name) {
      var c = CUES[SCENE_CUE[name] || name];
      if (!c || !c.theme) return [];
      var notes = c.theme === "frag" ? THEME_FRAG : THEME;
      var lift = c.theme === "high" ? 12 : 0;
      var bl = 60 / c.bpm;
      return notes.map(function (nt) {
        return { at: 0.05 + (nt[0] * 4 + nt[1]) * bl,
                 midi: 72 + c.key + deg(nt[2], c.minor) + lift,
                 beats: nt[3], dur: nt[3] * bl };
      });
    },
    cues: CUES,
    sceneCue: SCENE_CUE,
    theme: THEME,
  };

  window.OST = OST;
})();
