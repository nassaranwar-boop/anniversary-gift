/* Look for conditions that can never be true and constants nothing reads.
   The hash returning nothing above 0.5 hid a hundred lines of scenery for
   weeks; this is a cheap sweep for the same shape of mistake. */
const fs = require('fs');
const src = fs.readFileSync(__dirname + '/../apocalypse.js', 'utf8');
const lines = src.split('\n');
let found = 0;
const say = (why, i, t) => { found++; console.log('  ' + why + '  ' + (i + 1) + ': ' + t.trim().slice(0, 96)); };

/* 1. declared and never read again */
const decl = /^\s*var ([A-Za-z_$][\w$]*)\s*=/;
const seen = {};
lines.forEach((l, i) => { const m = l.match(decl); if (m && !seen[m[1]]) seen[m[1]] = i; });
console.log('--- declared once and never used again ---');
Object.keys(seen).forEach(name => {
  if (name.length < 3) return;
  const uses = src.split(new RegExp('\\b' + name.replace(/\$/g, '\\$') + '\\b')).length - 1;
  if (uses <= 1) say('unused', seen[name], lines[seen[name]]);
});

/* 2. a function defined and never called */
console.log('--- functions never called ---');
const fn = /^\s*function ([A-Za-z_$][\w$]*)\s*\(/;
lines.forEach((l, i) => {
  const m = l.match(fn);
  if (!m) return;
  const uses = src.split(new RegExp('\\b' + m[1] + '\\b')).length - 1;
  if (uses <= 1) say('never called', i, l);
});

/* 3. comparisons against a literal that cannot happen */
console.log('--- comparisons that look impossible ---');
lines.forEach((l, i) => {
  let m;
  const re = /([A-Za-z_$][\w$.]*)\s*([<>]=?)\s*(-?\d*\.?\d+)/g;
  while ((m = re.exec(l))) {
    const v = parseFloat(m[3]);
    /* anything compared > 1 that is a hash or a normalised 0..1 value */
    if (/hash|seed|rnd|Math\.random/.test(m[1]) && ((m[2][0] === '>' && v >= 1) || (m[2][0] === '<' && v <= 0))) {
      say('never true', i, l);
    }
  }
});
console.log(found ? '\n' + found + ' to look at' : '\nnothing obvious');
