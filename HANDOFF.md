# Working on this project — read this first

A briefing for whoever picks this up next, written after several sessions
with Anwar. It is about *how* he wants things done as much as what is left.

---

## 1. The repository rules — these are absolute

- **One repo, one branch.** `nassaranwar-boop/anniversary-gift`, branch
  `main`. Never create a branch, never open a PR unless he asks in words,
  never change the remote.
- Verify the remote and the branch **before touching anything**. If either
  is not what you expect, **stop and ask** — he would rather you stop than
  push to the wrong place.
- Commit and push to `main` when a meaningful piece is finished, then tell
  him the commit hash.
- Never delete files or assets unless he asks.

## 2. What he means by "not basic"

This is the single most important thing to understand. He has said it
several times, in several ways: *"switch everything u did basic to some
perfect things, i dont want any basic thing in my website."*

Concretely, things he has rejected:

- A flat coloured rectangle standing in for a video ("disgusting", "just a
  loading green screen"). He wants a real poster frame, or a film slate —
  something that already looks like the thing it represents.
- A player that is a play button and a bar. The song player now has a record
  that turns while it plays, a draggable scrubber and both times. That is the
  floor, not the ceiling.
- Emoji or clip-art standing in for artwork.
- A page turn that is a flat rotation. He said it "looks sloppy and unwell
  made… turning the pages would feel like an actual page not just a flat
  surface." The turn is now a real cylinder: each leaf is cut into vertical
  strips and every strip is placed on a bending sheet, so the free edge
  trails the spine the way paper does. Do not flatten it back to one
  rotating element. It is also self-tuning: it watches its own frame pacing
  and picks a strip count the device can afford. If it ever feels heavy,
  profile it rather than simplifying the mechanic — filters and drop
  shadows inside a moving sheet were the expensive part, not the maths.
  Anything that animates continuously on a *page* also gets copied into
  every strip of a turn, so it multiplies — that is why the pages are
  still and only the bouquet in the drawer moves.
- A grid of identical frames. He wants variety, and he wants the composition
  to breathe: *"the goal is not to have the maximum of photos possible, the
  goal is everything have to look perfect and aesthetically attracting."*
- Anything filling the whole viewport edge to edge. He asked for the book to
  be **smaller** so it sits on the page.

So: when you reach for a quick placeholder, don't. Draw the real thing.
Nearly all the artwork here is procedural canvas drawn at runtime — papers,
disco balls, vinyl, the bouquet, the cameras, the map, the candle. Extend
that library rather than dropping in an emoji or a flat block.

## 3. How he reviews

He looks closely and he is specific. Real notes he has given:

- "the pictures doesnt sit well on their frames, logically the photos have to
  be below the frame so the corners wont show" — he notices z-order and
  physical plausibility.
- "upgrade the polaroid frame to look like an actual tall type, not a small
  square inside a big one" — he notices proportions.
- He counts things. He noticed most frames were polaroids.

Which means: **look at your own work rendered before you say it is done.**
There is a headless Chromium here; screenshot the actual page and study it.
Several bugs in this project were only visible in a render (percentage
padding resolving against the page instead of the card, for one).

## 4. How he works with you

- He gives a long list in one message. Work the whole list; don't stop after
  the first item.
- When he says "firstly fix that bug so i could inspect", ship that fix and
  push it before carrying on, so he can look while you work.
- He is conscious of cost and time — he has said his usage went unusually
  fast. Be efficient: don't re-read huge files you already know, don't
  re-explain, keep replies short. Recommend a fresh session when the context
  gets long.
- He is not a native English speaker. Read for intent, not grammar.
- He asks for detail but not for lectures. Report what changed, the commit,
  and what is still waiting on him.

## 5. What the site is

An anniversary gift for his girlfriend. Passcode **2207**. The tone is warm,
loving, handmade — never cold, never corporate.

```
index.html       every screen is a <section class="screen">
style.css        one :root theme block drives the whole palette
script.js        screen flow, the maze, the choice adventure, ambient pad
book-scene.js    the Three.js opening — self-contained, leave it alone
scrapbook.js     the memory book: config at the top, then art, pages, turning
super-ouissy.js  the platformer: config, tuning, difficulty, levels, engine
rescue.js        its story scenes: Anwar, Death, the dialogue. Hard only.
vendor/          three.js r180, bundled
assets/          photos, song.mp3, and the 2D art the maze/adventure use
tools/           offline checks — see tools/README.md. Nothing here ships.
```

Flow: 3D book intro → passcode → **the memory book** → hub → three chapters
(the maze, the choice adventure, Super Ouissy) → keepsake.

**Three.js is intentional.** It runs the opening only. Don't replace it,
don't spread it to other parts.

## 6. The memory book — the part he cares most about

Modelled on a TikTok scrapbook video he sent. It should feel like a real
object.

- A painted candle burns, with butterflies round the flame. It waits — it
  does **not** time out. She taps it.
- The book arrives **closed on its cover**. There is no "open" button. Every
  page including the cover is turned by dragging the corner across; the book
  widens as the cover comes over.
- Ten collaged pages, then a back cover. Photo frames vary on purpose:
  polaroid, snapshot, matted, photo-corners, deckle edge, painted mount,
  film cells, photobooth strip.
- A ribbon marker closes the book. No toolbar.
- Bottom-right button opens a drawer: the bouquet, the song (Mirage — Bouss),
  the Marrakech memory map with photo pins, and the music video
  (Printemps — Bouss).

### Photos

Every frame is numbered and shows its number while empty. `assets/photo-7.jpg`
lands in the frame marked **7**. Slots 1–30 are pages, 31–34 are map pins.
`MEMORIES` in `script.js` is only for adding a title/date/caption.

### Still waiting on him

- `assets/our-video.mp4` — the clip of the two of them, last page.
- The photos.
- `SB.song.startAt` (seconds) — nudge until the track opens on his line.
- `QUEST_FINAL` and `KEEPSAKE_CLOSING` in `script.js` are still placeholders.

## 7. If he says the site looks old or is stuck

He is on GitHub Pages, and it serves cached CSS/JS hard. A half-updated
cache (new script, old stylesheet) is what stranded him once — the new
script is pull-only, so with the old stylesheet nothing responded to a tap
and there was no way forward. The asset links in `index.html` now carry a
`?v=N` query. **Bump that N in every commit that touches css or js.**

## 7a. Super Ouissy

A platformer, added as a third hub card. It follows the same rules as
everything else here: no image files, no audio files — the sprites, the
tiles, the three parallax backdrops and the sound are all made at runtime.
The config, the physics tuning, the three difficulty tables and the three
level grids are the first two hundred lines of the file, in that order, and
the level grids are plain strings with the legend written above them.

Two things worth knowing before you change it:

- **It is a bonus chapter on purpose.** The keepsake still unlocks on the
  maze and the adventure alone. If you make it required, anyone who has
  already finished the first two will find the keepsake locked again.
- **Ouissy is a pixel map, not a shaded drawing.** The first version of her
  was built out of the same `blob()` shading the rest of the site uses and
  she came out with no face at all — at sixteen pixels wide that approach
  turns to mush. `OUI_HEAD` / `OUI_BODY` / `OUI_LEGS` are one character per
  pixel. Do not go back to blobs for anything this small.

## 7b. Ouissy at the Apocalypse — in progress, on a branch

This one breaks rule 1 on purpose and with his say-so: he asked for it in
words — *"work on a new branch, and do NOT delete or remove the existing
Maze game from the live site until the full new game is built, tested, and
I've confirmed it's working."* Branch `claude/ouissy-apocalypse-game-c8cag8`.

It replaces The Maze entirely, but **it has not replaced it yet.** The maze
is untouched and still on the hub; the new chapter arrives as a fourth card
beside it so he can play both. Removing the maze is the last step and is
**gated on him saying so** — do not do it on your own initiative, and when
he does say so, it is one commit: the maze screens, its CSS, its half of
`script.js`, and the hub card, with the new chapter moving into its slot.

Five levels, a top-down stealth story, all of it in `apocalypse.js`, which
carries no files of its own the way `super-ouissy.js` does not. Everything
worth editing is in the first two hundred lines: `AP` for the words,
`TUNE` for how she feels to play, `LEVELS` for the maps as grids of
characters. The reunion in Level 3 is `AP.reunion`, written underplayed at
his direction — *"like a real conversation between two people in shock and
relief, not a dramatic speech"* — and the lines written as `["", ""]` are
beats of silence, held on screen like any other line. Keep them.

Still open with him: whether the level-by-level screenshots pass, and the
wire panel's look (he wrote the art direction for it himself and has not
seen it running yet).

