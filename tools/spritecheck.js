/* Every sprite in the chapter is a list of equal-length strings. One row a
   character too long or short and the whole map shears sideways, which is
   both invisible in a diff and obvious on screen. This walks the file and
   fails on any row that is not the frame width. Run it after touching any
   pixel map. */
const fs = require('fs');
const src = fs.readFileSync(__dirname + '/../apocalypse.js', 'utf8');
const W = 16;
let checked = 0, bad = [];
const block = /^\s{4}(down|up|side|stand|stepA|stepB):\s*\[(.*?)\]/gm;
let m;
while ((m = block.exec(src))) {
  const rows = [...m[2].matchAll(/"([^"]*)"/g)].map(x => x[1]);
  rows.forEach((r, i) => { checked++; if (r.length !== W) bad.push(`${m[1]} row ${i}: ${r.length} wide — ${r}`); });
}
const flat = /var (ANW_SLEEP|HORSE) = \[(.*?)\];/gs;
while ((m = flat.exec(src))) {
  const rows = [...m[2].matchAll(/"([^"]*)"/g)].map(x => x[1]);
  rows.forEach((r, i) => { checked++; if (r.length !== W) bad.push(`${m[1]} row ${i}: ${r.length} wide — ${r}`); });
}
console.log(`${checked} sprite rows checked at ${W} wide`);
if (bad.length) { bad.forEach(b => console.log('  FAIL ' + b)); process.exit(1); }
console.log('all rows are the right width');
