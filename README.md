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
5b. **The Long Way Round** — branching pixel-art choice adventure
5c. **Super Ouissy** — a three-world platformer (`super-ouissy.js`)
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
- `QUEST_FINAL` — the closing question of the choice adventure, and both
  answers. Still a placeholder.
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

## Status

- **Needs a real file:** `assets/our-video.mp4` — the clip of the two of you
  on the last page. The song is already in.
- **Placeholder, needs real content:** `QUEST_FINAL` and `KEEPSAKE_CLOSING`
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
