/* THE LAST HOUR, AS A SCREENPLAY WITH ITS STAGING ATTACHED.

   Reading the shot list in the source means reading eighty-nine object
   literals. This prints it the way it plays: room, lens, who is in the
   room at that moment, what is on fire, what has just been taken away,
   and the line. It is the only way to answer "does the scene match the
   sentence" without watching all six minutes.
                                            node tools/screenplay.js   */
const fs = require('fs');
const WAY = { chime: 'up', marabelle: 'taken', cogsworth: 'cross' };
const src = fs.readFileSync(__dirname + '/../night-shift.js', 'utf8');
function lift(name) {
  const i = src.indexOf('const ' + name + ' = ');
  const eq = src.indexOf('=', i);
  let open = eq + 1;
  while (' \n\r\t'.indexOf(src[open]) >= 0) open++;
  let d = 0, j = open;
  for (; j < src.length; j++) {
    const c = src[j];
    if (c === '{' || c === '[') d++;
    else if (c === '}' || c === ']') { d--; if (!d) break; }
  }
  return eval('(' + src.slice(open, j + 1) + ')');
}
const NS = lift('NS');
const S = NS.lastHour.shots;
const NAME = { ouissy: 'OUISSY', ret: 'THE ONES HE SOLD', boss: 'THE FIRST ONE',
               cogsworth: 'COGSWORTH', chime: 'CHIME', marabelle: 'MARABELLE', jax: 'JAX' };
const clean = (t) => String(t).replace(/&mdash;/g,'—').replace(/&[lr]dquo;/g,'"').replace(/&amp;/g,'&');
const wrap = (t, w, pad) => {
  const out = []; let line = '';
  clean(t).split(' ').forEach((x) => {
    if ((line + ' ' + x).trim().length > w) { out.push(line.trim()); line = x; }
    else line += ' ' + x;
  });
  if (line.trim()) out.push(line.trim());
  return out.map((l) => pad + l).join('\n');
};

let room = null, inRoom = {}, swarm = null, boss = false, oui = false;
let fires = 0, t = 0; const fireRoom = {};
const dist = (a, b) => Math.hypot(a[0]-b[0], a[1]-b[1], a[2]-b[2]);
let prevTo = null, prevRoom = null;

S.forEach((s, i) => {
  if (s.put) Object.keys(s.put).forEach((k) => inRoom[k] = 1);
  if (s.gone) delete inRoom[s.gone];
  if (s.clear) swarm = null;
  if (s.swarm) swarm = s.swarm[1];
  if (s.boss) boss = s.boss[0] || s.room;
  if (s.bossGone) boss = false;
  if (s.fire) fireRoom[s.room] = (fireRoom[s.room] || 0) + s.fire.length;
  if (s.douse) { for (const k in fireRoom) delete fireRoom[k]; }
  if (s.oui) oui = true;
  if (s.ouiGone) oui = false;


  if (s.room !== room) {
    console.log('\n' + '─'.repeat(72));
    console.log('  ' + s.room.toUpperCase() + '   ' + fmtT(t));
    console.log('─'.repeat(72));
    room = s.room;
  }
  /* a cut that barely moves reads as a glitch rather than as a cut */
  let note = '';
  if (prevRoom === s.room && prevTo) {
    const d = dist(prevTo, s.from);
    if (d > 0.001 && d < 0.18) note = '  ⚠ jump cut (' + d.toFixed(2) + 'm)';
  }
  const here = Object.keys(inRoom).filter((k) => inRoom[k]);
  const bits = [];
  if (here.length) bits.push(here.join(' '));
  if (swarm) bits.push(swarm + ' of them');
  if (boss === s.room) bits.push('THE FIRST ONE');
  if (oui) bits.push('her');
  if (fireRoom[s.room]) bits.push(fireRoom[s.room] + ' alight here');

  console.log('\n  ' + String(i).padStart(2) + '. ' + s.secs.toFixed(1) + 's  ' +
              (s.fov ? s.fov + 'mm' : (s.fov0||'') + '→' + (s.fov1||'')) +
              (s.lux !== undefined ? '  lux ' + s.lux : '') + note);
  if (bits.length) console.log('      [' + bits.join(' · ') + ']');
  if (s.wreck) console.log('      [' + s.wreck[1] + ' things go over]');
  if (s.flash || s.boom) console.log('      [THE BLAST]');
  /* and one of them leaving, which is a thing the camera watches
     happen rather than a state change between two shots */
  if (s.gone) {
    const way = { up: 'is taken up through the grate',
                  taken: 'dances, and then the doorway has her',
                  cross: 'walks the length of the room, and stops' };
    const m = s.goneAs === 'cut' ? '' : (s.goneAs || WAY[s.gone] || '');
    console.log('      [' + s.gone.toUpperCase() + ' GOES' +
                (m ? ' \u2014 ' + way[m] : ' in the blast') + ']');
  }
  const l = s.line;
  if (l) {
    if (l.who) {
      console.log('            ' + (NAME[l.who] || l.who) + (l.off ? ' (off)' : '') +
                  (l.many ? ' (many)' : ''));
      console.log(wrap(l.pick ? '(a) ' + l.a : l.t, 54, '            '));
      if (l.pick) console.log(wrap('(b) ' + l.b, 54, '            '));
    } else if (l.sys) console.log(wrap(l.t, 60, '      ') + '   [the building]');
    else console.log(wrap(l.t, 62, '      '));
  } else if (!s.bare) console.log('      (no line)');
  t += s.secs;
  prevTo = s.to; prevRoom = s.room;
});
function fmtT(x){ const r=Math.round(x); return Math.floor(r/60)+':'+String(r%60).padStart(2,'0'); }
console.log('\n' + '─'.repeat(72));
console.log('  ' + S.length + ' shots   ' + fmtT(t) + '   ' +
            S.filter((x)=>x.line).length + ' with a line');
