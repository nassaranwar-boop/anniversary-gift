# Anniversary gift site

A single-page interactive gift. Open `index.html` in a browser, or push this
folder to a GitHub repo and enable GitHub Pages (Settings → Pages → deploy from
branch → main → /root).

**Passcode to enter the site: 2207**

## Files

```
index.html       page structure (all screens are <section class="screen">)
vendor/          three.js r180 + post-processing, bundled for offline use
style.css        all styling
script.js        site logic + maze/adventure content config (EDIT CONTENT HERE)
book-scene.js    the Three.js 3D intro scene — self-contained
scrapbook.js     the memory book — its own config block at the top
super-ouissy.js  the platformer — its own config block at the top
rescue.js        the platformer's story scenes (Hard only) — self-contained
apocalypse.js    the stealth chapter — its own config block at the top
racing.js        the kart racer — a hand-written Mode 7 renderer, not Three.js
night-shift.js          the night-shift horror — Three.js, on the bundled copy
assets/          images used by the 2D parts of the site
tools/           offline checks (see tools/README.md); nothing here ships
```

## Screen flow

1. **3D book intro** (`book-scene.js`) — tap to trigger; ends by calling
   `window.finishBookIntro()`
2. **Passcode gate** — 2207 (the seal blooms open)
3. **The memory book** (`scrapbook.js`) — a painted candle that burns until
   she touches it, then the book itself: it starts closed on its cover and
   every page, the cover included, is turned by hand. Ten collaged pages and
   a back cover. The round button bottom-right opens a drawer with the
   bouquet, the song, the Marrakech memory map and the music video.
4. **Hub** — "choose your adventure", now three chapters, any order
5a. **The Maze** — level 1 -> level 2 -> divider -> cats night-sky ending
5b. **The Long Way Round** — branching pixel-art choice adventure: two
    paths, two routes each, and an ending per path
5c. **Super Ouissy** — a three-world platformer (`super-ouissy.js`)
5d. **Ouissy at the Apocalypse** — a five-level top-down stealth story
    (`apocalypse.js`), ending on the same rooftop as the maze
5e. **Super Ouissy Race** — the Mode 7 kart racer (`racing.js`)
5f. **Ouissy's Night Shift** — a six-night camera-and-doors horror
    (`night-shift.js`), set in the Wick & Cogs Toy Emporium
6. **Keepsake** — scrapbook recap, unlocked once the maze and the adventure
   are done. Super Ouissy is a bonus: finishing it adds a card to the
   keepsake but is deliberately **not** required to unlock it, so nothing
   she has already finished can re-lock itself.

## Where to edit content

Top of `script.js`, in clearly marked CONFIG blocks:

- `GATE_CODE` — the passcode
- `MEMORIES` — optional. Only needed if you want a title, a date or a caption
  on a photo (see **Photos** below). Anything still written in [square
  brackets] is treated as scaffolding and never shown.
- `QUEST_FINAL` — the two closing questions of the choice adventure (one
  per path) and the nudge you get for saying no
- `KEEPSAKE_CLOSING` — the last line she reads. Also a placeholder.
- `CONFIG` (further down) — maze game text, her name, the reward line, the
  in-maze love notes

Top of `super-ouissy.js`, in the block marked **CUSTOMISE ME**:

- `SO.ending` — the castle scene at the very end. `lines` is still a
  placeholder; that is the thing to write.
- `SO.worlds` — the three world names and the line under each
- `SO.tagline`, `SO.howTo` — the title screen and the controls card

## Photos — just name the files

Every frame in the book is numbered, and every empty frame says its number.
Save a photo as `assets/photo-<that number>.jpg` and it lands in that frame.
Nothing to configure.

```
assets/photo-1.jpg    →  the frame marked "1"
assets/photo-13.jpg   →  the frame marked "13"
```

`.png` works too. Slots 1–30 are the pages in reading order; 31–34 are the
four pins on the Marrakech map. A frame with no file keeps showing its number,
so you can fill them in any order.

