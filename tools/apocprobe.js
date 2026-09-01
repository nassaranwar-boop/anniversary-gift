const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--no-sandbox'] });
  const p = await b.newPage({ viewport:{width:640,height:400} });
  p.on('pageerror', e => console.log('PAGEERR:', e.message));
  p.on('console', m => { if (m.type()==='error' && !/ERR_FAILED/.test(m.text())) console.log('CONSOLE:', m.text()); });
  await p.route('**', r => (r.request().url().startsWith('http://localhost') ? r.continue() : r.abort()));
  await p.goto('http://localhost:8899/index.html', { waitUntil:'domcontentloaded' });
  await p.evaluate(() => { document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
    document.getElementById('screen-apoc').classList.add('active'); window.Apocalypse.start(); });
  await p.waitForFunction(() => !!window.__apEnter, { timeout:40000 });
  await p.evaluate(() => { window.__apLoop(false); window.__apQuality(2); window.__apEnter(3); });
  const pump = n => p.evaluate(k => { for (let i=0;i<k;i++) window.__apPump(1/60); }, n);
  const st = () => p.evaluate(() => window.__apState());
  console.log('entered:', JSON.stringify(await st()));
  const car = await p.evaluate(() => window.Apocalypse.game.world.carAt);
  console.log('carAt', JSON.stringify(car));
  await p.evaluate(c => window.__apTeleport(c.x + 1, c.y), car);
  await pump(10);
  await p.evaluate(() => { const g = window.Apocalypse.game;
    if (g.state !== 'play') window.__apClear();
    g.zombies.forEach(z => { z.state='calm'; z.look=null; }); });
  await pump(4);
  console.log('before use:', JSON.stringify(await st()));
  const near = await p.evaluate(() => {
    const g = window.Apocalypse.game, w = g.world, p = g.player;
    const tx = Math.floor(p.x/2), ty = Math.floor(p.z/2);
    const out = [];
    for (let j=-1;j<=1;j++) for (let i=-1;i<=1;i++) out.push([tx+i, ty+j, w.at(tx+i, ty+j)]);
    return { tx, ty, out };
  });
  console.log('around her:', JSON.stringify(near));
  await p.evaluate(() => window.__apUse());
  await pump(6);
  console.log('after use:', JSON.stringify(await st()));
  await p.evaluate(() => window.__apSkipDialogue());
  await pump(10);
  console.log('after talk:', JSON.stringify(await st()));
  for (let k=0;k<10;k++) {
    await pump(30);
    const s = await p.evaluate(() => { const g = window.Apocalypse.game;
      return { state:g.state, level:g.def.id, step:g.stepIndex, fade:+g.fade.toFixed(2),
               hasThen:!!g.fadeThen, cine:!!g.cine }; });
    console.log('  t+'+(k*30), JSON.stringify(s));
    if (s.cine) break;
  }
  await b.close();
})();
