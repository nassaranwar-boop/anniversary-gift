const { boot, driver } = require('./_aplib');
(async () => {
  const { browser, page } = await boot();
  const D = driver(page);
  const info = async (t) => { const s = await D.state();
    console.log(t, '|', s.state, 'lvl='+s.level, 'step='+s.step, 'cut='+JSON.stringify(s.cut),
      'card=', await page.evaluate(()=>{const n=document.querySelector('.ap-card-title, .ap-card');return n?n.textContent.slice(0,40):null;})); };
  await D.enter(3); await D.talk(3);
  await D.at('C'); await D.talk(6); await D.pump(2); await D.skipCut();
  await D.at('H'); await D.talk(10); await D.pump(2); await D.skipCut();
  await D.talk(6); await D.pump(3); await info('campsite');
  for (let i=0;i<5;i++){ const g = await page.evaluate(()=>{const f=window.__apFind('wg'); if(!f.length) return null;
    window.__apTeleport(f[0].x,f[0].y+1); window.__apPump(1/60,4); window.__apUse(); return f[0];});
    if(!g) break; await page.waitForTimeout(250); await D.talk(4); await D.pump(0.5);
    if((await D.state()).step!=='wood') break; }
  await info('wood done');
  await page.evaluate(()=>{const w=window.Apocalypse.game.world; if(w.firePitAt){window.__apClear();
    window.__apTeleport(w.firePitAt.x,w.firePitAt.y+1); window.__apPump(1/60,4); window.__apUse();}});
  await page.waitForTimeout(400); await info('fire lit');
  for (let i=0;i<10;i++){ await D.talk(4); await D.pump(4); await D.skipCut(); await info('step'+i); }
  await browser.close(); process.exit(0);
})();