To add a title, date or caption to one, add an entry to `MEMORIES` in
`script.js` at that position — `MEMORIES[0]` is photo 1, `MEMORIES[12]` is
photo 13 — and set `photo:` there only if the file is named something else.

## Turning the pages

There is no toolbar and no "open" button. The book arrives closed on its
cover; take the corner and **pull it across** — a click alone will not turn
it, the same as a real book. The sheet lifts, bends as it passes the
upright, turns about the spine and settles, and the book widens as the
cover comes over. The arrow keys work too. There is nothing sitting on top of the
book at all; the way out is the button on its back cover, through to the
games.

Under the hood the sheet is a cylinder, not a board on a hinge. Each leaf
is cut into vertical strips, and every strip is placed along a bending
sheet whose tangent angle falls off with distance from the spine
(`α(s) = A − κ·s`), so the free edge trails behind and the page reads as
paper. Curvature is nil at either end of the turn and greatest halfway
through. Shading runs as a gradient across each strip so the joins match
and the light reads as one curve.

Drawing the page once per strip is the expensive part, so: the strips for
the next turn are built ahead of time while she is reading the spread, the
shading changes four numbers rather than rebuilding a gradient, drop
shadows and filters are dropped inside a sheet that is moving, and the
turn measures its own frame pacing and settles on however many strips the
device can actually afford (5 to 13). The book also slides as it changes
width so the spine stays put, instead of dragging sideways under the
turning sheet.

Two leaves, not one with two faces: the first swings away, the second
comes down on the other side. Nothing depends on `backface-visibility`,
which some browsers ignore — that was what made pages render mirrored.

If a change touches `style.css` or any `.js`, bump the `?v=` number on the
asset links in `index.html`, or GitHub Pages will keep serving the old
files.

## The memory book — where to edit

Everything you are likely to change is in the `SB` block at the top of
`scrapbook.js`:

- `SB.song` — the track the drawer plays, already in as `assets/song.mp3`
  (Mirage — Bouss). `startAt` is where playback begins, in **seconds** —
  raise or lower it until it opens on the line you want.
- `SB.video` — `youtubeId` for the music video in the drawer (currently
  Bouss – Printemps). Its own thumbnail is the poster; the player only
  loads when she asks for it.
- `SB.ourVideo` — the video on the last page. Save it as
  `assets/our-video.mp4` (and optionally a still at `assets/our-video.jpg`).
  Until it exists the page shows a film slate.
- `SB.map` — the city and its pins. Each pin has `x`/`y` in % of the map card,
  plus a date, title and place. The four pins use photo slots 41–44.
- `SB.letter` — the note behind "Tap here to view more".
- `SB.hand` — the scraps of handwriting scattered through the pages.

The pages themselves are the `PAGES` array further down: one entry per page,
each a list of pieces positioned in percentages of that page.

## Ouissy at the Apocalypse

A top-down stealth story in five levels, reached from the hub. She is home
alone when it starts; the game is her getting to Anwar, and then the two of
them getting somewhere safe.

Arrow keys or WASD to move, **shift** to creep, **E** or space to use
whatever she is standing at, Esc to pause. On a phone there is a pad and two
buttons.

**It carries no files of its own**, the same rule Super Ouissy follows.
Every tile, sprite and backdrop is drawn onto a 320x180 canvas when the
level loads and every sound is synthesised, so the whole chapter adds
nothing to the repo but the one script.

### The levels

| | | |
|---|---|---|
| 1 | **Home** | the news is still on downstairs; the garage door has no power |
| 2 | **The Streets** | three ways across town, and a gate code dropped in a shop |
| 3 | **The Hospital** | Ward C is dead, he is behind it, and it is getting worse |
| 4 | **The Road** | out of the building, a car that might start, and a horse |
| 5 | **The Gates** | the check, the serum, and somebody opening a gate |

### Changing it

Everything you are likely to want is in the first two hundred lines of
`apocalypse.js`:

- `AP` — the words. Level names and briefings, the how-to card, and
  **`AP.reunion`**, which is the scene in the supply room in Level 3. A line
  written as `["", ""]` is a beat of silence and is held on screen like any
  other line; those are doing as much work there as the spoken ones.
