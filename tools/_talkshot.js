const { chromium } = require('playwright-core');
const fs = require('fs');
(async () => {
  fs.mkdirSync('/tmp/talk', { recursive: true });
  const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args:['--no-sandbox','--no-proxy-server','--use-gl=swiftshader','--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 900, height: 560 } });
  await p.route('**/*', r => { const u=r.request().url();
    if (u.indexOf('book-scene.js')>=0) return r.abort();
    return u.startsWith('http://127.0.0.1') ? r.continue() : r.abort(); });
  await p.goto('http://127.0.0.1:8899/index.html',{waitUntil:'domcontentloaded',timeout:60000});
  await p.evaluate(() => { localStorage.setItem('ns_seenintro','1'); showScreen('nightshift');
    return loadChapter('nightshift').then(() => OuissysNightShift.start()); });
  await p.waitForFunction(() => window.OuissysNightShift && OuissysNightShift.__night,{timeout:20000,polling:200});
  const cdp = await p.context().newCDPSession(p);
  const snap = async (n) => { const {data} = await cdp.send('Page.captureScreenshot',{format:'png'});
    fs.writeFileSync('/tmp/talk/'+n+'.png', Buffer.from(data,'base64')); };

  for (const [who, door] of [['cogsworth','left'], ['marabelle','right']]) {
    const info = await p.evaluate(([w, d]) => {
      const N = OuissysNightShift.__night;
      N.begin(5, 2);
      const ov = document.getElementById('ns-overlay');
      if (ov) { ov.innerHTML=''; ov.hidden = true; ov.style.display='none'; }
      /* it comes to the door and asks, and she opens it */
      /* the real thing: it asks, she opens it, and the game turns her
         head -- driven through the real talk state, not by hand */
      const c = N.cast()[w];
      N.put(w, c.def.route.length - 1);
      N.state().doors[d] = true;
      N.talkOpen(w);
      for (let i = 0; i < 90; i++) { N.talkTick(0.05); N.viewStep(0.05); }
      N.syncVis();
      N.render();
      const g = c.group;
      g.updateMatrixWorld(true);
      const wp = new (window.THREE || {}).Vector3
        ? new window.THREE.Vector3() : null;
      const pos = [g.position.x, g.position.y, g.position.z].map(v => +v.toFixed(2));
      return { room: c.room, atDoor: !!c.atDoor, door: d,
               step: c.step, of: c.def.route.length,
               anchor: c.def.route[c.def.route.length-1],
               pos: pos, vis: g.visible, parentVis: !!(g.parent && g.parent.visible),
               shown: N.finaleState ? null : null };
    }, [who, door]);
    await p.evaluate(() => OuissysNightShift.__night.render());
    await snap(who + '-open');
    console.log('  ' + who.padEnd(11) + JSON.stringify(info));
  }
  await b.close();
})();
