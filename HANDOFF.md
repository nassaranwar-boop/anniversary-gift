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

Five levels, a stealth story, all of it in `apocalypse.js`.

**It is a real 3D game now.** It was a 320x180 canvas with tiles painted on
it; it is a third-person 3D game running on `vendor/three.bundle.js` —
three.js r180 with the postprocessing addons, the same bundle `index.html`
already loads for the book intro, so it costs the page nothing new.
`apocalypse.js` will fetch it itself if that tag ever moves. Same story, same maps,
same words, and still no files of its own: every surface is a texture
painted into an offscreen canvas at load, every sound is an oscillator, and
the sky is a fragment shader.

Everything worth editing is in the first six hundred lines: `MAPS` for the
maps as grids of characters, `LEVELS` and `SUB` for what each place is and
what has to happen in it, `PAL` for the five palettes the world builder,
the lighting and the post chain all read from, `TALK` for every word in the
game, and `TUNE` for how she feels to play. The reunion in Level 3 is
`TALK.wake` and `TALK.hide`, written underplayed at his direction — *"like a
real conversation between two people in shock and relief, not a dramatic
speech"* — and the lines written as `[null, null]` are beats of silence,
held on screen like any other line. Keep them.

Still open with him: whether the look is what he wanted, and the wire
panel (he wrote the art direction for it himself and has not seen it
running).

**The polish pass.** He asked for "a polished modern release, not a rough
prototype", and named the two halves: smoothness and a full visual upgrade.
What that turned into:

- **No grain, no dither, anywhere.** The composer renders into a
  multisampled half-float target — the renderer's own `antialias` flag does
  nothing once you draw through a composer — with SMAA on top at full
  quality. Half-float is what removed the banding the grain had been
  covering.
- **Nothing snaps.** Every follower runs through `damp`/`dampAngle` (an
  exponential ease expressed as a time, so it is identical at 30 fps and at
  144) and the camera is on six critically damped `Spring1`s. The torch
  lags her turn by about a tenth of a second and its cone has an
  exponential falloff along the beam and a smooth radial one across it.
- **An environment.** Each level renders its own sky into a cube at load
  and PMREMs it. Without that, a PBR material is a flat colour with a
  highlight on it — this is the single biggest thing in the pass.
- **Roughness maps.** The road is wet: its roughness comes from its own
  painted map, so the puddles are mirror-smooth and take the streetlights
  while the aggregate stays matt.
- **Textures painted with noise, not randomness.** `valueNoise`/`fbm` at
  the scale of a stain looks like a stain; per-pixel randomness looks like
  a fault. Every surface was repainted on that basis.
- **Facades, not walls.** Plinth, string courses, reveals, sills, lintels,
  mullioned frames, shopfronts, cornices, boarded and burnt-out windows,
  and roofs with stair heads, tanks and aerials on them — all instanced.
- **Everybody is a skinned mesh.** `buildHuman` makes a twenty-two bone
  skeleton, one continuous body surface, and garments as separate skinned
  shells, all out of `skinnedTube` — a stack of rings each carrying up to
  three bone weights. Attachments (vests, guns, bags, hair, shoes) are
  plain meshes parented to a bone. Watch the axes: the figure faces +x, so
  front-to-back is x and shoulder-to-shoulder is z.

  Three traps in that, all of which cost an hour:
  - **A `Skeleton` computes its inverse bind matrices in its constructor,
    from the bones' world matrices at that instant.** Build it before the
    bones are in a scene graph and before anything has called
    `updateMatrixWorld`, and every one of them is identity — so each vertex
    gets a bone's whole world transform instead of the difference from
    rest, and the model explodes. Attach, `updateMatrixWorld(true)`, *then*
    `new THREE.Skeleton(...)`, then `mesh.bind(skeleton, mesh.matrixWorld)`.
  - **A ring stack authored top-down is the mirror of one authored
    bottom-up**, so half the tubes came out inside out and were culled to
    nothing. `skinnedTube` now checks the stack direction against its own
    frame and flips the winding when they disagree.
  - **A garment is a bag.** Left open at the collar or the hips it is a
    hole you can see the body through, and the body underneath has to be
    narrower than the cloth over it at every height or it comes through at
    the hip.
- **`__apPortrait(who, seed)`** puts one figure on a lit turntable. There
  is no way to judge a character model from a torch-lit shot of the back of
  its head at twenty metres. **`__apRenderStats()`** returns the draw calls
  and triangles for the current frame.

