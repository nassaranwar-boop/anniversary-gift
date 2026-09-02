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
| `regress.js` | walks every screen — intro, gate, book, hub, maze, adventure, apocalypse, the roof ending, Super Ouissy, keepsake — on desktop and on an iPhone, and checks each still builds with no page errors and no horizontal scroll. Run this before any push. |
| `apocflow3d.js` | **the apocalypse's realplay, for the 3D rebuild.** Plays the whole chapter from the hub card to the roof: every level is started by the game itself, so the cards, the briefings, the objectives, both minigames, all five cuts and the hand-off between levels are exercised. Run this one. |
| `apocmech3d.js` | the stealth assertions for the 3D rebuild: walls stop her, creeping is slower and silent, a wardrobe hides her, a door is loud, the panel and the keypad work, and being caught is a close call and not a death. |
| `apoc3d.js`, `shots.js` | screenshot the 3D chapter. `shots.js` takes a JSON plan of `{name, cmd, tp, pump}` steps in `$PLAN`, `$Q` picks the render scale (0 full, 2 quarter — use 2 under SwiftShader). |
| `apocinput3d.js` | **whether an input reaches the loop.** Presses real keys and real touch buttons at the real requestAnimationFrame loop, on desktop and on an iPhone, and checks she walks at a walk, stops when they let go, pauses, and that leaving the chapter and coming back still opens. Every other suite drives the world with `__apPump` and is therefore blind to all of that. |
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