- `TUNE` — how she feels to play. How fast she walks, how far her torch
  reaches, how far a footstep carries, how far a zombie sees and how fast it
  moves once it has seen her. Almost every complaint about a stealth game is
  one of these numbers.
- `LEVELS` — the maps, as grids of characters, one per 16px tile, with the
  full legend written above them. Edit a string and the place changes.

### Three mechanics, built once

- **The wire panel** — a salvaged plate under one bulb. Five shape-coded
  plugs bolted to the left rail, their runs crossing in a tangle, loose ends
  staged out of order, and sockets shuffled again on the right, so the end
  nearest a socket is almost never the one that belongs in it. A wrong drop
  sparks and drops the wire back; there is no other penalty. It is the
  garage door, the ward doors and the car.
- **The note and the keypad** — a torn scrap with a code on it, and a keypad
  in the same spirit as the site's own passcode gate.
- **The close call** — being caught is not a death. She is grabbed at, she
  gets away, and she comes back to the last place she was safe. Hiding
  places are checkpoints in their own right, so it costs seconds, never a
  level.

### The ending

The chapter hands off to the same rooftop the maze did, reworked: the city
behind it has had a week (some windows dark or broken, a bite out of a
parapet, faint smoke — nothing graphic), the two cats are drawn rather than
four PNGs, and the camera cycles between four shots instead of pushing into
one. It lives in `script.js` with the rest of the ending.

## Status

- **Needs a real file:** `assets/our-video.mp4` — the clip of the two of you
  on the last page. The song is already in.
- **Placeholder, needs real content:** `KEEPSAKE_CLOSING`
- **Waiting on photos:** every frame in the book is deliberately empty and
  shows its own number — see **Photos** above
- **Rebuilt:** `book-scene.js` — ACES tone mapping, PMREM environment
  reflections, procedural normal/roughness maps, UnrealBloom + Bokeh depth of
  field, volumetric light shafts, segmented page geometry with real vertex
  deformation, and an adaptive quality ladder that measures frame pacing at
  runtime rather than trusting the user agent.
- **Working, leave alone:** everything from the passcode gate onward.

## Integration hooks (do not rename)

`book-scene.js` communicates with the rest of the site through exactly two
globals:

- `window.finishBookIntro()` — defined in `script.js`; the 3D scene calls it
  when the climax flash begins, to hand off to the passcode gate
- `window.skipBookIntro()` — defined in `book-scene.js`; `script.js` calls it
  when the user presses Skip, to halt the render loop


## The Long Way Round

Three choice points, in this order, and not one of them can be got wrong:

1. **A heart or a flower.** Decides nothing about where you go — both cards
   lead to the same screen — but it is remembered for the rest of the walk
   and it is what you are still carrying at the end.
2. **The way there, or the way back.** Spring, in the open, everything still
   ahead of you; or the same valley a year on, after dark, lit by lanterns
   somebody had to hang. Each has its own ending.
3. **The blue butterfly, or the red one.** Two routes per path, with
   different ground and different obstacles, rejoining before the ending
   that path shares.

| | blue | red |
|---|---|---|
| **the way there** | the high meadow: wrong turns, a shape in the trees that turns out to be a deer, fog that lifts | the stream bank: down at the water, seven stones to get over, then follow the current |
| **the way back** | the ridge: an hour of climbing, then a rope bridge crossed one section at a time | the orchard at dusk: a bear in the windfalls, and three ways to deal with it |

**There is no fail state.** There used to be two — a jumpscare bear on the
left-blue route and a getting-lost screen on right-blue, both of them
full-screen overlays with a *Restart* button, both reached from an ordinary
choice. Both are gone. The one place you can be sent backwards is the
orchard: walk straight past the bear and it looks up, and you are three
trees further back than you started, in the same scene, with the same
buttons. That is the whole penalty.

