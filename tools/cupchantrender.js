/* Render a ground's CHANT to real audio, offline, so it can be heard.
 *
 * The same trick as cupostrender.js and for a better reason: a tune is
 * the one thing in this repository that no assertion can judge. You can
 * prove a chant engine schedules bars, mixes five layers, and fades
 * them in the right order, and still have written eight bars of
 * nothing. The only test of a hook is whether a person hears a hook.
 *
 * Same trick as tools/ostrender.js and for the same reason: you cannot
 * check music by reading it, and a synth score that throws inside its
 * note scheduler goes silent without reporting anything. This loads
 * cup.chant.js into a page against an OfflineAudioContext, lays a cue
 * down, and writes a .wav — so the piece can be played — plus what the
 * samples say: peak, RMS, whether it is silent, whether it clips, and
 * how many oscillators were actually started.
 *
 *   node tools/cupchantrender.js <team id> [seconds] [out.wav]
 *   node tools/cupchantrender.js --all       every ground, as a table
 */
const { chromium } = require('playwright-core');
const fs = require('fs');

function wav(channels, rate) {
  const n = channels[0].length, ch = channels.length;
  const buf = Buffer.alloc(44 + n * ch * 2);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * ch * 2, 4); buf.write('WAVE', 8);
  buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(ch, 22); buf.writeUInt32LE(rate, 24);
  buf.writeUInt32LE(rate * ch * 2, 28); buf.writeUInt16LE(ch * 2, 32);
  buf.writeUInt16LE(16, 34); buf.write('data', 36); buf.writeUInt32LE(n * ch * 2, 40);
  let o = 44;
  for (let i = 0; i < n; i++) {
    for (let c = 0; c < ch; c++) {
      const v = Math.max(-1, Math.min(1, channels[c][i]));
      buf.writeInt16LE(Math.round(v * 32767), o); o += 2;
    }
  }
  return buf;
}

