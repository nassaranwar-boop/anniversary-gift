/* =========================================================================
   OUISSY'S CUP — THE CROWD SINGS

   An original terrace anthem per ground, mixed live against the crowd's
   energy. Nothing here is a recording and nothing here is derived from
   an existing song: a motif is a handful of scale degrees, a
   progression is a sequence of chords, and neither of those is a thing
   anybody owns. Every ground gets its own key, tempo and motif so that
   changing stadium changes how the place FEELS, not just how it looks.

   WHY IT IS SYNTHESISED RATHER THAN PLAYED. This site ships no audio
   files at all — every sound in it, in every chapter, is made in the
   browser at runtime, and a five-layer anthem per team would be thirty
   files. The config is still shaped for stems, so a licensed track can
   be dropped in later without touching this file: the mixer prefers a
   file where one exists and uses the synthesised voice where it does
   not.

   THE FIVE LAYERS, which is what makes it feel alive rather than
   looped. Each is its own gain node and each fades in at its own point
   on the energy curve:

     1  ambience   murmur and distant claps. Always on, always quiet.
     2  pulse      the terrace clap and a bass drum under it.
     3  hum        the motif hummed low, for when they are interested.
     4  chant      the motif sung out over a chord bed. Full voice.
     5  peaks      roars, whistles, horns. One-shots, never looped.

   THE ONE TRICK WORTH NAMING. A goal is not the loudest thing in a
   stadium; the SILENCE before it is what makes it loud. So a super shot
   ducks everything to a held breath — filtered down to almost nothing,
   rising — and releases on contact. Quiet, then everything. That
   contrast is where the goosebumps live and it is the reason the
   ducking code exists at all.
   ========================================================================= */
