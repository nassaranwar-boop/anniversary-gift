/* THE FAULTS A BROWSER TEST CANNOT SEE.

   Every suite in here drives the site and looks at the result, so all
   of them are blind to a whole class of mistake: the one that does
   nothing visible today and everything visible the day somebody edits
   the line above it. A key declared twice, an id reached for that does
   not exist, a rule overwritten further down the stylesheet. Two of
   those shipped this month -- `NS.kept` twice, which printed
   "undefined" on the last card of the chapter, and `.ns-map` declared
   again in a portrait block that a landscape phone also matches, which
   put the plan of the shop on top of the RIGHT DOOR key.

   So this reads the files instead of running them.

                                            node tools/codecheck.js
*/
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const JS = ["script.js", "book-scene.js", "scrapbook.js", "racing.js",
            "apocalypse.js", "super-ouissy.js", "rescue.js", "ost.js", "night-shift.js"]
  .filter((f) => fs.existsSync(path.join(ROOT, f)));
const HTML = "index.html";
const CSS = "style.css";

let pass = 0, fail = 0;
const ok = (n, c, x) => { if (c) { pass++; console.log("  ok   " + n); }
  else { fail++; console.log("  FAIL " + n + (x !== undefined ? "\n         " + x : "")); } };
const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");

/* ---- pass one: blank comments and string bodies so the rest can
        trust what it reads ------------------------------------------ */
function blankJs(src) {
  const out = src.split("");
  const n = src.length;
  let i = 0;
  while (i < n) {
    const c = src[i];
    if (c === "/" && src[i + 1] === "/") { while (i < n && src[i] !== "\n") { out[i] = " "; i++; } continue; }
    if (c === "/" && src[i + 1] === "*") {
      const end = src.indexOf("*/", i + 2), stop = end < 0 ? n : end + 2;
      for (let k = i; k < stop; k++) if (src[k] !== "\n") out[k] = " ";
      i = stop; continue;
    }
    if (c === '"' || c === "'" || c === "`") {
      const q = c; let k = i + 1;
      while (k < n && src[k] !== q) { if (src[k] === "\\") k++; k++; }
      i = Math.min(k + 1, n); continue;      /* strings stay: ids live in them */
    }
    i++;
  }
  return out.join("");
}
function blankCss(src) {
  const out = src.split("");
  let i = 0;
  while (i < src.length) {
    if (src[i] === "/" && src[i + 1] === "*") {
      const end = src.indexOf("*/", i + 2), stop = end < 0 ? src.length : end + 2;
      for (let k = i; k < stop; k++) if (src[k] !== "\n") out[k] = " ";
      i = stop; continue;
    }
    i++;
  }
  return out.join("");
}

/* ---- 1. every id in the markup, once --------------------------------- */
const html = read(HTML);
const ids = {};
const dupIds = [];
let m, reId = /\sid="([^"]+)"/g;
while ((m = reId.exec(html))) {
  if (ids[m[1]]) dupIds.push(m[1]); else ids[m[1]] = true;
}
ok("every id in index.html is used once", !dupIds.length, dupIds.join(", "));

