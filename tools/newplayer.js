/* PLAY IT LIKE SOMEBODY WHO HAS NEVER SEEN IT.

   Every other harness in here drives the shift with `pump`, which runs
   the simulation with the frame loop, the renderer, the audio and the
   real clock all taken out of it. That is the right way to check a rule
   and the wrong way to find the three things a person actually
   complains about: a caption that stays up after he has stopped
   talking, a toy that stops being anywhere, and the view pointing at
   the wrong wall while something is at the other door.

   So this one sits in the chair. It starts a night, lets the page's own
   loop run in real time, moves a mouse the way a hand does -- to the
   button it is about to press and not back again -- and writes down
   what it sees every tenth of a second:

     the caption, and whether a voice is actually sounding
     every one of the four: room, step, at a door or not
     where the view is pointing, and what is at each door
     the frame time, so a stall is a number rather than a feeling

   It asserts nothing. It prints a timeline and flags the three
   complaints, and the fixing is done by reading it.
                       node tools/newplayer.js [night] [seconds]     */
const { chromium } = require('playwright-core');
const NIGHT = Number(process.argv[2] || 1);
const SECS = Number(process.argv[3] || 70);
const HOUR = Number(process.argv[4] || 0);

(async () => {
  const b = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox', '--no-proxy-server', '--use-gl=swiftshader',
           '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
  const p = await b.newPage({ viewport: { width: 900, height: 560 } });
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  await p.route('**/*', (r) => {
    const u = r.request().url();
    if (u.indexOf('book-scene.js') >= 0) return r.abort();
    return u.startsWith('http://127.0.0.1') ? r.continue() : r.abort();
  });
  await p.goto('http://127.0.0.1:8899/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.evaluate((wantTutor) => { window.__wantTutor = wantTutor;
    localStorage.setItem('ns_seenintro', '1'); localStorage.setItem('ns_terms', '1');
    /* the tutorial is part of what a new player sees, so it is only
       skipped when this is asked for a later night */
    if (!window.__wantTutor) localStorage.setItem('ns_notutor', '1');
    showScreen('nightshift');
    return loadChapter('nightshift').then(() => OuissysNightShift.start()); }, NIGHT === 1);
  await p.waitForFunction(() => window.OuissysNightShift && OuissysNightShift.__night,
                          { timeout: 20000, polling: 200 });
  /* a real click somewhere harmless, so the audio context is allowed to
     run: a browser will not speak for a page nobody has touched */
  await p.mouse.click(450, 280);
  await p.evaluate(([n, h]) => OuissysNightShift.__night.begin(n, h), [NIGHT, HOUR]);
  await p.evaluate(() => { const N = OuissysNightShift.__night;
    if (N.setMix) { N.setMix('voice', 1); N.setMix('master', 1); } });

  /* the frame clock, read off the page rather than guessed */
  await p.evaluate(() => {
    window.__fps = { last: 0, worst: 0, n: 0, sum: 0, spikes: [] };
    const tick = (ts) => {
      const f = window.__fps;
      if (f.last) {
        const d = ts - f.last;
        f.n++; f.sum += d;
        if (d > f.worst) f.worst = d;
        if (d > 120) f.spikes.push(+(ts / 1000).toFixed(1) + ':' + Math.round(d));
      }
      f.last = ts;
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });

  const rows = [];
  const t0 = Date.now();
  let pressed = 0, lastAt = '', lastTalk = '', lastTut = '';
  while ((Date.now() - t0) / 1000 < SECS) {
    const t = (Date.now() - t0) / 1000;
    /* SHE PLAYS. Nothing clever: when something is at a door, shut that
       door; open it again a few seconds after it has gone. Raise the
       monitor now and then to look for the thing that is hidden. */
    const st = await p.evaluate(() => {
      const N = OuissysNightShift.__night, G = N.state(), C = N.cast();
      const three = OuissysNightShift.__three ? OuissysNightShift.__three() : null;
      let yaw = null;
      if (three && three.view) {
        const d = new window.THREE.Vector3();
        three.view.getWorldDirection(d);
        yaw = +Math.atan2(d.x, -d.z).toFixed(2);
      }
      const who = {};
      ['cogsworth', 'chime', 'marabelle', 'jax'].forEach((k) => {
        const c = C[k];
        who[k] = { r: c.room, s: c.step, d: !!c.atDoor, a: !!c.awake, w: +(c.wound || 0).toFixed(1) };
      });
      const tape = N.tape ? N.tape() : null;
      const talk = N.talkState ? N.talkState() : null;
      const tut = N.tutor ? N.tutor() : null;
      return {
        hour: G.hour, power: +G.power.toFixed(1), mon: !!G.monitor, cam: G.cam,
        doors: { l: !!G.doors.left, r: !!G.doors.right, h: !!G.doors.hatch },
        cap: G.caption || '', capT: +(G.captionT || 0).toFixed(2),
        tape: tape, talk: talk, tut: tut,
        yaw: yaw, who: who, fps: window.__fps,
      };
    }).catch(() => null);
    if (!st) break;
    rows.push({ t: +t.toFixed(1), st });
    /* orientation, step by step */
    const tl = st.tut && st.tut.step >= 0 ? st.tut.line : '';
    if (tl !== lastTut) {
      if (tl) console.log('   ' + t.toFixed(1) + 's  teaching: ' + tl);
      else console.log('   ' + t.toFixed(1) + 's  orientation over');
      lastTut = tl;
    }
    /* and every door-talk, from the knock to the end of it */
    const tk = st.talk;
    const key = tk && tk.on ? tk.who + '/' + tk.phase : '';
    if (key !== lastTalk) {
      if (key) console.log('   ' + t.toFixed(1) + 's  talk: ' + key
                           + ' at the ' + tk.door + ' door');
      else console.log('   ' + t.toFixed(1) + 's  talk over');
      lastTalk = key;
    }
    /* the arrivals, as they happen */
    const nowAt = Object.keys(st.who).filter((k) => st.who[k].d && st.who[k].r === 'office').join(',');
    if (nowAt !== lastAt) {
      console.log('   ' + t.toFixed(1) + 's  at the door: [' + (nowAt || '-') + ']  doors '
                  + (st.doors.l ? 'L' : '-') + (st.doors.r ? 'R' : '-') + (st.doors.h ? 'H' : '-')
                  + '  power ' + st.power + '  hour ' + st.hour);
      lastAt = nowAt;
    }
    /* act on it, the way a person would */
    const at = Object.keys(st.who).filter((k) => st.who[k].d && st.who[k].r === 'office');
    for (const k of at) {
      const side = k === 'chime' ? 'hatch' : (st.who[k].s % 2 ? 'right' : 'left');
      if (!st.doors[side === 'hatch' ? 'h' : side[0]]) {
        /* the hand goes to the button, and stays there */
        const box = await p.evaluate((s) => {
          const el = document.querySelector('#ns-pad [data-k="' + s + '"]');
          if (!el) return null;
          const r = el.getBoundingClientRect();
          return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
        }, side);
        if (box) { await p.mouse.move(box.x, box.y); await p.mouse.click(box.x, box.y); pressed++; }
      }
    }
    await new Promise((r) => setTimeout(r, 120));
  }

  /* ---- what it saw ------------------------------------------------ */
  console.log('night ' + NIGHT + ', ' + SECS + 's of wall clock, ' + rows.length + ' samples, '
              + pressed + ' button presses');
  const last = rows[rows.length - 1];
  console.log('frames: mean ' + (last.st.fps.sum / last.st.fps.n).toFixed(1) + 'ms, worst '
              + last.st.fps.worst.toFixed(0) + 'ms, stalls over 120ms: '
              + last.st.fps.spikes.length);
  if (last.st.fps.spikes.length) console.log('   ' + last.st.fps.spikes.slice(0, 14).join('  '));

  console.log('\n--- the tape: what is on screen against what is being said');
  let openAt = null, line = null, lastVoice = null;
  rows.forEach((r) => {
    const tp = r.st.tape;
    if (!tp) return;
    if (tp.line && tp.line !== line) { line = tp.line; openAt = r.t; lastTalk = null; }
    if (tp.talking) lastVoice = r.t;
    if (!tp.line && line) {
      console.log('   "' + line.slice(0, 44) + '" up ' + (r.t - openAt).toFixed(1)
                  + 's, voice stopped ' + (lastVoice === null ? 'never started'
                    : (r.t - lastVoice).toFixed(1) + 's before it went'));
      line = null;
    }
  });
  if (line) console.log('   "' + line.slice(0, 44) + '" STILL UP at the end of the run');

  console.log('\n--- the four');
  ['cogsworth', 'chime', 'marabelle', 'jax'].forEach((k) => {
    let stuckFrom = null, worst = 0, worstAt = 0, prev = null, moves = 0;
    rows.forEach((r) => {
      const w = r.st.who[k];
      const key = w.r + '#' + w.s;
      if (prev !== key) { moves++; if (stuckFrom !== null && r.t - stuckFrom > worst) { worst = r.t - stuckFrom; worstAt = stuckFrom; } stuckFrom = r.t; prev = key; }
      if (!w.a) stuckFrom = r.t;
    });
    const end = rows[rows.length - 1];
    if (stuckFrom !== null && end.t - stuckFrom > worst) { worst = end.t - stuckFrom; worstAt = stuckFrom; }
    const w = end.st.who[k];
    console.log('   ' + k.padEnd(10) + ' moves ' + String(moves).padStart(3)
                + '  longest still ' + worst.toFixed(1) + 's (from ' + worstAt.toFixed(1) + 's)'
                + '  ends ' + w.r + '#' + w.s + (w.d ? ' AT A DOOR' : '') + (w.a ? '' : ' asleep'));
  });

  console.log('\n--- the view, while something is at a door');
  /* the office doors are at x -3.3 (left/west) and +3.3 (right/east):
     a yaw near -1.6 is looking west, +1.6 east, 0 is straight ahead */
  let bad = 0;
  rows.forEach((r) => {
    const at = Object.keys(r.st.who).filter((k) => r.st.who[k].d && r.st.who[k].r === 'office');
    if (!at.length || r.st.mon || r.st.yaw === null) return;
    const side = at.map((k) => (r.st.who[k].s % 2 ? 'right' : 'left'));
    const looking = r.st.yaw < -0.5 ? 'left' : r.st.yaw > 0.5 ? 'right' : 'ahead';
    if (looking !== 'ahead' && side.indexOf(looking) < 0) {
      bad++;
      if (bad < 8) console.log('   ' + r.t.toFixed(1) + 's looking ' + looking
                               + ' while ' + at.join(',') + ' is at the ' + side.join(',') + ' door');
    }
  });
  console.log('   ' + bad + ' samples looking away from the only thing at a door');
  if (errs.length) console.log('\nPAGE ERRORS: ' + errs.slice(0, 5).join(' | '));
  await b.close();
})();