Three things this build learned the hard way, all worth not repeating:

- **A second function declaration with the same name at the same scope
  wins.** The ending's cat routine was called `drawCat`, and the choice
  adventure already had one — so every call silently drew the wrong thing
  and the roof rendered a heart floating over nothing. It is `drawEndCat`.
  This is the third time this file has been bitten by exactly this.
- **The light map's tint has to be mixed with the dark, not multiplied into
  it**, or a level asking for daylight still comes out as night.
- **A fixed number of clicks through a dialogue is a bug waiting to
  happen.** Drain the box until it is closed instead; one extra line in one
  beat put every later step out of phase and the suite reported a level
  that had never started.

## 7c. Ouissy's Night Shift — the night-shift chapter

The fifth game, and the first one in this repo that is actually 3D in
the way the racer never was. Written on a branch at his request
(`claude/wick-cogs-horror-game-1i25wl`), added as a sixth hub card,
nothing removed. It was built first as **Wick & Cogs** and then
personalised in a second pass: the shop kept that name, the game took
hers, and Ouissy became the guard rather than an unnamed one.

Read `README.md` for what it is and how to change it. What matters for
whoever picks it up:

- **It is Three.js on the bundled copy, and the racer is not.** The
  racer looked like a 3D game and is a hand-written Mode 7 scanline
  renderer with no `THREE` in it at all. Do not go looking for shared
  code between the two; there is none, and the tooling worth sharing
  (the texture library, the prop kit, the light rig, `place()`) is in
  `night-shift.js` for a future rebuild of the racer to use.
