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
index.html      every screen is a <section class="screen">
style.css       one :root theme block drives the whole palette
script.js       screen flow, the maze, the choice adventure, ambient pad
book-scene.js   the Three.js opening — self-contained, leave it alone
scrapbook.js    the memory book: config at the top, then art, pages, turning
vendor/         three.js r180, bundled
assets/         photos, song.mp3, and the 2D art the maze/adventure use
```

Flow: 3D book intro → passcode → **the memory book** → hub → two chapters
(the maze, the choice adventure) → keepsake.

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

## 8. Testing

Chromium is at `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`; python
playwright is installed. Serve with `python3 -m http.server 8899`. Google
Fonts is blocked by the egress proxy, so navigate with
`wait_until="domcontentloaded"` and abort non-localhost requests, or the page
never fires load.

Always check: no page errors, no horizontal scroll, and **an iPhone
viewport** — he has said repeatedly that iPhone and iPad matter. The book
shows one page at a time in portrait and a spread in landscape.