Scenes live in `HV_SCENES` and the story in `HV`, both near the bottom of
`script.js`. A node names a scene, what the cat says, and its choices; the
flags on it (`bear`, `fog`, `lighting`, `envelope`, `butterflies`, `fox`,
`plank`, `isAsk`, `cards`) are what `hvPaintFrame` draws on top.

## Super Ouissy

A side-scrolling platformer, reached from the hub. Three worlds — Sunny
Meadows, the Twilight Forest, the Castle of Sweethearts — a mini-boss, and a
castle ending. Arrow keys or WASD, space to jump (hold it longer to jump
higher), Esc to pause. On a phone there are thumb buttons along the bottom.

**It carries no files of its own.** Every sprite, tile and backdrop is drawn
pixel by pixel onto a canvas when the page loads, and every sound is
synthesised with Web Audio, so the whole game adds nothing to the size of the
repo beyond the one script.

### Changing it

Everything you are likely to want is in the first two hundred lines of
`super-ouissy.js`, in this order:

- `SO` — the words: world names, the how-to card, the ending
- `TUNE` — how she feels to control. Gravity, jump height, run speed,
  coyote time. Almost every complaint about a platformer is one of these six
  numbers.
- `DIFF` — Easy / Medium / Hard, written as multipliers over `TUNE`, so
  changing a mode is one line. Easy has five lives and no fatal pits (a cloud
  catches her); Hard has two lives and a clock.
- `WORLDS` — nine worlds, three per difficulty, as grids of characters, one
  per 16px tile, with the full legend written above them. Edit the strings
  and the level changes. Each difficulty walks its own three:

  | | World 1 | World 2 | World 3 |
  |---|---|---|---|
  | **Easy** | Sunny Meadows | Blossom Orchard | Secret Garden |
  | **Medium** | Riverside Path | Windmill Fields | Hilltop Town |
  | **Hard** | Twilight Forest | Sunken Ruins | Castle of Sweethearts |

  Enemies are skinned per set from `SKINS` — `walker`, `flyer` and `guard`
  are behaviours, and each difficulty names its own creature for each, so
  the movement code is shared while what she meets differs. Each set has its
  own boss too (a raincloud, a clockwork heart, the Heartbreaker), all
  running the same telegraphed state machine at different lengths.

Her sprite is a pixel map — `OUI_HEAD`, `OUI_BODY`, `OUI_LEGS`, one character
per pixel with the palette written above it. Change a string, change her.
Every row must stay sixteen characters long.

Best score and time are kept per difficulty in `localStorage`, and the
difficulty can be changed mid-game from the pause menu.


## Ouissy's Night Shift

A night-shift survival horror, reached from the hub. Ouissy has taken
the night job at the Wick & Cogs Toy Emporium — an old wind-up toy shop,
alone from midnight to six, with two doors, a ceiling hatch, eight
cameras and one charge of power between her and four automatons that
were built to move.

Original from the ground up — the shop, the four performers, the story,
the sounds and every piece of art in it. Nothing is borrowed from any
existing game.

Nobody talks to her. There is no phone call, no radio voice, no guide.
The only thing with a voice is the building's own security annunciator,
a vocoder that reads out states and nothing else — *power at twenty
percent*, *door two: open*, *motion detected: east vent* — with the
words printed under it because a vocoder is not meant to be understood.
Everything else the shop has to say is written down and found: a shift
card taped inside the desk drawer, a page of the ledger, a workshop
board, an inscription on the underside of a music box.

**A/D or the arrow keys** shut the two doors, **W** the hatch,
**space** raises the camera monitor, **1–8** jump straight to a camera,
**Esc** pauses. On a phone the same five things are buttons along the
bottom. Drag anywhere in the office to look around.

### How a night works

Six in-game hours, about five and a half real minutes. One power meter
for the whole shift, drained by sitting there, by every second the
monitor is up, and by every second a door is held shut. At zero the
lights go out, the doors stop answering, and you wait — which you can
survive, if you were not wasteful, because six o'clock might come first.

