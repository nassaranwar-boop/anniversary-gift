/* WHAT IS SHE ACTUALLY DOING IN THE FIRST HOUR?

   The early nights have had a lot of story put into them and that is
   exactly the condition under which a designer stops noticing that
   the loop underneath is thin. Story carries a scene; it does not
   carry an hour. So this measures the hour rather than arguing about
   it: what moves, what she can act on, and what it costs her if she
   does nothing at all.

   It drives a real night through the game's own step, one simulated
   second at a time, and counts the events a player would actually
   see -- something waking up, something arriving at a door, a line
   arriving, an objective changing, the meter moving.
                                                node tools/hourone.js */
const { chromium } = require('playwright-core');

(async () => {
  const b = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox', '--no-proxy-server', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 1100, height: 700 } });
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  await p.route('**/*', (r) => {
    const u = r.request().url();
    if (u.indexOf('book-scene.js') >= 0) return r.abort();
    return u.startsWith('http://127.0.0.1') ? r.continue() : r.abort();
  });
  await p.goto('http://127.0.0.1:8899/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.evaluate(() => { localStorage.setItem('ns_seenintro', '1'); showScreen('nightshift');
    return loadChapter('nightshift').then(() => OuissysNightShift.start()); });
  await p.waitForFunction(() => window.OuissysNightShift && OuissysNightShift.__night,
                          { timeout: 20000, polling: 200 });

  const nights = [1, 2, 3, 5];
  const out = {};
  for (const n of nights) {
    out[n] = await p.evaluate((night) => {
      const N = OuissysNightShift.__night;
      N.begin(night, 0);
      const hours = [];
      let prev = { task: null, power: 100, said: 0 };
      for (let h = 0; h < 6; h++) {
        const ev = { awake: 0, atDoor: 0, lines: 0, task: 0, drain: 0, moved: 0 };
        const p0 = N.state().power;
        const s0 = N.tape().said;
        const four = ['cogsworth', 'chime', 'marabelle', 'jax', 'post1', 'post2', 'post3'];
        const look = () => four.map((id) => N.cast()[id]).filter(Boolean);
        let wasAwake = look().filter((c) => c.awake).length;
        let wasAt = 0, steps = 0;
        /* one simulated hour, in sixtieths */
        const secs = 90;
        for (let t = 0; t < secs * 4; t++) {
          N.pump(0.25);
          steps++;
          const cs = look();
          const nowAwake = cs.filter((c) => c.awake).length;
          const nowAt = cs.filter((c) => c.atDoor).length;
          if (nowAwake > wasAwake) { ev.awake += nowAwake - wasAwake; }
          if (nowAt > wasAt) { ev.atDoor += nowAt - wasAt; }
          wasAwake = nowAwake; wasAt = nowAt;
          if (N.state().hour !== h) break;
        }
        const st = N.state();
        ev.lines = N.tape().said - s0;
        ev.drain = +(p0 - st.power).toFixed(1);
        const task = N.taskFor(night, h);
        ev.task = task !== prev.task ? 1 : 0;
        prev.task = task;
        ev.moved = look().filter((c) => c.awake).length;
        hours.push(ev);
        if (st.phase !== 'play') break;
      }
      return hours;
    }, n);
  }
  await b.close();

  const pad = (x, w) => String(x).padStart(w);
  console.log('\n  the hour-by-hour shape of a night, as the game actually steps it');
  console.log('  (awake = something got up, door = something arrived at one,');
  console.log('   lines = he or one of them said something, %  = meter spent)\n');
  for (const n of nights) {
    console.log('  NIGHT ' + n);
    console.log('      hour   awake   door   lines    %');
    out[n].forEach((e, h) => {
      console.log('      ' + pad(h === 0 ? '12am' : (h + 'am'), 4) +
                  pad(e.awake, 8) + pad(e.atDoor, 7) + pad(e.lines, 8) + pad(e.drain.toFixed(1), 7));
    });
    const t = out[n].reduce((a, e) => ({ awake: a.awake + e.awake, atDoor: a.atDoor + e.atDoor,
                                          lines: a.lines + e.lines }), { awake: 0, atDoor: 0, lines: 0 });
    console.log('      total ' + pad(t.awake, 7) + pad(t.atDoor, 7) + pad(t.lines, 8) + '\n');
  }
  const h1 = out[1][0];
  console.log('  FIRST HOUR OF NIGHT ONE: ' + h1.awake + ' woke, ' + h1.atDoor +
              ' reached a door, ' + h1.lines + ' spoken, ' + h1.drain.toFixed(1) + '% spent');
  if (errs.length) console.log('\n  page errors: ' + errs.slice(0, 2).join(' | '));
})();
