# His voice

Everything in here is optional. The chapter works without it — the
browser's own text-to-speech reads his lines, as it always has.

It is also the single biggest thing that can still be done to this
game. The lines are the most personal writing in the gift and they are
currently being read out by whatever engine happens to be installed on
the phone it is running on, which on a modern handset is a bright,
clean assistant voice built to read out a calendar. It is not a bad
voice. It is the wrong voice, and there is no setting that fixes that:
every speech engine is a real person cut into pieces, and the further
you push its pitch and rate away from where that person actually
spoke, the more it growls and the less it sounds like anybody. We are
already at the ceiling.

A recording beats it. Any recording.

## How to add one

1. `node tools/voicesheet.js` prints every line he says out loud, in
   order, with its id. There are about 117 of them and roughly twelve
   minutes of speech.

2. Record each line as its own file, named by its id:

       voice/intro-1-1.mp3
       voice/tape3-07.mp3
       voice/reveal-4.mp3

   A phone held a hand's width away, indoors, with the door shut, is
   the right microphone. Leave half a second of room at each end and
   do not trim it tight — the game fades each line in and needs the
   air. Do not perform it. He is a man telling his wife something he
   has been working up to for eleven days, not an actor.

3. `node tools/voicesheet.js --json > voice/manifest.json`

   The manifest maps each id to the exact words recorded for it, and
   the game looks a line up by its words rather than its id. So if a
   line is later rewritten it stops matching and quietly goes back to
   the synthesiser, instead of playing a take of the old words under a
   caption of the new ones. Re-record it and re-run this and it comes
   back.

You do not have to do all 117 at once. Every line that has a file is
played as a recording; every line that does not is spoken by the
engine, in the same shift, and nothing has to be switched over. The
seven lines of the opening statement are the ones worth doing first —
they are the first thing she hears and they set what the whole chapter
sounds like.

## What the game does with it

A recording goes through the chapter's own audio graph, which the
browser's speech engine cannot: it ducks when a door shuts, it sits
under the score properly, and it goes through the tape — a band-limit
at both ends, a little saturation, and the wow and flutter of a machine
that has been in a drawer for eleven days.

That last part matters more than it sounds. A dry, full-range recording
of somebody in a quiet room contradicts the fiction in its first
syllable. Put the same take through the tape and it stops sounding like
a man in a booth and starts sounding like something she has found.

The captions also get better: with a real file the game knows the true
length of the line, so the word-by-word highlight is stretched onto the
recording instead of onto an estimate of how long it ought to have
taken.
