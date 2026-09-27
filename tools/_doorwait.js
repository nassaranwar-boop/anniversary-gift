/* SOMETHING IS AT HER DOOR AND THE DOOR IS OPEN. What happens, and how
   long does it take? And the same with the door shut. */
const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox','--no-proxy-server','--use-gl=swiftshader','--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 520, height: 340 } });
  p.on('pageerror', (e) => console.log('PAGEERROR', e.message));
  await p.route('**/*', (r) => { const u = r.request().url();
    if (u.indexOf('book-scene.js') >= 0) return r.abort();
    return u.startsWith('http://127.0.0.1') ? r.continue() : r.abort(); });
  await p.goto('http://127.0.0.1:8899/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.evaluate(() => { localStorage.setItem('ns_seenintro','1'); localStorage.setItem('ns_terms','1');
    localStorage.setItem('ns_notutor','1'); showScreen('nightshift');
    return loadChapter('nightshift').then(() => OuissysNightShift.start()); });
  await p.waitForFunction(() => window.OuissysNightShift && OuissysNightShift.__night, { timeout: 20000, polling: 200 });
  for (const who of ['cogsworth', 'marabelle', 'jax', 'chime']) {
    for (const shut of [false, true]) {
      const out = await p.evaluate(([w, s]) => {
        const N = OuissysNightShift.__night, G = N.state(), C = N.cast();
        N.begin(3, 2); N.midEnd();
        Object.keys(C).forEach((k) => { C[k].awake = false; C[k].asleep = true; C[k].atDoor = false; });
        const c = C[w];
        c.asleep = false; c.awake = true; c.wound = 9;
        /* put it at the last step of its route, which is her door */
        /* one step short of her door, and let the game walk it in the
           way it walks everything in -- teleporting it to the mark
           skips the arrival, which is where the grace comes from */
        c.step = 0; N.syncOne(w);
        c.step = (N.cast()[w].def.route.length) - 2;
        N.syncOne(w); c.cool = 0; c.arrivals = 0;
        for (let i = 0; i < 4000 && !c.atDoor && G.phase === 'play'; i++) N.pumpFrame(0.05);
        G.doors.left = G.doors.right = G.doors.hatch = !!s;
        const t0 = G.t;
        let at = 0, dead = null, talk = null;
        for (let i = 0; i < 4000 && G.phase === 'play'; i++) {
          N.pumpFrame(0.05);
          if (c.atDoor) at += 0.05;
          const tk = N.talkState();
          if (tk.on) talk = tk.phase;
          if (!c.atDoor && at > 0) break;
        }
        return { who: w, shut: s, atDoorFor: +at.toFixed(1), phase: G.phase,
                 dead: G.dead, talk: talk, still: c.atDoor, talking: !!c.talking,
                 secs: +(G.t - t0).toFixed(1) };
      }, [who, shut]);
      console.log(JSON.stringify(out));
    }
  }
  await b.close();
})();