Things this build learned the hard way, all worth not repeating:

- **A second function declaration with the same name at the same scope
  wins.** The ending's cat routine was called `drawCat`, and the choice
  adventure already had one — so every call silently drew the wrong thing
  and the roof rendered a heart floating over nothing. It is `drawEndCat`.
  This is the third time this file has been bitten by exactly this.
- **A fixed number of clicks through a dialogue is a bug waiting to
  happen.** Drain the box until it is closed instead; one extra line in one
  beat put every later step out of phase and the suite reported a level
  that had never started.
- **A suspended AudioContext never fires the `stop()` you schedule**, so
  every node you build into one stays alive. Twenty minutes of footsteps
  was tens of thousands of oscillators and a page that stopped responding.
  Nothing is built now unless `ctx.state === "running"`.
- **`openOverlay` claims the game's state for itself.** The close call set
  its own state first and then put the beat up, so the hold ran forever and
  the game never came back. Put the overlay up, then claim the state.
- **A canvas hands out one WebGL context for its lifetime.** Disposing the
  renderer on the way out and building another on the way back in gets a
  dead one, so leaving the chapter keeps the renderer and only drops what
  the scene was holding.
- **The floor's top face is y = 0, not y = -0.15.** The tiles are 0.30
  boxes sitting at -0.15. Every decal meant to lie on the floor — the
  vision cones, the noise rings, the note, the rugs — was placed at a
  negative y and was therefore inside the floor and invisible.
- **Sorting interactions on distance alone lets a tie decide.** Standing
  between the car she has to start and a dropped bottle, she reached for
  the bottle. Story tiles are ranked ahead of scenery now.
- **A vertex shader written as a threshold tears the mesh.** Moving every
  vertex that passes a test — "if it is in front of the ear, pull it back"
  — puts a visible step exactly where the test flips. Her hair had a square
  notch cut out of the crown because of it. Ease the displacement instead.
- **A sphere segment covers all the way round at a given angle**, so a hair
  cap low enough to reach the nape also comes down over the face. Lift the
  front of it to a hairline with a smooth function of how far forward each
  vertex is.
- **One boolean cannot both end an animation and gate the press that
  follows it.** The serum screen used `done` for both, so the button that
  said "THAT'S IT" did nothing and she stood at Ashcombe with her sleeve up
  forever. Three states, not two.

## 7c. The height of the page — do not undo this

This one came back four times and cost him days, so the whole of it is
written down, including the wrong turn.

**The clue that settled it:** Safari is perfect. Chrome for iOS shows the
fault. Brave is cut off at the bottom. All three are WebKit, so the fault
is not in the rendering — it is in the box each app hands the page.

Chrome for iOS puts its web view over the whole screen and lays its own
toolbar on top, then pushes the page down with a content inset. So the
initial containing block — what `height:100%`, `100vh` and even `100dvh`
all resolve against — is the height of the entire screen, toolbar
included, while only the part below the toolbar can be seen. On his iPad
Pro 12.9 in landscape that is **1024 against 892**: the document ends up
exactly **132 CSS pixels taller than the window**, and those 132 pixels
can be dragged into view. That is the band of void, and the "it sits
differently after I come back" is the page resting at either end of that
132-pixel drag.

The numbers are measured, not assumed. In his screen recording the page
pans by **132.8 CSS px** and Chrome's toolbar measures **132.3 CSS px** —
the page could be dragged by precisely the height of the browser's own
toolbar. Nothing scales: the wax seal on the passcode card is 44x49 px in
every frame, and the title glyphs measure 457 CSS px inside a 470 px
image throughout. It was never a zoom. It is a translation.

**The wrong turn, so nobody repeats it:** the pass before this one
measured the height correctly and pinned `body` with `position:fixed` —
and changed nothing, because **html is the scroller**. `html` kept
`height:100%`, kept the too-tall box, and kept all 132 pixels of
draggable overflow. Sizing the body is not sizing the page.

**Read off his iPad, in the fault state, and this is the whole thing.**
There is a state on Chrome for iOS where *every CSS viewport unit reports
the full screen* — `vh`, `svh`, `lvh` and `dvh` all say 1024 in a window
that is really 892 — and so does `documentElement.clientHeight`, and so
does a `position:fixed; top:0; bottom:0` box, and so does
`html{height:100%}`. Only `window.innerHeight` and `visualViewport.height`
tell the truth. 1024 − 892 = 132, which is the 133px drag measured frame
by frame in his recording. Same number from both directions.

