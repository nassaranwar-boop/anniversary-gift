/* THE FIVE THINGS FROM THE PHOTOGRAPHS.

   None of these are visible to any suite already here. A heading squeezed
   to two pixels still renders and still passes every assertion about it
   existing. Two texts drawn on top of each other are two correct texts.
   A suspended audio context throws nothing — it just stops making sound.
   So: measure the heading, measure the boxes, and take the sound away and
   give it back. */
const { chromium } = require('playwright-core');
let pass = 0, fail = 0;
const ok = (n, c, x) => { if (c) { pass++; console.log('  ok   ' + n); }
                          else { fail++; console.log('  FAIL ' + n + (x ? '  ' + JSON.stringify(x) : '')); } };
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--use-gl=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--no-sandbox',
           '--autoplay-policy=no-user-gesture-required'] });
  const errs = [];

  /* ---------- 1. the how-to heading, at the size it was photographed ---------- */
  for (const vp of [{ width: 1100, height: 700 }, { width: 900, height: 480 }]) {
    const p = await b.newPage({ viewport: vp });
    p.on('pageerror', e => errs.push(e.message));
    await p.route('**', r => (r.request().url().startsWith('http://localhost') ? r.continue() : r.abort()));
    await p.goto('http://localhost:8899/index.html', { waitUntil: 'domcontentloaded' });
    await p.waitForTimeout(400);
    await p.evaluate(() => {
      try { localStorage.removeItem('apoc.settings'); } catch (e) {}
      document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
      document.getElementById('screen-apoc').classList.add('active');
      window.Apocalypse.start();
    });
    await p.waitForFunction(() => !!window.__apEnter, { timeout: 40000 });
    await p.evaluate(() => { window.__apLoop(false); });
    /* BEGIN, then the how-to card */
    await p.evaluate(() => { const g = document.querySelector('.ap-card-go'); if (g) g.click(); });
    await p.waitForTimeout(200);
    const head = await p.evaluate(() => {
      const t = document.querySelector('.ap-card-title');
      if (!t) return null;
      const r = t.getBoundingClientRect();
      const line = parseFloat(getComputedStyle(t).lineHeight) || 0;
      return { h: r.height, scroll: t.scrollHeight, line: line,
               rows: document.querySelectorAll('.ap-card-row').length,
               text: t.textContent.slice(0, 12) };
    });
    ok(vp.height + 'px tall: the how-to heading is a heading, not a sliver',
       head && head.h >= head.line * 0.95, head);
    ok(vp.height + 'px tall: and none of it is cut off',
       head && head.scroll <= Math.ceil(head.h) + 1, head);
    ok(vp.height + 'px tall: with the rows still under it', head && head.rows >= 8, head);
    await p.close();
  }

  /* ---------- 2. the narrator and the people in the shot ---------- */
  const p = await b.newPage({ viewport: { width: 1100, height: 700 } });
  p.on('pageerror', e => errs.push(e.message));
  /* count every oscillator the page ever starts: a sound that still
     builds nodes is a sound that still plays */
  await p.addInitScript(() => {
    window.__osc = 0;
    const S = OscillatorNode.prototype.start;
    OscillatorNode.prototype.start = function () { window.__osc++; return S.apply(this, arguments); };
    /* a footstep is a burst of filtered noise, not a note, so it never
       touches an oscillator — count those too or the test is blind to
       exactly the sound the player said had stopped */
    const B = AudioBufferSourceNode.prototype.start;
    AudioBufferSourceNode.prototype.start = function () { window.__osc++; return B.apply(this, arguments); };
  });
  await p.route('**', r => (r.request().url().startsWith('http://localhost') ? r.continue() : r.abort()));
  await p.goto('http://localhost:8899/index.html', { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(400);
  await p.evaluate(() => {
    try { localStorage.removeItem('apoc.settings'); } catch (e) {}
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById('screen-apoc').classList.add('active');
    window.Apocalypse.start();
  });
  await p.waitForFunction(() => !!window.__apEnter, { timeout: 40000 });
  await p.evaluate(() => { window.__apLoop(false); window.__apQuality(2); window.__apEnter(0); });
  await p.waitForTimeout(200);

  /* every cut that holds while the two of them talk over it */
  for (const cut of ['sunrise', 'ride2', 'roof']) {
    const shown = await p.evaluate((which) => {
      window.__apCut(which);
      const cap = document.querySelector('.ap-cut-cap');
      const dlg = document.getElementById('ap-dlg');
      const talking = dlg && dlg.getAttribute('aria-hidden') === 'false';
      const capText = cap ? cap.textContent.trim() : '';
      let overlap = false;
      if (cap && talking) {
        const a = cap.getBoundingClientRect(), c = dlg.getBoundingClientRect();
        overlap = !(a.bottom <= c.top || c.bottom <= a.top ||
                    a.right <= c.left || c.right <= a.left);
      }
      return { talking: talking, cap: capText, overlap: overlap,
               dlg: document.getElementById('ap-dlg-text').textContent.slice(0, 20) };
    }, cut);
    ok(cut + ': somebody is talking over it', shown.talking, shown);
    ok(cut + ': and the narrator is not talking at the same time',
       shown.cap === '' && !shown.overlap, shown);

    /* tap it out, and the narrator gets the screen back if the cut holds */
    const after = await p.evaluate(() => {
      let n = 0;
      while (window.__apState().dialogue && n < 200) { window.__apSay(); n++; }
      const cap = document.querySelector('.ap-cut-cap');
      const dlg = document.getElementById('ap-dlg');
      return { presses: n, stillCut: !!window.__apState().cine,
               cap: cap ? cap.textContent.trim() : '',
               dlgShown: dlg && dlg.getAttribute('aria-hidden') === 'false' };
    });
    ok(cut + ': the conversation ends and the box goes away',
       after.presses > 0 && !after.dlgShown, after);
    ok(cut + ': and nothing is left doubled up',
       !(after.cap && after.dlgShown), after);
  }

  /* ---------- 3. leaving the tab and coming back ---------- */
  await p.evaluate(() => { window.__apEndCine(); window.__apEnter(0); });
  await p.waitForTimeout(200);
  const sound = await p.evaluate(async () => {
    /* a tab that goes away really is hidden, and the page is told so —
       without that the game quite rightly wakes the sound straight back
       up and the test proves nothing */
    let hidden = false;
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden });
    Object.defineProperty(document, 'visibilityState', {
      configurable: true, get: () => (hidden ? 'hidden' : 'visible') });

    window.__apAudio();                       /* BEGIN, as the player would */
    await new Promise(r => setTimeout(r, 250));
    const before = window.__apAudioState();

    hidden = true;
    document.dispatchEvent(new Event('visibilitychange'));
    const went = await window.__apAudioSuspend();   /* the tab goes away */
    await new Promise(r => setTimeout(r, 250));
    const away = window.__apAudioState();

    /* and comes back: this is the event the page gets, nothing more */
    hidden = false;
    document.dispatchEvent(new Event('visibilitychange'));
    await new Promise(r => setTimeout(r, 500));
    const back = window.__apAudioState();
    return { before: before, went: went, away: away, back: back };
  });
  ok('the sound starts', sound.before.state === 'running', sound.before);
  ok('leaving the tab stops it', sound.went && sound.away.state === 'suspended', sound.away);
  ok('coming back starts it again', sound.back.state === 'running', sound.back);
  ok('and the score is still the score it was',
     sound.back.playing === sound.before.playing, sound);

  /* a sound that still makes nodes is a sound that still plays */
  const alive = await p.evaluate(async () => {
    const n0 = window.__osc;
    window.__apKey('right', true);
    for (let i = 0; i < 240; i++) window.__apPump(1 / 60);
    window.__apKey('right', false);
    await new Promise(r => setTimeout(r, 1400));   /* and a bar of the score */
    return { made: (window.__osc) - n0 };
  });
  ok('and she can still be heard walking after all that', alive.made !== 0, alive);

  /* ---------- 4. the rings round her feet ---------- */
  const ring = await p.evaluate(() => {
    const G = window.Apocalypse.game;
    /* let the rings she left walking about die first, or the biggest one
       on screen is one of those and the measurement is of the wrong ring */
    for (let i = 0; i < 70; i++) window.__apPump(1 / 60);
    const R = 6;
    window.__apNoise(G.player.x, G.player.z, R);
    /* most of the way through its life, where it is at its widest */
    for (let i = 0; i < 40; i++) window.__apPump(1 / 60);
    let biggest = 0;
    G.scene.traverse(o => {
      if (o.visible && o.renderOrder === 8 && o.geometry &&
          o.geometry.type === 'RingGeometry' &&
          o.geometry.parameters && o.geometry.parameters.outerRadius === 1) biggest = Math.max(biggest, o.scale.x);
    });
    return { biggest: biggest, r: R };
  });
  ok('a step draws a ring', ring.biggest > 0.1, ring);
  ok('and it stays round her feet rather than filling the room',
     ring.biggest > 0 && ring.biggest <= 0.12 + ring.r * 0.52 + 0.01, ring);
  ok('but it is still big enough to read', ring.biggest > ring.r * 0.2, ring);

  ok('no page errors from any of it', errs.length === 0, errs.slice(0, 3));
  console.log('');
  console.log(pass + ' passed, ' + fail + ' failed');
  await b.close();
  process.exit(fail ? 1 : 0);
})();