- **Four rules are enforced in code**, all of them from complaints
  about the racer: `slab()` has a minimum thickness so a flat cutout
  cannot be built by accident; `place()` is the only way a prop enters
  a room and it lays a contact shadow, so nothing floats; a room is
  composed once and frozen, so the frame loop cannot drift it; and
  anything appearing twice comes out of a variant kit.
- **Two ordering traps cost an hour each and are written up in the
  file.** Freezing a subtree *before* parenting it leaves every prop
  stacked at the origin — one of them ended up across the camera lens.
  And freezing before the room's own world matrix exists puts a whole
  room in its neighbour's space, which looks exactly like a room that
  failed to build.
- **Light intensity is candela.** three.js has been on physical units
  since r155, so the readable 0–3 numbers each room asks for are
  multiplied by `LUX` in one place. The first build of the office was
  black and it was this.
- The light rig is a fixed eight point lights plus one ambient, always
  in the scene, re-pointed when the view changes. That is deliberate:
  adding or removing a light changes the shader and stalls, and a stall
  when you flip to a camera is the worst possible moment for one.

The second pass added the things that are easiest to get wrong, so they
are worth knowing before touching any of them:

- **There is deliberately no narrator.** He asked for this twice. The
  only voice is the building's security annunciator — a formant-pair
  vocoder over `NS.sys`, which is a closed list of status lines. It
  reports states and stops: no reassurance, no story, no use of her
  name, no mention of the performers except as a sensor reading. If a
  line being added to `NS.sys` would sound like a person, it belongs on
  a piece of paper instead.
- **All the lore is found, never spoken.** Night one briefs off a card
  taped inside the desk drawer; nights two to six each open on one
  small found thing (`NS.beats`), a sentence or two at a time, and the
  toymaker's story resolves in `NS.finale`. Nobody in the chapter ever
  states the theme.
- **The one personal touch is walled off from the horror.** The framed
  photo of the two of them is only ever visible in the daylight
  gallery (`parts.usFrame.visible = G.mode === "gallery"`). It is not
  in the office at night, and it is not in `SHIFTIES` — the pairs of
  props that quietly swap between camera checks are all the shop's own
  objects. Keep it that way; he asked for it explicitly.