Two consequences, and both are load-bearing:

  1. **There is no CSS fallback.** Not `dvh`, not `svh`. Any rule that
     lays the site out against a CSS unit is 132px wrong in that state.
     The height must come from JS.
  2. **JS at the bottom of the body is too late.** The page paints once
     against the CSS value — everything half a toolbar too low — and then
     snaps when the measurement lands. That snap is the "it appears, then
     it shifts" in every one of his recordings. So there is a small
     inline script in the `<head>` of index.html that writes `--app-h`
     and `--app-top` before anything is drawn. **Do not move it, do not
     defer it, do not fold it into script.js.** It is verified by
     blocking script.js outright and checking the first frame is still
     892.

**Two independent signals, because one is not enough.** He tested the
visualViewport-only fix on a real preview build and it changed nothing,
which is the evidence that Chrome for iOS misreports *that* API too. So
there are now two:

  1. `claimedHeight()` takes the **minimum** of every height on offer —
     `visualViewport.height * scale`, `documentElement.clientHeight` and
     `innerHeight` — rather than picking a favourite. They agree on a
     browser being straight with the page; when they disagree the smaller
     one cannot be hiding anything, because no browser under-reports the
     space it gives you. One honest API is enough, whichever it is.
  2. When they **all** lie — which is the case that beat three passes —
     only the real scroll range is left, and that is what the probe below
     measures.

**The part that finally stopped the guessing.** Three passes were spent
asking *which height API tells the truth*. That is the wrong question:
the answer differs per browser and the page cannot tell from in here
which one is lying. So `script.js` does not ask any more — it **measures
the hidden strip directly**. It tries to scroll the document as far as it
will go, inside one synchronous block so no frame is ever painted
scrolled. On a browser that handed us the visible box there is nowhere to
go and the answer is zero; on one that hid a strip behind its own
toolbar, the distance it moves *is* that strip, in pixels, whatever the
browser claims. Subtract it, put the scroll back.

The probe **checks itself**, which is what makes it safe to act on. A
strip that is browser furniture disappears once the document is shortened
by it — the scroll range is `content + inset − window`, so taking the
inset off the content takes the range to zero. A strip that is really
just an over-tall element on the page does *not* disappear. So it applies
the candidate, looks again next frame, and keeps it only if it is gone. A
bad reading during load can shrink the site for one frame and never two.

Verified both ways in `tools/`: with the browser stubbed to claim 1024 in
a real 892 window it learns 132 on its own and lands on 892 with nothing
draggable; with a genuine 2400px element on the page it refuses the bait
and leaves the height alone.

The rest of the contract, in `script.js` and the top of `style.css`:

- `100vh` / `100dvh` in the stylesheet are the **pre-JS fallback only**.
- JS owns two custom properties, both from `visualViewport`, the only API
  that reports the region actually on screen rather than the box the app
  handed the page:
  - `--app-h` = `visualViewport.height * visualViewport.scale` — the
    visible height, multiplied back out so a pinch does not rewrite the
    layout.
  - `--app-top` = `visualViewport.offsetTop`, and only while the page is
    not zoomed; once she has pinched in, following the visual viewport
    would glue the site to her fingers.
- **`html` is pinned to `var(--app-h)`.** This is the line that actually
  fixes it. With the root element the height of the visible area there is
  no overflow left to drag into.
- `body` and `.screen` are placed at `top:var(--app-top)` with
  `height:var(--app-h)`. `.screen` deliberately does **not** use
  `inset:0` — that resolves against the containing block, which is the
  thing established above as untrustworthy.
- Re-measured on resume (`pageshow`, `visibilitychange`, window `focus`,
  `orientationchange`) in a short burst, because iOS reports the previous
  size for a few frames after a resume; and on `visualViewport` `scroll`,
  because that offset is what moves.
- Compared against the value **the document is carrying**, not a cached
  one, so a height that drifted for any reason heals on the next event.
- The 3D scenes size themselves from **their own canvas box**, never
  `window.innerWidth/innerHeight`. `book-scene.js` has `viewW()`/`viewH()`
  and a ResizeObserver on the canvas; `renderer.setSize(w, h, false)` so
  the stylesheet keeps the CSS box.

