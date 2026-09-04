/* The menus, as things a person operates rather than things that render.
   A settings panel that looks right and does nothing is worse than one
   that looks wrong. */
const { chromium } = require('playwright-core');
let pass = 0, fail = 0;
const ok = (n, c, x) => { if (c) { pass++; console.log('  ok   ' + n); }
                          else { fail++; console.log('  FAIL ' + n + (x ? '  ' + JSON.stringify(x) : '')); } };
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--use-gl=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--no-sandbox'] });
  const p = await b.newPage({ viewport: { width: 1100, height: 700 } });
  const errs = [];
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
  await p.evaluate(() => { window.__apLoop(false); window.__apQuality(2); window.__apEnter(0); window.__apSkipDialogue(); });
  await p.waitForTimeout(300);

  /* the pause menu */
  const paused = await p.evaluate(() => {
    document.getElementById('ap-pause-btn').click();
    const c = document.querySelector('.ap-card');
    return {
      shown: !!c,
      go: !!document.querySelector('.ap-card-go'),
      quits: [...document.querySelectorAll('.ap-card-quit')].map(x => x.textContent),
      state: window.__apState().state
    };
  });
  ok('the pause menu opens', paused.shown && paused.state === 'paused', paused);
  ok('it offers a way back and a way out', paused.go && paused.quits.length >= 2, paused);
  ok('and a way into the controls', paused.quits.some(t => /CONTROLS/.test(t)), paused);

  /* the controls panel */
  const panel = await p.evaluate(() => {
    [...document.querySelectorAll('.ap-card-quit')].find(x => /CONTROLS/.test(x.textContent)).click();
    return {
      caps: document.querySelectorAll('.ap-cap').length,
      segs: document.querySelectorAll('.ap-seg').length,
      on: document.querySelectorAll('.ap-seg-btn.on').length,
      lvls: document.querySelectorAll('.ap-lvl-in').length,
      nums: [...document.querySelectorAll('.ap-lvl-num')].map(x => x.textContent),
      back: !!document.querySelector('.ap-card-go')
    };
  });
  ok('the controls panel draws the keys as keys', panel.caps >= 7, panel);
  ok('and has a switch for each setting', panel.segs === 3, panel);
  ok('each switch shows which way it is set', panel.on === 3, panel);
  ok('sound and music are levels, not switches', panel.lvls === 2, panel);
  ok('and each level says where it is set', panel.nums.length === 2 &&
     panel.nums.every(t => /^\d+$/.test(t)), panel);
  ok('and there is a way back', panel.back, panel);

  /* the sound levels: they move, they are remembered, and nought is off */
  const vol = await p.evaluate(() => {
    const ins = [...document.querySelectorAll('.ap-lvl-in')];
    ins[1].value = '40';
    ins[1].dispatchEvent(new Event('input', { bubbles: true }));
    ins[1].dispatchEvent(new Event('change', { bubbles: true }));
    const mid = JSON.parse(localStorage.getItem('apoc.settings'));
    ins[0].value = '0';
    ins[0].dispatchEvent(new Event('input', { bubbles: true }));
    const zero = JSON.parse(localStorage.getItem('apoc.settings'));
    return { mid: mid, zero: zero,
             reads: [...document.querySelectorAll('.ap-lvl-num')].map(x => x.textContent) };
  });
  ok('moving the music level writes it down',
     vol.mid && Math.abs(vol.mid.musicVol - 0.4) < 0.001, vol.mid);
  ok('sliding the sound to nought turns the sound off',
     vol.zero && vol.zero.sound === false && vol.zero.vol === 0, vol.zero);
  ok('and nought reads OFF rather than 0', vol.reads[0] === 'OFF', vol.reads);

  /* sound off and then on again used to be a one-way door */
  const backOn = await p.evaluate(() => {
    const ins = [...document.querySelectorAll('.ap-lvl-in')];
    ins[0].value = '80';
    ins[0].dispatchEvent(new Event('input', { bubbles: true }));
    const s = JSON.parse(localStorage.getItem('apoc.settings'));
    return { sound: s.sound, vol: s.vol, level: window.__apAudio ? window.__apAudio() : null };
  });
  ok('and turning it back on turns it back on',
     backOn.sound === true && Math.abs(backOn.vol - 0.8) < 0.001, backOn);

  /* creeping can be a toggle rather than a hold */
  const creep = await p.evaluate(() => {
    const segs = [...document.querySelectorAll('.ap-seg')];
    /* shake, creeping, picture — creeping is the middle one */
    const tog = [...segs[1].querySelectorAll('.ap-seg-btn')].find(x => x.textContent === 'TOGGLE');
    tog.click();
    document.querySelector('.ap-card-go').click();          /* BACK */
    document.querySelector('.ap-card-go').click();          /* BACK TO IT */
    const G = window.Apocalypse.game;
    /* __apKey speaks the game's own names, not browser key codes */
    window.__apKey('sneak', true);  window.__apPump(1/60);
    window.__apKey('sneak', false); window.__apPump(1/60);
    for (let i = 0; i < 10; i++) window.__apPump(1/60);
    const after = G.player.creeping;
    window.__apKey('sneak', true);  window.__apPump(1/60);
    window.__apKey('sneak', false); window.__apPump(1/60);
    for (let i = 0; i < 10; i++) window.__apPump(1/60);
    return { latched: after, released: G.player.creeping, state: window.__apState().state };
  });
  ok('back through both panels returns her to the level', creep.state === 'play', creep);
  ok('on toggle, one press starts her creeping', creep.latched === true, creep);
  ok('and another stops her', creep.released === false, creep);

  ok('no page errors from any of it', errs.length === 0, errs.slice(0, 3));
  console.log('');
  console.log(pass + ' passed, ' + fail + ' failed');
  await b.close();
  process.exit(fail ? 1 : 0);
})();
