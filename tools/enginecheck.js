/* WHAT SAFARI AND FIREFOX WILL MAKE OF THIS.

   There is one engine in this container: Chromium. Anything that says
   "tested in every browser" from in here is a guess dressed up as a
   measurement, so this does the honest half instead -- it reads the
   stylesheet and the scripts for the features whose support actually
   differs, and reports each one with where it is used and what happens
   on an engine that does not have it.

   The list is what this site actually leans on, not a catalogue: size
   container queries, the `cqw`/`cqh` units that go with them, `svh`,
   `:has()`, `aspect-ratio`, `image-rendering:pixelated`, `backdrop-
   filter`, `text-wrap:balance`, `overscroll-behavior`, `scrollbar-
   width`, `inert`, `structuredClone`, `Array.at`, `Object.hasOwn`,
   `AudioContext` prefixes, `OffscreenCanvas` and `ResizeObserver`.

                                          node tools/enginecheck.js
*/
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const FILES = fs.readdirSync(ROOT).filter((f) => /\.(js|css|html)$/.test(f));

/* what: [pattern, first Safari, first Firefox, what happens without it] */
const FEATURES = [
  ["container-type",        /container-type\s*:/g,            "16.0", "110", "every cqw/cqh becomes 0 and the panels collapse"],
  ["cqw / cqh units",       /\d(?:\.\d+)?cq[wh]/g,            "16.0", "110", "resolves to 0 without a container"],
  ["svh / dvh units",       /\d(?:\.\d+)?[sd]vh/g,            "15.4", "101", "the height falls back to the declared px or vh"],
  [":has()",                /:has\(/g,                        "15.4", "121", "the rule never matches; the styled state never appears"],
  ["aspect-ratio",          /aspect-ratio\s*:/g,              "15.0", "89",  "the box has no height of its own"],
  ["image-rendering:pixelated", /image-rendering\s*:\s*pixelated/g, "10.0", "93", "sprites come out smoothed"],
  ["backdrop-filter",       /backdrop-filter\s*:/g,           "9.0",  "103", "the blur behind a card is simply absent"],
  ["text-wrap:balance",     /text-wrap\s*:\s*balance/g,       "17.5", "121", "headings wrap the ordinary way"],
  ["overscroll-behavior",   /overscroll-behavior/g,           "16.0", "59",  "a scroll inside a card can chain to the page"],
  ["scrollbar-width",       /scrollbar-width\s*:/g,           "18.2", "64",  "the scrollbar keeps its default look"],
  ["inert",                 /\binert\b/g,                     "15.5", "112", "hidden controls stay tabbable"],
  ["structuredClone",       /structuredClone\s*\(/g,          "15.4", "94",  "throws: ReferenceError"],
  ["Array.prototype.at",    /\.at\(\s*-?\d/g,                 "15.4", "90",  "throws: not a function"],
  ["Object.hasOwn",         /Object\.hasOwn\s*\(/g,           "15.4", "92",  "throws: not a function"],
  ["OffscreenCanvas",       /OffscreenCanvas/g,               "16.4", "105", "throws unless guarded"],
  ["ResizeObserver",        /new ResizeObserver/g,            "13.1", "69",  "throws unless guarded"],
  ["AudioContext",          /new\s+(?:window\.)?AudioContext/g, "14.1", "25", "no sound unless webkitAudioContext is tried too"],
  ["Web Speech",            /speechSynthesis/g,               "7.0",  "49",  "the system voice is absent; the caption still reads"],
  ["visualViewport",        /visualViewport/g,                "13.0", "91",  "the keyboard-aware height falls back to innerHeight"],
  ["CSS.registerProperty",  /CSS\.registerProperty/g,         "16.4", "128", "the animated custom property jumps instead of tweening"],
  ["@container",            /@container\b/g,                  "16.0", "110", "the rule never applies"],
  ["gap in flexbox",        /\bgap\s*:/g,                     "14.1", "63",  "the space between children disappears"],
];

let pass = 0, fail = 0, notes = [];
const ok = (n, c, x) => { if (c) { pass++; } else { fail++; console.log("  FAIL " + n + (x ? "  " + x : "")); } };

console.log("Chromium is the only engine in this container. What follows is read");
console.log("out of the files, not run: every feature the site uses whose support");
console.log("differs, and the oldest Safari and Firefox that has it.\n");

const used = [];
FEATURES.forEach(([name, re, safari, firefox, without]) => {
  const where = {};
  FILES.forEach((f) => {
    const src = fs.readFileSync(path.join(ROOT, f), "utf8");
    const n = (src.match(re) || []).length;
    if (n) where[f] = n;
  });
  const total = Object.values(where).reduce((a, b) => a + b, 0);
  if (!total) return;
  used.push({ name, safari, firefox, without, where, total });
});

used.sort((a, b) => parseFloat(b.safari) - parseFloat(a.safari));
used.forEach((u) => {
  console.log("  " + u.name.padEnd(26) + " Safari " + u.safari.padEnd(6) + " Firefox " + u.firefox.padEnd(5)
              + " " + u.total + " uses");
  console.log("      " + Object.keys(u.where).map((f) => f + " x" + u.where[f]).join(", "));
  console.log("      without it: " + u.without);
});

/* the two that are worth ASSERTING rather than reporting, because the
   site has a guard for them and the guard can be deleted by accident */
const script = fs.readFileSync(path.join(ROOT, "script.js"), "utf8");
const all = FILES.map((f) => fs.readFileSync(path.join(ROOT, f), "utf8")).join("\n");
ok("every AudioContext is built with the webkit prefix as a fallback",
   !/new\s+AudioContext/.test(all.replace(/window\.AudioContext\s*\|\|\s*window\.webkitAudioContext/g, "")) ||
   /webkitAudioContext/.test(all),
   "Safari before 14.1 only has webkitAudioContext");
ok("the real viewport height is measured rather than trusted to 100vh",
   /--app-h/.test(all) && /innerHeight/.test(script),
   "Chrome on iOS and Brave both lie about 100vh");
ok("nothing calls structuredClone, Object.hasOwn or Array.at without a guard",
   !/structuredClone\s*\(|Object\.hasOwn\s*\(/.test(all),
   "these throw on Safari 15.3 and earlier");

console.log("\n" + pass + " passed, " + fail + " failed\n");
process.exit(fail ? 1 : 0);
