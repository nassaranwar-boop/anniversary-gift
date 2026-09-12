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

*(Since written, `hello`, `details`, `level2intro`, `divider` and the maze
itself were taken out of the site on main, so the short-screen rule those
cards needed went with them and `#btn-start` no longer exists. The lesson
above is the part that outlives them, and `landscape.js` now walks the
screens that are left: the gate, the hub, the keepsake and the ending.)*

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

## 7g. The sweep for anything left

He asked, after the landscape work, to make sure nothing was left — no bug,
no lag, nothing wrong with a button or the book. Four things came out of it,
and two things that looked like faults were not.

**The front door did not work on a phone held sideways.** The gate card is a
portrait 400:700 sheet whose width is derived from the height left over
after the title plaque: `min(360px, 86vw, (app-h - 190px) * 400/700)`. On an
844x390 screen that last term wins and comes out at **114px**, which made the
twelve keys **15x15** and the Unlock plate 48x16. There was no way to type
the passcode. The title now sits BESIDE the card instead of above it, which
hands the sheet the whole height (211x370), and the proportions inside it are
rebalanced for a hand rather than a page — the seal and the heading give up
their share so the keypad can take most of the width. Keys are 52x52 and the
plate 131x44. `tools/gatefit.js` drives the whole door with a finger at four
shapes.

**Four controls were under the 44px a thumb needs.** The adventure's back and
quit chips were 50x22 and 33x22; `.btn-ancient` came to 38 tall and
`.btn-replay` to 39. The chips keep the size they look and carry an invisible
44px `::after` target (touch devices only, and they sit at opposite ends of
the bar so the two targets cannot reach each other); the two buttons got a
`min-height` rather than more padding, because the padding is what the design
asked for. `tools/buttons.js` asserts all of it, and measures the HIT area
rather than the painted box.

**Two suites had been dead and nobody noticed.** `apocmech3d.js` and
`tonecheck.js` both did `window.Apocalypse.start()` at domcontentloaded, and
apocalypse.js stopped being a script tag when the chapters moved to a lazy
fetch — so both threw `Cannot read properties of undefined` on their first
line and had been reporting nothing since. They go through the site's own
door now (`await window.loadChapter('apoc')`). Both are green: 14 and 40.

**One photo frame in the book is empty on purpose.** Slot `"025"` on page 7
has no file behind it, so it asks for `photo-025.webp`, then `.jpg`, then
`.png`, gets three 404s and removes itself. That is the code working as
written — the comment in scrapbook.js says the file is his to drop in — but
it is the one gap in sixty-three photographs, and `assets/photo-32/33/34`
exist and are placed nowhere.

**And one that only looked like a wedge.** `mech.js` produced an empty log
through four attempts of well over an hour each and looked stuck. It was
not: Node buffers stdout when it is not a terminal, so `> file` and
`| tail` both show nothing for the whole run and everything at the end —
and killing a run that is "producing nothing" destroys the only evidence
that would have said otherwise. Run bare and left alone it finishes **27
passed, 0 failed, no page errors**: every mechanic, all three difficulty
profiles, nine distinct worlds, the moat, and the whole boss fight down to
the projectile cap and the length of every telegraph. Judge these suites by
their output, not by the wall clock — on a loaded machine they run ten to
twenty times slow and `timeout` does not reliably fire, because the
container's own process clock is skewed.

**The two that were not faults, and how to not re-find them:**

*The 3D intro looked like it ran forever.* Profiling a page turn came back
95% WebGL — `uniformMatrix4fv`, `drawElementsInstanced` — which reads as a
Three.js scene left running behind the whole site. It is not: the intro
**waits for a tap** (`begin()` on the canvas) and renders while it waits, and
any harness that jumps past it with `showScreen` leaves it running behind
every later measurement. Tapped and played through, it disposes itself and
the draw count is **0** at the gate, in the book and at the hub. Drive the
intro, don't skip it, or every number after it is fiction.

*The book looked like it showed two pages on a portrait phone.* It does not.
`showScreen('scrapbook')` only reveals the screen — `startDioramas` is what
calls `Scrapbook.start()`, and `Scrapbook.start()` is the only thing that
ever sets `perView` from the window. A harness that jumps straight to the
screen leaves `perView` at the module's initial **2**, so `buildViews()`
pairs the pages and a 390px phone gets a 289px two-page spread instead of a
335px single page. Through the real door it is one page in portrait and two
in landscape, which is what he asked for. Third instance of the same trap in
one sweep, after the 3D intro and the fixed-millisecond waits: go in the way
she does, and wait for the state you want rather than for a clock.

