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

  var AC = null, out = null, bus = null, verb = null, preMaster = null;
  /* the two sidechain gains — see duckForKick */
  var sc = { inst: null, vox: null };
  var delayL = null, delayR = null, delaySend = null;
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
    /* WHERE FOOTBALL MUSIC ACTUALLY COMES FROM needs more than two
       scales. A terrace in Marrakech and a terrace in Belgrade are not
       playing the same seven notes, and the notes are most of why they
       do not sound alike. */
    dorian: [0, 2, 3, 5, 7, 9, 10],        // afrobeat, highlife
    pent: [0, 3, 5, 7, 10],                // gnawa, and most of west africa
    hijaz: [0, 1, 4, 5, 7, 8, 10],         // north africa, the balkans, turkey
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

    /* =====================================================================
       THE MASTER CHAIN, WHICH IS MOST OF WHAT "PRODUCED" MEANS

       Measured, before any of this existed: a crest factor of 17 to 21
       decibels. A finished pop record runs 8 to 12. Crest factor is
       how far the loudest moment sits above the average one, and at
       twenty decibels what you have is a track whose transients hit
       the ceiling while the BODY of it — the part anyone actually
       listens to — sits twenty decibels down. Turning it up does not
       help; the peaks just clip sooner. That gap is exactly what
       people mean when they say a mix sounds thin, or distant, or
       unfinished, and no amount of rewriting the notes touches it.

       Three stages, in the order every mastering chain on earth uses
       them, and each one does a different job:

         SATURATION rounds the peaks off by bending the waveform. It is
         the oldest loudness trick there is — it is what tape did by
         accident — and it adds harmonics on the way, which is where
         "warm" comes from. A clean digital oscillator has no harmonics
         it was not given; this gives it some.

         GLUE COMPRESSION pulls the whole mix together so the drums and
         the crowd breathe as one thing rather than as separate things
         happening at the same time. Slow attack so the transients
         survive, quick release so it pumps a little.

         THE LIMITER is the ceiling. Fast, hard, and only catching what
         gets past the other two.
       ===================================================================== */
    var sat = AC.createWaveShaper();
    var curve = new Float32Array(2048);
    for (var ci = 0; ci < 2048; ci++) {
      var x = (ci / 1024) - 1;
      /* tanh, gently driven. Hard enough to round the peaks, soft
         enough that it is not distortion */
      /* UNITY SLOPE AT ZERO, which this did not have.
         Normalising by tanh(k) makes the curve reach full scale at
         full scale, which looks right and is wrong: the SLOPE at the
         origin is then k/tanh(k), so at k=1.9 every quiet signal was
         being multiplied by two before the makeup gain had even been
         applied. Between that and the makeup the chain carried about
         six times of hidden gain, which brick-walled everything put
         through it to a crest factor of three decibels — a percussion
         track with no transients left in it, which is not percussion,
         it is a tone. tanh(kx)/k has a slope of exactly one at zero
         and still bends the peaks, which is the entire job. */
      curve[ci] = Math.tanh(x * 1.9) / 1.9;
    }
    sat.curve = curve;
    sat.oversample = "2x";

    var comp = AC.createDynamicsCompressor();
    /* GENTLER THAN A LOOP NEEDS.

       Squashing to a crest factor of seven made the eight-bar version
       sound like a record and makes a thirty-two bar one sound like a
       wall: the whole point of an intro is that it is SMALLER than the
       chorus, and a compressor pulling the quiet parts up by twelve
       decibels is a machine for deleting that difference. Enough to
       glue, not enough to flatten the form. */
    /* A CHAIN TUNED FOR THE SOURCE IT ACTUALLY HAS.

       Measured with this bypassed, the percussion sections produce a
       crest factor of 12.5dB on their own — which is already where a
       finished record sits. This chain was built when the source was a
       thin synth mix forty decibels too quiet, and nobody retuned it
       afterwards: at a threshold of -15 with 2.2 of makeup it took a
       12.5dB mix and handed back 3.4dB, which is a brick wall with no
       transients in it. A batucada with no transients is not a
       batucada, it is a tone.

       It now catches the top and nothing else. */
    comp.threshold.value = -8;
    comp.knee.value = 6;
    comp.ratio.value = 1.8;
    comp.attack.value = 0.008;     // slow enough to let the kick click through
    comp.release.value = 0.14;     // quick enough to breathe

    var lim = AC.createDynamicsCompressor();
    lim.threshold.value = -1.5;
    lim.knee.value = 0;
    lim.ratio.value = 20;
    lim.attack.value = 0.001;
    lim.release.value = 0.05;

    /* make up what the chain takes off, or it is quieter and no denser */
    var makeup = AC.createGain(); makeup.gain.value = 1.18;

    /* THE CEILING, FOR REAL.

       A DynamicsCompressor is not a brickwall limiter — it has no
       lookahead, so a fast transient is already past before the gain
       reduction arrives, and with the chain above pushing hard every
       one of these six came out over full scale. Measured: peaks of
       1.03 to 1.08, which is clipping, which on a phone is a crackle.

       A clipper after the limiter is how every master ever made
       finishes, and it is one waveshaper: a curve that is straight
       through the middle and bends hard at the top, so quiet material
       passes untouched and only the last decibel gets rounded off.
       Nothing after this can exceed full scale, by construction. */
    var ceil = AC.createWaveShaper();
    var cc = new Float32Array(4096);
    for (var k2 = 0; k2 < 4096; k2++) {
      var v2 = (k2 / 2048) - 1;
      var a2 = Math.abs(v2), sgn = v2 < 0 ? -1 : 1;
      cc[k2] = a2 < 0.72 ? v2
        : sgn * (0.72 + (1 - 0.72) * Math.tanh((a2 - 0.72) / (1 - 0.72) * 1.6)
                 / Math.tanh(1.6) * 0.96);
    }
    ceil.curve = cc;
    ceil.oversample = "4x";

    preMaster = AC.createGain(); preMaster.gain.value = 1;
    /* the chain, or straight through it when a harness is measuring
       what the source actually produces before any of it */
    if (window.__CHANT_BYPASS) {
      preMaster.connect(out);
    } else {
      preMaster.connect(sat);
      sat.connect(comp);
      comp.connect(makeup);
      makeup.connect(lim);
      lim.connect(ceil);
      ceil.connect(out);
    }
    out.connect(destination || AC.destination);

    /* =====================================================================
       THE PUMP

       On every modern pop and dance record, the bass and the pads DUCK
       on each kick and swell back before the next one. It is done with
       a compressor keyed off the kick channel, and the breathing it
       produces is the most identifiable single feature of contemporary
       production — the thing that makes a track sound like now. There
       was none of it here at all.

       Two depths rather than one, because they are not the same
       instrument. The band ducks hard: a bass note and a kick drum are
       fighting for the same forty hertz, and getting out of its way is
       why the kick sounds big rather than why the bass sounds small.
       The crowd ducks gently — enough to breathe with the track,
       not enough to sound like somebody is riding a fader on them.

       Nothing keys off an analyser: the kick is SCHEDULED, so the duck
       is scheduled with it, sample-accurate and free. */
    sc.inst = AC.createGain(); sc.inst.gain.value = 1;
    sc.vox = AC.createGain(); sc.vox.gain.value = 1;
    sc.inst.connect(preMaster);
    sc.vox.connect(preMaster);

    /* =====================================================================
       THE ECHO ON THE HOOK

       Almost every hook on almost every pop record has a delay on it,
       set to a dotted eighth so the repeats fall between the beats
       rather than on them. It is the difference between a line that
       was played and a line that was PRODUCED: the repeats fill the
       gaps the melody leaves, which is why a sparse hook still sounds
       full, and the cross-rhythm against the drums is most of what
       people hear as "groove" without being able to name it.

       On a send, not inserted, so the dry note stays where it is and
       only a copy of it bounces. */
    delayL = AC.createDelay(2.0);
    delayR = AC.createDelay(2.0);
    var dfb = AC.createGain(); dfb.gain.value = 0.34;
    var dtone = AC.createBiquadFilter();
    dtone.type = "lowpass"; dtone.frequency.value = 2600;
    delaySend = AC.createGain(); delaySend.gain.value = 0.0;
    var dpanL = AC.createStereoPanner ? AC.createStereoPanner() : null;
    var dpanR = AC.createStereoPanner ? AC.createStereoPanner() : null;
    delaySend.connect(delayL);
    delayL.connect(dtone); dtone.connect(dfb); dfb.connect(delayR);
    delayR.connect(delayL);              // ping-pong
    if (dpanL && dpanR) {
      dpanL.pan.value = -0.7; dpanR.pan.value = 0.7;
      delayL.connect(dpanL); dpanL.connect(sc.inst);
      delayR.connect(dpanR); dpanR.connect(sc.inst);
    } else {
      delayL.connect(sc.inst); delayR.connect(sc.inst);
    }

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
    bus.connect(dry); dry.connect(sc.vox);
    bus.connect(verb); verb.connect(wet); wet.connect(sc.vox);

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
    /* percussion: its own gain, following the band's fader but routed
       around the duck — see drumsOut */
    L.drums = AC.createGain(); L.drums.gain.value = 0.0;
    /* =====================================================================
       THE TWO LAYERS THIS WAS ALWAYS MISSING

       Everything above is a stadium: drums, bass, and a crowd. What it
       never had was a RECORD — a thing you would listen to with your
       eyes shut. Two layers do almost all of that work.

       THE LEAD is the melody, played by an instrument. Until now the
       tune was carried by the crowd's voices, and a crowd singing a
       melody is a chant however well it is produced; that one routing
       decision is the whole reason six different songs all sounded
       like football terraces. It goes to an instrument now and the
       crowd goes behind it.

       THE PAD is the goosebumps. A wide, slow string swell under
       everything, with a long tail on it, doing nothing but sustaining
       the chord — and it is the single most effective device there is
       for the feeling being asked for here. Chills are a response to
       something opening UP, and a pad is what opens.
       ===================================================================== */
    L.lead = AC.createGain(); L.lead.gain.value = 0.0;
    var leadDry = AC.createGain(); leadDry.gain.value = 0.92;
    var leadWet = AC.createGain(); leadWet.gain.value = 0.30;
    L.lead.connect(leadDry); leadDry.connect(sc.inst);
    L.lead.connect(leadWet); leadWet.connect(verb);

    L.pad = AC.createGain(); L.pad.gain.value = 0.0;
    var padDry = AC.createGain(); padDry.gain.value = 0.70;
    var padWet = AC.createGain(); padWet.gain.value = 0.85;
    L.pad.connect(padDry); padDry.connect(sc.inst);
    L.pad.connect(padWet); padWet.connect(verb);
    var drumDry = AC.createGain(); drumDry.gain.value = 1.0;
    var drumWet = AC.createGain(); drumWet.gain.value = 0.07;
    L.drums.connect(drumDry); drumDry.connect(preMaster);
    L.drums.connect(drumWet); drumWet.connect(verb);
    var bandDry = AC.createGain(); bandDry.gain.value = 1.0;
    var bandWet = AC.createGain(); bandWet.gain.value = 0.10;
    L.band.connect(bandDry); bandDry.connect(sc.inst);
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

  /* DUCK EVERYTHING THAT IS NOT THE KICK, at the moment the kick
     lands. The shape matters more than the depth: down instantly,
     back up over about three-quarters of a beat, on a curve rather
     than a straight line, because a linear return sounds like a fader
     and an exponential one sounds like a compressor letting go. */
  /* where percussion goes: past the duck, into the master chain */
  function drumsOut() { return L.drums || L.band; }

  function duckForKick(t, weight) {
    if (!sc.inst) return;
    var w = weight === undefined ? 1 : weight;
    var hold = 0.012;
    [[sc.inst, 1 - 0.62 * w], [sc.vox, 1 - 0.26 * w]].forEach(function (pair) {
      var g = pair[0], floor = Math.max(0.05, pair[1]);
      g.gain.cancelScheduledValues(t);
      g.gain.setValueAtTime(1, t);
      g.gain.linearRampToValueAtTime(floor, t + hold);
      g.gain.setTargetAtTime(1, t + hold, 0.075);
    });
  }

  /* the kick: a sine dropping fast, with a click on the front so it
     cuts through on a phone speaker that cannot reproduce the sine */
  function kick(t, vol) {
    duckForKick(t, Math.min(1, vol / 0.6));
    /* THREE LAYERS, WHICH IS WHAT A KICK DRUM IS.
       A sub you feel, a body you hear, and a click that survives a
       phone speaker with no bottom end at all. One sine was the body
       only, which is why it disappeared on anything small. */
    var sb = AC.createOscillator(); sb.type = "sine";
    sb.frequency.setValueAtTime(58, t);
    sb.frequency.exponentialRampToValueAtTime(36, t + 0.09);
    var sbg = AC.createGain();
    sbg.gain.setValueAtTime(vol * 0.85, t);
    sbg.gain.exponentialRampToValueAtTime(0.0001, t + 0.26);
    sb.connect(sbg); sbg.connect(drumsOut());
    sb.start(t); sb.stop(t + 0.3);
    var o = AC.createOscillator(); o.type = "sine";
    o.frequency.setValueAtTime(150, t);
    o.frequency.exponentialRampToValueAtTime(44, t + 0.055);
    var g = AC.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.20);
    /* THE DRUMS DO NOT GO THROUGH THE DUCK. A kick that ducks itself
       is a kick with a hole in the middle of it, and a snare landing
       inside its own gain dip is a snare that sounds like it is in the
       next room. Percussion goes straight to the master. */
    o.connect(g); g.connect(drumsOut());
    o.start(t); o.stop(t + 0.24);
    var c = AC.createBufferSource(); c.buffer = shortNoise();
    var cf = AC.createBiquadFilter();
    cf.type = "highpass"; cf.frequency.value = 1800;
    var cg = AC.createGain();
    cg.gain.setValueAtTime(vol * 0.18, t);
    cg.gain.exponentialRampToValueAtTime(0.0001, t + 0.012);
    c.connect(cf); cf.connect(cg); cg.connect(drumsOut());
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
    n.connect(hp); hp.connect(bp); bp.connect(g); g.connect(drumsOut());
    n.start(t); n.stop(t + 0.16);
    var o = AC.createOscillator(); o.type = "triangle";
    o.frequency.setValueAtTime(220, t);
    o.frequency.exponentialRampToValueAtTime(150, t + 0.05);
    var og = AC.createGain();
    og.gain.setValueAtTime(vol * 0.5, t);
    og.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
    o.connect(og); og.connect(drumsOut());
    o.start(t); o.stop(t + 0.09);
    /* and the crack on top — a third layer, short and very bright,
       which is the part that carries across a room */
    var cr = AC.createBufferSource(); cr.buffer = shortNoise();
    var ch = AC.createBiquadFilter();
    ch.type = "highpass"; ch.frequency.value = 3800;
    var cg2 = AC.createGain();
    cg2.gain.setValueAtTime(vol * 0.55, t);
    cg2.gain.exponentialRampToValueAtTime(0.0001, t + 0.045);
    cr.connect(ch); ch.connect(cg2); cg2.connect(drumsOut());
    cr.start(t); cr.stop(t + 0.06);
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
    /* hats sit slightly off centre and alternate, which is what stops
       a straight eighth-note pattern sounding like a machine */
    var hpan = AC.createStereoPanner ? AC.createStereoPanner() : null;
    n.connect(hp); hp.connect(g);
    if (hpan) { hpan.pan.value = (Math.round(t * 1000) % 2) ? 0.22 : -0.22;
                g.connect(hpan); hpan.connect(drumsOut()); }
    else g.connect(drumsOut());
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
    /* THE SUB, UNDER EVERYTHING AND THROUGH NOTHING.

       There was nothing at all below eighty hertz in this file, which
       is the entire bottom octave of a record — the part you feel
       rather than hear, and the reason a real mix has weight. A clean
       sine an octave under the bass note, bypassing the filter that
       shapes the pluck, because a sub that gets filtered is a sub that
       is not there. */
    var sub = AC.createOscillator();
    sub.type = "sine"; sub.frequency.value = f / 2;
    var sg = AC.createGain();
    sg.gain.setValueAtTime(0.0001, t);
    sg.gain.exponentialRampToValueAtTime(vol * 0.9, t + 0.012);
    sg.gain.exponentialRampToValueAtTime(0.0001, t + dur * 1.3);
    sub.connect(sg); sg.connect(L.band);
    sub.start(t); sub.stop(t + dur * 1.4 + 0.05);

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
    /* THE CHORD IS SPREAD ACROSS THE STEREO FIELD, one note per side
       and one up the middle — which is how a guitarist is recorded and
       why three notes played at once sound like three players rather
       than like one chord. */
    freqs.forEach(function (f, i) {
      var o = AC.createOscillator();
      o.type = bright ? "sawtooth" : "triangle";
      o.frequency.value = f;
      o.detune.value = (i - 1) * 8;
      var og = AC.createGain(); og.gain.value = 1 / freqs.length;
      var pan = AC.createStereoPanner ? AC.createStereoPanner() : null;
      var at = t + i * 0.012;
      o.connect(og);
      if (pan) { pan.pan.value = (i - 1) * 0.66; og.connect(pan); pan.connect(bp); }
      else og.connect(bp);
      o.start(at); o.stop(t + dur + 0.06);
    });
    bp.connect(g); g.connect(L.band);
  }

  /* THE LEAD, which carries the hook so the crowd has something to
     sing ALONG WITH rather than being the whole tune on their own. Two
     saws a few cents apart through a resonant lowpass that opens on
     the attack: bright, present, and completely unlike a choir. */
  function lead(t, f, dur, vol) {
    var g = AC.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.014);
    g.gain.setValueAtTime(vol, t + Math.max(0.02, dur * 0.62));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);

    /* WIDE, AND WIDE MEANS TWO DIFFERENT THINGS IN TWO PLACES.

       A single oscillator panned centre is a mono line and mono is
       what every one of these was. Two saws detuned against each other
       and sent HARD to opposite sides is the oldest trick in record
       production: the ear cannot place it, so it stops sounding like a
       point and starts sounding like a space. The detune has to be
       real — seven cents is a chorus effect, eighteen is a section. */
    [[-18, -0.75], [18, 0.75]].forEach(function (v) {
      var lp = AC.createBiquadFilter();
      lp.type = "lowpass"; lp.Q.value = 6;
      lp.frequency.setValueAtTime(f * 2.2, t);
      lp.frequency.exponentialRampToValueAtTime(Math.min(9000, f * 7), t + 0.05);
      lp.frequency.exponentialRampToValueAtTime(Math.max(600, f * 2.6), t + dur);
      var o = AC.createOscillator();
      o.type = "sawtooth"; o.frequency.value = f; o.detune.value = v[0];
      var pan = AC.createStereoPanner ? AC.createStereoPanner() : null;
      var og = AC.createGain(); og.gain.value = 0.5;
      o.connect(lp); lp.connect(og);
      if (pan) { pan.pan.value = v[1]; og.connect(pan); pan.connect(g); }
      else og.connect(g);
      o.start(t); o.stop(t + dur + 0.05);
    });
    /* and a square an octave down through the middle, which is what
       stops a wide sound being a hole where the tune should be */
    var mid = AC.createOscillator();
    mid.type = "square"; mid.frequency.value = f / 2;
    var ml = AC.createBiquadFilter();
    ml.type = "lowpass"; ml.frequency.value = f * 1.6;
    var mg = AC.createGain(); mg.gain.value = 0.3;
    mid.connect(ml); ml.connect(mg); mg.connect(g);
    mid.start(t); mid.stop(t + dur + 0.05);

    g.connect(L.lead);
    if (delaySend) { var sd = AC.createGain(); sd.gain.value = 1;
                     g.connect(sd); sd.connect(delaySend); }
  }

  /* =======================================================================
     THE PERCUSSION OF SIX FOOTBALL CULTURES

     Every previous attempt at this used a rock kit — kick, snare on
     two and four, hats in eighths — and then wondered why six tracks
     with different melodies all felt the same. A rock kit is a genre.
     It is the genre of stadium rock and it is not the genre of
     football, which everywhere outside northern Europe means DRUMS: a
     section of them, played by people standing up, with the accents in
     places a rock drummer never puts them.

     The single most important of those places: in samba the big drum
     hits the SECOND beat, not the first. That one displacement is why
     a batucada rolls forward and a rock beat marches, and no amount of
     production turns one into the other.

     What follows is the kit, built as physical objects rather than as
     drum-machine sounds, because each of these traditions is
     identified by a specific instrument more than by a pattern — the
     tamborim, the cuica, the bombo's rim, the talking drum's bend.
     ======================================================================= */

  /* A PITCHED DRUM, which is most of the world's percussion: surdo,
     bombo, davul, dum, tom. The pitch drop and how far it falls is the
     whole difference between a Brazilian surdo and an Argentine bombo
     leguüero, so both are arguments. */
  function boom(t, f0, f1, dur, vol, pan) {
    var o = AC.createOscillator(); o.type = "sine";
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(f1, t + dur * 0.35);
    var g = AC.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    /* the skin: a breath of noise on the front, or it is a sine */
    var n = AC.createBufferSource(); n.buffer = shortNoise();
    var nf = AC.createBiquadFilter();
    nf.type = "bandpass"; nf.frequency.value = f0 * 3.2; nf.Q.value = 0.8;
    var ng = AC.createGain();
    ng.gain.setValueAtTime(vol * 0.35, t);
    ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.035);
    var pn = AC.createStereoPanner ? AC.createStereoPanner() : null;
    o.connect(g); n.connect(nf); nf.connect(ng);
    if (pn) { pn.pan.value = pan || 0; g.connect(pn); ng.connect(pn); pn.connect(drumsOut()); }
    else { g.connect(drumsOut()); ng.connect(drumsOut()); }
    o.start(t); o.stop(t + dur + 0.05);
    n.start(t); n.stop(t + 0.05);
  }

  /* A STICK ON A SKIN. Short, dry, bright — caixa, tamborim, tek, the
     rim of a bombo. Everything in these traditions that is not a boom
     is one of these with a different frequency and length. */
  function crack(t, f, q, dur, vol, pan) {
    var n = AC.createBufferSource(); n.buffer = shortNoise();
    var bp = AC.createBiquadFilter();
    bp.type = "bandpass"; bp.frequency.value = f; bp.Q.value = q;
    var g = AC.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    var pn = AC.createStereoPanner ? AC.createStereoPanner() : null;
    n.connect(bp); bp.connect(g);
    if (pn) { pn.pan.value = pan || 0; g.connect(pn); pn.connect(drumsOut()); }
    else g.connect(drumsOut());
    n.start(t); n.stop(t + dur + 0.04);
  }

  /* METAL. The agogô's two bells, a cowbell, the qraqeb — a short
     stack of inharmonic partials, which is what makes metal sound like
     metal rather than like a note. */
  function metal(t, f, dur, vol, pan) {
    var g = AC.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    [1, 1.51, 2.37, 3.13].forEach(function (m, i) {
      var o = AC.createOscillator();
      o.type = "square"; o.frequency.value = f * m;
      var og = AC.createGain(); og.gain.value = 0.34 / (i + 1);
      o.connect(og); og.connect(g);
      o.start(t); o.stop(t + dur + 0.03);
    });
    var pn = AC.createStereoPanner ? AC.createStereoPanner() : null;
    if (pn) { pn.pan.value = pan || 0; g.connect(pn); pn.connect(drumsOut()); }
    else g.connect(drumsOut());
  }

  /* THE SHAKERS, and there are two kinds. A ganzá is beads in a metal
     tube — bright, tight, sixteenths. A shekere is a gourd in a net of
     shells — wetter, lower, splashier. Both are the layer that makes a
     percussion section feel like it is breathing. */
  function shaker(t, dur, vol, pan, wet) {
    var n = AC.createBufferSource(); n.buffer = shortNoise();
    var hp = AC.createBiquadFilter();
    hp.type = wet ? "bandpass" : "highpass";
    hp.frequency.value = wet ? 3400 : 6200;
    if (wet) hp.Q.value = 0.5;
    var g = AC.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    var pn = AC.createStereoPanner ? AC.createStereoPanner() : null;
    n.connect(hp); hp.connect(g);
    if (pn) { pn.pan.value = pan || 0; g.connect(pn); pn.connect(drumsOut()); }
    else g.connect(drumsOut());
    n.start(t); n.stop(t + dur + 0.03);
  }

  /* THE CUÍCA. A stick rubbed against a drum skin from the inside,
     which produces a sliding squeak that sounds like an animal and is
     the single most recognisable sound in Brazilian music. Nothing
     else in the world makes this noise, so one of them tells you which
     country you are in before the melody has started. */
  function cuica(t, dur, vol, up) {
    var o = AC.createOscillator(); o.type = "sawtooth";
    var a = up ? 210 : 420, b2 = up ? 430 : 200;
    o.frequency.setValueAtTime(a, t);
    o.frequency.exponentialRampToValueAtTime(b2, t + dur * 0.8);
    var bp = AC.createBiquadFilter();
    bp.type = "bandpass"; bp.frequency.value = 900; bp.Q.value = 5;
    var g = AC.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(bp); bp.connect(g); g.connect(drumsOut());
    o.start(t); o.stop(t + dur + 0.03);
  }

  /* THE APITO — the leader's whistle. A batucada does not start, it is
     STARTED, and this is the sound that starts it. Two tones a touch
     apart, beating against each other, which is what a real pea
     whistle does. */
  function apito(t, dur, vol) {
    var g = AC.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
    g.gain.setValueAtTime(vol, t + dur * 0.7);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    [2350, 2560].forEach(function (f) {
      var o = AC.createOscillator(); o.type = "sine"; o.frequency.value = f;
      var og = AC.createGain(); og.gain.value = 0.5;
      o.connect(og); og.connect(g);
      o.start(t); o.stop(t + dur + 0.03);
    });
    /* the pea rattling, which is the breath in it */
    var n = AC.createBufferSource(); n.buffer = shortNoise();
    var bp = AC.createBiquadFilter();
    bp.type = "bandpass"; bp.frequency.value = 2400; bp.Q.value = 2;
    var ng = AC.createGain(); ng.gain.value = vol * 0.35;
    n.connect(bp); bp.connect(ng); ng.connect(g);
    n.start(t); n.stop(t + dur);
    g.connect(drumsOut());
  }

  /* A TALKING DRUM. Squeeze the cords and the pitch bends — which is
     the whole instrument, and why west african percussion sounds like
     speech rather than like timekeeping. */
  function talking(t, f0, f1, dur, vol, pan) {
    var o = AC.createOscillator(); o.type = "triangle";
    o.frequency.setValueAtTime(f0, t);
    o.frequency.linearRampToValueAtTime(f1, t + dur * 0.55);
    var g = AC.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    var n = AC.createBufferSource(); n.buffer = shortNoise();
    var nf = AC.createBiquadFilter();
    nf.type = "bandpass"; nf.frequency.value = 1800; nf.Q.value = 1.2;
    var ng = AC.createGain();
    ng.gain.setValueAtTime(vol * 0.5, t);
    ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.03);
    var pn = AC.createStereoPanner ? AC.createStereoPanner() : null;
    o.connect(g); n.connect(nf); nf.connect(ng);
    if (pn) { pn.pan.value = pan || 0; g.connect(pn); ng.connect(pn); pn.connect(drumsOut()); }
    else { g.connect(drumsOut()); ng.connect(drumsOut()); }
    o.start(t); o.stop(t + dur + 0.04);
    n.start(t); n.stop(t + 0.05);
  }

  /* =======================================================================
     AND THE THINGS THAT PLAY THE TUNE
     ======================================================================= */

  /* A BRASS SECTION, which is four or five people and not one
     instrument. Saws through a soft clip with the filter snapping open,
     each one starting a few milliseconds late — a section is identified
     by NOT being together, exactly like a crowd. */
  function brass(t, freqs, dur, vol, pan) {
    var sh = AC.createWaveShaper();
    var cv = new Float32Array(1024);
    for (var i = 0; i < 1024; i++) cv[i] = Math.tanh(((i / 512) - 1) * 2.6);
    sh.curve = cv;
    var g = AC.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.028);
    g.gain.setValueAtTime(vol, t + Math.max(0.04, dur * 0.7));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.08);
    freqs.forEach(function (f, i) {
      for (var d = 0; d < 2; d++) {
        var lp = AC.createBiquadFilter();
        lp.type = "lowpass"; lp.Q.value = 2.2;
        lp.frequency.setValueAtTime(f * 1.4, t);
        lp.frequency.exponentialRampToValueAtTime(Math.min(8000, f * 8), t + 0.05);
        lp.frequency.exponentialRampToValueAtTime(Math.max(700, f * 3), t + dur);
        var o = AC.createOscillator();
        o.type = "sawtooth"; o.frequency.value = f;
        o.detune.value = (d ? 12 : -12) + (i - 1) * 5;
        var og = AC.createGain(); og.gain.value = 0.9 / (freqs.length * 2);
        var at = t + (i * 2 + d) * 0.006;         // nobody comes in together
        o.connect(lp); lp.connect(og); og.connect(sh);
        o.start(at); o.stop(t + dur + 0.12);
      }
    });
    var pn = AC.createStereoPanner ? AC.createStereoPanner() : null;
    sh.connect(g);
    if (pn) { pn.pan.value = pan || 0; g.connect(pn); pn.connect(L.lead); }
    else g.connect(L.lead);
  }

  /* A DOUBLE REED — zurna, ghaita, shawm. The loudest acoustic melody
     instrument there is, which is why it is the one every outdoor
     celebration from Belgrade to Marrakech ends up using. A narrow
     resonant band and a lot of vibrato; it should be slightly painful. */
  function reed(t, f, dur, vol) {
    var o = AC.createOscillator(); o.type = "sawtooth"; o.frequency.value = f;
    var vib = AC.createOscillator(); vib.type = "sine"; vib.frequency.value = 6.2;
    var vg = AC.createGain(); vg.gain.value = 22;
    vib.connect(vg); vg.connect(o.detune);
    var bp = AC.createBiquadFilter();
    bp.type = "bandpass"; bp.frequency.value = Math.min(3200, f * 3.1); bp.Q.value = 3.4;
    var pk = AC.createBiquadFilter();
    pk.type = "peaking"; pk.frequency.value = 1700; pk.Q.value = 1.4; pk.gain.value = 9;
    var g = AC.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.022);
    g.gain.setValueAtTime(vol, t + Math.max(0.03, dur * 0.78));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.05);
    o.connect(bp); bp.connect(pk); pk.connect(g); g.connect(L.lead);
    o.start(t); o.stop(t + dur + 0.08);
    vib.start(t); vib.stop(t + dur + 0.08);
    if (delaySend) { var sd = AC.createGain(); sd.gain.value = 0.5;
                     g.connect(sd); sd.connect(delaySend); }
  }

  /* A SMALL STEEL-STRUNG GUITAR, struck rather than strummed — the
     cavaquinho of samba and, with the filter moved, the clipped clean
     guitar of highlife. Very short, very bright, and always on an
     offbeat. */
  function pluckChord(t, freqs, dur, vol, pan, bright) {
    var g = AC.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    freqs.forEach(function (f, i) {
      var o = AC.createOscillator();
      o.type = bright ? "sawtooth" : "triangle";
      o.frequency.value = f; o.detune.value = (i - 1) * 4;
      var lp = AC.createBiquadFilter();
      lp.type = "lowpass"; lp.Q.value = 2;
      lp.frequency.setValueAtTime(f * (bright ? 9 : 6), t);
      lp.frequency.exponentialRampToValueAtTime(Math.max(400, f * 2), t + 0.09);
      var og = AC.createGain(); og.gain.value = 1 / freqs.length;
      o.connect(lp); lp.connect(og); og.connect(g);
      o.start(t + i * 0.007); o.stop(t + dur + 0.05);   // a strum, not a stamp
    });
    var pn = AC.createStereoPanner ? AC.createStereoPanner() : null;
    if (pn) { pn.pan.value = pan || 0; g.connect(pn); pn.connect(L.lead); }
    else g.connect(L.lead);
  }

  /* =======================================================================
     THE INSTRUMENTS THAT MAKE IT A RECORD
     ======================================================================= */

  /* A FELT PIANO. Two-operator FM with the modulator decaying much
     faster than the carrier, which is what reads as a struck string
     rather than a sine with an envelope on it. It exists for one job:
     to play the tune ALONE at the start, so that the moment everything
     else arrives means something. A song that begins at full size has
     nowhere to go. */
  function piano(t, f, dur, vol) {
    var car = AC.createOscillator(); car.type = "sine"; car.frequency.value = f;
    var mod = AC.createOscillator(); mod.type = "sine"; mod.frequency.value = f * 2.005;
    var mg = AC.createGain();
    mg.gain.setValueAtTime(f * 1.7, t);
    mg.gain.exponentialRampToValueAtTime(f * 0.03, t + 0.38);
    mod.connect(mg); mg.connect(car.frequency);
    var g = AC.createGain();
    var rel = Math.max(0.8, dur * 1.1);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.006);
    g.gain.exponentialRampToValueAtTime(vol * 0.28, t + 0.45);
    g.gain.exponentialRampToValueAtTime(0.0001, t + rel);
    car.connect(g); g.connect(L.lead);
    car.start(t); mod.start(t);
    car.stop(t + rel + 0.1); mod.stop(t + rel + 0.1);
  }

  /* THE STRING PAD, AND WHY IT IS THE WHOLE THING.

     Six detuned saws through a lowpass that opens slowly, spread hard
     across the stereo field, with a long slow attack and a longer
     release, drowned in reverb. It plays nothing but the chord. It is
     not a melody, it is not a rhythm, and it is the layer that makes
     people describe music as giving them chills — because a chill is
     a response to something OPENING, and this is the only thing in the
     file that opens.

     The filter sweep is not decoration either. A pad whose brightness
     climbs through the bar keeps arriving for the whole bar, which is
     why it feels like a swell rather than like a held note. */
  function pad(t, freqs, dur, vol, bright) {
    var g = AC.createGain();
    var atk = Math.min(dur * 0.45, 1.2);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + atk);
    g.gain.setValueAtTime(vol, t + Math.max(atk, dur * 0.8));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.9);
    freqs.forEach(function (f, i) {
      for (var d = 0; d < 2; d++) {
        var lp = AC.createBiquadFilter();
        lp.type = "lowpass"; lp.Q.value = 0.8;
        lp.frequency.setValueAtTime(Math.max(300, f * 1.6), t);
        lp.frequency.linearRampToValueAtTime(
          Math.max(900, f * (bright ? 7 : 3.4)), t + dur * 0.75);
        var o = AC.createOscillator();
        o.type = "sawtooth"; o.frequency.value = f;
        o.detune.value = (d ? 11 : -11) + (i - 1) * 4;
        /* slow, independent drift, which is what a section of players
           does and a bank of oscillators does not */
        var lfo = AC.createOscillator(); lfo.type = "sine";
        lfo.frequency.value = 0.18 + i * 0.07 + d * 0.05;
        var lg = AC.createGain(); lg.gain.value = 5;
        lfo.connect(lg); lg.connect(o.detune);
        var pan = AC.createStereoPanner ? AC.createStereoPanner() : null;
        var og = AC.createGain(); og.gain.value = 1 / (freqs.length * 2);
        o.connect(lp); lp.connect(og);
        /* HARD-PANNING TWO NEARLY IDENTICAL VOICES IS NOT WIDTH.
           Measured, the pad panned left and right came back at 0.96
           correlation — which is mono — because the two sides were the
           same note twenty cents apart and the ear sums them straight
           back to the middle. What actually decorrelates is TIME: nine
           milliseconds of delay on one side, far too short to hear as
           an echo and far too long for the ear to fuse. It is the
           oldest widening trick there is and it is one node. */
        var tail = og;
        if (d) {
          var haas = AC.createDelay(0.05);
          haas.delayTime.value = 0.009 + i * 0.002;
          og.connect(haas); tail = haas;
        }
        if (pan) { pan.pan.value = (d ? 0.9 : -0.9) * (0.65 + i * 0.18);
                   tail.connect(pan); pan.connect(g); }
        else tail.connect(g);
        o.start(t); o.stop(t + dur + 1.0);
        lfo.start(t); lfo.stop(t + dur + 1.0);
      }
    });
    g.connect(L.pad);
  }

  /* the bright plucked arpeggio that runs under the whole middle of
     the track — the one sound that says this is a record made now */
  function arp(t, f, dur, vol, side) {
    var o = AC.createOscillator(); o.type = "triangle"; o.frequency.value = f;
    var o2 = AC.createOscillator(); o2.type = "sawtooth"; o2.frequency.value = f;
    o2.detune.value = 9;
    var o2g = AC.createGain(); o2g.gain.value = 0.35;
    var lp = AC.createBiquadFilter();
    lp.type = "lowpass"; lp.Q.value = 3;
    lp.frequency.setValueAtTime(f * 8, t);
    lp.frequency.exponentialRampToValueAtTime(Math.max(400, f * 1.8), t + 0.22);
    var g = AC.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + Math.min(0.8, dur * 1.6));
    var pan = AC.createStereoPanner ? AC.createStereoPanner() : null;
    o.connect(lp); o2.connect(o2g); o2g.connect(lp); lp.connect(g);
    if (pan) { pan.pan.value = side || 0; g.connect(pan); pan.connect(L.lead); }
    else g.connect(L.lead);
    o.start(t); o2.start(t);
    o.stop(t + dur + 0.2); o2.stop(t + dur + 0.2);
    if (delaySend) { var sd = AC.createGain(); sd.gain.value = 0.6;
                     g.connect(sd); sd.connect(delaySend); }
  }

  /* =======================================================================
     TRANSITIONS, WHICH ARE WHAT A RECORD HAS BETWEEN ITS SECTIONS

     This looped eight bars and then looped them again, with nothing at
     the joins. Records never do that. Every section boundary on every
     produced track has something across it — a riser into it, an
     impact on it, a cymbal decaying out of it — and those three
     things are most of why a record feels like it is GOING somewhere
     rather than repeating. They are also almost free: noise through a
     moving filter, and a low sine.
     ======================================================================= */

  /* the sweep up into a drop. Noise through a bandpass climbing two
     octaves, getting louder as it goes — the sound of something about
     to happen, which is worth more than the thing that happens. */
  function riser(t, dur, vol) {
    var n = AC.createBufferSource(); n.buffer = noise(2); n.loop = true;
    var bp = AC.createBiquadFilter();
    bp.type = "bandpass"; bp.Q.value = 2.2;
    bp.frequency.setValueAtTime(400, t);
    bp.frequency.exponentialRampToValueAtTime(6500, t + dur);
    var g = AC.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + dur * 0.92);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.05);
    n.connect(bp); bp.connect(g); g.connect(drumsOut());
    n.start(t); n.stop(t + dur + 0.1);
  }

  /* and the thing it lands on. A boom you feel and a crash you hear,
     which between them are what makes a downbeat an EVENT. */
  function impact(t, vol) {
    var o = AC.createOscillator(); o.type = "sine";
    o.frequency.setValueAtTime(88, t);
    o.frequency.exponentialRampToValueAtTime(30, t + 0.5);
    var g = AC.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
    o.connect(g); g.connect(drumsOut());
    o.start(t); o.stop(t + 1.0);

    var n = AC.createBufferSource(); n.buffer = noise(2);
    var hp = AC.createBiquadFilter();
    hp.type = "highpass"; hp.frequency.value = 2600;
    var ng = AC.createGain();
    ng.gain.setValueAtTime(vol * 0.5, t);
    ng.gain.exponentialRampToValueAtTime(0.0001, t + 1.2);
    n.connect(hp); hp.connect(ng); ng.connect(drumsOut());
    n.start(t); n.stop(t + 1.3);
  }

  /* THE COUNTER-MELODY, second time round.

     Two operators of FM with the modulator an octave and a half up,
     which is a bell — and a bell sitting above the tune, playing only
     its long notes, is the oldest way there is of making a repeat
     sound like a development rather than a repeat. */
  function bell(t, f, dur, vol) {
    var car = AC.createOscillator(); car.type = "sine"; car.frequency.value = f;
    var mod = AC.createOscillator(); mod.type = "sine"; mod.frequency.value = f * 3.01;
    var mg = AC.createGain();
    mg.gain.setValueAtTime(f * 2.4, t);
    mg.gain.exponentialRampToValueAtTime(f * 0.05, t + 0.35);
    mod.connect(mg); mg.connect(car.frequency);
    var g = AC.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(0.5, dur * 1.3));
    var pan = AC.createStereoPanner ? AC.createStereoPanner() : null;
    car.connect(g);
    if (pan) { pan.pan.value = 0.55; g.connect(pan); pan.connect(L.band); }
    else g.connect(L.band);
    car.start(t); mod.start(t);
    car.stop(t + dur * 1.4 + 0.1); mod.stop(t + dur * 1.4 + 0.1);
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

  /* -------------------------------------------------------------- DRUMS */
  /* =======================================================================
     SIX GROOVES FROM SIX PLACES FOOTBALL IS PLAYED

     A sixteenth grid, because every one of these lives on sixteenths
     and none of them lives on the eighth-note rock grid the previous
     versions used. `k` below runs 0 to 15 across one bar.

       batucada     Brazil, the street. The surdo on the SECOND beat,
                    tamborim on the teleco-teco, caixa running
                    sixteenths, a cuíca, and the whistle that starts it
       olodum       Bahia. The same family, half the speed and four
                    times the size: three surdos answering each other
                    with a gap in the middle of the bar you could drive
                    a bus through
       funk         Rio, the baile. The tamborzão: one heavy pattern,
                    no swing, no politeness, and almost nothing else
       hinchada     Buenos Aires. A bombo legüero bouncing on one and
                    the AND of two, its wooden rim on the offbeats, and
                    a trumpet over the top
       highlife     west africa. A talking drum that bends, a shekere
                    washing over everything, and a bell pattern that
                    does not line up with the bar on purpose
       balkan       the brass bands that follow clubs round the Balkans.
                    A davul thumping two to the bar with a stick
                    clattering on the rim between, and it never slows
     ======================================================================= */

  function sixteenth(t, b, k) { return t + b * k * 0.25; }

  function drums(g, t, b, pos, drop, e) {
    var i, S = function (k) { return sixteenth(t, b, k); };
    var loud = 0.55 + e * 0.35;

    if (drop) {
      /* THE BREQUE. Every one of these traditions has the same trick:
         the whole section stops dead on a beat and you hear the street.
         It is not a dance-music drop, it is older than that. */
      crack(S(0), 2200, 3, 0.05, 0.4, 0);
      for (i = 8; i < 16; i++) shaker(S(i), 0.05, 0.05 + i * 0.006, i % 2 ? 0.4 : -0.4, false);
      crack(S(14), 1900, 2.5, 0.05, 0.3, 0.3);
      crack(S(15), 1900, 2.5, 0.05, 0.42, -0.3);
      return;
    }

    if (g === "batucada") {
      /* THE SURDO IS ON THE SECOND BEAT. Everything else about samba
         follows from that one displacement: the bar leans forward into
         the two instead of sitting down on the one. */
      boom(S(4), 108, 52, 0.34, loud * 0.5, 0);           // beat 2, open
      boom(S(12), 108, 52, 0.34, loud * 0.55, 0);         // beat 4, open
      boom(S(0), 96, 58, 0.16, loud * 0.22, 0);           // 1 and 3, muffled
      boom(S(8), 96, 58, 0.16, loud * 0.22, 0);
      /* caixa: every sixteenth, accents where a samba snare puts them */
      var acc = { 0: 1, 3: 0.9, 6: 0.85, 10: 0.95, 13: 0.8 };
      for (i = 0; i < 16; i++) {
        crack(S(i), 3200, 1.1, 0.035, (acc[i] || 0.34) * 0.11, i % 2 ? 0.25 : -0.25);
      }
      /* tamborim, the teleco-teco. The pattern everybody recognises
         and nobody can count. */
      [0, 3, 6, 8, 11, 14].forEach(function (k, n) {
        crack(S(k), 5200, 4, 0.03, 0.17, n % 2 ? 0.7 : -0.7);
      });
      /* agogô: low, high, high */
      [[0, 1], [3, 0], [4, 0], [8, 1], [11, 0], [12, 0]].forEach(function (v) {
        metal(S(v[0]), v[1] ? 700 : 940, 0.10, 0.075, 0.5);
      });
      for (i = 0; i < 16; i++) shaker(S(i), 0.05, i % 2 ? 0.055 : 0.032, -0.55, false);
      if (pos % 4 === 3) cuica(S(10), b * 1.2, 0.13, pos % 8 === 3);
      if (pos % 8 === 0) apito(S(0), b * 0.5, 0.10);
      return;
    }

    if (g === "olodum") {
      /* THREE SURDOS AND A HOLE. The first two answer each other on
         the first half of the bar and then nothing happens for a beat
         and a half, which is the whole sound — the gap is the hook. */
      boom(S(0), 78, 42, 0.45, loud * 0.62, -0.2);
      boom(S(3), 100, 54, 0.30, loud * 0.42, 0.25);
      boom(S(6), 130, 66, 0.26, loud * 0.40, 0);
      boom(S(10), 78, 42, 0.45, loud * 0.58, -0.2);
      boom(S(13), 100, 54, 0.28, loud * 0.40, 0.25);
      /* the repique, snapping across the top */
      [2, 5, 8, 12, 15].forEach(function (k, n) {
        crack(S(k), 2700, 2, 0.05, 0.16, n % 2 ? 0.6 : -0.6);
      });
      for (i = 0; i < 16; i += 2) shaker(S(i), 0.07, 0.05, 0.45, true);
      if (pos % 4 === 3) { crack(S(14), 2400, 1.6, 0.05, 0.22, 0);
                           crack(S(15), 2400, 1.6, 0.05, 0.3, 0); }
      return;
    }

    if (g === "funk") {
      /* THE TAMBORZÃO. One pattern, repeated without mercy or
         variation, and the reason a baile can be heard three streets
         away. The kick is not on the one — it is on the one AND the
         three-and, which is what makes the whole thing lurch. */
      boom(S(0), 130, 44, 0.30, loud * 0.75, 0);
      boom(S(6), 130, 44, 0.28, loud * 0.62, 0);
      boom(S(10), 130, 44, 0.26, loud * 0.55, 0);
      [4, 12].forEach(function (k) { crack(S(k), 1600, 0.8, 0.13, 0.30, 0); });
      /* the rim pattern that runs under it */
      [2, 3, 7, 9, 11, 14, 15].forEach(function (k, n) {
        crack(S(k), 3600, 3, 0.03, 0.10, n % 2 ? 0.5 : -0.5);
      });
      if (pos % 2 === 1) crack(S(15), 5000, 5, 0.03, 0.2, 0);
      return;
    }

    if (g === "hinchada") {
      /* THE BOMBO LEGÜERO. A metre of drum with a sheepskin on it,
         played with one padded stick and one bare one — the boom and
         the clack are the same player, and the clack is on the
         offbeat. It bounces, which is why an Argentine terrace jumps
         rather than claps. */
      boom(S(0), 68, 40, 0.42, loud * 0.75, 0);
      boom(S(6), 68, 40, 0.36, loud * 0.60, 0);
      boom(S(8), 68, 40, 0.40, loud * 0.70, 0);
      boom(S(14), 68, 40, 0.30, loud * 0.45, 0);
      [3, 7, 11, 15].forEach(function (k, n) {          // the rim, offbeat
        crack(S(k), 2000, 6, 0.04, 0.22, n % 2 ? 0.45 : -0.45);
      });
      /* and thousands of people, on the one and the three */
      clap(S(0), 0.26, -0.6); clap(S(8), 0.26, 0.6);
      if (e > 0.5) { clap(S(4), 0.14, 0.5); clap(S(12), 0.14, -0.5); }
      return;
    }

    if (g === "highlife") {
      /* A BELL THAT DOES NOT AGREE WITH THE BAR. The west african
         timeline is five strokes across twelve or sixteen and it
         deliberately does not land where the drums do; the friction
         between the two is the groove, and it is the thing european
         music simply does not have. */
      [0, 3, 6, 10, 12].forEach(function (k) { metal(S(k), 1180, 0.08, 0.085, 0.55); });
      boom(S(0), 92, 56, 0.24, loud * 0.42, -0.15);
      boom(S(7), 92, 56, 0.22, loud * 0.36, -0.15);
      boom(S(11), 92, 56, 0.20, loud * 0.30, -0.15);
      /* the talking drum, bending */
      talking(S(4), 210, 170, 0.18, 0.20, 0.4);
      talking(S(6), 170, 230, 0.16, 0.16, 0.4);
      if (pos % 2) talking(S(13), 190, 250, 0.20, 0.18, 0.4);
      /* shekere, washing */
      for (i = 0; i < 16; i += 2) shaker(S(i), 0.10, i % 4 ? 0.05 : 0.085, 0.3, true);
      crack(S(4), 1500, 0.9, 0.10, 0.18, 0);
      crack(S(12), 1500, 0.9, 0.10, 0.20, 0);
      return;
    }

    /* balkan: a davul, two to the bar, and a stick clattering between */
    boom(S(0), 74, 46, 0.34, loud * 0.72, 0);
    boom(S(8), 74, 46, 0.30, loud * 0.62, 0);
    boom(S(11), 88, 54, 0.18, loud * 0.30, 0);
    for (i = 0; i < 16; i++) {
      if (i % 4 === 0) continue;
      crack(S(i), 2600, 4, 0.025, i % 2 ? 0.13 : 0.07, i % 2 ? 0.5 : -0.5);
    }
    if (pos % 4 === 3) { crack(S(13), 2600, 4, 0.03, 0.18, 0.4);
                         crack(S(14), 2600, 4, 0.03, 0.22, -0.4);
                         crack(S(15), 2600, 4, 0.03, 0.28, 0); }
  }

  /* ------------------------------------------------------------- THE BASS
     Each of these traditions puts the low notes somewhere different,
     and where the bass sits against the big drum is half of what makes
     a groove feel like itself. */
  function bassLine(g, t, b, croot, fifth, pos) {
    var lo = croot / 2, hi5 = fifth / 2;
    var S = function (k) { return sixteenth(t, b, k); };
    if (g === "batucada") {
      /* with the surdo, so the second beat is where the weight is */
      bassHit(S(4), lo, b * 0.4, 0.30);
      bassHit(S(7), lo, b * 0.2, 0.16);
      bassHit(S(12), hi5, b * 0.4, 0.28);
      bassHit(S(15), lo, b * 0.2, 0.16);
      return;
    }
    if (g === "olodum") {
      bassHit(S(0), lo, b * 0.6, 0.34);
      bassHit(S(6), hi5, b * 0.3, 0.20);
      bassHit(S(10), lo, b * 0.5, 0.30);
      return;
    }
    if (g === "funk") {
      /* one note, an octave down, following the kick exactly — baile
         funk has no bassline, it has a kick with a pitch */
      bassHit(S(0), lo / 2, b * 0.5, 0.40);
      bassHit(S(6), lo / 2, b * 0.4, 0.32);
      bassHit(S(10), lo / 2, b * 0.4, 0.28);
      return;
    }
    if (g === "hinchada") {
      /* a tuba, because a murga has one: root and fifth, oom-pah, and
         it never gets clever */
      bassHit(S(0), lo, b * 0.5, 0.32);
      bassHit(S(4), hi5, b * 0.35, 0.22);
      bassHit(S(8), lo, b * 0.5, 0.30);
      bassHit(S(12), hi5, b * 0.35, 0.22);
      return;
    }
    if (g === "highlife") {
      /* a walking, rolling line in the gaps the bell leaves */
      [[0, lo], [3, lo], [6, hi5], [8, lo * 2], [11, hi5], [14, lo]].forEach(function (v) {
        bassHit(S(v[0]), v[1], b * 0.28, 0.24);
      });
      return;
    }
    /* balkan: the tuba on every beat, relentless, no syncopation at all */
    for (var k = 0; k < 16; k += 4) {
      bassHit(S(k), (k % 8) ? hi5 : lo, b * 0.32, 0.30);
    }
  }

  /* ------------------------------------------------------- THE CHORD PART */
  function chords(g, t, b, voiced, pos, full) {
    var S = function (k) { return sixteenth(t, b, k); };
    var v = full ? 0.15 : 0.10;
    if (g === "batucada") {
      /* CAVAQUINHO. Offbeat sixteenths, every bar, bright as a knife —
         the sound of samba that is not a drum. */
      [2, 3, 6, 7, 10, 11, 14, 15].forEach(function (k, n) {
        pluckChord(S(k), voiced, b * 0.16, v * (n % 2 ? 1 : 0.6), 0.5, true);
      });
      return;
    }
    if (g === "olodum") {
      brass(S(6), voiced, b * 0.5, v * 0.9, 0);
      brass(S(13), voiced, b * 0.4, v * 0.7, 0);
      return;
    }
    if (g === "funk") {
      /* almost nothing. A baile track is a beat and a voice. */
      if (pos % 2 === 0) pluckChord(S(12), voiced, b * 0.3, v * 0.7, 0, true);
      return;
    }
    if (g === "hinchada") {
      /* the pah of the oom-pah, on every offbeat, on brass */
      [2, 6, 10, 14].forEach(function (k) {
        brass(S(k), voiced, b * 0.22, v * 0.8, 0.2);
      });
      return;
    }
    if (g === "highlife") {
      /* CLIPPED CLEAN GUITAR, in two interlocking parts an offbeat
         apart, which is how a highlife band is actually arranged */
      [1, 5, 9, 13].forEach(function (k) {
        pluckChord(S(k), voiced, b * 0.2, v * 0.8, -0.65, false);
      });
      [3, 7, 11, 15].forEach(function (k) {
        pluckChord(S(k), [voiced[1], voiced[2], voiced[0] * 2], b * 0.18, v * 0.6, 0.65, false);
      });
      return;
    }
    /* balkan: the horns punch the offbeats, hard */
    [2, 6, 10, 14].forEach(function (k) {
      brass(S(k), voiced, b * 0.2, v, k % 4 === 2 ? -0.3 : 0.3);
    });
  }

  /* =======================================================================
     THE FORM. Thirty-two bars, because an eight-bar loop can withhold
     nothing — you have heard all of it by bar eight, and every one of
     these traditions is built on a section arriving.
     ======================================================================= */
  var CYCLE = 32;

  function sectionOf(pos) {
    if (pos < 8) return "intro";
    if (pos < 16) return "build";
    if (pos < 24) return "chorus";
    if (pos < 28) return "break";
    return "last";
  }

  function hookNotes() {
    if (anthem && anthem.hook && anthem.hook.length) return anthem.hook;
    var m = (anthem && anthem.motif) || [0, 2, 4, 2, 0];
    var step = 8 / m.length;
    return m.map(function (d, i) { return [i * step, d, step * 0.95]; });
  }

  /* WHICH INSTRUMENT PLAYS THE TUNE, per tradition. This is not a
     detail: a melody on a cavaquinho is samba and the same melody on a
     zurna is a Balkan wedding, and nobody has to be told which. */
  function sing(g, t, f, dur, vol, sec) {
    if (g === "balkan") { reed(t, f, dur, vol * 1.05); return; }
    if (g === "highlife") {
      if (sec === "intro" || sec === "break") pluckChord(t, [f], dur, vol * 1.3, 0, false);
      else brass(t, [f, f * 1.26], dur, vol * 0.9, 0.15);
      return;
    }
    if (g === "funk") {
      /* a hard synth line, because that is what a baile has — there is
         no acoustic instrument in this music at all */
      lead(t, f, dur, vol * 1.1);
      return;
    }
    if (g === "batucada") {
      if (sec === "intro" || sec === "break") pluckChord(t, [f, f * 1.5], dur, vol * 1.2, 0, true);
      else brass(t, [f, f * 1.5], dur, vol, 0);
      return;
    }
    /* olodum and hinchada are brass towns */
    brass(t, [f], dur, vol * (sec === "intro" ? 0.7 : 1), 0);
  }

  function scheduleBar(t) {
    if (!anthem) return;
    var b = beatSecs();
    var root = anthem.key || 196;
    var scale = anthem.scale || "minor";
    var g = anthem.groove || "batucada";
    var prog = PROGS[anthem.mood] || PROGS["anthemic-uplifting"];
    var pos = bar % CYCLE;
    var sec = sectionOf(pos);
    var inSec = pos < 8 ? pos : (pos < 16 ? pos - 8 : (pos < 24 ? pos - 16
                : (pos < 28 ? pos - 24 : pos - 28)));

    var lift = sec === "last" ? Math.pow(2, 2 / 12) : 1;
    var key = root * lift;
    var chord = prog[bar % prog.length];
    var croot = hz(key, scale, chord, 0);
    var fifth = hz(key, scale, chord + 4, 0);
    var voiced = [0, 2, 4].map(function (add) { return hz(key, scale, chord + add, 1); });

    /* A PAD, BUT QUIETLY AND NOT EVERYWHERE. None of these traditions
       has a synth pad in it — they are all played outdoors by people
       carrying their instruments — so it exists only to stop the
       choruses sounding thin, and it stays underneath. */
    var padVol = sec === "intro" ? 0.010
      : sec === "build" ? 0.022
      : sec === "break" ? 0.016
      : sec === "last" ? 0.060 : 0.046;
    if (g !== "funk") pad(t, voiced.map(function (f) { return f / 2; }), b * 4, padVol,
                          sec === "chorus" || sec === "last");

    /* ------------------------------------------------------- THE SECTION
       These are percussion traditions, so what builds is the SECTION,
       not a filter sweep. Drums first and always — in every one of
       these places the drums start before anything else and stop after
       everything else. */
    var hole = (sec === "chorus" && inSec === 4) || (sec === "last" && inSec === 0);
    var percIn = !(sec === "intro" && inSec < 2);
    var bassIn = (sec === "build" && inSec >= 2) || sec === "chorus" || sec === "last";
    var chordIn = (sec === "build" && inSec >= 4) || sec === "chorus" || sec === "last";

    /* the intro is the section warming up, which is a real thing that
       happens and is more exciting than a synth rising */
    if (percIn) drums(g, t, b, pos, hole, sec === "intro" ? 0.3 : E);
    else { apito(t, b * 0.45, 0.12);
           if (inSec === 1) apito(t + b * 2, b * 0.3, 0.10); }

    if (bassIn && !hole) bassLine(g, t, b, croot, fifth, pos);
    if (chordIn && !hole) chords(g, t, b, voiced, pos, sec === "chorus" || sec === "last");

    if (sec === "build" && inSec === 7) riser(t, b * 4, 0.10);
    if (sec === "chorus" && inSec === 0) impact(t, 0.30);
    if (sec === "last" && inSec === 1) impact(t, 0.34);

    /* --------------------------------------------------------- THE TUNE */
    var notes = hookNotes();
    var half = (inSec % 2) ? 4 : 0;
    for (var i = 0; i < notes.length; i++) {
      var nb = notes[i][0];
      if (nb < half || nb >= half + 4) continue;
      var f = hz(key, scale, notes[i][1] + chord, 1);
      var tt = t + (nb - half) * b;
      var dur = notes[i][2] * b;
      if (sec === "intro") { if (inSec >= 4) sing(g, tt, f, dur, 0.09, sec); }
      else if (sec === "build") sing(g, tt, f, dur, 0.13, sec);
      else if (sec === "break") sing(g, tt, f, dur, 0.12, sec);
      else if (!hole) {
        sing(g, tt, f * 2, dur * 0.92, sec === "last" ? 0.26 : 0.22, sec);
        sing(g, tt, f, dur * 0.9, 0.11, sec);          // and an octave under it
        if (sec === "last" && notes[i][2] >= 0.75) {
          bell(tt + b * 0.25, hz(key, scale, notes[i][1] + chord + 2, 2), dur * 0.8, 0.09);
        }
      }
    }

    /* ---------------------------------------------------------- THE CROWD
       Shouting on the offbeat, not singing the tune. In every one of
       these traditions the people are PART OF THE PERCUSSION — they
       answer the drums, they do not carry the melody. */
    if (sec === "chorus" || sec === "last") {
      var shout = hz(key, scale, chord, 0);
      [0, 4, 8, 12].forEach(function (k, n) {
        voices(shout * 2, sixteenth(t, b, k + 2), b * 0.3,
               hole ? 0.18 : 0.10, n % 2 ? 0.7 : -0.7, 0.85, 8);
      });
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
  /* =======================================================================
     GAIN STAGING, WHICH NOBODY HAD DONE

     Every level in this file was chosen on its own — a drum at 0.4, a
     lead at 0.19, ambience at 0.038 — and nobody ever added them up.
     Measured with the master chain bypassed, the whole track came out
     at an RMS of 0.008, which is forty decibels below where a mix
     belongs. The renderer then normalised the file up by a factor of
     fourteen to make it audible, and what that amplified was the
     loudest CONTINUOUS thing in the graph: the ambience noise bed.
     Every review file was therefore mostly hiss with a band somewhere
     underneath it, which is a complete explanation for "I do not feel
     anything" that has nothing to do with the notes.

     The layers are absolute now and they sum to roughly one. The
     ambience, which is a background texture and not an instrument, is
     where it belongs — twenty-five decibels under the drums instead of
     on top of them.
     ======================================================================= */
  function levels(e, d) {
    return {
      /* a texture, not an instrument */
      ambience: (0.006 + e * 0.008) * d,
      pulse: Math.max(0, (e - 0.22) / 0.78) * 0.22 * d,
      hum: Math.max(0, (e - 0.30) / 0.45) * 0.18 * d,
      /* THE BAND STARTS EARLY AND STAYS. A record does not fade its
         drummer in and out with the mood of the crowd; the groove is
         what the crowd's mood is measured AGAINST. It comes up early,
         lifts a little when they are roused, and is otherwise the one
         steady thing in the mix. */
      band: (0.45 + Math.max(0, (e - 0.20) / 0.80) * 0.25) * d,
      /* THE DRUMS BELONG IN THIS TABLE, and for a long time they did
         not — mix() ramped L.drums by hand while levels() never
         mentioned it. The live game was fine because mix() runs there.
         The OFFLINE RENDERER is not: it places every fader by walking
         the keys of this object, so a layer missing from it renders at
         the gain it was created with, which is zero.

         Every .wav produced for review since the drum bus was added
         therefore had no percussion in it whatsoever, and the music
         was being judged without its rhythm section. There is no
         assertion that would have caught this; the only reason it
         surfaced is that trimming the drum fader changed the measured
         output by exactly nothing. */
      /* THE LOUDEST THING IN THE MIX, because in every one of these
         traditions the drums are the loudest thing in the street. */
      /* LOUD, BUT NOT INTO THE CEILING. A batucada is forty-five hits
         a bar; at a fader of 0.7 the sum brick-walled the master flat
         at a crest factor of 3.4dB, and a percussion track with no
         transients left in it is not percussion, it is a tone. */
      drums: (0.26 + Math.max(0, (e - 0.20) / 0.80) * 0.12) * d,
      /* THE SOUNDTRACK IS NOT A CROWD REACTION. The lead and the pad
         are the record, and a record does not fade out because the
         match has gone quiet — it plays, and the crowd comes and goes
         over the top of it. They sit high and move barely at all. */
      lead: (0.80 + Math.max(0, (e - 0.3) / 0.7) * 0.20) * d,
      /* UNDER, not over. Six detuned saws is a lot of energy and a pad
         that competes with the tune is a fog. */
      pad: (0.26 + Math.max(0, (e - 0.3) / 0.7) * 0.10) * d,
      /* the full chant is the last thing in and it comes in fast */
      chant: Math.pow(Math.max(0, (e - 0.55) / 0.45), 0.8) * 0.30 * d,
    };
  }

  function mix() {
    if (!on || muted) return;
    var v = levels(E, 1 - duck);
    ramp("ambience", L.ambience, v.ambience, 0.6);
    ramp("pulse", L.pulse, v.pulse, 0.8);
    ramp("hum", L.hum, v.hum, 0.9);
    ramp("band", L.band, v.band, 0.7);
    /* A PERCUSSION SECTION IS FORTY-FIVE HITS A BAR, not four.
       The levels here were written for a rock kit — a kick, a snare
       and eight hats — and a batucada puts a surdo, sixteen caixa
       strokes, six tamborim, three agogô and sixteen shaker hits into
       the same bar. At the old fader that brick-walled the master for
       the whole track: crest factor 3.8dB, which is not a mix, it is a
       wall, and it flattened every section into every other one. */
    ramp("drums", L.drums, v.drums, 0.7);
    ramp("lead", L.lead, v.lead, 0.6);
    ramp("pad", L.pad, v.pad, 1.1);
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
      /* the delay is a DOTTED EIGHTH of this ground's tempo, set when
         the team changes — the repeats then fall between the beats
         instead of on them, which is the whole point of it */
      if (delayL && a && a.tempo) {
        var bl = 60 / a.tempo;
        delayL.delayTime.value = bl * 0.75;
        delayR.delayTime.value = bl * 0.75;
        if (delaySend) delaySend.gain.value = 0.26;
      }
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

    __layers: function () { return L; },

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
                 drums: +L.drums.gain.value.toFixed(4),
                 lead: +L.lead.gain.value.toFixed(4),
                 pad: +L.pad.gain.value.toFixed(4),
               } };
    },
  };
})();