(async () => {
  const args = process.argv.slice(2);
  const all = args[0] === '--all';
  const cue = all ? null : (args[0] || 'upm');
  const secs = +(args[1] || 24);
  const outPath = args[2] || ('/tmp/chant-' + (cue || 'all') + '.wav');

  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox', '--no-proxy-server', '--disable-gpu'] });
  const page = await browser.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  await page.route('**/*', r => r.request().url().startsWith('http://127.0.0.1') ? r.continue() : r.abort());
  await page.goto('http://127.0.0.1:8899/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(600);

  const render = (name, seconds) => page.evaluate(async ({ name, seconds }) => {
    const rate = 44100;
    const off = new OfflineAudioContext(2, Math.ceil(rate * seconds), rate);
    /* reload the file so its module-level state binds to the offline
       clock rather than to whatever the page is already using */
    await new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = 'cup.chant.js?render=' + Math.random();
      s.onload = res; s.onerror = rej;
      document.head.appendChild(s);
    });
    let notes = 0;
    const realOsc = off.createOscillator.bind(off);
    off.createOscillator = function () { notes++; return realOsc(); };
    window.CupChant.init(off, off.destination, { volume: 1 });
    const team = (window.CUP_CONFIG.TEAMS.filter(t => t.id === name)[0]
                  || window.CUP_CONFIG.TEAMS[0]);
    window.CupChant.setTeam(team.anthem);
    const r0 = window.CupChant.__render(seconds, 0.92);
    const buf = await off.startRendering();
    return { notes, bars: r0.bars, barSecs: r0.barSecs, start: r0.start,
             rate, bpm: team.anthem.tempo,
             groove: team.anthem.groove || 'stomp',
             title: team.anthem.title || team.id,
             left: Array.from(buf.getChannelData(0)),
             right: Array.from(buf.getChannelData(1)) };
  }, { name, seconds });

  /* the config has to be in the page before any of this means anything */
  await page.evaluate(() => new Promise((res) => {
    const s = document.createElement('script');
    s.src = 'cup.config.js'; s.onload = res; document.head.appendChild(s);
  }));
  const names = all
    ? await page.evaluate(() => window.CUP_CONFIG.TEAMS.map(t => t.id))
    : [cue];

  /* the tempos, so the render length can be worked out per ground */
  const team_bpm = await page.evaluate(() => {
    const o = {};
    window.CUP_CONFIG.TEAMS.forEach(t => { o[t.id] = t.anthem.tempo; });
    return o;
  });
  const rows = [];
  for (const name of names) {
    /* LONG ENOUGH TO REACH THE LAST CHORUS, AND NO LONGER.
       Thirty-three bars, worked out from this ground's own tempo
       rather than a flat number of seconds \u2014 at 76bpm that is 104
       seconds and at 132 it is 60, and rendering everything at the
       slow one's length was most of a ten-minute wait for nothing. */
    const need = all ? (33 * 4 * 60 / (team_bpm[name] || 100)) : secs;
    const r = await render(name, need);
    let peak = 0, sum = 0;
    for (let i = 0; i < r.left.length; i++) {
      const v = Math.abs(r.left[i]);
      if (v > peak) peak = v;
      sum += r.left[i] * r.left[i];
    }
    const rms = Math.sqrt(sum / r.left.length);
    /* HOW WIDE IT IS. The correlation between the two channels: 1.00
       means they are identical, which is mono however many speakers
       you play it through, and is what this was. A produced record
       sits somewhere around 0.4 to 0.8 — wide, but with the bass and
       the kick still down the middle where they belong, because a
       stereo bass is a bass that disappears on half the systems in the
       world. */
    let lr = 0, ll = 0, rr2 = 0;
    for (let i = 0; i < r.left.length; i++) {
      lr += r.left[i] * r.right[i];
      ll += r.left[i] * r.left[i];
      rr2 += r.right[i] * r.right[i];
    }
    const corr = lr / Math.max(1e-9, Math.sqrt(ll * rr2));
    /* THE SHAPE OF THE SONG, AS NUMBERS.
       Eight bars with a hole in bar four is the whole design; if the
       drop is not measurably quieter than the bar that follows it, the
       structure is decoration and the anthem is a loop again. */
    const barLen = Math.round(r.rate * r.barSecs);
    const bar0 = Math.round(r.rate * r.start);
    /* THE SECOND HALF OF EACH BAR, not the whole of it.
       A held note at the end of the previous bar, plus a stadium
       reverb with a two-second tail on it, rings well past the bar
       line — so the first beat of the drop is still full of the bar
       before. That is correct music and a useless measurement. The
       hole is felt in the middle of the bar, so that is where it is
       read, and every bar is read the same way. */
    const bars = [];
    for (let k = 0; bar0 + k * barLen < r.left.length && k < 32; k++) {
      let s2 = 0, n2 = 0;
      const from = Math.round(bar0 + k * barLen + barLen * 0.45);
      const to = Math.min(bar0 + (k + 1) * barLen, r.left.length);
      for (let i = from; i < to; i++) {
        s2 += r.left[i] * r.left[i]; n2++;
      }
      bars.push(Math.sqrt(s2 / Math.max(1, n2)));
    }
    /* EACH ARRANGEMENT AGAINST ITS OWN DESIGN.
       Four of the six are built round a hole in bar four. The other
       two are not: Handel's whole trick is twenty-two bars of nothing
       turning into everything at once, and Grieg's is a thing that
       starts small and never stops growing. Asking those two for a
       drop is asking them to be the other four — which is the mistake
       that produced six tracks that sounded the same in the first
       place. A build is checked for BUILDING. */
    /* A SONG, NOT A LOOP. The intro must be genuinely small and the
       chorus genuinely big \u2014 that ratio IS the thing being asked for,
       because chills are a response to arrival and nothing arrives in
       a track that is the same size all the way through. */
    /* SECTION MEANS, not single bars. Sampling every fourth bar landed
       squarely on the two bars that are DESIGNED to be near-silent \u2014
       the hole in the chorus and the one at the top of the last \u2014 and
       reported a song with no chorus at all. A section is judged by
       its average, with the holes left out of it. */
    const HOLES = [20, 28];       // the two bars designed to be near-silent
    const mean = (a, b2) => {
      const v = [];
      for (let k = a; k < b2; k++) {
        if (HOLES.indexOf(k) >= 0) continue;
        if (bars[k] > 0) v.push(bars[k]);
      }
      return v.length ? v.reduce((p2, c2) => p2 + c2, 0) / v.length : 0;
    };
    const intro = mean(0, 8), chorus = mean(16, 24), brk = mean(24, 28), last = mean(28, 32);
    const shapeOk = intro !== undefined && chorus !== undefined
      && intro > 0 && chorus > intro * 1.7
      /* 0.80 rather than 0.75, because at 132bpm a bar is 1.8 seconds
         and the chorus's reverb tail is still sounding through the
         first half of the breakdown. That is the room, not the
         arrangement, and it is a real thing a fast record does. */
      && brk !== undefined && brk < chorus * 0.80
      && last !== undefined && last > chorus * 0.9;
    const grows = false;
    rows.push({ name, peak: +peak.toFixed(4), rms: +rms.toFixed(5),
                notes: r.notes, bars: r.bars, profile: bars,
                groove: r.groove, title: r.title, grows: grows,
                sections: { intro, chorus, brk, last },
                crest: 20 * Math.log10(Math.max(1e-6, peak) / Math.max(1e-6, rms)),
                corr: corr,
                dropOk: shapeOk,
                silent: peak < 0.0005, clipping: peak > 0.999 });
    if (!all) {
      /* Normalised for listening only. In the chapter it sits under the
         crowd at the level it renders at; a file you are going to open
         on its own needs the headroom taking out. */
      const k = peak > 0.0001 ? (0.72 / peak) : 1;
      fs.writeFileSync(outPath, wav([r.left.map(v => v * k), r.right.map(v => v * k)], r.rate));
      console.log('wrote ' + outPath + '  ' + r.left.length + ' samples, normalised x' + k.toFixed(1));
    }
  }

  /* CREST FACTOR: how far the peaks sit above the average level, in
     decibels. It is the single number that separates a demo from a
     record. A produced pop track runs 8-12dB; anything above about 16
     is peaky and quiet at the same time, which is what "thin" and
     "distant" actually mean when somebody says a mix sounds unfinished.
     No amount of turning it up fixes it \u2014 the peaks hit the ceiling
     while the body of the sound stays down. */
  console.log('\nground       peak     rms       crest   width  bars  oscillators  verdict');
  rows.forEach(r => console.log(
    r.name.padEnd(12), String(r.peak).padEnd(8), String(r.rms).padEnd(9),
    (r.crest.toFixed(1) + 'dB').padEnd(7),
    r.corr.toFixed(2).padEnd(6),
    String(r.bars).padEnd(5), String(r.notes).padEnd(12),
    r.silent ? 'SILENT' : (r.clipping ? 'CLIPPING' : 'ok')));
  console.log('\nthe shape of each song, bar by bar (RMS \u00d7 1000):');
  console.log('   every bar, RMS \u00d7 1000. intro 0-7 | build 8-15 | '
              + 'chorus 16-23 | break 24-27 | last 28-31');
  rows.forEach(r => console.log('   ' + r.name.padEnd(9) + (r.groove || '').padEnd(12)
    + '   intro ' + Math.round(r.sections.intro * 1000)
    + '  chorus ' + Math.round(r.sections.chorus * 1000)
    + '  break ' + Math.round(r.sections.brk * 1000)
    + '  last ' + Math.round(r.sections.last * 1000)
    + '   (chorus/intro ' + (r.sections.chorus / Math.max(1e-6, r.sections.intro)).toFixed(2) + 'x)'
    + '\n      ' + r.profile.slice(0, 16).map(v => String(Math.round(v * 1000)).padStart(4)).join('')
    + '\n      ' + r.profile.slice(16, 32).map(v => String(Math.round(v * 1000)).padStart(4)).join('')
    + (r.profile.length >= 6
       ? (r.dropOk ? '   song' : '   FLAT \u2014 no arrival')
       : '')));
  if (errs.length) console.log('\npage errors: ' + errs.slice(0, 3).join(' | '));
  await browser.close();
  process.exit(rows.some(r => r.silent || r.clipping
                             || (r.profile.length >= 6 && !r.dropOk))
               || errs.length ? 1 : 0);
})();