window.CupChant = (function () {
  "use strict";

  var AC = null, out = null, bus = null, verb = null;
  var L = {};                       // the five layers' gain nodes
  var on = false, muted = false;
  var E = 0.25, phase = "idle";
  var anthem = null;
  var timer = null;
  var nextBar = 0, bar = 0;
  var duck = 0;                     // 0 normal, 1 fully held breath

  /* ------------------------------------------------------------- theory
     Everything is worked out from a root in Hz and a scale, so a team's
     "key" is one number and its mood is which scale it uses. Minor for
     storm and defiance, major for anthems and warmth — which is not a
     rule about music so much as a rule about what people expect. */
  var SCALES = {
    minor: [0, 2, 3, 5, 7, 8, 10],
    major: [0, 2, 4, 5, 7, 9, 11],
  };
  /* progressions by mood. A chord is a scale degree; the shapes are the
     common ones because common is what a crowd can sing over. */
  var PROGS = {
    "anthemic-uplifting": [0, 4, 5, 3],
    "dark-stormy-epic":   [0, 5, 2, 6],
    "tense-driving":      [0, 6, 3, 4],
    "warm-nostalgic":     [3, 0, 4, 0],
    "defiant-underdog":   [0, 3, 0, 4],
  };

  function hz(root, scale, deg, oct) {
    var s = SCALES[scale] || SCALES.minor;
    var n = s[((deg % s.length) + s.length) % s.length]
          + 12 * Math.floor(deg / s.length) + 12 * (oct || 0);
    return root * Math.pow(2, n / 12);
  }

  /* ------------------------------------------------------------- plumbing */
  /* ONE SHORT BUFFER, MADE ONCE. The breath on the front of a sung
     note happens several times a bar, and building a fresh second of
     random numbers each time is a quarter of a million calls to
     Math.random a second for a sound nobody can hear on its own. */
  var SHORTNOISE = null;
  function shortNoise() {
    if (!SHORTNOISE) SHORTNOISE = noise(0.3);
    return SHORTNOISE;
  }

  function noise(seconds) {
    var n = Math.floor(AC.sampleRate * (seconds || 1));
    var b = AC.createBuffer(1, n, AC.sampleRate);
    var d = b.getChannelData(0);
    for (var i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    return b;
  }

  /* A STADIUM IS A BIG ROOM, and the single thing that makes a crowd
     sound like it is in one is a long, dark tail on everything. The
     impulse is generated rather than loaded, which is a few lines and
     no file. */
  function impulse(secs, decay) {
    var n = Math.floor(AC.sampleRate * secs);
    var b = AC.createBuffer(2, n, AC.sampleRate);
    for (var c = 0; c < 2; c++) {
      var d = b.getChannelData(c);
      for (var i = 0; i < n; i++) {
        d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, decay);
      }
    }
    return b;
  }

  function gain(v, to) {
    var g = AC.createGain();
    g.gain.value = v;
    g.connect(to || bus);
    return g;
  }

  /* ------------------------------------------------------------------ init */
  function init(ac, destination, opts) {
    if (AC || !ac) return;
    AC = ac;
    SHORTNOISE = null;          // a buffer belongs to the context it was made in
    out = AC.createGain();
    out.gain.value = (opts && opts.volume) || 0.9;
    out.connect(destination || AC.destination);

    /* the crowd bus: everything the ground makes goes through one
       reverb, because two reverbs is two rooms */
    bus = AC.createGain(); bus.gain.value = 1;
    verb = AC.createConvolver();
    /* A SHORTER, DRIER ROOM. Two and a bit seconds of tail with a
       choir in it is a cathedral, and a cathedral is a genre. A
       stadium bowl is a fast, hard slap — and once there is a band in
       front of it, the reverb's job is to put the CROWD behind the
       band rather than to make everything enormous. */
    verb.buffer = impulse(1.3, 2.2);
    var wet = AC.createGain(); wet.gain.value = 0.22;
    var dry = AC.createGain(); dry.gain.value = 0.92;
    bus.connect(dry); dry.connect(out);
    bus.connect(verb); verb.connect(wet); wet.connect(out);

    /* AND A RUMBLE UNDER IT ALL. A roar you feel is a roar with
       something under eighty hertz in it; without that it is a hiss. */
    L.ambience = gain(0.0);
    L.pulse = gain(0.0);
    L.hum = gain(0.0);
    L.chant = gain(0.0);
    L.peaks = gain(0.9);
    /* THE BAND, AND WHY IT HAS ITS OWN ROUTE.

       The crowd goes through a two-second convolution because a crowd
       is a thing you hear bouncing off a concrete bowl. A kick drum
       through the same reverb is mud, and a snare through it is a
       gunshot in a cave — which, with a choir over the top, is exactly
       how you score a thriller. The rhythm section is nearly dry and
       sits in front; the crowd sings behind it, in the room. That
       separation is most of the difference between a stadium with a
       band playing in it and a cathedral. */
    L.band = AC.createGain(); L.band.gain.value = 0.0;
    var bandDry = AC.createGain(); bandDry.gain.value = 1.0;
    var bandWet = AC.createGain(); bandWet.gain.value = 0.10;
    L.band.connect(bandDry); bandDry.connect(out);
    L.band.connect(bandWet); bandWet.connect(verb);

    startAmbience();
    on = true;
    schedule();
  }

  var ambSrc = null;
  function startAmbience() {
    ambSrc = AC.createBufferSource();
    ambSrc.buffer = noise(3); ambSrc.loop = true;
    var f = AC.createBiquadFilter();
    f.type = "bandpass"; f.frequency.value = 480; f.Q.value = 0.55;
    ambSrc.connect(f); f.connect(L.ambience);
    ambSrc.start();
  }

  /* ------------------------------------------------------------- the voices */
  /* ONE VOICE IS A SYNTH; TWENTY SLIGHTLY WRONG ONES ARE A CROWD.

     A crowd does not sing in tune and does not start together. Three
     detuned oscillators with a few milliseconds between them is the
     whole of the difference between "a stadium" and "a keyboard". */
  /* =======================================================================
     WHAT MAKES A CROWD SOUND LIKE A CROWD

     Three detuned oscillators through a lowpass is a synth pad. It is
     not people, and the ear knows immediately, because the four things
     that actually identify a crowd are all things a pad does not do.

     THEY ARE NOT IN TUNE. Not slightly — a stand full of people spans
     the better part of a semitone, and the spread is what produces the
     thick, beating, slightly sour sound that is instantly recognisable
     as a lot of human beings. Three voices six cents apart is a chorus
     pedal; seven voices spread over forty cents is a terrace.

     THEY ARE NOT TOGETHER. The back of a stand is a tenth of a second
     behind the front on sound alone, and nobody is counting anyway. The
     onsets are scattered, and the scatter is wider on the first note of
     a phrase than in the middle of it, because that is where people
     actually join in.

     THEY SING VOWELS. This is the big one. A vowel is not a filter
     cutoff, it is two RESONANT PEAKS at particular frequencies — the
     formants — and shifting those two peaks is the whole difference
     between "oh" and "ay". A crowd anthem is sung on open vowels
     precisely because they carry, so the engine sings "oh" low and
     opens towards "ah" as it gets louder, which is what people do when
     they start shouting.

     AND THEY BREATHE. A short burst of filtered noise on the front of
     each note, under everything else. It is almost inaudible on its own
     and it is most of what stops the result sounding like an organ.
     ======================================================================= */

  /* two formants per vowel: [F1, F2]. "oh" is closed and dark, "ah" is
     open and bright, "ay" is in between and has the most edge. */
  var VOWELS = { oh: [480, 900], ah: [730, 1180], ay: [620, 1700] };

  function voices(f, t, dur, vol, pan, drive, count) {
    var p = AC.createStereoPanner ? AC.createStereoPanner() : null;
    var head = AC.createGain(); head.gain.value = 1;

    /* THE VOWEL OPENS AS THEY GET LOUDER. At a murmur they are singing
       "oh" with their mouths half shut; at full voice they are on "ah"
       with their heads back, and the second formant climbing eight
       hundred hertz is what that sounds like. */
    var vw = drive > 0.66 ? VOWELS.ah : (drive > 0.33 ? VOWELS.ay : VOWELS.oh);
    var band = [];
    for (var bi = 0; bi < 2; bi++) {
      var bp = AC.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.value = vw[bi];
      bp.Q.value = bi ? 3.2 : 2.4;
      var bg = AC.createGain();
      bg.gain.value = bi ? 0.55 : 1;
      bp.connect(bg); bg.connect(head);
      band.push(bp);
    }
    /* and a little of the raw sound past the formants, or it is a
       vocoder rather than a voice */
    var thru = AC.createBiquadFilter();
    thru.type = "lowpass";
    thru.frequency.value = 900 + drive * 2600;
    var tg = AC.createGain(); tg.gain.value = 0.34;
    thru.connect(tg); tg.connect(head);

    if (p) { head.connect(p); p.connect(L.chant); } else head.connect(L.chant);

    var n = count || 7;
    for (var v = 0; v < n; v++) {
      var o = AC.createOscillator();
      /* saw at full voice, triangle at a hum: the harmonics ARE the
         difference between singing and shouting */
      o.type = drive > 0.5 ? "sawtooth" : "triangle";
      /* HALF A SEMITONE OF SPREAD. Deliberately far more than a choir. */
      var cents = (v / (n - 1) - 0.5) * 44 + (Math.random() - 0.5) * 12;
      o.frequency.value = f * Math.pow(2, cents / 1200);

      /* everybody wobbles, and nobody wobbles at the same rate */
      var vib = AC.createOscillator(); vib.type = "sine";
      vib.frequency.value = 4.4 + Math.random() * 2.2;
      var vg = AC.createGain(); vg.gain.value = 5 + Math.random() * 6;
      vib.connect(vg); vg.connect(o.detune);

      var g = AC.createGain();
      /* the scatter, wider at the start of a note than inside it */
      var t0 = t + Math.random() * 0.075;
      var peak = vol / Math.sqrt(n);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(peak, t0 + 0.05 + Math.random() * 0.06);
      g.gain.setValueAtTime(peak, t0 + dur * 0.72);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

      o.connect(g);
      g.connect(band[0]); g.connect(band[1]); g.connect(thru);
      o.start(t0); o.stop(t0 + dur + 0.06);
      vib.start(t0); vib.stop(t0 + dur + 0.06);
    }

    /* THE BREATH. Almost inaudible alone; most of what stops this
       sounding like an organ. */
    var s2 = AC.createBufferSource(); s2.buffer = shortNoise();
    var nb = AC.createBiquadFilter();
    nb.type = "bandpass"; nb.frequency.value = 1400; nb.Q.value = 0.7;
    var ng = AC.createGain();
    ng.gain.setValueAtTime(vol * 0.24, t);
    ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.13);
    s2.connect(nb); nb.connect(ng); ng.connect(head);
    s2.start(t); s2.stop(t + 0.16);
  }

  /* the old name, kept because the rest of the file and the harnesses
     call it. `bright` was a boolean; it is a continuous drive now, so a
     crowd can be halfway to shouting rather than one or the other. */
  function sing(f, t, dur, vol, pan, bright) {
    voices(f, t, dur, vol, pan, typeof bright === "number" ? bright : (bright ? 0.8 : 0.3));
  }

  function hummed(f, t, dur, vol) {
    var o = AC.createOscillator(); o.type = "sine";
    o.frequency.value = f / 2;
    var g = AC.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.14);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(L.hum);
    o.start(t); o.stop(t + dur + 0.05);
  }

  function chordBed(root, t, dur, vol) {
    for (var i = 0; i < 3; i++) {
      var o = AC.createOscillator(); o.type = "sawtooth";
      o.frequency.value = root * Math.pow(2, [0, 3, 7][i] / 12) / 2;
      var lp = AC.createBiquadFilter();
      lp.type = "lowpass"; lp.frequency.value = 900;
      var g = AC.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(vol / 3, t + dur * 0.25);
      g.gain.linearRampToValueAtTime(0.0001, t + dur);
      o.connect(lp); lp.connect(g); g.connect(L.chant);
      o.start(t); o.stop(t + dur + 0.05);
    }
  }

  function clap(t, vol, pan) {
    var s = AC.createBufferSource(); s.buffer = noise(0.2);
    var f = AC.createBiquadFilter();
    f.type = "bandpass"; f.frequency.value = 1500; f.Q.value = 1.1;
    var g = AC.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.13);
    var p = AC.createStereoPanner ? AC.createStereoPanner() : null;
    s.connect(f); f.connect(g);
    if (p) { p.pan.value = pan || 0; g.connect(p); p.connect(L.pulse); }
    else g.connect(L.pulse);
    s.start(t); s.stop(t + 0.2);
  }

  function drum(t, vol) {
    var o = AC.createOscillator(); o.type = "sine";
    o.frequency.setValueAtTime(90, t);
    o.frequency.exponentialRampToValueAtTime(42, t + 0.16);
    var g = AC.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.26);
    o.connect(g); g.connect(L.pulse);
    o.start(t); o.stop(t + 0.3);
  }

  /* =======================================================================
     THE BAND

     What was here was a choir, a sustained chord bed and a long
     reverb. Those three things together are not "a crowd singing" —
     they are the standard recipe for scoring a thriller, which is
     exactly what it sounded like. Every one of the records this is
     meant to stand next to is a BAND, and a band is four things this
     did not have:

       A BACKBEAT. A snare on two and four. This is the single biggest
       omission: without it nothing can feel like pop music, because
       the backbeat is what pop music IS. A kick and a clap on their
       own read as a ritual, not a song.

       HI-HATS. Eighths, with the offbeats louder than the downbeats.
       They are almost inaudible alone and they are the entire reason a
       track feels like it is MOVING rather than sitting there.

       A BASS THAT WALKS. A held root is a drone and a drone is film
       music. A bass that plays root-root-fifth-octave, syncopated,
       pulls the whole bar forward.

       STABS, NOT PADS. A chord played SHORT and slightly late is a
       band hitting it. The same chord held for four beats is a string
       section, and a string section is a different genre.
     ======================================================================= */

  /* the kick: a sine dropping fast, with a click on the front so it
     cuts through on a phone speaker that cannot reproduce the sine */
  function kick(t, vol) {
    var o = AC.createOscillator(); o.type = "sine";
    o.frequency.setValueAtTime(150, t);
    o.frequency.exponentialRampToValueAtTime(44, t + 0.055);
    var g = AC.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.20);
    o.connect(g); g.connect(L.band);
    o.start(t); o.stop(t + 0.24);
    var c = AC.createBufferSource(); c.buffer = shortNoise();
    var cf = AC.createBiquadFilter();
    cf.type = "highpass"; cf.frequency.value = 1800;
    var cg = AC.createGain();
    cg.gain.setValueAtTime(vol * 0.18, t);
    cg.gain.exponentialRampToValueAtTime(0.0001, t + 0.012);
    c.connect(cf); cf.connect(cg); cg.connect(L.band);
    c.start(t); c.stop(t + 0.03);
  }

  /* THE SNARE. Noise through two bands — a body around 200 and a crack
     up at 1800 — with a short tuned thump under it. On two and four,
     for ever, because that is the deal. */
  function snare(t, vol) {
    var n = AC.createBufferSource(); n.buffer = shortNoise();
    var hp = AC.createBiquadFilter();
    hp.type = "highpass"; hp.frequency.value = 700;
    var bp = AC.createBiquadFilter();
    bp.type = "bandpass"; bp.frequency.value = 1900; bp.Q.value = 0.7;
    var g = AC.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.13);
    n.connect(hp); hp.connect(bp); bp.connect(g); g.connect(L.band);
    n.start(t); n.stop(t + 0.16);
    var o = AC.createOscillator(); o.type = "triangle";
    o.frequency.setValueAtTime(220, t);
    o.frequency.exponentialRampToValueAtTime(150, t + 0.05);
    var og = AC.createGain();
    og.gain.setValueAtTime(vol * 0.5, t);
    og.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
    o.connect(og); og.connect(L.band);
    o.start(t); o.stop(t + 0.09);
  }

  /* the hat. Twelve milliseconds of bright noise, and the offbeat one
     is louder than the downbeat one — which is the groove. */
  function hat(t, vol, open) {
    var n = AC.createBufferSource(); n.buffer = shortNoise();
    var hp = AC.createBiquadFilter();
    hp.type = "highpass"; hp.frequency.value = 7000;
    var g = AC.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + (open ? 0.11 : 0.026));
    n.connect(hp); hp.connect(g); g.connect(L.band);
    n.start(t); n.stop(t + (open ? 0.14 : 0.05));
  }

  /* THE BASS. A saw and a square an octave apart through a lowpass
     with a fast envelope on it — which is a plucked electric bass, and
     the envelope is the finger. Short, so the gaps between the notes
     are as much of the line as the notes. */
  function bassHit(t, f, dur, vol) {
    var lp = AC.createBiquadFilter();
    lp.type = "lowpass"; lp.Q.value = 5;
    lp.frequency.setValueAtTime(Math.min(3000, f * 9), t);
    lp.frequency.exponentialRampToValueAtTime(Math.max(90, f * 2.2), t + 0.09);
    var g = AC.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(vol * 0.45, t + dur * 0.5);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    [["sawtooth", f, 1], ["square", f / 2, 0.55]].forEach(function (v) {
      var o = AC.createOscillator();
      o.type = v[0]; o.frequency.value = v[1];
      var vg = AC.createGain(); vg.gain.value = v[2];
      o.connect(vg); vg.connect(lp);
      o.start(t); o.stop(t + dur + 0.05);
    });
    lp.connect(g); g.connect(L.band);
  }

  /* A CHORD PLAYED SHORT. Three notes, a hair apart so it is strummed
     rather than stamped, through a bandpass that gives it a body — an
     electric piano or a muted guitar, depending how hard you hit it. */
  function stab(t, freqs, dur, vol, bright) {
    var bp = AC.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = bright ? 1500 : 900;
    bp.Q.value = 0.55;
    var g = AC.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(vol * 0.2, t + dur * 0.4);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    freqs.forEach(function (f, i) {
      var o = AC.createOscillator();
      o.type = bright ? "sawtooth" : "triangle";
      o.frequency.value = f;
      o.detune.value = (i - 1) * 6;
      var og = AC.createGain(); og.gain.value = 1 / freqs.length;
      var at = t + i * 0.012;
      o.connect(og); og.connect(bp);
      o.start(at); o.stop(t + dur + 0.06);
    });
    bp.connect(g); g.connect(L.band);
  }

  /* THE LEAD, which carries the hook so the crowd has something to
     sing ALONG WITH rather than being the whole tune on their own. Two
     saws a few cents apart through a resonant lowpass that opens on
     the attack: bright, present, and completely unlike a choir. */
  function lead(t, f, dur, vol) {
    var lp = AC.createBiquadFilter();
    lp.type = "lowpass"; lp.Q.value = 6;
    lp.frequency.setValueAtTime(f * 2.2, t);
    lp.frequency.exponentialRampToValueAtTime(Math.min(9000, f * 7), t + 0.05);
    lp.frequency.exponentialRampToValueAtTime(Math.max(600, f * 2.6), t + dur);
    var g = AC.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.014);
    g.gain.setValueAtTime(vol, t + Math.max(0.02, dur * 0.62));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    [-7, 7].forEach(function (d) {
      var o = AC.createOscillator();
      o.type = "sawtooth"; o.frequency.value = f; o.detune.value = d;
      var og = AC.createGain(); og.gain.value = 0.5;
      o.connect(og); og.connect(lp);
      o.start(t); o.stop(t + dur + 0.05);
    });
    lp.connect(g); g.connect(L.band);
  }

  /* ---------------------------------------------------------- the scheduler
     Layers are scheduled a bar ahead and always on the bar, so a layer
     fading in lands in time with the ones already playing instead of
     starting wherever the fader happened to move. */
  function beatSecs() {
    var bpm = (anthem && anthem.tempo) || 96;
    /* THE TEMPO CREEPS WITH THE ENERGY. Not much — four per cent — but
       it is the difference between a crowd singing and a crowd
       pushing. */
    return 60 / (bpm * (1 + E * 0.04));
  }

  /* =======================================================================
     A LOOP IS NOT A SONG

     What was here played the same bar for ninety minutes: the motif,
     evenly spaced, both bars, for ever. Two things are wrong with that
     and they are the same thing twice — nothing ARRIVES.

     A terrace anthem is eight bars with a shape:

        bars 0-1   the bed and the stomp. They are watching.
        bars 2-3   the hook, one side of the ground, half voice.
        bar  4     THE DROP. Everything stops except the stomp. This is
                   the single most effective thing in the file and it
                   costs nothing: one bar of near-silence makes the bar
                   after it twice as loud without a decibel being added.
        bars 5-7   the hook, both sides, full voice, doubled an octave
                   down on the last two so the ground sounds twice the
                   size it did eight bars ago.

     What the crowd's ENERGY decides is not whether the song plays but
     how much of it they can be bothered with. At a murmur they hum bar
     6 and nothing else. At full voice they sing all of it, they sing
     the drop bar too, and they hold the last note.
     ======================================================================= */
  var CYCLE = 8;

  function hookNotes() {
    if (anthem && anthem.hook && anthem.hook.length) return anthem.hook;
    var m = (anthem && anthem.motif) || [0, 2, 4, 2, 0];
    var step = 8 / m.length;
    return m.map(function (d, i) { return [i * step, d, step * 0.95]; });
  }

  /* =======================================================================
     SIX ARRANGEMENTS, BECAUSE SIX TUNES IS NOT SIX TRACKS

     The last set were six different melodies played by exactly the same
     band: the same kick pattern, the same root-root-fifth-octave bass,
     stabs on the same four offbeats, the same eight-bar structure and
     the same lead sound. Played back to back they were reported, quite
     correctly, as "the same melody at three speeds" — because the
     ARRANGEMENT is what you recognise a track by, and there was only
     one of it.

     A groove is: what the drums do, what the bass does, who plays the
     tune, and when the whole thing stops. Change those four and the
     same eight notes are a different record. These six share nothing
     but the fact that a crowd sings over them.

       ceremony    no drums at all until the choir lands. A sixteenth
                   arpeggio turning over under one held chord, a timpani
                   on the downbeat, and then everything at once
       secondline  swung, with the kick syncopated off the second beat
                   and the snare answering it. Brass carries the tune
       march       oom-pah: kick on one and three, snare on two and
                   four, and a chord on EVERY beat. Nothing syncopated
                   anywhere — that is what makes it a march
       hymn        almost no drums. A soft heartbeat, hands on two and
                   four, and the tune sung in unison over sustained
                   chords. The only groove here with no hats in it
       build       the tune IS the ostinato. It starts alone, the bass
                   joins it, then the kick, then everything, and the
                   crowd only comes in at the very end
       stomp       the terrace: boots on one and three, hands on two
                   and four, no hats, no stabs, and the bass doubling
                   the boots. The loudest and the simplest
     ======================================================================= */
  var CYCLE = 8;

  function hookNotes() {
    if (anthem && anthem.hook && anthem.hook.length) return anthem.hook;
    var m = (anthem && anthem.motif) || [0, 2, 4, 2, 0];
    var step = 8 / m.length;
    return m.map(function (d, i) { return [i * step, d, step * 0.95]; });
  }

  /* -------------------------------------------------------------- DRUMS */
  function drums(g, t, b, pos, drop, e) {
    if (drop) {
      /* every groove drops the same way, because a hole is a hole */
      if (g !== "hymn" && g !== "ceremony") {
        for (var hd = 0; hd < 8; hd++) hat(t + b * hd * 0.5, hd % 2 ? 0.07 : 0.035);
      }
      clap(t + b, 0.30, -0.5);
      clap(t + b * 3, 0.30, 0.5);
      snare(t + b * 3.75, 0.34);
      return;
    }
    if (g === "ceremony") {
      /* NOTHING until the choir arrives, and then a timpani rather than
         a drum kit. Silence is the instrument for the first half. */
      if (pos >= 5) {
        kick(t, 0.66);
        kick(t + b * 2, 0.46);
        if (pos >= 6) kick(t + b * 3, 0.34);
      } else if (pos === 4) {
        kick(t, 0.5);
      }
      return;
    }
    if (g === "hymn") {
      /* a heartbeat and two pairs of hands. No hats at all — which is
         what makes it sound like people rather than a record. */
      kick(t, 0.44);
      kick(t + b * 2, 0.36);
      clap(t + b, 0.30, -0.5);
      clap(t + b * 3, 0.30, 0.5);
      if (e > 0.6) { clap(t + b * 1.5, 0.12, 0.4); clap(t + b * 3.5, 0.12, -0.4); }
      return;
    }
    if (g === "stomp") {
      /* BOOTS AND HANDS. Nothing else. The oldest sound in football and
         the only groove here with no cymbal in it anywhere. */
      kick(t, 0.78);
      kick(t + b * 2, 0.70);
      snare(t + b, 0.44);
      snare(t + b * 3, 0.46);
      clap(t + b, 0.34, -0.6);
      clap(t + b * 3, 0.34, 0.6);
      if (pos >= 5) { clap(t + b * 1.5, 0.16, 0.5); clap(t + b * 3.5, 0.16, -0.5); }
      return;
    }
    if (g === "march") {
      /* OOM-PAH. On the beat, every beat, and never between them. */
      kick(t, 0.66);
      kick(t + b * 2, 0.60);
      snare(t + b, 0.40);
      snare(t + b * 3, 0.42);
      if (pos >= 2) { snare(t + b * 3.5, 0.18); snare(t + b * 3.75, 0.22); }
      for (var hm = 0; hm < 4; hm++) hat(t + b * hm, 0.05);
      return;
    }
    if (g === "secondline") {
      /* SWUNG, and the kick answers itself off the beat. The second and
         fourth hats are late, which is the swing. */
      kick(t, 0.60);
      kick(t + b * 1.66, 0.42);
      kick(t + b * 2.66, 0.34);
      snare(t + b, 0.34);
      snare(t + b * 2.33, 0.16);
      snare(t + b * 3, 0.38);
      snare(t + b * 3.66, 0.22);
      for (var hs = 0; hs < 4; hs++) {
        hat(t + b * hs, 0.05);
        hat(t + b * (hs + 0.66), 0.075);     // the swung offbeat
      }
      return;
    }
    /* build: the drums arrive in stages, which is the whole idea */
    if (pos >= 2) { kick(t, 0.58); kick(t + b * 2, 0.48); }
    if (pos >= 3) { snare(t + b, 0.30); snare(t + b * 3, 0.34); }
    if (pos >= 5) { kick(t + b * 2.5, 0.40); snare(t + b * 3.75, 0.26); }
    if (pos >= 2) for (var hb = 0; hb < 8; hb++) hat(t + b * hb * 0.5, hb % 2 ? 0.07 : 0.04);
  }

  /* --------------------------------------------------------------- BASS */
  function bassLine(g, t, b, croot, fifth, pos) {
    var lo = croot / 2, hi5 = fifth / 2;
    if (g === "ceremony") {
      /* a pedal. One note, held under the whole thing, which is what
         makes twenty-two bars of arpeggio bearable */
      bassHit(t, lo, b * 3.6, 0.26);
      return;
    }
    if (g === "hymn") {
      bassHit(t, lo, b * 1.6, 0.26);
      bassHit(t + b * 2, hi5, b * 1.6, 0.22);
      return;
    }
    if (g === "stomp") {
      /* doubling the boots exactly. A stomp with a busy bass under it
         is not a stomp any more. */
      bassHit(t, lo, b * 0.8, 0.34);
      bassHit(t + b * 2, lo, b * 0.8, 0.30);
      return;
    }
    if (g === "march") {
      /* the oom to the pah: root on one and three, fifth on two and
         four, dead square */
      bassHit(t, lo, b * 0.7, 0.30);
      bassHit(t + b, hi5, b * 0.5, 0.20);
      bassHit(t + b * 2, lo, b * 0.7, 0.28);
      bassHit(t + b * 3, hi5, b * 0.5, 0.20);
      return;
    }
    if (g === "secondline") {
      /* a walk, with the syncopation the kick leaves room for */
      bassHit(t, lo, b * 0.5, 0.30);
      bassHit(t + b * 0.66, lo, b * 0.3, 0.18);
      bassHit(t + b * 1.66, hi5, b * 0.4, 0.24);
      bassHit(t + b * 2.33, lo * 2, b * 0.3, 0.18);
      bassHit(t + b * 3, hi5, b * 0.4, 0.22);
      bassHit(t + b * 3.66, lo, b * 0.3, 0.18);
      return;
    }
    /* build: eighths on the root, relentless, from bar one */
    for (var i = 0; i < 8; i++) {
      bassHit(t + b * i * 0.5, i % 4 === 2 ? hi5 : lo, b * 0.30,
              pos >= 4 ? 0.28 : 0.20);
    }
  }

  /* -------------------------------------------------------------- CHORDS */
  function chords(g, t, b, voiced, pos, full) {
    if (g === "march") {
      /* one on every beat, short. The pah. */
      for (var i = 0; i < 4; i++) stab(t + b * i + b * 0.5, voiced, b * 0.26, 0.15, true);
      return;
    }
    if (g === "secondline") {
      for (var j = 0; j < 4; j++) stab(t + b * (j + 0.66), voiced, b * 0.24, 0.13, true);
      return;
    }
    if (g === "hymn" || g === "ceremony") {
      /* HELD, not struck. The one place a sustained chord is right is
         under a hymn, and under Handel. */
      stab(t, voiced, b * 3.7, full ? 0.13 : 0.09, false);
      return;
    }
    if (g === "stomp") {
      /* on the stomps only, so the chord is part of the boot */
      stab(t, voiced, b * 0.5, 0.13, true);
      stab(t + b * 2, voiced, b * 0.5, 0.12, true);
      return;
    }
    /* build: nothing until it is well under way, then offbeats */
    if (pos >= 4) {
      for (var k = 0; k < 4; k++) stab(t + b * (k + 0.5), voiced, b * 0.22, 0.11, true);
    }
  }

  function scheduleBar(t) {
    if (!anthem) return;
    var b = beatSecs();
    var root = anthem.key || 196;
    var scale = anthem.scale || "minor";
    var g = anthem.groove || "stomp";
    var prog = PROGS[anthem.mood] || PROGS["anthemic-uplifting"];
    var pos = bar % CYCLE;
    var chord = prog[bar % prog.length];
    var croot = hz(root, scale, chord, 0);
    var fifth = hz(root, scale, chord + 4, 0);

    /* CEREMONY HOLDS ONE CHORD. Handel's build works because nothing
       moves underneath it; a chord change every bar turns it into a
       progression and throws the whole effect away. */
    if (g === "ceremony") { chord = prog[0]; croot = hz(root, scale, chord, 0);
                            fifth = hz(root, scale, chord + 4, 0); }

    /* THE HYMN DOES NOT DROP, IT GOES A CAPPELLA.

       A hole with hats ticking through it is a dance-record device and
       it is wrong over Beethoven. What a hymn does instead is stop the
       band dead and leave the PEOPLE — one bar of thirty thousand
       voices with nothing under them at all. Same position in the bar,
       same length, completely different thing to hear, which is the
       whole argument of this file in one flag. */
    var acap = pos === 4 && E > 0.3 && g === "hymn";
    var drop = pos === 4 && E > 0.3
               && g !== "ceremony" && g !== "build" && g !== "hymn";
    var band = !drop && !acap;

    if (!acap) drums(g, t, b, pos, drop, E);
    if (band) bassLine(g, t, b, croot, fifth, pos);

    var voiced = [0, 2, 4].map(function (add) { return hz(root, scale, chord + add, 1); });
    var stabsIn = band && (g === "build" || g === "ceremony" ? true : pos >= 2);
    if (stabsIn) chords(g, t, b, voiced, pos, pos >= 5);

    /* WHO SINGS, AND WHEN. Not the same answer for all six: the build
       keeps the crowd back until the last two bars, the ceremony hands
       them the whole thing the moment the choir lands, and the stomp
       has them in from the start because that is what a stomp is. */
    var sung, full, lifted;
    if (g === "build") { sung = pos >= 2; full = pos >= 5; lifted = pos >= 6; }
    else if (g === "ceremony") { sung = true; full = pos >= 4; lifted = pos >= 5; }
    else if (g === "stomp") { sung = true; full = pos >= 3; lifted = pos >= 5; }
    else { sung = pos >= 2 || E > 0.62; full = pos >= 5; lifted = pos >= 6; }
    if (drop) sung = false;
    /* and the a cappella bar is the one bar they are guaranteed to be
       singing, because they are all that is left */
    if (acap) { sung = true; full = true; lifted = true; }

    if (!sung) { bar++; return; }

    /* the terrace clap over the top of everything except the grooves
       that already are a clap */
    if (E > 0.45 && band && g !== "stomp" && g !== "hymn") {
      clap(t + b, 0.16, -0.55);
      clap(t + b * 3, 0.16, 0.55);
    }

    /* -------------------------------------------------- THE TUNE, TWICE
       Once on an instrument, once by the crowd — and WHICH instrument
       is part of the arrangement. A march is brass. A ceremony is the
       organ. A build is a pluck that turns into a lead. */
    var notes = hookNotes();
    var half = (pos % 2) ? 4 : 0;
    var side = (pos % 2) ? 0.5 : -0.5;
    var drive = (full ? 0.72 : 0.42) + E * 0.28;
    var leadUp = g === "ceremony" || g === "hymn" ? 1 : 2;   // which octave

    for (var i = 0; i < notes.length; i++) {
      var nb = notes[i][0];
      if (nb < half || nb >= half + 4) continue;
      var f = hz(root, scale, notes[i][1] + chord, 1);
      var tt = t + (nb - half) * b;
      var dur = notes[i][2] * b;
      /* no instrument in the a cappella bar. That is what makes it one. */
      if (!acap) lead(tt, f * leadUp, dur * 0.92, full ? 0.17 : 0.11);
      voices(f, tt, dur * 0.95, full ? 0.18 : 0.11, side, drive, full ? 9 : 5);
      if (full) hummed(f, tt, dur * 0.9, 0.08);
      if (lifted) voices(f / 2, tt, dur * 0.95, 0.10, -side, drive * 0.7, 5);
    }
    bar++;
  }

  function schedule() {
    if (!AC) return;
    var ahead = 0.35;
    var now = AC.currentTime;
    if (nextBar < now) nextBar = now + 0.06;
    while (nextBar < now + ahead) {
      scheduleBar(nextBar);
      nextBar += beatSecs() * 4;
    }
    timer = setTimeout(schedule, 120);
  }

  /* ------------------------------------------------------------- the mixer
     The whole point: one number in, five faders out. The curves are not
     linear because the layers are not equal — ambience is always there,
     the full chant should feel like it ARRIVES. */
  /* A RAMP RESTARTED EVERY FRAME NEVER ARRIVES.

     mix() is called from energy(), and energy() is called by the match
     on every frame. Each call cancelled the running automation and
     started a fresh half-second ramp from wherever the last one had
     got to — so every fader crawled toward its target at one frame's
     worth per frame and stopped short of it forever. Measured, the
     clap sat at 0.05 of a target of 0.30 and the full chant never left
     the floor at all: the anthem simply never played.

     So a target is only re-armed when it has actually MOVED. */
  var armed = {};
  function ramp(name, node, v, secs) {
    if (!node) return;
    if (armed[name] !== undefined && Math.abs(armed[name] - v) < 0.002) return;
    armed[name] = v;
    var t = AC.currentTime;
    node.gain.cancelScheduledValues(t);
    node.gain.setValueAtTime(node.gain.value, t);
    node.gain.linearRampToValueAtTime(Math.max(0.0001, v), t + (secs || 0.5));
  }

  /* WHERE EACH FADER BELONGS AT A GIVEN ENERGY. Separated from the
     act of moving them, because the offline renderer needs the numbers
     without the journey: reading a gain node's .value to find out where
     a ramp is HEADED gives you where it started, which offline is zero,
     and pinning that is how a working engine renders silence. */
  function levels(e, d) {
    return {
      ambience: (0.020 + e * 0.020) * d,
      pulse: Math.max(0, (e - 0.22) / 0.78) * 0.30 * d,
      hum: Math.max(0, (e - 0.30) / 0.45) * 0.26 * d,
      /* THE BAND STARTS EARLY AND STAYS. A record does not fade its
         drummer in and out with the mood of the crowd; the groove is
         what the crowd's mood is measured AGAINST. It comes up early,
         lifts a little when they are roused, and is otherwise the one
         steady thing in the mix. */
      band: (0.30 + Math.max(0, (e - 0.20) / 0.80) * 0.32) * d,
      /* the full chant is the last thing in and it comes in fast */
      chant: Math.pow(Math.max(0, (e - 0.55) / 0.45), 0.8) * 0.34 * d,
    };
  }

  function mix() {
    if (!on || muted) return;
    var v = levels(E, 1 - duck);
    ramp("ambience", L.ambience, v.ambience, 0.6);
    ramp("pulse", L.pulse, v.pulse, 0.8);
    ramp("hum", L.hum, v.hum, 0.9);
    ramp("band", L.band, v.band, 0.7);
    ramp("chant", L.chant, v.chant, 0.5);
  }

  /* ----------------------------------------------------------- the one-shots */
  function roar(vol, secs) {
    if (!AC || muted) return;
    var t = AC.currentTime;
    var s = AC.createBufferSource(); s.buffer = noise(3); s.loop = true;
    var f = AC.createBiquadFilter();
    f.type = "bandpass"; f.frequency.setValueAtTime(320, t);
    f.frequency.linearRampToValueAtTime(760, t + 0.4);
    f.Q.value = 0.5;
    var g = AC.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.12);
    g.gain.exponentialRampToValueAtTime(0.0001, t + secs);
    /* the chest-thump: a roar you feel has something under eighty in it */
    var lo = AC.createOscillator(); lo.type = "sine"; lo.frequency.value = 58;
    var lg = AC.createGain();
    lg.gain.setValueAtTime(0.0001, t);
    lg.gain.exponentialRampToValueAtTime(vol * 0.5, t + 0.16);
    lg.gain.exponentialRampToValueAtTime(0.0001, t + secs * 0.7);
    s.connect(f); f.connect(g); g.connect(L.peaks);
    lo.connect(lg); lg.connect(L.peaks);
    s.start(t); s.stop(t + secs + 0.1);
    lo.start(t); lo.stop(t + secs + 0.1);
  }

  function horn() {
    if (!AC || muted) return;
    var t = AC.currentTime;
    for (var i = 0; i < 2; i++) {
      var o = AC.createOscillator(); o.type = "sawtooth";
      o.frequency.value = 233 * (i ? 1.5 : 1);
      var g = AC.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.10, t + 0.02);
      g.gain.setValueAtTime(0.10, t + 0.5);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.72);
      o.connect(g); g.connect(L.peaks);
      o.start(t); o.stop(t + 0.8);
    }
  }

  function whistles(n) {
    if (!AC || muted) return;
    for (var i = 0; i < (n || 5); i++) {
      var t = AC.currentTime + Math.random() * 0.9;
      var o = AC.createOscillator(); o.type = "square";
      o.frequency.value = 1800 + Math.random() * 900;
      var g = AC.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.02, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
      var p = AC.createStereoPanner ? AC.createStereoPanner() : null;
      o.connect(g);
      if (p) { p.pan.value = Math.random() * 1.6 - 0.8; g.connect(p); p.connect(L.peaks); }
      else g.connect(L.peaks);
      o.start(t); o.stop(t + 0.3);
    }
  }

  function ooh() {
    if (!AC || muted) return;
    var t = AC.currentTime;
    var o = AC.createOscillator(); o.type = "triangle";
    o.frequency.setValueAtTime(300, t);
    o.frequency.linearRampToValueAtTime(220, t + 0.55);
    var g = AC.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.07, t + 0.10);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.62);
    o.connect(g); g.connect(L.peaks);
    o.start(t); o.stop(t + 0.7);
    roar(0.05, 0.7);
  }

  /* THE HELD BREATH. Everything ducks and a rising filtered hiss takes
     its place, so the ground sounds like twenty thousand people
     inhaling at once. Release explodes it. */
  var breathSrc = null;
  function breath(secs) {
    if (!AC || muted) return;
    duck = 1; mix();
    var t = AC.currentTime;
    breathSrc = AC.createBufferSource();
    breathSrc.buffer = noise(2); breathSrc.loop = true;
    var f = AC.createBiquadFilter();
    f.type = "bandpass"; f.Q.value = 2.2;
    f.frequency.setValueAtTime(260, t);
    f.frequency.linearRampToValueAtTime(900, t + (secs || 1.1));
    var g = AC.createGain();
    g.gain.setValueAtTime(0.004, t);
    g.gain.linearRampToValueAtTime(0.030, t + (secs || 1.1));
    breathSrc.connect(f); f.connect(g); g.connect(L.peaks);
    breathSrc.start(t);
    breathSrc.__g = g;
  }
  function release(big) {
    duck = 0; mix();
    if (breathSrc) {
      try {
        var t = AC.currentTime;
        breathSrc.__g.gain.cancelScheduledValues(t);
        breathSrc.__g.gain.linearRampToValueAtTime(0.0001, t + 0.06);
        breathSrc.stop(t + 0.1);
      } catch (e) {}
      breathSrc = null;
    }
    if (big) { roar(0.22, 2.6); horn(); whistles(7); }
  }

  /* ------------------------------------------------------------------ api */
  return {
    init: init,
    /* a team's anthem: key in Hz, tempo in bpm, a mood that picks the
       progression, and a motif in scale degrees. `stems` is honoured
       if it is ever filled in; nothing here needs it. */
    setTeam: function (a) {
      anthem = a || null;
      bar = 0;
      nextBar = AC ? AC.currentTime + 0.1 : 0;
    },
    energy: function (e, ph) {
      E = Math.max(0, Math.min(1, e || 0));
      phase = ph || phase;
      mix();
    },
    event: function (kind) {
      if (!AC || muted) return;
      if (kind === "goalHome") { release(false); roar(0.26, 3.4); horn(); whistles(9); }
      else if (kind === "goalAway") { duck = 0.75; mix(); whistles(2);
        setTimeout(function () { duck = 0; mix(); }, 2600); }
      else if (kind === "nearMiss" || kind === "shot") ooh();
      else if (kind === "superWind") breath(1.15);
      else if (kind === "superHit") release(true);
      else if (kind === "kickoff") { roar(0.10, 1.2); whistles(3); }
      else if (kind === "win") { roar(0.2, 4.5); horn(); whistles(12); }
    },
    mute: function (v) {
      muted = !!v;
      if (out) out.gain.value = muted ? 0 : 0.9;
    },
    stop: function () {
      if (timer) { clearTimeout(timer); timer = null; }
      on = false;
    },
    /* for the harness: what the mixer is actually doing */
    /* =====================================================================
       LAY THE WHOLE THING DOWN AT ONCE, for an OfflineAudioContext.

       The live scheduler posts a third of a second of music at a time
       off a setTimeout, which offline is both wrong and impossible:
       there is no wall clock, and the render finishes before any timer
       would have fired. This writes every bar of `seconds` straight
       onto the offline clock instead, which is the only way to LISTEN
       to what this file actually produces — and listening is the only
       test of a tune there is.
       ===================================================================== */
    __render: function (seconds, energy) {
      if (!AC || !anthem) return { bars: 0, barSecs: 1, start: 0 };
      /* STOP THE LIVE SCHEDULER FIRST.

         init() starts a setTimeout loop that posts the next third of a
         second of music onto the clock. Against an OfflineAudioContext
         currentTime stays at zero until the render runs, so that loop
         keeps piling whole bars on top of each other at t=0 while this
         function is laying the piece down properly — and it goes on
         doing it during startRendering(), which is async. The result
         is a different pile of extra bars every run, which is why the
         same six songs measured differently each time they were
         rendered. */
      if (timer) { clearTimeout(timer); timer = null; }
      E = energy === undefined ? 0.9 : energy;
      /* the faders are ramps, and offline there is no time for one to
         travel — so they are PLACED, at the level the mixer says this
         energy belongs at */
      var v = levels(E, 1);
      Object.keys(v).forEach(function (k) {
        if (!L[k]) return;
        L[k].gain.cancelScheduledValues(0);
        L[k].gain.setValueAtTime(v[k], 0);
      });
      bar = 0;
      var t = 0.05, n = 0;
      while (t < seconds) { scheduleBar(t); t += beatSecs() * 4; n++; }
      /* THE BAR LENGTH, because a caller cannot work it out. The tempo
         creeps four per cent with the crowd's energy, so a bar is not
         240/bpm seconds — and a harness measuring bar by bar off the
         written tempo drifts a whole bar out over eight of them, which
         makes the drop land in a different column every run. */
      return { bars: n, barSecs: beatSecs() * 4, start: 0.05 };
    },

    debug: function () {
      if (!AC) return null;
      return { energy: E, phase: phase, duck: duck, bar: bar,
               anthem: anthem ? { key: anthem.key, tempo: anthem.tempo,
                                  mood: anthem.mood } : null,
               layers: {
                 ambience: +L.ambience.gain.value.toFixed(4),
                 pulse: +L.pulse.gain.value.toFixed(4),
                 hum: +L.hum.gain.value.toFixed(4),
                 chant: +L.chant.gain.value.toFixed(4),
                 band: +L.band.gain.value.toFixed(4),
               } };
    },
  };
})();
