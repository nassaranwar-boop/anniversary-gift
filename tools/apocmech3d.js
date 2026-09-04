/* The stealth assertions, driven headlessly: walls stop her, doors open,
   a wardrobe hides her, noise is heard, being caught is a close call and
   not a death, and every minigame can actually be finished. */
const { chromium } = require('playwright-core');
const t0 = Date.now();
const log = (...a) => console.log(`[${((Date.now()-t0)/1000).toFixed(1)}s]`, ...a);
let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FAIL ' + name + (extra ? '  ' + JSON.stringify(extra) : '')); }
}

(async () => {
  const b = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--use-gl=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--no-sandbox']
  });
  const p = await b.newPage({ viewport: { width: 640, height: 400 } });
  const errs = [];
  p.on('pageerror', e => errs.push('PAGEERR: ' + e.message));
  p.on('console', m => { if (m.type()==='error' && !/ERR_FAILED/.test(m.text())) errs.push('CONSOLE: '+m.text()); });
  await p.route('**', r => (r.request().url().startsWith('http://localhost') ? r.continue() : r.abort()));
  await p.goto('http://localhost:8899/index.html', { waitUntil: 'domcontentloaded' });
  await p.evaluate(() => {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById('screen-apoc').classList.add('active');
    window.Apocalypse.start();
  });
  await p.waitForFunction(() => !!window.__apEnter, { timeout: 40000 });
  await p.evaluate(() => { window.__apLoop(false); window.__apQuality(2); });
  log('booted');

  const ev = (fn, arg) => p.evaluate(fn, arg);

  // ---- 1. walls stop her -------------------------------------------------
  await ev(() => window.__apEnter(0));
  let r = await ev(() => {
    window.__apTeleport(1, 1);           // top-left corner of the house
    const before = { x: G().player.x, z: G().player.z };
    window.__apKey('left', 1); window.__apKey('up', 1);
    for (let i=0;i<120;i++) window.__apPump(1/60);
    window.__apKey('left', 0); window.__apKey('up', 0);
    const after = { x: G().player.x, z: G().player.z };
    return { before, after, moved: Math.hypot(after.x-before.x, after.z-before.z) };
    function G(){ return window.Apocalypse.game; }
  });
  ok('a wall stops her walking into it', r.moved < 1.2, r);

  // ---- 2. she can actually walk ------------------------------------------
  r = await ev(() => {
    window.__apTeleport(8, 8);           // the landing, wide open
    const before = { x: G().player.x, z: G().player.z };
    window.__apKey('right', 1);
    for (let i=0;i<120;i++) window.__apPump(1/60);
    window.__apKey('right', 0);
    const after = { x: G().player.x, z: G().player.z };
    return { moved: after.x - before.x };
    function G(){ return window.Apocalypse.game; }
  });
  ok('she walks when told to', r.moved > 4, r);

  // ---- 3. creeping is slower --------------------------------------------
  r = await ev(() => {
    function G(){ return window.Apocalypse.game; }
    function run(sneak) {
      window.__apTeleport(8, 8);
      const b = G().player.x;
      window.__apKey('right', 1); window.__apKey('sneak', sneak ? 1 : 0);
      for (let i=0;i<90;i++) window.__apPump(1/60);
      window.__apKey('right', 0); window.__apKey('sneak', 0);
      return G().player.x - b;
    }
    return { walk: run(false), creep: run(true) };
  });
  ok('creeping is slower than walking', r.creep < r.walk * 0.75, r);

  // ---- 4. a hiding place hides her --------------------------------------
  r = await ev(() => {
    function G(){ return window.Apocalypse.game; }
    /* find a hiding place rather than knowing where one is: the house
       gets rearranged and a hard-coded tile goes stale */
    const w = G().world;
    let hx = -1, hy = -1;
    for (let y = 0; y < w.h && hx < 0; y++) {
      for (let x = 0; x < w.w; x++) {
        const c = w.at(x, y);
        if (c === 'h' || c === 'j') { hx = x; hy = y; break; }
      }
    }
    window.__apTeleport(hx, hy);
    for (let i=0;i<6;i++) window.__apPump(1/60);
    const hidden = G().player.hidden;
    window.__apTeleport(8, 8);
    for (let i=0;i<6;i++) window.__apPump(1/60);
    return { onH: hidden, offH: G().player.hidden };
  });
  ok('standing in a wardrobe hides her', r.onH === true && r.offH === false, r);

  // ---- 5. a door opens and is loud --------------------------------------
  r = await ev(() => {
    function G(){ return window.Apocalypse.game; }
    window.__apTeleport(5, 7);           // just below the landing door at (5,6)
    for (let i=0;i<4;i++) window.__apPump(1/60);
    const d = G().world.doors.find(d => d.x === 5 && d.y === 6);
    const before = d ? d.want : null;
    window.__apUse();
    for (let i=0;i<90;i++) window.__apPump(1/60);
    return { found: !!d, want: d && d.want, open: d && d.open };
  });
  ok('a door she can open, opens', r.found && r.want === 1 && r.open > 0.5, r);

  // ---- 6. the television is a story beat --------------------------------
  r = await ev(() => {
    function G(){ return window.Apocalypse.game; }
    window.__apTeleport(2, 12);          // beside the T at (3,12)
    for (let i=0;i<4;i++) window.__apPump(1/60);
    window.__apUse();
    const overlayUp = document.getElementById('ap-overlay').getAttribute('aria-hidden') === 'false';
    const hasTv = !!document.querySelector('.ap-tv-canvas');
    const step0 = G().stepIndex;
    const btn = document.querySelector('.ap-tv .ap-card-go');
    if (btn) btn.click();
    for (let i=0;i<10;i++) window.__apPump(1/60);
    /* turning it off starts her working out what to do about it */
    window.__apSkipDialogue();
    for (let i=0;i<10;i++) window.__apPump(1/60);
    return { overlayUp, hasTv, step0, step1: G().stepIndex, state: G().state };
  });
  ok('the TV comes up and clears the first step',
     r.overlayUp && r.hasTv && r.step1 === r.step0 + 1, r);

  // ---- 7. the wire panel restores power and opens the dead door ---------
  r = await ev(() => {
    function G(){ return window.Apocalypse.game; }
    /* she goes round the house first, the way the story asks — and the
       game no longer minds if she does not, but the assertion below is
       about the step advancing, so do it in order */
    const tw = window.Apocalypse.game.world.torchAt;
    window.__apTeleport(tw.x, tw.y + 1);
    for (let i=0;i<4;i++) window.__apPump(1/60);
    window.__apUse();
    window.__apSkipDialogue();
    for (let i=0;i<6;i++) window.__apPump(1/60);
    const pw = window.Apocalypse.game.world.panelAt;
    window.__apTeleport(pw.x, pw.y + 1);   // beside the wire panel, wherever it is
    for (let i=0;i<4;i++) window.__apPump(1/60);
    window.__apUse();
    const hasPanel = !!document.querySelector('.ap-panel-canvas');
    const before = G().stepIndex;
    window.__apSolvePanel();
    return new Promise(res => setTimeout(() => {
      for (let i=0;i<30;i++) window.__apPump(1/60);
      /* the shutter goes up on an empty bay and she says so */
      window.__apSkipDialogue();
      for (let i=0;i<10;i++) window.__apPump(1/60);
      const dead = G().world.doors.find(d => d.kind === 'P');
      res({ hasPanel, before, after: G().stepIndex,
            powered: G().world.powered, deadOpen: dead && dead.want });
    }, 400));
  });
  ok('the wire panel powers the garage door',
     r.hasPanel && r.powered === true && r.deadOpen === 1 && r.after === r.before + 1, r);

  // ---- 8. reaching the exit finishes the level --------------------------
  r = await ev(() => {
    function G(){ return window.Apocalypse.game; }
    const ex = G().world.exit;
    window.__apTeleport(ex.x, ex.y);
    for (let i=0;i<20;i++) window.__apPump(1/60);
    return { step: G().stepIndex, total: G().def.steps.length,
             overlay: document.getElementById('ap-overlay').getAttribute('aria-hidden') };
  });
  ok('walking onto the way out ends the level', r.step >= r.total, r);

  // ---- 9. the note gives her the code, the keypad takes it --------------
  r = await ev(() => {
    function G(){ return window.Apocalypse.game; }
    window.__apEnter(1);
    window.__apTeleport(10, 24);          // beside the N at (11,24)
    for (let i=0;i<4;i++) window.__apPump(1/60);
    window.__apUse();
    const noteUp = !!document.querySelector('.ap-note-code');
    const shown = document.querySelector('.ap-note-code') && document.querySelector('.ap-note-code').textContent;
    const ok = document.querySelector('.ap-note-ok');
    if (ok) ok.click();
    for (let i=0;i<6;i++) window.__apPump(1/60);
    return { noteUp, shown, code: G().code };
  });
  ok('the note in the shop carries the code', r.noteUp && r.shown === '4180' && r.code === '4180', r);

  r = await ev(() => {
    function G(){ return window.Apocalypse.game; }
    window.__apTeleport(32, 23);          // beside the D at (31,23)
    for (let i=0;i<4;i++) window.__apPump(1/60);
    window.__apUse();
    const padUp = !!document.querySelector('.ap-keypad-pad');
    window.__apKeypad();
    for (let i=0;i<60;i++) window.__apPump(1/60);
    const d = G().world.doors.find(d => d.kind === 'D');
    return { padUp, locked: d && d.locked, open: d && d.open };
  });
  ok('the code opens the staff gate', r.padUp && r.locked === false && r.open > 0.5, r);

  // ---- 10. being caught is a close call, not a death --------------------
  r = await ev(() => {
    function G(){ return window.Apocalypse.game; }
    window.__apEnter(1);
    const g = G();
    window.__apTeleport(6, 17);
    for (let i=0;i<10;i++) window.__apPump(1/60);
    const safe = { x: g.player.safe.x, z: g.player.safe.z };
    /* park one of them right on top of her and let it take hold */
    const z = g.zombies[0];
    z.x = g.player.x + 0.2; z.z = g.player.z + 0.2;
    z.state = 'chase'; z.look = { x: g.player.x, z: g.player.z };
    for (let i=0;i<10;i++) window.__apPump(1/60);
    const grabbed = g.state;
    /* do not answer it */
    for (let i=0;i<140;i++) window.__apPump(1/60);
    const afterGrab = g.state;
    for (let i=0;i<140;i++) window.__apPump(1/60);
    const playable = ['play','grab','close','dialogue'].indexOf(g.state) >= 0;
    return { grabbed, afterGrab, finally: g.state, playable, closeCalls: g.closeCalls,
             backAtSafe: Math.hypot(g.player.x - safe.x, g.player.z - safe.z) < 2.5,
             alive: !!g.player };
  });
  ok('being taken hold of is a grab, then a close call, then she is back',
     r.grabbed === 'grab' && r.closeCalls >= 1 && r.backAtSafe && r.playable, r);

  // ---- 11. breaking out of the grab -------------------------------------
  r = await ev(() => {
    function G(){ return window.Apocalypse.game; }
    window.__apClear();
    const g = G();
    window.__apTeleport(6, 17);
    for (let i=0;i<10;i++) window.__apPump(1/60);
    const calls = g.closeCalls;
    const z = g.zombies[1] || g.zombies[0];
    z.x = g.player.x + 0.2; z.z = g.player.z + 0.2;
    z.state = 'chase'; z.look = { x: g.player.x, z: g.player.z };
    for (let i=0;i<10;i++) window.__apPump(1/60);
    const grabbed = g.state === 'grab';
    /* answer it twice */
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyQ' }));
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyJ' }));
    window.__apPump(1/60);
    /* read it the instant it lets go — leave it any longer and the same
       one simply takes hold again, which is correct but not the point */
    return { grabbed, state: g.state, grabGone: !g.grab, calls, now: g.closeCalls };
  });
  ok('answering the grab twice gets her out of it',
     r.grabbed && r.grabGone && r.state === 'play' && r.now === r.calls, r);

  // ---- 12. they hear a noise and go and look ----------------------------
  r = await ev(() => {
    function G(){ return window.Apocalypse.game; }
    window.__apClear();
    const g = G();
    window.__apTeleport(9, 17);
    for (let i=0;i<8;i++) window.__apPump(1/60);
    g.zombies.forEach(z => { z.state = 'calm'; z.look = null; });
    /* a door is 110 px of noise; put one of them within that */
    const z = g.zombies[0];
    z.x = g.player.x + 6; z.z = g.player.z;
    z.state = 'calm';
    const before = z.state;
    /* walking makes noise */
    window.__apKey('right', 1);
    for (let i=0;i<120;i++) window.__apPump(1/60);
    window.__apKey('right', 0);
    const heard = g.zombies.some(q => q.state === 'look' || q.state === 'chase' || q.state === 'react');
    return { before, heard };
  });
  ok('walking is loud enough to be heard', r.heard === true, r);

  // ---- 13. creeping past is possible ------------------------------------
  r = await ev(() => {
    function G(){ return window.Apocalypse.game; }
    window.__apEnter(1);
    window.__apClear();
    const g = G();
    window.__apTeleport(9, 17);
    for (let i=0;i<8;i++) window.__apPump(1/60);
    g.zombies.forEach(z => { z.state='calm'; z.look=null; z.x = 999; z.z = 999; });
    const z = g.zombies[0];
    z.x = g.player.x; z.z = g.player.z - 7;   /* behind her, out of her path */
    z.facing = -Math.PI/2; z.state = 'calm'; z.kind = 'idle';
    window.__apKey('sneak', 1); window.__apKey('right', 1);
    for (let i=0;i<180;i++) window.__apPump(1/60);
    window.__apKey('right', 0); window.__apKey('sneak', 0);
    return { state: z.state, playerState: g.state };
  });
  ok('creeping makes no noise at all', r.state === 'calm', r);

  console.log('');
  log(`${pass} passed, ${fail} failed`);
  if (errs.length) { console.log('page errors:'); console.log(errs.slice(0,10).join('\n')); }
  await b.close();
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('FATAL', e); process.exit(1); });