- **The power budget is tuned against night six, not night one.**
  `TUNE.power` is a budget with a comment explaining it. The way to
  retune it is not to guess: drive an attentive guard through every
  night with `__night.pump` and look at where the meter lands. Night
  one should finish around a third full and night six on fumes. Note
  that `pump` runs the same step list as the frame loop — alarms,
  shifties and hazards included — precisely so that measurement is
  honest; an earlier version left the surges out and made night four
  look winnable when it was not.
- **Cozy Mode is a first-class difficulty, not an accessibility
  afterthought.** It is one multiplier table (`TUNE.cozy`) read through
  `cozyK()`, and it touches aggression, door grace, power, alarm
  frequency, decay and the force of a jumpscare.

A third pass added the score and fixed four things that reading the
code found and no suite had:

- **`onKey` checked the phase before it checked the cabinet**, so every
  key in KEYWIND was dead and the space bar hit BACK TO THE SHIFT. There
  was no `keyup` listener in the file at all. Order matters there now.
- **The custom night's four sliders were one slider.** The hour curve
  was derived from the highest dial, so turning Jax to twenty made
  Cogsworth two and a half times faster at his own unchanged five.
- **`observed()` did not know a dropped monitor is not a monitor.**
  `powerRate` always had; this did not, so night six's dropouts froze
  Marabelle exactly as well as a working picture. If you touch one of
  those two, touch both.
- **The blackout ran its clock twice.** `stepBlackout` owns the
  approach, but a blackout forces every door open, so `stepCast`'s
  open-door branch decremented the same timer again every frame. Nine
  seconds of grace was four and a half. `stepCast` now returns early in
  the dark.

And the pacing: `tools/nightpace.js` measures the longest stretch of a
night with nothing audible in it, and found **night one's first hour
running fifty-six seconds with nothing at all** — no arrival, no alarm,
nothing moved. The first minute of the first thing she plays cannot be
an empty room. False alarms now start twelve to twenty-six seconds in
rather than up to ninety, and come roughly twice as often while nothing
is on its way, which is what they were always for. The longest dead
stretch anywhere is now about eighteen seconds.

On the score (§17c in the file): it is layers, not tracks, and the
thing to preserve if you touch it is that **`dread` reads the route,
not the door**. That is the whole point — a performer's route position
climbs while it is still three rooms away, so the music is ahead of the
game rather than behind it. Everything is scheduled against the audio
clock with a 0.65s lookahead, never on the frame, because the frame
rate is the one thing not guaranteed on a phone.

One thing worth knowing about the office lighting: **the monitor's glow
lamp used to sit 0.35m from where a guard's right hand goes, rated the
same as the ceiling of the whole room.** Everything near it tone-mapped
to white, which is why the hands read as white gloves through three
rebuilds before anyone thought to print the light positions. If
something in that room looks bleached, print the rig before you touch
the albedo.

A fourth pass answered the real question — why would somebody who has
never played one of these keep playing — with three things:

- **Orientation.** Night one runs a scripted first ten minutes where
  the shift *stops and waits* for her: `tutorStep` gates the entire
  play branch of the frame loop, so the clock, the meter and the cast
  are all still until she has done what it asked. It cannot be failed
  and it runs exactly once (`ns_notutor`). `pump` turns it off, because
  a suite driving a night by hand is not being oriented.
- **Something to find.** One object a night, hidden on a camera. The
  spot is not authored — `findSpot` walks candidate points along the
  line that room's camera is looking down and raycasts each onto a
  surface. Three things about that cost time and are worth knowing:
  a ray dropped from the candidate point hits the **ceiling** in every
  room (those points sit near a camera that is near the ceiling), so
  it casts from above and filters the hit list by height instead;
  `Raycaster` **skips invisible objects**, and at boot every room but
  the office is switched off, so the group has to be switched on for
  the cast; and the spot comes back in **room space**, because it is
  parented under a group already parked sixty metres out and adding
  the offset twice put every page in the next room along.
  Also: nothing may hide in the workshop after night one — that camera
  is dead from night two, and a page behind it is unfindable.
