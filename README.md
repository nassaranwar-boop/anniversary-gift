# Gift site

A single-page interactive gift. Open `index.html` in a browser, or push this
folder to a GitHub repo and enable GitHub Pages (Settings → Pages → deploy from
branch → main → /root).

**Passcode to enter the site: 2207**

> **Ouissy's Night Shift is not on this branch.** The whole site WITH
> the game -- `night-shift.js`, the recorded voice lines in `voice/`,
> its hub card, its screen and its half of the stylesheet -- is at
> commit `1bbdbe0bdc14`, which is the second parent of the merge that
> brought everything else here. Nothing of it is lost even with every
> other branch deleted; to get it back as a branch:
>
>     git checkout -b night-shift 1bbdbe0bdc14
>
> (A tag would have been tidier. This session's git gateway refuses to
> create one -- it allows a branch update and answers 403 to anything
> else -- so the SHA is written down instead.)
>
> It came off main in one commit, so it goes back in one: revert the
> commit called "Take the night shift off main" and merge that
> commit's tree back in. `tools/mainshape.js` is the check that taking
> it out left the rest of the site whole, and the night-shift suites in
> `tools/` need the game's files to run against.
>
> One thing deliberately stays: the keepsake board still has its page,
> drawn in pixels like the other four. That board is what the book
> contains rather than what is currently playable -- the comment above
> `badges` has said so since before the chapter existed -- and it is a
> picture, not a way in.

## Session log — read this first if you are picking this up

The newest entry is at the top. Each one says what was asked, what
landed, what is half-done and what the next session should do first.
**Add a new entry every session.** Anything not written down here is
lost when the container is reclaimed.

### 2026-09-20 — everything on main, and the last two faults were the harness's

**Asked for:** merge it all to main so the other branches can go; then
leave no mistake.

**IT IS ALL ON MAIN.** `main` is the whole site with the landscape
work, minus the night-shift chapter (see the note at the top of this
file for where the game is and how to bring it back). Seven branches
are ancestors of main and safe to delete; this session's git gateway
answers 403 to a branch deletion, so they have to go from the GitHub
page by hand.

**THE GATE WAS NEVER OFF THE SCREEN.** `sidebyside` measured the
landscape gate card 11px below a 740x360 window and 13px below an
844x390 one, and it is not: the gate probe, `gatefit` and `landplay`
all put the same card comfortably inside. The suite was reading it
about a second and a half after the book handed over, while the card
was still coming in from `scale(.97)` over .95s -- at four frames a
second that animation has barely started. The wait the other screens
already had is a function now, and the gate's inventory -- taken
BEFORE the passcode, so it had never been down that path -- calls it
too. It waits for the box it is about to measure to be the same box
twice: no list of what is animated, and it still works for a card
`fitCard` has legitimately scaled.

**"KEY 7 WOULD NOT TAKE A PRESS"** was the 3D book. Its render loop
runs until the climax ends and it disposes itself; until then the
keypad is competing with WebGL for every one of those four frames a
second, and the press waits out its six seconds -- on a different key
each run. `sidebyside` now calls `skipBookIntro` (the scene's own
teardown, which it runs a moment later anyway) before typing.
`tools/_keyprobe.js` is the probe that settled it: every key clean, on
screen, nothing over it, nothing animating it.

**A harness for an absent chapter says so now.** `newplayer` died on
`OuissysNightShift is not defined` and came up in the sweep as "NO
RESULT: } Node.js v22.22.2", which reads like a broken site. It skips
like `cardfit` and the rest.

**The sweep, all of it green:** regress PASS, buttons 16, landscape
15, gate no errors, gatefit 28, bookfit 24, sofit 193, apocfit 111,
sidebyside 158, landplay 259, revisit 6, smooth 14, panels 48,
readable 30, bigscreen 313, mainshape 34, codecheck 7, enginecheck 3 --
0 failed in every one.

**Next session:** the book's composition and details (the one task
still open), and the seven dead branches if he has not deleted them.

### 2026-09-19c — the gate lying down, the big screens, and the faults you have to read for

**Asked for:** a full detailed sweep of the code for mistakes; whether
the site fills every big screen in every browser; the games played
again at iPad and PC sizes as well as landscape phone; and then, from a
photograph of the gate sideways, "it looks so ugly -- I want it
aesthetically pleasing and perfect".

**THE GATE LIES DOWN NOW.** The sheet is a portrait 400:700 page whose
width comes from the height left over, and sideways there is almost
none: 183 points of card in an 844 point screen, six per cent of the
window, the twelve coins at their 44px floor. Sideways it is a
landscape sheet: writing and code field in the left half, keypad in the
right, a fold down the middle, the plaque over both. 581x332, 59% of
the window, keys at 66px. Four things to know if you touch it:

- The gold frame is two rules and four corner sprays in an SVG whose
  viewBox is the upright sheet, so it crops rather than reshapes. There
  is a SECOND arrangement in the markup now, 700x400, out of the same
  <defs>.