*The page turn looked like a 500ms stall.* A "long task" counts paint as well
as script. `turncost.js` splits it: over eight turns, 154ms of script, 756ms
of style, 248ms of layout — and the rest of a 4.6s total is SwiftShader
rasterising a curved page on the CPU. Per turn that is ~19ms of JavaScript.
There is nothing to fix; `layoutLeaf` writes and never reads, so there is no
forced synchronous layout in it either.

Also checked and clean: no duplicate ids; every `getElementById` target
exists (the three that do not are created in JS); every interactive id is
wired to something; going back into the book and all four chapters three
times binds no extra listeners — **collect the garbage before you read that
counter**, or a chapter that rebuilds its buttons every visit looks like a
+12 leak when it is detached-but-collectable.

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

- **There are exactly two voices and they are not the same thing.**
  This bullet used to read "there is deliberately no narrator", and for
  four passes that was true. It is not any more — he asked for Anwar
  afterwards — but the distinction it was protecting still holds and is
  the thing to preserve. The building's annunciator is a closed list of
  status lines (`NS.sys`): it reports states and stops, never uses her
  name, never reassures, and never mentions a performer except as a
  sensor reading. Anwar is a man on a tape and everything warm in the
  chapter is his. If a line being added to `NS.sys` sounds like a
  person, it belongs to Anwar or on a piece of paper instead. They
  share one mouth (`speechSynthesis` has no mixer), so `sysWaiting`
  holds the building back rather than letting it cut him off — that
  queue is not decoration, it is the only reason both are audible.
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

Two things that only exist because somebody went looking for what had
never been checked:

- **`tools/nightsound.js` listens.** Every other suite here runs muted.
  That was fine while sound was atmosphere; it stopped being fine when
  telling his four from the parcels by ear became a rule. It renders
  each cue offline and measures where the weight of it sits. Its first
  answer was wrong in the game's favour, which is the worst kind: it
  sampled `SFX.step` alone rather than the cue `cue()` actually plays,
  so Cogsworth was measured as a boot with the tick that identifies him
  left out, and it called the parcel cues as `SFX[name](1, 0)` when
  their first argument is the pan — hard right, at a gain of zero that
  `burst()` then silently replaced with its default. Measuring the cues
  as heard put his boots at 940 Hz and a tried doorknob at 1030: the
  same sound. The parcels are duller now, and the ring in his foot is
  loud enough to be the thing she hears. Every cue here is filtered
  noise, so it renders each three times and reports the spread. If you
  retune any cue, run it.
- **`tools/nighttouch.js` uses a finger.** The winding key is the only
  hold-not-tap control in the chapter, which makes it the one a touch
  pointer is most likely to break.

And the thing that was missing for a whole pass: **orientation did not
teach winding.** She was being walked through doors and cameras and
left to discover the control the entire story turns on in a note she
might skim. Tutorial steps can now run an `enter` hook, which the
winding lesson uses to run one down on purpose — at midnight all four
are still on the wind he left them and there would be no key to find.
Orientation also has to keep `stepWind` running while it holds the rest
of the shift still, or it would be teaching a control it had switched
off.

Two traps, both of the same shape — a number written down once and
then outgrown:

- `cast` now holds seven, not four. Anything waiting on
  `Object.keys(cast).length === 4` hangs, and three tools did.
- The trophy shelf by the desk was built with twelve slots for six
  nights and six badges. Adding two badges made it two short, and the
  two that would never appear are the last two earned — the quietest
  possible failure. It is `NIGHTS.length + NS.badges.length` now, the
  spacing is derived from that, and `nightplay` fails if the shelf ever
  has fewer places than the game has things to put on it.

A sixth pass read the chapter as a story rather than as a program,
which is a different job and needs a different tool: `tools/nightread.js`
plays the whole thing from the film to the last morning and
**transcribes everything she would actually receive, in order, with the
clock beside it**. It asserts nothing. Reading it is the point, and
reading it found what no suite could:

- **The opening film gave away nights three and four**, so two of the
  six revelations arrived as confirmations.