- **A story she has to earn.** `NS.finds` is the whole arc and it is
  the one block to edit if he wants different words. It walks from a
  stranger's shop to their own — the places in it come from the
  scrapbook (`SB.map.pins`), so if those change, these should too.

A fifth pass rebuilt the fiction around his own premise — he is her
husband, a toymaker who sold possessed toys, dead eleven days — and
turned the whole thing on one idea worth protecting:

**each of his four is built around one thing about her**, and the thing
it does in the game is that thing. Cogsworth keeps time because she is
never late. Chime ignores doors because she reads on the roof.
Marabelle stops when watched because she will not dance if anybody is
looking. Jax will not leave a door because she stays. So the tags are
the tutorial *and* the love letter, and the four things that have been
frightening her for six nights are a portrait of her.

Three systems carry it:

- **Winding** (`WIND`, `stepWind`). His note is the mechanic. A slack
  one stops obeying its own tag — that is the rule to preserve if you
  touch it, because it is what makes the cards true.
- **The ones he sold** (`SOLD`, `stepSold`). Never seen moving, do not
  knock, immune to watching and to winding, and never unwrapped: they
  are parcels with something showing through a tear. Do not be tempted
  to model what is inside — the moment you show it, it is ordinary.
- **Interception** (`guardFor`, `intercept`). A returner through an
  open door kills her *unless* one of his four is wound. His four are
  her lives; the note is what buys them. Nothing tells her until the
  first time it happens.

Balance notes, all measured with `tools/nightbudget.js` rather than
guessed: the returners at nine seconds a hold cost about a quarter of a
late night's meter and made five and six unwinnable, so they hold for
four and a half; and winding at 1.5% a wind with a seven-hour life came
to a tenth of the meter, so it is 1% and nine hours — about one wind
each across a night. A wound one also gives up on a shut door nearly
twice as fast, so the mechanic pays for itself instead of taxing her on
top of everything else.

One trap: `cast` now holds seven, not four. Anything waiting on
`Object.keys(cast).length === 4` hangs, and three tools did.

Still open with him: whether the difficulty of nights five and six is
where he wants it.

## 8. Testing

Chromium is at `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`; python
playwright is installed. Serve with `python3 -m http.server 8899`. Google
Fonts is blocked by the egress proxy, so navigate with
`wait_until="domcontentloaded"` and abort non-localhost requests, or the page
never fires load.

Always check: no page errors, no horizontal scroll, and **an iPhone
viewport** — he has said repeatedly that iPhone and iPad matter. The book
shows one page at a time in portrait and a spread in landscape.

There are scripts for all of this in `tools/` now, with a README. Run
`tools/regress.js` before any push: it walks every screen on desktop and on
an iPhone and fails loudly. It had itself been broken for a long time —
it drove a text field at the passcode gate, which has been a keypad for
much longer than that — so if it fails on the second screen, suspect the
suite before the site. For the night shift there is `tools/nightplay.js`, which plays the
chapter from the hub card to the way out in 65 checks — every threat's
counter, the whole six-night ramp, the finale, the record, the custom
night, the gallery, cozy mode and the arcade cabinet — and
`tools/nightshot.js`, which photographs any room from any of its cameras
with any of the cast standing in it. `tools/nightui.js` composites every
screen (DOM and canvas together) which is the only way to see a layout
problem in a card. Two harness quirks are worth
knowing there: playwright's `page.click` hangs on this site because the
page never fires `load` (every non-localhost request is aborted), so the
suite clicks through the DOM; and the site's 0.65s screen-entry
animation does not finish inside playwright's actionability check under
swiftshader, so the suite turns it off.

For the apocalypse there is `tools/apocfull.js`,
which plays the whole chapter from the hub card to the roof. Two traps are written up there and both cost an
hour to find: **requestAnimationFrame runs at about 3fps in this container**,
so anything that waits on wall-clock time runs in slow motion and proves
nothing (drive the game with `window.__soPump` instead); and
**`page.screenshot()` hangs** while a canvas loop is painting, so halt the
loop and go through CDP, or pull the canvas out with `toDataURL`.
