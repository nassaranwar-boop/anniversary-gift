const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox','--no-proxy-server','--use-gl=swiftshader','--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 1100, height: 700 } });
  p.on('pageerror', e => console.log('PAGEERROR', e.message));
  await p.route('**/*', r => { const u = r.request().url();
    if (u.indexOf('book-scene.js') >= 0) return r.abort();
    return u.startsWith('http://127.0.0.1') ? r.continue() : r.abort(); });
  await p.goto('http://127.0.0.1:8899/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForTimeout(700);
  await p.evaluate(() => { try{localStorage.clear();}catch(e){} showScreen('nightshift');
    return loadChapter('nightshift').then(() => OuissysNightShift.start()); });
  await p.waitForFunction(() => Object.keys(OuissysNightShift.__night.cast()).length >= 4, { timeout: 20000, polling: 200 });
  await p.evaluate(() => OuissysNightShift.__night.silence(true));
  const dir = '/tmp/claude-0/shots';
  require('fs').mkdirSync(dir, { recursive: true });

  /* the office at three in the morning on the last night, doors open */
  await p.evaluate(() => { const w = OuissysNightShift.__night;
    w.begin(3); const s = w.state(); s.hour = 3;
    for (let i = 0; i < 300; i++) {
      if (s.phase === 'reveal') { w.route('keep'); continue; }
      if (s.phase === 'find') { w.route('findOut'); continue; }
      if (s.phase === 'held') { w.route('heldOut'); continue; }
      if (s.phase !== 'play') break;
      if (s.monitor) w.press('monitor');
      w.pumpFrame(0.05); }
    return s.phase; });
  await p.waitForTimeout(500);
  await p.screenshot({ path: dir + '/1-office.png' });

  /* the monitor up, on a room with something in it */
  await p.evaluate(() => { const w = OuissysNightShift.__night, s = w.state(), cs = w.cast();
    if (!s.monitor) w.press('monitor');
    w.cam(cs.cogsworth ? cs.cogsworth.room : 'hall');
    for (let i = 0; i < 40; i++) w.pumpFrame(0.05); });
  await p.waitForTimeout(500);
  await p.screenshot({ path: dir + '/2-monitor.png' });

  /* something at the door, door open */
  await p.evaluate(() => { const w = OuissysNightShift.__night, s = w.state(), cs = w.cast();
    if (s.monitor) w.press('monitor');
    const c = cs.cogsworth; if (c) { w.putAt('cogsworth', 'office', 'leftDoor'); c.atDoor = true; c.awake = true; }
    for (let i = 0; i < 20; i++) { if (s.phase !== 'play') break; w.pumpFrame(0.05); } });
  await p.waitForTimeout(500);
  await p.screenshot({ path: dir + '/3-atdoor.png' });

  /* and the scare */
  await p.evaluate(() => { const w = OuissysNightShift.__night; w.catchNow('cogsworth');
    for (let i = 0; i < 6; i++) w.pumpFrame(0.05); });
  await p.waitForTimeout(250);
  await p.screenshot({ path: dir + '/4-caught.png' });
  await p.waitForTimeout(1200);
  await p.screenshot({ path: dir + '/5-after.png' });
  console.log('shots in ' + dir);
  await b.close();
})();
