/* THE TONE THAT REPEATS.

   Twice now the complaint has been a beep every few seconds in the quiet
   scenes — the radio, the roof, the cats — and twice the hunt went after
   filters and harmonic levels while the thing making it sat in plain
   sight: every melody in the chapter was written between 440 and 1319Hz,
   which is the top of a soprano's range, and a note up there on its own
   over a still pad is not a melody, it is a signal. Its second and third
   partials then land at two and three kilohertz, where the ear is at its
   most sensitive.

   So this asks the only question that matters, of every cue in the game:
   what is the highest thing you actually put in the air? Every cue is
   rehearsed through its four passes — the real play() function, the real
   instruments — and every oscillator that gets built is logged. A voice
   that is faded to nothing is never built, so anything here is audible.  */
const { chromium } = require('playwright-core');
let pass = 0, fail = 0;
const ok = (n, c, x) => { if (c) { pass++; console.log('  ok   ' + n); }
                          else { fail++; console.log('  FAIL ' + n + (x ? '  ' + JSON.stringify(x) : '')); } };

/* the ear's sore spot is 2-5kHz and it starts climbing at about 1.2 */
const CEILING = 1250;

const CUES = ['dread', 'streets', 'sterile', 'drive', 'open', 'hearth', 'signal',
              'dusk', 'camp', 'dawn', 'settled', 'hunt', 'held', 'search',
              'grief', 'gate', 'home', 'after'];

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--use-gl=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist',
           '--no-sandbox','--autoplay-policy=no-user-gesture-required'] });
  const p = await b.newPage({ viewport: { width: 900, height: 560 } });
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.route('**', r => (r.request().url().startsWith('http://localhost') ? r.continue() : r.abort()));
  await p.goto('http://localhost:8899/index.html', { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(300);
  /* The chapters are fetched on the idle callback now, not by a script
     tag, so the global is not there the instant the document is. A tool
     that drives a chapter directly has to wait for the file the same
     way the hub card does. */
  await p.waitForFunction(() => !!(window.Apocalypse), { timeout: 30000 });
  await p.evaluate(() => {
    window.__tones = [];
    const RANGES = [[1788,'piano'],[1861,'strings'],[1892,'cello'],[1917,'bell'],[1952,'swell'],[1966,'pulse'],[1994,'tick'],[2054,'-']];
    const S = OscillatorNode.prototype.start;
    OscillatorNode.prototype.start = function () {
      const f = +this.frequency.value.toFixed(1);
      let who = '?';
      if (f > 1250) {
        try {
          const raw = new Error().stack.split('\n').slice(1, 7).join(' | ');
          const m = /apocalypse\.js\?v=\d+:(\d+)/.exec(raw);
          if (m) { const n = +m[1]; who = 'other';
            for (let i = 0; i < RANGES.length - 1; i++)
              if (n >= RANGES[i][0] && n < RANGES[i+1][0]) { who = RANGES[i][1]; break; }
            const c = /apocalypse\.js\?v=\d+:(\d+)/g; let q, last = null;
            while ((q = c.exec(raw))) last = q[1];
            who += '@' + last;
          }
        } catch (e) {}
      }
      window.__tones.push(f);
      if (f > 1250) (window.__who = window.__who || []).push(f + ' ' + who);
      return S.apply(this, arguments);
    };
  });
  /* apocalypse.js is fetched on the idle callback now, so Apocalypse does
     not exist at domcontentloaded — go through the site's own door. */
  await p.evaluate(async () => {
    await window.loadChapter('apoc');
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById('screen-apoc').classList.add('active');
    window.Apocalypse.start();
  });
  await p.waitForFunction(() => !!window.__apEnter, { timeout: 40000 });
  await p.evaluate(() => { window.__apLoop(false); window.__apQuality(2); window.__apEnter(1); });
  await p.waitForTimeout(1200);

  const seen = {};
  for (const cue of CUES) {
    const r = await p.evaluate((c) => {
      window.__tones = []; window.__who = [];
      const errs = window.__apScorePlay(c, 132);
      const t = window.__tones.slice();
      const hi = {};
      t.forEach(f => { if (f > 1250) hi[f] = (hi[f] || 0) + 1; });
      return { errs: errs, n: t.length, hi: hi, who: [...new Set(window.__who || [])],
               max: t.length ? Math.max.apply(null, t) : 0,
               over: t.filter(f => f > 1250).length };
    }, cue);
    seen[cue] = r;
  }

  for (const cue of CUES) {
    const r = seen[cue];
    ok(cue + ': it plays at all', r.n > 20 && (!r.errs || !r.errs.length), r);
    ok(cue + ': nothing it builds sounds above ' + CEILING + 'Hz',
       r.max <= CEILING, { max: r.max, over: r.over, who: r.who });
  }

  /* AND WHERE THE TUNE ITSELF SITS.

     The ceiling above catches what the instruments add; this catches
     what the score asks for. Both matter, because the fix for one is not
     the fix for the other — two passes of filtering the partials left
     the melody note itself up at 1047Hz and the beep exactly where it
     was. So: the tune layer is played an octave below what is written,
     and no cue may reach past the written octave with a plain voice. */
  const src = await (await fetch('http://localhost:8899/apocalypse.js')).text();
  ok('the tune layer is played an octave down',
     /var TUNE_OCT = -1;/.test(src) && /hz\(e\.n, \(oct \|\| 0\) \+ TUNE_OCT\)/.test(src),
     src.match(/var TUNE_OCT = .*/));

  /* a cue body reaching for octave 1 or higher on a voice you hear
     plainly is how the two worst offenders got in: a 1760Hz bell alone
     in a silent cue, and a pair of sawtooths at 1480 over the chase */
  const cueBody = src.slice(src.indexOf('var PIECES = {'), src.indexOf('function retireBus'));
  const up = cueBody.match(/(?:piano|bell|strings|pulse)\([^\n]*hz\([^)]*,\s*[1-9]\)/g) || [];
  ok('and no cue reaches above the written octave', up.length === 0, up.slice(0, 4));

  /* a cue that has gone quiet is not a fix, it is a different bug */
  ok('every cue still has a full arrangement in it',
     CUES.every(c => seen[c].n >= 30), Object.keys(seen).map(c => c + ':' + seen[c].n));

  ok('no page errors from any of it', errs.length === 0, errs.slice(0, 3));
  console.log('');
  console.log(pass + ' passed, ' + fail + ' failed');
  await b.close();
  process.exit(fail ? 1 : 0);
})();
