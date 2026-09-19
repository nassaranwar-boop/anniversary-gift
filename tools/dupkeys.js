/* duplicate object-literal keys read as "undefined" on screen: the later
   one silently wins.  one of these cost the last card of the chapter its
   line, so the check lives here now.

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
console.log(bad ? "FAIL " + bad + " duplicate key(s)" : "ok — no duplicate object keys");
process.exit(bad ? 1 : 0);