**`viewport-report.html`** ships at the site root for exactly this. Open
it on the device in each browser: it prints, live, what every height API
claims, what `visualViewport` says, and the one number that matters —
*document can scroll by*. On a healthy browser it reads 0 and the green
frame hugs the screen. Do not debug this class of bug by reasoning about
iOS again; open the report on the device and read it.

`tools/vh.js` is the automated check. Note that the two hub overflow
failures on the phone viewports are older than all of this and are hub
layout, not height. Chromium cannot reproduce a content inset, so the
regression for it is: force `--app-h` to the full box and assert that
`scrollHeight - clientHeight` goes to 132 and back to 0 once the
measurement runs.

## 7d. Nothing may change the size of a screen

Separate from 7c and worth its own heading, because it wore the same
clothes and that is why 7c kept looking unfixed.

Two rules in the stylesheet scaled a whole screen. `screenIn` arrived
from `scale(.97)` and `screenExit` left at `scale(1.06)`. As a transition
that is polish. As the first thing you watch when the site opens, it is a
screen appearing at the wrong size and then correcting itself — which is
visually identical to the viewport bug, and is why he kept reporting "it
appears then zooms in a bit" after each viewport fix landed. Measured:
the gate's box swept **865 → 892px** during entry on his iPad.

Both now fade and rise without ever changing size. `tools/nozoom.js`
holds the line: it drives each animation through the Web Animations API,
stepping `currentTime` across the whole timeline, and fails if any point
is scaled or if the screen's height moves. **Do not sample animations
with requestAnimationFrame in this container** — rAF runs at about 3fps
here, so a .65s animation is finished before the second frame and every
sample comes back at rest; the first draft of that test passed against
the broken code for exactly that reason. It is verified both ways: put
the `scale()`s back and it reports `worst scale 0.9700` and a sweeping
height.

If he ever says "zoom" again, run `tools/nozoom.js` before touching
anything in 7c.

## 7e. A phone on its side

Two faults, and the second one is a lesson about 7c.

**The stages were sized by an OR.** `@media (max-width: 900px),
(orientation: portrait)` — the comma is an OR, so a phone turned sideways
is still under 900px wide and got the whole upright-phone layout,
including a stage cut to **52%** of a height that is already short. The
apocalypse came out 361x203 in an 844x390 window: 22% of the screen, the
rest empty. Turning the phone gave the game more room and it used less.
That block was doing two jobs at once — device rules (a touch screen
wants the stick over the picture) and shape rules (upright, the picture
takes the top half and leaves thumb room). They are separated now:
device rules keep the OR, shape rules are `(orientation: portrait)` and
`(orientation: landscape) and (max-height: 560px)`. Sideways the stage
takes 82%.

**And three buttons sat below the fold — because of 7c.** The cards are
510 to 553px tall and were centred in a 390px screen, so they hung off
both ends. That was always true. What changed is that pinning `html` and
fixing `body` to kill the iPad's draggable void removed the last way to
reach anything past the fold. `#btn-start` opens the maze, so that
chapter was *shut* on a landscape phone. The fix is not to undo 7c — it
is that content must fit: trimmed on short screens, and the card itself
carries a scrollbar for the rest, aligned to the top so the scroll only
goes one way.

**The general lesson:** an unscrollable page turns every pre-existing
overflow into unreachable content. Any screen that can overflow needs its
own scroller. `tools/landscape.js` asserts it, and is verified both ways —
restore the old CSS and it reports 5 failures.

### Then he sent five photographs of a real iPhone on its side

Everything below came from those, and each one is a different fault:

**Pale bands down both edges.** Without `viewport-fit=cover` iOS insets the
layout viewport away from the notch in landscape and paints the leftover
strips in the page background, so the scrapbook's paper showed beside every
dark screen. Cover is the only way to reach those corners. The old note in
`index.html` said cover must never come back, and it was right *then* —
back when the height was measured from the layout viewport, cover made
everything come out taller than the part you could see. The height now
comes from `visualViewport` and takes the smallest of three claims (7c), so
cover has nothing left to mislead. Content is kept off the camera by
padding `.screen` with the safe-area insets — background to the edge,
nothing to read or press underneath the notch.

