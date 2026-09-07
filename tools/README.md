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
| `landscape.js` | **run this when he mentions holding the phone sideways.** Asserts the two things a short wide screen breaks: that every control is actually on the screen (or inside something that scrolls far enough to bring it there), and that the game stages use the room they are given. It caught both of the faults it was written for — with the old CSS it reported 5 failures, including `#btn-start @y375..424` in a 390px window, the button that opened the maze. (Those screens and the maze have since been taken out of the site, so it walks the gate, the hub, the keepsake and the ending now.) `regress.js` would never have found that: it checks for horizontal scroll and page errors, not whether a button is reachable. Note the ancestor-visibility walk in it — the apocalypse key pad is `opacity:0; height:0` on touch devices and counting it gave a false alarm on the first run. It covers all three games; Super Ouissy's floor is 92% rather than 55%, because it widens the world it shows instead of letterboxing, so anything less means the pad has gone back into the column flow or `pickView` has stopped widening. |
| `nozoom.js` | **run this whenever he says the site zooms.** Drives the screen entry and exit animations through the Web Animations API and fails if any point in either one scales the screen or changes its height. Two keyframes used to scale a whole screen — `screenIn` from .97 and `screenExit` to 1.06 — and that read exactly like the viewport bug, which is why that bug kept looking unfixed after it had been fixed. Verified both ways: restore the `scale()`s and it goes red. Do not rewrite it to sample with requestAnimationFrame; rAF is ~3fps in here and the animation would be over before the second sample. |
| `regress.js` | **opens each chapter twice, and walks every screen.** Every suite here used to enter a chapter exactly once, so the commonest thing a player does — look at it, go back, come back — was the one path nothing walked, and the night shift was dead from the second visit onward: no score, no keyboard, no title screen, because `stop()` leaves the phase at `idle` and `finishStart()` bailed on exactly that. It re-opens the night shift on desktop and on an iPhone and checks it is alive, including with a **real** keypress rather than a test hook — the whole battery drives the game through `__night.press()`, and a control nothing has ever actually pressed is a control nobody has tested. It also walks every screen — intro, gate, book, hub, adventure, apocalypse, the roof ending, Super Ouissy, the night shift, keepsake — on desktop and on an iPhone, and checks each still builds with no page errors and no horizontal scroll. Run this before any push. |
| `nightplay.js` | **the night shift's realplay.** Plays Ouissy's Night Shift from the hub card to the way out in 219 checks: the screens, the doors, the meter, every camera, and one assertion per performer for the thing it is supposed to punish — the owl going through a shut door, the ballerina frozen while she is watched, Jax charging you for every knock. It plays a whole night as an attentive guard would and checks she gets to six with power in hand, which is the only way to know the budget is a budget and not a wall. And it checks the second pass: six nights each adding a rule the night before did not have, the finale rather than a scoreboard, the rating and the badges, the custom night's dials, cozy mode draining slower, and the arcade cabinet, which has to be looked at on camera three before it exists. |
| `nightui.js` | photographs every screen of it — title, how-to, the found card, office, doors shut, cameras, a dead camera, the game over, six o'clock, the dawn finale, the custom night, the record, the daylight gallery, a found page, the arcade camera and the cabinet's own game — composited, DOM over canvas, through CDP. |
| `nightshot.js` | one still of any room from any of its cameras, with any of the cast standing on any of its marks. `node nightshot.js out.png stage main '[{"id":"cogsworth","anchor":"s0"}]'` |
| `nightsound.js` | **the only tool here that listens.** Every other suite runs muted, which was fine while sound was atmosphere and stopped being fine the moment telling his four from the ones he sold by ear became a rule of the game — a cue she cannot distinguish is a mechanic that does not exist. Renders each cue offline, reads the samples back, and measures peak, spectral centroid and per-channel energy. It found the two families overlapping outright once it was measuring the right thing: the first version sampled `SFX.step` on its own, which is Cogsworth's boot without the tick that identifies him, and called the parcel cues with their pan and gain the wrong way round. Fixed, it put his boots at 940 Hz and a doorknob at 1030 and they were the same sound. The parcels are duller now, the metal in his foot rings the way a clock that walks should, and the bands are disjoint on every roll — every cue here is filtered noise, so it renders each one three times and reports the spread rather than trusting one throw of the dice. It cannot tell you whether the music is any good, only that the game is not silently lying about a mechanic. |
| `nighttouch.js` | the two paths nothing else walks: a real touch pointer at phone size, and KEYWIND played past its first frame. The winding key is the only control in the chapter that is a hold rather than a tap, so it is the one most likely to be broken by a thumb that slides off — this checks that a tap does not wind, a hold does, and letting go part way does not. And it plays the cabinet until the spring runs out, because "a run always ends" is a design claim and claims should be checked. |
| `nightaudio.js` | **does any of it actually make a sound?** Every other suite runs muted or renders offline, so "the sound does not work" was a report nothing here could confirm or deny. This drives the site the way a person does — through the gate, into the chapter, with a real gesture to unlock the audio — and puts a meter on the master bus. It deliberately does not pass `--autoplay-policy=no-user-gesture-required`, because the whole question is whether the game unlocks its own audio and a flag that unlocks it for free answers it wrong. It also takes the audio session away mid-shift and checks the shop comes back as loud as it was, which is the failure a phone actually has. |
| `nightread.js` | **the playthrough, written down.** Every other tool here checks that a thing works; none of them can say whether the six hours read as a story. This plays the chapter from the film to the last morning and transcribes everything she would actually receive, in the order she would receive it, with the clock beside it and the longest silence in each night measured. It asserts nothing — it is for reading, and reading it is what found the opening film giving away nights three and four, two of the six hidden pages saying the same things as two of the revelations, two lines of narration that contradicted the mechanics they described, five arrival cards that echoed the previous night instead of setting up the next one, and three objects the writing named that were not modelled in any room. |
| `nightbeats.js` | **every beat the story promises, checked one night at a time.** Not "does the code run" — does each thing the six nights are made of actually reach her: the arrival card, his voice across the night, all four turning up, the three o'clock revelation, camera zero being offered, the hidden object being placed, and the blind last hour. Five runs a night. It found three beats invisible to every suite in this repo, because `pump()` was missing `tapeTick`, `stepFind` and `stageTheTurn` while the frame loop ran all three. Note what it does **not** assert: reaching six. That is earned, not promised, and a night six she cannot lose would not be a night six — it is reported beside the beats as information. Note also the trap: a find she has already collected is deliberately never placed again, so the runs clear `ns_found` or every night after the first reports a missing object the game is right to withhold. |
| `nightcertain.js` | **does every performer she is told about actually turn up?** Every step any of them takes is a dice roll, and dice are right for *when* one of them comes and wrong for *whether*: a performer that never leaves its room is a character she is told about and never meets, which empties night two, whose whole subject is what the four of them are. This plays every night ten times over as an attentive guard and fails if anyone the night lists as active ever finishes a shift without reaching her door. Note the trap it was built out of: the first version let the guard leave every door open, so the first arrival killed her and the night ended — it was measuring who arrives before the first death, and reported four performers missing on every night. A test that ends the night early cannot answer a question about the whole night. |
| `nightpace.js` | **is any minute of it boring?** Walks each night an hour at a time and counts what actually happened in it — performers moving, arrivals, false alarms, props that shifted, knocks — and reports the longest stretch with none of them. It is the only tool here that measures the thing a player would call "nothing is happening", and it found the first minute of night one sitting completely empty. |
| `nightbudget.js` | plays every night as an attentive guard would and prints where the meter lands, so the difficulty curve is measured rather than guessed. Night one should finish comfortable and night six on fumes. |
| `nightlayout.js` | measures the panel at six real device sizes and fails on anything smaller than a thumb, anything outside the frame, and any horizontal scroll. It walks the overlay screens too, which for a long time it did not: it only ever looked at the play HUD, so a gallery caption that grew from one line to three sat on top of its own heading on a phone and the suite stayed green. 375x667 is in the list for the same reason — the gallery's eight rooms wrap to a fourth row at that width and nowhere else, which pushed BACK off the bottom of the panel. Note what it does *not* flag: `.ns-card` is deliberately `overflow-y:auto`, so HOW TO PLAY, the badges and the custom night scroll on purpose. The check is content taller than a panel that **cannot** scroll. The first draft got that wrong and reported three working screens as broken. |
| `nighttime.js` | what a frame costs: build time, and draw calls, triangles and CPU milliseconds per room. |
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
| `mech.js` | **twenty-seven** assertions on the game itself: hearts, the love meter banking a life and granting the sparkle, gift blocks, stomping, growing, breaking bricks, pits, the cloud that catches her on Easy, Hard's clock and extra spikes, nine distinct worlds across the three difficulties, the moat, and the whole boss fight down to the projectile cap, the length of every telegraph and the opening after every attack. Slow — it boots the chapter three times — so run it bare and let it finish. |
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

