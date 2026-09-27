/* Do the sound effects make any sound at all? Nothing else: no night,
   no pause, no script. Load, touch the page, strike a door, listen. */
const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox','--no-proxy-server','--use-gl=swiftshader','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required'] });
  const p = await b.newPage({ viewport: { width: 900, height: 600 } });
  p.on('pageerror', e => console.log('  PAGEERROR', e.message));
  await p.route('**/*', r => r.request().url().startsWith('http://127.0.0.1') ? r.continue() : r.abort());
  await p.goto('http://127.0.0.1:8899/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.evaluate(() => { try { localStorage.clear(); localStorage.setItem('ns_notutor','1'); } catch(e){}
    showScreen('nightshift'); return loadChapter('nightshift').then(() => OuissysNightShift.start()); });
  await p.waitForFunction(() => { try { return !!OuissysNightShift.__night.cast().jax; } catch(e){ return false; } },
                          null, { timeout: 180000, polling: 500 });
  await p.mouse.click(450, 300);
  await p.waitForTimeout(800);
  const out = await p.evaluate(async () => {
    const N = OuissysNightShift.__night;
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const rows = [];
    const a0 = N.audio();
    rows.push('audio: ctx ' + a0.ctx + ', muted ' + a0.muted + ', cue ' + a0.cue +
              ', side ' + a0.side + ', duck ' + a0.duck + ', master ' + a0.master);
    rows.push('buses: voxOut ' + a0.vox + ', sfxOut ' + a0.sfx);
    /* in the office, not paused, nothing else going on */
    N.begin(1); N.midEnd();
    await sleep(700);
    for (const name of ['doorClose', 'hatch', 'knock', 'beep']) {
      const bang = setInterval(() => { try { N.sfxTest(name); } catch(e) {} }, 200);
      const m = await N.meterBuses(1600);
      clearInterval(bang);
      rows.push(name.padEnd(11) + ' cue mean ' + String(m.cue).padStart(7) +
                '  cue peak ' + String(m.cuePeak).padStart(7) +
                '  blocks ' + m.cueBlocks + '  (cue fader ' + N.audio().cue + ')');
      await sleep(400);
    }
    /* and through the real control, in case the hook is the problem */
    {
      const el = document.querySelector('#ns-pad [data-k="left"]');
      const hit = () => { if (!el) return; const r = el.getBoundingClientRect();
        const ev = t => new PointerEvent(t, { clientX:r.left+r.width/2, clientY:r.top+r.height/2,
          bubbles:true, cancelable:true, pointerId:1, isPrimary:true });
        el.dispatchEvent(ev('pointerdown')); el.dispatchEvent(ev('pointerup')); };
      const bang = setInterval(hit, 400);
      const m = await N.meterBuses(2000);
      clearInterval(bang);
      rows.push('the door button'.padEnd(11) + ' cue mean ' + String(m.cue).padStart(7) +
                '  cue peak ' + String(m.cuePeak).padStart(7) + '  blocks ' + m.cueBlocks);
    }
    /* and his voice, in the same run and on the same meter, so the
       gap is one measurement and not two compared across runs */
    await sleep(600);
    const script = N.words();
    for (const line of (script.tapes[3] || []).concat(script.tapes[2] || []).slice(0, 10)) {
      N.tapeQuiet();
      if (!N.tapeSayRaw(line.t, null, false)) continue;
      await sleep(600);
      const m = await N.meterBuses(1800);
      if (N.said().took === 'tape') {
        rows.push('HIS VOICE'.padEnd(11) + ' vox mean ' + String(m.him).padStart(7) +
                  '  vox peak ' + String(m.himPeak).padStart(7) +
                  '  score heard ' + m.musicHeard);
        break;
      }
      await sleep(500);
    }
    return rows;
  });
  out.forEach(l => console.log('  ' + l));
  await b.close();
})();
