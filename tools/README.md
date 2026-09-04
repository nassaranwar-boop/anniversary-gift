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
| `regress.js` | walks every screen — intro, gate, book, hub, maze, adventure, apocalypse, the roof ending, Super Ouissy, keepsake — on desktop and on an iPhone, and checks each still builds with no page errors and no horizontal scroll. Run this before any push. |
| `nightplay.js` | **the night shift's realplay.** Plays Ouissy's Night Shift from the hub card to the way out in 65 checks: the screens, the doors, the meter, every camera, and one assertion per performer for the thing it is supposed to punish — the owl going through a shut door, the ballerina frozen while she is watched, Jax charging you for every knock. It plays a whole night as an attentive guard would and checks she gets to six with power in hand, which is the only way to know the budget is a budget and not a wall. And it checks the second pass: six nights each adding a rule the night before did not have, the finale rather than a scoreboard, the rating and the badges, the custom night's dials, cozy mode draining slower, and the arcade cabinet, which has to be looked at on camera three before it exists. |
| `nightui.js` | photographs every screen of it — title, how-to, the found card, office, doors shut, cameras, a dead camera, the game over, six o'clock, the dawn finale, the custom night, the record, the daylight gallery, a found page, the arcade camera and the cabinet's own game — composited, DOM over canvas, through CDP. |
| `nightshot.js` | one still of any room from any of its cameras, with any of the cast standing on any of its marks. `node nightshot.js out.png stage main '[{"id":"cogsworth","anchor":"s0"}]'` |
| `nightpace.js` | **is any minute of it boring?** Walks each night an hour at a time and counts what actually happened in it — performers moving, arrivals, false alarms, props that shifted, knocks — and reports the longest stretch with none of them. It is the only tool here that measures the thing a player would call "nothing is happening", and it found the first minute of night one sitting completely empty. |
| `nightbudget.js` | plays every night as an attentive guard would and prints where the meter lands, so the difficulty curve is measured rather than guessed. Night one should finish comfortable and night six on fumes. |
| `nightlayout.js` | measures the panel at five real device sizes and fails on anything smaller than a thumb, anything outside the frame, and any horizontal scroll. |
| `nighttime.js` | what a frame costs: build time, and draw calls, triangles and CPU milliseconds per room. |
| `apocfull.js` | **the apocalypse's realplay.** Plays the whole chapter from the hub card to the roof: every level is started by the game itself, so the cards, the briefings, the objectives and the hand-off between levels are all exercised. |
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
