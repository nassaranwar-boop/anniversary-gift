# Anniversary gift site

A single-page interactive gift. Open `index.html` in a browser, or push this
folder to a GitHub repo and enable GitHub Pages (Settings → Pages → deploy from
branch → main → /root).

**Passcode to enter the site: 2207**

## Files

```
index.html      page structure (all screens are <section class="screen">)
vendor/         three.js r180 + post-processing, bundled for offline use
style.css       all styling
script.js       site logic + maze/adventure content config (EDIT CONTENT HERE)
book-scene.js   the Three.js 3D intro scene — self-contained
scrapbook.js    the memory book — its own config block at the top
assets/         images used by the 2D parts of the site
```

## Screen flow

1. **3D book intro** (`book-scene.js`) — tap to trigger; ends by calling
   `window.finishBookIntro()`
2. **Passcode gate** — 2207 (the seal blooms open)
3. **The memory book** (`scrapbook.js`) — a painted candle opening, the
   "for you," cover, ten collaged pages turned by hand, and a back cover.
   The round button bottom-right opens a drawer with the bouquet, the song,
   the Marrakech memory map, the voice note and the music video.
4. **Hub** — "choose your adventure", two chapters in either order
5a. **The Maze** — level 1 -> level 2 -> divider -> cats night-sky ending
5b. **The Long Way Round** — branching pixel-art choice adventure
6. **Keepsake** — scrapbook recap, unlocked once both chapters are done

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

## Photos — just name the files

Every frame in the book is numbered, and every empty frame says its number.
Save a photo as `assets/photo-<that number>.jpg` and it lands in that frame.
Nothing to configure.

```
assets/photo-1.jpg    →  the frame marked "1"
assets/photo-13.jpg   →  the frame marked "13"
```

`.png` works too. Slots 1–40 are the pages, in reading order; 41–44 are the
four pins on the Marrakech map. A frame with no file keeps showing its number,
so you can fill them in any order.

To add a title, date or caption to one, add an entry to `MEMORIES` in
`script.js` at that position — `MEMORIES[0]` is photo 1, `MEMORIES[12]` is
photo 13 — and set `photo:` there only if the file is named something else.

## Turning the pages

There is no toolbar. Take the corner of a page and pull it across, the way you
would with a real book — the page lifts, turns about the spine and settles.
A tap near the outer edge of a page turns it too, and the arrow keys still
work. The ribbon marker at the top of the book closes it.

## The memory book — where to edit

Everything you are likely to change is in the `SB` block at the top of
`scrapbook.js`:

- `SB.song` — the track the drawer plays. Save the file as `assets/song.mp3`.
  `startAt` is where playback begins, in **seconds** — raise or lower it until
  it opens on the line you want.
- `SB.video` — `youtubeId` for the music video (currently Bouss – Printemps).
- `SB.voice` — record your voice note and save it as `assets/voice.m4a`.
- `SB.map` — the city and its pins. Each pin has `x`/`y` in % of the map card,
  plus a date, title and place. The four pins use photo slots 41–44.
- `SB.letter` — the note behind "Tap here to view more".
- `SB.hand` — the scraps of handwriting scattered through the pages.

The pages themselves are the `PAGES` array further down: one entry per page,
each a list of pieces positioned in percentages of that page.

## Status

- **Needs real files:** `assets/song.mp3` (the track for the drawer) and
  `assets/voice.m4a` (the voice note). Both players show a hint until they
  are added.
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
