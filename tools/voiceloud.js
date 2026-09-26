/* HOW LOUD EACH OF THEM ACTUALLY IS.

   Every line in this chapter is rendered by one of eight TTS models,
   each on its own, and nothing anywhere has ever compared their
   output levels. The chapter's own gain staging treats them as
   equals -- a line of his is 0.90 and a line of one of the four is
   0.88 -- which is only correct if the takes themselves match, and
   there is no reason at all why they should.

   So: decode every mp3 and measure it. RMS over the speech (frames
   above a floor, so that the silence at either end of a short line
   does not make it look quiet), and true peak. Grouped by who is
   speaking, because that is the knob worth having.
                                               node tools/voiceloud.js */
const { chromium } = require('playwright-core');
const fs = require('fs');
const { execFileSync } = require('child_process');

(async () => {
  const plan = JSON.parse(execFileSync('node', [__dirname + '/voicesheet.js', '--plan'], { encoding: 'utf8' }));
  const have = fs.readdirSync(__dirname + '/../voice').filter((f) => f.endsWith('.mp3'))
                 .map((f) => f.replace(/\.mp3$/, ''));
  const ids = have.filter((id) => plan[id]);

  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox', '--no-proxy-server', '--autoplay-policy=no-user-gesture-required'] });
  const p = await b.newPage();
  await p.route('**/*', (r) => r.request().url().startsWith('http://127.0.0.1') ? r.continue() : r.abort());
  await p.goto('http://127.0.0.1:8899/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });

  const rows = await p.evaluate(async (ids) => {
    const AC = new (window.AudioContext || window.webkitAudioContext)();
    const out = [];
    for (const id of ids) {
      try {
        const r = await fetch('voice/' + id + '.mp3');
        if (!r.ok) { out.push({ id, err: r.status }); continue; }
        const buf = await AC.decodeAudioData(await r.arrayBuffer());
        const d = buf.getChannelData(0);
        /* peak first, then RMS over everything above a twentieth of it:
           a short line is mostly silence and averaging that in reports
           the pause, not the voice */
        let peak = 0;
        for (let i = 0; i < d.length; i++) { const v = Math.abs(d[i]); if (v > peak) peak = v; }
        const floor = peak * 0.05;
        let sum = 0, n = 0;
        for (let i = 0; i < d.length; i++) { const v = d[i]; if (Math.abs(v) > floor) { sum += v * v; n++; } }
        out.push({ id, peak: +peak.toFixed(4), rms: +Math.sqrt(sum / Math.max(1, n)).toFixed(4),
                   secs: +buf.duration.toFixed(2) });
      } catch (e) { out.push({ id, err: String(e).slice(0, 40) }); }
    }
    return out;
  }, ids);
  await b.close();

  const db = (x) => (20 * Math.log10(Math.max(1e-6, x))).toFixed(1);
  const by = {};
  rows.forEach((r) => {
    if (r.err) return;
    const who = plan[r.id].who;
    (by[who] = by[who] || []).push(r);
  });
  const med = (a) => { const s = a.slice().sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };

  console.log('\n  who         takes   median RMS      median peak     spread of RMS');
  const order = Object.keys(by).sort((a, c) => med(by[c].map((r) => r.rms)) - med(by[a].map((r) => r.rms)));
  const ref = {};
  order.forEach((w) => {
    const rs = by[w].map((r) => r.rms), ps = by[w].map((r) => r.peak);
    const mr = med(rs), mp = med(ps);
    ref[w] = mr;
    const lo = Math.min.apply(null, rs), hi = Math.max.apply(null, rs);
    console.log('  ' + w.padEnd(11) + String(by[w].length).padStart(4) + '    ' +
                (mr.toFixed(4) + ' (' + db(mr) + ' dB)').padEnd(16) +
                (mp.toFixed(4) + ' (' + db(mp) + ' dB)').padEnd(16) +
                db(lo) + ' to ' + db(hi) + ' dB');
  });

  const anwar = ref.anwar || 1;
  console.log('\n  against his voice:');
  order.filter((w) => w !== 'anwar').forEach((w) => {
    const d = 20 * Math.log10(ref[w] / anwar);
    console.log('    ' + w.padEnd(11) + (d > 0 ? '+' : '') + d.toFixed(1) + ' dB  ' +
                (Math.abs(d) < 1.5 ? '(level with him)' : d < 0 ? '(QUIETER than him)' : '(louder than him)'));
  });

  const bad = rows.filter((r) => r.err);
  if (bad.length) console.log('\n  could not read ' + bad.length + ': ' + bad.slice(0, 4).map((r) => r.id).join(', '));
  console.log('\n  ' + rows.filter((r) => !r.err).length + ' takes measured\n');

  /* and the numbers, for whatever wants them next */
  fs.writeFileSync('/tmp/claude-0/voiceloud.json', JSON.stringify({ ref, rows }, null, 1));
})();
