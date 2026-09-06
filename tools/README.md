# tools — checking the site without opening a browser yourself

None of this ships. It is here so the next person to touch the site can see
what they changed instead of hoping. Every bug in `super-ouissy.js` was found
by running these, not by reading the code.

## Running them

```
python3 -m http.server 8899          # from the repo root
cd tools && npm i playwright-core    # once
node regress.js                      # then any script below
```

Two of the chapters are WebGL now — the book intro and the apocalypse — so
launch Chromium with `--use-gl=swiftshader --enable-unsafe-swiftshader` and
**not** `--disable-gpu`, or `THREE.WebGLRenderer` has nothing to draw into.
SwiftShader is software rendering and paints about one frame a second in
here, so drive the apocalypse with `__apLoop(false)` and `__apPump` rather
than waiting on the real loop, and drop the render scale with
`__apQuality(2)`. Anything measured against the wall clock in here is
measuring the container.

Chromium is at `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`. Google
Fonts is blocked by the egress proxy, so every script aborts non-localhost
requests and navigates with `domcontentloaded` — without that the page never
fires `load`. Press Start 2P and Great Vibes fall back to system faces in
these runs; that is the harness, not the site.

## What each one does

| script | what it tells you |
|---|---|
| `realplay.js` | **run this one.** Plays the game the way a person does — clicks through, waits, and looks at what is actually on the canvas — on all three difficulties. Every other suite drives the game itself and is therefore blind to anything wrong with the requestAnimationFrame path, which is how a bug that left the entire game rendering nothing got past 66 green assertions. |
| `quest.js` | **the adventure, checked as a graph.** Walks every node from the title, and clicks all four routes through to their endings. Asserts no node is a dead end, no node is a fail state, all four routes are distinct in the nodes and scenery they use, and the two endings are different. Two dead-end nodes with a *Restart* overlay lived on the live site through several passes because nothing here had ever looked at the story graph. |
| `pageshots.js` | **look at the whole book at once.** Renders every page of the scrapbook to `.pageshots/` as its own image, so the ten collage pages can be laid side by side and compared. The book only shows one spread at a time and has no way to jump to a page, so each one is cloned into a fixed frame instead. Two traps, both already paid for: the photographs are lazy-loaded and off-screen pages never fetch them, and `cloneNode` copies the src but not the decoded bitmap — miss either and you get pages full of empty frames that do not exist in the real book, which is a very convincing way to redesign something that was never broken. Both are waited on now. |
| `pageaudit.js` | **the same book as numbers.** Per page: how much is actually used, where the weight sits, which quadrants are carrying nothing, how big the photographs are relative to each other, and how many stickers are on it. Background paper patches are counted separately from content, or a half-empty page with a big patch on it looks full. Use it with `pageshots.js` — the pictures say what is wrong, this says how far. |
| `buttons.js` | **every control on every screen, at four shapes.** Asks the three things a finger cares about and nothing else does: is the control on the screen (or inside something that scrolls far enough), is the thing under its middle the control itself rather than something laid over it, and is its HIT area at least 44px — the hit area, not the painted box, because a small chip may carry an invisible `::after` target. It found the adventure's back and quit chips at 22px tall and two buttons at 39. Note the request filter in it: every script here aborts non-localhost requests, so a blocked Google Fonts call logs an ERR_FAILED that has nothing to do with the site — only 127.0.0.1 failures count. |
| `gatefit.js` | **the front door, driven with a finger, at four shapes.** Fills the dots, refuses a wrong code, backspaces, clears, and opens the book with 2207. It exists because `buttons.js` found the gate's twelve keys at **15x15** on a landscape phone — the card is a portrait 400:700 sheet sized from the height left over, and sideways there was no height left. One thing to know before editing it: the gate checks itself 300ms after the fourth digit, so pressing Unlock after typing four races the auto-check and reads its already-cleared buffer. Three digits and the plate is how you test the plate. And a wrong code is deliberately not wiped out from under her — it shows the error, flashes the dots red and shakes the card, and clears 620ms later, so 920ms after the fourth digit. Wait for the dots to empty rather than for a number of milliseconds: a flat 1400ms wait reported the site as broken on a loaded machine where the real figure was 1076. |
| `bookfit.js` | **the book, turned page by page, at four shapes.** `pageshots.js` and `pageaudit.js` measure clones; this turns the real book and asks what a person would notice: did anything throw, is every photograph on the spread decoded, does a page hang off the screen, and is the spread one page or two. Three traps, all paid for: every page lives in `#sb-spread` all the time so counting `.sb-page` counts twelve — the ones she is looking at wear `leftpage`/`rightpage`/`solo`; view 0 is the front cover and a cover is one page in any window; and an empty photo slot walks webp, then jpg, then png, so an img that is `complete` with no pixels is mid-chain rather than broken. And the one that cost the most: **`showScreen('scrapbook')` does not start the book.** `startDioramas` does, and it is the only thing that ever calls `Scrapbook.start()`, which is the only thing that ever sets `perView` from the window. Skip it and `perView` keeps the module's initial 2 — a portrait phone then builds a two-page spread at half the page width, which reads exactly like the bug he photographed and is entirely the harness. Same shape of trap as the 3D intro in `smooth.js`: go in the way she does. |
| `revisit.js` | **going back in.** Opens the book, leaves, comes back — three times each, for the book and all four chapters — and reads the browser's own counters. Collect the garbage BEFORE reading them or it reports a leak that is not there: a chapter that rebuilds its buttons every visit leaves the old ones detached, and detached-but-collectable is not a fault. Without the collect it accused the race of +12 listeners a visit; with it, everything is +0. |
| `smooth.js` | **where the main thread stops.** Counts long tasks around each thing she does. Go in the way she does — the 3D intro waits for a tap and renders while it waits, so jumping past it with `showScreen` leaves a whole Three.js scene running behind every later measurement, which is how the first version reported a page turn as a 500ms block. And a long task counts paint: a turn profiles at ~25ms of JavaScript and still books 500ms here, because SwiftShader paints it on the CPU. What this can honestly assert is that no JS blocks. |
| `padcheck.js` | The only test here that uses more than one finger. Holds a direction with one pointer id, taps jump with another, and checks she is still running — see HANDOFF 7f. Restore the old window-level `releaseAll` and it reports "jump cancelled the direction" in both orientations. |
| `landscape.js` | **run this when he mentions holding the phone sideways.** Asserts the two things a short wide screen breaks: that every control is actually on the screen (or inside something that scrolls far enough to bring it there), and that the game stages use the room they are given. It catches both of the faults it was written for — put the old CSS back and it reports 5 failures, including `#btn-start @y375..424` in a 390px window, which is the button that opens the maze. `regress.js` would never have found that: it checks for horizontal scroll and page errors, not whether a button is reachable. Note the ancestor-visibility walk in it — the apocalypse key pad is `opacity:0; height:0` on touch devices and counting it gave a false alarm on the first run. It covers all three games; Super Ouissy's floor is 92% rather than 55%, because it widens the world it shows instead of letterboxing, so anything less means the pad has gone back into the column flow or `pickView` has stopped widening. |
| `nozoom.js` | **run this whenever he says the site zooms.** Drives the screen entry and exit animations through the Web Animations API and fails if any point in either one scales the screen or changes its height. Two keyframes used to scale a whole screen — `screenIn` from .97 and `screenExit` to 1.06 — and that read exactly like the viewport bug, which is why that bug kept looking unfixed after it had been fixed. Verified both ways: restore the `scale()`s and it goes red. Do not rewrite it to sample with requestAnimationFrame; rAF is ~3fps in here and the animation would be over before the second sample. |
| `regress.js` | walks every screen — intro, gate, book, hub, maze, adventure, apocalypse, the roof ending, Super Ouissy, keepsake — on desktop and on an iPhone, and checks each still builds with no page errors and no horizontal scroll. Run this before any push. |
| `apocflow3d.js` | **the apocalypse's realplay, for the 3D rebuild.** Plays the whole chapter from the hub card to the roof: every level is started by the game itself, so the cards, the briefings, the objectives, both minigames, all five cuts and the hand-off between levels are exercised. Run this one. |
| `apocmech3d.js` | the stealth assertions for the 3D rebuild: walls stop her, creeping is slower and silent, a wardrobe hides her, a door is loud, the panel and the keypad work, and being caught is a close call and not a death. |
| `apoc3d.js`, `shots.js` | screenshot the 3D chapter. `shots.js` takes a JSON plan of `{name, cmd, tp, pump}` steps in `$PLAN`, `$Q` picks the render scale (0 full, 2 quarter — use 2 under SwiftShader). |
| `apocinput3d.js` | **whether an input reaches the loop.** Presses real keys and real touch buttons at the real requestAnimationFrame loop, on desktop and on an iPhone, and checks she walks at a walk, stops when they let go, pauses, and that leaving the chapter and coming back still opens. Every other suite drives the world with `__apPump` and is therefore blind to all of that. |
| `apocperf.js` | what the card is asked to do per level: draw calls, triangles, geometries, textures, live lights. SwiftShader cannot tell you a frame rate that means anything, but these are the numbers that decide whether a real GPU holds 60. |
| `apocprobe.js` | a single-purpose probe for the Level 4 hand-off; copy it when something in the flow needs picking apart frame by frame. |
| `apocfull.js`, `apocflow.js`…`apocflow5.js`, `apocmech.js`, `apocinput.js`, `apoc.js`, `apocshots.js`, `apocaudit.js` | the previous, 2D build's suites. Kept for reference only — they launch with `--disable-gpu` and assert on a 320x180 2D canvas, neither of which the chapter has any more. Use the `3d` ones above. |
| `apocmech.js` | the stealth assertions: walls stop her, doors open, a wardrobe hides her, being caught is a close call and not a death, and hiding beside a zombie is safe. |
| `apocflow.js`, `apocflow2.js`, `apocflow3.js`, `apocflow4.js`, `apocflow5.js` | one per level, start to finish, driving the real pointer over the wire panel and the keypad. |
| `apoc.js`, `apocshots.js` | screenshot the game and every overlay it can put up. |
| `mech.js` | eighteen assertions on the game itself: hearts, gift blocks, stomping, growing, breaking bricks, pits, the cloud that catches her on Easy, Hard's clock and extra spikes, the moat, the whole boss fight. |
| `flow.js` | plays all three worlds through to the ending and checks the results cards, the saved best time and the chapter being marked done. |
| `layout.js` | measures the stage, the touch pad and the HUD at five real device sizes and reports anything that overflows. |
| `screens.js` | screenshots the how-to, world card, pause menu, results and ending. |
| `level.js`, `play.js` | screenshot the game canvas itself at a given world and position. |
| `sheet.js` | dumps a contact sheet of every sprite, for looking at the art. |
| `sticky.js` | the touch-control suite: press, release off the button, pause mid-press, focus after a tap, rapid tapping, and whether she drifts on her own afterwards. |
| `menushot.js` | screenshots the title screen and the how-to. |
| `boss_probe.js`, `phase_probe.js` | measure the boss's state machine — tell length, opening length, projectile count, per phase and per difficulty. |
| `enemy_probe.js` | runs a level for forty seconds of game time and reports whether enemies fell in pits or juddered. |
| `parallax_probe.js` | the same view at two camera heights, for checking scenery stays planted. |

## Two things that will waste your afternoon otherwise

**requestAnimationFrame runs at about 3fps in a headless container.** Any test
that waits on wall-clock time runs in slow motion and proves nothing. Set
`window.__soTestDrive = true` and advance the world with `window.__soPump(seconds, keys)`
instead — it steps the fixed timestep directly. The `__so*` hooks are
documented at the bottom of `super-ouissy.js`.

**A green suite is not a working game.** The other suites set
`window.__soTestDrive` and call `__soPump` to advance the world by hand.
That is fast and deterministic and it never once touches
`requestAnimationFrame` — so a second function declaration named `frame`,
shadowing the game loop at the same scope, made the whole game render
nothing while all 66 assertions stayed green. `realplay.js` exists because
of that: it clicks, it waits, and it reads pixels off the canvas.

**`page.screenshot()` hangs** while the game loop is painting: playwright waits
for the element box to be stable and never gets it. Either call
`window.__soHalt()` first and capture through CDP (`Page.captureScreenshot`),
as `screens.js` does, or pull the canvas out with `toDataURL` and skip
playwright's screenshot entirely, as `play.js` does.