- Do not `display:none` the upright frame to hide it. Its <defs> holds
  the gradient and the ornament for BOTH arrangements, and hiding the
  SVG takes the paint servers down with it: every stroke resolves to
  url(#gGold) and paints nothing. Only its drawn children go
  (`.gate-frame:not(.gate-frame-wide) > :not(defs)`).
- Everything inside is in cqh sideways, not cqw. The card is a size
  container and its width trebled; in cqw the heading came out at 36
  points.
- The keypad is 64cqh so that four rows exactly fill the sheet's 86cqh
  of inner height. At 67 the bottom row sat on the drawn border.

Three blocks of short-screen rescue came out with it -- they existed to
claw the keys back to 44px on a 340 point window, and there is nothing
left to rescue.

**THE SITE NOW FILLS A BIG SCREEN.** The gate's sheet is capped at 360
points and the hub's board at 620: a reading measure on a laptop, a
postage stamp on a monitor. Measured: the hub used 41% of a 1280x800
window, 26% of a 1440p one, 5% of a 4K one. `fitCard` grows as well as
shrinks now, above 1400x860, capped at half again -- and what grows is
the whole COMPOSITION (.gate, .hub-wrap, .ks-wrap), not the card inside
it, because a transform is drawn and not laid out and a card scaled on
its own grows out from under its own title.

**THE TWO NEW STATIC SUITES.** `tools/codecheck.js` reads the files for
what no browser test can see: duplicate ids, duplicate object keys,
elements asked for that are never made, unanswered data-go, stray
console.log, and CSS rules overwritten by a later copy of themselves.
It found the gate written twice under the same media query, the
apocalypse's quiet narrator set twice, a cutscene wash set and unset,
and the retired cats -- four PNGs still fetched on every visit to draw
nothing, with thirteen rules and three @keyframes behind them.
`tools/enginecheck.js` is the honest answer to "every browser": one
engine in this container, so it reads what the site leans on and
reports the oldest Safari and Firefox that has it. The headline is
container queries and cqw/cqh, used 2104 times: Safari 16, Firefox 110.

**TWO HARNESS LESSONS, both expensive:**

- `getAnimations().finished` never settles here, because half the
  site's animations are infinite. Do not await it.
- This container paints about four frames a second, so a .95s entrance
  animation is still on its FIRST keyframe two and a half seconds in.
  Measuring inside it is how one window reported 349x610 on one run and
  343x595 on the next with an identical stylesheet. Wait for the
  transform to come to rest, or use a clock longer than the animation.

**Where things are:** everything is on `site-with-night-shift`; main is
that minus the game. Merging the branch into main is clean -- git keeps
main's deletion of night-shift.js and voice/ and takes the rest.

### 2026-09-19b — everything in one branch, main without the game, and the phone on its side

**Asked for:** collect the night shift out of every branch, make it
stable and verify it end to end as a new player; put the whole site
with the game in ONE new branch and delete the others; take the game
off main until he wants it back; then a deep sweep of the site, and
make the landscape phone an exact smaller iPad/PC in every game and
every screen — nothing lagging, nothing out of place, every button on
the screen, working, and not hidden under anything.

**Where the code lives now.** Three facts, and nothing else is true:

- `site-with-night-shift` — the whole site INCLUDING Ouissy's Night
  Shift. This is the branch to work on the game in.
- `main` — the whole site WITHOUT it: no `night-shift.js`, no `voice/`
  (16MB of recorded lines), no hub card, no screen, no stylesheet for
  it. One commit, so bringing it back is one revert plus a merge.
  `tools/mainshape.js` is the check that taking it out left the rest
  whole.
- The five old branches are gone. Every one of them was proved to be
  fully contained in `site-with-night-shift` before it was deleted.

**What was actually wrong, all of it found by measuring:**

1. **The last card of the chapter said `undefined`.** `NS` had two
   top-level keys called `kept` — the line about whether she kept the
   terms, and the six-things ending — and the later one silently ate
   the earlier one. `tools/dupkeys.js` now fails a check instead of
   printing "undefined" on screen; it found a second pair on the same
   run (two test hooks called `bed()`, so `tools/nightaudio.js` asking
   for the room tone was quietly reading the talking state).

2. **The plan of the shop sat on top of the RIGHT DOOR key** at
   844x390 and 740x360. The rule that lowers it belongs to portrait,
   where the pad is below the stage; it was in a `max-width:900px,
   orientation:portrait` block, and the comma is an OR.

3. **Both endings were off the bottom of the last card**, at every
   landscape size. A transform is drawn, not laid out: the card's box
   is still 495px tall, so it is laid out from the top of a 390px
   overlay and scaling it about its CENTRE moves the middle of a box
   that starts above the screen to the middle of one that ends below
   it. `fitCard` pins an overflowing card to the top now — which also
   lets it stay bigger, 0.72 where it was 0.58 — and where even the
   floor is not enough the card scrolls with its buttons stuck to the
   bottom of the scroll (`.fit-scroll`).

4. **Nothing ever ran the site's fitter except turning the phone.**
   Arriving at 360 points of height, which is how everyone actually
   arrives, left a card unfitted: the gate's UNLOCK plate hung off the
   bottom at 740x360. `showScreen` fits what it just put up now, and so
   does `load`.

5. **The site fitter was looking for classes that do not exist.**
   `.hub-inner`, `.ancient-card`, `.ks-card` as a container — only
   `.gate-card` was ever real, so it was a no-op on every screen but
   the gate. It is `.gate-card, .hub-wrap, .ks-wrap` now.

6. **Super Ouissy's touch pad was hidden from assistive technology for
   its whole life** — `aria-hidden="true"` written once in the markup
   and never updated, on the only controls that game has on a phone.

7. **`__apClear()` forced `G.state = "play"` whatever was going on**,
   and on the title card — no level, so no `G.player` — the frame loop
   then walked into `updatePlayer` and threw on every frame for as long
   as the tab was open.

**The suites that found them, and what they know now:**

- `tools/cardfit.js` — all 14 cards the chapter can put up, at three
  landscape sizes, 219 checks. It reads the controls from the whole
  chapter rather than the overlay, so the shift and the monitor are
  checked the same way a card is, and it waits for a screen with
  something to press rather than a flat 700ms. Two of its drivers were
  lying to it: `route('quit')` hands the page back to the hub, so
  everything after the pause menu was being measured inside a hidden
  screen and read zero.
- `tools/sidebyside.js` — desktop, iPad and two landscape phones, 180
  checks. Every control the laptop has, on the screen, uncovered, and
  its middle in the same place on the card it belongs to. A control at
  the 44px touch floor cannot scale with the layout, so it is counted
  and shown rather than failed.
- `tools/landplay.js` — all five games PLAYED on a landscape phone, 150
  checks. Every press is checked twice: `elementFromPoint` says nothing
  is over it, and the game's own state says the press arrived.
- `tools/mainshape.js` — main without the game: four ways in, all four
  open and run, nothing asks for a file that is gone, nothing throws.

**Four things to know before driving these games from a harness**, all
paid for this session:

- The kart racer has NO throttle and NO pad on glass. It drives itself
  and the whole picture is the wheel; the steering zone listens for
  TOUCH events, not pointers; and the countdown does not count under
  software rendering, so step it to the green with `__RACE_DEBUG().step`.
- The apocalypse's stick is not a button: a thumb anywhere on the left
  of the picture below the HUD becomes it, and that first touch is what
  puts USE and CREEP on screen — they are `pointer-events:none` until
  then, on purpose.
- The adventure holds its choices back, hushed and genuinely disabled,
  until the two of them have finished talking; a line is up for 2.9s.
- The gate's keys answer `pointerdown`, not `.click()`, and the right
  code turns the page to the SCRAPBOOK, not the hub.

**The one thing that could not be done from in here.** The five old
branches are still on GitHub. This session's git gateway answers **403
Forbidden** to `git-receive-pack` for a ref DELETION — an ordinary push
goes through, a delete does not, and the rule in this environment is to
report a 403 rather than route around it. So they were proved contained
first (every one of them is an ancestor of `site-with-night-shift`,
which means deleting them loses nothing at all) and then left alone:

    claude/book-polish-smoothness
    claude/long-way-round-review-3oisr9
    claude/ouissy-apocalypse-rebuild-401o1w
    claude/phone-landscape-fit-qz8krt
    claude/wick-cogs-horror-game-1i25wl
    claude/website-perf-zoom-fixes-3lqveu

Two clicks each in the GitHub branches page, or one `git push origin
--delete <branch>` from anywhere the gateway allows it. Check
containment again first if any time has passed:
`git merge-base --is-ancestor origin/<branch> origin/site-with-night-shift`.

**What is left:** nothing else from this ask. The long-standing one is
still task #12, polishing the book's composition — do not start it
unless he asks.

### 2026-09-15d — the nights, played through, several times each

**Asked for:** the same thing as the entry below — every fault in the
early nights, no exceptions, checked and rechecked until the script is
logical and the game follows it.

**Where it is:** the entry below fixed what could be seen by looking at
one moment at a time — where somebody stood, what a camera saw, what a
caption said. This one found what can only be seen by playing a night
from midnight to six and then reading it back, which is what
`tools/scriptcheck.js` does: nights one to five, as whole playthroughs,
several times over, with a competent player's hands on it. Seven
faults, every one of them in how the writing is DELIVERED rather than
in the writing itself — which is why nothing ever crashed and no suite
had ever gone red. A line that is never said and a line that is said
twice both look exactly like a working game from the inside.

1. **AFTER THE FIRST THING SHE FOUND, HE NEVER SPOKE AGAIN.** The
   biggest one by a long way. `revealCard` switches the tape system off
   — quite right, the shift has stopped and she is reading a page —
   and `closeReveal` never switched it back on. So from the moment she
   picks up the first thing he left her, at about three in the morning,
   on every night from the second one, the rest of the night he wrote
   for her is silent. `tapeTick` returns on its first line and there is
   simply no voice in the building. Three hours of tape a night, gone,
   on any playthrough that found anything — which is all of them.

2. **A KNOCK LANDED ON TOP OF A SENTENCE.** His lines queue: they go
   into `TAPE.pending` and wait for a quiet moment. A toy coming to her
   door to ask did not — `talkStart` said the question the instant it
   was called. Measured on night two: his first words of the shift,
   "You came back. I have been sitting here all day...", were on screen
   for one tenth of a second before Cogsworth knocked over them. She
   never read the line, and `tapeSay` marks a line said whether or not
   anybody read it, so she never got it again either.

3. **AND THE GREETING WAS CUT OFF HALF A SECOND AFTER IT WENT UP.** The
   other end of the same trade. "Thank you." when she opens the door is
   a line with a reading time; the line the toy came for replaced it at
   0.55s regardless.

4. **AND HE TALKED OVER A TOY STANDING IN HER DOORWAY.** `tapeQuiet`
   excepts a toy that came to speak from the rule about not being
   talked over — otherwise it would stand at that door all night
   waiting for a gap its own presence was closing. That exception is
   for the toy's sake and it was being spent on him. Cogsworth got his
   question out, a tape started while he waited for an answer, and the
   "Thank you." landed thirteen seconds after the thing it was thanking
   her for.

5. **THE ANSWER TO HER ONE REAL CHOICE REPEATED EVERY NIGHT.** She
   keeps or burns one of his things at three every morning, and the
   night after, the one it costs the most tells her what it made of
   that. Once. It was guarded by tonight's record only, so from the
   night after her first choice it arrived every night for the rest of
   the week — and by night four there were three of them queued up
   doing it.

6. **AND SO DID THE FIVE FIRST-TIME LINES.** `firstDoor`, `firstCam`,
   `firstWind`, `firstParcel`, `firstHeld` — five lines that explain a
   thing she has just done for the first time. The note over the one
   that fires `firstHeld` says "once, and never again — after that it
   is simply how the shop works". "I told you. Let them." arrived on
   the second, third and fourth nights of a measured playthrough, each
   time as though it had never been said.

7. **HIS VOICE CARRIED ON UNDERNEATH THE FOUR THINGS THAT STOP HIM.**
   `tapeOff` took the words off the screen and never touched the
   speakers, so a line that started two seconds before something
   reached her finished its sentence about the kettle over the top of
   the jumpscare. Same for the found page, the terms and the last hour
   — the four moments in the chapter that most need silence.

**AND THE TEST HOOKS LIED.** `dueNow` answers "what is due at this
night and this hour, given what has been said tonight" — and several
kinds of line are once in a playthrough rather than once in a night, so
its answer depended on whatever the page had happened to play before
the question was asked. It states the whole record now, and clears the
air before it asks, because an oracle that waits for a voice to finish
is answering a different question.

**THE NEW SUITE** (`tools/scriptcheck.js`, 40 checks at three
playthroughs). A run is a PLAYTHROUGH — nights one to five, in order,
in a page of its own — because several of these promises are about the
week and not about Tuesday. Seven rules per night: right night, up the
clock, once a shift, nothing before the night it opens on, the exchange
in full and in order, nothing longer than ninety-five seconds of
silence, and no line cut off by the one after it. Two across the week:
a line carrying a deadline arrives by it whether or not she earned it,
and a line that promises to happen once does not happen twice. And
three before a frame is drawn, because a line in this chapter is
identified BY ITS WORDS everywhere — `TAPE.said`, the once-ever record
and the voice manifest are all keyed on the sentence — so two entries
with the same words in them are one line, and saying either silences
the other. `DUMP=1`
prints each night as a transcript, which is the thing to read before
touching any of this: it is the chapter as she hears it.

**Two things it had to learn to be honest about.** A run must READ THE
CARDS — a find stops the shift and waits for a button, and a harness
that never presses one stops dead at three in the morning and reports
the remaining three hours as missing dialogue. And it must abort
`voice/`: the takes play on the wall clock, the suite drives six hours
of night in a couple of real seconds, and one eleven-second recording
is otherwise still sounding three game-hours later, so everything that
waits for the air to be free waits for ever. Both of those looked
exactly like game faults first.

**Green on**, every one of them re-run against the finished tree:
scriptcheck 40 (three playthroughs), storycheck 114, endcheck 47,
overcheck 42, midcheck 67, camcheck 13, geomcheck 12, saycheck 11,
revealcheck 7, castcheck 9, linecheck 5, oncecheck 4, seamcheck 34,
nightbeats green.

**NEXT:** nights five and six have never had a transcript read end to
end by a person — scriptcheck plays five now but night six is the last
hour and belongs to `endcheck`. And the frame still draws 398–487 calls
(`tools/_cost.js`); nobody has measured the chapter on his actual
phone.

### 2026-09-15c — he played the early nights again, and every fault he saw

**Asked for:** the first nights have problems — cameras, dialogue,
characters stuck on a wall. Fix every one, check repeatedly, do not stop
until the script is logical and the game follows it with no mistakes.

**Where it is:** every fault found is fixed, each with a suite that goes
red without the fix. Four new suites, six new tools. One thing is NOT
done and cannot be done from here: see the voice note at the bottom.

**CHARACTERS STANDING IN THINGS** (`tools/geomcheck.js`, 12 checks).
Every figure is placed by name and nothing had ever checked what is at
that position.
  - **The soldier stood inside the barrel organ**, every night, on the
    show stage. Three plinths at x = -2, 0 and +2; the note above them
    says the middle one is bare so the empty one reads; the anchor was
    on the first one, sharing a coordinate with the organ to two
    decimals.
  - **The owl stood inside the repair stand** in its own home room —
    again the exact coordinate the prop is placed at.
  - Three more spots were a fifth of a metre into a wall, a display
    case or whatever is on her desk.
  - **Marabelle and Jax shared two spots in the party room and the same
    doorway**, so on any night both were about they stood inside one
    another. Their party routes are separated now; the doorway cannot
    be (both are right-door performers) so whoever arrives second
    stands beside the first. Twelve pairs of routes name the same spot
    once the three parcels are counted; all twelve are staged and
    measured.
  - The fallback spot table gave the owl and the jester the same spot
    while claiming "so two of them never share one". Four of them and
    three spots is a table that cannot be written correctly, so it is
    not a table any more — the room is asked which spot is free.

**CAMERAS** (`tools/camcheck.js`, 13 checks). The camera system itself
is sound — every number maps to one room, pressing it puts that room on
the glass, nothing leaks. What was wrong was where people stood:
  - **`hall/near` was cut off at the chest by its own camera** — the
    soldier at his closest station, one step from her left door, at the
    single moment in the night she most needs to look at him. His feet
    projected 38 degrees off the axis of a lens with 31 to give.
  - Four more spots were cropped the same way. All six moved, and the
    check is now a real frustum test rather than an angle against the
    field of view.

**DIALOGUE** (`tools/saycheck.js` 11, `tools/oncecheck.js` 4,
`tools/linecheck.js` 5).
  - **The speaker's name was wiped one frame after every line any of
    the four ever said.** The per-word highlighter walked every child of
    the caption writing className, and the name chip is a child. Same
    bug lit every word one position late and never lit the last word.
    Anwar has no name chip, so his lines were correct — which is why
    nobody caught it.
  - **The first-time lines happened every night.** "You are still here.
    He said you would be." — the first words spoken to her by anything
    in that building — arrived at 12:16 on night two, night three and
    night four. The guard was emptied at every midnight because it is
    also what stops a line repeating inside one shift. There is a
    record that survives the night now, cleared when the story is.
  - **It never got to ask.** If the door was already open when one of
    them came to the door — which is the normal state of a door —
    `talkTick` resolved the whole trade on the frame after the ask went
    up. What the player saw was one frame of the question and then
    "Thank you.", thanking her for a door she had not decided anything
    about. The question is asked before the answer counts.
  - **The overheard exchanges flickered** clear/muffled/muffled/clear
    as she swept cameras. Losing the picture is now a ratchet.
  - Each of the four has two ways of asking and **only ever used the
    first**, because the index came off a counter reset at midnight.
  - The annunciator said "CAMERA ZERO 5" where everything else spells
    its numbers out.

**NEXT:** the fourteen overheard lines added yesterday and nothing else
are still unrendered — `tools/linecheck.js` reports exactly which. Run
"Anwar's voice" from the Actions tab on this branch, then castcheck,
then merge to main.

### 2026-09-15b — the first minute of a night, and the four of them talking to each other

**Asked for:** pick up the unfinished night-shift work, finish it
properly on the branch it was already on, and do not leave a mess.

**Where it is:** the two items the entry below left open are DONE. The
branch is green on storycheck, endcheck, seamcheck, cuecheck, castcheck,
nightbeats, midcheck and overcheck.

1. **DONE — the midnight beat, on all six nights.** It was in the tree
   as `wip: the first minute of a night` and had never been watched. Six
   nights, each one opening with the building doing tonight's damage to
   itself in front of her before the clock starts. Four things were
   wrong with it and all four were found by looking at it rather than at
   the code:
   - **The lines walked away from the machinery.** The beats ran on a
     stopwatch, the annunciator reads one line at a time and holds each
     for as long as it takes to say, so the two drifted apart and the
     gap grew with every beat. Measured on night two: the monitor came
     up on the workshop a second and a half before "SHIFT TWO OF SIX"
     was read out. A beat now waits for the annunciator to be free and
     then for its own gap, so the written rhythm survives and a sound
     and the sentence about it land in the same frame.
   - **Two nights announced a fault that had already happened.** The
     hall was dark at t=0.1 on night three, five and a half seconds
     before the scene said the lights went. On the night a fault first
     appears the night now starts without it and the beat is what does
     it; every night after that it is on from the start.
   - **Night five could leave a door shut.** The self-test closed on a
     beat and opened on a `setTimeout` guarded on the scene still
     running — so if the beat ended first, she started the night with
     the east door shut, the meter draining, and nothing saying why.
     The opening is its own beat now.
   - **The building announced the scene it was about to act out**
     ("DOOR TWO: ACTUATOR DEGRADED", 1.6s before night five's own
     opening line). A fault the beat demonstrates is not also announced
     in advance.
2. **DONE — `tools/midcheck.js`,** 67 checks. It holds, it ends, it
   hands the desk back with the monitor down and no door shut, the
   machinery and the sentence are in step, the fault it announces has
   not already happened, and a custom night gets none of it. Verified
   both ways: put the stopwatch or the early fault back and seven go red.
3. **DONE — the four overheard talking to each other, nights one to
   four** (`NS.overheard`). Everything they said on those nights was
   said TO her; the only place they were ever people was the last hour
   of night six. Now each of the first four nights carries one exchange
   between two of them — about the shop, about him, about each other,
   and not about her. She gets it clear if she is watching that room on
   a live picture, and through the wall if she is not, so it rewards
   sweeping without ever being missable.
   Three real faults came out of building it, all of the same shape as
   ones this chapter has paid for before — an unbounded wait on a flag
   another system stops maintaining:
   - a scene that waited on `TAPE.up` waited for ever once the tape tick
     was switched off, which `revealCard` does at three in the morning;
   - the same for a queued line of his that nothing was left to drain;
   - and he talked over his own toys, because the yielding was checked
     in a step that runs before the one that starts his next line.
4. **DONE — `tools/overcheck.js`,** 42 checks, and
   `tools/voicesheet.js` now harvests the fourteen new lines (270 in
   total, up from 256). **`voice/RENDER` is bumped to 2026-09-15c and
   the workflow has not been run yet** — see the note below; until it
   is, those fourteen lines fall back to the browser's own engine.
5. NEXT: run "Anwar's voice" from the Actions tab on this branch, then
   `tools/castcheck.js` again, then merge to `main`.
6. THEN: the frame still draws 398-487 calls (`tools/_cost.js`). Nobody
   has measured the chapter on his actual phone; do that before taking a
   knife to a working renderer.

### 2026-09-19 — the last fault from that sweep, and everything on main

**One more thing from playing it as a new player.** Night one armed two
things that speak through the same annunciator: the first minute of the
night (the building doing tonight's damage to itself) and the first card
of orientation, which is read out loud the same way. Both were armed in
`beginNight`, so from t=0 a new player got two voices at once for eight
seconds, as the first thing the chapter ever says to them. The card is
armed at the start now and shown when the cold open finishes -- both
ways out of it, the scene ending and a suite cutting it short.

**The whole tree, re-run in one sequential pass:** nightplay 221,
storycheck 114, scriptcheck 40 (three playthroughs of each night),
midcheck 67, endcheck 47, seamcheck 34 clean seams, cuecheck 5 over 27
cues, castcheck 9.

**Note for whoever is next:** two incarnations of this session were
alive at once during the container restarts, and both pushed. If the
working tree ever looks like it is missing work that is on the branch,
`git fetch` and compare before assuming -- and never resolve a stash
conflict with `git checkout --theirs .`, which in that state means the
stash and quietly reverted 938 lines of somebody else's commits here.
It was caught by running a suite that failed on a missing hook.

**Pushed to `main`.**

### 2026-09-15 — what a player actually hit, measured and fixed

**Asked for:** he played the early nights and reported three things --
the dialogue lags and stays on screen after he has stopped talking, or
does not read at all; some of the toys stop doing anything; and the
camera faces one way while there is something at the other door. Play it
like somebody who has never seen it, sweep in detail, fix what is there.

**The harness that found all of it:** `tools/newplayer.js`. Every other
suite drives the shift with `pump`, which takes the frame loop, the
renderer, the audio and the real clock out of it -- right for checking a
rule, useless for finding these. This one sits in the chair, lets the
page's own loop run in real time, moves a mouse the way a hand does, and
writes down what it sees every tenth of a second.

**Fixed, all of them measured before and after:**

1. **His words stayed up ten seconds after he stopped.** The caption
   timer was the whole estimated length of the line plus a tail, and it
   only ran down WHILE NOTHING WAS SPEAKING -- so a take that really
   played held it at full and the words served their sentence again in
   silence. Night one, measured: fifteen seconds on screen, nine and a
   half of them after the voice had gone. Now: while a voice sounds they
   stay, a second after it stops they go, and a line with no take at all
   gets its full reading time instead.
2. **A toy could stop being anywhere.** Every phase of a door-talk waits
   for the shop to be quiet, and quiet means nothing else at her door --
   while `stepCast` skips anything that is talking. A second toy
   arriving mid-sentence suspended the first one indefinitely: frozen in
   her doorway for the rest of the night. Each phase has a deadline now,
   with a backstop behind all three.
3. **The camera faced the wrong wall, twice over.** The head-turn toward
   the thing she let in lasted the whole conversation (ten seconds of
   not being able to see the other door -- a defence she cannot use). It
   is a glance now: 3.5s, released the instant anything else is at a
   door or she touches a control. And the five keys sit across the
   bottom of the same stage the mouse aims the view with, so reaching
   for the left door button turned her away from the right one and left
   her there. Hovering a control no longer aims anything.
4. **One of them held her doorway for 25 seconds** in two talks with a
   blink between them, because three of the four's lines come due at
   once by the middle of night three. A minute of quiet between them.
5. **Sixteen lines had never been recorded.** Every one of the four can
   come to a door and ask to be let in -- and not one of those lines was
   in `tools/voicesheet.js`, so the render had never seen them. An
   unrendered line does not fail; it comes out of the browser's own
   engine or out of nothing. That is what "sometimes it does not read"
   was. All 256 lines are rendered now.
6. **`tools/nightplay.js` is green again** -- 221 checks, the suite that
   plays the chapter with real clicks. It had drifted a long way from
   the chapter, because it lives on main and the chapter has had
   sessions of work on a branch. Fixing it re-validated the how-it-works
   card, night one's flow through the film and the terms, the finds, the
   tutorial, the whole ending path and the unlocks.
7. **`filmSeek` could hang on a playing take** -- it runs the film's
   clock inside one turn of JavaScript, so the audio clock never moves
   and a take that was playing stayed playing. It cuts the take per step
   now.

**Left open / next:**

- The voice re-render triggered by `voice/RENDER` (2026-09-15b) has to
  land before `tools/castcheck.js` passes: the render that gave the
  asking a voice moved two pairs of characters within a semitone of each
  other (the owl against her, the first one he ever sold against the
  tape). The pitches are changed in `tools/voicesheet.js`; run castcheck
  once the Action has committed the takes.
- **A frame draws 398-487 calls** (measured, `tools/_cost.js`; the
  simulation itself is 0.04-0.18ms a frame, so the cost is all drawing).
  That is the one candidate left for "it lags" on a real device, and it
  would mean merging static room geometry by material. Nobody has
  measured the chapter on his actual phone yet; do that before taking a
  knife to a working renderer.
- The three items below this entry (the midnight beat, the first-night
  script, pushing to main) are still open.

### 2026-09-14 — more first-night scenes, a bigger score for night six

**Asked for:** more scenes and more script in the first nights; more
music, written to the emotional changes in night six; notes in the
README every session; and a push to `main` if the session is cut off.

**Where it is:** IN PROGRESS.

1. **DONE — seven new cues and six new themes for the last hour.**
   `siege` used to run for eighteen shots and carry a negotiation, a
   power failure, the first of the four dying and its eulogy; `alone`
   carried the arrival of the antagonist and a man putting a woman
   under a floor. Now: **plea** (two voices taking turns — the only
   conversation in the film where both sides want something),
   **hollow** (the phrase stopped one note short of home, and nothing
   finishes it), **waltz** (three against four, so the dance never
   agrees with the attack under it), **march** (the tick on every other
   step, in perfect time until it isn't), **older** (the shop's own
   music box a third of a semitone flatter every pass), **vow** (the
   vigil's fifths, and every fourth bar the third arrives), **ashes**
   (the warm phrase in thirds, slower than it has ever been played,
   four seconds before the detonation). 22 cue changes across the film,
   up from 16. seamcheck is 34 seams, up from 26.
2. **DONE — `tools/cuecheck.js`,** a new suite. seamcheck can only tell
   you two cues do not clash; it passes a handover into silence. This
   renders all 27 cues offline and measures level, peak and onsets, so
   a silent cue, a clipping cue and a cue that shouts over the film are
   all failures. It immediately found `siege` peaking at 1.007 — the
   loudest cue in the chapter was clipping, by a hair, for four
   minutes. Trimmed to 0.922.
3. NEXT: a midnight beat for every night — the building does the thing
   that changed about tonight, in front of her, before the clock
   starts.
4. THEN: more script in nights one to four — the four overheard talking
   to each other (which until now only happened on night five), and
   more lines that answer something she did.
5. THEN: storycheck/endcheck/seamcheck/cuecheck green, push, and run
   the voice workflow for any new spoken line.

**Anything new that is spoken needs the voice render.** Lines are silent
until `.github/workflows/voice.yml` ("Anwar's voice") is run from the
Actions tab on the branch the lines are on; it renders every line
`tools/voicesheet.js --json` can see and commits the audio and a fresh
`voice/manifest.json`. Nothing fails without it — the chapter just falls
back to the browser's own speech engine and the printed text.

**Branch:** work happens on `claude/website-perf-zoom-fixes-3lqveu`;
`main` is what Vercel deploys.

## Files

```
index.html       page structure (all screens are <section class="screen">)
vendor/          three.js r180 + post-processing, bundled for offline use
style.css        all styling
script.js        site logic + maze/adventure content config (EDIT CONTENT HERE)
ost.js           the adventure's score — one tune, eleven ways of playing it
book-scene.js    the Three.js 3D intro scene — self-contained
scrapbook.js     the memory book — its own config block at the top
super-ouissy.js  the platformer — its own config block at the top
rescue.js        the platformer's story scenes (Hard only) — self-contained
apocalypse.js    the stealth chapter, in 3D — its own config block at the top
racing.js        the kart racer — a hand-written Mode 7 renderer, not Three.js
night-shift.js   the night-shift horror — Three.js, on the bundled copy
assets/          images used by the 2D parts of the site
vendor/          three.js r180 + postprocessing, bundled; used by the
                 book intro and the apocalypse, loaded on demand
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
5b. **The Long Way Round** — branching pixel-art choice adventure: two
    paths, two routes each, an ending per path, the two of them on the
    path the whole way, and three things to do rather than read
5c. **Super Ouissy** — a three-world platformer (`super-ouissy.js`)
5d. **Ouissy at the Apocalypse** — a five-level third-person 3D stealth
    story (`apocalypse.js`), ending on the same rooftop as the maze
5e. **Super Ouissy Race** — the Mode 7 kart racer (`racing.js`)
5f. **Ouissy's Night Shift** — a six-night camera-and-doors horror
    (`night-shift.js`), set in the Wick & Cogs Toy Emporium
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
- `QUEST_FINAL` — the two closing questions of the choice adventure (one
  per path) and the nudge you get for saying no
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

## Deploying

The whole site is static — there is nothing to install and nothing to build,
and `vercel.json` says exactly that (`installCommand` and `buildCommand` are
both `null`, and the output directory is the repo root). They used to be
`echo` commands, which is the same intent but leaves Vercel running a build
that produces nothing; `null` skips the step outright, which is the
documented way to serve a repo as-is.

`.vercelignore` keeps `tools/` out of the deploy. That matters: `tools/`
carries a `package.json` for playwright, and without it Vercel would find
that, decide the repo is a Node project, and try to install it.

To check what a deployment would actually serve — as opposed to what your
working tree serves — run `tools/deploycheck.js`. It exports the *committed*
tree, serves it cold, and loads it. That is the difference between "it works
on my machine" and "it works from the repo".

### Two traps that are not the code

**The free plan allows 100 deployments a day, per account.** Go over and every
push fails with `Resource is limited — try again in 24 hours (code:
"api-deployments-free-per-day")`, which looks exactly like a broken build and
is not one. It clears on its own after 24 hours.

**Check you have only one Vercel project pointed at this repo.** Two projects
on the same repository both deploy on every push, so each push costs two of
the hundred. If the PR shows two `vercel` bot comments naming two different
projects (`anniversary-gift` and `anniversary-gift-xxxx`, say), that is what
is happening — delete the spare in its project settings.

### GitHub Pages works too

Every asset in `index.html` is referenced *relatively* (`style.css?v=…`, not
`/style.css`), so the site runs unchanged from a subpath — which is what Pages
serves from. `deploycheck.js` takes an origin, so this is checkable:

```
git archive HEAD | tar -x -C /tmp/pagesroot/anniversary-gift
(cd /tmp/pagesroot && python3 -m http.server 8902 &)
node deploycheck.js http://127.0.0.1:8902/anniversary-gift
```

Settings → Pages → deploy from branch, pick the branch, `/root`. There is no
daily deployment cap, and `.nojekyll` is already in the repo so Pages will not
try to run Jekyll over it.

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

## Ouissy at the Apocalypse

A third-person 3D stealth story in five levels, reached from the hub. She is
home alone when it starts; the game is her getting to Anwar, and then the two
of them getting somewhere safe.

Arrow keys or WASD to move, **shift** to creep, **E** or space to use
whatever she is standing at, Esc to pause. On a phone there is a pad and two
buttons.

### It is a real 3D game

It runs on `vendor/three.bundle.js` — three.js r180 with the postprocessing
addons, bundled for offline use, and the same one `index.html` already loads
for the book intro. `apocalypse.js` will fetch it itself if it is not there,
so the chapter keeps working if that tag ever moves.

Everything you look at is geometry with lights on it, rendered clean —
multisampled, half-float, analytically anti-aliased, and with no film grain
or dither anywhere in the chain. Grain is a way of hiding a render; this one
does not need hiding.

Everything you look at is geometry with lights on it:

- **The world is built from the grid at load time.** Walls, floors, kerbs,
  roofs, facades, debris and furniture go into `InstancedMesh` batches, so a
  street of forty buildings with two hundred windows in it is still a couple
  of dozen draw calls. Outdoors the walls are flood-filled into buildings and
  each one gets its own storey count and its own roofline — a parapet with a
  coping on it, a stair head, a water tank on legs, plant, an aerial. The
  facades are real: a plinth at the pavement, a string course at every floor,
  windows set into a dark reveal with a sill, a lintel and a mullioned frame,
  shopfronts at street level with fascias and half-down shutters, and a
  cornice under the parapet. A week into this, some of them are boarded, some
  have lost their glass, and one or two have soot up the wall above them.
  Rubble banks up where a wall meets the pavement, litter blows about, and
  somebody's bin is still out.
- **Everybody is a skinned mesh on a real skeleton.** Twenty-two bones, one
  continuous body surface, and garments as their own shells over it. An
  elbow bends the mesh around it instead of hinging one cylinder past
  another, and a figure costs seven draw calls rather than twenty-five.
  Every limb, torso and garment comes out of one builder — a stack of rings
  with bone weights on them — so an arm and the sleeve over it are the same
  kind of object and deform together. A t-shirt hangs below the waist and
  ends in a cuff that stands off the arm; joggers gather into an elastic at
  the ankle; hands have thumbs; shoes have a sole, a toe box and a collar.
  Ouissy has fair skin and long blonde wavy hair built as a cap, a fringe
  and sixteen tapered locks each waved on its own phase. The ones that used
  to be people come out of nine skin tones, six wardrobes, four builds, six
  hairstyles and a set of things that can have gone wrong, so a corridor
  with eight in it has eight different people in it. Ashcombe has staff on
  the gate in hi-vis with rifles slung, and a dozen people waiting inside
  who got there first. The walk cycle, the creep, the lurch, sitting on a
  log and sitting astride a horse are all poses on the same skeleton.
- **The dark is lit, not painted.** A hemisphere light for the sky, one
  directional for the moon or the sun, a pool of eight point lights moved to
  whichever lamps are nearest her, and her torch — a shadow-casting spotlight
  with a soft-gradient cone that dust drifts through and that arrives where
  she is pointing about a tenth of a second after she does. One streetlight
  in six is on its way out and flickers like a failing tube. Every light in
  a level is scaled by how bright that location's own materials are, so
  "dark" means the same thing in the hospital as it does in the house.
- **Materials have something to reflect.** Each level renders its own sky
  into a cube at load and runs it through PMREM, so glass picks up the sky
  and the building opposite, wet tarmac picks up the streetlights, and metal
  stops looking like plastic. The road's roughness comes out of a painted map:
  the standing water in it is mirror-smooth while the aggregate around it
  stays matt.
- **Nothing snaps.** Every follower in the game — her turn, her crouch, the
  torch, the camera position, the camera's lead, its distance, its field of
  view, the doors, the fades — runs through a frame-rate-independent ease,
  and the camera itself is on critically damped springs, so it settles
  without overshoot and behaves the same at 30 fps as at 144.
- **Post**: bloom, then one pass that does the colour grade, the haze, the
  vignette, the grain, a touch of lens fringing and the red pulse when
  something has hold of her.
- **It still carries no files.** Every surface is a texture painted into an
  offscreen canvas at load, every sound is an oscillator, and the sky is a
  fragment shader. The chapter adds one script to the repo and nothing
  else — no images, no audio, and no library the site was not already
  loading.

If the machine cannot hold a frame rate the render scale drops on its own,
measured over a second and a half so one long frame never triggers it.

### The levels

| | | |
|---|---|---|
| 1 | **Home** | the news is still on downstairs; the garage door has no power |
| 2 | **The Streets** | three ways across town, and a gate code dropped in a shop |
| 3 | **The Hospital** | Ward C is dead, he is behind it, and it is getting worse |
| 4 | **The Road** | out of the building, a car that might start, and a horse |
| 5 | **The Gates** | the check, the serum, and somebody opening a gate |

Between them: the drive, the ride, the campfire, the sunrise and the roof.
All five are 3D scenes of their own with their own cameras, not slideshows.

### Changing it

Everything you are likely to want is in the first six hundred lines of
`apocalypse.js`:

- `MAPS` — the maps, as grids of characters, one per tile, with the full
  legend written above them. Edit a string and the place changes.
- `LEVELS` / `SUB` — what each place is called, how dark it is, its colour
  grade, and its list of steps.
- `PAL` — five palettes. The world builder, the lighting and the post chain
  all read from these, so changing one line changes the whole look of a
  place.
- `TALK` — the words. Every line in the game, verbatim. A line written as
  `[null, null]` is a beat of silence and is held on screen like any other
  line; those are doing as much work as the spoken ones.
- `TUNE` — how she feels to play. Distances are still written in the design's
  original pixels and converted once at the top, so the stealth reads the way
  it was tuned. Almost every complaint about a stealth game is one of these
  numbers.

### Three mechanics, built once

- **The wire panel** — a salvaged distribution board with the cover off:
  four cores out of the loom on the left, four terminals on the right, no
  labels. A wrong drop arcs, and an arc is the loudest thing she can do. It
  is the garage door and it is Ward C.
- **The note and the keypad** — a torn rota with a code biroed on it, and a
  keypad screwed to a fire door.
- **The close call** — being caught is not a death. She is taken hold of,
  she has a second and a half to answer it, and if she does not she comes
  back to the last place she was safe. Hiding places are checkpoints in
  their own right, so it costs seconds, never a level.

### The ending

The chapter hands off to the same rooftop the maze did, reworked: the city
behind it has had a week (some windows dark or broken, a bite out of a
parapet, faint smoke — nothing graphic), the two cats are drawn rather than
four PNGs, and the camera cycles between four shots instead of pushing into
one. It lives in `script.js` with the rest of the ending.

## Status

- **Needs a real file:** `assets/our-video.mp4` — the clip of the two of you
  on the last page. The song is already in.
- **Placeholder, needs real content:** `KEEPSAKE_CLOSING`
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


## The Long Way Round

Three choice points, in this order, and not one of them can be got wrong:

1. **A heart or a flower.** Decides nothing about where you go — both cards
   lead to the same screen — but it is remembered for the rest of the walk
   and it is what you are still carrying at the end.
2. **The way there, or the way back.** Spring, in the open, everything still
   ahead of you; or the same valley a year on, after dark, lit by lanterns
   somebody had to hang. Each has its own ending.
3. **The blue butterfly, or the red one.** Two routes per path, with
   different ground and different obstacles, rejoining before the ending
   that path shares.

| | blue | red |
|---|---|---|
| **the way there** | the high meadow: wrong turns, a deer, a spring shower waited out under a beech, fog that lifts | the stream bank: seven stones to get over, skimming on the flat pool, then follow the current |
| **the way back** | the ridge: an hour of climbing, the whole sky at the top, then a rope bridge one section at a time | the orchard at dusk: a bear in the windfalls, three ways past it, and a stolen apple |

### The two of them are in it

Every line in this chapter is about the pair of you walking somewhere
together, and for a long time the frame those lines were written over had
nobody in it at all — a valley, and a cat in the corner. They are drawn now:
from behind, on the ground of whatever place this is, holding hands. One
character per pixel, fourteen to a row, the same way Super Ouissy builds
her — `HV_HER_BODY`, `HV_HIM_BODY` and the four-frame leg cycles under them.
Change a string, change a person.

They are lit for where they are standing (`HV_LIGHT`): a wash the colour of
the air in that scene, and a rim on the head and shoulders from whatever the
one light source is. Without it they were two daylight sprites pasted onto a
night. `HV_STAND` says where they stand in each place — the right-hand
column, clear of the paper note, which owns the bottom third of the stage —
and a node can override it with `stand`.

### Three things to do

The writing already contained four perfectly good mechanics and all four of
them were paragraphs. Three of them are things you do now:

| | where | what |
|---|---|---|
| **the stones** | `there_stones` | seven stones, tapped one at a time as each settles. All seven clean and you are across dry; catch one rocking and you go in, which is the warmer of the two beats that were already written |
| **the bridge** | `back_bridge1`–`3` | the span sways; step when it is steady. Hurrying costs you the step and nothing else, which is the sentence the middle section was always trying to say |
| **the orchard** | `back_bear` | creep down the row while the bear's head is down, stop when it comes up. Getting it wrong is the three trees backwards that were already there |

The fourth, the fog on `there_fog`, is not a mechanic — it lifts, over about
eight seconds of standing in it, which is the only thing that beat ever
asked of her.

**These are played, not skipped.** Each of the three used to keep the
buttons it had before the mechanic existed, so you could click straight
past it — which makes a mechanic decoration. They are gone. What replaces
them as the safety net:

1. **Nothing can be failed.** Wet feet are written and warm. A mistimed
   plank simply is not taken. The bear costs three trees, in the same
   scene, with the same screen around it.
2. **The way *out* is never taken away.** Back, back-to-the-start and
   leave sit in the top bar on every frame of every one of them, and
   `tools/hvplay.js` asserts all three survive the whole of each mechanic.
   What she cannot do is walk past one without playing it; what she can
   always do is leave.
3. **One input.** Tap the canvas, or hold space.
4. **The instruction stays until she acts.** It used to fade after seven
   seconds whether or not she had worked out what to do — survivable
   while a button sat underneath it, not survivable now.

Taking the buttons away nearly cost a scene. The orchard's three buttons
led to three different pieces of writing, and a mechanic that only ever
produced two of them would have orphaned the third. So the mechanic
produces all three, and the rule it uses is one the mechanic itself
forced: "did she ever stop?" is unavailable, because the row is 172
pixels at 26 a second against a safe window of 2.9 in every 5.2 — nobody
crosses it without stopping at least twice. It counts the stopping she
did **not** have to do instead. Dawdle, and it is "so you wait, ten
minutes of standing perfectly still"; take every window you are given,
and it is the crossing where she does not waste a step. `hvplay.js` plays
it both ways and checks both scenes come out.

The cat stands aside for all three. It is a narrator in the corner, and
the stones begin on the near bank at x=62 — squarely behind where it
sits, so she could not see the pair she was steering.

The paper note covers the ground these happen on, so on these three screens
it lifts once the line has been read — or the moment she touches anything,
whichever comes first. Only the paper moves; the buttons never do.

**There is no fail state.** There used to be two — a jumpscare bear on the
left-blue route and a getting-lost screen on right-blue, both of them
full-screen overlays with a *Restart* button, both reached from an ordinary
choice. Both are gone. The one place you can be sent backwards is the
orchard, as above. That is the whole penalty.

**And no choice is an illusion.** The two buttons at the rustle in the trees
used to go to the same node — the last place in the game where it genuinely
did not matter which you pressed. Holding still and backing away now get you
two different deer. `tools/hvaudit.js` has been asserting this since the day
it was written and had been red on it the whole time.

### What the walk remembers

Four routes, two endings and ten things to find, and none of it used to be
written down anywhere: everything found evaporated on the next reload, and
the game had no way of telling her the other three ways up the valley
existed. `hv_walk` in `localStorage` now keeps what she found, which routes
she has walked and which endings she has read; the ending says what is left,
and the keepsake gets a card with the whole shelf on it.

The things themselves are one per place rather than one per route, so a
single walk passes four or five instead of exactly one — see `HV_TOKENS` for
the list and `HV_HIDDEN` for where each one lies. They are drawn once, by
`hvDrawToken`, and the strip at the top of the stage shows that same little
canvas rather than a separate SVG that has to be kept looking like it.

### The score

`ost.js`. Not a background loop — a piece of music, and the one thing in
this chapter that does the most work per line of code.

**There is one tune.** Eight notes:

```
5  6  8  7  |  5  4  3  2  |  1
```

It goes up to the octave, leans on the seventh, and walks all the way back
down to where it started. That is the title of the chapter written as a
melody, and it is the only melody in the game.

Every place plays it in different clothes. The blossom gets it on a piano,
alone, in C major. The high meadow gets it on strings, in F, wide open. The
stream turns it into water — same notes, arpeggiated, high. The wood only
plays the first four, because she does not know yet how the phrase ends.

Three places refuse it, on purpose:

- **the ridge** holds it back for a whole climb and then gives it to a choir
- **the orchard** never plays it at all; it has a pulse and a held breath,
  and the score ducks to almost nothing the moment the bear's head comes up
- **the bridge** hands it back to her *one note per plank*, so getting over
  the gorge is the tune assembling itself under her feet, and the far post
  is the first time in the chapter anyone has heard the whole of it

And the trick the whole thing is built on:

> **the lantern path is the blossom park in the relative minor.**

Same seven notes, same theme, a different note called home. *"Same place.
Completely different light"* is a line that was already in the writing, and
A minor is what that line sounds like. The way there and the way back are
not two pieces of music. They are one piece heard from two different years.
`tools/osttune.js` asserts that relationship as arithmetic so it cannot
quietly drift.

Made of: six instruments (an FM piano, three detuned saws for strings, a
vibrato'd triangle choir, a driven saw stack for brass, a bass, a pluck), one
convolution reverb whose impulse response is generated at load out of noise
under an exponential decay, and a lookahead scheduler that posts notes onto
the audio clock a quarter-second early because `setInterval` cannot keep
musical time. No files, like everything else here.

`CUES` at the top of `ost.js` is the whole score: a key, a mode, a tempo, a
chord loop and which dress the theme is wearing. Change a line and a place
changes what it sounds like.

### They talk to each other

Forty-seven nodes and not one line of dialogue: a cat narrated their entire
relationship in the second person, and you were *told* "you both laugh far
too loudly" without ever hearing either of them. A node can carry `voices`
now — **73 lines across 21 scenes** — and they arrive one at a time in a small
pixel bubble above whoever is speaking, hers edged in pink and his in blue so
you never have to be told which is which. They are short on purpose. Nobody
in this valley makes speeches.

**The conversation cannot be skipped.** A tap used to jump to the next
line, with a chevron in the bubble advertising it. Taken out on purpose:
the two of them talking is the chapter, not an obstacle in front of it,
and a skip button turns every line into something to get past.

**The choices wait for the conversation.** They used to appear the instant a
scene opened, sitting there while the two of them were still talking — so the
fastest way through the chapter was to press the button before anybody had
said anything, and every line of dialogue was optional furniture. A scene
with talking in it now holds its choices back until the talking is done. A
tap on the picture (or space, or enter) hurries a line along, so nobody is
ever made to wait; it just cannot be skipped without being seen. A small
blinking chevron in the corner of the bubble says so.

The three mechanic screens are exempt, deliberately: the rule that none of
them can ever be stuck outranks this one. `tools/hvplay.js` asserts both — that
an ordinary talking scene offers nothing to press until they have finished,
and that a mechanic screen with dialogue on it is never gated at all.

### Four more places, and one that was already painted

Each of the four routes gained a scene, so they are five or six beats each
rather than four:

| route | new beat |
|---|---|
| the high meadow | **the shower** — spring rain out of a blue sky, nine minutes under a beech, badly counted out loud |
| the stream bank | **skimming** — a pool as flat as a table, and an argument about whether that was three or four |
| the ridge | **the top** — the clearest sky either of them has seen, and three constellations he is confidently wrong about |
| the orchard | **the windfall** — he finds one with no bad side, and a short debate about whether this is stealing |

The shower happens in `HV_SCENES.hollow`, which was **painted, finished, and
then never once shown** — no node in the chapter used it. A whole place with
light coming down through it, sitting in the file unreachable. It rains there
now: three layers of streaks over the top of the finished art rather than a
repaint, with a dry column under the canopy the two of them are standing
beneath, because that is the entire point of standing there.

### Things that were not true

- **"The fox from last spring, very much bigger now"** was a lovely callback
  on the orchard route, and it was simply false on three of the four ways up
  the valley — take the meadow instead of the stream and she has never seen
  that fox. Nodes can carry `sayIfMet` / `voicesIfMet` now, keyed on a route
  or a whole path, and the game says the true one.
- **"Same valley, a year on"** likewise only lands if she has walked the
  spring side. It acknowledges the gate and the gorse if she has, and does
  not if she has not.
- **The fork greets a returning walker differently** (`sayAgain`).

### The ending sends her round again

It used to offer one button, and that button said **close the book** — a
strange thing to be told at the end of a chapter whose whole point is that
there are four ways up this valley and she has just walked one of them. The
ending now leads with **GO ROUND AGAIN**, which drops her back at the fork
with everything she has found and everywhere she has been still hers; closing
the book is the quieter second option.

Reaching an ending is also what marks the chapter done now, rather than
leaving the screen — which used to mean that anyone who read the ending and
then went round again had, as far as the hub was concerned, never finished
it at all.

### The two hard beats

Every beat on this walk used to be warm, and a story where nothing ever costs
anything is a story you watch rather than one you feel. There is one hard
beat on each side now, and each one is the reason its ending works:

- **`there_quiet`**, on the gate at the top of the meadow. She asks the real
  question a year too early and he does not answer it — he asks her to ask
  him again at the top. The letter at the sunset *is* her asking again, so
  the ending stops being a nice surprise and becomes a promise he made here
  and kept.
- **`back_year`**, on the way down the lantern path. One of them says the
  true thing about the middle of the year, the stretch that was work, and the
  other does not say anything clever back. "Would you do it all again?" is not
  a question if the year it asks about was easy.

### The two endings are no longer the same five nodes

They used to be identical in shape — envelope, open it, lean in, question,
yes — with different scenery: two paths built for a year to separate them,
arriving at the same place in the same way. The way back does something the
way there cannot now. She brought one too. He is not surprising her any more;
they had the same idea, separately, that morning, and said nothing about it
all the way up the hill and all the way back down it.

The five oldest lines in the chapter (`dark`, `sunset`, `youllsee`, `letter`,
`closer`) were also rewritten. They were in a much jollier voice than the
forty nodes that now lead into them — *"Oh look! A letter pops out of
nowhere!"* — and you could hear the join. Same beats, same choices, same
magic envelope, said the way the rest of the walk is said. **`QUEST_FINAL`
and `KEEPSAKE_CLOSING` are untouched**; those are yours.

### It has to hold a frame

`tools/hvperf.js` times `hvPaintFrame` on the heaviest scenes, because
wall-clock frame rate in a test container measures the container. Two things
it found:

- **The fog cost 7.2ms a frame** — 43% of a 60fps budget and nineteen times
  the next-heaviest scene. `blob` sets a fill colour and fills a single pixel,
  per pixel, which is right for scenery painted once into a buffer and ruinous
  every frame: three bands of five 52-pixel blobs is about 34,000 canvas calls
  a frame. Each band's puff is drawn once into its own canvas now and blitted
  five times — pixel for pixel identical, 0.25ms.
- **A scene change cost 50ms.** The chapter repainted the background on every
  move, including the many moves that stay in the same place: two nodes in the
  meadow meant painting the meadow twice. Seeding by place rather than node is
  what made caching possible, so painted scenes are kept — a revisit is a blit.

Worst scene now: the orchard, at 1.5ms, or 9% of a frame.

### The gift

The heart or the flower is the very first tap of the chapter, and for a
long time it did almost nothing: remembered, mentioned once at the gate,
listed at the end. It is a present now. After she says yes, he takes out
the one she picked — he has been carrying it since the beginning, which,
since she picked it at the beginning, is exactly true. The `gift` node is
shared between the two paths like the nudge is, so the words exist once;
`sayOfKeepsake` and `voicesOfKeepsake` choose which of them it is, and
`__yay` hands on to whichever ending she is standing in.

### The bears

Two poses of one animal, from one `bearBody` — they were two separate
blocks of drawing code that were meant to look like the same bear and had
already drifted. Three faults, all of them only visible magnified, which
is what `tools/bearzoom.js` is for:

- **The light along the back was a straight bar**, so it read as a plank
  lying on the animal. Then it was a computed curve, which ran *through*
  the body because the blobs sit above the curve. It is found by scanning
  for the topmost drawn pixel of each column now, so it is on the edge by
  construction rather than by arithmetic that has to agree with the art.
- **Two legs, not four** — the pairs were wide enough to merge into
  columns. The gaps you can see through are what make it stand up.
- **Do not fill the belly.** An ellipse slung between the legs closes
  those gaps, and the moment they go it stops being an animal and becomes
  a pile of rocks.

Scale is the other half. The one in the wood was drawn nearly as tall as
the trunk beside it, so the tree read as a twig; he is at that tree's
depth now, about a third of it. And the one in the orchard **grows as she
creeps up the row** — scaled by how far along she is, feet pinned to its
own ground line, so it gets bigger the way a thing you are walking toward
does.

Neither is composited over the scene any more. The one in the wood is
painted *into* it, before the trees, through `opts.lurker` — so the
wood's own trunks and crowns are genuinely in front of him and nothing
has to be invented to hide the joins. He is static because the writing
says he stops moving, which is what makes that possible.

### Leaving the page

Every other chapter hands its AudioContext to `registerAudio`, and
`hushAllAudio` suspends the lot when the tab is hidden or the window
loses focus. This one never did — the only thing registered was the
site's ambient pad, whose getter returns null unless that pad was built,
and it is off by default. So the air and the score played on a context
nobody was ever going to suspend.

Suspending it is necessary and not sufficient: the score's scheduler and
the ambience's bird-and-cricket chain are timers, and timers keep running
in a hidden tab. They would go on posting notes onto a stopped clock and
hand the backlog over at once on the way back. Both stop on the way out
and are re-anchored on the way in.

### The air

Every scene used to be silent — five sounds fired on button presses, and
that was the soundtrack of a walk through a valley. `HV_AIR` gives each
place one loop of noise through one filter, moved slowly: wind on the ridge,
water at the stream, and a bird every few seconds by day or a cricket after
dark. It carries no files, like everything else here, and the speaker chip
in the top bar turns it off. The preference is remembered.

### Playing it without a mouse

Arrow keys move between the choices on the screen, Enter takes one,
Backspace is the back chip, Esc leaves, and space is the one button the
three mechanics use. Every other chapter on this site could be played from
the keyboard and this one could only ever be clicked.

### Changing it

Scenes live in `HV_SCENES` and the story in `HV`, both near the bottom of
`script.js`. A node names a scene, what the cat says, and its choices; the
flags on it (`bear`, `fog`, `rain`, `drip`, `lighting`, `envelope`,
`butterflies`, `fox`, `plank`, `isAsk`, `cards`, `play`, `span`, `playTo`,
`stand`, `pair`) are what `hvPaintFrame` draws on top, and `voices` is what
the two of them say while it does.

Three sentinels can appear as a choice's `to`: `__exit` leaves the chapter,
`__again` drops her back at the fork to walk another way up, and `__ask`
returns her to whichever closing question she is standing in. Both audit
suites resolve all three to the real nodes they reach rather than excusing
them, so a sentinel that stopped going anywhere would still be caught.

Two things a node can be told to share: `sceneOfAsk` means "whichever of the
two closing questions she is standing in", and a choice going to `__ask`
returns her to it. That is there because the nudge and the really-sure
screens used to exist twice, once per path — the same four lines, duplicated
on the one screen in the game where the words matter most and where having
to change them in two places is exactly how they end up different.

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


## Ouissy's Night Shift

A night-shift survival horror, reached from the hub. Ouissy has taken
the night job at the Wick & Cogs Toy Emporium — an old wind-up toy shop,
alone from midnight to six, with two doors, a ceiling hatch, eight
cameras and one charge of power between her and four automatons that
were built to move.

Original from the ground up — the shop, the four performers, the story,
the sounds and every piece of art in it. Nothing is borrowed from any
existing game.

Nobody talks to her. There is no phone call, no radio voice, no guide.
The only thing with a voice is the building's own security annunciator,
a vocoder that reads out states and nothing else — *power at twenty
percent*, *door two: open*, *motion detected: east vent* — with the
words printed under it because a vocoder is not meant to be understood.
Everything else the shop has to say is written down and found: a shift
card taped inside the desk drawer, a page of the ledger, a workshop
board, an inscription on the underside of a music box.

**A/D or the arrow keys** shut the two doors, **W** the hatch,
**space** raises the camera monitor, **1–8** jump straight to a camera,
**Esc** pauses. On a phone the same five things are buttons along the
bottom. Drag anywhere in the office to look around.

### How a night works

Six in-game hours, about five and a half real minutes. One power meter
for the whole shift, drained by sitting there, by every second the
monitor is up, and by every second a door is held shut. At zero the
lights go out, the doors stop answering, and you wait — which you can
survive, if you were not wasteful, because six o'clock might come first.

| | | |
|---|---|---|
| **Cogsworth** | tin soldier | Marches down the main hall. You hear him coming; the marching stops when he is at your door. |
| **Chime** | clockwork owl | Lives in the ducts. Doors mean nothing to it — the hatch is the only thing that does. |
| **Marabelle** | music-box ballerina | Cannot move while she is on a camera. Can move the whole time she is not. |
| **Jax** | jack-in-the-box | Fast, and he does not leave. A shut door only makes him knock, and each knock costs power. |

Between them they close off every lazy strategy: watching one camera all
night loses to Chime, never watching loses to Marabelle, and holding
everything shut loses to Jax and the meter.

Six nights, and each one changes a rule rather than just going faster:

| | |
|---|---|
| **Two** | the owl wakes, and the workshop camera dies for good |
| **Three** | cameras drop at random, and the hall lights go out — Cogsworth has to be tracked by ear |
| **Four** | the bus surges and takes chunks off the meter, and the office bulb starts going out by itself |
| **Five** | the right-hand actuator is failing: that door is slow to answer and costs half again to hold |
| **Six** | the monitor cuts out mid-look |

The budget is set against night six, not night one. An attentive shift
on the last night — four of them awake, a door shut only while something
is actually at it — comes down to the last ten percent, and is meant to.
The same care on night one leaves a third of the meter in hand.

Night six ends the story on dawn rather than on a scoreboard: the
shutters go up, the shop is still for the first time, and the last found
object finishes the toymaker's story.

### Why she is there

The film tells her who he was. Then the shutters come down and he tells
her what she is doing, which is the part that was missing for a long
time: **six nights, and try not to let anything reach you.** Not because
surviving is the game, but because he is not handing the worst thing he
ever did to somebody who might not be there on Saturday. She agrees by
pressing one button, and after that every night is a payment against a
deal she made rather than a situation she is in.

It is scored as a clock: a tick on every beat and a brass swell that
never gets anywhere, because he is counting and she cannot stop him.

The last night answers it. Six nights with nothing laying a hand on her
reads one way; six nights with some of them getting through reads
another, and both of them are warm — getting caught costs her the clean
run and nothing else, and he says so himself the first time it happens,
in his own voice, over the game-over card.

### What she is actually doing

Night one opens in the terminal's **orientation mode** — a real thing an
old security system would have. One instruction at a time, and *the
shift stops and waits*: the clock does not run, the meter does not
drain, nothing walks. She raises the monitor, walks the cameras, shuts a
door, opens it again, latches the hatch — and then it runs one of his
four down in front of her, makes her find him on a camera, and has her
hold the key in his back until he is wound again. That last one is the
control the whole story turns on, and for a while orientation did not
teach it at all. She cannot fail any of it and she cannot fall behind
it; the clock does not move and the only thing the whole lesson costs
is the one percent that winding him costs. It runs once and never
again.

And every night there is **one thing hidden in the shop** — a brass tag,
a card, a folded letter — sitting on a surface somewhere on the eight
cameras, catching the light about as much as brass catches light. It is
not on the map and the system never mentions it. She has to go looking,
which is what turns the cameras from a threat detector into a search,
and the waiting into exploring while something hunts her. Miss it and it
stays missed; the night ends by telling her there was something she
walked past.

Where each one hides is derived rather than authored: a point along the
line that room's camera is actually looking down, dropped onto whatever
surface is under it. So it is guaranteed to be in shot and guaranteed to
be resting on something, and moving a camera later cannot silently
orphan a page.

The four tags also happen to explain exactly what their toy does, which
means **the story is the tutorial** — read them and you know the game.

### The two kinds of thing in the shop

**His four** — Cogsworth, Chime, Marabelle and Jax — are the ones he
never sold, and each is built around one thing about her. They walk to
her door every night, and for most of the game she keeps them out
because his note told her to.

**The ones he sold** start coming back on night two. Four hundred and
eleven went out of this shop into other people's houses, and the
address on every one of them is here. They are not a faster
animatronic, they are a different problem:

- **They are never seen moving.** A parcel is simply one room closer
  than it was the last time she looked.
- **They do not knock.** A shut door is a handle being tried, over and
  over, until they lose interest.
- **Watching does nothing.** They were not built for her and they do
  not care whether they are observed.
- **Nobody ever sees one.** They came back the way they were sent —
  wrapped, tied, labelled, with something pale showing through a tear
  in the corner that never resolves.

She tells them apart by ear. His four have voices: boots, wings, a
music box, bells. These have paper, string and a weight settling.
There is no melody anywhere in them.

### Winding, and what the four are for

His note says wind the four every night, and that is the mechanic. Each
carries a key; find one on a camera and hold it for a second and a bit.
Let one run down and **it stops obeying its own tag** — a wound
Marabelle freezes when she is watched, a slack one does not, and every
slack one moves faster and gives up on a shut door far more slowly.

And then the thing the whole story turns on. When one of the ones he
sold gets through an open door, **if any of his four is still wound,
one of his gets there first.** The returner leaves. The one that
stepped in is spent, and will not do it again until she winds it.

His four are her lives. His instruction is what buys them. Nothing in
the game says so until the first time it happens.

### The story, and why she is in it rather than watching it

Anwar made toys that watched. Sold into four hundred and eleven houses,
they saw everything, and what they saw came back to him and he sold it.
That is where the money in their marriage came from, for fifteen years,
and she never asked.

The turn the whole thing rests on is not that he was a criminal. It is
**how he learned to build a thing that watches a person.** He did not
practise on strangers. There is a notebook behind a loose board with
fifteen years of dated observations in it, and every line is about his
wife — how she checks a door twice, how she hums when she thinks he is
asleep, how she stops dancing the moment she is looked at, how she will
not leave a room he is in.

Every trait he wrote down is a mechanic in one of the four toys hunting
her. The attention she thought was love was also fieldwork.

And then the second turn, which is why it is a love story: the four are
the **only** things he made and never sold. There is a drawing pinned
inside the workshop door, dated the week he was told he was dying —
four figures around a woman at a desk, and every one of them facing
away from her, at the doors. He spent fifteen years learning her so he
could sell it, and the last two learning her so he could leave
something behind that knew how to stand in front of her.

**She was passive, and that was the flaw.** Things were revealed to
her; she read them and survived and then answered one binary question
at the end. A coin at the end of six hours is a menu, not an ending.

So every night she finds one thing of his and decides: **keep it, or
burn it.** Six small decisions, no right answer, and nothing ever tells
her they count. They nudge the shift while she plays — keeping slows
the four running down, burning slows the ones he sold coming back — and
on the last morning the ending is worked out from all six. She has been
writing it all week without being asked to.

Five endings, and the one that means the most is not the one where she
keeps everything: it is the one where she **burns the business and
keeps the toys** — the addresses, the ledger and the notebook gone, and
four things he made out of her still standing in the back room.

The last thing the chapter says is not narration. It is his final entry,
dated the day he was told:

> *"She will find all of this. She will hate me for a while, and she
> will be right. Then she will do the thing she always does, which is
> stay anyway. I am counting on that and I have no right to."*

### Six nights, six experiences

Each night has a name, a look and one thing it tells her about him, in
the middle of the shift rather than either side of it.

| | | |
|---|---|---|
| **One** | THE INVENTORY | a second key, taped under the drawer. He never gave her a key to anything in fifteen years. |
| **Two** | THE FOUR HE KEPT | four names chalked on the bench, and one word under all of them. |
| **Three** | FOUR HUNDRED AND ELEVEN | the delivery book. Eleven of the RETURNED boxes are ticked, in a pen that is not his. |
| **Four** | WHAT THEY WERE FOR | a notebook behind a loose board. Fifteen years of one-line entries, every one of them about her. |
| **Five** | LET IT | a drawing on graph paper: four figures around a woman at a desk, all of them facing outward. |
| **Six** | THE SHUTTERS GO UP AT SIX | the last thing he wrote, folded under the comb of the music box. |

And the shop goes with them. Night one is warm and lit; by night six it
is nearly ash, with the dark two-thirds of the way in from the corners.

### The drawer

Every night she finds one thing and decides. **THE DRAWER** — on the
title screen and in the pause menu — is what she is carrying: each of
the six named, where it came from, and whether she kept it or burned
it, in her own words. The ones she has not reached yet say so without
saying what they are.

### The last hour

At five on the sixth night the cameras go and do not come back. She has
spent six nights learning to tell them apart by ear — boots, wings, a
music box, bells, and the paper and string that is not one of his — and
the last hour is the exam nobody set. It is the only thing in the
chapter that is taken away for good, and it is the right one: the
monitor has been standing between her and the shop all week, and the
last thing the story does is remove it.

### The things the pages describe are in the rooms

Two of the six hidden pages are about the pair of them rather than
about the business, and both of them describe an object. **The other
chair** is a folding chair in the supply closet, turned to the little
bench at the angle somebody sits at when they are being talked to
rather than working, with the chipped mug from their kitchen standing
on the arm of it — she has never set foot in this shop, and he put that
chair out the week he took the lease and never once folded it away.
**The fifth one** is a shape under a dust sheet at the back of the
stage, with one hand out from under the hem and a tag wired to the
wrist that does not say NOT FOR SALE.

Both of them are modelled. So is the brass plate on the front of her
desk that his first-night tape points at. A page that describes a chair
in a room with no chair in it is the shop lying to her.

### And in daylight

The walk-through opens on the office, and the four of them are standing
in it exactly as the night-five drawing has them: round the desk,
facing outward, with nobody in the chair. The gallery names it when she
gets there, because it is the one payoff she could walk straight past.

### Camera zero

The one room in the shop that had no camera on it was the room she is
sitting in. Everything frightening happened somewhere else, to a figure
walking a route, and arrived as a number going down.

There is a camera on the desk now — the ceiling directly behind her
chair, looking the way she is looking. From the third night there is
sometimes something standing in it. It never touches her, it cannot
cost her anything, and it is not on anybody's route. It is simply one
mark closer every time she looks away, walking up the room toward the
back of her chair, and then it is not there at all.

### The score

One piece of music, ten rooms to play it in, and it never cuts — the
grid never restarts and the tempo eases rather than snapping, so a
scene becomes the next one without a join anywhere. But they are cues
rather than fader positions: eleven instruments, and each scene has
material of its own.

| | |
|---|---|
| **the terms** | a clock and a swell. Nothing resolves. |
| **the minute before a night** | the same clock, and a heartbeat under it |
| **the shift** | six layers arriving in order as dread climbs, ahead of anything visible |
| **the meter going out** | the heartbeat *stops*. A choir on one note and no melody at all |
| **after a death** | a piano, alone, remembering the phrase rather than playing it |
| **a page in her hands** | the phrase in the major, in thirds — the first time two notes agree |
| **one of his getting there first** | piano an octave up, choir underneath. The one place it is allowed to be enormous |
| **six o'clock** | the major phrase finally resolved, with the last note left ringing |

### The six pages

They start as a stranger's. An old toymaker, four automatons, a woman
who did not come back; and each tag carries a place, described rather
than named. On the fourth, a second hand answers him in newer ink. By
the fifth it is not his shop any more. The sixth is signed.

The last night ends on the only choice in the chapter: **wind the music
box, or leave it**. Two endings, both warm, one bittersweet.

### Behind the story

Finishing it opens four things on the title screen. **Custom Night** —
a slider from 0 to 20 for each of the four, so any combination can be
asked for. **The shop in daylight** — a calm walk-through of all nine
rooms in the morning, nothing running, nothing going to move, which is
where the one warm personal thing in the chapter lives. **The record** —
which nights are cleared and eight badges — two of them for looking
after his four rather than for surviving — each of which puts one more
small object on the shelf beside the desk. And **Cozy Mode**, on the
title screen from the start, which is not a lesser version: gentler
jumpscares, a slower meter, fewer alarms and more time at a door.

There is one thing not listed anywhere, in the arcade.

### Changing it

The first three hundred lines of `night-shift.js`, in this order:

- `NS` — every word in it: the shift card that opens night one, the
  found pages between nights, the finale, the how-to card, the badges,
  the ratings, and the whole vocabulary the annunciator is allowed.
- `TUNE` — how the night feels. Seconds per hour, every power rate, and
  a step interval, a movement chance and a door grace per performer.
  Almost every complaint about a game like this is one of these numbers.
- `NIGHTS` — one entry per night: who is awake and from which hour, the
  aggression multiplier for each of the six hours, and any hazards.
  Adding a seventh night is adding an entry; nothing else counts them.
- `ROOMS` — the nine rooms and how they join up, on the floor and in the
  ducts. `MAP_PLAN` is the plan drawn on the monitor.
- `CAST` — the four performers and the route each walks to the office.

### How the 3D is built

Three.js, on the copy in `vendor/` that the book intro already uses. The
racing chapter is **not** Three.js — it is a hand-written Mode 7 scanline
renderer — so there was nothing there to share; this is a clean parallel
setup, written generically (texture library, prop kit, light rig, contact
shadows) so it is tooling rather than a one-off.

Four rules are enforced in code rather than by care, because all four
were problems on the racer:

- `slab()` is the only box builder and it has a minimum thickness, so a
  flat cutout cannot be built by accident.
- `place()` is the only way a prop enters a room, and it lays a contact
  shadow sized to that prop's own footprint. Nothing floats.
- a room is composed once in its own space, parked at its own address
  sixty metres from its neighbours, and then frozen — matrices off, world
  matrices off. The frame loop has no handle on a static prop at all.
- anything that appears twice has a variant kit (four shelves, four
  arcade cabinets, three chairs, three crates, six toys, five wall
  fittings, four grates) and `place()` varies rotation and scale on top.

Nine rooms cost between 1 and 3 milliseconds of CPU a frame and between
160 and 460 draw calls, and the whole shop builds in about six hundred
milliseconds — which is long enough to notice, so entering the chapter
puts a card up and waits a frame before it starts.

It carries no files of its own. Every surface — planks, lino, brick,
galvanised duct, velvet, carpet, plaster, wallpaper, concrete, brass,
porcelain, harlequin diamonds, the night outside the window, the standby
screen on the desk monitor — is painted into a canvas at boot, and every
sound is synthesised.

### The score

There is no soundtrack file and no loop. There is one continuous piece
of music that never restarts, and six layers of it that fade in and out:

| | arrives at | what it is |
|---|---|---|
| **sub** | always | a 41Hz floor you feel rather than hear |
| **pulse** | dread 0.10 | a heartbeat — 46bpm at rest, 104 at a door |
| **box** | 0.20 | a music box playing the shop's own unfinished figure |
| **air** | 0.28 | breath, up where a room's silence lives |
| **grind** | 0.44 | a minor second held against the root |
| **bow** | 0.60 | the top string, bowed and shaking |

`dread` is built from things the player cannot see yet — chiefly how far
along its route each awake performer is, squared so the last two rooms
count for more than the first four. Because that climbs while something
is still three rooms away, **the pulse quickens before there is anything
on any camera to look at**. It rises fast and lets go slowly, so a room
does not feel safe the instant a door shuts. The whole grid — heartbeat,
music box, strings — runs off one sixteenth-note clock whose tempo is
`dread`, and everything is scheduled ahead of the audio clock rather
than on the frame, so a dropped frame moves nothing.

The menu has its own theme: the same music box in the major key it was
written in, played slowly, transposing every fourth pass and picking up
an answering voice a fifth above on every other one, so a long sit on
the title screen never becomes a loop. Six o'clock switches to a third,
warmer mode. A death cuts the music dead — the silence is half of what
makes the scare land.
