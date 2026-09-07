
/* =========================================================
   ANCIENT BOOK — CUSTOMIZE ME
   ========================================================= */
const GATE_CODE = "2207";

// Add one object per memory. photo/video are optional — leave null
// to show the icon instead until you add real files to /assets.
const MEMORIES = [
  {
    id: 1,
    title: "[Memory title here]",
    date: "[date]",
    icon: "px-camera",
    photo: null, // e.g. "assets/memory-1.jpg"
    text: "[This is where your words about this memory will appear — replace this placeholder with what you want to say about it.]",
  },
];
/* ========================================================= */

/* The two cats on the roof are the only sprites the site still loads as
   files; everything else it draws. */
const ASSETS = {
  blackBody:"assets/black_body.png", blackTail:"assets/black_tail.png",
  whiteBody:"assets/white_body.png", whiteTail:"assets/white_tail.png",
};
/* They ship their src in the markup too, so the cats are on the roof from
   the first paint even if this script never runs. This only keeps ASSETS
   as the one place a path is written: it re-points each <img> at the same
   file, and a missing element is skipped rather than throwing and taking
   the rest of the wiring down with it. */
[["cat-black-body", ASSETS.blackBody],
 ["cat-black-tail", ASSETS.blackTail],
 ["cat-white-body", ASSETS.whiteBody],
 ["cat-white-tail", ASSETS.whiteTail]].forEach(function (pair) {
  const el = document.getElementById(pair[0]);
  if (el && pair[1]) el.src = pair[1];
});


/* ---------- screen manager ---------- */
function showScreen(name) {
  document.querySelectorAll(".screen").forEach((s) => { s.classList.remove("active","anim-in","page-turning","opening","zoom-out","zoom-in-enter"); });
  const el = document.getElementById("screen-" + name);
  el.classList.add("active");
  void el.offsetWidth;
  el.classList.add("anim-in");
}
/* premium dissolve transition used for all screen navigation */
function pageTurn(name, callback) {
  const current = document.querySelector(".screen.active");
  if (!current) { showScreen(name); if (callback) callback(); return; }
  current.classList.add("page-turning");
  setTimeout(() => { showScreen(name); if (callback) callback(); }, 420);
}

/* ---------------------------------------------------------
   THE CHAPTERS ARE FETCHED WHEN THERE IS NOTHING ELSE TO DO

   The three games are the three biggest files in the site — a little
   under 900 KB between them — and not one of them is needed to draw the
   opening. She has the 3D book, the passcode and ten pages of the
   scrapbook ahead of her before a chapter can even be chosen, which is
   minutes; loading them with the page only meant the phone spent its
   first second parsing a platformer instead of painting.

   So they come down on the idle callback after the page has settled.
   By the time the hub appears they have long since arrived, and if she
   somehow beats them there, start() waits for the file rather than
   silently doing nothing — which is what the old `if (window.X)` guard
   did, and it would have been a dead card.

   The ?v= is read off this script's own tag, so bumping the version in
   index.html carries here without anyone having to remember to.
   --------------------------------------------------------- */
const ASSET_V = (() => {
  const me = document.currentScript ||
             document.querySelector('script[src*="script.js"]');
  const m = me && me.src && me.src.match(/\?v=[\w.]+/);
  return m ? m[0] : "";
})();

const _loaded = Object.create(null);
function loadScript(src) {
  if (_loaded[src]) return _loaded[src];
  _loaded[src] = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    /* async=false keeps two files requested together running in the order
       they were asked for — super-ouissy.js reads Rescue as it starts. */
    s.async = false;
    s.onload = resolve;
    s.onerror = () => { delete _loaded[src]; reject(new Error("could not load " + src)); };
    s.src = src + ASSET_V;
    document.head.appendChild(s);
  });
  return _loaded[src];
}

/* rescue.js carries the platformer's story scenes, so the two travel
   together and in that order. */
const CHAPTER_FILES = {
  ouissy: ["rescue.js", "super-ouissy.js"],
  apoc:   ["apocalypse.js"],
  race:   ["racing.js"],
  /* The adventure itself lives in this file, but its score does not:
     ost.js is 28KB of music that is no use until she walks into the
     valley, so it comes down the same road as the chapters rather than
     in the opening payload. */
  quest:  ["ost.js"],
  /* the night shift is the biggest of the lot and needs THREE, which the
     deferred bundle in the head has already run by the time anything
     asks for this */
  nightshift: ["night-shift.js"],
};
function loadChapter(name) {
  return Promise.all((CHAPTER_FILES[name] || []).map(loadScript));
}
/* The chapters are no longer script tags in the head, so a global like
   SuperOuissyRace does not exist until something asks for it. The site
   always asks (every start* below goes through here first); the harnesses
   need the same door rather than a guess at how long the idle prefetch
   takes. */
window.loadChapter = loadChapter;
/* The night shift is the largest file in the site by a distance, so the
   three smaller chapters go down first and it follows once they are
   done. It still arrives long before the hub, and the click waits for it
   either way, so nothing is lost by not racing it against the passcode.

   Honesty about why this is here: it was written to fix `gatefit.js`
   failing to open the book on an iPad held sideways — and it did not,
   because that failure turns out to be an intermittent flake on main
   with no night shift in it at all. Running the suite once said the
   merge had broken it; running it three times said otherwise. The
   staggering stays because it is right on its own terms, not because it
   fixed anything. */
function prefetchChapters() {
  const first = Object.keys(CHAPTER_FILES).filter((k) => k !== "nightshift");
  Promise.all(first.map((k) => loadChapter(k).catch(() => {})))
    .then(() => loadChapter("nightshift").catch(() => {}));
}
if (typeof requestIdleCallback === "function") {
  requestIdleCallback(prefetchChapters, { timeout: 4000 });
} else {
  addEventListener("load", () => setTimeout(prefetchChapters, 1200));
}

/* ---------------------------------------------------------
   THE REAL HEIGHT OF THE VIEWPORT

   Safari is right, Chrome for iOS is wrong, Brave is wrong differently.
   All three are WebKit, so the fault is not the rendering — it is the
   box each app hands the page. Chrome lays its web view over the whole
   screen, draws its toolbar on top and pushes the page down with a
   content inset, so the page is handed a box taller than the part of it
   anybody can see.

   Three passes were spent asking which API reports the honest height.
   That was the wrong question, because the answer differs per browser
   and there is no way to know from in here which one is lying.

   So this does not ask. It MEASURES THE HIDDEN STRIP DIRECTLY.

   Try to scroll the document as far as it will go. On a browser that
   handed us the visible box there is nowhere to go and the answer is
   zero. On one that handed us a box with a strip hidden behind its own
   furniture, the distance it moves IS that strip, in pixels, whatever
   the browser says about it. Then subtract it and put the scroll back.
   The whole probe is one synchronous block, so no frame is ever painted
   with the page scrolled and there is nothing to see.

   It is self-terminating: once the document is the height of the
   visible area, the scroll range collapses to nothing and the next
   probe reads zero. That is also the check — if the probe still reports
   a strip after the height has been applied, the height is still wrong.
   --------------------------------------------------------- */
const VV = window.visualViewport || null;

/* How far the document can be dragged — which is how much of the box we
   were given is not on screen. Set and restore inside one task so the
   scrolled state never reaches a frame. */
function hiddenStrip() {
  const el = document.scrollingElement || document.documentElement;
  try {
    const was = el.scrollTop;
    el.scrollTop = 1e6;
    const reach = Math.round(el.scrollTop);
    el.scrollTop = was;
    /* Guard against a page that is genuinely long for some other reason;
       nothing here should ever need more than a browser toolbar's worth. */
    return (reach > 0 && reach < 400) ? reach : 0;
  } catch (e) { return 0; }
}

/* What the browser claims, before the strip is taken off it. */
/* The smallest of everything on offer, not a favourite.

   Every API here reports the same number on a browser that is being
   straight with the page. On one that is not, they disagree, and the
   smaller figure is the one that cannot be hiding anything: no browser
   under-reports the space it gives you. Taking the minimum means one
   honest API is enough, whichever one it turns out to be — which is the
   part that could not be settled by reasoning from here.

   documentElement.clientHeight is the viewport height by definition for
   the root element, so pinning html does not feed our own answer back to
   us. */
function claimedHeight() {
  const say = claims();
  if (!say.length) return 0;
  return Math.min.apply(null, say);
}
/* and the biggest, which is what the page tries to grow back to */
function claimedMost() {
  const say = claims();
  if (!say.length) return 0;
  return Math.max.apply(null, say);
}
function claims() {
  const say = [];
  if (VV && VV.height > 0) {
    const scale = (VV.scale && VV.scale > 0) ? VV.scale : 1;
    say.push(Math.round(VV.height * scale));   // pinch-invariant
  }
  const ch = document.documentElement.clientHeight;
  if (ch > 0) say.push(ch);
  if (window.innerHeight > 0) say.push(Math.round(window.innerHeight));
  return say;
}

function claimedTop() {
  if (!VV) return 0;
  const scale = (VV.scale && VV.scale > 0) ? VV.scale : 1;
  /* Once she has actually pinched in, following the visual viewport would
     glue the site to her fingers and she could never pan to look at
     anything. Only honour the offset at rest. */
  if (scale > 1.02) return 0;
  const top = Math.round(VV.offsetTop || 0);
  /* AND ONLY IF IT DESCRIBES SOMETHING THAT COULD BE TRUE. An offset says
     the visible area starts that far down the box we were handed — so the
     offset plus the visible height has to fit inside that box. A viewport
     claiming to be the full height of the window AND to start 38 pixels
     down it is describing nothing; honouring it pushes the page down by
     38 and hangs the last 38 off the bottom. It happens for a frame or
     two after a pinch is let go of, and it is the one shape of this bug
     that puts the empty strip at the top instead. */
  if (top > 0 && Math.round(VV.height * scale) + top > claimedMost() + 1) return 0;
  return top;
}

let appH = 0;
/* Remembered between probes: a browser that insets keeps doing it, and a
   probe taken mid-gesture can read zero when it should not. Reset on
   rotation, because the furniture can be a different size sideways. */
let knownStrip = 0;

/* Which of the two claims we are laying out against. The smallest is
   where every session starts, because a first frame that is too tall is
   the fault this whole section exists for. tryTaller below is what earns
   the right to use the largest. */
let useMost = false;

function writeVars() {
  const claimed = useMost ? claimedMost() : claimedHeight();
  if (claimed <= 0) return false;
  const h = Math.max(240, claimed - knownStrip);
  const top = claimedTop();

  /* Compared against what the document is actually carrying, not against a
     variable in here. A cached number can agree with the measurement while
     the page has drifted to something else entirely — a stale dvh, an
     interrupted write — and that is precisely the moment we would skip.

     A pixel of slack, because a pinch reports a height that rounds a
     little differently frame to frame, and re-laying the site out under
     her fingers over one pixel is worse than the pixel. */
  const root = document.documentElement;
  const curH = parseFloat(root.style.getPropertyValue("--app-h"));
  const curT = parseFloat(root.style.getPropertyValue("--app-top"));
  if (curH === curH && Math.abs(curH - h) <= 1 &&
      curT === curT && Math.abs(curT - top) <= 1) return false;

  appH = h;
  root.style.setProperty("--app-h", h + "px");
  root.style.setProperty("--app-top", top + "px");
  /* Anything that renders into a box of its own — the 3D scenes — asks
     for this rather than reading the window, so tell them the box moved.
     A plain resize event is not enough: iPad does not always fire one. */
  window.dispatchEvent(new CustomEvent("app-viewport"));
  return true;
}

/* THE PROBE CHECKS ITSELF, and this is what makes it safe to act on.

   A strip that is the browser's own furniture disappears once the
   document is shortened by it: the scroll range is content + inset −
   window, so taking the inset off the content takes the range to zero.
   A strip that is really just something on the page being too tall does
   NOT disappear — shortening the shell does not shorten that element.

   So: apply the candidate, look again next frame, and keep it only if it
   is gone. A one-off bad reading during load can shrink the site for a
   single frame and never for two. */
let verifying = false;

function learnStrip(candidate) {
  if (candidate <= 2 || candidate >= 400 || candidate <= knownStrip) return;
  /* already tried, already disproved: trying it again every probe is a
     page that shrinks and springs back for as long as she has it open */
  if (candidate === refusedStrip) return;
  const previous = knownStrip;
  knownStrip = candidate;
  writeVars();
  if (verifying) return;
  verifying = true;
  requestAnimationFrame(function () {
    verifying = false;
    if (hiddenStrip() > 2) {      // shortening did not absorb it
      refusedStrip = candidate;   // so it was never the browser's furniture
      knownStrip = previous;
      writeVars();
    }
  });
}

/* GIVING THE HEIGHT BACK.

   Everything above this point can only make the page shorter. It takes
   the smallest height anybody claims, and then it takes off whatever the
   probe finds hidden — and neither subtraction is ever undone. That is
   safe against the fault it was written for and it is the whole of a
   second one: any browser whose toolbar collapses after the page loads,
   or that under-reports through one API and not the others, leaves the
   site permanently short of the glass. What you see is a slice of bare
   background along the bottom that never goes away.

   The measurement that can settle it is the one already here. A box that
   is too tall has somewhere to scroll to; a box that is exactly the
   visible area has nowhere. So: when there is nothing hidden and there is
   height on offer we are not using, take it, look again next frame, and
   put it back if a hidden strip appears — the same trade learnStrip makes
   in the other direction, on the same evidence.

   A refusal is remembered, so a browser that really is insetting is asked
   once rather than on every probe — but only until something happens that
   could have moved the furniture. A resize IS a toolbar appearing or
   collapsing; so is coming back to the tab, and so is turning the device
   over. Each of those forgets the refusal and lets the page ask again.
   Remembering for ever would be the same bug in a new place: a toolbar
   that collapses after the first refusal would leave the site short for
   the rest of the session. */
let growVerifying = false;
/* the height that was asked for and refused, and the strip that was tried
   and turned out not to be furniture — both held only until something
   happens that could have changed the answer */
let refusedMost = 0;
let refusedStrip = 0;

function forgetRefusal() { refusedMost = 0; refusedStrip = 0; }

function tryTaller() {
  if (growVerifying || verifying) return;
  const most = claimedMost();
  if (most <= 0 || most === refusedMost) return;
  if (!(most > appH + 1)) return;          /* already as tall as it gets */
  if (hiddenStrip() > 2) return;           /* something IS hidden: not now */

  const wasMost = useMost, wasKnown = knownStrip, wasH = appH;
  useMost = true;
  knownStrip = 0;
  if (!writeVars()) { useMost = wasMost; knownStrip = wasKnown; return; }

  growVerifying = true;
  requestAnimationFrame(function () {
    growVerifying = false;
    const back = hiddenStrip();
    if (back > 2) {
      /* the room was never ours: give it straight back, and remember not
         to ask again until the claim itself changes */
      refusedMost = most;
      useMost = wasMost;
      knownStrip = wasKnown;
      appH = wasH;
      writeVars();
    }
  });
}

function fitViewport(reprobe) {
  /* The on-screen keyboard shrinks the visual viewport too, and it is not
     the browser's UI — re-laying the whole site out around the keyboard
     is worse than any gap. Hold the last good value while a field has
     focus; focusout re-measures. */
  const ae = document.activeElement;
  if (ae && /^(input|textarea|select)$/i.test(ae.tagName)) return;
  if (reprobe !== false) learnStrip(hiddenStrip());
  writeVars();
  if (reprobe !== false) tryTaller();
}

/* Exposed so viewport-report.html and tools/vh.js can read the same
   numbers the site is using rather than a re-implementation of them. */
window.__viewport = function () {
  return { claimed: claimedHeight(), most: claimedMost(), strip: hiddenStrip(),
           known: knownStrip, using: useMost ? "most" : "least",
           refused: refusedMost, refusedStrip: refusedStrip,
           top: claimedTop(), appH: appH };
};

/* iOS reports the size it had a moment ago for a few frames after a
   resume or a rotation, so one measurement at the moment of the event is
   not enough — take a short burst and let the change guard above throw
   away the ones that agree. */
function fitViewportSoon() {
  fitViewport();
  [60, 180, 400, 900].forEach((ms) => setTimeout(fitViewport, ms));
}

fitViewport();
/* and again after first layout, when the document finally has a height
   for the probe to push against */
requestAnimationFrame(fitViewport);
addEventListener("load", fitViewportSoon);

addEventListener("resize", () => { forgetRefusal(); fitViewport(); });
addEventListener("orientationchange", () => {
  knownStrip = 0;              // the furniture can be a different size sideways
  forgetRefusal();             // and so can the answer to "is there any more?"
  useMost = false;
  fitViewportSoon();
});
/* The three that cover coming back to the tab: pageshow fires on a
   back-forward-cache restore, visibilitychange on the app switcher, focus
   on returning to the window. Between them nothing gets in without a
   fresh measurement. */
addEventListener("pageshow", () => { forgetRefusal(); fitViewportSoon(); });
addEventListener("focus", () => { forgetRefusal(); fitViewportSoon(); });
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) { forgetRefusal(); fitViewportSoon(); }
});
document.addEventListener("focusout", () => setTimeout(fitViewport, 60));
if (VV) {
  /* scroll, not just resize: the offset between the visible area and the
     box the browser handed us changes as the page is dragged, and on
     Chrome for iOS that drag is the whole fault. */
  VV.addEventListener("resize", () => { forgetRefusal(); fitViewport(); });
  VV.addEventListener("scroll", () => fitViewport(false));
}

/* If anything does get the document scrolled, that distance is the strip
   we have not accounted for yet. Learn from it, undo it, and re-lay out —
   so the very first drag she makes teaches the page its own height even
   if every probe before it came back empty. */
addEventListener("scroll", function () {
  const el = document.scrollingElement || document.documentElement;
  const y = Math.round(window.scrollY || el.scrollTop || 0);
  if (y > 0) {
    learnStrip(y);
    el.scrollTop = 0;
  }
  if (el.scrollLeft) el.scrollLeft = 0;
}, { passive: true });

/* ---------- ambient particles ---------- */
/* The drifting decorations used to be emoji, which meant they were a
   different picture on every device, at a different weight, in colours
   that had nothing to do with the palette. These are drawn, and they take
   a tint, so a field of them reads as one thing. */

document.getElementById("btn-replay").addEventListener("click", () => {
  try {
    if (window.Apocalypse && window.Apocalypse.afterTheme) window.Apocalypse.afterTheme(false);
  } catch (e) {}
  if (bothChaptersDone()) pageTurn("keepsake", startKeepsake);
  else pageTurn("hub", startHub);
});

/* =========================================================
   ENDING SCENE — cinematic cuts between shots (no zoom)
   ========================================================= */
let endTimer1 = null, endTimer2 = null;


function setScene(n) {
  const sky = document.getElementById("night-sky");
  sky.classList.remove("scene-1","scene-2","scene-3");
  sky.classList.add("scene-"+n);
}
function cutToScene(n) {
  const flash = document.getElementById("scene-cut-flash");
  flash.classList.add("active");
  setTimeout(() => {
    setScene(n);
    if (n >= 2) document.querySelectorAll(".cat-slot").forEach(s => s.classList.add("lean"));
    requestAnimationFrame(() => flash.classList.remove("active"));
  }, 380);
}

/* A seeded random, so a painted scene comes out the same every time it is
   painted. It lived in the maze's tile art and outlived it: the rooftop
   night is painted with it too. */
function mzRnd(seed) {
  let x = Math.sin(seed * 3571 + 1013) * 65536;
  return () => { x = Math.sin(x * 3571 + 1013) * 65536; return x - Math.floor(x); };
}

/* =========================================================
   THE ENDING — a painted rooftop night

   The old ending was a flat CSS gradient, a row of plain divs for the
   skyline and two blocks for the roof. It is now painted with the same
   pixel engine as the adventure, so the last thing she sees belongs to
   the same world as everything before it: a dithered night sky, a moon
   with real craters and a halo, three depths of city with windows that
   blink, a rooftop with aerials and a water tower and string lights,
   and the two cats sitting on the ledge under all of it.
   ========================================================= */

const NIGHT_W = 320, NIGHT_H = 180;
let nightCanvas = null, nightCtx = null, nightBase = null, nightBaseCtx = null;
let nightRaf = null, nightT0 = 0, nightWindows = [], nightShoot = null;

function nightEnsure() {
  if (nightCanvas) return true;
  const inner = document.getElementById("night-sky-inner");
  if (!inner) return false;
  nightCanvas = document.createElement("canvas");
  nightCanvas.id = "night-canvas";
  nightCanvas.width = NIGHT_W; nightCanvas.height = NIGHT_H;
  inner.insertBefore(nightCanvas, inner.firstChild);
  nightCtx = nightCanvas.getContext("2d");
  nightCtx.imageSmoothingEnabled = false;

  nightBase = document.createElement("canvas");
  nightBase.width = NIGHT_W; nightBase.height = NIGHT_H;
  nightBaseCtx = nightBase.getContext("2d");
  nightBaseCtx.imageSmoothingEnabled = false;
  return true;
}

/* One building, with a lit window grid we can blink later.

   `hurt` is how badly this one came out of the week: at 0 it is the
   building it always was, and as it climbs its windows go dark, some of
   them go black and broken instead of merely unlit, its parapet loses a
   bite out of one corner, and it may be quietly smoking. Nothing here is
   graphic and nothing is on fire. It is a skyline with some of the lights
   off in it, which is what she would actually be looking at. */
function nightBuilding(ctx, x, w, topY, tones, rnd, depth, collect, hurt, smoke) {
  const baseY = NIGHT_H;
  hurt = hurt || 0;
  px(ctx, x, topY, w, baseY - topY, tones[1]);
  px(ctx, x, topY, w, 1, tones[0]);                    // moonlit parapet
  px(ctx, x + w - 1, topY, 1, baseY - topY, tones[2]); // shaded side

  /* a bite out of the top corner, on the worst of them */
  if (hurt > 0.46 && rnd() > 0.4) {
    const bw = 2 + Math.floor(rnd() * (w / 3));
    const bh = 2 + Math.floor(rnd() * 4);
    const bx = rnd() > 0.5 ? x : x + w - bw;
    for (let by = 0; by < bh; by++) {
      px(ctx, bx + (rnd() > 0.6 ? 1 : 0), topY + by, bw - by, 1, "#0d0b18");
    }
    px(ctx, bx, topY + bh, bw, 1, tones[2]);
    if (smoke) smoke.push({ x: bx + bw / 2, y: topY + 1, ph: rnd() * 6.28, w: 3 + rnd() * 3 });
  }

  // roof furniture on the nearer blocks
  if (depth > 1 && rnd() > 0.55) {
    const tw = 3 + Math.floor(rnd() * 4);
    px(ctx, x + Math.floor(w / 2), topY - 5, tw, 5, tones[2]);
  }

  const cols = Math.max(1, Math.floor(w / 6));
  const rows = Math.max(1, Math.floor((baseY - topY) / 8));
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (rnd() > (depth === 1 ? 0.72 : 0.55)) continue;
      const wx = x + 2 + c * 6, wy = topY + 4 + r * 8;
      if (wy > baseY - 4) continue;
      const roll = rnd();
      /* the more it was hurt, the fewer of its windows are anybody's */
      if (roll < hurt * 0.5) {                        // dark and broken
        px(ctx, wx, wy, 3, 4, "#14111f");
        px(ctx, wx, wy, 3, 1, "#241f33");
        if (rnd() > 0.6) px(ctx, wx + 1, wy + 1, 1, 2, "#0a0810");
        continue;
      }
      const lit = roll > 0.35 + hurt * 0.35;
      px(ctx, wx, wy, 3, 4, lit ? "#ffd98a" : "#2b3550");
      if (lit && collect && rnd() > 0.6) collect.push({ x: wx, y: wy, ph: rnd() * 6.28 });
    }
  }
}

/* =========================================================
   THE CATS

   They used to be four PNGs stacked in a div and wagged with CSS
   keyframes, which meant they could not be lit by the scene, could not
   sit on anything, and were the same size in every shot. They are drawn
   now, from behind, sitting on a ledge looking at the same city she is:
   haunches, a narrowing back, a round head, two ears and a tail that
   curls. The same routine draws them at any size, so they can be small
   on a far parapet in one view and fill the frame in another.
   ========================================================= */
const CAT_BLACK = ["#4a4568", "#37324f", "#272338", "#1a1727"];
const CAT_WHITE = ["#f2f0f8", "#d8d5e6", "#b6b3c9", "#918ea6"];

function catTail(ctx, x, y, s, dir, tones, lift) {
  /* A cubic, not a quadratic: out along the ledge, up the outside, and
     then hooked back in at the tip. Two of those facing each other is
     what makes the shape between them read, and a tail that only goes
     up is an aerial. */
  /* Second pass. The first ran the tail two and a half body-heights up
     into the air, which is not a sitting cat, it is an aerial. A cat
     sitting still lays its tail along the ground and brings the tip round
     in front of its own feet — so this comes out along the ledge, curls
     forward, and finishes low. It is about half the length it was, and it
     lifts only slightly on the shots that want a bit of shape between
     them. */
  const reach = 15 + lift * 3;
  const P = [
    [x + 5 * s * dir,   y - 1.0 * s],
    [x + reach * s * dir, y - 1.5 * s],
    [x + (reach + 2) * s * dir, y - (7 + lift * 3) * s],
    [x + (reach - 7) * s * dir, y - (9 + lift * 4) * s],
  ];
  for (let i = 0; i <= 24; i++) {
    const t = i / 24, mt = 1 - t;
    const px2 = mt * mt * mt * P[0][0] + 3 * mt * mt * t * P[1][0] + 3 * mt * t * t * P[2][0] + t * t * t * P[3][0];
    const py2 = mt * mt * mt * P[0][1] + 3 * mt * mt * t * P[1][1] + 3 * mt * t * t * P[2][1] + t * t * t * P[3][1];
    const r = Math.max(1, (2.7 - t * 1.5) * s);
    blob(ctx, px2, py2, r, r, tones, [-0.5, -0.6]);
  }
}

/* x,y is the ledge under her; s scales the whole animal.

   NOT called drawCat. It was, and the choice adventure further down this
   file already has a function declaration by that name at the same scope —
   so the later one won, every call here silently drew a 40x36 sprite sheet
   into nothing, and the ending rendered a heart floating over an empty
   roof. This is the same trap super-ouissy.js documents at its foot, and it
   cost the same afternoon. */
function drawEndCat(ctx, x, y, s, tones, dir, t, lift) {
  const B = (vx, vy, rx, ry) => blob(ctx, x + vx * s, y + vy * s,
                                     Math.max(1, rx * s), Math.max(1, ry * s), tones, [-0.45, -0.65]);
  const breathe = Math.sin(t * 1.7 + (dir > 0 ? 0 : 1.4)) * 0.35 * s;

  catTail(ctx, x, y, s, dir, tones, lift || 0);

  B(0, -6, 8.5, 6.5);                                   // haunches, sat down
  B(0.5 * dir, -14 + breathe * 0.3, 6, 6.5);            // back and shoulders
  B(1 * dir, -21 + breathe, 5.2, 4.6);                  // head

  /* Ears. Stepped one screen pixel at a time rather than one "cat unit",
     because a unit is more than a pixel at this scale and stepping by it
     leaves gaps — which is how the first pass came out as two antennae
     rather than two ears. They sit on the top of the head with a slight
     outward lean, and the near one has a pink inside. */
  const headX = x + 1 * dir * s;
  const headTop = y + (-25.2 + breathe) * s;
  const earH = Math.max(3, Math.round(6 * s));
  for (let e = 0; e < 2; e++) {
    const out = e ? 1 : -1;
    const near = out === dir;
    const baseX = headX + out * 3.1 * s;
    for (let k = 0; k <= earH; k++) {
      const f = k / earH;
      const w = Math.max(1, Math.round((4.4 - 4.0 * f) * s));
      const cxk = baseX + out * f * 1.6 * s;
      px(ctx, cxk - w / 2, headTop - k, w, 1, near ? tones[1] : tones[2]);
      if (near && k > 0 && k < earH - 1) {
        const iw = Math.max(1, Math.round((2.2 - 2.0 * f) * s));
        px(ctx, cxk - iw / 2, headTop - k, iw, 1, "#c98fa8");
      }
    }
  }

  /* the front paws, just visible either side of her */
  B(-5.5 * dir, -1.5, 2.4, 1.8);
  B(5.5 * dir, -1.5, 2.4, 1.8);

  /* a hint of a cheek, because she is half turned toward the other one */
  blob(ctx, x + (5 * dir) * s, y + (-20.5 + breathe) * s, Math.max(1, 2 * s), Math.max(1, 2 * s),
       tones, [-0.9, -0.4]);
  px(ctx, x + (6.4 * dir) * s, y + (-21.5 + breathe) * s, Math.max(1, 1.1 * s), Math.max(1, 1.1 * s), "#8fd8f0");

  /* The rim light. Without it a dark cat in front of a dark city is not a
     cat, it is a smudge — which is exactly what the first pass looked
     like. The moon is up and behind them, so it catches the back of the
     head, the shoulder and the top of the haunches. */
  const rim = tones === CAT_BLACK ? "#9a92c8" : "#fffdf4";
  const rr = Math.max(1, s);
  const arc = [[-4.6, -21.4], [-4.9, -19.6], [-5.4, -17.4], [-5.9, -14.8],
               [-6.6, -12.2], [-7.5, -9.4], [-8.2, -6.6], [-8.3, -3.6],
               [-1.6, -25.6], [0.6, -25.9], [2.6, -25.2]];
  arc.forEach(function (pt) {
    px(ctx, x + pt[0] * s * dir, y + (pt[1] + breathe) * s, rr, rr, rim);
  });
}

/* =========================================================
   THE VIEWS

   The ending used to be one picture that the camera pushed into over
   eleven seconds, which meant the last thing she looked at was the same
   thing she had already been looking at, only bigger. It is four
   pictures now, and it moves between them: the roof wide, the two of
   them close, the window of the room they were given, and the skyline on
   its own. Each is painted once into its own canvas and they cross-fade.
   ========================================================= */
const NIGHT_VIEWS = 4;
let nightBases = [], nightViewWindows = [], nightViewSmoke = [];
let nightView = 0, nightNext = 0, nightFade = 0;

function nightSky(ctx, h) {
  ditherSky(ctx, 0, 0, NIGHT_W, h, [
    { p: 0.00, c: "#0e1030" }, { p: 0.22, c: "#1a1b47" },
    { p: 0.46, c: "#2c2358" }, { p: 0.66, c: "#4a2f63" },
    { p: 0.80, c: "#7a4560" }, { p: 1.00, c: "#a35c56" },
  ]);
}

function nightStarsInto(ctx, rnd, upto) {
  for (let i = 0; i < 150; i++) {
    const y = Math.pow(rnd(), 1.6) * upto;
    const x = rnd() * NIGHT_W;
    const b = rnd();
    px(ctx, x, y, 1, 1, b > 0.85 ? "#ffffff" : b > 0.5 ? "#dfe4ff" : "#a8b0d8");
  }
}

function nightMoon(ctx, mx, my, mr) {
  for (let ry = -mr * 3; ry <= mr * 3; ry++) {
    for (let rx = -mr * 3; rx <= mr * 3; rx++) {
      const d = Math.sqrt(rx * rx + ry * ry);
      if (d > mr && d < mr * 3) {
        const a = 1 - (d - mr) / (mr * 2);
        if (((BAYER4[(my + ry) & 3][(mx + rx) & 3] + 0.5) / 16) < a * 0.5) {
          px(ctx, mx + rx, my + ry, 1, 1, "#4a4a86");
        }
      }
    }
  }
  for (let ry = -mr; ry <= mr; ry++) {
    for (let rx = -mr; rx <= mr; rx++) {
      if (rx * rx + ry * ry > mr * mr) continue;
      const lit = (rx * -0.4 + ry * -0.5) / mr;
      px(ctx, mx + rx, my + ry, 1, 1, lit > 0.15 ? "#fffdf2" : lit > -0.25 ? "#f0ecd8" : "#d8d2bc");
    }
  }
  const cs = mr / 15;
  [[-5, -3, 3], [4, 2, 4], [-2, 6, 2], [7, -6, 2]].forEach(function (c) {
    blob(ctx, mx + c[0] * cs, my + c[1] * cs, c[2] * cs, c[2] * 0.85 * cs,
         ["#e8e2cc", "#d6cfb6", "#c2baa0", "#b0a890"]);
  });
}

/* the city, in three depths, with a week behind it */
function nightCity(ctx, rnd, collect, smoke, baseTop, scale) {
  const rows = [
    { step: 10, span: 14, top: baseTop, tones: ["#3a3560", "#2b2749", "#211d3a"], depth: 1, hurt: 0.92 },
    { step: 14, span: 18, top: baseTop + 16, tones: ["#2e2a4e", "#221f3d", "#19172d"], depth: 2, hurt: 0.7 },
    { step: 20, span: 22, top: baseTop + 32, tones: ["#221f3a", "#18162c", "#100f20"], depth: 3, hurt: 0.5 },
  ];
  rows.forEach(function (row, i) {
    let x = -6 - i * 2;
    while (x < NIGHT_W + 10) {
      const w = Math.round((row.step + Math.floor(rnd() * row.span)) * (scale || 1));
      const hurt = rnd() < 0.42 ? row.hurt * (0.45 + rnd() * 0.55) : 0;
      nightBuilding(ctx, x, w, row.top + Math.floor(rnd() * 16), row.tones, rnd,
                    row.depth, row.depth > 1 ? collect : null, hurt, smoke);
      x += w + 1 + i;
    }
  });
}

/* the roof she is standing on, its parapet and its string lights */
function nightRoof(ctx, rnd, roofY, collect) {
  px(ctx, 0, roofY, NIGHT_W, NIGHT_H - roofY, "#191527");
  px(ctx, 0, roofY, NIGHT_W, 4, "#3b3354");
  px(ctx, 0, roofY, NIGHT_W, 1, "#6b5c8a");
  for (let i = 0; i < 90; i++) {
    px(ctx, rnd() * NIGHT_W, roofY + 5 + rnd() * (NIGHT_H - roofY - 5), 1, 1,
       rnd() > 0.5 ? "#221d33" : "#12101f");
  }
  [[28, 12], [206, 9], [268, 14]].forEach(function (a) {
    px(ctx, a[0], roofY - a[1], 1, a[1], "#3b3354");
    px(ctx, a[0] - 3, roofY - a[1], 7, 1, "#3b3354");
    px(ctx, a[0] - 2, roofY - a[1] + 3, 5, 1, "#3b3354");
  });
  px(ctx, 60, roofY - 16, 16, 12, "#2b2542");
  px(ctx, 60, roofY - 16, 16, 1, "#5b4f7e");
  px(ctx, 63, roofY - 4, 2, 4, "#2b2542"); px(ctx, 71, roofY - 4, 2, 4, "#2b2542");
  for (let i = 0; i < 26; i++) {
    const lx = 6 + i * 12;
    const sag = Math.sin((i / 26) * Math.PI) * 5;
    px(ctx, lx, roofY - 20 + sag, 1, 1, "#3b3354");
    if (i % 2 === 0) collect.push({ x: lx, y: roofY - 19 + sag, ph: rnd() * 6.28, bulb: true });
  }
}

function nightPaintView(v) {
  const cv = nightBases[v];
  const ctx = cv.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  const rnd = mzRnd(9137 + v * 733);
  const win = nightViewWindows[v] = [];
  const smoke = nightViewSmoke[v] = [];
  ctx.clearRect(0, 0, NIGHT_W, NIGHT_H);

  if (v === 0) {                                    // WIDE — the roof, and all of it
    nightSky(ctx, NIGHT_H);
    nightStarsInto(ctx, rnd, NIGHT_H * 0.72);
    nightMoon(ctx, 244, 38, 15);
    nightCity(ctx, rnd, win, smoke, 96, 1);
    nightRoof(ctx, rnd, 150, win);

  } else if (v === 1) {                             // CLOSE — the two of them on the ledge
    nightSky(ctx, NIGHT_H);
    nightStarsInto(ctx, rnd, NIGHT_H * 0.6);
    nightMoon(ctx, 232, 44, 26);
    nightCity(ctx, rnd, win, smoke, 120, 1.6);
    px(ctx, 0, 158, NIGHT_W, NIGHT_H - 158, "#191527");
    px(ctx, 0, 158, NIGHT_W, 5, "#443b62");
    px(ctx, 0, 158, NIGHT_W, 1, "#7d6ca0");
    for (let i = 0; i < 60; i++) px(ctx, rnd() * NIGHT_W, 164 + rnd() * 14, 1, 1, rnd() > 0.5 ? "#221d33" : "#12101f");

  } else if (v === 2) {                             // WINDOW — from inside the room
    nightSky(ctx, NIGHT_H);
    nightStarsInto(ctx, rnd, 90);
    nightMoon(ctx, 214, 46, 17);
    nightCity(ctx, rnd, win, smoke, 104, 1.1);
    px(ctx, 0, 150, NIGHT_W, NIGHT_H - 150, "#191527");
    /* the room, drawn over the top of it as a frame */
    px(ctx, 0, 0, 44, NIGHT_H, "#2a1f2e"); px(ctx, 40, 0, 4, NIGHT_H, "#3d2e3f");
    px(ctx, NIGHT_W - 44, 0, 44, NIGHT_H, "#2a1f2e"); px(ctx, NIGHT_W - 44, 0, 4, NIGHT_H, "#3d2e3f");
    px(ctx, 0, 0, NIGHT_W, 22, "#2a1f2e"); px(ctx, 0, 20, NIGHT_W, 3, "#3d2e3f");
    px(ctx, 0, NIGHT_H - 34, NIGHT_W, 34, "#2a1f2e");
    px(ctx, 40, NIGHT_H - 34, NIGHT_W - 80, 4, "#6b5340");           // the sill
    px(ctx, 40, NIGHT_H - 34, NIGHT_W - 80, 1, "#96795c");
    px(ctx, NIGHT_W / 2 - 1, 22, 3, NIGHT_H - 56, "#3d2e3f");        // the glazing bar
    px(ctx, 44, 96, NIGHT_W - 88, 2, "#3d2e3f");
    /* a mug somebody put down on the sill and did not pick up again */
    px(ctx, 66, NIGHT_H - 44, 11, 10, "#c9a88a"); px(ctx, 66, NIGHT_H - 44, 11, 2, "#e6cfb2");
    px(ctx, 77, NIGHT_H - 41, 3, 5, "#c9a88a"); px(ctx, 78, NIGHT_H - 40, 1, 3, "#2a1f2e");
    /* a lamp on the sill at the far end, on the room's side of the glass */
    px(ctx, 238, NIGHT_H - 44, 12, 10, "#6b5340");
    px(ctx, 238, NIGHT_H - 44, 12, 2, "#96795c");
    px(ctx, 242, NIGHT_H - 41, 4, 5, "#ffd98a");
    win.push({ x: 244, y: NIGHT_H - 39, ph: 0.8, bulb: true });

  } else {                                          // SKYLINE — a breath, and the smoke
    nightSky(ctx, NIGHT_H);
    nightStarsInto(ctx, rnd, NIGHT_H * 0.66);
    nightMoon(ctx, 68, 34, 20);
    nightCity(ctx, rnd, win, smoke, 86, 0.85);
    px(ctx, 0, 168, NIGHT_W, NIGHT_H - 168, "#191527");
    px(ctx, 0, 168, NIGHT_W, 2, "#3b3354");
  }
}

function nightPaintBase() {
  for (let v = 0; v < NIGHT_VIEWS; v++) {
    if (!nightBases[v]) {
      nightBases[v] = document.createElement("canvas");
      nightBases[v].width = NIGHT_W; nightBases[v].height = NIGHT_H;
    }
    nightPaintView(v);
  }
  nightWindows = nightViewWindows[0];
}

/* where the two of them and the two cats sit, per view */
const NIGHT_CAST = [
  { catY: 154, catX: 152, s: 1.0, gap: 23, lift: 0.5 },
  { catY: 158, catX: 158, s: 1.5, gap: 34, lift: 1.0 },
  { catY: NIGHT_H - 34, catX: 160, s: 0.9, gap: 21, lift: 0.6 },
  { catY: 168, catX: 214, s: 0.5, gap: 12, lift: 0.2 },
];

/* smoke: a slow column of soft blobs going up off a broken parapet */
function nightSmoke(ctx, list, t) {
  for (let i = 0; i < list.length; i++) {
    const sm = list[i];
    for (let k = 0; k < 9; k++) {
      const age = ((t * 0.22 + k / 9 + sm.ph) % 1);
      const y = sm.y - age * 34;
      const x = sm.x + Math.sin(age * 3.4 + sm.ph) * (2 + age * 6);
      const r = sm.w * (0.4 + age * 1.5);
      const a = (1 - age) * 0.30;
      if (a <= 0.02) continue;
      ctx.fillStyle = "rgba(126,120,150," + a + ")";
      ctx.beginPath();
      ctx.arc(x, y, r, 0, 6.2832);
      ctx.fill();
    }
  }
}

/* everything that moves, for one view */
function nightLive(ctx, v, t) {
  const win = nightViewWindows[v] || [];
  for (let i = 0; i < win.length; i++) {
    const w = win[i];
    const val = Math.sin(t * (w.bulb ? 1.6 : 0.5) + w.ph);
    if (w.bulb) {
      const g = 0.5 + 0.5 * val;
      px(ctx, w.x, w.y, 1, 1, g > 0.5 ? "#ffe9a8" : "#c9a86a");
      if (g > 0.8) { px(ctx, w.x - 1, w.y, 1, 1, "#7a6a3a"); px(ctx, w.x + 1, w.y, 1, 1, "#7a6a3a"); }
    } else if (val > 0.93) {
      px(ctx, w.x, w.y, 3, 4, "#2b3550");            // someone turns in for the night
    }
  }

  /* Everything in the sky is clipped to the window on the room view,
     otherwise the clouds drift straight across the wall. */
  const framed = v === 2;
  if (framed) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(44, 22, NIGHT_W - 88, NIGHT_H - 56);
    ctx.clip();
  }

  nightSmoke(ctx, nightViewSmoke[v] || [], t);

  // drifting clouds, lit underneath by what is left of the city
  const cloudTop = v === 2 ? 30 : 34;
  for (let c = 0; c < 4; c++) {
    const cw = 34 + c * 9;
    const cx = ((t * (5 + c * 2) + c * 90) % (NIGHT_W + 120)) - 60;
    const cy = cloudTop + c * 13;
    blob(ctx, cx, cy, cw, 5 + c, ["#3a3566", "#302b57", "#272248", "#1e1a39"]);
    px(ctx, cx - cw, cy + 5 + c, cw * 2, 1, "#4a3f6b");
  }

  // a shooting star now and then
  if (!nightShoot && Math.random() < 0.004) {
    nightShoot = { x: -20 + Math.random() * 120, y: 10 + Math.random() * 40, t: 0 };
  }
  if (nightShoot) {
    nightShoot.t += 0.016;
    const sx = nightShoot.x + nightShoot.t * 260;
    const sy = nightShoot.y + nightShoot.t * 90;
    for (let k = 0; k < 12; k++) {
      px(ctx, sx - k * 3, sy - k * 1, 1, 1, k < 3 ? "#ffffff" : "#b9c2f0");
    }
    if (nightShoot.t > 0.9) nightShoot = null;
  }

  // twinkle pass over the star field
  for (let i = 0; i < 26; i++) {
    const sx = (i * 97) % NIGHT_W, sy = (i * 53) % 90;
    if (Math.sin(t * 2 + i) > 0.86) px(ctx, sx, sy, 1, 1, "#ffffff");
  }

  if (framed) ctx.restore();

  /* the two of them, and the heart their tails make between them */
  const cast = NIGHT_CAST[v];
  const gap = cast.gap;
  drawEndCat(ctx, cast.catX - gap, cast.catY, cast.s, CAT_BLACK, 1, t, cast.lift);
  drawEndCat(ctx, cast.catX + gap, cast.catY, cast.s, CAT_WHITE, -1, t + 0.7, cast.lift);
  if (cast.lift > 0.3) {
    const hy = cast.catY - (26 + cast.lift * 8) * cast.s - Math.sin(t * 1.4) * 1.5;
    const hs = Math.max(1, cast.s * 1.6);
    const beat = 0.85 + 0.15 * Math.sin(t * 2.6);
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -3; dx <= 3; dx++) {
        const fx = dx / 3, fy = dy / 2.4;
        const inside = Math.pow(fx * fx + fy * fy - 0.36, 3) - fx * fx * fy * fy * fy < 0;
        if (inside && dy <= 1) px(ctx, cast.catX + dx * hs, hy + dy * hs, hs, hs,
                                  dy < 0 ? "#ff9ec6" : "#e2648f");
      }
    }
    ctx.globalAlpha = 0.35 * beat;
    ctx.fillStyle = "#ff9ec6";
    ctx.beginPath(); ctx.arc(cast.catX, hy, 5 * hs, 0, 6.2832); ctx.fill();
    ctx.globalAlpha = 1;
  }

  // fireflies coming up off the roof, on the close view
  if (v === 1) {
    for (let i = 0; i < 14; i++) {
      const fy = 176 - ((t * 9 + i * 13) % 60);
      const fx = 20 + ((i * 37) % (NIGHT_W - 40)) + Math.sin(t + i) * 4;
      if (Math.sin(t * 3 + i) > 0.1) px(ctx, fx, fy, 1, 1, "#ffe9a8");
    }
  }
}

const NIGHT_HOLD = 6.5;          // seconds on each view
const NIGHT_CROSS = 1.1;         // and how long the change takes

function nightFrame(now) {
  nightRaf = requestAnimationFrame(nightFrame);
  const screen = document.getElementById("screen-end");
  if (!screen || !screen.classList.contains("active")) return;
  if (!nightT0) nightT0 = now;
  const t = (now - nightT0) / 1000;

  /* which view we are on, and how far through changing to the next */
  const cycle = NIGHT_HOLD + NIGHT_CROSS;
  const step = Math.floor(t / cycle);
  const into = t - step * cycle;
  nightView = step % NIGHT_VIEWS;
  nightNext = (nightView + 1) % NIGHT_VIEWS;
  nightFade = into > NIGHT_HOLD ? (into - NIGHT_HOLD) / NIGHT_CROSS : 0;
  nightWindows = nightViewWindows[nightView] || [];

  nightCtx.clearRect(0, 0, NIGHT_W, NIGHT_H);
  nightCtx.drawImage(nightBases[nightView], 0, 0);
  nightLive(nightCtx, nightView, t);

  if (nightFade > 0) {
    nightCtx.globalAlpha = nightFade;
    nightCtx.drawImage(nightBases[nightNext], 0, 0);
    if (nightFade > 0.45) nightLive(nightCtx, nightNext, t);
    nightCtx.globalAlpha = 1;
  }
}

function startNightScene() {
  if (!nightEnsure()) return;
  nightPaintBase();
  if (!nightRaf) { nightT0 = 0; nightRaf = requestAnimationFrame(nightFrame); }
}
function stopNightScene() {
  if (nightRaf) cancelAnimationFrame(nightRaf);
  nightRaf = null;
  try {
    if (window.Apocalypse && window.Apocalypse.afterTheme) window.Apocalypse.afterTheme(false);
  } catch (e) {}
}

function activateEndingScene() {
  startNightScene();
  /* THE LAST SCREEN GETS THE MUSIC IT EARNED.

     It has been silent since the chapter ended, which is a strange place
     to be quiet: this is the one screen where nothing is happening and
     everything has already happened. The apocalypse chapter's score can
     play one more piece — the same two tunes, at half speed on a music
     box, and for the first time in the whole thing the bass goes to the
     root and stays there. The button that got here was the gesture a
     browser wants before it will make a sound. */
  try {
    if (window.Apocalypse && window.Apocalypse.afterTheme) window.Apocalypse.afterTheme(true);
  } catch (e) {}
  spawnNightStars(); buildEndHearts();
  /* The camera used to push into one picture over eleven seconds. The
     scene cycles between four now and does its own timing, so there is
     nothing left here to schedule. scene-1 is kept only because the
     hearts and the star field key off it. */
  setScene(1);
  clearTimeout(endTimer1); clearTimeout(endTimer2);
  endTimer1 = setTimeout(() => document.getElementById("night-sky").classList.add("settled"), 5200);
}

function spawnNightStars() {
  const field = document.getElementById("night-stars");
  if (field.childElementCount) return;
  for (let i=0;i<64;i++){
    const s = document.createElement("div");
    s.className = "star";
    const sz = Math.random()<0.15 ? 3 : 2;
    s.style.width = sz+"px"; s.style.height = sz+"px";
    s.style.left = Math.random()*100+"%"; s.style.top = Math.random()*72+"%";
    s.style.animationDelay = (Math.random()*3)+"s";
    field.appendChild(s);
  }
  for (let i=0;i<5;i++){
    const s = document.createElement("div");
    s.className = "sparkle";
    s.style.left = Math.random()*100+"%"; s.style.top = Math.random()*55+"%";
    s.style.animationDelay = (Math.random()*3)+"s";
    field.appendChild(s);
  }
}
/* The four shapes the hearts over the roof are drawn from. They used to
   feed a floating-particle system as well, whose only three emitters were
   the maze's card screens; the shapes outlived it. */
const PARTICLE_SHAPES = {
  heart: "M12 20.2C2.6 13.4 3.4 6.4 8.2 6.4c2 0 3.3 1.2 3.8 2.3.5-1.1 1.8-2.3 3.8-2.3 4.8 0 5.6 7-3.8 13.8z",
  spark: "M12 2.4l2.1 6.3 6.3 2.1-6.3 2.1-2.1 6.3-2.1-6.3L3.6 10.8l6.3-2.1z",
  petal: "M12 3.2c3.4 2.4 5.2 5.4 5.2 8.5a5.2 5.2 0 1 1-10.4 0c0-3.1 1.8-6.1 5.2-8.5z",
  bud:   "M12 4c2.7 0 4.7 2.1 4.7 4.6 0 3.1-2.3 5.8-4.7 7.7-2.4-1.9-4.7-4.6-4.7-7.7C7.3 6.1 9.3 4 12 4z",
  leaf:  "M4.5 19.5C4.5 11 10 5.5 19.5 4.5c1 9.5-4.5 15-15 15z",
};

function buildEndHearts() {
  const field = document.getElementById("end-hearts");
  if (field.childElementCount) return;
  const shapes = ["heart", "petal", "spark", "bud"];
  const tints = ["#ff9ac0", "#ffc9a8", "#ffe3b0", "#f08bb0"];
  for (let i=0;i<7;i++){
    const s = document.createElement("span");
    s.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="' +
      tints[i % tints.length] + '" d="' + PARTICLE_SHAPES[shapes[i % shapes.length]] + '"/></svg>';
    s.style.left = (35 + Math.random()*30) + "%";
    s.style.top = (55 + Math.random()*20) + "%";
    s.style.animationDelay = (Math.random()*3)+"s";
    field.appendChild(s);
  }
}

/* =========================================================
   THE GATE — passcode, and the handoff into the memory book
   ========================================================= */

/* ---------- book intro integration ----------
   The actual 3D scene (Three.js) lives in book-scene.js and runs
   independently. It calls window.finishBookIntro() when the climax
   flash completes. There is no longer a Skip button — the intro is the
   thing she opens the site to see, and it is short. window.skipBookIntro
   still exists in book-scene.js as its teardown, and is used there. */
let introFinished = false;

window.finishBookIntro = function finishBookIntro() {
  if (introFinished) return;
  introFinished = true;
  const cut = document.getElementById("white-cut");
  cut.classList.add("active");
  setTimeout(() => {
    showScreen("gate");
    setTimeout(() => cut.classList.remove("active"), 200);
  }, 480);
};

/* ---------- passcode gate ----------
   No text field. She taps her own keypad, so the phone keyboard never
   appears and never covers the thing she is typing into. A hardware
   keyboard still works on a laptop, because refusing it would be rude.
   gateCode is the single source of truth; paintGate is the only thing
   that writes to the cells. */
let gateCode = "";

function paintGate() {
  const row = document.getElementById("gate-code");
  if (!row) return;
  row.querySelectorAll(".gate-dot").forEach((d, i) => {
    /* Only toggle on a real change. Re-adding the class every keypress
       restarts the pop on all four dots and the row flickers. */
    const want = i < gateCode.length;
    if (d.classList.contains("filled") !== want) d.classList.toggle("filled", want);
  });
}

function gateType(d) {
  if (gateCode.length >= 4) return;
  gateCode += d;
  document.getElementById("gate-error").textContent = "";
  document.getElementById("gate-code").classList.remove("bad");
  paintGate();
  gateClick(1);
  /* four digits is the whole code, so there is nothing left to wait for.
     The pause lets the last dot land before it is judged. */
  if (gateCode.length === 4) setTimeout(checkGateCode, 300);
}
function gateBack()  { if (!gateCode) return; gateCode = gateCode.slice(0, -1); paintGate(); gateClick(0); }
function gateClear() { if (!gateCode) return; gateCode = ""; paintGate(); gateClick(0); }

/* A short wooden click with a breath of paper rustle over it, so the
   keypad answers back. Synthesised, like every other sound on the site —
   there is not an audio file in the repo and there should not be one. */
function gateClick(up) {
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const c = window.__gateAudio || (window.__gateAudio = new AC());
    if (c.state !== "running") { if (window.wakeAudio) window.wakeAudio(c); else c.resume(); }
    const t = c.currentTime;

    // the click: a quick body-resonance blip
    const o = c.createOscillator(), g = c.createGain();
    o.type = "triangle";
    o.frequency.setValueAtTime(up ? 760 : 420, t);
    o.frequency.exponentialRampToValueAtTime(up ? 320 : 200, t + 0.06);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.055, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
    o.connect(g); g.connect(c.destination);
    o.start(t); o.stop(t + 0.11);

    // the rustle: a very short band-passed noise burst
    const len = Math.floor(c.sampleRate * 0.05);
    const buf = c.createBuffer(1, len, c.sampleRate);
    const ch = buf.getChannelData(0);
    for (let i = 0; i < len; i++) ch[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = c.createBufferSource(); src.buffer = buf;
    const bp = c.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = 2600; bp.Q.value = 0.9;
    const ng = c.createGain(); ng.gain.value = 0.045;
    src.connect(bp); bp.connect(ng); ng.connect(c.destination);
    src.start(t);
  } catch (e) {}
}

function checkGateCode() {
  const row = document.getElementById("gate-code");
  const card = document.getElementById("gate-card");
  if (gateCode === GATE_CODE) {
    if (card) card.classList.add("ok");        // the sheet takes the light
    bloomSeal();                                // and the wax gives way
    setTimeout(() => { pageTurn("scrapbook", startDioramas); }, 1100);
  } else {
    document.getElementById("gate-error").textContent = "That isn't it — try again.";
    /* Show her the wrong code flashing before it clears, rather than
       wiping it out from under her the instant the fourth dot lands. */
    if (row) row.classList.add("bad");
    if (card) { card.classList.remove("shake"); void card.offsetWidth; card.classList.add("shake"); }
    gateThud();
    setTimeout(() => {
      gateCode = "";
      if (row) row.classList.remove("bad");
      paintGate();
    }, 620);
  }
}

/* the sound of a lock not turning */
function gateThud() {
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const c = window.__gateAudio || (window.__gateAudio = new AC());
    if (c.state !== "running") { if (window.wakeAudio) window.wakeAudio(c); else c.resume(); }
    const t = c.currentTime, o = c.createOscillator(), g = c.createGain();
    o.type = "sawtooth";
    o.frequency.setValueAtTime(190, t);
    o.frequency.exponentialRampToValueAtTime(70, t + 0.22);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.07, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
    o.connect(g); g.connect(c.destination);
    o.start(t); o.stop(t + 0.32);
  } catch (e) {}
}

/* Unlock flourish: the wax seal used to crack. Now it blooms — petals
   unfurl outward and a warm glow swells through as the seal dissolves. */
function bloomSeal() {
  const seal = document.getElementById("gate-seal");
  const wrap = seal ? seal.parentElement : null;
  if (seal) seal.classList.add("crack");     // the wax swells, turns and goes
  if (!wrap || wrap.querySelector(".bloom-burst")) return;

  const burst = document.createElement("div");
  burst.className = "bloom-burst";
  const core = document.createElement("div");
  core.className = "bloom-core";
  burst.appendChild(core);

  const PETALS = 10;
  for (let i = 0; i < PETALS; i++) {
    const p = document.createElement("div");
    p.className = "bloom-petal";
    p.style.setProperty("--a", (i * (360 / PETALS)) + "deg");
    p.style.setProperty("--d", (i * 28) + "ms");
    burst.appendChild(p);
  }
  wrap.appendChild(burst);
  void burst.offsetWidth;
  burst.classList.add("go");
  setTimeout(() => burst.remove(), 1400);
}

(function wireGate() {
  const pad = document.getElementById("gate-pad");
  if (!pad) return;

  /* pointerdown, not click: the key should answer the moment she touches
     it. The .down class is cleared on release anywhere, so dragging off
     a key never leaves it stuck looking pressed. */
  pad.addEventListener("pointerdown", (e) => {
    const btn = e.target.closest("[data-gate-key]");
    if (!btn) return;
    e.preventDefault();
    btn.classList.add("down");
    const k = btn.getAttribute("data-gate-key");
    if (k === "back") gateBack();
    else if (k === "clear") gateClear();
    else gateType(k);
    if (navigator.vibrate) { try { navigator.vibrate(8); } catch (e) {} }
  });
  const unlock = document.getElementById("gate-submit");
  if (unlock) {
    unlock.addEventListener("pointerdown", (e) => { e.preventDefault(); unlock.classList.add("down"); });
    unlock.addEventListener("click", () => {
      /* Only judge a complete code. Pressing Unlock on two digits and
         being told it is wrong is just rude. */
      if (gateCode.length === 4) checkGateCode();
      else document.getElementById("gate-error").textContent = "four numbers first.";
    });
  }
  const release = () => {
    document.querySelectorAll(".gate-key.down,.gate-unlock.down")
      .forEach((b) => b.classList.remove("down"));
  };
  addEventListener("pointerup", release);
  addEventListener("pointercancel", release);

  /* a real keyboard, for whoever is on a laptop */
  addEventListener("keydown", (e) => {
    const g = document.getElementById("screen-gate");
    if (!g || !g.classList.contains("active")) return;
    if (e.key >= "0" && e.key <= "9") { gateType(e.key); e.preventDefault(); }
    else if (e.key === "Backspace") { gateBack(); e.preventDefault(); }
    else if (e.key === "Escape") { gateClear(); }
    else if (e.key === "Enter" && gateCode.length === 4) checkGateCode();
  });

  paintGate();
})();

/* =========================================================
   THE SCRAPBOOK
   The page logic lives in scrapbook.js; this half only owns the
   navigation between screens.
   ========================================================= */
function startDioramas() {           // kept as the name script.js calls
  if (window.Scrapbook) Scrapbook.start();
}
function stopDioramas() {
  if (window.Scrapbook) Scrapbook.stop();
}

/* ---------- wiring ---------- */
document.getElementById("sb-lb-close").addEventListener("click", () => Scrapbook.closeLightbox());
document.getElementById("sb-lightbox").addEventListener("click", (e) => {
  if (e.target.id === "sb-lightbox") Scrapbook.closeLightbox();
});
/* the book has no controls on it at all — the way out is the button on
   its back cover, which calls this */
window.leaveScrapbook = () => {
  stopDioramas();
  pageTurn("hub", startHub);
};
document.addEventListener("keydown", (e) => {
  if (!document.getElementById("screen-scrapbook").classList.contains("active")) return;
  if (e.key === "ArrowRight") Scrapbook.next();
  if (e.key === "ArrowLeft") Scrapbook.prev();
  if (e.key === "Escape") Scrapbook.closeLightbox();
});

/* =========================================================
   SUPER OUISSY
   The platformer lives entirely in super-ouissy.js. This half only
   owns getting in and out of it, exactly as the scrapbook does.
   Finishing it is remembered, but it is a bonus chapter: the keepsake
   unlocks on the adventure alone, so nothing she has already finished
   can re-lock itself.
   ========================================================= */
function startSuperOuissy() {
  loadChapter("ouissy").then(() => { if (window.SuperOuissy) SuperOuissy.start(); });
}
function stopSuperOuissy() {
  if (window.SuperOuissy) SuperOuissy.stop();
}
window.leaveSuperOuissy = () => {
  stopSuperOuissy();
  pageTurn("hub", startHub);
};
window.markSuperOuissyDone = () => markChapterDone("ouissy");

/* =========================================================
   OUISSY AT THE APOCALYPSE
   Lives entirely in apocalypse.js. This half only owns getting in
   and out of it, exactly as the scrapbook and the platformer do.
   ========================================================= */
function startApocalypse() {
  loadChapter("apoc").then(() => { if (window.Apocalypse) Apocalypse.start(); });
}
function stopApocalypse() {
  if (window.Apocalypse) Apocalypse.stop();
}
window.leaveApocalypse = () => {
  stopApocalypse();
  pageTurn("hub", startHub);
};
window.markApocalypseDone = () => markChapterDone("apoc");

/* =========================================================
   SUPER OUISSY RACE
   Lives entirely in racing.js. This half only owns getting in
   and out of it, exactly as the other games do.
   ========================================================= */
function startSuperOuissyRace() {
  loadChapter("race").then(() => { if (window.SuperOuissyRace) SuperOuissyRace.start(); });
}
function stopSuperOuissyRace() {
  if (window.SuperOuissyRace) SuperOuissyRace.stop();
}
window.leaveSuperOuissyRace = () => {
  stopSuperOuissyRace();
  pageTurn("hub", startHub);
};
window.markSuperOuissyRaceDone = () => markChapterDone("race");

/* =========================================================
   OUISSY'S NIGHT SHIFT
   The night-shift chapter. Same contract as the others: this half only
   owns getting in and out of it, and the file itself now comes down on
   the idle callback with the rest rather than in the head.
   ========================================================= */
function startNightShift() {
  loadChapter("nightshift").then(() => { if (window.OuissysNightShift) OuissysNightShift.start(); });
}
function stopNightShift() {
  if (window.OuissysNightShift) OuissysNightShift.stop();
}
window.leaveNightShift = () => {
  stopNightShift();
  pageTurn("hub", startHub);
};
window.markNightShiftDone = () => markChapterDone("nightshift");

/* The apocalypse ends on the roof, with the two cats — the scene the
   whole site has been walking towards. */
window.startApocalypseEnding = () => {
  stopApocalypse();
  pageTurn("end", activateEndingScene);
};

/* =========================================================
   THE WALL — the painted half

   The hub and the keepsake each carry a <div class="page-deco"> in the
   markup with the stickers that belong to that screen, because those
   differ. Everything else on the wall is the same on both and is built
   here rather than written out twice: a hung string of lights, four
   ink flourishes at the corners, and a drift of hearts.

   All of it is inserted BEFORE the stickers, so it paints behind them,
   and all of it is <span>/<svg> — the stickers are <i>, and they pick
   which way they rock with :nth-of-type, so nothing added here can
   disturb them.

   None of it runs while a game does: an inactive .screen is display:none
   and a display:none subtree animates nothing at all.
   ========================================================= */
(function paintWalls() {
  const SVGNS = "http://www.w3.org/2000/svg";
  const svg = (tag, attrs) => {
    const n = document.createElementNS(SVGNS, tag);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    return n;
  };
  const box = (cls, css) => {
    const n = document.createElement("span");
    n.className = cls;
    if (css) n.setAttribute("style", css);
    return n;
  };

  /* THE STRING OF LIGHTS. Three swags of wire pinned across the top with
     a bulb hanging under each dip. The wire is one path in a box 1000
     wide by 96 tall stretched to the width of the screen — the stroke is
     told not to stretch with it, or a wide window would draw it as a
     smear — and the bulbs are placed on the very same curve in percent,
     so they sit ON the wire at every width instead of near it. */
  const WIRE_TOP = 7, SAG = 27;
  /* One swag per 380 or so of width, never fewer than three: a fixed
     count draws a pretty string on a phone and three enormous washing
     lines on a laptop, with the bulbs a hand's width apart. */
  const swagCount = () => Math.max(3, Math.round(window.innerWidth / 380));
  function lights(swags) {
    const wireY = (t) => WIRE_TOP + SAG * Math.sin(Math.PI * ((t * swags) % 1));
    const wrap = box("deco-string");
    wrap.dataset.swags = swags;
    const s = svg("svg", { viewBox: "0 0 1000 96", preserveAspectRatio: "none" });
    let d = "";
    for (let i = 0; i <= 120; i++) {
      const t = i / 120;
      d += (i ? "L" : "M") + (t * 1000).toFixed(1) + " " + wireY(t).toFixed(2) + " ";
    }
    const wire = svg("path", { d: d.trim(), class: "deco-wire" });
    wire.setAttribute("vector-effect", "non-scaling-stroke");
    s.appendChild(wire);
    wrap.appendChild(s);

    /* three to a dip, so the light reads as a string rather than as a
       row of lamps */
    const N = swags * 3;
    for (let i = 0; i < N; i++) {
      const t = (i + 0.5) / N;
      const b = box(
        "deco-bulb deco-bulb-" + (i % 3),
        "left:" + (t * 100).toFixed(2) + "%; top:" + wireY(t).toFixed(1) + "px;" +
          "animation-delay:" + (-i * 0.73).toFixed(2) + "s"
      );
      wrap.appendChild(b);
    }
    return wrap;
  }

  /* THE CORNERS. Two arcs and two dots, drawn once each time the screen
     opens: the stroke starts fully dashed off and is walked back on, so
     the flourish appears to be inked in rather than to switch on. */
  function corner(where) {
    const wrap = box("deco-corner deco-corner-" + where);
    const s = svg("svg", { viewBox: "0 0 52 52" });
    /* the sweep, and a tighter one inside it */
    s.appendChild(svg("path", { class: "deco-ink deco-ink-1", d: "M0 46 C0 20 20 0 46 0" }));
    s.appendChild(svg("path", { class: "deco-ink deco-ink-2", d: "M0 32 C0 14 14 0 32 0" }));
    /* a spiral finishing each end, one turned the other way */
    s.appendChild(svg("path", {
      class: "deco-ink deco-ink-3",
      d: "M46 0 c7 0 10.2 4 8.6 8 c-1.2 3.4 -6 3.4 -6.6 0 c-.4 -2.2 1.6 -3.6 3.4 -2.6",
    }));
    s.appendChild(svg("path", {
      class: "deco-ink deco-ink-3",
      d: "M0 46 c0 7 4 10.2 8 8.6 c3.4 -1.2 3.4 -6 0 -6.6 c-2.2 -.4 -3.6 1.6 -2.6 3.4",
    }));
    /* and the little gem the two arcs are bent around */
    s.appendChild(svg("path", { class: "deco-dot", d: "M9 4.4 L13.6 9 L9 13.6 L4.4 9 Z" }));
    wrap.appendChild(s);
    return wrap;
  }

  /* THE DRIFT. Hearts and stars, small and faint, rising the height of
     the screen on their own clocks and swaying as they go. Every one
     starts with a negative delay of its own, so on the very first frame
     the air is already full of them rather than filling up over the
     first minute. */
  const DRIFT = [
    /* x%, size, seconds, delay, glyph, sway px */
    [8, 15, 34, -3, "heart", 26], [21, 11, 27, -14, "star", -18],
    [33, 17, 41, -22, "heart", 32], [45, 12, 31, -7, "star", -24],
    [57, 14, 37, -29, "heart", 20], [66, 11, 25, -17, "star", 28],
    [77, 16, 44, -35, "heart", -30], [88, 12, 30, -11, "star", 22],
    [95, 14, 39, -25, "heart", -20], [15, 10, 23, -19, "star", 16],
    [39, 13, 46, -40, "heart", -26], [72, 10, 29, -5, "star", -14],
  ];
  function drift() {
    const wrap = box("deco-drift");
    for (const [x, size, dur, delay, glyph, sway] of DRIFT) {
      const p = box(
        "deco-petal",
        "left:" + x + "%; width:" + size + "px; height:" + size + "px;" +
          "animation-duration:" + dur + "s; animation-delay:" + delay + "s;" +
          "--sway:" + sway + "px"
      );
      const s = svg("svg", { class: "gl" });
      s.appendChild(svg("use", { href: "#ic-px-" + glyph }));
      p.appendChild(s);
      wrap.appendChild(p);
    }
    return wrap;
  }

  document.querySelectorAll(".page-deco").forEach((deco) => {
    /* in front of the washes, behind the vignette and the stickers: the
       corners of the page darken over the lights the way they darken
       over everything else, and a sticker is a thing ON the wall. */
    const at = deco.querySelector(".deco-vig") || null;
    const parts = [
      box("deco-lattice"), /* the printed diamonds under everything */
      box("deco-fox"),     /* the age spots in the paper */
      box("deco-rays"),
      lights(swagCount()),
      drift(),
      box("deco-frame"),   /* the ruled edge of the page */
      corner("tl"), corner("tr"), corner("br"), corner("bl"),
    ];
    for (const p of parts) deco.insertBefore(p, at);
  });

  /* Turning an iPad sideways halves the number of dips that fit, and a
     string strung for a portrait screen looks stretched across a
     landscape one. It is restrung only when the count actually changes,
     so a keyboard opening or a toolbar collapsing rebuilds nothing. */
  let rehangSoon = 0;
  addEventListener("resize", () => {
    clearTimeout(rehangSoon);
    rehangSoon = setTimeout(() => {
      const want = swagCount();
      document.querySelectorAll(".deco-string").forEach((old) => {
        if (+old.dataset.swags === want) return;
        old.replaceWith(lights(want));
      });
    }, 260);
  });
})();

/* =========================================================
   HUB — choose your adventure
   Two chapters, either order. Completion is remembered so she can
   put the phone down and come back to it.
   ========================================================= */
const CHAPTER_KEY = "fal_chapters_done";

function chaptersDone() {
  try { return JSON.parse(localStorage.getItem(CHAPTER_KEY) || "{}") || {}; }
  catch (e) { return {}; }
}
function markChapterDone(name) {
  try {
    const d = chaptersDone();
    d[name] = true;
    localStorage.setItem(CHAPTER_KEY, JSON.stringify(d));
  } catch (e) { /* private mode — the session still works, it just won't persist */ }
}
/* WHAT OPENS THE KEEPSAKE.

   It used to take both story chapters — the maze and the adventure. With
   the maze gone the adventure is the one that is left, and it stays the
   one that counts: gating on anything else would re-lock the keepsake
   for somebody who had already earned it, which is the one thing this
   was always careful not to do. */
function bothChaptersDone() {
  return !!chaptersDone().quest;
}

function startHub() {
  const d = chaptersDone();
  const both = bothChaptersDone();

  /* the maze is gone from main; the night shift is the sixth card */
  [["quest", d.quest], ["ouissy", d.ouissy], ["apoc", d.apoc], ["race", d.race],
   ["nightshift", d.nightshift]].forEach(([name, done]) => {
    const card = document.getElementById("hub-card-" + name);
    if (card) card.classList.toggle("done", !!done);
  });

  /* The line counts whatever is on the board, so a card coming or going
     never leaves it lying. The keepsake is gated on the story chapter —
     see bothChaptersDone above. */
  const sub = document.getElementById("hub-sub");
  const count = (d.quest ? 1 : 0) + (d.ouissy ? 1 : 0) + (d.apoc ? 1 : 0) + (d.race ? 1 : 0) +
                (d.nightshift ? 1 : 0);
  const total = document.querySelectorAll(".hub-card").length;
  if (both && count === total) sub.textContent = "— every one of them done. the keepsake is yours —";
  else if (both) sub.textContent = "— the story is done. the keepsake is yours —";
  else if (count) sub.textContent = "— " + count + " of " + total + " done, any order —";
  else sub.textContent = "— " + total + " ways in, any order —";

  document.getElementById("hub-keepsake").classList.toggle("on", both);
}

document.getElementById("hub-card-quest").addEventListener("click", () => {
  pageTurn("quest", startQuest);
});
document.getElementById("hub-card-ouissy").addEventListener("click", () => {
  pageTurn("ouissy", startSuperOuissy);
});
document.getElementById("hub-card-apoc").addEventListener("click", () => {
  pageTurn("apoc", startApocalypse);
});
document.getElementById("hub-card-race").addEventListener("click", () => {
  pageTurn("race", startSuperOuissyRace);
});
document.getElementById("hub-card-nightshift").addEventListener("click", () => {
  pageTurn("nightshift", startNightShift);
});
document.getElementById("hub-keepsake").addEventListener("click", () => {
  pageTurn("keepsake", startKeepsake);
});

/* =========================================================
   THE KEEPSAKE'S PICTURES

   The board used to hold one flat glyph per chapter — a fox, a crown, a
   moon — which is a label, not a memory. These are little painted scenes
   instead, one for the book itself and one for each game, drawn on the
   same pixel grid as everything else on this site and scaled up rather
   than smoothed, so they sit next to the adventure's own art without
   arguing with it.

   Nothing here is a file. It is all rectangles.
   ========================================================= */
const KS_W = 64, KS_H = 64;

/* Ouissy and Anwar, small enough to stand in a photograph. Built the way
   The Long Way Round builds its animals: flat pixel runs, an ink line
   where a shape needs an edge, and no anti-aliasing anywhere. */
const KS_OUI = { hair: "#ffd97a", hair2: "#e7b545", skin: "#ffe0c8", dress: "#ff8fb8",
                 dress2: "#e8628f", ink: "#3d2340", shoe: "#7a3f5c" };
const KS_ANW = { hair: "#3a2b33", hair2: "#241a20", skin: "#f6cfae", shirt: "#6fc7c1",
                 shirt2: "#3f9a97", ink: "#2b2030", trouser: "#3e4a6b" };

/* arms: "peace" is a V held up, "hold" reaches up to carry something,
   "wave" is one hand out. The body is the same either way. */
function ksArms(ctx, x, y, pose, tone, ink) {
  if (pose === "hold") {
    px(ctx, x - 1, y + 1, 2, 4, tone); px(ctx, x - 1, y, 2, 1, ink);
    px(ctx, x + 8, y + 1, 2, 4, tone); px(ctx, x + 8, y, 2, 1, ink);
  } else if (pose === "peace") {
    px(ctx, x + 8, y + 2, 2, 3, tone);            // forearm up
    px(ctx, x + 8, y, 1, 2, tone); px(ctx, x + 10, y, 1, 2, tone);   // two fingers
    px(ctx, x - 1, y + 4, 2, 3, tone);
  } else if (pose === "wave") {
    px(ctx, x + 8, y + 1, 2, 3, tone); px(ctx, x + 8, y - 1, 3, 2, tone);
    px(ctx, x - 1, y + 4, 2, 3, tone);
  } else {                                         // at her sides
    px(ctx, x - 1, y + 3, 2, 4, tone);
    px(ctx, x + 8, y + 3, 2, 4, tone);
  }
}

/* she is 8 wide and 16 tall, standing on (x, y) as her top-left */
function ksOuissy(ctx, x, y, pose) {
  const P = KS_OUI;
  px(ctx, x + 1, y, 6, 1, P.hair2);                // the crown of her head
  px(ctx, x, y + 1, 8, 3, P.hair);
  px(ctx, x + 1, y + 2, 6, 3, P.skin);             // face
  px(ctx, x, y + 2, 1, 7, P.hair); px(ctx, x + 7, y + 2, 1, 7, P.hair);   // the long sides
  px(ctx, x + 2, y + 3, 1, 1, P.ink); px(ctx, x + 5, y + 3, 1, 1, P.ink); // eyes
  px(ctx, x + 3, y + 4, 2, 1, "#ff9ec2");          // a small mouth
  ksArms(ctx, x, y + 6, pose, P.skin, P.ink);
  px(ctx, x + 1, y + 6, 6, 4, P.dress);            // bodice
  px(ctx, x, y + 10, 8, 3, P.dress2);              // the skirt flares
  px(ctx, x + 2, y + 13, 2, 2, P.skin); px(ctx, x + 4, y + 13, 2, 2, P.skin);
  px(ctx, x + 2, y + 15, 2, 1, P.shoe); px(ctx, x + 4, y + 15, 2, 1, P.shoe);
}

function ksAnwar(ctx, x, y, pose) {
  const P = KS_ANW;
  px(ctx, x + 1, y, 6, 2, P.hair2);
  px(ctx, x, y + 1, 8, 2, P.hair);
  px(ctx, x + 1, y + 3, 6, 3, P.skin);
  px(ctx, x + 2, y + 4, 1, 1, P.ink); px(ctx, x + 5, y + 4, 1, 1, P.ink);
  px(ctx, x + 3, y + 5, 2, 1, "#c8806a");
  ksArms(ctx, x, y + 7, pose, P.skin, P.ink);
  px(ctx, x + 1, y + 7, 6, 5, P.shirt);
  px(ctx, x + 1, y + 9, 6, 1, P.shirt2);
  px(ctx, x + 1, y + 12, 6, 3, P.trouser);
  px(ctx, x + 1, y + 15, 2, 1, P.ink); px(ctx, x + 5, y + 15, 2, 1, P.ink);
}

/* a band of sky, dithered the way the adventure dithers its own */
function ksSky(ctx, colours) {
  /* ditherSky wants stops with a position on them, so an even spread of
     whatever colours the scene names is enough */
  const stops = colours.map((c, i) => ({ p: i / (colours.length - 1 || 1), c: c }));
  ditherSky(ctx, 0, 0, KS_W, KS_H, stops);
}

function ksStars(ctx, n, seed, tone) {
  let s = seed;
  for (let i = 0; i < n; i++) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    px(ctx, s % KS_W, (s >> 8) % 30, 1, 1, tone || "#fff6e0");
  }
}

const KS_SCENES = {
  /* THE BOOK ITSELF, and the two of them holding it up. It is meant to be
     bigger than they are: the whole thing is the book, and they are two
     people inside it. */
  book(ctx) {
    ksSky(ctx, ["#fbe7d2", "#f6d6c6", "#efc3bd"]);
    ksStars(ctx, 14, 77, "#fff3dc");
    px(ctx, 14, 12, 36, 40, "#7a3524");            // the covers, stood upright
    px(ctx, 15, 13, 34, 38, "#a8452c");
    px(ctx, 17, 15, 30, 34, "#c05a38");
    px(ctx, 31, 12, 2, 40, "#5e2419");             // the spine down the middle
    px(ctx, 19, 18, 10, 2, "#f3d9a6"); px(ctx, 19, 22, 8, 1, "#e8c98f");
    px(ctx, 35, 18, 10, 2, "#f3d9a6"); px(ctx, 35, 22, 8, 1, "#e8c98f");
    drawHeartInto(ctx, 32, 33, 2, "#ffd3e0");      // the seal, the site's own heart
    drawHeartInto(ctx, 32, 33, 1, "#ff6f9c");
    px(ctx, 14, 51, 36, 2, "#5e2419");             // the shut edge
    ksOuissy(ctx, 6, 34, "hold");
    ksAnwar(ctx, 50, 34, "hold");
    px(ctx, 13, 34, 3, 2, "#ffe0c8");              // her hands on the edge of it
    px(ctx, 48, 34, 3, 2, "#f6cfae");              // and his on the other side
    px(ctx, 0, 60, KS_W, 4, "#e0b79a");            // the table it rests on
  },

  /* THE LONG WAY ROUND — the valley at dusk, the path she chose, and the
     fox that walks it with her. */
  quest(ctx) {
    ksSky(ctx, ["#3b2b5c", "#7b4a72", "#d98a72", "#f3c08a"]);
    px(ctx, 46, 10, 7, 7, "#ffeec2");              // a low sun
    for (let i = 0; i < 3; i++)                     // hills, back to front
      for (let x = 0; x < KS_W; x++) {
        const h = 34 + i * 6 + Math.round(Math.sin((x + i * 9) / 7) * 3);
        px(ctx, x, h, 1, KS_H - h, ["#3f5a44", "#33513f", "#2b4436"][i]);
      }
    for (let x = 0; x < KS_W; x++) {                // the path, winding away
      const w = Math.max(2, 10 - Math.round(x / 7));
      px(ctx, 28 + Math.round(Math.sin(x / 9) * 6), 64 - Math.round(x / 3.2), w, 2, "#c9a77a");
    }
    px(ctx, 6, 44, 5, 3, "#d2703a"); px(ctx, 5, 46, 7, 4, "#d2703a");   // the fox
    px(ctx, 6, 43, 1, 2, "#d2703a"); px(ctx, 10, 43, 1, 2, "#d2703a");
    px(ctx, 7, 45, 1, 1, "#2b2030"); px(ctx, 9, 45, 1, 1, "#2b2030");
    px(ctx, 11, 48, 4, 2, "#e08a4c");   /* the brush of a tail */
    ksOuissy(ctx, 22, 40, "peace");
    ksAnwar(ctx, 34, 40, "peace");
  },

  /* SUPER OUISSY — the meadow, a gift block, and the two of them under it. */
  ouissy(ctx) {
    ksSky(ctx, ["#8fd8f2", "#b9e8f6", "#dff4fb"]);
    px(ctx, 8, 8, 12, 4, "#ffffff"); px(ctx, 12, 6, 6, 3, "#ffffff");    // a cloud
    px(ctx, 40, 14, 10, 3, "#ffffff");
    px(ctx, 0, 46, KS_W, 4, "#7fc35a");            // the grass line
    px(ctx, 0, 50, KS_W, 14, "#b9834e");           // and the earth under it
    for (let x = 0; x < KS_W; x += 8) px(ctx, x + 2, 52, 3, 2, "#a2703f");
    px(ctx, 26, 18, 12, 12, "#f0b93c");            // the gift block
    px(ctx, 27, 19, 10, 10, "#ffd166");
    px(ctx, 26, 18, 12, 1, "#fff0c0"); px(ctx, 26, 29, 12, 1, "#c98f23");
    drawHeartInto(ctx, 32, 24, 1, "#ff5f95");
    ksOuissy(ctx, 18, 30, "peace");
    ksAnwar(ctx, 38, 30, "wave");
  },

  /* OUISSY AT THE APOCALYPSE — the city after it, the torch, and the two
     of them still walking through it together. */
  apoc(ctx) {
    ksSky(ctx, ["#0e1030", "#241a44", "#4a2b4e", "#7a3f52"]);
    ksStars(ctx, 20, 411, "#e8e2ff");
    px(ctx, 44, 8, 9, 9, "#efe6d0"); px(ctx, 46, 10, 4, 4, "#dcd0b4");   // the moon
    const sky = [[2, 26, 8, 22], [11, 20, 7, 28], [19, 30, 6, 18], [50, 24, 9, 24], [58, 32, 6, 16]];
    sky.forEach(([x, y, w, h], i) => {
      px(ctx, x, y, w, h, i % 2 ? "#1b1330" : "#241a3c");
      for (let ly = y + 3; ly < y + h - 2; ly += 5)
        for (let lx = x + 1; lx < x + w - 1; lx += 3)
          if ((lx + ly + i) % 4 === 0) px(ctx, lx, ly, 1, 2, "#ffcf7a");
    });
    px(ctx, 0, 52, KS_W, 12, "#2a2036");           // the road
    px(ctx, 0, 52, KS_W, 1, "#4a3a52");
    for (let x = 4; x < KS_W; x += 12) px(ctx, x, 57, 5, 1, "#6a5a70");
    /* the torch beam: a widening wedge, dithered so it fades into the
       street instead of sitting on it as a panel of grey */
    for (let i = 0; i < 14; i++) {
      const x = 42 + i, spread = Math.round(i / 3);
      for (let dy = -spread; dy <= spread; dy++) {
        if (((x * 3 + dy * 5 + i) & 7) > (i < 6 ? 2 : 1)) continue;
        px(ctx, x, 45 + dy, 1, 1, i < 7 ? "#ffe6ae" : "#d8b784");
      }
    }
    ksOuissy(ctx, 22, 36, "peace");
    ksAnwar(ctx, 32, 36, "none");
    px(ctx, 41, 42, 2, 2, "#ffe9b0");              // the torch itself
  },

  /* SUPER OUISSY RACE — memory lane, going away to a point, with the flag
     at the end of it. */
  race(ctx) {
    ksSky(ctx, ["#f6a76a", "#f7c98a", "#fbe3b4"]);
    px(ctx, 26, 10, 11, 11, "#fff1c4");            // the sun on the horizon
    px(ctx, 0, 30, KS_W, 4, "#79b06a");
    px(ctx, 0, 34, KS_W, 30, "#6b5f78");           // the road, widening at us
    for (let y = 34; y < 64; y++) {
      const w = Math.round((y - 34) * 1.5) + 6;
      px(ctx, 32 - w / 2, y, w, 1, "#5a4f68");
      if ((y >> 1) % 3 === 0) px(ctx, 31, y, 2, 1, "#f6e6c8");
    }
    for (let i = 0; i < 4; i++) {                  // the chequered flag
      for (let j = 0; j < 3; j++)
        px(ctx, 44 + i * 3, 12 + j * 3, 3, 3, (i + j) % 2 ? "#2b2030" : "#fdf6e6");
    }
    px(ctx, 43, 12, 1, 14, "#8a6a4a");
    ksOuissy(ctx, 14, 40, "wave");
    ksAnwar(ctx, 40, 40, "peace");
  },

  /* OUISSY'S NIGHT SHIFT — two doors, one charge, and six hours. Dark, but
     the two of them are in it together, which is the whole joke. */
  night(ctx) {
    px(ctx, 0, 0, KS_W, KS_H, "#0b0a14");
    px(ctx, 0, 0, KS_W, 20, "#141126");
    px(ctx, 2, 8, 14, 34, "#241d38");              // the left door
    px(ctx, 3, 9, 12, 32, "#0f0c1c");
    px(ctx, 48, 8, 14, 34, "#241d38");             // and the right one
    px(ctx, 49, 9, 12, 32, "#0f0c1c");
    px(ctx, 13, 24, 2, 3, "#c8b06a"); px(ctx, 49, 24, 2, 3, "#c8b06a");
    px(ctx, 22, 14, 20, 14, "#1d2b30");            // the monitor on the desk
    px(ctx, 23, 15, 18, 12, "#2f6f66");
    px(ctx, 24, 16, 16, 3, "#7fe0c8");
    for (let x = 24; x < 40; x += 3) px(ctx, x, 21, 2, 1, "#4fbfa6");
    px(ctx, 28, 28, 8, 2, "#1d2b30");
    px(ctx, 18, 42, 28, 4, "#3a2c22");             // the desk
    px(ctx, 18, 46, 28, 2, "#241a14");
    px(ctx, 6, 50, 12, 3, "#2a2438");              // the charge meter, most of it gone
    px(ctx, 6, 50, 4, 3, "#ffcf5a");
    px(ctx, 46, 50, 12, 3, "#2a2438"); px(ctx, 46, 50, 3, 3, "#ff7a6a");
    px(ctx, 0, 54, KS_W, 10, "#171327");
    /* the monitor throws just enough light to find them by */
    for (let y = 30; y < 62; y++)
      for (let x = 16; x < 48; x++)
        if (((x + y) & 3) === 0) px(ctx, x, y, 1, 1, "#2a3f47");
    ksOuissy(ctx, 20, 44, "peace");
    ksAnwar(ctx, 36, 44, "none");
    px(ctx, 0, 0, KS_W, KS_H, "rgba(20,10,40,.10)");   // and the dark over all of it
  },
};

/* Paints one and hands back a canvas sized to the card. The pixels are
   never smoothed: this is the same rule the maze art and the adventure
   both follow. */
function ksArt(kind) {
  const { c, ctx } = spriteCanvas(KS_W, KS_H);
  (KS_SCENES[kind] || KS_SCENES.book)(ctx);
  c.className = "ks-art";
  return c;
}

/* =========================================================
   KEEPSAKE — scrapbook recap
   ========================================================= */
const KEEPSAKE_CLOSING =
  "I built you worlds just to say it properly \u2014 that there is nowhere I " +
  "wouldn\u2019t go and nothing I wouldn\u2019t build to end up beside you. " +
  "This is only the part of it that fit on a screen.";

/* Icons are names of pixel glyphs in the sprite sheet at the top of
   index.html now, not emoji. This turns a name into the thing. */
function glyph(name, cls) {
  return '<svg class="gl ' + (cls || "gl-badge") + '" aria-hidden="true"><use href="#ic-' +
         name + '"/></svg>';
}

function startKeepsake() {
  const board = document.getElementById("ks-board");
  board.innerHTML = "";

  /* THE BOOK ITSELF, FIRST. Everything else on this board is a page of it,
     so the book goes at the front holding them all up — with the two of
     them holding IT up, which is the other way of reading the same
     picture. */
  const first = document.createElement("div");
  first.className = "ks-card";
  first.style.setProperty("--r", "-2.5deg");
  const ftape = document.createElement("span"); ftape.className = "ks-tape";
  const fimg = document.createElement("div"); fimg.className = "ks-img";
  fimg.appendChild(ksArt("book"));
  const fcap = document.createElement("div"); fcap.className = "ks-cap";
  fcap.textContent = "Our little book";
  first.appendChild(ftape); first.appendChild(fimg); first.appendChild(fcap);
  board.appendChild(first);

  /* A memory with no photograph in it yet is a placeholder, and a
     placeholder on this board is an empty frame with "[Memory title
     here]" written under it. The mechanism stays — the day a photo is
     added the card appears — but nothing empty goes on the wall. */
  MEMORIES.filter((m) => m.photo).forEach((m, i) => {
    const card = document.createElement("div");
    card.className = "ks-card";
    card.style.setProperty("--r", ((i % 2 ? 1 : -1) * (1.5 + (i % 3))) + "deg");
    card.innerHTML = `
      <span class="ks-tape"></span>
      <div class="ks-img">${m.photo ? `<img src="${m.photo}" alt="${m.title || ""}" style="width:100%;height:100%;object-fit:cover">` : glyph(m.icon || "px-camera")}</div>
      <div class="ks-cap">${m.title || ""}</div>`;
    board.appendChild(card);
  });

  /* the story chapter gets a card, and every bonus one she has finished,
     so the board reflects the whole visit */
  /* EVERY PAGE OF THE BOOK, NOT ONLY THE ONES SHE FINISHED.

     These used to appear one at a time as each chapter was completed, so
     the board she was shown depended on which device she happened to be
     on and how far she had got — half the games simply missing, with no
     way to tell they had ever existed. The keepsake is the book, and the
     book has all of its pages whether or not she has read them all.

     Ouissy's Night Shift is not on main yet: it goes on the board the day
     that chapter lands, and its picture is already drawn and waiting. */
  const badges = [
    { art: "quest",  cap: "The Long Way Round" },
    { art: "ouissy", cap: "Super Ouissy" },
    { art: "apoc",   cap: "Ouissy at the Apocalypse" },
    { art: "race",   cap: "Super Ouissy Race" },
  ];
  /* Ouissy's Night Shift is a page of this book whether or not the chapter
     itself has landed on main yet — the board is what the book contains,
     not what is currently playable. */
  badges.splice(3, 0, { art: "night", cap: "Ouissy\u2019s Night Shift" });
  badges.forEach((b, i) => {
    const card = document.createElement("div");
    card.className = "ks-card";
    card.style.setProperty("--r", (((i % 2) ? -1 : 1) * (1.5 + (i % 3))) + "deg");
    const tape = document.createElement("span"); tape.className = "ks-tape";
    const img = document.createElement("div"); img.className = "ks-img";
    img.appendChild(ksArt(b.art));
    const cap = document.createElement("div"); cap.className = "ks-cap";
    cap.textContent = b.cap;
    card.appendChild(tape); card.appendChild(img); card.appendChild(cap);
    board.appendChild(card);
  });

  /* What the walk up the valley remembers, on the board with everything
     else. Four routes, two endings and ten things to find, and until it
     was written down there was no way for her to know any of that
     existed — the chapter simply ticked itself off and said nothing. */
  hvLoadProgress();
  const walked = hvRouteCount(), read = hvEndingCount();
  const kept = Object.keys(HV_TOKENS).filter((k) => hvFound[k]);
  /* and only when she has actually brought something back from the walk —
     the shelf with nothing on it was the other empty frame */
  if (kept.length) {
    const card = document.createElement("div");
    card.className = "ks-card ks-card-walk";
    card.style.setProperty("--r", "-1.5deg");
    const shelf = document.createElement("div");
    shelf.className = "ks-walk-shelf";
    kept.forEach((k) => {
      const holder = document.createElement("span");
      holder.title = HV_TOKENS[k].name;
      holder.appendChild(hvDrawToken(k));
      shelf.appendChild(holder);
    });
    const tape = document.createElement("span");
    tape.className = "ks-tape";
    card.appendChild(tape);
    card.appendChild(shelf);
    const cap = document.createElement("div");
    cap.className = "ks-cap";
    cap.textContent = walked === 4
      ? "All four ways round · " + kept.length + " of " + Object.keys(HV_TOKENS).length
      : walked + " of 4 ways round · " + read + " of 2 endings";
    card.appendChild(cap);
    board.appendChild(card);
  }

  /* main dropped the "best maze time" suffix from this line; keeping
     that, and keeping the walk's own card above it. */
  document.getElementById("ks-sub").textContent = "every page, start to finish";
  document.getElementById("ks-closing").textContent = KEEPSAKE_CLOSING;
}

document.getElementById("ks-memories").addEventListener("click", () => {
  pageTurn("scrapbook", startDioramas);
});
document.getElementById("ks-replay").addEventListener("click", () => {
  pageTurn("hub", startHub);
});

/* =========================================================
   AMBIENT MUSIC
   No audio file was supplied, so the pad is synthesised with Web
   Audio: a few detuned sine voices drifting through a slow filter,
   plus an occasional soft bell. Preference is remembered.
   ========================================================= */
const MUSIC_KEY = "fal_music_on";
let audioCtx = null, musicNodes = null, musicOn = false, bellTimer = null;

/* The score in ost.js is a separate file and needs the same clock as
   the ambience bed and the effects — one context, one wake-up, one
   thing to resume when iOS takes the audio session away. Browsers cap
   how many AudioContexts a page may have, so this is not just tidiness. */
window.hvSharedCtx = function () {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  if (audioCtx && audioCtx.state === "closed") audioCtx = null;
  if (!audioCtx) {
    audioCtx = new AC();
    /* THE SOUND FOLLOWED YOU OUT OF THE BROWSER.

       Every other chapter hands its context to registerAudio, and
       hushAllAudio suspends the lot when the tab is hidden or the
       window loses focus. This one never did — the only thing
       registered here was the site's ambient pad, whose getter returns
       null unless that pad has been built, and it is off by default. So
       the adventure's air and its score played on a context nobody was
       ever going to suspend, and went on playing to an empty room.

       Registering the getter rather than the context because a closed
       context is unrecoverable and this function rebuilds it. */
    if (window.registerAudio) window.registerAudio(() => audioCtx);
  }
  return audioCtx;
};

/* Suspending the context is necessary and not sufficient. The score's
   scheduler and the ambience's bird-and-cricket chain are timers, and
   timers keep running in a hidden tab: they would go on posting notes
   onto a clock that had stopped and then hand the backlog over all at
   once on the way back in. Both are stopped on the way out and started
   again, re-anchored, on the way back. */
function hvHushChapter() {
  if (window.OST) window.OST.hush();
  if (hvAmb && hvAmb.timer) { clearTimeout(hvAmb.timer); hvAmb.timer = null; }
}

function hvResumeChapter() {
  const scr = document.getElementById("screen-quest");
  if (!scr || !scr.classList.contains("active")) return;
  if (!hvSoundOn) return;
  const n = HV[hvNode];
  /* the ambience rebuilds its own voice chain from the scene it is on */
  const scene = n && hvSceneOf(n);
  if (hvAmb) hvAmb.scene = null;         // force it to re-arm
  hvAmbience(scene);
  if (window.OST) window.OST.resume();
}

document.addEventListener("visibilitychange", () => {
  if (document.hidden) hvHushChapter(); else hvResumeChapter();
});
window.addEventListener("blur", hvHushChapter);
window.addEventListener("pagehide", hvHushChapter);
window.addEventListener("focus", hvResumeChapter);
window.addEventListener("pageshow", hvResumeChapter);

/* ---------------------------------------------------------
   KEEPING AUDIO ALIVE

   Every "the music just stopped and the toggle won't bring it back"
   report came down to the same two mistakes, so the recovery lives in
   one place and both the pad and the platformer go through it.

   1. Only "suspended" was treated as recoverable. iOS Safari does not
      use "suspended" when the system takes the audio session away — a
      call, the lock screen, another app, switching tabs — it uses
      "interrupted", which is not in the spec and which the old check
      silently ignored. So the sound died and stayed dead, and toggling
      it off and on could not help, because the toggle ran that same
      faulty check.

   2. resume() is asynchronous. The old code fired it and then scheduled
      a gain ramp against ctx.currentTime in the same breath — but a
      suspended context has a FROZEN clock, so by the time it really
      resumed, the whole ramp was already in the past. Silence, with
      every node reporting itself perfectly healthy.

   So: anything that is not "running" is treated as recoverable, work
   that depends on the clock waits for the resume to actually land, and
   a watchdog retries on the events that follow an interruption. A
   context in state "closed" can never be resumed at all — the only
   cure there is to build a new one, which the callers do.
   --------------------------------------------------------- */
const audioClients = [];

/* a getter, not a context: the caller may rebuild theirs at any point */
window.registerAudio = function (get) { audioClients.push(get); };

/* WHETHER THE SITE HAS PUT THE SOUND DOWN ON PURPOSE.

   hushAllAudio below suspends every context when you leave the page.
   A chapter that makes a sound while you are away — a scene still
   ticking in an unfocused window — used to resume the context to play
   it, which undid the hush and started the music again in your pocket.
   So every one of them asks this first. It is a flag we set ourselves,
   not a guess at the platform's state, so it can never keep the sound
   off on a page nobody has left. */
let audioHushed = false;
window.audioAsleep = function () { return audioHushed; };

window.wakeAudio = function (ctx, then) {
  if (!ctx || ctx.state === "closed") return;
  if (ctx.state === "running") { if (then) then(); return; }

  let fired = false;
  const fire = () => { if (!fired) { fired = true; if (then) then(); } };
  const tryResume = () => {
    try {
      const p = ctx.resume();
      if (p && p.then) p.then(fire, () => {});
      else fire();
    } catch (e) {}
  };
  tryResume();

  /* Safari can resolve resume() while still sitting in "interrupted".
     One delayed retry costs nothing and covers exactly that case. */
  setTimeout(() => {
    if (ctx.state === "running") fire();
    /* unless we have since left the page on purpose */
    else if (ctx.state !== "closed" && !audioHushed) tryResume();
  }, 350);
};

function pokeAllAudio() {
  audioHushed = false;
  audioClients.forEach((get) => { try { window.wakeAudio(get()); } catch (e) {} });
}

/* AND THE MOMENT IT SHOULD STOP.

   A browser does not suspend an AudioContext when you switch tabs or
   switch apps, and it is right not to: a music player should keep
   playing. A game should not. Every one of these listeners was about
   getting the sound back and not one of them was about letting it go,
   so leaving the page left a chapter playing to an empty room until you
   came back to it.

   Both signals are handled because the platforms disagree: a phone or a
   tablet sends the tab hidden, a desktop sends the window unfocused and
   leaves the tab visible. */
function hushAllAudio() {
  audioHushed = true;
  audioClients.forEach((get) => {
    try {
      const c = get();
      if (c && c.state === "running" && c.suspend) c.suspend();
    } catch (e) {}
  });
}
/* The moments an interrupted context can legally come back, and the
   ones on which it should go quiet. */
document.addEventListener("visibilitychange", () => {
  if (document.hidden) hushAllAudio(); else pokeAllAudio();
});
window.addEventListener("blur", hushAllAudio);
window.addEventListener("pagehide", hushAllAudio);
window.addEventListener("focus", pokeAllAudio);
window.addEventListener("pageshow", pokeAllAudio);
document.addEventListener("pointerdown", pokeAllAudio, true);

/* Off unless something explicitly asks for it. This pad is a continuous
   drone, and when the floating toggle was removed as a dead control I
   defaulted it ON — which left a noise starting on the first tap of the
   intro and running for the rest of the visit with nothing anywhere to
   stop it. The games bring their own music and effects; the site itself
   is quiet. */
function musicPreferred() {
  try { return localStorage.getItem(MUSIC_KEY) === "1"; } catch (e) { return false; }
}

function buildMusic() {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  const ctx = audioCtx || (audioCtx = new AC());

  const master = ctx.createGain();
  master.gain.value = 0.0001;
  master.connect(ctx.destination);

  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 900;
  filter.Q.value = 0.6;
  filter.connect(master);

  /* a warm open chord, each voice slightly detuned so it breathes */
  const freqs = [146.83, 220.0, 293.66, 369.99];  // D3 A3 D4 F#4
  const voices = freqs.map((f, i) => {
    const o = ctx.createOscillator();
    o.type = i % 2 ? "sine" : "triangle";
    o.frequency.value = f;
    o.detune.value = (i - 1.5) * 5;
    const g = ctx.createGain();
    g.gain.value = 0.16 / (i + 1);
    o.connect(g); g.connect(filter);
    o.start();

    /* slow drift so the pad never sits perfectly still */
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.03 + i * 0.017;
    const lg = ctx.createGain();
    lg.gain.value = 2.4;
    lfo.connect(lg); lg.connect(o.detune);
    lfo.start();
    return { o, g, lfo };
  });

  /* filter sweep */
  const sweep = ctx.createOscillator();
  sweep.frequency.value = 0.021;
  const sg = ctx.createGain();
  sg.gain.value = 320;
  sweep.connect(sg); sg.connect(filter.frequency);
  sweep.start();

  /* This used to return without rescheduling when the music was off,
     which quietly ended the chain for good: one bell landing during a
     silent stretch and there were never any bells again, even after she
     turned the music back on. startBells() owns restarting it now. */
  function bell() {
    bellTimer = null;
    if (!musicOn) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "sine";
    o.frequency.value = [587.33, 659.25, 880.0, 987.77][Math.floor(Math.random() * 4)];
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.055, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 3.4);
    o.connect(g); g.connect(filter);
    o.start(t); o.stop(t + 3.6);
    bellTimer = setTimeout(bell, 6000 + Math.random() * 9000);
  }

  return { ctx, master, voices, sweep, filter, bell };
}

function setMusic(on) {
  musicOn = on;
  try { localStorage.setItem(MUSIC_KEY, on ? "1" : "0"); } catch (e) {}

  if (on) {
    /* A closed context is unrecoverable, so throw the stale graph away
       and let buildMusic start clean rather than ramping nodes that
       belong to a context that no longer exists. */
    if (audioCtx && audioCtx.state === "closed") { audioCtx = null; musicNodes = null; }
    if (!musicNodes) musicNodes = buildMusic();
    if (!musicNodes) return;

    window.wakeAudio(musicNodes.ctx, () => {
      if (!musicOn || !musicNodes) return;       // she changed her mind while it woke
      rampMaster(0.24, 1.6);
      startBells();
    });
  } else if (musicNodes) {
    rampMaster(0.0001, 0.7);
    clearTimeout(bellTimer); bellTimer = null;
  }
}

/* Ramps are only ever scheduled on a running clock — see wakeAudio. */
function rampMaster(to, secs) {
  if (!musicNodes || musicNodes.ctx.state !== "running") return;
  const g = musicNodes.master.gain, t = musicNodes.ctx.currentTime;
  g.cancelScheduledValues(t);
  g.setValueAtTime(Math.max(0.0001, g.value), t);
  g.exponentialRampToValueAtTime(Math.max(0.0001, to), t + secs);
}

function startBells() {
  clearTimeout(bellTimer);
  if (musicNodes && musicNodes.bell) {
    bellTimer = setTimeout(musicNodes.bell, 3500 + Math.random() * 4000);
  }
}

/* A scene with music of its own (the platformer) turns the pad down while
   it plays and puts it back afterwards. It deliberately does NOT touch the
   saved preference, so her toggle still means what she set it to. */
window.duckAmbient = function (on) {
  if (!musicNodes || !musicOn) return;
  rampMaster(on ? 0.02 : 0.24, 0.6);
};

/* Read-only hooks for tools/audio.js. They report; they never drive. */
window.__audioProbe = () => ({
  on: musicOn,
  ctx: musicNodes ? musicNodes.ctx.state : "none",
  gain: musicNodes ? musicNodes.master.gain.value : 0,
  bell: bellTimer !== null,
});
window.__audioSuspend = () => { if (musicNodes) musicNodes.ctx.suspend(); };

(function initMusic() {
  window.registerAudio(() => (musicNodes ? musicNodes.ctx : null));

  /* Nothing starts on its own. setMusic(true) still works and everything
     below it is intact, so a real control can switch the pad back on the
     day there is one to switch — but a drone that begins by itself and
     cannot be stopped is not something to ship. */
  if (!musicPreferred()) return;
  const kick = () => setMusic(true);
  document.addEventListener("pointerdown", kick, { once: true });
  document.addEventListener("keydown", kick, { once: true });
})();

/* =========================================================
   PIXEL-ART ENGINE

   Everything the adventure draws goes through here. Scenes are
   painted onto a 320x180 canvas and scaled up with
   image-rendering:pixelated, so the pixel grid stays honest.

   The thing that separates flat pixel art from the good kind is
   tone count and dithering: skies get ordered-dither transitions
   instead of smooth gradients, and every solid form (canopy, hill,
   cloud) is built from at least three tones with a lit edge.
   ========================================================= */

const PXW = 320, PXH = 180;

/* 4x4 Bayer matrix — ordered dithering, the classic pixel-art gradient */
const BAYER4 = [
  [0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5],
];

function px(ctx, x, y, w, h, c) { ctx.fillStyle = c; ctx.fillRect(x | 0, y | 0, Math.max(1, w | 0), Math.max(1, h | 0)); }

/* Vertical dithered gradient through an arbitrary list of colour stops. */
function ditherSky(ctx, x0, y0, w, h, stops) {
  for (let y = 0; y < h; y++) {
    const t = y / (h - 1 || 1);
    // find the pair of stops we sit between
    let i = 0;
    while (i < stops.length - 2 && t > stops[i + 1].p) i++;
    const a = stops[i], b = stops[i + 1];
    const lt = (t - a.p) / ((b.p - a.p) || 1);
    for (let x = 0; x < w; x++) {
      const threshold = (BAYER4[y & 3][x & 3] + 0.5) / 16;
      ctx.fillStyle = lt > threshold ? b.c : a.c;
      ctx.fillRect(x0 + x, y0 + y, 1, 1);
    }
  }
}

/* A soft shaded blob — the building block of canopies and clouds. */
function blob(ctx, cx, cy, rx, ry, tones, lightFrom) {
  const lx = lightFrom ? lightFrom[0] : -0.5, ly = lightFrom ? lightFrom[1] : -0.6;
  for (let y = -ry; y <= ry; y++) {
    for (let x = -rx; x <= rx; x++) {
      const d = (x * x) / (rx * rx) + (y * y) / (ry * ry);
      if (d > 1) continue;
      // shade by how far the pixel is from the lit side
      const lit = (x / rx) * lx + (y / ry) * ly;
      let idx = lit > 0.34 ? 0 : lit > -0.05 ? 1 : lit > -0.5 ? 2 : 3;
      idx = Math.min(idx, tones.length - 1);
      ctx.fillStyle = tones[idx];
      ctx.fillRect((cx + x) | 0, (cy + y) | 0, 1, 1);
    }
  }
}

/* Layered leafy canopy: several overlapping blobs, then lit speckles. */
function canopy(ctx, cx, cy, r, tones, rnd, speckle) {
  const puffs = 5 + Math.floor(rnd() * 3);
  for (let i = 0; i < puffs; i++) {
    const a = (i / puffs) * Math.PI * 2 + rnd() * 0.6;
    const dx = Math.cos(a) * r * 0.46, dy = Math.sin(a) * r * 0.32;
    blob(ctx, cx + dx, cy + dy, r * (0.52 + rnd() * 0.2), r * (0.42 + rnd() * 0.16), tones);
  }
  blob(ctx, cx, cy, r * 0.78, r * 0.6, tones);
  if (speckle) {
    for (let i = 0; i < r * 2.2; i++) {
      const a = rnd() * Math.PI * 2, rr = rnd() * r * 0.85;
      px(ctx, cx + Math.cos(a) * rr, cy + Math.sin(a) * rr * 0.72, 1, 1, speckle);
    }
  }
}

function trunk(ctx, x, groundY, h, w, tones) {
  for (let y = 0; y < h; y++) {
    const yy = groundY - y;
    const taper = Math.max(1, Math.round(w * (1 - y / h * 0.32)));
    px(ctx, x - (taper >> 1), yy, taper, 1, tones[1]);
    px(ctx, x - (taper >> 1), yy, Math.max(1, taper >> 2), 1, tones[0]); // lit edge
    px(ctx, x + (taper >> 1) - 1, yy, 1, 1, tones[2]);                    // shadow edge
  }
}

/* rolling hill band with a lit crest */
function hillBand(ctx, W, baseY, amp, freq, tones, rnd, phase) {
  const ph = phase || rnd() * 10;
  for (let x = 0; x < W; x++) {
    const y = Math.round(baseY
      + Math.sin(x * freq + ph) * amp
      + Math.sin(x * freq * 2.3 + ph * 1.7) * amp * 0.35);
    px(ctx, x, y, 1, PXH - y, tones[1]);
    px(ctx, x, y, 1, 2, tones[0]);                 // sunlit crest
    px(ctx, x, y + 8, 1, PXH - y - 8, tones[2] || tones[1]);
  }
}

/* pixel clouds: three tones, flat bottom, puffy top */
function cloudRow(ctx, W, y, count, tones, rnd, scale) {
  for (let i = 0; i < count; i++) {
    const cx = rnd() * W, s = (0.7 + rnd() * 0.8) * (scale || 1);
    const w = Math.round(22 * s), h = Math.round(7 * s);
    const yy = y + Math.round((rnd() - 0.5) * 14);
    blob(ctx, cx, yy, w, h, tones);
    blob(ctx, cx - w * 0.5, yy + h * 0.3, w * 0.55, h * 0.7, tones);
    blob(ctx, cx + w * 0.55, yy + h * 0.25, w * 0.6, h * 0.75, tones);
    // flat lit underside
    px(ctx, cx - w, yy + h - 1, w * 2, 1, tones[0]);
  }
}

function pineRow(ctx, W, groundY, count, tones, rnd, scale) {
  for (let i = 0; i < count; i++) {
    const x = Math.round(rnd() * W), s = (0.7 + rnd() * 0.7) * (scale || 1);
    const h = Math.round(20 * s), w = Math.round(9 * s);
    for (let y = 0; y < h; y++) {
      const t = y / h;
      const ww = Math.round(w * t);
      px(ctx, x - ww, groundY - h + y, ww * 2 + 1, 1, t > 0.55 ? tones[1] : tones[0]);
    }
    px(ctx, x - 1, groundY - 2, 2, 3, tones[2] || tones[1]);
  }
}

function sunRays(ctx, cx, cy, W, H, colour, rnd, count) {
  ctx.save();
  ctx.globalAlpha = 0.16;
  for (let i = 0; i < (count || 5); i++) {
    const a = -1.35 + rnd() * 0.85;
    const len = H * (0.8 + rnd() * 0.5);
    const wdt = 3 + rnd() * 7;
    ctx.fillStyle = colour;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(a) * len - wdt, cy + Math.sin(a + 1.57) * len);
    ctx.lineTo(cx + Math.cos(a) * len + wdt, cy + Math.sin(a + 1.57) * len);
    ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}

function grassTufts(ctx, W, groundY, count, tones, rnd) {
  for (let i = 0; i < count; i++) {
    const x = Math.round(rnd() * W), h = 2 + Math.round(rnd() * 4);
    const c = tones[Math.floor(rnd() * tones.length)];
    for (let y = 0; y < h; y++) px(ctx, x + (y > h / 2 ? 1 : 0), groundY - y, 1, 1, c);
  }
}

function flowerDots(ctx, W, groundY, spread, count, colours, rnd) {
  for (let i = 0; i < count; i++) {
    const x = Math.round(rnd() * W), y = groundY + Math.round(rnd() * spread);
    const c = colours[Math.floor(rnd() * colours.length)];
    px(ctx, x, y, 1, 1, c);
    px(ctx, x - 1, y, 1, 1, c); px(ctx, x + 1, y, 1, 1, c);
    px(ctx, x, y - 1, 1, 1, c); px(ctx, x, y + 1, 1, 1, c);
    px(ctx, x, y, 1, 1, "#fff3c4");
  }
}

function sunDisc(ctx, cx, cy, r, core, halo) {
  for (let y = -r * 2; y <= r * 2; y++) {
    for (let x = -r * 2; x <= r * 2; x++) {
      const d = Math.sqrt(x * x + y * y);
      if (d <= r) px(ctx, cx + x, cy + y, 1, 1, core);
      else if (d <= r * 1.9 && ((BAYER4[(cy + y) & 3][(cx + x) & 3] + 0.5) / 16) < (1 - (d - r) / (r * 0.9)))
        px(ctx, cx + x, cy + y, 1, 1, halo);
    }
  }
}

/* sparkles / fireflies scattered through a scene */
function motes(ctx, W, H, count, colour, rnd, yMin, yMax) {
  for (let i = 0; i < count; i++) {
    const x = Math.round(rnd() * W);
    const y = Math.round((yMin || 0) + rnd() * ((yMax || H) - (yMin || 0)));
    px(ctx, x, y, 1, 1, colour);
    if (rnd() > 0.7) { px(ctx, x - 1, y, 1, 1, colour); px(ctx, x + 1, y, 1, 1, colour); px(ctx, x, y - 1, 1, 1, colour); px(ctx, x, y + 1, 1, 1, colour); }
  }
}

/* =========================================================
   SPRITES — every character drawn pixel by pixel
   Each returns its own canvas so it can be composited into a
   scene or shown on its own, always on the same pixel grid.
   ========================================================= */

function spriteCanvas(w, h) {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const ctx = c.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  return { c, ctx };
}

/* ---------- the cat: our narrator ---------- */
const CAT = { fur: "#fdfaf2", fur2: "#ece5d6", fur3: "#d6cdba", ink: "#3b3128", blush: "#ffb3c4" };

function drawCat(mood) {
  const { c, ctx } = spriteCanvas(40, 36);
  const F = CAT.fur, F2 = CAT.fur2, F3 = CAT.fur3, I = CAT.ink, B = CAT.blush;

  // tail curls round the right side
  px(ctx, 30, 26, 6, 3, F2); px(ctx, 34, 22, 3, 5, F2); px(ctx, 33, 20, 4, 2, F);

  // body
  px(ctx, 10, 18, 20, 15, F);
  px(ctx, 10, 29, 20, 4, F2);
  px(ctx, 11, 31, 18, 2, F3);

  // ears
  px(ctx, 10, 6, 5, 6, F); px(ctx, 25, 6, 5, 6, F);
  px(ctx, 11, 8, 3, 3, "#f2c9d4"); px(ctx, 26, 8, 3, 3, "#f2c9d4");

  // head
  px(ctx, 8, 9, 24, 14, F);
  px(ctx, 8, 20, 24, 3, F2);

  // paws
  px(ctx, 12, 30, 5, 3, F); px(ctx, 23, 30, 5, 3, F);

  if (mood === "cry") {
    // big teary eyes
    px(ctx, 12, 12, 7, 8, I); px(ctx, 21, 12, 7, 8, I);
    px(ctx, 13, 13, 3, 3, "#fff"); px(ctx, 22, 13, 3, 3, "#fff");
    px(ctx, 14, 17, 2, 2, "#fff"); px(ctx, 23, 17, 2, 2, "#fff");
    px(ctx, 13, 20, 3, 5, "#8fd0ee"); px(ctx, 23, 20, 3, 6, "#8fd0ee");
    px(ctx, 13, 24, 3, 3, "#b3e2f7"); px(ctx, 23, 25, 3, 3, "#b3e2f7");
    px(ctx, 18, 21, 4, 2, I);
  } else if (mood === "happy") {
    px(ctx, 13, 14, 4, 2, I); px(ctx, 23, 14, 4, 2, I);     // ^ ^ eyes
    px(ctx, 12, 15, 2, 2, I); px(ctx, 16, 15, 2, 2, I);
    px(ctx, 22, 15, 2, 2, I); px(ctx, 26, 15, 2, 2, I);
    px(ctx, 18, 18, 4, 2, "#e79aa8");
    px(ctx, 17, 20, 6, 2, I);
    px(ctx, 9, 16, 3, 3, B); px(ctx, 28, 16, 3, 3, B);
  } else if (mood === "shock") {
    px(ctx, 12, 12, 6, 7, "#fff"); px(ctx, 22, 12, 6, 7, "#fff");
    px(ctx, 14, 14, 3, 4, I); px(ctx, 24, 14, 3, 4, I);
    px(ctx, 17, 20, 6, 4, I);
  } else if (mood === "love") {
    px(ctx, 12, 13, 2, 2, "#ff5f8d"); px(ctx, 15, 13, 2, 2, "#ff5f8d");
    px(ctx, 12, 15, 5, 2, "#ff5f8d"); px(ctx, 13, 17, 3, 1, "#ff5f8d");
    px(ctx, 23, 13, 2, 2, "#ff5f8d"); px(ctx, 26, 13, 2, 2, "#ff5f8d");
    px(ctx, 23, 15, 5, 2, "#ff5f8d"); px(ctx, 24, 17, 3, 1, "#ff5f8d");
    px(ctx, 18, 19, 4, 2, "#e79aa8");
    px(ctx, 17, 21, 6, 1, I);
    px(ctx, 9, 16, 3, 3, B); px(ctx, 28, 16, 3, 3, B);
  } else { /* idle */
    px(ctx, 13, 13, 4, 5, I); px(ctx, 23, 13, 4, 5, I);
    px(ctx, 14, 14, 2, 2, "#fff"); px(ctx, 24, 14, 2, 2, "#fff");
    px(ctx, 18, 19, 4, 2, "#e79aa8");
    px(ctx, 17, 21, 6, 1, I);
    px(ctx, 9, 16, 3, 3, B); px(ctx, 28, 16, 3, 3, B);
  }
  // whiskers
  px(ctx, 4, 17, 4, 1, F3); px(ctx, 32, 17, 4, 1, F3);
  return c;
}

/* ---------- the bear: the jumpscare ---------- */
function drawBear() {
  const { c, ctx } = spriteCanvas(64, 56);
  const B1 = "#b5793f", B2 = "#96602f", B3 = "#754825", M = "#e8b98c";
  // arms flung wide
  px(ctx, 2, 12, 10, 8, B2); px(ctx, 0, 8, 8, 8, B1);
  px(ctx, 52, 12, 10, 8, B2); px(ctx, 56, 8, 8, 8, B1);
  px(ctx, 1, 6, 6, 4, B3); px(ctx, 57, 6, 6, 4, B3);   // claws
  // body
  px(ctx, 16, 20, 32, 30, B1);
  px(ctx, 20, 30, 24, 20, M);
  px(ctx, 16, 44, 32, 6, B2);
  // legs
  px(ctx, 18, 48, 11, 8, B2); px(ctx, 35, 48, 11, 8, B2);
  // ears
  px(ctx, 15, 2, 10, 9, B1); px(ctx, 39, 2, 10, 9, B1);
  px(ctx, 17, 4, 6, 5, B3); px(ctx, 41, 4, 6, 5, B3);
  // head
  px(ctx, 14, 6, 36, 22, B1);
  px(ctx, 22, 18, 20, 12, M);
  // eyes, furious
  px(ctx, 21, 12, 6, 5, "#fff"); px(ctx, 37, 12, 6, 5, "#fff");
  px(ctx, 23, 13, 3, 4, "#2a1a10"); px(ctx, 39, 13, 3, 4, "#2a1a10");
  px(ctx, 20, 9, 8, 2, B3); px(ctx, 36, 9, 8, 2, B3);
  // snout + roaring mouth
  px(ctx, 28, 19, 8, 4, B3);
  px(ctx, 25, 23, 14, 9, "#7a2a2a");
  px(ctx, 27, 23, 10, 3, "#fff");
  px(ctx, 28, 29, 8, 3, "#e0576b");
  return c;
}

/* ---------- fox, butterflies, letter ---------- */
function drawFox() {
  const { c, ctx } = spriteCanvas(38, 26);
  const O = "#f08b3c", O2 = "#d46f26", W = "#fff3e2", I = "#3b2a1a";
  px(ctx, 2, 12, 16, 6, O2); px(ctx, 0, 8, 8, 7, O); px(ctx, 0, 8, 5, 4, W);  // tail
  px(ctx, 14, 10, 16, 11, O);
  px(ctx, 16, 18, 12, 4, O2);
  px(ctx, 24, 4, 12, 11, O);            // head
  px(ctx, 24, 2, 5, 6, O2); px(ctx, 32, 2, 5, 6, O2);
  px(ctx, 25, 3, 3, 4, "#f7c4a0"); px(ctx, 33, 3, 3, 4, "#f7c4a0");
  px(ctx, 27, 10, 9, 5, W);
  px(ctx, 27, 7, 2, 3, I); px(ctx, 33, 7, 2, 3, I);
  px(ctx, 34, 11, 3, 2, I);
  px(ctx, 16, 21, 5, 4, O2); px(ctx, 24, 21, 5, 4, O2);
  return c;
}

/* A butterfly with its wings at a given openness. 0 is edge-on (wings
   together above the back), 1 is fully spread. Sliding a fixed sprite
   sideways reads as a sticker; the wings have to actually beat. */
/* The bear in the orchard, side on with its head down in the windfalls.
   drawBear() is the arms-flung-wide, mouth-open, straight-at-you pose,
   which was built for a jumpscare — using it here would have contradicted
   the line above it ("it has not looked up yet") in the same frame. This
   one is not looking at you and cannot be made to: it is an obstacle in a
   scene, and the whole beat is getting round it while it is busy. */
/* ONE BEAR, TWO HEADS.

   The grazing bear and the alert bear used to be two separate blocks of
   drawing code that were supposed to look like the same animal, and did
   not: the body was rebuilt line by line in each, and the orchard one
   was painted in daylight tans that sat on a night scene like a cut-out.

   So there is one body, and the head is the only thing that moves. The
   palette is passed in, which is how it can be a warm brown animal under
   lanterns instead of a beige one in the dark. */
function bearBody(ctx, T, lit, headUp) {
  /* Everything below is only judgeable magnified — tools/bearzoom.js
     draws all three poses at 5x on the grounds they actually stand on.
     Three faults were found that way and none of them were visible at
     the size the game draws them:

     1. The light along the back was a straight bar, so it read as a
        plank lying on the animal. Then it was a computed curve, which
        ran THROUGH the body because the blobs sit above the curve. It
        is found by scanning for the topmost drawn pixel of each column
        now, so it is on the edge by construction rather than by
        arithmetic that has to agree with the drawing.
     2. Two legs, not four — the pairs were wide enough to merge.
     3. Long thin legs read as stilts. A bear is a heavy animal on short
        legs; that silhouette is most of what says "bear". */

  blob(ctx, 13, 26, 9, 9, T);              // rump, rounded off
  blob(ctx, 23, 24, 11, 10, T);            // barrel
  blob(ctx, 33, 20, 12, 11, T);            // the hump over the shoulders
  blob(ctx, 45, headUp ? 22 : 26, 8, 7, T); // neck, overlapping both

  if (headUp) {
    blob(ctx, 54, 19, 6.5, 5.5, T);
    px(ctx, 58, 19, 5, 3, T[1]);
    px(ctx, 62, 19, 2, 2, T[3]);
    blob(ctx, 49, 14, 2.8, 2.6, T);
    blob(ctx, 57, 13, 2.6, 2.4, T);
    px(ctx, 56, 18, 1, 1, "#ffe8c0"); px(ctx, 60, 19, 1, 1, "#ffe8c0");
  } else {
    blob(ctx, 51, 29, 6.5, 5.5, T);        // head, tucked into the neck
    px(ctx, 55, 31, 5, 3, T[1]);
    px(ctx, 59, 32, 2, 2, T[3]);
    blob(ctx, 47, 25, 2.8, 2.6, T);
    blob(ctx, 54, 25, 2.6, 2.4, T);
    px(ctx, 53, 28, 1, 1, T[3]);
  }

  /* Four short, heavy legs. Far pair a tone back and set inboard. */
  function leg(x, top, w, h, tone) {
    px(ctx, x, top, w, h, tone);
    px(ctx, x - 1, top + h, w + 2, 2, T[3]);       // paw
  }
  leg(15, 32, 5, 9, T[2]);                  // far hind
  leg(34, 30, 5, 11, T[2]);                 // far fore
  leg(21, 33, 6, 8, T[1]);                  // near hind
  leg(40, 31, 6, 10, T[1]);                 // near fore

  /* The light it stands under, laid on the topmost drawn pixel of each
     column across the back only — so it hugs the outline whatever the
     blobs underneath happen to do. */
  if (lit) {
    var w = ctx.canvas.width, h = ctx.canvas.height;
    var d = ctx.getImageData(0, 0, w, h).data;
    for (var x = 10; x <= 50; x++) {
      for (var y = 0; y < h; y++) {
        if (d[(y * w + x) * 4 + 3] > 8) {
          if ((x & 1) === 0) px(ctx, x, y, 1, 1, lit);   // broken, not a wire
          break;
        }
      }
    }
  }
}

/* Under the lanterns, working through the windfalls. Warm browns with
   the lantern above it caught along its back — dark enough to belong to
   the orchard at night, light enough to be an animal and not a hole. */
const BEAR_NIGHT = ["#6b4a2e", "#523823", "#3c2819", "#2a1c11"];

function drawBearGrazing() {
  const { c, ctx } = spriteCanvas(64, 46);
  bearBody(ctx, BEAR_NIGHT, "#b98a52", false);
  return c;
}

/* The same bear with its head up. Not reared, not roaring — a bear that
   has stopped chewing and is looking down the row, which at four trees'
   distance is quite enough. Same body, different head, so the two poses
   cannot drift apart. */
function drawBearAlert() {
  const { c, ctx } = spriteCanvas(64, 46);
  bearBody(ctx, BEAR_NIGHT, "#d8a464", true);
  return c;
}

/* Something big, in the trees, that has stopped moving.

   The old version took the full-colour jumpscare bear and flooded it to
   one dark tone, then pasted two canopy puffs and a bush on top at
   hard-coded coordinates. In this scene those coordinates land in open
   grass between the path and the treeline, so what you actually got was
   a dark green lump sitting on the lawn with two bushes stuck to it —
   it read as a rendering fault, not as an animal.

   This is drawn for the job instead: the shoulder hump higher than the
   head, which is the one thing that says "bear" in silhouette at any
   size; a low forward head with a snout; four heavy legs; and a thin
   rim along the top where the light comes through the canopy behind it.
   Two faint catchlights, because the whole beat is that it might be
   looking at you. It is still deliberately hard to read — it turns out
   to be a deer — but it is hard to read the way a big animal behind
   leaves is hard to read. */
function drawBearLurking() {
  const { c, ctx } = spriteCanvas(64, 46);
  /* The same body as the one in the orchard — it was a second, separate
     drawing of the same animal, and the two had already drifted apart.
     Darker and cooler for a wood in shade, with the sun through the
     canopy on its back, and its head up because the line it illustrates
     is "and then does not move again". */
  bearBody(ctx, ["#4a4130", "#3a3325", "#2b261b", "#1f1b13"], "#8a7c58", true);
  return c;
}

/* Where it stands, in scene coordinates, painted into the wood itself.

   It is between the tree at 104 and the one at 252, on the same bank
   they are rooted in — so their trunks and crowns come down in front of
   it, and the ferns and grass the scene scatters afterwards cover its
   feet. Nothing is invented to hide it: everything in front of it is
   the wood's own. */
function hvPaintLurker(ctx) {
  var b = drawBearLurking();
  /* Behind the tree at x=104 and at that tree's depth, which is the
     part the first version got wrong: it was drawn nearly the height of
     the trunk it was standing beside, so instead of a bear in a wood you
     got something enormous and the tree read as a twig. He is up on the
     same bank the mid-distance trees are rooted in — about a third of
     that trunk — and their crowns and the scene's own ferns come down in
     front of him. */
  ctx.drawImage(b, 0, 0, b.width, b.height, 96, 90, 34, 24);
}

/* The bear, flooded to one flat dark tone.
   Drawing the painted bear at low opacity gave a washed-out tan shape
   that read as a shed in the middle distance. A silhouette is the point:
   she should be able to tell it is big and not be able to tell what it
   is, which is the whole of that beat. */
function drawBearShadow() {
  const { c, ctx } = spriteCanvas(64, 56);
  const b = drawBear();
  ctx.drawImage(b, 0, 0);
  ctx.globalCompositeOperation = "source-atop";
  ctx.fillStyle = "#20301c";
  ctx.fillRect(0, 0, 64, 56);
  ctx.globalCompositeOperation = "source-over";
  return c;
}

function drawButterfly(colour, open) {
  const spread = open === undefined ? 1 : Math.max(0.12, open);
  const { c, ctx } = spriteCanvas(22, 16);
  const A = colour === "blue" ? "#6fb4ee" : "#f4685a";
  const B = colour === "blue" ? "#3f82c6" : "#c8402f";
  const D = colour === "blue" ? "#2b5f96" : "#982c20";
  const E = colour === "blue" ? "#cfe8ff" : "#ffdcb0";
  const cx = 11;

  /* wing width collapses toward the body as they close, and the far
     wing sits a touch higher so there is a sense of turn */
  const w1 = 5.4 * spread, w2 = 3.8 * spread;
  blob(ctx, cx - w1 * 0.95, 5, w1, 4.2, [E, A, B, D]);
  blob(ctx, cx + w1 * 0.95, 5 - (1 - spread) * 1.2, w1, 4.2, [E, A, B, D]);
  blob(ctx, cx - w2 * 0.9, 10, w2, 3.2, [A, B, D, D]);
  blob(ctx, cx + w2 * 0.9, 10 - (1 - spread) * 1, w2, 3.2, [A, B, D, D]);

  if (spread > 0.55) {
    px(ctx, cx - w1 * 1.4, 4, 2, 1, E);
    px(ctx, cx + w1 * 0.9, 4, 2, 1, E);
  }
  px(ctx, cx - 1, 3, 2, 10, "#3b2a1a");
  px(ctx, cx - 1, 12, 2, 2, "#5a4230");
  px(ctx, cx - 3, 0, 1, 3, "#3b2a1a"); px(ctx, cx + 2, 0, 1, 3, "#3b2a1a");
  px(ctx, cx - 4, 0, 1, 1, "#3b2a1a"); px(ctx, cx + 3, 0, 1, 1, "#3b2a1a");
  return c;
}

/* The fox, alive: ears twitch, the tail sweeps, and it blinks. */
function drawFoxAlive(t) {
  const { c, ctx } = spriteCanvas(40, 28);
  const O = "#f08b3c", O2 = "#d46f26", W = "#fff3e2", I = "#3b2a1a";
  const sweep = Math.sin(t * 1.5) * 3;
  const earTwitch = (t % 3.4) > 3.2 ? -1 : 0;
  const blink = (t % 4.8) > 4.62;
  const breathe = Math.sin(t * 1.9) > 0 ? 0 : 1;

  // tail, sweeping behind
  px(ctx, 2, 13 + sweep * 0.4, 15, 6, O2);
  px(ctx, 0, 9 + sweep, 8, 7, O);
  px(ctx, 0, 9 + sweep, 5, 4, W);

  px(ctx, 15, 11 + breathe, 16, 11, O);
  px(ctx, 17, 19, 12, 4, O2);
  px(ctx, 25, 5, 12, 11, O);                       // head
  px(ctx, 25, 3 + earTwitch, 5, 6, O2);
  px(ctx, 33, 3, 5, 6, O2);
  px(ctx, 26, 4 + earTwitch, 3, 4, "#f7c4a0");
  px(ctx, 34, 4, 3, 4, "#f7c4a0");
  px(ctx, 28, 11, 9, 5, W);
  if (blink) { px(ctx, 28, 9, 2, 1, I); px(ctx, 34, 9, 2, 1, I); }
  else { px(ctx, 28, 8, 2, 3, I); px(ctx, 34, 8, 2, 3, I); }
  px(ctx, 35, 12, 3, 2, I);
  px(ctx, 17, 22, 5, 4, O2); px(ctx, 25, 22, 5, 4, O2);
  return c;
}

/* =========================================================
   THE TWO OF THEM

   The thing this chapter never had. Every line in it is about the pair
   of you walking somewhere together, and the frame those lines were
   written over had nobody in it at all — a valley, and a cat in the
   corner. So: two people, drawn from behind, on the path, holding
   hands, because that is the picture the writing keeps describing and
   the one it could never show.

   One character per pixel, fourteen to a row, the same way Super Ouissy
   builds her — change a string and you change a person. Keep every row
   fourteen long.

     .  nothing     K  ink          S  her skin    s  her skin, shaded
     H  hair dark   h  hair mid     i  hair shine
     D  dress       d  dress shade  L  dress light
     O  boot        o  boot shine
     A  his skin    N  his hair     n  his hair lit
     C  coat        c  coat shade   l  coat light   T  trousers
   ========================================================= */
const HVP = {
  K: "#33283c",
  S: "#ffe3cc", s: "#e9bda0",
  H: "#a8762a", h: "#dfae4c", i: "#ffeaad",
  D: "#ef7fa8", d: "#c85c85", L: "#ffb6cf",
  O: "#5e3b50", o: "#8a5a72",
  A: "#ffd9bd", N: "#3a2a22", n: "#54402f",
  C: "#3f5480", c: "#2b3a5e", l: "#61799f", T: "#39415e",
};

/* Her: long blonde hair down her back — that is the whole silhouette
   from behind — over a dress that flares at the hem. */
const HV_HER_BODY = [
  "....KKKKKK....",
  "..KKhhhhhhKK..",
  ".KhhiihhiihhK.",
  ".KhhhhiihhhhK.",
  ".Khhhhhhhhhhk.",
  ".KhhhhhhhhhhK.",
  "..KhhhhhhhhK..",
  "..KhhhhhhhhK..",
  ".KSKhhhhhhKSK.",
  ".KSKhhhhhhKSK.",
  ".KSKhHhhHhKSK.",
  ".KSKhHhhHhKSK.",
  ".KsKhhhhhhKsK.",
  ".KsKDhhhhDKsK.",
  "..KDDDDDDDDK..",
  ".KDDDDDDDDDDK.",
  ".KLDDDDDDDDdK.",
  "KLDDDDDDDDDDdK",
  "KDDDDDDDDDDDDK",
];
/* Him: shorter, darker hair, a coat that ends at the hip. Broader in
   the shoulder so the two silhouettes are never mistaken for each
   other at this size, which is the only thing that has to read. */
const HV_HIM_BODY = [
  ".....KKKK.....",
  "...KKNNNNKK...",
  "..KNNNNNNNNK..",
  "..KNNnnnnNNK..",
  "..KNNNNNNNNK..",
  "..KAAAAAAAAK..",
  ".KKAAAAAAAAKK.",
  "KCCCCCCCCCCCCK",
  "KClCCCCCCCCcCK",
  "KAKCCCCCCCCKAK",
  "KAKCCCCCCCCKAK",
  "KAKCCCCCCCCKAK",
  "KAKCCCCCCCCKAK",
  "KAKCCCCCCCCKAK",
  ".KKCCCCCCCCKK.",
  "..KCCCCCCCCK..",
  "..KCCCCCCCCK..",
  "..KccccccccK..",
  "..KTTTTTTTTK..",
  "..KTTTTTTTTK..",
];
/* Four frames: contact, pass, the other contact, pass again. Two rows
   of leg and two of boot is all there is room for, and it is enough —
   at this size a walk is legs crossing, not anatomy. */
const HV_HER_LEGS = [
  ["..SS......SS..", "..SS......SS..", ".KOOK....KOOK."],
  ["...SS....SS...", "...SS....SS...", "..KOOK..KOOK.."],
  ["....SS..SS....", "....SS..SS....", "...KOOKKOOK..."],
  ["...SS....SS...", "...SS....SS...", "..KOOK..KOOK.."],
];
const HV_HIM_LEGS = [
  ["..TT......TT..", "..TT......TT..", ".KOOK....KOOK."],
  ["...TT....TT...", "...TT....TT...", "..KOOK..KOOK.."],
  ["....TT..TT....", "....TT..TT....", "...KOOKKOOK..."],
  ["...TT....TT...", "...TT....TT...", "..KOOK..KOOK.."],
];

/* How the light in a place falls on a person standing in it. Without
   this the pair are two daylight sprites pasted onto a night, which is
   exactly what the bear used to look like. `wash` is the colour of the
   air between you and them; `rim` is what the one light source in the
   scene catches on the top of a head and a shoulder. */
const HV_LIGHT = {
  sakura:  null,
  forest:  { wash: "rgba(90,130,70,0.14)",  rim: "#fff6d0" },
  hollow:  { wash: "rgba(60,80,60,0.24)",   rim: "#ffe9a8" },
  meadow:  null,
  stream:  null,
  sunset:  { wash: "rgba(80,60,120,0.36)",  rim: "#ffbb84" },
  lantern: { wash: "rgba(50,45,105,0.42)",  rim: "#ffd08a" },
  ridge:   { wash: "rgba(34,44,104,0.52)",  rim: "#b9c6ff" },
  orchard: { wash: "rgba(46,38,80,0.44)",   rim: "#ffcf8a" },
  bridge:  { wash: "rgba(30,38,92,0.50)",   rim: "#ffd08a" },
  home:    { wash: "rgba(46,36,72,0.40)",   rim: "#ffd9a0" },
};

var hvFigCache = {};

/* Builds one figure, lit for the place it is standing in, and keeps it.
   Two people at four frames in eleven places is eighty-eight little
   canvases at the very most, and only the ones actually walked past are
   ever built. */
function hvFigure(who, frame, scene) {
  var key = who + frame + (scene || "-");
  if (hvFigCache[key]) return hvFigCache[key];

  var body = who === "her" ? HV_HER_BODY : HV_HIM_BODY;
  var legs = (who === "her" ? HV_HER_LEGS : HV_HIM_LEGS)[frame & 3];
  var rows = body.concat(legs);
  var made = spriteCanvas(14, rows.length);
  var ctx = made.ctx;

  for (var y = 0; y < rows.length; y++) {
    for (var x = 0; x < 14; x++) {
      var ch = rows[y][x];
      if (ch === "." || !HVP[ch]) continue;
      px(ctx, x, y, 1, 1, HVP[ch]);
    }
  }

  var light = HV_LIGHT[scene];
  if (light) {
    /* the wash goes only where there is already a person, so the
       silhouette stays clean */
    ctx.save();
    ctx.globalCompositeOperation = "source-atop";
    px(ctx, 0, 0, 14, rows.length, light.wash);
    ctx.restore();
    /* and one light down the left, which is where every lit thing in
       these night scenes hangs */
    ctx.save();
    ctx.globalCompositeOperation = "source-atop";
    ctx.globalAlpha = 0.3;
    /* head and shoulders only, every other row. Lighting the whole side
       drew an unbroken pale line down her that read as a walking stick,
       and a lantern hung in a tree would not have reached her boots
       anyway. */
    for (var ry = 0; ry < Math.min(12, rows.length); ry += 2) {
      for (var rx = 0; rx < 6; rx++) {
        if (rows[ry][rx] === "." || rows[ry][rx] === "K") continue;
        px(ctx, rx, ry, 1, 1, light.rim);
        break;
      }
    }
    ctx.restore();
  }

  hvFigCache[key] = made.c;
  return made.c;
}

/* The pair on the ground, at a scale, walking or not.

   `walk` is 0 while they are standing and climbs while they move, and
   it drives everything: which leg frame, how much they bob, how far her
   hair swings behind her. Standing still they breathe and she leans
   fractionally toward him, which is the whole reason they read as two
   people rather than two sprites parked side by side. */
function hvDrawPair(ctx, x, groundY, s, t, walk, scene) {
  var frame = walk > 0 ? (Math.floor(t * 7.5) & 3) : 1;
  var bob = walk > 0 ? (Math.abs(Math.sin(t * 7.5)) * 1.4) : Math.sin(t * 1.1) * 0.5;
  var her = hvFigure("her", frame, scene);
  var him = hvFigure("him", walk > 0 ? ((frame + 2) & 3) : 1, scene);

  var hw = 14 * s;
  var hx = Math.round(x - hw * 0.96);              // her, on the left
  var mx = Math.round(x + hw * 0.02);              // him, on the right
  var hy = Math.round(groundY - her.height * s - bob);
  var my = Math.round(groundY - him.height * s - (walk > 0 ? bob * 0.7 : -bob * 0.6));

  /* one shadow under the pair, not two — they are standing together.
     Flat, and sitting at their feet rather than around them: the first
     version was a fat ellipse centred on the boots, which swallowed the
     bottom two rows of both figures and took the walk with them. */
  ctx.save();
  ctx.globalAlpha = 0.26;
  blob(ctx, x + hw * 0.02, groundY + 1, hw * 1.15, Math.max(1, s * 0.7), ["#1b1424"]);
  ctx.restore();

  ctx.drawImage(her, 0, 0, her.width, her.height,
    hx, hy, Math.round(her.width * s), Math.round(her.height * s));
  ctx.drawImage(him, 0, 0, him.width, him.height,
    mx, my, Math.round(him.width * s), Math.round(him.height * s));

  /* the held hand: the gap between her right arm and his left, closed.
     It is two pixels wide and it is the point of the whole picture. */
  var handY = hy + Math.round(11 * s);
  px(ctx, hx + Math.round(12.5 * s), handY, Math.max(2, Math.round(s * 2.2)),
     Math.max(1, Math.round(s * 1.4)), HVP.S);
}

function drawEnvelope(open) {
  const { c, ctx } = spriteCanvas(44, 32);
  const P = "#fffaf0", P2 = "#efe3cd", L = "#d8c9ad";
  px(ctx, 2, 6, 40, 24, P);
  px(ctx, 2, 6, 40, 1, L); px(ctx, 2, 29, 40, 1, L);
  px(ctx, 2, 6, 1, 24, L); px(ctx, 41, 6, 1, 24, L);
  if (open) {
    px(ctx, 4, 0, 36, 8, P2);
    for (let i = 0; i < 18; i++) { px(ctx, 4 + i, 8 - Math.floor(i / 2.4), 1, 1, L); px(ctx, 39 - i, 8 - Math.floor(i / 2.4), 1, 1, L); }
    px(ctx, 8, 12, 28, 2, "#e6d8bf"); px(ctx, 8, 17, 22, 2, "#e6d8bf"); px(ctx, 8, 22, 25, 2, "#e6d8bf");
  } else {
    for (let i = 0; i < 20; i++) { px(ctx, 2 + i, 6 + Math.floor(i * 0.62), 1, 1, L); px(ctx, 41 - i, 6 + Math.floor(i * 0.62), 1, 1, L); }
    drawHeartInto(ctx, 22, 17, 1, "#e8617f");
  }
  return c;
}

function drawHeartInto(ctx, cx, cy, s, colour) {
  const rows = [
    "0110110", "1111111", "1111111", "0111110", "0011100", "0001000",
  ];
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      if (row[x] === "1") px(ctx, cx - 3 * s + x * s, cy - 3 * s + y * s, s, s, colour);
    }
  });
}

function drawHeartCard() {
  const { c, ctx } = spriteCanvas(28, 28);
  drawHeartInto(ctx, 14, 13, 3, "#ef5f83");
  drawHeartInto(ctx, 13, 12, 1, "#ff9fb6");
  return c;
}

function drawFlowerCard() {
  const { c, ctx } = spriteCanvas(28, 28);
  const P1 = "#f582b0", P2 = "#e0699a", P3 = "#ffc2da";
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    blob(ctx, 14 + Math.cos(a) * 7, 12 + Math.sin(a) * 5, 4.5, 3.4, [P3, P1, P2, P2]);
  }
  blob(ctx, 14, 12, 4, 3, ["#ffe9a0", "#ffd166", "#e0a92f", "#c08c22"]);
  px(ctx, 13, 16, 2, 9, "#4f8a3a");
  px(ctx, 8, 20, 6, 3, "#5ea347"); px(ctx, 15, 22, 6, 3, "#5ea347");
  return c;
}

function drawNyan() {
  const { c, ctx } = spriteCanvas(46, 16);
  const bands = ["#ff4d4d", "#ff9d3c", "#ffe14d", "#5fd35f", "#4da6ff", "#a45fff"];
  bands.forEach((b, i) => px(ctx, 0, 2 + i * 2, 26, 2, b));
  px(ctx, 24, 3, 14, 10, "#f7d0dd");     // pop-tart body
  px(ctx, 26, 5, 10, 6, "#ffb3c9");
  for (let i = 0; i < 6; i++) px(ctx, 27 + (i % 3) * 3, 6 + Math.floor(i / 3) * 3, 1, 1, "#e8617f");
  px(ctx, 36, 2, 9, 9, "#b8b8b8");       // head
  px(ctx, 36, 1, 3, 3, "#b8b8b8"); px(ctx, 42, 1, 3, 3, "#b8b8b8");
  px(ctx, 38, 5, 2, 2, "#2a2a2a"); px(ctx, 42, 5, 2, 2, "#2a2a2a");
  px(ctx, 39, 8, 3, 1, "#2a2a2a");
  return c;
}

/* ---------- the title logo, drawn as pixel letters ---------- */
/* The title screen said HEARTVENTURE and the hub card said The Long Way
   Round, and they are the same chapter. The card is the name she picks
   it by, so the card wins and the alphabet grew the letters it needed
   to say so. */
const HV_FONT = {
  H: ["101", "101", "111", "101", "101"], E: ["111", "100", "111", "100", "111"],
  A: ["111", "101", "111", "101", "101"], R: ["111", "101", "111", "110", "101"],
  T: ["111", "010", "010", "010", "010"], V: ["101", "101", "101", "101", "010"],
  N: ["1001", "1101", "1011", "1001", "1001"], U: ["101", "101", "101", "101", "111"],
  L: ["100", "100", "100", "100", "111"], O: ["111", "101", "101", "101", "111"],
  D: ["110", "101", "101", "101", "110"],
  /* G and N get four columns each for the same reason W gets five: at
     three, G is an O with a nick out of it and N is a solid block. */
  G: ["1111", "1000", "1011", "1001", "1111"],
  Y: ["101", "101", "010", "010", "010"],
  /* Five wide, because three is not enough room for a W: at three it
     comes out as a K, and the title read THE LONG KAY ROUND. Glyphs
     carry their own width now rather than all being three. */
  W: ["10001", "10001", "10101", "11011", "10001"],
  " ": ["00", "00", "00", "00", "00"],
};
/* A line of it, or two if the text carries a newline — "THE LONG WAY"
   over "ROUND" fits a 320-wide frame where one line of eighteen
   characters never could. */
function drawLogo(text) {
  /* two screen pixels a cell, drawn at 1:1 — about the width the old
     one-line logo came out at, and every pixel on the grid */
  const ch = 5, gap = 1, s = 2;
  const lines = text.split("\n");
  const widthOf = (line) => line.split("").reduce(
    (w, c2) => w + ((HV_FONT[c2] || HV_FONT[" "])[0].length + gap), 0) - gap;
  const widest = lines.reduce((m, l) => Math.max(m, widthOf(l)), 0);
  const lineH = ch * s + 2 * s;
  const { c, ctx } = spriteCanvas(widest * s, lineH * lines.length);
  lines.forEach((line, li) => {
    let cx = Math.round((widest - widthOf(line)) / 2) * s;   // centred on the widest
    line.split("").forEach((ch2) => {
      const g = HV_FONT[ch2] || HV_FONT[" "];
      const gw = g[0].length;
      for (let y = 0; y < ch; y++) {
        for (let x = 0; x < gw; x++) {
          if (g[y][x] !== "1") continue;
          const dx = cx + x * s, dy = li * lineH + y * s + s;
          px(ctx, dx, dy + s, s, s, "#b8365f");        // drop shadow
          px(ctx, dx, dy, s, s, "#ff5f8d");            // face
          px(ctx, dx, dy, s, Math.max(1, s / 3), "#ffa8c0");  // top light
        }
      }
      cx += (gw + gap) * s;
    });
  });
  return c;
}

/* ---------- trees ----------
   A tree is a trunk that flares at the root, leans a little, splits into
   branches, and carries a canopy that OVERLAPS the top of the trunk so
   the join is hidden. Drawing a straight pole with a ball floating above
   it is what made the first version look wrong. */

function trunkCurve(ctx, x, groundY, h, w, tones, lean, rnd) {
  /* returns the top-centre point so branches and canopy can attach */
  var topX = x + (lean || 0) * h * 0.16;
  for (var i = 0; i < h; i++) {
    var t = i / h;                                  // 0 at root, 1 at top
    var y = groundY - i;
    var cx = x + (lean || 0) * h * 0.16 * (t * t);  // lean grows with height
    // taper, with a flare in the bottom eighth
    var flare = t < 0.12 ? (1 + (0.12 - t) * 5.2) : 1;
    var ww = Math.max(2, Math.round(w * (1 - t * 0.42) * flare));
    var half = ww >> 1;
    px(ctx, cx - half, y, ww, 1, tones[1]);
    // lit edge, fading out toward the top
    px(ctx, cx - half, y, Math.max(1, Math.round(ww * 0.28)), 1, tones[0]);
    // shadow edge
    px(ctx, cx + half - 1, y, 1, 1, tones[2]);
    // bark grain: short broken vertical marks, not a continuous stripe
    if (rnd && ww > 3 && rnd() > 0.72) {
      px(ctx, cx - half + 1 + Math.floor(rnd() * (ww - 2)), y, 1, 1, tones[2]);
    }
  }
  // roots spreading into the ground
  if (rnd) {
    for (var r = 0; r < 3; r++) {
      var dir = r === 1 ? 0 : (r === 0 ? -1 : 1);
      var rl = 2 + Math.floor(rnd() * 3);
      for (var k = 0; k < rl; k++) {
        px(ctx, x + dir * (w * 0.5 + k), groundY + Math.floor(k * 0.5), 2, 1, tones[2]);
      }
    }
  }
  return topX;
}

function branchArm(ctx, x, y, len, ang, w, tones) {
  for (var i = 0; i < len; i++) {
    var bx = x + Math.cos(ang) * i;
    var by = y + Math.sin(ang) * i;
    var ww = Math.max(1, Math.round(w * (1 - i / len * 0.7)));
    px(ctx, bx, by, ww, ww, tones[1]);
    if (i < len * 0.4) px(ctx, bx, by, 1, 1, tones[0]);
  }
  return [x + Math.cos(ang) * len, y + Math.sin(ang) * len];
}

/* A full tree: trunk, branches, and a canopy that sits over the join. */
function treeFull(ctx, x, groundY, h, barkTones, leafTones, rnd, opts) {
  opts = opts || {};
  var w = opts.w || Math.max(3, Math.round(h * 0.10));
  var lean = opts.lean !== undefined ? opts.lean : (rnd() - 0.5) * 0.7;
  var topX = trunkCurve(ctx, x, groundY, h, w, barkTones, lean, rnd);
  var topY = groundY - h;

  // branches fanning out just below the crown
  var arms = opts.arms === undefined ? 3 : opts.arms;
  var tips = [];
  for (var i = 0; i < arms; i++) {
    var a = -Math.PI / 2 + (i - (arms - 1) / 2) * (0.55 + rnd() * 0.2);
    var bl = h * (0.16 + rnd() * 0.12);
    tips.push(branchArm(ctx, topX, topY + h * 0.14, bl, a, Math.max(1, w * 0.4), barkTones));
  }

  // canopy: a mass of overlapping puffs centred over the trunk top, sized
  // so it always covers where trunk and branches end
  var r = opts.r || h * 0.52;
  var cy = topY + r * 0.16;
  canopy(ctx, topX, cy, r, leafTones, rnd, opts.speckle);
  tips.forEach(function (tp) {
    blob(ctx, tp[0], tp[1] - r * 0.18, r * 0.46, r * 0.36, leafTones);
  });
  // a few leaves catching light on top
  if (opts.speckle) {
    for (var k = 0; k < r * 0.9; k++) {
      var aa = rnd() * Math.PI * 2, rr = rnd() * r * 0.8;
      px(ctx, topX + Math.cos(aa) * rr, cy + Math.sin(aa) * rr * 0.7 - r * 0.15, 1, 1, opts.speckle);
    }
  }
  return { x: topX, y: cy, r: r };
}

/* Overhead canopy: boughs reaching in from the top of the frame, each
   with a visible limb and clusters of leaves hanging off it, shaded
   darker underneath. Free-floating ellipses in the sky read as green
   clouds — a canopy has to be attached to something. */
function overheadCanopy(ctx, W, rnd, tones, barkTones, count, reach) {
  var boughs = count || 5;
  for (var i = 0; i < boughs; i++) {
    var rootX = Math.round((i + 0.5) / boughs * W + (rnd() - 0.5) * 24);
    var dir = rootX < W / 2 ? 1 : -1;
    var len = (reach || 44) * (0.7 + rnd() * 0.6);
    var ang = (dir > 0 ? 0.55 : Math.PI - 0.55) + (rnd() - 0.5) * 0.4;

    // the limb itself, thinning as it reaches in
    var lx = rootX, ly = -3;
    for (var k = 0; k < len; k++) {
      var t = k / len;
      var w = Math.max(1, Math.round(4 * (1 - t * 0.65)));
      lx += Math.cos(ang) * 1;
      ly += Math.sin(ang) * 1;
      px(ctx, lx, ly, w, w, barkTones[1]);
      if (k % 9 === 0) px(ctx, lx, ly, 1, 1, barkTones[0]);
      // side twigs
      if (k > len * 0.3 && k % 11 === 0) {
        var ta = ang + (rnd() > 0.5 ? 0.9 : -0.9);
        for (var m = 0; m < 7; m++) px(ctx, lx + Math.cos(ta) * m, ly + Math.sin(ta) * m, 1, 1, barkTones[2]);
      }
    }

    // leaf clusters hanging along the limb
    var clusters = 3 + Math.floor(rnd() * 3);
    for (var c = 0; c < clusters; c++) {
      var ct = 0.18 + (c / clusters) * 0.85;
      var cx = rootX + Math.cos(ang) * len * ct;
      var cy = -3 + Math.sin(ang) * len * ct;
      var r = 10 + rnd() * 8;
      canopy(ctx, cx, cy, r, tones, rnd, "#cbe89c");
      // shaded underside so the mass has weight
      for (var u = -r; u < r; u += 1) {
        if (rnd() > 0.55) px(ctx, cx + u, cy + r * 0.52 + rnd() * 3, 1, 1, tones[3] || tones[2]);
      }
    }
  }
}

/* A birch: pale, slender, gently curved, with irregular bark scars and a
   canopy of its own so it is never a pole disappearing into a green band. */
function birch(ctx, x, groundY, h, rnd, opts) {
  opts = opts || {};
  var w = opts.w || Math.max(3, Math.round(h * 0.075));
  var bark = ["#f6f1e6", "#ddd3bf", "#b6ab93"];
  var lean = opts.lean !== undefined ? opts.lean : (rnd() - 0.5) * 0.5;
  var topX = trunkCurve(ctx, x, groundY, h, w, bark, lean, rnd);
  var topY = groundY - h;

  // scars: irregular length, irregular spacing, some doubled
  var y = groundY - 6;
  while (y > topY + h * 0.18) {
    var sw = 2 + Math.floor(rnd() * (w + 1));
    var sx = x + (rnd() - 0.5) * (w * 0.5);
    px(ctx, sx - (sw >> 1), y, sw, 1, "#6f6858");
    if (rnd() > 0.7) px(ctx, sx - (sw >> 1) + 1, y - 1, Math.max(1, sw - 2), 1, "#8d8570");
    y -= 8 + Math.floor(rnd() * 14);
  }

  var leaves = opts.leaves || ["#a8cc72", "#87b055", "#67903f", "#4d722e"];
  var r = opts.r || h * 0.34;
  for (var i = 0; i < 2; i++) {
    var a = -Math.PI / 2 + (i ? 0.7 : -0.7);
    branchArm(ctx, topX, topY + h * 0.12, h * 0.12, a, 2, bark);
  }
  canopy(ctx, topX, topY + r * 0.2, r, leaves, rnd, "#c8e79a");
  return { x: topX, y: topY, r: r };
}

/* =========================================================
   SCENES — the backgrounds the adventure walks through

   Built in depth order: sky, far range, mid band, near band,
   foreground. Each band is a different tone family and a different
   density of detail, which is what gives a flat pixel scene the
   feeling of distance.
   ========================================================= */

/* a winding path that narrows toward the horizon, with kerb stones */
function pathTo(ctx, W, yTop, yBot, curve, wTop, wBot, cTop, cMid, cEdge) {
  for (var y = yTop; y < yBot; y++) {
    var t = (y - yTop) / (yBot - yTop);
    var cx = Math.round(W * 0.5 + Math.sin(t * curve) * (26 + t * 14));
    var w = Math.round(wTop + t * (wBot - wTop));
    px(ctx, cx - (w >> 1), y, w, 1, t > 0.45 ? cMid : cTop);
    px(ctx, cx - (w >> 1), y, 2, 1, cEdge);
    px(ctx, cx + (w >> 1) - 2, y, 2, 1, cEdge);
    // worn ruts
    if ((y & 3) === 0) px(ctx, cx - (w >> 3), y, Math.max(1, w >> 3), 1, cTop);
  }
}

function bush(ctx, x, y, r, tones, rnd) {
  blob(ctx, x, y, r, r * 0.68, tones);
  blob(ctx, x - r * 0.6, y + r * 0.2, r * 0.6, r * 0.46, tones);
  blob(ctx, x + r * 0.62, y + r * 0.18, r * 0.62, r * 0.48, tones);
  for (var i = 0; i < r; i++) px(ctx, x - r + rnd() * r * 2, y - r * 0.5 + rnd() * r, 1, 1, tones[0]);
}

function stones(ctx, W, y, count, tones, rnd) {
  for (var i = 0; i < count; i++) {
    var x = rnd() * W, s = 1 + rnd() * 2.5;
    blob(ctx, x, y + rnd() * 10, s * 1.6, s, tones);
  }
}

/* A paper lantern on a wire: the light source the whole right-hand path
   is lit by, so it is one function rather than eight copies. */
function lanternAt(ctx, x, y) {
  /* The glow first, in rings, so the light falls off instead of being a
     flat rectangle over the paper — this is the only light source on the
     whole right-hand path and it has to look like one. */
  var rings = [[16, 0.05], [12, 0.08], [9, 0.12], [6, 0.18]];
  for (var i = 0; i < rings.length; i++) {
    blob(ctx, x, y + 3, rings[i][0], rings[i][0] * 0.9,
         ["rgba(255,208,132," + rings[i][1] + ")"]);
  }
  px(ctx, x, y - 5, 1, 2, "#3a2a1e");                 // the hook
  blob(ctx, x, y + 3, 5, 6, ["#ffd98a", "#f0a95e", "#c87a44"]);
  px(ctx, x - 1, y - 1, 3, 1, "#fff2c8");             // the flame inside
  px(ctx, x - 3, y + 9, 7, 1, "#8a5a38");             // the tassel
}

const HV_SCENES = {

  /* 1. cherry-blossom park — the title screen and the first choice */
  sakura(ctx, rnd) {
    ditherSky(ctx, 0, 0, PXW, PXH, [
      { p: 0.00, c: "#a9dcf2" }, { p: 0.24, c: "#c6e6f5" },
      { p: 0.46, c: "#e6eff5" }, { p: 0.64, c: "#f8e6ee" }, { p: 1.00, c: "#ffeef4" },
    ]);
    cloudRow(ctx, PXW, 22, 5, ["#ffffff", "#f6f8fc", "#e4eaf4", "#d0d9e9"], rnd, 1.15);
    cloudRow(ctx, PXW, 44, 3, ["#fdfeff", "#eff4fa", "#dde5f0", "#cbd5e6"], rnd, 0.75);

    /* far hills, hazed toward the sky so they sit back */
    hillBand(ctx, PXW, 84, 5, 0.016, ["#cfe0c6", "#bcd3b4", "#a9c4a2"], rnd, 1.2);
    hillBand(ctx, PXW, 92, 4, 0.024, ["#bcd6b0", "#a7c69c", "#94b489"], rnd, 3.4);

    /* a distant blossom line — small, pale, low contrast */
    for (var i = 0; i < 16; i++) {
      var bx = rnd() * PXW;
      blob(ctx, bx, 88 + rnd() * 6, 11 + rnd() * 8, 6 + rnd() * 4,
        ["#ffe3ee", "#f9cfe0", "#efbdd2", "#e3adc4"]);
      px(ctx, bx, 94, 2, 6, "#b99a8a");
    }

    /* grass, blending out of the hill line rather than cutting */
    ditherSky(ctx, 0, 98, PXW, PXH - 98, [
      { p: 0.00, c: "#9ecb72" }, { p: 0.22, c: "#8fc064" },
      { p: 0.6, c: "#7fb056" }, { p: 1.00, c: "#6b9a46" },
    ]);

    pathTo(ctx, PXW, 112, PXH, 1.5, 11, 74, "#eddcb8", "#e0cba1", "#cdb689");
    stones(ctx, PXW, 150, 14, ["#d6c9ab", "#bfb094", "#a2937a"], rnd);

    /* mid blossom trees — varied heights so the canopy is not a band */
    var sak = ["#ffdcea", "#f9c2d8", "#eda9c5", "#d98fb0"];
    var midTrees = [[26, 116, 21], [82, 110, 15], [148, 118, 24], [210, 112, 17], [268, 116, 20], [304, 108, 14]];
    midTrees.forEach(function (t) {
      trunk(ctx, t[0], t[1], Math.round(t[2] * 1.5), Math.max(3, Math.round(t[2] * 0.26)),
        ["#a8794f", "#8a6039", "#6b4526"]);
      canopy(ctx, t[0], t[1] - t[2] * 1.62, t[2], sak, rnd, "#fff2f7");
    });

    /* near trees, bigger and darker, framing the edges */
    [[8, 140, 30], [PXW - 12, 136, 33]].forEach(function (t) {
      trunk(ctx, t[0], t[1], Math.round(t[2] * 1.7), Math.round(t[2] * 0.3),
        ["#9c6f46", "#7d5432", "#5e3d22"]);
      canopy(ctx, t[0], t[1] - t[2] * 1.75, t[2], ["#ffd2e4", "#f2b3ce", "#e09bba", "#c8809f"], rnd, "#fff6fa");
    });

    bush(ctx, 44, 148, 8, ["#8fc064", "#7aa94f", "#63903c", "#4e7530"], rnd);
    bush(ctx, PXW - 52, 152, 9, ["#8fc064", "#7aa94f", "#63903c", "#4e7530"], rnd);
    bush(ctx, 118, 168, 7, ["#96c86b", "#7fae52", "#67953e", "#517a31"], rnd);

    grassTufts(ctx, PXW, 126, 150, ["#8fc063", "#7ba84f", "#a4d178"], rnd);
    flowerDots(ctx, PXW, 122, 52, 40, ["#ffffff", "#ffe6f0", "#ffd166", "#ffc2da"], rnd);
    // fallen petals collecting on the grass
    for (var k = 0; k < 60; k++) px(ctx, rnd() * PXW, 118 + rnd() * 60, 2, 1, "#ffcfe0");
  },

  /* 2. deep forest — the secret path */
  /* `opts.lurker` is drawn after the ground and BEFORE the trees, so
     the wood's own trunks and crowns are in front of whatever it is —
     real occlusion by the real trees, rather than a cut-out with fresh
     bushes invented around it to hide the joins. */
  forest(ctx, rnd, opts) {
    ditherSky(ctx, 0, 0, PXW, PXH, [
      { p: 0.00, c: "#8fcfe4" }, { p: 0.22, c: "#b2dfe8" },
      { p: 0.44, c: "#d2ead9" }, { p: 1.00, c: "#bcd9a8" },
    ]);
    sunRays(ctx, PXW * 0.32, -14, PXW, PXH, "#fff8d8", rnd, 7);

    /* open sky overhead — the trees stand in the scene, nothing hangs */
    cloudRow(ctx, PXW, 20, 4, ["#ffffff", "#f4f8fc", "#e2e9f2", "#cfd8e6"], rnd, 1.15);
    cloudRow(ctx, PXW, 40, 3, ["#fdfeff", "#eef4fa", "#dce5f0", "#c9d4e4"], rnd, 0.8);

    ditherSky(ctx, 0, 104, PXW, PXH - 104, [
      { p: 0.00, c: "#7fae54" }, { p: 0.35, c: "#6b9945" }, { p: 1.00, c: "#527a34" },
    ]);
    pathTo(ctx, PXW, 112, PXH, 2.1, 10, 78, "#c9aa79", "#b99a68", "#a4855a");

    /* the fork the story talks about — a second track peeling left */
    for (var y = 126; y < 168; y++) {
      var t = (y - 126) / 42;
      var fx = Math.round(PXW * 0.5 - 30 - t * 62);
      px(ctx, fx, y, Math.round(6 + t * 16), 1, "#bda06f");
    }

    stones(ctx, PXW, 140, 18, ["#a89b82", "#8d8170", "#6f6558"], rnd);

    var bark = ["#a37a4c", "#836039", "#644727"];
    var leaf = ["#a3c96e", "#84ac52", "#65873b", "#4b6729"];

    if (opts && opts.lurker) opts.lurker(ctx);

    /* Mid-distance trees: full crowns, grounded on the bank behind the path.
       Sized so the canopy is always wider than the trunk is tall-looking. */
    [[54, 116, 46], [252, 114, 42], [104, 110, 34]].forEach(function (t) {
      treeFull(ctx, t[0], t[1], t[2], bark, leaf, rnd, { speckle: "#cbe89c" });
    });

    /* Framing trees at the very edges. Their trunks stop well below the top
       of the frame and the crown spills off the corner, so the trunk never
       runs the whole height with a clipped ball stuck on the end. */
    [[10, 118, -0.5], [PXW - 14, 122, 0.5]].forEach(function (t) {
      var h = t[1];
      var topX = trunkCurve(ctx, t[0], PXH, h, 15, bark, t[2], rnd);
      var topY = PXH - h;
      branchArm(ctx, topX, topY + 16, 22, -Math.PI / 2 + (t[2] > 0 ? -0.75 : 0.75), 5, bark);
      canopy(ctx, topX + (t[2] > 0 ? -10 : 10), topY - 4, 40, leaf, rnd, "#cbe89c");
      canopy(ctx, topX + (t[2] > 0 ? -34 : 34), topY + 10, 26, leaf, rnd, "#cbe89c");
    });

    bush(ctx, 74, 156, 10, ["#8bb057", "#739642", "#5c7c33", "#476226"], rnd);
    bush(ctx, PXW - 84, 162, 11, ["#8bb057", "#739642", "#5c7c33", "#476226"], rnd);
    // ferns
    for (var f = 0; f < 16; f++) {
      var fx2 = rnd() * PXW, fy = 140 + rnd() * 36;
      for (var b2 = 0; b2 < 5; b2++) {
        var a2 = -1.2 + b2 * 0.6;
        px(ctx, fx2 + Math.cos(a2) * 5, fy + Math.sin(a2) * 4 - 3, 2, 1, "#6f9440");
      }
    }
    grassTufts(ctx, PXW, 124, 140, ["#7fab4e", "#93bd5e", "#6a9440"], rnd);
    flowerDots(ctx, PXW, 138, 34, 16, ["#ffffff", "#ffd166", "#c9a0ff"], rnd);
  },

  /* 3. mushroom hollow — where the fox is */
  hollow(ctx, rnd) {
    ditherSky(ctx, 0, 0, PXW, PXH, [
      { p: 0.00, c: "#7fc2dc" }, { p: 0.28, c: "#a8d5dd" },
      { p: 0.54, c: "#c9e2c6" }, { p: 1.00, c: "#b2cf9c" },
    ]);
    sunRays(ctx, PXW * 0.62, -10, PXW, PXH, "#fffbe0", rnd, 6);
    cloudRow(ctx, PXW, 22, 4, ["#ffffff", "#f3f8fb", "#e0e9f0", "#ccd7e2"], rnd, 1.05);
    cloudRow(ctx, PXW, 44, 2, ["#fdfeff", "#edf4f8", "#d9e4ec", "#c5d2de"], rnd, 0.75);

    ditherSky(ctx, 0, 116, PXW, PXH - 116, [
      { p: 0.00, c: "#7aa54c" }, { p: 0.42, c: "#658c3c" }, { p: 1.00, c: "#4e6d2f" },
    ]);
    pathTo(ctx, PXW, 122, PXH, 1.2, 12, 66, "#c2a473", "#ae9163", "#997d52");

    /* Birches, each carrying its own crown. Previously these were
       untapered poles that ran up into a canopy band they were not
       attached to, which read as fence posts. */
    [[34, 152, 118, -0.4], [88, 148, 96, 0.25], [PXW - 46, 154, 112, 0.35],
     [PXW - 104, 146, 88, -0.2], [162, 142, 72, 0.15]].forEach(function (t) {
      birch(ctx, t[0], t[1], t[2], rnd, { lean: t[3],
        leaves: ["#a8cc72", "#87b055", "#67903f", "#4d722e"] });
    });

    /* red-capped mushrooms, in a cluster like the reference */
    [[70, 144, 1.7], [96, 152, 1.15], [110, 143, 0.85], [PXW - 92, 148, 1.8],
     [PXW - 62, 156, 1.05], [PXW - 118, 158, 0.9]].forEach(function (m) {
      var x = m[0], y = m[1], s = m[2];
      px(ctx, x - Math.round(3 * s), y, Math.round(6 * s), Math.round(12 * s), "#f2e8d2");
      px(ctx, x - Math.round(3 * s), y, Math.round(2 * s), Math.round(12 * s), "#fffaf0");
      blob(ctx, x, y - Math.round(2 * s), Math.round(11 * s), Math.round(6.5 * s),
        ["#f7715a", "#dd4f3a", "#b83a28", "#8f2a1d"]);
      for (var k2 = 0; k2 < 5; k2++) {
        px(ctx, x - 7 * s + rnd() * 14 * s, y - 5 * s + rnd() * 5 * s, 2, 1, "#fff3e0");
      }
      // a little glow under the cap
      px(ctx, x - Math.round(4 * s), y - 1, Math.round(8 * s), 1, "#ffb99a");
    });

    bush(ctx, 138, 168, 9, ["#83a653", "#6b8b41", "#557032", "#425826"], rnd);
    bush(ctx, PXW - 146, 172, 8, ["#83a653", "#6b8b41", "#557032", "#425826"], rnd);
    stones(ctx, PXW, 150, 16, ["#a89b82", "#8d8170", "#6f6558"], rnd);
    grassTufts(ctx, PXW, 132, 150, ["#7fab4e", "#93bd5e", "#5f8639"], rnd);
    flowerDots(ctx, PXW, 130, 46, 26, ["#ff8fa8", "#ffd166", "#ffffff", "#c9a0ff"], rnd);
  },

  /* 4. golden meadow — "it's getting dark" */
  meadow(ctx, rnd) {
    ditherSky(ctx, 0, 0, PXW, PXH, [
      { p: 0.00, c: "#7fb8dc" }, { p: 0.20, c: "#b0d4e4" },
      { p: 0.40, c: "#ecdcae" }, { p: 0.58, c: "#f8cf8c" },
      { p: 0.76, c: "#f0b878" }, { p: 1.00, c: "#dda668" },
    ]);
    cloudRow(ctx, PXW, 30, 4, ["#fff3d6", "#f7dcae", "#e8c088", "#d0a068"], rnd, 1.2);
    sunDisc(ctx, Math.round(PXW * 0.66), 60, 14, "#fffdf0", "#ffeeb8");
    sunRays(ctx, PXW * 0.66, 60, PXW, PXH, "#fff3c8", rnd, 8);

    hillBand(ctx, PXW, 92, 6, 0.018, ["#d6cf86", "#b6ae66", "#968f4f"], rnd, 0.5);
    hillBand(ctx, PXW, 104, 5, 0.026, ["#c6bd72", "#a49b56", "#867e43"], rnd, 2.6);
    hillBand(ctx, PXW, 118, 4, 0.034, ["#b8ae64", "#98904c", "#7a733a"], rnd, 4.8);

    ditherSky(ctx, 0, 130, PXW, PXH - 130, [
      { p: 0.00, c: "#c6b85e" }, { p: 0.5, c: "#aa9c4a" }, { p: 1.00, c: "#8b7f39" },
    ]);
    pathTo(ctx, PXW, 134, PXH, 1.0, 10, 60, "#e0cd8e", "#cbb87b", "#b4a268");

    /* backlit trees — dark shapes with a hot rim on the sun side */
    [[42, 1.05], [PXW - 56, 0.9], [136, 0.62], [212, 0.5]].forEach(function (t) {
      trunk(ctx, t[0], 136, Math.round(48 * t[1]), Math.round(6 * t[1]), ["#7a6a3c", "#5e5230", "#463c22"]);
      canopy(ctx, t[0], 136 - 48 * t[1], 21 * t[1],
        ["#d6cf86", "#9c9a52", "#73723a", "#56562c"], rnd, "#fff0b8");
    });
    // fence posts leading off toward the light
    for (var f = 0; f < 8; f++) {
      var fx = 30 + f * 36, fy = 142 + f * 2;
      px(ctx, fx, fy - 12, 2, 12, "#8a7a48");
      if (f) px(ctx, fx - 34, fy - 9, 34, 1, "#8a7a48");
    }
    grassTufts(ctx, PXW, 142, 190, ["#d2c46a", "#b8ab58", "#e0d27c"], rnd);
    flowerDots(ctx, PXW, 146, 30, 22, ["#fff3c4", "#ffd166", "#ffffff"], rnd);
  },

  /* 5. sunset lake — the ask */
  sunset(ctx, rnd) {
    ditherSky(ctx, 0, 0, PXW, PXH, [
      { p: 0.00, c: "#33306a" }, { p: 0.16, c: "#514585" },
      { p: 0.32, c: "#7d5798" }, { p: 0.46, c: "#bf7290" },
      { p: 0.58, c: "#ee9a72" }, { p: 0.66, c: "#f5b982" },
      { p: 0.74, c: "#7fa8d8" }, { p: 1.00, c: "#42639c" },
    ]);
    for (var i = 0; i < 90; i++) {
      var sy = rnd() * 34;
      px(ctx, rnd() * PXW, sy, 1, 1, sy < 16 ? "#fff8e0" : "#ffe9c0");
    }

    /* the banded clouds, lit underneath */
    var cl = ["#ffd8a0", "#f7a278", "#e07a62", "#b45a5c"];
    for (var b = 0; b < 6; b++) {
      var y = 24 + b * 11 + rnd() * 4;
      var n = 2 + Math.floor(rnd() * 3);
      for (var k = 0; k < n; k++) {
        var cx = rnd() * PXW, w = 26 + rnd() * 34, h = 3 + rnd() * 3;
        blob(ctx, cx, y, w, h, cl);
        px(ctx, cx - w, y + h - 1, w * 2, 1, "#ffe3b0");
      }
    }

    hillBand(ctx, PXW, 84, 13, 0.015, ["#5f74a8", "#4c5f8e", "#3e5078"], rnd, 2);
    hillBand(ctx, PXW, 96, 9, 0.024, ["#42588a", "#364a70", "#2c3d5e"], rnd, 5);
    hillBand(ctx, PXW, 108, 6, 0.033, ["#33475e", "#293a4e", "#20303f"], rnd, 8);

    pineRow(ctx, PXW, 124, 52, ["#2d4c54", "#203a42", "#172a30"], rnd, 1.05);

    /* the lake, with a sun road down the middle */
    ditherSky(ctx, 0, 124, PXW, 22, [
      { p: 0.00, c: "#7fa2ce" }, { p: 0.45, c: "#5b81a8" }, { p: 1.00, c: "#43608a" },
    ]);
    for (var w2 = 0; w2 < 54; w2++) px(ctx, rnd() * PXW, 125 + rnd() * 20, 2 + rnd() * 5, 1, "#a4c2e4");
    for (var g = 0; g < 26; g++) {
      px(ctx, PXW * 0.44 + rnd() * 44, 125 + rnd() * 19, 1 + rnd() * 4, 1, rnd() > 0.5 ? "#ffdca8" : "#ffc482");
    }

    px(ctx, 0, 144, PXW, 6, "#31402f");
    ditherSky(ctx, 0, 149, PXW, PXH - 149, [
      { p: 0.00, c: "#4c5f46" }, { p: 0.45, c: "#3d4f3a" }, { p: 1.00, c: "#2c3a2b" },
    ]);
    // reeds along the bank
    for (var r3 = 0; r3 < 30; r3++) {
      var rx = rnd() * PXW, rh = 5 + rnd() * 9;
      for (var y2 = 0; y2 < rh; y2++) px(ctx, rx + (y2 > rh / 2 ? 1 : 0), 149 - y2, 1, 1, "#54684a");
    }
    grassTufts(ctx, PXW, 158, 150, ["#5c7050", "#4a5c42", "#6b8159"], rnd);
    flowerDots(ctx, PXW, 154, 30, 54, ["#ff9ec4", "#ffd166", "#c9a0ff", "#ffffff"], rnd);
  },
  /* ===================================================================
     THE WAY BACK — the right-hand path.

     Same valley, a year on, after dark. Where the spring side is open
     and bright and full of everything you have not done yet, this one is
     warm and close and lit by things somebody had to hang up: lanterns,
     windows, a fire. It is the difference between finding each other and
     staying, and it should feel like it.
     =================================================================== */

  /* 5. the lantern path — where the right-hand journey begins */
  lantern(ctx, rnd) {
    ditherSky(ctx, 0, 0, PXW, PXH, [
      { p: 0.00, c: "#171a3a" }, { p: 0.22, c: "#22254e" },
      { p: 0.44, c: "#3a3160" }, { p: 0.62, c: "#5d3f65" },
      { p: 0.78, c: "#8a5560" }, { p: 1.00, c: "#b87a63" },
    ]);
    for (var i = 0; i < 70; i++) {
      var sy = rnd() * 60;
      px(ctx, rnd() * PXW, sy, 1, 1, sy < 26 ? "#fff6d8" : "#e8dcc0");
    }
    /* a low moon, sitting in the last of the light */
    sunDisc(ctx, PXW - 54, 34, 9, "#fdf3d0", "rgba(255,240,200,0.16)");

    hillBand(ctx, PXW, 92, 11, 0.019, ["#3b3358", "#2f2a48", "#251f38"], rnd, 3);
    hillBand(ctx, PXW, 106, 8, 0.03, ["#2b2742", "#221e35", "#1a1729"], rnd, 7);
    pineRow(ctx, PXW, 122, 46, ["#1d2a30", "#162126", "#101a1e"], rnd, 1.0);

    /* the ground, and the path home through it */
    px(ctx, 0, 120, PXW, PXH - 120, "#2a2b34");
    ditherSky(ctx, 0, 120, PXW, PXH - 120, [
      { p: 0.00, c: "#33323f" }, { p: 1.00, c: "#22222c" },
    ]);
    pathTo(ctx, PXW, 122, PXH, 0.04, 12, 62, "#6b5a48", "#54473a", "#3d342c");
    grassTufts(ctx, PXW, 126, 40, ["#2f3a2e", "#26301f", "#1d2618"], rnd);
    stones(ctx, PXW, 150, 9, ["#4a4650", "#3a3742", "#2c2a33"], rnd);

    /* the lanterns themselves, strung along the path */
    for (var L = 0; L < 5; L++) {
      var lx = 26 + L * 62 + rnd() * 10, ly = 74 + rnd() * 8;
      px(ctx, lx, 0, 1, ly - 6, "#171a2c");           // the wire up into the dark
      /* the pool it throws on the path below it */
      blob(ctx, lx, 138 + rnd() * 8, 22, 5, ["rgba(255,198,120,0.10)"]);
      blob(ctx, lx, 138 + rnd() * 8, 13, 3, ["rgba(255,208,140,0.13)"]);
      lanternAt(ctx, lx, ly);
    }
    /* fireflies, because a warm night should have some */
    for (var f = 0; f < 22; f++) {
      var fx = rnd() * PXW, fy = 96 + rnd() * 56;
      px(ctx, fx, fy, 1, 1, rnd() > 0.5 ? "#ffe9a0" : "#ffd06a");
      px(ctx, fx - 1, fy, 3, 1, "rgba(255,220,140,0.16)");
    }
  },

  /* 6. the ridge — the blue butterfly's way, high and open and cold */
  ridge(ctx, rnd) {
    ditherSky(ctx, 0, 0, PXW, PXH, [
      { p: 0.00, c: "#0d1230" }, { p: 0.34, c: "#182046" },
      { p: 0.66, c: "#2b2f5c" }, { p: 1.00, c: "#46406e" },
    ]);
    for (var i = 0; i < 150; i++) {
      var sy = rnd() * 96, b = rnd();
      px(ctx, rnd() * PXW, sy, 1, 1, b > 0.86 ? "#ffffff" : b > 0.5 ? "#dfe6ff" : "#9aa6d8");
    }
    /* the one bright one, low over the ridge */
    px(ctx, 214, 30, 1, 1, "#ffffff");
    px(ctx, 213, 30, 3, 1, "rgba(255,255,255,0.5)");
    px(ctx, 214, 29, 1, 3, "rgba(255,255,255,0.5)");

    hillBand(ctx, PXW, 74, 16, 0.013, ["#2a2f58", "#222648", "#1a1d38"], rnd, 1);
    hillBand(ctx, PXW, 96, 12, 0.022, ["#1f2342", "#191c34", "#131627"], rnd, 6);
    pineRow(ctx, PXW, 116, 30, ["#141d24", "#0f161c", "#0a1014"], rnd, 0.9);

    /* the ridge line she is standing on, bare rock and thin grass */
    px(ctx, 0, 116, PXW, PXH - 116, "#1c2029");
    ditherSky(ctx, 0, 116, PXW, PXH - 116, [
      { p: 0.00, c: "#242835" }, { p: 1.00, c: "#161922" },
    ]);
    stones(ctx, PXW, 132, 14, ["#3d4250", "#2f3340", "#232630"], rnd);
    stones(ctx, PXW, 158, 10, ["#343946", "#282c37", "#1d2029"], rnd);
    grassTufts(ctx, PXW, 122, 26, ["#243026", "#1d271e", "#161e17"], rnd);
  },

  /* 7. the night orchard — the red butterfly's way, low and close and warm */
  orchard(ctx, rnd) {
    ditherSky(ctx, 0, 0, PXW, PXH, [
      { p: 0.00, c: "#1a1636" }, { p: 0.36, c: "#2a2048" },
      { p: 0.68, c: "#452a4e" }, { p: 1.00, c: "#6b3a48" },
    ]);
    for (var i = 0; i < 60; i++) px(ctx, rnd() * PXW, rnd() * 54, 1, 1, "#efe4c4");
    sunDisc(ctx, 42, 28, 7, "#f6ecc8", "rgba(246,236,200,0.13)");

    hillBand(ctx, PXW, 98, 8, 0.026, ["#33254a", "#291d3b", "#20172e"], rnd, 4);

    px(ctx, 0, 116, PXW, PXH - 116, "#2c2733");
    ditherSky(ctx, 0, 116, PXW, PXH - 116, [
      { p: 0.00, c: "#37303c", }, { p: 1.00, c: "#241f2b" },
    ]);

    /* rows of fruit trees, each with a lantern hung in it */
    var bark = ["#4a3428", "#3a2820", "#2b1e18"];
    var leaf = ["#2f4436", "#26382c", "#1c2a21"];
    for (var r = 0; r < 5; r++) {
      var tx = 18 + r * 66 + rnd() * 12;
      treeFull(ctx, tx, 120 + (r % 2) * 4, 44 + rnd() * 10, bark, leaf, rnd, { speckle: 10 });
      if (r % 2 === 0) lanternAt(ctx, tx + 12, 84 + rnd() * 6);
    }
    grassTufts(ctx, PXW, 124, 34, ["#2b3a2c", "#22301f", "#192518"], rnd);
    flowerDots(ctx, PXW, 138, 26, 22, ["#c88aa0", "#a86e8a", "#e0a8b8"], rnd);
  },

  /* 8. the rope bridge — one at a time, or not at all */
  bridge(ctx, rnd) {
    ditherSky(ctx, 0, 0, PXW, PXH, [
      { p: 0.00, c: "#121736" }, { p: 0.40, c: "#1e2448" },
      { p: 0.72, c: "#33305c" }, { p: 1.00, c: "#4d3a5e" },
    ]);
    for (var i = 0; i < 110; i++) px(ctx, rnd() * PXW, rnd() * 80, 1, 1, "#d8dcf0");

    hillBand(ctx, PXW, 70, 14, 0.016, ["#262b50", "#1e2240", "#171a31"], rnd, 2);
    pineRow(ctx, PXW, 96, 26, ["#111a20", "#0c1318", "#080d11"], rnd, 0.8);

    /* the gorge: dark all the way down, with water a long way below */
    px(ctx, 0, 96, PXW, PXH - 96, "#0b0e16");
    ditherSky(ctx, 0, 150, PXW, PXH - 150, [
      { p: 0.00, c: "#1b2740" }, { p: 1.00, c: "#101a2c" },
    ]);
    for (var w = 0; w < 26; w++) {
      var wx = rnd() * PXW, wy = 152 + rnd() * 24;
      px(ctx, wx, wy, 2 + rnd() * 4, 1, "rgba(150,180,220,0.28)");
    }

    /* the near and far banks */
    px(ctx, 0, 96, 54, PXH - 96, "#231f2b");
    px(ctx, PXW - 58, 96, 58, PXH - 96, "#231f2b");
    stones(ctx, 54, 104, 6, ["#3b3644", "#2e2a36", "#221f29"], rnd);

    /* the bridge itself — two ropes and a lot of trust */
    var y0 = 106, sag = 16;
    for (var x = 54; x < PXW - 58; x++) {
      var k = (x - 54) / (PXW - 112);
      var y = y0 + Math.sin(k * Math.PI) * sag;
      px(ctx, x, y, 1, 1, "#7a6248");
      px(ctx, x, y - 13, 1, 1, "#5e4b38");
      if ((x - 54) % 7 === 0) {
        px(ctx, x, y - 13, 1, 13, "#4a3b2c");        // a hanger
        px(ctx, x - 1, y + 1, 4, 2, "#6b5540");      // and a plank
      }
    }
    lanternAt(ctx, 50, 88);
    lanternAt(ctx, PXW - 54, 88);
  },

  /* 9. the stream bank — the red butterfly's way there.
     Same spring world as the meadow route and deliberately not the same
     ground: down at the water instead of up in the open. The stream runs
     across the frame rather than toward you, so the seven stones read as
     a crossing you can see all of, and everything sits above the note. */
  stream(ctx, rnd) {
    ditherSky(ctx, 0, 0, PXW, PXH, [
      { p: 0.00, c: "#8ecdea" }, { p: 0.22, c: "#b4e0f0" },
      { p: 0.44, c: "#d6ecea" }, { p: 1.00, c: "#cfe6c2" },
    ]);
    cloudRow(ctx, PXW, 16, 4, ["#ffffff", "#f4f9fd", "#e2ebf4", "#cfdae8"], rnd, 1.1);
    cloudRow(ctx, PXW, 36, 3, ["#fdfeff", "#eef5fb", "#dbe6f0", "#c8d5e4"], rnd, 0.7);
    sunRays(ctx, PXW * 0.22, -14, PXW, PXH, "#fffbdc", rnd, 6);

    hillBand(ctx, PXW, 72, 7, 0.018, ["#c2dcb8", "#aec9a4", "#9ab490"], rnd, 1.4);
    hillBand(ctx, PXW, 84, 5, 0.027, ["#a8cc96", "#93b781", "#7fa16e"], rnd, 3.8);

    /* the far bank, sloping down to the water, and the wood standing on it */
    ditherSky(ctx, 0, 88, PXW, 22, [
      { p: 0.00, c: "#84b060" }, { p: 0.55, c: "#719c4e", }, { p: 1.00, c: "#5c8440" },
    ]);
    var bark = ["#9c7248", "#7d5734", "#5e3f22"];
    var leaf = ["#9cc468", "#7ea84e", "#628a38", "#496a28"];
    [[40, 108, 40], [178, 106, 34], [292, 108, 38]].forEach(function (t) {
      treeFull(ctx, t[0], t[1], t[2], bark, leaf, rnd, { speckle: "#c6e69a" });
    });
    bush(ctx, 108, 106, 9, ["#7aa64c", "#659040", "#517631", "#3f5c25"], rnd);
    bush(ctx, 240, 108, 8, ["#7aa64c", "#659040", "#517631", "#3f5c25"], rnd);

    /* the water. Dithered into the bank at both edges rather than cut,
       which is what stopped the first version reading as a pond. */
    var wTop = 108, wBot = 148;
    ditherSky(ctx, 0, wTop, PXW, wBot - wTop, [
      { p: 0.00, c: "#6f9e8e" }, { p: 0.18, c: "#4f86a8" },
      { p: 0.58, c: "#3f76a0" }, { p: 1.00, c: "#5d8f9a" },
    ]);
    // the shallow lip where it meets each bank
    for (var e = 0; e < PXW; e++) {
      var wob = Math.sin(e * 0.09) * 1.6 + Math.sin(e * 0.31) * 0.8;
      px(ctx, e, wTop + wob, 1, 2, "#8fc0c4");
      px(ctx, e, wBot - 2 + wob * 0.6, 1, 2, "#7fb0ae");
    }
    // the current: short dashes, faster and brighter down the middle
    for (var w = 0; w < 150; w++) {
      var wy = wTop + 3 + rnd() * (wBot - wTop - 6);
      var mid = 1 - Math.abs((wy - (wTop + wBot) / 2) / ((wBot - wTop) / 2));
      px(ctx, rnd() * PXW, wy, 2 + rnd() * (3 + mid * 5), 1,
        rnd() > 0.62 ? "#a8d2e6" : rnd() > 0.4 ? "#6fa0c0" : "#37698e");
    }
    // reeds standing out of the far edge
    for (var r3 = 0; r3 < 34; r3++) {
      var rx = rnd() * PXW, rh = 5 + rnd() * 9;
      for (var yy = 0; yy < rh; yy++) px(ctx, rx + (yy > rh / 2 ? 1 : 0), wTop - yy, 1, 1, "#5f8a44");
    }
    // the fallen trunk, half in the water, because banks always have one
    px(ctx, 196, wTop + 4, 74, 4, "#7d5734");
    px(ctx, 196, wTop + 4, 74, 1, "#a1794f");
    for (var kn = 0; kn < 8; kn++) px(ctx, 202 + kn * 9, wTop + 1, 1, 3, "#6b4a2c");
    px(ctx, 196, wTop + 8, 74, 1, "rgba(160,200,220,0.4)");   // its reflection

    /* the near bank: gravel first, then the grass you are standing on */
    ditherSky(ctx, 0, wBot - 2, PXW, 16, [
      { p: 0.00, c: "#b9ae92" }, { p: 1.00, c: "#8f8670" },
    ]);
    stones(ctx, PXW, wBot + 4, 22, ["#d6c9ab", "#bfb094", "#a2937a"], rnd);
    ditherSky(ctx, 0, wBot + 14, PXW, PXH - wBot - 14, [
      { p: 0.00, c: "#7fae56" }, { p: 0.5, c: "#6d9a46" }, { p: 1.00, c: "#5a8038" },
    ]);

    /* the seven stones, walked from the near bank up to the far one, laid
       across the current so all of them are above the speech note */
    for (var k = 0; k < 7; k++) {
      var sx = 52 + k * 34 + Math.sin(k * 1.3) * 5;
      var sy = wBot - 5 - k * 5;
      blob(ctx, sx, sy, 8, 4, ["#e2d8bd", "#c8bba0", "#a89b83", "#877c68"]);
      px(ctx, sx - 8, sy + 3, 16, 1, "#9fcbd8");        // the water breaking round it
      px(ctx, sx - 6, sy + 4, 12, 1, "rgba(255,255,255,0.35)");
    }

    grassTufts(ctx, PXW, wBot + 20, 34, ["#7fae52", "#93bd5e", "#6a9440"], rnd);
    flowerDots(ctx, PXW, wBot + 22, 26, 24, ["#ffffff", "#ffd166", "#ffc2da"], rnd);
  },

  /* 10. the door — where the way back ends.
     The one interior-ish scene in the game: the valley has gone dark
     behind you and all the light in the frame is light somebody left on.
     Deliberately the warmest palette here, against the sunset's pink. */
  home(ctx, rnd) {
    ditherSky(ctx, 0, 0, PXW, PXH, [
      { p: 0.00, c: "#0e1130" }, { p: 0.30, c: "#171a3c" },
      { p: 0.60, c: "#241f44" }, { p: 1.00, c: "#332544" },
    ]);
    for (var i = 0; i < 90; i++) {
      var sy = rnd() * 78, b = rnd();
      px(ctx, rnd() * PXW, sy, 1, 1, b > 0.85 ? "#ffffff" : b > 0.5 ? "#dde3ff" : "#9aa2cc");
    }
    sunDisc(ctx, 40, 26, 8, "#f4ecd0", "rgba(244,236,208,0.12)");

    /* the valley, already behind you and already dark */
    hillBand(ctx, PXW, 84, 12, 0.017, ["#241f3e", "#1c1832", "#151228"], rnd, 2);
    hillBand(ctx, PXW, 98, 8, 0.028, ["#1a1730", "#141126", "#0f0d1d"], rnd, 6);
    pineRow(ctx, PXW, 112, 34, ["#12161e", "#0d1017", "#090b11"], rnd, 0.85);
    // two lanterns still burning back down the path
    lanternAt(ctx, 22, 92);
    lanternAt(ctx, 74, 96);

    /* the ground, and the last of the path arriving at the step */
    px(ctx, 0, 112, PXW, PXH - 112, "#221e2a");
    ditherSky(ctx, 0, 112, PXW, PXH - 112, [
      { p: 0.00, c: "#2b2632" }, { p: 1.00, c: "#1a1720" },
    ]);
    pathTo(ctx, PXW, 114, PXH, -0.6, 10, 46, "#5e4d3c", "#4a3d30", "#372e24");

    /* the house, filling the right of the frame. It gets a real corner —
       a lit return edge and an eaves line that oversails it — because a
       flat panel butted against the sky reads as a wall, not a building. */
    var wallX = 176;
    px(ctx, wallX, 34, PXW - wallX, PXH - 34, "#2e2430");
    ditherSky(ctx, wallX, 34, PXW - wallX, PXH - 34, [
      { p: 0.00, c: "#3a2d38" }, { p: 1.00, c: "#241c26" },
    ]);
    // clapboard, picked out by the doorlight
    for (var b2 = 0; b2 < 22; b2++) px(ctx, wallX, 40 + b2 * 7, PXW - wallX, 1, "#453648");
    // the corner: a narrow return catching the moon, then the shadow of it
    px(ctx, wallX, 34, 4, PXH - 34, "#4a3a4c");
    px(ctx, wallX, 34, 2, PXH - 34, "#5f4a60");
    px(ctx, wallX + 4, 34, 2, PXH - 34, "#241c26");
    // the eaves, oversailing the corner so the roof reads as a roof
    px(ctx, wallX - 7, 28, PXW - wallX + 7, 6, "#3a2d38");
    px(ctx, wallX - 7, 28, PXW - wallX + 7, 2, "#57445a");
    px(ctx, wallX - 7, 34, PXW - wallX + 7, 1, "#1b1520");
    for (var rf = 0; rf < 5; rf++) px(ctx, wallX + 8 + rf * 28, 34, 2, 4, "#2b2130");   // rafter ends

    /* the lit window. Kept left of where the side choice buttons land, so
       a label never has to sit on top of the brightest thing in frame. */
    var wx = 230, wy = 48, ww = 32, wh = 24;
    px(ctx, wx - 3, wy - 3, ww + 6, wh + 6, "#54415a");
    px(ctx, wx - 3, wy - 3, ww + 6, 2, "#6b5470");
    px(ctx, wx - 4, wy + wh + 3, ww + 8, 3, "#5f4a60");    // the sill
    ditherSky(ctx, wx, wy, ww, wh, [{ p: 0, c: "#fff0bc" }, { p: 1, c: "#ffbe6a" }]);
    px(ctx, wx + ww / 2 - 1, wy, 2, wh, "#54415a");
    px(ctx, wx, wy + wh / 2 - 1, ww, 2, "#54415a");
    blob(ctx, wx + ww / 2, 138, 42, 8, ["rgba(255,200,120,0.10)"]);

    /* the door, open, with the whole point of the scene coming out of it */
    var dx = 196, dy = 88, dw = 34, dh = PXH - 88;
    px(ctx, dx - 4, dy - 5, dw + 8, dh + 5, "#4a3a4c");
    px(ctx, dx - 4, dy - 5, dw + 8, 3, "#6b5470");         // the lintel
    ditherSky(ctx, dx, dy, dw, dh, [
      { p: 0.00, c: "#fff2c8" }, { p: 0.55, c: "#ffc978" }, { p: 1.00, c: "#f0a955" },
    ]);
    px(ctx, dx, dy, 2, dh, "#e09a4e");                     // the jambs, in shadow
    px(ctx, dx + dw - 2, dy, 2, dh, "#e09a4e");
    px(ctx, dx + 4, PXH - 22, dw - 8, 6, "#e8a95c");       // a strip of floor inside
    // the light spilling out across the ground, softening as it goes
    for (var g = 0; g < 44; g++) {
      var gy = 140 + rnd() * 38;
      var spread = (gy - 138) * 2.6;
      px(ctx, dx - spread * rnd(), gy, 2 + rnd() * 6, 1, "rgba(255,198,120,0.13)");
    }
    px(ctx, dx - 4, PXH - 10, dw + 12, 4, "#5a4756");     // the step
    px(ctx, dx - 4, PXH - 10, dw + 12, 1, "#7a6274");
    // the lamp over the door
    lanternAt(ctx, dx + dw / 2, 76);

    /* a pot by the step, because a door needs something lived-in on it */
    blob(ctx, 168, 168, 8, 6, ["#7a5340", "#63432f", "#4c3324", "#3a2619"]);
    bush(ctx, 168, 160, 7, ["#3e5a3a", "#32492e", "#263822", "#1c2a19"], rnd);

    grassTufts(ctx, 170, 128, 22, ["#2b3a2c", "#22301f", "#192518"], rnd);
  },

};

/* =========================================================
   THE ADVENTURE — CUSTOMIZE ME

   One closing question per path, because the two paths are not asking
   the same thing. The way there asks it for the first time. The way
   back asks it again, a year on, which is the harder question and the
   better one. The nudge and its two answers are shared: whichever
   question she is looking at, saying no gets the same crying cat.
   ========================================================= */
const QUEST_FINAL = {
  question:     "Do you wanna be mine forever?",                        // the way there
  questionBack: "Same valley, a year on. Would you do it all again?",   // the way back
  nudge: "You sure about that?",
  nudgeYes: "I changed my mind",
  nudgeNo: "Yup",
};

/* =========================================================
   THE ADVENTURE — a branching pixel-art story

   Scenes are painted to a 320x180 canvas (see pixart.js / scenes.js)
   and scaled up with image-rendering:pixelated. Characters are
   composited into that same canvas so everything shares one pixel
   grid; only text stays as DOM so it renders crisply.
   ========================================================= */

let hvNode = "title";
let hvHistory = [];
let hvRnd = null;
let hvAnimTimer = null;

function hvSeed(name) {
  let x = Math.sin(name.length * 977 + name.charCodeAt(0) * 31) * 65536;
  return () => { x = Math.sin(x * 4321 + 8761) * 65536; return x - Math.floor(x); };
}

/* ---------- the story ----------
   Every node paints a scene, sets what the cat says, and offers
   choices. `pos` places a choice button; `fail` sends her to the
   bear, which returns to this same node. */
/* =========================================================
   THE LONG WAY ROUND

   Two paths, and they are not two versions of the same walk.

   The way there is the spring side: bright, open, everything still
   ahead of you, and its obstacles are all obstacles of not knowing —
   a wrong turn, a bear that turns out to be nerves, a fog that lifts.

   The way back is the same valley a year on, after dark, lit by things
   somebody had to hang up. Its obstacles are quieter and harder: weather
   you shelter through, a climb, a bridge that only holds one at a time.

   Within each path the two butterflies take genuinely different routes —
   different scenes, different beats — and arrive at the same place,
   because on that path you were always going to. Neither is a trap.
   ========================================================= */
const HV = {
  title: {
    scene: "sakura", cat: "happy", title: true, tagline: "Ready for a little adventure?",
    say: "",
    choices: [{ label: "BEGIN", to: "pick", pos: "centre", style: "start" }],
  },

  /* The first of the three forks. It decides nothing about where you go —
     both cards lead to the same next screen — but it is remembered for the
     whole walk, and it is what you are still holding at the end. */
  pick: {
    scene: "sakura", cat: "idle",
    say: "Pick a heart or a flower?",
    cards: [
      { art: "heart", to: "ways", keepsake: "heart" },
      { art: "flower", to: "ways", keepsake: "flower" },
    ],
  },

  ways: {
    scene: "meadow", cat: "idle",
    sayAgain: "Back at the bottom of the valley, then, with the whole of it still to walk. Which way this time?",
    say: "Two ways through the valley. Which one are we walking?",
    choices: [
      { label: "THE WAY THERE", to: "there", pos: "left" },
      { label: "THE WAY BACK", to: "back_dusk", pos: "right" },
    ],
  },

  /* ---------------- LEFT: the way there ---------------- */
  there: {
    scene: "sakura", cat: "idle", butterflies: true,
    say: "Spring, and neither of us knows anything yet. A butterfly goes on ahead — which one do we follow?",
    voices: [["him", "You are going to follow a butterfly."],
             ["her", "I am going to follow a butterfly."]],
    choices: [
      { label: "BLUE", to: "there_meadow", pos: "left", style: "blue" },
      { label: "RED", to: "there_stream", pos: "right", style: "red" },
    ],
  },

  /* ---- blue: the high meadow. Everything here is about not knowing:
          two tracks that go nowhere, a shape in the trees that turns out
          to be nothing at all, and weather you cannot see through. Not
          one of them can hurt you. ---- */
  there_meadow: {
    scene: "meadow", cat: "idle",
    say: "The blue one takes the long way up, over the open grass, where you can see the whole valley and be seen from every part of it.",
    choices: [{ label: "KEEP UP", to: "there_wrong", pos: "centre" }],
  },
  there_wrong: {
    scene: "meadow", cat: "idle",
    say: "Twice the track you pick turns out to be a sheep path that stops in the gorse. Twice you walk back to where the butterfly is waiting, which it is, both times, without making anything of it.",
    voices: [["her", "That is twice."],
             ["him", "I was not counting."],
             ["her", "You were counting."]],
    choices: [{ label: "TRY THE OTHER WAY", to: "there_rustle", pos: "centre" }],
  },
  /* Both of these used to go to the same node — the only choice left in
     the game where the two buttons did nothing at all, which the audit
     suite has called an illusion since the day it was written. It is
     still true that nothing here can hurt you; it is no longer true
     that it does not matter which you pick. Holding still and backing
     away get you two different deer. */
  there_rustle: {
    scene: "forest", cat: "shock", bear: "shadow",
    say: "Something big moves in the trees to the left of the path, and then does not move again.",
    choices: [
      { label: "HOLD VERY STILL", to: "there_nobear", pos: "left" },
      { label: "BACK AWAY SLOWLY", to: "there_deer", pos: "right" },
    ],
  },
  /* The hollow was painted, finished, and then never once shown: no
     node in the chapter used it. A whole place, with light coming down
     through it, sitting in the file unreachable. This is that place —
     and it is the only shelter on the spring side, which is exactly
     what a sudden shower wants. */
  there_shower: {
    scene: "hollow", cat: "shock", rain: true,
    say: "It comes on the way spring rain does, which is all at once and out of a sky that was blue about ninety seconds ago. There is one beech at the edge of the clearing with a canopy like a roof, and you get under it with about a second to spare.",
    voices: [["her", "It was sunny."],
             ["him", "It was very sunny."],
             ["her", "Move up."],
             ["him", "There is nowhere to move up to."],
             ["her", "Move up anyway."]],
    choices: [{ label: "WAIT IT OUT", to: "there_after", pos: "centre" }],
  },
  there_after: {
    scene: "hollow", cat: "love", drip: true,
    say: "Nine minutes. You know it was nine because he counted them out loud, badly, and by the end you were both counting. Then it stops as suddenly as it started, and the whole wood is dripping and lit up and smells like the inside of a greenhouse.",
    voices: [["him", "Nine minutes."],
             ["her", "You cannot count."],
             ["him", "I can count. I cannot count out loud."]],
    choices: [{ label: "OUT INTO IT", to: "there_fog", pos: "centre" }],
  },

  there_nobear: {
    scene: "forest", cat: "happy",
    say: "A deer. An enormous, appalled deer, gone before you have finished being frightened by it. You both laugh far too loudly for how quiet it was a second ago.",
    voices: [["her", "I genuinely thought that was it for us."],
             ["him", "It was a deer."],
             ["her", "It was an enormous deer."]],
    choices: [{ label: "ON UP", to: "there_shower", pos: "centre" }],
  },
  there_deer: {
    scene: "forest", cat: "happy",
    say: "You get four steps back before it comes out onto the path instead — a deer, all legs, quite as startled as either of you. It looks at you a second longer than feels polite. Then it is gone, and you are laughing far too loudly for how quiet it was.",
    voices: [["her", "It looked right at me."],
             ["him", "It looked at both of us."],
             ["her", "It looked at ME."]],
    choices: [{ label: "ON UP", to: "there_shower", pos: "centre" }],
  },
  there_fog: {
    scene: "meadow", cat: "idle", fog: true,
    say: "Then the cloud comes down on the top of the hill and there is no valley, no gate, no anything past about an arm's length. So you wait. It lifts, the way it always does, and the gate is right there.",
    choices: [{ label: "GO ON", to: "there_join", pos: "centre" }],
  },

  /* ---- red: the stream bank. Same hopefulness, different texture —
          following something instead of searching for it. ---- */
  there_stream: {
    scene: "stream", cat: "idle", fox: true,
    say: "The red one drops to the water instead and goes downstream, and a fox on the far bank works very hard at not having seen you.",
    choices: [{ label: "ALONG THE BANK", to: "there_stones", pos: "centre" }],
  },
  /* The stones are the crossing rather than a sentence about one: the
     seven the scene already draws, tapped one at a time as each settles.
     Cross them all clean and you get across dry; catch one rocking and
     you go in, which is the warmer of the two things that were already
     written. The two buttons are still here and still work — the
     mechanic is the longer way round, and this game is in favour of
     those. */
  there_stones: {
    scene: "stream", cat: "idle", play: "stones",
    outcomes: ["there_dry", "there_wet"],
    say: "The stream widens where the stones are. Seven of them, and not one is flat.",
  },
  there_dry: {
    stand: { x: 258, y: 106, s: 1.2 },
    scene: "stream", cat: "happy",
    say: "One at a time, then, testing each stone with a toe before you trust it. You get over with dry feet and slightly less dignity than you started with.",
    choices: [{ label: "DOWNSTREAM", to: "there_current", pos: "centre" }],
  },
  there_wet: {
    stand: { x: 258, y: 106, s: 1.2 },
    scene: "stream", cat: "happy",
    say: "All in a rush, then — and the fourth stone rolls, and you go in to the ankle, and it is so cold that it is funny. You are laughing before you are out of it.",
    voices: [["him", "Do you want my socks?"],
             ["her", "…yes."]],
    choices: [{ label: "DOWNSTREAM", to: "there_current", pos: "centre" }],
  },
  there_current: {
    stand: { x: 258, y: 106, s: 1.2 },
    scene: "stream", cat: "idle",
    say: "After the stones you just follow the current. It knows where it is going and you do not have to, and that turns out to be its own kind of relief.",
    choices: [{ label: "WHERE IT COMES OUT", to: "there_skim", pos: "centre" }],
  },
  /* The stone for skimming is one of the ten things lying about in
     this valley, and until now the only thing you could do with one was
     put it in your pocket. */
  there_skim: {
    scene: "stream", stand: { x: 258, y: 106, s: 1.2 },
    cat: "happy",
    say: "Where the current slows there is a pool as flat as a table, and the bank is nothing but flat stones, which is a situation with only one possible outcome.",
    voices: [["him", "Four."],
             ["her", "Three, and one of those was a splash."],
             ["him", "It touched down four times."],
             ["her", "It touched down three times and then drowned."]],
    choices: [{ label: "ONE MORE EACH", to: "there_petals", pos: "centre" }],
  },

  there_petals: {
    scene: "sakura", cat: "love",
    say: "It comes out under the blossom, the slow way round, and something lands in your hair and you leave it there.",
    voices: [["him", "You have got a whole tree in your hair."],
             ["her", "Leave it."]],
    choices: [{ label: "GO ON", to: "there_join", pos: "centre" }],
  },

  there_join: {
    scene: "meadow", cat: "love", callback: true,
    say: "Both ways come out at the same gate at the top of the meadow. However you got here, here is where it was always going to be.",
    voices: [["her", "I do not want to go back down yet."],
             ["him", "Then we will not."]],
    choices: [{ label: "SIT ON IT A WHILE", to: "there_quiet", pos: "centre" }],
  },

  /* The one hard beat on the spring side, and the reason the question
     at the end of this path has any weight at all.

     Everything on the way there is warm, and a story where nothing ever
     costs anything is a story you watch rather than feel. So: she asks
     the real question halfway up, a year too early, and he does not
     answer it. He asks her to ask him again at the top. She does — that
     is what the letter at the sunset IS — and the whole ending stops
     being a nice surprise and starts being a promise he made here and
     kept. */
  there_quiet: {
    scene: "meadow", cat: "idle",
    say: "And then there is a stretch, sitting on the gate with the whole valley going gold underneath you, where neither of you says anything for a long time — and it is not the comfortable kind. You are both doing the same arithmetic. Neither of you wants to be the one who says it out loud.",
    voices: [["her", "Can I ask you something stupid."],
             ["him", "Always."],
             ["her", "What if this is as good as it gets."],
             ["him", "Then we had a very good year."],
             ["her", "That is not an answer."],
             ["him", "I know. Ask me again at the top."]],
    choices: [{ label: "OVER THE GATE", to: "dark", pos: "centre" }],
  },

  /* ---------------- RIGHT: the way back ---------------- */
  back_dusk: {
    scene: "lantern", cat: "idle",
    sayIfMet: {
      route: "there",
      yes: "Same valley, a year on — the one you walked in the spring, the same gate and the same gorse and the same everything. Evening instead of morning, and somebody has been up here already and hung lanterns the whole way. Same place. Completely different light.",
      no:  "Same valley, a year on. Evening instead of morning, and somebody has been up here already and hung lanterns the whole way. Same place. Completely different light.",
    },
    say: "Same valley, a year on. Evening instead of morning, and somebody has been up here already and hung lanterns the whole way. Same place. Completely different light.",
    choices: [{ label: "GO ON", to: "back", pos: "centre" }],
  },
  back: {
    scene: "lantern", cat: "idle", butterflies: true,
    say: "A butterfly is still awake, which they are not supposed to be at this hour. Which one?",
    choices: [
      { label: "BLUE", to: "back_ridge", pos: "left", style: "blue" },
      { label: "RED", to: "back_orchard", pos: "right", style: "red" },
    ],
  },

  /* ---- blue: the ridge. Effortful and steady — the deliberate work of
          staying. The bridge takes one section at a time and says so. ---- */
  back_ridge: {
    scene: "ridge", cat: "idle",
    say: "The blue one goes up. It is colder than either of you dressed for and the whole sky is out, and neither of you suggests turning round.",
    choices: [{ label: "KEEP CLIMBING", to: "back_climb", pos: "centre" }],
  },
  back_climb: {
    scene: "ridge", cat: "happy",
    say: "It is an hour of the same thing: put a foot down, put the other one down, do not think about how much is left. Nobody says much for a long stretch and nothing at all is wrong.",
    voices: [["him", "Still with me?"],
             ["her", "Ask me in an hour."],
             ["him", "I will."]],
    choices: [{ label: "OVER THE TOP", to: "back_stars", pos: "centre" }],
  },
  /* Three sections of one span, and each of them is now the span rather
     than a paragraph over a picture of it. The bridge sways; you step
     when it is steady; hurrying it costs you the step and nothing else,
     which is the sentence the middle section has always been trying to
     say. */
  /* The ridge already has the best sky in the game painted into it —
     a hundred and fifty stars and one bright one low over the ridge —
     and the route walked straight past it on the way to the bridge. */
  back_stars: {
    scene: "ridge", cat: "love",
    say: "At the top there is nothing to do but stand there getting cold, so you stand there getting cold. It is the clearest either of you has ever seen it. He points out three constellations and is wrong about all three, with total confidence.",
    voices: [["him", "That is Orion."],
             ["her", "That is an aeroplane."],
             ["him", "That one, then. Definitely Orion."],
             ["her", "It is July."],
             ["him", "…that is a summer Orion."]],
    choices: [{ label: "AND ON, BEFORE WE FREEZE", to: "back_bridge1", pos: "centre" }],
  },

  back_bridge1: {
    scene: "bridge", cat: "idle", plank: 0, play: "bridge", span: [0.16, 0.42], playTo: "back_bridge2",
    outcomes: ["back_bridge2"],
    say: "Then the rope bridge over the gorge, which holds one person and one plank at a time, and is honest with you about it.",
  },
  back_bridge2: {
    scene: "bridge", cat: "shock", plank: 1, play: "bridge", span: [0.42, 0.72], playTo: "back_bridge3",
    outcomes: ["back_bridge3"],
    say: "The middle, where the sag is deepest and the whole span moves with you. The trick, it turns out, is to stop trying to hurry.",
    voices: [["him", "Do not look down."],
             ["her", "I am looking at you."],
             ["him", "That is worse."]],
  },
  back_bridge3: {
    scene: "bridge", cat: "happy", plank: 2, play: "bridge", span: [0.72, 0.97], playTo: "back_join",
    outcomes: ["back_join"],
    say: "The last few planks, the far post, solid ground. You wait on the other side while he comes across, and you do not once tell him to hurry up.",
  },

  /* ---- red: the orchard at dusk, and the bear.
          The only place in the whole game with anything to get wrong, and
          getting it wrong costs you three trees and nothing else. There is
          no game over here and there is no way to lose the route. ---- */
  back_orchard: {
    scene: "orchard", cat: "idle",
    say: "The red one takes the orchard, where the lanterns hang in the trees and the windfalls have been coming down for a week.",
    choices: [{ label: "DOWN THE ROW", to: "back_bear", pos: "centre" }],
  },
  /* The one thing in the game with a wrong answer, and it is played
     rather than picked: creep down the row while its head is down, stop
     while it is up. Getting it wrong is the three trees backwards that
     were already written — the same scene, the same buttons, no
     overlay — and the three buttons are still there for anyone who
     would rather just decide. */
  back_bear: {
    scene: "orchard", cat: "shock", bear: "real", play: "orchard",
    outcomes: ["back_bear_wait", "back_bear_quiet", "back_bear_seen"],
    /* the near end of the row, and low enough in the frame that the
       three buttons above them are never walked through */
    stand: { x: 74, y: 170, s: 1.5 },
    say: "There is a bear in the orchard. It is four trees down, working through the windfalls, and it has not looked up yet.",
  },
  /* The one soft landing in the game. It is a nudge backwards in the same
     scene, with the same furniture and the same buttons — no overlay, no
     restart, and nothing that reads as an ending. */
  back_bear_seen: {
    scene: "orchard", cat: "shock", bear: "real", nudged: true,
    say: "It looks up. That is the whole of it — it looks up, with its mouth full, entirely unbothered by either of you — but you are already walking backwards, and now you are three trees further back than you started.",
    choices: [{ label: "TRY IT AGAIN, QUIETLY", to: "back_bear", pos: "centre" }],
  },
  back_bear_wait: {
    scene: "orchard", cat: "idle",
    say: "So you wait. Ten minutes of standing perfectly still under a lantern with his hand flat between your shoulders, until it finishes the tree it is on and goes off towards the river.",
    choices: [{ label: "ON THROUGH", to: "back_windfall", pos: "centre" }],
  },
  back_bear_quiet: {
    scene: "orchard", cat: "idle",
    say: "You go the whole way on the grass at the edge of the row, where the lanterns do not reach and nothing cracks underfoot, and you do not stop once. It never knows you were there at all.",
    choices: [{ label: "ON THROUGH", to: "back_windfall", pos: "centre" }],
  },
  /* This line called back to the fox on the stream bank — "the fox
     from last spring, very much bigger now" — which is a lovely
     callback and was simply untrue for three of the four ways through
     the valley. If she took the meadow on the way there, or has never
     walked the spring side at all, she has never seen that fox. The
     game now knows which, and says the true one. */
  back_windfall: {
    scene: "orchard", cat: "happy", fox: true,
    sayIfMet: {
      route: "there-red",
      yes: "At the end of the rows the fox from last spring is asleep in the long grass, very much bigger now, and cannot be made to care about any of it.",
      no:  "At the end of the rows there is a fox asleep in the long grass, fat on windfalls and completely beyond caring, and it does not so much as open an eye at either of you.",
    },
    say: "At the end of the rows there is a fox asleep in the long grass, fat on windfalls and completely beyond caring, and it does not so much as open an eye at either of you.",
    voicesIfMet: {
      route: "there-red",
      yes: [["her", "That is our fox."],
            ["him", "It is not our fox."],
            ["her", "It is our fox."]],
      no:  [["her", "It has not moved."],
            ["him", "It is not going to move."],
            ["her", "I respect it enormously."]],
    },
    choices: [{ label: "ON TO THE PATH", to: "back_apple", pos: "centre" }],
  },

  /* The orchard is full of fruit that has been on the ground for a
     week and the route never once acknowledged it. The bear has been
     eating all evening. It seemed rude not to. */
  back_apple: {
    scene: "orchard", cat: "happy",
    say: "On the way out he picks up a windfall, turns it over twice looking for the bad side, fails to find one, and hands it to you. It is cold from the grass and far better than it has any business being.",
    voices: [["her", "Is this stealing."],
             ["him", "It was on the floor."],
             ["her", "So it is stealing."],
             ["him", "It is gleaning. Gleaning is a whole tradition."],
             ["her", "You have no idea what you just said."]],
    choices: [{ label: "DOWN TO THE LANTERNS", to: "back_join", pos: "centre" }],
  },

  back_join: {
    scene: "lantern", cat: "love", callback: true,
    say: "Both ways come back down to the bottom of the path, to the first lantern on it. Whichever way round you went, this is where it comes out.",
    choices: [{ label: "HOME", to: "back_year", pos: "centre" }],
  },

  /* And the hard beat on the autumn side. "Would you do it all again?"
     is not a question if the year it is asking about was easy, and
     until now the whole of the way back was lanterns and hand-holding.
     One of them says the true thing about the middle of the year, the
     other does not say anything clever back, and the closing question
     suddenly has something to weigh. */
  back_year: {
    scene: "lantern", cat: "idle",
    say: "Somewhere on the way down one of you brings up the middle of the year — the stretch that was work, the one neither of you writes on a card — and the other one does not say anything clever back, which is the right answer.",
    voices: [["her", "There was a bit in the middle where I was not sure."],
             ["him", "There was a bit in the middle where I was not either."],
             ["her", "You never said."],
             ["him", "You never asked. I would have said."],
             ["her", "…I am asking now."],
             ["him", "I know. Come on."]],
    choices: [{ label: "KEEP WALKING", to: "back_lanterns", pos: "centre" }],
  },

  /* =========================================================
     THE ENDING — LEFT. The way there ends the way it began: outside,
     in the open, with the light going and a letter that arrives from
     nowhere, because that year everything did.
     ========================================================= */
  /* These five were the oldest lines in the chapter and they were
     written in a much jollier voice than the forty nodes that now lead
     into them — "It's getting dark!", "Oh look! A letter pops out of
     nowhere!" — so you could hear the join. Same five beats, same
     choices, same magic envelope; said the way the rest of the walk is
     said. (If any of these were yours, they are the only lines in the
     game I have rewritten: the two closing questions and the keepsake
     line are untouched.) */
  dark: {
    scene: "sunset", cat: "shock",
    say: "The light goes while you are still sitting there. It does that up here — about ten minutes' warning, and then the whole valley is a different colour.",
    choices: [{ label: "already?", to: "sunset", pos: "centre" }],
  },
  sunset: {
    scene: "sunset", cat: "love",
    say: "And then the water does the thing it does perhaps twice a year, and neither of you says anything at all for a while, which is the correct response to it.",
    voices: [["her", "Where are you taking me?"],
             ["him", "Nowhere. We are already here."]],
    choices: [
      { label: "Where am I?", to: "youllsee", pos: "left" },
      { label: "Mhm!", to: "letter", pos: "right" },
    ],
  },
  youllsee: {
    scene: "sunset", cat: "happy",
    say: "\u201cYou will see,\u201d he says, which is what he says when he has already decided something and is enjoying himself about it.",
    choices: [{ label: "okay…", to: "letter", pos: "left" }],
  },
  letter: {
    scene: "sunset", cat: "shock", envelope: "closed",
    say: "There is an envelope in your hands. Neither of you put it there, and neither of you seems inclined to ask about it — that sort of year.",
    choices: [{ label: "open it", to: "closer", pos: "left" }],
  },
  closer: {
    scene: "sunset", cat: "idle", envelope: "open",
    say: "The writing is small and the light is nearly gone. He does not tell you what it says. He waits, the way he said he would, up at the gate.",
    choices: [{ label: "lean in", to: "ask", pos: "left" }],
  },
  ask: {
    scene: "sunset", cat: "hide", isAsk: true, ask: "there",
    say: "",
    choices: [
      { label: "YES!", to: "gift", pos: "left", style: "yes" },
      { label: "No…", to: "nudge", pos: "right" },
    ],
  },
  /* THE FIRST THING SHE EVER CHOSE, GIVEN BACK.

     The heart or the flower was the very first tap of the chapter and
     for a long time it did almost nothing: it was remembered, mentioned
     once at the gate, and listed at the end. It is a present now. He has
     been carrying it since the beginning — which, since she picked it at
     the beginning, is exactly true — and he gives it to her after she
     says yes. Shared between the two paths, like the nudge, so the words
     only exist once. */
  gift: {
    sceneOfAsk: true, cat: "love",
    giveKeepsake: true,
    say: "And then he holds something out to you, a little sheepishly, the way he does when he has been carrying a thing around all day waiting for the right minute.",
    sayOfKeepsake: {
      heart: "And then he holds something out to you, a little sheepishly, the way he does when he has been carrying a thing about all day waiting for the right minute. It is the small paper heart. The one you picked up at the very beginning of all this, before either of you knew which way you were walking.",
      flower: "And then he holds something out to you, a little sheepishly, the way he does when he has been carrying a thing about all day waiting for the right minute. It is the flower. The one you picked at the very beginning of all this, before either of you knew which way you were walking.",
    },
    voicesOfKeepsake: {
      heart: [["her", "You kept it."],
              ["him", "Of course I kept it."],
              ["her", "It is paper. It is a paper heart."],
              ["him", "You gave it to me on the first day. I kept it."]],
      flower: [["her", "You kept it."],
               ["him", "Of course I kept it."],
               ["her", "It is going to be a raisin by Tuesday."],
               ["him", "Then it will be our raisin."]],
    },
    choices: [{ label: "take it", to: "__yay", pos: "centre", style: "yes" }],
  },

  yay: {
    scene: "sunset", cat: "love", bigCat: true, hearts: true, isEnd: true, big: true,
    say: "YAYYY, I LOVE YOU!", tally: true,
    choices: [
      { label: "GO ROUND AGAIN 💛", to: "__again", pos: "left", style: "yes" },
      { label: "close the book", to: "__exit", pos: "right" },
    ],
  },

  /* =========================================================
     THE ENDING — RIGHT. The way back ends indoors, or as near as makes
     no difference: at a door, in the light somebody left on. The letter
     is not a surprise here. It has been in his coat since this morning.
     ========================================================= */
  back_lanterns: {
    scene: "lantern", cat: "idle", lighting: true,
    say: "You walk it in the dark and the lanterns come on as you reach them — one, and then the next, and then the next, the whole way down. Somebody had to come up here and hang every single one of these.",
    choices: [{ label: "KEEP GOING", to: "back_home", pos: "centre" }],
  },
  back_home: {
    scene: "home", cat: "love",
    say: "And then the last one is the light over our own door, which was on before we got here, because one of us always leaves it on for the other.",
    voices: [["her", "You left the light on."],
             ["him", "You left it on. It was your turn."],
             ["her", "…it was my turn."]],
    choices: [{ label: "inside?", to: "back_letter", pos: "centre" }],
  },
  back_letter: {
    scene: "home", cat: "idle", envelope: "closed",
    say: "Not yet. He takes an envelope out of his coat. It has been in there the whole walk. It has been in there since this morning.",
    voices: [["him", "Before we go in."]],
    choices: [{ label: "open it", to: "back_hers", pos: "left" }],
  },
  /* The two endings used to be the same five nodes with different
     scenery: envelope, open it, lean in, question, yes. Two paths built
     for a year to separate them, arriving at an identical shape. So the
     way back does something the way there cannot: on this side, she
     brought one too. He is not surprising her any more. They had the
     same idea, separately, this morning — which is the entire
     difference between the year they were finding each other and the
     year they decided to stay. */
  back_hers: {
    scene: "home", cat: "love", envelope: "open",
    say: "And then — because you had one as well, because of course you did — you take yours out of your own coat. Same idea. Same morning. Neither of you said a word about it all the way up that hill and all the way back down it.",
    voices: [["her", "You are joking."],
             ["him", "I am not joking."],
             ["her", "We are ridiculous."],
             ["him", "We are consistent."]],
    choices: [{ label: "read them together", to: "back_ask", pos: "left" }],
  },
  back_ask: {
    scene: "home", cat: "hide", isAsk: true, ask: "back",
    say: "",
    choices: [
      { label: "YES!", to: "gift", pos: "left", style: "yes" },
      { label: "No…", to: "nudge", pos: "right" },
    ],
  },
  /* One pair of these, not two. The two paths had a nudge and a
     really-sure node each — four nodes, the same four lines twice, on
     the one screen in the game where the words matter most and where
     having to change them in two places is how they end up different.
     `askedFrom` sends her back to whichever question she is standing
     in, and `sceneOfAsk` keeps the sunset a sunset and the doorway a
     doorway. */
  nudge: {
    sceneOfAsk: true, cat: "cry", bigCat: true, pair: false,
    say: QUEST_FINAL.nudge,
    choices: [
      { label: QUEST_FINAL.nudgeYes, to: "__ask", pos: "left", style: "yes" },
      { label: QUEST_FINAL.nudgeNo, to: "reallysure", pos: "right" },
    ],
  },
  reallysure: {
    sceneOfAsk: true, cat: "cry", bigCat: true, pair: false,
    sayOfAsk: {
      there: "…the cat is going to sit here until you change your mind.",
      back:  "…the cat is going to sit on this doorstep until you change your mind.",
    },
    choices: [
      { label: QUEST_FINAL.nudgeYes, to: "__ask", pos: "left", style: "yes" },
      { label: QUEST_FINAL.nudgeNo, to: "reallysure", pos: "right" },
    ],
  },
  back_yay: {
    scene: "home", cat: "love", bigCat: true, hearts: true, isEnd: true, big: true,
    say: "YES. Again, and next year, and the year after that.", tally: true,
    choices: [
      { label: "GO ROUND AGAIN 💛", to: "__again", pos: "left", style: "yes" },
      { label: "close the book", to: "__exit", pos: "right" },
    ],
  },
};

/* =========================================================
   THINGS TO FIND, THINGS REMEMBERED, AND SOUND

   Three additions that give the walk more to do than pick a button:

   1. Small things hidden in some scenes. Tap one and it is yours; the
      ending counts them, so there is a reason to look around and a
      reason to come back and find the ones you missed.
   2. The very first choice - heart or flower - is remembered, and comes
      back later in what the cat says and in what you are carrying at
      the end.
   3. Little sounds on every choice, collect and stumble, sharing the
      audio context the music toggle already owns.
   ========================================================= */

/* ---------- sound ---------- */
/* =========================================================
   SOUND FOR THE TWO STORY GAMES

   One oscillator with a frequency sweep was the whole engine, and four
   voices was the whole vocabulary — so most of what happened in these two
   games happened in silence. This is still synthesis, still no audio file
   in the repo, but a voice can now layer a second oscillator a set number
   of semitones away and a short filtered-noise burst, which is the
   difference between a beep and a footstep or a page turning.
   ========================================================= */
const HV_VOICES = {
  /* the originals, unchanged in character */
  pick:    { type:"square",   f:620,  to:880,  d:0.10, v:0.05 },
  collect: { type:"triangle", f:880,  to:1560, d:0.20, v:0.07, harm:7,  hv:0.03 },
  bad:     { type:"sawtooth", f:220,  to:90,   d:0.28, v:0.05 },
  yay:     { type:"triangle", f:520,  to:1040, d:0.42, v:0.08, harm:12, hv:0.04 },
  spot:    { type:"square",   f:300,  to:620,  d:0.16, v:0.05 },
  shot:    { type:"sawtooth", f:900,  to:260,  d:0.12, v:0.05 },

  /* a footfall: almost no tone, mostly a dry knock */
  step:    { type:"sine",     f:160,  to:110,  d:0.07, v:0.022, noise:0.03, nf:1600, nq:1.1, nd:0.05 },
  /* the key: two bright notes, a fifth apart */
  key:     { type:"triangle", f:784,  to:1175, d:0.34, v:0.06, harm:7,  hv:0.045 },
  /* a phial: glassy, short */
  phial:   { type:"sine",     f:1040, to:1560, d:0.22, v:0.05, harm:12, hv:0.025 },
  /* a locked door: dull, no ring */
  locked:  { type:"sine",     f:150,  to:78,   d:0.22, v:0.06, noise:0.045, nf:420, nq:.7, nd:0.12 },
  /* coming back after losing a life: a low swell */
  respawn: { type:"triangle", f:180,  to:420,  d:0.5,  v:0.05, harm:7,  hv:0.02 },
  /* arriving somewhere new */
  arrive:  { type:"sine",     f:660,  to:990,  d:0.5,  v:0.045, harm:5, hv:0.025 },
  /* a page: no tone at all, just paper */
  page:    { type:"sine",     f:220,  to:180,  d:0.04, v:0.012, noise:0.05, nf:2700, nq:.8, nd:0.16 },
  /* the smallest tick, for a button taking focus */
  hover:   { type:"square",   f:1200, to:1400, d:0.04, v:0.018 },
  /* something small in a hedge, by day */
  bird:    { type:"sine",     f:2100, to:3000, d:0.09, v:0.020, harm:7,  hv:0.008 },
  /* and the thing that replaces it after dark */
  cricket: { type:"square",   f:2600, to:2500, d:0.03, v:0.012, noise:0.006, nf:4200, nq:3, nd:0.03 },
};

function hvSfx(kind) {
  try {
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    if (audioCtx && audioCtx.state === "closed") audioCtx = null;
    if (!audioCtx) audioCtx = new AC();
    /* not just "suspended" — see wakeAudio; iOS uses "interrupted", and
       the old check let these two games go silent for the whole visit */
    if (window.audioAsleep && window.audioAsleep()) return;
    if (audioCtx.state !== "running") {
      if (window.wakeAudio) window.wakeAudio(audioCtx); else audioCtx.resume();
    }
    /* and never schedule into a frozen clock: the notes would all land at
       the same instant, already in the past, and never be heard */
    if (audioCtx.state !== "running") return;

    var c = audioCtx, t = c.currentTime;
    var spec = HV_VOICES[kind] || HV_VOICES.pick;

    var o = c.createOscillator(), g = c.createGain();
    o.type = spec.type;
    o.frequency.setValueAtTime(spec.f, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, spec.to), t + spec.d);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(spec.v, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + spec.d);
    o.connect(g); g.connect(c.destination);
    o.start(t); o.stop(t + spec.d + 0.02);

    /* a second voice a set number of semitones up, for the ones that
       should ring rather than beep */
    if (spec.harm) {
      var r = Math.pow(2, spec.harm / 12);
      var o2 = c.createOscillator(), g2 = c.createGain();
      o2.type = spec.type;
      o2.frequency.setValueAtTime(spec.f * r, t);
      o2.frequency.exponentialRampToValueAtTime(Math.max(20, spec.to * r), t + spec.d);
      g2.gain.setValueAtTime(0.0001, t);
      g2.gain.exponentialRampToValueAtTime(spec.hv || spec.v * 0.5, t + 0.02);
      g2.gain.exponentialRampToValueAtTime(0.0001, t + spec.d);
      o2.connect(g2); g2.connect(c.destination);
      o2.start(t); o2.stop(t + spec.d + 0.02);
    }

    /* and a band-passed noise burst, which is what makes a step sound like
       a foot and a page sound like paper rather than another beep */
    if (spec.noise) {
      var nd = spec.nd || 0.06;
      var len = Math.max(1, Math.floor(c.sampleRate * nd));
      var buf = c.createBuffer(1, len, c.sampleRate);
      var ch = buf.getChannelData(0);
      for (var i = 0; i < len; i++) ch[i] = (Math.random() * 2 - 1) * (1 - i / len);
      var src = c.createBufferSource(); src.buffer = buf;
      var bp = c.createBiquadFilter();
      bp.type = "bandpass"; bp.frequency.value = spec.nf || 1800; bp.Q.value = spec.nq || 1;
      var ng = c.createGain(); ng.gain.value = spec.noise;
      src.connect(bp); bp.connect(ng); ng.connect(c.destination);
      src.start(t);
    }
  } catch (e) { /* sound is a bonus, never a blocker */ }
}


/* ---------- the things you can find ---------- */
/* Ten things, one per place rather than one per route.

   There used to be four, one on each of the four routes, which meant a
   single walk up the valley could find exactly one of them — and the
   ending then said "you found the acorn along the way", which is not a
   collection, it is a consolation. Four walks and a good memory were
   the only way to see the sentence work. Now every walk passes four or
   five, the ending has a list worth reading, and the whole set is still
   only there for someone who goes round again. */
const HV_TOKENS = {
  clover:   { name: "a four-leaf clover" },
  harebell: { name: "a harebell" },
  acorn:    { name: "a small acorn" },
  petal:    { name: "a blossom petal" },
  feather:  { name: "a soft feather" },
  skimmer:  { name: "a stone for skimming" },
  ribbon:   { name: "a lost ribbon" },
  pinecone: { name: "a pine cone" },
  shell:    { name: "a striped shell" },
  key:      { name: "the spare key" },
};
let hvFound = {};
let hvKeepsake = null;      // heart or flower, from the very first choice
let hvBursts = [];          // little sparkle pops when something is collected
let hvRoutes = {};          // which of the four ways through have been walked
let hvEndings = {};         // and which of the two endings have been read

/* =========================================================
   WHAT THE WALK REMEMBERS

   There are four routes and two endings and ten things to find, and a
   single walk can see one route, one ending and about four of the
   things. That is a good shape for something you come back to — except
   that none of it was written down anywhere, so everything found
   evaporated on the next reload and there was no way for the game to
   know, or say, that there were three other ways up the valley.

   Super Ouissy keeps a best time per difficulty and the race keeps
   ghosts. This keeps the smallest thing that makes coming back mean
   something: what you found, where you went, and how it ended.
   ========================================================= */
const HV_KEY = "hv_walk";
const HV_ROUTE_OF = {
  there_meadow: "there-blue", there_stream: "there-red",
  back_ridge:   "back-blue",  back_orchard: "back-red",
};
const HV_ROUTE_NAME = {
  "there-blue": "the high meadow", "there-red": "the stream bank",
  "back-blue":  "the ridge",       "back-red":  "the orchard",
};

function hvLoadProgress() {
  try {
    const d = JSON.parse(localStorage.getItem(HV_KEY) || "{}") || {};
    hvFound = d.found || {};
    hvRoutes = d.routes || {};
    hvEndings = d.endings || {};
  } catch (e) { hvFound = {}; hvRoutes = {}; hvEndings = {}; }
}

function hvSaveProgress() {
  try {
    localStorage.setItem(HV_KEY, JSON.stringify(
      { found: hvFound, routes: hvRoutes, endings: hvEndings }));
  } catch (e) { /* a private window is still allowed to play */ }
}

function hvNoteRoute(id) {
  let dirty = false;
  const r = HV_ROUTE_OF[id];
  if (r && !hvRoutes[r]) { hvRoutes[r] = 1; dirty = true; }
  if (HV[id] && HV[id].isEnd && !hvEndings[id]) { hvEndings[id] = 1; dirty = true; }
  if (dirty) hvSaveProgress();
}

function hvRouteCount() { return Object.keys(hvRoutes).length; }

/* Has she walked this route, or any route on this path? Takes either a
   whole route name ("there-red") or a path prefix ("there"). */
function hvHasWalked(which) {
  if (!which) return false;
  if (hvRoutes[which]) return true;
  return Object.keys(hvRoutes).some(function (k) { return k.indexOf(which + "-") === 0; });
}
function hvEndingCount() { return Object.keys(hvEndings).length; }

/* =========================================================
   THE AIR IN EACH PLACE

   Every scene in this chapter was silent. Five sounds fired on button
   presses and that was the entire soundtrack of a walk through a
   valley — no wind on the ridge, no water at the stream, nothing under
   the orchard at night. Super Ouissy has a chiptune loop; this wants
   the opposite of a tune.

   So: one loop of noise through one filter, moved slowly, which is
   wind; opened up and brightened, which is water; plus a bird every few
   seconds by day and a cricket every few seconds after dark. It carries
   no files, like everything else here, and it has an off switch.
   ========================================================= */
const HV_AIR = {
  sakura:  { f: 620,  q: 0.7, g: 0.016, sway: 240, voice: "bird",    every: [3.5, 7] },
  forest:  { f: 520,  q: 0.8, g: 0.018, sway: 200, voice: "bird",    every: [3, 6] },
  hollow:  { f: 420,  q: 0.8, g: 0.016, sway: 160, voice: "bird",    every: [4, 8] },
  meadow:  { f: 700,  q: 0.6, g: 0.017, sway: 300, voice: "bird",    every: [4, 8] },
  stream:  { f: 1500, q: 0.5, g: 0.038, sway: 420, voice: "bird",    every: [5, 10] },
  sunset:  { f: 480,  q: 0.7, g: 0.014, sway: 180, voice: "cricket", every: [2.5, 5] },
  lantern: { f: 380,  q: 0.8, g: 0.013, sway: 140, voice: "cricket", every: [2, 4.5] },
  ridge:   { f: 900,  q: 0.5, g: 0.026, sway: 520, voice: null,      every: null },
  orchard: { f: 360,  q: 0.8, g: 0.013, sway: 130, voice: "cricket", every: [2, 4] },
  bridge:  { f: 820,  q: 0.5, g: 0.024, sway: 460, voice: null,      every: null },
  home:    { f: 300,  q: 0.9, g: 0.011, sway: 110, voice: "cricket", every: [3, 6] },
};

const HV_SOUND_KEY = "hv_air";
let hvSoundOn = true;
let hvAmb = null;            // { src, filt, gain, lfo, timer, scene }

function hvSoundPreferred() {
  try { return localStorage.getItem(HV_SOUND_KEY) !== "0"; } catch (e) { return true; }
}

function hvAmbience(scene) {
  const air = scene && HV_AIR[scene];

  if (!air || !hvSoundOn) { hvAmbienceStop(); return; }
  if (hvAmb && hvAmb.scene === scene) return;

  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    if (!window.hvSharedCtx()) return;
    if (audioCtx.state !== "running") {
      if (window.wakeAudio) window.wakeAudio(audioCtx); else audioCtx.resume();
    }
    const c = audioCtx;

    /* one two-second loop of noise is all the material there is; the
       filter is what turns it into a place */
    if (!hvAmb) {
      const len = Math.floor(c.sampleRate * 2);
      const buf = c.createBuffer(1, len, c.sampleRate);
      const ch = buf.getChannelData(0);
      let last = 0;
      for (let i = 0; i < len; i++) {
        /* softened toward brown noise, so it reads as air and not as
           the hiss between radio stations */
        last = (last + Math.random() * 2 - 1) * 0.5;
        ch[i] = last;
      }
      const src = c.createBufferSource();
      src.buffer = buf; src.loop = true;
      const filt = c.createBiquadFilter();
      filt.type = "bandpass"; filt.Q.value = 0.7;
      const gain = c.createGain();
      gain.gain.value = 0.0001;
      const lfo = c.createOscillator();
      lfo.frequency.value = 0.09;
      const lg = c.createGain();
      lfo.connect(lg); lg.connect(filt.frequency);
      src.connect(filt); filt.connect(gain); gain.connect(c.destination);
      src.start(); lfo.start();
      hvAmb = { src, filt, gain, lfo, lg, timer: null, scene: null };
    }

    const t = c.currentTime;
    hvAmb.filt.frequency.cancelScheduledValues(t);
    hvAmb.filt.frequency.setTargetAtTime(air.f, t, 0.6);
    hvAmb.filt.Q.value = air.q;
    hvAmb.lg.gain.value = air.sway;
    hvAmb.gain.gain.cancelScheduledValues(t);
    hvAmb.gain.gain.setTargetAtTime(air.g, t, 0.8);
    hvAmb.scene = scene;

    if (hvAmb.timer) clearTimeout(hvAmb.timer);
    hvAmb.timer = null;
    if (air.voice && air.every) {
      const again = () => {
        hvAmb.timer = setTimeout(() => {
          if (!hvAmb || !hvSoundOn) return;
          const scr = document.getElementById("screen-quest");
          if (scr && scr.classList.contains("active")) hvSfx(air.voice);
          again();
        }, (air.every[0] + Math.random() * (air.every[1] - air.every[0])) * 1000);
      };
      again();
    }
  } catch (e) { /* the air is a bonus, never a blocker */ }
}

function hvAmbienceStop() {
  if (!hvAmb) return;
  try {
    if (hvAmb.timer) clearTimeout(hvAmb.timer);
    hvAmb.timer = null;
    hvAmb.gain.gain.setTargetAtTime(0.0001, audioCtx.currentTime, 0.25);
  } catch (e) {}
  hvAmb.scene = null;
}

/* =========================================================
   WHICH PIECE OF MUSIC THIS PLACE GETS

   The score lives in ost.js and is one tune played eleven different
   ways; this decides which. Mostly it is just the scene, because a
   place has a sound. The two exceptions are the ones that carry the
   story rather than the scenery: the title, which gets the theme
   stated once on a piano and nothing else, and the closing question,
   which stays on whatever the ending's scene was already playing so
   that the music does not change underneath the most important
   sentence in the game.
   ========================================================= */
function hvScore(n) {
  if (!window.OST || !n) return;
  window.OST.play(n.title ? "sakura" : hvSceneOf(n));
}

function hvSetSound(on) {
  hvSoundOn = on;
  try { localStorage.setItem(HV_SOUND_KEY, on ? "1" : "0"); } catch (e) {}
  const b = document.getElementById("hv-sound");
  if (b) {
    b.classList.toggle("off", !on);
    b.setAttribute("aria-label", on ? "Sound on" : "Sound off");
    b.title = on ? "Sound on" : "Sound off";
    /* the icon changes, rather than the same shape going dim: a muted
       speaker has a cross where its waves were, and you can tell which
       state it is in without remembering what the other one looked like */
    const use = document.getElementById("hv-sound-icon");
    if (use) use.setAttribute("href", on ? "#ic-px-sound-on" : "#ic-px-sound-off");
  }
  if (window.OST) window.OST.setOn(on);
  if (on) { const n = HV[hvNode]; hvAmbience(n && hvSceneOf(n)); hvScore(n); }
  else hvAmbienceStop();
}

function hvDrawToken(kind) {
  const { c, ctx } = spriteCanvas(14, 14);
  if (kind === "shell") {
    blob(ctx, 7, 8, 6, 5, ["#ffe8d0", "#f5c9a8", "#e0a883", "#c08664"]);
    for (var i = 0; i < 5; i++) px(ctx, 3 + i * 2, 5 + (i % 2), 1, 6, "#c08664");
  } else if (kind === "feather") {
    px(ctx, 7, 2, 1, 10, "#c9b48e");
    for (var k = 0; k < 8; k++) {
      var w = 4 - Math.abs(k - 3) * 0.6;
      px(ctx, 7 - w, 3 + k, w, 1, "#f2e6cf");
      px(ctx, 8, 3 + k, w, 1, "#e2d2b4");
    }
  } else if (kind === "acorn") {
    blob(ctx, 7, 9, 4, 4, ["#e0b070", "#c8904e", "#a87238", "#875828"]);
    px(ctx, 3, 3, 8, 4, "#7a5230");
    px(ctx, 6, 1, 2, 3, "#5e3f22");
  } else if (kind === "clover") {
    var G = ["#8fd06a", "#6fb44c", "#559234", "#3f7026"];
    blob(ctx, 5, 5, 3, 2.6, G); blob(ctx, 9, 5, 3, 2.6, G);
    blob(ctx, 5, 9, 3, 2.6, G); blob(ctx, 9, 9, 3, 2.6, G);
    px(ctx, 7, 6, 1, 5, "#3f7026");
    px(ctx, 4, 4, 1, 1, "#c8ee9c"); px(ctx, 8, 4, 1, 1, "#c8ee9c");
  } else if (kind === "harebell") {
    px(ctx, 8, 6, 1, 8, "#5c8440");                  // the stem it nods on
    blob(ctx, 6, 5, 3.4, 3, ["#b9c2f2", "#8f9be0", "#6f79c4", "#535ca0"]);
    px(ctx, 4, 7, 5, 1, "#535ca0");                  // the mouth of the bell
    px(ctx, 5, 3, 2, 1, "#dfe4ff");
  } else if (kind === "petal") {
    blob(ctx, 7, 7, 5, 3.4, ["#ffe0ec", "#ffc2d8", "#f0a0be", "#d8849f"]);
    px(ctx, 3, 7, 8, 1, "#ffd0e0");
    px(ctx, 5, 5, 2, 1, "#fff4f8");
  } else if (kind === "skimmer") {
    blob(ctx, 7, 8, 6, 2.6, ["#d8dee2", "#b6bfc6", "#94a0a8", "#74808a"]);
    px(ctx, 3, 7, 5, 1, "#e6ecef");                  // the flat face it goes in on
  } else if (kind === "pinecone") {
    blob(ctx, 7, 8, 3.6, 5, ["#a5793f", "#875f30", "#6b4a24", "#4f361a"]);
    for (var pcr = 0; pcr < 4; pcr++) {
      px(ctx, 5 + (pcr % 2), 4 + pcr * 2, 4, 1, "#4f361a");
      px(ctx, 5 + (pcr % 2), 4 + pcr * 2, 2, 1, "#c08f52");
    }
    px(ctx, 7, 2, 1, 2, "#5c8440");
  } else if (kind === "key") {
    px(ctx, 4, 6, 7, 2, "#e0b24e");                  // the shaft
    px(ctx, 4, 6, 7, 1, "#ffe09a");
    blob(ctx, 3, 7, 2.6, 2.6, ["#ffe09a", "#e0b24e", "#b88a30", "#8f6a20"]);
    px(ctx, 3, 7, 1, 1, "#6b4a12");                  // the hole in the bow
    px(ctx, 9, 8, 1, 3, "#e0b24e"); px(ctx, 11, 8, 1, 2, "#e0b24e");
  } else { /* ribbon */
    px(ctx, 6, 5, 3, 3, "#e0567f");
    blob(ctx, 3, 6, 3.4, 2.6, ["#ffc2d8", "#f7a0bd", "#e0789c", "#c45d80"]);
    blob(ctx, 11, 6, 3.4, 2.6, ["#ffc2d8", "#f7a0bd", "#e0789c", "#c45d80"]);
    px(ctx, 5, 8, 2, 5, "#e0789c"); px(ctx, 8, 8, 2, 5, "#e0789c");
  }
  return c;
}

function hvBurst(x, y, colour) {
  for (var i = 0; i < 12; i++) {
    var a = (i / 12) * Math.PI * 2;
    hvBursts.push({ x: x, y: y, vx: Math.cos(a) * (14 + Math.random() * 16),
      vy: Math.sin(a) * (14 + Math.random() * 16) - 8, life: 0, max: 0.6,
      c: colour || "#ffe9a8" });
  }
}

function hvDrawBursts(ctx, dt) {
  for (var i = hvBursts.length - 1; i >= 0; i--) {
    var b = hvBursts[i];
    b.life += dt;
    if (b.life >= b.max) { hvBursts.splice(i, 1); continue; }
    var t = b.life / b.max;
    var x = b.x + b.vx * b.life;
    var y = b.y + b.vy * b.life + 40 * b.life * b.life;
    if (t < 0.75 || Math.sin(b.life * 40) > 0) px(ctx, x, y, t < 0.5 ? 2 : 1, t < 0.5 ? 2 : 1, b.c);
  }
}

/* Where each findable thing hides, in scene pixels. Deliberately tucked
   against scenery so they take a moment to spot. */
/* Kept clear of the furniture: the top bar, the side buttons around
   38-48% height, and the speech note which covers the bottom band from
   roughly 12% to 76% across. Anything hidden under those can never be
   tapped. */
/* These are keyed by NODE, not by scene, and three of the four used to
   name nodes that had never existed — so only the shell was ever findable.
   One per route now, so each of the four journeys has something of its
   own to spot and none of them can be picked up twice. */
/* Where each one is. Everything here is kept clear of the paper note,
   which owns the bottom third of the stage — the ribbon used to sit at
   y=150, squarely behind it, where it could be collected but never
   seen. */
const HV_HIDDEN = {
  ways:            { id: "clover",   x: 44,  y: 128, r: 14 },   // everyone
  there_meadow:    { id: "harebell", x: 250, y: 120, r: 14 },   // left-blue
  there_nobear:    { id: "acorn",    x: 248, y: 112, r: 14 },   // left-blue
  there_deer:      { id: "acorn",    x: 248, y: 112, r: 14 },   // …either deer
  there_petals:    { id: "petal",    x: 60,  y: 120, r: 14 },   // left-red
  there_current:   { id: "feather",  x: 262, y: 128, r: 14 },   // left-red
  sunset:          { id: "skimmer",  x: 232, y: 136, r: 14 },   // both left
  back_climb:      { id: "ribbon",   x: 74,  y: 128, r: 14 },   // right-blue
  back_join:       { id: "pinecone", x: 52,  y: 132, r: 14 },   // both right
  back_windfall:   { id: "shell",    x: 252, y: 106, r: 14 },   // right-red
  back_home:       { id: "key",      x: 58,  y: 134, r: 14 },   // both right
};

function hvHiddenHere() {
  var n = HV[hvNode];
  if (!n) return null;
  var spot = HV_HIDDEN[hvNode];
  if (!spot || hvFound[spot.id]) return null;
  return spot;
}

/* canvas taps: collecting, and poking the cat */
function hvCanvasTap(ev) {
  var canvas = document.getElementById("hv-canvas");
  if (!canvas) return;
  var r = canvas.getBoundingClientRect();
  var sx = ((ev.clientX - r.left) / r.width) * PXW;
  var sy = ((ev.clientY - r.top) / r.height) * PXH;

  var spot = hvHiddenHere();
  if (spot && Math.abs(sx - spot.x) < spot.r && Math.abs(sy - spot.y) < spot.r) {
    hvFound[spot.id] = true;
    hvSaveProgress();
    hvBurst(spot.x, spot.y, "#fff0b0");
    hvSfx("collect");
    hvUpdateFoundStrip();
    return;
  }

  // a stone, a plank: whatever is being played here takes the tap next
  if (hvPlay && hvPlayPress((performance.now() - hvT0) / 1000)) return;

  // poking the cat gets a reaction
  var n = HV[hvNode];
  if (n && n.cat && n.cat !== "hide" && !n.bigCat && sx < 90 && sy > PXH - 88) {
    hvPoke = 1.2;
    hvBurst(40, PXH - 60, "#ffb3cd");
    hvSfx("pick");
  }
}
let hvPoke = 0;

/* Holding: the orchard is the only one that wants a held input, and it
   wants it from a finger on a phone as much as from the space bar. */
function hvHoldOn(ev) {
  if (!hvPlay || hvPlay.kind !== "orchard") return;
  hvHold = true;
  if (ev && ev.cancelable) ev.preventDefault();
}
function hvHoldOff() { hvHold = false; }

function hvUpdateFoundStrip() {
  var strip = document.getElementById("hv-found");
  if (!strip) return;
  var ids = Object.keys(HV_TOKENS).filter(function (k) { return hvFound[k]; });
  /* The strip is drawn from the same function that draws the thing
     lying in the grass, so there is one picture of a pine cone in this
     game rather than a canvas one and an SVG one that have to be kept
     looking like each other. */
  strip.innerHTML = "";
  ids.forEach(function (k) {
    var wrap = document.createElement("span");
    wrap.className = "hv-token";
    wrap.title = HV_TOKENS[k].name;
    wrap.appendChild(hvDrawToken(k));
    strip.appendChild(wrap);
  });
  strip.classList.toggle("on", ids.length > 0);
}

function hvFoundList() {
  var ids = Object.keys(HV_TOKENS).filter(function (k) { return hvFound[k]; });
  var out = "";
  if (ids.length === 1) {
    out = "You found " + HV_TOKENS[ids[0]].name + " along the way.";
  } else if (ids.length) {
    var names = ids.map(function (k) { return HV_TOKENS[k].name; });
    out = "You found " + names.slice(0, -1).join(", ") + " and " +
          names[names.length - 1] + " along the way.";
  }

  /* And, once, what is left. Four ways up that valley and two ways it
     can end, and until now the game had no way of telling her the other
     three existed — which made every replay look like the same walk. */
  var routes = hvRouteCount();
  if (routes < 4) {
    var left = [];
    for (var k2 in HV_ROUTE_NAME) if (!hvRoutes[k2]) left.push(HV_ROUTE_NAME[k2]);
    var howMany = ["", "one", "two", "three", "four"][left.length];
    out += (out ? " " : "") + (left.length === 1
      ? "There is one way up this valley you have not walked yet: " + left[0] + "."
      : "There are " + howMany + " other ways up this valley — " +
        left.slice(0, -1).join(", ") + " and " + left[left.length - 1] + ".");
  } else if (ids.length < Object.keys(HV_TOKENS).length) {
    out += (out ? " " : "") + "You have walked all four ways up now.";
  } else {
    out += (out ? " " : "") + "All four ways, and every last thing there was to find.";
  }
  return out;
}

/* ---------- painting ----------
   The background is expensive, so it is painted once into an offscreen
   buffer per node. Every frame then blits that buffer and draws only the
   things that move — petals, butterflies, fireflies, water shimmer, the
   cat's blink. Cheap, and it is what makes the scene feel alive rather
   than like a still image with buttons on top. */

var hvBase = null;          // whichever cached scene is currently behind everything
var hvActors = [];
var hvLoopId = null, hvT0 = 0;
var hvTrans = null;          // pixel-dissolve state

/* Build the moving cast for a scene. Positions are seeded so a scene
   always starts the same way, but they drift with time. */
function hvBuildActors(n, rnd) {
  var a = [];
  var scene = hvSceneOf(n);

  if (scene === "sakura") {
    for (var i = 0; i < 34; i++) {
      a.push({ k: "petal", x: rnd() * PXW, y: rnd() * PXH, sp: 5 + rnd() * 9,
        sw: 8 + rnd() * 16, ph: rnd() * 6.28, c: rnd() > 0.5 ? "#ffc9dd" : "#ffe3ee", w: 2 });
    }
    a.push({ k: "bird", x: -20, y: 26 + rnd() * 16, sp: 11 + rnd() * 5, ph: rnd() * 6.28 });
  }
  if (scene === "forest") {
    for (var j = 0; j < 22; j++) {
      a.push({ k: "mote", x: rnd() * PXW, y: 30 + rnd() * 90, r: 0.6 + rnd() * 1.4,
        sp: 2 + rnd() * 4, ph: rnd() * 6.28, c: "#fff6c8" });
    }
    for (var l = 0; l < 8; l++) {
      a.push({ k: "petal", x: rnd() * PXW, y: rnd() * PXH, sp: 6 + rnd() * 7,
        sw: 10 + rnd() * 14, ph: rnd() * 6.28, c: "#a8cc72", w: 2 });
    }
  }
  if (scene === "hollow") {
    for (var m = 0; m < 20; m++) {
      a.push({ k: "fly", x: rnd() * PXW, y: 60 + rnd() * 80, r: 6 + rnd() * 14,
        sp: 0.5 + rnd() * 0.9, ph: rnd() * 6.28, c: "#fff2a8" });
    }
  }
  if (scene === "meadow") {
    for (var p = 0; p < 30; p++) {
      a.push({ k: "mote", x: rnd() * PXW, y: 60 + rnd() * 100, r: 0.8 + rnd() * 1.8,
        sp: 2 + rnd() * 5, ph: rnd() * 6.28, c: "#fff6cc" });
    }
  }
  if (scene === "stream") {
    for (var st = 0; st < 20; st++) {
      a.push({ k: "shimmer", x: 40 + rnd() * (PXW - 80), y: 116 + rnd() * 60,
        w: 2 + rnd() * 4, ph: rnd() * 6.28 });
    }
    for (var sp2 = 0; sp2 < 14; sp2++) {
      a.push({ k: "mote", x: rnd() * PXW, y: 40 + rnd() * 80, r: 0.7 + rnd() * 1.3,
        sp: 2 + rnd() * 4, ph: rnd() * 6.28, c: "#fff8d0" });
    }
    a.push({ k: "bird", x: -20, y: 22 + rnd() * 14, sp: 10 + rnd() * 5, ph: rnd() * 6.28 });
  }
  if (scene === "home") {
    for (var hs = 0; hs < 22; hs++) {
      a.push({ k: "star", x: rnd() * PXW * 0.55, y: rnd() * 70, ph: rnd() * 6.28 });
    }
    for (var hf = 0; hf < 12; hf++) {
      a.push({ k: "fly", x: 20 + rnd() * 150, y: 120 + rnd() * 46, r: 5 + rnd() * 10,
        sp: 0.4 + rnd() * 0.7, ph: rnd() * 6.28, c: "#ffdc9a" });
    }
  }
  if (scene === "sunset") {
    for (var q = 0; q < 26; q++) {
      a.push({ k: "star", x: rnd() * PXW, y: rnd() * 26, ph: rnd() * 6.28 });
    }
    for (var r2 = 0; r2 < 18; r2++) {
      a.push({ k: "shimmer", x: rnd() * PXW, y: 123 + rnd() * 17, w: 2 + rnd() * 4, ph: rnd() * 6.28 });
    }
    for (var s2 = 0; s2 < 14; s2++) {
      a.push({ k: "fly", x: rnd() * PXW, y: 140 + rnd() * 34, r: 5 + rnd() * 10,
        sp: 0.4 + rnd() * 0.7, ph: rnd() * 6.28, c: "#ffe9a8" });
    }
  }
  return a;
}

function hvDrawActors(ctx, t) {
  for (var i = 0; i < hvActors.length; i++) {
    var a = hvActors[i];
    if (a.k === "petal") {
      var y = (a.y + t * a.sp) % (PXH + 12) - 6;
      var x = a.x + Math.sin(t * 0.9 + a.ph) * a.sw * 0.35;
      px(ctx, x, y, a.w, 1, a.c);
      if (Math.sin(t * 3 + a.ph) > 0) px(ctx, x + 1, y - 1, 1, 1, a.c);
    } else if (a.k === "mote") {
      var my = a.y - ((t * a.sp) % 120);
      if (my < 10) my += 120;
      var mx = a.x + Math.sin(t * 0.6 + a.ph) * 5;
      var tw = 0.55 + 0.45 * Math.sin(t * 2.2 + a.ph);
      if (tw > 0.5) px(ctx, mx, my, Math.max(1, a.r | 0), Math.max(1, a.r | 0), a.c);
    } else if (a.k === "fly") {
      var fa = t * a.sp + a.ph;
      var fx = a.x + Math.cos(fa) * a.r;
      var fy = a.y + Math.sin(fa * 1.3) * a.r * 0.5;
      var pulse = 0.5 + 0.5 * Math.sin(t * 3.1 + a.ph);
      if (pulse > 0.35) {
        px(ctx, fx, fy, 1, 1, a.c);
        if (pulse > 0.75) { px(ctx, fx - 1, fy, 1, 1, a.c); px(ctx, fx + 1, fy, 1, 1, a.c); px(ctx, fx, fy - 1, 1, 1, a.c); px(ctx, fx, fy + 1, 1, 1, a.c); }
      }
    } else if (a.k === "star") {
      var st = 0.5 + 0.5 * Math.sin(t * 1.7 + a.ph);
      if (st > 0.45) px(ctx, a.x, a.y, 1, 1, st > 0.8 ? "#ffffff" : "#fff3d0");
    } else if (a.k === "shimmer") {
      var sh = Math.sin(t * 1.4 + a.ph);
      if (sh > 0) px(ctx, a.x + sh * 3, a.y, a.w, 1, sh > 0.7 ? "#ffe9c0" : "#9dbde0");
    } else if (a.k === "bird") {
      var bx = (a.x + t * a.sp) % (PXW + 40) - 20;
      var by = a.y + Math.sin(t * 0.8 + a.ph) * 4;
      var flap = Math.sin(t * 7 + a.ph) > 0 ? 1 : -1;
      px(ctx, bx, by, 2, 1, "#5a4a3a");
      px(ctx, bx - 2, by - flap, 2, 1, "#5a4a3a");
      px(ctx, bx + 2, by - flap, 2, 1, "#5a4a3a");
    }
  }
}

/* Painted backgrounds, kept.

   Repainting a scene costs about 50ms — every tree, every dithered
   band, every tuft of grass, one `fillRect` per pixel — and the chapter
   was doing it on every single move, including the many moves that stay
   in the same place. Two nodes in the meadow meant painting the meadow
   twice.

   Seeding by the place rather than the node (see below) is what makes
   caching possible at all: the same scene now paints identically every
   time, so the second visit can simply be the first one again. Eleven
   scenes at 320x180 is about two and a half megabytes, and it turns
   every revisit from 50ms into a blit. */
var hvSceneCache = {};

function hvPaintBase(n) {
  /* Seeded by the place, not by the node. It used to be both, which
     meant the meadow rearranged its own trees every time you took a
     step through it — the same valley, reshuffled, on a path whose
     whole point is that both ways come out at the same gate. A place
     is now the same place every time you are standing in it. */
  var scene = hvSceneOf(n);
  /* A node can ask for something to be painted INTO the scene rather
     than over it — the thing in the trees is the only one, and it is
     there because the writing says it stops moving. Painted in, it gets
     the wood's own trees in front of it for free. Cached under its own
     key so the other nodes in this scene do not inherit a bear. */
  var extra = n.bear === "shadow" ? { lurker: hvPaintLurker } : null;
  var key = scene + (extra ? ":lurker" : "");
  if (!hvSceneCache[key]) {
    var made = spriteCanvas(PXW, PXH);
    (HV_SCENES[scene] || HV_SCENES.sakura)(made.ctx, hvSeed(scene), extra);
    hvSceneCache[key] = made.c;
  }
  hvBase = hvSceneCache[key];
  hvActors = hvBuildActors(n, hvSeed(scene + "actors"));
}

/* ---------- where the two of them are standing ----------
   Every scene with a path puts them on it, at the point the path is
   about three quarters of the way down — near enough to read as people,
   far enough that the valley is still the subject. The scenes without a
   path get a spot picked to leave the frame's own business alone: the
   orchard puts them at the near end of the row so the bear is still
   four trees away, the sunset puts them off to one side of the water so
   the letter has the middle.

   A node can override it with `stand`, which is how crossing the stream
   moves them from one bank to the other. */
const HV_STAND = {
  sakura:  { x: 286, y: 152, s: 1.5 },
  forest:  { x: 286, y: 150, s: 1.5 },
  hollow:  { x: 286, y: 152, s: 1.5 },
  meadow:  { x: 286, y: 154, s: 1.5 },
  stream:  { x: 288, y: 158, s: 1.5 },
  sunset:  { x: 286, y: 158, s: 1.5 },
  lantern: { x: 286, y: 154, s: 1.5 },
  ridge:   { x: 286, y: 150, s: 1.5 },
  orchard: { x: 286, y: 152, s: 1.5 },
  bridge:  { x: 26,  y: 146, s: 1.3 },
  home:    { x: 286, y: 152, s: 1.5 },
};

/* =========================================================
   THE FOG, DRAWN ONCE INSTEAD OF THIRTY-FOUR THOUSAND TIMES

   `blob` sets a fill colour and fills a single pixel, per pixel — which
   is fine for scenery painted once into a buffer, and ruinous for
   something drawn every frame. The fog is three bands of five blobs
   fifty-two pixels across, so it was making about thirty-four thousand
   canvas calls a frame and costing 7.2ms of a 16.7ms budget. Measured,
   not guessed: tools/hvperf.js.

   Each band's puff is identical, so it is drawn once into its own tiny
   canvas and then blitted five times. The output is pixel for pixel the
   same — it is the same blob, from the same function, with the same
   tones — and it costs fifteen drawImage calls instead.
   ========================================================= */
var hvFogCache = {};

function hvFogPuff(band, fh) {
  var key = band + ":" + fh;
  if (hvFogCache[key]) return hvFogCache[key];
  var rx = 52, ry = fh * 0.5;
  var made = spriteCanvas(rx * 2 + 2, Math.ceil(ry * 2) + 2);
  blob(made.ctx, rx, ry, rx, ry, ["#f2f4f6", "#e2e6ea", "#d0d6dc", "#bfc6ce"]);
  hvFogCache[key] = made.c;
  return made.c;
}

/* Seconds since she arrived at this node. The whole chapter used raw
   session time for anything that was supposed to happen on arrival,
   which is why the lanterns never once came on in order: by the time
   anybody reached that scene the clock was minutes past the last cue
   and all five were simply already lit. */
var hvArrive = -1;

/* Which of the two closing questions she is standing in. The nudge and
   the really-sure screen are shared between the two paths now, so they
   have to be told which sunset — or doorway — they are happening in. */
var hvAskFrom = "ask";

function hvSceneOf(n) {
  if (n && n.sceneOfAsk) {
    var a = HV[hvAskFrom];
    return (a && a.scene) || "sunset";
  }
  return n && n.scene;
}

/* =========================================================
   THREE THINGS TO DO, BUILT ONCE

   The writing here already contains four perfectly good mechanics —
   seven stones and not one of them flat, a bridge that holds one plank
   at a time, fog you have to wait out, a bear four trees down that has
   not looked up yet — and all four of them were paragraphs. The picture
   never did any of it.

   So they are things you do now. Three rules held throughout:

   1. **Nothing here can be failed.** Going in the stream is written,
      and it is the warmer of the two endings to that beat. Mistiming
      the bridge costs a step. The bear is the one that sends you
      backwards, and backwards is three trees, in the same scene, with
      the same buttons — which is what it already was.
   2. **Nothing here can be stuck.** These three used to keep a button
      that walked past them, and it has been taken out: a mechanic you
      can click past is decoration. What replaces that safety is that
      none of them can be lost — the stones let you across wet or dry,
      the bridge simply will not take a badly timed step, and the bear
      costs you three trees. And the way OUT of the screen is never
      taken away: back, back-to-the-start and leave sit in the top bar
      on every frame of every one of them.
   3. **One input.** Tap the canvas, or hold space. That is the whole
      control scheme, and it is the same in all three.
   ========================================================= */
var hvPlay = null;         // whatever is being played on the canvas now
var hvHold = false;        // is the finger (or the space bar) down
var hvHint = "";           // the one line of instruction, drawn on canvas

function hvEase(x) { return x < 0 ? 0 : x > 1 ? 1 : x * x * (3 - 2 * x); }

/* the seven stones, at exactly the coordinates the scene painter uses,
   so the ones you step on are the ones you can see */
function hvStoneAt(k) {
  return { x: 52 + k * 34 + Math.sin(k * 1.3) * 5, y: 143 - k * 5 };
}

/* The paper note is the cat talking, and it sits over the bottom third
   of the stage. That is exactly where the stones and the orchard row
   are, so once she starts doing one of these the note lifts away and
   the frame is hers — and it comes straight back if she stops. The
   buttons never move: they are the way out and must always be there. */
function hvNoteAway(away) {
  const note = document.getElementById("hv-note");
  if (note) note.classList.toggle("hv-note-away", !!away);
}

/* =========================================================
   THE BUTTONS WAIT FOR THE CONVERSATION

   They used to appear the instant a scene opened, sitting there while
   the two of them were still talking — so the fastest way through the
   chapter was to press the button before anybody had said anything,
   and every line of dialogue was optional furniture.

   Now a scene with talking in it holds its choices back until the
   talking is done. A tap hurries a line along, so nobody is ever made
   to wait; it just cannot be skipped without being seen.

   The three mechanic screens are exempt, and that is deliberate: the
   rule that none of them can ever be stuck outranks this one, and
   tools/hvplay.js asserts their buttons are on screen for every frame.
   ========================================================= */
function hvRevealChoices(n) {
  var hush = !!hvVoicesOf(n).length && !n.play && !hvVoicesDone(n);
  if (hvHushed === hush) return;
  hvHushed = hush;
  ["hv-left", "hv-right", "hv-centre", "hv-cards"].forEach(function (id) {
    var el = document.getElementById(id);
    if (!el) return;
    el.classList.toggle("hv-hushed", hush);
    Array.prototype.forEach.call(el.querySelectorAll("button"), function (b) {
      b.disabled = hush;
    });
  });
}
var hvHushed = null;

function hvPlayBegin(n) {
  hvPlay = null;
  hvHint = "";
  hvHold = false;
  hvNoteAway(false);
  if (!n || !n.play) return;

  if (n.play === "stones") {
    hvPlay = { kind: "stones", i: -1, wet: 0, hop: 1, fx: 62, fy: 174, done: 0 };
    hvHint = "tap a stone when it steadies";
  } else if (n.play === "bridge") {
    hvPlay = { kind: "bridge", k: n.span[0], steps: 0, need: 4, wob: 0, done: 0 };
    hvHint = "tap when the span is steady";
  } else if (n.play === "orchard") {
    hvPlay = { kind: "orchard", x: 74, look: 0, idle: 0, done: 0 };
    hvHint = "hold to creep — stop when it looks up";
  }

  /* How long to leave the paper up before it lifts on its own. These
     three screens are the only ones where the picture is the point, and
     the note covers the ground they happen on — but the line still has
     to be readable first, so it goes when it has been read rather than
     on a fixed count. Touching anything lifts it early. */
  if (hvPlay) hvPlay.readBy = 2.4 + Math.min(9, (n.say || "").length * 0.045);
}

/* how alert the bear is, 0 while it is feeding and 1 while its head is
   up, with the half-second of stillness in between that is the only
   warning you get. One function so the drawing and the rule agree. */
function hvBearLook(st) {
  var cycle = 5.2, p = st % cycle;
  if (p < 2.9) return 0;                       // head down, working
  if (p < 3.4) return (p - 2.9) / 0.5;         // it stops chewing
  if (p < 4.7) return 1;                       // looking down the row
  return 1 - (p - 4.7) / 0.5;                  // and back to the windfalls
}

/* the steadying meter both the stones and the bridge are timed against:
   a value swinging through zero, where zero is the moment to move */
function hvSway(t, seed) { return Math.sin(t * 3.1 + seed * 1.7); }

function hvPlayWalking() {
  if (!hvPlay) return 0;
  if (hvPlay.kind === "stones") return hvPlay.hop < 1 ? 1 : 0;
  if (hvPlay.kind === "bridge") return hvPlay.wob > 0.1 ? 1 : 0;
  if (hvPlay.kind === "orchard") return hvHold && !hvPlay.done ? 1 : 0;
  return 0;
}

function hvPlayPairX(stand) {
  if (!hvPlay) return stand.x;
  if (hvPlay.kind === "stones") {
    var a = hvPlay.i < 0 ? { x: 62, y: 174 } : hvStoneAt(hvPlay.i);
    var b = hvPlay.i + 1 > 6 ? { x: 268, y: 106 } : hvStoneAt(hvPlay.i + 1);
    if (hvPlay.hop >= 1) return a.x;
    return a.x + (b.x - a.x) * hvPlay.hop;
  }
  if (hvPlay.kind === "bridge") return 54 + (PXW - 112) * hvPlay.k;
  if (hvPlay.kind === "orchard") return hvPlay.x;
  return stand.x;
}

function hvPlayPairY(stand) {
  if (!hvPlay) return stand.y;
  if (hvPlay.kind === "stones") {
    var a = hvPlay.i < 0 ? { x: 62, y: 174 } : hvStoneAt(hvPlay.i);
    var b = hvPlay.i + 1 > 6 ? { x: 268, y: 106 } : hvStoneAt(hvPlay.i + 1);
    if (hvPlay.hop >= 1) return a.y;
    // a hop is a little arc, not a slide
    var lin = a.y + (b.y - a.y) * hvPlay.hop;
    return lin - Math.sin(hvPlay.hop * Math.PI) * 7;
  }
  if (hvPlay.kind === "bridge") {
    return 106 + Math.sin(hvPlay.k * Math.PI) * 16 + 2 + hvPlay.wob * 2;
  }
  if (hvPlay.kind === "orchard") return stand.y;
  return stand.y;
}

/* one press, wherever it came from */
function hvPlayPress(t) {
  if (!hvPlay || hvPlay.done) return false;
  var p = hvPlay;
  if (p.firstInput === undefined) p.firstInput = hvArrive >= 0 ? t - hvArrive : 0;

  if (p.kind === "stones") {
    if (p.hop < 1) return true;                       // mid-air, ignore
    hvNoteAway(true);
    var steady = Math.abs(hvSway(t, p.i + 1)) < 0.66;
    p.hop = 0;
    p.i++;
    if (!steady) {
      p.wet++; hvSfx("locked");
      if (window.OST) window.OST.hit("slip");
      hvBurst(hvStoneAt(p.i).x, hvStoneAt(p.i).y, "#a8d2e6");
    } else {
      hvSfx("step");
      /* seven stones, seven steps up the scale — crossing cleanly is a
         rising line, and going in is the one note that is not in it */
      if (window.OST) window.OST.hit("stone", p.i);
    }
    if (p.i >= 6) { p.done = 1; p.finish = t + 0.9; }
    return true;
  }

  if (p.kind === "bridge") {
    hvNoteAway(true);
    var ok = Math.abs(hvSway(t, p.steps)) < 0.62;
    if (ok) {
      p.steps++;
      p.k += (HV[hvNode].span[1] - HV[hvNode].span[0]) / p.need;
      p.wob = 0.5;
      hvSfx("step");
      /* The bridge is the only place in the game that refuses to play
         the tune. It gives it back one note per plank instead, so the
         theme assembles under her feet as she crosses — and the far
         post is the first time in the chapter she has heard the whole
         of it. */
      if (window.OST) window.OST.hit("step");
      if (p.steps >= p.need) { p.done = 1; p.finish = t + 0.7; }
    } else {
      p.wob = 1;                                      // the span moves, they wait
      hvSfx("locked");
    }
    return true;
  }

  return false;
}

/* per-frame advance for whichever one is running */
function hvPlayStep(t, st, dt) {
  if (!hvPlay) return;
  var p = hvPlay;
  if (p.readBy && st > p.readBy) hvNoteAway(true);

  if (p.kind === "stones") {
    if (p.hop < 1) p.hop = Math.min(1, p.hop + dt * 3.4);
  } else if (p.kind === "bridge") {
    if (p.wob > 0) p.wob = Math.max(0, p.wob - dt * 1.6);
  } else if (p.kind === "orchard") {
    var wasLook = p.look;
    p.look = hvBearLook(st);
    /* Which of the two written arrivals she gets, now that there is no
       button to pick one with. The obvious rule — "did she ever stop?" —
       turns out to be unavailable: the row is 172 pixels at 26 a second
       and the safe window is 2.9 of every 5.2, so she MUST stop at least
       twice. Nobody crosses this row without stopping.

       So it counts the stopping she did not have to do: time stood still
       while it was safe to move. Dawdle and it is "so you wait, ten
       minutes of standing perfectly still"; take every window you are
       given and it is the crossing where she does not waste a step. */
    if (p.look < 0.5 && !hvHold && !p.done) p.idle += dt;
    /* the score pulls back to almost nothing the moment its head comes
       up, and comes back when it goes down — the held breath is the
       music leaving, not a sound effect arriving */
    if (window.OST) {
      if (p.look > 0.5) window.OST.duck(0.22, 0.4);
      if (wasLook <= 0.5 && p.look > 0.5) window.OST.hit("heart");
    }
    if (!p.done) {
      if (hvHold) {
        if (p.firstInput === undefined) p.firstInput = st;
        if (p.x < 76) hvNoteAway(true);
        p.x += dt * 26;
        /* caught only while actually moving, and only once its head is
           all the way up — a step taken during the half-second tell is
           forgiven, because that half second is the warning */
        if (p.look > 0.98) {
          p.done = 2; p.finish = t + 0.5;
          if (window.OST) window.OST.hit("seen");
        }
        else if (p.x > 246) { p.done = p.idle > 2.5 ? 3 : 1; p.finish = t + 0.6; }
      }
    }
  }

  if (p.done && p.finish && t >= p.finish) hvPlayFinish();
}

/* where each of them comes out */
function hvPlayFinish() {
  var p = hvPlay, n = HV[hvNode];
  if (!p || !n) return;
  hvPlay = null;
  if (p.kind === "stones") hvGo(p.wet ? "there_wet" : "there_dry");
  else if (p.kind === "bridge") hvGo(n.playTo);
  else if (p.kind === "orchard") {
    hvGo(p.done === 2 ? "back_bear_seen"
       : p.done === 3 ? "back_bear_wait" : "back_bear_quiet");
  }
}

/* the mechanic's own furniture: the stone you are aiming at, the sway
   on the span, the line of instruction. Drawn in the scene, in the
   scene's palette, never as a panel over the top of it. */
function hvPlayPaint(ctx, t, st) {
  if (!hvPlay) return;
  var p = hvPlay;

  if (p.kind === "stones" && p.hop >= 1 && !p.done) {
    var s = hvStoneAt(p.i + 1);
    var sway = hvSway(t, p.i + 1);
    var steady = Math.abs(sway) < 0.66;
    // the stone rocks under the water, and settles as it comes level
    px(ctx, s.x - 9 + sway * 3, s.y + 4, 18, 1, "rgba(255,255,255,0.4)");
    // a ring that closes as it steadies, so the timing is visible
    var r = 5 + Math.abs(sway) * 7;
    ctx.save();
    ctx.globalAlpha = 0.75;
    blob(ctx, s.x, s.y - 1, r, r * 0.5, [steady ? "#fff2b0" : "#bfd8e4"]);
    ctx.globalAlpha = 1;
    blob(ctx, s.x, s.y, 8, 4, ["#e2d8bd", "#c8bba0", "#a89b83", "#877c68"]);
    ctx.restore();
  }

  if (p.kind === "bridge" && !p.done) {
    var bs = hvSway(t, p.steps);
    var steady2 = Math.abs(bs) < 0.62;
    var bx = 54 + (PXW - 112) * p.k;
    var by = 106 + Math.sin(p.k * Math.PI) * 16;
    // the next plank, and how much the span is moving under it
    px(ctx, bx + 4 + bs * 4, by + 1, 8, 2, steady2 ? "#c8a878" : "#6b5540");
    ctx.save();
    ctx.globalAlpha = 0.7;
    blob(ctx, bx + 8, by - 3, 4 + Math.abs(bs) * 6, 3, [steady2 ? "#ffe0a0" : "#7f6a90"]);
    ctx.restore();
  }

  if (p.kind === "orchard") {
    /* how far down the row they are, as grass trodden flat behind them
       rather than a bar across the picture — a progress meter drawn as
       a line was the one thing on this screen that looked like a games
       console and not like an orchard */
    ctx.save();
    for (var tr = 74; tr < p.x - 3; tr += 7) {
      ctx.globalAlpha = 0.34 + 0.24 * Math.sin(tr * 0.7);
      px(ctx, tr, 175, 4, 1, "#6d7a58");
      px(ctx, tr + 2, 177, 3, 1, "#5c6a4a");
    }
    /* and one mark ahead of them that stays lit while it is safe to
       move, so the rule is visible without a word of interface */
    ctx.globalAlpha = 0.7;
    px(ctx, p.x + 6, 176, 5, 1, p.look > 0.5 ? "#c8705e" : "#9fd08a");
    ctx.restore();
  }

  /* The line of instruction used to fade at seven seconds whether or not
     she had worked out what to do. That was survivable while a button
     sat underneath it; now that the button is gone this is the only
     thing telling her how to play, so it stays until she has actually
     done something, and then gets out of the way. */
  if (hvHint && st > 0.6 && !p.done) {
    var since = p.firstInput === undefined ? null : st - p.firstInput;
    var vis = since === null ? 1 : Math.max(0, 1 - since / 1.2);
    if (vis > 0.02) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, (st - 0.6) * 2) * vis;
      hvTinyText(ctx, hvHint, PXW / 2, 30);
      ctx.restore();
    }
  }
}

/* A three-pixel-tall alphabet, for the one line of instruction each of
   these needs. The note under the stage is the cat talking and this is
   not the cat, so it does not go there. */
const HV_TINY = {
  a:"010101111101101",b:"110101110101110",c:"011100100100011",d:"110101101101110",
  e:"111100110100111",f:"111100110100100",g:"011100101101011",h:"101101111101101",
  i:"111010010010111",j:"001001001101010",k:"101101110101101",l:"100100100100111",
  m:"101111111101101",n:"101111111111101",o:"010101101101010",p:"110101110100100",
  q:"010101101111011",r:"110101110101101",s:"011100010001110",t:"111010010010010",
  u:"101101101101011",v:"101101101101010",w:"101101111111101",x:"101101010101101",
  y:"101101010010010",z:"111001010100111"," ":"000000000000000","—":"000000111000000",
  ".":"000000000000010",",":"000000000010100","'":"010010000000000",
};
function hvTinyWidth(text) { return text.length * 4 - 1; }

/* draws from a left edge, in whatever colour it is handed */
function hvTinyAt(ctx, text, x0, y, colour) {
  var s = text.toLowerCase().split("");
  for (var i = 0; i < s.length; i++) {
    var g = HV_TINY[s[i]];
    if (!g) continue;
    for (var r = 0; r < 5; r++) {
      for (var c2 = 0; c2 < 3; c2++) {
        if (g[r * 3 + c2] === "1") px(ctx, x0 + i * 4 + c2, y + r, 1, 1, colour);
      }
    }
  }
}

/* centred, on its own dark scrim — for the one line of instruction */
function hvTinyText(ctx, text, cx, y) {
  var w = hvTinyWidth(text);
  var x0 = Math.round(cx - w / 2);
  px(ctx, x0 - 3, y - 2, w + 6, 9, "rgba(24,18,30,0.42)");
  hvTinyAt(ctx, text, x0, y, "#fff4dc");
}

/* =========================================================
   THEY SAY THINGS TO EACH OTHER

   Forty-seven nodes and not one line of dialogue: a cat narrated their
   entire relationship in the second person, and the player was told
   "you both laugh far too loudly" without ever hearing either of them.
   The most reliable way to make a reader feel something about two
   people is to let the two people talk.

   So a node can carry `voices`, and they arrive one at a time over the
   scene, in a little pixel bubble above whoever is speaking — hers
   edged in pink, his in blue, so you never have to be told which is
   which. They are short on purpose. Nobody in this valley makes
   speeches.
   ========================================================= */
var hvPairAt = null;          // where the two of them were last drawn

/* Which line is on screen and when it arrived, in node-time. It used to
   be derived from the clock alone, which meant she could not hurry it
   along — and a conversation you cannot skip is a cutscene. Now the
   clock advances it, and so does a tap. */
var hvVoiceI = -1, hvVoiceAt = 0;
const HV_VOICE_LEAD = 1.0;    // a beat to look at the picture first
const HV_VOICE_HOLD = 2.9;    // how long a line stays up on its own

function hvVoicesOf(n) {
  if (!n) return [];
  if (n.voicesOfKeepsake) return n.voicesOfKeepsake[hvKeepsake || "heart"] || [];
  if (n.voicesIfMet) {
    return hvHasWalked(n.voicesIfMet.route) ? n.voicesIfMet.yes : n.voicesIfMet.no;
  }
  return n.voices || [];
}

function hvVoicesDone(n) { return hvVoiceI >= hvVoicesOf(n).length; }

/* time and taps both move it on */
function hvVoiceStep(n, st) {
  var v = hvVoicesOf(n);
  if (!v.length) { hvVoiceI = 0; return; }
  if (hvVoiceI < 0) {
    if (st >= HV_VOICE_LEAD) { hvVoiceI = 0; hvVoiceAt = st; }
    return;
  }
  if (hvVoiceI < v.length && st - hvVoiceAt >= HV_VOICE_HOLD) {
    hvVoiceI++; hvVoiceAt = st;
  }
}

/* There is no way to hurry them any more.

   A tap used to jump to the next line, with a blinking chevron in the
   bubble advertising it. Taken out on purpose: the two of them talking
   is the chapter, not an obstacle in front of it, and a skip button
   turns every line into something to get past. They say their piece at
   their own pace and the choices arrive when they have finished. */

function hvWrapTiny(text, maxChars) {
  var words = text.split(" "), lines = [], cur = "";
  for (var i = 0; i < words.length; i++) {
    var t = cur ? cur + " " + words[i] : words[i];
    if (t.length > maxChars && cur) { lines.push(cur); cur = words[i]; }
    else cur = t;
  }
  if (cur) lines.push(cur);
  return lines;
}

function hvDrawVoices(ctx, n, st) {
  var v = hvVoicesOf(n);
  if (!v.length || !hvPairAt) return;
  var idx = hvVoiceI;
  if (idx < 0 || idx >= v.length) return;
  var age = st - hvVoiceAt;
  var fade = Math.min(1, age * 4.5);
  if (fade <= 0.02) return;

  var who = v[idx][0], text = v[idx][1];
  var lines = hvWrapTiny(text, 26);
  var w = 0;
  lines.forEach(function (l) { w = Math.max(w, hvTinyWidth(l)); });
  var bw = w + 10, bh = lines.length * 7 + 7;

  /* anchored to whoever is speaking and opening away from the frame
     edge, so it never runs off the right-hand side */
  var ax = hvPairAt.x + (who === "her" ? -12 : 6);
  var bx = Math.max(4, Math.min(PXW - bw - 4, ax - bw + 8));
  var by = Math.max(26, hvPairAt.y - hvPairAt.h - 10 - bh);

  ctx.save();
  ctx.globalAlpha = fade;
  var edge = who === "her" ? "#e0789c" : "#5f78a8";
  px(ctx, bx + 1, by + 2, bw, bh, "rgba(28,20,34,0.34)");     // its shadow
  px(ctx, bx, by, bw, bh, "#fffaf0");
  px(ctx, bx, by, bw, 2, edge);
  px(ctx, bx, by + bh - 1, bw, 1, "#d8c9ad");
  px(ctx, bx, by, 1, bh, "#d8c9ad"); px(ctx, bx + bw - 1, by, 1, bh, "#d8c9ad");
  // the tail, stepping down toward the one who is talking
  for (var k = 0; k < 4; k++) px(ctx, ax - 4 + k, by + bh - 1 + k, 4 - k, 1, "#fffaf0");
  lines.forEach(function (l, i) {
    hvTinyAt(ctx, l, bx + 5, by + 5 + i * 7, "#4a3a2e");
  });
  ctx.restore();
}

/* the per-frame pass: background, moving cast, then characters */
function hvPaintFrame(t, dt) {
  var n = HV[hvNode];
  var canvas = document.getElementById("hv-canvas");
  if (!canvas || !n) return;
  var ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;

  if (hvArrive < 0) hvArrive = t;
  var st = t - hvArrive;                 // time at this node, from zero
  hvPlayStep(t, st, dt || 0.016);
  n = HV[hvNode] || n;                   // a mechanic may have moved us on

  ctx.clearRect(0, 0, PXW, PXH);
  ctx.drawImage(hvBase, 0, 0);
  hvDrawActors(ctx, t);

  var rnd = hvSeed(n.scene + hvNode + "fg");
  var put = function (sp, x, y, s) {
    s = s || 1;
    ctx.drawImage(sp, 0, 0, sp.width, sp.height, x | 0, y | 0, (sp.width * s) | 0, (sp.height * s) | 0);
  };

  if (n.title) {
    put(drawNyan(), PXW - 66, 12 + Math.sin(t * 1.4) * 2, 1);
    /* Drawn at 1:1. The old logo was built at three pixels a cell and
       then put down at 0.62, so every cell landed on 1.86 screen pixels
       and the letters mushed — which is most of why the G read as an O
       whatever shape it was given. */
    var logo = drawLogo("THE LONG WAY\nROUND");
    put(logo, Math.round((PXW - logo.width) / 2), 32 + Math.sin(t * 0.9) * 1.5, 1);
  }

  if (n.butterflies) {
    put(drawFlowerCard(), PXW / 2 - 30, 78 + Math.sin(t * 0.8) * 1.5, 2.2);
    /* Real flight: a looping figure-of-eight around a home point, wings
       beating fast, and the beat easing off at the top of each rise the
       way a butterfly glides. */
    [["blue", 52, 56, 0], ["red", PXW - 78, 50, 2.1]].forEach(function (b) {
      var ph = t * 1.15 + b[3];
      var fx = b[1] + Math.sin(ph) * 13;
      var fy = b[2] + Math.sin(ph * 2) * 7 + Math.sin(t * 0.7 + b[3]) * 3;
      var glide = Math.max(0, Math.sin(ph * 2 + 1));
      var beat = Math.abs(Math.sin(t * (9 - glide * 4) + b[3]));
      put(drawButterfly(b[0], 0.25 + beat * 0.75), fx, fy, 1.8);
    });
  }

  if (n.fox) put(drawFoxAlive(t), PXW - 122, 112 + Math.sin(t * 0.7) * 1, 1.6);

  /* ---- the bear ----
     It used to be a full-screen jumpscare on its own overlay with a
     Restart button under it. It is a thing standing in the scene now, in
     the same frame as everything else, and there are two of it: a shape
     among the trees on the way there that turns out to be a deer, and a
     real one four trees down the orchard, chewing, which is a problem to
     get round rather than a way to lose. */
  if (n.bear === "real") {
    /* Four trees down, in the row, working through the windfalls: it
       shoulders forward, dips to the grass, comes up chewing. While the
       row is being crept it also lifts its head on its own rhythm, and
       that rhythm is the thing being played against — the same function
       decides what is drawn and what counts as having been seen. */
    var look = hvPlay && hvPlay.kind === "orchard" ? hvPlay.look : 0;
    var rb = look > 0.5 ? drawBearAlert() : drawBearGrazing();
    var dip = look > 0.5 ? 0 : Math.max(0, Math.sin(t * 0.5)) * 3;
    var shove = Math.sin(t * 0.28) * 3;
    /* Four trees down when she arrives, and nearer with every step she
       takes: the bear is scaled by how far along the row she is, with
       its feet pinned to its own ground line so it grows upward the way
       a thing you are walking toward does. Standing still, it stays the
       size something four trees away should be. */
    var near = hvPlay && hvPlay.kind === "orchard"
      ? Math.max(0, Math.min(1, (hvPlay.x - 74) / 172)) : 0;
    var bs = 0.58 + near * 0.42;
    var bw2 = Math.round(66 * bs), bh2 = Math.round(47 * bs);
    var bx2 = 210 + shove, by2 = 139 - bh2 + dip;
    /* a soft pool rather than a grey slab — the old one was a hard bar
       under its feet that made it look propped up on a shelf */
    ctx.save();
    ctx.globalAlpha = 0.32;
    blob(ctx, bx2 + bw2 / 2, by2 + bh2 - 1, bw2 * 0.42, 3, ["#140d1c"]);
    ctx.restore();
    ctx.drawImage(rb, 0, 0, rb.width, rb.height, bx2 | 0, by2 | 0, bw2, bh2);
    /* The lantern glow that used to be painted over its back is gone:
       it was positioned against the old fixed height and, now that the
       bear grows as she nears it, it detached into a grey disc floating
       above the animal. The rim along its spine is the same light doing
       the same job, and it is part of the sprite, so it cannot drift. */
    // windfalls in the grass, some of them already gone
    [[182, 150], [214, 156], [244, 148], [262, 158], [196, 162], [230, 166]].forEach(function (w3) {
      blob(ctx, w3[0], w3[1], 2.6, 2.2, ["#a4553a", "#82412c", "#63301f", "#4a2417"]);
    });
    // long grass in front of its feet, so it is standing in the orchard
    var ornd = hvSeed("orchardfg");
    grassTufts(ctx, PXW, by2 + bh2 + 2, 16, ["#2b3a2c", "#22301f", "#192518"], ornd);
  }

  /* ---- the two of them, on the ground of wherever this is ----
     Drawn after the scenery and the animals and before the weather, so
     the fog closes over them and the bear stays behind them in the row.
     They walk in from behind the frame on arrival and then stand, which
     is what turns pressing a button into having gone somewhere. */
  var stand = n.stand || HV_STAND[hvSceneOf(n)];
  /* The bridge draws its own pair, out on the span, so it is not also
     drawn standing on the bank behind them. */
  if (stand && !n.title && !n.isAsk && n.pair !== false &&
      (hvPlay || typeof n.plank !== "number")) {
    var walkIn = Math.min(1, st / 1.25);
    var px0 = stand.x - (n.from === "right" ? -52 : 52) * (1 - hvEase(walkIn));
    var pairX = hvPlay ? hvPlayPairX(stand) : px0;
    var pairY = hvPlay ? hvPlayPairY(stand) : stand.y;
    hvDrawPair(ctx, pairX, pairY, stand.s,
      t, hvPlay ? hvPlayWalking() : (walkIn < 1 ? 1 : 0), hvSceneOf(n));
    hvPairAt = { x: pairX, y: pairY, h: 23 * stand.s };
  } else {
    hvPairAt = null;
  }

  /* the thing he has been carrying, held out. It lifts as it is offered
     and then settles, and it is the same card she tapped at the very
     start of the walk rather than a new picture of one. */
  if (n.giveKeepsake && hvPairAt) {
    var card = (hvKeepsake || "heart") === "flower" ? drawFlowerCard() : drawHeartCard();
    var rise = hvEase(Math.min(1, st / 1.4));
    var gx = hvPairAt.x - 4, gy = hvPairAt.y - hvPairAt.h - 4 - rise * 12 + Math.sin(t * 1.3) * 1.2;
    var gs = 1.3;
    ctx.save();
    ctx.globalAlpha = rise;
    blob(ctx, gx + card.width * gs / 2, gy + card.height * gs / 2, 15, 13,
      ["rgba(255,228,180,0.16)"]);
    ctx.drawImage(card, 0, 0, card.width, card.height,
      gx | 0, gy | 0, Math.round(card.width * gs), Math.round(card.height * gs));
    ctx.restore();
    for (var gi = 0; gi < 8; gi++) {
      var ga = t * 1.8 + gi;
      if (Math.sin(ga) > 0.3) {
        px(ctx, gx + ((gi * 11) % 26) - 2, gy + ((gi * 7) % 20) + Math.sin(ga) * 3, 1, 1, "#fff0b8");
      }
    }
  }

  hvPlayPaint(ctx, t, st);
  hvVoiceStep(n, st);
  hvDrawVoices(ctx, n, st);
  hvRevealChoices(n);

  /* ---- the crossing, one section at a time ----
     The three bridge nodes are the same span from three places on it, so
     the planks behind them read as walked. Without this the
     careful-step beat is three paragraphs over an identical picture. */
  if (typeof n.plank === "number" && !hvPlay) {
    var k0 = 0.16 + n.plank * 0.34;
    var bx0 = 54, bw0 = PXW - 112, sag0 = 16, by0 = 106;
    var cxp = bx0 + bw0 * k0;
    var cyp = by0 + Math.sin(k0 * Math.PI) * sag0;
    // the planks already behind them, picked out warm
    for (var pk = 0; pk < 30; pk++) {
      var kk = pk / 29;
      if (kk > k0) break;
      var pxx = bx0 + bw0 * kk;
      px(ctx, pxx - 1, by0 + Math.sin(kk * Math.PI) * sag0 + 1, 4, 2, "#8a6f4e");
    }
    // the span swinging a little more the further out they are
    var swing = Math.sin(t * 1.1) * Math.sin(k0 * Math.PI) * 1.6;
    blob(ctx, cxp, cyp + 1, 13, 5, ["rgba(255,206,130,0.20)"]);
    hvDrawPair(ctx, cxp, cyp + 2 + swing, 1.2, t, 0, "bridge");
    lanternAt(ctx, cxp + 16, cyp - 16 + Math.sin(t * 1.6) * 1);
  }

  /* ---- the shower ----
     The hollow is painted as a bright birch wood with the sun coming
     down through it, and the writing said it was pouring. One of the
     two had to give, and repainting a finished scene to make it rain is
     the wrong way round: the rain is drawn over it, and it stops.

     Three layers of streaks at different speeds and lengths, a cool
     wash over the whole frame, and splashes ticking on the ground —
     lighter under the canopy the two of them are standing beneath,
     because that is the entire point of standing there. */
  if (n.rain || n.drip) {
    var wet = n.drip ? Math.max(0, 1 - st / 3) * 0.25 : Math.min(1, st / 1.1);
    if (wet > 0.01) {
      ctx.save();
      ctx.globalAlpha = 0.3 * wet;
      px(ctx, 0, 0, PXW, PXH, "#8296b4");
      ctx.restore();
      for (var rl = 0; rl < 3; rl++) {
        var speed = 150 + rl * 90, len = 5 + rl * 4;
        var count = (30 + rl * 22) * wet;
        ctx.save();
        for (var rp = 0; rp < count; rp++) {
          var seedx = ((rp * 71 + rl * 313) % PXW);
          var ry = ((t * speed + rp * 97 + rl * 41) % (PXH + 40)) - 20;
          /* the canopy they are under keeps some of it off */
          var shelter = hvPairAt && Math.abs(seedx - hvPairAt.x) < 26 ? 0.25 : 1;
          if (shelter < 1 && ry > hvPairAt.y - 54) continue;
          ctx.globalAlpha = (0.3 + rl * 0.16) * wet * shelter;
          px(ctx, seedx + rl, ry, 1, len, "#cfe0f2");
        }
        ctx.restore();
      }
      // and it landing
      ctx.save();
      ctx.globalAlpha = 0.4 * wet;
      for (var sp4 = 0; sp4 < 16; sp4++) {
        var sx4 = (sp4 * 37 + Math.floor(t * 3) * 53) % PXW;
        if (Math.sin(t * 9 + sp4) > 0.4) px(ctx, sx4, 150 + (sp4 % 5) * 6, 2, 1, "#dceaf6");
      }
      ctx.restore();
    }
  }

  /* ---- the fog on the top of the hill ----
     Three bands at different speeds and different heights, and — the
     part that was only ever written down — it lifts. Over about eight
     seconds of standing in it the bands thin and drift up and off, and
     the valley she was told was still there turns out to be still
     there. Waiting is the only thing this beat ever asked of her, and
     now waiting does something. */
  if (n.fog) {
    var lift = hvEase(Math.min(1, Math.max(0, (st - 1.6) / 6.4)));
    for (var fb = 0; fb < 3; fb++) {
      var fy = 74 + fb * 26 - lift * (24 + fb * 16);
      var fh = 22 + fb * 7;
      var drift = ((t * (5 + fb * 3) + fb * 130) % (PXW + 200)) - 100;
      var puff = hvFogPuff(fb, fh);
      ctx.save();
      ctx.globalAlpha = (0.3 + fb * 0.13 + 0.04 * Math.sin(t * 0.6 + fb)) * (1 - lift * 0.92);
      for (var fx2 = 0; fx2 < 5; fx2++) {
        ctx.drawImage(puff,
          (drift + fx2 * 74 - 52) | 0,
          (fy + Math.sin(t * 0.4 + fx2 + fb) * 2 - fh * 0.5) | 0);
      }
      ctx.restore();
    }
    ctx.save();
    ctx.globalAlpha = 0.22 * (1 - lift);
    px(ctx, 0, 60, PXW, PXH - 60, "#e6eaee");
    ctx.restore();
  }

  /* ---- the lanterns coming on, one and then the next ----
     The left path watches a sunset happen to it. This is the same beat
     from the other side of the year: light that arrives because somebody
     put it there, in the order you walk past it. */
  if (n.lighting) {
    for (var Ln = 0; Ln < 5; Ln++) {
      var onAt = 0.5 + Ln * 0.85;
      if (st < onAt) continue;
      var age = Math.min(1, (st - onAt) / 0.5);
      var lx2 = 26 + Ln * 62 + (Ln * 7) % 11;
      var flick = 0.86 + 0.14 * Math.sin(t * 6 + Ln * 2);
      ctx.save();
      ctx.globalAlpha = age * flick;
      blob(ctx, lx2, 80, 15, 12, ["rgba(255,214,140,0.30)"]);
      blob(ctx, lx2, 80, 9, 7, ["rgba(255,232,180,0.42)"]);
      blob(ctx, lx2, 142, 26, 6, ["rgba(255,198,120,0.16)"]);
      ctx.restore();
      if (age < 1) {
        for (var sp3 = 0; sp3 < 6; sp3++) {
          px(ctx, lx2 - 6 + ((sp3 * 5) % 13), 80 - age * 16 - sp3 * 2, 1, 1, "#ffe9a8");
        }
      }
    }
  }

  if (n.envelope) {
    var e = drawEnvelope(n.envelope === "open");
    put(e, PXW / 2 - 33, (n.envelope === "open" ? 32 : 38) + Math.sin(t * 0.9) * 3, 1.5);
    for (var i = 0; i < 14; i++) {
      var sa = t * 1.6 + i;
      if (Math.sin(sa) > 0.2) px(ctx, PXW / 2 - 44 + ((i * 37) % 88), 26 + ((i * 23) % 54) + Math.sin(sa) * 3, 1, 1, "#ffe9a8");
    }
  }

  if (n.isAsk) {
    var cardW = 132, cardH = 104, cx = (PXW - cardW) / 2, cy = 24 + Math.sin(t * 0.7) * 2;
    px(ctx, cx + 3, cy + 4, cardW, cardH, "rgba(60,30,50,.35)");
    px(ctx, cx, cy, cardW, cardH, "#fffaf0");
    px(ctx, cx, cy, cardW, 2, "#ffffff");
    px(ctx, cx, cy + cardH - 2, cardW, 2, "#e6d8bf");
    for (var h = 0; h < 9; h++) {
      drawHeartInto(ctx, cx + 10 + ((h * 41) % (cardW - 20)), cy + 10 + ((h * 29) % (cardH - 20)), 1, "#ffc2d8");
    }
    var kitty = drawCat("idle");
    put(kitty, cx + cardW / 2 - 30, cy + cardH - 62, 1.5);
    drawHeartInto(ctx, cx + cardW - 16, cy + 16, 2, "#ef5f83");
    drawHeartInto(ctx, cx + 14, cy + cardH - 18, 2, "#ff9fb6");
  }

  if (n.hearts) {
    for (var k = 0; k < 14; k++) {
      var hy = 108 - ((t * 12 + k * 19) % 110);
      var hx = 24 + ((k * 47) % (PXW - 48)) + Math.sin(t * 1.1 + k) * 5;
      drawHeartInto(ctx, hx, hy, 1 + (k % 2), "#ff8fb0");
    }
  }

  /* something small hidden in the scenery, if this page has one */
  var spot = hvHiddenHere();
  if (spot) {
    var tok = hvDrawToken(spot.id);
    var glint = 0.5 + 0.5 * Math.sin(t * 2.1);
    ctx.drawImage(tok, 0, 0, tok.width, tok.height,
      spot.x - tok.width / 2, spot.y - tok.height / 2 + Math.sin(t * 1.1) * 1,
      tok.width, tok.height);
    if (glint > 0.82) px(ctx, spot.x + 6, spot.y - 6, 1, 1, "#fff6d0");
  }

  /* The cat sits in the bottom-left corner and it is a narrator, not a
     character in the scene. While one of the three mechanics is being
     played the frame belongs to the two of them — and, concretely, the
     stones begin on the near bank at x=62, which is squarely behind
     where the cat sits, so she could not see the pair she was steering.
     It comes back the moment they arrive somewhere. */
  if (n.cat && n.cat !== "hide" && !hvPlay) {
    /* a blink every few seconds, and a slow breath */
    var blink = (t % 4.4) > 4.2;
    var mood = blink && (n.cat === "idle" || n.cat === "happy") ? "happy" : n.cat;
    if (hvPoke > 0) { mood = "love"; hvPoke -= 0.016; }
    var scale = n.bigCat ? 2.8 : 2.0;
    var sp = drawCat(mood);
    var bob = Math.sin(t * 1.2) * 1.2;
    put(sp, n.bigCat ? PXW / 2 - sp.width * scale / 2 : 6,
        (n.bigCat ? 34 : PXH - sp.height * scale - 4) + bob, scale);
  }
}

/* ---------- pixel dissolve between scenes ----------
   Blocks of the incoming frame appear in a shuffled order. It is the
   transition this kind of game has always used, and it hides the fact
   that the whole background is being repainted. */
function hvStartTransition() {
  var canvas = document.getElementById("hv-canvas");
  if (!canvas) return;
  var prev = document.createElement("canvas");
  prev.width = PXW; prev.height = PXH;
  prev.getContext("2d").drawImage(canvas, 0, 0);

  var B = 8;                                  // block size, in scene pixels
  var cols = Math.ceil(PXW / B), rows = Math.ceil(PXH / B);
  var order = [];
  for (var i = 0; i < cols * rows; i++) order.push(i);
  for (var j = order.length - 1; j > 0; j--) {
    var k = (Math.random() * (j + 1)) | 0;
    var tmp = order[j]; order[j] = order[k]; order[k] = tmp;
  }
  hvTrans = { prev: prev, order: order, cols: cols, rows: rows, B: B, t: 0, dur: 0.42 };
}

function hvDrawTransition(ctx, dt) {
  if (!hvTrans) return false;
  hvTrans.t += dt;
  var p = Math.min(1, hvTrans.t / hvTrans.dur);
  var shown = Math.floor(p * hvTrans.order.length);

  /* everything not yet revealed still shows the outgoing frame */
  var buf = document.createElement("canvas");
  buf.width = PXW; buf.height = PXH;
  var bctx = buf.getContext("2d");
  bctx.imageSmoothingEnabled = false;
  bctx.drawImage(hvTrans.prev, 0, 0);
  bctx.save();
  bctx.beginPath();
  for (var i = 0; i < shown; i++) {
    var idx = hvTrans.order[i];
    var bx = (idx % hvTrans.cols) * hvTrans.B, by = ((idx / hvTrans.cols) | 0) * hvTrans.B;
    bctx.rect(bx, by, hvTrans.B, hvTrans.B);
  }
  bctx.clip();
  bctx.clearRect(0, 0, PXW, PXH);
  bctx.restore();

  ctx.drawImage(buf, 0, 0);
  if (p >= 1) { hvTrans = null; return false; }
  return true;
}

function hvLoop(now) {
  hvLoopId = requestAnimationFrame(hvLoop);
  if (!hvT0) hvT0 = now;
  var t = (now - hvT0) / 1000;
  var dt = Math.min(0.05, t - (hvLoop._last || t));
  hvLoop._last = t;

  var scr = document.getElementById("screen-quest");
  if (!scr || !scr.classList.contains("active")) return;

  hvPaintFrame(t, dt);
  var canvas = document.getElementById("hv-canvas");
  if (canvas) hvDrawBursts(canvas.getContext("2d"), dt);
  if (canvas && hvTrans) hvDrawTransition(canvas.getContext("2d"), dt);
}

function hvStartLoop() {
  if (hvLoopId) return;
  hvT0 = 0; hvLoop._last = 0;
  hvLoopId = requestAnimationFrame(hvLoop);
}
function hvStopLoop() {
  if (hvLoopId) cancelAnimationFrame(hvLoopId);
  hvLoopId = null;
}


/* ---------- rendering the DOM layer ---------- */
let hvLastSounded = null;

function hvRender(withTransition) {
  const n = HV[hvNode];
  if (!n) return;

  if (n.isAsk) hvAskFrom = hvNode;

  if (withTransition) { hvStartTransition(); hvSfx("page"); }
  hvPaintBase(n);
  hvArrive = -1;                       // everything on this node times from now
  hvVoiceI = -1; hvVoiceAt = 0;
  hvHushed = null;
  hvPlayBegin(n);
  hvStartLoop();
  hvAmbience(hvSceneOf(n));
  hvScore(n);
  hvNoteRoute(hvNode);
  /* arriving somewhere new deserves a note of its own — until now every
     scene in this game opened in silence */
  if (hvNode !== hvLastSounded) { hvLastSounded = hvNode; setTimeout(function(){ hvSfx("arrive"); }, 140); }

  const note = document.getElementById("hv-note");
  const askKind = (HV[hvAskFrom] && HV[hvAskFrom].ask) || "there";
  let say = n.isAsk
    ? (n.ask === "back" ? QUEST_FINAL.questionBack : QUEST_FINAL.question)
    : (n.sayOfAsk ? n.sayOfAsk[askKind] : n.say);
  /* a scene can greet a returning walker differently */
  if (n.sayAgain && hvRouteCount() > 0) say = n.sayAgain;
  /* and can tell the truth about something she may or may not have
     seen — "route" is either one route or a prefix matching either of
     a path's two */
  if (n.sayIfMet) say = hvHasWalked(n.sayIfMet.route) ? n.sayIfMet.yes : n.sayIfMet.no;
  if (n.sayOfKeepsake) say = n.sayOfKeepsake[hvKeepsake || "heart"] || say;
  if (n.callback && hvKeepsake) {
    say += hvKeepsake === "flower"
      ? " …you are still carrying that flower, by the way."
      : " …you are still holding that little heart, by the way.";
  }
  if (n.tally) {
    const found = hvFoundList();
    if (found) say += " " + found;
  }
  note.textContent = say;
  note.classList.toggle("hidden", !say);
  note.classList.toggle("hv-note-ask", !!n.isAsk);

  const tag = document.getElementById("hv-tagline");
  tag.textContent = n.tagline || "";
  tag.classList.toggle("hidden", !n.tagline);

  document.getElementById("hv-back").disabled = hvHistory.length === 0;

  const left = document.getElementById("hv-left");
  const right = document.getElementById("hv-right");
  const centre = document.getElementById("hv-centre");
  const cards = document.getElementById("hv-cards");
  [left, right, centre, cards].forEach((el) => { el.innerHTML = ""; });

  if (n.cards) {
    n.cards.forEach((cd) => {
      const b = document.createElement("button");
      b.className = "hv-card";
      const art = cd.art === "heart" ? drawHeartCard() : drawFlowerCard();
      art.className = "hv-card-art";
      b.appendChild(art);
      b.addEventListener("click", () => hvChoose(cd));
      cards.appendChild(b);
    });
  }

  (n.choices || []).forEach((ch) => {
    const b = document.createElement("button");
    b.className = "hv-btn" + (ch.style ? " hv-btn-" + ch.style : "");
    b.textContent = ch.label;
    b.addEventListener("click", () => hvChoose(ch));
    /* the smallest tick as a choice comes under the finger */
    b.addEventListener("pointerenter", () => hvSfx("hover"));
    b.addEventListener("focus", () => hvSfx("hover"));
    (ch.pos === "left" ? left : ch.pos === "right" ? right : centre).appendChild(b);
  });

  /* the butterfly page pairs each button with its butterfly, so put the
     buttons where the butterflies actually are */
  document.getElementById("screen-quest").classList.toggle("hv-pair", !!n.butterflies);

  if (n.isEnd) hvCompleted = true;
}

let hvCompleted = false;

/* One way to move. Both the buttons and the three mechanics come
   through here, so a stone crossed and a button pressed leave the game
   in exactly the same state — which is the only reason it is safe to
   offer both on the same screen. */
function hvGo(to) {
  if (to === "__ask") to = hvAskFrom;
  /* the gift screen is shared between the two paths, so the ending it
     hands on to is whichever one she is actually standing in */
  if (to === "__yay") to = (HV[hvAskFrom] && HV[hvAskFrom].ask === "back") ? "back_yay" : "yay";
  const target = HV[to];
  /* the one place the whole orchestra plays at once */
  if (target && target.isEnd && window.OST) window.OST.hit("yes");
  /* The bear is the one place you can be sent backwards, and it gets the
     low note rather than the bright one. It is still an ordinary move to
     an ordinary scene — there is no fail state left in this game. */
  hvSfx(target && target.nudged ? "bad" : (target && target.isEnd ? "yay" : "pick"));

  /* Reaching an ending is what finishes the chapter, not leaving the
     screen. It used to be marked done on the way out, which meant
     anyone who read the ending and then went round again had, as far as
     the hub was concerned, never finished it at all. */
  if (target && target.isEnd) { markChapterDone("quest"); hvSaveProgress(); }

  if (to === "__exit") {
    hvStopLoop();
    hvAmbience(null);
    if (window.OST) window.OST.stop();
    markChapterDone("quest");
    hvSaveProgress();
    pageTurn("hub", startHub);
    return;
  }

  /* Back to the fork, with everything she has found and everywhere she
     has been still hers. The ending used to offer one button and it
     said "close the book" — a strange thing to be told at the end of a
     chapter whose whole point is that there are four ways up this
     valley and she has just walked one of them. */
  if (to === "__again") {
    hvHistory = [];
    hvNode = "ways";
    hvRender(true);
    return;
  }

  hvHistory.push(hvNode);
  hvNode = to;
  hvRender(true);
}

function hvChoose(ch) {
  if (ch.keepsake) hvKeepsake = ch.keepsake;      // heart or flower, remembered
  hvGo(ch.to);
}

function hvBack() {
  if (!hvHistory.length) return;
  hvNode = hvHistory.pop();
  hvRender(true);
}

function startQuest() {
  /* The score is fetched like any other chapter file. It is normally
     already here — the idle prefetch sees to that — but if she is quick
     off the hub, the walk simply starts in silence and the music joins
     her at the scene she is standing in rather than waiting for her. */
  loadChapter("quest").then(function () {
    if (window.OST) { window.OST.setOn(hvSoundOn); hvScore(HV[hvNode]); }
  }).catch(function () {});

  hvNode = "title";
  hvHistory = [];
  hvBursts = [];
  hvPoke = 0;
  hvPlay = null;
  hvHold = false;
  hvLoadProgress();
  hvSoundOn = hvSoundPreferred();
  hvSetSound(hvSoundOn);
  hvUpdateFoundStrip();
  hvRender(false);
}

/* =========================================================
   PLAYING IT WITHOUT A MOUSE

   Every other chapter on this site can be played from the keyboard —
   the maze, the platformer, the apocalypse, the race — and this one
   could only ever be clicked. Arrow keys move between the choices on
   the screen, Enter takes one, Backspace is the back chip, Esc leaves,
   and space is the one button the three mechanics use.
   ========================================================= */
function hvChoiceButtons() {
  return Array.prototype.slice.call(
    document.querySelectorAll("#hv-left .hv-btn, #hv-centre .hv-btn, #hv-right .hv-btn, #hv-cards .hv-card"))
    .filter(function (b) { return !b.disabled; });
}

function hvMoveFocus(dir) {
  const bs = hvChoiceButtons();
  if (!bs.length) return;
  const at = bs.indexOf(document.activeElement);
  const next = at < 0 ? (dir > 0 ? 0 : bs.length - 1)
                      : (at + dir + bs.length) % bs.length;
  bs[next].focus();
}

document.addEventListener("keydown", (e) => {
  const scr = document.getElementById("screen-quest");
  if (!scr || !scr.classList.contains("active")) return;
  if (e.metaKey || e.ctrlKey || e.altKey) return;

  if (e.key === " " || e.key === "Spacebar") {
    if (hvPlay) {
      if (hvPlay.kind === "orchard") hvHoldOn(e);
      else { hvPlayPress((performance.now() - hvT0) / 1000); e.preventDefault(); }
      return;
    }
  }
  if (e.key === "ArrowRight" || e.key === "ArrowDown") { hvMoveFocus(1); e.preventDefault(); }
  else if (e.key === "ArrowLeft" || e.key === "ArrowUp") { hvMoveFocus(-1); e.preventDefault(); }
  else if (e.key === "Enter") {
    const bs = hvChoiceButtons();
    if (bs.length && bs.indexOf(document.activeElement) < 0) { bs[0].click(); e.preventDefault(); }
  } else if (e.key === "Backspace") {
    hvBack(); e.preventDefault();
  } else if (e.key === "Escape") {
    hvStopLoop(); hvAmbience(null);
    if (window.OST) window.OST.stop();
    pageTurn("hub", startHub); e.preventDefault();
  }
});

document.addEventListener("keyup", (e) => {
  if (e.key === " " || e.key === "Spacebar") hvHoldOff();
});

(function () {
  var c = document.getElementById("hv-canvas");
  if (!c) return;
  c.addEventListener("click", hvCanvasTap);
  c.addEventListener("pointerdown", hvHoldOn);
  c.addEventListener("pointerup", hvHoldOff);
  c.addEventListener("pointercancel", hvHoldOff);
  c.addEventListener("pointerleave", hvHoldOff);
  var s = document.getElementById("hv-sound");
  if (s) s.addEventListener("click", function () { hvSetSound(!hvSoundOn); });
})();
document.getElementById("hv-back").addEventListener("click", hvBack);
/* "back" is one step; this is all of them. Kept as its own chip rather
   than folded into back, because a back button that sometimes goes back
   one screen and sometimes throws away the whole walk is a trap. */
(function () {
  var r = document.getElementById("hv-restart");
  if (r) r.addEventListener("click", function () {
    hvHistory = [];
    hvNode = "title";
    hvSfx("page");
    hvRender(true);
  });
})();
document.getElementById("hv-quit").addEventListener("click", () => {
  hvStopLoop(); hvAmbience(null);
  if (window.OST) window.OST.stop();
  pageTurn("hub", startHub);
});
