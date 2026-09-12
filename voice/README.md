# His voice

The chapter can play a real recording for every line Anwar says, and
falls back to the browser's own speech engine for any line that has not
got one. This folder is where the recordings go.

## Why this exists

His lines are the most personal writing in the whole gift, and without
recordings they are read out by whatever speech engine happens to be
installed on the phone the game is running on — which on a modern
handset is a bright, clean assistant voice built to read out a
calendar. It is not a bad voice. It is the wrong voice, and there is no
setting that fixes it: every speech engine is a real person cut into
pieces, and the further you push its pitch and rate away from where
that person actually spoke, the more it growls and the less it sounds
like anybody. We were already at the ceiling.

## How to get them (one click)

Go to the repository's **Actions** tab, pick **Anwar's voice**, and
press **Run workflow**.

Leave `mode` on **sample** the first time. It renders four lines — his
first words to her, one from the middle of a night, the one with the
knife in it, and six o'clock — in all five candidate voices, and hands
them back as a download at the bottom of the run. Nothing is committed.
Listen to them and decide which one is him.

Then run it again with `mode` set to **full** and `voice` set to the
one you picked. It renders all 117 lines, about twelve minutes of
speech, and commits them here. That takes about four minutes.

Two other knobs, both worth leaving alone unless something bothers you:

- `pace` — bigger is slower. 1.14 is a narrator; 1.0 is the model's own
  read, which is closer to a newsreader. Past 1.25 it drawls.
- `variation` — how much the delivery moves about. 0.4 is flat and
  even, 0.9 is theatrical. 0.72 is a man talking.

It has to run there rather than on the machine this repo is usually
worked on from, because the voice model is a 60MB file fetched from the
open internet and that machine's network policy blocks it.

`bash tools/makevoice.sh` does exactly the same thing on any computer
with `node`, `python3` and `ffmpeg` on it, if you would rather.

## What the game does with them

A recording is played through the chapter's own audio graph, which the
browser's speech engine can never be, because it will not hand you its
output as a signal. That means it ducks when a door shuts, it sits
under the score properly, and it goes through a light treatment that
places it in the room: a gentle band, a small presence lift at the
frequency where intelligibility lives, a saturation that only bites on
the loudest syllables, and a drift of about two-tenths of a percent so
that no two seconds run at exactly the same speed. That last one is too
small to hear as pitch and is the whole reason it sounds like a
recording rather than a file. A human ear forgives almost anything
except perfect stability.

It is deliberately *light*. An earlier version was a full tape
emulation — banded at 5.2kHz, saturated hard, with an audible capstan
wow — which suited the fiction and ruined the voice: rolling a narrator
off that low takes the top off every S and T, and a narrator with no
consonants does not sound like an old recording, he sounds like a bad
one. One number controls all of it, `VOX_ROOM` in `night-shift.js`. 0
is the file exactly as rendered; 1 is the old tape machine; it is
currently 0.34.

The captions get better too: with a real file the game knows the true
length of each line, so the word-by-word highlight is stretched onto
the recording instead of onto an estimate.

## Mixing and matching

You do not have to do all of them. Every line with a file is played as
a recording; every line without one is spoken by the engine, in the
same shift, with nothing to switch over.

The manifest maps each id to the **exact words** recorded for it, and
the game looks a line up by its words rather than its id. So a line
that gets rewritten later stops matching and quietly falls back, rather
than playing a take of the old words under a caption of the new ones.
Re-run the workflow and it comes back.

`node tools/voicesheet.js` prints the whole script if you ever want to
read it.
