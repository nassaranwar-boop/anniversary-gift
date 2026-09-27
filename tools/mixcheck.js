/* WHERE HIS VOICE SITS AGAINST THE SHOP AND THE SCORE.

   He says the narrator is much louder than everything else. The
   obvious suspect was the takes -- eight TTS models rendered
   separately, no reason at all for them to match -- and voiceloud
   settled that: all eight within 1.5dB of each other, and HIS ARE
   THE QUIETEST of the lot. The files are level. The loudness comes
   from the mix around them.

   Which had never been measurable, because every spoken line went
   straight into cueGain alongside every door, footstep and knock, so
   the voice and the sound effects were one number. voxOut gives him
   a bus of his own, and this reads three things in the running game:

     the score, metered after the duck, so it is the level she
       actually hears and not the level before he pushed it down
     the shop -- what is left on cueGain once he is taken off it
     and him

   IT REPORTS WHY IT FAILED. The first run metered -120dB on every
   source but the score, which looks exactly like a mixing fault and
   was a suspended AudioContext: a browser will not start one for a
   page nobody has touched, and --autoplay-policy only covers media
   elements. It clicks the page now, prints the context state, prints
   which effects exist, and prints which path each line took -- a
   line that fell back to the silent caption path meters as silence
   and says nothing whatever about how loud he is.
                                                node tools/mixcheck.js */
const { chromium } = require('playwright-core');

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox', '--no-proxy-server', '--use-gl=swiftshader', '--enable-unsafe-swiftshader',
           '--autoplay-policy=no-user-gesture-required'] });
  const p = await b.newPage({ viewport: { width: 900, height: 600 } });
  p.on('pageerror', (e) => console.log('  PAGEERROR', e.message));
  await p.route('**/*', (r) => r.request().url().startsWith('http://127.0.0.1') ? r.continue() : r.abort());
  await p.goto('http://127.0.0.1:8899/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.evaluate(() => { try { localStorage.clear(); localStorage.setItem('ns_notutor', '1'); } catch (e) {}
    showScreen('nightshift');
    return loadChapter('nightshift').then(() => OuissysNightShift.start()); });
  await p.waitForFunction(() => { try { return !!OuissysNightShift.__night.cast().jax; } catch (e) { return false; } },
                          null, { timeout: 180000, polling: 500 });
  await p.waitForFunction(() => { try { return OuissysNightShift.__night.voiceState().ready.length > 20; }
                                  catch (e) { return false; } }, null, { timeout: 180000, polling: 500 });
  await p.mouse.click(450, 300);
  await p.waitForTimeout(600);

  const r = await p.evaluate(async () => {
    const N = OuissysNightShift.__night;
    const sleep = (ms) => new Promise((x) => setTimeout(x, ms));
    const out = [];
    const diag = {};
    try { const a = N.audio(); diag.ac = a.ctx; diag.muted = a.muted; diag.bed = a.bedRunning; }
    catch (e) { diag.ac = 'no hook'; }
    try { diag.sfx = N.sfxTest('__list__'); } catch (e) { diag.sfx = []; }
    try { diag.ready = N.voiceState().ready.length; } catch (e) {}

    N.begin(3); N.midEnd();
    await sleep(900);
    /* THE NIGHT MUST NOT BE MAKING ITS OWN NOISE.

       The previous run's "nothing happening" row came back with the
       duck at 0.76 and something on cueGain, which means a line was
       still going during the row that is supposed to be silence.
       Every window after that was measuring the shift as much as the
       thing under test. Pausing stops playStep, so no cue, no line
       and no footstep fires except the ones this asks for. */
    if (N.state().phase === 'play') N.pauseNow();
    diag.paused = N.state().phase;

    /* PROVE THE AUDIO IS LIVE BEFORE MEASURING ANYTHING.

       The previous run measured the doors first and got silence, then
       got a good voice reading seven rows later -- so the doors were
       fine and the context simply was not running yet. Nothing is
       measured until a line has demonstrably come off a recording. */
    let live = false;
    const script = N.words();
    const hisLines = (script.tapes[3] || []).concat(script.tapes[2] || []);
    let hisRow = null;
    for (const line of hisLines.slice(0, 12)) {
      N.tapeQuiet();
      if (!N.tapeSayRaw(line.t, null, false)) continue;
      await sleep(600);
      const m = await N.meterBuses(1800);
      if (N.said().took === 'tape') {
        live = true;
        hisRow = Object.assign({ what: 'him speaking', took: 'tape',
                                 line: String(line.t).slice(0, 32) }, m);
        break;
      }
      await sleep(500);
    }
    diag.live = live;
    diag.acAfter = (function () { try { return N.audio().ctx; } catch (e) { return '?'; } })();
    if (!live) return { out, diag };

    await sleep(1200);
    out.push(Object.assign({ what: 'nothing happening' }, await N.meterBuses(1800)));

    /* the shop, one effect at a time, each fired repeatedly so the
       gate has something to hold on to */
    for (const name of ['doorClose', 'knock', 'step', 'bells', 'beep', 'hatch']) {
      let told = null;
      const bang = setInterval(() => { try { told = N.sfxTest(name); } catch (e) { told = { threw: String(e) }; } }, 230);
      const m = await N.meterBuses(1600);
      clearInterval(bang);
      out.push(Object.assign({ what: name, sfx: told }, m));
      await sleep(350);
    }

    out.push(hisRow);

    {
      const says = N.watching().says.filter((x) => x.t);
      for (const w of says) {
        N.tapeQuiet();
        if (!N.tapeSayRaw(w.t, w.who, false)) continue;
        await sleep(600);
        const m = await N.meterBuses(1800);
        const took = N.said().took;
        out.push(Object.assign({ what: w.who + ' speaking', took,
                                 line: String(w.t).slice(0, 32) }, m));
        if (took === 'tape') break;
        await sleep(600);
      }
    }
    return { out, diag };
  });

  await b.close();

  console.log('\n  audio context: ' + r.diag.ac + ', muted ' + r.diag.muted +
              ', takes in memory: ' + r.diag.ready);
  if (Array.isArray(r.diag.sfx)) console.log('  effects: ' + r.diag.sfx.length + ' of them');
  console.log('  a recording actually played: ' + r.diag.live + ',  context after: ' + r.diag.acAfter +
              ',  shift ' + r.diag.paused);
  console.log('\n  MEAN over the window, dB full scale');
  console.log('  situation            score heard   cue      him      duck   blocks  path');
  r.out.forEach((x) => {
    console.log('  ' + String(x.what).padEnd(20) +
                String(x.musicHeard).padStart(8) + '  ' + String(x.cue).padStart(7) + '  ' +
                String(x.him).padStart(7) + '  ' + String(x.bed).padStart(6) + '  ' +
                String(x.cueBlocks).padStart(5) + '   ' + (x.took || '') +
                (x.sfx && x.sfx.threw ? '  THREW ' + x.sfx.threw : ''));
  });
  console.log('\n  LOUDEST BLOCK in the window, which is what a transient is');
  console.log('  situation            score       cue      him');
  r.out.forEach((x) => {
    console.log('  ' + String(x.what).padEnd(20) + String(x.musicPeak).padStart(8) + '  ' +
                String(x.cuePeak).padStart(7) + '  ' + String(x.himPeak).padStart(7));
  });
  console.log('\n  (dB relative to full scale; "duck" is where the score is held)\n');
  r.out.forEach((x) => { if (x.line) console.log('    ' + x.what + ': "' + x.line + '..."'); });
  console.log();
})();