- **Two of the six hidden pages said the same things as two of the
  revelations** — the ledger repeated night three, the last page
  repeated night six — so she read the same beat twice and the second
  time was smaller. They are the two pages about the pair of them now
  (`ledger` is the folding chair; `last` is the fifth one).
- **`NS.beats` — the card before each night — was doing the wrong job.**
  It restated the previous night's hook, so a tease was answered by an
  echo instead of by a night, and two of them spoiled their own night's
  three-o'clock find. All five are now *what has changed since last
  night*, escalating and physical, with no plot in any of them.
- **Two lines of narration contradicted the mechanics they described**
  ("for the first time all week" against six nights of winding;
  "watched it on a monitor five times" against the blind last hour).

And the one rule that came out of it, which is worth more than any of
the individual fixes: **an object the writing names must exist in the
room.** Three did not. Night five's page describes a folding chair
turned to a bench with her chipped mug on the arm of it, and the supply
closet had no chair. Night six's page describes a half-made fifth one
under a dust sheet at the back of the stage, and the stage had three
plinths and nothing else. Night one's tape promised "something on a
shelf with your name on it" and nothing in the shop ever answered it.
All three are real now — the chair, the bench and the mug are modelled
in `buildCloset`, the shrouded figure in `buildStage`, and the tape
points at the brass nameplate that was always on her desk. A page that
describes furniture that is not there is the shop lying to her, and
this shop cannot afford to.

Two placement notes from doing it: the fifth one sits **upstage and off
the plinth line**, because camera 02 exists to show that the middle
plinth is empty when Cogsworth is out and a shape on it destroys the
read; and the folding chair sits clear of mark `s0`, because a
performer standing there had his boots through the seat. If you add a
prop to a room with anchors in it, photograph it with somebody standing
on each of them (`nightshot.js` takes a cast list for exactly this).

The daylight gallery now captions the room it is showing (`GAL_NOTE`),
because the biggest payoff in the chapter was silent: night five's
drawing is four figures round a woman at a desk facing outward, and in
daylight the office *is* that drawing at full size with nobody in the
chair — and she could walk in on it and not notice. The caption names
it once and gets out of the way. If you move a prop, check the caption
for that room still describes what is in it; the first draft of these
claimed a glass case and six chairs that did not exist.

He then asked the fair question — *is it actually all fine?* — and the
answer was no, because of the caption added an hour earlier. It is
worth writing down what that exposed, which is bigger than the caption:

- **`nightlayout` only ever measured the play HUD.** Every overlay
  screen in the chapter — the title, HOW TO PLAY, the badges, the
  drawer, the faders, the voices, the custom night and the gallery —
  had never been measured at any size by anything. A caption that grew
  from one line to three landed on top of its own heading on a phone
  and all six suites stayed green. It walks the overlays now.
- **375x667 was not in the size list**, and it is the width that
  breaks things: the gallery's eight room buttons wrap to a fourth row
  at 375 and nowhere else, which pushed BACK off the bottom of a panel
  that does not scroll. It is in the list now.
- The gallery's title and note were two absolutely-positioned lines at
  fixed offsets (`top:2cqh` and `top:6cqh`), which holds only while the
  note is one short line. They are one flow header now.
- And the check itself was wrong on its first run, in the direction
  that costs the most: it flagged HOW TO PLAY, the badges and the
  custom night, all three of which are long lists inside `.ns-card`,
  which is `overflow-y:auto` **on purpose**. Somebody acting on that
  would have "fixed" three screens that work. The assertion is content
  taller than a panel that *cannot* scroll. This is the third time in
  this chapter's history that a new measurement's first answer was
  wrong rather than the game — check the suite before the site.

And then the report that mattered most: **"the OSTs aren't working at
all and the keyboard isn't working to let me play."** Both were one
bug, and it is the most instructive one in this chapter's history.

`stop()` leaves `G.phase = "idle"`. `finishStart()` opened with
`if (G.phase === "idle") return;`, whose comment said "she may have
gone back to the hub in the frame we waited" — and that is a real
hazard, but only on the FIRST visit, where `start()` parks the phase at
"load" and waits two frames for the loading card to paint. On every
visit after that the shop is already built, `finishStart` runs in the
same turn, and the phase is still "idle" because that is what `stop()`
left behind. So it returned immediately — before `running = true`,
before `musicMode("menu")`, before `screenTitle()` and before the key
bindings were confirmed. **The chapter was dead from the second time
she opened it.** No score, no keyboard, no title screen.

