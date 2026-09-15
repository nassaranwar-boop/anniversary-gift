/* A NIGHT, WRITTEN DOWN, IN THE ORDER SHE HEARS IT.

   Every other check in here asks whether a thing happens. None of them
   can tell you whether the six hours make SENSE -- whether a line
   answers something she did, whether two of them contradict each other,
   whether the shop tells her about a fault before it happens or an hour
   after it stopped mattering. That is not a thing a boolean can hold.
   It is a thing somebody has to read.

   So this plays a night the way an attentive guard plays it -- monitor
   up, sweeping the cameras, shutting the door on whatever is at it,
   winding whatever has run down -- and prints every word the shop says,
   in order, with the clock, who said it, and what was happening when it
   landed. Nothing is asserted. It is a script to be read.

     node tools/transcript.js [night] [runs]

   The player is deliberately competent, because the version of this
   chapter that goes wrong is the one a GOOD player gets: shut doors
   mean nobody ever has to save her, a tidy camera routine means she
   walks past the things worth finding, and the story quietly empties
   out. If it reads right for somebody playing well, it reads right. */
const { chromium } = require('playwright-core');
const NIGHT = Number(process.argv[2] || 1);
const RUNS = Number(process.argv[3] || 1);

(async () => {
  const b = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox', '--no-proxy-server', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 1000, height: 640 } });
  p.on('pageerror', (e) => console.log('PAGEERROR', e.message));
  await p.route('**/*', (r) => {
    const u = r.request().url();
    if (u.indexOf('book-scene.js') >= 0) return r.abort();
    return u.startsWith('http://127.0.0.1') ? r.continue() : r.abort(); });
  await p.goto('http://127.0.0.1:8899/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.evaluate(() => {
    localStorage.setItem('ns_seenintro', '1');
    localStorage.setItem('ns_notutor', '1');
    showScreen('nightshift');
    return loadChapter('nightshift').then(() => OuissysNightShift.start()); });
  await p.waitForFunction(() => {
    try { const c = window.OuissysNightShift && OuissysNightShift.__night
                    && OuissysNightShift.__night.cast();
          return !!(c && c.cogsworth && c.jax); } catch (e) { return false; }
  }, { timeout: 30000, polling: 200 });

  for (let run = 0; run < RUNS; run++) {
    const out = await p.evaluate(([n, seed]) => {
      const N = OuissysNightShift.__night, G = N.state(), cast = N.cast();
      N.begin(n);
      const CAMS = N.roomDefs().filter((r) => r.cam > 0).map((r) => r.id);
      const said = [];
      let lastSys = '', lastTape = '', sweep = 0, camAt = 0;
      const DT = 1 / 30;
      const fmt = (h, t) => `${String((h + 12) % 12 || 12).padStart(2, ' ')}:${String(Math.floor((t / 56) * 60)).padStart(2, '0')}`;
      for (let k = 0; k < 60 * 30 * 8; k++) {
        /* --- how a careful person plays it --------------------------- */
        /* shut the door on anything standing at one, open it again the
           moment it has gone: holding both all night is the thing the
           meter exists to punish */
        for (const side of ['left', 'right', 'hatch']) {
          let there = false;
          for (const id in cast) {
            const c = cast[id];
            if (c.awake && c.atDoor && !c.talking && c.def.door === side) there = true;
          }
          if (G.doors[side] !== there) G.doors[side] = there;
        }
        /* and sweep the cameras, a couple of seconds on each */
        sweep += DT;
        if (sweep > 2.2) { sweep = 0; camAt = (camAt + 1) % CAMS.length;
                           G.monitor = true; G.cam = CAMS[camAt]; }
        N.pumpFrame(DT);
        /* the reveal card and the like are part of the night, not the end
           of it: note them and carry on rather than stopping the script */
        if (G.phase !== 'play') {
          if (G.phase === 'over' || G.phase === 'won' || G.phase === 'finale') {
            said.push({ at: fmt(G.hour, G.hourT), who: '', t: `[ ${G.phase.toUpperCase()} ]` }); break;
          }
          if (lastSys !== '[' + G.phase) {
            said.push({ at: fmt(G.hour, G.hourT), who: '', t: `[ ${G.phase.toUpperCase()} ]` });
            lastSys = '[' + G.phase;
          }
          G.phase = 'play';
        }

        /* --- what it said -------------------------------------------- */
        if (G.caption && G.caption !== lastSys) {
          said.push({ at: fmt(G.hour, G.hourT), who: 'SHOP', t: G.caption,
                      ctx: (G.monitor ? 'cam ' + G.cam : 'desk') +
                           (G.doors.left || G.doors.right || G.doors.hatch ? ', doors shut' : '') });
          lastSys = G.caption;
        }
        const d = N.tapeDebug();
        if (d.line && d.line !== lastTape) {
          const el = document.getElementById('ns-tape');
          const chip = el && el.querySelector('.ns-tape-who');
          said.push({ at: fmt(G.hour, G.hourT),
                      who: (d.who || 'anwar').toUpperCase(),
                      chip: chip ? chip.textContent : null,
                      t: d.line, through: d.through,
                      ctx: (G.monitor ? 'cam ' + G.cam : 'desk') });
          lastTape = d.line;
        }
        if (G.hour >= 6) { said.push({ at: '06:00', who: '', t: '[ SIX O\'CLOCK ]' }); break; }
      }
      return { said, stats: G.stats, hour: G.hour, power: +G.power.toFixed(0) };
    }, [NIGHT, run]);

    console.log(`\n================ NIGHT ${NIGHT}${RUNS > 1 ? '  run ' + (run + 1) : ''} ` +
                `— reached ${out.hour}:00 on ${out.power}% ================`);
    out.said.forEach((l) => {
      if (!l.who) { console.log(`\n${l.t}`); return; }
      const tag = l.who === 'SHOP' ? ''
        : `  <<${l.who}${l.through ? ', through the wall' : ''}` +
          (l.chip && l.chip !== l.who ? ` — caption says "${l.chip}"` : '') +
          (!l.chip && l.who !== 'ANWAR' ? ' — NO NAME ON THE CAPTION' : '') + '>>';
      console.log(`${l.at}  ${l.who === 'SHOP' ? '[system]' : '         '} ${l.t}${tag}` +
                  (l.ctx ? `\n         (${l.ctx})` : ''));
    });
  }
  await b.close();
})();
