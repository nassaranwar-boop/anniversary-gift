/* The one thing no other suite here can do: listen.

   Every other tool runs muted, which was fine while sound was
   atmosphere. It stopped being fine the moment telling his four from
   the ones he sold by ear became a rule of the game — a cue she cannot
   distinguish is a mechanic that does not exist.

   So this renders each cue offline through an OfflineAudioContext,
   reads the samples back, and measures three things a person would
   otherwise have to sit and check by hand:

     it made a sound at all      — peak amplitude above the floor
     the two families differ     — spectral centroid, i.e. where the
                                   weight of the sound sits. His four
                                   are pitched and low; parcels are
                                   broadband paper and string.
     left is left                — per-channel energy for a panned cue

   It cannot tell you whether the music is any good. It can tell you
   that the game is not silently lying about a mechanic. */
const { chromium } = require('playwright-core');

(async () => {
  const b = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox','--no-proxy-server','--use-gl=swiftshader','--enable-unsafe-swiftshader'],
  });
  const p = await b.newPage({ viewport: { width: 1000, height: 700 } });
  let fails = 0, checks = 0;
  const ok = (n, c, x) => { checks++; if (!c) { fails++; console.log('  FAIL ' + n + (x ? '  ' + x : '')); }
                            else console.log('  ok   ' + n + (x ? '  ' + x : '')); };
  p.on('pageerror', e => { fails++; console.log('PAGEERROR', e.message); });
  await p.route('**/*', r => { const u = r.request().url();
    if (u.indexOf('book-scene.js') >= 0) return r.abort();
    return u.startsWith('http://127.0.0.1') ? r.continue() : r.abort(); });
  await p.goto('http://127.0.0.1:8899/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForTimeout(700);
  await p.evaluate(() => { try{localStorage.clear();}catch(e){} localStorage.setItem('ns_seenintro','1');
    showScreen('nightshift'); OuissysNightShift.start(); });
  await p.waitForFunction(() => Object.keys(OuissysNightShift.__night.cast()).length >= 7,
                          { timeout: 20000, polling: 200 });

  /* Render one cue offline and measure it. The chapter's synths all
     hang off its own AudioContext, so this swaps in an offline one,
     fires the cue, renders, and puts the real one back. */
  const measure = async (call, secs) => p.evaluate(async ([call, secs]) => {
    const NS = OuissysNightShift.__night;
    const buf = await NS.offline(call, secs);
    const L = buf.l, R = buf.r, rate = buf.rate;
    let peak = 0, sumL = 0, sumR = 0;
    for (let i = 0; i < L.length; i++) {
      const a = Math.abs(L[i]), c = Math.abs(R[i]);
      if (a > peak) peak = a; if (c > peak) peak = c;
      sumL += L[i] * L[i]; sumR += R[i] * R[i];
    }
    /* spectral centroid by a coarse DFT over a log-spaced bank — enough
       to say "this one is bright and that one is not" without pulling
       an FFT library into a test */
    const mono = new Float32Array(L.length);
    for (let i = 0; i < L.length; i++) mono[i] = (L[i] + R[i]) / 2;
    let num = 0, den = 0;
    for (let f = 60; f < 8000; f *= 1.18) {
      let re = 0, im = 0;
      const step = Math.max(1, (mono.length / 4096) | 0);
      for (let i = 0; i < mono.length; i += step) {
        const t = (2 * Math.PI * f * i) / rate;
        re += mono[i] * Math.cos(t); im += mono[i] * Math.sin(t);
      }
      const mag = Math.sqrt(re * re + im * im);
      num += mag * f; den += mag;
    }
    return { peak: +peak.toFixed(4),
             centroid: den > 0 ? Math.round(num / den) : 0,
             l: +Math.sqrt(sumL / L.length).toFixed(5),
             r: +Math.sqrt(sumR / R.length).toFixed(5) };
  }, [call, secs]);

  /* Every cue here is built on filtered noise, so a single render is a
     single roll of the dice: measuring one gave Cogsworth anywhere
     between 923 and 1089 Hz, which is wide enough to flip a margin on
     its own. Three renders, averaged, and the spread reported, so a
     failure here means the sounds are wrong and not that the coin came
     up tails. */
  const avg = async (call, secs) => {
    const runs = [];
    for (let i = 0; i < 3; i++) runs.push(await measure(call, secs));
    const mean = (k) => runs.reduce((a, r) => a + r[k], 0) / runs.length;
    const cs = runs.map(r => r.centroid);
    return { peak: +mean('peak').toFixed(4), centroid: Math.round(mean('centroid')),
             l: +mean('l').toFixed(5), r: +mean('r').toFixed(5),
             lo: Math.min(...cs), hi: Math.max(...cs) };
  };

  console.log('\n— his four have voices —');
  const his = {};
  for (const name of ['cogsworth', 'chime', 'marabelle', 'jax']) {
    his[name] = await avg(name, 1.4);
    ok(name + ' makes a sound', his[name].peak > 0.01, 'peak ' + his[name].peak);
  }

  console.log('\n— and the ones he sold do not —');
  const sold = {};
  for (const name of ['drag', 'settle', 'handle']) {
    sold[name] = await avg(name, 1.4);
    ok(name + ' makes a sound', sold[name].peak > 0.01, 'peak ' + sold[name].peak);
  }

  console.log('\n— can she tell them apart? —');
  const hisC = Object.values(his).map(x => x.centroid);
  const soldC = Object.values(sold).map(x => x.centroid);
  const band = (o) => Object.values(o).map(x => x.centroid + ' (' + x.lo + '-' + x.hi + ')').join(', ');
  console.log('     his four sit at   ', band(his), 'Hz');
  console.log('     the parcels sit at', band(sold), 'Hz');
  /* the worst case a player could get, not the average one */
  const hisWorst = Math.min(...Object.values(his).map(x => x.lo));
  const soldWorst = Math.max(...Object.values(sold).map(x => x.hi));
  /* Measured, and the other way round from what I assumed when I wrote
     this: his four are the BRIGHT ones. Bells, a chime, a music box and
     boots on a board are pitched and full of high harmonics; paper
     dragging and a weight settling are low and broad. Which is correct
     — it just is not what I guessed. What matters is that the two
     families do not overlap at all, and they do not. */
  ok('the parcels are darker than every one of his',
     Math.max(...soldC) < Math.min(...hisC),
     'highest parcel ' + Math.max(...soldC) + ' vs lowest of his ' + Math.min(...hisC));
  ok('and the two bands do not overlap',
     Math.min(...hisC) / Math.max(...soldC) > 1.25,
     'a gap of ' + (Math.min(...hisC) / Math.max(...soldC)).toFixed(2) + 'x');
  /* and they still do not overlap on the unluckiest render of each */
  ok('not even on the worst roll of the dice', soldWorst < hisWorst,
     'loudest-brightest parcel ' + soldWorst + ' vs dullest of his ' + hisWorst);
  /* and his four are distinguishable from each other, or a player who
     has learned one has learned nothing */
  const spread = Math.max(...hisC) / Math.max(1, Math.min(...hisC));
  ok('his four do not all sound alike', spread > 1.5, 'spread ' + spread.toFixed(2) + 'x');

  console.log('\n— and which side it is on —');
  const left = await measure('stepLeft', 1.2);
  const right = await measure('stepRight', 1.2);
  ok('a cue on the west door is in the left ear', left.l > left.r * 1.8,
     'L ' + left.l + ' vs R ' + left.r);
  ok('a cue on the east door is in the right ear', right.r > right.l * 1.8,
     'L ' + right.l + ' vs R ' + right.r);

  console.log('\n— and the voice that reads his statement —');
  const vox = await measure('vox', 3.0);
  ok('it speaks', vox.peak > 0.01, 'peak ' + vox.peak);
  ok('and it sits where a voice sits, not where a buzzer does',
     vox.centroid > 300 && vox.centroid < 3000, vox.centroid + ' Hz');

  console.log('\n' + (fails ? 'FAILED ' + fails + ' of ' + checks
                             : 'all ' + checks + ' checks passed'));
  await b.close();
  process.exit(fails ? 1 : 0);
})();