**The book showed one page.** `pagesPerView()` asked
`(min-width: 760px) and (orientation: landscape)`. Sideways, with the
viewport inset away from the notch, an 812pt phone reported about 712 — so
it fell through to a single page with half the screen empty. It asks the
shape now: `w >= 600 && w / h >= 1.2`. Two 3:4 pages side by side are 1.5x
as wide as a page is tall, so any window meaningfully wider than it is tall
can hold them. Keeps the iPad's 1.44 and every phone's 1.8-plus, and still
gives one page to portrait and to a near-square window. Rotation on iOS
does not reliably fire a `resize` the layout has settled into, so
`orientationchange` asks again 180ms later.

**The apocalypse controls covered the picture.** They were sized in `vw`,
and sideways `vw` is the long edge — the stick and the two action buttons
came out 116/104/80px on a 390px-tall screen. They are sized from
`var(--app-h)` inside the landscape block now: 78/68/53. Note that `cqw`
does *not* work here: `.ap-touch` is a **sibling** of `.ap-stage`, not a
descendant, so there is no container for the units to resolve against.

**Jumping cancelled the run.** See 7f.

**The games did not fill the screen.** Three separate causes:

- *Super Ouissy* kept its pad in the column flow, so the pad ate a third
  of the height while the stage's width was still being computed as if it
  had all of it — 693x282 in an 844x390 screen. Sideways the pad floats
  over the bottom corners instead (small, set into the two corners where
  her thumbs are, so the middle of the picture stays clear) and the stage
  gets the whole height.
- *Super Ouissy* was then still letterboxed, because a sideways phone is
  wider than 16:9. `pickView()` now widens the view itself on a landscape
  screen — up to 448 world pixels — so the extra space is spent on more
  world at exactly the same size. Nothing shrinks; she just sees further
  ahead. The one thing this needed elsewhere: `buildBackdrop` paints the
  sky at `VIEW_MAX_W`, not 320, because the sky is drawn once at x:0
  rather than tiled and a 320-wide sky would have ended before the screen
  did. `far` and `mid` are 480 and tiled, so they were already fine.
  It reaches 100% of the screen now.
- *The race* is a fixed-16:9 renderer and stays letterboxed at 82%, but
  `#screen-race` had no background of its own, so the bars beside it were
  the scrapbook's pink paper. It is `#120c1c` now — the bars read as the
  cabinet around the screen.

`tools/landscape.js` covers all three games; the ouissy floor is 92%,
which fails the moment the pad goes back into the flow or the view stops
widening.

## 7f. Jumping stopped her running

Hold RIGHT with one thumb, tap JUMP with the other, lift the jump thumb —
and she stopped dead in mid-air while the first thumb was still pressing.

The pad had a window-level safety net, `window.addEventListener("pointerup",
releaseAll)`, written against the four ways a touch button gets stuck down.
It does prevent all four. But `releaseAll` clears **every** key, and a
window-level pointerup fires for the *second* thumb too. So the jump's
release let go of the direction as well.

The net is still needed; it just has to know which press ended. Each
pointerdown records `heldBy[e.pointerId] = key`, and a pointerup releases
only that key; a pointer we never saw go down releases nothing, which is
the whole point, because another thumb may still be down. `releaseAll`
stays for when every finger really is gone — blur, tab change, pause,
leaving the screen — and clears the map with it.

`tools/padcheck.js` plays the gesture with two pointer ids and checks the
direction survives the jump. It is the only test here that uses more than
one finger, which is why nothing caught this for so long. Verified both
ways: restore the old listener and it reports "jump cancelled the
direction" in both orientations.

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
suite before the site. For the apocalypse there is
`tools/apocflow3d.js`, which plays the whole chapter from the hub card to
the roof, and `tools/apocmech3d.js`, which holds the stealth assertions.
Both need a real GL context, so launch Chromium with `--use-gl=swiftshader
--enable-unsafe-swiftshader` and **not** `--disable-gpu`. SwiftShader is
software rendering: a full-resolution frame takes the best part of a second,
so drive the game with `__apLoop(false)` and `__apPump` and drop the render
scale with `__apQuality(2)` rather than waiting on the real loop. Two traps are written up there and both cost an
hour to find: **requestAnimationFrame runs at about 3fps in this container**,
so anything that waits on wall-clock time runs in slow motion and proves
nothing (drive the game with `window.__soPump` instead); and
**`page.screenshot()` hangs** while a canvas loop is painting, so halt the
loop and go through CDP, or pull the canvas out with `toDataURL`.