The phase cannot answer "is this start still the one that matters", so
it does not have to any more: `start()` takes a sequence number,
`stop()` bumps it, and the deferred branch checks it is still current.

Why nothing caught it, which is the part worth keeping: **every suite
in this repo entered each chapter exactly once.** 219 play checks, 22
touch, 21 sound, 21 audio, 44 regress, six layout sizes — and not one
of them had ever done the commonest thing a player does, which is look
at a chapter, go back to the hub, and come back to it. `regress.js`
opens the night shift a second time now, on desktop and on an iPhone,
and checks it is alive: title card up, score on `menu`, and a **real**
keypress still shutting a door. That last one matters too — the whole
battery drove the game through `__night.press()` and DOM clicks, and
only ever sent two real key events in the entire suite, neither during
a shift. A control nothing has ever actually pressed is a control
nobody has tested.

Two more reports, and both were right.

**"One of the toys doesn't show up on night two or three. Make every
step of the story certain to happen."** Every step any performer takes
was a dice roll — `if (Math.random() > tune.chance * agg) return;` —
with no floor under it. Dice are the right texture for *when* one of
them comes and the wrong one for *whether*: on an early night, with the
ramp low, a performer could sit in its room from midnight to six and
never be met. That empties night two, whose entire subject is what the
four of them are, and it is the difference between a character and a
rumour.

So chance now decides the first stretch and then the shop stops asking.
Once a performer is two in-game hours past waking with no arrival, it
advances every tick until it has reached her. It reads as the night
tightening, it arrives inside the window it always could have, and it
can no longer fail to. Custom Night is exempt — the dials are hers, and
a dial at nothing has to mean nothing.

The same fault in a different shape: **camera zero** waited for her to
raise her own desk camera, which she may simply never do, and from
night three that scene carries a revelation. It still waits for her —
that is the point of it — but from four o'clock the annunciator calls
motion on camera zero every half minute until she looks. The shop does
that for every other room all night, so it costs the fiction nothing.

**"The music and the sound effects are so low, and when his voice
happens we can only hear him."** Exactly right, and not a ducking
problem — nothing was ducking. `speechSynthesis` **does not go through
this graph at all**. It is the browser's own voice at the browser's own
level. Everything else was mixed under a master of 0.9 and metered a
peak of 0.25, using a quarter of the available headroom, so he was at
full scale and the shop was a whisper. No amount of timing one against
the other would have helped: they are two output paths that never meet.

