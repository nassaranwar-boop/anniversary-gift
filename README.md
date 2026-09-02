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
apocalypse.js    the stealth chapter, in 3D — its own config block at the top
assets/          images used by the 2D parts of the site
vendor/          three.js r180 + postprocessing, bundled; used by the
                 book intro and the apocalypse, loaded on demand
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
5d. **Ouissy at the Apocalypse** — a five-level third-person 3D stealth
    story (`apocalypse.js`), ending on the same rooftop as the maze
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

A third-person 3D stealth story in five levels, reached from the hub. She is
home alone when it starts; the game is her getting to Anwar, and then the two
of them getting somewhere safe.

Arrow keys or WASD to move, **shift** to creep, **E** or space to use
whatever she is standing at, Esc to pause. On a phone there is a pad and two
buttons.

### It is a real 3D game

It runs on `vendor/three.bundle.js` — three.js r180 with the postprocessing
addons, bundled for offline use, and the same one `index.html` already loads
for the book intro. `apocalypse.js` will fetch it itself if it is not there,
so the chapter keeps working if that tag ever moves.

Everything you look at is geometry with lights on it, rendered clean —
multisampled, half-float, analytically anti-aliased, and with no film grain
or dither anywhere in the chain. Grain is a way of hiding a render; this one
does not need hiding.

Everything you look at is geometry with lights on it:

- **The world is built from the grid at load time.** Walls, floors, kerbs,
  roofs, facades, debris and furniture go into `InstancedMesh` batches, so a
  street of forty buildings with two hundred windows in it is still a couple
  of dozen draw calls. Outdoors the walls are flood-filled into buildings and
  each one gets its own storey count and its own roofline — a parapet with a
  coping on it, a stair head, a water tank on legs, plant, an aerial. The
  facades are real: a plinth at the pavement, a string course at every floor,
  windows set into a dark reveal with a sill, a lintel and a mullioned frame,
  shopfronts at street level with fascias and half-down shutters, and a
  cornice under the parapet. A week into this, some of them are boarded, some
  have lost their glass, and one or two have soot up the wall above them.
  Rubble banks up where a wall meets the pavement, litter blows about, and
  somebody's bin is still out.
- **Nobody is a sprite.** One builder makes every figure in the game from a
  spec — a lathed torso with a waist in it, a jacket over the top of it, a
  deltoid at each shoulder, a skull with a jaw and a brow and eyes with lids
  and brows over them, and boots with soles. Ouissy has long blonde wavy hair
  built as a cap, a fringe and fourteen tapered locks, each waved on its own
  phase. The ones that used to be people come out of a combination of nine
  skin tones, six wardrobes, four builds and a set of things that can have
  gone wrong, so a corridor with eight in it has eight different people in
  it. Ashcombe has staff on the gate in hi-vis with rifles slung, and a dozen
  people waiting inside who got there first. The walk cycle, the creep, the
  lurch, sitting on a log and sitting astride a horse are all poses on the
  same rig.
- **The dark is lit, not painted.** A hemisphere light for the sky, one
  directional for the moon or the sun, a pool of eight point lights moved to
  whichever lamps are nearest her, and her torch — a shadow-casting spotlight
  with a soft-gradient cone that dust drifts through and that arrives where
  she is pointing about a tenth of a second after she does. One streetlight
  in six is on its way out and flickers like a failing tube. Every light in
  a level is scaled by how bright that location's own materials are, so
  "dark" means the same thing in the hospital as it does in the house.
- **Materials have something to reflect.** Each level renders its own sky
  into a cube at load and runs it through PMREM, so glass picks up the sky
  and the building opposite, wet tarmac picks up the streetlights, and metal
  stops looking like plastic. The road's roughness comes out of a painted map:
  the standing water in it is mirror-smooth while the aggregate around it
  stays matt.
- **Nothing snaps.** Every follower in the game — her turn, her crouch, the
  torch, the camera position, the camera's lead, its distance, its field of
  view, the doors, the fades — runs through a frame-rate-independent ease,
  and the camera itself is on critically damped springs, so it settles
  without overshoot and behaves the same at 30 fps as at 144.
- **Post**: bloom, then one pass that does the colour grade, the haze, the
  vignette, the grain, a touch of lens fringing and the red pulse when
  something has hold of her.
- **It still carries no files.** Every surface is a texture painted into an
  offscreen canvas at load, every sound is an oscillator, and the sky is a
  fragment shader. The chapter adds one script to the repo and nothing
  else — no images, no audio, and no library the site was not already
  loading.

If the machine cannot hold a frame rate the render scale drops on its own,
measured over a second and a half so one long frame never triggers it.

### The levels

| | | |
|---|---|---|
| 1 | **Home** | the news is still on downstairs; the garage door has no power |
| 2 | **The Streets** | three ways across town, and a gate code dropped in a shop |
| 3 | **The Hospital** | Ward C is dead, he is behind it, and it is getting worse |
| 4 | **The Road** | out of the building, a car that might start, and a horse |
| 5 | **The Gates** | the check, the serum, and somebody opening a gate |

Between them: the drive, the ride, the campfire, the sunrise and the roof.
All five are 3D scenes of their own with their own cameras, not slideshows.

### Changing it

Everything you are likely to want is in the first six hundred lines of
`apocalypse.js`:

- `MAPS` — the maps, as grids of characters, one per tile, with the full
  legend written above them. Edit a string and the place changes.
- `LEVELS` / `SUB` — what each place is called, how dark it is, its colour
  grade, and its list of steps.
- `PAL` — five palettes. The world builder, the lighting and the post chain
  all read from these, so changing one line changes the whole look of a
  place.
- `TALK` — the words. Every line in the game, verbatim. A line written as
  `[null, null]` is a beat of silence and is held on screen like any other
  line; those are doing as much work as the spoken ones.
- `TUNE` — how she feels to play. Distances are still written in the design's
  original pixels and converted once at the top, so the stealth reads the way
  it was tuned. Almost every complaint about a stealth game is one of these
  numbers.

### Three mechanics, built once

- **The wire panel** — a salvaged distribution board with the cover off:
  four cores out of the loom on the left, four terminals on the right, no
  labels. A wrong drop arcs, and an arc is the loudest thing she can do. It
  is the garage door and it is Ward C.
- **The note and the keypad** — a torn rota with a code biroed on it, and a
  keypad screwed to a fire door.
- **The close call** — being caught is not a death. She is taken hold of,
  she has a second and a half to answer it, and if she does not she comes
  back to the last place she was safe. Hiding places are checkpoints in
  their own right, so it costs seconds, never a level.

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