| | | |
|---|---|---|
| **Cogsworth** | tin soldier | Marches down the main hall. You hear him coming; the marching stops when he is at your door. |
| **Chime** | clockwork owl | Lives in the ducts. Doors mean nothing to it — the hatch is the only thing that does. |
| **Marabelle** | music-box ballerina | Cannot move while she is on a camera. Can move the whole time she is not. |
| **Jax** | jack-in-the-box | Fast, and he does not leave. A shut door only makes him knock, and each knock costs power. |

Between them they close off every lazy strategy: watching one camera all
night loses to Chime, never watching loses to Marabelle, and holding
everything shut loses to Jax and the meter.

Six nights, and each one changes a rule rather than just going faster:

| | |
|---|---|
| **Two** | the owl wakes, and the workshop camera dies for good |
| **Three** | cameras drop at random, and the hall lights go out — Cogsworth has to be tracked by ear |
| **Four** | the bus surges and takes chunks off the meter, and the office bulb starts going out by itself |
| **Five** | the right-hand actuator is failing: that door is slow to answer and costs half again to hold |
| **Six** | the monitor cuts out mid-look |

The budget is set against night six, not night one. An attentive shift
on the last night — four of them awake, a door shut only while something
is actually at it — comes down to the last ten percent, and is meant to.
The same care on night one leaves a third of the meter in hand.

Night six ends the story on dawn rather than on a scoreboard: the
shutters go up, the shop is still for the first time, and the last found
object finishes the toymaker's story.

### Why she is there

The film tells her who he was. Then the shutters come down and he tells
her what she is doing, which is the part that was missing for a long
time: **six nights, and try not to let anything reach you.** Not because
surviving is the game, but because he is not handing the worst thing he
ever did to somebody who might not be there on Saturday. She agrees by
pressing one button, and after that every night is a payment against a
deal she made rather than a situation she is in.

It is scored as a clock: a tick on every beat and a brass swell that
never gets anywhere, because he is counting and she cannot stop him.

The last night answers it. Six nights with nothing laying a hand on her
reads one way; six nights with some of them getting through reads
another, and both of them are warm — getting caught costs her the clean
run and nothing else, and he says so himself the first time it happens,
in his own voice, over the game-over card.

### What she is actually doing

Night one opens in the terminal's **orientation mode** — a real thing an
old security system would have. One instruction at a time, and *the
shift stops and waits*: the clock does not run, the meter does not
drain, nothing walks. She raises the monitor, walks the cameras, shuts a
door, opens it again, latches the hatch — and then it runs one of his
four down in front of her, makes her find him on a camera, and has her
hold the key in his back until he is wound again. That last one is the
control the whole story turns on, and for a while orientation did not
teach it at all. She cannot fail any of it and she cannot fall behind
it; the clock does not move and the only thing the whole lesson costs
is the one percent that winding him costs. It runs once and never
again.

And every night there is **one thing hidden in the shop** — a brass tag,
a card, a folded letter — sitting on a surface somewhere on the eight
cameras, catching the light about as much as brass catches light. It is
not on the map and the system never mentions it. She has to go looking,
which is what turns the cameras from a threat detector into a search,
and the waiting into exploring while something hunts her. Miss it and it
stays missed; the night ends by telling her there was something she
walked past.

Where each one hides is derived rather than authored: a point along the
line that room's camera is actually looking down, dropped onto whatever
surface is under it. So it is guaranteed to be in shot and guaranteed to
be resting on something, and moving a camera later cannot silently
orphan a page.

The four tags also happen to explain exactly what their toy does, which
means **the story is the tutorial** — read them and you know the game.

### The two kinds of thing in the shop

**His four** — Cogsworth, Chime, Marabelle and Jax — are the ones he
never sold, and each is built around one thing about her. They walk to
her door every night, and for most of the game she keeps them out
because his note told her to.

**The ones he sold** start coming back on night two. Four hundred and
eleven went out of this shop into other people's houses, and the
address on every one of them is here. They are not a faster
animatronic, they are a different problem:

- **They are never seen moving.** A parcel is simply one room closer
  than it was the last time she looked.
- **They do not knock.** A shut door is a handle being tried, over and
  over, until they lose interest.
- **Watching does nothing.** They were not built for her and they do
  not care whether they are observed.
