/* Does the score actually play the tune?
 *
 * ostrender.js proves the cues make sound. That is a much weaker claim
 * than it looks: a scheduler that transposed everything by a fourth, or
 * that dropped the melody and left only the pad, would pass it easily.
 * A score whose whole argument is "one theme, eleven different dresses"
 * has to be checked against the theme.
 *
 * So this renders each cue's melody ALONE, offline, finds the pitch of
 * each note that comes out, and compares it to what ost.js says that
 * cue's theme should be. It also checks the one relationship the score
 * is built on: the lantern path must be the blossom park in the
 * relative minor — same seven notes, different home.
 *
 *   node osttune.js
 */
const { chromium } = require('playwright-core');
const out = [];
const ok = (n, c, x) => out.push((c ? 'PASS  ' : 'FAIL  ') + n + (x ? '   ' + x : ''));

/* One Goertzel bin. Cheaper than an FFT and all that is needed here:
   "how much energy is at exactly this frequency". */
function power(buf, rate, from, len, freq) {
  const w = 2 * Math.PI * freq / rate;
  const c = 2 * Math.cos(w);
  let s0 = 0, s1 = 0, s2 = 0;
  const end = Math.min(buf.length, from + len);
  for (let i = from; i < end; i++) {
    s0 = buf[i] + c * s1 - s2;
    s2 = s1; s1 = s0;
  }
  return s1 * s1 + s2 * s2 - c * s1 * s2;
}

const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox', '--no-proxy-server', '--disable-gpu'] });
  const page = await browser.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  await page.route('**/*', r => r.request().url().startsWith('http://127.0.0.1') ? r.continue() : r.abort());
  await page.goto('http://127.0.0.1:8899/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
  /* ost.js is fetched with the chapter rather than sitting in the head,
     and main exposes window.loadChapter so a harness can open that door
     itself instead of guessing how long the idle prefetch takes. */
  await page.evaluate(() => window.loadChapter && window.loadChapter('quest'));
  await page.waitForTimeout(200);
  await page.waitForTimeout(1200);

  const renderSolo = (name, seconds) => page.evaluate(async ({ name, seconds }) => {
    const rate = 22050;                       // plenty for pitch, quarter the work
    const off = new OfflineAudioContext(1, Math.ceil(rate * seconds), rate);
    const realShared = window.hvSharedCtx, realWake = window.wakeAudio;
    window.hvSharedCtx = () => off;
    window.wakeAudio = () => {};
    await new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = 'ost.js?solo=' + Math.random();
      s.onload = res; s.onerror = rej;
      document.head.appendChild(s);
    });
    window.OST.setOn(true);
    window.OST.__render(name, seconds, true);
    const expect = window.OST.__expect(name);
    const buf = await off.startRendering();
    window.hvSharedCtx = realShared; window.wakeAudio = realWake;
    return { pcm: Array.from(buf.getChannelData(0)), rate, expect };
  }, { name, seconds });

  const cueNames = await page.evaluate(() => Object.keys(window.OST.cues));

  let checkedNotes = 0, wrongNotes = [];
  for (const name of cueNames) {
    const r = await renderSolo(name, 24);
    if (!r.expect.length) continue;            // ridge/bridge/orchard withhold the tune on purpose
    const pcm = r.pcm, rate = r.rate;
    for (const e of r.expect) {
      /* Sample the SUSTAIN, not the onset.
         This used to look 0.06s after the attack, which is inside the
         strings' own 0.42s bow — and the previous theme note's 0.4s
         release is still ringing there. The two candidates came out
         near-tied and the winner flipped between runs, so the meadow
         intermittently "played" an F where an E was written. A test
         that fails one run in three is worse than one that fails every
         time: it teaches you to re-run it. */
      const from = Math.floor((e.at + Math.min(0.5, e.dur * 0.35)) * rate);
      const len = Math.floor(Math.min(0.45, e.dur * 0.4) * rate);
      if (from + len > pcm.length) continue;
      let best = null, bestP = 0;
      for (let m = e.midi - 7; m <= e.midi + 7; m++) {
        const p = power(pcm, rate, from, len, mtof(m));
        if (p > bestP) { bestP = p; best = m; }
      }
      checkedNotes++;
      if (best !== e.midi) wrongNotes.push(name + ' @' + e.at.toFixed(1) + 's want ' + e.midi + ' got ' + best);
    }
  }
  ok('every note of the theme comes out at the pitch it was written',
     wrongNotes.length === 0, wrongNotes.slice(0, 6).join(' | ') || checkedNotes + ' notes checked across the score');

  /* The score's central claim, checked as arithmetic rather than taken
     on trust: the lantern path is the blossom park's relative minor. */
  const rel = await page.evaluate(() => {
    const c = window.OST.cues;
    return { sakuraKey: c.sakura.key, sakuraMinor: c.sakura.minor,
             lanternKey: c.lantern.key, lanternMinor: c.lantern.minor };
  });
  ok('the lantern path is the blossom park in the relative minor',
     rel.sakuraMinor === false && rel.lanternMinor === true &&
     ((rel.sakuraKey + 9) % 12) === rel.lanternKey,
     'C major -> A minor');

  /* And that the three withholding cues really do withhold it, because
     that is a deliberate choice the writing depends on. */
  const withheld = await page.evaluate(() =>
    ['ridge', 'bridge', 'orchard'].filter(k => window.OST.cues[k].theme));
  ok('the ridge, the bridge and the orchard do not play the theme',
     withheld.length === 0, withheld.join(',') || 'all three withhold it');

  /* The bridge hands it back a note at a time — the same notes, in
     order, and it must be the whole phrase by the far post. */
  const steps = await page.evaluate(() => window.OST.theme.length);
  ok('the bridge has a whole phrase to hand back', steps >= 9, steps + ' notes');

  ok('no page errors', errs.length === 0, errs.join(' | '));
  console.log(out.join('\n'));
  await browser.close();
  process.exit(out.some(l => l.startsWith('FAIL')) ? 1 : 0);
})();
