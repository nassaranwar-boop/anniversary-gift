/* WHERE HIS VOICE SITS AGAINST THE SHOP AND THE SCORE.

   He says the narrator is much louder than everything else. The
   obvious suspect was the takes -- eight TTS models rendered
   separately, no reason for them to match -- and voiceloud settled
   that: all eight are within 1.5dB of each other and HIS ARE THE
   QUIETEST of the lot. So the files are level and the loudness is
   coming from the mix around them.

   Which had never been measurable, because every spoken line went
   straight into cueGain alongside every door, footstep and knock, so
   the voice and the sound effects were one number. voxOut gives him
   a bus, and this reads three things in the running game:

     the score, metered after the duck so it is the level she
       actually hears and not the level before he pushed it down
     the shop -- what is left on cueGain once he is taken off it
     and him

   Four situations: quiet, a door, one of his lines, one of theirs.
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
  await p.waitForFunction(() => { try { return OuissysNightShift.__night.voiceState().ready.length > 3; }
                                  catch (e) { return false; } }, null, { timeout: 180000, polling: 500 });

  const r = await p.evaluate(async () => {
    const N = OuissysNightShift.__night, G = () => N.state();
    const sleep = (ms) => new Promise((x) => setTimeout(x, ms));
    const out = [];
    N.begin(3); N.midEnd();
    await sleep(800);

    /* 1. the shop with nothing happening in it */
    out.push(Object.assign({ what: 'nothing happening' }, await N.balance(1400)));

    /* 2. a door, repeatedly, so the meter has something to average */
    {
      const t0 = Date.now();
      /* the SOUND of a door, not the duck a door causes: N.door() is
         the latter and measuring it reports an empty room */
      const bang = setInterval(() => { try { N.sfxTest('doorClose'); } catch (e) {} }, 220);
      const m = await N.balance(1400);
      clearInterval(bang);
      out.push(Object.assign({ what: 'doors going' }, m));
      void t0;
    }
    await sleep(600);

    /* 3. one of HIS lines */
    {
      const script = N.words();
      const line = (script.tapes[3] || [])[0];
      if (line) {
        N.tapeQuiet();
        N.tapeSayRaw(line.t, null, false);
        await sleep(350);
        out.push(Object.assign({ what: 'him speaking', line: String(line.t).slice(0, 34) },
                               await N.balance(1600)));
      }
    }
    await sleep(900);

    /* 4. one of THEIRS */
    {
      const w = N.watching().says.filter((x) => x.t)[0];
      if (w) {
        N.tapeQuiet();
        N.tapeSayRaw(w.t, w.who, false);
        await sleep(350);
        out.push(Object.assign({ what: w.who + ' speaking', line: String(w.t).slice(0, 34) },
                               await N.balance(1600)));
      }
    }
    return out;
  });
  await b.close();

  console.log('\n  situation            score    shop     him      him over shop   duck');
  r.forEach((x) => {
    console.log('  ' + String(x.what).padEnd(20) +
                String(x.music).padStart(6) + '  ' + String(x.shop).padStart(6) + '  ' +
                String(x.him).padStart(6) + '  ' + String(x.overShop).padStart(10) + ' dB  ' +
                String(x.bed).padStart(6));
  });
  console.log('\n  (all dB, relative to full scale; "duck" is what the score is held at)\n');
  r.forEach((x) => { if (x.line) console.log('    ' + x.what + ': "' + x.line + '..."'); });
  console.log();
})();