## Do not pipe these through `tail`, and do not redirect them to a file

Node buffers its output when stdout is not a terminal, and every suite here
is long. `node mech.js | tail -30` and `node mech.js > /tmp/x.log` both show
you an empty file for the whole run and then everything at the end — so a
run you interrupt tells you nothing at all, not even which assertion it had
reached. That cost several hours in one sitting: mech.js looked wedged
through four attempts and was in fact passing assertions the whole time,
and the only reason anybody found out is that killing it flushed the buffer
and fourteen PASS lines fell out. Run bare and left alone it finishes: 27 passed, 0 failed, no page errors.

Run them bare and read the output as it comes. If you must capture it, kill
the process rather than the pipeline when you give up, because the kill is
what flushes it.

Related: on a loaded machine these run ten to twenty times slower than
normal, and `timeout` does not reliably fire, because the container's own
process clock is skewed. Judge progress by output, not by the wall clock.

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

**Two more that only bite the night shift.** `page.click` hangs on this
site: the page never fires `load` because every non-localhost request is
aborted, so playwright's post-click "waiting for scheduled navigations"
sits there until it times out — click through `page.evaluate` instead,
and dispatch a `pointerdown` as well as a `click`, because the office's
buttons answer to the former. And `book-scene.js` has to be kept from
loading at all: it is ACES, PMREM, bloom, bokeh and light shafts, and on
a software rasteriser it takes the main thread and does not give it
back, so everything after it times out before it can even be told to
stop.

**`page.screenshot()` hangs** while the game loop is painting: playwright waits
for the element box to be stable and never gets it. Either call
`window.__soHalt()` first and capture through CDP (`Page.captureScreenshot`),
as `screens.js` does, or pull the canvas out with `toDataURL` and skip
playwright's screenshot entirely, as `play.js` does.
