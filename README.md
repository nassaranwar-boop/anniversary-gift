# Anniversary gift site

A single-page interactive gift. Open `index.html` in a browser, or push this
folder to a GitHub repo and enable GitHub Pages (Settings → Pages → deploy from
branch → main → /root).

**Passcode to enter the site: 2207**

## Files

```
index.html      page structure (all screens are <section class="screen">)
style.css       all styling
script.js       all site logic + content config (EDIT CONTENT HERE)
book-scene.js   the Three.js 3D intro scene — self-contained
assets/         images used by the 2D parts of the site
```

## Screen flow

1. **3D book intro** (`book-scene.js`) — click to trigger; ends by calling
   `window.finishBookIntro()`
2. **Passcode gate** — 2207
3. **Letter** — handwritten-style reveal, word by word
4. **Memory menu** -> **memory detail** (zoom-in transition, burn-away exit)
5. **"Do you want to play a game?"** cover
6. **Maze level 1** -> **level 2** (monsters, watchers, trees, meds, key)
7. **Chapter divider** -> **pixel-art cats night-sky ending**

## Where to edit content

Top of `script.js`, in clearly marked CONFIG blocks:

- `GATE_CODE` — the passcode
- `LETTER_TEXT` — the letter (currently placeholder — replace it)
- `MEMORIES` — array, one object per memory. To add one, copy an existing
  object and set `title` / `date` / `text`, drop a photo in `assets/` and point
  `photo:` at it, e.g. `photo: "assets/memory-2.jpg"`
- `CONFIG` (further down) — maze game text, her name, the reward line, the
  in-maze love notes

## Status

- **Placeholder, needs real content:** `LETTER_TEXT`, and the single entry in
  `MEMORIES` (its `photo` is `null`, so it shows an icon until a real image is
  added)
- **Needs rebuilding:** `book-scene.js` — the 3D intro is under-built. It lacks
  tone mapping, bloom, environment reflections, depth of field, volumetrics,
  and proper page geometry. This is the main work item.
- **Working, leave alone:** everything from the passcode gate onward.

## Integration hooks (do not rename)

`book-scene.js` communicates with the rest of the site through exactly two
globals:

- `window.finishBookIntro()` — defined in `script.js`; the 3D scene calls it
  when the climax flash begins, to hand off to the passcode gate
- `window.skipBookIntro()` — defined in `book-scene.js`; `script.js` calls it
  when the user presses Skip, to halt the render loop
