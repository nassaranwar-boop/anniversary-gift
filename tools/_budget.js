/* HOW MANY SECONDS OF TALKING EACH NIGHT IS ASKED TO CARRY,
   AGAINST HOW MANY SECONDS OF NIGHT THERE ARE.

   A night is six hours of fifty-six seconds, and the last one is five
   -- it hands the sixth to the film. Every line takes its reading
   time, a tail, and a gap before the next. If the written script plus
   the things that answer her comes to more than the clock, the end of
   the night is written and never heard, and nothing anywhere says so. */
const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox','--no-proxy-server','--use-gl=swiftshader','--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 1000, height: 700 } });
  await p.route('**/*', r => { const u = r.request().url();
    if (u.indexOf('book-scene.js') >= 0) return r.abort();
    return u.startsWith('http://127.0.0.1') ? r.continue() : r.abort(); });
  await p.goto('http://127.0.0.1:8899/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForTimeout(600);
  await p.evaluate(() => { try{localStorage.clear();}catch(e){} showScreen('nightshift');
    return loadChapter('nightshift').then(() => OuissysNightShift.start()); });
  await p.waitForFunction(() => Object.keys(OuissysNightShift.__night.cast()).length >= 4, { timeout: 20000, polling: 200 });
  const r = await p.evaluate(() => {
    const w = OuissysNightShift.__night, NS = w.words();
    const dur = (t) => w.lineDur(t);
    const out = {};
    for (let n = 1; n <= 3; n++) {
      const sc = NS.tapes[n] || [];
      const rows = sc.map(x => ({ h: x.h, who: x.who || 'him', d: +dur(x.t).toFixed(1), t: x.t }));
      const tape = rows.reduce((a, x) => a + x.d + 1.05 + 2.5, 0);
      out[n] = { rows: rows, tape: +tape.toFixed(1), last: sc.length ? sc[sc.length-1].h : 0,
                 clock: (n >= 3 ? 5 : 6) * 56 };
    }
    /* and what the night also owes her */
    const extra = { afterChoice: {}, pointAt: 0, over: {} };
    for (const k in NS.afterChoice) extra.afterChoice[k] =
      +Math.max(dur(NS.afterChoice[k].kept.t), dur(NS.afterChoice[k].burned.t)).toFixed(1);
    for (const k in NS.pointAt) extra.pointAt += dur(NS.pointAt[k].t);
    for (let n = 1; n <= 3; n++) { const sc = NS.overheard[n];
      const list = !sc ? [] : (sc.length ? sc : [sc]);
      extra.over[n] = +list.reduce((a, s) => a + s.lines.reduce((b, l) => b + dur(l.t) + 1.05 + 2.5, 0), 0).toFixed(1); }
    return { out: out, extra: extra };
  });
  for (let n = 1; n <= 3; n++) {
    const o = r.out[n];
    console.log('\n=== NIGHT ' + n + ' ===  clock ' + o.clock + 's   his script ' + o.tape +
                's   last line at ' + o.last + ' (' + Math.round(o.last * 56) + 's)');
    o.rows.forEach(x => console.log('   ' + String(x.h).padEnd(5) + ' ' + String(Math.round(x.h*56)).padStart(3) +
      's  ' + String(x.d).padStart(5) + 's  ' + x.who.padEnd(10) + ' ' + x.t.slice(0, 62)));
    console.log('   overheard on top: ' + r.extra.over[n] + 's');
  }
  console.log('\nafterChoice speeches (seconds each): ' + JSON.stringify(r.extra.afterChoice));
  console.log('pointAt, all five: ' + Math.round(r.extra.pointAt) + 's');
  await b.close();
})();