- **Nobody ever sees one.** They came back the way they were sent —
  wrapped, tied, labelled, with something pale showing through a tear
  in the corner that never resolves.

She tells them apart by ear. His four have voices: boots, wings, a
music box, bells. These have paper, string and a weight settling.
There is no melody anywhere in them.

### Winding, and what the four are for

His note says wind the four every night, and that is the mechanic. Each
carries a key; find one on a camera and hold it for a second and a bit.
Let one run down and **it stops obeying its own tag** — a wound
Marabelle freezes when she is watched, a slack one does not, and every
slack one moves faster and gives up on a shut door far more slowly.

And then the thing the whole story turns on. When one of the ones he
sold gets through an open door, **if any of his four is still wound,
one of his gets there first.** The returner leaves. The one that
stepped in is spent, and will not do it again until she winds it.

His four are her lives. His instruction is what buys them. Nothing in
the game says so until the first time it happens.

### Six nights, six experiences

Each night has a name, a look and one thing it tells her about him, in
the middle of the shift rather than either side of it.

| | | |
|---|---|---|
| **One** | THE INVENTORY | a second key, taped under the drawer. He never gave her a key to anything in fifteen years. |
| **Two** | THE FOUR HE KEPT | four names chalked on the bench, and one word under all of them. |
| **Three** | FOUR HUNDRED AND ELEVEN | the delivery book. Eleven of the RETURNED boxes are ticked, in a pen that is not his. |
| **Four** | WHAT THEY WERE FOR | a bank book behind a loose board. One payment a month, from the spring they married. |
| **Five** | LET IT | a drawing on graph paper: four figures around a woman at a desk, all of them facing outward. |
| **Six** | THE SHUTTERS GO UP AT SIX | the last thing he wrote, folded under the comb of the music box. |

And the shop goes with them. Night one is warm and lit; by night six it
is nearly ash, with the dark two-thirds of the way in from the corners.

### Camera zero

The one room in the shop that had no camera on it was the room she is
sitting in. Everything frightening happened somewhere else, to a figure
walking a route, and arrived as a number going down.

There is a camera on the desk now — the ceiling directly behind her
chair, looking the way she is looking. From the third night there is
sometimes something standing in it. It never touches her, it cannot
cost her anything, and it is not on anybody's route. It is simply one
mark closer every time she looks away, walking up the room toward the
back of her chair, and then it is not there at all.

### The score

One piece of music, ten rooms to play it in, and it never cuts — the
grid never restarts and the tempo eases rather than snapping, so a
scene becomes the next one without a join anywhere. But they are cues
rather than fader positions: eleven instruments, and each scene has
material of its own.

| | |
|---|---|
| **the terms** | a clock and a swell. Nothing resolves. |
| **the minute before a night** | the same clock, and a heartbeat under it |
| **the shift** | six layers arriving in order as dread climbs, ahead of anything visible |
| **the meter going out** | the heartbeat *stops*. A choir on one note and no melody at all |
| **after a death** | a piano, alone, remembering the phrase rather than playing it |
| **a page in her hands** | the phrase in the major, in thirds — the first time two notes agree |
| **one of his getting there first** | piano an octave up, choir underneath. The one place it is allowed to be enormous |
| **six o'clock** | the major phrase finally resolved, with the last note left ringing |

### The six pages

They start as a stranger's. An old toymaker, four automatons, a woman
who did not come back; and each tag carries a place, described rather
than named. On the fourth, a second hand answers him in newer ink. By
the fifth it is not his shop any more. The sixth is signed.

The last night ends on the only choice in the chapter: **wind the music
box, or leave it**. Two endings, both warm, one bittersweet.

### Behind the story

Finishing it opens four things on the title screen. **Custom Night** —
a slider from 0 to 20 for each of the four, so any combination can be
asked for. **The shop in daylight** — a calm walk-through of all nine
rooms in the morning, nothing running, nothing going to move, which is
where the one warm personal thing in the chapter lives. **The record** —
which nights are cleared and eight badges — two of them for looking
after his four rather than for surviving — each of which puts one more
small object on the shelf beside the desk. And **Cozy Mode**, on the
title screen from the start, which is not a lesser version: gentler
jumpscares, a slower meter, fewer alarms and more time at a door.

