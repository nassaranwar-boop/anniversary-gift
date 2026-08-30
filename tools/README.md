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
| `regress.js` | walks every screen that existed before Super Ouissy — intro, gate, book, hub, maze, adventure, keepsake — on desktop and on an iPhone, and checks each still builds with no page errors and no horizontal scroll. Run this before any push. |
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