The fix is to stop giving away three quarters of the shop's headroom.
The bus runs hot now (`MASTER_BASE`) into a `DynamicsCompressor` acting
as a limiter, so the average level comes up about four times without a
scare ever clipping — measured, a shift went from 0.116 rms to 0.481,
with peaks held at 0.77. And his voice comes down to 0.78 (the
building's to 0.62), because it was the one thing in this chapter that
had never been in the mix at all. If you retune any of this, tap the
meter **after** the limiter — it reads the level going in otherwise.

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
suite before the site. For the night shift there is `tools/nightplay.js`,
which plays the chapter from the hub card to the way out in 220 checks,
`tools/nightbeats.js`, which checks every beat the story promises
actually reaches her, and `tools/nightshot.js`, which photographs any
room from any of its cameras with any of the cast standing in it.
`tools/nightui.js` composites every screen (DOM and canvas together),
which is the only way to see a layout problem in a card. Two harness
quirks are worth knowing there: playwright's `page.click` hangs on this
site because the page never fires `load` (every non-localhost request is
aborted), so the suite clicks through the DOM; and the site's 0.65s
screen-entry animation does not finish inside playwright's actionability
check under swiftshader, so the suite turns it off.

For the apocalypse there is
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

## The pass that made it a story rather than a shift

Four things, and the first two were bugs that had been there the whole
time.

**The winding key was sitting on top of the controls.** It is
`<button class="ns-key" id="ns-key">`, and the six buttons along the
bottom of the panel have been `class="ns-key"` since long before it
existed — so every one of them picked up the hotspot's
`position:absolute` and `transform:translate(-50%,-50%)`, left the flex
row, and stacked on one point in the bottom left corner with half of
each off the side of the screen. It is `.ns-wind` now. `nightlayout`
fails on overlapping controls, which is the only thing that would have
caught it: every button was its full size and inside the frame, they
were simply all in the same place.

**Every cue was scheduled at `currentTime`.** All of them are
envelopes — nothing to peak in four milliseconds and back down — and
all of them were scheduled at the start of the block the audio thread
was already working on, so the attack was behind it before it began.
Live, a door shutting came out thirty times quieter than the same cue
rendered offline. An `OfflineAudioContext` starts at zero with the
whole render ahead of it, so nothing scheduled "now" is ever late in
one: every measurement of these cues ever taken here was of a sound
nobody had heard. There is a 25ms lead on everything now. (Honest
caveat, in the comment above `CUE_LEAD` too: the sweep that found it
ran against a null audio device whose thread runs ahead in batches, so
how much of the thirty-fold gap was the bug and how much was the
container is not something this repository can answer. Scheduling an
envelope at `currentTime` is a real mistake regardless.)

**The score has a room for every scene.** It had three settings and
everything else borrowed one: the film where a dead man introduces
himself had the same music as the title screen. There are nine now —
`film`, `brief`, `night`, `dark`, `gone`, `found`, `held`, `dawn`,
`gallery`, `menu` — and they are the same seven layers, the same music
box, the same key, and the same grid. Nothing restarts, the tempo eases
rather than snapping, and `nightaudio` meters straight through five
scene changes to prove it never cuts.

**And he talks to her while she works.** `NS.tapes` and section 18g.
Everything the chapter had to say used to be said before a night or
after it, which left the five and a half minutes she actually plays
with nothing in it but the job. Somebody who plays games will sit
through that. Somebody who does not will put the phone down at four in
the morning of night two. So: one line an hour in his own voice, plus
six that wait for something she does. It never speaks over a scare,
never over the annunciator, never twice, and never with something at a
door.

A note on the suite, because six checks were wrong in the same way and
it is worth naming the shape. Several of them measured one rule through
another rule's noise: the ballerina's freezing tested on the night the
cameras drop out, the dropped-monitor control case tested on the night
the monitor drops on its own, a parcel at a door tested with Jax awake
at the other one. In each case the hazard doing its job read as the
rule failing. And three more were counting on a dice roll — they retry
now, because a window a thing sits out proves nothing while a window it
moves in settles the question.

## Two things a real finger found that nothing here had

**Every hotspot on the monitor was unreachable.** The winding key, a
found page and the arcade cabinet all live inside `.ns-mon`, which is
`pointer-events:none` so the tube does not eat the office behind it. A
child of that has to switch pointer events back on for itself, and none
of them did. They were painted, correctly positioned, wired to working
handlers, and a finger went straight through all three into the canvas.

The winding key had been getting `pointer-events:auto` by accident, from
the pad's `.ns-key` rule — so renaming it to `.ns-wind` to fix the
layout collision is what finally exposed it. The other two had never
worked.

Nothing in the suite could have caught it, and the reason is worth
keeping: **the suites dispatch events onto the element**, and
dispatching skips hit testing entirely. It proves a handler runs, not
that anything can reach it. `nighttouch` now asks the document what is
actually under the middle of each hotspot, and drives the ring with a
real press.

**And the chapter was never in the no-select list.** Every other
playfield on the site has `touch-action:none; user-select:none`; the
night shift had neither, so a thumb held on the winding key, or dragged
across the office to look around, turned the page blue instead. It is
in the list now.

## He says the actual words now

The formant synth is a good impression of a man and a bad impression of
English — you can hear that somebody is talking and you cannot hear
what, which left the subtitles doing all the work and the sound under
them doing none. So `speechSynthesis` says it, off the same string the
caption is built from: an English voice, pitch 0.65, rate 0.92 for him;
flat, fast and pitch 0.1 for the building. A hum, a hiss and two clicks
run in Web Audio for exactly as long as he talks, because the speech
cannot be routed through the graph and the machine has to be played
around it instead.

The caption lights on the synthesiser's own word boundaries now, which
is the truth rather than an estimate; `voxPlan`'s timings stay as the
fallback, and so does the whole formant synth for a platform with no
voices. This container has none, so the fallback is what the rest of
the suite walks — the speech path is tested against a stub that reports
a voice and fires boundaries, which is how we know the string handed to
the browser is exactly the string on screen.

## The pass where the score turned out not to exist

Four things reported from a real phone, all four real.

**The night had no floor, and the night is the game.** Every melodic
layer was gated behind `dread` — the box at 0.20, the pulse at 0.10 —
and dread sits at about 0.06 whenever nothing is walking towards her,
which is most of most nights and nearly all of the first two. Measured
with the shop quiet: `sub 0.37` and every other layer at zero. A
forty-one hertz drone and no music whatsoever, for five and a half
minutes at a time. She was not hearing a score that failed to arrive,
she was hearing the absence of one.

There is a piece of music playing in the shift now, always, and dread
is what the piece *does* rather than whether it exists: the music box
and a clock from midnight, a piano while she is still alone with it
that steps back as she stops being, and the six frightening layers
arriving on top of something rather than instead of it.

**There is only one mouth and they were both using it.**
`speechSynthesis` has a single queue and `cancel()` empties it. The
building announces a door every time she touches one, and every one of
those cancelled him mid-word — so the only voice she ever heard through
to the end was the one saying DOOR ONE: CLOSED. He has right of way
now, in the speech queue and in `tapeQuiet()`; the building waits, and
gives up if it has been waiting more than two seconds, because a door
announcement three seconds late is worse than none.

**And a backstop on `onend`.** Some engines never fire it on a short
line, and without one `SPEECH.live` stays true for the rest of the
visit — every scene that waits for him to finish then waits for ever.

**Dead air.** The film and the terms waited up to a second and a bit
on top of a voice that had already stopped. A quarter of a second is a
breath; more than that is where somebody decides the game is slow. And
the tapes were one line an hour behind a rule that would not let him
speak while the building was talking — fifty seconds between sentences,
which is not a conversation. Eighty-two lines now, about one every
twenty seconds, on fractional hours.

**His voice is a setting.** The scorer picks the best voice it can
identify and on most phones that is right, but "best" is a guess made
by a regular expression about names it has never heard. HIS VOICE on
the title screen reads a line in each one. The only test that was ever
going to matter is her ear.

## The opening was cutting itself off, and it was the backstop

`speechSay` gives every utterance a `finish()` that clears `SPEECH.live`
— a flag the whole chapter reads to know whether he is still talking —
and a backstop timer that calls it if the engine never fires `onend`.
The flag is global and the timer fires on a delay, so **the timer
belonging to a line that ended a second ago was clearing the flag for
the line currently being spoken.** The film then decided that line was
over, started the next one, and `cancel()` chopped the previous one
wherever it happened to be.

Two of the first seven sentences of the opening, cut off about a third
of the way through. Every utterance carries a number now and only the
current one may say it has ended.

Nothing here could have caught it, because the stub the suite used
answers instantly and a real engine never does. `nightplay` now runs the
opening against an engine that takes time to talk and whose `cancel()`
chops mid-sentence, and fails if any line does not reach its end.

The backstop is measured off word count rather than off `voxPlan` —
`voxPlan` times the fallback synth, and a real narrator is slower, so
the old estimate was firing early on exactly the long sentences that
mattered most.

## Five faders, because every level here has been a guess

Every mix decision in this chapter was made through a container with a
null audio device, about a phone in a room nobody working on it can
hear. Several of those guesses shipped wrong, and two of the fixes made
it worse. SOUND — on the title screen and in the pause menu, so it is
reachable at the moment something is too loud rather than four menus
later — has a fader for the score, the shop, his voice, the room tone
and everything, plus the voice picker and a line to test it on. They
persist, and DONE goes back to wherever she opened it from.

## "I tried the four nights and I didn't feel anything"

The most useful note in this whole build, and three things were true.

**Every night was the same night with one more thing switched off.**
`HAZARDS` is a list of subtractions — a dead camera, a dark hall, a
sticky door — so nights three and four were night two with more of them.
That is a difficulty curve, not six experiences. Each night has a title,
a grade and a revelation of its own now.

**Nothing ever happened in the room she was sitting in.** All the threat
was elsewhere, abstracted into a route index, and arrived as a number
going down. The office was inert for thirty-three minutes and nothing
was ever in it with her until the instant it killed her. Camera zero
fixes that and it is the single biggest change in this pass: the ceiling
behind her chair, looking the way she is looking. From night three
something stands in it — never touching her, never costing her
anything, not on anybody's route, one mark closer every time she looks
away. `stepCast` had to learn to leave a `deskHeld` character alone, and
the advance had to be latched on the look-away transition rather than
run per frame (the first version walked all three marks in a fifth of a
second, which nobody would ever see).

**Nothing he had to say landed inside a night.** A film before, a card
after, a page she might not find. `NS.reveal` is one thing a night, at
three in the morning, in his voice, and it waits if anything is at a
door.

## The story pass: she was passive, and that was the flaw

Things were revealed TO her. She read pages, listened to tapes,
survived, and answered one binary question at the very end. A coin with
no history behind it is a menu, not an ending.

`NS.reveal` is six decisions now — keep it or burn it — and `NS.kept`
resolves them on the last morning. Nothing ever tells her they count.
They also nudge the shift itself: `keepDrag()` slows the four running
down (more of him in the shop to run on), `burnDrag()` slows the ones
he sold coming back (less of him here for them to return to). Neither
is worth optimising and neither is mentioned, which is the difference
between a decision that felt like it mattered and one that scored.

The knife is night four. He did not learn to build a thing that watches
a person by practising on strangers — there is a notebook with fifteen
years of dated observations of his own wife in it, and every trait in
it is a mechanic in one of the four toys hunting her. Night five is the
answer: a drawing dated the week he was told, four figures round a
woman at a desk, all of them facing outward.

`endingKind()` has five outcomes. The one that means the most is not
"kept everything" — it is `four`: she burns the ledger and the
notebook and keeps the things he made.

## The pass that hunted bugs rather than adding features

Three real ones, and two of them were reachability again.

**PAUSE was under the right-hand door key.** Measured with
`elementFromPoint`: on a desktop the element under the middle of the
pause button was `ns-key-r`, so pressing where it appears shut the door
instead of pausing. In portrait it moved to the top right and landed on
top of the clock. It has its own corner at z-index 12 now and the clock
steps aside for it. This is the third control found unreachable by
asking the document what is actually under it — that check is worth
running on anything new.

**The daylight walk froze the cast for the rest of the visit.** The
gallery pins all four with `deskHeld` so they stand where the night-five
drawing puts them, `stepCast` leaves a pinned figure alone, and
`resetCast` did not clear it. Any night begun after a look round the
shop in daylight had a cast that never moved again. Cleared in
`resetCast` now, and checked.

**The blind hour only existed on real frames.** It was a line in the
frame loop, so `pump()` never ran it — and a pumped night is supposed
to cost exactly what a played one costs, which is the only reason the
budget numbers mean anything. It is `stepBlind` and it is in both
lists.

And one measurement lesson repeated: the night's mix could only be read
with the sound on, and every suite here runs muted. `nightMix(feel, d)`
is a plain function of the feeling and the dread with no audio in it,
so what the shift is written as can be checked without hearing it.

## Reading the six hours as a story

`tools/nightread.js` transcribes the whole chapter in the order she
receives it. It asserts nothing; it exists to be read. Doing that once
found five things no assertion would have:

- **The opening film gave away nights three and four.** Before she had
  played a second it said the toys went into houses and did what he
  asked, that he was paid a great deal for it, and that she had been
  living on the money. So night three's ledger and night four's
  notebook were confirming something the trailer had spoiled. The film
  now says the shop is hers, that he lied for fifteen years, that the
  ones he sold did not stay sold — and stops.
- **Two of the six hidden pages repeated two of the revelations.** The
  night-five find was the ledger (night three's revelation) and the
  night-six find was the confession (night six's revelation), so she
  read the same beat twice and the second time was smaller. They are
  the two things in the shop that are about the pair of them instead:
  a second chair at his bench with a mug of hers on the arm, and a
  fifth toy under a dust sheet with no mechanism in it.
- **The six `why` lines described the wrong nights.** Night four's said
  "he is about to tell you what they were for", which is night five.
- **Two lines of narration contradicted the mechanics.** The ending had
  her winding them "for the first time all week" after six nights of
  being taught to wind them nightly, and the finale had her watching
  the morning on a monitor five times when the cameras die at five on
  the last night.

The four tags stayed exactly as they were. The chalk on night two names
the four traits; the tags say why he chose them. That is a payoff, not
a repeat.
