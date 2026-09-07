/* A structural audit of The Long Way Round's story graph, run against the
   live game rather than by parsing source — labels are sometimes
   identifiers rather than literals, and a regex over the file misses
   those and then reports nodes as unreachable that plainly are not. */
const { chromium } = require('playwright-core');
const R=[]; const ok=(n,c,x)=>R.push((c?'PASS  ':'FAIL  ')+n+(x?'   '+x:''));
(async () => {
  const browser = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args:['--no-sandbox','--no-proxy-server','--disable-gpu'] });
  const page = await browser.newPage({ viewport:{width:1180,height:900} });
  const errs=[]; page.on('pageerror', e=>errs.push(e.message));
  await page.route('**/*', r => { const u=r.request().url();
    if (u.startsWith('http://127.0.0.1')||u.includes('fonts.g')) return r.continue(); return r.abort(); });
  await page.goto('http://127.0.0.1:8899/index.html', { waitUntil:'networkidle', timeout:60000 });
  await page.waitForTimeout(900);

  const g = await page.evaluate(() => {
    const out = {};
    for (const k in HV) {
      const n = HV[k];
      /* Cards are exits too. Leaving them out meant the walk from the
         title stopped dead at `pick` — whose only exits are two cards —
         and this suite then reported all forty-odd nodes after it as
         unreachable, on every run, on main. A reachability check that
         is always red is not a check.

         `__ask` is a sentinel like `__exit`: the shared nudge screens
         send her back to whichever closing question she is in, so it
         resolves to both real ones rather than being excused. */
      /* `outcomes` is how a mechanic screen leaves: it has no buttons,
         so without this the stones, the bridge and the bear all read as
         dead ends. */
      const outs = (n.choices || []).concat(n.cards || [])
        .concat((n.outcomes || []).map(t => ({ to: t })));
      const SENTINEL = { __ask: ['ask', 'back_ask'], __again: ['ways'], __yay: ['yay', 'back_yay'] };
      out[k] = {
        to: outs.map(c => c.to)
          .reduce((a, t) => a.concat(SENTINEL[t] || [t]), []),
        keep: outs.map(c => c.keepsake || null),
        scene: n.scene || null, fail: !!n.isFail, end: !!n.isEnd, back: n.back || null,
      };
    }
    return out;
  });

  const fake = Object.entries(g).filter(([k, d]) =>
    d.to.length > 1 && new Set(d.to).size === 1 && new Set(d.keep).size === 1);
  ok('no choice is an illusion', fake.length === 0,
     fake.map(([k]) => k).join(', ') || Object.keys(g).length + ' nodes checked');

  const dead = [];
  Object.entries(g).forEach(([k, d]) => {
    d.to.forEach(t => { if (t !== '__exit' && !g[t]) dead.push(k + '->' + t); });
    if (d.back && !g[d.back]) dead.push(k + ' back->' + d.back);
  });
  ok('every link goes somewhere', dead.length === 0, dead.join(', '));

  const seen = new Set(); const stack = ['title'];
  while (stack.length) { const n = stack.pop();
    if (seen.has(n) || !g[n]) continue; seen.add(n); g[n].to.forEach(t => stack.push(t)); }
  const orphan = Object.keys(g).filter(k => !seen.has(k) && !g[k].fail);
  ok('every node can be reached', orphan.length === 0, orphan.join(', '));

  // the four journeys must be four different journeys
  const walk = (start) => {
    const seq = []; let n = start; let guard = 0;
    while (n && g[n] && !g[n].fail && guard++ < 12) {
      seq.push(g[n].scene + ':' + n);
      if (n.endsWith('_join')) break;
      const nxt = g[n].to.filter(t => g[t] && !g[t].fail);
      if (!nxt.length) break;
      n = nxt[0];
    }
    return seq;
  };
  const routes = {
    'there/blue': walk(g.there.to[0]), 'there/red': walk(g.there.to[1]),
    'back/blue':  walk(g.back.to[0]),  'back/red':  walk(g.back.to[1]),
  };
  const sigs = Object.values(routes).map(r => r.join('>'));
  ok('all four journeys are different', new Set(sigs).size === 4,
     Object.entries(routes).map(([k,v]) => k + '=' + v.length).join(' '));

  // ...and the two on a path end together
  ok('the two butterflies on the left end in the same place',
     routes['there/blue'].slice(-1)[0] === routes['there/red'].slice(-1)[0],
     routes['there/blue'].slice(-1)[0] + ' / ' + routes['there/red'].slice(-1)[0]);
  ok('and so do the two on the right',
     routes['back/blue'].slice(-1)[0] === routes['back/red'].slice(-1)[0],
     routes['back/blue'].slice(-1)[0] + ' / ' + routes['back/red'].slice(-1)[0]);

  // neither butterfly may be a trap
  const traps = [];
  ['there','back'].forEach(p => g[p].to.forEach(t => { if (g[t] && g[t].fail) traps.push(p+'->'+t); }));
  ok('neither butterfly is a decoy', traps.length === 0, traps.join(', '));

  // the left and right paths must not share a scene at any step
  const L = new Set(routes['there/blue'].concat(routes['there/red']).map(x => x.split(':')[0]));
  const Rr = new Set(routes['back/blue'].concat(routes['back/red']).map(x => x.split(':')[0]));
  const shared = [...L].filter(x => Rr.has(x));
  ok('the two paths share no scenery', shared.length === 0,
     'left=' + [...L].join(',') + '  right=' + [...Rr].join(','));

  console.log(R.join('\n'));
  Object.entries(routes).forEach(([k,v]) => console.log('     ' + k.padEnd(11) + v.join(' -> ')));
  console.log(errs.length ? 'ERRORS: '+errs.join(' | ') : 'no page errors');
  await browser.close();
  process.exit(R.some(r=>r.startsWith('FAIL')) ? 1 : 0);
})();