There is one thing not listed anywhere, in the arcade.

### Changing it

The first three hundred lines of `night-shift.js`, in this order:

- `NS` — every word in it: the shift card that opens night one, the
  found pages between nights, the finale, the how-to card, the badges,
  the ratings, and the whole vocabulary the annunciator is allowed.
- `TUNE` — how the night feels. Seconds per hour, every power rate, and
  a step interval, a movement chance and a door grace per performer.
  Almost every complaint about a game like this is one of these numbers.
- `NIGHTS` — one entry per night: who is awake and from which hour, the
  aggression multiplier for each of the six hours, and any hazards.
  Adding a seventh night is adding an entry; nothing else counts them.
- `ROOMS` — the nine rooms and how they join up, on the floor and in the
  ducts. `MAP_PLAN` is the plan drawn on the monitor.
- `CAST` — the four performers and the route each walks to the office.

### How the 3D is built

Three.js, on the copy in `vendor/` that the book intro already uses. The
racing chapter is **not** Three.js — it is a hand-written Mode 7 scanline
renderer — so there was nothing there to share; this is a clean parallel
setup, written generically (texture library, prop kit, light rig, contact
shadows) so it is tooling rather than a one-off.

Four rules are enforced in code rather than by care, because all four
were problems on the racer:

- `slab()` is the only box builder and it has a minimum thickness, so a
  flat cutout cannot be built by accident.
- `place()` is the only way a prop enters a room, and it lays a contact
  shadow sized to that prop's own footprint. Nothing floats.
- a room is composed once in its own space, parked at its own address
  sixty metres from its neighbours, and then frozen — matrices off, world
  matrices off. The frame loop has no handle on a static prop at all.
- anything that appears twice has a variant kit (four shelves, four
  arcade cabinets, three chairs, three crates, six toys, five wall
  fittings, four grates) and `place()` varies rotation and scale on top.

Nine rooms cost between 1 and 3 milliseconds of CPU a frame and between
160 and 460 draw calls, and the whole shop builds in about six hundred
milliseconds — which is long enough to notice, so entering the chapter
puts a card up and waits a frame before it starts.

It carries no files of its own. Every surface — planks, lino, brick,
galvanised duct, velvet, carpet, plaster, wallpaper, concrete, brass,
porcelain, harlequin diamonds, the night outside the window, the standby
screen on the desk monitor — is painted into a canvas at boot, and every
sound is synthesised.

### The score

There is no soundtrack file and no loop. There is one continuous piece
of music that never restarts, and six layers of it that fade in and out:

| | arrives at | what it is |
|---|---|---|
| **sub** | always | a 41Hz floor you feel rather than hear |
| **pulse** | dread 0.10 | a heartbeat — 46bpm at rest, 104 at a door |
| **box** | 0.20 | a music box playing the shop's own unfinished figure |
| **air** | 0.28 | breath, up where a room's silence lives |
| **grind** | 0.44 | a minor second held against the root |
| **bow** | 0.60 | the top string, bowed and shaking |

`dread` is built from things the player cannot see yet — chiefly how far
along its route each awake performer is, squared so the last two rooms
count for more than the first four. Because that climbs while something
is still three rooms away, **the pulse quickens before there is anything
on any camera to look at**. It rises fast and lets go slowly, so a room
does not feel safe the instant a door shuts. The whole grid — heartbeat,
music box, strings — runs off one sixteenth-note clock whose tempo is
`dread`, and everything is scheduled ahead of the audio clock rather
than on the frame, so a dropped frame moves nothing.

The menu has its own theme: the same music box in the major key it was
written in, played slowly, transposing every fourth pass and picking up
an answering voice a fifth above on every other one, so a long sit on
the title screen never becomes a loop. Six o'clock switches to a third,
warmer mode. A death cuts the music dead — the silence is half of what
makes the scare land.
