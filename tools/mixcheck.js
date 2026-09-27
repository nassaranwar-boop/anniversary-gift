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
    const N = OuissysNightShift.__night, G = () => N.state();
    const sleep = (ms) => new Promise((x) => setTimeout(x, ms));
    const out = [];
    const diag = {};
    try { diag.ac = N.audio().state; } catch (e) { diag.ac = 'unknown'; }
    try { diag.sfx = N.sfxTest('__list__'); } catch (e) { diag.sfx = 'no hook'; }
    try { diag.ready = N.voiceState().ready.length; } catch (e) {}

    N.begin(3); N.midEnd();
    await sleep(900);

    out.push(Object.assign({ what: 'nothing happening' }, await N.balance(1400)));

    {
      const bang = setInterval(() => { try { N.sfxTest('doorClose'); } catch (e) {} }, 240);
      const m = await N.balance(1500);
      clearInterval(bang);
      out.push(Object.assign({ what: 'doors going' }, m));
    }
    await sleep(700);

    /* his: keep trying lines until one actually comes off a recording */
    {
      const script = N.words();
      for (const line of (script.tapes[3] || []).slice(0, 8)) {
        N.tapeQuiet();
        if (!N.tapeSayRaw(line.t, null, false)) continue;
        await sleep(600);
        const m = await N.balance(1600);
        const took = N.said().took;
        out.push(Object.assign({ what: 'him speaking', took, line: String(line.t).slice(0, 32) }, m));
        if (took === 'tape') break;
        await sleep(700);
      }
    }
    await sleep(900);

    /* and one of theirs, the same way */
    {
      const says = N.watching().says.filter((x) => x.t);
      for (const w of says) {
        N.tapeQuiet();
        if (!N.tapeSayRaw(w.t, w.who, false)) continue;
        await sleep(600);
        const m = await N.balance(1600);
        const took = N.said().took;
        out.push(Object.assign({ what: w.who + ' speaking', took, line: String(w.t).slice(0, 32) }, m));
        if (took === 'tape') break;
        await sleep(700);
      }
    }
    return { out, diag };
  });
  await b.close();

  console.log('\n  audio context: ' + r.diag.ac + ',  takes in memory: ' + r.diag.ready);
  if (Array.isArray(r.diag.sfx)) console.log('  effects: ' + r.diag.sfx.slice(0, 16).join(', '));
  console.log('\n  situation            score    shop     him     him over shop  duck   path');
  r.out.forEach((x) => {
    console.log('  ' + String(x.what).padEnd(20) +
                String(x.music).padStart(6) + '  ' + String(x.shop).padStart(6) + '  ' +
                String(x.him).padStart(6) + '  ' + String(x.overShop).padStart(9) + ' dB  ' +
                String(x.bed).padStart(5) + '  ' + (x.took || ''));
  });
  console.log('\n  (dB relative to full scale; "duck" is where the score is held)\n');
  r.out.forEach((x) => { if (x.line) console.log('    ' + x.what + ': "' + x.line + '..."'); });
  console.log();
})();
