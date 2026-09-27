/* TWO THINGS WITH THE SAME NAME, AND THE LATER ONE SILENTLY WINS.

   duplicate object-literal keys read as "undefined" on screen. one of
   these cost the last card of the chapter its line, so the check lives
   here now.

   AND DUPLICATE FUNCTION DECLARATIONS, which are worse, because they
   hoist: a second `function pixHeart` written a thousand lines below
   the first takes over every call to it, including the ones written
   against the older signature. That one handed the HUD's super meter a
   fraction where it expected a colour string -- a number is not a
   valid fillStyle, canvas keeps whatever was last set, and five hearts
   painted as one pale slab on the grass for every frame of every
   match. An empty bar looks like a bar; a broken one looked like a
   design. Nothing in this repo could see it, so now something can.

   pass one blanks comments and string bodies so pass two can trust what
   it sees; pass two walks the braces and remembers a key per object. */
const fs = require("fs");

function blank(src) {
  const out = src.split("");
  const n = src.length;
  let i = 0;
  while (i < n) {
    const c = src[i];
    if (c === "/" && src[i + 1] === "/") { while (i < n && src[i] !== "\n") { out[i] = " "; i++; } continue; }
    if (c === "/" && src[i + 1] === "*") {
      const end = src.indexOf("*/", i + 2);
      const stop = end < 0 ? n : end + 2;
      for (let k = i; k < stop; k++) if (src[k] !== "\n") out[k] = " ";
      i = stop; continue;
    }
    if (c === '"' || c === "'" || c === "`") {
      const q = c; let k = i + 1;
      while (k < n && src[k] !== q) { if (src[k] === "\\") k++; k++; }
      for (let j = i + 1; j < k && j < n; j++) if (src[j] !== "\n") out[j] = " ";
      i = Math.min(k + 1, n); continue;
    }
    i++;
  }
  return out.join("");
}

let bad = 0;
for (const f of process.argv.slice(2)) {
  const src = blank(fs.readFileSync(f, "utf8"));

  /* FUNCTION DECLARATIONS, PER SCOPE.

     Keyed on the identity of the enclosing block, NOT on its depth. The
     first version counted braces and keyed on the number, which reads
     two `function draw` declarations inside two SIBLING functions as a
     collision -- they are at the same depth and are not in the same
     scope, and it reported eight of those in the apocalypse before it
     found anything real. Each { gets its own id, and only two
     declarations sharing an id are the bug this is looking for. */
  {
    const seen = new Map();
    let nextId = 1;
    const scope = [0];
    let line2 = 1;
    for (let i = 0; i < src.length; i++) {
      const c = src[i];
      if (c === "\n") { line2++; continue; }
      if (c === "{") { scope.push(nextId++); continue; }
      if (c === "}") { if (scope.length > 1) scope.pop(); continue; }
      if (c !== "f" || !/^function\s+[A-Za-z_$][\w$]*\s*\(/.test(src.slice(i, i + 80))) continue;
      if (i > 0 && /[\w$.]/.test(src[i - 1])) continue;          // not `x.function`
      const name = /^function\s+([A-Za-z_$][\w$]*)/.exec(src.slice(i, i + 80))[1];
      const key = scope[scope.length - 1] + ":" + name;
      if (seen.has(key)) {
        console.log(f + ":" + line2 + "  duplicate function '" + name +
                    "' (first at line " + seen.get(key) + ") — the later one wins for every caller");
        bad++;
      } else seen.set(key, line2);
      i += 8;
    }
  }

  const stack = [];
  let line = 1, i = 0;
  const n = src.length;
  while (i < n) {
    const c = src[i];
    if (c === "\n") { line++; i++; continue; }
    if (c === "{") { stack.push({ keys: {}, line: line }); i++; continue; }
    if (c === "}") { stack.pop(); i++; continue; }
    if (c === "(" || c === "[") { stack.push(null); i++; continue; }
    if (c === ")" || c === "]") { stack.pop(); i++; continue; }
    const m = /^([A-Za-z_$][\w$]*)\s*:/.exec(src.slice(i, i + 64));
    if (m) {
      const prev = src.slice(Math.max(0, i - 400), i);
      const top = stack.length ? stack[stack.length - 1] : null;
      /* a key only counts when { or , is the last thing before it -- that
         skips labels, ternaries and object keys already consumed */
      if (top && /[{,]\s*$/.test(prev)) {
        if (top.keys[m[1]] !== undefined) {
          console.log(f + ":" + line + "  duplicate key '" + m[1] + "' (first at line " + top.keys[m[1]] + ", object opened line " + top.line + ")");
          bad++;
        } else top.keys[m[1]] = line;
      }
      i += m[0].length; continue;
    }
    i++;
  }
}
console.log(bad ? "FAIL " + bad + " duplicate name(s)" : "ok — no duplicate object keys or function declarations");
process.exit(bad ? 1 : 0);
