/* WHY ONLY TWO OF THE FOUR LINES GOT OUT ON NIGHT TWO.

   overcheck drives a whole night inside one synchronous evaluate, so
   no timer ever fires during it -- which means a deferred voxSpeak can
   never come back and voxAligned is never called. Anything that waits
   on that has to be released by its own dead man's handle instead.
   This prints what overTick says is blocking it, and what the tape
   thinks its state is, every game-second. */
const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox','--no-proxy-server','--use-gl=swiftshader','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required'] });
  const p = await b.newPage({ viewport: { width: 900, height: 600 } });
  p.on('pageerror', e => console.log('PAGEERROR', e.message));
  await p.route('**/*', r => r.request().url().startsWith('http://127.0.0.1') ? r.continue() : r.abort());
  await p.goto('http://127.0.0.1:8899/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.evaluate(() => { try { localStorage.clear(); localStorage.setItem('ns_notutor','1'); } catch(e){}
    showScreen('nightshift'); return loadChapter('nightshift').then(() => OuissysNightShift.start()); });
  await p.waitForFunction(() => { try { return !!OuissysNightShift.__night.cast().jax; } catch(e){ return false; } },
                          null, { timeout: 180000, polling: 500 });
  /* warm, the way overcheck now warms: a player at two in the morning
     has the chapter in memory and no line is deferred or held */
  await p.waitForFunction(() => { try { return OuissysNightShift.__night.voiceState().ready.length > 3; }
                                  catch(e){ return false; } },
                          null, { timeout: 180000, polling: 500 });
  const out = await p.evaluate(() => {
    const N = OuissysNightShift.__night, G = N.state(), cast = N.cast();
    N.begin(2);
    const sc = N.overScript()[2];
    const rows = [], DT = 1/30;
    let said = 0, lastWhy = '', lastI = -1;
    for (let k = 0; k < 60*30*8; k++) {
      Object.keys(cast).forEach(id => { cast[id].step = 0; cast[id].cool = 999;
        if (!cast[id].talking) cast[id].atDoor = false; });
      G.doors.left = G.doors.right = G.doors.hatch = true;
      G.power = Math.max(G.power, 40);
      if (G.phase !== 'play') { rows.push('ENDED at ' + (k*DT).toFixed(1) + 's, phase ' + G.phase); break; }
      G.monitor = false;
      N.pumpFrame(DT);
      const st = N.overState(), d = N.tapeDebug();
      if (st.why !== lastWhy || st.i !== lastI) {
        lastWhy = st.why; lastI = st.i;
        rows.push((k*DT).toFixed(1) + 's hour ' + G.hour + ' | over.i=' + st.i + ' on=' + st.on +
                  ' why="' + st.why + '" | tape up=' + d.up + ' held=' + d.held +
                  ' speakT=' + d.speakT + ' shown=' + d.shown + ' vox=' + d.vox);
      }
      if (rows.length > 120) break;
    }
    return { rows, lines: sc.lines.length, voxfile: N.voiceState ? N.voiceState().on : null };
  });
  console.log('  night 2 has ' + out.lines + ' lines; VOX_FILE.on = ' + out.voxfile + '\n');
  out.rows.forEach(r => console.log('  ' + r));
  await b.close();
})();
