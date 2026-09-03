/* She must not start with the torch, must find it in the kitchen, and
   must actually be lighting the room once she has. */
const { chromium } = require('playwright-core');
let pass = 0, fail = 0;
const ok = (n, c, x) => { if (c) { pass++; console.log('  ok   ' + n); }
                          else { fail++; console.log('  FAIL ' + n + (x ? '  ' + JSON.stringify(x) : '')); } };
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--use-gl=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--no-sandbox'] });
  const p = await b.newPage({ viewport: { width: 800, height: 500 } });
  p.on('pageerror', e => console.log('PAGEERR', e.message));
  await p.route('**', r => (r.request().url().startsWith('http://localhost') ? r.continue() : r.abort()));
  await p.goto('http://localhost:8899/index.html', { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(400);
  await p.evaluate(() => {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById('screen-apoc').classList.add('active');
    window.Apocalypse.start();
  });
  await p.waitForFunction(() => !!window.__apEnter, { timeout: 40000 });
  await p.evaluate(() => { window.__apLoop(false); window.__apQuality(0); });

  const r = await p.evaluate(() => {
    window.__apEnter(0); window.__apSkipDialogue();
    for (let i = 0; i < 30; i++) window.__apPump(1/60);
    const G = window.Apocalypse.game;
    const before = { has: !!G.hasTorch, at: G.world.torchAt && { x: G.world.torchAt.x, y: G.world.torchAt.y },
                     lit: G.player.torch ? G.player.torch.visible : null };
    /* stand next to it and use it */
    window.__apTeleport(G.world.torchAt.x, G.world.torchAt.y + 1);
    for (let i = 0; i < 20; i++) window.__apPump(1/60);
    window.__apUse();
    for (let i = 0; i < 40; i++) window.__apPump(1/60);
    const after = { has: !!G.hasTorch, lit: G.player.torch ? G.player.torch.visible : null,
                    cell: G.world.at(G.world.torchAt.x, G.world.torchAt.y) };
    /* and it survives the walk to the next level */
    window.__apEnter(1); window.__apSkipDialogue();
    for (let i = 0; i < 30; i++) window.__apPump(1/60);
    const next = { has: !!G.hasTorch, lit: G.player.torch ? G.player.torch.visible : null };
    return { before, after, next };
  });
  console.log(JSON.stringify(r));
  ok('she does not start with a torch', r.before.has === false && r.before.lit === false, r.before);
  ok('there is a torch to find in the house', !!r.before.at, r.before);
  ok('using it gives it to her', r.after.has === true, r.after);
  ok('and it is lit once she has it', r.after.lit === true, r.after);
  ok('and the tile it was on is clear', r.after.cell !== '1', r.after);
  ok('and she still has it on the street', r.next.has === true && r.next.lit === true, r.next);

  /* ---- the television really goes off ---- */
  const tv = await p.evaluate(() => {
    window.__apEnter(0); window.__apSkipDialogue();
    for (let i = 0; i < 30; i++) window.__apPump(1/60);
    const G = window.Apocalypse.game, W = G.world;
    function read() {
      const scr = W.tvScreen, glow = W.tvGlow;
      let lamp = null;
      for (let i = 0; i < W.lamps.length; i++)
        if (W.lamps[i].kind === 'tv') lamp = W.lamps[i];
      return {
        map: scr && scr.material ? !!scr.material.map : null,
        glow: glow ? glow.visible : null,
        dead: lamp ? !!lamp.dead : null,
        on: !!(scr && scr.material && scr.material.map)
      };
    }
    const before = read();
    window.__apTeleport(W.tvAt.x, W.tvAt.y + 1);
    for (let i = 0; i < 20; i++) window.__apPump(1/60);
    window.__apUse();
    for (let i = 0; i < 20; i++) window.__apPump(1/60);
    /* the broadcast is an overlay with a button on it; a person has to
       press TURN IT OFF, so press it */
    const btns = Array.prototype.slice.call(document.querySelectorAll('.ap-card-go'));
    const off = btns.filter(b => /TURN IT OFF/i.test(b.textContent))[0];
    const pressed = !!off;
    if (off) off.click();
    window.__apSkipDialogue();
    for (let i = 0; i < 60; i++) window.__apPump(1/60);
    return { before: before, after: read(), pressed: pressed };
  });
  console.log(JSON.stringify(tv));
  ok('the television is on to start with', tv.before.on === true, tv.before);
  ok('standing at it and using it puts the broadcast up', tv.pressed === true, tv);
  ok('using it turns it off', tv.after.on === false, tv.after);
  ok('and the screen stops showing a picture', tv.after.map === false, tv.after);
  ok('and stops glowing', tv.after.glow === false, tv.after);
  ok('and stops lighting the room', tv.after.dead === true || tv.after.power === 0, tv.after);

  /* ---- nothing is hung on thin air ---- */
  const art = await p.evaluate(() => {
    const bad = [];
    for (let lv = 0; lv < 5; lv++) {
      window.__apEnter(lv); window.__apSkipDialogue();
      for (let i = 0; i < 10; i++) window.__apPump(1/60);
      const W = window.Apocalypse.game.world;
      const list = W.wallArt || [];
      for (let i = 0; i < list.length; i++)
        if (!list[i].backed) bad.push({ lv: lv, x: list[i].x, y: list[i].y });
    }
    return bad;
  });
  ok('every picture is hung on a wall', art.length === 0, art.slice(0, 4));


  /* ---- a house is not lit like a hospital ---- */
  const lit = await p.evaluate(() => {
    const out = {};
    for (let lv = 0; lv < 5; lv++) {
      window.__apEnter(lv); window.__apSkipDialogue();
      for (let i = 0; i < 10; i++) window.__apPump(1/60);
      const G = window.Apocalypse.game;
      const sig = [];
      G.scene.traverse(o => {
        if (!o.isLight) return;
        if (o.isHemisphereLight)
          sig.push('H' + o.color.getHexString() + '/' + o.groundColor.getHexString()
                   + '/' + o.intensity.toFixed(2));
        else if (o.isAmbientLight)
          sig.push('A' + o.color.getHexString() + '/' + o.intensity.toFixed(2));
        else if (o.isDirectionalLight)
          sig.push('D' + o.color.getHexString() + '/' + o.intensity.toFixed(2));
      });
      out[G.def.id] = sig.sort().join(' ');
    }
    return out;
  });
  const ids = Object.keys(lit);
  console.log(JSON.stringify(lit, null, 1));
  let dupes = [];
  for (let i = 0; i < ids.length; i++)
    for (let j = i + 1; j < ids.length; j++)
      if (lit[ids[i]] === lit[ids[j]]) dupes.push(ids[i] + '=' + ids[j]);
  ok('no two places are lit the same way', dupes.length === 0, dupes);
  ok('every place is lit at all', ids.every(k => lit[k].length > 0), lit);

  console.log('');
  console.log(pass + ' passed, ' + fail + ' failed');
  await b.close();
  process.exit(fail ? 1 : 0);
})();
