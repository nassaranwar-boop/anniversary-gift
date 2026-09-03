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
      back: !!document.querySelector('.ap-card-go')
    };
  });
  ok('the controls panel draws the keys as keys', panel.caps >= 7, panel);
  ok('and has a switch for each setting', panel.segs === 4, panel);
  ok('each switch shows which way it is set', panel.on === 4, panel);
  ok('and there is a way back', panel.back, panel);

  /* a switch that actually switches, and is remembered */
  const flipped = await p.evaluate(() => {
    const segs = [...document.querySelectorAll('.ap-seg')];
    /* the sound switch is the first one; press OFF */
    const off = [...segs[0].querySelectorAll('.ap-seg-btn')].find(x => x.textContent === 'OFF');
    off.click();
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem('apoc.settings')); } catch (e) {}
    return { lit: off.classList.contains('on'), saved: saved };
  });
  ok('pressing a switch lights it', flipped.lit, flipped);
  ok('and the choice is written down', flipped.saved && flipped.saved.sound === false, flipped);

  /* creeping can be a toggle rather than a hold */
  const creep = await p.evaluate(() => {
    const segs = [...document.querySelectorAll('.ap-seg')];
    const tog = [...segs[2].querySelectorAll('.ap-seg-btn')].find(x => x.textContent === 'TOGGLE');
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