/* ---- 2. duplicate keys in an object literal -------------------------- */
function dupKeys(file) {
  const src = blankJs(read(file));
  const stack = [];
  const found = [];
  let line = 1, i = 0;
  while (i < src.length) {
    const c = src[i];
    if (c === "\n") { line++; i++; continue; }
    if (c === "{") { stack.push({ keys: {}, line: line }); i++; continue; }
    if (c === "}") { stack.pop(); i++; continue; }
    if (c === "(" || c === "[") { stack.push(null); i++; continue; }
    if (c === ")" || c === "]") { stack.pop(); i++; continue; }
    const k = /^([A-Za-z_$][\w$]*)\s*:/.exec(src.slice(i, i + 64));
    if (k) {
      const top = stack.length ? stack[stack.length - 1] : null;
      if (top && /[{,]\s*$/.test(src.slice(Math.max(0, i - 400), i))) {
        if (top.keys[k[1]] !== undefined) found.push(file + ":" + line + " '" + k[1] + "' (first at " + top.keys[k[1]] + ")");
        else top.keys[k[1]] = line;
      }
      i += k[0].length; continue;
    }
    i++;
  }
  return found;
}
const dups = [].concat.apply([], JS.map(dupKeys));
ok("no object literal declares the same key twice", !dups.length, dups.join("\n         "));

/* ---- 3. the same CSS rule, written twice, disagreeing ----------------

   Not every repeat is a fault, and the difference matters:

     - two declarations of a property INSIDE one rule is the fallback
       idiom (image-rendering: pixelated; image-rendering: crisp-edges)
       and is deliberate;
     - a shared list (.gate-unlock, .so-key { touch-action:manipulation })
       and a later rule for one of its members is layering, also
       deliberate;
     - the same rule head, under the same conditions, written out twice
       with different values, is somebody editing a copy. Only the later
       one exists. That is what this looks for, and it is how the plan
       of the shop ended up on top of the RIGHT DOOR key. */
const css = blankCss(read(CSS));
{
  const clashes = [];
  const rules = [];
  let at = [], i = 0, line = 1, buf = "";
  while (i < css.length) {
    const c = css[i];
    if (c === "\n") line++;
    if (c === "{") {
      const head = buf.trim(); buf = "";
      if (/^@/.test(head)) { at.push(head.replace(/\s+/g, " ")); i++; continue; }
      let depth = 1, j = i + 1;
      while (j < css.length && depth) { if (css[j] === "{") depth++; else if (css[j] === "}") depth--; j++; }
      rules.push({ head: head.replace(/\s+/g, " "), at: at.join(" && "),
                   body: css.slice(i + 1, j - 1), line: line });
      for (let k = i; k < j; k++) if (css[k] === "\n") line++;
      i = j; continue;
    }
    if (c === "}") { at.pop(); buf = ""; i++; continue; }
    buf += c; i++;
  }
  const byKey = {};
  rules.forEach((r) => { const key = r.at + " || " + r.head; (byKey[key] = byKey[key] || []).push(r); });
  Object.keys(byKey).forEach((key) => {
    const group = byKey[key];
    if (group.length < 2) return;
    const props = {};
    group.forEach((r) => {
      const seen = {};
      r.body.split(";").forEach((d) => {
        const p = d.split(":");
        if (p.length < 2) return;
        const name = p[0].trim(), val = p.slice(1).join(":").trim();
        if (!name || /^--/.test(name) || seen[name]) return;   /* a fallback chain is one value */
        seen[name] = 1;
        if (props[name] && props[name].val !== val && props[name].line !== r.line) {
          clashes.push(key.replace(" || ", "  ") + "\n           " + name + ": " + props[name].val
                       + "  (line " + props[name].line + ")\n           " + name + ": " + val
                       + "  (line " + r.line + ") wins");
        }
        props[name] = { val: val, line: r.line };
      });
    });
  });
  ok("no CSS rule is overwritten by a later copy of itself", !clashes.length,
     clashes.slice(0, 14).join("\n         "));
}

/* ---- 4. the ids the code reaches for --------------------------------- */
{
  const made = {};
  /* ids the code writes into the page itself */
  JS.forEach((f) => {
    const src = read(f);
    let mm, re = /\bid="([a-zA-Z0-9_-]+)"|\bid='([a-zA-Z0-9_-]+)'|\.id\s*=\s*["']([a-zA-Z0-9_-]+)["']/g;
    while ((mm = re.exec(src))) made[mm[1] || mm[2] || mm[3]] = f;
  });
  const missing = [];
  JS.forEach((f) => {
    const src = blankJs(read(f));
    let mm, re = /getElementById\(\s*["']([^"']+)["']\s*\)/g;
    while ((mm = re.exec(src))) {
      const id = mm[1];
      if (ids[id] || made[id]) continue;
      const line = src.slice(0, mm.index).split("\n").length;
      missing.push(f + ":" + line + "  #" + id);
    }
  });
  ok("nothing asks for an element id that is never made", !missing.length,
     missing.slice(0, 20).join("\n         "));
}

/* ---- 5. what ships ---------------------------------------------------- */
{
  /* console.warn and console.error on a failure path are the site
     telling you something went wrong, and they stay. A console.log is
     somebody's afternoon left in the file. index.html's own analytics
     block is his, not the site's, so it is named rather than failed. */
  const noisy = [];
  JS.forEach((f) => {
    const src = blankJs(read(f));
    const n = (src.match(/console\.(log|debug)\s*\(/g) || []).length;
    if (n) noisy.push(f + ": " + n);
  });
  const hisOwn = (blankJs(read(HTML)).match(/console\.(log|debug)\s*\(/g) || []).length;
  ok("nothing of the site's left logging to the console", !noisy.length, noisy.join(", "));
  console.log("  note  the visitor-alert block in index.html logs " + hisOwn
              + " times; that one is his, and it is how he watches it work");

  const marks = [];
  JS.concat([HTML, CSS]).forEach((f) => {
    const src = read(f);
    const n = (src.match(/\b(TODO|FIXME|XXX|HACK)\b/g) || []).length;
    if (n) marks.push(f + ": " + n);
  });
  ok("nothing left marked TODO or FIXME", !marks.length, marks.join(", "));
}

/* ---- 6. the handlers, and what they are bound to ---------------------- */
{
  /* every data-go the markup and the chapters can produce, against every
     one the routers answer */
  const goMade = {}, goTaken = {}, prefix = {};
  /* only a control counts: the racer hangs data-go on its countdown
     paragraph as a state for the stylesheet, and a <p> is not a button
     that nothing answers */
  [HTML].concat(JS).forEach((f) => {
    const src = read(f);
    let mm, re = /<(button|a)\b[^>]*data-go="([a-zA-Z0-9:_-]+)"/g;
    while ((mm = re.exec(src))) goMade[mm[2]] = f;
  });
  JS.forEach((f) => {
    const src = blankJs(read(f));
    let mm;
    /* the three ways a router in this site names a command: an if-chain
       on `cmd`, a call to route(), and the racer's own dataset switch */
    const re = /cmd === "([a-zA-Z0-9:_-]+)"|route\(\s*"([a-zA-Z0-9:_-]+)"|\.go === "([a-zA-Z0-9:_-]+)"/g;
    while ((mm = re.exec(src))) goTaken[mm[1] || mm[2] || mm[3]] = true;
    /* and a whole family answered by its prefix: cmd.indexOf("voice:") */
    const rp = /indexOf\(\s*"([a-zA-Z0-9_-]+:)"\s*\)\s*===\s*0|startsWith\(\s*"([a-zA-Z0-9_-]+:)"/g;
    while ((mm = rp.exec(src))) prefix[mm[1] || mm[2]] = true;
    /* the racer assigns the mode straight from the dataset */
    if (/mode\s*=\s*d\.go/.test(src)) {
      const rm = /\bMODES\s*=\s*\{/.exec(src);
      if (rm) {
        const tail = src.slice(rm.index, rm.index + 2000);
        let k, rk = /\n\s{2,4}([a-z][a-zA-Z0-9]*)\s*:/g;
        while ((k = rk.exec(tail))) goTaken[k[1]] = true;
      }
    }
  });
  const orphan = Object.keys(goMade).filter((g) =>
    !goTaken[g] && !Object.keys(prefix).some((p) => g.indexOf(p) === 0));
  ok("every button with a data-go has something that answers it", !orphan.length,
     orphan.join(", "));
}

console.log("\n" + pass + " passed, " + fail + " failed\n");
process.exit(fail ? 1 : 0);
