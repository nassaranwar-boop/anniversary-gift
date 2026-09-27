/* IS THE SHOP ACTUALLY COMING APART, OR DID I JUST WRITE THAT IT IS?

   The wreck system lifts real props out of a room's frozen branch and
   tips them over. Every failure mode of that is invisible to an
   assertion and obvious in a picture: a wall picked up as a prop and
   laid on its side, a shelf sinking through the floor, nothing moving
   at all because the heuristic found no candidates, or the whole room
   twitching because something enormous was re-armed.

   So: one frame before, one frame after.
                                 node tools/wreckshot.js [outdir]      */
const { chromium } = require('playwright-core');
const fs = require('fs');
const OUT = process.argv[2] || '/tmp/wreck';

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const b = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox', '--no-proxy-server', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 900, height: 560 } });
  await p.route('**/*', (r) => { const u = r.request().url();
    if (u.indexOf('book-scene.js') >= 0) return r.abort();
    return u.startsWith('http://127.0.0.1') ? r.continue() : r.abort(); });
  await p.goto('http://127.0.0.1:8899/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.evaluate(() => { localStorage.setItem('ns_seenintro', '1'); showScreen('nightshift');
    return loadChapter('nightshift').then(() => OuissysNightShift.start()); });
  await p.waitForFunction(() => window.OuissysNightShift && OuissysNightShift.__night,
                          { timeout: 20000, polling: 200 });

  const cdp = await p.context().newCDPSession(p);
  const snap = async (name) => {
    const { data } = await cdp.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(OUT + '/' + name + '.png', Buffer.from(data, 'base64'));
  };

  for (const room of ['stage', 'arcade', 'office']) {
    /* stand the camera in the room, draw it clean, then wreck it */
    await p.evaluate((r) => { const N = OuissysNightShift.__night;
      N.state().phase = 'play'; N.state().monitor = true; N.cam(r);
      /* the title card is over the top of the shop and this is a
         picture of the shop */
      const ov = document.getElementById('ns-overlay');
      if (ov) { ov.innerHTML = ''; ov.hidden = true; ov.style.display = 'none'; }
      const hud = document.getElementById('ns-hud');
      if (hud) hud.style.display = 'none'; }, room);
    await p.evaluate(() => OuissysNightShift.__night.render());
    await snap(room + '-1-before');

    const got = await p.evaluate((r) => OuissysNightShift.__night.wreck(r, 14), room);
    /* let it fall */
    for (let i = 0; i < 80; i++) await p.evaluate(() => OuissysNightShift.__night.wreckStep(0.05));
    await p.evaluate(() => OuissysNightShift.__night.render());
    await snap(room + '-2-after');
    console.log('  ' + room.padEnd(8) + ' tipped ' + got + ' things');

    /* and it all goes back */
    await p.evaluate(() => OuissysNightShift.__night.wreckClear());
    await p.evaluate(() => OuissysNightShift.__night.render());
    await snap(room + '-3-restored');
  }
  console.log('\n  written to ' + OUT);
  await b.close();
})();
